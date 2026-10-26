// סטודיו העיצוב: בחירת תבנית, התאמה, תצוגה מקדימה, הורדה (PNG/PDF), שיתוף ופרסום לגלריה.
import { html, render } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, setBusy, share, confirmDialog } from '../core/ui.js';
import { store, publicUrl } from './state.js';
import { TEMPLATES, TEMPLATE_MAP } from '../studio/templates.js';
import { buildSvg, renderBlob, renderPdf, download, fileName } from '../studio/export.js';
import { uploadBlob } from './upload.js';
import { EMPTY } from '../../shared/humor.js';

const STYLE_OPTIONS = [['', 'ברירת מחדל'], ['gradient', 'מעבר צבע'], ['pattern', 'פסים'], ['dots', 'נקודות'], ['light', 'בהיר']];

function optionsForm(tpl, opts) {
  const parts = [];
  if (tpl.options.includes('headline')) parts.push(html`<div class="field"><label for="o-headline">כותרת</label><input id="o-headline" name="headline" maxlength="80" value="${opts.headline || ''}" placeholder="למשל: הצביעו לנו! (בצחוק)"></div>`);
  if (tpl.options.includes('body')) parts.push(html`<div class="field"><label for="o-body">טקסט ההודעה</label><textarea id="o-body" name="body" rows="4" maxlength="800" placeholder="ברירת מחדל: הודעת ההכרזה מהקמפיין">${opts.body || ''}</textarea></div>`);
  if (tpl.options.includes('memberName')) {
    parts.push(html`<div class="field"><label for="o-member">שם החבר/ה בכרטיס</label><input id="o-member" name="memberName" maxlength="40" value="${opts.memberName || ''}" placeholder="אפשר להשאיר ריק ולמלא בעט"></div>`);
    parts.push(html`<div class="field"><label for="o-num">מספר חבר</label><input id="o-num" name="memberNumber" maxlength="8" value="${opts.memberNumber || ''}" placeholder="0001" inputmode="numeric"></div>`);
  }
  if (tpl.options.includes('style')) parts.push(html`<div class="field"><label for="o-style">רקע</label><select id="o-style" name="style">${STYLE_OPTIONS.map(([v, l]) => html`<option value="${v}" ${opts.style === v ? 'selected' : ''}>${l}</option>`)}</select></div>`);
  if (tpl.options.includes('showQr')) parts.push(html`<div class="check"><input type="checkbox" id="o-qr" name="showQr" ${opts.showQr !== false ? 'checked' : ''}><label for="o-qr">קוד QR לאתר המפלגה</label></div>`);
  if (tpl.options.includes('showSlogan')) parts.push(html`<div class="check"><input type="checkbox" id="o-sl" name="showSlogan" ${opts.showSlogan !== false ? 'checked' : ''}><label for="o-sl">להציג את סיסמת הבחירות</label></div>`);
  return parts.length ? parts : html`<p class="muted small">לתבנית הזאת אין הגדרות נוספות. היא נבנית מנתוני המפלגה.</p>`;
}

export default async function studio(view) {
  const party = store.party;
  const url = publicUrl();
  const available = TEMPLATES.filter((t) => !store.disabledTemplates.includes(t.id));
  let current = available.find((t) => t.id === new URLSearchParams(location.search).get('t')) || available[0];
  const optsByTpl = {};
  let gallery = [];

  render(view, html`
    <header class="page-head"><h1>🎨 סטודיו עיצוב</h1>
      <p class="muted">כל תוצר נבנה מהנתונים האמיתיים של המפלגה: שם, סמל, צבעים, מצע וטקסטים. שינוי במפלגה = שינוי בתוצרים.</p></header>
    ${party.status !== 'published' || party.visibility !== 'public' ? html`<div class="alert alert-amber" role="note">המפלגה עדיין לא ציבורית, ולכן הקישור וה-QR יובילו לדף "לא נמצא" עד הפרסום.</div>` : ''}
    <div class="studio">
      <nav class="studio-list" aria-label="תבניות">
        <ul role="list">${available.map((t) => html`<li><button type="button" class="tpl-btn" data-tpl="${t.id}" aria-pressed="${t.id === current.id ? 'true' : 'false'}"><strong>${t.label}</strong><span class="muted small">${t.description}</span></button></li>`)}</ul>
      </nav>
      <section class="studio-stage" aria-labelledby="stage-title">
        <h2 id="stage-title" class="h4"></h2>
        <div class="stage-preview" id="stage" aria-live="polite"></div>
      </section>
      <aside class="studio-options card" aria-label="הגדרות התוצר">
        <form id="tpl-opts" novalidate></form>
        <div class="studio-actions">
          <button type="button" class="btn btn-primary" data-png>⬇️ הורדת PNG</button>
          <button type="button" class="btn btn-secondary" data-pdf>🖨️ PDF להדפסה</button>
          <button type="button" class="btn btn-ghost" data-share>📤 שיתוף</button>
          <button type="button" class="btn btn-ghost" data-gallery>🖼️ פרסום בגלריה של האתר</button>
          <button type="button" class="btn btn-ghost" data-og hidden>🔗 הגדרה כתמונת השיתוף</button>
        </div>
        <p class="muted small" id="studio-note"></p>
      </aside>
    </div>
    <section class="card" aria-labelledby="gal-title">
      <h2 id="gal-title" class="h4">הגלריה באתר המפלגה</h2>
      <div id="gallery-list"></div>
    </section>`);

  const stage = view.querySelector('#stage');
  const optsForm = view.querySelector('#tpl-opts');

  function opts() {
    return optsByTpl[current.id] || (optsByTpl[current.id] = {});
  }

  async function draw() {
    view.querySelector('#stage-title').textContent = current.label;
    stage.setAttribute('aria-busy', 'true');
    try {
      const { svg } = await buildSvg(current.id, party, opts(), { url });
      stage.innerHTML = svg;
      stage.style.setProperty('--ratio', `${current.width} / ${current.height}`);
    } catch (err) {
      render(stage, html`<p class="error-inline">לא הצלחנו לבנות את התצוגה: ${err.message}</p>`);
    }
    stage.removeAttribute('aria-busy');
    view.querySelector('[data-pdf]').hidden = !current.print;
    view.querySelector('[data-og]').hidden = current.id !== 'og';
    view.querySelector('#studio-note').textContent = current.print ? `מוכן להדפסה על דף ${current.print === 'A4L' ? 'A4 לרוחב' : 'A4'}, ברזולוציה גבוהה.` : `${current.width}×${current.height} פיקסלים.`;
  }

  function drawOptions() {
    render(optsForm, html`<h2 class="h5">התאמה</h2>${optionsForm(current, opts())}`);
  }

  optsForm.addEventListener('input', (e) => {
    const o = opts();
    const t = e.target;
    o[t.name] = t.type === 'checkbox' ? t.checked : t.value;
    clearTimeout(optsForm._t);
    optsForm._t = setTimeout(draw, 200);
  });

  view.querySelector('.studio-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tpl]');
    if (!btn) return;
    current = TEMPLATE_MAP[btn.dataset.tpl];
    view.querySelectorAll('[data-tpl]').forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    history.replaceState(null, '', `/app/studio/?t=${current.id}`);
    drawOptions();
    draw();
  });

  async function act(btn, label, fn) {
    setBusy(btn, true, label);
    try { await fn(); } catch (err) { toast(err.message || 'הפעולה נכשלה. נסו שוב.', 'error'); } finally { setBusy(btn, false); }
  }

  view.querySelector('[data-png]').addEventListener('click', (e) => act(e.currentTarget, 'מכינים…', async () => {
    download(await renderBlob(current.id, party, opts(), { url }), fileName(party, current.id, 'png'));
    toast('הקובץ ירד. יאללה לשתף.', 'success');
  }));
  view.querySelector('[data-pdf]').addEventListener('click', (e) => act(e.currentTarget, 'מכינים PDF…', async () => {
    download(await renderPdf(current.id, party, opts(), { url }), fileName(party, current.id, 'pdf'));
    toast('ה-PDF מוכן להדפסה.', 'success');
  }));
  view.querySelector('[data-share]').addEventListener('click', (e) => act(e.currentTarget, 'מכינים…', async () => {
    const blob = await renderBlob(current.id, party, opts(), { url });
    const file = new File([blob], fileName(party, current.id, 'png'), { type: 'image/png' });
    const result = await share({ title: party.name, text: `${party.name} — ${url}`, url, files: [file] });
    if (result === 'copied') toast('השיתוף הישיר לא נתמך בדפדפן הזה, אז העתקנו את הקישור. אפשר גם להוריד את התמונה.', 'info', 6000);
  }));
  view.querySelector('[data-gallery]').addEventListener('click', (e) => act(e.currentTarget, 'מעלים…', async () => {
    const blob = await renderBlob(current.id, party, opts(), { url, type: 'image/jpeg', quality: 0.85, scale: Math.min(1, 1600 / Math.max(current.width, current.height)) });
    await uploadBlob(blob, 'gallery', current.label);
    toast('התוצר פורסם בגלריה של האתר.', 'success');
    await loadGallery();
  }));
  view.querySelector('[data-og]').addEventListener('click', (e) => act(e.currentTarget, 'מעדכנים…', async () => {
    const blob = await renderBlob('og', party, opts(), { url, type: 'image/jpeg', quality: 0.86 });
    const r = await uploadBlob(blob, 'og', 'תמונת שיתוף');
    store.party = { ...store.party, og_image_id: r.id };
    toast('תמונת השיתוף עודכנה. ייתכן שוואטסאפ ימשיך להציג גרסה ישנה עוד כמה זמן.', 'success', 6000);
  }));

  async function loadGallery() {
    const box = view.querySelector('#gallery-list');
    try {
      gallery = (await api('/api/me/gallery')).items;
    } catch (err) {
      render(box, html`<p class="error-inline">${err.message}</p>`);
      return;
    }
    if (!gallery.length) { render(box, html`<p class="empty-inline">${EMPTY.gallery}</p>`); return; }
    render(box, html`<ul class="gallery owner" role="list">${gallery.map((g) => html`<li><img src="/img/${g.id}" alt="${g.title || 'תוצר'}" loading="lazy"><div class="gallery-meta"><span class="small">${g.title}</span><button type="button" class="icon-btn danger" data-del-img="${g.id}" aria-label="${`הסרת ${g.title || 'התמונה'} מהגלריה`}">🗑</button></div></li>`)}</ul>`);
  }
  view.querySelector('#gallery-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-img]');
    if (!btn) return;
    if (!(await confirmDialog({ title: 'להסיר מהגלריה?', body: 'התמונה תוסר מהאתר הציבורי.', confirmLabel: 'הסרה', danger: true }))) return;
    try {
      await api(`/api/me/images/${btn.dataset.delImg}`, { method: 'DELETE' });
      toast('הוסר.', 'success');
      loadGallery();
    } catch (err) { toast(err.message, 'error'); }
  });

  drawOptions();
  await draw();
  loadGallery();
}
