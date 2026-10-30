const clean=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function pageLines(boxes){
 const lines=[];
 for(const b of [...boxes].sort((a,b)=>a.y-b.y||a.x-b.x)){
  const cy=b.y+b.height/2;let line=lines.find(l=>Math.abs(l.cy-cy)<Math.min(l.height,b.height)*.55);
  if(!line){line={cy,height:b.height,items:[]};lines.push(line);}line.items.push(b);
 }
 return lines.map(l=>({...l,items:l.items.sort((a,b)=>a.x-b.x)}));
}
export function ruleKey(rule){return rule.kind+':'+(rule.header||rule.label||rule.zone||Math.round((rule.anchor||0)*100));}
export function discoverPatterns(boxes){
 const lines=pageLines(boxes),found=[];
 const add=(title,reason,rule,values)=>{if(values.length)found.push({title,reason,rule,values});};
 // Repeated baselines with several separate cells provide evidence of a table.
 let run=[],runs=[];
 for(const line of lines){
  if(line.items.length>=3&&line.cy>.08&&line.cy<.9){
   if(run.length&&line.cy-run.at(-1).cy>.04){runs.push(run);run=[];}run.push(line);
  }else{if(run.length)runs.push(run);run=[];}
 }if(run.length)runs.push(run);
 const body=runs.filter(r=>r.length>=4).sort((a,b)=>b.length-a.length)[0];
 if(body){
  const start=body[0].cy,end=body.at(-1).cy;
  const cells=body.flatMap(l=>l.items),clusters=[];
  for(const b of cells){let c=clusters.find(c=>Math.abs(c.x-b.x)<.012);if(!c){c={x:b.x,items:[]};clusters.push(c);}c.items.push(b);}
  const columns=clusters.filter(c=>new Set(c.items.map(b=>Math.round(b.y*1000))).size>=3).sort((a,b)=>a.x-b.x);
  columns.forEach((col,i)=>{
   const right=Math.min(i+1<columns.length?columns[i+1].x:1,Math.max(...col.items.map(b=>b.x+b.width)));
   const left=i?((Math.max(...columns[i-1].items.map(b=>b.x+b.width))+col.x)/2):0;
   const bound=i+1<columns.length?(right+columns[i+1].x)/2:Math.min(1,right+.04);
   const header=lines.filter(l=>l.cy<start-.008&&l.cy>start-.075).flatMap(l=>l.items).filter(b=>b.x+b.width/2>=left&&b.x+b.width/2<bound).map(b=>b.text).join(' ').trim();
   const values=body.map(l=>l.items.filter(b=>b.x+b.width/2>=left&&b.x+b.width/2<bound).map(b=>b.text).join(' ')).filter(Boolean);
   // Columns are suggested even when all values repeat (e.g. quantities).
   add(header||'Repeated column '+(i+1),'Repeated column · '+values.length+' values',{kind:'column',header:clean(header),anchor:col.x},values);
  });
 }
 const labels=new Map();
 for(const line of lines){
  const text=line.items.map(b=>b.text).join(' '),m=text.match(/^\s*([A-Za-z][A-Za-z0-9 /()._-]{1,45}):\s*(.+)$/);
  if(m){const key=clean(m[1]);let item=labels.get(key);if(!item){item={label:m[1].trim(),values:[]};labels.set(key,item);}item.values.push(m[2].trim());}
 }
 for(const item of labels.values())add(item.label,'Labeled value',{kind:'label',label:clean(item.label)},item.values);
 const heading=lines.filter(l=>l.cy<.105).map(l=>l.items.map(b=>b.text).join(' '));
 if(heading.length)add('Page heading','Text at the top of the page',{kind:'zone',zone:'heading'},heading);
 const footer=boxes.filter(b=>b.y>.87&&b.x+b.width/2>.25&&b.x+b.width/2<.75&&/^(?=.*[0-9])[A-Za-z0-9-]{1,16}$/.test(b.text.trim()));
 if(footer.length)add('Printed page ID','Short ID near the bottom center',{kind:'zone',zone:'page-id'},footer.map(b=>b.text));
 return found.map(p=>({...p,key:ruleKey(p.rule)}));
}
export function extractRule(rule,boxes){
 const candidates=discoverPatterns(boxes);
 let match;
 if(rule.kind==='column'){
  const columns=candidates.filter(c=>c.rule.kind==='column');
  // A known column label must still be present; never fall back onto an unrelated diagram.
  match=rule.header?columns.filter(c=>c.rule.header===rule.header).sort((a,b)=>Math.abs(a.rule.anchor-rule.anchor)-Math.abs(b.rule.anchor-rule.anchor))[0]:columns.find(c=>!c.rule.header&&Math.abs(c.rule.anchor-rule.anchor)<.025);
 }else match=candidates.find(c=>ruleKey(c.rule)===ruleKey(rule));
 return match?{value:match.values.join('\n'),values:match.values,status:'Review values'}:{value:'',values:[],status:'Pattern not found on this page'};
}
