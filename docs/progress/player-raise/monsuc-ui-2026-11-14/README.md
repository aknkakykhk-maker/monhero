# モンサクの画面の統一(2026-11-14・クラフト17)

決まり: `docs/spec/MONSUC_UI.md`。社長の指摘(`../president-notes-2026-11-14/`)への直し。

- `compare-1.png` 最終の評価・能力ポイント・振り返り(直す前/直した後)
- `compare-2.png` 章の終わり・通院・持ちこみ(直す前/直した後)
- `final-eval-land.png` 最終の評価の横画面(844×390)

撮り方(縦390×844・幅320×568):

```
SHOT_DIR=<フォルダ> node tools/success/success-r3-shoot.js   # r3-E3(能力ポイント)→ r3-E0(最終の評価)→ r3-E1(振り返り)
SHOT_DIR=<フォルダ> node tools/success/success-shoot.js      # msx-KI(章の終わり)・msx-CL(通院の結果)・msx-S4(持ちこみ)
```

直す前の絵は、社長の止め絵と、直す前の main で同じ道具を回した物。
