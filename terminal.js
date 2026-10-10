/* Main AI Terminal: chat (gpt-oss-20b) plus the Flashcards, Syllabus Analyzer and Exam Generator tabs. */
(function () {
  'use strict';
  var SS = window.SS, el = SS.el, t = SS.t;
  var hist = [], pending = false, chatId = null, sureDel = false;
  var log, input, sendBtn, noteEl, root, histEl, askEl, sylBar;

  function addMsg(role, text) {
    var m = el('div', 'msg ' + role);
    if (role !== 'sys') m.appendChild(el('span', 'who', (role === 'you' ? t('you') : t('guide')) + ' ›'));
    var b = el('span', 'body', text); m.appendChild(b);
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return { row: m, body: b };
  }
  function renderIntro() {
    if (!log || hist.length || pending) return;
    log.textContent = '';
    addMsg('guide', t('term_intro'));
  }

  function titleOf() { for (var i = 0; i < hist.length; i++) if (hist[i].role === 'user') return hist[i].content.replace(/\s+/g, ' ').slice(0, 48); return t('ch_new'); }
  function persist() {
    if (SS.mem.pref() !== '1' || !hist.length) return;
    if (!chatId) chatId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    SS.mem.save({ id: chatId, title: titleOf(), ts: Date.now(), msgs: hist });
    renderHist();
  }
  function newChat() {
    if (pending) return;
    hist = []; chatId = null; noteEl.textContent = ''; renderIntro(); renderHist();
  }
  function loadChat(id) {
    if (pending) return;
    var c = SS.mem.chats().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    hist = c.msgs.slice(); chatId = c.id; log.textContent = ''; noteEl.textContent = '';
    hist.forEach(function (m) { addMsg(m.role === 'user' ? 'you' : 'guide', m.content); });
    renderHist();
    if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) setSide(false);
    input.focus();
  }
  function setSide(open) {
    histEl.hidden = !open;
    var b = SS.$('#histBtn', root); b.setAttribute('aria-expanded', String(open));
    if (open) renderHist();
  }
  function showAsk() {
    askEl.hidden = false; SS.$('#askYes', root).focus();
  }
  function answerAsk(yes) {
    SS.mem.setPref(yes ? '1' : '0'); askEl.hidden = true;
    if (yes) persist();
    setSide(true); renderHist();
  }
  function renderHist() {
    if (!histEl || histEl.hidden) return;
    var list = SS.$('#histList', root); list.textContent = '';
    var on = SS.mem.pref() === '1';
    var foot = SS.$('#histFoot', root); foot.textContent = '';
    if (!on) {
      list.appendChild(el('p', 'hist-msg', t('ch_off')));
      var bon = el('button', 'btn sm', t('ch_turn_on')); bon.type = 'button';
      bon.addEventListener('click', showAsk); list.appendChild(bon);
      return;
    }
    var cs = SS.mem.chats();
    if (!cs.length) list.appendChild(el('p', 'hist-msg', t('ch_empty')));
    cs.forEach(function (c) {
      var row = el('div', 'hist-row' + (c.id === chatId ? ' on' : ''));
      var b = el('button', 'hist-open', c.title || t('ch_new')); b.type = 'button'; b.title = c.title || '';
      b.addEventListener('click', function () { loadChat(c.id); });
      var d = el('button', 'hist-del', '×'); d.type = 'button'; d.setAttribute('aria-label', t('ch_del')); d.title = t('ch_del');
      d.addEventListener('click', function () {
        SS.mem.remove(c.id);
        if (c.id === chatId) { chatId = null; }
        renderHist();
      });
      row.append(b, d); list.appendChild(row);
    });
    var stop = el('button', 'btn ghost sm', t('ch_stop')); stop.type = 'button';
    stop.addEventListener('click', function () { SS.mem.setPref('0'); sureDel = false; renderHist(); });
    var del = el('button', 'btn ghost sm', sureDel ? t('ch_sure') : t('ch_delall')); del.type = 'button';
    del.addEventListener('click', function () {
      if (!sureDel) { sureDel = true; renderHist(); return; }
      sureDel = false; SS.mem.clearAll(); SS.syllabus.clear(); chatId = null; renderHist();
    });
    foot.append(stop, del);
  }
  function renderSyl() {
    if (!sylBar) return;
    sylBar.hidden = !SS.syllabus.has();
    if (!SS.syllabus.has()) return;
    SS.$('#sylTxt', root).textContent = t('sy_using', { course: SS.syllabus.course() });
    SS.$('#sylOn', root).checked = SS.syllabus.active();
  }
  SS.tools.chatNote = function (msg) { if (log) { if (!hist.length) log.textContent = ''; addMsg('sys', msg); } };

  async function ask(text) {
    pending = true; sendBtn.disabled = true; noteEl.textContent = '';
    if (!hist.length) log.textContent = '';
    hist.push({ role: 'user', content: text }); addMsg('you', text);
    var out = addMsg('guide', ''); out.body.classList.add('dots');
    var messages = [{ role: 'system', content: SS.AI.tutorSystem(false) }].concat(hist.slice(-12));
    try {
      var reply = await SS.AI.chat('main', messages, { onText: function (x) { out.body.classList.remove('dots'); out.body.textContent = x; log.scrollTop = log.scrollHeight; } });
      if (!reply) throw new Error('empty');
      out.body.classList.remove('dots'); out.body.textContent = reply;
      hist.push({ role: 'assistant', content: reply });
      noteEl.textContent = SS.AI.note(); persist();
    } catch (e) {
      hist.pop();
      out.row.remove();
      addMsg('sys', SS.AI.errorText(e));
    }
    pending = false; sendBtn.disabled = false; log.scrollTop = log.scrollHeight; input.focus();
  }

  function openTab(name) {
    SS.$$('.tab', root).forEach(function (b) { var on = b.getAttribute('data-tab') === name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    SS.$$('.panel', root).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
    if (name === 'chat' && input) input.focus();
  }
  SS.tools.openTab = openTab;

  SS.registerView('term', {
    init: function (r) {
      root = r;
      r.innerHTML =
        '<div class="wrap tool-page">' +
        '<div class="term-head"><h1 data-i18n="term_h"></h1><button class="btn ghost" id="homeBtn" type="button" data-i18n="home"></button></div>' +
        '<div class="tabs" role="tablist">' +
        '<button class="tab" role="tab" data-tab="chat" data-i18n="tab_chat"></button>' +
        '<button class="tab" role="tab" data-tab="flash" data-i18n="tab_flash"></button>' +
        '<button class="tab" role="tab" data-tab="syl" data-i18n="tab_syl"></button>' +
        '<button class="tab" role="tab" data-tab="exam" data-i18n="tab_exam"></button></div>' +
        '<section class="panel" data-panel="chat" role="tabpanel">' +
        '<p class="sub" data-i18n="term_sub"></p>' +
        '<div class="syl-bar" id="sylBar" hidden><label class="check"><input type="checkbox" id="sylOn"><span id="sylTxt"></span></label>' +
        '<button class="btn ghost sm" id="sylRm" type="button" data-i18n="sy_remove"></button></div>' +
        '<div class="term" id="termBox">' +
        '<aside class="hist" id="hist" hidden><div class="hist-list" id="histList"></div><div class="hist-foot" id="histFoot"></div></aside>' +
        '<div class="term-main"><div class="term-bar">' +
        '<button class="icon-btn sm" id="histBtn" type="button" aria-expanded="false" data-i18n-aria="ch_hist" aria-label="Chat history"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg></button>' +
        '<button class="btn ghost sm" id="newChatBtn" type="button" data-i18n="ch_new"></button></div>' +
        '<div class="term-log" id="log" role="log" aria-live="polite"></div>' +
        '<form class="term-form" id="termForm"><textarea id="termInput" rows="1" data-i18n-ph="term_ph" aria-label="Question"></textarea>' +
        '<button class="btn" id="sendBtn" type="submit" data-i18n="send"></button></form></div>' +
        '<div class="save-ask" id="saveAsk" role="dialog" aria-modal="true" aria-labelledby="askQ" hidden><div class="save-card">' +
        '<p id="askQ"><strong data-i18n="ch_ask"></strong> <span data-i18n="ch_ask_note"></span></p>' +
        '<div class="save-btns"><button class="btn" id="askYes" type="button" data-i18n="ch_yes"></button><button class="btn ghost" id="askNo" type="button" data-i18n="ch_no"></button></div></div></div>' +
        '</div>' +
        '<div class="term-foot"><span class="ai-note" id="chatNote"></span><button class="btn ghost" id="clearBtn" type="button" data-i18n="clear"></button></div></section>' +
        '<section class="panel" data-panel="flash" role="tabpanel" hidden></section>' +
        '<section class="panel" data-panel="syl" role="tabpanel" hidden></section>' +
        '<section class="panel" data-panel="exam" role="tabpanel" hidden></section></div>';
      log = SS.$('#log', r); input = SS.$('#termInput', r); sendBtn = SS.$('#sendBtn', r); noteEl = SS.$('#chatNote', r);
      histEl = SS.$('#hist', r); askEl = SS.$('#saveAsk', r); sylBar = SS.$('#sylBar', r);

      SS.$$('.tab', r).forEach(function (b) { b.addEventListener('click', function () { openTab(b.getAttribute('data-tab')); }); });
      SS.$('#homeBtn', r).addEventListener('click', function () { SS.showView('home'); });
      SS.tools.flash(SS.$('[data-panel="flash"]', r));
      SS.tools.syl(SS.$('[data-panel="syl"]', r));
      SS.tools.exam(SS.$('[data-panel="exam"]', r));

      SS.$('#termForm', r).addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v || pending) return;
        input.value = ''; input.style.height = 'auto';
        ask(v);
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); SS.$('#termForm', r).requestSubmit(); } });
      input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });
      SS.$('#clearBtn', r).addEventListener('click', function () { if (pending) return; newChat(); });
      openTab('chat');
      renderIntro();
      SS.$('#histBtn', r).addEventListener('click', function () {
        if (SS.mem.pref() === null) { showAsk(); return; }
        setSide(histEl.hidden);
      });
      SS.$('#askYes', r).addEventListener('click', function () { answerAsk(true); });
      SS.$('#askNo', r).addEventListener('click', function () { answerAsk(false); });
      askEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { askEl.hidden = true; SS.$('#histBtn', r).focus(); } });
      SS.$('#newChatBtn', r).addEventListener('click', newChat);
      SS.$('#sylOn', r).addEventListener('change', function (e) { SS.syllabus.setOn(e.target.checked); });
      SS.$('#sylRm', r).addEventListener('click', function () { SS.syllabus.clear(); });
      SS.syllabus.onChange(renderSyl); renderSyl();
    },
    onShow: function () { renderIntro(); }
  });
  SS.onLang(function () { renderIntro(); renderHist(); renderSyl(); });
  SS.onAuth(function (ok) { if (!ok) { hist = []; chatId = null; if (histEl) histEl.hidden = true; if (log) { log.textContent = ''; renderIntro(); } } });
})();
