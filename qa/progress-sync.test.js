const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../core.js');
const context={C,console,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../progress-sync.js'),'utf8'),context);
const local=C.fresh(),cloud=C.fresh();
local.levels[1]=90;local.words[1]={first:100,last:100,failed:0,days:['2026-09-28'],production:false,due:86400100,wrong:0,seen:1};
cloud.levels[1]=100;cloud.levels[2]=80;cloud.words[1]={first:90,last:100,failed:200,days:[],production:false,due:600200,wrong:1,seen:2};
const merged=context.progressMerge(local,cloud);
assert.equal(merged.levels[1],100);
assert.equal(merged.levels[2],80);
assert.equal(merged.words[1].failed,200);
assert.deepEqual(Array.from(merged.words[1].days),[]);
assert.equal(merged.words[1].wrong,1);
assert.equal(merged.words[1].first,90);
assert.ok(C.validate(merged));
console.log('PASS: cloud progress keeps best levels and latest failure without losing wrong-word history');

const specialist=C.fresh(),olderCloud=C.fresh();
specialist.industries.programmer={seen:[1,2],skipped:{'3':100},skipResetAt:0};
const specialistMerged=context.progressMerge(specialist,olderCloud);
assert.deepEqual(Array.from(specialistMerged.industries.programmer.seen),[1,2]);
assert.equal(specialistMerged.industries.programmer.skipped['3'],100);
const resetCloud=C.fresh();
resetCloud.industries.programmer={seen:[4],skipped:{},skipResetAt:101};
const resetMerged=context.progressMerge(specialist,resetCloud);
assert.deepEqual(Array.from(resetMerged.industries.programmer.seen).sort(),[1,2,4]);
assert.equal(resetMerged.industries.programmer.skipped['3'],undefined);
console.log('PASS: industry-only study syncs and a later skip reset wins');

(async()=>{
 let finishRequest,loggedOut=false;
 context.p=C.fresh();context.KEY='progress';context.localStorage={setItem(){}};
 context.fetch=()=>new Promise(resolve=>{finishRequest=resolve;});
 context.toast=()=>{};context.header=()=>{};context.route=()=>{};context.session=null;
 vm.runInContext('cloudEnabled=true;cloudDirty=true;cloudRevision=0',context);
 const saving=context.progressFlush();
 const logout=context.progressBeforeLogout().then(ok=>{loggedOut=true;return ok;});
 await Promise.resolve();
 assert.equal(loggedOut,false,'logout must wait for an in-flight save');
 finishRequest({ok:true,status:200,json:async()=>({revision:1})});
 assert.equal(await saving,true);
 assert.equal(await logout,true);
 console.log('PASS: logout waits for an in-flight cloud save');
})().catch(error=>{console.error(error);process.exitCode=1;});
// A later correction on another device clears an older specialist mistake.
const early=C.fresh(),late=C.fresh();early.industries={programmer:{seen:[1],answers:{'1':{correct:false,at:100}}}};late.industries={programmer:{seen:[1],answers:{'1':{correct:true,at:200}}}};
assert.equal(context.progressMerge(early,late).industries.programmer.answers['1'].correct,true);
assert.equal(context.progressMerge(late,early).industries.programmer.answers['1'].correct,true);
late.industries.programmer.answers['1']={correct:true,at:100};
assert.equal(context.progressMerge(late,early).industries.programmer.answers['1'].correct,false);
console.log('PASS: specialist review merges the latest answer and keeps failures on equal timestamps');

const bioLocal=C.fresh(),bioCloud=C.fresh();bioLocal.industries={biology:{seen:[20001],answers:{'20001':{correct:false,at:100}}}};bioCloud.industries={biology:{seen:[20002],answers:{'20001':{correct:true,at:200}}}};
const bioMerge=context.progressMerge(bioLocal,bioCloud);assert.deepEqual(Array.from(bioMerge.industries.biology.seen).sort(),[20001,20002]);assert.equal(bioMerge.industries.biology.answers['20001'].correct,true);assert(C.validate(bioMerge));assert.equal(C.stats(bioMerge).learned,0);
console.log('PASS: supplemental specialist IDs merge across devices and never increase main-route progress');
// Short-course study must survive empty main progress and merge complementary checks.
const soundsOnly=C.fresh(),basicCloud=C.fresh();C.recordBasic(soundsOnly,'phonics','p01',0,true,100);C.recordBasic(basicCloud,'phonics','p01',1,true,200);C.recordBasic(basicCloud,'grammar','be',0,true,300);
const basicMerge=context.progressMerge(soundsOnly,basicCloud);assert.deepEqual(Array.from(basicMerge.basics.phonics.p01.slots),[0,1]);assert.deepEqual(Array.from(basicMerge.basics.grammar.be.slots),[0]);assert.equal(C.stats(basicMerge).learned,0);assert(C.validate(basicMerge));assert.equal(context.progressMerge(soundsOnly,C.fresh()).basics.phonics.p01.slots.length,1);
console.log('PASS: sound-only and grammar-only progress survives an empty account and merges the two required checks across devices');
// Simulate two tabs: a storage event must merge instead of discarding local checks.
const appSource=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');const storageBody=appSource.split("window.addEventListener('storage',")[1].split('\n')[0].slice(0,-2);
const tabOwn=C.fresh(),tabOther=C.fresh();C.recordBasic(tabOwn,'grammar','be',0,true,100);C.recordBasic(tabOther,'grammar','be',1,true,200);
const tabs={C,p:tabOwn,KEY:'progress',session:null,progressMerge:context.progressMerge,localStorage:{setItem(key,value){tabs.written=JSON.parse(value);}},progressSchedule(){},header(){},route(){},storageOK:true};vm.createContext(tabs);vm.runInContext('onStorage='+storageBody,tabs);tabs.onStorage({key:'progress',newValue:JSON.stringify(tabOther)});assert.deepEqual(Array.from(tabs.p.basics.grammar.be.slots),[0,1]);assert.deepEqual(tabs.written.basics.grammar.be.slots,[0,1]);
console.log('PASS: two open tabs preserve complementary grammar checks through actual storage-event handler');

// Reproduce a slow account read with the real specialty/challenge renderers:
// the learner starts answering before the cloud response arrives. Checking only
// session=null misses all of these views.
(async()=>{
 const appText=fs.readFileSync(require.resolve('../app.js'),'utf8').replace('\ninit();','\n');
 const featureText=fs.readFileSync(require.resolve('../features-ui.js'),'utf8');
 const syncText=fs.readFileSync(require.resolve('../progress-sync.js'),'utf8');
 const inputWords=require('../data/words.json'),inputIndustries=require('../data/industries.json'),inputExtras=require('../data/industry_words.json');
 function harness(conflict=false){
  const els=new Map(),drafts=[],writes=[],posts=[];let release,postCount=0,headers=0,routes=0;
  function el(id){if(!els.has(id))els.set(id,{innerHTML:'',textContent:'',value:'',defaultValue:'',tagName:'DIV',style:{},selectedOptions:[],classList:{add(){},toggle(){}},addEventListener(){}});return els.get(id);}
  const surface=el('app');surface.querySelector=()=>/class="[^"]*\b(question-workspace|question-card|race-question)\b/.test(surface.innerHTML)?{}:null;surface.querySelectorAll=()=>drafts;surface.contains=x=>drafts.includes(x);
  const doc={getElementById:el,activeElement:null,addEventListener(){},querySelectorAll(){return [];}};
  const ctx=vm.createContext({EnglishCore:C,inputWords,inputIndustries,inputExtras,console,Map,Set,Date,JSON,Math,Promise,URLSearchParams,document:doc,window:{addEventListener(){},scrollTo(){}},location:{hash:'#industries',search:''},localStorage:{setItem(k,v){writes.push(JSON.parse(v));},getItem(){return null;}},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
   fetch:async(url,options)=>{if(url==='/api/account')return {ok:true,json:async()=>({registered:true})};if(url==='/api/progress'&&options?.method==='POST'){posts.push(JSON.parse(options.body));postCount++;return conflict&&postCount===1?{status:409}:{ok:true,status:200,json:async()=>({revision:8})};}if(url==='/api/progress')return new Promise(resolve=>{release=data=>resolve({ok:true,json:async()=>data});});throw Error('unexpected request '+url);}});
  vm.runInContext(appText,ctx);vm.runInContext(featureText,ctx);vm.runInContext(syncText,ctx);
  Object.assign(ctx,{onHeader:()=>headers++,onRoute:()=>{routes++;surface.innerHTML='idle view refreshed';},onSave:()=>writes.push(JSON.parse(vm.runInContext('JSON.stringify(p)',ctx)))});
  vm.runInContext("words=inputWords;industries=inputIndustries;all=new Map([...words,...inputExtras].map(w=>[String(w.id),w]));loaded=true;header=onHeader;route=onRoute;save=onSave;toast=()=>{};confetti=()=>{};",ctx);
  return {ctx,doc,el,surface,drafts,writes,posts,release:data=>{assert(release,'cloud read must be in flight');release(data);},ready:()=>!!release,headers:()=>headers,routes:()=>routes};
 }
 const questions=Array.from({length:20},(_,i)=>({id:i+1,word:'word'+i,options:[{id:i+1,zh:'正确'},{id:100+i,zh:'其他'}]}));
 async function check(mode,view){
  const h=harness(mode==='conflict'),run=code=>vm.runInContext(code,h.ctx);h.ctx.questions=questions;
  const operation=mode==='conflict'?(run('cloudEnabled=true;cloudDirty=true'),run('progressFlush()')):run('progressStart()');
  for(let n=0;n<12&&!h.ready();n++)await Promise.resolve();assert(h.ready(),'deferred cloud read began');
  let expectedRoutes=0;
  if(view==='industry'){run("industryPracticeStart('sentences');industryPracticeAnswer(industryPractice.items[0].id)");}
  else if(view==='industry-board'){run("industryChallenge={sector:'programmer',name:'程序员',questions,position:3,answers:[1,2,3]};renderIndustryChallenge()");}
  else if(view==='main-board'){run('dailyQuestions=questions;dailyPosition=4;dailyAnswers=[1,2,3,4];renderDailyQuestion()');}
  else if(view==='submit'){run('dailyQuestions=questions;dailyPosition=20;dailyAnswers=questions.map(q=>q.id);renderDailyQuestion()');}
  else if(view==='race'){h.surface.innerHTML='<section class="panel exercise-card race-question">current live question</section>';}
  else if(view==='focus'||view==='draft'||view==='textarea'||view==='contenteditable'){
   h.surface.innerHTML='vocabulary search and results';const field={tagName:view==='textarea'?'TEXTAREA':'INPUT',type:'search',value:'gene',defaultValue:'',isContentEditable:view==='contenteditable',textContent:view==='contenteditable'?'unfinished message':''};h.drafts.push(field);if(view==='focus'){field.value='';h.doc.activeElement=field;}
  }else if(view==='idle'){h.surface.innerHTML='empty idle page';run("industryPractice={index:0,items:[{}]};industryChallenge={position:0,questions};dailyQuestions=questions");expectedRoutes=1;}
  else if(view==='unchanged-field'){h.surface.innerHTML='idle form';h.drafts.push({tagName:'INPUT',type:'text',value:'saved name',defaultValue:'saved name'});expectedRoutes=1;}
  else if(view==='unchanged-select'||view==='draft-select'){h.surface.innerHTML='idle form with selection';h.drafts.push({tagName:'SELECT',options:[{selected:view==='unchanged-select',defaultSelected:false},{selected:view==='draft-select',defaultSelected:false}]});if(view==='unchanged-select')expectedRoutes=1;}
  const html=h.surface.innerHTML,feedback=h.el('industry-feedback').innerHTML,industryIndex=run('industryPractice?.index'),industryAnswered=run('industryPractice?.answered');
  const remote=C.fresh();remote.levels[2]=100;h.release({revision:7,progress:remote});await operation;
  assert.equal(h.routes(),expectedRoutes,mode+'/'+view+' must preserve busy view and refresh idle view');
  assert(h.headers()>0,'header must update even while answer view is protected');assert.equal(run('p.levels[2]'),100,'remote progress must merge');assert(h.writes.some(p=>p.levels[2]===100),'merge must be saved locally');
  if(!expectedRoutes){assert.equal(h.surface.innerHTML,html,'question or draft markup must survive');assert.equal(h.el('industry-feedback').innerHTML,feedback,'current answer explanation must survive');assert.equal(run('industryPractice?.index'),industryIndex);assert.equal(run('industryPractice?.answered'),industryAnswered);}
  if(view==='industry'){assert.equal(run('Object.values(p.industries.programmer.answers)[0].correct'),true,'answer entered during cloud read survives merge');}
  if(mode==='conflict'){assert.equal(run('cloudDirty'),true,'conflict schedules resave');assert.equal(await run('progressFlush()'),true,'merged progress resaves successfully');}
  if(h.posts.length)assert(h.posts.some(post=>post.progress.levels[2]===100),mode+'/'+view+' merged progress must reach account save');else assert.equal(run('JSON.stringify(p)'),JSON.stringify(remote),'unchanged account progress needs no duplicate save');
 }
 for(const mode of ['start','conflict'])for(const view of ['industry','industry-board','main-board','submit','race','focus','draft','textarea','contenteditable','idle','unchanged-field','unchanged-select','draft-select'])await check(mode,view);
 console.log('PASS: 26 deferred initial/conflict cloud merges preserve real specialty and leaderboard questions, live play, focused and blurred drafts; headers/local/account saves update and idle views refresh');
 const storage=harness(),runStorage=code=>vm.runInContext(code,storage.ctx);
 runStorage("industryPracticeStart('sentences');industryPracticeAnswer(industryPractice.items[0].id)");
 const storageHTML=storage.surface.innerHTML,storageFeedback=storage.el('industry-feedback').innerHTML;
 const actualStorageHandler=appText.split("window.addEventListener('storage',")[1].split('\n')[0].slice(0,-2);
 runStorage('onStorage='+actualStorageHandler);
 const otherTab=C.fresh();otherTab.levels[2]=100;
 storage.ctx.onStorage({key:'english-quest-progress-v1',newValue:JSON.stringify(otherTab)});
 assert.equal(storage.routes(),0,'real storage handler must not reset specialty answer view');
 assert.equal(storage.surface.innerHTML,storageHTML);assert.equal(storage.el('industry-feedback').innerHTML,storageFeedback);
 assert.equal(runStorage('industryPractice.answered'),true);assert.equal(runStorage('p.levels[2]'),100);
 assert.equal(runStorage('Object.values(p.industries.programmer.answers)[0].correct'),true);
 assert(storage.writes.some(p=>p.levels[2]===100&&p.industries.programmer),'cross-tab merged answer and remote progress must persist');
 assert(storage.headers()>0,'storage merge must update header while preserving question');
 storage.surface.innerHTML='returned to idle route list';otherTab.levels[3]=100;
 storage.ctx.onStorage({key:'english-quest-progress-v1',newValue:JSON.stringify(otherTab)});
 assert.equal(storage.routes(),1,'storage handler must refresh idle view despite stale specialty session');assert.equal(runStorage('p.levels[3]'),100);
 console.log('PASS: actual cross-tab storage handler preserves a live specialty answer and refreshes an idle page; unloaded-helper fallback remains covered');

})().catch(error=>{console.error(error);process.exitCode=1;});
