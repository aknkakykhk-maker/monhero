# 引き継ぎメモ: 開発部 ④育成の型(2026-11-20 その5・r1119-033 の続き)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → `node tools/ctx.js decisions dev` → このメモ、の順に読んで始める。
前のメモ `dev-monsuc-4-2026-11-20c.md`・`-20d.md` の「道具のこつ」はそのまま使える。

## 済んだ物(マージ済み・本番)

- **#6988** 育-01〜05・07・08・20・23・30・31・42・49・53・66・74・84〜87・96・99・102・106・224(止め絵と突き合わせ表: `docs/progress/monsuc4-ikusei-e/`)

## 残り(表の「| 高 | 未 |」「| 中 | 未 |」で引く)

- 高の残りは、ほとんどが見せ場(観点11)の作り直し: 16・24・25・27(トレーニングの結果の見せ場・忠誠の増減)/ 32・34(ほめる・叱るの主役と見せ場)/
  59(月替わりの「先月の成果」)/ 69・75(修行の能力の上がる瞬間)/ 97(忠誠・甘え・方針の説明)/ 100(イベントの体力の変化の見せ場)/ 120(章の終わりの6能力の伸び)/ 06・21・51
- **見せ場の物は演出の設計が要る**(結果の場面を1枚足す・数字を数え上げる・順に光らせる、を共通の型にするか)。窓口へ判断を頼んでから作る
- 120 は章の始めの6能力を `run.ki` に足す必要がある(保存の値に項目を足す → gate が「要る」になるかもしれない)
- 24・97: 芯の addLoyal は甘え・恐れを下げないのに、帯に「忠誠 −2」が出ると API が言う。どこの数字かをまず確かめる

## 決めたこと・気をつけること

- 月替わりの画面は 1.5秒で自動で次へ(MsxAutoNext)。止め絵を撮る道具(navigator.webdriver)では動かさない
- 詳細の窓の「適性」タブは、升目に適性の見出しがあるときは出さない(撮影の場面 HB3・S1A・X6 は手順を替えた)
- run-checks を2本同時に回すと出力が混ざり、無関係な NG がたくさん出る。`pkill -f run-checks.js` は自分の殻も止めるので使わない
- 前から落ちている検査: assistant-check(HOMEの吹き出し 3件)・home-screen-guide-check・rotation-height-check(56-monhero-success-manual.jsx:296 の窓)・success-layout-check の DX1/DX7/S2P/S2B/MA1/MA2

## 道具のこつ(追加)

- この環境は `cd tools && npm ci --omit=optional` のあと、playwright を `ln -sfn /opt/node-tools/node_modules/playwright tools/node_modules/playwright`(playwright-core も)でつなぐ
- visual-api-monsuc.js は、sharp が無いと参考の絵を convert で縮める(5MB を超える参考の絵が入り口に断られていた)
- API で使った額: この会話で $1.66($0.83・$0.32・$0.30・$0.21)
