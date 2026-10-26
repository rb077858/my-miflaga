// האתר הציבורי של מפלגה: /party/<slug>/
import { safeColor } from '../../shared/escape.js';
import { DISCLAIMER } from '../../shared/constants.js';
import { partyBodyHtml } from '../../shared/party-view.js';
import { layout } from './layout.js';

export function renderParty({ origin, party, categories, formToken, gallery, announcement }) {
  const url = `${origin}/party/${encodeURIComponent(party.slug)}/`;
  const ogImage = party.og_image_id ? `${origin}/img/${party.og_image_id}` : `${origin}/assets/og-default.png`;
  const desc = party.short_desc || party.slogan || `${party.name} — מפלגה הומוריסטית`;
  const body = partyBodyHtml({ url, party, categories, formToken, gallery });

  return layout({
    title: party.name,
    description: desc.slice(0, 200),
    origin,
    canonical: url,
    ogImage,
    themeColor: safeColor(party.color_primary),
    body,
    bodyClass: 'page-party',
    announcement,
    scripts: ['/assets/js/party.js'],
    pageData: { party, url },
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Organization', name: party.name, slogan: party.slogan || undefined,
      description: desc, url, disambiguatingDescription: DISCLAIMER,
    },
  });
}

export function renderPartyUnavailable({ origin, reason }) {
  const blocked = reason === 'blocked';
  return layout({
    title: blocked ? 'המפלגה הושעתה' : 'המפלגה לא נמצאה',
    origin,
    noindex: true,
    body: `<section class="section"><div class="container narrow center">
      <div class="empty-illustration" aria-hidden="true">${blocked ? '🚧' : '🔍'}</div>
      <h1>${blocked ? 'המפלגה הושעתה' : 'המפלגה לא נמצאה'}</h1>
      <p class="lead">${blocked ? 'המפלגה הזאת הושעתה על ידי צוות האתר בעקבות הפרה של תנאי השימוש.' : 'אולי היא עדיין טיוטה, אולי היא פרטית, ואולי היא פשוט מאחרת כמו קו 5.'}</p>
      <a class="btn btn-primary" href="/#parties">לכל המפלגות</a>
    </div></section>`,
  });
}
