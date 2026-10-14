// Probe E2E qua ĐỦ 2 lớp thật của worker:
//   RsjudgeEngineClient (Submit/SelfTest) + CasesProviderServer (FetchCases)
// Engine binary khởi động riêng trên port lạ. Không có mock nào.
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { mkdtemp, writeFile, cp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const PROTO_DIR = new URL('../proto', import.meta.url).pathname;
const BIN = process.env.RSJUDGE_BIN ?? `${process.env.HOME}/.local/bin/rsjudge`;
const GRPC_PORT = Number(process.env.RSJUDGE_PROBE_GRPC ?? 15075);
const PROVIDER_PORT = Number(process.env.RSJUDGE_PROBE_PROVIDER ?? 15076);

const AB_SRC =
  '#include <cstdio>\nint main(){long long a,b;if(scanf("%lld %lld",&a,&b)!=2)return 1;printf("%lld\\n",a+b);}';

async function main() {
  // Config engine tạm
  const cfgDir = await mkdtemp(path.join(tmpdir(), 'oj-probe-cfg-'));
  await cp(new URL('../engine-config', import.meta.url).pathname, cfgDir, { recursive: true });
  await writeFile(
    path.join(cfgDir, 'services.toml'),
    `[grpc]\nlisten = ["127.0.0.1:${GRPC_PORT}"]\n\n[rest]\nlisten = ["127.0.0.1:18084"]\n`
  );

  // Lớp THẬT 1: CasesProviderServer từ dist (tự build tarball+zstd từ dữ liệu bài)
  const { CasesProviderServer } = await import('../dist/engine/cases-provider.js');
  const provider = new CasesProviderServer();
  const problems = {
    1: { timeLimitMs: 5000, memoryLimitMb: 512, totalScore: 100,
         cases: [{ input: '3 4\n', output: '7\n' }, { input: '10 -2\n', output: '8\n' }] },
    2: { timeLimitMs: 5000, memoryLimitMb: 512, totalScore: 100,
         cases: [{ input: '3 4\n', output: '999\n' }] },
    3: { timeLimitMs: 400, memoryLimitMb: 256, totalScore: 100,
         cases: [{ input: '1\n', output: '1\n' }] },
  };
  for (const [pid, problem] of Object.entries(problems)) {
    provider.register(async () => problem);
  }
  await provider.start(`127.0.0.1:${PROVIDER_PORT}`);

  // Engine trỏ --cases-endpoint về provider thật
  const eng = spawn(BIN, [
    '--config-dir', cfgDir,
    '--cases-endpoint', `http://127.0.0.1:${PROVIDER_PORT}`,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  await new Promise((r) => setTimeout(r, 800));

  let failed = 0;
  const check = (name, ok, detail = '') => {
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };

  try {
    // Lớp THẬT 2: RsjudgeEngineClient từ dist
    const { RsjudgeEngineClient } = await import('../dist/engine/rsjudge-client.js');
    const client = new RsjudgeEngineClient(`127.0.0.1:${GRPC_PORT}`);

    const st = await client.selfTest({ languageName: 'C++', code: AB_SRC, stdin: '20 22\n' });
    check('SelfTest AC', st.compileOk && st.exitStatus === 0 && st.stdout.trim() === '42',
      JSON.stringify(st).slice(0, 120));

    let summary = null;
    let caseCount = 0;
    for await (const ev of client.submit({ languageName: 'C++', code: AB_SRC, problemIntId: 1, casesIntId: 91 })) {
      if (ev.kind === 'summary') summary = ev.summary;
      if (ev.kind === 'case_info') caseCount++;
    }
    check('Submit AC x2 (score=100)',
      summary?.result === 'ACCEPTED' && summary.score === 100 && caseCount === 2,
      JSON.stringify(summary));

    summary = null;
    for await (const ev of client.submit({ languageName: 'C++', code: AB_SRC, problemIntId: 2, casesIntId: 92 })) {
      if (ev.kind === 'summary') summary = ev.summary;
    }
    check('Submit WA -> score 0', summary?.result === 'WRONG_ANSWER' && summary.score === 0,
      JSON.stringify(summary));

    summary = null;
    for await (const ev of client.submit({
      languageName: 'C++',
      code: 'int main(){volatile int x=1; while(x){}}',
      problemIntId: 3,
      casesIntId: 93,
    })) {
      if (ev.kind === 'summary') summary = ev.summary;
    }
    check('Submit TLE', summary?.result === 'TIME_LIMIT_EXCEEDED', JSON.stringify(summary));

    // Id lạ -> lỗi có chứa thông điệp gốc (engine bọc status upstream)
    let errText = '';
    try {
      for await (const ev of client.submit({ languageName: 'C++', code: AB_SRC, problemIntId: 999, casesIntId: 94 })) {
        void ev;
      }
    } catch (e) {
      errText = String(e?.message ?? e);
    }
    check('Unknown problem id -> NOT_FOUND',
      /unknown problem id|NOT_FOUND|requested entity was not found/i.test(errText),
      errText.slice(0, 140));
  } catch (err) {
    failed++;
    console.error('FATAL:', err);
  } finally {
    eng.kill('SIGTERM');
    await provider.stop().catch(() => {});
    await rm(cfgDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
