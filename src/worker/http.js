// עזרי HTTP: תשובות JSON, שגיאות, קריאת גוף בקשה וכותרות אבטחה.

export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(err) {
  const body = { error: err.code || 'error', message: err.message };
  if (err.extra) Object.assign(body, err.extra);
  return json(body, err.status || 500);
}

export async function readJson(request, maxBytes = 64 * 1024) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'bad_content_type', 'הבקשה צריכה להיות JSON');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new HttpError(413, 'too_large', 'הבקשה גדולה מדי');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'הבקשה גדולה מדי');
  try {
    const data = JSON.parse(text || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not object');
    return data;
  } catch {
    throw new HttpError(400, 'bad_json', 'הבקשה אינה תקינה');
  }
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...headers },
  });
}

const SSO = 'https://login.reembir.com';

export function withSecurityHeaders(response, { frameAncestors = "'none'", ssoOrigin = SSO } = {}) {
  const res = new Response(response.body, response);
  const h = res.headers;
  const type = h.get('content-type') || '';
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  if (type.includes('text/html')) {
    const sso = ssoOrigin === SSO ? SSO : `${SSO} ${ssoOrigin}`;
    h.set('content-security-policy', [
      "default-src 'self'",
      `script-src 'self' ${sso}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${sso}`,
      `frame-src ${sso}`,
      "object-src 'none'",
      "base-uri 'self'",
      `form-action 'self' ${sso}`,
      `frame-ancestors ${frameAncestors}`,
    ].join('; '));
    if (frameAncestors === "'none'") h.set('x-frame-options', 'DENY');
  }
  return res;
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0';
}
