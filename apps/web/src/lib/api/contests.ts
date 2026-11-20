import { supabase } from '../supabase';
import { withFixedSamples } from './problems';
import type { Contest, ContestInput, ContestProblemRow, ContestRankRow, ContestStatus, Submission } from './types';

export async function getMyContestRegistration(contestId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('contest_registrations').select('status').eq('contest_id', contestId).eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status || null;
}

export async function registerContest(contestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('register_contest', { p_contest_id: contestId });
  if (error) throw new Error(error.message);
  return data;
}

export async function getContestRegistrations(contestId: string) {
  const { data, error } = await supabase.from('contest_registrations')
    .select('user_id,status,profile:profiles_public!contest_registrations_user_id_fkey(full_name)')
    .eq('contest_id', contestId).order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as unknown as { user_id: string; status: string; profile: { full_name: string } | null }[];
}

export async function reviewContestRegistration(contestId: string, userId: string, approved: boolean) {
  const { error } = await supabase.rpc('review_contest_registration', { p_contest_id: contestId, p_user_id: userId, p_approved: approved });
  if (error) throw new Error(error.message);
}

export function getContestStatusFromTime(startIso: string, endIso: string): ContestStatus {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (now < start) return 'NOT_STARTED';
  if (now >= end) return 'ENDED';
  return 'UNDERWAY';
}
export async function getContests(ownerId?: string): Promise<Contest[]> {
  let query = supabase
    .from('contests')
    .select('*')
    .order('start_time', { ascending: true });
  if (ownerId) query = query.eq('created_by', ownerId);
  const { data, error } = await query;
  if (error) throw error;
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
    .select('contest_id, problem_id, sort_order, score, problems(*)')
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
    .select('*, problems(title, slug), profiles:profiles_public(full_name, email)')
    .eq('contest_id', contestId)
    .eq('user_id', user.id)
    .eq('is_run', false)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return (data || []) as Submission[];
}
export async function createContest(input: ContestInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập để tạo kỳ thi' };
  const { data, error } = await supabase.from('contests').insert({ ...input, created_by: user.id }).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}
export async function updateContest(id: string, input: ContestInput): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.from('contests').update(input).eq('id', id).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Không thể sửa kỳ thi: bạn không có quyền hoặc kỳ thi không còn tồn tại.' };
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
    .select('contest_id, problem_id, sort_order, score, practice_visible')
    .eq('contest_id', contestId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as ContestProblemRow[];
}
type ContestProblemSelection = string | { problem_id: string; score?: number; practice_visible?: boolean };

export async function setContestProblems(
  contestId: string,
  selections: ContestProblemSelection[]
): Promise<{ ok: boolean; error?: string }> {
  const permission = await supabase.rpc('can_manage_contest', { p_contest_id: contestId });
  if (permission.error || permission.data !== true) return { ok: false, error: permission.error?.message || 'Bạn không có quyền sửa bài thi của kỳ thi này.' };
  const rows = selections.map((selection, sort_order) => {
    const problem_id = typeof selection === 'string' ? selection : selection.problem_id;
    const score = typeof selection === 'string' ? 100 : selection.score ?? 100;
    const practice_visible = typeof selection === 'string' ? true : selection.practice_visible ?? true;
    return { contest_id: contestId, problem_id, sort_order, score, practice_visible };
  });
  // Write the new selection before removing obsolete rows, so a failed write
  // cannot erase the existing contest. Retrying is safe through the primary key.
  if (rows.length) {
    const { error } = await supabase.from('contest_problems').upsert(rows, { onConflict: 'contest_id,problem_id' });
    if (error) return { ok: false, error: error.message };
  }
  let remove = supabase.from('contest_problems').delete().eq('contest_id', contestId);
  if (rows.length) remove = remove.not('problem_id', 'in', `(${rows.map(row => row.problem_id).join(',')})`);
  const { error } = await remove;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ─────────────── Admin: Announcements ─────────────── */
