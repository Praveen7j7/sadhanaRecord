// Google APIs as the build service account iyf-delhi@sadhanareport (never used by the live app).
// Key: $IYF_SADHANA_SA_KEY, else ~/Documents/ticketSystem/secrets/sadhanareport.json, else ~/Downloads/sadhanareport-0f8b97035b73.json
import { readFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';
const KEY_PATH = [process.env.IYF_SADHANA_SA_KEY, process.env.HOME + '/Documents/ticketSystem/secrets/sadhanareport.json',
  process.env.HOME + '/Downloads/sadhanareport-0f8b97035b73.json'].find(p => p && existsSync(p));
if (!KEY_PATH) throw new Error('Service-account key not found; set IYF_SADHANA_SA_KEY.');
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
export const SA_EMAIL = key.client_email;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
let cached = null;
export async function token() {
  if (cached && cached.exp > Date.now() + 60000) return cached.tok;
  const now = Math.floor(Date.now() / 1000);
  const u = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive', aud: key.token_uri, iat: now, exp: now + 3600 });
  const s = crypto.createSign('RSA-SHA256').update(u).sign(key.private_key, 'base64url');
  const j = await (await fetch(key.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + u + '.' + s })).json();
  if (!j.access_token) throw new Error('token: ' + JSON.stringify(j));
  cached = { tok: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.tok;
}
async function call(url, opt = {}, tries = 0) {
  const r = await fetch(url, { ...opt, headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json', ...(opt.headers || {}) } });
  // Sheets allows 60 reads a minute per user: wait and try again rather than stop halfway
  if (r.status === 429 && tries < 6) { await new Promise(res => setTimeout(res, 15000 * (tries + 1))); return call(url, opt, tries + 1); }
  const j = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}: ${JSON.stringify(j.error || j)}`);
  return j;
}
const S = 'https://sheets.googleapis.com/v4/spreadsheets/';
export const meta = id => call(S + id + '?fields=properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties),protectedRanges(protectedRangeId))');
export const get = (id, range, render = 'FORMATTED_VALUE') => call(S + id + '/values/' + encodeURIComponent(range) + '?valueRenderOption=' + render);
export const batchUpdate = (id, requests) => call(S + id + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
export const putValues = (id, data) => call(S + id + '/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
export const driveFile = id => call('https://www.googleapis.com/drive/v3/files/' + id + '?fields=name,owners(emailAddress),capabilities(canEdit)');
