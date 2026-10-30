import test from 'node:test';
import assert from 'node:assert/strict';
import {regionFromPoints,textBoxes,validateField,capturePattern,extractField} from '../extraction.js';
test('regions normalize reverse drags and clamp to page',()=>{
 assert.deepEqual(regionFromPoints({x:1.2,y:.8},{x:.2,y:-.1}),{x:.2,y:0,width:.8,height:.8});
});
const boxes=[{text:'Part:',x:.1,y:.2,width:.1,height:.02},{text:'123-45',x:.22,y:.2,width:.12,height:.02},{text:'Next row',x:.1,y:.25,width:.4,height:.02}];
const field={name:'part_number',region:{x:.08,y:.19,width:.4,height:.04},pattern:'Part: *'};
test('region extracts the selected row and applies literal capture pattern',()=>{
 assert.deepEqual(extractField(field,boxes),{value:'123-45',status:'Review value'});
});
test('missing text and unmatched patterns remain explicit',()=>{
 assert.equal(extractField(field,[]).status,'No text in region');
 assert.equal(extractField({...field,pattern:'Code: *'},boxes).status,'Pattern did not match');
});
test('multi-line and first-line extraction preserve reading order',()=>{
 const f={...field,pattern:'',region:{x:0,y:0,width:1,height:1}};
 assert.equal(extractField(f,[...boxes].reverse()).value,'Part: 123-45\nNext row');
 assert.equal(extractField({...f,mode:'first-line'},boxes).value,'Part: 123-45');
});
test('patterns use literal labels without executing regex',()=>{
 assert.equal(capturePattern('Part (A): ABC, Qty: 2','Part (A): *, Qty: *'),'ABC 2');
 assert.equal(capturePattern('part: ABC','Part: *'),'ABC');
 assert.equal(capturePattern('Wrong text','Part: *'),null);
});
test('fields reject duplicate names, invalid identifiers and empty regions',()=>{
 assert.equal(validateField(field).name,'part_number');
 assert.throws(()=>validateField(field,[{name:'PART_NUMBER'}]),/different name/);
 assert.throws(()=>validateField({...field,name:'Bad name'}),/field name/);
 assert.throws(()=>validateField({...field,region:null}),/Mark a region/);
 assert.throws(()=>validateField({...field,pattern:'Part'}),/Include/);
});
test('PDF viewport transforms convert baselines to normalized top-left boxes',()=>{
 const multiply=(_a,b)=>b;
 assert.deepEqual(textBoxes([{str:'ABC',transform:[10,0,0,-10,20,50],width:30}],{transform:[],scale:1,width:100,height:100},multiply),[{text:'ABC',x:.2,y:.4,width:.3,height:.1}]);
});
