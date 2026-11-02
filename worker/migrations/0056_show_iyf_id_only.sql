-- Only an IYF ID identifies somebody in the app (the head, 17 Oct 2026).
--
-- "Once the student is in the app, only the IYF unique id is used to identify him — not G type ids
-- or K or J type", and that holds EVERYWHERE.
--
-- accounts.iyf_id is what every screen prints: the board, the devotee list, a contact card, a
-- facilitator's students, a group leader's group, the exports. Seven accounts carried a GP26- or
-- JN26- number there, so those people were shown a legacy id on every one of those screens.
--
-- Two of them already had a real one in the identity authority (Amrit IYFD-2016-0003, Aditya
-- IYFD-2024-0006) and were being shown the old number instead. This puts the current id where the
-- app reads it.
--
-- NOTHING IS LOST. The legacy number stays in person_identifiers, so a search for GP26-0001 still
-- finds Amrit — old ids resolve for ever (ADR: the identity authority). What changes is only what
-- is DISPLAYED: resolving an id and printing it are different things.
--
-- An account whose legacy id has no IYFD- behind it is left exactly as it is: inventing one would
-- be worse than showing an old one, and the head mints ids deliberately.
UPDATE accounts
   SET iyf_id = (SELECT p.iyf_id
                   FROM person_identifiers pi JOIN persons p ON p.id = pi.person_id
                  WHERE upper(pi.fid) = upper(accounts.iyf_id) AND p.iyf_id LIKE 'IYFD-%'
                  LIMIT 1)
 WHERE iyf_id <> ''
   AND iyf_id NOT LIKE 'IYFD-%'
   AND EXISTS (SELECT 1
                 FROM person_identifiers pi JOIN persons p ON p.id = pi.person_id
                WHERE upper(pi.fid) = upper(accounts.iyf_id) AND p.iyf_id LIKE 'IYFD-%');
