# 覚醒サンタの7つの技の見せ方(r1126-075・2026-11-27)

クリスマスのレイドボス(覚醒サンタ)の技の動きとエフェクトを、ハロウィンのジャックの借り物からサンタらしい物に替えた。
数字・本数(3/4/5/5/5)・当たり方・待ち時間・報酬・ランキングへ送る値は変えていない(見せ方だけ)。

- 撮り方: 実ブラウザでデバッグ画面 → クリスマスのレイド → レイドバトル「黒いサンタ・罰/断罪」(技5本)をオートで戦い、敵の技が出た瞬間を撮った
- 縦 390×844 / 横 844×390。動画は技の0.4秒前から技の長さ＋1秒(音なし)
- 画面には味方の攻撃の数字など、実際の戦闘の物も一緒に写っている

| # | 技 | 動き | エフェクト | 止め絵(縦/横) | 動画(縦/横) |
| --- | --- | --- | --- | --- | --- |
| 1 | 正拳・闇(通常攻撃) | 突く | 雪の結晶の拳が飛び、当たると雪の印 | [縦](1-normal-portrait.jpg) / [横](1-normal-landscape.jpg) | [縦](1-normal-portrait.mp4) / [横](1-normal-landscape.mp4) |
| 2 | 瞬黒撃(必殺技) | 一瞬で横へ踏み込む | 赤黒い十字の斬り跡・黒い輪・雪が降る | [縦](2-special-portrait.jpg) / [横](2-special-landscape.jpg) | [縦](2-special-portrait.mp4) / [横](2-special-landscape.mp4) |
| 3 | 超宝屁(間合い攻撃) | 後ろを向いてお尻を突き出し、ぷぅっと膨らむ | おならの💨が飛び、緑〜紫のガスの雲が味方の列を包む(星と雪が混じる)。前の版(プレゼントが飛ぶ)は `3-sweep-before-*` | [縦](3-sweep-portrait.jpg) / [横](3-sweep-landscape.jpg) | [縦](3-sweep-portrait.mp4) / [横](3-sweep-landscape.mp4) |
| 4 | 超飛び蹴り(連撃) | 跳んで落ちる | 蹴りが3回飛ぶ・赤い衝撃 | [縦](4-rush-portrait.jpg) / [横](4-rush-landscape.jpg) | [縦](4-rush-portrait.mp4) / [横](4-rush-landscape.mp4) |
| 5 | 超暗けい(貫通) | 溜めて突く | 光の柱・黒いハート | [縦](5-pierce-portrait.jpg) / [横](5-pierce-landscape.jpg) | [縦](5-pierce-portrait.mp4) / [横](5-pierce-landscape.mp4) |
| 6 | 怪しこの夜(攻撃力アップ) | 力を解き放つ | 鐘が鳴りながら立ちのぼる | [縦](6-roar-portrait.jpg) / [横](6-roar-landscape.jpg) | [縦](6-roar-portrait.mp4) / [横](6-roar-landscape.mp4) |
| 7 | X’マスプレデター(全体攻撃) | 横へ駆ける | ソリが横切る・黒いプレゼントと雪が散る | [縦](7-allout-portrait.jpg) / [横](7-allout-landscape.jpg) | [縦](7-allout-portrait.mp4) / [横](7-allout-landscape.mp4) |

通し: [8-run-result-portrait.jpg](8-run-result-portrait.jpg)(20ターン使い切り → 結果画面 → デバッグ用の記録へ送信。実行時エラー 0)

超宝屁は r1126-075 追記1(社長「屁をこく感じじゃないの？」)で、おならの見せ方に直した。効果音は手持ちにおならの音が無いので今のまま。

開幕前の点検(r1126-083・OPENING-REVIEW-API.md「最終」)の直し:
- 1番: レイドのお話の赤いサンタ(話し手 `xmas_santa`)の顔を、絵文字 🎅 からレイドの絵(santa-red.png)に → [9-story-santa-face-portrait.jpg](9-story-santa-face-portrait.jpg)
- 11番: 横の低い画面で、敵の技名の札が HP バーと強化の列に重なっていた → その下へ下げた(縦はそのまま) → [10-skill-pill-landscape.jpg](10-skill-pill-landscape.jpg)

## 重さ

CPU を4倍遅くした同じ条件(縦・オート)で、敵の技が出ているあいだのコマを数えた。

| | 平均 | 50ms を超えたコマ |
| --- | --- | --- |
| 覚醒サンタ | 32fps | 66 / 599 |
| ジャック(比べる相手・変えていない) | 27fps | 74 / 441 |

サンタのほうが重くはない。ふつうの速さでは平均 54〜56fps。

## 作り(ほかのバトルに影響を出さない形)

- `71-screen-battle.jsx`: 動きの表を引く名前を `tacticsEnemyMotionKey(enemy)` にまとめ、`enemy.raidXmas` のときだけ `Santa` → `santa` の組み合わせへ分かれる(ぱんぷきんが先・ほかは id のまま)
- 覚醒サンタは id が Jack なのでムーと同じ全画面の演出を通る。サンタのときだけ、降る物(☄️→❄️)・横切る物(🌪️→🛷)・稲妻(⚡→🔔)を替え、瞬黒撃・X’マスプレデターの締めの飾りを足した
- `70-bootstrap.jsx`: サンタの色・枠の大きさ(ジャックと同じ)・雪と黒いプレゼントの粒
- 技の長さは全員共通の表のまま(待ち時間・進行はジャックと同じ)
- 見張り: `tools/battle/raid-xmas-check.js` の「技の見せ方」の6項目
