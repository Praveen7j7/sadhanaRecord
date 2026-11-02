// D1 helpers and the reads every action shares. D1 has no open transactions; db.batch([...]) is atomic, and
// uniqueness is enforced by the schema (PRIMARY KEY, UNIQUE), so check-then-write races cannot create duplicates.
import { isoIst, csv, mondayOf } from './util.js';

/**
 * One API call's view of the database (phase 6 load test, 3 Oct 2026): the same D1 binding, plus a small memory of
 * reads every action repeats (all settings, the batch list, a person's open membership), so one call asks for each
 * once instead of up to 8 times. Any write (a non-SELECT statement, a batch, exec) clears it, so a call never sees a
 * stale value; nothing is kept between calls.
 */
export function requestDb(raw) {
  const memo = new Map();
  return {
    __memo: memo,
    __raw: raw,
    prepare(sql) { if (!/^\s*(SELECT|WITH)\b/i.test(sql)) memo.clear(); return raw.prepare(sql); },
    batch(list) { memo.clear(); return raw.batch(list); },
    exec(sql) { memo.clear(); return raw.exec(sql); }
  };
}

/**
 * Several READS in one round trip (17 Oct 2026).
 *
 * Every statement here is a Worker→D1 network hop, and the hop, not the SQL, is what the devotee waits for:
 * home.get read 22 rows' worth of nothing in 8 ms of CPU and took 1.6 s on the load test (docs/PERFORMANCE.md),
 * 4.4 s at the worst in the live Run Log. D1's batch() sends the list in ONE request and answers each statement
 * in order, so the same statements, the same rows and the same CPU cost one hop instead of N.
 *
 * READS ONLY, and that is the whole point of a second door beside db.batch():
 *   · the memo is NOT cleared. db.batch() assumes writes and clears it; a read that cleared the memory of
 *     settings and batches would cost MORE queries than it saved.
 *   · a batch is one implicit transaction and is ALL OR NOTHING: if one statement fails the call rejects, so
 *     the caller sees the same thrown error it would have seen from the single statement. Never put a
 *     statement here whose failure the caller means to catch and continue from.
 *
 * Returns one value per statement, in order, each shaped like .first() (the row, or null) — `rows` asks for
 * .all()'s array instead. Falls back to running them one by one when the binding has no batch(), so a plain
 * D1 binding, the load meter's wrapper and any future shim all work unchanged.
 */
export async function reads(db, list) {
  const stmts = list.map(x => (x && x.stmt ? x.stmt : x));
  if (!stmts.length) return [];
  const wantRows = list.map(x => !!(x && x.stmt && x.rows));
  // the binding underneath requestDb, so the per-call memo SURVIVES a read batch (requestDb.batch clears it)
  const binding = db.__raw || db;
  // one hop when the binding can; otherwise exactly what the call sites did before this helper existed
  if (typeof binding.batch !== 'function') {
    return Promise.all(stmts.map((s, i) => (wantRows[i] ? s.all().then(r => r.results) : s.first())));
  }
  const out = await binding.batch(stmts);
  return out.map((r, i) => (wantRows[i] ? (r?.results ?? []) : (r?.results?.[0] ?? null)));
}
/** Marks a statement in `reads([...])` as wanting every row (like .all()), not just the first. */
export const rows = stmt => ({ stmt, rows: true });
function remember(db, key, read) {
  const m = db.__memo;
  if (!m) return read();
  if (!m.has(key)) m.set(key, read().catch((e) => { m.delete(key); throw e; }));
  return m.get(key);
}

export const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
export const one = (db, sql, ...args) => q(db, sql, ...args).first();
export const all = async (db, sql, ...args) => (await q(db, sql, ...args).all()).results;
export const run = (db, sql, ...args) => q(db, sql, ...args).run();

/**
 * Statement marking reference lists as changed, so the next copy to Sheets rewrites them. Tables that change while the
 * app runs need no mark any more: their triggers log each changed row (migration 0018, src/mirror.js), so for them this
 * is a statement that writes nothing (each mark used to cost a database write per table on every save).
 */
const FLAGGED = new Set(['card_ranges', 'seva_rules', 'chetna_options', 'lectures', 'books', 'book_files', 'book_chapters']);
export const dirty = (db, ...tbls) => {
  const t = tbls.filter(x => FLAGGED.has(x));
  return t.length ? q(db, `UPDATE mirror_state SET dirty = dirty + 1 WHERE tbl IN (${t.map(() => '?').join(',')})`, ...t) : q(db, 'SELECT 1 WHERE 0');
};

/** Settings as { key: value }. */
export async function settings(db) {
  return { ...(await remember(db, 'settings', async () => {
    const out = {};
    for (const r of await all(db, 'SELECT key, value FROM settings')) out[r.key] = r.value;
    return out;
  })) };
}
/**
 * The settings read as a statement to send inside a caller's reads() batch (S2, 27 Oct 2026), or null when this call
 * already holds them. Pair it with keepSettings(), so setting() / settings() later in the call cost no query — the
 * same rows, read in a round trip the call was making anyway.
 */
export const settingsRead = (db) => (db.__memo && !db.__memo.has('settings') ? rows(q(db, 'SELECT key, value FROM settings')) : null);
/** Files the rows settingsRead() brought back as this call's settings (what settings() would have remembered). */
export function keepSettings(db, list) {
  if (!db.__memo || db.__memo.has('settings') || !Array.isArray(list)) return;
  const out = {};
  for (const r of list) out[r.key] = r.value;
  db.__memo.set('settings', Promise.resolve(out));
}
export async function setting(db, key, fallback) {
  if (db.__memo) { const v = (await settings(db))[key]; return v !== undefined && v !== '' ? v : fallback; }
  const r = await one(db, 'SELECT value FROM settings WHERE key = ?', key);
  return r && r.value !== '' ? r.value : fallback;
}

export async function batchesAll(db) { return (await remember(db, 'batches', () => all(db, 'SELECT * FROM batches ORDER BY rowid'))).map(b => ({ ...b })); }

export const account = (db, login) => one(db, 'SELECT * FROM accounts WHERE login = ?', String(login));

/*
 * The devotee's open membership (to_week blank), or null.
 *
 * Its `facilitator` is the facilitator's name AS IT IS NOW (Phase 24, one name, one place): the membership points to
 * the facilitator by id (fac_id) and the name is read from the facilitators row in the SAME statement — a join, not a
 * round trip — so every screen built from it follows a rename. A membership whose name is on no facilitator row keeps
 * the text it was written with.
 */
export const CURRENT_MEMBERSHIP = `SELECT m.*, f."name" AS fac_now FROM memberships m LEFT JOIN facilitators f ON f.id = m.fac_id
                                    WHERE m.login = ? AND m.to_week = '' ORDER BY m.id DESC LIMIT 1`;
const facNow = (m) => { if (!m) return m; const { fac_now, ...rest } = m; if (fac_now != null) rest.facilitator = fac_now; return rest; };
export const currentMembership = async (db, login) => {
  const m = await remember(db, 'cm:' + login, () => one(db, CURRENT_MEMBERSHIP, String(login)).then(facNow));
  return m ? { ...m } : m;
};

/** The batch a devotee belongs to: the open membership, else the batch chosen at sign-up. */
export async function devoteeBatch(db, acct) {
  const m = await currentMembership(db, acct.login);
  return m ? m.batch_id : acct.requested_batch || '';
}

/**
 * The three reads every authenticated call needs: the open membership, the batch list, the group-leader row.
 *
 * One round trip instead of three (17 Oct 2026). They were already concurrent (Promise.all), but concurrent
 * still means three requests to D1; batched it is one. The memo is respected BOTH ways: anything already
 * remembered is not asked for again, and what this reads is remembered for the rest of the call, so
 * batchesAll()/currentMembership() later in the same call stay free (that is what keeps classOpensFor and the
 * week screens at no extra query).
 */
async function scopeReads(db, login, extra = []) {
  const m = db.__memo, L = String(login);
  // reads the caller wants beside these, made from the login (the replay check, G2): they ride in this batch
  const more = extra.map(x => x.stmt(L));
  const haveM = m?.has('cm:' + L), haveB = m?.has('batches');
  // already in memory: take it from there, and ask only for what is missing
  const TR = `SELECT e.batch_id, b.name FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
               WHERE e.login = ? AND e.state = 'ACTIVE' ORDER BY e.id DESC LIMIT 1`;
  if (haveM && haveB) {
    const [gl, tr, ...got] = await reads(db, [q(db, 'SELECT batch_id FROM leaders WHERE login = ?', L), q(db, TR, L), ...more]);
    got.forEach((r, i) => { extra[i].row = r; });
    return [await currentMembership(db, L), await batchesAll(db), gl, tr];
  }
  const want = [];
  if (!haveM) want.push(['cm', q(db, CURRENT_MEMBERSHIP, L)]);
  if (!haveB) want.push(['batches', rows(q(db, 'SELECT * FROM batches ORDER BY rowid'))]);
  want.push(['gl', q(db, 'SELECT batch_id FROM leaders WHERE login = ?', L)]);
  want.push(['tr', q(db, TR, L)]);
  const got = await reads(db, [...want.map(x => x[1]), ...more]);
  got.slice(want.length).forEach((r, i) => { extra[i].row = r; });
  const by = Object.fromEntries(want.map((x, i) => [x[0], x[0] === 'cm' ? facNow(got[i]) : got[i]]));
  // remember what was just read, so the rest of the call does not ask again (same values remember() would hold)
  if (m) {
    if (!haveM) m.set('cm:' + L, Promise.resolve(by.cm));
    if (!haveB) m.set('batches', Promise.resolve(by.batches));
  }
  return [haveM ? await currentMembership(db, L) : (by.cm ? { ...by.cm } : by.cm),
          haveB ? await batchesAll(db) : by.batches.map(b => ({ ...b })),
          by.gl, by.tr];
}

/**
 * A person's scopes (decision 34): one login can be a devotee (own form), a coordinator of some batches and a master.
 *   devotee: { batchId } when the account has an open membership · coordinator: [batchIds] · master: boolean
 */
export async function scopesOf(db, acct, extra = []) {
  const [m, batches, gl, tr] = await scopeReads(db, acct.login, extra);
  return {
    devotee: m && acct.role === 'DEVOTEE' ? { batchId: m.batch_id } : null,
    // a group leader (decision 41): a devotee who leads a group of their batch
    groupLeader: gl && acct.role === 'DEVOTEE' && acct.status === 'ACTIVE' ? { batchId: gl.batch_id } : null,
    // a facilitator login (4 Oct 2026): reads the devotees with that facilitator. The name is the facilitator row's as it
    // is now when the account was read with it (session.js: a_fac_now, same statement); the account's copy otherwise
    facilitator: acct.status === 'ACTIVE' && acct.facilitator_name ? { name: acct.a_fac_now || acct.facilitator_name } : null,
    // the training they are IN right now, if any (the head, 18 Oct 2026): this is what puts the
    // card in their menu and takes it away the moment they are removed. Only ACTIVE counts — a
    // finished or ended training is a record on their profile, not a tab.
    trainee: tr ? { batchId: tr.batch_id, name: tr.name } : null,
    coordinator: batches.filter(b => csv(b.coordinator_logins).includes(acct.login)).map(b => b.batch_id),
    master: !!acct.is_master || acct.role === 'MASTER'
  };
}

/** Batch ids the caller may act on as staff (coordinator batches; every batch for a master). */
export async function scopeBatches(db, ctx) {
  const s = ctx.scopes || await scopesOf(db, ctx.acct || await account(db, ctx.login));
  if (s.master) return (await batchesAll(db)).map(b => b.batch_id);
  return s.coordinator;
}

/** Statement for one AuditLog line. */
export function audit(db, ctx, action, target, batchId, before, after, reason, requestId) {
  return q(db, `INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    isoIst(ctx.now()), ctx.login || 'SYSTEM', ctx.role || 'SYSTEM', action, String(target || ''), String(batchId || ''),
    before == null ? '' : JSON.stringify(before), after == null ? '' : JSON.stringify(after), String(reason || ''), String(requestId || ''));
}

/** True for the IYF head and for anyone listed as a coordinator of any batch (security review, 3 Oct 2026): such a person
 *  is changed (status, people, photo, password reset) only by a master, never by the coordinator of their own batch. */
export async function isStaffAccount(db, acct) {
  if (!acct) return false;
  if (acct.is_master || acct.facilitator_name) return true;      // a facilitator's password: only the IYF head resets it
  return (await batchesAll(db)).some(b => (b.coordinator_logins || '').split(',').map(x => x.trim()).includes(acct.login));
}

export { mondayOf };
