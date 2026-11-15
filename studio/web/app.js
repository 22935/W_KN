const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const fragment=new URLSearchParams(location.hash.slice(1));
let token=fragment.get('token')||sessionStorage.getItem('wkn-session')||'';
if(fragment.has('token')){sessionStorage.setItem('wkn-session',token);history.replaceState(null,'',location.pathname);}
let state={drafts:[],posts:[],accounts:[],jobs:[],platforms:[],git:{}};
let currentView='overview',listFilter='all',currentPost=null,dirty=false,confirmJob=null;
let lastSelection='',previewTimer,previewSequence=0,noticeTimer;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={overview:'文章管理',editor:'写一篇文章',imports:'内容迁移',accounts:'平台与账号',deliveries:'分发任务'};
const statuses={queued:'排队中',running:'准备中',prepared:'交付文件已准备','needs-manual':'待人工接续','needs-review':'编辑器待核对','needs-verification':'中断待核验',failed:'准备失败','confirmed-by-author':'作者确认已发布'};
const platformName=id=>state.platforms.find(p=>p.id===id)?.name||id;

function notify(message,error=false){clearTimeout(noticeTimer);const n=$('#notification');n.textContent=message;n.classList.toggle('error',error);n.classList.add('visible');noticeTimer=setTimeout(()=>n.classList.remove('visible'),error?9000:5500);}
async function api(path,options={}){
  const result=await fetch(`/api${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const text=await result.text();let data;try{data=JSON.parse(text);}catch{data={error:`请求失败（HTTP ${result.status}）`};}
  if(result.status===401){if(!$('#session-dialog').open)$('#session-dialog').showModal();throw new Error(data.error);}
  if(!result.ok)throw new Error(data.error||'操作失败');return data;
}
const post=(path,data)=>api(path,{method:'POST',body:JSON.stringify(data)});
async function busy(button,fn){const previous=button.textContent;button.disabled=true;button.textContent='处理中……';try{return await fn();}catch(error){notify(error.message,true);}finally{button.disabled=false;button.textContent=previous;}}
function confirmAction(title,message){return new Promise(resolve=>{const d=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;d.returnValue='cancel';d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();});}

async function refresh(silent=false){
  try{state=await api('/state');renderOverview();renderAccounts();renderDeliveryComposer();renderJobs();if(!silent)notify('内容已刷新');}catch(error){if(!silent)notify(error.message,true);}
}
async function showView(view){
  if(!names[view])view='overview';
  if(currentView==='editor'&&view!==currentView&&dirty){if(!await confirmAction('离开尚未保存的文章？','当前修改尚未保存。返回编辑器点击“保存草稿”可以保留内容。'))return false;dirty=false;}
  currentView=view;$$('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#breadcrumb').textContent=`创作空间 / ${names[view]}`;
  if(view==='deliveries'){renderDeliveryComposer();renderJobs();}window.scrollTo(0,0);return true;
}
$$('[data-view]').forEach(b=>b.addEventListener('click',async()=>{if(b.dataset.view==='editor'){await newPost();}else await showView(b.dataset.view);}));
$('.brand').addEventListener('click',e=>{e.preventDefault();showView('overview');});
$('#refresh-button').addEventListener('click',()=>busy($('#refresh-button'),()=>refresh()));
$('#refresh-jobs').addEventListener('click',()=>refresh());
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

function renderOverview(){
  $('#draft-count').textContent=state.drafts.length;$('#post-count').textContent=state.posts.length;$('#account-count').textContent=state.accounts.length;$('#job-count').textContent=state.jobs.length;
  const query=$('#article-search').value.toLowerCase();
  const items=[...state.drafts.map(p=>({...p,kind:'drafts'})),...state.posts.map(p=>({...p,kind:'posts'}))].filter(p=>(listFilter==='all'||p.kind===listFilter)&&`${p.title} ${p.category}`.toLowerCase().includes(query)).sort((a,b)=>String(b.updatedAt||b.date).localeCompare(String(a.updatedAt||a.date)));
  $('#article-list').innerHTML=items.length?items.map(p=>`<article class="article-row"><div><h3>${escape(p.title)}</h3><div class="article-subtitle">${escape(p.category)} · ${escape((p.tags||[]).join(' / '))}${p.sample?' · 排版示例':''}</div></div><div class="article-type"><span class="badge ${p.kind==='drafts'?'draft':''}">${p.kind==='drafts'?'本地草稿':'仓库文件'}</span></div><time>${escape(String(p.date).slice(0,10))}</time><div class="row-actions"><button data-edit="${escape(p.id)}" data-kind="${p.kind}">编辑</button><button data-delete="${escape(p.id)}" data-kind="${p.kind}" class="danger">删除</button></div></article>`).join(''):'<p class="empty">这里还没有相应的文字。写一篇，或从旧平台带一些过来。</p>';
  $('#git-status').textContent=state.git.ready?(state.git.hasRemote?'已检测到 Git 仓库和远端。':'已初始化 Git，尚未设置 origin。'):state.git.status;
  $('#git-push').disabled=!state.git.ready||!state.git.hasRemote;
}
$$('[data-list]').forEach(b=>b.addEventListener('click',()=>{listFilter=b.dataset.list;$$('[data-list]').forEach(x=>x.classList.toggle('active',x===b));renderOverview();}));
$('#article-search').addEventListener('input',renderOverview);
$('#article-list').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit]');if(edit){const p=state[edit.dataset.kind].find(p=>p.id===edit.dataset.edit);await loadEditor(p,edit.dataset.kind);return;}
  const del=e.target.closest('[data-delete]');if(del&&await confirmAction('删除这篇文章？',del.dataset.kind==='drafts'?'将删除本机草稿，已发布的博客文章不受影响。':'将移除仓库中的文章文件。提交推送后线上文章会删除；原平台文章不会删除。'))await busy(del,async()=>{await api(`/${del.dataset.kind==='drafts'?'drafts':'posts'}/${encodeURIComponent(del.dataset.delete)}`,{method:'DELETE',body:'{}'});await refresh(true);notify('已删除本地内容');});
});
$('#git-push').addEventListener('click',async()=>{if(await confirmAction('提交内容并推送到 GitHub？','将提交公开文章与迁移图片的改动并推送到 origin 当前分支。首次上线需要先自行提交整个项目。'))await busy($('#git-push'),async()=>{const r=await post('/git/push',{});notify(r.message);await refresh(true);});});

function setDirty(value=true){dirty=value;$('#editor-status').classList.toggle('dirty-dot',value);if(value)$('#editor-status').textContent='有未保存的修改';}
function editorData(){const f=new FormData($('#editor-form'));return{title:f.get('title'),description:f.get('description'),category:f.get('category'),date:f.get('date'),tags:String(f.get('tags')||'').split(/[,，]/).map(t=>t.trim()).filter(Boolean),cover:f.get('cover'),source:f.get('source'),sample:f.get('sample')==='on',featured:f.get('featured')==='on',body:f.get('body'),...(currentPost?.id?{id:currentPost.id}:{}),...(currentPost?.publicId?{publicId:currentPost.publicId}:{})};}
async function loadEditor(p,kind='drafts'){
  if(dirty&&!await confirmAction('打开另一篇文章？','当前修改尚未保存，确认后将切换文章。'))return;dirty=false;
  currentPost=kind==='posts'?{publicId:p.id}:{id:p.id,publicId:p.publicId};
  const f=$('#editor-form');for(const name of ['title','description','category','date','cover','source','body'])f.elements[name].value=p[name]||'';f.elements.tags.value=(p.tags||[]).join(', ');f.elements.sample.checked=!!p.sample;f.elements.featured.checked=!!p.featured;
  $('#editor-heading').textContent=kind==='posts'?'让文字，继续生长。':'把灵感，写成下一篇。';$('#editor-status').textContent=kind==='posts'?'正在编辑仓库文章，保存草稿不会自动修改公开文件':'本地草稿 · 已加载';$('#editor-status').classList.remove('dirty-dot');await showView('editor');renderPreview();
}
async function newPost(){if(dirty&&!await confirmAction('新建一篇文章？','当前修改尚未保存，确认后将清空编辑器。'))return;dirty=false;await loadEditor({title:'',description:'',date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),category:'随笔手记',tags:[],body:''});currentPost=null;$('#editor-status').textContent='新草稿 · 尚未保存';}
$('#new-post').addEventListener('click',newPost);
$('#editor-form').addEventListener('submit',e=>e.preventDefault());
$('#editor-form').addEventListener('input',()=>{setDirty();clearTimeout(previewTimer);previewTimer=setTimeout(renderPreview,350);});
async function renderPreview(){const sequence=++previewSequence;try{const r=await post('/preview',{body:$('#body-editor').value});if(sequence===previewSequence)$('#markdown-preview').innerHTML=r.html;}catch(error){if(sequence===previewSequence)$('#markdown-preview').textContent=error.message;}}
$('#toggle-preview').addEventListener('click',()=>{const closed=$('.editor-split').classList.toggle('no-preview');$('#toggle-preview').textContent=closed?'打开预览':'关闭预览';});
$('#save-draft').addEventListener('click',()=>busy($('#save-draft'),async()=>{if(!$('#editor-form').reportValidity())return;const r=await post('/drafts',editorData());currentPost={id:r.id,publicId:r.publicId};setDirty(false);$('#editor-status').textContent='本地草稿已保存 · '+new Date().toLocaleTimeString('zh-CN');await refresh(true);notify('草稿已保存在本机');}));
$('#write-public').addEventListener('click',async()=>{if(!$('#editor-form').reportValidity())return;if(!await confirmAction('将这篇文章写入公开内容目录？','标题、正文与迁移图片将写入博客仓库。随后可运行预览，确认后提交推送。尚未推送的改动不会影响线上网站。'))return;await busy($('#write-public'),async()=>{const data=editorData();const r=await post('/publish',data);currentPost={...currentPost,publicId:r.id};setDirty(false);$('#editor-status').textContent='已写入博客仓库 · 尚需 Git 推送与构建';await refresh(true);notify(r.message);});});
$('#editor-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>5_000_000){notify('文件不能超过 5 MB',true);return;}await busy($('#save-draft'),async()=>{const r=await post('/import',{format:'markdown',content:await file.text(),filename:file.name,downloadImages:false});await refresh(true);await loadEditor(r.draft);notify(r.message);});e.target.value='';});
$('#editor-image').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5_000_000)throw new Error('图片不能超过 5 MB');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const r=await post('/assets',{base64:String(data).split(',')[1]});const textarea=$('#body-editor');const alt=file.name.replace(/\.[^.]+$/,'').replace(/[\[\]\\]/g,'');textarea.setRangeText(`\n![${alt}](${r.path})\n`,textarea.selectionStart,textarea.selectionEnd,'end');setDirty();renderPreview();notify('图片已保存在本地，文章写入公开目录时会一同复制。');}catch(error){notify(error.message,true);}finally{e.target.value='';}});

const reports=[];
function addReport(report){reports.unshift(report);$('#import-reports').innerHTML=reports.map(r=>`<div class="report-item"><span class="badge ${r.error?'failed':r.duplicate?'':'success'}">${r.error?'导入失败':r.duplicate?'已存在':'已导入'}</span> <strong>${escape(r.title||r.url||'文章')}</strong><p>${escape(r.message)}</p>${r.warnings?.length?`<ul>${r.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul>`:''}${r.id?`<button class="quiet-button" data-open-import="${escape(r.id)}">打开草稿 →</button>`:''}</div>`).join('');}
$('#import-reports').addEventListener('click',e=>{const b=e.target.closest('[data-open-import]');if(b){const p=state.drafts.find(p=>p.id===b.dataset.openImport);if(p)loadEditor(p);}});
$('#clear-reports').addEventListener('click',()=>{reports.length=0;$('#import-reports').innerHTML='<p class="empty">迁移结果会逐篇显示在这里。</p>';});
$('#discover-csdn').addEventListener('click',()=>busy($('#discover-csdn'),async()=>{const r=await post('/import/discover',{url:$('#csdn-homepage').value.trim()});const area=$('#discover-result');area.hidden=false;area.innerHTML=`<p>${escape(r.message)}</p>${r.articles.map(a=>`<label class="discovered-link"><input type="checkbox" value="${escape(a.url)}"><span>${escape(a.title)}</span></label>`).join('')}`;area.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{const urls=new Set($('#import-urls').value.split(/\s+/).filter(Boolean));input.checked?urls.add(input.value):urls.delete(input.value);$('#import-urls').value=[...urls].join('\n');}));}));
$('#start-import').addEventListener('click',()=>busy($('#start-import'),async()=>{const urls=[...new Set($('#import-urls').value.split(/\s+/).filter(Boolean))];if(!urls.length)throw new Error('请先填写文章详情链接');if(urls.length>50)throw new Error('每批最多导入 50 篇文章');let completed=0;for(const url of urls){$('#start-import').textContent=`正在导入 ${++completed} / ${urls.length}`;try{const r=await post('/import',{url,downloadImages:$('#download-images').checked});addReport({title:r.draft.title,id:r.draft.id,...r});}catch(error){addReport({url,error:true,message:error.message});}}await refresh(true);notify('本批导入已结束，请检查逐篇报告');}));
$('#import-files').addEventListener('change',async e=>{const files=[...e.target.files];for(const file of files){try{if(file.size>5_000_000)throw new Error('文件超过 5 MB 限制');const markdown=/\.(?:md|markdown)$/i.test(file.name);const r=await post('/import',{format:markdown?'markdown':'html',content:await file.text(),filename:file.name,url:$('#html-source').value.trim(),downloadImages:$('#download-images').checked});addReport({title:r.draft.title,id:r.draft.id,...r});}catch(error){addReport({title:file.name,error:true,message:error.message});}}await refresh(true);e.target.value='';});

function renderAccounts(){
  $('#accounts-list').innerHTML=state.accounts.length?state.accounts.map(a=>`<article class="account-card"><div class="account-card-top"><span class="platform-avatar">${escape(platformName(a.platform).slice(0,2))}</span><span class="badge">独立会话</span></div><h3>${escape(a.name)}</h3><p>${escape(platformName(a.platform))} · 登录状态请在浏览器中核对</p><div class="row-actions"><button data-login="${a.id}">打开登录窗口 ↗</button><button data-remove-account="${a.id}" class="danger">移除</button></div></article>`).join(''):'<p class="empty">还没有平台账号。先添加一个备注名，再打开独立窗口登录。</p>';
}
$('#add-account').addEventListener('click',()=>$('#account-dialog').showModal());
$('#account-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('[type=submit]');await busy(b,async()=>{const f=new FormData(e.target);await post('/accounts',Object.fromEntries(f));$('#account-dialog').close();e.target.reset();await refresh(true);notify('账号备注已添加，请在独立窗口登录');});});
$('#accounts-list').addEventListener('click',async e=>{const login=e.target.closest('[data-login]');if(login)await busy(login,async()=>{const r=await post(`/accounts/${login.dataset.login}/login`,{});notify(r.message);});const remove=e.target.closest('[data-remove-account]');if(remove&&await confirmAction('移除账号备注？','会关闭该账号的浏览器窗口。会话目录保留在本机 .local/profiles，可自行清理。'))await busy(remove,async()=>{const r=await api(`/accounts/${remove.dataset.removeAccount}`,{method:'DELETE',body:'{}'});await refresh(true);notify(r.message);});});

function renderDeliveryComposer(){
  const select=$('#delivery-post');const selected=select.value||lastSelection;
  select.innerHTML='<option value="">请选择一篇文章</option>'+state.drafts.map(p=>`<option value="drafts:${p.id}">[草稿] ${escape(p.title)}</option>`).join('')+state.posts.map(p=>`<option value="posts:${escape(p.id)}">[仓库] ${escape(p.title)}</option>`).join('');select.value=selected;
  const checked=$$('#delivery-targets input:checked').map(i=>i.value);
  $('#delivery-targets').innerHTML=state.accounts.length?state.accounts.map(a=>`<label class="target-chip"><input type="checkbox" value="${a.id}" ${checked.includes(a.id)?'checked':''}><span>${escape(platformName(a.platform))} · ${escape(a.name)}</span></label>`).join(''):'<p class="empty">先到“平台与账号”中添加目标账号。</p>';
}
$('#delivery-post').addEventListener('change',e=>lastSelection=e.target.value);
$('#create-delivery').addEventListener('click',()=>busy($('#create-delivery'),async()=>{const selected=$('#delivery-post').value;if(!selected)throw new Error('请先选择文章');const split=selected.indexOf(':');const collection=selected.slice(0,split),id=selected.slice(split+1);const article=state[collection].find(p=>p.id===id);const accounts=$$('#delivery-targets input:checked').map(i=>i.value);if(!accounts.length)throw new Error('请至少选择一个账号');const r=await post('/deliver',{post:article,accounts,mode:$('#delivery-mode').value});await refresh(true);notify(r.jobs.every(j=>j.reused)?'同版本任务已存在，已保留原记录，避免重复操作':r.message);}));
function renderJobs(){
  $('#jobs-list').innerHTML=state.jobs.length?state.jobs.map(j=>`<article class="job-card"><div class="job-heading"><h3>${escape(j.title)}</h3><span class="badge ${j.status==='failed'?'failed':j.status==='confirmed-by-author'?'success':''}">${escape(statuses[j.status]||j.status)}</span></div><div class="job-meta">${escape(platformName(j.platform))} / ${escape(j.accountName)} · ${escape(new Date(j.createdAt).toLocaleString('zh-CN'))} · 内容版本 ${escape(j.hash)}</div><p>${escape(j.message)}</p>${j.warnings?.length?`<ul>${j.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul>`:''}${j.remoteUrl?`<a href="${escape(j.remoteUrl)}" target="_blank" rel="noopener noreferrer">查看作者确认的远端文章 ↗</a>`:''}<div class="job-actions">${!['queued','running'].includes(j.status)?`<button data-download="${j.id}" data-file="article.zip">下载完整交付包</button><button data-download="${j.id}" data-file="article.md">下载 Markdown</button><button data-copy-html="${j.id}">复制排版正文</button><button data-extension="${j.id}">转交 Wechatsync ↗</button>${j.status!=='confirmed-by-author'?`<button data-confirm-job="${j.id}">记录已发布地址</button><button data-retry="${j.id}">核对后重新准备</button>`:''}`:'<span class="muted">任务执行中，进度将自动更新</span>'}</div></article>`).join(''):'<div class="panel"><p class="empty">还没有分发记录。选择文章和目标账号，从一次小小的出发开始。</p></div>';
}
async function downloadJob(id,file){const response=await fetch(`/api/jobs/${id}/files/${file}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('交付文件尚未生成或不存在');return await response.text();}
$('#jobs-list').addEventListener('click',async e=>{
  const download=e.target.closest('[data-download]');if(download)await busy(download,async()=>{const file=download.dataset.file;const response=await fetch(`/api/jobs/${download.dataset.download}/files/${file}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('交付文件尚未生成或不存在');const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`article-${download.dataset.download.slice(0,8)}.${file.split('.').pop()}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
  const copy=e.target.closest('[data-copy-html]');if(copy)await busy(copy,async()=>{const html=await downloadJob(copy.dataset.copyHtml,'article.html');const parsed=new DOMParser().parseFromString(html,'text/html');if(navigator.clipboard.write&&window.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([parsed.body.innerHTML],{type:'text/html'}),'text/plain':new Blob([parsed.body.textContent],{type:'text/plain'})})]);else await navigator.clipboard.writeText(parsed.body.textContent);notify('正文已复制。本地图片仍需在目标平台上传。');});
  const confirm=e.target.closest('[data-confirm-job]');if(confirm){confirmJob=confirm.dataset.confirmJob;$('#link-form').reset();$('#link-dialog').showModal();}
  const retry=e.target.closest('[data-retry]');if(retry&&await confirmAction('确认已检查远端状态？','请先核对平台是否已经生成草稿或文章。确认后重新准备会打开新的编辑器，请避免重复发布。'))await busy(retry,async()=>{const r=await post(`/jobs/${retry.dataset.retry}/retry`,{confirmed:true});await post('/deliver',{post:r.post,accounts:[r.accountId],mode:r.mode});await refresh(true);notify('已重新创建准备任务');});
  const extension=e.target.closest('[data-extension]');if(extension){const id=extension.dataset.extension;if(!await confirmAction('向同步助手交付这篇文章？','下一步会打开隔离页面并加载 Wechatsync 的网页 SDK，分享所选文章的标题、摘要和正文。不会传递本地会话密钥或账号数据。需安装兼容扩展；系统不会将转交标记为发布成功。'))return;await busy(extension,async()=>{
    const r=await post('/extension-handoff',{jobId:id});
    const link=document.createElement('a');link.href=r.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='打开同步助手交付页 ↗';extension.after(link);link.click();notify('已准备隔离的同步助手页面。如新窗口未打开，可点击任务中的交付页链接。');
  });}
});
$('#link-form').addEventListener('submit',e=>{e.preventDefault();busy(e.target.querySelector('[type=submit]'),async()=>{const r=await post(`/jobs/${confirmJob}/confirm`,{url:new FormData(e.target).get('url')});$('#link-dialog').close();await refresh(true);notify(r.message);});});
setInterval(async()=>{if(state.jobs.some(j=>['queued','running'].includes(j.status))){try{const fresh=await api('/state');state.jobs=fresh.jobs;renderJobs();$('#job-count').textContent=state.jobs.length;}catch{}}},2500);
if(!token)$('#session-dialog').showModal();else refresh(true).catch(error=>notify(error.message,true));
await newPost();await showView('overview');
