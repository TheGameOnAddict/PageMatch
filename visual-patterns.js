// Visual examples stay in normalized PDF coordinates; no document data leaves the device.
const tidy=s=>s.trim().replace(/\s+/g,' ');
const origin=column=>Math.min(...column.entries.flatMap(e=>e.cells.map(c=>c.x)));
export function words(boxes,measure=s=>s.length){
 return boxes.flatMap((box,source)=>{
  const matches=[...box.text.matchAll(/\S+/g)],total=measure(box.text)||1;
  return matches.map((m,i)=>({...box,text:m[0],source,id:source+':'+i,x:box.x+box.width*measure(box.text.slice(0,m.index))/total,width:box.width*measure(m[0])/total}));
 });
}
export function columnForSelection(tokens,columns){
 const hits=columns.filter(c=>tokens.every(t=>c.entries.some(e=>e.cells.some(b=>Math.abs(t.y-b.y)<.0001&&t.x>=b.x-.002&&t.x+t.width<=b.x+b.width+.002))));
 if(hits.length!==1)throw Error('Choose pieces from one table column at a time. You can group different patterns afterward.');
 return hits[0];
}
export function visualExample(tokens,column,pageNo){
 if(!tokens.length)throw Error('Tap a piece on the page first.');
 if(!column?.entries?.length)throw Error('Choose text inside a repeated table column.');
 const left=Math.min(...tokens.map(t=>t.x))-.0015,right=Math.max(...tokens.map(t=>t.x+t.width))+.0015;
 return {pageNo,header:column.rule.header,anchor:column.rule.anchor,left:left-origin(column),right:right-origin(column),...(tokens.some(t=>t.characters)?{characters:true}:{})};
}
export function extractVisual(rule,boxes,columns,tokenize=words){
 const examples=rule.examples||[];
 const base=tokenize(boxes),tokens=examples.some(e=>e.characters)?base.flatMap(t=>[...t.text].map((ch,i)=>({...t,text:ch,id:t.id+':'+i,wordId:t.id,x:t.x+t.width*i/t.text.length,width:t.width/t.text.length}))):base;
 const matches=columns.flatMap(column=>examples.filter(e=>e.header===column.rule.header&&Math.abs(e.anchor-column.rule.anchor)<.05).map(e=>({column,e,d:Math.abs(e.anchor-column.rule.anchor)}))).sort((a,b)=>a.d-b.d);
 if(!matches.length)return {value:'',values:[],entries:[],status:'No matching table column on this page'};
 const {column}=matches[0],compatible=matches.filter(m=>m.column===column).map(m=>m.e);
 // Centered token inclusion separates adjacent pieces while preserving sparse row positions.
 const left=origin(column)+Math.min(...compatible.map(e=>e.left)),right=origin(column)+Math.max(...compatible.map(e=>e.right));
 const entries=column.entries.map(row=>{
  const cells=tokens.filter(t=>Math.abs(t.y+t.height/2-row.y)<Math.min(t.height,row.height)*.55&&t.x+t.width/2>=left&&t.x+t.width/2<=right);
  cells.sort((a,b)=>a.x-b.x);
  let value='';for(let i=0;i<cells.length;i++){const t=cells[i];if(i&&(!t.wordId||t.wordId!==cells[i-1].wordId))value+=' ';value+=t.text;}
  return {value:tidy(value),y:row.y,height:row.height,cells};
 });
 const values=entries.map(e=>e.value).filter(Boolean);
 return {value:values.join('\n'),values,entries,status:values.length?'Review highlighted values':'No values inside this selection'};
}
export function trainingReady(fields,pages,catalogId){
 const unique=[...new Set(pages)];
 if(unique.length<2)return {ok:false,reason:'Choose two different PDF pages.'};
 if(!fields.length)return {ok:false,reason:'Add at least one pattern.'};
 for(const f of fields){
  const t=f.training;
  if(t?.catalogId!==catalogId||unique.some(p=>!t.confirmed?.includes(p)))return {ok:false,reason:'Confirm “'+(f.displayName||f.name)+'” on both pages.'};
 }
 return {ok:true};
}
export function publishTrainedSet(set,pages,catalogId){
 const ready=trainingReady(set.fields,pages,catalogId);if(!ready.ok)throw Error(ready.reason);
 return {...set,catalogId,schemaVersion:4,training:{version:1,pages:[...new Set(pages)],confirmed:true},updatedAt:new Date().toISOString()};
}
