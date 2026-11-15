import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir,readFile}from'node:fs/promises';
import{join,resolve,sep}from'node:path';import{tmpdir}from'node:os';
import{execFile}from'node:child_process';import{promisify}from'node:util';
import{syncRemotes}from'../studio/lib/git-sync.mjs';
const exec=promisify(execFile);
test('GitHub 与 Gitee 推送同一提交；一个远端失败时报告部分成功',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wkn-sync-'));t.after(async()=>{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));assert.ok(root.includes('wkn-sync-'));await rm(root,{recursive:true,force:true});});
 const work=join(root,'work');await mkdir(work);const github=join(root,'github.git'),gitee=join(root,'gitee.git');
 for(const path of [github,gitee])await exec('git',['init','--bare',path]);
 const git=(...args)=>exec('git',args,{cwd:work});
 await git('init','-b','main');await git('config','user.name','Test');await git('config','user.email','test@example.com');await git('config','commit.gpgsign','false');await writeFile(join(work,'content.txt'),'one');await git('add','.');await git('commit','-m','test');await git('remote','add','origin',github);await git('remote','add','gitee',gitee);
 const success=await syncRemotes(work);assert.equal(success.status,'pushed');assert.equal(success.results.length,2);assert.equal(success.giteeConfigured,true);
 const originHead=await git('ls-remote','origin','refs/heads/main'),giteeHead=await git('ls-remote','gitee','refs/heads/main');assert.equal(originHead.stdout,giteeHead.stdout);
 await git('remote','set-url','gitee',join(root,'missing.git'));const partial=await syncRemotes(work);assert.equal(partial.status,'partially-pushed');assert.deepEqual(partial.results.map(r=>r.status),['pushed','failed']);
});
