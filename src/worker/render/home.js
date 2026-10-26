// דף הבית של הפלטפורמה.
import { esc } from '../../shared/escape.js';
import { partyCardHtml } from '../../shared/cards.js';
import { renderEmblem } from '../../shared/emblem.js';
import { EMPTY, SLOGANS } from '../../shared/humor.js';
import { BALLOT_DISCLAIMER } from '../../shared/constants.js';
import { layout } from './layout.js';

const SORTS = [
  { id: 'new', label: 'החדשות ביותר' },
  { id: 'popular', label: 'הכי הרבה תומכים' },
  { id: 'updated', label: 'עודכנו לאחרונה' },
  { id: 'oldest', label: 'הוותיקות ביותר' },
];

function heroBallot() {
  const demo = { name: 'המפלגה שלך', acronym: 'כאן', color_primary: '#1f4fd1', color_secondary: '#ffc93c', emblem: { shape: 'badge', style: 'flat', icon: 'ballot', extras: ['stars'], showLetters: false } };
  return `<div class="hero-ballot" aria-hidden="true">
    <div class="hero-ballot-paper">
      <div class="hero-ballot-emblem">${renderEmblem(demo, { id: 'hero', size: 96 })}</div>
      <div class="hero-ballot-letters">כאן</div>
      <div class="hero-ballot-name">המפלגה שלך</div>
      <div class="hero-ballot-stamp">${esc(BALLOT_DISCLAIMER)}</div>
    </div>
    <div class="hero-ballot-paper back"></div>
  </div>`;
}

export function renderHome({ origin, list, featured, categories, query, announcement }) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const filtered = !!(query.q || query.category);
  const grid = list.items.length
    ? `<ul class="party-grid" id="party-grid" role="list">${list.items.map((p) => `<li>${partyCardHtml(p, { categories: catMap })}</li>`).join('')}</ul>`
    : `<ul class="party-grid" id="party-grid" role="list"></ul>${emptyState(filtered)}`;
  const featuredHtml = featured.length
    ? `<section class="section featured" aria-labelledby="featured-title">
        <div class="container">
          <div class="section-head"><h2 id="featured-title">מפלגות נבחרות</h2><p class="muted">הבחירות של העורכים. לא סקר מייצג, רק טעם טוב.</p></div>
          <ul class="party-grid featured-grid" role="list">${featured.map((p) => `<li>${partyCardHtml(p, { categories: catMap })}</li>`).join('')}</ul>
        </div>
      </section>`
    : '';

  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-text">
      <p class="eyebrow">מערכת הבחירות היחידה שבה כולם מנצחים (בצחוק)</p>
      <h1>כל אחד יכול להקים מפלגה.<br><span class="hl">רוב האנשים פשוט עוד לא ניסו.</span></h1>
      <p class="lead">מקימים מפלגה הומוריסטית בכמה דקות: שם, סמל, מצע מופרך, הנהגה מפוקפקת ופתק הצבעה מצחיק להורדה. בסוף מקבלים אתר משלכם לשתף עם כל הקבוצה.</p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="/app/create/">🗳️ מקימים מפלגה</a>
        <a class="btn btn-ghost btn-lg" href="#parties">לגלות את המפלגות</a>
      </div>
      <p class="hero-note muted">${esc(SLOGANS[(new Date().getDate()) % SLOGANS.length])} · ללא עלות · מפלגה אחת לכל משתמש</p>
    </div>
    ${heroBallot()}
  </div>
</section>

<section class="section how" id="how" aria-labelledby="how-title">
  <div class="container">
    <div class="section-head"><h2 id="how-title">איך מקימים מפלגה בשלושה צעדים</h2><p class="muted">פחות בירוקרטיה ממשרד הרישוי. הבטחה (הומוריסטית).</p></div>
    <ol class="steps">
      <li class="step"><span class="step-num" aria-hidden="true">1</span><h3>מתחברים</h3><p>התחברות אחת דרך Reem.bi. בלי טפסים בשלושה העתקים, בלי חותמת.</p></li>
      <li class="step"><span class="step-num" aria-hidden="true">2</span><h3>בונים את המפלגה</h3><p>שם, סמל, מצע, הנהגה וקמפיין. יש לנו מלא הצעות מצחיקות, ואתם מחליטים מה נכנס.</p></li>
      <li class="step"><span class="step-num" aria-hidden="true">3</span><h3>מפרסמים ומשתפים</h3><p>מקבלים אתר עם קישור קבוע, פתק הצבעה הומוריסטי, פלייר עם QR ופוסטים לרשתות.</p></li>
    </ol>
  </div>
</section>

${featuredHtml}

<section class="section parties" id="parties" aria-labelledby="parties-title">
  <div class="container">
    <div class="section-head">
      <h2 id="parties-title">המפלגות</h2>
      <p class="muted" id="parties-count" aria-live="polite">${list.total ? `${list.total.toLocaleString('he-IL')} מפלגות ציבוריות` : ''}</p>
    </div>
    <form class="filters" id="party-filters" action="/#parties" method="get" role="search" aria-label="חיפוש וסינון מפלגות">
      <div class="field field-search">
        <label for="q">חיפוש</label>
        <input id="q" name="q" type="search" value="${esc(query.q || '')}" placeholder="שם, סיסמה או ראשי תיבות" maxlength="60" autocomplete="off">
      </div>
      <div class="field">
        <label for="category">קטגוריה</label>
        <select id="category" name="category">
          <option value="">כל הקטגוריות</option>
          ${categories.map((c) => `<option value="${esc(c.id)}" ${query.category === c.id ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="sort">מיון</label>
        <select id="sort" name="sort">
          ${SORTS.map((s) => `<option value="${s.id}" ${query.sort === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-secondary" type="submit">חיפוש</button>
    </form>
    <div id="party-results" data-total="${list.total}" data-has-more="${list.has_more ? 1 : 0}">
      ${grid}
    </div>
    <div class="load-more-wrap"><button type="button" class="btn btn-ghost" id="load-more" ${list.has_more ? '' : 'hidden'}>עוד מפלגות</button></div>
  </div>
</section>

<section class="section cta-band" aria-labelledby="cta-title">
  <div class="container cta-inner">
    <h2 id="cta-title">הקלפי פתוחה. המזגן דולק. חסרה רק המפלגה שלך.</h2>
    <a class="btn btn-primary btn-lg" href="/app/create/">מקימים מפלגה</a>
  </div>
</section>`;
  return layout({
    title: '',
    origin,
    canonical: `${origin}/`,
    body,
    announcement,
    scripts: ['/assets/js/home.js'],
    pageData: { categories },
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'המפלגה שלי', url: `${origin}/`, inLanguage: 'he' },
  });
}

export function emptyState(filtered) {
  return `<div class="empty-state" id="empty-state">
    <div class="empty-illustration" aria-hidden="true">🗳️</div>
    <h3>${filtered ? 'לא נמצאו מפלגות' : 'עוד אין כאן מפלגות'}</h3>
    <p>${esc(filtered ? EMPTY.search : EMPTY.homeParties)}</p>
    ${filtered ? '<a class="btn btn-ghost" href="/#parties">ניקוי החיפוש</a>' : '<a class="btn btn-primary" href="/app/create/">להיות המפלגה הראשונה</a>'}
  </div>`;
}
