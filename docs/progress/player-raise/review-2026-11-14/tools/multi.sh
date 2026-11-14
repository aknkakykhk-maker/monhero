#!/bin/bash
# 何ターンかまとめて: multi.sh "tr3:1 rest:1 tr3:2" 札の頭
Q=$(dirname $0); n=0
for a in $1; do n=$((n+1)); act=${a%%:*}; pr=${a##*:}
  echo "== $2-$n $act"
  $Q/go.py $act --praise $pr --name $2-$n | grep -v -- "-sel |\|-res |  |$" | cut -c1-${3:-250}
  curl -s localhost:9555/look | grep -q "💪 トレーニング" || { echo "(メインに戻っていない)"; break; }
done
curl -s localhost:9555/errors | head -c 300
