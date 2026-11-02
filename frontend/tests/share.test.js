// Share sadhana in the mock (the server is worker/tests/shares.test.mjs): the same shapes, refusals and limits. The
// facilitator is derived and first; a phone shows "Sunil K."; the viewer reads the facilitator's student page without
// contact; remove and leave revoke at once; staff get nothing extra.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency } from '../src/lib/mock.js';

beforeEach(() => { reset(); setLatency(0); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const SUNIL = '6000000001', RAMAN = '6000000092', AARAV = '6000000011', BHAVESH = '6000000012';
// the fixture's share ids (mockshare.js): the viewer's side is by id, never the owner's phone
const FROM_AARAV = 'shareAarav', TO_RAMAN = 'shareRaman';
const tenDigits = (x) => JSON.stringify(x).match(/\d{10}/g) || [];
const msg = (r) => [r.error?.code, r.error?.fields?.[0]?.path, r.error?.message];

describe('mock: share sadhana', () => {
  it('the fixture: one share to and one from 6000000001, the facilitator first', async () => {
    const s = await login(SUNIL, 'pass-12345');
    const d = (await req('share.list', {}, s)).data;
    expect(d.facilitator).toEqual({ name: 'Natvar Gopinath Prabhuji' });
    expect(d.sharedWith.map((x) => [x.login, x.name])).toEqual([[RAMAN, 'Raman D.']]);
    expect(d.sharedWithMe.map((x) => [x.id, x.name, x.batchName])).toEqual([[FROM_AARAV, 'Aarav Gupta', 'SPS']]);
    expect(Object.keys(d.sharedWithMe[0]).sort()).toEqual(['batchName', 'id', 'name', 'since']);
    expect(d.limit).toBe(20);
    const r = await login(RAMAN, 'trd-pass-12');
    expect((await req('share.list', {}, r)).data.sharedWithMe.map((x) => [x.id, x.name])).toEqual([[TO_RAMAN, 'Sunil Kumar']]);
  });

  it('lookup masks the name and refuses as the server does', async () => {
    const s = await login(SUNIL, 'pass-12345');
    expect((await req('share.lookup', { phone: BHAVESH }, s)).data).toEqual({ name: 'Bhavesh J.' });
    expect((await req('share.lookup', { phone: '+91 ' + BHAVESH }, s)).data).toEqual({ name: 'Bhavesh J.' });
    expect(msg(await req('share.lookup', { phone: SUNIL }, s))).toEqual(['VALIDATION', 'phone', 'This is your own number.']);
    const unknown = msg(await req('share.lookup', { phone: '6000000169' }, s));
    expect(unknown).toEqual(['VALIDATION', 'phone', 'No active devotee in the app has this number.']);
    expect(msg(await req('share.lookup', { phone: '6000000087' }, s))).toEqual(unknown);        // a pending sign-up: the same answer
    expect(msg(await req('share.lookup', { phone: '6000000021' }, s))).toEqual(unknown);        // a disabled one too
    expect(msg(await req('share.lookup', { phone: RAMAN }, s))[2]).toBe('Already shared with Raman D.');
    expect(msg(await req('share.lookup', { phone: 'abc' }, s))[0]).toBe('VALIDATION');
  });

  it('add, then the viewer reads the facilitator page without contact; staff and others are refused', async () => {
    const s = await login(SUNIL, 'pass-12345'), f = await login('natvar', 'natvar-pass-1'), m = await login('master', 'master-pass-1'), c = await login('sps', 'sps-pass-12');
    const r = await req('share.add', { phone: BHAVESH }, s);
    expect(r.data.shared).toMatchObject({ login: BHAVESH, name: 'Bhavesh J.' });
    expect(msg(await req('share.add', { phone: BHAVESH }, s))[0]).toBe('VALIDATION');
    expect((await req('share.list', {}, s)).data.sharedWith.map((x) => x.login)).toEqual([RAMAN, BHAVESH]);

    const fac = (await req('fac.devotee', { login: AARAV }, f)).data;
    const shared = (await req('share.devotee', { id: FROM_AARAV }, s)).data;
    expect(fac.phone).toBe(AARAV);
    expect(['phone', 'whatsapp', 'email', 'address', 'dob'].filter((k) => k in shared)).toEqual([]);
    const { phone, whatsapp, login: _login, ...rest } = fac;
    expect(shared).toEqual(rest);
    const wk = shared.weeks[0].weekId;
    expect((await req('share.week', { id: FROM_AARAV, weekId: wk }, s)).data).toEqual((await req('fac.week', { login: AARAV, weekId: wk }, f)).data);
    expect((await req('share.week', { id: FROM_AARAV, weekId: 'x' }, s)).error.code).toBe('VALIDATION');

    for (const t of [m, c, f]) expect((await req('share.devotee', { id: FROM_AARAV }, t)).error.code).toBe('FORBIDDEN');
    expect((await req('share.devotee', { id: TO_RAMAN }, s)).error.code).toBe('FORBIDDEN');     // the id is the viewer's alone, not the owner's
    expect((await req('share.devotee', { id: AARAV }, s)).error.code).toBe('FORBIDDEN');        // a login is not an id
    // sadhana only: no 10-digit number anywhere the viewer is sent, and never the owner's login
    const week = (await req('share.week', { id: FROM_AARAV, weekId: wk }, s)).data, list = (await req('share.list', {}, s)).data.sharedWithMe;
    expect([...tenDigits(list), ...tenDigits(shared), ...tenDigits(week)]).toEqual([]);
    expect((await req('share.list', {}, c)).error.code).toBe('FORBIDDEN');                     // no sadhana of their own
  });

  it('remove and leave revoke at once; the facilitator cannot be removed', async () => {
    const s = await login(SUNIL, 'pass-12345'), r = await login(RAMAN, 'trd-pass-12');
    expect((await req('share.devotee', { id: TO_RAMAN }, r)).ok).toBe(true);
    expect((await req('share.remove', { login: RAMAN }, s)).ok).toBe(true);
    expect((await req('share.devotee', { id: TO_RAMAN }, r)).error.code).toBe('FORBIDDEN');
    expect((await req('share.remove', { login: RAMAN }, s)).error.code).toBe('NOT_FOUND');
    expect((await req('share.leave', { id: FROM_AARAV }, s)).ok).toBe(true);
    expect((await req('share.devotee', { id: FROM_AARAV }, s)).error.code).toBe('FORBIDDEN');
    expect((await req('share.list', {}, s)).data).toMatchObject({ sharedWith: [], sharedWithMe: [] });
    expect((await req('share.leave', { id: FROM_AARAV }, s)).error.code).toBe('NOT_FOUND');
  });

  it('30 lookups an hour, then BUSY', async () => {
    const r = await login(RAMAN, 'trd-pass-12');
    let busy = -1;
    for (let i = 0; i < 31; i++) { const x = await req('share.lookup', { phone: '60000001' + String(70 + (i % 20)) }, r); if (x.error?.code === 'BUSY') { busy = i; break; } }
    expect(busy).toBe(30);
  });

  it('at most 20 people per owner', async () => {
    // installShare on its own, over 22 active devotees: the cap is the module's, not the fixture's
    const { installShare } = await import('../src/lib/mockshare.js');
    const users = {};
    for (let i = 0; i < 22; i++) { const l = '60000001' + String(10 + i); users[l] = { login: l, role: 'DEVOTEE', status: 'ACTIVE', name: 'Test Devotee ' + i }; }
    const A = {}, okf = (data) => ({ ok: true, data }), fail = (code, message) => ({ ok: false, error: { code, message } });
    const fieldFail = (fields, message) => ({ ok: false, error: { code: 'VALIDATION', message, fields: fields.map(([path, m]) => ({ path, message: m })) } });
    installShare(A, { ok: okf, fail, fieldFail, db: () => ({ users, batches: [] }), scopesOf: () => ({ devotee: { batchId: 'SPS' } }), current: () => ({ batchId: 'SPS', facilitator: '' }) });
    const owner = users['6000000110'];
    for (let i = 1; i <= 20; i++) expect(A['share.add'][1]({ phone: '60000001' + String(10 + i) }, owner).ok).toBe(true);
    expect(msg(A['share.lookup'][1]({ phone: '6000000131' }, owner))[2]).toBe('You can share with at most 20 people. Remove someone first.');
  });
});
