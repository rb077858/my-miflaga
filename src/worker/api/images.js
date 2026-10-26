// העלאה והגשה של תמונות. מאושרים רק PNG, JPEG ו-WebP, לפי חתימת הקובץ (לא לפי מה שהדפדפן טוען).
// SVG ו-HTML לא מתקבלים כדי למנוע הרצת קוד. ההגשה עם nosniff ו-CSP סגור.
import { HttpError, json } from '../http.js';
import { requireUser } from '../auth.js';
import { limitOrThrow } from '../ratelimit.js';
import { newId, now } from '../util.js';
import { partyByOwner, logActivity } from '../model.js';
import { LIMITS } from '../../shared/constants.js';
import { cleanText } from '../../shared/validate.js';

export function sniffImage(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

const KINDS = ['emblem', 'leader', 'gallery', 'og'];

export async function uploadImage(request, env, url) {
  const user = await requireUser(request, env);
  await limitOrThrow(env, 'upload', user.id, 60, 3600);
  const party = await partyByOwner(env, user.id);
  if (!party) throw new HttpError(404, 'no_party', 'צריך להקים מפלגה לפני העלאת תמונות');
  const kind = url.searchParams.get('kind');
  if (!KINDS.includes(kind)) throw new HttpError(422, 'invalid', 'סוג תמונה לא תקין');
  const title = cleanText(url.searchParams.get('title') || '').slice(0, 80);

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > LIMITS.imageBytes) throw new HttpError(413, 'too_large', 'הקובץ גדול מדי (עד 700KB אחרי הכיווץ)');
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.length === 0) throw new HttpError(422, 'invalid', 'הקובץ ריק');
  if (buf.length > LIMITS.imageBytes) throw new HttpError(413, 'too_large', 'הקובץ גדול מדי (עד 700KB אחרי הכיווץ)');
  const mime = sniffImage(buf);
  if (!mime) throw new HttpError(415, 'bad_type', 'אפשר להעלות רק תמונות PNG, JPEG או WebP');

  if (kind === 'gallery' || kind === 'leader') {
    const max = kind === 'gallery' ? LIMITS.galleryImages : LIMITS.leaderImages + 5;
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM images WHERE party_id = ? AND kind = ?').bind(party.id, kind).first();
    if (c.n >= max) throw new HttpError(409, 'too_many', kind === 'gallery' ? `בגלריה יש מקום ל-${max} תמונות. מחקו אחת קודם` : 'יותר מדי תמונות הנהלה');
  }

  const id = newId(20);
  const stmts = [];
  // לסמל ולתמונת השיתוף יש תמונה אחת בלבד; הקודמת נמחקת (תמונת סמל ישנה נשמרת עד שהסמל החדש נשמר).
  if (kind === 'og') stmts.push(env.DB.prepare("DELETE FROM images WHERE party_id = ? AND kind = 'og'").bind(party.id));
  if (kind === 'emblem') {
    const keep = party.emblem?.image || '';
    stmts.push(env.DB.prepare("DELETE FROM images WHERE party_id = ? AND kind = 'emblem' AND id != ?").bind(party.id, keep));
  }
  stmts.push(env.DB.prepare('INSERT INTO images (id, party_id, owner_id, kind, mime, size, title, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, party.id, user.id, kind, mime, buf.length, title, buf, now()));
  if (kind === 'og') stmts.push(env.DB.prepare('UPDATE parties SET og_image_id = ? WHERE id = ?').bind(id, party.id));
  await env.DB.batch(stmts);
  if (kind === 'gallery') await logActivity(env, party.id, 'תמונה נוספה לגלריה');
  return json({ id, url: `/img/${id}` }, 201);
}

export async function listGallery(request, env) {
  const user = await requireUser(request, env);
  const party = await partyByOwner(env, user.id);
  if (!party) return json({ items: [] });
  const { results } = await env.DB.prepare("SELECT id, title, size, created_at FROM images WHERE party_id = ? AND kind = 'gallery' ORDER BY created_at DESC").bind(party.id).all();
  return json({ items: results });
}

export async function deleteImage(request, env, id) {
  const user = await requireUser(request, env);
  const r = await env.DB.prepare("DELETE FROM images WHERE id = ? AND owner_id = ? AND kind IN ('gallery', 'emblem', 'leader')").bind(id, user.id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found', 'התמונה לא נמצאה');
  return json({ ok: true });
}

export async function serveImage(env, id) {
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id)) return new Response('Not found', { status: 404 });
  const row = await env.DB.prepare('SELECT mime, bytes FROM images WHERE id = ?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  const bytes = row.bytes instanceof ArrayBuffer ? new Uint8Array(row.bytes) : new Uint8Array(row.bytes);
  return new Response(bytes, {
    headers: {
      'content-type': row.mime,
      'cache-control': 'public, max-age=31536000, immutable',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'cross-origin',
    },
  });
}
