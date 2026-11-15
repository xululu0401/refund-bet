'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
/* 已删除的等价变异：cand.push(K + 1) → cand.push(K)。m>0 时第二段的根候选已覆盖 K+1；m≤0 时 f(K+1)=f(K)+m≤f(K)，K+1 不会更优。输出不变。 */
const M=[
['var R = K > 0 ? Math.min(K, N1) : N1;','var R = K > 0 ? K : N1;'],
['var loss = p * r * P;','var loss = p * r * (P - c);'],
['var P0 = N0 * m;','var P0 = N1 * m;'],
['var Pn = N1 * m - F;','var Pn = N1 * m;'],
['var refundIf = R * r * P;','var refundIf = R * P;'],
['var E = Pn - p * refundIf;','var E = Pn - (1 - p) * refundIf;'],
['var worth = dE >= -eps;','var worth = dE > eps;'],
['var pStar = refundIf > 0 ? (Pn - P0) / refundIf : null;','var pStar = refundIf > 0 ? Pn / refundIf : null;'],
['var kMax = Math.floor((Pn - P0) / (p * r * P) + 1e-9);','var kMax = Math.ceil((Pn - P0) / (p * r * P) + 1e-9);'],
['var rMax = Math.floor((Pn - P0) / (p * R * P) * 100 + 1e-9);','var rMax = Math.round((Pn - P0) / (p * R * P) * 100 + 1e-9);'],
['var kSafe = Math.floor(Pn / (r * P) + 1e-9);','var kSafe = Math.floor((Pn - P0) / (r * P) + 1e-9);'],
['function expectedAt(N, m, F, loss, K) { return N * m - F - loss * (K > 0 ? Math.min(K, N) : N); }','function expectedAt(N, m, F, loss, K) { return N * m - F - loss * N; }'],
['if (m > 0) cand.push(Math.ceil((target + F + loss * K) / m - 1e-9));','if (m > 0) cand.push(Math.ceil((target + F) / m - 1e-9));'],
['if (s1 > 0) cand.push(Math.ceil((target + F) / s1 - 1e-9));','if (s1 > 0) cand.push(Math.floor((target + F) / s1));'],
["else if (x !== Math.floor(x)) e.push","else if (false) e.push"],
["else if (x < 0 || x > 100) e.push","else if (x < 0) e.push"],
["var t = String(s == null ? '' : s).replace(/[,，\\s_¥￥元]/g, '');","var t = String(s == null ? '' : s).replace(/[,\\s]/g, '');"],
["var PROBS = [5, 10, 20, 30, 50, 70];","var PROBS = [5, 10, 20, 30, 50];"],
["if (probs.indexOf(v.prob) < 0) {","if (false) {"],
["for (var i = 0; i <= 50; i++)","for (var i = 0; i < 50; i++)"],
["var a = Math.abs(v), s = a >= 100 ? group(String(Math.round(a))) : a.toFixed(2);","var a = Math.abs(v), s = group(String(Math.round(a)));"],
["var d = Math.abs(v) < 1 ? 2 : 1;","var d = 1;"],
["slice(0, 12);","slice(0, 20);"],
["while (d < 4 && (Number(v.toFixed(d)) >= 100","while (d < 1 && (Number(v.toFixed(d)) >= 100"],
["if (a >= 1e8) return sg + Number((a / 1e8).toPrecision(4)) + ' 亿元';","if (a >= 1e9) return sg + Number((a / 1e8).toPrecision(4)) + ' 亿元';"],
["function perUnit(v) { return v >= 0 ?","function perUnit(v) { return v > -1e9 ?"],
];
let L=[],caught=0,valid=0;
try{
for(const [a,b] of M){ if(src.indexOf(a)<0){L.push('✗ 没找到注入点：'+a.slice(0,60));continue;} valid++;
 fs.writeFileSync(F,src.replace(a,b));
 let r='';try{execFileSync('node',['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:120000});r='漏掉';}catch(e){r='抓到';caught++;}
 L.push(r+'：'+a.slice(0,70)+' → '+b.slice(0,70));}
} finally { fs.writeFileSync(F,src); }
L.push('合计 '+caught+'/'+valid+' 抓到');console.log(L.join('\n'));
