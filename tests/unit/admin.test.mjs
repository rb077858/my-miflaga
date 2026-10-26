// בדיקות שרת: הרשאות מנהל, מניפסט ל-Reem.bi, ניהול תוכן ויומן ביקורת.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, BASIC_PARTY } from '../helpers/worker.mjs';

let env;
let c;
let partyId;
let slug;

beforeEach(async () => {
  env = makeEnv();
  c = client(env);
  const r = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
  partyId = r.json.party.id;
  slug = r.json.party.slug;
  await c.post('/api/me/party/publish', { token: 'alice', body: {} });
});

describe('הרשאות מנהל', () => {
  test('לא מחובר: 401; משתמש רגיל: 403; מנהל: 200', async () => {
    assert.equal((await c.get('/api/admin/manifest')).status, 401);
    assert.equal((await c.get('/api/admin/manifest', { token: 'alice' })).status, 403);
    assert.equal((await c.get('/api/admin/manifest', { token: 'admin' })).status, 200);
  });

  test('כותרת מזויפת עם אימייל של מנהל לא עוזרת', async () => {
    const r = await c.get('/api/admin/parties', { token: 'alice', headers: { 'x-user-email': 'rb077858@gmail.com' } });
    assert.equal(r.status, 403);
  });

  test('בלי ADMIN_EMAILS אף אחד לא מנהל', async () => {
    const env2 = makeEnv({ ADMIN_EMAILS: '' });
    assert.equal((await client(env2).get('/api/admin/manifest', { token: 'admin' })).status, 403);
  });

  test('CORS מצומצם ל-login.reembir.com בנתיבי הניהול בלבד', async () => {
    const pre = await c.call('OPTIONS', '/api/admin/manifest', { headers: { origin: 'https://login.reembir.com' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'https://login.reembir.com');
    assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
    const normal = await c.get('/api/parties');
    assert.equal(normal.headers.get('access-control-allow-origin'), null);
  });

  test('מבנה המניפסט תואם לדשבורד', async () => {
    const m = (await c.get('/api/admin/manifest', { token: 'admin' })).json;
    assert.equal(m.version, 1);
    assert.ok(m.stats.find((s) => s.label === 'מפלגות').value >= 1);
    assert.ok(m.checks.find((x) => x.label === 'ADMIN_EMAILS').ok);
    assert.ok(m.actions.every((a) => a.id && a.label));
    assert.ok(Array.isArray(m.lists));
  });

  test('פעולות מהמניפסט עובדות ונרשמות ביומן', async () => {
    const r = await c.post('/api/admin/actions/recount', { token: 'admin', body: {} });
    assert.equal(r.status, 200);
    assert.ok(r.json.message);
    assert.equal((await c.post('/api/admin/actions/unknown', { token: 'admin', body: {} })).status, 404);
    const log = await c.get('/api/admin/log', { token: 'admin' });
    assert.ok(log.json.items.some((l) => l.action === 'action:recount'));
  });
});

describe('ניהול מפלגות', () => {
  test('הסתרה: נגישה בקישור, לא ברשימה; חסימה: הדף מושבת; החזרה לפרסום', async () => {
    await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { mod_status: 'hidden' } });
    assert.equal((await c.get('/api/parties')).json.total, 0);
    assert.equal((await c.get(`/party/${slug}/`)).status, 200);
    await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { mod_status: 'blocked', mod_note: 'ספאם' } });
    assert.equal((await c.get(`/party/${slug}/`)).status, 410);
    await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { mod_status: 'ok' } });
    assert.equal((await c.get(`/party/${slug}/`)).status, 200);
    assert.equal((await c.get('/api/parties')).json.total, 1);
    const log = (await c.get('/api/admin/log', { token: 'admin' })).json.items;
    assert.equal(log.filter((l) => l.action === 'party:update').length, 3);
    assert.equal(log[0].admin_email, 'rb077858@gmail.com');
  });

  test('מפלגה נבחרת מופיעה בראש דף הבית; הורדה מדף הבית', async () => {
    await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { featured: true, featured_rank: 1 } });
    const home = await c.get('/');
    assert.ok(home.text.includes('מפלגות נבחרות'));
    await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { home_hidden: true } });
    assert.equal((await c.get('/api/parties')).json.total, 0);
  });

  test('עריכת תוכן פוגעני על ידי מנהל עוברת ולידציה ונרשמת', async () => {
    const r = await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { slogan: 'סיסמה נקייה', platform: [] } });
    assert.equal(r.status, 200);
    const p = await env.DB.prepare('SELECT slogan, platform FROM parties').first();
    assert.equal(p.slogan, 'סיסמה נקייה');
    assert.equal(p.platform, '[]');
    const bad = await c.patch(`/api/admin/parties/${partyId}`, { token: 'admin', body: { color_primary: 'red' } });
    assert.equal(bad.status, 422);
  });

  test('מחיקה חריגה דורשת סיבה, נרשמת, ומאפשרת לבעלים להקים מחדש', async () => {
    assert.equal((await c.del(`/api/admin/parties/${partyId}`, { token: 'admin', body: {} })).status, 422);
    assert.equal((await c.del(`/api/admin/parties/${partyId}`, { token: 'admin', body: { reason: 'בקשת הבעלים' } })).status, 200);
    const log = (await c.get('/api/admin/log', { token: 'admin' })).json.items;
    assert.ok(log.some((l) => l.action === 'party:delete' && l.details.includes('בקשת הבעלים')));
    assert.equal((await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY })).status, 201);
  });

  test('רשימת מפלגות למנהל כוללת טיוטות ומאפשרת חיפוש לפי אימייל', async () => {
    await c.post('/api/me/party', { token: 'bob', body: { ...BASIC_PARTY, name: 'טיוטה של בוב' } });
    const all = await c.get('/api/admin/parties', { token: 'admin' });
    assert.equal(all.json.items.length, 2);
    const bob = await c.get('/api/admin/parties?q=bob%40', { token: 'admin' });
    assert.equal(bob.json.items.length, 1);
    const drafts = await c.get('/api/admin/parties?status=draft', { token: 'admin' });
    assert.equal(drafts.json.items[0].name, 'טיוטה של בוב');
  });

  test('דיווחים ופניות: טיפול על ידי מנהל', async () => {
    await env.DB.prepare("INSERT INTO reports (id, party_id, reason, client_key, ip_hash, created_at) VALUES ('r1', ?, 'spam', 'k1', 'h', 1)").bind(partyId).run();
    const reports = await c.get('/api/admin/reports', { token: 'admin' });
    assert.equal(reports.json.items.length, 1);
    assert.equal((await c.patch('/api/admin/reports/r1', { token: 'admin', body: { status: 'resolved' } })).status, 200);
    assert.equal((await c.get('/api/admin/reports', { token: 'admin' })).json.items.length, 0);
    await env.DB.prepare("INSERT INTO submissions (id, party_id, kind, body, client_key, ip_hash, created_at) VALUES ('s1', NULL, 'contact', 'שלום', 'k2', 'h', 1)").run();
    assert.equal((await c.get('/api/admin/submissions', { token: 'admin' })).json.items.length, 1);
    assert.equal((await c.patch('/api/admin/submissions/s1', { token: 'admin', body: { status: 'spam' } })).status, 200);
  });

  test('קטגוריות, ספריית טקסטים והגדרות תבניות', async () => {
    assert.equal((await c.post('/api/admin/categories', { token: 'admin', body: { id: 'army', label: 'מילואים', emoji: '🪖' } })).status, 200);
    assert.ok((await c.get('/api/categories')).json.items.some((x) => x.id === 'army'));
    assert.equal((await c.post('/api/admin/categories', { token: 'admin', body: { id: 'Bad Id', label: 'x' } })).status, 422);
    assert.equal((await c.post('/api/admin/snippets', { token: 'admin', body: { kind: 'slogan', text: 'סיסמה חדשה' } })).status, 201);
    assert.equal((await c.get('/api/snippets')).json.items.length, 1);
    await c.put('/api/admin/settings', { token: 'admin', body: { disabled_templates: ['certificate'] } });
    const me = await c.get('/api/me', { token: 'alice' });
    assert.deepEqual(me.json.disabled_templates, ['certificate']);
    assert.equal((await c.put('/api/admin/settings', { token: 'alice', body: { disabled_templates: [] } })).status, 403);
  });
});
