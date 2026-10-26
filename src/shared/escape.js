// בריחה בטוחה לטקסט שמוצג ב-HTML או ב-SVG. כל טקסט של משתמש עובר כאן לפני הצגה.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
}

// צבע הקס בלבד; כל ערך אחר מוחלף בברירת מחדל.
export function safeColor(value, fallback = '#1f4fd1') {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

// ניגודיות: צבע טקסט קריא על רקע נתון.
export function readableOn(hex) {
  const c = safeColor(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#141824' : '#ffffff';
}

export function mix(hexA, hexB, t) {
  const a = safeColor(hexA).slice(1);
  const b = safeColor(hexB).slice(1);
  const out = [0, 2, 4].map((i) => {
    const v = Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
    return v.toString(16).padStart(2, '0');
  });
  return '#' + out.join('');
}
