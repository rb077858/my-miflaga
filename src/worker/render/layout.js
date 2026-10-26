// מעטפת HTML משותפת לכל הדפים. כל טקסט משתמש עובר esc().
import { esc } from '../../shared/escape.js';
import { SITE_NAME, CLIENT_ID } from '../../shared/constants.js';
import { ASSET_VERSION } from '../version.js';

export function logoSvg(size = 36) {
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect x="10" y="4" width="44" height="56" rx="8" fill="var(--brand)"/>
    <rect x="16" y="12" width="32" height="20" rx="4" fill="#fff"/>
    <path d="M24 22 q8 8 16 0" stroke="var(--brand)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="25" cy="18" r="2.2" fill="var(--brand)"/><circle cx="39" cy="18" r="2.2" fill="var(--brand)"/>
    <path d="M18 40H46M18 48H38" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}

export function layout({
  title, description = '', canonical = '', origin = '', ogImage = '', ogType = 'website', body, scripts = [],
  bodyClass = '', noindex = false, themeColor = '#1f4fd1', jsonLd = null, pageData = null, announcement = '',
}) {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · מקימים מפלגה הומוריסטית`;
  const desc = description || 'הפלטפורמה להקמת מפלגות ישראליות הומוריסטיות: מצע, סמל, פתק הצבעה מצחיק ואתר משלכם לשיתוף.';
  const og = ogImage || `${origin}/assets/og-default.png`;
  const v = ASSET_VERSION;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta name="theme-color" content="${esc(themeColor)}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="he_IL">
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:title" content="${esc(title || SITE_NAME)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title || SITE_NAME)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(og)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/rubik-hebrew-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/rubik-hebrew-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/app.css?v=${v}">
<script src="/assets/js/theme.js?v=${v}"></script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${esc(bodyClass)}">
<a class="skip-link" href="#main">דילוג לתוכן הראשי</a>
${announcement ? `<div class="site-announcement" role="note">${esc(announcement)}</div>` : ''}
<header class="site-header" id="top">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(SITE_NAME)} — לדף הבית">${logoSvg()}<span class="brand-name">${esc(SITE_NAME)}</span></a>
    <nav class="main-nav" aria-label="ניווט ראשי">
      <ul>
        <li><a href="/#parties">המפלגות</a></li>
        <li><a href="/#how">איך זה עובד</a></li>
        <li><a href="/app/">המפלגה שלי</a></li>
      </ul>
    </nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="theme-toggle" aria-label="מעבר בין מצב בהיר לכהה" title="מצב בהיר/כהה">
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>
      </button>
      <div id="auth-slot" class="auth-slot" aria-live="polite"><span class="auth-loading" aria-label="בודקים התחברות"></span></div>
    </div>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <a class="brand" href="/">${logoSvg(28)}<span class="brand-name">${esc(SITE_NAME)}</span></a>
      <p class="muted">פלטפורמה להקמת מפלגות הומוריסטיות. שום דבר כאן אינו מפלגה רשמית, פתק הצבעה רשמי או גוף של ועדת הבחירות המרכזית.</p>
    </div>
    <nav aria-label="קישורי מידע">
      <ul class="footer-links">
        <li><a href="/contact/">יצירת קשר</a></li>
        <li><a href="/privacy/">מדיניות פרטיות</a></li>
        <li><a href="/terms/">תנאי שימוש</a></li>
        <li><a href="/accessibility/">הצהרת נגישות</a></li>
      </ul>
    </nav>
  </div>
</footer>
<div id="toasts" class="toasts" role="status" aria-live="polite" aria-atomic="false"></div>
${pageData ? `<script type="application/json" id="page-data">${JSON.stringify(pageData).replace(/</g, '\\u003c')}</script>` : ''}
<script src="https://login.reembir.com/sdk.js" defer></script>
<script type="module" src="/assets/js/site.js?v=${v}" data-client-id="${CLIENT_ID}"></script>
${scripts.map((s) => `<script type="module" src="${esc(s)}?v=${v}"></script>`).join('\n')}
</body>
</html>`;
}
