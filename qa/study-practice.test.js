'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Practice = require('../study-practice.js');
const { makeAdvance, makeSpeech, canonicalMode, clampDelay } = Practice._test;
function fakeClock() {
  let now = 0, counter = 0;
  const jobs = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) { const id = ++counter; jobs.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    jobs,
    tick(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...jobs.entries()].filter(([, job]) => job.at <= target).sort((a,b) => a[1].at-b[1].at)[0];
        if (!due) break;
        const [id, job] = due; now = job.at; jobs.delete(id); job.fn();
      }
      now = target;
    }
  };
}
assert(Practice.grade('  ＨＥＬＬＯ! ', 'hello', 'word'));
assert(Practice.grade('“Hello!”', 'hello', 'word'));
assert(Practice.grade("'hello'", 'hello', 'word'));
assert(Practice.grade('I don’t know!', "I don't know.", 'sentence'));
assert(Practice.grade('Well I think so', 'Well, I think so.', 'sentence'));
assert(Practice.grade('Wait listen to me', 'Wait—listen to me.', 'sentence'));
assert(Practice.grade('I work in the US', 'I work in the U.S.', 'sentence'));
assert(!Practice.grade('I work in the 35 lab.', 'I work in the 3.5 lab.', 'sentence'),'decimal numbers must stay meaningful');
assert(!Practice.grade('I dont know', "I don't know.", 'sentence'),'missing contraction apostrophe is not accepted');
assert(!Practice.grade('I know', 'I do not know.', 'sentence'),'omitted words must not pass');
assert(!Practice.grade('the dog bit me', 'the dog bit him', 'sentence'));
assert(!Practice.grade('part time', 'part-time', 'word'));
assert(Practice.grade('C++','C++','word'));
assert(!Practice.grade('C','C++','word'));
assert(!Practice.grade('C#','C++','word'));
assert(!Practice.grade('', '', 'sentence'));
assert.equal(canonicalMode('immediate'),'fast');
assert.equal(canonicalMode('manual'),'slow');
assert.equal(clampDelay(30),30);
assert.equal(clampDelay(0),3);
assert.equal(clampDelay(31),3);
assert.equal(clampDelay(1.5),3);
const timer = fakeClock(), advance = makeAdvance(timer);
let advanced = 0;
assert.equal(advance.schedule(true,'slow',3,() => advanced++),false);
assert.equal(timer.jobs.size,0);
assert.equal(advance.schedule(false,'fast',3,() => advanced++),false);
assert.equal(timer.jobs.size,0,'wrong answers must wait');
advance.schedule(true,'fast',3,() => advanced++);
assert.equal(advanced,0,'history can be saved before fast-mode advancement');
timer.tick(0); assert.equal(advanced,1);
let countdown = [];
advance.schedule(true,'delay',3,() => advanced++,() => true,left => countdown.push(left));
timer.tick(2000); assert.equal(advanced,1); assert.deepEqual(countdown,[3,2,1]);
const staleTimer = [...timer.jobs.values()][0].fn;
advance.cancel(); staleTimer(); timer.tick(1000); assert.equal(advanced,1,'cancel invalidates even an already queued callback');
advance.schedule(true,'delay',1,() => advanced++);
advance.schedule(true,'delay',2,() => advanced++);
timer.tick(1000); assert.equal(advanced,1); timer.tick(1000); assert.equal(advanced,2,'rescheduling replaces a previous countdown');
let current = false;
advance.schedule(true,'fast',1,() => advanced++,() => current); timer.tick(0); assert.equal(advanced,2,'leaving the session blocks advancement');
const speechClock = fakeClock(), spoken = [], events = [];
class Utterance { constructor(text) { this.text = text; } }
const synth = { cancelCount: 0, cancel(){this.cancelCount++;}, getVoices:() => [{lang:'en-GB',name:'British'},{lang:'en-US',name:'American'}], speak(u){spoken.push(u);} };
const player = makeSpeech({synth,Utterance,...speechClock});
player.play('hello',{loops:3,accent:'en-GB',rate:0.65},event => events.push(event));
assert.equal(spoken[0].lang,'en-GB'); assert.equal(spoken[0].rate,0.65); assert.equal(spoken[0].voice.name,'British');
spoken[0].onend(); speechClock.tick(649); assert.equal(spoken.length,1); speechClock.tick(1); assert.equal(spoken.length,2);
spoken[1].onend(); speechClock.tick(650); assert.equal(spoken.length,3); spoken[2].onend(); speechClock.tick(2000);
assert.equal(spoken.length,3); assert.equal(events.at(-1).state,'done');
player.play('first',{loops:3}); const staleEnd = spoken.at(-1).onend;
player.play('second',{loops:1}); staleEnd(); speechClock.tick(1000); assert.equal(spoken.at(-1).text,'second');
spoken.at(-1).onend(); assert.equal(speechClock.jobs.size,0);
player.play('cancel during pause',{loops:3}); spoken.at(-1).onend(); const before = spoken.length;
player.stop(); speechClock.tick(1000); assert.equal(spoken.length,before,'stopping a loop must cancel its next playback');
player.play('broken',{loops:3}); spoken.at(-1).onerror(); speechClock.tick(2000); assert.equal(spoken.at(-1).text,'broken','errors must not repeat indefinitely');
let unsupported;
assert.equal(makeSpeech({...fakeClock()}).play('hello',{},event => unsupported=event.state),false);
assert.equal(unsupported,'unsupported');
console.log('PASS: normalization preserves contractions/numbers/word order; manual/fast/delayed advancement, stale timer cancellation, 1/3 playback and stale utterance cancellation.');

async function browserTests() {
  const {chromium} = require('playwright');
  const launch = {headless:true};
  if (process.env.SP_CHROME_PATH) launch.executablePath = process.env.SP_CHROME_PATH;
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[]; page.on('pageerror',error => errors.push(error.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><aside class="sidebar"><nav><a href="#map">地图</a><a href="#tools">工具</a></nav></aside><div class="shell"><header class="topbar"><div><strong>学习工具</strong></div></header><div class="journey-progress">全局进度</div><main id="app"></main></div>');
    await page.addStyleTag({path:path.join(__dirname,'../style.css')});
    await page.addStyleTag({path:path.join(__dirname,'../study-ui.css')});
    await page.addStyleTag({path:path.join(__dirname,'../study-practice.css')});
    await page.evaluate(() => {
      window.settings={practiceMode:'slow',practiceDelay:1,accent:'en-GB',speechRate:0.65,loops:1};
      window.historyLog=[]; window.favorites=new Set(); window.homeCount=0; window.spoken=[]; window.trackStops=0;
      window.StudyTools={
        getSetting:(name,fallback)=>window.settings[name]??fallback,
        setSetting:(name,value)=>window.settings[name]=value,
        record:(item,kind,result)=>window.historyLog.push({item,kind,result}),
        isFavorite:(item,kind)=>window.favorites.has(kind+':'+item.id),
        favorite:(item,kind)=>{const key=kind+':'+item.id;window.favorites.has(key)?window.favorites.delete(key):window.favorites.add(key);},
        home:()=>window.homeCount++
      };
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices:()=>[{lang:'en-GB'}],speak(u){window.spoken.push(u);}}});
      window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
      const stream=()=>({getTracks:()=>[{stop:()=>window.trackStops++}]});
      window.mockStream=stream;
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.resolve(stream())}});
      window.MediaRecorder=class {
        static isTypeSupported(type){return type==='audio/webm';}
        constructor(s){this.stream=s;this.state='inactive';this.mimeType='audio/webm';}
        start(){this.state='recording';}
        stop(){if(this.state==='inactive')throw Error('Already stopped');this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['mock recorded data'],{type:this.mimeType})});this.onstop?.();},0);}
      };
      window.items=[{id:'a',en:'hello',zh:'你好'},{id:'b',en:'world',zh:'世界'}];
    });
    await page.addScriptTag({path:path.join(__dirname,'../study-practice.js')});
    await page.evaluate(()=>StudyPractice.render(items,'word',{autoplay:false}));
    assert.equal(await page.locator('.sp-card').innerText().then(text=>text.includes('你好')),false,'pure dictation must conceal the translation');
    assert.equal(await page.locator('.sp-english').count(),0);
    await page.locator('[data-sp-input]').fill('hello');
    await page.locator('[data-sp-input]').dispatchEvent('keydown',{key:'Enter',isComposing:true});
    assert.equal(await page.evaluate(()=>historyLog.length),0,'composition Enter cannot grade');
    await page.locator('[data-sp-input]').dispatchEvent('compositionstart');
    await page.locator('[data-sp-input]').dispatchEvent('keydown',{key:'Enter'});
    assert.equal(await page.evaluate(()=>historyLog.length),0);
    await page.locator('[data-sp-input]').dispatchEvent('compositionend');
    await page.locator('[data-sp-input]').dispatchEvent('keydown',{key:'Enter'});
    assert.equal(await page.evaluate(()=>historyLog.length),0,'IME commit must not act as a second Enter');
    await page.waitForTimeout(170);
    await page.locator('[data-sp-input]').press('Enter');
    assert.equal(await page.evaluate(()=>historyLog.length),1);
    await page.locator('[data-sp-check]').evaluate(el=>el.click());
    assert.equal(await page.evaluate(()=>historyLog.length),1,'repeat submission cannot record twice');
    assert(await page.locator('[data-sp-feedback]').innerText().then(text=>text.includes('你好')));
    await page.locator('[data-sp-next]').press('Enter');
    await page.locator('[data-sp-input]').fill('wrong'); await page.locator('[data-sp-check]').click();
    assert(await page.locator('[data-sp-feedback]').innerText().then(text=>text.includes('world')&&text.includes('世界')));
    await page.setViewportSize({width:1366,height:620});
    const feedback=await page.locator('[data-sp-feedback]').boundingBox(),actionBar=await page.locator('.sp-actions').boundingBox();
    assert(feedback.y+feedback.height<=actionBar.y,'checked feedback must fit above actions on a short desktop viewport');
    await page.waitForTimeout(120); assert.equal(await page.evaluate(()=>historyLog.length),2);
    await page.locator('[data-sp-next]').click();
    assert(await page.locator('.sp-results').innerText().then(text=>text.includes('答对 1 / 2')));
    await page.locator('[data-sp-action="retry"]').click();
    assert(await page.locator('.sp-progress').innerText().then(text=>text.includes('第 1 / 1')));
    await page.locator('[data-sp-input]').fill('world'); await page.locator('[data-sp-input]').press('Alt+r');
    assert.equal(await page.evaluate(()=>spoken.at(-1).text),'world');
    await page.locator('[data-sp-action="favorite"]').click();
    assert.equal(await page.locator('[data-sp-favorite]').getAttribute('aria-pressed'),'true');
    // Fast mode records before advancing, and wrong answers remain visible.
    await page.evaluate(()=>{settings.practiceMode='fast';historyLog=[];StudyPractice.render(items,'word',{autoplay:false});});
    await page.locator('[data-sp-input]').fill('hello');await page.locator('[data-sp-check]').click();
    await page.waitForFunction(()=>document.querySelector('.sp-progress').textContent.includes('第 2 / 2'));
    assert.equal(await page.evaluate(()=>historyLog.length),1);
    await page.locator('[data-sp-input]').fill('bad');await page.locator('[data-sp-check]').click();await page.waitForTimeout(120);
    assert.equal(await page.locator('[data-sp-next]').isEnabled(),true);assert.equal(await page.locator('.sp-results').count(),0);
    // Delayed mode's manual Continue cancels the previous item's timer.
    await page.evaluate(()=>{settings.practiceMode='delay';settings.practiceDelay=1;StudyPractice.render(items,'word',{autoplay:false});});
    await page.locator('[data-sp-input]').fill('hello');await page.locator('[data-sp-check]').click();
    assert(await page.locator('[data-sp-countdown]').innerText().then(text=>text.includes('1 秒')));
    await page.locator('[data-sp-next]').click();await page.waitForTimeout(1100);
    assert.equal(await page.locator('[data-sp-input]').isEnabled(),true);assert.equal(await page.locator('.sp-results').count(),0);
    // Bilingual cards and self-marked shadowing do not claim automatic pronunciation scores.
    await page.evaluate(()=>{settings.practiceMode='slow';StudyPractice.render(items,'word',{mode:'cards',autoplay:false});});
    assert.equal(await page.locator('.sp-english').innerText(),'hello');assert.equal(await page.locator('.sp-chinese').innerText(),'你好');
    await page.locator('[data-sp-value="fuzzy"]').click();
    assert.equal(await page.evaluate(()=>historyLog.at(-1).result.recognition),'fuzzy');
    assert.equal(await page.evaluate(()=>historyLog.at(-1).result.correct),false);
    await page.evaluate(()=>StudyPractice.render([{id:'s',en:'I like tea.',zh:'我喜欢茶。'}],'sentence',{mode:'shadowing',autoplay:false}));
    assert.equal(await page.locator('[data-sp-action="token"]').count(),3);
    await page.locator('[data-sp-token="1"]').click();assert.equal(await page.evaluate(()=>spoken.at(-1).text),'like');
    await page.locator('[data-sp-action="record"]').click();await page.waitForFunction(()=>document.querySelector('[data-sp-action="record"]').textContent==='停止录音');
    await page.locator('[data-sp-action="record"]').click();await page.waitForSelector('[data-sp-record-audio]');
    assert.equal(await page.evaluate(()=>trackStops),1);
    assert(await page.locator('.sp-card').innerText().then(text=>text.includes('没有自动评分')));
    await page.locator('[data-sp-value="known"]').click();assert.equal(await page.evaluate(()=>historyLog.at(-1).result.mode),'shadowing');
    // Permission resolution after departure must immediately release the newly granted stream.
    await page.evaluate(()=>{StudyPractice.render(items,'word',{mode:'shadowing',autoplay:false});navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.resolveMic=resolve);});
    await page.locator('[data-sp-action="record"]').click();
    await page.evaluate(()=>{StudyPractice.destroy();resolveMic(mockStream());});await page.waitForTimeout(50);
    assert.equal(await page.evaluate(()=>trackStops),2);
    // Answer feedback remains open on phones; primary controls fit above the existing bottom nav.
    for (const viewport of [{width:390,height:700},{width:320,height:568},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(()=>StudyPractice.render(items,'word',{autoplay:false}));
      assert.equal(await page.locator('.journey-progress').isVisible(),false,'exercise hides the global journey strip');
      for(const action of ['check','replay','next','home']) {
        const box=await page.locator(`[data-sp-action="${action}"]`).first().boundingBox();
        assert(box&&box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height-78,`${action} must stay within the phone viewport above its bottom navigation`);
      }
    }
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    assert.equal(await page.locator('.sp-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(36, 44, 61)');
    await page.evaluate(()=>{document.documentElement.dataset.theme='';settings.practiceMode='slow';window.savedHandle=StudyPractice.render(items,'word',{autoplay:false});document.getElementById('app').replaceChildren();});
    await page.waitForTimeout(20);
    assert.equal(await page.evaluate(()=>savedHandle.check('hello')),false,'replacing the host container destroys the old session');
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.resolve(mockStream());StudyPractice.render(items,'word',{mode:'shadowing',autoplay:false});});
    await page.locator('[data-sp-action="record"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-sp-action="record"]').textContent==='停止录音');
    await page.evaluate(()=>location.hash='#left-practice');await page.waitForTimeout(30);
    assert.equal(await page.evaluate(()=>trackStops),3,'leaving the route must stop an active microphone');
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));StudyPractice.render(items,'word',{mode:'shadowing',autoplay:false});});
    await page.locator('[data-sp-action="record"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-sp-record-status]').textContent.includes('权限没有开启'));
    await page.locator('[data-sp-action="home"]').first().click();
    assert.equal(await page.evaluate(()=>homeCount),1,'the top return button calls the host');
    await page.evaluate(()=>StudyPractice.destroy());assert.deepEqual(errors,[]);
    console.log('PASS: browser dictation/feedback/retry, IME/repeat-submit, favorites, fast/delay behavior, cards/recognition, word-by-word shadowing, mocked recording and late permission cleanup, mobile action visibility.');
    if(process.env.SP_LIVE_URL) await liveTests(browser);
  } finally {await browser.close();}
}

async function liveTests(browser) {
  const url = new URL(process.env.SP_LIVE_URL);
  assert(['127.0.0.1','localhost'].includes(url.hostname),'live tests are restricted to an isolated local service');
  const output = process.env.SP_EVIDENCE_DIR || path.join(__dirname,'../state/evidence-v1310');
  fs.mkdirSync(output,{recursive:true});
  const context = await browser.newContext({viewport:{width:1366,height:620},serviceWorkers:'block'});
  const page = await context.newPage(), errors = [];
  if(process.env.SP_LOCAL_ASSETS==='1') {
    for(const file of ['study-practice.js','study-practice.css']) await page.route('**/'+file+'*',route=>route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/css',body:fs.readFileSync(path.join(__dirname,'..',file),'utf8')}));
  }
  page.on('pageerror',error=>errors.push(error.message));
  const evidence={url:url.origin+'/#tools',at:new Date().toISOString(),boundaries:'Isolated local test account. Real host UI/store/API; speech synthesis and microphone device behavior are simulated in module tests. No real voice quality or microphone hardware acceptance claimed.',localModuleOverlay:process.env.SP_LOCAL_ASSETS==='1',checks:[],screenshots:[]};
  const capture=async name=>{await page.screenshot({path:path.join(output,name),fullPage:false});evidence.screenshots.push(name);};
  const actionsVisible=async(width,height)=>{
    const result={viewport:{width,height},buttons:{}};
    for(const action of ['replay','check','next','home']){
      const el=page.locator(`[data-sp-action="${action}"]`).first();
      if(!await el.count())continue;
      const b=await el.boundingBox();result.buttons[action]=b;
      assert(b&&b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height-(width<=680?78:0),action+' must be visible on the live host');
    }
    evidence.checks.push(result);
  };
  try {
    await page.addInitScript(()=>{
      window.spoken=[];
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices:()=>[{lang:'en-US'},{lang:'en-GB'}],speak(u){window.spoken.push({text:u.text,lang:u.lang,rate:u.rate});setTimeout(()=>u.onend?.(),10);}}});
      window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
    });
    await page.goto(url.origin+'/#tools');
    await page.waitForSelector('[data-st="practice"]',{timeout:45000});
    await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
    const account=await page.evaluate(async()=>{
      const name='spqa_'+crypto.randomUUID().slice(0,12).replaceAll('-','');
      const password=crypto.randomUUID()+crypto.randomUUID();
      const response=await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,password})});
      if(!response.ok)throw Error('Test registration failed: '+response.status);
      await progressStart();StudyTools.render('words');
      return {name,status:response.status};
    });
    evidence.account=account;
    const initial=await page.evaluate(()=>({xp:p.xp,learned:C.stats(p).learned}));
    await page.evaluate(()=>{setPracticeMode('slow');StudyTools.setSetting('batchSize',5);StudyTools.setSetting('loops',1);});
    await page.locator('[data-st="practice"]').click();
    assert.equal(await page.locator('.journey-progress').isVisible(),false);
    await page.locator('[data-sp-input]').fill('qa wrong spelling');
    await page.locator('[data-sp-check]').click();
    const wrong=await page.evaluate(()=>({entry:StudyTools.get('word:1'),error:StudyTools.get('error:word:1')}));
    assert.equal(wrong.entry.seen,1);assert.equal(wrong.error.resolved,false);assert.equal(wrong.error.typed,'qa wrong spelling');
    assert(await page.locator('[data-sp-feedback]').innerText().then(t=>t.includes('hello')&&t.includes('你好')));
    evidence.hostWrong={seen:wrong.entry.seen,wrong:wrong.entry.wrong,errorResolved:wrong.error.resolved,typed:wrong.error.typed};
    await actionsVisible(1366,620);
    const feedbackBox=await page.locator('[data-sp-feedback]').boundingBox(),actionsBox=await page.locator('.sp-actions').boundingBox();
    assert(feedbackBox.y+feedbackBox.height<=actionsBox.y,'desktop feedback must fit fully above its action bar');
    evidence.desktopFeedbackFullyVisible=true;
    await capture('study-practice-word-feedback-desktop.png');
    await page.locator('[data-sp-next]').click();
    await page.locator('.sp-settings summary').click();
    await page.locator('[data-sp-setting="practiceMode"]').selectOption('fast');
    await page.locator('[data-sp-input]').fill('world');await page.locator('[data-sp-check]').click();
    await page.waitForFunction(()=>document.querySelector('.sp-progress').textContent.includes('第 3 / 5'));
    const passed=await page.evaluate(()=>StudyTools.get('word:2'));assert.equal(passed.seen,1);assert.equal(passed.recognition,'known');
    evidence.hostFastCorrect={seen:passed.seen,recognition:passed.recognition};
    await page.locator('.sp-settings summary').click();
    await page.locator('[data-sp-setting="loops"]').selectOption('3');
    await page.locator('[data-sp-setting="accent"]').selectOption('en-GB');
    await page.locator('[data-sp-setting="speechRate"]').selectOption('0.65');
    await page.evaluate(()=>spoken=[]);await page.locator('[data-sp-action="replay"]').click();
    await page.waitForTimeout(1450);
    const spoken=await page.evaluate(()=>window.spoken);
    assert.equal(spoken.length,3);assert(spoken.every(u=>u.lang==='en-GB'&&u.rate===0.65));
    assert.equal(await page.evaluate(()=>StudyTools.getSetting('loops')),3);
    evidence.speechSettings={loops:spoken.length,accent:spoken[0].lang,rate:spoken[0].rate,simulation:true};
    await page.locator('[data-sp-action="favorite"]').click();assert.equal(await page.evaluate(()=>StudyTools.get('word:3').favorite),true);
    await page.waitForTimeout(3600);
    await page.setViewportSize({width:390,height:844});
    await actionsVisible(390,844);await capture('study-practice-word-mobile.png');
    await page.evaluate(()=>StudyTools.setSetting('theme','dark'));
    await capture('study-practice-word-mobile-dark.png');
    assert.equal(await page.locator('.sp-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(36, 44, 61)');
    await page.locator('[data-sp-action="home"]').first().click();
    await page.locator('[data-st-tab="sentences"]').click();
    const sentence=await page.locator('.st-item strong').first().innerText();
    await page.evaluate(()=>{setPracticeMode('slow');StudyTools.setSetting('loops',1);});
    await page.locator('[data-st="practice"]').click();await page.locator('[data-sp-input]').fill(sentence);await page.locator('[data-sp-check]').click();
    const sentences=await page.evaluate(()=>StudyTools.list('sentence:').map(x=>x.value));
    assert(sentences.some(v=>v.item.en===sentence&&v.recognition==='known'));
    evidence.sentenceHostSaved=true;await actionsVisible(390,844);await capture('study-practice-sentence-feedback-mobile.png');
    const after=await page.evaluate(()=>({xp:p.xp,learned:C.stats(p).learned}));assert.deepEqual(after,initial);evidence.mainProgressUnchanged=true;
    await page.evaluate(()=>StudyTools.flush());
    const sync=await page.evaluate(async()=>{const r=await fetch('/api/study');const d=await r.json();return {status:r.status,revision:d.revision,first:StudyCore.get(d.study,'word:1'),second:StudyCore.get(d.study,'word:2')};});
    assert.equal(sync.status,200);assert.equal(sync.first.seen,1);assert.equal(sync.second.seen,1);evidence.cloudHost={status:sync.status,revision:sync.revision,firstSeen:sync.first.seen,secondSeen:sync.second.seen};
    await page.locator('[data-sp-action="home"]').first().click();
    assert.equal(await page.locator('.study-tools').count(),1,'returning shows the host tools');
    assert.equal(await page.locator('.study-practice').count(),0);
    await page.evaluate(()=>location.hash='#map');
    await page.waitForSelector('.level-path');
    assert.equal(await page.locator('.journey-progress').isVisible(),true,'leaving tools restores the global progress strip');
    evidence.returnRestoresLayout=true;
    assert.deepEqual(errors,[]);evidence.pageErrors=errors;evidence.status='PASS';
    evidence.sourceHashes={};
    const crypto=require('node:crypto');
    for(const file of ['study-practice.js','study-practice.css','qa/study-practice.test.js'])evidence.sourceHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex');
    fs.writeFileSync(path.join(output,'study-practice-live-checks.json'),JSON.stringify(evidence,null,2));
    console.log('PASS: real isolated Host recording/errors/favorites/sentence history/account sync, unchanged main progress, 1366x620 and 390x844 actions, dark theme and return layout; persisted screenshots and JSON.');
  } catch(error) {
    evidence.status='FAIL';evidence.error=error.message;evidence.pageErrors=errors;
    await capture('study-practice-live-failure.png').catch(()=>{});
    fs.writeFileSync(path.join(output,'study-practice-live-checks.json'),JSON.stringify(evidence,null,2));throw error;
  } finally {await context.close();}
}

if(process.env.SP_BROWSER==='1') browserTests().catch(error=>{console.error(error);process.exitCode=1;});
