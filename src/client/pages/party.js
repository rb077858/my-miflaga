// האתר הציבורי של מפלגה: הצבעות, קיר תומכים, הורדת פתק ודיווח.
import { api } from '../core/api.js';
import { html, render, pageData, $ } from '../core/dom.js';
import { toast, setBusy } from '../core/ui.js';
import { currentUser, login } from '../core/auth.js';
import { formatDate } from '../../shared/cards.js';
import { EMPTY } from '../../shared/humor.js';

const { party, url } = pageData();

// ---------- הצבעות ----------
async function loadPolls() {
  const root = $('#polls-root');
  if (!root) return;
  await currentUser();
  try {
    const data = await api(`/api/p/${encodeURIComponent(root.dataset.slug)}/polls`);
    if (!data.items.length) {
      render(root, html`<p class="empty-inline">${EMPTY.polls}</p>`);
      return;
    }
    render(root, html`${data.items.map((p) => pollCard(p, data.signed_in))}`);
  } catch (err) {
    render(root, html`<p class="error-inline" role="alert">${err.message}</p>`);
  }
}

function pollCard(p, signedIn) {
  const showResults = p.total !== null;
  const max = showResults ? Math.max(1, ...p.options.map((o) => o.votes)) : 1;
  const canVote = p.open && !p.my_vote;
  return html`<article class="poll card" data-poll="${p.id}">
    <header class="poll-head">
      <h3>${p.question}</h3>
      <span class="chip ${p.open ? 'chip-open' : 'chip-closed'}">${p.open ? 'הקלפי פתוחה' : 'הקלפי נסגרה'}</span>
    </header>
    ${p.ends_at && p.open ? html`<p class="muted small">נסגרת ב-${formatDate(p.ends_at)}</p>` : ''}
    ${canVote ? html`
      <form class="poll-form">
        <fieldset><legend class="sr-only">${p.question}</legend>
          ${p.options.map((o) => html`<label class="poll-option"><input type="radio" name="option" value="${o.id}" required> <span>${o.label}</span></label>`)}
        </fieldset>
        ${signedIn
    ? html`<button class="btn btn-primary btn-sm" type="submit">הצבעה</button>`
    : html`<button class="btn btn-primary btn-sm" type="button" data-login-vote>התחברות כדי להצביע</button>`}
      </form>` : ''}
    ${showResults ? html`<ul class="poll-results" aria-label="תוצאות">
      ${p.options.map((o) => html`<li class="${p.my_vote === o.id ? 'mine' : ''}">
        <div class="poll-bar-label"><span>${o.label}${p.my_vote === o.id ? ' ✔ (הקול שלך)' : ''}</span><span>${o.votes} ${o.votes === 1 ? 'קול' : 'קולות'}</span></div>
        <div class="poll-bar" aria-hidden="true"><span style="width:${Math.round((o.votes / max) * 100)}%"></span></div>
      </li>`)}
    </ul><p class="muted small">סה"כ ${p.total} קולות. תוצאות הומוריסטיות, לא סקר מייצג.</p>`
    : (!canVote ? html`<p class="muted small">${p.my_vote ? 'הקול שלך נקלט. התוצאות יוצגו כשהקלפי תיסגר.' : 'התוצאות יוצגו כשהקלפי תיסגר.'}</p>` : '')}
  </article>`;
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.poll-form');
  if (!form) return;
  e.preventDefault();
  const card = form.closest('[data-poll]');
  const choice = form.querySelector('input[name="option"]:checked');
  if (!choice) { toast('צריך לבחור אפשרות. גם "לא יודע" זו לא אפשרות כאן.', 'error'); return; }
  const btn = form.querySelector('button[type="submit"]');
  setBusy(btn, true, 'סופרים…');
  try {
    await api(`/api/polls/${encodeURIComponent(card.dataset.poll)}/vote`, { method: 'POST', body: { option_id: choice.value } });
    toast('הקול שלך נקלט! הקלפי מודה לך.', 'success');
    await loadPolls();
  } catch (err) {
    toast(err.message, 'error');
    setBusy(btn, false);
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-login-vote]')) login(`${location.origin}${location.pathname}#polls`);
});

// ---------- קיר תומכים ----------
async function loadWall() {
  const root = $('#supporters-wall');
  if (!root) return;
  try {
    const data = await api(`/api/p/${encodeURIComponent(root.dataset.slug)}/supporters`);
    if (!data.items.length) { render(root, html`<p class="empty-inline">${EMPTY.supporters}</p>`); return; }
    render(root, html`<ul class="wall" role="list">${data.items.map((s) => html`<li><strong>${s.display_name}</strong>${s.message ? html`<span>${s.message}</span>` : ''}</li>`)}</ul>`);
  } catch (err) {
    render(root, html`<p class="error-inline">${err.message}</p>`);
  }
}

// ---------- דיווח ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-report]');
  if (!btn) return;
  const dlg = document.getElementById('report-dialog');
  dlg.showModal();
  dlg.querySelector('select').focus();
});

// ---------- פתק להורדה ----------
async function openBallot() {
  const { buildSvg, renderBlob, renderPdf, download, fileName } = await import('../studio/export.js');
  const dlg = document.createElement('dialog');
  dlg.className = 'modal modal-wide';
  dlg.setAttribute('aria-labelledby', 'ballot-title');
  render(dlg, html`
    <form method="dialog" class="modal-close-form"><button class="icon-btn modal-x" aria-label="סגירה">✕</button></form>
    <h2 id="ballot-title">פתק הומוריסטי של ${party.name}</h2>
    <p class="muted">תצוגה מקדימה. הפתק מסומן בבירור שאינו פתק הצבעה רשמי.</p>
    <div class="ballot-preview" aria-busy="true"><span class="spinner" aria-hidden="true"></span></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" data-png>הורדת PNG</button>
      <button type="button" class="btn btn-ghost" data-pdf>דף A4 להדפסה (PDF)</button>
    </div>`);
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  const preview = dlg.querySelector('.ballot-preview');
  try {
    const { svg } = await buildSvg('ballot', party, {}, { url });
    preview.innerHTML = svg;
    preview.removeAttribute('aria-busy');
  } catch {
    render(preview, html`<p class="error-inline">לא הצלחנו להכין תצוגה מקדימה.</p>`);
  }
  dlg.querySelector('[data-png]').addEventListener('click', async (e) => {
    setBusy(e.currentTarget, true, 'מדפיסים…');
    try { download(await renderBlob('ballot', party, {}, { url }), fileName(party, 'ballot', 'png')); toast('הפתק ירד. עכשיו רק לא לשים אותו בקלפי אמיתית.', 'success'); } catch { toast('ההורדה נכשלה. נסו שוב.', 'error'); }
    setBusy(e.currentTarget, false);
  });
  dlg.querySelector('[data-pdf]').addEventListener('click', async (e) => {
    setBusy(e.currentTarget, true, 'מכינים PDF…');
    try { download(await renderPdf('ballot-sheet', party, {}, { url }), fileName(party, 'ballots-a4', 'pdf')); toast('קובץ ה-PDF מוכן.', 'success'); } catch { toast('ההורדה נכשלה. נסו שוב.', 'error'); }
    setBusy(e.currentTarget, false);
  });
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-ballot]')) openBallot();
});

loadPolls();
loadWall();
