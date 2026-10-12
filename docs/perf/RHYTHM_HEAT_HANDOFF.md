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

- (2026-10-12 済み・社長の判断で既定に)**叩いた光の粒を「焼いた丸」にしてよいか**(#2803)。静止画 `docs/perf/hitcmp/2026-10-12-spark-*.jpg`(左 今の形・右 焼いた丸)。
  差は粒のふちだけ(平均 0.02/255 以下・差の大きい画素は最大14)。光の重さは約2割減(12.5→9.8ms/秒)。
  「既定にする」になったら、`rhythmHitSparkActive` を `rhythmHitSparkPreference()!=='off'` に変えるだけ(1か所)

## 次の候補

1. **ノーツの板(drawHead)** → 2026-10-12 済み(光の絵を板のシェーダーで描く。drawHead 約35%減)。残りは矢印(フリック)の GL2D への行き来だけ。以下は着手前の控え。: GPU の描き方でも 10〜11ms/秒(FREEDOM DiVE↓・60〜70秒・CPU1倍)。測りかけの内訳(1秒あたり):
   GL2D の描画の issue 9.1・applyState 3.8・bufferData 3.3・flushPending 2.6・draw3Slice(光の絵の貼り付け)1.8・releaseForeign 0.9・restoreMain 0.8。
   ノーツ1つごとに「光の絵(GL2D)→ 板(板のシェーダー)→ 矢印(GL2D)」と描き方が切り替わり、そのたびに GL2D の状態の送り直し(resetSent)が起きている。
   案: 板のシェーダーで光の絵(3分割)も一緒に描く(四角を光の外まで広げ、テクスチャを1枚渡す)→ 切り替えが無くなる。描く順は今と同じにできる。見た目は画素で突き合わせ(rhythm-gpu-band-check)
2. **HELL**: オンプくん(session_01KxMEiw3EwFDLvXkiHxkA4S)が今の 2D と gpu の表・描き物ごとの内訳を測っている(docs/playbot/reports/2026-10-11/hell-perf/)。
   2D では HELL は MASTER と同じか軽かった。空中の赤い箱(drawSkyTap)・星は今の HELL では使われていない(空中のノーツは板と同じ作り)。
   空中のスライドの白いふち(案Z)の GPU の描き始めが 2D と十数画素ずれる件 → 2026-10-12 済み。2D・GPU とも「高さが RHYTHM_SKY_EDGE_FROM(0.042)を越えている時刻の範囲」
   (rhythmSlideSkyEdgeSpans)だけにふちを描く形にそろえた。GPU の見た目は変わらず、2D のふちの端が GPU と同じ所まで伸びる。静止画 docs/perf/skyedge/(左 前・右 後。-zoom は 前・後・GPU の拡大)
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

## HELL の「空中を叩いたときの柱の光」(手ごたえ A)を軽くする件(2026-10-12・ドライバー・取り下げ)

- 試したこと: 柱(上の角だけ丸い四角+縦のグラデーション)を、WebGL のとき GL2D の塗り側で四角1枚で塗る(丸い角を三角形に刻まない)。
  ブランチ `claude/rhythm-lane-pillar-gpu`(マージしていない)。画素の差はふちの1画素だけ(最大 55/255)
- 測った結果(Sheriruth HELL proto・6〜30秒・CPU4倍・draw gpu・runOnce の breakdown・main と順番を入れ替えて):
  - 叩いた光の JS(drawHits の含む時間)は 1コマあたり 1.5〜1.7ms で、入/切・main/新しい版のどれでもほぼ同じ
  - 差はすべて「(program)」(JS の外。この入れ物では GPU の塗りを CPU で真似る分を含む)に出る。main 35.7〜38.6 / 新しい版 41.1〜45.4ms
  - つまり「入」で重くなるのは形を作る計算ではなく、**柱を塗る面積(画素の数)**。塗り側の計算を増やした新しい版は、この入れ物ではかえって重い → 取り下げ
- この入れ物の (program) は本物の GPU の重さとは違う。実機での差は、手ごたえ A を入にした端末の stats.frame(early/late)で見るのが確か

### 実機で入/切を比べる(2026-10-12 社長「実機で測ってから決める」・読むのは窓口)

- 記録が送られるのは**公開曲の HELL**(先行で開く印を入れたとき。`song_id` は `sheriruth` / `grievous_lady`、`difficulty` は `HELL`)だけ。
  試作の枠(`sheriruth_hell_debug` など)は送る曲の一覧(RHYTHM_DEMO_SONG_IDS)に無いので、**試作の枠で遊んだ分は記録に残らない**
- 入/切は `stats.frame.skyHit`(`on` / `off`)に残る(この日のビルドから。それより前の行は空)
- 比べる SELECT(読むだけ):

```sql
select platform, song_id, stats->'frame'->>'draw' as draw, coalesce(stats->'frame'->>'skyHit','(なし)') as sky_hit,
       count(*) as plays,
       round(avg((stats->'frame'->>'avg')::numeric),1) as frame_avg,
       round(avg((stats->'frame'->>'p95')::numeric),1) as frame_p95,
       round(avg((stats->'frame'->>'tickAvg')::numeric),2) as tick_avg,
       round(avg((stats->'frame'->'early'->>'avg')::numeric),1) as early_avg,
       round(avg((stats->'frame'->'late'->>'avg')::numeric),1) as late_avg,
       round(sum((stats->'frame'->>'over34')::numeric)/nullif(sum((stats->'frame'->>'n')::numeric),0)*100,2) as over34_pct
from public.rhythm_touch_diagnostics
where difficulty = 'HELL' and stats ? 'frame' and created_at > '2026-10-12'
group by 1,2,3,4 order by 2,3,4;
```

- 見方: 同じ曲・同じ `draw` の行で、`sky_hit` が `on` と `off` を並べる。
  - `frame_avg`(1コマの平均)と `over34_pct`(33.3ms を超えたコマの割合)が、入で目立って増えていなければ、入にしても重さは気にならない
  - 1回ずつは揺れる(ボットでも ±3ms)。入/切それぞれ **3回以上**そろってから比べる
  - 熱の影響は `late_avg`(2分を過ぎてから)。入/切を続けて遊ぶと後の回ほど熱くなるので、交互に遊ぶのがよい

## 判定の文字の組み直しを入れ物の中だけにする試し(2026-10-12・ドライバー・取り下げ)

- 試したこと: 判定の文字の入れ物(`data-rhythm-judgment-display`)の大きさを演奏の最初に1回測って固定し、CSS の `contain: size layout style` を付ける(デバッグの切り替え・既定は切)
- 分かったこと: 判定の文字(`data-rhythm-judgment-text` の `<b>`)の**高さそのものが演奏中に 26→34px と毎コマ変わる**(Sheriruth MASTER 40〜46秒を 50ms ごとに記録。
  弾む動き `mhRhythmJudgmentPopVivid` は transform だけなので、高さを動かしているのは別の指定。まだ突き止めていない)。
  入れ物の高さを固定すると、文字と FAST/SLOW の位置が数画素ずれる(画素で突き合わせて確認)→ 見た目が変わるので取り下げ
- `rhythmRestartAnimations` はすでにレイアウトを読まない形(名前を交互に切り替える)になっている。判定ごとの組み直しは、文字・高さが変わること自体から来る
- 次に見るなら: 判定の文字の高さを毎コマ動かしている指定を突き止める(それが font-size や line-height の動きなら、transform へ置き換えると組み直しが消えるが、文字の描かれ方がわずかに変わるので社長の判断が要る)
- この入れ物の1コマの時間は、同じ条件でも 22〜46ms と揺れて比べにならなかった(全体の重さの比べは実機の記録で)

## 判定の文字の大きさを一度で変える切り替え(2026-10-12・ドライバー・既定は今の形)

- 判定の文字の高さを毎コマ動かしていたのは `index.html` の `transition:font-size .12s`(判定ごとに 24〜34px と大きさが違い、変わるたびに 0.12秒かけて大きさを変える。そのあいだ毎コマ組み直し)
- デバッグの切り替え「判定の文字の大きさの変わり方(検証用)」(`mh_rhythm_judgment_snap_v1`)を「一度で」にすると、演奏画面に `data-rhythm-judgment-snap="1"` が付き、その transition だけを止める。弾む動き・色・光は今のまま
- 静止画: `docs/perf/judgsnap/2026-10-12-judgsnap-pop.jpg`(判定の演出あり)・`-nopop.jpg`(なし)。GREAT→MARVELOUS に変わって 0・40・80・120ms の4段、左が今の形・右が一度で。120ms では画素まで同じ
- 既定にするかは社長が静止画を見て決める。重さの効き目は実機の記録(10/14 の比べ)で

- 2026-10-12: 手ごたえ A(空中の柱の光)の既定を**入**にした(社長が実機で入/切を試して「重くならなかった」。試作の枠は記録が送られないので SELECT は 0 行だった)。**HELL の公開後に、上の SELECT で入/切(`stats.frame.skyHit`)を比べて見直す**
- 2026-10-12 夜: 空中の柱の光に「奥まで」(既定)を足した。空中の線から空中のレーンの奥まで、レーンの形に沿った台形で伸ばす(まっすぐ上だと左右のはしで道の外へ出た)。あわせて空中の押さえの光の手前の部分を空中の段の壁の内側へ収めた(社長「光の位置ってこれあってる?」)。静止画と重さ: `docs/playbot/shots/2026-10-12-sky-hit-far/`
