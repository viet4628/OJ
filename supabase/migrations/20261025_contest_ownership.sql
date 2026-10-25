-- Contest ownership: granular permission plus creator, with super-admin bypass.
BEGIN;

ALTER TABLE public.contests ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.can_manage_contest(p_contest_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_user_permission('contests.manage') AND EXISTS (
    SELECT 1 FROM public.contests c WHERE c.id=p_contest_id AND (
      c.created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_contest(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_contest(UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Teachers and admins can manage contests" ON public.contests;
DROP POLICY IF EXISTS "Contest managers insert own" ON public.contests;
CREATE POLICY "Contest managers insert own" ON public.contests FOR INSERT WITH CHECK (
  public.has_user_permission('contests.manage') AND (
    created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
  )
);
DROP POLICY IF EXISTS "Contest owners update" ON public.contests;
CREATE POLICY "Contest owners update" ON public.contests FOR UPDATE USING(public.can_manage_contest(id)) WITH CHECK (
  public.has_user_permission('contests.manage') AND (
    created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
  )
);
DROP POLICY IF EXISTS "Contest owners delete" ON public.contests;
CREATE POLICY "Contest owners delete" ON public.contests FOR DELETE USING(public.can_manage_contest(id));

DROP POLICY IF EXISTS "Teachers and admins can manage contest problems" ON public.contest_problems;
CREATE POLICY "Teachers and admins can manage contest problems" ON public.contest_problems FOR ALL
  USING(public.can_manage_contest(contest_id)) WITH CHECK(public.can_manage_contest(contest_id));
DROP POLICY IF EXISTS "Contest problems viewable with contest" ON public.contest_problems;
CREATE POLICY "Contest problems viewable with contest" ON public.contest_problems FOR SELECT USING (
  public.can_manage_contest(contest_id) OR EXISTS (
    SELECT 1 FROM public.contests c WHERE c.id=contest_id AND public.can_enter_contest(c.id) AND now()>=c.start_time
  )
);
DROP POLICY IF EXISTS "Own registration or contest manager" ON public.contest_registrations;
CREATE POLICY "Own registration or contest manager" ON public.contest_registrations FOR SELECT
  USING(user_id=auth.uid() OR public.can_manage_contest(contest_id));

-- Direct problem deletion must not cascade away a foreign contest's selection.
CREATE OR REPLACE FUNCTION public.guard_problem_delete_contest()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contest_problems WHERE problem_id=OLD.id AND NOT public.can_manage_contest(contest_id)
  ) THEN RAISE EXCEPTION 'Không thể xóa đề đang được dùng trong kỳ thi bạn không quản lý'; END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS guard_problem_delete_contest ON public.problems;
CREATE TRIGGER guard_problem_delete_contest BEFORE DELETE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.guard_problem_delete_contest();


CREATE OR REPLACE FUNCTION public.can_enter_contest(p_contest_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR public.is_active_user(auth.uid())) AND EXISTS(SELECT 1 FROM public.contests c WHERE c.id = p_contest_id AND (
    public.can_manage_contest(c.id) OR (c.is_public AND NOT c.registration_required)
    OR EXISTS(SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = c.id AND r.user_id = auth.uid() AND r.status = 'APPROVED')
  ));
$$;

CREATE OR REPLACE FUNCTION public.review_contest_registration(p_contest_id UUID, p_user_id UUID, p_approved BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Bạn không có quyền duyệt đăng ký'; END IF;
  INSERT INTO public.contest_registrations(contest_id,user_id,status)
    VALUES(p_contest_id,p_user_id,CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END)
    ON CONFLICT(contest_id,user_id) DO UPDATE SET status=EXCLUDED.status;
END;
$$;

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
  IF v_submission.contest_id IS NOT NULL AND NOT public.can_manage_contest(v_submission.contest_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền chấm lại bài nộp trong kỳ thi này';
  END IF;
  INSERT INTO public.admin_audit_log(actor_id,action,target_id,payload)
    VALUES(auth.uid(),'submission.rejudge',p_submission_id,jsonb_build_object('previous_status',v_submission.status,'previous_score',v_submission.score));
  UPDATE public.submissions SET status='PENDING',score=0,time_used_ms=0,memory_used_mb=0,
    judging_started_at=NULL,error_log=NULL,details='[]' WHERE id=p_submission_id;
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
  -- Kiểm tra quyền: admin, quyền problems.manage, hoặc chính người tạo bài
  SELECT (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('problems.manage')
    OR created_by = auth.uid()
  ) INTO v_allowed
  FROM public.problems WHERE id = p_problem_id;

  IF v_allowed IS NOT TRUE THEN
    RAISE EXCEPTION 'Bạn không có quyền xóa bài tập này (cần quyền problems.manage hoặc là người tạo bài)';
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
    CASE WHEN NOT public.can_manage_contest(p_contest_id) AND now() >= freeze_at AND now() < end_time THEN freeze_at END
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

DROP POLICY IF EXISTS "Public contests are viewable by everyone" ON public.contests;
CREATE POLICY "Public contests are viewable by everyone" ON public.contests FOR SELECT USING (
  is_public OR (
    public.has_user_permission('contests.manage') AND (
      created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
    )
  ) OR public.can_enter_contest(id)
);

NOTIFY pgrst, 'reload schema';
COMMIT;
