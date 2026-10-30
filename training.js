import {extractFields} from './records.js';
import {createSeparator,createLayoutEditor} from './structure-ui.js';
import {createRefiner} from './refinement-ui.js';
import {refineValues} from './refinement.js';
import {textBoxes,extractField} from './extraction.js';
import {discoverPatterns,ruleKey} from './patterns.js';
export function createTraining({catalogs,openPdf,loadTemplates,saveTemplate,onOpen,onCount,onClose}){
 const $=id=>document.getElementById(id),dialog=$('trainingDialog');
 let templates=[],fields=[],suggestions=[],boxes=[],doc=null,currentCatalog=null,currentPage=null,templateId=null,working=false,context={},activeList='suggestions';
 const message=text=>{$('trainingStatus').textContent=text;};
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const button=(text,action,style='secondary')=>{const b=el('button',text,style);b.type='button';b.onclick=action;return b;};
 function options(){
  $('templateChoice').replaceChildren(new Option('Automatic · use this catalog’s patterns',''));
  for(const t of templates)$('templateChoice').append(new Option(t.name,t.id));
  $('templateChoice').value=templateId||'';onCount(templates.length);
 }
 async function refresh(){templates=await loadTemplates();options();}
 function lock(value){working=value;for(const e of dialog.querySelectorAll('button,input,select'))e.disabled=value;}
 async function task(fn){if(working)return;lock(true);try{await fn();}catch(e){message(e.message);}finally{lock(false);}}
 async function persist(next,arrangement=undefined){
  const existing=templates.find(t=>t.id===templateId);
  const catalog=catalogs().find(c=>c.id===currentCatalog);
  const item={...existing,id:templateId||crypto.randomUUID(),name:existing?.name||catalog.name+' patterns',catalogId:currentCatalog,pageNo:currentPage,fields:next,layout:arrangement===undefined?existing?.layout:arrangement,schemaVersion:3,updatedAt:new Date().toISOString()};
  await saveTemplate(item);templateId=item.id;fields=next;await refresh();
 }
 function showValues(parent,values){
  const list=el('pre',values.join('\n'),'pattern-values');parent.append(list);
 }
 function showList(name){
  activeList=name;$('suggestionsSection').hidden=name!=='suggestions';$('confirmedSection').hidden=name!=='confirmed';
  $('showSuggestions').setAttribute('aria-pressed',String(name==='suggestions'));$('showConfirmed').setAttribute('aria-pressed',String(name==='confirmed'));
 }
 $('showSuggestions').onclick=()=>showList('suggestions');$('showConfirmed').onclick=()=>showList('confirmed');
 function render(){
  const root=$('patternSuggestions');root.replaceChildren();
  const useful=suggestions.filter(p=>!fields.some(f=>f.rule&&ruleKey(f.rule)===p.key));
  $('suggestionCount').textContent=useful.length;$('showSuggestions').textContent='Suggestions ('+useful.length+')';$('showConfirmed').textContent='Saved ('+fields.length+')';showList(activeList);
  if(!useful.length)root.append(el('p',suggestions.length?'You’ve confirmed or skipped all suggestions on this page.':'No clear patterns found here. Try a page with a table or labeled values.','muted'));
  for(const proposal of useful){
   const card=el('article',undefined,'pattern-card');
   card.append(el('p',proposal.reason,'eyebrow'),el('h3',proposal.title));
   const preview=proposal.refinement?refineValues(proposal.values,proposal.refinement):null,shown=preview?.values||proposal.values;
   const samples=el('div',undefined,'pattern-samples');shown.slice(0,3).forEach(v=>samples.append(el('p',v)));card.append(samples);
   if(preview)card.append(el('p',preview.kept+' kept · '+preview.review+' to review · '+preview.excluded.length+' excluded','refine-summary'));
   const detail=el('details');detail.append(el('summary','See all '+shown.length+' values'));showValues(detail,shown);card.append(detail);
   const naming=el('div',undefined,'pattern-naming');naming.hidden=true;
   const label=el('label','What should we call this?'),input=el('input');input.value=proposal.title.slice(0,48);input.maxLength=48;input.setAttribute('aria-label','Name for '+proposal.title);label.append(input);
   naming.append(label,button('Confirm & save',()=>task(async()=>{
    const displayName=input.value.trim();if(!displayName)throw Error('Give this pattern a name first.');
    if(fields.some(f=>(f.displayName||f.name).toLowerCase()===displayName.toLowerCase()))throw Error('That name is already used. Choose a different name.');
    let name=displayName.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'field';if(!/^[a-z]/.test(name))name='field_'+name;
    const base=name;let n=2;while(fields.some(f=>f.name===name))name=base+'_'+n++;
    await persist([...fields,{name,displayName,rule:proposal.rule,...(proposal.refinement?{refinement:proposal.refinement}:{})}]);render();$('patternNotice').hidden=false;$('patternNotice').textContent='✓ Saved “'+displayName+'”. Tap Saved to review it.';message('Saved “'+displayName+'” on this device. Try it on another page.');
   }),'primary'));
   const choose=button('Name & confirm',()=>{naming.hidden=false;choose.hidden=true;input.focus();});
   const actions=el('div',undefined,'pattern-actions');actions.append(choose,button('Skip',()=>{suggestions=suggestions.filter(p=>p.key!==proposal.key);render();},'text-button'));
   const refinementHost=el('div');
   actions.append(button('Refine',()=>{
    if(refinementHost.childElementCount){refinementHost.replaceChildren();return;}
    refinementHost.append(createRefiner({name:proposal.title,values:proposal.values,teaching:proposal.refinement,saveLabel:'Use this refinement',
     onApply:refinement=>{proposal.refinement=refinement;render();message('Refinement preview updated. Name and confirm this pattern to save it.');},onCancel:()=>refinementHost.replaceChildren()}));
   }));
   card.append(actions,refinementHost,naming);root.append(card);
  }
  const confirmed=$('confirmedPatterns');confirmed.replaceChildren();$('confirmedCount').textContent=fields.length;
  if(!fields.length)confirmed.append(el('p','Patterns you confirm will save here automatically.','muted'));
  const extracted=extractFields(fields,boxes);
  const arrangement=templates.find(t=>t.id===templateId)?.layout;
  const arrangementHost=el('div');
  if(fields.length)confirmed.append(button('Arrange page results',()=>{arrangementHost.replaceChildren(createLayoutEditor({fields,boxes,layout:arrangement,onApply:layout=>task(async()=>{await persist(fields,layout);render();message('Page arrangement saved.');}),onCancel:()=>arrangementHost.replaceChildren()}));}),arrangementHost);
  if(arrangement)confirmed.append(button('Use separate pattern lists',()=>task(async()=>{await persist(fields,null);render();message('Showing separate pattern lists again.');}),'text-button'));
  for(const field of fields){
   const result=extracted.get(field.name),values=result.values||result.value.split('\n').filter(Boolean),card=el('article',undefined,'pattern-card confirmed-pattern');
   card.append(el('p',result.rawValues?.length||result.value?'SAVED · CHECK VALUES':'SAVED · NOT FOUND HERE','eyebrow'),el('h3',field.displayName||field.name));
   if(field.refinement)card.append(el('p',result.status,'refine-summary'));
   if(values.length){const detail=el('details');detail.append(el('summary',values.length+' value(s) · '+values[0].slice(0,90)));showValues(detail,values);card.append(detail);}
   else card.append(el('p',result.status,'muted'));
   if(result.excluded?.length){const excluded=el('details');excluded.append(el('summary',result.excluded.length+' excluded value(s)'));showValues(excluded,result.excluded.map(r=>r.value+' — '+r.reason));card.append(excluded);}
   const refinementHost=el('div');
   card.append(button('Refine',()=>{
    if(refinementHost.childElementCount){refinementHost.replaceChildren();return;}
    refinementHost.append(createRefiner({name:field.displayName||field.name,values:result.rawValues||result.values||result.value.split('\n').filter(Boolean),teaching:field.refinement,
     onApply:refinement=>task(async()=>{
      const next={...field};if(refinement.keep.length||refinement.reject.length)next.refinement=refinement;else delete next.refinement;
      await persist(fields.map(f=>f.name===field.name?next:f));render();message('Refinement saved. It will apply when this pattern is used on other pages.');
     }),onCancel:()=>refinementHost.replaceChildren()}));
   }));card.append(refinementHost);
   card.append(button('Separate',()=>{
    refinementHost.replaceChildren(createSeparator({field,fields,results:extracted,onApply:(next,children)=>task(async()=>{
     const layout=arrangement?{...arrangement,fields:arrangement.fields.flatMap(n=>n===field.name?children:[n])}:undefined;
     await persist(next,layout);render();message('Separate patterns saved. The original is retained as their source.');
    }),onCancel:()=>refinementHost.replaceChildren()}));
   }));
   card.append(button(field.hidden?'Show on page':'Hide from page',()=>task(async()=>{
    let layout=arrangement?structuredClone(arrangement):undefined;
    if(layout){layout.fields=field.hidden?[...new Set([...layout.fields,field.name])]:layout.fields.filter(n=>n!==field.name);if(!layout.fields.length)throw Error('Keep at least one field in the arrangement.');}
    await persist(fields.map(f=>f.name===field.name?{...f,hidden:!f.hidden}:f),layout);render();
   }),'text-button'));
   if(field.source)card.append(el('small','Derived from '+(fields.find(f=>f.name===field.source)?.displayName||field.source),'muted'));
   card.append(button('Remove pattern',()=>task(async()=>{
    if(fields.some(f=>f.source===field.name))throw Error('This is a source for split patterns. Remove its derived patterns first.');
    if(arrangement&&(arrangement.anchor===field.name||arrangement.fields.includes(field.name)||arrangement.levels.some(l=>l.field===field.name)))throw Error('This pattern is in the page arrangement. Change the arrangement first.');
    await persist(fields.filter(f=>f.name!==field.name));render();message('Pattern removed from this saved set.');
   }),'text-button'));
   confirmed.append(card);
  }
 }
 async function readPage(n){
  const page=await doc.getPage(n);try{const lib=await import('./vendor/pdf.min.mjs');return textBoxes((await page.getTextContent()).items,page.getViewport({scale:1}),lib.Util.transform);}finally{page.cleanup();}
 }
 function pageNumber(catalog,input){
  const value=input.trim().toUpperCase();if(!value)return null;
  if(catalog.index[value]){if(catalog.index[value].length>1)throw Error('This ID has several pages. Enter its PDF page number instead.');return catalog.index[value][0];}
  const n=Number(value);if(!Number.isInteger(n)||n<1||n>catalog.pageCount)throw Error('Enter a printed page ID or PDF page from 1 to '+catalog.pageCount+'.');return n;
 }
 async function scan(){
  const id=$('trainingCatalog').value,catalog=catalogs().find(c=>c.id===id);if(!catalog)throw Error('Add a PDF catalog in Setup first.');
  // Validate the requested page before changing the current selection.
  let n=pageNumber(catalog,$('trainingPage').value);
  if(currentCatalog!==id||!doc){await doc?.destroy();doc=await openPdf(id);currentCatalog=id;fields=[];}
  const chosen=templates.find(t=>t.id===templateId&&t.catalogId===id)||templates.find(t=>t.catalogId===id&&t.schemaVersion>=2);
  templateId=chosen?.id||null;fields=structuredClone(chosen?.fields||[]);currentPage=null;boxes=[];suggestions=[];$('pagePreviewDetails').hidden=true;render();
  if(n===null){
   const pages=[...new Set(Object.values(catalog.index).flat())].sort((a,b)=>a-b).slice(0,20);if(!pages.length)pages.push(1);
   let best={score:-1,n:pages[0],boxes:[]};
   for(const candidate of pages){
    message('Looking for useful patterns · checking PDF page '+candidate+'…');
    const sample=await readPage(candidate),found=discoverPatterns(sample),columns=found.filter(p=>p.rule.kind==='column').length;
    const score=columns*10+found.length;if(score>best.score)best={score,n:candidate,boxes:sample};
    if(columns>=2)break;await new Promise(r=>setTimeout(r,0));
   }
   n=best.n;boxes=best.boxes;
  }else{message('Scanning page locally…');boxes=await readPage(n);}
  suggestions=discoverPatterns(boxes).sort((a,b)=>(b.rule.kind==='column'?b.values.length:0)-(a.rule.kind==='column'?a.values.length:0));currentPage=n;$('patternNotice').hidden=true;
  const printed=Object.entries(catalog.index).find(([,pages])=>pages.includes(n))?.[0];
  $('trainingPage').value=printed||String(n);$('scannedPageLabel').textContent=(printed?'Printed '+printed+' · ':'')+'PDF page '+n;
  const page=await doc.getPage(n);try{const base=page.getViewport({scale:1}),v=page.getViewport({scale:Math.min(1.5,1000/base.width)}),canvas=$('trainingCanvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;}finally{page.cleanup();}
  $('pagePreviewDetails').hidden=false;$('patternSourceDetails').open=false;options();render();message(suggestions.length?'Found '+suggestions.length+' possible patterns. Keep the ones that look useful.':'No clear patterns found. Try a page with a table or labeled values.');
 }
 async function open(initial={}){
  if(working)return;context=initial;activeList='suggestions';$('patternNotice').hidden=true;onOpen();
  $('trainingCatalog').replaceChildren(...catalogs().map(c=>new Option(c.name,c.id)));
  if(initial.catalogId)$('trainingCatalog').value=initial.catalogId;
  $('trainingPage').value=initial.pageNo||'';dialog.showModal();
  await task(async()=>{await refresh();templateId=initial.templateId||null;fields=[];suggestions=[];boxes=[];render();if(catalogs().length)await scan();else message('Add a PDF catalog in Setup first.');if(initial.tab==='saved'){showList('confirmed');if(initial.arrange)$('confirmedPatterns').querySelector('button')?.click();}});
 }
 $('openTrainingButton').onclick=()=>open();
 $('closeTrainingButton').onclick=()=>{if(working)return;dialog.close();doc?.destroy();doc=null;currentCatalog=null;currentPage=null;$('trainingCanvas').width=$('trainingCanvas').height=1;Promise.resolve(onClose?.()).catch(e=>message(e.message));};
 dialog.addEventListener('cancel',e=>{e.preventDefault();$('closeTrainingButton').click();});dialog.addEventListener('keydown',e=>e.stopPropagation());
 $('loadTrainingPage').onclick=()=>task(scan);
 $('trainingPage').onkeydown=e=>{if(e.key==='Enter')task(scan);};
 $('trainingCatalog').onchange=()=>{$('trainingPage').value='';suggestions=[];fields=[];boxes=[];templateId=null;currentPage=null;$('scannedPageLabel').textContent='';$('pagePreviewDetails').hidden=true;render();message('Catalog selected. Tap Scan page to find its patterns.');};
 $('templateChoice').onchange=()=>task(async()=>{
  const t=templates.find(t=>t.id===$('templateChoice').value);
  if(t){$('trainingCatalog').value=t.catalogId;templateId=t.id;$('trainingPage').value=context.catalogId===t.catalogId?context.pageNo:t.pageNo;}
  else templateId=null;
  await scan();showList('confirmed');
 });
 return {open,refresh};
}
