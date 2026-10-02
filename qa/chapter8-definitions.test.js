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

// Draft for v1.31.9 AFTER data application. Syntax checks do not establish data acceptance.
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
for(let level=701;level<=760;level++){
 test(`actual level ${level}: current titles, target scoring and distractor scoring`,()=>{
  const h=harness();let queue=h.level(level);totals.levels++;
  assert.equal(queue.length,20);assert(queue.slice(10).every(q=>q.type==='spell'));
  for(let index=0;index<10;index++){
   const w=words[(level-1)*10+index];assert.equal(w.id,(level-1)*10+index+1);totals.words++;
   queue=h.level(level);const q=queue[index];assert.equal(q.w.id,w.id);
   assert.equal(q.type,w.en?'definition':'choice-zh');
   assert.equal(h.run(`qBase(session.queue[${index}]).title`),w.en||w.word);
   if(!w.en){totals.emptyFallbacks++;continue;}
   totals.definitions++;select(h,index);totals.rendered++;
   assert.equal(h.run('qBase(session.queue[session.index]).title'),w.en);
   assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.en)')));
   assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.id===w.id).length,1);
   assert.equal(new Set(q.options.map(o=>o.word)).size,4);
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
for(const [id,word] of [[7007,'kemp'],[7029,'benny'],[7072,'kylie']]){
 test(word+' corrected empty en falls back to the real Chinese question',()=>{
  const w=words[id-1];assert.equal(w.id,id);assert.equal(w.word,word);assert.equal(w.en,'','v1.31.9 data has not cleared this mismatched en');
  const h=harness(),q=h.level(Math.ceil(id/10)),i=q.findIndex(x=>x.w.id===id);assert(i>=0);
  assert.equal(q[i].type,'choice-zh');select(h,i);
  assert.equal(h.run('qBase(session.queue[session.index]).title'),word);
  const opts=q[i].options;assert(opts.some(o=>o.id===id&&o.zh===w.zh));
  assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.word)')));
 });
}
// These are independent sense checks, not copies of the proposed replacement strings.
// Every positive group is required; excluded legacy senses must also be absent.
const senses=[
 {id:7002,word:'mortar',positive:[/\b(brick|bricks|masonry)\b/i,/\b(bowl|vessel|container)\b/i,/\b(crush|crushed|crushing|grind|ground|grinding)\b/i],negative:/\b(muzzle|shells|artillery|gun)\b/i},
 {id:7027,word:'thwart',positive:[/\b(prevent|stop|block|frustrate|defeat)\b/i,/\b(plan|plans|attempt|attempts|success|succeed|succeeding)\b/i],negative:/\b(crosspiece|gunnels|rowboat)\b/i},
 {id:7012,word:'weekday',positive:[/\bMonday\b/i,/\bFriday\b/i],negative:/sometimes except Saturday/i},
 {id:7164,word:'parasite',positive:[/\b(host|another organism|another animal|another living)\b/i,/\b(food|nourishment|nutrients|feeds|feeding)\b/i],negative:/without (?:benefiting or )?killing|never kill|does not kill|cannot kill/i},
 {id:7268,word:'coax',positive:[/\b(persuade|persuading|persuasion|encourage|encouraging)\b/i,/\b(gentle|gently|patient|patiently|kind|kindly|persistent|persistence|patience|pleasant|softly|reassuring)\b/i],negative:/transmission line|high.frequency signals|coaxial cable/i},
 {id:7450,word:'lest',positive:[/\b(avoid|prevent|fear|afraid|case|undesirable|unwanted)\b/i],negative:/ten more than forty|\bfifty\b/i},
 {id:7416,word:'mole',positive:[/\b(burrow|burrows|burrowing|underground)\b/i,/\b(skin|spot|mark)\b/i,/\b(spy|secret|agent|insider)\b/i,/\b(chemistry|chemical|substance|amount|particles|molecules|unit)\b/i],negative:/spicy sauce|chocolate sauce/i},
 {id:7507,word:'zip',positive:[/\b(fastener|fastening|zipper|teeth|clothes|clothing)\b/i],negative:/quantity of no importance/i},
 {id:7579,word:'blockbuster',positive:[/\b(success|successful|popular|hit)\b/i,/\b(film|movie|book|work|entertainment)\b/i],negative:/\b(bomb|demolish|explosive)\b/i},
 {id:7600,word:'puddle',positive:[/\b(water|liquid|rain|rainwater)\b/i,/\b(small|shallow)\b/i],negative:/clay and sand|impervious to water|line a pond/i}
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
 const actual=words.slice(7000,7600).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,actual);assert.equal(totals.correct,actual);assert.equal(totals.wrong,actual);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
