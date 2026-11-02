// Lists a Drive folder and EVERY folder under it, read-only, as the build service account (setup/sa.mjs).
// Writes [{ id, name, path, mimeType, size }] for every file (not folders). Used for the book PDFs (Hindi, 19 Oct 2026).
//   node setup/list-drive-folder.mjs <folderId> <out.json>
import { writeFileSync } from 'node:fs';
import { token } from './sa.mjs';
const [root, out] = process.argv.slice(2);
if (!root || !out) { console.error('usage: node setup/list-drive-folder.mjs <folderId> <out.json>'); process.exit(1); }
const F = 'application/vnd.google-apps.folder';
async function list(parent) {
  const items = []; let pageToken = '';
  do {
    const q = encodeURIComponent(`'${parent}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`
      + `&fields=nextPageToken,files(id,name,mimeType,size,shortcutDetails)${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + await token() } });
    const j = await r.json();
    if (!r.ok) throw new Error(`${r.status} listing ${parent}: ${JSON.stringify(j.error || j)}`);
    items.push(...j.files); pageToken = j.nextPageToken || '';
  } while (pageToken);
  return items;
}
const files = [], folders = [];
async function walk(id, path) {
  for (const f of await list(id)) {
    // a shortcut to a folder is walked as that folder; a shortcut to a file is listed as the file it points to
    const target = f.shortcutDetails ? { id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType } : f;
    if (target.mimeType === F) { const p = path ? `${path} / ${f.name}` : f.name; folders.push(p); await walk(target.id, p); }
    else files.push({ id: target.id, name: f.name, path, mimeType: target.mimeType, size: +(f.size || 0) });
  }
}
await walk(root, '');
writeFileSync(out, JSON.stringify(files, null, 1));
console.log(`${folders.length} folders, ${files.length} files → ${out}`);
