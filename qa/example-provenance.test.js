'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
// Exercise the actual renderer and escape helper without starting the app's network/DOM bootstrap.
const escapeLine=source.split('\n').find(line=>line.startsWith('const esc='));
const renderer=source.slice(source.indexOf('function wordExamples('),source.indexOf('\nfunction renderStudy'));
assert(escapeLine&&renderer.startsWith('function wordExamples('));
const ctx={examples:{}};vm.createContext(ctx);vm.runInContext(escapeLine+'\n'+renderer,ctx);
const render=(item,w={id:701})=>ctx.wordExamples(w,[item]);
let cases=0;
const base={id:26648,text:'It is wrong to tell a lie.',author:'CK',translation:'说谎不好。',translationId:343586,translationAuthor:'fucongcong'};
{
 const html=render(base);assert(html.includes('Tatoeba · CK'));assert(html.includes('译文 · fucongcong'));assert(html.includes('/show/26648"'));assert(html.includes('/show/343586"'));assert(!html.includes('已校订'));assert(!html.includes('简体转换'));cases++;
}
{
 const item={...base,translation:'说谎是不对的。',translationEdited:'本站校订',translationOriginal:base.translation,translationAdapted:'OpenCC t2s'};
 const before=JSON.stringify(item),html=render(item);assert(html.includes('<em>说谎是不对的。</em>'));assert(html.includes('原译 · fucongcong'));assert(html.includes('译文已校订'));assert(html.includes('简体转换'));assert(html.includes('Tatoeba · CK'));assert.equal(JSON.stringify(item),before,'render must preserve attribution and original text metadata');cases++;
}
{
 const html=render({...base,translationAdapted:'OpenCC t2s'});assert(html.includes('译文 · fucongcong'));assert(html.includes('简体转换'));assert(!html.includes('已校订'));cases++;
}
{
 const item={...base,text:'Time is short; we must act NOW.',textEdited:'本站校订',textOriginal:'Time is short, we must act NOW.'};const before=JSON.stringify(item),html=render(item);assert(html.includes('英文已校订'));assert(html.includes('Tatoeba · CK'));assert(html.includes('/show/26648"'));assert(html.includes('译文 · fucongcong'));assert(!html.includes('译文已校订'));assert.equal(JSON.stringify(item),before);cases++;
}
{
 for(const source of ['original','dialogue','wiktionary']){
  const html=render({...base,source,word:'lie',translationEdited:'本站校订',textEdited:'本站校订'});assert(!html.includes('tatoeba.org'));assert(!html.includes('已校订'));assert(!html.includes('原译 ·'));assert(html.includes(source==='wiktionary'?'Simple Wiktionary 例句':'本站编写'));
 }cases++;
}
{
 const html=render({...base,text:'<img src=x onerror="alert(1)">',translation:'<script>alert(2)</script>',author:'<svg onload="alert(3)">',translationAuthor:'" onclick="alert(4)',translationEdited:'<script>evil</script>'});
 assert(html.includes('&lt;img'));assert(html.includes('&lt;script&gt;'));assert(html.includes('&lt;svg'));assert(html.includes('&quot; onclick=&quot;'));assert(!/<(?:img|script|svg)\b/i.test(html));assert(!html.includes('evil'));cases++;
}
{
 const html=render({...base,id:'1" onmouseover="alert(1)',translationId:'343586" onclick="alert(2)',translationEdited:'本站校订'});assert(!html.includes('tatoeba.org'));assert(!html.includes('已校订'));assert(html.includes('来源未标明'));assert(!html.includes('onmouseover'));cases++;
}
{
 ctx.examples['701']=[base];assert.equal(ctx.wordExamples({id:701}),render(base));assert.equal(ctx.wordExamples({id:702}),'');ctx.StudyTools={isFavorite:()=>true};const html=render({...base,translationEdited:'本站校订',textEdited:'本站校订'});assert(html.includes('译文已校订'));assert(html.includes('英文已校订'));assert(html.includes('data-study-sentence="701:0"'));assert(html.includes('★'));cases++;
}
console.log(`PASS: ${cases} real-renderer provenance cases (original/edited attribution, independent OpenCC, safe HTML and IDs, no metadata mutations, original sources and favorites)`);
