import { hostname } from 'node:os';

export function readWorkerConfig(env: NodeJS.ProcessEnv) {
  const pollIntervalMs = Number(env.WORKER_POLL_INTERVAL_MS || 2000);
  const healthPort = Number(env.WORKER_HEALTH_PORT || 9090);
  const requestTimeoutMs = Number(env.WORKER_REQUEST_TIMEOUT_MS || 8000);
  const concurrency = Number(env.WORKER_CONCURRENCY || 1);
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 100 || !Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65535
    || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30000) {
    throw new Error('Invalid WORKER_POLL_INTERVAL_MS, WORKER_HEALTH_PORT or WORKER_REQUEST_TIMEOUT_MS');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('Invalid WORKER_CONCURRENCY (1..8)');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return {
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    engineEndpoint: env.RSJUDGE_ENDPOINT || '',
    providerBind: env.RSJUDGE_PROVIDER_BIND || '127.0.0.1:50052',
    healthBind: env.WORKER_HEALTH_BIND || '127.0.0.1',
    workerId: env.WORKER_ID || hostname(),
    pollIntervalMs,
    requestTimeoutMs,
    healthPort,
    concurrency,
  };
}

export type WorkerConfig = ReturnType<typeof readWorkerConfig>;
