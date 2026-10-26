// דף החזרה מ-Reem.bi. ה-SDK משלים את ההתחברות ומחליף את הכתובת לדף שממנו יצאו; אנחנו רק טוענים אותו.
import { getAuth } from '../core/auth.js';

const auth = getAuth();
if (!auth) {
  location.replace('/');
} else {
  auth.ready.then(() => {
    if (location.pathname === '/auth/callback/') location.replace('/app/');
    else location.reload();
  });
}
