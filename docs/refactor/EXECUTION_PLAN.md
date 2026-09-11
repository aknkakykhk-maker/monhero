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
| 1 安全網 | **完了**(2026-09-11)。NG 56→1本。残り1本はユーザーの手が要る(下の「次の一手」) | — | — | — |
| 2 連結ビルドと集約 | 定数・ユーティリティの集約 | 中 | Sonnet 5 | high |
| 3 保存層 | 複数体合体・寄付・報酬受取の寄せ、キーごとの読込関数 | **高**(S等級に隣接) | **Opus 5** | **max** |
| 4 純関数の切り出し | 難易度から保存処理を出す、jsx側の表の移動 | 中 | Sonnet 5 | high |
| 5 バトル計算 | **完了** | — | — | — |
| 6 画面の切り出し | **完了**(2026-09-11)。残るのは `BATTLE` の `token.alive` と `MASU_PATTERN_DEBUG` | — | — | — |
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
| 6 | `BREEDER_MARKET` | — | — | **完了**(2026-09-10)。`src/parts/55-screen-breeder-market.jsx` |
| 7 | `PROFILE` | — | — | **完了**(2026-09-10)。`src/parts/56-screen-profile.jsx`。props 38個は undefined-reference-check で洗い出した |
| 8 | `MONSTER_DEX(_DETAIL)` | — | — | **完了**(2026-09-10)。`src/parts/57-screen-monster-dex.jsx`(3画面で1ファイル) |
| 9 | `MASU_*`(育成系) | — | — | **完了**(2026-09-10)。`59` / `61`〜`66` の7ファイルに22画面。`MASU_PATTERN_DEBUG` はデバッグ専用なので残した |
| 10 | `RHYTHM_*`(演奏画面以外) | — | — | **完了**(2026-09-10)。`src/parts/58-screen-rhythm.jsx`(5画面で1ファイル) |
| 11 | `PICK_*`(スキップ含む7画面) | — | — | **完了**(2026-09-11)。`67-screen-pick.jsx`。タイマーはすべてハンドラの中にあり本体へ残った |
| 11b | バトルの結果まわり7画面 | — | — | **完了**(2026-09-11)。`68-screen-run-result.jsx`。ラン終了3つ(勝ち・敗北・リタイア)とマスモン登録も一緒に出した |
| 12 | `HOME` と重なる案内3つ | — | — | **完了**(2026-09-11)。`69-screen-home.jsx`。施設への7つの行き先は props(`onOpen*`)へ |
| 13 | `BATTLE` と演出4つ | — | — | **完了**(2026-09-11)。`71-screen-battle.jsx`。**切り出しだけ**で、`processTurn` の `token.alive` は手を付けていない(下の「次の一手」) |

## 次の一手

**STEP 2 連結ビルドと集約(定数・ユーティリティの寄せ)** — **Sonnet 5 / effort high**

STEP 1(安全網)は**完了**。2026-09-11 のトリアージで落ちていた検査は
**56本 → 12本 → 1本**になった(PR #1273 / #1275 / #1282 / #1286 / #1290 と、このPR)。
内訳と直し方は [`BASELINE_2026-09.md`](BASELINE_2026-09.md) の
「2026-09-11 のトリアージ結果」に1枚でまとまっている。

残っている1本は**Claudeだけでは直せない**。

| 検査 | 中身 | 誰が |
| --- | --- | --- |
| `image/dye-edge-check` | ウンディーネの染色マスク(256×384)が今の立ち絵(1024×1536)の輪郭を覆えていない。染めても元の色の縁が残る | **ユーザー**。デバッグ画面の「染色マスクエディタ」でマスクを引き直し、書き出したPNGを `tools/art-sources/dye-masks/undine-dye-mask.PNG` へ置き換える |

STEP 6(画面の切り出し)も**完了**。やり残しは2つだけで、どちらも急がない。

| やり残し | モデル | effort | なぜ後回しでよいか |
| --- | --- | --- | --- |
| `processTurn` へ `token.alive` を通す | **Opus 5** | **max** | A等級。実機でバトルを回して確かめたい |
| `MASU_PATTERN_DEBUG` の切り出し | Sonnet 5 | medium | デバッグ専用で、プレイヤーの画面に出ない |

**props の洗い出しは手でやらない。** props を空にした仮のコンポーネントへ JSX を移し、
`node tools/undefined-reference-check.js` を通すと、足りない参照が全部一覧で出る。
それをそのまま props にする(PROFILE の 38 個はこの方法で決めた)。

**画面専用に見える `useState` でも、本体に残すほうが正しいことがある。**
その画面を離れて戻ったときに値が保たれているなら、画面へ移すとリセットされて挙動が変わる。
図鑑の絞り込み・選択中・タブ(6個)はこれに当たるので本体に残した。
「画面の中だけの UI 一時 state」を移すのは、**その画面を出れば消えてよい値**に限る。

**タイマーを含む非同期の再生処理も本体に残す。** 画面へ移すと、画面のライフサイクルで
途中の `setTimeout` が止まって演出が固まる。図鑑の攻撃アクション再生がこれ。

検査が落ちたら、まず `harness.js` の `readAppSource()` へ差し替える
(`60-app.jsx` を直接読む検査は、見ている画面が移ると対象を見失う)。
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
