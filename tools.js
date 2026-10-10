/* Flashcards, Syllabus Analyzer and Exam Generator. Each builds its own panel inside the AI Terminal. */
(function () {
  'use strict';
  var SS = window.SS, el = SS.el, t = SS.t;

  function status(node, text, isErr) { node.textContent = text || ''; node.classList.toggle('err', !!isErr); }
  function clampInt(v, lo, hi, d) { var n = parseInt(v, 10); if (isNaN(n)) n = d; return Math.max(lo, Math.min(hi, n)); }
  function aiNote(node) { node.textContent = SS.AI.note(); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function str(v) { return v == null ? '' : String(v); }

  /* ---------------- Flashcards (openai/gpt-oss-20b) ---------------- */
  SS.tools.flash = function (panel) {
    panel.innerHTML =
      '<p class="sub" data-i18n="fc_sub"></p>' +
      '<div class="tool-form">' +
      '<div class="field"><label for="fcIn" data-i18n="fc_in"></label><textarea id="fcIn" rows="5" data-i18n-ph="fc_in_ph"></textarea></div>' +
      '<div class="field narrow"><label for="fcN" data-i18n="fc_count"></label><input id="fcN" type="number" min="3" max="30" value="10"></div>' +
      '<button class="btn" id="fcGo" type="button" data-i18n="fc_make"></button></div>' +
      '<p class="status" id="fcStatus" role="status"></p><div id="fcOut"></div><p class="ai-note" id="fcNote"></p>';
    var $ = function (s) { return SS.$(s, panel); };
    var busy = false;

    SS.tools.flashFill = function (text) { $('#fcIn').value = text; };

    function runDeck(cards) {
      var out = $('#fcOut'); out.textContent = '';
      var queue = cards.slice(), pos = 0, known = 0, again = [], flipped = false;
      var prog = el('div', 'fc-progress');
      var card = el('button', 'fcard'); card.type = 'button';
      var side = el('span', 'fc-side'), txt = el('span', 'fc-text');
      card.append(side, txt);
      var row = el('div', 'fc-actions');
      var bAgain = el('button', 'btn ghost', t('fc_again')); bAgain.type = 'button';
      var bKnown = el('button', 'btn', t('fc_known')); bKnown.type = 'button';
      var bPrev = el('button', 'btn ghost', t('fc_prev')); bPrev.type = 'button';
      var bNext = el('button', 'btn ghost', t('fc_next')); bNext.type = 'button';
      var bShuf = el('button', 'btn ghost', t('fc_shuffle')); bShuf.type = 'button';
      var hint = el('p', 'hint', t('fc_flip'));
      row.append(bPrev, bAgain, bKnown, bNext);
      out.append(prog, card, hint, row, bShuf);

      function draw() {
        if (pos >= queue.length) { summary(); return; }
        var c = queue[pos];
        prog.textContent = t('fc_progress', { n: pos + 1, total: queue.length });
        side.textContent = flipped ? t('fc_back') : t('fc_front');
        txt.textContent = flipped ? c.back : c.front;
        card.classList.toggle('flipped', flipped);
        bPrev.disabled = pos === 0;
      }
      function summary() {
        out.textContent = '';
        out.appendChild(el('p', 'fc-sum', t('fc_done', { known: known, again: again.length })));
        var r = el('div', 'fc-actions');
        if (again.length) { var b = el('button', 'btn', t('fc_redo')); b.type = 'button'; b.addEventListener('click', function () { runDeck(again); }); r.appendChild(b); }
        var all = el('button', 'btn ghost', t('fc_restart')); all.type = 'button'; all.addEventListener('click', function () { runDeck(cards); });
        r.appendChild(all); out.appendChild(r);
      }
      function mark(ok) { if (ok) known++; else again.push(queue[pos]); pos++; flipped = false; draw(); }
      card.addEventListener('click', function () { flipped = !flipped; draw(); });
      bKnown.addEventListener('click', function () { mark(true); });
      bAgain.addEventListener('click', function () { mark(false); });
      bNext.addEventListener('click', function () { if (pos < queue.length - 1) { pos++; flipped = false; draw(); } });
      bPrev.addEventListener('click', function () { if (pos > 0) { pos--; flipped = false; draw(); } });
      bShuf.addEventListener('click', function () { queue = shuffle(queue); pos = 0; known = 0; again = []; flipped = false; draw(); });
      draw();
      card.focus();
    }

    $('#fcGo').addEventListener('click', async function () {
      if (busy) return;
      var text = $('#fcIn').value.trim(), n = clampInt($('#fcN').value, 3, 30, 10);
      if (!text) { status($('#fcStatus'), t('gen_need'), true); return; }
      busy = true; $('#fcGo').disabled = true; status($('#fcStatus'), t('gen_wait')); $('#fcOut').textContent = ''; $('#fcNote').textContent = '';
      try {
        var data = await SS.AI.chatJSON('flash', [
          { role: 'system', content: 'You write study flashcards. Reply with ONLY a JSON object of this shape: {"cards":[{"front":"question or term","back":"short answer or definition"}]}. Write every value in ' + SS.aiLang() + '. Make exactly ' + n + ' cards. Keep each front under 15 words and each back under 40 words. If the student pasted notes, base the cards only on those notes. If they gave just a topic, cover the most important ideas of that topic.' },
          { role: 'user', content: text.slice(0, 12000) }
        ]);
        var cards = (data.cards || []).map(function (c) { return { front: str(c.front || c.question || c.q), back: str(c.back || c.answer || c.a) }; }).filter(function (c) { return c.front && c.back; });
        if (!cards.length) throw Object.assign(new Error('json'), { code: 'json' });
        status($('#fcStatus'), ''); aiNote($('#fcNote')); runDeck(cards);
      } catch (e) { status($('#fcStatus'), SS.AI.errorText(e), true); }
      busy = false; $('#fcGo').disabled = false;
    });
  };

  /* ---------------- Syllabus Analyzer (openai/gpt-oss-120b) ---------------- */
  SS.tools.syl = function (panel) {
    panel.innerHTML =
      '<p class="sub" data-i18n="sy_sub"></p>' +
      '<div class="tool-form">' +
      '<div class="field"><label for="syIn" data-i18n="sy_in"></label><textarea id="syIn" rows="8"></textarea></div>' +
      '<div class="field"><label for="syFile" data-i18n="sy_file"></label><input id="syFile" type="file" accept=".txt,.md,text/plain,text/markdown"></div>' +
      '<button class="btn" id="syGo" type="button" data-i18n="sy_go"></button></div>' +
      '<p class="status" id="syStatus" role="status"></p><div id="syOut"></div><p class="ai-note" id="syNote"></p>';
    var $ = function (s) { return SS.$(s, panel); };
    var busy = false;

    $('#syFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      if (f.size > 2000000) { status($('#syStatus'), t('err_big'), true); return; }
      var r = new FileReader();
      r.onload = function () { $('#syIn').value = String(r.result || ''); status($('#syStatus'), ''); };
      r.onerror = function () { status($('#syStatus'), t('err_generic'), true); };
      r.readAsText(f);
    });

    function section(title) { var s = el('section', 'sy-sec'); s.appendChild(el('h3', null, title)); return s; }
    function list(items, ordered) { var l = el(ordered ? 'ol' : 'ul'); items.forEach(function (i) { l.appendChild(el('li', null, i)); }); return l; }

    function render(d) {
      var out = $('#syOut'); out.textContent = '';
      if (d.course) out.appendChild(el('h3', 'sy-course', str(d.course)));
      if (d.overview) { var s0 = section(t('sy_overview')); s0.appendChild(el('p', null, str(d.overview))); out.appendChild(s0); }
      var topics = Array.isArray(d.topics) ? d.topics : [];
      if (topics.length) {
        var s1 = section(t('sy_topics')), grid = el('div', 'sy-topics');
        topics.forEach(function (tp) {
          var c = el('article', 'sy-topic');
          var pri = str(tp.priority).toLowerCase(); if (pri !== 'high' && pri !== 'low') pri = 'medium';
          var head = el('div', 'sy-thead');
          head.appendChild(el('h4', null, str(tp.title)));
          head.appendChild(el('span', 'chipx pri-' + pri, t('sy_pri_' + pri)));
          c.appendChild(head);
          var hrs = Number(tp.hours); if (hrs > 0) c.appendChild(el('p', 'sy-hours', hrs + ' h'));
          if (Array.isArray(tp.subtopics) && tp.subtopics.length) c.appendChild(list(tp.subtopics.map(str)));
          var act = el('div', 'sy-act');
          var bf = el('button', 'btn ghost', t('sy_to_cards')); bf.type = 'button';
          bf.addEventListener('click', function () { SS.tools.openTab('flash'); SS.tools.flashFill(str(tp.title) + (tp.subtopics ? ': ' + tp.subtopics.map(str).join(', ') : '')); });
          var be = el('button', 'btn ghost', t('sy_to_exam')); be.type = 'button';
          be.addEventListener('click', function () { SS.tools.openTab('exam'); SS.tools.examFill(str(tp.title) + (tp.subtopics ? ': ' + tp.subtopics.map(str).join(', ') : '')); });
          act.append(bf, be); c.appendChild(act);
          grid.appendChild(c);
        });
        s1.appendChild(grid); out.appendChild(s1);
      }
      var dates = (Array.isArray(d.dates) ? d.dates : []).filter(function (x) { return x && (x.item || x.date); });
      if (dates.length) { var s2 = section(t('sy_dates')); s2.appendChild(list(dates.map(function (x) { return (x.date ? str(x.date) + ': ' : '') + str(x.item); }))); out.appendChild(s2); }
      if (Array.isArray(d.order) && d.order.length) { var s3 = section(t('sy_order')); s3.appendChild(list(d.order.map(str), true)); out.appendChild(s3); }
      if (Array.isArray(d.tips) && d.tips.length) { var s4 = section(t('sy_tips')); s4.appendChild(list(d.tips.map(str))); out.appendChild(s4); }
      var tr = el('div', 'sy-teach');
      var bt = el('button', 'btn', t('sy_teach')); bt.type = 'button';
      bt.addEventListener('click', function () { SS.tools.openTab('chat'); if (SS.tools.chatNote) SS.tools.chatNote(t('sy_started', { course: SS.syllabus.course() })); });
      tr.appendChild(bt); out.appendChild(tr);
    }

    $('#syGo').addEventListener('click', async function () {
      if (busy) return;
      var text = $('#syIn').value.trim();
      if (!text) { status($('#syStatus'), t('gen_need'), true); return; }
      busy = true; $('#syGo').disabled = true; status($('#syStatus'), t('gen_wait')); $('#syOut').textContent = ''; $('#syNote').textContent = '';
      try {
        var d = await SS.AI.chatJSON('syllabus', [
          { role: 'system', content: 'You analyze course syllabi for students. Reply with ONLY a JSON object of this shape: {"course":string,"overview":string (2-3 sentences),"topics":[{"title":string,"subtopics":[string],"hours":number (estimated study hours),"priority":"high"|"medium"|"low"}],"dates":[{"item":string,"date":string}],"order":[string (topic titles in a sensible study order)],"tips":[string (3-5 short, practical tips)]}. Write every text value in ' + SS.aiLang() + '. Take dates only from the syllabus text and use an empty "dates" array if there are none. Do not invent topics that are not in the syllabus.' },
          { role: 'user', content: text.slice(0, 24000) }
        ]);
        status($('#syStatus'), ''); aiNote($('#syNote')); render(d); SS.syllabus.set(d); SS.toast(t('sy_started', { course: SS.syllabus.course() }));
      } catch (e) { status($('#syStatus'), SS.AI.errorText(e), true); }
      busy = false; $('#syGo').disabled = false;
    });
  };

  /* ---------------- Exam Generator (openai/gpt-oss-120b) ---------------- */
  SS.tools.exam = function (panel) {
    panel.innerHTML =
      '<p class="sub" data-i18n="eg_sub"></p>' +
      '<div class="tool-form">' +
      '<div class="field"><label for="egIn" data-i18n="eg_in"></label><textarea id="egIn" rows="5" data-i18n-ph="fc_in_ph"></textarea></div>' +
      '<div class="row2"><div class="field narrow"><label for="egN" data-i18n="eg_n"></label><input id="egN" type="number" min="3" max="20" value="8"></div>' +
      '<div class="field narrow"><label for="egD" data-i18n="eg_diff"></label><select id="egD"><option value="easy" data-i18n="eg_easy"></option><option value="medium" selected data-i18n="eg_medium"></option><option value="hard" data-i18n="eg_hard"></option></select></div></div>' +
      '<fieldset class="types"><legend data-i18n="eg_types"></legend>' +
      '<label class="check"><input type="checkbox" id="egMcq" checked><span data-i18n="eg_mcq"></span></label>' +
      '<label class="check"><input type="checkbox" id="egShort" checked><span data-i18n="eg_short"></span></label>' +
      '<label class="check"><input type="checkbox" id="egTf"><span data-i18n="eg_tf"></span></label></fieldset>' +
      '<button class="btn" id="egGo" type="button" data-i18n="eg_make"></button></div>' +
      '<p class="status" id="egStatus" role="status"></p><div id="egOut"></div><p class="ai-note" id="egNote"></p>';
    var $ = function (s) { return SS.$(s, panel); };
    var busy = false;
    SS.tools.examFill = function (text) { $('#egIn').value = text; };

    function normalize(d) {
      var qs = (Array.isArray(d.questions) ? d.questions : []).map(function (q) {
        var type = str(q.type).toLowerCase();
        if (type.indexOf('mc') === 0 || type.indexOf('multiple') === 0) type = 'mcq';
        else if (type.indexOf('tf') === 0 || type.indexOf('true') === 0) type = 'tf';
        else type = 'short';
        var o = { type: type, q: str(q.q || q.question), why: str(q.explanation || q.why) };
        if (type === 'mcq') {
          o.options = (Array.isArray(q.options) ? q.options : []).map(str);
          var a = q.answer; var idx = typeof a === 'number' ? a : o.options.indexOf(str(a));
          if (idx < 0 && /^[A-Da-d]$/.test(str(a).trim())) idx = str(a).trim().toLowerCase().charCodeAt(0) - 97;
          o.answer = idx; if (o.options.length < 2 || idx < 0 || idx >= o.options.length) return null;
        } else if (type === 'tf') {
          var v = q.answer; o.answer = (v === true || str(v).toLowerCase() === 'true');
        } else { o.answer = str(q.answer); }
        return o.q ? o : null;
      }).filter(Boolean);
      return { title: str(d.title), questions: qs };
    }

    function render(exam) {
      var out = $('#egOut'); out.textContent = '';
      if (exam.title) out.appendChild(el('h3', 'sy-course', exam.title));
      var boxes = [];
      exam.questions.forEach(function (q, i) {
        var b = el('article', 'eq');
        b.appendChild(el('p', 'eq-q', (i + 1) + '. ' + q.q));
        var input;
        if (q.type === 'mcq') {
          input = el('div', 'eq-opts');
          q.options.forEach(function (o, k) {
            var l = el('label', 'check'); var r = el('input'); r.type = 'radio'; r.name = 'eq' + i; r.value = String(k);
            l.append(r, el('span', null, o)); input.appendChild(l);
          });
        } else if (q.type === 'tf') {
          input = el('div', 'eq-opts');
          [['true', t('eg_true')], ['false', t('eg_false')]].forEach(function (o) {
            var l = el('label', 'check'); var r = el('input'); r.type = 'radio'; r.name = 'eq' + i; r.value = o[0];
            l.append(r, el('span', null, o[1])); input.appendChild(l);
          });
        } else {
          input = el('textarea'); input.rows = 3; input.setAttribute('aria-label', t('eg_your'));
        }
        b.appendChild(input);
        var fb = el('div', 'eq-fb'); fb.hidden = true; b.appendChild(fb);
        out.appendChild(b); boxes.push({ q: q, box: b, input: input, fb: fb });
      });
      var row = el('div', 'fc-actions');
      var bSub = el('button', 'btn', t('eg_submit')); bSub.type = 'button';
      var bRev = el('button', 'btn ghost', t('eg_reveal')); bRev.type = 'button';
      var bNew = el('button', 'btn ghost', t('eg_new')); bNew.type = 'button';
      var score = el('p', 'eq-score'); score.setAttribute('role', 'status');
      row.append(bSub, bRev, bNew); out.append(row, score);

      function modelAnswer(q) {
        if (q.type === 'mcq') return q.options[q.answer];
        if (q.type === 'tf') return q.answer ? t('eg_true') : t('eg_false');
        return q.answer;
      }
      function show(x, verdict) {
        x.fb.hidden = false; x.fb.textContent = '';
        if (verdict) { x.fb.appendChild(el('strong', verdict === 'ok' ? 'ok' : 'bad', verdict === 'ok' ? t('eg_correct') : t('eg_wrong'))); x.fb.appendChild(document.createTextNode(' ')); }
        x.fb.appendChild(el('span', null, t('eg_model') + ': ' + modelAnswer(x.q)));
        if (x.q.why) x.fb.appendChild(el('p', null, t('eg_why') + ': ' + x.q.why));
        x.box.classList.toggle('is-ok', verdict === 'ok'); x.box.classList.toggle('is-bad', verdict === 'bad');
      }
      bSub.addEventListener('click', function () {
        var right = 0, total = 0;
        boxes.forEach(function (x) {
          if (x.q.type === 'short') { show(x, null); return; }
          total++;
          var picked = SS.$('input:checked', x.box), ok = false;
          if (picked) ok = x.q.type === 'mcq' ? Number(picked.value) === x.q.answer : (picked.value === 'true') === x.q.answer;
          if (ok) right++;
          show(x, ok ? 'ok' : 'bad');
        });
        if (total) score.textContent = t('eg_score', { s: right, t: total });
      });
      bRev.addEventListener('click', function () { boxes.forEach(function (x) { show(x, null); }); });
      bNew.addEventListener('click', function () { out.textContent = ''; score.textContent = ''; $('#egIn').focus(); });
    }

    $('#egGo').addEventListener('click', async function () {
      if (busy) return;
      var text = $('#egIn').value.trim(), n = clampInt($('#egN').value, 3, 20, 8), diff = $('#egD').value;
      var types = []; if ($('#egMcq').checked) types.push('mcq'); if ($('#egShort').checked) types.push('short'); if ($('#egTf').checked) types.push('tf');
      if (!text || !types.length) { status($('#egStatus'), t('gen_need'), true); return; }
      busy = true; $('#egGo').disabled = true; status($('#egStatus'), t('gen_wait')); $('#egOut').textContent = ''; $('#egNote').textContent = '';
      try {
        var d = await SS.AI.chatJSON('exam', [
          { role: 'system', content: 'You write practice exams for students. Reply with ONLY a JSON object of this shape: {"title":string,"questions":[{"type":"mcq"|"short"|"tf","q":string,"options":[string,string,string,string] (mcq only),"answer": (mcq: integer index 0-3 of the correct option; tf: true or false; short: a concise model answer string),"explanation":string (one or two sentences)}]}. Write exactly ' + n + ' questions at ' + diff + ' difficulty, using only these types: ' + types.join(', ') + ', mixed in a sensible order. Write every text value in ' + SS.aiLang() + '. Base the questions on the material the student gives. Make the wrong options in multiple choice plausible.' },
          { role: 'user', content: text.slice(0, 16000) }
        ]);
        var exam = normalize(d);
        if (!exam.questions.length) throw Object.assign(new Error('json'), { code: 'json' });
        status($('#egStatus'), ''); aiNote($('#egNote')); render(exam);
      } catch (e) { status($('#egStatus'), SS.AI.errorText(e), true); }
      busy = false; $('#egGo').disabled = false;
    });
  };
})();
