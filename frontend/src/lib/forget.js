// Account deletion (Account › Delete account): after the server has deleted the account, this phone forgets that login
// too. These are the things kept for one login on top of the sign-in itself (the token, the kept person and screens:
// session.svelte.js endHere()). Loaded only with screens/DeleteAccount.svelte.
import { idbKeys, idbDel } from './idb.js';

/** IndexedDB keys kept for this login: unsent days, the photo, the journal list, the screens kept between opens. */
export const ownIdbKey = (login) => (k) =>
  !!login && (k.startsWith(`q:${login}:`) || k === 'photo:' + login || k === 'journals:' + login || k.startsWith(`c:${login}|`));
/** localStorage keys kept for this login: announcements seen, the batch's rules, the current book, and the mark of
 *  which person this phone's notifications were last linked to. */
export const ownLocalKey = (login) => (k) =>
  k === 'sr.pushFor' || (!!login && ['sr.annSeen.', 'sr.rules.', 'sr.book.'].some((p) => k === p + login));

export async function forgetLogin(login) {
  const idb = ownIdbKey(login), local = ownLocalKey(login);
  for (const k of await idbKeys('')) if (idb(k)) await idbDel(k);
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    for (const k of keys) if (k && local(k)) localStorage.removeItem(k);
  } catch { /* storage blocked */ }
  // names typed for others this tab, and the screen to come back to after signing in
  try { sessionStorage.removeItem('sr.fillNames'); sessionStorage.removeItem('sr.return'); } catch { /* storage blocked */ }
}
