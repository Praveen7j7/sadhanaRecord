// The month scorecard (ADR 0012 D, the head, 22 Oct 2026): after a month closes, one row per person —
//
//   sadhana  the average of their weekly Sadhna in that month
//   seva     the weekly lead measures of the month's weeks, and the four monthly ones once, averaged together
//   goal     their own students eligible for promotion, counted from the start of their window to the month's last week
//   net      (sadhana + seva + goal) / 3 — the dashboard's rule, with its "not set" handling (netScore)
//
// A month nobody filled reads "not filled" (null), never 0: a gap in reporting is not a score. Only months that have
// ENDED are listed — a month still running would read as everybody failing it.
//
// Built only from what phases.js already exports, so the speed lane's work on phases.js stays theirs.
import { apiError } from './util.js';
import { one, all } from './db.js';
import { isoIst } from './util.js';
import { cardFor, cardWindow, measures, weekPct, monthPct, sadhanaPct, stagesOf, netScore } from './phases.js';

const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
/** The Monday of the last week that starts in the month. */
const lastMonday = (ym) => { const d = new Date(lastDay(ym) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const monthsBetween = (from, to) => {
  const out = []; let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
};
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Who may read whose: their own; the head anyone; a training's coordinator their own trainees (as card.of). */
async function mayRead(db, ctx, login) {
  if (login === ctx.login || ctx.scopes.master) return;
  const mine = await one(db, `SELECT 1 AS x FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
                               WHERE e.login = ? AND e.state = 'ACTIVE' AND b.level = 'ETP'
                                 AND ',' || replace(b.coordinator_logins, ' ', '') || ',' LIKE '%,' || ? || ',%'`, login, ctx.login);
  if (!mine) throw apiError('FORBIDDEN', 'You can read your own month scorecard, or a trainee of a training you coordinate.');
}

export async function cardMonths(d, ctx) {
  const db = ctx.db, login = String(d.login || ctx.login);
  await mayRead(db, ctx, login);
  const today = isoIst(ctx.now()).slice(0, 10);
  // their card: a trainee's training's, over its own dates (its months run from its start to its end); a facilitator's
  // the phase's (Phase 22, J1 — two routes)
  const phase = await cardFor(db, login, String(d.phaseId || ''), today);
  if (!phase) throw apiError('NOT_FOUND', 'No phase is open.');
  const win = await cardWindow(db, login, phase);
  const [ms, tg, fl] = await Promise.all([measures(db),
    all(db, 'SELECT measure_id, target, per_level FROM targets WHERE phase_id = ? AND login = ?', phase.phase_id, login),
    all(db, 'SELECT measure_id, value, source, week_id FROM fills WHERE phase_id = ? AND login = ?', phase.phase_id, login)]);
  const T = Object.fromEntries(tg.map(t => [t.measure_id, t]));
  const byWeek = {};
  for (const f of fl) (byWeek[f.week_id] ||= {})[f.measure_id] = f;
  const weeklyIds = new Set(ms.filter(m => m.frequency !== 'MONTHLY' && m.source !== 'week_score').map(m => m.measure_id));

  const months = [];
  for (const ym of monthsBetween(win.from, win.to)) {
    if (lastDay(ym) >= today) break;                                   // not ended yet
    const weeks = Object.keys(byWeek).filter(w => w.slice(0, 7) === ym).sort();
    const fills = weeks.map(w => byWeek[w]);
    const weekly = weeks.filter(w => Object.keys(byWeek[w]).some(id => weeklyIds.has(id)))
      .map(w => weekPct(ms, T, byWeek[w])).filter(x => x !== null);
    const month = weeks.length ? monthPct(ms, T, fills) : null;
    const seva = weeks.length ? avg([...weekly, ...(month === null ? [] : [month])]) : null;
    const sadhana = weeks.length ? sadhanaPct(ms, fills) : null;
    const st = await stagesOf(db, login, phase.phase_id, lastMonday(ym));
    const goal = st?.goalPct ?? null;
    months.push({ month: ym, filled: weeks.length, sadhana, seva, goal,
                  net: weeks.length ? netScore({ sadhana, seva, goal }).score : null });
  }
  return { phaseId: phase.phase_id, name: phase.name, from: win.from, to: win.to, trainee: win.kind === 'batch', months };
}
