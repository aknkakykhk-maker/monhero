#!/usr/bin/env python3
# 台本(表の形「| 番号 | 話し手 | 表情 | 台詞 |」)の台詞の中の、助手どうしの呼び方を
# monster-hero/data/assistants.js の ASSISTANT_PEER_CALLS と突き合わせる。
# 使い方: python3 tools/assistant/script-peer-calls-check.py docs/progress/event-xmas-2026/SCRIPT.md
# 2026-11-25 社長「さすがにミスが多い」(クリスマスの台本で呼び方の間違いが21行)で作った。表と違う所が1件でもあれば終了コード1
import re,sys
J={'みゅあ':'mua','きき':'kiki','ももすけ':'momosuke','ドラ':'dra','あつ':'atsu','きゅうこ':'kyuko','ソラシド':'sorashido','えるびん':'erubin'}
src=open('monster-hero/data/assistants.js',encoding='utf-8').read()
blk=src[src.index('const ASSISTANT_PEER_CALLS'):]
blk=blk[:blk.index('});')]
T={}
for m in re.finditer(r"(\w+):\s*\{([^}]*)\}",blk):
    T[m.group(1)]={k:v.split('(')[0] for k,v in re.findall(r"(\w+):\s*'([^']*)'",m.group(2))}
R={v:k for k,v in J.items()}
forms={}
for a in T:
    for b,v in T[a].items(): forms.setdefault(b,set()).add(v)
for jp,id in J.items(): forms.setdefault(id,set()).add(jp)
forms['sorashido']|={'ソラシド','ソラ','ばこ'}; forms['erubin']|={'えるびん','るび','エル'}; forms['kyuko']|={'きゅう'}
bad=0
for line in open(sys.argv[1],encoding='utf-8'):
    c=[x.strip() for x in line.strip().strip('|').split('|')]
    if len(c)<4 or not re.match(r'\d+-\d',c[0]) or c[1] not in J: continue
    sp=J[c[1]]; tx=re.sub(r'（[^）]*）|\([^)]*\)','',c[3])
    for tgt,fs in forms.items():
        if tgt==sp: continue
        want=T[sp].get(tgt)
        for f in sorted(fs,key=len,reverse=True):
            for m in re.finditer(re.escape(f),tx):
                if want and tx.startswith(want,m.start()): continue
                if any(tx.startswith(w,m.start()) for w in [want] if w): continue
                # skip if this match is inside a longer correct form
                if want and want in tx[max(0,m.start()-len(want)):m.start()+len(want)]: continue
                print(f"{c[0]} {c[1]}→{R[tgt]}(表:{want}) | …{tx[max(0,m.start()-8):m.start()+14]}…"); bad+=1
            if f in tx: break
print('呼び方の違い', bad, '件')
sys.exit(1 if bad else 0)
