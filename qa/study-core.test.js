'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../study-core.js');
const item=(en='hello',id='1',zh='你好')=>({id,en,zh});
const word=(en='hello',extra={})=>({item:item(en),...extra});
const document=(key,value,at=100,deleted=false)=>({version:1,entries:{[key]:{at,value,deleted}}});
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
function sizedDocument(limit){
 const doc=C.fresh();let n=bytes(doc),i=0;
 while(n<limit){
  const key='word:'+i,record={at:0,value:{item:item('hello',String(i),''),note:''},deleted:false};
  let base=bytes(key)+1+bytes(record)+(i?1:0),left=limit-n;
  if(left<base){const previous=doc.entries['word:'+(i-1)].value;previous.note=previous.note.slice(0,previous.note.length-(base-left));n=bytes(doc);left=limit-n;}
  const fill=Math.min(4000,left-base);record.value.item.zh='x'.repeat(Math.min(2000,fill));record.value.note='x'.repeat(Math.max(0,fill-2000));
  doc.entries[key]=record;n+=base+fill;i++;
 }
 assert.equal(bytes(doc),limit);return doc;
}
const d=C.fresh();assert(C.validate(d));assert.deepEqual(d,{version:1,entries:{}});
assert.equal(C.get(d,'word:missing','fallback'),'fallback');
const value=word('hello',{note:'my note',seen:1});assert.equal(C.set(d,'word:1',value,100),d);
value.item.zh='outside';assert.equal(C.get(d,'word:1').item.zh,'你好');
const detached=C.get(d,'word:1');detached.item.en='outside';assert.equal(C.get(d,'word:1').item.en,'hello');
C.set(d,'book:z',{name:'Travel',kind:'word',items:[item()]},150);C.set(d,'book:a',{name:'Everyday',kind:'sentence',category:'Daily',description:'My sentences',items:[item('Come in.')]},150);
assert.deepEqual(C.list(d,'book:').map(r=>r.key),['book:a','book:z']);
C.remove(d,'word:1',200);assert.equal(C.get(d,'word:1','gone'),'gone');assert.equal(C.list(d,'word:').length,0);
assert.deepEqual(d.entries['word:1'],{at:200,value:null,deleted:true});
assert.equal(C.merge(d,document('word:1',word('old'),199)).entries['word:1'].deleted,true);
assert.equal(C.merge(d,document('word:1',word('new'),201)).entries['word:1'].deleted,false);
const a=document('word:1',{item:{id:'1',en:'hello',zh:'你好'},seen:2,wrong:1},300),b=document('word:1',{wrong:1,seen:2,item:{zh:'你好',en:'hello',id:'1'}},300);
assert.equal(JSON.stringify(C.merge(a,b)),JSON.stringify(C.merge(b,a)));
const x=document('word:1',word('apple'),400),y=document('word:1',word('pear'),400),z=document('word:1',null,400,true);
assert.deepEqual(C.merge(x,y),C.merge(y,x));assert.deepEqual(C.merge(C.merge(x,y),z),C.merge(x,C.merge(y,z)));assert(C.merge(x,z).entries['word:1'].deleted);
assert.deepEqual(C.merge(x,x),x);
const tomb={version:1,entries:{'book:gone':{at:500,deleted:true}}};assert(C.validate(tomb));assert.equal(C.merge(tomb,C.fresh()).entries['book:gone'].value,null);
for(const key of ['__proto__','constructor','word:__proto__','book:x.constructor','sentence:prototype','word:','bad:1','media:clip','setting:apiKey','word:x\n','word:'+('你'.repeat(100))]){
 assert(!C.validate(document(key,word())),key);assert.throws(()=>C.set(C.fresh(),key,word(),1));
}
for(const invalid of [null,[],{version:2,entries:{}},{version:1,entries:[]},{version:1,entries:{},extra:true},Object.create({version:1,entries:{}})])assert(!C.validate(invalid));
for(const bad of [undefined,NaN,Infinity,1n,()=>1,new Date(),new Uint8Array([1]),JSON.parse('{"constructor":1}'),JSON.parse('{"nested":{"__proto__":{}}}')])assert(!C.validate(document('book:deleted',bad,1,true)));
const cyclic={};cyclic.self=cyclic;assert(!C.validate(document('book:deleted',cyclic,1,true)));
const sparse=new Array(2);assert(!C.validate(document('book:deleted',sparse,1,true)));
let accessed=0;const getter={};Object.defineProperty(getter,'item',{enumerable:true,get(){accessed++;return item();}});assert(!C.validate(document('word:1',getter)));assert.equal(accessed,0);
const badRecord=document('word:1',word());badRecord.entries['word:1'].at=Number.MAX_SAFE_INTEGER+1;assert(!C.validate(badRecord));
for(const at of [-1,0.5,NaN])assert.throws(()=>C.set(C.fresh(),'word:1',word(),at));
let deep='x';for(let i=0;i<65;i++)deep=[deep];assert(!C.validate(document('book:deleted',deep,1,true)));
const full=C.fresh();for(let i=0;i<C.MAX_ENTRIES;i++)full.entries['word:'+i]={at:0,value:{item:item('word',String(i))},deleted:false};
assert(C.validate(full));assert.throws(()=>C.set(full,'word:extra',word(),0));assert.equal(Object.keys(full.entries).length,C.MAX_ENTRIES);full.entries['word:extra']={at:0,value:word(),deleted:false};assert(!C.validate(full));
const near=sizedDocument(C.MAX_BYTES);assert(C.validate(near));const last=Object.keys(near.entries).at(-1);near.entries[last].value.note+='x';assert(!C.validate(near));
const intact=C.fresh();assert.throws(()=>C.set(intact,'word:1',word('hello',{note:'x'.repeat(2001)}),1));assert.deepEqual(intact,C.fresh());
const nonnegativeCases=[{seen:-1},{wrong:Infinity},{last:'10'},{first:NaN},{favorite:1},{recognition:'maybe'},{note:undefined}];
for(const extra of nonnegativeCases)assert(!C.validate(document('word:1',word('hello',extra))));
for(const badBook of [{},{name:' ',kind:'word',items:[item()]},{name:'Book',kind:'wrong',items:[item()]},{name:'Book',kind:'word',items:[]},{name:'Book',kind:'word',items:[{en:'hello',zh:'你好'}]},{name:'Book',kind:'word',items:[item('x'.repeat(201))]},{name:'Book',kind:'sentence',items:[item('x'.repeat(2001))]},{name:'Book',kind:'word',category:'x'.repeat(61),items:[item()]},{name:'Book',kind:'word',description:'x'.repeat(501),items:[item()]},{name:'Book',kind:'word',items:Array.from({length:2001},()=>item())}])assert(!C.validate(document('book:1',badBook)));
assert(!C.validate(document('word:1',{item:{...item(),extra:1}})));assert(!C.validate(document('word:1',word('hello',{extra:1}))));
assert(!C.validate(document('word:1',{item:item('hello','constructor')})));
assert(!C.validate(document('word:1',{item:item('hello','你'.repeat(100))})));
assert(C.validate(document('sentence:1',{item:item('A'.repeat(2000)),recognition:'fuzzy',note:'',seen:0,wrong:0})));
const day={kind:'word',item:item(),at:1,correct:null},error={kind:'sentence',item:item('Come in.'),typed:'Come on.',at:1,count:1,resolved:false};
assert(C.validate(document('day:2026-10-02:word:1',day)));assert(C.validate(document('error:sentence:1',error)));
assert(!C.validate(document('day:1',{...day,correct:undefined})));assert(!C.validate(document('day:1',{...day,correct:'true'})));
assert(!C.validate(document('error:word:1',{...error,count:-1})));assert(!C.validate(document('error:word:1',{...error,resolved:'yes'})));
for(const [name,value]of Object.entries({theme:'system',accent:'en-AU',speechRate:.5,rate:1.5,loops:1,repeat:3,sort:'recent',translation:true,shuffle:false,view:'grid',batchSize:100,practiceMode:'delay',practiceDelay:30}))assert(C.validate(document('setting:'+name,value)),name);
for(const [name,value]of [['theme','sepia'],['accent','zh-CN'],['speechRate',.49],['rate',2],['loops',2],['repeat','3'],['sort','random'],['translation',1],['shuffle','false'],['view','cards'],['batchSize',4],['batchSize',5.5],['practiceMode','automatic'],['practiceDelay',31],['practiceDelay',.5]])assert(!C.validate(document('setting:'+name,value)),name);

let imported=C.parseImport('\ufeffen,zh\r\n"Hello, world.","你好，世界。"\r\n"Say ""hello"".\nThen leave.","说你好，再离开。"','sentence');
assert.equal(imported.errors.length,0);assert.deepEqual(imported.items,[{en:'Hello, world.',zh:'你好，世界。'},{en:'Say "hello".\nThen leave.',zh:'说你好，再离开。'}]);
imported=C.parseImport('英文\t中文\nhello\t你好\n"I am here.\nYou can leave."\t"我在这里。\n你可以走了。"','sentence');assert.equal(imported.items.length,2);assert.equal(imported.items[1].en,'I am here.\nYou can leave.');assert.equal(imported.errors.length,0);
imported=C.parseImport('Hello, world.\nPlease sit down.','sentence');assert.equal(imported.items[0].en,'Hello, world.');assert.equal(imported.items[0].zh,'');
imported=C.parseImport('hello,你好\nbye,再见','word');assert.equal(imported.items[1].zh,'再见');
imported=C.parseImport('[{"en":"hello","zh":"你好"},["bye","再见"],"thanks",{"word":"welcome","meaning":"欢迎"}]','word');assert.equal(imported.items.length,4);assert.equal(imported.items[3].en,'welcome');
imported=C.parseImport('[{"sentence":"Come in.","translation":"进来。"}]','sentence');assert.equal(imported.items[0].zh,'进来。');
imported=C.parseImport('hello\n HELLO \nbye','word');assert.equal(imported.items.length,2);assert.equal(imported.duplicates,1);
imported=C.parseImport('[{"en":"hello","constructor":"bad"},null,{"en":3},{"en":""},{"en":"good","zh":"好"}]','word');assert.equal(imported.errors.length,4);assert.equal(imported.items[0].en,'good');
assert(C.parseImport('{"en":"hello"}','word').errors.length);assert(C.parseImport('[broken','word').errors.length);assert(C.parseImport('hello','bad').errors.length);assert(C.parseImport('x'.repeat(C.MAX_BYTES+1),'word').errors.length);
imported=C.parseImport('en,zh\n"broken,你好','word');assert.equal(imported.items.length,0);assert.equal(imported.errors[0].row,2);
imported=C.parseImport('en,zh\n"good"junk,好\nvalid,有效','word');assert.equal(imported.items.length,1);assert.equal(imported.errors[0].row,2);
imported=C.parseImport(Array.from({length:2001},(_,i)=>'word'+i).join('\n'),'word');assert.equal(imported.items.length,2000);assert(imported.truncated);assert(imported.errors.length);
imported=C.parseImport(JSON.stringify(Array.from({length:200},()=>null)),'word');assert.equal(imported.errors.length,100);assert.deepEqual(C.parseImport(' \n\t','sentence').items,[]);
const browser={};vm.createContext(browser);vm.runInContext(fs.readFileSync(path.join(__dirname,'../study-core.js'),'utf8'),browser);assert.equal(vm.runInContext('StudyCore.validate(StudyCore.fresh())',browser),true);
assert.equal(vm.runInContext('StudyCore.set(StudyCore.fresh(), "word:browser", {item:{id:"browser",en:"hello",zh:"你好"}}, 1).entries["word:browser"].value.item.zh',browser),'你好');
console.log('PASS: study schemas, deterministic merge, tombstones, prototype/size limits, import formats and browser UMD');
