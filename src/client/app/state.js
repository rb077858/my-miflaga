// מצב האזור האישי: המשתמש, המפלגה והקטגוריות. השרת הוא מקור האמת; כאן רק עותק לתצוגה.
import { api } from '../core/api.js';
import { toast } from '../core/ui.js';
import { MESSAGES, pick } from '../../shared/humor.js';

export const store = {
  me: null,
  party: null,
  summary: null,
  categories: [],
  disabledTemplates: [],
  isAdmin: false,
};

export async function loadMe() {
  const data = await api('/api/me');
  store.me = data.user;
  store.party = data.party;
  store.summary = data.summary;
  store.categories = data.categories;
  store.disabledTemplates = data.disabled_templates || [];
  store.isAdmin = data.is_admin;
  return data;
}

export async function savePatch(patch, { quiet = false } = {}) {
  const data = await api('/api/me/party', { method: 'PATCH', body: patch });
  store.party = data.party;
  if (!quiet) toast(pick(MESSAGES.saved), 'success');
  return data.party;
}

export function publicUrl(party = store.party) {
  return `${location.origin}/party/${encodeURIComponent(party.slug)}/`;
}

export function statusInfo(party = store.party) {
  if (!party) return { label: 'אין מפלגה', tone: '' };
  if (party.mod_status === 'blocked') return { label: 'הושעתה על ידי ההנהלה', tone: 'red' };
  if (party.mod_status === 'hidden') return { label: 'מוסתרת מהרשימות', tone: 'amber' };
  if (party.status === 'draft') return { label: 'טיוטה', tone: '' };
  return party.visibility === 'public' ? { label: 'ציבורית', tone: 'green' } : { label: 'פרטית', tone: 'amber' };
}

// טיוטה מקומית לשלב הראשון בלבד (לפני שהמפלגה נוצרה בשרת). לא מקור אמת.
const draftKey = () => `miflaga:draft:${store.me?.id || 'anon'}`;

export function loadLocalDraft() {
  try { return JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch { return null; }
}

export function saveLocalDraft(data) {
  try { localStorage.setItem(draftKey(), JSON.stringify({ ...data, saved_at: Date.now() })); } catch { /* מלא או חסום */ }
}

export function clearLocalDraft() {
  try { localStorage.removeItem(draftKey()); } catch { /* ignore */ }
}
