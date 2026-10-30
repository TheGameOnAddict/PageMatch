import {renderSavedResults} from './results.js';
import {textBoxes} from './extraction.js';
import {createTraining} from './training.js';
import {normalize,pickPageId,candidatesFor,photoCandidates,headerTerms,rankCatalogCandidates} from './recognition.js';
import {createInterface} from './ui.js';
import {hasLiveCamera,waitForStableVideo} from './camera.js';
const $=id=>document.getElementById(id);
const url=path=>new URL(path,document.baseURI).href;
const catalogs=new Map();
let pdfjs,db,activeId=null,activePdf=null,photoBlob=null,stream=null,busy=false,renderTask=null,cameraSequence=0,cameraRequest=null;
let cameraReady=false,cameraAbort=null,coverSequence=0;
const cameraStage=document.querySelector('.camera-stage');
const scanStatusEl=$('scanStatus');let matchedContext=null,matchedBoxes=[];
function resetMatch(){matchedContext=null;matchedBoxes=[];$('resultSheet').classList.remove('has-match');$('sheetBody').prepend(scanStatusEl);$('savedPageResults').replaceChildren();}

const hasPhotoCover=()=>!$('photoPreview').hidden&&Boolean($('photoPreview').getAttribute('src'));
const status=(id,message)=>{(id==='scanStatus'?scanStatusEl:$(id)).textContent=message;};
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function setBusy(value){
  busy=value;
  for(const id of ['pdfFile','cameraButton','photoFile','clearButton','manualButton','matchScope','snapButton','retakeButton','manualOpenButton','refreshAppButton','openTrainingButton'])$(id).disabled=value;
  $('recognizeButton').disabled=value||!photoBlob||!catalogs.size;
  $('cameraButton').disabled=value||cameraRequest!==null;
  $('snapButton').disabled=value||hasLiveCamera(stream)&&!cameraReady;
  $('resultSheet').setAttribute('aria-busy',String(value));
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
  const request=indexedDB.open('pagematch-v1',2);
  request.onupgradeneeded=()=>{
    for(const name of ['catalogs','templates'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});
  };
  let blocked=false;
  request.onblocked=()=>{blocked=true;reject(Error('Close other PageMatch tabs, then refresh to update local storage. Your catalogs are safe.'));};
  request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(request.error);
});}
function dbRequest(mode,operation,storeName='catalogs'){return new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,mode);let result;
  const request=operation(tx.objectStore(storeName));
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
  const filter=$('matchScope'),selected=filter.value;
  filter.replaceChildren(new Option('All catalogs','all'));
  for(const catalog of catalogs.values()){
    filter.append(new Option(catalog.name,catalog.id));
    const row=document.createElement('div');row.className='catalog';
    const icon=document.createElement('span');icon.className='catalog-icon';icon.textContent='PDF';icon.setAttribute('aria-hidden','true');
    const info=document.createElement('div'),title=document.createElement('strong'),small=document.createElement('small');info.className='catalog-info';
    title.textContent=catalog.name;small.textContent=`${catalog.pageCount} PDF pages · ${Object.keys(catalog.index).length} printed IDs`;
    info.append(title,small);
    const ready=document.createElement('span');ready.className='catalog-ready';ready.textContent='✓ Ready';row.append(icon,info,ready);root.append(row);
  }
  if(selected==='all'||catalogs.has(selected))filter.value=selected;
  if(!catalogs.size){const empty=document.createElement('div');empty.className='empty-library';empty.textContent='Add a PDF catalog to start. Your library will be saved here, ready to scan offline.';root.append(empty);}
  $('catalogCount').textContent=catalogs.size;
  $('clearButton').hidden=!catalogs.size;
}
async function run(fn,statusId='scanStatus'){
  if(busy)return;setBusy(true);
  try{await fn();}catch(error){status(statusId,error.message);if(statusId==='scanStatus'){resetMatch();$('result').textContent=error.message;$('pdfPreview').replaceChildren();ui.showSheet();$('sheetTitle').textContent='Try another photo';}}finally{setBusy(false);}
}
function searchCatalogs(){return $('matchScope').value==='all'?[...catalogs.values()]:[catalogs.get($('matchScope').value)].filter(Boolean);}
async function refreshSavedResults(){
  if(!matchedContext)return;
  const context={...matchedContext};
  try{
    const saved=await dbRequest('readonly',store=>store.getAll(),'templates');
    if(matchedContext?.catalogId!==context.catalogId||matchedContext?.pageNo!==context.pageNo)return;
    $('savedPageResults').replaceChildren(renderSavedResults({templates:saved.filter(t=>t.catalogId===context.catalogId),boxes:matchedBoxes,
      onDiscover:()=>training.open(context),onArrange:templateId=>training.open({...context,templateId,tab:'saved'})}));
  }catch(error){$('savedPageResults').textContent='Saved patterns could not load: '+error.message;}
}
function matchBanner(id,pageNo,approximate=false){
  const details=document.createElement('details');details.className='match-banner'+(approximate?' approximate':'');
  const summary=document.createElement('summary'),title=document.createElement('strong'),catalog=document.createElement('span'),hint=document.createElement('small');
  title.textContent=id;catalog.textContent=catalogs.get(activeId).name;hint.textContent=approximate?'Approximate match · check details':'Match details';summary.append(title,catalog,hint);
  const evidence=document.createElement('div');evidence.className='match-evidence';
  const facts=document.createElement('p');facts.textContent='Printed '+id+' · PDF page '+pageNo+' of '+activePdf.numPages+'. Check the catalog revision before use.';
  evidence.append(scanStatusEl,facts);details.append(summary,evidence);$('result').replaceChildren(details);$('resultSheet').classList.add('has-match');
}
async function showPage(pageNo,id,approximate=false){
  if(!activePdf)return;
  const page=await activePdf.getPage(pageNo),base=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:Math.min(1.8,1600/base.width)});
  const canvas=document.createElement('canvas');canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Matched PDF page '+pageNo);
  matchedContext={catalogId:activeId,pageNo,printedId:id,approximate};$('resultOptions').open=false;$('sheetBody').scrollTop=0;matchBanner(id,pageNo,approximate);$('pdfPreview').replaceChildren(canvas);
  try{
    renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;
    matchedBoxes=textBoxes((await page.getTextContent()).items,base,pdfjs.Util.transform);await refreshSavedResults();
  }finally{renderTask=null;page.cleanup();}
}
async function useCandidate(candidate){
  const evidence=scanStatusEl.textContent;resetMatch();
  if(activeId!==candidate.catalog.id)await activate(candidate.catalog.id);
  const box=document.createElement('div');box.className='match'+(candidate.score||candidate.pages.length>1?' warning':'');
  const title=document.createElement('strong'),small=document.createElement('small');title.textContent=candidate.id;
  small.textContent=`${candidate.catalog.name} · PDF page ${candidate.pages.join(', ')}${candidate.score?' · approximate match: verify carefully':''}`;
  box.append(title,small);$('result').replaceChildren(box);$('pdfPreview').replaceChildren();
  status('scanStatus',evidence);$('sheetTitle').textContent='Matched page';
  if(candidate.pages.length===1)await showPage(candidate.pages[0],candidate.id,Boolean(candidate.score));
  else{
    const label=document.createElement('p');label.textContent='This printed ID occurs more than once. Choose a PDF page:';$('result').append(label);
    for(const n of candidate.pages){const b=document.createElement('button');b.textContent=`Open PDF page ${n}`;b.onclick=()=>run(()=>showPage(n,candidate.id,Boolean(candidate.score)));$('result').append(b);}
  }
}
function showCandidates(candidates){
  resetMatch();$('pdfPreview').replaceChildren();const root=$('result');root.replaceChildren();
  $('sheetTitle').textContent=candidates.length?'Choose a match':'No match yet';
  if(!candidates.length){root.textContent='No indexed match. Retake a straight, sharp photo including the footer, or enter the printed ID below.';return;}
  const label=document.createElement('p');label.textContent='Choose and verify a possible match. Catalog revisions may share printed IDs.';root.append(label);
  const group=document.createElement('div');group.className='candidates';
  for(const c of candidates.slice(0,16)){
    const b=document.createElement('button');b.textContent=`${c.id} · ${c.catalog.name}${c.score?' (approximate)':''}`;
    b.onclick=()=>run(()=>useCandidate(c));group.append(b);
  }root.append(group);
}
async function loadPhoto(blob){
  coverSequence++;cameraStage.classList.remove('returning-live');
  const image=new Image(),objectUrl=URL.createObjectURL(blob);
  try{
    image.src=objectUrl;await image.decode();
    const scale=Math.min(1,2600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    photoBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
    if(!photoBlob)throw Error('Could not decode photo. Choose a JPEG or take a new photo.');
    const previewUrl=URL.createObjectURL(photoBlob);
    try{
      $('photoPreview').src=previewUrl;await $('photoPreview').decode();
      coverSequence++;cameraStage.classList.remove('returning-live');$('photoPreview').hidden=false;
    }
    finally{URL.revokeObjectURL(previewUrl);}
    $('cameraWelcome').hidden=true;$('cameraGuide').hidden=true;
    status('scanStatus','Photo captured. Reading the printed page and catalog header…');
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
      status('scanStatus',`Read ${candidates[0].id}. ${ranking.reason?'Catalog matched by '+ranking.reason+'.':confirmed?'Catalog model/header confirmed.':'Catalog is based on your search selection / page index; header not confirmed.'} Verify the preview and catalog revision. Footer OCR: ${recognizedText}. Header OCR: ${headerText}.`);
    }else{
      showCandidates(candidates);
      status('scanStatus',`Footer OCR: ${recognizedText}. ${conflict?'Header model conflicts with the catalog. ':''}Header read: ${headerText}. ${ranking.evidence.some(e=>e.confirmed)?'Matching model/header; revision or page still needs confirmation.':'No distinctive model/name confirmed. Generic manufacturer words do not identify the catalog.'} Select a match or use manual lookup.`);
    }
  }finally{await worker.terminate();}
}
function stopStream(){
  cameraSequence++;coverSequence++;cameraAbort?.abort();cameraAbort=null;cameraReady=false;
  stream?.getTracks().forEach(track=>track.stop());stream=null;
  cameraStage.classList.remove('warming','returning-live');
  $('video').srcObject=null;$('cameraBox').hidden=true;$('cameraGuide').hidden=true;
  $('cameraWelcome').hidden=hasPhotoCover();$('snapButton').disabled=busy;
}
function stopCamera(){cameraRequest=null;$('cameraButton').disabled=busy;stopStream();}
async function startCamera(){
  if(!hasLiveCamera(stream)){
    stopStream();const sequence=cameraSequence;
    cameraStage.classList.add('warming');
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Live camera needs HTTPS and camera permission. Use Photos or the shutter to take a picture.');
    status('cameraStatus',hasPhotoCover()?'Restoring camera…':'Allow camera access for the live feed, or use Photos.');
    let incoming;
    try{incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}}});}
    catch(error){throw Error(`Camera unavailable (${error.message}). Use Photos or tap the shutter to choose a picture.`);}
    if(sequence!==cameraSequence||!ui.isCamera()){incoming.getTracks().forEach(track=>track.stop());return;}
    stream=incoming;$('video').srcObject=stream;
  }
  const sequence=cameraSequence;
  cameraAbort?.abort();const readiness=new AbortController();cameraAbort=readiness;
  cameraReady=false;$('snapButton').disabled=true;$('cameraBox').hidden=false;
  await $('video').play();
  await waitForStableVideo($('video'),{signal:readiness.signal});
  if(sequence!==cameraSequence||!ui.isCamera())return;
  cameraReady=true;$('snapButton').disabled=busy;
  cameraStage.classList.remove('warming');$('cameraWelcome').hidden=true;
  if(!photoBlob){
    $('cameraGuide').hidden=false;
    const cover=++coverSequence;
    cameraStage.classList.add('returning-live');
    await new Promise(resolve=>setTimeout(resolve,160));
    if(sequence!==cameraSequence||cover!==coverSequence)return;
    $('photoPreview').hidden=true;$('photoPreview').removeAttribute('src');
    cameraStage.classList.remove('returning-live');
  }
  status('cameraStatus','Keep the whole page, header, and printed ID in frame.');
}
function requestCamera(){
  if(busy||cameraRequest!==null)return;
  const request={};cameraRequest=request;$('cameraButton').disabled=true;
  startCamera().catch(error=>{if(cameraRequest===request){stopStream();if(ui.isCamera())status('cameraStatus',error.message);}}).finally(()=>{
    if(cameraRequest===request){cameraRequest=null;$('cameraButton').disabled=busy;}
  });
}
async function scanCurrentPhoto(){
  resetMatch();ui.showSheet();$('sheetTitle').textContent='Reading your page…';
  $('result').textContent='Matching against '+($('matchScope').value==='all'?'all your catalogs.':'your chosen catalog.');$('pdfPreview').replaceChildren();
  if(!catalogs.size){$('sheetTitle').textContent='Add a catalog first';$('result').textContent='Go to Setup and add your PDF catalog. Then take or choose a photo to find its page.';status('scanStatus','Your library is empty.');return;}
  await recognize();
}
async function usePhoto(file){if(!hasLiveCamera(stream))stopCamera();await loadPhoto(file);await scanCurrentPhoto();}
function retake(){
  if(busy)return;
  // Keep the decoded photo in place until a settled live frame can replace it.
  photoBlob=null;$('recognizeButton').disabled=true;
  ui.closeSheet().then(closed=>{if(closed){resetMatch();$('pdfPreview').replaceChildren();$('result').textContent='Take a picture to find your page.';}});
  requestCamera();
}
const ui=createInterface({
  onCamera:()=>{if($('resultSheet').hidden||$('resultSheet').classList.contains('closing'))requestCamera();},
  onSetup:stopCamera,onRetake:retake
});
const training=createTraining({
  catalogs:()=>[...catalogs.values()],openPdf:async id=>readPdf(await catalogs.get(id).blob.arrayBuffer()),
  loadTemplates:()=>dbRequest('readonly',store=>store.getAll(),'templates'),
  saveTemplate:template=>dbRequest('readwrite',store=>store.put(template),'templates'),
  deleteTemplate:id=>dbRequest('readwrite',store=>store.delete(id),'templates'),
  onOpen:stopCamera,onClose:refreshSavedResults,onCount:count=>status('templateSummary',count?count+' pattern set(s) saved on this device.':'Templates stay on this device.')
});
$('pdfFile').onchange=e=>{const file=e.target.files?.[0];if(file)run(()=>indexPdf(file),'catalogStatus');e.target.value='';};
$('photoFile').onchange=e=>{const file=e.target.files?.[0];if(file)run(()=>usePhoto(file));e.target.value='';};
$('cameraButton').onclick=requestCamera;
$('snapButton').onclick=()=>{
  if(busy)return;
  if(!stream){$('photoFile').click();return;}
  if(!cameraReady)return;
  run(async()=>{
  const video=$('video');if(!video.videoWidth)throw Error('Camera is starting. Wait for the live preview.');
  const canvas=$('photoCanvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));canvas.width=canvas.height=1;
  if(blob){await loadPhoto(blob);await scanCurrentPhoto();}
  });
};
$('recognizeButton').onclick=()=>run(scanCurrentPhoto);
$('matchScope').onchange=()=>{if(photoBlob&&!$('resultSheet').hidden)run(scanCurrentPhoto);};
$('manualOpenButton').onclick=()=>{
  resetMatch();$('result').textContent='Enter the printed page ID below.';$('pdfPreview').replaceChildren();ui.showSheet(true);$('resultOptions').open=true;$('sheetTitle').textContent='Find a printed page';
  status('scanStatus','Enter the ID printed on the paper page.');$('manualPage').focus();
};
$('manualButton').onclick=()=>run(async()=>{
  const candidates=candidatesFor(normalize($('manualPage').value),searchCatalogs());const exact=candidates.filter(c=>c.score===0);
  if(exact.length===1)await useCandidate(exact[0]);else showCandidates(exact.length?exact:candidates);
  status('scanStatus','Manual lookup. Verify the catalog revision and PDF preview.');
});
$('manualPage').onkeydown=e=>{if(e.key==='Enter')$('manualButton').click();};
$('clearButton').onclick=()=>run(async()=>{
  if(!confirm('Delete all catalog PDFs, indexes and extraction templates saved in this browser?'))return;
  await dbRequest('readwrite',store=>store.clear());await dbRequest('readwrite',store=>store.clear(),'templates');await training.refresh();resetMatch();catalogs.clear();activeId=null;
  if(activePdf)await activePdf.destroy();activePdf=null;photoBlob=null;
  $('photoPreview').hidden=true;$('photoPreview').removeAttribute('src');$('pdfPreview').replaceChildren();$('result').textContent='No scan yet.';
  status('catalogStatus','No catalog imported.');status('scanStatus','Import a catalog to begin.');stopCamera();
  ui.closeSheet();
});
window.addEventListener('pagehide',stopCamera);
let resumeCamera=false;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){resumeCamera=Boolean(stream);stopCamera();}
  else if(resumeCamera&&ui.isCamera()&&!photoBlob){resumeCamera=false;requestCamera();}
});
async function setupOffline(){
  if(!('serviceWorker' in navigator)){status('offlineStatus','Offline installation unavailable in this browser.');return;}
  try{
    const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
    if(registration.active&&!registration.installing)status('offlineStatus','Offline ready · catalogs stay on this device');
    const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{
      if(worker.state==='activated')status('offlineStatus','Offline ready · catalogs stay on this device');
      if(worker.state==='redundant')status('offlineStatus','Offline download failed. Reopen online to retry.');
    });};
    watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration.installing));
  }catch(error){status('offlineStatus','Offline cache unavailable. Keep online and reopen to retry.');}
}
$('refreshAppButton').onclick=()=>{
  if(busy)return;
  if(!navigator.onLine){status('offlineStatus','Connect to the internet to refresh the app. Your catalogs are safe.');return;}
  // Change the navigation URL so even an older cache-first worker fetches HTML.
  // Build-specific URLs in that HTML fetch matching code. IndexedDB is untouched.
  const fresh=new URL('./',document.baseURI);fresh.searchParams.set('v',Date.now().toString());
  location.replace(fresh.href);
};
setBusy(true);
(async()=>{
  try{
    db=await openDb();await training.refresh();const saved=await dbRequest('readonly',store=>store.getAll());saved.forEach(c=>catalogs.set(c.id,c));
    if(saved.length)await activate(saved[0].id);
    status('catalogStatus',saved.length?`${saved.length} catalog(s) saved on this device.`:'No catalog imported.');
  }catch(error){status('catalogStatus',`Local storage unavailable: ${error.message}. Enable website storage and reopen.`);}
  finally{setBusy(false);}
})();
setupOffline();
