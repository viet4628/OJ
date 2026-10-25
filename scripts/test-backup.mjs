#!/usr/bin/env node
// CLI contract: real pg_dump/restore, external Storage HTTP boundary.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const name = `oj-backup-${process.pid}`;
const dir = await mkdtemp(path.join(tmpdir(), name));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
const original = Buffer.from('hidden testcase\n');
let restored;
let targetPublic=true;
const storage = createServer(async (req,res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const target = req.url.startsWith('/target/');
  const resource = req.url.replace(/^\/(?:source|target)/, '');
  res.setHeader('Content-Type','application/json');
  if (resource === '/storage/v1/bucket') res.end(JSON.stringify([{ id: 'testcases', name: 'testcases', public: target && targetPublic }]));
  else if (resource === '/storage/v1/object/list/testcases') res.end(JSON.stringify(target && !restored ? [] : [{ id:'object1',name:'1.in',metadata:{mimetype:'text/plain'}}]));
  else if (resource === '/storage/v1/object/testcases/1.in' && req.method === 'GET') res.end(original);
  else if (resource === '/storage/v1/object/testcases/1.in' && req.method === 'POST') { restored = Buffer.from(body); res.end('{}'); }
  else { res.statusCode=404; res.end('{}'); }
});
await new Promise(resolve=>storage.listen(0,'127.0.0.1',resolve));
async function cli(args, success=true) {
  const result = await new Promise(resolve=>{
    const p=spawn(process.execPath,['scripts/backup.mjs',...args],{stdio:['ignore','pipe','pipe']});
    let output='';p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);p.on('exit',code=>resolve({code,output}));
  });
  assert.equal(result.code===0,success,result.output);
  return result;
}
try {
  for (const suffix of ['source','target']) {
    docker('run','-d','--name',`${name}-${suffix}`,'-e','POSTGRES_PASSWORD=temporary-only','postgres:15-alpine');
    for (let i=0;i<60;i++) {
      try { docker('exec',`${name}-${suffix}`,'pg_isready','-U','postgres'); break; } catch { await new Promise(r=>setTimeout(r,200)); }
    }
  }
  for (const file of ['supabase/tests/bootstrap.sql','supabase/schema.sql','supabase/seed.sql']) {
    execFileSync('docker',['exec','-i',`${name}-source`,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:await readFile(file),stdio:['pipe','pipe','pipe']});
  }
  docker('exec',`${name}-target`,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-c','CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
  docker('exec',`${name}-source`,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-c',"CREATE TABLE public.backup_probe(id int, value text); INSERT INTO public.backup_probe VALUES (1,'restored');");
  const base=`http://127.0.0.1:${storage.address().port}`;
  for (const suffix of ['source','target']) await writeFile(path.join(dir,suffix+'.env'),`SUPABASE_URL=${base}/${suffix}\nSUPABASE_SERVICE_ROLE_KEY=local-fixture\n`,{mode:0o600});
  const archive=path.join(dir,'archive');
  await cli(['backup','--directory',archive,'--env',path.join(dir,'source.env'),'--db-container',`${name}-source`]);
  await cli(['verify','--directory',archive]);
  await cli(['restore','--directory',archive,'--env',path.join(dir,'target.env'),'--db-container',`${name}-target`],false);
  assert.equal(restored,undefined,'Private backup must not be uploaded into a public bucket');
  targetPublic=false;
  await cli(['restore','--directory',archive,'--env',path.join(dir,'target.env'),'--db-container',`${name}-target`]);
  assert.equal(docker('exec',`${name}-target`,'psql','-U','postgres','-Atc','SELECT value FROM public.backup_probe WHERE id=1'),'restored');
  assert.deepEqual(restored,original);
  const count=docker('exec',`${name}-target`,'psql','-U','postgres','-Atc','SELECT count(*) FROM public.problems');
  assert(Number(count)>=5,'Restored platform seed missing');
  const hidden=docker('exec',`${name}-target`,'psql','-U','postgres','-Atc','SET ROLE anon; SELECT count(*) FROM public.testcases');
  assert.equal(hidden.split('\n').at(-1),'0','Restore must preserve hidden testcase RLS');
  await cli(['restore','--directory',archive,'--env',path.join(dir,'target.env'),'--db-container',`${name}-target`],false);
  const dump=path.join(archive,'database.dump'); const data=await readFile(dump); data[0]^=255;await writeFile(dump,data);
  await cli(['verify','--directory',archive],false);
  console.log('PASS backup/verify/restore DB + private Storage; nonempty target and corruption rejected');
} finally {
  storage.closeAllConnections();await new Promise(r=>storage.close(r));
  for (const suffix of ['source','target']) try { docker('rm','-f',`${name}-${suffix}`); } catch {}
  await rm(dir,{recursive:true,force:true});
}
