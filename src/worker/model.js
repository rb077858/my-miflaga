// גישה לנתוני מפלגות והמרה לתצוגה (בעלים / ציבור / מנהל).
import { parseJsonColumn, now } from './util.js';
import { normalizeEmblem } from '../shared/emblem.js';

export async function categoryIds(env) {
  const { results } = await env.DB.prepare('SELECT id FROM categories WHERE active = 1').all();
  return results.map((r) => r.id);
}

export async function categoriesList(env, { all = false } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT id, label, emoji, position, active FROM categories ${all ? '' : 'WHERE active = 1'} ORDER BY position, label`,
  ).all();
  return results;
}

export function decodeParty(row) {
  if (!row) return null;
  return {
    ...row,
    emblem: normalizeEmblem(parseJsonColumn(row.emblem, {})),
    platform: parseJsonColumn(row.platform, []),
    leaders: parseJsonColumn(row.leaders, []),
    campaign: parseJsonColumn(row.campaign, {}),
  };
}

const PUBLIC_FIELDS = [
  'id', 'slug', 'name', 'acronym', 'slogan', 'short_desc', 'story', 'founded_on', 'color_primary', 'color_secondary',
  'category', 'seriousness', 'emblem', 'platform', 'leaders', 'campaign', 'allow_share', 'allow_supporters',
  'allow_submissions', 'show_supporter_count', 'show_supporter_names', 'og_image_id', 'updated_at', 'published_at', 'featured',
];

export function toPublic(party) {
  const out = {};
  for (const k of PUBLIC_FIELDS) out[k] = party[k];
  out.supporters_count = party.show_supporter_count ? party.supporters_count : null;
  out.contact_text = party.show_contact ? party.contact_text : '';
  return out;
}

export function toCard(row) {
  const p = decodeParty(row);
  return {
    slug: p.slug, name: p.name, acronym: p.acronym, slogan: p.slogan, short_desc: p.short_desc,
    color_primary: p.color_primary, color_secondary: p.color_secondary, category: p.category, emblem: p.emblem,
    supporters_count: p.show_supporter_count ? p.supporters_count : null, published_at: p.published_at, featured: p.featured,
  };
}

export function toOwner(party) {
  const { owner_id, name_key, ...rest } = party;
  return rest;
}

export async function partyByOwner(env, ownerId) {
  return decodeParty(await env.DB.prepare('SELECT * FROM parties WHERE owner_id = ?').bind(ownerId).first());
}

export async function partyBySlug(env, slug) {
  return decodeParty(await env.DB.prepare('SELECT * FROM parties WHERE slug = ?').bind(slug).first());
}

export async function partyById(env, id) {
  return decodeParty(await env.DB.prepare('SELECT * FROM parties WHERE id = ?').bind(id).first());
}

/** האם המפלגה גלויה לציבור (קריאה בלבד, גם ללא התחברות). */
export function isPubliclyVisible(party) {
  return !!party && party.status === 'published' && party.visibility === 'public' && party.mod_status !== 'blocked';
}

export function isListed(party) {
  return isPubliclyVisible(party) && party.mod_status === 'ok' && party.show_on_home && !party.home_hidden;
}

export const LISTED_SQL = "status = 'published' AND visibility = 'public' AND mod_status = 'ok' AND show_on_home = 1 AND home_hidden = 0";

export async function logActivity(env, partyId, action) {
  await env.DB.prepare('INSERT INTO party_activity (party_id, action, created_at) VALUES (?, ?, ?)').bind(partyId, action, now()).run();
}

export async function adminLog(env, admin, action, targetType, targetId, details) {
  await env.DB.prepare(
    'INSERT INTO admin_log (admin_email, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(admin.email, action, targetType || '', targetId || '', details ? JSON.stringify(details).slice(0, 2000) : '', now()).run();
}

export async function logError(env, route, err) {
  try {
    const message = String(err?.message || err).replace(/Bearer\s+\S+/gi, 'Bearer [hidden]').slice(0, 500);
    await env.DB.prepare('INSERT INTO error_log (route, message, created_at) VALUES (?, ?, ?)').bind(String(route).slice(0, 200), message, now()).run();
  } catch {
    // אם גם הרישום נכשל, אין מה לעשות מעבר לזה.
  }
}

/** מחיקה מלאה של מפלגה וכל המידע הקשור. הנתיב נשמר לבעלים המקורי בלבד. */
export async function deletePartyCascade(env, party) {
  const t = now();
  const pollIds = (await env.DB.prepare('SELECT id FROM polls WHERE party_id = ?').bind(party.id).all()).results.map((r) => r.id);
  const stmts = [
    env.DB.prepare('DELETE FROM images WHERE party_id = ?').bind(party.id),
    env.DB.prepare('DELETE FROM supporters WHERE party_id = ?').bind(party.id),
    env.DB.prepare('DELETE FROM submissions WHERE party_id = ?').bind(party.id),
    env.DB.prepare('DELETE FROM reports WHERE party_id = ?').bind(party.id),
    env.DB.prepare('DELETE FROM party_views WHERE party_id = ?').bind(party.id),
    env.DB.prepare('DELETE FROM party_activity WHERE party_id = ?').bind(party.id),
    env.DB.prepare("UPDATE slug_history SET party_id = NULL, reason = 'deleted' WHERE party_id = ?").bind(party.id),
    env.DB.prepare(
      `INSERT INTO slug_history (slug, party_id, owner_id, reason, created_at) VALUES (?, NULL, ?, 'deleted', ?)
       ON CONFLICT(slug) DO UPDATE SET party_id = NULL, reason = 'deleted', created_at = excluded.created_at`,
    ).bind(party.slug, party.owner_id, t),
  ];
  for (const id of pollIds) {
    stmts.push(env.DB.prepare('DELETE FROM votes WHERE poll_id = ?').bind(id));
    stmts.push(env.DB.prepare('DELETE FROM poll_options WHERE poll_id = ?').bind(id));
  }
  stmts.push(env.DB.prepare('DELETE FROM polls WHERE party_id = ?').bind(party.id));
  stmts.push(env.DB.prepare('DELETE FROM parties WHERE id = ?').bind(party.id));
  await env.DB.batch(stmts);
}

/** בודק אם נתיב פנוי עבור בעלים מסוים. */
export async function slugAvailable(env, slug, ownerId, partyId) {
  const taken = await env.DB.prepare('SELECT id FROM parties WHERE slug = ?').bind(slug).first();
  if (taken && taken.id !== partyId) return false;
  const hist = await env.DB.prepare('SELECT owner_id FROM slug_history WHERE slug = ?').bind(slug).first();
  if (hist && hist.owner_id !== ownerId) return false;
  return true;
}

export async function nameAvailable(env, key, partyId) {
  const taken = await env.DB.prepare('SELECT id FROM parties WHERE name_key = ?').bind(key).first();
  return !taken || taken.id === partyId;
}
