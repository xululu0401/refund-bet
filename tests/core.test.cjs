/* 赢了反而亏 · 核心测试：node --test tests/core.test.cjs
 * 锚点：手算（默认场景逐片叶子）、tests/ref.json（独立 Python Fraction 实现 + 逐件暴力扫描最少销量）。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const S = (o) => Object.assign(A.defaultState(), o);
const close = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), msg + ' got ' + a + ' want ' + b);

test('默认场景：逐片叶子手算', () => {
  const o = A.compute(A.defaultState());
  assert.equal(o.ok, true);
  /* 毛利 999；不搞 1000×999；搞 1600×999−50000；夺冠退 1600×3999 */
  assert.equal(o.m, 999); assert.equal(o.P0, 999000); assert.equal(o.Pn, 1548400);
  assert.equal(o.refundIf, 6398400); assert.equal(o.Py, -4850000);
  close(o.E, 0.7 * 1548400 + 0.3 * -4850000, 'E'); close(o.E, -371120, 'E 手算');
  close(o.dE, -1370120, 'dE'); assert.equal(o.worth, false); assert.equal(o.safe, false);
  close(o.pStar, 549400 / 6398400, 'pStar'); assert.equal(A.pct(o.pStar), '8.6%');
  close(o.unitEM, 999 - 0.3 * 3999, 'unitEM'); assert.equal(o.need, null);
  close(o.buyerPrice, 3999 * 0.7, 'buyer'); assert.equal(o.discount.toFixed(1), '7.0');
  assert.equal(o.headline, '按主队夺冠的概率 30%，搞活动期望亏 371,120 元，比不搞少 1,370,120 元；概率要低于 8.6% 才划算。');
  assert.deepEqual(o.actions.map((a) => a.kind + '=' + a.value), ['cap=457', 'refund=28', 'safe=387']);
});

test('改一项按钮：改完确实达标，再多一点就不达标（最优性）', () => {
  const st = A.defaultState();
  const o = A.compute(st);
  for (const a of o.actions) {
    const after = A.compute(A.applyAction(st, a));
    if (a.kind === 'cap' || a.kind === 'refund' || a.kind === 'sales') {
      assert.ok(after.worth, a.kind + ' 改完应划算');
      const more = A.compute(Object.assign({}, st, { [a.field]: String(Number(a.value) + (a.kind === 'sales' ? -1 : 1)) }));
      assert.ok(!more.worth, a.kind + ' 再放宽一格应不划算');
    }
    if (a.kind === 'safe') {
      assert.ok(after.Py >= 0, '保本名额改完发生也不亏');
      assert.ok(A.compute(Object.assign({}, st, { cap: String(Number(a.value) + 1) })).Py < 0, '多一个名额就亏');
    }
    assert.equal(a.after, after.E);
  }
  /* 名额 457：E = 1548400 − 0.3×457×3999 */
  close(o.actions[0].after, 1548400 - 0.3 * 457 * 3999, 'cap after');
});

test('与独立 Python 实现对拍（' + REF.cases.length + ' 组叶子）', () => {
  for (const c of REF.cases) {
    const o = A.compute(S({ price: String(c.P), cost: String(c.c), base: String(c.N0), sales: String(c.N1), fixed: String(c.F), refund: String(c.r), cap: String(c.K), prob: String(c.p) }));
    assert.equal(o.ok, true, JSON.stringify(c));
    close(o.P0, c.P0, 'P0'); close(o.Pn, c.Pn, 'Pn'); close(o.Py, c.Py, 'Py'); close(o.E, c.E, 'E');
    assert.equal(o.worth, c.worth, 'worth ' + JSON.stringify(c));
  }
});

test('最少销量：与 Python 逐件 +1 扫描一致（' + REF.needs.length + ' 组）', () => {
  let none = 0;
  for (const z of REF.needs) {
    const m = z.P - z.c, loss = (z.p / 100) * (z.r / 100) * z.P;
    const got = A.salesNeeded(m, z.F, loss, z.K, z.N0 * m);
    if (z.need === null) { none++; assert.ok(got === null || got > 6000, '扫描到 6000 都不够，JS 不应给更小的数 ' + JSON.stringify(z) + ' got ' + got); }
    else assert.equal(got, z.need, JSON.stringify(z));
  }
  assert.ok(none < REF.needs.length / 2);
});

test('最少销量：分段函数的两种拐法', () => {
  /* 名额内每件期望亏（m < loss），名额外每件赚：先下降再上升 */
  assert.equal(A.salesNeeded(10, 0, 30, 100, 1), 301); /* 前段 −20N 永远 < 1；后段 10N−3000 ≥ 1 → 301（测试首版写 target 0 期望 300，错：N=0 时 f=0 已达标） */
  assert.equal(A.salesNeeded(10, 0, 30, 100, -500), 0); /* 目标为负：N=0 就够 */
  /* 名额内每件期望赚 20、名额外 30：根落在第一段 */
  assert.equal(A.salesNeeded(30, 0, 10, 100, 1000), 50);
  /* 第一段算出 150 > 名额 100 → 第二段 30N − 1000 ≥ 3000 → 134（133 时 2990 不够） */
  assert.equal(A.salesNeeded(30, 0, 10, 100, 3000), 134);
  assert.equal(A.expectedAt(133, 30, 0, 10, 100), 2990);
  /* 每件都亏：卖多少都不够 */
  assert.equal(A.salesNeeded(-5, 0, 0, 0, 10), null);
});

test('边界：概率 0 与 100、不退、不限名额', () => {
  const p0 = A.compute(S({ prob: '0' }));
  assert.equal(p0.E, p0.Pn); assert.ok(p0.worth);
  const p1 = A.compute(S({ prob: '100' }));
  assert.equal(p1.E, p1.Py);
  const r0 = A.compute(S({ refund: '0' }));
  assert.equal(r0.refundIf, 0); assert.equal(r0.pStar, null); assert.equal(r0.Py, r0.Pn);
  assert.ok(r0.headline.indexOf('没有退款风险') >= 0);
  const k = A.compute(S({ cap: '99999' }));
  assert.equal(k.R, 1600, '名额大于销量时按销量');
  const k1 = A.compute(S({ cap: '1' }));
  assert.equal(k1.R, 1); assert.equal(k1.refundIf, 3999);
  const z = A.compute(S({ sales: '0' }));
  assert.equal(z.R, 0); assert.equal(z.Pn, -50000);
});

test('临界概率两侧：恰好等于时算划算，多一点不划算', () => {
  /* 名额 100、退 100%：Pn−P0 = 549400，refundIf = 399900 → p* = 137.38…% → 永远划算 */
  const a = A.compute(S({ cap: '100' }));
  assert.ok(a.pStar > 1 && a.worth);
  /* 构造恰好相等：售价 100，成本 0，不搞 0，搞 10 件，F=0，退 100%，概率 100% → E=0=P0 */
  const eq = A.compute(S({ price: '100', cost: '0', base: '0', sales: '10', fixed: '0', refund: '100', cap: '0', prob: '100' }));
  assert.equal(eq.E, 0); assert.equal(eq.dE, 0); assert.equal(eq.worth, true);
  const lt = A.compute(S({ price: '100', cost: '0', base: '0', sales: '10', fixed: '1', refund: '100', cap: '0', prob: '100' })); /* E = 1000 − 1 − 1000 = −1 < 0 */
  assert.equal(lt.worth, false);
});

test('非法输入：逐项报错并指向字段', () => {
  const o = A.compute(S({ price: '0', cost: 'abc', base: '1.5', sales: '-3', refund: '120', prob: '101', cap: '2.2', fixed: '-1' }));
  assert.equal(o.ok, false);
  assert.deepEqual(o.errors.map((e) => e.field).sort(), ['base', 'cap', 'cost', 'fixed', 'price', 'prob', 'refund', 'sales']);
  assert.ok(o.errors.find((e) => e.field === 'base').message.indexOf('整数') >= 0);
  assert.equal(A.compute(S({ price: '' })).ok, false);
  assert.equal(A.compute(S({ price: '1e9' })).ok, false);
});

test('输入宽容：千分位、全角逗号、¥ 与「元」', () => {
  const o = A.compute(S({ price: '¥3,999', cost: '3000元', fixed: '50，000' }));
  assert.equal(o.ok, true); assert.equal(o.P, 3999); assert.equal(o.F, 50000);
  assert.ok(Number.isNaN(A.num('1.2.3'))); assert.ok(Number.isNaN(A.num('12abc')));
  const e = A.compute(S({ event: '   ' })); assert.equal(e.event, '那件事');
  const long = A.compute(S({ event: '一二三四五六七八九十十一十二十三' })); assert.equal(long.event.length, 12);
});

test('敏感表：行列、当前格、口径与主结论一致', () => {
  const o = A.compute(A.defaultState());
  assert.deepEqual(o.grid.map((g) => g.prob), [5, 10, 20, 30, 50, 70]);
  const cur = o.grid.find((g) => g.cur).cells.find((c) => c.cur);
  close(cur.d, o.dE, '当前格 = dE');
  /* 概率 5% 时 100% 退：549400 − 0.05×6398400 = 229480 → 划算 */
  close(o.grid[0].cells[2].d, 229480, '5% 全退');
  assert.equal(o.grid[0].cells[2].pass, true); assert.equal(o.grid[1].cells[2].pass, false);
  const odd = A.compute(S({ prob: '12.5' }));
  assert.deepEqual(odd.grid.map((g) => g.prob), [5, 10, 12.5, 20, 30, 50, 70]);
  assert.equal(odd.curve.length, 51); close(odd.curve[0].e, odd.Pn, 'curve 0'); close(odd.curve[50].e, odd.Py, 'curve 1');
});

test('格式：金额、百分比、负号', () => {
  assert.equal(A.yuan(-371120), '−371,120 元'); assert.equal(A.yuan(12.345), '12.35 元'); assert.equal(A.yuan(-0.001), '0 元');
  assert.equal(A.pct(0.3), '30%'); assert.equal(A.pct(0.08586), '8.6%'); assert.equal(A.pct(0.0012), '0.12%'); assert.equal(A.pct(0.9999), '99.99%'); assert.equal(A.pct(0.99999), '99.999%');
  assert.equal(A.yuanShort(-4850000), '−4,850,000 元'); assert.equal(A.yuanShort(9999999900000), '10 万亿元'); assert.equal(A.yuanShort(154840000), '1.548 亿元'); assert.equal(A.yuanShort(-1.0001e9), '−10 亿元');
  assert.equal(A.perUnit(-200.7), '期望反而亏 201 元'); assert.equal(A.perUnit(999), '期望多赚 999 元'); assert.equal(A.perUnit(-12.5), '期望反而亏 12.50 元');
  assert.equal(A.fmt(1600), '1,600'); assert.equal(A.fmt(-2.5), '−2.5');
});

test('导出：CSV 与 MD 含同一次计算的读数', () => {
  const o = A.compute(A.defaultState());
  const csv = A.toCSV(o, 'T');
  assert.ok(csv.indexOf('搞·期望,-371120.00') >= 0 && csv.indexOf('不划算') >= 0);
  assert.equal(csv.split('\n').filter((l) => /^\d/.test(l)).length, 6);
  const md = A.toMD(o, 'T');
  assert.ok(md.indexOf(o.headline) >= 0 && md.indexOf('−4,850,000 元') >= 0 && md.indexOf('8.6%') >= 0);
  const q = A.toCSV(A.compute(S({ event: '下"雨",了' })), 'T');
  assert.ok(q.indexOf('"下""雨"",了"') >= 0);
});
