// Load-test meter (phase 6). Active ONLY when the Worker runs with LOAD_METER = "1", i.e. the separate
// sadhana-record-api-load Worker and its own sadhana-load database (wrangler.toml [env.load]); the live API never
// sets it. It counts D1 queries and the rows each one read and wrote (D1's own meta), so the load report can show
// what every action costs against the Free plan's daily D1 limits. LOAD_CLOCK_SKEW_MS shifts the server clock in that
// Worker only, so the Sunday submit window and the Monday deadline can be tested on any day.
export function meterDb(db) {
  const m = { queries: 0, rowsRead: 0, rowsWritten: 0 };
  const add = (meta) => { if (meta) { m.rowsRead += meta.rows_read || 0; m.rowsWritten += meta.rows_written || 0; } };
  const wrap = (s) => ({
    __s: s,
    bind: (...a) => wrap(s.bind(...a)),
    async first(col) { m.queries++; const r = await s.all(); add(r.meta); const row = r.results[0]; return row === undefined ? null : col ? row[col] : row; },
    async all() { m.queries++; const r = await s.all(); add(r.meta); return r; },
    async run() { m.queries++; const r = await s.run(); add(r.meta); return r; },
    async raw(o) { m.queries++; return s.raw(o); }
  });
  return {
    m,
    db: {
      prepare: (sql) => wrap(db.prepare(sql)),
      async batch(list) { m.queries += list.length; const rs = await db.batch(list.map((x) => x.__s || x)); rs.forEach((r) => add(r.meta)); return rs; },
      exec: (sql) => db.exec(sql)
    }
  };
}
export const skewOf = (env) => Number(env.LOAD_CLOCK_SKEW_MS || 0) || 0;
