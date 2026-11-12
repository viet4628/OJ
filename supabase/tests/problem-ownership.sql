\set ON_ERROR_STOP on
-- Teachers manage only problems they created; admins manage all.
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-000000000011','problem-a@test.local'),
 ('00000000-0000-0000-0000-000000000012','problem-b@test.local'),
 ('00000000-0000-0000-0000-000000000013','problem-admin@test.local');
UPDATE profiles SET role='teacher' WHERE id IN ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012');
UPDATE profiles SET role='admin' WHERE id='00000000-0000-0000-0000-000000000013';
INSERT INTO problems(id,slug,title,description,is_public,created_by) VALUES
 ('61000000-0000-0000-0000-000000000002','own-b','B','test',false,'00000000-0000-0000-0000-000000000012'),
 ('61000000-0000-0000-0000-000000000003','legacy-orphan','Legacy','test',false,NULL);
INSERT INTO contests(id,title,description,start_time,end_time,is_public,created_by) VALUES
 ('62000000-0000-0000-0000-000000000001','Contest B','test',now()-interval '1 hour',now()+interval '1 hour',true,'00000000-0000-0000-0000-000000000012');
INSERT INTO classrooms(id,name,code,teacher_id) VALUES
 ('63000000-0000-0000-0000-000000000001','Class B','OWNB01','00000000-0000-0000-0000-000000000012');
CREATE FUNCTION pg_temp.assert_true(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(query text,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN RETURN; END;
RAISE EXCEPTION 'FAIL (unexpected success): %', message; END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
-- Teacher A creates a private problem with a hidden testcase and an editorial.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
SELECT set_config('test.problem_a', save_problem_bundle(NULL,
 '{"slug":"owned-a","title":"A","description":"Private statement","difficulty":"Easy","time_limit_ms":1000,"memory_limit_mb":256,"is_public":false}',
 '[{"input_content":"secret-in","output_content":"secret-out","score":100,"is_sample":false}]', 'Reference A')::text, false);
SELECT pg_temp.assert_true((SELECT created_by=auth.uid() FROM problems WHERE slug='owned-a'), 'bundle records the creator');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM testcases WHERE problem_id=current_setting('test.problem_a')::uuid), 'owner reads own testcases');
SELECT pg_temp.assert_true(get_problem_editorial(current_setting('test.problem_a')::uuid)='Reference A', 'owner reads own editorial');

-- Teacher B sees nothing of A's private problem and cannot change it.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM problems WHERE id=current_setting('test.problem_a')::uuid), 'other teacher cannot read private statement');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM testcases WHERE problem_id=current_setting('test.problem_a')::uuid), 'other teacher cannot read hidden testcases');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM problem_editorials WHERE problem_id=current_setting('test.problem_a')::uuid), 'other teacher cannot read editorial table');
SELECT pg_temp.assert_true(get_problem_editorial(current_setting('test.problem_a')::uuid) IS NULL, 'other teacher cannot read editorial');
SELECT pg_temp.expect_error(format($q$SELECT save_problem_bundle(%L,
 '{"slug":"owned-a","title":"Hijacked","description":"x","difficulty":"Easy","time_limit_ms":1000,"memory_limit_mb":256,"is_public":true}',
 '[{"input_content":"1","output_content":"1","score":100,"is_sample":false}]', '')$q$, current_setting('test.problem_a')), 'other teacher cannot save bundle');
SELECT pg_temp.expect_error(format($q$SELECT validate_problem_solution(%L,'cpp','int main(){}')$q$, current_setting('test.problem_a')), 'other teacher cannot validate');
SELECT pg_temp.expect_error(format($q$SELECT delete_problem(%L)$q$, current_setting('test.problem_a')), 'other teacher cannot delete via RPC');
DELETE FROM problems WHERE id=current_setting('test.problem_a')::uuid;
SELECT pg_temp.expect_error(format($q$INSERT INTO contest_problems(contest_id,problem_id) VALUES ('62000000-0000-0000-0000-000000000001',%L)$q$, current_setting('test.problem_a')), 'cannot attach a foreign private problem to own contest');
SELECT pg_temp.expect_error(format($q$INSERT INTO classroom_problems(classroom_id,problem_id) VALUES ('63000000-0000-0000-0000-000000000001',%L)$q$, current_setting('test.problem_a')), 'cannot attach a foreign private problem to own classroom');
SELECT pg_temp.expect_error(format($q$INSERT INTO submissions(user_id,problem_id,language,code,is_run,is_validation,details) VALUES (auth.uid(),%L,'cpp','int main(){}',true,true,'[]')$q$, current_setting('test.problem_a')), 'cannot run validation on a foreign problem');
-- B still manages B's own problem.
INSERT INTO contest_problems(contest_id,problem_id) VALUES ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002');
INSERT INTO classroom_problems(classroom_id,problem_id) VALUES ('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002');
SELECT pg_temp.assert_true(can_manage_problem('61000000-0000-0000-0000-000000000002') AND NOT can_manage_problem('61000000-0000-0000-0000-000000000003'), 'teacher manages own problem, not legacy ones');

-- A publishes the problem: B may read and use the statement, never the testcases.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
SELECT save_problem_bundle(current_setting('test.problem_a')::uuid,
 '{"slug":"owned-a","title":"A","description":"Public statement","difficulty":"Easy","time_limit_ms":1000,"memory_limit_mb":256,"is_public":true}',
 (SELECT jsonb_agg(jsonb_build_object('id',id,'input_content',input_content,'output_content',output_content,'score',score,'is_sample',is_sample)) FROM testcases WHERE problem_id=current_setting('test.problem_a')::uuid),
 'Reference A');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM problems WHERE id=current_setting('test.problem_a')::uuid), 'public statement readable');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM testcases WHERE problem_id=current_setting('test.problem_a')::uuid), 'public problem testcases stay private to the owner');
INSERT INTO contest_problems(contest_id,problem_id) VALUES ('62000000-0000-0000-0000-000000000001',current_setting('test.problem_a')::uuid);

-- Admin manages every problem, including legacy ones without a creator.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM testcases WHERE problem_id=current_setting('test.problem_a')::uuid), 'admin reads any testcases');
SELECT pg_temp.assert_true(can_manage_problem('61000000-0000-0000-0000-000000000003'), 'admin manages legacy problem');
SELECT delete_problem('61000000-0000-0000-0000-000000000003');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM problems WHERE id=current_setting('test.problem_a')::uuid), 'problem survived the foreign delete attempt');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM problems WHERE id='61000000-0000-0000-0000-000000000003'), 'admin deleted legacy problem');
SELECT 'Problem ownership tests passed' AS result;
