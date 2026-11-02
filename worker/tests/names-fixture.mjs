// One scenario shared by names-one-source.test.mjs and names-parity.test.mjs (Phase 24, 27 Oct 2026): a facilitator
// with a login, students of his in two batches (one with a closed, promoted-from membership in a past week), a waiting
// sign-up, a coordinator, posts to a batch and to "my students", a comment, and an open phase. Built through the API
// wherever the API can build it, so the rows have the shape the app itself writes. Test phones: 60000001xx only.
import { boot, FAC, CONTACT } from './harness.mjs';

export const PROFILE = { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000135' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };

export async function scenario() {
  const app = boot(), { DB, call, clock, addAccount } = app;
  clock.now = Date.parse('2026-10-14T10:00:00+05:30');
  await addAccount('master', 'MASTER', 'Master pass 2026', { name: 'Iyf Head' });
  const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
  await call('coordinators.create', { username: 'spsn', name: 'Sps Names', batchIds: ['SPS', 'DPS'], tempPassword: 'Temp-spsn-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spsn'");
  const C = (await call('auth.login', { login: 'spsn', password: 'Temp-spsn-2026' })).data.token;
  const signUp = (phone, name, batchId = 'SPS', facilitator = FAC) => call('auth.signUp', { phone, name, batchId, facilitator, ...CONTACT, password: 'Devotee pass 2026', profile: PROFILE });
  const join = async (phone, name, batchId = 'SPS', facilitator = FAC) => {
    await signUp(phone, name, batchId, facilitator);
    await call('requests.approve', { phone, link: { noIdYet: true } }, M);
    return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
  };
  const A = await join('6000000151', 'Arjun Das');
  const B = await join('6000000152', 'Bhima Das');
  await signUp('6000000154', 'Chandra Waiting');                           // a sign-up still waiting, for FAC
  await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
  const F = (await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' })).data.token;
  // Bhima was FAC's student in SPS through September (a closed membership) and was then promoted into DPS
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, to_week, facilitator, set_by, set_at, reason)
    VALUES ('6000000152', 'SPS', 'ACTIVE', '2026-09-07', '2026-09-28', '${FAC}', 'test', '2026-09-01', 'approved')`);
  DB.sql.exec("UPDATE memberships SET batch_id = 'DPS', reason = 'promoted from SPS' WHERE login = '6000000152' AND to_week = ''");
  await call('phases.open', { phaseId: 'kartik-n', name: 'Kartik N', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
  const post = (await call('announcements.create', { title: 'For my students', body: 'Japa at six.', audience: ['STUDENTS'] }, F)).data;
  const cpost = (await call('announcements.create', { title: 'SPS class', body: 'Hall B this week.', audience: ['SPS'] }, C)).data;
  await call('announcements.comment', { id: cpost.announcement.id, body: 'Hare Krishna' }, A);
  return { ...app, M, C, F, A, B, post: post.announcement, cpost: cpost.announcement };
}

/** The reads the names work touches, as each role sees them; replies only (no tokens, no server time). */
export async function readsOf(s) {
  const { call, M, C, F, A } = s;
  const out = {};
  const take = async (key, action, data, token) => { const r = await call(action, data, token); out[key] = r.ok ? r.data : { error: r.error.code }; };
  await take('meta', 'meta.get', {});
  await take('master.facilitators', 'facilitators.list', {}, M);
  await take('master.orphans', 'facilitators.orphans', {}, M);
  await take('master.facLogins', 'facLogins.list', {}, M);
  await take('master.requests', 'requests.list', {}, M);
  await take('master.devotees.SPS', 'devotees.list', { batchId: 'SPS' }, M);
  await take('master.devotees.SPS.past', 'devotees.list', { batchId: 'SPS', weekId: '2026-09-14' }, M);
  await take('master.devotees.DPS', 'devotees.list', { batchId: 'DPS' }, M);
  await take('master.devotee.A', 'devotees.get', { login: '6000000151' }, M);
  await take('master.wall', 'announcements.list', {}, M);
  await take('coord.wall', 'announcements.list', {}, C);
  await take('coord.comments', 'announcements.comments', { id: s.cpost.id }, C);
  await take('fac.me', 'auth.me', {}, F);
  await take('fac.devotees', 'fac.devotees', {}, F);
  await take('fac.devotees.past', 'fac.devotees', { weekId: '2026-09-14' }, F);
  await take('fac.devotee.A', 'fac.devotee', { login: '6000000151' }, F);
  await take('fac.eligible', 'fac.eligible', {}, F);
  await take('fac.card', 'card.get', { phaseId: 'kartik-n' }, F);
  await take('fac.wall', 'announcements.list', {}, F);
  await take('dev.me', 'auth.me', {}, A);
  await take('dev.home', 'home.get', {}, A);
  await take('dev.profile', 'profile.get', {}, A);
  await take('dev.wall', 'announcements.list', {}, A);
  await take('dev.shares', 'share.list', {}, A);
  return out;
}
