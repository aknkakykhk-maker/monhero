#!/bin/bash
# 助手の説明の窓を読み切って閉じる(読んだ行を出す)
Q=$(dirname $0)
for i in $(seq 1 15); do
 r=$($Q/c.sh eval '(()=>{const t=(document.querySelector(".msx")||document.body).innerText;const e=t.match(/(の説明|β版のお話)\n[\s\S]*?\n([^\n]+)\n(つぎへ ▶|とじる ▶)\n\d+\/\d+\s*$/);if(!e)return "";const box=[...document.querySelectorAll(".msx *")].filter(x=>/^(つぎへ ▶|とじる ▶)$/.test((x.innerText||"").trim())).pop();(box||document.elementFromPoint(300,800)).click();return e[2]})()')
 [ "$r" = '""' -o -z "$r" ] && break
 echo "説明: $r"; sleep 0.5
done
