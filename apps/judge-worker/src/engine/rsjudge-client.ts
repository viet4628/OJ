import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import path from 'path';

const PROTO_DIR = process.env.RSJUDGE_PROTO_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../proto');

const LOADER_OPTS: protoLoader.Options = {
  keepCase: false,
  includeDirs: [PROTO_DIR],
};

export interface SubmitCaseInfo {
  case_id: number;
  result: string;
  exit_status: number;
  score: number;
  time_ms: number | null;
  memory_kib: number | null;
}

export interface SubmitSummary {
  result: string;
  score: number;
  max_time_ms: number | null;
  max_memory_kib: number | null;
}

export type SubmitEvent =
  | { kind: 'compile_start' }
  | { kind: 'compile_info'; exitStatus: number; stdout: string; stderr: string }
  | { kind: 'case_info'; info: SubmitCaseInfo }
  | { kind: 'summary'; summary: SubmitSummary };

export interface LanguageConfig {
  bool?: boolean;
  enum?: string;
}

/** Worker-side mapping to configured executor names in executors.toml. */
export const LANG_TO_ENGINE: Record<string, string> = {
  cpp: 'C++',
  rust: 'Rust',
  python: 'Python',
};

// judge.v1 JudgeResult enum — grpc-js có thể trả số thay vì tên.
const RESULT_NAMES = [
  'UNSPECIFIED',
  'ACCEPTED',
  'COMPILE_ERROR',
  'WRONG_ANSWER',
  'PRESENTATION_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'OUTPUT_LIMIT_EXCEEDED',
] as const;

export function resultName(value: unknown): string {
  const idx = Number(value);
  if (!Number.isFinite(idx) || idx <= 0 || idx >= RESULT_NAMES.length) {
    return typeof value === 'string' && value ? value : 'RUNTIME_ERROR';
  }
  return RESULT_NAMES[idx];
}

function loadPackage(protoFile: string): grpc.GrpcObject {
  const definition = protoLoader.loadSync(path.join(PROTO_DIR, protoFile), LOADER_OPTS);
  return grpc.loadPackageDefinition(definition) as unknown as grpc.GrpcObject;
}

/** proto3 optional: absent → undefined → null ở tầng TS. */
function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Thin client over the rsjudge engine's `judge.v1` gRPC service.
 *
 * The engine pulls testcase archives itself from our `cases.v1` provider
 * (see cases-provider.ts); this class only drives submissions and streams
 * results back.
 */
export class RsjudgeEngineClient {
  private readonly judge: any;

  constructor(endpoint: string) {
    const pkg = loadPackage('judge/v1/judge.proto') as any;
    this.judge = new pkg.judge.v1.JudgeService(
      endpoint,
      grpc.credentials.createInsecure()
    );
    // Wait up to 30s for engine connection, then proceed anyway (fallback handled upstream)
    grpc.waitForClientReady(this.judge, Date.now() + 30_000, () => {});
  }

  isReady(): boolean { return this.judge.getChannel().getConnectivityState(true) === grpc.connectivityState.READY; }

  close(): void { this.judge.close(); }

  /** Stream of judge events for one submission. */
  submit(opts: {
    languageName: string;
    code: string;
    problemIntId: number;
    casesIntId: number;
    options?: Record<string, LanguageConfig>;
  }): AsyncIterable<SubmitEvent> {
    const pkg = loadPackage('judge/v1/judge.proto') as any;

    const configs: Record<string, any> = {};
    for (const [key, value] of Object.entries(opts.options ?? {})) {
      if (value.bool !== undefined) {
        configs[key] = { boolean: value.bool };
      } else if (value.enum !== undefined) {
        configs[key] = { enum: { value: value.enum } };
      }
    }

    const call = this.judge.Submit({
      language: { name: opts.languageName, configs },
      code: opts.code,
      // Gửi CẢ HAI kiểu key: protobufjs chấp nhận name (snake_case) lẫn
      // localName (camelCase), và bỏ qua key lạ — chống lệch phiên bản loader.
      problemId: opts.problemIntId,
      problem_id: opts.problemIntId,
      casesId: opts.casesIntId,
      cases_id: opts.casesIntId,
    }, { deadline: Date.now() + 10 * 60_000 });

    // NOTE: proto-loader (keepCase:false) phát sự kiện theo camelCase, và
    // các trường proto3 mặc định (0/'') có thể bị bỏ trong object.
    async function* iterate(): AsyncIterable<SubmitEvent> {
      for await (const raw of call) {
        if ('compile_start' in raw || 'compileStart' in raw) {
          yield { kind: 'compile_start' };
        } else if ('compile_info' in raw || 'compileInfo' in raw) {
          const ci = raw.compile_info ?? raw.compileInfo;
          yield {
            kind: 'compile_info',
            exitStatus: Number(ci.exit_status ?? ci.exitStatus ?? 0),
            stdout: String(ci.stdout ?? ''),
            stderr: String(ci.stderr ?? ''),
          };
        } else if ('case_info' in raw || 'caseInfo' in raw) {
          const info = raw.case_info ?? raw.caseInfo;
          yield {
            kind: 'case_info',
            info: {
              case_id: Number(info.case_id ?? info.caseId ?? 0),
              result: resultName(info.result),
              exit_status: Number(info.exit_status ?? info.exitStatus ?? 0),
              score: Number(info.score ?? 0),
              time_ms: numOrNull(info.time_ms ?? info.timeMs),
              memory_kib: numOrNull(info.memory_kib ?? info.memoryKib),
            },
          };
        } else if ('cases_summary' in raw || 'casesSummary' in raw) {
          const s = raw.cases_summary ?? raw.casesSummary;
          yield {
            kind: 'summary',
            summary: {
              result: resultName(s.result),
              score: Number(s.score ?? 0),
              max_time_ms: numOrNull(s.max_time_ms ?? s.maxTimeMs),
              max_memory_kib: numOrNull(s.max_memory_kib ?? s.maxMemoryKib),
            },
          };
        }
      }
    }

    void pkg; // keep reference alive for typing clarity
    return iterate();
  }

  /**
   * Run code once against custom input without comparing (custom-run).
   */
  selfTest(opts: {
    languageName: string;
    code: string;
    stdin: string;
  }): Promise<{ compileOk: boolean; compileStderr: string; stdout: string; stderr: string; exitStatus: number; verdictTimeMs: number | null; result?: string; memoryKiB?: number }> {
    return new Promise((resolve, reject) => {
      const call = this.judge.SelfTest({
        language: { name: opts.languageName },
        code: opts.code,
        stdin: opts.stdin,
      }, { deadline: Date.now() + 150_000 });

      let compileOk = true;
      let compileStderr = '';
      let summary: any = null;

      call.on('data', (raw: any) => {
        const ci = raw.compile_info ?? raw.compileInfo;
        if (ci) {
          compileOk = Number(ci.exit_status ?? ci.exitStatus ?? 0) === 0;
          compileStderr = String(ci.stderr ?? '');
          return;
        }
        const s = raw.summary;
        if (s) summary = s;
      });
      call.on('error', (err: Error) => reject(err));
      call.on('end', () => {
        if (!summary && compileOk) { reject(new Error('Engine ended without a summary')); return; }
        if (!summary) {
          resolve({ compileOk, compileStderr, stdout: '', stderr: '', exitStatus: -1, verdictTimeMs: null });
          return;
        }
        resolve({
          compileOk,
          compileStderr,
          result: summary.result ? resultName(summary.result) : undefined,
          memoryKiB: Number(summary.memory_usage ?? summary.memoryUsage ?? 0),
          stdout: String(summary.stdout ?? ''),
          stderr: String(summary.stderr ?? ''),
          // int32 không-optional: giá trị 0 bị protobufjs lược bỏ → mặc định phải là 0
        exitStatus: Number(summary.exit_status ?? summary.exitStatus ?? 0),
          verdictTimeMs: numOrNull(summary.execution_time ?? summary.executionTime),
        });
      });
    });
  }
}
