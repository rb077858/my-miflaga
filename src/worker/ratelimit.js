// הגבלת קצב בחלון קבוע, שמורה ב-D1. המפתח הוא גיבוב (IP או מזהה משתמש), לא ערך גלוי.
import { HttpError } from './http.js';
import { ipHash, hmacHex, secretSalt, now } from './util.js';

export async function hit(env, bucket, identity, max, windowSec) {
  const t = now();
  const windowStart = t - (t % (windowSec * 1000));
  const key = `${bucket}:${identity}`;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END,
       window_start = ?2
     RETURNING count`,
  ).bind(key, windowStart).first();
  return (row?.count ?? 1) <= max;
}

export async function limitOrThrow(env, bucket, identity, max, windowSec) {
  if (!(await hit(env, bucket, identity, max, windowSec))) {
    throw new HttpError(429, 'rate_limited', 'יותר מדי בקשות בזמן קצר. קחו נשימה ונסו שוב בעוד כמה דקות');
  }
}

export async function limitByIp(env, request, bucket, max, windowSec) {
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  await limitOrThrow(env, bucket, await ipHash(env, ip), max, windowSec);
}

// אסימון טופס חתום: מוכיח שהטופס נטען לפני לפחות 2 שניות ולא לפני יותר מ-12 שעות.
export async function formToken(env, t = now()) {
  return `${t}.${(await hmacHex(secretSalt(env), `form|${t}`)).slice(0, 32)}`;
}

export async function checkFormToken(env, token) {
  const [ts, sig] = String(token || '').split('.');
  const t = Number(ts);
  if (!t || !sig) return 'missing';
  const expected = (await hmacHex(secretSalt(env), `form|${t}`)).slice(0, 32);
  if (expected !== sig) return 'invalid';
  const age = now() - t;
  if (age < 2000) return 'too_fast';
  if (age > 12 * 3600 * 1000) return 'expired';
  return null;
}

export async function antiSpam(env, body) {
  if (body.website) throw new HttpError(400, 'spam', 'הבקשה נחסמה');
  const problem = await checkFormToken(env, body.form_token);
  if (problem === 'too_fast') throw new HttpError(400, 'too_fast', 'זה היה מהיר מדי, אפילו בשבילנו. נסו שוב בעוד שנייה');
  if (problem === 'expired') throw new HttpError(400, 'form_expired', 'הטופס פג תוקף. רעננו את הדף ונסו שוב');
  if (problem) throw new HttpError(400, 'bad_form', 'הטופס אינו תקין. רעננו את הדף ונסו שוב');
  const key = String(body.client_key || '');
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(key)) throw new HttpError(400, 'bad_form', 'הטופס אינו תקין. רעננו את הדף ונסו שוב');
  return key;
}
