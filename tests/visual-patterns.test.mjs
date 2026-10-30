import test from 'node:test';
import assert from 'node:assert/strict';
import {words,columnForSelection,visualExample,extractVisual,trainingReady,publishTrainedSet} from '../visual-patterns.js';
const boxes=[{text:'40 -1',x:.1,y:.2,width:.05,height:.01},{text:'-2',x:.13,y:.22,width:.02,height:.01},{text:'AB-123',x:.2,y:.2,width:.06,height:.01},{text:'CD-456',x:.2,y:.22,width:.06,height:.01}];
const columns=[{rule:{header:'figure index',anchor:.1},entries:[{y:.205,height:.01,cells:[boxes[0]]},{y:.225,height:.01,cells:[boxes[1]]}]},{rule:{header:'part number',anchor:.2},entries:[{y:.205,height:.01,cells:[boxes[2]]},{y:.225,height:.01,cells:[boxes[3]]}]}];
test('visual selection separates adjacent pieces and retains sparse row positions',()=>{
 const tokens=words(boxes),figure=tokens.find(t=>t.text==='40'),index=tokens.find(t=>t.text==='-1');
 const column=columnForSelection([figure],columns);
 const f=extractVisual({examples:[visualExample([figure],column,190)]},boxes,columns);
 assert.deepEqual(f.values,['40']);assert.equal(f.entries[1].value,'');
 const i=extractVisual({examples:[visualExample([index],column,190)]},boxes,columns);
 assert.deepEqual(i.values,['-1','-2']);assert.equal(i.entries[0].y,.205);
});
test('a single selection cannot silently merge two separate columns',()=>{
 const t=words(boxes);assert.throws(()=>columnForSelection([t[0],t.find(t=>t.text==='AB-123')],columns),/one table column/);
});
test('visual examples follow a small column shift and refuse diagrams',()=>{
 const sample=visualExample([words(boxes)[0]],columns[0],190),shift=.02;
 const moved=boxes.map(b=>({...b,x:b.x+shift})),cols=columns.map(c=>({...c,rule:{...c.rule,anchor:c.rule.anchor+shift},entries:c.entries.map(e=>({...e,cells:e.cells.map(b=>({...b,x:b.x+shift}))}))}));
 assert.deepEqual(extractVisual({examples:[sample]},moved,cols).values,['40']);
 assert.deepEqual(extractVisual({examples:[sample]},boxes,[]).values,[]);
});
test('training requires two distinct physical pages and every pattern confirmed on both',()=>{
 const f={name:'part',displayName:'Part',training:{catalogId:'c',confirmed:[190]}};
 assert.equal(trainingReady([f],[190,190],'c').ok,false);assert.equal(trainingReady([f],[190,194],'c').ok,false);
 f.training.confirmed.push(194);assert.equal(trainingReady([f],[190,194],'c').ok,true);
 assert.equal(trainingReady([f],[190,194],'other').ok,false);
 assert.equal(trainingReady([f,{...f,training:{catalogId:'c',confirmed:[]}}],[190,194],'c').ok,false);
});
test('publishing enforces the confirmation gate and preserves checked page IDs',()=>{
 assert.throws(()=>publishTrainedSet({fields:[]},[1,2],'c'),/Add at least/);
 const set=publishTrainedSet({id:'s',fields:[{name:'p',training:{catalogId:'c',confirmed:[190,194]}}]},[190,194],'c');
 assert.equal(set.schemaVersion,4);assert.deepEqual(set.training.pages,[190,194]);assert.equal(set.training.confirmed,true);
});

test('character selections separate touching figure and index values',()=>{
 const b=[{text:'41-35',x:.1,y:.2,width:.05,height:.01},{text:'-36',x:.12,y:.22,width:.03,height:.01}],c={rule:{header:'figure index',anchor:.1},entries:[{y:.205,height:.01,cells:[b[0]]},{y:.225,height:.01,cells:[b[1]]}]};
 const first={...words(b)[0],text:'41',width:.02,characters:true};
 const r=extractVisual({examples:[visualExample([first],c,194)]},b,[c]);assert.deepEqual(r.values,['41']);
 const second={...words(b)[0],text:'-35',x:.12,width:.03,characters:true};
 assert.deepEqual(extractVisual({examples:[visualExample([second],c,194)]},b,[c]).values,['-35','-36']);
});

test('indented row markers do not shift a visually selected figure into the index',()=>{
 const make=(figure,indexX)=>{const b=[{text:figure,x:.09,y:.2,width:figure.length*.006,height:.01},{text:'-36',x:indexX,y:.22,width:.02,height:.01}];return {boxes:b,column:{rule:{header:'figure index',anchor:indexX},entries:b.map(v=>({y:v.y+.005,height:.01,cells:[v]}))}};};
 const a=make('40 -1',.114),b=make('41-35',.104),c=make('42-',.122);
 const examples=[a,b].map((s,i)=>{const t=words(s.boxes)[0];return visualExample([{...t,text:t.text.slice(0,2),width:t.width*2/t.text.length,characters:true}],s.column,i+1);});
 for(const [s,expected] of [[a,'40'],[b,'41'],[c,'42']])assert.deepEqual(extractVisual({examples},s.boxes,[s.column]).values,[expected]);
});
