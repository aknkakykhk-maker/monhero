#!/bin/bash
# 使い方: c.sh look | c.sh tap 3 | c.sh shot 名前 | c.sh eval 'JS'
cmd=$1; shift
case $cmd in
  tap|click) curl -s "localhost:9555/$cmd?i=$1&wait=${2:-700}" ;;
  shot) curl -s "localhost:9555/shot?name=$1&full=${2:-0}" ;;
  eval) curl -s -X POST --data-binary "$1" localhost:9555/eval ;;
  open) curl -s "localhost:9555/open?w=$1&h=$2" ;;
  wait) curl -s "localhost:9555/wait?ms=$1" ;;
  swipe) curl -s "localhost:9555/swipe?y=$1&x1=$2&x2=$3" ;;
  *) curl -s "localhost:9555/$cmd" ;;
esac | python3 -c 'import sys,json
s=sys.stdin.read()
try:
  d=json.loads(s)
except Exception:
  print(s); sys.exit()
if isinstance(d,dict) and "btns" in d:
  print("VIEW",d["view"]); print(d["text"]); print("--BTN--"); print("\n".join(d["btns"]))
  for k in ("over","lap","small"):
    if d[k]: print(k.upper(), d[k])
  if d["hscroll"]: print("HSCROLL!")
else: print(json.dumps(d,ensure_ascii=False,indent=1))'
