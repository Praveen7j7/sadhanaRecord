#!/bin/sh
# usage: sh loadtest/with-tail.sh <phase> [env vars...] — records CPU time per call while a phase runs
P=$1; shift
cd "$(dirname "$0")/../worker"
npx wrangler tail --env load --format json > ../loadtest/out/tail-$P.jsonl 2>/dev/null &
TP=$!
sleep 25
cd .. && env "$@" node loadtest/run.mjs $P
sleep 20
kill $TP 2>/dev/null; pkill -f "wrangler tail --env load" 2>/dev/null
echo "tail bytes: $(wc -c < loadtest/out/tail-$P.jsonl)"
