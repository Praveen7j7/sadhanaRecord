#!/bin/sh
# Weekly backup of the Sadhana Record database (roadmap phase 0.2).
#
# Why this exists: D1 Time Travel only reaches back 7 days on the free plan, so a problem
# noticed on day 8 is unrecoverable without a file. The runbook asked for a weekly export by
# hand (docs/backup-restore.md); the 12 Oct audit found it was not happening (no backup folder
# on the machine), so it is a script now.
#
# Run it from anywhere, as the Cloudflare account owner:
#     sh sadhanaRecord/tools/ops/export.sh
#
# It writes ~/Documents/sadhana-backups/sadhana-YYYY-MM-DD.sql, keeps the last 8 weekly files
# plus the first file of each month, prints what it kept, and never touches the database.
# Reads every row once: under 1 % of the free plan's daily read budget at 5,000 devotees.
#
# To restore, see docs/backup-restore.md (Time Travel first; this file is for a total loss).

set -eu

DIR="${SADHANA_BACKUP_DIR:-$HOME/Documents/sadhana-backups}"
DB="${SADHANA_DB:-sadhana}"
WORKER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../../worker" && pwd)"
DAY="$(date +%F)"
OUT="$DIR/sadhana-$DAY.sql"

mkdir -p "$DIR"

if [ -f "$OUT" ]; then
  echo "A backup for $DAY already exists: $OUT"
  echo "Delete it first if you want to take another one today."
  exit 0
fi

echo "Exporting D1 database '$DB' → $OUT"
cd "$WORKER_DIR"
# --remote: the live database, never the local one. Writes nothing.
npx wrangler d1 export "$DB" --remote --output "$OUT"

if [ ! -s "$OUT" ]; then
  echo "FAILED: the export file is empty. Nothing was deleted; fix the error above and re-run." >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
ROWS="$(grep -c '^INSERT INTO' "$OUT" || true)"
echo "Done: $SIZE, $ROWS INSERT statements."
echo
echo "The file holds phone numbers, dates of birth and addresses (never passwords or"
echo "session tokens). Keep the folder private; do not put it in git or a shared drive."

# ---- retention: the last 8 weekly files, plus the first file of every month ----
# Files are named sadhana-YYYY-MM-DD.sql, so sorting by name sorts by date.
KEEP_RECENT=8
ALL="$(ls -1 "$DIR"/sadhana-*.sql 2>/dev/null | sort)"
TOTAL="$(printf '%s\n' "$ALL" | grep -c . || true)"
if [ "$TOTAL" -gt "$KEEP_RECENT" ]; then
  RECENT="$(printf '%s\n' "$ALL" | tail -n "$KEEP_RECENT")"
  # one keeper per month: the earliest file of each YYYY-MM
  MONTHLY="$(printf '%s\n' "$ALL" | awk -F'sadhana-' '{split($2,d,"-"); m=d[1]"-"d[2]; if (!(m in seen)) {seen[m]=1; print $0}}')"
  REMOVED=0
  printf '%s\n' "$ALL" | while IFS= read -r f; do
    [ -n "$f" ] || continue
    if printf '%s\n' "$RECENT" | grep -qxF "$f"; then continue; fi
    if printf '%s\n' "$MONTHLY" | grep -qxF "$f"; then continue; fi
    rm -f "$f"
    echo "removed old backup: $(basename "$f")"
    REMOVED=$((REMOVED + 1))
  done
fi

echo
echo "Backups in $DIR:"
ls -1sh "$DIR"/sadhana-*.sql | sed 's/^/  /'
echo
echo "Next: drill a restore once a quarter into the load database, not the live one:"
echo "  npx wrangler d1 create sadhana-restore-test"
echo "  npx wrangler d1 execute sadhana-restore-test --remote --file <this file>"
