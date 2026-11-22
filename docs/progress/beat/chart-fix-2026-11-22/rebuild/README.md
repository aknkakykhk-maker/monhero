# Beyond the Same Sky の MASTER・HELL を歌い分けで組み直した(2026-11-22・ビート)

台帳 r1119-096(追記「ダブルボーカルの曲だから、そこんとこうまく読み取って気持ちよくやれるように」)・r1119-105(記録はそのまま残す)。
**社長が見て OK するまで公開しない。**

## 何をしたか

#7187・#7198 のような「交差するタップの位置だけをずらす」直しではなく、**声の拍から譜面を組み直した**(時刻もノーツ数も変わる)。

1. 声だけの音源(audio-separator・UVR-MDX-NET-Voc_FT)から、言葉の頭・音の高さ・伸ばしの長さを取った
   (`tools/audio/vocal-notes.py` → `../vocal-split/<曲>-vocal-notes.json`)。なめらかに歌う所は音の高さの変わり目でも言葉を区切る。
   mp3 の読み方の違いのずれ(-32ms)は、元の音の立ち上がりを解析ファイルに重ねて合わせた(解析ファイルは作り直していない)
2. 区間の表(`../vocal-split/parts-table.md`)と手の割り当て(`../vocal-split/hand-design.md`)のとおりに並べた(`tools/mode/rhythm-vocal-split-chart.js`)
   - 女声(みゅあ)=右手・男声(あつ)=左手。歌っている手が言葉の頭、反対の手は自分の側で伴奏の拍(4分。MASTER の静かな所は2分)
   - 歌う手の位置は声の高さで決める(高い音ほど外側)。帯(ホールド・スライド)は歌っている手の側にだけ置く → **押さえ中の交差は出ない形**
   - 区間の最後の言葉(反対の手へ渡す所)と、1拍ほど空く行の終わりはフリック(外へ払う)
   - 2人・ハモり: 言葉の頭は左右の同時押し(鏡写し)、伸ばしは左右対称のホールド・スライド。HELL はサビ・ハモりの言葉の頭を空中の同時押しに
   - 女声+低い男声(サビ): 右手が主旋律。左手は拍の頭と伸ばしの頭に低い重ねを添える。HELL は右手の伸ばしを空中スライドに
   - 同じ手が速く続く言葉(HELL 160ms 未満・MASTER 200ms 未満)は、反対の手が空いていれば反対の手の内側(真ん中寄り)へ渡す。
     片手の続きが4つを超える所も同じ(片手だけで速く続かないように)
   - MASTER は空中なし。地上のノーツは幅3(手の半分の中だけ)。サビ(盛り上がり 0.75 以上)だけ歌う手の8分を許す
3. 曲ごとの密度の値(`TUNE`)は、点検(`rhythm-chart-review.js`)の帯と、Lv. が今の本番に近いことで決めた

## 数字

| 譜面 | 版 | ノーツ | Lv.(表示) | 押さえ中の交差 |
| --- | --- | --- | --- | --- |
| 原曲 MASTER | #7187の前 / #7187 / #7198(本番) / **新しい版** | 1060 / 1060 / 1060 / **1112** | 33 / 33 / 33 / **36** | 2 / 1 / 2 / **0** |
| 原曲 HELL | 同上 | 1229 / 1229 / 1229 / **1227** | 55 / 55 / 55 / **55**(式 56) | 33 / 7 / 22 / **0** |
| short MASTER | 同上 | 634 / 634 / 634 / **639** | 35 / 35 / 35 / **32** | 9 / 2 / 7 / **0** |
| short HELL | 同上 | 715 / 715 / 715 / **733** | 58 / 58 / 58 / **58**(式 57) | 35 / 4 / 19 / **0** |

- **Lv. が変わる: 原曲 MASTER 33→36・short MASTER 35→32。** HELL の表示は固定の値(LEVEL_OVERRIDES)のまま
- 手の決まり(同じ側の地上⇔空中150ms・空中は地上から250ms・押さえている帯の側・90ms 未満の押し始め)は Beyond の HELL で全部0件。
  親指2本の押せない(横持ち・縦持ち)0。点検(`rhythm-chart-review.js`)の帯の外れ0
- ランキング・自己ベストは触っていない(r1119-105「そのまま残す」)。保存キー・表は変えていない

## 比べ絵(左から #7187の前・#7187・#7198(いまの本番)・新しい版)

時間は下から上。真ん中の線より左が左手・右が右手。左の帯が歌い分け(赤=女声・青=男声・紫=2人)。赤い横帯が押さえ中の交差。

| 絵 | 見どころ |
| --- | --- |
| [原曲 HELL 0〜14秒](beyond_the_same_sky-HELL-000-014.png) | 前奏は左右交互・女声に入ると右手が言葉を叩く |
| [原曲 HELL 21〜35秒](beyond_the_same_sky-HELL-021-035.png) | 女声→男声で歌う手が右→左へ移る |
| [原曲 HELL 35〜52秒](beyond_the_same_sky-HELL-035-052.png) | 1行ずつの掛け合い。行の終わりのフリックで反対の手へ |
| [原曲 HELL 51〜64秒](beyond_the_same_sky-HELL-051-064.png) | サビ(女声+低い男声)。右手の空中・伸ばしの空中スライド |
| [原曲 HELL 73〜90秒](beyond_the_same_sky-HELL-073-090.png) | 2人・ハモり。左右対称のホールドと空中の同時押し |
| [原曲 HELL 113〜131秒](beyond_the_same_sky-HELL-113-131.png) | 速い掛け合い(前の版の交差が2か所あった所) |
| [原曲 HELL 164〜180秒](beyond_the_same_sky-HELL-164-180.png) | 最後のサビ |
| [原曲 HELL 209〜229秒](beyond_the_same_sky-HELL-209-229.png) | 2人のハモり・山場 |
| [原曲 MASTER 21〜35秒](beyond_the_same_sky-MASTER-021-035.png) / [51〜64秒](beyond_the_same_sky-MASTER-051-064.png) / [113〜131秒](beyond_the_same_sky-MASTER-113-131.png) / [209〜229秒](beyond_the_same_sky-MASTER-209-229.png) | MASTER(空中なし・幅3) |
| [short HELL 35〜52秒](beyond_the_same_sky_short-HELL-035-052.png) / [103〜118秒](beyond_the_same_sky_short-HELL-103-118.png) / [135〜153秒](beyond_the_same_sky_short-HELL-135-153.png) | short ver. HELL |
| [short MASTER 51〜64秒](beyond_the_same_sky_short-MASTER-051-064.png) / [135〜153秒](beyond_the_same_sky_short-MASTER-135-153.png) | short ver. MASTER |

## 区間ごとにどう作ったか

各区間に置いた物の内訳(伴奏・言葉の頭・受け渡し・行の終わりのフリック・ホールド・スライド・空中…)と歌詞:

- [原曲 HELL](sections-beyond_the_same_sky-HELL.md) / [原曲 MASTER](sections-beyond_the_same_sky-MASTER.md)
- [short HELL](sections-beyond_the_same_sky_short-HELL.md) / [short MASTER](sections-beyond_the_same_sky_short-MASTER.md)

## 見てほしい所(気になっている点)

- **受け渡し**: 速い言葉を反対の手の内側へ渡すので、女声の区間でも左手が真ん中寄りで少し叩く(例: 原曲 HELL 116〜120秒)。
  渡さないと片手だけで速く続き、点検の「片手の続き」の帯を外れる。もっと「歌う手だけ」に寄せたいなら、密度(Lv.)を下げる代わりに渡しを減らせる
- 声の分け方は機械なので、声の拍の取りこぼし・余分がある(声だけの音源の精度による)

## 作り直し方

```
python3 -I tools/audio/vocal-notes.py <声だけの wav> monster-hero/audio/bgm-beyond-the-same-sky.mp3 docs/progress/beat/chart-fix-2026-11-22/vocal-split/beyond_the_same_sky-vocal-notes.json
node tools/mode/rhythm-vocal-split-chart.js --song beyond_the_same_sky --diff HELL --write --table <一覧.md>
node tools/mode/rhythm-chart-versions-export.js --song beyond_the_same_sky --diff HELL --rev "#7187の前=b35fc9e3^" --rev "#7187=b35fc9e3" --rev "#7198(いまの本番)=c5d801a8" --rev "新しい版=WORK" --out <json>
python3 -I tools/mode/rhythm-chart-compare-png.py <json> docs/progress/beat/chart-fix-2026-11-22/vocal-split/parts-table.json full 51 64 <出力.png> "<題>"
```
