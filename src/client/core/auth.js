// חיבור ל-Reem.bi דרך ה-SDK הרשמי בלבד. אין כאן OAuth עצמאי ואין שמירת טוקנים במקום אחר.
import { CLIENT_ID } from '../../shared/constants.js';

let client = null;
let failed = false;

export function getAuth() {
  if (client || failed) return client;
  if (!window.ReemAuth) {
    failed = true;
    return null;
  }
  // כל ההתחברויות חוזרות לדף קבוע אחד, שממשיך משם לדף שממנו יצאו.
  client = window.ReemAuth.init({ clientId: CLIENT_ID, redirectUri: `${location.origin}/auth/callback/` });
  return client;
}

/** מחכה למצב ההתחברות. מחזיר משתמש, null (לא מחובר), או false (שירות ההתחברות לא זמין). */
export async function currentUser() {
  const auth = getAuth();
  if (!auth) return false;
  try {
    return await auth.ready;
  } catch {
    return null;
  }
}

export function login(returnTo) {
  const auth = getAuth();
  if (!auth) return;
  auth.login({ returnTo: returnTo || location.href });
}

export async function logout() {
  const auth = getAuth();
  if (!auth) return;
  await auth.logout();
}

export function token() {
  return getAuth()?.getToken() || null;
}
