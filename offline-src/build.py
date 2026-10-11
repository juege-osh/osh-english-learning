from pathlib import Path
import re,json,hashlib,shutil
root=Path(__file__).resolve().parents[1];out=root/'offline';out.mkdir(exist_ok=True)
shutil.copy2(root/'offline-src/install.js',out/'install.js')
for name in ['core.js','run-controls.js','game-effects.js','game-effects.css','app-icon.svg']:
 shutil.copy2(root/name,out/name)
css=(root/'style.css').read_text();css=re.sub(r'@import[^;]+;','',css);css+='\n.offline-banner{background:#eee8ff;padding:12px 18px;border-radius:14px;margin:12px 0;color:#3e2875}.offline-banner button{margin:6px}.offline-banner small{display:block}body{padding-top:env(safe-area-inset-top)}body:has(.exercise) .offline-banner{display:none}[data-nav="industries"],[data-nav="basics"]{display:none!important}\n';(out/'style.css').write_text(css)
w=json.loads((root/'data/words.json').read_text());ex=json.loads((root/'data/examples.json').read_text());assert len(w)==20000
(out/'vocabulary.js').write_text('window.OfflineVocabulary='+json.dumps({'words':w,'examples':ex},ensure_ascii=False,separators=(',',':'))+';\n')
s=(root/'app.js').read_text().replace("KEY='english-quest-progress-v1'","KEY='english-quest-offline-progress-v1'")
s=s.replace("const PRACTICE_MODE_KEY='english-quest-practice-mode',PRACTICE_DELAY_KEY='english-quest-practice-delay-seconds'","const PRACTICE_MODE_KEY='english-quest-offline-practice-mode',PRACTICE_DELAY_KEY='english-quest-offline-practice-delay-seconds'")
route="""function route(){if(typeof mainRunRouteLeaving==='function')mainRunRouteLeaving();practiceAutoCancel();if(!loaded)return;session=null;const path=location.hash.slice(1).split('?')[0]||'map';const names={map:'闯关地图',review:'复习营地',words:'我的词库',profile:'进度与备份',about:'玩法与来源'};document.getElementById('page-title').textContent=names[path]||names.map;document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===path));header();({map:renderMap,review:renderReview,words:renderWords,profile:renderProfile,about:renderAbout}[path]||renderMap)();window.scrollTo({top:0});}"""
s=re.sub(r'^function route\(\).*$',lambda m:route,s,flags=re.M)
init="""async function init(){try{const raw=localStorage.getItem(KEY);if(raw){const candidate=JSON.parse(raw);if(C.validate(candidate))p=candidate;}else p.goal=20000;}catch{storageOK=false;}words=OfflineVocabulary.words;examples=OfflineVocabulary.examples;all=new Map(words.map(w=>[String(w.id),w]));if(words.length!==20000)throw Error('词库不完整');loaded=true;mapChapter=Math.ceil(currentLevel()/100);mapPage=Math.floor(((currentLevel()-1)%100)/20);route();}"""
s=re.sub(r'^async function init\(\).*$',lambda m:init,s,flags=re.M).replace('init();',"document.addEventListener('DOMContentLoaded',init);")
s=s.replace("if(p.friendName)friendSync('idle').catch(()=>{});",'')
s=s.replace("function makeQuestion(w,type){", "function makeQuestion(w,type){if(['spell','spell-hint','cloze','order'].includes(type))type='choice-en';")
s=s.replace('if(chapter<=2){const unique=', 'if(true){const unique=')
s=s.replace('连线 · 选左边、右边，再按空格确认','连线 · 选左边、右边，再点确认')
s=s.replace('方向键或点击答案：第一次选中，空格确认；再按同一方向也可确认。','点一下选中，再点同一答案确认；也可点下方确认按钮。')
start=s.index('<h2>难度怎么递进</h2>');end=s.index('<h2>什么才算稳定掌握</h2>',start)
s=s[:start]+'<h2>手机题型</h2><p>全部关卡使用选择题与连线题，不需要输入拼写。进度保存在当前设备，可导出备份。</p>'+s[end:]

s=re.sub(r'<section class="panel"><h3>去你的世界里练</h3>.*?</section>', '', s)
(out/'app.js').write_text(s)
(out/'run-controls.js').write_text((out/'run-controls.js').read_text().replace('english-quest-main-checkpoint-v1','english-quest-offline-main-checkpoint-v1'))
h=(root/'index.html').read_text();h=re.sub(r'<script\b.*?</script>','',h,flags=re.S);h=re.sub(r'<link[^>]+(?:rel="stylesheet"|rel="manifest")[^>]*>','',h)
h=h.replace('</head>','<link rel="stylesheet" href="./style.css"><link rel="stylesheet" href="./game-effects.css"><link rel="manifest" href="./manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="离线英语"><script src="./vocabulary.js" defer></script><script src="./core.js" defer></script><script src="./app.js" defer></script><script src="./run-controls.js" defer></script><script src="./game-effects.js" defer></script><script src="./install.js" defer></script></head>')
h=re.sub(r'<a[^>]+data-nav="(?:industries|basics|daily|race|duo|friends|chat|member|scenes|tools)"[^>]*>.*?</a>','',h)
h=h.replace('英语远征 · 1,000到20,000词闯关','离线英语 · 20,000词').replace('注册后进度可跨设备同步，也可在“成就与分享”备份。','离线版 · 进度只保存在此设备，请定期在“成就与分享”导出备份。').replace('进度保存在此设备 · 登录后可跨设备同步','进度保存在此设备 · 可导出备份')
h=h.replace('<main id="app"', '<section class="offline-banner" id="offline-install"><strong id="offline-status">正在准备离线保存…</strong><small>先添加到主屏幕，再从桌面打开，等显示“离线包完整”后开启飞行模式试用。</small><button id="offline-retry" type="button">检查离线包</button><small>首次下载需要联网；刷题、词义、例句和进度可离线使用。朗读取决于手机已下载的系统语音。</small></section><main id="app"')
(out/'index.html').write_text(h)
(out/'manifest.webmanifest').write_text(json.dumps({'id':'/offline/','name':'英语远征离线版','short_name':'离线英语','lang':'zh-CN','start_url':'./#map','scope':'./','display':'standalone','background_color':'#f6f7fb','theme_color':'#7357ef','icons':[{'src':'./app-icon.svg','sizes':'any','type':'image/svg+xml'}]},ensure_ascii=False))
files=sorted(p.name for p in out.iterdir() if p.is_file() and not p.name.startswith('.') and p.name not in ['sw.js','manifest.json','install.js'])+['install.js']
(out/'manifest.json').write_text(json.dumps({'words':len(w),'example_entries':len(ex),'files':files},ensure_ascii=False,indent=2))
print('built',len(w),'words',len(ex),'example entries')
# Installation UI is source-controlled; regenerate integrity-bound worker last.
assets=[{'name':n,'sha256':hashlib.sha256((out/n).read_bytes()).hexdigest()} for n in files]
version=hashlib.sha256(json.dumps(assets).encode()).hexdigest()[:16]
sw=(root/'offline-src/sw-template.js').read_text().replace('__VERSION__',json.dumps(version)).replace('__ASSETS__',json.dumps(assets))
(out/'sw.js').write_text(sw)
print('offline cache version',version,'assets',len(assets))
