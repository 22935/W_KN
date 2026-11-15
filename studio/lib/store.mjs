import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

export async function createStore(root) {
  await mkdir(root,{recursive:true});
  const file=join(root,'state.json');
  let chain=Promise.resolve();
  async function read(){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return{drafts:[],accounts:[],jobs:[]};throw error;}}
  async function update(fn){
    const work=chain.then(async()=>{const state=await read();const result=await fn(state);const temporary=`${file}.tmp`;await writeFile(temporary,JSON.stringify(state,null,2));await rename(temporary,file);return result;});
    chain=work.catch(()=>{});return work;
  }
  return {read:async()=>{await chain;return read();},update,root};
}
