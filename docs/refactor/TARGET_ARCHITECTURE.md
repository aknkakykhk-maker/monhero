# 目標アーキテクチャ(現実的な到達点)

調査日: 2026-09-05 / 前提: `CURRENT_ARCHITECTURE.md`、`TECH_DEBT_AUDIT.md`

理想の作り直しではなく、**いまの Monster Hero から段階的に到達でき、途中のどの時点でも遊べる**形を目標にする。
守るもの: 配信方式(静的サイト・GitHub Pages・URL)、React 18 UMD、classic script、`mh_*` キー、ランキング、画像・BGM、UI・演出、
音ゲーのタイミング基盤、`build.js --check` による生成物の一致検査、既存の 2 ワークフロー。

## 1. 到達点の一言

> 「1枚岩の本体」を、**読み込み順で並ぶ複数の classic script**(ビルド時に1本へ連結)へ分け、
> 永続データは**キーごとの更新関数**を通し、画面は**1画面1コンポーネント**にし、
> 画面に紐づく**タイマー・リスナー・ランタイムパッチは画面の出入りで必ず止まる**ようにする。

ES module 化・バンドラ導入・TypeScript 化は**しない**(モバイルからの編集と `build-and-check.yml` の前提、Tailwind CDN と
グローバル参照の設計を壊すため)。将来それを選ぶ余地は残るが、この計画の範囲外。

## 2. 目標のファイル構成

```text
monster-hero/
  index.html                       … 読み込み順は今のまま + 分割した本体を「連結後の1本」として読む(URL 不変)
  game-system.compiled.js          … 生成物(変わらず1本)。tools/build.js が src/ の複数ファイルを順に連結して変換
  src/
    game-system.jsx                … 当面は「残り」。STEP が進むごとに薄くなる
    core/                          … 純関数・定数(React も DOM も知らない)
      constants/   battle-modes.js, difficulties.js, bgm-tracks.js, missions.js, login-bonus.js …
      masu/        level.js, bond.js, breakthrough.js, transcend.js, fusion.js, power.js, migrate.js …
      battle/      damage.js(ヒット列の純関数), enemy-ai.js, extreme-rules.js, auto-turn.js
      util/        clamp.js, jst-date.js, normalize.js
    save/                          … 保存層
      store.js         (storeGet/storeSet/storeList/setStorageWriteBlocked … 今と同じ実装)
      keys.js          (mh_* キー名の一覧。文字列リテラルをここに集める。値は変えない)
      records/         masu-mons.js, owned-items.js, gold.js, gifts.js, missions.js …
                       (各ファイル = 読込+正規化 / 更新関数 / 依存する移行)
      boot-load.js     (起動時の読込順序だけを持つ)
    audio/            audio.js(Audio_ をそのまま移す。中身は触らない)
    ranking/          supabase.js(sb* をそのまま移す)
    ui/
      lifecycle/      screen-effects.js(画面単位のタイマー・リスナー登録簿)、error-boundary.js
      components/     共有部品(43 個の既存コンポーネント)
      screens/        HOME.jsx, BATTLE.jsx, MASU_ENHANCE.jsx … (gameState ごと)
      debug/          DEBUG_SETTINGS.jsx, rpg-debug/ …(配信物には残るが、ファイルとして分かれる)
      app.jsx         MonsterHeroGame(状態の置き場と画面の切替だけになっていく)
    rhythm/
      play/           RhythmTapTest.jsx(タイミング基盤は移動のみ、変更なし)
      runtime/        gesture-runtime.js, note-visuals.js … (install/uninstall を持つ)
  data/
    (今の data/*.js はそのまま)
    rhythm-charts/    曲ごとの譜面ファイル(rhythm-mode.js から分離)
```

ファイルを分けても、**ブラウザが受け取るのは今と同じ `game-system.compiled.js` 1本**(`build.js` が `src/` を決められた順で連結してから Babel にかける)。
これにより:

- `index.html`・キャッシュキー・起動ゲージの SIZES・`build.js --check`・`compiled-runtime-check` はそのまま使える。
- `harness.js` は「連結後のソース」を今と同じ手順で vm に載せられる(`EXPORTED_NAMES` も動く)。
- 分割の途中でも常に1本にまとまるので、どの時点でも遊べる。

## 3. 層と依存の向き

```text
data/*.js (グローバル定数)          ← 変えない
      ↓
src/core/*   純関数・定数            ← React・DOM・storage を import しない(参照しない)
      ↓
src/save/*   保存層                   ← core を使う。React を知らない。DOM は storage のみ
src/audio/*  src/ranking/*            ← core を使う
      ↓
src/ui/*     画面・部品               ← 上のすべてを使う。storage を直接触らない(save/records 経由)
src/rhythm/* 音ゲー                   ← core と audio を使う。runtime は ui/lifecycle から install/uninstall
      ↓
src/ui/app.jsx  MonsterHeroGame       ← すべてをつなぐ
```

依存は上から下への一方向。**下の層が上の層の識別子名を知らない**(いまの `rhythm-result-replay-remount.js` が `RhythmTapTest` の名前を知っているような関係を無くす)。

検査ツールも同じ向きに従う: `core/` と `save/` は vm で直接呼べる(スタブ最小)、`ui/` は Playwright。

## 4. 各責務の目標形

### 4.1 保存(save/)

- 入口は今と同じ `storeGet/storeSet`(実装を移すだけ)。
- `keys.js` に `mh_*` の文字列を集める。**名前は一切変えない**。動的キー(`mh_hs_<難易度>`)は生成関数として置く。
- `records/<key>.js` は次の 3 つだけを持つ:
  - `load()`: `storeGet` → `normalize` → 既定値補完(今の起動 effect の該当部分をそのまま移す)
  - `update(prev => next)`: React state 更新と `storeSet` を1回で行う(今 35 箇所に散っている対を1つに)
  - `migrations`: そのキーに関わる一度きり移行(フラグ名・順序は今のまま)
- `boot-load.js` は `records` を今と同じ順序で呼ぶだけ。順序が正本として1箇所に見える。
- 複数キーにまたがる更新(購入 = gold 減 + items 増)は、`records` を順に呼ぶ「取引関数」を `save/transactions/` に置く。原子性は保証できない(localStorage)が、**順序と失敗時の記録**を1箇所にする。

### 4.2 ゲームデータ(core/constants)

- jsx 側にある表(難易度・モード・BGM・ミッション・ログインボーナス・補償)を `core/constants/` へ**移動のみ**。値は変えない。
- 勇者特性・固有技の連撃のような「ID → 挙動」は、まず**表 + 参照**にする(全部のデータ駆動化はしない)。
- ヘルプの `{ t:'data', id }` はこの表を読む。

### 4.3 バトル(core/battle)

- `damage.js`: 「カード1枚が生むヒット列」を返す純関数。入力は(カード・使用者・勇者・バフ群・距離・会心判定関数)。予測は会心判定を「確定/なし」で、実処理は乱数で呼ぶ。
- `processTurn` は state 更新と演出の順序だけを持つ「進行係」に近づける。数式を持たない。
- 被ダメージは既に一本化済みなので、その関数を `damage.js` へ移す。

### 4.4 画面(ui/screens)

- 1 gameState = 1 ファイル。`app.jsx` は `SCREENS[gameState]` を描く。
- 画面が必要とする state と操作は props で渡す。**画面をまたぐ永続 state は `save/records` の更新関数**を渡す。
- 画面の中でだけ使う UI 一時 state(モーダル開閉・選択中)はその画面の `useState` へ移す。これで 417 個の state が「アプリ全体」と「画面ごと」に分かれる。
- 各画面を `ErrorBoundary` で包む。落ちたら HOME へ戻すボタンを出す(保存は即時なので進行は失われない)。

### 4.5 画面ライフサイクル(ui/lifecycle)

- `useScreenEffects(gameState)` が返す `{ timeout, interval, raf, listen }` を使うと、画面を離れた瞬間に全部止まる。
- `processTurn` のような長い async は `token = effects.token()` を受け取り、`await` の後で `token.alive` を見る。
- 音ゲーのランタイム(gesture/visual/観測)は `install(effects)` / `uninstall()` を持ち、`RHYTHM_PLAY` の出入りで呼ばれる。

### 4.6 描画・イベント

- `React.memo` は「一覧の行」(マスモン一覧・カード・ランキング行)にだけ使う。
- `style={{…}}` は静的なものを定数へ。動的なものは残す。
- 染色キャッシュは件数上限付き(LRU)。

### 4.7 音声(audio/)

- `Audio_` を移動のみ。API はそのまま。Tone.js の SRI(KI-009)はハッシュが取れる環境で追加。

### 4.8 音ゲー(rhythm/)

- タイミング基盤・判定・投影は**移動のみ**(`data/rhythm-mode.js` の純関数部分は当面そのまま)。
- 譜面は曲ごとのファイルへ。`RHYTHM_SONG_ENTRIES` は参照のみ。
- ランタイムパッチは `rhythm/runtime/` へ集め、`React.createElement` と `window.fetch` の上書きは本体側の実装に置き換えてから読み込み順から外す。

### 4.9 デバッグ(ui/debug)

- 配信物に残す(方針どおり)。ファイルとして分け、`DEBUG_SETTINGS` の入口だけ `app.jsx` が知る。

### 4.10 検査(tools/)

- `tools/run-checks.js`(仮)が「領域 → 検査一覧」を持ち、`--area save` のように回せる。**既存の workflow の `on:` は変えない**。
- `harness.js` は連結後ソースを読む。`core/` と `save/` は追加の export 行なしで呼べるよう、連結時に `globalThis.__mh = {…}` を末尾に足す(生成物には含めない)。

## 5. AI が新しいセッションで迷わないための約束

- `docs/refactor/README.md` から入る。`CURRENT_ARCHITECTURE.md` は STEP 完了ごとに更新し、「いま何がどこにあるか」を常に正しく保つ。
- 各 `src/*/` の先頭に 5 行以内の役割コメントを置く(長い説明は書かない。コードを読めば分かることは書かない)。
- 「保存キーは `save/keys.js`」「数式は `core/`」「画面は `ui/screens/`」「タイマーは `useScreenEffects`」の4つを覚えれば場所が分かる状態にする。
- 変更時の注意(触らない領域)は `REGRESSION_RISK_MAP.md` §4 を正本にする。

## 6. 目標に含めないもの

- ES module / バンドラ / TypeScript / テストフレームワーク導入。
- Tailwind の静的化そのもの(準備までを STEP 7 に含め、切替はユーザー判断)。
- サーバー側(Supabase RLS)の変更。
- 仕様・数値・演出・文言の変更。
