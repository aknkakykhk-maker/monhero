#!/bin/bash
# 助手の説明・お話の窓を読み切って閉じる(読んだ行を出す)
Q=$(dirname $0)
for i in $(seq 1 20); do
 r=$($Q/c.sh eval '(()=>{const t=(document.querySelector(".msx")||document.body).innerText;const e=t.match(/([^\n]*(の説明|β版のお話))\n([\s\S]*?)\n(つぎへ ▶|とじる ▶)\n\d+\/\d+/);if(!e)return "";const box=[...document.querySelectorAll(".msx *")].filter(x=>/^(つぎへ ▶|とじる ▶)(\s*\d+\/\d+)?$/.test((x.innerText||"").trim())).pop();if(!box)return "";box.click();return e[1]+": "+e[3]})()')
 [ "$r" = '""' -o -z "$r" ] && break
 echo "$r"; sleep 0.5
done
