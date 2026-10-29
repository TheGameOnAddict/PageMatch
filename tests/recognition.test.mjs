import test from 'node:test';
import assert from 'node:assert/strict';
import {candidatesFor,photoCandidates,pickPageId,headerTerms,headerOverlap,rankCatalogCandidates} from '../recognition.js';
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

const seneca={...candidatesFor('1H18',[a])[0],headerText:'PIPER AIRCRAFT PA-34-200 SENECA AIRPLANE PARTS CATALOG'};
const warrior={catalog:{id:'warrior',name:'PA-28-161 IPC.pdf'},id:'1H18',pages:[185],score:0,headerText:'PIPER AIRCRAFT PA-28-161 WARRIOR AIRPLANE PARTS CATALOG'};
test('shared Piper boilerplate cannot confirm either catalog',()=>{
 const r=rankCatalogCandidates('PIPER AIRCRAFT AIRPLANE PARTS CATALOG',[seneca,warrior]);
 assert.equal(r.selected,null);assert.equal(r.candidates.length,2);assert.ok(r.evidence.every(e=>!e.confirmed));
});
test('model identifier resolves the real shared-page-ID ambiguity',()=>{
 const r=rankCatalogCandidates('PIPER AIRCRAFT PA-34-200 SENECA AIRPLANE PARTS CATALOG',[warrior,seneca]);
 assert.equal(r.selected.catalog.id,a.id);assert.match(r.reason,/PA34200/);
});
test('header model tolerates spaces, missing hyphens, and OCR O/zero confusion',()=>{
 for(const model of ['PA 34 200','PA34200','PA-34-2OO']){
  assert.equal(rankCatalogCandidates(`PIPER ${model}`,[warrior,seneca]).selected?.catalog.id,a.id,model);
 }
});
test('catalog name distinguishes models if their number was unreadable',()=>{
 const r=rankCatalogCandidates('PIPER AIRPLANE SENECA',[warrior,seneca]);
 assert.equal(r.selected?.catalog.id,a.id);
});
test('same model revisions still require confirmation even with an extra matching word',()=>{
 const revised={...seneca,catalog:{id:'revision'},headerText:seneca.headerText+' REVISED'};
 const r=rankCatalogCandidates(seneca.headerText+' REVISED',[warrior,seneca,revised]);
 assert.equal(r.selected,null);assert.equal(r.candidates.length,2);
 assert.ok(r.candidates.every(c=>c.catalog.id!=='warrior'));
});
test('one weak unique OCR word does not discard the other catalogs',()=>{
 const r=rankCatalogCandidates('SENECA',[warrior,seneca]);
 assert.equal(r.selected,null);assert.equal(r.candidates.length,2);
});
test('contradictory model OCR cannot silently open a selected catalog',()=>{
 const r=rankCatalogCandidates('PIPER PA-28-161 SENECA',[seneca]);
 assert.equal(r.selected,null);assert.ok(r.evidence[0].conflicts.length);
});
test('conflicting model reads preserve ambiguity',()=>{
 const r=rankCatalogCandidates('PIPER PA-28-161 PA-34-200',[warrior,seneca]);
 assert.equal(r.selected,null);assert.equal(r.candidates.length,2);
});
