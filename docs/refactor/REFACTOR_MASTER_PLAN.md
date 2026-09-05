# リファクタリング全体計画

調査日: 2026-09-05 / 前提: `TECH_DEBT_AUDIT.md`、`REGRESSION_RISK_MAP.md`、`TARGET_ARCHITECTURE.md`

## 0. 原則

1. **挙動を変えずに構造を直す。** 仕様変更・数値変更・演出変更は別 PR にする。やむを得ず挙動が変わるときは PR 本文と `changelog.js` に明記する。
2. **1 STEP = 1 つの関心 = 数 PR。** 各 PR は単独で検査でき、単独で戻せる。巨大 1 PR は作らない。
3. **どの PR をマージした直後も遊べる。** 途中状態を main に置かない。
4. **セーブ(`mh_*`)・ランキング・音ゲーのタイミング基盤は構造目的で触らない。**(`REGRESSION_RISK_MAP.md` §4)
5. **検査を先に足してから直す。** 落ちる検査を緩めて通さない。
6. **理由が分からない奇妙な処理は消さない。** コメントに iPhone / 互換 / タイミングの理由が残っていることが多い。
7. **文書はコードと同じ PR で更新する。**`CURRENT_ARCHITECTURE.md` は「いま何がどこにあるか」を常に正しく保つ。

## 1. STEP の順番と理由

| STEP | 題名 | 主に解く負債 | 規模(PR 数の目安) | 前提 |
| --- | --- | --- | --- | --- |
| 0 | 文書の同期と未参照物の確認 | TD-19, TD-27 | 1 | なし |
| 1 | 安全網: エラー境界・一括検査・ベースライン固定 | TD-01, TD-12, TD-29 | 2〜3 | なし |
| 2 | ビルドの複数ファイル対応と、定数・保存キー・ユーティリティの集約 | TD-05(準備), TD-16, TD-17, TD-20 | 3〜4 | 1 |
| 3 | 保存層の整理(キーごとの読込・更新関数) | TD-02, TD-14, TD-18 | 5〜8(キーごと) | 1, 2 |
| 4 | ゲームデータと純関数の切り出し(`core/`) | TD-05, TD-15 | 4〜6 | 2 |
| 5 | バトル計算の一本化(ヒット列の純関数・勇者特性表) | TD-06, TD-11 | 3〜4 | 4 |
| 6 | 画面ライフサイクル(タイマー・async トークン)と画面の切り出し | TD-04, TD-07, TD-23 | 8〜15(画面ごと) | 1, 3 |
| 7 | 描画・イベント・キャッシュの整理、CSS 静的化の準備 | TD-10, TD-13, TD-22 | 3〜4 | 6(一部は独立) |
| 8 | 音声管理の移動と SRI | TD-24 | 1〜2 | 2 |
| 9 | 音ゲー基盤の整理(譜面分離・ランタイムパッチの本体吸収・常駐停止) | TD-03, TD-08, TD-09, TD-30 | 4〜6 | 1, 6 |
| 10 | 残存負債(デバッグ分離・assistants 分割・起動時読込の軽量化) | TD-21, TD-26, TD-28 | 3〜5 | 6 |

合計: 11 STEP、およそ 37〜58 PR。順番の考え方:

- 先に**安全網**(1)を張らないと、その後のどの STEP も「壊れたことに気づけない」まま進む。
- **保存層**(3)は最重要リスクだが、キーごとの小さな単位で進められ、他 STEP の土台になるので早い。
- **画面の切り出し**(6)は効果が大きいが PR 数が多い。保存層(3)が済んでいないと、切り出した画面へ `storeSet` の対を大量に渡すことになる。
- **音ゲー**(9)は現在いちばん開発が活発で、動いているタイミング基盤を持つ。ライフサイクルの仕組み(6)ができてから、その上に載せる形で常駐を止める。
- **バトル計算**(5)は数式に触るので、`core/` へ移して vm から直接呼べるようになってから(4)。

## 2. 各 STEP の明細

書式: 目的 / 対象 / 変更内容 / 変更しないもの / 依存関係 / リスク / 検査方法 / 完了条件。

---

### STEP 0: 文書の同期と未参照物の確認

- **目的**: 文書と実装の食い違い(D-01〜D-05)を無くし、以降の STEP が正しい前提で始められるようにする。
- **対象**: `docs/PROJECT_STRUCTURE.md`、`docs/spec/UI_RULES.md`、`docs/KNOWN_ISSUES.md`、`docs/README.md`。
- **変更内容**: 行数・本数の更新、`TITLE` → `bootPhase` の注記、AUTO 接続済みの反映、KI-008 を「要再確認」または解決済みへ、`docs/refactor/` への案内追加。`data/images/title-screen-clean.PNG` はユーザーへ確認し、指示があれば削除。
- **変更しないもの**: コード全般。
- **依存関係**: なし。
- **リスク**: なし。
- **検査方法**: `git diff --check`。
- **完了条件**: D-01〜D-05 が解消。TD-27 の判断が記録されている。

---

### STEP 1: 安全網

- **目的**: 例外1つで全画面が消える状態を止め、リファクタリングの回帰を一括で検出できるようにする。
- **対象**: `game-system.jsx` の createRoot 付近と各 `gameState` の描画、`tools/`。
- **変更内容**:
  1. `ErrorBoundary`(クラスコンポーネント)を追加。ルート直下と、`gameState` 分岐の外側の 2 段。落ちたら「HOME へ戻る」ボタンと `__mhErr` へのログ。**表示文言は助手の場面として `assistants.js` に足す**(CLAUDE.md ⑤)。
  2. `tools/run-checks.js` を追加。領域(`save` / `battle` / `masu` / `rhythm` / `boot` / `help` / `all`)→ 検査一覧を持ち、順に実行して OK/NG を集計する。既存 workflow の `on:` は変えない。ワークフローも増やさない。
  3. ベースライン記録: 現時点で全検査を回した結果を `docs/refactor/BASELINE_2026-09.md` に残す(通る/通らない/環境依存)。
  4. `harness.js` の `EXPORTED_NAMES` に、以降の STEP で切り出す予定の純関数を先に足しておく(名前が消えたら気づける)。
- **変更しないもの**: ゲームの挙動、既存検査の判定基準、CI の yml。
- **依存関係**: なし。
- **リスク**: 低。エラー境界は正常時に何もしない。`run-checks.js` は既存検査を呼ぶだけ。
- **検査方法**: CLAUDE.md ⑥ の 5 本 + ヘルプ・助手 5 本 + `run-checks.js all`。`render-error-check` で境界が正常時に描画を変えないことを確認。
- **完了条件**: 意図的に例外を投げるデバッグ画面(`DEBUG_SETTINGS` 配下)で真っ白にならず HOME へ戻れる。`run-checks.js all` が 1 コマンドで回る。更新履歴には「画面が落ちても戻れるようにした」を利用者向けに 1 行(デバッグの入口自体は載せない)。

---

### STEP 2: ビルドの複数ファイル対応と、定数・キー・ユーティリティの集約

- **目的**: 1 ファイルを分けられる土台(連結ビルド)を作り、同時に散らばった定数を集める。
- **対象**: `tools/build.js`、`tools/harness.js`、`tools/check-syntax.js`、`tools/undefined-reference-check.js`、`tools/compiled-runtime-check.js`(読む対象)、`src/` 配下。
- **変更内容**:
  1. `src/order.json`(仮)に連結順を書き、`build.js` がその順で読んで1本にしてから Babel にかける。`--check` は連結後で比較。**出力ファイル名・URL・ヘッダは変えない。**
  2. 最初の切り出しは「本体に依存しないもの」だけ: `src/core/util/`(`wait`, clamp 系, JST 日付), `src/save/keys.js`(`mh_*` の文字列。値は変えない), `src/core/constants/`(`BATTLE_SPEEDS`, `RANGE_LABELS` など参照が単純なもの)。
  3. `RHYTHM_SETTINGS_KEY` の二重定義を `keys.js` 参照に寄せる(rhythm-mode.js は data/ なので、文字列一致を検査で担保する方法でもよい)。
  4. 「本体が必要とするグローバル一覧」検査(`boot/data-globals-check.js` 仮)を足し、`index.html` の読み込み順を守っているかを機械的に見る(TD-20)。
- **変更しないもの**: 関数の中身、定数の値、`index.html`、生成物の形。
- **依存関係**: STEP 1(検査一括実行)。
- **リスク**: 中。`build.js --check` の比較対象が変わる。`undefined-reference-check` が複数ファイルを1スコープとして扱えるか要確認(連結後に掛ければ今のまま)。
- **検査方法**: `build.js` → `build.js --check` → CLAUDE.md ⑥ 5 本 → `compiled-runtime-check` → `run-checks.js all`。生成物の diff が「行の移動だけ」であることを目視。
- **完了条件**: `src/` が 2 ファイル以上になり、生成物は 1 本のまま CI が通る。難易度 ID 列を持つ tools 3 ファイルが `keys.js` / 定数を参照する。

---

### STEP 3: 保存層の整理

- **目的**: 同じキーを書く 35 箇所を「キーごとの更新関数」1 つに集め、state と storage のずれ・書き忘れを構造的に無くす。
- **対象**: `storeGet/storeSet`(移動のみ)、`mh_masu_mons` / `mh_owned_items` / `mh_gold` / `mh_gifts` / `mh_breeder_xp` / `mh_missions` / `mh_breeder_points` … の読み書き、起動時ロード effect(12,781〜13,205)。
- **変更内容**(キー 1 つにつき PR 1 本、影響の小さい順: `mh_gifts` → `mh_breeder_xp` → `mh_gold` → `mh_owned_items` → `mh_missions` → `mh_masu_mons`):
  1. `src/save/records/<key>.js` に `load()`(既存の読込+`normalize*`+既定値をそのまま移す)と `update()`(state 更新と `storeSet` を1回で)を置く。
  2. 呼び出し側の `setX(...); storeSet('mh_x', ...)` の対を `updateX(...)` に置き換える。**機械的一括置換はしない。**1 箇所ずつ、順序(保存が先か state が先か)が変わっていないことを確認する。
  3. 複数キーにまたがる処理(購入・報酬・超越リセットの書)は `save/transactions/` に順序を書き、既存の順序(例: マスモン保存 → アイテム減)を保つ。
  4. `localStorage` 直接アクセス(`mh_player_id`、`mh_ranking_debug`)を `storeGet/Set` へ。バックアップの直接アクセスは仕様(SAVE_DATA §6)なので**そのまま**。
  5. `storeSet` の失敗回数を記録する(表示はしない。表示の追加は仕様変更なのでユーザー判断)。
  6. 起動 effect は `records` の `load()` を今と同じ順で呼ぶだけにする。移行フラグ・順序は変えない。
- **変更しないもの**: キー名、保存形式、`normalize*` / `migrate*` の中身と順序、バックアップ形式、`setStorageWriteBlocked` の位置。
- **依存関係**: STEP 1、2。
- **リスク**: **高**(S 等級領域に隣接)。順序の入れ替わりで「保存が抜ける」「補償が二重」。
- **検査方法**: 各 PR で `masu/*` 36 本、`boot/*` 17 本、`run/training-reward-check`、`ranking/*`、`browser/feature-check` を全部回す。加えて **旧形式のセーブを流し込む通し検査**(`boot/legacy-save-boot-check.js` 仮)を STEP 3 の最初の PR で足し、`SAVE_DATA.md` の各移行が 1 回だけ走ることを確認する。
- **完了条件**: `storeSet('mh_masu_mons'` の直接呼び出しが `records/masu-mons.js` の 1 箇所だけになる。他の主要キーも同様。バックアップ往復が今と同じ結果になる。

---

### STEP 4: ゲームデータと純関数の切り出し(`core/`)

- **目的**: React も DOM も知らない計算・定数を `core/` へ移し、vm から追加の export なしで検査できるようにする。
- **対象**: 370〜2,460 行(マスモン育成の純関数)、5,657〜6,410 行(難易度・極限ルール)、2,458〜2,530(BGM 一覧)、4,929〜5,400(ログインボーナス・ミッション定義)。
- **変更内容**: 移動のみ。`src/core/masu/`, `src/core/battle/extreme-rules.js`, `src/core/constants/{difficulties,battle-modes,bgm-tracks,missions,login-bonus}.js`。連結順で本体より前に置く。`harness.js` は連結後ソースを読むので、`EXPORTED_NAMES` の名前は残る。
- **変更しないもの**: 関数の中身、値、名前(名前を変えると静的検査 84 本と `EXPORTED_NAMES` が壊れる)。
- **依存関係**: STEP 2。
- **リスク**: 中。「関数の中で定義した定数を外から参照して真っ白」の再発。`undefined-reference-check` と `render-error-check` が拾う。
- **検査方法**: CLAUDE.md ⑥ 5 本 + `masu/*` + `mode/*-rules-check` + `run-checks.js all`。
- **完了条件**: `game-system.jsx` が 1〜10,358 行の共有層のうち純関数部分を持たなくなる。`core/` のファイルは React/DOM/storage を参照しない(検査 `core-purity-check.js` 仮で機械的に確認)。

---

### STEP 5: バトル計算の一本化

- **目的**: 予測ダメージと実ダメージの二重実装を無くし、勇者特性・固有技の連撃を 1 つの表から読む。
- **対象**: `getAttackPredictedDmg`(16,313)、`processTurn` の 16,752〜16,790、`getDmg`、`boostsForCardDamage`。
- **変更内容**:
  1. まず検査: 乱数を固定(会心なし/確定)して `getAttackPredictedDmg` と `processTurn` の合計が一致することを、現行コードで**先に**確認する検査を足す(`battle/damage-parity-check.js` 仮)。既存の `battle-damage-preview-check` は残す。
  2. `src/core/battle/damage.js` に「カード 1 枚のヒット列」を返す純関数を作り、予測は `crit: 'guaranteed' | 'none'`、実処理は `crit: rng` で呼ぶ。切り捨て位置・順序は現行と同じ。
  3. ザン 0.3/0.2、エイキ、パンドラ分割を `core/constants/hero-traits.js`(仮)の表にし、`damage.js` が読む。
  4. 被ダメージ関数は移動のみ。
- **変更しないもの**: 数式・端数処理・係数・演出順序・`attackHits` の形。敵 AI。極限ルール。
- **依存関係**: STEP 4。
- **リスク**: **高**(A 等級: スコアが変わればランキングの公平性に影響)。
- **検査方法**: `battle/*` 29 本 + 新設 parity 検査 + `battle-scenario-check`(演出順)+ `mode/*`(極限)。乱数固定の比較は「完全一致」で。
- **完了条件**: 勇者特性の分岐(`mainHero?.id==='…'`)が `processTurn` と予測関数から消え、表の参照だけになる。parity 検査が全勇者 × 全カード種で一致。

---

### STEP 6: 画面ライフサイクルと画面の切り出し

- **目的**: 画面を離れたらタイマー・リスナー・長い async が必ず止まるようにし、`MonsterHeroGame` から 1 画面ずつ独立コンポーネントへ移す。
- **対象**: `MonsterHeroGame` JSX 部(18,881〜25,082)と、各画面が使う state・関数。
- **変更内容**:
  1. `src/ui/lifecycle/use-screen-effects.js`: `gameState` に紐づく `{timeout, interval, raf, listen, token}` を返す hook。画面が変わったら全部止める。
  2. 切り出し順(依存が少なく、検査が厚い順): `SETTINGS` → `MISSIONS` → `GIFT_BOX` → `ITEM_INVENTORY` → `BREEDER_MARKET` → `PROFILE` → `MONSTER_DEX(_DETAIL)` → `MASU_*`(育成系)→ `RHYTHM_*`(演奏画面以外)→ `PICK_*` → `WAVE_RESULT/REWARD_PICK/UPGRADE_SKILL/CHAMPION` → `HOME` → `BATTLE`(最後)。
  3. 各画面 PR で: JSX を `src/ui/screens/<STATE>.jsx` へ移動、必要な値を props で明示、画面内だけの `useState` をその画面へ移す、`ErrorBoundary` で包む(STEP 1 の境界を画面単位へ)、`setTimeout` を `effects.timeout` へ。
  4. `processTurn` は `token` を受け取り、`await` の後に `token.alive` を見る(BATTLE 切り出し時)。
- **変更しないもの**: 画面の見た目・文言・遷移先・演出のタイミング。`gameState` の文字列。`HELP_SCREEN_COVERAGE`。
- **依存関係**: STEP 1、3(永続 state は `records` の更新関数を渡す)。
- **リスク**: 中〜高。props 化し忘れ(`undefined-reference-check` が拾う)、`useState` 初期化順(`render-error-check`)、タイマー停止で演出が途切れる(`battle-scenario-check`)。
- **検査方法**: 画面ごとに CLAUDE.md ⑥ 5 本 + `help-coverage-check` + `browser/feature-check` + その画面の検査(`masu/*`, `boot/mission-gift-badge-check`, `mode/rhythm-song-select-check` …)+ `home-layout-check`(HOME)。
- **完了条件**: `MonsterHeroGame` の JSX 部が「画面の切替」だけになり、`useState` が半減以下。`setTimeout` の直接呼び出しが `MonsterHeroGame` から消える。

---

### STEP 7: 描画・イベント・キャッシュの整理、CSS 静的化の準備

- **目的**: iPhone での再描画コストとメモリ増加を抑える。Tailwind 静的化の判断材料を作る。
- **対象**: 染色キャッシュ(4,080、3,844)、一覧行のコンポーネント、`style={{…}}`、`index.html` CSS と `createAnimationStyle`。
- **変更内容**:
  1. `_dyeRecolorCache` / `_dyeRegionMaskCache` を件数上限付き(LRU)に。キーと生成結果は同じ。
  2. 一覧行(マスモン一覧・ランキング行・カード)に `React.memo`。`key={i}` を安定 ID へ(並べ替えのある一覧のみ)。
  3. 静的な `style={{…}}` を定数へ(動的なものは残す)。
  4. `tools/layout/` の手元ビルドで使用クラスを抽出し、静的 CSS の容量と欠けるクラス(動的生成クラス)を `docs/refactor/` に報告。**切替はしない**(ユーザー判断)。
- **変更しないもの**: 見た目・アニメーション。`index.html` の CSS。
- **依存関係**: 1〜3 は STEP 6 と独立に進められる。4 は独立。
- **リスク**: 低〜中。`memo` の比較漏れで更新されない行が出る。
- **検査方法**: `image/*`(染色結果の一致 `dye-report` と `dye-baseline.json`)、`layout-consistency-check`、`browser/perf-check`、`browser/feature-check`。
- **完了条件**: 染色キャッシュに上限がある。`browser/perf-check` の数値が悪化していない。CSS 静的化の報告がある。

---

### STEP 8: 音声管理の移動と SRI

- **目的**: `Audio_` を `src/audio/audio.js` へ移動し、Tone.js の完全性検証(KI-009)を付ける。
- **対象**: 2,734〜3,096 行。
- **変更内容**: 移動のみ + ネットワークのある環境でハッシュを取って `integrity` / `crossOrigin` を付ける(ハッシュが取れない環境では移動のみ)。
- **変更しないもの**: AudioContext 復帰手順、BGM/SE の API、音量・ミュート設定の保存。
- **依存関係**: STEP 2。
- **リスク**: 低(移動)。SRI はハッシュ誤りで SE が全部鳴らなくなるが進行不能にはならない(`onerror` で先へ進む作り)。
- **検査方法**: `audio/*` 17 本、`build.js --check`。SRI は実ブラウザ(ネットワークあり)で SE が鳴ることを確認。
- **完了条件**: `Audio_` が独立ファイル。KI-009 が解決済みへ。

---

### STEP 9: 音ゲー基盤の整理

- **目的**: 譜面データとロジックを分け、ランタイムパッチの「グローバル上書き」と「常駐」を無くす。**タイミング基盤は変えない。**
- **対象**: `data/rhythm-mode.js` 1,577〜7,493(譜面)、`data/rhythm-result-replay-remount.js`、`data/rhythm-geometry-calibration.js`、`data/rhythm-step3-release.js`、`RHYTHM_GESTURE_RUNTIME` / `RHYTHM_TOUCH_SPAN_RUNTIME` / `installRhythm*`、`RhythmTapTest`。
- **変更内容**(順番が重要):
  1. 譜面を `data/rhythm-charts/<song>.js` へ移動。`RHYTHM_SONG_ENTRIES` は参照のみ。`index.html` の読み込みを足し、キャッシュキー検査に載せる。CI の音ゲー検査 21 本が読む経路を確認して先に直す。
  2. 本体側で `RhythmTapTest` を `key` で再マウントする(今 `rhythm-result-replay-remount.js` がやっていること)を `RHYTHM_PLAY` 画面の中に実装。同じ挙動になったことを `rhythm-mode-restart-remount-check` で確認してから、`index.html` の読み込みから外す。
  3. `version.json` の build 判定を本体 1 箇所にまとめ(data 側 build と compiled build のどちらが新しくても 1 回だけバナー)、2 つの `window.fetch` 上書きを外す。`update-notice-check` を先に「両方の経路」で通す。
  4. `RHYTHM_GESTURE_RUNTIME` などに `install()/uninstall()` を足し、`RHYTHM_PLAY` の出入り(STEP 6 の `useScreenEffects`)で呼ぶ。**リスナーの登録順・capture 指定・passive 指定は変えない。**
  5. `RhythmTapTest` のインデントを直す(空白のみの差分。生成物の diff で「空白以外の変更なし」を確認)。
- **変更しないもの**: 曲時刻(`ctx.currentTime`)、判定窓、投影の数式、`travelCacheRef` の測り直し条件、ノーツ SE、モンスターノーツ能力、譜面の内容、スコア・ランク。
- **依存関係**: STEP 1、6。
- **リスク**: **高**(A 等級。実機でしか分からない)。
- **検査方法**: CI の音ゲー 21 本 + `mode/rhythm-*` 122 本 + `rhythm-perf-check` + 実機(iPhone)での「もう一度」「ポーズ」「回転」「初回起動」。実機確認はユーザーに依頼し、未確認のまま「完了」と言わない。
- **完了条件**: `React.createElement` と `window.fetch` の上書きが配信物から消える。音ゲー以外の画面に音ゲーのリスナー・Observer が残らない(`document` のリスナー数を Playwright で数える検査を足す)。`rhythm-mode.js` が 3,000 行以下。

---

### STEP 10: 残存負債

- **目的**: 開発者だけが触るものと、起動時に必ず読むものを分ける。
- **対象**: デバッグ 13 画面と `rpg*`(7,269〜7,742)、`data/assistants.js`、`changelog.js` / `help.js` の読み込み。
- **変更内容**:
  1. デバッグ画面を `src/ui/debug/` へ移動(配信物には残す。方針どおり更新履歴には載せない)。
  2. `assistants.js` を「定義・セリフ(データ)」と「選択・親密度(ロジック)」に分ける。`addAssistantLinePack` の API は同じ。
  3. `changelog.js`(446KB)の遅延読込を**検討**する。更新通知(`availableUpdateNotices`)が起動時に必要とするのは ID と種別だけなので、要約と本文を分ける案。**起動ゲージ・更新バナー・助手告知に影響するため、実施はユーザー判断。**
- **変更しないもの**: デバッグ機能の内容、セリフ、更新履歴の内容。
- **依存関係**: STEP 6。
- **リスク**: 低〜中。
- **検査方法**: `assistant-check`, `assistant-bond-check`, `update-notice-check`, `market-notice-check`, `battle/rpg-debug-check`, `boot/*`。
- **完了条件**: `game-system.jsx`(残り)が本体の骨格だけになる。`CURRENT_ARCHITECTURE.md` を最終形に更新。

## 3. 進め方の共通ルール

- 各 PR の本文に「対応 STEP / 対応 TD / 変更しないもの / 回した検査」を書く。
- PR は当日中にマージまたはクローズ(AGENTS.md)。base が古くなったら作り直す。
- 各 STEP の完了時に `CURRENT_ARCHITECTURE.md` の該当節と `TECH_DEBT_AUDIT.md` の一覧(対応済み印)を更新する。
- 想定外の挙動差を見つけたら、直さずに `TECH_DEBT_AUDIT.md` か `KNOWN_ISSUES.md` へ記録して別 PR にする。

## 4. 最初に着手する STEP

**STEP 1(安全網)** から始める。理由:

1. コードの挙動を変えずに足せる(エラー境界は正常時に何もしない、一括検査は既存検査を呼ぶだけ)。
2. 以降のすべての STEP が「壊したら気づける」ようになる。
3. 現在の最大リスク(TD-01: 例外 1 つで全画面が消える)を、構造を変える前に塞げる。

STEP 1 の最初の PR は `tools/run-checks.js` とベースライン記録(コード無変更)にし、2 本目でエラー境界を入れる。
