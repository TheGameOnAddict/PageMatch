import {extractField} from './extraction.js';
import {refineResult,refineValues} from './refinement.js';
export function splitValue(value,split){
 let before='',after='',found=false;
 if(split.kind==='delimiter'){
  const i=value.indexOf(split.delimiter||'\u0000');if(i>=0){before=value.slice(0,i);after=value.slice(i+split.delimiter.length);found=true;}
 }else{const words=value.trim().split(/\s+/);if(words.length>split.at){const at=split.fromEnd?words.length-split.at:split.at;before=words.slice(0,at).join(' ');after=words.slice(at).join(' ');found=true;}}
 if(!found){if(split.unsplit==='before')before=value;else after=value;}
 return (split.side==='before'?before:after).trim();
}
export function extractFields(fields,boxes){
 const map=new Map(fields.map(f=>[f.name,f])),cache=new Map(),visiting=new Set();
 function get(name){
  if(cache.has(name))return cache.get(name);
  const f=map.get(name);if(!f)return {value:'',values:[],entries:[],status:'Source pattern missing'};
  if(visiting.has(name))throw Error('A pattern cannot contain itself.');visiting.add(name);
  let result;
  if(!f.source)result=extractField(f,boxes);
  else{
   const source=get(f.source),sourceEntries=source.entries?.length?source.entries:(source.values||source.value.split('\n').filter(Boolean)).map(value=>({value}));
   const omitted=[];
   const entries=sourceEntries.map(entry=>{
    let value=entry.value;
    if(f.split)value=splitValue(value,f.split);
    if(f.partition){const selected=refineValues([value],{keep:f.partition.examples,reject:[]}).rows[0]?.decision==='keep';if(selected!==(f.partition.side==='selected')){if(value)omitted.push(entry);value='';}}
    return {...entry,value};
   });
   const values=entries.map(e=>e.value).filter(Boolean);
   result=refineResult({value:values.join('\n'),values,entries,omittedEntries:omitted,excludedEntries:source.excludedEntries||[],status:values.length?'Review values':source.status||'No values in this split'},f.refinement);
  }
  visiting.delete(name);cache.set(name,result);return result;
 }
 for(const f of fields)get(f.name);return cache;
}
export function uniqueFieldName(label,fields){
 let base=label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,36)||'field';if(!/^[a-z]/.test(base))base='field_'+base;
 let name=base,n=2;while(fields.some(f=>f.name===name))name=base+'_'+n++;return name;
}
export function validateLayout(layout,fields){
 const names=new Set(fields.map(f=>f.name));
 if(!names.has(layout.anchor))throw Error('Choose the pattern that starts each row.');
 if(!layout.fields?.length||layout.fields.some(f=>!names.has(f)))throw Error('Choose the fields to show in each row.');
 if((layout.levels||[]).length>8)throw Error('Use up to eight group levels.');
 const seen=new Set();for(const level of layout.levels||[]){if(!names.has(level.field)||seen.has(level.field))throw Error('Each group level needs a different saved pattern.');seen.add(level.field);}
 return layout;
}
export function buildRecords(fields,results,layout){
 layout={...layout,levels:layout.levels||[]};validateLayout(layout,fields);const names=[...new Set([layout.anchor,...layout.fields,...layout.levels.map(l=>l.field)])],rows=[];let unpositioned=0;
 const place=entry=>{
  if(!Number.isFinite(entry.y)){if(entry.value)unpositioned++;return null;}
  let row=rows.find(r=>Math.abs(r.y-entry.y)<Math.min(r.height,entry.height||.01)*.55);
  if(!row){row={y:entry.y,height:entry.height||.01,values:{},blocked:false,invalidGroups:new Set()};rows.push(row);}return row;
 };
 for(const name of names){const result=results.get(name);if(!result?.entries?.length)unpositioned+=(result?.values||[]).filter(Boolean).length;for(const entry of result?.entries||[]){const row=place(entry);if(row&&entry.value)row.values[name]=row.values[name]?[row.values[name],entry.value].join(' '):entry.value;}}
 const anchor=results.get(layout.anchor);
 for(const entry of [...(anchor?.excludedEntries||[]),...(anchor?.omittedEntries||[])]){const row=place(entry);if(row)row.blocked=true;}
 for(const level of layout.levels){const result=results.get(level.field);for(const entry of [...(result?.excludedEntries||[]),...(result?.omittedEntries||[])]){const row=place(entry);if(row)row.invalidGroups.add(level.field);}}
 rows.sort((a,b)=>a.y-b.y);
 let excluded=0;
 function records(scope){
  const out=[];let current=null,skip=false;
  for(const row of scope){
   if(row.blocked){excluded++;current=null;skip=true;continue;}
   if(row.values[layout.anchor]){current={key:row.values[layout.anchor],values:{},review:false};out.push(current);skip=false;}
   if(skip)continue;
   const visible=layout.fields.filter(n=>row.values[n]);if(!visible.length)continue;
   if(!current){current={key:'Unassigned row',values:{},review:true};out.push(current);}
   for(const name of visible)current.values[name]=current.values[name]?current.values[name]+'\n'+row.values[name]:row.values[name];
  }
  return out;
 }
 function groups(scope,depth){
  if(depth>=layout.levels.length)return {type:'rows',records:records(scope)};
  const level=layout.levels[depth],sections=[];let current=null;
  for(const row of scope){const value=row.values[level.field];
   if(row.invalidGroups.has(level.field)){current={key:null,rows:[]};sections.push(current);}
   if(value&&(!current||level.start!=='change'||current.key!==value)){current={key:value,rows:[]};sections.push(current);}
   if(!current){current={key:null,rows:[]};sections.push(current);}current.rows.push(row);
  }
  return {type:'groups',label:level.label||fields.find(f=>f.name===level.field)?.displayName||level.field,groups:sections.map(s=>({key:s.key,review:s.key===null,content:groups(s.rows,depth+1)}))};
 }
 const tree=groups(rows,0);return {tree,unpositioned,excluded};
}
