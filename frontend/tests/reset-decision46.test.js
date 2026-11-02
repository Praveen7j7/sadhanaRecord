// Decision 46 (the head, 14 Oct 2026) · audit finding F1 · roadmap 1.1 — the app's half.
//
// The screen used to ask the person for the NEW PASSWORD, which is what let anyone who knew a devotee's
// phone number set a password on an account that was not theirs. Now it asks for the number only, and the
// coordinator is shown a server-made password ONCE, in a dialog that cannot be dismissed by accident.
//
// What is checked: the Forgot screen no longer collects a password; the mock matches the server's contract
// so the browser checks exercise the real shape; and the dialog is wired so it cannot be closed by a stray
// tap, an Escape, or a ✕ — because there is no way to read the password back.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle, reset, setLatency } from '../src/lib/mock.js';

beforeEach(() => { reset(); setLatency(0); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('decision 46: the Forgot screen asks for a phone number only', () => {
  const forgot = src('../src/screens/Forgot.svelte');

  it('does not collect a password at all', () => {
    // the finding: these fields were the attack surface
    expect(forgot).not.toMatch(/label="New password"/);
    expect(forgot).not.toMatch(/label="Confirm new password"/);
    expect(forgot).not.toMatch(/passwordProblem/);
  });

  it('sends only the login', () => {
    const callLine = forgot.match(/call\('auth\.requestReset',[^)]*\)/)[0];
    expect(callLine).toContain('login: l');
    expect(callLine).not.toContain('newPassword');
  });

  // Where the password comes from is what the person needs to act, so the screen keeps it. WHY they do not pick it
  // (nobody can set a password on an account by knowing its number) is the design's reasoning: the head's rule of
  // 18 Oct 2026 is that such explanations live in the contract, not on the screen. Decision 46 is the flow, and
  // the flow is still asserted above — no newPassword is sent.
  it('tells the person where the password comes from', () => {
    expect(forgot).toMatch(/temporary password/i);
    expect(forgot).toMatch(/coordinator/i);
  });
});

describe('decision 46: the mock matches the server contract', () => {
  it('a request needs no password, and an old app sending one is not refused', async () => {
    // an unknown field would be BAD_REQUEST in the real API; the field stays whitelisted for installed apps
    expect((await req('auth.requestReset', { login: '6000000001' })).ok).toBe(true);
    expect((await req('auth.requestReset', { login: '6000000001', newPassword: 'whatever 2026' })).ok).toBe(true);
  });

  it('the same answer whether or not the number has an account', async () => {
    const real = await req('auth.requestReset', { login: '6000000001' });
    const fake = await req('auth.requestReset', { login: '6000000190' });
    expect(real.data).toEqual({ status: 'RESET_REQUESTED' });
    expect(fake.data).toEqual(real.data);
  });

  it('nothing the requester sends is even KEPT, let alone used', async () => {
    /* Checked at the storage step, not just the outcome. An earlier version of this test only compared the
       returned password with the attacker's, which passed even when the request row still stored theirs —
       because approval overwrote it anyway. The point of the finding is that the value never gets kept at
       all, so that is what is asserted. */
    await req('auth.requestReset', { login: '6000000001', newPassword: 'Attacker picked 2026' });
    const t = await login('sps', 'sps-pass-12');
    const waiting = (await req('requests.list', {}, t)).data.resets.find((x) => x.login === '6000000001');
    expect(waiting).toBeTruthy();
    expect(JSON.stringify(waiting)).not.toContain('Attacker picked 2026');

    const r = await req('resets.approve', { login: '6000000001' }, t);
    expect(r.ok).toBe(true);
    expect(r.data.tempPassword).not.toBe('Attacker picked 2026');
    // and the attacker's choice does not work
    expect((await req('auth.login', { login: '6000000001', password: 'Attacker picked 2026' })).ok).toBe(false);
    expect((await req('auth.login', { login: '6000000001', password: r.data.tempPassword })).ok).toBe(true);
  });

  it('the mock source itself keeps no password on the request row', () => {
    // the mock feeds the browser checks and every screenshot, so it must mirror the server, not approximate it
    const requestHandler = src('../src/lib/mock.js').match(/A\['auth\.requestReset'\][\s\S]*?^}\];/m)[0];
    expect(requestHandler).not.toMatch(/newPassword/);
  });

  it('approval returns a readable password, once, and forces a change', async () => {
    await req('auth.requestReset', { login: '6000000001' });
    const t = await login('sps', 'sps-pass-12');
    const r = await req('resets.approve', { login: '6000000001' }, t);
    expect(r.data.tempPassword).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(r.data.tempPassword).not.toMatch(/[01lio5s8]/);     // nothing anyone mishears on a phone call
    expect(r.data.shownOnce).toBe(true);
    expect(r.data.expiresInHours).toBe(24);
    expect(r.data.name).toBeTruthy();
    const me = await req('auth.login', { login: '6000000001', password: r.data.tempPassword });
    expect(me.data.user.mustChangePassword).toBe(true);
  });

  it('approving again does not re-show it', async () => {
    await req('auth.requestReset', { login: '6000000001' });
    const t = await login('sps', 'sps-pass-12');
    const first = await req('resets.approve', { login: '6000000001' }, t);
    const again = await req('resets.approve', { login: '6000000001' }, t);
    expect(again.ok).toBe(false);
    expect(JSON.stringify(again)).not.toContain(first.data.tempPassword);
  });

  it('rejecting returns no password and changes nothing', async () => {
    await req('auth.requestReset', { login: '6000000001' });
    const t = await login('sps', 'sps-pass-12');
    const r = await req('resets.reject', { login: '6000000001' }, t);
    expect(r.ok).toBe(true);
    expect(r.data.tempPassword).toBeUndefined();
  });
});

describe('decision 46: the dialog cannot be closed by accident', () => {
  const tp = src('../src/coord/TempPassword.svelte');
  const sheet = src('../src/ui/Sheet.svelte');
  const requests = src('../src/coord/Requests.svelte');

  it('refuses all three accidental ways out', () => {
    // a stray tap, an Escape, or a ✕ would each cost the devotee a whole new request
    expect(tp).toMatch(/dismiss=\{false\}/);
    expect(tp).toMatch(/escapeCloses=\{false\}/);
    expect(tp).toMatch(/closeButton=\{false\}/);
  });

  it('offers exactly one deliberate way out', () => {
    expect(tp).toMatch(/I have shared it/);
  });

  it('Sheet actually honours escapeCloses, via the dialog cancel event', () => {
    // preventing `cancel` is the only way to refuse Escape on a native <dialog>
    expect(sheet).toMatch(/escapeCloses/);
    expect(sheet).toMatch(/oncancel=\{cancel\}/);
    expect(sheet).toMatch(/if \(!escapeCloses\) e\.preventDefault\(\)/);
  });

  it('is shown when an approval returns a password, and not otherwise', () => {
    expect(requests).toMatch(/res\?\.tempPassword/);
    expect(requests).toMatch(/tempDialog\?\.show\(\)/);
    expect(requests).toMatch(/<TempPassword/);
  });

  it('the WhatsApp link opens the coordinator\'s own app and is never sent by us', () => {
    expect(tp).toMatch(/wa\.me/);
    expect(tp).toMatch(/target="_blank"/);
    // nothing here posts the password anywhere
    expect(tp).not.toMatch(/call\(/);
  });

  it('says the password is shown only once, and what to do if it is lost', () => {
    expect(tp).toMatch(/shown only here, only now/i);
    expect(tp).toMatch(/forgot my password/i);
  });
});
