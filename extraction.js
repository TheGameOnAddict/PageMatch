import {refineResult} from './refinement.js';
import {extractRule} from './patterns.js';
// Coordinates are normalized to the rendered page's top-left origin.
export function regionFromPoints(a,b){
  const clamp=n=>Math.max(0,Math.min(1,n));
  const x0=clamp(Math.min(a.x,b.x)),y0=clamp(Math.min(a.y,b.y));
  return {x:x0,y:y0,width:clamp(Math.max(a.x,b.x))-x0,height:clamp(Math.max(a.y,b.y))-y0};
}
export function textBoxes(items,viewport,multiply){
  return items.filter(i=>i.str?.trim()).map(item=>{
    const t=multiply(viewport.transform,item.transform);
    // PDF text baselines are in bottom-left coordinates; viewport handles crop and rotation.
    const ux=t[0],uy=t[1],length=Math.hypot(ux,uy)||1;
    const wx=ux/length*item.width*viewport.scale,wy=uy/length*item.width*viewport.scale;
    const hx=t[2],hy=t[3];
    const points=[[t[4],t[5]],[t[4]+wx,t[5]+wy],[t[4]+hx,t[5]+hy],[t[4]+wx+hx,t[5]+wy+hy]];
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return {text:item.str,x:Math.min(...xs)/viewport.width,y:Math.min(...ys)/viewport.height,width:(Math.max(...xs)-Math.min(...xs))/viewport.width,height:(Math.max(...ys)-Math.min(...ys))/viewport.height};
  });
}
export function validateField(field,others=[]){
  if(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(field.name))throw Error('Use a field name starting with a letter, followed by letters, numbers or underscores (up to 48 characters).');
  if(others.some(f=>f.name.toLowerCase()===field.name.toLowerCase()))throw Error('Each field needs a different name.');
  if(field.rule)return field;
  const r=field.region;
  if(!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.00001||r.y+r.height>1.00001)throw Error('Mark a region on the page first.');
  if(field.pattern){
    // A literal text pattern with * captures is predictable and cannot cause regex backtracking freezes.
    if(!field.pattern.includes('*'))throw Error('Include * where the value should be captured, for example Part: *.');
    if(field.pattern.length>200)throw Error('Keep the pattern under 200 characters.');
  }
  return field;
}
export function capturePattern(text,pattern){
  const pieces=pattern.split('*');let cursor=0,values=[];
  const first=pieces[0];
  if(first){const pos=text.toLowerCase().indexOf(first.toLowerCase());if(pos<0)return null;cursor=pos+first.length;}
  for(let n=1;n<pieces.length;n++){
    const suffix=pieces[n];
    if(!suffix){if(n===pieces.length-1)values.push(text.slice(cursor).trim());continue;}
    const end=text.toLowerCase().indexOf(suffix.toLowerCase(),cursor);
    if(end<0)return null;
    values.push(text.slice(cursor,end).trim());cursor=end+suffix.length;
  }
  return values.filter(Boolean).join(' ');
}
function extractRawField(field,boxes){
  if(field.rule)return extractRule(field.rule,boxes);
  const r=field.region;
  const selected=boxes.filter(b=>{
    // Use the text center to avoid pulling adjacent rows in at a region edge.
    const cy=b.y+b.height/2,cx=b.x+b.width/2;
    return cx>=r.x&&cx<=r.x+r.width&&cy>=r.y&&cy<=r.y+r.height;
  }).sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines=[];
  for(const b of selected){
    const cy=b.y+b.height/2;
    let line=lines.find(l=>Math.abs(l.cy-cy)<Math.min(l.height,b.height)*.55);
    if(!line){line={cy,height:b.height,items:[]};lines.push(line);}line.items.push(b);
  }
  const entries=lines.map(l=>({value:l.items.sort((a,b)=>a.x-b.x).map(b=>b.text).join(' ').trim(),y:l.cy,height:l.height,cells:l.items}));
  const text=entries.map(e=>e.value).join('\n');
  if(!text)return {value:'',status:'No text in region'};
  const input=field.mode==='first-line'?text.split('\n')[0]:text;
  const value=field.pattern?capturePattern(input,field.pattern):input;
  return value===null?{value:'',status:'Pattern did not match'}:{value,status:'Review value',...(field.pattern?{}:{entries:field.mode==='first-line'?entries.slice(0,1):entries})};
}

export function extractField(field,boxes){return refineResult(extractRawField(field,boxes),field.refinement);}
