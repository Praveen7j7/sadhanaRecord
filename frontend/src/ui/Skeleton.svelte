<script>
  // Shimmer placeholders shaped like the screen that is loading, so content swaps in without moving.
  // They appear only after ~150 ms of waiting (CSS delay: no flash on a fast load); static under reduced motion.
  // kind: cards (default) · page · home · list · form · board · detail · chart
  let { rows = 3, kind = 'cards', label = 'Loading…' } = $props();
</script>

{#snippet line(w, cls = '')}<span class="sk sk-line {cls}" style:width={w}></span>{/snippet}
{#snippet row()}<span class="sk-row"><span class="sk sk-circle"></span><span class="grid flex-1 gap-2">{@render line('55%')}{@render line('35%', 'sk-thin')}</span></span>{/snippet}

<div class="skw" aria-hidden="true">
  {#if kind === 'home'}
    <div class="sk sk-block h-[132px]"></div>
    <div class="mt-6 mb-3">{@render line('28%', 'sk-big')}</div>
    <div class="sk-card"><span class="sk-row"><span class="sk sk-circle h-[52px] w-[52px]"></span><span class="grid flex-1 gap-2">{@render line('60%')}{@render line('35%', 'sk-thin')}</span></span>
      <span class="sk-days">{#each Array(7) as _}<span class="sk sk-block h-[52px]"></span>{/each}</span><span class="sk sk-block h-11"></span></div>
    <div class="sk sk-block mt-4 h-[300px]"></div>
  {:else if kind === 'list'}
    <div class="sk-card p-0">{#each Array(rows) as _}{@render row()}{/each}</div>
  {:else if kind === 'form'}
    <div class="grid gap-4 md:grid-cols-2">{#each Array(Math.max(2, rows)) as _}<div class="sk-card">{@render line('30%', 'sk-big')}{#each Array(2) as __}<span class="grid gap-2">{@render line('25%', 'sk-thin')}<span class="sk sk-block h-11"></span></span>{/each}</div>{/each}</div>
  {:else if kind === 'board'}
    <div class="sk sk-block h-[52px]"></div>
    <div class="my-3 flex gap-2">{#each Array(4) as _}<span class="sk sk-pill"></span>{/each}</div>
    <div class="sk-card p-0">{#each Array(rows) as _}<span class="sk-row">{@render line('40%')}<span class="ml-auto flex gap-1"><span class="sk sk-block h-11 w-11"></span><span class="sk sk-block h-11 w-11"></span></span></span>{/each}</div>
  {:else if kind === 'detail'}
    <div class="grid gap-4 md:grid-cols-2"><div class="sk-card"><span class="sk-row p-0"><span class="sk sk-circle h-20 w-20"></span><span class="grid flex-1 gap-2">{@render line('60%', 'sk-big')}{@render line('40%', 'sk-thin')}</span></span><span class="sk sk-block h-11"></span>{#each Array(4) as _}{@render line('100%', 'sk-thin')}{/each}</div>
      <div class="sk-card">{@render line('40%', 'sk-big')}{#each Array(3) as _}<span class="sk sk-block h-16"></span>{/each}</div></div>
  {:else if kind === 'chart'}
    <div class="grid gap-4 md:grid-cols-2"><div class="sk-card">{@render line('40%', 'sk-big')}<span class="sk sk-block h-[260px]"></span></div><div class="sk-card">{@render line('40%', 'sk-big')}<span class="sk-bars">{#each [60, 85, 40, 70, 95, 55, 75] as h}<span class="sk sk-block" style:height={h + '%'}></span>{/each}</span></div></div>
  {:else}
    {#if kind === 'page'}<div class="grid gap-2 py-2">{@render line('40%', 'sk-big')}{@render line('60%', 'sk-thin')}</div>{/if}
    <div class="mt-2 grid gap-3">{#each Array(rows) as _, i}<div class="sk sk-block h-20" class:opacity-70={i === rows - 1}></div>{/each}</div>
  {/if}
</div>
<span class="sr-only" role="status">{label}</span>
