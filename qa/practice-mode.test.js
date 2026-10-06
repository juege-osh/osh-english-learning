'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../core.js');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8').replace('\ninit();','\n');
function harness(initialMode,storageAvailable=true,initialDelay){
 const elements=new Map(),timers=new Map(),events={},stored=new Map(),classes=new Set();let nextTimer=0,clock=Date.now();
 if(initialMode!==undefined)stored.set('english-quest-practice-mode',initialMode);
 if(initialDelay!==undefined)stored.set('english-quest-practice-delay-seconds',String(initialDelay));
 function el(id){
  if(!elements.has(id)){
   let html='';const node={textContent:'',value:'',disabled:false,style:{},details:{open:false},focus(){},addEventListener(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}}};
   Object.defineProperty(node,'innerHTML',{get:()=>html,set:value=>{html=value;node.details.open=false;if(id==='app')for(const name of ['feedback','industry-feedback','basic-feedback'])if(elements.has(name))elements.get(name).innerHTML='';}});
   node.querySelector=selector=>selector==='.feedback:not(.wrong)'&&/<div class="feedback(?: )?">/.test(html)?node:null;
   node.querySelectorAll=selector=>selector==='details.answer-details'&&html.includes('class="answer-details"')?[node.details]:[];
   elements.set(id,node);
  }return elements.get(id);
 }
 const modeButtons=['slow','fast','delay'].map(id=>({dataset:{id},attrs:{},classList:{toggle(name,selected){if(selected)classes.add(id);else classes.delete(id);}},setAttribute(k,v){this.attrs[k]=v;}}));
 const note=el('mode-note'),delayInput=el('delay-input'),delayLabel={hidden:true};
 const picker={querySelectorAll:selector=>selector==='[data-action="practice-mode"]'?modeButtons:[],querySelector:selector=>selector==='.practice-mode-note'?note:selector==='[data-practice-delay]'?delayInput:selector==='.practice-delay-setting'?delayLabel:null};
 class ClockDate extends Date {static now(){return clock;}}
 const context=vm.createContext({EnglishCore:C,Date:ClockDate,console,location:{hash:'#map',search:''},document:{getElementById:el,addEventListener(name,fn){events['document:'+name]=fn;},querySelectorAll(selector){return selector==='.practice-mode-picker'?[picker]:[];}},window:{addEventListener(name,fn){(events[name]??=[]).push(fn);},scrollTo(){}},localStorage:storageAvailable?{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}:undefined,setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},setInterval(){},clearInterval(){},matchMedia:()=>({matches:true})});
 vm.runInContext(source,context);vm.runInContext('save=()=>{};confetti=()=>{};',context);
 function run(code){return vm.runInContext(code,context);}
 function flush(){const queued=[...timers.values()];timers.clear();for(const timer of queued){clock+=timer.delay;timer.fn();}}
 function jump(ms){clock+=ms;}
 function start(q){context.testQuestion=q;run("practiceAutoCancel();p=C.fresh();session={type:'review',id:'review',title:'测试',phase:'quiz',items:[],index:0,correct:0,missed:[],combo:0,bestCombo:0,total:10,start:Date.now(),queue:[testQuestion,{w:{id:99,word:'next',zh:'下一个'},type:'choice-zh',options:[]}]};renderQuestion();");return context;}
 return {context,run,el,timers,stored,classes,modeButtons,note,delayInput,delayLabel,events,start,flush,jump};
}
const word={id:1,word:'hello',zh:'你好',full:'你好',sentence:'Hello there.',translation:'你好。',en:'a greeting'},other={id:2,word:'bye',zh:'再见'};
const choice=()=>({w:word,type:'choice-zh',options:[word,other]});
let h=harness();assert.equal(h.run('getPracticeMode()'),'slow');assert(h.run('renderPracticeMode()').includes('aria-label="答题节奏"'));assert(h.run('renderPracticeMode()').includes('aria-pressed="true"'));
h.start(choice());h.run("answer('1');answer('1');actions.next();actions.next()");assert.equal(h.run('session.index'),1);assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.timers.size,0,'slow answers await one explicit Continue');
h=harness('fast');h.start(choice());assert.equal(h.run('practiceSpeed'),'fast');h.run("answer('1');answer('1')");assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].delay,0);assert.equal(h.run('p.words[1].seen'),1);h.flush();assert.equal(h.run('session.index'),1);
h=harness('fast');h.start(choice());h.run("answer('2');answer('1')");assert.equal(h.timers.size,0,'wrong answers must remain for feedback');assert.equal(h.run('session.index'),0);assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.run('p.words[1].wrong'),1);assert(h.el('feedback').innerHTML.includes('feedback wrong'));assert(h.el('feedback').innerHTML.includes('<details class="answer-details">'));assert(!h.el('feedback').innerHTML.includes('<details class="answer-details" open'));
h=harness('fast');h.start(choice());h.run("answer('1');actions.next()");assert.equal(h.timers.size,0);h.flush();assert.equal(h.run('session.index'),1,'manual Continue cancels the pending advance');
h=harness('fast');h.start({w:word,type:'spell'});h.el('answer-input').value=' HELLO! ';h.run("actions['answer-check']();actions['answer-check']()");assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.run('p.words[1].production'),true);h.flush();assert.equal(h.run('session.index'),1);
for(const type of ['choice-en','choice-cloze','definition','spell-hint','cloze']){
 h=harness('fast');const q={w:word,type};if(type.startsWith('choice')||type==='definition')q.options=[word,other];h.start(q);h.run(q.options?"answer('1');answer('1')":"answer('hello');answer('hello')");assert.equal(h.run('p.words[1].seen'),1,type+' records once');assert.equal(h.timers.size,1,type+' supports fast mode');h.flush();assert.equal(h.run('session.index'),1,type+' advances once');
}
h=harness('fast');h.start({w:{...word,sentence:'Hello there.'},type:'order',tokens:[{text:'Hello',index:0},{text:'there.',index:1}],selected:[0,1]});h.run("actions['answer-check']();actions['answer-check']()");assert.equal(h.run('p.words[1].seen'),1);h.flush();assert.equal(h.run('session.index'),1,'sentence order advances after one valid submission');
h=harness('fast');h.start({w:{...word,sentence:'Hello there.'},type:'order',tokens:[{text:'Hello',index:0},{text:'there.',index:1}],selected:[1,0]});h.run("actions['answer-check']()");assert.equal(h.timers.size,0,'wrong sentence order stops');
const matchWords=[word,other,{id:3,word:'yes',zh:'是'}];
function match(){return {type:'match',items:matchWords,right:matchWords,matched:[],attempted:[],left:null,errors:0};}
h=harness('fast');h.start(match());h.run("matchLeft('1');matchRight('1');matchLeft('1');matchRight('1')");assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.timers.size,0,'a match group advances only when every pair is finished');h.run("matchLeft('2');matchRight('2');matchLeft('3');matchRight('3');matchRight('3')");assert.equal(h.run('Object.values(p.words).reduce((n,r)=>n+r.seen,0)'),3);assert.equal(h.timers.size,1);h.flush();assert.equal(h.run('session.index'),1);
h=harness('fast');h.start(match());h.run("matchLeft('1');matchRight('2');matchRight('1');matchLeft('2');matchRight('2');matchLeft('3');matchRight('3')");assert.equal(h.run('p.words[1].wrong'),1);assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.timers.size,0,'any wrong pair keeps the completed match group in manual mode');assert.equal(h.run('session.index'),0);
// Changing speed updates the controls without rebuilding an input or selected token list.
h=harness('fast');h.start({w:word,type:'spell'});h.el('answer-input').value='hel';const html=h.el('app').innerHTML,progress=h.run('JSON.stringify(p)');h.run("actions.practiceMode('slow')");assert.equal(h.el('app').innerHTML,html);assert.equal(h.el('answer-input').value,'hel');assert.equal(h.run('JSON.stringify(p)'),progress);assert.equal(h.stored.get('english-quest-practice-mode'),'slow');assert.equal(h.modeButtons[0].attrs['aria-pressed'],'true');assert.equal(h.modeButtons[1].attrs['aria-pressed'],'false');assert(h.note.textContent.includes('点继续'));assert.deepEqual([...h.stored.keys()],['english-quest-practice-mode']);
h=harness('fast');h.start(choice());h.run("answer('1');setPracticeMode('slow')");h.flush();assert.equal(h.run('session.index'),0,'switching to slow cancels the pending advance');
h=harness('fast');h.start(choice());h.run("answer('1');renderQuestion()");h.flush();assert.equal(h.run('session.index'),0,'rendering a new question cancels stale callbacks');
h=harness('fast');h.start(choice());h.run("answer('1')");h.context.location.hash='#review';for(const fn of h.events.hashchange)fn();h.flush();assert.equal(h.run('session.index'),0,'navigation cancels auto next even before data is loaded');
h=harness('fast');h.start(choice());h.run("answer('1')");for(const fn of h.events.storage)fn({key:'english-quest-practice-mode',newValue:'slow'});h.flush();assert.equal(h.run('session.index'),0);assert.equal(h.run('practiceSpeed'),'slow','another tab can change the preference');
h=harness('fast');h.run('testAdvanced=0;practiceAutoNext(true,()=>testAdvanced++,()=>false)');h.flush();assert.equal(h.run('testAdvanced'),0,'caller guard blocks an obsolete lesson');h.run('practiceAutoNext(true,()=>testAdvanced++,()=>true);practiceCancelAutoNext()');h.flush();assert.equal(h.run('testAdvanced'),0,'public cancellation alias works');

h=harness('fast');h.start(choice());h.run("answer('1')");const queuedCallback=[...h.timers.values()][0].fn;h.run('actions.next()');queuedCallback();assert.equal(h.run('session.index'),1,'a timer already queued before cancellation cannot advance the next question');
h=harness('fast');h.start(choice());h.run("answer('1')");h.flush();h.run("session.queue[1].options=[session.queue[1].w]");let prevented=false;h.events['document:keydown']({target:{tagName:'BODY',id:''},key:'1',repeat:true,preventDefault(){prevented=true;}});assert(!h.run('p.words[99]'),'holding a choice key must not answer the following question');h.events['document:keydown']({target:{tagName:'INPUT',id:'answer-input'},key:'Enter',repeat:true,preventDefault(){prevented=true;}});assert(prevented,'held Enter cannot submit an input on the next question');
h=harness('invalid');assert.equal(h.run('practiceSpeed'),'slow');h.run("setPracticeMode('invalid')");assert.equal(h.stored.get('english-quest-practice-mode'),'invalid');h=harness(undefined,false);assert.equal(h.run('practiceSpeed'),'slow');h.run("setPracticeMode('fast')");assert.equal(h.run('practiceSpeed'),'fast','blocked local storage still allows in-memory mode changes');h.run("session=null;answer('1');matchLeft('1');matchRight('1');actions.next();actions['answer-check']()");


// Delay mode opens only the current answered green feedback and counts down.
h=harness('delay');assert.equal(h.run('getPracticeDelay()'),3);const pickerHTML=h.run('renderPracticeMode()');assert(pickerHTML.includes('延迟跳题'));assert(pickerHTML.includes('data-practice-delay min="1" max="30"'));assert(!pickerHTML.includes('<select'));h.start(choice());h.run("answer('1');answer('1')");assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.run('session.index'),0);assert.equal(h.el('feedback').details.open,true);assert(h.note.textContent.includes('3 秒'));h.flush();assert.equal(h.run('session.index'),0);assert(h.note.textContent.includes('2 秒'));h.flush();assert.equal(h.run('session.index'),0);assert(h.note.textContent.includes('1 秒'));h.flush();assert.equal(h.run('session.index'),1);assert.equal(h.timers.size,0);
for(const seconds of [1,30]){
 h=harness('delay',true,seconds);h.start(choice());h.run("answer('1')");for(let n=1;n<seconds;n++){h.flush();assert.equal(h.run('session.index'),0,'does not advance before configured delay');}h.flush();assert.equal(h.run('session.index'),1);assert.equal(h.run('getPracticeDelay()'),seconds);
}
h=harness('delay');h.run('setPracticeDelay(30)');assert.equal(h.stored.get('english-quest-practice-delay-seconds'),'30');assert.equal(h.delayInput.value,'30');assert.equal(h.delayLabel.hidden,false);h.run("setPracticeMode('slow')");assert.equal(h.delayLabel.hidden,true);let restored=harness(h.stored.get('english-quest-practice-mode'),true,h.stored.get('english-quest-practice-delay-seconds'));assert.equal(restored.run('getPracticeDelay()'),30);
for(const invalid of ['',0,31,-1,2.5,'bad','Infinity']){h=harness('delay',true,5);h.context.invalid=invalid;assert.equal(h.run('setPracticeDelay(invalid)'),false);assert.equal(h.run('getPracticeDelay()'),5);assert.equal(h.stored.get('english-quest-practice-delay-seconds'),'5');}
for(const invalid of ['',0,31,2.5,'bad']){h=harness('delay',true,invalid);assert.equal(h.run('getPracticeDelay()'),3);}
h=harness('delay');h.start(choice());h.run("answer('2')");assert.equal(h.timers.size,0);assert.equal(h.el('feedback').details.open,false);assert.equal(h.run('session.index'),0,'delay wrong answer stops for manual feedback');
h=harness('delay');h.start(choice());h.run("answer('1')");const oldDelayCallback=[...h.timers.values()][0].fn;h.run('actions.next()');oldDelayCallback();assert.equal(h.run('session.index'),1);assert.equal(h.timers.size,0,'manual Continue cancels even a queued countdown callback');
for(const mode of ['slow','fast']){h=harness('delay');h.start(choice());h.run("answer('1');setPracticeMode('"+mode+"')");h.flush();assert.equal(h.run('session.index'),0);assert.equal(h.timers.size,0,'changing mode cancels the old delay');}
h=harness('delay');h.start(choice());h.run("answer('1');setPracticeDelay(10)");h.flush();assert.equal(h.run('session.index'),0);assert.equal(h.timers.size,0,'changing seconds cancels the old countdown');
h=harness('delay');h.start(choice());h.run("answer('1');renderQuestion()");h.flush();assert.equal(h.run('session.index'),0);assert.equal(h.timers.size,0,'render cancels old countdown');
h=harness('delay');h.start(choice());h.run("answer('1')");h.context.location.hash='#industries';for(const fn of h.events.hashchange)fn();h.flush();assert.equal(h.run('session.index'),0);assert.equal(h.timers.size,0,'route exit cancels countdown');
h=harness('delay');h.start(choice());h.run("answer('1')");for(const fn of h.events.storage)fn({key:'english-quest-practice-delay-seconds',newValue:'30'});h.flush();assert.equal(h.run('getPracticeDelay()'),30);assert.equal(h.run('session.index'),0);assert.equal(h.timers.size,0,'other tab delay update cancels old countdown');
h=harness('slow');for(const fn of h.events.storage)fn({key:'english-quest-practice-mode',newValue:'delay'});assert.equal(h.run('getPracticeMode()'),'delay');assert.equal(h.delayLabel.hidden,false);
h=harness('delay');h.start(choice());h.run("answer('1')");h.jump(3500);h.flush();assert.equal(h.run('session.index'),1,'a delayed browser timer uses the real deadline, not extra countdown ticks');
for(const id of ['industry-feedback','basic-feedback']){
 h=harness('delay');h.el(id).innerHTML='<div class="feedback"><details class="answer-details"></details></div>';h.el('learning-card').innerHTML='<details class="answer-details"></details>';h.run('advanced=0;practiceAutoNext(true,()=>advanced++,()=>true)');assert.equal(h.el(id).details.open,true);assert.equal(h.el('learning-card').details.open,false);h.run('practiceAutoCancel()');
}
h=harness(undefined,false);h.run("setPracticeMode('delay');setPracticeDelay(7)");assert.equal(h.run('getPracticeDelay()'),7);h.start(choice());h.run("answer('1')");assert.equal(h.el('feedback').details.open,true);h.run('practiceAutoCancel()');
h=harness('delay');h.start({w:word,type:'spell'});h.el('answer-input').value='hel';const beforeHTML=h.el('app').innerHTML;h.events['document:change']({target:{matches:selector=>selector==='[data-practice-delay]',value:'8'}});assert.equal(h.run('getPracticeDelay()'),8);assert.equal(h.el('app').innerHTML,beforeHTML);assert.equal(h.el('answer-input').value,'hel','seconds input must not rebuild a half-written answer');
for(const type of ['choice-zh','choice-en','choice-cloze','definition','spell','spell-hint','cloze','order']){
 h=harness('delay',true,1);const q={w:word,type};if(type.startsWith('choice')||type==='definition')q.options=[word,other];if(type==='order'){q.tokens=[{text:'Hello',index:0},{text:'there.',index:1}];q.selected=[0,1];}h.start(q);h.run(q.options?"answer('1')":type==='order'?"actions['answer-check']()":"answer('hello')");assert.equal(h.timers.size,1,type+' supports delayed advance');assert.equal(h.el('feedback').details.open,true,type+' opens answered green explanation');h.flush();assert.equal(h.run('session.index'),1,type+' advances at configured time');
}
h=harness('delay',true,1);h.start(match());h.run("matchLeft('1');matchRight('1');matchLeft('2');matchRight('2')");assert.equal(h.timers.size,0);h.run("matchLeft('3');matchRight('3')");assert.equal(h.timers.size,1);h.flush();assert.equal(h.run('session.index'),1,'completed correct match group uses delayed next');
// A previously queued callback must not erase a newer question's timer.
for(const mode of ['fast','delay']){
 h=harness(mode);h.start(choice());h.run("answer('1')");const stale=[...h.timers.values()][0].fn;h.run("actions.next();session.queue.push({w:{id:100,word:'last',zh:'最后'},type:'choice-zh',options:[]});session.queue[1].options=[session.queue[1].w];answer('99')");const active=h.run('practiceAutoTimer'),epoch=h.run('practiceAutoEpoch');stale();assert.equal(h.run('practiceAutoTimer'),active);assert.equal(h.run('practiceAutoEpoch'),epoch);assert.equal(h.timers.size,1,'old callback must leave new countdown intact');h.run("setPracticeMode('slow')");assert.equal(h.timers.size,0,'new timer remains cancellable after old callback fires');
}
console.log('PASS: slow / 0ms fast / 1–30s delayed next, 8 quiz types and matches, one record, 1s/30s boundaries, local mode+delay restore, green answered-only details, deadline countdown, manual/route/render/mode/seconds/storage cancellation, caller guard, held-key safety and input preservation');

// Directional selection is deliberate, per-question, and repeat-safe.
h=harness('slow');h.start(choice());
h.run("actions['answer-option']('2')");assert.equal(h.run('session.answered'),false);assert.equal(h.run('p.words[1]'),undefined);
h.run("actions['answer-option']('1')");assert.equal(h.run('p.words[1]'),undefined,'changing selection does not grade');
h.run("actions['answer-option']('1')");assert.equal(h.run('p.words[1].seen'),1);assert.equal(h.run('p.words[1].wrong'),0);
h=harness('fast');h.start(choice());
const arrow=(key,repeat=false,target={tagName:'BODY',id:''})=>h.events['document:keydown']({key,repeat,target,preventDefault(){}});
arrow('ArrowUp');assert.equal(h.run('p.words[1]'),undefined);
arrow('ArrowUp',true);assert.equal(h.run('p.words[1]'),undefined);
arrow('ArrowUp');assert.equal(h.run('p.words[1].seen'),1);h.flush();
h.run('session.queue[1].options=[session.queue[1].w]');arrow('ArrowUp',true);assert.equal(h.run('p.words[99]'),undefined);
arrow('ArrowUp');assert.equal(h.run('p.words[99]'),undefined);arrow('ArrowUp');assert.equal(h.run('p.words[99].seen'),1);
h=harness('slow');h.start(choice());arrow('ArrowUp',false,{tagName:'INPUT',id:'answer-input',closest(){return true;}});assert.equal(h.run('session.queue[0].directionSelection'),undefined);
console.log('PASS: directional preview, reselect, double confirmation, held keys, next-question isolation and input guard');

const space=(repeat=false)=>h.events['document:keydown']({key:' ',repeat,target:{tagName:'BODY',id:''},preventDefault(){}});
h=harness('slow');h.start(choice());space();assert.equal(h.run('p.words[1]'),undefined);
h.run("actions['answer-option']('1')");space(true);assert.equal(h.run('p.words[1]'),undefined);space();assert.equal(h.run('p.words[1].seen'),1);space(true);assert.equal(h.run('session.index'),0);space();assert.equal(h.run('session.index'),1);
h=harness('slow');h.start(match());h.run("actions['match-left']('1');actions['match-right']('2')");assert.equal(h.run('session.queue[0].errors'),0);space();assert.equal(h.run('session.queue[0].errors'),1);h.run("actions['match-right']('1')");assert.equal(h.run('p.words[1]'),undefined);space();assert.equal(h.run('p.words[1].seen'),1);space();assert.equal(h.run('p.words[1].seen'),1);
for(const id of ['2','3']){h.run(`actions['match-left']('${id}');actions['match-right']('${id}');actions['practice-confirm']()`);}
assert.equal(h.run('session.answered'),true);space();assert.equal(h.run('session.index'),1);
console.log('PASS: space confirms selection and match pair, advances feedback, ignores repeat and missing selection');
