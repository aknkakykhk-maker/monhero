# モンヒロビート: 帯を GPU に一度だけ置く描き方(案 B)の計画と進み具合

2026-10-11 ドライバー(修理部)。社長「快適性・視認性は命」「何かをなくして軽くするより、根本的なものや仕組みで軽くできるのが理想」。
目標: HELL(空中ノーツ)でも既存曲並みかそれ以下の重さ。既存曲の見た目と判定は変えない。

## ここまで(2026-10-10〜11 に main へ入ったもの)

| PR | 中身 | 数字(ノーツを描く JS・1秒あたり・104〜112秒) |
| --- | --- | --- |
| #2655 | 長いスライドの帯を画面の外まで作らない・点の探し方を二分探索に・「空中があるか」の覚え | Sheriruth MASTER 342 → 110ms |
| #2660 | 点20以上のスライドだけ、帯の刻みを画面上の長さに合わせる(地面8px・空中4px。ずれ最大0.35px) | MASTER 110 → 65ms・HELL 164 → 117ms |
| #2665 | 空中のスライド: 影は空中の帯から作る・描かない区切りの線は作らない・同じ色はまとめて塗る | HELL 110 → 82ms |
| #2666 | 叩くたびの CSS アニメーションの流し直しで全体のスタイル計算を強制しない(V と V--b を交互に) | 流し直し 13 → 0.4ms(CPU 3倍 55〜98 → 1.5ms) |
| #2667 | 重さを測る道具 `tools/playbot/rhythm-frame-perf.js` | — |

比べの相手: FREEDOM DiVE↓ MASTER は 46ms。既存曲の重さは今夜の変更の前後(9eb181d3 と今)で差なし。

## いまの重さの正体

毎コマ CPU で、見えている帯を数百の区切りに刻み、1つずつ奥行きの投影を計算して canvas に塗っている
(`rhythmSlideSegmentQuads` → `drawSlide`)。帯が長い・多いほど重い。デバッグの WebGL の切り替え(`rhythmCreateGL2D`)も、
毎コマ CPU で作った形を GPU に渡しているだけで根は同じ。

## 作り替えの中身

1. **帯・影の形は一度だけ作って GPU に置く。** 頂点は「譜面の座標」で持つ:
   横=レーン(`rhythmSlideExpectedLane` と幅 `rhythmSlideWidthAt` から左右の端のレーン座標)、
   縦=**速さの表で積み重ねた位置 S(t) = `rhythmScrollPos(t)`**(止まり=倍率0・RUSH を含む)、空中の高さ=`rhythmSlideSkyAt`。
   - S(t) は `rhythmScrollSet(changes, travelMs)` と同じ (changes, travelMs) を鍵に覚え、鍵が変わったら(ノーツ速度が違う・途中で変わる)作り直す
     (RUSH の区間の倍率は travelMs から出るため。テンポくんの指摘 2026-10-11)
2. **毎コマ渡すのは数個の値だけ**(uniform): いまの S(`rhythmScrollPos(visualTime)`)・travelMs・spawnY・travelPx・画面の大きさ・
   空中の持ち上げ(`RHYTHM_SKY_LIFT.ratio`)・道の幅の倍率。奥行きの投影(`rhythmProjectTravelProgress`・`rhythmProjectBoundary`)・
   空中の持ち上げ(`rhythmSkyLiftPx`)・影(持ち上げ0)は頂点シェーダーで計算する(今の式をそのまま移す)
3. **描く回数をまとめる**: 地上の帯1回・空中の帯1回・影1回・芯の線1回。ノーツの板・箱・星は絵を1枚にまとめて1回ずつ
   (見た目の設計 案Z v6 の描き物「半透明の帯1枚+加算の芯の線・箱・暗い影・星1種・細い線」はこの形に乗る)
4. **見えない所は GPU が切る**(画面外の区切りを CPU で探さない)

見込み: HELL 82 → 10〜20ms、既存曲 45 → 10〜15ms 前後。

## 段階(既存曲の見た目と判定は変えない)

- **S1 土台**(0.5〜1日): 帯(地上・空中・影)だけを新しい描き方で。デバッグの切り替えで出し入れ。
  既存の全曲を、今の 2D の描き方と画素で突き合わせる検査を作り、差が出ないことを確かめてから。
  突き合わせの曲: 既存の全曲・Sheriruth 全難易度(止まる演出)・試作の枠(`sheriruth_proto`・HELL・`sheriruth_stop_ref`・`sheriruth_stop_ref_trim`=RUSH)
- **S2**(1〜1.5日): ノーツの板・箱・星・叩いたときの光を同じ土台へ
- **S3**(半日): 社長の iPhone で前後を比べてから既定に。WebGL が使えない・途中で GPU が落ちた(context lost)ときは今の 2D へ自動で戻る

判定は描き方と分かれている(`visitNote`・入力)ので触らない。
リスク: iPhone Safari の GPU の文脈が落ちる件、ふちのなめらかさ(アンチエイリアス)のわずかな差(画素の突き合わせで許す幅を決めて社長に見せる)。

## 測り方・確かめ方

- 重さ: `node tools/playbot/rhythm-frame-perf.js --song sheriruth --diff MASTER --entry debug --from 104000 --to 112000`
  (前後の比べは、前の版を `git worktree` に置いて `--root` で交互に。CPU 4倍以上は手元のブラウザが頭打ちになるので関数ごとの時間で見る)
- 既存曲の形の一致: main 版とこの版の `rhythm-mode.js` を node の vm で読み、全曲・全難易度・全ノーツ×速度3通り×位置4通りで
  `rhythmNoteCanvasGeometry` と `rhythmLayoutNoteVisual` を突き合わせた(2026-10-10 の各 PR)。S1 では画素の突き合わせに置き換える
- 帯の曲がりのずれ: 細かく刻んだ帯のふちの各点から、刻みを減らした帯の折れ線までの最短距離(画面の中・余白 8px)

## 次の人へ

- `drawSlide`(rhythm-mode.js の canvas の描き方の中)と `rhythmSlideSegmentQuads` が今の正本。S1 の新しい描き方は、
  この2つと同じ形を出すことを画素で確かめる
- 叩いたときの光などの DOM の流し直しは #2666 で済み。HELL はデバッグ専用のまま(テンポくんのブランチ claude/rhythm-hell)
- 検査 `tools/ranking/profile-frame-browser-check.js` は、今夜の変更より前の main でも落ちる(この作業とは無関係)
