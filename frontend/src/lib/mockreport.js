// The mock of Admin › Reports (worker/src/report.js): report.options and report.get, the same shapes, gates and forced
// scopes. Like the server, it is built from what the other screens answer — the mock's own analysis.get (the weekly
// sums), leaderboard.get (one row per person), board.get (the scorecards) and audit.list — never a second copy of them.
const SECTIONS = ['summary', 'reporting', 'quality', 'attendance', 'batches', 'facilitators', 'boards', 'trainings', 'work', 'growth', 'health', 'next'];
const MAX_DAYS = 366, YMD = /^\d{4}-\d{2}-\d{2}$/;
const plus = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const mondayOn = (ymd) => plus(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7));
const weeksIn = (from, to) => { const out = []; for (let w = mondayOn(from) < from ? plus(mondayOn(from), 7) : from; w <= to; w = plus(w, 7)) out.push(w); return out; };
const isTraining = (b) => /^(ETP|MTP|FTP)-\d+$/.test(b.batchId) || String(b.level || '').toUpperCase() === 'ETP';
const blank = () => ({ people: 0, never: 0, filled: 0, due: 0, score: 0 });

export function installReport(A, h) {
  const HEAD = { role: 'MASTER', login: 'master' };
  const call = (action, d, u = HEAD) => A[action][1](d, u);
  const allBatches = () => h.db().batches;
  const people = () => Object.values(h.db().users).filter((x) => x.role === 'DEVOTEE' && x.status !== 'PENDING' && x.status !== 'REJECTED');
  const lastClosed = () => call('analysis.get', { from: '2026-01-01', to: '2026-01-01' }).data.lastClosed;

  function scopeFor(s, u) {
    const kind = String(s?.kind || 'all'), id = String(s?.id || ''), sc = h.scopesOf(u), all = allBatches();
    if (!['all', 'batch', 'facilitator', 'training'].includes(kind)) return { err: h.fieldFail([['scope.kind', 'All, a batch, a facilitator or a training.']]) };
    const cls = all.filter((b) => !isTraining(b)), trs = all.filter(isTraining);
    const one = (k, b) => (k === 'batch' ? { kind: 'batch', id: b.batchId, label: b.name, batchIds: [b.batchId], trainingIds: [], facId: '', people: null }
      : { kind: 'training', id: b.batchId, label: b.name, batchIds: cls.map((x) => x.batchId), trainingIds: [b.batchId], facId: '', people: 'training' });
    const fac = (fid, label) => ({ kind: 'facilitator', id: fid, label, batchIds: cls.map((x) => x.batchId), trainingIds: [], facId: fid, people: 'fac' });
    if (sc.master) {
      if (kind === 'all') return { kind: 'all', id: '', label: 'All of IYF Delhi', batchIds: cls.map((b) => b.batchId), trainingIds: trs.map((b) => b.batchId), facId: '', people: null, whole: true };
      if (kind === 'facilitator') { const name = h.facNameOf(id); return name ? fac(id, name) : { err: h.fail('NOT_FOUND', 'No such facilitator.') }; }
      const b = all.find((x) => x.batchId === id);
      if (!b) return { err: h.fail('NOT_FOUND', 'No such batch.') };
      if (kind === 'batch' && isTraining(b)) return { err: h.fieldFail([['scope.id', `${b.name} is a training; choose it as a training.`]]) };
      if (kind === 'training' && !isTraining(b)) return { err: h.fieldFail([['scope.id', `${b.name} is not a training.`]]) };
      return one(kind, b);
    }
    const mineC = cls.filter((b) => sc.coordinator.includes(b.batchId)), mineT = trs.filter((b) => sc.coordinator.includes(b.batchId));
    const myFac = sc.facilitator ? h.facIdOf(sc.facilitator.name) : '';
    const no = { err: h.fail('FORBIDDEN', 'That is not yours to report on.') };
    if (kind === 'all') {
      if (mineC.length) return mineC.length === 1 ? { ...one('batch', mineC[0]), kind: 'batches' } : { kind: 'batches', id: '', label: 'Your batches', batchIds: mineC.map((b) => b.batchId), trainingIds: [], facId: '', people: null };
      if (mineT.length) return mineT.length === 1 ? one('training', mineT[0]) : { ...one('training', mineT[0]), id: '', label: 'Your trainings', trainingIds: mineT.map((b) => b.batchId) };
      if (myFac) return fac(myFac, sc.facilitator.name);
      return { err: h.fail('FORBIDDEN', 'Reports are for your own batches, students or trainings, and you have none.') };
    }
    if (kind === 'batch') { const b = mineC.find((x) => x.batchId === id); return b ? one('batch', b) : no; }
    if (kind === 'training') { const b = mineT.find((x) => x.batchId === id); return b ? one('training', b) : no; }
    return myFac && id === myFac ? fac(myFac, sc.facilitator.name) : no;
  }

  A['report.options'] = [['MASTER'], (d, u) => {
    const sc = h.scopesOf(u), all = allBatches(), cls = all.filter((b) => !isTraining(b)), trs = all.filter(isTraining);
    const tview = (b) => ({ id: b.batchId, batchId: b.batchId, name: b.name, startedOn: b.startedOn || '', endsOn: b.endsOn || '', closedAt: b.closedAt || '' });
    const bview = (b) => ({ id: b.batchId, name: b.name, active: b.active !== false });
    const phases = (call('phases.list', {}).data.phases || []).map((p) => ({ phaseId: p.phaseId, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn }));
    let scopes, trainings;
    if (sc.master) {
      const facs = [...new Set(h.facilitators())].map((name) => ({ id: h.facIdOf(name), name })).filter((f) => f.id).sort((a, b) => a.name.localeCompare(b.name));
      scopes = [{ kind: 'all', label: 'All of IYF Delhi' }, { kind: 'batch', items: cls.filter((b) => b.active !== false).map(bview) }, { kind: 'facilitator', items: facs }, { kind: 'training', items: trs.map(tview) }];
      trainings = trs.map(tview);
    } else {
      const mineC = cls.filter((b) => sc.coordinator.includes(b.batchId)), mineT = trs.filter((b) => sc.coordinator.includes(b.batchId));
      const myFac = sc.facilitator && h.facIdOf(sc.facilitator.name) ? { id: h.facIdOf(sc.facilitator.name), name: sc.facilitator.name } : null;
      if (!mineC.length && !mineT.length && !myFac) return h.fail('FORBIDDEN', 'Reports are for your own batches, students or trainings, and you have none.');
      const label = mineC.length ? (mineC.length > 1 ? 'Your batches' : mineC[0].name) : mineT.length ? (mineT.length > 1 ? 'Your trainings' : mineT[0].name) : 'Your students';
      scopes = [{ kind: 'all', label }, ...(mineC.length ? [{ kind: 'batch', items: mineC.map(bview) }] : []), ...(myFac ? [{ kind: 'facilitator', items: [myFac] }] : []), ...(mineT.length ? [{ kind: 'training', items: mineT.map(tview) }] : [])];
      trainings = mineT.map(tview);
    }
    return h.ok({ lastClosed: lastClosed(), maxDays: MAX_DAYS, sections: SECTIONS, scopes, trainings, phases });
  }];

  A['report.get'] = [['MASTER'], (d, u) => {
    const from = String(d.from || ''), to = String(d.to || '');
    if (!YMD.test(from)) return h.fieldFail([['from', 'A date, as 2026-09-01.']]);
    if (!YMD.test(to)) return h.fieldFail([['to', 'A date, as 2026-10-31.']]);
    if (to < from) return h.fieldFail([['to', 'The end comes after the start.']]);
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
    if (days > MAX_DAYS) return h.fieldFail([['to', 'At most a year (366 days) at a time. Choose a shorter period.']]);
    if (d.sections !== undefined && (!Array.isArray(d.sections) || !d.sections.length || d.sections.some((x) => !SECTIONS.includes(x)))) return h.fieldFail([['sections', 'Choose the sections.']]);
    const want = new Set(d.sections || SECTIONS), has = (...xs) => xs.some((x) => want.has(x));
    const S = scopeFor(d.scope, u); if (S.err) return S.err;
    const head = h.scopesOf(u).master, compare = d.compare === true, all = allBatches();
    const cmpFrom = plus(from, -days), cmpTo = plus(from, -1), closed = lastClosed();
    const last = to < closed ? to : closed, cmpLast = cmpTo < closed ? cmpTo : closed;
    const weeks = weeksIn(from, last), cmpWeeks = compare ? weeksIn(cmpFrom, cmpLast) : [], span0 = compare ? cmpFrom : from;

    // the people in scope now
    const facOfUser = (x) => h.facIdOf(x.facilitator || '') || '';
    const enrolled = new Set(S.people === 'training' ? S.trainingIds.flatMap((t) => (call('enrol.list', { batchId: t }).data?.students || []).map((e) => e.login)) : []);
    const pool = people().filter((x) => (S.people === 'fac' ? facOfUser(x) === S.facId : S.people === 'training' ? enrolled.has(x.login) : S.batchIds.includes(x.batchId)));
    const inScope = new Set(pool.map((x) => x.login)), active = pool.filter((x) => x.status === 'ACTIVE');
    const count = (xs, k) => xs.reduce((o, x) => { o[k(x)] = (o[k(x)] || 0) + 1; return o; }, {});
    const students = { total: active.length, byBatch: count(active, (x) => x.batchId), byFac: count(active, facOfUser) };

    // the weekly sums: Analysis's, for the batches; for a people scope, Analysis's rows are by batch, so the mock sums its
    // people's own weeks the same way (as report.js does from submissions)
    let sadhana = null;
    if (has('summary', 'reporting', 'quality', 'attendance', 'batches', 'next')) {
      const an = call('analysis.get', { from: span0, to: last >= span0 ? last : span0 }).data;
      sadhana = S.people ? an.weeks.filter((w) => pool.some((x) => x.batchId === w.batchId)) : an.weeks.filter((w) => S.whole || S.batchIds.includes(w.batchId));
    }
    // one row per person: the Leaderboard's own (in pieces of at most 6 months, as its custom range allows)
    const lbRows = (a, z) => {
      if (a > z) return [];
      const byLogin = {};
      for (let s = a; s <= z; s = plus(s, 182)) {
        const e = plus(s, 181) < z ? plus(s, 181) : z;
        for (const r of call('leaderboard.get', { period: 'custom', from: s, to: e }).data?.rows || []) {
          const o = (byLogin[r.login] ||= { login: r.login, name: r.name, batch_id: r.batchId, weeks: 0, missed: 0, total: 0 });
          o.weeks += r.weeks; o.missed += r.missed; o.total += r.score * r.weeks;
        }
      }
      return Object.values(byLogin).filter((r) => (S.people ? inScope.has(r.login) : S.batchIds.includes(r.batch_id)));
    };
    const facOf = (login) => { const x = pool.find((p) => p.login === login); return x ? facOfUser(x) : '-'; };
    const groups = (rs) => { const out = { total: blank(), byBatch: {}, byFac: {} };
      for (const r of rs) { const f = r.weeks - r.missed; for (const g of [out.total, out.byBatch[r.batch_id] ||= blank(), out.byFac[facOf(r.login)] ||= blank()]) { g.people++; g.due += r.weeks; g.filled += f; g.score += r.total; if (!f) g.never++; } }
      return out; };
    const needPeople = has('summary', 'reporting', 'facilitators', 'boards', 'health', 'next');
    // the period before person by person only up to a quarter (report.js PEOPLE_COMPARE_DAYS)
    const cmpP = compare && days <= 92;
    const cur = needPeople ? lbRows(from, last) : [], cmp = needPeople && cmpP ? lbRows(cmpFrom, cmpLast) : [];
    const reporting = needPeople ? { cur: groups(cur), cmp: cmpP ? groups(cmp) : null } : null;
    const ranked = [...cur].map((r) => ({ login: r.login, name: r.name, batchId: r.batch_id, weeks: r.weeks, missed: r.missed, score: Math.round(r.total / r.weeks) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    ranked.forEach((r, i) => { r.rank = i && ranked[i - 1].score === r.score ? ranked[i - 1].rank : i + 1; });

    // the scoreboard, from the mock's own board.get, as the caller would see it
    let board = null;
    if (has('facilitators', 'boards') && (head || S.people) && weeks.length) {
      const r = S.kind === 'training' ? A['board.get'][1]({ batchId: S.trainingIds[0], weekId: weeks[weeks.length - 1] }, u) : A['board.get'][1]({ weekId: weeks[weeks.length - 1] }, u);
      if (r.ok) {
        const keep = S.kind === 'batch' && r.data.kind === 'facilitators' ? new Set(Object.keys(students.byFac)) : S.people === 'fac' && r.data.kind === 'facilitators' ? new Set([S.facId]) : null;
        const fid = (login) => h.facIdOf(h.db().users[login]?.facilitatorName || '');
        const rows = keep ? r.data.rows.filter((x) => keep.has(fid(x.login))) : r.data.rows;
        board = { ...r.data, of: keep ? rows.length : r.data.of, rows };
      }
    }
    let facilitators = null;
    if (has('facilitators')) {
      const rowOf = Object.fromEntries((board?.kind === 'facilitators' ? board.rows : []).map((x) => [h.facIdOf(h.db().users[x.login]?.facilitatorName || ''), x]));
      const ids = new Set([...Object.keys(students.byFac), ...Object.keys(reporting?.cur.byFac || {}), ...(S.whole ? Object.keys(rowOf) : [])]
        .filter((id) => id && id !== '-' && h.facNameOf(id) && (S.people !== 'fac' || id === S.facId)));
      facilitators = [...ids].map((id) => { const r = rowOf[id]; const login = Object.values(h.db().users).find((x) => x.facilitatorName === h.facNameOf(id))?.login || '';
        return { facId: id, name: h.facNameOf(id), login, active: true, students: students.byFac[id] || 0, promoted: 0,
          card: r ? { seva: r.seva, sadhana: r.sadhana, goal: r.goal, rank: r.rank, place: r.place, weeksFilled: r.weeksFilled, weeks: r.weeks, filled: r.filled, asked: r.asked } : null }; })
        .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
    }
    // the coordinators' work, from the mock's audit log
    let work = null;
    if (has('work', 'growth', 'summary', 'next') && S.people !== 'fac') {
      const rows = call('audit.list', { from: span0, to, limit: 200 }).data.rows.filter((r) => S.whole || (S.people === 'training' ? S.trainingIds : S.batchIds).includes(r.batchId));
      const sum = (c) => { const rs = rows.filter((r) => (r.at >= from) === c), n = (a) => rs.filter((r) => r.action === a).length;
        return { approved: n('requests.approve'), rejected: n('requests.reject'), resets: n('resets.approve'), resetsRejected: n('resets.reject'), reopenAsked: n('reopen.request'),
          reopened: n('weeks.reopen'), reopenRejected: n('reopen.reject'), attendance: n('attendance.set') + n('training.attendance'), attendanceLate: n('attendance.override'),
          filledFor: n('week.submit.onBehalf'), groupMarks: n('group.mark'), enrolled: n('enrol.add'), unenrolled: n('enrol.remove'), promotions: n('devotees.promote'), closings: n('batches.close'),
          decisions: n('requests.approve') + n('requests.reject'), medianHours: null }; };
      const byWho = {};
      for (const r of rows.filter((x) => x.at >= from)) { const w = (byWho[r.who] ||= { who: r.who, name: r.whoName || r.who, actions: 0, approved: 0, attendance: 0, resets: 0, reopens: 0 }); w.actions++;
        if (/^requests\./.test(r.action)) w.approved++; if (/attendance|group\.mark/.test(r.action)) w.attendance++; if (/^resets\./.test(r.action)) w.resets++; if (/reopen/.test(r.action)) w.reopens++; }
      const waiting = Object.values(h.db().users).filter((x) => x.status === 'PENDING' && (S.whole || S.batchIds.includes(x.batchId)));
      work = { cur: sum(true), cmp: compare ? sum(false) : null, byWho: Object.values(byWho).sort((a, b) => b.actions - a.actions).slice(0, 20),
        waiting: { signups: waiting.length, oldest: waiting.map((x) => x.at || '').filter(Boolean).sort()[0] || '' } };
    }
    const growth = has('growth', 'summary', 'next') ? { cur: { joined: work ? work.cur.approved : null, promoted: work ? work.cur.promotions : 0, inactive: 0, back: 0,
      birthdays: active.filter((x) => { const dob = x.profile?.dob || ''; if (dob.length < 10) return false; const md = dob.slice(5); return days >= 365 || (from.slice(5) <= to.slice(5) ? md >= from.slice(5) && md <= to.slice(5) : md >= from.slice(5) || md <= to.slice(5)); }).length },
      cmp: compare ? { joined: work ? work.cmp.approved : null, promoted: work ? work.cmp.promotions : 0, inactive: 0, back: 0 } : null, promotedByLevel: [] } : null;
    const health = has('health', 'summary', 'next') ? { people: active.length, noFacilitator: active.filter((x) => !x.facilitator).length,
      missingProfile: active.filter((x) => !x.profile?.dob).length, orphans: head && (S.kind === 'all' || S.kind === 'batch') ? 0 : null,
      duplicates: head && S.kind === 'all' ? (call('ids.possibleDuplicates', {}).data?.total ?? 0) : null, waiting: work ? work.waiting.signups : null } : null;
    let trainings = null;
    if (has('trainings', 'summary', 'next') && S.trainingIds.length) {
      const an = call('analysis.get', { from: span0, to: last >= span0 ? last : span0 }).data;
      trainings = (an.trainings || []).filter((x) => S.trainingIds.includes(x.batchId)).map((x) => { const b = all.find((y) => y.batchId === x.batchId);
        return { ...x, endsOn: b?.endsOn || '', coordinators: b?.coordinator ? [h.db().users[b.coordinator]?.name || b.coordinator] : [] }; });
    }
    return h.ok({ from, to, days, lastClosed: closed, weeks, compare: compare ? { from: cmpFrom, to: cmpTo, weeks: cmpWeeks } : null,
      scope: { kind: S.kind, id: S.id, label: S.label, batchIds: S.people ? [] : S.batchIds, trainingIds: S.trainingIds, facId: S.facId },
      sections: SECTIONS.filter((s) => want.has(s)),
      batches: all.filter((b) => S.whole || S.batchIds.includes(b.batchId) || S.trainingIds.includes(b.batchId) || (sadhana || []).some((w) => w.batchId === b.batchId))
        .map((b) => ({ batchId: b.batchId, name: b.name, level: b.level, training: isTraining(b), active: b.active !== false })),
      sadhana, people: reporting, students, facilitators, board: has('boards', 'facilitators') ? board : null,
      leaderboard: has('boards') && needPeople ? { from, to: last, total: ranked.length, rows: ranked.slice(0, 10) } : null,
      trainings, work: has('work', 'summary', 'next') ? work : null, growth, health });
  }];
}
