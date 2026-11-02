// Rules (the batch's card, Chetna options) and journals (lectures, books): kept on the phone and fetched only when
// the version home.get reports differs from the stored copy.
import { call } from './api.js';
import { idbGet, idbSet } from './idb.js';

const rkey = (login) => 'sr.rules.' + login;
const memo = new Map();

function readRules(login) {
  try { return JSON.parse(localStorage.getItem(rkey(login)) || 'null'); } catch { return null; }
}

export async function getRules(login, version) {
  const stored = readRules(login);
  if (stored && (!version || stored.version === version)) return stored;
  const k = 'r|' + login + '|' + version;
  if (!memo.has(k)) {
    memo.set(k, call('rules.get', stored ? { have: stored.version } : {}).then((r) => {
      if (r.notModified && stored) return stored;
      try { localStorage.setItem(rkey(login), JSON.stringify(r)); } catch { /* storage blocked */ }
      return r;
    }).finally(() => memo.delete(k)));
  }
  try { return await memo.get(k); } catch (e) { if (stored) return stored; throw e; }
}

export async function getJournals(login, version) {
  const key = 'journals:' + login;
  const stored = await idbGet(key);
  if (stored && (!version || stored.version === version)) return stored;
  const k = 'j|' + login + '|' + version;
  if (!memo.has(k)) {
    memo.set(k, call('journals.get', stored ? { have: stored.version } : {}).then(async (j) => {
      if (j.notModified && stored) return stored;
      await idbSet(key, j);
      return j;
    }).finally(() => memo.delete(k)));
  }
  try { return await memo.get(k); } catch (e) { if (stored) return stored; throw e; }
}

// Filling for a devotee (the head, 7 Oct 2026): their own card and journal lists, with what they have heard and their
// current book, fetched for this visit only (never stored as the staff member's own copy).
const forMemo = new Map();
function forDevotee(action, target) {
  const k = action + '|' + target;
  if (!forMemo.has(k)) forMemo.set(k, call(action, { onBehalfOf: target }).catch((e) => { forMemo.delete(k); throw e; }));
  return forMemo.get(k);
}
export const getRulesFor = (target) => forDevotee('rules.get', target);
export const getJournalsFor = (target) => forDevotee('journals.get', target);
/** After a week is submitted for them, their heard list changes: fetch again next time. */
export const forgetFor = (target) => { forMemo.delete('journals.get|' + target); };

// The remembered book (one tap on a normal day), per user.
export const getCurrentBook = (login) => { try { return JSON.parse(localStorage.getItem('sr.book.' + login) || 'null'); } catch { return null; } };
export const setCurrentBook = (login, b) => { try { localStorage.setItem('sr.book.' + login, JSON.stringify(b)); } catch { /* storage blocked */ } };

/** The first journal week with a lecture not heard yet (a hint only), and its lectures. */
export function suggestedWeek(lectures, heard = []) {
  const h = new Set(heard);
  const weeks = [...new Set(lectures.map((l) => l.week))].sort((a, b) => a - b);
  const w = weeks.find((wk) => lectures.some((l) => l.week === wk && !h.has(l.lectureId))) ?? weeks[0];
  const order = ['SPL', 'GKGML', 'LOW 1', 'LOW 2'];
  return { week: w, lectures: lectures.filter((l) => l.week === w).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot)) };
}

/** Books for the change-book list: the devotee's own level first (list order), then the rest. */
export function orderBooks(books, ownLevel) {
  return [...books.filter((b) => b.level === ownLevel), ...books.filter((b) => b.level !== ownLevel)];
}
