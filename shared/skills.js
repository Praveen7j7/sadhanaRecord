// Service skills a devotee can offer, from the list the user gave (11 Oct 2026). The kinds of seva IYF
// actually needs, so a coordinator can ask "who can lead kirtan?" or "who can cook prasadam?".
//
// A FIXED list, never free text: a typed answer cannot be searched, and the whole point of collecting
// this is to find people for a service. Optional at sign-up; stored in profiles.skills as a JSON array
// of these exact strings. One copy, used by the app and checked by the server.
export const SKILLS = [
  'Public Speaking / Katha',
  'Teaching / Education',
  'Facilitation / Counseling',
  'Leadership / Team Management',
  'Event / Yatra Management',
  'Cooking / Prasadam Service',
  'Decoration / Art',
  'Music / Kirtan',
  'Writing / Content Creation',
  'Graphic Design',
  'Photography / Videography / Editing',
  'Social Media / Digital Marketing',
  'Software / IT Skills',
  'Fundraising / Public Relations',
  'Driving / Logistics',
];
