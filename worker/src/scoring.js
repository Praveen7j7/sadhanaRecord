// The server's scoring: the shared scoring (../../shared/scoring.js, also used by the app for live marks)
// applied to the cards by name. Kept by name here so the server never trusts a card sent by a phone.
import { CARDS } from './cards.js';
import * as core from '../../shared/scoring.js';

export { clockMinutes, roundHalfAway, pct100, CATEGORIES } from '../../shared/scoring.js';
const card = name => { if (!CARDS[name]) throw new Error('Unknown card ' + name); return CARDS[name]; };
export const dayMarks = (cardName, day) => core.dayMarks(card(cardName), day);
export const sevaScore = (cardName, minutes) => core.sevaScore(card(cardName), minutes);
export const weekScores = (cardName, days, attendance, sevaMinutes) => core.weekScores(card(cardName), days, attendance, sevaMinutes);
