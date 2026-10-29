import test from 'node:test';
import assert from 'node:assert/strict';
import {screenSwipe,sheetSwipe} from '../ui.js';

test('left swipe moves to camera and right swipe returns to setup',()=>{
  assert.equal(screenSwipe(-120,20),'camera');assert.equal(screenSwipe(100,-15),'setup');
});
test('vertical scrolling, small taps and diagonal movements do not switch screens',()=>{
  assert.equal(screenSwipe(15,150),null);assert.equal(screenSwipe(-40,2),null);assert.equal(screenSwipe(-75,70),null);
});
test('result sheet expands up, minimizes down, then dismisses from its lower position',()=>{
  assert.equal(sheetSwipe(-70,false),'expand');assert.equal(sheetSwipe(90,true),'collapse');assert.equal(sheetSwipe(90,false),'dismiss');
  assert.equal(sheetSwipe(10,false),null);
});
