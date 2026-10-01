'use strict';
let cloudRevision=0,cloudEnabled=false,cloudDirty=false,cloudTimer=null,cloudStarting=null,cloudFlight=null,cloudAccountOwner='',cloudEpoch=0,cloudAbort=null;
function progressStatus(message){if(typeof document==='undefined')return;const el=document.getElementById('cloud-status');if(el)el.textContent=message;}

// Merge the data immediately, but don't rebuild the page underneath an answer
// or an unsent form. Inspect the visible view: specialty sessions can remain in
// memory after the learner has returned to the route list.
function progressViewBusy(){
 if((typeof session!=='undefined'&&session)||(typeof basicsBusy==='function'&&basicsBusy()))return true;
 if(typeof document==='undefined')return false;
 const view=document.getElementById('app');if(!view)return false;
 if(view.querySelector?.('.question-workspace, .question-card, .race-question'))return true;
 const active=document.activeElement;
 if(active&&view.contains?.(active)&&(/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)||active.isContentEditable))return true;
 for(const field of view.querySelectorAll?.('input, textarea, select, [contenteditable]')||[]){
  if(field.isContentEditable){if(field.textContent?.trim())return true;continue;}
  if(field.tagName==='SELECT'){
   const options=Array.from(field.options||[]),explicit=options.some(option=>option.defaultSelected);
   const implicit=field.multiple||explicit?-1:options.findIndex(option=>!option.disabled&&!(option.parentElement?.tagName==='OPTGROUP'&&option.parentElement.disabled));
   if(options.some((option,index)=>option.selected!==!!(option.defaultSelected||index===implicit)))return true;
   continue;
  }
  if(['button','submit','reset','hidden'].includes(field.type))continue;
  if(['checkbox','radio'].includes(field.type)){if(field.checked!==field.defaultChecked)return true;continue;}
  if(String(field.value||'')!==String(field.defaultValue||''))return true;
 }
 return false;
}
function progressRefreshView(){
 if(typeof header==='function')header();
 if(typeof loaded!=='undefined'&&loaded&&!progressViewBusy())route();
}

function progressMerge(local,remote){
 if(!C.validate(remote))return local;
 if(!C.validate(local))return remote;
 const hasLocal=Object.keys(local.words).length||Object.keys(local.levels).length||Object.keys(local.missions).length||Object.values(local.industries||{}).some(entry=>(entry?.seen||[]).length||Object.keys(entry?.skipped||{}).length)||Object.values(local.basics||{}).some(entry=>Object.keys(entry).length);
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
  const answers={...(entry.answers||{}),...(own.answers||{})};
  for(const [word,answer]of Object.entries(entry.answers||{})){const localAnswer=own.answers?.[word];if(!localAnswer||answer.at>localAnswer.at||(answer.at===localAnswer.at&&!answer.correct))answers[word]=answer;}
  out.industries[id]={...entry,...own,seen:[...new Set([...(entry.seen||[]),...(own.seen||[])])],skipped,skipResetAt,answers};
 }
 if(local.basics||remote.basics)out.basics=C.mergeBasics(local.basics,remote.basics);
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

// Call when an account generation changes, before replacing local account state.
function progressInvalidate(){
 cloudEpoch++;clearTimeout(cloudTimer);cloudAbort?.abort();cloudAbort=null;
 cloudEnabled=false;cloudDirty=false;cloudRevision=0;cloudFlight=null;cloudStarting=null;
}
function progressCurrent(token,owner){return token===cloudEpoch&&owner===cloudAccountOwner;}
async function progressAccountChanged(token){
 if(token!==cloudEpoch)return;progressInvalidate();return progressStart();
}
function progressFlush(){
 if(cloudFlight)return cloudFlight;
 if(!cloudEnabled||!cloudDirty)return Promise.resolve(true);
 const token=cloudEpoch,owner=cloudAccountOwner,snapshot=JSON.stringify(p);cloudDirty=false;
 const abort=typeof AbortController==='undefined'?null:new AbortController();cloudAbort=abort;
 const request=(async()=>{
  try{
   const r=await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json','X-Study-Owner':owner},body:JSON.stringify({revision:cloudRevision,progress:JSON.parse(snapshot)}),...(abort?{signal:abort.signal}:{})});
   if(!progressCurrent(token,owner))return false;
   if(r.status===403){await progressAccountChanged(token);return false;}
   if(r.status===409){
    const read=await fetch('/api/progress',{headers:{'X-Study-Owner':owner},...(abort?{signal:abort.signal}:{})});
    if(!progressCurrent(token,owner))return false;
    if(read.status===403){await progressAccountChanged(token);return false;}
    if(!read.ok)throw Error('sync unavailable');
    const latest=await read.json();if(!progressCurrent(token,owner))return false;
    if(latest.owner!==owner)throw Error('account changed');
    if(!C.validate(latest.progress))throw Error('invalid progress');
    p=progressMerge(p,latest.progress);localStorage.setItem(KEY,JSON.stringify(p));progressRefreshView();
    cloudRevision=latest.revision;cloudDirty=true;
   }else if(!r.ok)throw Error('sync failed');
   else{const result=await r.json();if(!progressCurrent(token,owner))return false;if(result.owner!==owner)throw Error('account changed');cloudRevision=result.revision;if(JSON.stringify(p)!==snapshot)cloudDirty=true;}
   progressStatus(cloudDirty?'本机已保存 · 正在同步到账号':'已同步到账号 · 可跨设备继续');
  }catch{if(progressCurrent(token,owner)){cloudDirty=true;progressStatus('本机已保存 · 云端暂未同步，请稍后重试');}}
  finally{if(progressCurrent(token,owner)){cloudFlight=null;cloudAbort=null;if(cloudDirty&&cloudEnabled){clearTimeout(cloudTimer);cloudTimer=setTimeout(progressFlush,5000);}}}
  return progressCurrent(token,owner)&&!cloudDirty;
 })();cloudFlight=request;return request;
}

function progressStart(){
 if(cloudStarting)return cloudStarting;
 const token=cloudEpoch;
 const request=(async()=>{
  try{
   const response=await fetch('/api/account');if(token!==cloudEpoch)return false;if(!response.ok)throw Error('account unavailable');
   const account=await response.json();if(token!==cloudEpoch)return false;
   const owner=account.registered?String(account.id||''):'';
   if(account.registered&&!owner)throw Error('account identity missing');
   if(cloudAccountOwner&&cloudAccountOwner!==owner){p=C.fresh();localStorage.setItem(KEY,JSON.stringify(p));cloudAccountOwner=owner;progressInvalidate();return await progressStart();}
   cloudAccountOwner=owner;
   if(typeof StudyTools!=='undefined'){await StudyTools.session(account);if(!progressCurrent(token,owner))return false;}
   if(!account.registered){cloudEnabled=false;progressStatus('进度保存在此设备 · 登录后可跨设备同步');return false;}
   const r=await fetch('/api/progress',{headers:{'X-Study-Owner':owner}});if(!progressCurrent(token,owner))return false;
   if(r.status===403){await progressAccountChanged(token);return false;}if(!r.ok)throw Error('sync unavailable');
   const remote=await r.json();if(!progressCurrent(token,owner))return false;if(remote.owner!==owner)throw Error('account changed');cloudRevision=remote.revision;
   if(C.validate(remote.progress)){
    const merged=progressMerge(p,remote.progress);
    if(JSON.stringify(merged)!==JSON.stringify(p)){
     p=merged;localStorage.setItem(KEY,JSON.stringify(p));
     mapChapter=Math.ceil(currentLevel()/100);mapPage=Math.floor(((currentLevel()-1)%100)/20);progressRefreshView();
    }
   }
   cloudEnabled=true;
   if(!C.validate(remote.progress)||JSON.stringify(remote.progress)!==JSON.stringify(p)){progressSchedule();clearTimeout(cloudTimer);return await progressFlush();}
   progressStatus('已同步到账号 · 可跨设备继续');return true;
  }catch{if(token===cloudEpoch){cloudEnabled=false;progressStatus('本机已保存 · 云端暂不可用');toast('云端同步暂时不可用。进度仍保存在此设备，可先导出备份。');}return false;}
  finally{if(token===cloudEpoch)cloudStarting=null;}
 })();cloudStarting=request;return request;
}

async function progressBeforeLogout(){
 const token=cloudEpoch;
 if(typeof StudyTools!=='undefined'&&!(await StudyTools.beforeLogout()))return false;
 if(token!==cloudEpoch)return false;clearTimeout(cloudTimer);
 for(let attempt=0;attempt<3&&(cloudDirty||cloudFlight);attempt++){const ok=await progressFlush();if(token!==cloudEpoch)return false;if(ok)break;}
 if(cloudDirty||cloudFlight){toast('云端尚未保存成功，请先导出进度再退出。');return false;}
 progressInvalidate();progressStatus('进度保存在此设备 · 登录后可跨设备同步');return true;
}
