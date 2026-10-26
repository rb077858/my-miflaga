// העלאת תמונות: הקובץ מוקטן ומקודד מחדש בדפדפן (מה שגם מסיר מטא-דאטה כמו מיקום), ורק אז נשלח לשרת.
// השרת בודק שוב את סוג הקובץ ואת הגודל.
import { api } from '../core/api.js';

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_INPUT = 10 * 1024 * 1024;

export const ACCEPT_ATTR = ACCEPT.join(',');

async function encode(canvas) {
  for (const [type, q] of [['image/webp', 0.86], ['image/jpeg', 0.86], ['image/jpeg', 0.72]]) {
    const blob = await new Promise((r) => canvas.toBlob(r, type, q));
    if (blob && blob.type === type && blob.size <= 690 * 1024) return blob;
  }
  throw new Error('התמונה גדולה מדי גם אחרי כיווץ');
}

export async function prepareImage(file, { max = 512, square = false } = {}) {
  if (!ACCEPT.includes(file.type)) throw new Error('אפשר להעלות רק PNG, JPEG, WebP או GIF');
  if (file.size > MAX_INPUT) throw new Error('הקובץ גדול מ-10MB');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('לא הצלחנו לקרוא את התמונה'); });
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return encode(canvas);
}

export async function uploadBlob(blob, kind, title = '') {
  const q = new URLSearchParams({ kind });
  if (title) q.set('title', title);
  return api(`/api/me/images?${q}`, { method: 'POST', raw: blob, contentType: blob.type });
}

export async function uploadFile(file, kind, opts) {
  const blob = await prepareImage(file, opts);
  return uploadBlob(blob, kind);
}
