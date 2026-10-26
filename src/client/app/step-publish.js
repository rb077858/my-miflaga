// שלב 6 ודף ההגדרות: נתיב ציבורי, פרטיות, הרשאות למבקרים, תקציר ופרסום.
import { html, render, raw, formData, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, setBusy, showFieldErrors, copyText } from '../core/ui.js';
import { store, savePatch, publicUrl, statusInfo } from './state.js';
import { checkField, textArea } from './fields.js';
import { partyCardHtml } from '../../shared/cards.js';
import { MESSAGES } from '../../shared/humor.js';
import { slugProblem } from '../../shared/validate.js';
import { ensureOgImage } from './og.js';

const MISSING = (p) => [
  !p.name && 'שם המפלגה', !p.acronym && 'ראשי תיבות', !p.slogan && 'סיסמת בחירות', !p.short_desc && 'תיאור קצר',
].filter(Boolean);

const RECOMMENDED = (p) => [
  !p.platform.length && 'לפחות סעיף אחד במצע', !p.leaders.length && 'לפחות חבר הנהלה אחד', !p.campaign?.flagship && 'הבטחת דגל',
].filter(Boolean);

export default function stepPublish(container, { navigate, refreshShell } = {}) {
  const draw = () => {
    const p = store.party;
    const st = statusInfo(p);
    const missing = MISSING(p);
    const recommended = RECOMMENDED(p);
    const catMap = Object.fromEntries(store.categories.map((c) => [c.id, c]));
    render(container, html`
      <section class="settings-block" aria-labelledby="slug-title">
        <h2 id="slug-title" class="h4">הכתובת הציבורית</h2>
        <div class="slug-row">
          <span class="slug-prefix" dir="ltr">${location.host}/party/</span>
          <label for="slug" class="sr-only">נתיב ציבורי</label>
          <input id="slug" name="slug" dir="ltr" value="${p.slug}" maxlength="40" autocomplete="off" aria-describedby="slug-hint slug-err" ${store.adminPartyId ? 'readonly' : ''}>
          ${store.adminPartyId ? '' : html`<button type="button" class="btn btn-secondary btn-sm" data-change-slug>עדכון הכתובת</button>`}
        </div>
        <p class="hint" id="slug-hint">אותיות באנגלית קטנות, ספרות ומקפים. ${p.published_at ? 'אחרי שינוי, הכתובת הישנה תמשיך להפנות לחדשה, כך שקישורים ששיתפתם לא יישברו.' : ''}</p>
        <p class="field-error" id="slug-err" aria-live="polite"></p>
      </section>

      <section class="settings-block" aria-labelledby="vis-title">
        <h2 id="vis-title" class="h4">מי יכול לראות</h2>
        <div class="radio-cards" role="radiogroup" aria-label="נראות">
          <label class="radio-card"><input type="radio" name="visibility" value="public" ${p.visibility === 'public' ? 'checked' : ''}><span><strong>ציבורית</strong><br><span class="muted small">כל מי שיש לו קישור יכול לראות. אפשר גם להופיע בדף הבית.</span></span></label>
          <label class="radio-card"><input type="radio" name="visibility" value="private" ${p.visibility === 'private' ? 'checked' : ''}><span><strong>פרטית</strong><br><span class="muted small">רק את/ה רואה את המפלגה, דרך התצוגה המקדימה. האתר הציבורי לא נגיש.</span></span></label>
        </div>
        ${checkField({ name: 'show_on_home', label: 'להופיע ברשימת המפלגות בדף הבית', checked: p.show_on_home })}
        ${checkField({ name: 'allow_share', label: 'להציג כפתורי שיתוף באתר המפלגה', checked: p.allow_share })}
      </section>

      <section class="settings-block" aria-labelledby="int-title">
        <h2 id="int-title" class="h4">מה מבקרים יכולים לעשות</h2>
        ${checkField({ name: 'allow_supporters', label: 'הצטרפות לרשימת תומכים', checked: p.allow_supporters, hint: 'רק שם לתצוגה והודעה קצרה. הרשימה לא מוצגת בפומבי.' })}
        ${checkField({ name: 'show_supporter_count', label: 'להציג את מספר התומכים', checked: p.show_supporter_count })}
        ${checkField({ name: 'show_supporter_names', label: 'קיר תומכים: להציג שמות של תומכים שבחרו בכך במפורש', checked: p.show_supporter_names, hint: 'גם כשזה דולק, יוצגו רק תומכים שסימנו בעצמם שמותר להציג אותם.' })}
        ${checkField({ name: 'allow_submissions', label: 'הצעות ושאלות מהמבקרים (רעיונות למצע, שאלות, הצעות סיסמה)', checked: p.allow_submissions })}
        ${checkField({ name: 'show_contact', label: 'לפרסם פרטי יצירת קשר באתר', checked: p.show_contact })}
        ${textArea({ name: 'contact_text', label: 'פרטי יצירת קשר (מוצג רק אם סימנתם למעלה)', value: p.contact_text, rows: 2, max: 300, hint: 'למשל קבוצת וואטסאפ או אימייל של המפלגה. אל תפרסמו פרטים של אנשים אחרים.' })}
        <button type="button" class="btn btn-primary" data-save-settings>💾 שמירת ההגדרות</button>
      </section>

      <section class="settings-block summary" aria-labelledby="sum-title">
        <h2 id="sum-title" class="h4">תקציר לפני פרסום</h2>
        <div class="summary-grid">
          <div class="summary-card">${raw(partyCardHtml({ ...p, supporters_count: null }, { categories: catMap }))}</div>
          <div>
            <p>מצב נוכחי: <span class="badge badge-${st.tone}">${st.label}</span></p>
            <ul class="checklist">
              <li class="${p.platform.length ? 'ok' : ''}">📜 ${p.platform.length} סעיפים במצע</li>
              <li class="${p.leaders.length ? 'ok' : ''}">👥 ${p.leaders.length} חברי הנהלה</li>
              <li class="${p.campaign?.speech ? 'ok' : ''}">🎤 ${p.campaign?.speech ? 'יש נאום פתיחה' : 'אין נאום פתיחה'}</li>
              <li class="${p.visibility === 'public' ? 'ok' : ''}">${p.visibility === 'public' ? '🌍 ציבורית' : '🔒 פרטית'}${p.visibility === 'public' && p.show_on_home ? ', מופיעה בדף הבית' : ''}</li>
            </ul>
            ${missing.length ? html`<div class="alert alert-amber" role="alert">כדי לפרסם חסרים: ${missing.join(', ')}. <a href="/app/edit/?step=1" data-nav>להשלמה</a></div>` : ''}
            ${!missing.length && recommended.length ? html`<p class="muted small">מומלץ (לא חובה): ${recommended.join(', ')}.</p>` : ''}
            <div class="btn-row">
              ${p.status === 'draft'
    ? html`<button type="button" class="btn btn-primary btn-lg" data-publish ${missing.length || p.mod_status === 'blocked' ? 'disabled' : ''}>🚀 פרסום המפלגה</button>`
    : html`<button type="button" class="btn btn-ghost" data-unpublish>החזרה לטיוטה</button>`}
              ${p.status === 'published' && p.visibility === 'public' ? html`<a class="btn btn-ghost" href="${publicUrl(p)}" target="_blank" rel="noopener">לאתר ↗</a><button type="button" class="btn btn-ghost" data-copy>🔗 העתקה</button>` : ''}
              <a class="btn btn-ghost" href="/app/preview/" data-nav>👀 תצוגה מקדימה</a>
            </div>
          </div>
        </div>
      </section>`);
  };
  draw();

  const slugInput = () => container.querySelector('#slug');
  const checkSlug = debounce(async () => {
    const value = slugInput().value.trim();
    const err = container.querySelector('#slug-err');
    if (value === store.party.slug) { err.textContent = ''; return; }
    const local = slugProblem(value);
    if (local) { err.textContent = local; return; }
    try {
      const r = await api(`/api/me/check?slug=${encodeURIComponent(value)}`);
      err.textContent = r.slug.ok ? '✔ הכתובת פנויה' : r.slug.problem;
    } catch { err.textContent = ''; }
  }, 400);

  container.addEventListener('input', (e) => { if (e.target.id === 'slug') checkSlug(); });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.hasAttribute('data-change-slug')) {
      setBusy(btn, true, 'מעדכנים…');
      try {
        const r = await api('/api/me/party/slug', { method: 'PUT', body: { slug: slugInput().value.trim() } });
        store.party = r.party;
        toast('הכתובת עודכנה.', 'success');
        draw();
      } catch (err) {
        container.querySelector('#slug-err').textContent = err.fields?.slug || err.message;
        toast(err.message, 'error');
      } finally { setBusy(btn, false); }
    }
    if (btn.hasAttribute('data-save-settings')) await saveSettings(btn);
    if (btn.hasAttribute('data-publish')) {
      if (!(await saveSettings(null, true))) return;
      setBusy(btn, true, 'מפרסמים…');
      try {
        if (store.adminPartyId) {
          await savePatch({ status: 'published' }, { quiet: true });
          toast('המפלגה פורסמה (כמנהל, ונרשם ביומן).', 'success');
          refreshShell?.();
          draw();
          return;
        }
        const r = await api('/api/me/party/publish', { method: 'POST', body: {} });
        store.party = r.party;
        toast(MESSAGES.published, 'success', 6000);
        refreshShell?.();
        ensureOgImage().catch(() => {});
        draw();
        if (navigate) await navigate('/app/');
      } catch (err) {
        toast(err.message, 'error');
        setBusy(btn, false);
      }
    }
    if (btn.hasAttribute('data-unpublish')) {
      setBusy(btn, true);
      try {
        if (store.adminPartyId) await savePatch({ status: 'draft' }, { quiet: true });
        else store.party = (await api('/api/me/party/unpublish', { method: 'POST', body: {} })).party;
        toast('המפלגה חזרה לטיוטה. האתר הציבורי כבר לא נגיש.', 'info');
        refreshShell?.();
        draw();
      } catch (err) { toast(err.message, 'error'); setBusy(btn, false); }
    }
    if (btn.hasAttribute('data-copy')) copyText(publicUrl());
  });

  async function saveSettings(btn, quiet = false) {
    const wrap = container;
    const d = formData(wrap.closest('form') || wrap);
    const patch = {
      visibility: wrap.querySelector('[name="visibility"]:checked')?.value || 'public',
      contact_text: d.contact_text ?? '',
    };
    for (const k of ['show_on_home', 'allow_share', 'allow_supporters', 'allow_submissions', 'show_supporter_count', 'show_supporter_names', 'show_contact']) {
      patch[k] = wrap.querySelector(`[name="${k}"]`).checked ? 1 : 0;
    }
    if (btn) setBusy(btn, true, 'שומרים…');
    try {
      await savePatch(patch, { quiet });
      if (!quiet) draw();
      return true;
    } catch (err) {
      if (err.fields) showFieldErrors(wrap, err.fields);
      toast(err.message, 'error');
      return false;
    } finally {
      if (btn) setBusy(btn, false);
    }
  }

  return { collect: () => null };
}
