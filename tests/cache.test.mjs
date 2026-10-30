import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const origin='https://example.test',scope=origin+'/PageMatch/';
function worker({network,cached,previous}={}){
  const handlers={};
  vm.runInNewContext(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),{
    URL,self:{location:{origin},registration:{scope},addEventListener:(name,fn)=>{handlers[name]=fn;}},
    caches:{open:async()=>({match:async req=>cached?.[typeof req==='string'?req:req.url]}),match:async req=>previous?.[req.url]},
    fetch:network||(async()=>{throw Error('Offline');})
  });
  return async(path,mode='navigate')=>{
    let response;
    handlers.fetch({request:{url:scope+path,mode,method:'GET'},respondWith:promise=>{response=promise;}});
    return response;
  };
}
test('online navigation fetches new HTML even when an older copy is cached',async()=>{
  const cached={[scope]:{version:'old'}};
  const run=worker({cached,network:async(req,options)=>{assert.equal(options.cache,'no-store');return {ok:true,version:'new'};}});
  assert.equal((await run('')).version,'new');
});
test('offline version-query links reopen the cached app shell',async()=>{
  const run=worker({cached:{[scope]:{version:'offline'}}});
  assert.equal((await run('?v=123')).version,'offline');
});
test('open tabs can still read versioned assets from the previous release',async()=>{
  const path='vendor-previous/core/engine.js';
  const run=worker({previous:{[scope+path]:{version:'previous'}}});
  assert.equal((await run(path,'cors')).version,'previous');
});
test('build versions the complete module chain and offline OCR asset paths',()=>{
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
  const output=new URL('../dist/',import.meta.url);
  const html=readFileSync(new URL('index.html',output),'utf8');
  const main=readFileSync(new URL('main.js',output),'utf8');
  const precache=JSON.parse(readFileSync(new URL('precache.json',output),'utf8'));
  const hash=html.match(/main\.js\?build=([a-f0-9]{16})/)?.[1];assert.ok(hash);
  for(const file of ['styles.css','main.js','recognition.js','ui.js','camera.js','training.js','extraction.js','patterns.js','refinement.js','refinement-ui.js','manifest.webmanifest'])assert.ok(precache.includes('./'+file+'?build='+hash),file);
  for(const file of ['recognition.js','ui.js','camera.js','training.js'])assert.ok(main.includes('./'+file+'?build='+hash),file);
  assert.ok(!main.includes('./vendor/'));
  const training=readFileSync(new URL('training.js',output),'utf8');
  assert.ok(training.includes('./extraction.js?build='+hash));
  assert.ok(training.includes('./patterns.js?build='+hash));
  assert.ok(training.includes('./refinement.js?build='+hash));
  assert.ok(training.includes('./refinement-ui.js?build='+hash));
  assert.ok(readFileSync(new URL('refinement-ui.js',output),'utf8').includes('./refinement.js?build='+hash));
  const extraction=readFileSync(new URL('extraction.js',output),'utf8');
  assert.ok(extraction.includes('./patterns.js?build='+hash));
  assert.ok(extraction.includes('./refinement.js?build='+hash));
  assert.ok(training.includes('./vendor-'+hash+'/pdf.min.mjs')); 
  for(const file of ['pdf.min.mjs','pdf.worker.min.mjs','tesseract.min.js','tesseract.worker.min.js','lang/eng.traineddata.gz','core/tesseract-core-lstm.wasm.js']){
    const path=`./vendor-${hash}/${file}`;assert.ok(precache.includes(path),path);assert.ok(existsSync(new URL(path,output)),path);
  }
});
