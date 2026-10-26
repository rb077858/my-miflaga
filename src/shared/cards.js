// כרטיס מפלגה ברשימות (משמש גם בשרת וגם בדפדפן אחרי חיפוש).
import { esc, safeColor, readableOn } from './escape.js';
import { renderEmblem } from './emblem.js';

export function partyCardHtml(p, { headingLevel = 3, categories = {} } = {}) {
  const primary = safeColor(p.color_primary);
  const secondary = safeColor(p.color_secondary, '#ffc93c');
  const cat = categories[p.category];
  const h = `h${headingLevel}`;
  const slug = encodeURIComponent(p.slug);
  return `<article class="party-card" style="--p:${primary};--s:${secondary};--on-p:${readableOn(primary)}">
  <div class="party-card-top">
    <div class="party-card-emblem">${renderEmblem(p, { id: `c-${slug}`, size: 84 })}</div>
    ${p.featured ? '<span class="chip chip-featured">⭐ נבחרת</span>' : ''}
  </div>
  <div class="party-card-body">
    <${h} class="party-card-title"><a href="/party/${slug}/" class="stretched">${esc(p.name)}</a></${h}>
    ${p.acronym ? `<p class="party-card-letters" aria-label="אותיות המפלגה">${esc(p.acronym)}</p>` : ''}
    ${p.slogan ? `<p class="party-card-slogan">"${esc(p.slogan)}"</p>` : ''}
    ${p.short_desc ? `<p class="party-card-desc">${esc(p.short_desc)}</p>` : ''}
  </div>
  <div class="party-card-meta">
    ${cat ? `<span class="chip">${esc(cat.emoji || '')} ${esc(cat.label)}</span>` : ''}
    ${typeof p.supporters_count === 'number' ? `<span class="meta-count" title="תומכים">👥 ${p.supporters_count.toLocaleString('he-IL')}</span>` : ''}
  </div>
</article>`;
}

export function formatDate(ts) {
  if (!ts) return '';
  try {
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

export function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p>${esc(s)}</p>`)
    .join('');
}
