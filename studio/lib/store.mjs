import { openPlatform } from '../../packages/storage/index.mjs';

export async function createStore(root) {
  const platform=await openPlatform(root);
  let chain=Promise.resolve();
  async function read(){return platform.legacyRead();}
  async function update(fn){
    const work=chain.then(async()=>{const state=await read();const result=await fn(state);platform.legacyWrite(state);return result;});
    chain=work.catch(()=>{});return work;
  }
  return {read:async()=>{await chain;return read();},update,root,platform,close:()=>platform.close()};
}
