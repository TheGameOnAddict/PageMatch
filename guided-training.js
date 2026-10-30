import {discoverPatterns} from './patterns.js';
import {words,columnForSelection,visualExample,extractVisual,publishTrainedSet,trainingReady} from './visual-patterns.js';
import {textBoxes} from './extraction.js';
import {extractFields,uniqueFieldName} from './records.js';
import {element as el,renderRecords} from './records-ui.js';
import {createRefiner} from './refinement-ui.js';
import {refineResult} from './refinement.js';
export function createGuidedTraining({catalogs,openPdf,saveTemplate,loadTemplates,onOpen,onClose,refresh,legacy}){
 const dialog=el('dialog',undefined,'training-dialog guided-dialog');dialog.setAttribute('aria-label','Pattern setup');document.body.append(dialog);
 let doc=null,catalogId=null,pages=[],samples=new Map(),fields=[],layout=null,active=0,stage=0,busy=false,draft=null,selected=[],zoom=1,initial={},groupSelection=new Set(),editingId=null;
 const header=el('header',undefined,'training-header'),title=el('h2','Pattern setup'),close=button('Done',()=>closeDialog());header.append(title,close);
 const notice=el('p','','guided-notice');notice.setAttribute('role','status');
 const content=el('div',undefined,'guided-content');dialog.append(header,notice,content);
 function button(text,action,style='secondary'){const b=el('button',text,style);b.type='button';b.onclick=action;return b;}
 function message(text){notice.textContent=text;}
 async function task(fn){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{await fn();}catch(e){message(e.message);}finally{busy=false;dialog.removeAttribute('aria-busy');}}
 function label(text,input){const l=el('label',text);l.append(input);return l;}
 function input(value,placeholder){const i=el('input');i.value=value||'';i.placeholder=placeholder||'';return i;}
 function select(options,value){const s=el('select');s.replaceChildren(...options.map(([v,t])=>new Option(t,v)));if(value!==undefined)s.value=value;return s;}
 function closeDialog(){if(busy)return;dialog.close();Promise.resolve(onClose?.()).catch(e=>message(e.message));}
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});dialog.addEventListener('keydown',e=>e.stopPropagation());
 function pageNumber(value,catalog){
  const v=value.trim().toUpperCase(),found=catalog.index[v];if(found?.length===1)return found[0];
  const n=Number(v);if(!Number.isInteger(n)||n<1||n>catalog.pageCount)throw Error('Enter a unique printed page ID or PDF page from 1 to '+catalog.pageCount+'.');return n;
 }
 function printed(n){const c=catalogs().find(c=>c.id===catalogId);return Object.entries(c.index).find(([,p])=>p.includes(n))?.[0]||'PDF '+n;}
 async function read(n,render=true){
  if(samples.has(n)&&(!render||samples.get(n).image))return samples.get(n);
  const page=await doc.getPage(n);
  try{
   const lib=await import('./vendor/pdf.min.mjs'),viewport=page.getViewport({scale:1}),boxes=textBoxes((await page.getTextContent()).items,viewport,lib.Util.transform);
   const sample={pageNo:n,boxes,tokens:words(boxes),columns:discoverPatterns(boxes).filter(p=>p.rule.kind==='column')};
   if(render){const view=page.getViewport({scale:Math.min(2,1400/viewport.width)}),canvas=el('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;sample.image=canvas;}
   samples.set(n,sample);return sample;
  }finally{page.cleanup();}
 }
 async function loadCatalog(id){if(id===catalogId&&doc)return;await doc?.destroy();doc=await openPdf(id);catalogId=id;samples.clear();fields=[];pages=[];draft=null;layout=null;editingId=null;groupSelection.clear();}
 function choosePages(){
  stage=0;title.textContent='1 · Choose two pages';content.replaceChildren();message('Use two pages with the same kind of table. Your current saved patterns keep working.');
  const available=catalogs();if(!available.length){content.append(el('p','Add a PDF catalog in Setup first.'));return;}
  const catalog=select(available.map(c=>[c.id,c.name]),catalogId||initial.catalogId),a=input(pages[0]||initial.pageNo||'','e.g. 1H18 or 190'),b=input(pages[1]||'','A different page');
  const intro=el('p','Teach with real examples. Nothing is saved until you check every pattern on both pages.','muted');
  const actions=el('div',undefined,'guided-actions');
  async function prepare(auto){
   const c=available.find(c=>c.id===catalog.value);if(c.pageCount<2)throw Error('This catalog has only one page. Add a catalog with at least two pages to train patterns.');
   const entered=[a.value,b.value];await loadCatalog(c.id);
   let chosen=[];
   if(auto){
    message('Finding two table pages locally…');
    const start=entered[0].trim()?pageNumber(entered[0],c):null;
    const candidates=[...new Set([...(start?[start]:[]),...Object.values(c.index).flat().sort((a,b)=>a-b)])];
    const ordered=start?[...candidates.filter(n=>n>=start),...candidates.filter(n=>n<start)]:candidates;
    for(const n of ordered.slice(0,80)){const s=await read(n,false);if(s.columns.length>=2)chosen.push(n);if(chosen.length===2)break;}
    if(chosen.length<2)throw Error('Couldn’t find two table pages automatically. Enter two page IDs above.');
   }else{chosen=entered.map(v=>pageNumber(v,c));if(chosen[0]===chosen[1])throw Error('Choose two different PDF pages. Two names for the same page count as one.');}
   if(fields.length&&pages.join()!==chosen.join()){fields=[];layout=null;}
   pages=chosen;for(const n of pages){message('Opening '+printed(n)+'…');await read(n);}
   active=0;stage=1;workspace();
  }
  actions.append(button('Open these pages',()=>task(()=>prepare(false)),'primary'),button('Find two table pages for me',()=>task(()=>prepare(true))));
  content.append(intro,label('Catalog',catalog),label('First page',a),label('Second page',b),actions);
  const saved=el('section',undefined,'guided-saved');content.append(saved);
  loadTemplates().then(sets=>{if(stage!==0||!dialog.open||!content.contains(saved))return;if(sets.length)saved.append(el('h3','Your saved pattern sets'));for(const set of sets)saved.append(button('Edit '+set.name,()=>{if(busy)return;if(set.schemaVersion===4)open({catalogId:set.catalogId,templateId:set.id});else{closeDialog();legacy.open({catalogId:set.catalogId,templateId:set.id,tab:'saved'});}},'text-button'));}).catch(e=>message(e.message));
 }
 function result(field,pageIndex){const s=samples.get(pages[pageIndex]);return refineResult(extractVisual(field.rule,s.boxes,s.columns),field.refinement);}
 function invalidate(){draft.training.confirmed=[];}
 function chooseTokens(tokens,preserveScroll=false){
  const s=samples.get(pages[active]),column=columnForSelection(tokens,s.columns),example=visualExample(tokens,column,s.pageNo);
  const prior=draft?.rule.examples||[];
  if(!draft)draft={name:'',displayName:'',rule:{kind:'visual-column',examples:[]},training:{catalogId,confirmed:[]}};
  draft.rule.examples=[...prior.filter(e=>e.pageNo!==s.pageNo),example];invalidate();workspace(preserveScroll);
 }
 function selectionClick(token){
  // Selecting distant columns is rejected rather than silently merging fields.
  const next=selected.includes(token.id)?selected.filter(id=>id!==token.id):[...selected,token.id];
  if(!next.length){selected=[];return;}
  const s=samples.get(pages[active]),tokens=s.tokens.filter(t=>next.includes(t.id));
  try{columnForSelection(tokens,s.columns);selected=next;chooseTokens(tokens,true);}catch(e){message(e.message);}
 }
 function workspace(preserveScroll=false){
  const previousScroll=content.scrollTop;
  stage=1;title.textContent='2 · Select & confirm';content.replaceChildren();
  message(draft?'Check the highlighted values on both pages. Changing a selection resets both confirmations.':'Tap a suggested column, or tap the specific pieces on the page you want to capture.');
  const tabs=el('div',undefined,'guided-tabs');pages.forEach((n,i)=>{const b=button((i+1)+': '+printed(n)+(draft?.training.confirmed.includes(n)?' ✓':''),()=>{active=i;selected=[];workspace();});b.setAttribute('aria-pressed',String(active===i));tabs.append(b);});content.append(tabs);
  const toolbar=el('div',undefined,'guided-actions');toolbar.append(button('−',()=>{zoom=Math.max(1,zoom-.5);drawPage();}),button('Zoom +',()=>{zoom=Math.min(4,zoom+.5);drawPage();}),button('Reset selection',()=>{draft=null;selected=[];workspace();},'text-button'));content.append(toolbar);
  const tip=el('p','Tap a small piece to separate it. Tap more examples to widen the selection. Zoom in for small text.','muted');content.append(tip);
  const viewport=el('div',undefined,'visual-page-scroll'),surface=el('div',undefined,'visual-page');viewport.append(surface);content.append(viewport);
  const s=samples.get(pages[active]);
  function drawPage(){
   surface.replaceChildren();surface.style.width=(zoom*100)+'%';surface.append(s.image);
   const selectedCells=draft?result(draft,active).entries?.flatMap(e=>e.cells)||[]:[];
   for(const t of s.tokens){
    const b=button(t.text,()=>selectionClick(t),'visual-word');b.setAttribute('aria-label','Select '+t.text+' on PDF page '+s.pageNo);
    b.style.left=t.x*100+'%';b.style.top=t.y*100+'%';b.style.width=Math.max(.003,t.width)*100+'%';b.style.height=t.height*100+'%';
    const chosen=selectedCells.some(c=>c.id===t.id||c.wordId===t.id);b.setAttribute('aria-pressed',String(chosen));b.title=t.text;if(!selectedCells.some(c=>c.id===t.id))b.classList.add('partial-selection');surface.append(b);
   }
   for(const c of selectedCells.filter(c=>c.wordId)){const mark=el('span',undefined,'visual-highlight');mark.style.left=c.x*100+'%';mark.style.top=c.y*100+'%';mark.style.width=c.width*100+'%';mark.style.height=c.height*100+'%';surface.append(mark);}
  }drawPage();
  const last=s.tokens.find(t=>t.id===selected.at(-1));
  if(last&&last.text.length>1){
   const part=el('details',undefined,'character-picker');part.append(el('summary','Select only part of “'+last.text+'”'));
   const strip=el('div',undefined,'character-strip');let start=null,end=null;
   [...last.text].forEach((ch,i)=>{const b=button(ch,()=>{if(start===null||end!==null){start=i;end=null;}else end=i;const a=Math.min(start,end??start),z=Math.max(start,end??start);[...strip.children].forEach((c,n)=>c.setAttribute('aria-pressed',String(n>=a&&n<=z)));});b.setAttribute('aria-label','Character '+(i+1)+': '+ch);strip.append(b);});
   part.append(el('p','Tap the first and last character you want to keep.'),strip,button('Use selected characters',()=>{if(start===null){message('Choose the first and last character.');return;}const a=Math.min(start,end??start),z=Math.max(start,end??start)+1;chooseTokens([{...last,text:last.text.slice(a,z),x:last.x+last.width*a/last.text.length,width:last.width*(z-a)/last.text.length,characters:true}]);}));content.append(part);
  }
  const suggestions=el('details',undefined,'guided-suggestions');suggestions.open=!draft;suggestions.append(el('summary','Suggested columns · '+s.columns.length));
  for(const c of s.columns){const b=button(c.title+' · '+c.values.length+' values',()=>{selected=[];const cells=c.entries.flatMap(e=>e.cells);const tokens=s.tokens.filter(t=>cells.some(b=>Math.abs(t.y-b.y)<.0001&&t.x>=b.x-.002&&t.x+t.width<=b.x+b.width+.002));try{chooseTokens(tokens);}catch(e){message(e.message);}});suggestions.append(b);}content.append(suggestions);
  if(draft){
   const name=input(draft.displayName,'e.g. Part number');name.maxLength=48;name.oninput=()=>{draft.displayName=name.value;};content.append(label('Pattern name',name));
   const extracted=result(draft,active),preview=el('details',undefined,'guided-values');preview.open=true;preview.append(el('summary',extracted.values.length+' captured values · check all of them'),el('pre',extracted.values.join('\n')||'Nothing captured here','pattern-values'));content.append(preview);
   const refiner=el('div');content.append(button('Remove unwanted values',()=>{refiner.replaceChildren(createRefiner({name:draft.displayName||'This pattern',values:extractVisual(draft.rule,s.boxes,s.columns).values,teaching:draft.refinement,saveLabel:'Update selection',onApply:teaching=>{draft.refinement=teaching;invalidate();workspace();},onCancel:()=>refiner.replaceChildren()}));}),refiner);
   const confirmed=draft.training.confirmed.includes(s.pageNo),confirm=button(confirmed?'✓ Page confirmed':'Confirm these values on this page',()=>{
    if(!draft.displayName.trim()){message('Name this pattern first.');name.focus();return;}
    if(!extracted.values.length){message('Select values on this page before confirming.');return;}
    draft.training.confirmed=[...new Set([...draft.training.confirmed,s.pageNo])];
    if(draft.training.confirmed.length<2){active=active===0?1:0;selected=[];workspace();message('Now check the same pattern on the other page. Adjust the selection if needed, then confirm.');}else workspace();
   },'primary');confirm.disabled=confirmed;content.append(confirm);
   const add=button('Keep this pattern',()=>{
    if(!draft.displayName.trim()){message('Name this pattern first.');name.focus();return;}
    if(fields.some(f=>f.name!==draft.name&&f.displayName.toLowerCase()===draft.displayName.trim().toLowerCase())){message('Use a different name for this pattern.');return;}
    const ready=trainingReady([draft],pages,catalogId);if(!ready.ok){message(ready.reason);return;}
    draft.displayName=draft.displayName.trim();draft.name=draft.name||uniqueFieldName(draft.displayName,fields);const previous=fields.findIndex(f=>f.name===draft.name);if(previous<0)fields.push(structuredClone(draft));else fields[previous]=structuredClone(draft);draft=null;selected=[];workspace();message('Pattern kept. Add another piece, or continue to grouping.');
   },'primary');add.disabled=!trainingReady([draft],pages,catalogId).ok;content.append(add);
  }
  const kept=el('section',undefined,'guided-kept');kept.append(el('h3','Confirmed patterns · '+fields.length));for(const f of fields){const row=el('div',undefined,'guided-kept-row');row.append(el('span',f.displayName+' · checked on 2 pages'),button('Change selection',()=>{draft=structuredClone(f);selected=[];workspace();},'text-button'),button('Remove',()=>{fields=fields.filter(v=>v!==f);layout=null;workspace();},'text-button'));kept.append(row);}content.append(kept);
  const next=button('Continue to grouping →',()=>{if(draft){message('Keep this pattern or reset its selection first.');return;}groups();},'primary');next.disabled=!fields.length;content.append(next,button('Change training pages',()=>{choosePages();},'text-button'));content.scrollTop=preserveScroll?previousScroll:0;
 }
 function groups(){
  stage=2;title.textContent='3 · Group & preview';content.replaceChildren();message('Select patterns that belong together, then make a group. Add another group inside it if you need one.');
  const selectedFields=el('div',undefined,'guided-field-list');for(const f of fields){const check=el('input');check.type='checkbox';check.checked=groupSelection.has(f.name);check.onchange=()=>{if(check.checked)groupSelection.add(f.name);else groupSelection.delete(f.name);};selectedFields.append(label(f.displayName,check));}content.append(selectedFields);
  const groupForm=el('div');content.append(button('Group selected patterns',()=>{
   const chosen=fields.filter(f=>groupSelection.has(f.name));if(chosen.length<2){message('Select at least two patterns, including the value that starts the group.');return;}
   groupForm.replaceChildren();const name=input('','e.g. Index'),marker=select(chosen.map(f=>[f.name,f.displayName])),when=select([['change','When this value changes'],['filled','Every time this value appears']]);
   groupForm.append(label('Group name',name),label('Start a new group using',marker),label('Start condition',when),button('Add group',()=>{
    if(!name.value.trim()){message('Name this group first.');return;}
    if(layout?.levels.length>=8){message('This arrangement already has eight group levels.');return;}
    if(layout?.levels.some(l=>l.field===marker.value)){message('That value already starts a group. Choose a different pattern.');return;}
    const remaining=chosen.filter(f=>f.name!==marker.value&&!layout?.levels.some(l=>l.field===f.name));
    if(!remaining.length){message('Keep a separate pattern to identify each row.');return;}
    layout=layout||{version:1,levels:[],anchor:remaining[0].name,fields:chosen.map(f=>f.name),expandGroups:false};
    layout.fields=[...new Set([...layout.fields,...chosen.map(f=>f.name)])];layout.levels.push({field:marker.value,label:name.value.trim(),start:when.value,members:chosen.map(f=>f.name)});if(layout.anchor===marker.value)layout.anchor=remaining[0].name;groupSelection.clear();groups();
   },'primary'),button('Cancel',()=>groupForm.replaceChildren(),'text-button'));
  }),groupForm);
  if(layout?.levels.length){
   const list=el('ol',undefined,'guided-group-list');layout.levels.forEach((l,i)=>{const row=el('li');row.append(el('span',(i?'Inside the previous group: ':'')+l.label+' · '+fields.find(f=>f.name===l.field).displayName+' · '+(l.start==='change'?'when it changes':'each appearance')+' · contains '+(l.members||layout.fields).map(n=>fields.find(f=>f.name===n)?.displayName).filter(Boolean).join(', ')),button('Remove group',()=>{layout.levels.splice(i,1);if(!layout.levels.length)layout=null;groups();},'text-button'));list.append(row);});content.append(list);
   const anchors=fields.filter(f=>!layout.levels.some(l=>l.field===f.name));const anchor=select(anchors.map(f=>[f.name,f.displayName]),layout.anchor);anchor.onchange=()=>{layout.anchor=anchor.value;preview();};content.append(label('Each new row starts with',anchor));
   const visible=el('details');visible.append(el('summary','Choose what appears in each row'));fields.forEach(f=>{const c=el('input');c.type='checkbox';c.checked=layout.fields.includes(f.name);c.onchange=()=>{if(c.checked)layout.fields.push(f.name);else if(layout.fields.length>1)layout.fields=layout.fields.filter(n=>n!==f.name);else c.checked=true;preview();};visible.append(label(f.displayName,c));});content.append(visible);
  }
  const previewHost=el('div',undefined,'guided-group-preview');
  const tabs=el('div',undefined,'guided-tabs');pages.forEach((n,i)=>tabs.append(button(printed(n),()=>{active=i;preview();})));content.append(el('h3','Preview your results'),tabs,previewHost);
  function preview(){previewHost.replaceChildren();const results=extractFields(fields,samples.get(pages[active]).boxes);if(layout)previewHost.append(renderRecords(fields,results,layout));else for(const f of fields){const d=el('details');d.append(el('summary',f.displayName+' · '+results.get(f.name).values.length+' values'),el('pre',results.get(f.name).value,'pattern-values'));previewHost.append(d);}}preview();
  content.append(button('Save & use these patterns',()=>task(async()=>{
   const c=catalogs().find(c=>c.id===catalogId),set=publishTrainedSet({id:editingId||crypto.randomUUID(),name:c.name+' · trained patterns',pageNo:pages[0],fields,layout},pages,catalogId);
   await saveTemplate(set);await refresh();fields=[];layout=null;draft=null;pages=[];stage=0;editingId=null;dialog.close();await onClose?.();
  }),'primary'),button('← Add or change patterns',()=>workspace(),'text-button'));content.scrollTop=0;
 }
 async function open(context={}){
  if(context.templateId){
   const set=(await loadTemplates()).find(t=>t.id===context.templateId);
   if(!set||set.schemaVersion!==4)return legacy.open(context);
   onOpen();if(!dialog.open)dialog.showModal();
   await task(async()=>{message('Opening your checked examples…');await loadCatalog(set.catalogId);editingId=set.id;pages=[...set.training.pages];fields=structuredClone(set.fields);layout=structuredClone(set.layout);draft=null;for(const n of pages)await read(n);active=0;groups();});return;
  }
  initial=context;onOpen();if(!dialog.open)dialog.showModal();
  if(catalogId&&!catalogs().some(c=>c.id===catalogId)){await doc?.destroy();doc=null;catalogId=null;fields=[];pages=[];draft=null;layout=null;samples.clear();}
  if(stage===1&&pages.length===2)workspace();else if(stage===2&&fields.length)groups();else choosePages();
 }
 return {open};
}
