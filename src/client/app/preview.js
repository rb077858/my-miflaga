// תצוגה מקדימה של האתר הציבורי, גם לטיוטה ולמפלגה פרטית (רק לבעלים).
import { html, render, raw } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from './state.js';
import { partyBodyHtml } from '../../shared/party-view.js';

export default async function preview(view) {
  let gallery = [];
  try { gallery = (await api('/api/me/gallery')).items; } catch { gallery = []; }
  const party = { ...store.party, supporters_count: store.party.show_supporter_count ? store.party.supporters_count : null, contact_text: store.party.show_contact ? store.party.contact_text : '' };
  const url = `${location.origin}/party/${encodeURIComponent(party.slug)}/`;
  render(view, html`
    <header class="page-head"><h1>👀 תצוגה מקדימה</h1><p class="muted">כך ייראה האתר הציבורי${party.status === 'draft' ? ' אחרי הפרסום' : ''}.</p></header>
    <div class="preview-frame">${raw(partyBodyHtml({ url, party, categories: store.categories, formToken: '', gallery, preview: true }))}</div>`);
  // בתצוגה מקדימה הטפסים והכפתורים לא פעילים, אבל התוכן נשאר קריא גם לקוראי מסך
  for (const el of view.querySelectorAll('.preview-frame input, .preview-frame textarea, .preview-frame select, .preview-frame button')) el.disabled = true;
  for (const form of view.querySelectorAll('.preview-frame form')) form.addEventListener('submit', (e) => e.preventDefault());
}
