// בדיקות שרת: טפסים ציבוריים, הגנות ספאם, הגבלת קצב, הצבעות ותמונות.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, BASIC_PARTY, oldFormToken } from '../helpers/worker.mjs';
import { formToken } from '../../src/worker/ratelimit.js';

let env;
let c;
let slug;
const key = () => crypto.randomUUID();

beforeEach(async () => {
  env = makeEnv();
  c = client(env);
  const r = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
  slug = r.json.party.slug;
  await c.post('/api/me/party/publish', { token: 'alice', body: {} });
});

describe('טופס תומכים', () => {
  test('הצטרפות תקינה נשמרת ומעדכנת מונה; שליחה כפולה נשמרת פעם אחת', async () => {
    const body = { display_name: 'רותי', message: 'בהצלחה!', consent: 1, form_token: await oldFormToken(env), client_key: key() };
    const r1 = await c.post(`/api/p/${slug}/support`, { body });
    assert.equal(r1.status, 201);
    const r2 = await c.post(`/api/p/${slug}/support`, { body });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.duplicate, true);
    const p = await env.DB.prepare('SELECT supporters_count FROM parties').first();
    assert.equal(p.supporters_count, 1);
  });

  test('ולידציה בשרת: חסרה הסכמה / שם קצר', async () => {
    const r = await c.post(`/api/p/${slug}/support`, { body: { display_name: 'א', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 422);
    assert.ok(r.json.fields.display_name);
    assert.ok(r.json.fields.consent);
  });

  test('מלכודת ספאם (honeypot) חוסמת', async () => {
    const r = await c.post(`/api/p/${slug}/support`, { body: { display_name: 'בוט', consent: 1, website: 'http://spam', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 400);
  });

  test('שליחה מהירה מדי או בלי אסימון נחסמת', async () => {
    const fast = await c.post(`/api/p/${slug}/support`, { body: { display_name: 'מהיר', consent: 1, form_token: await formToken(env), client_key: key() } });
    assert.equal(fast.status, 400);
    assert.equal(fast.json.error, 'too_fast');
    const none = await c.post(`/api/p/${slug}/support`, { body: { display_name: 'בלי', consent: 1, client_key: key() } });
    assert.equal(none.status, 400);
    const forged = await c.post(`/api/p/${slug}/support`, { body: { display_name: 'מזויף', consent: 1, form_token: `${Date.now() - 9000}.deadbeef`, client_key: key() } });
    assert.equal(forged.status, 400);
  });

  test('הגבלת קצב לפי IP', async () => {
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const r = await c.post(`/api/p/${slug}/support`, { ipAddr: '9.9.9.9', body: { display_name: `תומך ${i}`, consent: 1, form_token: await oldFormToken(env), client_key: key() } });
      statuses.push(r.status);
    }
    assert.ok(statuses.includes(429), `expected 429 in ${statuses}`);
  });

  test('כשהמפלגה כיבתה הצטרפות: 403', async () => {
    await c.patch('/api/me/party', { token: 'alice', body: { allow_supporters: 0 } });
    const r = await c.post(`/api/p/${slug}/support`, { body: { display_name: 'רותי', consent: 1, form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 403);
  });

  test('קיר תומכים: לא חשוף כברירת מחדל, ורק בהסכמה כפולה', async () => {
    await c.post(`/api/p/${slug}/support`, { body: { display_name: 'גלוי', consent: 1, public_ok: 1, form_token: await oldFormToken(env), client_key: key() } });
    c.nextIp();
    await c.post(`/api/p/${slug}/support`, { body: { display_name: 'חסוי', consent: 1, public_ok: 0, form_token: await oldFormToken(env), client_key: key() } });
    let r = await c.get(`/api/p/${slug}/supporters`);
    assert.equal(r.json.items.length, 0, 'ברירת מחדל: אין שמות');
    await c.patch('/api/me/party', { token: 'alice', body: { show_supporter_names: 1 } });
    r = await c.get(`/api/p/${slug}/supporters`);
    assert.deepEqual(r.json.items.map((x) => x.display_name), ['גלוי']);
  });

  test('בעלים רואים תומכים; משתמש אחר לא', async () => {
    await c.post(`/api/p/${slug}/support`, { body: { display_name: 'רותי', consent: 1, form_token: await oldFormToken(env), client_key: key() } });
    assert.equal((await c.get('/api/me/supporters', { token: 'alice' })).json.items.length, 1);
    assert.equal((await c.get('/api/me/supporters', { token: 'bob' })).status, 404);
    assert.equal((await c.get('/api/me/supporters')).status, 401);
  });
});

describe('פניות', () => {
  test('פנייה למפלגה נשמרת, בעלים מנהלים אותה, משתמש אחר לא', async () => {
    const r = await c.post(`/api/p/${slug}/submit`, { body: { kind: 'idea', body: 'ברז טחינה בכל כיתה', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 201);
    const list = await c.get('/api/me/inbox', { token: 'alice' });
    assert.equal(list.json.items.length, 1);
    const id = list.json.items[0].id;
    assert.equal((await c.patch(`/api/me/inbox/${id}`, { token: 'bob', body: { status: 'read' } })).status, 404);
    assert.equal((await c.patch(`/api/me/inbox/${id}`, { token: 'alice', body: { status: 'read' } })).status, 200);
    assert.equal((await c.del(`/api/me/inbox/${id}`, { token: 'alice' })).status, 200);
  });

  test('פרטי קשר בלי הסכמה נדחים', async () => {
    const r = await c.post(`/api/p/${slug}/submit`, { body: { kind: 'question', body: 'מתי הכנס?', contact: 'a@b.co', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 422);
    assert.ok(r.json.fields.consent);
  });

  test('סוג פנייה לא מורשה נדחה', async () => {
    const r = await c.post(`/api/p/${slug}/submit`, { body: { kind: 'feedback', body: 'משהו', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 422);
  });

  test('טופס יצירת קשר ומשוב לאתר', async () => {
    const r = await c.post('/api/site/submit', { body: { kind: 'accessibility', body: 'הכפתור לא נקרא בקורא מסך', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 201);
    const s = await env.DB.prepare('SELECT party_id, kind FROM submissions').first();
    assert.equal(s.party_id, null);
    assert.equal(s.kind, 'accessibility');
  });

  test('דיווח על מפלגה', async () => {
    const r = await c.post(`/api/p/${slug}/report`, { body: { reason: 'offensive', details: 'לא נעים', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 201);
    const bad = await c.post(`/api/p/${slug}/report`, { body: { reason: 'nope', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(bad.status, 422);
  });

  test('טפסים למפלגה לא קיימת או טיוטה: 404', async () => {
    const r = await c.post('/api/p/no-such-party/submit', { body: { kind: 'idea', body: 'שלום', form_token: await oldFormToken(env), client_key: key() } });
    assert.equal(r.status, 404);
  });
});

describe('הצבעות', () => {
  async function newPoll(body = {}) {
    const r = await c.post('/api/me/polls', { token: 'alice', body: { question: 'מי יהיה היו"ר?', kind: 'chair', options: ['אליס', 'גברת במבה'], ...body } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const polls = await c.get(`/api/p/${slug}/polls`);
    return { id: r.json.id, options: polls.json.items[0].options };
  }

  test('הצבעה דורשת התחברות, ונספרת פעם אחת למשתמש', async () => {
    const { id, options } = await newPoll();
    assert.equal((await c.post(`/api/polls/${id}/vote`, { body: { option_id: options[0].id } })).status, 401);
    assert.equal((await c.post(`/api/polls/${id}/vote`, { token: 'bob', body: { option_id: options[0].id } })).status, 201);
    const again = await c.post(`/api/polls/${id}/vote`, { token: 'bob', body: { option_id: options[1].id } });
    assert.equal(again.status, 409);
    assert.equal(again.json.error, 'already_voted');
    assert.equal((await c.post(`/api/polls/${id}/vote`, { token: 'carol', body: { option_id: options[1].id } })).status, 201);
    const owner = await c.get('/api/me/polls', { token: 'alice' });
    assert.deepEqual(owner.json.items[0].options.map((o) => o.votes), [1, 1]);
    assert.ok(!JSON.stringify(owner.json).includes('u-bob'), 'הבעלים לא רואים מי הצביע');
  });

  test('תוצאות "אחרי הצבעה": מוסתרות עד שמצביעים', async () => {
    const { id, options } = await newPoll();
    let r = await c.get(`/api/p/${slug}/polls`, { token: 'bob' });
    assert.equal(r.json.items[0].total, null);
    await c.post(`/api/polls/${id}/vote`, { token: 'bob', body: { option_id: options[0].id } });
    r = await c.get(`/api/p/${slug}/polls`, { token: 'bob' });
    assert.equal(r.json.items[0].total, 1);
    assert.equal(r.json.items[0].my_vote, options[0].id);
  });

  test('אחרי סגירה אי אפשר להצביע; רק הבעלים סוגרים', async () => {
    const { id, options } = await newPoll();
    assert.equal((await c.post(`/api/me/polls/${id}/close`, { token: 'bob', body: {} })).status, 404);
    assert.equal((await c.post(`/api/me/polls/${id}/close`, { token: 'alice', body: {} })).status, 200);
    const r = await c.post(`/api/polls/${id}/vote`, { token: 'bob', body: { option_id: options[0].id } });
    assert.equal(r.status, 409);
    assert.equal(r.json.error, 'closed');
  });

  test('אפשרות מהצבעה אחרת נדחית', async () => {
    const a = await newPoll();
    const b = await newPoll({ question: 'איזו סיסמה?', options: ['א', 'ב'] });
    const r = await c.post(`/api/polls/${a.id}/vote`, { token: 'bob', body: { option_id: b.options.find(Boolean).id } });
    assert.ok([422].includes(r.status));
  });

  test('ולידציית יצירה: פחות משתי אפשרויות, כפילויות, מועד בעבר', async () => {
    assert.equal((await c.post('/api/me/polls', { token: 'alice', body: { question: 'שאלה?', options: ['רק אחת'] } })).status, 422);
    assert.equal((await c.post('/api/me/polls', { token: 'alice', body: { question: 'שאלה?', options: ['א', 'א'] } })).status, 422);
    assert.equal((await c.post('/api/me/polls', { token: 'alice', body: { question: 'שאלה?', options: ['א', 'ב'], ends_at: '2001-01-01T00:00:00Z' } })).status, 422);
  });
});

describe('תמונות', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);

  test('העלאה תקינה והגשה עם כותרות בטוחות', async () => {
    const r = await c.post('/api/me/images?kind=gallery&title=פלייר', { token: 'alice', raw: PNG, headers: { 'content-type': 'image/png' } });
    assert.equal(r.status, 201);
    const img = await c.get(`/img/${r.json.id}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
    assert.match(img.headers.get('content-security-policy'), /sandbox/);
  });

  test('קובץ שאינו תמונה (SVG/HTML) נדחה גם אם מוצהר כתמונה', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const r = await c.post('/api/me/images?kind=emblem', { token: 'alice', raw: svg, headers: { 'content-type': 'image/png' } });
    assert.equal(r.status, 415);
  });

  test('קובץ גדול מדי נדחה', async () => {
    const big = new Uint8Array(800 * 1024);
    big.set(PNG);
    const r = await c.post('/api/me/images?kind=gallery', { token: 'alice', raw: big, headers: { 'content-type': 'image/png' } });
    assert.equal(r.status, 413);
  });

  test('בלי התחברות או בלי מפלגה אי אפשר להעלות', async () => {
    assert.equal((await c.post('/api/me/images?kind=gallery', { raw: PNG })).status, 401);
    assert.equal((await c.post('/api/me/images?kind=gallery', { token: 'bob', raw: PNG })).status, 404);
  });

  test('אי אפשר לשייך לסמל תמונה של מפלגה אחרת', async () => {
    const up = await c.post('/api/me/images?kind=emblem', { token: 'alice', raw: PNG });
    await c.post('/api/me/party', { token: 'bob', body: { ...BASIC_PARTY, name: 'מפלגת בוב' } });
    const r = await c.patch('/api/me/party', { token: 'bob', body: { emblem: { icon: 'bus', image: up.json.id } } });
    assert.equal(r.status, 422);
  });

  test('משתמש אחר לא יכול למחוק תמונה שלא שלו', async () => {
    const up = await c.post('/api/me/images?kind=gallery', { token: 'alice', raw: PNG });
    assert.equal((await c.del(`/api/me/images/${up.json.id}`, { token: 'bob' })).status, 404);
    assert.equal((await c.del(`/api/me/images/${up.json.id}`, { token: 'alice' })).status, 200);
  });
});

describe('דפים ציבוריים', () => {
  test('דף הבית מציג מפלגות אמיתיות בלבד, וחיפוש עובד', async () => {
    const home = await c.get('/');
    assert.equal(home.status, 200);
    assert.ok(home.text.includes(BASIC_PARTY.name));
    assert.ok(home.text.includes('מקימים מפלגה'));
    assert.ok(home.text.includes('לגלות את המפלגות'));
    const q = await c.get(`/api/parties?q=${encodeURIComponent('קפה')}`);
    assert.equal(q.json.total, 1);
    const none = await c.get(`/api/parties?q=${encodeURIComponent('אין כזה')}`);
    assert.equal(none.json.total, 0);
    const cat = await c.get('/api/parties?category=food');
    assert.equal(cat.json.total, 0);
  });

  test('דף בית ריק מציג מצב ריק', async () => {
    const env2 = makeEnv();
    const home = await client(env2).get('/');
    assert.ok(home.text.includes('עוד אין כאן מפלגות'));
  });

  test('sitemap, robots, 404 ודפי מידע', async () => {
    const sm = await c.get('/sitemap.xml');
    assert.ok(sm.text.includes(`/party/${slug}/`));
    assert.ok((await c.get('/robots.txt')).text.includes('Sitemap:'));
    assert.equal((await c.get('/no/such/page')).status, 404);
    for (const p of ['/privacy/', '/terms/', '/accessibility/', '/contact/']) assert.equal((await c.get(p)).status, 200, p);
    assert.equal((await c.get('/app/studio/')).status, 200, 'רענון ישיר של נתיב באפליקציה');
  });

  test('כותרות אבטחה: CSP, מניעת מסגור, וחריג לדף הניהול בלבד', async () => {
    const home = await c.get('/');
    assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    const admin = await c.get('/admin/');
    assert.match(admin.headers.get('content-security-policy'), /frame-ancestors 'self' https:\/\/login\.reembir\.com/);
    assert.equal(admin.headers.get('x-frame-options'), null);
  });

  test('ספירת צפיות מתעלמת מבוטים', async () => {
    await c.get(`/party/${slug}/`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' } });
    await c.get(`/party/${slug}/`, { headers: { 'user-agent': 'WhatsApp/2.0' } });
    const p = await env.DB.prepare('SELECT views_total FROM parties').first();
    assert.equal(p.views_total, 1);
  });
});
