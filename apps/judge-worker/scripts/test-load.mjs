// Public CLI contract against dedicated staging; fixtures are removed by load-staging.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'oj-load-test-'));
try {
  const output=path.join(dir,'report.json');
  const result=await promisify(execFile)(process.execPath,['apps/judge-worker/scripts/load-staging.mjs','--users','2','--jobs','4','--output',output],{timeout:180000});
  const report=JSON.parse(await readFile(output,'utf8'));
  assert.equal(report.completed,4);assert.equal(report.failures,0);assert.equal(report.users,2);
  assert(report.p95FinishMs>0);assert(report.p95QueueMs>=0);assert(report.throughputPerSecond>0);
  console.log(result.stdout.trim());console.log('PASS staging load CLI report: 2 users, 4 real judged submissions');
} finally {await rm(dir,{recursive:true,force:true});}
