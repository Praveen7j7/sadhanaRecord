// The 9 PM reminder (Web Push) and the master's oversight and settings.
import { webcrypto as wc } from 'node:crypto';
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { runReminders, due, PER_RUN, deadlineWindow } from '../src/push.js';

const t = suite('phase 4: 9 PM reminder, oversight, settings');
const { env, DB, call, clock, rows, addAccount } = boot();
const k = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await wc.subtle.exportKey('jwk', k.privateKey);
env.VAPID_PRIVATE_JWK = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
env.VAPID_PUBLIC = Buffer.from(await wc.subtle.exportKey('raw', k.publicKey)).toString('base64url');
env.VAPID_SUBJECT = 'mailto:test@example.org';
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-06T09:00:00');                                                  // a Tuesday

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000051', 'Arjun Das'), B = await join('6000000152', 'Bhima Das');
const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`, keys: { p256dh: 'B' + 'x'.repeat(86), auth: 'a'.repeat(22) } });

// ---- turning it on and off
let r = await call('meta.get', {});
t.eq([r.data.push.publicKey, r.data.push.time], [env.VAPID_PUBLIC, '21:00'], 'the app gets the public key and the time');
t.eq((await call('push.subscribe', sub(1), A)).data, { on: true, time: '21:00' }, 'a devotee turns the reminder on');
await call('push.subscribe', sub(2), B);
t.code(await call('push.subscribe', { ...sub(3), endpoint: 'https://evil.example.com/x' }, A), 'VALIDATION', 'only a real browser push address');
t.code(await call('push.subscribe', sub(4), C), 'ok', 'staff phones get notifications too (announcements)');
t.code(await call('push.register', sub(5)), 'ok', 'a phone with nobody signed in registers itself');
t.code(await call('push.register', { ...sub(6), endpoint: 'https://evil.example.com/y' }), 'VALIDATION', 'only real push addresses, signed in or not');
for (const [ep, want] of [['https://storage.googleapis.com/x/y', 'VALIDATION'], ['https://evil.mozilla.com/x', 'VALIDATION'], ['https://updates.push.services.mozilla.com/wpush/v2/abc', 'ok'], ['https://web.push.apple.com/QAbc', 'ok']])
  t.code(await call('push.register', { ...sub(7), endpoint: ep }), want, `push service host check: ${new URL(ep).host} → ${want}`);
DB.sql.exec("DELETE FROM push_subs WHERE endpoint LIKE 'https://updates.push.services.mozilla.com/%' OR endpoint LIKE 'https://web.push.apple.com/%'");
t.eq(rows('SELECT login FROM push_subs ORDER BY login').map(x => x.login), ['', '6000000051', '6000000152', 'sps'], 'one row per phone; the signed-out one has no login');

// ---- who is due
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-06', version: 0, day }, A);      // Arjun filled today; Bhima did not
t.eq([due({ draft_day: JSON.stringify(day), submitted: 0 }, 1), due({ draft_day: null, submitted: 0 }, 1), due({ draft_day: null, submitted: 0 }, 6), due({ submitted: 1 }, 6)],
  [false, true, true, false], 'due: today not complete; Sunday: week not submitted');

// ---- the run
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  if (String(url).startsWith('https://fcm.googleapis.com/')) { sent.push({ url: String(url), opt }); return { ok: true, status: String(url).endsWith('gone') ? 410 : 201, json: async () => ({}) }; }
  return realFetch(url, opt);
};
at('2026-10-06T20:59:00');
t.eq(await runReminders(env, DB, new Date(clock.now)), '', 'nothing before 9 PM');
at('2026-10-06T21:01:00');
const tc = () => DB.sql.prepare('SELECT total_changes() AS n').get().n;
let c0 = tc();
t.eq(await runReminders(env, DB, new Date(clock.now)), '2026-10-06 phones 1–end: 3 sent, 0 gone, 0 failed (done)', 'at 9 PM, every day: both devotees (filled or not) and the signed-out phone');
t.ok(tc() - c0 <= 2, `a successful reminder writes nothing per phone (only the run's progress marker): ${tc() - c0} rows`);
t.eq(sent.map(s => s.url).sort(), ['https://fcm.googleapis.com/fcm/send/device-1', 'https://fcm.googleapis.com/fcm/send/device-2', 'https://fcm.googleapis.com/fcm/send/device-5'], 'Arjun (filled), Bhima and the signed-out phone; not the staff-only phone');
t.eq((await call('push.message', { endpoint: sub(1).endpoint })).data.body, 'Today is filled ✓. Tap to review it before you rest.', 'a filled day: the "filled ✓" words');
t.eq((await call('push.message', { endpoint: sub(2).endpoint })).data.body, "Today isn't filled yet. It takes a minute — tap to fill it.", 'the phone asks what to show: the devotee reminder');
t.ok(/Tap to open the app/.test((await call('push.message', { endpoint: sub(5).endpoint })).data.body), 'the signed-out phone gets the general reminder');
const h = sent[0].opt.headers;
t.ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(h.Authorization) && h['Content-Length'] === '0' && h.TTL === '10800' && h.Urgency === 'high', 'an empty, high-priority push with a signed VAPID token');
{
  const [hd, pl, sig] = h.Authorization.slice(8).split(', k=')[0].split('.');
  const pub = await wc.subtle.importKey('raw', Buffer.from(env.VAPID_PUBLIC, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const okSig = await wc.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(sig, 'base64url'), new TextEncoder().encode(hd + '.' + pl));
  const claims = JSON.parse(Buffer.from(pl, 'base64url').toString());
  t.ok(okSig && claims.aud === 'https://fcm.googleapis.com' && claims.sub === 'mailto:test@example.org', 'the token verifies with the public key, for that push service');
}
at('2026-10-06T21:02:00');
t.eq(await runReminders(env, DB, new Date(clock.now)), '', 'once a day: the next minute sends nothing');

// a device that is gone is removed; many devices go out PER_RUN at a time
for (let i = 0; i < PER_RUN + 5; i++) DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES ('https://fcm.googleapis.com/fcm/send/many-${i}${i === 3 ? '-gone' : ''}', '6000000152', 'x', 'y', '')`);
sent.length = 0;
at('2026-10-07T21:01:00');
const r1 = await runReminders(env, DB, new Date(clock.now));
at('2026-10-07T21:02:00');
const r2 = await runReminders(env, DB, new Date(clock.now));
t.ok(r1.endsWith('(continues)') && r2.endsWith('(done)') && sent.length === 3 + PER_RUN + 5, `next day: both devotees are due again, sent in pieces of ${PER_RUN} (${r1} · ${r2})`);
t.eq(rows("SELECT COUNT(*) AS n FROM push_subs WHERE endpoint LIKE '%gone'")[0].n, 0, 'a device the push service no longer knows is removed');
{ // a phone that keeps failing is removed after 7 failures in a row, by its own key
  const bad = 'https://fcm.googleapis.com/fcm/send/flaky-500';
  DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at, fails) VALUES ('${bad}', '', 'x', 'y', '', 6)`);
  const f0 = globalThis.fetch;
  globalThis.fetch = async (url, opt) => (String(url) === bad ? { ok: false, status: 500, json: async () => ({}) } : f0(url, opt));
  at('2026-10-08T21:01:00'); await runReminders(env, DB, new Date(clock.now)); at('2026-10-08T21:02:00'); await runReminders(env, DB, new Date(clock.now));
  globalThis.fetch = f0;
  t.eq(rows(`SELECT COUNT(*) AS n FROM push_subs WHERE endpoint = '${bad}'`)[0].n, 0, 'the 7th failure in a row removes the phone');
}
// an announcement to everyone reaches every phone; one to a batch only that batch's signed-in members
sent.length = 0;
await call('announcements.create', { title: 'Janmashtami festival', body: 'Join us at the temple.', audience: 'ALL' }, M);
t.eq(rows("SELECT ann_id > 0 AS linked, audience, state FROM push_jobs")[0], { linked: 1, audience: 'ALL', state: 'OPEN' }, 'a new announcement is queued for notifications');
const { runAnnouncementPushes } = await import('../src/push.js');
for (let i = 0; i < 3; i++) await runAnnouncementPushes(env, DB, new Date(clock.now));
t.eq(sent.length, rows('SELECT COUNT(*) AS n FROM push_subs')[0].n, 'everyone: every phone, signed in or not');
{ const m = (await call('push.message', { endpoint: sub(5).endpoint })).data;
  t.eq([m.title, m.body, m.url, /^ann-\d+$/.test(m.tag)], ['New from IYF Delhi', 'Janmashtami festival', '/#/wall', true], 'the phone shows the title and opens the wall'); }
// Phase 9 (9 Oct 2026): the words are given once — another push to this phone in the same half hour never repeats it
t.ok(/Tap to open the app/.test((await call('push.message', { endpoint: sub(5).endpoint })).data.body), 'asked again (another push in the half hour): not the announcement again');
t.eq(rows(`SELECT pending FROM push_subs WHERE endpoint = '${sub(5).endpoint}'`)[0].pending, '', 'its words were cleared once served');
at('2026-10-09T09:00:00');
t.ok(/Tap to open the app/.test((await call('push.message', { endpoint: sub(5).endpoint })).data.body), 'hours later: the reminder words');
globalThis.fetch = realFetch;
t.code(await call('push.detach', { endpoint: sub(1).endpoint }, A), 'ok', 'logging out keeps the phone, without the person');
t.eq(rows(`SELECT login FROM push_subs WHERE endpoint = '${sub(1).endpoint}'`)[0].login, '', 'detached');
{ const u = await call('push.unsubscribe', { endpoint: sub(1).endpoint }); t.eq(u.data || u.error, { on: false }, 'switched off on the phone'); }
t.eq(rows(`SELECT COUNT(*) AS n FROM push_subs WHERE endpoint = '${sub(1).endpoint}'`)[0].n, 0, 'and forgotten');

// ---- master oversight
r = await call('stats.all', {}, M);
t.ok(r.data.batches.some(b => b.batchId === 'SPS2' && b.people.active === 2) && r.data.totals.active >= 2, 'stats for every batch, with totals');
t.code(await call('stats.all', {}, C), 'FORBIDDEN', 'master only');
r = await call('audit.list', { what: 'requests.approve', limit: 1 }, M);
t.ok(r.data.rows.length === 1 && r.data.rows[0].action === 'requests.approve' && r.data.more === true, 'the activity log, filtered, newest first, paged');
{ const x = r.data.rows[0]; t.ok(x.targetName === 'Bhima Das' && typeof x.whoName === 'string', `the activity log names the people (${x.whoName || x.who} → ${x.targetName})`); }
t.ok(Array.isArray((await call('runlog.list', {}, M)).data.rows), 'slow and failed calls');

// ---- several evening runs side by side (index.js: the minutely run + two evening schedules): each claims its own chunk
{
  DB.sql.exec('DELETE FROM push_subs');
  for (let i = 0; i < 300; i++) DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES ('https://fcm.googleapis.com/fcm/send/shard-${i}', '', 'x', 'y', '')`);
  const shardSent = [], f1 = globalThis.fetch;
  globalThis.fetch = async (url, opt) => { if (String(url).includes('/shard-')) { shardSent.push(String(url)); return { ok: true, status: 201, json: async () => ({}) }; } return f1(url, opt); };
  const reports = [];
  for (let m = 1; m <= 4; m++) { at(`2026-10-09T21:0${m}:00`); reports.push(...await Promise.all([0, 1, 2].map(() => runReminders(env, DB, new Date(clock.now))))); }
  t.eq([shardSent.length, new Set(shardSent).size], [300, 300], `three runs a minute, side by side, reach all 300 phones exactly once (${PER_RUN * 3} a minute)`);
  t.ok(reports.filter(Boolean).every(r => /phones \d+–(\d+|end)/.test(r)) && reports.some(r => r.endsWith('(done)')), 'each run reports its own chunk: ' + reports.filter(Boolean).slice(-2).join(' · '));
  // only two runs a minute (a schedule dropped): still every phone, just later
  DB.sql.exec('DELETE FROM reminder_progress'); DB.sql.exec('INSERT INTO reminder_progress (shard) VALUES (0)');
  shardSent.length = 0;
  for (let m = 1; m <= 6; m++) { at(`2026-10-10T21:0${m}:00`); await Promise.all([0, 1].map(() => runReminders(env, DB, new Date(clock.now)))); }
  t.eq(new Set(shardSent).size, 300, 'with one schedule missing, every phone is still reached (70 a minute)');
  at('2026-10-10T21:30:00');
  t.eq(await runReminders(env, DB, new Date(clock.now)), '', 'all claimed: later runs send nothing');
  globalThis.fetch = f1;
}

// ---- settings
r = await call('settings.update', { submitWindow: { opens: 'sun 18:00', closes: 'MON 21:00' }, trackingFrom: '2026-10-12', reminderTime: '21:30' }, M);
t.eq([r.data.submitWindow, r.data.trackingFrom, r.data.reminderTime], [{ opens: 'SUN 18:00', closes: 'MON 21:00' }, '2026-10-12', '21:30'], 'the master sets the window, the pilot start and the reminder time');
t.code(await call('settings.update', { trackingFrom: '2026-10-13' }, M), 'VALIDATION', 'the pilot start is a Monday');
t.code(await call('settings.update', { reminderTime: '02:00' }, M), 'VALIDATION', 'the reminder is in the evening');
t.code(await call('settings.update', { reminderTime: '21:00' }, C), 'FORBIDDEN', 'master only');
t.eq((await call('meta.get', {})).data.push.time, '21:30', 'the app shows the new time');

// ---- the browser renews a phone's push address: the person stays attached (push.renew)
{
  await call('push.subscribe', sub(1), A);                                            // Arjun's phone on again
  const fresh = { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1-renewed', keys: { p256dh: 'C' + 'y'.repeat(86), auth: 'b'.repeat(22) } };
  t.code(await call('push.renew', { oldEndpoint: sub(1).endpoint, ...fresh }), 'ok', 'push.renew: no sign-in needed (the old address is the proof)');
  t.eq(rows('SELECT login FROM push_subs WHERE endpoint = ?', fresh.endpoint).map(x => x.login), ['6000000051'], 'the new address keeps the person');
  t.eq(rows('SELECT COUNT(*) n FROM push_subs WHERE endpoint = ?', sub(1).endpoint)[0].n, 0, 'the old address is gone');
  const other = { endpoint: 'https://fcm.googleapis.com/fcm/send/unknown-new', keys: fresh.keys };
  await call('push.renew', { oldEndpoint: 'https://fcm.googleapis.com/fcm/send/never-seen', ...other });
  t.eq(rows('SELECT login FROM push_subs WHERE endpoint = ?', other.endpoint).map(x => x.login), [''], 'an unknown old address: registered with nobody attached');
  // the app registered the new address first (nobody on it), then the renewal arrives: the person moves to it
  const race = { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1-raced', keys: fresh.keys };
  await call('push.register', race);
  await call('push.renew', { oldEndpoint: fresh.endpoint, ...race });
  t.eq([rows('SELECT login FROM push_subs WHERE endpoint = ?', race.endpoint).map(x => x.login), rows('SELECT COUNT(*) n FROM push_subs WHERE endpoint = ?', fresh.endpoint)[0].n], [['6000000051'], 0], 'registered first, renewed after: the person moves to the new address, the old row goes');
  const a1 = await call('push.renew', { oldEndpoint: 'https://fcm.googleapis.com/fcm/send/nope', ...race }), a2 = await call('push.renew', { oldEndpoint: race.endpoint, ...race });
  t.ok(a1.ok && a2.ok && JSON.stringify(a1.data) === JSON.stringify(a2.data), 'the same answer whether or not the old address exists');
}

{ // ---- the deadline reminder (Phase 4): the three hours before last week's Monday 9 PM deadline, devotees who have not submitted it
  DB.sql.exec('DELETE FROM push_subs'); DB.sql.exec('INSERT OR IGNORE INTO reminder_progress (shard) VALUES (1)');   // the claim test above left only shard 0
  await call('push.subscribe', sub(1), A); await call('push.subscribe', sub(2), B); await call('push.subscribe', sub(4), C); await call('push.register', sub(5));
  const got = [];
  globalThis.fetch = async (url, opt = {}) => { if (String(url).startsWith('https://fcm.googleapis.com/')) { got.push({ url: String(url), opt }); return { ok: true, status: 201, json: async () => ({}) }; } return realFetch(url, opt); };
  at('2026-10-12T17:00:00');
  t.eq(await deadlineWindow(DB, new Date(clock.now)), null, 'Monday 5 PM: not yet');
  // Arjun's week is submitted (the row as the deadline would leave it; the submit rules have their own tests)
  DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva,
    attendance, body, soul, overall, seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
    VALUES ('t-arjun', '6000000051', 'Arjun Das', 'SPS2', '2026-10-05', '2026-10-12T17:00:00+05:30', '6000000051', 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', '', 0, 0, '[]', '{}')`);
  t.eq(await runReminders(env, DB, new Date(clock.now)), '', 'nothing before 6 PM');
  at('2026-10-12T18:01:00');
  t.eq((await deadlineWindow(DB, new Date(clock.now)))?.weekId, '2026-10-05', 'Monday 6 PM: last week is due in three hours');
  t.eq(await runReminders(env, DB, new Date(clock.now)), 'deadline 2026-10-05 phones 1–end: 1 sent, 0 gone, 0 failed (done)', 'at 6 PM: one push');
  t.eq(got.map(g => g.url), [sub(2).endpoint], 'only Bhima (not submitted): not Arjun (submitted), the staff phone or the signed-out phone');
  t.ok(Number(got[0].opt.headers.TTL) <= 3 * 3600 && Number(got[0].opt.headers.TTL) > 3 * 3600 - 120, 'it expires at the deadline: ' + got[0].opt.headers.TTL + ' s');
  const m = (await call('push.message', { endpoint: sub(2).endpoint })).data;
  t.eq([m.title, m.url, m.body], ['Your week closes tonight', '/#/week/2026-10-05?f=submit', 'Submit last week by 9 PM. Every complete day counts — tap to check it and submit.'], 'the words: the deadline and where to submit');
  t.eq((await call('push.message', { endpoint: sub(1).endpoint })).data.title, 'Last week is submitted ✓', 'a submitted week: "submitted ✓"');
  t.ok(/Tap to open the app/.test((await call('push.message', { endpoint: sub(5).endpoint })).data.body), 'the signed-out phone: the general words');
  got.length = 0;
  at('2026-10-12T18:02:00');
  t.eq([await runReminders(env, DB, new Date(clock.now)), got.length], ['', 0], 'once: the next minute sends nothing');
  at('2026-10-12T21:31:00');                                 // the reminder time is 21:30 since the settings test
  t.eq(await deadlineWindow(DB, new Date(clock.now)), null, 'after the deadline: no deadline reminder');
  const ev = await runReminders(env, DB, new Date(clock.now));
  t.ok(ev.startsWith('2026-10-12 phones') && got.length === 3, 'the evening reminder still goes the same evening: ' + ev);
  t.eq((await call('push.message', { endpoint: sub(2).endpoint })).data.tag, 'sadhana-reminder', 'after the deadline the words are the evening ones again');
  globalThis.fetch = realFetch;
}
t.done();
