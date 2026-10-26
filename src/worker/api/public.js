// API ציבורי: רשימת מפלגות, טפסים, דיווחים והצבעות.
import { HttpError, json, readJson } from '../http.js';
import { getUser, requireUser, touchUser } from '../auth.js';
import { limitByIp, limitOrThrow, antiSpam, formToken } from '../ratelimit.js';
import { newId, now, ipHash } from '../util.js';
import { partyBySlug, isPubliclyVisible, toCard, LISTED_SQL, categoriesList } from '../model.js';
import { pollResults } from './owner.js';
import { validateSupporter, validateSubmission, cleanText } from '../../shared/validate.js';
import { PARTY_SUBMISSION_KINDS, SITE_SUBMISSION_KINDS, REPORT_REASONS } from '../../shared/constants.js';

export async function listParties(env, url) {
  const q = cleanText(url.searchParams.get('q') || '').slice(0, 60);
  const category = url.searchParams.get('category') || '';
  const sort = url.searchParams.get('sort') || 'new';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 48);
  const offset = Math.min(Math.max(Number(url.searchParams.get('offset')) || 0, 0), 5000);
  const where = [LISTED_SQL];
  const args = [];
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR slogan LIKE ? ESCAPE '\\' OR short_desc LIKE ? ESCAPE '\\' OR acronym LIKE ? ESCAPE '\\')");
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like, like);
  }
  if (/^[a-z_]{2,20}$/.test(category)) { where.push('category = ?'); args.push(category); }
  const order = sort === 'popular'
    ? 'supporters_count DESC, views_total DESC, published_at DESC'
    : sort === 'updated' ? 'updated_at DESC' : sort === 'oldest' ? 'published_at ASC' : 'published_at DESC';
  const { results } = await env.DB.prepare(
    `SELECT * FROM parties WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,
  ).bind(...args, limit + 1, offset).all();
  const items = results.slice(0, limit).map(toCard);
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM parties WHERE ${where.join(' AND ')}`).bind(...args).first();
  return { items, total: total.n, has_more: results.length > limit };
}

export async function featuredParties(env, limit = 6) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM parties WHERE ${LISTED_SQL} AND featured = 1 ORDER BY featured_rank ASC, published_at DESC LIMIT ?`,
  ).bind(limit).all();
  return results.map(toCard);
}

export async function apiListParties(env, url) {
  return json(await listParties(env, url), 200, { 'cache-control': 'public, max-age=30' });
}

export async function apiCategories(env) {
  return json({ items: await categoriesList(env) }, 200, { 'cache-control': 'public, max-age=300' });
}

export async function apiSnippets(env) {
  const { results } = await env.DB.prepare('SELECT kind, text FROM snippets WHERE active = 1 ORDER BY created_at DESC LIMIT 500').all();
  return json({ items: results }, 200, { 'cache-control': 'public, max-age=300' });
}

export async function apiFormToken(env) {
  return json({ token: await formToken(env) });
}

async function visiblePartyOr404(env, slug) {
  const party = await partyBySlug(env, slug);
  if (!isPubliclyVisible(party)) throw new HttpError(404, 'not_found', 'המפלגה לא נמצאה');
  return party;
}

function isUnique(err) {
  return String(err?.message || err).includes('UNIQUE');
}

export async function support(request, env, slug) {
  await limitByIp(env, request, 'support', 10, 3600);
  const party = await visiblePartyOr404(env, slug);
  if (!party.allow_supporters) throw new HttpError(403, 'disabled', 'המפלגה לא מקבלת תומכים כרגע');
  const body = await readJson(request);
  const clientKey = await antiSpam(env, body);
  const { data, errors } = validateSupporter(body);
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });
  const ip = await ipHash(env, request.headers.get('cf-connecting-ip') || '0.0.0.0');
  // אותו מכשיר/רשת לא יכול להצטרף לאותה מפלגה יותר מ-3 פעמים ביום
  await limitOrThrow(env, `support-party:${party.id}`, ip, 3, 86400);
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO supporters (id, party_id, display_name, message, public_ok, client_key, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(newId(), party.id, data.display_name, data.message, data.public_ok, clientKey, ip, now()),
      env.DB.prepare('UPDATE parties SET supporters_count = supporters_count + 1 WHERE id = ?').bind(party.id),
    ]);
  } catch (err) {
    if (isUnique(err)) return json({ ok: true, duplicate: true });
    throw err;
  }
  return json({ ok: true }, 201);
}

export async function publicSupporters(env, slug) {
  const party = await visiblePartyOr404(env, slug);
  if (!party.show_supporter_names) return json({ items: [], count: party.show_supporter_count ? party.supporters_count : null });
  const { results } = await env.DB.prepare(
    'SELECT display_name, message, created_at FROM supporters WHERE party_id = ? AND public_ok = 1 ORDER BY created_at DESC LIMIT 60',
  ).bind(party.id).all();
  return json({ items: results, count: party.show_supporter_count ? party.supporters_count : null });
}

async function insertSubmission(env, request, partyId, data, clientKey) {
  const ip = await ipHash(env, request.headers.get('cf-connecting-ip') || '0.0.0.0');
  try {
    await env.DB.prepare('INSERT INTO submissions (id, party_id, kind, name, contact, body, client_key, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(newId(), partyId, data.kind, data.name, data.contact, data.body, clientKey, ip, now()).run();
  } catch (err) {
    if (isUnique(err)) return json({ ok: true, duplicate: true });
    throw err;
  }
  return json({ ok: true }, 201);
}

export async function submitToParty(request, env, slug) {
  await limitByIp(env, request, 'submit', 8, 3600);
  const party = await visiblePartyOr404(env, slug);
  if (!party.allow_submissions) throw new HttpError(403, 'disabled', 'המפלגה לא מקבלת פניות כרגע');
  const body = await readJson(request);
  const clientKey = await antiSpam(env, body);
  const { data, errors } = validateSubmission(body, PARTY_SUBMISSION_KINDS);
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });
  return insertSubmission(env, request, party.id, data, clientKey);
}

export async function submitToSite(request, env) {
  await limitByIp(env, request, 'site-submit', 6, 3600);
  const body = await readJson(request);
  const clientKey = await antiSpam(env, body);
  const { data, errors } = validateSubmission(body, SITE_SUBMISSION_KINDS);
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });
  return insertSubmission(env, request, null, data, clientKey);
}

export async function report(request, env, slug) {
  await limitByIp(env, request, 'report', 5, 3600);
  const party = await partyBySlug(env, slug);
  if (!party || party.status !== 'published') throw new HttpError(404, 'not_found', 'המפלגה לא נמצאה');
  const body = await readJson(request);
  const clientKey = await antiSpam(env, body);
  const reason = String(body.reason || '');
  const details = cleanText(body.details, { multiline: true });
  const errors = {};
  if (!REPORT_REASONS[reason]) errors.reason = 'יש לבחור סיבה';
  if (details.length > 1000) errors.details = 'הפירוט עד 1000 תווים';
  if (Object.keys(errors).length) throw new HttpError(422, 'invalid', 'יש שדות שצריך לתקן', { fields: errors });
  const ip = await ipHash(env, request.headers.get('cf-connecting-ip') || '0.0.0.0');
  try {
    await env.DB.prepare('INSERT INTO reports (id, party_id, reason, details, client_key, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId(), party.id, reason, details, clientKey, ip, now()).run();
  } catch (err) {
    if (isUnique(err)) return json({ ok: true, duplicate: true });
    throw err;
  }
  return json({ ok: true }, 201);
}

// ---------- הצבעות ----------

function pollIsOpen(p) {
  return p.status === 'open' && (!p.ends_at || p.ends_at > now());
}

export async function publicPolls(request, env, slug) {
  const party = await visiblePartyOr404(env, slug);
  let user = null;
  try { user = await getUser(request, env); } catch { user = null; }
  const { results } = await env.DB.prepare('SELECT * FROM polls WHERE party_id = ? ORDER BY status = \'open\' DESC, created_at DESC LIMIT 20').bind(party.id).all();
  const items = [];
  for (const p of results) {
    const open = pollIsOpen(p);
    let myVote = null;
    if (user) myVote = (await env.DB.prepare('SELECT option_id FROM votes WHERE poll_id = ? AND voter_id = ?').bind(p.id, user.id).first())?.option_id || null;
    const options = await pollResults(env, p.id);
    const showResults = !open || p.results === 'always' || (p.results === 'after_vote' && myVote);
    items.push({
      id: p.id, question: p.question, kind: p.kind, open, ends_at: p.ends_at, results_policy: p.results,
      my_vote: myVote,
      total: showResults ? options.reduce((s, o) => s + o.votes, 0) : null,
      options: options.map((o) => ({ id: o.id, label: o.label, votes: showResults ? o.votes : null })),
    });
  }
  return json({ items, signed_in: !!user });
}

export async function vote(request, env, pollId) {
  const user = await requireUser(request, env);
  await touchUser(env, user);
  await limitOrThrow(env, 'vote', user.id, 60, 3600);
  const body = await readJson(request);
  const poll = await env.DB.prepare('SELECT p.*, pa.status AS party_status, pa.visibility, pa.mod_status FROM polls p JOIN parties pa ON pa.id = p.party_id WHERE p.id = ?').bind(pollId).first();
  if (!poll || !isPubliclyVisible({ status: poll.party_status, visibility: poll.visibility, mod_status: poll.mod_status })) {
    throw new HttpError(404, 'not_found', 'ההצבעה לא נמצאה');
  }
  if (!pollIsOpen(poll)) throw new HttpError(409, 'closed', 'ההצבעה כבר נסגרה. הקלפי מקופלת');
  const option = await env.DB.prepare('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?').bind(String(body.option_id || ''), pollId).first();
  if (!option) throw new HttpError(422, 'invalid', 'יש לבחור אפשרות');
  try {
    await env.DB.prepare('INSERT INTO votes (poll_id, voter_id, option_id, created_at) VALUES (?, ?, ?, ?)').bind(pollId, user.id, option.id, now()).run();
  } catch (err) {
    if (isUnique(err)) throw new HttpError(409, 'already_voted', 'כבר הצבעת בהצבעה הזאת. קול אחד לכל אחד, גם בדמוקרטיה הומוריסטית');
    throw err;
  }
  return json({ ok: true }, 201);
}
