// דף הבית: חיפוש, סינון ומיון בלי רענון, וטעינת עוד מפלגות.
import { api } from '../core/api.js';
import { debounce, pageData, $ } from '../core/dom.js';
import { toast } from '../core/ui.js';
import { partyCardHtml } from '../../shared/cards.js';
import { EMPTY } from '../../shared/humor.js';
import { esc } from '../../shared/escape.js';

const form = $('#party-filters');
const results = $('#party-results');
const grid = $('#party-grid');
const more = $('#load-more');
const count = $('#parties-count');
const categories = Object.fromEntries((pageData().categories || []).map((c) => [c.id, c]));
let offset = grid ? grid.children.length : 0;
let controller = null;

function params() {
  const p = new URLSearchParams();
  const q = form.q.value.trim();
  if (q) p.set('q', q);
  if (form.category.value) p.set('category', form.category.value);
  if (form.sort.value !== 'new') p.set('sort', form.sort.value);
  return p;
}

function emptyHtml(filtered) {
  return `<div class="empty-state" id="empty-state"><div class="empty-illustration" aria-hidden="true">🗳️</div>
    <h3>${filtered ? 'לא נמצאו מפלגות' : 'עוד אין כאן מפלגות'}</h3><p>${esc(filtered ? EMPTY.search : EMPTY.homeParties)}</p>
    ${filtered ? '<button type="button" class="btn btn-ghost" data-clear>ניקוי החיפוש</button>' : '<a class="btn btn-primary" href="/app/create/">להיות המפלגה הראשונה</a>'}</div>`;
}

async function load(append = false) {
  if (controller) controller.abort();
  controller = new AbortController();
  const p = params();
  p.set('offset', append ? String(offset) : '0');
  results.setAttribute('aria-busy', 'true');
  try {
    const data = await api(`/api/parties?${p}`, { signal: controller.signal });
    const items = data.items.map((c) => `<li>${partyCardHtml(c, { categories })}</li>`).join('');
    $('#empty-state')?.remove();
    if (append) grid.insertAdjacentHTML('beforeend', items);
    else grid.innerHTML = items;
    offset = (append ? offset : 0) + data.items.length;
    more.hidden = !data.has_more;
    count.textContent = data.total ? `${data.total.toLocaleString('he-IL')} מפלגות נמצאו` : 'לא נמצאו מפלגות';
    if (!data.total) grid.insertAdjacentHTML('afterend', emptyHtml(!!(form.q.value.trim() || form.category.value)));
    const url = new URL(location.href);
    url.search = params().toString();
    history.replaceState(null, '', url.pathname + url.search + '#parties');
  } catch (err) {
    if (err.name !== 'AbortError') toast(err.message, 'error');
  } finally {
    results.removeAttribute('aria-busy');
  }
}

if (form && grid) {
  const refresh = debounce(() => load(false), 300);
  form.q.addEventListener('input', refresh);
  form.category.addEventListener('change', () => load(false));
  form.sort.addEventListener('change', () => load(false));
  form.addEventListener('submit', (e) => { e.preventDefault(); load(false); });
  more.addEventListener('click', () => load(true));
  results.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) {
      form.reset();
      form.q.value = '';
      form.category.value = '';
      load(false);
      form.q.focus();
    }
  });
}
