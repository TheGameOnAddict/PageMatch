import {extractFields,uniqueFieldName,validateLayout,splitValue} from './records.js';
import {refineValues} from './refinement.js';
import {element as el,renderRecords} from './records-ui.js';
const button=(text,fn,cls='secondary')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
const input=(label,value)=>{const root=el('label',label),control=el('input');control.value=value;control.maxLength=60;root.append(control);return {root,control};};
const select=(label,choices,value)=>{const root=el('label',label),control=el('select');choices.forEach(([name,key])=>control.append(new Option(name,key)));control.value=value;root.append(control);return {root,control};};
const reveal=panel=>requestAnimationFrame(()=>{if(panel.isConnected)panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
export function createSeparator({field,fields,results,onApply,onCancel}){
 const panel=el('section',undefined,'structure-panel');panel.setAttribute('aria-label','Separate '+(field.displayName||field.name));
 panel.append(el('h4','Separate '+(field.displayName||field.name)),el('p','Create two named patterns from this one. Check the preview before saving.','muted'));
 const values=results.get(field.name)?.values||[],unique=[...new Set(values)];
 const mode=select('What needs separating?',[['Two pieces in each line','split'],['Some whole values belong elsewhere','examples']],'split');
 const left=input('First pattern name',(field.displayName||field.name)+' — first'),right=input('Second pattern name',(field.displayName||field.name)+' — second');
 const example=select('Example line',unique.map((v,i)=>[v,String(i)]),'0');
 const method=select('Split using',[['Words in the example','words'],['A separator in the text','delimiter']],'words');
 const from=select('Keep a fixed number of words on the',[['Left','left'],['Right','right']],'left');
 const cut=select('Words to keep on that side',[],'1'),delimiter=input('Separator text','');
 const unsplit=select('If a line cannot be split, it belongs to',[['Second pattern','after'],['First pattern','before']],'after');
 const controls=el('div',undefined,'structure-controls');controls.append(example.root,method.root,from.root,cut.root,delimiter.root,unsplit.root);
 const advanced=el('details');advanced.append(el('summary','Adjust how each line is split'),controls);
 const picks=el('div',undefined,'refine-examples');picks.hidden=true;const selected=new Set();
 unique.forEach(v=>{const label=el('label',v,'pick-example'),check=el('input');check.type='checkbox';check.onchange=()=>{if(check.checked)selected.add(v);else selected.delete(v);preview();};label.prepend(check);picks.append(label);});
 const notice=el('p',undefined,'record-warning');notice.setAttribute('role','status');const output=el('div',undefined,'split-preview');
 function cuts(){const n=(unique[Number(example.control.value)]||'').trim().split(/\s+/).length;const old=cut.control.value;cut.control.replaceChildren();for(let i=1;i<Math.max(2,n);i++)cut.control.append(new Option(String(i),String(i)));cut.control.value=[...cut.control.options].some(o=>o.value===old)?old:'1';}
 function config(side){return {kind:method.control.value,at:Number(cut.control.value)||1,fromEnd:from.control.value==='right',delimiter:delimiter.control.value,unsplit:unsplit.control.value,side};}
 function pair(value){if(mode.control.value==='examples'){const move=refineValues([value],{keep:[...selected],reject:[]}).rows[0].decision==='keep';return move?['',value]:[value,''];}return [splitValue(value,config('before')),splitValue(value,config('after'))];}
 function preview(){
  const splitting=mode.control.value==='split';advanced.hidden=!splitting;controls.hidden=false;picks.hidden=splitting;delimiter.root.hidden=method.control.value!=='delimiter';from.root.hidden=cut.root.hidden=method.control.value!=='words';
  output.replaceChildren(el('h5','Preview'));
  const table=el('table'),head=el('tr');head.append(el('th',left.control.value||'First'),el('th',right.control.value||'Second'));table.append(head);
  values.slice(0,10).forEach(value=>{const row=el('tr');pair(value).forEach(v=>row.append(el('td',v||'—')));table.append(row);});output.append(table,el('p','Previewing up to 10 lines. Blank cells keep their original row positions.','muted'));
 }
 mode.control.onchange=preview;method.control.onchange=preview;from.control.onchange=preview;cut.control.onchange=preview;unsplit.control.onchange=preview;delimiter.control.oninput=preview;left.control.oninput=preview;right.control.oninput=preview;example.control.onchange=()=>{cuts();preview();};
 panel.append(mode.root,left.root,right.root,advanced,picks,output,notice);
 panel.append(button('Save separate patterns',()=>{
  try{
   const a=left.control.value.trim(),b=right.control.value.trim();if(!a||!b||a.toLowerCase()===b.toLowerCase())throw Error('Give the two patterns different names.');
   if(fields.some(f=>[a.toLowerCase(),b.toLowerCase()].includes((f.displayName||f.name).toLowerCase())))throw Error('Choose names that are not already in use.');
   if(mode.control.value==='split'&&method.control.value==='delimiter'&&!delimiter.control.value)throw Error('Enter the separator text first.');
   if(mode.control.value==='examples'&&!selected.size)throw Error('Select the values that belong in the second pattern.');
   const source=fields.map(f=>f.name===field.name?{...f,hidden:true}:f),first={name:uniqueFieldName(a,source),displayName:a,source:field.name};
   const second={name:uniqueFieldName(b,[...source,first]),displayName:b,source:field.name};
   if(mode.control.value==='split'){first.split=config('before');second.split=config('after');}else{first.partition={examples:[...selected],side:'other'};second.partition={examples:[...selected],side:'selected'};}
   onApply([...source,first,second],[first.name,second.name]);
  }catch(error){notice.textContent=error.message;}
 },'primary'),button('Cancel',onCancel,'text-button'));cuts();preview();reveal(panel);return panel;
}
export function createLayoutEditor({fields,boxes,layout,onApply,onCancel}){
 const visible=fields.filter(f=>!f.hidden),all=fields.map(f=>[f.displayName||f.name,f.name]);
 let draft=structuredClone(layout||{version:1,levels:[],anchor:visible[0]?.name||fields[0]?.name,fields:visible.map(f=>f.name),expandGroups:false});
 const panel=el('section',undefined,'structure-panel');panel.setAttribute('aria-label','Arrange page results');panel.append(el('h4','Arrange page results'),el('p','Choose group levels, then the fields belonging to each row. Blank group cells continue the previous group on this page.','muted'));
 const groupList=el('div'),notice=el('p',undefined,'record-warning'),output=el('div');notice.setAttribute('role','status');
 const anchor=select('Each row starts with',all,draft.anchor);anchor.control.onchange=()=>{draft.anchor=anchor.control.value;preview();};
 const checks=el('div',undefined,'layout-field-list');
 function fieldChecks(){checks.replaceChildren(el('h5','Show these fields in each row'));
  const ordered=[...draft.fields,...fields.map(f=>f.name).filter(n=>!draft.fields.includes(n))];
  for(const name of ordered){const f=fields.find(f=>f.name===name);if(!f)continue;const line=el('div',undefined,'layout-field');
   const label=el('label',f.displayName||f.name),check=el('input');check.type='checkbox';check.checked=draft.fields.includes(name);check.onchange=()=>{if(check.checked)draft.fields.push(name);else draft.fields=draft.fields.filter(n=>n!==name);fieldChecks();preview();};label.prepend(check);line.append(label);
   if(check.checked){const i=draft.fields.indexOf(name);line.append(button('↑',()=>{if(i){[draft.fields[i-1],draft.fields[i]]=[draft.fields[i],draft.fields[i-1]];fieldChecks();preview();}}),button('↓',()=>{if(i<draft.fields.length-1){[draft.fields[i+1],draft.fields[i]]=[draft.fields[i],draft.fields[i+1]];fieldChecks();preview();}}));}checks.append(line);
  }
 }
 function groups(){groupList.replaceChildren();draft.levels.forEach((level,i)=>{
  const row=el('div',undefined,'layout-level');row.style.marginLeft=i*10+'px';row.append(el('h5','Level '+(i+1)));
  const by=select('Group '+(i+1)+' by',all,level.field),label=input('Group '+(i+1)+' name',level.label||'');
  const start=select('Start a new group',[['Whenever this pattern has a value','filled'],['Only when its value changes','change']],level.start||'filled');
  by.control.onchange=()=>{level.field=by.control.value;level.label=fields.find(f=>f.name===level.field)?.displayName||level.field;groups();preview();};label.control.oninput=()=>{level.label=label.control.value;preview();};start.control.onchange=()=>{level.start=start.control.value;preview();};
  row.append(by.root,label.root,start.root,button('Move up',()=>{if(i){[draft.levels[i-1],draft.levels[i]]=[draft.levels[i],draft.levels[i-1]];groups();preview();}}),button('Remove level',()=>{draft.levels.splice(i,1);groups();preview();},'text-button'));groupList.append(row);
 });}
 function preview(){output.replaceChildren();notice.textContent='';try{output.append(renderRecords(fields,extractFields(fields,boxes),draft));}catch(e){notice.textContent=e.message;}}
 const expand=el('label','Expand groups automatically'),toggle=el('input');toggle.type='checkbox';toggle.checked=Boolean(draft.expandGroups);toggle.onchange=()=>{draft.expandGroups=toggle.checked;preview();};expand.prepend(toggle);
 panel.append(groupList,button('Add a group level',()=>{const f=fields.find(f=>!draft.levels.some(l=>l.field===f.name));if(!f)return;draft.levels.push({field:f.name,label:f.displayName||f.name,start:'filled'});groups();preview();}),anchor.root,checks,expand,notice,el('h4','Page preview'),output,
  button('Save arrangement',()=>{try{validateLayout(draft,fields);onApply(structuredClone(draft));}catch(e){notice.textContent=e.message;}},'primary'),button('Cancel',onCancel,'text-button'));
 groups();fieldChecks();preview();reveal(panel);return panel;
}
