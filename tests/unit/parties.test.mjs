// בדיקות שרת: יצירה, מגבלת מפלגה אחת, עריכה, פרסום, נתיבים, הרשאות בעלים ומחיקה.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, BASIC_PARTY, sso } from '../helpers/worker.mjs';

let env;
let c;
beforeEach(() => { env = makeEnv(); c = client(env); sso.down = false; });

describe('יצירת מפלגה', () => {
  test('משתמש לא מחובר מקבל 401', async () => {
    const r = await c.post('/api/me/party', { body: BASIC_PARTY });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, 'unauthorized');
  });

  test('טוקן לא תקף מקבל 401', async () => {
    const r = await c.get('/api/me', { token: 'tok-unknown-12345678' });
    assert.equal(r.status, 401);
  });

  test('יצירה מוצלחת יוצרת טיוטה עם נתיב באנגלית', async () => {
    const r = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    assert.equal(r.status, 201);
    assert.equal(r.json.party.status, 'draft');
    assert.match(r.json.party.slug, /^[a-z0-9-]+$/);
    assert.equal(r.json.party.owner_id, undefined, 'מזהה הבעלים לא נחשף');
  });

  test('אי אפשר ליצור מפלגה שנייה (בדיקת שרת)', async () => {
    await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    const r = await c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, name: 'מפלגה אחרת לגמרי' } });
    assert.equal(r.status, 409);
    assert.equal(r.json.error, 'party_exists');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM parties').first();
    assert.equal(n.n, 1);
  });

  test('שתי יצירות מקבילות: רק אחת מצליחה (אילוץ ייחודיות במסד)', async () => {
    const results = await Promise.all([
      c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, name: 'מפלגה ראשונה' } }),
      c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, name: 'מפלגה שנייה' } }),
    ]);
    const ok = results.filter((r) => r.status === 201);
    assert.equal(ok.length, 1);
    assert.ok(results.some((r) => r.status === 409));
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM parties WHERE owner_id = 'u-alice'").first();
    assert.equal(n.n, 1);
  });

  test('אילוץ במסד חוסם גם הוספה ישירה', async () => {
    await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    await assert.rejects(() => env.DB.prepare(
      "INSERT INTO parties (id, owner_id, slug, name, name_key, created_at, updated_at) VALUES ('x', 'u-alice', 'other', 'אחרת', 'אחרת', 1, 1)",
    ).run(), /UNIQUE/);
  });

  test('שם תפוס על ידי משתמש אחר נדחה', async () => {
    await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    const r = await c.post('/api/me/party', { token: 'bob', body: { ...BASIC_PARTY, name: 'מפלגת  הקפה השני!' } });
    assert.equal(r.status, 409);
    assert.equal(r.json.error, 'name_taken');
  });

  test('שם של מפלגה אמיתית או גוף רשמי נדחה', async () => {
    const r = await c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, name: 'ועדת הבחירות של השכונה' } });
    assert.equal(r.status, 422);
    assert.ok(r.json.fields.name);
  });

  test('נתונים חסרים מחזירים שגיאות שדה בעברית', async () => {
    const r = await c.post('/api/me/party', { token: 'alice', body: { name: '' } });
    assert.equal(r.status, 422);
    assert.ok(r.json.fields.name);
    assert.ok(r.json.fields.acronym);
  });

  test('שם ארוך בעברית: עד 60 תווים מתקבל, יותר נדחה', async () => {
    const long = 'התנועה העממית המאוחדת לשחרור השקע האחרון ליד הספה בסלון';
    assert.ok([...long].length <= 60);
    const ok = await c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, name: long } });
    assert.equal(ok.status, 201);
    const tooLong = await c.post('/api/me/party', { token: 'bob', body: { ...BASIC_PARTY, name: 'א'.repeat(61) } });
    assert.equal(tooLong.status, 422);
  });

  test('תוכן HTML נשמר כטקסט ומוצג עם בריחה', async () => {
    await c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, slogan: '<script>alert(1)</script>' } });
    await c.patch('/api/me/party', { token: 'alice', body: { visibility: 'public' } });
    const pub = await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    assert.equal(pub.status, 200);
    const page = await c.get(`/party/${pub.json.party.slug}/`);
    assert.equal(page.status, 200);
    assert.ok(!page.text.includes('<script>alert(1)</script>'));
    assert.ok(page.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });
});

describe('עריכה ופרסום', () => {
  let slug;
  beforeEach(async () => {
    const r = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    slug = r.json.party.slug;
  });

  test('שמירת טיוטה של מצע, הנהלה וקמפיין', async () => {
    const r = await c.patch('/api/me/party', {
      token: 'alice',
      body: {
        platform: [{ topic: 'transport', title: 'אוטובוס בזמן', promise: 'כל אוטובוס יגיע בזמן', explanation: '', priority: 1, status: 'proposal' }],
        leaders: [{ name: 'גברת במבה', role: 'שרת הנשנושים', bio: '', fictional: 1 }],
        campaign: { flagship: 'טחינה לכולם', speech: 'נאום' },
        wizard_step: 4,
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.party.platform.length, 1);
    assert.equal(r.json.party.leaders[0].fictional, 1);
    assert.equal(r.json.party.campaign.flagship, 'טחינה לכולם');
    assert.equal(r.json.party.wizard_step, 4);
  });

  test('אדם אמיתי בלי אישור לא נשמר בהנהלה', async () => {
    const r = await c.patch('/api/me/party', { token: 'alice', body: { leaders: [{ name: 'ישראל ישראלי', role: 'יו"ר', fictional: 0, consent: 0 }] } });
    assert.equal(r.status, 422);
    assert.ok(r.json.fields['leaders.0.consent']);
  });

  test('לא מפרסמים מפלגה חסרה', async () => {
    await c.patch('/api/me/party', { token: 'alice', body: { slogan: '' } });
    const r = await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    assert.equal(r.status, 422);
    assert.ok(r.json.missing.includes('סיסמת בחירות'));
  });

  test('טיוטה לא נגישה לציבור; אחרי פרסום כן', async () => {
    assert.equal((await c.get(`/party/${slug}/`)).status, 404);
    assert.equal((await c.get('/api/parties')).json.items.length, 0);
    await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    const page = await c.get(`/party/${slug}/`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('מפלגה הומוריסטית עצמאית, לא מפלגה רשמית ולא גוף של ועדת הבחירות המרכזית'));
    assert.ok(page.text.includes('property="og:title"'));
    assert.ok(page.text.includes(`https://miflaga.test/party/${slug}/`));
    assert.ok(page.text.includes('wa.me'));
    assert.equal((await c.get('/api/parties')).json.items.length, 1);
  });

  test('מפלגה פרטית לא נגישה ולא ברשימה', async () => {
    await c.patch('/api/me/party', { token: 'alice', body: { visibility: 'private' } });
    await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    assert.equal((await c.get(`/party/${slug}/`)).status, 404);
    assert.equal((await c.get('/api/parties')).json.total, 0);
  });

  test('לא להופיע בדף הבית: נגישה בקישור אבל לא ברשימה', async () => {
    await c.patch('/api/me/party', { token: 'alice', body: { show_on_home: 0 } });
    await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    assert.equal((await c.get(`/party/${slug}/`)).status, 200);
    assert.equal((await c.get('/api/parties')).json.total, 0);
  });

  test('שינוי נתיב אחרי פרסום: הישן מפנה לחדש', async () => {
    await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    const r = await c.put('/api/me/party/slug', { token: 'alice', body: { slug: 'coffee-party' } });
    assert.equal(r.status, 200);
    const old = await c.get(`/party/${slug}/`);
    assert.equal(old.status, 301);
    assert.equal(old.headers.get('location'), 'https://miflaga.test/party/coffee-party/');
    assert.equal((await c.get('/party/coffee-party/')).status, 200);
  });

  test('נתיב שמור או לא תקין נדחה', async () => {
    assert.equal((await c.put('/api/me/party/slug', { token: 'alice', body: { slug: 'admin' } })).status, 422);
    assert.equal((await c.put('/api/me/party/slug', { token: 'alice', body: { slug: 'Bad Slug!' } })).status, 422);
  });

  test('משתמש אחר לא יכול לקחת נתיב תפוס', async () => {
    await c.post('/api/me/party', { token: 'bob', body: { ...BASIC_PARTY, name: 'מפלגת בוב' } });
    const r = await c.put('/api/me/party/slug', { token: 'bob', body: { slug } });
    assert.equal(r.status, 409);
  });

  test('קישור בלי לוכסן מופנה לקישור הקבוע', async () => {
    await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    const r = await c.get(`/party/${slug}`);
    assert.equal(r.status, 301);
    assert.ok(r.headers.get('location').endsWith(`/party/${slug}/`));
  });
});

describe('הרשאות בעלים', () => {
  test('משתמש אחר לא יכול לערוך, לפרסם או למחוק מפלגה שלא שלו', async () => {
    await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    // לבוב אין מפלגה: כל פעולה של "המפלגה שלי" מחזירה 404 ולא נוגעת במפלגה של אליס
    assert.equal((await c.patch('/api/me/party', { token: 'bob', body: { name: 'נחטפה' } })).status, 404);
    assert.equal((await c.post('/api/me/party/publish', { token: 'bob', body: {} })).status, 404);
    assert.equal((await c.del('/api/me/party', { token: 'bob', body: { confirm: BASIC_PARTY.name } })).status, 404);
    const p = await env.DB.prepare("SELECT name, status FROM parties WHERE owner_id = 'u-alice'").first();
    assert.equal(p.name, BASIC_PARTY.name);
    assert.equal(p.status, 'draft');
  });

  test('אין אפשרות לשנות בעלים או סטטוס ניהול דרך עדכון', async () => {
    await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    await c.patch('/api/me/party', { token: 'alice', body: { owner_id: 'u-bob', mod_status: 'ok', featured: 1, slug: 'hijack', status: 'published' } });
    const p = await env.DB.prepare("SELECT owner_id, featured, slug, status FROM parties WHERE owner_id = 'u-alice'").first();
    assert.equal(p.owner_id, 'u-alice');
    assert.equal(p.featured, 0);
    assert.equal(p.status, 'draft');
    assert.notEqual(p.slug, 'hijack');
  });

  test('בעלים של מפלגה חסומה לא יכולים לפרסם', async () => {
    await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    await env.DB.prepare("UPDATE parties SET mod_status = 'blocked' WHERE owner_id = 'u-alice'").run();
    const r = await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    assert.equal(r.status, 403);
  });

  test('שירות ההתחברות לא זמין: 503 עם הודעה ברורה', async () => {
    sso.down = true;
    const r = await c.get('/api/me', { token: 'alice' });
    assert.equal(r.status, 503);
    assert.equal(r.json.error, 'sso_unavailable');
  });

  test('בקשת כתיבה ממקור זר נחסמת', async () => {
    const r = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY, headers: { origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
  });
});

describe('מחיקה', () => {
  test('מחיקה דורשת הקלדת השם, מוחקת הכול, ומאפשרת הקמה מחדש', async () => {
    const created = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    const slug = created.json.party.slug;
    await c.post('/api/me/party/publish', { token: 'alice', body: {} });
    assert.equal((await c.del('/api/me/party', { token: 'alice', body: { confirm: 'שם אחר' } })).status, 422);
    const ok = await c.del('/api/me/party', { token: 'alice', body: { confirm: BASIC_PARTY.name } });
    assert.equal(ok.status, 200);
    assert.equal((await c.get(`/party/${slug}/`)).status, 404);
    const again = await c.post('/api/me/party', { token: 'alice', body: { ...BASIC_PARTY, slug } });
    assert.equal(again.status, 201, 'הבעלים המקורי יכול להשתמש שוב בנתיב שלו');
  });

  test('נתיב של מפלגה שנמחקה שמור מפני משתמשים אחרים', async () => {
    const created = await c.post('/api/me/party', { token: 'alice', body: BASIC_PARTY });
    const slug = created.json.party.slug;
    await c.del('/api/me/party', { token: 'alice', body: { confirm: BASIC_PARTY.name } });
    const r = await c.post('/api/me/party', { token: 'bob', body: { ...BASIC_PARTY, slug } });
    assert.equal(r.status, 409);
  });
});
