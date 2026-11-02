// 12-hour clock on screen, "HH:MM" (24-hour) stored and sent, as the contract wants.
const pad = (n) => String(n).padStart(2, '0');
export function to12(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const H = Number(m[1]);
  return { h: H % 12 || 12, m: Number(m[2]), pm: H >= 12 };
}
export const to24 = (h, m, pm) => `${pad((h % 12) + (pm ? 12 : 0))}:${pad(m)}`;

/** Start times of a card's ranges (for one-tap picks); open-ended "before …" ranges have none. */
export const quickPicks = (options = []) => options.filter((o) => o.from).map((o) => ({ time: o.from, marks: o.marks }));

/** Angle on the dial (degrees clockwise from 12 o'clock) → hour 1–12 or minute (5-minute steps). */
export const hourAt = (deg) => Math.round((((deg % 360) + 360) % 360) / 30) % 12 || 12;
export const minuteAt = (deg) => (Math.round((((deg % 360) + 360) % 360) / 30) * 5) % 60;
