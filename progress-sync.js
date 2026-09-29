'use strict';
let cloudRevision=0,cloudEnabled=false,cloudDirty=false,cloudTimer=null,cloudStarting=null,cloudFlight=null;
function progressStatus(message){if(typeof document==='undefined')return;const el=document.getElementById('cloud-status');if(el)el.textContent=message;}

function progressMerge(local,remote){
 if(!C.validate(remote))return local;
 if(!C.validate(local))return remote;
 const hasLocal=Object.keys(local.words).length||Object.keys(local.levels).length||Object.keys(local.missions).length||Object.values(local.industries||{}).some(entry=>(entry?.seen||[]).length||Object.keys(entry?.skipped||{}).length);
 if(!hasLocal)return remote;
 const out={...remote,...local};
 for(const key of ['levels','bosses','missions']){
  out[key]={...remote[key],...local[key]};
  for(const [id,score]of Object.entries(remote[key]))out[key][id]=Math.max(score,out[key][id]||0);
 }
 out.words={...remote.words,...local.words};
 for(const [id,a]of Object.entries(remote.words)){
  const b=local.words[id];if(!b)continue;
  const aEvent=Math.max(a.last,a.failed),bEvent=Math.max(b.last,b.failed);
  const chosen=aEvent>bEvent?a:bEvent>aEvent?b:a.days.length>b.days.length?a:b;
  out.words[id]={...chosen,first:Math.min(a.first,b.first),wrong:Math.max(a.wrong,b.wrong),seen:Math.max(a.seen,b.seen)};
 }
 out.days={...remote.days,...local.days};
 for(const [day,count]of Object.entries(remote.days))out.days[day]=Math.max(count,out.days[day]||0);
 out.industries={...remote.industries,...local.industries};
 for(const [id,entry]of Object.entries(remote.industries||{})){
  const own=local.industries?.[id];if(!own)continue;
  const skipResetAt=Math.max(entry.skipResetAt||0,own.skipResetAt||0);
  const skipped={...(entry.skipped||{}),...(own.skipped||{})};
  for(const [word,at] of Object.entries(skipped))if(at<=skipResetAt)delete skipped[word];
  out.industries[id]={...entry,...own,seen:[...new Set([...(entry.seen||[]),...(own.seen||[])])],skipped,skipResetAt};
 }
 out.xp=Math.min(450000,Math.max(local.xp,remote.xp,Object.keys(out.levels).length*100+Object.keys(out.bosses).length*150+Object.keys(out.missions).length*80));
 out.totalTimeMs=Math.max(local.totalTimeMs||0,remote.totalTimeMs||0);
 return C.validate(out)?out:local;
}

function progressSchedule(){
 if(!cloudEnabled)return;
 progressStatus('本机已保存 · 正在同步到账号');
 cloudDirty=true;clearTimeout(cloudTimer);
 cloudTimer=setTimeout(progressFlush,1800);
}

function progressFlush(){
 if(cloudFlight)return cloudFlight;
 if(!cloudEnabled||!cloudDirty)return Promise.resolve(true);
 cloudDirty=false;const snapshot=JSON.stringify(p);
 cloudFlight=(async()=>{
  try{
   const r=await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:cloudRevision,progress:JSON.parse(snapshot)})});
   if(r.status===409){
    const latest=await fetch('/api/progress').then(x=>x.json());
    if(C.validate(latest.progress)){p=progressMerge(p,latest.progress);localStorage.setItem(KEY,JSON.stringify(p));header();if(!session)route();}
    cloudRevision=latest.revision;cloudDirty=true;
   }else if(!r.ok)throw Error('sync failed');
   else{const result=await r.json();cloudRevision=result.revision;if(JSON.stringify(p)!==snapshot)cloudDirty=true;}
   progressStatus(cloudDirty?'本机已保存 · 正在同步到账号':'已同步到账号 · 可跨设备继续');
  }catch{cloudDirty=true;progressStatus('本机已保存 · 云端暂未同步，请稍后重试');}
  finally{cloudFlight=null;if(cloudDirty&&cloudEnabled){clearTimeout(cloudTimer);cloudTimer=setTimeout(progressFlush,5000);}}
  return !cloudDirty;
 })();
 return cloudFlight;
}

async function progressStart(){
 if(cloudStarting)return cloudStarting;
 cloudStarting=(async()=>{
  try{
   const account=await fetch('/api/account').then(r=>r.json());
   if(!account.registered){cloudEnabled=false;progressStatus('进度保存在此设备 · 登录后可跨设备同步');return false;}
   const r=await fetch('/api/progress');if(!r.ok)throw Error('sync unavailable');
   const remote=await r.json();cloudRevision=remote.revision;
   if(C.validate(remote.progress)){
    const merged=progressMerge(p,remote.progress);
    if(JSON.stringify(merged)!==JSON.stringify(p)){
     p=merged;localStorage.setItem(KEY,JSON.stringify(p));
     mapChapter=Math.ceil(currentLevel()/100);mapPage=Math.floor(((currentLevel()-1)%100)/20);
     if(loaded&&!session)route();
    }
   }
   cloudEnabled=true;
   if(!C.validate(remote.progress)||JSON.stringify(remote.progress)!==JSON.stringify(p)){
    progressSchedule();clearTimeout(cloudTimer);
    return await progressFlush();
   }
   progressStatus('已同步到账号 · 可跨设备继续');
   return true;
  }catch{cloudEnabled=false;progressStatus('本机已保存 · 云端暂不可用');toast('云端同步暂时不可用。进度仍保存在此设备，可先导出备份。');return false;}
 })();
 try{return await cloudStarting;}finally{cloudStarting=null;}
}

async function progressBeforeLogout(){
 clearTimeout(cloudTimer);
 for(let attempt=0;attempt<3&&(cloudDirty||cloudFlight);attempt++){
  const ok=await progressFlush();
  if(ok)break;
 }
 if(cloudDirty||cloudFlight){toast('云端尚未保存成功，请先导出进度再退出。');return false;}
 cloudEnabled=false;cloudDirty=false;cloudRevision=0;
 progressStatus('进度保存在此设备 · 登录后可跨设备同步');
 return true;
}
