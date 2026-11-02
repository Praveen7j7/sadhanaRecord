#!/usr/bin/env node
// Creates (or rolls) the facilitator dashboard's scoped service token, and prints it ONCE.
//
// The token it gives you may call ONE action, identity.mintBatch (app migration 0041). A master's own
// session token reaches 49 actions, including devotees.delete and coordinators.resetPassword, so it must
// never be the thing sitting in an Apps Script Property that any dashboard editor can read.
//
//   node tools/identity/service-token.mjs                 # prompts for the master login + password
//   node tools/identity/service-token.mjs --login other   # a different service login
//
// The password is read from the terminal with echo OFF and is never stored, logged or passed as an argument
// (an argument would land in your shell history and in `ps`). The token is shown once: paste it straight
// into the Script Property. Run this again any time to roll the key — the old token stops working at once.
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';

const API = process.env.IYF_API || 'https://sadhana-record-api.iyfdelhi-sadhana.workers.dev';
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i > 0 && argv[i + 1] ? argv[i + 1] : d; };
const serviceLogin = arg('login', 'dashboard-cron');

/**
 * Asks a question. With hide = true the typing is not echoed, so a password never appears on screen
 * or in a scrollback someone later reads.
 *
 * Raw mode, read byte by byte, rather than readline's muted output: mixing readline with a muted
 * _writeToOutput and a stdin listener kept the prompt from appearing at all (11 Oct 2026).
 */
const ask = (q, hide = false) => new Promise((resolve, reject) => {
  // No terminal (a piped stdin, an editor's run button) and no env var: say so at once rather than
  // waiting for input that will never come. A silent hang is what this script did on 11 Oct 2026.
  if (!stdin.isTTY) {
    reject(new Error('this needs a terminal. Run it in Terminal, or set IYF_MASTER_LOGIN and IYF_MASTER_PASSWORD.'));
    return;
  }
  stdout.write(q);
  if (!hide) {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    rl.question('', (a) => { rl.close(); resolve(a); });
    return;
  }
  let buf = '';
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  const done = (err, val) => {
    stdin.setRawMode(false);
    stdin.pause();
    stdin.removeListener('data', onData);
    stdout.write('\n');
    err ? reject(err) : resolve(val);
  };
  const onData = (ch) => {
    for (const c of String(ch)) {
      if (c === '\n' || c === '\r' || c === '\u0004') return done(null, buf);   // Enter, or Ctrl-D
      if (c === '\u0003') return done(new Error('cancelled'));                   // Ctrl-C
      if (c === '\u007f' || c === '\b') { buf = buf.slice(0, -1); continue; }    // Backspace
      if (c >= ' ') buf += c;
    }
  };
  stdin.on('data', onData);
});

const post = async (body) => {
  const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!j) throw new Error(`the API answered ${res.status} with something that is not JSON`);
  if (!j.ok) throw new Error(`${j.error?.code}: ${j.error?.message}`);
  return j.data || {};
};
const rid = () => 'svc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

try {
  console.log(`\nCreating the scoped service token for "${serviceLogin}" on ${API}\n`);
  // IYF_MASTER_LOGIN / IYF_MASTER_PASSWORD let this run where stdin is not a terminal (a CI step, an
  // editor's run button). Prefer the prompt: an env var can be read by anything else in the same shell.
  const login = (process.env.IYF_MASTER_LOGIN || await ask('Your master login: ')).trim();
  const password = process.env.IYF_MASTER_PASSWORD || await ask('Your master password (not shown): ', true);
  if (!login || !password) throw new Error('both a login and a password are needed');

  const auth = await post({ v: 1, action: 'auth.login', app: 'service-token-setup', data: { login, password } });
  if (!auth.token) throw new Error('signed in, but no token came back');

  const out = await post({ v: 1, action: 'identity.serviceToken', app: 'service-token-setup',
    token: auth.token, requestId: rid(),
    data: { login: serviceLogin, reason: 'dashboard registry service token' } });

  console.log('');
  console.log('='.repeat(72));
  console.log(out.rekeyed ? 'KEY ROLLED — the previous token has STOPPED working.' : 'SERVICE ACCOUNT CREATED.');
  console.log('='.repeat(72));
  console.log('\nIn Apps Script → Project Settings → Script Properties, set:\n');
  console.log('  Property   IYF_ID_TOKEN');
  console.log('  Value      ' + out.token);
  console.log('\nThis token may call ONLY: ' + out.onlyActions);
  console.log('It renews itself on every hourly run, so it does not expire while the job runs.');
  console.log('Shown once — it is not stored anywhere readable. Lost it? Run this again.\n');
  exit(0);
} catch (e) {
  console.error('\nFailed: ' + e.message + '\n');
  exit(1);
}
