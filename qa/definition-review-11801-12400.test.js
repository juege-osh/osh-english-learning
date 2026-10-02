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

// Draft for v1.32.7 AFTER data application. Baseline source SHA256: eba43a0ad27c2b391d23b7590a28bdc048460fff0f9567c95028d8f80de3c119. Syntax checks do not establish data acceptance.
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
for(let level=1181;level<=1240;level++){
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
const originalEmpty = [[11826, "mountaintop"], [11842, "gamut"], [11859, "protege"], [11871, "biosolids"], [11876, "sociopolitical"], [11888, "pail"], [11912, "entrepreneurship"], [11988, "panick"], [12125, "dung"], [12150, "yup"], [12184, "adequacy"], [12208, "caseload"], [12210, "soot"], [12223, "concorde"], [12254, "grouse"], [12260, "bulletproof"], [12291, "squirt"], [12342, "ripen"], [12351, "anyplace"], [12379, "meaty"], [12394, "volkswagen"]];
// Read the editorially frozen patch, never infer clearing fixtures from mutated product data.
const patchPath = path.resolve(process.argv[3] || path.join(root,'qa/reviewed_definitions_11801_12400.json'));
const patch = JSON.parse(fs.readFileSync(patchPath,'utf8'));
// Baseline identities and original-empty fixtures were captured from Git before application.
assert.equal(patch.status,'frozen');
assert.deepEqual(patch.range,[11801,12400]);
assert(Array.isArray(patch.changes),'Missing frozen patch changes');
assert(patch.changes.length>0,'No frozen editorial changes provided');
assert.equal(patch.existing_empty_en_preserved,21);
assert.equal(patch.base_head,'0e93b7c94ea4769111f5380e3dd0736fef998ecd');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(patchPath)).digest('hex'),'3c9e5c9b9abfac31d7416da8d06ed11446afdb1aaca2b576fc68f4b79e5b4538');
assert.equal(patch.changed_words,99);
assert.equal(patch.replaced_definitions,98);
assert.equal(patch.cleared_mismatched_definitions,1);
assert.equal(patch.unchanged_correct,480);
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
  assert(c.id>=11801&&c.id<=12400);assert(!seen.has(c.id));seen.add(c.id);
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
test('Charing remains a place-name fragment with actual Chinese fallback, not charcoal burning',()=>{
 const id=12185,w=words[id-1];assert.equal(w.word,'charing');assert.equal(w.en,'');
 assert(newlyCleared.some(([i,word])=>i===id&&word==='charing'));
 assert.equal(newlyCleared.length,1);
 const h=harness(),q=h.level(Math.ceil(id/10)),i=q.findIndex(x=>x.w.id===id);assert(i>=0);
 assert.equal(q[i].type,'choice-zh');select(h,i);
 assert.equal(h.run('qBase(session.queue[session.index]).title'),'charing');
 assert(q[i].options.some(o=>o.id===id&&o.zh===w.zh));
 assert(h.node('app').innerHTML.includes(h.run('esc(session.queue[session.index].w.word)')));
});
// These are independent sense checks, not copies of the proposed replacement strings.
// Every positive group is required; excluded legacy senses must also be absent.
const senses=[
 {id:12022,word:'bushel',positive:[/dry/i,/four|4/i,/pecks/i],negative:/liquid/i},
 {id:12054,word:'til',positive:[/sesame/i],negative:/linden|lime tree|tilia/i},
 {id:12089,word:'peck',positive:[/dry/i,/quarter|one.fourth|1\/4/i,/bushel/i],negative:/liquid/i},
 {id:12103,word:'scribe',positive:[/person|writer/i,/writ|cop/i,/document|record/i],negative:/sharp.pointed|pointed.awl|mark.*metal/i},
 {id:12147,word:'virulent',positive:[/severe|serious|harmful/i,/disease/i,/hostil|hate|hateful/i],negative:/only.*virus|only.*bacter/i},
 {id:11806,word:'aromatic',positive:[/smell|scent|fragrance/i,/pleasant|sweet/i],negative:/amino acid/i},
 {id:11813,word:'lacrosse',positive:[/sport|game/i,/stick/i,/net/i,/ball/i],negative:/only.*United States|only.*America/i},
 {id:11829,word:'filibuster',positive:[/delay|obstruct/i,/legislat|parliament/i],negative:/lawless|pirate|seiz.*country/i},
 {id:11841,word:'entrant',positive:[/person|organization|organisation/i,/competition|activity|market/i],negative:/enters a country|foreign country/i},
 {id:11875,word:'domino',positive:[/tile|piece/i,/dot/i,/two|halves/i],negative:/mask|cloak|costume/i},
 {id:11882,word:'baritone',positive:[/male|man/i,/voice|singer/i,/tenor/i,/bass/i],negative:/oboe|brass instrument/i},
 {id:11971,word:'renter',positive:[/pay/i,/use|occup/i,/property|home|house/i],negative:/receives rent|collects rent|rents out/i},
 {id:11983,word:'quarantine',positive:[/separat|isolat/i,/may|might|potential|suspect/i,/disease|infection/i],negative:/only.*infected|diagnosed.*only/i},
 {id:12230,word:'crucifix',positive:[/cross/i,/image|figure|representation/i,/Jesus|Christ/i],negative:/cross without|empty cross/i},
 {id:12233,word:'vestibule',positive:[/entrance|entry/i,/hall|room|passage/i,/building/i],negative:/ear|vagina|bodily cavit/i},
 {id:12277,word:'turban',positive:[/head|cap/i,/cloth|fabric/i,/wrap/i],negative:/traditional Muslim headdress|only.*Muslim|Muslim.*only/i},
 {id:12282,word:'religiosity',positive:[/religious|religion/i,/belief|devotion|feeling/i],negative:/affected piety|exaggerated.*piety|feigned/i},
 {id:12296,word:'secession',positive:[/withdraw|separat/i,/country|organization|organisation|group/i],negative:/Austrian|art nouveau/i},
 {id:12297,word:'panda',positive:[/bear/i,/China|Chinese/i,/bamboo/i],negative:/Ailuropodidae|some classifications|Tibet/i},
 {id:12303,word:'snuff',positive:[/tobacco/i,/nose|nostril/i,/flame|fire|candle/i,/put out|extinguish/i],negative:/charred portion|charred part/i},
 {id:12305,word:'tantalising',positive:[/desire|interest/i,/arous|tempt|entice|attract/i],negative:/persistent criticism|carping|harass/i},
 {id:12360,word:'undefeated',positive:[/not.*lost|not.*defeat|without.*loss/i],negative:/^victorious$/i},
 {id:12362,word:'mainframe',positive:[/computer/i,/large|powerful/i,/data|transaction/i],negative:/100.?400|special air.conditioned room/i},
 {id:12369,word:'dabble',positive:[/casual|occasional|superficial/i,/interest|activity|involve/i],negative:/dip.*foot|dip.*hand|into a liquid/i},
 {id:12374,word:'wobbly',positive:[/unsteady|unstable|shak/i,/mov|side|sway/i],negative:/Industrial Workers|World|member of/i},
 {id:12377,word:'speculator',positive:[/person|investor/i,/buy|purchase|trad/i,/profit/i],negative:/without knowing the facts|makes conjectures/i},
 {id:12381,word:'outfitter',positive:[/supply|supplies|supplier|provid/i,/equipment/i,/outdoor/i],negative:/only.*men|men.s clothes/i},
 {id:12384,word:'medallion',positive:[/medal/i,/ornament|decorat|panel/i],negative:/ancient Greek coins/i},
 {id:12392,word:'walleye',positive:[/fish/i,/freshwater/i,/North America/i],negative:/strabismus|eyes are directed outward|cornea/i},
 {id:12399,word:'infraction',positive:[/violation|violat|breach/i,/rule|agreement/i],negative:/crime less serious than a felony/i}
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
 const actual=words.slice(11800,12400).filter(w=>w.en).length;
 assert.equal(totals.definitions,actual);assert.equal(totals.emptyFallbacks,600-actual);
 assert.equal(totals.rendered,600);assert.equal(totals.correct,600);assert.equal(totals.wrong,600);
 assert.equal(originalEmpty.length,21);assert.equal(newlyCleared.length,patch.cleared_mismatched_definitions);
 assert.equal(actual,expectedDefinitions);assert.equal(actual,578);assert.equal(totals.emptyFallbacks,22);
 assert.equal(totals.emptyFallbacks,originalEmpty.length+newlyCleared.length);
});
let passed=0;
for(const [name,fn]of tests){try{fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name+'\n'+error.stack);}}
console.log('COVERAGE '+JSON.stringify(totals));
console.log(`TOTAL ${passed}/${tests.length} passed. Actual Node VM queue/title/render/scoring functions; semantic assertions are editorial checks, not browser or pronunciation acceptance.`);
if(passed!==tests.length)process.exitCode=1;
