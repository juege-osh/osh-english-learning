'use strict';
// Loads the current product files in a Node VM; no browser, fetch, or persisted progress.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// Optional first argument selects a checkout; the draft lives outside the repository.
const root = path.resolve(process.argv[2] || '/Volumes/Extreme SSD/15_提示词与视频/english-web');
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
  function level(n){ctx.levelNumber=n;run('p=C.fresh();p.goal=20000;p.levels[levelNumber-1]=100;p.bosses[levelNumber-1]=100;startLevel(levelNumber);buildQueue();');return run('session.queue');}
  return {run,level,node,ctx};
}

// Draft for v1.32.2 AFTER data application. Syntax checks do not establish data acceptance.
// The queue, title, renderer, scoring and C.record below are the actual product functions.
const tests=[];
function test(name,fn){tests.push([name,fn]);}
function select(h,index){h.ctx.targetIndex=index;h.run('session.index=targetIndex;renderQuestion();');}
const totals={levels:0,words:0,definitions:0,emptyFallbacks:0,rendered:0,correct:0,wrong:0};
test('chapter 7 final level still uses Chinese choice, despite populated English definitions',()=>{
 const h=harness(),q=h.level(700);assert.equal(q[0].w.id,6991);
 assert(q.slice(0,10).some(x=>x.w.en),'Boundary fixture must have at least one populated en');
 assert(q.slice(0,10).every(x=>x.type==='choice-zh'));
 assert(q.every(x=>x.type!=='definition'));
});
test('chapter 8 starts at level 701 and branches on the actual en field',()=>{
 const h=harness(),q=h.level(701);assert.equal(q[0].w.id,7001);
 for(let i=0;i<10;i++){
  const x=q[i];assert.equal(x.type,x.w.en?'definition':'choice-zh');
  assert.equal(h.run(`qBase(session.queue[${i}]).title`),x.w.en||x.w.word);
 }
 assert(q.slice(10).every(x=>x.type==='spell'));
});
for(let level=881;level<=940;level++){
 test(`actual level ${level}: current titles, target scoring and distractor scoring`,()=>{
  const h=harness();let queue=h.level(level);totals.levels++;
  assert.equal(queue.length,20);assert(queue.slice(10).every(q=>q.type==='spell'));
  for(let index=0;index<10;index++){
   const w=words[(level-1)*10+index];assert.equal(w.id,(level-1)*10+index+1);totals.words++;
   queue=h.level(level);const q=queue[index];assert.equal(q.w.id,w.id);
   assert.equal(q.type,w.en?'definition':'choice-zh');
   assert.equal(h.run(`qBase(session.queue[${index}]).title`),w.en||w.word);
   if(!w.en)totals.emptyFallbacks++;else totals.definitions++;
   select(h,index);totals.rendered++;
   assert.equal(h.run('qBase(session.queue[session.index]).title'),w.en||w.word);
   assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.en||session.queue[session.index].w.word)')));
   assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.id===w.id).length,1);
   assert.equal(new Set(q.options.map(o=>q.type==='choice-zh'?o.zh:o.word)).size,4);
   h.run('answer(String(session.queue[session.index].w.id));');
   assert.equal(h.run('session.queue[session.index].result'),true);
   assert.equal(h.run('session.correct'),1);
   assert.equal(h.run(`p.words[${w.id}].seen`),1);totals.correct++;
   // Fresh progress and a new real queue stop the correct-answer state hiding a scoring error.
   h.level(level);select(h,index);
   h.run('answer(String(session.queue[session.index].options.find(o=>o.id!==session.queue[session.index].w.id).id));');
   assert.equal(h.run('session.queue[session.index].result'),false);
   assert.equal(h.run('session.correct'),0);
   assert.equal(h.run(`p.words[${w.id}].wrong`),1);
   assert.equal(h.run('session.missed.length'),1);totals.wrong++;
  }
 });
}
// Frozen draft expectation: 106 en changes (101 replacements + 5 cleared); 554 definitions + 46 Chinese fallbacks.
// Snapshot the ORIGINAL empty fields separately from editorially CLEARED wrong definitions.
// These IDs are baseline fixtures, not discovered dynamically from the post-apply fields.
const originalEmpty = [[8801, "curfew"], [8834, "volvo"], [8863, "majestic"], [8869, "sicily"], [8874, "carey"], [8955, "reciprocal"], [8958, "inverness"], [8978, "watkins"], [9006, "shortstop"], [9021, "pretest"], [9041, "agm"], [9047, "irvine"], [9049, "honda"], [9055, "backcountry"], [9098, "admiral"], [9111, "joey"], [9117, "engel"], [9118, "headteacher"], [9128, "magnus"], [9142, "garry"], [9157, "rearview"], [9159, "dunlop"], [9179, "plutonium"], [9181, "galway"], [9182, "solidify"], [9200, "undesirable"], [9221, "becky"], [9223, "rsc"], [9251, "unnamed"], [9252, "mitch"], [9264, "motorola"], [9268, "caro"], [9276, "spd"], [9279, "ncr"], [9288, "kirov"], [9289, "lai"], [9296, "boro"], [9298, "pcr"], [9306, "wha"], [9316, "pentium"], [9320, "svq"]];
const newlyCleared = [[9114, "slater"], [9148, "maud"], [9171, "felicity"], [9254, "ana"], [9293, "paige"]];
for(const [kind,items] of [['original empty',originalEmpty],['newly cleared',newlyCleared]]){
 test(kind+' en fields use real Chinese fallback titles and options',()=>{
  for(const [id,word] of items){
   const w=words[id-1];assert.equal(w.id,id);assert.equal(w.word,word);assert.equal(w.en,'',kind+': '+word+' must have empty en');
   const h=harness(),q=h.level(Math.ceil(id/10)),i=q.findIndex(x=>x.w.id===id);assert(i>=0);
   assert.equal(q[i].type,'choice-zh');select(h,i);
   assert.equal(h.run('qBase(session.queue[session.index]).title'),word);
   assert(q[i].options.some(o=>o.id===id&&o.zh===w.zh));
   assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.word)')));
  }
 });
}
// These are independent sense checks, not copies of the proposed replacement strings.
// Every positive group is required; excluded legacy senses must also be absent.
const senses=[
 {id:8890,word:'thee',positive:[/\byou\b/i,/\b(object|objective|accusative)\b/i,/\b(old|archaic|dialect|older)\b/i],negative:/\b(thrive|thriving|prosper|prosperous)\b/i},
 {id:8969,word:'revere',positive:[/\b(respect|admiration|admire|honor|honour)\b/i,/\b(deep|deeply|great|greatly|high|highly)\b/i],negative:/\bPaul\b|silversmith|American Revolution/i},
 {id:9137,word:'teller',positive:[/\bbank\b/i,/\b(employee|worker|clerk|cashier)\b/i,/\b(deposits|withdrawals|transactions|customers|customer)\b/i],negative:/physicist|hydrogen bomb|Edward/i},
 {id:9113,word:'amen',positive:[/so be it|agreement|agree/i,/\b(prayer|prayers)\b/i],negative:/Egyptian|deity|god of|Amun|Amon/i},
 {id:9039,word:'gal',positive:[/\b(girl|woman|female)\b/i,/\b(informal|colloquial)\b/i],negative:/acceleration|centimeter|centimetre|second squared/i},
 {id:9115,word:'genus',positive:[/\b(biological|biology|taxonomic|classification)\b/i,/\bfamily\b/i,/\bspecies\b/i],negative:/general kind of something|philosophy/i},
 {id:9216,word:'byte',positive:[/\b(eight|8)\b/i,/\bbits\b/i,/\b(digital|information|data)\b/i],negative:/enough to represent|one character|single character/i},
 {id:9360,word:'vaccination',positive:[/\bvaccine\b/i,/\b(giving|receiving|administering|administration|use|treatment)\b/i],negative:/\b(scar|scarring)\b/i},
 {id:9398,word:'thorn',positive:[/\b(sharp|pointed)\b/i,/\b(plant|plants|stem|branch|branches)\b/i],negative:/Germanic|runic|rune|alphabet|character/i},
 {id:9348,word:'hanger',positive:[/\b(clothes|clothing|garments)\b/i,/\b(frame|device|object)\b/i,/\b(hanging|hang|holding|hold)\b/i],negative:/\b(worker|workman|person)\b/i},
 {id:9352,word:'repository',positive:[/\b(place|location|storage|store)\b/i,/\b(stored|kept|held|collected)\b/i,/\b(information|things|code|data|materials)\b/i],negative:/person to whom|secret is entrusted|confidant/i},
 {id:9308,word:'booze',positive:[/\b(alcoholic|alcohol)\b/i,/\b(drink|drinks|beverages|beverage|liquor)\b/i,/\b(informal|colloquial)\b/i],negative:/rather than fermented|distilled rather|only.*distilled|distilled.*only/i}
];
for(const s of senses){test(s.word+' has the corrected sense, used by its actual definition question',()=>{
 const w=words[s.id-1];assert.equal(w.id,s.id);assert.equal(w.word,s.word);assert(w.en,'Expected a usable corrected en');
 for(const pattern of s.positive)assert(pattern.test(w.en),`${s.word}: missing semantic feature ${pattern}: ${w.en}`);
 assert(!s.negative.test(w.en),`${s.word}: legacy wrong sense remains: ${w.en}`);
 const h=harness(),q=h.level(Math.ceil(s.id/10)),index=q.findIndex(x=>x.w.id===s.id&&x.type==='definition');assert(index>=0);
 select(h,index);assert.equal(h.run('qBase(session.queue[session.index]).title'),w.en);
});}
test('complete range coverage and real scoring counts agree',()=>{
 assert.equal(totals.levels,60);assert.equal(totals.words,600);
 const actual=words.slice(8800,9400).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,41);assert.equal(newlyCleared.length,5);
 assert.equal(actual,554);assert.equal(totals.emptyFallbacks,46);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
