(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Languages ---------- */
  var LANGS = [
    { code: 'en', native: 'English', ai: 'English', sp: 'en-US' },
    { code: 'hi', native: 'हिन्दी', ai: 'Hindi', sp: 'hi-IN' },
    { code: 'zh', native: '中文（普通话）', ai: 'Mandarin Chinese (Simplified)', sp: 'zh-CN' },
    { code: 'ar', native: 'العربية', ai: 'Arabic', sp: 'ar-SA', rtl: true },
    { code: 'ru', native: 'Русский', ai: 'Russian', sp: 'ru-RU' },
    { code: 'ml', native: 'മലയാളം', ai: 'Malayalam', sp: 'ml-IN' },
    { code: 'te', native: 'తెలుగు', ai: 'Telugu', sp: 'te-IN' },
    { code: 'fr', native: 'Français', ai: 'French', sp: 'fr-FR' },
    { code: 'es', native: 'Español', ai: 'Spanish', sp: 'es-ES' },
    { code: 'id', native: 'Bahasa Indonesia', ai: 'Indonesian', sp: 'id-ID' }
  ];
  var CODES = LANGS.map(function (l) { return l.code; });
  var TZ = {
    'Asia/Kolkata': ['IN', 'hi'], 'Asia/Calcutta': ['IN', 'hi'],
    'Asia/Dubai': ['AE', 'ar'], 'Asia/Muscat': ['OM', 'ar'], 'Asia/Riyadh': ['SA', 'ar'], 'Asia/Qatar': ['QA', 'ar'],
    'Asia/Kuwait': ['KW', 'ar'], 'Asia/Bahrain': ['BH', 'ar'], 'Asia/Baghdad': ['IQ', 'ar'], 'Asia/Amman': ['JO', 'ar'],
    'Asia/Beirut': ['LB', 'ar'], 'Africa/Cairo': ['EG', 'ar'], 'Africa/Casablanca': ['MA', 'ar'], 'Africa/Algiers': ['DZ', 'ar'], 'Africa/Tunis': ['TN', 'ar'],
    'Asia/Shanghai': ['CN', 'zh'], 'Asia/Chongqing': ['CN', 'zh'], 'Asia/Taipei': ['TW', 'zh'],
    'Europe/Moscow': ['RU', 'ru'], 'Europe/Kaliningrad': ['RU', 'ru'], 'Europe/Samara': ['RU', 'ru'], 'Asia/Yekaterinburg': ['RU', 'ru'],
    'Asia/Novosibirsk': ['RU', 'ru'], 'Asia/Krasnoyarsk': ['RU', 'ru'], 'Asia/Irkutsk': ['RU', 'ru'], 'Asia/Vladivostok': ['RU', 'ru'],
    'Asia/Jakarta': ['ID', 'id'], 'Asia/Makassar': ['ID', 'id'], 'Asia/Jayapura': ['ID', 'id'], 'Asia/Pontianak': ['ID', 'id'],
    'Europe/Paris': ['FR', 'fr'], 'Europe/Madrid': ['ES', 'es'], 'America/Mexico_City': ['MX', 'es'], 'America/Bogota': ['CO', 'es'],
    'America/Lima': ['PE', 'es'], 'America/Argentina/Buenos_Aires': ['AR', 'es'], 'America/Santiago': ['CL', 'es'],
    'America/Caracas': ['VE', 'es'], 'America/Havana': ['CU', 'es']
  };
  function navLangs() {
    var out = [];
    try { (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).forEach(function (l) { if (l) out.push(String(l)); }); } catch (e) {}
    return out;
  }
  function baseCode(l) { return String(l).toLowerCase().split('-')[0]; }
  function detect() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    var navs = navLangs();
    var hit = TZ[tz];
    if (hit) {
      if (hit[0] === 'IN') {
        for (var i = 0; i < navs.length; i++) { var b = baseCode(navs[i]); if (b === 'ml' || b === 'te') return { lang: b, cc: 'IN' }; }
      }
      return { lang: hit[1], cc: hit[0] };
    }
    for (var j = 0; j < navs.length; j++) {
      var c = baseCode(navs[j]);
      if (CODES.indexOf(c) > -1) {
        var cc = null;
        try { cc = new Intl.Locale(navs[j]).region || null; } catch (e) {}
        return { lang: c, cc: cc };
      }
    }
    return { lang: 'en', cc: null };
  }

  var auto = LS.get('ss_auto') !== '0';
  var manual = LS.get('ss_lang');
  if (CODES.indexOf(manual) < 0) manual = 'en';
  var det = detect();
  var lang = auto ? det.lang : manual;

  function t(key, vars) {
    var pack = window.I18N || {};
    var s = (pack[lang] && pack[lang][key] != null) ? pack[lang][key] : (pack.en && pack.en[key] != null ? pack.en[key] : key);
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function langInfo() { return LANGS.filter(function (l) { return l.code === lang; })[0] || LANGS[0]; }
  function regionName(inEnglish) {
    if (!det.cc) return '';
    try { return new Intl.DisplayNames([inEnglish ? 'en' : lang], { type: 'region' }).of(det.cc) || ''; } catch (e) { return ''; }
  }
  var regionOverride = null;

  /* ---------- State ---------- */
  var user = LS.get('ss_user') === '1' ? { name: 'John Doe', initial: 'J' } : null;
  var langCbs = [], authCbs = [];

  /* ---------- Modals ---------- */
  var stack = [], focusBack = [];
  function openM(ov, opener) {
    ov.hidden = false;
    stack.push(ov);
    focusBack.push(opener || document.activeElement);
    document.body.style.overflow = 'hidden';
    var f = $('[data-autofocus]', ov) || $('.x', ov);
    if (f) f.focus();
  }
  function closeM(ov) {
    if (ov.hidden) return;
    ov.hidden = true;
    var i = stack.indexOf(ov);
    if (i > -1) stack.splice(i, 1);
    var back = focusBack.pop();
    if (!stack.length) document.body.style.overflow = '';
    if (ov.id === 'ovTerms') { $('#termsOk').checked = false; $('#termsGo').disabled = true; }
    if (back && back.focus) { try { back.focus(); } catch (e) {} }
  }
  $$('.overlay').forEach(function (ov) {
    ov.addEventListener('mousedown', function (e) { if (e.target === ov && ov.id !== 'ovTerms') closeM(ov); });
    $$('[data-close]', ov).forEach(function (b) { b.addEventListener('click', function () { closeM(ov); }); });
  });
  document.addEventListener('keydown', function (e) {
    var top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { closeM(top); return; }
    if (e.key === 'Tab') {
      var f = $$('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]', top).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  var toastTimer;
  function toast(msg) {
    var n = $('#toast'); n.textContent = msg; n.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { n.hidden = true; }, 2600);
  }

  /* ---------- Colors ---------- */
  var BG = ['#FFFFFF', '#F6F9FF', '#EEF4FF', '#E8F5FF', '#E6FAF5', '#EAF7EA', '#F4FAE3', '#FFF9DB', '#FFF1E0', '#FFE9E5', '#FDEBF3', '#F3EAFD', '#F2F0EB', '#EDEDED', '#E3E8EF', '#DDEBFF',
    '#0B1220', '#0E1726', '#101820', '#0F1F1C', '#14201A', '#1A1F14', '#221E12', '#261A14', '#2A1717', '#2A1424', '#1F1633', '#181830', '#121212', '#1C1C1E', '#232B38', '#000000'];
  var MAIN = ['#1456F0', '#2563EB', '#0EA5E9', '#0891B2', '#0D9488', '#059669', '#16A34A', '#65A30D', '#CA8A04', '#D97706', '#EA580C', '#DC2626', '#E11D48', '#DB2777', '#C026D3', '#9333EA',
    '#7C3AED', '#4F46E5', '#1E3A8A', '#0F766E', '#166534', '#854D0E', '#9A3412', '#991B1B', '#831843', '#581C87', '#334155', '#475569', '#111827', '#5B8CFF', '#38BDF8', '#FBBF24'];
  var chosenBg = LS.get('ss_bg'), chosenMain = LS.get('ss_main');
  if (BG.indexOf(chosenBg) < 0) chosenBg = null;
  if (MAIN.indexOf(chosenMain) < 0) chosenMain = null;

  function rgb(hex) { var h = String(hex).trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); if (!/^[0-9a-f]{6}$/i.test(h)) return null; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lum(hex) {
    var c = rgb(hex); if (!c) return 0.5;
    var l = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  function recomputeAccent() {
    var root = document.documentElement, cs = getComputedStyle(root);
    var bg = cs.getPropertyValue('--bg').trim(), fg = cs.getPropertyValue('--fg').trim(), main = cs.getPropertyValue('--main').trim();
    if (!rgb(bg) || !rgb(main)) return;
    root.style.setProperty('--accent-text', contrast(main, bg) >= 3 ? main : fg);
  }
  function applyColors() {
    var s = document.documentElement.style;
    if (chosenBg) {
      var light = lum(chosenBg) > 0.4;
      s.setProperty('--bg', chosenBg);
      s.setProperty('--fg', light ? '#0E1A33' : '#E8EEFB');
      s.setProperty('--danger', light ? '#C4281C' : '#FF8179');
      s.setProperty('color-scheme', light ? 'light' : 'dark');
    } else { ['--bg', '--fg', '--danger', 'color-scheme'].forEach(function (p) { s.removeProperty(p); }); }
    if (chosenMain) {
      s.setProperty('--main', chosenMain);
      s.setProperty('--on-main', contrast(chosenMain, '#FFFFFF') >= contrast(chosenMain, '#0B1220') ? '#FFFFFF' : '#0B1220');
    } else { ['--main', '--on-main'].forEach(function (p) { s.removeProperty(p); }); }
    s.removeProperty('--accent-text');
    recomputeAccent();
    $$('#swBg .sw').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === chosenBg)); });
    $$('#swMain .sw').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === chosenMain)); });
  }
  function buildSwatches(box, list, onPick) {
    list.forEach(function (c) {
      var b = el('button', 'sw'); b.type = 'button'; b.style.background = c; b.dataset.c = c;
      b.setAttribute('aria-label', c); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { onPick(c); });
      box.appendChild(b);
    });
  }
  buildSwatches($('#swBg'), BG, function (c) { chosenBg = c; LS.set('ss_bg', c); applyColors(); });
  buildSwatches($('#swMain'), MAIN, function (c) { chosenMain = c; LS.set('ss_main', c); applyColors(); });
  $('#resetColors').addEventListener('click', function () { chosenBg = chosenMain = null; LS.del('ss_bg'); LS.del('ss_main'); applyColors(); });
  try {
    new MutationObserver(recomputeAccent).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { setTimeout(recomputeAccent, 0); });
  } catch (e) {}

  /* ---------- Home content ---------- */
  var TEAM = [
    ['Eashan Falnikar', 'EF', 'role_eashan'], ['Vivaan Agrawal', 'VA', 'role_vivaan'], ['Madhav Hissaria', 'MH', 'role_madhav'],
    ['Vehan Markandeya', 'VM', 'role_vehan'], ['Aaradhya Soni', 'AS', 'role_aaradhya']
  ];
  var PLANS = [
    { id: 'private', name: 'p_private', price: 'AED 5', unit: 'per_student', alt: '₹120 · $1.36' },
    { id: 'ngo', name: 'p_ngo', price: 'AED 3', unit: 'per_student', alt: '₹72 · $0.82' },
    { id: 'single', name: 'p_single', price: 'AED 7', unit: 'per_month', alt: '₹168 · $1.91' }
  ];
  var VR = [
    { id: 'basic', name: 'EduPulse Basic', desc: 'vr_basic_d', price: ['AED 4–8'], alt: 'INR 86–172' },
    { id: 'mobile', name: 'EduPulse Mobile Pro', desc: 'vr_mpro_d', price: ['AED 34–68'], alt: 'INR 800–1,800', note: 'market_note' },
    { id: 'pro', name: 'EduPulse Pro', desc: 'vr_pro_d', lines: ['pro_from', 'pro_upto'] }
  ];

  function tile(heading, onOpen) {
    var a = el('article', 'tile');
    a.tabIndex = 0; a.setAttribute('role', 'button');
    a.appendChild(el('h3', null, heading));
    var warn = el('p', 'warn'); warn.setAttribute('role', 'alert');
    a._warn = warn; a._timer = null;
    function go() {
      if (!user) {
        warn.textContent = t('please_login');
        a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
        clearTimeout(a._timer); a._timer = setTimeout(function () { warn.textContent = ''; a.classList.remove('shake'); }, 2800);
      } else { onOpen(a); }
    }
    a.addEventListener('click', go);
    a.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return a;
  }
  function renderContent() {
    var tg = $('#teamGrid'); tg.textContent = '';
    TEAM.forEach(function (m) {
      var c = el('article', 'person');
      c.appendChild(el('div', 'ini', m[1]));
      c.appendChild(el('h3', null, m[0]));
      c.appendChild(el('p', null, t(m[2])));
      tg.appendChild(c);
    });
    var pg = $('#planGrid'); pg.textContent = '';
    PLANS.forEach(function (p) {
      var a = tile(t(p.name), function (n) { openBuy('plan', p, n); });
      var pr = el('div', 'price', p.price); pr.appendChild(el('small', null, t(p.unit)));
      a.appendChild(pr);
      a.appendChild(el('div', 'alt-cur', p.alt));
      a.appendChild(a._warn);
      pg.appendChild(a);
    });
    var vg = $('#vrGrid'); vg.textContent = '';
    VR.forEach(function (v) {
      var a = tile(v.name, function (n) { openBuy('vr', v, n); });
      a.appendChild(el('p', 'desc', t(v.desc)));
      if (v.lines) {
        v.lines.forEach(function (k) { a.appendChild(el('div', 'price sm', t(k))); });
      } else {
        a.appendChild(el('div', 'price', v.price[0]));
        a.appendChild(el('div', 'alt-cur', v.alt));
      }
      if (v.note) a.appendChild(el('p', 'note', t(v.note)));
      a.appendChild(a._warn);
      vg.appendChild(a);
    });
  }

  /* ---------- Terms ---------- */
  function buildTerms() {
    var box = $('#termsBox'); box.textContent = '';
    box.appendChild(el('p', null, 'Last updated: ' + window.TERMS_UPDATED));
    window.TERMS.forEach(function (s, i) {
      box.appendChild(el('h3', null, (i + 1) + '. ' + s.h));
      s.p.forEach(function (p) {
        if (typeof p === 'string') box.appendChild(el('p', null, p));
        else { var ul = el('ul'); p.ul.forEach(function (li) { ul.appendChild(el('li', null, li)); }); box.appendChild(ul); }
      });
    });
  }
  $('#termsOk').addEventListener('change', function (e) { $('#termsGo').disabled = !e.target.checked; });
  $('#termsGo').addEventListener('click', function () {
    if (!$('#termsOk').checked) return;
    user = { name: 'John Doe', initial: 'J' };
    LS.set('ss_user', '1');
    closeM($('#ovTerms'));
    renderAuth();
  });

  /* ---------- Auth ---------- */
  var logging = false;
  $('#loginBtn').addEventListener('click', function () {
    if (logging) return;
    logging = true;
    var b = $('#loginBtn'); b.disabled = true; $('#loginLabel').textContent = t('logging_in');
    setTimeout(function () {
      logging = false; b.disabled = false; $('#loginLabel').textContent = t('login');
      openM($('#ovTerms'), b);
    }, 900);
  });
  $('#profileBtn').addEventListener('click', function (e) { openM($('#ovProfile'), e.currentTarget); });
  $('#logoutBtn').addEventListener('click', function () {
    user = null; LS.del('ss_user'); closeM($('#ovProfile')); renderAuth();
    if (view !== 'home') showView('home');
  });
  function renderAuth() {
    $('#loginBtn').hidden = !!user;
    $('#hello').hidden = !user; $('#openTermBtn').hidden = !user; $('#profileBtn').hidden = !user;
    $('#mainNav').hidden = !user;
    if (user) $('#hello').textContent = t('hello', { name: user.name });
    authCbs.forEach(function (f) { try { f(!!user); } catch (e) { console.error(e); } });
  }

  /* ---------- Settings dialog ---------- */
  var sel = $('#langSel');
  LANGS.forEach(function (l) { var o = el('option', null, l.native); o.value = l.code; sel.appendChild(o); });
  $('#settingsBtn').addEventListener('click', function (e) { openM($('#ovSettings'), e.currentTarget); });
  sel.addEventListener('change', function () { auto = false; manual = sel.value; LS.set('ss_auto', '0'); LS.set('ss_lang', manual); applyLang(); });
  $('#autoLoc').addEventListener('change', function (e) { auto = e.target.checked; LS.set('ss_auto', auto ? '1' : '0'); applyLang(); });
  function goEn() { auto = false; manual = 'en'; LS.set('ss_auto', '0'); LS.set('ss_lang', 'en'); applyLang(); }
  $('#toEnBtn').addEventListener('click', goEn);
  $('#toEnTop').addEventListener('click', goEn);
  function enLabel(b) {
    b.textContent = '';
    var e = el('span', null, 'Switch to English'); e.lang = 'en'; e.dir = 'ltr';
    var c = el('span', null, ' (' + t('translate_en') + ')');
    b.appendChild(e); b.appendChild(c);
  }
  function syncEn() { enLabel($('#toEnBtn')); enLabel($('#toEnTop')); var other = lang !== 'en'; $('#toEnBtn').hidden = !(other && view === 'home'); $('#toEnTop').hidden = !(other && view !== 'home'); }
  LS.del('ss_groq_key'); /* custom keys are no longer supported; the site uses the key in config.js */

  /* ---------- Language ---------- */
  function applyI18n(root) {
    $$('[data-i18n]', root).forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    $$('[data-i18n-ph]', root).forEach(function (n) { n.placeholder = t(n.getAttribute('data-i18n-ph')); });
    $$('[data-i18n-aria]', root).forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
  }
  function applyLang() {
    lang = auto ? det.lang : manual;
    var info = langInfo(), root = document.documentElement;
    root.lang = lang; root.dir = info.rtl ? 'rtl' : 'ltr';
    applyI18n(document);
    var label;
    if (auto) {
      var country = regionName(false);
      label = t('localized_to') + ': ' + info.native + (country ? ' · ' + country : '');
    } else { label = t('language_set') + ': ' + info.native; }
    $('#localeLabel').textContent = label;
    syncEn();
    sel.value = lang; $('#autoLoc').checked = auto;
    var note = $('#termsNote'); note.textContent = t('terms_en_note'); note.hidden = lang === 'en';
    $('#peek').setAttribute('aria-label', t('nav_terminal'));
    renderContent(); renderAuth();
    if (!logging) $('#loginLabel').textContent = t('login');
    langCbs.forEach(function (f) { try { f(lang); } catch (e) { console.error(e); } });
  }

  /* ---------- Purchase (placeholder) ---------- */
  function today() { var d = new Date(), m = d.getMonth() + 1, day = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day; }
  function openBuy(kind, item, opener) {
    var body = $('#buyBody'); body.textContent = '';
    $('#tBuy').textContent = kind === 'plan' ? t('buy_plan', { name: t(item.name) }) : t('buy_item', { name: item.name });
    var form = el('form'); form.setAttribute('autocomplete', 'off');
    body.appendChild(el('p', 'demo', t('demo_note')));
    body.appendChild(form);
    var qty = null;
    function field(id, labelKey, type, attrs) {
      var w = el('div', 'field'); var l = el('label', null, t(labelKey)); l.htmlFor = 'b_' + id;
      var i = el(type === 'select' ? 'select' : 'input'); i.id = 'b_' + id;
      if (type !== 'select') i.type = type;
      Object.keys(attrs || {}).forEach(function (k) { i.setAttribute(k, attrs[k]); });
      w.append(l, i); form.appendChild(w); form.lastChild.style.marginBottom = '0.9rem'; return i;
    }
    if (kind === 'vr' && item.id === 'pro') {
      var m = field('model', 'f_model', 'select', { required: '' });
      [['orig', 'm_orig'], ['eight', 'm_8']].forEach(function (o) { var op = el('option', null, t(o[1])); op.value = o[0]; m.appendChild(op); });
    }
    if (kind === 'vr') qty = field('qty', 'f_qty', 'number', { min: '0', max: '9999', step: '1', value: '1', required: '', inputmode: 'numeric' });
    var name = field('name', 'f_name', 'text', { required: '', autocomplete: 'off' });
    field('addr', 'f_address', 'text', { required: '', autocomplete: 'off' });
    if (kind === 'plan') field('start', 'f_start', 'date', { required: '', min: today(), value: today() });
    field('mail', 'f_email', 'email', { required: '', autocomplete: 'off' });
    var card = field('card', 'f_card', 'text', { required: '', inputmode: 'numeric', maxlength: '23', placeholder: '•••• •••• •••• ••••', autocomplete: 'off' });
    var foot = el('div', 'd-foot');
    var cancel = el('button', 'btn ghost', t('cancel')); cancel.type = 'button'; cancel.addEventListener('click', function () { closeM($('#ovBuy')); });
    var go = el('button', 'btn', kind === 'plan' ? t('subscribe') : t('purchase')); go.type = 'submit';
    foot.append(cancel, go); form.appendChild(foot);
    function digits() { return card.value.replace(/\D/g, ''); }
    function ok() {
      var q = true;
      if (qty) { var n = Number(qty.value); q = qty.value !== '' && Number.isInteger(n) && n > 0 && n <= 9999; }
      return form.checkValidity() && digits().length >= 12 && q;
    }
    function sync() { go.disabled = !ok(); }
    card.addEventListener('input', function () { card.value = digits().slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); sync(); });
    form.addEventListener('input', sync); form.addEventListener('change', sync);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ok()) return;
      var first = name.value.trim().split(/\s+/)[0] || '';
      body.textContent = '';
      body.appendChild(el('div', 'ok-mark', '✓'));
      body.appendChild(el('p', 'center', t('thanks', { name: first })));
      body.appendChild(el('p', 'demo', t('demo_done')));
      var d = el('div', 'd-foot'); var c = el('button', 'btn', t('done')); c.type = 'button'; c.addEventListener('click', function () { closeM($('#ovBuy')); }); d.appendChild(c); body.appendChild(d);
      c.focus();
    });
    sync();
    openM($('#ovBuy'), opener);
    name.setAttribute('data-autofocus', '');
  }

  /* ---------- Views and navigation ---------- */
  var HASH = { term: 'terminal', voice: 'voice', ledger: 'ledger', career: 'career', vr: 'vr' };
  var VIEWS = {};
  ['home', 'term', 'voice', 'ledger', 'career', 'vr'].forEach(function (n) { VIEWS[n] = { el: $('#v-' + n), inited: n === 'home' }; });
  var view = 'home';

  function showView(name, quiet) {
    if (!VIEWS[name]) name = 'home';
    if (name !== 'home' && !user) { if (!quiet) toast(t('please_login')); name = 'home'; }
    var prev = VIEWS[view];
    if (prev && prev.onHide && view !== name) { try { prev.onHide(); } catch (e) { console.error(e); } }
    view = name; syncEn();
    Object.keys(VIEWS).forEach(function (k) { VIEWS[k].el.hidden = k !== name; });
    var v = VIEWS[name];
    if (!v.inited && v.init) {
      v.inited = true;
      try { v.init(v.el); applyI18n(v.el); } catch (e) { console.error(e); }
    }
    if (v.onShow) { try { v.onShow(); } catch (e) { console.error(e); } }
    $$('#mainNav a').forEach(function (a) { if (a.getAttribute('data-view') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    try {
      var want = HASH[name] || '';
      if ((location.hash || '').replace('#', '') !== want) {
        if (want) location.hash = want; else history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (e) {}
  }
  $$('[data-view]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); showView(a.getAttribute('data-view')); });
  });
  $('#peek').addEventListener('click', function () { showView('term'); });
  $('#openTermBtn').addEventListener('click', function () { showView('term'); });
  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').replace('#', '');
    var name = 'home';
    Object.keys(HASH).forEach(function (k) { if (HASH[k] === h) name = k; });
    if (name !== view) showView(name, true);
  });

  /* ---------- Public API for the tool modules ---------- */
  var SS = window.SS = {
    $: $, $$: $$, el: el, LS: LS, t: t, toast: toast, openM: openM, closeM: closeM, applyI18n: applyI18n,
    lang: function () { return lang; },
    aiLang: function () { return langInfo().ai; },
    speakLang: function () { return langInfo().sp; },
    langs: LANGS,
    region: function (en) { return regionOverride != null ? regionOverride : regionName(en); },
    setRegion: function (r) { regionOverride = r; },
    user: function () { return user; },
    onLang: function (f) { langCbs.push(f); },
    onAuth: function (f) { authCbs.push(f); },
    registerView: function (name, def) { var v = VIEWS[name]; if (v) Object.keys(def).forEach(function (k) { v[k] = def[k]; }); },
    showView: showView,
    tools: {}
  };
  SS.start = function () {
    buildTerms();
    applyColors();
    applyLang();
    var h = (location.hash || '').replace('#', '');
    Object.keys(HASH).forEach(function (k) { if (HASH[k] === h) showView(k, true); });
  };
})();
