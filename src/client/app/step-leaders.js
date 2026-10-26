// שלב 4: הנהגת המפלגה. כל חבר הוא דמות בדויה מסומנת, או אדם אמיתי שאישר להופיע.
import { html, render } from '../core/dom.js';
import { toast, confirmDialog } from '../core/ui.js';
import { store } from './state.js';
import { ROLE_PRESETS, LIMITS } from '../../shared/constants.js';
import { ROLE_BIOS, EMPTY, pick } from '../../shared/humor.js';
import { uploadFile, ACCEPT_ATTR } from './upload.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export default function stepLeaders(container) {
  let items = (store.party.leaders || []).map((x) => ({ ...x }));

  function itemHtml(m, i) {
    const n = i + 1;
    return html`<li class="editor-item card" data-index="${i}">
      <div class="editor-item-head">
        <div class="leader-head">
          ${m.image ? html`<img class="leader-thumb" src="/img/${m.image}" alt="" width="48" height="48">` : html`<span class="leader-thumb initial" aria-hidden="true">${[...(m.name || '?')][0]}</span>`}
          <h2 class="h5">${m.name || `חבר/ת הנהלה ${n}`}${m.role ? ` · ${m.role}` : ''}</h2>
        </div>
        <div class="btn-row tight">
          <button type="button" class="icon-btn" data-move="-1" aria-label="${`הקדמת ${m.name || `חבר ${n}`} בסדר ההופעה`}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="icon-btn" data-move="1" aria-label="${`הזזת ${m.name || `חבר ${n}`} אחורה בסדר ההופעה`}" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="icon-btn danger" data-remove aria-label="${`הסרת ${m.name || `חבר ${n}`}`}">🗑</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="ln-${i}">שם תצוגה <span class="req" aria-hidden="true">*</span></label>
          <input id="ln-${i}" data-key="name" name="leaders.${i}.name" value="${m.name}" maxlength="50" aria-describedby="ln-${i}-err"><p class="field-error" id="ln-${i}-err"></p></div>
        <div class="field"><label for="lr-${i}">תפקיד <span class="req" aria-hidden="true">*</span></label>
          <input id="lr-${i}" data-key="role" name="leaders.${i}.role" value="${m.role}" maxlength="60" list="role-presets" aria-describedby="lr-${i}-hint lr-${i}-err">
          <p class="hint" id="lr-${i}-hint">אפשר לבחור מהרשימה או לכתוב תפקיד משלכם.</p><p class="field-error" id="lr-${i}-err"></p></div>
      </div>
      <div class="field"><div class="label-row"><label for="lb-${i}">ביוגרפיה משעשעת</label><button type="button" class="suggest-btn" data-suggest-bio aria-label="${`הצעה לביוגרפיה של חבר ${n}`}">✨ הצעה</button></div>
        <textarea id="lb-${i}" data-key="bio" name="leaders.${i}.bio" rows="2" maxlength="600" aria-describedby="lb-${i}-err">${m.bio}</textarea><p class="field-error" id="lb-${i}-err"></p></div>
      <fieldset class="field consent-box" data-field="leaders.${i}.consent" aria-describedby="lc-${i}-err">
        <legend>מי זה?</legend>
        <label class="check-inline"><input type="radio" name="kind-${i}" value="fictional" data-kind ${m.fictional ? 'checked' : ''}> דמות בדויה (תסומן כך באתר)</label>
        <label class="check-inline"><input type="radio" name="kind-${i}" value="real" data-kind ${!m.fictional && m.consent ? 'checked' : ''}> אדם אמיתי שאישר להופיע בשם הזה</label>
        <p class="field-error" id="lc-${i}-err"></p>
      </fieldset>
      <div class="btn-row">
        <label class="btn btn-ghost btn-sm file-btn" ${store.adminPartyId ? 'hidden' : ''}>📷 ${m.image ? 'החלפת תמונה' : 'תמונה (לא חובה)'}<input type="file" accept="${ACCEPT_ATTR}" data-photo class="sr-only"></label>
        ${m.image ? html`<button type="button" class="btn btn-ghost btn-sm" data-remove-photo>הסרת התמונה</button>` : ''}
      </div>
    </li>`;
  }

  function draw(focusIndex) {
    render(container, html`
      <p class="muted">לא מציגים אדם אמיתי בתפקיד בלי שהוא הסכים. אפשר תמיד להמציא דמויות, והן יסומנו "דמות בדויה".</p>
      <datalist id="role-presets">${ROLE_PRESETS.map((r) => html`<option value="${r}"></option>`)}</datalist>
      ${items.length ? html`<ol class="editor-list">${items.map(itemHtml)}</ol>` : html`<div class="empty-inline">${EMPTY.leaders}</div>`}
      <div class="add-row">
        <button type="button" class="btn btn-secondary" data-add ${items.length >= LIMITS.leaders ? 'disabled' : ''}>➕ הוספת חבר/ת הנהלה</button>
        <button type="button" class="btn btn-ghost" data-add-fictional ${items.length >= LIMITS.leaders ? 'disabled' : ''}>🎭 הוספת דמות בדויה מוכנה</button>
      </div>`);
    if (focusIndex !== undefined) container.querySelector(`[data-index="${focusIndex}"] [data-key="name"]`)?.focus();
  }

  const onEdit = (e) => {
    const li = e.target.closest('[data-index]');
    if (!li) return;
    const i = Number(li.dataset.index);
    if (e.target.dataset.key) items[i][e.target.dataset.key] = e.target.value;
    if (e.target.hasAttribute('data-kind')) {
      items[i].fictional = e.target.value === 'fictional' ? 1 : 0;
      items[i].consent = e.target.value === 'real' ? 1 : 0;
    }
  };
  container.addEventListener('input', onEdit);
  container.addEventListener('change', async (e) => {
    onEdit(e);
    if (!e.target.hasAttribute('data-photo')) return;
    const i = Number(e.target.closest('[data-index]').dataset.index);
    const file = e.target.files[0];
    if (!file) return;
    try {
      toast('מעלים תמונה…', 'info', 1500);
      const res = await uploadFile(file, 'leader', { max: 400, square: true });
      items[i].image = res.id;
      draw();
      toast('התמונה הועלתה. אל תשכחו לשמור.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) {
      items.push({ id: uid(), name: '', role: '', bio: '', fictional: 0, consent: 0, image: null });
      draw(items.length - 1);
      return;
    }
    if (e.target.closest('[data-add-fictional]')) {
      const names = ['פרופ\' נודניק בן-ועדה', 'שושנה "שתי דקות" כהן', 'גברת במבה', 'אדון איחורי', 'ד"ר מזגן'];
      const used = new Set(items.map((x) => x.role));
      const role = ROLE_PRESETS.find((r) => !used.has(r)) || 'שר/ת בלי תיק';
      items.push({ id: uid(), name: pick(names), role, bio: pick(ROLE_BIOS), fictional: 1, consent: 0, image: null });
      draw(items.length - 1);
      toast('נוספה דמות בדויה לדוגמה. ערכו אותה כרצונכם.', 'info', 3000);
      return;
    }
    const li = e.target.closest('[data-index]');
    if (!li) return;
    const i = Number(li.dataset.index);
    const move = e.target.closest('[data-move]');
    if (move) {
      const j = i + Number(move.dataset.move);
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
      draw();
      container.querySelector(`[data-index="${j}"] [data-move="${move.dataset.move}"]`)?.focus();
      return;
    }
    if (e.target.closest('[data-remove]')) {
      if (!(await confirmDialog({ title: 'להסיר מההנהלה?', body: items[i].name || 'חבר ללא שם', confirmLabel: 'הסרה', danger: true }))) return;
      items.splice(i, 1);
      draw();
      return;
    }
    if (e.target.closest('[data-remove-photo]')) {
      items[i].image = null;
      draw();
      return;
    }
    if (e.target.closest('[data-suggest-bio]')) {
      items[i].bio = pick(ROLE_BIOS);
      draw();
      container.querySelector(`#lb-${i}`)?.focus();
    }
  });

  draw();
  return { collect: () => ({ leaders: items }) };
}
