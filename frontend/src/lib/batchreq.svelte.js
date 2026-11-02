// Asking to start a batch (Phase 23; worker batchreq.js). The head approves a request by creating the batch in Admin ›
// Batch setup's own form, pre-filled: Requests (or Batch setup's short list) puts the request here and opens #/batches.
export const approving = $state({ req: null });
export const LEVEL_NAME = { VL2: 'Vedic Level 2', VL3: 'Vedic Level 3', ETP: 'ETP' };
/** The next number of a numbered series (VL2-51, VL3-32, ETP-21 → 52, 33, 22), from the batches that exist. */
export function nextNumber(batches, level) {
  const nums = (batches || []).map((b) => (String(b.batchId).match(new RegExp(`^${level}-(\\d{1,4})$`)) || [])[1]).filter(Boolean).map(Number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}
