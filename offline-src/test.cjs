const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync('offline/app.js','utf8'),C=require('../core.js'),words=JSON.parse(fs.readFileSync('data/words.json')),examples=JSON.parse(fs.readFileSync('data/examples.json'));
const make=app.slice(app.indexOf('function makeQuestion('),app.indexOf('function startLevel('));
const queue=app.slice(app.indexOf('function buildQueue('),app.indexOf('function qBase('));
const c=vm.createContext({C,words,examples,session:null,missions:[]});vm.runInContext(make+queue,c);
for(let n=1;n<=2000;n++){c.session={type:'level',id:n,items:words.slice((n-1)*10,n*10)};vm.runInContext('buildQueue()',c);assert(c.session.queue.every(q=>q.type==='match'||q.options?.length===4),'touch-only level '+n);assert.equal(c.session.queue.reduce((a,q)=>a+(q.type==='match'?q.items.length:1),0),20);}
assert.equal(words.length,20000);assert.equal(Object.values(examples).reduce((n,v)=>n+v.length,0),40000);
for(const type of ['spell','spell-hint','cloze','order']){c.testType=type;assert.equal(vm.runInContext('makeQuestion(words[0],testType).type',c),'choice-en');}
console.log('PASS: 2000 levels, 20000 words, 40000 sentences; only touch choices/matching; no input questions');
