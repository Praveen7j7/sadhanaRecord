// The target card in the mock (the head, 17 Oct 2026): phases, the eleven measures, a person's own
// targets and what they filled.
//
// It mirrors worker/src/phases.js rather than approximating it. The browser checks run against this
// file, so a mock that answers differently from the server makes those checks agree with each other
// and disagree with the app — which is how the class-day change reached the server and missed the
// mock on 16 October.
import { mondayOf, nowD, ymd, isoIst, validWeekId, closesOf } from './mockweeks.js';

/* The eleven lead measures, as migration 0052 seeds them. `etpLabel` is the one slot said
   differently to a trainee: a facilitator reports FTP training attendance, a trainee ETP. */
const MEASURES = [
  { measureId: 'sadhna',     seq: 0, group: 'sadhana',  label: 'Sadhna',                                            frequency: 'WEEKLY',  kind: 'NUMBER',    unit: 'score',    fromApp: true },
  { measureId: 'stall',      seq: 1, group: 'vl2reg',  label: 'Stall preaching',                                   frequency: 'WEEKLY',  kind: 'NUMBER',    unit: 'hours',    fromApp: false },
  { measureId: 'calls',      seq: 2, group: 'vl2reg',  label: 'Calling the new students',                          frequency: 'WEEKLY',  kind: 'NUMBER',    unit: 'calls',    fromApp: false },
  { measureId: 'vl1att',     seq: 3, group: 'vl2reg',  label: 'Sunday VL-1 facilitation attendance',               frequency: 'WEEKLY',  kind: 'YESNO',     unit: '',         fromApp: false },
  { measureId: 'vl23att',    seq: 4, group: 'vl2reg',  label: 'Sunday VL-2 / VL-3 facilitation attendance',        frequency: 'WEEKLY',  kind: 'YESNO',     unit: '',         fromApp: false },
  { measureId: 'oneToOne',   seq: 5, group: 'target',  label: 'One-to-one meetings with devotees',                 frequency: 'WEEKLY',  kind: 'PER_LEVEL', unit: 'students', fromApp: false },
  { measureId: 'ftp',        seq: 6, group: 'target',  label: 'FTP training attendance',                           frequency: 'WEEKLY',  kind: 'YESNO',     unit: '',         fromApp: false, etpLabel: 'ETP attendance' },
  { measureId: 'seniorMeet', seq: 7, group: 'target',  label: 'Meeting the senior facilitator about students',     frequency: 'MONTHLY', kind: 'NUMBER',    unit: 'meetings', fromApp: false },
  { measureId: 'seriousOne', seq: 8, group: 'target',  label: 'Serious students taken one-to-one with the senior', frequency: 'MONTHLY', kind: 'NUMBER',    unit: 'students', fromApp: false },
  { measureId: 'allMeet',    seq: 9, group: 'target',  label: 'All-students meeting with the senior facilitator',  frequency: 'MONTHLY', kind: 'NUMBER',    unit: 'meetings', fromApp: false },
  { measureId: 'journal',    seq: 10, group: 'target', label: 'Facilitation journal updated',                      frequency: 'MONTHLY', kind: 'YESNO',     unit: '',         fromApp: false }
];

export function installCard(A, h) {
  const ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'], MASTER = ['MASTER'];
  const phases = [{ phaseId: 'kartik-2026', name: 'Kartik Phase', seasonYear: 2026,
                    startsOn: '2026-09-01', endsOn: '2026-12-31', targetsUntil: '', state: 'OPEN', openedBy: 'master', closedAt: '' }];
  const targets = new Map();   // login -> { measureId: target }
  // ADR 0018 (phase 21): the head's openings of a person's fixed targets, login -> until
  const targetUnlocks = new Map();
  const plusDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  // as the server's targetsLock: a set target may change until the phase's date, else the end of their first week on
  // the card (a trainee's starts with their training); after it only while the head has opened them
  // (a trainee's card is the training's — cardPhase — whose `targetsUntil` is '' and whose start is the training's)
  const lockOf = (u, p) => {
    const until = p.targetsUntil || plusDays(windowOf(u, p).from, 6), at = isoIst(nowD()), un = targetUnlocks.get(u.login) || '';
    const openedUntil = un && un >= at ? un : '';
    return { until, open: at.slice(0, 10) <= until || !!openedUntil, openedUntil };
  };
  const lockedMsg = (p, lk) => `Your targets for ${p.name} were fixed after ${lk.until}. Ask the IYF head to open them if one must change.`;
  const fills = new Map();     // login|weekId -> { measureId: { value, source } }
  const k = (l, w) => l + '|' + w;

  // as the server's currentPhase: the OPEN phase covering today, the latest start first — not merely the first open one,
  // or adding next year's phase from Admin would move every card onto it at once
  const open = () => { const t = isoIst(nowD()).slice(0, 10);
    return phases.filter((p) => p.state === 'OPEN' && p.startsOn <= t && p.endsOn >= t).sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0] || null; };
  /* A trainee is somebody ENROLLED in a training, exactly as the server reads it — not somebody
     whose own batch is one. The mock used to decide from the batch, so nobody was ever a trainee
     here and the whole student side went unchecked (18 Oct 2026). */
  const isTrainee = (u) => [...enrolled.entries()].some(([b, set]) => isTraining(b) && set.has(u.login));
  const trainingOf = (u) => [...enrolled.entries()].find(([b, set]) => isTraining(b) && set.has(u.login))?.[0] || '';
  /*
   * Two routes (Phase 22, J1; the head, 26 Oct 2026), as the server's phases.js cardFor / trainingCard: a TRAINEE's card is
   * the TRAINING's — keyed by its batch id, over its own dates (start → end date, or the day it was ended if earlier; with
   * no end date, today), never a phase's; a FACILITATOR's is the phase's.
   */
  const trainingCardOf = (b) => {
    const today = isoIst(nowD()).slice(0, 10), ended = b.closedAt ? b.closedAt.slice(0, 10) : '';
    const to = ended ? (b.endsOn && b.endsOn < ended ? b.endsOn : ended) : b.endsOn || today;
    return { phaseId: b.batchId, name: b.name, seasonYear: 0, startsOn: b.startedOn, endsOn: to, targetsUntil: '', state: 'OPEN', training: true, closed: !!b.closedAt, plannedEnd: b.endsOn || '' };
  };
  const trainingBatch = (id) => (h.batches?.() || []).find((b) => b.batchId === id && b.startedOn);
  /** The card a person keeps: a training they were in that `key` names; their training's (running, or finished and not
   *  facilitating in their own right — then a frozen record); else the phase named; else the open one. */
  const cardPhase = (u, key = '') => {
    if (!u) return null;
    const fin = (finished.get(u.login) || [])[0];
    const was = key && (trainingOf(u) === key || (finished.get(u.login) || []).some((x) => x.batchId === key)) ? trainingBatch(key) : null;
    if (was) return trainingCardOf(was);
    const tb = isTrainee(u) ? trainingBatch(trainingOf(u)) : fin && u.facilitation !== 'lasting' ? trainingBatch(fin.batchId) : null;
    if (tb) return trainingCardOf(tb);
    return key ? phases.find((x) => x.phaseId === key) || null : open();
  };
  const windowOf = (u, p) => (p.training ? { from: p.startsOn, to: p.endsOn, closed: p.closed, trainee: true }
    : { from: p.startsOn, to: p.endsOn, closed: false, trainee: false });

  const cardFor = (u, weekId, key = '') => {
    const p = cardPhase(u, key); if (!p) return null;
    const t = targets.get(u.login) || {};
    const f = fills.get(k(u.login, weekId)) || {};
    const weeks = [...fills.keys()].filter((x) => x.startsWith(u.login + '|')).map((x) => x.split('|')[1]).sort();
    const trainee = isTrainee(u);
    // what the app offers for Sadhna: their own submitted week, when there is one
    // the LAST submitted week, as the server does — a card is filled during a week not yet submitted
    const offered = h.weekScoreOf ? h.weekScoreOf(u.login, weekId) : null;
    const fig = figures(u.login, weekId);
    // a monthly measure's month so far (phases.js cardFrom): numbers added up over the month's weeks, a Yes/No if any
    const monthValue = (m) => {
      const vs = weeks.filter((w) => w.slice(0, 7) === String(weekId).slice(0, 7)).map((w) => fills.get(k(u.login, w))?.[m.measureId]?.value).filter((v) => v !== undefined && v !== '');
      if (!vs.length) return '';
      return m.kind === 'YESNO' ? (vs.includes('YES') ? 'YES' : 'NO') : String(vs.reduce((n, v) => n + (Number(v) || 0), 0));
    };
    return {
      phaseId: p.phaseId, name: p.name, state: p.state, startsOn: p.startsOn, endsOn: p.endsOn,
      trainee, hasCard: trainee || !!u.facilitatorName || u.role === 'MASTER',
      batchId: trainee ? trainingOf(u) : '', closed: windowOf(u, p).closed,
      from: windowOf(u, p).from, to: windowOf(u, p).to, weekId, filledWeeks: weeks, groups: GROUPS,
      measures: MEASURES.map((m) => ({ ...m, label: trainee && m.etpLabel ? m.etpLabel : m.label,
        target: t[m.measureId] ?? '', perLevel: null,
        value: f[m.measureId]?.value ?? '', source: f[m.measureId]?.source ?? '',
        offered: m.fromApp ? offered : null, offeredWeek: m.fromApp ? weekId : '',
        ...(m.frequency === 'MONTHLY' ? { monthValue: monthValue(m) } : {}) })),
      targets: lockOf(u, p),
      phase: { average: fig.seva, seva: fig.seva, sadhana: fig.sadhana, months: fig.months,
               filled: fig.filled, weeks: 17, from: p.startsOn, to: p.endsOn, period: p.training ? 'batch' : 'phase', trend: fig.trend },
      score: (() => { const st = stagesFor(u.login);
        // `ready`: the students behind the goal, by name — the mock has no eligibility to count, so none
        return { ...netOf(fig.sadhana, fig.seva, st.goalPct), stages: st.stages, ready: [], goalPct: st.goalPct,
                 totalTarget: st.totalTarget, totalAchieved: st.totalAchieved, totalPromoted: st.totalPromoted }; })()
    };
  };

  /* The same maths as the server: a number capped at its target, a Yes/No all or nothing, and a
     measure with NO TARGET left out rather than scored zero — somebody not asked to do a thing must
     not be failed for it. */
  const GROUPS = [{ id: 'sadhana', label: 'Sadhna' }, { id: 'vl2reg', label: 'Vedic Level 2 registration' }, { id: 'target', label: 'Target' }];
  const isWeekly = (m) => m.frequency !== 'MONTHLY' && !m.fromApp;
  /* As the server (phases.js, ADR 0012): a week's seva is the WEEKLY lead measures only — Sadhna is sadhana, and the
     monthly four count once a month. */
  function weekPct(t, f) {
    const parts = [];
    for (const m of MEASURES) {
      if (!isWeekly(m)) continue;
      const target = t[m.measureId];
      if (target === undefined || target === '') continue;
      if (m.kind === 'YESNO') { parts.push(f[m.measureId]?.value === 'YES' ? 100 : 0); continue; }
      const n = Number(target); if (!Number.isFinite(n) || n <= 0) continue;
      parts.push(Math.min(100, Math.round((Number(f[m.measureId]?.value ?? 0) || 0) / n * 100)));
    }
    return parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  }
  function monthPct(t, weekFills) {
    const parts = [];
    for (const m of MEASURES) {
      if (m.frequency !== 'MONTHLY') continue;
      const target = t[m.measureId];
      if (target === undefined || target === '') continue;
      if (m.kind === 'YESNO') { parts.push(weekFills.some((F) => F[m.measureId]?.value === 'YES') ? 100 : 0); continue; }
      const n = Number(target); if (!Number.isFinite(n) || n <= 0) continue;
      const got = weekFills.reduce((a, F) => a + (Number(F[m.measureId]?.value ?? 0) || 0), 0);
      parts.push(Math.min(100, Math.round(got / n * 100)));
    }
    return parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  }
  const avgOf = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const weekEnd = (w) => new Date(Date.parse(w + 'T00:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
  const monthEnd = (ym) => { const [y, mo] = ym.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
  /** sadhana, seva and the closed months for one person, as phaseAverage on the server */
  function figures(login, asOfWeek) {
    const t = targets.get(login) || {};
    const weeks = [...fills.keys()].filter((x) => x.startsWith(login + '|')).map((x) => x.split('|')[1]).sort();
    const F = (w) => fills.get(k(login, w)) || {};
    const weeklyIds = new Set(MEASURES.filter(isWeekly).map((m) => m.measureId));
    const trend = weeks.filter((w) => Object.keys(F(w)).some((id) => weeklyIds.has(id))).map((w) => ({ weekId: w, pct: weekPct(t, F(w)) })).filter((x) => x.pct !== null);
    const perWeek = trend.map((x) => x.pct);
    const asOf = asOfWeek ? weekEnd(asOfWeek) : '9999-12-31';
    const months = [...new Set(weeks.map((w) => w.slice(0, 7)))].sort().filter((ym) => monthEnd(ym) <= asOf)
      .map((ym) => ({ month: ym, pct: monthPct(t, weeks.filter((w) => w.slice(0, 7) === ym).map(F)) })).filter((x) => x.pct !== null);
    const sadhana = avgOf(weeks.filter((w) => F(w).sadhna && F(w).sadhna.value !== '').map((w) => Number(F(w).sadhna.value)).filter(Number.isFinite));
    return { seva: avgOf([...perWeek, ...months.map((x) => x.pct)]), sadhana, months, filled: perWeek.length, trend };
  }

  A['phases.list'] = [ANY, () => h.ok({ phases: [...phases].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1)) })];
  A['phases.open'] = [MASTER, (d) => {
    // the server's checks (phaseOpen), so the Admin form is proven against the same refusals
    const id = String(d.phaseId || '').trim().toLowerCase(), name = String(d.name || '').trim(), ymd = /^\d{4}-\d{2}-\d{2}$/, bad = [];
    if (!/^[a-z][a-z0-9-]{2,31}$/.test(id)) bad.push(['phaseId', 'Letters, digits and hyphens, e.g. kartik-2026.']);
    else if (phases.some((p) => p.phaseId === id)) bad.push(['phaseId', `There is already a phase ${id}.`]);
    if (name.length < 2 || name.length > 40) bad.push(['name', 'Give the phase a name.']);
    if (!ymd.test(d.startsOn || '')) bad.push(['startsOn', 'A date, as 2026-09-01.']);
    if (!ymd.test(d.endsOn || '')) bad.push(['endsOn', 'A date, as 2026-12-31.']);
    if (ymd.test(d.startsOn || '') && ymd.test(d.endsOn || '') && d.endsOn <= d.startsOn) bad.push(['endsOn', 'The phase must end after it starts.']);
    if (bad.length) return h.fieldFail(bad);
    d = { ...d, phaseId: id, name };
    const p = { phaseId: d.phaseId, name: d.name, seasonYear: Number(String(d.startsOn).slice(0, 4)),
                startsOn: d.startsOn, endsOn: d.endsOn, state: 'OPEN', openedBy: 'master', closedAt: '' };
    phases.unshift(p); return h.ok(p);
  }];
  // ADR 0017: the head edits a phase; a closed phase's dates are a record, its name may be corrected
  A['phases.update'] = [MASTER, (d) => {
    const p = phases.find((x) => x.phaseId === d.phaseId);
    if (!p) return h.fail('NOT_FOUND', 'No such phase.');
    const name = String(d.name ?? p.name).trim(), s = String(d.startsOn ?? p.startsOn), e = String(d.endsOn ?? p.endsOn);
    const tu = String(d.targetsUntil ?? p.targetsUntil ?? '');
    const ymd = /^\d{4}-\d{2}-\d{2}$/, bad = [];
    if (tu && !ymd.test(tu)) bad.push(['targetsUntil', 'A date, as 2026-09-07, or leave it empty.']);
    if (name.length < 2 || name.length > 40) bad.push(['name', 'Give the phase a name.']);
    if (!ymd.test(s)) bad.push(['startsOn', 'A date, as 2026-09-01.']);
    if (!ymd.test(e)) bad.push(['endsOn', 'A date, as 2026-12-31.']);
    if (ymd.test(s) && ymd.test(e) && e <= s) bad.push(['endsOn', 'The phase must end after it starts.']);
    if (bad.length) return h.fieldFail(bad);
    if (p.state === 'CLOSED' && (s !== p.startsOn || e !== p.endsOn)) return h.fail('CONFLICT', `${p.name} is closed, so its dates are a record and cannot be moved.`);
    Object.assign(p, { name, startsOn: s, endsOn: e, targetsUntil: tu, seasonYear: Number(s.slice(0, 4)) });
    return h.ok({ phaseId: p.phaseId, name, seasonYear: p.seasonYear, startsOn: s, endsOn: e, targetsUntil: tu, state: p.state });
  }];
  A['phases.close'] = [MASTER, (d) => {
    const p = phases.find((x) => x.phaseId === d.phaseId);
    if (!p) return h.fail('NOT_FOUND', 'No such phase.');
    if (p.state === 'CLOSED') return h.fail('CONFLICT', `${p.name} is closed.`);
    p.state = 'CLOSED'; p.closedAt = isoIst(nowD());
    return h.ok({ phaseId: p.phaseId, state: 'CLOSED', closedAt: p.closedAt });
  }];

  A['card.get'] = [ANY, (d, u) => {
    const weekId = validWeekId(d.weekId) ? d.weekId : mondayOf(nowD());
    const c = cardFor(u, weekId, String(d.phaseId || ''));
    return c ? h.ok(c) : h.fail('NOT_FOUND', 'No phase is open.');
  }];

  A['targets.set'] = [ANY, (d, u) => {
    const p = cardPhase(u, String(d.phaseId || '')); if (!p) return h.fail('NOT_FOUND', 'No such phase.');
    if (p.state !== 'OPEN') return h.fail('CONFLICT', `${p.name} is closed.`);
    if (!Array.isArray(d.targets) || !d.targets.length) return h.fieldFail([['targets', 'Set at least one target.']]);
    const t = { ...(targets.get(u.login) || {}) }, lk = lockOf(u, p);
    for (const [i, x] of d.targets.entries()) {
      const m = MEASURES.find((y) => y.measureId === x.measureId);
      if (!m) return h.fieldFail([[`targets.${i}.measureId`, 'Not a measure this card holds.']]);
      const v = m.kind === 'YESNO' ? 'YES' : String(x.target ?? '').trim();
      if (m.kind !== 'YESNO' && !/^\d{1,6}$/.test(v)) return h.fieldFail([[`targets.${i}.target`, 'A whole number.']]);
      // fixed after the start of the phase: a target never set may still be set, a set one may not move (ADR 0018)
      if (!lk.open && t[m.measureId] && t[m.measureId] !== v) return h.fail('WINDOW_CLOSED', lockedMsg(p, lk));
      t[m.measureId] = v;
    }
    targets.set(u.login, t);
    return h.ok({ login: u.login, phaseId: p.phaseId, set: (d.targets || []).length });
  }];

  A['card.fill'] = [ANY, (d, u) => {
    // their card: a trainee's training's, a facilitator's phase's (phases.js cardFill: the key is required)
    const p = d.phaseId ? cardPhase(u, String(d.phaseId)) : null;
    if (!p) return h.fail('NOT_FOUND', 'No such phase.');
    if (p.state !== 'OPEN') return h.fail('WINDOW_CLOSED', `${p.name} is closed; its cards cannot be changed.`);
    if (!validWeekId(d.weekId)) return h.fieldFail([['weekId', 'Not a week.']]);
    // bounded by THEIR window (phases.js cardFill): a finished training's card is a record; a trainee's runs over its dates
    const win = windowOf(u, p);
    if (win.closed && !((cardUnlocks.get(u.login) || '') >= isoIst(nowD()))) return h.fail('WINDOW_CLOSED', 'Your training is finished; its card is a record now. Ask the IYF head if something needs correcting.');
    if (d.weekId < win.from || d.weekId > win.to) return h.fieldFail([['weekId', win.trainee ? 'That week is outside your training.' : `That week is outside ${p.name}.`]]);
    const f = fills.get(k(u.login, d.weekId)) || {};
    for (const [i, v] of (d.values || []).entries()) {
      const m = MEASURES.find((y) => y.measureId === v.measureId);
      if (!m) return h.fieldFail([[`values.${i}.measureId`, 'Not a measure this card holds.']]);
      if (m.kind === 'YESNO' && v.value !== 'YES' && v.value !== 'NO') return h.fieldFail([[`values.${i}.value`, 'Choose Yes or No.']]);
      if (m.kind !== 'YESNO' && !/^\d{1,6}$/.test(String(v.value))) return h.fieldFail([[`values.${i}.value`, 'A whole number, 0 or more.']]);
      f[m.measureId] = { value: String(v.value), source: m.fromApp && v.source === 'app' ? 'app' : 'typed' };
    }
    fills.set(k(u.login, d.weekId), f);
    return h.ok(cardFor(u, d.weekId, p.phaseId));
  }];

  /* Enrolment: existing devotees added to a training, who keep their own batch (17 Oct 2026). */
  const enrolled = new Map();   // batchId -> Set(login)
  // ADR 0010 (enrol.js takeBack): temporary facilitation goes when no running training is left; their name leaves the list
  const takeBack = (login) => {
    const x = h.userOf ? h.userOf(login) : null;
    if (!x || x.facilitation !== 'temporary' || [...enrolled.entries()].some(([b, set]) => isTraining(b) && set.has(login))) return;
    h.withdrawFacilitator?.(x.facilitatorName, login); x.facilitatorName = ''; x.facilitation = '';
  };
  const finished = new Map();   // login -> [{ batchId, name, startedOn, finishedOn }], newest first
  const cardUnlocks = new Map(); // login -> until: the head opened their finished training's card (card_unlocks)
  // the head lets ONE finished card be corrected for 7 days, with a reason (phases.js cardUnlock)
  A['card.unlock'] = [MASTER, (d) => {
    if (String(d.reason || '').trim().length < 4) return h.fieldFail([['reason', 'Say why this card is being opened.']]);
    const running = [...enrolled.entries()].find(([b, set]) => isTraining(b) && set.has(d.login));
    if (running) return h.fail('CONFLICT', 'That batch is still running; its cards are open already.');
    const last = (finished.get(d.login) || [])[0];
    if (!last) return h.fail('NOT_FOUND', 'No such person, or they were never in a batch.');
    const until = isoIst(new Date(nowD().getTime() + 7 * 864e5));
    cardUnlocks.set(d.login, until);
    return h.ok({ login: d.login, batchId: last.batchId, until });
  }];
  // ADR 0018: the head opens one person's fixed targets for 7 days, with a reason (phases.js targetsUnlock)
  A['targets.unlock'] = [['MASTER', 'FTP'], (d, u) => {
    if (String(d.reason || '').trim().length < 4) return h.fieldFail([['reason', 'Say why their targets are being opened.']]);
    if (!h.userOf?.(d.login)) return h.fail('NOT_FOUND', 'No such person.');
    // the FTP coordinator (ADR 0019) opens only the original facilitators' targets
    if (u.role !== 'MASTER' && !h.userOf(d.login).facilitatorName) return h.fail('FORBIDDEN', 'Only a facilitator\u2019s targets are opened here.');
    const p = cardPhase(h.userOf(d.login), String(d.phaseId || ''));
    if (!p) return h.fail('NOT_FOUND', 'No phase is open.');
    if (p.state !== 'OPEN') return h.fail('CONFLICT', `${p.name} is closed.`);
    const until = isoIst(new Date(nowD().getTime() + 7 * 864e5));
    targetUnlocks.set(d.login, until);
    return h.ok({ login: d.login, phaseId: p.phaseId, until });
  }];
  const setOf = (b) => { if (!enrolled.has(b)) enrolled.set(b, new Set()); return enrolled.get(b); };
  // Admin › Analysis (phase 21): how enrolments ended, per training — removed mid-way, or the closing's decision
  const outcomes = new Map();
  const outcomeOf = (b) => { if (!outcomes.has(b)) outcomes.set(b, { removed: 0, qualified: 0, repeat: 0, left: 0 }); return outcomes.get(b); };
  const isTraining = (b) => /^ETP-\d+$/.test(String(b || ''));
  const mayHold = (u, b) => u.role === 'MASTER' || (h.batchIdsOf?.(u) || []).includes(b);

  /* A batch's promotion rules (eligible.js): the standard set for its level unless the head set the batch's own. */
  const STANDARD = { VL2: { att: 0.5 }, VL3: { att: 0.5, chant: 4 }, SPS: { sad: 80, night: 0.8, cls: 80, chant: 8, pr: 'YES' },
    DPS: { sad: 80, night: 0.8, cls: 80, chant: 12, pr: 'YES' }, BSS: { sad: 80, night: 0.8, cls: 80, chant: 12, pr: 'YES' } };
  const CRIT_LABEL = { att: 'Attendance', chant: 'Chanting rounds', sad: 'Sadhana average', night: 'Night stay', cls: 'Class attendance', pr: '4 regulative principles' };
  const ownCriteria = new Map();   // batchId -> { key: value }
  const levelOfBatch = (id) => String((h.batches ? h.batches() : []).find((b) => b.batchId === id)?.level || '').toUpperCase();
  A['criteria.get'] = [MASTER, (d) => {
    if (!(h.batches ? h.batches() : []).some((b) => b.batchId === d.batchId)) return h.fail('NOT_FOUND', 'No such batch.');
    const level = levelOfBatch(d.batchId), own = ownCriteria.get(d.batchId);
    return h.ok({ batchId: d.batchId, level, measured: level in STANDARD, custom: !!own,
                  criteria: own || STANDARD[level] || {}, standard: STANDARD[level] || {}, labels: CRIT_LABEL });
  }];
  A['criteria.set'] = [MASTER, (d) => {
    if (!(h.batches ? h.batches() : []).some((b) => b.batchId === d.batchId)) return h.fail('NOT_FOUND', 'No such batch.');
    if (!Array.isArray(d.criteria)) return h.fieldFail([['criteria', 'Give the criteria.']]);
    const out = {};
    for (const [i, c] of d.criteria.entries()) {
      if (!CRIT_LABEL[c?.criterion]) return h.fieldFail([[`criteria.${i}.criterion`, 'Not a criterion.']]);
      const v = String(c.minValue ?? '').trim();
      if (c.criterion === 'pr' ? !['YES', 'NO'].includes(v) : !/^\d+(\.\d+)?$/.test(v)) return h.fieldFail([[`criteria.${i}.minValue`, c.criterion === 'pr' ? 'YES or NO.' : 'A number.']]);
      out[c.criterion] = c.criterion === 'pr' ? v : Number(v);
    }
    if (d.criteria.length) ownCriteria.set(d.batchId, out); else ownCriteria.delete(d.batchId);
    const level = levelOfBatch(d.batchId);
    return h.ok({ batchId: d.batchId, criteria: d.criteria.length ? out : STANDARD[level] || {}, standard: !d.criteria.length });
  }];

  // who is ready to move up (eligible.js): the same shape; the mock judges sadhana from the scored weeks it has and
  // leaves the figures it does not keep (attendance, rounds, night stay) blank — and a blank is NOT YET, as on the server
  const LADDER_NEXT = { VL2: ['VL3'], VL3: ['SPS'], SPS: ['DPS'], DPS: ['BSS', 'BVS'], BSS: [] };
  A['eligible.list'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    const b = (h.batches ? h.batches() : []).find((x) => x.batchId === d.batchId);
    if (!b) return h.fail('NOT_FOUND', 'No such batch.');
    if (u.role !== 'MASTER' && !(h.batchIdsOf?.(u) || []).includes(d.batchId)) return h.fail('FORBIDDEN', 'That batch is not yours.');
    const level = String(b.level || '').toUpperCase(), crit = ownCriteria.get(d.batchId) || STANDARD[level] || {};
    const meets = (k, got, min) => got !== null && got !== undefined && (k === 'pr' ? got === 'YES' : got >= min);
    const rows = (h.membersOf ? h.membersOf(d.batchId) : []).map((m) => {
      const sad = h.weekScoreOf ? h.weekScoreOf(m.login, mondayOf(nowD())) : null;
      const f = { sad, cls: null, att: null, chant: null, night: null, pr: null };
      const checks = Object.keys(crit).map((k) => ({ key: k, label: CRIT_LABEL[k], min: crit[k], got: f[k], met: meets(k, f[k], crit[k]) }));
      return { login: m.login, name: m.name, weeks: sad === null ? 0 : 1, heldClasses: 0, checks, ready: checks.length > 0 && checks.every((c) => c.met) };
    });
    return h.ok({ batchId: b.batchId, name: b.name, level, from: '0000-00-00', to: '9999-99-99', nextLevels: LADDER_NEXT[level] || [], criteria: crit, rows });
  }];

  // the month scorecard (monthcard.js, ADR 0012 D): one row per ENDED month of the phase
  A['card.months'] = [ANY, (d, u) => {
    const who = d.login ? (h.userOf ? h.userOf(d.login) : null) : u;
    if (!who) return h.fail('NOT_FOUND', 'No such person.');
    if (who.login !== u.login && u.role !== 'MASTER') {
      const inMine = [...enrolled.entries()].some(([b, set]) => isTraining(b) && (h.batchIdsOf?.(u) || []).includes(b) && set.has(who.login));
      if (!inMine) return h.fail('FORBIDDEN', 'You can read your own month scorecard, or a trainee of a training you coordinate.');
    }
    // a trainee's months are their training's, from its start to its end (monthcard.js, J1)
    const p = cardPhase(who, String(d.phaseId || '')); if (!p) return h.fail('NOT_FOUND', 'No phase is open.');
    const today = isoIst(nowD()).slice(0, 10), t = targets.get(who.login) || {}, out = [];
    const weeks = [...fills.keys()].filter((x) => x.startsWith(who.login + '|')).map((x) => x.split('|')[1]).sort();
    const F = (w) => fills.get(k(who.login, w)) || {};
    for (let ym = p.startsOn.slice(0, 7); ym <= p.endsOn.slice(0, 7); ym = (([y, mo]) => (mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`))(ym.split('-').map(Number))) {
      if (monthEnd(ym) >= today) break;
      const ws = weeks.filter((w) => w.slice(0, 7) === ym);
      const weekly = ws.filter((w) => Object.keys(F(w)).some((id) => MEASURES.find((m) => m.measureId === id && isWeekly(m)))).map((w) => weekPct(t, F(w))).filter((x) => x !== null);
      const month = ws.length ? monthPct(t, ws.map(F)) : null;
      const seva = ws.length ? avgOf([...weekly, ...(month === null ? [] : [month])]) : null;
      const sadhana = ws.length ? avgOf(ws.filter((w) => F(w).sadhna && F(w).sadhna.value !== '').map((w) => Number(F(w).sadhna.value)).filter(Number.isFinite)) : null;
      const goal = stagesFor(who.login).goalPct;
      out.push({ month: ym, filled: ws.length, sadhana, seva, goal, net: ws.length ? netOf(sadhana, seva, goal).score : null });
    }
    return h.ok({ phaseId: p.phaseId, name: p.name, from: p.startsOn, to: p.endsOn, trainee: !!p.training, months: out });
  }];

  /* The sadhana leaderboard (leaderboard.js, ADR 0013): the last CLOSED week from the settings' deadline (closesOf),
     a submitted week's score, a missed week 0, a range averaged, ties sharing a place. */
  const addW = (w, n) => new Date(Date.parse(w + 'T00:00:00Z') + n * 7 * 864e5).toISOString().slice(0, 10);
  const lastClosed = () => { const lw = addW(mondayOf(nowD()), -1); return nowD() >= closesOf(lw) ? lw : addW(lw, -1); };
  function lbRank(people, first, last) {
    const rows = [];
    for (const p of people) {
      let n = 0, sum = 0, missed = 0;
      for (let w = last; w >= first; w = addW(w, -1)) {
        const r = h.weekOf ? h.weekOf(p.login, w) : null;
        if (r?.status === 'SUBMITTED') { n++; sum += r.overall ?? 0; } else if (r?.status === 'MISSED') { n++; missed++; }
      }
      if (n) rows.push({ login: p.login, name: p.name, batchId: p.batchId, weeks: n, missed, score: Math.round(sum / n) });
    }
    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    rows.forEach((r, i) => { r.rank = i && rows[i - 1].score === r.score ? rows[i - 1].rank : i + 1; });
    return rows;
  }
  A['leaderboard.get'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    const closed = lastClosed(), period = d.period || 'week', ymdRe = /^\d{4}-\d{2}-\d{2}$/;
    let first, last, label;
    if (period === 'week') { const w = d.weekId || closed; if (!validWeekId(w)) return h.fieldFail([['weekId', 'Not a week.']]);
      if (w > closed) return h.fieldFail([['weekId', 'That week is still open; it is ranked once its deadline passes.']]); first = last = label = w; }
    else if (period === 'month') { const m = d.month || closed.slice(0, 7); first = m + '-01'; last = m + '-31'; label = m; }
    else if (period === 'year') { const y = String(d.year || closed.slice(0, 4)); first = y + '-01-01'; last = y + '-12-31'; label = y; }
    else if (period === 'custom') {
      if (!ymdRe.test(d.from || '')) return h.fieldFail([['from', 'A date, as 2026-09-01.']]);
      if (!ymdRe.test(d.to || '')) return h.fieldFail([['to', 'A date, as 2026-10-31.']]);
      if (d.to < d.from) return h.fieldFail([['to', 'The end comes after the start.']]);
      if ((Date.parse(d.to) - Date.parse(d.from)) / 864e5 > 184) return h.fieldFail([['to', 'At most 6 months at a time.']]);
      first = d.from; last = d.to; label = `${d.from}…${d.to}`;
    } else return h.fieldFail([['period', 'Week, month, year or custom.']]);
    if (last > closed) last = closed;
    // the Mondays in [first, last]
    const mon = (x) => { const t = new Date(x + 'T00:00:00Z'); const dow = (t.getUTCDay() + 6) % 7; return new Date(t.getTime() + ((7 - dow) % 7) * 864e5).toISOString().slice(0, 10); };
    const f = mon(first);
    let people;
    if (d.batchId) {
      if (u.role !== 'MASTER' && !(h.batchIdsOf?.(u) || []).includes(d.batchId)) return h.fail('FORBIDDEN', 'That batch is not yours.');
      people = (h.membersOf ? h.membersOf(d.batchId) : []).map((p) => ({ ...p, batchId: d.batchId }));
    } else {
      // "All batches" (Phase 22 F2, leaderboard.js): the head every class batch; a coordinator every class batch they hold
      const mine = u.role === 'MASTER' ? null : new Set(h.batchIdsOf?.(u) || []);
      const ids = (h.batches ? h.batches() : []).filter((b) => !isTraining(b.batchId) && !/^(MTP|FTP)-\d+$/.test(b.batchId) && String(b.level || '').toUpperCase() !== 'ETP' && (!mine || mine.has(b.batchId)));
      if (!ids.length) return h.fail('FORBIDDEN', 'A leaderboard is for a class batch you coordinate.');
      people = ids.flatMap((b) => (h.membersOf ? h.membersOf(b.batchId) : []).map((p) => ({ ...p, batchId: b.batchId })));
    }
    const ranked = f <= last ? lbRank(people, f, last) : [], page = Math.max(0, Math.floor(Number(d.page) || 0));
    return h.ok({ period, label, from: f, to: last, lastClosedWeek: closed, batchId: d.batchId || '', total: ranked.length,
                  page, pages: Math.max(1, Math.ceil(ranked.length / 100)), rows: ranked.slice(page * 100, page * 100 + 100) });
  }];
  A['leaderboard.mine'] = [ANY, (d, u) => {
    if (!u.batchId) return h.fail('FORBIDDEN', 'You are not in a batch.');
    const w = lastClosed(), ranked = lbRank((h.membersOf ? h.membersOf(u.batchId) : []).map((p) => ({ ...p, batchId: u.batchId })), w, w);
    const me = ranked.find((r) => r.login === u.login);
    return h.ok({ weekId: w, batchId: u.batchId, rank: me ? me.rank : null, of: ranked.length, score: me ? me.score : null });
  }];

  /* The stages and the net score, as the server works them out (phases.js). */
  const STAGES = [
    { stage: 'VL3', label: 'VL-2 → VL-3' }, { stage: 'SPS', label: 'VL-3 → SPS' },
    { stage: 'DPS', label: 'SPS → DPS' }, { stage: 'BSS', label: 'DPS → BSS' }, { stage: 'BVS', label: 'DPS → BVS' }
  ];
  const stageTargets = new Map();   // login -> { stage: target }

  /* Promotions COUNTED as the server counts them (phases.js cardsOf): a student of this facilitator in a membership that
   * ENDED, then a membership "promoted from …" starting inside the card's window, by the level it moved them to. The
   * server follows the facilitator's id through closed rows; the mock keeps its names in step on a rename, so the same
   * students count (Phase 24). */
  function promotedOf(login) {
    const u = h.userOf?.(login), fac = u?.facilitatorName, p = u && cardPhase(u), by = {};
    if (!fac || !p || !h.allUsers) return by;
    for (const x of h.allUsers()) {
      const ms = x.memberships || [];
      for (const m of ms) {
        if (!String(m.reason || '').startsWith('promoted from') || m.fromWeek < p.startsOn || m.fromWeek > p.endsOn) continue;
        if (!ms.some((pr) => pr !== m && pr.toWeek && pr.facilitator === fac && m.fromWeek > pr.toWeek)) continue;
        const lv = levelOfBatch(m.batchId); by[lv] = (by[lv] || 0) + 1;
      }
    }
    return by;
  }
  function stagesFor(login) {
    const T = stageTargets.get(login) || {}, P = promotedOf(login);
    // eligibility is not modelled here (achieved stays nought); promotions are counted, as above
    const stages = STAGES.map((s) => ({ ...s, target: T[s.stage] ?? 0, eligible: 0, promoted: P[s.stage] || 0, achieved: 0 }));
    const totalTarget = stages.reduce((n, s) => n + s.target, 0);
    const capped = stages.reduce((n, s) => n + (s.target > 0 ? Math.min(s.achieved, s.target) : 0), 0);
    return { stages, totalTarget, totalAchieved: 0, totalPromoted: stages.reduce((n, s) => n + s.promoted, 0),
             goalPct: totalTarget > 0 ? Math.round(capped / totalTarget * 100) : null };
  }

  function netOf(sadhana, seva, goal) {
    const parts = [
      { key: 'sadhana', label: 'Sadhana', value: sadhana === null ? 0 : sadhana, reported: sadhana !== null },
      { key: 'seva', label: 'Seva', value: seva === null ? 0 : seva, reported: seva !== null },
      { key: 'goal', label: 'Goal', value: goal === null ? null : goal, reported: goal !== null }
    ];
    if (!parts.some((p) => p.reported)) return { score: null, parts, counted: [] };
    const counted = parts.filter((p) => p.value !== null);
    return { score: Math.round(counted.reduce((n, p) => n + p.value, 0) / counted.length),
             parts, counted: counted.map((p) => p.key) };
  }

  A['stages.set'] = [ANY, (d, u) => {
    const p = cardPhase(u, String(d.phaseId || '')); if (!p) return h.fail('NOT_FOUND', 'No such phase.');
    const T = { ...(stageTargets.get(u.login) || {}) }, lk = lockOf(u, p);
    for (const [i, x] of (d.stages || []).entries()) {
      if (!STAGES.some((s) => s.stage === x.stage)) return h.fieldFail([[`stages.${i}.stage`, 'Not a level.']]);
      const n = Number(x.target);
      if (!Number.isInteger(n) || n < 0 || n > 999) return h.fieldFail([[`stages.${i}.target`, 'A whole number, 0 or more.']]);
      if (!lk.open && T[x.stage] && T[x.stage] !== n) return h.fail('WINDOW_CLOSED', lockedMsg(p, lk));
      T[x.stage] = n;
    }
    stageTargets.set(u.login, T);
    return h.ok(stagesFor(u.login));
  }];

  A['enrol.search'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    if (!isTraining(d.batchId)) return h.fail('CONFLICT', 'Not a training batch.');
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'Not your batch.');
    const term = String(d.q || '').trim().toLowerCase();
    if (term.length < 2) return h.fieldFail([['q', 'Type at least two characters.']]);
    const already = setOf(d.batchId);
    const people = (h.allDevotees ? h.allDevotees() : [])
      // the digits guard matters: ''.includes('') is true, so a term with no digits (a name) used to
      // match EVERY login and the search returned all 20 people whatever was typed (18 Oct 2026).
      // The server has always had this guard (?2 <> ''); the mock did not, so the browser checks
      // passed against a search that never filtered.
      .filter((p) => {
        // an id is matched whole, and never also reduced to digits: 'IYFD-2016-0003' would become
        // '20160003' and match somebody else's phone number (18 Oct 2026)
        const looksLikeId = /[a-z]/.test(term) && /\d/.test(term) && term.includes('-');
        const digits = looksLikeId ? '' : term.replace(/\D/g, '');
        return !already.has(p.login) && (
          p.name.toLowerCase().includes(term) ||
          (digits !== '' && p.login.includes(digits)) ||
          (p.iyfId && p.iyfId.toLowerCase().includes(term)));
      })
      .slice(0, 20);
    return h.ok({ people });
  }];

  A['enrol.list'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    if (!isTraining(d.batchId)) return h.fail('CONFLICT', 'Not a training batch.');
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'Not your batch.');
    const s = setOf(d.batchId);
    const students = (h.allDevotees ? h.allDevotees() : []).filter((p) => s.has(p.login));
    return h.ok({ batchId: d.batchId, name: h.batchName?.(d.batchId) || d.batchId, closed: false, students });
  }];

  A['enrol.add'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    if (!isTraining(d.batchId)) return h.fail('CONFLICT', 'Not a training batch.');
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'Not your batch.');
    const tb = (h.batches ? h.batches() : []).find((b) => b.batchId === d.batchId);
    if (tb?.closedAt) return h.fail('CONFLICT', `${tb.name} is finished; it takes no more students.`);
    const s = setOf(d.batchId);
    if (s.has(d.login)) return h.fail('CONFLICT', 'They are already in this training.');
    s.add(d.login);
    // a trainee facilitates from day one (worker/src/enrol.js, 17 Oct 2026): enrolling grants the facilitator scope
    const x = h.userOf ? h.userOf(d.login) : null;
    if (x && !x.facilitatorName) { x.facilitatorName = x.name; x.facilitation = 'temporary'; h.offerFacilitator?.(x.name); }
    return h.ok({ login: d.login, name: x?.name || '', batchId: d.batchId, facilitator: x?.facilitatorName || '' });
  }];

  // One attendance session per training per week (the head, 18 Oct 2026): the key is the student,
  // the training and the week, so marking twice corrects the mark rather than adding a second one.
  // Keyed by batch, so MTP or any later training gets its own session with no further work.
  const trainingMarks = new Map();                       // `${batchId}|${weekId}|${login}` -> 'P' | 'A'
  A['training.attendance'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    if (!isTraining(d.batchId)) return h.fail('CONFLICT', 'Not a training batch.');
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'Not your batch.');
    if (!Array.isArray(d.marks) || !d.marks.length) return h.fieldFail([['marks', 'Mark at least one student.']]);
    const enrolled = setOf(d.batchId);
    for (const [i, m] of d.marks.entries()) {
      if (!enrolled.has(String(m?.login || ''))) return h.fieldFail([[`marks.${i}.login`, 'Not a student of this training.']]);
      const mk = m.mark === null || m.mark === '' ? '' : String(m.mark);
      if (mk !== '' && mk !== 'P' && mk !== 'A') return h.fieldFail([[`marks.${i}.mark`, 'P, A or null.']]);
      const k = `${d.batchId}|${d.weekId}|${m.login}`;
      if (mk) trainingMarks.set(k, mk); else trainingMarks.delete(k);
    }
    return h.ok({ batchId: d.batchId, weekId: d.weekId, saved: d.marks.length });
  }];
  h.trainingMark = (b, w, l) => trainingMarks.get(`${b}|${w}|${l}`) || '';

  /* Closing an intake or a training, as worker/src/closing.js does (18 Oct 2026). The mock had neither action, so
     the Close batch screen never loaded in a browser check and its training bug (no "Qualified") went unseen. */
  const NEXT = { VL2: ['VL3'], VL3: ['SPS'], ETP: [] };
  const levelOf = (id) => (/^ETP-\d+$/.test(id) ? 'ETP' : /^VL2-\d+$/.test(id) ? 'VL2' : /^VL3-\d+$/.test(id) ? 'VL3' : '');
  const closingMembers = (batchId) => isTraining(batchId)
    ? (h.allDevotees ? h.allDevotees() : []).filter((x) => setOf(batchId).has(x.login))
    : (h.membersOf ? h.membersOf(batchId) : []);
  A['batches.closingPreview'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    const b = (h.batches ? h.batches() : []).find((x) => x.batchId === d.batchId);
    if (!b) return h.fail('NOT_FOUND', 'No such batch.');
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'That batch is not yours.');
    const lv = levelOf(d.batchId);
    if (!lv) return h.fail('CONFLICT', `${b.name} runs with no fixed duration, so it is never closed.`);
    if (b.closedAt) return h.fail('CONFLICT', `${b.name} was already closed.`);
    // a training's weeks present come from its own class marks; an intake's from its attendance (none in the mock)
    const present = (login) => isTraining(d.batchId)
      ? [...trainingMarks.entries()].filter(([k, v]) => k.startsWith(d.batchId + '|') && k.endsWith('|' + login) && v === 'P').length : 0;
    const allowed = NEXT[lv] || [];
    const open = (h.batches ? h.batches() : []).filter((x) => x.active && !x.closedAt && x.batchId !== d.batchId);
    const nextBatches = (u.role === 'MASTER' ? open : open.filter((x) => allowed.includes(String(x.level || '').toUpperCase())))
      .map((x) => ({ batchId: x.batchId, name: x.name, level: x.level, offLadder: !allowed.includes(String(x.level || '').toUpperCase()) }));
    return h.ok({ batchId: d.batchId, name: b.name, startedOn: b.startedOn || '', level: lv, batchLevel: b.level, nextLevels: allowed,
      members: closingMembers(d.batchId).map((m) => ({ login: m.login, name: m.name, fromWeek: '', present: present(m.login) })), nextBatches });
  }];
  A['batches.close'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    const b = (h.batches ? h.batches() : []).find((x) => x.batchId === d.batchId);
    if (!b) return h.fail('NOT_FOUND', 'No such batch.');
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'That batch is not yours.');
    const training = isTraining(d.batchId), people = closingMembers(d.batchId), rows = Array.isArray(d.decisions) ? d.decisions : [];
    const seen = new Set();
    for (const [i, r] of rows.entries()) {
      if (!people.some((m) => m.login === r?.login)) return h.fieldFail([[`decisions.${i}.login`, 'Not an active devotee of this batch.']]);
      if (seen.has(r.login)) return h.fieldFail([[`decisions.${i}.login`, 'Appears twice.']]);
      seen.add(r.login);
      if (!['promoted', 'qualified', 'repeat', 'left'].includes(r.decision)) return h.fieldFail([[`decisions.${i}.decision`, 'Promoted, repeat or left.']]);
      if (r.decision === 'qualified' && !training) return h.fieldFail([[`decisions.${i}.decision`, 'Only a training batch has people qualify.']]);
      if (r.decision === 'promoted' && training) return h.fieldFail([[`decisions.${i}.decision`, 'Nobody is promoted out of a training: choose qualified, repeat or left.']]);
      if (r.decision === 'promoted') {
        const to = (h.batches ? h.batches() : []).find((x) => x.batchId === r.toBatch && x.active && !x.closedAt);
        if (!to) return h.fieldFail([[`decisions.${i}.toBatch`, 'Choose the batch they move up to.']]);
        if (to.batchId === d.batchId) return h.fieldFail([[`decisions.${i}.toBatch`, 'That is this batch.']]);
        if (!(NEXT[levelOf(d.batchId)] || []).includes(String(to.level || '').toUpperCase()) && u.role !== 'MASTER') {
          return h.fieldFail([[`decisions.${i}.toBatch`, `${r.login} cannot move from ${b.level} to ${to.level}. Ask the IYF head.`]]);
        }
      }
    }
    if (seen.size !== people.length) return h.fieldFail([['decisions', 'Decide about everyone before closing.']]);
    for (const r of rows) {
      const x = h.userOf ? h.userOf(r.login) : null;
      if (!x) continue;
      if (training) continue;                                       // a training's people: handled once the batch is cleared below
      if (r.decision === 'promoted') x.batchId = r.toBatch;
      if (r.decision === 'left') x.status = 'INACTIVE';           // left a class batch: the account goes quiet
    }
    // the record on their profile (trainingsOf): one row per finished training, as the server keeps the ended enrolment
    if (training) for (const l of setOf(d.batchId)) finished.set(l, [{ batchId: d.batchId, name: b.name, startedOn: b.startedOn || '', finishedOn: isoIst(nowD()).slice(0, 10) }, ...(finished.get(l) || []).filter((x) => x.batchId !== d.batchId)]);
    // how it ended for each, for the head's Analysis (batch_closings on the server)
    if (training) for (const r of rows) if (['qualified', 'repeat', 'left'].includes(r.decision)) outcomeOf(d.batchId)[r.decision]++;
    if (training) setOf(d.batchId).clear();
    // ADR 0010: whatever the decision, the end of the training takes back the facilitation it gave (enrol.js takeBack)
    if (training) for (const r of rows) takeBack(r.login);          // every enrolment ends with the training; the record stays on the profile
    b.closedAt = isoIst(nowD());
    const count = (k) => rows.filter((r) => r.decision === k).length;
    return h.ok({ batchId: d.batchId, closedAt: b.closedAt, promoted: count('promoted'), qualified: count('qualified'), repeat: count('repeat'), left: count('left') });
  }];

  A['enrol.remove'] = [['COORDINATOR', 'MASTER'], (d, u) => {
    if (!mayHold(u, d.batchId)) return h.fail('FORBIDDEN', 'Not your batch.');
    const s = setOf(d.batchId);
    if (!s.has(d.login)) return h.fail('NOT_FOUND', 'They are not in this training.');
    s.delete(d.login);
    takeBack(d.login);
    outcomeOf(d.batchId).removed++;
    return h.ok({ login: d.login, batchId: d.batchId, state: 'ENDED' });
  }];

  /* the week the boards and a card opened from them stand on, as the server's focusWeek (staff.js): last week until its
     Monday deadline, then this week — it was this week at every hour here, so the mock's boards ran a week ahead */
  const focusWeek = () => { const t = mondayOf(nowD()), l = addW(t, -1); return nowD() < closesOf(l) ? l : t; };

  // which boards this person may open: the head gets every running training and the facilitators,
  // a coordinator only the trainings they hold (18 Oct 2026); a facilitator or a trainee their OWN place (ADR 0016)
  A['board.list'] = [ANY, (d, u) => {
    const master = u.role === 'MASTER';
    const mine = (h.batches ? h.batches() : []).filter((b) => isTraining(b.batchId) && b.active && !b.closedAt
      && (master || (h.batchIdsOf?.(u) || []).includes(b.batchId)));
    const boards = mine.map((b) => ({ kind: 'training', batchId: b.batchId, name: b.name }));
    if (h.wholeFacBoard(u)) boards.push({ kind: 'facilitators', batchId: '', name: 'Facilitators',
      people: (h.facilitatorLogins ? h.facilitatorLogins() : []).length });
    else {
      const tr = trainingOf(u);
      if (tr && !boards.some((b) => b.batchId === tr)) boards.push({ kind: 'training', batchId: tr, name: h.batchName?.(tr) || tr, self: true });
      else if (!tr && u.facilitatorName && u.status === 'ACTIVE') boards.push({ kind: 'facilitators', batchId: '', name: 'Facilitators', self: true });
    }
    return h.ok({ boards, weekId: focusWeek() });
  }];

  // one person's card, opened from a scoreboard row
  A['card.of'] = [ANY, (d, u) => {
    const who = h.userOf ? h.userOf(d.login) : null;
    if (!who) return h.fail('NOT_FOUND', 'No such person.');
    // their own card, from their own place on a board (ADR 0016)
    if (u.role !== 'MASTER' && who.login !== u.login && !(h.wholeFacBoard(u) && who.facilitatorName)) {
      const inMine = [...enrolled.entries()].some(([b, set]) => isTraining(b)
        && (h.batchIdsOf?.(u) || []).includes(b) && set.has(who.login));
      if (!inMine) return h.fail('FORBIDDEN', 'They are not in a training of yours.');
    }
    const c = cardFor(who, validWeekId(d.weekId) ? d.weekId : focusWeek(), String(d.phaseId || ''));
    if (!c) return h.fail('NOT_FOUND', 'No phase is open.');
    return h.ok({ login: who.login, person: who.name, ...c });
  }];

  A['board.get'] = [ANY, (d, u) => {
    // a TRAINING's board is its own card's, over its dates; the facilitators' (FTP) board the phase's (J1)
    const tb = d.batchId && isTraining(d.batchId) ? trainingBatch(d.batchId) : null;
    const p = tb ? trainingCardOf(tb) : open(); if (!p) return h.fail('NOT_FOUND', 'No phase is open.');
    const weekId = validWeekId(d.weekId) ? d.weekId : focusWeek();
    const master = u.role === 'MASTER';
    let people, kind, self = false;
    if (d.batchId) {
      const holds = master || (h.batchIdsOf?.(u) || []).includes(d.batchId);
      self = !holds && trainingOf(u) === d.batchId;
      if (!holds && !self) return h.fail('FORBIDDEN', 'Not your batch.');
      kind = 'training';
      people = isTraining(d.batchId)
        ? (h.allDevotees ? h.allDevotees() : []).filter((p) => setOf(d.batchId).has(p.login))
        : (h.membersOf ? h.membersOf(d.batchId) : []);
    } else {
      // the facilitators' board: whole for the head, a facilitator's own place for them (not a trainee's: theirs is the training's)
      const whole = h.wholeFacBoard(u);
      self = !whole && !!u.facilitatorName && u.status === 'ACTIVE' && !trainingOf(u);
      if (!whole && !self) return h.fail('FORBIDDEN', 'Only the IYF head sees the facilitators\u2019 board.');
      kind = 'facilitators';
      people = h.facilitatorLogins ? h.facilitatorLogins() : [];
    }
    const rows = people.map((x) => {
      const t = targets.get(x.login) || {};
      const f = fills.get(k(x.login, weekId)) || {};
      const fig = figures(x.login, weekId), goal = stagesFor(x.login).goalPct;
      return { login: x.login, name: x.name, week: weekPct(t, f),
               filled: Object.keys(f).length, asked: Object.keys(t).length,
               // the training's own class mark, beside whether they filled the card
               mark: kind === 'training' && d.batchId ? h.trainingMark(d.batchId, weekId, x.login) : '',
               average: fig.seva, seva: fig.seva, sadhana: fig.sadhana, goal,
               rank: goal === null ? null : Math.round(((fig.seva ?? 0) + goal) / 2),
               weeksFilled: fig.filled, weeks: 17 };
    });
    // as the server: ranked on seva and goal; somebody with a target before somebody never given one
    rows.sort((a, b) => ((b.rank !== null) - (a.rank !== null)) || (b.rank ?? -1) - (a.rank ?? -1)
      || (b.seva ?? -1) - (a.seva ?? -1) || a.name.localeCompare(b.name));
    rows.forEach((r, i) => { r.place = r.rank === null ? null : i + 1; });
    return h.ok({ phaseId: p.phaseId, name: p.name, weekId, kind, batchId: d.batchId || '', self, of: rows.length,
      startsOn: p.startsOn || '', endsOn: p.training ? p.plannedEnd : p.endsOn || '', training: !!p.training,
                  rows: self ? rows.filter((r) => r.login === u.login) : rows });
  }];

  return {
    // the training somebody is in RIGHT NOW: what puts the card in their menu, and takes it away
    // the moment the coordinator removes them (18 Oct 2026)
    // every training they have been through, for their own About section
    trainingsOf(login) {
      return [...[...enrolled.entries()].filter(([b, set]) => isTraining(b) && set.has(login))
        .map(([b]) => ({ batchId: b, name: h.batchName?.(b) || b, startedOn: trainingBatch(b)?.startedOn || '', finishedOn: '', running: true, phaseId: trainingBatch(b) ? b : '', average: null, filled: 0, weeks: 0 })),
        // the training's own card is the record's key (phases.js trainingsOf, J1)
        ...(finished.get(login) || []).map((x) => ({ ...x, running: false, phaseId: x.batchId, average: null, filled: 0, weeks: 0 }))];
    },
    traineeOf(login) {
      const hit = [...enrolled.entries()].find(([b, set]) => isTraining(b) && set.has(login));
      return hit ? { batchId: hit[0], name: h.batchName?.(hit[0]) || hit[0] } : null;
    },
    // every training's figures for Analysis (worker/src/analysis.js): in it now, how it ended, attendance week by week
    trainingsSummary: (from, to) => (h.batches?.() || []).filter((b) => isTraining(b.batchId)).map((b) => {
      const wk = new Map();
      for (const [k, v] of trainingMarks) { const [bb, w] = k.split('|'); if (bb !== b.batchId || w < from || w > to) continue; const x = wk.get(w) || { weekId: w, present: 0, held: 0 }; x.held++; if (v === 'P') x.present++; wk.set(w, x); }
      return { batchId: b.batchId, name: b.name, level: b.level, startedOn: b.startedOn || '', closedAt: b.closedAt || '', active: setOf(b.batchId).size, ...outcomeOf(b.batchId),
        weeks: [...wk.values()].sort((a, c) => (a.weekId < c.weekId ? -1 : 1)) };
    }),
    // a batch's promotion rule, for the facilitator's explorer (mockstaff fac.eligible): its own, else the standard
    ruleOf: (batchId, level) => ownCriteria.get(batchId) || STANDARD[String(level || '').toUpperCase()] || {},
    criteriaLabels: CRIT_LABEL,
    reset() { outcomes.clear(); targets.clear(); targetUnlocks.clear(); phases[0].targetsUntil = ''; fills.clear(); enrolled.clear(); finished.clear(); cardUnlocks.clear(); stageTargets.clear(); ownCriteria.clear(); phases.length = 1; phases[0].state = 'OPEN'; phases[0].closedAt = ''; } };
}
