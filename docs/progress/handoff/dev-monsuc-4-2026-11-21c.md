# 引き継ぎメモ: 開発部 ④育成の型(2026-11-21 その3・r1119-069 の続き)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → `node tools/ctx.js decisions dev` → このメモ、の順に読んで始める。
前のメモ `dev-monsuc-4-2026-11-21b.md` の「決めごと・気をつけること」もそのまま使える。

## 済んだ物

- **#7079(マージ済み)** 育-193・160・206・210・214・220・204・163・166・161・241・242・243・233・237・T1。217 は直さない・130 は見送り。`docs/progress/monsuc4-ikusei-i/`
- **#7083(マージしていない・窓口の OK 待ち)** 編成の顔の列を1つのボタン → 「編成の7体」の窓(育-136・162・164・176・182・203・218・229)。止め絵 `docs/progress/monsuc4-party-sheet/`

## 残り

- 表 `docs/progress/kensa/monsuc-recheck-2026-11-20/findings-ikusei.md` の「| 中 | 未 |」約43件
- 次に手を付けやすい中: 234(カードの下の「🛡️+4%」を字の名前つき・1つずつ折れないように → 前から落ちている S2P/S2B/S2F の折れも消える。`msxTpBonusText`)・
  236・239(「同じ種類」「育てる種」の札が顔にかぶる)・238(タブごとにカードの下が違う)・127・158(一覧の名前が種族名・小さい)・139・173(詳細の窓の題をモンスター名に)・148(素質の字の色)
- 高12件の見せ場の演出: シナリオの「6つの拍」の型(r1119-034)ができるまで止める

## 気をつけること

- **run-checks --changed は30分を超える。** `success/success-layout-check.js` が15分で時間切れになるので、
  `--skip-file`(1行に `success/success-layout-check.js`)で外して回し、そのあと単独で `node tools/success/success-layout-check.js` を回す。
  どちらも `run_in_background` で上限を長めにする
- 汎用のクラスにぶつかる: `.msx .up`(浮き数字)・`.msx .tg`(3列の格子)・`.gr`。新しい物は `msx-…` の固有の名前にする
- 新しい環境では `cd tools && npm install` が要る(playwright・babel)
- 前から落ちている検査: みゅあの顔(assistant-face-check)・manual.jsx の回転・更新履歴の並び6か所・success-layout の DX1/DX7/S2P/S2B/S2F/K1・RW の大きい文字。monsuc-arena-check はときどき揺れる(単独で通る)
- main の台帳にぶつかりの印が入っていた(#7083 の取り込みで消した)
- 分析の API はこの会話で使っていない($0)
