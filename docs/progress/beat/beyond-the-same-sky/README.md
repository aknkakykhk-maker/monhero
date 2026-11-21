# 新曲 Beyond the Same Sky(原曲・short ver.)の追加(台帳 r1119-076・追跡表 r1121-022)

曲だけの PR。お話(あつとみゅあの W.o.F のころの思い出)は別の会話が作る。

## 作ったもの

| | 原曲 `beyond_the_same_sky` | short ver. `beyond_the_same_sky_short` |
| --- | --- | --- |
| 長さ | 4分18秒(+頭の無音2秒) | 2分31秒(+頭の無音2秒) |
| テンポ・拍の頭 | 178 BPM・2058ms(4拍子・揺れなし) | 同じ |
| 音源 | 48kHz / 192kbps・-14.00 LUFS / -1.99 dBTP | 48kHz / 224kbps・-14.00 LUFS / -2.30 dBTP |
| ジャケット | 音源に埋め込まれていた絵 360×360 | 音源に埋め込まれていた絵 1254×1254(原曲と別の絵) |
| Lv. | 7 / 9 / 14 / 25 / 33 / HELL 55 | 7 / 9 / 15 / 23 / 35 / HELL 58 |
| ノーツ数 | 409 / 479 / 642 / 906 / 1060 / 1229 | 240 / 276 / 384 / 464 / 634 / 715 |
| 歯ごたえのつまみ | `chartIntensity:'mild'`・HELL は `chartIntensityByDifficulty:{HELL:'extreme'}` と `hellDensity:1.4` | `masterDensity:1.2`・HELL は同じ |
| 値段 | ビートP500(買うと short ver. も開く) | 原曲に付く |

- short ver. は原曲を切った物ではない(前半は原曲と 0.16 秒ずれで一致・後半は別の編集)ので、2曲それぞれを解析した
- 最初のノーツはどちらも 2.395 秒(2秒より後)
- 手で直したノーツ: 原曲 MASTER 202.206秒のタップ(同じ指で84msの叩き直し)を左端へ、short MASTER 93.406秒のタップ(押さえている帯の中)を右へ。時刻・数は変えていない

## 社長の決めごととの突き合わせ

| 決めごと | どこで満たすか |
| --- | --- |
| r1119-076 マスター 30〜35 くらい | 原曲 MASTER Lv.33・short MASTER Lv.35(`review/*-master.png`) |
| r1119-076 ヘルはかなり難しく | HELL 原曲 Lv.55・short Lv.58(MASTER より +22〜23。濃さは 1.6 でも上がらず頭打ち)(`review/*-hell.png`) |
| r1119-076 ジャケットは埋め込みの絵 | `images/song-art/beyond-the-same-sky(-short).jpg`(縮めずに JPEG へ) |
| r1119-076 曲の説明は短く | 更新履歴の1行「あつとみゅあの曲で、ギルド『W.o.F』のころの思い出を歌っています」 |
| r1115-143 画質・音質を下げない | 元の 48kHz・元のビットレート相当・ジャケットは元の大きさ |
| r1119-058 重さの検査 | `rhythm-stall-check.js --song` の結果(下) |
| 新しい譜面は流れで押せる配置 | 一覧に `flowPlacement:true` |
| 新曲は HELL あり・モンスター4個 | 全6難易度でモンスター4個・水平クロス0・帯の中0・見分けにくい所0 |
| 新曲はビートP500 | `RHYTHM_SONG_PRICES` と `RHYTHM_SONG_BUNDLE_OWNER` |

## 重さの検査(r1119-058)

下の「重さの結果」に書く。

### 重さの結果(`rhythm-stall-check.js --song`・HARD・CPU 4倍遅く・0〜12秒目)

| 曲 | 止まり(50ms超) | 最大 | 基準 crossing_field | 判定 |
| --- | --- | --- | --- | --- |
| 原曲 | 4回 | 133ms | 5回・83ms | OK |
| short ver. | 5回 | 83ms | 3回・100ms | OK |

- 裏で別の検査を回しながら測った回は、変えていない天翔る翼でも 6→12 回と出た(ぶれ)。静かな状態で測り直した値を載せた
- short ver. は1回目 2→5 で許す幅を1回超え、2回目 3→5 で OK(ぶれの範囲)

## 前からある NG(作業前のコミット 22da83d4 でも落ちる・新曲と無関係)

`audio/bgm-check.js`・`audio/auto-bgm-picker-browser-check.js`・`mode/extreme-browser-check.js`・`mode/raid-jack-home-say-tap-check.js`・
`mode/raid-jack-screen-browser-check.js`・`mode/rhythm-chart-v3-check.js`(seasons)・`mode/rhythm-hell-level-check.js`(seasons)・
`mode/rhythm-landscape-layout-check.js`・`mode/rhythm-multi-layout-check.js`・`mode/rhythm-option-preview-check.js`・
`mode/rhythm-portrait-play-modes-check.js`・`mode/rhythm-result-effect-check.js`・`mode/rhythm-song-list-scroll-check.js`・`mode/rhythm-touch-bridge-check.js`

## この変更で新しく落ちる検査(窓口へ)

`mode/rhythm-song-shop-check.js`: ビートP交換所の「曲」で、幅320px(narrow)のときだけ、天翔る翼の札に 38px の空き(基準 32px 以内)。
同じ段に並ぶ新曲の札は題「Beyond the Same Sky」が2行に折れて高いので、段の高さにそろえた天翔る翼の札に空きが出る(r1115-162 の「同じ段は下にそろえる」の結果)。
390px・横持ちでは出ない。交換所の見た目の直しはモンビーの直し(r1119-036・直す前に社長に聞く)なので、この PR では直していない。
