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
  // מצב מנהל: עריכה וצפייה במפלגה של משתמש אחר (גם טיוטה או פרטית). השרת בודק הרשאת מנהל בכל שמירה.
  adminPartyId: null,
  adminGallery: [],
};

const ADMIN_KEY = 'miflaga:admin-party';

export function adminPartyFromUrl() {
  const q = new URLSearchParams(location.search).get('admin_party');
  try {
    if (q && /^[A-Za-z0-9]{8,40}$/.test(q)) sessionStorage.setItem(ADMIN_KEY, q);
    return sessionStorage.getItem(ADMIN_KEY);
  } catch {
    return q;
  }
}

export function exitAdminMode() {
  try { sessionStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ }
  store.adminPartyId = null;
}

export async function loadAdminParty(id) {
  const data = await api(`/api/admin/parties/${encodeURIComponent(id)}`);
  store.adminPartyId = id;
  store.party = data.party;
  store.adminGallery = data.gallery || [];
  store.adminOwner = data.owner;
  return data;
}

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
  if (store.adminPartyId) {
    const { wizard_step: _skip, ...rest } = patch;
    await api(`/api/admin/parties/${encodeURIComponent(store.adminPartyId)}`, { method: 'PATCH', body: rest });
    await loadAdminParty(store.adminPartyId);
    if (!quiet) toast('נשמר (כמנהל, ונרשם ביומן).', 'success');
    return store.party;
  }
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
