// קוד שרץ בכל דף: אזור ההתחברות בכותרת, מצב בהיר/כהה, טפסים ציבוריים, שיתוף והעתקה.
import { getAuth, login, logout } from './core/auth.js';
import { html, render, $$, uuid, formData } from './core/dom.js';
import { api } from './core/api.js';
import { toast, showFieldErrors, copyText, share, setBusy } from './core/ui.js';
import { SUPPORTER_THANKS, pick } from '../shared/humor.js';

// ---------- מצב בהיר/כהה ----------
function setupTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const current = () => document.documentElement.getAttribute('data-theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const sync = () => btn.setAttribute('aria-pressed', current() === 'dark' ? 'true' : 'false');
  sync();
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('miflaga:theme', next); } catch { /* מצב פרטי */ }
    sync();
  });
}

// ---------- התחברות בכותרת ----------
function closeMenus() {
  $$('.user-menu[open]').forEach((d) => d.removeAttribute('open'));
}

function renderAuth(slot, user, auth) {
  if (user === undefined) {
    render(slot, html`<span class="auth-loading" aria-label="בודקים התחברות"></span>`);
    return;
  }
  if (!auth) {
    render(slot, html`<button type="button" class="btn btn-sm btn-ghost" disabled title="שירות ההתחברות אינו זמין כרגע">התחברות</button><span class="sr-only">שירות ההתחברות אינו זמין כרגע</span>`);
    return;
  }
  if (!user) {
    render(slot, html`<button type="button" class="btn btn-sm btn-primary" data-login>התחברות</button>`);
    slot.querySelector('[data-login]').addEventListener('click', () => login());
    return;
  }
  const initial = [...(user.name || user.email || '?')][0];
  render(slot, html`
    <details class="user-menu">
      <summary class="user-chip" aria-label="${`תפריט משתמש: ${user.name || user.email}`}">
        ${user.avatar ? html`<img src="${user.avatar}" alt="" width="32" height="32" referrerpolicy="no-referrer">` : html`<span class="avatar-initial" aria-hidden="true">${initial}</span>`}
        <span class="user-name">${user.name || 'החשבון שלי'}</span>
      </summary>
      <div class="menu-panel">
        <p class="menu-email">${user.email}</p>
        <a href="/app/">🗳️ המפלגה שלי</a>
        <a href="${auth.accountUrl()}" rel="noopener">👤 החשבון שלי</a>
        <a href="/admin/" data-admin-link hidden>🛠️ ניהול המערכת</a>
        <button type="button" data-logout>🚪 התנתקות</button>
      </div>
    </details>`);
  slot.querySelector('[data-logout]').addEventListener('click', async () => {
    await logout();
    toast('התנתקת. נתראה בקלפי.', 'info');
    if (location.pathname.startsWith('/app/') || location.pathname.startsWith('/admin/')) location.href = '/';
  });
  const menu = slot.querySelector('.user-menu');
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { menu.removeAttribute('open'); menu.querySelector('summary').focus(); } });
}

function setupAuth() {
  const slot = document.getElementById('auth-slot');
  const auth = getAuth();
  if (!slot) return;
  if (!auth) { renderAuth(slot, null, null); return; }
  auth.onChange((user) => renderAuth(slot, user, auth));
  if (auth.error && auth.error !== 'access_denied') toast('ההתחברות לא הושלמה. אפשר לנסות שוב.', 'error');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) closeMenus();
});

// ---------- טפסים ציבוריים (תומכים, פניות, דיווחים, יצירת קשר) ----------
function setupPublicForms() {
  for (const form of $$('form.js-public-form')) {
    // מפתח ייחודי לכל מילוי: שליחה כפולה של אותו טופס נשמרת פעם אחת בלבד
    let clientKey = uuid();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      const btn = form.querySelector('button[type="submit"]');
      if (btn.disabled) return;
      const data = formData(form);
      const errors = {};
      for (const el of form.querySelectorAll('[required]')) {
        if (el.type === 'checkbox' ? !el.checked : !el.value.trim()) errors[el.name] = el.type === 'checkbox' ? 'צריך לסמן כדי להמשיך' : 'שדה חובה';
        else if (el.minLength > 0 && el.value.trim().length < el.minLength) errors[el.name] = `לפחות ${el.minLength} תווים`;
      }
      if (data.contact && !data.consent && form.querySelector('[name="consent"]:not([required])')) errors.consent = 'אם השארתם פרטי קשר, צריך לאשר את השימוש בהם';
      if (Object.keys(errors).length) {
        showFieldErrors(form, errors);
        if (status) status.textContent = 'יש שדות שצריך לתקן.';
        return;
      }
      showFieldErrors(form, {});
      setBusy(btn, true, 'שולחים…');
      if (status) status.textContent = '';
      try {
        await api(form.dataset.endpoint, { method: 'POST', body: { ...data, client_key: clientKey } });
        const ep = form.dataset.endpoint;
        const msg = ep.endsWith('/support') ? pick(SUPPORTER_THANKS) : ep.endsWith('/report') ? 'הדיווח התקבל. תודה שאתם שומרים על האתר נקי.' : 'נשלח! ההודעה בדרך ליעד, מהר יותר מדואר רשום.';
        form.reset();
        clientKey = uuid();
        if (status) status.textContent = msg;
        toast(msg, 'success');
        form.dispatchEvent(new CustomEvent('submitted', { bubbles: true }));
        const dlg = form.closest('dialog');
        if (dlg) setTimeout(() => dlg.close(), 1200);
      } catch (err) {
        if (err.fields) showFieldErrors(form, err.fields);
        if (status) status.textContent = err.message;
        toast(err.message, 'error');
      } finally {
        setBusy(btn, false);
      }
    });
  }
}

// ---------- שיתוף והעתקה ----------
function setupShare() {
  document.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) { e.preventDefault(); await copyText(copyBtn.dataset.copy); return; }
    const shareBtn = e.target.closest('[data-share]');
    if (shareBtn) {
      e.preventDefault();
      await share({ title: shareBtn.dataset.title, text: shareBtn.dataset.text, url: shareBtn.dataset.url });
    }
  });
}

setupTheme();
setupAuth();
setupPublicForms();
setupShare();
