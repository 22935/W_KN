import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import * as cheerio from 'cheerio';
import {extractCsdnHtml,fetchRestricted,localizeImages} from '../studio/lib/import.mjs';
import {postMarkdown,csdnArticleId} from '../studio/lib/content.mjs';
import {createHash} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';

const root=resolve('.');const username=process.argv[2]||'Hismybestlove';
if(!/^[\w-]+$/.test(username))throw new Error('CSDN 用户名无效');
const dir=join(root,'.local/migration');await mkdir(dir,{recursive:true});await mkdir(join(root,'src/content/posts'),{recursive:true});
const report={username,startedAt:new Date().toISOString(),expected:null,pages:[],articles:[],images:0};
const discovered=new Map();const seenPages=new Set();const blocked=new Set();
const imageCache=new Map();
let accessRestricted=false;
async function cachedPage(url){
  const key=createHash('sha256').update(url).digest('hex').slice(0,24);const file=join(dir,`${key}.html`);
  try{return await readFile(file,'utf8');}catch{}
  if(accessRestricted||blocked.has(url))throw new Error('已遇到访问验证，批量读取已暂停，请在浏览器完成验证或导入本人导出文件');
  await pause(750);
  try{const {buffer}=await fetchRestricted(url);const html=buffer.toString('utf8');await writeFile(file,html);return html;}catch(error){blocked.add(url);if(/HTTP (401|403|429|521)/.test(error.message))accessRestricted=true;throw error;}
}
function collect(html){const $=cheerio.load(html);$('a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href'),`https://blog.csdn.net/${username}`);if(u.hostname!=='blog.csdn.net'||u.pathname.split('/')[1]?.toLowerCase()!==username.toLowerCase())return;const id=csdnArticleId(u.href);if(id&&!discovered.has(id))discovered.set(id,`https://blog.csdn.net/${username}/article/details/${id}`);}catch{}});return $;}
async function discovery(url){if(seenPages.has(url))return;seenPages.add(url);try{const html=await cachedPage(url);const $=collect(html);report.pages.push({url,status:'read'});return $;}catch(error){report.pages.push({url,status:'restricted',error:error.message});console.log('发现受限：',url,error.message);}}
const home=await discovery(`https://blog.csdn.net/${username}`);
const list=await discovery(`https://blog.csdn.net/${username}/article/list/1`);
const listHtml=list?.html()||'';report.expected=Number(listHtml.match(/var listTotal\s*=\s*(\d+)/)?.[1])||null;
const pageSize=Number(listHtml.match(/var pageSize\s*=\s*(\d+)/)?.[1])||40;
for(let page=2;page<=Math.min(20,Math.ceil((report.expected||40)/pageSize));page++){const $=await discovery(`https://blog.csdn.net/${username}/article/list/${page}`);if(!$)break;}
// Existing public category pages supplement the article list without circumventing a blocked page.
if(report.expected&&discovered.size<report.expected&&home){
  const categories=[...new Set(home('a[href*="category_"]').map((_,el)=>home(el).attr('href')).get())];
  for(const url of categories){await discovery(url);if(discovered.size>=report.expected)break;}
}
console.log(`已发现 ${discovered.size} 篇，列表标示 ${report.expected??'未知'} 篇。`);
await writeFile(join(dir,'all-urls.json'),JSON.stringify([...discovered.values()],null,2));
async function cachedImage(url,kind){
  if(!imageCache.has(url))imageCache.set(url,(async()=>{
    const key=createHash('sha256').update(url).digest('hex').slice(0,24);const filename=join(dir,`img-${key}`);
    try{return{buffer:await readFile(filename),...JSON.parse(await readFile(filename+'.json','utf8'))};}catch{}
    if(accessRestricted)throw new Error('访问受限，远程图片读取已暂停');
    await pause(300);
    try{const result=await fetchRestricted(url,kind);await writeFile(filename,result.buffer);await writeFile(filename+'.json',JSON.stringify({type:result.type}));return result;}catch(error){if(/HTTP (401|403|429|521)/.test(error.message))accessRestricted=true;throw error;}
  })());return imageCache.get(url);
}
const queue=[...discovered.entries()];let cursor=0;
async function worker(){while(cursor<queue.length){const [id,url]=queue[cursor++];const target=join(root,'src/content/posts',`csdn-${id}.md`);try{
  try{await access(target);report.articles.push({id,url,status:'existing'});continue;}catch{}
  const html=await cachedPage(url);collect(html);
  // Follow the author's public related-article links when pagination was unavailable.
  for(const [nextId,nextUrl]of discovered)if(!queue.some(([queued])=>queued===nextId))queue.push([nextId,nextUrl]);
  const extracted=extractCsdnHtml(html,url);const localized=await localizeImages(extracted.post,join(root,'src/assets/imported'),cachedImage);
  const warnings=[...extracted.warnings,...localized.warnings];
  const body=localized.post.body.replace(/\/?images\/imported\/([a-f0-9]{24}\.(?:png|jpg|gif|webp|avif))/g,(_m,file)=>`../../assets/imported/${file}`);
  const tags=localized.post.tags;const title=localized.post.title;
  const category=/深度学习|PyTorch|TensorFlow|监督学习|图像处理|神经网络|人工智能|机器学习|自然语言|大模型|提示词/.test(title+' '+tags.join(' '))?'人工智能':/JavaScript|JavaWeb|AJAX|前端|HTML|CSS|小程序|Vue|React/.test(title)?'前端开发':/JAVA|Java|Spring|后端|Maven|MyBatis|数据库|MySQL|JDBC|JVM/i.test(title)?'后端开发':/算法|数据结构|链表|二叉树|排序|刷题|栈|队列|蓝桥/.test(title)?'算法与数据结构':localized.post.category;
  await writeFile(target,postMarkdown({...localized.post,body,category,featured:id==='157842060'}));report.images+=localized.images;
  report.articles.push({id,url,title,status:'imported',date:localized.post.date,category,images:localized.images,warnings,characters:body.length});
  console.log(`[${report.articles.length}/${queue.length}] ${title} · 图片 ${localized.images} · 提示 ${warnings.length}`);
 }catch(error){report.articles.push({id,url,status:'failed',error:error.message});console.log('失败',id,error.message);}
 await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));
}}
await worker();report.finishedAt=new Date().toISOString();report.discovered=discovered.size;report.summary={imported:report.articles.filter(a=>a.status==='imported').length,existing:report.articles.filter(a=>a.status==='existing').length,failed:report.articles.filter(a=>a.status==='failed').length,images:report.images};
await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
