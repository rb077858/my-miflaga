// סקירת המפלגה של המשתמש, או הזמנה להקים אחת.
import { html, render, raw } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, setBusy, copyText } from '../core/ui.js';
import { store, statusInfo, publicUrl } from './state.js';
import { renderEmblem } from '../../shared/emblem.js';
import { formatDate } from '../../shared/cards.js';
import { NAME_IDEAS, pick } from '../../shared/humor.js';
import { ensureOgImage } from './og.js';

function welcome(view) {
  render(view, html`
    <section class="welcome card">
      <p class="eyebrow">שלום ${store.me.name || 'אזרח/ית'} 👋</p>
      <h1>עדיין אין לך מפלגה. זה הזמן.</h1>
      <p class="lead">שישה צעדים קצרים, ובסוף יש לך מפלגה עם סמל, מצע, הנהגה, קמפיין ואתר משלה. אפשר לשמור טיוטה ולהמשיך מתי שרוצים.</p>
      <p class="muted">צריך השראה? מה דעתך על "${pick(NAME_IDEAS)}"?</p>
      <a class="btn btn-primary btn-lg" href="/app/create/" data-nav>🗳️ מקימים מפלגה</a>
      <p class="muted small">לכל משתמש מותרת מפלגה אחת. טיוטה נחשבת מפלגה.</p>
    </section>`);
}

const ACTIVITY_EMPTY = 'עוד אין פעולות. השקט שלפני הסערה.';

export default async function dashboard(view) {
  const party = store.party;
  if (!party) { welcome(view); return; }
  const st = statusInfo();
  const s = store.summary || {};
  const url = publicUrl();
  const live = party.status === 'published' && party.mod_status !== 'blocked';
  const steps = [
    ['זהות', !!party.name && !!party.acronym && !!party.slogan && !!party.short_desc, 1],
    ['סמל', !!party.emblem?.icon, 2],
    ['מצע', party.platform.length > 0, 3],
    ['הנהגה', party.leaders.length > 0, 4],
    ['קמפיין', !!(party.campaign?.flagship || party.campaign?.speech), 5],
    ['פרסום', party.status === 'published', 6],
  ];
  const done = steps.filter((x) => x[1]).length;

  render(view, html`
    <header class="dash-head card" style="--p:${party.color_primary};--s:${party.color_secondary}">
      <div class="dash-emblem">${raw(renderEmblem(party, { id: 'dash', size: 120 }))}</div>
      <div class="dash-title">
        <p class="eyebrow">המפלגה שלך</p>
        <h1>${party.name}</h1>
        ${party.slogan ? html`<p class="muted">"${party.slogan}"</p>` : ''}
        <p><span class="badge badge-${st.tone}">${st.label}</span>
          ${party.mod_status !== 'ok' && party.mod_note ? html` <span class="muted small">הערת ההנהלה: ${party.mod_note}</span>` : ''}</p>
      </div>
      <div class="dash-actions">
        ${live && party.visibility === 'public'
    ? html`<a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">לאתר הציבורי ↗</a>
           <button class="btn btn-ghost" type="button" data-copy-url>🔗 העתקת קישור</button>`
    : html`<a class="btn btn-primary" href="/app/settings/" data-nav>${party.status === 'draft' ? 'לפרסום המפלגה' : 'הגדרות פרסום'}</a>`}
        <a class="btn btn-ghost" href="/app/preview/" data-nav>👀 תצוגה מקדימה</a>
      </div>
    </header>

    ${party.mod_status === 'blocked' ? html`<div class="alert alert-red" role="alert">המפלגה הושעתה על ידי צוות האתר ואינה מוצגת לציבור. אפשר לערוך אותה או לפנות אלינו דרך <a href="/contact/">יצירת קשר</a>.</div>` : ''}

    <section class="progress-card card" aria-labelledby="prog-title">
      <div class="progress-head"><h2 id="prog-title" class="h4">התקדמות ההקמה</h2><span>${done} מתוך 6</span></div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${done}" aria-label="התקדמות ההקמה"><span style="width:${Math.round((done / 6) * 100)}%"></span></div>
      <ol class="mini-steps">${steps.map(([label, ok, n]) => html`<li class="${ok ? 'ok' : ''}"><a href="/app/edit/?step=${n}" data-nav>${ok ? '✔' : n} ${label}</a></li>`)}</ol>
    </section>

    <section class="stats-grid" aria-label="נתונים">
      <div class="stat card"><span class="stat-value">${(s.views_7d ?? 0).toLocaleString('he-IL')}</span><span class="stat-label">צפיות ב-7 ימים</span></div>
      <div class="stat card"><span class="stat-value">${(s.views_total ?? 0).toLocaleString('he-IL')}</span><span class="stat-label">צפיות מאז ומעולם</span></div>
      <div class="stat card"><span class="stat-value">${party.allow_supporters ? (s.supporters ?? 0).toLocaleString('he-IL') : '—'}</span><span class="stat-label">${party.allow_supporters ? 'תומכים' : 'הצטרפות כבויה'}</span></div>
      <div class="stat card"><a href="/app/inbox/" data-nav class="stat-link"><span class="stat-value">${s.inbox_new ?? 0}</span><span class="stat-label">פניות חדשות</span></a></div>
      <div class="stat card"><a href="/app/polls/" data-nav class="stat-link"><span class="stat-value">${s.open_polls ?? 0}</span><span class="stat-label">הצבעות פתוחות</span></a></div>
    </section>
    <p class="muted small">צפיות נספרות בכל טעינה של הדף הציבורי, בלי בוטים מוכרים. זה מספר משוער, לא מדד מדויק.</p>

    <div class="dash-columns">
      <section class="card" aria-labelledby="quick-title">
        <h2 id="quick-title" class="h4">פעולות מהירות</h2>
        <ul class="quick-grid">
          <li><a href="/app/edit/?step=1" data-nav>✏️ פרטי המפלגה</a></li>
          <li><a href="/app/edit/?step=2" data-nav>🎖️ הסמל</a></li>
          <li><a href="/app/edit/?step=3" data-nav>📜 המצע</a></li>
          <li><a href="/app/edit/?step=4" data-nav>👥 ההנהגה</a></li>
          <li><a href="/app/edit/?step=5" data-nav>📣 הקמפיין</a></li>
          <li><a href="/app/studio/" data-nav>🎨 סטודיו עיצוב</a></li>
          <li><a href="/app/polls/" data-nav>🗳️ הצבעות</a></li>
          <li><a href="/app/settings/" data-nav>🔒 פרטיות ופרסום</a></li>
        </ul>
        <h3 class="h5">הורדות מהירות</h3>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" type="button" data-dl="ballot:png">פתק (PNG)</button>
          <button class="btn btn-ghost btn-sm" type="button" data-dl="ballot-sheet:pdf">פתקים להדפסה (PDF)</button>
          <button class="btn btn-ghost btn-sm" type="button" data-dl="flyer:pdf">פלייר A4 (PDF)</button>
        </div>
      </section>
      <section class="card" aria-labelledby="act-title">
        <h2 id="act-title" class="h4">פעולות אחרונות</h2>
        ${s.activity?.length
    ? html`<ul class="activity">${s.activity.map((a) => html`<li><span>${a.action}</span><time class="muted small" datetime="${new Date(a.created_at).toISOString()}">${formatDate(a.created_at)}</time></li>`)}</ul>`
    : html`<p class="empty-inline">${ACTIVITY_EMPTY}</p>`}
      </section>
    </div>`);

  view.querySelector('[data-copy-url]')?.addEventListener('click', () => copyText(url));
  for (const btn of view.querySelectorAll('[data-dl]')) {
    btn.addEventListener('click', async () => {
      const [tpl, kind] = btn.dataset.dl.split(':');
      setBusy(btn, true, 'מכינים…');
      try {
        const ex = await import('../studio/export.js');
        const blob = kind === 'pdf' ? await ex.renderPdf(tpl, party, {}, { url }) : await ex.renderBlob(tpl, party, {}, { url });
        ex.download(blob, ex.fileName(party, tpl, kind));
        toast('הקובץ ירד בהצלחה.', 'success');
      } catch (err) {
        toast('ההפקה נכשלה. נסו שוב או השתמשו בדפדפן עדכני.', 'error');
      } finally {
        setBusy(btn, false);
      }
    });
  }
  // תמונת שיתוף לרשתות: נוצרת אוטומטית אם חסרה
  if (party.status === 'published' && !party.og_image_id) ensureOgImage().catch(() => {});
}
