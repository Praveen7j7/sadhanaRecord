#!/usr/bin/env python3
"""Run one read query against the Sadhana Record database and save the result as CSV.

    export CLOUDFLARE_API_TOKEN=...   CLOUDFLARE_ACCOUNT_ID=...
    python3 d1_to_csv.py r02_period_by_batch.sql out.csv
    python3 d1_to_csv.py r02_period_by_batch.sql out.csv 2026-09-01 2026-12-31   # fills ?1, ?2 … in the SQL

Standard library only. SELECT queries only: anything else is refused here before it is sent.
"""
import csv, json, os, sys, urllib.request

DB = "8b771fe4-abfd-4bd8-9a50-dfc1ae1b739a"

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sql = "\n".join(l for l in open(sys.argv[1], encoding="utf-8").read().splitlines() if not l.lstrip().startswith("--")).strip().rstrip(";")
    first = sql.split(None, 1)[0].upper() if sql else ""
    if first not in ("SELECT", "WITH") or ";" in sql:
        sys.exit("Only one SELECT (or WITH … SELECT) query per file.")
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first.")
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql, "params": sys.argv[3:]}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Cloudflare refused the query ({e.code}): {e.read().decode()[:500]}")
    res = body["result"][0]
    rows = res["results"]
    with open(sys.argv[2], "w", newline="", encoding="utf-8") as f:
        if rows:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    print(f"{len(rows)} rows → {sys.argv[2]}  (rows read: {res['meta'].get('rows_read')})")

if __name__ == "__main__":
    main()
