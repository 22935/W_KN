import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isCsdnUrl, validatePost } from './content.mjs';

const articleHosts=new Set(['blog.csdn.net']);
const imageHosts=new Set(['img-blog.csdnimg.cn','i-blog.csdnimg.cn','img-blog.csdn.net']);
export function allowedRemote(value,kind='article') {
  try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(kind==='image'?imageHosts:articleHosts).has(u.hostname);}catch{return false;}
}

export async function fetchRestricted(url,kind='article'){
  let current=url;
  for(let i=0;i<4;i++){
    if(!allowedRemote(current,kind))throw new Error('请求地址不在 CSDN 允许域名内');
    const response=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(20_000),headers:{'User-Agent':'Mozilla/5.0 (compatible; WKNPersonalBlog/1.0)','Referer':'https://blog.csdn.net/'}});
    if([301,302,303,307,308].includes(response.status)){current=new URL(response.headers.get('location'),current).href;continue;}
    if(!response.ok)throw new Error(`CSDN 返回 HTTP ${response.status}，可改用浏览器保存的 HTML 或 Markdown 导入`);
    const limit=kind==='image'?12_000_000:5_000_000;
    if(Number(response.headers.get('content-length'))>limit)throw new Error('远端文件过大');
    const reader=response.body.getReader();const chunks=[];let length=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw new Error('远端文件超过大小限制');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
    return{buffer:Buffer.concat(chunks),type:response.headers.get('content-type')||'',url:current};
  }
  throw new Error('远端重定向次数过多');
}

export function extractCsdnHtml(html,source){
  if(!isCsdnUrl(source))throw new Error('请输入有效的 HTTPS CSDN 文章地址');
  const $=cheerio.load(html);const article=$('#content_views').first();
  if(!article.length||article.text().trim().length<10)throw new Error('没有识别到 CSDN 正文，可能需要登录或人工验证；可导入自己保存的完整 HTML');
  const title=$('#articleContentId').text().trim()||$('h1.title-article').text().trim()||$('meta[property="og:title"]').attr('content')||$('title').text().replace(/[-_]CSDN博客.*$/,'').trim();
  if(!title)throw new Error('没有识别到文章标题');
  article.find('script,style,iframe,form,button,.hljs-button,.hide-article-box,.blog-extension-box').remove();
  article.find('pre').each((_,pre)=>{$(pre).find('.hljs-ln-numbers,.line-numbers-rows').remove();const lines=$(pre).find('td.hljs-ln-code');if(lines.length){const text=lines.map((_,el)=>$(el).text()).get().join('\n');$(pre).empty().append($('<code>').text(text));}});
  article.find('img').each((_,img)=>{const el=$(img);const src=el.attr('data-src')||el.attr('src');if(src)try{el.attr('src',new URL(src,source).href);}catch{};});
  const headingDepths=article.find('h1,h2,h3,h4,h5,h6').map((_,el)=>Number(el.tagName.slice(1))).get();
  const firstDepth=headingDepths.length?Math.min(...headingDepths):2;
  if(firstDepth!==2)article.find('h1,h2,h3,h4,h5,h6').each((_,el)=>{const depth=Math.min(6,Number(el.tagName.slice(1))+2-firstDepth);$(el).replaceWith($(`<h${depth}>`).html($(el).html()||''));});
  const turndown=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});turndown.use(gfm);
  turndown.addRule('csdn-formula-images',{filter:node=>node.nodeName==='IMG'&&/^https:\/\/latex\.csdn\.net\/eq\?/.test(node.getAttribute('src')||''),replacement:(_content,node)=>{try{const tex=decodeURIComponent(new URL(node.getAttribute('src')).search.slice(1));return `$${tex}$`;}catch{return node.getAttribute('alt')||'';}}});
  turndown.addRule('csdn-math',{filter:node=>node.nodeName==='SPAN'&&/^(math|katex)$/.test(node.getAttribute('class')||''),replacement:(_content,node)=>{const tex=node.querySelector('annotation[encoding="application/x-tex"]')?.textContent||node.getAttribute('data-tex');return tex?`$${tex}$`:node.textContent;}});
  const body=turndown.turndown(article.html()||'');
  const dateText=$('meta[property="bytedance:published_time"]').attr('content')||$('meta[property="article:published_time"]').attr('content')||$('.article-info-box .time').text()||'';
  const match=dateText.match(/\d{4}[-/]\d{2}[-/]\d{2}/);
  const warnings=[];if(!match)warnings.push('未识别到原发布日期，请在编辑器中核对日期');
  const metaTags=($('meta[property="article:tag"]').attr('content')||$('meta[name="keywords"]').attr('content')||'').split(/[,，]/).map(t=>t.trim());
  const tags=[...new Set([...$('.tag-link').map((_,el)=>$(el).text().trim()).get(),...metaTags])].filter(Boolean).slice(0,20);
  const categoryBox=$('.blog-tags-box .tags-box').filter((_,el)=>$(el).text().includes('分类专栏')).first();
  const category=categoryBox.find('a').first().text().trim()||'技术探索';
  let structured;try{structured=JSON.parse($('script[type="application/ld+json"]').first().text());}catch{}
  const description=(structured?.description||$('meta[name="description"]').attr('content')||article.text().replace(/\s+/g,' ').slice(0,140)).replace(/^文章浏览阅读[\s\S]*?次。[\s]*/, '').trim();
  return{post:validatePost({title,body,date:match?match[0].replaceAll('/','-'):undefined,description,category,tags,source}),warnings};
}

export async function localizeImages(post,assetRoot,fetcher=fetchRestricted){
  const warnings=[];const replacements=new Map();
  const urls=[...new Set([...post.body.matchAll(/!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\s*\)/g)].map(m=>m[1]))];
  await mkdir(assetRoot,{recursive:true});
  for(const imageUrl of urls){
    if(!allowedRemote(imageUrl,'image')){warnings.push(`外部图片保留原链接，需人工检查：${imageUrl}`);continue;}
    try{
      const {buffer,type}=await fetcher(imageUrl,'image');
      const extension=({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/avif':'avif'})[type.split(';')[0]];
      if(!extension)throw new Error('图片格式不支持或返回了登录页');
      const filename=`${createHash('sha256').update(buffer).digest('hex').slice(0,24)}.${extension}`;
      await writeFile(join(assetRoot,filename),buffer);replacements.set(imageUrl,`/images/imported/${filename}`);
    }catch(error){warnings.push(`图片下载失败：${imageUrl}；${error.message}`);}
  }
  let body=post.body;for(const [from,to]of replacements)body=body.split(from).join(to);
  return{post:{...post,body},warnings,images:replacements.size};
}

export async function discoverCsdn(homepage){
  const u=new URL(homepage);if(!allowedRemote(homepage)||!/^\/[\w-]+\/?$/.test(u.pathname))throw new Error('请输入 CSDN 主页，例如 https://blog.csdn.net/用户名');
  const {buffer}=await fetchRestricted(u.href);const $=cheerio.load(buffer.toString('utf8'));const found=new Map();
  $('a[href]').each((_,el)=>{try{const href=new URL($(el).attr('href'),u).href.split('?')[0].split('#')[0];if(isCsdnUrl(href)&&new URL(href).pathname.split('/')[1]===u.pathname.split('/')[1])found.set(href,$(el).find('h4').text().trim()||$(el).text().trim().slice(0,150)||href);}catch{}});
  return [...found].map(([url,title])=>({url,title}));
}
