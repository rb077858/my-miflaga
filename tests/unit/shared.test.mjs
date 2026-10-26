// בדיקות יחידה: ולידציה, סמל, תבניות סטודיו (עם מדידת טקסט משוערת) ויצירת PDF.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validatePartyInput, slugify, slugProblem, nameKey, cleanText } from '../../src/shared/validate.js';
import { renderEmblem, normalizeEmblem } from '../../src/shared/emblem.js';
import { esc, readableOn } from '../../src/shared/escape.js';
import { ICON_IDS } from '../../src/shared/icons.js';
import { EMBLEM_SHAPES, EMBLEM_STYLES } from '../../src/shared/constants.js';
import { TEMPLATES } from '../../src/client/studio/templates.js';
import { wrap, fit } from '../../src/client/studio/text.js';
import { buildPdf, PAGE } from '../../src/client/studio/pdf.js';
import { sniffImage } from '../../src/worker/api/images.js';

const PARTY = {
  name: 'התנועה העממית המאוחדת לשחרור השקע האחרון ליד הספה', acronym: 'שק"ע', slogan: 'קודם קפה, אחר כך מדיניות, ואז שוב קפה',
  short_desc: 'תיאור', color_primary: '#1f4fd1', color_secondary: '#ffc93c', emblem: { icon: 'bus', shape: 'shield', style: 'retro', extras: ['stars', 'laurel'] },
  platform: [{ title: 'אוטובוס בזמן', promise: 'כל אוטובוס יגיע בזמן או שהנהג ישיר שיר התנצלות ארוך במיוחד', priority: 1 }],
  leaders: [{ name: 'גברת במבה', role: 'יו"ר', fictional: 1 }], campaign: { flagship: 'טחינה לכולם', announcement: 'הודעה' }, founded_on: '2026-10-01', slug: 'shka',
};

describe('ולידציה', () => {
  test('ניקוי תווי שליטה וכיווניות מוסתרים', () => {
    assert.equal(cleanText('שלום‮עולם\u0000 '), 'שלוםעולם');
  });
  test('נתיב: תעתיק מעברית ובדיקות', () => {
    assert.equal(slugify('מפלגת הקפה'), 'mplgt-hkph');
    assert.equal(slugProblem('ok-slug'), null);
    assert.ok(slugProblem('-bad'));
    assert.ok(slugProblem('ab'));
    assert.ok(slugProblem('api'));
  });
  test('שם מנורמל מתעלם מניקוד, רווחים וסימנים', () => {
    assert.equal(nameKey('מִפְלֶגֶת  הקפה!'), nameKey('מפלגת הקפה'));
  });
  test('צבעים, קטגוריה ורמת רצינות נבדקים', () => {
    const { errors } = validatePartyInput({ color_primary: 'javascript:alert(1)', seriousness: 9, category: 'nope' }, { categories: ['daily'] });
    assert.ok(errors.color_primary && errors.seriousness && errors.category);
  });
  test('מצע: סעיף בלי הבטחה נדחה, ערכים לא מוכרים מנורמלים', () => {
    const { data, errors } = validatePartyInput({ platform: [{ title: 'כותרת', promise: '', topic: 'evil', status: 'x', priority: 9 }] });
    assert.ok(errors['platform.0.promise']);
    assert.equal(data.platform[0].topic, 'free');
    assert.equal(data.platform[0].status, 'proposal');
  });
});

describe('סמל', () => {
  test('כל שילוב של צורה, סגנון וסמל מייצר SVG תקין', () => {
    for (const shape of Object.keys(EMBLEM_SHAPES)) {
      for (const style of Object.keys(EMBLEM_STYLES)) {
        for (const icon of ICON_IDS) {
          const svg = renderEmblem({ ...PARTY, emblem: { shape, style, icon, extras: ['stars', 'rays', 'ring', 'laurel'] } });
          assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
          assert.ok(!svg.includes('undefined') && !svg.includes('NaN'), `${shape}/${style}/${icon}`);
        }
      }
    }
  });
  test('ערכים זדוניים מנורמלים ונשארים בטוחים', () => {
    const e = normalizeEmblem({ shape: '"><script>', icon: 'x', image: '../../etc', extras: ['<b>'] });
    assert.equal(e.shape, 'circle');
    assert.equal(e.image, null);
    assert.deepEqual(e.extras, []);
    const svg = renderEmblem({ ...PARTY, acronym: '<img src=x>', color_primary: 'red;"onload="x' });
    assert.ok(!svg.includes('<img'));
    assert.ok(!svg.includes('onload'));
  });
  test('ניגודיות: טקסט כהה על צהוב, לבן על כחול', () => {
    assert.equal(readableOn('#ffc93c'), '#141824');
    assert.equal(readableOn('#1f4fd1'), '#ffffff');
  });
  test('esc', () => assert.equal(esc('<a href="x">\'</a>'), '&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;'));
});

describe('תבניות סטודיו', () => {
  const ctx = { url: 'https://miflaga.reembir.com/party/shka/', emblemImage: null, uid: 't' };
  test('כל התבניות נבנות מנתוני המפלגה, כולל שם ארוך ונתונים חסרים', () => {
    for (const tpl of TEMPLATES) {
      for (const party of [PARTY, { name: 'מ', acronym: '', slogan: '', platform: [], leaders: [], campaign: {}, emblem: {}, color_primary: '#000000', color_secondary: '#ffffff' }]) {
        const svg = tpl.build(party, ctx, {});
        assert.ok(svg.startsWith('<svg'), tpl.id);
        assert.ok(!svg.includes('undefined') && !svg.includes('NaN'), `${tpl.id}: ${svg.match(/.{40}(undefined|NaN).{40}/)?.[0]}`);
        assert.ok(svg.includes(`viewBox="0 0 ${tpl.width} ${tpl.height}"`));
      }
    }
  });
  test('פתק: כולל את הסימון "אינו פתק הצבעה רשמי" ואת השם', () => {
    const svg = TEMPLATES.find((t) => t.id === 'ballot').build(PARTY, ctx, {});
    assert.ok(svg.includes('פתק הומוריסטי - אינו פתק הצבעה רשמי'));
    assert.ok(svg.includes('שק&quot;ע'));
  });
  test('פלייר: כולל QR ואת הבטחות המצע', () => {
    const svg = TEMPLATES.find((t) => t.id === 'flyer').build(PARTY, ctx, {});
    assert.ok(svg.includes('shape-rendering="crispEdges"'));
    assert.ok(svg.includes('אוטובוס בזמן'));
  });
  test('גלישת טקסט: לא חורגת מהרוחב ומקצרת עם "…"', () => {
    const r = wrap('מילה '.repeat(40), { size: 20, maxWidth: 200, maxLines: 2 });
    assert.equal(r.lines.length, 2);
    assert.ok(r.lines[1].endsWith('…'));
    const f = fit(PARTY.name, { size: 80, minSize: 30, maxWidth: 700, maxLines: 2 });
    assert.ok(f.size < 80 && f.lines.length <= 2);
  });
});

describe('PDF', () => {
  test('מבנה PDF תקין עם טבלת הפניות נכונה', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const bytes = buildPdf([{ jpeg, width: 10, height: 14, pageW: PAGE.A4.w, pageH: PAGE.A4.h }], { title: 'פתק' });
    const text = new TextDecoder('latin1').decode(bytes);
    assert.ok(text.startsWith('%PDF-1.4'));
    assert.ok(text.trimEnd().endsWith('%%EOF'));
    const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
    assert.ok(text.slice(startxref).startsWith('xref'));
    // כל רשומה בטבלה מצביעה על תחילת אובייקט
    const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => assert.ok(text.slice(o).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`));
    assert.ok(text.includes('/MediaBox [0 0 595.28 841.89]'));
  });
});

describe('זיהוי סוג תמונה', () => {
  test('PNG, JPEG, WebP מזוהים; SVG ו-GIF לא', () => {
    assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png');
    assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
    assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
    assert.equal(sniffImage(new TextEncoder().encode('<svg xmlns="x"></svg>')), null);
    assert.equal(sniffImage(new TextEncoder().encode('GIF89a......')), null);
  });
});
