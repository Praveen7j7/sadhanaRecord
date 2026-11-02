// One navigation model (Phase 4) for every screen size and every role. The person's scopes decide WHAT is in it;
// the screen size only decides HOW it is drawn: the bottom bar (< 600 px, the first 5 primary items), the rail
// (600–1023 px, up to 7) and the drawer / sidebar (every section). Hiding an item is presentation only: the server
// stays the authority on what anyone may see.
import { canRequests, can } from './scopes.js';

// the admin tabs and the list of real paths both live in the route table now (audit FE-20).
// imported, not just re-exported: the nav items below use ADMIN_PATHS themselves.
import { ADMIN_PATHS } from '../routes.js';
export { ADMIN_PATHS };
const isBatch = (p) => ['/batch', '/members', '/stats', '/leaders', '/ready', '/newbatch'].includes(p) || p.startsWith('/devotee/') || p.startsWith('/fill/');
/*
 * A coordinator of TRAININGS only (every batch they hold is an ETP-style one).
 *
 * A training has no sign-ups to approve, no members and no group leaders: its coordinator ENROLS
 * people who are already in the app, and those people stay devotees of their own batch. So the ETP
 * coordinator was shown a Requests inbox nothing can arrive in, a Devotees list that reads 0, and
 * Group leaders for a batch that has none (the head, 18 Oct 2026).
 *
 * Somebody who holds a class batch AND a training keeps the full set: those screens are meaningful
 * for the class half of their work.
 */
const TRAINING = /^(ETP|MTP|FTP)-\d+$/;
const onlyTrainings = (sc) => !sc.master && sc.coordinator.length > 0 && sc.coordinator.every((b) => TRAINING.test(b));
const classWork = (sc) => canRequests(sc) && !onlyTrainings(sc);
// Scoreboards belong to TRAININGS (and the head's facilitators board): an SPS coordinator running an
// ordinary class batch has nothing on them, and was shown the item anyway because it was gated on
// canRequests, which is true for every coordinator (the head, 18 Oct 2026).
const holdsTraining = (sc) => sc.coordinator.some((b) => TRAINING.test(b));
// the FTP coordinator (ADR 0019) sees the whole facilitators' board, as the head does, unless the head took it away
const seesBoards = (sc) => !!sc.master || holdsTraining(sc) || (!!sc.ftp && can(sc, 'facBoard'));
const isAccount = (p) => p === '/account' || p === '/change-password';

// id, href, label (menu), short (bar / rail), icon, area (accent family: null = the person's own), section, show(scopes),
// match (this item's own screen), tab (the bar / rail item stays lit for these screens too), rank (bar / rail order)
const ITEMS = [
  { id: 'home', href: '#/home', label: 'Home', icon: 'home', show: () => true, match: (p) => p === '/home', tab: (p, sc) => p === '/home' || (!!sc.devotee && (p === '/hearing' || p === '/reading')), rank: 0 },
  { id: 'week', href: '#/week', label: 'This week', short: 'Week', icon: 'week', area: 'devotee', section: 'mine', show: (sc) => !!sc.devotee, match: (p) => /^\/(week|day)(\/|$)/.test(p), rank: 1 },
  { id: 'report', href: '#/report', label: 'Report', icon: 'report', area: 'devotee', section: 'mine', show: (sc) => !!sc.devotee, match: (p) => p === '/report' || p.startsWith('/history'), rank: 2 },
  { id: 'hearing', href: '#/hearing', label: 'Hearing', icon: 'hear', area: 'devotee', section: 'mine', show: (sc) => !!sc.devotee, match: (p) => p === '/hearing' },
  { id: 'reading', href: '#/reading', label: 'Reading', icon: 'book', area: 'devotee', section: 'mine', show: (sc) => !!sc.devotee, match: (p) => p === '/reading' },
  // Share sadhana (27 Oct 2026): who sees my sadhana besides my facilitator, and whose I see; a shared report stays lit here
  { id: 'share', href: '#/share', label: 'Share sadhana', short: 'Share', icon: 'share', area: 'devotee', section: 'mine', show: (sc) => !!sc.devotee, match: (p) => p === '/share' || p.startsWith('/share/') || p.startsWith('/shared/') },
  { id: 'group', href: '#/group', label: 'My group', short: 'Group', icon: 'users', area: 'devotee', section: 'mine', show: (sc) => !!sc.groupLeader, match: (p) => p === '/group' },
  { id: 'batch', href: '#/batch', label: 'Batch status', short: 'Batch', icon: 'users', area: 'coordinator', section: 'batch', show: canRequests, match: (p) => p === '/batch' || p === '/newbatch' || p.startsWith('/devotee/') || p.startsWith('/fill/'), tab: isBatch, rank: 3 },
  { id: 'members', href: '#/members', label: 'Devotees', icon: 'user', area: 'coordinator', section: 'batch', show: classWork, match: (p) => p === '/members' },
  { id: 'leaders', href: '#/leaders', label: 'Group leaders', icon: 'users', area: 'coordinator', section: 'batch', show: (sc) => classWork(sc) && can(sc, 'leaders'), match: (p) => p === '/leaders' },
  { id: 'stats', href: '#/stats', label: 'Filling chart', icon: 'report', area: 'coordinator', section: 'batch', show: classWork, match: (p) => p === '/stats' },
  { id: 'requests', href: '#/requests', label: 'Requests', icon: 'inbox', area: 'coordinator', section: 'batch', show: (sc) => classWork(sc) && (can(sc, 'signups') || can(sc, 'resets')), match: (p) => p === '/requests', badge: 'requests', rank: 4 },
  { id: 'students', href: '#/my-devotees', label: 'My students', short: 'Students', icon: 'users', area: 'coordinator', section: 'fac', show: (sc) => !!sc.facilitator, match: (p) => p.startsWith('/my-devotees'), rank: 5 },
  // the promotion explorer (phase 21): who of their students may move up, as the dashboard's Explorer tab
  { id: 'explorer', href: '#/explorer', label: 'Promotion explorer', short: 'Explorer', icon: 'up', area: 'coordinator', section: 'fac', show: (sc) => !!sc.facilitator, match: (p) => p === '/explorer' },
  // The target card. A trainee has one while their training runs; a facilitator has one for the
  // phase. Nobody else does, and an empty card is worse than no tab (the head, 18 Oct 2026). The
  // label follows who is reading it: a trainee is in a training, a facilitator is not.
  // The scoreboards: the head sees every running training and the facilitators; a training's own
  // coordinator sees their board here too (the head, 18 Oct 2026).
  // a training's students, straight from the sidebar (the head, 18 Oct 2026): enrolling is the
  // training coordinator's main job, and it was a tab two clicks deep under Batch status
  { id: 'trainees', href: '#/students', label: 'Students', icon: 'users', area: 'coordinator', section: 'batch',
    show: (sc) => holdsTraining(sc), match: (p) => p === '/students' },
  // in the BATCH section, not the facilitator one: a scoreboard is staff work, and the head has no
  // facilitator role of their own to hang it under
  // the FTP coordinator's facilitator list (the head has it under Admin)
  { id: 'ftpfacs', href: '#/fac-team', label: 'Facilitators', icon: 'users', area: 'coordinator', section: 'batch',
    show: (sc) => !!sc.ftp && !sc.master, match: (p) => p === '/fac-team' },
  { id: 'scoreboards', href: '#/scoreboards', label: 'Scoreboards', short: 'Scores', icon: 'report', area: 'coordinator', section: 'batch',
    show: seesBoards, match: (p) => p === '/scoreboards', rank: 8 },
  // the sadhana leaderboard (ADR 0013): a class batch's coordinator and the head; not a training's
  // Reports (Phase 23 P14), given by the head (`reports`): their own batches' or students' report; the head's is under Admin
  { id: 'myreports', href: '#/reports', label: 'Reports', icon: 'report', area: 'coordinator', section: 'batch',
    show: (sc) => !sc.master && sc.rights?.reports === 'allow' && sc.coordinator.length > 0, match: (p) => p === '/reports' },
  { id: 'facreports', href: '#/reports', label: 'Reports', icon: 'report', area: 'coordinator', section: 'fac',
    show: (sc) => !sc.master && sc.rights?.reports === 'allow' && !sc.coordinator.length && !!sc.facilitator, match: (p) => p === '/reports' },
  { id: 'leaderboard', href: '#/leaderboard', label: 'Leaderboard', icon: 'report', area: 'coordinator', section: 'batch',
    show: (sc) => !!sc.master || classWork(sc), match: (p) => p === '/leaderboard' },
  { id: 'card', href: '#/card', label: 'My targets', short: 'Targets', icon: 'report', area: 'coordinator', section: 'fac',
    show: (sc) => !sc.trainee && !!sc.facilitator, match: (p) => p === '/card', rank: 7 },
  // their OWN place on a board, beside their card (the head, 22 Oct 2026 — ADR 0016): a facilitator on the
  // facilitators' board, a trainee on their training's. Staff who see whole boards reach them from Scoreboards above.
  { id: 'myboard', href: '#/scoreboards', label: 'Scoreboard', icon: 'report', area: 'coordinator', section: 'fac',
    show: (sc) => !seesBoards(sc) && !sc.trainee && !!sc.facilitator, match: (p) => p === '/scoreboards' },
  /*
   * A trainee's card, under the training's own name (the head, 18 Oct 2026). Suraj Sahu was enrolled
   * and had the card all along — filed as "Facilitator › My targets", because enrolling also makes a
   * trainee a facilitator. Nothing on the screen said ETP, so it read as missing. It now sits in a
   * section named after the training and on the phone bar, for exactly as long as they are in it.
   */
  { id: 'etp', href: '#/card', label: 'Weekly card', short: 'ETP', icon: 'report', area: 'devotee', section: 'train',
    show: (sc) => !!sc.trainee, match: (p) => p === '/card', rank: 2 },
  { id: 'etpboard', href: '#/scoreboards', label: 'Scoreboard', icon: 'report', area: 'devotee', section: 'train',
    show: (sc) => !seesBoards(sc) && !!sc.trainee, match: (p) => p === '/scoreboards' },
  { id: 'overview', href: '#/overview', label: 'All batches', short: 'Admin', icon: 'report', area: 'admin', section: 'admin', show: (sc) => sc.master, match: (p) => p === '/overview', tab: (p) => ADMIN_PATHS.includes(p), rank: 6, barIcon: 'shield' },
  // every Admin page is its own entry (the head, 10 Oct 2026: "if things remain under groups, finding where it is can itself
  // become a trouble"; "no redundant option"): Staff and Facilitators apart; the old People pages (all devotees, all group
  // leaders) were the batch tools' Devotees and Group leaders again, so they are those (#/devotees, #/groups redirect)
  ...[['analysis', 'Analysis', 'report'], ['reports', 'Reports', 'download'], ['coordinators', 'Staff', 'user'], ['access', 'Access', 'shield'], ['facilitators', 'Facilitators', 'users'], ['phases', 'Phases', 'week'], ['batches', 'Batch setup', 'grid'], ['ids', 'IYF IDs', 'spark'], ['activity', 'Activity', 'clock'], ['settings', 'Settings', 'grid']]
    .map(([id, label, icon, paths = ['/' + id]]) => ({ id, href: '#/' + id, label, icon, area: 'admin', section: 'admin', show: (sc) => sc.master, match: (p) => paths.includes(p) })),
  // reopen requests are part of the one Requests inbox (8 Oct 2026); #/reopens redirects there
  // Announcements: the bell in the top bar is its one place (8 Oct 2026); no menu row
  { id: 'wall', href: '#/wall', label: 'Announcements', icon: 'bell', section: 'none', show: () => true, match: (p) => p === '/wall', badge: 'unread' },
  // Vaishnava Songs (phase 21): the song book beside the account; phase 22 C5: only for someone with their own sadhana form
  { id: 'songs', href: '#/songs', label: 'Vaishnava Songs', short: 'Songs', icon: 'music', section: 'you', show: (sc) => !!sc.devotee, match: (p) => p === '/songs' || p.startsWith('/songs/') },
  { id: 'account', href: '#/account', label: 'Account', icon: 'user', section: 'you', show: () => true, match: isAccount, rank: 9 },
];
const SECTIONS = [['mine', 'My Sadhana', 'devotee'], ['train', 'Training', 'devotee'], ['fac', 'Facilitator', 'coordinator'], ['batch', 'My batch', 'coordinator'], ['admin', 'Admin', 'admin'], ['you', 'You', null]];

/** The area of a staff person's own screens (as lib/area.js): the head's are wine, a coordinator's saffron. */
export const ownArea = (sc) => (sc.devotee ? 'devotee' : sc.master ? 'admin' : 'coordinator');

/**
 * The navigation for these scopes (scopesOf(user)).
 * primary: the bar / rail items in order (Account last); the bar shows the first `BAR` of them, the rail all.
 * sections: the drawer / sidebar, each with its own area colour. A devotee's Home sits in "My Sadhana";
 * staff with no sadhana of their own get Home on its own at the top.
 */
export const BAR = 5;
export function navFor(sc) {
  const own = ownArea(sc), mine = ITEMS.filter((i) => i.show(sc)).map((i) => ({ ...i, area: i.area || own, short: i.short || i.label }));
  // a facilitator who also coordinates reaches their students from the menu (the bar keeps the batch tools)
  // the bar rule (8 Oct 2026): Home → own daily action → queue → highest scope → Account (the bar shows the first 4 and
  // Account, the rail all). Staff who also fill their own sadhana keep Requests (and the head, Admin) on the phone bar;
  // a group leader has My group there.
  const staff = canRequests(sc);
  // The phone bar is unchanged for a trainee: their ETP card lives in the sidebar, under the
  // training's own name, and the bar keeps its one clean look (the head, 18 Oct 2026).
  const order = ['home', ...(sc.devotee ? ['week'] : []), ...(sc.groupLeader && !staff ? ['group'] : []),
    ...(!staff ? [] : sc.master ? ['requests', 'overview', 'batch'] : sc.devotee ? ['requests', 'batch'] : ['batch', 'requests']),
    ...(sc.facilitator && !staff ? ['students'] : []), ...(sc.devotee ? ['report'] : []), ...(sc.groupLeader && staff ? ['group'] : [])];
  const ranked = order.map((id) => mine.find((i) => i.id === id)).filter(Boolean).concat(mine.filter((i) => i.id === 'account'));
  const primary = [...ranked.filter((i) => i.id !== 'account').slice(0, 6), ranked.find((i) => i.id === 'account')];
  const sections = SECTIONS.map(([id, label, area]) => ({ id, label: id === 'train' && sc.trainee?.name ? sc.trainee.name : label, area: area || own, items: mine.filter((i) => i.section === id || (i.id === 'home' && id === 'mine' && sc.devotee)) }))
    .filter((s) => s.items.length);
  const top = sc.devotee ? null : mine.find((i) => i.id === 'home');
  return { primary, sections, top };
}
/** True when this primary item is the one to light up for this screen (its own screen, or one it stands for). */
export const isTab = (item, path, sc) => (item.tab ? item.tab(path, sc) : item.match(path));
/** The bar / rail shows the first BAR - 1 items and Account on a phone; this says whether an item is rail-only. */
export const railOnly = (primary, i) => primary.length > BAR && i >= BAR - 1 && i < primary.length - 1;

// Every screen the app has (a deep link to anything else is "not found"; one outside the person's scopes is "not available")
// Does the app have this screen? One answer, from the route table (audit FE-20): this used to be its own list of
// regexes that had to agree with App.svelte's, and a path in one but not the other either loaded with no title or
// showed "Page not found" for a screen that existed.
export { knownRoute } from '../routes.js';
