#!/usr/bin/env node
// Smoke test rsjudge engine mode: khởi động engine binary, kiểm tra REST API
// (/languages, /selftest) với C++/Python thật.
// Usage: node scripts/smoke-engine.mjs   (env: RSJUDGE_BIN, RSJUDGE_CONFIG_DIR)
import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const APPS_ROOT = new URL('../../../', import.meta.url).pathname;
const ENGINE_BUILD = process.env.RSJUDGE_BIN
  ?? null;
const SOURCE_CONFIG = process.env.RSJUDGE_CONFIG_DIR
  ?? new URL('../engine-config', import.meta.url).pathname;
let CONFIG_DIR; // patched per-run so the smoke owns its ports
const REST_PORT = Number(process.env.RSJUDGE_REST_PORT ?? 18080);
const BASE = `http://127.0.0.1:${REST_PORT}`;

async function resolveBinary() {
  if (ENGINE_BUILD) return ENGINE_BUILD;
  const { execFileSync } = await import('child_process');
  const directCandidates = [
    path.join(APPS_ROOT, 'engine/rsjudge/build/debug/rsjudge'),
    path.join(APPS_ROOT, 'engine/rsjudge/target/debug/rsjudge'),
  ];
  for (const candidate of directCandidates) {
    try {
      const help = execFileSync(candidate, ['--help'], { timeout: 5000, encoding: 'utf8' });
      if (help.includes('config-dir')) return candidate;
    } catch {
      /* not built or not the engine */
    }
  }
  // cargo 1.97 + custom build-dir: final bin lives under deps/ without its
  // plain name; test harnesses share the prefix, so probe --help output.
  const depsDir = path.join(APPS_ROOT, 'engine/rsjudge/build/debug/deps');
  const candidates = (await readdir(depsDir).catch(() => []))
    .filter((f) => /^rsjudge-[0-9a-f]{16}$/.test(f))
    .map((f) => path.join(depsDir, f));
  for (const candidate of candidates.sort().reverse()) {
    try {
      const help = execFileSync(candidate, ['--help'], { timeout: 5000, encoding: 'utf8' });
      if (help.includes('config-dir')) return candidate;
    } catch {
      /* not the engine */
    }
  }
  throw new Error(`no rsjudge binary found in ${depsDir}`);
}

let failed = 0;
function record(name, ok, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function waitReady(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/languages`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('engine did not become ready');
}

async function selfTest(body) {
  const res = await fetch(`${BASE}/selftest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { httpStatus: res.status, text: (await res.text()).slice(0, 300) };
  return { httpStatus: res.status, ...(await res.json()) };
}

// Patch a per-run config copy so the smoke owns its ports.
const { readFile, writeFile, cp } = await import('fs/promises');
CONFIG_DIR = await mkdtemp(path.join(tmpdir(), 'oj-engine-cfg-'));
await cp(SOURCE_CONFIG, CONFIG_DIR, { recursive: true });
const svcPath = path.join(CONFIG_DIR, 'services.toml');
const svc = (await readFile(svcPath, 'utf-8'))
  .replace('0.0.0.0:50051', `127.0.0.1:${Number(process.env.RSJUDGE_GRPC_PORT ?? 15051)}`)
  .replace('0.0.0.0:8080', `127.0.0.1:${REST_PORT}`)
  .replace('0.0.0.0:80', `127.0.0.1:${REST_PORT}`);
await writeFile(svcPath, svc);

const BIN = await resolveBinary();
console.log(`Engine binary: ${BIN}`);
console.log(`Config dir:    ${CONFIG_DIR}`);

const engineProc = spawn(BIN, ['--config-dir', CONFIG_DIR], {
  stdio: ['ignore', 'inherit', 'inherit'],
});
engineProc.on('error', (err) => {
  console.error(`Cannot spawn engine: ${err.message}`);
  process.exit(1);
});

try {
  await waitReady();

  const langs = await (await fetch(`${BASE}/languages`)).json();
  record('GET /languages', Array.isArray(langs.languages) && langs.languages.length >= 1,
    JSON.stringify(langs.languages?.map((l) => l.name)));

  const cpp = await selfTest({
    language: 'C++',
    code: '#include <cstdio>\nint main(){int a,b;if(scanf("%d %d",&a,&b)!=2)return 1;printf("%d\\n",a+b);}',
    stdin: '3 4\n',
  });
  record('C++ a+b -> ACCEPTED',
    cpp.verdict === 'ACCEPTED' && cpp.stdout?.trim() === '7',
    JSON.stringify(cpp).slice(0, 160));

  const py = await selfTest({
    language: 'Python',
    code: 'import sys\nsys.stdout.write(sys.stdin.read().strip()[::-1])\n',
    stdin: 'abcdef\n',
  });
  record('Python reverse -> ACCEPTED',
    py.verdict === 'ACCEPTED' && py.stdout === 'fedcba',
    JSON.stringify(py).slice(0, 160));

  const tle = await selfTest({
    language: 'C++',
    code: 'int main(){volatile int x=1; while(x){}}',
    time_limit_ms: 600,
  });
  record('C++ busy loop -> TIME_LIMIT_EXCEEDED', tle.verdict === 'TIME_LIMIT_EXCEEDED',
    `verdict=${tle.verdict}`);

  const ce = await selfTest({ language: 'C++', code: 'int main(){ nope }' });
  record('C++ syntax error -> compile fail', ce.executed === false && ce.compile_exit_status !== 0,
    JSON.stringify(ce).slice(0, 120));
} catch (err) {
  failed++;
  console.error('FATAL:', err);
} finally {
  engineProc.kill('SIGTERM');
  if (CONFIG_DIR) await rm(CONFIG_DIR, { force: true, recursive: true }).catch(() => {});
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
