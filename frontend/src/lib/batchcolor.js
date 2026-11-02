// A colour per batch, the same everywhere a batch is named (console pattern #9, audit §8.3; 22 Oct 2026): SPS blue,
// DPS gold, BSS teal, BVS violet, TRD saffron, ETP wine; Vedic intakes take the SPS family. Callers pass the batch row, whose `level` decides (SPSO is level SPS); an id alone
// is read only for level-coded ids (SPS2, VL2-51, ETP-21). The theme owns the
// values (--sw-* in app.css, light and dark); the hex after each is only the fallback until those tokens exist.
const SW = { SPS: ['--sw-sps', '#3b6fe0'], VL2: ['--sw-sps', '#3b6fe0'], VL3: ['--sw-sps', '#3b6fe0'],
  DPS: ['--sw-dps', '#c99a1c'], BSS: ['--sw-bss', '#1f9a8a'], BVS: ['--sw-bvs', '#8a5cd6'], TRD: ['--sw-trd', '#e07b1f'], ETP: ['--sw-etp', '#a3324f'] };
/** The batch's level from its row, or from its id (SPS2 → SPS, VL2-51 → VL2, ETP-21 → ETP). */
export const levelOf = (b) => String((typeof b === 'object' ? b?.level : '') || (typeof b === 'object' ? b?.batchId : b) || '').toUpperCase().replace(/-\d+$/, '').replace(/\d+$/, '');
/** A CSS colour for the batch: `style:--sw={batchColor(b)}`. */
export function batchColor(b) { const s = SW[levelOf(b)]; return s ? `var(${s[0]}, ${s[1]})` : 'var(--border)'; }
