// From 1024 px the staff lists open their items beside the list (list + detail, Phase 5, 9 Oct 2026); below it an
// item is its own page. One shared, live flag.
const mq = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null;
export const wide = $state({ on: !!mq?.matches });
mq?.addEventListener('change', () => (wide.on = mq.matches));
