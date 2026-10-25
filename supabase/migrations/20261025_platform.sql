-- Idempotent platform completion migration. Run after the base schema.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_classroom_progress(p_classroom_id UUID)
RETURNS TABLE (user_id UUID, problem_id UUID, status public.submission_status, score INT, time_used_ms INT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.classrooms c WHERE c.id = p_classroom_id
      AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  ) THEN RAISE EXCEPTION 'Bạn không có quyền xem bảng điểm lớp'; END IF;
  RETURN QUERY
    SELECT DISTINCT ON (s.user_id, s.problem_id)
      s.user_id, s.problem_id, s.status, s.score, s.time_used_ms, s.created_at
    FROM public.submissions s
    JOIN public.classroom_members m ON m.classroom_id = s.classroom_id AND m.user_id = s.user_id
    JOIN public.classroom_problems cp ON cp.classroom_id = s.classroom_id AND cp.problem_id = s.problem_id
    WHERE s.classroom_id = p_classroom_id AND NOT s.is_run
      AND s.status NOT IN ('PENDING', 'JUDGING', 'SYSTEM_ERROR')
      AND s.created_at >= GREATEST(m.joined_at, cp.created_at)
      AND (cp.deadline IS NULL OR s.created_at <= cp.deadline)
    ORDER BY s.user_id, s.problem_id, (s.status = 'ACCEPTED') DESC, s.score DESC, s.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_classroom_progress(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_classroom_progress(UUID) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.submissions'::regclass AND conname = 'submission_single_context') THEN
    -- Preserve historical rows while enforcing the invariant on every new write.
    ALTER TABLE public.submissions ADD CONSTRAINT submission_single_context
      CHECK (classroom_id IS NULL OR contest_id IS NULL) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.problem_editorials (
  problem_id UUID PRIMARY KEY REFERENCES public.problems(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.problem_editorials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage editorials" ON public.problem_editorials;
CREATE POLICY "Staff manage editorials" ON public.problem_editorials FOR ALL
  USING (public.has_user_permission('problems.manage')) WITH CHECK (public.has_user_permission('problems.manage'));
REVOKE ALL ON public.problem_editorials FROM anon, authenticated;
GRANT SELECT ON public.problem_editorials TO authenticated;
GRANT ALL ON public.problem_editorials TO service_role;

CREATE OR REPLACE FUNCTION public.get_problem_editorial(p_problem_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT public.has_user_permission('problems.manage') AND (
    NOT public.can_read_problem(p_problem_id)
    OR NOT EXISTS (SELECT 1 FROM public.submissions WHERE user_id = auth.uid() AND problem_id = p_problem_id AND status = 'ACCEPTED' AND NOT is_run)
    OR EXISTS (SELECT 1 FROM public.contest_problems cp JOIN public.contests c ON c.id = cp.contest_id
      WHERE cp.problem_id = p_problem_id AND now() >= c.start_time AND now() < c.end_time)
  ) THEN RETURN NULL; END IF;
  RETURN (SELECT content FROM public.problem_editorials WHERE problem_id = p_problem_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_problem_editorial(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_problem_editorial(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_problem_bundle(p_problem_id UUID, p_problem JSONB, p_testcases JSONB, p_editorial TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := COALESCE(p_problem_id, gen_random_uuid());
  v_case JSONB;
  v_case_id UUID;
  v_existing public.testcases%ROWTYPE;
  v_ids UUID[] := '{}';
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_user_permission('problems.manage') OR NOT public.has_user_permission('testcases.manage') THEN
    RAISE EXCEPTION 'Bạn không có quyền lưu đề và testcase';
  END IF;
  IF p_problem IS NULL OR jsonb_typeof(p_problem) <> 'object' OR p_testcases IS NULL OR jsonb_typeof(p_testcases) <> 'array' THEN
    RAISE EXCEPTION 'Dữ liệu đề và testcase không hợp lệ';
  END IF;
  IF length(trim(COALESCE(p_problem->>'title',''))) NOT BETWEEN 1 AND 200
    OR COALESCE(p_problem->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR length(p_problem->>'slug') > 100
    OR length(trim(COALESCE(p_problem->>'description',''))) = 0
    OR COALESCE((p_problem->>'time_limit_ms')::int, 0) NOT BETWEEN 10 AND 30000
    OR COALESCE((p_problem->>'memory_limit_mb')::int, 0) NOT BETWEEN 16 AND 1024
    OR length(COALESCE(p_editorial,'')) > 200000 THEN RAISE EXCEPTION 'Tên, slug, nội dung hoặc giới hạn tài nguyên không hợp lệ'; END IF;
  IF jsonb_array_length(p_testcases) > 1000 OR octet_length(p_testcases::text) > 33554432
    OR (COALESCE((p_problem->>'is_public')::boolean,false) AND jsonb_array_length(p_testcases) = 0) THEN
    RAISE EXCEPTION 'Đề công khai cần testcase; tối đa 1.000 test và 32 MiB';
  END IF;
  IF jsonb_array_length(p_testcases) > 0 AND
    (SELECT COALESCE(sum((t->>'score')::int),0) FROM jsonb_array_elements(p_testcases) t) <= 0 THEN
    RAISE EXCEPTION 'Tổng trọng số testcase phải lớn hơn 0';
  END IF;
  IF p_problem_id IS NOT NULL THEN
    PERFORM 1 FROM public.problems WHERE id = p_problem_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bài tập không tồn tại'; END IF;
    IF EXISTS (SELECT 1 FROM public.submissions WHERE problem_id = p_problem_id AND status IN ('PENDING','JUDGING')) THEN
      RAISE EXCEPTION 'Hãy đợi các bài đang chấm hoàn tất trước khi sửa đề';
    END IF;
  END IF;
  INSERT INTO public.problems (id, title, slug, description, input_format, output_format, difficulty, time_limit_ms, memory_limit_mb, tags, samples, is_public, created_by)
  VALUES (v_id, trim(p_problem->>'title'), p_problem->>'slug', p_problem->>'description', p_problem->>'input_format', p_problem->>'output_format',
    (p_problem->>'difficulty')::public.problem_difficulty, (p_problem->>'time_limit_ms')::int, (p_problem->>'memory_limit_mb')::int,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_problem->'tags','[]'))), COALESCE(p_problem->'samples','[]'), COALESCE((p_problem->>'is_public')::boolean,false), auth.uid())
  ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, slug=EXCLUDED.slug, description=EXCLUDED.description,
    input_format=EXCLUDED.input_format, output_format=EXCLUDED.output_format, difficulty=EXCLUDED.difficulty,
    time_limit_ms=EXCLUDED.time_limit_ms, memory_limit_mb=EXCLUDED.memory_limit_mb, tags=EXCLUDED.tags,
    samples=EXCLUDED.samples, is_public=EXCLUDED.is_public, updated_at=now();
  FOR v_case IN SELECT * FROM jsonb_array_elements(p_testcases) LOOP
    IF COALESCE((v_case->>'score')::int,-1) NOT BETWEEN 0 AND 100000
      OR octet_length(COALESCE(v_case->>'input_content','')) > 1048576
      OR octet_length(COALESCE(v_case->>'output_content','')) > 1048576 THEN RAISE EXCEPTION 'Testcase có trọng số hoặc kích thước không hợp lệ'; END IF;
    v_case_id := COALESCE((v_case->>'id')::UUID, gen_random_uuid());
    v_existing := NULL;
    IF v_case->>'id' IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.testcases WHERE id = v_case_id AND problem_id = v_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Testcase không thuộc bài tập này'; END IF;
    END IF;
    IF v_case_id = ANY(v_ids) THEN RAISE EXCEPTION 'Testcase bị trùng'; END IF;
    IF (v_case->>'input_content' IS NULL OR v_case->>'output_content' IS NULL) AND v_existing.id IS NULL THEN
      RAISE EXCEPTION 'Testcase mới cần đầy đủ input/output';
    END IF;
    INSERT INTO public.testcases (id, problem_id, input_path, output_path, input_content, output_content, score, is_sample)
    VALUES (v_case_id, v_id, COALESCE(v_existing.input_path,'inline'), COALESCE(v_existing.output_path,'inline'),
      v_case->>'input_content', v_case->>'output_content', (v_case->>'score')::int, COALESCE((v_case->>'is_sample')::boolean,false))
    ON CONFLICT (id) DO UPDATE SET input_content=EXCLUDED.input_content, output_content=EXCLUDED.output_content, score=EXCLUDED.score, is_sample=EXCLUDED.is_sample;
    v_ids := array_append(v_ids, v_case_id);
  END LOOP;
  DELETE FROM public.testcases WHERE problem_id = v_id AND NOT (id = ANY(v_ids));
  INSERT INTO public.problem_editorials(problem_id, content) VALUES(v_id, COALESCE(p_editorial,''))
    ON CONFLICT(problem_id) DO UPDATE SET content=EXCLUDED.content, updated_at=now();
  DELETE FROM public.problem_validations WHERE problem_id=v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_problem_bundle(UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_problem_bundle(UUID, JSONB, JSONB, TEXT) TO authenticated;

ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS registration_required BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.contest_registrations (
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(contest_id, user_id)
);
ALTER TABLE public.contest_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own registration or contest manager" ON public.contest_registrations;
CREATE POLICY "Own registration or contest manager" ON public.contest_registrations FOR SELECT
  USING(user_id = auth.uid() OR public.has_user_permission('contests.manage'));
REVOKE ALL ON public.contest_registrations FROM anon, authenticated;
GRANT SELECT ON public.contest_registrations TO authenticated;
GRANT ALL ON public.contest_registrations TO service_role;

CREATE OR REPLACE FUNCTION public.can_enter_contest(p_contest_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.contests c WHERE c.id = p_contest_id AND (
    public.has_user_permission('contests.manage') OR (c.is_public AND NOT c.registration_required)
    OR EXISTS(SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = c.id AND r.user_id = auth.uid() AND r.status = 'APPROVED')
  ));
$$;

CREATE OR REPLACE FUNCTION public.register_contest(p_contest_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contest public.contests%ROWTYPE; v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id AND is_public AND now() < end_time;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kỳ thi không mở đăng ký'; END IF;
  INSERT INTO public.contest_registrations(contest_id,user_id,status)
    VALUES(p_contest_id,auth.uid(),CASE WHEN v_contest.registration_required THEN 'PENDING' ELSE 'APPROVED' END)
    ON CONFLICT(contest_id,user_id) DO NOTHING;
  SELECT status INTO v_status FROM public.contest_registrations WHERE contest_id = p_contest_id AND user_id = auth.uid();
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_contest_registration(p_contest_id UUID, p_user_id UUID, p_approved BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_user_permission('contests.manage') THEN RAISE EXCEPTION 'Bạn không có quyền duyệt đăng ký'; END IF;
  INSERT INTO public.contest_registrations(contest_id,user_id,status)
    VALUES(p_contest_id,p_user_id,CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END)
    ON CONFLICT(contest_id,user_id) DO UPDATE SET status=EXCLUDED.status;
END;
$$;
REVOKE ALL ON FUNCTION public.register_contest(UUID), public.review_contest_registration(UUID,UUID,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_contest(UUID), public.review_contest_registration(UUID,UUID,BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS "Public contests are viewable by everyone" ON public.contests;
CREATE POLICY "Public contests are viewable by everyone" ON public.contests FOR SELECT
  USING(is_public OR public.can_enter_contest(id));
DROP POLICY IF EXISTS "Contest problems viewable with contest" ON public.contest_problems;
CREATE POLICY "Contest problems viewable with contest" ON public.contest_problems FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.contests c WHERE c.id=contest_id AND (
    public.has_user_permission('contests.manage') OR (public.can_enter_contest(c.id) AND now() >= c.start_time))));

CREATE OR REPLACE FUNCTION public.can_read_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.problems p WHERE p.id = p_problem_id AND (
    p.is_public OR public.has_user_permission('problems.manage')
    OR EXISTS (SELECT 1 FROM public.contest_problems cp JOIN public.contests c ON c.id = cp.contest_id
      WHERE cp.problem_id = p.id AND public.can_enter_contest(c.id) AND now() >= c.start_time)
    OR EXISTS (SELECT 1 FROM public.classroom_problems cp JOIN public.classrooms c ON c.id = cp.classroom_id
      WHERE cp.problem_id = p.id AND NOT c.is_archived
        AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id)))
  ));
$$;

CREATE OR REPLACE FUNCTION public.create_contest_submission(
  p_contest_id UUID,
  p_problem_id UUID,
  p_language TEXT,
  p_code TEXT
) RETURNS TABLE (id UUID) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_is_public BOOLEAN;
  v_present BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để nộp bài';
  END IF;
  IF p_language NOT IN ('cpp', 'python', 'rust', 'java') THEN
    RAISE EXCEPTION 'Ngôn ngữ không được hỗ trợ: %', p_language;
  END IF;
  IF char_length(p_code) > 100000 THEN
    RAISE EXCEPTION 'Mã nguồn quá dài';
  END IF;

  SELECT start_time, end_time, is_public INTO v_start, v_end, v_is_public
  FROM public.contests WHERE id = p_contest_id;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Kỳ thi không tồn tại';
  END IF;
  IF NOT public.can_enter_contest(p_contest_id) THEN RAISE EXCEPTION 'Bạn chưa được duyệt tham gia kỳ thi'; END IF;
  IF NOW() < v_start THEN
    RAISE EXCEPTION 'Kỳ thi chưa bắt đầu — chưa thể nộp bài';
  END IF;
  IF NOW() >= v_end THEN
    RAISE EXCEPTION 'Kỳ thi đã kết thúc — không thể nộp bài';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contest_problems
    WHERE contest_id = p_contest_id AND problem_id = p_problem_id
  ) INTO v_present;

  IF NOT v_present THEN
    RAISE EXCEPTION 'Bài tập không nằm trong kỳ thi này';
  END IF;

  RETURN QUERY
    INSERT INTO public.submissions AS s
      (user_id, problem_id, contest_id, language, code, status, details)
    VALUES (auth.uid(), p_problem_id, p_contest_id, p_language, p_code, 'PENDING', '[]')
    RETURNING s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_submission_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' OR (auth.uid() IS NULL AND session_user = 'postgres') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để nộp bài';
  END IF;
  IF NEW.language NOT IN ('cpp', 'python', 'rust') OR char_length(NEW.code) NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'Ngôn ngữ hoặc độ dài mã nguồn không hợp lệ';
  END IF;
  IF NEW.status <> 'PENDING' OR NEW.score <> 0 OR NEW.time_used_ms <> 0 OR NEW.memory_used_mb <> 0
     OR NEW.error_log IS NOT NULL OR NEW.judging_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Kết quả bài nộp chỉ được ghi bởi judge worker';
  END IF;
  IF NEW.is_validation AND NOT NEW.is_run THEN RAISE EXCEPTION 'Kiểm định phải được đánh dấu chạy thử'; END IF;
  IF NEW.is_run THEN
    IF NEW.is_validation THEN
      IF NOT public.has_user_permission('problems.manage') OR NOT public.has_user_permission('testcases.manage') OR NEW.details <> '[]'::jsonb THEN
        RAISE EXCEPTION 'Kiểm định không hợp lệ';
      END IF;
    ELSIF jsonb_typeof(NEW.details) IS DISTINCT FROM 'object'
       OR jsonb_typeof(NEW.details->'custom_input') IS DISTINCT FROM 'string'
       OR octet_length(NEW.details->>'custom_input') > 1048576
       OR NEW.details - 'custom_input' <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Input chạy thử không hợp lệ (tối đa 1 MiB)';
    END IF;
  ELSIF NEW.details <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Chi tiết kết quả chỉ được ghi bởi judge worker';
  END IF;
  IF NOT public.can_read_problem(NEW.problem_id) THEN
    RAISE EXCEPTION 'Bài tập không tồn tại hoặc không có quyền truy cập';
  END IF;
  IF NEW.contest_id IS NOT NULL THEN
    SELECT * INTO v_contest FROM public.contests WHERE id = NEW.contest_id;
    IF v_contest.id IS NULL OR now() < v_contest.start_time OR now() >= v_contest.end_time
       OR NOT public.can_enter_contest(NEW.contest_id) THEN
      RAISE EXCEPTION 'Kỳ thi không mở để nộp bài';
    END IF;
  END IF;
  IF NEW.classroom_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classrooms c JOIN public.classroom_problems cp ON cp.classroom_id = c.id
    WHERE c.id = NEW.classroom_id AND cp.problem_id = NEW.problem_id AND NOT c.is_archived
      AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id))
      AND (cp.deadline IS NULL OR now() <= cp.deadline)
  ) THEN
    RAISE EXCEPTION 'Lớp học không mở để nộp bài';
  END IF;
  -- Serialize submissions per user so concurrent requests cannot bypass quotas.
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  IF (SELECT count(*) FROM public.submissions WHERE user_id = auth.uid()
      AND created_at > now() - interval '1 minute') >= 10 THEN
    RAISE EXCEPTION 'Tối đa 10 lượt nộp/chạy thử mỗi phút';
  END IF;
  IF (SELECT count(*) FROM public.submissions WHERE user_id = auth.uid()
      AND status IN ('PENDING', 'JUDGING')) >= 3 THEN
    RAISE EXCEPTION 'Bạn đang có 3 bài chờ chấm, vui lòng đợi';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS freeze_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.contests'::regclass AND conname='contest_valid_times') THEN
    ALTER TABLE public.contests ADD CONSTRAINT contest_valid_times CHECK(end_time > start_time AND (freeze_at IS NULL OR (freeze_at >= start_time AND freeze_at < end_time))) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_contest_rank(p_contest_id UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  submission_number BIGINT,
  accepted_number BIGINT,
  total_time_seconds BIGINT,
  total_score BIGINT,
  problem_info JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rule TEXT;
  v_cutoff TIMESTAMPTZ;
  v_start TIMESTAMPTZ;
  v_user RECORD;
  v_entry RECORD;
  v_ac_at TIMESTAMPTZ;
  v_ac_time BIGINT;
  v_err_cnt BIGINT;
  v_best BIGINT;
  v_sub_cnt BIGINT;
  v_tot_subs BIGINT;
  v_tot_time BIGINT;
  v_ac_cnt BIGINT;
  v_tot_score BIGINT;
  v_info JSONB;
BEGIN
  SELECT rule_type::TEXT, start_time,
    CASE WHEN NOT public.has_user_permission('contests.manage') AND now() >= freeze_at AND now() < end_time THEN freeze_at END
    INTO v_rule, v_start, v_cutoff
  FROM public.contests WHERE id = p_contest_id;

  IF NOT EXISTS (SELECT 1 FROM public.contests WHERE id = p_contest_id AND
      (is_public OR public.can_enter_contest(id))) THEN
    RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc không có quyền truy cập';
  END IF;

  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Kỳ thi không tồn tại';
  END IF;

  FOR v_user IN
    SELECT s.user_id AS uid,
           COALESCE(NULLIF(p.full_name, p.email), 'user-' || left(p.id::text, 8)) AS uname,
           CASE WHEN p.id = auth.uid() OR public.has_user_permission('users.manage') THEN p.email ELSE '' END AS email,
           p.avatar_url AS ava
    FROM public.submissions s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.contest_id = p_contest_id AND (v_cutoff IS NULL OR s.created_at < v_cutoff) AND NOT COALESCE(s.is_run, false)
    GROUP BY s.user_id, p.id, p.full_name, p.email, p.avatar_url
  LOOP
    v_tot_subs := 0;
    v_tot_time := 0;
    v_tot_score := 0;
    v_ac_cnt := 0;
    v_info := '{}'::jsonb;

    FOR v_entry IN
      SELECT problem_id, score FROM public.contest_problems
      WHERE contest_id = p_contest_id
      ORDER BY sort_order, problem_id
    LOOP
      IF v_rule = 'ACM' THEN
        SELECT s.created_at INTO v_ac_at
        FROM public.submissions s
        WHERE s.contest_id = p_contest_id AND (v_cutoff IS NULL OR s.created_at < v_cutoff)
          AND s.user_id = v_user.uid
          AND s.problem_id = v_entry.problem_id
          AND s.status = 'ACCEPTED' AND NOT COALESCE(s.is_run, false)
        ORDER BY s.created_at
        LIMIT 1;

        IF FOUND THEN
          v_ac_time := GREATEST(0, EXTRACT(EPOCH FROM (v_ac_at - v_start))::BIGINT);
          SELECT COUNT(*) INTO v_err_cnt
          FROM public.submissions s
          WHERE s.contest_id = p_contest_id AND (v_cutoff IS NULL OR s.created_at < v_cutoff)
            AND s.user_id = v_user.uid
            AND s.problem_id = v_entry.problem_id
            AND s.created_at < v_ac_at
            AND s.status IN ('WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR')
            AND NOT COALESCE(s.is_run, false);

          v_sub_cnt := v_err_cnt + 1;
          v_ac_cnt := v_ac_cnt + 1;
          -- penalty = thời gian AC (giây) + 20 phút (1200s) cho mỗi lần sai
          v_tot_time := v_tot_time + v_ac_time + v_err_cnt * 1200;
          v_info := v_info || jsonb_build_object(
            v_entry.problem_id,
            jsonb_build_object(
              'is_ac', true,
              'time_seconds', v_ac_time,
              'error_count', v_err_cnt,
              'submission_count', v_sub_cnt
            )
          );
        ELSE
          SELECT COUNT(*) INTO v_sub_cnt
          FROM public.submissions s
          WHERE s.contest_id = p_contest_id AND (v_cutoff IS NULL OR s.created_at < v_cutoff)
            AND s.user_id = v_user.uid
            AND s.problem_id = v_entry.problem_id
            AND NOT COALESCE(s.is_run, false);

          v_info := v_info || jsonb_build_object(
            v_entry.problem_id,
            jsonb_build_object('is_ac', false, 'submission_count', v_sub_cnt)
          );
        END IF;
        v_tot_subs := v_tot_subs + v_sub_cnt;
      ELSE
        -- OI: điểm cao nhất cho từng bài
        SELECT COALESCE(MAX(s.score), 0), COUNT(*) INTO v_best, v_sub_cnt
        FROM public.submissions s
        WHERE s.contest_id = p_contest_id AND (v_cutoff IS NULL OR s.created_at < v_cutoff)
          AND s.user_id = v_user.uid
          AND s.problem_id = v_entry.problem_id
          AND NOT COALESCE(s.is_run, false);

        v_tot_score := v_tot_score + (v_best * COALESCE(v_entry.score, 100) / 100);
        v_tot_subs := v_tot_subs + v_sub_cnt;
        v_info := v_info || jsonb_build_object(
          v_entry.problem_id,
          jsonb_build_object('score', v_best, 'submission_count', v_sub_cnt)
        );
      END IF;
    END LOOP;

    RETURN QUERY SELECT
      v_user.uid, v_user.uname, v_user.email, v_user.ava,
      v_tot_subs, v_ac_cnt, v_tot_time, v_tot_score, v_info;
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin or own audit entries" ON public.admin_audit_log;
CREATE POLICY "Admin or own audit entries" ON public.admin_audit_log FOR SELECT
  USING(public.has_user_permission('users.manage') OR actor_id = auth.uid());
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.rejudge_submission(p_submission_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_submission public.submissions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_user_permission('submissions.view_all') OR
    NOT (public.has_user_permission('problems.manage') OR public.has_user_permission('contests.manage')) THEN
    RAISE EXCEPTION 'Bạn không có quyền chấm lại';
  END IF;
  SELECT * INTO v_submission FROM public.submissions WHERE id=p_submission_id FOR UPDATE;
  IF NOT FOUND OR v_submission.is_run OR v_submission.status IN ('PENDING','JUDGING') THEN
    RAISE EXCEPTION 'Chỉ chấm lại bài nộp đã kết thúc';
  END IF;
  INSERT INTO public.admin_audit_log(actor_id,action,target_id,payload)
    VALUES(auth.uid(),'submission.rejudge',p_submission_id,jsonb_build_object('previous_status',v_submission.status,'previous_score',v_submission.score));
  UPDATE public.submissions SET status='PENDING',score=0,time_used_ms=0,memory_used_mb=0,
    judging_started_at=NULL,error_log=NULL,details='[]' WHERE id=p_submission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rejudge_submission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rejudge_submission(UUID) TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
-- All flag changes must use set_account_suspension so Auth and audit stay atomic.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE(full_name, avatar_url, role) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_user(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND NOT is_suspended);
$$;

CREATE OR REPLACE FUNCTION public.guard_active_actor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'Tài khoản đã bị khóa'; END IF;
    IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
      IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended AND NOT public.has_user_permission('users.manage') THEN
        RAISE EXCEPTION 'Bạn không có quyền khóa/mở tài khoản';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DO $$ DECLARE v_table TEXT; BEGIN
  FOREACH v_table IN ARRAY ARRAY['profiles','user_permissions','problems','testcases','submissions','contests','announcements','contest_problems','classrooms','classroom_members','classroom_problems','system_settings','contest_registrations','problem_editorials'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_active_actor ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER guard_active_actor BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_active_actor()', v_table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_account_suspension(p_user_id UUID, p_suspended BOOLEAN, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT; v_revoked INT := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_user_permission('users.manage') THEN RAISE EXCEPTION 'Bạn không có quyền quản lý tài khoản'; END IF;
  IF p_user_id = auth.uid() OR p_suspended IS NULL OR length(trim(COALESCE(p_reason,''))) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Không tự khóa tài khoản; cần lý do từ 1–500 ký tự';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_role = 'admin' THEN RAISE EXCEPTION 'Không thể khóa/mở tài khoản này'; END IF;
  UPDATE public.profiles SET is_suspended=p_suspended WHERE id=p_user_id;
  -- Trusted database function owns Auth changes; no service key reaches the SPA.
  UPDATE auth.users SET banned_until=CASE WHEN p_suspended THEN now()+interval '100 years' ELSE NULL END WHERE id=p_user_id;
  IF p_suspended THEN
    DELETE FROM auth.sessions WHERE user_id=p_user_id;
    GET DIAGNOSTICS v_revoked = ROW_COUNT;
  END IF;
  INSERT INTO public.admin_audit_log(actor_id,action,target_id,payload)
    VALUES(auth.uid(),CASE WHEN p_suspended THEN 'account.suspend' ELSE 'account.restore' END,p_user_id,
      jsonb_build_object('reason',trim(p_reason),'revoked_sessions',v_revoked));
  RETURN jsonb_build_object('suspended',p_suspended,'revoked_sessions',v_revoked);
END;
$$;
REVOKE ALL ON FUNCTION public.set_account_suspension(UUID,BOOLEAN,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_account_suspension(UUID,BOOLEAN,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_user_permission(perm TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user(auth.uid()) AND CASE
    WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN true
    WHEN EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid()) THEN
      EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid() AND perm = ANY(codes)
      )
    WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') THEN
      perm IN ('problems.manage', 'testcases.manage', 'contests.manage', 'submissions.view_all')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_classroom_member(p_classroom_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user(auth.uid()) AND EXISTS (SELECT 1 FROM public.classroom_members
    WHERE classroom_id = p_classroom_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_classroom_progress(p_classroom_id UUID)
RETURNS TABLE (user_id UUID, problem_id UUID, status public.submission_status, score INT, time_used_ms INT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.classrooms c WHERE c.id = p_classroom_id
      AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  ) THEN RAISE EXCEPTION 'Bạn không có quyền xem bảng điểm lớp'; END IF;
  RETURN QUERY
    SELECT DISTINCT ON (s.user_id, s.problem_id)
      s.user_id, s.problem_id, s.status, s.score, s.time_used_ms, s.created_at
    FROM public.submissions s
    JOIN public.classroom_members m ON m.classroom_id = s.classroom_id AND m.user_id = s.user_id
    JOIN public.classroom_problems cp ON cp.classroom_id = s.classroom_id AND cp.problem_id = s.problem_id
    WHERE s.classroom_id = p_classroom_id AND NOT s.is_run
      AND s.status NOT IN ('PENDING', 'JUDGING', 'SYSTEM_ERROR')
      AND s.created_at >= GREATEST(m.joined_at, cp.created_at)
      AND (cp.deadline IS NULL OR s.created_at <= cp.deadline)
    ORDER BY s.user_id, s.problem_id, (s.status = 'ACCEPTED') DESC, s.score DESC, s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR public.is_active_user(auth.uid())) AND EXISTS (SELECT 1 FROM public.problems p WHERE p.id = p_problem_id AND (
    p.is_public OR public.has_user_permission('problems.manage')
    OR EXISTS (SELECT 1 FROM public.contest_problems cp JOIN public.contests c ON c.id = cp.contest_id
      WHERE cp.problem_id = p.id AND public.can_enter_contest(c.id) AND now() >= c.start_time)
    OR EXISTS (SELECT 1 FROM public.classroom_problems cp JOIN public.classrooms c ON c.id = cp.classroom_id
      WHERE cp.problem_id = p.id AND NOT c.is_archived
        AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id)))
  ));
$$;

CREATE OR REPLACE FUNCTION public.can_enter_contest(p_contest_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR public.is_active_user(auth.uid())) AND EXISTS(SELECT 1 FROM public.contests c WHERE c.id = p_contest_id AND (
    public.has_user_permission('contests.manage') OR (c.is_public AND NOT c.registration_required)
    OR EXISTS(SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = c.id AND r.user_id = auth.uid() AND r.status = 'APPROVED')
  ));
$$;

CREATE OR REPLACE FUNCTION public.audit_role_and_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target UUID; v_action TEXT; v_payload JSONB;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'profiles' THEN
      v_target := NEW.id; v_action := 'profile.role';
      v_payload := jsonb_build_object('previous_role',OLD.role,'role',NEW.role);
    ELSE
      v_action := 'permissions.change';
      IF TG_OP = 'DELETE' THEN
        v_target := OLD.user_id; v_payload := jsonb_build_object('codes','[]'::jsonb);
      ELSE
        v_target := NEW.user_id; v_payload := jsonb_build_object('codes',NEW.codes);
      END IF;
    END IF;
    INSERT INTO public.admin_audit_log(actor_id,action,target_id,payload) VALUES(auth.uid(),v_action,v_target,v_payload);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_profile_role ON public.profiles;
CREATE TRIGGER audit_profile_role AFTER UPDATE OF role ON public.profiles FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role) EXECUTE FUNCTION public.audit_role_and_permissions();
DROP TRIGGER IF EXISTS audit_permissions ON public.user_permissions;
CREATE TRIGGER audit_permissions AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_and_permissions();

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS is_validation BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.problem_validations (
  problem_id UUID PRIMARY KEY REFERENCES public.problems(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.problem_validations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view validation" ON public.problem_validations;
CREATE POLICY "Staff view validation" ON public.problem_validations FOR SELECT USING(public.has_user_permission('problems.manage'));
REVOKE ALL ON public.problem_validations FROM anon, authenticated;
GRANT SELECT ON public.problem_validations TO authenticated;
GRANT ALL ON public.problem_validations TO service_role;

CREATE OR REPLACE FUNCTION public.validate_problem_solution(p_problem_id UUID, p_language TEXT, p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_user_permission('problems.manage') OR NOT public.has_user_permission('testcases.manage') THEN
    RAISE EXCEPTION 'Bạn không có quyền kiểm định lời giải';
  END IF;
  PERFORM 1 FROM public.problems WHERE id=p_problem_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.testcases WHERE problem_id=p_problem_id) THEN RAISE EXCEPTION 'Hãy lưu đề và testcase trước khi kiểm định'; END IF;
  INSERT INTO public.submissions(user_id,problem_id,language,code,is_run,is_validation,details)
    VALUES(auth.uid(),p_problem_id,p_language,p_code,true,true,'[]') RETURNING id INTO v_id;
  INSERT INTO public.problem_validations(problem_id,submission_id) VALUES(p_problem_id,v_id)
    ON CONFLICT(problem_id) DO UPDATE SET submission_id=EXCLUDED.submission_id,requested_at=now();
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_problem_solution(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_problem_solution(UUID,TEXT,TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
