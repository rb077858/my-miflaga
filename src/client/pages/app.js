// האזור האישי (/app/...): בדיקת התחברות, ניתוב פנימי ושלד עם תפריט צד.
import { currentUser, login } from '../core/auth.js';
import { html, render, raw } from '../core/dom.js';
import { toast } from '../core/ui.js';
import { store, loadMe, statusInfo, adminPartyFromUrl, loadAdminParty, exitAdminMode } from '../app/state.js';
import { renderEmblem } from '../../shared/emblem.js';
import { MESSAGES } from '../../shared/humor.js';

const root = document.getElementById('app-root');

const ROUTES = {
  '/app/': () => import('../app/dashboard.js'),
  '/app/create/': () => import('../app/wizard.js'),
  '/app/edit/': () => import('../app/wizard.js'),
  '/app/studio/': () => import('../app/studio.js'),
  '/app/inbox/': () => import('../app/inbox.js'),
  '/app/polls/': () => import('../app/polls.js'),
  '/app/settings/': () => import('../app/settings.js'),
  '/app/preview/': () => import('../app/preview.js'),
};

const ADMIN_NAV = [
  ['/app/edit/', '✏️', 'עריכת המפלגה'],
  ['/app/preview/', '👀', 'צפייה באתר המפלגה'],
];
const ADMIN_ROUTES = new Set(['/app/edit/', '/app/preview/']);

const NAV = [
  ['/app/', '🏠', 'סקירה'],
  ['/app/edit/', '✏️', 'עריכת המפלגה'],
  ['/app/studio/', '🎨', 'סטודיו עיצוב'],
  ['/app/inbox/', '📬', 'פניות ותומכים'],
  ['/app/polls/', '🗳️', 'בחירות פנימיות'],
  ['/app/settings/', '⚙️', 'פרסום והגדרות'],
  ['/app/preview/', '👀', 'תצוגה מקדימה'],
];

function shell() {
  const party = store.party;
  const st = statusInfo();
  const adminMode = !!store.adminPartyId;
  const nav = adminMode ? ADMIN_NAV : party ? NAV : NAV.slice(0, 1);
  return html`
  ${adminMode ? html`<div class="container"><div class="alert alert-amber admin-mode-bar" role="note">
    <span>🛠️ <strong>מצב מנהל:</strong> צופה ועורך את "${party.name}"${store.adminOwner?.email ? ` (של ${store.adminOwner.email})` : ''}. כל שמירה נרשמת ביומן.</span>
    <button type="button" class="btn btn-ghost btn-sm" data-exit-admin>יציאה לממשק הניהול</button>
  </div></div>` : ''}
  <div class="container app-layout">
    <aside class="app-side" aria-label="תפריט האזור האישי">
      ${party ? html`<div class="side-party">
        <div class="side-emblem">${raw(renderEmblem(party, { id: 'side', size: 48 }))}</div>
        <div><p class="side-name">${party.name}</p><span class="badge badge-${st.tone}">${st.label}</span></div>
      </div>` : ''}
      <nav><ul class="side-nav">
        ${nav.map(([href, icon, label]) => html`<li><a href="${href}" data-nav><span aria-hidden="true">${icon}</span> ${label}</a></li>`)}
        ${store.isAdmin ? html`<li><a href="/admin/"><span aria-hidden="true">🛠️</span> ניהול המערכת</a></li>` : ''}
      </ul></nav>
    </aside>
    <div class="app-main" id="view" tabindex="-1"></div>
  </div>`;
}

function markActive() {
  for (const a of root.querySelectorAll('.side-nav a')) {
    const active = a.getAttribute('href') === location.pathname || (a.getAttribute('href') === '/app/edit/' && location.pathname === '/app/create/');
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

let renderToken = 0;

export async function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  await route();
}

async function route() {
  const token = ++renderToken;
  let path = location.pathname;
  if (!path.endsWith('/')) path += '/';
  if (store.adminPartyId && !ADMIN_ROUTES.has(path)) { history.replaceState(null, '', '/app/edit/'); path = '/app/edit/'; }
  if (path === '/app/create/' && store.party) { history.replaceState(null, '', `/app/edit/${location.search}`); path = '/app/edit/'; }
  if (path !== '/app/' && path !== '/app/create/' && !store.party) { history.replaceState(null, '', '/app/'); path = '/app/'; }
  render(root, shell());
  markActive();
  const view = document.getElementById('view');
  const loader = ROUTES[path];
  if (!loader) {
    render(view, html`<div class="empty-state"><h1>העמוד לא נמצא</h1><p>אולי הוא בוועדה.</p><a class="btn btn-primary" href="/app/" data-nav>לסקירה</a></div>`);
    return;
  }
  render(view, html`<div class="app-loading" role="status"><span class="spinner" aria-hidden="true"></span> טוענים…</div>`);
  try {
    const mod = await loader();
    if (token !== renderToken) return;
    await mod.default(view, { navigate, refreshShell });
    const h1 = view.querySelector('h1');
    document.title = `${h1 ? h1.textContent : 'האזור האישי'} · המפלגה שלי`;
    view.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  } catch (err) {
    console.error(err);
    render(view, html`<div class="empty-state"><h1>משהו השתבש</h1><p>${err.message || MESSAGES.error}</p><button class="btn btn-primary" type="button" data-reload>רענון</button></div>`);
  }
}

function refreshShell() {
  const side = root.querySelector('.app-side');
  if (!side) return;
  const tmp = document.createElement('div');
  render(tmp, shell());
  side.replaceWith(tmp.querySelector('.app-side'));
  markActive();
}

root.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-nav]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});
window.addEventListener('popstate', route);
root.addEventListener('click', (e) => {
  if (e.target.closest('[data-reload]')) location.reload();
  if (e.target.closest('[data-exit-admin]')) { exitAdminMode(); location.href = '/admin/#parties'; }
});

async function start() {
  const user = await currentUser();
  if (user === false) {
    render(root, html`<section class="section"><div class="container narrow center">
      <div class="empty-illustration" aria-hidden="true">🔌</div>
      <h1>שירות ההתחברות אינו זמין כרגע</h1>
      <p class="lead">לא הצלחנו להתחבר ל-Reem.bi. האתר הציבורי ממשיך לעבוד, ואת האזור האישי אפשר לנסות שוב בעוד כמה דקות.</p>
      <button class="btn btn-primary" type="button" data-reload>לנסות שוב</button>
    </div></section>`);
    return;
  }
  if (!user) {
    const creating = location.pathname.startsWith('/app/create');
    render(root, html`<section class="section"><div class="container narrow center login-gate">
      <div class="empty-illustration" aria-hidden="true">🗳️</div>
      <h1>${creating ? 'מקימים מפלגה? קודם מתחברים.' : 'האזור האישי'}</h1>
      <p class="lead">${MESSAGES.loginNeeded}</p>
      <button class="btn btn-primary btn-lg" type="button" data-login-gate>התחברות דרך Reem.bi</button>
      <p class="muted small">חשבון אחד לכל האתרים של Reem.bi. אנחנו לא מקבלים ולא שומרים סיסמאות.</p>
    </div></section>`);
    root.querySelector('[data-login-gate]').addEventListener('click', () => login());
    return;
  }
  try {
    await loadMe();
  } catch (err) {
    render(root, html`<section class="section"><div class="container narrow center"><h1>לא הצלחנו לטעון את האזור האישי</h1><p class="lead">${err.message}</p>
      ${err.status === 401 ? html`<button class="btn btn-primary" type="button" data-relogin>התחברות מחדש</button>` : html`<button class="btn btn-primary" type="button" data-reload>לנסות שוב</button>`}</div></section>`);
    root.querySelector('[data-relogin]')?.addEventListener('click', () => login());
    return;
  }
  const adminId = adminPartyFromUrl();
  if (adminId) {
    if (!store.isAdmin) {
      exitAdminMode();
    } else {
      try {
        await loadAdminParty(adminId);
      } catch (err) {
        exitAdminMode();
        toast(err.message, 'error');
        location.href = '/admin/#parties';
        return;
      }
    }
  }
  await route();
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.status !== undefined) toast(e.reason.message, 'error');
});

start();
