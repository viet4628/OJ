import type { JudgeRepository } from '../data/judge-repository.js';
import type { JudgeBackend, JudgingResult } from '../judging/judge-backend.js';
import type { Submission } from '../types.js';

export class SubmissionService {
  constructor(private readonly repository: JudgeRepository, private readonly judge: JudgeBackend) {}

  async process(submission: Submission): Promise<void> {
    const started = performance.now();
    console.log(`[Worker] Processing submission ID: ${submission.id} (Language: ${submission.language})`);
    // Claim errors must reach the daemon; no code runs without an atomic claim.
    if (!(await this.repository.claim(submission.id))) {
      console.warn(`[Worker] Submission ${submission.id} already claimed by another worker.`);
      return;
    }
    const claimed = performance.now();
    let loaded = claimed;
    let result: JudgingResult;
    try {
      // CHẠY THỬ: is_run + custom_input trong details → chỉ chạy 1 lần, không so đáp án.
      const runInput = submission.is_run ? (submission.details as unknown as { custom_input?: unknown })?.custom_input : undefined;
      if (typeof runInput === 'string') {
        const problem = await this.repository.getProblem(submission.problem_id);
        loaded = performance.now();
        result = await this.judge.run(submission, problem, runInput);
      } else {
        // Một round trip lấy cả problem lẫn testcases (cache trong worker).
        const { problem, testcases } = await this.repository.getProblemBundle(submission.problem_id);
        loaded = performance.now();
        result = await this.judge.judge(submission, problem, testcases);
      }
    } catch (err) {
      if (loaded === claimed) loaded = performance.now();
      console.error(`[Worker] Unexpected error for submission ${submission.id}:`, err);
      result = { status: 'SYSTEM_ERROR', timeMs: 0, memoryMb: 0, score: 0,
        errorLog: err instanceof Error ? err.message : String(err), details: [] };
    }
    const judged = performance.now();
    if (submission.is_run) result = { ...result, score: 0 };
    // A persistence failure is fatal: do not keep consuming jobs with lost results.
    await this.repository.saveResult(submission.id, result);
    console.log('[Timing]', JSON.stringify({ submissionId: submission.id, mode: this.judge.mode, status: result.status,
      claimMs: Math.round(claimed - started), loadMs: Math.round(loaded - claimed),
      judgeMs: Math.round(judged - loaded), saveMs: Math.round(performance.now() - judged),
      totalMs: Math.round(performance.now() - started),
      // Số liệu chi tiết chỉ nằm trong log server, không ghi xuống DB cho học sinh đọc.
      cases: result.details.map(d => [d.status, d.time_ms ?? 0, d.memory_mb ?? 0]) }));
    console.log(`[Worker] Finished ${this.judge.mode} submission ${submission.id}: ${result.status}`);
  }
}
