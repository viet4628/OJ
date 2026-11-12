\set ON_ERROR_STOP on
INSERT INTO auth.users(id, email) VALUES
 ('00000000-0000-0000-0000-000000000001', 'student@test.local'),
 ('00000000-0000-0000-0000-000000000002', 'teacher@test.local'),
 ('00000000-0000-0000-0000-000000000003', 'admin@test.local'),
 ('00000000-0000-0000-0000-000000000004', 'other@test.local');
UPDATE profiles SET role = 'teacher' WHERE email = 'teacher@test.local';
UPDATE profiles SET role = 'admin' WHERE email = 'admin@test.local';
INSERT INTO problems(id,slug,title,description,is_public) VALUES
 ('10000000-0000-0000-0000-000000000001','private-test','Private','hidden',false);
INSERT INTO classrooms(id,name,code,teacher_id) VALUES
 ('20000000-0000-0000-0000-000000000001','Test class','PILOT1','00000000-0000-0000-0000-000000000002');
INSERT INTO classroom_problems(classroom_id,problem_id) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO contests(id,title,description,start_time,end_time) VALUES
 ('30000000-0000-0000-0000-000000000001','Future','test',now()+interval '1 day',now()+interval '2 days');
INSERT INTO contest_problems(contest_id,problem_id) SELECT '30000000-0000-0000-0000-000000000001', id FROM problems WHERE slug='two-sum';

CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(query text, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN RETURN; END;
  RAISE EXCEPTION 'FAIL (unexpected success): %', message;
END $$;

SET ROLE anon;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM testcases), 'anon cannot read hidden testcases');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM problems WHERE slug='private-test'), 'private problem hidden');
SELECT pg_temp.expect_error($q$SELECT claim_submission(gen_random_uuid())$q$, 'anon cannot claim');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM testcases), 'student cannot read testcase contents');
SELECT pg_temp.expect_error($q$UPDATE profiles SET role='admin' WHERE id=auth.uid()$q$, 'self role escalation');
UPDATE profiles SET full_name='Student changed name' WHERE id=auth.uid();
SELECT pg_temp.assert_true((SELECT full_name='Student changed name' FROM profiles WHERE id=auth.uid()), 'own profile edit works');
SELECT pg_temp.expect_error($q$SELECT claim_submission(gen_random_uuid())$q$, 'student cannot claim');
SELECT pg_temp.expect_error($q$INSERT INTO submissions(user_id,problem_id,language,code,status,score)
 SELECT auth.uid(),id,'cpp','int main(){}','ACCEPTED',100 FROM problems WHERE slug='two-sum'$q$, 'forged verdict');
SELECT pg_temp.expect_error($q$INSERT INTO submissions(user_id,problem_id,language,code,details)
 SELECT auth.uid(),id,'cpp','int main(){}','[{"output":"forged"}]' FROM problems WHERE slug='two-sum'$q$, 'forged details');
SELECT pg_temp.expect_error($q$INSERT INTO submissions(user_id,problem_id,language,code)
 VALUES(auth.uid(),'10000000-0000-0000-0000-000000000001','cpp','int main(){}')$q$, 'hidden problem submission');
SELECT pg_temp.expect_error($q$INSERT INTO submissions(user_id,problem_id,language,code,contest_id)
 SELECT auth.uid(),id,'cpp','int main(){}','30000000-0000-0000-0000-000000000001' FROM problems WHERE slug='two-sum'$q$, 'contest time cannot be bypassed by REST');
SELECT pg_temp.expect_error($q$INSERT INTO classroom_members(classroom_id,user_id,role)
 VALUES('20000000-0000-0000-0000-000000000001',auth.uid(),'teacher')$q$, 'cannot self join without invite');
SELECT join_classroom('PILOT1');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM classrooms), 'classroom RLS has no recursion');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM classroom_members), 'membership RLS has no recursion');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM classroom_problems), 'assignment visible');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM problems WHERE slug='private-test'), 'member reads assigned private problem');
SELECT judge_problem_code((SELECT id FROM problems WHERE slug='two-sum'),'cpp','int main(){}','');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM submissions WHERE NOT is_run), 'trial excluded from history');
INSERT INTO submissions(user_id,problem_id,language,code) SELECT auth.uid(),id,'cpp','int main(){}' FROM problems WHERE slug='two-sum';
INSERT INTO submissions(user_id,problem_id,language,code) SELECT auth.uid(),id,'python','print(0)' FROM problems WHERE slug='two-sum';
SELECT pg_temp.expect_error($q$INSERT INTO submissions(user_id,problem_id,language,code)
 SELECT auth.uid(),id,'cpp','int main(){}' FROM problems WHERE slug='two-sum'$q$, 'pending queue quota');
SELECT pg_temp.assert_true((SELECT get_queue_position(id) >= 1 FROM submissions WHERE user_id=auth.uid() AND status='PENDING' ORDER BY created_at DESC LIMIT 1), 'owner sees own queue position');
SELECT set_config('test.pending_id', (SELECT id::text FROM submissions WHERE user_id=auth.uid() AND status='PENDING' ORDER BY created_at DESC LIMIT 1), false);

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.assert_true(has_user_permission('testcases.manage'), 'teacher has testcase permission');
SELECT pg_temp.assert_true(NOT has_user_permission('users.manage') AND NOT has_user_permission('announcements.manage'), 'teacher defaults minimal');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM testcases), 'teacher cannot read testcases of problems they did not create');
SELECT pg_temp.expect_error($q$INSERT INTO testcases(problem_id,input_path,output_path,input_content,output_content)
 VALUES ('10000000-0000-0000-0000-000000000001','inline','inline','1','1')$q$, 'testcase insert must use save_problem_bundle');
SELECT pg_temp.expect_error($q$UPDATE testcases SET output_content='forged'$q$, 'testcase edit must use save_problem_bundle');
SELECT pg_temp.expect_error($q$DELETE FROM testcases$q$, 'testcase delete must use save_problem_bundle');
SELECT pg_temp.expect_error($q$UPDATE problems SET time_limit_ms=2000$q$, 'problem edit must use save_problem_bundle');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM classroom_members), 'owner can see students');
SELECT save_problem_bundle(NULL,
 '{"slug":"starter-code-test","title":"Starter","description":"Public statement","difficulty":"Easy","time_limit_ms":1000,"memory_limit_mb":256,"is_public":true,"starter_codes":{"cpp":"// public template"}}',
 '[{"input_content":"1","output_content":"1","score":100,"is_sample":false}]', 'Private reference explanation');
SELECT pg_temp.assert_true((SELECT starter_codes->>'cpp' = '// public template' FROM problems WHERE slug='starter-code-test'), 'bundle persists public starter code');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM testcases t JOIN problems p ON p.id=t.problem_id WHERE p.slug='starter-code-test'), 'teacher reads testcases of own problem');
SELECT save_problem_bundle((SELECT id FROM problems WHERE slug='starter-code-test'),
 '{"slug":"starter-code-test","title":"Starter","description":"Public statement","difficulty":"Easy","time_limit_ms":1000,"memory_limit_mb":256,"is_public":true}',
 '[{"input_content":"1","output_content":"1","score":100,"is_sample":false}]', 'Private reference explanation');
SELECT pg_temp.assert_true((SELECT starter_codes->>'cpp' = '// public template' FROM problems WHERE slug='starter-code-test'), 'older bundle clients preserve templates');
SELECT pg_temp.expect_error($q$UPDATE problems SET starter_codes='{"java":"unsupported"}' WHERE slug='starter-code-test'$q$, 'unsupported template language rejected');
SELECT pg_temp.expect_error($q$UPDATE problems SET starter_codes='{"cpp":null}' WHERE slug='starter-code-test'$q$, 'template must be text');
SELECT pg_temp.expect_error($q$UPDATE problems SET starter_codes=jsonb_build_object('cpp',repeat('x',200001)) WHERE slug='starter-code-test'$q$, 'oversized template rejected');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.assert_true((SELECT starter_codes->>'cpp' = '// public template' FROM problems WHERE slug='starter-code-test'), 'public starter visible to learners');
SELECT pg_temp.expect_error($q$SELECT * FROM problem_editorials$q$, 'reference explanation remains private');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT pg_temp.expect_error($q$UPDATE problems SET starter_codes='{"cpp":"tampered"}' WHERE slug='starter-code-test'$q$, 'student problem update denied');
SELECT pg_temp.assert_true((SELECT starter_codes->>'cpp' = '// public template' FROM problems WHERE slug='starter-code-test'), 'student cannot change templates');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SELECT pg_temp.assert_true(get_queue_position(current_setting('test.pending_id')::uuid) IS NULL, 'queue position hidden from other users');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM classrooms), 'outsider classroom hidden');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM classroom_members), 'outsider members hidden');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.assert_true(has_user_permission('users.manage'), 'admin bypass');
UPDATE profiles SET role='user' WHERE email='teacher@test.local';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM user_permissions WHERE user_id='00000000-0000-0000-0000-000000000002'), 'teacher demotion wipes permissions');
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT pg_temp.assert_true(claim_submission((SELECT id FROM submissions WHERE status='PENDING' LIMIT 1)), 'worker atomic claim');
SELECT pg_temp.assert_true(NOT claim_submission((SELECT id FROM submissions WHERE status='JUDGING' LIMIT 1)), 'cannot double claim');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT NOT public FROM storage.buckets WHERE id='testcases'), 'testcase bucket private');
SELECT pg_temp.expect_error($q$UPDATE problems SET time_limit_ms=0 WHERE slug='two-sum'$q$, 'time limit must stay in range');
SELECT pg_temp.expect_error($q$UPDATE problems SET memory_limit_mb=100000 WHERE slug='two-sum'$q$, 'memory limit must stay in range');
SELECT 'Security regression tests passed' AS result;
