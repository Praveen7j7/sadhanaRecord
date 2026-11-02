// Phase 6 (9 Oct 2026): Activity in names, and the changed fields in plain words
import { describe, it, expect } from 'vitest';
import { auditLine, auditParts, auditDiff } from '../src/lib/admin.js';

describe('Activity lines', () => {
  it('uses names when the server sends them', () => {
    expect(auditLine({ who: 'sps', whoName: 'SPS Team', action: 'devotees.setPeople', target: '6000000012', targetName: 'Bhavesh Jain', after: { classDay: 'SUN' } }))
      .toBe('SPS Team changed the facilitator / class day of Bhavesh Jain · Sunday class');
    expect(auditParts({ who: 'master', role: 'MASTER', action: 'settings.update', target: 'settings' })).toEqual({ who: 'IYF head', verb: 'changed the settings', target: '', extra: '' });
  });
  it('lists only the fields that changed, in plain words', () => {
    expect(auditDiff({ before: { facilitator: 'Natvar Gopinath Prabhuji', classDay: 'SUN' }, after: { facilitator: 'Vilasa Padmanabha Prabhuji', classDay: 'SUN' } }))
      .toEqual([{ field: 'Facilitator', before: 'Natvar Gopinath Prabhuji', after: 'Vilasa Padmanabha Prabhuji' }]);
    expect(auditDiff({ before: null, after: { mark: 'P', active: false } })).toEqual([{ field: 'Attendance', before: '—', after: 'Present' }, { field: 'Active', before: '—', after: 'No' }]);
  });
});
