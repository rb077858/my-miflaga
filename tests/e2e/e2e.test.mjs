// בדיקות קצה-לקצה בדפדפן אמיתי (Chromium דרך Playwright) מול wrangler dev עם D1 מקומי ו-Reem.bi מדומה.
// הרצה: npm run test:e2e
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startMockSso, USERS, FAKE_SDK } from './mock-sso.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); }

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PORT = 8790;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = join(ROOT, 'test-results/screens');
const PERSIST = join(ROOT, '.wrangler/e2e');
const TOKENS = Object.fromEntries(Object.entries(USERS).map(([t, u]) => [u.id.replace('u-', ''), t]));
const AXE = readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

let wrangler;
let sso;
let browser;
const consoleErrors = [];

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* עוד לא */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function ctx(user, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, locale: 'he-IL', acceptDownloads: true });
  await context.route('https://login.reembir.com/sdk.js', (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }));
  await context.route('**/__mock_user*', (r) => {
    const t = new URL(r.request().url()).searchParams.get('token');
    const u = USERS[t];
    return u ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(u) }) : r.fulfill({ status: 401, body: 'null' });
  });
  if (user) await context.addInitScript((t) => { try { localStorage.setItem('mock:token', t); } catch { /* about:blank */ } }, TOKENS[user]);
  context.on('page', (p) => {
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${p.url()}: ${m.text()}`); });
    p.on('pageerror', (e) => consoleErrors.push(`${p.url()}: ${e.message}`));
  });
  return context;
}

async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

async function noHorizontalScroll(page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(over <= 1, `גלילה אופקית של ${over}px ב-${page.url()}`);
}

async function axe(page, name) {
  // הודעות קופצות באמצע אנימציית יציאה נמדדות בצבע ביניים; מנקים אותן לפני הסריקה
  await page.evaluate(() => document.getElementById('toasts')?.replaceChildren());
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, samples: v.nodes.slice(0, 8).map((n) => `${n.html.slice(0, 120)} :: ${n.any?.[0]?.message?.slice(0, 140) || ''}`) }));
  });
  const serious = res.filter((v) => ['serious', 'critical'].includes(v.impact));
  writeFileSync(join(SHOTS, `axe-${name}.json`), JSON.stringify(res, null, 2));
  assert.deepEqual(serious, [], `axe ${name}: ${JSON.stringify(serious, null, 1)}`);
}

async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), click()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(path) };
}

before(async () => {
  rmSync(PERSIST, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npx, ['wrangler', 'd1', 'migrations', 'apply', 'miflaga-db', '--local', '--persist-to', PERSIST], { cwd: ROOT, stdio: 'ignore' });
  sso = await startMockSso(8788);
  wrangler = spawn(npx, ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', PERSIST,
    '--var', 'DEV_MODE:1', '--var', 'SSO_ORIGIN:http://127.0.0.1:8788', '--var', 'ADMIN_EMAILS:rb077858@gmail.com',
    '--var', 'RATE_SALT:e2e-salt-0123456789abcdef', '--var', `PUBLIC_ORIGIN:${BASE}`], { cwd: ROOT, stdio: 'ignore', detached: process.platform !== 'win32' });
  await waitFor(`${BASE}/api/health`);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  sso?.close();
  try { process.kill(-wrangler.pid); } catch { wrangler?.kill(); }
});

describe('זרימה מלאה בדפדפן', () => {
  test('דף הבית ריק: מצב ריק, נגישות, בלי שגיאות', async () => {
    const c = await ctx(null);
    const page = await c.newPage();
    await page.goto(BASE);
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.ok(await page.getByRole('heading', { name: 'עוד אין כאן מפלגות' }).isVisible());
    assert.ok(await page.getByRole('link', { name: /מקימים מפלגה/ }).first().isVisible());
    await page.getByRole('button', { name: 'התחברות' }).waitFor();
    await shot(page, '01-home-empty');
    await axe(page, 'home');
    await c.close();
  });

  test('אזור אישי בלי התחברות: מסך התחברות', async () => {
    const c = await ctx(null);
    const page = await c.newPage();
    await page.goto(`${BASE}/app/create/`);
    await page.getByRole('button', { name: /התחברות דרך Reem.bi/ }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('mock:login-called')), '1');
    await c.close();
  });

  test('אשף ההקמה המלא, פרסום, ואתר ציבורי', async () => {
    const c = await ctx('alice');
    const page = await c.newPage();
    await page.goto(`${BASE}/app/`);
    await page.getByRole('link', { name: /מקימים מפלגה/ }).last().click();
    await page.getByRole('textbox', { name: 'שם המפלגה', exact: true }).fill('התנועה העממית המאוחדת לשחרור השקע האחרון ליד הספה');
    await page.getByRole('textbox', { name: /ראשי תיבות/ }).fill('שק"ע');
    await page.getByRole('button', { name: /הצעה מצחיקה לסיסמת בחירות/ }).click();
    await page.getByRole('textbox', { name: 'תיאור קצר', exact: true }).fill('המפלגה של כל מי שהטלפון שלו על 3%.');
    await page.getByRole('button', { name: /הצעה מצחיקה לסיפור ההקמה/ }).click();
    await page.getByText('רציני למראה, מצחיק בתוכן').click();
    await shot(page, '02-wizard-step1');
    await page.getByRole('button', { name: /יצירת הטיוטה והמשך/ }).click();
    // שלב 2: סמל
    await page.getByRole('heading', { level: 1, name: /סמל/ }).waitFor();
    await page.locator('.icon-opt', { hasText: 'מטען' }).count();
    await page.locator('label.icon-opt[title="סמארטפון"]').click();
    await page.getByText('מגן', { exact: true }).click();
    await page.getByText('רטרו', { exact: true }).click();
    await page.getByText('זרי עלים').click();
    await shot(page, '03-wizard-emblem');
    await page.getByRole('button', { name: /שמירה והמשך/ }).click();
    // שלב 3: מצע
    await page.getByRole('heading', { level: 1, name: /מצע/ }).waitFor();
    await page.getByRole('button', { name: /הוספת סעיף/ }).click();
    await page.getByRole('button', { name: /הצעה מצחיקה לסעיף 1/ }).click();
    await page.locator('#new-topic').selectOption('tech');
    await page.getByRole('button', { name: /הוספת סעיף/ }).click();
    await page.getByRole('button', { name: /הצעה מצחיקה לסעיף 2/ }).click();
    await page.getByRole('button', { name: 'העברת סעיף 2 למעלה' }).click();
    await page.getByRole('button', { name: /שמירה והמשך/ }).click();
    // שלב 4: הנהגה — אדם אמיתי בלי אישור נחסם
    await page.getByRole('heading', { level: 1, name: /הנהגה/ }).waitFor();
    await page.getByRole('button', { name: /הוספת חבר\/ת הנהלה/ }).click();
    await page.getByRole('textbox', { name: 'שם תצוגה', exact: true }).fill('דנה');
    await page.getByRole('combobox', { name: 'תפקיד', exact: true }).fill('יו"ר');
    await page.getByRole('button', { name: /שמירה והמשך/ }).click();
    await page.getByText(/יש לסמן שזו דמות בדויה/).first().waitFor();
    await page.getByLabel(/דמות בדויה \(תסומן/).check();
    await page.getByRole('button', { name: /הוספת דמות בדויה מוכנה/ }).click();
    await page.getByRole('button', { name: /שמירה והמשך/ }).click();
    // שלב 5: קמפיין
    await page.getByRole('heading', { level: 1, name: /קמפיין/ }).waitFor();
    await page.getByRole('button', { name: /הצעה מצחיקה להבטחת הדגל/ }).click();
    await page.getByRole('button', { name: /הצעה מצחיקה לנאום פתיחה/ }).click();
    await page.getByRole('button', { name: /הצעה מצחיקה לסיסמאות בחירות/ }).click();
    await page.getByRole('button', { name: /הצעה מצחיקה לשאלות ותשובות/ }).click();
    await page.getByRole('button', { name: /שמירה והמשך/ }).click();
    // שלב 6: פרסום
    await page.getByRole('heading', { level: 1, name: /פרסום/ }).waitFor();
    await page.locator('#slug').fill('shka');
    await page.getByRole('button', { name: 'עדכון הכתובת' }).click();
    await page.getByText('הכתובת עודכנה.').waitFor();
    await page.getByLabel(/קיר תומכים/).check();
    await shot(page, '04-wizard-publish');
    await page.getByRole('button', { name: /פרסום המפלגה/ }).click();
    await page.getByRole('heading', { name: /התנועה העממית/ }).waitFor();
    await shot(page, '05-dashboard');
    await axe(page, 'dashboard');
    // אתר ציבורי
    const pub = await c.newPage();
    await pub.goto(`${BASE}/party/shka/`);
    await pub.getByRole('heading', { level: 1, name: /התנועה העממית/ }).waitFor();
    assert.ok(await pub.getByText('מפלגה הומוריסטית עצמאית, לא מפלגה רשמית ולא גוף של ועדת הבחירות המרכזית').first().isVisible());
    assert.ok(await pub.getByText('דמות בדויה').first().isVisible());
    await shot(pub, '06-public-party');
    await axe(pub, 'party');
    // העתקת קישור
    await c.grantPermissions(['clipboard-read', 'clipboard-write']);
    await pub.getByRole('button', { name: /העתקת קישור/ }).first().click();
    assert.equal(await pub.evaluate(() => navigator.clipboard.readText()), `${BASE}/party/shka/`);
    // פתק: PNG ו-PDF
    await pub.getByRole('button', { name: /הורדת פתק הומוריסטי/ }).click();
    await pub.locator('.ballot-preview > svg').waitFor();
    await shot(pub, '07-ballot-modal');
    const png = await download(pub, () => pub.getByRole('button', { name: 'הורדת PNG' }).click());
    assert.equal(png.name, 'shka-ballot.png');
    assert.deepEqual([...png.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.ok(png.bytes.length > 20000, `PNG קטן מדי: ${png.bytes.length}`);
    writeFileSync(join(SHOTS, 'ballot.png'), png.bytes);
    const pdf = await download(pub, () => pub.getByRole('button', { name: /PDF/ }).click());
    assert.equal(pdf.bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.bytes.length > 50000);
    writeFileSync(join(SHOTS, 'ballots-a4.pdf'), pdf.bytes);
    // התמונה לשיתוף נוצרה אוטומטית אחרי הפרסום
    await page.waitForTimeout(1500);
    const meta = await (await fetch(`${BASE}/party/shka/`)).text();
    assert.match(meta, /property="og:image" content="http:\/\/127\.0\.0\.1:8790\/img\/[A-Za-z0-9]+"/);
    await c.close();
  });

  test('אין יצירה שנייה דרך הממשק: /app/create/ מפנה לעריכה', async () => {
    const c = await ctx('alice');
    const page = await c.newPage();
    await page.goto(`${BASE}/app/create/`);
    await page.waitForURL(/\/app\/edit\//);
    await page.locator('.wizard-card h1').waitFor();
    assert.equal(await page.getByRole('button', { name: /יצירת הטיוטה/ }).count(), 0);
    await c.close();
  });

  test('סטודיו: פלייר PDF, פוסט PNG ופרסום לגלריה', async () => {
    const c = await ctx('alice');
    const page = await c.newPage();
    await page.goto(`${BASE}/app/studio/?t=flyer`);
    await page.locator('#stage > svg').waitFor();
    await shot(page, '08-studio-flyer');
    const pdf = await download(page, () => page.getByRole('button', { name: /PDF להדפסה/ }).click());
    assert.equal(pdf.bytes.subarray(0, 5).toString(), '%PDF-');
    writeFileSync(join(SHOTS, 'flyer.pdf'), pdf.bytes);
    for (const id of ['post', 'story', 'certificate', 'member-card', 'banner', 'poster', 'og', 'profile']) {
      await page.getByRole('button', { name: new RegExp(['פוסט מרובע', 'סטורי', 'תעודת', 'כרטיס חבר', 'באנר', 'כרזת', 'תמונת שיתוף', 'תמונת פרופיל'][['post', 'story', 'certificate', 'member-card', 'banner', 'poster', 'og', 'profile'].indexOf(id)]) }).click();
      await page.waitForTimeout(250);
      const out = await download(page, () => page.getByRole('button', { name: /הורדת PNG/ }).click());
      assert.deepEqual([...out.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], id);
      writeFileSync(join(SHOTS, `studio-${id}.png`), out.bytes);
    }
    await page.getByRole('button', { name: /פוסט מרובע/ }).click();
    await page.getByRole('button', { name: /פרסום בגלריה/ }).click();
    await page.getByText('התוצר פורסם בגלריה של האתר.').waitFor();
    await c.close();
  });

  test('בחירות פנימיות: יצירה ע"י הבעלים, הצבעה ע"י משתמש אחר, בלי הצבעה כפולה', async () => {
    const c = await ctx('alice');
    const page = await c.newPage();
    await page.goto(`${BASE}/app/polls/`);
    await page.getByRole('combobox', { name: 'סוג' }).selectOption('chair');
    await page.getByRole('button', { name: 'פתיחת הקלפי' }).click();
    await page.getByText('הקלפי נפתחה!').waitFor();
    await c.close();

    const b = await ctx('bob');
    const p2 = await b.newPage();
    await p2.goto(`${BASE}/party/shka/#polls`);
    await p2.locator('.poll-option').first().click();
    await p2.getByRole('button', { name: 'הצבעה' }).click();
    await p2.getByText(/הקול שלך נקלט/).first().waitFor();
    assert.equal(await p2.getByRole('button', { name: 'הצבעה' }).count(), 0, 'אין כפתור הצבעה אחרי שהצבעת');
    await b.close();
  });

  test('טפסים ציבוריים: הצטרפות, רעיון, ובעלים רואים אותם', async () => {
    const b = await ctx(null);
    const page = await b.newPage();
    await page.goto(`${BASE}/party/shka/`);
    await page.getByRole('textbox', { name: /שם לתצוגה/ }).fill('רותי מרמת גן');
    await page.getByLabel(/אפשר להציג את השם/).check();
    await page.getByRole('button', { name: 'אני בפנים!' }).click();
    await page.getByText(/צריך לסמן כדי להמשיך/).waitFor();
    await page.getByLabel(/אני מבין\/ה שזו מפלגה הומוריסטית/).check();
    await page.waitForTimeout(2100);
    await page.getByRole('button', { name: 'אני בפנים!' }).click();
    await page.locator('#join .form-status').filter({ hasText: /./ }).waitFor();
    await page.getByRole('textbox', { name: 'התוכן' }).fill('ברז טחינה בכל כיתה');
    await page.getByRole('button', { name: 'שליחה' }).click();
    await page.getByText(/נשלח!/).first().waitFor();
    await b.close();

    const a = await ctx('alice');
    const p = await a.newPage();
    await p.goto(`${BASE}/app/inbox/`);
    await p.getByText('ברז טחינה בכל כיתה').waitFor();
    await p.getByRole('tab', { name: 'תומכים' }).click();
    await p.getByRole('cell', { name: 'רותי מרמת גן', exact: true }).waitFor();
    await a.close();
  });

  test('משתמש אחר לא רואה את הפניות של המפלגה ולא יכול לערוך אותה', async () => {
    const b = await ctx('bob');
    const page = await b.newPage();
    await page.goto(`${BASE}/app/inbox/`);
    await page.waitForURL(`${BASE}/app/`);
    await page.getByText('עדיין אין לך מפלגה').waitFor();
    await b.close();
  });

  test('ממשק מנהל: מנהל נכנס, משתמש רגיל נחסם', async () => {
    const b = await ctx('bob');
    const p = await b.newPage();
    await p.goto(`${BASE}/admin/`);
    await p.getByText('אין לך הרשאת ניהול').waitFor();
    await b.close();
    const a = await ctx('admin');
    const page = await a.newPage();
    await page.goto(`${BASE}/admin/`);
    await page.getByText('תקינות המערכת').waitFor();
    await shot(page, '09-admin-overview');
    await page.getByRole('tab', { name: /מפלגות/ }).click();
    await page.getByRole('button', { name: 'פרטים' }).first().click();
    await page.getByLabel('מפלגה נבחרת (מוצגת בראש דף הבית)').check();
    await page.getByRole('button', { name: 'שמירת הגדרות ניהול' }).click();
    await page.getByText(/הגדרות הניהול נשמרו/).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /יומן/ }).click();
    await page.getByText('party:update').waitFor();
    await a.close();
    const home = await (await fetch(BASE)).text();
    assert.ok(home.includes('מפלגות נבחרות'));
  });

  test('נייד (375px): בלי גלילה אופקית בדפים המרכזיים', async () => {
    const c = await ctx('alice', { width: 375, height: 800 });
    const page = await c.newPage();
    for (const [path, name] of [['/', 'home'], ['/party/shka/', 'party'], ['/app/', 'dashboard'], ['/app/edit/?step=2', 'emblem'], ['/app/studio/', 'studio'], ['/accessibility/', 'a11y']]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
      await shot(page, `10-mobile-${name}`);
    }
    await c.close();
  });

  test('מצב כהה ונגישות בדף הבית עם מפלגות', async () => {
    const c = await ctx(null);
    const page = await c.newPage();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(BASE);
    await page.locator('.party-card').first().waitFor();
    await shot(page, '11-home-dark');
    await axe(page, 'home-dark');
    await page.getByRole('searchbox', { name: 'חיפוש', exact: true }).fill('אין מפלגה כזאת');
    await page.getByRole('heading', { name: 'לא נמצאו מפלגות' }).waitFor();
    await c.close();
  });

  test('ניווט מקלדת: קישור דילוג ומיקוד גלוי', async () => {
    const c = await ctx(null);
    const page = await c.newPage();
    await page.goto(BASE);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.textContent.trim());
    assert.equal(focused, 'דילוג לתוכן הראשי');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    await c.close();
  });

  test('אין שגיאות JavaScript בקונסול', () => {
    const relevant = consoleErrors.filter((e) => !/favicon|401|404 \(Not Found\)|Failed to load resource/.test(e));
    assert.deepEqual(relevant, []);
  });
});
