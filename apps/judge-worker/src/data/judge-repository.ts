import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Problem, Submission, Testcase, TestcaseResult } from '../types.js';
import type { JudgingResult } from '../judging/judge-backend.js';
import { isDeepStrictEqual } from 'node:util';

/** Problem row + its testcases, fetched in one round trip. */
export interface ProblemBundle {
  problem: Problem;
  testcases: Testcase[];
}

type ResolvedContent = { inputContent: string; outputContent: string; contentError?: string };

/** Cache bounds: keep the worker light, test data is small. */
const MAX_CACHED_BUNDLES = 64;
const MAX_CACHED_CONTENT_BYTES = 64 * 1024 * 1024;

export class JudgeRepository {
  private readonly bundles = new Map<string, { bundle: ProblemBundle; fetchedAt: number }>();
  private readonly contents = new Map<string, { problemId: string; content: ResolvedContent; fetchedAt: number; bytes: number }>();
  private cachedContentBytes = 0;

  constructor(private readonly db: SupabaseClient, private readonly requestTimeoutMs = 15000,
              private readonly cacheTtlMs = 60000) {}

  async claim(submissionId: string): Promise<boolean> {
    const { data, error } = await this.db.rpc('claim_submission', { p_submission_id: submissionId })
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs));
    if (error) throw new Error(`Claim failed: ${error.message}`);
    return data === true;
  }

  /** Cached problem + testcases: one round trip, reused until invalidated. */
  async getProblemBundle(problemId: string): Promise<ProblemBundle> {
    const cached = this.bundles.get(problemId);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) return cached.bundle;
    const bundle = await this.fetchProblemBundle(problemId);
    this.bundles.delete(problemId);
    this.bundles.set(problemId, { bundle, fetchedAt: Date.now() });
    while (this.bundles.size > MAX_CACHED_BUNDLES) {
      const oldest = this.bundles.keys().next().value as string | undefined;
      if (!oldest) break;
      this.bundles.delete(oldest);
    }
    return bundle;
  }

  /** Drop the cached rows and contents of one problem (teacher edited it). */
  invalidateProblem(problemId: string): void {
    this.bundles.delete(problemId);
    for (const [id, entry] of this.contents) {
      if (entry.problemId !== problemId) continue;
      this.cachedContentBytes -= entry.bytes;
      this.contents.delete(id);
    }
  }

  private async fetchProblemBundle(problemId: string): Promise<ProblemBundle> {
    const { data, error } = await this.read(() => this.db.from('problems')
      .select('*,testcases(*)').eq('id', problemId)
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs)).single());
    const row = data as (Problem & { testcases?: Testcase[] }) | null;
    if (!error && row) {
      const testcases = [...(row.testcases ?? [])]
        .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id.localeCompare(b.id));
      if (!testcases.length) throw new Error('No testcases available for this problem');
      return { problem: row, testcases };
    }
    if (!isEmbedUnsupported(error)) throw new Error(error?.message || 'Problem not found in database');
    // This PostgREST cannot embed testcases: fall back to two plain reads.
    const [problem, testcases] = await Promise.all([this.getProblem(problemId), this.getTestcases(problemId)]);
    return { problem, testcases };
  }

  async getProblem(id: string): Promise<Problem> {
    const cached = this.bundles.get(id);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) return cached.bundle.problem;
    const { data, error } = await this.read(() => this.db.from('problems').select('*').eq('id', id)
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs)).single());
    if (error || !data) throw new Error(error?.message || 'Problem not found in database');
    return data as Problem;
  }

  async getTestcases(problemId: string): Promise<Testcase[]> {
    const cached = this.bundles.get(problemId);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) return cached.bundle.testcases;
    const { data, error } = await this.read(() => this.db.from('testcases').select('*').eq('problem_id', problemId)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs)));
    if (error || !data?.length) throw new Error(error?.message || 'No testcases available for this problem');
    return data as Testcase[];
  }

  async resolveTestcaseContent(tc: Testcase) {
    const cached = this.contents.get(tc.id);
    if (cached && cached.problemId === tc.problem_id && Date.now() - cached.fetchedAt < this.cacheTtlMs) return cached.content;
    let inputContent = tc.input_content ?? '';
    let outputContent = tc.output_content ?? '';
    try {
      if (tc.input_content == null) {
        const { data, error } = await this.read(() => withDownloadSlot(() =>
          this.db.storage.from('testcases').download(tc.input_path, {}, { signal: AbortSignal.timeout(30000) })));
        if (error || !data) throw new Error(error?.message || 'Missing testcase input');
        inputContent = await data.text();
      }
      if (tc.output_content == null) {
        const { data, error } = await this.read(() => withDownloadSlot(() =>
          this.db.storage.from('testcases').download(tc.output_path, {}, { signal: AbortSignal.timeout(30000) })));
        if (error || !data) throw new Error(error?.message || 'Missing testcase answer');
        outputContent = await data.text();
      }
    } catch (err) {
      return { inputContent: '', outputContent: '', contentError: `Cannot load testcase: ${err}` };
    }
    const content: ResolvedContent = { inputContent: normalizeNewlines(inputContent), outputContent: normalizeNewlines(outputContent) };
    const previous = this.contents.get(tc.id);
    if (previous) this.cachedContentBytes -= previous.bytes;
    this.contents.delete(tc.id);
    this.contents.set(tc.id, { problemId: tc.problem_id, content, fetchedAt: Date.now(),
      bytes: content.inputContent.length + content.outputContent.length });
    this.cachedContentBytes += content.inputContent.length + content.outputContent.length;
    while (this.cachedContentBytes > MAX_CACHED_CONTENT_BYTES && this.contents.size > 1) {
      const oldest = this.contents.keys().next().value as string | undefined;
      if (!oldest) break;
      const entry = this.contents.get(oldest);
      this.contents.delete(oldest);
      this.cachedContentBytes -= entry?.bytes ?? 0;
    }
    return content;
  }

  /**
   * Run a read and retry once when the transport fails. Reads are idempotent,
   * so a transient network fault must not fail the whole submission.
   */
  private async read<T>(query: () => PromiseLike<T>): Promise<T> {
    try {
      return await query();
    } catch (err) {
      if (!isTransient(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return query();
    }
  }

  async saveResult(submissionId: string, result: JudgingResult): Promise<void> {
    const payload = {
      status: result.status, time_used_ms: result.timeMs, memory_used_mb: result.memoryMb,
      score: result.score, error_log: result.errorLog, details: result.details.map(publicCaseDetail),
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error, status } = await this.db.from('submissions').update(payload)
        .eq('id', submissionId).eq('status', 'JUDGING').select('id')
        .abortSignal(AbortSignal.timeout(this.requestTimeoutMs));
      if (!error && data?.length === 1) return;
      if (error && status >= 400 && status < 500 && status !== 408) {
        throw new Error(`Failed to persist result for ${submissionId}: ${error.message}`);
      }
      // A timed-out write may have committed. Read back before any conditional retry.
      const stored = await this.db.from('submissions').select('status,time_used_ms,memory_used_mb,score,error_log,details')
        .eq('id', submissionId).abortSignal(AbortSignal.timeout(this.requestTimeoutMs)).single();
      if (!stored.error && isDeepStrictEqual(stored.data, JSON.parse(JSON.stringify(payload)))) return;
      if (stored.error || stored.data?.status !== 'JUDGING' || attempt === 1) {
        throw new Error(`Failed to persist result for ${submissionId}: ${error?.message || stored.error?.message || 'state changed or result not confirmed'}`);
      }
    }
  }

  async getPending(): Promise<Submission[]> {
    const { data, error } = await this.db.from('submissions').select('*').eq('status', 'PENDING')
      .order('created_at', { ascending: true }).limit(10).abortSignal(AbortSignal.timeout(this.requestTimeoutMs));
    if (error) throw new Error(error.message);
    return (data || []) as Submission[];
  }

  async recoverStale(activeIds: ReadonlySet<string>): Promise<void> {
    const cutoff = new Date(Date.now() - 11 * 60_000).toISOString();
    let query = this.db.from('submissions').update({ status: 'SYSTEM_ERROR', error_log: 'Worker interrupted; please resubmit' })
      .eq('status', 'JUDGING')
      .or(`judging_started_at.lt.${cutoff},and(judging_started_at.is.null,created_at.lt.${cutoff})`);
    // Never recover the active job of this daemon, including a long local job.
    for (const id of activeIds) query = query.neq('id', id);
    const { error } = await query.abortSignal(AbortSignal.timeout(this.requestTimeoutMs));
    if (error) throw new Error(`Cannot recover stale submissions: ${error.message}`);
  }

  async heartbeat(id: string, mode: 'local' | 'engine', ready: boolean, queued: number, processing: number): Promise<void> {
    const { error } = await this.db.from('judge_servers').upsert({
      id, last_seen_at: new Date().toISOString(), mode, ready, queued, processing,
    }).abortSignal(AbortSignal.timeout(this.requestTimeoutMs));
    if (error) throw new Error(`Heartbeat failed: ${error.message}`);
  }

  subscribe(onSubmission: (submission: Submission) => void, onStatus: (status: string) => void): RealtimeChannel {
    return this.db.channel('judge-worker-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' },
        (payload) => onSubmission(payload.new as Submission))
      // Editing a problem also rewrites its testcases, so one signal covers both.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'problems' },
        (payload) => {
          const id = (payload.new as { id?: string })?.id ?? (payload.old as { id?: string })?.id;
          if (id) this.invalidateProblem(id);
        })
      .subscribe(onStatus);
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await this.db.removeChannel(channel);
  }
}

// Literal "\n" text is data (e.g. string problems), never a line break.
function normalizeNewlines(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

/** Transport faults worth one retry; data errors are final. */
function isTransient(err: unknown): boolean {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return /timeout|timed out|abort|fetch failed|econnreset|etimedout|enotfound|network|socket/i.test(message);
}

/** PostgREST cannot embed testcases (missing relationship/column): use plain reads instead. */
function isEmbedUnsupported(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (['PGRST200', 'PGRST203', '42P01', '42703', '42883'].includes(error.code ?? '')) return true;
  return /relationship|does not exist|no such column/i.test(error.message ?? '');
}

/**
 * Chi tiết lưu xuống DB chỉ mang verdict, không kèm thời gian/bộ nhớ từng testcase.
 * Thời gian mỗi test là kênh rò rỉ: học sinh dò theo thời gian để suy ra nội dung
 * test ẩn. Số liệu chi tiết vẫn còn trong log của worker để giáo viên/debug dùng.
 */
function publicCaseDetail(detail: TestcaseResult) {
  return {
    testcase_id: detail.testcase_id,
    status: detail.status,
    ...(detail.error ? { error: detail.error } : {}),
    ...(detail.output ? { output: detail.output } : {}),
  };
}

/**
 * Global cap on concurrent Storage reads. Parallel jobs must not overwhelm
 * the bucket, otherwise slow downloads time out and fail the submission.
 */
const MAX_CONCURRENT_DOWNLOADS = 8;
let activeDownloads = 0;
const downloadWaiters: (() => void)[] = [];

async function withDownloadSlot<T>(download: () => PromiseLike<T>): Promise<T> {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    await new Promise<void>((resolve) => downloadWaiters.push(resolve));
  }
  activeDownloads++;
  try {
    return await download();
  } finally {
    activeDownloads--;
    downloadWaiters.shift()?.();
  }
}
