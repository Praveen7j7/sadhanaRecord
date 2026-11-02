// Builds one Sadhana Record spreadsheet from setup/schema.mjs, as the build service account.
//   node setup/build-store.mjs check access    shows what would change; changes nothing
//   node setup/build-store.mjs apply access    builds missing tabs, headers, formats, protections, seed rows
// Additive only: a tab that already has rows below its header is never rewritten, and a header that differs
// from the schema stops the run. Files must be owned by the owner in setup/files.json (never by the service account).
import { readFileSync } from 'node:fs';
import * as g from './sa.mjs';
import { SCHEMA } from './schema.mjs';

const [mode = 'check', which] = process.argv.slice(2);
const FILES = JSON.parse(readFileSync(new URL('./files.json', import.meta.url), 'utf8'));
const spec = SCHEMA[which], id = FILES[which];
if (!spec || !id) throw new Error('usage: build-store.mjs check|apply <' + Object.keys(SCHEMA).join('|') + '>  (file id in setup/files.json)');

const HEAD_BG = { red: 0.11, green: 0.16, blue: 0.27 }, WHITE = { red: 1, green: 1, blue: 1 };
const BAND1 = WHITE, BAND2 = { red: 0.95, green: 0.96, blue: 0.98 };
const FORMATS = { datetime: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm' }, date: { type: 'DATE', pattern: 'yyyy-mm-dd' }, int: { type: 'NUMBER', pattern: '0' }, text: { type: 'TEXT' } };
const ROWS = 500;

const file = await g.driveFile(id);
if (!file.capabilities.canEdit) throw new Error(`${g.SA_EMAIL} cannot edit ${which}; share it as Editor.`);
const owner = file.owners?.[0]?.emailAddress;
if (owner !== FILES.owner) throw new Error(`${which} is owned by ${owner}, expected ${FILES.owner}. Nothing changed.`);

const m = await g.meta(id);
const have = Object.fromEntries(m.sheets.map(s => [s.properties.title, s.properties]));
const plan = [], reqs = [], values = [];
let nextId = Math.max(1000, ...m.sheets.map(s => s.properties.sheetId)) + 1;

const IST = ['Asia/Kolkata', 'Asia/Calcutta'];   // Google stores Kolkata under its old name
if (m.properties.title !== spec.title || !IST.includes(m.properties.timeZone) || m.properties.locale !== 'en_GB') {
  plan.push(`file: title "${m.properties.title}" → "${spec.title}", time zone ${m.properties.timeZone} → Asia/Kolkata, locale ${m.properties.locale} → en_GB`);
  reqs.push({ updateSpreadsheetProperties: { properties: { title: spec.title, timeZone: 'Asia/Kolkata', locale: 'en_GB' }, fields: 'title,timeZone,locale' } });
}

// About tab
if (!have.About) {
  const sid = nextId++;
  plan.push('add tab About (what this file holds)');
  reqs.push({ addSheet: { properties: { sheetId: sid, title: 'About', index: 0, gridProperties: { rowCount: spec.about.length + 2, columnCount: 1 }, tabColorStyle: { rgbColor: HEAD_BG } } } },
    { updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 900 }, fields: 'pixelSize' } },
    { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: spec.about.length, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } }, fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)' } },
    { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat.textFormat' } },
    { addProtectedRange: { protectedRange: { range: { sheetId: sid }, description: 'Written by the Sadhana app setup', warningOnly: true } } });
  values.push({ range: "'About'!A1", values: spec.about.map(t => [t]) });
}

const colName = (i) => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
let index = 1;
for (const [tab, cols] of Object.entries(spec.tabs)) {
  const headers = cols.map(c => c[0]);
  const seed = (spec.seed || {})[tab] || [];
  if (have[tab]) {
    const v = (await g.get(id, `'${tab}'!A1:ZZ3`)).values || [];
    const cur = v[0] || [];
    const differs = cur.length && cur.join('|') !== headers.join('|');
    // new columns added at the END of the schema only (additive): write their headers, keep every row
    const appended = differs && cur.length < headers.length && headers.slice(0, cur.length).join('|') === cur.join('|');
    if (appended) {
      const add = cols.slice(cur.length), sid = have[tab].sheetId, need = headers.length - (have[tab].gridProperties?.columnCount || 0);
      plan.push(`${tab}: add column${add.length > 1 ? 's' : ''} ${add.map(c => c[0]).join(', ')} at the end (rows kept)`);
      if (need > 0) reqs.push({ appendDimension: { sheetId: sid, dimension: 'COLUMNS', length: need } });
      add.forEach(([, note], i) => { if (note) reqs.push({ updateCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: cur.length + i, endColumnIndex: cur.length + i + 1 }, rows: [{ values: [{ note }] }], fields: 'note' } }); });
      values.push({ range: `'${tab}'!${colName(cur.length)}1`, values: [add.map(c => c[0])] });
      index++; continue;
    }
    if (differs && v.length > 1) throw new Error(`${tab}: header differs from the schema and the tab has data; change it by hand. Nothing changed.\n  sheet:  ${cur.join(', ')}\n  schema: ${headers.join(', ')}`);
    if (!cur.length) throw new Error(`${tab}: exists without a header; delete the tab by hand or add the header, then run again.`);
    if (!differs) { if (v.length > 1) plan.push(`${tab}: built, has data, left as it is`); index++; continue; }
    // header changed and the tab is still empty: rebuild it from the schema
    plan.push(`${tab}: header changed and the tab is empty, rebuilt`);
    reqs.push({ deleteSheet: { sheetId: have[tab].sheetId } });
  }
  const sid = nextId++;
  plan.push(`add tab ${tab}: ${cols.length} columns${seed.length ? `, ${seed.length} starting rows` : ''}`);
  reqs.push({ addSheet: { properties: { sheetId: sid, title: tab, index: index++, gridProperties: { rowCount: ROWS, columnCount: cols.length, frozenRowCount: 1 } } } });
  reqs.push({ addBanding: { bandedRange: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: ROWS, startColumnIndex: 0, endColumnIndex: cols.length },
    rowProperties: { headerColorStyle: { rgbColor: HEAD_BG }, firstBandColorStyle: { rgbColor: BAND1 }, secondBandColorStyle: { rgbColor: BAND2 } } } } });
  reqs.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColorStyle: { rgbColor: WHITE } }, verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(textFormat,verticalAlignment)' } });
  cols.forEach(([h, note, kind], c) => {
    const col = { sheetId: sid, startColumnIndex: c, endColumnIndex: c + 1 };
    if (note) reqs.push({ updateCells: { range: { ...col, startRowIndex: 0, endRowIndex: 1 }, rows: [{ values: [{ note }] }], fields: 'note' } });
    const body = { ...col, startRowIndex: 1, endRowIndex: ROWS };
    if (FORMATS[kind]) reqs.push({ repeatCell: { range: body, cell: { userEnteredFormat: { numberFormat: FORMATS[kind] } }, fields: 'userEnteredFormat.numberFormat' } });
    // a TRUE/FALSE list, not a checkbox: Google fills every checkbox cell with FALSE, which makes the tab look full
    if (kind === 'bool') reqs.push({ setDataValidation: { range: body, rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'TRUE' }, { userEnteredValue: 'FALSE' }] }, strict: false, showCustomUi: true } } });
    if (kind.startsWith('enum:')) reqs.push({ setDataValidation: { range: body, rule: { condition: { type: 'ONE_OF_LIST', values: kind.slice(5).split('|').map(v => ({ userEnteredValue: v })) }, strict: false, showCustomUi: true } } });
  });
  reqs.push({ autoResizeDimensions: { dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: cols.length } } });
  reqs.push({ addProtectedRange: { protectedRange: { range: { sheetId: sid }, description: 'Written only by the Sadhana app server. Please do not edit by hand.', warningOnly: true } } });
  values.push({ range: `'${tab}'!A1`, values: [headers, ...seed] });
}

const stray = m.sheets.filter(s => !spec.tabs[s.properties.title] && s.properties.title !== 'About');
for (const s of stray) {
  const v = (await g.get(id, `'${s.properties.title}'!A1:Z50`)).values || [];
  if (v.length) plan.push(`tab ${s.properties.title}: not in the schema and not empty, left as it is`);
  else { plan.push(`remove empty tab ${s.properties.title}`); reqs.push({ deleteSheet: { sheetId: s.properties.sheetId } }); }
}

console.log(`${which} (${id}) · owner ${owner}`);
plan.forEach(p => console.log('  ' + p));
if (!reqs.length) { console.log('  nothing to do'); process.exit(0); }
if (mode !== 'apply') { console.log(`check only: ${reqs.length} changes planned. Run with "apply" to make them.`); process.exit(0); }
await g.batchUpdate(id, reqs);
if (values.length) await g.putValues(id, values);
// widths after the headers exist
const m2 = await g.meta(id);
const widths = m2.sheets.filter(s => spec.tabs[s.properties.title]).map(s => ({ autoResizeDimensions: { dimensions: { sheetId: s.properties.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: spec.tabs[s.properties.title].length } } }));
await g.batchUpdate(id, widths);
console.log('applied.');
