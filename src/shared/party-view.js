// תצוגת האתר הציבורי של מפלגה. משמשת את השרת (/party/<slug>/) ואת התצוגה המקדימה באזור האישי.
import { esc, safeColor, readableOn, mix } from './escape.js';
import { renderEmblem } from './emblem.js';
import { paragraphs, formatDate } from './cards.js';
import {
  DISCLAIMER, PLATFORM_TOPICS, PLATFORM_STATUS, PRIORITIES, SERIOUSNESS, REPORT_REASONS,
} from './constants.js';
import { EMPTY } from './humor.js';

const topicLabel = Object.fromEntries(PLATFORM_TOPICS.map((t) => [t.id, t.label]));
const statusLabel = Object.fromEntries(PLATFORM_STATUS.map((t) => [t.value, t.label]));
const priorityLabel = Object.fromEntries(PRIORITIES.map((t) => [t.value, t.label]));

function shareBlock(party, url) {
  if (!party.allow_share) return '';
  const text = `${party.name}${party.slogan ? ` — "${party.slogan}"` : ''}`;
  const enc = encodeURIComponent;
  return `<div class="share-bar" aria-label="שיתוף">
    <button type="button" class="btn btn-primary" data-share data-url="${esc(url)}" data-title="${esc(party.name)}" data-text="${esc(text)}">📣 שיתוף</button>
    <button type="button" class="btn btn-ghost" data-copy="${esc(url)}">🔗 העתקת קישור</button>
    <a class="btn btn-ghost" href="https://wa.me/?text=${enc(`${text} ${url}`)}" target="_blank" rel="noopener noreferrer">וואטסאפ<span class="sr-only"> (נפתח בחלון חדש)</span></a>
    <a class="btn btn-ghost" href="https://t.me/share/url?url=${enc(url)}&amp;text=${enc(text)}" target="_blank" rel="noopener noreferrer">טלגרם<span class="sr-only"> (נפתח בחלון חדש)</span></a>
    <a class="btn btn-ghost" href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}" target="_blank" rel="noopener noreferrer">פייסבוק<span class="sr-only"> (נפתח בחלון חדש)</span></a>
    <a class="btn btn-ghost" href="https://x.com/intent/post?url=${enc(url)}&amp;text=${enc(text)}" target="_blank" rel="noopener noreferrer">X<span class="sr-only"> (נפתח בחלון חדש)</span></a>
  </div>`;
}

function platformHtml(party) {
  if (!party.platform.length) return `<p class="empty-inline">${esc(EMPTY.platform)}</p>`;
  return `<ol class="platform-list">${party.platform.map((item) => `
    <li class="platform-item">
      <div class="platform-item-head">
        <span class="chip">${esc(topicLabel[item.topic] || 'נושא חופשי')}</span>
        <span class="chip chip-status status-${esc(item.status)}">${esc(statusLabel[item.status] || 'הצעה')}</span>
        <span class="chip chip-soft">עדיפות: ${esc(priorityLabel[item.priority] || 'חשוב')}</span>
      </div>
      <h3>${esc(item.title)}</h3>
      <p class="platform-promise">${esc(item.promise)}</p>
      ${item.explanation ? `<div class="platform-explain">${paragraphs(item.explanation)}</div>` : ''}
    </li>`).join('')}</ol>`;
}

function leadersHtml(party) {
  if (!party.leaders.length) return `<p class="empty-inline">${esc(EMPTY.leaders)}</p>`;
  return `<ul class="leaders-grid" role="list">${party.leaders.map((m) => `
    <li class="leader-card">
      ${m.image
    ? `<img class="leader-photo" src="/img/${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" width="96" height="96">`
    : `<div class="leader-photo leader-initial" aria-hidden="true">${esc([...m.name][0] || '?')}</div>`}
      <h3>${esc(m.name)}</h3>
      <p class="leader-role">${esc(m.role)}</p>
      ${m.fictional ? '<span class="chip chip-soft">דמות בדויה</span>' : ''}
      ${m.bio ? `<p class="leader-bio">${esc(m.bio)}</p>` : ''}
    </li>`).join('')}</ul>`;
}

function faqHtml(text) {
  const lines = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length < 2) return '';
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) pairs.push([lines[i], lines[i + 1] || '']);
  return `<div class="faq">${pairs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
}

function formsHtml(party, formToken) {
  const blocks = [];
  if (party.allow_supporters) {
    blocks.push(`<section class="card form-card" aria-labelledby="join-title" id="join">
      <h2 id="join-title">מצטרפים לרשימת התומכים</h2>
      <p class="muted">אנחנו שומרים רק שם לתצוגה והודעה קצרה (לא חובה). בלי טלפון, בלי אימייל, בלי ספאם.</p>
      <form class="js-public-form" data-endpoint="/api/p/${esc(party.slug)}/support" novalidate>
        <input type="hidden" name="form_token" value="${esc(formToken)}">
        <div class="hp" aria-hidden="true"><label>אתר <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="field"><label for="sup-name">שם לתצוגה <span class="req" aria-hidden="true">*</span></label>
          <input id="sup-name" name="display_name" required minlength="2" maxlength="40" autocomplete="nickname" aria-describedby="sup-name-err"><p class="field-error" id="sup-name-err"></p></div>
        <div class="field"><label for="sup-msg">כמה מילים של תמיכה (לא חובה)</label>
          <textarea id="sup-msg" name="message" maxlength="200" rows="2" aria-describedby="sup-msg-err"></textarea><p class="field-error" id="sup-msg-err"></p></div>
        ${party.show_supporter_names ? `<div class="check"><input type="checkbox" id="sup-public" name="public_ok" value="1"><label for="sup-public">אפשר להציג את השם וההודעה שלי בדף המפלגה</label></div>` : ''}
        <div class="check"><input type="checkbox" id="sup-consent" name="consent" value="1" required aria-describedby="sup-consent-err"><label for="sup-consent">אני מבין/ה שזו מפלגה הומוריסטית, ומסכים/ה שהשם יישמר ויוצג לבעלי המפלגה (<a href="/privacy/">פרטיות</a>)</label></div>
        <p class="field-error" id="sup-consent-err"></p>
        <button class="btn btn-primary" type="submit">אני בפנים!</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </section>`);
  }
  if (party.allow_submissions) {
    blocks.push(`<section class="card form-card" aria-labelledby="ask-title" id="ask">
      <h2 id="ask-title">יש לכם מה להגיד?</h2>
      <p class="muted">שולחים רעיון למצע, שאלה או הצעת סיסמה. רק המפלגה רואה את הפניות.</p>
      <form class="js-public-form" data-endpoint="/api/p/${esc(party.slug)}/submit" novalidate>
        <input type="hidden" name="form_token" value="${esc(formToken)}">
        <div class="hp" aria-hidden="true"><label>אתר <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <fieldset class="segmented"><legend>סוג הפנייה</legend>
          <input type="radio" id="k-idea" name="kind" value="idea" checked><label for="k-idea">💡 רעיון למצע</label>
          <input type="radio" id="k-q" name="kind" value="question"><label for="k-q">❓ שאלה</label>
          <input type="radio" id="k-slogan" name="kind" value="slogan"><label for="k-slogan">📣 הצעת סיסמה</label>
        </fieldset>
        <div class="field"><label for="sub-body">התוכן <span class="req" aria-hidden="true">*</span></label>
          <textarea id="sub-body" name="body" required minlength="3" maxlength="1500" rows="4" aria-describedby="sub-body-err"></textarea><p class="field-error" id="sub-body-err"></p></div>
        <div class="field-row">
          <div class="field"><label for="sub-name">שם (לא חובה)</label><input id="sub-name" name="name" maxlength="40" autocomplete="nickname" aria-describedby="sub-name-err"><p class="field-error" id="sub-name-err"></p></div>
          <div class="field"><label for="sub-contact">אימייל או טלפון לתשובה (לא חובה)</label><input id="sub-contact" name="contact" maxlength="100" autocomplete="email" inputmode="email" aria-describedby="sub-contact-err"><p class="field-error" id="sub-contact-err"></p></div>
        </div>
        <div class="check"><input type="checkbox" id="sub-consent" name="consent" value="1" aria-describedby="sub-consent-err"><label for="sub-consent">אם השארתי פרטי קשר: מותר למפלגה להשתמש בהם רק כדי לענות לי</label></div>
        <p class="field-error" id="sub-consent-err"></p>
        <button class="btn btn-primary" type="submit">שליחה</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </section>`);
  }
  return blocks.join('');
}

export function partyBodyHtml({ url, party, categories, formToken, gallery, preview = false }) {
  const p = safeColor(party.color_primary);
  const s = safeColor(party.color_secondary, '#ffc93c');
  const cat = categories.find((c) => c.id === party.category);
  const seriousness = SERIOUSNESS.find((x) => x.value === party.seriousness)?.label;
  const c = party.campaign || {};
  const slogans = String(c.slogans || '').split('\n').map((x) => x.trim()).filter(Boolean);

  const nav = [
    ['about', 'על המפלגה'],
    ['platform', 'המצע'],
    ['leaders', 'ההנהגה'],
    c.speech ? ['speech', 'נאום הפתיחה'] : null,
    (slogans.length || c.announcement || c.faq || gallery.length) ? ['campaign', 'הקמפיין'] : null,
    ['polls', 'בחירות פנימיות'],
    party.allow_supporters ? ['join', 'הצטרפות'] : null,
  ].filter(Boolean);

  const body = `
<div class="party-site" style="--p:${p};--s:${s};--on-p:${readableOn(p)};--on-s:${readableOn(s)};--p-soft:${mix(p, '#ffffff', 0.9)};--p-deep:${mix(p, '#000000', 0.35)}">
  ${preview ? '<div class="preview-bar" role="note">👀 תצוגה מקדימה: כך ייראה האתר הציבורי. הטפסים וההצבעות לא פעילים בתצוגה הזאת.</div>' : ''}
  <div class="disclaimer-bar" role="note"><strong>שימו לב:</strong> ${esc(DISCLAIMER)}.</div>
  <section class="party-hero">
    <div class="container party-hero-inner">
      <div class="party-hero-emblem">${renderEmblem(party, { id: 'hero', size: 200 })}</div>
      <div class="party-hero-text">
        ${party.acronym ? `<p class="party-letters" aria-label="אותיות המפלגה">${esc(party.acronym)}</p>` : ''}
        <h1>${esc(party.name)}</h1>
        ${party.slogan ? `<p class="party-slogan">"${esc(party.slogan)}"</p>` : ''}
        <div class="party-chips">
          ${cat ? `<span class="chip chip-on-dark">${esc(cat.emoji)} ${esc(cat.label)}</span>` : ''}
          ${seriousness ? `<span class="chip chip-on-dark">רמת רצינות: ${esc(seriousness)}</span>` : ''}
          ${typeof party.supporters_count === 'number' ? `<span class="chip chip-on-dark">👥 ${party.supporters_count.toLocaleString('he-IL')} תומכים</span>` : ''}
        </div>
        <div class="party-hero-actions">
          ${party.allow_supporters ? '<a class="btn btn-on-dark btn-lg" href="#join">מצטרפים</a>' : ''}
          <button type="button" class="btn btn-ghost-on-dark btn-lg" data-ballot>🗳️ הורדת פתק הומוריסטי</button>
        </div>
      </div>
    </div>
  </section>
  <nav class="party-nav" aria-label="ניווט בדף המפלגה"><div class="container"><ul>${nav.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></div></nav>

  <div class="container party-layout">
    <div class="party-main">
      <section class="party-section" id="about" aria-labelledby="about-title">
        <h2 id="about-title">על המפלגה</h2>
        ${party.short_desc ? `<p class="lead">${esc(party.short_desc)}</p>` : ''}
        ${c.flagship ? `<div class="flagship" role="note"><span class="flagship-label">הבטחת הדגל</span><p>${esc(c.flagship)}</p></div>` : ''}
        ${party.story ? `<h3>סיפור ההקמה</h3><div class="prose">${paragraphs(party.story)}</div>` : ''}
        ${party.founded_on ? `<p class="muted">נוסדה ב-${esc(formatDate(Date.parse(party.founded_on)))}</p>` : ''}
      </section>

      <section class="party-section" id="platform" aria-labelledby="platform-title">
        <h2 id="platform-title">המצע</h2>
        ${platformHtml(party)}
      </section>

      <section class="party-section" id="leaders" aria-labelledby="leaders-title">
        <h2 id="leaders-title">ההנהגה</h2>
        ${leadersHtml(party)}
      </section>

      ${c.speech ? `<section class="party-section" id="speech" aria-labelledby="speech-title">
        <h2 id="speech-title">נאום הפתיחה</h2>
        <blockquote class="speech">${paragraphs(c.speech)}</blockquote>
      </section>` : ''}

      ${(slogans.length || c.announcement || c.faq || c.social || gallery.length) ? `<section class="party-section" id="campaign" aria-labelledby="campaign-title">
        <h2 id="campaign-title">הקמפיין</h2>
        ${c.announcement ? `<div class="announcement"><h3>הודעת ההכרזה</h3>${paragraphs(c.announcement)}</div>` : ''}
        ${slogans.length ? `<h3>סיסמאות הבחירות</h3><ul class="slogan-list">${slogans.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${gallery.length ? `<h3>גלריית הקמפיין</h3><ul class="gallery" role="list">${gallery.map((g) => `<li><figure><a href="/img/${esc(g.id)}" target="_blank" rel="noopener"><img src="/img/${esc(g.id)}" alt="${esc(g.title || `תוצר קמפיין של ${party.name}`)}" loading="lazy"><span class="sr-only"> (פתיחה בגודל מלא בחלון חדש)</span></a>${g.title ? `<figcaption>${esc(g.title)}</figcaption>` : ''}</figure></li>`).join('')}</ul>` : ''}
        ${c.faq ? `<h3>שאלות ותשובות</h3>${faqHtml(c.faq)}` : ''}
      </section>` : ''}

      <section class="party-section" id="polls" aria-labelledby="polls-title">
        <h2 id="polls-title">בחירות פנימיות</h2>
        <p class="muted small">הצבעות הומוריסטיות של המפלגה. קול אחד לכל משתמש מחובר. אלו לא סקרים מייצגים, וההצבעה אינה חשאית מול המערכת: נשמר מי הצביע כדי למנוע כפילויות, אבל בעלי המפלגה רואים רק סיכומים.</p>
        <div id="polls-root" data-slug="${esc(party.slug)}"><p class="muted">טוענים את הקלפיות…</p></div>
      </section>

      ${party.show_supporter_names ? `<section class="party-section" aria-labelledby="wall-title"><h2 id="wall-title">קיר התומכים</h2><div id="supporters-wall" data-slug="${esc(party.slug)}"><p class="muted">טוענים…</p></div></section>` : ''}
    </div>

    <aside class="party-aside" aria-label="פעולות">
      ${shareBlock(party, url) ? `<section class="card"><h2 class="h4">שתפו את המפלגה</h2>${shareBlock(party, url)}</section>` : ''}
      ${formsHtml(party, formToken)}
      ${party.contact_text ? `<section class="card"><h2 class="h4">יצירת קשר עם המפלגה</h2><div class="prose">${paragraphs(party.contact_text)}</div></section>` : ''}
      <section class="card small-card">
        <p class="muted small">עודכן לאחרונה: ${esc(formatDate(party.updated_at))}</p>
        <button type="button" class="link-btn small" data-report="${esc(party.slug)}">דיווח על תוכן בעייתי</button>
      </section>
    </aside>
  </div>
  <div class="disclaimer-bar bottom" role="note">${esc(DISCLAIMER)}.</div>
</div>

<dialog class="modal" id="report-dialog" aria-labelledby="report-title">
  <form method="dialog" class="modal-close-form"><button class="icon-btn modal-x" aria-label="סגירה">✕</button></form>
  <h2 id="report-title">דיווח על המפלגה</h2>
  <form class="js-public-form" data-endpoint="/api/p/${esc(party.slug)}/report" novalidate>
    <input type="hidden" name="form_token" value="${esc(formToken)}">
    <div class="hp" aria-hidden="true"><label>אתר <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <div class="field"><label for="rep-reason">סיבה</label><select id="rep-reason" name="reason" required aria-describedby="rep-reason-err">
      <option value="">בחירה…</option>${Object.entries(REPORT_REASONS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select><p class="field-error" id="rep-reason-err"></p></div>
    <div class="field"><label for="rep-details">פירוט (לא חובה)</label><textarea id="rep-details" name="details" rows="3" maxlength="1000" aria-describedby="rep-details-err"></textarea><p class="field-error" id="rep-details-err"></p></div>
    <button class="btn btn-primary" type="submit">שליחת דיווח</button>
    <p class="form-status" role="status" aria-live="polite"></p>
  </form>
</dialog>`;
  return body;
}
