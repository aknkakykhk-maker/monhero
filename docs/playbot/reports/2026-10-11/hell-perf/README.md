# HELL の重さの確かめ(2026-10-11・オンプくん)

公開の前提(10/11 02:05 の決まり「既存曲の演奏の重さが前より増えていないことを数字で示すまで公開しない」)のため、
HELL を同じ曲の MASTER と並べて bot で最後まで流した。道具: `node tools/playbot/rhythm-perf-bench.js`
(`--songs sheriruth:MASTER:debug,sheriruth_hell_debug:HELL:proto,grievous_lady:MASTER:debug,grievous_lady_hell:MASTER:proto --cpu 1,4 --draw canvas`)。
生の表は [`bench.md`](bench.md)・数字は `bench.json`。描き方は今の2D・横 844×390・この入れ物の GPU は SwiftShader(CPU で GPU を真似る)。

| 譜面 | CPU | 1コマ 平均 | 95% | 33.3ms超 | メインのCPU(1コマ) |
| --- | --- | --- | --- | --- | --- |
| Sheriruth MASTER | 1倍 | 18.2 | 16.8 | 0.4% | 5.0 |
| Sheriruth HELL | 1倍 | 16.7 | 16.8 | 0.0% | 4.6 |
| Sheriruth MASTER | 4倍 | 28.7 | 66.7 | 15.4% | 26.5 |
| Sheriruth HELL | 4倍 | 25.7 | 66.6 | 10.7% | 23.5 |
| Grievous Lady MASTER | 1倍 | 16.8 | 16.8 | 0.0% | 5.2 |
| Grievous Lady HELL | 1倍 | 16.8 | 16.8 | 0.1% | 4.6 |
| Grievous Lady MASTER | 4倍 | 35.5 | 100.0 | 21.9% | 33.3 |
| Grievous Lady HELL | 4倍 | 26.6 | 66.6 | 12.6% | 23.6 |

## 分かったこと

- どちらの曲も、HELL のメインの CPU は MASTER と同じか少ない(CPU 4倍で Sheriruth 23.5 対 26.5・Grievous Lady 23.6 対 33.3)。
  空中の箱・影・空中の道を描くぶんで HELL が重くなっている様子は無い。軽くする案はいまは要らない
- 各条件1回の測定(揺れの幅は出ていない)。公開を決める前に、`--repeat 3` で揺れの幅を出し直すとよい
- 演奏はノーツの見た目(案Z・高さの差39%)と流れの速さが MASTER と同じで、HELL のほうがノーツ数が少し多いか同じ
