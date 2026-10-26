// אימות מול Reem.bi. השרת לא סומך על הדפדפן: כל טוקן נבדק מול /api/userinfo.
import { HttpError } from './http.js';
import { sha256Hex, now } from './util.js';

const CACHE_MS = 60 * 1000;
const cache = new Map(); // מטמון קצר בזיכרון של ה-isolate, לפי גיבוב הטוקן (לא הטוקן עצמו)

export function ssoOrigin(env) {
  // רק בסביבת פיתוח/בדיקות אפשר להפנות לשרת התחברות מדומה.
  if (env.DEV_MODE === '1' && env.SSO_ORIGIN) return env.SSO_ORIGIN.replace(/\/+$/, '');
  return 'https://login.reembir.com';
}

export function adminEmails(env) {
  return String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(env, user) {
  return !!user?.email && adminEmails(env).includes(String(user.email).toLowerCase());
}

function bearer(request) {
  const h = request.headers.get('authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{10,4096})$/.exec(h.trim());
  return m ? m[1] : null;
}

/** מחזיר { id, email, name, avatar } או null. זורק 503 אם שירות ההתחברות לא זמין. */
export async function getUser(request, env) {
  const token = bearer(request);
  if (!token) return null;
  const key = await sha256Hex(token);
  const hit = cache.get(key);
  if (hit && hit.expires > now()) return hit.user;

  let res;
  try {
    res = await fetch(`${ssoOrigin(env)}/api/userinfo`, { headers: { authorization: `Bearer ${token}` } });
  } catch {
    throw new HttpError(503, 'sso_unavailable', 'שירות ההתחברות אינו זמין כרגע. נסו שוב בעוד כמה דקות');
  }
  if (res.status === 401 || res.status === 403) {
    cache.delete(key);
    return null;
  }
  if (!res.ok) throw new HttpError(503, 'sso_unavailable', 'שירות ההתחברות אינו זמין כרגע. נסו שוב בעוד כמה דקות');
  let data;
  try {
    data = await res.json();
  } catch {
    throw new HttpError(503, 'sso_unavailable', 'תשובה לא תקינה משירות ההתחברות');
  }
  const u = data?.user;
  if (!u?.id || !u?.email) return null;
  const user = {
    id: String(u.id).slice(0, 128),
    email: String(u.email).toLowerCase().slice(0, 254),
    name: String(u.name || '').slice(0, 100),
    avatar: typeof u.avatar === 'string' && /^https:\/\//.test(u.avatar) ? u.avatar.slice(0, 500) : null,
  };
  if (cache.size > 1000) cache.clear();
  cache.set(key, { user, expires: now() + CACHE_MS });
  return user;
}

export async function requireUser(request, env) {
  const user = await getUser(request, env);
  if (!user) throw new HttpError(401, 'unauthorized', 'צריך להתחבר כדי להמשיך');
  return user;
}

export async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(env, user)) throw new HttpError(403, 'forbidden', 'אין הרשאת מנהל');
  return user;
}

export async function touchUser(env, user) {
  const t = now();
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(id) DO UPDATE SET email = ?2, name = ?3, avatar = ?4, last_seen_at = ?5`,
  ).bind(user.id, user.email, user.name, user.avatar, t).run();
}

export function _clearAuthCache() {
  cache.clear();
}
