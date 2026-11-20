export type SubmissionStatus =
  | 'PENDING'
  | 'JUDGING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'SYSTEM_ERROR';

export interface Submission {
  id: string;
  user_id: string;
  problem_id: string;
  contest_id?: string | null;
  language: 'cpp' | 'python' | 'java' | 'rust';
  code: string;
  status: SubmissionStatus;
  time_used_ms: number;
  memory_used_mb: number;
  score: number;
  error_log?: string;
  details: TestcaseResult[];
  is_run?: boolean;
  is_validation?: boolean;
  created_at: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  description: string;
  time_limit_ms: number;
  memory_limit_mb: number;
}

export interface Testcase {
  id: string;
  problem_id: string;
  input_path: string;
  output_path: string;
  input_content?: string | null;
  output_content?: string | null;
  score: number;
  is_sample: boolean;
  created_at?: string;
}

export interface TestcaseResult {
  testcase_id: string;
  status: SubmissionStatus;
  time_ms: number;
  memory_mb: number;
  error?: string;
  output?: string;
}
