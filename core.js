/* 赢了反而亏 · 计算核心（core.js）
 * 问题：商家搞「要是某件事发生（主队夺冠 / 下雨 / 涨价……）就给买家退款」的活动，值不值？
 * 两个分支、三片叶子，全部是确定计算，没有随机模拟：
 *   不搞：      P0 = N0·(P − c)
 *   搞·没发生：  Pn = N1·(P − c) − F
 *   搞·发生了：  Py = Pn − R·r·P，R = 退款名额（不限时 = N1，否则 min(K, N1)）
 *   搞·期望：    E  = p·Py + (1 − p)·Pn = Pn − p·R·r·P
 * 假设：退款不收回商品（成本已经花掉）；概率 p 是你自己的估计；买家买不买和概率无关（N1 由你填）。 */
(function (root) {
  'use strict';
  var MAX_MONEY = 1e8, MAX_FIXED = 1e12, MAX_Q = 1e8, MAX_SALES_SEARCH = 1e10;
  var PROBS = [5, 10, 20, 30, 50, 70];
  var REFUNDS = [25, 50, 100];

  function defaultState() {
    return { event: '主队夺冠', price: '3999', cost: '3000', base: '1000', sales: '1600', fixed: '50000', refund: '100', cap: '0', prob: '30' };
  }

  function num(s) {
    var t = String(s == null ? '' : s).replace(/[,，\s_¥￥元]/g, '');
    if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }

  function parse(s) {
    var e = [], v = {};
    var ev = String(s.event == null ? '' : s.event).replace(/\s+/g, ' ').trim().slice(0, 12);
    v.event = ev || '那件事';
    function money(k, name, lo, hi, allowZero) {
      var x = num(s[k]);
      if (isNaN(x)) e.push({ field: k, message: name + '要填一个数。' });
      else if (x < lo || (!allowZero && x <= 0) || x > hi) e.push({ field: k, message: allowZero ? name + '要在 0 到 ' + fmt(hi) + ' 之间。' : name + '要大于 0，最多 ' + fmt(hi) + '。' });
      v[k] = x;
    }
    function count(k, name, hi) {
      var x = num(s[k]);
      if (isNaN(x)) e.push({ field: k, message: name + '要填一个数。' });
      else if (x !== Math.floor(x)) e.push({ field: k, message: name + '要是整数。' });
      else if (x < 0 || x > hi) e.push({ field: k, message: name + '要在 0 到 ' + fmt(hi) + ' 之间。' });
      v[k] = x;
    }
    function percent(k, name) {
      var x = num(s[k]);
      if (isNaN(x)) e.push({ field: k, message: name + '要填一个数。' });
      else if (x < 0 || x > 100) e.push({ field: k, message: name + '要在 0 到 100 之间。' });
      v[k] = x;
    }
    money('price', '售价', 0, MAX_MONEY, false);
    money('cost', '每件成本', 0, MAX_MONEY, true);
    count('base', '不搞活动能卖几件', MAX_Q);
    count('sales', '搞活动能卖几件', MAX_Q);
    money('fixed', '活动额外花费', 0, MAX_FIXED, true);
    percent('refund', '退款比例');
    count('cap', '退款名额', MAX_Q);
    percent('prob', '发生的概率');
    return { v: v, errors: e };
  }

  /* 搞活动的期望利润，作为卖出件数 N 的函数（名额 K = 0 表示不限） */
  function expectedAt(N, m, F, loss, K) { return N * m - F - loss * (K > 0 ? Math.min(K, N) : N); }

  /* 最少卖几件，期望才不比不搞差。f(N) 分两段线性：N ≤ K 斜率 m − loss，N > K 斜率 m。
   * 每段满足 f ≥ 目标 的整数是一个区间，起点要么是段首、要么是根的上取整；把这些候选都试一遍取最小。 */
  function salesNeeded(m, F, loss, K, target) {
    var eps = 1e-9 * Math.max(1, Math.abs(target));
    var ok = function (N) { return N >= 0 && N <= MAX_SALES_SEARCH && expectedAt(N, m, F, loss, K) >= target - eps; };
    var cand = [0];
    var s1 = m - loss;
    if (s1 > 0) cand.push(Math.ceil((target + F) / s1 - 1e-9));
    if (K > 0) {
      cand.push(K + 1);
      if (m > 0) cand.push(Math.ceil((target + F + loss * K) / m - 1e-9));
    }
    var best = null;
    cand.forEach(function (N) {
      if (!isFinite(N)) return;
      N = Math.max(0, N);
      if (ok(N) && (best === null || N < best)) best = N;
    });
    return best;
  }

  function compute(state) {
    var pr = parse(state || {});
    if (pr.errors.length) return { ok: false, errors: pr.errors };
    var v = pr.v;
    var P = v.price, c = v.cost, N0 = v.base, N1 = v.sales, F = v.fixed, r = v.refund / 100, K = v.cap, p = v.prob / 100;
    var m = P - c;
    var R = K > 0 ? Math.min(K, N1) : N1;
    var loss = p * r * P;                   /* 每个退款名额的期望退款 */
    var P0 = N0 * m;
    var Pn = N1 * m - F;
    var refundIf = R * r * P;               /* 发生时一共要退多少 */
    var Py = Pn - refundIf;
    var E = Pn - p * refundIf;
    var dE = E - P0;
    var eps = 1e-9 * Math.max(1, Math.abs(P0), Math.abs(E));
    var worth = dE >= -eps;
    /* 盈亏临界概率：E = P0 时的 p */
    var pStar = refundIf > 0 ? (Pn - P0) / refundIf : null;
    var unitEM = m - loss;                  /* 名额内每多卖一件的期望毛利 */
    var need = salesNeeded(m, F, loss, K, P0);

    /* 改一项按钮：都直接改输入框 */
    var actions = [];
    if (!worth && refundIf > 0 && Pn > P0) {
      var kMax = Math.floor((Pn - P0) / (p * r * P) + 1e-9);
      if (kMax >= 1 && kMax < R) actions.push({ kind: 'cap', field: 'cap', value: String(kMax), text: '退款名额限 ' + fmt(kMax) + ' 个（前 ' + fmt(kMax) + ' 个买家）' });
      var rMax = Math.floor((Pn - P0) / (p * R * P) * 100 + 1e-9);
      if (rMax >= 1 && rMax < v.refund) actions.push({ kind: 'refund', field: 'refund', value: String(rMax), text: '只退 ' + rMax + '%（不全退）' });
    }
    if (Py < -eps && r > 0 && Pn > 0) {
      var kSafe = Math.floor(Pn / (r * P) + 1e-9);
      if (kSafe >= 1 && kSafe < R && !actions.some(function (a) { return a.field === 'cap' && Number(a.value) <= kSafe; }))
        actions.push({ kind: 'safe', field: 'cap', value: String(kSafe), text: '名额限 ' + fmt(kSafe) + ' 个，' + v.event + '了也不亏本' });
    }
    if (!worth && need != null && need > N1 && need <= MAX_Q) actions.push({ kind: 'sales', field: 'sales', value: String(need), text: '活动要卖到 ' + fmt(need) + ' 件才不比不搞差（你填的是 ' + fmt(N1) + '）' });
    actions.forEach(function (a) {
      var s2 = Object.assign({}, state); s2[a.field] = a.value;
      var o2 = compute(s2); a.after = o2.ok ? o2.E : null; a.afterD = o2.ok ? o2.dE : null; a.afterPy = o2.ok ? o2.Py : null;
    });

    /* 敏感表：行 = 概率，列 = 退款比例，格子 = 比不搞多赚多少 */
    var probs = PROBS.slice();
    if (probs.indexOf(v.prob) < 0) { probs.push(v.prob); probs.sort(function (a, b) { return a - b; }); }
    var grid = probs.map(function (q) {
      return { prob: q, cur: q === v.prob, cells: REFUNDS.map(function (rr) {
        var e2 = Pn - (q / 100) * R * (rr / 100) * P - P0;
        return { refund: rr, d: e2, pass: e2 >= -eps, cur: q === v.prob && rr === v.refund };
      }) };
    });

    /* 曲线：E 随概率 0–100% */
    var curve = [];
    for (var i = 0; i <= 50; i++) { var q = i / 50; curve.push({ p: q, e: Pn - q * refundIf }); }

    var buyerPrice = P * (1 - p * r);
    var headline;
    var pe = pct(p), ev = v.event;
    if (refundIf === 0) {
      headline = (r === 0 ? '退款比例是 0，' : N1 === 0 ? '活动一件没卖，' : '') + '没有退款风险：搞活动利润 ' + yuan(Pn) + '，' + (worth ? '比不搞多 ' + yuan(dE) : '比不搞少 ' + yuan(-dE)) + '。';
    } else if (worth) {
      headline = '按' + ev + '的概率 ' + pe + '，搞活动期望赚 ' + yuan(E) + '，比不搞多 ' + yuan(dE) + '；' +
        (Py >= -eps ? '就算' + ev + '了也还赚 ' + yuan(Py) + '。' : '但万一' + ev + '，要亏 ' + yuan(-Py) + '。');
    } else {
      headline = '按' + ev + '的概率 ' + pe + '，搞活动期望' + (E >= 0 ? '只赚 ' + yuan(E) : '亏 ' + yuan(-E)) + '，比不搞少 ' + yuan(-dE) + '；' +
        (pStar != null && pStar > 0 ? '概率要低于 ' + pct(pStar) + ' 才划算。' : '活动本身多卖的都不够付活动花费，概率再低也不划算。');
    }
    return {
      ok: true, errors: [], event: ev,
      P: P, c: c, N0: N0, N1: N1, F: F, r: r, K: K, p: p, refundPct: v.refund, probPct: v.prob,
      m: m, R: R, loss: loss, P0: P0, Pn: Pn, Py: Py, E: E, dE: dE, refundIf: refundIf, worth: worth, safe: Py >= -eps,
      pStar: pStar, unitEM: unitEM, need: need, buyerPrice: buyerPrice, discount: (1 - p * r) * 10,
      actions: actions, grid: grid, refunds: REFUNDS.slice(), curve: curve, headline: headline
    };
  }

  function applyAction(state, a) { var s = Object.assign({}, state); s[a.field] = a.value; return s; }

  /* ---------- 格式 ---------- */
  function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmt(v) {
    if (!isFinite(v)) return String(v);
    var neg = v < 0, a = Math.abs(v), s;
    if (a === Math.floor(a)) s = group(String(a));
    else { var t = a.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); var parts = t.split('.'); s = group(parts[0]) + (parts[1] ? '.' + parts[1] : ''); }
    return (neg && s !== '0' ? '−' : '') + s;
  }
  /* 金额：100 元以上取整，以下保留 2 位 */
  function money(v) {
    var a = Math.abs(v), s = a >= 100 ? group(String(Math.round(a))) : a.toFixed(2);
    if (Number(s.replace(/,/g, '')) === 0) return '0';
    return (v < 0 ? '−' : '') + s;
  }
  function yuan(v) { return money(v) + ' 元'; }
  /* 结果卡与窄格子用：≥ 1 亿写「x.xx 亿」、≥ 1 万亿写「x.xx 万亿」（极值结果卡目检：长数字被截成省略号） */
  function yuanShort(v) {
    var a = Math.abs(v), sg = v < 0 ? '−' : '';
    if (a >= 1e12) return sg + Number((a / 1e12).toPrecision(4)) + ' 万亿元';
    if (a >= 1e8) return sg + Number((a / 1e8).toPrecision(4)) + ' 亿元';
    return yuan(v);
  }
  /* 每多卖一件：正数写「多赚」，负数写「反而亏」（结果卡目检：「期望多赚 −201 元」读不通） */
  function perUnit(v) { return v >= 0 ? '期望多赚 ' + yuan(v) : '期望反而亏 ' + yuan(-v); }
  function pct(f) {
    var v = f * 100;
    if (Math.abs(v - Math.round(v)) < 1e-9) return Math.round(v) + '%';
    var d = Math.abs(v) < 1 ? 2 : 1;
    /* 贴近 0% / 100% 时加位数，避免 99.99% 显示成 100.0%（极值结果卡目检发现） */
    while (d < 4 && (Number(v.toFixed(d)) >= 100 || Number(v.toFixed(d)) <= 0)) d++;
    return v.toFixed(d) + '%';
  }

  function csvCell(v) { var t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  function toCSV(o, when) {
    var L = ['项目,值'];
    var add = function (k, val) { L.push(csvCell(k) + ',' + csvCell(val)); };
    add('导出时间', when); add('那件事', o.event); add('售价', o.P); add('每件成本', o.c); add('不搞能卖几件', o.N0); add('搞活动能卖几件', o.N1);
    add('活动额外花费', o.F); add('退款比例%', o.refundPct); add('退款名额(0=不限)', o.K); add('发生的概率%', o.probPct);
    add('不搞的利润', o.P0.toFixed(2)); add('搞·没发生', o.Pn.toFixed(2)); add('搞·发生了', o.Py.toFixed(2)); add('搞·期望', o.E.toFixed(2));
    add('期望比不搞多', o.dE.toFixed(2)); add('划算吗', o.worth ? '划算' : '不划算');
    add('临界概率', o.pStar == null ? '无退款风险' : (o.pStar * 100).toFixed(4) + '%');
    add('最少卖几件才不比不搞差', o.need == null ? '卖多少都不够' : o.need);
    add('买家期望到手价', o.buyerPrice.toFixed(2));
    L.push('');
    L.push(['发生的概率%'].concat(o.refunds.map(function (r) { return '退' + r + '%时比不搞多'; })).join(','));
    o.grid.forEach(function (g) { L.push([g.prob].concat(g.cells.map(function (c) { return c.d.toFixed(2); })).join(',')); });
    return L.join('\n') + '\n';
  }
  function toMD(o, when) {
    var L = ['# 赢了反而亏 · 「' + o.event + '就退款」值不值', '', '导出：' + when, '', '## 结论', '', o.headline, '',
      '## 决策树', '',
      '- 不搞活动：' + fmt(o.N0) + ' 件 × ' + money(o.m) + ' = **' + yuan(o.P0) + '**',
      '- 搞活动（' + fmt(o.N1) + ' 件，花费 ' + yuan(o.F) + '）',
      '  - ' + o.event + '没发生（' + pct(1 - o.p) + '）：' + yuan(o.Pn),
      '  - ' + o.event + '了（' + pct(o.p) + '）：退 ' + fmt(o.R) + ' 人 × ' + pct(o.r) + ' × ' + money(o.P) + ' = ' + yuan(o.refundIf) + ' → ' + yuan(o.Py),
      '  - 期望：' + yuan(o.E) + '（比不搞 ' + (o.dE >= 0 ? '多 ' + yuan(o.dE) : '少 ' + yuan(-o.dE)) + '）', '',
      '## 关键数', '',
      '- 临界概率：' + (o.pStar == null ? '无退款风险' : pct(o.pStar)),
      '- 名额内每多卖一件：' + perUnit(o.unitEM),
      '- 最少卖几件才不比不搞差：' + (o.need == null ? '卖多少都不够' : fmt(o.need)),
      '- 买家视角：期望到手价 ' + yuan(o.buyerPrice) + '，约等于 ' + o.discount.toFixed(1) + ' 折', '',
      '## 概率 × 退款比例（比不搞多赚多少）', '',
      '| 概率 | ' + o.refunds.map(function (r) { return '退 ' + r + '%'; }).join(' | ') + ' |',
      '|---|' + o.refunds.map(function () { return '---'; }).join('|') + '|'];
    o.grid.forEach(function (g) { L.push('| ' + g.prob + '%' + (g.cur ? '（当前）' : '') + ' | ' + g.cells.map(function (c) { return yuan(c.d) + (c.pass ? ' ✓' : ''); }).join(' | ') + ' |'); });
    L.push('', '## 边界', '', '- 概率、销量都是你自己的估计；页面不预测任何比赛或天气。',
      '- 假设退款不收回商品、不计平台抽成与税、买家买不买与概率无关。', '- 期望值是「同样的活动搞很多次」的平均，只搞一次时结果只会是两片叶子之一。', '');
    return L.join('\n');
  }

  var api = { defaultState: defaultState, compute: compute, applyAction: applyAction, parse: parse, num: num,
    expectedAt: expectedAt, salesNeeded: salesNeeded, toCSV: toCSV, toMD: toMD, fmt: fmt, money: money, yuan: yuan, yuanShort: yuanShort, perUnit: perUnit, pct: pct,
    PROBS: PROBS, REFUNDS: REFUNDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(this);
