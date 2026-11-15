import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderMarkdown } from './content.mjs';

// Third-party SDK runs on a separate origin with only one explicitly shared post.
// It never receives the studio session, account list, or browser-profile data.
export async function createHandoffServer(root){
  const handoffs=new Map();let port;
  const server=createServer(async(req,res)=>{
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);res.end('Forbidden');return;}
    const parts=new URL(req.url,`http://127.0.0.1:${port}`).pathname.split('/').filter(Boolean);const entry=handoffs.get(parts[1]);
    if(req.method!=='GET'||parts[0]!=='handoff'||!entry||Date.now()-entry.time>30*60_000){res.writeHead(404);res.end('同步页面已过期，请在创作台重新转交。');return;}
    if(parts[2]==='assets'&&/^[a-f0-9]{24}\.(png|jpg|gif|webp|avif)$/.test(parts[3]||'')){
      const file=parts[3];for(const dir of ['.local/assets','src/assets/imported']){try{const bytes=await readFile(join(root,dir,file));res.setHeader('Content-Type',({'png':'image/png','jpg':'image/jpeg','gif':'image/gif','webp':'image/webp','avif':'image/avif'})[file.split('.').pop()]);res.end(bytes);return;}catch{}}res.writeHead(404);res.end();return;
    }
    if(parts.length!==2){res.writeHead(404);res.end();return;}
    const content=renderMarkdown(entry.post.body.replace(/(?:\/?images\/imported\/|\.\.\/\.\.\/assets\/imported\/)([a-f0-9]{24}\.(?:png|jpg|gif|webp|avif))/g,(_m,file)=>`http://127.0.0.1:${port}/handoff/${parts[1]}/assets/${file}`));
    const payload=JSON.stringify({title:entry.post.title,desc:entry.post.description,content,thumb:/^https:/.test(entry.post.cover)?entry.post.cover:''}).replaceAll('<',String.fromCharCode(92)+'u003c');
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文章同步交付 · 山外山</title><style>body{max-width:760px;margin:60px auto;padding:24px;background:#f5f3ed;color:#283a32;font:15px/1.9 system-ui}h1{font-family:serif}button{padding:12px 24px;background:#283a32;color:#f5f3ed;border:0;cursor:pointer}#status{color:#846447}article{margin-top:35px;border-top:1px solid #ccd3c5;padding-top:25px}img{max-width:100%}pre{overflow:auto}small{color:#727d70}</style><h1>将这段文字，交给同步助手。</h1><p>此页面只接收你选择的文章。需要本机安装兼容版本的 Wechatsync 扩展。平台兼容性、账号与最终发布结果请在扩展和平台中核对。</p><button id="sync">加载同步助手并转交文章 ↗</button><p id="status" role="status"></p><small>页面 30 分钟后过期；此页面与本地创作台处于不同端口，不共享创作台会话密钥。</small><article id="preview"></article><script>const article=${payload};document.querySelector('#preview').innerHTML=article.content;document.querySelector('#sync').onclick=async()=>{const button=document.querySelector('#sync');const status=document.querySelector('#status');button.disabled=true;status.textContent='正在加载上游网页 SDK……';try{if(!window.syncPost){const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/gh/wechatsync/article-syncjs@latest/dist/styles.css';document.head.append(css);await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/wechatsync/article-syncjs@latest/dist/main.js';s.onload=resolve;s.onerror=()=>reject(new Error('无法加载 SDK，请检查网络，或从交付文件手动发布。'));document.head.append(s);});}if(typeof window.syncPost!=='function')throw new Error('当前 SDK 未提供 syncPost 接口，需检查上游兼容性。');window.syncPost(article);status.textContent='已调用同步助手，请在其窗口选择账号并核对任务。本地创作台未收到发布完成回执。';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};<\/script></html>`);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});port=server.address().port;
  const timer=setInterval(()=>{for(const [key,value]of handoffs)if(Date.now()-value.time>30*60_000)handoffs.delete(key);},60_000);timer.unref();
  return{create(post){const id=randomBytes(24).toString('hex');handoffs.set(id,{post,time:Date.now()});return`http://127.0.0.1:${port}/handoff/${id}`;},close(){clearInterval(timer);server.close();}};
}
