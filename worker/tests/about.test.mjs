// The user, 11 Oct 2026: at sign-up, profession and service SKILLS are OPTIONAL; "with IYF Delhi since" is REQUIRED and a YEAR
// only (it is in the IYF ID; someone new chooses this year). An older copy of the app that does not send the field at all is still taken (it cannot show
// the error). Columns: profession, skills and connected_since — all three from migration 0038. Skills are chosen from
// the fixed shared/skills.js list, never typed, so a coordinator can search them.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('sign-up: about the devotee (profession, skills, with IYF Delhi since)');
const { DB, call, rows, addAccount } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const base = { batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026' };
const address = { house: 'B-12', street: '', landmark: '', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' };
const profile = (extra) => ({ dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address, ...extra });
const thisYear = String(new Date(Date.now() + 5.5 * 3600e3).getUTCFullYear()), nextYear = String(+thisYear + 1);

let r = await call('auth.signUp', { ...base, phone: '6000000091', name: 'Arjun Das', profile: profile({ profession: '', skills: [], connectedSince: '' }) });
t.code(r, 'VALIDATION', 'the new form with no year is refused');
t.ok(JSON.stringify(r.error || {}).includes('profile.connectedSince'), 'the error points at "with IYF Delhi since"');
t.code(await call('auth.signUp', { ...base, phone: '6000000192', name: 'Bhima Das', profile: profile({ profession: '', skills: [], connectedSince: nextYear }) }), 'VALIDATION', 'a year still to come is refused');
t.code(await call('auth.signUp', { ...base, phone: '6000000193', name: 'Chandra Das', profile: profile({ profession: '', skills: [], connectedSince: '2023-04' }) }), 'VALIDATION', 'a month is not taken: a year only');
t.code(await call('auth.signUp', { ...base, phone: '6000000094', name: 'Deva Das', profile: profile({ profession: '', skills: [], connectedSince: thisYear }) }), 'ok', 'someone new chooses this year; profession and skills may stay empty');
t.code(await call('auth.signUp', { ...base, phone: '6000000195', name: 'Eka Das', profile: profile({ profession: 'Studying B.Tech', skills: ['Music / Kirtan', 'Cooking / Prasadam Service'], connectedSince: '2023' }) }), 'ok', 'all three answered');
t.eq(rows("SELECT profession, skills, connected_since FROM profiles WHERE login = '6000000195'")[0], { profession: 'Studying B.Tech', skills: '["Music / Kirtan","Cooking / Prasadam Service"]', connected_since: '2023' }, 'kept as given, skills as a JSON array');
// chosen from the list, never typed: a coordinator must be able to search them
t.code(await call('auth.signUp', { ...base, phone: '6000000097', name: 'Hari Das', profile: profile({ profession: '', skills: ['Cricket and chess'], connectedSince: '2023' }) }), 'VALIDATION', 'a skill not on the list is refused');
t.code(await call('auth.signUp', { ...base, phone: '6000000098', name: 'Ira Devi', profile: profile({ profession: '', skills: 'Music / Kirtan', connectedSince: '2023' }) }), 'VALIDATION', 'and it must be a list, not a typed string');
t.code(await call('auth.signUp', { ...base, phone: '6000000196', name: 'Gauri Devi', profile: profile({}) }), 'ok', 'an older copy of the app (no such field sent) is still taken');
t.eq(rows("SELECT connected_since FROM profiles WHERE login = '6000000196'")[0], { connected_since: '' }, '…with the year left blank');

// the profile afterwards: profession and skills editable; "connected since" read-only (the year is in the IYF ID —
// a change is a coordinator's)
await call('requests.approve', { phone: '6000000195', link: { noIdYet: true } }, M);
const D = (await call('auth.login', { login: '6000000195', password: 'Devotee pass 2026' })).data.token;
t.eq((await call('profile.get', {}, D)).data.connectedSince, '2023', 'the profile shows the year given at sign-up');
t.code(await call('profile.update', { profession: 'Software engineer', skills: [] }, D), 'ok', 'profession changed, skills cleared');
t.ok((await call('profile.update', { connectedSince: '2021' }, D)).ok !== true, 'the devotee cannot change "connected since"');
t.eq(rows("SELECT profession, skills, connected_since FROM profiles WHERE login = '6000000195'")[0], { profession: 'Software engineer', skills: '[]', connected_since: '2023' }, 'stored as changed; the year untouched');

// A bad value in profiles.skills must never take a profile page down (prompt-34, 11 Oct 2026): the column could be
// hand-edited in the Sheets copy, or written by a future import. Read it defensively, keep only what is on the list.
DB.sql.exec("UPDATE profiles SET skills = 'not json at all' WHERE login = '6000000195'");
r = await call('profile.get', {}, D);
t.code(r, 'ok', 'a profile whose skills column is not JSON still opens');
t.eq(r.data.skills, [], '…with no skills rather than an error');
DB.sql.exec(`UPDATE profiles SET skills = '["Music / Kirtan","Juggling","Teaching / Education"]' WHERE login = '6000000195'`);
r = await call('profile.get', {}, D);
t.eq(r.data.skills, ['Music / Kirtan', 'Teaching / Education'], 'a value no longer on the list is dropped, the rest kept');

t.done();
