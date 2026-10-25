import type { Problem, Submission, SubmissionStatus, Testcase, TestcaseResult } from '../types.js';

export interface JudgingResult {
  status: SubmissionStatus;
  timeMs: number;
  memoryMb: number;
  score: number;
  errorLog: string | null;
  details: TestcaseResult[];
}

// Both real implementations share this contract; no inheritance is needed.
export interface JudgeBackend {
  readonly mode: 'local' | 'engine';
  initialize(): Promise<void>;
  isReady(): boolean;
  judge(submission: Submission, problem: Problem, testcases: Testcase[]): Promise<JudgingResult>;
  run(submission: Submission, problem: Problem, input: string): Promise<JudgingResult>;
  close(): Promise<void>;
}

export function scoreForCases(testcases: Testcase[], results: TestcaseResult[]): number {
  const total = testcases.reduce((sum, tc) => sum + tc.score, 0);
  const passed = testcases.reduce((sum, tc, i) => sum + (results[i]?.status === 'ACCEPTED' ? (total > 0 ? tc.score : 1) : 0), 0);
  return Math.round(100 * passed / (total || testcases.length));
}

export function protoStatusToSubmission(proto: string): SubmissionStatus {
  switch (proto) {
    case 'ACCEPTED': return 'ACCEPTED';
    case 'WRONG_ANSWER':
    case 'PRESENTATION_ERROR': return 'WRONG_ANSWER';
    case 'TIME_LIMIT_EXCEEDED': return 'TIME_LIMIT_EXCEEDED';
    case 'MEMORY_LIMIT_EXCEEDED': return 'MEMORY_LIMIT_EXCEEDED';
    case 'COMPILE_ERROR': return 'COMPILE_ERROR';
    default: return 'RUNTIME_ERROR';
  }
}
