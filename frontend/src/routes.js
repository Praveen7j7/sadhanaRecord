// Every screen the app has, once (13 October 2026; audit FE-20 / roadmap 4.1).
//
// A route used to be described in five places that had to agree by hand: App.svelte decided which file to load
// and whether the scopes allowed it, nav.js listed the patterns it would admit at all, Shell.svelte held the
// titles, area.js the accent colour, prefetch.js the file to fetch on pointerdown. Adding a screen meant five
// edits, and nothing noticed if you made four — the symptom was a screen that loaded but had no title, or was
// titled but answered "Page not found", or quietly fell back to the signed-out brand.
//
// This table is the one description. Each entry says:
//   re       which paths it matches (tested against the path WITHOUT its ?query)
//   screen   the key App.svelte loads, or null for a screen that lives in the startup chunk
//   scope    who may open it: a function of scopesOf(user); omitted means any signed-in person
//   title    what the top bar says (a string, or a function of the path for "Deepak · Week")
//   area     which accent family the whole page takes
//   load     the dynamic import, shared by App.svelte and prefetch.js so a tap and a navigation fetch one file
//
// `routes.test.js` keeps the table and its consumers honest: every entry needs a title and an area, every screen
// key needs a loader, and nav/area/prefetch must agree with the table rather than with their own copies.
//
// Order matters: the first match wins, so put the specific patterns above the general ones (/fill/x/day before
// /fill/, /devotee/x/week before /devotee/x).

const devotee = (sc) => !!sc?.devotee;
const leader = (sc) => !!sc?.groupLeader;
const facilitator = (sc) => !!sc?.facilitator;
const staff = (sc) => !!sc?.master || (sc?.coordinator?.length > 0);
// a staff screen whose right the head may turn off for one person (ADR 0015/0019): hidden when it is off
const staffCan = (...ids) => (sc) => staff(sc) && (!!sc?.master || ids.some((id) => sc?.rights?.[id] !== 'deny'));
const master = (sc) => !!sc?.master;
const anyone = () => true;

/** The admin tabs, in the order the menu shows them. Kept here because nav.js and area.js both need the list. */
export const ADMIN_PATHS = ['/overview', '/analysis', '/reports', '/devotees', '/groups', '/coordinators', '/access', '/facilitators', '/phases', '/batches', '/scoreboards', '/ids', '/reopens', '/activity', '/settings'];

/** The signed-out screens. They are not in ROUTES: App.svelte picks between them before any scope exists. */
export const PUBLIC_PATHS = ['/welcome', '/login', '/signup', '/forgot'];
/**
 * Old addresses that still work for old bookmarks and links, each sent to where the page lives now (G19, 22 Oct 2026).
 * One table, followed in one place (App.svelte), instead of three screens each redirecting their own.
 */
export const REDIRECTS = { '/reopens': '/requests?type=reopen', '/devotees': '/members', '/groups': '/leaders' };

const firstName = (path) => (new URLSearchParams(path.split('?')[1] || '').get('n') || '').trim().split(' ')[0];

export const ROUTES = [
  // filling for someone else — the most specific patterns first
  { re: /^\/fill\/[^/]+\/day\/\d{4}-\d\d-\d\d\/\d{4}-\d\d-\d\d$/, screen: 'devotee', scope: staffCan('fillFor'), area: 'coordinator',
    title: (p) => `${firstName(p) || 'Fill for'} · Day`, load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/fill\/[^/]+\/week\/\d{4}-\d\d-\d\d$/, screen: 'devotee', scope: staffCan('fillFor'), area: 'coordinator',
    title: (p) => `${firstName(p) || 'Fill for'} · Week`, load: () => import('./devotee/Devotee.svelte') },

  // a devotee's own sadhana
  { re: /^\/(home)?$/, screen: null, scope: anyone, title: 'Home', area: 'shared' },
  { re: /^\/week(\/\d{4}-\d\d-\d\d)?$/, screen: 'devotee', scope: devotee, title: 'This week', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/day\/\d{4}-\d\d-\d\d\/\d{4}-\d\d-\d\d$/, screen: 'devotee', scope: devotee, title: 'Daily sadhana', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/history(\/\d{4}-\d\d-\d\d)?$/, screen: 'devotee', scope: devotee, title: 'History', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/report$/, screen: 'devotee', scope: devotee, title: 'Report', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/hearing$/, screen: 'devotee', scope: devotee, title: 'Hearing', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/reading$/, screen: 'devotee', scope: devotee, title: 'Reading', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  { re: /^\/learn$/, screen: 'devotee', scope: devotee, title: 'Hearing', area: 'devotee', load: () => import('./devotee/Devotee.svelte') },
  // Share sadhana (27 Oct 2026): their own two lists; a sadhana shared WITH them opens the facilitator's student page,
  // read-only and without contact. `anyone` there: share.devotee / share.week decide, per share, on every call
  { re: /^\/share(\/with-me)?$/, screen: 'share', scope: devotee, title: 'Share sadhana', area: 'devotee', load: () => import('./screens/Share.svelte') },
  { re: /^\/shared\/[^/]+\/\d{4}-\d\d-\d\d$/, screen: 'fac', scope: anyone, title: 'Week', area: 'devotee', load: () => import('./fac/Fac.svelte') },
  { re: /^\/shared\/[^/]+$/, screen: 'fac', scope: anyone, title: 'Shared sadhana', area: 'devotee', load: () => import('./fac/Fac.svelte') },

  // shared by every signed-in person
  { re: /^\/wall$/, screen: 'wall', scope: anyone, title: 'Announcements', area: 'shared', load: () => import('./devotee/Wall.svelte') },
  { re: /^\/account$/, screen: 'account', scope: anyone, title: 'Account', area: 'shared', load: () => import('./screens/Account.svelte') },
  // Vaishnava Songs (phase 21): the song book; #/songs/<id> is one song. Phase 22 C5 (the head, 26 Oct: "only visible to
  // the user's login"): only someone with their own sadhana form (scopes.devotee); a staff-only or head-only login has none
  { re: /^\/songs(\/s\d{3})?$/, screen: 'songs', scope: devotee, title: 'Vaishnava Songs', area: 'shared', load: () => import('./screens/Songs.svelte') },
  { re: /^\/change-password$/, screen: 'password', scope: anyone, title: 'Change password', area: 'shared', load: () => import('./screens/ChangePassword.svelte') },

  // a group leader, and a facilitator
  { re: /^\/group$/, screen: 'group', scope: leader, title: 'My group', area: 'devotee', load: () => import('./devotee/Group.svelte') },
  { re: /^\/my-devotees\/[^/]+\/\d{4}-\d\d-\d\d$/, screen: 'fac', scope: facilitator, title: 'Week', area: 'coordinator', load: () => import('./fac/Fac.svelte') },
  { re: /^\/my-devotees\/[^/]+$/, screen: 'fac', scope: facilitator, title: 'Student', area: 'coordinator', load: () => import('./fac/Fac.svelte') },
  { re: /^\/my-devotees$/, screen: 'fac', scope: facilitator, title: 'My students', area: 'coordinator', load: () => import('./fac/Fac.svelte') },
  // the promotion explorer (phase 21): their students eligible to move up, any batch, with thresholds of their own
  { re: /^\/explorer$/, screen: 'explorer', scope: facilitator, title: 'Promotion explorer', area: 'coordinator', load: () => import('./fac/Explorer.svelte') },

  // the target card: a facilitator and an ETP student fill the same one. `anyone` because the
  // server decides whether a card exists for this person — a scope test here would have to
  // guess at ETP membership, and guessing wrong hides somebody's own card from them.
  // the scoreboards: every running training and the facilitators (board.list answers for the caller,
  // so a training's coordinator reaches this too and sees only their own board; a facilitator or trainee sees their
  // own place on theirs — ADR 0016)
  // the FTP coordinator's facilitator list (ADR 0019): the head's Admin › Facilitators screen, without the head's own parts
  { re: /^\/fac-team$/, screen: 'ftpfacs', scope: (sc) => !!sc?.ftp, title: 'Facilitators', area: 'coordinator', load: () => import('./master/Facilitators.svelte') },
  { re: /^\/scoreboards$/, screen: 'scoreboards', scope: (sc) => !!sc?.master || (!!sc?.ftp && sc?.rights?.facBoard !== 'deny') || (sc?.coordinator || []).some((b) => /^(ETP|MTP|FTP)-\d+$/.test(b)) || !!sc?.facilitator || !!sc?.trainee, title: 'Scoreboards', area: 'coordinator', load: () => import('./coord/Scoreboards.svelte') },
  { re: /^\/card$/, screen: 'card', scope: anyone, title: 'My targets', area: 'devotee', load: () => import('./screens/Card.svelte') },

  // a coordinator's batch
  { re: /^\/requests$/, screen: 'requests', scope: staffCan('signups', 'resets'), title: 'Requests', area: 'coordinator', load: () => import('./coord/Requests.svelte') },
  { re: /^\/batch$/, screen: 'batch', scope: staff, title: 'Batch status', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  { re: /^\/members$/, screen: 'batch', scope: staff, title: 'Devotees', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  { re: /^\/stats$/, screen: 'batch', scope: staff, title: 'Filling chart', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  { re: /^\/leaders$/, screen: 'batch', scope: staffCan('leaders'), title: 'Group leaders', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  // closing a Vedic intake: the tab shows only for VL-2/VL-3, but the route exists for anyone who keeps the link
  { re: /^\/closing$/, screen: 'batch', scope: staffCan('promote'), title: 'Close batch', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  // asking the head to start a new VL-2 / VL-3 intake or a training (Phase 23): every coordinator, a tab of Batch status
  { re: /^\/newbatch$/, screen: 'batch', scope: staff, title: 'New batch', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  { re: /^\/board$/, screen: 'batch', scope: staff, title: 'Board', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  // the sadhana leaderboard (ADR 0013): class-batch coordinators and the head
  // Admin › Reports (Phase 23 P14): the head; or a coordinator / facilitator the head gave `reports` (their own scope, server-forced)
  { re: /^\/reports$/, screen: 'reports', scope: (sc) => !!sc?.master || (sc?.rights?.reports === 'allow' && (!!sc?.facilitator || (sc?.coordinator || []).length > 0)), title: 'Reports', area: 'coordinator', load: () => import('./master/Reports.svelte') },
  { re: /^\/leaderboard$/, screen: 'leaderboard', scope: (sc) => !!sc?.master || (sc?.coordinator || []).some((b) => !/^(ETP|MTP|FTP)-\d+$/.test(b)), title: 'Leaderboard', area: 'coordinator', load: () => import('./coord/Leaderboard.svelte') },
  { re: /^\/ready$/, screen: 'batch', scope: staff, title: 'Ready to move up', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  { re: /^\/students$/, screen: 'batch', scope: staff, title: 'Students', area: 'coordinator', load: () => import('./coord/Batch.svelte') },
  { re: /^\/devotee\/[^/]+\/week\/\d{4}-\d\d-\d\d$/, screen: 'devweek', scope: staff, title: 'Week', area: 'coordinator', load: () => import('./ui/WeekRead.svelte') },
  { re: /^\/devotee\/[^/]+$/, screen: 'detail', scope: staff, title: 'Devotee', area: 'coordinator', load: () => import('./coord/DevoteeDetail.svelte') },

  // the IYF head
  { re: /^\/overview$/, screen: 'admin', scope: master, title: 'All batches', area: 'admin', load: () => import('./master/Admin.svelte') },
  // the head's trends and report across every batch and training (phase 21)
  { re: /^\/analysis$/, screen: 'admin', scope: master, title: 'Analysis', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/devotees$/, screen: 'admin', scope: master, title: 'All devotees', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/groups$/, screen: 'admin', scope: master, title: 'Group leaders', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/coordinators$/, screen: 'admin', scope: master, title: 'Coordinators', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/facilitators$/, screen: 'admin', scope: master, title: 'Facilitators', area: 'admin', load: () => import('./master/Admin.svelte') },
  // permissions per person (ADR 0015): the head gives and takes
  { re: /^\/access$/, screen: 'admin', scope: master, title: 'Access', area: 'admin', load: () => import('./master/Admin.svelte') },
  // the phases every card and board runs over (ADR 0017)
  { re: /^\/phases$/, screen: 'admin', scope: master, title: 'Phases', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/batches$/, screen: 'admin', scope: master, title: 'Batch setup', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/ids$/, screen: 'admin', scope: master, title: 'IYF IDs', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/reopens$/, screen: 'admin', scope: master, title: 'Requests', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/activity$/, screen: 'admin', scope: master, title: 'Activity', area: 'admin', load: () => import('./master/Admin.svelte') },
  { re: /^\/settings$/, screen: 'admin', scope: master, title: 'Settings', area: 'admin', load: () => import('./master/Admin.svelte') },
];

const bare = (path) => String(path || '/').split('?')[0];

/** The entry for a path, or null when the app has no such screen. */
export const routeOf = (path) => ROUTES.find((r) => r.re.test(bare(path))) || null;

/** Does the app have this screen at all? (A path with no entry is "Page not found".) */
export const knownRoute = (path) => !!routeOf(path);

/** May this person open it? `sc` is scopesOf(user). An unknown path is not "allowed". */
export const allowed = (path, sc) => { const r = routeOf(path); return !!r && (r.scope || anyone)(sc); };

/** The screen key App.svelte must load, or null for one already in the startup chunk. Null for a path the person
 *  may not open, so App.svelte shows "Not available to you" rather than loading it. */
export const screenOf = (path, sc) => { const r = routeOf(path); return r && (r.scope || anyone)(sc) ? r.screen : null; };

/** The top bar's title. */
export const titleOf = (path) => { const r = routeOf(path); const t = r?.title; return typeof t === 'function' ? t(String(path || '')) : (t || ''); };

/** The file to fetch for a path (used on pointerdown and by App.svelte). */
export const loaderOf = (path) => routeOf(path)?.load || null;

/** Every loader, by screen key — App.svelte's LOAD map, derived rather than written twice. */
export const LOADERS = Object.fromEntries(ROUTES.filter((r) => r.screen && r.load).map((r) => [r.screen, r.load]));
