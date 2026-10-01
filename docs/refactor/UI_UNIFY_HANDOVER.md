# 画面の統一 引き継ぎメモ(2026-10-01)

ユーザー指示「各画面で同じような作りだけどそうじゃないとか統一性とか管理上の問題とかないか調べて改良して」→
見送った分を聞いたところ「全部」。続けて「平仮名とかなんでこれ平仮名なの？みたいなのも直して(キャラのセリフはOK)」。

次の会話はこのメモを読んでから始める。行番号は 2026-10-01 時点の目安なので、`node tools/ctx.js find|text <語>` で引き直すこと。

## 済んだもの(すべて本番公開済み)

| PR | 中身 |
| --- | --- |
| #1908 / #1981 | マーケットを共通部品にそろえた(商品カード3列・確認の窓・残高帯・どの売り場もタブ) |
| #1984 | 41-screen-ui に `ModalFrame` / `ModalCloseButton` / `QuantityStepper` / `ConfirmSheet` / `MODAL_Z`。本番の `window.confirm` 5か所 → `askConfirm`。絆経験値チケット画面・アイテムの対象選択・編成・バトル系・モンスター一覧メニューの頭を `ScreenHead`(`compact` / `accentStyle` を追加)。z-index のクラスと style の二重書き19か所を整理 |
| #1987 | 「つぎへ/とじる」→「次へ/閉じる」、「pt」「ブリーダーポイント」→「ブリーダーP」 |
| #1989 | ひらがな→漢字の書き分け(名前を決める・決定！・選ぶ・値段・詳しく・並べ替え・絞り込み・難易度選択 など) |

## 残り(ユーザーは「全部」と答えている。この順で進める)

### ② 強化画面のタブの行と「必要ダイヤ/所持ダイヤ」の行
- 強化・超越強化・自動強化のタブ行が3回手書き: `65-screen-masu-enhance.jsx` 96行付近 / `64-screen-masu-transcend-enhance.jsx` 117行付近 / `72-screen-masu-auto-enhance.jsx` 94行付近。
  `role=tab` ではなく `aria-current`。`ScreenTabs` に data 属性の受け渡しを足して寄せる。
  **`data-transcend-enhance-tabs` を残す**(`masu/transcendence-check.js` 516-519 が見ている)。
- 「必要ダイヤ/所持ダイヤ/足りません」の手書き: `62-screen-masu-temple.jsx` 55・128-130 / `61-screen-masu-regen-donation.jsx` 27・68 / `66-screen-masu-fusion.jsx` 313-314。
  `MARKET_CURRENCY_META`(20-market-notices-help.jsx)を通貨の正本にして `CostRow({currency,need,have})` を作る。
  66 の `donationDiamondValue(gold)` の流用は汎用の丸め関数へ。
- 超越強化の「所持 n」「所持している🌈」(64 の 139・222)も呼び名をそろえる。

### ③ バトル系画面の上下の余白(safe-area の二重取り)
- `60-app.jsx` の BATTLE_MENU / BATTLE_SYSTEM_SELECT / BATTLE_MODE_SELECT / EXTREME_DIFFICULTY_SELECT / BATTLE_DIFFICULTY_SELECT / BATTLE_SCORE_RANKING の根が
  `px-4` + `paddingTop:'calc(.35rem + env(safe-area-inset-top))'`。body がすでに safe-area を取っている(41-screen-ui.jsx 冒頭の注意)ので二重。
- 見出しは #1984 で `ScreenHead compact` にした。根を `SCREEN_SHELL_CLASS` にするとノッチ端末の見え方が変わるので、
  **直したら battle-menu-browser-check / battle-mode-card-fit-check / battle-tutorial-v2-check を必ず回し、画面を撮って確かめる**。
- 強化3画面の根の absolute 重ね(64:111・65:92・72:92)は `battle/battle-mode-check.js:742` が style 文字列を固定しているので触らない。

### ④ 残りの窓の枠(手書きのモーダル 約80か所)
- `fixed inset-0` の直書きを `ModalFrame` へ寄せる。safe-area が無い窓が多い(61:78・62:215/223・63:137・67:79・68:436・60-app の 13931/13936/16752/16942/17965/18135/18136/18154/18237/18502/18727 付近)。
- 外側を押すと閉じる/閉じないが割れている。方針は「保存中は閉じない(onClose を渡さない)、それ以外は閉じる」。
- 閉じる系の文言は「閉じる」「キャンセル」の2つに寄せる。「やめる」は口語として自然なので残してよい(ユーザー判断待ちではない、残す方針)。
- 名前変更の窓2つ(60-app 16961・16975 付近)はほぼ同じ作りで、ボタンが44px未満・取りやめが「戻る」・z-index 91000/90000。1つの部品にする。
- **z-index の値そのものは変えない**(battle-mode-check:742 の 30000、enemy-scan-check:140 の 65000、battle-tutorial-check:244/262 の 92000/91000、onboarding-preview-check:143 の 96000、eco-mode-internal-check:55 の 2147483646 などが固定)。
- `mh-button-primary` / `-secondary` に付いた `bg-*` は index.html の詳細度に負けて効いていない。外すか `mh-button-danger` へ。見た目は変わらない。

### ⑤ 文言で残したもの(直さない)
「曲えらび」(画面名として一貫)、「やめる」「はい/いいえ」「わかった！」「あとで」「すべて」「いま」、能力名・難易度名・技名・アイテム名、キャラのセリフ、デバッグ専用の戦闘テスト画面(60-app 15300〜15400 付近・23-rpg-debug)。

## 進め方の注意(この作業で実際に踏んだもの)
- 検査ツールへ表記の置き換えを**一括でかけない**。過去の更新履歴やコードのコメントを目印に探している検査がある
  (`assistant/assistant-update-notice-check.js`・`changelog/dev-entry-check.js` が実際に落ちた)。
- `run-checks.js --changed` はコミット前の変更しか見ない。コミット後に回すときは
  `git reset --soft origin/main` → 回す → `git reset --soft <元のHEAD>`。
- 変更した検査ツールが多いと `--changed` が10分を超える。`run_in_background` で回す。
- `pkill -f "tools/serve.py"` は自分のシェルごと落とすことがある。打たない。
