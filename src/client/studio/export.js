// הפקת קבצים מתבניות: SVG → Canvas → PNG/JPEG → PDF. הכול בדפדפן, מהנתונים האמיתיים של המפלגה.
import { TEMPLATE_MAP } from './templates.js';
import { buildPdf, PAGE } from './pdf.js';
import { slugify } from '../../shared/validate.js';

const FONT_FILES = [
  ['Rubik', 400, 'rubik-hebrew-400-normal'], ['Rubik', 400, 'rubik-latin-400-normal'],
  ['Rubik', 500, 'rubik-hebrew-500-normal'], ['Rubik', 500, 'rubik-latin-500-normal'],
  ['Rubik', 700, 'rubik-hebrew-700-normal'], ['Rubik', 700, 'rubik-latin-700-normal'],
  ['Rubik', 900, 'rubik-hebrew-900-normal'], ['Rubik', 900, 'rubik-latin-900-normal'],
  ['Frank Ruhl Libre', 700, 'frank-ruhl-libre-hebrew-700-normal'], ['Frank Ruhl Libre', 700, 'frank-ruhl-libre-latin-700-normal'],
  ['Frank Ruhl Libre', 900, 'frank-ruhl-libre-hebrew-900-normal'], ['Frank Ruhl Libre', 900, 'frank-ruhl-libre-latin-900-normal'],
];
const HEBREW_RANGE = 'U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F';
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

let fontCss = null;

function bytesToBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

async function embeddedFonts() {
  if (!fontCss) {
    fontCss = Promise.all(FONT_FILES.map(async ([family, weight, file]) => {
      const res = await fetch(`/assets/fonts/${file}.woff2`);
      if (!res.ok) throw new Error('font');
      const b64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()));
      const range = file.includes('hebrew') ? HEBREW_RANGE : LATIN_RANGE;
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}`;
    })).then((list) => list.join('')).catch((err) => { fontCss = null; throw err; });
  }
  return fontCss;
}

export async function ensureFonts() {
  if (!document.fonts?.load) return;
  const sample = 'אבגדהוזחטיכלמנסעפצקרשת abc 123';
  await Promise.all([400, 500, 700, 900].map((w) => document.fonts.load(`${w} 40px Rubik`, sample)));
  await Promise.all([700, 900].map((w) => document.fonts.load(`${w} 40px "Frank Ruhl Libre"`, sample))).catch(() => {});
}

async function toDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('image');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

let uidCounter = 0;

/** בונה את ה-SVG של תבנית. forExport = תמונות מוטמעות כ-data URL. */
export async function buildSvg(templateId, party, opts = {}, { url, forExport = false } = {}) {
  const tpl = TEMPLATE_MAP[templateId];
  if (!tpl) throw new Error('תבנית לא קיימת');
  await ensureFonts();
  let emblemImage = null;
  if (party.emblem?.image) {
    emblemImage = forExport ? await toDataUrl(`/img/${party.emblem.image}`).catch(() => null) : `/img/${party.emblem.image}`;
  }
  const ctx = { url, emblemImage, uid: `u${++uidCounter}` };
  return { svg: tpl.build(party, ctx, opts), template: tpl };
}

async function svgToCanvas(svg, width, height, scale) {
  const fonts = await embeddedFonts();
  const withFonts = svg.replace(/^<svg([^>]*)>/, `<svg$1><defs><style>${fonts}</style></defs>`);
  const blob = new Blob([withFonts], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const c2d = canvas.getContext('2d');
    c2d.fillStyle = '#ffffff';
    c2d.fillRect(0, 0, canvas.width, canvas.height);
    // ציור כפול: הדפדפן לפעמים מסיים לפענח גופנים מוטמעים רק אחרי הציור הראשון
    c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    await new Promise((r) => setTimeout(r, 60));
    c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export'))), type, quality));
}

export async function renderBlob(templateId, party, opts, { url, type = 'image/png', quality = 0.92, scale } = {}) {
  const { svg, template } = await buildSvg(templateId, party, opts, { url, forExport: true });
  const canvas = await svgToCanvas(svg, template.width, template.height, scale || template.exportScale || 1);
  return canvasBlob(canvas, type, quality);
}

export async function renderPdf(templateId, party, opts, { url }) {
  const { svg, template } = await buildSvg(templateId, party, opts, { url, forExport: true });
  const canvas = await svgToCanvas(svg, template.width, template.height, template.exportScale || 2);
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.93)).arrayBuffer());
  const page = PAGE[template.print || 'A4'];
  const bytes = buildPdf([{ jpeg, width: canvas.width, height: canvas.height, pageW: page.w, pageH: page.h }], { title: `${template.label} — ${party.name}` });
  return new Blob([bytes], { type: 'application/pdf' });
}

export function fileName(party, templateId, ext) {
  const base = slugify(party.slug || party.name) || 'party';
  return `${base}-${templateId}.${ext}`;
}

export function download(blob, name) {
  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}
