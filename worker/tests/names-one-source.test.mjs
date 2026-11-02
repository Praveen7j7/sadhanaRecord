// One name, one place (Phase 24; docs/NAMES_ONE_SOURCE_2026-10-27.md). A facilitator's name is stored once, on their
// row; everything else points to the row by its permanent id and reads the name from it. Each block below was written
// against the code of 27 Oct 2026 and failed there (the four misses of the doc, and renamePerson); history — the audit
// log, closed records — keeps the name as it was.
import { suite, FAC } from './harness.mjs';
import { scenario, PROFILE } from './names-fixture.mjs';
import { CONTACT } from './harness.mjs';

const t = suite('names: one name, one place');
const NEW = 'HG Natvar Gopinath Das';
const s = await scenario(), { DB, call, M, C, F, A, B } = s;
// a column this change adds does not exist on the code before it: that is a failure of the check, not of the run
const rows = (sql, ...a) => { try { return s.rows(sql, ...a); } catch (e) { console.log('  (sql: ' + e.message + ')'); return [{}]; } };
const stages = async (tok) => (await call('card.get', { phaseId: 'kartik-n' }, tok)).data.score.stages.find(x => x.stage === 'DPS');

// before: the facilitator sees his students, the post reaches them, the card counts Bhima's promotion
t.eq((await stages(F)).promoted, 1, 'before: Bhima’s promotion (SPS → DPS) is on his card');
t.ok((await call('announcements.list', {}, A)).data.announcements.some(a => a.title === 'For my students'), 'before: his post reaches Arjun');

const v0 = (await call('auth.me', {}, A)).data.versions.names;
const r = await call('facilitators.rename', { name: FAC, newName: NEW, reason: 'initiated' }, M);
t.code(r, 'ok', 'the head renames the facilitator');
/* ── the phone: the start-up reply says the lists changed, so the wheel is fetched again (once) ── */
{
  const v1 = (await call('auth.me', {}, A)).data.versions.names, h1 = (await call('home.get', {}, A)).data.versions.names;
  t.ok(v0 && v1 !== v0, `the names version on auth.me moved with the rename (${v0} → ${v1})`);
  t.eq(h1, v1, 'home.get carries the same version');
  const meta = (await call('meta.get', {})).data;
  t.eq(meta.version, v1, 'and meta.get says which version its lists are');
  t.ok(meta.facilitators.includes(NEW) && !meta.facilitators.includes(FAC), 'the wheel offers the new name, not the old one');
}

/* ── miss 1: posts to "my students" ── */
{
  const wall = (await call('announcements.list', {}, A)).data.announcements;
  t.ok(wall.some(a => a.title === 'For my students'), 'miss 1: his EARLIER post still reaches his students after the rename');
  t.eq(wall.find(a => a.title === 'For my students')?.author, NEW, 'and it shows his name as it is now');
  const mine = (await call('announcements.list', {}, F)).data.announcements.find(a => a.title === 'For my students');
  t.eq(mine?.audience, ['STU:' + NEW], 'his own view says the post is to his students, under the name he has now');
  const job = rows("SELECT audience FROM push_jobs ORDER BY id")[0].audience;
  const reach = rows(`SELECT COUNT(*) AS n FROM memberships m WHERE m.to_week = '' AND m.state = 'ACTIVE' AND 'STU:' || m.fac_id = ?`, job)[0].n;
  t.eq(reach, 2, 'and its notification job is addressed by his id, so it still finds his two students');
  t.code(await call('announcements.create', { title: 'After the rename', body: 'Still mine.', audience: ['STUDENTS'] }, F), 'ok', 'he posts again under his new name');
  t.ok((await call('announcements.list', {}, A)).data.announcements.some(a => a.title === 'After the rename'), 'and that reaches them too');
}

/* ── miss 2: the promotion count on the phase card, through a CLOSED membership ── */
t.eq((await stages(F)).promoted, 1, 'miss 2: Bhima’s promotion still counts on the renamed facilitator’s card');

/* ── miss 3: past weeks on the board and in the facilitator's own list ── */
{
  const past = (await call('fac.devotees', { weekId: '2026-09-14' }, F)).data;
  t.eq(past.rows.map(x => x.name), ['Bhima Das'], 'miss 3: a past week still lists his former student under him');
  t.eq(past.facilitator, NEW, 'under the name he has now');
  const board = (await call('devotees.list', { batchId: 'SPS', weekId: '2026-09-14' }, M)).data.rows;
  t.eq(board.find(x => x.name === 'Bhima Das')?.facilitator, NEW, 'and the batch board of that week shows the current name');
  t.eq((await call('fac.devotee', { login: '6000000151' }, F)).code ?? 'ok', 'ok', 'his current student opens for him');
  const now = (await call('devotees.list', { batchId: 'SPS' }, M)).data.rows;
  t.eq(now.find(x => x.name === 'Arjun Das')?.facilitator, NEW, 'this week too');
  t.eq((await call('profile.get', {}, A)).data.facilitator, NEW, 'and Arjun’s own profile names him as he is now');
  t.eq((await call('requests.list', {}, M)).data.signUps.find(x => x.name === 'Chandra Waiting')?.facilitator, NEW, 'and the waiting sign-up');
  t.eq((await call('facLogins.list', {}, M)).data.logins[0].name, NEW, 'his own login is the same name (one record)');
  t.eq((await call('auth.me', {}, F)).data.user.name, NEW, 'and greets him by it');
}

/* ── history keeps the name as it was ── */
t.eq(rows("SELECT before FROM audit_log WHERE action = 'facilitators.rename'").map(x => JSON.parse(x.before).name), [FAC], 'the audit log keeps the old name');
t.eq(rows("SELECT facilitator FROM memberships WHERE login = '6000000152' AND to_week <> ''")[0].facilitator, FAC, 'and so does the closed membership');

/* ── old spellings still resolve ── */
t.eq(rows(`SELECT n.fac_id = f.id AS same FROM facilitator_names n JOIN facilitators f ON f."name" = ? WHERE n."name" = ?`, NEW, FAC)[0]?.same, 1,
  'the old spelling still resolves to the same facilitator');
t.ok(!/NameMap|dashboard/i.test(JSON.stringify(r.data)), 'the reply no longer sends the head to the dashboard (the app is its own source)');

/* ── miss 4: a linked devotee or trainee is one person with one name ── */
{
  await call('batches.create', { batchId: 'ETP-77', name: 'ETP Batch 77', level: 'ETP', startedOn: '2026-10-12', endsOn: '2027-06-30' }, M);
  await call('auth.signUp', { phone: '6000000161', name: 'Mohan Lal', batchId: 'SPS', facilitator: NEW, ...CONTACT, password: 'Devotee pass 2026', profile: PROFILE });
  await call('requests.approve', { phone: '6000000161', link: { noIdYet: true } }, M);
  const T = (await call('auth.login', { login: '6000000161', password: 'Devotee pass 2026' })).data.token;
  t.code(await call('enrol.add', { batchId: 'ETP-77', login: '6000000161' }, M), 'ok', 'Mohan Lal is enrolled in ETP and facilitates under his own name');
  t.code(await call('facilitators.rename', { name: 'Mohan Lal', newName: 'Mohan Lal Das' }, M), 'ok', 'the head renames the trainee on the facilitator list');
  t.eq((await call('auth.me', {}, T)).data.user.name, 'Mohan Lal Das', 'miss 4: his own account takes the new name (one person, one name)');
  t.code(await call('profile.update', { name: 'Mohan Gopal Das' }, T), 'ok', 'he renames himself');
  const list = (await call('meta.get', {})).data.facilitators;
  t.ok(list.includes('Mohan Gopal Das') && !list.includes('Mohan Lal Das'), 'and the facilitator list follows his own rename');
  t.eq((await call('auth.me', {}, T)).data.user.scopes.facilitator?.name, 'Mohan Gopal Das', 'so does his facilitator scope');
}

/* ── renamePerson: the account, the profile, the identity record, the wall ── */
{
  // Arjun's person record, as approval made it (identity tables)
  const pid = s.rows("SELECT person_id FROM person_links WHERE service = 'sadhana' AND account_ref = '6000000151'")[0]?.person_id;
  t.ok(!!pid, 'approval gave Arjun a person record');
  t.eq(s.rows('SELECT display_name FROM persons WHERE id = ?', pid)[0]?.display_name, 'Arjun Das', 'named as he signed up');
  t.code(await call('profile.update', { name: 'Arjuna Krishna Das' }, A), 'ok', 'Arjun renames himself');
  t.eq(rows("SELECT name FROM accounts WHERE login = '6000000151'")[0].name, 'Arjuna Krishna Das', 'the account');
  t.eq(rows("SELECT name FROM profiles WHERE login = '6000000151'")[0].name, 'Arjuna Krishna Das', 'the profile');
  t.eq(rows('SELECT display_name FROM persons WHERE id = ?', pid)[0].display_name, 'Arjuna Krishna Das', 'renamePerson: the identity record’s name');
  t.eq(rows('SELECT name FROM person_names WHERE person_id = ? AND is_current = 1', pid).map(x => x.name), ['Arjuna Krishna Das'], 'the new name is the current one');
  t.ok(rows('SELECT name FROM person_names WHERE person_id = ?', pid).some(x => x.name === 'Arjun Das'), 'the old one kept beside it (names are history)');
  t.eq((await call('auth.lookup', { phone: '6000000151' })).data?.hasAccount, true, 'sign-up lookup still knows the number (and discloses no name for an account)');
  const c = (await call('announcements.comments', { id: s.cpost.id }, C)).data.comments;
  t.eq(c[0].name, 'Arjuna Krishna Das', 'his comment on the wall shows the name he has now');
  // a coordinator renamed by the head: their posts follow
  t.code(await call('coordinators.update', { username: 'spsn', name: 'Sps Team Delhi' }, M), 'ok', 'the head renames the coordinator');
  t.eq((await call('announcements.list', {}, A)).data.announcements.find(a => a.title === 'SPS class')?.author, 'Sps Team Delhi', 'renamePerson: their earlier post shows the new name');
  t.eq(rows("SELECT author_name FROM announcements WHERE title = 'SPS class'")[0].author_name, 'Sps Names', 'while the post keeps the name it was written under');
}

t.done();
