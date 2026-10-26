// רכיבי ממשק משותפים: הודעות, חלונות אישור, שגיאות שדה והעתקה/שיתוף.
import { html, render } from './dom.js';

export function toast(message, type = 'info', ms = 4500) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const icon = { success: '✅', error: '⚠️', info: '💬' }[type] || '💬';
  render(el, html`<span aria-hidden="true">${icon}</span><span>${message}</span><button type="button" class="toast-x" aria-label="סגירת ההודעה">✕</button>`);
  el.querySelector('.toast-x').addEventListener('click', () => el.remove());
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** חלון אישור נגיש. requireText = המשתמש צריך להקליד את הטקסט כדי לאשר. */
export function confirmDialog({ title, body, confirmLabel = 'אישור', cancelLabel = 'ביטול', danger = false, requireText = null }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', 'cd-title');
    render(dlg, html`
      <h2 id="cd-title">${title}</h2>
      <div class="modal-body">${body}</div>
      ${requireText ? html`<div class="field"><label for="cd-input">כדי לאשר, הקלידו: <strong>${requireText}</strong></label><input id="cd-input" autocomplete="off"></div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok ${requireText ? 'disabled' : ''}>${confirmLabel}</button>
        <button type="button" class="btn btn-ghost" data-cancel>${cancelLabel}</button>
      </div>`);
    document.body.appendChild(dlg);
    const ok = dlg.querySelector('[data-ok]');
    const input = dlg.querySelector('#cd-input');
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    if (input) input.addEventListener('input', () => { ok.disabled = input.value.trim() !== requireText; });
    ok.addEventListener('click', () => done(input ? input.value.trim() : true));
    dlg.querySelector('[data-cancel]').addEventListener('click', () => done(false));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    dlg.showModal();
    (input || dlg.querySelector('[data-cancel]')).focus();
  });
}

/** מציג שגיאות שדה ליד השדות (לפי name), עם aria-invalid ו-aria-describedby. */
export function showFieldErrors(form, fields = {}) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
  let first = null;
  for (const [name, message] of Object.entries(fields || {})) {
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`) || form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const errId = input.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-err'));
    const errEl = errId ? document.getElementById(errId) : null;
    if (errEl) errEl.textContent = message;
    if (!first) first = input;
  }
  if (first) first.focus();
  return first;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('הקישור הועתק. עכשיו רק להדביק בקבוצה המשפחתית.', 'success');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? 'הקישור הועתק.' : `לא הצלחנו להעתיק. הקישור: ${text}`, ok ? 'success' : 'error', 8000);
    return ok;
  }
}

export async function share({ title, text, url, files }) {
  if (files && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ title, text, files }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'aborted'; }
  }
  if (navigator.share && !files) {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'aborted'; }
  }
  if (url) { await copyText(url); return 'copied'; }
  return 'unsupported';
}

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="spinner small" aria-hidden="true"></span> ${label || 'רגע…'}`;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

export function announce(message) {
  const box = document.getElementById('toasts');
  if (box) toast(message, 'info', 3000);
}
