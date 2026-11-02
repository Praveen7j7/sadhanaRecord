# Reads the IYF hearing journals and the book reading sequence (Excel files in ~/Downloads) into
# setup/data/journals.json. Run again when a new release of a journal arrives.
#   python3 setup/extract-journals.py
import json, re, os, openpyxl
D = os.path.expanduser('~/Downloads/')
# Devotees know their batch, not the journals' "Level 4 / Level 5" names (the head, 2 Oct 2026), so every
# journal and book level is named by batch: Level 4 → SPS/DPS, Level 5 BSS → BSS, Level 5 BVS → BVS.
JOURNALS = {
    'SPS/DPS': 'IYF Daily Hearing Journal_Level 4_Release 1.xlsx',
    'BSS': 'IYF Daily Hearing Journal_Level 5_BSS_Release 1.xlsx',
    'BVS': 'IYF Daily Hearing Journal_Level 5_BVS_Release 1.xlsx',
}
BOOK_LEVEL = {'VL 1': 'VL-1', 'VL 2': 'VL-2', 'VL 3': 'VL-3', 'DPS/ SPS/ NS': 'SPS/DPS', 'BSS/BVS/SNS': 'BSS/BVS'}
SLOTS = ['SPL', 'GKGML', 'LOW 1', 'LOW 2']
CODE = {'SPS/DPS': 'SD', 'BSS': 'BSS', 'BVS': 'BVS'}
out = {'lectures': [], 'books': [], 'source': {}}

for journal, f in JOURNALS.items():
    ws = openpyxl.load_workbook(D + f).worksheets[0]
    weekcol = {}                      # column → week number, from the nearest header row above
    rows = list(ws.iter_rows())
    seen = set(); missing = 0
    for r in rows:
        labels = [(c.column, re.fullmatch(r'\s*Week\s*(\d+)\s*', str(c.value or ''))) for c in r]
        hdr = {col: int(m.group(1)) for col, m in labels if m}
        if len(hdr) >= 3: weekcol = hdr; continue
        slot = next((str(c.value).strip() for c in r if str(c.value or '').strip() in SLOTS), None)
        if not slot or not weekcol: continue
        for c in r:
            if c.column not in weekcol or c.value in (None, ''): continue
            week = weekcol[c.column]
            title = re.sub(r'\s+', ' ', str(c.value)).strip()
            link = c.hyperlink.target if c.hyperlink and c.hyperlink.target else ''
            lid = f"{CODE[journal]}-W{week:03d}-{slot.replace(' ', '')}"
            if lid in seen: continue
            seen.add(lid)
            if not link: missing += 1
            out['lectures'].append({'lecture_id': lid, 'journal': journal, 'week': week, 'slot': slot, 'title': title, 'audio_url': link})
    n = sum(1 for x in out['lectures'] if x['journal'] == journal)
    out['source'][journal] = {'file': f, 'lectures': n, 'weeks': len({x['week'] for x in out['lectures'] if x['journal'] == journal}), 'no_link': missing}

wb = openpyxl.load_workbook(D + 'IYF Book Reading Sequence_Draft 2.xlsx')
ws = wb['Book Store ']
order = 0
for r in ws.iter_rows(min_row=14):
    title, words, level, lang = (r[1].value, r[2].value, r[3].value, r[4].value)
    if not title or str(title).strip().startswith('#'): continue
    order += 1
    out['books'].append({'book_id': f'B{order:02d}', 'title': re.sub(r'\s+', ' ', str(title)).strip(),
                         'level': BOOK_LEVEL.get(str(level or '').strip(), str(level or '').strip()), 'words': int(words) if isinstance(words, (int, float)) else None,
                         'language': str(lang or '').strip(), 'order': order})
link = ''
for row in wb['Customized Reading Schedule'].iter_rows(max_row=10):
    for c in row:
        if c.hyperlink and c.hyperlink.target: link = link or c.hyperlink.target
out['book_link'] = link
out['source']['books'] = {'file': 'IYF Book Reading Sequence_Draft 2.xlsx', 'books': len(out['books'])}
dest = os.path.join(os.path.dirname(__file__), 'data', 'journals.json')
json.dump(out, open(dest, 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out['source'], indent=1)); print('book link:', bool(link))
from collections import Counter
print('books by level:', dict(Counter(b['level'] for b in out['books'])))
print('slots per journal:', {j: dict(Counter(x['slot'] for x in out['lectures'] if x['journal'] == j)) for j in JOURNALS})
