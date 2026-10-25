import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
let ready=true;
const server=createServer((req,res)=>{res.writeHead(ready?200:503,{'Content-Type':'application/json'});res.end(JSON.stringify({ready,queued:0,processing:0,lastPollAt:Date.now()}));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
async function check(code) {
  const result=await new Promise(resolve=>{
    const p=spawn(process.execPath,['scripts/health.mjs','--url',`http://127.0.0.1:${server.address().port}/health`]);
    let text='';p.stdout.on('data',d=>text+=d);p.stderr.on('data',d=>text+=d);p.on('exit',actual=>resolve({actual,text}));
  });
  assert.equal(result.actual,code,result.text);
  const report=JSON.parse(result.text.trim());assert.equal(report.ok,code===0);assert.equal(report.samples,1);
}
try {await check(0);ready=false;await check(1);console.log('PASS health CLI reports healthy/unavailable with machine-readable status and exit code');}
finally { server.closeAllConnections();server.close(); }
