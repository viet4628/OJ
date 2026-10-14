import { supabase } from './supabase';

export interface Problem {
  id: string;
  slug: string;
  title: string;
  description: string;
  input_format: string | null;
  output_format: string | null;
  samples: { input: string; output: string }[];
  time_limit_ms: number;
  memory_limit_mb: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  is_public: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  problem_id: string;
  language: string;
  code: string;
  status: string;
  time_used_ms: number;
  memory_used_mb: number;
  score: number;
  error_log: string | null;
  details: unknown[];
  is_run?: boolean;
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
}

export type ContestStatus = Contest['status'];

export interface ContestProblemRow {
  contest_id: string;
  problem_id: string;
  sort_order: number;
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

function normalizeSampleText(text: string): string {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function withFixedSamples(p: Problem): Problem {
  let raw: unknown = p.samples;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) {
    return { ...p, samples: [] };
  }
  return {
    ...p,
    samples: (raw as { input?: unknown; output?: unknown }[]).map((s) => ({
      input: normalizeSampleText(String(s?.input ?? '')),
      output: normalizeSampleText(String(s?.output ?? '')),
    })),
  };
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'teacher' | 'admin';
  created_at: string;
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

export async function getProblems(): Promise<Problem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data || []) as Problem[]).map(withFixedSamples);
}

export async function getProblemBySlug(slug: string): Promise<Problem | null> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data ? withFixedSamples(data as Problem) : null;
}

export async function getProblemsByIds(ids: string[]): Promise<Problem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('problems')
    .select('id, slug, title, difficulty, tags')
    .in('id', ids);
  if (error) throw error;
  return (data || []) as Problem[];
}

export async function searchProblems(keyword: string): Promise<Problem[]> {
  if (!keyword.trim()) return [];
  // PostgREST .or() dùng dấu , ( ) làm cú pháp — thay bằng khoảng trắng để tránh lỗi query
  const safe = keyword.trim().replace(/[%(),*]/g, ' ');
  const { data, error } = await supabase
    .from('problems')
    .select('id, slug, title, difficulty, tags')
    .eq('is_public', true)
    .or(`title.ilike.%${safe}%,slug.ilike.%${safe}%`);
  if (error) throw error;
  return (data || []) as Problem[];
}

export async function getTestcases(problemId: string) {
  const { data, error } = await supabase
    .from('testcases')
    .select('*')
    .eq('problem_id', problemId);
  if (error) return [];
  return data || [];
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as Announcement[];
}

export function getContestStatusFromTime(startIso: string, endIso: string): ContestStatus {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (now < start) return 'NOT_STARTED';
  if (now >= end) return 'ENDED';
  return 'UNDERWAY';
}

export async function getContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .order('start_time', { ascending: true });
  if (error) return [];
  return ((data || []) as Contest[]).map((c) => ({
    ...c,
    status: getContestStatusFromTime(c.start_time, c.end_time),
  }));
}

export async function getContest(id: string): Promise<Contest | null> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const c = data as Contest;
  return { ...c, status: getContestStatusFromTime(c.start_time, c.end_time) };
}

export async function getContestProblems(contestId: string): Promise<ContestProblemRow[]> {
  const { data, error } = await supabase
    .from('contest_problems')
    .select('contest_id, problem_id, sort_order, problems(*)')
    .eq('contest_id', contestId)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return ((data || []) as unknown as ContestProblemRow[]).map((row) => ({ ...row, problems: withFixedSamples(row.problems) }));
}

export async function getContestRank(contestId: string): Promise<ContestRankRow[]> {
  const { data, error } = await supabase.rpc('get_contest_rank', { p_contest_id: contestId });
  if (error) return [];
  return (data || []) as ContestRankRow[];
}

export async function createContestSubmission(input: {
  contest_id: string;
  problem_id: string;
  language: string;
  code: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase.rpc('create_contest_submission', {
    p_contest_id: input.contest_id,
    p_problem_id: input.problem_id,
    p_language: input.language,
    p_code: input.code,
  });
  if (error) return { ok: false, error: error.message };
  const id = (data as { id: string }[] | null)?.[0]?.id;
  return id ? { ok: true, id } : { ok: false, error: 'Không nhận được ID bài nộp' };
}

export async function getMyContestSubmissions(contestId: string): Promise<Submission[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('submissions')
    .select('*, problems(title, slug), profiles(full_name, email)')
    .eq('contest_id', contestId)
    .eq('user_id', user.id)
    .eq('is_run', false)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return (data || []) as Submission[];
}

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function updateProfileRole(userId: string, role: Profile['role']) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function getSubmissions(params?: {
  mine?: boolean;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: Submission[]; total: number }> {
  let query = supabase
    .from('submissions')
    .select('*, problems(title, slug), profiles(full_name, email)', { count: 'exact' })
    .eq('is_run', false)
    .order('created_at', { ascending: false });

  if (params?.mine) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) query = query.eq('user_id', user.id);
  }
  if (params?.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }

  const pageSize = params?.pageSize ?? 25;
  const page = Math.max(0, params?.page ?? 0);
  const from = page * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { rows: [], total: 0 };
  return { rows: (data || []) as Submission[], total: count || 0 };
}

export async function getSubmissionsByUser(userId: string, limit = 15): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, problems(title, slug)')
    .eq('user_id', userId)
    .eq('is_run', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as Submission[];
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

export async function getUserRankStats(userId: string): Promise<RankUser | null> {
  const { data, error } = await supabase
    .from('user_rank')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RankUser;
}

export async function getProblemSubmissions(problemId: string, limit = 20): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, problems(title, slug), profiles(full_name, email)')
    .eq('problem_id', problemId)
    .eq('is_run', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as Submission[];
}

export async function createSubmission(input: { problem_id: string; language: string; code: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập để nộp bài' };

  const { data, error } = await supabase
    .from('submissions')
    .insert({ user_id: user.id, problem_id: input.problem_id, language: input.language, code: input.code })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function getSubmission(submissionId: string): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, problems(title, slug), profiles(full_name, email)')
    .eq('id', submissionId)
    .single();
  if (error) return null;
  return data as Submission;
}

export async function runProblemCode(input: {
  problem_id: string;
  language: string;
  code: string;
  input: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase.rpc('judge_problem_code', {
    p_problem_id: input.problem_id,
    p_language: input.language,
    p_code: input.code,
    p_input: input.input,
  });
  if (error) return { ok: false, error: error.message };
  const id = (data as { id: string }[] | null)?.[0]?.id;
  return id ? { ok: true, id } : { ok: false, error: 'Không nhận được ID bài chạy thử' };
}

export async function getProblemRank(problemId: string): Promise<ProblemRankRow[]> {
  const { data, error } = await supabase.rpc('get_problem_rank', {
    p_problem_id: problemId,
    p_limit: 100,
  });
  if (error) return [];
  return (data || []) as ProblemRankRow[];
}

export async function getMyAcceptedProblemIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('submissions')
    .select('problem_id')
    .eq('user_id', user.id)
    .eq('status', 'ACCEPTED')
    .eq('is_run', false);
  if (error) return [];
  return [...new Set((data || []).map((s) => s.problem_id as string))];
}

/** Các bài ĐÃ nộp (bất kể kết quả, trừ run thử) — dùng cho trạng thái "Attempted". */
export async function getMyAttemptedProblemIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('submissions')
    .select('problem_id')
    .eq('user_id', user.id)
    .eq('is_run', false);
  if (error) return [];
  return [...new Set((data || []).map((s) => s.problem_id as string))];
}

export async function getRanklist(): Promise<RankUser[]> {
  const [{ data: rankData }, { data: staffProfiles }] = await Promise.all([
    supabase.from('user_rank').select('*'),
    supabase.from('profiles').select('id').in('role', ['teacher', 'admin']),
  ]);
  if (!rankData) return [];
  const staffIds = new Set((staffProfiles || []).map((p) => p.id));
  return (rankData as RankUser[]).filter(
    (u) => !staffIds.has(u.user_id) && (!u.role || u.role === 'user')
  );
}

export async function getStats() {
  const [{ count: problems }, { count: submissions }, { count: profiles }] = await Promise.all([
    supabase.from('problems').select('id', { count: 'exact', head: true }).eq('is_public', true),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('is_run', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
  ]);
  return {
    problems: problems || 0,
    submissions: submissions || 0,
    profiles: profiles || 0,
  };
}

export async function getMySubmissionCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'ACCEPTED')
    .eq('is_run', false);
  return count || 0;
}

/* ─────────────── Admin: Users & Permissions ─────────────── */

export const PERMISSION_DEFS: { code: string; label: string; group: string }[] = [
  { code: 'problems.manage', label: 'Quản lý bài tập', group: 'Nội dung' },
  { code: 'testcases.manage', label: 'Quản lý testcases', group: 'Nội dung' },
  { code: 'contests.manage', label: 'Quản lý kỳ thi', group: 'Nội dung' },
  { code: 'announcements.manage', label: 'Quản lý thông báo', group: 'Nội dung' },
  { code: 'submissions.view_all', label: 'Xem mọi bài nộp', group: 'Đánh giá' },
  { code: 'users.manage', label: 'Quản lý user & vai trò', group: 'Hệ thống' },
];

export type UserRole = 'user' | 'teacher' | 'admin';

export type PermissionCode =
  | 'problems.manage'
  | 'testcases.manage'
  | 'contests.manage'
  | 'announcements.manage'
  | 'submissions.view_all'
  | 'users.manage';

export function hasPermission(
  role: string | undefined,
  permissions: string[],
  requiredPerm: PermissionCode | string
): boolean {
  if (role === 'admin') return true;
  return permissions.includes(requiredPerm);
}

export const DEFAULT_TEACHER_PERMS: string[] = [
  'problems.manage',
  'testcases.manage',
  'contests.manage',
  'submissions.view_all',
];

export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_permissions')
    .select('codes')
    .eq('user_id', userId)
    .maybeSingle();
  if (data && Array.isArray((data as any).codes)) {
    return (data as { codes: string[] }).codes;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role === 'teacher') {
    return DEFAULT_TEACHER_PERMS;
  }
  return [];
}

export async function setUserPermissions(userId: string, codes: string[]) {
  const { error } = await supabase
    .from('user_permissions')
    .upsert({ user_id: userId, codes }, { onConflict: 'user_id' });
  if (error) throw error;
}

/* ─────────────── Admin: Problems & Testcases ─────────────── */

export type ProblemInput = Pick<
  Problem,
  'slug' | 'title' | 'description' | 'input_format' | 'output_format' | 'difficulty' | 'time_limit_ms' | 'memory_limit_mb'
> & { tags: string[]; samples: { input: string; output: string }[]; is_public: boolean };

export async function getAllProblems(): Promise<Problem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Problem[];
}

export async function createProblem(input: ProblemInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase
    .from('problems')
    .insert(input)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function updateProblem(id: string, input: ProblemInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('problems')
    .update(input)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteProblem(id: string): Promise<{ ok: boolean; error?: string }> {
  // 1. Thử gọi RPC an toàn delete_problem (tự động xóa testcases/submissions/contest_problems và kiểm tra RBAC)
  const { error: rpcErr } = await supabase.rpc('delete_problem', { p_problem_id: id });
  if (!rpcErr) {
    return { ok: true };
  }

  // 2. Fallback nếu DB chưa áp dụng RPC: xóa trực tiếp bằng REST và kiểm tra số dòng bị ảnh hưởng qua .select('id')
  const { data, error } = await supabase.from('problems').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: rpcErr?.message || 'Không thể xóa trên DB. Kiểm tra quyền hạn RLS hoặc ràng buộc khóa ngoại (submissions/testcases).',
    };
  }
  return { ok: true };
}

export interface TestcaseRow {
  id: string;
  problem_id: string;
  input_content: string | null;
  output_content: string | null;
  score: number;
  is_sample: boolean;
}

export async function addTestcase(input: {
  problem_id: string;
  input_content: string;
  output_content: string;
  score: number;
  is_sample: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('testcases').insert({
    problem_id: input.problem_id,
    input_path: 'inline',
    output_path: 'inline',
    input_content: input.input_content,
    output_content: input.output_content,
    score: input.score,
    is_sample: input.is_sample,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTestcase(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.from('testcases').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Không thể xóa testcase trên DB (kiểm tra quyền hạn RLS).' };
  }
  return { ok: true };
}

/* ─────────────── Admin: Contests ─────────────── */

export type ContestInput = Pick<Contest, 'title' | 'description' | 'rule_type' | 'start_time' | 'end_time' | 'is_public'>;

export async function createContest(input: ContestInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('contests').insert(input);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateContest(id: string, input: ContestInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('contests').update(input).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteContest(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.from('contests').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Không thể xóa kỳ thi trên DB (kiểm tra quyền hạn RLS).' };
  }
  return { ok: true };
}

export async function getContestProblemsAdmin(contestId: string): Promise<ContestProblemRow[]> {
  const { data, error } = await supabase
    .from('contest_problems')
    .select('contest_id, problem_id, sort_order')
    .eq('contest_id', contestId)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data || []) as unknown as ContestProblemRow[];
}

export async function setContestProblems(contestId: string, problemIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const { error: delErr } = await supabase.from('contest_problems').delete().eq('contest_id', contestId);
  if (delErr) return { ok: false, error: delErr.message };
  if (problemIds.length === 0) return { ok: true };
  const rows = problemIds.map((problem_id, sort_order) => ({ contest_id: contestId, problem_id, sort_order }));
  const { error } = await supabase.from('contest_problems').insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ─────────────── Admin: Announcements ─────────────── */

export type AnnouncementInput = Pick<Announcement, 'tag' | 'title' | 'content' | 'author' | 'is_public'>;

export async function createAnnouncement(input: AnnouncementInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('announcements').insert(input);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.from('announcements').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Không thể xóa thông báo trên DB (kiểm tra quyền hạn RLS).' };
  }
  return { ok: true };
}

/* ─────────────── Admin: System Settings ─────────────── */

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('system_settings').select('key, value');
  if (error) return {};
  return Object.fromEntries((data || []).map((r) => [r.key as string, r.value as string]));
}

export async function saveSettings(patch: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const rows = Object.entries(patch).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ─────────────── Account: profile, password, avatar ─────────────── */

export interface AppUser {
  id: string;
  username: string;
  rating: number;
  role?: 'user' | 'teacher' | 'admin';
}

export async function updateMyProfile(patch: { full_name?: string; avatar_url?: string }): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập' };
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function changePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function sendPasswordResetEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function uploadAvatar(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Chỉ chấp nhận file ảnh' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Ảnh tối đa 2MB' };

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const objectPath = `${user.id}/${Date.now()}.${ext || 'png'}`;
  const { error } = await supabase.storage.from('avatars').upload(objectPath, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };
  const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
  return { ok: true, url: data.publicUrl };
}

/* ─────────────── Classrooms (Hệ thống Lớp học) ─────────────── */

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

export async function getClassrooms(teacherOnly = false): Promise<Classroom[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('classrooms')
    .select('*, teacher:profiles!teacher_id(username, full_name, avatar_url)')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (teacherOnly) {
    query = query.eq('teacher_id', user.id);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const classIds = data.map((c) => c.id);
  if (classIds.length === 0) return [];

  const [membersRes, problemsRes] = await Promise.all([
    supabase.from('classroom_members').select('classroom_id').in('classroom_id', classIds),
    supabase.from('classroom_problems').select('classroom_id').in('classroom_id', classIds),
  ]);

  const memberCounts: Record<string, number> = {};
  (membersRes.data || []).forEach((m) => {
    memberCounts[m.classroom_id] = (memberCounts[m.classroom_id] || 0) + 1;
  });

  const problemCounts: Record<string, number> = {};
  (problemsRes.data || []).forEach((p) => {
    problemCounts[p.classroom_id] = (problemCounts[p.classroom_id] || 0) + 1;
  });

  return (data as any[]).map((c) => ({
    ...c,
    student_count: memberCounts[c.id] || 0,
    problem_count: problemCounts[c.id] || 0,
  }));
}

export async function getClassroomDetail(classId: string): Promise<{
  classroom: Classroom | null;
  members: ClassroomMember[];
  problems: ClassroomProblem[];
  error?: string;
}> {
  try {
    const [classRes, membersRes, problemsRes] = await Promise.all([
      supabase
        .from('classrooms')
        .select('*, teacher:profiles!teacher_id(username, full_name, avatar_url)')
        .eq('id', classId)
        .single(),
      supabase
        .from('classroom_members')
        .select('*, profile:profiles!user_id(id, username, full_name, avatar_url)')
        .eq('classroom_id', classId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('classroom_problems')
        .select('*, problem:problems!problem_id(*)')
        .eq('classroom_id', classId)
        .order('sort_order', { ascending: true }),
    ]);

    if (classRes.error) return { classroom: null, members: [], problems: [], error: classRes.error.message };

    return {
      classroom: classRes.data as Classroom,
      members: (membersRes.data || []) as unknown as ClassroomMember[],
      problems: (problemsRes.data || []) as unknown as ClassroomProblem[],
    };
  } catch (err: any) {
    return { classroom: null, members: [], problems: [], error: err.message || 'Lỗi tải dữ liệu lớp học' };
  }
}

export function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createClassroom(input: {
  name: string;
  description?: string;
  code?: string;
}): Promise<{ ok: boolean; classroom?: Classroom; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập' };

  const code = (input.code && input.code.trim().length >= 4) ? input.code.trim().toUpperCase() : generateClassCode();

  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      code,
      teacher_id: user.id,
    })
    .select('*, teacher:profiles!teacher_id(username, full_name, avatar_url)')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, classroom: data as Classroom };
}

export async function updateClassroom(
  id: string,
  input: Partial<Pick<Classroom, 'name' | 'description' | 'is_archived'>>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('classrooms').update(input).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteClassroom(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error: rpcErr } = await supabase.rpc('delete_classroom', { p_classroom_id: id });
  if (!rpcErr) return { ok: true };

  const { data, error } = await supabase.from('classrooms').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: rpcErr?.message || 'Không thể xóa lớp học.' };
  return { ok: true };
}

export async function joinClassroomByCode(code: string): Promise<{ ok: boolean; classroom?: Classroom; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { ok: false, error: 'Vui lòng nhập mã lớp' };

  const { data, error } = await supabase.rpc('join_classroom', { p_code: cleanCode });
  if (error) return { ok: false, error: error.message };
  return { ok: true, classroom: data as Classroom };
}

export async function addClassroomProblem(
  classId: string,
  problemId: string,
  deadline?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('classroom_problems').insert({
    classroom_id: classId,
    problem_id: problemId,
    deadline: deadline || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeClassroomProblem(classId: string, problemId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('classroom_problems')
    .delete()
    .eq('classroom_id', classId)
    .eq('problem_id', problemId)
    .select('problem_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Không thể xóa bài tập khỏi lớp' };
  return { ok: true };
}

export async function removeClassroomMember(classId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('classroom_members')
    .delete()
    .eq('classroom_id', classId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Không thể xóa học sinh khỏi lớp' };
  return { ok: true };
}

export async function getClassroomProgress(classId: string, problemIds: string[], userIds: string[]): Promise<ClassroomProgressItem[]> {
  if (problemIds.length === 0 || userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('submissions')
    .select('user_id, problem_id, status, score, time_used_ms, created_at')
    .in('problem_id', problemIds)
    .in('user_id', userIds)
    .eq('is_run', false)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const map: Record<string, ClassroomProgressItem> = {};
  for (const s of data) {
    const key = `${s.user_id}_${s.problem_id}`;
    const existing = map[key];
    if (!existing) {
      map[key] = {
        userId: s.user_id,
        problemId: s.problem_id,
        status: s.status,
        score: s.score,
        time_used_ms: s.time_used_ms,
        submitted_at: s.created_at,
      };
    } else if (existing.status !== 'ACCEPTED' && s.status === 'ACCEPTED') {
      map[key] = {
        userId: s.user_id,
        problemId: s.problem_id,
        status: s.status,
        score: s.score,
        time_used_ms: s.time_used_ms,
        submitted_at: s.created_at,
      };
    } else if (s.score > existing.score) {
      map[key] = {
        userId: s.user_id,
        problemId: s.problem_id,
        status: s.status,
        score: s.score,
        time_used_ms: s.time_used_ms,
        submitted_at: s.created_at,
      };
    }
  }

  return Object.values(map);
}

export { supabase };