<script>
  // How to use, for this person's roles only (8 Oct 2026): a devotee sees the daily steps; a group leader, facilitator,
  // coordinator or IYF head also sees their own work. Keyboard shortcuts only on a computer with a mouse.
  import { session } from '../lib/session.svelte.js';
  import { scopesOf, canRequests } from '../lib/scopes.js';
  let { open = '' } = $props();
  const sc = $derived(scopesOf(session.user));
  // a coordinator of trainings ONLY: their work is enrolling and the board, not sign-ups and members
  const TRAINING = /^(ETP|MTP|FTP)-\d+$/;
  const trainingOnly = $derived(!sc.master && sc.coordinator.length > 0 && sc.coordinator.every((b) => TRAINING.test(b)));
  const fine = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
</script>

{#snippet tip(summary, isOpen = false)}
  <summary>{summary}</summary>
{/snippet}

<div class="howto">
  {#if sc.devotee}
    <h3 class="t-over">Your sadhana</h3>
    <details class="disclose" open={open === 'day'}>{@render tip('Filling in your day')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Home</b> › <b>Fill today</b>. Choose the hearing topic and the book, add the minutes, then <b>Save</b>. Nothing is sent until you tap Save.</p></details>
    <details class="disclose">{@render tip('Submitting your week')}
      <p class="m-0 pb-3 text-sm text-muted"><b>This week</b> › <b>Submit week</b>, in the submit window shown there (from Sunday evening to the Monday deadline). Days you filled count even if some are missing.</p></details>
    <details class="disclose">{@render tip('Sharing')}
      <p class="m-0 pb-3 text-sm text-muted">Tap <b>Share</b> on a saved day or a submitted week to send it on WhatsApp.</p></details>
    <details class="disclose">{@render tip('No signal?')}
      <p class="m-0 pb-3 text-sm text-muted">Keep filling in. Your entries stay on this phone; tap <b>Save</b> when you are back online.</p></details>
    <details class="disclose">{@render tip('Reminders')}
      <p class="m-0 pb-3 text-sm text-muted">Turn on <b>Notifications</b> on this page for the evening reminder when your day is not filled.</p></details>
  {/if}
  {#if sc.groupLeader}
    <h3 class="t-over">Group leader</h3>
    <details class="disclose">{@render tip('Marking attendance')}
      <p class="m-0 pb-3 text-sm text-muted"><b>My group</b> › tap <b>P</b> or <b>A</b> for each devotee, from Sunday, then <b>Save</b>.</p></details>
    <details class="disclose">{@render tip('Reminding your group')}
      <p class="m-0 pb-3 text-sm text-muted"><b>My group</b> shows who still has to submit first. Tap a name to call or message them.</p></details>
  {/if}
  {#if sc.facilitator}
    <h3 class="t-over">Facilitator</h3>
    <details class="disclose">{@render tip('Finding who needs you')}
      <p class="m-0 pb-3 text-sm text-muted"><b>My students</b> lists your students with this week's status; open any week from their page.</p></details>
    <details class="disclose">{@render tip("Reading a student's week")}
      <p class="m-0 pb-3 text-sm text-muted">Open a student, then a week, to see each day's practice and the scores. It is read-only.</p></details>
  {/if}
  <!-- A training's coordinator does none of the work below: nobody signs up into a training, it has
       no members and no group leaders, and its people fill their OWN batch's week. They enrol, mark
       the training's class, and read the board (the head, 18 Oct 2026). -->
  {#if trainingOnly}
    <h3 class="t-over">Training coordinator</h3>
    <details class="disclose" open={open === 'day'}>{@render tip('Adding a student')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Batch status</b> › <b>Students</b>. Search anyone in IYF by name, phone or IYF ID and tap <b>Add</b>. They stay in their own batch and keep filling the same week.</p></details>
    <details class="disclose">{@render tip('Taking somebody out')}
      <p class="m-0 pb-3 text-sm text-muted">On <b>Students</b>, tap <b>Remove</b>. Their card stops being the training's; what they filled stays readable.</p></details>
    <details class="disclose">{@render tip("The week's class")}
      <p class="m-0 pb-3 text-sm text-muted"><b>Board</b> shows whether each student filled their card this week, with <b>P</b> and <b>A</b> to mark the training's own class. One mark per student per week, and it does not touch their own batch's attendance.</p></details>
    <details class="disclose">{@render tip('Scores')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Board</b> carries each student's week and their average over the training's dates. Tap a row to open their card.</p></details>
    <details class="disclose">{@render tip('Closing the training')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Close batch</b> when it finishes. Students are marked <b>qualified</b> — they gain the facilitator's card without moving batch — and the cards become a record.</p></details>
  {:else if canRequests(sc)}
    <h3 class="t-over">{sc.master ? 'IYF head' : 'Coordinator'}</h3>
    <details class="disclose">{@render tip('Requests')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Requests</b> holds everything waiting for you: sign-ups to approve and password resets{sc.master ? ', reopen requests and the wall\'s reports' : ''}.</p></details>
    <details class="disclose">{@render tip('Batch status and attendance')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Batch status</b> shows each devotee's week. Mark attendance from Sunday; your mark counts over the group leader's.</p></details>
    <!-- the rule All batches stated in a paragraph under its table until Phase 24 (V30) -->
    <details class="disclose">{@render tip('Who counts as inactive')}
      <p class="m-0 pb-3 text-sm text-muted">A devotee becomes inactive by themselves after 30 days with no day filled and no use of the app, and is back when they fill a day or open the app. Marked inactive by staff: back when they fill a day.</p></details>
    <details class="disclose">{@render tip('A week with no regular class')}
      <p class="m-0 pb-3 text-sm text-muted"><b>Batch status</b> › <b>No regular class this week?</b> Choose why, and whether everyone counts as present.</p></details>
    <details class="disclose">{@render tip('Filling for someone')}
      <p class="m-0 pb-3 text-sm text-muted">On a devotee's page, <b>Fill</b> an open week for them when they cannot. It is saved as filled by the coordinator.</p></details>
    <details class="disclose">{@render tip(sc.master ? 'Reopening a week' : 'Asking to reopen a week')}
      <p class="m-0 pb-3 text-sm text-muted">{sc.master ? 'In Requests, reopen a missed week until a time, or reject the request with a reason.' : 'On a devotee\'s page, a missed week has Ask to reopen. The IYF head decides.'}</p></details>
    {#if sc.master}
      <details class="disclose">{@render tip('Staff, settings and activity')}
        <p class="m-0 pb-3 text-sm text-muted"><b>Admin</b> has coordinators and facilitators, batches, IYF IDs, the settings (submit window, reminder time) and the Activity log of every change.</p></details>
    {/if}
  {/if}
  {#if fine}
    <details class="disclose">{@render tip('Keyboard shortcuts')}
      <ul class="m-0 grid list-none gap-1 p-0 pb-3 text-sm text-muted">
        {#if canRequests(sc)}<li><kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd>: go to a screen or devotee</li>{/if}
        <li><kbd>g</kbd> <kbd>h</kbd>: Home{#if sc.devotee} · <kbd>g</kbd> <kbd>w</kbd>: Week · <kbd>g</kbd> <kbd>r</kbd>: Report{/if}{#if canRequests(sc)} · <kbd>g</kbd> <kbd>b</kbd>: Batch{/if}{#if sc.facilitator} · <kbd>g</kbd> <kbd>s</kbd>: Students{/if}</li>
        <li><kbd>g</kbd> <kbd>a</kbd>: Account · <kbd>g</kbd> <kbd>n</kbd>: Announcements · <kbd>?</kbd>: this page</li>
      </ul></details>
  {/if}
</div>

<style>
  .howto .t-over { margin: var(--sp-4) 0 var(--sp-1); }
  .howto .t-over:first-child { margin-top: 0; }
</style>
