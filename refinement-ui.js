import {refineValues,setExample} from './refinement.js';
export function createRefiner({name,values,teaching,onApply,onCancel,saveLabel='Save refinement'}){
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,fn,cls='secondary')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const normalize=v=>v.trim().replace(/\s+/g,' ').toUpperCase();
 let draft=structuredClone(teaching||{version:1,keep:[],reject:[]});
 const panel=el('section',undefined,'refine-panel');panel.setAttribute('aria-label','Refine '+name);
 panel.append(el('h4','Refine '+name),el('p','Tap Keep for correct values and Not this for wrong ones. Two different examples with the same format teach a reusable rule.','muted'));
 const summary=el('p',undefined,'refine-summary');summary.setAttribute('role','status');
 const list=el('div',undefined,'refine-examples'),preview=el('details'),previewTitle=el('summary','Preview what will remain'),previewValues=el('pre',undefined,'pattern-values');preview.append(previewTitle,previewValues);
 const help=el('p','Unfamiliar formats stay for review. This learns text formats; it does not verify what a part number means.','muted');
 function render(){
  const scroll=list.scrollTop,result=refineValues(values,draft);
  summary.textContent=result.kept+' kept · '+result.review+' to review · '+result.excluded.length+' excluded';
  const unique=new Map();
  for(const value of [...values,...draft.keep,...draft.reject])if(!unique.has(normalize(value)))unique.set(normalize(value),value);
  const rows=refineValues([...unique.values()],draft).rows;list.replaceChildren();
  for(const row of rows){
   const item=el('div',undefined,'refine-example '+row.decision),text=el('strong',row.value),note=el('small',row.reason);
   if(!values.some(v=>normalize(v)===normalize(row.value)))note.textContent+=' · earlier page';
   const actions=el('div',undefined,'refine-choices');
   for(const [decision,label] of [['keep','Keep'],['reject','Not this']]){
    const marked=draft[decision==='keep'?'keep':'reject'].some(v=>normalize(v)===normalize(row.value));
    const b=button(label,()=>{draft=setExample(draft,row.value,marked?null:decision);render();});b.setAttribute('aria-label',label+' '+row.value);b.setAttribute('aria-pressed',String(marked));actions.append(b);
   }
   item.append(text,note,actions);list.append(item);
  }
  list.scrollTop=scroll;
  previewTitle.textContent='Preview '+result.values.length+' remaining value(s)';previewValues.textContent=result.values.join('\n')||'No values would remain. Keep a correct example or clear the teaching.';
 }
 panel.append(summary,list,preview,help);
 const actions=el('div',undefined,'refine-footer');actions.append(button(saveLabel,()=>onApply(structuredClone(draft)),'primary'),button('Cancel',onCancel,'text-button'),button('Clear teaching',()=>{draft={version:1,keep:[],reject:[]};render();},'text-button'));panel.append(actions);render();
 requestAnimationFrame(()=>{if(panel.isConnected)panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 return panel;
}
