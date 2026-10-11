# モンヒロビート 発熱の手当て 引き継ぎメモ(2026-10-12・ドライバー → 次の人)

窓口: session_014GTmSNS2ae9tRr57k3zFjC。会話が長くなったので交代。進み具合の表は [`RHYTHM_HEAT_BREAKDOWN.md`](RHYTHM_HEAT_BREAKDOWN.md) の「発熱の手当ての進み具合」。

## ここまでに本番へ入ったもの

| PR | 中身 |
| --- | --- |
| #2752 | 演奏前の準備を既定に(幕のあいだに、道の大きさを測る・canvas を1回描く・判定の文字を温める)。stats.frame に startOver50・startMax・prep* |
| #2765 | ノーツを WebGL で描くときは、GPU の帯・区切りの線・板を既定に。stats.frame に early/late(熱の物差し)・drawMode・gpuPref・fallback |
| #2793 | ① 叩いた光を 2D でも canvas 版に(社長が静止画を見て既定に)。更新履歴「演奏が軽くなり、端末が熱くなりにくくなりました」 |
| #2798 | ② 判定ごとの表示の部品は、要る値が変わったときだけ描き直す(useRhythmHudPick) |
| #2802 | ③ 曲の準備中・演奏中は、隠れているアプリの外側の背景の絵(季節の SVG)を描かない(`:root[data-mh-song-active]`) |
| #2803 | ④ その1: 叩いた光の粒を、焼いた丸を貼る形で描く切り替え(**既定は今の形**・社長の判断待ち) |

## 社長の判断待ち(窓口がまとめて聞く)

- **叩いた光の粒を「焼いた丸」にしてよいか**(#2803)。静止画 `docs/perf/hitcmp/2026-10-12-spark-*.jpg`(左 今の形・右 焼いた丸)。
  差は粒のふちだけ(平均 0.02/255 以下・差の大きい画素は最大14)。光の重さは約2割減(12.5→9.8ms/秒)。
  「既定にする」になったら、`rhythmHitSparkActive` を `rhythmHitSparkPreference()!=='off'` に変えるだけ(1か所)

## 次の候補

1. **ノーツの板(drawHead)**: GPU の描き方でも 10〜11ms/秒(FREEDOM DiVE↓・60〜70秒・CPU1倍)。測りかけの内訳(1秒あたり):
   GL2D の描画の issue 9.1・applyState 3.8・bufferData 3.3・flushPending 2.6・draw3Slice(光の絵の貼り付け)1.8・releaseForeign 0.9・restoreMain 0.8。
   ノーツ1つごとに「光の絵(GL2D)→ 板(板のシェーダー)→ 矢印(GL2D)」と描き方が切り替わり、そのたびに GL2D の状態の送り直し(resetSent)が起きている。
   案: 板のシェーダーで光の絵(3分割)も一緒に描く(四角を光の外まで広げ、テクスチャを1枚渡す)→ 切り替えが無くなる。描く順は今と同じにできる。見た目は画素で突き合わせ(rhythm-gpu-band-check)
2. **HELL**: オンプくん(session_01KxMEiw3EwFDLvXkiHxkA4S)が今の 2D と gpu の表・描き物ごとの内訳を測っている(docs/playbot/reports/2026-10-11/hell-perf/)。
   2D では HELL は MASTER と同じか軽かった。空中の赤い箱(drawSkyTap)・星は今の HELL では使われていない(空中のノーツは板と同じ作り)。
   空中のスライドの白いふち(案Z)の GPU の描き始めが 2D と十数画素ずれる件は、HELL 公開前にテンポくんと直す(drawSlideGpu の skyZOn)
3. 判定の文字・コンボの GPU 化: 文字が変わるたびのレイアウトは残っている(塗り直しの理由の記録で「Layout | Style changed | 判定の文字」が6秒で 260〜420回)。
   ただし1コマあたりのゲームの JS はもう 2〜3ms(この入れ物の CPU1倍)で、**ここから先は1つずつの効き目が小さくなる**。実機の stats.frame(early/late・startOver50)が数日たまってから、効きの大きい所を選ぶのがよい

## 測り方(道具)

- 重さの表: `node tools/playbot/rhythm-perf-bench.js --songs sheriruth:MASTER,freedom_dive:MASTER --cpu 1,4 --draw gpu --roots main=<main の worktree>,new=.`
- 関数ごとの時間: `node tools/playbot/rhythm-frame-perf.js --song freedom_dive --diff MASTER --entry debug --from 60000 --to 70000 --draw webgl --band gpu --funcs a,b,c`(1回ずつは揺れるので main と交互に2回)
- 内訳: `runOnce({..., breakdown: true, funcs, atStart, atEnd, keepTrace, traceCats, storage})`(`tools/playbot/lib/rhythm-perf-run.js`)。
  塗り直しの理由は traceCats に `disabled-by-default-devtools.timeline.invalidationTracking`、層ごとの塗り直しは CDP の `LayerTree.layerPainted`
- 光の見比べ: DOM 版・canvas 版を同じ叩き方・経過時間で撮る(`rhythmSpawnHitEffect` を `defer:true` で呼び、返る印1つを `rhythmRestartAnimations([印])` へ。hitY は判定ラインの**下端**)

## 気をつけること

- **測りの最中に、ほかの検査やビルドを並べて回さない**(CPU を取り合って表が乱れる)
- 測りの道具は、プロファイラ・トレースを始める瞬間にブラウザが止まる。その分は数えない(済み)。曲の頭の長いコマに見えたのはこれだった
- main を取り込むとき、`monster-hero/index.html` は手で足した CSS がある。衝突したら main 側で上書きせず両方残す。`data/changelog.js` も同じ(両方の項目を残す)
- 見た目が少しでも変わるものは、デバッグの切り替え(既定は今のまま)で入れ、静止画と選択肢をそろえて窓口へ
