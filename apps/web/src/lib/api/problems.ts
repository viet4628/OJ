import { supabase } from '../supabase';
import type { Problem, ProblemInput, ProblemRankRow, Submission } from './types';

function normalizeSampleText(text: string): string {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}
export function withFixedSamples(p: Problem): Problem {
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

export async function addTestcasesBatch(
  cases: {
    problem_id: string;
    input_content: string;
    output_content: string;
    score: number;
    is_sample: boolean;
  }[]
): Promise<{ ok: boolean; error?: string; count?: number }> {
  if (cases.length === 0) return { ok: true, count: 0 };
  const rows = cases.map((c) => ({
    problem_id: c.problem_id,
    input_path: 'inline',
    output_path: 'inline',
    input_content: c.input_content,
    output_content: c.output_content,
    score: c.score,
    is_sample: c.is_sample,
  }));
  const { error } = await supabase.from('testcases').insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: cases.length };
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
