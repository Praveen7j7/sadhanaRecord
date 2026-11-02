// Sign-up validation must actually RUN. Found 14 Oct 2026 while chasing eight browser-check failures that
// looked like wrong wording.
//
// THE BUG. validate.js had `export { validName as isName } from '$shared/names.js'` — a bare re-export,
// which does NOT create a local binding. So `isName` was undefined inside the module and signUpErrors()
// threw a ReferenceError on its SECOND line, every call. Sign-up therefore showed no validation at all:
// no "Choose Yes or No", no email-typo error, nothing blocking a step. The eight browser assertions were
// right and the app was broken.
//
// Nothing caught it because every client test that touched sign-up went through the mock's own checks, and
// the browser checks that did exercise the screen had been crashing earlier in the run for days.
//
// These call signUpErrors directly, so a ReferenceError inside it fails a test instead of disappearing into
// a Svelte event handler.
import { describe, it, expect } from 'vitest';
import { signUpErrors, isName, isPhone, passwordProblem } from '../src/lib/validate.js';

/** A complete, valid step-1..4 form; each test spoils one field. */
const form = () => ({
  phone: '6000000055', name: 'Madhav Sharma', email: 'madhav@gmail.com', waSame: true, whatsapp: '',
  dob: '2001-05-05', bloodGroup: 'O+', batchId: 'SPS', classDay: 'SUN', facilitator: 'Vilasa Padmanabha Prabhuji',
  password: 'My sadhana 2026', confirm: 'My sadhana 2026', privacy: true,
  emName: 'Suresh Sharma', emRelation: 'Father', emPhone: '6000000189',
  addr: { line: 'House 12, Gali No 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' },
  profession: '', skills: [], connectedSince: '2024'
});

describe('signUpErrors runs at all', () => {
  it('does not throw — the re-export bug made every call a ReferenceError', () => {
    expect(() => signUpErrors(form())).not.toThrow();
  });

  it('isName is usable inside the module AND re-exported for its callers', () => {
    expect(typeof isName).toBe('function');
    expect(isName('Madhav Sharma')).toBe(true);
    expect(isName('M')).toBe(false);
  });

  it('a complete form has nothing to complain about', () => {
    expect(signUpErrors(form())).toEqual({});
  });
});

describe('the messages the screen shows', () => {
  it('an unanswered "is this number on WhatsApp?" says Choose Yes or No', () => {
    expect(signUpErrors({ ...form(), waSame: null }).waSame).toBe('Choose Yes or No');
  });

  it('a likely email typo names the address it means', () => {
    expect(signUpErrors({ ...form(), email: 'madhav@gmial.com' }).email).toBe('Did you mean madhav@gmail.com?');
  });

  it('a short name is refused by the shared rule, not a local copy', () => {
    expect(signUpErrors({ ...form(), name: 'M' }).name).toMatch(/2 to 60/);
  });

  it('under 15 is refused with the age reason', () => {
    const e = signUpErrors({ ...form(), dob: '2014-05-05' });
    expect(Object.values(e).join(' ')).toMatch(/15/);
  });

  it('a missing class day is required', () => {
    expect(signUpErrors({ ...form(), classDay: '' }).classDay).toBeTruthy();
  });

  it('"with IYF Delhi since" is required', () => {
    expect(signUpErrors({ ...form(), connectedSince: '' })['profile.connectedSince']).toBeTruthy();
  });

  it('every message is a sentence, never an object or undefined leaking to the screen', () => {
    const e = signUpErrors({ phone: '', name: '', email: '', waSame: null, whatsapp: '', dob: '', bloodGroup: '',
      batchId: '', classDay: '', facilitator: '', password: '', confirm: '', privacy: false,
      emName: '', emRelation: '', emPhone: '', addr: {}, profession: '', skills: [], connectedSince: '' });
    expect(Object.keys(e).length).toBeGreaterThan(5);
    for (const [k, v] of Object.entries(e)) {
      expect(typeof v, `${k} is not a string`).toBe('string');
      expect(v.length, `${k} is empty`).toBeGreaterThan(0);
    }
  });
});

describe('the helpers it shares', () => {
  it('isPhone takes the 10-digit Indian form only', () => {
    expect(isPhone('6000000055')).toBe(true);
    expect(isPhone('5000000055')).toBe(false);
    expect(isPhone('600000005')).toBe(false);
  });
  it('passwordProblem does not throw on an empty password', () => {
    expect(() => passwordProblem('', '6000000055')).not.toThrow();
    expect(passwordProblem('', '6000000055')).toMatch(/8/);
  });
});
