import { supabase } from '../supabase';
import type { Problem, ProblemInput, ProblemRankRow, Submission } from './types';
import { getSubmission } from './submissions';

export async function getProblemValidation(problemId: string): Promise<Submission | null> {
  const { data, error } = await supabase.from('problem_validations').select('submission_id').eq('problem_id', problemId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.submission_id ? getSubmission(data.submission_id) : null;
}

export async function validateProblemSolution(problemId: string, language: string, code: string): Promise<string> {
  const { data, error } = await supabase.rpc('validate_problem_solution', { p_problem_id: problemId, p_language: language, p_code: code });
  if (error) throw new Error(error.message);
  return data;
}

export async function getProblemEditorial(problemId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_problem_editorial', { p_problem_id: problemId });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveProblemBundle(problemId: string | null, problem: ProblemInput,
  testcases: { id?: string; input_content: string | null; output_content: string | null; score: number; is_sample: boolean }[], editorial: string) {
  const { data, error } = await supabase.rpc('save_problem_bundle', {
    p_problem_id: problemId, p_problem: problem, p_testcases: testcases, p_editorial: editorial,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

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
export type ProblemSummary = Pick<Problem, 'id' | 'slug' | 'title' | 'difficulty' | 'tags' | 'time_limit_ms' | 'memory_limit_mb' | 'created_at'>;

export async function getProblems(): Promise<ProblemSummary[]> {
  const rows: ProblemSummary[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('problems')
      .select('id,slug,title,difficulty,tags,time_limit_ms,memory_limit_mb,created_at')
      .eq('is_public', true).order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []) as ProblemSummary[]);
    if (!data || data.length < 500) return rows;
  }
}

export type ProblemPageRow = Pick<Problem, 'id' | 'slug' | 'title' | 'difficulty' | 'tags' | 'time_limit_ms' | 'memory_limit_mb'> & {
  progress: 'SOLVED' | 'ATTEMPTED' | 'TODO';
};

export async function getProblemPage(params: {
  page: number; pageSize?: number; keyword: string; difficulty: string; tag: string; status: string; sort: string; desc: boolean;
}, signal?: AbortSignal): Promise<{ rows: ProblemPageRow[]; total: number; counts: Record<string, number>; tags: string[] }> {
  const { data, error } = await supabase.rpc('get_problem_page', {
    p_page: params.page, p_page_size: params.pageSize ?? 20, p_keyword: params.keyword,
    p_difficulty: params.difficulty, p_tag: params.tag, p_status: params.status, p_sort: params.sort, p_desc: params.desc,
  }).abortSignal(signal ?? AbortSignal.timeout(10000));
  if (error) throw new Error(error.message);
  return data;
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
    .select('*, problems(title, slug), profiles:profiles_public(full_name, email)')
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


/* ─────────────── Admin: Contests ─────────────── */
