// Birthdays on Home (the head, 27 Oct 2026; migration 0073, weeks.js homeGet): the devotee's whole batch sees today's
// birthdays by NAME only — no login, no date, no age; the caller's own is `self`. Another batch's, an inactive or a
// disabled person's are not shown. 29 February is kept on 1 March in a year without one. The coordinator's and the
// head's Birthdays card (birthdays.today, with age and the next 7 days) is unchanged.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('birthdays on Home: the batch by name, nothing else');
const { DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-20T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const PROFILE = { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, name, dob, batchId = 'SPS2') => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: PROFILE });
  const r = await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  if (!r.ok) throw new Error(`approve ${phone}: ${JSON.stringify(r.error)}`);
  DB.sql.prepare('UPDATE profiles SET dob = ? WHERE login = ?').run(dob, phone);
};
const tok = async (p) => (await call('auth.login', { login: p, password: 'Devotee pass 2026' })).data.token;
const tokSps = async () => (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
await join('6000000171', 'Sunil Kumar', '2001-10-27');        // the caller: today is his birthday too
await join('6000000172', 'Arjun Das', '2000-10-27');          // a batch-mate born today
await join('6000000173', 'Bhima Das', '2002-10-28');          // tomorrow: not on Home
await join('6000000174', 'Other Batch', '1999-10-27', 'BSS'); // another batch
await join('6000000175', 'Gone Quiet', '1998-10-27');         // made inactive below
await join('6000000176', 'Switched Off', '1997-10-27');       // disabled below
await join('6000000177', 'Leap Day', '2004-02-29');
await join('6000000178', 'No Date', '');                      // no birthday known
t.code(await call('devotees.setActive', { login: '6000000175', active: false }, M), 'ok', 'one is made inactive');
t.code(await call('devotees.setDisabled', { login: '6000000176', disabled: true }, M), 'ok', 'one is disabled');

// ---- 27 October
at('2026-10-27T08:00:00');
const home = async (p) => (await call('home.get', {}, await tok(p))).data;
let h = await home('6000000172');
t.eq(h.birthdays, [{ name: 'Arjun Das', self: true }, { name: 'Sunil Kumar', self: false }], "a batch-mate's birthday by name; their own is self");
t.eq(h.birthdays.flatMap((b) => Object.keys(b)).filter((k) => k !== 'name' && k !== 'self'), [], 'name and self only: no login, no date, no age');
t.ok(!/\d{10}|\b(19|20)\d\d-\d\d-\d\d\b/.test(JSON.stringify(h.birthdays)), '… no phone number and no date of birth anywhere in it');
t.ok(!h.birthdays.some((b) => ['Other Batch', 'Gone Quiet', 'Switched Off', 'Bhima Das'].includes(b.name)), 'not another batch, not inactive, not disabled, not tomorrow');
t.eq((await home('6000000173')).birthdays.map((b) => [b.name, b.self]), [['Arjun Das', false], ['Sunil Kumar', false]], 'the whole batch sees it');
t.eq((await home('6000000174')).birthdays, [{ name: 'Other Batch', self: true }], "the other batch sees only its own");

// ---- the coordinator's and the head's card: unchanged (age, the next 7 days)
const card = (await call('birthdays.today', {}, await tokSps())).data;
t.eq(card.today.map((x) => [x.name, x.age]).sort(), [['Arjun Das', 26], ['Sunil Kumar', 25]], "the coordinator's Birthdays card still has today's, with age");
t.eq(card.upcoming.map((x) => x.name), ['Bhima Das'], '… and the days ahead');
t.ok((await call('birthdays.today', {}, M)).data.today.some((x) => x.name === 'Other Batch'), "the head's card still covers every batch");

// ---- 29 February: on 1 March in a year without one; on the day itself in a year with one
at('2027-03-01T08:00:00');
t.eq((await home('6000000171')).birthdays.map((b) => b.name), ['Leap Day'], '1 March 2027 (no 29 Feb): the leap-day birthday shows');
at('2028-03-01T08:00:00');
t.eq((await home('6000000171')).birthdays, [], '1 March 2028 (a leap year): not shown');
at('2028-02-29T08:00:00');
t.eq((await home('6000000171')).birthdays.map((b) => b.name), ['Leap Day'], '29 February 2028: shown on the day');
at('2028-05-05T08:00:00');
t.eq((await home('6000000171')).birthdays, [], 'a day with nobody: an empty list');

t.done();
