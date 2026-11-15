import express from 'express';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { access, mkdir, readFile } from 'node:fs/promises';
import { createStore } from './lib/store.mjs';
import { parseMarkdown, validatePost, renderMarkdown, versionHash, isCsdnUrl, csdnArticleId } from './lib/content.mjs';
import { fetchRestricted, extractCsdnHtml, localizeImages, discoverCsdn } from './lib/import.mjs';
import { listPublicPosts, writePublicPost, deletePublicPost, gitStatus, pushBlog } from './lib/publish.mjs';
import { platforms, openLogin, closeAccount, closeBrowsers, makeDelivery, prefillEditor, validateRemoteLink } from './lib/distribution.mjs';
import { createHandoffServer } from './lib/extension.mjs';
import { saveUploadedImage } from './lib/assets.mjs';

const root=process.env.WKN_PROJECT_ROOT?resolve(process.env.WKN_PROJECT_ROOT):join(dirname(fileURLToPath(import.meta.url)),'..');
const store=await createStore(join(root,'.local'));
const token=randomBytes(32).toString('hex');const app=express();
let handoff;
let port=Number(process.env.STUDIO_PORT??4310);let host=`127.0.0.1:${port}`;let origin=`http://${host}`;
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('STUDIO_PORT 必须为 0–65535 的整数');
const idValid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store'});
  if(req.headers.host!==host)return res.status(403).json({error:'请求来源主机不正确'});
  if(req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({error:'不允许跨站请求本地工作台'});
  next();
});
app.use('/api', (req,res,next)=>{
  const given=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const a=Buffer.from(given),b=Buffer.from(token);
  if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:'会话已失效，请使用启动终端中的完整链接重新进入'});
  if(!['GET','HEAD'].includes(req.method)&&!req.is('application/json'))return res.status(415).json({error:'请求须使用 JSON 格式'});
  next();
});
app.use(express.json({limit:'8mb'}));
app.use(express.static(join(root,'studio/web'),{index:'index.html'}));
app.get('/favicon.svg',(_req,res)=>res.sendFile(join(root,'public/favicon.svg')));
app.use('/images/imported',express.static(join(root,'.local/assets'),{index:false,dotfiles:'deny'}));
app.use('/images/imported',express.static(join(root,'src/assets/imported'),{index:false,dotfiles:'deny'}));
app.use('/images',express.static(join(root,'public/images'),{index:false,dotfiles:'deny'}));
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);

app.get('/api/state',wrap(async(_req,res)=>{const state=await store.read();res.json({...state,posts:await listPublicPosts(root),platforms:Object.entries(platforms).map(([id,p])=>({id,name:p.name})),git:await gitStatus(root)});}));
app.post('/api/preview',wrap(async(req,res)=>res.json({html:renderMarkdown(String(req.body.body||'').replace(/\.\.\/\.\.\/assets\/imported\//g,'/images/imported/'))})));
app.post('/api/assets',wrap(async(req,res)=>res.json(await saveUploadedImage(join(root,'.local/assets'),req.body.base64))));
app.post('/api/drafts',wrap(async(req,res)=>{
  const post=validatePost(req.body);const id=req.body.id||randomUUID();if(!idValid(id))throw new Error('草稿 ID 无效');
  const draft={...post,id,updatedAt:new Date().toISOString(),publicId:req.body.publicId||undefined};
  await store.update(state=>{const index=state.drafts.findIndex(d=>d.id===id);if(index<0)state.drafts.unshift(draft);else state.drafts[index]=draft;});res.json(draft);
}));
app.delete('/api/drafts/:id',wrap(async(req,res)=>{await store.update(s=>{s.drafts=s.drafts.filter(d=>d.id!==req.params.id);});res.json({deleted:true});}));
app.post('/api/publish',wrap(async(req,res)=>{
  const post=validatePost(req.body);const result=await writePublicPost(root,post,req.body.publicId||undefined);
  if(req.body.id&&idValid(req.body.id))await store.update(s=>{const d=s.drafts.find(d=>d.id===req.body.id);if(d)d.publicId=result.id;});
  res.json({...result,message:'已写入仓库公开目录。网站将在提交推送、Actions 构建通过后更新。'});
}));
app.delete('/api/posts/:id',wrap(async(req,res)=>{await deletePublicPost(root,req.params.id);res.json({deleted:true,message:'已移除本地公开文章文件，推送后更新网站。'});}));
app.post('/api/git/push',wrap(async(_req,res)=>res.json(await pushBlog(root))));

app.post('/api/import/discover',wrap(async(req,res)=>{
  const articles=await discoverCsdn(String(req.body.url||''));res.json({articles,message:articles.length?'仅列出当前主页 HTML 中可发现的文章；历史文章请补充详情链接，不代表已扫描全部分页。':'未找到可导入文章，主页可能使用动态加载或访问受限。可直接粘贴文章详情链接。'});
}));
app.post('/api/import',wrap(async(req,res)=>{
  const warnings=[];let post;
  if(req.body.format==='markdown')post=parseMarkdown(String(req.body.content||''),String(req.body.filename||''));
  else{
    const source=String(req.body.url||'');if(!isCsdnUrl(source))throw new Error('请输入 CSDN 文章详情链接');
    let html=String(req.body.content||'');if(!html){const result=await fetchRestricted(source);html=result.buffer.toString('utf8');}
    const extracted=extractCsdnHtml(html,source);post=extracted.post;warnings.push(...extracted.warnings);
  }
  if(req.body.downloadImages!==false){const localized=await localizeImages(post,join(root,'.local/assets'));post=localized.post;warnings.push(...localized.warnings);}
  let draft;let duplicate=false;
  await store.update(state=>{
    const sourceId=csdnArticleId(post.source);
    const existing=sourceId?state.drafts.find(d=>csdnArticleId(d.source)===sourceId):null;
    if(existing){draft=existing;duplicate=true;return;}
    draft={...post,id:randomUUID(),updatedAt:new Date().toISOString(),importWarnings:warnings};state.drafts.unshift(draft);
  });
  res.json({draft,duplicate,warnings,message:duplicate?'该来源已导入，保留已有草稿，未覆盖本地修改。':'已导入本地草稿，请核对排版、日期与图片。'});
}));

app.post('/api/accounts',wrap(async(req,res)=>{
  const platform=String(req.body.platform||'');if(!platforms[platform])throw new Error('平台无效');
  const name=String(req.body.name||'').trim().slice(0,60);if(!name)throw new Error('请填写账号备注名');
  const account={id:randomUUID(),platform,name,createdAt:new Date().toISOString()};
  await store.update(s=>s.accounts.push(account));res.json(account);
}));
app.post('/api/accounts/:id/login',wrap(async(req,res)=>{const state=await store.read();const account=state.accounts.find(a=>a.id===req.params.id);if(!account)throw new Error('账号不存在');res.json(await openLogin(root,account));}));
app.delete('/api/accounts/:id',wrap(async(req,res)=>{await closeAccount(req.params.id);await store.update(s=>{s.accounts=s.accounts.filter(a=>a.id!==req.params.id);});res.json({deleted:true,message:'账号已移出工作台，浏览器会话目录保留在本机 .local/profiles，可自行删除。'});}));

// Durable queue: interrupted tasks are never silently called successful or retried.
await store.update(s=>{for(const job of s.jobs){if(['queued','running'].includes(job.status)){job.status='needs-verification';job.message='上次运行被中断，请核对平台编辑器和交付文件后再继续。';}}});
let queue=Promise.resolve();
app.post('/api/deliver',wrap(async(req,res)=>{
  const post=validatePost(req.body.post);const targets=[...new Set(req.body.accounts||[])];if(!targets.length)throw new Error('请至少选择一个目标账号');
  const mode=req.body.mode==='browser'?'browser':'package';const jobs=[];
  await store.update(s=>{
    for(const id of targets){const account=s.accounts.find(a=>a.id===id);if(!account)throw new Error('所选账号不存在');const hash=versionHash(post);
      const duplicate=s.jobs.find(j=>j.accountId===id&&j.hash===hash&&!['failed'].includes(j.status));
      if(duplicate){jobs.push({...duplicate,reused:true});continue;}
      const job={id:randomUUID(),accountId:id,accountName:account.name,platform:account.platform,title:post.title,hash,status:'queued',mode,createdAt:new Date().toISOString(),message:'等待准备分发内容',post};s.jobs.unshift(job);jobs.push(job);
    }
  });
  for(const job of jobs.filter(j=>!j.reused)){
    queue=queue.then(async()=>{
      try{
        await store.update(s=>{const j=s.jobs.find(j=>j.id===job.id);j.status='running';j.message='正在准备内容';});
        const {warnings}=await makeDelivery(root,job,post);let result={status:'prepared',message:'交付文件已生成，尚未向远端提交。'};
        if(mode==='browser'){const state=await store.read();const account=state.accounts.find(a=>a.id===job.accountId);if(!account)throw new Error('账号已删除');result=await prefillEditor(root,account,post);}
        await store.update(s=>{const j=s.jobs.find(j=>j.id===job.id);Object.assign(j,result,{warnings,updatedAt:new Date().toISOString()});});
      }catch(error){await store.update(s=>{const j=s.jobs.find(j=>j.id===job.id);j.status='failed';j.message=error.message;j.updatedAt=new Date().toISOString();});}
    }).catch(error=>console.error('分发队列错误：',error.message));
  }
  res.json({jobs:jobs.map(({post,...j})=>j),message:'任务已创建；请查看每个账号的实际状态。'});
}));
app.post('/api/jobs/:id/retry',wrap(async(req,res)=>{
  let job;await store.update(s=>{job=s.jobs.find(j=>j.id===req.params.id);if(!job)throw new Error('任务不存在');if(['queued','running','confirmed-by-author'].includes(job.status))throw new Error('当前状态不能重试');if(req.body.confirmed!==true)throw new Error('请先核对远端，确认不会重复发布');job.status='failed';job.message='作者已检查远端，允许重新准备';});
  res.json({post:job.post,accountId:job.accountId,mode:job.mode,message:'可重新创建分发任务'});
}));
app.post('/api/jobs/:id/confirm',wrap(async(req,res)=>{
  let result;await store.update(s=>{const job=s.jobs.find(j=>j.id===req.params.id);if(!job)throw new Error('任务不存在');if(['queued','running'].includes(job.status))throw new Error('请等待任务执行结束');const remoteUrl=validateRemoteLink(job.platform,String(req.body.url||''));Object.assign(job,{status:'confirmed-by-author',remoteUrl,message:'作者已填写并确认远端文章地址；系统未独立验证远端可见性。',confirmedAt:new Date().toISOString()});result=job;});res.json(result);
}));
app.get('/api/jobs/:id/files/:name',wrap(async(req,res)=>{
  if(!idValid(req.params.id)||!['article.md','article.html','manifest.json','article.zip'].includes(req.params.name))return res.status(404).json({error:'文件不存在'});
  const path=join(root,'.local/deliveries',req.params.id,req.params.name);await access(path);res.type(req.params.name.endsWith('.zip')?'application/zip':req.params.name.endsWith('.html')?'text/plain':req.params.name.endsWith('.json')?'application/json':'text/markdown');res.send(await readFile(path));
}));
app.post('/api/extension-handoff',wrap(async(req,res)=>{
  const state=await store.read();const job=state.jobs.find(j=>j.id===req.body.jobId);if(!job)throw new Error('任务不存在');
  handoff ||= await createHandoffServer(root);
  res.json({url:handoff.create(job.post),message:'文章已交给隔离页面；未确认远端发布。'});
}));
app.use('/api',(_req,res)=>res.status(404).json({error:'API 地址不存在'}));
app.use((err,_req,res,_next)=>res.status(err.type==='entity.too.large'?413:400).json({error:err.type==='entity.too.large'?'输入文件超过 8 MB 限制':err.message||'操作失败'}));

const server=app.listen(port,'127.0.0.1',()=>{port=server.address().port;host=`127.0.0.1:${port}`;origin=`http://${host}`;console.log(`\n山外山 · 本地创作台\n\n${origin}/#token=${token}\n\n草稿与账号会话保存在 .local/，请勿提交此目录。\nCtrl+C 停止工作台。\n`);});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，可设置 STUDIO_PORT 使用其他端口。`:error.message);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await closeBrowsers();handoff?.close();server.close(()=>process.exit(0));});
