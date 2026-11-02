import json, collections
A = json.load(open('data/agg.json'))
# defect IDs per route (from the register); shell-wide ones (V9, V14, V8) are left out of the rows
M = {
 'home': {'devotee': 'V16 V17 V10', 'trd': 'V17 V10', 'trainee': 'V17 V10', 'sps': 'V3 V16 V17 V7', 'etp': 'V3 V7', 'natvar': 'V17', 'ftp': 'V17', 'master': 'V7 V17'},
 'week': 'V23', 'week-past': '—', 'day': 'V2 V22', 'history': '—', 'history-week': 'V31 (offline)', 'report': 'V21 V28', 'hearing': 'V15', 'learn': 'V15', 'reading': 'V15',
 'share': 'V15', 'share-with-me': 'V15', 'shared': '—', 'shared-week': 'V31 (offline)', 'wall': {'devotee': 'V15 V29', 'sps': 'V15 V29 V7', 'master': 'V15 V29 V7'},
 'account': 'V27', 'songs': 'U5 U6 U7 V25', 'song': 'U3 V24 U5', 'songs-empty': 'U5', 'change-password': 'V15', 'group': '—', 'card': 'V1 V20 V38 V31', 'notfound': '—',
 'requests': 'V4 V18', 'requests-reopen': 'V18', 'batch': 'V2 V18 V39 V7 V33', 'members': 'V32 K1', 'members-empty': 'K1 V32', 'stats': 'V18 V7', 'leaders': 'V11 V18 V7',
 'closing': 'V18 V7', 'newbatch': 'V7', 'board': 'V18 V28', 'ready': 'V18 V7', 'students': 'V18', 'devotee': 'V34', 'devotee-week': 'V34', 'fill-week': 'V6 V5', 'fill-day': 'V6 V5 V2',
 'leaderboard': 'V31 (offline) V7', 'scoreboards': 'V12 V7', 'explorer': 'V15', 'my-devotees': 'V2', 'my-devotees-student': 'V2 V37', 'my-devotees-week': '—', 'fac-team': '—',
 'overview': 'V30 V13 V7', 'analysis': 'V19 V13', 'reports': 'V13', 'coordinators': 'V13 V7', 'access': 'V30 V13 V15', 'facilitators': 'V30 V13 V7', 'phases': 'V13', 'batches': 'V13 V7',
 'ids': 'V13 V15', 'activity': 'V13', 'settings': 'V13', 'welcome': 'V36', 'login': '—', 'signup': 'V36', 'forgot': '—',
}
ORDER = ['public', 'devotee', 'trd', 'trainee', 'natvar', 'ftp', 'sps', 'etp', 'master']
rows = collections.OrderedDict()
for r in A['routes']:
    rows.setdefault(r['route'], []).append(r)
out = []
GORDER = ['home','week','week-past','day','history','history-week','report','hearing','learn','reading','songs','song','songs-empty','wall','share','share-with-me','shared','shared-week','group','account','change-password','notfound',
 'card','scoreboards','my-devotees','my-devotees-student','my-devotees-week','explorer','fac-team',
 'batch','members','members-empty','requests','requests-reopen','stats','leaders','board','ready','students','closing','newbatch','leaderboard','devotee','devotee-week','fill-week','fill-day',
 'overview','analysis','reports','coordinators','access','facilitators','phases','batches','ids','activity','settings','welcome','login','signup','forgot']
assert set(rows) <= set(GORDER), set(rows) - set(GORDER)
for route, rs in sorted(rows.items(), key=lambda kv: GORDER.index(kv[0])):
    rs.sort(key=lambda r: ORDER.index(r['role']))
    for r in rs:
        m = M.get(route, '—'); m = m.get(r['role'], '—') if isinstance(m, dict) else m
        ov = sum(1 for o in r['overlaps'] if o['o']['kind'] in ('text/text', 'control/text'))
        cl = len(r['clipped'])
        sm = (r['small'].get('390l') or {}).get('n', 0)
        col = r['column'].get('1440l'); use = f"{col['usedPctOfAvail']}%" if col else '—'
        dx = r['title'].get('1440l', {}).get('dx'); dx = '—' if dx is None else f"{dx:+d}"
        out.append(f"| `{r['hash'].split('?')[0] if len(r['hash'])<34 else r['hash'][:30]+'…'}` | {r['role']} | {m} | {ov} | {cl} | {sm} | {use} | {dx} | `{route}-{r['role']}-<w>-<theme>.png` |")
print('\n'.join(out)); print(len(out))
