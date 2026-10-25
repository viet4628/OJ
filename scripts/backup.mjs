#!/usr/bin/env node
// PostgreSQL15 custom archive + Storage objects. Stop writes for a consistent snapshot.
import { parseArgs, parseEnv } from 'node:util';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

process.umask(0o077);
const { positionals, values } = parseArgs({ allowPositionals:true, options:{ directory:{type:'string'}, env:{type:'string'}, 'db-container':{type:'string'} } });
const [action] = positionals;
const dir = values.directory && path.resolve(values.directory);
if (!dir || !['backup','verify','restore'].includes(action)) {
  console.error('Usage: node scripts/backup.mjs backup|verify|restore --directory <archive> [--env <file>] [--db-container <local PostgreSQL15>]');
  process.exit(1);
}
const config = action==='verify' ? {} : { ...parseEnv(await readFile(values.env || '.env','utf8')), ...process.env };
function database(command, args) {
  if (!values['db-container'] && !config.DATABASE_URL) throw new Error('DATABASE_URL or --db-container required.');
  const local = values['db-container'];
  const parsed = !local && new URL(config.DATABASE_URL);
  const connection = parsed ? { PGHOST:parsed.hostname, PGPORT:parsed.port || '5432', PGUSER:decodeURIComponent(parsed.username), PGPASSWORD:decodeURIComponent(parsed.password), PGDATABASE:decodeURIComponent(parsed.pathname.slice(1)) || 'postgres', PGSSLMODE:parsed.searchParams.get('sslmode') || 'require' } : {};
  const argv = local ? ['exec','-i',local,command,'-U','postgres',...args] : ['run','--rm','-i','--network','host',...Object.keys(connection).flatMap(key=>['-e',key]),'postgres:15-alpine',command,...args];
  const proc = spawn('docker',argv,{env:{...process.env,...connection},stdio:['pipe','pipe','pipe']});
  proc.stderr.resume(); // database diagnostics can contain credentials/connection strings
  const done = new Promise((resolve,reject)=>{
    proc.on('error',()=>reject(new Error(`Cannot start ${command}.`)));
    proc.on('exit',code=>code===0 ? resolve() : reject(new Error(`${command} failed (${code}); check DB connectivity, roles and PostgreSQL15 compatibility.`)));
  });
  done.catch(()=>{});
  return {proc,done};
}
async function sql(query) {
  const {proc,done}=database('psql',['-At','-v','ON_ERROR_STOP=1','-c',query]);
  proc.stdin.end();let out='';for await (const chunk of proc.stdout) out+=chunk;await done;return out.trim();
}
async function digest(file) {
  const hash=createHash('sha256');for await (const data of createReadStream(file)) hash.update(data);return hash.digest('hex');
}
const storageUrl = config.SUPABASE_URL?.replace(/\/$/,'');
async function storage(resource, method='GET', body, binary=false, headers={}) {
  if (!storageUrl || !config.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for Storage.');
  const response=await fetch(storageUrl+'/storage/v1/'+resource,{
    method,headers:{Authorization:`Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,apikey:config.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',...headers},
    body:body===undefined ? undefined : binary ? body : JSON.stringify(body),signal:AbortSignal.timeout(60000),
  });
  if (!response.ok) { await response.body?.cancel();throw new Error(`Storage ${method} failed (${response.status}).`); }
  return response;
}
async function listObjects(bucket,prefix='') {
  const objects=[];
  for (let offset=0;;offset+=100) {
    const rows=await (await storage('object/list/'+encodeURIComponent(bucket),'POST',{prefix,limit:100,offset,sortBy:{column:'name',order:'asc'}})).json();
    for (const row of rows) {
      const name=prefix ? prefix+'/'+row.name : row.name;
      if (row.id) objects.push({name,mime:row.metadata?.mimetype || 'application/octet-stream'});
      else objects.push(...await listObjects(bucket,name));
    }
    if (rows.length<100) break;
  }
  return objects;
}
const objectPath = (bucket,name) => 'object/'+encodeURIComponent(bucket)+'/'+name.split('/').map(encodeURIComponent).join('/');
async function verify() {
  try { await stat(path.join(dir,'INCOMPLETE'));throw new Error('Backup incomplete; do not restore.'); } catch(error) { if(error.code!=='ENOENT') throw error; }
  const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
  if(manifest.version!==1 || !Array.isArray(manifest.objects) || !Array.isArray(manifest.buckets)) throw new Error('Invalid manifest.');
  const files=[{file:'database.dump',sha256:manifest.databaseSha256},...manifest.objects];
  for(const entry of files) {
    if(!/^(?:database\.dump|\d+\.bin)$/.test(entry.file) || await digest(path.join(dir,entry.file))!==entry.sha256) throw new Error('Backup integrity check failed.');
  }
  return manifest;
}
try {
  if(action==='verify') { const m=await verify();console.log(`PASS archive integrity: DB + ${m.objects.length} Storage objects`); }
  if(action==='backup') {
    await mkdir(dir,{mode:0o700});
    await writeFile(path.join(dir,'INCOMPLETE'),'Snapshot in progress. Stop application writes until completion.');
    const {proc,done}=database('pg_dump',['-Fc','--no-owner']);proc.stdin.end();
    await Promise.all([pipeline(proc.stdout,createWriteStream(path.join(dir,'database.dump'),{flags:'wx',mode:0o600})),done]);
    const buckets=await (await storage('bucket')).json();
    const manifest={version:1,createdAt:new Date().toISOString(),source:storageUrl,databaseSha256:await digest(path.join(dir,'database.dump')),buckets:[],objects:[]};
    for(const bucket of buckets) {
      manifest.buckets.push({id:bucket.id,name:bucket.name,public:bucket.public,file_size_limit:bucket.file_size_limit,allowed_mime_types:bucket.allowed_mime_types});
      for(const object of await listObjects(bucket.id)) {
        const file=manifest.objects.length+'.bin';
        const response=await storage(objectPath(bucket.id,object.name));
        await pipeline(Readable.fromWeb(response.body),createWriteStream(path.join(dir,file),{flags:'wx',mode:0o600}));
        manifest.objects.push({bucket:bucket.id,...object,file,sha256:await digest(path.join(dir,file))});
      }
    }
    await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
    await rm(path.join(dir,'INCOMPLETE'));
    console.log(`PASS backup: DB + ${manifest.objects.length} Storage objects. Contains sensitive data; keep private.`);
  }
  if(action==='restore') {
    const manifest=await verify();
    if(manifest.source===storageUrl) throw new Error('Restore requires a separate target project.');
    const tables=await sql("SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE'");
    if(tables!=='0') throw new Error('Restore refused: target DB must be empty. Managed Supabase restore requires its dedicated recovery procedure.');
    const buckets=await (await storage('bucket')).json();
    for(const bucket of buckets) if((await listObjects(bucket.id)).length) throw new Error('Restore refused: target Storage must be empty.');
    for(const bucket of manifest.buckets) {
      const existing=buckets.find(b=>b.id===bucket.id);
      if(existing && existing.public!==bucket.public) throw new Error('Restore refused: target bucket visibility differs from backup.');
    }
    // All checks precede mutations. Failed restore targets must be discarded/recreated.
    const {proc,done}=database('pg_restore',['--no-owner','--exit-on-error','--single-transaction','-d',values['db-container'] ? 'postgres' : config.DATABASE_URL ? decodeURIComponent(new URL(config.DATABASE_URL).pathname.slice(1)) || 'postgres' : 'postgres']);
    proc.stdout.resume();await Promise.all([pipeline(createReadStream(path.join(dir,'database.dump')),proc.stdin),done]);
    for(const bucket of manifest.buckets) if(!buckets.some(b=>b.id===bucket.id)) await storage('bucket','POST',bucket);
    for(const object of manifest.objects) await storage(objectPath(object.bucket,object.name),'POST',await readFile(path.join(dir,object.file)),true,{'Content-Type':object.mime,'x-upsert':'true'});
    console.log(`PASS restore: DB + ${manifest.objects.length} Storage objects. Run application/RLS/canary checks before use.`);
  }
} catch(error) { console.error(error.message);process.exitCode=1; }
