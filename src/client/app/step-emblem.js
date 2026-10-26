// שלב 2: עורך הסמל — ספריית סמלים, צורה, סגנון, תוספות, צבעים, העלאת תמונה ותצוגה בגדלים שונים.
import { html, render, raw } from '../core/dom.js';
import { toast, setBusy } from '../core/ui.js';
import { store } from './state.js';
import { ICONS } from '../../shared/icons.js';
import { renderEmblem, normalizeEmblem } from '../../shared/emblem.js';
import { EMBLEM_SHAPES, EMBLEM_STYLES, EMBLEM_EXTRAS } from '../../shared/constants.js';
import { uploadFile, ACCEPT_ATTR } from './upload.js';
import { api } from '../core/api.js';

export default function stepEmblem(container) {
  const party = store.party;
  let emblem = normalizeEmblem(party.emblem);
  let colors = { color_primary: party.color_primary, color_secondary: party.color_secondary };
  const iconPreview = (id) => renderEmblem({ ...colors, acronym: '', emblem: { ...emblem, icon: id, image: null, extras: [], showLetters: false, shape: 'circle' } }, { id: `ic-${id}`, size: 52 });

  function current() {
    return { ...party, ...colors, emblem };
  }

  render(container, html`
    <div class="emblem-editor">
      <div class="emblem-controls">
        <fieldset class="field">
          <legend>סמל מהספרייה</legend>
          <div class="icon-grid" role="radiogroup" aria-label="ספריית סמלים">
            ${Object.entries(ICONS).map(([id, icon]) => html`<label class="icon-opt" title="${icon.label}">
              <input type="radio" name="icon" value="${id}" ${emblem.icon === id ? 'checked' : ''}>
              <span class="icon-svg" aria-hidden="true">${raw(iconPreview(id))}</span><span class="sr-only">${icon.label}</span></label>`)}
          </div>
        </fieldset>
        <div class="form-grid">
          <fieldset class="field"><legend>צורה</legend><div class="chips-group">
            ${Object.entries(EMBLEM_SHAPES).map(([id, label]) => html`<label class="chip-opt"><input type="radio" name="shape" value="${id}" ${emblem.shape === id ? 'checked' : ''}><span>${label}</span></label>`)}
          </div></fieldset>
          <fieldset class="field"><legend>סגנון גרפי</legend><div class="chips-group">
            ${Object.entries(EMBLEM_STYLES).map(([id, label]) => html`<label class="chip-opt"><input type="radio" name="style" value="${id}" ${emblem.style === id ? 'checked' : ''}><span>${label}</span></label>`)}
          </div></fieldset>
        </div>
        <fieldset class="field"><legend>רכיבים נוספים (קומפוזיציה)</legend><div class="chips-group">
          ${Object.entries(EMBLEM_EXTRAS).map(([id, label]) => html`<label class="chip-opt"><input type="checkbox" name="extras" value="${id}" ${emblem.extras.includes(id) ? 'checked' : ''}><span>${label}</span></label>`)}
          <label class="chip-opt"><input type="checkbox" name="showLetters" ${emblem.showLetters ? 'checked' : ''}><span>אותיות המפלגה בסמל</span></label>
        </div></fieldset>
        <fieldset class="field"><legend>צבעים</legend>
          <div class="color-row">
            <label class="color-pick"><input type="color" name="color_primary" value="${colors.color_primary}"> צבע ראשי</label>
            <label class="color-pick"><input type="color" name="color_secondary" value="${colors.color_secondary}"> צבע משני</label>
          </div>
        </fieldset>
        <fieldset class="field"><legend>או: תמונה משלכם</legend>
          <p class="hint">PNG, JPEG או WebP. התמונה תוקטן ל-512 פיקסלים ותיחתך לריבוע. רק תמונות שיש לכם זכות להשתמש בהן, ובלי סמלים רשמיים.</p>
          <div class="btn-row">
            <label class="btn btn-ghost btn-sm file-btn">📷 העלאת תמונה<input type="file" accept="${ACCEPT_ATTR}" data-upload class="sr-only"></label>
            <button type="button" class="btn btn-ghost btn-sm" data-remove-image ${emblem.image ? '' : 'hidden'}>הסרת התמונה</button>
          </div>
          <p class="upload-status small" role="status" aria-live="polite"></p>
        </fieldset>
      </div>
      <div class="emblem-preview" aria-label="תצוגה מקדימה של הסמל">
        <div class="preview-main" id="em-main"></div>
        <div class="preview-sizes">
          <div class="size-box light"><div id="em-96"></div><span>96px</span></div>
          <div class="size-box dark"><div id="em-48"></div><span>48px על רקע כהה</span></div>
          <div class="size-box light"><div id="em-24"></div><span>24px</span></div>
        </div>
        <p class="muted small">הסמל ישמש בכל החומרים: האתר, הפתק, הפליירים והפוסטים.</p>
      </div>
    </div>`);

  function update() {
    const p = current();
    container.querySelector('#em-main').innerHTML = renderEmblem(p, { id: 'pv', size: 220 });
    container.querySelector('#em-96').innerHTML = renderEmblem(p, { id: 'p96', size: 96 });
    container.querySelector('#em-48').innerHTML = renderEmblem(p, { id: 'p48', size: 48 });
    container.querySelector('#em-24').innerHTML = renderEmblem(p, { id: 'p24', size: 24 });
    container.querySelector('[data-remove-image]').hidden = !emblem.image;
  }

  container.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'icon') emblem = { ...emblem, icon: t.value };
    else if (t.name === 'shape') emblem = { ...emblem, shape: t.value };
    else if (t.name === 'style') emblem = { ...emblem, style: t.value };
    else if (t.name === 'extras') emblem = { ...emblem, extras: [...container.querySelectorAll('[name="extras"]:checked')].map((x) => x.value) };
    else if (t.name === 'showLetters') emblem = { ...emblem, showLetters: t.checked };
    else return;
    update();
  });
  container.addEventListener('input', (e) => {
    if (e.target.name === 'color_primary' || e.target.name === 'color_secondary') {
      colors = { ...colors, [e.target.name]: e.target.value };
      update();
    }
  });
  container.querySelector('[data-upload]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = container.querySelector('.upload-status');
    status.textContent = 'מעלים…';
    try {
      const res = await uploadFile(file, 'emblem', { max: 512, square: true });
      emblem = { ...emblem, image: res.id };
      status.textContent = 'התמונה הועלתה. אל תשכחו לשמור.';
      update();
    } catch (err) {
      status.textContent = err.message;
      toast(err.message, 'error');
    }
    e.target.value = '';
  });
  container.querySelector('[data-remove-image]').addEventListener('click', async (e) => {
    const old = emblem.image;
    emblem = { ...emblem, image: null };
    update();
    setBusy(e.currentTarget, false);
    if (old && old !== store.party.emblem?.image) api(`/api/me/images/${old}`, { method: 'DELETE' }).catch(() => {});
  });
  update();

  return {
    collect: () => ({ emblem, ...colors }),
  };
}
