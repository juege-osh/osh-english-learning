'use strict';
const statusNode=document.getElementById('offline-status');
async function checkOffline(){
 if(!('serviceWorker' in navigator)){statusNode.textContent='当前浏览器不支持离线保存，请用 iPhone Safari 打开。';return;}
 statusNode.textContent='正在保存完整离线包，请保持页面打开…';
 try{
  const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  const worker=registration.active||registration.installing||registration.waiting;
  if(registration.active)registration.active.postMessage({type:'CHECK_OFFLINE'});
  if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='activated')worker.postMessage({type:'CHECK_OFFLINE'});if(worker.state==='redundant')statusNode.textContent='下载未完成，请联网后点“检查离线包”重试。';});
 }catch{statusNode.textContent='离线保存失败，请检查网络，再点“检查离线包”。';}
}
navigator.serviceWorker?.addEventListener('message',event=>{
 const data=event.data||{};
 if(data.type==='OFFLINE_PROGRESS')statusNode.textContent=`正在保存离线包 ${data.done}/${data.total}，请保持页面打开…`;
 if(data.type==='OFFLINE_READY')statusNode.textContent='✓ 离线包完整 · 20,000 词与 40,000 句已保存，可断网刷题';
 if(data.type==='OFFLINE_MISSING')statusNode.textContent='离线包不完整，请联网后重新打开。';
});
document.getElementById('offline-retry').addEventListener('click',checkOffline);
checkOffline();
