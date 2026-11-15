import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export async function saveUploadedImage(root,encoded){
  if(typeof encoded!=='string'||!encoded||encoded.length>7_000_000||!/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded))throw new Error('图片编码无效或超过 5 MB 限制');
  const bytes=Buffer.from(encoded,'base64');if(bytes.length>5_000_000)throw new Error('图片超过 5 MB 限制');
  let extension;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))extension='png';
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)extension='jpg';
  else if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))extension='gif';
  else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')extension='webp';
  if(!extension)throw new Error('仅支持有效的 PNG、JPEG、GIF、WebP 图片，不接受 SVG 或 HTML');
  const filename=`${createHash('sha256').update(bytes).digest('hex').slice(0,24)}.${extension}`;
  await mkdir(root,{recursive:true});await writeFile(join(root,filename),bytes);
  return{path:`/images/imported/${filename}`,filename,bytes:bytes.length};
}
