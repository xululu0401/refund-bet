/* 封面目检：最初多画了三段灰色短线（不搞活动 → 叶子），树义不对，已删。
 * 封面 cover.svg（1200×1200），读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok) throw new Error('默认场景算不出来');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
const box = (x, y, w, h, title, val, col, sub, round) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round ? h / 2 : 14}" fill="#fff" stroke="${round ? '#2457a6' : '#1c2230'}" stroke-width="4"/>
  <text x="${x + (round ? w / 2 : 26)}" y="${y + 46}" ${round ? 'text-anchor="middle"' : ''} font-family="${F}" font-size="26" fill="#4b5466">${title}</text>
  <text x="${x + (round ? w / 2 : 26)}" y="${y + 100}" ${round ? 'text-anchor="middle"' : ''} font-family="${F}" font-size="50" font-weight="800" fill="${col}">${val}</text>
  <text x="${x + (round ? w / 2 : 26)}" y="${y + 138}" ${round ? 'text-anchor="middle"' : ''} font-family="${F}" font-size="22" fill="#8b919c">${sub}</text>`;
const c = (v) => v > 0 ? '#1f7a45' : '#b3261e';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f6f4ef"/>
  <rect x="70" y="70" width="1060" height="1060" rx="18" fill="#fff" stroke="#ddd8cd" stroke-width="3"/>
  <text x="130" y="220" font-family="${F}" font-size="120" font-weight="800" fill="#1c2230">赢了反而亏</text>
  <text x="130" y="296" font-family="${F}" font-size="38" fill="#4b5466">「${o.event}就全额退款」到底值不值</text>
  <rect x="130" y="340" width="230" height="78" rx="10" fill="#b3261e"/>
  <text x="245" y="396" text-anchor="middle" font-family="${F}" font-size="48" font-weight="800" fill="#fff">不划算</text>
  <text x="390" y="372" font-family="${F}" font-size="30" fill="#1c2230">你估${o.event}概率 ${A.pct(o.p)}</text>
  <text x="390" y="410" font-family="${F}" font-size="30" font-weight="700" fill="#a4610c">低于 ${A.pct(o.pStar)} 才划算</text>
  ${box(130, 500, 430, 160, '不搞活动', A.yuan(o.P0), c(o.P0), A.fmt(o.N0) + ' 件')}
  ${box(130, 740, 430, 160, '搞活动 · 期望', A.yuan(o.E), c(o.E), '比不搞少 ' + A.yuan(-o.dE), true)}
  ${box(620, 560, 450, 160, A.pct(1 - o.p) + ' 没发生', A.yuan(o.Pn), c(o.Pn), A.fmt(o.N1) + ' 件，一分不退')}
  ${box(620, 780, 450, 160, A.pct(o.p) + ' ' + o.event + '了', A.yuan(o.Py), c(o.Py), '退 ' + A.fmt(o.R) + ' 人 × ' + A.pct(o.r))}
  <path d="M560,820 C590,820 590,640 620,640" fill="none" stroke="#2457a6" stroke-width="3"/>
  <path d="M560,820 C590,820 590,860 620,860" fill="none" stroke="#2457a6" stroke-width="3"/>
  <text x="130" y="1010" font-family="${F}" font-size="30" fill="#4b5466">改一项：退款名额限 ${o.actions[0].value} 个 → 期望 ${A.yuan(o.actions[0].after)}</text>
  <text x="130" y="1085" font-family="${F}" font-size="24" fill="#8b919c">虚构示例 · 概率自己估 · 不评价任何品牌或活动</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('/tmp/rb-cover.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
