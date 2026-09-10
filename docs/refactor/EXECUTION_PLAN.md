# 実行の割り当て — どのSTEPを、どのモデルの、どのeffortでやるか

2026-09-08 作成。基盤改善(`REFACTOR_MASTER_PLAN.md` の STEP 0〜10)を、**1本ずつ・別々のチャットで**
進めるための割り当て表。次に何をやるか迷ったら、まずこの表を見る。

## 使い方

1. 下の「次の一手」で、いま取るべき1本を決める
2. その行の**モデル**に切り替える(Claudeアプリの `/model`)
3. **指示文**をそのまま貼る
4. 1本終わったら**チャットを切る**。次はまた新しいチャットで同じことをする

**1本終わったときの報告には、次の一手の「対象・モデル・effort」を必ず書く**
(2026-09-10にユーザーがそう指示した)。読んだ人がそのまま `/model` を切り替えて
次の指示文を貼れる状態にしておくため。この表を開き直さないと分からない書き方にしない。

チャットを切ってよいのは、引き継ぎが会話ではなく `docs/refactor/README.md` の進捗表に
残っているから。**1チャット = 1PR** を守ると、過去のやりとりを担がずに済む。

## モデルの選び方

| モデル | 単価(入力/出力・1Mトークン) | このプロジェクトでの役割 |
| --- | --- | --- |
| Claude Sonnet 5 | $2 / $10 | **手順が決まっている作業**。検査を足す、移動する、表を作る、更新履歴を書く |
| Claude Opus 5 | $5 / $25 | **判断が要る作業**。保存の順序、ランキングに影響する計算、タイマーの仕分け |
| Claude Fable 5.1 | $10 / $50 | 既定では使わない。思考が常時オンで切れず、1リクエストが何分も走る。設計そのものに詰まったときだけ |

新しい世代のモデルは低いeffortでも前の世代の高effortに匹敵するので、
**手順が決まっている作業をFableで回すのが一番もったいない**。

effort は「どれだけ考えるか」。既定は `high`。指示文の中で
「じっくり考えて」「手順どおり淡々と」と書き添えると寄せられる。

## 割り当て

リスク等級は `REFACTOR_MASTER_PLAN.md` の各STEPの「リスク」欄、
S/A 等級は `REGRESSION_RISK_MAP.md` に基づく。

| STEP | 残っていること | リスク | モデル | effort |
| --- | --- | --- | --- | --- |
| 1 安全網 | NG 51本のトリアージ | 低 | Sonnet 5 | medium |
| 2 連結ビルドと集約 | 定数・ユーティリティの集約 | 中 | Sonnet 5 | high |
| 3 保存層 | 複数体合体・寄付・報酬受取の寄せ、キーごとの読込関数 | **高**(S等級に隣接) | **Opus 5** | **max** |
| 4 純関数の切り出し | 難易度から保存処理を出す、jsx側の表の移動 | 中 | Sonnet 5 | high |
| 5 バトル計算 | **完了** | — | — | — |
| 6 画面の切り出し | 下の表のとおり13本 | 中〜高 | 画面による | 画面による |
| 7 描画・キャッシュ | 一覧行の `React.memo`、`style` の定数化 | 低〜中 | Sonnet 5 | high |
| 8 音声管理・SRI | 移動とSRI | 低 | Sonnet 5 | medium |
| 9 音ゲー基盤 | タイミング基盤の整理 | **高**(実機でしか分からない) | **Opus 5** | **max** |
| 10 残存負債 | 残り | 低〜中 | Sonnet 5 | high |

### STEP 6 の内訳(切り出し順)

`MonsterHeroGame`(15697行が丸ごと1関数)を1画面ずつ出す。**この順を変えない**
(依存が少なく検査が厚い順に並べてある)。

| 本 | 対象 | モデル | effort | なぜ |
| --- | --- | --- | --- | --- |
| 1 | `use-screen-effects` hook の設計 | — | — | **完了**(2026-09-10)。`src/parts/40-screen-effects.jsx`。仕分けは `SCREEN_EFFECTS_MAP.md`(画面専用 16 / 進行 31 / 対象外 15) |
| 2 | `SETTINGS` | — | — | **完了**(2026-09-10)。`src/parts/51-screen-settings.jsx`。切り出しの型はこれに合わせる |
| 3 | `MISSIONS` | — | — | **完了**(2026-09-10)。`src/parts/52-screen-missions.jsx` |
| 4 | `GIFT_BOX` | — | — | **完了**(2026-09-10)。`src/parts/53-screen-gift-box.jsx` |
| 5 | `ITEM_INVENTORY` | — | — | **完了**(2026-09-10)。`src/parts/54-screen-item-inventory.jsx` |
| 6〜7 | `BREEDER_MARKET` / `PROFILE` | Sonnet 5 | high | 同上。マーケットは助手の告知に注意 |
| 8 | `MONSTER_DEX(_DETAIL)` | Sonnet 5 | high | 表示のみ |
| 9 | `MASU_*`(育成系) | **Opus 5** | high | 保存が絡む(STEP 3 と同じ領域) |
| 10 | `RHYTHM_*`(演奏画面以外) | Sonnet 5 | high | 演奏画面は STEP 9 の領域なので触らない |
| 11 | `PICK_*` / `WAVE_RESULT` / `REWARD_PICK` / `UPGRADE_SKILL` / `CHAMPION` | **Opus 5** | high | 進行フラグを戻すタイマーが多い。止めると操作不能になる |
| 12 | `HOME` | **Opus 5** | high | 配置検査あり(`home-layout-check`)。助手の吹き出し・施設・初回案内が重なる |
| 13 | `BATTLE` | **Opus 5** | **max** | 最後。`processTurn` に `token.alive` を通す。A等級 |

## 次の一手

**STEP 6 の6本目(`BREEDER_MARKET` 画面の切り出し)** — **Sonnet 5 / effort high**

1〜5本目(`use-screen-effects` / `SETTINGS` / `MISSIONS` / `GIFT_BOX` / `ITEM_INVENTORY`)は
2026-09-10 に完了。切り出しの型は 51〜54 の4本にそろっている(保存を伴う操作は本体に残して
props で受け、共有層の純関数は画面から直接呼ぶ)。

マーケットは**助手の告知(`assistantNotice`)と `boot/market-notice-check` があるので、
そこを壊さないこと**。購入は保存を伴うので本体に残す。
切り出しの型は `src/parts/51-screen-settings.jsx` にそろえる(props は「押されたら何をするか」を
MonsterHeroGame 側に残し、画面へは操作だけを渡す)。タイマーの仕分けは
`SCREEN_EFFECTS_MAP.md` にあるので、画面ごとにそこから引いて `effects.timeout` へ移す。

以降は上の表を上から順に。STEP 3 と 9 は独立して進められるので、
バトルや音ゲーを触りたくない時期は STEP 1・2・4・7 を先に消化してよい。

## 指示文(コピペ用)

### 共通の型

```
docs/refactor/README.md の進捗表と、REFACTOR_MASTER_PLAN.md の STEP <N> を読んで、
<何本目・何をするか> を実装して。

・着手前に REGRESSION_RISK_MAP.md を必ず読むこと
・1本で終わり。次のSTEPには進まないで
・終わったら docs/refactor/README.md の進捗表を更新して、
  CLAUDE.md ③ のとおりマージまで進めて
```

### STEP 6-1(完了。記録として残す) — Opus 5 / max

```
docs/refactor/README.md の進捗表と、REFACTOR_MASTER_PLAN.md の STEP 6 を読んで、
1本目(use-screen-effects hook)を実装して。

・着手前に REGRESSION_RISK_MAP.md を必ず読むこと
・STEP 6 の注意書きどおり、タイマーは「画面専用(止めてよい)」と
  「進行(止めてはいけない)」を宣言する形にする。一律で止めない。
  58箇所の内訳(参照に保存10 / effectで止める8 / 投げっぱなし40)を1本ずつ判断すること
・この本では hook を置くだけ。画面の切り出しは次の本でやる
・終わったら docs/refactor/README.md の進捗表を更新して、
  CLAUDE.md ③ のとおりマージまで進めて
```

### STEP 6-2 以降(画面の切り出し) — 上の内訳表のモデルで

```
docs/refactor/README.md の進捗表と、REFACTOR_MASTER_PLAN.md の STEP 6 を読んで、
<画面名> を src/ui/screens/<画面名>.jsx へ切り出して。

・着手前に REGRESSION_RISK_MAP.md を必ず読むこと
・見た目・文言・遷移先・演出のタイミングは変えない。gameState の文字列も変えない
・setTimeout は SCREEN_EFFECTS_MAP.md でその画面の行を引き、書いてある種別のまま
  effects.timeout(fn, ms, 'screen') / effects.timeout(fn, ms, 'progress') へ移す。
  移したら表の「現状」列を 登録簿 に書き換える(tools/ui/screen-effects-check.js が表を見張っている)
・1画面で終わり。次の画面には進まないで
・終わったら docs/refactor/README.md の進捗表を更新して、
  CLAUDE.md ③ のとおりマージまで進めて
```

### STEP 3(保存層) — Opus 5 / max

```
docs/refactor/README.md の進捗表と、REFACTOR_MASTER_PLAN.md の STEP 3 を読んで、
4本目(複数体合体・寄付・報酬受取を saveStoredValuesOrRollback へ寄せる)を実装して。

・着手前に REGRESSION_RISK_MAP.md を必ず読むこと。ここは S 等級に隣接する領域
・CLAUDE.md ⑦ を最優先。保存キーの名前・意味は変えない。移行処理は二重に走らせない
・既存の 2 本(saveTranscendFruitPair 等)と同じ形にそろえる
・1本で終わり。終わったら進捗表を更新して、CLAUDE.md ③ のとおりマージまで進めて
```

### STEP 1・2・4・7・8・10(手順が決まっているもの) — Sonnet 5

共通の型のとおり。`<N>` と本数を差し替えるだけでよい。
