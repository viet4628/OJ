\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.perf_assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
INSERT INTO auth.users(id,email) VALUES ('f0000000-0000-0000-0000-000000000001','perf-student@test.local');
INSERT INTO problems(id,slug,title,description,is_public,tags) VALUES
 ('f1000000-0000-0000-0000-000000000001','perf-a','Perf A','secret-full-statement',true,ARRAY['perf']),
 ('f1000000-0000-0000-0000-000000000002','perf-b','Perf B','secret-full-statement',true,ARRAY['perf']),
 ('f1000000-0000-0000-0000-000000000003','perf-private','Perf Private','private',false,ARRAY['private-tag']);
INSERT INTO submissions(user_id,problem_id,language,code,status,score) VALUES
 ('f0000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','cpp','int main(){}','ACCEPTED',100);
SET LOCAL ROLE anon;
SELECT pg_temp.perf_assert((get_problem_page(0,1,'Perf','ALL','perf')->>'total')::int=2,'count spans pages');
SELECT pg_temp.perf_assert(jsonb_array_length(get_problem_page(0,1,'Perf','ALL','perf')->'rows')=1,'page size');
SELECT pg_temp.perf_assert((get_problem_page(0,1,'Perf','ALL','perf')->'rows'->0->>'slug')='perf-a','first page');
SELECT pg_temp.perf_assert((get_problem_page(1,1,'Perf','ALL','perf')->'rows'->0->>'slug')='perf-b','no page overlap');
SELECT pg_temp.perf_assert((get_problem_page(0,1,'Perf','ALL','perf','ALL','title',true)->'rows'->0->>'slug')='perf-b','descending sort');
SELECT pg_temp.perf_assert((get_problem_page(0,20,'Perf','ALL','perf','SOLVED')->>'total')::int=0,'anon sees no own solves');
SELECT pg_temp.perf_assert(NOT (get_problem_page()::text LIKE '%secret-full-statement%'),'page excludes full statement');
SELECT pg_temp.perf_assert(NOT (get_problem_page()::text LIKE '%private-tag%'),'private metadata stays private');
SELECT pg_temp.perf_assert((get_problem_page(0,20,'Perf','Hard','perf')->>'total')::int=0,'difficulty filter');
SELECT pg_temp.perf_assert((get_problem_page(0,20,'not-found')->>'total')::int=0,'search filter');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.perf_assert((get_problem_page(0,20,'Perf','ALL','perf','SOLVED')->>'total')::int=1,'own solved filter');
SELECT pg_temp.perf_assert((get_problem_page(0,20,'Perf','ALL','perf','TODO')->>'total')::int=1,'own todo filter');
SELECT pg_temp.perf_assert((get_problem_page(0,20,'Perf','ALL','perf','SOLVED')->'rows'->0->>'progress')='SOLVED','own status');
SELECT pg_temp.perf_assert((SELECT count(*)=0 FROM testcases),'hidden testcase access unchanged');
ROLLBACK;
