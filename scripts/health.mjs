#!/usr/bin/env node
// JSON on stdout, nonzero exit on any failed sample; use cron/monitoring to alert.
import { parseArgs } from 'node:util';
import { appendFile } from 'node:fs/promises';
const { values }=parseArgs({options:{url:{type:'string',default:'http://127.0.0.1:9090/health'},duration:{type:'string',default:'0'},interval:{type:'string',default:'15'},output:{type:'string'}}});
const duration=Number(values.duration), interval=Number(values.interval);
if(!Number.isFinite(duration)||duration<0||!Number.isFinite(interval)||interval<1){console.error('Invalid duration/interval (seconds).');process.exit(1);}
const started=Date.now(), end=started+duration*1000;
let samples=0,failures=0,maxQueued=0,maxProcessing=0;
do {
  const sample={at:new Date().toISOString(),ok:false};
  try {
    const response=await fetch(values.url,{signal:AbortSignal.timeout(5000)});const health=await response.json();
    Object.assign(sample,{ok:response.ok && health.ready===true && Number.isFinite(health.lastPollAt) && Date.now()-health.lastPollAt<30000,health});
    maxQueued=Math.max(maxQueued,Number(health.queued)||0);maxProcessing=Math.max(maxProcessing,Number(health.processing)||0);
  } catch { sample.error='Health endpoint unreachable or invalid'; }
  samples++;if(!sample.ok)failures++;
  if(values.output)await appendFile(values.output,JSON.stringify(sample)+'\n',{mode:0o600});
  if(Date.now()>=end)break;
  await new Promise(r=>setTimeout(r,Math.min(interval*1000,end-Date.now())));
} while(true);
console.log(JSON.stringify({ok:failures===0,samples,failures,elapsedSeconds:(Date.now()-started)/1000,maxQueued,maxProcessing}));
process.exitCode=failures?1:0;
