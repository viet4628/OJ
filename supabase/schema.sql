BEGIN;

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

-- BCNF/Integrity: email must be unique
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;
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

-- Public editor scaffolds, separate from private reference solutions/editorials.
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS starter_codes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.problems DROP CONSTRAINT IF EXISTS problems_starter_codes_valid;
ALTER TABLE public.problems ADD CONSTRAINT problems_starter_codes_valid CHECK (
  jsonb_typeof(starter_codes) = 'object'
  AND starter_codes - ARRAY['cpp','python','rust'] = '{}'::jsonb
  AND NOT jsonb_path_exists(starter_codes, '$.* ? (@.type() != "string")')
  AND octet_length(starter_codes::text) <= 200000
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
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS judging_started_at TIMESTAMPTZ;
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
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Idempotent upgrade for existing installs
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
-- 8. USER RANK VIEW (Aggregates submissions for leaderboard, EXCLUDES runs and staff/admin)
DROP VIEW IF EXISTS public.user_rank;
CREATE OR REPLACE VIEW public.user_rank AS
WITH per_problem AS (
  SELECT user_id, problem_id, count(*) AS attempts,
    bool_or(status = 'ACCEPTED') AS solved, max(score) AS best_score
  FROM public.submissions WHERE NOT is_run
  GROUP BY user_id, problem_id
)
SELECT p.id AS user_id, COALESCE(NULLIF(p.full_name, p.email), 'user-' || left(p.id::text, 8)) AS username, p.avatar_url,
  count(s.problem_id) FILTER (WHERE s.solved) AS accepted_number,
  coalesce(sum(s.attempts), 0)::bigint AS submission_number,
  coalesce(sum(s.best_score), 0)::bigint AS total_score, p.role
FROM public.profiles p LEFT JOIN per_problem s ON s.user_id = p.id
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
        AND ((c.is_public = true AND now() >= c.start_time) OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin') OR public.has_user_permission('contests.manage'))
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

-- BCNF/Integrity: submission's problem must belong to the referenced contest/classroom
CREATE OR REPLACE FUNCTION public.check_submission_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contest_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contest_problems
      WHERE contest_id = NEW.contest_id AND problem_id = NEW.problem_id
    ) THEN
      RAISE EXCEPTION 'Bài tập không thuộc kỳ thi đã chỉ định';
    END IF;
  END IF;
  IF NEW.classroom_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.classroom_problems
      WHERE classroom_id = NEW.classroom_id AND problem_id = NEW.problem_id
    ) THEN
      RAISE EXCEPTION 'Bài tập không thuộc lớp học đã chỉ định';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_consistency ON public.submissions;
CREATE TRIGGER trg_submission_consistency
  BEFORE INSERT OR UPDATE OF problem_id, contest_id, classroom_id ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.check_submission_consistency();
-- Enable RLS
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_problems ENABLE ROW LEVEL SECURITY;

-- Read membership without recursively evaluating classroom_members RLS.
CREATE OR REPLACE FUNCTION public.is_classroom_member(p_classroom_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classroom_members
    WHERE classroom_id = p_classroom_id AND user_id = auth.uid());
$$;

-- 1. Classrooms Policies
DROP POLICY IF EXISTS "Classrooms viewable by members, teacher, or admin" ON public.classrooms;
CREATE POLICY "Classrooms viewable by members, teacher, or admin"
  ON public.classrooms FOR SELECT USING (
    teacher_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR public.is_classroom_member(id)
  );

DROP POLICY IF EXISTS "Teachers and admins can insert classrooms" ON public.classrooms;
CREATE POLICY "Teachers and admins can insert classrooms"
  ON public.classrooms FOR INSERT WITH CHECK (
    teacher_id = auth.uid() AND (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    OR public.has_user_permission('problems.manage'))
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
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
    OR public.is_classroom_member(classroom_id)
  );

DROP POLICY IF EXISTS "Teachers and admins can manage classroom members" ON public.classroom_members;
CREATE POLICY "Teachers and admins can manage classroom members"
  ON public.classroom_members FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can leave own classroom" ON public.classroom_members;
CREATE POLICY "Students can leave own classroom"
  ON public.classroom_members FOR DELETE USING (user_id = auth.uid());

-- 3. Classroom Problems Policies
DROP POLICY IF EXISTS "Classroom problems viewable by members, teacher, or admin" ON public.classroom_problems;
CREATE POLICY "Classroom problems viewable by members, teacher, or admin"
  ON public.classroom_problems FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_problems.classroom_id AND c.teacher_id = auth.uid()
    )
    OR public.is_classroom_member(classroom_id)
  );

DROP POLICY IF EXISTS "Teachers and admins can manage classroom problems" ON public.classroom_problems;
CREATE POLICY "Teachers and admins can manage classroom problems"
  ON public.classroom_problems FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.classrooms c 
      WHERE c.id = classroom_problems.classroom_id AND c.teacher_id = auth.uid()
    )
  );

-- A private problem is available only to staff or an active contest/classroom audience.
CREATE OR REPLACE FUNCTION public.can_read_problem(p_problem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.problems p WHERE p.id = p_problem_id AND (
    p.is_public OR public.has_user_permission('problems.manage')
    OR EXISTS (SELECT 1 FROM public.contest_problems cp JOIN public.contests c ON c.id = cp.contest_id
      WHERE cp.problem_id = p.id AND c.is_public AND now() >= c.start_time)
    OR EXISTS (SELECT 1 FROM public.classroom_problems cp JOIN public.classrooms c ON c.id = cp.classroom_id
      WHERE cp.problem_id = p.id AND NOT c.is_archived
        AND (c.teacher_id = auth.uid() OR public.is_classroom_member(c.id)))
  ));
$$;

DROP POLICY IF EXISTS "Public problems are viewable by everyone" ON public.problems;
CREATE POLICY "Public problems are viewable by everyone"
  ON public.problems FOR SELECT USING (public.can_read_problem(id));

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

  IF NOT EXISTS (SELECT 1 FROM public.contests WHERE id = p_contest_id AND
      (is_public OR public.has_user_permission('contests.manage'))) THEN
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
    WHERE s.contest_id = p_contest_id AND NOT COALESCE(s.is_run, false)
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
  ON CONFLICT (id) DO UPDATE SET public = false;
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

  SELECT public.can_read_problem(p_problem_id) INTO v_allowed;

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
      AND public.can_read_problem(p_problem_id)
      AND NOT COALESCE(s.is_run, false)
    ORDER BY s.user_id, s.created_at, s.time_used_ms, s.id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY fa.created_at, fa.time_used_ms, fa.id)::bigint AS rank,
    fa.user_id,
    COALESCE(NULLIF(pu.full_name, pu.email), 'user-' || left(pu.id::text, 8)) AS username,
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

REVOKE ALL ON FUNCTION public.claim_submission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission(uuid) TO service_role;

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
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
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

-- --------------------------------------------------------
-- PILOT HARDENING: enforce trust boundaries at the database
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Không thể thay đổi định danh tài khoản';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.has_user_permission('users.manage') THEN
      RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_profile_update ON public.profiles;
CREATE TRIGGER guard_profile_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- This trigger also covers SECURITY DEFINER RPCs and direct REST inserts.
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
  IF NEW.is_run THEN
    IF jsonb_typeof(NEW.details) IS DISTINCT FROM 'object'
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
       OR (NOT v_contest.is_public AND NOT public.has_user_permission('contests.manage')) THEN
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
DROP TRIGGER IF EXISTS guard_submission_insert ON public.submissions;
CREATE TRIGGER guard_submission_insert BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_insert();
CREATE INDEX IF NOT EXISTS idx_submissions_pending ON public.submissions(created_at) WHERE status = 'PENDING';

-- PostgreSQL grants function EXECUTE to PUBLIC by default.
REVOKE ALL ON FUNCTION public.claim_submission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission(uuid) TO service_role;

-- Only service_role publishes liveness; the admin console reads actual heartbeats.
CREATE TABLE IF NOT EXISTS public.judge_servers (
  id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode TEXT NOT NULL CHECK (mode IN ('local', 'engine')),
  ready BOOLEAN NOT NULL,
  queued INT NOT NULL DEFAULT 0,
  processing INT NOT NULL DEFAULT 0
);
ALTER TABLE public.judge_servers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view judge heartbeat" ON public.judge_servers;
CREATE POLICY "Admins can view judge heartbeat" ON public.judge_servers
  FOR SELECT TO authenticated USING (public.has_user_permission('users.manage'));
REVOKE ALL ON public.judge_servers FROM anon, authenticated;
GRANT SELECT ON public.judge_servers TO authenticated;
GRANT ALL ON public.judge_servers TO service_role;

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS judging_started_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION public.claim_submission(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated INT;
BEGIN
  UPDATE public.submissions SET status = 'JUDGING', judging_started_at = now()
  WHERE id = p_submission_id AND status = 'PENDING';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_submission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission(uuid) TO service_role;

-- Public display fields are separate from account email. The view deliberately
-- runs as its owner and exposes only these explicit, masked columns.
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id,
  CASE WHEN id = auth.uid() OR public.has_user_permission('users.manage') THEN email ELSE '' END AS email,
  COALESCE(NULLIF(full_name, email), 'user-' || left(id::text, 8)) AS full_name,
  avatar_url, role, created_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.has_user_permission('users.manage'));
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

-- PLATFORM COMPLETION MIGRATION
-- Idempotent platform completion migration. Run after the base schema.

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

-- Contest management ownership (must follow the base RBAC and RPC definitions).

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

-- Problem/testcase content is written only through save_problem_bundle, which
-- validates limits and refuses edits while submissions are judging. Direct
-- REST writes stay open for problem deletion (guarded) and service_role only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.problems'::regclass AND conname='problems_resource_limits_valid') THEN
    ALTER TABLE public.problems ADD CONSTRAINT problems_resource_limits_valid
      CHECK (time_limit_ms BETWEEN 10 AND 30000 AND memory_limit_mb BETWEEN 16 AND 1024) NOT VALID;
  END IF;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.testcases FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.problems FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
