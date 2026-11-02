#!/usr/bin/env python3
# Per route × role: the visible controls (light, 390 + 1440) and whether tools/browser/verify.mjs names them.
# "Named" = its id (#id or 'id'), its exact label text, its href, or its first class as a selector appears in verify.mjs.
# A name in the file is evidence of a check, not proof of a click; an unnamed control is "unverified".
import json, glob, re, collections
ROOT = '/private/tmp/claude-501/-Users-maclapctp409-Downloads-hpStuff-prompt/bfb96117-1af2-4f66-95d5-4bbb86028c04/scratchpad/visual-audit'
V = open('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/tools/browser/verify.mjs').read()
SHELL_CLS = re.compile(r'^(mi|skip|brand|menu-btn|bell|mprofile)')
def shell(c):
    return c['layer'].startswith('nav') or c['layer'].startswith('header.topbar') or c['cls'].startswith(('mi', 'skip', 'brand', 'mprofile')) or c['label'] in ('Open menu', 'Skip to content', 'Back', 'Go to a screen or devotee') or c['label'].startswith('Announcements')
DYN = re.compile(r'\d{3,}|\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|IYFD-|@')
def covered(c):
    if c['id'] and (('#' + c['id']) in V or ("'" + c['id'] + "'") in V or ('"' + c['id'] + '"') in V): return 'id'
    h = c['href']
    if h and h.startswith('#/') and (h.split('?')[0] in V): return 'href'
    lab = c['label'].strip()
    if lab and len(lab) >= 3 and not DYN.search(lab):
        core = re.sub(r'[^\w ]', '', lab).strip()
        if lab in V or (len(core) >= 4 and core in V): return 'label'
        # a regex in verify like /^Save/ or /Add/ : first word of 4+ letters
        w = re.match(r'[A-Za-z]{4,}', lab)
        if w and re.search(r'/\^?' + re.escape(w.group(0)), V): return 'label~'
    first = c['cls'].split('.')[0] if c['cls'] else ''
    if first and len(first) > 2 and re.search(r'\.' + re.escape(first) + r'(?![\w-])', V): return 'class'
    return ''
routes = collections.OrderedDict()
shell_ctrls = {}
for f in sorted(glob.glob(ROOT + '/data/sweep/*-light.json')):
    r = json.load(open(f))
    if r.get('state') or r['width'] not in (390, 1440): continue
    s = r.get('sweep') or {}
    for c in s.get('controls', []) or []:
        if shell(c):
            shell_ctrls.setdefault((c['label'][:40], c['href'].split('?')[0]), c); continue
        k = (r['route'], r['role'])
        d = routes.setdefault(k, {})
        ck = (c['tag'], c['label'][:50], c['id'], c['href'].split('?')[0] if not DYN.search(c['href']) else re.sub(r'\d{4}-\d\d-\d\d|\d{6,}', 'X', c['href']))
        if ck not in d: d[ck] = dict(c, at=[r['width']])
        elif r['width'] not in d[ck]['at']: d[ck]['at'].append(r['width'])
out = []
tot = collections.Counter()
for (route, role), d in routes.items():
    items = []
    # collapse data rows (names/dates) by class: one line per row kind
    rows = collections.defaultdict(list)
    for c in d.values():
        if DYN.search(c['label']) or DYN.search(c['href']):
            rows[(c['tag'], c['cls'])].append(c); continue
        cov = covered(c); tot['covered' if cov else 'unverified'] += 1
        items.append({'tag': c['tag'], 'type': c['type'], 'label': c['label'], 'id': c['id'], 'href': c['href'], 'cls': c['cls'], 'at': c['at'], 'cov': cov})
    for (tag, cl), cs in rows.items():
        cov = covered(cs[0]); tot['covered' if cov else 'unverified'] += 1
        items.append({'tag': tag, 'type': cs[0]['type'], 'label': f"{len(cs)} data rows e.g. '{cs[0]['label'][:30]}'", 'id': '', 'href': cs[0]['href'], 'cls': cl, 'at': cs[0]['at'], 'cov': cov})
    out.append({'route': route, 'role': role, 'controls': items})
sh = [{'label': k[0], 'href': k[1], 'cov': covered(c)} for k, c in shell_ctrls.items()]
json.dump({'routes': out, 'shell': sh, 'totals': tot}, open(ROOT + '/data/wiring.json', 'w'), indent=1)
L = [f"TOTALS {dict(tot)}"]
for r in out:
    un = [c for c in r['controls'] if not c['cov']]
    L.append(f"\n## {r['route']} / {r['role']}: {len(r['controls'])} controls, {len(un)} unverified")
    for c in r['controls']:
        L.append(f"  {'OK ' + c['cov'] if c['cov'] else 'UNVERIFIED'} | {c['tag']}{('#' + c['id']) if c['id'] else ''}.{c['cls']} '{c['label'][:50]}' {c['href'][:40]} @{c['at']}")
L.append('\n## SHELL'); [L.append(f"  {'OK ' + c['cov'] if c['cov'] else 'UNVERIFIED'} '{c['label']}' {c['href']}") for c in sh]
open(ROOT + '/data/wiring.txt', 'w').write('\n'.join(L))
print(dict(tot))
