'use strict';
// Loads the current product files in a Node VM; no browser, fetch, or persisted progress.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
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

// Draft for v1.32.5 AFTER data application. Syntax checks do not establish data acceptance.
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
for(let level=1061;level<=1120;level++){
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
// Snapshot the ORIGINAL empty fields separately from editorially CLEARED wrong definitions.
// These IDs are baseline fixtures, not discovered dynamically from the post-apply fields.
const originalEmpty = [[10609, "kerry"], [10618, "fluctuate"], [10620, "pimp"], [10645, "franz"], [10695, "arsenic"], [10711, "meyer"], [10739, "cork"], [10762, "porsche"], [10770, "ale"], [10806, "inescapable"], [10815, "midlife"], [10835, "postsecondary"], [10847, "approx"], [10872, "reindeer"], [10879, "sae"], [10883, "atkins"], [10890, "postcolonial"], [10892, "pulitzer"], [10912, "caribou"], [10915, "peugeot"], [10929, "dept"], [10948, "quebec"], [10963, "miniseries"], [10973, "disoriented"], [10979, "mmm"], [10987, "skye"], [10995, "standout"], [10999, "kyle"], [11006, "quail"], [11008, "daly"], [11013, "nonpartisan"], [11038, "eel"], [11043, "micky"], [11047, "hoax"], [11056, "skirmish"], [11058, "marianne"], [11065, "ecu"], [11081, "zoe"], [11096, "theo"], [11097, "muck"], [11113, "nah"], [11114, "dora"], [11138, "scuba"], [11167, "barney"], [11177, "waffle"], [11194, "cashmere"]];
// Read the editorially frozen patch, never infer clearing fixtures from mutated product data.
const patchPath = path.resolve(process.argv[3] || path.join(root,'qa/reviewed_definitions_10601_11200.json'));
const patch = JSON.parse(fs.readFileSync(patchPath,'utf8'));
assert.equal(patch.status,'frozen');
assert.deepEqual(patch.range,[10601,11200]);
assert(Array.isArray(patch.changes),'Missing frozen patch changes');
const newlyCleared = patch.changes.filter(c=>c.after==='').map(c=>[c.id,c.word]);
const expectedDefinitions = 600-originalEmpty.length-newlyCleared.length;
const baselineExamplesSHA = '5ad92ffb69ee42b5471bc2de0ee2573f81a2995dcb8e024ea835e1568466474c';
test('all existing bilingual examples retain complete baseline bytes',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/examples.json'))).digest('hex'),baselineExamplesSHA);
});
test('frozen editorial patch agrees with actual en fields and independent original-empty fixtures',()=>{
 const seen=new Set(),oldEmpty=new Set(originalEmpty.map(x=>x[0]));
 for(const c of patch.changes){
  assert(c.id>=10601&&c.id<=11200);assert(!seen.has(c.id));seen.add(c.id);
  assert(!oldEmpty.has(c.id),'Original empty fields must not be filled');
  assert(c.before&&c.before!==c.after);assert.equal(words[c.id-1].word,c.word);assert.equal(words[c.id-1].en,c.after);
 }
 assert.equal(patch.changed_words,patch.changes.length);
 assert.equal(patch.cleared_mismatched_definitions,newlyCleared.length);
 assert.equal(patch.replaced_definitions,patch.changes.length-newlyCleared.length);
 assert.equal(patch.existing_empty_en_preserved,46);
});
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
 {id:10601,word:'substantiate',positive:[/prove|support/i,/evidence/i],negative:/solidify/i},
 {id:10626,word:'overcoat',positive:[/coat/i,/clothes|clothing/i],negative:/paint|varnish/i},
 {id:10676,word:'boyle',positive:[/scientist/i,/pressure/i,/volume/i],negative:/United States writer|1902/i},
 {id:10708,word:'backbencher',positive:[/parliament/i,/minister/i,/opposition/i],negative:/not a party leader$/i},
 {id:10723,word:'nissan',positive:[/Japanese|Japan/i,/company|brand/i,/vehicle|car/i],negative:/seventh month|ecclesiastic/i},
 {id:10766,word:'lander',positive:[/spacecraft/i,/surface/i],negative:/Wyoming|town/i},
 {id:10778,word:'gale',positive:[/strong/i,/wind/i],negative:/45.90|7 to 10/i},
 {id:10783,word:'venom',positive:[/toxic|poison/i,/bite|sting/i],negative:/insects.*spiders|insects.*scorpions/i},
 {id:10809,word:'nonverbal',positive:[/words|speech/i,/not|without/i],negative:/lacking verbal skill/i},
 {id:10843,word:'scallions',positive:[/onion/i,/green/i],negative:/ampeloprasum|flat overlapping/i},
 {id:10851,word:'vagina',positive:[/canal/i,/cervix/i,/outside/i],negative:/labia minora to the uterus/i},
 {id:10856,word:'reuse',positive:[/use/i,/again/i],negative:/after processing/i},
 {id:10994,word:'nationalisation',positive:[/government|state/i,/ownership/i],negative:/becoming a nation/i},
 {id:11005,word:'fertilization',positive:[/fusion|union/i,/gametes/i],negative:/pollen and ovule/i},
 {id:11030,word:'migraine',positive:[/recurring/i,/headache/i],negative:/vascular headache/i},
 {id:11032,word:'observational',positive:[/watch|notic|observ/i],negative:/or experiment/i},
 {id:11158,word:'tortoise',positive:[/land/i,/turtle/i],negative:/worldwide in arid/i},
 {id:11164,word:'piston',positive:[/cylinder/i,/engine|machine/i],negative:/composer|1894/i}
];
for(const s of senses){test(s.word+' has a checked basic sense, used by its actual definition question',()=>{
 const w=words[s.id-1];assert.equal(w.id,s.id);assert.equal(w.word,s.word);assert(w.en,'Expected a usable corrected en');
 for(const pattern of s.positive)assert(pattern.test(w.en),`${s.word}: missing semantic feature ${pattern}: ${w.en}`);
 assert(!s.negative.test(w.en),`${s.word}: legacy wrong sense remains: ${w.en}`);
 const h=harness(),q=h.level(Math.ceil(s.id/10)),index=q.findIndex(x=>x.w.id===s.id&&x.type==='definition');assert(index>=0);
 select(h,index);assert.equal(h.run('qBase(session.queue[session.index]).title'),w.en);
});}
test('complete range coverage and real scoring counts agree',()=>{
 assert.equal(totals.levels,60);assert.equal(totals.words,600);
 const actual=words.slice(10600,11200).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,46);assert.equal(newlyCleared.length,patch.cleared_mismatched_definitions);
 assert.equal(actual,expectedDefinitions);
 assert.equal(totals.emptyFallbacks,46+newlyCleared.length);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
