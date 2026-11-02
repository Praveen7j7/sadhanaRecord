// Google Sheets API as the service account iyf-delhi@sadhanareport (secret GOOGLE_SA_KEY, the JSON key file).
// Used only by the scheduled job (sheet copies, registry copy) and, rarely, by a link to a very new IYF ID.
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = o => b64url(enc.encode(JSON.stringify(o)));

let cached = null;   // { token, exp } for this isolate

async function signingKey(pem) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function googleToken(env) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  if (!env.GOOGLE_SA_KEY) throw new Error('GOOGLE_SA_KEY secret is not set');
  const key = JSON.parse(env.GOOGLE_SA_KEY), now = Math.floor(Date.now() / 1000);
  const unsigned = b64urlJson({ alg: 'RS256', typ: 'JWT' }) + '.' + b64urlJson({ iss: key.client_email, scope: SCOPE, aud: key.token_uri, iat: now, exp: now + 3600 });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(key.private_key), enc.encode(unsigned));
  const r = await fetch(key.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + unsigned + '.' + b64url(sig) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token: ' + JSON.stringify(j).slice(0, 200));
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function call(env, url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { authorization: 'Bearer ' + await googleToken(env), 'content-type': 'application/json', ...(opt.headers || {}) } });
  const j = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(`Sheets ${r.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}
const S = 'https://sheets.googleapis.com/v4/spreadsheets/';

export async function sheetValues(env, id, range) {
  const j = await call(env, `${S}${id}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`);
  return j.values || [];
}
/** Several ranges in one call: an array of row arrays per range, in the order asked. */
export async function batchValues(env, id, ranges) {
  const j = await call(env, `${S}${id}/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&${ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&')}`);
  return (j.valueRanges || []).map(v => v.values || []);
}
/** Writes several ranges as typed (RAW: never parsed, so text stays text and nothing becomes a formula). */
export const writeRanges = (env, id, data) => call(env, `${S}${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
/** { title: { sheetId, rows } } for every tab of a spreadsheet. */
export async function sheetGrid(env, id) {
  const j = await call(env, `${S}${id}?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))`);
  return Object.fromEntries((j.sheets || []).map(s => [s.properties.title, { sheetId: s.properties.sheetId, rows: s.properties.gridProperties.rowCount }]));
}
/** Adds rows at the bottom of tabs: [{ sheetId, add }]. */
export const growTabs = (env, id, list) => call(env, `${S}${id}:batchUpdate`, { method: 'POST',
  body: JSON.stringify({ requests: list.map(x => ({ appendDimension: { sheetId: x.sheetId, dimension: 'ROWS', length: x.add } })) }) });
export const clearRanges = (env, id, ranges) => call(env, `${S}${id}/values:batchClear`, { method: 'POST', body: JSON.stringify({ ranges }) });
export const appendRows = (env, id, range, values) =>
  call(env, `${S}${id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) });
/**
 * Structural edits and cell values in one call, applied by Google in order (insertDimension, deleteDimension,
 * updateCells, appendDimension, …). Used by the batch view sheets to insert a row exactly where it belongs.
 */
export const sheetRequests = (env, id, requests) => call(env, `${S}${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
