-- ========================================================
-- ONLINE JUDGE (NOTARY OJ) - SUPABASE DATABASE SCHEMA
-- Idempotent: can be re-run safely any number of times.
-- ========================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS & TYPES (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'teacher', 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    CREATE TYPE public.submission_status AS ENUM (
      'PENDING',
      'JUDGING',
      'ACCEPTED',
      'WRONG_ANSWER',
      'TIME_LIMIT_EXCEEDED',
      'MEMORY_LIMIT_EXCEEDED',
      'COMPILE_ERROR',
      'RUNTIME_ERROR',
      'SYSTEM_ERROR'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'problem_difficulty') THEN
    CREATE TYPE public.problem_difficulty AS ENUM ('Easy', 'Medium', 'Hard');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_rule') THEN
    CREATE TYPE public.contest_rule AS ENUM ('ACM', 'OI');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_status') THEN
    CREATE TYPE public.contest_status AS ENUM ('UNDERWAY', 'NOT_STARTED', 'ENDED');
  END IF;
END $$;

-- 2. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'user'::user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. PROBLEMS TABLE
CREATE TABLE IF NOT EXISTS public.problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  input_format TEXT,
  output_format TEXT,
  samples JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of { input: string, output: string }
  time_limit_ms INT DEFAULT 1000 NOT NULL,
  memory_limit_mb INT DEFAULT 256 NOT NULL,
  difficulty problem_difficulty DEFAULT 'Easy'::problem_difficulty NOT NULL,
  tags TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. TESTCASES TABLE (References file paths in Private Supabase Storage Bucket)
CREATE TABLE IF NOT EXISTS public.testcases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  input_path TEXT NOT NULL,  -- Storage object path: testcases/<problem_id>/1.in
  output_path TEXT NOT NULL, -- Storage object path: testcases/<problem_id>/1.out
  input_content TEXT,        -- Inline input (admin editor / no storage)
  output_content TEXT,       -- Inline expected output (admin editor / no storage)
  score INT DEFAULT 10 NOT NULL,
  is_sample BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Upgrade existing installs
ALTER TABLE public.testcases ADD COLUMN IF NOT EXISTS input_content TEXT;
ALTER TABLE public.testcases ADD COLUMN IF NOT EXISTS output_content TEXT;

-- 5. SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  language TEXT NOT NULL, -- 'cpp', 'python', 'java', 'rust'
  code TEXT NOT NULL,
  status submission_status DEFAULT 'PENDING'::submission_status NOT NULL,
  time_used_ms INT DEFAULT 0 NOT NULL,
  memory_used_mb INT DEFAULT 0 NOT NULL,
  score INT DEFAULT 0 NOT NULL,
  error_log TEXT,
  details JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of { testcase_id: string, status: string, time_ms: number, memory_mb: number }
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Chạy thử (run) KHÔNG được tính vào lịch sử/rank/statistics
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS is_run BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_submissions_is_run ON public.submissions(is_run);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id ON public.submissions(problem_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);

-- 6. CONTESTS TABLE
CREATE TABLE IF NOT EXISTS public.contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_type contest_rule DEFAULT 'ACM'::contest_rule NOT NULL,
  status contest_status DEFAULT 'NOT_STARTED'::contest_status NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT DEFAULT 'HỆ THỐNG' NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT DEFAULT 'Admin' NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. USER RANK VIEW (Aggregates submissions for leaderboard, EXCLUDES runs and staff/admin)
DROP VIEW IF EXISTS public.user_rank;
CREATE OR REPLACE VIEW public.user_rank AS
SELECT
  p.id AS user_id,
  p.full_name AS username,
  p.avatar_url,
  COUNT(s.id) FILTER (WHERE s.status = 'ACCEPTED' AND NOT COALESCE(s.is_run, false)) AS accepted_number,
  COUNT(s.id) FILTER (WHERE NOT COALESCE(s.is_run, false)) AS submission_number,
  COALESCE(SUM(s.score) FILTER (WHERE s.status = 'ACCEPTED' AND NOT COALESCE(s.is_run, false)), 0) AS total_score,
  p.role
FROM public.profiles p
LEFT JOIN public.submissions s ON s.user_id = p.id
WHERE p.role = 'user'
GROUP BY p.id, p.role
ORDER BY accepted_number DESC;

-- --------------------------------------------------------
-- RBAC PERMISSIONS (user_permissions)
-- (định nghĩa TRƯỚC policies vì các policy gọi hàm này)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  codes TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Check current user has a permission code
CREATE OR REPLACE FUNCTION public.has_user_permission(perm TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE 
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

DROP POLICY IF EXISTS "Permission rows selectable by admins" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions and admins can view all" ON public.user_permissions;
CREATE POLICY "Users can view own permissions and admins can view all"
  ON public.user_permissions FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

DROP POLICY IF EXISTS "Permission rows updatable by admins" ON public.user_permissions;
CREATE POLICY "Permission rows updatable by admins"
  ON public.user_permissions FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('users.manage')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('users.manage')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;

-- Auto-sync default permissions on role promotion/demotion
CREATE OR REPLACE FUNCTION public.handle_profile_role_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'teacher' AND (OLD.role IS NULL OR OLD.role <> 'teacher') THEN
    INSERT INTO public.user_permissions (user_id, codes)
    VALUES (NEW.id, ARRAY['problems.manage', 'testcases.manage', 'contests.manage', 'submissions.view_all'])
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF NEW.role = 'user' AND OLD.role = 'teacher' THEN
    DELETE FROM public.user_permissions WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_role_sync ON public.profiles;
CREATE TRIGGER on_profile_role_sync
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_role_sync();

-- --------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- user_rank view: readable by everyone (Supabase views inherit table RLS off by default,
-- so grant SELECT explicitly for anon + authenticated)
GRANT SELECT ON public.user_rank TO anon, authenticated;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile role" ON public.profiles;
CREATE POLICY "Admins can update any profile role"
  ON public.profiles FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('users.manage'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('users.manage'));

-- Problems Policies
DROP POLICY IF EXISTS "Public problems are viewable by everyone" ON public.problems;
CREATE POLICY "Public problems are viewable by everyone" 
  ON public.problems FOR SELECT USING (
    is_public = true 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('problems.manage')
  );

DROP POLICY IF EXISTS "Teachers and admins can insert problems" ON public.problems;
CREATE POLICY "Teachers and admins can insert problems" 
  ON public.problems FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('problems.manage')
  );

DROP POLICY IF EXISTS "Teachers and admins can update problems" ON public.problems;
CREATE POLICY "Teachers and admins can update problems" 
  ON public.problems FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('problems.manage')
  );

DROP POLICY IF EXISTS "Teachers and admins can delete problems" ON public.problems;
CREATE POLICY "Teachers and admins can delete problems" 
  ON public.problems FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('problems.manage')
    OR created_by = auth.uid()
  );

-- Testcases Policies (Restricted to Teachers/Admins/ServiceRole)
DROP POLICY IF EXISTS "Testcases accessible by admins and teachers" ON public.testcases;
CREATE POLICY "Testcases accessible by admins and teachers" 
  ON public.testcases FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('testcases.manage')
  );

-- Submissions Policies
DROP POLICY IF EXISTS "Submissions viewable by owner or teachers/admins" ON public.submissions;
CREATE POLICY "Submissions viewable by owner or teachers/admins" 
  ON public.submissions FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('submissions.view_all')
  );

DROP POLICY IF EXISTS "Authenticated users can create submissions" ON public.submissions;
CREATE POLICY "Authenticated users can create submissions" 
  ON public.submissions FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Contests Policies
DROP POLICY IF EXISTS "Public contests are viewable by everyone" ON public.contests;
CREATE POLICY "Public contests are viewable by everyone" 
  ON public.contests FOR SELECT USING (
    is_public = true 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('contests.manage')
  );

DROP POLICY IF EXISTS "Teachers and admins can manage contests" ON public.contests;
CREATE POLICY "Teachers and admins can manage contests" 
  ON public.contests FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('contests.manage')
  );

-- Announcements Policies
DROP POLICY IF EXISTS "Public announcements are viewable by everyone" ON public.announcements;
CREATE POLICY "Public announcements are viewable by everyone" 
  ON public.announcements FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Teachers and admins can manage announcements" ON public.announcements;
CREATE POLICY "Teachers and admins can manage announcements" 
  ON public.announcements FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('announcements.manage')
  );

-- --------------------------------------------------------
-- 6b. CONTEST PROBLEMS (bài tập trong kỳ thi)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contest_problems (
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (contest_id, problem_id)
);

-- Upgrade existing installs: per-problem max score for OI contests
ALTER TABLE public.contest_problems ADD COLUMN IF NOT EXISTS score INT DEFAULT 100 NOT NULL;

ALTER TABLE public.contest_problems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contest problems viewable with contest" ON public.contest_problems;
CREATE POLICY "Contest problems viewable with contest"
  ON public.contest_problems FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_id
        AND (c.is_public = true OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin') OR public.has_user_permission('contests.manage'))
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can manage contest problems" ON public.contest_problems;
CREATE POLICY "Teachers and admins can manage contest problems"
  ON public.contest_problems FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.has_user_permission('contests.manage')
  );

-- --------------------------------------------------------
-- 6b. SUBMISSIONS: contest_id (submission trong kỳ thi)
-- --------------------------------------------------------
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS contest_id UUID REFERENCES public.contests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_submissions_contest_id ON public.submissions(contest_id);

-- --------------------------------------------------------
-- 6c. CLASSROOMS (Hệ thống Lớp học cho Giáo viên & Học sinh)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  code VARCHAR(12) UNIQUE NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.classroom_members (
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student' NOT NULL, -- 'student' | 'teacher'
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (classroom_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.classroom_problems (
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (classroom_id, problem_id)
);

-- Cột classroom_id trong submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_submissions_classroom_id ON public.submissions(classroom_id);

-- Enable RLS
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_problems ENABLE ROW LEVEL SECURITY;

-- 1. Classrooms Policies
DROP POLICY IF EXISTS "Classrooms viewable by members, teacher, or admin" ON public.classrooms;
CREATE POLICY "Classrooms viewable by members, teacher, or admin"
  ON public.classrooms FOR SELECT USING (
    teacher_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classroom_members cm 
      WHERE cm.classroom_id = id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can insert classrooms" ON public.classrooms;
CREATE POLICY "Teachers and admins can insert classrooms"
  ON public.classrooms FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    OR public.has_user_permission('problems.manage')
  );

DROP POLICY IF EXISTS "Teachers and admins can update own classrooms" ON public.classrooms;
CREATE POLICY "Teachers and admins can update own classrooms"
  ON public.classrooms FOR UPDATE USING (
    teacher_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

DROP POLICY IF EXISTS "Teachers and admins can delete own classrooms" ON public.classrooms;
CREATE POLICY "Teachers and admins can delete own classrooms"
  ON public.classrooms FOR DELETE USING (
    teacher_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- 2. Classroom Members Policies
DROP POLICY IF EXISTS "Classroom members viewable by classmates, teacher, or admin" ON public.classroom_members;
CREATE POLICY "Classroom members viewable by classmates, teacher, or admin"
  ON public.classroom_members FOR SELECT USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.classroom_members cm 
      WHERE cm.classroom_id = classroom_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can manage classroom members" ON public.classroom_members;
CREATE POLICY "Teachers and admins can manage classroom members"
  ON public.classroom_members FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_id AND c.teacher_id = auth.uid()
    )
    OR user_id = auth.uid() -- Học sinh có thể tự rời lớp
  );

-- 3. Classroom Problems Policies
DROP POLICY IF EXISTS "Classroom problems viewable by members, teacher, or admin" ON public.classroom_problems;
CREATE POLICY "Classroom problems viewable by members, teacher, or admin"
  ON public.classroom_problems FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.classroom_members cm 
      WHERE cm.classroom_id = classroom_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can manage classroom problems" ON public.classroom_problems;
CREATE POLICY "Teachers and admins can manage classroom problems"
  ON public.classroom_problems FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_id AND c.teacher_id = auth.uid()
    )
  );

-- 4. RPC: Tham gia lớp học bằng mã mời (Join Classroom by Code)
CREATE OR REPLACE FUNCTION public.join_classroom(p_code TEXT)
RETURNS public.classrooms LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class public.classrooms%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để tham gia lớp học';
  END IF;

  SELECT * INTO v_class
  FROM public.classrooms
  WHERE UPPER(TRIM(code)) = UPPER(TRIM(p_code)) AND is_archived = false;

  IF v_class.id IS NULL THEN
    RAISE EXCEPTION 'Mã lớp học không hợp lệ hoặc lớp đã bị đóng';
  END IF;

  -- Thêm học sinh vào lớp nếu chưa có
  INSERT INTO public.classroom_members (classroom_id, user_id, role)
  VALUES (v_class.id, auth.uid(), 'student')
  ON CONFLICT (classroom_id, user_id) DO NOTHING;

  RETURN v_class;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_classroom(TEXT) TO authenticated;

-- 5. RPC: Xóa lớp học an toàn (Dọn sạch liên kết)
CREATE OR REPLACE FUNCTION public.delete_classroom(p_classroom_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.classrooms 
    WHERE id = p_classroom_id 
      AND (teacher_id = auth.uid() OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền xóa lớp học này';
  END IF;

  DELETE FROM public.classroom_problems WHERE classroom_id = p_classroom_id;
  DELETE FROM public.classroom_members WHERE classroom_id = p_classroom_id;
  DELETE FROM public.classrooms WHERE id = p_classroom_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_classroom(UUID) TO authenticated;

-- --------------------------------------------------------
-- 6c. RPC: NỘP BÀI TRONG KỲ THI (chặn ngoài giờ, ngoài danh sách bài)
-- --------------------------------------------------------
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
  IF NOT v_is_public AND auth.uid() NOT IN (SELECT id FROM public.profiles WHERE role = 'admin')
     AND NOT public.has_user_permission('contests.manage') THEN
    RAISE EXCEPTION 'Kỳ thi không công khai — không thể nộp bài';
  END IF;
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

-- ------------------------------------------------------------
-- 6d. RPC: BẢNG XẾP HẠNG KỲ THI (ACM + OI, không lộ code/chi tiết)
--  ACM: số bài AC, penalty = tổng(ac_time + 20 phút * số lần sai)
--  OI : tổng điểm tốt nhất cho từng bài
-- ------------------------------------------------------------
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
  SELECT rule_type::TEXT, start_time INTO v_rule, v_start
  FROM public.contests WHERE id = p_contest_id;

  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Kỳ thi không tồn tại';
  END IF;

  FOR v_user IN
    SELECT s.user_id AS uid,
           COALESCE(p.full_name, p.email) AS uname,
           p.email AS email,
           p.avatar_url AS ava
    FROM public.submissions s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.contest_id = p_contest_id AND NOT COALESCE(s.is_run, false)
    GROUP BY s.user_id, p.full_name, p.email, p.avatar_url
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
        WHERE s.contest_id = p_contest_id
          AND s.user_id = v_user.uid
          AND s.problem_id = v_entry.problem_id
          AND s.status = 'ACCEPTED' AND NOT COALESCE(s.is_run, false)
        ORDER BY s.created_at
        LIMIT 1;

        IF FOUND THEN
          v_ac_time := GREATEST(0, EXTRACT(EPOCH FROM (v_ac_at - v_start))::BIGINT);
          SELECT COUNT(*) INTO v_err_cnt
          FROM public.submissions s
          WHERE s.contest_id = p_contest_id
            AND s.user_id = v_user.uid
            AND s.problem_id = v_entry.problem_id
            AND s.created_at < v_ac_at
            AND s.status <> 'ACCEPTED'
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
          WHERE s.contest_id = p_contest_id
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
        WHERE s.contest_id = p_contest_id
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

GRANT EXECUTE ON FUNCTION public.create_contest_submission(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_rank(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 6e. STORAGE: bucket testcases PHẢI là private (chặn lộ hidden qua URL)
-- ------------------------------------------------------------
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('testcases', 'testcases', false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 6e2. STORAGE: bucket avatars PUBLIC (ảnh đại diện, mỗi user chỉ
--      được ghi vào thư mục avatars/<uid>/*)
-- ------------------------------------------------------------
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DROP POLICY IF EXISTS "Avatar owner can upload" ON storage.objects;
CREATE POLICY "Avatar owner can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar owner can update" ON storage.objects;
CREATE POLICY "Avatar owner can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar owner can delete" ON storage.objects;
CREATE POLICY "Avatar owner can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 6f. RPC: CHẠY THỬ QUA JUDGE THẬT (is_run = true, KHÔNG chấm testcase,
--     không tính vào lịch sử / xếp hạng / statistics)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.judge_problem_code(
  p_problem_id UUID,
  p_language TEXT,
  p_code TEXT,
  p_input TEXT DEFAULT ''
) RETURNS TABLE (id UUID) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để chạy thử';
  END IF;
  IF p_language NOT IN ('cpp', 'python', 'rust', 'java') THEN
    RAISE EXCEPTION 'Ngôn ngữ không được hỗ trợ';
  END IF;
  IF char_length(p_code) > 100000 THEN
    RAISE EXCEPTION 'Mã nguồn quá dài';
  END IF;

  SELECT (is_public = true OR auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  ) OR public.has_user_permission('problems.manage')) INTO v_allowed
  FROM public.problems WHERE id = p_problem_id;

  IF v_allowed IS NULL OR NOT v_allowed THEN
    RAISE EXCEPTION 'Bài tập không tồn tại';
  END IF;

  RETURN QUERY
    INSERT INTO public.submissions AS s
      (user_id, problem_id, language, code, status, is_run, details)
    VALUES (auth.uid(), p_problem_id, p_language, p_code, 'PENDING', true,
      jsonb_build_object('custom_input', COALESCE(p_input, '')))
    RETURNING s.id;
END;
$$;

-- ------------------------------------------------------------
-- 6g. RPC: BẢNG XẾP HẠNG BÀI TẬP (AC đầu tiên của từng người,
--     không tính chạy thử, không lộ code)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_problem_rank(p_problem_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  language TEXT,
  time_ms INT,
  memory_mb INT,
  accepted_at TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH first_ac AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.language, s.time_used_ms, s.memory_used_mb, s.created_at, s.id
    FROM public.submissions s
    WHERE s.problem_id = p_problem_id
      AND s.status = 'ACCEPTED'
      AND NOT COALESCE(s.is_run, false)
    ORDER BY s.user_id, s.created_at, s.time_used_ms, s.id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY fa.created_at, fa.time_used_ms, fa.id)::bigint AS rank,
    fa.user_id,
    COALESCE(pu.full_name, pu.email) AS username,
    pu.avatar_url,
    fa.language,
    fa.time_used_ms,
    fa.memory_used_mb,
    fa.created_at AS accepted_at
  FROM first_ac fa
  LEFT JOIN public.profiles pu ON pu.id = fa.user_id
  ORDER BY fa.created_at, fa.time_used_ms, fa.id
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.judge_problem_code(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_problem_rank(uuid, int) TO anon, authenticated;

-- ------------------------------------------------------------
-- 6h. RPC: CLAIM SUBMISSION ATOMIC (PENDING -> JUDGING)
--     Nhiều worker chạy song song vẫn an toàn: chỉ worker nào
--     cập nhật được dòng còn PENDING mới sở hữu bài nộp.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_submission(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.submissions
     SET status = 'JUDGING'
   WHERE id = p_submission_id
     AND status = 'PENDING';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_submission(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 6h. RPC: XÓA BÀI TẬP AN TOÀN (CASCADING DELETE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
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

GRANT EXECUTE ON FUNCTION public.delete_problem(UUID) TO authenticated;

-- Đảm bảo các ràng buộc khóa ngoại có ON DELETE CASCADE
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'testcases_problem_id_fkey' AND table_name = 'testcases') THEN
    ALTER TABLE public.testcases DROP CONSTRAINT testcases_problem_id_fkey;
  END IF;
  ALTER TABLE public.testcases ADD CONSTRAINT testcases_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;

  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'submissions_problem_id_fkey' AND table_name = 'submissions') THEN
    ALTER TABLE public.submissions DROP CONSTRAINT submissions_problem_id_fkey;
  END IF;
  ALTER TABLE public.submissions ADD CONSTRAINT submissions_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;

  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contest_problems_problem_id_fkey' AND table_name = 'contest_problems') THEN
    ALTER TABLE public.contest_problems DROP CONSTRAINT contest_problems_problem_id_fkey;
  END IF;
  ALTER TABLE public.contest_problems ADD CONSTRAINT contest_problems_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;
END $$;

-- --------------------------------------------------------
-- REALTIME & TRIGGER AUTOMATION
-- --------------------------------------------------------

-- Automatically create profile on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'user'::public.user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Supabase Realtime Publication for Submissions (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END $$;
-- --------------------------------------------------------
-- SYSTEM SETTINGS (key-value)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settings readable by everyone" ON public.system_settings;
CREATE POLICY "Settings readable by everyone"
  ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Settings writable by admins" ON public.system_settings;
CREATE POLICY "Settings writable by admins"
  ON public.system_settings FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT ON public.system_settings TO anon;
