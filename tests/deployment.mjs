import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import express from 'express';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const marker=randomUUID().replaceAll('-','');const secret=`PRIVATE-DRAFT-${marker}`;
const id=`deployment-check-${marker}`;const draft=join(root,'src/content/posts',`${id}-private.md`);const article=join(root,'src/content/posts',`${id}.md`);
const assetDirectory=join(root,'src/assets/imported');await mkdir(assetDirectory,{recursive:true});
const asset=join(assetDirectory,`${marker}.png`);
const npm=process.env.npm_execpath;if(!npm)throw new Error('请通过 npm run test:deployment 运行');
const runBuild=env=>{const result=spawnSync(process.execPath,[npm,'run','build'],{cwd:root,env:{...process.env,...env},stdio:'inherit'});if(result.status!==0)throw new Error('部署验证构建失败');};
let browser,web;
try{
  // A tiny valid transparent PNG exercises Astro's real image pipeline.
  await writeFile(asset,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ0kAAAAASUVORK5CYII=','base64'));
  await writeFile(draft,`---\ntitle: ${secret}\ndescription: ${secret}\ndate: 2026-11-14\ndraft: true\n---\n${secret}`);
  await writeFile(article,`---\ntitle: 部署资源验证\ndescription: 临时部署验收内容\ndate: 2026-11-14\n---\n\n## 资源路径\n\n![测试图片](../../assets/imported/${marker}.png)\n\n<script>window.INJECTED_BY_POST=true</script>\n\n$E=mc^2$`);
  runBuild({BASE_PATH:'/deployment-check/',SITE_URL:'https://example.github.io'});
  const index=await readFile(join(root,'dist/index.html'),'utf8');assert.ok(index.includes('/deployment-check/images/mountains.svg'));assert.ok(!index.includes(secret));
  const rss=await readFile(join(root,'dist/rss.xml'),'utf8');assert.ok(!rss.includes(secret));
  const map=await readFile(join(root,'dist/sitemap-0.xml'),'utf8');assert.ok(!map.includes(`${id}-private`));
  const app=express();app.use('/deployment-check',express.static(join(root,'dist')));web=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
  try{browser=await chromium.launch({headless:true,channel:'chrome'});}catch{browser=await chromium.launch({headless:true});}
  const page=await browser.newPage();const origin=`http://127.0.0.1:${web.address().port}`;
  await page.goto(`${origin}/deployment-check/posts/${id}/`);
  const image=page.locator('.prose img');await image.waitFor();await page.waitForFunction(()=>document.querySelector('.prose img')?.complete);
  assert.ok(await image.evaluate(img=>img.naturalWidth>0),'迁移图片在仓库子路径应加载');assert.equal(await page.evaluate(()=>window.INJECTED_BY_POST),undefined,'Markdown 原始脚本应被清理');assert.ok(await page.locator('.katex').count());
  await page.locator('#search-open').click();await page.locator('#search-input').fill('部署资源验证');await page.locator('.search-result').first().waitFor();
  const href=await page.locator('.search-result').first().getAttribute('href');assert.ok(href.startsWith('/deployment-check/'),'搜索结果应包含仓库子路径');
  await page.locator('#search-input').fill(`"${secret}"`);await page.waitForFunction(()=>!document.querySelector('#search-results').textContent.includes('正在寻找'));
  const resultText=await page.locator('#search-results').innerText();assert.match(resultText,/没有找到/,'不应检索到私有草稿');
  console.log('\n部署验收通过：仓库子路径、实际图片渲染、公式、文章脚本清理、搜索链接与草稿隔离。\n');
}finally{
  await browser?.close();web?.close();
  for(const path of [draft,article,asset])await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});
  runBuild({});
}
