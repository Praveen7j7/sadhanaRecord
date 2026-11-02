# Fetches verse translations word for word from vedabase.io (Śrīla Prabhupāda's books) for the home carousel.
# Writes setup/data/quotes-vedabase.json; frontend/src/lib/quotes.js is made from it.   python3 setup/fetch-quotes.py
import json, re, html, time, urllib.request
REFS = [  # (vedabase path, label)
  ('sb/1/2/6', 'Śrīmad-Bhāgavatam 1.2.6'), ('sb/1/2/7', 'Śrīmad-Bhāgavatam 1.2.7'), ('sb/1/2/8', 'Śrīmad-Bhāgavatam 1.2.8'),
  ('sb/1/2/17', 'Śrīmad-Bhāgavatam 1.2.17'), ('sb/1/2/18', 'Śrīmad-Bhāgavatam 1.2.18'), ('sb/1/5/17', 'Śrīmad-Bhāgavatam 1.5.17'),
  ('sb/1/18/13', 'Śrīmad-Bhāgavatam 1.18.13'), ('sb/2/1/11', 'Śrīmad-Bhāgavatam 2.1.11'), ('sb/3/25/21', 'Śrīmad-Bhāgavatam 3.25.21'),
  ('sb/3/25/25', 'Śrīmad-Bhāgavatam 3.25.25'), ('sb/7/5/23-24', 'Śrīmad-Bhāgavatam 7.5.23-24'), ('sb/7/6/1', 'Śrīmad-Bhāgavatam 7.6.1'),
  ('sb/11/2/42', 'Śrīmad-Bhāgavatam 11.2.42'), ('sb/11/14/21', 'Śrīmad-Bhāgavatam 11.14.21'), ('sb/11/20/17', 'Śrīmad-Bhāgavatam 11.20.17'),
  ('sb/12/3/51', 'Śrīmad-Bhāgavatam 12.3.51'), ('sb/12/13/23', 'Śrīmad-Bhāgavatam 12.13.23'), ('sb/10/14/8', 'Śrīmad-Bhāgavatam 10.14.8'),
  ('sb/2/3/10', 'Śrīmad-Bhāgavatam 2.3.10'), ('sb/1/7/10', 'Śrīmad-Bhāgavatam 1.7.10'),
  ('noi/2', 'The Nectar of Instruction 2'), ('noi/3', 'The Nectar of Instruction 3'),
  ('cc/adi/17/21', 'Śrī Caitanya-caritāmṛta Ādi 17.21'), ('cc/antya/20/12', 'Śrī Caitanya-caritāmṛta Antya 20.12'),
  ('cc/antya/20/21', 'Śrī Caitanya-caritāmṛta Antya 20.21'), ('cc/madhya/22/54', 'Śrī Caitanya-caritāmṛta Madhya 22.54'),
  ('cc/madhya/19/151', 'Śrī Caitanya-caritāmṛta Madhya 19.151'),
  ('bg/9/14', 'Bhagavad-gītā As It Is 9.14'), ('bg/10/9', 'Bhagavad-gītā As It Is 10.9'), ('bg/10/10', 'Bhagavad-gītā As It Is 10.10'),
  ('bg/18/65', 'Bhagavad-gītā As It Is 18.65'), ('bg/18/66', 'Bhagavad-gītā As It Is 18.66'), ('bg/6/26', 'Bhagavad-gītā As It Is 6.26'),
  ('bg/7/14', 'Bhagavad-gītā As It Is 7.14'), ('bg/8/14', 'Bhagavad-gītā As It Is 8.14'),
  # --- Phase 9 (9 Oct 2026): The Nectar of Instruction in full, Bhagavatam cantos 7 and 11 weighted,
  # Caitanya-caritamrta Madhya 8 and 22, and the books already allotted to devotees. ---
  ('noi/1', 'The Nectar of Instruction 1'), ('noi/4', 'The Nectar of Instruction 4'),
  ('noi/5', 'The Nectar of Instruction 5'), ('noi/6', 'The Nectar of Instruction 6'),
  ('noi/7', 'The Nectar of Instruction 7'), ('noi/8', 'The Nectar of Instruction 8'),
  ('noi/9', 'The Nectar of Instruction 9'), ('noi/10', 'The Nectar of Instruction 10'),
  ('noi/11', 'The Nectar of Instruction 11'),
  ('sb/7/5/30', 'Śrīmad-Bhāgavatam 7.5.30'), ('sb/7/5/31', 'Śrīmad-Bhāgavatam 7.5.31'),
  ('sb/7/5/32', 'Śrīmad-Bhāgavatam 7.5.32'), ('sb/7/7/51-52', 'Śrīmad-Bhāgavatam 7.7.51-52'),
  ('sb/7/9/43', 'Śrīmad-Bhāgavatam 7.9.43'), ('sb/7/11/8-12', 'Śrīmad-Bhāgavatam 7.11.8-12'),
  ('sb/11/2/40', 'Śrīmad-Bhāgavatam 11.2.40'), ('sb/11/2/43', 'Śrīmad-Bhāgavatam 11.2.43'),
  ('sb/11/3/21', 'Śrīmad-Bhāgavatam 11.3.21'), ('sb/11/3/22', 'Śrīmad-Bhāgavatam 11.3.22'),
  ('sb/11/5/32', 'Śrīmad-Bhāgavatam 11.5.32'), ('sb/11/8/44', 'Śrīmad-Bhāgavatam 11.8.44'),
  ('sb/11/9/29', 'Śrīmad-Bhāgavatam 11.9.29'), ('sb/11/11/29', 'Śrīmad-Bhāgavatam 11.11.29'),
  ('sb/11/13/27', 'Śrīmad-Bhāgavatam 11.13.27'), ('sb/11/19/20', 'Śrīmad-Bhāgavatam 11.19.20'),
  ('sb/11/19/21', 'Śrīmad-Bhāgavatam 11.19.21'), ('sb/11/23/57', 'Śrīmad-Bhāgavatam 11.23.57'),
  ('sb/11/29/34', 'Śrīmad-Bhāgavatam 11.29.34'),
  ('sb/3/25/19', 'Śrīmad-Bhāgavatam 3.25.19'), ('sb/3/25/20', 'Śrīmad-Bhāgavatam 3.25.20'),
  ('sb/3/29/11-12', 'Śrīmad-Bhāgavatam 3.29.11-12'),
  ('sb/4/8/34', 'Śrīmad-Bhāgavatam 4.8.34'), ('sb/4/20/28', 'Śrīmad-Bhāgavatam 4.20.28'),
  ('sb/4/29/49', 'Śrīmad-Bhāgavatam 4.29.49'),
  ('sb/10/2/32', 'Śrīmad-Bhāgavatam 10.2.32'), ('sb/10/22/35', 'Śrīmad-Bhāgavatam 10.22.35'),
  ('sb/6/2/14', 'Śrīmad-Bhāgavatam 6.2.14'), ('sb/6/3/22', 'Śrīmad-Bhāgavatam 6.3.22'),
  ('sb/1/1/2', 'Śrīmad-Bhāgavatam 1.1.2'), ('sb/2/9/36', 'Śrīmad-Bhāgavatam 2.9.36'),
  ('cc/madhya/8/128', 'Śrī Caitanya-caritāmṛta Madhya 8.128'),
  ('cc/madhya/22/31', 'Śrī Caitanya-caritāmṛta Madhya 22.31'),
  ('cc/madhya/22/62', 'Śrī Caitanya-caritāmṛta Madhya 22.62'),
  ('cc/madhya/22/107', 'Śrī Caitanya-caritāmṛta Madhya 22.107'),
  ('cc/madhya/20/108', 'Śrī Caitanya-caritāmṛta Madhya 20.108'),
  ('cc/adi/1/1', 'Śrī Caitanya-caritāmṛta Ādi 1.1'),
  ('cc/antya/20/29', 'Śrī Caitanya-caritāmṛta Antya 20.29'),
  ('iso/mantra-1', 'Śrī Īśopaniṣad, Mantra 1'),
  ('nod/1', 'The Nectar of Devotion, Chapter 1'),
  ('bs/5/1', 'Śrī Brahma-saṁhitā 5.1'), ('bs/5/29', 'Śrī Brahma-saṁhitā 5.29'),
  ('bs/5/33', 'Śrī Brahma-saṁhitā 5.33'),
]
out = []
for path, label in REFS:
    req = urllib.request.Request(f'https://vedabase.io/en/library/{path}/', headers={'User-Agent': 'Mozilla/5.0'})
    try:
        s = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')
    except Exception as e:                      # a reference that does not exist on vedabase.io is skipped, never guessed
        print('  skipped', path, '-', e); continue
    m = re.search(r'<div class="av-translation">.*?<strong>(.*?)</strong>', s, re.S)
    if not m: print('  no translation:', path); continue
    text = html.unescape(re.sub(r'<.*?>', '', m.group(1))).strip()
    out.append({'text': text, 'ref': label, 'url': f'https://vedabase.io/en/library/{path}/'})
    time.sleep(0.4)
json.dump(out, open('setup/data/quotes-vedabase.json', 'w'), indent=1, ensure_ascii=False)
print(len(out), 'verses')
