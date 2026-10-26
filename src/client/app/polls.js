// ניהול בחירות פנימיות: יצירה, מועד סיום, תוצאות, סגירה ומחיקה.
import { html, render } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, confirmDialog, setBusy, showFieldErrors } from '../core/ui.js';
import { store, publicUrl } from './state.js';
import { POLL_KINDS, LIMITS } from '../../shared/constants.js';
import { EMPTY, SLOGANS } from '../../shared/humor.js';
import { formatDate } from '../../shared/cards.js';

function presetOptions(kind) {
  const p = store.party;
  const slogans = String(p.campaign?.slogans || '').split('\n').map((s) => s.trim()).filter(Boolean);
  switch (kind) {
    case 'chair': return p.leaders.map((l) => l.name).slice(0, LIMITS.pollOptions);
    case 'slogan': return (slogans.length ? slogans : [p.slogan, ...SLOGANS.slice(0, 3)]).filter(Boolean).slice(0, LIMITS.pollOptions);
    case 'promises': return p.platform.map((i) => i.title).slice(0, LIMITS.pollOptions);
    case 'bamba': return [...p.leaders.map((l) => l.name), 'אף אחד, הבמבה שייכת לעם'].slice(0, LIMITS.pollOptions);
    case 'platform': return ['בעד', 'נגד', 'צריך ועדה'];
    default: return ['', ''];
  }
}

const QUESTIONS = {
  chair: 'מי יהיה היו"ר שלנו?',
  slogan: 'איזו סיסמה תוביל אותנו לניצחון?',
  promises: 'איזו הבטחה הכי חשובה לכם?',
  bamba: 'מי ימונה לשר/ת הבמבה?',
  platform: 'האם לאמץ את ההצעה למצע?',
  custom: '',
};

export default async function polls(view) {
  render(view, html`
    <header class="page-head"><h1>🗳️ בחירות פנימיות</h1>
      <p class="muted">הצבעות הומוריסטיות שמוצגות באתר המפלגה. רק משתמשים מחוברים יכולים להצביע, וכל אחד פעם אחת. זה לא סקר מייצג ולא הצבעה חשאית: המערכת שומרת מי הצביע כדי למנוע כפילויות, ואת/ה רואה רק סיכומים.</p></header>
    <section class="card" aria-labelledby="new-poll-title">
      <h2 id="new-poll-title" class="h4">הצבעה חדשה</h2>
      <form id="poll-form" novalidate>
        <div class="form-grid">
          <div class="field"><label for="p-kind">סוג</label><select id="p-kind" name="kind">${Object.entries(POLL_KINDS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
          <div class="field"><label for="p-results">מתי להציג תוצאות</label><select id="p-results" name="results">
            <option value="after_vote">אחרי שמצביעים</option><option value="always">תמיד</option><option value="after_close">רק אחרי הסגירה</option></select></div>
        </div>
        <div class="field"><label for="p-q">השאלה <span class="req" aria-hidden="true">*</span></label><input id="p-q" name="question" maxlength="140" aria-describedby="p-q-err"><p class="field-error" id="p-q-err"></p></div>
        <fieldset class="field" data-field="options" aria-describedby="p-o-err"><legend>אפשרויות (2–${LIMITS.pollOptions})</legend>
          <ol class="option-list" id="opt-list"></ol>
          <button type="button" class="btn btn-ghost btn-sm" data-add-opt>➕ אפשרות</button>
          <p class="field-error" id="p-o-err"></p>
        </fieldset>
        <div class="field"><label for="p-end">מועד סיום (לא חובה)</label><input id="p-end" type="datetime-local" name="ends_at" aria-describedby="p-end-err"><p class="field-error" id="p-end-err"></p></div>
        <button type="submit" class="btn btn-primary">פתיחת הקלפי</button>
      </form>
    </section>
    <section aria-labelledby="list-title"><h2 id="list-title" class="h4">ההצבעות שלך</h2><div id="poll-list"></div></section>`);

  const form = view.querySelector('#poll-form');
  const list = view.querySelector('#opt-list');

  function setOptions(values) {
    render(list, html`${values.map((v, i) => html`<li><label class="sr-only" for="opt-${i}">אפשרות ${i + 1}</label><input id="opt-${i}" data-opt value="${v}" maxlength="80">
      <button type="button" class="icon-btn danger" data-del-opt="${i}" aria-label="${`הסרת אפשרות ${i + 1}`}">✕</button></li>`)}`);
  }
  const values = () => [...list.querySelectorAll('[data-opt]')].map((i) => i.value);

  function applyKind() {
    const kind = form.kind.value;
    form.question.value = QUESTIONS[kind] || '';
    const opts = presetOptions(kind);
    setOptions(opts.length >= 2 ? opts : [...opts, '', ''].slice(0, Math.max(2, opts.length)));
    if (['chair', 'bamba'].includes(kind) && store.party.leaders.length < 2) toast('כדאי להוסיף קודם חברי הנהלה, או לכתוב אפשרויות ידנית.', 'info');
    if (kind === 'promises' && store.party.platform.length < 2) toast('יש פחות משני סעיפים במצע. אפשר לכתוב אפשרויות ידנית.', 'info');
  }
  form.kind.addEventListener('change', applyKind);
  applyKind();

  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-opt]')) {
      const v = values();
      if (v.length >= LIMITS.pollOptions) { toast(`עד ${LIMITS.pollOptions} אפשרויות`, 'error'); return; }
      setOptions([...v, '']);
      list.querySelector('li:last-child input').focus();
    }
    const del = e.target.closest('[data-del-opt]');
    if (del) {
      const v = values();
      v.splice(Number(del.dataset.delOpt), 1);
      setOptions(v.length ? v : ['']);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const body = {
      kind: form.kind.value,
      results: form.results.value,
      question: form.question.value.trim(),
      options: values().map((v) => v.trim()).filter(Boolean),
      ends_at: form.ends_at.value ? new Date(form.ends_at.value).toISOString() : null,
    };
    const errors = {};
    if (body.question.length < 3) errors.question = 'השאלה: לפחות 3 תווים';
    if (body.options.length < 2) errors.options = 'צריך לפחות 2 אפשרויות';
    if (Object.keys(errors).length) { showFieldErrors(form, errors); return; }
    showFieldErrors(form, {});
    setBusy(btn, true, 'פותחים קלפי…');
    try {
      await api('/api/me/polls', { method: 'POST', body });
      toast('הקלפי נפתחה! שתפו את הקישור כדי שיצביעו.', 'success');
      form.reset();
      applyKind();
      await drawList();
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      toast(err.message, 'error');
    } finally { setBusy(btn, false); }
  });

  async function drawList() {
    const box = view.querySelector('#poll-list');
    let items;
    try { items = (await api('/api/me/polls')).items; } catch (err) { render(box, html`<p class="error-inline">${err.message}</p>`); return; }
    if (!items.length) { render(box, html`<p class="empty-inline">${EMPTY.polls}</p>`); return; }
    render(box, html`${items.map((p) => {
      const total = p.options.reduce((s, o) => s + o.votes, 0);
      const max = Math.max(1, ...p.options.map((o) => o.votes));
      const open = p.status === 'open' && (!p.ends_at || p.ends_at > Date.now());
      return html`<article class="poll card" data-poll="${p.id}">
        <header class="poll-head"><h3>${p.question}</h3><span class="chip ${open ? 'chip-open' : 'chip-closed'}">${open ? 'פתוחה' : 'סגורה'}</span></header>
        <p class="muted small">${POLL_KINDS[p.kind] || ''} · נפתחה ${formatDate(p.created_at)}${p.ends_at ? ` · ${open ? 'נסגרת' : 'נסגרה'} ${formatDate(p.ends_at)}` : ''}</p>
        <ul class="poll-results">${p.options.map((o) => html`<li><div class="poll-bar-label"><span>${o.label}</span><span>${o.votes}</span></div><div class="poll-bar" aria-hidden="true"><span style="width:${Math.round((o.votes / max) * 100)}%"></span></div></li>`)}</ul>
        <p class="muted small">סה"כ ${total} קולות</p>
        <div class="btn-row tight">
          ${open ? html`<button type="button" class="btn btn-ghost btn-sm" data-close>סגירת הקלפי</button>` : ''}
          <a class="btn btn-ghost btn-sm" href="${publicUrl()}#polls" target="_blank" rel="noopener">באתר ↗</a>
          <button type="button" class="btn btn-ghost btn-sm danger" data-del>מחיקה</button>
        </div>
      </article>`;
    })}`);
  }

  view.querySelector('#poll-list').addEventListener('click', async (e) => {
    const card = e.target.closest('[data-poll]');
    if (!card) return;
    if (e.target.closest('[data-close]')) {
      if (!(await confirmDialog({ title: 'לסגור את הקלפי?', body: 'אחרי הסגירה אי אפשר להצביע, והתוצאות יוצגו לכולם.', confirmLabel: 'סגירה' }))) return;
      try { await api(`/api/me/polls/${card.dataset.poll}/close`, { method: 'POST', body: {} }); toast('הקלפי נסגרה. הספירה הסתיימה.', 'success'); drawList(); } catch (err) { toast(err.message, 'error'); }
    }
    if (e.target.closest('[data-del]')) {
      if (!(await confirmDialog({ title: 'למחוק את ההצבעה?', body: 'ההצבעה וכל הקולות יימחקו.', confirmLabel: 'מחיקה', danger: true }))) return;
      try { await api(`/api/me/polls/${card.dataset.poll}`, { method: 'DELETE' }); toast('נמחק.', 'success'); drawList(); } catch (err) { toast(err.message, 'error'); }
    }
  });
  await drawList();
}
