import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Problem, Submission, Testcase } from '../types.js';
import type { JudgingResult } from '../judging/judge-backend.js';
import { isDeepStrictEqual } from 'node:util';

export class JudgeRepository {
  constructor(private readonly db: SupabaseClient, private readonly requestTimeoutMs = 8000) {}

  async claim(submissionId: string): Promise<boolean> {
    const { data, error } = await this.db.rpc('claim_submission', { p_submission_id: submissionId })
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs));
    if (error) throw new Error(`Claim failed: ${error.message}`);
    return data === true;
  }

  async getProblem(id: string): Promise<Problem> {
    const { data, error } = await this.read(() => this.db.from('problems').select('*').eq('id', id)
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs)).single());
    if (error || !data) throw new Error(error?.message || 'Problem not found in database');
    return data as Problem;
  }

  async getTestcases(problemId: string): Promise<Testcase[]> {
    const { data, error } = await this.read(() => this.db.from('testcases').select('*').eq('problem_id', problemId)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .abortSignal(AbortSignal.timeout(this.requestTimeoutMs)));
    if (error || !data?.length) throw new Error(error?.message || 'No testcases available for this problem');
    return data as Testcase[];
  }

  async resolveTestcaseContent(tc: Testcase) {
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
    return { inputContent: normalizeNewlines(inputContent), outputContent: normalizeNewlines(outputContent) };
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
      score: result.score, error_log: result.errorLog, details: result.details,
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
      .subscribe(onStatus);
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await this.db.removeChannel(channel);
  }
}

function normalizeNewlines(content: string): string {
  const real = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (real.includes('\n')) return real;
  return real.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n');
}

/** Transport faults worth one retry; data errors are final. */
function isTransient(err: unknown): boolean {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return /timeout|timed out|abort|fetch failed|econnreset|etimedout|enotfound|network|socket/i.test(message);
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
