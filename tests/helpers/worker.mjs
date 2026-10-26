// הרצת ה-Worker בתוך Node עם D1 מדומה ו-Reem.bi מדומה.
import worker from '../../src/worker/index.js';
import { createD1 } from './d1.mjs';
import { formToken } from '../../src/worker/ratelimit.js';
import { _clearAuthCache } from '../../src/worker/auth.js';

export const TOKENS = {
  alice: 'tok-alice-0000000000',
  bob: 'tok-bob-00000000000',
  admin: 'tok-admin-000000000',
  carol: 'tok-carol-000000000',
};
const USERS = {
  [TOKENS.alice]: { id: 'u-alice', email: 'alice@example.com', name: 'אליס' },
  [TOKENS.bob]: { id: 'u-bob', email: 'bob@example.com', name: 'בוב' },
  [TOKENS.admin]: { id: 'u-admin', email: 'rb077858@gmail.com', name: 'מנהל' },
  [TOKENS.carol]: { id: 'u-carol', email: 'carol@example.com', name: 'קרול' },
};

export const sso = { down: false, calls: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://login.reembir.com/api/userinfo')) {
    sso.calls++;
    if (sso.down) throw new TypeError('network down');
    const auth = (init.headers?.authorization || init.headers?.Authorization || '').replace(/^Bearer\s+/, '');
    const user = USERS[auth];
    if (!user) return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 });
    return new Response(JSON.stringify({ user, access: { plan: null, features: {} } }), { status: 200 });
  }
  return realFetch(input, init);
};

export function makeEnv(extra = {}) {
  _clearAuthCache();
  return { DB: createD1(), ADMIN_EMAILS: 'rb077858@gmail.com', RATE_SALT: 'test-salt-0123456789abcdef', PUBLIC_ORIGIN: 'https://miflaga.test', ...extra };
}

export function client(env) {
  const waits = [];
  const ctx = { waitUntil: (p) => waits.push(p) };
  let ip = 1;
  async function call(method, path, { token, body, raw, headers = {}, ipAddr } = {}) {
    const h = { 'cf-connecting-ip': ipAddr || `10.0.0.${ip}`, ...headers };
    if (token) h.authorization = `Bearer ${TOKENS[token] || token}`;
    let payload;
    if (raw) { payload = raw; h['content-type'] = h['content-type'] || 'application/octet-stream'; }
    else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
    const res = await worker.fetch(new Request(`https://miflaga.test${path}`, { method, headers: h, body: payload }), env, ctx);
    await Promise.all(waits.splice(0));
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  return {
    get: (p, o) => call('GET', p, o),
    post: (p, o) => call('POST', p, o),
    patch: (p, o) => call('PATCH', p, o),
    put: (p, o) => call('PUT', p, o),
    del: (p, o) => call('DELETE', p, o),
    nextIp() { ip++; },
    call,
  };
}

export async function oldFormToken(env) {
  return formToken(env, Date.now() - 5000);
}

export const BASIC_PARTY = {
  name: 'מפלגת הקפה השני', acronym: 'קפ"ה', slogan: 'קודם קפה, אחר כך מדיניות', short_desc: 'מפלגה לכל מי שצריך עוד כוס.', category: 'daily', seriousness: 2,
};
