export function screenSwipe(dx,dy){
  return Math.abs(dx)>=65&&Math.abs(dx)>Math.abs(dy)*1.5?(dx<0?'camera':'setup'):null;
}
export function sheetSwipe(dy,expanded){
  return dy<=-40?'expand':dy>=65?(expanded?'collapse':'dismiss'):null;
}
export function createInterface({onCamera,onSetup,onRetake}){
  const $=id=>document.getElementById(id);
  let screen='setup',expanded=false;
  function showScreen(next){
    if(next===screen)return;
    screen=next;
    $('screens').classList.toggle('on-camera',screen==='camera');
    for(const name of ['setup','camera']){
      const element=$(name+'Screen'),hidden=name!==screen;
      element.inert=hidden;element.setAttribute('aria-hidden',String(hidden));
    }
    if(screen==='camera')onCamera();else onSetup();
  }
  function setExpanded(value){
    expanded=value;$('resultSheet').classList.toggle('expanded',value);
    $('sheetExpandButton').setAttribute('aria-expanded',String(value));
    $('sheetExpandButton').setAttribute('aria-label',value?'Collapse results':'Expand results');
    $('sheetExpandLabel').textContent=value?'Swipe down to minimize':'Tap or swipe up ↗';
    if(!value)$('sheetBody').scrollTop=0;
  }
  function showSheet(expand=false){
    $('resultSheet').hidden=false;setExpanded(expand);
  }
  function closeSheet(){
    $('resultSheet').hidden=true;setExpanded(false);
  }
  $('openScannerButton').onclick=()=>showScreen('camera');
  $('backToSetupButton').onclick=()=>showScreen('setup');
  $('sheetExpandButton').onclick=()=>{if(!dragged)setExpanded(!expanded);};
  $('retakeButton').onclick=()=>onRetake();
  let touchStart=null;
  $('screens').addEventListener('touchstart',event=>{
    touchStart=null;
    if(event.touches.length!==1||event.target.closest('button,input,select,label,a,#resultSheet'))return;
    const touch=event.touches[0];touchStart={x:touch.clientX,y:touch.clientY};
  },{passive:true});
  $('screens').addEventListener('touchend',event=>{
    if(!touchStart)return;
    const touch=event.changedTouches[0],next=screenSwipe(touch.clientX-touchStart.x,touch.clientY-touchStart.y);
    touchStart=null;if(next)showScreen(next);
  },{passive:true});
  $('screens').addEventListener('touchcancel',()=>{touchStart=null;},{passive:true});
  let sheetStart=null,dragged=false;
  $('resultSheet').addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    if(event.target.closest('button,input,select,a')&&!event.target.closest('#sheetExpandButton'))return;
    if(expanded&&!event.target.closest('.sheet-header'))return;
    sheetStart={y:event.clientY,id:event.pointerId};dragged=false;
    (event.target.closest('#sheetExpandButton')||$('resultSheet')).setPointerCapture(event.pointerId);
  });
  $('resultSheet').addEventListener('pointerup',event=>{
    if(!sheetStart||sheetStart.id!==event.pointerId)return;
    const action=sheetSwipe(event.clientY-sheetStart.y,expanded);sheetStart=null;
    dragged=Boolean(action);
    if(action==='expand')setExpanded(true);
    if(action==='collapse')setExpanded(false);
    if(action==='dismiss'&&!$('retakeButton').disabled)onRetake();
    // Suppress the synthetic click after a drag, then allow the next tap.
    if(dragged)setTimeout(()=>{dragged=false;},0);
  });
  $('resultSheet').addEventListener('pointercancel',()=>{sheetStart=null;dragged=false;});
  $('resultSheet').addEventListener('click',event=>{
    if(!expanded&&!dragged&&!event.target.closest('button,input,select,a,label'))setExpanded(true);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!$('resultSheet').hidden){
      if(expanded)setExpanded(false);else if(!$('retakeButton').disabled)onRetake();
    }
    if(event.altKey&&event.key==='ArrowRight'){event.preventDefault();showScreen('camera');}
    if(event.altKey&&event.key==='ArrowLeft'){event.preventDefault();showScreen('setup');}
  });
  return {showScreen,showSheet,closeSheet,setExpanded,isCamera:()=>screen==='camera'};
}
