/* Standalone study tools: dictation, bilingual cards and self-reviewed shadowing. */
(function (global) {
  'use strict';
  const MODES = ['dictation', 'cards', 'shadowing'];
  const RECOGNITION = ['known', 'fuzzy', 'unknown'];
  let active = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clampDelay = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 30 ? Number(value) : 3;
  const canonicalMode = value => ({ manual: 'slow', immediate: 'fast', delayed: 'delay' }[value] || (['slow', 'fast', 'delay'].includes(value) ? value : 'slow'));
  function normalize(value, kind = 'word') {
    let text = String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[’‘ʼ]/g, "'").replace(/[‐‑]/g, '-').replace(/[–—]/g, kind === 'sentence' ? ' ' : '-').trim();
    // Dictation checks words and their order; case, typography and sentence punctuation do not count as mistakes.
    // Apostrophes, hyphens, plus signs and hashes remain meaningful (can't, part-time, C++, C#).
    text = text.replace(/^["“”]+|["“”]+$/g, '');
    if (text.startsWith("'") && text.endsWith("'") && text.length > 2) text = text.slice(1, -1);
    text = text.replace(/[.!?。！？]+$/g, '');
    if (kind === 'sentence') {
      text = text.replace(/[,;:"“”()[\]{}，；：]/g, ' ');
      text = text.replace(/\./g, (dot, index, source) => /\d/.test(source[index - 1] || '') && /\d/.test(source[index + 1] || '') ? dot : '');
    }
    return text.replace(/\s+/g, ' ').trim();
  }
  function grade(typed, expected, kind) {
    const answer = normalize(typed, kind);
    return answer !== '' && answer === normalize(expected, kind);
  }
  function makeAdvance(clock) {
    let timer = null, epoch = 0;
    const cancel = () => { epoch++; if (timer !== null) clock.clearTimeout(timer); timer = null; };
    const schedule = (correct, mode, delay, next, valid = () => true, update = () => {}) => {
      cancel();
      mode = canonicalMode(mode);
      if (!correct || mode === 'slow') return false;
      const token = epoch;
      const deadline = clock.now() + (mode === 'fast' ? 0 : clampDelay(delay) * 1000);
      const tick = () => {
        timer = null;
        if (token !== epoch || !valid()) return;
        const left = Math.max(0, Math.ceil((deadline - clock.now()) / 1000));
        update(left);
        if (left === 0) { next(); return; }
        timer = clock.setTimeout(tick, Math.min(1000, Math.max(1, deadline - clock.now())));
      };
      update(mode === 'fast' ? 0 : clampDelay(delay));
      timer = clock.setTimeout(tick, mode === 'fast' ? 0 : Math.min(1000, clampDelay(delay) * 1000));
      return true;
    };
    return { cancel, schedule };
  }
  function makeSpeech(env) {
    let epoch = 0, pause = null, utterance = null;
    const stop = () => {
      epoch++;
      if (pause !== null) env.clearTimeout(pause);
      pause = null;
      if (utterance) { utterance.onend = null; utterance.onerror = null; }
      utterance = null;
      try { env.synth?.cancel(); } catch (_) {}
    };
    const play = (text, settings = {}, update = () => {}) => {
      stop();
      if (!env.synth || !env.Utterance) { update({ state: 'unsupported' }); return false; }
      const token = epoch, loops = Number(settings.loops) === 3 ? 3 : 1;
      const accent = ['en-US', 'en-GB', 'en-AU'].includes(settings.accent) ? settings.accent : 'en-US';
      const rate = Math.min(1.5, Math.max(0.5, Number(settings.rate) || 0.82));
      let count = 0;
      const speakOne = () => {
        if (token !== epoch) return;
        count++;
        const u = new env.Utterance(String(text));
        utterance = u; u.lang = accent; u.rate = rate;
        const voices = env.synth.getVoices?.() || [];
        const voice = voices.find(v => v.lang?.toLowerCase() === accent.toLowerCase()) || voices.find(v => /^en[-_]/i.test(v.lang));
        if (voice) u.voice = voice;
        const fallback = Boolean(voice && voice.lang?.toLowerCase() !== accent.toLowerCase());
        update({ state: 'speaking', count, loops, fallback });
        u.onend = () => {
          if (token !== epoch || utterance !== u) return;
          utterance = null;
          if (count < loops) {
            update({ state: 'pause', count, loops, fallback });
            pause = env.setTimeout(() => { pause = null; speakOne(); }, 650);
          } else update({ state: 'done', count, loops, fallback });
        };
        u.onerror = () => {
          if (token !== epoch || utterance !== u) return;
          utterance = null; update({ state: 'error', count, loops });
        };
        try { env.synth.speak(u); } catch (_) { u.onerror(); }
      };
      speakOne();
      return true;
    };
    return { play, stop };
  }
  function host() { return global.StudyTools || {}; }
  function readSetting(name, fallback) {
    try { const value = host().getSetting?.(name, fallback); if (value !== undefined && value !== null) return value; } catch (_) {}
    return fallback;
  }
  function persist(name, value) { try { host().setSetting?.(name, value); } catch (_) {} }
  function getPracticeMode() {
    try { if (typeof global.getPracticeMode === 'function') return canonicalMode(global.getPracticeMode()); } catch (_) {}
    return canonicalMode(readSetting('practiceMode', 'slow'));
  }
  function getPracticeDelay() {
    try { if (typeof global.getPracticeDelay === 'function') return clampDelay(global.getPracticeDelay()); } catch (_) {}
    return clampDelay(readSetting('practiceDelay', 3));
  }
  function setPracticeMode(value) {
    value = canonicalMode(value);
    try { if (typeof global.setPracticeMode === 'function') global.setPracticeMode(value); } catch (_) {}
    persist('practiceMode', value);
  }
  function setPracticeDelay(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 30 || String(value).trim() === '') return false;
    try { if (typeof global.setPracticeDelay === 'function') global.setPracticeDelay(n); } catch (_) {}
    persist('practiceDelay', n); return true;
  }
  function clock() { return { setTimeout: global.setTimeout.bind(global), clearTimeout: global.clearTimeout.bind(global), now: () => Date.now() }; }
  function recordingSupported() { return Boolean(global.navigator?.mediaDevices?.getUserMedia && global.MediaRecorder && global.URL?.createObjectURL); }
  function button(action, text, extra = '', classes = '') { return `<button type="button" data-sp-action="${action}" class="sp-button ${classes}" ${extra}>${text}</button>`; }
  function itemKey(item) { return String(item.id); }
  function favorite(item, kind) { try { return Boolean(host().isFavorite?.(item, kind)); } catch (_) { return false; } }
  function valid(s) { return active === s && !s.destroyed && s.mount.contains(s.frame); }
  function notice(s, message) {
    const el = s.frame.querySelector('[data-sp-notice]');
    if (el) el.textContent = message;
  }
  function clearRecording(s) {
    s.recordEpoch++;
    if (s.recordLimit !== null) global.clearTimeout(s.recordLimit);
    s.recordLimit = null;
    if (s.recorder) {
      s.recorder.ondataavailable = null; s.recorder.onstop = null; s.recorder.onerror = null;
      if (s.recorder.state !== 'inactive') { try { s.recorder.stop(); } catch (_) {} }
    }
    s.stream?.getTracks().forEach(track => track.stop());
    s.recorder = null; s.stream = null; s.recording = false; s.recordPending = false;
    const audio = s.frame.querySelector('[data-sp-record-audio]');
    if (audio) { try { audio.pause(); } catch (_) {} audio.removeAttribute('src'); audio.load?.(); }
    if (s.recordURL) { global.URL.revokeObjectURL(s.recordURL); s.recordURL = null; }
  }
  function resetQuestion(s) {
    s.advance.cancel(); s.speech.stop(); clearRecording(s);
    s.answered = false; s.answer = null; s.composing = false; s.compositionEnded = 0;
    s.frame.classList.remove('sp-answered');
  }
  function scrollStart(s) {
    if (s.mount.id === 'app') global.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
  }
  function cleanItems(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && item.id !== undefined && typeof item.en === 'string' && item.en.trim())
      .map(item => ({ ...item, en: item.en.trim(), zh: String(item.zh ?? '') }));
  }
  function render(items, kind = 'word', options = {}) {
    destroy();
    const mount = typeof options.mount === 'string' ? global.document.querySelector(options.mount) : options.mount || global.document.getElementById('app');
    if (!mount || typeof mount.appendChild !== 'function') throw new Error('StudyPractice requires a valid mount container.');
    const frame = global.document.createElement('section');
    frame.className = 'study-practice'; frame.setAttribute('aria-label', '听写与学习练习');
    mount.replaceChildren(frame);
    const list = cleanItems(items), mode = MODES.includes(options.mode) ? options.mode : 'dictation';
    const s = active = {
      mount, frame, items: list, original: list.slice(), kind: kind === 'sentence' ? 'sentence' : 'word', mode, options,
      index: 0, answered: false, answer: null, results: [], wrong: new Map(), destroyed: false,
      loops: Number(readSetting('loops', 1)) === 3 ? 3 : 1,
      accent: readSetting('accent', 'en-US'), rate: Number(readSetting('speechRate', readSetting('rate', 0.82))),
      advance: makeAdvance(clock()), speech: makeSpeech({ synth: global.speechSynthesis, Utterance: global.SpeechSynthesisUtterance, ...clock() }),
      recorder: null, stream: null, recordURL: null, recordLimit: null, recordEpoch: 0, recording: false, recordPending: false,
      composing: false, compositionEnded: 0, route: global.location?.hash, observers: []
    };
    if (!['en-US', 'en-GB', 'en-AU'].includes(s.accent)) s.accent = 'en-US';
    if (!Number.isFinite(s.rate) || s.rate < 0.5 || s.rate > 1.5) s.rate = 0.82;
    s.click = event => onClick(s, event);
    s.change = event => onChange(s, event);
    s.key = event => onKey(s, event);
    s.startComposition = () => { s.composing = true; };
    s.endComposition = () => { s.composing = false; s.compositionEnded = Date.now(); };
    s.leave = () => { if (global.location?.hash !== s.route) destroy(); };
    s.pageHide = () => { if (active === s) destroy(); };
    frame.addEventListener('click', s.click); frame.addEventListener('change', s.change);
    frame.addEventListener('keydown', s.key);
    frame.addEventListener('compositionstart', s.startComposition); frame.addEventListener('compositionend', s.endComposition);
    global.addEventListener?.('hashchange', s.leave); global.addEventListener?.('pagehide', s.pageHide);
    // A host may replace #app without changing the URL; release microphones and timers in that case too.
    if (global.MutationObserver) {
      const observer = new global.MutationObserver(() => { if (active === s && !s.mount.contains(s.frame)) destroy(); });
      observer.observe(mount, { childList: true }); s.observers.push(observer);
    }
    draw(s); scrollStart(s);
    return { destroy: () => { if (active === s) destroy(); }, replay: () => replay(s), check: typed => check(s, typed), next: () => next(s) };
  }
  function heading(s) {
    const term = s.kind === 'word' ? '单词' : '句子';
    const titles = { dictation: `${term}听写`, cards: '英中对照', shadowing: `${term}跟读` };
    return `<header class="sp-heading"><div><h1>${titles[s.mode]}</h1><p>${s.mode === 'dictation' ? '先听，再写。检查后显示答案和中文。' : s.mode === 'cards' ? '看英文和中文，再标记你记得多清楚。' : '听示范，跟着读。录音后回听，自己判断。'}</p></div>${button('home', '返回工具', '', 'sp-muted')}</header>
      <nav class="sp-tabs" aria-label="练习方式">${MODES.map(mode => button('mode', ({ dictation: '听写', cards: '英中对照', shadowing: '跟读' })[mode], `data-sp-value="${mode}" aria-pressed="${s.mode === mode}"`, s.mode === mode ? 'sp-selected' : '')).join('')}</nav>`;
  }
  function settings(s) {
    const mode = getPracticeMode(), delay = getPracticeDelay();
    return `<details class="sp-settings"><summary>播放与答题设置 · ${s.accent === 'en-GB' ? '英音' : s.accent === 'en-AU' ? '澳音' : '美音'} · ${s.rate}× · ${s.loops} 次</summary><div class="sp-settings-grid">
      <label>口音<select data-sp-setting="accent">${[['en-US','美音'],['en-GB','英音'],['en-AU','澳音']].map(([v,t]) => `<option value="${v}" ${s.accent === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>语速<select data-sp-setting="speechRate">${[0.5,0.65,0.82,1,1.2,1.5].map(v => `<option value="${v}" ${s.rate === v ? 'selected' : ''}>${v}×</option>`).join('')}${![0.5,0.65,0.82,1,1.2,1.5].includes(s.rate) ? `<option value="${s.rate}" selected>${s.rate}×</option>` : ''}</select></label>
      <label>循环<select data-sp-setting="loops"><option value="1" ${s.loops === 1 ? 'selected' : ''}>1 次</option><option value="3" ${s.loops === 3 ? 'selected' : ''}>3 次</option></select></label>
      <label>答题节奏<select data-sp-setting="practiceMode">${[['slow','手动继续'],['fast','答对立即继续'],['delay','答对延迟继续']].map(([v,t]) => `<option value="${v}" ${mode === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label data-sp-delay-label ${mode === 'delay' ? '' : 'hidden'}>等待秒数<input type="number" data-sp-setting="practiceDelay" min="1" max="30" step="1" value="${delay}" aria-label="答对后等待秒数，1至30秒"></label></div><p>答错会停下，让你看清答案。口音取决于浏览器提供的声音。</p></details>`;
  }
  function draw(s) {
    if (!valid(s)) return;
    if (!s.items.length) {
      s.frame.innerHTML = heading(s) + '<div class="sp-card sp-empty"><h2>这里还没有可练的内容</h2><p>回到工具，选一组单词或句子再开始。</p></div>';
      return;
    }
    if (s.index >= s.items.length) { drawResults(s); return; }
    const item = s.items[s.index], total = s.items.length;
    const tokens = item.en.match(/\S+/g) || [];
    const recognition = `<div class="sp-recognition" role="group" aria-label="你记得多清楚">${[['known','认识'],['fuzzy','模糊'],['unknown','不认识']].map(([value, label]) => button('recognition', label, `data-sp-value="${value}"`, value === 'known' ? 'sp-primary' : '')).join('')}</div>`;
    const content = s.mode === 'dictation' ? `<div class="sp-listening-cue" aria-hidden="true">♫</div><p class="sp-prompt">${s.kind === 'word' ? '听一听，写出这个单词或词组' : '听一听，写出完整句子'}</p><label class="sp-input-label" for="sp-answer">${s.kind === 'word' ? '你的拼写' : '你的句子'}</label><textarea id="sp-answer" data-sp-input rows="${s.kind === 'word' ? 2 : 3}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="在这里输入英文" aria-describedby="sp-answer-help"></textarea><p id="sp-answer-help" class="sp-small">${s.kind === 'sentence' ? '大小写和常见标点不影响结果；单词、缩写和顺序需要一致。' : '大小写和句末标点不影响结果。'}</p>` : `<div class="sp-bilingual"><p class="sp-english" lang="en">${escape(item.en)}</p><p class="sp-chinese">${escape(item.zh || '这项内容暂时没有中文。')}</p></div>${s.mode === 'shadowing' ? `<div class="sp-word-list" aria-label="逐词示范">${tokens.map((token, i) => button('token', escape(token), `data-sp-token="${i}" lang="en"`, 'sp-token')).join('')}</div><p class="sp-small">${s.kind === 'sentence' ? '点单词听局部，点重听听整句。' : '先听示范，再跟着读。'}</p><div class="sp-record-row">${button('record', '录音跟读', recordingSupported() ? '' : 'disabled', 'sp-record')}<span data-sp-record-status role="status">${recordingSupported() ? '点录音时才会请求麦克风权限。' : '浏览器暂不支持录音，可听示范后自行跟读。'}</span></div><div data-sp-record-playback></div><p class="sp-small">录音只保留在本页，离开后删除。请自行回听判断，没有自动评分。</p>` : ''}<p class="sp-prompt">${s.mode === 'shadowing' ? '跟读后，标记这项内容记得多清楚' : '你记得多清楚？'}</p>${recognition}`;
    s.frame.innerHTML = `${heading(s)}<div class="sp-progress"><span>第 ${s.index + 1} / ${total} 项</span><span>本轮已完成 ${s.results.length} 项</span><div role="progressbar" aria-label="本轮进度" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.results.length}"><i style="width:${s.results.length / total * 100}%"></i></div></div>${settings(s)}<section class="sp-card">${content}<div data-sp-feedback class="sp-feedback" aria-live="polite"></div></section><div class="sp-actions">${button('replay', '重听', '', 'sp-secondary')}${button('stop-audio', '停止播放', '', 'sp-muted')}${button('favorite', favorite(item,s.kind) ? '★ 已收藏' : '☆ 收藏', 'data-sp-favorite aria-pressed="' + favorite(item,s.kind) + '"', 'sp-muted')}${s.mode === 'dictation' ? button('check', '检查', 'data-sp-check', 'sp-primary') : ''}${button('next', '继续', 'data-sp-next disabled', 'sp-primary')}</div><p data-sp-notice class="sp-notice" role="status"></p><p class="sp-shortcuts">Enter 检查 / 继续 · Ctrl 或 Alt + R 重听</p>`;
    s.frame.querySelector('[data-sp-input]')?.focus({ preventScroll: true });
    if (s.options.autoplay !== false) replay(s);
  }
  function replay(s, text) {
    if (!valid(s) || s.index >= s.items.length) return;
    if (s.recording || s.recordPending) { notice(s, '先停止录音，再播放示范。'); return; }
    s.speech.play(text ?? s.items[s.index].en, { accent: s.accent, rate: s.rate, loops: s.loops }, info => {
      if (!valid(s)) return;
      const suffix = info.fallback ? ' · 当前浏览器使用了另一种英语声音' : '';
      const messages = { unsupported: '浏览器没有朗读功能，可换一个支持朗读的浏览器。', speaking: `正在播放 ${info.count} / ${info.loops}${suffix}`, pause: `已播放 ${info.count} / ${info.loops}，稍后重播${suffix}`, done: `播放完成${suffix}`, error: '朗读没有成功，请点重听再试。' };
      notice(s, messages[info.state]);
    });
  }
  function recordResult(s, result) {
    const item = s.items[s.index];
    if (s.answered) return false;
    s.answered = true; s.answer = result; s.results.push({ item, ...result });
    if (!result.correct) s.wrong.set(itemKey(item), item);
    try { host().record?.(item, s.kind, { ...result }); } catch (_) { notice(s, '这次结果未能保存，请检查本地存储空间。'); }
    return true;
  }
  function check(s, typed) {
    if (!valid(s) || s.mode !== 'dictation' || s.answered || s.index >= s.items.length || s.composing) return false;
    const input = s.frame.querySelector('[data-sp-input]');
    const value = typed === undefined ? input?.value || '' : String(typed);
    if (!normalize(value,s.kind)) { notice(s, '先输入听到的英文，再检查。'); input?.focus(); return false; }
    const correct = grade(value,s.items[s.index].en,s.kind);
    recordResult(s, { correct, typed: value, mode: 'dictation', recognition: null });
    if (input) { input.disabled = true; input.value = value; }
    feedback(s); return correct;
  }
  function mark(s, recognition) {
    if (!valid(s) || s.mode === 'dictation' || !RECOGNITION.includes(recognition) || s.answered || s.index >= s.items.length) return;
    if (s.recording || s.recordPending) { notice(s, '先停止录音，再标记。'); return; }
    recordResult(s, { correct: recognition === 'known', typed: '', mode: s.mode, recognition });
    s.frame.querySelectorAll('[data-sp-action="recognition"]').forEach(el => { el.disabled = true; el.setAttribute('aria-pressed', String(el.dataset.spValue === recognition)); });
    const recordButton = s.frame.querySelector('[data-sp-action="record"]');
    if (recordButton) recordButton.disabled = true;
    feedback(s);
  }
  function feedback(s) {
    const item = s.items[s.index], result = s.answer, area = s.frame.querySelector('[data-sp-feedback]');
    if (!area) return;
    s.frame.classList.add('sp-answered');
    const completed = s.frame.querySelector('.sp-progress>span:last-of-type');
    if (completed) completed.textContent = `本轮已完成 ${s.results.length} 项`;
    const progress = s.frame.querySelector('[role="progressbar"]');
    if (progress) { progress.setAttribute('aria-valuenow', String(s.results.length)); progress.querySelector('i').style.width = `${s.results.length / s.items.length * 100}%`; }
    const label = s.mode === 'dictation' ? (result.correct ? '写对了' : '这次没有写对，先看清答案') : ({ known: '已标记：认识', fuzzy: '已标记：模糊，留在本轮待重练', unknown: '已标记：不认识，留在本轮待重练' })[result.recognition];
    area.classList.toggle('sp-wrong', !result.correct); area.classList.toggle('sp-correct', result.correct);
    area.innerHTML = `<strong>${label}</strong><div class="sp-answer"><span>英文答案</span><p lang="en">${escape(item.en)}</p><span>中文</span><p>${escape(item.zh || '暂时没有中文。')}</p></div>${s.mode === 'dictation' && !result.correct ? `<p class="sp-small">你的输入：<span lang="en">${escape(result.typed)}</span></p>` : ''}<p data-sp-countdown class="sp-small"></p>`;
    s.frame.querySelector('[data-sp-check]')?.setAttribute('disabled', '');
    const nextButton = s.frame.querySelector('[data-sp-next]');
    if (nextButton) { nextButton.disabled = false; nextButton.focus({ preventScroll: true }); }
    scheduleNext(s);
  }
  function scheduleNext(s) {
    s.advance.cancel();
    const note = s.frame.querySelector('[data-sp-countdown]');
    if (!s.answered || !s.answer?.correct) { if (note) note.textContent = '看完答案后，点继续。'; return; }
    const mode = getPracticeMode(), index = s.index;
    if (note) note.textContent = mode === 'slow' ? '点继续进入下一项。' : '';
    s.advance.schedule(true, mode, getPracticeDelay(), () => next(s), () => valid(s) && s.index === index && s.answered && getPracticeMode() === mode, left => {
      if (note && valid(s)) note.textContent = mode === 'fast' ? '正在进入下一项。' : `${left} 秒后下一项 · 可点继续`;
    });
  }
  function next(s) {
    if (!valid(s) || !s.answered || s.index >= s.items.length) return false;
    resetQuestion(s); s.index++; draw(s); scrollStart(s); return true;
  }
  function drawResults(s) {
    resetQuestion(s);
    const correct = s.results.filter(result => result.correct).length, wrong = [...s.wrong.values()];
    const label = s.mode === 'dictation' ? `答对 ${correct} / ${s.results.length} 项` : `自己标记认识 ${correct} / ${s.results.length} 项`;
    s.frame.innerHTML = `${heading(s)}<section class="sp-card sp-results"><h2>本轮完成</h2><p class="sp-result-number">${label}</p><p>${wrong.length ? `${wrong.length} 项留待重练。` : '本轮没有需要重练的内容。'}${s.mode === 'shadowing' ? '跟读结果来自你的标记，不是发音评分。' : ''}</p>${wrong.length ? `<ul class="sp-wrong-list">${wrong.slice(0,20).map(item => `<li><b lang="en">${escape(item.en)}</b><span>${escape(item.zh)}</span></li>`).join('')}</ul>${wrong.length > 20 ? `<p class="sp-small">另有 ${wrong.length-20} 项，会一起加入重练。</p>` : ''}` : ''}</section><div class="sp-actions">${button('retry', s.mode === 'dictation' ? '重练错题' : '重练模糊与不认识', wrong.length ? '' : 'disabled', 'sp-primary')}${button('restart','再练本轮','','sp-secondary')}${button('home','返回工具','','sp-muted')}</div><p data-sp-notice class="sp-notice" role="status"></p>`;
    s.frame.querySelector('[data-sp-action="' + (wrong.length ? 'retry' : 'restart') + '"]')?.focus({ preventScroll: true });
  }
  function restart(s, items) {
    resetQuestion(s); s.items = items.slice(); s.index = 0; s.results = []; s.wrong.clear(); draw(s); scrollStart(s);
  }
  async function toggleRecording(s) {
    if (!valid(s) || s.mode !== 'shadowing' || s.index >= s.items.length || s.answered) return;
    if (s.recording) {
      if (s.recordLimit !== null) global.clearTimeout(s.recordLimit);
      s.recordLimit = null;
      s.recording = false; s.recordPending = true; recordingStatus(s, '正在完成录音…');
      try { s.recorder.stop(); } catch (_) { clearRecording(s); recordingStatus(s, '录音停止失败，请重新试一次。'); }
      return;
    }
    if (s.recordPending) return;
    if (!recordingSupported()) { recordingStatus(s, '浏览器暂不支持录音，可先听示范再跟读。'); return; }
    s.speech.stop(); clearRecording(s);
    s.frame.querySelector('[data-sp-record-playback]').replaceChildren();
    const token = s.recordEpoch, index = s.index;
    s.recordPending = true; recordingStatus(s, '正在请求麦克风权限…');
    let stream = null;
    try {
      stream = await global.navigator.mediaDevices.getUserMedia({ audio: true });
      if (!valid(s) || token !== s.recordEpoch || index !== s.index) { stream.getTracks().forEach(track => track.stop()); return; }
      s.stream = stream;
      const choices = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
      const mimeType = choices.find(type => global.MediaRecorder.isTypeSupported?.(type));
      const recorder = new global.MediaRecorder(stream, mimeType ? { mimeType } : undefined), chunks = [];
      s.recorder = recorder;
      recorder.ondataavailable = event => { if (event.data?.size && token === s.recordEpoch) chunks.push(event.data); };
      recorder.onerror = () => { if (valid(s) && token === s.recordEpoch) { clearRecording(s); recordingStatus(s, '录音失败，可重新录一次。'); } };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (!valid(s) || token !== s.recordEpoch || index !== s.index) return;
        if (s.recordLimit !== null) global.clearTimeout(s.recordLimit);
        s.recordLimit = null; s.stream = null; s.recorder = null; s.recording = false; s.recordPending = false;
        if (!chunks.length) { recordingStatus(s, '没有录到声音，请重新试一次。'); return; }
        const blob = new global.Blob(chunks, { type: recorder.mimeType || chunks[0].type || 'audio/webm' });
        s.recordURL = global.URL.createObjectURL(blob);
        const box = s.frame.querySelector('[data-sp-record-playback]');
        const audio = global.document.createElement('audio'); audio.controls = true; audio.preload = 'metadata'; audio.src = s.recordURL;
        audio.setAttribute('data-sp-record-audio',''); audio.setAttribute('aria-label','回听你的跟读录音');
        box.replaceChildren(audio); recordingStatus(s, '已录好。回听后自行判断，也可以重新录。');
      };
      recorder.start(); s.recordPending = false; s.recording = true;
      recordingStatus(s, '正在录音，读完后点停止录音。');
      const limit = Math.min(180,Math.max(5,Number(s.options.recordingMaxSeconds)||60));
      s.recordLimit = global.setTimeout(() => { if (valid(s) && token === s.recordEpoch && s.recording) toggleRecording(s); }, limit*1000);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (!valid(s) || token !== s.recordEpoch) return;
      clearRecording(s);
      recordingStatus(s, error?.name === 'NotAllowedError' ? '麦克风权限没有开启。允许后可重试，也可以先自行跟读。' : '无法使用麦克风，请检查设备或改用支持录音的浏览器。');
    }
  }
  function recordingStatus(s, message) {
    if (!valid(s)) return;
    const status = s.frame.querySelector('[data-sp-record-status]'); if (status) status.textContent = message;
    const control = s.frame.querySelector('[data-sp-action="record"]');
    if (control) { control.textContent = s.recording ? '停止录音' : s.recordPending ? '等待权限…' : '重新录音'; control.disabled = s.recordPending || s.answered; }
  }
  function onClick(s, event) {
    const el = event.target.closest?.('[data-sp-action]');
    if (!el || !s.frame.contains(el) || el.disabled || !valid(s)) return;
    const action = el.dataset.spAction;
    if (action === 'home') { destroy(); if (host().home) host().home(); else if (global.location) global.location.hash = '#study'; return; }
    if (action === 'mode') {
      const mode = el.dataset.spValue;
      if (MODES.includes(mode) && mode !== s.mode) { s.mode = mode; restart(s,s.original); }
      return;
    }
    if (action === 'retry') { restart(s,[...s.wrong.values()]); return; }
    if (action === 'restart') { restart(s,s.original); return; }
    if (action === 'next') { next(s); return; }
    if (action === 'check') { check(s); return; }
    if (action === 'recognition') { mark(s,el.dataset.spValue); return; }
    if (action === 'replay') { replay(s); return; }
    if (action === 'stop-audio') { s.speech.stop(); notice(s,'播放已停止。'); return; }
    if (action === 'record') { toggleRecording(s); return; }
    if (action === 'token') {
      const words = s.items[s.index].en.match(/\S+/g) || [];
      const text = words[Number(el.dataset.spToken)]; if (text) replay(s,text); return;
    }
    if (action === 'favorite') {
      const item = s.items[s.index];
      try { host().favorite?.(item,s.kind); const selected = favorite(item,s.kind); el.textContent = selected ? '★ 已收藏' : '☆ 收藏'; el.setAttribute('aria-pressed',String(selected)); }
      catch (_) { notice(s,'这次收藏未能保存，请再试一次。'); }
    }
  }
  function onChange(s, event) {
    const name = event.target.dataset?.spSetting; if (!name || !valid(s)) return;
    const value = event.target.value;
    if (name === 'practiceMode') { setPracticeMode(value); s.frame.querySelector('[data-sp-delay-label]').hidden = canonicalMode(value) !== 'delay'; scheduleNext(s); }
    else if (name === 'practiceDelay') {
      if (!setPracticeDelay(value)) { event.target.value = String(getPracticeDelay()); notice(s,'等待时间请填 1 至 30 的整数。'); }
      scheduleNext(s);
    } else {
      s.speech.stop();
      if (name === 'accent') s.accent = ['en-US','en-GB','en-AU'].includes(value) ? value : 'en-US';
      if (name === 'speechRate') s.rate = Math.min(1.5,Math.max(0.5,Number(value)||0.82));
      if (name === 'loops') s.loops = Number(value) === 3 ? 3 : 1;
      persist(name,name === 'speechRate' ? s.rate : name === 'loops' ? s.loops : s.accent);
      const summary = s.frame.querySelector('.sp-settings summary');
      if (summary) summary.textContent = `播放与答题设置 · ${s.accent === 'en-GB' ? '英音' : s.accent === 'en-AU' ? '澳音' : '美音'} · ${s.rate}× · ${s.loops} 次`;
      notice(s,'设置已更新，点重听使用新设置。');
    }
  }
  function onKey(s, event) {
    if (!valid(s) || event.isComposing || s.composing || event.keyCode === 229 || event.repeat) return;
    if ((event.ctrlKey || event.altKey) && !event.metaKey && event.key?.toLowerCase() === 'r') {
      event.preventDefault(); event.stopPropagation(); replay(s); return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || Date.now()-s.compositionEnded < 150) return;
    if (['BUTTON','SELECT','A','AUDIO'].includes(event.target.tagName) || event.target.dataset?.spSetting) return;
    if (s.index >= s.items.length) return;
    if (s.answered || s.mode === 'dictation') {
      event.preventDefault(); event.stopPropagation(); if (s.answered) next(s); else check(s);
    }
  }
  function destroy() {
    const s = active; if (!s) return;
    s.destroyed = true; active = null; s.advance.cancel(); s.speech.stop(); clearRecording(s);
    s.frame.removeEventListener('click',s.click); s.frame.removeEventListener('change',s.change); s.frame.removeEventListener('keydown',s.key);
    s.frame.removeEventListener('compositionstart',s.startComposition); s.frame.removeEventListener('compositionend',s.endComposition);
    global.removeEventListener?.('hashchange',s.leave); global.removeEventListener?.('pagehide',s.pageHide);
    s.observers.forEach(observer => observer.disconnect());
  }
  const api = { render, start: render, destroy, normalize, grade };
  Object.defineProperty(api,'_test',{ value: { makeAdvance, makeSpeech, canonicalMode, clampDelay } });
  global.StudyPractice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
