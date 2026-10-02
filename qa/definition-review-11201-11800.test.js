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

// Draft for v1.32.6 AFTER data application. Baseline source SHA256: 40b07cff97db49d1611b312ef104292af3164691b711d07c733ae9c87b85302a. Syntax checks do not establish data acceptance.
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
for(let level=1121;level<=1180;level++){
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
const originalEmpty = [[11206, "payout"], [11207, "beset"], [11225, "rspca"], [11230, "sybil"], [11263, "reconnect"], [11266, "hotline"], [11268, "hmi"], [11274, "mercia"], [11304, "holman"], [11318, "senna"], [11342, "creme"], [11343, "prost"], [11345, "uefa"], [11347, "laurel"], [11348, "mellow"], [11349, "ldc"], [11358, "veterinary"], [11364, "wordperfect"], [11367, "vga"], [11373, "ari"], [11384, "tsp"], [11385, "nvq"], [11405, "ilp"], [11415, "koi"], [11419, "dup"], [11426, "aggie"], [11442, "thu"], [11452, "bsl"], [11461, "ven"], [11467, "cose"], [11470, "sybase"], [11477, "qqv"], [11514, "oops"], [11553, "cajun"], [11590, "crunchy"], [11679, "stairs"], [11699, "frontline"], [11713, "percussion"]];
// Read the editorially frozen patch, never infer clearing fixtures from mutated product data.
const patchPath = path.resolve(process.argv[3] || path.join(root,'qa/reviewed_definitions_11201_11800.json'));
const patch = JSON.parse(fs.readFileSync(patchPath,'utf8'));
assert.equal(patch.status,'frozen');
assert.deepEqual(patch.range,[11201,11800]);
assert(Array.isArray(patch.changes),'Missing frozen patch changes');
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
  assert(c.id>=11201&&c.id<=11800);assert(!seen.has(c.id));seen.add(c.id);
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
// These are independent sense checks, not copies of the proposed replacement strings.
// Every positive group is required; excluded legacy senses must also be absent.
const senses=[
 {id:11234,word:'apex',positive:[/highest|top|summit/i],negative:/celestial|solar system/i},
 {id:11253,word:'stalemate',positive:[/deadlock/i,/chess/i,/not in check/i],negative:/king is in check|king is checked/i},
 {id:11277,word:'purify',positive:[/remov|eliminat/i,/impurit|unwanted|contaminant/i],negative:/concentrat|increase.*strength/i},
 {id:11296,word:'lms',positive:[/learning management system/i,/software|platform|system.*course/i],negative:/locomotive|railway/i},
 {id:11299,word:'exhibitor',positive:[/person|organization|company/i,/display|show/i,/exhibition|fair|show/i],negative:/organizes|organises|organizer|organiser/i},
 {id:11326,word:'gypsy',positive:[/Romani/i,/offensive|offend|derogatory/i],negative:/dark skin|fortunetell|fortune.tell/i},
 {id:11355,word:'swipe',positive:[/finger|card/i,/slide|mov|across/i],negative:/strong blow|hard blow/i},
 {id:11372,word:'garland',positive:[/flower|leaves/i,/chain|ring|wreath/i],negative:/Judy|actress|1922/i},
 {id:11383,word:'porous',positive:[/hole|pore/i,/air|liquid/i,/pass|through|permea/i],negative:/only.*absorb/i},
 {id:11389,word:'attractiveness',positive:[/appeal|desirab|interest/i],negative:/sexual allure|sexual.*only/i},
 {id:11408,word:'wafer',positive:[/thin/i,/biscuit|cookie/i,/chip|semiconductor|electronic/i],negative:/adhesive|seal letters/i},
 {id:11446,word:'coeliac',positive:[/gluten/i,/immune/i,/intestine/i],negative:/any.*digestive|abdominal cavity only/i},
 {id:11465,word:'homemaker',positive:[/person/i,/home|household/i],negative:/wife who|woman whose/i},
 {id:11471,word:'lymph',positive:[/fluid/i,/lymphatic|vessel/i,/immune|tissue/i],negative:/colorless.*only/i},
 {id:11501,word:'knockout',positive:[/boxing|boxer/i,/cannot continue|unable to continue/i,/count|referee/i],negative:/renders.*unconscious|must.*unconscious/i},
 {id:11510,word:'predicate',positive:[/sentence/i,/verb/i,/subject/i],negative:/affirmation as opposed to denial/i},
 {id:11587,word:'filament',positive:[/thin|fine/i,/thread|wire/i],negative:/stamen only/i},
 {id:11621,word:'immigrate',positive:[/come|enter|move.*into/i,/country/i,/live|settle/i],negative:/leave.*native country/i},
 {id:11635,word:'recharge',positive:[/battery/i,/power|energ|electric/i],negative:/charge again with crime/i},
 {id:11668,word:'impeach',positive:[/accus|charg/i,/official/i,/misconduct|wrongdoing/i],negative:/remove.*from office|dismiss.*office/i},
 {id:11704,word:'conveyor',positive:[/machine|device/i,/belt/i,/goods|material/i],negative:/a person who conveys/i},
 {id:11720,word:'tummy',positive:[/informal/i,/stomach|belly/i],negative:/abdomen of a vertebrate only/i},
 {id:11721,word:'digestion',positive:[/food/i,/break|process/i,/absorb/i],negative:/sewage|chemical action or heat/i},
 {id:11731,word:'horseshoe',positive:[/U.shaped/i,/metal/i,/hoof/i],negative:/equine only/i},
 {id:11783,word:'grudge',positive:[/resent|ill.will/i,/lasting|persist|long/i],negative:/justify.*retaliation|justifies.*revenge/i}
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
 const actual=words.slice(11200,11800).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,38);assert.equal(newlyCleared.length,patch.cleared_mismatched_definitions);
 assert.equal(actual,expectedDefinitions);
 assert.equal(totals.emptyFallbacks,originalEmpty.length+newlyCleared.length);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
