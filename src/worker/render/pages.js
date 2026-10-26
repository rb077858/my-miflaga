// דפי מידע, מעטפות אפליקציה ודף שגיאה.
import { esc } from '../../shared/escape.js';
import { SITE_NAME } from '../../shared/constants.js';
import { layout } from './layout.js';

const UPDATED = 'אוקטובר 2026';

function infoPage({ origin, title, path, body, announcement }) {
  return layout({
    title,
    origin,
    canonical: `${origin}${path}`,
    announcement,
    body: `<article class="section"><div class="container narrow prose-page"><h1>${esc(title)}</h1>${body}<p class="muted small">עודכן לאחרונה: ${UPDATED}</p></div></article>`,
  });
}

function siteForm(kind, formToken, { heading, intro }) {
  return `<section class="card form-card" aria-labelledby="f-${kind}-title">
    <h2 id="f-${kind}-title">${esc(heading)}</h2>
    <p class="muted">${esc(intro)}</p>
    <form class="js-public-form" data-endpoint="/api/site/submit" novalidate>
      <input type="hidden" name="form_token" value="${esc(formToken)}">
      <input type="hidden" name="kind" value="${kind}">
      <div class="hp" aria-hidden="true"><label>אתר <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="field"><label for="${kind}-body">ההודעה <span class="req" aria-hidden="true">*</span></label>
        <textarea id="${kind}-body" name="body" rows="5" required minlength="3" maxlength="1500" aria-describedby="${kind}-body-err"></textarea><p class="field-error" id="${kind}-body-err"></p></div>
      <div class="field-row">
        <div class="field"><label for="${kind}-name">שם (לא חובה)</label><input id="${kind}-name" name="name" maxlength="40" autocomplete="name" aria-describedby="${kind}-name-err"><p class="field-error" id="${kind}-name-err"></p></div>
        <div class="field"><label for="${kind}-contact">אימייל או טלפון לתשובה (לא חובה)</label><input id="${kind}-contact" name="contact" maxlength="100" autocomplete="email" aria-describedby="${kind}-contact-err"><p class="field-error" id="${kind}-contact-err"></p></div>
      </div>
      <div class="check"><input type="checkbox" id="${kind}-consent" name="consent" value="1" aria-describedby="${kind}-consent-err"><label for="${kind}-consent">אם השארתי פרטי קשר: מותר להשתמש בהם רק כדי לחזור אליי</label></div>
      <p class="field-error" id="${kind}-consent-err"></p>
      <button class="btn btn-primary" type="submit">שליחה</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export function renderPrivacy({ origin, announcement }) {
  return infoPage({
    origin, announcement, title: 'מדיניות פרטיות', path: '/privacy/',
    body: `
<p>אנחנו אוספים כמה שפחות מידע. זו לא רק הבטחת בחירות, זה גם מה שהקוד עושה.</p>
<h2>מה נשמר</h2>
<ul>
  <li><strong>חשבון:</strong> ההתחברות מתבצעת דרך Reem.bi (login.reembir.com). אצלנו נשמרים רק מזהה המשתמש, האימייל, השם ותמונת הפרופיל שמתקבלים משם, לצורך זיהוי הבעלות על המפלגה. המידע הזה לא מוצג בפומבי.</li>
  <li><strong>תוכן המפלגה:</strong> כל מה שבעלי מפלגה כותבים או מעלים: שם, סמל, מצע, הנהגה, טקסטים ותמונות. מפלגה שפורסמה כציבורית גלויה לכולם. טיוטה או מפלגה פרטית גלויות רק לבעלים ולמנהל המערכת.</li>
  <li><strong>תומכים:</strong> שם לתצוגה והודעה קצרה. השם מוצג בפומבי רק אם גם התומך וגם המפלגה הסכימו לכך.</li>
  <li><strong>פניות:</strong> תוכן הפנייה, ואם בחרתם גם שם ופרטי קשר. הפניות גלויות רק למפלגה שקיבלה אותן ולמנהל המערכת (לטיפול בתלונות ובספאם).</li>
  <li><strong>הצבעות:</strong> לכל הצבעה נשמר מזהה המשתמש שהצביע, כדי למנוע הצבעה כפולה. בעלי המפלגה רואים רק סיכומים, לא מי הצביע למה.</li>
  <li><strong>מידע טכני:</strong> כדי למנוע ספאם נשמר גיבוב חד-כיווני של כתובת ה-IP (לא הכתובת עצמה). ספירת צפיות נשמרת כמספר יומי בלבד, בלי זיהוי מבקרים.</li>
</ul>
<h2>עוגיות ואחסון בדפדפן</h2>
<p>אין לנו עוגיות פרסום או מעקב. הדפדפן שומר את טוקן ההתחברות (דרך ספריית Reem.bi), את העדפת המצב הבהיר/כהה וטיוטה מקומית של אשף ההקמה.</p>
<h2>שמירה ומחיקה</h2>
<ul>
  <li>בעלי מפלגה יכולים למחוק את המפלגה בכל רגע מהאזור האישי. המחיקה כוללת את כל התוכן, התמונות, התומכים, הפניות וההצבעות של המפלגה, והיא סופית.</li>
  <li>אחרי מחיקה, הנתיב הציבורי של המפלגה נשמר לבעלים המקוריים בלבד, כדי שאף אחד אחר לא יתחזה למפלגה שנמחקה.</li>
  <li>פניות שסומנו כספאם נמחקות אוטומטית אחרי 30 יום. רישומי הגבלת קצב נמחקים אחרי יומיים.</li>
  <li>בקשות למחיקת מידע אחר: דרך <a href="/contact/">טופס יצירת הקשר</a>.</li>
</ul>
<h2>שירותים חיצוניים</h2>
<p>האתר מתארח ב-Cloudflare. ההתחברות מתבצעת דרך Reem.bi. לא נעשה שימוש בשירותי פרסום או אנליטיקה של צד שלישי.</p>`,
  });
}

export function renderTerms({ origin, announcement }) {
  return infoPage({
    origin, announcement, title: 'תנאי שימוש', path: '/terms/',
    body: `
<p>${esc(SITE_NAME)} היא פלטפורמה ליצירת מפלגות <strong>הומוריסטיות</strong>. נעים שבאתם, הנה הכללים.</p>
<h2>זה הומור, לא פוליטיקה רשמית</h2>
<ul>
  <li>המפלגות כאן אינן מפלגות רשומות, הפתקים אינם פתקי הצבעה, וההצבעות אינן סקרים מייצגים.</li>
  <li>אסור להציג מפלגה כמפלגה רשמית, להתחזות לגוף ממשלתי, לוועדת הבחירות המרכזית או למפלגה קיימת, או להשתמש בסמלי המדינה באופן מטעה.</li>
  <li>אסור להשתמש בפתקים שהופקו כאן בקלפי אמיתית או לנסות להטעות בוחרים.</li>
</ul>
<h2>מה אסור לפרסם</h2>
<ul>
  <li>תוכן פוגעני, גזעני, מסית, אלים או מיני.</li>
  <li>פרטים אישיים של אדם אחר, או הצגה של אדם אמיתי כבעל תפקיד בלי הסכמתו.</li>
  <li>ספאם, פרסומות או קישורים מזיקים.</li>
  <li>תוכן שמפר זכויות יוצרים.</li>
</ul>
<h2>מפלגה אחת לכל משתמש</h2>
<p>לכל חשבון מותרת מפלגה אחת (גם טיוטה נחשבת). אפשר לערוך ולפרסם אותה בלי הגבלה. מי שרוצה להתחיל מחדש יכול למחוק את המפלגה מהאזור האישי ולהקים חדשה.</p>
<h2>ניהול תוכן</h2>
<p>צוות האתר רשאי להסתיר, להשעות, לערוך או למחוק תוכן שמפר את התנאים. כל פעולה כזאת נרשמת ביומן פנימי. אפשר לדווח על תוכן בעייתי מכל דף מפלגה.</p>
<h2>אחריות</h2>
<p>האתר ניתן כפי שהוא, בלי התחייבות לזמינות רצופה. כל בעל מפלגה אחראי לתוכן שהוא מפרסם.</p>`,
  });
}

export function renderAccessibility({ origin, formToken, announcement }) {
  return infoPage({
    origin, announcement, title: 'הצהרת נגישות', path: '/accessibility/',
    body: `
<p>אנחנו רוצים שכל אחד יוכל להקים מפלגה הומוריסטית, כולל אנשים עם מוגבלות. האתר נבנה מתוך כוונה לעמוד ברמה AA של הנחיות WCAG 2.1 ובתקן הישראלי 5568.</p>
<h2>מה עשינו</h2>
<ul>
  <li>מבנה HTML סמנטי, כותרות בסדר היררכי ואזורי ניווט מסומנים.</li>
  <li>תמיכה מלאה בעברית ובכיוון מימין לשמאל.</li>
  <li>ניווט מלא במקלדת, קישור "דילוג לתוכן" וסימון מיקוד בולט.</li>
  <li>תוויות לכל שדות הטפסים, והודעות שגיאה מקושרות לשדה ומוקראות לקוראי מסך.</li>
  <li>ניגודיות צבעים מספקת במצב בהיר ובמצב כהה. כשבעלי מפלגה בוחרים צבעים, צבע הטקסט נבחר אוטומטית כך שיהיה קריא.</li>
  <li>טקסט חלופי לסמלים ולתמונות.</li>
  <li>האתר מכבד את הגדרת המערכת "הפחתת תנועה" ומבטל אנימציות.</li>
  <li>תמיכה בהגדלת טקסט עד 200% בלי אובדן תוכן, ותצוגה מותאמת לנייד.</li>
  <li>חלונות קופצים נגישים: מיקוד עובר אליהם, ומקש Escape סוגר אותם.</li>
</ul>
<h2>מגבלות ידועות</h2>
<ul>
  <li>תוצרי הסטודיו (פתקים, פליירים ופוסטים) הם תמונות או PDF. הטקסט שבהם מופיע גם בדף המפלגה בפורמט נגיש.</li>
  <li>תוכן שמשתמשים מעלים (למשל תמונות של חברי הנהלה) עלול להיות חסר תיאור מפורט. התיאור החלופי ברירת המחדל הוא שם האדם.</li>
</ul>
<h2>נתקלתם בבעיה?</h2>
<p>נשמח לשמוע ולתקן. אפשר לדווח בטופס כאן. אם השארתם פרטי קשר, נחזור אליכם בהקדם.</p>
${siteForm('accessibility', formToken, { heading: 'דיווח על בעיית נגישות', intro: 'תארו מה ניסיתם לעשות, באיזה דף, ועם איזה דפדפן או טכנולוגיה מסייעת.' })}`,
  });
}

export function renderContact({ origin, formToken, announcement }) {
  return infoPage({
    origin, announcement, title: 'יצירת קשר', path: '/contact/',
    body: `
<p>שאלה, הצעה, באג או סתם מחמאה? אנחנו כאן. בלי מוקד, בלי מוזיקת המתנה.</p>
${siteForm('contact', formToken, { heading: 'שליחת הודעה לצוות', intro: 'להודעות על תוכן פוגעני במפלגה מסוימת, עדיף להשתמש בכפתור הדיווח שבדף המפלגה.' })}
${siteForm('feedback', formToken, { heading: 'משוב על האתר', intro: 'מה עבד? מה הצחיק? מה היה מבלבל? כל משוב עוזר.' })}`,
  });
}

export function renderAppShell({ origin, kind = 'app', announcement }) {
  const admin = kind === 'admin';
  return layout({
    title: admin ? 'ניהול המערכת' : 'האזור האישי',
    origin,
    noindex: true,
    announcement,
    bodyClass: admin ? 'page-admin' : 'page-app',
    body: `<div id="app-root" class="app-root" data-kind="${kind}"><div class="container app-loading" role="status"><span class="spinner" aria-hidden="true"></span> טוענים… (מהר יותר מאוטובוס, מבטיחים)</div></div>`,
    scripts: [admin ? '/assets/js/admin.js' : '/assets/js/app.js'],
  });
}

export function renderCallback({ origin }) {
  return layout({
    title: 'מתחברים…',
    origin,
    noindex: true,
    body: `<section class="section"><div class="container narrow center" role="status"><span class="spinner" aria-hidden="true"></span><p>מסיימים את ההתחברות…</p></div></section>`,
    scripts: ['/assets/js/callback.js'],
  });
}

export function renderNotFound({ origin }) {
  return layout({
    title: 'הדף לא נמצא',
    origin,
    noindex: true,
    body: `<section class="section"><div class="container narrow center">
      <div class="empty-illustration" aria-hidden="true">🧭</div>
      <h1>404: הדף הלך לאיבוד</h1>
      <p class="lead">חיפשנו בכל מקום, כולל מתחת לספה. הדף הזה לא קיים, או שהוא בוועדה.</p>
      <div class="hero-cta center"><a class="btn btn-primary" href="/">לדף הבית</a><a class="btn btn-ghost" href="/#parties">לכל המפלגות</a></div>
    </div></section>`,
  });
}

export function renderError({ origin }) {
  return layout({
    title: 'תקלה',
    origin,
    noindex: true,
    body: `<section class="section"><div class="container narrow center">
      <div class="empty-illustration" aria-hidden="true">🔧</div>
      <h1>משהו השתבש</h1>
      <p class="lead">זה לא אתם, זה אנחנו. התקלה נרשמה ונטפל בה. נסו לרענן בעוד רגע.</p>
      <a class="btn btn-primary" href="/">לדף הבית</a>
    </div></section>`,
  });
}
