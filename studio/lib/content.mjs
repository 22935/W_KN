import matter from 'gray-matter';
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import { createHash } from 'node:crypto';

export function validatePost(input) {
  if (!input || typeof input !== 'object') throw new Error('文章数据格式不正确');
  const title=String(input.title || '').trim();
  if (!title || title.length>200) throw new Error('标题须为 1–200 个字符');
  const body=String(input.body || '');
  if (body.length>2_000_000) throw new Error('文章正文不能超过 200 万个字符');
  const date=String(input.date || new Date().toISOString().slice(0,10)).slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) throw new Error('发布日期无效');
  const tags=Array.isArray(input.tags)?input.tags.map(String).map(t=>t.trim()).filter(Boolean).slice(0,20):[];
  const source=String(input.source||'');
  if(source&&!isCsdnUrl(source))throw new Error('来源仅接受 CSDN 文章链接');
  const cover=String(input.cover||'').trim();
  if(cover&&!/^images\/[a-zA-Z0-9_./-]+$/.test(cover)&&!/^https:\/\//.test(cover))throw new Error('封面须为 images/ 下的资源或 HTTPS 图片');
  if(cover.includes('..'))throw new Error('封面路径无效');
  return {title,body,date,description:String(input.description||'').trim().slice(0,500),category:String(input.category||'随笔手记').trim().slice(0,60)||'随笔手记',tags,cover,source,sample:input.sample===true,featured:input.featured===true};
}

export function isCsdnUrl(value) {
  try {const u=new URL(value);return u.protocol==='https:'&&u.hostname==='blog.csdn.net'&&!u.port&&!u.username&&!u.password&&/^\/[\w-]+\/article\/details\/\d+\/?$/.test(u.pathname);}catch{return false;}
}
export function csdnArticleId(value) {if(!isCsdnUrl(value))return null;return new URL(value).pathname.match(/\/details\/(\d+)/)?.[1]||null;}

export function slugify(value) {return String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'untitled';}
export function versionHash(post) {return createHash('sha256').update(JSON.stringify(validatePost(post))).digest('hex').slice(0,16);}
export function postMarkdown(input) {
  const post=validatePost(input);const {body,cover,source,...meta}=post;
  return matter.stringify(body,{...meta,...(cover?{cover}:{}),...(source?{source}:{}),draft:false});
}
export function parseMarkdown(text,fallbackTitle='') {
  const {data,content}=matter(text);
  const title=data.title||content.match(/^#\s+(.+)$/m)?.[1]||String(fallbackTitle).replace(/\.(md|markdown)$/i,'');
  return validatePost({...data,title,date:data.date instanceof Date?data.date.toISOString().slice(0,10):data.date,body:content});
}
export function renderMarkdown(markdown) {
  return sanitizeHtml(marked.parse(String(markdown||''),{async:false}),{
    allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','h1','h2','h3','h4','h5','h6','del','input'],
    allowedAttributes:{...sanitizeHtml.defaults.allowedAttributes,a:['href','title'],img:['src','alt','title','width','height'],code:['class'],input:['type','checked','disabled']},
    allowedSchemes:['http','https','mailto'],
    transformTags:{input:()=>({tagName:'input',attribs:{type:'checkbox',disabled:'disabled'}}),a:sanitizeHtml.simpleTransform('a',{target:'_blank',rel:'noopener noreferrer'})},
  });
}
