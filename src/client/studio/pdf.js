// כותב PDF מינימלי: כל עמוד הוא תמונת JPEG ברזולוציית הדפסה שממלאת את הדף.
// כך העברית, הגופנים והכיווניות נראים בדיוק כמו בתצוגה המקדימה, בלי ספרייה כבדה.

export const PAGE = {
  A4: { w: 595.28, h: 841.89 },
  A4L: { w: 841.89, h: 595.28 },
};

function utf16Hex(text) {
  let hex = 'FEFF';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code > 0xffff) {
      const c = code - 0x10000;
      hex += (0xd800 + (c >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (c & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += code.toString(16).padStart(4, '0');
  }
  return `<${hex.toUpperCase()}>`;
}

/**
 * pages: [{ jpeg: Uint8Array, width: px, height: px, pageW: pt, pageH: pt }]
 * מחזיר Uint8Array של קובץ PDF תקין.
 */
export function buildPdf(pages, { title = 'מסמך' } = {}) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, body, stream) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // מספור: 1 קטלוג, 2 עמודים, 3 מידע, ואז לכל עמוד: עמוד, תוכן, תמונה
  const pageIds = pages.map((_, i) => 4 + i * 3);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>`);
  obj(3, `<< /Title ${utf16Hex(title)} /Producer (miflaga) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
  pages.forEach((p, i) => {
    const id = pageIds[i];
    const content = enc.encode(`q\n${p.pageW.toFixed(2)} 0 0 ${p.pageH.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`);
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pageW.toFixed(2)} ${p.pageH.toFixed(2)}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    obj(id + 1, `<< /Length ${content.length} >>`, content);
    obj(id + 2, `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
  });
  const total = 4 + n * 3;
  const xref = length;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}
