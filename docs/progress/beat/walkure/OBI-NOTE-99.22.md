# 帯の中 99.22s のノーツ特定（ワルキューレ原曲 HELL）

公式測定（variant 0＋phrases ground,L,ground,R＋settleLevelSwitches）で残った「帯の中」1件の特定情報です。直し方は社長決定（r1119-095）: その1ノーツだけを step6 の前例どおり1ノーツ1か所直す。

## 違反の内容（公式測定の出力より）

「押さえている帯の中（同じ高さで重なる・幅1が絡む半レーン）に別のノーツ（置かない）1件: 99.22（半レーン（幅1が絡む））← 書いたあと rhythm-chart-hand-rules-check.js が NG にする」

## 該当ノーツ（authoring: tools/mode/authoring/walkure-v3-chart-hell.json）

- **置かれている側（帯）**: notes[301] HOLD、grid 1426（99.084s）〜 grid 1442（100.195s）、lane 3、subLane 7、subLaneWidth 4、durationGrids 16
- **中に置かれたノーツ**: notes[302] SLIDE、grid 1428（**99.223s**）、lane 3、subLaneWidth 2、durationGrids 16
  - この SLIDE の開始が、上記 HOLD を押さえている最中（帯の時間範囲・同じ lane 3 の範囲内）に重なっているのが違反の実体です。
  - 時刻の換算: BPM 216.03・beatZero 70ms・subdivisionsPerBeat 4（grid 1428 = 357.0 拍 = 99.223s）。

## 何を直せば外れるか

- notes[302] の SLIDE が HOLD（notes[301]）の範囲（時間 grid 1426〜1442 × lane 3 の subLane 7・幅4の帯）と重ならないようにするのが条件です。
- step6 の前例（1ノーツ1フィールドのみ変更: subLane ±1 が5件、subLaneWidth の変更が1件）に倣うなら、この SLIDE の subLane／lane 系の1フィールドをずらして帯の外に出す形が最小の直しになります。具体的にどの値にするかは、書いたあとの hand-rules-check が通ることを確認しながら決めてください。

## 備考

- ショート版（walkure-short-v3-chart-hell.json）の同地点（99.22s）には同種の重なりはありません（その時刻を覆う HOLD は lane 0 で、中に始まるノーツはありません）。
- この特定は authoring の候補譜面（chartRevision 40）に対するものです。公式 mix の出力譜面でも、99.22s・lane 3 の SLIDE が同じ重なりを作っていました（公式測定ログ参照）。
