// קריאות לשרת שלנו. הטוקן נשלח בכותרת Authorization; השרת בודק אותו מול Reem.bi.
import { token } from './auth.js';
import { MESSAGES } from '../../shared/humor.js';

export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = data?.fields || null;
    this.data = data || {};
  }
}

export async function api(path, { method = 'GET', body, raw, contentType, signal } = {}) {
  const headers = {};
  const t = token();
  if (t) headers.authorization = `Bearer ${t}`;
  let payload;
  if (raw) {
    payload = raw;
    headers['content-type'] = contentType || 'application/octet-stream';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(path, { method, headers, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(navigator.onLine === false ? MESSAGES.offline : 'לא הצלחנו להתחבר לשרת. בדקו את החיבור ונסו שוב', 0, 'network');
  }
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const msg = res.status === 429 ? MESSAGES.rate : data.message || MESSAGES.error;
    throw new ApiError(msg, res.status, data.error, data);
  }
  return data;
}
