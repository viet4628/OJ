import { RsjudgeEngineClient, LANG_TO_ENGINE } from '../engine/rsjudge-client.js';
import { CasesProviderServer, type ProviderProblem } from '../engine/cases-provider.js';
import type { JudgeRepository } from '../data/judge-repository.js';
import type { Problem, Submission, SubmissionStatus, Testcase, TestcaseResult } from '../types.js';
import { protoStatusToSubmission, scoreForCases, type JudgeBackend, type JudgingResult } from './judge-backend.js';

/** Upper bound of parallel Storage reads while preparing one problem archive. */
const MAX_PARALLEL_LOADS = 8;

/** Chấm bài qua rsjudge engine (compile/run trong Rust sandbox). */
export class EngineJudge implements JudgeBackend {
  readonly mode = 'engine';
  private client: RsjudgeEngineClient | null = null;
  private readonly provider = new CasesProviderServer();
  private nextCasesIntId = 1;

  constructor(private readonly repository: JudgeRepository, private readonly endpoint: string, private readonly providerBind: string) {}

  async initialize(): Promise<void> {
    try {
      await this.provider.start(this.providerBind);
      this.client = new RsjudgeEngineClient(this.endpoint);
      console.log(`⚙️ rsjudge engine mode ON: judge=${this.endpoint}, cases-provider=${this.providerBind}`);
    } catch (err) {
      await this.close();
      throw new Error(`Cannot initialize engine mode: ${err instanceof Error ? err.message : err}`);
    }
  }

  isReady(): boolean { return this.client?.isReady() ?? false; }

  async close(): Promise<void> {
    await this.provider.stop();
    this.client?.close();
    this.client = null;
  }

  async judge(submission: Submission, problem: Problem, testcases: Testcase[]): Promise<JudgingResult> {
    if (!this.client) throw new Error('Engine is not initialized');
    const pIntId = this.provider.register(() => this.loadProviderProblem(problem, testcases));
    const rpcStarted = performance.now();
    let compiledAt = rpcStarted;
    const casesIntId = this.nextCasesIntId++;
    if (!Number.isInteger(pIntId) || pIntId < 1) throw new Error(`invalid problem int id ${pIntId} (engine registry desync)`);
    console.log(`[Worker] Engine submit ${submission.id}: problem#${pIntId} cases#${casesIntId}`);
    let overallStatus: SubmissionStatus = 'SYSTEM_ERROR';
    let maxTimeMs = 0;
    let maxMemoryMb = 0;
    const caseInfos = new Map<number, { status: SubmissionStatus; timeMs: number; memoryMb: number }>();
    try {
      for await (const event of this.client.submit({
        languageName: LANG_TO_ENGINE[submission.language], code: submission.code, problemIntId: pIntId, casesIntId,
      })) {
        if (event.kind === 'compile_info') compiledAt = performance.now();
        if (event.kind === 'compile_info' && event.exitStatus !== 0) {
          return { status: 'COMPILE_ERROR', timeMs: 0, memoryMb: 0, score: 0,
            errorLog: (event.stderr || event.stdout || 'Compilation Failed').slice(0, 8000), details: [] };
        }
        if (event.kind === 'case_info') {
          const info = event.info;
          caseInfos.set(info.case_id, { status: protoStatusToSubmission(info.result),
            timeMs: info.time_ms ?? 0, memoryMb: Math.ceil((info.memory_kib ?? 0) / 1024) });
          maxTimeMs = Math.max(maxTimeMs, info.time_ms ?? 0);
          maxMemoryMb = Math.max(maxMemoryMb, Math.ceil((info.memory_kib ?? 0) / 1024));
        }
        if (event.kind === 'summary') {
          overallStatus = protoStatusToSubmission(event.summary.result);
          if (event.summary.max_time_ms != null) maxTimeMs = event.summary.max_time_ms;
          if (event.summary.max_memory_kib != null) maxMemoryMb = Math.max(maxMemoryMb, Math.ceil(event.summary.max_memory_kib / 1024));
        }
      }
      // Map case results back to testcases theo thứ tự archive (= created_at).
      const testcaseResults: TestcaseResult[] = testcases.map((tc, index) => {
        const info = caseInfos.get(index + 1);
        return { testcase_id: tc.id, status: info?.status ?? 'SYSTEM_ERROR', time_ms: info?.timeMs ?? 0,
          memory_mb: info?.memoryMb ?? 0, error: undefined };
      });
      if (caseInfos.size !== testcases.length) throw new Error('Incomplete engine testcase stream');
      return { status: overallStatus, timeMs: maxTimeMs, memoryMb: maxMemoryMb,
        score: scoreForCases(testcases, testcaseResults), errorLog: null, details: testcaseResults };
    } catch (err) {
      return { status: 'SYSTEM_ERROR', timeMs: maxTimeMs, memoryMb: maxMemoryMb, score: 0,
        errorLog: `engine error: ${err instanceof Error ? err.message : err}`.slice(0, 8000), details: [] };
    } finally {
      this.provider.unregister(pIntId);
      console.log('[EngineTiming]', JSON.stringify({ submissionId: submission.id, compileRpcMs: Math.round(compiledAt - rpcStarted),
        afterCompileMs: Math.round(performance.now() - compiledAt) }));
    }
  }

  /** Custom run qua engine SelfTest RPC. */
  async run(submission: Submission, _problem: Problem, customInput: string): Promise<JudgingResult> {
    if (!this.client) throw new Error('Engine is not initialized');
    try {
      const result = await this.client.selfTest({
        languageName: LANG_TO_ENGINE[submission.language], code: submission.code, stdin: customInput,
      });
      if (!result.compileOk) {
        return { status: 'COMPILE_ERROR', timeMs: 0, memoryMb: 0, score: 0,
          errorLog: (result.compileStderr || 'Compilation Failed').slice(0, 8000), details: [] };
      }
      const timedOut = result.verdictTimeMs == null;
      const status = result.result ? protoStatusToSubmission(result.result)
        : timedOut ? 'TIME_LIMIT_EXCEEDED' : result.exitStatus === 0 ? 'ACCEPTED' : 'RUNTIME_ERROR';
      return { status, timeMs: result.verdictTimeMs ?? 0, memoryMb: Math.ceil((result.memoryKiB ?? 0) / 1024),
        score: 0, errorLog: null, details: [{
          testcase_id: 'run', status, time_ms: result.verdictTimeMs ?? 0,
          memory_mb: Math.ceil((result.memoryKiB ?? 0) / 1024),
          error: timedOut ? 'Time Limit Exceeded' : status === 'RUNTIME_ERROR' ? result.stderr.slice(0, 2000) : undefined,
          output: result.stdout.slice(0, 20000),
        }] };
    } catch (err) {
      console.error(`[Worker] Engine custom-run failed for ${submission.id}:`, err);
      return { status: 'SYSTEM_ERROR', timeMs: 0, memoryMb: 0, score: 0, errorLog: 'Engine custom run failed', details: [] };
    }
  }

  private async loadProviderProblem(problem: Problem, testcases: Testcase[]): Promise<ProviderProblem> {
    const cases: ProviderProblem['cases'] = [];
    let totalScore = 0;
    // Bound in-flight Storage requests while keeping archive order identical to verdict order.
    const contents = await this.loadTestcaseContents(testcases);
    for (const [index, content] of contents.entries()) {
      if (content.contentError) throw new Error(content.contentError);
      cases.push({ input: content.inputContent, output: content.outputContent, score: testcases[index].score });
      totalScore += testcases[index].score ?? 0;
    }
    return { timeLimitMs: problem.time_limit_ms, memoryLimitMb: problem.memory_limit_mb,
      totalScore: totalScore > 0 ? totalScore : 100, cases };
  }

  /** Read every testcase with a bounded number of parallel Storage requests, preserving order. */
  private async loadTestcaseContents(testcases: Testcase[]) {
    const results = new Array<Awaited<ReturnType<JudgeRepository['resolveTestcaseContent']>>>(testcases.length);
    let next = 0;
    const readers = Array.from({ length: Math.min(MAX_PARALLEL_LOADS, testcases.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= testcases.length) return;
        results[index] = await this.repository.resolveTestcaseContent(testcases[index]);
      }
    });
    await Promise.all(readers);
    return results;
  }
}
