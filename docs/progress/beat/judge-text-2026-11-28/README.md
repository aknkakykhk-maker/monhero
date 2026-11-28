# 押したときの見た目の書き換えを減らす(2026-11-28 テンポくん・台帳 r1126-104 追記3・追跡表 r1128-071)

重さの調べ(docs/progress/perf-2026-11-28 の「案G」)で、密な所のかくつきは「ノーツを押したときに走る見た目の計算」が元と分かった。
社長の選択「A(道の光も案G も直す)」→ 前後で差が測れなかったので窓口へ戻し、社長の答え「B 撮り比べと検査を通して公開」。見た目は変えない。

## 何がスタイルを計算し直させていたか(Rebellion MASTER のいちばん密な5秒・WebGL・CPU4倍・押す)

ブラウザの記録(スタイルの無効化のトレース)から数えた上位:

| 書き換え | 直す前 | 直したあと |
|---|---|---|
| 押したサブレーンの光(12本)の要素 | 313 | 242 |
| 判定の文字(文字・ポンと出る動き) | 64 | 78 |
| ライフのハートの動き | 53 | (変えていない) |
| コンボの数 | 41 | 41 |

- 押さないとスタイルの計算は 8ms/秒、押すと 67ms/秒。判定の文字とコンボを出さない設定にしても 54ms/秒で、文字とコンボの分は2割ほど
- 道の光は「指の位置」と「指の触れている幅」の2か所が別々に書き、1回押すと同じ要素を2回書いていた

## 直したこと

| 所 | 直し |
|---|---|
| `data/rhythm-mode.js` `rhythmLaneGlowApply`(新)・`applyTouchSpanGlow` | 道の光を書く所を1つにした。どちらの印(`data-pressed`・`data-rhythm-touchspan`)でも CSS は同じ光り方なので、どちらかが付いていればもう一方は書き足さない。理由が入れ替わるときは新しい印を先に付けてから古い印を外す(光は途切れない) |
| `src/parts/30-rhythm-play.jsx` `setPressedLanes` | 上の書く所を使う |
| `src/parts/30-rhythm-play.jsx` `RhythmHudJudgment` | 判定の文字・印・FAST/SLOW を、部品を描き直さずに直接書く。文字は中の文字の要素を作り直さず中身だけ書き換える。書く中身の式は前と同じ |
| `src/parts/30-rhythm-play.jsx` `RhythmHudCombo` | コンボの数だけ直接書く。React が描き直すのは、出す・出さない・段・FC/AM の印が変わったときだけ |

## 前と後(いちばん密な10秒・CPU4倍・押す。スタイル=見た目の計算 ms/秒)

| 曲・描き方 | 直す前 | 直したあと |
|---|---|---|
| Rebellion MASTER・WebGL(2回) | 52 / 57 | 64 / 51 |
| Rebellion MASTER・2D(2回) | 68 / 63 | 69 / 62 |
| ワルキューレ MASTER・WebGL | 74 | 62 |
| Dear Santa MASTER・WebGL | 62 | 67 |

**この環境では差は見えなかった**(同じ版の1回目と2回目のぶれの中)。33ms を超えたコマの数も同じ幅。この環境は GPU が無く、1コマの時間は CPU で絵を描く時間でほぼ決まるので、iPhone での効きはここでは確かめられない。

## 見た目の確かめ

- 撮り比べ(`tools/browser/visual-compare-check.js`・34画面・104枚): **違い 0 画面**
- 判定の文字・コンボ・押したときの光が出ている所(ワルキューレ HELL の鑑賞・判定とコンボを入・縦): `compare-131000.png`・`compare-152000.png`(左 直す前・右 直したあと)。撮れた瞬間が1コマ前後ずれるので光の出方は違うが、文字・コンボ・印・光の見た目は同じ

## 測り方

- `node tools/playbot/rhythm-song-jank-scan.js --song rebellion --diff MASTER --cpu 4 --dense 10000 --draw webgl`(`--inval 1` で書き換えの上位、`--bot 0` で押さない、`--set '{"judgmentTextDisplay":false}'` で設定の一部を変える、`--root <版>` で直す前)
- 撮る: `node tools/mode/rhythm-listen-play-check.js --song walkure --diff HELL --from 120000 --shot 131000 --portrait --hud-on --out <png>`
