-- המפלגה שלי — סכמת מסד הנתונים (Cloudflare D1 / SQLite)
-- תיעוד מלא: docs/DATA_MODEL.md

-- משתמשים: רק מה שהתקבל מ-Reem.bi ומה שנחוץ לתפעול. לא מוצג בפומבי.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- user.id מ-Reem.bi
  email         TEXT NOT NULL,
  name          TEXT,
  avatar        TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
);

-- מפלגות. owner_id ייחודי = מפלגה אחת למשתמש (נאכף במסד, לא רק בממשק).
CREATE TABLE parties (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL UNIQUE REFERENCES users(id),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  name_key        TEXT NOT NULL UNIQUE,      -- שם מנורמל, למניעת שתי מפלגות באותו שם
  acronym         TEXT NOT NULL DEFAULT '',
  slogan          TEXT NOT NULL DEFAULT '',
  short_desc      TEXT NOT NULL DEFAULT '',
  story           TEXT NOT NULL DEFAULT '',
  founded_on      TEXT,                      -- YYYY-MM-DD
  color_primary   TEXT NOT NULL DEFAULT '#1f4fd1',
  color_secondary TEXT NOT NULL DEFAULT '#ffc93c',
  category        TEXT NOT NULL DEFAULT 'daily',
  seriousness     INTEGER NOT NULL DEFAULT 2, -- 0..4
  emblem          TEXT NOT NULL DEFAULT '{}', -- JSON: הגדרות הסמל
  platform        TEXT NOT NULL DEFAULT '[]', -- JSON: סעיפי המצע
  leaders         TEXT NOT NULL DEFAULT '[]', -- JSON: חברי הנהלה
  campaign        TEXT NOT NULL DEFAULT '{}', -- JSON: טקסטי קמפיין
  contact_text    TEXT NOT NULL DEFAULT '',
  -- פרסום
  status          TEXT NOT NULL DEFAULT 'draft',   -- draft | published
  visibility      TEXT NOT NULL DEFAULT 'public',  -- public | private
  show_on_home    INTEGER NOT NULL DEFAULT 1,
  allow_share     INTEGER NOT NULL DEFAULT 1,
  allow_supporters INTEGER NOT NULL DEFAULT 1,
  allow_submissions INTEGER NOT NULL DEFAULT 1,
  show_supporter_count INTEGER NOT NULL DEFAULT 1,
  show_supporter_names INTEGER NOT NULL DEFAULT 0,
  show_contact    INTEGER NOT NULL DEFAULT 0,
  wizard_step     INTEGER NOT NULL DEFAULT 1,
  -- ניהול
  mod_status      TEXT NOT NULL DEFAULT 'ok',      -- ok | hidden | blocked
  mod_note        TEXT NOT NULL DEFAULT '',
  featured        INTEGER NOT NULL DEFAULT 0,
  featured_rank   INTEGER NOT NULL DEFAULT 0,
  home_hidden     INTEGER NOT NULL DEFAULT 0,      -- המנהל הוריד מדף הבית
  -- מונים
  supporters_count INTEGER NOT NULL DEFAULT 0,
  views_total     INTEGER NOT NULL DEFAULT 0,
  og_image_id     TEXT,
  -- זמנים
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  published_at    INTEGER
);
CREATE INDEX parties_listing ON parties (status, visibility, mod_status, published_at);
CREATE INDEX parties_category ON parties (category);

-- נתיבים ישנים: הפניה קבועה לנתיב החדש אחרי שינוי, ושמירת נתיב שנמחק.
CREATE TABLE slug_history (
  slug        TEXT PRIMARY KEY,
  party_id    TEXT,                -- NULL אחרי מחיקת המפלגה
  owner_id    TEXT NOT NULL,       -- רק הבעלים המקורי יכול להשתמש בו שוב
  reason      TEXT NOT NULL,       -- renamed | deleted
  created_at  INTEGER NOT NULL
);

-- תמונות (סמל, הנהלה, גלריה, תמונת שיתוף). נשמרות כ-BLOB אחרי בדיקת חתימת קובץ.
CREATE TABLE images (
  id          TEXT PRIMARY KEY,
  party_id    TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  kind        TEXT NOT NULL,       -- emblem | leader | gallery | og
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  bytes       BLOB NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX images_party ON images (party_id, kind);

-- תומכים. לא מוצגים בפומבי אלא אם גם התומך וגם המפלגה הסכימו.
CREATE TABLE supporters (
  id           TEXT PRIMARY KEY,
  party_id     TEXT NOT NULL,
  display_name TEXT NOT NULL,
  message      TEXT NOT NULL DEFAULT '',
  public_ok    INTEGER NOT NULL DEFAULT 0,
  client_key   TEXT NOT NULL UNIQUE,
  ip_hash      TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX supporters_party ON supporters (party_id, created_at);

-- פניות: רעיון למצע, שאלה, הצעת סיסמה (party_id), משוב/יצירת קשר/נגישות לאתר (party_id NULL).
CREATE TABLE submissions (
  id          TEXT PRIMARY KEY,
  party_id    TEXT,
  kind        TEXT NOT NULL,       -- idea | question | slogan | feedback | contact | accessibility
  name        TEXT NOT NULL DEFAULT '',
  contact     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',  -- new | read | archived | spam
  client_key  TEXT NOT NULL UNIQUE,
  ip_hash     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX submissions_party ON submissions (party_id, status, created_at);

-- דיווחים על מפלגות.
CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  party_id    TEXT NOT NULL,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  client_key  TEXT NOT NULL UNIQUE,
  ip_hash     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX reports_status ON reports (status, created_at);

-- בחירות פנימיות הומוריסטיות.
CREATE TABLE polls (
  id          TEXT PRIMARY KEY,
  party_id    TEXT NOT NULL,
  question    TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'custom',
  status      TEXT NOT NULL DEFAULT 'open',  -- open | closed
  results     TEXT NOT NULL DEFAULT 'after_vote', -- after_vote | always | after_close
  ends_at     INTEGER,
  created_at  INTEGER NOT NULL,
  closed_at   INTEGER
);
CREATE INDEX polls_party ON polls (party_id, status);

CREATE TABLE poll_options (
  id       TEXT PRIMARY KEY,
  poll_id  TEXT NOT NULL,
  label    TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX poll_options_poll ON poll_options (poll_id, position);

-- קול אחד לכל משתמש מחובר בכל הצבעה (מפתח ראשי משותף).
CREATE TABLE votes (
  poll_id    TEXT NOT NULL,
  voter_id   TEXT NOT NULL,
  option_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, voter_id)
);
CREATE INDEX votes_option ON votes (poll_id, option_id);

-- צפיות יומיות (משוער: ללא בוטים מוכרים, כולל צפיות חוזרות).
CREATE TABLE party_views (
  party_id TEXT NOT NULL,
  day      TEXT NOT NULL,
  views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (party_id, day)
);

-- פעולות אחרונות של בעל המפלגה (מוצג בדשבורד שלו).
CREATE TABLE party_activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX party_activity_party ON party_activity (party_id, created_at);

-- קטגוריות הומור (ניתנות לניהול).
CREATE TABLE categories (
  id       TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  emoji    TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  active   INTEGER NOT NULL DEFAULT 1
);

-- רעיונות טקסט שהמנהל הוסיף לספרייה (בנוסף לספרייה המובנית).
CREATE TABLE snippets (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  text       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- הגדרות כלליות (למשל תבניות סטודיו מושבתות).
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- יומן פעולות מנהל.
CREATE TABLE admin_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id   TEXT NOT NULL DEFAULT '',
  details     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

-- שגיאות תפעוליות (ללא טוקנים וללא תוכן פניות).
CREATE TABLE error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  route      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- הגבלת קצב (חלון קבוע). המפתח כולל גיבוב של IP או מזהה משתמש, לא IP גלוי.
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

INSERT INTO categories (id, label, emoji, position) VALUES
  ('daily',     'עניינים יומיומיים', '☕', 1),
  ('food',      'אוכל ונשנושים',     '🥙', 2),
  ('school',    'בית ספר ומבחנים',   '📚', 3),
  ('transport', 'תחבורה ואיחורים',   '🚌', 4),
  ('tech',      'טכנולוגיה ואינטרנט', '📱', 5),
  ('vacation',  'חופשות וחגים',      '🏖️', 6),
  ('bureaucracy','ועדות ובירוקרטיה', '📎', 7),
  ('family',    'משפחה ושכנים',       '🏠', 8),
  ('sport',     'ספורט וכושר (בערך)', '⚽', 9),
  ('absurd',    'אבסורד טהור',        '🦒', 10);
