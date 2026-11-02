# Ramp results per step: achieved rate, latency, errors, CPU (from the tail), outcomes.
import json, sys
phase = sys.argv[1] if len(sys.argv) > 1 else 'ramp'
lines = [json.loads(l) for l in open(f'loadtest/out/{phase}.jsonl') if l.strip()]
steps = [l for l in lines if 'step' in l]; calls = [l for l in lines if 'action' in l]
raw = open(f'loadtest/out/tail-{phase}.jsonl').read(); dec = json.JSONDecoder(); i = 0; evs = []
while True:
    s = raw[i:]; t = s.lstrip()
    if not t: break
    try: o, n = dec.raw_decode(t)
    except Exception: break
    evs.append(o); i += (len(s) - len(t)) + n
def pct(xs, p): xs = sorted(xs); return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))] if xs else None
out = []
print(f"{'rate':>5} {'calls':>6} {'done/s':>7} {'ok%':>6} {'p50':>6} {'p95':>6} {'p99':>6} {'cpu50':>6} {'cpu95':>6} {'cpu99':>6} {'tailN':>6}  outcomes / errors")
for st in steps:
    cs = [c for c in calls if st['from'] <= c['at'] <= st['to'] + 1]
    ev = [e for e in evs if st['from'] <= e.get('eventTimestamp', 0) <= st['to'] + 1]
    cpu = [e.get('cpuTime') or 0 for e in ev]
    oc = {}
    for e in ev: oc[e.get('outcome')] = oc.get(e.get('outcome'), 0) + 1
    errs = {}
    for c in cs:
        if not c['ok']: errs[c['code']] = errs.get(c['code'], 0) + 1
    ms = [c['ms'] for c in cs]; dur = (st['to'] - st['from']) / 1000
    r = dict(rate=st['step'], calls=len(cs), perSec=round(len(cs) / dur, 1), okPct=round(100 * sum(c['ok'] for c in cs) / max(1, len(cs)), 2),
             p50=pct(ms, 50), p95=pct(ms, 95), p99=pct(ms, 99), cpu50=pct(cpu, 50), cpu95=pct(cpu, 95), cpu99=pct(cpu, 99), tailEvents=len(ev), outcomes=oc, errors=errs)
    out.append(r)
    print(f"{r['rate']:5} {r['calls']:6} {r['perSec']:7} {r['okPct']:6} {r['p50']:6} {r['p95']:6} {r['p99']:6} {str(r['cpu50']):>6} {str(r['cpu95']):>6} {str(r['cpu99']):>6} {r['tailEvents']:6}  {oc} {errs or ''}")
json.dump(out, open(f'loadtest/out/steps-{phase}.json', 'w'), indent=1)
