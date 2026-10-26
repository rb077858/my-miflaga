// פניות ותומכים: רק בעל המפלגה רואה אותם. אפשר לסמן, לארכב, לסמן כספאם ולמחוק.
import { html, render } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, confirmDialog } from '../core/ui.js';
import { store } from './state.js';
import { SUBMISSION_KINDS } from '../../shared/constants.js';
import { EMPTY } from '../../shared/humor.js';
import { formatDate } from '../../shared/cards.js';

const STATUS = { new: 'חדשה', read: 'נקראה', archived: 'בארכיון', spam: 'ספאם' };

export default async function inbox(view) {
  let tab = new URLSearchParams(location.search).get('tab') === 'supporters' ? 'supporters' : 'inbox';
  let filter = { status: '', kind: '' };

  render(view, html`
    <header class="page-head"><h1>📬 פניות ותומכים</h1><p class="muted">המידע כאן פרטי. הוא לא מוצג באתר הציבורי, ורק לך יש גישה אליו.</p></header>
    <div class="tabs" role="tablist" aria-label="סוג תוכן">
      <button role="tab" id="tab-inbox" aria-controls="panel" data-tab="inbox">פניות</button>
      <button role="tab" id="tab-supporters" aria-controls="panel" data-tab="supporters">תומכים</button>
    </div>
    <div id="panel" role="tabpanel" tabindex="0"></div>`);
  const panel = view.querySelector('#panel');

  function syncTabs() {
    for (const b of view.querySelectorAll('[data-tab]')) {
      const on = b.dataset.tab === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', `tab-${tab}`);
  }

  async function drawInbox() {
    const q = new URLSearchParams();
    if (filter.status) q.set('status', filter.status);
    if (filter.kind) q.set('kind', filter.kind);
    render(panel, html`<p class="muted" role="status">טוענים…</p>`);
    let items;
    try { items = (await api(`/api/me/inbox?${q}`)).items; } catch (err) { render(panel, html`<p class="error-inline" role="alert">${err.message}</p>`); return; }
    render(panel, html`
      <div class="filters compact">
        <div class="field"><label for="f-status">סטטוס</label><select id="f-status" data-filter="status">
          <option value="">הכול (בלי ספאם)</option>${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}" ${filter.status === k ? 'selected' : ''}>${v}</option>`)}</select></div>
        <div class="field"><label for="f-kind">סוג</label><select id="f-kind" data-filter="kind">
          <option value="">כל הסוגים</option>${['idea', 'question', 'slogan'].map((k) => html`<option value="${k}" ${filter.kind === k ? 'selected' : ''}>${SUBMISSION_KINDS[k]}</option>`)}</select></div>
      </div>
      ${!store.party.allow_submissions ? html`<p class="alert alert-amber">קבלת פניות כבויה כרגע. אפשר להפעיל אותה ב<a href="/app/settings/" data-nav>הגדרות</a>.</p>` : ''}
      ${items.length ? html`<ul class="inbox-list" role="list">${items.map((it) => html`
        <li class="inbox-item card ${it.status === 'new' ? 'is-new' : ''}" data-id="${it.id}">
          <div class="inbox-meta"><span class="chip">${SUBMISSION_KINDS[it.kind] || it.kind}</span><span class="badge">${STATUS[it.status]}</span>
            <time class="muted small" datetime="${new Date(it.created_at).toISOString()}">${formatDate(it.created_at)}</time></div>
          <p class="inbox-body">${it.body}</p>
          ${it.name || it.contact ? html`<p class="muted small">${it.name ? `מאת: ${it.name}` : ''}${it.name && it.contact ? ' · ' : ''}${it.contact ? `לחזרה: ${it.contact}` : ''}</p>` : ''}
          <div class="btn-row tight">
            ${it.status !== 'read' ? html`<button type="button" class="btn btn-ghost btn-sm" data-status="read">סימון כנקראה</button>` : ''}
            ${it.status !== 'archived' ? html`<button type="button" class="btn btn-ghost btn-sm" data-status="archived">לארכיון</button>` : ''}
            ${it.status !== 'spam' ? html`<button type="button" class="btn btn-ghost btn-sm" data-status="spam">ספאם</button>` : html`<button type="button" class="btn btn-ghost btn-sm" data-status="new">לא ספאם</button>`}
            <button type="button" class="btn btn-ghost btn-sm danger" data-delete>מחיקה</button>
          </div>
        </li>`)}</ul>` : html`<p class="empty-inline">${EMPTY.inbox}</p>`}`);
  }

  async function drawSupporters() {
    render(panel, html`<p class="muted" role="status">טוענים…</p>`);
    let items;
    try { items = (await api('/api/me/supporters')).items; } catch (err) { render(panel, html`<p class="error-inline" role="alert">${err.message}</p>`); return; }
    render(panel, html`
      <p class="muted">${items.length} תומכים. ${store.party.show_supporter_names ? 'קיר התומכים פעיל: מוצגים רק מי שסימנו שמותר.' : 'קיר התומכים כבוי, ושום שם לא מוצג בפומבי.'}</p>
      ${items.length ? html`<div class="table-wrap"><table class="table">
        <caption class="sr-only">רשימת התומכים</caption>
        <thead><tr><th scope="col">שם</th><th scope="col">הודעה</th><th scope="col">מותר להציג</th><th scope="col">הצטרפות</th><th scope="col"><span class="sr-only">פעולות</span></th></tr></thead>
        <tbody>${items.map((s) => html`<tr data-sid="${s.id}"><td>${s.display_name}</td><td>${s.message}</td><td>${s.public_ok ? 'כן' : 'לא'}</td><td>${formatDate(s.created_at)}</td>
          <td><button type="button" class="btn btn-ghost btn-sm danger" data-del-sup aria-label="${`הסרת ${s.display_name}`}">הסרה</button></td></tr>`)}</tbody>
      </table></div>` : html`<p class="empty-inline">${EMPTY.supporters}</p>`}`);
  }

  const draw = () => { syncTabs(); return tab === 'inbox' ? drawInbox() : drawSupporters(); };

  view.addEventListener('click', async (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; history.replaceState(null, '', `/app/inbox/?tab=${tab}`); draw(); return; }
    const item = e.target.closest('[data-id]');
    const statusBtn = e.target.closest('[data-status]');
    if (item && statusBtn) {
      try { await api(`/api/me/inbox/${item.dataset.id}`, { method: 'PATCH', body: { status: statusBtn.dataset.status } }); toast('עודכן.', 'success', 1500); drawInbox(); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (item && e.target.closest('[data-delete]')) {
      if (!(await confirmDialog({ title: 'למחוק את הפנייה?', body: 'המחיקה סופית.', confirmLabel: 'מחיקה', danger: true }))) return;
      try { await api(`/api/me/inbox/${item.dataset.id}`, { method: 'DELETE' }); toast('נמחק.', 'success', 1500); drawInbox(); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const row = e.target.closest('[data-sid]');
    if (row && e.target.closest('[data-del-sup]')) {
      if (!(await confirmDialog({ title: 'להסיר את התומך?', body: 'השם וההודעה יימחקו.', confirmLabel: 'הסרה', danger: true }))) return;
      try { await api(`/api/me/supporters/${row.dataset.sid}`, { method: 'DELETE' }); toast('הוסר.', 'success', 1500); drawSupporters(); } catch (err) { toast(err.message, 'error'); }
    }
  });
  view.addEventListener('change', (e) => {
    const f = e.target.dataset.filter;
    if (!f) return;
    filter = { ...filter, [f]: e.target.value };
    drawInbox();
  });
  view.querySelector('.tabs').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    tab = tab === 'inbox' ? 'supporters' : 'inbox';
    draw();
    view.querySelector(`[data-tab="${tab}"]`).focus();
  });
  await draw();
}
