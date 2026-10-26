// עזרים כלליים לשרת.

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newId(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const now = () => Date.now();

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function secretSalt(env) {
  return env.RATE_SALT || 'dev-only-salt-change-me';
}

export async function ipHash(env, ip) {
  return (await sha256Hex(`${secretSalt(env)}|${ip}`)).slice(0, 24);
}

export function today(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function parseJsonColumn(value, fallback) {
  try {
    const v = JSON.parse(value);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function isBot(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless|lighthouse/.test(ua);
}
