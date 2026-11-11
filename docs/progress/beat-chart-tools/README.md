# 譜面制作ツールの強化(2026-11-11・フメン・MHB CHART ENGINE Rev.37)

社長「最新モデルで譜面制作ツールを強化したい」。配信中の曲の譜面・既存の解析・ゲーム本体は変えていない。効くのは次に作る曲から。
決まりの本文: [`docs/rules/CHART_ENGINE.md`](../../rules/CHART_ENGINE.md)「作った譜面の点検と仕上げ」。

## 足したもの

| 道具 | 何をする |
| --- | --- |
| `tools/mode/rhythm-chart-review.js` | 作った譜面・公開中の譜面を同じ物差しで点検。表・帯の外(※)・「ここを見て」・止め絵・前後比べ |
| `tools/mode/rhythm-chart-flow-fix.js --track` | 手の仕上げ。公開前の書き出しで、押せない所・帯の中(既定)と、いやらしい形(`handFinish`)を位置だけで直す |
| `tools/mode/rhythm-chart-tune.js` | 狙い(ノーツ数・Lv.)に近いつまみの組み合わせを書かずに探す |
| 生成器・自動修正(Rev.37) | モンスターノーツの欠けた枠を付け直す/自動修正のあと帯の中へ戻ったノーツを外へ |
| `tools/mode/rhythm-chart-review-check.js` | 上の決まりの見張り |

## 比べた結果(強化前のワークツリー vs 強化後・7曲の EXPERT と MASTER の14譜面の合計)

書き出すだけで、ゲームのデータには入れていない。曲: Evans・ROSE(全編/short)・ヒューマノイド・Altar short・Rebellion short・Toward the Stars short。

| | 強化前 | 交差はそのまま(`must`) | 山場を残して減らす(`keep-climax`・既定) | 全部減らす(`smooth`) |
| --- | ---: | ---: | ---: | ---: |
| 横持ちの親指で押せない | 15 | 1 | 2 | 2 |
| 押さえている帯の中 | 38 | 0 | 0 | 0 |
| モンスターが4個でない譜面 | 6 | 0 | 0 | 0 |
| 交差 | 250 | 240 | 108 | 18 |
| 届きにくい(真ん中越え) | 431 | 430 | 231 | 90 |
| 速い続きの跳び | 167 | 164 | 145 | 131 |

上の表は強さごとの比べ(自動修正のあとに、それぞれの強さの手の仕上げを当てたもの)。**確定した既定の流れ**(生成 → 自動修正 → 手の仕上げ。EXPERT・MASTER は `keep-climax`)で作り直した最終の値は、
押せない 15 → 2・帯の中 38 → 0・モンスターが4個でない譜面 6 → 0・交差 250 → 105・届きにくい 431 → 227・跳び 167 → 144。EASY〜HARD の21譜面は交差 12・届きにくい 97・跳び 37 のまま変わらない。
止め絵: `humanoid-master-before-vs-after.png`・`evans-master-before-vs-after.png`(左が強化前・右が強化後)。

ノーツ数はどれも同じ(位置だけ動かす)。Lv. は ±1(`smooth` は Evans EXPERT だけ +3)。
前からあった直しの道具は交差を消すと跳びが増えた(ヒューマノイド MASTER で 16 → 51)ので、流れを崩す1歩も点数に入れた(同じ譜面で 16 → 14)。

## 止め絵(下から上へ進む・1本が8小節・左が前/右が後・柱の右の印が問題の場所)

- 強化前 → 交差はそのまま(`must`): `humanoid-master-before-vs-must.png`・`evans-master-before-vs-must.png`
- `must` → 山場を残して減らす(既定): `humanoid-master-must-vs-keep-climax.png`・`evans-master-must-vs-keep-climax.png`
- `must` → 全部減らす: `humanoid-master-must-vs-smooth.png`・`evans-master-must-vs-smooth.png`

## 社長の決定(2026-11-11)

A: 新曲の EXPERT・MASTER は、交差・真ん中越えを既定で減らす。いちばん盛り上がる区切りの交差は見せ場として残す(表の「山場を残して減らす」の列が既定)。
曲ごとに変えるときは曲の一覧の `handFinish`('must'=交差はそのまま・'smooth'=全部減らす)。

## 公開中の全曲の点検(2026-11-11 社長「全曲確認しておかしくないかとか、レベルに見合ってるとかのチェックもしたい」)

報告: [`audit/AUDIT.md`](audit/AUDIT.md)(56曲・335譜面・読むだけ。譜面は変えていない)。作り直すときは `node tools/mode/rhythm-chart-audit.js --write docs/progress/beat-chart-tools/audit --pictures 6`。
直す案(Lv. の表示だけ直す/譜面の形を直す)は報告の数字をもとに窓口へ出し、社長の判断を待つ。
テンポの「理想の手」の自動演奏(`tools/playbot/rhythm-ideal-hands.js`)は、全曲の通しがまだ無い(10/10 前後に HELL 4曲・MASTER 33曲を通して MISS・BAD 0。記録は `docs/playbot/history/rhythm.md`)。
全曲の通しは今日からビート班の担当。結果が出たら、この点検の「押せない」の一覧と突き合わせる。

## 次の強化の案

[`NEXT-PLAN.md`](NEXT-PLAN.md)(サビを見つける・盛り上がりに合わせて量を配る・短い動機の写し・主旋律の線・置く時点で手を決める・楽器の聞き分けは今の仕組みでは無理)。
