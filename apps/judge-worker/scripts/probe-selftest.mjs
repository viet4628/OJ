// Probe: gọi thẳng SelfTest RPC như worker làm, dump từng event thô.
import { spawn } from 'child_process';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_DIR = new URL('../proto', import.meta.url).pathname;
const BIN = process.env.RSJUDGE_BIN ?? `${process.env.HOME}/.local/bin/rsjudge`;
const GRPC_PORT = 15061;

async function main() {
  // 1. Engine trên port riêng
  const { mkdtemp, writeFile, cp, rm } = await import('fs/promises');
  const cfgDir = await mkdtemp(path.join('/tmp', 'oj-probe-cfg-'));
  await cp(new URL('../engine-config', import.meta.url).pathname, cfgDir, { recursive: true });
  await writeFile(path.join(cfgDir, 'services.toml'),
    `[grpc]\nlisten = ["127.0.0.1:${GRPC_PORT}"]\n\n[rest]\nlisten = ["127.0.0.1:18081"]\n`);

  const eng = spawn(BIN, ['--config-dir', cfgDir], { stdio: ['ignore', 'ignore', 'inherit'] });
  await new Promise((r) => setTimeout(r, 800));

  try {
    const def = protoLoader.loadSync(path.join(PROTO_DIR, 'judge/v1/judge.proto'), {
      keepCase: false,
      includeDirs: [PROTO_DIR],
    });
    const pkg = grpc.loadPackageDefinition(def);
    const client = new pkg.judge.v1.JudgeService(
      `127.0.0.1:${GRPC_PORT}`,
      grpc.credentials.createInsecure()
    );

    const call = client.SelfTest({
      language: { name: 'C++' },
      code: '#include <cstdio>\nint main(){int a,b;if(scanf("%d %d",&a,&b)!=2)return 1;printf("%d\\n",a+b);}',
      stdin: '3 4\n',
    });

    await new Promise((resolve) => {
      call.on('data', (ev) => {
        console.log('EVENT keys:', Object.keys(ev));
        console.log('EVENT raw :', JSON.stringify(ev));
      });
      call.on('error', (e) => { console.error('CALL ERROR:', e.message); resolve(); });
      call.on('end', () => { console.log('STREAM END'); resolve(); });
    });
  } finally {
    eng.kill('SIGTERM');
    await rm(cfgDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().then(() => process.exit(0));
