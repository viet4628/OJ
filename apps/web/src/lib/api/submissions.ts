import { supabase } from '../supabase';
import type { Submission } from './types';

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
export async function getSubmissionsByUser(userId: string, limit = 50): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, problems(title, slug, difficulty, tags)')
    .eq('user_id', userId)
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
  if (error) {
    console.error('[getSubmission] Error fetching submission:', error);
    return null;
  }
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
