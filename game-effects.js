'use strict';
// 本地合成短音效；没有循环背景音，不请求第三方音频。
(function(root){
 const SOUND_KEY='english-quest-game-muted',snapshots=new Map(),seen=new Set(),active=new Set();
 let muted=false,audio=null,unlocked=false,flashTimer=null,flashEpoch=0;
 try{muted=localStorage.getItem(SOUND_KEY)==='1';}catch{}
 const cues={
  waiting:[[392,0,.07],[523,.09,.09]],
  matched:[[523,0,.09],[659,.1,.09],[784,.2,.16]],
  correct:[[660,0,.07],[880,.08,.10]],
  wrong:[[220,0,.10],[165,.10,.12]],
  win:[[523,0,.1],[659,.12,.1],[784,.24,.1],[1047,.36,.23]],
  loss:[[330,0,.12],[262,.14,.12],[196,.28,.19]]
 };
 function visible(){return !document.hidden;}
 function stop(){for(const oscillator of active){try{oscillator.stop();}catch{}try{oscillator.disconnect();}catch{}}active.clear();}
 async function unlock(){
  if(!visible()||muted)return false;
  try{if(!audio){const AudioCtor=root.AudioContext||root.webkitAudioContext;if(!AudioCtor)return false;audio=new AudioCtor();}if(audio.state!=='running')await audio.resume();unlocked=audio.state==='running';return unlocked;}catch{unlocked=false;return false;}
 }
 function refresh(){document.querySelectorAll('[data-game-sound]').forEach(el=>{el.textContent=muted?'♪ 音效关':'♪ 音效开';el.setAttribute('aria-pressed',String(!muted));el.setAttribute('aria-label',muted?'开启对局音效':'关闭对局音效');});}
 function setMuted(value){muted=!!value;if(muted)stop();try{localStorage.setItem(SOUND_KEY,muted?'1':'0');}catch{}refresh();return muted;}
 function controls(){return `<div class="game-effects-controls"><button type="button" class="game-sound-toggle" data-game-sound aria-pressed="${!muted}" aria-label="${muted?'开启':'关闭'}对局音效">♪ 音效${muted?'关':'开'}</button><small>短提示音 · 可随时关闭</small></div>`;}
 function waiting(label='正在寻找对手'){
  return `<div class="match-motion" role="status" aria-label="${String(label).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}"><span class="match-orbit" aria-hidden="true"><i></i><i></i><b>⚔</b></span><span class="match-search-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
 }
 function sound(type){
  if(muted||!unlocked||!audio||audio.state!=='running'||!visible()||!cues[type])return false;
  const base=audio.currentTime;
  try{for(const [frequency,delay,duration]of cues[type]){
   const osc=audio.createOscillator(),gain=audio.createGain(),at=base+delay;
   osc.type='sine';osc.frequency.setValueAtTime(frequency,at);
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.075,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
   osc.connect(gain);gain.connect(audio.destination);active.add(osc);osc.onended=()=>{active.delete(osc);osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration+.02);
  }return true;}catch{return false;}
 }
 function flash(type){
  if(!visible())return;const app=document.getElementById('app');if(!app?.classList)return;const epoch=++flashEpoch;
  clearTimeout(flashTimer);app.classList.remove('game-feedback-correct','game-feedback-wrong','game-feedback-win','game-feedback-loss','game-feedback-matched');
  app.classList.add('game-feedback-'+type);flashTimer=setTimeout(()=>{if(epoch===flashEpoch)app.classList.remove('game-feedback-'+type);},480);
 }
 function emit(type,key){
  if(key&&seen.has(key))return false;if(key){seen.add(key);if(seen.size>512)seen.delete(seen.values().next().value);}
  if(!visible()||typeof location!=='undefined'&&location.hash.slice(1).split('?')[0]!==key?.split(':')[0])return false;
  if(['correct','wrong','win','loss','matched'].includes(type))flash(type);
  return sound(type);
 }
 function mark(channel,state){
  if(!state||!['race','duo'].includes(channel))return;
  const previous=snapshots.get(channel),mode=state.mode,changed=!previous||previous.mode!==mode;
  const generation=(previous?.generation||0)+(changed&&['waiting','inviting','practicing'].includes(mode)?1:0);
  const next={mode,generation,matchId:state.matchId||'',teamId:state.team?.id||''};snapshots.set(channel,next);
  // Restoring an existing match/result is quiet; state transitions come from the server.
  if(!previous)return;
  if(changed&&['waiting','inviting'].includes(mode))emit('waiting',`${channel}:wait:${generation}`);
  if(changed&&(mode==='racing'||mode==='practicing'||mode==='ready'&&previous.mode==='inviting'))emit('matched',`${channel}:start:${next.matchId||next.teamId}:${generation}`);
  if(changed&&mode==='finished'&&previous.mode==='racing')emit(state.won?'win':'loss',`${channel}:result:${next.matchId}:${generation}`);
  if(changed&&mode==='practice_done'&&previous.mode==='practicing')emit('win',`${channel}:practice-result:${next.teamId}:${generation}`);
 }
 function answer(correct,channel,eventId){
  if(!['race','duo'].includes(channel)||!eventId)return false;
  const generation=snapshots.get(channel)?.generation||0;return emit(correct?'correct':'wrong',`${channel}:answer:${generation}:${eventId}:${!!correct}`);
 }
 const api={unlock,setMuted,isMuted:()=>muted,controls,waiting,mark,answer};root.GameEffects=api;
 function interaction(e){if(e.isTrusted===false||e.repeat)return;unlock();}
 document.addEventListener('pointerdown',interaction,{capture:true,passive:true});
 document.addEventListener('keydown',interaction,{capture:true});
 document.addEventListener('click',e=>{const button=e.target.closest?.('[data-game-sound]');if(!button)return;e.preventDefault();setMuted(!muted);if(!muted)unlock();});
 document.addEventListener('visibilitychange',()=>{if(!visible())stop();});
 root.addEventListener('storage',e=>{if(e.key===SOUND_KEY){muted=e.newValue==='1';if(muted)stop();refresh();}});
})(window);
