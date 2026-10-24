# MFバトルカード 進捗メモ(カード部 デッキくん)

社長のOK(台帳 #3420)で実装を始めた。作る順は「コンピューター戦とスターター → デッキ編成とパック・マーケット → 公開 → 対人戦」。
設計の正本は [`docs/spec/CARD_BATTLE.md`](../spec/CARD_BATTLE.md)、元のルールは [`docs/spec/card-battle/RULES_SOURCE.md`](../spec/card-battle/RULES_SOURCE.md)。

## 区切り1: コンピューター戦とスターター(2026-10-24 11:39 時点)

**入口はデバッグ設定の「⚔️ バトル」の中の「🃏 MFバトルカード」だけ**(HOME の入口は公開の区切りまで出さない)。
デバッグ専用のあいだは更新履歴・ヘルプに載せない(CLAUDE.md ⑤)。

### できたもの

| もの | 置き場所 | 中身 |
| --- | --- | --- |
| カードの表 | `monster-hero/data/card-battle-cards.js`(67KB・起動時に読む) | `tools/card/card-data-build.js` が `tools/art-sources/card-battle/*/cards.json` から作る。技 322 枚(使える 238)・モンスター 69 枚・スターター 3 つ。文を効果の部品にできなかったカードは「準備中」(`--list-missing` で一覧) |
| カードの絵 | `monster-hero/images/card-battle/{s,l}/`(392 枚 × 2・約 28MB) | `tools/card/card-image-build.js --build`(© を消して縮める)。起動時にも事前ダウンロード(`asset-manifest.json`)にも入れない |
| ルールの本体 | `src/parts/82-card-battle-core.jsx`(pure) | 始める・できる操作・操作を進める・守り・勝ち負け・コンピューターの考え方(くせ×難易度)・助手のデッキ・保存の正規化・カードポイントの計算 |
| 助手のひとこと | `src/parts/83-card-battle-lines.jsx`(pure) | 6人 × 14場面(挑戦の一言を足して 42 通り/人)。場面の選び方 `cardLineSceneOf` |
| 画面 | `src/parts/84-screen-card-battle.jsx` | `CARD_TOP`(スターター選び・トップ・相手えらび・結果)/ `CARD_BATTLE`(対戦) |
| 本体のつなぎ | `60-app.jsx` | デバッグ設定の1行・表示の1行・BGM(`cardBgm`。対戦は相手の助手の曲、それ以外は HOME の曲) |
| 保存 | 新しいキー7つ(`SAVE_DATA.md` に追記) | `mh_card_collection_v1` / `decks_v1` / `point_v1` / `starter_v1` / `daily_v1` / `record_v1` / `cpu_unlocked_v1` |
| 検査 | `tools/card/card-rules-check.js` | 決まりごとの場面・保存の正規化・助手のデッキ・カードの表と絵・CPU どうし 300 戦 |
| 検査 | `tools/card/card-battle-browser-check.js` | 入口 → スターター → 相手えらび → 対戦 → 長押し・捨て札 → 投了 → 結果。既存のキーを書き換えていないか。`CARD_SHOT_DIR=` で写真 |

### コンピューターの強さ(CPU どうしの試算。`card-rules-check.js` と同じ式)

- 難易度の段: 隣の難易度に 6〜7 割で勝ち越し、MASTER は EASY に 96%。
- 助手どうし(相手はスターター・同じ難易度の考え方): NORMAL・HARD は 44〜53% にそろった(`CARD_AI_TUNE`)。
  EXPERT・MASTER は、みゅあ・ももすけが 30〜35% と弱め(組み直したデッキの差)。**次の区切りで詰める。**

### 公開の条件(カゲあつくんの確認・2026-10-24)

- **EXPERT・MASTER で、どの助手もほかの助手と同じくらいの強さにする。** いまはみゅあ・ももすけが 28〜37% と弱い。
  もらえるカードポイントは難易度で決まるので、弱い子が稼ぎ場になる。MASTER は「雑な手」が 0 なので `CARD_AI_TUNE` では直らない
  (元のキットのままにする案も試したが、MASTER のももすけは 28% のままだった)。デッキの組み方か考え方の先読みで直す。
- トップの「つぎの区切りで作ります」は、公開のときに「準備中」にする(まだ作っていない入口が残る場合)。

### まだのもの(区切り1の残り・次の区切り)

- 対戦の演出: ダメージの数字・光る・KO の暗転だけ。技ごとの動き(5-4)・倒れる動きは、まだ。
- モンヒロにいない種族の絵(ディノ・ガリ・ナーガ・ドラゴン・ヘンガー)は、カードの絵で代えている。`monster-add` の手順で配信用にしてから差し替える。
- 英語版の 37 枚(全モンスター・ブリーダー)の絵の文字の日本語化(2-5)。いまは英語のままの絵を出す(詳しい画面の文は日本語)。
- 裏でクイック∞周回とのつなぎ(5-3)・横画面(`landscape-screens-check.js`)・BGM の設定画面(`mh_card_bgm_v1`)・演出の設定(`mh_card_settings_v1`)は公開の区切りで入れる(いまはデバッグからしか入れず、周回中に入る道がない)。
- 守れるカードが無いときの自動パス(`mh_card_settings_v1`)。
- 区切り2: デッキ編成・パック・マーケットの「カードポイント」欄・図鑑・ルール。

### 区切り1の画面の写真(390×844・`card-battle-browser-check.js` で撮った)

自分はパワフルチーム、相手はももすけ(ミラクルチーム)。**ナーガ・ガリはまだカードの絵で代えている(立ち絵は次の区切りで入る)。**

| | |
| --- | --- |
| スターター選び ![](card-battle/step1-01-starter.jpg) | トップ ![](card-battle/step1-02-top.jpg) |
| 相手えらび ![](card-battle/step1-03-foe.jpg) | 対戦の始まり ![](card-battle/step1-04-battle-start.jpg) |
| 長押しの詳しい画面 ![](card-battle/step1-05-detail.jpg) | 狙う相手を選ぶ ![](card-battle/step1-06-target.jpg) |
| 守りの番 ![](card-battle/step1-07-guard.jpg) | 捨て札の一覧 ![](card-battle/step1-08-discard.jpg) |
| 結果(投了) ![](card-battle/step1-09-result.jpg) | |

### 対戦の画面の配置を直した(社長 2026-10-24「上によりすぎ。上下をもっと分けて、真ん中をアクションやログに」)

- 相手の場を上、自分の場を手札のすぐ上に置き、そのあいだを **まんなかの場所(`data-card-stage`)** にした。使った技のカードと名前(アクション)と、起きたことの新しい3行(ログ)をここに出す。**次の区切りの技ごとの動きも、この場所で見せる。**
- 背の低い画面(高さ 760 未満。iPhone SE)では、モンスターの絵・手札・帯を少し小さくし、ログは新しい1〜2行にする。
- `card-battle-browser-check.js` の ⑨ で、相手の場・まんなか・自分の場・手札・ボタンが上から順に並んで重ならないかを測る(`CARD_VIEWPORT=375x667` で SE)。

| | iPhone 13(390×844) | iPhone SE(375×667) |
| --- | --- | --- |
| 対戦の始まり | ![](card-battle/layout2-13-04-battle-start.jpg) | ![](card-battle/layout2-se-04-battle-start.jpg) |
| 攻撃の途中(狙う相手を選ぶ) | ![](card-battle/layout2-13-06-target.jpg) | ![](card-battle/layout2-se-06-target.jpg) |
| 守りの番 | ![](card-battle/layout2-13-07-guard.jpg) | ![](card-battle/layout2-se-07-guard.jpg) |
