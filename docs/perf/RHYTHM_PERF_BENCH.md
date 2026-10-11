# モンヒロビートの重さを機械で測る(ボットの重さ表)

2026-10-11 ドライバー(修理部)。社長「実機確認はこっちにやらせないでそっちで出来るようにして」「botで本当の重さ、軽さを測れる仕組みを作って」。

## 使い方

```
node tools/build.js                                   (先に)
node tools/playbot/rhythm-perf-bench.js               既定の4曲(Sheriruth・FREEDOM DiVE↓・Journey・ANIMA の MASTER)× CPU 1/4/6倍 × 今の2D/GPUの帯
node tools/playbot/rhythm-perf-bench.js --songs sheriruth:MASTER --cpu 1,4 --draw canvas,gpu --out docs/perf/bench/xxx.md
node tools/playbot/rhythm-perf-bench.js --roots main=<前の版の worktree>,new=.   版どうしを比べる
node tools/playbot/rhythm-perf-bench.js --songs sheriruth_hell_debug:HELL:proto --roots hell=<HELL のブランチの worktree>
```

- 1回 = ブラウザを新しく開き、ボットが曲を最後まで演奏する(曲えらびの入り口は `select`、デバッグの曲の一覧は `debug`、試作の枠は `proto`)。1曲あたり3〜4分
- 本物の Supabase へは1件も送らない(偽の Supabase。プレイの記録・タッチの診断は「断られた」扱い)
- 1回ぶんを測る部品は `tools/playbot/lib/rhythm-perf-run.js`。テンポくんの「最初のノーツの重さ」の調べにも使える(`runOnce({song,diff,entry,draw,cpu,from,to})`)

## 表の列

| 列 | 中身 |
| --- | --- |
| 1コマ 平均/95%/99%/最長 | requestAnimationFrame の間隔(ms) |
| 16.7超・33.3超 | 60コマ/秒・30コマ/秒に間に合わなかったコマの割合(タイマーの揺れで数えないよう1msの余裕) |
| メインのCPU | 演奏画面のメインスレッドが CPU を本当に使った時間(1コマあたり。トレースの tdur)。ボットの分を含む |
| 待ちを含む | 同じく、GPU などを待っていた時間を含む(dur) |
| うちJS | JS の時間(Performance.getMetrics の ScriptDuration) |
| 押して処理 | 演奏エリアの pointerdown から、判定の処理が終わるまで(平均/95%) |
| 次のコマまで | pointerdown から、次のコマが始まるまで(95%)。画面に結果が出るまでの目安 |
| 最初のタップ | 曲の最初のタップの「処理/次のコマまで」 |

## この入れ物で測るときに知っておくこと

- **本物の GPU が無い。** Chromium は GPU の仕事を SwiftShader(CPU で GPU を真似る)でする(表の頭の「GPU:」に出る)。
  そのため WebGL の描き方(GPU の帯)では、1コマの時間と「待ちを含む」が SwiftShader の遅さで大きく出る。
  **描き方どうしの比べは「メインのCPU」を主に見る。**1コマの時間は、2D どうし・GPU どうしの比べ(版の前後)にだけ使う
- **Chromium の 2D canvas と iPhone の Safari の 2D canvas は作りが違う**(Safari は GPU で描く)。2D と GPU の帯の「どちらが iPhone で軽いか」は、
  この表だけでは決めない。下の「実機との合わせ込み」の数字で決める
- CPU の絞り(4倍・6倍)はメインスレッドだけに効く(GPU の仕事は絞られない)
- 同じ条件の揺れ: 1コマの平均で ±3ms ほど(2D・CPU1倍)。差を言うときは `--repeat 2` 以上で

## 実機との合わせ込み(案。社長の確認待ち)

演奏画面は、1曲ごとにタッチの診断を `rhythm_touch_diagnostics` へ1行送っている(`stats` は jsonb・4KBまで。いまは約1KB)。
**表・SQL・ランキングは変えず**、`stats` に次の `frame` を**足すだけ**にする(約200バイト)。ボットからは送らない(偽の Supabase)。

```
stats.frame = {
  n, avg, p95, max,            // 演奏中の1コマの間隔(ms)。RHYTHM_PERF の計測ON/OFFに関係なく、数を足すだけで数える
  over17, over34, over50,      // 16.7 / 33.3 / 50ms を超えたコマの数
  tickAvg, tickP95,            // ゲームの1コマの JS の時間(ms。performance.now の差)
  draw,                        // 'canvas' | 'webgl' | 'gpu' | 'dom'(そのときの描き方)
  gpu,                         // WebGL の描き手の名前(iPhone は 'Apple GPU')。取れなければ ''
  dpr, w, h,                   // 画面の倍率・演奏エリアの大きさ
  cores,                       // navigator.hardwareConcurrency
  effect,                      // 演出量(NORMAL / LOW / MINIMAL)
}
```

- 端末の種類は、いまの `platform`(ios / android / other)と `app_build` で足りる(機種名は Safari では取れない)
- これで「同じ曲・同じ描き方の `tickAvg`(実機)」と「ボットの メインのCPU(1倍)」の比から、**CPU を何倍に絞ると社長の iPhone 相当か**を決める
- 読むのは窓口経由(部署は Supabase に触らない)。読みたい SELECT は、入れたあとに窓口へ送る

```sql
-- 例: 曲・描き方ごとの実機の重さ(入れたあと)
select platform, song_id, difficulty, stats->'frame'->>'draw' as draw,
       count(*) as plays,
       percentile_cont(0.5) within group (order by (stats->'frame'->>'avg')::float) as frame_avg_median,
       percentile_cont(0.5) within group (order by (stats->'frame'->>'tickAvg')::float) as tick_avg_median,
       sum((stats->'frame'->>'over34')::int)::float / nullif(sum((stats->'frame'->>'n')::int),0) as over34_rate
from public.rhythm_touch_diagnostics
where stats ? 'frame' and created_at > now() - interval '14 days'
group by 1,2,3,4 order by plays desc limit 50;
```

## 最初の結果(2026-10-11・曲の最後まで・横 844x390・GPU は SwiftShader)

| 曲 | 描き方 | CPU | 1コマ 平均 | 33.3超 | メインのCPU(1コマ) | 押して処理 95% | MISS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sheriruth MASTER | 今の2D | 1倍 | 17.2 | 0.3% | 6.6 | 8.0 | 0 |
| Sheriruth MASTER | 今の2D | 4倍 | 59.0 | 55.8% | 56.5 | 43.6 | 7 |
| Sheriruth MASTER | GPUの帯 | 1倍 | 36.6 | 28.4% | 8.4 | 6.0 | 0 |
| Sheriruth MASTER | GPUの帯 | 4倍 | 101.6 | 95.1% | 87.5 | 31.5 | 21 |
| FREEDOM DiVE↓ MASTER | 今の2D | 1倍 | 17.6 | 0.3% | 7.2 | 10.9 | 0 |
| FREEDOM DiVE↓ MASTER | 今の2D | 4倍 | 84.9 | 60.8% | 80.8 | 75.0 | 83 |
| FREEDOM DiVE↓ MASTER | GPUの帯 | 1倍 | 33.4 | 21.5% | 7.4 | 5.6 | 0 |
| FREEDOM DiVE↓ MASTER | GPUの帯 | 4倍 | 89.0 | 87.0% | 75.9 | 31.2 | 40 |

- この Chromium では、GPU の帯のほうがメインの CPU も 1〜3割多い(WebGL の命令を作って送る分)。iPhone の Safari で同じかは、実機の数字(上の案)で確かめる
- CPU 4倍に絞ると、どちらも 30コマ/秒を保てない。4倍が iPhone 相当かどうかも、実機の数字で決める
