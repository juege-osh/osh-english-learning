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

// Draft for v1.32.8 AFTER data application. Syntax checks do not establish data acceptance. Baseline HEAD 2ce5e39999879874d2472961f22c1609c93e13ec.
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
for(let level=1241;level<=1300;level++){
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
const originalEmpty = [[12419, "corral"], [12442, "contemplative"], [12452, "tram"], [12470, "multidisciplinary"], [12492, "adobe"], [12516, "poplar"], [12528, "wallow"], [12606, "bowen"], [12642, "adversarial"], [12654, "ebony"], [12672, "coed"], [12702, "orleans"], [12776, "underrepresented"], [12779, "whomever"], [12803, "moisturizer"], [12827, "condescending"], [12867, "keyword"], [12870, "agonize"], [12902, "reconfigure"], [12917, "octopus"], [12952, "enfield"], [12967, "reborn"], [12977, "impotent"]];
// Read the editorially frozen patch, never infer clearing fixtures from mutated product data.
const patchPath = path.resolve(process.argv[3] || path.join(root,'qa/reviewed_definitions_12401_13000.json'));
const patch = JSON.parse(fs.readFileSync(patchPath,'utf8'));
// Baseline identities and original-empty fixtures were captured from Git before application.
assert.equal(patch.status,'frozen');
assert.deepEqual(patch.range,[12401,13000]);
assert(Array.isArray(patch.changes),'Missing frozen patch changes');
assert(patch.changes.length>0,'No frozen editorial changes provided');
assert.equal(patch.existing_empty_en_preserved,originalEmpty.length);
assert.equal(patch.base_head,'2ce5e39999879874d2472961f22c1609c93e13ec');
assert.equal(patch.unchanged_correct,600-originalEmpty.length-patch.changes.length);
const newlyCleared = patch.changes.filter(c=>c.after==='').map(c=>[c.id,c.word]);
const expectedDefinitions = 600-originalEmpty.length-newlyCleared.length;
const baselineExamplesSHA = '5ad92ffb69ee42b5471bc2de0ee2573f81a2995dcb8e024ea835e1568466474c';
// Captured before application, independently of the proposed en strings.
const baselineNonEnSHA = '0a2266570a1bdc1b88c94680876e4189a4f4eed5a1a2ba7294fa6197e9a34647';
test('all 20000 IDs, spellings, Chinese meanings and full dictionaries remain unchanged',()=>{
 const projected=words.map(w=>Object.fromEntries(Object.entries(w).filter(([key])=>key!=='en')));
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(projected)).digest('hex'),baselineNonEnSHA);
 assert.equal(words.length,20000);
 for(let i=0;i<words.length;i++)assert.equal(words[i].id,i+1);
});
test('all existing bilingual examples retain complete baseline bytes',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/examples.json'))).digest('hex'),baselineExamplesSHA);
});
test('frozen editorial patch agrees with actual en fields and independent original-empty fixtures',()=>{
 const seen=new Set(),oldEmpty=new Set(originalEmpty.map(x=>x[0]));
 for(const c of patch.changes){
  assert(c.id>=12401&&c.id<=13000);assert(!seen.has(c.id));seen.add(c.id);
  assert(!oldEmpty.has(c.id),'Original empty fields must not be filled');
  assert(c.before&&c.before!==c.after);assert.equal(words[c.id-1].word,c.word);assert.equal(words[c.id-1].en,c.after);
 }
 assert.equal(patch.changed_words,patch.changes.length);
 assert.equal(patch.cleared_mismatched_definitions,newlyCleared.length);
 assert.equal(patch.replaced_definitions,patch.changes.length-newlyCleared.length);
 assert.equal(patch.existing_empty_en_preserved,originalEmpty.length);
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
test('Strauss remains an unresolved surname and uses actual Chinese fallback, not an assumed composer',()=>{
 const id=12729,w=words[id-1];assert.equal(w.word,'strauss');assert.equal(w.en,'');
 assert(newlyCleared.some(([i,word])=>i===id&&word==='strauss'));
 const h=harness(),q=h.level(Math.ceil(id/10)),index=q.findIndex(x=>x.w.id===id);assert(index>=0);
 assert.equal(q[index].type,'choice-zh');select(h,index);
 assert.equal(h.run('qBase(session.queue[session.index]).title'),'strauss');
 assert(q[index].options.some(o=>o.id===id&&o.zh===w.zh));
 assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.word)')));
});
// These are independent sense checks, not copies of the proposed replacement strings.
// Every positive group is required; excluded legacy senses must also be absent.
const senses=[
 {id:12610,word:'blight',positive:[/disease/i,/plant/i,/spoil|damage|harm/i],negative:/^a state or condition being blighted$/i},
 {id:12613,word:'weld',positive:[/join/i,/metal/i,/heat|pressure/i],negative:/abolitionist|1803|1895/i},
 {id:12651,word:'puck',positive:[/disc|disk/i,/rubber/i,/hockey/i],negative:/sprite|folklore/i},
 {id:12652,word:'palsy',positive:[/muscle/i,/weakness|paralysis|loss of control/i],negative:/^a condition marked by uncontrollable tremor$/i},
 {id:12693,word:'welshman',positive:[/man/i,/Wales/i],negative:/^a native or resident of Wales$/i},
 {id:12695,word:'humanism',positive:[/human/i,/values|dignity|potential/i],negative:/rejects religion|reject.*supernatural/i},
 {id:12707,word:'holocaust',positive:[/Nazi/i,/Jew/i,/murder|kill|persecution/i],negative:/^an act of mass destruction and loss of life/i},
 {id:12724,word:'moron',positive:[/insult|offensive/i,/stupid/i],negative:/Argentina|Buenos Aires/i},
 {id:12749,word:'eire',positive:[/Irish/i,/name/i,/Ireland/i],negative:/independence.*1921/i},
 {id:12764,word:'ponce',positive:[/offensive|insult/i,/British/i,/slang/i],negative:/^a man who is effeminate in his manner and fussy in the way he dresses$/i},
 {id:12788,word:'condensation',positive:[/gas/i,/liquid/i,/shorten|abridg/i],negative:/psychoanalysis|unconscious process|especially in dreams/i},
 {id:12795,word:'hypnosis',positive:[/focused|focus/i,/attention/i,/suggestion/i],negative:/resembles sleep|sleep.like|a form of sleep/i},

 {id:12403,word:'outage',positive:[/period|time/i,/supply|service/i,/stop|unavail|fail/i],negative:/^quantity of liquid lost/i},
 {id:12418,word:'mercenary',positive:[/soldier/i,/money|pay/i],negative:/only.*foreign|foreign.*only/i},
 {id:12448,word:'sterilize',positive:[/microorganism|microbe/i,/remove|destroy|kill/i],negative:/only.*bacter|only.*virus/i},
 {id:12454,word:'putter',positive:[/golf/i,/club/i,/short|gentle/i,/hole/i],negative:/person who.*put|person who.*place/i},
 {id:12467,word:'mannequin',positive:[/model/i,/human|person|body/i,/clothes|clothing/i],negative:/woman who wears clothes/i},
 {id:12497,word:'hiatus',positive:[/pause|interruption|break/i,/temporar|brief/i],negative:/laryn|glott|vowel/i},
 {id:12501,word:'epidemiology',positive:[/study/i,/pattern|cause/i,/population/i],negative:/only.*epidemic|only.*infect/i},
 {id:12515,word:'toaster',positive:[/appliance|device/i,/bread/i,/brown|toast/i],negative:/person who.*toast|someone who.*toast/i},
 {id:12557,word:'carnivore',positive:[/animal/i,/feed|eat/i,/other animals|meat/i],negative:/only.*mammal|only.*carnivora/i},
 {id:12576,word:'stuffy',positive:[/fresh air|ventilat/i,/formal|old.fashion/i],negative:/^having a stuffy nose$/i},
 {id:12588,word:'ouch',positive:[/exclamation|cry/i,/hurt|pain/i],negative:/ornament|brooch|clasp/i},
 {id:12600,word:'barbaric',positive:[/cruel|brutal/i,/violent|violence/i],negative:/only.*uncivilized|only.*uncivilised/i},
 {id:12805,word:'scavenger',positive:[/animal/i,/dead|discard|refuse/i],negative:/chemical agent|impurit/i},
 {id:12807,word:'panoramic',positive:[/broad|wide|full/i,/view/i],negative:/^s as from an altitude or distance$/i},
 {id:12809,word:'bluegrass',positive:[/music/i,/string|banjo|fiddle/i],negative:/genus Poa|bluish.green culms/i},
 {id:12815,word:'queasy',positive:[/feel|suffer/i,/sick|nause|stomach/i],negative:/^s causing or able to cause nausea$/i},
 {id:12816,word:'windrow',positive:[/row/i,/hay|vegetation/i,/dry/i],negative:/for the purpose of\s*$/i},
 {id:12821,word:'libel',positive:[/false/i,/writ|lasting/i,/reputation/i],negative:/purpose of defaming a living person/i},
 {id:12835,word:'grounding',positive:[/basic|fundamental/i,/training|knowledge/i],negative:/electrical equipment|earth wire/i},
 {id:12853,word:'quaker',positive:[/member/i,/Friends/i],negative:/tremble|fear|quakes/i},
 {id:12871,word:'alexandria',positive:[/city/i,/Egypt/i],negative:/^a town in Louisiana on the Red River$/i},
 {id:12877,word:'peacock',positive:[/male/i,/peafowl/i,/feather|tail/i],negative:/butterfly|Inachis/i},
 {id:12880,word:'hoover',positive:[/vacuum/i,/clean/i],negative:/industrialist|manufacturer|1849|1932/i},
 {id:12898,word:'lance',positive:[/spear/i,/point|tip/i],negative:/^move quickly/i},
 {id:12907,word:'decomposition',positive:[/break|decay/i,/substance|material/i],negative:/vector field/i},
 {id:12939,word:'barter',positive:[/goods|services/i,/exchange|trade/i,/without.*money/i],negative:/^an equal exchange$/i},
 {id:12961,word:'regent',positive:[/person/i,/monarch|king|queen|sovereign/i,/place|temporar/i],negative:/members of a governing board/i},
 {id:12974,word:'interagency',positive:[/between/i,/agenc/i],negative:/Intermediate agency/i},
 {id:12983,word:'chloride',positive:[/chlorine/i,/compound/i,/negative charge|anion/i],negative:/any compound containing a chlorine atom|only.*salt/i},
 {id:12984,word:'mangrove',positive:[/tree|shrub/i,/coast/i,/tropic/i],negative:/all.*prop roots|every.*prop roots/i},
 {id:12999,word:'siphon',positive:[/tube/i,/liquid|water/i,/lower/i,/gravity/i],negative:/atmospheric pressure forces|only.*atmospheric/i}
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
 const actual=words.slice(12400,13000).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,23);assert.equal(newlyCleared.length,patch.cleared_mismatched_definitions);
 assert.equal(actual,expectedDefinitions);
 assert.equal(totals.emptyFallbacks,originalEmpty.length+newlyCleared.length);
});
// Explicitly preserve two valid basic senses; do not force every context into each definition.
const retainedBasicSenses = [{"id": 12852, "word": "pomegranate", "baseline_en": "shrub or small tree native to southwestern Asia having large red many-seeded fruit"}, {"id": 12893, "word": "bottleneck", "baseline_en": "the narrow part of a bottle near the top"}];
for(const s of retainedBasicSenses)test(s.word+' keeps its valid baseline basic definition',()=>{
 const w=words[s.id-1];assert.equal(w.word,s.word);assert.equal(w.en,s.baseline_en);
 assert(!patch.changes.some(c=>c.id===s.id),'Retained correct basic sense must not appear in patch');
 const h=harness(),q=h.level(Math.ceil(s.id/10)),index=q.findIndex(x=>x.w.id===s.id&&x.type==='definition');assert(index>=0);
 select(h,index);assert.equal(h.run('qBase(session.queue[session.index]).title'),s.baseline_en);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
