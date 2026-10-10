/* The VR Hub, ported from the standalone VR Hub site. Links come from config.js. */
(function () {
  'use strict';
  var SS = window.SS, el = SS.el, t = SS.t;
  var SUBJECTS = [
    ['sub_chem', [['helium', 'e_helium'], ['hydrogen', 'e_hydrogen'], ['iron', 'e_iron'], ['copper', 'e_copper'], ['lithium', 'e_lithium']]],
    ['sub_bio', [['the_cell', 'e_cell']]],
    ['sub_geo', [['volcano', 'e_volcano', 'e_volcano_s']]],
    ['sub_phy', [['circuit', 'e_circuit', 'e_circuit_s'], ['thermal_expansion', 'e_thermal']]]
  ];
  var grids;

  function render() {
    if (!grids) return;
    var links = (window.SS_CONFIG && window.SS_CONFIG.VR_LINKS) || {};
    grids.textContent = '';
    SUBJECTS.forEach(function (s) {
      var box = el('div', 'vr-subject');
      box.appendChild(el('h3', null, t(s[0])));
      var g = el('div', 'vr-cards');
      s[1].forEach(function (x) {
        var url = links[x[0]];
        var a = el(url ? 'a' : 'div', 'vr-card');
        if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
        a.appendChild(el('span', 'vr-name', t(x[1])));
        if (x[2]) a.appendChild(el('span', 'vr-sub', t(x[2])));
        g.appendChild(a);
      });
      box.appendChild(g); grids.appendChild(box);
    });
  }

  SS.registerView('vr', {
    init: function (r) {
      r.innerHTML =
        '<div class="wrap tool-page vrhub">' +
        '<div class="term-head"><h1>The <span class="blue">VR Hub</span></h1><button class="btn ghost" id="vrHome" type="button" data-i18n="home"></button>' +
        '<p class="sub"><span data-i18n="vr2_by"></span> EduPulse&trade;</p></div>' +
        '<section class="vr-welcome"><h2 data-i18n="vr2_welcome"></h2><p data-i18n="vr2_p1"></p><p data-i18n="vr2_p2"></p><p data-i18n="vr2_p3"></p><p data-i18n="vr2_p4"></p></section>' +
        '<section><h2 data-i18n="vr2_exp"></h2><div id="vrGrids"></div></section>' +
        '<p class="hint" data-i18n="vr2_footer"></p></div>';
      grids = SS.$('#vrGrids', r);
      SS.$('#vrHome', r).addEventListener('click', function () { SS.showView('home'); });
      render();
    }
  });
  SS.onLang(render);
})();
