(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.StudyCore=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_BYTES=6*1024*1024,MAX_ENTRIES=30000,MAX_IMPORT=2000,MAX_DEPTH=64;
const PREFIXES=['book:','word:','sentence:','day:','error:','setting:'];
const SETTING_NAMES=new Set(['theme','accent','speechRate','rate','loops','repeat','sort','translation','shuffle','view','batchSize','practiceMode','practiceDelay']);
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>!!o&&typeof o==='object'&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
function byteLength(s){
  if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(s).length;
  let n=0;for(const c of s){const v=c.codePointAt(0);n+=v<128?1:v<2048?2:v<65536?3:4;}return n;
}
function safeProperty(k){return !FORBIDDEN.has(k);}
function validKey(key){
  return typeof key==='string'&&byteLength(key)<=256&&PREFIXES.some(p=>key.startsWith(p)&&key.length>p.length)&&
    !/[\u0000-\u001f\u007f]/.test(key)&&key.split(/[:./\\]/).every(safeProperty)&&(!key.startsWith('setting:')||SETTING_NAMES.has(key.slice(8)));
}
function fields(o){
  if(!plain(o)||Object.getOwnPropertySymbols(o).length)return null;
  const d=Object.getOwnPropertyDescriptors(o),keys=Object.keys(d);
  if(keys.some(k=>!safeProperty(k)||!own(d[k],'value')||!d[k].enumerable))return null;
  return keys;
}
function jsonValue(value,depth=0,ancestors=new Set(),budget={nodes:0}){
  if(++budget.nodes>1000000||depth>MAX_DEPTH)return false;
  if(value===null||typeof value==='boolean'||typeof value==='string')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='object'||ancestors.has(value))return false;
  ancestors.add(value);let ok=true;
  if(Array.isArray(value)){
    if(Object.getPrototypeOf(value)!==Array.prototype||Object.getOwnPropertySymbols(value).length||value.length>1000000)ok=false;
    const d=Object.getOwnPropertyDescriptors(value);
    if(Object.keys(d).length!==value.length+1)ok=false;
    for(let i=0;ok&&i<value.length;i++)if(!own(d,String(i))||!own(d[i],'value')||!d[i].enumerable||!jsonValue(d[i].value,depth+1,ancestors,budget))ok=false;
  }else{
    const keys=fields(value);if(!keys)ok=false;
    else for(const k of keys)if(!jsonValue(value[k],depth+1,ancestors,budget)){ok=false;break;}
  }
  ancestors.delete(value);return ok;
}
function exactFields(o,expected){const keys=fields(o);return !!keys&&keys.length===expected.length&&expected.every(k=>own(o,k));}
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function allowedFields(value,allowed){const keys=fields(value);return !!keys&&keys.every(k=>allowed.includes(k));}
function validItem(item,kind){
  return exactFields(item,['id','en','zh'])&&text(item.id,240,true)&&validKey(kind+':'+item.id)&&text(item.en,kind==='word'?200:2000,true)&&text(item.zh,2000);
}
function validSetting(name,value){
  if(name==='theme')return ['light','dark','system'].includes(value);
  if(name==='accent')return ['en-US','en-GB','en-AU'].includes(value);
  if(name==='speechRate'||name==='rate')return typeof value==='number'&&Number.isFinite(value)&&value>=.5&&value<=1.5;
  if(name==='loops'||name==='repeat')return value===1||value===3;
  if(name==='sort')return ['original','az','za','recent'].includes(value);
  if(name==='translation'||name==='shuffle')return typeof value==='boolean';
  if(name==='view')return ['list','grid'].includes(value);
  if(name==='batchSize')return Number.isInteger(value)&&value>=5&&value<=100;
  if(name==='practiceMode')return ['slow','fast','delay'].includes(value);
  if(name==='practiceDelay')return Number.isInteger(value)&&value>=1&&value<=30;
  return false;
}
function businessValue(key,value){
  const kind=key.slice(0,key.indexOf(':'));
  if(kind==='setting')return validSetting(key.slice(8),value);
  if(kind==='book')return allowedFields(value,['name','kind','category','description','items'])&&text(value.name,80,true)&&['word','sentence'].includes(value.kind)&&(!own(value,'category')||text(value.category,60))&&(!own(value,'description')||text(value.description,500))&&Array.isArray(value.items)&&value.items.length>=1&&value.items.length<=MAX_IMPORT&&value.items.every(item=>validItem(item,value.kind));
  if(kind==='word'||kind==='sentence')return allowedFields(value,['item','favorite','recognition','note','first','last','seen','wrong'])&&validItem(value.item,kind)&&(!own(value,'favorite')||typeof value.favorite==='boolean')&&(!own(value,'recognition')||['known','fuzzy','unknown'].includes(value.recognition))&&(!own(value,'note')||text(value.note,2000))&&['first','last','seen','wrong'].every(k=>!own(value,k)||nonnegative(value[k]));
  if(kind==='day')return exactFields(value,['kind','item','at','correct'])&&['word','sentence'].includes(value.kind)&&validItem(value.item,value.kind)&&nonnegative(value.at)&&(typeof value.correct==='boolean'||value.correct===null);
  if(kind==='error')return exactFields(value,['kind','item','typed','at','count','resolved'])&&['word','sentence'].includes(value.kind)&&validItem(value.item,value.kind)&&text(value.typed,2000)&&nonnegative(value.at)&&nonnegative(value.count)&&typeof value.resolved==='boolean';
  return false;
}
function validRecord(key,r,budget={nodes:0}){
  return allowedFields(r,['at','value','deleted'])&&own(r,'at')&&own(r,'deleted')&&Number.isSafeInteger(r.at)&&r.at>=0&&typeof r.deleted==='boolean'&&(!own(r,'value')||jsonValue(r.value,0,new Set(),budget))&&(r.deleted||(own(r,'value')&&businessValue(key,r.value)));
}
function validate(doc){
  try{
    if(!exactFields(doc,['version','entries'])||doc.version!==1||!fields(doc.entries))return false;
    const keys=Object.keys(doc.entries);if(keys.length>MAX_ENTRIES)return false;
    const budget={nodes:0};
    for(const key of keys){
      if(!validKey(key))return false;
      const r=doc.entries[key];
      if(!validRecord(key,r,budget))return false;
    }
    return byteLength(JSON.stringify(doc))<=MAX_BYTES;
  }catch(_){return false;}
}
function fresh(){return {version:1,entries:{}};}
function clone(value){return JSON.parse(JSON.stringify(value));}
function requireDoc(doc){if(!validate(doc))throw new Error('学习资料格式有误或内容过多。');}
function requireKey(key){if(!validKey(key))throw new Error('这条记录的编号无效。');}
function get(doc,key,fallback=null){
  requireKey(key);
  // Readers validate only the requested record. A sort may perform thousands of
  // lookups; the full document is checked on loading, writes and merges.
  if(!exactFields(doc,['version','entries'])||doc.version!==1||!plain(doc.entries))throw new Error('学习资料格式有误。');
  const descriptor=Object.getOwnPropertyDescriptor(doc.entries,key);
  if(!descriptor)return fallback;
  if(!own(descriptor,'value')||!descriptor.enumerable)throw new Error('学习记录格式有误。');
  const r=descriptor.value;
  if(!validRecord(key,r))throw new Error('学习记录格式有误。');
  return !r.deleted?clone(r.value):fallback;
}
function put(doc,key,value,deleted,now){
  requireDoc(doc);requireKey(key);
  if(!Number.isSafeInteger(now)||now<0)throw new Error('记录时间无效。');
  if(!jsonValue(value))throw new Error('记录只能包含普通 JSON 数据。');
  if(!deleted&&!businessValue(key,value))throw new Error('词句或设置格式有误，请检查后重试。');
  const record={at:now,value:clone(value),deleted},old=own(doc.entries,key)?doc.entries[key]:null;
  if(!old&&Object.keys(doc.entries).length>=MAX_ENTRIES)throw new Error('记录已达到 30000 条上限。');
  // Check a shallow candidate first so a rejected update leaves the document intact.
  const candidate={version:1,entries:Object.assign({},doc.entries,{[key]:record})};
  if(!validate(candidate))throw new Error('学习资料超过了 6MB 上限。');
  doc.entries[key]=record;return doc;
}
function set(doc,key,value,now=Date.now()){return put(doc,key,value,false,now);}
function remove(doc,key,now=Date.now()){return put(doc,key,null,true,now);}
function list(doc,prefix=''){
  requireDoc(doc);
  if(typeof prefix!=='string'||(prefix!==''&&!PREFIXES.some(p=>prefix.startsWith(p))))throw new Error('记录类别无效。');
  return Object.keys(doc.entries).filter(k=>k.startsWith(prefix)&&!doc.entries[k].deleted).sort().map(key=>({key,...clone(doc.entries[key])}));
}
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(plain(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function merge(a,b){
  requireDoc(a);requireDoc(b);const out=fresh();
  for(const key of [...new Set([...Object.keys(a.entries),...Object.keys(b.entries)])].sort()){
    const x=own(a.entries,key)?a.entries[key]:null,y=own(b.entries,key)?b.entries[key]:null;let winner=x||y;
    if(x&&y){
      if(x.at!==y.at)winner=x.at>y.at?x:y;
      else if(x.deleted!==y.deleted)winner=x.deleted?x:y;
      else winner=canonical(x.value??null)>=canonical(y.value??null)?x:y;
    }
    out.entries[key]={at:winner.at,value:JSON.parse(canonical(winner.value??null)),deleted:winner.deleted};
  }
  requireDoc(out);return out;
}
function parseImport(text,kind){
  const result={items:[],errors:[],duplicates:0,truncated:false};
  const fail=(row,message)=>{if(result.errors.length<100)result.errors.push({row,message});};
  if(kind!=='word'&&kind!=='sentence'){fail(0,'请选择单词或句子导入。');return result;}
  if(typeof text!=='string'){fail(0,'导入内容必须是文字。');return result;}
  if(byteLength(text)>MAX_BYTES){fail(0,'导入文件超过了 6MB 上限。');return result;}
  text=text.replace(/^\uFEFF/,'').trim();if(!text)return result;
  const seen=new Set();let excess=false;
  function add(value,row){
    let en,zh='';
    if(typeof value==='string')en=value;
    else if(Array.isArray(value)&&value.length>=1&&value.length<=2){en=value[0];zh=value.length===2?value[1]:'';}
    else if(plain(value)){
      if(!jsonValue(value)){fail(row,'这一行包含不支持的字段。');return;}
      en=value.en??value.english??value[kind==='word'?'word':'sentence'];
      zh=value.zh??value.chinese??value.translation??value.meaning??'';
    }else{fail(row,'这一行需要英文和可选的中文。');return;}
    if(typeof en!=='string'||typeof zh!=='string'){fail(row,'英文和中文都必须是文字。');return;}
    en=en.trim();zh=zh.trim();
    if(!en){fail(row,'英文内容不能为空。');return;}
    if(en.length>(kind==='word'?200:2000)||zh.length>2000){fail(row,'这一行太长，请拆分后再导入。');return;}
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(en+zh)){fail(row,'这一行包含无法识别的控制字符。');return;}
    const key=en.toLowerCase().replace(/\s+/g,' ');
    if(seen.has(key)){result.duplicates++;return;}
    seen.add(key);
    if(result.items.length>=MAX_IMPORT){excess=true;result.truncated=true;return;}
    result.items.push({en,zh});
  }
  if(text[0]==='['||text[0]==='{'){
    try{
      const values=JSON.parse(text);
      if(!Array.isArray(values)){fail(0,'JSON 文件的最外层需要是数组。');return result;}
      values.forEach((v,i)=>add(v,i+1));
    }catch(_){fail(0,'JSON 格式有误，请检查引号和逗号。');}
  }else{
    // Find delimiters in the first logical row, ignoring quoted fields.
    let first='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){first+='"';i++;continue;}quoted=!quoted;}
      if((c==='\n'||c==='\r')&&!quoted)break;first+=c;
    }
    const tab=first.includes('\t');
    const comma=first.includes(',')&&(kind==='word'||first.startsWith('"')||/^(?:en|english|word|sentence|英文|单词|句子)\s*,/i.test(first)||/,[^,]*[\u3400-\u9fff]/.test(first));
    const delimiter=tab?'\t':comma?',':null;
    if(!delimiter){text.split(/\r\n|\n|\r/).forEach((v,i)=>{if(v.trim())add(v,i+1);});}
    else{
      const rows=delimitedRows(text,delimiter),headerNames=new Set(['en','english','word','sentence','英文','单词','句子']);
      rows.forEach((r,i)=>{
        if(r.error){fail(r.row,r.error);return;}
        if(r.cells.every(c=>!c.trim()))return;
        if(i===0&&headerNames.has(r.cells[0].trim().toLowerCase())&&(r.cells.length===1||/^(?:zh|chinese|translation|meaning|中文|释义)$/i.test(r.cells[1].trim())))return;
        add(r.cells,r.row);
      });
    }
  }
  if(excess)fail(0,'最多导入 2000 条，超出的内容未导入。');
  return result;
}
function delimitedRows(text,delimiter){
  const rows=[];let cells=[],field='',quoted=false,closed=false,error='',row=1,start=1;
  const finishField=()=>{cells.push(field);field='';closed=false;};
  const finishRow=()=>{finishField();rows.push({cells,row:start,error});cells=[];error='';start=row+1;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;field+='\n';row++;}
      else field+=c;
    }else if(c===delimiter)finishField();
    else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();row++;start=row;}
    else if(c==='"'&&!field&&!closed)quoted=true;
    else if(closed){if(c!==' '&&c!=='\t')error='结束引号后有多余内容。';}
    else{if(c==='"')error='引号位置有误。';field+=c;}
  }
  if(quoted)error='这一行缺少结束引号。';
  if(field||cells.length||closed||error)finishRow();
  return rows;
}
return {MAX_BYTES,MAX_ENTRIES,MAX_IMPORT,fresh,get,set,remove,list,merge,validate,parseImport};
});
