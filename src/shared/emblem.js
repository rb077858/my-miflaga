// מחולל סמל המפלגה. משמש גם את השרת (דף ציבורי) וגם את הדפדפן (עורך, סטודיו, ייצוא).
// הסמל נבנה רק מתוך ערכים מאומתים (רשימות סגורות, צבעי הקס, טקסט אחרי בריחה).
import { esc, safeColor, readableOn, mix } from './escape.js';
import { iconMarkup, ICONS } from './icons.js';
import { EMBLEM_SHAPES, EMBLEM_STYLES, EMBLEM_EXTRAS } from './constants.js';

export const FONT_STACK = "Rubik, 'Segoe UI', Arial, sans-serif";

export const DEFAULT_EMBLEM = {
  shape: 'circle',
  style: 'flat',
  icon: 'star',
  extras: ['stars'],
  showLetters: true,
  image: null,
};

export function normalizeEmblem(raw) {
  const e = raw && typeof raw === 'object' ? raw : {};
  return {
    shape: EMBLEM_SHAPES[e.shape] ? e.shape : DEFAULT_EMBLEM.shape,
    style: EMBLEM_STYLES[e.style] ? e.style : DEFAULT_EMBLEM.style,
    icon: ICONS[e.icon] ? e.icon : DEFAULT_EMBLEM.icon,
    extras: Array.isArray(e.extras) ? [...new Set(e.extras.filter((x) => EMBLEM_EXTRAS[x]))].slice(0, 4) : [],
    showLetters: e.showLetters !== false,
    image: typeof e.image === 'string' && /^[a-zA-Z0-9_-]{8,40}$/.test(e.image) ? e.image : null,
  };
}

function shapePath(shape) {
  switch (shape) {
    case 'square': return 'M52 22 H148 A30 30 0 0 1 178 52 V148 A30 30 0 0 1 148 178 H52 A30 30 0 0 1 22 148 V52 A30 30 0 0 1 52 22Z';
    case 'hexagon': return 'M100 18 L171 59 V141 L100 182 L29 141 V59Z';
    case 'shield': return 'M100 18 L172 42 V98 C172 144 142 170 100 186 C58 170 28 144 28 98 V42Z';
    case 'badge': {
      const pts = [];
      for (let i = 0; i < 32; i++) {
        const r = i % 2 ? 76 : 84;
        const a = (Math.PI * 2 * i) / 32 - Math.PI / 2;
        pts.push(`${(100 + r * Math.cos(a)).toFixed(1)} ${(100 + r * Math.sin(a)).toFixed(1)}`);
      }
      return 'M' + pts.join(' L') + 'Z';
    }
    case 'ticket': return 'M24 40 A16 16 0 0 0 40 24 H160 A16 16 0 0 0 176 40 V84 A16 16 0 0 0 176 116 V160 A16 16 0 0 0 160 176 H40 A16 16 0 0 0 24 160 V116 A16 16 0 0 0 24 84Z';
    default: return 'M100 20 A80 80 0 1 1 99.99 20Z';
  }
}

function starPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return 'M' + pts.join(' L') + 'Z';
}

function laurel(color) {
  let leaves = '';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI / 180) * (110 + i * 17);
      const x = 100 + side * Math.cos(a) * 92 * -1;
      const y = 100 + Math.sin(a) * 92;
      const rot = side * (i * 17 + 20);
      leaves += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5" ry="10" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${color}"/>`;
    }
  }
  return leaves;
}

function rays(color) {
  let out = '';
  for (let i = 0; i < 16; i++) {
    const a1 = (Math.PI * 2 * i) / 16;
    const a2 = a1 + Math.PI / 24;
    out += `<path d="M100 100 L${(100 + 99 * Math.cos(a1)).toFixed(1)} ${(100 + 99 * Math.sin(a1)).toFixed(1)} L${(100 + 99 * Math.cos(a2)).toFixed(1)} ${(100 + 99 * Math.sin(a2)).toFixed(1)}Z" fill="${color}"/>`;
  }
  return out;
}

export function lettersFontSize(text, max = 52) {
  const n = [...String(text || '')].length;
  if (n <= 1) return max;
  if (n === 2) return max * 0.9;
  if (n === 3) return max * 0.76;
  if (n === 4) return max * 0.6;
  return max * 0.5;
}

/**
 * מחזיר מחרוזת <svg> מלאה של הסמל.
 * options.id — קידומת ייחודית למזהי clipPath/gradient (חשוב כשיש כמה סמלים בדף).
 * options.imageHref — כתובת התמונה שהועלתה (בייצוא מועבר data: URL).
 */
export function renderEmblem(party, options = {}) {
  const e = normalizeEmblem(party?.emblem);
  const p = safeColor(party?.color_primary, '#1f4fd1');
  const s = safeColor(party?.color_secondary, '#ffc93c');
  const id = String(options.id || 'em').replace(/[^a-zA-Z0-9_-]/g, '');
  const size = options.size || 200;
  const letters = String(party?.acronym || '').slice(0, 5);
  const showLetters = e.showLetters && letters.length > 0;
  const path = shapePath(e.shape);
  const imageHref = e.image ? (options.imageHref || `/img/${e.image}`) : null;

  let fill = p;
  let stroke = 'none';
  let strokeW = 0;
  let iconF = readableOn(p) === '#ffffff' ? '#ffffff' : '#141824';
  let iconA = s;
  let iconB = p;
  let letterColor = readableOn(p);
  let defs = '';
  let shadow = '';

  if (e.style === 'outline') {
    fill = '#ffffff';
    stroke = p;
    strokeW = 9;
    iconF = p;
    iconA = s;
    iconB = '#ffffff';
    letterColor = p;
  } else if (e.style === 'retro') {
    fill = s;
    stroke = p;
    strokeW = 7;
    iconF = p;
    iconA = '#ffffff';
    iconB = s;
    letterColor = readableOn(s) === '#ffffff' ? '#ffffff' : p;
    shadow = `<path d="${path}" transform="translate(7 7)" fill="${mix(p, '#000000', 0.35)}"/>`;
  } else if (e.style === 'gradient') {
    defs += `<linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p}"/><stop offset="1" stop-color="${mix(p, s, 0.55)}"/></linearGradient>`;
    fill = `url(#${id}-g)`;
    iconB = mix(p, s, 0.3);
  }
  if (iconA === iconF) iconA = mix(iconF, '#888888', 0.5);

  let back = '';
  if (e.extras.includes('rays')) back += `<g opacity=".35">${rays(s)}</g>`;
  if (e.extras.includes('laurel')) back += laurel(e.style === 'retro' ? p : s);

  let front = '';
  if (e.extras.includes('ring')) {
    front += `<path d="${path}" transform="translate(100 100) scale(.86) translate(-100 -100)" fill="none" stroke="${e.style === 'outline' ? s : (e.style === 'retro' ? p : '#ffffff')}" stroke-width="3" opacity=".9"/>`;
  }
  if (e.extras.includes('stars')) {
    const starColor = e.style === 'outline' ? s : (e.style === 'retro' ? p : s);
    [[-36, 150], [-18, 158], [0, 161], [18, 158], [36, 150]].forEach(([dx, y]) => {
      front += `<path d="${starPath(100 + dx, y + 4, 5.5)}" fill="${starColor}"/>`;
    });
  }

  let content;
  if (imageHref) {
    defs += `<clipPath id="${id}-c"><path d="${path}" transform="translate(100 100) scale(.92) translate(-100 -100)"/></clipPath>`;
    content = `<image href="${esc(imageHref)}" x="16" y="16" width="168" height="168" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-c)"/>`;
    if (showLetters) {
      content += `<rect x="50" y="142" width="100" height="34" rx="17" fill="${p}" opacity=".92"/>`;
      content += `<text x="100" y="166" text-anchor="middle" direction="rtl" font-family="${FONT_STACK}" font-weight="900" font-size="${Math.min(24, lettersFontSize(letters, 30))}" fill="${readableOn(p)}">${esc(letters)}</text>`;
    }
  } else {
    const icon = iconMarkup(e.icon, { f: iconF, a: iconA, b: iconB });
    if (showLetters) {
      const fs = lettersFontSize(letters, 50);
      content = `<g transform="translate(66 34) scale(.68)">${icon}</g>`;
      content += `<text x="100" y="${e.extras.includes('stars') ? 140 : 148}" text-anchor="middle" direction="rtl" font-family="${FONT_STACK}" font-weight="900" font-size="${fs.toFixed(1)}" fill="${letterColor}">${esc(letters)}</text>`;
    } else {
      content = `<g transform="translate(52 48) scale(.96)">${icon}</g>`;
    }
  }

  const title = esc(party?.name ? `סמל ${party.name}` : 'סמל המפלגה');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${title}"><defs>${defs}</defs>${back}${shadow}<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>${content}${front}</svg>`;
}

// הסמל כקבוצה פנימית (לשילוב בתוך תבניות SVG גדולות).
export function emblemInner(party, options = {}) {
  const svg = renderEmblem(party, options);
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}
