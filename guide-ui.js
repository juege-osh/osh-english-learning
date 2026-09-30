'use strict';
(function(){
 const KEY='english-quest-guide-read-v1';
 const steps=[
  {title:'先走通用主线',icon:'🧭',text:'不用选行业，也能直接练5,000、10,000或20,000词。先从你能坚持的目标开始。',tips:['闯关地图 → 选目标词量 → 第一关。每关先认识10个词，再答题。','建议每天15分钟：一关新词，再回练错词。练过不等于已经记牢。'],route:'map',link:'去闯关地图'},
  {title:'按自己的节奏刷题',icon:'⚡',text:'答题页有三种节奏，设置会记在当前浏览器。',tips:['慢刷 · 手动：适合第一次学，答完点继续。','速刷 · 立即：熟词复习，答对直接下一题。','延迟跳题：设置1～30秒，看绿色解释后换题。三种模式答错都会停。'],route:'map',link:'去试一关'},
  {title:'错词、例句和学习进度',icon:'🔁',text:'错词会在本轮补练，也能去复习营地单独练。',tips:['释义和例句默认收起，想细看时点展开；播放按钮可以听单词和句子。','我的词库可以查词；成就与分享可以导出进度。登录后能跨设备接着学。','蓝条是已练词量；稳定掌握需要不同日期反复答对。'],route:'review',link:'打开复习营地'},
  {title:'练你用得上的英语',icon:'✈️',text:'行业与考试里有程序员、AI创作、旅行等10条行业路线，以及7条学段与考试参考池。',tips:['选路线后可自由练习、句子选词、查词或练指定词，不影响通用主线进度。','音标速通：44项，每个声音两次都选对才通过。','语法速通：36点，每点选择题和填空各答对一次。建议基础不稳先学短规则。'],route:'industries',link:'选择专项路线'},
  {title:'榜单比自己的最好成绩',icon:'🏆',text:'永久榜不会每天清空。相同词量、相同专项分别排名。',tips:['每轮20题，可以重复挑战；正确数优先，同分比用时，保留最好成绩。','默认展示前1000名，每页50名；可以模糊搜索用户名或昵称，看实际名次和上榜时间。','20题挑战成绩与完整路线段位分别计算，先熟悉词库再冲榜。'],route:'daily',link:'打开永久榜'},
  {title:'找搭档，也能找对手',icon:'🤝',text:'单排是1对1，双排是两人协作，也能两队2对2竞技。',tips:['双方选相同词量开始匹配；段位最多差一阶。第一次建议选100词。','双排先创建队伍，把邀请码给搭档；指定朋友可建密码房，密码单独发。','好友页可加人、查看状态；匹配有动画和提示音，音效可一键关闭。'],route:'duo',link:'打开双排'},
  {title:'学习圈子与下一步',icon:'🌱',text:'刷词免费。聊天频道可以交流学习问题和网站建议。',tips:['注册后提交关注截图，站长审核通过可获得30天交流权益。','有权益后可查看学习群联系说明、预约连麦；预约需站长确认，不会自动开通通话。','先学音标或基础语法 → 每天一关新词与复习 → 练自己的专项 → 再参加竞技。'],route:'member',link:'查看交流权益'}
 ];
 let index=0,dialog=null,previousFocus=null;
 function read(){try{return localStorage.getItem(KEY)==='1';}catch{return false;}}
 function remember(){try{localStorage.setItem(KEY,'1');}catch{}document.getElementById('guide-welcome')?.remove();}
 function close(mark=true){if(mark)remember();dialog?.close();previousFocus?.focus?.({preventScroll:true});}
 function render(){
  const s=steps[index];dialog.innerHTML=`<header><span class="guide-symbol" aria-hidden="true">${s.icon}</span><div><small>新手指南 · ${index+1} / ${steps.length}</small><h2 id="guide-title">${s.title}</h2></div><button type="button" data-guide-close aria-label="关闭新手指南">×</button></header><div class="guide-body"><p>${s.text}</p><ul>${s.tips.map(t=>`<li>${t}</li>`).join('')}</ul><a class="guide-route" href="#${s.route}" data-guide-route>${s.link} ↗</a></div><footer class="guide-actions"><button type="button" class="ghost" data-guide-skip>跳过导航</button><div>${index?'<button type="button" class="ghost" data-guide-back>上一步</button>':''}<button type="button" class="primary" data-guide-next>${index===steps.length-1?'开始我的远征':'下一步'}</button></div></footer>`;
  dialog.querySelector('[data-guide-next]')?.focus({preventScroll:true});
 }
 function open(){previousFocus=document.activeElement;if(!dialog){dialog=document.createElement('dialog');dialog.id='newcomer-guide';dialog.className='guide-dialog';dialog.setAttribute('aria-labelledby','guide-title');document.body.append(dialog);dialog.addEventListener('cancel',remember);dialog.addEventListener('click',e=>{if(e.target===dialog)close();});}index=0;render();dialog.showModal();}
 function hint(){const app=document.getElementById('app');if(!app||read()||!['','#map'].includes(location.hash)||app.querySelector('.loading')||document.getElementById('guide-welcome'))return;const el=document.createElement('div');el.id='guide-welcome';el.className='guide-welcome';el.innerHTML='<div><strong>第一次来？先花一分钟认识路线。</strong><span>选词量、刷题节奏、复习与联机，都在新手指南里。</span></div><button type="button" data-guide-open>打开新手指南</button>';app.prepend(el);}
 document.addEventListener('click',e=>{const t=e.target.closest('[data-guide-open],[data-guide-close],[data-guide-skip],[data-guide-back],[data-guide-next],[data-guide-route]');if(!t)return;if(t.hasAttribute('data-guide-open'))open();else if(t.hasAttribute('data-guide-close')||t.hasAttribute('data-guide-skip'))close();else if(t.hasAttribute('data-guide-back')){index=Math.max(0,index-1);render();}else if(t.hasAttribute('data-guide-next')){if(index===steps.length-1)close();else{index++;render();}}else if(t.hasAttribute('data-guide-route'))close();});
 function init(){const bottom=document.querySelector('.sidebar-bottom');if(bottom&&!document.getElementById('guide-open')){const button=document.createElement('button');button.id='guide-open';button.type='button';button.className='guide-entry';button.setAttribute('data-guide-open','');button.textContent='ⓘ 新手指南';bottom.append(button);}const more=document.getElementById('nav-overflow');if(more&&!more.querySelector('[data-guide-open]')){const button=document.createElement('button');button.type='button';button.className='guide-entry';button.setAttribute('data-guide-open','');button.textContent='ⓘ 新手指南';more.append(button);}hint();const app=document.getElementById('app');if(app&&typeof MutationObserver!=='undefined')new MutationObserver(hint).observe(app,{childList:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.addEventListener('hashchange',()=>setTimeout(hint,0));
})();
