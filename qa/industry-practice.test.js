'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const words=require('../data/words.json'),industries=require('../data/industries.json'),C=require('../core.js');
const extras=require('../data/industry_words.json'),industryWords=new Map([...words,...extras].map(w=>[w.id,w]));
const elements=new Map(),spoken=[];
function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',addEventListener(){},classList:{add(){},toggle(){}},style:{},selectedOptions:[]});return elements.get(id);}
const context=vm.createContext({EnglishCore:C,inputExtras:extras,inputWords:words,inputIndustries:industries,console,Map,Set,Date,JSON,Math,Promise,URLSearchParams,
 document:{getElementById:element,addEventListener(){},querySelectorAll(){return []}},window:{addEventListener(){},scrollTo(){}},
 location:{hash:'#industries',search:''},localStorage:{items:new Map(),setItem(k,v){this.items.set(k,v)},getItem(k){return this.items.get(k)||null}},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
 fetch:async()=>({ok:true,json:async()=>({date:'2026-09-30',entries:[]})}),say:t=>spoken.push(t)});
vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8').replace('\ninit();','\n'),context);
vm.runInContext(fs.readFileSync(require.resolve('../features-ui.js'),'utf8'),context);
vm.runInContext("words=inputWords;industries=inputIndustries;all=new Map([...words,...inputExtras].map(w=>[String(w.id),w]));save=()=>{};confetti=()=>{};say=t=>spoken.push(t);",Object.assign(context,{spoken}));
async function run(){
 await vm.runInContext('renderIndustries()',context);
 assert(element('app').innerHTML.includes('练精选 683 词'));
 assert(!element('app').innerHTML.includes('试练扩展'));
 assert(element('app').innerHTML.includes('句子选词 · 300 词'));
 vm.runInContext("industryPracticeStart('sentences')",context);
 assert(element('app').innerHTML.includes('_____'));
 assert(element('app').innerHTML.includes('这个算法处理大文件太慢了。'));
 assert(!element('app').innerHTML.includes('This algorithm is too slow'));
 const id=words.find(w=>w.word==='algorithm').id;
 vm.runInContext('industryPracticeAnswer('+id+')',context);
 assert(element('industry-feedback').innerHTML.includes('This algorithm is too slow for large files.'));
 assert(element('industry-feedback').innerHTML.includes('<details class="answer-details">'));assert(!element('industry-feedback').innerHTML.includes('<details class="answer-details" open'),'answer explanation starts collapsed');
 assert(element('industry-feedback').innerHTML.includes("Let&#39;s try a simpler algorithm."));
 assert.equal(vm.runInContext('p.industries.programmer.seen.length',context),1);
 assert.equal(vm.runInContext('C.stats(p).learned',context),0,'industry practice must not inflate the main route');
 vm.runInContext(`actions['speak-industry-example']('programmer:${id}:1')`,context);
 assert.equal(spoken.at(-1),"Let's try a simpler algorithm.");
 vm.runInContext('industryPracticeNext();industryPracticeAnswer(0)',context);
 assert.equal(vm.runInContext("industryWrong('programmer').length",context),1);
 assert(vm.runInContext('industryReviewSummary()',context).includes('程序员 · 1 个错词'));
 vm.runInContext("industryPracticeStart('wrong')",context);
 assert.equal(vm.runInContext('industryPractice.items[0].word',context),'database');
 vm.runInContext('industryPracticeAnswer(industryPractice.items[0].id)',context);
 assert.equal(vm.runInContext("industryWrong('programmer').length",context),0);
 vm.runInContext("p.industries.programmer.seen.push(20000)",context);
 assert.equal(vm.runInContext("industrySeen('programmer').length",context),2,'removed words must not count against the new route');
 await vm.runInContext("selectedIndustry='marketing';renderIndustries()",context);
 assert(element('app').innerHTML.includes('练精选 767 词'));
 assert(!element('app').innerHTML.includes('试练扩展'));
 for(const [sector,headword,count,meaning] of [['healthcare','patient',753,'患者正在外面等候。'],['ai_creator','prompt',831,'能把提示词写得更具体一点吗？'],['foreign_trade','export',774,'我们向几个国家出口家具。'],['finance','asset',846,'我们需要把这项资产记入账目。'],['marketing','brand',767,'我们的品牌需要更清楚的表达。'],['law','law',850,'这份协议适用哪部法律？'],['chemistry','chemistry',932,'我正在写报告的化学部分。'],['travel','travel',709,'我一般背着背包出门。']]){
  await vm.runInContext(`selectedIndustry='${sector}';renderIndustries()`,context);
  assert(element('app').innerHTML.includes(`练精选 ${count} 词`));assert(!element('app').innerHTML.includes('试练扩展'));
  vm.runInContext("industryPracticeStart('sentences')",context);assert(element('app').innerHTML.includes(meaning));
  const word=words.find(x=>x.word===headword);vm.runInContext('industryPracticeAnswer('+word.id+')',context);
  assert(element('industry-feedback').innerHTML.includes(industries.find(x=>x.id===sector).examples[word.id][0].text.replaceAll("'",'&#39;')));
  vm.runInContext(`actions['speak-industry-example']('${sector}:${word.id}:1')`,context);
  assert.equal(spoken.at(-1),industries.find(x=>x.id===sector).examples[word.id][1].text);
  vm.runInContext('industryPracticeNext();industryPracticeAnswer(0)',context);assert.equal(vm.runInContext(`industryWrong('${sector}').length`,context),1);vm.runInContext('header()',context);assert.equal(element('nav-due').textContent,1,'sidebar review badge must include specialist mistakes');
  vm.runInContext("industryPracticeStart('wrong');industryPracticeAnswer(industryPractice.items[0].id)",context);assert.equal(vm.runInContext(`industryWrong('${sector}').length`,context),0);vm.runInContext('header()',context);assert.equal(element('nav-due').textContent,0);
 }
 await vm.runInContext("selectedIndustry='biology';renderIndustries()",context);
 assert(element('app').innerHTML.includes('练精选 967 词'));
 vm.runInContext("renderIndustryVocabulary('减数分裂')",context);
 assert(element('industry-search-results').innerHTML.includes('meiosis'));
 assert.equal(element('industry-search-status').textContent,'找到 1 词');
 const meiosis=extras.find(w=>w.word==='meiosis');
 vm.runInContext(`industryPracticeWord(${meiosis.id})`,context);assert(element('app').innerHTML.includes('_____'));
 vm.runInContext('industryPracticeAnswer(0)',context);
 assert.equal(vm.runInContext("industryWrong('biology').length",context),1);
 assert(element('industry-feedback').innerHTML.includes('This diagram shows meiosis.'));
 vm.runInContext(`actions['speak-industry-example']('biology:${meiosis.id}:1')`,context);assert.equal(spoken.at(-1),'Can you explain what happens during meiosis?');
 vm.runInContext("industryPracticeStart('wrong');industryPracticeAnswer(industryPractice.items[0].id)",context);
 assert.equal(vm.runInContext("industryWrong('biology').length",context),0);assert.equal(vm.runInContext('C.stats(p).learned',context),0);
 vm.runInContext("renderIndustryVocabulary('<script>')",context);assert(element('industry-search-results').innerHTML.includes('暂时没收录'));
 await vm.runInContext("selectedIndustry='finance';renderIndustries();renderIndustryVocabulary('ipo')",context);
 assert(element('industry-search-results').innerHTML.includes('<strong>IPO</strong>'));
 const ipo=words.find(w=>w.word==='ipo');
 vm.runInContext(`industryPracticeWord(${ipo.id});industryPracticeAnswer(${ipo.id});actions['speak-industry-word']('finance:${ipo.id}')`,context);
 assert.equal(spoken.at(-1),'IPO');assert(element('industry-feedback').innerHTML.includes('preparing for its IPO.'));
 assert.equal(vm.runInContext(`all.get('${ipo.id}').word`,context),'ipo');
 await vm.runInContext("selectedIndustry='chemistry';renderIndustries();renderIndustryVocabulary('PH')",context);
 assert(element('industry-search-results').innerHTML.indexOf('<strong>pH</strong>')<element('industry-search-results').innerHTML.indexOf('<strong>phosphorus</strong>'),'an exact short acronym must come before substring matches');
 // A fresh page restores only an existing route. A missing/blocked browser
 // store must not stop practice or turn this preference into learning progress.
 vm.runInContext("selectIndustry('chemistry');selectedIndustry='programmer';restoreIndustrySelection()",context);
 assert.equal(vm.runInContext('selectedIndustry',context),'chemistry');
 assert.equal(vm.runInContext("selectIndustry('not-a-route')",context),false);
 vm.runInContext("localStorage.setItem(INDUSTRY_PREFERENCE,'removed-route');selectedIndustry='programmer';restoreIndustrySelection()",context);
 assert.equal(vm.runInContext('selectedIndustry',context),'programmer');
 vm.runInContext("localStorage.getItem=()=>{throw Error('storage blocked')};localStorage.setItem=()=>{throw Error('storage blocked')};restoreIndustrySelection();selectIndustry('law')",context);
 assert.equal(vm.runInContext('selectedIndustry',context),'law');
 // Cover the entire editorial cloze bank, not just the first visible question.
 for(const sector of industries.filter(s=>s.examples))for(const id of Object.keys(sector.examples).map(Number)){
  context.testSector=sector;context.testID=id;
  const chosen=vm.runInContext('(()=>{const word=industryWord(testSector,testID),pool=testSector.wordIds.map(id=>industryWord(testSector,id));return industryChoicePool(testSector,word,pool,true);})()',context);
  assert(chosen.some(x=>x.id===id));const groups=(sector.confusableGroups||[]).filter(g=>g.includes(id));
  for(const other of chosen.filter(x=>x.id!==id)){
   assert(!groups.some(g=>g.includes(other.id)),'cloze must not offer an editorial near-synonym');
   const target=new Set(sector.glosses[id].split(/[；;]/).map(s=>s.trim()));assert(!other.zh.split(/[；;]/).map(s=>s.trim()).some(s=>target.has(s)),'cloze must not offer an alternate spelling or identical sense');
  }
  const options=C.choices(industryWords.get(id),chosen,'word');assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.id)).size,4);
 }
 assert.equal(vm.runInContext('C.stats(p).learned',context),0);
 console.log('PASS: ten reviewed routes, all '+industries.reduce((n,s)=>n+Object.keys(s.examples||{}).length,0)+' cloze words without near-synonym distractors, correct bilingual audio text, separate progress, wrong-word review and removed-word filtering');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
