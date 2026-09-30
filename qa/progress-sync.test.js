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
