import { supabase } from '../supabase';
import type { Submission } from './types';

export async function rejudgeSubmission(submissionId: string): Promise<void> {
  const { error } = await supabase.rpc('rejudge_submission', { p_submission_id: submissionId });
  if (error) throw new Error(error.message);
}

export async function getSubmissions(params?: {
  mine?: boolean;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: Submission[]; total: number }> {
  let query = supabase
    .from('submissions')
    .select('*, problems(title, slug), profiles:profiles_public(full_name, email)', { count: 'exact' })
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
export async function createSubmission(input: { problem_id: string; language: string; code: string; classroom_id?: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập để nộp bài' };

  const { data, error } = await supabase
    .from('submissions')
    .insert({ user_id: user.id, problem_id: input.problem_id, language: input.language, code: input.code, classroom_id: input.classroom_id })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}
export async function getSubmission(submissionId: string, signal?: AbortSignal): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, problems(title, slug), profiles:profiles_public(full_name, email)')
    .eq('id', submissionId)
    .abortSignal(signal ?? AbortSignal.timeout(10000))
    .single();
  if (error) {
    console.error('[getSubmission] Error fetching submission:', error);
    return null;
  }
  return data as Submission;
}

/** 1-based position of the caller's own PENDING submission, or null once it is being judged. */
export async function getQueuePosition(submissionId: string, signal?: AbortSignal): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_queue_position', { p_submission_id: submissionId })
    .abortSignal(signal ?? AbortSignal.timeout(10000));
  return !error && typeof data === 'number' ? data : null;
}

export function waitForSubmission(
  submissionId: string,
  signal: AbortSignal,
  onProgress?: (row: Submission, queuePosition: number | null) => void,
): Promise<Submission | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout>;
    let checking = false;
    let finished = false;
    let attempts = 0;
    const started = performance.now();
    const request = new AbortController();
    const finish = (row: Submission | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      request.abort();
      void supabase.removeChannel(channel);
      resolve(row);
    };
    const cancel = () => finish(null);
    const poll = async () => {
      if (checking || finished) return;
      clearTimeout(timer);
      checking = true;
      try {
        const row = await getSubmission(submissionId, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
        if (finished) return;
        if (row && !['PENDING', 'JUDGING'].includes(row.status)) return finish(row);
        if (row && onProgress) {
          const position = row.status === 'PENDING' ? await getQueuePosition(submissionId, request.signal) : null;
          if (!finished) onProgress(row, position);
        }
        if (performance.now() - started >= 15 * 60_000) return finish(null);
      } finally {
        checking = false;
        if (!finished) timer = setTimeout(() => void poll(), Math.min(5000, 400 * 2 ** Math.min(attempts++, 4)));
      }
    };
    const channel = supabase.channel(`submission-${submissionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `id=eq.${submissionId}` }, () => void poll())
      .subscribe();
    signal.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => void poll(), 200);
  });
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
