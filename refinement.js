// Local, inspectable example-based filtering. No regex supplied by the user is executed.
const normalize=value=>String(value).trim().replace(/\s+/g,' ').toUpperCase();
export function valueShape(value){
 return normalize(value).replace(/[A-Z]+|[0-9]+| +|[^A-Z0-9 ]/g,part=>/^[A-Z]+$/.test(part)?'L'+part.length:/^[0-9]+$/.test(part)?'D'+part.length:part===' '?'S':JSON.stringify(part));
}
export function setExample(teaching,value,decision){
 const keep=[...(teaching?.keep||[])],reject=[...(teaching?.reject||[])],key=normalize(value);
 const next={version:1,keep:keep.filter(v=>normalize(v)!==key),reject:reject.filter(v=>normalize(v)!==key)};
 if(decision==='keep')next.keep.push(value);
 if(decision==='reject')next.reject.push(value);
 return next;
}
function learnedShapes(examples){
 const groups=new Map();
 for(const value of new Set(examples.map(normalize))){const shape=valueShape(value);groups.set(shape,(groups.get(shape)||0)+1);}
 return new Set([...groups].filter(([,n])=>n>=2).map(([shape])=>shape));
}
export function refineValues(values,teaching){
 const keep=new Set((teaching?.keep||[]).map(normalize)),reject=new Set((teaching?.reject||[]).map(normalize));
 const keepShapes=learnedShapes([...keep]),rejectShapes=learnedShapes([...reject]);
 const rows=values.map(value=>{
  const key=normalize(value),shape=valueShape(value);let decision='review',reason='Unfamiliar format · needs review';
  if(keep.has(key)&&reject.has(key)){reason='Conflicting examples · needs review';}
  else if(keep.has(key)){decision='keep';reason='You marked this Keep';}
  else if(reject.has(key)){decision='reject';reason='You marked this Not this';}
  else if(keepShapes.has(shape)&&rejectShapes.has(shape)){reason='Mixed feedback for this format · needs review';}
  else if(keepShapes.has(shape)){decision='keep';reason='Matches a format you kept';}
  else if(rejectShapes.has(shape)){decision='reject';reason='Matches a format you rejected';}
  return {value,decision,reason};
 });
 return {rows,values:rows.filter(r=>r.decision!=='reject').map(r=>r.value),excluded:rows.filter(r=>r.decision==='reject'),kept:rows.filter(r=>r.decision==='keep').length,review:rows.filter(r=>r.decision==='review').length,learnedKeep:keepShapes.size,learnedReject:rejectShapes.size};
}
export function refineResult(result,teaching){
 if(!teaching?.keep?.length&&!teaching?.reject?.length)return result;
 const rawValues=result.values||result.value.split('\n').filter(Boolean),filtered=refineValues(rawValues,teaching);
 return {...result,rawValues,...filtered,value:filtered.values.join('\n'),status:rawValues.length?filtered.kept+' kept · '+filtered.review+' to review · '+filtered.excluded.length+' excluded':result.status};
}
