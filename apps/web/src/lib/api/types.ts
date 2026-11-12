export interface Problem {
  id: string;
  slug: string;
  title: string;
  description: string;
  starter_codes?: Partial<Record<'cpp' | 'python' | 'rust', string>>;
  input_format: string | null;
  output_format: string | null;
  samples: { input: string; output: string }[];
  time_limit_ms: number;
  memory_limit_mb: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  is_public: boolean;
  created_by?: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  problem_id: string;
  contest_id?: string | null;
  language: string;
  code: string;
  status: string;
  time_used_ms: number;
  memory_used_mb: number;
  score: number;
  error_log: string | null;
  details: unknown[];
  is_run?: boolean;
  is_validation?: boolean;
  created_at: string;
  problems?: Pick<Problem, 'title' | 'slug'> | null;
  profiles?: { full_name: string | null; email: string } | null;
}

export interface ProblemRankRow {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  language: string;
  time_ms: number;
  memory_mb: number;
  accepted_at: string;
}

export interface Contest {
  id: string;
  title: string;
  description: string;
  rule_type: 'ACM' | 'OI';
  status: 'UNDERWAY' | 'NOT_STARTED' | 'ENDED';
  start_time: string;
  end_time: string;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  registration_required?: boolean;
  freeze_at?: string | null;
}

export type ContestStatus = Contest['status'];

export interface ContestProblemRow {
  contest_id: string;
  problem_id: string;
  sort_order: number;
  score?: number;
  problems: Problem;
}

export interface ContestRankRow {
  user_id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  submission_number: number;
  accepted_number: number;
  total_time_seconds: number;
  total_score: number;
  problem_info: Record<
    string,
    {
      is_ac?: boolean;
      time_seconds?: number;
      error_count?: number;
      submission_count?: number;
      score?: number;
    }
  >;
}

export interface Announcement {
  id: string;
  tag: string;
  title: string;
  content: string;
  author: string;
  is_public: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'teacher' | 'admin';
  created_at: string;
  is_suspended?: boolean;
}

export interface RankUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  accepted_number: number;
  submission_number: number;
  total_score: number;
  role?: string;
}

export type UserRole = 'user' | 'teacher' | 'admin';

export type PermissionCode =
  | 'problems.manage'
  | 'testcases.manage'
  | 'contests.manage'
  | 'announcements.manage'
  | 'submissions.view_all'
  | 'users.manage';

export type ProblemInput = Pick<
  Problem,
  'slug' | 'title' | 'description' | 'input_format' | 'output_format' | 'difficulty' | 'time_limit_ms' | 'memory_limit_mb'
> & { tags: string[]; samples: { input: string; output: string }[]; is_public: boolean; starter_codes?: Problem['starter_codes'] };

export interface TestcaseRow {
  id: string;
  problem_id: string;
  input_content: string | null;
  output_content: string | null;
  score: number;
  is_sample: boolean;
}

export type ContestInput = Pick<Contest, 'title' | 'description' | 'rule_type' | 'start_time' | 'end_time' | 'is_public' | 'registration_required' | 'freeze_at'>;

export type AnnouncementInput = Pick<Announcement, 'tag' | 'title' | 'content' | 'author' | 'is_public'>;

export interface AppUser {
  id: string;
  username: string;
  rating: number;
  role?: 'user' | 'teacher' | 'admin';
}

export interface Classroom {
  id: string;
  name: string;
  description: string | null;
  code: string;
  teacher_id: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  teacher?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  student_count?: number;
  problem_count?: number;
}

export interface ClassroomMember {
  classroom_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ClassroomProblem {
  classroom_id: string;
  problem_id: string;
  deadline: string | null;
  sort_order: number;
  created_at: string;
  problem?: Problem;
}

export interface ClassroomProgressItem {
  userId: string;
  problemId: string;
  status: string;
  score: number;
  time_used_ms: number;
  submitted_at: string;
}

