// נקודת הכניסה של ה-Worker: ניתוב, כותרות אבטחה, CORS לניהול, ומשימה מתוזמנת.
import { HttpError, json, html, errorResponse, withSecurityHeaders } from './http.js';
import { ssoOrigin } from './auth.js';
import { formToken } from './ratelimit.js';
import { isBot, today, now } from './util.js';
import {
  partyBySlug, partyById, isPubliclyVisible, toPublic, categoriesList, logError,
} from './model.js';
import * as owner from './api/owner.js';
import * as pub from './api/public.js';
import * as admin from './api/admin.js';
import * as images from './api/images.js';
import { renderHome } from './render/home.js';
import { renderParty, renderPartyUnavailable } from './render/party.js';
import {
  renderPrivacy, renderTerms, renderAccessibility, renderContact, renderAppShell, renderCallback, renderNotFound, renderError,
} from './render/pages.js';

const ADMIN_ORIGIN = 'https://login.reembir.com';

function adminCors(response) {
  const res = new Response(response.body, response);
  res.headers.set('access-control-allow-origin', ADMIN_ORIGIN);
  res.headers.set('access-control-allow-headers', 'Authorization, Content-Type');
  res.headers.set('access-control-allow-methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.headers.set('access-control-max-age', '600');
  res.headers.set('vary', 'Origin');
  return res;
}

function originOf(request, env) {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

async function announcement(env) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'announcement'").first();
    return row ? JSON.parse(row.value) : '';
  } catch {
    return '';
  }
}

async function countView(env, request, party) {
  if (isBot(request)) return;
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO party_views (party_id, day, views) VALUES (?, ?, 1) ON CONFLICT(party_id, day) DO UPDATE SET views = views + 1').bind(party.id, today()),
      env.DB.prepare('UPDATE parties SET views_total = views_total + 1 WHERE id = ?').bind(party.id),
    ]);
  } catch (err) {
    await logError(env, 'countView', err);
  }
}

async function partyPage(request, env, ctx, slug) {
  const origin = originOf(request, env);
  const ann = await announcement(env);
  let party = await partyBySlug(env, slug);
  if (!party) {
    const hist = await env.DB.prepare('SELECT party_id FROM slug_history WHERE slug = ? AND party_id IS NOT NULL').bind(slug).first();
    if (hist) {
      const moved = await partyById(env, hist.party_id);
      if (moved) return Response.redirect(`${origin}/party/${encodeURIComponent(moved.slug)}/`, 301);
    }
    return html(renderPartyUnavailable({ origin, reason: 'missing' }), 404);
  }
  if (party.mod_status === 'blocked' && party.status === 'published') return html(renderPartyUnavailable({ origin, reason: 'blocked' }), 410);
  if (!isPubliclyVisible(party)) return html(renderPartyUnavailable({ origin, reason: 'missing' }), 404);
  const [categories, gallery, token] = await Promise.all([
    categoriesList(env),
    env.DB.prepare("SELECT id, title FROM images WHERE party_id = ? AND kind = 'gallery' ORDER BY created_at DESC LIMIT 12").bind(party.id).all().then((r) => r.results),
    formToken(env),
  ]);
  ctx.waitUntil(countView(env, request, party));
  const pubParty = toPublic(party);
  const res = html(renderParty({ origin, party: pubParty, categories, formToken: token, gallery, announcement: ann }));
  // מפלגה מוסתרת: נגישה בקישור, אבל לא מאונדקסת במנועי חיפוש
  if (party.mod_status === 'hidden') res.headers.set('x-robots-tag', 'noindex');
  return res;
}

async function homePage(request, env, url) {
  const origin = originOf(request, env);
  const [list, featured, categories, ann] = await Promise.all([
    pub.listParties(env, url),
    pub.featuredParties(env),
    categoriesList(env),
    announcement(env),
  ]);
  const query = { q: url.searchParams.get('q') || '', category: url.searchParams.get('category') || '', sort: url.searchParams.get('sort') || 'new' };
  return html(renderHome({ origin, list, featured, categories, query, announcement: ann }));
}

async function sitemap(request, env) {
  const origin = originOf(request, env);
  const { results } = await env.DB.prepare(
    "SELECT slug, updated_at FROM parties WHERE status = 'published' AND visibility = 'public' AND mod_status = 'ok' ORDER BY updated_at DESC LIMIT 5000",
  ).all();
  const urls = [
    `<url><loc>${origin}/</loc><changefreq>daily</changefreq></url>`,
    ...['privacy', 'terms', 'accessibility', 'contact'].map((p) => `<url><loc>${origin}/${p}/</loc></url>`),
    ...results.map((r) => `<url><loc>${origin}/party/${encodeURIComponent(r.slug)}/</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0, 10)}</lastmod></url>`),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

function robots(request, env) {
  const origin = originOf(request, env);
  return new Response(`User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /admin/\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
  });
}

function match(path, pattern) {
  const p = pattern.split('/');
  const a = path.split('/');
  if (p.length !== a.length) return null;
  const params = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i] === ':') {
      if (!a[i]) return null;
      try { params.push(decodeURIComponent(a[i])); } catch { return null; }
    } else if (p[i] !== a[i]) return null;
  }
  return params;
}

async function api(request, env, url) {
  const m = request.method;
  const path = url.pathname;
  let r;
  // ציבורי
  if (path === '/api/health' && m === 'GET') return json({ ok: true, time: now() });
  if (path === '/api/parties' && m === 'GET') return pub.apiListParties(env, url);
  if (path === '/api/categories' && m === 'GET') return pub.apiCategories(env);
  if (path === '/api/snippets' && m === 'GET') return pub.apiSnippets(env);
  if (path === '/api/form-token' && m === 'GET') return pub.apiFormToken(env);
  if (path === '/api/site/submit' && m === 'POST') return pub.submitToSite(request, env);
  if ((r = match(path, '/api/p/:/support')) && m === 'POST') return pub.support(request, env, r[0]);
  if ((r = match(path, '/api/p/:/supporters')) && m === 'GET') return pub.publicSupporters(env, r[0]);
  if ((r = match(path, '/api/p/:/submit')) && m === 'POST') return pub.submitToParty(request, env, r[0]);
  if ((r = match(path, '/api/p/:/report')) && m === 'POST') return pub.report(request, env, r[0]);
  if ((r = match(path, '/api/p/:/polls')) && m === 'GET') return pub.publicPolls(request, env, r[0]);
  if ((r = match(path, '/api/polls/:/vote')) && m === 'POST') return pub.vote(request, env, r[0]);
  // בעלים
  if (path === '/api/me' && m === 'GET') return owner.getMe(request, env);
  if (path === '/api/me/check' && m === 'GET') return owner.checkNames(request, env, url);
  if (path === '/api/me/party') {
    if (m === 'POST') return owner.createParty(request, env);
    if (m === 'PATCH') return owner.updateParty(request, env);
    if (m === 'DELETE') return owner.deleteParty(request, env);
  }
  if (path === '/api/me/party/slug' && m === 'PUT') return owner.changeSlug(request, env);
  if (path === '/api/me/party/publish' && m === 'POST') return owner.publishParty(request, env);
  if (path === '/api/me/party/unpublish' && m === 'POST') return owner.unpublishParty(request, env);
  if (path === '/api/me/stats' && m === 'GET') return owner.stats(request, env);
  if (path === '/api/me/images' && m === 'POST') return images.uploadImage(request, env, url);
  if (path === '/api/me/gallery' && m === 'GET') return images.listGallery(request, env);
  if ((r = match(path, '/api/me/images/:')) && m === 'DELETE') return images.deleteImage(request, env, r[0]);
  if (path === '/api/me/inbox' && m === 'GET') return owner.listInbox(request, env, url);
  if ((r = match(path, '/api/me/inbox/:'))) {
    if (m === 'PATCH') return owner.updateInbox(request, env, r[0]);
    if (m === 'DELETE') return owner.deleteInbox(request, env, r[0]);
  }
  if (path === '/api/me/supporters' && m === 'GET') return owner.listSupporters(request, env);
  if ((r = match(path, '/api/me/supporters/:')) && m === 'DELETE') return owner.deleteSupporter(request, env, r[0]);
  if (path === '/api/me/polls') {
    if (m === 'GET') return owner.listOwnerPolls(request, env);
    if (m === 'POST') return owner.createPoll(request, env);
  }
  if ((r = match(path, '/api/me/polls/:/close')) && m === 'POST') return owner.closePoll(request, env, r[0]);
  if ((r = match(path, '/api/me/polls/:')) && m === 'DELETE') return owner.deletePoll(request, env, r[0]);
  throw new HttpError(404, 'not_found', 'נקודת קצה לא קיימת');
}

async function adminApi(request, env, url) {
  const m = request.method;
  const path = url.pathname;
  let r;
  if (path === '/api/admin/manifest' && m === 'GET') return admin.manifest(request, env);
  if ((r = match(path, '/api/admin/actions/:')) && m === 'POST') return admin.runAction(request, env, r[0]);
  if (path === '/api/admin/overview' && m === 'GET') return admin.overview(request, env);
  if (path === '/api/admin/parties' && m === 'GET') return admin.listParties(request, env, url);
  if ((r = match(path, '/api/admin/parties/:'))) {
    if (m === 'GET') return admin.getParty(request, env, r[0]);
    if (m === 'PATCH') return admin.patchParty(request, env, r[0]);
    if (m === 'DELETE') return admin.removeParty(request, env, r[0]);
  }
  if ((r = match(path, '/api/admin/images/:')) && m === 'DELETE') return admin.removeImage(request, env, r[0]);
  if (path === '/api/admin/reports' && m === 'GET') return admin.listReports(request, env, url);
  if ((r = match(path, '/api/admin/reports/:')) && m === 'PATCH') return admin.patchReport(request, env, r[0]);
  if (path === '/api/admin/submissions' && m === 'GET') return admin.listSubmissions(request, env, url);
  if ((r = match(path, '/api/admin/submissions/:'))) {
    if (m === 'PATCH') return admin.patchSubmission(request, env, r[0]);
    if (m === 'DELETE') return admin.deleteSubmission(request, env, r[0]);
  }
  if (path === '/api/admin/categories') {
    if (m === 'GET') return admin.listCategories(request, env);
    if (m === 'POST') return admin.saveCategory(request, env);
  }
  if (path === '/api/admin/snippets') {
    if (m === 'GET') return admin.listSnippets(request, env);
    if (m === 'POST') return admin.addSnippet(request, env);
  }
  if ((r = match(path, '/api/admin/snippets/:'))) {
    if (m === 'PATCH') return admin.patchSnippet(request, env, r[0]);
    if (m === 'DELETE') return admin.deleteSnippet(request, env, r[0]);
  }
  if (path === '/api/admin/settings') {
    if (m === 'GET') return admin.adminGetSettings(request, env);
    if (m === 'PUT') return admin.adminPutSettings(request, env);
  }
  if (path === '/api/admin/log' && m === 'GET') return admin.auditLog(request, env);
  throw new HttpError(404, 'not_found', 'נקודת קצה לא קיימת');
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = originOf(request, env);
  let r;

  if (path.startsWith('/api/admin/')) {
    if (request.method === 'OPTIONS') return adminCors(new Response(null, { status: 204 }));
    try {
      return adminCors(await adminApi(request, env, url));
    } catch (err) {
      if (err instanceof HttpError) return adminCors(errorResponse(err));
      throw err;
    }
  }
  if (path.startsWith('/api/')) {
    // נקודות קצה רגילות לא פתוחות לאתרים אחרים (אין CORS). בקשות כתיבה מאתר זר נחסמות.
    const reqOrigin = request.headers.get('origin');
    if (reqOrigin && reqOrigin !== new URL(request.url).origin && reqOrigin !== origin && request.method !== 'GET') {
      throw new HttpError(403, 'bad_origin', 'בקשה ממקור לא מורשה');
    }
    return api(request, env, url);
  }
  if ((r = match(path, '/img/:'))) return images.serveImage(env, r[0]);
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method', 'שיטה לא נתמכת');

  if (path === '/') return homePage(request, env, url);
  if ((r = match(path, '/party/:/'))) return partyPage(request, env, ctx, r[0]);
  if ((r = match(path, '/party/:'))) return Response.redirect(`${origin}/party/${encodeURIComponent(r[0])}/${url.search}`, 301);
  if (path === '/sitemap.xml') return sitemap(request, env);
  if (path === '/robots.txt') return robots(request, env);
  const ann = ['/privacy/', '/terms/', '/accessibility/', '/contact/', '/app/'].some((x) => path.startsWith(x)) ? await announcement(env) : '';
  if (path === '/privacy/') return html(renderPrivacy({ origin, announcement: ann }));
  if (path === '/terms/') return html(renderTerms({ origin, announcement: ann }));
  if (path === '/accessibility/') return html(renderAccessibility({ origin, formToken: await formToken(env), announcement: ann }));
  if (path === '/contact/') return html(renderContact({ origin, formToken: await formToken(env), announcement: ann }));
  if (path === '/auth/callback/') return html(renderCallback({ origin }));
  if (path === '/app' || path === '/admin') return Response.redirect(`${origin}${path}/`, 301);
  if (path.startsWith('/app/')) return html(renderAppShell({ origin, kind: 'app', announcement: ann }));
  if (path === '/admin/') return html(renderAppShell({ origin, kind: 'admin' }));
  if (['/privacy', '/terms', '/accessibility', '/contact'].includes(path)) return Response.redirect(`${origin}${path}/`, 301);

  // קבצים סטטיים
  if (env.ASSETS) {
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) {
      const out = new Response(res.body, res);
      if (path.startsWith('/assets/')) out.headers.set('cache-control', url.searchParams.has('v') || path.startsWith('/assets/fonts/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      return out;
    }
  }
  return html(renderNotFound({ origin }), 404);
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const sso = ssoOrigin(env);
    try {
      const res = await route(request, env, ctx);
      // דף הניהול מוטמע בדשבורד של Reem.bi, ולכן מותר להציג אותו שם במסגרת
      return withSecurityHeaders(res, { frameAncestors: path === '/admin/' ? `'self' ${ADMIN_ORIGIN}` : "'none'", ssoOrigin: sso });
    } catch (err) {
      if (err instanceof HttpError) return withSecurityHeaders(errorResponse(err), { ssoOrigin: sso });
      ctx.waitUntil(logError(env, `${request.method} ${path}`, err));
      console.error('unhandled', path, err?.message);
      if (path.startsWith('/api/')) {
        return withSecurityHeaders(errorResponse(new HttpError(500, 'server_error', 'משהו השתבש בצד שלנו. זה לא אתם, זה אנחנו. נסו שוב בעוד רגע')), { ssoOrigin: sso });
      }
      return withSecurityHeaders(html(renderError({ origin: originOf(request, env) }), 500), { ssoOrigin: sso });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(admin.prune(env).catch((err) => logError(env, 'scheduled', err)));
  },
};
