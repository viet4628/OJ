// Real Auth/REST/RPC/RLS; only disposable accounts and a disposable problem.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import dotenv from '../apps/judge-worker/node_modules/dotenv/lib/main.js';
import { createClient } from '../apps/judge-worker/node_modules/@supabase/supabase-js/dist/index.mjs';

const env = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
const frontend = dotenv.parse(fs.readFileSync(new URL('../apps/web/.env.local', import.meta.url)));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
// Check the migration before creating fixtures.
must(await db.from('problems').select('starter_codes').limit(1));
const suffix = randomBytes(6).toString('hex');
const accounts = [];
let problemId;
try {
  const clients = [];
  for (const role of ['teacher', 'user']) {
    const email = `starter-${role}-${suffix}@example.invalid`;
    const password = randomBytes(24).toString('base64url');
    const { user } = must(await db.auth.admin.createUser({ email, password, email_confirm: true }));
    accounts.push(user.id);
    if (role === 'teacher') must(await db.from('profiles').update({ role }).eq('id', user.id));
    const client = createClient(env.SUPABASE_URL, frontend.VITE_SUPABASE_ANON_KEY, options);
    must(await client.auth.signInWithPassword({ email, password }));
    clients.push(client);
  }
  const [teacher, student] = clients;
  const statement = { slug: `starter-${suffix}`, title: `Starter ${suffix}`, description: 'Disposable starter fixture',
    difficulty: 'Easy', time_limit_ms: 1000, memory_limit_mb: 256, is_public: true, tags: [], samples: [],
    starter_codes: { cpp: '// public starter\nint main() {}', python: '# public python' } };
  const bundle = { p_problem_id: null, p_problem: statement,
    p_testcases: [{ input_content: '1', output_content: '1', score: 100, is_sample: false }], p_editorial: 'PRIVATE_REFERENCE' };
  problemId = must(await teacher.rpc('save_problem_bundle', bundle));
  const read = async () => must(await student.from('problems').select('starter_codes').eq('id', problemId).single()).starter_codes;
  assert.deepEqual(await read(), statement.starter_codes);
  assert.equal(must(await student.rpc('get_problem_editorial', { p_problem_id: problemId })), null);
  assert.deepEqual(must(await student.from('testcases').select('input_content,output_content').eq('problem_id', problemId)), []);
  assert((await student.rpc('save_problem_bundle', { ...bundle, p_problem_id: problemId })).error);
  const changed = { ...statement, starter_codes: { cpp: '// updated public starter' } };
  must(await teacher.rpc('save_problem_bundle', { ...bundle, p_problem_id: problemId, p_problem: changed }));
  assert.deepEqual(await read(), changed.starter_codes);
  assert((await teacher.from('problems').update({ starter_codes: { java: 'unsupported' } }).eq('id', problemId)).error);
  assert.deepEqual(await read(), changed.starter_codes);
  console.log('PASS staging starter codes: teacher save/update -> student read; private editorial/testcases hidden; student writes and unsupported language rejected.');
} finally {
  if (problemId) must(await db.from('problems').delete().eq('id', problemId));
  for (const id of accounts) must(await db.auth.admin.deleteUser(id));
  console.log('Disposable starter problem/accounts cleaned.');
}
