(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EnglishCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAY=86400000;
const dayKey=(t=Date.now())=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const normalize=s=>String(s).toLowerCase().trim().replace(/[’‘]/g,"'").replace(/[.,!?;:]+$/,'').replace(/\s+/g,' ');
const shuffle=arr=>{let a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function fresh(){return {version:1,xp:0,goal:10000,pet:'cat',levels:{},bosses:{},missions:{},words:{},industries:{},days:{},dailyGoal:20};}
function goal(p){return [5000,10000,20000].includes(p.goal)?p.goal:10000;}
function unlocked(p,n){if(n===1)return true;if(n<1||n>goal(p)/10||!p.levels[n-1])return false;return (n-1)%10!==0||!!p.bosses[n-1];}
function mastered(r,now=Date.now()){return !!r&&r.days.length>=3&&r.production&&r.last-r.first>=7*DAY&&r.last>=r.failed&&r.due>now;}
function record(p,id,correct,production=false,now=Date.now()){
 const key=String(id),date=dayKey(now);let r=p.words[key]||{first:now,last:0,failed:0,days:[],production:false,due:now,wrong:0,seen:0};
 r.seen++;p.days[date]=(p.days[date]||0)+1;
 if(correct){r.last=now;if(!r.days.includes(date)){r.days.push(date);r.days=r.days.slice(-8);const intervals=[1,3,7,14,30];r.due=now+intervals[Math.min(r.days.length-1,4)]*DAY;}r.production=r.production||production;}
 else{r.failed=now;r.days=[];r.production=false;r.wrong++;r.due=now+10*60*1000;}
 p.words[key]=r;return r;
}
function complete(p,type,id,score){let table=type==='level'?p.levels:type==='boss'?p.bosses:p.missions;const first=!table[id];table[id]=Math.max(table[id]||0,score);if(first)p.xp+=type==='level'?100:type==='boss'?150:80;return first;}
function stats(p,now=Date.now()){const target=goal(p),records=Object.entries(p.words).filter(([k])=>/^\d+$/.test(k)&&+k<=target);return {learned:records.length,mastered:records.filter(([,v])=>mastered(v,now)).length,due:Object.values(p.words).filter(v=>v.due<=now).length,passed:Object.keys(p.levels).filter(k=>+k<=target/10).length,phraseLearned:Object.keys(p.words).filter(k=>k.startsWith('p')).length,wrongUnique:records.filter(([,v])=>v.wrong>0).length};}
function rank(wrong,target=10000){if(![5000,10000,20000].includes(target)||!Number.isSafeInteger(wrong)||wrong<0||wrong>target)throw Error('Invalid rank');if(wrong===0)return {name:'最强王者',stage:'',order:10};const bands=[{max:100,name:'王者',order:9},{max:200,name:'宗师',order:8},{max:500,name:'大师',order:7},{max:1000,name:'钻石',order:6},{max:2000,name:'翡翠',order:5},{max:3000,name:'铂金',order:4},{max:4000,name:'黄金',order:3},{max:5000,name:'白银',order:2},{max:10000,name:'青铜',order:1}];let low=1;for(const b of bands){const top=Math.round(b.max*target/10000);if(wrong<=top){const width=top-low+1,part=Math.min(2,Math.floor((top-wrong)*3/width));return {name:b.name,stage:['初级','中级','高级'][part],order:b.order};}low=top+1;}}
function validateBasics(value){
 if(value===undefined)return true;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['phonics','grammar'].includes(k)))return false;
 for(const [kind,records]of Object.entries(value)){
  if(!records||typeof records!=='object'||Array.isArray(records)||Object.keys(records).length>128)return false;
  for(const [id,r]of Object.entries(records)){
   if(!(kind==='phonics'?/^p(?:0[1-9]|[1-3]\d|4[0-4])$/.test(id):/^[a-z][a-z0-9-]{0,39}$/.test(id)&&!['constructor','prototype'].includes(id)))return false;
   if(!r||typeof r!=='object'||!Array.isArray(r.slots)||r.slots.length>2||new Set(r.slots).size!==r.slots.length||r.slots.some(x=>x!==0&&x!==1)||!['studiedAt','wrong','at'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0))return false;
  }
 }
 return true;
}
function basicEntry(p,kind,id){const records=p.basics?.[kind];return records&&Object.hasOwn(records,id)?records[id]:{studiedAt:0,slots:[],wrong:0,at:0};}
function studyBasic(p,kind,id,now=Date.now()){
 const entry={...basicEntry(p,kind,id),studiedAt:basicEntry(p,kind,id).studiedAt||now,at:now};
 if(!validateBasics({[kind]:{[id]:entry}}))return false;
 p.basics??={};p.basics[kind]??={};p.basics[kind][id]=entry;return true;
}
function recordBasic(p,kind,id,slot,correct,now=Date.now()){
 if(slot!==0&&slot!==1||typeof correct!=='boolean')return false;
 const old=basicEntry(p,kind,id),entry={...old,slots:old.slots.slice(),wrong:old.wrong+(correct?0:1),at:now};
 if(correct&&!entry.slots.includes(slot))entry.slots.push(slot);
 entry.slots.sort();if(!validateBasics({[kind]:{[id]:entry}}))return false;
 p.basics??={};p.basics[kind]??={};p.basics[kind][id]=entry;
 const day=dayKey(now);p.days[day]=(p.days[day]||0)+1;
 return true;
}
function mergeBasics(a={},b={}){
 const out={};for(const kind of ['phonics','grammar']){
  out[kind]={...(a[kind]||{}),...(b[kind]||{})};
  for(const id of Object.keys(out[kind])){const x=a[kind]?.[id],y=b[kind]?.[id];if(!x||!y)continue;const times=[x.studiedAt,y.studiedAt].filter(Boolean);out[kind][id]={studiedAt:times.length?Math.min(...times):0,slots:[...new Set([...x.slots,...y.slots])].sort(),wrong:Math.max(x.wrong,y.wrong),at:Math.max(x.at,y.at)};}
 }return out;
}
function validate(p){
 if(!p||p.version!==1||!Number.isSafeInteger(p.xp)||p.xp<0||p.xp>450000||!(p.goal===undefined||[5000,10000,20000].includes(p.goal))||!(p.pet===undefined||['cat','dog','rabbit','mouse','hamster','fox','bear','panda','koala','tiger','lion','wolf','monkey','pig','cow','sheep','horse','unicorn','deer','giraffe','elephant','zebra','hippo','rhino','camel','kangaroo','sloth','otter','hedgehog','squirrel','raccoon','snake','turtle','frog','crocodile','penguin','owl','duck','swan','peacock','chick','fish','dolphin','whale','octopus','crab','butterfly','bee','ladybug','dragon'].includes(p.pet)))return false;
 for(const key of ['levels','bosses','missions','words','days'])if(!p[key]||typeof p[key]!=='object'||Array.isArray(p[key]))return false;
 if(Object.keys(p.words).length>20120||Object.keys(p.levels).length>2000)return false;
 for(const [id,r] of Object.entries(p.words))if(!/^(?:[1-9]\d{0,3}|1\d{4}|20000|p(?:[1-9]\d?|1[01]\d|120))$/.test(id)||!r||!Array.isArray(r.days)||r.days.length>8||r.days.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d))||new Set(r.days).size!==r.days.length||!['first','last','due','failed','wrong','seen'].every(k=>Number.isFinite(r[k])&&r[k]>=0)||typeof r.production!=='boolean')return false;
 for(const [id,score]of Object.entries(p.levels))if(!/^\d+$/.test(id)||+id<1||+id>2000||!Number.isFinite(score)||score<80||score>100)return false;
 for(const [id,score]of Object.entries(p.bosses))if(!/^\d+$/.test(id)||+id<10||+id>2000||+id%10!==0||!Number.isFinite(score)||score<80||score>100)return false;
 for(const[id,score]of Object.entries(p.missions))if(!/^(dev|ai|travel)0[1-4]$/.test(id)||!Number.isFinite(score)||score<80||score>100)return false;
 for(const [key,count]of Object.entries(p.days))if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!Number.isSafeInteger(count)||count<0)return false;
 return [10,20,30,50].includes(p.dailyGoal)&&validateBasics(p.basics);
}
function choices(w,pool,field){const correct=w[field];const different=shuffle(pool.filter(v=>v.id!==w.id&&v[field]&&v[field]!==correct));const out=[w],seen=new Set([correct]);for(const v of different){if(!seen.has(v[field])){out.push(v);seen.add(v[field]);}if(out.length===4)break;}return shuffle(out);}
return {DAY,dayKey,normalize,shuffle,fresh,goal,unlocked,mastered,record,complete,stats,rank,validate,choices,validateBasics,basicEntry,studyBasic,recordBasic,mergeBasics};
});
