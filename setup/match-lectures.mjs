// Turns lecture links that point at a Drive FOLDER into the one file for that lecture, read-only.
// Input: data/journals.json + data/lecture-folder-files.json (folder listings made with the SA).
// Rule (no guessing): a lecture titled "..._Lecture N" / "..._N" / "Part N" is linked to a file only when
// exactly ONE audio/video file in its folder starts with the number N. Anything else keeps the folder link
// and is listed in data/lecture-links-unresolved.json for the head to check.
import fs from 'node:fs';
const J = JSON.parse(fs.readFileSync(new URL('./data/journals.json', import.meta.url)));
const F = JSON.parse(fs.readFileSync(new URL('./data/lecture-folder-files.json', import.meta.url)));
const media = (f) => /^(audio|video)\//.test(f.mime || '') || /\.(mp3|m4a|wav|mp4|mpg|amr|aac|ogg)$/i.test(f.name);
const lectureNo = (t) => { const m = /(?:lecture|part|_)\s*(\d{1,3})\s*$/i.exec(String(t).trim()); return m ? Number(m[1]) : null; };
const fileNo = (n) => { const m = /^\s*0*(\d{1,3})\s*[._\- )]/.exec(n); return m ? Number(m[1]) : null; };
const out = {}, unresolved = [];
let direct = 0, byNumber = 0, folder = 0, none = 0, bad = 0;
for (const l of J.lectures) {
  const u = String(l.audio_url || '').trim();
  const file = /\/file\/d\/([\w-]{20,})/.exec(u) || /[?&]id=([\w-]{20,})/.exec(u);
  const fold = /\/folders\/([\w-]{20,})/.exec(u);
  if (file) { out[l.lecture_id] = { url: `https://drive.google.com/file/d/${file[1]}/view`, kind: 'file' }; direct++; continue; }
  if (!u) { out[l.lecture_id] = { url: '', kind: 'none' }; none++; unresolved.push({ id: l.lecture_id, title: l.title, why: 'no link in the journal' }); continue; }
  if (!fold) { out[l.lecture_id] = { url: '', kind: 'bad' }; bad++; unresolved.push({ id: l.lecture_id, title: l.title, why: 'link is not a Drive link: ' + u }); continue; }
  const folderUrl = `https://drive.google.com/drive/folders/${fold[1]}`;
  const n = lectureNo(l.title), files = (F[fold[1]]?.files || []).filter((f) => !f.error && media(f));
  const hits = n == null ? [] : files.filter((f) => fileNo(f.name) === n);
  if (hits.length === 1) { out[l.lecture_id] = { url: `https://drive.google.com/file/d/${hits[0].id}/view`, kind: 'file', file: (hits[0].path + '/' + hits[0].name).replace(/^\//, ''), folderUrl }; byNumber++; }
  else {
    out[l.lecture_id] = { url: folderUrl, kind: 'folder' }; folder++;
    unresolved.push({ id: l.lecture_id, title: l.title, why: n == null ? 'title has no lecture number' : hits.length ? `${hits.length} files start with ${n}` : `no file starts with ${n}`, folderUrl });
  }
}
fs.writeFileSync(new URL('./data/lecture-links.json', import.meta.url), JSON.stringify(out, null, 1));
fs.writeFileSync(new URL('./data/lecture-links-unresolved.json', import.meta.url), JSON.stringify(unresolved, null, 1));
console.log({ total: J.lectures.length, direct, byNumber, folder, none, bad });
