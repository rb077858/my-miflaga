// ספריית הסמלים. כל סמל מצויר בתיבה 100x100.
// F = צבע ראשי של הסמל, A = צבע הדגשה, B = צבע הרקע (לחורים ופרטים).
// אלה ציורים מקוריים; אין כאן סמלי מדינה (מנורה, דגל) כדי לא להטעות.

export const ICONS = {
  bus: {
    label: 'אוטובוס (שמאחר)',
    svg: `<rect x="16" y="14" width="68" height="62" rx="12" fill="F"/>
      <rect x="23" y="22" width="54" height="24" rx="5" fill="B"/>
      <rect x="23" y="52" width="14" height="8" rx="3" fill="A"/><rect x="63" y="52" width="14" height="8" rx="3" fill="A"/>
      <rect x="40" y="52" width="20" height="4" rx="2" fill="B"/>
      <rect x="22" y="74" width="14" height="12" rx="4" fill="F"/><rect x="64" y="74" width="14" height="12" rx="4" fill="F"/>
      <rect x="34" y="8" width="32" height="8" rx="3" fill="A"/>`,
  },
  pita: {
    label: 'פיתה פלאפל',
    svg: `<circle cx="38" cy="40" r="10" fill="A"/><circle cx="56" cy="34" r="10" fill="A"/><circle cx="66" cy="50" r="9" fill="A"/>
      <path d="M44 30 q4 -10 10 -6" stroke="F" stroke-width="3" fill="none"/>
      <path d="M14 48 Q50 40 86 48 Q84 90 50 90 Q16 90 14 48Z" fill="F"/>
      <path d="M22 56 Q50 50 78 56" stroke="B" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`,
  },
  book: {
    label: 'ספר (שיעורי בית)',
    svg: `<path d="M8 24 Q30 16 50 26 L50 84 Q30 74 8 82Z" fill="F"/>
      <path d="M92 24 Q70 16 50 26 L50 84 Q70 74 92 82Z" fill="F" opacity=".85"/>
      <path d="M16 36 Q30 32 42 38 M16 48 Q30 44 42 50 M16 60 Q30 56 42 62" stroke="B" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M58 38 Q70 32 84 36 M58 50 Q70 44 84 48" stroke="B" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="74" cy="64" r="7" fill="A"/>`,
  },
  coin: {
    label: 'מטבע',
    svg: `<circle cx="50" cy="50" r="38" fill="F"/><circle cx="50" cy="50" r="30" fill="none" stroke="A" stroke-width="4"/>
      <path d="M38 36 V60 H52 V44 M62 64 V40 H48 V56" stroke="B" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  sun: {
    label: 'שמש (חופש!)',
    svg: `<g stroke="A" stroke-width="7" stroke-linecap="round"><path d="M50 6V18M50 82V94M6 50H18M82 50H94M19 19l8 8M73 73l8 8M19 81l8-8M73 27l8-8"/></g>
      <circle cx="50" cy="50" r="24" fill="F"/>
      <path d="M38 54 Q50 64 62 54" stroke="B" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="34" y="40" width="12" height="7" rx="3" fill="B"/><rect x="54" y="40" width="12" height="7" rx="3" fill="B"/>`,
  },
  phone: {
    label: 'סמארטפון',
    svg: `<rect x="28" y="8" width="44" height="84" rx="10" fill="F"/>
      <rect x="33" y="18" width="34" height="58" rx="4" fill="B"/>
      <rect x="38" y="26" width="24" height="6" rx="3" fill="A"/><rect x="38" y="38" width="16" height="6" rx="3" fill="A" opacity=".7"/>
      <circle cx="50" cy="84" r="3.5" fill="B"/>
      <path d="M42 56 l6 6 l12 -12" stroke="F" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  heart: {
    label: 'לב',
    svg: `<path d="M50 88 C20 66 8 50 8 34 A20 20 0 0 1 50 24 A20 20 0 0 1 92 34 C92 50 80 66 50 88Z" fill="F"/>
      <path d="M26 34 A10 10 0 0 1 38 26" stroke="A" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },
  scroll: {
    label: 'מגילת חוקים',
    svg: `<rect x="22" y="16" width="56" height="68" rx="4" fill="F"/>
      <rect x="14" y="10" width="72" height="12" rx="6" fill="A"/><rect x="14" y="78" width="72" height="12" rx="6" fill="A"/>
      <path d="M32 34H68M32 46H68M32 58H56" stroke="B" stroke-width="4" stroke-linecap="round"/>`,
  },
  star: {
    label: 'כוכב',
    svg: `<path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36Z" fill="F"/>
      <path d="M50 22 L56 40" stroke="A" stroke-width="5" stroke-linecap="round"/>`,
  },
  megaphone: {
    label: 'מגפון',
    svg: `<path d="M14 40 L60 18 V82 L14 60Z" fill="F"/><rect x="8" y="38" width="12" height="24" rx="4" fill="A"/>
      <path d="M24 60 L30 84 H42 L38 64" fill="F"/>
      <path d="M70 34 Q80 50 70 66 M78 26 Q94 50 78 74" stroke="A" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },
  coffee: {
    label: 'קפה (הכרחי)',
    svg: `<path d="M38 8 q-6 8 0 14 q6 6 0 14 M54 8 q-6 8 0 14 q6 6 0 14" stroke="A" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M16 42 H74 V64 A22 22 0 0 1 52 86 H38 A22 22 0 0 1 16 64Z" fill="F"/>
      <path d="M74 48 H80 A10 10 0 0 1 80 68 H72" stroke="F" stroke-width="7" fill="none"/>
      <rect x="10" y="88" width="70" height="6" rx="3" fill="A"/>`,
  },
  cat: {
    label: 'חתול רחוב',
    svg: `<path d="M18 20 L32 40 H68 L82 20 L86 60 A36 32 0 0 1 14 60Z" fill="F"/>
      <circle cx="37" cy="56" r="6" fill="A"/><circle cx="63" cy="56" r="6" fill="A"/>
      <circle cx="37" cy="56" r="2.5" fill="B"/><circle cx="63" cy="56" r="2.5" fill="B"/>
      <path d="M46 66 L50 70 L54 66" stroke="B" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M10 66 H30 M10 74 H30 M70 66 H90 M70 74 H90" stroke="B" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  },
  cactus: {
    label: 'צבר',
    svg: `<rect x="40" y="10" width="20" height="76" rx="10" fill="F"/>
      <path d="M40 54 H26 A8 8 0 0 1 18 46 V30" stroke="F" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M60 44 H72 A8 8 0 0 0 80 36 V22" stroke="F" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M46 24l-4-3M54 34l4-3M46 46l-4-3M54 60l4-3M46 70l-4-3" stroke="B" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="28" y="84" width="44" height="8" rx="4" fill="A"/><circle cx="50" cy="10" r="6" fill="A"/>`,
  },
  flipflop: {
    label: 'כפכף',
    svg: `<path d="M50 6 C76 6 82 34 78 58 C74 84 64 94 50 94 C36 94 26 84 22 58 C18 34 24 6 50 6Z" fill="F"/>
      <path d="M50 30 L30 52 M50 30 L70 52" stroke="A" stroke-width="7" stroke-linecap="round"/>
      <circle cx="50" cy="30" r="5" fill="B"/>`,
  },
  watermelon: {
    label: 'אבטיח',
    svg: `<path d="M6 36 A44 44 0 0 0 94 36Z" fill="A"/><path d="M14 36 A36 36 0 0 0 86 36Z" fill="F"/>
      <g fill="B"><ellipse cx="34" cy="50" rx="3" ry="5"/><ellipse cx="50" cy="58" rx="3" ry="5"/><ellipse cx="66" cy="50" rx="3" ry="5"/><ellipse cx="42" cy="44" rx="2.5" ry="4"/><ellipse cx="58" cy="44" rx="2.5" ry="4"/></g>`,
  },
  clock: {
    label: 'שעון מעורר',
    svg: `<circle cx="22" cy="20" r="11" fill="A"/><circle cx="78" cy="20" r="11" fill="A"/>
      <circle cx="50" cy="54" r="36" fill="F"/><circle cx="50" cy="54" r="27" fill="B"/>
      <path d="M50 36 V54 L62 62" stroke="F" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M26 86 L20 94 M74 86 L80 94" stroke="F" stroke-width="6" stroke-linecap="round"/>`,
  },
  rocket: {
    label: 'טיל (של רעיונות)',
    svg: `<path d="M50 4 C70 18 74 46 66 70 H34 C26 46 30 18 50 4Z" fill="F"/>
      <circle cx="50" cy="36" r="9" fill="B"/><circle cx="50" cy="36" r="5" fill="A"/>
      <path d="M34 52 L18 72 L34 70Z M66 52 L82 72 L66 70Z" fill="A"/>
      <path d="M40 74 Q50 98 60 74Z" fill="A"/>`,
  },
  lightning: {
    label: 'ברק',
    svg: `<path d="M58 4 L18 56 H46 L38 96 L82 40 H54Z" fill="F"/><path d="M54 20 L40 44" stroke="A" stroke-width="4" stroke-linecap="round"/>`,
  },
  icepop: {
    label: 'ארטיק',
    svg: `<rect x="44" y="66" width="12" height="28" rx="6" fill="A"/>
      <path d="M28 30 A22 22 0 0 1 72 30 V70 H28Z" fill="F"/>
      <path d="M28 44 H72" stroke="B" stroke-width="5"/><path d="M38 20 Q42 14 48 14" stroke="B" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  crown: {
    label: 'כתר (צנוע)',
    svg: `<path d="M10 30 L30 52 L50 18 L70 52 L90 30 L82 78 H18Z" fill="F"/>
      <rect x="18" y="80" width="64" height="10" rx="4" fill="A"/>
      <circle cx="10" cy="30" r="6" fill="A"/><circle cx="50" cy="18" r="6" fill="A"/><circle cx="90" cy="30" r="6" fill="A"/>
      <circle cx="50" cy="60" r="7" fill="B"/>`,
  },
  umbrella: {
    label: 'מטריה',
    svg: `<path d="M6 50 A44 40 0 0 1 94 50 Q83 42 72 50 Q61 42 50 50 Q39 42 28 50 Q17 42 6 50Z" fill="F"/>
      <path d="M50 50 V82 A8 8 0 0 1 34 82" stroke="A" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M50 10 V50" stroke="B" stroke-width="2" opacity=".5"/>`,
  },
  bamba: {
    label: 'חטיף בוטנים',
    svg: `<path d="M18 70 C10 50 30 46 32 34 C34 20 54 18 58 30 C62 40 76 36 82 48 C90 64 72 76 60 70 C48 64 40 80 28 80 C22 80 20 76 18 70Z" fill="F"/>
      <g fill="A"><circle cx="34" cy="58" r="3"/><circle cx="48" cy="40" r="3"/><circle cx="66" cy="54" r="3"/><circle cx="52" cy="60" r="2.5"/></g>`,
  },
  duck: {
    label: 'ברווז אמבטיה',
    svg: `<path d="M14 58 Q14 86 50 86 Q86 86 86 58 Q76 64 64 60 Q74 52 72 38 A20 20 0 0 0 34 38 Q32 50 40 58 Q26 60 14 58Z" fill="F"/>
      <path d="M72 40 L90 44 L74 50Z" fill="A"/><circle cx="58" cy="34" r="4" fill="B"/>
      <path d="M30 70 Q46 78 62 70" stroke="B" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`,
  },
  tea: {
    label: 'כוס תה עם נענע',
    svg: `<path d="M24 30 H76 L68 90 H32Z" fill="F"/>
      <path d="M28 44 H72" stroke="B" stroke-width="3" opacity=".6"/>
      <path d="M50 30 C40 16 46 6 58 8 C60 18 56 24 50 30Z M50 30 C60 18 72 20 74 28 C66 32 58 32 50 30Z" fill="A"/>`,
  },
  bulb: {
    label: 'נורה (רעיון!)',
    svg: `<path d="M50 6 A30 30 0 0 1 68 60 V70 H32 V60 A30 30 0 0 1 50 6Z" fill="F"/>
      <rect x="34" y="74" width="32" height="7" rx="3" fill="A"/><rect x="38" y="84" width="24" height="7" rx="3" fill="A"/>
      <path d="M40 40 L50 50 L60 40" stroke="B" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  ballot: {
    label: 'פתק',
    svg: `<rect x="20" y="8" width="60" height="84" rx="6" fill="F"/>
      <rect x="30" y="22" width="40" height="22" rx="4" fill="B"/>
      <path d="M30 56H70M30 66H62M30 76H54" stroke="A" stroke-width="5" stroke-linecap="round"/>`,
  },
};

export const ICON_IDS = Object.keys(ICONS);

export function iconMarkup(id, colors) {
  const icon = ICONS[id] || ICONS.star;
  return icon.svg
    .replace(/"F"/g, `"${colors.f}"`)
    .replace(/"A"/g, `"${colors.a}"`)
    .replace(/"B"/g, `"${colors.b}"`);
}
