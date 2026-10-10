/* Ledger: the study planner, ported from the standalone Ledger site. */
(function () {
  'use strict';
  var SS = window.SS, el = SS.el, t = SS.t;
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var GRADES = [['elementary', 'lg_g_elem'], ['middle', 'lg_g_mid'], ['high', 'lg_g_high'], ['college', 'lg_g_col'], ['exam', 'lg_g_exam'], ['other', 'lg_g_other']];
  var answers = { name: '', age: null, grade: '', goals: '', subjects: [], days: [], hours: 2, start: '16:00' };
  var step = 0, schedule = null, activeDay = null, root, card, results, prog;
  var STEPS = [stepName, stepAge, stepGoal, stepSubjects, stepDays, stepRhythm];

  function draw() { card.hidden = false; results.hidden = true; buildProgress(); card.textContent = ''; STEPS[step](); SS.applyI18n(card); }
  function buildProgress() {
    prog.textContent = '';
    STEPS.forEach(function (_, i) { prog.appendChild(el('span', 'dot' + (i === step ? ' active' : i < step ? ' done' : ''))); });
  }
  function head(titleKey, subKey, vars) {
    card.appendChild(el('h2', 'q-title', t(titleKey, vars)));
    card.appendChild(el('p', 'sub', t(subKey)));
  }
  function nav(canNext, nextKey, onNext) {
    var row = el('div', 'nav-row');
    var back = el('button', 'btn ghost', t('lg_back')); back.type = 'button'; back.style.visibility = step === 0 ? 'hidden' : 'visible';
    back.addEventListener('click', function () { step--; draw(); });
    var next = el('button', 'btn', t(nextKey || 'lg_next')); next.type = 'button'; next.disabled = !canNext;
    next.addEventListener('click', onNext || go);
    row.append(back, next); card.appendChild(row);
    return next;
  }
  function go() { if (step < STEPS.length - 1) { step++; draw(); } else build(); }
  function field(labelKey, control) {
    var w = el('div', 'field'); var l = el('label', null, t(labelKey)); control.id = control.id || ('lg_' + Math.random().toString(36).slice(2, 8)); l.htmlFor = control.id;
    w.append(l, control); card.appendChild(w); return control;
  }

  function stepName() {
    head('lg_q_name', 'lg_q_name_s');
    var inp = el('input'); inp.type = 'text'; inp.value = answers.name; inp.placeholder = t('lg_name_ph'); inp.setAttribute('aria-label', t('lg_q_name'));
    card.appendChild(inp);
    var next = nav(!!answers.name);
    inp.addEventListener('input', function () { answers.name = inp.value.trim(); next.disabled = !answers.name; });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && answers.name) go(); });
    inp.focus();
  }
  function stepAge() {
    head('lg_q_age', 'lg_q_age_s', { name: answers.name });
    var age = el('input'); age.type = 'number'; age.min = 5; age.max = 99; age.value = answers.age || '';
    field('lg_age', age);
    var sel = el('select');
    GRADES.forEach(function (g) { var o = el('option', null, t(g[1])); o.value = g[0]; if (answers.grade === g[0]) o.selected = true; sel.appendChild(o); });
    field('lg_grade', sel);
    var next = nav(false);
    function check() { answers.age = parseInt(age.value, 10) || null; answers.grade = sel.value; next.disabled = !(answers.age && answers.grade); }
    age.addEventListener('input', check); sel.addEventListener('change', check);
    if (!answers.grade) answers.grade = sel.value;
    check();
  }
  function stepGoal() {
    head('lg_q_goal', 'lg_q_goal_s');
    var inp = el('input'); inp.type = 'text'; inp.value = answers.goals; inp.placeholder = t('lg_goal_ph'); inp.setAttribute('aria-label', t('lg_q_goal'));
    card.appendChild(inp);
    var next = nav(!!answers.goals.trim());
    inp.addEventListener('input', function () { answers.goals = inp.value.trim(); next.disabled = !answers.goals; });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && answers.goals) go(); });
    inp.focus();
  }
  function stepSubjects() {
    head('lg_q_subj', 'lg_q_subj_s');
    var ci = el('div', 'chip-input');
    var inp = el('input'); inp.type = 'text'; inp.placeholder = t('lg_subj_ph'); inp.setAttribute('aria-label', t('lg_q_subj'));
    var add = el('button', 'chip-add', '+'); add.type = 'button'; add.setAttribute('aria-label', '+');
    ci.append(inp, add);
    var chips = el('div', 'chips');
    card.append(ci, chips);
    var next = nav(answers.subjects.length > 0);
    function renderChips() {
      chips.textContent = '';
      answers.subjects.forEach(function (s, i) {
        var c = el('span', 'chip', s + ' ');
        var rm = el('button', null, '×'); rm.type = 'button'; rm.setAttribute('aria-label', '×');
        rm.addEventListener('click', function () { answers.subjects.splice(i, 1); renderChips(); next.disabled = answers.subjects.length === 0; });
        c.appendChild(rm); chips.appendChild(c);
      });
    }
    function addSubject() { var v = inp.value.trim(); if (v) { answers.subjects.push(v); inp.value = ''; renderChips(); next.disabled = false; } }
    add.addEventListener('click', addSubject);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSubject(); } });
    renderChips(); inp.focus();
  }
  function stepDays() {
    head('lg_q_days', 'lg_q_days_s');
    var dp = el('div', 'daypick');
    var next;
    DAYS.forEach(function (d) {
      var l = el('label'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = answers.days.indexOf(d) > -1;
      cb.addEventListener('change', function () {
        if (cb.checked) answers.days.push(d); else answers.days = answers.days.filter(function (x) { return x !== d; });
        next.disabled = answers.days.length === 0;
      });
      l.append(cb, el('span', null, t('d_' + d))); dp.appendChild(l);
    });
    card.appendChild(dp);
    next = nav(answers.days.length > 0);
  }
  function stepRhythm() {
    head('lg_q_rhythm', 'lg_q_rhythm_s');
    var h = el('input'); h.type = 'number'; h.min = 0.5; h.max = 10; h.step = 0.5; h.value = answers.hours; field('lg_hours', h);
    var s = el('input'); s.type = 'time'; s.value = answers.start; field('lg_start', s);
    card.appendChild(el('p', 'hint', t('lg_tip')));
    function sync() { answers.hours = parseFloat(h.value) || 1; answers.start = s.value || '16:00'; }
    h.addEventListener('input', sync); s.addEventListener('input', sync);
    nav(true, 'lg_build', function () { sync(); build(); });
  }

  function profile() {
    var g = answers.grade;
    if (g === 'elementary' || answers.age <= 10) return { study: 25, sb: 10, lb: 20, per: 2 };
    if (g === 'middle' || answers.age <= 13) return { study: 35, sb: 10, lb: 20, per: 3 };
    if (g === 'high' || answers.age <= 18) return { study: 45, sb: 10, lb: 20, per: 3 };
    return { study: 50, sb: 10, lb: 25, per: 4 };
  }
  function fmt(mins) {
    var h = Math.floor(mins / 60) % 24, m = mins % 60, ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function buildDay(startMins, totalMins, p) {
    var blocks = [], tt = startMins, remaining = totalMins, count = 0, si = 0;
    while (remaining >= p.study) {
      blocks.push({ kind: 'study', label: answers.subjects[si % answers.subjects.length], start: tt, len: p.study });
      tt += p.study; remaining -= p.study; count++; si++;
      if (remaining <= 0) break;
      var isLong = count % p.per === 0, bl = isLong ? p.lb : p.sb, kind = isLong ? 'long' : 'short';
      if (remaining < bl && remaining < p.study) { if (remaining > 0) { blocks.push({ kind: kind, start: tt, len: remaining }); tt += remaining; remaining = 0; } break; }
      blocks.push({ kind: kind, start: tt, len: bl }); tt += bl; remaining -= bl;
    }
    return blocks;
  }
  function build() {
    var p = profile(), parts = answers.start.split(':').map(Number), startMins = parts[0] * 60 + parts[1];
    var total = Math.round(answers.hours * 60 / 5) * 5;
    schedule = {};
    answers.days.forEach(function (d) { schedule[d] = buildDay(startMins, total, p); });
    activeDay = answers.days[0];
    showResults();
  }
  function showResults() {
    card.hidden = true; results.hidden = false; results.textContent = '';
    var week = (answers.hours * answers.days.length).toFixed(1), free = 7 - answers.days.length;
    var sum = el('div', 'summary');
    [[week + ' h', 'lg_stat_week'], [answers.days.length, 'lg_stat_days'], [answers.subjects.length, 'lg_stat_subj'], [free || '0', 'lg_stat_free']].forEach(function (x) {
      var s = el('div', 'stat'); s.appendChild(el('div', 'num', String(x[0]))); s.appendChild(el('div', 'lbl', t(x[1]))); sum.appendChild(s);
    });
    var tabs = el('div', 'day-tabs');
    answers.days.forEach(function (d) {
      var b = el('button', d === activeDay ? 'active' : '', t('d_' + d)); b.type = 'button';
      b.addEventListener('click', function () { activeDay = d; showResults(); });
      tabs.appendChild(b);
    });
    var tl = el('div', 'timeline');
    (schedule[activeDay] || []).forEach(function (b) {
      var row = el('div', 'block ' + (b.kind === 'study' ? 'study' : b.kind));
      row.appendChild(el('div', 'bar'));
      row.appendChild(el('div', 'time', fmt(b.start) + ' – ' + fmt(b.start + b.len)));
      var info = el('div');
      var label = b.kind === 'study' ? b.label : t(b.kind === 'long' ? 'lg_long' : 'lg_short');
      var sub = b.kind === 'study' ? t('lg_focus') : t(b.kind === 'long' ? 'lg_long_s' : 'lg_short_s');
      info.appendChild(el('div', 'what', label));
      info.appendChild(el('div', 'type', sub + ' · ' + t('lg_min', { n: b.len })));
      row.appendChild(info); tl.appendChild(row);
    });
    var act = el('div', 'fc-actions');
    var edit = el('button', 'btn ghost', t('lg_edit')); edit.type = 'button';
    edit.addEventListener('click', function () { step = 0; draw(); });
    var pr = el('button', 'btn', t('lg_print')); pr.type = 'button';
    pr.addEventListener('click', function () { try { window.print(); } catch (e) {} });
    act.append(edit, pr);
    results.append(sum, tabs, tl, act);
  }

  SS.registerView('ledger', {
    init: function (r) {
      root = r;
      r.innerHTML =
        '<div class="wrap tool-page ledger"><div class="term-head"><h1 data-i18n="lg_h"></h1><div class="lg-prog" id="lgProg" aria-hidden="true"></div><button class="btn ghost" id="lgHome" type="button" data-i18n="home"></button></div>' +
        '<div class="lg-card" id="lgCard"></div><div id="lgResults" hidden></div></div>';
      card = SS.$('#lgCard', r); results = SS.$('#lgResults', r); prog = SS.$('#lgProg', r);
      SS.$('#lgHome', r).addEventListener('click', function () { SS.showView('home'); });
      draw();
    }
  });
  SS.onLang(function () { if (!card) return; if (!results.hidden) showResults(); else draw(); });
})();
