// Home's birthday line (the head, 27 Oct 2026): home.get's `birthdays: [{ name, self }]`, batch-mates born today, by name
// only. Returns the two lines the card shows: `mine` for the reader's own birthday, `others` for everyone else ('' = none).
export function birthdayLines(list, first = '') {
  const all = Array.isArray(list) ? list : [];
  const names = all.filter((b) => !b.self).map((b) => b.name);
  const mine = all.some((b) => b.self) ? `Happy birthday${first ? ', ' + first : ''}!` : '';
  const n = names.length;
  const others = !n ? ''
    : n === 1 ? `Today is ${names[0]}'s birthday`
    : `Today is the birthday of ${n <= 3 ? names.slice(0, -1).join(', ') + ' and ' + names[n - 1] : `${names[0]}, ${names[1]} and ${n - 2} more`}`;
  return { mine, others };
}
