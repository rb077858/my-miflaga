// ממשק הניהול (/admin/). מוטמע גם בדשבורד של Reem.bi. כל פעולה נבדקת בשרת מול ADMIN_EMAILS.
import { currentUser, login } from '../core/auth.js';
import { html, render, raw, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, confirmDialog, setBusy } from '../core/ui.js';
import { renderEmblem } from '../../shared/emblem.js';
import { formatDate } from '../../shared/cards.js';
import { REPORT_REASONS, SUBMISSION_KINDS } from '../../shared/constants.js';
import { TEMPLATES } from '../studio/templates.js';

const root = document.getElementById('app-root');

const TABS = [
  ['overview', '📊 סקירה ותקינות'],
  ['parties', '🏛️ מפלגות'],
  ['reports', '🚩 דיווחים'],
  ['submissions', '📬 פניות'],
  ['content', '🗂️ קטגוריות ותבניות'],
  ['log', '📒 יומן פעולות'],
];

const MOD = { ok: 'תקינה', hidden: 'מוסתרת', blocked: 'חסומה' };
const dt = (ts) => (ts ? new Date(ts).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '');

let tab = location.hash.replace('#', '') || 'overview';

function shell() {
  render(root, html`<div class="container admin">
    <header class="page-head"><h1>🛠️ ניהול המערכת</h1><p class="muted">משתמשים, תוכניות ומנויים מנוהלים ב-<a href="https://login.reembir.com/admin#sites/party-maker" target="_blank" rel="noopener">דשבורד Reem.bi</a>. כאן מנהלים את התוכן של האתר.</p></header>
    <div class="tabs admin-tabs" role="tablist" aria-label="אזורי ניהול">${TABS.map(([id, label]) => html`<button role="tab" id="t-${id}" data-tab="${id}" aria-controls="admin-panel" aria-selected="${tab === id ? 'true' : 'false'}" tabindex="${tab === id ? '0' : '-1'}">${label}</button>`)}</div>
    <div id="admin-panel" role="tabpanel" aria-labelledby="t-${tab}" tabindex="0"></div>
  </div>`);
}

const panel = () => document.getElementById('admin-panel');

// ---------- סקירה ----------
async function overview() {
  const d = await api('/api/admin/overview');
  const c = d.counts;
  const stats = [
    ['מפלגות', c.parties], ['מפורסמות', c.published], ['טיוטות', c.drafts], ['חדשות השבוע', c.newWeek], ['משתמשים', c.users],
    ['תומכים', c.supporters], ['קולות', c.votes], ['פניות חדשות', c.subsNew], ['דיווחים פתוחים', c.reportsOpen], ['מוסתרות', c.hidden], ['חסומות', c.blocked], ['צפיות 7 ימים', c.views7],
  ];
  render(panel(), html`
    <section class="stats-grid">${stats.map(([l, v]) => html`<div class="stat card"><span class="stat-value">${Number(v).toLocaleString('he-IL')}</span><span class="stat-label">${l}</span></div>`)}</section>
    <div class="dash-columns">
      <section class="card"><h2 class="h4">תקינות המערכת</h2>
        <ul class="checks">${d.checks.map((ch) => html`<li class="${ch.ok ? 'ok' : 'bad'}"><span aria-hidden="true">${ch.ok ? '✅' : '⚠️'}</span> <strong>${ch.label}</strong> <span class="muted">${ch.detail}</span><span class="sr-only">${ch.ok ? 'תקין' : 'דורש טיפול'}</span></li>`)}</ul>
        <h3 class="h5">פעולות תחזוקה</h3>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" type="button" data-action="close-expired-polls">סגירת הצבעות שפג מועדן</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="recount">חישוב מוני תומכים</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="prune">ניקוי נתונים ישנים</button>
        </div>
      </section>
      <section class="card"><h2 class="h4">צפיות ב-14 הימים האחרונים</h2>
        ${d.daily_views.length ? html`<ul class="mini-bars" aria-label="צפיות לפי יום">${(() => { const max = Math.max(1, ...d.daily_views.map((x) => x.views)); return d.daily_views.map((x) => html`<li><span class="bar" style="height:${Math.round((x.views / max) * 100)}%" aria-hidden="true"></span><span class="sr-only">${x.day}: ${x.views}</span><span class="day" aria-hidden="true">${x.day.slice(8)}</span></li>`); })()}</ul>` : html`<p class="empty-inline">אין עדיין צפיות.</p>`}
      </section>
    </div>
    <section class="card"><h2 class="h4">שגיאות תפעוליות אחרונות</h2>
      ${d.errors.length ? html`<div class="table-wrap stack-mobile"><table class="table"><thead><tr><th scope="col">זמן</th><th scope="col">נתיב</th><th scope="col">הודעה</th></tr></thead>
      <tbody>${d.errors.map((e) => html`<tr><td data-label="זמן">${dt(e.created_at)}</td><td dir="ltr" data-label="נתיב">${e.route}</td><td data-label="הודעה">${e.message}</td></tr>`)}</tbody></table></div>` : html`<p class="empty-inline">אין שגיאות. שקט חשוד, אבל נקבל.</p>`}
    </section>`);
  panel().addEventListener('click', onAction);
}

async function onAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  setBusy(btn, true);
  try { const r = await api(`/api/admin/actions/${btn.dataset.action}`, { method: 'POST', body: {} }); toast(r.message, 'success'); } catch (err) { toast(err.message, 'error'); }
  setBusy(btn, false);
}

// ---------- מפלגות ----------
let partyFilter = { q: '', status: '', mod: '', featured: '' };

async function parties() {
  render(panel(), html`
    <form class="filters compact" id="pf" role="search">
      <div class="field field-search"><label for="pf-q">חיפוש (שם, נתיב או אימייל הבעלים)</label><input id="pf-q" name="q" type="search" value="${partyFilter.q}"></div>
      <div class="field"><label for="pf-s">פרסום</label><select id="pf-s" name="status"><option value="">הכול</option><option value="published" ${partyFilter.status === 'published' ? 'selected' : ''}>מפורסמות</option><option value="draft" ${partyFilter.status === 'draft' ? 'selected' : ''}>טיוטות</option></select></div>
      <div class="field"><label for="pf-m">ניהול</label><select id="pf-m" name="mod"><option value="">הכול</option>${Object.entries(MOD).map(([k, v]) => html`<option value="${k}" ${partyFilter.mod === k ? 'selected' : ''}>${v}</option>`)}</select></div>
      <div class="check"><input type="checkbox" id="pf-f" name="featured" ${partyFilter.featured ? 'checked' : ''}><label for="pf-f">רק נבחרות</label></div>
    </form>
    <div id="party-table"><p class="muted" role="status">טוענים…</p></div>`);
  const form = panel().querySelector('#pf');
  const reload = debounce(() => {
    partyFilter = { q: form.q.value.trim(), status: form.status.value, mod: form.mod.value, featured: form.featured.checked ? '1' : '' };
    drawPartyTable();
  }, 300);
  form.addEventListener('input', reload);
  form.addEventListener('submit', (e) => { e.preventDefault(); reload(); });
  await drawPartyTable();
}

async function drawPartyTable() {
  const box = document.getElementById('party-table');
  const q = new URLSearchParams(Object.entries(partyFilter).filter(([, v]) => v));
  const { items } = await api(`/api/admin/parties?${q}`);
  if (!items.length) { render(box, html`<p class="empty-inline">לא נמצאו מפלגות.</p>`); return; }
  render(box, html`<p class="muted small">${items.length} מפלגות</p><div class="table-wrap stack-mobile"><table class="table">
    <caption class="sr-only">רשימת המפלגות</caption>
    <thead><tr><th scope="col">מפלגה</th><th scope="col">בעלים</th><th scope="col">פרסום</th><th scope="col">ניהול</th><th scope="col">תומכים</th><th scope="col">דיווחים</th><th scope="col">נוצרה</th><th scope="col"><span class="sr-only">פעולות</span></th></tr></thead>
    <tbody>${items.map((p) => html`<tr>
      <td><div class="cell-party"><span class="mini-emblem">${raw(renderEmblem(p, { id: `a-${p.id}`, size: 32 }))}</span><div><strong>${p.name}</strong>${p.featured ? ' ⭐' : ''}<br><span class="muted small" dir="ltr">/party/${p.slug}/</span></div></div></td>
      <td data-label="בעלים" class="small">${p.owner_email || '—'}</td>
      <td data-label="פרסום">${p.status === 'published' ? (p.visibility === 'public' ? 'ציבורית' : 'פרטית') : 'טיוטה'}</td>
      <td data-label="ניהול"><span class="badge badge-${p.mod_status === 'ok' ? 'green' : p.mod_status === 'blocked' ? 'red' : 'amber'}">${MOD[p.mod_status]}</span>${p.home_hidden ? html`<br><span class="small muted">הוסרה מדף הבית</span>` : ''}</td>
      <td data-label="תומכים">${p.supporters_count}</td>
      <td data-label="דיווחים">${p.open_reports ? html`<span class="badge badge-red">${p.open_reports}</span>` : '0'}</td>
      <td data-label="נוצרה" class="small">${formatDate(p.created_at)}</td>
      <td class="cell-actions"><div class="btn-row tight"><button type="button" class="btn btn-ghost btn-sm" data-open-party="${p.id}">פרטים</button><a class="btn btn-ghost btn-sm" href="/app/preview/?admin_party=${encodeURIComponent(p.id)}">צפייה</a><a class="btn btn-ghost btn-sm" href="/app/edit/?admin_party=${encodeURIComponent(p.id)}&step=1">עריכה</a></div></td>
    </tr>`)}</tbody></table></div>`);
}

async function partyDetail(id) {
  const d = await api(`/api/admin/parties/${id}`);
  const p = d.party;
  const dlg = document.createElement('dialog');
  dlg.className = 'modal modal-wide';
  dlg.setAttribute('aria-labelledby', 'pd-title');
  render(dlg, html`
    <form method="dialog" class="modal-close-form"><button class="icon-btn modal-x" aria-label="סגירה">✕</button></form>
    <div class="pd-head"><span>${raw(renderEmblem(p, { id: 'pd', size: 72 }))}</span><div><h2 id="pd-title">${p.name}</h2>
      <p class="muted small"><span dir="ltr">/party/${p.slug}/</span> · ${p.status === 'published' ? 'מפורסמת' : 'טיוטה'} · ${p.visibility === 'public' ? 'ציבורית' : 'פרטית'} · נוצרה ${formatDate(p.created_at)}</p>
      <p class="small">בעלים: ${d.owner?.email || '—'} ${d.owner?.name ? `(${d.owner.name})` : ''}</p></div></div>
    <div class="btn-row">
      <a class="btn btn-primary btn-sm" href="/app/edit/?admin_party=${encodeURIComponent(p.id)}&step=1">✏️ עריכה מלאה</a>
      <a class="btn btn-ghost btn-sm" href="/app/preview/?admin_party=${encodeURIComponent(p.id)}">👀 צפייה (גם טיוטה ופרטית)</a>
      ${p.status === 'published' && p.visibility === 'public' ? html`<a class="btn btn-ghost btn-sm" href="/party/${encodeURIComponent(p.slug)}/" target="_blank" rel="noopener">באתר הציבורי ↗</a>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-view-subs>פניות למפלגה (${d.counts.submissions})</button>
    </div>
    <h3 class="h5">פרסום וניהול</h3>
    <form id="mod-form" class="form-grid">
      <div class="field"><label for="m-status">מצב ניהול</label><select id="m-status" name="mod_status">${Object.entries(MOD).map(([k, v]) => html`<option value="${k}" ${p.mod_status === k ? 'selected' : ''}>${v}</option>`)}</select>
        <p class="hint">מוסתרת: לא ברשימות ובחיפוש, אבל נגישה בקישור. חסומה: האתר הציבורי מושבת והבעלים לא יכולים לפרסם.</p></div>
      <div class="field"><label for="m-note">הערה לבעלים (מוצגת לו)</label><input id="m-note" name="mod_note" maxlength="500" value="${p.mod_note}"></div>
      <div class="check"><input type="checkbox" id="m-feat" name="featured" ${p.featured ? 'checked' : ''}><label for="m-feat">מפלגה נבחרת (מוצגת בראש דף הבית)</label></div>
      <div class="field"><label for="m-rank">סדר בנבחרות (קטן = קודם)</label><input id="m-rank" name="featured_rank" type="number" min="0" max="999" value="${p.featured_rank}"></div>
      <div class="check"><input type="checkbox" id="m-home" name="home_hidden" ${p.home_hidden ? 'checked' : ''}><label for="m-home">להוריד מרשימת דף הבית (גם אם הבעלים ביקשו להופיע)</label></div>
      <div><button type="submit" class="btn btn-primary btn-sm">שמירת הגדרות ניהול</button></div>
    </form>
    <h3 class="h5">עריכה או הסרה של תוכן ציבורי</h3>
    <form id="content-form">
      <div class="form-grid">
        <div class="field"><label for="c-name">שם</label><input id="c-name" name="name" maxlength="60" value="${p.name}"></div>
        <div class="field"><label for="c-slogan">סיסמה</label><input id="c-slogan" name="slogan" maxlength="120" value="${p.slogan}"></div>
      </div>
      <div class="field"><label for="c-desc">תיאור קצר</label><textarea id="c-desc" name="short_desc" rows="2" maxlength="280">${p.short_desc}</textarea></div>
      <div class="field"><label for="c-story">סיפור הקמה</label><textarea id="c-story" name="story" rows="3" maxlength="3000">${p.story}</textarea></div>
      <div class="field"><label for="c-contact">פרטי קשר</label><textarea id="c-contact" name="contact_text" rows="2" maxlength="300">${p.contact_text}</textarea></div>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary btn-sm">שמירת התוכן</button>
        <button type="button" class="btn btn-ghost btn-sm" data-clear="platform">ריקון המצע (${p.platform.length})</button>
        <button type="button" class="btn btn-ghost btn-sm" data-clear="leaders">ריקון ההנהגה (${p.leaders.length})</button>
        <button type="button" class="btn btn-ghost btn-sm" data-clear="campaign">ריקון טקסטי הקמפיין</button>
      </div>
    </form>
    <h3 class="h5">גלריה (${d.gallery.length})</h3>
    ${d.gallery.length ? html`<ul class="gallery owner" role="list">${d.gallery.map((g) => html`<li data-gimg="${g.id}"><a href="/img/${g.id}" target="_blank" rel="noopener"><img src="/img/${g.id}" alt="${g.title || 'תמונה בגלריה'}" loading="lazy"></a><div class="gallery-meta"><span class="small">${g.title}</span><button type="button" class="icon-btn danger" data-del-gimg aria-label="${`הסרת ${g.title || 'התמונה'}`}">🗑</button></div></li>`)}</ul>` : html`<p class="muted small">אין תמונות בגלריה.</p>`}
    ${d.reports.length ? html`<h3 class="h5">דיווחים</h3><ul class="activity">${d.reports.map((r) => html`<li><span>${REPORT_REASONS[r.reason] || r.reason}: ${r.details || '—'}</span><span class="badge">${r.status}</span></li>`)}</ul>` : ''}
    <h3 class="h5">מחיקה חריגה</h3>
    <p class="muted small">מוחקת את המפלגה ואת כל הנתונים שלה. הבעלים יוכלו להקים מפלגה חדשה. הפעולה נרשמת ביומן עם הסיבה.</p>
    <button type="button" class="btn btn-danger btn-sm" data-remove>מחיקת המפלגה</button>`);
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();

  const patch = async (body, msg) => {
    try { await api(`/api/admin/parties/${id}`, { method: 'PATCH', body }); toast(msg, 'success'); drawPartyTable().catch(() => {}); return true; } catch (err) { toast(err.message, 'error'); return false; }
  };
  dlg.querySelector('#mod-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    patch({ mod_status: f.mod_status.value, mod_note: f.mod_note.value, featured: f.featured.checked, featured_rank: Number(f.featured_rank.value), home_hidden: f.home_hidden.checked }, 'הגדרות הניהול נשמרו ונרשמו ביומן.');
  });
  dlg.querySelector('#content-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    patch({ name: f.name.value, slogan: f.slogan.value, short_desc: f.short_desc.value, story: f.story.value, contact_text: f.contact_text.value }, 'התוכן עודכן ונרשם ביומן.');
  });
  dlg.addEventListener('click', async (e) => {
    const clear = e.target.closest('[data-clear]');
    if (clear) {
      const field = clear.dataset.clear;
      if (!(await confirmDialog({ title: 'לרוקן את התוכן?', body: 'התוכן יוסר מהאתר הציבורי. הפעולה נרשמת ביומן.', confirmLabel: 'ריקון', danger: true }))) return;
      await patch({ [field]: field === 'campaign' ? {} : [] }, 'התוכן הוסר.');
    }
    const gimg = e.target.closest('[data-del-gimg]');
    if (gimg) {
      if (!(await confirmDialog({ title: 'להסיר את התמונה מהגלריה?', body: 'התמונה תימחק מהאתר הציבורי. הפעולה נרשמת ביומן.', confirmLabel: 'הסרה', danger: true }))) return;
      const li = gimg.closest('[data-gimg]');
      try { await api(`/api/admin/images/${li.dataset.gimg}`, { method: 'DELETE' }); li.remove(); toast('התמונה הוסרה ונרשמה ביומן.', 'success'); } catch (err) { toast(err.message, 'error'); }
    }
    if (e.target.closest('[data-view-subs]')) { dlg.close(); tab = 'submissions'; subsPartyId = id; go(); }
    if (e.target.closest('[data-remove]')) {
      const reason = await askReason();
      if (!reason) return;
      try { await api(`/api/admin/parties/${id}`, { method: 'DELETE', body: { reason } }); toast('המפלגה נמחקה ונרשמה ביומן.', 'success'); dlg.close(); drawPartyTable(); } catch (err) { toast(err.message, 'error'); }
    }
  });
}

function askReason() {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', 'r-title');
    render(dlg, html`<h2 id="r-title">סיבת המחיקה</h2><form><div class="field"><label for="r-in">הסיבה תירשם ביומן הביקורת</label><input id="r-in" required minlength="3" maxlength="300"></div>
      <div class="modal-actions"><button class="btn btn-danger" type="submit">מחיקה</button><button class="btn btn-ghost" type="button" data-cancel>ביטול</button></div></form>`);
    document.body.appendChild(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const v = dlg.querySelector('#r-in').value.trim(); if (v.length >= 3) done(v); });
    dlg.querySelector('[data-cancel]').addEventListener('click', () => done(null));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.showModal();
  });
}

// ---------- דיווחים ----------
let reportStatus = 'open';
async function reports() {
  const { items } = await api(`/api/admin/reports?status=${reportStatus}`);
  render(panel(), html`
    <div class="filters compact"><div class="field"><label for="rs">סטטוס</label><select id="rs">${[['open', 'פתוחים'], ['resolved', 'טופלו'], ['dismissed', 'נדחו']].map(([k, v]) => html`<option value="${k}" ${reportStatus === k ? 'selected' : ''}>${v}</option>`)}</select></div></div>
    ${items.length ? html`<ul class="inbox-list" role="list">${items.map((r) => html`<li class="inbox-item card" data-rid="${r.id}">
      <div class="inbox-meta"><span class="chip">${REPORT_REASONS[r.reason] || r.reason}</span><time class="muted small">${dt(r.created_at)}</time></div>
      <p><strong>${r.party_name || 'מפלגה שנמחקה'}</strong> ${r.party_slug ? html`<a class="small" href="/party/${encodeURIComponent(r.party_slug)}/" target="_blank" rel="noopener">לאתר ↗</a>` : ''} ${r.mod_status && r.mod_status !== 'ok' ? html`<span class="badge">${MOD[r.mod_status]}</span>` : ''}</p>
      <p class="inbox-body">${r.details || 'ללא פירוט'}</p>
      <div class="btn-row tight">
        ${r.party_name ? html`<button type="button" class="btn btn-ghost btn-sm" data-open-party="${r.party_id}">טיפול במפלגה</button>` : ''}
        ${r.status !== 'resolved' ? html`<button type="button" class="btn btn-ghost btn-sm" data-rstatus="resolved">סימון כטופל</button>` : ''}
        ${r.status !== 'dismissed' ? html`<button type="button" class="btn btn-ghost btn-sm" data-rstatus="dismissed">דחייה</button>` : ''}
        ${r.status !== 'open' ? html`<button type="button" class="btn btn-ghost btn-sm" data-rstatus="open">פתיחה מחדש</button>` : ''}
      </div></li>`)}</ul>` : html`<p class="empty-inline">אין דיווחים כאן. האתר מתנהג יפה.</p>`}`);
  panel().querySelector('#rs').addEventListener('change', (e) => { reportStatus = e.target.value; reports(); });
}

// ---------- פניות ----------
let subsPartyId = null;
async function submissions() {
  const q = subsPartyId ? `party_id=${encodeURIComponent(subsPartyId)}` : 'scope=site';
  const { items } = await api(`/api/admin/submissions?${q}`);
  render(panel(), html`
    <p class="muted">${subsPartyId ? html`פניות שנשלחו למפלגה מסוימת (הצפייה נרשמת ביומן). <button type="button" class="link-btn" data-site-subs>חזרה לפניות האתר</button>` : 'פניות שנשלחו לצוות האתר: יצירת קשר, משוב ודיווחי נגישות.'}</p>
    ${items.length ? html`<ul class="inbox-list" role="list">${items.map((s) => html`<li class="inbox-item card ${s.status === 'new' ? 'is-new' : ''}" data-sub="${s.id}">
      <div class="inbox-meta"><span class="chip">${SUBMISSION_KINDS[s.kind] || s.kind}</span><span class="badge">${s.status}</span><time class="muted small">${dt(s.created_at)}</time></div>
      <p class="inbox-body">${s.body}</p>
      ${s.name || s.contact ? html`<p class="muted small">${s.name} ${s.contact ? `· ${s.contact}` : ''}</p>` : ''}
      <div class="btn-row tight">
        <button type="button" class="btn btn-ghost btn-sm" data-sstatus="read">נקראה</button>
        <button type="button" class="btn btn-ghost btn-sm" data-sstatus="archived">ארכיון</button>
        <button type="button" class="btn btn-ghost btn-sm" data-sstatus="spam">ספאם</button>
        <button type="button" class="btn btn-ghost btn-sm danger" data-sdel>מחיקה</button>
      </div></li>`)}</ul>` : html`<p class="empty-inline">אין פניות.</p>`}`);
}

// ---------- קטגוריות, תבניות, ספריית טקסטים והודעה כללית ----------
async function content() {
  const [cats, snippets, settings] = await Promise.all([api('/api/admin/categories'), api('/api/admin/snippets'), api('/api/admin/settings')]);
  const disabled = new Set(settings.disabled_templates || []);
  render(panel(), html`
    <section class="card"><h2 class="h4">הודעה כללית באתר</h2>
      <form id="ann-form" class="add-row"><label for="ann" class="sr-only">הודעה</label><input id="ann" maxlength="200" value="${settings.announcement || ''}" placeholder="למשל: גרסה חדשה לסטודיו! (ריק = בלי הודעה)"><button class="btn btn-primary btn-sm" type="submit">שמירה</button></form>
    </section>
    <section class="card"><h2 class="h4">קטגוריות הומור</h2>
      <div class="table-wrap stack-mobile"><table class="table"><thead><tr><th scope="col">מזהה</th><th scope="col">שם</th><th scope="col">אימוג'י</th><th scope="col">סדר</th><th scope="col">פעילה</th><th scope="col"><span class="sr-only">שמירה</span></th></tr></thead>
      <tbody>${cats.items.map((c) => html`<tr data-cat="${c.id}"><td dir="ltr" data-label="מזהה">${c.id}</td>
        <td data-label="שם"><label class="sr-only" for="cl-${c.id}">שם</label><input id="cl-${c.id}" data-k="label" value="${c.label}" maxlength="40"></td>
        <td data-label="אימוג'י"><label class="sr-only" for="ce-${c.id}">אימוג'י</label><input id="ce-${c.id}" data-k="emoji" value="${c.emoji}" maxlength="8" class="narrow"></td>
        <td data-label="סדר"><label class="sr-only" for="cp-${c.id}">סדר</label><input id="cp-${c.id}" data-k="position" type="number" value="${c.position}" class="narrow"></td>
        <td data-label="פעילה"><input type="checkbox" data-k="active" ${c.active ? 'checked' : ''} aria-label="${`קטגוריה ${c.label} פעילה`}"></td>
        <td><button type="button" class="btn btn-ghost btn-sm" data-save-cat>שמירה</button></td></tr>`)}</tbody></table></div>
      <form id="new-cat" class="add-row"><label for="nc-id" class="sr-only">מזהה באנגלית</label><input id="nc-id" placeholder="מזהה (english_id)" dir="ltr" maxlength="20"><label for="nc-label" class="sr-only">שם</label><input id="nc-label" placeholder="שם הקטגוריה" maxlength="40"><label for="nc-emoji" class="sr-only">אימוג'י</label><input id="nc-emoji" placeholder="🙂" class="narrow" maxlength="8"><button class="btn btn-secondary btn-sm" type="submit">הוספה</button></form>
    </section>
    <section class="card"><h2 class="h4">תבניות הסטודיו</h2><p class="muted small">תבנית כבויה לא תופיע לבעלי מפלגות בסטודיו.</p>
      <ul class="check-list">${TEMPLATES.map((t) => html`<li class="check"><input type="checkbox" id="tp-${t.id}" data-tpl="${t.id}" ${disabled.has(t.id) ? '' : 'checked'}><label for="tp-${t.id}">${t.label}</label></li>`)}</ul>
      <button type="button" class="btn btn-primary btn-sm" data-save-tpl>שמירת התבניות</button>
    </section>
    <section class="card"><h2 class="h4">ספריית רעיונות נוספת</h2><p class="muted small">טקסטים שתוסיפו כאן זמינים כהצעות (בנוסף לספרייה המובנית).</p>
      <form id="new-snippet"><div class="form-grid"><div class="field"><label for="sn-kind">סוג</label><select id="sn-kind">${[['slogan', 'סיסמה'], ['promise', 'הבטחה'], ['speech', 'נאום'], ['bio', 'ביוגרפיה'], ['announcement', 'הכרזה'], ['social', 'פוסט']].map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
        <div class="field"><label for="sn-text">טקסט</label><textarea id="sn-text" rows="2" maxlength="2000"></textarea></div></div><button class="btn btn-secondary btn-sm" type="submit">הוספה</button></form>
      ${snippets.items.length ? html`<ul class="activity">${snippets.items.map((s) => html`<li data-snip="${s.id}"><span><span class="chip">${s.kind}</span> ${s.text}</span><span class="btn-row tight"><button type="button" class="btn btn-ghost btn-sm" data-snip-toggle="${s.active ? 0 : 1}">${s.active ? 'השבתה' : 'הפעלה'}</button><button type="button" class="btn btn-ghost btn-sm danger" data-snip-del>מחיקה</button></span></li>`)}</ul>` : ''}
    </section>`);
  const p = panel();
  p.querySelector('#ann-form').addEventListener('submit', async (e) => { e.preventDefault(); try { await api('/api/admin/settings', { method: 'PUT', body: { announcement: p.querySelector('#ann').value } }); toast('ההודעה נשמרה.', 'success'); } catch (err) { toast(err.message, 'error'); } });
  p.querySelector('#new-cat').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/admin/categories', { method: 'POST', body: { id: p.querySelector('#nc-id').value.trim(), label: p.querySelector('#nc-label').value.trim(), emoji: p.querySelector('#nc-emoji').value.trim(), position: 50 } }); toast('נוספה קטגוריה.', 'success'); content(); } catch (err) { toast(err.message, 'error'); }
  });
  p.querySelector('#new-snippet').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/admin/snippets', { method: 'POST', body: { kind: p.querySelector('#sn-kind').value, text: p.querySelector('#sn-text').value } }); toast('נוסף לספרייה.', 'success'); content(); } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------- יומן ----------
async function log() {
  const { items } = await api('/api/admin/log');
  render(panel(), html`${items.length ? html`<div class="table-wrap stack-mobile"><table class="table"><caption class="sr-only">יומן פעולות מנהל</caption>
    <thead><tr><th scope="col">זמן</th><th scope="col">מנהל</th><th scope="col">פעולה</th><th scope="col">יעד</th><th scope="col">פרטים</th></tr></thead>
    <tbody>${items.map((l) => html`<tr><td class="small" data-label="זמן">${dt(l.created_at)}</td><td class="small" data-label="מנהל">${l.admin_email}</td><td dir="ltr" data-label="פעולה">${l.action}</td><td class="small" dir="ltr" data-label="יעד">${l.target_type}${l.target_id ? `:${l.target_id}` : ''}</td><td class="small log-details" data-label="פרטים">${l.details}</td></tr>`)}</tbody></table></div>` : html`<p class="empty-inline">היומן ריק.</p>`}`);
}

const VIEWS = { overview, parties, reports, submissions, content, log };

function syncTabs() {
  for (const b of root.querySelectorAll('[data-tab]')) {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  panel().setAttribute('aria-labelledby', `t-${tab}`);
}

async function go() {
  if (!VIEWS[tab]) tab = 'overview';
  history.replaceState(null, '', `#${tab}`);
  // השלד והלשוניות נבנים פעם אחת, כדי שמעבר בין לשוניות לא יקפיץ את הדף או את שורת הלשוניות
  if (!panel()) shell();
  syncTabs();
  // הפאנל מוחלף בעותק חדש, כדי שמאזינים של לשונית קודמת לא יישארו עליו
  const fresh = panel().cloneNode(false);
  panel().replaceWith(fresh);
  render(panel(), html`<p class="muted" role="status"><span class="spinner small" aria-hidden="true"></span> טוענים…</p>`);
  try {
    await VIEWS[tab]();
  } catch (err) {
    render(panel(), html`<p class="error-inline" role="alert">${err.message}</p>`);
  }
}

root.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; if (tab !== 'submissions') subsPartyId = null; go(); return; }
  const open = e.target.closest('[data-open-party]');
  if (open) { partyDetail(open.dataset.openParty).catch((err) => toast(err.message, 'error')); return; }
  const rs = e.target.closest('[data-rstatus]');
  if (rs) { try { await api(`/api/admin/reports/${rs.closest('[data-rid]').dataset.rid}`, { method: 'PATCH', body: { status: rs.dataset.rstatus } }); toast('עודכן.', 'success'); reports(); } catch (err) { toast(err.message, 'error'); } return; }
  const ss = e.target.closest('[data-sstatus]');
  if (ss) { try { await api(`/api/admin/submissions/${ss.closest('[data-sub]').dataset.sub}`, { method: 'PATCH', body: { status: ss.dataset.sstatus } }); toast('עודכן.', 'success'); submissions(); } catch (err) { toast(err.message, 'error'); } return; }
  if (e.target.closest('[data-sdel]')) {
    if (!(await confirmDialog({ title: 'למחוק את הפנייה?', body: 'המחיקה סופית ונרשמת ביומן.', confirmLabel: 'מחיקה', danger: true }))) return;
    try { await api(`/api/admin/submissions/${e.target.closest('[data-sub]').dataset.sub}`, { method: 'DELETE' }); toast('נמחק.', 'success'); submissions(); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (e.target.closest('[data-site-subs]')) { subsPartyId = null; submissions(); return; }
  const saveCat = e.target.closest('[data-save-cat]');
  if (saveCat) {
    const row = saveCat.closest('[data-cat]');
    const get = (k) => row.querySelector(`[data-k="${k}"]`);
    try { await api('/api/admin/categories', { method: 'POST', body: { id: row.dataset.cat, label: get('label').value, emoji: get('emoji').value, position: Number(get('position').value), active: get('active').checked } }); toast('הקטגוריה נשמרה.', 'success'); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (e.target.closest('[data-save-tpl]')) {
    const off = [...root.querySelectorAll('[data-tpl]')].filter((c) => !c.checked).map((c) => c.dataset.tpl);
    try { await api('/api/admin/settings', { method: 'PUT', body: { disabled_templates: off } }); toast('התבניות נשמרו.', 'success'); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const snip = e.target.closest('[data-snip]');
  if (snip && e.target.closest('[data-snip-toggle]')) {
    try { await api(`/api/admin/snippets/${snip.dataset.snip}`, { method: 'PATCH', body: { active: e.target.closest('[data-snip-toggle]').dataset.snipToggle === '1' } }); content(); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (snip && e.target.closest('[data-snip-del]')) {
    try { await api(`/api/admin/snippets/${snip.dataset.snip}`, { method: 'DELETE' }); content(); } catch (err) { toast(err.message, 'error'); }
  }
});

root.addEventListener('keydown', (e) => {
  const t = e.target.closest('[role="tab"]');
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const ids = TABS.map(([id]) => id);
  let i = ids.indexOf(tab);
  if (e.key === 'ArrowLeft') i = (i + 1) % ids.length; // ב-RTL, שמאלה = הבא
  if (e.key === 'ArrowRight') i = (i - 1 + ids.length) % ids.length;
  if (e.key === 'Home') i = 0;
  if (e.key === 'End') i = ids.length - 1;
  tab = ids[i];
  go().then(() => document.getElementById(`t-${tab}`)?.focus());
});

window.addEventListener('hashchange', () => {
  const next = location.hash.replace('#', '');
  if (next && next !== tab && VIEWS[next]) { tab = next; go(); }
});

async function start() {
  const user = await currentUser();
  if (user === false) {
    render(root, html`<div class="container narrow center section"><h1>שירות ההתחברות אינו זמין</h1><p>נסו שוב בעוד כמה דקות.</p></div>`);
    return;
  }
  if (!user) {
    render(root, html`<div class="container narrow center section"><h1>ניהול המערכת</h1><p class="lead">צריך להתחבר עם חשבון מנהל.</p><button class="btn btn-primary" type="button" data-admin-login>התחברות</button></div>`);
    root.querySelector('[data-admin-login]').addEventListener('click', () => login());
    return;
  }
  try {
    await api('/api/admin/overview');
  } catch (err) {
    render(root, html`<div class="container narrow center section"><div class="empty-illustration" aria-hidden="true">🔒</div><h1>אין לך הרשאת ניהול</h1><p class="lead">${err.status === 403 ? 'החשבון שלך מחובר, אבל הוא לא ברשימת המנהלים.' : err.message}</p><a class="btn btn-primary" href="/">לדף הבית</a></div>`);
    return;
  }
  go();
}

start();
