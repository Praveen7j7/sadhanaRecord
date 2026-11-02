// Keep the cached coordinator and batch lists consistent after a write, with no refetch.
import { patch, entry } from '../lib/cache.svelte.js';

const nameOf = (login) => entry('coordinators.list').data?.find((c) => c.username === login)?.name || login;

export function upsertCoordinator(row) {
  patch('coordinators.list', (l) => (l.some((c) => c.username === row.username) ? l.map((c) => (c.username === row.username ? row : c)) : [...l, row]));
  // Moving batches changes who holds them: update the batches and the other coordinators' rows.
  patch('batches.list', (bs) => bs.map((b) => {
    const has = row.batchIds.includes(b.batchId);
    const logins = b.coordinatorLogins.filter((l) => l !== row.username);
    if (has) logins.push(row.username);
    return { ...b, coordinatorLogins: logins, coordinatorNames: logins.map(nameOf) };
  }));
  patch('coordinators.list', (l) => l.map((c) => (c.username === row.username ? c : { ...c, batchIds: c.batchIds.filter((id) => !row.batchIds.includes(id)) })));
}

export function applyBatch(batch) {
  patch('batches.list', (bs) => (bs.some((b) => b.batchId === batch.batchId) ? bs.map((b) => (b.batchId === batch.batchId ? batch : b)) : [...bs, batch]));
  patch('coordinators.list', (l) => l.map((c) => ({ ...c, batchIds: batch.coordinatorLogins.includes(c.username) ? [...new Set([...c.batchIds, batch.batchId])] : c.batchIds.filter((id) => id !== batch.batchId) })));
}
