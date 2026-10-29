export const normalize=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const PAGE_PATTERN=/^[0-9]{1,2}[A-Z][0-9]{1,3}[A-Z]?$/;
export function pickPageId(items,page){
  const [x0,y0,x1,y1]=page.view,w=x1-x0,h=y1-y0;
  const candidates=items.map(item=>({id:normalize(item.str),x:item.transform[4]-x0,y:item.transform[5]-y0}))
    .filter(c=>PAGE_PATTERN.test(c.id)&&c.y<h*.19&&c.x>w*.24&&c.x<w*.78);
  candidates.sort((a,b)=>a.y-b.y||Math.abs(a.x-w/2)-Math.abs(b.x-w/2));
  return candidates[0]?.id||null;
}
export function distance(a,b){
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];
    for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row=next;
  }
  return row[b.length];
}
export function candidatesFor(code,catalogs){
  const n=normalize(code);
  if(n.length<3||n.length>8)return [];
  const out=[];
  for(const catalog of catalogs)for(const [id,pages] of Object.entries(catalog.index)){
    const score=distance(n,id);
    if(score<=1)out.push({catalog,id,pages,score});
  }
  return out.sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id));
}
export function photoCandidates(texts,catalogs){
  const found=[];
  for(const text of texts){
    // Keep OCR O/I/L substitutions approximate; never silently correct them.
    const tokens=text.toUpperCase().match(/[0-9OIL]{1,2}\s*[A-Z]\s*[0-9OIL]{1,3}[A-Z]?/g)||[];
    for(const token of tokens)found.push(...candidatesFor(token,catalogs));
  }
  found.sort((a,b)=>b.score-a.score);
  const unique=[...new Map(found.map(c=>[`${c.catalog.id}:${c.id}`,c])).values()].sort((a,b)=>a.score-b.score);
  const exact=unique.filter(c=>c.score===0);
  return exact.length?exact:unique;
}
export function headerTerms(text){
  return [...new Set(text.toUpperCase().match(/[A-Z]{3,}|[A-Z]{1,4}-\d[\w-]*/g)||[])].filter(t=>!['THE','AND','PAGE','CATALOG','PARTS','AIRCRAFT'].includes(t));
}
export function headerOverlap(text,catalog){
  const observed=new Set(headerTerms(text));
  return (catalog.headerTerms||[]).filter(t=>observed.has(t));
}
