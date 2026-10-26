// קבועים משותפים לשרת ולדפדפן.

export const CLIENT_ID = 'party-maker';
export const SITE_NAME = 'המפלגה שלי';
export const DISCLAIMER = 'מפלגה הומוריסטית עצמאית, לא מפלגה רשמית ולא גוף של ועדת הבחירות המרכזית';
export const BALLOT_DISCLAIMER = 'פתק הומוריסטי - אינו פתק הצבעה רשמי';

export const SERIOUSNESS = [
  { value: 0, label: 'בדיחה מוחלטת' },
  { value: 1, label: 'צוחקים, אבל עם מצגת' },
  { value: 2, label: 'חצי רציני, חצי פלאפל' },
  { value: 3, label: 'כמעט אפשר להאמין לנו' },
  { value: 4, label: 'רציני למראה, מצחיק בתוכן' },
];

export const PLATFORM_TOPICS = [
  { id: 'transport', label: 'תחבורה ציבורית', icon: 'bus' },
  { id: 'food', label: 'אוכל בפנימייה ובבית הספר', icon: 'pita' },
  { id: 'homework', label: 'שיעורי בית', icon: 'book' },
  { id: 'cost', label: 'יוקר המחיה', icon: 'coin' },
  { id: 'holidays', label: 'חופשות וחגים', icon: 'sun' },
  { id: 'tech', label: 'אינטרנט וטכנולוגיה', icon: 'phone' },
  { id: 'friends', label: 'זכויות החברים', icon: 'heart' },
  { id: 'laws', label: 'חוקי המדינה ההומוריסטית שלנו', icon: 'scroll' },
  { id: 'free', label: 'נושא חופשי', icon: 'star' },
];

export const PLATFORM_STATUS = [
  { value: 'proposal', label: 'הצעה' },
  { value: 'approved', label: 'אושר' },
  { value: 'done', label: 'בוצע' },
];

export const PRIORITIES = [
  { value: 1, label: 'דחוף (אחרי הקפה)' },
  { value: 2, label: 'חשוב' },
  { value: 3, label: 'כשיהיה זמן' },
];

export const ROLE_PRESETS = [
  'יו"ר',
  'מנכ"ל',
  'דובר',
  'שר האוצר לענייני במבה',
  'שר התחבורה לענייני איחורים',
  'ממונה על המזגן',
  'ראש ועדת הוועדות',
  'שרת הנשנושים',
  'יועץ אסטרטגי (בעיקר לשבת)',
];

export const CAMPAIGN_FIELDS = [
  { id: 'flagship', label: 'הבטחת הדגל', rows: 2, max: 200 },
  { id: 'slogans', label: 'סיסמאות בחירות (אחת בכל שורה)', rows: 4, max: 600 },
  { id: 'speech', label: 'נאום פתיחה', rows: 8, max: 4000 },
  { id: 'announcement', label: 'הודעת הכרזה', rows: 5, max: 1500 },
  { id: 'flyer', label: 'טקסט לפלייר', rows: 4, max: 600 },
  { id: 'social', label: 'פוסט לרשתות חברתיות', rows: 4, max: 1000 },
  { id: 'faq', label: 'שאלות ותשובות (שאלה בשורה, תשובה בשורה שאחריה)', rows: 6, max: 3000 },
];

export const SUBMISSION_KINDS = {
  idea: 'רעיון למצע',
  question: 'שאלה למפלגה',
  slogan: 'הצעת סיסמה',
  feedback: 'משוב על האתר',
  contact: 'יצירת קשר',
  accessibility: 'דיווח על בעיית נגישות',
};
export const PARTY_SUBMISSION_KINDS = ['idea', 'question', 'slogan'];
export const SITE_SUBMISSION_KINDS = ['feedback', 'contact', 'accessibility'];

export const REPORT_REASONS = {
  offensive: 'תוכן פוגעני',
  impersonation: 'התחזות לגוף או לאדם אמיתי',
  personal: 'פרסום מידע אישי',
  spam: 'ספאם',
  other: 'אחר',
};

export const POLL_KINDS = {
  chair: 'בחירת יו"ר',
  slogan: 'הצבעה על סיסמת המפלגה',
  promises: 'דירוג הבטחות',
  bamba: 'בחירת שר הבמבה',
  platform: 'הצבעה על הצעה למצע',
  custom: 'שאלה חופשית',
};

export const EMBLEM_SHAPES = {
  circle: 'עיגול',
  shield: 'מגן',
  square: 'ריבוע מעוגל',
  hexagon: 'משושה',
  badge: 'תג משונן',
  ticket: 'כרטיס',
};
export const EMBLEM_STYLES = {
  flat: 'שטוח',
  outline: 'קווי',
  retro: 'רטרו',
  gradient: 'מעבר צבע',
};
export const EMBLEM_EXTRAS = {
  stars: 'כוכבים',
  laurel: 'זרי עלים',
  rays: 'קרני שמש',
  ring: 'טבעת כפולה',
};

export const LIMITS = {
  name: [2, 60],
  acronym: [1, 5],
  slogan: [0, 120],
  short_desc: [0, 280],
  story: [0, 3000],
  contact_text: [0, 300],
  platformItems: 30,
  leaders: 20,
  imageBytes: 700 * 1024,
  galleryImages: 12,
  leaderImages: 20,
  pollOptions: 10,
  openPolls: 5,
};

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'assets', 'img', 'party', 'parties', 'login', 'logout', 'about',
  'privacy', 'terms', 'accessibility', 'contact', 'sitemap', 'robots', 'static', 'www', 'new',
  'official', 'knesset', 'gov', 'bechirot', 'vaada', 'likud', 'meretz', 'shas', 'avoda', 'yesh-atid',
  'kahol-lavan', 'yisrael-beitenu', 'reem', 'reembi', 'null', 'undefined',
]);

// שמות ומילים שעלולים להטעות שמדובר בגוף רשמי או במפלגה אמיתית.
export const BLOCKED_NAME_PARTS = [
  'ועדת הבחירות', 'הכנסת', 'ממשלת ישראל', 'מדינת ישראל', 'רשמי', 'רשמית',
  'הליכוד', 'יש עתיד', 'ש"ס', 'יהדות התורה', 'ישראל ביתנו', 'מרצ', 'העבודה', 'הדמוקרטים',
  'כחול לבן', 'המחנה הממלכתי', 'הציונות הדתית', 'עוצמה יהודית', 'רע"מ', 'חד"ש', 'בל"ד', 'תע"ל',
];
