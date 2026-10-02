'use strict';
// Loads the current product files in a Node VM; no browser, fetch, or persisted progress.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const words = JSON.parse(fs.readFileSync(path.join(root,'data/words.json'),'utf8'));
const examples = JSON.parse(fs.readFileSync(path.join(root,'data/examples.json'),'utf8'));
function harness() {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,
    options:[],style:{},dataset:{},addEventListener(){},focus(){},querySelectorAll(){return[];},querySelector(){return null;}});return nodes.get(id);};
  const document={getElementById:node,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  const ctx=vm.createContext({console,document,window:{addEventListener(){},scrollTo(){}},location:{hash:'#map',search:''},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
    URLSearchParams,fetch:()=>{throw Error('Network forbidden in this harness');}});
  for(const name of ['core.js','app.js']) {
    let source=fs.readFileSync(path.join(root,name),'utf8');
    if(name==='app.js') {assert(source.includes('\ninit();'),'init marker changed; revise harness instead of executing init');source=source.replace('\ninit();','\n');}
    vm.runInContext(source,ctx,{filename:name});
  }
  ctx.actualWords=words;ctx.actualExamples=examples;
  // The only replacements are host persistence, not queue generation, scoring or rendering.
  vm.runInContext('words=actualWords;examples=actualExamples;all=new Map(words.map(w=>[String(w.id),w]));p=C.fresh();p.goal=20000;save=()=>{};',ctx);
  const run=s=>vm.runInContext(s,ctx);
  function level(n){ctx.levelNumber=n;run('p.levels[levelNumber-1]=100;p.bosses[levelNumber-1]=100;startLevel(levelNumber);buildQueue();');return run('session.queue');}
  return {run,level,node,ctx};
}
const tests=[];
function test(name,fn){tests.push([name,fn]);}
test('chapter 7 final level has no definition questions even with populated en',()=>{
 const h=harness(),q=h.level(700);assert(q.slice(0,10).every(x=>x.type==='choice-zh'));assert(q.every(x=>x.type!=='definition'));assert.equal(q[0].w.id,6991);
});
test('chapter 8 first level chooses definition only for entries with en',()=>{
 const h=harness(),q=h.level(701);assert.equal(q[0].w.id,7001);
 for(const item of q.slice(0,10)){assert.equal(item.type,item.w.en?'definition':'choice-zh');assert.equal(h.run(`qBase(session.queue[${q.indexOf(item)}]).title`),item.w.en||item.w.word);}
 assert(q.slice(10).every(x=>x.type==='spell'));
});
const expected=[
 {word:'router',id:13222,legacy:'a worker who routes shipments for distribution and delivery',meaning:/\b(network|networks|packet|packets)\b/i},
 {word:'firewall',id:14338,legacy:'(colloquial) the application of maximum thrust',meaning:/\b(network|networks|traffic|access)\b/i},
 {word:'cola',id:14890,legacy:'large genus of African trees bearing kola nuts',meaning:/\b(drink|beverage|soda)\b/i}
];
for(const target of expected){
 test(target.word+' uses the corrected current definition in its actual level',()=>{
  const w=words[target.id-1];assert.equal(w.id,target.id);assert.equal(w.word,target.word);
  assert(w.en&&w.en!==target.legacy&&target.meaning.test(w.en),'Current product en is not the expected corrected sense yet: '+w.en);
  const h=harness(),queue=h.level(Math.ceil(w.id/10)),index=queue.findIndex(q=>q.w.id===w.id&&q.type==='definition');assert(index>=0);
  h.ctx.targetIndex=index;h.run('session.index=targetIndex;renderQuestion();');
  assert.equal(h.run('qBase(session.queue[session.index]).title'),w.en);
  assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.en)')),'Actual renderer did not use the new definition');
  const q=queue[index];assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.id===w.id).length,1);
  assert(q.options.some(o=>o.word===w.word&&o.id===w.id));
 });
 test(target.word+' target option scores correctly through actual answer()',()=>{
  const h=harness(),queue=h.level(Math.ceil(target.id/10));const index=queue.findIndex(q=>q.w.id===target.id&&q.type==='definition');assert(index>=0);
  h.ctx.targetIndex=index;h.run('session.index=targetIndex;renderQuestion();answer(String(session.queue[session.index].w.id));');
  assert.equal(h.run('session.queue[session.index].result'),true);assert.equal(h.run('session.correct'),1);assert.equal(h.run(`p.words[${target.id}].seen`),1);
 });
 test(target.word+' distractor option scores wrong through actual answer()',()=>{
  const h=harness(),queue=h.level(Math.ceil(target.id/10));const index=queue.findIndex(q=>q.w.id===target.id&&q.type==='definition');assert(index>=0);
  h.ctx.targetIndex=index;h.run('session.index=targetIndex;renderQuestion();answer(String(session.queue[session.index].options.find(w=>w.id!==session.queue[session.index].w.id).id));');
  assert.equal(h.run('session.queue[session.index].result'),false);assert.equal(h.run('session.correct'),0);assert.equal(h.run(`p.words[${target.id}].wrong`),1);
 });
}
test('de retains its ID with no mismatched en/phonetic and no Delaware question',()=>{
 const de=words[846];assert.equal(de.id,847);assert.equal(de.word,'de');assert.equal(de.en,'','de en has not been cleared');assert.equal(de.phonetic,'','de phonetic has not been cleared');
 const h=harness(),q=h.level(85);assert(q.every(x=>x.type!=='definition'));assert(q.some(x=>x.w?.id===847));
 for(let index=0;index<q.length;index++)if(q[index].type!=='match'){const base=h.run(`qBase(session.queue[${index}])`);assert(!/Mid-Atlantic|original 13 colonies|Delaware/i.test(base.title));}
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log(`TOTAL ${passed}/${tests.length} passed. Node VM behavior only; no browser geometry or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
