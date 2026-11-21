# 引き継ぎメモ: 開発部 ④育成の型(2026-11-21 その3・r1119-069 の続き)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → `node tools/ctx.js decisions dev` → このメモ、の順に読んで始める。
前のメモ `dev-monsuc-4-2026-11-21b.md` の「決めごと・気をつけること」もそのまま使える。

## 済んだ物

- **#7079(マージ済み)** 育-193・160・206・210・214・220・204・163・166・161・241・242・243・233・237・T1。217 は直さない・130 は見送り。`docs/progress/monsuc4-ikusei-i/`
- **#7083(社長の OK でマージ済み)** 編成の顔の列を1つのボタン → 「編成の7体」の窓(育-136・162・164・176・182・203・218・229)。止め絵 `docs/progress/monsuc4-party-sheet/`
- **#7085(マージ済み)** 育-234(カードの伸びに名前・折れない)・236・239(札を絵の下へ・読める色)・139・173(詳細の窓の題を名前に)・ピーク中の札の字 10px。`docs/progress/monsuc4-ikusei-j/`

## 残り

- 表 `docs/progress/kensa/monsuc-recheck-2026-11-20/findings-ikusei.md` の「| 中 | 未 |」約38件
- 次に手を付けやすい中: 238(タブごとにカードの下が違う)・127・158(一覧の名前が種族名・小さい)・148(素質の字の色)・168・169(メモモンの一覧の札と名前)・135(パートナーの札の親密度の形)
- 高12件の見せ場の演出: シナリオの「6つの拍」の型(r1119-034)ができるまで止める

## 気をつけること

- **run-checks --changed は30分を超える。** `success/success-layout-check.js` が15分で時間切れになるので、
  `--skip-file`(1行に `success/success-layout-check.js`)で外して回し、そのあと単独で `node tools/success/success-layout-check.js` を回す。
  どちらも `run_in_background` で上限を長めにする
- 汎用のクラスにぶつかる: `.msx .up`(浮き数字)・`.msx .tg`(3列の格子)・`.gr`。新しい物は `msx-…` の固有の名前にする
- 新しい環境では `cd tools && npm install` が要る(playwright・babel)
- 前から落ちている検査: みゅあの顔(assistant-face-check)・manual.jsx の回転・更新履歴の並び6か所・success-layout の DX1/DX7/K1。
  monsuc-arena-check の段C(held:false)は 2026-11-21 夕方から main でも落ちる(バトルの持ち場・窓口へ知らせ済み)
- main の台帳にぶつかりの印が入っていた(#7083 の取り込みで消した)
- 分析の API はこの会話で使っていない($0)
