import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency } from '../src/lib/mock.js';
import { defaultChoice } from '../src/lib/validate.js';

beforeEach(() => { reset(); setLatency(0); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
async function login(l, p) { const r = await req('auth.login', { login: l, password: p }); return r.data?.token; }

describe('mock permissions', () => {
  it('rejects calls without a token', async () => {
    expect((await req('requests.list')).error.code).toBe('UNAUTHENTICATED');
  });
  it('coordinator cannot use master actions', async () => {
    const t = await login('sps', 'sps-pass-12');
    // each with only the fields it takes: an unknown field is BAD_REQUEST before any role check, on the server and (G15) here
    for (const [a, d] of [['coordinators.list', {}], ['batches.list', {}], ['ids.search', { q: 'abc' }]]) expect((await req(a, d, t)).error.code).toBe('FORBIDDEN');
  });
  it('coordinator sees only their batches', async () => {
    const t = await login('sps', 'sps-pass-12');
    const r = await req('requests.list', {}, t);
    expect(r.data.signUps.map((s) => s.batchId).sort()).toEqual(['SPS', 'SPS2', 'SPSO']);
    expect((await req('requests.list', { batchId: 'DPS' }, t)).error.code).toBe('FORBIDDEN');
  });
  it('master sees every batch, devotee sees nothing', async () => {
    const m = await login('master', 'master-pass-1');
    expect((await req('requests.list', {}, m)).data.signUps).toHaveLength(4);
    const d = await login('6000000001', 'pass-12345');
    expect((await req('requests.list', {}, d)).error.code).toBe('FORBIDDEN');
  });
  it('coordinator cannot approve another batch', async () => {
    const t = await login('sps', 'sps-pass-12');
    const r = await req('requests.approve', { phone: '6000000088', link: { newId: true }, levelEntryDate: '2026-10-02' }, t);
    expect(r.error.code).toBe('FORBIDDEN');
  });
});

describe('mock approval and ID rules', () => {
  it('only allocated, unmerged, unlinked IDs can be linked', async () => {
    const t = await login('sps', 'sps-pass-12');
    const a = (iyfId) => req('requests.approve', { phone: '6000000087', link: { iyfId }, levelEntryDate: '2026-10-02' }, t);
    expect((await a('KT26-9999')).error.code).toBe('UNKNOWN_ID');
    const merged = await a('KT26-0050');
    expect(merged.error.code).toBe('UNKNOWN_ID');
    expect(merged.error.message).toContain('KT26-0042');
    expect((await a('KT26-0003')).error.code).toBe('CONFLICT');
    const good = await a('KT26-0042');
    expect(good.data).toEqual({ iyfId: 'KT26-0042', linked: true });
  });
  it('noIdYet approves with no ID; picking a linked ID conflicts', async () => {
    const t = await login('sps', 'sps-pass-12');
    const n = await req('requests.approve', { phone: '6000000034', link: { noIdYet: true }, levelEntryDate: '2026-10-02' }, t);
    expect(n.data).toEqual({ iyfId: null, linked: false });
    expect((await req('requests.approve', { phone: '6000000074', link: { newId: true }, levelEntryDate: '2026-10-02' }, t)).error.code).toBe('BAD_REQUEST');
  });
  it('registry.search needs 3 characters', async () => {
    const t = await login('sps', 'sps-pass-12');
    expect((await req('registry.search', { q: 'ra' }, t)).error.code).toBe('VALIDATION');
    expect((await req('registry.search', { q: 'rah' }, t)).data.results.length).toBeGreaterThan(0);
  });
  it('reject needs a reason', async () => {
    const t = await login('sps', 'sps-pass-12');
    expect((await req('requests.reject', { phone: '6000000074', reason: '' }, t)).error.code).toBe('VALIDATION');
  });
});

describe('mock auth', () => {
  it('status errors only after the password is right', async () => {
    expect((await req('auth.login', { login: '6000000087', password: 'nope' })).error.code).toBe('BAD_CREDENTIALS');
    expect((await req('auth.login', { login: '6000000087', password: 'pass-12345' })).error.code).toBe('PENDING_APPROVAL');
  });
  it('locks out after 5 wrong tries', async () => {
    let r;
    for (let i = 0; i < 5; i++) r = await req('auth.login', { login: 'sps', password: 'x' });
    expect(r.error.code).toBe('LOCKED_OUT');
    expect(r.error.data.until).toBeTruthy();
  });
  it('new coordinator must change the temporary password', async () => {
    const m = await login('master', 'master-pass-1');
    expect((await req('coordinators.create', { username: 'dps1', name: 'Dps One', batchIds: ['DPS'], tempPassword: 'temp-pass-1' }, m)).ok).toBe(true);
    const l = await req('auth.login', { login: 'dps1', password: 'temp-pass-1' });
    expect(l.ok).toBe(true);
    expect(l.data.user.mustChangePassword).toBe(true);
    const tok = l.data.token;
    expect((await req('auth.me', {}, tok)).data.user.login).toBe('dps1');
    expect((await req('requests.list', {}, tok)).error.code).toBe('MUST_CHANGE_PASSWORD');
    expect((await req('auth.changePassword', { current: 'temp-pass-1', new: 'brand-new-pw' }, tok)).ok).toBe(true);
    expect((await req('requests.list', {}, tok)).ok).toBe(true);
  });
  it('sign-up maps contract rules to field paths and blocks duplicate phones', async () => {
    const body = { phone: '6000000030', name: 'Test Person', batchId: 'SPS', facilitator: 'Natvar Gopinath Prabhuji', classDay: 'SUN', email: 'test.person@gmail.com', whatsapp: '6000000030', password: 'good-password', profile: { dob: '2000-01-01', bloodGroup: 'A-', emergency: { name: 'Kin Person', relation: 'Father', phone: '6000000030' }, address: { line: 'House 1, Gali 2', area: 'Rohini', city: 'North West Delhi', state: 'Delhi', pin: '110085' } }, consentPhoto: false };
    const bad = await req('auth.signUp', body);
    expect(bad.error.fields.map((f) => f.path)).toEqual(['profile.emergency.phone']);
    body.profile.emergency.phone = '6000000198';
    expect((await req('auth.signUp', body)).data.status).toBe('PENDING');
    expect((await req('auth.signUp', body)).error.code).toBe('CONFLICT');
  });
  it('facilitator from the list; class day, email required; WhatsApp optional (no group leader any more)', async () => {
    const base = { phone: '6000000197', name: 'List Person', batchId: 'SPS', password: 'good-password', classDay: 'SAT', email: 'list.person@gmail.com', profile: { dob: '2000-01-01', bloodGroup: 'A-', emergency: { name: 'Kin Person', relation: 'Father', phone: '6000000190' }, address: { line: 'House 1, Gali 2', area: 'Rohini', city: 'North West Delhi', state: 'Delhi', pin: '110085' } } };
    expect((await req('auth.signUp', { ...base, facilitator: 'Typed Name Pr' })).error.fields.map((f) => f.path)).toEqual(['facilitator']);
    const f = { ...base, facilitator: 'Natvar Gopinath Prabhuji' };
    expect((await req('auth.signUp', { ...f, classDay: 'MON', email: 'nope', whatsapp: '123' })).error.fields.map((x) => x.path)).toEqual(['classDay', 'email', 'whatsapp']);
    expect((await req('auth.signUp', { ...f, email: 'list.person@gmial.com' })).error.fields).toEqual([{ path: 'email', message: 'Did you mean list.person@gmail.com?' }]);
    expect((await req('auth.signUp', f)).data.status).toBe('PENDING');
    const t = (await req('auth.login', { login: 'sps', password: 'sps-pass-12' })).data.token;
    const s = (await req('requests.list', { batchId: 'SPS' }, t)).data.signUps.find((x) => x.phone === '6000000197');
    expect(s).toMatchObject({ classDay: 'SAT', email: 'list.person@gmail.com', whatsapp: '' });
    expect('groupLeader' in s).toBe(false);
  });
  it('requestReset answers the same for unknown numbers', async () => {
    const r = await req('auth.requestReset', { login: '6000000100', newPassword: 'whatever-123' });
    expect(r.data.status).toBe('RESET_REQUESTED');
  });
  it('unknown fields or actions are BAD_REQUEST', async () => {
    expect((await handle({ v: 1, action: 'nope', data: {} })).error.code).toBe('BAD_REQUEST');
    expect((await handle({ v: 1, action: 'meta.get', data: {}, extra: 1 })).error.code).toBe('BAD_REQUEST');
  });
});

describe('revised contract shapes', () => {
  it('batches.list uses coordinatorLogins and batches.update accepts them', async () => {
    const m = await login('master', 'master-pass-1');
    const b = (await req('batches.list', {}, m)).data.find((x) => x.batchId === 'SPS');
    expect(b.coordinatorLogins).toEqual(['sps']);
    expect(b.coordinatorNames).toEqual(['SPS Team']);
    const u = await req('batches.update', { batchId: 'SPS', coordinatorLogins: [], pilot: true }, m);
    expect(u.data).toMatchObject({ coordinatorLogins: [], pilot: true });
  });
  it('resets carry role; matches carry linked', async () => {
    const t = await login('sps', 'sps-pass-12');
    const r = (await req('requests.list', {}, t)).data;
    expect(r.resets[0].role).toBe('DEVOTEE');
    expect(r.signUps.every((s) => s.matches.every((x) => typeof x.linked === 'boolean'))).toBe(true);
  });
  it('coordinators.list has phone and mustChangePassword', async () => {
    const m = await login('master', 'master-pass-1');
    expect((await req('coordinators.list', {}, m)).data[0]).toHaveProperty('mustChangePassword');
  });
});

describe('name mismatch and preselect rule', () => {
  it('mock marks phone-only matches with nameMatches false', async () => {
    const t = await login('sps', 'sps-pass-12');
    const s = (await req('requests.list', {}, t)).data.signUps;
    expect(s.find((x) => x.phone === '6000000034').matches[0]).toMatchObject({ why: 'phone', nameMatches: false });
    expect(s.find((x) => x.phone === '6000000087').matches[0].nameMatches).toBe(true);
  });
  it('defaultChoice preselects only a single, name-matching, unlinked match', () => {
    const m = (o) => ({ iyfId: 'KT26-0001', nameMatches: true, linked: false, ...o });
    expect(defaultChoice([m()])).toBe('KT26-0001');
    expect(defaultChoice([m({ nameMatches: false })])).toBe('');
    expect(defaultChoice([m({ linked: true })])).toBe('');
    expect(defaultChoice([m(), m({ iyfId: 'KT26-0002' })])).toBe('');
    expect(defaultChoice([])).toBe('');
  });
});

// Closing a training, as worker/src/closing.js does (18 Oct 2026): every enrolment ends, qualified people gain the
// facilitator's card, and nobody is promoted out of a training or switched off by leaving it. Sunil (6000000001) is
// the fixture devotee who can sign in, so he is the one whose menu is checked.
describe('mock closing of a training', () => {
  const enrol = async (e, names) => {
    const out = [];
    for (const q of names) {
      const s = await req('enrol.search', { batchId: 'ETP-21', q }, e);
      out.push(s.data.people[0].login);
      expect((await req('enrol.add', { batchId: 'ETP-21', login: out.at(-1) }, e)).ok).toBe(true);
    }
    return out;
  };
  const scopesOf = async (l) => (await req('auth.me', {}, await login(l, 'pass-12345'))).data.user.scopes;

  it('ends every enrolment; leaving the training switches nobody off', async () => {
    const e = await login('etp', 'etp-pass-12');
    const [chetan, sunil] = await enrol(e, ['Chetan', 'Sunil']);
    expect(sunil).toBe('6000000001');
    expect((await scopesOf(sunil)).trainee?.batchId).toBe('ETP-21');
    const pv = (await req('batches.closingPreview', { batchId: 'ETP-21' }, e)).data;
    expect(pv.members.map((m) => m.login).sort()).toEqual([chetan, sunil].sort());
    expect(pv.nextLevels).toEqual([]);
    const m = await login('master', 'master-pass-1');
    expect((await req('batches.close', { batchId: 'ETP-21', decisions: [
      { login: chetan, decision: 'promoted', toBatch: 'DPS' }, { login: sunil, decision: 'left' }] }, m)).error.code).toBe('VALIDATION');
    const r = await req('batches.close', { batchId: 'ETP-21', decisions: [
      { login: chetan, decision: 'repeat' }, { login: sunil, decision: 'left' }] }, e);
    expect(r.data).toMatchObject({ qualified: 0, left: 1, repeat: 1, promoted: 0 });
    const sc = await scopesOf(sunil);                            // signs in: the account is still active
    expect(sc.trainee).toBeNull();                               // the ETP section went with the batch
    expect(sc.devotee?.batchId).toBe('SPS');                     // and his own batch is untouched
    expect((await req('batches.closingPreview', { batchId: 'ETP-21' }, e)).error.code).toBe('CONFLICT');
  });

  // ADR 0010 (22 Oct 2026): enrolling grants TEMPORARY facilitation; the end of the training takes it back, qualifying
  // included, unless the head made it lasting first (until then, qualifying kept it)
  it('a student facilitates from enrolment; qualifying takes it back unless the head made it lasting', async () => {
    const e = await login('etp', 'etp-pass-12'), m = await login('master', 'master-pass-1');
    expect((await scopesOf('6000000001')).facilitator).toBeNull();
    const [sunil, chetan] = await enrol(e, ['Sunil', 'Chetan']);
    expect((await scopesOf(sunil)).facilitator?.name).toBe('Sunil Kumar');   // granted by enrolling, as on the server
    expect((await req('facilitators.setLasting', { name: 'Sunil Kumar' }, m)).ok).toBe(true);
    expect((await req('batches.close', { batchId: 'ETP-21', decisions: [{ login: sunil, decision: 'qualified' }, { login: chetan, decision: 'qualified' }] }, e)).data.qualified).toBe(2);
    const sc = await scopesOf(sunil);
    expect(sc.trainee).toBeNull();
    expect(sc.facilitator?.name).toBe('Sunil Kumar');                        // made lasting: kept
    // temporary: taken back — his name is switched off the pick list (his own sign-in is not a fixture here)
    expect((await req('facilitators.list', {}, m)).data.facilitators.find((f) => /^Chetan/.test(f.name))?.active).toBe(false);
  });
});

// One id system (22 Oct 2026), as the worker: a devotee without an IYFD is asked for their year at the next open;
// answering issues it, they stop being asked, and they leave the head's "Waiting for their year" list.
describe('mock: every devotee ends on IYFD', () => {
  it('asks, issues once, and empties the waiting list', async () => {
    const c = await login('sps', 'sps-pass-12');
    expect((await req('requests.approve', { phone: '6000000087', link: { noIdYet: true }, levelEntryDate: '2026-10-02' }, c)).ok).toBe(true);
    const d = await login('6000000087', 'pass-12345');
    expect((await req('auth.me', {}, d)).data.user.needsYear).toBe(true);
    const m = await login('master', 'master-pass-1');
    expect((await req('ids.appList', {}, m)).data.waiting.some((w) => w.login === '6000000087')).toBe(true);
    const p = (await req('profile.update', { connectedSince: '2021' }, d)).data;
    expect(p.iyfId).toMatch(/^IYFD-2021-\d{4}$/);
    expect((await req('auth.me', {}, d)).data.user.needsYear).toBe(false);
    expect((await req('profile.update', { connectedSince: '2022' }, d)).error.code).toBe('VALIDATION');
    expect((await req('ids.appList', {}, m)).data.waiting.some((w) => w.login === '6000000087')).toBe(false);
  });
  it('the fixture devotee holds an IYFD, so the checks are never stopped by the question', async () => {
    const d = await login('6000000001', 'pass-12345');
    expect((await req('auth.me', {}, d)).data.user.needsYear).toBe(false);
  });
});

