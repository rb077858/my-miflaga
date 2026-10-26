# פריסה — צעד אחר צעד

המערכת רצה על **Cloudflare Workers** עם מסד נתונים **D1**. הפריסה מתבצעת אוטומטית מ-GitHub בכל מיזוג ל-`main`. אין Firebase, ואין צורך להתחבר לגוגל.

עלות צפויה: התוכנית החינמית של Cloudflare מספיקה (100,000 בקשות ביום ו-5GB במסד D1).

## 1. יצירת טוקן ב-Cloudflare (פעם אחת)

1. נכנסים ל-https://dash.cloudflare.com/profile/api-tokens ובוחרים **Create Token**.
2. בוחרים בתבנית **Edit Cloudflare Workers** ולוחצים **Use template**.
3. תחת **Permissions** מוסיפים שורה: **Account → D1 → Edit**.
4. תחת **Zone Resources** בוחרים **Specific zone → reembir.com** (נדרש עבור הכתובת miflaga.reembir.com).
5. לוחצים **Continue to summary** ואז **Create Token**, ומעתיקים את הטוקן. **אל תשלחו אותו לאף אחד, כולל בשיחה איתי.**
6. מעתיקים גם את ה-**Account ID**: בדף הבית של הדשבורד, בצד ימין.

## 2. סודות ב-GitHub (פעם אחת)

במאגר: **Settings → Secrets and variables → Actions → New repository secret**. מוסיפים ארבעה סודות:

| שם | ערך |
|---|---|
| `CLOUDFLARE_API_TOKEN` | הטוקן משלב 1 |
| `CLOUDFLARE_ACCOUNT_ID` | ה-Account ID |
| `ADMIN_EMAILS` | `rb077858@gmail.com` (כמה מנהלים: מופרדים בפסיקים) |
| `RATE_SALT` | מחרוזת אקראית ארוכה, לפחות 32 תווים. אפשר ליצור ב-PowerShell: `-join ((48..57)+(97..122) | Get-Random -Count 40 | % {[char]$_})` |

## 3. פריסה

1. ממזגים את ה-PR ל-`main`. לחלופין: **Actions → פריסה ל-Cloudflare → Run workflow**.
2. בפריסה הראשונה, ה-workflow יוצר לבד את מסד הנתונים `miflaga-db`, מריץ עליו את הסכמה, פורס את ה-Worker ומגדיר את הסודות.
3. הכתובת **miflaga.reembir.com** נוצרת אוטומטית, כי הדומיין reembir.com מנוהל באותו חשבון Cloudflare.
   - אם הדומיין בחשבון אחר, מוחקים את שורות `routes` מ-`wrangler.toml` ומשתמשים בכתובת `https://miflaga.<your-subdomain>.workers.dev`. במקרה כזה צריך גם לעדכן את `PUBLIC_ORIGIN` באותו קובץ.

## 4. הגדרת Reem.bi

לפי [REEMBI_SETUP.md](REEMBI_SETUP.md).

## 5. בדיקה אחרי הפריסה

1. https://miflaga.reembir.com/api/health מחזיר `{"ok":true,...}`.
2. בדף הבית מופיע מצב ריק ("עוד אין כאן מפלגות").
3. לוחצים **התחברות**, מתחברים ב-Reem.bi וחוזרים מחוברים, עם השם בפינה.
4. מקימים מפלגת ניסיון, מפרסמים, ופותחים את הקישור בחלון גלישה בסתר.
5. מורידים פתק PNG ו-PDF מדף המפלגה.
6. נכנסים ל-https://miflaga.reembir.com/admin/, ובלשונית "סקירה ותקינות" כל הבדיקות ירוקות.
7. בדשבורד של Reem.bi, בדף האתר, מופיעים הנתונים מהמניפסט.
8. שולחים את הקישור בוואטסאפ ובודקים שמופיעה תמונה.

## פריסה ידנית מהמחשב (לא חובה)

```powershell
npx wrangler login
npx wrangler d1 create miflaga-db        # מעתיקים את ה-database_id ל-wrangler.toml
npx wrangler d1 migrations apply miflaga-db --remote
npm run deploy
npx wrangler secret put ADMIN_EMAILS
npx wrangler secret put RATE_SALT
```

## משתני סביבה

| שם | סוג | חובה | תיאור |
|---|---|---|---|
| `ADMIN_EMAILS` | סוד | כן | מיילים של מנהלים. ההרשאה נבדקת בשרת מול המייל שמאומת ב-Reem.bi |
| `RATE_SALT` | סוד | כן | מלח לגיבוב כתובות IP ולחתימת טפסים |
| `PUBLIC_ORIGIN` | משתנה (`wrangler.toml`) | כן | הכתובת הציבורית, לקישורים קנוניים ולשיתוף |
| `DEV_MODE`, `SSO_ORIGIN` | פיתוח בלבד | לא | שרת התחברות מדומה לבדיקות. **לא להגדיר בפרודקשן** |

אין צורך ב-`SSO_SITE_KEY` כי האתר לא שולח מיילים, ואין צורך ב-`FIREBASE_SA_*` כי האתר לא משתמש ב-Firebase.

## גיבוי

- גיבוי חד-פעמי: `npx wrangler d1 export miflaga-db --remote --output backup.sql`.
- D1 שומר גם היסטוריה של 30 יום (Time Travel): `npx wrangler d1 time-travel info miflaga-db`.
