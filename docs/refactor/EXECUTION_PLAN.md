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
| 1 安全網 | **完了**(2026-09-11)。NG 56→**0本** | — | — | — |
| 2 連結ビルドと集約 | **完了**(2026-09-11)。定数・ユーティリティの集約は parts 分割で達成済みだった | — | — | — |
| 3 保存層 | 残り2つ。①寄付(`executeMasuDonation`・60-app.jsx:5748)の4キーを取引へ ②起動時ロードの424行(TD-18)。報酬受取(ギフト)は完了(2026-09-12)。「複数体合体」は実装が見当たらず、計画当時の想定と思われる | **高**(S等級に隣接) | **Opus 5** | **max** |
| 4 純関数の切り出し | **実質完了**(2026-09-11)。共有層21部品のうち8つが pure。残りは JSX・DOM・保存を本質的に含む | — | — | — |
| 5 バトル計算 | **完了** | — | — | — |
| 6 画面の切り出し | **完了**(2026-09-11)。残るのは `BATTLE` の `token.alive` と `MASU_PATTERN_DEBUG` | — | — | — |
| 7 描画・キャッシュ | 3本目まで完了(染色の2つのキャッシュに上限、Tailwind 静的化の調査)。残りは一覧行の `React.memo`、静的な `style` の定数化 | 低〜中 | Sonnet 5 | high |
| 8 音声管理・SRI | 移動は parts 分割で完了(`14-audio.jsx`)。**SRI はこの環境では付けられない**——ハッシュを取るのに `cdnjs.cloudflare.com` へ出る必要があり、ネットワークポリシーで 403。ネットワークのある環境で `tone/14.8.49/Tone.js` の sha384 を取って `integrity` / `crossOrigin` を付ける | 低 | Sonnet 5 | medium |
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

**再描画を測る道具を作る(`React.memo` に入る前に)** — **Sonnet 5 / effort high**

STEP 1・2・4・5・6 は完了、STEP 3 は5本目まで、STEP 7 は3本目まで完了
(進捗は [`README.md`](README.md))。落ちている検査は0本。

STEP 7 に残っているのは `React.memo` と `style={{…}}` の定数化。
だが **`memo` には先に計測の手立てが要る。**

- `browser/perf-check` は**読み込み時間しか測らない**。再描画コストを測る道具が無い
- `memo` を `MonsterHeroGame` の中で定義すると、再描画のたびに作り直されて**効かない**。
  効かせるには共有層へ切り出して props を渡す形になり、STEP 6 の画面切り出しと同じ作業量になる
- しかも props に毎回新しいオブジェクト(`entry`)や関数を渡していると、切り出しても効かない

つまり「入れたが効かない」「行が更新されなくなる」のどちらにも転びうるのに、
**どちらになったか確かめる手段が無い**。先に作るべきはその手段。

**作るもの**: ランキングを開いた状態で、無関係な再描画を起こしたときに
行のDOMが書き換わるかを `MutationObserver` で数える実ブラウザ検査。
実装を汚さずに測れる(`data-ranking-kind` が既に付いている)。

これがあれば、`memo` を入れる前後で数値を比べられる。
**効果が出ないと分かったら、入れないという判断もできる**(TD-22 は「memo 0個」を
問題として挙げているが、効かないなら複雑さが増えるだけ)。

> **Tailwind の静的化は「切り替えられる」と分かった**(欠けるクラス0件・静的CSS 111KB)。
> 手順と注意は [`TAILWIND_STATIC_REPORT.md`](TAILWIND_STATIC_REPORT.md)。
> 起動のたびのCSS生成が消えるので効果は大きいが、配信物の作り方(生成・キャッシュキー・
> `tailwind.config` の移設)を決める必要があるので、STEP 10 で腰を据えてやるのがよい。

> **STEP 8 の SRI はこの環境ではできない。** `cdnjs.cloudflare.com` へ出られないため。
> ネットワークのある環境での取り方は割り当て表の STEP 8 欄に書いた。

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
