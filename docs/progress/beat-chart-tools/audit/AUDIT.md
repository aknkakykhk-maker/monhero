# 公開中の全曲の点検(読むだけ・譜面は変えていない)

作った道具: `tools/mode/rhythm-chart-audit.js`(中身は `rhythm-chart-review.js` と同じ物差し)。56曲・335譜面。
開催中のイベントの対象曲: なし(いまの本オープン記念キャンペーンは全曲が対象で、対象曲の指定が無い)

## (1) おかしい所

### 決まりに反しているもの(帯の中・モンスター4個でない・太さの飛び): 1譜面

| 曲 | 難易度 | 中身 |
| --- | --- | --- |
| Altar of the World Tree, Beneath the White Night | EXPERT | 太さの飛び 1 |

※ アルター原曲 EXPERT の太さの飛び1本は、2026-11-05 に社長が「配信中の譜面はそのまま・生成器を強化」と決めた分(直さない)。

### 押さえている帯の中のノーツ(決まりより前からある曲。2026-10-13 に「今の件数を上限にそのまま」と決めてある分): 72譜面・849個

検査(`rhythm-chart-hand-rules-check.js`)が上限を見張っている。直すなら位置だけ動かす道具(`rhythm-chart-flow-fix.js --song`)で外へ出せる(遊ぶ譜面が変わるので社長の判断)。

| 曲 | 難易度ごとの数 |
| --- | --- |
| Grievous Lady | HARD 2・EXPERT 6・MASTER 7 |
| MF × ICHIKA MIX | EXPERT 10・MASTER 8 |
| Monster Hero | EXPERT 11・MASTER 10 |
| Monster Hero -Another- | EXPERT 8・MASTER 12 |
| SIX ÉTERNEL(six_eternel_beat) | EXPERT 21・MASTER 19 |
| SIX ÉTERNEL(six_eternel_remix) | EXPERT 12・MASTER 14 |
| Stay With Me(stay_with_me) | EXPERT 23・MASTER 13 |
| 綺季一閃(kiki_issen) | EXPERT 22・MASTER 24 |
| Close To Your Heart | EXPERT 4・MASTER 2 |
| 綺季一閃(eiki_boss_remix) | EXPERT 36・MASTER 24 |
| Stay With Me(pandora_boss_remix) | EXPERT 19・MASTER 15 |
| デュラハンテーマ | EXPERT 5・MASTER 4 |
| 呪われた騎士の時計仕掛け | EXPERT 6・MASTER 4 |
| 4U ～ひたすら～ | EXPERT 2・MASTER 1 |
| 禁断のレジスタンス | EXPERT 1・MASTER 1 |
| crossing field | EXPERT 3・MASTER 1 |
| Nothing Without You | EXPERT 10・MASTER 8 |
| もう一つの世界へ | EXPERT 8・MASTER 5 |
| 戦場の疾風 | EXPERT 9・MASTER 7 |
| 魔窟の旋律 | EXPERT 9・MASTER 5 |
| The City Beneath the Comets | EXPERT 47・MASTER 22 |
| FREEDOM DiVE↓ | EXPERT 8・MASTER 5 |
| Rising Hope | EXPERT 10・MASTER 5 |
| ハルカ | EXPERT 15・MASTER 10 |
| Stay With Me short | EXPERT 38・MASTER 31 |
| 綺季一閃 short | EXPERT 35・MASTER 27 |
| Crazy Party Night(crazy_party_night) | EXPERT 6・MASTER 5 |
| Crazy Party Night(crazy_party_night_full) | EXPERT 17・MASTER 10 |
| Emerald Rush | EXPERT 19・MASTER 19 |
| Wrath of the Thorn King | EXPERT 9・MASTER 5 |
| Monster | EXPERT 13・MASTER 16 |
| Monster short | EXPERT 2・MASTER 3 |
| ANiMA | EXPERT 10・MASTER 8 |
| Journey | EXPERT 15・MASTER 25 |
| only my railgun | MASTER 1 |
| ビッグブリッヂの死闘 | EXPERT 1 |
| Sheriruth | HARD 1 |

### 横持ちの親指2本で「押せない」と出る所がある譜面: 54譜面(合計 99 か所)

両手のシミュレート(公開の関門)は通っている。こちらは横持ちで親指が左右の端から伸びる前提の、より厳しい物差し。3本目の指・持ち替えで押せる所も含む。

| 曲 | 難易度 | 押せない | 時刻(先頭5つ) |
| --- | --- | ---: | --- |
| Sheriruth | HELL | 11 | 1:16.4 1:19.1 1:23.8 1:24.0 1:48.3 |
| Altar of the World Tree, Beneath the White Night short | MASTER | 5 | 0:53.8 0:57.1 1:32.4 2:09.7 2:16.5 |
| Evans | MASTER | 5 | 0:20.9 0:22.4 1:15.0 1:28.7 1:32.3 |
| Stay With Me(stay_with_me) | MASTER | 4 | 1:29.7 3:05.0 3:05.7 3:47.6 |
| Sheriruth | MASTER | 4 | 1:48.4 1:51.0 1:51.2 2:10.7 |
| light player short | MASTER | 4 | 0:29.7 1:35.3 2:18.5 2:19.1 |
| Stay With Me short | MASTER | 3 | 0:38.7 0:42.3 2:28.9 |
| light player short | EXPERT | 3 | 1:22.2 2:24.1 2:28.9 |
| MF × ICHIKA MIX | MASTER | 2 | 1:26.3 2:02.9 |
| Monster Hero | MASTER | 2 | 1:09.3 2:07.7 |
| SIX ÉTERNEL(six_eternel_beat) | MASTER | 2 | 1:43.2 2:11.7 |
| The City Beneath the Comets | EXPERT | 2 | 0:35.6 0:37.6 |
| FREEDOM DiVE↓ | MASTER | 2 | 0:42.5 0:57.3 |
| 綺季一閃 short | MASTER | 2 | 1:35.8 2:29.6 |
| ANiMA | EXPERT | 2 | 1:13.8 1:13.9 |
| SAD SONG | MASTER | 2 | 1:54.6 2:05.2 |
| Toward the Stars, Paradise or Truth short | MASTER | 2 | 0:11.4 1:28.5 |
| BLACK SHOUT | MASTER | 2 | 0:11.9 1:18.0 |
| light player | MASTER | 2 | 2:16.0 2:16.2 |
| 月が満ちる前に | MASTER | 2 | 0:11.7 1:09.4 |
| 月が満ちる前に short | MASTER | 2 | 1:08.2 1:08.7 |
| Rebellion short | EXPERT | 2 | 0:45.4 2:03.9 |
| Monster Hero | EXPERT | 1 | 1:50.2 |
| Monster Hero -Another- | EXPERT | 1 | 1:10.6 |
| SIX ÉTERNEL(six_eternel_remix) | MASTER | 1 | 2:15.9 |
| 綺季一閃(kiki_issen) | EXPERT | 1 | 2:29.9 |
| 綺季一閃(eiki_boss_remix) | MASTER | 1 | 2:08.1 |
| Stay With Me(pandora_boss_remix) | MASTER | 1 | 0:53.5 |
| 呪われた騎士の時計仕掛け | HELL | 1 | 1:25.8 |
| crossing field | EXPERT | 1 | 1:01.8 |
| もう一つの世界へ | MASTER | 1 | 0:18.6 |
| 戦場の疾風 | EXPERT | 1 | 2:24.2 |
| The City Beneath the Comets | MASTER | 1 | 1:45.4 |
| FREEDOM DiVE↓ | EXPERT | 1 | 2:00.7 |
| ハルカ | MASTER | 1 | 1:04.9 |
| 綺季一閃 short | EXPERT | 1 | 0:47.6 |
| Crazy Party Night(crazy_party_night) | EXPERT | 1 | 1:01.4 |
| Crazy Party Night(crazy_party_night_full) | MASTER | 1 | 4:00.4 |
| Emerald Rush | HARD | 1 | 1:50.2 |
| Monster | HELL | 1 | 0:11.6 |

### 交差・届きにくい・跳びが、公開中の同じ難易度の帯(上位5%)より多い譜面: 37譜面

| 曲 | 難易度 | Lv. | 中身 |
| --- | --- | ---: | --- |
| ヒューマノイド | NORMAL | 19 | 交差/100 2.2(帯 〜0)・届きにくい/100 2.5(帯 〜0) |
| Sheriruth | HELL | 48 | 跳びの割合 0.166(帯 〜0.137) |
| FREEDOM DiVE↓ | EASY | 15 | 交差/100 0.3(帯 〜0)・届きにくい/100 2.7(帯 〜0) |
| FREEDOM DiVE↓ | NORMAL | 22 | 交差/100 0.4(帯 〜0)・届きにくい/100 2.1(帯 〜0) |
| Evans | MASTER | 44 | 交差/100 6.9(帯 〜6.825)・届きにくい/100 10.3(帯 〜9.45) |
| Stay With Me short | MASTER | 29 | 届きにくい/100 10.2(帯 〜9.45) |
| ヒューマノイド | MASTER | 50 | 交差/100 8.9(帯 〜6.825)・届きにくい/100 11.7(帯 〜9.45) |
| ヒューマノイド | EASY | 12 | 交差/100 0.4(帯 〜0)・届きにくい/100 0.8(帯 〜0) |
| The City Beneath the Comets | EXPERT | 26 | 交差/100 6(帯 〜3.975) |
| ヒューマノイド | EXPERT | 31 | 交差/100 7.7(帯 〜3.975)・届きにくい/100 8.3(帯 〜7.925)・跳びの割合 0.067(帯 〜0.066) |
| ヒューマノイド | HARD | 25 | 交差/100 0.8(帯 〜0.425)・届きにくい/100 7(帯 〜3.725) |
| SAD SONG short | EXPERT | 24 | 交差/100 4.5(帯 〜3.975) |
| The City Beneath the Comets | MASTER | 39 | 交差/100 7.1(帯 〜6.825) |
| ヒューマノイド | HELL | 77 | 交差/100 16.1(帯 〜9.82)・届きにくい/100 15.8(帯 〜13.99) |
| Stay With Me short | HARD | 16 | 交差/100 0.5(帯 〜0.425)・届きにくい/100 4.5(帯 〜3.725) |
| Rebellion short | MASTER | 42 | 跳びの割合 0.307(帯 〜0.166) |
| トリコ | HARD | 8 | 跳びの割合 0.2(帯 〜0.074) |
| Rebellion | MASTER | 44 | 跳びの割合 0.282(帯 〜0.166) |
| Rebellion | HELL | 48 | 跳びの割合 0.234(帯 〜0.137) |
| Rebellion short | HELL | 49 | 跳びの割合 0.236(帯 〜0.137) |
| Altar of the World Tree, Beneath the White Night short | HELL | 53 | 交差/100 11.8(帯 〜9.82) |
| SAD SONG short | HARD | 16 | 交差/100 0.5(帯 〜0.425) |
| Sheriruth | EXPERT | 33 | 跳びの割合 0.141(帯 〜0.066) |
| Stay With Me(stay_with_me) | HELL | 31 | 交差/100 10.1(帯 〜9.82)・届きにくい/100 15(帯 〜13.99) |
| Sheriruth | HARD | 22 | 跳びの割合 0.121(帯 〜0.074) |
| Emerald Rush | EXPERT | 18 | 届きにくい/100 8.5(帯 〜7.925) |
| 4U ～ひたすら～ | NORMAL | 7 | 跳びの割合 0.083(帯 〜0.058) |
| Stay With Me short | EASY | 7 | 跳びの割合 0.026(帯 〜0) |
| Stay With Me short | EXPERT | 21 | 届きにくい/100 8.4(帯 〜7.925) |
| Monster | NORMAL | 7 | 跳びの割合 0.077(帯 〜0.058) |
| Rebellion | EASY | 9 | 跳びの割合 0.023(帯 〜0) |
| トリコ | MASTER | 17 | 跳びの割合 0.179(帯 〜0.166) |
| The City Beneath the Comets | HELL | 49 | 届きにくい/100 14.2(帯 〜13.99) |
| FREEDOM DiVE↓ | HARD | 26 | 届きにくい/100 3.8(帯 〜3.725) |
| Stay With Me(stay_with_me) | NORMAL | 7 | 跳びの割合 0.059(帯 〜0.058) |
| 戦場の疾風 | HARD | 15 | 跳びの割合 0.076(帯 〜0.074) |
| 魔窟の旋律 | EXPERT | 22 | 跳びの割合 0.068(帯 〜0.066) |

## (2) 表示の Lv. と実際の難しさ(体感の数字)

全335譜面の表示 Lv. に、体感の数字(毎秒・最密4秒・速さ(1000/最短ms)・交差/100・届きにくい/100・連打の割合・跳びの割合・長押しの割合・空中の割合・休みなし秒)を当てはめた式との差。ばらつき(標準偏差)は 2.22。
地上の5難易度と HELL は別々に当てはめた。「差」が大きく、数字の近い5譜面の Lv. と比べても同じ向きに4以上ずれているものだけを並べた。差=まちがいではない(社長が決めた Lv. や、数字に出ない難しさ=見分けにくさ・止まる演出などがある)。

### 表示の Lv. が、数字のわりに高い(遊ぶと「思ったより易しい」になりやすい): 10譜面

| 曲 | 難易度 | 表示Lv. | 数字からの見込み | 差 | 近い5譜面のLv.の中央 | ノーツ | 毎秒 | 最密4秒 | 最短ms | 交差 | 届きにくい |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Grievous Lady | MASTER | 50 | 40.9 | +9.1 | 35 | 636 | 4.65 | 41 | 71 | 0 | 0 |
| FREEDOM DiVE↓ | MASTER | 47 | 39.5 | +7.5 | 34 | 814 | 5.73 | 34 | 67 | 11 | 45 |
| 月が満ちる前に short | HELL | 65 | 58.6 | +6.4 | 53 | 562 | 5.23 | 36 | 79 | 41 | 53 |
| ROSE short | MASTER | 33 | 27.1 | +5.9 | 25 | 356 | 3.18 | 29 | 120 | 1 | 7 |
| only my railgun | MASTER | 29 | 23.3 | +5.7 | 23 | 325 | 3.74 | 24 | 104 | 0 | 4 |
| ヒューマノイド | MASTER | 50 | 44.3 | +5.7 | 33 | 606 | 6.4 | 34 | 94 | 54 | 71 |
| BLACK SHOUT | HELL | 61 | 55.4 | +5.6 | 50 | 508 | 4.81 | 32 | 81 | 38 | 49 |
| 月が満ちる前に | HELL | 65 | 59.4 | +5.6 | 52 | 1419 | 5.23 | 38 | 79 | 73 | 117 |
| Close To Your Heart | MASTER | 28 | 22.7 | +5.3 | 21 | 356 | 3.07 | 25 | 115 | 0 | 2 |
| ANiMA | MASTER | 44 | 39 | +5 | 34 | 567 | 5.16 | 33 | 81 | 15 | 36 |

### 表示の Lv. が、数字のわりに低い(遊ぶと「思ったより難しい」になりやすい): 4譜面

| 曲 | 難易度 | 表示Lv. | 数字からの見込み | 差 | 近い5譜面のLv.の中央 | ノーツ | 毎秒 | 最密4秒 | 最短ms | 交差 | 届きにくい |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Monster Hero -Another- | HELL | 35 | 40.6 | -5.6 | 42 | 586 | 3.88 | 29 | 87 | 33 | 51 |
| Journey | EXPERT | 23 | 28.3 | -5.3 | 29 | 627 | 3.9 | 28 | 117 | 4 | 15 |
| もう一つの世界へ | HELL | 37 | 42.2 | -5.2 | 51 | 887 | 4 | 32 | 80 | 30 | 50 |
| Monster Hero | HELL | 44 | 49.1 | -5.1 | 51 | 652 | 4.37 | 35 | 86 | 22 | 37 |

### 同じ曲の難易度の段の逆転・差が無い: 3譜面

| 曲 | 中身 |
| --- | --- |
| Stay With Me(pandora_boss_remix) | HARD→EXPERT: ノーツ数 ×1.21・最密4秒 ×0.94 |
| トリコ | EASY→NORMAL: ノーツ数 ×1.09・最密4秒 ×0.89 |
| 魔窟の旋律 | EXPERT→MASTER: ノーツ数 ×1.02・最密4秒 ×1.04 |

## (3) 曲ごとの要約(問題の大きい順)

点数 = 帯の中(新しい決まりの曲だけ)×6 + モンスター4個でない 8 + 太さの飛び×3 + 押せない×4 + 帯を超えた交差・届きにくい・跳びの超え方×5 + 段の逆転 6 + Lv. の差(並べた譜面だけ)。

| 曲 | 点数 | 中身 |
| --- | ---: | --- |
| ヒューマノイド | 92.2 | EASY: 交差/100 0.4(帯 〜0)・届きにくい/100 0.8(帯 〜0) / NORMAL: 交差/100 2.2(帯 〜0)・届きにくい/100 2.5(帯 〜0) / HARD: 交差/100 0.8(帯 〜0.425)・届きにくい/100 7(帯 〜3.725) / EXPERT: 押せない 1・交差/100 7.7(帯 〜3.975)・届きにくい/100 8.3(帯 〜7.925)・跳びの割合 0.067(帯 〜0.066) / MASTER: 押せない 1・交差/100 8.9(帯 〜6.825)・届きにくい/100 11.7(帯 〜9.45)・表示が高い(表示 50・見込み 44.3) / HELL: 交差/100 16.1(帯 〜9.82)・届きにくい/100 15.8(帯 〜13.99) |
| FREEDOM DiVE↓ | 74.6 | EASY: 交差/100 0.3(帯 〜0)・届きにくい/100 2.7(帯 〜0) / NORMAL: 交差/100 0.4(帯 〜0)・届きにくい/100 2.1(帯 〜0) / HARD: 届きにくい/100 3.8(帯 〜3.725) / EXPERT: 押せない 1 / MASTER: 押せない 2・表示が高い(表示 47・見込み 39.5) |
| Sheriruth | 61.5 | HARD: 跳びの割合 0.121(帯 〜0.074) / EXPERT: 跳びの割合 0.141(帯 〜0.066) / MASTER: 押せない 4 / HELL: 押せない 11・跳びの割合 0.166(帯 〜0.137) |
| light player short | 28 | EXPERT: 押せない 3 / MASTER: 押せない 4 |
| Altar of the World Tree, Beneath the White Night short | 21 | MASTER: 押せない 5 / HELL: 交差/100 11.8(帯 〜9.82) |
| Evans | 20.5 | MASTER: 押せない 5・交差/100 6.9(帯 〜6.825)・届きにくい/100 10.3(帯 〜9.45) |
| 月が満ちる前に | 17.6 | EXPERT: 押せない 1 / MASTER: 押せない 2 / HELL: 表示が高い(表示 65・見込み 59.4) |
| Monster Hero | 17.1 | EXPERT: 押せない 1 / MASTER: 押せない 2 / HELL: 表示が低い(表示 44・見込み 49.1) |
| ANiMA | 17 | EXPERT: 押せない 2 / MASTER: 押せない 1・表示が高い(表示 44・見込み 39) |
| Stay With Me(stay_with_me) | 16.5 | NORMAL: 跳びの割合 0.059(帯 〜0.058) / MASTER: 押せない 4 / HELL: 交差/100 10.1(帯 〜9.82)・届きにくい/100 15(帯 〜13.99) |
| Stay With Me short | 14.8 | EASY: 跳びの割合 0.026(帯 〜0) / HARD: 交差/100 0.5(帯 〜0.425)・届きにくい/100 4.5(帯 〜3.725) / EXPERT: 届きにくい/100 8.4(帯 〜7.925) / MASTER: 押せない 3・届きにくい/100 10.2(帯 〜9.45) |
| The City Beneath the Comets | 14.8 | EXPERT: 押せない 2・交差/100 6(帯 〜3.975) / MASTER: 押せない 1・交差/100 7.1(帯 〜6.825) / HELL: 届きにくい/100 14.2(帯 〜13.99) |
| 月が満ちる前に short | 14.4 | MASTER: 押せない 2 / HELL: 表示が高い(表示 65・見込み 58.6) |
| BLACK SHOUT | 13.6 | MASTER: 押せない 2 / HELL: 表示が高い(表示 61・見込み 55.4) |
| 綺季一閃 short | 12 | EXPERT: 押せない 1 / MASTER: 押せない 2 |
| SAD SONG | 12 | EXPERT: 押せない 1 / MASTER: 押せない 2 |
| Toward the Stars, Paradise or Truth short | 12 | EXPERT: 押せない 1 / MASTER: 押せない 2 |
| Rebellion short | 10.4 | EXPERT: 押せない 2 / MASTER: 跳びの割合 0.307(帯 〜0.166) / HELL: 跳びの割合 0.236(帯 〜0.137) |
| Rebellion | 10.4 | EASY: 跳びの割合 0.023(帯 〜0) / HARD: 押せない 1 / EXPERT: 押せない 1 / MASTER: 跳びの割合 0.282(帯 〜0.166) / HELL: 跳びの割合 0.234(帯 〜0.137) |
| Stay With Me(pandora_boss_remix) | 10 | EXPERT: 段の逆転(HARD→EXPERT: ノーツ数 ×1.21・最密4秒 ×0.94) / MASTER: 押せない 1 |
| Monster Hero -Another- | 9.6 | EXPERT: 押せない 1 / HELL: 表示が低い(表示 35・見込み 40.6) |
| SAD SONG short | 9.5 | HARD: 交差/100 0.5(帯 〜0.425) / EXPERT: 押せない 1・交差/100 4.5(帯 〜3.975) / MASTER: 押せない 1 |
| もう一つの世界へ | 9.2 | MASTER: 押せない 1 / HELL: 表示が低い(表示 37・見込み 42.2) |
| Grievous Lady | 9.1 | MASTER: 表示が高い(表示 50・見込み 40.9) |
| MF × ICHIKA MIX | 8 | MASTER: 押せない 2 |
| SIX ÉTERNEL(six_eternel_beat) | 8 | MASTER: 押せない 2 |
| ROSE | 8 | MASTER: 押せない 1 / HELL: 押せない 1 |
| light player | 8 | MASTER: 押せない 2 |
| トリコ | 7.4 | NORMAL: 段の逆転(EASY→NORMAL: ノーツ数 ×1.09・最密4秒 ×0.89) / HARD: 跳びの割合 0.2(帯 〜0.074) / MASTER: 跳びの割合 0.179(帯 〜0.166) |
| Altar of the World Tree, Beneath the White Night | 7 | EXPERT: 太さの飛び 1 / HELL: 押せない 1 |
| 魔窟の旋律 | 6 | EXPERT: 跳びの割合 0.068(帯 〜0.066) / MASTER: 段の逆転(EXPERT→MASTER: ノーツ数 ×1.02・最密4秒 ×1.04) |
| ROSE short | 5.9 | MASTER: 表示が高い(表示 33・見込み 27.1) |
| only my railgun | 5.7 | MASTER: 表示が高い(表示 29・見込み 23.3) |
| Close To Your Heart | 5.3 | MASTER: 表示が高い(表示 28・見込み 22.7) |
| Journey | 5.3 | EXPERT: 表示が低い(表示 23・見込み 28.3) |
| Emerald Rush | 4.4 | HARD: 押せない 1 / EXPERT: 届きにくい/100 8.5(帯 〜7.925) |
| Monster | 4.2 | NORMAL: 跳びの割合 0.077(帯 〜0.058) / HELL: 押せない 1 |
| SIX ÉTERNEL(six_eternel_remix) | 4 | MASTER: 押せない 1 |
| 綺季一閃(kiki_issen) | 4 | EXPERT: 押せない 1 |
| 綺季一閃(eiki_boss_remix) | 4 | MASTER: 押せない 1 |
| 呪われた騎士の時計仕掛け | 4 | HELL: 押せない 1 |
| crossing field | 4 | EXPERT: 押せない 1 |
| 戦場の疾風 | 4 | HARD: 跳びの割合 0.076(帯 〜0.074) / EXPERT: 押せない 1 |
| ハルカ | 4 | MASTER: 押せない 1 |
| Crazy Party Night(crazy_party_night) | 4 | EXPERT: 押せない 1 |
| Crazy Party Night(crazy_party_night_full) | 4 | MASTER: 押せない 1 |
| Monster short | 4 | HELL: 押せない 1 |
| 4U ～ひたすら～ | 0.3 | NORMAL: 跳びの割合 0.083(帯 〜0.058) |
| 風がそよぐ場所 | 0 | 気になる所なし |
| デュラハンテーマ | 0 | 気になる所なし |
| 禁断のレジスタンス | 0 | 気になる所なし |
| Nothing Without You | 0 | 気になる所なし |
| ビッグブリッヂの死闘 | 0 | 気になる所なし |
| Rising Hope | 0 | 気になる所なし |
| Wrath of the Thorn King | 0 | 気になる所なし |
| Against My Own Shadow | 0 | 気になる所なし |
