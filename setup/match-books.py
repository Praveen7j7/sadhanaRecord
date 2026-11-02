# Links each book of the reading sequence to its own PDF(s) in the IYF Drive folder (setup/data/book-files.json,
# listed read-only with the service account). Writes setup/data/book-links.json. Only clear matches are linked;
# anything below the threshold is listed for the head to confirm, never guessed.   python3 setup/match-books.py
import json, re, difflib
files = json.load(open('setup/data/book-files.json'))
books = json.load(open('setup/data/journals.json'))['books']
def norm(s):
    s = s.lower()
    for a, b in [('krsna', 'krishna'), ('krsna', 'krishna'), ('caitanya', 'chaitanya'), ('charitamrita', 'caritamrta'), ('bhagwad', 'bhagavad'), ('againtst', 'against'), ('infallble', 'infallible')]: s = s.replace(a, b)
    s = re.sub(r'\.pdf$|\(z-lib\.org\)|\(.*?\)|\[.*?\]', ' ', s)
    s = re.sub(r'^\s*\d+[a-z]?[.)]?\s+', '', s)
    s = re.sub(r'[^a-z]+', ' ', s)
    s = re.sub(r'\b(the|a|an|of|and|in|by|as|it|is|pr|prabhu|english|hindi|iskon|iskcon|pdf)\b', ' ', s)
    return ' '.join(s.split())
def nums(s):  # volume / part numbers, ignoring the file's leading order number
    return set(re.findall(r'\d+', re.sub(r'\(.*?\)|^\s*\d+[a-z]?[.)]?\s+', '', s)))
def words_ok(t, name):
    # every distinctive title word (5+ letters) must appear, allowing for spelling, in the file name
    fw = norm(name).split()
    return all(any(difflib.SequenceMatcher(None, w, x).ratio() >= 0.8 for x in fw) for w in t.split() if len(w) >= 5)
def safe(title, t, name):
    return nums(title) == nums(name[:-4]) and words_ok(t, name)
link = lambda f: f'https://drive.google.com/file/d/{f["id"]}/view'
folders = {}
for f in files:
    if f['path']: folders.setdefault(f['path'], []).append(f)
out, review = {}, []
by_name = lambda pred: sorted([f for f in files if pred(f)], key=lambda f: f['name'])
def rule(title):
    # exact, name-based rules (no similarity): one canto / one lila → its own file; "complete" → every volume
    m = re.search(r'Bhagavatam Canto (\d+)', title)
    if m: return by_name(lambda f: f['name'] == f'SB{int(m.group(1)):02d}.pdf')
    if re.search(r'Bhagavatam Complete', title, re.I): return by_name(lambda f: re.fullmatch(r'SB\d\d\.pdf', f['name']))
    m = re.search(r'Charitamrita \((Adi|Madhya|Antya) Lila\)', title)
    if m: return by_name(lambda f: 'caritamrta' in f['path'].lower() and f['name'].endswith(f'{m.group(1)}.pdf'))
    if title == 'Bhagavad Gita As It Is':            # language "Both": the English and the Hindi edition
        return by_name(lambda f: f['name'] in ('1a. Bhagavad-Gita As It Is_English.pdf', '1b. Bhagwad Gita in Hindi ISKON.pdf'))
    if re.search(r'Charitamrita COMPLETE', title, re.I): return by_name(lambda f: 'caritamrta' in f['path'].lower())
    # titles whose file differs only by spelling or a subtitle (checked by hand, 2 Oct 2026)
    for key, start in [('Crimes Againtst Vedic India', '4a. Crimes against India'), ('Forbidden Archaeology', '4b. Forbidden Archeology'),
                       ('End of Modern Civilization', '4i. End_of_Modern_Civilization'), ('Second Chance', '16. A second chance'),
                       ('TKG Diary', "12. TKG's diary")]:
        if title.startswith(key): return by_name(lambda f: f['name'].startswith(start))
    return None
for b in books:
    fixed = rule(b['title'])
    if fixed:
        out[b['book_id']] = [{'name': f['name'][:-4], 'url': link(f)} for f in fixed]
        continue
    t = norm(b['title'])
    # a whole folder for a multi-volume book (Srimad Bhagavatam, Caitanya-caritamrta, Lilamrta, Transcendental Diary)
    best_folder = max(folders, key=lambda p: difflib.SequenceMatcher(None, t, norm(p.split(' / ')[-1])).ratio())
    fsc = difflib.SequenceMatcher(None, t, norm(best_folder.split(' / ')[-1])).ratio()
    best = max([f for f in files if safe(b['title'], t, f['name'])] or files, key=lambda f: difflib.SequenceMatcher(None, t, norm(f['name'])).ratio())
    sc = difflib.SequenceMatcher(None, t, norm(best['name'])).ratio()
    if fsc >= 0.8 and fsc > sc and len(folders[best_folder]) > 1:
        vols = sorted(folders[best_folder], key=lambda f: f['name'])
        out[b['book_id']] = [{'name': f['name'][:-4], 'url': link(f)} for f in vols]
    elif sc >= 0.8 and safe(b['title'], t, best['name']):
        out[b['book_id']] = [{'name': best['name'][:-4], 'url': link(best)}]
    else:
        review.append({'book_id': b['book_id'], 'title': b['title'], 'closest_file': best['name'], 'score': round(sc, 2)})
json.dump({'links': out, 'review': review}, open('setup/data/book-links.json', 'w'), indent=1, ensure_ascii=False)
print(f'linked {len(out)} of {len(books)} books ({sum(len(v) for v in out.values())} files); to confirm: {len(review)}')
for r in review: print(f"  ? {r['book_id']} {r['title'][:55]}  ~  {r['closest_file'][:60]} ({r['score']})")
multi = {k: len(v) for k, v in out.items() if len(v) > 1}
print('multi-volume:', {k: (next(b['title'] for b in books if b['book_id'] == k)[:40], n) for k, n in multi.items()})
