#!/bin/bash
# 使い方: c.sh look | c.sh tap 3 | c.sh shot 名前 | c.sh eval 'JS'
cmd=$1; shift
case $cmd in
  tap|click) curl -s "localhost:9555/$cmd?i=$1&wait=${2:-700}&name=$3" ;;
  xy) curl -s "localhost:9555/xy?x=$1&y=$2&wait=${3:-700}&name=$4" ;;
  patch) curl -s "localhost:9555/patch?on=$1" ;;
  save|load) curl -s "localhost:9555/$cmd?name=$1" ;;
  shot) curl -s "localhost:9555/shot?name=$1" ;;
  eval) curl -s -X POST --data-binary "$1" localhost:9555/eval ;;
  open) curl -s "localhost:9555/open?w=$1&h=$2" ;;
  wait) curl -s "localhost:9555/wait?ms=$1&name=$2" ;;
  swipe) curl -s "localhost:9555/swipe?y=$1&x1=$2&x2=$3" ;;
  *) curl -s "localhost:9555/$cmd" ;;
esac | python3 "$(dirname $0)/fmt.py"
