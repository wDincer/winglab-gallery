import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.mjs';

test('video files have browser-safe MIME types and support seeking with byte ranges',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'winglab-video-http-'));
  const names=['projects.json','clip.mp4','clip.webm'];let server;
  try{
    await writeFile(path.join(root,'projects.json'),'[]');
    const bytes=Buffer.from('0123456789abcdefghijklmnopqrstuv');
    for(const file of names.slice(1))await writeFile(path.join(root,file),bytes);
    server=createServer({root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const [file,type]of[['clip.mp4','video/mp4'],['clip.webm','video/webm']]){
      const response=await fetch(base+'/'+file,{headers:{Range:'bytes=8-15'}});
      assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),type);
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      assert.equal(response.headers.get('content-range'),'bytes 8-15/32');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(8,16));
    }
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const file of names)await unlink(path.join(root,file)).catch(()=>{});
    await rmdir(root);
  }
});
