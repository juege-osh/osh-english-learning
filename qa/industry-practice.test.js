'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const words=require('../data/words.json'),industries=require('../data/industries.json'),C=require('../core.js');
const elements=new Map(),spoken=[];
function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',addEventListener(){},classList:{add(){}},style:{}});return elements.get(id);}
const context=vm.createContext({EnglishCore:C,inputWords:words,inputIndustries:industries,console,Map,Set,Date,JSON,Math,Promise,URLSearchParams,
 document:{getElementById:element,addEventListener(){},querySelectorAll(){return []}},window:{addEventListener(){},scrollTo(){}},
 location:{hash:'#industries',search:''},localStorage:{setItem(){},getItem(){return null}},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
 fetch:async()=>({ok:true,json:async()=>({date:'2026-09-30',entries:[]})}),say:t=>spoken.push(t)});
vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8').replace('\ninit();','\n'),context);
vm.runInContext(fs.readFileSync(require.resolve('../features-ui.js'),'utf8'),context);
vm.runInContext("words=inputWords;industries=inputIndustries;all=new Map(words.map(w=>[String(w.id),w]));save=()=>{};confetti=()=>{};say=t=>spoken.push(t);",Object.assign(context,{spoken}));
async function run(){
 await vm.runInContext('renderIndustries()',context);
 assert(element('app').innerHTML.includes('练精选 683 词'));
 assert(!element('app').innerHTML.includes('试练扩展'));
 assert(element('app').innerHTML.includes('句子选词 · 100 词'));
 vm.runInContext("industryPracticeStart('sentences')",context);
 assert(element('app').innerHTML.includes('_____'));
 assert(element('app').innerHTML.includes('这个算法处理大文件太慢了。'));
 assert(!element('app').innerHTML.includes('This algorithm is too slow'));
 const id=words.find(w=>w.word==='algorithm').id;
 vm.runInContext('industryPracticeAnswer('+id+')',context);
 assert(element('industry-feedback').innerHTML.includes('This algorithm is too slow for large files.'));
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
 await vm.runInContext("selectedIndustry='finance';renderIndustries()",context);
 assert(element('app').innerHTML.includes('练精选 100 词'));
 assert(element('app').innerHTML.includes('试练扩展 600 词'));
 console.log('PASS: dynamic route sizes, bilingual cloze, reviewed audio text, separate progress, wrong-word review and removed-word filtering');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
