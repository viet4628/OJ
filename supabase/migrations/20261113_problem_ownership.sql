BEGIN;

-- Problem ownership mirrors contests: a teacher reads hidden testcases, edits,
-- validates and deletes only problems they created; admins manage all problems,
-- including legacy ones without a creator. Private problems are readable only by
-- their managers (or their contest/classroom audience), and only public or owned
-- problems can be attached to a contest or classroom.
-- Definitions are copied from supabase/schema.sql (latest versions).

CREATE OR REPLACE FUNCTION public.can_manage_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_user_permission('problems.manage') AND EXISTS (
    SELECT 1 FROM public.problems p WHERE p.id=p_problem_id AND (
      p.created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_problem(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_problem(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR public.is_active_user(auth.uid())) AND EXISTS (SELECT 1 FROM public.problems p WHERE p.id = p_problem_id AND (
    p.is_public OR public.can_manage_problem(p.id)
    OR EXISTS (SELECT 1 FROM public.contest_problems cp JOIN public.contests c ON c.id = cp.contest_id
      WHERE cp.problem_id = p.id AND public.can_enter_contest(c.id) AND now() >= c.start_time)
    OR EXISTS (SELECT 1 FROM public.classroom_problems cp JOIN public.classrooms c ON c.id = cp.classroom_id
      WHERE cp.problem_id = p.id AND NOT c.is_archived
        AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id)))
  ));
$$;

CREATE OR REPLACE FUNCTION public.get_problem_editorial(p_problem_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT public.can_manage_problem(p_problem_id) AND (
    NOT public.can_read_problem(p_problem_id)
    OR NOT EXISTS (SELECT 1 FROM public.submissions WHERE user_id = auth.uid() AND problem_id = p_problem_id AND status = 'ACCEPTED' AND NOT is_run)
    OR EXISTS (SELECT 1 FROM public.contest_problems cp JOIN public.contests c ON c.id = cp.contest_id
      WHERE cp.problem_id = p_problem_id AND now() >= c.start_time AND now() < c.end_time)
  ) THEN RETURN NULL; END IF;
  RETURN (SELECT content FROM public.problem_editorials WHERE problem_id = p_problem_id);
END;
$$;

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
    IF NOT public.can_manage_problem(p_problem_id) THEN RAISE EXCEPTION 'Bạn chỉ sửa được đề do mình tạo'; END IF;
    IF EXISTS (SELECT 1 FROM public.submissions WHERE problem_id = p_problem_id AND status IN ('PENDING','JUDGING')) THEN
      RAISE EXCEPTION 'Hãy đợi các bài đang chấm hoàn tất trước khi sửa đề';
    END IF;
  END IF;
  INSERT INTO public.problems (id, title, slug, description, input_format, output_format, difficulty, time_limit_ms, memory_limit_mb, tags, samples, is_public, created_by, starter_codes)
  VALUES (v_id, trim(p_problem->>'title'), p_problem->>'slug', p_problem->>'description', p_problem->>'input_format', p_problem->>'output_format',
    (p_problem->>'difficulty')::public.problem_difficulty, (p_problem->>'time_limit_ms')::int, (p_problem->>'memory_limit_mb')::int,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_problem->'tags','[]'))), COALESCE(p_problem->'samples','[]'), COALESCE((p_problem->>'is_public')::boolean,false), auth.uid(), COALESCE(p_problem->'starter_codes','{}'::jsonb))
  ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, slug=EXCLUDED.slug, description=EXCLUDED.description,
    input_format=EXCLUDED.input_format, output_format=EXCLUDED.output_format, difficulty=EXCLUDED.difficulty,
    time_limit_ms=EXCLUDED.time_limit_ms, memory_limit_mb=EXCLUDED.memory_limit_mb, tags=EXCLUDED.tags,
    samples=EXCLUDED.samples, is_public=EXCLUDED.is_public,
    starter_codes=CASE WHEN p_problem ? 'starter_codes' THEN EXCLUDED.starter_codes ELSE problems.starter_codes END, updated_at=now();
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
      IF NOT public.can_manage_problem(NEW.problem_id) OR NOT public.has_user_permission('testcases.manage') OR NEW.details <> '[]'::jsonb THEN
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

CREATE OR REPLACE FUNCTION public.validate_problem_solution(p_problem_id UUID, p_language TEXT, p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_problem(p_problem_id) OR NOT public.has_user_permission('testcases.manage') THEN
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

CREATE OR REPLACE FUNCTION public.delete_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contest_problems WHERE problem_id=p_problem_id AND NOT public.can_manage_contest(contest_id)
  ) THEN RAISE EXCEPTION 'Không thể xóa đề đang được dùng trong kỳ thi bạn không quản lý'; END IF;
  -- Kiểm tra quyền: admin hoặc người tạo bài có quyền problems.manage
  v_allowed := public.can_manage_problem(p_problem_id);

  IF v_allowed IS NOT TRUE THEN
    RAISE EXCEPTION 'Bạn chỉ xóa được bài tập do mình tạo';
  END IF;

  -- Xóa sạch các bảng liên quan để tránh lỗi khóa ngoại
  DELETE FROM public.contest_problems WHERE problem_id = p_problem_id;
  DELETE FROM public.classroom_problems WHERE problem_id = p_problem_id;
  DELETE FROM public.testcases WHERE problem_id = p_problem_id;
  DELETE FROM public.submissions WHERE problem_id = p_problem_id;
  DELETE FROM public.problems WHERE id = p_problem_id;

  RETURN TRUE;
END;
$$;

DROP POLICY IF EXISTS "Staff view validation" ON public.problem_validations;
CREATE POLICY "Staff view validation" ON public.problem_validations FOR SELECT USING(public.can_manage_problem(problem_id));

DROP POLICY IF EXISTS "Teachers and admins can manage contest problems" ON public.contest_problems;
CREATE POLICY "Teachers and admins can manage contest problems" ON public.contest_problems FOR ALL
  USING(public.can_manage_contest(contest_id)) WITH CHECK(public.can_manage_contest(contest_id) AND EXISTS(
    SELECT 1 FROM public.problems p WHERE p.id=problem_id AND (p.is_public OR public.can_manage_problem(p.id))));

-- Hidden testcases, reference explanations and deletion follow problem ownership.
DROP POLICY IF EXISTS "Testcases accessible by admins and teachers" ON public.testcases;
DROP POLICY IF EXISTS "Testcases readable by problem managers" ON public.testcases;
CREATE POLICY "Testcases readable by problem managers" ON public.testcases FOR SELECT
  USING (public.has_user_permission('testcases.manage') AND public.can_manage_problem(problem_id));
DROP POLICY IF EXISTS "Staff manage editorials" ON public.problem_editorials;
CREATE POLICY "Staff manage editorials" ON public.problem_editorials FOR ALL
  USING (public.can_manage_problem(problem_id)) WITH CHECK (public.can_manage_problem(problem_id));
DROP POLICY IF EXISTS "Teachers and admins can delete problems" ON public.problems;
CREATE POLICY "Teachers and admins can delete problems" ON public.problems FOR DELETE
  USING (public.can_manage_problem(id));
DROP POLICY IF EXISTS "Teachers and admins can manage classroom problems" ON public.classroom_problems;
CREATE POLICY "Teachers and admins can manage classroom problems" ON public.classroom_problems FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_problems.classroom_id AND c.teacher_id = auth.uid()))
  WITH CHECK ((auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_problems.classroom_id AND c.teacher_id = auth.uid()))
    AND EXISTS (SELECT 1 FROM public.problems p WHERE p.id = problem_id AND (p.is_public OR public.can_manage_problem(p.id))));

NOTIFY pgrst, 'reload schema';
COMMIT;
