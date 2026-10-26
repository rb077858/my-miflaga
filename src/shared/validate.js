// ולידציה משותפת. השרת מריץ אותה תמיד; הדפדפן מריץ אותה כדי להציג שגיאות מוקדם.
import {
  LIMITS, PLATFORM_TOPICS, PLATFORM_STATUS, PRIORITIES, CAMPAIGN_FIELDS, RESERVED_SLUGS, BLOCKED_NAME_PARTS,
} from './constants.js';
import { normalizeEmblem } from './emblem.js';

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍‪-‮⁦-⁩]/g;

export function cleanText(value, { multiline = false } = {}) {
  let s = String(value ?? '').replace(CONTROL, '');
  s = s.replace(/\r\n?/g, '\n');
  if (!multiline) s = s.replace(/\s+/g, ' ');
  else s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export function len(s) {
  return [...String(s || '')].length;
}

function textField(errors, out, input, key, label, min, max, multiline = false) {
  if (!(key in input)) return;
  const v = cleanText(input[key], { multiline });
  if (len(v) < min) errors[key] = min > 0 ? `${label}: לפחות ${min} תווים` : `${label}: חסר`;
  else if (len(v) > max) errors[key] = `${label}: עד ${max} תווים`;
  else out[key] = v;
}

const bool = (v) => (v === true || v === 1 || v === '1' || v === 'on' || v === 'true' ? 1 : 0);
const uid = () => Math.random().toString(36).slice(2, 10);

export function nameKey(name) {
  return cleanText(name)
    .normalize('NFKC')
    .replace(/[֑-ׇ]/g, '') // ניקוד וטעמים
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

export function nameProblem(name) {
  const n = cleanText(name);
  const flat = n.replace(/[״"׳']/g, '"');
  for (const part of BLOCKED_NAME_PARTS) {
    const p = part.replace(/[״"׳']/g, '"');
    if (flat.includes(p)) return `השם לא יכול לכלול "${part}", כדי שאף אחד לא יחשוב שזה גוף רשמי או מפלגה אמיתית`;
  }
  return null;
}

const TRANSLIT = {
  א: 'a', ב: 'b', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'ch', ט: 't', י: 'y', כ: 'k', ך: 'k', ל: 'l',
  מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', ע: 'a', פ: 'p', ף: 'f', צ: 'tz', ץ: 'tz', ק: 'k', ר: 'r', ש: 'sh', ת: 't',
};

export function slugify(text) {
  const s = [...cleanText(text).toLowerCase()].map((c) => TRANSLIT[c] ?? c).join('');
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 40).replace(/-+$/, '');
}

export function slugProblem(slug) {
  const s = String(slug || '');
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(s)) return 'הנתיב: 3–40 תווים, אותיות באנגלית קטנות, ספרות ומקפים (לא בהתחלה או בסוף)';
  if (s.includes('--')) return 'הנתיב לא יכול לכלול שני מקפים ברצף';
  if (RESERVED_SLUGS.has(s)) return 'הנתיב הזה שמור למערכת. נסו משהו מקורי יותר';
  return null;
}

const TOPIC_IDS = new Set(PLATFORM_TOPICS.map((t) => t.id));
const STATUS_IDS = new Set(PLATFORM_STATUS.map((t) => t.value));
const PRIORITY_IDS = new Set(PRIORITIES.map((t) => t.value));
const IMAGE_ID = /^[a-zA-Z0-9_-]{8,40}$/;

function cleanPlatform(list, errors) {
  if (!Array.isArray(list)) { errors.platform = 'המצע אינו תקין'; return null; }
  if (list.length > LIMITS.platformItems) { errors.platform = `עד ${LIMITS.platformItems} סעיפים במצע`; return null; }
  const out = [];
  list.forEach((raw, i) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    const title = cleanText(item.title);
    const promise = cleanText(item.promise, { multiline: true });
    const explanation = cleanText(item.explanation, { multiline: true });
    if (len(title) < 2 || len(title) > 80) errors[`platform.${i}.title`] = `סעיף ${i + 1}: שם הסעיף צריך להיות 2–80 תווים`;
    if (len(promise) < 2 || len(promise) > 300) errors[`platform.${i}.promise`] = `סעיף ${i + 1}: הבטחת הבחירות צריכה להיות 2–300 תווים`;
    if (len(explanation) > 1000) errors[`platform.${i}.explanation`] = `סעיף ${i + 1}: ההסבר עד 1000 תווים`;
    out.push({
      id: /^[a-z0-9]{4,12}$/.test(item.id) ? item.id : uid(),
      topic: TOPIC_IDS.has(item.topic) ? item.topic : 'free',
      title, promise, explanation,
      priority: PRIORITY_IDS.has(Number(item.priority)) ? Number(item.priority) : 2,
      status: STATUS_IDS.has(item.status) ? item.status : 'proposal',
    });
  });
  return out;
}

function cleanLeaders(list, errors) {
  if (!Array.isArray(list)) { errors.leaders = 'רשימת ההנהלה אינה תקינה'; return null; }
  if (list.length > LIMITS.leaders) { errors.leaders = `עד ${LIMITS.leaders} חברי הנהלה`; return null; }
  return list.map((raw, i) => {
    const m = raw && typeof raw === 'object' ? raw : {};
    const name = cleanText(m.name);
    const role = cleanText(m.role);
    const bio = cleanText(m.bio, { multiline: true });
    const fictional = bool(m.fictional);
    const consent = bool(m.consent);
    if (len(name) < 2 || len(name) > 50) errors[`leaders.${i}.name`] = `חבר ${i + 1}: שם תצוגה 2–50 תווים`;
    if (len(role) < 2 || len(role) > 60) errors[`leaders.${i}.role`] = `חבר ${i + 1}: תפקיד 2–60 תווים`;
    if (len(bio) > 600) errors[`leaders.${i}.bio`] = `חבר ${i + 1}: ביוגרפיה עד 600 תווים`;
    if (!fictional && !consent) errors[`leaders.${i}.consent`] = `חבר ${i + 1}: יש לסמן שזו דמות בדויה, או לאשר שהאדם הסכים להופיע`;
    return {
      id: /^[a-z0-9]{4,12}$/.test(m.id) ? m.id : uid(),
      name, role, bio, fictional, consent: fictional ? 0 : consent,
      image: typeof m.image === 'string' && IMAGE_ID.test(m.image) ? m.image : null,
    };
  });
}

function cleanCampaign(obj, errors) {
  const c = obj && typeof obj === 'object' ? obj : {};
  const out = {};
  for (const f of CAMPAIGN_FIELDS) {
    const v = cleanText(c[f.id], { multiline: true });
    if (len(v) > f.max) errors[`campaign.${f.id}`] = `${f.label}: עד ${f.max} תווים`;
    out[f.id] = v;
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

/** מאמת עדכון חלקי של מפלגה. מחזיר { data, errors }. */
export function validatePartyInput(input, { categories } = {}) {
  const errors = {};
  const data = {};
  const src = input && typeof input === 'object' ? input : {};

  textField(errors, data, src, 'name', 'שם המפלגה', LIMITS.name[0], LIMITS.name[1]);
  if (data.name) {
    const problem = nameProblem(data.name);
    if (problem) { errors.name = problem; delete data.name; }
  }
  if ('acronym' in src) {
    const a = cleanText(src.acronym).replace(/\s/g, '');
    if (!/^[א-תa-zA-Z0-9"'״׳]{1,5}$/.test(a)) errors.acronym = 'ראשי תיבות: 1–5 אותיות (אפשר גרשיים)';
    else data.acronym = a;
  }
  textField(errors, data, src, 'slogan', 'סיסמת הבחירות', LIMITS.slogan[0], LIMITS.slogan[1]);
  textField(errors, data, src, 'short_desc', 'התיאור הקצר', LIMITS.short_desc[0], LIMITS.short_desc[1], true);
  textField(errors, data, src, 'story', 'סיפור ההקמה', LIMITS.story[0], LIMITS.story[1], true);
  textField(errors, data, src, 'contact_text', 'פרטי יצירת הקשר', LIMITS.contact_text[0], LIMITS.contact_text[1], true);

  if ('founded_on' in src) {
    const d = String(src.founded_on || '');
    if (d === '') data.founded_on = null;
    else if (!DATE.test(d) || Number.isNaN(Date.parse(d)) || d < '1900-01-01' || d > '2100-12-31') errors.founded_on = 'תאריך ההקמה אינו תקין';
    else data.founded_on = d;
  }
  for (const key of ['color_primary', 'color_secondary']) {
    if (key in src) {
      if (!COLOR.test(String(src[key] || ''))) errors[key] = 'צבע לא תקין';
      else data[key] = String(src[key]).toLowerCase();
    }
  }
  if ('category' in src) {
    const ok = categories ? categories.includes(src.category) : /^[a-z_]{2,20}$/.test(String(src.category));
    if (!ok) errors.category = 'יש לבחור קטגוריה מהרשימה';
    else data.category = src.category;
  }
  if ('seriousness' in src) {
    const n = Number(src.seriousness);
    if (!Number.isInteger(n) || n < 0 || n > 4) errors.seriousness = 'רמת רצינות לא תקינה';
    else data.seriousness = n;
  }
  if ('emblem' in src) data.emblem = normalizeEmblem(src.emblem);
  if ('platform' in src) { const p = cleanPlatform(src.platform, errors); if (p) data.platform = p; }
  if ('leaders' in src) { const l = cleanLeaders(src.leaders, errors); if (l) data.leaders = l; }
  if ('campaign' in src) data.campaign = cleanCampaign(src.campaign, errors);

  if ('visibility' in src) {
    if (!['public', 'private'].includes(src.visibility)) errors.visibility = 'יש לבחור ציבורית או פרטית';
    else data.visibility = src.visibility;
  }
  for (const key of ['show_on_home', 'allow_share', 'allow_supporters', 'allow_submissions', 'show_supporter_count', 'show_supporter_names', 'show_contact']) {
    if (key in src) data[key] = bool(src[key]);
  }
  if ('wizard_step' in src) {
    const n = Number(src.wizard_step);
    if (Number.isInteger(n) && n >= 1 && n <= 6) data.wizard_step = n;
  }
  return { data, errors };
}

// טפסים ציבוריים
export function validateSupporter(src) {
  const errors = {};
  const name = cleanText(src?.display_name);
  const message = cleanText(src?.message, { multiline: true });
  if (len(name) < 2 || len(name) > 40) errors.display_name = 'שם לתצוגה: 2–40 תווים';
  if (len(message) > 200) errors.message = 'ההודעה עד 200 תווים';
  if (!bool(src?.consent)) errors.consent = 'יש לאשר את תנאי ההצטרפות';
  return { data: { display_name: name, message, public_ok: bool(src?.public_ok) }, errors };
}

export function validateSubmission(src, allowedKinds) {
  const errors = {};
  const kind = String(src?.kind || '');
  const name = cleanText(src?.name);
  const contact = cleanText(src?.contact);
  const body = cleanText(src?.body, { multiline: true });
  if (!allowedKinds.includes(kind)) errors.kind = 'סוג פנייה לא תקין';
  if (len(name) > 40) errors.name = 'השם עד 40 תווים';
  if (len(contact) > 100) errors.contact = 'פרטי הקשר עד 100 תווים';
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact) && !/^[0-9+\-\s]{7,20}$/.test(contact)) errors.contact = 'אפשר להשאיר אימייל או מספר טלפון תקין, או להשאיר ריק';
  if (len(body) < 3 || len(body) > 1500) errors.body = 'התוכן: 3–1500 תווים';
  if (contact && !bool(src?.consent)) errors.consent = 'כדי שנשמור פרטי קשר, יש לאשר את השימוש בהם';
  return { data: { kind, name, contact, body }, errors };
}
