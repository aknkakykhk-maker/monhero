# 回帰リスクマップ

調査日: 2026-09-05 / 対象: `main` 9f9cfa0

「ここを触るとどこが壊れるか」「壊れたことをどの検査が拾うか」「拾えない穴はどこか」を領域ごとにまとめた。
リファクタリングの各 STEP は、着手前にこの表で対象領域のリスク等級と検査を確認する。

リスク等級:

| 等級 | 意味 |
| --- | --- |
| **S** | 既存プレイヤーのデータ・記録を壊しうる。元に戻せない。原則として構造変更の対象にしない |
| **A** | プレイ不能・ランキング不一致・タイミングずれなど、実機でしか分からない壊れ方をする |
| **B** | 画面の見た目・演出・文言の回帰。検査で拾いやすい |
| **C** | 開発者だけが触る。プレイヤーへの影響は無い |

## 1. 領域別

| 領域 | 等級 | 主な所在(jsx 行 / ファイル) | 依存しているもの | 壊れ方の例 | 拾う検査 | 検査の穴 |
| --- | --- | --- | --- | --- | --- | --- |
| セーブ形式・キー名 | **S** | `storeGet/Set` 7,780〜、`normalize*`、`migrate*`(1,099〜2,150、5,000〜5,500、12,781〜13,205) | `docs/spec/SAVE_DATA.md`、`mhsave-backup.js`、バックアップ復元 | キー名変更で全員のデータが初期化される。移行フラグを消すと補償が二重に付く | `masu/*`(36本: 形式・移行・補填)、`boot/*`、`run/training-reward-check` | 「実 localStorage に古い形式を入れて起動する」通しは `browser/feature-check` の一部のみ |
| ランキング送信・取得 | **S** | 7,857〜8,456、`submitRunScoreOnce` 13,326、`loadRankings` 11,963 | Supabase 列名、`difficulty` 文字列、`clear_id` | 難易度キーの綴りが変わると別ランキングに載る。送信が二重になる | `ranking/*`(23本)、`run/ranking-finish-check` | 本物の Supabase へは検査から送らない(モック) |
| 音ゲーのタイミング基盤 | **A** | `Audio_.startRhythmTrack` 2,920〜、`RhythmTapTest` の `scheduleTick`/`measureTravel`(9,943〜10,300)、`rhythm-mode.js` の投影・判定窓 | `ctx.currentTime`、`getBoundingClientRect` キャッシュ、`travelCacheRef` | 判定が数十 ms ずれる。初回起動でノーツが画面外に固定される(2026-09-05 に実際に発生) | CI の音ゲー 21 本、`mode/rhythm-*`(122本)、`rhythm-perf-check` | 実機 iPhone のカクつき・音ずれは自動化できない。**構造目的で触らない** |
| 音ゲーのランタイムパッチ | **A** | `data/rhythm-result-replay-remount.js`(`RhythmTapTest` 名に依存)、`rhythm-geometry-calibration.js`/`rhythm-step3-release.js`(fetch 上書き)、`RHYTHM_GESTURE_RUNTIME` | 本体の関数名、`data-rhythm-*` 属性名、`version.json` の build | 関数名を変えると「もう一度プレイ」が iPhone で効かなくなる。属性名を変えるとポーズ操作が外れる | `mode/rhythm-mode-restart-remount-check`、`rhythm-demo-entry-check`、`update-notice-check` | 名前依存の検査は「名前が残っているか」しか見ない |
| バトルの数式 | **A** | `processTurn` 16,608〜、`getDmg`、`getAttackPredictedDmg` 16,313、被ダメ 16,087〜16,106、極限ルール 6,003〜6,260 | `docs/spec/BATTLE_SYSTEM.md`、教えカード効果、勇者特性分岐 | 端数処理の順序が変わりスコアが変わる → ランキングの公平性に影響 | `battle/*`(29本: `battle-check`, `battle-damage-preview-check`, `battle-scenario-check`, `battle-mode-check`)、`mode/*-rules-check` | 乱数を含む会心・連撃は期待値でしか検査できない |
| マスモン育成の数式 | **A** | 370〜2,460(レベル・絆・限界突破・超越・転生・合体・総合力) | `docs/spec/MONSTER_SYSTEM.md`、ランキング詳細形式 | 総合力が変わる、超越ポイントが二重に付く | `masu/*`(36本)、`monster-power-check`、`transcendence-check` | 旧形式個体(`distAptBoosts` 無し)の実サンプルが少ない |
| 起動経路 | **A** | `index.html` boot、`bootPhase`、12,731〜13,205、`reloadLatestVersion` 12,473 | `__mhBoot` の SIZES、`GAME_BUILD`、data キャッシュキー | 真っ白、ゲージが止まる、更新バナーが出続ける | `boot-flow-check`, `update-notice-check`, `boot/data-cache-key-check`, `render-error-check`, `boot/*`(17本) | Tailwind CDN が届かない場合の見た目はサンドボックスで再現不可 |
| 音声(BGM/SE) | **A** | `Audio_` 2,734〜3,096、BGM 対応表 `bgmKeyForState` 12,370 | Tone.js CDN、AudioContext の状態、`visibilitychange` | 二重再生、裏面から戻っても鳴らない、消音モードで鳴る(KI-006 で解決済み) | `audio/*`(17本: `bgm-check`, `audio-route-check`, `title-bgm-check`) | Android 実機(KI-007) |
| 画面遷移・戻り先 | **B** | `setGameState` 74 種、`masuEnhanceFrom`、`NOTICE_DESTINATIONS` | `HELP_SCREEN_COVERAGE`、助手の `scene` | 戻るで別画面へ飛ぶ、ヘルプ検査が落ちる | `help-coverage-check`, `browser/feature-check`, `boot/mission-gift-badge-check` | 74 画面すべての通しは無い |
| 助手・ヘルプ・更新履歴 | **B** | `data/assistants.js`, `data/help.js`, `data/changelog.js`, `AssistantBubble` 6,926 | `assistantNotice`、`RELEASE_FLAGS`、`{ t:'data', id }` の実データ表 | 告知が出ない、ヘルプに `{` が出る、みゅあ/ききの語調が混ざる | `assistant-check`, `assistant-bond-check`, `help-render-check`, `help-guide-check`, `market-notice-check`, `jsx-text-brace-check` | – |
| 染色・画像 | **B** | 3,096〜4,420、`images/`、`data/images/*.js` | 画像パス、キャッシュキー、マスク PNG | 絵が出ない、色が変わる、古い絵のまま | `image-asset-check`, `image/*`(31本: `dye-report`, `dye-baseline.json`) | メモリ増加(TD-10)は測っていない |
| レイアウト(HOME・バトル・音ゲー HUD) | **B** | JSX 18,881〜25,082、`createAnimationStyle`、`index.html` CSS | Tailwind クラス、safe area | 重なり、はみ出し、押せない | `home-layout-check`, `layout-consistency-check`, `viewport-height-check`, `mode/rhythm-*-layout-check` | Tailwind 手元ビルドが要る(`tools/layout/`) |
| デバッグ画面・RPG デバッグ | **C** | `DEBUG_SETTINGS` 配下、7,269〜7,742 | – | 開発者の確認手段が減る | `battle/rpg-debug-check`, `rpg-debug-layout-check` | – |
| 検査基盤そのもの | **C** | `tools/harness.js`(`EXPORTED_NAMES` 138)、静的検査 84 本 | 本体の識別子名・文言 | 関数を動かすと検査が「見つからない」で落ちる(誤検知) | – | 検査が落ちたとき「実装が壊れた」のか「検査が古い」のか区別できない |

## 2. 変更の種類別の危険度

| やろうとしていること | 等級 | 理由 | 先にやること |
| --- | --- | --- | --- |
| `mh_*` キーの改名・削除・意味変更 | **S** | 全プレイヤーのデータが読めなくなる | やらない(`AGENTS.md` で禁止) |
| 難易度 ID(`Beginner`〜`Legend`)、種 ID、教え ID、アイテム ID の変更 | **S** | 保存値とランキング行に入っている | やらない |
| `storeSet` の呼び出しを更新関数へ寄せる | A | 呼び忘れ・二重呼びの温床だが、寄せる作業自体で1箇所でも順序を変えると保存が抜ける | 1キーずつ。`masu/*` と `boot/*` を毎回全部回す |
| `MonsterHeroGame` から画面 JSX を切り出す | A | props 化し忘れた変数は `undefined-reference-check` が拾うが、`useState` の初期化順が変わると `render-error-check` でしか分からない | 1画面ずつ。`help-coverage-check` と `browser/feature-check` |
| 共有層(1〜10,358 行)を別ファイルへ | A | `index.html` の読み込み順、`harness.js`、`compiled-check.yml`、`build.js` が同時に変わる | 先に `build.js` を複数入力に対応させ、`--check` で不一致を止める |
| `rhythm-mode.js` から譜面を分離 | A | CI の音ゲー 21 本がファイルを直接読む | 検査側の読み込み経路を先に共通化 |
| `RhythmTapTest` のリネーム・分割 | A | `rhythm-result-replay-remount.js` が名前で判定 | 先に本体側で key 再マウントを実装(TD-03) |
| タイマー・リスナーの一元管理 | A | 止めすぎると演出が途中で消える | 画面単位で導入、`battle-scenario-check` で演出順を確認 |
| 予測ダメージと実ダメージの一本化 | A | 数式の順序(切り捨て位置)が1つ変わるとスコアが変わる | `battle-damage-preview-check` を「完全一致」のまま維持し、乱数を固定した比較検査を先に足す |
| `data/*.js` の読み込み順変更 | A | 後ろのファイルが前のグローバルを参照 | 「本体が要るグローバル一覧」検査を先に足す |
| CSS の静的化(Tailwind CDN 廃止) | B | 全画面の見た目 | 使用クラス抽出と容量測定を先に。切替はユーザー判断 |
| デバッグ画面の分離 | C | 開発者のみ | 更新履歴に載せない(CLAUDE.md) |

## 3. 検査が拾えないもの(実機・目視が必要)

- iPhone Safari の長時間プレイでのメモリ(染色キャッシュ、dataURL、AudioBuffer 38 曲ぶん)。
- 音ゲーのカクつき・音ずれ・振動(`RHYTHM_PERF` はデバッグ限定の自己計測)。
- Tailwind が遅れて届いたときの一瞬の見た目。
- Android 実機の BGM(KI-007)。
- 通信断・容量超過時の保存失敗(TD-14。記録も通知も無い)。

## 4. 触らない方がよい領域(構造目的では変更しない)

1. **音ゲーの曲時刻・判定窓・投影の数式**(`startRhythmTrack`、`scheduleTick`、`rhythmProject*`、`rhythmJudge*`、`RHYTHM_INPUT_MATCH_*`)。動いている。
2. **`normalize*` / `migrate*` / `repair*` の順序と条件**。一度きり移行の再実行は補償の二重付与になる。
3. **ランキングの `difficulty` 文字列と送信 payload**。
4. **`Audio_` 内部の AudioContext 復帰手順**(iOS の user activation 対策)。
5. **`setStorageWriteBlocked` の位置**(保存入口が1つであることに依存)。
6. **`index.html` の `__mhBoot`・再試行・`GAME_BUILD`**(起動失敗の再発防止が積み重なっている)。
7. **`RHYTHM_GESTURE_RUNTIME` の capture リスナーの順序**(指の持ち替え・iOS の URL バー対策)。常駐を止める(TD-09)ときも登録順は保つ。
