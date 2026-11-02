# Load test (phase 6)

Runs against a **separate** Worker and database, never the live ones: `sadhana-record-api-load` + D1 `sadhana-load`
(`worker/wrangler.toml` › `[env.load]`). That Worker has no Google key and no notification key, so it never writes the
real Sheets or messages anyone. `LOAD_METER=1` makes it report each call's D1 rows (`x-meter` header and a log line);
`LOAD_CLOCK_SKEW_MS` shifts its clock only (Sunday submit, Monday deadline). Report: `docs/load-test-report.md`.

    cd worker && npx wrangler deploy --env load
    npx wrangler d1 migrations apply sadhana-load --env load --remote
    cd .. && node loadtest/seed.mjs "$(cat loadtest/out/.pepper)"      # 2,000 devotees, coordinators, master, sessions
    cd worker && npx wrangler d1 execute sadhana-load --env load --remote --file ../loadtest/out/seed.sql -y && cd ..
    sh loadtest/with-tail.sh profile N=12          # each action alone (records CPU from wrangler tail)
    sh loadtest/with-tail.sh ramp STEPS=10,20,40,80 SECS=20
    node loadtest/run.mjs devices                  # 5 phones on the same day
    # Sunday: set LOAD_CLOCK_SKEW_MS in [env.load.vars] to reach Sunday 7 PM IST, deploy, then
    SKEW_MS=<same> node loadtest/run.mjs fill && sh loadtest/with-tail.sh submit SKEW_MS=<same>
    # Monday deadline: skew to Monday 9:02 PM IST and crons = ["* * * * *"] in [env.load.triggers]; switch both back after
    python3 loadtest/analyze.py profile ; python3 loadtest/steps.py ramp

Budget: the free plan's daily limits are per account (shared with the live app): keep a run under ~30,000 calls and
~50,000 rows written, and run it early in the IST day (limits reset 5:30 AM IST). `loadtest/out/` is not in git.
Delete when no longer needed: `npx wrangler delete --env load` and `npx wrangler d1 delete sadhana-load`.

Since 3 Oct 2026 (later): the database copies changes to Sheets through triggers (migration 0018). The load database
has them too, but the load Worker never runs the copy, so `mirror_changes` simply fills up there — harmless; clear it with
`DELETE FROM mirror_changes` before measuring the copy. The live API has two extra evening schedules for the 9 PM
reminder parts (`wrangler.toml` › `[triggers]`); the load Worker has none unless switched on for the deadline test.
Rows written per action (measured, with triggers): save 2 (first save of a week 6), week-end 2, own attendance 3,
submit 6, coordinator attendance 1 per mark (+1 per call).
