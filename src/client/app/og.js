// יצירת תמונת שיתוף (Open Graph) מהנתונים של המפלגה והעלאתה לשרת.
import { store, publicUrl } from './state.js';
import { uploadBlob } from './upload.js';

export async function ensureOgImage() {
  const party = store.party;
  if (!party) return null;
  const { renderBlob } = await import('../studio/export.js');
  const blob = await renderBlob('og', party, {}, { url: publicUrl(), type: 'image/jpeg', quality: 0.86 });
  const res = await uploadBlob(blob, 'og', 'תמונת שיתוף');
  store.party = { ...store.party, og_image_id: res.id };
  return res.id;
}
