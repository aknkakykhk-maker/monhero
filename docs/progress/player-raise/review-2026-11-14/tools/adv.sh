#!/bin/bash
# つぎへ だけの画面を進める。選ぶ物が出たら止まる。 使い方: adv.sh [札の名前] [待ち]
Q=$(dirname $0); N=${1:-a}; W=${2:-900}
for k in $(seq 1 25); do
  d=$($Q/dis.sh); [ -n "$d" ] && echo "  [説明] $(echo "$d" | tr '\n' ' ' | cut -c1-600)"
  st=$(curl -s localhost:9555/look | python3 -c '
import sys,json,re
d=json.load(sys.stdin); b=d["btns"]
lab=[re.sub(r"^\d+×?\[(.*)\]\(.*$",r"\1",x) for x in b]
dis=[("×[" in x.split("(")[0]) for x in b]
core=[(i,l) for i,l in enumerate(lab) if not re.match(r"^(← 中断|⏩ とばす)$",l) and not dis[i]]
if len(core)==1 and re.search(r"つぎへ|TAP|タップ|すすむ|OK|とじる ▶",core[0][1]): print("GO",core[0][0])
else: print("STOP")')
  if [ "${st%% *}" = "GO" ]; then
    $Q/c.sh tap ${st##* } $W $N 2>/dev/null | sed -n '1p;2p;/^SMALL\|^LAP\|^OVER\|^HSCROLL/p' | cut -c1-520
  else break; fi
done
$Q/c.sh look 2>/dev/null | sed -n '2,$p' | cut -c1-900
