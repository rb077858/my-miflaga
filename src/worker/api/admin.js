// API של מנהל המערכת. כל נקודה כאן בודקת בשרת: טוקן תקף מ-Reem.bi + מייל שנמצא ב-ADMIN_EMAILS.
import { HttpError, json, readJson } from '../http.js';
import { requireAdmin, adminEmails, ssoOrigin } from '../auth.js';
import { now, today } from '../util.js';
import {
  partyById, toOwner, adminLog, deletePartyCascade, categoryIds, categoriesList, nameAvailable,
} from '../model.js';
import { validatePartyInput, cleanText, nameKey } from '../../shared/validate.js';

async function counts(env) {
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).first().then((r) => r.n);
  const weekAgo = now() - 7 * 864e5;
  const [parties, published, drafts, hidden, blocked, users, supporters, subsNew, reportsOpen, votes, views7, newWeek] = await Promise.all([
    q('SELECT COUNT(*) AS n FROM parties'),
    q("SELECT COUNT(*) AS n FROM parties WHERE status = 'published'"),
    q("SELECT COUNT(*) AS n FROM parties WHERE status = 'draft'"),
    q("SELECT COUNT(*) AS n FROM parties WHERE mod_status = 'hidden'"),
    q("SELECT COUNT(*) AS n FROM parties WHERE mod_status = 'blocked'"),
    q('SELECT COUNT(*) AS n FROM users'),
    q('SELECT COUNT(*) AS n FROM supporters'),
    q("SELECT COUNT(*) AS n FROM submissions WHERE status = 'new'"),
    q("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    q('SELECT COUNT(*) AS n FROM votes'),
    q('SELECT COALESCE(SUM(views), 0) AS n FROM party_views WHERE day >= ?', today(weekAgo)),
    q('SELECT COUNT(*) AS n FROM parties WHERE created_at >= ?', weekAgo),
  ]);
  return { parties, published, drafts, hidden, blocked, users, supporters, subsNew, reportsOpen, votes, views7, newWeek };
}

async function healthChecks(env) {
  const checks = [];
  const admins = adminEmails(env);
  checks.push({ label: 'ADMIN_EMAILS', ok: admins.length > 0, detail: admins.length ? `${admins.length} מנהלים מוגדרים` : 'חסר: אף אחד לא יוכל לנהל' });
  checks.push({ label: 'RATE_SALT', ok: !!env.RATE_SALT && env.RATE_SALT.length >= 16, detail: env.RATE_SALT ? 'מוגדר' : 'חסר: משתמשים בערך פיתוח לא בטוח' });
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM categories').first();
    checks.push({ label: 'מסד נתונים (D1)', ok: true, detail: `תקין, ${r.n} קטגוריות` });
  } catch (err) {
    checks.push({ label: 'מסד נתונים (D1)', ok: false, detail: 'לא זמין: ייתכן שה-migrations לא הורצו' });
  }
  try {
    const started = Date.now();
    const res = await fetch(`${ssoOrigin(env)}/api/userinfo`, { headers: { authorization: 'Bearer health-check-invalid-token' } });
    checks.push({ label: 'Reem.bi', ok: res.status === 401 || res.status === 403 || res.ok, detail: `מגיב (${res.status}, ${Date.now() - started}ms)` });
  } catch {
    checks.push({ label: 'Reem.bi', ok: false, detail: 'לא מגיב' });
  }
  const errs = await env.DB.prepare('SELECT COUNT(*) AS n FROM error_log WHERE created_at >= ?').bind(now() - 864e5).first();
  checks.push({ label: 'שגיאות ב-24 השעות האחרונות', ok: errs.n < 20, detail: String(errs.n) });
  return checks;
}

export async function manifest(request, env) {
  await requireAdmin(request, env);
  const c = await counts(env);
  const [recent, reports, errors] = await Promise.all([
    env.DB.prepare('SELECT name, slug, status, mod_status, created_at FROM parties ORDER BY created_at DESC LIMIT 10').all(),
    env.DB.prepare("SELECT r.reason, r.created_at, p.name FROM reports r LEFT JOIN parties p ON p.id = r.party_id WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 10").all(),
    env.DB.prepare('SELECT route, message, created_at FROM error_log ORDER BY created_at DESC LIMIT 10').all(),
  ]);
  return json({
    version: 1,
    stats: [
      { label: 'מפלגות', value: c.parties },
      { label: 'מפורסמות', value: c.published },
      { label: 'טיוטות', value: c.drafts },
      { label: 'חדשות השבוע', value: c.newWeek },
      { label: 'משתמשים', value: c.users },
      { label: 'תומכים', value: c.supporters },
      { label: 'פניות חדשות', value: c.subsNew },
      { label: 'דיווחים פתוחים', value: c.reportsOpen },
      { label: 'צפיות (7 ימים)', value: c.views7 },
    ],
    checks: await healthChecks(env),
    actions: [
      { id: 'close-expired-polls', label: 'סגירת הצבעות שפג מועדן', description: 'סוגר הצבעות שמועד הסיום שלהן עבר', primary: false },
      { id: 'recount', label: 'חישוב מחדש של מוני תומכים', description: 'מסנכרן את מספר התומכים בכל מפלגה', primary: false },
      { id: 'prune', label: 'ניקוי נתונים ישנים', description: 'מוחק רישומי הגבלת קצב, שגיאות ישנות ופניות ספאם מלפני 30 יום', confirm: 'למחוק נתונים תפעוליים ישנים?', primary: false },
    ],
    lists: [
      {
        title: 'מפלגות אחרונות', empty: 'עדיין אין מפלגות',
        items: recent.results.map((p) => ({
          title: p.name, subtitle: `/party/${p.slug}/`, date: p.created_at,
          badge: p.mod_status !== 'ok' ? (p.mod_status === 'blocked' ? 'חסומה' : 'מוסתרת') : p.status === 'published' ? 'מפורסמת' : 'טיוטה',
          badgeLevel: p.mod_status === 'blocked' ? 'red' : p.status === 'published' ? 'green' : '',
        })),
      },
      {
        title: 'דיווחים פתוחים', empty: 'אין דיווחים פתוחים',
        items: reports.results.map((r) => ({ title: r.name || 'מפלגה שנמחקה', subtitle: r.reason, date: r.created_at, badge: 'פתוח', badgeLevel: 'red' })),
      },
      {
        title: 'שגיאות אחרונות', empty: 'אין שגיאות',
        items: errors.results.map((e) => ({ title: e.route, subtitle: e.message, date: e.created_at, badgeLevel: 'red' })),
      },
    ],
  });
}

export async function runAction(request, env, id) {
  const admin = await requireAdmin(request, env);
  let message;
  if (id === 'close-expired-polls') {
    const r = await env.DB.prepare("UPDATE polls SET status = 'closed', closed_at = ? WHERE status = 'open' AND ends_at IS NOT NULL AND ends_at < ?").bind(now(), now()).run();
    message = `נסגרו ${r.meta.changes} הצבעות`;
  } else if (id === 'recount') {
    await env.DB.prepare('UPDATE parties SET supporters_count = (SELECT COUNT(*) FROM supporters s WHERE s.party_id = parties.id)').run();
    message = 'המונים חושבו מחדש';
  } else if (id === 'prune') {
    message = await prune(env);
  } else {
    throw new HttpError(404, 'not_found', 'פעולה לא מוכרת');
  }
  await adminLog(env, admin, `action:${id}`, 'system', '', { message });
  return json({ message });
}

export async function prune(env) {
  const t = now();
  const [a, b, c] = await env.DB.batch([
    env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(t - 2 * 864e5),
    env.DB.prepare('DELETE FROM error_log WHERE created_at < ?').bind(t - 30 * 864e5),
    env.DB.prepare("DELETE FROM submissions WHERE status = 'spam' AND created_at < ?").bind(t - 30 * 864e5),
    env.DB.prepare('DELETE FROM party_activity WHERE created_at < ?').bind(t - 180 * 864e5),
    env.DB.prepare("UPDATE polls SET status = 'closed', closed_at = ? WHERE status = 'open' AND ends_at IS NOT NULL AND ends_at < ?").bind(t, t),
  ]);
  return `נמחקו ${a.meta.changes} רישומי קצב, ${b.meta.changes} שגיאות ו-${c.meta.changes} פניות ספאם`;
}

export async function overview(request, env) {
  await requireAdmin(request, env);
  const [c, checks, errors, daily] = await Promise.all([
    counts(env),
    healthChecks(env),
    env.DB.prepare('SELECT id, route, message, created_at FROM error_log ORDER BY created_at DESC LIMIT 50').all(),
    env.DB.prepare('SELECT day, SUM(views) AS views FROM party_views WHERE day >= ? GROUP BY day ORDER BY day').bind(today(now() - 13 * 864e5)).all(),
  ]);
  return json({ counts: c, checks, errors: errors.results, daily_views: daily.results });
}

export async function listParties(request, env, url) {
  await requireAdmin(request, env);
  const q = cleanText(url.searchParams.get('q') || '').slice(0, 80);
  const status = url.searchParams.get('status');
  const mod = url.searchParams.get('mod');
  const where = ['1 = 1'];
  const args = [];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  if (['draft', 'published'].includes(status)) { where.push('p.status = ?'); args.push(status); }
  if (['ok', 'hidden', 'blocked'].includes(mod)) { where.push('p.mod_status = ?'); args.push(mod); }
  if (url.searchParams.get('featured') === '1') where.push('p.featured = 1');
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.acronym, p.status, p.visibility, p.mod_status, p.featured, p.featured_rank, p.home_hidden,
            p.show_on_home, p.supporters_count, p.views_total, p.created_at, p.updated_at, p.color_primary, p.color_secondary, p.emblem,
            u.email AS owner_email,
            (SELECT COUNT(*) FROM reports r WHERE r.party_id = p.id AND r.status = 'open') AS open_reports
     FROM parties p LEFT JOIN users u ON u.id = p.owner_id
     WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT 300`,
  ).bind(...args).all();
  return json({ items: results.map((r) => ({ ...r, emblem: JSON.parse(r.emblem || '{}') })) });
}

export async function getParty(request, env, id) {
  await requireAdmin(request, env);
  const party = await partyById(env, id);
  if (!party) throw new HttpError(404, 'not_found', 'המפלגה לא נמצאה');
  const owner = await env.DB.prepare('SELECT id, email, name, created_at, last_seen_at FROM users WHERE id = ?').bind(party.owner_id).first();
  const [reports, subs, sup, polls, gallery] = await Promise.all([
    env.DB.prepare('SELECT * FROM reports WHERE party_id = ? ORDER BY created_at DESC LIMIT 50').bind(id).all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM submissions WHERE party_id = ?').bind(id).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM supporters WHERE party_id = ?').bind(id).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM polls WHERE party_id = ?').bind(id).first(),
    env.DB.prepare("SELECT id, title, size, created_at FROM images WHERE party_id = ? AND kind = 'gallery' ORDER BY created_at DESC").bind(id).all(),
  ]);
  return json({
    party: { ...toOwner(party), owner_id: party.owner_id },
    owner,
    reports: reports.results,
    gallery: gallery.results,
    counts: { submissions: subs.n, supporters: sup.n, polls: polls.n },
  });
}

const MOD_FIELDS = ['mod_status', 'mod_note', 'featured', 'featured_rank', 'home_hidden'];

export async function patchParty(request, env, id) {
  const admin = await requireAdmin(request, env);
  const party = await partyById(env, id);
  if (!party) throw new HttpError(404, 'not_found', 'המפלגה לא נמצאה');
  const body = await readJson(request, 256 * 1024);
  const update = {};
  if ('mod_status' in body) {
    if (!['ok', 'hidden', 'blocked'].includes(body.mod_status)) throw new HttpError(422, 'invalid', 'סטטוס ניהול לא תקין');
    update.mod_status = body.mod_status;
  }
  if ('mod_note' in body) update.mod_note = cleanText(body.mod_note, { multiline: true }).slice(0, 500);
  if ('featured' in body) update.featured = body.featured ? 1 : 0;
  if ('featured_rank' in body) update.featured_rank = Math.max(0, Math.min(999, Number(body.featured_rank) || 0));
  if ('home_hidden' in body) update.home_hidden = body.home_hidden ? 1 : 0;

  // עריכת תוכן ציבורי (לתיקון או להסרת תוכן פוגעני)
  const content = {};
  for (const k of Object.keys(body)) if (!MOD_FIELDS.includes(k)) content[k] = body[k];
  delete content.slug;
  delete content.wizard_step;
  if (Object.keys(content).length) {
    const { data, errors } = validatePartyInput(content, { categories: await categoryIds(env) });
    if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });
    if (data.name) {
      const key = nameKey(data.name);
      if (!(await nameAvailable(env, key, party.id))) throw new HttpError(409, 'name_taken', 'כבר יש מפלגה בשם הזה');
      data.name_key = key;
    }
    for (const f of ['emblem', 'platform', 'leaders', 'campaign']) if (f in data) data[f] = JSON.stringify(data[f]);
    Object.assign(update, data);
  }
  const names = Object.keys(update);
  if (!names.length) throw new HttpError(422, 'invalid', 'אין מה לעדכן');
  await env.DB.prepare(`UPDATE parties SET ${names.map((n) => `${n} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...names.map((n) => update[n]), now(), id).run();
  const changed = {};
  for (const n of names) changed[n] = n in body && typeof body[n] !== 'object' ? body[n] : '(עודכן)';
  await adminLog(env, admin, 'party:update', 'party', id, { name: party.name, changed });
  return json({ ok: true });
}

export async function removeParty(request, env, id) {
  const admin = await requireAdmin(request, env);
  const party = await partyById(env, id);
  if (!party) throw new HttpError(404, 'not_found', 'המפלגה לא נמצאה');
  const body = await readJson(request);
  const reason = cleanText(body.reason).slice(0, 300);
  if (reason.length < 3) throw new HttpError(422, 'invalid', 'יש לכתוב סיבה למחיקה (לתיעוד ביומן)');
  await deletePartyCascade(env, party);
  await adminLog(env, admin, 'party:delete', 'party', id, { name: party.name, slug: party.slug, owner_id: party.owner_id, reason });
  return json({ ok: true });
}

export async function removeImage(request, env, id) {
  const admin = await requireAdmin(request, env);
  const img = await env.DB.prepare("SELECT id, party_id, title FROM images WHERE id = ? AND kind = 'gallery'").bind(id).first();
  if (!img) throw new HttpError(404, 'not_found', 'התמונה לא נמצאה');
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
  await adminLog(env, admin, 'image:delete', 'party', img.party_id, { image: id, title: img.title });
  return json({ ok: true });
}

export async function listReports(request, env, url) {
  await requireAdmin(request, env);
  const status = ['open', 'resolved', 'dismissed'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'open';
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.party_id, r.reason, r.details, r.status, r.created_at, r.resolved_at, p.name AS party_name, p.slug AS party_slug, p.mod_status
     FROM reports r LEFT JOIN parties p ON p.id = r.party_id WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
  ).bind(status).all();
  return json({ items: results });
}

export async function patchReport(request, env, id) {
  const admin = await requireAdmin(request, env);
  const body = await readJson(request);
  if (!['open', 'resolved', 'dismissed'].includes(body.status)) throw new HttpError(422, 'invalid', 'סטטוס לא תקין');
  const r = await env.DB.prepare('UPDATE reports SET status = ?, resolved_at = ? WHERE id = ?').bind(body.status, body.status === 'open' ? null : now(), id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'הדיווח לא נמצא');
  await adminLog(env, admin, `report:${body.status}`, 'report', id);
  return json({ ok: true });
}

export async function listSubmissions(request, env, url) {
  const admin = await requireAdmin(request, env);
  const scope = url.searchParams.get('scope') || 'site';
  const partyId = url.searchParams.get('party_id');
  const where = [];
  const args = [];
  if (partyId) {
    where.push('s.party_id = ?');
    args.push(partyId);
    // צפייה בפניות שנשלחו למפלגה פרטית נרשמת ביומן
    await adminLog(env, admin, 'submissions:view', 'party', partyId);
  } else if (scope === 'site') where.push('s.party_id IS NULL');
  const status = url.searchParams.get('status');
  if (['new', 'read', 'archived', 'spam'].includes(status)) { where.push('s.status = ?'); args.push(status); }
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.party_id, s.kind, s.name, s.contact, s.body, s.status, s.created_at, p.name AS party_name
     FROM submissions s LEFT JOIN parties p ON p.id = s.party_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.created_at DESC LIMIT 300`,
  ).bind(...args).all();
  return json({ items: results });
}

export async function patchSubmission(request, env, id) {
  const admin = await requireAdmin(request, env);
  const body = await readJson(request);
  if (!['new', 'read', 'archived', 'spam'].includes(body.status)) throw new HttpError(422, 'invalid', 'סטטוס לא תקין');
  const r = await env.DB.prepare('UPDATE submissions SET status = ? WHERE id = ?').bind(body.status, id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'הפנייה לא נמצאה');
  if (body.status === 'spam') await adminLog(env, admin, 'submission:spam', 'submission', id);
  return json({ ok: true });
}

export async function deleteSubmission(request, env, id) {
  const admin = await requireAdmin(request, env);
  const r = await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'הפנייה לא נמצאה');
  await adminLog(env, admin, 'submission:delete', 'submission', id);
  return json({ ok: true });
}

export async function listCategories(request, env) {
  await requireAdmin(request, env);
  return json({ items: await categoriesList(env, { all: true }) });
}

export async function saveCategory(request, env) {
  const admin = await requireAdmin(request, env);
  const body = await readJson(request);
  const id = String(body.id || '');
  const label = cleanText(body.label);
  const emoji = cleanText(body.emoji).slice(0, 8);
  if (!/^[a-z_]{2,20}$/.test(id)) throw new HttpError(422, 'invalid', 'מזהה: 2–20 אותיות באנגלית קטנות או קו תחתון');
  if (label.length < 2 || label.length > 40) throw new HttpError(422, 'invalid', 'שם הקטגוריה: 2–40 תווים');
  const position = Math.max(0, Math.min(999, Number(body.position) || 0));
  const active = body.active === false || body.active === 0 ? 0 : 1;
  await env.DB.prepare(
    `INSERT INTO categories (id, label, emoji, position, active) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, emoji = excluded.emoji, position = excluded.position, active = excluded.active`,
  ).bind(id, label, emoji, position, active).run();
  await adminLog(env, admin, 'category:save', 'category', id, { label, active });
  return json({ ok: true });
}

export async function listSnippets(request, env) {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare('SELECT * FROM snippets ORDER BY created_at DESC LIMIT 500').all();
  return json({ items: results });
}

const SNIPPET_KINDS = ['slogan', 'promise', 'speech', 'bio', 'announcement', 'social'];

export async function addSnippet(request, env) {
  const admin = await requireAdmin(request, env);
  const body = await readJson(request);
  const kind = String(body.kind || '');
  const text = cleanText(body.text, { multiline: true });
  if (!SNIPPET_KINDS.includes(kind)) throw new HttpError(422, 'invalid', 'סוג לא תקין');
  if (text.length < 3 || text.length > 2000) throw new HttpError(422, 'invalid', 'הטקסט: 3–2000 תווים');
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO snippets (id, kind, text, active, created_at) VALUES (?, ?, ?, 1, ?)').bind(id, kind, text, now()).run();
  await adminLog(env, admin, 'snippet:add', 'snippet', id, { kind });
  return json({ id }, 201);
}

export async function patchSnippet(request, env, id) {
  const admin = await requireAdmin(request, env);
  const body = await readJson(request);
  await env.DB.prepare('UPDATE snippets SET active = ? WHERE id = ?').bind(body.active ? 1 : 0, id).run();
  await adminLog(env, admin, 'snippet:toggle', 'snippet', id, { active: !!body.active });
  return json({ ok: true });
}

export async function deleteSnippet(request, env, id) {
  const admin = await requireAdmin(request, env);
  await env.DB.prepare('DELETE FROM snippets WHERE id = ?').bind(id).run();
  await adminLog(env, admin, 'snippet:delete', 'snippet', id);
  return json({ ok: true });
}

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const out = { disabled_templates: [], announcement: '' };
  for (const r of results) {
    try { out[r.key] = JSON.parse(r.value); } catch { /* ignore */ }
  }
  return out;
}

export async function adminGetSettings(request, env) {
  await requireAdmin(request, env);
  return json(await getSettings(env));
}

export async function adminPutSettings(request, env) {
  const admin = await requireAdmin(request, env);
  const body = await readJson(request);
  const stmts = [];
  if (Array.isArray(body.disabled_templates)) {
    const list = body.disabled_templates.filter((x) => /^[a-z-]{2,30}$/.test(x)).slice(0, 30);
    stmts.push(env.DB.prepare("INSERT INTO settings (key, value) VALUES ('disabled_templates', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(list)));
  }
  if ('announcement' in body) {
    const text = cleanText(body.announcement).slice(0, 200);
    stmts.push(env.DB.prepare("INSERT INTO settings (key, value) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(text)));
  }
  if (!stmts.length) throw new HttpError(422, 'invalid', 'אין מה לעדכן');
  await env.DB.batch(stmts);
  await adminLog(env, admin, 'settings:update', 'settings', '', body);
  return json({ ok: true });
}

export async function auditLog(request, env) {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare('SELECT * FROM admin_log ORDER BY created_at DESC LIMIT 300').all();
  return json({ items: results });
}
