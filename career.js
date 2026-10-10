/* Career Counselor (Waypoint), ported from the standalone Waypoint site. Uses gpt-oss-120b on Groq. */
(function () {
  'use strict';
  var SS = window.SS, el = SS.el, t = SS.t;
  var hist = [], started = false, pending = false, log, input, sendBtn, locText, locEdit;

  function addMsg(role, text) {
    var m = el('div', 'msg ' + role);
    m.appendChild(el('span', 'who', role === 'you' ? t('you') + ' ›' : 'Waypoint ›'));
    var b = el('span', 'body', text); m.appendChild(b);
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return { row: m, body: b };
  }
  function system() {
    var p = 'You are Waypoint, a warm, sharp career counselor speaking with someone in a chat.\n' +
      'Be concise (2-5 sentences per turn, occasionally a short list), conversational, and curious.\n' +
      'Ask one focused follow-up question at a time rather than interrogating.\n' +
      'Help the person get clarity on career direction, job search strategy, career changes, skills, or workplace concerns.\n' +
      'Never repeat their message back to them. Never use headers or markdown formatting, just plain conversational text.\n' +
      'Respond only in ' + SS.aiLang() + ', written naturally as a native speaker would.';
    var region = SS.region(true);
    if (region) p += '\nThe user appears to be located in ' + region + ' (auto-detected from their device, so it may be imprecise). Where relevant, tailor examples (job market conditions, common job platforms, typical hiring practices, work-permit or visa considerations, and salary context) to that location, and confirm with them if it seems important rather than assuming.';
    return p;
  }
  async function turn(extra, silent) {
    pending = true; sendBtn.disabled = true;
    var out = addMsg('guide', ''); out.body.classList.add('dots');
    var msgs = [{ role: 'system', content: system() }].concat(hist.slice(-16));
    if (extra) msgs.push({ role: 'user', content: extra });
    try {
      var reply = await SS.AI.chat('career', msgs, { onText: function (x) { out.body.classList.remove('dots'); out.body.textContent = x; log.scrollTop = log.scrollHeight; } });
      if (!reply) throw new Error('empty');
      out.body.classList.remove('dots'); out.body.textContent = reply;
      hist.push({ role: 'assistant', content: reply });
    } catch (e) {
      out.row.remove();
      if (!silent) { var s = addMsg('sys', started && hist.length ? SS.AI.errorText(e) : t('wp_fail') + ' ' + SS.AI.errorText(e)); s.row.classList.add('sys'); }
      if (!hist.length) started = false;
    }
    pending = false; sendBtn.disabled = false;
  }
  function begin() {
    if (started) return;
    started = true;
    turn('Open the conversation now: greet the person briefly and ask one open question about where they are in their career right now.', false);
  }
  function updateLoc() {
    if (!locText) return;
    var r = SS.region(false);
    SS.$('#wpLoc').hidden = !r;
    locText.textContent = r ? t('wp_loc', { region: r }) : '';
  }

  SS.registerView('career', {
    init: function (r) {
      r.innerHTML =
        '<div class="wrap tool-page"><div class="term-head"><h1>Waypoint<span class="dotmark">.</span></h1>' +
        '<button class="btn ghost" id="wpHome" type="button" data-i18n="home"></button>' +
        '<button class="btn" id="wpExpert" type="button" data-i18n="wp_ask"></button>' +
        '<p class="sub" data-i18n="nav_career"></p></div>' +
        '<div class="locbar" id="wpLoc" hidden><span id="wpLocText"></span> · <button class="linkbtn" id="wpLocBtn" type="button" data-i18n="wp_change"></button>' +
        '<input id="wpLocIn" class="loc-in" type="text" hidden data-i18n-ph="wp_loc_ph" aria-label="Region"></div>' +
        '<div class="term"><div class="term-log" id="wpLog" role="log" aria-live="polite"></div>' +
        '<form class="term-form" id="wpForm"><textarea id="wpIn" rows="1" data-i18n-ph="wp_ph" aria-label="Message"></textarea><button class="btn" id="wpSend" type="submit" data-i18n="send"></button></form></div></div>';
      var $ = function (s) { return SS.$(s, r); };
      log = $('#wpLog'); input = $('#wpIn'); sendBtn = $('#wpSend'); locText = $('#wpLocText');
      var cfg = window.SS_CONFIG || {};
      $('#wpHome').addEventListener('click', function () { SS.showView('home'); });
      $('#wpExpert').addEventListener('click', function (e) { SS.openM(SS.$('#ovExpert'), e.currentTarget); });
      SS.$('#meetLink').href = cfg.MEET_LINK || '#'; SS.$('#zoomLink').href = cfg.ZOOM_LINK || '#';
      var locIn = $('#wpLocIn');
      $('#wpLocBtn').addEventListener('click', function () { locIn.hidden = !locIn.hidden; if (!locIn.hidden) { locIn.value = SS.region(false); locIn.focus(); } });
      locIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); SS.setRegion(locIn.value.trim()); locIn.hidden = true; updateLoc(); }
      });
      $('#wpForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v || pending) return;
        input.value = ''; input.style.height = 'auto';
        addMsg('you', v); hist.push({ role: 'user', content: v });
        started = true;
        turn(null, false);
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#wpForm').requestSubmit(); } });
      input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });
      updateLoc();
    },
    onShow: function () { begin(); }
  });
  SS.onLang(function (code) {
    updateLoc();
    if (log && started && hist.length && !pending) {
      turn('(The user just switched the interface language to ' + SS.aiLang() + '. Briefly acknowledge in ' + SS.aiLang() + ' and continue the conversation naturally from where it left off.)', true);
    }
  });
  SS.onAuth(function (ok) { if (!ok) { hist = []; started = false; if (log) log.textContent = ''; } });
})();
