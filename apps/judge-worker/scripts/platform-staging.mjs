#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { checkPlatform } from './platform-checks.mjs';
const config=dotenv.parse(await readFile(new URL('../../../.env',import.meta.url)));
const web=dotenv.parse(await readFile(new URL('../../web/.env.local',import.meta.url)));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,options);
const anonKey=config.SUPABASE_ANON_KEY||web.VITE_SUPABASE_ANON_KEY;
const must=({data,error})=>{if(error)throw new Error(error.message);return data;};
const suffix=randomBytes(8).toString('hex');
const credentials=[],tokens=new Map(),cleanup=[],clients=[];
let studentCredentials;
async function request(resource,jwt=config.SUPABASE_SERVICE_ROLE_KEY,method='GET',body){
  const response=await fetch(config.SUPABASE_URL+'/rest/v1/'+resource,{method,headers:{Authorization:`Bearer ${jwt}`,apikey:anonKey,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const text=await response.text();if(!response.ok)throw new Error(`${response.status}: ${text}`);
  const data=text?JSON.parse(text):null;
  if(method==='POST'&&resource==='rpc/save_problem_bundle'&&!body.p_problem_id)cleanup.push(()=>admin.from('problems').delete().eq('id',data));
  if(method==='POST'&&resource==='contests')for(const row of data)cleanup.push(()=>admin.from('contests').delete().eq('id',row.id));
  if(resource==='rpc/set_account_suspension'&&body.p_suspended){
    assert(data.revoked_sessions>=1,'Real Auth sessions must be revoked');
    const probe=createClient(config.SUPABASE_URL,anonKey,options);
    const login=await probe.auth.signInWithPassword(studentCredentials);
    assert(login.error,'Suspended account can still sign in through real Auth');
    console.log('PASS staging Auth ban blocks sign-in and revokes real session');
  }
  return data;
}
try {
  const servers=must(await admin.from('judge_servers').select('ready,last_seen_at'));
  assert(!servers.some(s=>s.ready && Date.now()-new Date(s.last_seen_at).getTime()<30000),'Stop the worker before platform queue assertions.');
  for(const role of ['user','teacher','admin']){
    const auth={email:`platform-${suffix}-${role}@example.invalid`,password:randomBytes(24).toString('base64url')};
    const {user}=must(await admin.auth.admin.createUser({...auth,email_confirm:true}));credentials.push(user.id);
    if(role!=='user')must(await admin.from('profiles').update({role}).eq('id',user.id));
    const client=createClient(config.SUPABASE_URL,anonKey,options);clients.push(client);
    const login=must(await client.auth.signInWithPassword(auth));tokens.set(user.id,login.session.access_token);
    if(role==='user')studentCredentials=auth;
  }
  const [user,teacherId,adminId]=credentials;
  const problem=must(await admin.from('problems').insert({slug:'platform-'+suffix,title:'Platform A+B',description:'Disposable staging fixture',is_public:true,time_limit_ms:1000}).select('id').single()).id;
  cleanup.push(()=>admin.from('problems').delete().eq('id',problem));
  must(await admin.from('testcases').insert([{problem_id:problem,input_path:'inline',output_path:'inline',input_content:'3 4',output_content:'7',score:100}]));
  const code=suffix.slice(0,8).toUpperCase();
  const classroom=must(await admin.from('classrooms').insert({name:'Platform class',code,teacher_id:teacherId}).select('id').single()).id;
  cleanup.push(()=>admin.from('classrooms').delete().eq('id',classroom));
  const contest=must(await admin.from('contests').insert({title:'Platform contest',description:'Disposable',start_time:new Date(Date.now()-3600000).toISOString(),end_time:new Date(Date.now()+3600000).toISOString()}).select('id').single()).id;
  cleanup.push(()=>admin.from('contests').delete().eq('id',contest));
  await checkPlatform(request,(role,id)=>role==='anon'?anonKey:tokens.get(id),{user,teacherId,adminId,problem,classroom,contest,code,slug:'editorial-'+suffix});
  console.log('PASS staging platform REST/RPC and real Auth. Worker must remain stopped for deterministic queue assertions.');
} finally {
  let failed=false;
  for(const fn of cleanup.reverse()){try{const {error}=await fn();if(error)throw error;}catch(error){failed=true;console.error('Fixture cleanup failed:',error.message);}}
  for(const client of clients)await client.auth.signOut().catch(()=>{});
  for(const id of credentials){const {error}=await admin.auth.admin.deleteUser(id);if(error){failed=true;console.error('Fixture user cleanup failed');}}
  if(failed)process.exitCode=1;
}
