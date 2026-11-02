// Birthdays on Home in the mock (the server is worker/tests/birthdays-home.test.mjs): the batch's birthdays today, by name
// only; self for the reader's own; not another batch, not inactive or disabled; 29 Feb kept on 1 March of a common year.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency, setNow, _patchUser } from '../src/lib/mock.js';
import { birthdayLines } from '../src/lib/birthdays.js';

beforeEach(() => { reset(); setLatency(0); setNow('2026-10-27T10:00:00+05:30'); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const sunil = () => login('6000000001', 'pass-12345');
const dobOf = (dob) => ({ profile: { dob, bloodGroup: 'O+', emergency: { name: 'X', relation: 'Father', phone: '6000000077' } } });

describe('mock: birthdays on Home', () => {
  it("a batch-mate's birthday by name only (Bhavesh Jain is seeded on today)", async () => {
    const h = (await req('home.get', {}, await sunil())).data;
    expect(h.birthdays).toEqual([{ name: 'Bhavesh Jain', self: false }]);
    expect(JSON.stringify(h.birthdays)).not.toMatch(/\d{10}|\d{4}-\d\d-\d\d/);
  });
  it('self, and not another batch, an inactive or a disabled person', async () => {
    _patchUser('6000000001', dobOf('2002-10-27'));
    _patchUser('6000000020', dobOf('2001-10-27'));       // Lalit Chauhan: inactive
    _patchUser('6000000021', dobOf('2001-10-27'));       // Manish Tiwari: disabled
    const h = (await req('home.get', {}, await sunil())).data;
    expect(h.birthdays).toEqual([{ name: 'Bhavesh Jain', self: false }, { name: 'Sunil Kumar', self: true }]);
    const raman = await login('6000000092', 'trd-pass-12');           // Temple Residents
    expect((await req('home.get', {}, raman)).data.birthdays).toEqual([]);
  });
  it('29 February: on 1 March of a year without one, not of a leap year', async () => {
    _patchUser('6000000011', dobOf('2004-02-29'));
    setNow('2027-03-01T10:00:00+05:30');
    expect((await req('home.get', {}, await sunil())).data.birthdays.map((b) => b.name)).toContain('Aarav Gupta');
    setNow('2028-03-01T10:00:00+05:30');
    expect((await req('home.get', {}, await sunil())).data.birthdays.map((b) => b.name)).not.toContain('Aarav Gupta');
  });
});

describe('the birthday line', () => {
  it('says it plainly, for one, several and many; their own first', () => {
    expect(birthdayLines([])).toEqual({ mine: '', others: '' });
    expect(birthdayLines([{ name: 'Sunil Kumar', self: false }]).others).toBe("Today is Sunil Kumar's birthday");
    expect(birthdayLines([{ name: 'A' }, { name: 'B' }]).others).toBe('Today is the birthday of A and B');
    expect(birthdayLines([{ name: 'A' }, { name: 'B' }, { name: 'C' }]).others).toBe('Today is the birthday of A, B and C');
    expect(birthdayLines([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]).others).toBe('Today is the birthday of A, B and 2 more');
    expect(birthdayLines([{ name: 'Sunil Kumar', self: true }], 'Sunil')).toEqual({ mine: 'Happy birthday, Sunil!', others: '' });
    expect(birthdayLines([{ name: 'Sunil Kumar', self: true }, { name: 'A' }], 'Sunil')).toEqual({ mine: 'Happy birthday, Sunil!', others: "Today is A's birthday" });
  });
});
