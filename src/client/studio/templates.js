// תבניות הסטודיו. כל תבנית בונה SVG מהנתונים האמיתיים של המפלגה (שם, סמל, צבעים, מצע, טקסטים).
import qrcode from 'qrcode-generator';
import { esc, safeColor, readableOn, mix } from '../../shared/escape.js';
import { emblemInner } from '../../shared/emblem.js';
import { BALLOT_DISCLAIMER, DISCLAIMER } from '../../shared/constants.js';
import { RUBIK, SERIF, fit, wrap, textBlock, blockHeight } from './text.js';

const INK = '#141824';
const RED = '#c62828';

function colors(party) {
  const p = safeColor(party.color_primary);
  const s = safeColor(party.color_secondary, '#ffc93c');
  return { p, s, onP: readableOn(p), onS: readableOn(s), deep: mix(p, '#000000', 0.35), soft: mix(p, '#ffffff', 0.88) };
}

function emblemAt(party, ctx, x, y, size, key) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 200 200">${emblemInner(party, { id: `${key}-${ctx.uid}`, imageHref: ctx.emblemImage })}</svg>`;
}

function background(w, h, c, style, key) {
  if (style === 'light') {
    return `<rect width="${w}" height="${h}" fill="#fffdf7"/><rect x="0" y="0" width="${w}" height="${Math.round(h * 0.012) + 8}" fill="${c.p}"/>`;
  }
  let pattern = '';
  if (style === 'pattern') {
    pattern = `<defs><pattern id="pt-${key}" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="60" height="60" fill="${c.p}"/><rect width="18" height="60" fill="${c.s}" opacity=".16"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#pt-${key})"/>`;
  } else if (style === 'dots') {
    pattern = `<defs><pattern id="pt-${key}" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="${c.p}"/><circle cx="24" cy="24" r="5" fill="${c.s}" opacity=".28"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#pt-${key})"/>`;
  } else {
    pattern = `<defs><linearGradient id="bg-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.p}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#bg-${key})"/>`;
  }
  return pattern;
}

export function qrSvg(text, x, y, size, color = INK) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${((c + quiet) * cell).toFixed(2)} ${((r + quiet) * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
    }
  }
  return `<g transform="translate(${x} ${y})"><rect width="${size}" height="${size}" rx="${size * 0.04}" fill="#ffffff"/><path d="${d}" fill="${color}" shape-rendering="crispEdges"/></g>`;
}

function topPromises(party, count = 3) {
  const items = [...(party.platform || [])].sort((a, b) => (a.priority || 2) - (b.priority || 2)).slice(0, count)
    .map((i) => ({ title: i.title, text: i.promise }));
  if (items.length < count && party.campaign?.flagship) items.unshift({ title: 'הבטחת הדגל', text: party.campaign.flagship });
  return items.slice(0, count);
}

function shortUrl(ctx) {
  return ctx.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function svgWrap(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">${body}</svg>`;
}

// ---------- פתק הצבעה ----------
function ballotBody(party, ctx, opts, key) {
  const W = 900;
  const H = 1300;
  const c = colors(party);
  let out = `<rect width="${W}" height="${H}" fill="#fffdf7"/>`;
  out += `<rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="18" fill="none" stroke="${c.p}" stroke-width="8"/>`;
  out += `<rect x="42" y="42" width="${W - 84}" height="${H - 84}" rx="10" fill="none" stroke="${c.p}" stroke-width="2" stroke-dasharray="10 8"/>`;
  out += `<text x="${W / 2}" y="${H * 0.62}" text-anchor="middle" direction="rtl" font-family="${esc(RUBIK)}" font-weight="900" font-size="190" fill="${c.p}" opacity=".05" transform="rotate(-28 ${W / 2} ${H * 0.55})">הומוריסטי</text>`;
  out += `<text x="${W / 2}" y="104" text-anchor="middle" direction="rtl" font-family="${esc(RUBIK)}" font-weight="700" font-size="32" fill="${c.p}" letter-spacing="2">פתק הומוריסטי · ${esc(shortUrl(ctx).split('/')[0])}</text>`;
  out += emblemAt(party, ctx, W / 2 - 130, 140, 260, `${key}-e`);
  const letters = party.acronym || '';
  let y = 470;
  if (letters) {
    const f = fit(letters, { size: 280, minSize: 110, weight: 900, maxWidth: 740, maxLines: 1 });
    out += textBlock(f.lines, { x: W / 2, y: y + f.size * 0.82, size: f.size, weight: 900, fill: INK });
    y += f.size + 30;
  }
  const name = fit(party.name, { size: 74, minSize: 38, weight: 700, maxWidth: 760, maxLines: 3 });
  out += textBlock(name.lines, { x: W / 2, y: y + name.size, size: name.size, weight: 700, fill: INK, lineHeight: 1.18 });
  y += blockHeight(name.lines, name.size, 1.18) + 40;
  if (opts.showSlogan !== false && party.slogan) {
    const sl = wrap(`"${party.slogan}"`, { size: 36, maxWidth: 740, maxLines: 2 });
    out += textBlock(sl.lines, { x: W / 2, y: Math.min(y + 36, H - 260), size: 36, fill: mix(INK, '#ffffff', 0.35) });
  }
  out += `<rect x="42" y="${H - 172}" width="${W - 84}" height="110" rx="10" fill="${RED}"/>`;
  const disc = fit(BALLOT_DISCLAIMER, { size: 44, minSize: 26, weight: 900, maxWidth: W - 140, maxLines: 1 });
  out += textBlock(disc.lines, { x: W / 2, y: H - 103, size: disc.size, weight: 900, fill: '#ffffff' });
  return out;
}

const ballot = {
  id: 'ballot', label: 'פתק הצבעה הומוריסטי', description: 'פתק בודד לשיתוף כתמונה. מסומן בבירור שאינו פתק רשמי.',
  width: 900, height: 1300, exportScale: 1.5,
  options: ['showSlogan'],
  build(party, ctx, opts) {
    return svgWrap(900, 1300, ballotBody(party, ctx, opts, 'b'), `פתק הומוריסטי של ${party.name}`);
  },
};

const ballotSheet = {
  id: 'ballot-sheet', label: 'דף פתקים להדפסה (A4)', description: 'ארבעה פתקים בדף A4 עם קווי חיתוך, מוכן להדפסה.',
  width: 1240, height: 1754, exportScale: 2, print: 'A4',
  options: ['showSlogan'],
  build(party, ctx, opts) {
    const W = 1240;
    const H = 1754;
    const top = 120;
    const gap = 24;
    const bh = (H - top - 50 - gap) / 2;
    const bw = bh * (900 / 1300);
    const left = (W - bw * 2 - gap) / 2;
    let out = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
    out += textBlock(['פתקים הומוריסטיים להדפסה · אינם פתקי הצבעה רשמיים · גזרו לאורך הקווים המקווקווים'], { x: W / 2, y: 70, size: 24, weight: 700, fill: INK });
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        const x = left + col * (bw + gap);
        const y = top + r * (bh + gap);
        out += `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" viewBox="0 0 900 1300">${ballotBody(party, ctx, opts, `s${r}${col}`)}</svg>`;
      }
    }
    const cx = left + bw + gap / 2;
    const cy = top + bh + gap / 2;
    out += `<path d="M${cx} ${top - 20} V${H - 30} M${left - 20} ${cy} H${W - left + 20}" stroke="#888" stroke-width="1.5" stroke-dasharray="8 6"/>`;
    out += `<text x="${left - 10}" y="${cy - 6}" font-size="22" text-anchor="end" fill="#888">✂</text>`;
    return svgWrap(W, H, out, `דף פתקים הומוריסטיים של ${party.name}`);
  },
};

// ---------- פלייר A4 ----------
const flyer = {
  id: 'flyer', label: 'פלייר A4', description: 'סמל, סיסמה, שלוש הבטחות בחירות ו-QR לאתר המפלגה.',
  width: 1240, height: 1754, exportScale: 2, print: 'A4',
  options: ['headline', 'style', 'showQr'],
  build(party, ctx, opts) {
    const W = 1240;
    const H = 1754;
    const c = colors(party);
    const heroH = 780;
    let out = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
    out += `<svg x="0" y="0" width="${W}" height="${heroH}">${background(W, heroH, c, opts.style || 'pattern', 'fl')}</svg>`;
    out += `<path d="M0 ${heroH - 40} Q${W / 2} ${heroH + 50} ${W} ${heroH - 40} V${heroH + 10} H0Z" fill="#ffffff"/>`;
    out += `<circle cx="${W / 2}" cy="${70 + 150}" r="168" fill="#ffffff" opacity=".18"/>`;
    out += emblemAt(party, ctx, W / 2 - 150, 70, 300, 'fl');
    let y = 420;
    if (party.acronym) {
      out += `<rect x="${W / 2 - 110}" y="${y}" width="220" height="70" rx="35" fill="${c.s}"/>`;
      out += textBlock([party.acronym], { x: W / 2, y: y + 52, size: 46, weight: 900, fill: c.onS });
      y += 100;
    }
    const name = fit(party.name, { size: 96, minSize: 48, weight: 900, maxWidth: 1080, maxLines: 2 });
    out += textBlock(name.lines, { x: W / 2, y: y + name.size * 0.9, size: name.size, weight: 900, fill: c.onP, lineHeight: 1.1 });
    y += blockHeight(name.lines, name.size, 1.1) + 24;
    if (party.slogan) {
      const sl = fit(`"${party.slogan}"`, { size: 44, minSize: 30, weight: 500, maxWidth: 1040, maxLines: 2 });
      out += textBlock(sl.lines, { x: W / 2, y: Math.min(y + sl.size, heroH - 70), size: sl.size, weight: 500, fill: c.onP === '#ffffff' ? c.s : INK });
    }
    const headline = opts.headline || party.campaign?.flyer?.split('\n')[0] || 'שלוש הבטחות שאי אפשר לסרב להן';
    const hl = fit(headline, { size: 52, minSize: 34, weight: 900, maxWidth: 1080, maxLines: 2 });
    let by = heroH + 70;
    out += textBlock(hl.lines, { x: W / 2, y: by + hl.size * 0.8, size: hl.size, weight: 900, fill: c.p });
    by += blockHeight(hl.lines, hl.size) + 50;
    const promises = topPromises(party, 3);
    const qr = opts.showQr !== false;
    const textRight = W - 90;
    const textWidth = qr ? 700 : 1000;
    if (!promises.length) {
      out += textBlock(['המצע בהכנה. גם זו עמדה.'], { x: W / 2, y: by + 40, size: 36, fill: '#555' });
    }
    promises.forEach((pr, i) => {
      out += `<circle cx="${textRight - 30}" cy="${by + 26}" r="34" fill="${c.s}"/>`;
      out += textBlock([String(i + 1)], { x: textRight - 30, y: by + 40, size: 40, weight: 900, fill: c.onS });
      const t = wrap(pr.title, { size: 38, weight: 700, maxWidth: textWidth, maxLines: 1 });
      out += textBlock(t.lines, { x: textRight - 90, y: by + 38, size: 38, weight: 700, fill: INK, align: 'right' });
      const body = wrap(pr.text, { size: 30, maxWidth: textWidth, maxLines: 3 });
      out += textBlock(body.lines, { x: textRight - 90, y: by + 88, size: 30, fill: '#3b4252', align: 'right', lineHeight: 1.3 });
      by += 100 + blockHeight(body.lines, 30, 1.3) + 34;
    });
    if (qr) {
      const qy = heroH + 260;
      out += qrSvg(ctx.url, 90, qy, 280, c.deep);
      out += textBlock(['סרקו והצטרפו'], { x: 230, y: qy + 330, size: 32, weight: 700, fill: c.p });
    }
    const url = fit(shortUrl(ctx), { size: 30, minSize: 18, weight: 500, maxWidth: 1060, maxLines: 1 });
    out += `<g direction="ltr"><text x="${W / 2}" y="${H - 130}" text-anchor="middle" font-family="${esc(RUBIK)}" font-weight="500" font-size="${url.size}" fill="${c.p}">${esc(url.lines[0])}</text></g>`;
    out += `<rect x="0" y="${H - 90}" width="${W}" height="90" fill="${c.p}"/>`;
    const d = fit(DISCLAIMER, { size: 26, minSize: 18, weight: 500, maxWidth: W - 80, maxLines: 1 });
    out += textBlock(d.lines, { x: W / 2, y: H - 36, size: d.size, weight: 500, fill: c.onP });
    return svgWrap(W, H, out, `פלייר של ${party.name}`);
  },
};

// ---------- פוסט מרובע / סטורי ----------
function socialCard(party, ctx, opts, W, H, key) {
  const c = colors(party);
  let out = background(W, H, c, opts.style || 'gradient', key);
  const emSize = Math.round(Math.min(W, H) * 0.36);
  const isStory = H > W * 1.5;
  let y = isStory ? 260 : 90;
  if (opts.headline) {
    const hl = fit(opts.headline, { size: 54, minSize: 34, weight: 900, maxWidth: W - 160, maxLines: 2 });
    out += `<rect x="80" y="${y - 10}" width="${W - 160}" height="${blockHeight(hl.lines, hl.size) + 50}" rx="24" fill="${c.s}"/>`;
    out += textBlock(hl.lines, { x: W / 2, y: y + hl.size, size: hl.size, weight: 900, fill: c.onS });
    y += blockHeight(hl.lines, hl.size) + 90;
  }
  out += `<circle cx="${W / 2}" cy="${y + emSize / 2}" r="${emSize * 0.6}" fill="#ffffff" opacity=".14"/>`;
  out += emblemAt(party, ctx, W / 2 - emSize / 2, y, emSize, key);
  y += emSize + 60;
  const name = fit(party.name, { size: isStory ? 104 : 88, minSize: 44, weight: 900, maxWidth: W - 140, maxLines: 3 });
  out += textBlock(name.lines, { x: W / 2, y: y + name.size * 0.85, size: name.size, weight: 900, fill: c.onP, lineHeight: 1.1 });
  y += blockHeight(name.lines, name.size, 1.1) + 40;
  if (party.slogan) {
    const sl = fit(`"${party.slogan}"`, { size: 46, minSize: 30, weight: 500, maxWidth: W - 160, maxLines: 3 });
    out += textBlock(sl.lines, { x: W / 2, y: y + sl.size, size: sl.size, weight: 500, fill: c.onP === '#ffffff' ? c.s : INK });
    y += blockHeight(sl.lines, sl.size) + 50;
  }
  if (isStory && opts.showQr !== false) {
    out += qrSvg(ctx.url, W / 2 - 160, Math.max(y + 20, H - 720), 320, c.deep);
  }
  const pillW = W - 200;
  out += `<rect x="100" y="${H - (isStory ? 300 : 170)}" width="${pillW}" height="84" rx="42" fill="#ffffff"/>`;
  const url = fit(shortUrl(ctx), { size: 32, minSize: 18, weight: 700, maxWidth: pillW - 60, maxLines: 1 });
  out += `<g direction="ltr"><text x="${W / 2}" y="${H - (isStory ? 300 : 170) + 54}" text-anchor="middle" font-family="${esc(RUBIK)}" font-weight="700" font-size="${url.size}" fill="${c.p}">${esc(url.lines[0])}</text></g>`;
  out += textBlock(['מפלגה הומוריסטית · לא מפלגה רשמית'], { x: W / 2, y: H - (isStory ? 170 : 50), size: 26, weight: 500, fill: c.onP, extra: 'opacity=".85"' });
  return out;
}

const post = {
  id: 'post', label: 'פוסט מרובע', description: 'פוסט 1080×1080 לאינסטגרם, פייסבוק ווואטסאפ.',
  width: 1080, height: 1080, exportScale: 1, options: ['headline', 'style'],
  build(party, ctx, opts) { return svgWrap(1080, 1080, socialCard(party, ctx, opts, 1080, 1080, 'po'), `פוסט של ${party.name}`); },
};

const story = {
  id: 'story', label: 'סטורי אנכי', description: 'סטורי 1080×1920 עם QR לאתר המפלגה.',
  width: 1080, height: 1920, exportScale: 1, options: ['headline', 'style', 'showQr'],
  build(party, ctx, opts) { return svgWrap(1080, 1920, socialCard(party, ctx, opts, 1080, 1920, 'st'), `סטורי של ${party.name}`); },
};

// ---------- באנר ----------
const banner = {
  id: 'banner', label: 'באנר לאתר', description: 'באנר רחב 1500×500 לראש אתר או לקבוצה.',
  width: 1500, height: 500, exportScale: 1, options: ['style'],
  build(party, ctx, opts) {
    const W = 1500;
    const H = 500;
    const c = colors(party);
    let out = background(W, H, c, opts.style || 'pattern', 'bn');
    out += `<circle cx="${W - 250}" cy="${H / 2}" r="200" fill="#ffffff" opacity=".15"/>`;
    out += emblemAt(party, ctx, W - 420, 80, 340, 'bn');
    const right = W - 480;
    const name = fit(party.name, { size: 96, minSize: 44, weight: 900, maxWidth: 900, maxLines: 2 });
    const nameH = blockHeight(name.lines, name.size, 1.08);
    const sl = party.slogan ? fit(`"${party.slogan}"`, { size: 44, minSize: 28, weight: 500, maxWidth: 900, maxLines: 2 }) : null;
    const total = nameH + (sl ? blockHeight(sl.lines, sl.size) + 30 : 0);
    let y = (H - total) / 2 + name.size * 0.85;
    out += textBlock(name.lines, { x: right, y, size: name.size, weight: 900, fill: c.onP, align: 'right', lineHeight: 1.08 });
    if (sl) out += textBlock(sl.lines, { x: right, y: y + nameH + 30, size: sl.size, weight: 500, fill: c.onP === '#ffffff' ? c.s : INK, align: 'right' });
    out += textBlock(['מפלגה הומוריסטית · לא רשמית'], { x: 140, y: H - 30, size: 22, fill: c.onP, extra: 'opacity=".8"' });
    return svgWrap(W, H, out, `באנר של ${party.name}`);
  },
};

// ---------- תמונת פרופיל ----------
const profile = {
  id: 'profile', label: 'תמונת פרופיל', description: 'הסמל במרכז, 800×800, מתאים לעיגול של רשתות חברתיות.',
  width: 800, height: 800, exportScale: 1, options: ['style'],
  build(party, ctx, opts) {
    const c = colors(party);
    let out = opts.style === 'light' ? '<rect width="800" height="800" fill="#ffffff"/>' : `<rect width="800" height="800" fill="${c.s}"/>`;
    out += `<circle cx="400" cy="400" r="360" fill="#ffffff" opacity=".35"/>`;
    out += emblemAt(party, ctx, 90, 90, 620, 'pf');
    return svgWrap(800, 800, out, `תמונת פרופיל של ${party.name}`);
  },
};

// ---------- כרטיס חבר ----------
const memberCard = {
  id: 'member-card', label: 'כרטיס חבר', description: 'כרטיס חבר בגודל כרטיס אשראי, עם שם החבר/ה.',
  width: 1012, height: 638, exportScale: 1.5, options: ['memberName'],
  build(party, ctx, opts) {
    const W = 1012;
    const H = 638;
    const c = colors(party);
    let out = `<defs><clipPath id="mc-${ctx.uid}"><rect width="${W}" height="${H}" rx="44"/></clipPath></defs><g clip-path="url(#mc-${ctx.uid})">`;
    out += `<rect width="${W}" height="${H}" fill="#fffdf7"/>`;
    out += `<rect width="${W}" height="170" fill="${c.p}"/><rect y="170" width="${W}" height="14" fill="${c.s}"/>`;
    out += emblemAt(party, ctx, 40, 30, 230, 'mc');
    const name = fit(party.name, { size: 50, minSize: 26, weight: 900, maxWidth: 680, maxLines: 2 });
    out += textBlock(name.lines, { x: W - 50, y: 72, size: name.size, weight: 900, fill: c.onP, align: 'right', lineHeight: 1.1 });
    out += textBlock(['כרטיס חבר/ה'], { x: W - 50, y: 150, size: 28, weight: 700, fill: c.onP === '#ffffff' ? c.s : INK, align: 'right' });
    const member = opts.memberName || '';
    out += textBlock(['שם:'], { x: W - 50, y: 280, size: 34, weight: 700, fill: '#555', align: 'right' });
    if (member) {
      const m = fit(member, { size: 52, minSize: 30, weight: 900, maxWidth: 560, maxLines: 1 });
      out += textBlock(m.lines, { x: W - 140, y: 284, size: m.size, weight: 900, fill: INK, align: 'right' });
    } else out += `<path d="M${W - 140} 290 H330" stroke="#999" stroke-width="2"/>`;
    out += textBlock([`מספר חבר: ${opts.memberNumber || '0001'}`], { x: W - 50, y: 370, size: 30, weight: 500, fill: INK, align: 'right' });
    out += textBlock(['בתוקף עד הבחירות הבאות (או עד שנשתעמם)'], { x: W - 50, y: 420, size: 26, fill: '#555', align: 'right' });
    if (party.slogan) {
      const sl = wrap(`"${party.slogan}"`, { size: 28, weight: 500, maxWidth: W - 100, maxLines: 1 });
      out += textBlock(sl.lines, { x: W - 50, y: 490, size: 28, weight: 500, fill: c.p, align: 'right' });
    }
    out += `<rect y="${H - 70}" width="${W}" height="70" fill="${c.p}"/>`;
    out += textBlock(['כרטיס הומוריסטי · אינו מסמך רשמי'], { x: W / 2, y: H - 26, size: 24, weight: 500, fill: c.onP });
    out += '</g>';
    return svgWrap(W, H, out, `כרטיס חבר של ${party.name}`);
  },
};

// ---------- כרזת הכרזה ----------
const poster = {
  id: 'poster', label: 'כרזת הכרזה', description: 'כרזה דרמטית A4 עם הודעת ההכרזה של המפלגה.',
  width: 1240, height: 1754, exportScale: 2, print: 'A4', options: ['headline', 'body', 'style'],
  build(party, ctx, opts) {
    const W = 1240;
    const H = 1754;
    const c = colors(party);
    let out = background(W, H, c, opts.style || 'dots', 'pp');
    out += `<g transform="rotate(-4 ${W / 2} 170)"><rect x="80" y="100" width="${W - 160}" height="150" rx="16" fill="${c.s}"/>`;
    const head = fit(opts.headline || 'הודעה דרמטית!', { size: 96, minSize: 50, weight: 900, maxWidth: W - 240, maxLines: 1 });
    out += textBlock(head.lines, { x: W / 2, y: 210, size: head.size, weight: 900, fill: c.onS });
    out += '</g>';
    out += emblemAt(party, ctx, W / 2 - 170, 320, 340, 'pp');
    let y = 740;
    const name = fit(party.name, { size: 100, minSize: 50, weight: 900, maxWidth: W - 160, maxLines: 2 });
    out += textBlock(name.lines, { x: W / 2, y: y + name.size * 0.85, size: name.size, weight: 900, fill: c.onP, lineHeight: 1.1 });
    y += blockHeight(name.lines, name.size, 1.1) + 40;
    out += textBlock(['יוצאת לדרך'], { x: W / 2, y: y + 50, size: 56, weight: 700, fill: c.onP === '#ffffff' ? c.s : INK });
    y += 120;
    const bodyText = opts.body || party.campaign?.announcement || party.short_desc || '';
    if (bodyText) {
      const b = fit(bodyText, { size: 40, minSize: 26, weight: 400, maxWidth: W - 220, maxLines: 9 });
      out += `<rect x="80" y="${y - 10}" width="${W - 160}" height="${blockHeight(b.lines, b.size, 1.35) + 80}" rx="24" fill="#ffffff" opacity=".95"/>`;
      out += textBlock(b.lines, { x: W / 2, y: y + 40 + b.size * 0.5, size: b.size, fill: INK, lineHeight: 1.35 });
    }
    out += textBlock([DISCLAIMER], { x: W / 2, y: H - 50, size: 24, fill: c.onP, extra: 'opacity=".85"' });
    return svgWrap(W, H, out, `כרזת הכרזה של ${party.name}`);
  },
};

// ---------- תעודת הקמה ----------
const certificate = {
  id: 'certificate', label: 'תעודת הקמת מפלגה', description: 'תעודה חגיגית A4 לרוחב, עם חותמת הסמל.',
  width: 1754, height: 1240, exportScale: 2, print: 'A4L', options: [],
  build(party, ctx) {
    const W = 1754;
    const H = 1240;
    const c = colors(party);
    let out = `<rect width="${W}" height="${H}" fill="#fbf6e9"/>`;
    out += `<rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${c.p}" stroke-width="14"/>`;
    out += `<rect x="72" y="72" width="${W - 144}" height="${H - 144}" fill="none" stroke="${c.s}" stroke-width="5"/>`;
    for (const [x, y] of [[72, 72], [W - 72, 72], [72, H - 72], [W - 72, H - 72]]) out += `<circle cx="${x}" cy="${y}" r="26" fill="${c.p}"/><circle cx="${x}" cy="${y}" r="12" fill="${c.s}"/>`;
    out += textBlock(['תעודת הקמת מפלגה'], { x: W / 2, y: 230, size: 104, weight: 900, family: SERIF, fill: c.p });
    out += textBlock(['בזאת מאושר כי'], { x: W / 2, y: 340, size: 44, weight: 700, family: SERIF, fill: INK });
    const name = fit(party.name, { size: 110, minSize: 54, weight: 900, family: SERIF, maxWidth: W - 360, maxLines: 2 });
    out += textBlock(name.lines, { x: W / 2, y: 470, size: name.size, weight: 900, family: SERIF, fill: INK, lineHeight: 1.1 });
    let y = 470 + blockHeight(name.lines, name.size, 1.1) + 50;
    const founded = party.founded_on ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(party.founded_on)) : 'יום בהיר אחד';
    out += textBlock([`הוקמה כדין (כדין הומוריסטי בלבד) ב${party.founded_on ? '-' : ''}${founded}`], { x: W / 2, y, size: 42, weight: 700, family: SERIF, fill: INK });
    out += textBlock(['לאחר שעמדה בכל הדרישות: סיסמה, סמל, ומישהו אחד לפחות שמביא כיבוד'], { x: W / 2, y: y + 70, size: 36, weight: 700, family: SERIF, fill: '#444' });
    if (party.slogan) out += textBlock(wrap(`"${party.slogan}"`, { size: 40, weight: 700, family: SERIF, maxWidth: W - 500, maxLines: 1 }).lines, { x: W / 2, y: y + 150, size: 40, weight: 700, family: SERIF, fill: c.p });
    out += emblemAt(party, ctx, 150, H - 420, 260, 'ct');
    const chair = (party.leaders || []).find((l) => /יו"ר|יו״ר|יושב|יושבת/.test(l.role)) || (party.leaders || [])[0];
    const sig = (x, label, who) => `<path d="M${x - 220} ${H - 200} H${x + 220}" stroke="${INK}" stroke-width="2"/>${textBlock([who || ' '], { x, y: H - 215, size: 38, weight: 700, family: SERIF, fill: c.p })}${textBlock([label], { x, y: H - 160, size: 30, weight: 700, family: SERIF, fill: '#444' })}`;
    out += sig(W - 420, chair ? chair.role : 'יו"ר המפלגה', chair?.name || '');
    out += sig(W / 2 + 120, 'ועדת הוועדות', 'מאושר');
    out += textBlock(['תעודה הומוריסטית, אין לה כל תוקף רשמי'], { x: W / 2, y: H - 95, size: 24, weight: 700, family: SERIF, fill: '#777' });
    return svgWrap(W, H, out, `תעודת הקמה של ${party.name}`);
  },
};

// ---------- תמונת שיתוף (Open Graph) ----------
const og = {
  id: 'og', label: 'תמונת שיתוף לרשתות', description: '1200×630 — מה שמופיע כששולחים את הקישור בוואטסאפ או בפייסבוק.',
  width: 1200, height: 630, exportScale: 1, options: ['style'],
  build(party, ctx, opts) {
    const W = 1200;
    const H = 630;
    const c = colors(party);
    let out = background(W, H, c, opts.style || 'gradient', 'og');
    out += `<circle cx="250" cy="${H / 2 - 20}" r="215" fill="#ffffff" opacity=".16"/>`;
    out += emblemAt(party, ctx, 60, 70, 380, 'og');
    const right = W - 60;
    let y = 120;
    if (party.acronym) {
      out += `<rect x="${right - 200}" y="${y - 62}" width="200" height="72" rx="36" fill="${c.s}"/>`;
      out += textBlock([party.acronym], { x: right - 100, y: y - 10, size: 46, weight: 900, fill: c.onS });
      y += 50;
    }
    const name = fit(party.name, { size: 84, minSize: 42, weight: 900, maxWidth: 640, maxLines: 3 });
    out += textBlock(name.lines, { x: right, y: y + name.size * 0.85, size: name.size, weight: 900, fill: c.onP, align: 'right', lineHeight: 1.08 });
    y += blockHeight(name.lines, name.size, 1.08) + 40;
    if (party.slogan) {
      const sl = fit(`"${party.slogan}"`, { size: 40, minSize: 26, weight: 500, maxWidth: 640, maxLines: 2 });
      out += textBlock(sl.lines, { x: right, y: y + sl.size * 0.8, size: sl.size, weight: 500, fill: c.onP === '#ffffff' ? c.s : INK, align: 'right' });
    }
    out += `<rect y="${H - 64}" width="${W}" height="64" fill="#000000" opacity=".28"/>`;
    out += textBlock(['מפלגה הומוריסטית עצמאית · לא מפלגה רשמית · המפלגה שלי'], { x: W / 2, y: H - 22, size: 26, weight: 500, fill: '#ffffff' });
    return svgWrap(W, H, out, `תמונת שיתוף של ${party.name}`);
  },
};

export const TEMPLATES = [ballot, ballotSheet, flyer, post, story, banner, profile, memberCard, poster, certificate, og];
export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
