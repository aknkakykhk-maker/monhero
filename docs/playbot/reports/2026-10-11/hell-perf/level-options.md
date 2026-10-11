# HELL の Lv. の選び方(社長に聞く用・2026-10-11 オンプくん)

社長「ヘル2つの難易度だけど、両方デバッグしてみたときにまた数値の調整はすると思う」。
いまの Lv. は「空中を地上と見なした Lv. × 1.2」(空中2割増し・`tools/mode/rhythm-chart-level.js` の `SKY_LEVEL_FACTOR`)。

| HELL | 地上と見なした Lv. | 1割増し | **2割増し(いま)** | 3割増し | 同じ曲の MASTER の表示 |
| --- | --- | --- | --- | --- | --- |
| Sheriruth | 45 | 50 | **54** | 59 | 35(式は45。社長の値で下げてある) |
| Grievous Lady | 50 | 55 | **60** | 65 | 50 |

## 社長に聞くときの選択肢(案)

1. このまま(2割増し)
2. 1割増しにする(Sheriruth 50・Grievous Lady 55)
3. 3割増しにする(Sheriruth 59・Grievous Lady 65)
4. 曲ごとに数字を言う

## 返事が来たら直す所(どれも数分)

- 1〜3(決まりごと全体を変える): `rhythm-chart-level.js` の `SKY_LEVEL_FACTOR` を 1.1 / 1.3 に変え、
  `node tools/mode/rhythm-hell-mix.js --song sheriruth --write` で Sheriruth HELL の Lv. を書き直す。
  Grievous Lady HELL はリバースくんの道具で書き直す。空中の無い譜面(地上の5難易度・公開中の曲)の Lv. は変わらない
- 4(曲ごとの社長の値): `rhythm-chart-level.js` の `LEVEL_OVERRIDES` に1行足す
  (例 `sheriruth_hell_debug:Object.freeze({HELL:50})`・`grievous_lady_hell:Object.freeze({MASTER:55})`)。
  式の値は消えず、`rhythm-chart-level-check.js` が「譜面の Lv. = 社長の値」と「式の値 = 地上の × 1.2」を並べて見る
