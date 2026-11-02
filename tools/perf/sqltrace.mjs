import { boot, FAC, CONTACT } from '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/worker/tests/harness.mjs';
const { env, DB, call, addAccount } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('auth.signUp', { phone: '6000000141', name: 'Some Devotee', batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
await call('requests.approve', { phone: '6000000141', link: { noIdYet: true } }, M);
const T = (await call('auth.login', { login: '6000000141', password: 'Devotee pass 2026' })).data.token;
const log = [];
const origPrepare = DB.prepare.bind(DB);
DB.prepare = (sql) => { log.push(sql.replace(/\s+/g, ' ').slice(0, 110)); return origPrepare(sql); };
for (const a of ['auth.me', 'home.get']) { log.length = 0; await call(a, {}, T); console.log(`\n== ${a}: ${log.length} statements`); log.forEach((s, i) => console.log(String(i + 1).padStart(2), s)); }
