\set ON_ERROR_STOP on
-- Learning tracks: owner-managed, public tracks readable by everyone,
-- writes only through save_learning_track.
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-000000000021','track-a@test.local'),
 ('00000000-0000-0000-0000-000000000022','track-b@test.local'),
 ('00000000-0000-0000-0000-000000000023','track-student@test.local');
UPDATE profiles SET role='teacher' WHERE id IN ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022');
INSERT INTO problems(id,slug,title,description,is_public,created_by) VALUES
 ('71000000-0000-0000-0000-000000000001','track-public','Public','x',true,NULL),
 ('71000000-0000-0000-0000-000000000002','track-private-b','Private B','x',false,'00000000-0000-0000-0000-000000000022');
CREATE FUNCTION pg_temp.assert_true(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(query text,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN RETURN; END;
RAISE EXCEPTION 'FAIL (unexpected success): %', message; END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
SELECT set_config('test.track', save_learning_track(NULL,
  '{"slug":"nhap-mon","title":"Nhập môn lập trình","description":"Bắt đầu từ đây","is_public":false}',
  ARRAY['71000000-0000-0000-0000-000000000001'::uuid])::text, false);
SELECT pg_temp.assert_true((SELECT created_by=auth.uid() AND NOT is_public FROM learning_tracks WHERE slug='nhap-mon'), 'track records creator, starts private');
SELECT pg_temp.expect_error($q$SELECT save_learning_track(NULL,'{"slug":"Bad Slug","title":"x"}','{}')$q$, 'slug format enforced');
SELECT pg_temp.expect_error($q$SELECT save_learning_track(NULL,'{"slug":"other","title":"x"}',ARRAY['71000000-0000-0000-0000-000000000002'::uuid])$q$, 'cannot add a foreign private problem');
SELECT pg_temp.expect_error($q$INSERT INTO learning_tracks(slug,title) VALUES ('direct','x')$q$, 'direct insert denied');
SELECT pg_temp.expect_error($q$INSERT INTO learning_track_problems(track_id,problem_id) SELECT id,'71000000-0000-0000-0000-000000000001' FROM learning_tracks$q$, 'direct problem link denied');

-- Teacher B can neither see A's private track nor change it.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM learning_tracks WHERE slug='nhap-mon'), 'private track hidden from other teachers');
SELECT pg_temp.expect_error(format($q$SELECT save_learning_track(%L,'{"slug":"nhap-mon","title":"Hijack"}','{}')$q$, current_setting('test.track')), 'other teacher cannot edit');
DELETE FROM learning_tracks WHERE id=current_setting('test.track')::uuid;
SELECT save_learning_track(NULL,'{"slug":"sap-xep","title":"Sắp xếp","is_public":true}',
  ARRAY['71000000-0000-0000-0000-000000000002'::uuid,'71000000-0000-0000-0000-000000000001'::uuid]);

-- A publishes; a student reads public tracks and their order, never writes.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
SELECT save_learning_track(current_setting('test.track')::uuid,
  '{"slug":"nhap-mon","title":"Nhập môn lập trình","description":"Bắt đầu từ đây","is_public":true}',
  ARRAY['71000000-0000-0000-0000-000000000001'::uuid]);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000023',false);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM learning_tracks WHERE slug IN ('nhap-mon','sap-xep')), 'student reads public tracks');
SELECT pg_temp.assert_true((SELECT array_agg(ltp.problem_id ORDER BY ltp.sort_order) = ARRAY['71000000-0000-0000-0000-000000000002'::uuid,'71000000-0000-0000-0000-000000000001'::uuid]
  FROM learning_track_problems ltp JOIN learning_tracks t ON t.id=ltp.track_id WHERE t.slug='sap-xep'), 'problem order kept');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM problems WHERE id='71000000-0000-0000-0000-000000000002'), 'private problem in a public track stays hidden');
SELECT pg_temp.expect_error($q$SELECT save_learning_track(NULL,'{"slug":"student","title":"x"}','{}')$q$, 'student cannot create tracks');
DELETE FROM learning_tracks WHERE slug='nhap-mon';
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM learning_tracks WHERE slug='nhap-mon'), 'student delete had no effect');
SELECT 'Learning track tests passed' AS result;
