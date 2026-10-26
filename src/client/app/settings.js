// דף "פרסום והגדרות": הגדרות פרסום ופרטיות, ואזור מחיקה עם אישור מפורש.
import { html, render } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, confirmDialog } from '../core/ui.js';
import { store } from './state.js';
import stepPublish from './step-publish.js';

export default function settings(view, ctx) {
  render(view, html`
    <header class="page-head"><h1>⚙️ פרסום והגדרות</h1><p class="muted">כתובת, פרטיות, מה מבקרים יכולים לעשות, ופרסום.</p></header>
    <form class="card" id="settings-form" novalidate><div id="settings-body"></div></form>
    <section class="card danger-zone" aria-labelledby="danger-title">
      <h2 id="danger-title" class="h4">אזור מסוכן: מחיקת המפלגה</h2>
      <p>המחיקה סופית ולא ניתנת לביטול. יימחקו: פרטי המפלגה, הסמל והתמונות, המצע, ההנהגה, התומכים, הפניות, ההצבעות והסטטיסטיקות.</p>
      <ul class="muted small">
        <li>האתר הציבורי יפסיק לעבוד מיד.</li>
        <li>הכתובת <span dir="ltr">/party/${store.party.slug}/</span> תישמר עבורך בלבד, כדי שאף אחד אחר לא יתפוס אותה ויתחזה למפלגה שלך.</li>
        <li>אחרי המחיקה אפשר להקים מפלגה חדשה (עדיין אחת בכל פעם).</li>
      </ul>
      <button type="button" class="btn btn-danger" data-delete>🗑 מחיקת המפלגה לצמיתות</button>
    </section>`);
  const form = view.querySelector('#settings-form');
  form.addEventListener('submit', (e) => e.preventDefault());
  stepPublish(view.querySelector('#settings-body'), ctx);

  view.querySelector('[data-delete]').addEventListener('click', async () => {
    const name = store.party.name;
    const typed = await confirmDialog({
      title: 'למחוק את המפלגה לצמיתות?',
      body: 'זו פעולה סופית. אין סל מחזור, אין ועדת ערעורים.',
      confirmLabel: 'מחיקה סופית',
      danger: true,
      requireText: name,
    });
    if (!typed) return;
    try {
      await api('/api/me/party', { method: 'DELETE', body: { confirm: typed } });
      store.party = null;
      toast('המפלגה נמחקה. היה מצחיק כל עוד זה נמשך.', 'info', 6000);
      location.href = '/app/';
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
