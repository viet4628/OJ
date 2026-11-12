\set ON_ERROR_STOP on
-- Contest rewards: owner sets rank rules, awards after the end from the final
-- standings; each user gets the best tier per kind plus participation prizes.
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-000000000031','reward-owner@test.local'),
 ('00000000-0000-0000-0000-000000000032','reward-other@test.local'),
 ('00000000-0000-0000-0000-000000000033','reward-s1@test.local'),
 ('00000000-0000-0000-0000-000000000034','reward-s2@test.local'),
 ('00000000-0000-0000-0000-000000000035','reward-s3@test.local');
UPDATE profiles SET role='teacher' WHERE id IN ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032');
INSERT INTO problems(id,slug,title,description,is_public) VALUES ('81000000-0000-0000-0000-000000000001','reward-p','P','x',true);
INSERT INTO contests(id,title,description,rule_type,start_time,end_time,is_public,created_by) VALUES
 ('82000000-0000-0000-0000-000000000001','Ended ACM','x','ACM',now()-interval '3 hours',now()-interval '1 hour',true,'00000000-0000-0000-0000-000000000031'),
 ('82000000-0000-0000-0000-000000000002','Running','x','ACM',now()-interval '1 hour',now()+interval '1 hour',true,'00000000-0000-0000-0000-000000000031');
INSERT INTO contest_problems(contest_id,problem_id) VALUES
 ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001'),
 ('82000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001');
-- s1 solves first, s2 later, s3 only fails; the owner (staff) also solves.
INSERT INTO submissions(user_id,problem_id,contest_id,language,code,status,score,created_at) VALUES
 ('00000000-0000-0000-0000-000000000033','81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','cpp','x','ACCEPTED',100,now()-interval '170 minutes'),
 ('00000000-0000-0000-0000-000000000034','81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','cpp','x','ACCEPTED',100,now()-interval '100 minutes'),
 ('00000000-0000-0000-0000-000000000035','81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','cpp','x','WRONG_ANSWER',0,now()-interval '100 minutes'),
 ('00000000-0000-0000-0000-000000000031','81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','cpp','x','ACCEPTED',100,now()-interval '175 minutes');
CREATE FUNCTION pg_temp.assert_true(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(query text,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN RETURN; END;
RAISE EXCEPTION 'FAIL (unexpected success): %', message; END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000032',false);
SELECT pg_temp.expect_error($q$SELECT set_contest_rewards('82000000-0000-0000-0000-000000000001','[{"reward_id":"frame-gold","max_rank":1}]')$q$, 'other teacher cannot set rewards');
SELECT pg_temp.expect_error($q$SELECT award_contest_rewards('82000000-0000-0000-0000-000000000001')$q$, 'other teacher cannot award');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',false);
SELECT pg_temp.expect_error($q$SELECT set_contest_rewards('82000000-0000-0000-0000-000000000001','[{"reward_id":"no-such-reward","max_rank":1}]')$q$, 'unknown reward rejected');
SELECT set_contest_rewards('82000000-0000-0000-0000-000000000001',
  '[{"reward_id":"frame-gold","max_rank":1},{"reward_id":"frame-silver","max_rank":3},{"reward_id":"banner-gold","max_rank":1},{"reward_id":"frame-participant","max_rank":null}]');
SELECT set_contest_rewards('82000000-0000-0000-0000-000000000002','[{"reward_id":"frame-gold","max_rank":1}]');
SELECT pg_temp.expect_error($q$SELECT award_contest_rewards('82000000-0000-0000-0000-000000000002')$q$, 'cannot award before the end');
SELECT pg_temp.expect_error($q$INSERT INTO user_rewards(user_id,reward_id,contest_title,rank) VALUES (auth.uid(),'frame-gold','x',1)$q$, 'rewards cannot be self-granted');
SELECT pg_temp.assert_true(award_contest_rewards('82000000-0000-0000-0000-000000000001') = 6, 'six rewards granted');
SELECT pg_temp.assert_true(award_contest_rewards('82000000-0000-0000-0000-000000000001') = 0, 'awarding again grants nothing new');
SELECT pg_temp.assert_true((SELECT rewards_awarded_at IS NOT NULL FROM contests WHERE id='82000000-0000-0000-0000-000000000001'), 'award time recorded');

-- s1 (rank 1): gold frame + gold banner + participation, not silver.
SELECT pg_temp.assert_true((SELECT array_agg(reward_id ORDER BY reward_id) FROM user_rewards WHERE user_id='00000000-0000-0000-0000-000000000033')
  = ARRAY['banner-gold','frame-gold','frame-participant'], 'rank 1 gets the best tier per kind');
SELECT pg_temp.assert_true((SELECT array_agg(reward_id ORDER BY reward_id) FROM user_rewards WHERE user_id='00000000-0000-0000-0000-000000000034')
  = ARRAY['frame-participant','frame-silver'], 'rank 2 gets silver');
SELECT pg_temp.assert_true((SELECT array_agg(reward_id ORDER BY reward_id) FROM user_rewards WHERE user_id='00000000-0000-0000-0000-000000000035')
  = ARRAY['frame-participant'], 'no solve: participation only, no ranked prize');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM user_rewards WHERE user_id='00000000-0000-0000-0000-000000000031'), 'staff do not win');

-- Equip: only owned rewards of the right kind; shown on the public profile.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000034',false);
SELECT pg_temp.expect_error($q$SELECT equip_reward('frame','frame-gold')$q$, 'cannot equip an unearned reward');
SELECT pg_temp.expect_error($q$SELECT equip_reward('banner','frame-silver')$q$, 'kind must match');
SELECT pg_temp.expect_error($q$UPDATE profiles SET equipped_frame='frame-gold' WHERE id=auth.uid()$q$, 'no direct equip');
SELECT equip_reward('frame','frame-silver');
SELECT pg_temp.assert_true((SELECT equipped_frame='frame-silver' FROM profiles_public WHERE id=auth.uid()), 'equipped frame is public');
SELECT equip_reward('frame', NULL);
SELECT pg_temp.assert_true((SELECT equipped_frame IS NULL FROM profiles_public WHERE id=auth.uid()), 'unequip');
RESET ROLE;
SELECT 'Contest reward tests passed' AS result;
