'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../core.js'),words=require('../data/words.json'),industries=require('../data/industries.json'),extras=require('../data/industry_words.json');
const elements=new Map(),requests=[],notices=[];
function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',addEventListener(){},classList:{add(){},toggle(){}},style:{}});return elements.get(id);}
const entries=[{name:'最佳旅人',correct:20,timeMs:14500,submittedAt:Date.parse('2026-09-29T23:59:58Z')},{name:'<img src=x onerror=alert(1)>',correct:19,timeMs:1000,submittedAt:Date.parse('2026-09-30T00:01:00Z')}];
const questions=Array.from({length:20},(_,i)=>({id:i+1,word:'word'+i,options:[{id:i+1,zh:'答案'},{id:100+i,zh:'其他'}]}));
const responseData=new Map();
const context=vm.createContext({EnglishCore:C,inputWords:words,inputIndustries:industries,inputExtras:extras,console,Map,Set,Date,JSON,Math,Promise,URLSearchParams,
 document:{getElementById:element,addEventListener(){},querySelectorAll(){return []}},window:{addEventListener(){},scrollTo(){}},location:{hash:'#daily',search:''},
 localStorage:{setItem(){},getItem(){return null}},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
 fetch:async(url,options)=>{requests.push({url,options});const data=responseData.get(url);assert(data,'unmocked request '+url);return {ok:true,json:async()=>structuredClone(data)};}});
vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8').replace('\ninit();','\n'),context);
vm.runInContext(fs.readFileSync(require.resolve('../features-ui.js'),'utf8'),context);
Object.assign(context,{notices});vm.runInContext("words=inputWords;industries=inputIndustries;all=new Map([...words,...inputExtras].map(w=>[String(w.id),w]));save=()=>{};toast=text=>notices.push(text);",context);
async function run(){
 assert.equal(vm.runInContext("boardTime(Date.parse('2026-09-30T00:01:00Z'))",context),'2026-09-30 08:01:00');
 for(const at of [0,null,undefined,'not-time',Number.MAX_VALUE]){context.at=at;assert.equal(vm.runInContext('boardTime(at)',context),'时间未记录');assert(vm.runInContext("boardEntryRow({name:'旧旅人',correct:20,timeMs:1000,submittedAt:at},0)",context).includes('时间未记录'));}
 responseData.set('/api/daily/leaderboard?goal=10000',{period:'all-time',date:'1999-01-01',entries,legacyEntries:[{name:'以前的成绩',correct:18,timeMs:99999,legacyDate:'2026-09-29'}]});
 await vm.runInContext('renderDaily()',context);const board=element('app').innerHTML;
 assert(board.includes('10,000 词永久榜'));assert(board.includes('开始榜单挑战'));assert(board.includes('不按日期清榜'));assert(board.includes('2026-09-30 07:59:58'));assert(board.includes('2026-09-30 08:01:00'));assert(board.includes('datetime="2026-09-29T23:59:58.000Z"'));assert(board.includes('&lt;img'));
 // Switching target while an older board is loading must not show the old
 // goal's rows below a newly selected target.
 context.originalFetch=context.fetch;
 vm.runInContext("fetch=async()=>({ok:true,json:async()=>{p.goal=5000;document.getElementById('app').innerHTML='new-goal-view';return {entries:[]};}})",context);
 await vm.runInContext('renderDaily()',context);assert.equal(element('app').innerHTML,'new-goal-view');
 vm.runInContext('p.goal=10000;fetch=originalFetch',context);
 assert(!board.includes('<img src=x'));assert(!board.includes('1999-01-01'));assert(!board.includes('每日榜'));assert(!board.includes('零点换题'));assert(board.includes('20 题挑战成绩与主线通关段位分开'));
 assert(board.includes('<details class="panel"'));assert(!board.includes('<details class="panel" open'));assert(board.includes('记录日期 2026-09-29'));
 // Old deep links can still include a query string. API version, not the date,
 // determines challenge compatibility; repeat starts are never blocked by UI.
 vm.runInContext("location.hash='#daily?from=old-link'",context);await vm.runInContext('renderDaily()',context);assert(element('app').innerHTML.includes('永久排行榜'));
 responseData.set('/api/daily?goal=10000',{period:'all-time',edition:'main-v3',goal:10000,questions,hasBest:true,submitted:true,best:entries[0]});
 await vm.runInContext('dailyStart()',context);assert(element('app').innerHTML.includes('榜单挑战 1 / 20'));assert.equal(vm.runInContext('dailyEdition',context),'main-v3');
 for(let i=0;i<20;i++)vm.runInContext('dailyAnswer('+(i+1)+')',context);
 assert(element('app').innerHTML.includes('提交榜单成绩'));assert(element('app').innerHTML.includes('可多次挑战'));assert(!element('app').innerHTML.includes('只能提交一次'));element('daily-name').value='旅人';
 responseData.set('/api/daily/submit',{correct:18,timeMs:20000,submittedAt:Date.now(),improved:false,best:entries[0]});
 await vm.runInContext('dailySubmit()',context);await Promise.resolve();const sent=JSON.parse(requests.find(x=>x.url==='/api/daily/submit').options.body);
 assert.equal(sent.edition,'main-v3');assert.equal(sent.goal,10000);assert.equal(sent.answers.length,20);assert(notices.at(-1).includes('保留了更好的原成绩'));
 await vm.runInContext('dailyStart()',context);assert.equal(vm.runInContext('dailyPosition',context),0);assert.equal(vm.runInContext('dailyAnswers.length',context),0);
 assert.equal(vm.runInContext('C.stats(p).learned',context),0,'20-question leaderboard attempts do not grant vocabulary progress or route ranks');
 const travel=industries.find(s=>s.id==='travel');assert(travel);
 vm.runInContext("location.hash='#industries';selectIndustry('travel')",context);
 responseData.set('/api/industries/leaderboard?sector=travel',{period:'all-time',entries});await vm.runInContext('renderIndustries()',context);
 assert(element('app').innerHTML.includes('挑战专项榜'));assert(element('app').innerHTML.includes('保留最好成绩'));assert(element('industry-board').innerHTML.includes('旅行永久榜'));assert(element('industry-board').innerHTML.includes('2026-09-30 07:59:58'));
 assert(!element('app').innerHTML.includes('今日专项榜'));assert(!element('industry-board').innerHTML.includes('今日榜'));
 responseData.set('/api/industries/challenge?sector=travel',{period:'all-time',edition:'travel-v2',questions,hasBest:true,submitted:true});await vm.runInContext('industryChallengeStart()',context);
 for(let i=0;i<20;i++)vm.runInContext('industryChallengeAnswer('+(i+1)+')',context);
 assert(element('app').innerHTML.includes('提交榜单成绩'));assert(!element('app').innerHTML.includes('每天只能'));
 responseData.set('/api/industries/submit',{correct:20,timeMs:9999,submittedAt:Date.now(),improved:true,best:entries[0]});element('industry-name').value='旅行高手';await vm.runInContext('industryChallengeSubmit()',context);await Promise.resolve();
 const industrySent=JSON.parse(requests.find(x=>x.url==='/api/industries/submit').options.body);assert.equal(industrySent.edition,'travel-v2');assert.equal(industrySent.sector,'travel');assert(notices.at(-1).includes('最佳成绩已上榜'));
 await vm.runInContext('industryChallengeStart()',context);assert.equal(vm.runInContext('industryChallenge.position',context),0);assert.equal(vm.runInContext('industryChallenge.answers.length',context),0);assert.equal(vm.runInContext('C.stats(p).learned',context),0);
 assert(fs.readFileSync(require.resolve('../index.html'),'utf8').includes('href="#daily" data-nav="daily"><span>♛</span> 排行榜'));
 console.log('PASS: permanent main/specialist boards, Beijing best-score timestamps, legacy dates, safe names, editioned retry submissions, no once-per-day UI block, route progress independent, old #daily links');
}
run().catch(error=>{console.error(error);process.exitCode=1});
