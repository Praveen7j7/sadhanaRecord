# Joins the client log (loadtest/out/<phase>.jsonl) with the tail (CPU per call) → a per-action table.
import json, sys, statistics as st
phase = sys.argv[1]
calls = [json.loads(l) for l in open(f'loadtest/out/{phase}.jsonl') if l.strip() and '"action"' in l]
raw = open(f'loadtest/out/tail-{phase}.jsonl').read()
dec = json.JSONDecoder(); i = 0; evs = []
while True:
    s = raw[i:]; t = s.lstrip()
    if not t: break
    try: o, n = dec.raw_decode(t)
    except Exception: break
    evs.append(o); i += (len(s) - len(t)) + n
cpu = {}; outcomes = {}
for e in evs:
    msg = next((l['message'][0] for l in e.get('logs', []) if isinstance(l.get('message'), list) and str(l['message'][0]).startswith('{"load"')), None)
    if not msg: continue
    a = json.loads(msg)['action']
    cpu.setdefault(a, []).append(e.get('cpuTime') or 0)
    outcomes.setdefault(a, {}).setdefault(e.get('outcome'), 0); outcomes[a][e.get('outcome')] += 1
def pct(xs, p): xs = sorted(xs); return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))] if xs else None
by = {}
for c in calls: by.setdefault(c['action'], []).append(c)
rows = []
print(f"{'action':22} {'n':>4} {'ok%':>5} {'p50ms':>6} {'p95ms':>6} {'cpu50':>6} {'cpu95':>6} {'cpuMax':>6} {'q':>4} {'read':>6} {'write':>6}  outcomes")
for a, cs in by.items():
    ms = [c['ms'] for c in cs]; okp = 100 * sum(c['ok'] for c in cs) / len(cs)
    q = st.mean([c.get('queries', 0) for c in cs]); rd = st.mean([c.get('rowsRead', 0) for c in cs]); wr = st.mean([c.get('rowsWritten', 0) for c in cs])
    cp = cpu.get(a, [])
    codes = {}
    for c in cs:
        if not c['ok']: codes[c['code']] = codes.get(c['code'], 0) + 1
    r = dict(action=a, n=len(cs), okPct=round(okp, 1), p50=pct(ms, 50), p95=pct(ms, 95), cpu50=pct(cp, 50), cpu95=pct(cp, 95), cpuMax=max(cp) if cp else None,
             queries=round(q, 1), rowsRead=round(rd, 1), rowsWritten=round(wr, 1), errors=codes, outcomes=outcomes.get(a, {}))
    rows.append(r)
    print(f"{a:22} {len(cs):4} {okp:5.0f} {r['p50']:6} {r['p95']:6} {str(r['cpu50']):>6} {str(r['cpu95']):>6} {str(r['cpuMax']):>6} {q:4.0f} {rd:6.0f} {wr:6.1f}  {outcomes.get(a, {})} {codes or ''}")
json.dump(rows, open(f'loadtest/out/summary-{phase}.json', 'w'), indent=1)
