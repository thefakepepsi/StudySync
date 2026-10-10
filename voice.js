/* Voice Assistant: speech to text with whisper-large-v3-turbo on Groq, answers from gpt-oss-20b, spoken with the browser's voice. */
(function () {
  'use strict';
  var SS = window.SS, el = SS.el, t = SS.t;
  var root, log, statusEl, micBtn, speakBox, noteEl, form, textIn;
  var rec = null, stream = null, chunks = [], timer = null, discard = false, state = 'idle', hist = [];
  var MAX_MS = 90000;

  function setStatus(msg, err) { statusEl.textContent = msg || ''; statusEl.classList.toggle('err', !!err); }
  function setState(s) {
    state = s;
    micBtn.classList.toggle('on', s === 'rec');
    micBtn.setAttribute('aria-pressed', String(s === 'rec'));
    micBtn.disabled = s === 'busy';
    micBtn.querySelector('.mic-label').textContent = s === 'rec' ? t('vo_stop') : t('vo_start');
    if (s === 'rec') setStatus(t('vo_listening')); else if (s === 'idle') setStatus('');
  }
  function addMsg(role, text) {
    var m = el('div', 'msg ' + role);
    if (role !== 'sys') m.appendChild(el('span', 'who', (role === 'you' ? t('you') : t('guide')) + ' ›'));
    m.appendChild(el('span', 'body', text));
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return m;
  }
  /* Language of the student's speech: Whisper reports a language name; typed text is judged by script. */
  var WHISPER = { english: 'en-US', hindi: 'hi-IN', chinese: 'zh-CN', mandarin: 'zh-CN', arabic: 'ar-SA', russian: 'ru-RU', malayalam: 'ml-IN', telugu: 'te-IN', french: 'fr-FR', spanish: 'es-ES', indonesian: 'id-ID',
    german: 'de-DE', portuguese: 'pt-BR', italian: 'it-IN', japanese: 'ja-JP', korean: 'ko-KR', urdu: 'ur-PK', tamil: 'ta-IN', bengali: 'bn-IN', marathi: 'mr-IN', gujarati: 'gu-IN', kannada: 'kn-IN', punjabi: 'pa-IN', turkish: 'tr-TR', dutch: 'nl-NL', polish: 'pl-PL', ukrainian: 'uk-UA', vietnamese: 'vi-VN', thai: 'th-TH', persian: 'fa-IR', hebrew: 'he-IL', swahili: 'sw-KE', malay: 'ms-MY', filipino: 'fil-PH', tagalog: 'fil-PH' };
  var SCRIPTS = [[/[\u0900-\u097F]/, 'hi-IN'], [/[\u0600-\u06FF]/, 'ar-SA'], [/[\u0400-\u04FF]/, 'ru-RU'], [/[\u0C00-\u0C7F]/, 'te-IN'], [/[\u0D00-\u0D7F]/, 'ml-IN'], [/[\u3040-\u30FF]/, 'ja-JP'], [/[\uAC00-\uD7AF]/, 'ko-KR'], [/[\u4E00-\u9FFF]/, 'zh-CN']];
  function codeFor(heard, text) {
    if (heard && WHISPER[heard]) return WHISPER[heard];
    for (var i = 0; i < SCRIPTS.length; i++) if (SCRIPTS[i][0].test(text)) return SCRIPTS[i][1];
    var site = SS.speakLang();
    return /^(fr|es|id|en)/.test(site) ? site : 'en-US';
  }
  var heardLang = '';

  function speak(text) {
    try {
      if (!speakBox.checked || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = codeFor(heardLang, text);
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function stopSpeech() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }

  async function reply(text) {
    setState('busy'); setStatus(t('vo_thinking'));
    hist.push({ role: 'user', content: text });
    try {
      var out = await SS.AI.chat('main', [{ role: 'system', content: SS.AI.tutorSystem(true, heardLang) }].concat(hist.slice(-12)));
      if (!out) throw new Error('empty');
      hist.push({ role: 'assistant', content: out });
      addMsg('guide', out); noteEl.textContent = SS.AI.note(); speak(out);
      setState('idle');
    } catch (e) {
      hist.pop(); setState('idle'); setStatus(SS.AI.errorText(e), true);
    }
  }

  async function start() {
    stopSpeech();
    if (!SS.AI.hasKey()) { setStatus(t('vo_need_key'), true); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { setStatus(t('vo_nomic'), true); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { setStatus(t('vo_nomic'), true); return; }
    var mime = '';
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].some(function (m) { try { if (MediaRecorder.isTypeSupported(m)) { mime = m; return true; } } catch (e) {} return false; });
    chunks = []; discard = false;
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
    catch (e) { releaseMic(); setStatus(t('vo_nomic'), true); return; }
    rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = onStopped;
    rec.start();
    setState('rec');
    clearTimeout(timer); timer = setTimeout(stop, MAX_MS);
  }
  function releaseMic() { if (stream) { stream.getTracks().forEach(function (tr) { tr.stop(); }); stream = null; } }
  function stop() { clearTimeout(timer); if (rec && rec.state !== 'inactive') rec.stop(); }

  async function onStopped() {
    var type = (rec && rec.mimeType) || 'audio/webm';
    releaseMic();
    if (discard) { setState('idle'); return; }
    var blob = new Blob(chunks, { type: type });
    if (blob.size < 1500) { setState('idle'); setStatus(t('vo_empty'), true); return; }
    setState('busy'); setStatus(t('vo_transcribing'));
    try {
      var tr = await SS.AI.transcribe(blob, '');
      var text = tr.text; heardLang = tr.language || '';
      if (!text) { setState('idle'); setStatus(t('vo_empty'), true); return; }
      addMsg('you', text);
      await reply(text);
    } catch (e) { setState('idle'); setStatus(SS.AI.errorText(e), true); }
  }

  SS.registerView('voice', {
    init: function (r) {
      root = r;
      r.innerHTML =
        '<div class="wrap tool-page">' +
        '<div class="term-head"><h1 data-i18n="vo_h"></h1><button class="btn ghost" id="voHome" type="button" data-i18n="home"></button></div>' +
        '<p class="sub" data-i18n="vo_sub"></p>' +
        '<div class="voice-stage">' +
        '<button class="mic" id="micBtn" type="button" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></svg><span class="mic-label"></span></button>' +
        '<p class="status" id="voStatus" role="status"></p>' +
        '<div class="voice-opts"><label class="check" for="voSpeak"><input type="checkbox" id="voSpeak" checked><span data-i18n="vo_speak"></span></label></div></div>' +
        '<div class="term"><div class="term-log" id="voLog" role="log" aria-live="polite"></div>' +
        '<form class="term-form" id="voForm"><textarea id="voText" rows="1" data-i18n-ph="vo_type_ph" aria-label="Question"></textarea><button class="btn" type="submit" data-i18n="send"></button></form></div>' +
        '<div class="term-foot"><span class="ai-note" id="voNote"></span><button class="btn ghost" id="voClear" type="button" data-i18n="clear"></button></div></div>';
      var $ = function (s) { return SS.$(s, r); };
      log = $('#voLog'); statusEl = $('#voStatus'); micBtn = $('#micBtn'); speakBox = $('#voSpeak'); noteEl = $('#voNote'); form = $('#voForm'); textIn = $('#voText');
      micBtn.addEventListener('click', function () { if (state === 'rec') stop(); else if (state === 'idle') start(); });
      $('#voHome').addEventListener('click', function () { SS.showView('home'); });
      $('#voClear').addEventListener('click', function () { if (state === 'busy') return; hist = []; log.textContent = ''; noteEl.textContent = ''; stopSpeech(); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = textIn.value.trim();
        if (!v || state !== 'idle') return;
        textIn.value = ''; heardLang = ''; addMsg('you', v); reply(v);
      });
      textIn.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      setState('idle');
    },
    onHide: function () {
      stopSpeech();
      if (state === 'rec') { discard = true; stop(); }
    }
  });
  SS.onLang(function () { if (micBtn) setState(state); });
  SS.onAuth(function (ok) { if (!ok) { hist = []; if (log) log.textContent = ''; stopSpeech(); } });
})();
