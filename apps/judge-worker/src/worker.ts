import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { readWorkerConfig } from './config.js';
import { JudgeRepository } from './data/judge-repository.js';
import { EngineJudge } from './judging/engine-judge.js';
import { LocalJudge } from './judging/local-judge.js';
import { WorkerApp } from './worker-app.js';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

async function main(): Promise<void> {
  const config = readWorkerConfig(process.env);
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    realtime: { params: { eventsPerSecond: 2 } },
  });
  const repository = new JudgeRepository(client, config.requestTimeoutMs);
  // rsjudge engine mode: worker chỉ điều phối qua engine Rust và phục vụ testcase qua gRPC.
  const judge = config.engineEndpoint
    ? new EngineJudge(repository, config.engineEndpoint, config.providerBind)
    : new LocalJudge(repository);
  const app = new WorkerApp(config, repository, judge);
  const stop = () => app.stop();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await app.start();
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  }
}

main().catch((err) => { console.error('[Worker] Fatal:', err); process.exit(1); });
