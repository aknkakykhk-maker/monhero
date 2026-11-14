#!/bin/bash
# トレーニングを選ぶ画面を開き、6つを順に見て「タッグ」の字がある物を出す
Q=$(dirname $0); $Q/c.sh look >/dev/null; $Q/c.sh tap 4 800 scan >/dev/null 2>&1
for i in 1 2 3 4 5 6; do curl -s "localhost:9555/tap?i=$i&wait=400&name=scan$i" | python3 -c "
import sys,json,re;d=json.load(sys.stdin);t=d['text'].replace('\n',' ');m=re.search(r'(タッグ[^ ]*( [^ ]+){0,3})',t);print($i,m.group(1) if m else '', '| 来ている:', ' '.join(re.findall(r'(\S+) 編成の効き',t)))"; done
