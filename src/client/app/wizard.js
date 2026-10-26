// אשף הקמה ועריכה רב-שלבי: זהות, סמל, מצע, הנהגה, קמפיין, פרסום.
import { html, render, raw, formData, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, showFieldErrors, setBusy } from '../core/ui.js';
import { store, savePatch, loadLocalDraft, saveLocalDraft, clearLocalDraft } from './state.js';
import { textField, textArea, selectField, wireCounters } from './fields.js';
import { SERIOUSNESS, LIMITS } from '../../shared/constants.js';
import { SLOGANS, STORIES, NAME_IDEAS, pick, fill } from '../../shared/humor.js';
import { slugify, validatePartyInput } from '../../shared/validate.js';

export const STEPS = [
  { n: 1, label: 'זהות המפלגה', icon: '🪪' },
  { n: 2, label: 'סמל', icon: '🎖️' },
  { n: 3, label: 'מצע', icon: '📜' },
  { n: 4, label: 'הנהגה', icon: '👥' },
  { n: 5, label: 'קמפיין', icon: '📣' },
  { n: 6, label: 'פרסום', icon: '🚀' },
];

const PALETTES = [
  ['#1f4fd1', '#ffc93c'], ['#0f766e', '#f472b6'], ['#b91c1c', '#fde047'], ['#6d28d9', '#34d399'],
  ['#111827', '#f97316'], ['#0369a1', '#e2e8f0'], ['#9a3412', '#fef3c7'], ['#be185d', '#22d3ee'],
];

function progress(current, maxStep, creating) {
  return html`<nav class="wizard-progress" aria-label="שלבי האשף">
    <ol>${STEPS.map((s) => {
    const reachable = !creating && s.n <= Math.max(maxStep, 1);
    const state = s.n === current ? 'current' : s.n < maxStep || (!creating && s.n <= maxStep) ? 'done' : '';
    return html`<li class="${state}">
      ${reachable && s.n !== current
    ? html`<a href="/app/edit/?step=${s.n}" data-nav><span class="step-dot" aria-hidden="true">${s.icon}</span><span class="step-label">${s.label}</span></a>`
    : html`<span ${s.n === current ? raw('aria-current="step"') : ''}><span class="step-dot" aria-hidden="true">${s.icon}</span><span class="step-label">${s.label}</span></span>`}
    </li>`;
  })}</ol>
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow="${current}" aria-label="${`שלב ${current} מתוך 6`}"><span style="width:${Math.round((current / 6) * 100)}%"></span></div>
  </nav>`;
}

// ---------- שלב 1 ----------
function step1(party, categories) {
  const p = party || loadLocalDraft() || {};
  return html`
    <div class="form-grid">
      ${textField({ name: 'name', label: 'שם המפלגה', value: p.name, required: true, max: LIMITS.name[1], suggest: true, hint: 'שם מצחיק, לא שם של מפלגה אמיתית או גוף רשמי.' })}
      ${textField({ name: 'acronym', label: 'ראשי תיבות / אותיות הפתק', value: p.acronym, required: true, max: 5, hint: 'עד 5 אותיות, כמו בפתק. למשל: נמ"ן', suggest: true })}
    </div>
    <p class="slug-preview muted small" aria-live="polite" id="slug-preview"></p>
    ${textField({ name: 'slogan', label: 'סיסמת בחירות', value: p.slogan, max: LIMITS.slogan[1], suggest: true })}
    ${textArea({ name: 'short_desc', label: 'תיאור קצר', value: p.short_desc, rows: 2, max: LIMITS.short_desc[1], hint: 'מופיע בכרטיס המפלגה ובשיתופים.' })}
    ${textArea({ name: 'story', label: 'סיפור ההקמה', value: p.story, rows: 5, max: LIMITS.story[1], suggest: true })}
    <div class="form-grid">
      ${textField({ name: 'founded_on', label: 'תאריך הקמה', type: 'date', value: p.founded_on || new Date().toISOString().slice(0, 10) })}
      ${selectField({ name: 'category', label: 'קטגוריית הומור', value: p.category || categories[0]?.id, options: categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}` })) })}
    </div>
    <fieldset class="field">
      <legend>צבעי המפלגה</legend>
      <div class="color-row">
        <label class="color-pick"><input type="color" name="color_primary" value="${p.color_primary || '#1f4fd1'}"> צבע ראשי</label>
        <label class="color-pick"><input type="color" name="color_secondary" value="${p.color_secondary || '#ffc93c'}"> צבע משני</label>
      </div>
      <div class="palettes" role="group" aria-label="פלטות מוכנות">
        ${PALETTES.map(([a, b], i) => html`<button type="button" class="palette" data-palette="${a},${b}" aria-label="${`פלטה ${i + 1}`}"><span style="background:${a}"></span><span style="background:${b}"></span></button>`)}
      </div>
    </fieldset>
    <fieldset class="field">
      <legend>רמת הרצינות המוצהרת</legend>
      <div class="seriousness" role="radiogroup">
        ${SERIOUSNESS.map((s) => html`<label class="ser-opt"><input type="radio" name="seriousness" value="${s.value}" ${Number(p.seriousness ?? 2) === s.value ? 'checked' : ''}><span>${s.label}</span></label>`)}
      </div>
    </fieldset>`;
}

function wireStep1(form, creating) {
  const preview = form.querySelector('#slug-preview');
  const nameInput = form.querySelector('[name="name"]');
  const check = debounce(async () => {
    const name = nameInput.value.trim();
    if (name.length < 2) { preview.textContent = ''; return; }
    try {
      const r = await api(`/api/me/check?name=${encodeURIComponent(name)}`);
      const slug = store.party?.slug || r.suggestion || 'party';
      preview.textContent = r.name.ok ? `✔ השם פנוי. הכתובת תהיה בערך: ${location.host}/party/${slug}/` : `✖ ${r.name.problem}`;
      preview.className = `slug-preview small ${r.name.ok ? 'ok' : 'bad'}`;
    } catch { preview.textContent = ''; }
  }, 450);
  nameInput.addEventListener('input', check);
  if (nameInput.value) check();
  for (const btn of form.querySelectorAll('[data-palette]')) {
    btn.addEventListener('click', () => {
      const [a, b] = btn.dataset.palette.split(',');
      form.color_primary.value = a;
      form.color_secondary.value = b;
      form.dispatchEvent(new Event('input'));
    });
  }
  if (creating) form.addEventListener('input', debounce(() => saveLocalDraft(formData(form)), 400));
}

function collectStep1(form) {
  const d = formData(form);
  d.seriousness = Number(d.seriousness ?? 2);
  return d;
}

// ---------- הצעות ----------
const SUGGEST = {
  name: () => pick(NAME_IDEAS),
  acronym: (form) => {
    const words = form.name.value.trim().split(/\s+/).filter((w) => /^[א-ת]/.test(w));
    const letters = words.slice(0, 3).map((w) => w[0]).join('');
    return letters.length >= 2 ? `${letters.slice(0, -1)}"${letters.slice(-1)}` : 'נמ"ן';
  },
  slogan: () => pick(SLOGANS),
  story: () => pick(STORIES),
};

function wireSuggestions(form, extra = {}) {
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest]');
    if (!btn) return;
    const name = btn.dataset.suggest;
    const fn = extra[name] || SUGGEST[name];
    if (!fn) return;
    const el = form.querySelector(`[name="${name}"]`);
    el.value = fill(fn(form), { name: form.name?.value || store.party?.name, acronym: form.acronym?.value || store.party?.acronym, slogan: form.slogan?.value || store.party?.slogan });
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    toast('זו רק הצעה. אפשר לערוך אותה, למחוק או לבקש עוד אחת.', 'info', 3000);
  });
}

export { wireSuggestions };

// ---------- האשף ----------
export default async function wizard(view, { navigate, refreshShell }) {
  const creating = !store.party;
  const params = new URLSearchParams(location.search);
  const maxStep = creating ? 1 : Math.max(store.party.wizard_step || 1, store.party.status === 'published' ? 6 : 1);
  let step = creating ? 1 : Math.min(Math.max(Number(params.get('step')) || store.party.wizard_step || 1, 1), 6);
  if (!creating && step > maxStep) step = maxStep;
  const meta = STEPS[step - 1];

  let stepModule = null;
  let content;
  if (step === 1) content = step1(store.party, store.categories);
  else {
    stepModule = await ({
      2: () => import('./step-emblem.js'),
      3: () => import('./step-platform.js'),
      4: () => import('./step-leaders.js'),
      5: () => import('./step-campaign.js'),
      6: () => import('./step-publish.js'),
    })[step]();
  }

  render(view, html`
    ${progress(step, maxStep, creating)}
    <section class="card wizard-card">
      <header class="wizard-head">
        <p class="eyebrow">שלב ${step} מתוך 6</p>
        <h1>${meta.icon} ${creating ? 'מקימים מפלגה: ' : ''}${meta.label}</h1>
        ${creating ? html`<p class="muted">הכול נשמר כטיוטה. אפשר לחזור ולערוך בכל שלב, וכלום לא מתפרסם עד שתחליטו.</p>` : ''}
      </header>
      <form id="wizard-form" novalidate>
        <div id="step-body">${content || ''}</div>
        <div class="wizard-actions">
          ${step > 1 ? html`<a class="btn btn-ghost" href="/app/edit/?step=${step - 1}" data-nav>→ חזרה</a>` : html`<span></span>`}
          <div class="btn-row">
            ${!creating && step < 6 ? html`<button type="button" class="btn btn-ghost" data-save>💾 שמירת טיוטה</button>` : ''}
            ${step < 6 ? html`<button type="submit" class="btn btn-primary">${creating ? 'יצירת הטיוטה והמשך' : 'שמירה והמשך'} ←</button>` : ''}
          </div>
        </div>
      </form>
    </section>`);

  const form = view.querySelector('#wizard-form');
  wireCounters(form);
  let ctl = null;
  if (step === 1) {
    wireStep1(form, creating);
    wireSuggestions(form);
  } else {
    ctl = await stepModule.default(view.querySelector('#step-body'), { form, navigate, refreshShell });
  }

  async function save(advance) {
    const btn = advance ? form.querySelector('button[type="submit"]') : form.querySelector('[data-save]');
    let patch = step === 1 ? collectStep1(form) : ctl.collect();
    if (!patch) return false;
    // ולידציה מוקדמת בדפדפן (השרת מאמת שוב)
    const { errors } = validatePartyInput(patch);
    if (step === 1) {
      if (!patch.name?.trim()) errors.name = 'שם המפלגה: חסר';
      if (!patch.acronym?.trim()) errors.acronym = 'ראשי תיבות: חסר';
    }
    if (Object.keys(errors).length) {
      if (!showFieldErrors(form, flatten(errors))) toast(Object.values(errors)[0], 'error');
      return false;
    }
    showFieldErrors(form, {});
    setBusy(btn, true, 'שומרים…');
    try {
      if (creating) {
        const res = await api('/api/me/party', { method: 'POST', body: patch });
        store.party = res.party;
        clearLocalDraft();
        toast('הטיוטה נוצרה! המפלגה קיימת (בינתיים רק אצלך).', 'success');
        refreshShell();
        await navigate('/app/edit/?step=2');
        return true;
      }
      if (advance && step < 6) patch = { ...patch, wizard_step: Math.max(store.party.wizard_step, step + 1) };
      await savePatch(patch, { quiet: advance });
      refreshShell();
      if (ctl?.afterSave) await ctl.afterSave();
      if (advance) await navigate(`/app/edit/?step=${step + 1}`);
      return true;
    } catch (err) {
      if (err.code === 'party_exists') {
        toast('כבר יש לך מפלגה. מעבירים אותך אליה.', 'info');
        location.href = '/app/';
        return false;
      }
      if (err.fields) showFieldErrors(form, flatten(err.fields));
      toast(err.message, 'error');
      return false;
    } finally {
      setBusy(btn, false);
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); save(true); });
  form.querySelector('[data-save]')?.addEventListener('click', () => save(false));
}

// שגיאות כמו "platform.2.title" מוצגות על השדה המתאים ב-data-field
function flatten(errors) {
  const out = {};
  for (const [k, v] of Object.entries(errors)) out[k] = v;
  return out;
}

export function slugFromName(name) {
  return slugify(name);
}
