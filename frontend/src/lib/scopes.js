// One person, one login, scopes: devotee (their own sadhana), group leader (a devotee who leads a group of their batch,
// decision 41), coordinator (their batches), master (everything).
// The server sends user.scopes; before that existed (and for older replies) it is derived from the role.
export function scopesOf(u) {
  if (!u) return { devotee: null, groupLeader: null, facilitator: null, trainee: null, coordinator: [], master: false };
  if (u.scopes) return { devotee: u.scopes.devotee || null, groupLeader: u.scopes.groupLeader || null, facilitator: u.scopes.facilitator || null, trainee: u.scopes.trainee || null, coordinator: u.scopes.coordinator || [], master: !!u.scopes.master, rights: u.scopes.rights || {}, ftp: !!u.scopes.ftp };
  const ids = u.batchIds || [];
  if (u.role === 'MASTER') return { devotee: null, groupLeader: null, trainee: null, coordinator: [], master: true };
  if (u.role === 'COORDINATOR') return { devotee: null, groupLeader: null, trainee: null, coordinator: ids, master: false };
  return { devotee: { batchId: ids[0] || null }, groupLeader: null, trainee: null, coordinator: [], master: false };
}
export const canRequests = (s) => s.master || s.coordinator.length > 0;
/** A right the head has not turned off for this person (ADR 0015/0019; the server sends them as scopes.rights). The
 *  screens hide what the server would refuse; a head's own powers are never taken. */
export const can = (s, id) => !!s?.master || s?.rights?.[id] !== 'deny';
