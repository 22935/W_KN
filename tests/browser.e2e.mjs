import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, cp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium } from 'playwright';
import {readdir} from 'node:fs/promises';
import matter from 'gray-matter';

const project=fileURLToPath(new URL('../',import.meta.url));
const builtHome=await readFile(join(project,'dist/index.html'),'utf8');
const base=process.env.E2E_BASE_PATH||new URL(builtHome.match(/<link rel="canonical" href="([^"]+)/)[1]).pathname;
const publicPosts=await Promise.all((await readdir(join(project,'src/content/posts'))).filter(f=>f.endsWith('.md')).map(async file=>{const {data}=matter(await readFile(join(project,'src/content/posts',file),'utf8'));return{id:file.slice(0,-3),...data};}));
const primaryCategory=publicPosts[0].category;
const primaryPost=publicPosts.find(p=>p.title.includes('PyTorch'))||publicPosts[0];
const searchWord=primaryPost.title.includes('PyTorch')?'PyTorch':primaryPost.title.slice(0,4);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ0kAAAAASUVORK5CYII=','base64');

test('浏览器端到端验收：博客与独立本地工作台',{timeout:180000},async t=>{
  const root=await mkdtemp(join(tmpdir(),'wkn-browser-'));
  await cp(join(project,'studio/web'),join(root,'studio/web'),{recursive:true});
  await cp(join(project,'public'),join(root,'public'),{recursive:true});
  await cp(join(project,'docs/examples/posts'),join(root,'src/content/posts'),{recursive:true});
  const child=spawn(process.execPath,[join(project,'studio/server.mjs')],{env:{...process.env,STUDIO_PORT:'0',WKN_PROJECT_ROOT:root},stdio:['ignore','pipe','pipe']});
  const app=express();app.use(base,express.static(join(project,'dist')));const web=await new Promise(r=>{const server=app.listen(0,'127.0.0.1',()=>r(server));});
  const blog=`http://127.0.0.1:${web.address().port}${base}`;
  let browser;let context;
  t.after(async()=>{await context?.close();await browser?.close();web.close();child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);setTimeout(r,3000).unref();});assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));assert.ok(root.includes('wkn-browser-'));await rm(root,{recursive:true,force:true});});
  const studio=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Studio 启动超时')),15000);child.stdout.on('data',data=>{output+=data;const m=output.match(/(http:\/\/127\.0\.0\.1:\d+)\/#token=([a-f0-9]+)/);if(m){clearTimeout(timeout);resolve({origin:m[1],token:m[2]});}});child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Studio 启动失败：${code}`));});child.stderr.on('data',data=>output+=data);});
  try{browser=await chromium.launch({headless:true,channel:'chrome'});}catch{browser=await chromium.launch({headless:true});}
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await mkdir(join(project,'test-results'),{recursive:true});
  await t.test('首页、分类和主题持久化',async()=>{
    await page.goto(blog);assert.match(await page.title(),/山外山/);
    await page.locator('[data-category]').filter({hasText:primaryCategory}).click();assert.equal(await page.locator('[data-post-category]:visible').count(),Math.min(6,publicPosts.filter(p=>p.category===primaryCategory).length));
    await page.locator('[data-category="all"]').click();await page.locator('.theme-toggle').click();const theme=await page.locator('html').getAttribute('data-theme');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    await page.evaluate(()=>{document.documentElement.dataset.theme='light';localStorage.setItem('wkn-theme','light');});
    await page.screenshot({path:join(project,'test-results/blog-desktop.png'),fullPage:true});
  });
  await t.test('静态全文搜索、Esc 关闭和文章跳转',async()=>{
    await page.locator('#search-open').click();await page.locator('#search-input').fill(searchWord);await page.locator('.search-result').first().waitFor();assert.ok((await page.locator('.search-result').count())>=1);
    const href=await page.locator('.search-result').first().getAttribute('href');assert.ok(href.includes(base));
    await page.keyboard.press('Escape');assert.equal(await page.locator('#search-dialog').evaluate(d=>d.open),false);
    await page.goto(new URL(href,blog).href);assert.equal(await page.locator('article h1').count(),1);assert.ok((await page.locator('.toc a').count())>1);
    const anchor=await page.locator('.toc a').first().getAttribute('href');assert.ok(await page.evaluate(hash=>!!document.getElementById(decodeURIComponent(hash.slice(1))),anchor));
    assert.ok((await page.locator('pre code').count())>0);
    assert.ok((await page.locator('pre code span[style]').count())>0,'代码高亮应保留样式');
    await context.grantPermissions(['clipboard-read','clipboard-write']);await page.locator('.copy-code').first().click();
    await page.waitForFunction(()=>document.querySelector('.copy-code')?.textContent==='已复制');
    assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),await page.locator('pre code').first().innerText());
  });
  await t.test('手机宽度、减少动效与页面导航',async()=>{
    await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'});
    for(const path of ['', 'journal/', 'archive/', 'about/', `posts/${primaryPost.id}/`, 'studio/']){await page.goto(blog+path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} 不应出现横向溢出`);}
    await page.goto(blog+'journal/?category='+encodeURIComponent(primaryCategory));assert.equal(await page.locator('.filter-post:visible').count(),Math.min(9,publicPosts.filter(p=>p.category===primaryCategory).length));
    await page.goto(blog);await page.screenshot({path:join(project,'test-results/blog-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
  });
  await t.test('本地 Markdown 编辑、图片上传、私有保存与写入公开目录',async()=>{
    await page.goto(`${studio.origin}/#token=${studio.token}`);await page.waitForFunction(()=>document.querySelector('#post-count')?.textContent==='6');
    await page.screenshot({path:join(project,'test-results/studio-desktop.png'),fullPage:true});
    await page.locator('#new-post').click();await page.locator('[name="title"]').fill('浏览器验收文章');await page.locator('[name="description"]').fill('本地工具完整流程验证');await page.locator('#body-editor').fill('## 测试标题\n\n这是本地草稿中的私有正文。');
    await page.locator('#editor-image').setInputFiles({name:'small.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>document.querySelector('#body-editor').value.includes('/images/imported/'));
    await page.locator('#save-draft').click();await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.includes('已保存'));
    assert.ok((await readFile(join(root,'.local/state.json'),'utf8')).includes('私有正文'));
    await page.locator('#write-public').click();await page.locator('#confirm-dialog button[value="confirm"]').click();await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.includes('已写入博客仓库'));
    await page.locator('[data-view="overview"]').click();await page.locator('[data-list="posts"]').click();await page.waitForFunction(()=>document.querySelector('#article-list').textContent.includes('浏览器验收文章'));assert.ok((await page.locator('#article-list').innerText()).includes('浏览器验收文章'));
  });
  await t.test('CSDN HTML 导入和重复来源保留已有草稿',async()=>{
    await page.locator('[data-view="imports"]').click();await page.locator('#download-images').uncheck();await page.locator('#html-source').fill('https://blog.csdn.net/test/article/details/123456');
    const html='<h1 id="articleContentId">浏览器迁移验收</h1><div class="article-info-box"><span class="time">2024-06-01 12:00</span></div><div id="content_views"><h2>迁移标题</h2><p>这是一段足够长的 CSDN 测试正文，用来验证导入页面。</p></div>';
    await page.locator('#import-files').setInputFiles({name:'saved.html',mimeType:'text/html',buffer:Buffer.from(html)});await page.waitForFunction(()=>document.querySelectorAll('.report-item').length===1);
    assert.match(await page.locator('#import-reports').innerText(),/已导入/);
    await page.locator('#import-files').setInputFiles({name:'saved.html',mimeType:'text/html',buffer:Buffer.from(html)});await page.waitForFunction(()=>document.querySelectorAll('.report-item').length===2);assert.match(await page.locator('.report-item').first().innerText(),/已存在/);
  });
  await t.test('同平台两个账号与批量分发、版本去重',async()=>{
    await page.locator('[data-view="accounts"]').click();for(const name of ['验收账号甲','验收账号乙']){await page.locator('#add-account').click();await page.locator('#account-form [name="name"]').fill(name);await page.locator('#account-form [type="submit"]').click();await page.waitForFunction(name=>[...document.querySelectorAll('.account-card h3')].some(el=>el.textContent===name),name);}
    assert.equal(await page.locator('.account-card').count(),2);
    await page.locator('[data-view="deliveries"]').click();await page.locator('#delivery-post').selectOption({label:'[草稿] 浏览器迁移验收'});for(const input of await page.locator('#delivery-targets input').all())await input.check();await page.locator('#create-delivery').click();await page.waitForFunction(()=>document.querySelectorAll('.job-card').length===2);
    await page.waitForFunction(()=>[...document.querySelectorAll('.job-card .badge')].every(el=>el.textContent==='交付文件已准备'),{timeout:15000});
    await page.locator('#create-delivery').click();await page.waitForTimeout(400);assert.equal(await page.locator('.job-card').count(),2);
  });
  await t.test('第三方 SDK 交付在独立端口且不会自动标记发布',async()=>{
    const response=await page.evaluate(async()=>{const state=await(await fetch('/api/state',{headers:{Authorization:'Bearer '+sessionStorage.getItem('wkn-session')}})).json();const result=await(await fetch('/api/extension-handoff',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('wkn-session'),'Content-Type':'application/json'},body:JSON.stringify({jobId:state.jobs[0].id})})).json();return result;});
    const handoff=await context.newPage();await handoff.route('**/wechatsync/article-syncjs@latest/dist/main.js',route=>route.fulfill({contentType:'application/javascript',body:'window.syncPost=(article)=>{window.testArticle=article}'}));await handoff.route('**/wechatsync/article-syncjs@latest/dist/styles.css',route=>route.fulfill({contentType:'text/css',body:''}));
    await handoff.goto(response.url);assert.notEqual(new URL(response.url).port,new URL(studio.origin).port);assert.ok(!(await handoff.content()).includes(studio.token));await handoff.locator('#sync').click();await handoff.waitForFunction(()=>window.testArticle?.title==='浏览器迁移验收');assert.match(await handoff.locator('#preview').innerText(),/迁移标题/);await handoff.close();
    assert.equal(await page.locator('.job-card .badge.success').count(),0);
  });
  await t.test('工作台手机布局与页面脚本无异常',async()=>{
    await page.setViewportSize({width:375,height:812});for(const view of ['overview','imports','accounts','deliveries']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,view+' 不应横向溢出');}
    assert.deepEqual(errors,[]);
  });
});
