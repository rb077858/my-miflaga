// שלב 5: טקסטי הקמפיין. הכול ניתן לעריכה; ההצעות רק ממלאות טיוטה.
import { html, render } from '../core/dom.js';
import { store } from './state.js';
import { CAMPAIGN_FIELDS } from '../../shared/constants.js';
import { SLOGANS, SPEECHES, ANNOUNCEMENTS, SOCIAL_POSTS, FLYER_TEXTS, FAQ, PROMISES, pick, fill } from '../../shared/humor.js';
import { textArea, wireCounters } from './fields.js';
import { toast } from '../core/ui.js';

const SUGGESTERS = {
  flagship: () => pick(Object.values(PROMISES).flat()).promise,
  slogans: (cur) => [cur.trim(), pick(SLOGANS.filter((s) => !cur.includes(s)))].filter(Boolean).join('\n'),
  speech: () => pick(SPEECHES),
  announcement: () => pick(ANNOUNCEMENTS),
  flyer: () => pick(FLYER_TEXTS),
  social: () => pick(SOCIAL_POSTS),
  faq: (cur) => [cur.trim(), pick(FAQ.filter((s) => !cur.includes(s)))].filter(Boolean).join('\n'),
};

export default function stepCampaign(container) {
  const c = store.party.campaign || {};
  render(container, html`
    <p class="muted">הטקסטים האלה מופיעים באתר המפלגה ובתוצרי הסטודיו. "✨ הצעה" ממלאת טקסט לדוגמה. בסיסמאות ובשאלות ותשובות היא מוסיפה שורה, ובשאר השדות היא מחליפה את הטקסט.</p>
    ${CAMPAIGN_FIELDS.map((f) => textArea({ name: `campaign.${f.id}`, label: f.label, value: c[f.id] || '', rows: f.rows, max: f.max, suggest: true }))}`);
  wireCounters(container);
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest]');
    if (!btn) return;
    const id = btn.dataset.suggest.replace('campaign.', '');
    const el = container.querySelector(`[name="campaign.${id}"]`);
    el.value = fill(SUGGESTERS[id](el.value), store.party).slice(0, Number(el.maxLength) || 4000);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    toast('נוספה הצעה. היא שלכם עכשיו: ערכו, קצרו או מחקו.', 'info', 3000);
  });
  return {
    collect: () => {
      const campaign = {};
      for (const f of CAMPAIGN_FIELDS) campaign[f.id] = container.querySelector(`[name="campaign.${f.id}"]`).value;
      return { campaign };
    },
  };
}
