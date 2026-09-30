const assert=require('node:assert/strict'),C=require('../core.js'),words=require('../data/words.json'),missions=require('../data/scenarios.json'),examples=require('../data/examples.json'),industries=require('../data/industries.json');
let p=C.fresh();assert(C.validate(p));assert(C.unlocked(p,1));assert(!C.unlocked(p,2));
C.complete(p,'level',1,100);assert(C.unlocked(p,2));const xp=p.xp;C.complete(p,'level',1,100);assert.equal(p.xp,xp);
for(let n=2;n<=10;n++)C.complete(p,'level',n,100);assert(!C.unlocked(p,11));C.complete(p,'boss',10,80);assert(C.unlocked(p,11));
const start=new Date('2026-09-01T10:00:00Z').getTime();
for(let i=0;i<5;i++)C.record(p,1,true,true,start+i*100);assert.equal(p.words[1].days.length,1);assert(!C.mastered(p.words[1],start));
C.record(p,1,true,true,start+3*C.DAY);assert(!C.mastered(p.words[1],start+3*C.DAY));
C.record(p,1,true,true,start+7*C.DAY);assert(C.mastered(p.words[1],start+7*C.DAY));assert(!C.mastered(p.words[1],start+14*C.DAY));
C.record(p,1,false,false,start+8*C.DAY);assert(!C.mastered(p.words[1],start+8*C.DAY));assert.equal(p.words[1].days.length,0);assert(!p.words[1].production);
C.record(p,'p1',true,true,start);assert.equal(C.stats(p,start).learned,1);assert.equal(C.stats(p,start).phraseLearned,1);assert(C.validate(p));assert.equal(C.stats(p,start).wrongUnique,1);assert.equal(C.rank(0).name,'最强王者');assert.equal(C.rank(100).name,'王者');assert.equal(C.rank(101).name,'宗师');assert.equal(C.rank(5000).name,'白银');assert.equal(C.rank(5001).name,'青铜');assert.equal(C.rank(2500,5000).name,'白银');p.goal=5000;assert(C.validate(p));assert(!C.unlocked(p,501));p.goal=20000;assert(C.validate(p));
let corrupt=JSON.parse(JSON.stringify(p));corrupt.words['50000']=corrupt.words[1];assert(!C.validate(corrupt));corrupt=JSON.parse(JSON.stringify(p));corrupt.words[1].days=['bad'];assert(!C.validate(corrupt));
assert.equal(words.length,20000);assert.equal(new Set(words.map(w=>w.word)).size,20000);assert(words.every(w=>/^[a-z]+$/.test(w.word)&&w.zh&&w.full&&w.rank>0));assert(words.slice(103).every((w,i,a)=>i===0||w.rank>=a[i-1].rank));assert.equal(missions.length,12);assert.equal(missions.flatMap(m=>m.items).length,120);assert.equal(new Set(missions.flatMap(m=>m.items).map(w=>w.id)).size,120);
for(const m of missions)for(const w of m.items)assert(w.sentence.toLowerCase().includes(w.word.toLowerCase()));
assert.equal(words[143].zh,'将；会；愿意');assert.equal(words[203].zh,'嗯（犹豫时的语气词）');assert.equal(words[430].zh,'杀死；使停止');assert.equal(words[671].zh,'自然的；天生的');assert.equal(words[693].zh,'尽管');assert.equal(words[708].zh,'媒体');assert.equal(words[749].zh,'身体的；物理的');assert.equal(words[774].zh,'错过；想念');assert.equal(words[812].zh,'主要的');assert.equal(words[886].zh,'具体的；特定的');assert.equal(words[917].zh,'艰难的；坚强的');assert.equal(words[948].zh,'现代的');assert.equal(words[959].zh,'安全的；保险箱');assert.equal(words[1023].zh,'罗马数字二（II）');assert.equal(words[1060].zh,'史密斯（常见姓氏）；铁匠');assert(words.slice(0,1100).every(w=>!/^((n|v|vt|vi|a|adv|pron|prep|conj|abbr)\.)/.test(w.zh)));
assert.equal(Object.keys(examples).length,20000);assert(words.every(w=>examples[w.id]?.length===2));
for(const w of words.slice(0,1100))for(const item of examples[w.id]){
 assert(item.translation,'first-1100 sentence needs a Chinese translation');
 assert(new RegExp('\\b'+w.word+'\\b','i').test(item.text),'first-1100 sentence needs target word');
}
for(const w of words){const opts=C.choices(w,words.slice(Math.max(0,w.id-150),Math.min(words.length,w.id+150)),'zh');assert.equal(opts.length,4);assert.equal(new Set(opts.map(o=>o.zh)).size,4);assert(opts.some(o=>o.id===w.id));}
const expectedStart={programmer:'algorithm',foreign_trade:'export',finance:'asset',ai_creator:'prompt',marketing:'brand',healthcare:'patient',biology:'biology',law:'law',chemistry:'chemistry'};
for(const sector of industries.filter(x=>x.category==='industry')){
 const count=sector.id==='programmer'?683:700;assert.equal(sector.coreCount,sector.id==='programmer'?683:100);assert.equal(sector.wordIds.length,count);
 assert(Object.keys(sector.glosses).length>=100);
 assert(sector.wordIds.slice(0,sector.coreCount).every(id=>sector.glosses[id]));
 assert.equal(new Set(sector.wordIds).size,count);
 assert(sector.wordIds.every(id=>id>=1&&id<=20000));
 assert.equal(words[sector.wordIds[0]-1].word,expectedStart[sector.id]);
}
const programmer=industries.find(x=>x.id==='programmer');assert.equal(programmer.glosses[words.find(x=>x.word==='server').id],'服务器');
assert.equal(words[programmer.wordIds[100]-1].word,'download');
assert.equal(programmer.glosses[programmer.wordIds[100]],'下载');
const aiCreator=industries.find(x=>x.id==='ai_creator');assert.equal(words[aiCreator.wordIds[100]-1].word,'logo');
assert.equal(aiCreator.glosses[aiCreator.wordIds[100]],'标志设计');
assert.equal(Object.keys(programmer.glosses).length,683);assert.equal(Object.keys(programmer.examples).length,100);
for(const id of programmer.wordIds.slice(0,100)){assert.equal(programmer.examples[id].length,2);for(const ex of programmer.examples[id]){assert(ex.translation);assert(new RegExp('\\b'+words[id-1].word+'\\b','i').test(ex.text));}}
for(const wrong of ['mannequin','deixis','baseball','country','summer'])assert(!programmer.wordIds.some(id=>words[id-1].word===wrong));
console.log('PASS: 20,000 unique words, 120 phrases, 683 reviewed programmer words with 200 bilingual examples and eight labelled trial routes, unlock and boss gates, duplicate XP, cross-day mastery, failures, overdue reviews, import validation, 20,000 choice sets');
