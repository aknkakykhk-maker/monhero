# 公開中の譜面の作り直し: 1曲で試した結果(2026-11-11・フメン3)

社長の決め(台帳 2026-11-11): 問題のある曲は5難易度まとめて今の道具で作り直す・Grievous Lady と Sheriruth は作り直さず押せない所だけ手で直す・
記録はそのまま・表示の Lv. のずれ7つは数字に寄せる(ヒューマノイド MASTER は除く)・HELL は触らない。

## 書き込み口と作り方(1曲ぶん)

公開中の曲はどれも `rhythm-mode.js` のマーカー(`<曲>-v3-<難易度>-notes`・一部 `-v4-`)に入っているので、新曲と同じパイプラインで書ける。

1. 曲の一覧(`authoring/rhythm-song-registry.json`)を新曲と同じ条件にする: `chartRevision:38`・`flowPlacement:true`・
   `handFinish:{EASY:'smooth',NORMAL:'smooth',HARD:'smooth'}`(EXPERT・MASTER は既定の keep-climax)。`rhythm-held-band-existing.json` の曲の一覧から外す
2. `rhythm-chart-v3-pipeline.js --write --track <曲>`(重い。何曲も並べて回せる)
3. `rhythm-chart-v3-pipeline.js --release --from-authoring --track <曲> --markers <マーカー>`(書き込みだけ・1曲ずつ順に。3秒)
4. 全部のあとで `rhythm-chart-level.js --write`(表示の Lv.)・控え2つを `--update --reason`

道具に足したもの: パイプラインの `--from-authoring`、`handFinish` を難易度ごとに書ける形、`rhythm-chart-flow-fix.js --song … --mode must`(押せない所だけ)。

下の難易度を `smooth` にした理由: 既定(`must`)のままだと FREEDOM DiVE↓ の EASY・NORMAL は交差・届きにくいがむしろ増え(届きにくい 10→17・10→20)、
公開中の譜面へ「全部減らす位置直し」を重ねると跳びが増えた(EASY 0→12・NORMAL 2→30)。`smooth` は跳びも見て減らす。

## FREEDOM DiVE↓(前 → 後。ノーツ/Lv./押せない/帯の中/交差/届きにくい/跳び)

| 難易度 | 前 | 後 |
| --- | --- | --- |
| EASY | 370/15/0/0/1/10/0 | 375/16/0/0/0/0/0 |
| NORMAL | 470/22/0/0/2/10/2 | 474/24/0/0/0/0/1 |
| HARD | 552/26/0/0/1/21/6 | 556/28/0/0/0/1/2 |
| EXPERT | 741/37/1/8/19/48/14 | 732/39/0/0/0/5/9 |
| MASTER | 814/47/2/5/11/45/35 | 804/48/0/0/1/9/19 |

止め絵(下から上へ・1本8小節・右の印 赤=押せない 橙=交差 黄=届きにくい 紫=跳び): `freedom-dive-normal-before/after.png`・`freedom-dive-master-before/after.png`

## Sheriruth MASTER(押せない 4 → 0・ノーツ数・時刻は同じ・Lv. の式 45 のまま)

押せない4件は、2本のスライドが左右を入れ替わる X 字の所(1:46〜1:52 と 2:10)。入れ替わらずに「近づいて離れる」形にした(線の通り道はほぼ同じ・点の数と時刻はそのまま・36点の位置)。
**ただしこの2か所は 2026-10-11 に社長が OK した交差として、検査(`rhythm-overlap-reach-check.js` の INTENDED_CROSSINGS)に名指しで残されている。** 止め絵: `sheriruth-master-before/after.png`
