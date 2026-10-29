import test from 'node:test';
import assert from 'node:assert/strict';
import {candidatesFor,photoCandidates,pickPageId,headerTerms,headerOverlap} from '../recognition.js';
const a={id:'a',name:'Catalog revision A',index:{'1H18':[190],'1H19':[191],'1A1':[1,8]},headerTerms:headerTerms('PIPER PA-34-200 SENECA AIRPLANE PARTS CATALOG')};
const b={id:'b',name:'Catalog revision B',index:{'1H18':[195]}};

test('exact footer OCR beats adjacent fuzzy IDs',()=>{
 const found=photoCandidates(['1H18'],[a]);assert.equal(found.length,1);assert.equal(found[0].id,'1H18');assert.deepEqual(found[0].pages,[190]);
});
test('OCR confusion is approximate and cannot silently become an exact match',()=>{
 const found=photoCandidates(['1H1B'],[a]);assert.ok(found.length>0);assert.ok(found.every(c=>c.score===1));
});
test('identical IDs in different revisions remain ambiguous',()=>{
 assert.equal(photoCandidates(['1 H 18'],[a,b]).length,2);
 assert.equal(photoCandidates(['1 H 18'],[a]).length,1);
});
test('duplicate IDs retain every physical PDF page',()=>assert.deepEqual(candidatesFor('1A1',[a])[0].pages,[1,8]));
test('blank / noisy OCR does not invent a page',()=>{
 assert.deepEqual(photoCandidates(['PIPER AIRCRAFT'],[a]),[]);assert.deepEqual(candidatesFor('',[a]),[]);
});
test('indexing uses footer geometry, excluding body part numbers',()=>{
 const items=[{str:'1H19',transform:[1,0,0,1,300,400]},{str:'1H18',transform:[1,0,0,1,300,30]}];
 assert.equal(pickPageId(items,{view:[0,0,612,792]}),'1H18');
});
test('catalog header corroboration uses imported text',()=>assert.ok(headerOverlap('PIPER AIRCRAFT PA-34-200 SENECA',a).length>=2));
