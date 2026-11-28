import sys
src=open('/home/user/monhero/monster-hero/data/monhero-success.js').read()
out,form,m1,m2,m3=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4],sys.argv[5]
def rep(s,a,b):
    assert s.count(a)==1,a[:50]; return s.replace(a,b)
helper = "const __eff = (v, m) => (%s);\n    const sumOf = (st) =>" % ("v <= 999 ? v : 999 + (v - 999) * m" if form=='over' else "v * m")
s=rep(src,"const sumOf = (st) =>",helper)
s=rep(s,"bonus[k] = i < 0 ? 0 : r2(stats[k] / 40 * POS_COEF[i]","bonus[k] = i < 0 ? 0 : r2(__eff(stats[k], %s) / 40 * POS_COEF[i]"%m2)
s=rep(s,"v: Math.floor(stats[top[0]] / START_STAT_DIV) }","v: Math.floor(__eff(stats[top[0]], %s) / START_STAT_DIV) }"%m3)
s=rep(s,"Math.floor(num(m.stats[k]) * rate + 1e-9)","Math.floor(__eff(num(m.stats[k]), %s) * rate + 1e-9)"%m1)
open(out,'w').write(s)
