// שלב 3: עורך המצע — הוספה, עריכה, מחיקה וסידור מחדש של סעיפים, עם הצעות מצחיקות (רק כהצעות).
import { html, render } from '../core/dom.js';
import { toast, confirmDialog } from '../core/ui.js';
import { store } from './state.js';
import { PLATFORM_TOPICS, PLATFORM_STATUS, PRIORITIES, LIMITS } from '../../shared/constants.js';
import { PROMISES, EMPTY, pick } from '../../shared/humor.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export default function stepPlatform(container) {
  let items = (store.party.platform || []).map((x) => ({ ...x }));

  function itemHtml(item, i) {
    const n = i + 1;
    return html`<li class="editor-item card" data-index="${i}">
      <div class="editor-item-head">
        <h2 class="h5">סעיף ${n}${item.title ? `: ${item.title}` : ''}</h2>
        <div class="btn-row tight">
          <button type="button" class="icon-btn" data-move="-1" aria-label="${`העברת סעיף ${n} למעלה`}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="icon-btn" data-move="1" aria-label="${`העברת סעיף ${n} למטה`}" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="icon-btn danger" data-remove aria-label="${`מחיקת סעיף ${n}`}">🗑</button>
        </div>
      </div>
      <div class="form-grid three">
        <div class="field"><label for="pt-${i}">נושא</label>
          <select id="pt-${i}" data-key="topic">${PLATFORM_TOPICS.map((t) => html`<option value="${t.id}" ${item.topic === t.id ? 'selected' : ''}>${t.label}</option>`)}</select></div>
        <div class="field"><label for="pp-${i}">עדיפות</label>
          <select id="pp-${i}" data-key="priority">${PRIORITIES.map((t) => html`<option value="${t.value}" ${Number(item.priority) === t.value ? 'selected' : ''}>${t.label}</option>`)}</select></div>
        <div class="field"><label for="ps-${i}">סטטוס</label>
          <select id="ps-${i}" data-key="status">${PLATFORM_STATUS.map((t) => html`<option value="${t.value}" ${item.status === t.value ? 'selected' : ''}>${t.label}</option>`)}</select></div>
      </div>
      <div class="field"><div class="label-row"><label for="pti-${i}">שם הסעיף <span class="req" aria-hidden="true">*</span></label>
        <button type="button" class="suggest-btn" data-suggest-item aria-label="${`הצעה מצחיקה לסעיף ${n}`}">✨ הצעה לנושא הזה</button></div>
        <input id="pti-${i}" data-key="title" name="platform.${i}.title" value="${item.title}" maxlength="80" aria-describedby="pti-${i}-err"><p class="field-error" id="pti-${i}-err"></p></div>
      <div class="field"><label for="ppr-${i}">הבטחת הבחירות <span class="req" aria-hidden="true">*</span></label>
        <textarea id="ppr-${i}" data-key="promise" name="platform.${i}.promise" rows="2" maxlength="300" aria-describedby="ppr-${i}-err">${item.promise}</textarea><p class="field-error" id="ppr-${i}-err"></p></div>
      <div class="field"><label for="pex-${i}">הסבר</label>
        <textarea id="pex-${i}" data-key="explanation" name="platform.${i}.explanation" rows="2" maxlength="1000" aria-describedby="pex-${i}-err">${item.explanation}</textarea><p class="field-error" id="pex-${i}-err"></p></div>
    </li>`;
  }

  function draw(focusIndex) {
    render(container, html`
      <p class="muted">כל סעיף כולל הבטחת בחירות, הסבר, עדיפות וסטטוס. לחיצה על "✨ הצעה" ממלאת טקסט לדוגמה, ואתם מחליטים אם להשאיר אותו.</p>
      ${items.length ? html`<ol class="editor-list">${items.map(itemHtml)}</ol>` : html`<div class="empty-inline">${EMPTY.platform}</div>`}
      <div class="add-row">
        <label for="new-topic" class="sr-only">נושא לסעיף חדש</label>
        <select id="new-topic">${PLATFORM_TOPICS.map((t) => html`<option value="${t.id}">${t.label}</option>`)}</select>
        <button type="button" class="btn btn-secondary" data-add ${items.length >= LIMITS.platformItems ? 'disabled' : ''}>➕ הוספת סעיף</button>
      </div>
      <p class="muted small" aria-live="polite">${items.length} מתוך ${LIMITS.platformItems} סעיפים</p>`);
    if (focusIndex !== undefined) container.querySelector(`[data-index="${focusIndex}"] [data-key="title"]`)?.focus();
  }

  container.addEventListener('input', (e) => {
    const li = e.target.closest('[data-index]');
    const key = e.target.dataset.key;
    if (!li || !key) return;
    const i = Number(li.dataset.index);
    items[i][key] = key === 'priority' ? Number(e.target.value) : e.target.value;
  });

  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) {
      items.push({ id: uid(), topic: container.querySelector('#new-topic').value, title: '', promise: '', explanation: '', priority: 2, status: 'proposal' });
      draw(items.length - 1);
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
      toast(`הסעיף הועבר למקום ${j + 1}`, 'info', 1800);
      return;
    }
    if (e.target.closest('[data-remove]')) {
      const ok = await confirmDialog({ title: 'למחוק את הסעיף?', body: items[i].title || 'סעיף ללא שם', confirmLabel: 'מחיקה', danger: true });
      if (!ok) return;
      items.splice(i, 1);
      draw();
      return;
    }
    if (e.target.closest('[data-suggest-item]')) {
      const s = pick(PROMISES[items[i].topic] || PROMISES.free);
      items[i] = { ...items[i], title: s.title, promise: s.promise, explanation: s.explanation };
      draw(i);
      toast('הוכנסה הצעה. זה הטקסט שלכם עכשיו, ערכו אותו כרצונכם.', 'info', 3000);
    }
  });

  // שינויי select לא תמיד מגיעים כ-input בכל הדפדפנים
  container.addEventListener('change', (e) => {
    const li = e.target.closest('[data-index]');
    const key = e.target.dataset.key;
    if (!li || !key) return;
    items[Number(li.dataset.index)][key] = key === 'priority' ? Number(e.target.value) : e.target.value;
  });

  draw();
  return { collect: () => ({ platform: items }) };
}
