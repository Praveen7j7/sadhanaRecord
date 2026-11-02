// The IYF ID registry, READ-ONLY (API contract §6, design §3b): the D1 table `registry`, a frozen snapshot of the old
// dashboard Devotees tab (no longer read since 27 Oct 2026, see below). Lookups read that snapshot.
//
// The four matching helpers are copies of the dashboard's RegistryService.gs (regNormPhone_, regNameParts_,
// regTokenKey_, regAliasKey_); tests/registry-parity.test.mjs checks they give identical keys.
import { apiError, invalid } from './util.js';
import { all, one } from './db.js';

export const ID_PATTERN = /^(GP|JN|KT)\d{2}-\d{4}$/;
const HONORIFICS = ['hg', 'h', 'g', 'pr', 'prji', 'prabhuji', 'prabhu', 'ji', 'das', 'dasa', 'sri', 'srila'];

/* ---- copies of the dashboard's matching rules (do not change one without the other) ---- */
export function idNormPhone(v) {
  if (v === '' || v === null || v === undefined) return '';
  const d = String(typeof v === 'number' ? Math.round(v) : v).replace(/\D/g, '');
  if (d.length > 10) return d.slice(-10);
  if (d.length === 10) return d;
  if (d.length === 9) return '0' + d;
  return '';
}
export function idNameParts(name) {
  return String(name == null ? '' : name).toLowerCase().replace(/[^a-z ]/g, ' ')
    .split(/\s+/).filter(w => w && !HONORIFICS.includes(w));
}
export function idTokenKey(part) {
  const t = String(part || '').replace(/w/g, 'v').replace(/h/g, '').replace(/[aeiou]/g, '');
  return t || String(part || '');
}
export function idAliasKey(name, phone) {
  const p = idNormPhone(phone);
  if (!p) return '';
  const parts = idNameParts(name);
  return p + '|' + (parts.length ? idTokenKey(parts[0]) : '');
}
/* ------------------------------------------------------------------------------------------ */

/*
 * THE DASHBOARD IS NO LONGER READ (the head, 27 Oct 2026: Sadhana Record is its own source for everything).
 *
 * Until then a scheduled job copied the Facilitator Dashboard's Devotees tab into `registry` every 30 minutes
 * (refreshRegistry, with its header check, deletion guard and followMerges) and its NameMap into the facilitator list
 * (refreshFacilitators); checkIyfId also re-read the tab when an ID was missing. All of that fetching is DELETED, not
 * switched off: nothing calls Google for the dashboard any more (tests/dashboard-retired.test.mjs).
 *
 * The `registry` table STAYS, as a frozen snapshot of the last copy: approval's IYF ID matches (requests.list), the
 * ID search (requests.searchIds, ids.search), the possible-duplicates list (oversight.js), ids.link / ids.check
 * (checkIyfId) and the devotee card's registry match (devotees.js) still read it exactly as before. It is never
 * dropped; nothing writes it now.
 */

export async function registryRows(db) {
  return (await all(db, 'SELECT * FROM registry')).map(r => ({ ...r, aliases: JSON.parse(r.aliases || '[]') }));
}

export function registryPublic(r, why) {
  return { iyfId: r.iyf_id, name: r.name, level: r.level, facilitator: r.facilitator,
           phoneEnd: r.phone ? '…' + r.phone.slice(-4) : '', mergedInto: r.merged_into || null, why: why || '' };
}

/** Likely IDs for a sign-up, using the registry's own matching. `nameMatches` tells the app whether the name agrees. */
export function registryMatches(rows, phone, name) {
  const p = idNormPhone(phone), keys = idNameParts(name).map(idTokenKey), out = [], seen = new Set();
  const add = (r, why) => {
    if (seen.has(r.iyf_id)) return;
    seen.add(r.iyf_id);
    const parts = idNameParts(r.name).map(idTokenKey);
    out.push({ ...registryPublic(r, why), nameMatches: keys.some(k => parts.includes(k)) });
  };
  const key = p ? p + '|' + (keys[0] || '') : '';
  for (const r of rows) if (key && r.aliases.includes(key)) add(r, 'phone + name');
  for (const r of rows) {
    if (!p || r.phone !== p) continue;
    const parts = idNameParts(r.name).map(idTokenKey);
    add(r, keys.some(k => parts.includes(k)) ? 'phone + name' : 'phone');
  }
  if (keys.length >= 2) {
    let n = 0;
    for (const r of rows) {
      if (n >= 5 || seen.has(r.iyf_id)) continue;
      const parts = idNameParts(r.name).map(idTokenKey);
      if (keys.every(k => parts.includes(k))) { add(r, 'name'); n++; }
    }
  }
  return out;
}

export function registrySearchRows(rows, qtext) {
  const s = String(qtext || '').trim();
  if (s.length < 3) throw invalid({ path: 'q', message: 'Type at least 3 characters.' });
  const qId = s.toUpperCase(), qDigits = s.replace(/\D/g, ''), qKeys = idNameParts(s).map(idTokenKey), out = [];
  for (const r of rows) {
    if (out.length >= 20) break;
    const byName = qKeys.length > 0 && qDigits.length === 0 && (() => {
      const parts = idNameParts(r.name).map(idTokenKey);
      return qKeys.every(k => parts.some(p => p.startsWith(k)));
    })();
    if (r.iyf_id.includes(qId) || (qDigits.length >= 4 && r.phone.includes(qDigits)) || byName) out.push(registryPublic(r, ''));
  }
  return out;
}

/**
 * The four ID checks (API contract §0). Returns the registry row, or throws UNKNOWN_ID / CONFLICT.
 * Reads the frozen snapshot only (an ID missing from it used to trigger a read of the dashboard; not since 27 Oct 2026).
 */
export async function checkIyfId(ctx, iyfId, forLogin) {
  const id = String(iyfId || '').trim().toUpperCase();
  if (!ID_PATTERN.test(id)) throw apiError('UNKNOWN_ID', 'That is not an IYF ID.');
  const r = await one(ctx.db, 'SELECT * FROM registry WHERE iyf_id = ?', id);
  if (!r) throw apiError('UNKNOWN_ID', id + ' was never allocated in the registry.');
  if (r.merged_into) throw apiError('UNKNOWN_ID', `${id} was merged into ${r.merged_into}. Use ${r.merged_into} instead.`);
  const other = await one(ctx.db, 'SELECT login, name FROM accounts WHERE iyf_id = ? AND login <> ?', id, String(forLogin || ''));
  if (other) throw apiError('CONFLICT', `${id} already belongs to another account (${other.name}).`);
  return r;
}

/** { iyfId: { login, name } } for every linked account. */
export async function linkedLogins(db) {
  const out = {};
  for (const a of await all(db, 'SELECT login, name, iyf_id FROM accounts WHERE iyf_id IS NOT NULL')) out[a.iyf_id] = { login: a.login, name: a.name };
  return out;
}
