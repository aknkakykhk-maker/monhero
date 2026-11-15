# r1115-055 距離の汁のアイコンを汁ごとに色分け

台帳: 2026-11-15 r1115-055(本番の止め絵 `../juice-icon-orange.png`・`../juice-icon-green.png`)
参考: `docs/reference/line-mf/taikai-entry-2026-11-13/46-item-akajiru.jpg`・`48-item-daidaijiru.jpg`・`50-item-midorijiru.jpg`・`52-item-aijiru.jpg`(見るだけ。形・色は写していない)

| 参考 | 作った物 | 止め絵 |
| --- | --- | --- |
| 汁ごとに中身の色が違う小瓶(赤・橙・緑・藍) | 丸い肩の小瓶・金のねじぶた・しずく印のラベル。中身の色だけ替える(`tools/success/item-icons.js` の `elixir`) | `icons-4.png`(200px・48px・32px) |
| 大会の確認の窓の賞品の升目 | 絵で出す(`msxR3Prizes` → `msxItemIco`) | `r3-J2*.png` |
| 賞品の詳細 | 同じ絵を大きく | `r3-J3*.png` |
| 持ち物(升目・選んだ物・「使う」ボタン) | 同じ絵 | `r3-J1*.png`・`r3-J1b*.png` |
| 結果の獲得物の行・使ったときの演出・出来事でもらったとき | 同じ絵(`msxItemIco`) | — |

`compare.png` は 縦390 の 持ち物 / 確認の窓 / 詳細 と 幅320 の持ち物 を並べた物。
