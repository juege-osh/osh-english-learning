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

// Draft for v1.32.1 AFTER data application. Syntax checks do not establish data acceptance.
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
for(let level=821;level<=880;level++){
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
const originalEmpty = [[8226, "postseason"], [8258, "mahogany"], [8265, "quarry"], [8300, "para"], [8308, "geometric"], [8349, "condominium"], [8357, "anyhow"], [8376, "worldview"], [8391, "coexist"], [8403, "rehab"], [8416, "midtown"], [8425, "yeast"], [8446, "mobilization"], [8447, "psychosocial"], [8508, "biker"], [8537, "fir"], [8581, "euro"], [8588, "unresolved"], [8636, "bailout"], [8649, "mony"], [8657, "nongovernmental"], [8671, "tapestry"], [8707, "casserole"], [8732, "mackenzie"], [8741, "hardy"], [8742, "wakefield"], [8784, "stat"], [8792, "zinc"]];
const newlyCleared = [[8534, "fowler"], [8609, "burke"], [8654, "teresa"], [8692, "covent"]];
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
 {id:8235,word:'voltage',positive:[/\b(potential|potential energy)\b/i,/\b(difference|difference between)\b/i,/\b(volts|volt)\b/i],negative:/rate at which energy|energy.*per (?:unit )?time/i},
 {id:8231,word:'receptor',positive:[/\b(molecule|protein|molecules|proteins)\b/i,/\b(cell|cells|cellular)\b/i,/\b(binds|bind|binding|receives|responds|response)\b/i],negative:/postulated to exist|acts on nervous tissue/i},
 {id:8208,word:'storyteller',positive:[/\b(story|stories|tales)\b/i,/\b(tells|tell|telling|narrates|narrating)\b/i],negative:/\b(lies|liar|untruths)\b/i},
 {id:8369,word:'stale',positive:[/no longer fresh|not fresh|lost.*freshness/i],negative:/urinate|cattle and horses/i},
 {id:8443,word:'stakeholder',positive:[/\b(person|people|organization|organisations|group|groups)\b/i,/\b(interest|interested|affected|involved)\b/i,/\b(activity|activities|decision|decisions|project|projects|business|businesses)\b/i],negative:/betting against|deliver the stakes|stakes to the winner/i},
 {id:8560,word:'braille',positive:[/\b(dots|dot)\b/i,/\b(raised|touch|tactile)\b/i,/\b(system|writing|reading|read)\b/i],negative:/French educator|1809.1852|lost his sight/i},
 {id:8535,word:'neutron',positive:[/\b(particle|particles)\b/i,/electrically neutral|no (?:electric )?charge|zero (?:electric )?charge|0 charge|charge of zero/i,/atomic nuclei|atomic nucleus|nucleus of an atom|nuclei of atoms/i],negative:/positive (?:electric )?charge|negative (?:electric )?charge/i},
 {id:8565,word:'osteoporosis',positive:[/\b(bone|bones)\b/i,/\b(density|strength|weaken|weakened|weakens|fragile|fragility)\b/i,/\b(break|fracture|fractures|breaking)\b/i],negative:/attributable to a lack of calcium|caused (?:only|solely) by.*calcium/i},
 {id:8638,word:'hacker',positive:[/\b(computer|computers|computing)\b/i,/\b(skilled|skills|access|systems|security|networks|expert)\b/i],negative:/golf|golfer/i},
 {id:8708,word:'audible',positive:[/able to be heard|can be heard|possible to hear|loud enough to (?:be heard|hear)/i],negative:/football|scrimmage/i},
 {id:8670,word:'soho',positive:[/\bLondon\b/i,/\b(district|area|neighbourhood|neighborhood)\b/i],negative:/Manhattan|New York/i},
 {id:8697,word:'kingston',positive:[/\bJamaica\b/i,/\bcapital\b/i],negative:/Hudson River|in New York/i}
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
 const actual=words.slice(8200,8800).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,28);assert.equal(newlyCleared.length,4);
 assert.equal(actual,568);assert.equal(totals.emptyFallbacks,32);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
