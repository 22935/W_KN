import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

export async function syncRemotes(root){
  const {stdout}=await exec('git',['remote'],{cwd:root,timeout:10000});
  const available=stdout.trim().split(/\s+/);
  const remotes=['origin','gitee'].filter(name=>available.includes(name));
  if(!remotes.includes('origin'))throw new Error('未配置 origin 远端');
  const {stdout:branch}=await exec('git',['symbolic-ref','--short','HEAD'],{cwd:root,timeout:10000});
  const results=[];
  // Each remote has an explicit result, so a Gitee failure never hides a successful GitHub push.
  for(const remote of remotes){
    try{await exec('git',['push',remote,`HEAD:refs/heads/${branch.trim()}`],{cwd:root,timeout:120000,maxBuffer:1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});results.push({remote,status:'pushed'});}
    catch(error){results.push({remote,status:'failed',reason:error.killed?'推送超时':'推送未完成，请检查本机认证、网络和远端分支历史。'});}
  }
  return{status:results.every(r=>r.status==='pushed')?'pushed':results.some(r=>r.status==='pushed')?'partially-pushed':'failed',results,giteeConfigured:remotes.includes('gitee'),message:results.map(r=>`${r.remote==='origin'?'GitHub':'Gitee'}：${r.status==='pushed'?'推送完成':r.reason}`).join('；')+'。GitHub Pages 是否部署完成请查看 Actions。'+(!remotes.includes('gitee')?' Gitee 仓库尚未配置。':'')};
}
