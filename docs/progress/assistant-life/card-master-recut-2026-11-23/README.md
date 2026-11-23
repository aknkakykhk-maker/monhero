# みゅあカードマスター全身の抜き直し(台帳 r1119-137・助手部ナカヨシ)

- `all9-dark.png` / `all9-light.png` … 9枚の前(上の段・いまの公開版)と後(下の段)。暗い背景と明るい背景
- `zoom-hair-back-and-edges.png` … 左ポニーテールの付け根(編み目の四角の背景装飾があった所)と、右のフチ(マント・羽・髪)の拡大。前後×暗明
- `wink-right-hand-compare.png` … wink の比べ(上: いまの公開版 / 下: final どおりの新しい版)。右手(顔の横)はどちらもピースサイン、左手は腰で拳。違いは目の横の星だけ

作り方: `python3 tools/assistant/life-card-master-recut.py`(素材は `tools/art-sources/assistant-fullbody/mua-card-master-2026-11-23/`)

- 8表情は raw(マゼンタ背景)から抜き、final と違う所(angry の顔・troubled の耳飾りを消した所など)は final の絵を使う
- 土台は final が描き直された別の絵(raw と画素がそろわない)なので final から抜き直す(金の円盤なし・右耳の下パネルは縞模様)
- 編み目の四角(`decor-mask.json`)は、同じ髪の帯の少し右上を写して埋める(髪の輪郭は変えない)
- 大きさは差し替え前の公開版の「画像の高さ・体の上端・体の高さ」(`body-height.json`)にそろえる。減色しない

保留: wink(右手は窓口の判断待ち)・立ち絵 stand-card-master(道具の hold。作り直すと wink の場面で顔がずれる注意が、差し替え前の絵でも出る)
