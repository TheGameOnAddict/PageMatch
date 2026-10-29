import {normalize,pickPageId,candidatesFor,photoCandidates,headerTerms,rankCatalogCandidates} from './recognition.js';
const $=id=>document.getElementById(id);
const url=path=>new URL(path,document.baseURI).href;
const catalogs=new Map();
let pdfjs,db,activeId=null,activePdf=null,photoBlob=null,stream=null,busy=false,renderTask=null;
const status=(id,message)=>{$(id).textContent=message;};
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function setBusy(value){
  busy=value;
  for(const id of ['pdfFile','cameraButton','photoFile','clearButton','manualButton','matchScope'])$(id).disabled=value;
  $('recognizeButton').disabled=value||!photoBlob||!catalogs.size;
  refreshCatalogs();
}
async function loadPdfJs(){
  if(!pdfjs){pdfjs=await import('./vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=url('./vendor/pdf.worker.min.mjs');}
  return pdfjs;
}
async function readPdf(bytes){
  const lib=await loadPdfJs();
  return lib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,cMapUrl:url('./vendor/cmaps/'),cMapPacked:true,standardFontDataUrl:url('./vendor/standard_fonts/')}).promise;
}
function loadOcr(){
  return new Promise((resolve,reject)=>{
    if(window.Tesseract)return resolve(window.Tesseract);
    const script=document.createElement('script');script.src='./vendor/tesseract.min.js';
    script.onload=()=>resolve(window.Tesseract);script.onerror=()=>reject(Error('OCR assets could not load. Connect once and wait for Offline ready.'));
    document.head.append(script);
  });
}
function openDb(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open('pagematch-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('catalogs',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
function dbRequest(mode,operation){return new Promise((resolve,reject)=>{
  const tx=db.transaction('catalogs',mode);let result;
  const request=operation(tx.objectStore('catalogs'));
  request.onsuccess=()=>{result=request.result;};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Local storage transaction aborted'));
});}
async function indexPdf(file){
  const bytes=await file.arrayBuffer();let doc;
  $('progressTrack').hidden=false;$('progressFill').style.width='0%';
  try{
    doc=await readPdf(bytes.slice(0));const pageCount=doc.numPages,index={};let headers=[];
    for(let n=1;n<=pageCount;n++){
      const page=await doc.getPage(n);const content=await page.getTextContent();
      const code=pickPageId(content.items,page);
      if(code)(index[code]??=[]).push(n);
      // Learn recurring catalog headings from top-of-page text, not document body part numbers.
      if(n<=12||n%40===0){
        const top=page.view[1]+(page.view[3]-page.view[1])*.73;
        headers.push(content.items.filter(i=>i.transform[5]>top).map(i=>i.str).join(' '));
      }
      page.cleanup();
      if(n%5===0||n===pageCount){
        $('progressFill').style.width=`${100*n/pageCount}%`;
        status('catalogStatus',`Indexing ${n} / ${pageCount} pages · ${Object.keys(index).length} printed IDs`);await pause();
      }
    }
    const item={id:crypto.randomUUID(),name:file.name,pageCount,index,headerTerms:headerTerms(headers.join(' ')),blob:new Blob([bytes],{type:'application/pdf'})};
    if(!Object.keys(index).length)throw Error('No bottom-center printed IDs found. Use a text-based catalog with IDs such as 1H18; scanned PDF indexing is not supported yet.');
    await dbRequest('readwrite',store=>store.put(item));catalogs.set(item.id,item);
    await activate(item.id);
    status('catalogStatus',`Saved locally: ${pageCount} pages · ${Object.keys(index).length} printed IDs.`);
    navigator.storage?.persist?.().catch(()=>{});
  }finally{await doc?.destroy();$('progressTrack').hidden=true;}
}
async function activate(id){
  if(activeId===id&&activePdf)return;
  if(renderTask){renderTask.cancel();await renderTask.promise.catch(()=>{});renderTask=null;}
  if(activePdf)await activePdf.destroy();
  activePdf=null;activeId=id;
  $('pdfPreview').replaceChildren();$('result').textContent='No scan yet.';
  activePdf=await readPdf(await catalogs.get(id).blob.arrayBuffer());
  refreshCatalogs();status('scanStatus','Catalog ready. Capture or choose a photo.');
}
function refreshCatalogs(){
  const root=$('catalogList');root.replaceChildren();
  for(const catalog of catalogs.values()){
    const row=document.createElement('div');row.className='catalog'+(catalog.id===activeId?' selected':'');
    const info=document.createElement('div'),title=document.createElement('strong'),small=document.createElement('small');
    title.textContent=catalog.name;small.textContent=`${catalog.pageCount} PDF pages · ${Object.keys(catalog.index).length} printed IDs`;
    info.append(title,small);
    const button=document.createElement('button');button.textContent=catalog.id===activeId?'Selected':'Select';button.disabled=busy||catalog.id===activeId;
    button.onclick=()=>run(()=>activate(catalog.id),'catalogStatus');row.append(info,button);root.append(row);
  }
  $('clearButton').hidden=!catalogs.size;
}
async function run(fn,statusId='scanStatus'){
  if(busy)return;setBusy(true);
  try{await fn();}catch(error){status(statusId,error.message);}finally{setBusy(false);}
}
function searchCatalogs(){return $('matchScope').value==='all'?[...catalogs.values()]:[catalogs.get(activeId)].filter(Boolean);}
async function showPage(pageNo,id){
  if(!activePdf)return;
  const page=await activePdf.getPage(pageNo),base=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:Math.min(1.8,1600/base.width)});
  const canvas=document.createElement('canvas');canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
  const label=document.createElement('p');label.className='muted';label.textContent=`Printed page ${id} · PDF page ${pageNo} of ${activePdf.numPages}`;
  $('pdfPreview').replaceChildren(label,canvas);
  try{renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;}
  finally{renderTask=null;page.cleanup();}
}
async function useCandidate(candidate){
  if(activeId!==candidate.catalog.id)await activate(candidate.catalog.id);
  const box=document.createElement('div');box.className='match'+(candidate.score||candidate.pages.length>1?' warning':'');
  const title=document.createElement('strong'),small=document.createElement('small');title.textContent=candidate.id;
  small.textContent=`${candidate.catalog.name} · PDF page ${candidate.pages.join(', ')}${candidate.score?' · approximate match: verify carefully':''}`;
  box.append(title,small);$('result').replaceChildren(box);$('pdfPreview').replaceChildren();
  if(candidate.pages.length===1)await showPage(candidate.pages[0],candidate.id);
  else{
    const label=document.createElement('p');label.textContent='This printed ID occurs more than once. Choose a PDF page:';$('result').append(label);
    for(const n of candidate.pages){const b=document.createElement('button');b.textContent=`Open PDF page ${n}`;b.onclick=()=>run(()=>showPage(n,candidate.id));$('result').append(b);}
  }
}
function showCandidates(candidates){
  $('pdfPreview').replaceChildren();const root=$('result');root.replaceChildren();
  if(!candidates.length){root.textContent='No indexed match. Retake a straight, sharp photo including the footer, or enter the printed ID below.';return;}
  const label=document.createElement('p');label.textContent='Choose and verify a possible match. Catalog revisions may share printed IDs.';root.append(label);
  const group=document.createElement('div');group.className='candidates';
  for(const c of candidates.slice(0,16)){
    const b=document.createElement('button');b.textContent=`${c.id} · ${c.catalog.name}${c.score?' (approximate)':''}`;
    b.onclick=()=>run(()=>useCandidate(c));group.append(b);
  }root.append(group);
}
async function loadPhoto(blob){
  const image=new Image(),objectUrl=URL.createObjectURL(blob);
  try{
    image.src=objectUrl;await image.decode();
    const scale=Math.min(1,2600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    photoBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
    if(!photoBlob)throw Error('Could not decode photo. Choose a JPEG or take a new photo.');
    const previewUrl=URL.createObjectURL(photoBlob);$('photoPreview').onload=()=>URL.revokeObjectURL(previewUrl);$('photoPreview').src=previewUrl;$('photoPreview').hidden=false;
    status('scanStatus','Photo ready. Run recognition.');
  }finally{URL.revokeObjectURL(objectUrl);}
}
async function cropPhoto(region){
  const image=new Image(),objectUrl=URL.createObjectURL(photoBlob);
  try{
    image.src=objectUrl;await image.decode();
    const [left,top,width,height]=region;
    const sw=Math.round(image.naturalWidth*width),sh=Math.round(image.naturalHeight*height),scale=Math.min(3,1800/sw);
    const canvas=document.createElement('canvas');canvas.width=Math.round(sw*scale);canvas.height=Math.round(sh*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,image.naturalWidth*left,image.naturalHeight*top,sw,sh,0,0,canvas.width,canvas.height);
    return canvas;
  }finally{URL.revokeObjectURL(objectUrl);}
}
async function candidateHeaders(candidates){
  const enriched=[];
  for(const candidate of candidates){
    const catalog=candidate.catalog;
    catalog.pageHeaders??={};
    const missing=candidate.pages.filter(n=>catalog.pageHeaders[n]===undefined);
    if(missing.length){
      const doc=catalog.id===activeId?activePdf:await readPdf(await catalog.blob.arrayBuffer());
      try{
        for(const n of missing){
          const page=await doc.getPage(n),content=await page.getTextContent();
          const top=page.view[1]+(page.view[3]-page.view[1])*.85;
          catalog.pageHeaders[n]=content.items.filter(i=>i.transform[5]>top).map(i=>i.str).join(' ');
          page.cleanup();
        }
      }finally{if(doc!==activePdf)await doc.destroy();}
    }
    enriched.push({...candidate,headerText:candidate.pages.map(n=>catalog.pageHeaders[n]).join(' ')});
  }
  return enriched;
}
async function recognize(){
  if(!photoBlob||!catalogs.size)return;
  const Tess=await loadOcr();status('scanStatus','Loading local OCR engine…');
  const worker=await Tess.createWorker('eng',1,{
    workerPath:url('./vendor/tesseract.worker.min.js'),workerBlobURL:false,
    corePath:url('./vendor/core/'),langPath:url('./vendor/lang/'),gzip:true,cacheMethod:'none',
    logger:event=>{if(event.status==='recognizing text')status('scanStatus',`Reading photo locally… ${Math.round(event.progress*100)}%`);}
  });
  try{
    const scope=searchCatalogs(),texts=[];
    await worker.setParameters({tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',tessedit_pageseg_mode:Tess.PSM.SPARSE_TEXT});
    // Center crop avoids nearby part numbers; wide fallback allows off-center photographs.
    for(const region of [[.25,.76,.5,.24],[0,.7,1,.3]]){
      const canvas=await cropPhoto(region);const result=await worker.recognize(canvas);texts.push(result.data.text);canvas.width=canvas.height=1;
      if(photoCandidates(texts,scope).some(c=>c.score===0))break;
    }
    let candidates=photoCandidates(texts,scope);
    const enriched=await candidateHeaders(candidates);
    await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:Tess.PSM.SPARSE_TEXT});
    const headerReads=[];
    let ranking=rankCatalogCandidates('',enriched);
    // A focused second pass enlarges the model/name when the first header read is inconclusive.
    for(const region of [[0,0,1,.25],[.14,0,.72,.22]]){
      const canvas=await cropPhoto(region);
      const header=await worker.recognize(canvas);headerReads.push(header.data.text);canvas.width=canvas.height=1;
      ranking=rankCatalogCandidates(headerReads.join('\n'),enriched);
      if(ranking.selected||enriched.length===1&&ranking.evidence[0]?.confirmed)break;
    }
    candidates=ranking.selected?[ranking.selected]:ranking.candidates;
    const recognizedText=texts.join(' ').trim().replace(/\s+/g,' ').slice(0,110)||'nothing readable';
    const headerText=headerReads.join(' ').trim().replace(/\s+/g,' ').slice(0,180)||'nothing readable';
    const conflict=ranking.evidence.some(e=>candidates.includes(e.candidate)&&e.conflicts.length);
    if(candidates.length===1&&candidates[0].score===0&&candidates[0].pages.length===1&&!conflict){
      await useCandidate(candidates[0]);
      const confirmed=ranking.evidence.find(e=>e.candidate===candidates[0])?.confirmed;
      status('scanStatus',`Read ${candidates[0].id}. ${ranking.reason?'Catalog matched by '+ranking.reason+'.':confirmed?'Catalog model/header confirmed.':'Catalog is based on your search selection / page index; header not confirmed.'} Verify the preview and catalog revision.`);
    }else{
      showCandidates(candidates);
      status('scanStatus',`Footer OCR: ${recognizedText}. ${conflict?'Header model conflicts with the catalog. ':''}Header read: ${headerText}. ${ranking.evidence.some(e=>e.confirmed)?'Matching model/header; revision or page still needs confirmation.':'No distinctive model/name confirmed. Generic manufacturer words do not identify the catalog.'} Select a match or use manual lookup.`);
    }
  }finally{await worker.terminate();}
}
function stopCamera(){stream?.getTracks().forEach(track=>track.stop());stream=null;$('video').srcObject=null;$('cameraBox').hidden=true;}
$('pdfFile').onchange=e=>{const file=e.target.files?.[0];if(file)run(()=>indexPdf(file),'catalogStatus');e.target.value='';};
$('photoFile').onchange=e=>{const file=e.target.files?.[0];if(file)run(()=>loadPhoto(file));e.target.value='';};
$('cameraButton').onclick=()=>run(async()=>{
  stopCamera();if(!navigator.mediaDevices?.getUserMedia)throw Error('Live camera needs HTTPS and camera permission. Use Choose / take photo below.');
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}}});
    $('video').srcObject=stream;$('cameraBox').hidden=false;await $('video').play();
  }catch(error){stopCamera();throw Error(`Camera unavailable: ${error.message}. Use Choose / take photo.`);}
});
$('stopButton').onclick=stopCamera;
$('snapButton').onclick=()=>run(async()=>{
  const video=$('video');if(!video.videoWidth)throw Error('Camera is starting. Wait for the live preview.');
  const canvas=$('photoCanvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));stopCamera();canvas.width=canvas.height=1;
  if(blob)await loadPhoto(blob);
});
$('recognizeButton').onclick=()=>run(recognize);
$('manualButton').onclick=()=>run(async()=>{
  const candidates=candidatesFor(normalize($('manualPage').value),searchCatalogs());const exact=candidates.filter(c=>c.score===0);
  if(exact.length===1)await useCandidate(exact[0]);else showCandidates(exact.length?exact:candidates);
});
$('manualPage').onkeydown=e=>{if(e.key==='Enter')$('manualButton').click();};
$('clearButton').onclick=()=>run(async()=>{
  if(!confirm('Delete all catalog PDFs and indexes saved in this browser?'))return;
  await dbRequest('readwrite',store=>store.clear());catalogs.clear();activeId=null;
  if(activePdf)await activePdf.destroy();activePdf=null;photoBlob=null;
  $('photoPreview').hidden=true;$('photoPreview').removeAttribute('src');$('pdfPreview').replaceChildren();$('result').textContent='No scan yet.';
  status('catalogStatus','No catalog imported.');status('scanStatus','Import a catalog to begin.');stopCamera();
});
window.addEventListener('pagehide',stopCamera);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
async function setupOffline(){
  if(!('serviceWorker' in navigator)){status('offlineStatus','Offline installation unavailable in this browser.');return;}
  try{
    const registration=await navigator.serviceWorker.register('./service-worker.js');
    if(registration.active&&!registration.installing)status('offlineStatus','Offline ready · catalogs stay on this device');
    const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{
      if(worker.state==='activated')status('offlineStatus','Offline ready · catalogs stay on this device');
      if(worker.state==='redundant')status('offlineStatus','Offline download failed. Reopen online to retry.');
    });};
    watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration.installing));
  }catch(error){status('offlineStatus','Offline cache unavailable. Keep online and reopen to retry.');}
}
setBusy(true);
(async()=>{
  try{
    db=await openDb();const saved=await dbRequest('readonly',store=>store.getAll());saved.forEach(c=>catalogs.set(c.id,c));
    if(saved.length)await activate(saved[0].id);
    status('catalogStatus',saved.length?`${saved.length} catalog(s) saved on this device.`:'No catalog imported.');
  }catch(error){status('catalogStatus',`Local storage unavailable: ${error.message}. Enable website storage and reopen.`);}
  finally{setBusy(false);}
})();
setupOffline();
