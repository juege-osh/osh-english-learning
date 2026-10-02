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

// Draft for v1.32.3 AFTER data application. Syntax checks do not establish data acceptance.
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
for(let level=941;level<=1000;level++){
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
const originalEmpty = [[9418, "binary"], [9467, "cypress"], [9478, "jig"], [9553, "anglo"], [9570, "oats"], [9589, "aw"], [9638, "yarn"], [9648, "barley"], [9671, "birch"], [9704, "totalitarian"], [9738, "squid"], [9850, "paddington"], [9851, "beaver"], [9865, "nitrate"], [9887, "elastic"], [9912, "adrenalin"], [9915, "situational"], [9934, "nutmeg"], [9941, "tether"], [9976, "opium"], [9978, "otter"], [9980, "wither"], [9992, "tar"]];
// Read the editorially frozen patch, never infer clearing fixtures from mutated product data.
const patchPath = path.resolve(process.argv[3] || path.join(root,'qa/reviewed_definitions_9401_10000.json'));
const patch = JSON.parse(fs.readFileSync(patchPath,'utf8'));
assert.equal(patch.status,'frozen');
assert.deepEqual(patch.range,[9401,10000]);
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
  assert(c.id>=9401&&c.id<=10000);assert(!seen.has(c.id));seen.add(c.id);
  assert(!oldEmpty.has(c.id),'Original empty fields must not be filled');
  assert(c.before&&c.before!==c.after);assert.equal(words[c.id-1].word,c.word);assert.equal(words[c.id-1].en,c.after);
 }
 assert.equal(patch.changed_words,patch.changes.length);
 assert.equal(patch.cleared_mismatched_definitions,newlyCleared.length);
 assert.equal(patch.replaced_definitions,patch.changes.length-newlyCleared.length);
 assert.equal(patch.existing_empty_en_preserved,23);
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
 {id:9727,word:'plop',positive:[/\b(short|brief)\b/i,/\b(sound|noise)\b/i,/\b(liquid|water)\b/i,/\b(drops|drop|dropping|falls|fall|falling|put|puts|putting)\b/i],negative:/without a splash|round(?:ed)? object/i},
 {id:9533,word:'neutrino',positive:[/\b(particle|particles)\b/i,/electrically neutral|no (?:electric )?charge|zero (?:electric )?charge/i,/(?:small|tiny|nonzero|non-zero|finite|slight).*mass|mass.*(?:small|tiny|nonzero|non-zero)/i],negative:/zero mass|massless|no mass/i},
 {id:9541,word:'chancellor',positive:[/head of (?:the )?government|government head|prime minister/i,/\b(Germany|Austria|German|Austrian)\b/i],negative:/head of state/i},
 {id:9627,word:'drone',positive:[/\b(aircraft|aerial|flying|airplane|plane)\b/i,/\b(unmanned|uncrewed|pilotless|remote|remotely)\b|without (?:an? )?(?:onboard |human )?pilot/i],negative:/sole function is to mate|stingless male bee/i},
 {id:9629,word:'sitter',positive:[/\b(person|someone|people)\b/i,/\b(child|children|babies|baby|portrait|portraits|artist|model)\b/i],negative:/Dutch|astronomer|size of the universe|1872.1934/i},
 {id:9700,word:'sushi',positive:[/\brice\b/i,/\b(vinegar|vinegared|seasoned|seasoning)\b/i,/\b(vegetable|vegetables|ingredients|seafood|fish)\b/i],negative:/rice \(with raw fish\) wrapped|(?:always|only|must|requires).*raw fish|raw fish.*(?:required|essential|necessary)/i},
 {id:9802,word:'staunch',positive:[/\b(loyal|loyalty|committed|support|supporting|supporter|steadfast|firm)\b/i],negative:/stop the flow|liquid|blood|bleeding/i},
 {id:9810,word:'medic',positive:[/\b(person|someone|worker|professional)\b/i,/\b(medical|healthcare|health care|medicine)\b/i,/\b(care|treatment|treat|treating|trained)\b/i],negative:/Medicago|herbs|trifoliate|flowers/i},
 {id:9862,word:'notification',positive:[/\b(message|notice|alert|announcement)\b/i,/\b(informs|inform|information|notifies|notify|tell|tells)\b/i],negative:/request for payment/i},
 {id:9881,word:'midwife',positive:[/\b(person|someone|professional|practitioner)\b/i,/\b(childbirth|birth|labor|labour)\b/i,/\b(assists|assist|helps|help|care|trained|qualified)\b/i],negative:/^(?:a|an) woman\b|\bfemale (?:person|professional|practitioner|worker)\b/i},
 {id:9918,word:'wasp',positive:[/\binsect\b/i,/\b(sting|stings|stinging)\b/i],negative:/Anglo.Saxon|Protestant|white person|\bancestry\b/i},
 {id:9945,word:'verbally',positive:[/\b(spoken|speaking|speech|oral|orally)\b/i,/\b(word|words)\b/i],negative:/as a verb|verb form/i},
 {id:10000,word:'fluent',positive:[/\b(language|languages|speak|speaking|speech)\b/i,/\b(easily|ease|smooth|smoothly|clear|clearly|skillfully|skilfully)\b/i],negative:/unconstrained in movement/i}
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
 const actual=words.slice(9400,10000).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,23);assert.equal(newlyCleared.length,patch.cleared_mismatched_definitions);
 assert.deepEqual(newlyCleared,[[9675,'buz']]);
 assert.equal(actual,expectedDefinitions);
 assert.equal(actual,576);assert.equal(totals.emptyFallbacks,23+newlyCleared.length);
 assert.equal(totals.emptyFallbacks,24);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
