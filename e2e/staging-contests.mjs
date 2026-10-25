// UI round-trip against real Supabase; only disposable teacher/contest/problems.
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import dotenv from '../apps/judge-worker/node_modules/dotenv/lib/main.js';
import { createClient } from '../apps/judge-worker/node_modules/@supabase/supabase-js/dist/index.mjs';
const env=dotenv.parse(fs.readFileSync(new URL('../.env',import.meta.url)));
const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=({data,error})=>{if(error)throw new Error(error.message);return data;};
const suffix=randomBytes(6).toString('hex'), title=`Contest UI ${suffix}`;
const names=[`${suffix} Bài A`,`${suffix} Bài B`];
const email=`ui-contest-${suffix}@example.invalid`,password=randomBytes(24).toString('base64url');
const web=process.env.STAGING_WEB_URL||'http://127.0.0.1:3000';
let userId,browser;const problemIds=[];
try {
  const {user}=must(await db.auth.admin.createUser({email,password,email_confirm:true}));userId=user.id;
  must(await db.from('profiles').update({role:'teacher'}).eq('id',userId));
  for(let i=0;i<2;i++){
    const p=must(await db.from('problems').insert({slug:`ui-contest-${suffix}-${i}`,title:names[i],description:'Disposable UI fixture',is_public:false,created_by:userId}).select('id').single());problemIds.push(p.id);
  }
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(web+'/');await page.getByRole('button',{name:/đăng nhập/i}).first().click();
  const login=page.getByRole('dialog');await login.locator('input[type=email]').fill(email);await login.locator('input[type=password]').fill(password);
  await login.getByRole('button',{name:'Đăng Nhập',exact:true}).click();await login.waitFor({state:'hidden'});
  await page.goto(web+'/teacher');await page.getByRole('button',{name:'Danh Sách Kỳ Thi',exact:true}).click();
  await page.getByRole('button',{name:'Tạo kỳ thi',exact:true}).click();
  await page.getByLabel('Tên kỳ thi',{exact:true}).fill(title);await page.getByLabel('Mô tả',{exact:true}).fill('Kiểm thử soạn contest');
  await page.getByLabel('Thể thức',{exact:true}).selectOption('OI');
  await page.getByLabel('Bắt đầu',{exact:true}).fill('2030-01-01T09:00');await page.getByLabel('Kết thúc',{exact:true}).fill('2030-01-01T10:00');
  await page.getByRole('button',{name:'Lưu kỳ thi',exact:true}).click();await page.getByRole('heading',{name:'Chỉnh sửa kỳ thi',exact:true}).waitFor();
  const section=page.getByRole('region',{name:'Bài thi',exact:true});
  await section.getByPlaceholder('Tìm bài tập...').fill(suffix);
  for(const name of names)await section.getByRole('checkbox',{name,exact:true}).check();
  await section.getByRole('button',{name:`Đưa ${names[1]} lên`,exact:true}).click();
  await section.getByLabel(`Điểm ${names[1]}`,{exact:true}).fill('50');
  await section.getByRole('button',{name:'Lưu bài thi',exact:true}).click();await section.getByText('Đã lưu 2 bài thi.',{exact:true}).waitFor();
  async function reopen(){
    await page.reload();await page.getByRole('button',{name:'Danh Sách Kỳ Thi',exact:true}).click();
    await page.getByRole('searchbox',{name:'Tìm kỳ thi',exact:true}).fill(title);
    await page.getByRole('row').filter({has:page.getByText(title,{exact:true})}).getByRole('button',{name:'Chỉnh sửa kỳ thi',exact:true}).click();
    await section.getByLabel(`Điểm ${names[1]}`,{exact:true}).waitFor();
  }
  await reopen();
  assert.equal(await page.getByLabel('Mô tả',{exact:true}).inputValue(),'Kiểm thử soạn contest');
  assert.equal(await section.getByLabel(`Điểm ${names[1]}`,{exact:true}).inputValue(),'50');
  assert((await section.locator('ol > li').first().innerText()).includes(names[1]),'Problem order lost after reload');
  await section.getByRole('button',{name:`Bỏ ${names[0]}`,exact:true}).click();await section.getByRole('button',{name:'Lưu bài thi',exact:true}).click();await section.getByText('Đã lưu 1 bài thi.',{exact:true}).waitFor();
  await reopen();assert.equal(await section.locator('ol > li').count(),1,'Removed problem was not persisted');
  assert.deepEqual(errors,[]);
  console.log('PASS staging contest UI: create -> select/reorder/OI scores -> reload -> remove -> reload; real Auth/REST/RLS, no browser errors');
} finally {
  await browser?.close();
  must(await db.from('contests').delete().eq('title',title));
  for(const id of problemIds)must(await db.from('problems').delete().eq('id',id));
  if(userId)must(await db.auth.admin.deleteUser(userId));
  console.log('Disposable contest/problem/account fixtures cleaned.');
}
