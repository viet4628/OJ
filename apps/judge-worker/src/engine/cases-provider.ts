import { execFile, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as grpc from '@grpc/grpc-js';
import * as os from 'os';
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';

const PROTO_DIR = process.env.RSJUDGE_PROTO_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../proto');

const MAX_CHUNK_BYTES = 1024 * 1024;

export interface ProviderCase {
  input: string;
  output: string;
  score?: number;
}

export interface ProviderProblem {
  timeLimitMs: number;
  memoryLimitMb: number;
  totalScore: number;
  cases: ProviderCase[];
}

type FetchHandler = (problemIntId: number) => Promise<ProviderProblem>;

function loadCasesPackage(): any {
  const definition = protoLoader.loadSync(
    path.join(PROTO_DIR, 'cases/v1/cases.proto'),
    { keepCase: false, includeDirs: [PROTO_DIR] }
  );
  return grpc.loadPackageDefinition(definition) as unknown as any;
}

/** Build a (optionally zstd-compressed) tarball for the given problem data. */
async function buildArchive(problem: ProviderProblem): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oj-cases-'));
  try {
    const perCase = Math.floor(problem.totalScore / Math.max(1, problem.cases.length));
    const remainder = problem.totalScore - perCase * problem.cases.length;
    const config = {
      score: problem.totalScore,
      judge: { judgeType: 'classic' },
      resourceLimits: {
        time: problem.timeLimitMs,
        memory: problem.memoryLimitMb,
      },
      task: {
        taskType: 'simple',
        cases: problem.cases.map((_, i) => ({
          input: `${i + 1}.in`,
          answer: `${i + 1}.ans`,
          ...(problem.cases[i].score ? { score: problem.cases[i].score } : i === 0 && remainder ? { score: perCase + remainder } : perCase ? { score: perCase } : {}),
        })),
      },
    };

    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
    for (let i = 0; i < problem.cases.length; i++) {
      await fs.writeFile(path.join(dir, `${i + 1}.in`), problem.cases[i].input, 'utf-8');
      await fs.writeFile(path.join(dir, `${i + 1}.ans`), problem.cases[i].output, 'utf-8');
    }

    const names = ['config.json', ...problem.cases.flatMap((_, i) => [`${i + 1}.in`, `${i + 1}.ans`])];
    const tarBuffer = await new Promise<Buffer>((resolve, reject) => {
      execFile('tar', ['-cf', '-', '-C', dir, ...names], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 30000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout as unknown as Buffer);
      });
    });

    // Prefer zstd when available; engine also accepts plain tar.
    const compressed = await new Promise<Buffer | null>((resolve) => {
      const zstd = spawn('zstd', ['-3', '-q'], { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      zstd.stdout.on('data', (c: Buffer) => chunks.push(c));
      zstd.on('error', () => resolve(null));
      zstd.on('close', (code) => resolve(code === 0 ? Buffer.concat(chunks) : null));
      zstd.stdin.on('error', () => {});
      zstd.stdin.end(tarBuffer);
    });

    return compressed ?? tarBuffer;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Serves `cases.v1.CasesService` to rsjudge engines. Problems are
 * registered under small int ids (proto uses int32); the worker keeps the
 * uuid mapping on its side.
 */
export class CasesProviderServer {
  private readonly registry = new Map<number, FetchHandler>();
  private nextId = 1;
  private server?: grpc.Server;

  /** Register a provider callback and mint a stable int id. */
  register(handler: FetchHandler): number {
    const id = this.nextId++;
    this.registry.set(id, handler);
    return id;
  }

  unregister(id: number): void { this.registry.delete(id); }

  async start(bindAddress = '127.0.0.1:50052'): Promise<number> {
    const pkg = loadCasesPackage();

    const server = new grpc.Server();
    server.addService(pkg.cases.v1.CasesService.service, {
      FetchCases: async (
        call: grpc.ServerUnaryCall<any, any> | any,
      ) => {
        // grpc-js decode field sang camelCase; chấp nhận cả hai để chống lệch phiên bản loader.
        const problemIntId = Number(call.request?.problem_id ?? call.request?.problemId ?? 0);
        const handler = this.registry.get(problemIntId);
        if (!handler) {
          call.emit('error', {
            code: grpc.status.NOT_FOUND,
            message: `unknown problem id ${problemIntId}`,
          });
          return;
        }

        try {
          const started = performance.now();
          const problem = await handler(problemIntId);
          const loaded = performance.now();
          const archive = await buildArchive(problem);
          console.log('[CasesTiming]', JSON.stringify({ problemIntId, cases: problem.cases.length,
            loadMs: Math.round(loaded - started), archiveMs: Math.round(performance.now() - loaded), archiveBytes: archive.length }));

          // Echo cases_id metadata per contract.
          const meta = new grpc.Metadata();
          const inbound = call.metadata?.get?.('cases_id');
          if (inbound && inbound.length > 0) meta.set('cases_id', String(inbound[0]));
          call.sendMetadata(meta);

          for (let offset = 0; offset < archive.length; offset += MAX_CHUNK_BYTES) {
            const chunk = archive.subarray(offset, offset + MAX_CHUNK_BYTES);
            call.write({ chunk });
          }
          call.end();
        } catch (err: any) {
          call.emit('error', {
            code: grpc.status.INTERNAL,
            message: `cannot build archive: ${err?.message ?? err}`,
          });
        }
      },
    });

    const port = await new Promise<number>((resolve, reject) => {
      server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) reject(err);
        else {
          resolve(port);
        }
      });
    });

    this.server = server;
    return port;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.tryShutdown(() => resolve()));
      this.server = undefined;
    }
  }
}
