-- ADR 0010 (the head, 22 Oct 2026): facilitation an ETP enrolment grants is TEMPORARY and is taken back when the
-- training ends for them (removed, repeat, left, or qualified); FTP — or, until FTP exists, the head — makes it LASTING.
-- Everyone who facilitated before ETP keeps it: they are lasting.
--   ''         not a facilitator
--   temporary  granted by an enrolment (enrol.add's audit row names the facilitator it granted)
--   lasting    a facilitator in their own right
ALTER TABLE accounts ADD COLUMN facilitation TEXT NOT NULL DEFAULT '';
UPDATE accounts SET facilitation = 'temporary'
 WHERE facilitator_name <> ''
   AND login IN (SELECT target FROM audit_log WHERE action = 'enrol.add' AND json_extract(after, '$.facilitator') IS NOT NULL);
UPDATE accounts SET facilitation = 'lasting' WHERE facilitator_name <> '' AND facilitation = '';
