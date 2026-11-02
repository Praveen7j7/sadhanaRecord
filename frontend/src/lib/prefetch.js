// Phase 7 (9 Oct 2026): a pressed tab starts fetching its screen's file at once (pointerdown comes ~100 ms before
// the click), so the screen is usually ready when the finger lifts. A file already fetched costs nothing.
//
// The path → file mapping is the route table's (audit FE-20 / roadmap 4.1): it used to be a seventh copy of the
// route patterns here, which is how a new screen could be navigable but never prefetched.
import { loaderOf } from '../routes.js';
import { call } from './api.js';
import { load } from './cache.svelte.js';
import { saveData } from './tier.js';

/*
 * …and its first READ (22 Oct 2026, B3), for the screens that ask the server on their first visit. Each entry is the
 * screen's own cache key and arguments, so the screen opens on the copy already fetched and never asks twice; the
 * shared cache skips the call when its copy is under two minutes old. Only on a press — the person is opening that
 * screen anyway — so nothing is read for screens nobody opens (rows read are the budget). Home, Week and Day need
 * nothing here: they draw from home.get, which Home already holds; a staff Home warms each batch board itself.
 *   /report  Report.svelte: history.list, the last 26 weeks
 *   /group   Group.svelte: group.list for the focus week
 */
const FIRST_READ = {
  '/report': () => load('history.list', () => call('history.list', { limit: 26 })),
  '/group': () => load('group.list', () => call('group.list', {})),
};

export function prefetch(href) {
  const path = String(href || '').replace(/^#/, '');
  const code = loaderOf(path);
  if (code) code().catch(() => {});
  const read = FIRST_READ[path.split('?')[0]];
  if (read && !saveData()) read().catch(() => {});
}
