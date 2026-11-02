<script>
  /*
   * Admin › Reports (Phase 23 P14, docs/REPORTS_SPEC_2026-10-27.md; the head, 27 Oct 2026: "I select the range — phase-wise,
   * a week or anything — click export, and it develops the report on its own, within the app").
   *
   * Choose a period, a scope and the sections; ONE call (report.get) brings the sums; everything below — the figures, the
   * changes against the period before, the charts and the sentences — is worked out here (lib/reportbuild.js), as Admin ›
   * Analysis does. Save as PDF is the browser's own print, with the A4 style in reports-print.css; the CSV holds the same
   * tables. Staff-only and lazy: never in a devotee's offline copy. The server forces the scope; this screen offers only
   * what report.options says it may.
   */
  import '../styles/screens.css';
  import './reports-print.css';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { fmtDate, fmtShort, todayIST, addDaysIso } from '../lib/dates.js';
  import { toCsv, fileName, saveCsv } from '../lib/csv.js';
  import { toast } from '../lib/pro.svelte.js';
  import { periodFor, coverText, summaryNumbers, changeOf, findings, practices, split, fillPct, quality, fmtNum, metric, figureOf, sumRows, THIN } from '../lib/reportbuild.js';
  import DateInput from '../ui/DateInput.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import Button from '../ui/Button.svelte';
  import LineChart from '../ui/LineChart.svelte';

  const SECTION_LABEL = { summary: 'Summary', reporting: 'Reporting', quality: 'Sadhana quality', attendance: 'Attendance', batches: 'Batches compared',
    facilitators: 'Facilitators', boards: 'Scoreboards and leaderboard', trainings: 'Trainings', work: "Coordinators' work", growth: 'Growth and care',
    health: 'Data health', next: 'What to do next' };
  const today = todayIST();

  let opts = $state(null), optErr = $state('');
  const loadOpts = () => { optErr = ''; call('report.options').then((o) => { opts = o; }).catch((e) => (optErr = errorMessage(e))); };
  loadOpts();

  let choice = $state('lastWeek'), phaseId = $state(''), trainingId = $state(''), from = $state(''), to = $state('');
  let compare = $state(true), kind = $state('all'), scopeId = $state('');
  let picked = $state(null);                       // the sections ticked (null = all, before the options arrive)
  const sections = $derived(opts?.sections || []);
  const ticked = $derived(picked || sections);
  const phases = $derived(opts?.phases || []), trainings = $derived(opts?.trainings || []);
  const phase = $derived(phases.find((p) => p.phaseId === phaseId) || phases[0] || null);
  const training = $derived(trainings.find((t) => t.batchId === trainingId) || trainings[0] || null);
  const CHOICES = $derived([['thisWeek', 'This week'], ['lastWeek', 'Last week'], ['thisMonth', 'This month'],
    ...(phases.length ? [['phase', 'A phase']] : []), ...(trainings.length ? [['training', 'A training']] : []), ['custom', 'Custom']]);
  const period = $derived(periodFor(choice, today, { phase, training, from, to }));
  const cover = $derived(!period.error && opts ? coverText(period.from, period.to, opts.lastClosed) : '');
  const before = $derived(!period.error ? { from: addDaysIso(period.from, -period.days), to: addDaysIso(period.from, -1) } : null);

  const scopeDefs = $derived(opts?.scopes || []);
  const KIND_LABEL = { batch: 'A batch', facilitator: 'A facilitator', training: 'A training' };
  const kindOptions = $derived(scopeDefs.map((s) => [s.kind, s.kind === 'all' ? s.label : s.kind === 'facilitator' && s.items.length === 1 && !opts?.scopes.some((x) => x.kind === 'facilitator' && x.items.length > 1) && scopeDefs.length < 4 ? 'My students' : KIND_LABEL[s.kind]]));
  const items = $derived(scopeDefs.find((s) => s.kind === kind)?.items || []);
  const itemId = $derived(items.some((i) => i.id === scopeId) ? scopeId : items[0]?.id || '');

  let rep = $state(null), building = $state(false), err = $state(''), fe = $state({}), builtAt = $state(''), docEl = $state();
  async function build() {
    if (period.error) return;
    building = true; err = ''; fe = {};
    try {
      const q = { from: period.from, to: period.to, compare, scope: kind === 'all' ? { kind: 'all' } : { kind, id: itemId } };
      if (ticked.length < sections.length) q.sections = [...ticked];
      rep = await call('report.get', q);
      builtAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      requestAnimationFrame(() => docEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    } catch (e) { fe = fieldErrors(e); err = Object.keys(fe).length ? Object.values(fe)[0] : errorMessage(e); }
    building = false;
  }
  const toggleSection = (id, on) => { const s = new Set(ticked); if (on) s.add(id); else s.delete(id); picked = sections.filter((x) => s.has(x)); };

  /* ---------- the figures, from the answer ---------- */
  const on = (id) => !!rep?.sections?.includes(id);
  const parts = $derived(rep ? split(rep) : { cur: [], prev: [] });
  const nums = $derived(rep ? summaryNumbers(rep) : []);
  const said = $derived(rep ? findings(rep) : { good: [], worry: [], actions: [] });
  const nameOf = (id) => rep?.batches?.find((b) => b.batchId === id)?.name || id;
  const classBatches = $derived((rep?.batches || []).filter((b) => !b.training && (rep.sadhana || []).some((w) => w.batchId === b.batchId)));
  const pct = (n, d) => (d > 0 ? (n * 100) / d : null);
  const dl = (cur, prev, unit = '%', digits = 0) => changeOf({ value: cur, prev, unit, digits });
  const rowsOf = (rows, id) => rows.filter((r) => r.batchId === id);

  // a cell: text, and optionally its change against the period before
  const c = (t, d = null, extra = {}) => ({ t: t === null || t === undefined ? '—' : String(t), d, ...extra });
  const num = (v, unit = '', digits = 0) => fmtNum(v, unit, digits);

  const tables = $derived.by(() => {
    if (!rep) return {};
    const T = {}, P = rep.people, cmp = !!rep.compare;
    if (on('reporting') && P) {
      const ids = [...new Set([...Object.keys(P.cur.byBatch), ...Object.keys(rep.students?.byBatch || {})])].filter((id) => P.cur.byBatch[id] || rep.students?.byBatch[id]);
      T.byBatch = { title: 'Reporting by batch', head: ['Batch', 'People now', 'Weeks filled', 'Of weeks due', 'Filled', 'Filled none'],
        body: ids.map((id) => { const g = P.cur.byBatch[id], gp = P.cmp?.byBatch[id];
          return [c(nameOf(id)), c(rep.students?.byBatch[id] ?? 0), c(g?.filled ?? 0), c(g?.due ?? 0), c(num(fillPct(g), '%'), cmp ? dl(fillPct(g), fillPct(gp)) : null), c(g?.never ?? 0, null, { warn: (g?.never || 0) > 0 })]; }) };
      const facName = Object.fromEntries((rep.facilitators || []).map((f) => [f.facId, f.name]));
      const fids = Object.keys(P.cur.byFac).sort((a, b) => P.cur.byFac[b].due - P.cur.byFac[a].due);
      T.byFac = { title: 'Reporting by facilitator', head: ['Facilitator', 'People', 'Weeks filled', 'Of weeks due', 'Filled', 'Filled none'],
        body: fids.map((id) => { const g = P.cur.byFac[id], gp = P.cmp?.byFac[id];
          return [c(id === '' ? 'No facilitator' : id === '-' ? 'Not in scope now' : facName[id] || id), c(g.people), c(g.filled), c(g.due), c(num(fillPct(g), '%'), cmp ? dl(fillPct(g), fillPct(gp)) : null), c(g.never, null, { warn: g.never > 0 })]; }) };
    }
    if (on('quality') && rep.sadhana) {
      const keys = ['overall', 'body', 'soul', 'bed', 'wake', 'rounds', 'reading', 'hearing', 'seva', 'night', 'principles', 'morning'];
      const s = sumRows(parts.cur);
      T.metrics = { title: 'Sadhana quality (filled weeks only)', head: ['Practice', 'Now', 'Before', 'Change', 'Rests on'],
        body: keys.filter((k) => figureOf(k, parts.cur) !== null || figureOf(k, parts.prev) !== null).map((k) => { const m = metric(k), a = figureOf(k, parts.cur), z = figureOf(k, parts.prev);
          const base = k === 'rounds' ? s.nRounds : k === 'morning' ? s.nMorning : s.submitted;
          return [c(m.label), c(num(a, m.unit, m.digits)), c(cmp ? num(z, m.unit, m.digits) : '—'), c(cmp ? dl(a, z, m.unit, m.digits).text || '—' : '—', null, { dir: dl(a, z, m.unit, m.digits).dir }), c(`${base} ${base === 1 ? 'week' : 'weeks'}`)]; }) };
    }
    if (on('attendance') && rep.sadhana) {
      T.attendance = { title: 'Class attendance by batch', head: ['Batch', 'Present', 'Marked', 'Attendance', 'Weeks with no class'],
        body: classBatches.map((b) => { const cur = rowsOf(parts.cur, b.batchId), prev = rowsOf(parts.prev, b.batchId), s = sumRows(cur);
          return [c(b.name), c(s.present), c(s.held), c(num(pct(s.present, s.held), '%'), cmp ? dl(pct(s.present, s.held), pct(sumRows(prev).present, sumRows(prev).held)) : null),
            c(cur.filter((w) => !w.held && w.submitted + w.missed > 0).length)]; }) };
    }
    if (on('batches') && rep.sadhana) {
      const fig = (k, rows) => figureOf(k, rows);
      T.compared = { title: 'Batches compared', head: ['Batch', 'Weeks filled', 'Sadhana score', 'Chanting', 'Wake-up', 'Attendance'],
        body: classBatches.map((b) => { const cur = rowsOf(parts.cur, b.batchId), prev = rowsOf(parts.prev, b.batchId);
          const cell = (k, unit, digits = 0) => c(num(fig(k, cur), unit, digits), cmp ? dl(fig(k, cur), fig(k, prev), unit, digits) : null);
          return [c(b.name), cell('filling', '%'), cell('overall', '%'), cell('rounds', '', 1), cell('wake', '%'), cell('attendance', '%')]; }) };
    }
    if (on('facilitators') && rep.facilitators) {
      const P2 = rep.people;
      T.facilitators = { title: 'Facilitators', head: ['Facilitator', 'Students', 'Weeks filled', 'Score (filled)', 'Seva', 'Sadhana', 'Goal', 'Net', 'Promoted'],
        body: rep.facilitators.map((f) => { const g = P2?.cur.byFac[f.facId], gp = P2?.cmp?.byFac[f.facId];
          return [c(f.name), c(f.students), c(num(fillPct(g), '%'), rep.compare ? dl(fillPct(g), fillPct(gp)) : null), c(num(quality(g), '%')),
            c(num(f.card?.seva, '%')), c(num(f.card?.sadhana, '%')), c(num(f.card?.goal, '%')), c(num(f.card?.rank, '%')), c(f.promoted)]; }) };
    }
    if (on('boards') && rep.board) {
      T.board = { title: `Scoreboard · ${rep.board.name} · week of ${fmtShort(rep.board.weekId)}`, head: ['Place · name', 'This week', 'Seva', 'Goal', 'Net', 'Weeks filled'],
        body: rep.board.rows.slice(0, 10).map((r) => [c(`${r.place ?? '—'} · ${r.name}`), c(num(r.week, '%')), c(num(r.seva, '%')), c(num(r.goal, '%')), c(num(r.rank, '%')), c(`${r.weeksFilled} of ${r.weeks}`)]) };
    }
    if (on('boards') && rep.leaderboard) {
      T.leaderboard = { title: 'Leaderboard · top devotees', head: ['Place · name', 'Batch', 'Score', 'Weeks', 'Missed'],
        body: rep.leaderboard.rows.map((r) => [c(`${r.rank} · ${r.name}`), c(nameOf(r.batchId)), c(r.score + '%'), c(r.weeks), c(r.missed)]) };
    }
    if (on('work') && rep.work?.byWho?.length) {
      T.work = { title: "Who did the work", head: ['Name', 'Actions', 'Sign-ups', 'Attendance', 'Resets', 'Reopened weeks'],
        body: rep.work.byWho.slice(0, 12).map((w) => [c(w.name), c(w.actions), c(w.approved), c(w.attendance), c(w.resets), c(w.reopens)]) };
    }
    if (on('trainings') && rep.trainings?.length) {
      T.trainings = { title: 'Trainings', head: ['Training', 'In it now', 'Qualified', 'To repeat', 'Left', 'Taken out', 'Attendance', 'Coordinator'],
        body: rep.trainings.map((x) => { const a = trAtt(x, rep.weeks), b = rep.compare ? trAtt(x, rep.compare.weeks) : null;
          return [c(x.name), c(x.active), c(x.qualified), c(x.repeat), c(x.left), c(x.removed), c(num(a, '%'), rep.compare ? dl(a, b) : null), c(x.coordinators.join(', ') || '—')]; }) };
    }
    return T;
  });
  const trAtt = (x, ws) => { const set = new Set(ws), r = x.weeks.filter((w) => set.has(w.weekId)); const p = r.reduce((n, w) => n + w.present, 0), h = r.reduce((n, w) => n + w.held, 0); return h ? (p * 100) / h : null; };

  // the weekly reporting bars and the score line
  const weekly = $derived(rep?.weeks?.map((w) => { const s = sumRows(parts.cur.filter((r) => r.weekId === w)); return { w, v: pct(s.submitted, s.submitted + s.missed), n: s.submitted + s.missed }; }) || []);
  const PALETTE = ['var(--accent)', 'var(--viz-soul)', 'var(--viz-body)', 'var(--viz-seva)', 'var(--viz-att)', 'var(--gold-decorative)'];
  const scoreSeries = $derived.by(() => {
    if (!rep?.weeks?.length) return [];
    const ids = classBatches.map((b) => b.batchId), by = (pred) => rep.weeks.map((w) => figureOf('overall', parts.cur.filter((r) => r.weekId === w && pred(r))));
    const all = { key: 'all', label: ids.length > 1 ? 'All' : nameOf(ids[0]), values: by(() => true), color: PALETTE[0] };
    return ids.length > 1 && ids.length <= 6 ? [all, ...ids.map((id, i) => ({ key: id, label: nameOf(id), values: by((r) => r.batchId === id), color: PALETTE[(i + 1) % PALETTE.length], dash: '5 4' }))] : [all];
  });
  const prac = $derived(rep ? practices(parts.cur) : []), pracBefore = $derived(rep ? Object.fromEntries(practices(parts.prev).map((p) => [p.key, p.value])) : {});
  const boardSum = $derived.by(() => {
    const rows = rep?.board?.rows || [], mean = (xs) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : null), vals = (k) => rows.map((r) => r[k]).filter((x) => x !== null && x !== undefined);
    return { people: rows.length, set: rows.filter((r) => r.asked > 0).length, filled: rows.filter((r) => r.filled > 0).length, seva: mean(vals('seva')), net: mean(vals('rank')) };
  });

  const periodWords = $derived(rep ? `${fmtDate(rep.from)} – ${fmtDate(rep.to)}` : '');
  const nWeeks = (n) => `${n} closed ${n === 1 ? 'week' : 'weeks'}`;

  /* ---------- saving ---------- */
  function savePdf() {
    if (typeof window.print !== 'function') { window.open(location.href, '_blank', 'noopener'); return; }
    const was = document.title;
    document.title = fileName('IYF-report', rep.scope.label, rep.from, rep.to).replace(/\.csv$/, '');
    window.print();
    setTimeout(() => (document.title = was), 1000);
  }
  async function saveTables() {
    const out = [['IYF Delhi · Sadhana report', rep.scope.label], ['Period', rep.from, rep.to], ...(rep.compare ? [['Compared with', rep.compare.from, rep.compare.to]] : []), []];
    out.push(['Summary'], ['Figure', 'Now', 'Before', 'Rests on'], ...nums.map((n) => [n.label, fmtNum(n.value, n.unit, n.digits), fmtNum(n.prev, n.unit, n.digits), n.base]), []);
    for (const t of Object.values(tables)) out.push([t.title], t.head, ...t.body.map((r) => r.map((x) => x.t + (x.d?.text && x.d.text !== 'steady' ? ` (${x.d.text})` : ''))), []);
    for (const [title, list] of [['Going well', said.good], ['Needs attention', said.worry], ['What to do next', said.actions]]) out.push([title], ...list.map((s) => [s]), []);
    try { await saveCsv(fileName('IYF-report', rep.scope.label, rep.from, rep.to), toCsv(out[0], out.slice(1))); }
    catch (e) { toast(errorMessage(e), { kind: 'err' }); }
  }
</script>

{#snippet delta(d)}{#if d?.text}<span class="rp-d" data-dir={d.dir > 0 ? 'up' : d.dir < 0 ? 'down' : 'flat'}>{d.text}</span>{/if}{/snippet}
{#snippet table(t)}
  <!-- a wide table scrolls inside its own box; focusable so a keyboard can scroll it -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="rp-tw" role="region" aria-label={t.title} tabindex="0">
    <table class="rp-t">
      <thead><tr>{#each t.head as h, i (i)}<th scope="col">{h}</th>{/each}</tr></thead>
      <tbody>
        {#each t.body as r, ri (ri)}<tr>{#each r as x, i (i)}{#if i === 0}<th scope="row">{x.t}</th>{:else}<td data-warn={x.warn || undefined} data-dir={x.dir > 0 ? 'up' : x.dir < 0 ? 'down' : undefined}>{x.t}{@render delta(x.d)}</td>{/if}{/each}</tr>
        {:else}<tr><td colspan={t.head.length} class="rp-none">Nothing in this period.</td></tr>{/each}
      </tbody>
    </table>
  </div>
{/snippet}
{#snippet sec(id, n, children)}
  {#if on(id)}<section class="rp-sec" aria-labelledby="rp-h-{id}"><h2 id="rp-h-{id}"><span class="rp-n">{n}</span>{SECTION_LABEL[id]}</h2>{@render children()}</section>{/if}
{/snippet}
{#snippet tile(label, value, d, base, thin)}
  <li class="rp-tile"><span class="rp-tl">{label}</span><strong>{value}</strong>
    {#if thin}<span class="rp-thin">too few to call a trend</span>{:else}{@render delta(d)}{/if}
    {#if base}<span class="rp-base">{base}</span>{/if}</li>
{/snippet}

<div class="rp-noprint">
  {#if optErr && !opts}<Banner onretry={loadOpts}>Couldn't load the report choices. {optErr}</Banner>
  {:else if !opts}<Skeleton kind="page" rows={3} />
  {:else}
    <form class="cblock rp-pick" onsubmit={(e) => { e.preventDefault(); build(); }} aria-label="Build a report">
      <fieldset class="rp-fs">
        <legend class="t-over">Period</legend>
        <div class="chiprow" role="group" aria-label="Period">
          {#each CHOICES as [v, t] (v)}<button type="button" class="chipbtn" aria-pressed={choice === v} onclick={() => (choice = v)}>{t}</button>{/each}
        </div>
        {#if choice === 'phase'}<WheelSelect id="rp-phase" label="Phase" class="rp-narrow" value={phase?.phaseId || ''} options={phases.map((p) => [p.phaseId, `${p.name} · ${fmtShort(p.startsOn)} – ${fmtShort(p.endsOn)}`])} onchange={(v) => (phaseId = v)} />
        {:else if choice === 'training'}<WheelSelect id="rp-training" label="Training" class="rp-narrow" value={training?.batchId || ''} options={trainings.map((x) => [x.batchId, x.name])} onchange={(v) => (trainingId = v)} />
        {:else if choice === 'custom'}<div class="pair rp-narrow"><DateInput id="rp-from" label="From" bind:value={from} error={fe.from} /><DateInput id="rp-to" label="To" bind:value={to} error={fe.to} hint="Up to a year" /></div>{/if}
        {#if period.error}{#if choice !== 'custom' || from || to}<p class="rp-hint rp-err" role="alert">{period.error}</p>{/if}
        {:else}<p class="rp-hint"><b>{fmtDate(period.from)} – {fmtDate(period.to)}</b> · {cover}</p>{/if}
      </fieldset>
      <fieldset class="rp-fs">
        <legend class="sr-only">Compared with</legend>
        <Toggle label="Compare with the period before" desc={before ? `${fmtDate(before.from)} – ${fmtDate(before.to)}, the same length` : 'The same length, just before'} bind:checked={compare} />
      </fieldset>
      <fieldset class="rp-fs">
        <legend class="t-over">Report on</legend>
        {#if kindOptions.length > 1}<div class="chiprow" role="group" aria-label="Report on" id="rp-kind">{#each kindOptions as [v, t] (v)}<button type="button" class="chipbtn" aria-pressed={kind === v} onclick={() => { kind = v; scopeId = ''; }}>{t}</button>{/each}</div>
        {:else}<p class="m-0 font-medium">{kindOptions[0]?.[1]}</p>{/if}
        {#if kind !== 'all' && items.length}<WheelSelect id="rp-item" label={KIND_LABEL[kind]?.replace('A ', '').replace(/^./, (x) => x.toUpperCase())} class="rp-narrow" value={itemId} options={items.map((i) => [i.id, i.name])} onchange={(v) => (scopeId = v)} error={fe['scope.id']} />{/if}
      </fieldset>
      <details class="rp-fs rp-secs">
        <summary><span class="t-over">Sections</span><span class="rp-hint">{ticked.length === sections.length ? `All ${sections.length}` : `${ticked.length} of ${sections.length}`}</span></summary>
        <div class="rp-checks">{#each sections as id (id)}<Checkbox card={false} label={SECTION_LABEL[id]} checked={ticked.includes(id)} onchange={(v) => toggleSection(id, v)} />{/each}</div>
      </details>
      <div class="rp-go"><Button type="submit" variant="primary" busy={building} disabled={!!period.error || !ticked.length}><Icon name="report" size={18} />Build the report</Button></div>
      {#if err}<p class="rp-hint rp-err" role="alert">{err}</p>{/if}
    </form>
  {/if}
</div>

{#if building && !rep}<Skeleton kind="page" rows={5} />{/if}
{#if rep}
  <div class="rp-bar rp-noprint">
    <p class="m-0 min-w-0 text-sm text-muted">{rep.scope.label} · {periodWords}</p>
    <div class="rp-acts"><button type="button" class="btn btn-sm btn-outline w-auto" onclick={saveTables}><Icon name="download" size={16} />CSV</button>
      <button type="button" class="btn btn-sm btn-primary w-auto" onclick={savePdf}><Icon name="download" size={16} />Save as PDF</button></div>
  </div>
  <article class="rp-doc" id="rpt" bind:this={docEl} aria-label="Report">
    <header class="rp-cover">
      <img src="/brand/iyf-emblem-128.webp" srcset="/brand/iyf-emblem-128.webp 1x, /brand/iyf-emblem-256.webp 2x" width="56" height="56" alt="IYF Delhi" />
      <div class="min-w-0">
        <p class="rp-org">IYF Delhi · Sādhana Record</p>
        <h1>Sadhana report · {rep.scope.label}</h1>
        <p class="rp-when">{periodWords} · {rep.days} days · {nWeeks(rep.weeks.length)}{rep.compare ? ` · compared with ${fmtShort(rep.compare.from)} – ${fmtShort(rep.compare.to)}` : ''}</p>
        <p class="rp-built">Built {builtAt} from the live data · a blank week is not a zero: scores are over filled weeks</p>
      </div>
    </header>

    {#if !rep.weeks.length}<p class="rp-note">No week of this period has closed yet: sadhana figures appear once a Monday deadline closes one. What is not tied to a week (work, growth, data health) is below.</p>{/if}

    {#snippet summaryBody()}
      <ul class="rp-tiles">{#each nums as n (n.key)}{@render tile(n.label, fmtNum(n.value, n.unit, n.digits), rep.compare ? changeOf(n) : null, n.base, n.thin && n.prev !== null)}{/each}</ul>
      <div class="rp-cols">
        {#if said.good.length}<div><p class="t-over rp-good">Going well</p><ul class="rp-sent">{#each said.good.slice(0, 3) as s (s)}<li><Icon name="up" size={14} />{s}</li>{/each}</ul></div>{/if}
        {#if said.worry.length}<div><p class="t-over rp-bad">Needs attention</p><ul class="rp-sent">{#each said.worry.slice(0, 3) as s (s)}<li><Icon name="down" size={14} />{s}</li>{/each}</ul></div>{/if}
      </div>
      {#if said.actions.length}<p class="t-over mt-3">Three things to do next</p><ol class="rp-acts-l">{#each said.actions as s (s)}<li>{s}</li>{/each}</ol>{/if}
    {/snippet}
    {@render sec('summary', 1, summaryBody)}

    {#snippet reportingBody()}
      {#if rep.people}
        {@const s0 = sumRows(parts.cur)}
        {@const p0 = sumRows(parts.prev)}
        {@const t = rep.people.cur.total.due ? rep.people.cur.total : { people: 0, never: 0, filled: s0.submitted, due: s0.submitted + s0.missed }}
        {@const tp = rep.people.cur.total.due ? rep.people.cmp?.total : rep.compare ? { people: 0, never: 0, filled: p0.submitted, due: p0.submitted + p0.missed } : null}
        <ul class="rp-tiles">
          {@render tile('Weeks filled', fmtNum(fillPct(t), '%'), tp ? dl(fillPct(t), fillPct(tp)) : null, `${t.filled} of ${t.due} weeks due`, t.due < THIN)}
          {#if t.people}{@render tile('Filled no week', String(t.never), tp?.people ? dl(t.never, tp.never, '') : null, `of ${t.people} people due`, false)}
          {@render tile('People due', String(t.people), null, rep.students ? `${rep.students.total} active now` : '', false)}{/if}
        </ul>
        {#if weekly.length > 1}
          <figure class="rp-fig"><figcaption>Weeks filled, week by week</figcaption>
            <div class="rp-wbox" style:max-width="{weekly.length * 72}px"><svg class="rp-wbars" viewBox="0 0 {Math.max(weekly.length * 28, 280)} 120" preserveAspectRatio="none" role="img" aria-label="Weeks filled each week: {weekly.map((x) => `${fmtShort(x.w)} ${fmtNum(x.v, '%')}`).join(', ')}">
              {#each [0, 50, 100] as g (g)}<line x1="0" x2="100%" y1={110 - g} y2={110 - g} stroke="var(--divider)" stroke-width="1" vector-effect="non-scaling-stroke" />{/each}
              {#each weekly as x, i (x.w)}{@const W = Math.max(weekly.length * 28, 280) / weekly.length}<rect x={i * W + W * 0.18} width={W * 0.64} y={110 - (x.v ?? 0)} height={Math.max(1, x.v ?? 0)} rx="3" fill={x.v !== null && x.v < 50 ? 'var(--warn-line)' : 'var(--accent)'}><title>{fmtShort(x.w)}: {fmtNum(x.v, '%')} of {x.n}</title></rect>{/each}
            </svg>
            <div class="rp-wlab"><span>{fmtShort(weekly[0].w)}</span><span>{fmtShort(weekly[weekly.length - 1].w)}</span></div></div>
          </figure>
        {/if}
        {#if tables.byBatch}{@render table(tables.byBatch)}{/if}
        {#if tables.byFac?.body.length}{@render table(tables.byFac)}{/if}
      {:else}<p class="rp-none">No closed week to count.</p>{/if}
    {/snippet}
    {@render sec('reporting', 2, reportingBody)}

    {#snippet qualityBody()}
      {#if parts.cur.length}
        {#if prac.length}
          <ul class="rp-bars" aria-label="Practices, weakest first">
            {#each prac as p (p.key)}<li><span class="rp-bl">{p.label}</span><span class="rp-track"><i style:width="{Math.max(0, Math.min(100, p.value))}%" data-low={p.value < 50 || undefined}></i>{#if rep.compare && pracBefore[p.key] !== undefined}<b class="rp-was" style:left="{Math.max(0, Math.min(100, pracBefore[p.key]))}%" title="Before: {fmtNum(pracBefore[p.key], '%')}"></b>{/if}</span><span class="rp-bv">{fmtNum(p.value, '%')}</span></li>{/each}
          </ul>
          {#if rep.compare}<p class="rp-key"><b class="rp-was-k"></b> the period before</p>{/if}
        {/if}
        {#if scoreSeries.length && rep.weeks.length > 1}<figure class="rp-fig"><figcaption>Sadhana score, week by week (filled weeks)</figcaption><LineChart weeks={rep.weeks} series={scoreSeries} unit="%" max={100} label="Sadhana score" /></figure>{/if}
        {#if tables.metrics}{@render table(tables.metrics)}{/if}
      {:else}<p class="rp-none">No filled week in this period.</p>{/if}
    {/snippet}
    {@render sec('quality', 3, qualityBody)}

    {#snippet attendanceBody()}
      {@const s = sumRows(parts.cur)}
      {@const sp = sumRows(parts.prev)}
      <ul class="rp-tiles">{@render tile('Class attendance', fmtNum(pct(s.present, s.held), '%'), rep.compare ? dl(pct(s.present, s.held), pct(sp.present, sp.held)) : null, `${s.present} present of ${s.held} marked`, s.held < THIN)}</ul>
      {#if tables.attendance?.body.length}{@render table(tables.attendance)}{:else}<p class="rp-none">No class marked in this period.</p>{/if}
    {/snippet}
    {@render sec('attendance', 4, attendanceBody)}

    {#snippet batchesBody()}{#if tables.compared?.body.length}{@render table(tables.compared)}{:else}<p class="rp-none">No batch has a closed week in this period.</p>{/if}{/snippet}
    {@render sec('batches', 5, batchesBody)}

    {#snippet facBody()}{#if tables.facilitators?.body.length}{@render table(tables.facilitators)}{:else}<p class="rp-none">No facilitator in this scope.</p>{/if}{/snippet}
    {@render sec('facilitators', 6, facBody)}

    {#snippet boardsBody()}
      {#if rep.board}
        <ul class="rp-tiles">
          {@render tile('On the scoreboard', String(boardSum.people), null, rep.board.training ? 'the training' : rep.board.name, false)}
          {@render tile('Set targets', String(boardSum.set), null, `of ${boardSum.people}`, false)}
          {@render tile('Filled that week', String(boardSum.filled), null, `week of ${fmtShort(rep.board.weekId)}`, false)}
          {@render tile('Average net', fmtNum(boardSum.net, '%'), null, 'seva and goal', false)}
        </ul>
        {@render table(tables.board)}
      {/if}
      {#if tables.leaderboard}{@render table(tables.leaderboard)}{/if}
      {#if !rep.board && !tables.leaderboard}<p class="rp-none">No scoreboard or leaderboard for this scope and period.</p>{/if}
    {/snippet}
    {@render sec('boards', 7, boardsBody)}

    {#snippet trainBody()}{#if tables.trainings}{@render table(tables.trainings)}{:else}<p class="rp-none">No training in this scope.</p>{/if}{/snippet}
    {@render sec('trainings', 8, trainBody)}

    {#snippet workBody()}
      {#if rep.work}
        {@const w = rep.work.cur}
        {@const wp = rep.work.cmp}
        <ul class="rp-tiles">
          {@render tile('Sign-ups answered', String(w.approved + w.rejected), wp ? dl(w.approved + w.rejected, wp.approved + wp.rejected, '') : null, `${w.approved} approved · ${w.rejected} declined`, false)}
          {@render tile('Answered in', w.medianHours === null ? '—' : w.medianHours < 48 ? `${Math.round(w.medianHours)} h` : `${Math.round(w.medianHours / 24)} days`, null, w.decisions ? `median of ${w.decisions}` : 'no sign-up decided', false)}
          {@render tile('Passwords reset', String(w.resets), wp ? dl(w.resets, wp.resets, '') : null, w.resetsRejected ? `${w.resetsRejected} declined` : '', false)}
          {@render tile('Weeks reopened', String(w.reopened), null, `${w.reopenAsked} asked · ${w.reopenRejected} declined`, false)}
          {@render tile('Attendance marked', String(w.attendance + w.groupMarks), null, w.attendanceLate ? `${w.attendanceLate} changed late` : 'times', false)}
          {@render tile('Filled for someone', String(w.filledFor), null, 'weeks', false)}
        </ul>
        {#if rep.work.waiting.signups}<p class="rp-note">{rep.work.waiting.signups} {rep.work.waiting.signups === 1 ? 'sign-up is' : 'sign-ups are'} waiting now{rep.work.waiting.oldest ? `, the oldest since ${fmtDate(rep.work.waiting.oldest.slice(0, 10))}` : ''}.</p>{/if}
        {#if tables.work}{@render table(tables.work)}{/if}
      {:else}<p class="rp-none">Not part of this scope.</p>{/if}
    {/snippet}
    {@render sec('work', 9, workBody)}

    {#snippet growthBody()}
      {#if rep.growth}
        {@const g = rep.growth.cur}
        {@const gp = rep.growth.cmp}
        <ul class="rp-tiles">
          {#if g.joined !== null}{@render tile('New devotees', String(g.joined), gp ? dl(g.joined, gp.joined, '') : null, 'sign-ups approved', false)}{/if}
          {@render tile('Promoted', String(g.promoted), gp ? dl(g.promoted, gp.promoted, '') : null, rep.growth.promotedByLevel.map((x) => `${x.n} to ${x.level}`).join(' · '), false)}
          {@render tile('Went inactive', String(g.inactive), gp ? dl(g.inactive, gp.inactive, '') : null, '', false)}
          {@render tile('Came back', String(g.back), gp ? dl(g.back, gp.back, '') : null, '', false)}
          {@render tile('Birthdays', String(g.birthdays), null, 'in the period', false)}
        </ul>
      {/if}
    {/snippet}
    {@render sec('growth', 10, growthBody)}

    {#snippet healthBody()}
      {#if rep.health}
        {@const h = rep.health}
        <ul class="rp-health">
          <li data-ok={!h.noFacilitator || undefined}><span>No facilitator</span><b>{h.noFacilitator}</b></li>
          <li data-ok={!h.missingProfile || undefined}><span>Profile not complete (birth date or address)</span><b>{h.missingProfile}</b></li>
          {#if h.orphans !== null}<li data-ok={!h.orphans || undefined}><span>Facilitator stopped facilitating</span><b>{h.orphans}</b></li>{/if}
          {#if h.duplicates !== null}<li data-ok={!h.duplicates || undefined}><span>Possible duplicates waiting for review</span><b>{h.duplicates}</b></li>{/if}
          {#if h.waiting !== null}<li data-ok={!h.waiting || undefined}><span>Sign-ups waiting</span><b>{h.waiting}</b></li>{/if}
          <li data-ok><span>Active devotees in scope</span><b>{h.people}</b></li>
        </ul>
      {/if}
    {/snippet}
    {@render sec('health', 11, healthBody)}

    {#snippet nextBody()}
      <div class="rp-cols">
        <div><p class="t-over rp-good">Going well</p>{#if said.good.length}<ul class="rp-sent">{#each said.good as s (s)}<li><Icon name="up" size={14} />{s}</li>{/each}</ul>{:else}<p class="rp-none">Nothing to call a rise on yet.</p>{/if}</div>
        <div><p class="t-over rp-bad">Needs attention</p>{#if said.worry.length}<ul class="rp-sent">{#each said.worry as s (s)}<li><Icon name="down" size={14} />{s}</li>{/each}</ul>{:else}<p class="rp-none">Nothing stands out.</p>{/if}</div>
      </div>
      {#if said.actions.length}<p class="t-over mt-3">The three most useful actions</p><ol class="rp-acts-l">{#each said.actions as s (s)}<li>{s}</li>{/each}</ol>{/if}
    {/snippet}
    {@render sec('next', 12, nextBody)}
    <footer class="rp-foot">Quiz and assessments are not recorded in the app yet; they join this report when they are.</footer>
  </article>
{:else if opts && !building}
  <EmptyState icon="report" title="Choose a period and build">The report is worked out from the live data each time.</EmptyState>
{/if}

<style>
  .rp-pick { display: grid; gap: var(--sp-4); }
  .rp-fs { min-width: 0; margin: 0; padding: 0; border: 0; display: grid; gap: var(--sp-2); }
  .rp-fs > legend { padding: 0; margin-bottom: var(--sp-2); }
  .rp-pick :global(.rp-narrow) { max-width: 480px; margin-bottom: 0; }
  .rp-hint { margin: 0; font-size: var(--fs-sm); color: var(--text-secondary); }
  .rp-err { color: var(--danger); }
  .rp-secs > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; cursor: pointer; list-style: none; }
  .rp-secs > summary::-webkit-details-marker { display: none; }
  .rp-secs > summary::after { content: ''; width: 12px; height: 8px; background: var(--chev) no-repeat center / contain; transition: rotate var(--d-2) var(--ease); }
  .rp-secs[open] > summary::after { rotate: 180deg; }
  .rp-secs > summary .rp-hint { margin-left: auto; }
  .rp-checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 2px 16px; padding-top: 4px; }
  .rp-go { display: flex; }
  @media (min-width: 600px) { .rp-go :global(.btn) { width: auto; min-width: 220px; } }
  .rp-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin: var(--sp-5) 0 var(--sp-3); }
  .rp-acts { display: flex; gap: 8px; margin-left: auto; }

  .rp-doc { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface-elevated); box-shadow: var(--shadow-1); overflow: hidden; }
  .rp-cover { display: flex; align-items: center; gap: 14px; padding: 18px var(--sp-4); color: #fff;
              background: linear-gradient(120deg, var(--brand-navy, #002888), var(--acc-l, #004fdc) 70%, #1b6cf0); }
  .rp-cover img { flex: none; width: 52px; height: 52px; border-radius: 50%; background: #fff; padding: 3px; box-sizing: border-box; }
  .rp-cover h1 { margin: 2px 0; font-family: var(--font-serif); font-size: clamp(1.2rem, 1rem + 1vw, 1.6rem); font-weight: 600; line-height: 1.2; color: #fff; overflow-wrap: anywhere; }
  .rp-org { margin: 0; font-size: var(--fs-caption); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
  .rp-when { margin: 0; font-size: var(--fs-sm); opacity: .95; }
  .rp-built { margin: 4px 0 0; font-size: var(--fs-caption); opacity: .8; }
  .rp-sec { padding: var(--sp-4); border-top: 1px solid var(--border); }
  @media (min-width: 768px) { .rp-sec, .rp-cover { padding-inline: var(--sp-5); } }
  .rp-sec h2 { display: flex; align-items: baseline; gap: 10px; margin: 0 0 var(--sp-3); font-size: 1.125rem; }
  .rp-n { display: inline-grid; place-items: center; flex: none; min-width: 26px; height: 26px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-size: var(--fs-sm); font-weight: 700; font-variant-numeric: tabular-nums; }
  .rp-note { margin: var(--sp-3) var(--sp-4); padding: 10px 12px; border-radius: var(--r-md); background: var(--info-soft); color: var(--text); font-size: var(--fs-sm); }
  .rp-sec .rp-note { margin: var(--sp-3) 0; }
  .rp-none { margin: 0; color: var(--text-muted); font-size: var(--fs-sm); }

  .rp-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: var(--sp-2); margin: 0 0 var(--sp-3); padding: 0; list-style: none; }
  .rp-tile { display: grid; align-content: start; gap: 2px; min-width: 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
  .rp-tile strong { font-size: 1.3rem; font-variant-numeric: tabular-nums; line-height: 1.25; }
  .rp-tl { font-size: var(--fs-xs); font-weight: 650; color: var(--text-secondary); }
  .rp-base, .rp-thin { font-size: var(--fs-xs); color: var(--text-muted); overflow-wrap: anywhere; }
  .rp-d { display: inline-block; margin-left: 6px; font-size: var(--fs-xs); font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rp-tile .rp-d { margin-left: 0; }
  .rp-d[data-dir='up'] { color: var(--success); } .rp-d[data-dir='down'] { color: var(--danger); } .rp-d[data-dir='flat'] { color: var(--text-muted); font-weight: 500; }

  .rp-cols { display: grid; gap: var(--sp-3); }
  @media (min-width: 768px) { .rp-cols { grid-template-columns: 1fr 1fr; } }
  .rp-good { color: var(--success); margin: 0 0 6px; } .rp-bad { color: var(--danger); margin: 0 0 6px; }
  .rp-sent { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: var(--fs-sm); }
  .rp-sent li { display: flex; align-items: flex-start; gap: 6px; }
  .rp-sent :global(svg) { flex: none; margin-top: 3px; }
  .rp-acts-l { display: grid; gap: 6px; margin: 4px 0 0; padding-left: 1.4em; font-size: var(--fs-sm); list-style: decimal; }
  .rp-acts-l li::marker { color: var(--accent); font-weight: 700; }

  .rp-tw { margin: var(--sp-3) 0 0; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r-md);
           /* a table wider than the screen scrolls in its box; a soft shadow at the edge says there is more */
           background: linear-gradient(to right, var(--surface) 30%, transparent) left / 32px 100% no-repeat local,
                       linear-gradient(to left, var(--surface) 30%, transparent) right / 32px 100% no-repeat local,
                       radial-gradient(farthest-side at 0 50%, rgb(0 0 0 / .16), transparent) left / 12px 100% no-repeat scroll,
                       radial-gradient(farthest-side at 100% 50%, rgb(0 0 0 / .16), transparent) right / 12px 100% no-repeat scroll, var(--surface); }
  .rp-tw:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  .rp-t { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .rp-t th, .rp-t td { padding: 8px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--divider); }
  .rp-t thead th { position: sticky; top: 0; font-size: var(--fs-xs); font-weight: 650; color: var(--text-secondary); background: var(--surface-2); white-space: normal; vertical-align: bottom; min-width: 4.75rem; }
  .rp-t th[scope='row'], .rp-t thead th:first-child { text-align: left; white-space: normal; min-width: 8.5rem; font-weight: 600; }
  .rp-t tbody tr:last-child > * { border-bottom: 0; }
  .rp-t td .rp-d { display: block; margin: 1px 0 0; }
  @media (max-width: 599px) { .rp-t th, .rp-t td { padding: 7px 8px; } .rp-t th[scope='row'], .rp-t thead th:first-child { min-width: 6.5rem; } }
  .rp-t td[data-warn] { color: var(--warning); font-weight: 650; }
  .rp-t td[data-dir='up'] { color: var(--success); } .rp-t td[data-dir='down'] { color: var(--danger); }
  .rp-t .rp-none { text-align: left; }
  .rp-tw::before { content: attr(aria-label); display: block; padding: 8px 10px 0; font-size: var(--fs-xs); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); position: sticky; left: 0; }

  .rp-fig { margin: var(--sp-3) 0 0; }
  .rp-fig figcaption { margin-bottom: 6px; font-size: var(--fs-xs); font-weight: 650; color: var(--text-secondary); }
  .rp-wbars { display: block; width: 100%; height: 120px; }
  .rp-wlab { display: flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--text-muted); }

  .rp-bars { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .rp-bars li { display: grid; grid-template-columns: minmax(6.5rem, 9.5rem) minmax(0, 1fr) 3rem; align-items: center; gap: 10px; font-size: var(--fs-sm); }
  .rp-bl { overflow-wrap: anywhere; }
  .rp-track { position: relative; height: 12px; border-radius: 999px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--divider); }
  .rp-track i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--accent); }
  .rp-track i[data-low] { background: repeating-linear-gradient(135deg, var(--warn-line) 0 5px, color-mix(in srgb, var(--warn-line) 45%, var(--surface)) 5px 9px); }
  .rp-was, .rp-was-k { position: absolute; top: -3px; width: 3px; height: 18px; margin-left: -1.5px; border-radius: 2px; background: var(--text); }
  .rp-was-k { position: relative; display: inline-block; top: 3px; height: 14px; margin: 0 6px 0 2px; }
  .rp-bv { text-align: right; font-weight: 650; font-variant-numeric: tabular-nums; }
  .rp-key { margin: 6px 0 0; font-size: var(--fs-xs); color: var(--text-muted); }

  .rp-health { margin: 0; padding: 0; list-style: none; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
  .rp-health li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; font-size: var(--fs-sm); }
  .rp-health li + li { border-top: 1px solid var(--divider); }
  .rp-health b { min-width: 2.5rem; padding: 1px 8px; border-radius: 999px; text-align: center; background: var(--warning-soft); color: var(--warning); font-variant-numeric: tabular-nums; }
  .rp-health li[data-ok] b { background: var(--surface-2); color: var(--text-secondary); }
  .rp-foot { padding: 12px var(--sp-4) 16px; border-top: 1px solid var(--border); font-size: var(--fs-xs); color: var(--text-muted); }
</style>
