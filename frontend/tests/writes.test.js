// Every action that saves on the server needs a request id from the app (else the server answers BAD_REQUEST and the
// person sees "Something went wrong"). The mock does not check it, so this test compares the two lists directly
// (4 Oct 2026: likes, comments, facilitator logins and the no-class week were missing).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../../worker/src/api.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');
// Match `write: true` anywhere in the route's options, not only straight after `roles:` — a route with
// `mustChangeOk` or anything else in between used to slip past this test entirely (found 13 Oct 2026 when
// auth.logoutAll was added and the test stayed green).
const writes = [...server.matchAll(/'([a-zA-Z]+\.[a-zA-Z]+)':\s+\{([^}]*)\}/g)]
  .filter((m) => /\bwrite:\s*true/.test(m[2]))
  .map((m) => m[1]);
const list = app.slice(app.indexOf('const WRITES'), app.indexOf(']);', app.indexOf('const WRITES')));
// sent by the service worker with its own request id, not through call()
const NOT_FROM_THE_APP = ['push.renew'];

describe('request ids', () => {
  it('the server has write actions', () => expect(writes.length).toBeGreaterThan(40));
  it('every server write action is in the app\'s WRITES list', () => {
    expect(writes.filter((w) => !NOT_FROM_THE_APP.includes(w) && !list.includes(`'${w}'`))).toEqual([]);
  });
});
