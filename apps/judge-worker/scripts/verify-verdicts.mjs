#!/usr/bin/env node
// Kiểm chứng verdict của engine: AC / WA / TLE / MLE / RTE.
// Dùng service_role, tự tạo và dọn fixture. Chạy khi engine đổi cách chấm.
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const config = dotenv.parse(await readFile(new URL('../../../.env', import.meta.url)));
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;

// Fractional on purpose: RLIMIT_CPU is whole seconds, so 1500ms catches truncation.
const timeLimitMs = 1500;
const memoryLimitMb = 64;
const problem = must(await admin.from('problems').insert({ slug: `verdict-${suffix}`, title: 'verdict fixture',
  description: 'disposable', is_public: false, time_limit_ms: timeLimitMs, memory_limit_mb: memoryLimitMb }).select('id').single());
must(await admin.from('testcases').insert({ problem_id: problem.id, input_path: 'inline', output_path: 'inline',
  input_content: '7', output_content: '49', score: 1 }));

const email = `verdict-${suffix}@example.invalid`;
const { user } = must(await admin.auth.admin.createUser({ email, password: randomBytes(24).toString('base64url'), email_confirm: true }));

const cases = [
  { name: 'AC', expected: 'ACCEPTED', code: '#include <cstdio>\nint main(){int a;scanf("%d",&a);printf("%d\\n",a*7);}' },
  { name: 'AC-1.2s', expected: 'ACCEPTED', code: '#include <cstdio>\n#include <ctime>\nint main(){int a;scanf("%d",&a);volatile unsigned long x=0;while((double)clock()/CLOCKS_PER_SEC<1.2)x++;printf("%d\\n",a*7);}' },
  { name: 'WA', expected: 'WRONG_ANSWER', code: '#include <cstdio>\nint main(){int a;scanf("%d",&a);printf("%d\\n",a*7+1);}' },
  { name: 'TLE', expected: 'TIME_LIMIT_EXCEEDED', code: 'int main(){for(;;){}}' },
  { name: 'MLE', expected: 'MEMORY_LIMIT_EXCEEDED', code: '#include <cstdio>\n#include <vector>\nint main(){std::vector<char> b(400u*1024*1024,1);printf("%d\\n",(int)b[0]);}' },
  { name: 'RTE', expected: 'RUNTIME_ERROR', code: 'int main(){return 3;}' },
  // Network syscalls are outside the seccomp profile: the program is killed.
  { name: 'SECCOMP', expected: 'RUNTIME_ERROR', code: '#include <sys/socket.h>\n#include <cstdio>\nint main(){int a;scanf("%d",&a);socket(AF_INET,SOCK_STREAM,0);printf("%d\\n",a*7);}' },
];

const results = [];
try {
  for (const item of cases) {
    const { id } = must(await admin.from('submissions').insert({ user_id: user.id, problem_id: problem.id,
      language: 'cpp', code: item.code }).select('id').single());
    for (;;) {
      const row = must(await admin.from('submissions').select('status,time_used_ms,memory_used_mb,error_log,score')
        .eq('id', id).single());
      if (!['PENDING', 'JUDGING'].includes(row.status)) {
        results.push({ ...item, actual: row.status, ok: row.status === item.expected,
          timeMs: row.time_used_ms, memoryMb: row.memory_used_mb, error: row.error_log });
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }
} finally {
  await admin.from('problems').delete().eq('id', problem.id);
  await admin.auth.admin.deleteUser(user.id);
}

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(7)} expected=${r.expected.padEnd(22)} actual=${r.actual.padEnd(22)} time=${r.timeMs}ms mem=${r.memoryMb}MB${r.error ? ' err=' + String(r.error).slice(0, 120) : ''}`);
}
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `${failed}/${results.length} verdict sai` : `OK: ${results.length}/${results.length} verdict đúng`);
process.exitCode = failed ? 1 : 0;
