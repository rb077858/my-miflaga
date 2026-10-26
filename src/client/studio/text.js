// פריסת טקסט ל-SVG: גלישת שורות לפי מדידה אמיתית, הקטנת גופן לשמות ארוכים, וקיצור עם "…" כשאין ברירה.
import { esc } from '../../shared/escape.js';

export const RUBIK = "Rubik, 'Segoe UI', Arial, sans-serif";
export const SERIF = "'Frank Ruhl Libre', 'David', 'Times New Roman', serif";

let ctx = null;

/** מודד רוחב טקסט בפיקסלים. בדפדפן משתמש ב-canvas; בבדיקות אפשר להחליף. */
export let measure = (text, size, weight = 400, family = RUBIK) => {
  if (typeof document === 'undefined') return [...String(text)].length * size * 0.55;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${weight} ${size}px ${family}`;
  return ctx.measureText(String(text)).width;
};

export function setMeasure(fn) { measure = fn; }

export function wrap(text, { size, weight = 400, family = RUBIK, maxWidth, maxLines = 99 }) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (measure(test, size, weight, family) <= maxWidth || !line) {
        line = test;
        // מילה ארוכה במיוחד: חותכים לפי תווים
        while (measure(line, size, weight, family) > maxWidth && [...line].length > 1) {
          const chars = [...line];
          let cut = chars.length - 1;
          while (cut > 1 && measure(chars.slice(0, cut).join(''), size, weight, family) > maxWidth) cut--;
          lines.push(chars.slice(0, cut).join(''));
          line = chars.slice(cut).join('');
        }
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && measure(`${last}…`, size, weight, family) > maxWidth) last = [...last].slice(0, -1).join('');
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return { lines: kept, truncated: true };
  }
  return { lines, truncated: false };
}

/** מקטין את הגופן עד שהטקסט נכנס ב-maxLines שורות. */
export function fit(text, { size, minSize, weight = 400, family = RUBIK, maxWidth, maxLines = 2 }) {
  let s = size;
  while (s > minSize) {
    const r = wrap(text, { size: s, weight, family, maxWidth, maxLines: 99 });
    if (r.lines.length <= maxLines) return { size: s, lines: r.lines };
    s -= Math.max(1, Math.round(s * 0.06));
  }
  return { size: minSize, lines: wrap(text, { size: minSize, weight, family, maxWidth, maxLines }).lines };
}

/** מחזיר אלמנטים של SVG לשורות טקסט. align: center | right */
export function textBlock(lines, { x, y, size, weight = 400, family = RUBIK, fill, lineHeight = 1.25, align = 'center', extra = '' }) {
  const anchor = align === 'center' ? 'middle' : 'start';
  return lines.map((line, i) => `<text x="${x}" y="${(y + i * size * lineHeight).toFixed(1)}" text-anchor="${anchor}" direction="rtl" font-family="${esc(family)}" font-weight="${weight}" font-size="${size.toFixed(1)}" fill="${fill}" ${extra}>${esc(line)}</text>`).join('');
}

export function blockHeight(lines, size, lineHeight = 1.25) {
  return lines.length ? size + (lines.length - 1) * size * lineHeight : 0;
}
