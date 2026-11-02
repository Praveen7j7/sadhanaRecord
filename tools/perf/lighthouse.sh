#!/bin/sh
# Low-end phone check: Lighthouse's mobile profile (Moto G class, 4× slower CPU, slow 4G).
#   sh tools/perf/lighthouse.sh [url ...]   (default: the live welcome and sign-in pages)
# Uses the lighthouse installed in frontend/node_modules (no download).
cd "$(dirname "$0")/../../frontend" || exit 1
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ $# -eq 0 ] && set -- "https://sadhana-record.iyfdelhi-sadhana.workers.dev/#/welcome" "https://sadhana-record.iyfdelhi-sadhana.workers.dev/#/login"
for u in "$@"; do
  npx --no-install lighthouse "$u" --quiet --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices --output=json --output-path=/tmp/lh.json >/dev/null 2>&1
  node -e "const j=require('/tmp/lh.json'),a=j.audits;console.log(process.argv[1],Object.fromEntries(Object.entries(j.categories).map(([k,v])=>[k,Math.round(v.score*100)])),'FCP',a['first-contentful-paint'].displayValue,'LCP',a['largest-contentful-paint'].displayValue,'TBT',a['total-blocking-time'].displayValue,'CLS',a['cumulative-layout-shift'].displayValue,a['total-byte-weight'].displayValue)" "$u"
done
