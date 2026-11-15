import {syncRemotes} from '../studio/lib/git-sync.mjs';
try{
  const result=await syncRemotes(process.cwd());
  for(const item of result.results)console.log(`${item.remote}: ${item.status}${item.reason?' — '+item.reason:''}`);
  if(!result.giteeConfigured)console.log('Gitee 未配置。添加实际仓库：git remote add gitee <仓库地址>');
  if(result.status!=='pushed')process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
