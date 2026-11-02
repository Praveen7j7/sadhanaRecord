#!/usr/bin/env python3
# Aggregates data/sweep/*.json into data/agg.json + a readable data/agg.txt
import json, glob, os, re, collections
ROOT = '/private/tmp/claude-501/-Users-maclapctp409-Downloads-hpStuff-prompt/bfb96117-1af2-4f66-95d5-4bbb86028c04/scratchpad/visual-audit'
files = sorted(glob.glob(ROOT + '/data/sweep/*.json'))
recs = [json.load(open(f)) for f in files]
shots = [r for r in recs if not r.get('state')]
agg = collections.OrderedDict()
def key(r): return (r['route'], r['role'])
for r in shots:
    a = agg.setdefault(key(r), {'route': r['route'], 'role': r['role'], 'hash': r['hash'], 'shots': 0, 'actual': set(), 'errors': set(), 'overlaps': {}, 'covers': {}, 'clipped': {}, 'hscroll': {}, 'small': {}, 'wraps': {}, 'column': {}, 'title': {}, 'docH': {}, 'inpage': None, 'sweepErr': []})
    a['shots'] += 1
    a['actual'].add(r.get('actualHash', ''))
    for e in r.get('errors', []): a['errors'].add(e[:160])
    s = r.get('sweep') or {}
    tag = f"{r['width']}{'d' if r['theme']=='dark' else 'l'}"
    if 'error' in s: a['sweepErr'].append(tag + ' ' + s['error']); continue
    a['docH'][tag] = r.get('docH')
    for o in s.get('overlaps', []):
        k = (o['kind'], o['aText'], o['bText'])
        a['overlaps'].setdefault(k, {'o': o, 'at': []})['at'].append(tag)
    for c in s.get('covers', []):
        k = (c['kind'], c.get('label') or c.get('underText'), c.get('bar') or c.get('over'))
        a['covers'].setdefault(k, {'c': c, 'at': []})['at'].append(tag)
    for c in s.get('clipped', []):
        k = (c['kind'], c['text'][:50], c['el'].split(' > ')[-1])
        a['clipped'].setdefault(k, {'c': c, 'at': []})['at'].append(tag)
    if s.get('hscroll'): a['hscroll'][tag] = {'px': s['hscroll'], 'by': s.get('hscrollBy', [])[:3]}
    if 'small' in s:
        real = [x for x in s['small'] if not x['inline']]
        a['small'][tag] = {'n': len(real), 'inline': s['smallN'] - len(real), 'ex': real[:12]}
    for w in s.get('wraps', []):
        k = (w['el'].split(' > ')[-1], tuple(w['last']))
        a['wraps'].setdefault(k, {'w': w, 'at': []})['at'].append(tag)
    if r['width'] >= 1024 and s.get('column'): a['column'][tag] = s['column']
    if s.get('title'): a['title'][tag] = s['title']
    if s.get('inpageHeading') and r['theme'] == 'light' and r['width'] == 1440: a['inpage'] = s['inpageHeading']

# global style inventories (light, 390 and 1440)
cards = collections.defaultdict(lambda: {'n': 0, 'routes': set(), 'cls': set()})
heads = collections.defaultdict(lambda: {'n': 0, 'routes': set(), 'cls': set(), 'ex': ''})
btns = collections.defaultdict(lambda: {'n': 0, 'routes': set()})
for r in shots:
    if r['theme'] != 'light' or r['width'] not in (390, 1440): continue
    s = r.get('sweep') or {}
    rk = f"{r['route']}/{r['role']}@{r['width']}"
    for c in s.get('cards', []) or []:
        x = cards[c['sig']]; x['n'] += c['n']; x['routes'].add(rk); x['cls'].update(c['cls'])
    for h in s.get('headings', []) or []:
        x = heads[h['sig']]; x['n'] += h['n']; x['routes'].add(rk); x['cls'].update(h['cls']); x['ex'] = x['ex'] or h['ex']
    for b in s.get('buttons', []) or []:
        x = btns[b['sig']]; x['n'] += b['n']; x['routes'].add(rk)

def ser(o):
    if isinstance(o, set): return sorted(o)
    if isinstance(o, tuple): return list(o)
    raise TypeError(type(o))
out = []
for k, a in agg.items():
    a2 = dict(a)
    for f in ('overlaps', 'covers', 'clipped', 'wraps'):
        a2[f] = [dict(v, key=list(kk)) for kk, v in a[f].items()]
    out.append(a2)
json.dump({'routes': out, 'cards': {k: v for k, v in cards.items()}, 'headings': {k: v for k, v in heads.items()}, 'buttons': {k: v for k, v in btns.items()}}, open(ROOT + '/data/agg.json', 'w'), default=ser, indent=1)

# readable digest
L = []
tot = collections.Counter()
for a in out:
    L.append(f"\n## {a['route']} / {a['role']}  ({a['hash']}) shots={a['shots']} actual={sorted(a['actual'])}")
    if a['errors']: L.append('  ERR ' + ' | '.join(sorted(a['errors']))[:400])
    if a['sweepErr']: L.append('  SWEEPERR ' + '; '.join(a['sweepErr'])[:300])
    for o in a['overlaps']:
        oo = o['o']; tot['overlap:' + oo['kind']] += 1
        L.append(f"  OVERLAP {oo['kind']}: '{oo['aText']}' x '{oo['bText']}' ({oo['ix']}x{oo['iy']}px) [{oo['a'].split(' > ')[-1]} / {oo['b'].split(' > ')[-1]}] @ {','.join(o['at'])}")
    for c in a['covers']:
        cc = c['c']; tot['cover:' + cc['kind']] += 1
        L.append(f"  COVER {cc['kind']}: '{cc.get('label') or cc.get('underText')}' [{(cc.get('el') or cc.get('under')).split(' > ')[-1]}] by {(cc.get('bar') or cc.get('over')).split(' > ')[-1]} @ {','.join(c['at'])}")
    for c in a['clipped']:
        cc = c['c']; tot['clip:' + cc['kind']] += 1
        L.append(f"  CLIP {cc['kind']}: '{cc['text'][:60]}' has {cc['has']} needs {cc['needs']} (h {cc['hHas']}/{cc['hNeeds']}) [{cc['el'].split(' > ')[-1]}] @ {','.join(c['at'])}")
    for t, h in a['hscroll'].items():
        tot['hscroll'] += 1
        L.append(f"  HSCROLL {t}: {h['px']}px by {[b['el'].split(' > ')[-1] for b in h['by']]}")
    for w in a['wraps']:
        ww = w['w']; tot['wrap'] += 1
        L.append(f"  WRAP {ww['el'].split(' > ')[-1]}: {ww['rows']} rows, last {ww['lastFill']}% {ww['last']} first {ww['first']} @ {','.join(w['at'])}")
    sm = {t: v['n'] for t, v in a['small'].items() if v['n']}
    if sm:
        ex = next((v['ex'] for v in a['small'].values() if v['n']), [])
        L.append(f"  SMALL {sm} e.g. " + '; '.join(f"{x['label'][:20]}={x['w']}x{x['h']}" for x in ex[:6]))
    for t, c in a['column'].items():
        if t.endswith('l'): L.append(f"  COLUMN {t}: used {c['usedW']}px = {c['usedPctOfAvail']}% of {c['avail']} (vw {c['vw']}), empty L {c['emptyLeft']} R {c['emptyRight']}")
    for t, c in a['title'].items():
        if t.endswith('l') and int(t[:-1]) >= 1024: L.append(f"  TITLE {t}: '{c['text']}' x={c['left']} content x={c['usedLeft']} dx={c['dx']} clipped={c['clipped']} topbar {c['tbL']}-{c['tbR']} vs area {c['mainAreaL']}-{c['mainAreaR']}")
        elif c['clipped']: L.append(f"  TITLECLIP {t}: '{c['text']}'")
    if a['inpage']: L.append(f"  INPAGE-H {a['inpage']}")
    dh = {t: v for t, v in a['docH'].items() if t.endswith('l')}
    L.append(f"  DOCH {dh}")
L.insert(0, 'TOTALS ' + json.dumps(tot))
L.append('\n# CARD SIGNATURES')
for k, v in sorted(cards.items(), key=lambda x: -len(x[1]['routes'])):
    L.append(f"  {k}: {len(v['routes'])} screens, cls {sorted(v['cls'])[:8]}")
L.append('\n# HEADING SIGNATURES')
for k, v in sorted(heads.items(), key=lambda x: -len(x[1]['routes'])):
    L.append(f"  {k}: {len(v['routes'])} screens, cls {sorted(v['cls'])[:6]} e.g. '{v['ex']}'")
L.append('\n# BUTTON SIGNATURES')
for k, v in sorted(btns.items(), key=lambda x: -len(x[1]['routes']))[:30]:
    L.append(f"  {k}: {len(v['routes'])} screens, n={v['n']}")
open(ROOT + '/data/agg.txt', 'w').write('\n'.join(L))
print(len(recs), 'records,', len(shots), 'shots,', len(out), 'route-roles'); print('TOTALS', dict(tot))
