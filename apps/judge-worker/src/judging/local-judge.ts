import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { SandboxEngine } from '../sandbox/rsjudge.js';
import { compareOutput } from '../comparator.js';
import type { JudgeRepository } from '../data/judge-repository.js';
import type { Problem, Submission, SubmissionStatus, Testcase, TestcaseResult } from '../types.js';
import { scoreForCases, type JudgeBackend, type JudgingResult } from './judge-backend.js';

export class LocalJudge implements JudgeBackend {
  readonly mode = 'local';
  private ready = false;

  constructor(private readonly repository: JudgeRepository, private readonly sandbox = new SandboxEngine()) {}

  async initialize(): Promise<void> {
    await this.sandbox.assertReady();
    this.ready = true;
    console.log('🧱 Sandbox local (bwrap/time/timeout) — đặt RSJUDGE_ENDPOINT để dùng engine Rust.');
  }

  isReady(): boolean { return this.ready; }
  async close(): Promise<void> { this.ready = false; }

  async judge(submission: Submission, problem: Problem, testcases: Testcase[]): Promise<JudgingResult> {
    return this.withProgram(submission, async (targetPath) => {
      let overallStatus: SubmissionStatus = 'ACCEPTED';
      let maxTimeMs = 0;
      let maxMemoryMb = 0;
      const testcaseResults: TestcaseResult[] = [];
      const deadline = Date.now() + 10 * 60_000;
      for (const tc of testcases) {
        if (Date.now() > deadline) throw new Error('Submission exceeded 10 minute budget');
        const { inputContent, outputContent, contentError } = await this.repository.resolveTestcaseContent(tc);
        if (contentError) {
          testcaseResults.push({ testcase_id: tc.id, status: 'SYSTEM_ERROR', time_ms: 0, memory_mb: 0, error: contentError });
          overallStatus = 'SYSTEM_ERROR';
          continue;
        }
        const execResult = await this.sandbox.executeTestcase(
          submission.language, targetPath, inputContent, problem.time_limit_ms, problem.memory_limit_mb
        );
        let tcStatus = execResult.status;
        if (tcStatus === 'ACCEPTED' && !compareOutput(execResult.stdout, outputContent)) tcStatus = 'WRONG_ANSWER';
        maxTimeMs = Math.max(maxTimeMs, execResult.timeMs);
        maxMemoryMb = Math.max(maxMemoryMb, execResult.memoryMb);
        testcaseResults.push({
          testcase_id: tc.id, status: tcStatus, time_ms: execResult.timeMs, memory_mb: execResult.memoryMb,
          // User stderr can echo hidden input; expose only the verdict for judged cases.
          error: tcStatus === 'ACCEPTED' ? undefined : tcStatus,
        });
        if (tcStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') overallStatus = tcStatus;
      }
      return { status: overallStatus, timeMs: maxTimeMs, memoryMb: maxMemoryMb,
        score: scoreForCases(testcases, testcaseResults), errorLog: null, details: testcaseResults };
    });
  }

  async run(submission: Submission, problem: Problem, customInput: string): Promise<JudgingResult> {
    return this.withProgram(submission, async (targetPath) => {
      const execResult = await this.sandbox.executeTestcase(
        submission.language, targetPath, customInput, problem.time_limit_ms, problem.memory_limit_mb
      );
      return { status: execResult.status, timeMs: execResult.timeMs || 0, memoryMb: execResult.memoryMb || 0,
        score: 0, errorLog: null, details: [{
          testcase_id: 'run', status: execResult.status, time_ms: execResult.timeMs || 0,
          memory_mb: execResult.memoryMb || 0, error: execResult.error, output: (execResult.stdout ?? '').slice(0, 20000),
        }] };
    });
  }

  private async withProgram(submission: Submission, execute: (targetPath: string) => Promise<JudgingResult>): Promise<JudgingResult> {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), submission.is_run ? 'oj-run-' : 'oj-judge-'));
    try {
      const extension = { cpp: '.cpp', rust: '.rs', java: '.java', python: '.py' }[submission.language];
      const sourcePath = path.join(tempDir, submission.language === 'java' ? 'Main.java' : `solution${extension}`);
      const binaryPath = path.join(tempDir, 'solution_exec');
      await fs.writeFile(sourcePath, submission.code, 'utf-8');
      const compileResult = await this.sandbox.compile(submission.language, sourcePath, binaryPath);
      if (!compileResult.success) {
        return { status: 'COMPILE_ERROR', timeMs: 0, memoryMb: 0, score: 0,
          errorLog: compileResult.error || 'Compilation Failed', details: [] };
      }
      return await execute(submission.language === 'python' ? sourcePath : binaryPath);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
