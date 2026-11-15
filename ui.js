/* 赢了反而亏 · 界面（ui.js）
 * 读 state → AppCore.compute → 把同一次输出画出来。页面自己不做利润计算。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'refund-bet:v1';
  var $ = function (id) { return document.getElementById(id); };
  var Y = A.yuan, P = A.pct, F = A.fmt;
  /* 折数小于 0.1 时写「不到 0.1 折」（极值结果卡目检：显示成「约 0.0 折」） */
  function zhe(d) { return d < 0.05 ? '不到 0.1 折' : '约 ' + d.toFixed(1) + ' 折'; }
  var FIELDS = ['event', 'price', 'cost', 'base', 'sales', 'fixed', 'refund', 'cap', 'prob'];
  var PRESETS = [
    { key: 'champ', name: '夺冠全额退（默认）', note: '虚构示例：一款 3,999 元的电视，平时一季卖 1,000 台；喊出「主队夺冠就全额退」估计能卖 1,600 台，活动花 5 万。你估夺冠概率 30%。', s: {} },
    { key: 'cap200', name: '同上，只退前 200 名', note: '同一场活动，只把退款名额限成前 200 个买家。', s: { cap: '200' } },
    { key: 'rain', name: '下雨就免单', note: '虚构示例：露营装备 299 元，成本 120 元，平时 500 单；「活动当天下雨就免单」估计 650 单，花 3,000 元。你估下雨概率 15%。', s: { event: '下雨', price: '299', cost: '120', base: '500', sales: '650', fixed: '3000', refund: '100', cap: '0', prob: '15' } },
    { key: 'long', name: '冷门出线退一半', note: '虚构示例：球衣 199 元，成本 80 元，平时 2,000 件，搞「出线就退一半」估计 3,500 件，花 2 万。你估概率只有 2%。', s: { event: '冷门球队出线', price: '199', cost: '80', base: '2000', sales: '3500', fixed: '20000', refund: '50', cap: '0', prob: '2' } }
  ];
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; Object.keys(p.s).forEach(function (f) { s[f] = p.s[f]; }); return s; }
  function presetKey(s) { var j = JSON.stringify(s); for (var i = 0; i < PRESETS.length; i++) if (JSON.stringify(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }

  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    FIELDS.forEach(function (k) { if (s[k] != null && typeof s[k] !== 'object') { d[k] = String(s[k]).slice(0, 24); any = true; } });
    return any ? d : null;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; } }
  var state = load() || A.defaultState();
  var out = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你自己填的数。';
  }
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fill(); update(); });
  function fill() { FIELDS.forEach(function (k) { if ($(k).value !== String(state[k])) $(k).value = state[k]; }); }
  FIELDS.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; update(); }); });
  function markErrors() {
    FIELDS.forEach(function (k) { $(k).classList.remove('bad'); });
    (out.errors || []).forEach(function (e) { var el = $(e.field); if (el) el.classList.add('bad'); });
  }
  function sign(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }
  function more(d) { return d >= 0 ? '比不搞多 ' + Y(d) : '比不搞少 ' + Y(-d); }

  function render() {
    var bad = !out.ok;
    $('errBox').classList.toggle('hide', !bad);
    $('res').classList.toggle('hide', bad);
    if (bad) { $('errBox').innerHTML = '<b>还算不了</b>：<ul>' + out.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    var o = out, ev = o.event;
    $('badge').className = 'badge ' + (o.worth ? 'win' : 'lose');
    $('badge').textContent = o.worth ? '划算' : '不划算';
    $('badgeSub').textContent = o.refundIf === 0 ? '没有退款风险' : (o.safe ? '万一' + ev + '也不亏本' : '万一' + ev + '会亏本');
    $('headline').textContent = o.headline;

    /* 决策树 */
    $('nNo').className = 'node ' + sign(o.P0) + (!o.worth ? ' best' : '');
    $('nNo').innerHTML = '<div class="t">不搞活动' + (!o.worth ? ' · 更好' : '') + '</div><div class="v">' + esc(Y(o.P0)) + '</div><div class="w">' + esc(F(o.N0) + ' 件 × 每件赚 ' + A.money(o.m) + ' 元') + '</div>';
    $('nYes').className = 'node chance' + (o.worth ? ' best' : '');
    $('nYes').innerHTML = '<div class="t">搞活动 · 期望' + (o.worth ? ' · 更好' : '') + '</div><div class="v">' + esc(Y(o.E)) + '</div><div class="w">' + esc(more(o.dE)) + '</div>';
    $('eN').textContent = ev + '没发生 · ' + P(1 - o.p);
    $('nN').className = 'node ' + sign(o.Pn);
    $('nN').innerHTML = '<div class="t">一分不退</div><div class="v">' + esc(Y(o.Pn)) + '</div><div class="w">' + esc(F(o.N1) + ' 件 × ' + A.money(o.m) + ' − 活动花费 ' + A.money(o.F)) + '</div>';
    $('eY').textContent = ev + '了 · ' + P(o.p);
    $('nY').className = 'node ' + sign(o.Py);
    $('nY').innerHTML = '<div class="t">退 ' + esc(F(o.R)) + ' 人 × ' + esc(P(o.r)) + '</div><div class="v">' + esc(Y(o.Py)) + '</div><div class="w">' + esc('一共退 ' + Y(o.refundIf) + (o.K > 0 && o.K < o.N1 ? '（名额 ' + F(o.K) + '）' : '')) + '</div>';
    requestAnimationFrame(drawLines);

    /* 关键数 */
    var k = [
      [o.pStar == null ? '—' : o.pStar >= 1 ? '任何概率' : o.pStar <= 0 ? '无' : '低于 ' + P(o.pStar), '概率低于这个才划算'],
      [(o.unitEM < 0 ? '亏 ' : '') + Y(Math.abs(o.unitEM)), o.unitEM < 0 ? '名额内每多卖一件，期望反而亏' : '名额内每多卖一件，期望多赚'],
      [o.need == null ? '卖多少都不够' : F(o.need) + ' 件', '最少卖到这么多才不比不搞差'],
      [Y(o.buyerPrice), '买家视角的期望到手价（' + zhe(o.discount) + '）']
    ];
    $('kpis').innerHTML = k.map(function (r, i) { return '<div class="kpi" id="kpi' + i + '"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>'; }).join('');

    /* 改一项 */
    $('acts').innerHTML = o.actions.length ? o.actions.map(function (a, i) {
      return '<button type="button" class="act" id="act_' + a.kind + '" data-a="' + i + '">→ ' + esc(a.text) + '<small>改完期望 ' + esc(Y(a.after)) + '，' + esc(more(a.afterD)) + '；万一' + esc(ev) + '：' + esc(Y(a.afterPy)) + '</small></button>';
    }).join('') : '<p class="note" id="noAct">' + (o.worth ? (o.safe ? '划算，而且万一' + ev + '也不亏本，不用改。' : '划算，但万一' + ev + '会亏本；扛不住的话看下面的说明。') : '活动多卖的毛利不够付活动花费，改退款条件救不回来。') + '</p>';
    var notes = [];
    if (o.unitEM < 0 && o.refundIf > 0) notes.push('名额内每多卖一件期望反而亏 ' + Y(-o.unitEM) + '（每件赚 ' + A.money(o.m) + ' 元，期望要退 ' + A.money(o.loss) + ' 元），卖得越多亏得越多，加销量没用。');
    if (o.worth && !o.safe) notes.push('期望划算不代表这一次一定赚：' + P(o.p) + ' 的情况下会亏 ' + Y(-o.Py) + '。');
    $('actNote').textContent = notes.join(' ');

    /* 敏感表 */
    $('grid').innerHTML = '<tr><th>概率 ＼ 退款</th>' + o.refunds.map(function (r) { return '<th>退 ' + r + '%</th>'; }).join('') + '</tr>' +
      o.grid.map(function (g) {
        return '<tr><th>' + g.prob + '%' + (g.cur ? ' ◀' : '') + '</th>' + g.cells.map(function (c) { return '<td class="' + (c.pass ? 'pass' : 'fail') + (c.cur ? ' cur' : '') + '">' + esc((c.d >= 0 ? '+' : '') + A.money(c.d)) + '</td>'; }).join('') + '</tr>';
      }).join('');
    var col = o.grid.map(function (g) { return g.cells.filter(function (c) { return c.refund === o.refunds[o.refunds.length - 1]; })[0]; });
    var okN = col.filter(function (c) { return c.pass; }).length;
    $('gridNote').textContent = '绿色是划算的格子。按现在的名额与销量，全额退那一列 ' + o.grid.length + ' 个概率里有 ' + okN + ' 个划算。' +
      (o.refunds.indexOf(o.refundPct) < 0 ? '（你填的退 ' + o.refundPct + '% 不在表里，表只用来看趋势。）' : '');

    drawChart(o);
  }

  function drawLines() {
    var svg = $('lines'), tree = $('tree');
    if (!svg || getComputedStyle(svg).display === 'none') return;
    var T = tree.getBoundingClientRect();
    function pt(id, side) { var r = $(id).getBoundingClientRect(); return [(side === 'r' ? r.right : r.left) - T.left, r.top + r.height / 2 - T.top]; }
    function seg(a, b, c) { var mx = (a[0] + b[0]) / 2; return '<path d="M' + a[0] + ',' + a[1] + ' C' + mx + ',' + a[1] + ' ' + mx + ',' + b[1] + ' ' + b[0] + ',' + b[1] + '" fill="none" stroke="' + c + '" stroke-width="2"/>'; }
    var r = pt('nRoot', 'r');
    svg.innerHTML = seg(r, pt('nNo', 'l'), '#8b919c') + seg(r, pt('nYes', 'l'), '#8b919c') + seg(pt('nYes', 'r'), pt('nN', 'l'), '#2457a6') + seg(pt('nYes', 'r'), pt('nY', 'l'), '#2457a6');
  }
  window.addEventListener('resize', function () { if (out && out.ok) drawLines(); });

  function drawChart(o) {
    var W = 640, H = 250, l = 74, r = 16, t = 16, b = 32, cw = W - l - r, ch = H - t - b;
    var vals = o.curve.map(function (c) { return c.e; }).concat([o.P0, 0]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi - lo < 1) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (p) { return l + p * cw; }, Yv = function (v) { return t + (hi - v) / (hi - lo) * ch; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="期望利润随概率变化">';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (p) { s += '<line x1="' + X(p) + '" x2="' + X(p) + '" y1="' + t + '" y2="' + (t + ch) + '" stroke="#ece8df"/><text x="' + X(p) + '" y="' + (H - 10) + '" font-size="11" text-anchor="middle" fill="#8b919c">' + (p * 100) + '%</text>'; });
    s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Yv(0) + '" y2="' + Yv(0) + '" stroke="#c9c3b6"/><text x="' + (l - 6) + '" y="' + (Yv(0) + 4) + '" font-size="11" text-anchor="end" fill="#8b919c">0</text>';
    s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Yv(o.P0) + '" y2="' + Yv(o.P0) + '" stroke="#a4610c" stroke-dasharray="5 4"/>';
    s += '<text x="' + (l - 6) + '" y="' + (Yv(o.P0) + 4) + '" font-size="11" text-anchor="end" fill="#a4610c">不搞</text>';
    s += '<polyline fill="none" stroke="#2457a6" stroke-width="2.5" points="' + o.curve.map(function (c) { return X(c.p).toFixed(1) + ',' + Yv(c.e).toFixed(1); }).join(' ') + '"/>';
    if (o.pStar != null && o.pStar > 0 && o.pStar < 1) s += '<line x1="' + X(o.pStar) + '" x2="' + X(o.pStar) + '" y1="' + t + '" y2="' + (t + ch) + '" stroke="#a4610c" stroke-dasharray="2 3"/>';
    s += '<circle cx="' + X(o.p) + '" cy="' + Yv(o.E) + '" r="5.5" fill="' + (o.worth ? '#1f7a45' : '#b3261e') + '" stroke="#fff" stroke-width="2"/>';
    var lx = X(o.p), anchor = lx > W - 170 ? 'end' : 'start', dx = anchor === 'end' ? -9 : 9;
    var ly = Yv(o.E) - 9; if (ly < t + 12) ly = Yv(o.E) + 20;
    s += '<text x="' + (lx + dx) + '" y="' + ly + '" font-size="12" font-weight="700" text-anchor="' + anchor + '" fill="#1c2230" stroke="#fff" stroke-width="4" paint-order="stroke">' + esc(P(o.p) + ' → ' + Y(o.E)) + '</text>';
    s += '</svg>';
    $('chart').innerHTML = s;
    $('chartNote').textContent = o.refundIf === 0 ? '没有退款风险，曲线是一条水平线。' :
      '蓝线是搞活动的期望利润，橙色虚线是不搞的利润。' + (o.pStar != null && o.pStar > 0 && o.pStar < 1 ? '两线交在概率 ' + P(o.pStar) + '：低于它搞活动划算。' : o.pStar != null && o.pStar >= 1 ? '蓝线始终在橙线上方：概率多高都划算。' : '蓝线始终在橙线下方：概率多低都不划算。');
  }

  $('acts').addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b) return; state = A.applyAction(state, out.actions[+b.getAttribute('data-a')]); fill(); update(); });
  function update() { out = A.compute(state); render(); markErrors(); renderPresets(); save(); }

  /* ---------- 导出 ---------- */
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? (out.worth ? '划算' : '不划算') : '出错'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('赢了反而亏-' + tag() + '.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('赢了反而亏-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('赢了反而亏-备份.json', new Blob([JSON.stringify({ app: '赢了反而亏', slug: 'refund-bet', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fill(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fill(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f6f4ef'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(50, 50, W - 100, H - 100);
    g.strokeStyle = '#ddd8cd'; g.lineWidth = 2; g.strokeRect(50, 50, W - 100, H - 100);
    var L = 100, R = W - 100, maxW = R - L, y = 150;
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function text(t, size, color, bold, x, w) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; g.fillStyle = color; g.fillText(clip(t, w || maxW), x || L, y); }
    function wrap(t, size, color, bold) {
      g.font = (bold ? '700 ' : '') + size + 'px ' + FF; g.fillStyle = color; var cur = '';
      var toks = String(t).match(/[0-9A-Za-z.,%−+]+[）)。，、；：]?|[^\s][）)。，、；：]?|\s/g) || [];
      toks.forEach(function (ch) { if (g.measureText(cur + ch).width > maxW && cur) { g.fillText(cur, L, y); y += size * 1.5; cur = ch.trim() ? ch : ''; } else cur += ch; });
      if (cur) { g.fillText(cur, L, y); y += size * 1.5; }
    }
    text('赢了反而亏', 52, '#1c2230', true); y += 20;
    g.fillStyle = '#1c2230'; g.fillRect(L, y, maxW, 4); y += 46;
    if (!out.ok) { y += 60; text('还算不了', 48, '#b3261e', true); y += 70; out.errors.forEach(function (e) { wrap('· ' + e.message, 28, '#4b5466'); y += 8; }); y += 30; wrap('改好输入框里标红的那几项，结果会自动重算。', 26, '#8b919c');
      y += 40; wrap('这张卡算的是：「要是某件事发生就给买家退款」的活动，期望比不搞多赚还是少赚、万一发生会亏多少。', 26, '#8b919c'); return cv; }
    var o = out;
    wrap('「' + o.event + '就退 ' + P(o.r) + '」值不值', 34, '#4b5466', true); y += 20;
    g.fillStyle = o.worth ? '#1f7a45' : '#b3261e'; g.fillRect(L, y - 52, 220, 72);
    g.font = '800 46px ' + FF; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(o.worth ? '划算' : '不划算', L + 110, y); g.textAlign = 'left';
    g.font = '26px ' + FF; g.fillStyle = '#4b5466'; g.fillText(clip('按你估的概率 ' + P(o.p), maxW - 250), L + 250, y - 6);
    y += 76;
    wrap(o.headline, 30, '#1c2230'); y += 26;
    /* 小决策树 */
    var top = y, bh = 118;
    function box(x, yy, w, title, val, color, sub) {
      g.strokeStyle = '#1c2230'; g.lineWidth = 3; g.strokeRect(x, yy, w, bh);
      g.font = '22px ' + FF; g.fillStyle = '#4b5466'; g.fillText(clip(title, w - 30), x + 16, yy + 34);
      g.font = '800 36px ' + FF; g.fillStyle = color; g.fillText(clip(val, w - 30), x + 16, yy + 78);
      g.font = '19px ' + FF; g.fillStyle = '#8b919c'; g.fillText(clip(sub, w - 30), x + 16, yy + 106);
    }
    var c = function (v) { return v > 0 ? '#1f7a45' : v < 0 ? '#b3261e' : '#1c2230'; };
    var bw = (maxW - 40) / 2;
    var S = A.yuanShort;
    box(L, top, bw, '不搞活动', S(o.P0), c(o.P0), F(o.N0) + ' 件');
    box(L, top + bh + 30, bw, '搞活动 · 期望', S(o.E), c(o.E), (o.dE >= 0 ? '比不搞多 ' + S(o.dE) : '比不搞少 ' + S(-o.dE)));
    box(L + bw + 40, top, bw, P(1 - o.p) + ' 没发生', S(o.Pn), c(o.Pn), F(o.N1) + ' 件，一分不退');
    box(L + bw + 40, top + bh + 30, bw, P(o.p) + ' ' + o.event + '了', S(o.Py), c(o.Py), '退 ' + F(o.R) + ' 人，共 ' + S(o.refundIf));
    y = top + 2 * bh + 30 + 70;
    var lines = [
      o.pStar == null ? '没有退款风险' : o.pStar >= 1 ? '概率多高都划算' : o.pStar <= 0 ? '概率多低都不划算' : '概率低于 ' + P(o.pStar) + ' 才划算',
      '名额内每多卖一件，' + A.perUnit(o.unitEM),
      '买家的期望到手价 ' + Y(o.buyerPrice) + '（' + zhe(o.discount) + '）'
    ];
    if (o.actions[0]) lines.push('改一项：' + o.actions[0].text + ' → 期望 ' + A.yuanShort(o.actions[0].after));
    lines.forEach(function (t) { wrap('· ' + t, 27, '#4b5466'); y += 4; });
    /* 概率估错了：全额退那一列（默认卡目检：下半张空着） */
    var full = o.refunds.indexOf(o.refundPct) >= 0 ? o.refundPct : o.refunds[o.refunds.length - 1];
    if (y < H - 300) {
      y += 30; text('概率估错了会怎样（退 ' + full + '%，比不搞多赚多少）', 26, '#1c2230', true); y += 50;
      o.grid.forEach(function (gr, i) {
        var cell = gr.cells.filter(function (q) { return q.refund === full; })[0], cx = L + (i % 2) * (maxW / 2);
        g.font = (gr.cur ? '700 ' : '') + '25px ' + FF; g.fillStyle = cell.pass ? '#1f7a45' : '#b3261e';
        g.fillText(clip(gr.prob + '%：' + (cell.d >= 0 ? '+' : '') + A.yuanShort(cell.d) + (gr.cur ? ' ◀' : ''), maxW / 2 - 20), cx, y);
        if (i % 2 === 1 || i === o.grid.length - 1) y += 42;
      });
    }
    g.font = '21px ' + FF; g.fillStyle = '#8b919c';
    g.fillText(clip('概率是自己估的；假设退款不收回商品、不计抽成与税；默认数字为虚构示例', maxW), L, H - 90);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (b) { if (b) download('赢了反而亏-' + tag() + '-1080x1350.png', b); }, 'image/png'); });

  window.__rbUi = { state: function () { return JSON.parse(JSON.stringify(state)); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fill(); update();
})();
