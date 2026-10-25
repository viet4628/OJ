-- Public starter code per problem/language; run before deploying the editor changes.
BEGIN;

-- Public editor scaffolds, separate from private reference solutions/editorials.
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS starter_codes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.problems DROP CONSTRAINT IF EXISTS problems_starter_codes_valid;
ALTER TABLE public.problems ADD CONSTRAINT problems_starter_codes_valid CHECK (
  jsonb_typeof(starter_codes) = 'object'
  AND starter_codes - ARRAY['cpp','python','rust'] = '{}'::jsonb
  AND NOT jsonb_path_exists(starter_codes, '$.* ? (@.type() != "string")')
  AND octet_length(starter_codes::text) <= 200000
);

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
REVOKE ALL ON FUNCTION public.save_problem_bundle(UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_problem_bundle(UUID, JSONB, JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
