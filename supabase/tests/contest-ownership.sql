\set ON_ERROR_STOP on
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-000000000005','owner-a@test.local'),
 ('00000000-0000-0000-0000-000000000006','owner-b@test.local'),
 ('00000000-0000-0000-0000-000000000007','owner-admin@test.local');
UPDATE profiles SET role='teacher' WHERE id IN ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006');
UPDATE profiles SET role='admin' WHERE id='00000000-0000-0000-0000-000000000007';
INSERT INTO problems(id,slug,title,description,is_public,created_by) VALUES
 ('51000000-0000-0000-0000-000000000001','ownership-p1','P1','test',true,'00000000-0000-0000-0000-000000000005'),
 ('51000000-0000-0000-0000-000000000002','ownership-p2','P2','test',true,'00000000-0000-0000-0000-000000000005');
INSERT INTO contests(id,title,description,start_time,end_time,freeze_at,is_public,created_by) VALUES
 ('52000000-0000-0000-0000-000000000001','Owned A','test',now()-interval '1 hour',now()+interval '1 hour',NULL,false,'00000000-0000-0000-0000-000000000005'),
 ('52000000-0000-0000-0000-000000000002','Owned B','test',now()-interval '1 hour',now()+interval '1 hour',now()-interval '1 minute',true,'00000000-0000-0000-0000-000000000006'),
 ('52000000-0000-0000-0000-000000000003','Private B','test',now()+interval '1 hour',now()+interval '2 hours',NULL,false,'00000000-0000-0000-0000-000000000006'),
 ('52000000-0000-0000-0000-000000000004','Legacy','test',now(),now()+interval '1 hour',NULL,false,NULL);
INSERT INTO contest_problems(contest_id,problem_id) VALUES
 ('52000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001'),
 ('52000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002');
INSERT INTO contest_registrations(contest_id,user_id,status) VALUES
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','PENDING'),
 ('52000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','PENDING');
INSERT INTO submissions(id,user_id,problem_id,contest_id,language,code,status,score) VALUES
 ('53000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001','cpp','int main(){}','ACCEPTED',100),
 ('53000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002','52000000-0000-0000-0000-000000000002','cpp','int main(){}','ACCEPTED',100);
CREATE FUNCTION pg_temp.assert_true(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(query text,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN RETURN; END;
RAISE EXCEPTION 'FAIL (unexpected success): %', message; END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
UPDATE contests SET title='tampered' WHERE id='52000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT title='Owned B' FROM contests WHERE id='52000000-0000-0000-0000-000000000002'),'teacher cannot edit another creator contest');
DELETE FROM contests WHERE id='52000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM contests WHERE id='52000000-0000-0000-0000-000000000002'),'teacher cannot delete another contest');
UPDATE contests SET title='Edited A' WHERE id='52000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT title='Edited A' FROM contests WHERE id='52000000-0000-0000-0000-000000000001'),'owner can edit private contest');
WITH inserted AS (
  INSERT INTO contests(title,description,start_time,end_time,is_public)
    VALUES('Private returning','test',now(),now()+interval '1 hour',false) RETURNING id,created_by
) SELECT pg_temp.assert_true((SELECT created_by=auth.uid() FROM inserted),'owner can create private contest with RETURNING');
INSERT INTO contests(id,title,description,start_time,end_time) VALUES('52000000-0000-0000-0000-000000000005','Default creator','test',now(),now()+interval '1 hour');
SELECT pg_temp.assert_true((SELECT created_by=auth.uid() FROM contests WHERE id='52000000-0000-0000-0000-000000000005'),'creator defaults to authenticated owner');
SELECT pg_temp.expect_error($q$INSERT INTO contests(title,description,start_time,end_time,created_by) VALUES('Spoof','test',now(),now()+interval '1 hour','00000000-0000-0000-0000-000000000006')$q$,'creator spoof rejected');
SELECT pg_temp.expect_error($q$UPDATE contests SET created_by='00000000-0000-0000-0000-000000000006' WHERE id='52000000-0000-0000-0000-000000000001'$q$,'owner cannot transfer ownership');
UPDATE contests SET created_by=auth.uid() WHERE id='52000000-0000-0000-0000-000000000004';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM contests WHERE id IN ('52000000-0000-0000-0000-000000000003','52000000-0000-0000-0000-000000000004')),'private foreign and legacy contests hidden');
SELECT pg_temp.assert_true(NOT can_enter_contest('52000000-0000-0000-0000-000000000003'),'global permission does not grant entry to foreign private contest');
UPDATE contest_problems SET score=1 WHERE contest_id='52000000-0000-0000-0000-000000000002';
DELETE FROM contest_problems WHERE contest_id='52000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT score=100 FROM contest_problems WHERE contest_id='52000000-0000-0000-0000-000000000002'),'foreign contest selection preserved');
SELECT pg_temp.expect_error($q$INSERT INTO contest_problems(contest_id,problem_id) VALUES('52000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000001')$q$,'cannot add to foreign contest');
SELECT pg_temp.expect_error($q$UPDATE contest_problems SET contest_id='52000000-0000-0000-0000-000000000002' WHERE contest_id='52000000-0000-0000-0000-000000000001'$q$,'cannot move selection to foreign contest');
SELECT pg_temp.expect_error($q$SELECT delete_problem('51000000-0000-0000-0000-000000000002')$q$,'delete RPC cannot erase another contest selection');
SELECT pg_temp.expect_error($q$DELETE FROM problems WHERE id='51000000-0000-0000-0000-000000000002'$q$,'direct problem deletion cannot cascade through foreign contest');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM contest_registrations WHERE contest_id='52000000-0000-0000-0000-000000000002'),'cannot read foreign registrations');
SELECT pg_temp.expect_error($q$SELECT review_contest_registration('52000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',true)$q$,'cannot approve foreign registrations');
SELECT review_contest_registration('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.expect_error($q$SELECT rejudge_submission('53000000-0000-0000-0000-000000000002')$q$,'global problem permission cannot rejudge foreign contest');
SELECT rejudge_submission('53000000-0000-0000-0000-000000000001');
SELECT pg_temp.assert_true((SELECT status='PENDING' FROM submissions WHERE id='53000000-0000-0000-0000-000000000001'),'owner can rejudge');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM get_contest_rank('52000000-0000-0000-0000-000000000002')),'foreign teacher cannot bypass rank freeze');
DELETE FROM contests WHERE id='52000000-0000-0000-0000-000000000005';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM contests WHERE id='52000000-0000-0000-0000-000000000005'),'owner can delete');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM get_contest_rank('52000000-0000-0000-0000-000000000002')),'actual manager sees unfrozen rank');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
UPDATE contests SET title='Admin override' WHERE id='52000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT title='Admin override' FROM contests WHERE id='52000000-0000-0000-0000-000000000002'),'admin may manage any creator');
UPDATE contests SET created_by='00000000-0000-0000-0000-000000000005' WHERE id='52000000-0000-0000-0000-000000000004';
SELECT pg_temp.assert_true((SELECT created_by='00000000-0000-0000-0000-000000000005' FROM contests WHERE id='52000000-0000-0000-0000-000000000004'),'admin can assign known legacy owner');
RESET ROLE;
SELECT 'Contest ownership regression tests passed' AS result;
