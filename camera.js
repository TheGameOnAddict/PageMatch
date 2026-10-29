export function hasLiveCamera(stream){
  return Boolean(stream?.getVideoTracks().some(track=>track.readyState==='live'));
}

// play()/loadedmetadata can precede the first painted frame and iPhone's final
// portrait dimensions. Reveal only after real frames keep the same dimensions.
export function waitForStableVideo(video,{
  signal,settleMs=120,timeoutMs=6000,
  raf=globalThis.requestAnimationFrame?.bind(globalThis),
  cancelRaf=globalThis.cancelAnimationFrame?.bind(globalThis)
}={}){
  return new Promise((resolve,reject)=>{
    let frame=null,lastSize='',since=0,count=0,done=false;
    const native=typeof video.requestVideoFrameCallback==='function';
    function cleanup(){
      clearTimeout(timeout);signal?.removeEventListener('abort',abort);
      if(frame!==null){if(native)video.cancelVideoFrameCallback?.(frame);else cancelRaf?.(frame);}
    }
    function finish(error){if(done)return;done=true;cleanup();if(error)reject(error);else resolve();}
    function abort(){finish(new DOMException('Camera transition cancelled','AbortError'));}
    function request(){frame=native?video.requestVideoFrameCallback(check):raf(check);}
    function check(now){
      frame=null;
      if(signal?.aborted){abort();return;}
      if(video.readyState>=2&&!video.paused&&video.videoWidth>0&&video.videoHeight>0){
        const size=video.videoWidth+'x'+video.videoHeight;
        if(size!==lastSize){lastSize=size;since=now;count=1;}else count++;
        if(count>=3&&now-since>=settleMs){finish();return;}
      }else{lastSize='';count=0;}
      request();
    }
    const timeout=setTimeout(()=>finish(Error('Camera is still starting. Please try enabling it again.')),timeoutMs);
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    if(!native&&!raf){finish(Error('Camera frame updates are unavailable. Use Photos instead.'));return;}
    request();
  });
}
