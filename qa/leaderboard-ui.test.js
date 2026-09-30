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
 await vm.runInContext('renderDaily()',context);const board=element('app').innerHTML+element('daily-board').innerHTML;
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
 vm.runInContext("location.hash='#daily?from=old-link'",context);await vm.runInContext('renderDaily()',context);assert(element('daily-board').innerHTML.includes('永久排行榜'));
 responseData.set('/api/daily?goal=10000',{period:'all-time',edition:'main-v3',attemptId:'main-attempt-1',goal:10000,questions,hasBest:true,submitted:true,best:entries[0]});
 await vm.runInContext('dailyStart()',context);assert(element('app').innerHTML.includes('榜单挑战 1 / 20'));assert.equal(vm.runInContext('dailyEdition',context),'main-v3');
 for(let i=0;i<20;i++)vm.runInContext('dailyAnswer('+(i+1)+')',context);
 assert(element('app').innerHTML.includes('提交榜单成绩'));assert(element('app').innerHTML.includes('可多次挑战'));assert(!element('app').innerHTML.includes('只能提交一次'));element('daily-name').value='旅人';
 responseData.set('/api/daily/submit',{correct:18,timeMs:20000,submittedAt:Date.now(),improved:false,best:entries[0]});
 await vm.runInContext('dailySubmit()',context);await Promise.resolve();const sent=JSON.parse(requests.find(x=>x.url==='/api/daily/submit').options.body);
 assert.equal(sent.edition,'main-v3');assert.equal(sent.attemptId,'main-attempt-1');assert.equal(sent.goal,10000);assert.equal(sent.answers.length,20);assert(notices.at(-1).includes('保留了更好的原成绩'));
 await vm.runInContext('dailyStart()',context);assert.equal(vm.runInContext('dailyPosition',context),0);assert.equal(vm.runInContext('dailyAnswers.length',context),0);
 assert.equal(vm.runInContext('C.stats(p).learned',context),0,'20-question leaderboard attempts do not grant vocabulary progress or route ranks');
 const travel=industries.find(s=>s.id==='travel');assert(travel);
 vm.runInContext("location.hash='#industries';selectIndustry('travel')",context);
 responseData.set('/api/industries/leaderboard?sector=travel',{period:'all-time',entries});await vm.runInContext('renderIndustries()',context);
 assert(element('app').innerHTML.includes('挑战专项榜'));assert(element('app').innerHTML.includes('保留最好成绩'));assert(element('industry-board').innerHTML.includes('旅行永久榜'));assert(element('industry-board').innerHTML.includes('2026-09-30 07:59:58'));
 assert(!element('app').innerHTML.includes('今日专项榜'));assert(!element('industry-board').innerHTML.includes('今日榜'));
 responseData.set('/api/industries/challenge?sector=travel',{period:'all-time',edition:'travel-v2',attemptId:'travel-attempt-1',questions,hasBest:true,submitted:true});await vm.runInContext('industryChallengeStart()',context);
 for(let i=0;i<20;i++)vm.runInContext('industryChallengeAnswer('+(i+1)+')',context);
 assert(element('app').innerHTML.includes('提交榜单成绩'));assert(!element('app').innerHTML.includes('每天只能'));
 responseData.set('/api/industries/submit',{correct:20,timeMs:9999,submittedAt:Date.now(),improved:true,best:entries[0]});element('industry-name').value='旅行高手';await vm.runInContext('industryChallengeSubmit()',context);await Promise.resolve();
 const industrySent=JSON.parse(requests.find(x=>x.url==='/api/industries/submit').options.body);assert.equal(industrySent.edition,'travel-v2');assert.equal(industrySent.attemptId,'travel-attempt-1');assert.equal(industrySent.sector,'travel');assert(notices.at(-1).includes('最佳成绩已上榜'));
 await vm.runInContext('industryChallengeStart()',context);assert.equal(vm.runInContext('industryChallenge.position',context),0);assert.equal(vm.runInContext('industryChallenge.answers.length',context),0);assert.equal(vm.runInContext('C.stats(p).learned',context),0);
 // The API returns up to 1,000 rows; only 50 are inserted into the current
 // page, and searches preserve the original full-board rank.
 const thousand=Array.from({length:1000},(_,i)=>({rank:i+1,name:'Player'+String(i+1).padStart(4,'0'),username:'user'+(i+1),correct:20,timeMs:1000+i,submittedAt:entries[0].submittedAt}));
 responseData.set('/api/daily/leaderboard?goal=10000',{entries:thousand,total:1500,matched:1500,limit:1000});
 vm.runInContext("location.hash='#daily'",context);await vm.runInContext('renderDaily()',context);
 let visible=element('daily-board').innerHTML;
 assert.equal((visible.match(/class="daily-row"/g)||[]).length,50);assert(visible.includes('Player0050'));assert(!visible.includes('Player0051'));assert(visible.includes('第 1 / 20 页'));assert(visible.includes('共 1,500 人上榜'));assert(visible.includes('min-height:44px'));assert(visible.includes('flex-wrap:wrap'));assert(visible.includes('role="search"'));
 vm.runInContext("pageBoard('main:1')",context);visible=element('daily-board').innerHTML;assert(visible.includes('Player0051'));assert(visible.includes('总榜第 51 名'));assert(!visible.includes('Player0001'));assert(visible.includes('第 2 / 20 页'));
 for(let i=0;i<30;i++)vm.runInContext("pageBoard('main:1')",context);assert(element('daily-board').innerHTML.includes('第 20 / 20 页'));assert(element('daily-board').innerHTML.includes('总榜第 1000 名'));
 const outside={rank:1204,name:'榜外高手',username:'JuegeTest',correct:18,timeMs:18000,submittedAt:entries[0].submittedAt};
 responseData.set('/api/daily/leaderboard?goal=10000&q=Jue%26Ge',{entries:[outside],total:1500,matched:1,limit:1000});element('main-board-query').value='Jue&Ge';await vm.runInContext("searchBoard('main')",context);visible=element('daily-board').innerHTML;
 assert(visible.includes('总榜第 1204 名'));assert(visible.includes('<b aria-label="总榜第 1204 名">1204</b>'));assert(visible.includes('@JuegeTest'));assert(visible.includes('匹配 1 人'));assert(visible.includes('value="Jue&amp;Ge"'));assert.equal(vm.runInContext("boardViews.get('main').page",context),0);assert(requests.some(x=>x.url.endsWith('q=Jue%26Ge')));
 responseData.set('/api/daily/leaderboard?goal=10000&q=Nobody',{entries:[],total:1500,matched:0,limit:1000});element('main-board-query').value='Nobody';await vm.runInContext("searchBoard('main')",context);assert(element('daily-board').innerHTML.includes('没找到这位学习者'));assert(element('daily-board').innerHTML.includes('清除搜索查看榜单'));
 await vm.runInContext("searchBoard('main',true)",context);assert.equal(vm.runInContext("boardViews.get('main').query",context),'');assert(element('daily-board').innerHTML.includes('Player0001'));
 responseData.set('/api/daily/leaderboard?goal=10000&q=Many',{entries:thousand,total:5000,matched:2000,limit:1000});element('main-board-query').value='Many';await vm.runInContext("searchBoard('main')",context);assert(element('daily-board').innerHTML.includes('最多 1,000 个搜索结果'));assert(element('daily-board').innerHTML.includes('匹配 2,000 人'));
 await vm.runInContext("searchBoard('main',true)",context);
 // A late response for an older name cannot replace a newer search result.
 context.originalFetch=context.fetch;vm.runInContext("fetch=url=>new Promise(resolve=>{if(url.endsWith('q=Old'))globalThis.oldResolve=resolve;else resolve({ok:true,json:async()=>({entries:[],total:1500,matched:0,limit:1000})});})",context);
 element('main-board-query').value='Old';const old=vm.runInContext("searchBoard('main')",context);element('main-board-query').value='Newest';await vm.runInContext("searchBoard('main')",context);vm.runInContext("oldResolve({ok:true,json:async()=>({entries:[{rank:1,name:'OldName',correct:20,timeMs:1000,submittedAt:1}],total:1,matched:1,limit:1000})})",context);await old;
 assert.equal(vm.runInContext("boardViews.get('main').query",context),'Newest');assert(!element('daily-board').innerHTML.includes('OldName'));vm.runInContext('fetch=originalFetch',context);
 vm.runInContext("location.hash='#industries';selectIndustry('travel')",context);responseData.set('/api/industries/leaderboard?sector=travel',{entries:thousand,total:1500,matched:1500,limit:1000});await vm.runInContext('renderIndustries()',context);assert(element('industry-board').innerHTML.includes('第 1 / 20 页'));
 responseData.set('/api/industries/leaderboard?sector=travel&q=Juege',{entries:[outside],total:1500,matched:1,limit:1000});element('industry-board-query').value='Juege';await vm.runInContext("searchBoard('industry')",context);assert(element('industry-board').innerHTML.includes('总榜第 1204 名'));await vm.runInContext("searchBoard('industry',true)",context);assert(element('industry-board').innerHTML.includes('Player0001'));
 assert(fs.readFileSync(require.resolve('../index.html'),'utf8').includes('href="#daily" data-nav="daily"><span>♛</span> 排行榜'));
 console.log('PASS: permanent boards, original ranks, top 1000 in 50-row pages, global name searches and clearing, stale search protection, Beijing timestamps, safe names, independent attempts, route progress and legacy #daily links');
}
run().catch(error=>{console.error(error);process.exitCode=1});
