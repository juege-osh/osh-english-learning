'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../core.js');
function harness(initialMute){
 const listeners={},windowListeners={},storage=new Map(),tones=[],contexts=[],classes=new Set(),controls=[],elements=new Map();
 if(initialMute!==undefined)storage.set('english-quest-game-muted',initialMute);
 const app={innerHTML:'',classList:{add:x=>classes.add(x),remove:(...names)=>names.forEach(x=>classes.delete(x))}};
 const toggle={textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}};controls.push(toggle);elements.set('app',app);
 function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',style:{},selectedOptions:[],focus(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);}
 class MockAudioContext{
  constructor(){this.state='suspended';this.currentTime=1;this.destination={};contexts.push(this);}
  async resume(){this.state='running';}
  createOscillator(){const t={type:'',frequency:{setValueAtTime(frequency,at){t.frequencyValue=frequency;t.at=at;}},connect(){},disconnect(){t.disconnected=true;},start(at){t.startedAt=at;},stop(at){t.stoppedAt=at??0;}};tones.push(t);return t;}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(value){assert(value<=.075);},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 const document={hidden:false,getElementById:element,querySelectorAll:selector=>selector==='[data-game-sound]'?controls:[],querySelector:()=>null,addEventListener(name,fn){(listeners[name]??=[]).push(fn);}};
 const window={AudioContext:MockAudioContext,addEventListener(name,fn){(windowListeners[name]??=[]).push(fn);},scrollTo(){}};
 const context=vm.createContext({document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},console,setTimeout:()=>1,clearTimeout(){},setInterval(){},clearInterval(){},EnglishCore:C,location:{hash:'#race',search:''},URLSearchParams,fetch:async()=>({ok:true,json:async()=>({})})});
 vm.runInContext(fs.readFileSync(require.resolve('../game-effects.js'),'utf8'),context);context.GameEffects=window.GameEffects;
 return {context,api:window.GameEffects,document,listeners,windowListeners,tones,contexts,classes,storage,toggle,app,element};
}
(async()=>{
 let h=harness();assert.equal(h.contexts.length,0,'loading the page must not construct an AudioContext');
 h.api.mark('race',{mode:'idle'});h.api.mark('race',{mode:'waiting'});assert.equal(h.tones.length,0,'no sound before an actual interaction unlocks audio');
 await h.listeners.pointerdown[0]({isTrusted:false});assert.equal(h.contexts.length,0,'a synthetic pointer event cannot unlock audio');await h.api.unlock();assert.equal(h.contexts.length,1);h.api.mark('race',{mode:'waiting'});assert.equal(h.tones.length,0,'unlock must not replay an earlier silent event');
 h.api.mark('race',{mode:'idle'});h.api.mark('race',{mode:'waiting'});assert.equal(h.tones.length,2,'a new real matching transition has a short cue');h.api.mark('race',{mode:'waiting'});assert.equal(h.tones.length,2,'polling the same waiting state is silent');
 h.api.mark('race',{mode:'racing',matchId:'match-one'});assert.equal(h.tones.length,5);h.api.mark('race',{mode:'racing',matchId:'match-one'});assert.equal(h.tones.length,5);
 assert(h.api.answer(true,'race','match-one:0:0'));const correctTones=h.tones.length;assert(!h.api.answer(true,'race','match-one:0:0'));assert.equal(h.tones.length,correctTones,'replaying the accepted answer cannot repeat its cue');assert(h.classes.has('game-feedback-correct'));
 h.api.answer(false,'race','match-one:1:1');assert(h.classes.has('game-feedback-wrong'));assert(h.tones.some(t=>t.frequencyValue===165));
 h.api.mark('race',{mode:'finished',matchId:'match-one',won:true});const finishedTones=h.tones.length;h.api.mark('race',{mode:'finished',matchId:'match-one',won:true});assert.equal(h.tones.length,finishedTones);assert(h.classes.has('game-feedback-win'));
 h.api.setMuted(true);assert.equal(h.storage.get('english-quest-game-muted'),'1');assert.equal(h.toggle.attrs['aria-pressed'],'false');assert(h.tones.every(t=>t.stoppedAt===0),'mute stops active and scheduled tones');h.api.answer(true,'race','match-one:2:0');assert.equal(h.tones.length,finishedTones);assert(h.classes.has('game-feedback-correct'),'visual correctness remains when muted');
 h.api.setMuted(false);assert.equal(h.storage.get('english-quest-game-muted'),'0');h.document.hidden=true;const hiddenCount=h.tones.length;h.api.answer(false,'race','hidden-answer');h.document.hidden=false;h.api.answer(false,'race','hidden-answer');assert.equal(h.tones.length,hiddenCount,'hidden events are discarded instead of replayed later');
 h.context.location.hash='#duo';h.api.mark('duo',{mode:'solo'});h.api.mark('duo',{mode:'inviting',team:{id:'team-one'}});h.api.mark('duo',{mode:'ready',team:{id:'team-one'}});assert(h.classes.has('game-feedback-matched'));h.api.mark('duo',{mode:'practicing',team:{id:'team-one'}});h.api.answer(true,'duo','team-one:0:0');h.api.mark('duo',{mode:'practice_done',team:{id:'team-one'}});assert(h.classes.has('game-feedback-win'));h.api.mark('duo',{mode:'ready',team:{id:'team-one'}});h.api.mark('duo',{mode:'practicing',team:{id:'team-one'}});const secondRound=h.tones.length;h.api.answer(true,'duo','team-one:0:0');assert.equal(h.tones.length,secondRound+2,'a new practice round may reuse the same question index');
 const offPageTones=h.tones.length;h.context.location.hash='#map';h.api.answer(false,'duo','off-page');assert.equal(h.tones.length,offPageTones,'leaving the game page prevents a late response from sounding');h.context.location.hash='#duo';
 h.api.mark('duo',{mode:'waiting',team:{id:'team-one'}});h.api.mark('duo',{mode:'racing',matchId:'duo-match',team:{id:'team-one'}});h.api.mark('duo',{mode:'finished',matchId:'duo-match',won:false});assert(h.classes.has('game-feedback-loss'));
 const markup=h.api.waiting('<对手>');assert(markup.includes('match-orbit'));assert(markup.includes('&lt;对手&gt;'));assert(markup.includes('role="status"'));assert(h.api.controls().includes('data-game-sound'));
 h=harness('1');assert(h.api.isMuted());await h.api.unlock();assert.equal(h.contexts.length,0,'persisted mute does not construct audio until enabled');h.api.setMuted(false);await h.listeners.pointerdown[0]({isTrusted:true});assert.equal(h.contexts.length,1);h.windowListeners.storage[0]({key:'english-quest-game-muted',newValue:'1'});assert(h.api.isMuted());
 // Readback of old results must not play a victory cue after page reload.
 h=harness();await h.api.unlock();h.api.mark('race',{mode:'finished',matchId:'old',won:true});assert.equal(h.tones.length,0);
 // Use the actual render functions to verify the controls and waiting animation are connected.
 h=harness();vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8').replace('\ninit();','\n'),h.context);vm.runInContext(fs.readFileSync(require.resolve('../features-ui.js'),'utf8'),h.context);vm.runInContext('p=C.fresh();',h.context);
 h.context.raceTest={mode:'idle',profile:{tier:'青铜',points:0,wins:0,losses:0},goals:[100],notices:[]};vm.runInContext('raceDisplay(raceTest,true)',h.context);assert(h.app.innerHTML.includes('data-game-sound'));h.context.raceTest.mode='waiting';h.context.raceTest.goal=100;vm.runInContext('raceDisplay(raceTest,true)',h.context);assert(h.app.innerHTML.includes('match-orbit'));assert(!h.app.innerHTML.includes('result-medal">⌛'));
 h.context.duoTest={mode:'inviting',team:{id:'team',names:'测试搭档',inviteCode:'team'},boards:{practice:[],competitive:[]},notices:[]};vm.runInContext('duoDisplay(duoTest,true)',h.context);assert(h.app.innerHTML.includes('match-search-dots'));assert(h.app.innerHTML.includes('data-game-sound'));
 const css=fs.readFileSync(require.resolve('../game-effects.css'),'utf8');assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('min-height:44px'));console.log('PASS: real-state single/duo animations, interaction-only WebAudio unlock, short synthesized cues, poll/answer/result dedup, persisted mute and cross-tab mute, hidden/reloaded results stay silent, repeat practice rounds, actual UI integration and reduced-motion/44px controls');
})().catch(error=>{console.error(error);process.exitCode=1;});
