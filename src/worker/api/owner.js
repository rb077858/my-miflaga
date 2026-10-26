// API של בעל המפלגה. כל פעולה כאן דורשת משתמש מאומת, ופועלת רק על המפלגה שבבעלותו.
import { HttpError, json, readJson } from '../http.js';
import { requireUser, touchUser, isAdmin } from '../auth.js';
import { limitOrThrow } from '../ratelimit.js';
import { newId, now, today } from '../util.js';
import {
  partyByOwner, toOwner, categoryIds, categoriesList, logActivity, deletePartyCascade, slugAvailable, nameAvailable,
} from '../model.js';
import { validatePartyInput, slugify, slugProblem, nameKey, cleanText } from '../../shared/validate.js';
import { LIMITS, POLL_KINDS } from '../../shared/constants.js';

const JSON_FIELDS = ['emblem', 'platform', 'leaders', 'campaign'];

async function ownParty(env, user) {
  const party = await partyByOwner(env, user.id);
  if (!party) throw new HttpError(404, 'no_party', 'עדיין אין לך מפלגה');
  return party;
}

function isUnique(err, column) {
  const m = String(err?.message || err);
  return m.includes('UNIQUE') && (!column || m.includes(column));
}

async function ownerSummary(env, party) {
  const [supporters, inboxNew, polls, views7, activity] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM supporters WHERE party_id = ?').bind(party.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE party_id = ? AND status = 'new'").bind(party.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM polls WHERE party_id = ? AND status = 'open'").bind(party.id).first(),
    env.DB.prepare('SELECT COALESCE(SUM(views), 0) AS n FROM party_views WHERE party_id = ? AND day >= ?')
      .bind(party.id, today(now() - 6 * 864e5)).first(),
    env.DB.prepare('SELECT action, created_at FROM party_activity WHERE party_id = ? ORDER BY created_at DESC LIMIT 8').bind(party.id).all(),
  ]);
  return {
    supporters: supporters.n,
    inbox_new: inboxNew.n,
    open_polls: polls.n,
    views_7d: views7.n,
    views_total: party.views_total,
    activity: activity.results,
  };
}

async function disabledTemplates(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'disabled_templates'").first();
  try { return row ? JSON.parse(row.value) : []; } catch { return []; }
}

export async function getMe(request, env) {
  const user = await requireUser(request, env);
  await touchUser(env, user);
  const party = await partyByOwner(env, user.id);
  return json({
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    is_admin: isAdmin(env, user),
    party: party ? toOwner(party) : null,
    summary: party ? await ownerSummary(env, party) : null,
    categories: await categoriesList(env),
    disabled_templates: await disabledTemplates(env),
  });
}

export async function checkNames(request, env, url) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'slugcheck', user.id, 120, 3600);
  const party = await partyByOwner(env, user.id);
  const out = {};
  const slug = url.searchParams.get('slug');
  const name = url.searchParams.get('name');
  if (slug !== null) {
    const problem = slugProblem(slug);
    out.slug = { value: slug, ok: !problem && (await slugAvailable(env, slug, user.id, party?.id)), problem };
    if (!problem && !out.slug.ok) out.slug.problem = 'הנתיב הזה כבר תפוס';
  }
  if (name !== null) {
    const key = nameKey(name);
    out.name = { ok: key.length > 1 && (await nameAvailable(env, key, party?.id)) };
    if (!out.name.ok) out.name.problem = key.length > 1 ? 'כבר יש מפלגה בשם הזה. אולי "החדשה"?' : 'השם קצר מדי';
    out.suggestion = slugify(name);
  }
  return json(out);
}

async function pickSlug(env, wanted, base, userId) {
  if (wanted) {
    const problem = slugProblem(wanted);
    if (problem) throw new HttpError(422, 'invalid', problem, { fields: { slug: problem } });
    if (!(await slugAvailable(env, wanted, userId, null))) throw new HttpError(409, 'slug_taken', 'הנתיב הזה כבר תפוס', { fields: { slug: 'הנתיב הזה כבר תפוס' } });
    return wanted;
  }
  let root = slugify(base);
  if (root.length < 3 || slugProblem(root)) root = `party-${newId(6).toLowerCase()}`;
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 34)}-${i + 1}`;
    if (!slugProblem(candidate) && (await slugAvailable(env, candidate, userId, null))) return candidate;
  }
  return `${root.slice(0, 30)}-${newId(6).toLowerCase()}`;
}

export async function createParty(request, env) {
  const user = await requireUser(request, env);
  await touchUser(env, user);
  await limitOrThrow(env, 'create', user.id, 10, 3600);

  // בדיקה ראשונה בשרת. הבדיקה הסופית היא אילוץ UNIQUE על owner_id במסד.
  if (await partyByOwner(env, user.id)) {
    throw new HttpError(409, 'party_exists', 'כבר יש לך מפלגה. אפשר לערוך אותה, אבל לא להקים עוד אחת');
  }
  const body = await readJson(request);
  const { data, errors } = validatePartyInput(body, { categories: await categoryIds(env) });
  if (!data.name && !errors.name) errors.name = 'שם המפלגה: חסר';
  if (!data.acronym && !errors.acronym) errors.acronym = 'ראשי תיבות: חסר';
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });

  const key = nameKey(data.name);
  if (!(await nameAvailable(env, key, null))) {
    throw new HttpError(409, 'name_taken', 'כבר יש מפלגה בשם הזה', { fields: { name: 'כבר יש מפלגה בשם הזה. אולי "החדשה"?' } });
  }
  const slug = await pickSlug(env, body.slug ? String(body.slug) : null, data.name, user.id);
  const id = newId();
  const t = now();
  const cols = { ...data, id, owner_id: user.id, slug, name_key: key, created_at: t, updated_at: t, wizard_step: 2 };
  for (const f of JSON_FIELDS) if (f in cols) cols[f] = JSON.stringify(cols[f]);
  const names = Object.keys(cols);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO parties (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).bind(...names.map((n) => cols[n])),
      env.DB.prepare('DELETE FROM slug_history WHERE slug = ? AND owner_id = ?').bind(slug, user.id),
      env.DB.prepare('INSERT INTO party_activity (party_id, action, created_at) VALUES (?, ?, ?)').bind(id, 'המפלגה הוקמה (טיוטה)', t),
    ]);
  } catch (err) {
    if (isUnique(err, 'owner_id')) throw new HttpError(409, 'party_exists', 'כבר יש לך מפלגה. אפשר לערוך אותה, אבל לא להקים עוד אחת');
    if (isUnique(err, 'name_key')) throw new HttpError(409, 'name_taken', 'כבר יש מפלגה בשם הזה', { fields: { name: 'כבר יש מפלגה בשם הזה' } });
    if (isUnique(err, 'slug')) throw new HttpError(409, 'slug_taken', 'הנתיב הזה כבר תפוס', { fields: { slug: 'הנתיב הזה כבר תפוס' } });
    throw err;
  }
  const party = await partyByOwner(env, user.id);
  return json({ party: toOwner(party) }, 201);
}

async function assertImagesOwned(env, party, ids, kind) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  const { results } = await env.DB.prepare(
    `SELECT id FROM images WHERE party_id = ? AND kind = ? AND id IN (${list.map(() => '?').join(',')})`,
  ).bind(party.id, kind, ...list).all();
  const found = new Set(results.map((r) => r.id));
  for (const id of list) if (!found.has(id)) throw new HttpError(422, 'invalid', 'תמונה לא נמצאה. נסו להעלות אותה שוב');
}

export async function updateParty(request, env) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'update', user.id, 240, 3600);
  const party = await ownParty(env, user);
  const body = await readJson(request, 256 * 1024);
  delete body.slug; // לשינוי נתיב יש נקודת קצה נפרדת
  const { data, errors } = validatePartyInput(body, { categories: await categoryIds(env) });
  if ('name' in body && !data.name && !errors.name) errors.name = 'שם המפלגה: חסר';
  if ('acronym' in body && !data.acronym && !errors.acronym) errors.acronym = 'ראשי תיבות: חסר';
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });

  if (data.name) {
    const key = nameKey(data.name);
    if (!(await nameAvailable(env, key, party.id))) throw new HttpError(409, 'name_taken', 'כבר יש מפלגה בשם הזה', { fields: { name: 'כבר יש מפלגה בשם הזה' } });
    data.name_key = key;
  }
  if (data.emblem?.image) await assertImagesOwned(env, party, [data.emblem.image], 'emblem');
  if (data.leaders) await assertImagesOwned(env, party, data.leaders.map((l) => l.image), 'leader');
  if (party.status === 'published' && data.wizard_step) delete data.wizard_step;
  if (data.wizard_step && data.wizard_step < party.wizard_step) delete data.wizard_step;

  const keys = Object.keys(data);
  if (!keys.length) return json({ party: toOwner(party) });
  for (const f of JSON_FIELDS) if (f in data) data[f] = JSON.stringify(data[f]);
  data.updated_at = now();
  const names = Object.keys(data);
  try {
    await env.DB.prepare(`UPDATE parties SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ? AND owner_id = ?`)
      .bind(...names.map((n) => data[n]), party.id, user.id).run();
  } catch (err) {
    if (isUnique(err, 'name_key')) throw new HttpError(409, 'name_taken', 'כבר יש מפלגה בשם הזה', { fields: { name: 'כבר יש מפלגה בשם הזה' } });
    throw err;
  }
  // ניקוי תמונות הנהלה שכבר לא בשימוש
  if (body.leaders) {
    const used = JSON.parse(data.leaders).map((l) => l.image).filter(Boolean);
    await env.DB.prepare(
      `DELETE FROM images WHERE party_id = ? AND kind = 'leader' ${used.length ? `AND id NOT IN (${used.map(() => '?').join(',')})` : ''}`,
    ).bind(party.id, ...used).run();
  }
  const section = body.platform ? 'המצע עודכן' : body.leaders ? 'ההנהלה עודכנה' : body.campaign ? 'חומרי הקמפיין עודכנו' : body.emblem ? 'הסמל עודכן' : 'פרטי המפלגה עודכנו';
  await logActivity(env, party.id, section);
  return json({ party: toOwner(await partyByOwner(env, user.id)) });
}

export async function changeSlug(request, env) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'slug', user.id, 10, 86400);
  const party = await ownParty(env, user);
  const body = await readJson(request);
  const slug = String(body.slug || '');
  const problem = slugProblem(slug);
  if (problem) throw new HttpError(422, 'invalid', problem, { fields: { slug: problem } });
  if (slug === party.slug) return json({ party: toOwner(party) });
  if (!(await slugAvailable(env, slug, user.id, party.id))) throw new HttpError(409, 'slug_taken', 'הנתיב הזה כבר תפוס', { fields: { slug: 'הנתיב הזה כבר תפוס' } });
  const t = now();
  const stmts = [
    env.DB.prepare('UPDATE parties SET slug = ?, updated_at = ? WHERE id = ? AND owner_id = ?').bind(slug, t, party.id, user.id),
    env.DB.prepare('DELETE FROM slug_history WHERE slug = ? AND owner_id = ?').bind(slug, user.id),
  ];
  // אחרי פרסום, הנתיב הישן ממשיך להפנות לחדש כדי שקישורים ששותפו לא יישברו.
  if (party.published_at) {
    stmts.push(env.DB.prepare(
      `INSERT INTO slug_history (slug, party_id, owner_id, reason, created_at) VALUES (?, ?, ?, 'renamed', ?)
       ON CONFLICT(slug) DO UPDATE SET party_id = excluded.party_id, reason = 'renamed', created_at = excluded.created_at`,
    ).bind(party.slug, party.id, user.id, t));
  }
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    if (isUnique(err, 'slug')) throw new HttpError(409, 'slug_taken', 'הנתיב הזה כבר תפוס', { fields: { slug: 'הנתיב הזה כבר תפוס' } });
    throw err;
  }
  await logActivity(env, party.id, `הנתיב הציבורי שונה ל-${slug}`);
  return json({ party: toOwner(await partyByOwner(env, user.id)) });
}

export function publishProblems(party) {
  const problems = [];
  if (!party.name) problems.push('שם המפלגה');
  if (!party.acronym) problems.push('ראשי תיבות');
  if (!party.slogan) problems.push('סיסמת בחירות');
  if (!party.short_desc) problems.push('תיאור קצר');
  return problems;
}

export async function publishParty(request, env) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'publish', user.id, 30, 3600);
  const party = await ownParty(env, user);
  if (party.mod_status === 'blocked') throw new HttpError(403, 'blocked', 'המפלגה הושעתה על ידי מנהל המערכת ולא ניתן לפרסם אותה כרגע');
  const problems = publishProblems(party);
  if (problems.length) throw new HttpError(422, 'incomplete', `כדי לפרסם חסרים: ${problems.join(', ')}`, { missing: problems });
  const t = now();
  await env.DB.prepare("UPDATE parties SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?, wizard_step = 6 WHERE id = ? AND owner_id = ?")
    .bind(t, t, party.id, user.id).run();
  await logActivity(env, party.id, party.visibility === 'public' ? 'המפלגה פורסמה' : 'המפלגה פורסמה (פרטית)');
  return json({ party: toOwner(await partyByOwner(env, user.id)) });
}

export async function unpublishParty(request, env) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  await env.DB.prepare("UPDATE parties SET status = 'draft', updated_at = ? WHERE id = ? AND owner_id = ?").bind(now(), party.id, user.id).run();
  await logActivity(env, party.id, 'הפרסום בוטל, המפלגה חזרה לטיוטה');
  return json({ party: toOwner(await partyByOwner(env, user.id)) });
}

export async function deleteParty(request, env) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'delete', user.id, 5, 3600);
  const party = await ownParty(env, user);
  const body = await readJson(request);
  if (cleanText(body.confirm) !== party.name) {
    throw new HttpError(422, 'confirm_mismatch', 'כדי למחוק, יש להקליד את שם המפלגה בדיוק כפי שהוא', { fields: { confirm: 'השם לא תואם' } });
  }
  await deletePartyCascade(env, party);
  return json({ ok: true });
}

// ---------- פניות ותומכים ----------

export async function listInbox(request, env, url) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const status = url.searchParams.get('status');
  const kind = url.searchParams.get('kind');
  const where = ['party_id = ?'];
  const args = [party.id];
  if (['new', 'read', 'archived', 'spam'].includes(status)) { where.push('status = ?'); args.push(status); } else where.push("status != 'spam'");
  if (['idea', 'question', 'slogan'].includes(kind)) { where.push('kind = ?'); args.push(kind); }
  const { results } = await env.DB.prepare(
    `SELECT id, kind, name, contact, body, status, created_at FROM submissions WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
  ).bind(...args).all();
  return json({ items: results });
}

export async function updateInbox(request, env, id) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const body = await readJson(request);
  if (!['new', 'read', 'archived', 'spam'].includes(body.status)) throw new HttpError(422, 'invalid', 'סטטוס לא תקין');
  const r = await env.DB.prepare('UPDATE submissions SET status = ? WHERE id = ? AND party_id = ?').bind(body.status, id, party.id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'הפנייה לא נמצאה');
  return json({ ok: true });
}

export async function deleteInbox(request, env, id) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const r = await env.DB.prepare('DELETE FROM submissions WHERE id = ? AND party_id = ?').bind(id, party.id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'הפנייה לא נמצאה');
  return json({ ok: true });
}

export async function listSupporters(request, env) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const { results } = await env.DB.prepare(
    'SELECT id, display_name, message, public_ok, created_at FROM supporters WHERE party_id = ? ORDER BY created_at DESC LIMIT 500',
  ).bind(party.id).all();
  return json({ items: results });
}

export async function deleteSupporter(request, env, id) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const r = await env.DB.prepare('DELETE FROM supporters WHERE id = ? AND party_id = ?').bind(id, party.id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'התומך לא נמצא');
  await env.DB.prepare('UPDATE parties SET supporters_count = (SELECT COUNT(*) FROM supporters WHERE party_id = ?) WHERE id = ?').bind(party.id, party.id).run();
  return json({ ok: true });
}

export async function stats(request, env) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const { results } = await env.DB.prepare('SELECT day, views FROM party_views WHERE party_id = ? AND day >= ? ORDER BY day')
    .bind(party.id, today(now() - 29 * 864e5)).all();
  return json({ views: results, summary: await ownerSummary(env, party) });
}

// ---------- הצבעות ----------

export async function pollResults(env, pollId) {
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.label, o.position, COUNT(v.voter_id) AS votes
     FROM poll_options o LEFT JOIN votes v ON v.option_id = o.id AND v.poll_id = o.poll_id
     WHERE o.poll_id = ? GROUP BY o.id ORDER BY o.position`,
  ).bind(pollId).all();
  return results;
}

export async function listOwnerPolls(request, env) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const { results } = await env.DB.prepare('SELECT * FROM polls WHERE party_id = ? ORDER BY created_at DESC LIMIT 50').bind(party.id).all();
  const items = [];
  for (const p of results) items.push({ ...p, options: await pollResults(env, p.id) });
  return json({ items });
}

export async function createPoll(request, env) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'poll', user.id, 20, 3600);
  const party = await ownParty(env, user);
  const body = await readJson(request);
  const question = cleanText(body.question);
  const kind = POLL_KINDS[body.kind] ? body.kind : 'custom';
  const results = ['after_vote', 'always', 'after_close'].includes(body.results) ? body.results : 'after_vote';
  const options = Array.isArray(body.options) ? body.options.map((o) => cleanText(o)).filter(Boolean) : [];
  const errors = {};
  if (question.length < 3 || question.length > 140) errors.question = 'השאלה: 3–140 תווים';
  if (options.length < 2 || options.length > LIMITS.pollOptions) errors.options = `צריך 2–${LIMITS.pollOptions} אפשרויות`;
  if (options.some((o) => o.length > 80)) errors.options = 'כל אפשרות עד 80 תווים';
  if (new Set(options).size !== options.length) errors.options = 'יש אפשרויות כפולות';
  let endsAt = null;
  if (body.ends_at) {
    endsAt = Date.parse(body.ends_at);
    if (!endsAt || endsAt < now() + 5 * 60 * 1000 || endsAt > now() + 366 * 864e5) errors.ends_at = 'מועד הסיום צריך להיות בעתיד (עד שנה קדימה)';
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM polls WHERE party_id = ? AND status = 'open'").bind(party.id).first();
  if (open.n >= LIMITS.openPolls) throw new HttpError(409, 'too_many', `אפשר עד ${LIMITS.openPolls} הצבעות פתוחות בו זמנית. סגרו אחת קודם`);
  const id = newId();
  const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO polls (id, party_id, question, kind, status, results, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, party.id, question, kind, 'open', results, endsAt, t),
    ...options.map((label, i) => env.DB.prepare('INSERT INTO poll_options (id, poll_id, label, position) VALUES (?, ?, ?, ?)').bind(newId(), id, label, i)),
  ]);
  await logActivity(env, party.id, `נפתחה הצבעה: ${question}`);
  return json({ id }, 201);
}

export async function closePoll(request, env, id) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const r = await env.DB.prepare("UPDATE polls SET status = 'closed', closed_at = ? WHERE id = ? AND party_id = ? AND status = 'open'").bind(now(), id, party.id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'ההצבעה לא נמצאה או שכבר נסגרה');
  await logActivity(env, party.id, 'הצבעה נסגרה');
  return json({ ok: true });
}

export async function deletePoll(request, env, id) {
  const user = await requireUser(request, env);
  const party = await ownParty(env, user);
  const poll = await env.DB.prepare('SELECT id FROM polls WHERE id = ? AND party_id = ?').bind(id, party.id).first();
  if (!poll) throw new HttpError(404, 'not_found', 'ההצבעה לא נמצאה');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM votes WHERE poll_id = ?').bind(id),
    env.DB.prepare('DELETE FROM poll_options WHERE poll_id = ?').bind(id),
    env.DB.prepare('DELETE FROM polls WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}
