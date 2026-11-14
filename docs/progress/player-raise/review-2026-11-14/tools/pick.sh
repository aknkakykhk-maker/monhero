#!/bin/bash
# 字で場所を探して本物のタップ: pick.sh '正規表現' [待ち] [札]
Q=$(dirname $0)
xy=$(curl -s -X POST --data-binary "(()=>{const re=new RegExp('$1');const e=[...document.querySelectorAll('.msx *')].filter(x=>re.test((x.innerText||'').replace(/\\s+/g,' ').trim())&&x.getBoundingClientRect().height>0).pop();if(!e)return '';e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return Math.round(r.left+r.width/2)+' '+Math.round(r.top+r.height/2)})()" localhost:9555/eval | tr -d '"')
[ -z "$xy" ] && { echo "見つからない: $1"; exit 1; }
$Q/c.sh xy $xy ${2:-600} ${3:-pick}
