import {extractFields} from './records.js';
import {element as el,renderRecords} from './records-ui.js';
export function renderSavedResults({templates,boxes,onDiscover,onArrange}){
 const root=el('section',undefined,'saved-page-results');root.append(el('h3','Your page patterns'));
 const sets=templates.filter(t=>t.fields?.some(f=>!f.hidden)||t.layout);
 if(!sets.length)root.append(el('p','Save useful patterns once, and they’ll appear here automatically when you match a page.','muted'));
 for(const set of sets){
  const section=el('section',undefined,'page-pattern-set');if(sets.length>1)section.append(el('h4',set.name));
  const values=extractFields(set.fields,boxes);
  let arranged=false;
  if(set.layout){try{section.append(renderRecords(set.fields,values,set.layout));arranged=true;}catch(e){section.append(el('p','Arrangement needs attention: '+e.message,'record-warning'));}}
  if(!arranged)for(const f of set.fields.filter(f=>!f.hidden)){
   const result=values.get(f.name),items=result.values||result.value.split('\n').filter(Boolean),details=el('details',undefined,'page-pattern');details.append(el('summary',(f.displayName||f.name)+' · '+items.length+' value(s)'));
   if(items.length)details.append(el('pre',items.join('\n'),'pattern-values'));else details.append(el('p',result.status,'muted'));
   if(f.refinement)details.append(el('p',result.status,'muted'));section.append(details);
  }
  const arrange=el('button','Arrange or refine','text-button');arrange.onclick=()=>onArrange(set.id);section.append(arrange);root.append(section);
 }
 const more=el('button','Discover more patterns','secondary');more.onclick=onDiscover;root.append(more);return root;
}
