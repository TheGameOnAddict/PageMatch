import {regionFromPoints,textBoxes,validateField,extractField} from './extraction.js';
export function createTraining({catalogs,openPdf,loadTemplates,saveTemplate,deleteTemplate,onOpen,onCount}){
  const $=id=>document.getElementById(id),dialog=$('trainingDialog');
  let templates=[],fields=[],selection=null,boxes=[],doc=null,page=null,viewport=null,currentCatalog=null,currentPage=null,templateId=null,working=false,dirty=false,drag=null,openContext={};
  const canvas=$('trainingCanvas'),surface=$('trainingSurface');
  const message=text=>{$('trainingStatus').textContent=text;};
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.onclick=fn;return b;};
  function options(){
    const choice=$('templateChoice');choice.replaceChildren(new Option('New template',''));
    for(const t of templates)choice.append(new Option(t.name,t.id));
    choice.value=templateId||'';onCount(templates.length);
  }
  async function refresh(){templates=await loadTemplates();options();}
  function lock(value){
    working=value;
    for(const el of dialog.querySelectorAll('button,input,select'))el.disabled=value;
    $('deleteTemplateButton').disabled=value||!templateId;
  }
  async function task(fn){
    if(working)return;lock(true);
    try{await fn();}catch(error){message(error.message);}finally{lock(false);}
  }
  function overlay(){
    $('regionOverlay').replaceChildren();
    for(const [index,field] of [...fields,...(selection?[{region:selection,name:'New field'}]:[])].entries()){
      const box=document.createElement('div');box.className='field-region'+(index===fields.length?' pending':'');
      const r=field.region;box.style.left=r.x*100+'%';box.style.top=r.y*100+'%';box.style.width=r.width*100+'%';box.style.height=r.height*100+'%';
      const label=document.createElement('span');label.textContent=field.name;box.append(label);$('regionOverlay').append(box);
    }
  }
  function review(){
    const list=$('fieldList');list.replaceChildren();
    if(!fields.length){const p=document.createElement('p');p.className='muted';p.textContent='Your named fields will appear here. Mark a region, then add its name.';list.append(p);}
    fields.forEach((field,index)=>{
      const item=document.createElement('div');item.className='trained-field';
      const heading=document.createElement('strong');heading.textContent=field.name;
      const result=boxes.length?extractField(field,boxes):{value:'',status:'Load a page to test'};
      const input=document.createElement('textarea');input.rows=Math.min(6,Math.max(2,result.value.split('\n').length));input.value=result.value;input.setAttribute('aria-label',field.name+' review value');input.placeholder=result.status;
      const note=document.createElement('small');note.textContent=result.status+' · edits here are temporary';
      item.append(heading,note,input,button('Remove field',()=>{fields.splice(index,1);dirty=true;overlay();review();}));list.append(item);
    });
    $('fieldCount').textContent=fields.length;
  }
  async function loadPage(){
    const id=$('trainingCatalog').value,n=Number($('trainingPage').value),catalog=catalogs().find(c=>c.id===id);
    if(!catalog)throw Error('Add a catalog in Setup first.');
    if(!Number.isInteger(n)||n<1||n>catalog.pageCount)throw Error('Choose a PDF page from 1 to '+catalog.pageCount+'.');
    message('Loading page locally…');boxes=[];selection=null;currentPage=null;surface.hidden=true;review();
    if(currentCatalog!==id||!doc){await doc?.destroy();doc=null;currentCatalog=null;doc=await openPdf(id);currentCatalog=id;}
    page?.cleanup();page=await doc.getPage(n);
    viewport=page.getViewport({scale:1});
    const renderView=page.getViewport({scale:Math.min(2,1500/viewport.width)});
    canvas.width=Math.ceil(renderView.width);canvas.height=Math.ceil(renderView.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport:renderView}).promise;
    const content=await page.getTextContent();
    const lib=await import('./vendor/pdf.min.mjs');
    boxes=textBoxes(content.items,viewport,lib.Util.transform);
    currentPage=n;surface.hidden=false;selection=null;overlay();review();
    const printed=Object.entries(catalog.index).find(([,pages])=>pages.includes(n))?.[0];
    message((printed?'Printed '+printed+' · ':'')+'PDF page '+n+' · '+(boxes.length?'Drag around the text you want to capture.':'No selectable text on this page. Choose a text-based page.'));
  }
  function reset(){templateId=null;fields=[];selection=null;dirty=false;$('templateName').value='';$('fieldName').value='';$('fieldPattern').value='';options();overlay();review();}
  async function open(context={}){
    if(working)return;
    openContext=context;onOpen();
    const select=$('trainingCatalog');select.replaceChildren();catalogs().forEach(c=>select.append(new Option(c.name,c.id)));
    if(!select.options.length){message('Add a PDF catalog in Setup first.');}
    if(context.catalogId)select.value=context.catalogId;
    $('trainingPage').value=context.pageNo||1;
    dialog.showModal();
    await task(async()=>{await refresh();reset();if(select.options.length)await loadPage();});
  }
  $('openTrainingButton').onclick=()=>open();
  $('closeTrainingButton').onclick=()=>{
    if(working)return;
    if(dirty&&!confirm('Close without saving template changes?'))return;
    dialog.close();page?.cleanup();page=null;doc?.destroy();doc=null;currentCatalog=null;currentPage=null;boxes=[];surface.hidden=true;canvas.width=canvas.height=1;
  };
  dialog.addEventListener('cancel',event=>{event.preventDefault();$('closeTrainingButton').click();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  $('loadTrainingPage').onclick=()=>task(loadPage);
  $('trainingCatalog').onchange=()=>{message('Press Load page to open this catalog. Templates keep their original catalog when saved.');};
  $('templateChoice').onchange=()=>task(async()=>{
    if(dirty&&!confirm('Discard unsaved template changes?')){$('templateChoice').value=templateId||'';return;}
    const t=templates.find(t=>t.id===$('templateChoice').value);
    if(!t){reset();return;}
    if(!catalogs().some(c=>c.id===t.catalogId))throw Error('This template’s catalog is missing. Reimport the PDF and create a new template.');
    templateId=t.id;fields=structuredClone(t.fields);selection=null;dirty=false;$('templateName').value=t.name;
    $('trainingCatalog').value=t.catalogId;$('trainingPage').value=openContext.catalogId===t.catalogId?openContext.pageNo:t.pageNo;await loadPage();options();
  });
  $('templateName').oninput=()=>{dirty=true;};
  $('addFieldButton').onclick=()=>{
    if(working)return;
    try{
      const field=validateField({name:$('fieldName').value.trim(),region:selection,mode:$('fieldMode').value,pattern:$('fieldPattern').value.trim()},fields);
      fields.push(field);selection=null;dirty=true;$('fieldName').value='';$('fieldPattern').value='';overlay();review();message('Field added. Mark another region or save your template.');
    }catch(error){message(error.message);}
  };
  $('saveTemplateButton').onclick=()=>task(async()=>{
    const name=$('templateName').value.trim();
    if(!name)throw Error('Give your template a name.');
    if(!fields.length)throw Error('Add at least one named field first.');
    if(!currentCatalog||!currentPage)throw Error('Load a page first.');
    const saved=templates.find(t=>t.id===templateId);
    if(saved&&saved.catalogId!==currentCatalog)throw Error('Choose New template to save fields for a different catalog.');
    fields.forEach((f,i)=>validateField(f,fields.filter((_,j)=>j!==i)));
    const template={id:templateId||crypto.randomUUID(),name:name.slice(0,100),catalogId:currentCatalog,pageNo:currentPage,fields:structuredClone(fields),updatedAt:new Date().toISOString(),schemaVersion:1};
    await saveTemplate(template);templateId=template.id;dirty=false;await refresh();message('Template saved on this device. Load another PDF page to test the same regions.');
  });
  $('deleteTemplateButton').onclick=()=>task(async()=>{
    if(!templateId||!confirm('Delete this saved template?'))return;
    await deleteTemplate(templateId);reset();await refresh();message('Template deleted.');
  });
  $('trainingZoom').onchange=()=>{surface.style.width=Number($('trainingZoom').value)+'%';};
  $('selectionMode').onchange=()=>{surface.classList.toggle('pan-mode',$('selectionMode').value==='move');};
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
  canvas.addEventListener('pointerdown',event=>{
    if(working||!page||$('selectionMode').value==='move'||event.button!==0)return;
    drag={point:point(event),id:event.pointerId};canvas.setPointerCapture(event.pointerId);event.preventDefault();
  });
  canvas.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId){selection=regionFromPoints(drag.point,point(event));overlay();}});
  canvas.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;
    selection=regionFromPoints(drag.point,point(event));drag=null;
    if(selection.width<.005||selection.height<.005){selection=null;message('Drag a rectangle around the text. Zoom in for small fields.');}
    else message('Region selected. Give it a field name below.');
    overlay();
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;selection=null;overlay();});
  return {open,refresh};
}
