// רכיבי טופס נגישים: תווית, רמז ושגיאה מקושרים לכל שדה.
import { html, raw } from '../core/dom.js';

export function textField({ name, label, value = '', required = false, max, min, hint, type = 'text', placeholder = '', suggest = false, dir, inputmode, autocomplete = 'off', list }) {
  const id = `f-${name.replace(/[^a-z0-9_-]/gi, '-')}`;
  const described = [hint ? `${id}-hint` : '', `${id}-err`].filter(Boolean).join(' ');
  return html`<div class="field">
    <div class="label-row"><label for="${id}">${label}${required ? raw(' <span class="req" aria-hidden="true">*</span>') : ''}</label>
      ${suggest ? html`<button type="button" class="suggest-btn" data-suggest="${name}" aria-label="${`הצעה מצחיקה ל${label}`}">✨ הצעה</button>` : ''}</div>
    <input id="${id}" name="${name}" type="${type}" value="${value ?? ''}" ${required ? 'required' : ''} ${max ? raw(`maxlength="${max}"`) : ''} ${min ? raw(`minlength="${min}"`) : ''}
      placeholder="${placeholder}" autocomplete="${autocomplete}" aria-describedby="${described}" ${dir ? raw(`dir="${dir}"`) : ''} ${inputmode ? raw(`inputmode="${inputmode}"`) : ''} ${list ? raw(`list="${list}"`) : ''}>
    ${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="field-error" id="${id}-err"></p>
  </div>`;
}

export function textArea({ name, label, value = '', rows = 4, max, hint, required = false, suggest = false, placeholder = '' }) {
  const id = `f-${name.replace(/[^a-z0-9_-]/gi, '-')}`;
  const described = [hint ? `${id}-hint` : '', `${id}-err`, max ? `${id}-count` : ''].filter(Boolean).join(' ');
  return html`<div class="field">
    <div class="label-row"><label for="${id}">${label}${required ? raw(' <span class="req" aria-hidden="true">*</span>') : ''}</label>
      ${suggest ? html`<button type="button" class="suggest-btn" data-suggest="${name}" aria-label="${`הצעה מצחיקה ל${label}`}">✨ הצעה</button>` : ''}</div>
    <textarea id="${id}" name="${name}" rows="${rows}" ${max ? raw(`maxlength="${max}"`) : ''} ${required ? 'required' : ''} placeholder="${placeholder}" aria-describedby="${described}">${value ?? ''}</textarea>
    ${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    ${max ? html`<p class="counter" id="${id}-count" data-counter-for="${id}" aria-live="off">${[...(value || '')].length}/${max}</p>` : ''}
    <p class="field-error" id="${id}-err"></p>
  </div>`;
}

export function selectField({ name, label, value, options, hint }) {
  const id = `f-${name.replace(/[^a-z0-9_-]/gi, '-')}`;
  return html`<div class="field">
    <label for="${id}">${label}</label>
    <select id="${id}" name="${name}" aria-describedby="${hint ? `${id}-hint ` : ''}${id}-err">
      ${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value) ? 'selected' : ''}>${o.label}</option>`)}
    </select>
    ${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="field-error" id="${id}-err"></p>
  </div>`;
}

export function checkField({ name, label, checked, hint }) {
  const id = `f-${name.replace(/[^a-z0-9_-]/gi, '-')}`;
  return html`<div class="check">
    <input type="checkbox" id="${id}" name="${name}" value="1" ${checked ? 'checked' : ''} aria-describedby="${hint ? `${id}-hint ` : ''}${id}-err">
    <label for="${id}">${label}${hint ? html`<span class="hint block" id="${id}-hint">${hint}</span>` : ''}</label>
    <p class="field-error" id="${id}-err"></p>
  </div>`;
}

/** מונה תווים חי לשדות טקסט ארוכים. */
export function wireCounters(root) {
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.id) return;
    const counter = root.querySelector(`[data-counter-for="${el.id}"]`);
    if (counter) counter.textContent = `${[...el.value].length}/${el.maxLength}`;
  });
}
