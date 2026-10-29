import test from 'node:test';
import assert from 'node:assert/strict';
import {hasLiveCamera,waitForStableVideo} from '../camera.js';

class Video{
  videoWidth=0;videoHeight=0;readyState=0;paused=true;frames=new Map();nextId=0;
  requestVideoFrameCallback(callback){const id=++this.nextId;this.frames.set(id,callback);return id;}
  cancelVideoFrameCallback(id){this.frames.delete(id);}
  tick(now,width=720,height=960){
    this.videoWidth=width;this.videoHeight=height;this.readyState=2;this.paused=false;
    const callbacks=[...this.frames.values()];this.frames.clear();callbacks.forEach(callback=>callback(now));
  }
}
test('camera reveal waits through the small initial frames and portrait resize',async()=>{
  const video=new Video();let revealed=false;
  const pending=waitForStableVideo(video).then(()=>{revealed=true;});
  video.tick(0,320,240);video.tick(60,320,240);await Promise.resolve();assert.equal(revealed,false);
  video.tick(100,720,960);video.tick(160,720,960);video.tick(210,720,960);
  await Promise.resolve();assert.equal(revealed,false,'new dimensions must settle before revealing');
  video.tick(240,720,960);await pending;assert.equal(revealed,true);assert.equal(video.frames.size,0);
});
test('metadata without decoded video frames never reveals a blank feed',async()=>{
  const video=new Video();video.videoWidth=720;video.videoHeight=960;
  await assert.rejects(waitForStableVideo(video,{timeoutMs:10}),/still starting/);
  assert.equal(video.frames.size,0);
});
test('leaving the camera cancels a pending reveal and its frame callback',async()=>{
  const video=new Video(),abort=new AbortController();
  const pending=waitForStableVideo(video,{signal:abort.signal});
  video.tick(0);abort.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(video.frames.size,0);
});
test('browsers without video-frame callbacks use the same readiness gate',async()=>{
  const video=new Video();video.requestVideoFrameCallback=undefined;
  const pending=waitForStableVideo(video,{raf:callback=>Video.prototype.requestVideoFrameCallback.call(video,callback),cancelRaf:id=>video.frames.delete(id)});
  video.tick(0);video.tick(70);video.tick(140);await pending;assert.equal(video.frames.size,0);
});
test('only a live camera track can be reused for retake',()=>{
  assert.equal(hasLiveCamera(null),false);
  assert.equal(hasLiveCamera({getVideoTracks:()=>[{readyState:'ended'}]}),false);
  assert.equal(hasLiveCamera({getVideoTracks:()=>[{readyState:'live'}]}),true);
});
