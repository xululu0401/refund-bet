#!/usr/bin/env python3
"""独立参考实现（Fraction 精确有理数）：逐片叶子算利润，最少销量用逐件 +1 暴力扫描。
   不读 core.js；与 JS 对拍只能证明两边一致，单位与常识另由测试手算锚点检查。"""
from fractions import Fraction as Fr
import json, random
random.seed(20261116)
def leaves(P,c,N0,N1,F,r,K,p):
    m=P-c; R=N1 if K==0 else min(K,N1)
    P0=N0*m; Pn=N1*m-F; Py=Pn-R*r*P; E=p*Py+(1-p)*Pn
    return P0,Pn,Py,E
def need(P,c,N0,F,r,K,p,limit):
    target=N0*(P-c)
    for N in range(0,limit+1):
        if leaves(P,c,N0,N,F,r,K,p)[3]>=target: return N
    return None
cases=[];needs=[]
for i in range(300):
    P=Fr(random.choice([99,199,299,999,3999,15999,random.randint(1,20000)]))
    c=Fr(random.randint(0,int(P*1.2)))
    N0=random.randint(0,5000); N1=random.randint(0,8000)
    F=Fr(random.choice([0,1000,50000,random.randint(0,10**6)]))
    r=Fr(random.choice([0,25,50,80,100,random.randint(0,100)]),100)
    K=random.choice([0,0,random.randint(1,3000),random.randint(1,10000)])
    p=Fr(random.choice([0,1,2,5,10,30,50,99,100,random.randint(0,100)]),100)
    P0,Pn,Py,E=leaves(P,c,N0,N1,F,r,K,p)
    cases.append(dict(P=int(P),c=int(c),N0=N0,N1=N1,F=int(F),r=int(r*100),K=K,p=int(p*100),P0=float(P0),Pn=float(Pn),Py=float(Py),E=float(E),worth=E>=P0))
for i in range(120):
    P=Fr(random.randint(50,5000)); c=Fr(random.randint(0,int(P))); N0=random.randint(0,600)
    F=Fr(random.randint(0,20000)); r=Fr(random.choice([25,50,100,random.randint(1,100)]),100)
    K=random.choice([0,random.randint(1,400)]); p=Fr(random.randint(0,60),100)
    needs.append(dict(P=int(P),c=int(c),N0=N0,F=int(F),r=int(r*100),K=K,p=int(p*100),need=need(P,c,N0,F,r,K,p,6000)))
json.dump({'generator':'ref.py','cases':cases,'needs':needs},open('ref.json','w'),indent=0)
print(len(cases),len(needs),sum(1 for n in needs if n['need'] is None),'None')
