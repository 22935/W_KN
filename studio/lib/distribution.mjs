import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile, access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validatePost, postMarkdown, renderMarkdown, versionHash } from './content.mjs';
import { zipSync } from 'fflate';

export const platforms={
  csdn:{name:'CSDN',home:'https://mp.csdn.net/',editor:'https://editor.csdn.net/md/',hosts:['blog.csdn.net'],title:['input[placeholder*="文章标题"]','input[placeholder*="标题"]'],body:['textarea[placeholder*="内容"]','.CodeMirror textarea','textarea']},
  juejin:{name:'掘金',home:'https://juejin.cn/',editor:'https://juejin.cn/editor/drafts/new?v=2',hosts:['juejin.cn'],title:['input[placeholder*="文章标题"]','input[placeholder*="标题"]'],body:['.bytemd textarea','.CodeMirror textarea','textarea']},
  zhihu:{name:'知乎',home:'https://www.zhihu.com/',editor:'https://zhuanlan.zhihu.com/write',hosts:['zhuanlan.zhihu.com','www.zhihu.com'],title:['textarea[placeholder*="标题"]','input[placeholder*="标题"]'],body:['[contenteditable="true"][role="textbox"]','.DraftEditor-editorContainer [contenteditable="true"]']},
  wechat:{name:'微信公众号',home:'https://mp.weixin.qq.com/',editor:'https://mp.weixin.qq.com/',hosts:['mp.weixin.qq.com'],title:[],body:[]},
};

const contexts=new Map();const pending=new Map();
export async function accountBrowser(root,account){
  if(contexts.has(account.id))return contexts.get(account.id);
  if(pending.has(account.id))return pending.get(account.id);
  const opening=(async()=>{
    const profile=join(root,'.local/profiles',account.id);await mkdir(profile,{recursive:true});
    let context;try{context=await chromium.launchPersistentContext(profile,{headless:false,channel:'chrome',viewport:{width:1280,height:850}});}catch{
      try{context=await chromium.launchPersistentContext(profile,{headless:false,viewport:{width:1280,height:850}});}catch{throw new Error('无法启动浏览器。请安装 Chrome，或运行 npx playwright install chromium 后重试');}
    }
    contexts.set(account.id,context);context.on('close',()=>contexts.delete(account.id));return context;
  })();pending.set(account.id,opening);try{return await opening;}finally{pending.delete(account.id);}
}
export async function closeAccount(id){const context=contexts.get(id);if(context)await context.close();}
export async function closeBrowsers(){await Promise.allSettled([...contexts.values()].map(c=>c.close()));}
export async function openLogin(root,account){const context=await accountBrowser(root,account);const page=context.pages()[0]||await context.newPage();await page.goto(platforms[account.platform].home,{waitUntil:'domcontentloaded',timeout:45000});return{status:'login-window-opened',message:'已打开独立账号窗口，请在该窗口登录。系统不会自动判定登录成功。'};}

export async function makeDelivery(root,job,post){
  const directory=join(root,'.local/deliveries',job.id);await mkdir(directory,{recursive:true});
  let body=post.body;const warnings=[];
  const pattern=/(?:\/?images\/imported\/|\.\.\/\.\.\/assets\/imported\/)([a-f0-9]{24}\.(?:png|jpg|gif|webp|avif))/g;
  const filenames=[...new Set([...body.matchAll(pattern)].map(m=>m[1]))];
  for(const file of filenames){
    await mkdir(join(directory,'assets'),{recursive:true});let copied=false;
    for(const path of [join(root,'.local/assets',file),join(root,'src/assets/imported',file)]){try{await access(path);await copyFile(path,join(directory,'assets',file));copied=true;break;}catch{}}
    if(!copied)warnings.push(`本地图片缺失：${file}`);
  }
  body=body.replace(pattern,(_all,file)=>`assets/${file}`);
  await writeFile(join(directory,'article.md'),postMarkdown({...post,body}));
  const html=renderMarkdown(body);
  await writeFile(join(directory,'article.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(post.title)}</title><style>body{max-width:760px;margin:50px auto;padding:20px;font:17px/1.9 system-ui}img{max-width:100%}pre{overflow:auto;background:#f1f2ed;padding:20px}</style><h1>${escapeHtml(post.title)}</h1>${html}</html>`);
  await writeFile(join(directory,'manifest.json'),JSON.stringify({jobId:job.id,accountId:job.accountId,platform:job.platform,version:versionHash(post),state:'prepared',warnings,notice:'文件准备完成不代表远端已保存或发布。'},null,2));
  const entries={};for(const name of ['article.md','article.html','manifest.json'])entries[name]=await readFile(join(directory,name));
  if(filenames.length)for(const file of await readdir(join(directory,'assets')))entries[`assets/${file}`]=await readFile(join(directory,'assets',file));
  await writeFile(join(directory,'article.zip'),zipSync(entries,{level:6}));
  return{warnings,files:['article.md','article.html','manifest.json','article.zip'],hasLocalImages:filenames.length>0};
}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function prefillEditor(root,account,input){
  const post=validatePost(input);const platform=platforms[account.platform];const context=await accountBrowser(root,account);const page=await context.newPage();
  await page.goto(platform.editor,{waitUntil:'domcontentloaded',timeout:45000});
  if(account.platform==='wechat')return{status:'needs-manual',message:'微信公众号编辑页依赖登录后的动态地址，已打开独立账号窗口。请使用交付文件或 Wechatsync 接续。'};
  let titleFilled=false;for(const selector of platform.title){try{const input=page.locator(selector).first();await input.waitFor({state:'visible',timeout:2500});await input.fill(post.title,{timeout:4000});titleFilled=true;break;}catch{}}
  if(!titleFilled)return{status:'needs-manual',message:'未找到标题输入框，可能尚未登录或平台界面发生变化。窗口已保留，请登录后重试或使用交付文件。'};
  let contentFilled=false;
  if(account.platform!=='zhihu'){
    contentFilled=await page.evaluate(body=>{const el=document.querySelector('.CodeMirror');if(el?.CodeMirror){el.CodeMirror.setValue(body);return true;}return false;},post.body);
  }
  if(!contentFilled){for(const selector of platform.body){try{const editor=page.locator(selector).first();await editor.waitFor({state:'visible',timeout:1500});if(account.platform==='zhihu'){await editor.evaluate((el,html)=>{el.focus();const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.execCommand('insertHTML',false,html);},renderMarkdown(post.body));}else{await editor.fill(post.body,{timeout:5000});}contentFilled=true;break;}catch{}}}
  const localImages=/!\[[^\]]*\]\((?!https?:)/.test(post.body);
  return{status:'needs-review',message:contentFilled?`标题与正文已填入浏览器，尚未保存或发布。请检查排版${localImages?'、重新上传本地图片':''}并在平台完成后续操作。`:'已填入标题；正文编辑器未能自动识别，请从交付文件复制正文。没有自动保存或发布。'};
}

export function validateRemoteLink(platform,value){
  let url;try{url=new URL(value);}catch{throw new Error('请输入完整的 HTTPS 发布地址');}
  if(url.protocol!=='https:'||url.port||url.username||url.password||!platforms[platform]?.hosts.includes(url.hostname))throw new Error('发布地址与目标平台不匹配');
  if(url.pathname==='/'||/login|signin|editor|draft|write/i.test(url.pathname))throw new Error('请输入最终文章地址，而不是登录或编辑页面');
  if(platform==='csdn'&&!/^\/[\w-]+\/article\/details\/\d+\/?$/.test(url.pathname))throw new Error('请输入 CSDN 文章详情地址');
  if(platform==='juejin'&&!/^\/post\/\d+\/?$/.test(url.pathname))throw new Error('请输入掘金文章地址');
  return url.href;
}
