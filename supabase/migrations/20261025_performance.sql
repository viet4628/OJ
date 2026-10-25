BEGIN;

-- A public catalog page contains display fields and only the caller's own progress.
CREATE OR REPLACE FUNCTION public.get_problem_page(
  p_page INT DEFAULT 0, p_page_size INT DEFAULT 20, p_keyword TEXT DEFAULT '',
  p_difficulty TEXT DEFAULT 'ALL', p_tag TEXT DEFAULT '', p_status TEXT DEFAULT 'ALL',
  p_sort TEXT DEFAULT 'title', p_desc BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH mine AS MATERIALIZED (
    SELECT s.problem_id, bool_or(s.status = 'ACCEPTED') AS solved
    FROM public.submissions s WHERE s.user_id = auth.uid() AND NOT s.is_run GROUP BY s.problem_id
  ), catalog AS MATERIALIZED (
    SELECT p.id, p.slug, p.title, p.difficulty, p.tags, p.time_limit_ms, p.memory_limit_mb,
      CASE WHEN m.solved THEN 'SOLVED' WHEN m.problem_id IS NOT NULL THEN 'ATTEMPTED' ELSE 'TODO' END AS progress
    FROM public.problems p LEFT JOIN mine m ON m.problem_id = p.id WHERE p.is_public
  ), filtered AS MATERIALIZED (
    SELECT * FROM catalog c
    WHERE (p_keyword = '' OR strpos(lower(c.title), lower(trim(p_keyword))) > 0 OR strpos(lower(c.slug), lower(trim(p_keyword))) > 0)
      AND (p_difficulty = 'ALL' OR c.difficulty::text = p_difficulty)
      AND (p_tag = '' OR p_tag = ANY(c.tags)) AND (p_status = 'ALL' OR c.progress = p_status)
  ), ordered AS (
    SELECT f.*, row_number() OVER (ORDER BY
      CASE WHEN NOT p_desc AND p_sort = 'title' THEN f.title END ASC,
      CASE WHEN p_desc AND p_sort = 'title' THEN f.title END DESC,
      CASE WHEN NOT p_desc AND p_sort = 'difficulty' THEN f.difficulty END ASC,
      CASE WHEN p_desc AND p_sort = 'difficulty' THEN f.difficulty END DESC,
      CASE WHEN NOT p_desc AND p_sort = 'time' THEN f.time_limit_ms END ASC,
      CASE WHEN p_desc AND p_sort = 'time' THEN f.time_limit_ms END DESC,
      CASE WHEN NOT p_desc AND p_sort = 'memory' THEN f.memory_limit_mb END ASC,
      CASE WHEN p_desc AND p_sort = 'memory' THEN f.memory_limit_mb END DESC, f.id ASC
    ) AS position FROM filtered f
  ), page AS (
    SELECT * FROM ordered
    WHERE position > greatest(0, coalesce(p_page, 0))::bigint * least(100, greatest(1, coalesce(p_page_size, 20)))
      AND position <= (greatest(0, coalesce(p_page, 0))::bigint + 1) * least(100, greatest(1, coalesce(p_page_size, 20)))
  )
  SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(p) - 'position' ORDER BY position) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'counts', (SELECT jsonb_build_object('ALL', count(*), 'Low', count(*) FILTER (WHERE difficulty = 'Easy'),
      'Mid', count(*) FILTER (WHERE difficulty = 'Medium'), 'High', count(*) FILTER (WHERE difficulty = 'Hard')) FROM catalog),
    'tags', coalesce((SELECT jsonb_agg(tag ORDER BY tag) FROM (SELECT DISTINCT unnest(tags) AS tag FROM catalog) t), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_problem_page(INT,INT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_problem_page(INT,INT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) TO anon, authenticated, service_role;

-- Aggregate once per user/problem instead of querying submissions inside nested loops.
CREATE OR REPLACE FUNCTION public.get_contest_rank(p_contest_id UUID)
RETURNS TABLE (
  user_id UUID, username TEXT, email TEXT, avatar_url TEXT, submission_number BIGINT,
  accepted_number BIGINT, total_time_seconds BIGINT, total_score BIGINT, problem_info JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rule TEXT; v_cutoff TIMESTAMPTZ; v_start TIMESTAMPTZ;
BEGIN
  SELECT c.rule_type::TEXT, c.start_time,
    CASE WHEN NOT public.can_manage_contest(p_contest_id) AND now() >= c.freeze_at AND now() < c.end_time THEN c.freeze_at END
  INTO v_rule, v_start, v_cutoff FROM public.contests c WHERE c.id=p_contest_id;
  IF NOT EXISTS (SELECT 1 FROM public.contests c WHERE c.id=p_contest_id AND (c.is_public OR public.can_enter_contest(c.id))) THEN
    RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc không có quyền truy cập';
  END IF;
  IF v_rule IS NULL THEN RAISE EXCEPTION 'Kỳ thi không tồn tại'; END IF;

  RETURN QUERY
  WITH eligible AS MATERIALIZED (
    SELECT s.user_id, s.problem_id, s.status, s.score, s.created_at,
      min(s.created_at) FILTER (WHERE s.status='ACCEPTED') OVER (PARTITION BY s.user_id,s.problem_id) AS ac_at
    FROM public.submissions s WHERE s.contest_id=p_contest_id AND NOT COALESCE(s.is_run,false)
      AND (v_cutoff IS NULL OR s.created_at<v_cutoff)
  ), participants AS (
    SELECT DISTINCT s.user_id FROM eligible s
  ), stats AS (
    SELECT s.user_id, s.problem_id, min(s.ac_at) AS ac_at, count(*) AS attempts,
      count(*) FILTER (WHERE s.created_at<s.ac_at AND s.status IN
        ('WRONG_ANSWER','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','RUNTIME_ERROR')) AS errors,
      COALESCE(max(s.score),0)::bigint AS best
    FROM eligible s GROUP BY s.user_id,s.problem_id
  ), pairs AS (
    SELECT u.user_id, cp.problem_id, cp.score AS problem_score, s.ac_at,
      COALESCE(s.attempts,0) AS attempts, COALESCE(s.errors,0) AS errors, COALESCE(s.best,0) AS best,
      GREATEST(0, EXTRACT(EPOCH FROM (s.ac_at-v_start))::BIGINT) AS ac_time
    FROM participants u LEFT JOIN public.contest_problems cp ON cp.contest_id=p_contest_id
    LEFT JOIN stats s ON s.user_id=u.user_id AND s.problem_id=cp.problem_id
  )
  SELECT p.id,
    COALESCE(NULLIF(p.full_name,p.email),'user-'||left(p.id::text,8)),
    CASE WHEN p.id=auth.uid() OR public.has_user_permission('users.manage') THEN p.email ELSE '' END,
    p.avatar_url,
    COALESCE(sum(CASE WHEN v_rule='ACM' AND x.ac_at IS NOT NULL THEN x.errors+1 ELSE x.attempts END),0)::bigint,
    CASE WHEN v_rule='ACM' THEN count(x.ac_at) ELSE 0 END,
    CASE WHEN v_rule='ACM' THEN COALESCE(sum(x.ac_time+x.errors*1200) FILTER (WHERE x.ac_at IS NOT NULL),0)::bigint ELSE 0::bigint END,
    CASE WHEN v_rule='ACM' THEN 0::bigint ELSE COALESCE(sum(x.best*COALESCE(x.problem_score,100)/100),0)::bigint END,
    COALESCE(jsonb_object_agg(x.problem_id,
      CASE WHEN v_rule<>'ACM' THEN jsonb_build_object('score',x.best,'submission_count',x.attempts)
        WHEN x.ac_at IS NOT NULL THEN jsonb_build_object('is_ac',true,'time_seconds',x.ac_time,'error_count',x.errors,'submission_count',x.errors+1)
        ELSE jsonb_build_object('is_ac',false,'submission_count',x.attempts) END
    ) FILTER (WHERE x.problem_id IS NOT NULL),'{}'::jsonb)
  FROM pairs x LEFT JOIN public.profiles p ON p.id=x.user_id
  GROUP BY p.id,p.full_name,p.email,p.avatar_url;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
