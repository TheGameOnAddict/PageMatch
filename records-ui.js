import {buildRecords} from './records.js';
export const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function renderRecords(fields,results,layout){
 const root=element('div',undefined,'record-view'),model=buildRecords(fields,results,layout),labels=new Map(fields.map(f=>[f.name,f.displayName||f.name]));
 const count=node=>node.type==='rows'?node.records.length:node.groups.reduce((n,g)=>n+count(g.content),0);
 function render(node,parent){
  if(node.type==='groups')for(const group of node.groups){
   const details=element('details',undefined,'record-group');details.open=Boolean(layout.expandGroups);
   details.append(element('summary',node.label+' · '+(group.key||'Unassigned — review')+' · '+count(group.content)+' row(s)'));
   if(group.review)details.append(element('p','No group marker was found before these rows. Verify their group.','record-warning'));
   const body=element('div',undefined,'record-group-body');render(group.content,body);details.append(body);parent.append(details);
  }else for(const record of node.records){
   const card=element('article',undefined,'record-row');card.append(element('h5',layout.fields.includes(layout.anchor)?(labels.get(layout.anchor)||layout.anchor)+' · '+record.key:'Row'));
   if(record.review)card.append(element('p','No row key found · review this row.','record-warning'));
   const dl=element('dl');for(const name of layout.fields){if(name===layout.anchor&&record.values[name]===record.key)continue;dl.append(element('dt',labels.get(name)||name),element('dd',record.values[name]||'—'));}card.append(dl);parent.append(card);
  }
 }
 const total=count(model.tree);root.append(element('p',total+' row(s) · grouped by the saved arrangement','muted'));render(model.tree,root);
 if(!total)root.append(element('p','No positioned rows match this arrangement on this page.','muted'));
 if(model.unpositioned)root.append(element('p','Some values have no row position and cannot be joined safely.','record-warning'));
 if(model.excluded)root.append(element('p',model.excluded+' row(s) excluded by refinement. Neighboring values were not shifted.','muted'));
 return root;
}
