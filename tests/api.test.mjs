import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

test('本地 API：会话保护、私有草稿、来源去重、多账号分发和最终状态',async t=>{
  const root=await mkdtemp(join(tmpdir(),'wkn-api-'));
  const serverPath=fileURLToPath(new URL('../studio/server.mjs',import.meta.url));
  const child=spawn(process.execPath,[serverPath],{env:{...process.env,STUDIO_PORT:'0',WKN_PROJECT_ROOT:root},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,3000).unref();});assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));assert.ok(root.includes('wkn-api-'));await rm(root,{recursive:true,force:true});});
  const {origin,token}=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('工作台未能启动')),15000);child.stdout.on('data',data=>{output+=data;const m=output.match(/(http:\/\/127\.0\.0\.1:\d+)\/#token=([a-f0-9]+)/);if(m){clearTimeout(timeout);resolve({origin:m[1],token:m[2]});}});child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`工作台退出 ${code}`));});child.stderr.on('data',data=>{output+=data;});});
  const request=async(path,data,method='POST')=>{const r=await fetch(origin+'/api'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(method!=='GET'?{body:JSON.stringify(data||{})}:{})});const json=await r.json();return{status:r.status,data:json};};
  const unauthorized=await fetch(origin+'/api/state');assert.equal(unauthorized.status,401);
  const cross=await fetch(origin+'/api/state',{headers:{Authorization:`Bearer ${token}`,Origin:'https://evil.example'}});assert.equal(cross.status,403);
  const draft={title:'API 私有草稿',date:'2026-11-14',body:'私有正文，不能自动进入公开内容目录',description:'摘要',category:'测试',tags:[]};
  const saved=await request('/drafts',draft);assert.equal(saved.status,200);
  await assert.rejects(()=>readFile(join(root,'src/content/posts',`${saved.data.id}.md`)));
  const source='https://blog.csdn.net/author/article/details/12345/';
  const markdown=`---\ntitle: 迁移文章\ndate: 2024-03-02\nsource: ${source}\n---\n\n原始内容。`;
  const first=await request('/import',{format:'markdown',content:markdown,downloadImages:false});assert.equal(first.data.duplicate,false);
  const second=await request('/import',{format:'markdown',content:markdown.replace('原始内容','不同内容').replace('/12345/','/12345'),downloadImages:false});assert.equal(second.data.duplicate,true);assert.equal(first.data.draft.id,second.data.draft.id);assert.equal(second.data.draft.body,first.data.draft.body);
  const a=await request('/accounts',{platform:'csdn',name:'账号一'});const b=await request('/accounts',{platform:'csdn',name:'账号二'});assert.notEqual(a.data.id,b.data.id);
  const delivery=await request('/deliver',{post:draft,accounts:[a.data.id,b.data.id],mode:'package'});assert.equal(delivery.data.jobs.length,2);
  let jobs=[];for(let i=0;i<40;i++){const state=await request('/state',null,'GET');jobs=state.data.jobs;if(jobs.length===2&&jobs.every(j=>j.status==='prepared'))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.status==='prepared'));assert.ok(jobs.every(j=>!j.remoteUrl));
  const duplicate=await request('/deliver',{post:draft,accounts:[a.data.id,b.data.id],mode:'package'});assert.ok(duplicate.data.jobs.every(j=>j.reused));
  const wrong=await request(`/jobs/${jobs[0].id}/confirm`,{url:'https://juejin.cn/post/12345'});assert.equal(wrong.status,400);
  const confirm=await request(`/jobs/${jobs[0].id}/confirm`,{url:'https://blog.csdn.net/a/article/details/12345'});assert.equal(confirm.data.status,'confirmed-by-author');assert.match(confirm.data.message,/未独立/);
  const publicPost=await request('/publish',{...draft,id:saved.data.id});assert.equal(publicPost.data.status,'written-to-repository');assert.ok((await readFile(join(root,publicPost.data.file),'utf8')).includes(draft.title));
  const handoff=await request('/extension-handoff',{jobId:jobs[0].id});assert.equal(handoff.status,200);assert.notEqual(new URL(handoff.data.url).port,new URL(origin).port);const handoffPage=await(await fetch(handoff.data.url)).text();assert.ok(!handoffPage.includes(token));
});
