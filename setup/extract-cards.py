# Copies the option tables (label, marks, order) of both Excel score cards, and the SPS sample week's
# cached results, into setup/data/cards-from-excel.json. The Worker's tests check cards.js against it,
# so the app's scoring is proven to be the cards' own.   python3 setup/extract-cards.py
import json, os, openpyxl
D = os.path.expanduser('~/Downloads/')
CATS = [('to_bed', 'B', 'C'), ('wake_up', 'E', 'F'), ('day_sleep', 'H', 'I'), ('japa', 'K', 'L'), ('pathan', 'N', 'O'), ('sravan', 'Q', 'R')]
out = {}
for card, f in [('BVS/DPS/BSS', 'BVS, DPS, BSS Sadhana Score Card.xlsx'), ('SPS', 'DOC-20260914-WA0028.xlsx')]:
    wb = openpyxl.load_workbook(D + f, data_only=True)
    s2 = wb['Sheet2']
    cats = {}
    for key, lc, mc in CATS:
        opts = []
        for r in range(4, 11):
            label, marks = s2[f'{lc}{r}'].value, s2[f'{mc}{r}'].value
            if label is None: continue
            opts.append({'label': str(label).strip(), 'marks': int(marks)})
        cats[key] = opts
    out[card] = {'file': f, 'categories': cats}
# the SPS sample week (rows 5–11), with Excel's own cached marks and percentages
ws = openpyxl.load_workbook(D + 'DOC-20260914-WA0028.xlsx', data_only=True)['SPS SCORING']
days = []
for r in range(5, 12):
    days.append({'day': ws[f'B{r}'].value, 'to_bed': ws[f'C{r}'].value, 'wake_up': ws[f'F{r}'].value, 'day_sleep': ws[f'I{r}'].value,
                 'japa': ws[f'L{r}'].value, 'pathan': ws[f'O{r}'].value, 'sravan': ws[f'R{r}'].value, 'seva_min': ws[f'U{r}'].value,
                 'marks': {'to_bed': ws[f'E{r}'].value, 'wake_up': ws[f'H{r}'].value, 'day_sleep': ws[f'K{r}'].value, 'japa': ws[f'N{r}'].value,
                           'pathan': ws[f'Q{r}'].value, 'sravan': ws[f'T{r}'].value}})
pct = {k: ws[f'{c}18'].value for k, c in [('to_bed', 'D'), ('wake_up', 'E'), ('day_sleep', 'F'), ('japa', 'G'), ('pathan', 'H'), ('sravan', 'I'), ('seva', 'J')]}
out['spsSample'] = {'days': days, 'percent': pct, 'note': 'Japa on Wed–Sat was hand-typed (20, 25, 25, 25) over the formula; the app computes it from the card instead.'}
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'data', 'cards-from-excel.json'), 'w'), indent=1)
for card in ['BVS/DPS/BSS', 'SPS']:
    print(card, {k: len(v) for k, v in out[card]['categories'].items()})
print('SPS sample %:', pct)
