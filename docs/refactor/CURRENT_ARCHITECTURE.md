# 現在のアーキテクチャ(actual)

調査日: 2026-09-05 / 対象: `main` 9f9cfa0(PR #1103 まで)

この文書は「いまの Monster Hero が実際にどう組み上がっているか」を、コードから確認できた事実だけで書いたもの。
仕様の正本は `monster-hero/src/game-system.jsx` と `monster-hero/data/`、公式仕様は `docs/spec/`。
両者が食い違う箇所は末尾「actual / spec の差」に列挙し、どちらへ寄せるかはここでは決めない。

## 1. 全体像

サーバーを持たない静的サイト。React 18(同梱UMD)で1枚のルートコンポーネント `MonsterHeroGame` を描画し、
ゲーム進行は端末の `localStorage`、全国ランキングだけ Supabase REST を使う。

```text
ブラウザ
  monster-hero/index.html                  … 起動ゲージ(__mhBoot)・エラーフック・CSS 617行・script 読み込み順
    ├─ vendor/react*.js                     … React / ReactDOM 18 (UMD, グローバル)
    ├─ https://cdn.tailwindcss.com          … Tailwind 実行時生成(外部CDN。KI-001)
    ├─ data/images/images-{ally,enemy}.js   … 画像パス表
    ├─ data/{ally-monsters,lineages,breeder,enemy-monsters,skills}.js … ゲーム定義(グローバル定数)
    ├─ data/rhythm-mode.js ほか rhythm-*.js  … 音ゲーの定数・純関数・譜面データ・ランタイムパッチ
    ├─ data/{changelog,help,assistants}.js  … 更新履歴 / ヘルプ / 助手セリフ
    ├─ data/mhsave-backup.js                … .mhsave 保存・復元(localStorage 直読み)
    └─ game-system.compiled.js (2.9MB)      … tools/build.js が src/game-system.jsx から生成
          ├─ Audio_ (Web Audio + Tone.js CDN 動的読込)
          ├─ storeGet / storeSet (window.storage → localStorage → メモリ)
          └─ Supabase REST (fetch)
```

起動時に必ず読む合計は約 5.7MB(`__mhBoot` の SIZES 合計 5,695,252 バイト)。うち本体 JS が 2.9MB、
`changelog.js` 446KB、`assistants.js` 266KB、`help.js` 256KB、`rhythm-mode.js` 618KB。

## 2. ファイル構成と規模

| ファイル | 行数 | サイズ | 役割 |
| --- | ---: | ---: | --- |
| `monster-hero/src/game-system.jsx` | 25,638 | 2.5MB | ゲーム本体の編集元。トップレベル定義 1,023 個。export なし |
| `monster-hero/game-system.compiled.js` | 49,383 | 2.9MB | 生成物。直接編集しない(`build.js --check` が一致を検査) |
| `monster-hero/data/rhythm-mode.js` | 8,624 | 618KB | 音ゲー。定数・純関数 約2,700行 + 譜面データ 5,916行(1577〜7493行) |
| `monster-hero/data/changelog.js` | 5,139 | 446KB | 更新履歴 551 件 |
| `monster-hero/data/assistants.js` | 3,600 | 266KB | 助手(みゅあ・きき・ももすけ)の定義・セリフ 270 場面・親密度・チュートリアル台本 |
| `monster-hero/data/help.js` | 1,340 | 256KB | ヘルプ 41 項目、`HELP_SCREEN_COVERAGE`(画面→項目) |
| `monster-hero/index.html` | 792 | 50KB | 起動ゲージ・CSS・読み込み順・本体JSの再試行 |
| `monster-hero/data/breeder.js` | 275 | 26KB | 教えカード 64 枚・マーケット商品・アイコン定義 |
| `monster-hero/data/ally-monsters.js` | – | 22KB | 味方種 19 体 |
| `monster-hero/data/{skills,lineages,enemy-monsters}.js` | – | 各 2〜8KB | 技段階・血統・敵 |
| `monster-hero/data/rhythm-{authoring,geometry-calibration,lane-svg,result-replay-remount,step3-release,timing}.js` | – | 3〜15KB | 音ゲーの追加ランタイム(後述) |
| `monster-hero/debug/*.js` / `*.json` | – | 6.6MB | 譜面制作UI(デバッグ)・正式候補譜面 JSON(配信物に含まれる) |
| `tools/` | 385 本 | – | ビルド 1、検査 326(`*-check.js`)、生成・解析ほか |

## 3. `game-system.jsx` の内部地図(行番号は 9f9cfa0 時点)

> 2026-09-06(STEP 2)から、編集元は `monster-hero/src/parts/*.jsx` になり、`game-system.jsx` はそれを `parts.json` の順に連結した生成物。
> 部品は共有層 21 個(`10-core` 〜 `30-rhythm-play`。2026-09-06 に旧 `10-shared` を節ごとに分けた。役割は `parts.json`)と、`40-screen-effects.jsx`(画面ライフサイクル。2026-09-10 の STEP 6-1 で追加)、`50-error-boundary.jsx`、`51-screen-settings.jsx`・`52-screen-missions.jsx`・`53-screen-gift-box.jsx`・`54-screen-item-inventory.jsx`・`55-screen-breeder-market.jsx`・`56-screen-profile.jsx`・`57-screen-monster-dex.jsx`・`58-screen-rhythm.jsx`(切り出した画面。STEP 6-2 から1つずつ増える)、`60-app.jsx`(MonsterHeroGame)、`70-bootstrap.jsx`(CSS 注入と createRoot)。
>
> | 部品 | 役割 |
> | --- | --- |
> | `10-core.jsx` | 共有層の土台。React フック・SVG アイコン・wait・バトル速度・XP/ゴールド表・バトルモード・モード別報酬 |
> | `11-masu-progression.jsx` | マスモン育成の純関数。レベル・絆・限界突破・超越・固有技継承・合体・寄付・再生・血統・総合力・一度きり移行と診断 |
> | `12-training.jsx` | 修行(TRAINING。未公開)の定義 |
> | `13-bgm-and-rhythm-settings.jsx` | BGM 一覧、音ゲー設定・BEST の既定値と正規化、BGM アレンジの正規化と既定曲の一度きり移行 |
> | `14-audio.jsx` | Audio_(BGM・ジングル・SE・AudioContext の復帰。音の唯一の入口) |
> | `15-dye-and-art.jsx` | 染色(色ID・領域マスク解析・再着色・キャッシュ)、模様、モンスターの絵とアイコンの部品 |
> | `16-ranking-detail-and-widgets.jsx` | ランキング詳細形式(RANKING_DETAIL_VERSION)、合体履歴、★・オーラなどの小部品、色ピッカー、音量スライダー |
> | `17-release-changelog-login-missions.jsx` | 公開フラグ、更新履歴の整形、一覧設定の正規化、ログインボーナス、助手の親密度、補償ギフト、キャンペーン、プレイ時間、ミッション定義 |
> | `18-points-and-auto.jsx` | 強化ポイントの補填と補正、AUTO 設定と自動ターン選択 |
> | `19-difficulties-and-rules.jsx` | スキップチケット、ヘルプ目次、難易度(通常・極限・クイック・種族チャレンジ)、極限の特別ルール、トレーニングの選択肢、極限モードの解放 |
> | `20-market-notices-help.jsx` | マーケット部品、画像先読みキュー、チュートリアル・更新通知の保存キー、ヘルプの実データ表 |
> | `21-assistant.jsx` | 助手(みゅあ・きき・ももすけ)の文脈と吹き出し AssistantBubble、QuickStepScreen |
> | `22-enemy-and-bond-entries.jsx` | 難易度の見た目、敵の行動選択と生成、絆ランキングの集計、教えの演出スタイル |
> | `23-rpg-debug.jsx` | ダンジョン RPG 戦闘テスト(デバッグ専用の別エンジン) |
> | `24-battle-fx.jsx` | エイキの桜・パンドラの雷などバトル演出の部品 |
> | `25-storage.jsx` | 保存層(storeGet / storeSet / storeList / setStorageWriteBlocked)と音ゲー保存の薄い関数 |
> | `26-supabase.jsx` | 全国ランキング(Supabase REST)。難易度キー、取得、送信、絆Lv、周回ID |
> | `27-result-widgets.jsx` | リザルト部品(LevelGrowthBar・CountUpNumber・RewardSummaryCard)、起動ゲージ連携、染色マスクの手動エディタ、長押しボタン |
> | `28-rhythm-shared.jsx` | 音ゲーの共有部品: 表示時間の定数、入力キー、ノーツ速度、画面回転・静音、タイミング調整 |
> | `29-rhythm-screens.jsx` | 音ゲーのオプション画面・曲えらび・マスモン枠(演奏画面以外) |
> | `30-rhythm-play.jsx` | 音ゲーの演奏画面 RhythmTapTest(rAF 1本・判定・描画)と振動・サイドの応援。タイミング基盤は触らない |
> | `40-screen-effects.jsx` | 画面ライフサイクル。タイマー・リスナーの登録簿 useScreenEffects(画面専用は画面を離れたら止め、進行は止めない) |
> | `50-error-boundary.jsx` | 画面のエラー境界 MhErrorBoundary と、デバッグ用にわざと例外を投げる部品 |
> | `51-screen-settings.jsx` | 画面: 設定(SETTINGS)。MonsterHeroGame から切り出した1画面目。2026-09-10 の STEP 6-2 |
> | `52-screen-missions.jsx` | 画面: ミッション(MISSIONS)。受け取りは MonsterHeroGame 側に残し props で受ける。2026-09-10 の STEP 6-3 |
> | `53-screen-gift-box.jsx` | 画面: ギフトボックス(GIFT_BOX)。受け取りは MonsterHeroGame 側に残し props で受ける。2026-09-10 の STEP 6-4 |
> | `54-screen-item-inventory.jsx` | 画面: アイテム(ITEM_INVENTORY)。戻り先はプロフィール。2026-09-10 の STEP 6-5 |
> | `55-screen-breeder-market.jsx` | 画面: マーケット(BREEDER_MARKET)。購入と交換は MonsterHeroGame 側に残し props で受ける。2026-09-10 の STEP 6-6 |
> | `56-screen-profile.jsx` | 画面: プロフィール(PROFILE)。記録の置き場。props 38 個。2026-09-10 の STEP 6-7 |
> | `57-screen-monster-dex.jsx` | 画面: モンスター図鑑(MONSTER_DEX / _DETAIL / MONSTER_ATTACK_PREVIEW)。3画面で1ファイル。2026-09-10 の STEP 6-8 |
> | `58-screen-rhythm.jsx` | 画面: モンヒロビート(曲えらび・案内・マスモン枠・全国ランキング・入口)。演奏画面は触らない。2026-09-10 の STEP 6-10 |
> | `60-app.jsx` | MonsterHeroGame 本体(全 state・ロジック・各 gameState の JSX) |
> | `70-bootstrap.jsx` | CSS 文字列の注入(createAnimationStyle)、ReactDOM.createRoot、HTML ローディングの非表示 |
> 下表の行番号は連結後の `game-system.jsx` で見るときの目安(ヘッダと目印の行ぶん、数行ずれる)。

ファイルは大きく「共有層(1〜10,358行)」「`MonsterHeroGame`(10,359〜25,082行)」「CSS注入と createRoot(〜25,638行)」の3層。

| 行 | 内容 | 主な定義 |
| --- | --- | --- |
| 1〜70 | SVGアイコン、`wait`、`BATTLE_SPEEDS`、`BUILD_DATE` | `_icon`, `wait`, `normalizeBattleSpeed` |
| 74〜370 | XP/ゴールド表、バトルモード(チャレンジ/クイック/プロ/種族)、モード別報酬 | `BATTLE_MODES`, `modeKeyPrefix`, `bestScoreKey` |
| 370〜2,460 | レベル・絆・限界突破・超越・転生・固有技継承・合体・寄付・再生(マスモン育成の純関数群) | `levelInfo`, `bondLevelInfo`, `normalizeMasuProgression`, `mergeMasuIntoMon`, `buildMasu*`, `migrate*`, `diagnose*` |
| 2,425〜2,458 | 修行(TRAINING) | `TRAINING_*`, `settleTrainingRewards` |
| 2,458〜2,734 | BGM一覧、音ゲー設定の既定値・正規化、BGMアレンジ移行 | `BGM_TRACKS`, `normalizeRhythmSettings`, `normalizeBgmArrangement`, `migrate*BgmDefaults` |
| 2,734〜3,096 | **`Audio_`**(IIFE。BGM/ジングル/SE/AudioContext 復帰) | `playBGM`, `startRhythmTrack`, `se.*`, `unlock`, `setPageHidden` |
| 3,096〜4,420 | 染色(色ID、領域マスク解析、再着色、キャッシュ)、模様、画像フレーム部品 | `getDyeRegionMasks`, `getRecoloredImage`, `DyedMonsterImage`, `MonsterArtFrame` |
| 4,428〜4,600 | ランキング詳細形式(`RANKING_DETAIL_VERSION`) | `rankingMasuDetail`, `rankingDetailToMasu` |
| 4,600〜4,830 | 小部品(バッジ・オーラ・色ピッカー・音量スライダー) | `HomeWalkingMasumon`, `VolumeSlider` |
| 4,841〜5,420 | 公開フラグ、更新履歴の整形、ログインボーナス、助手の親密度、補償ギフト、プレイ時間、ミッション定義 | `RELEASE_FLAGS`, `LOGIN_BONUS_REWARDS`, `MISSION_DEFS`, `normalizeMissions` |
| 5,420〜5,660 | 強化ポイント補正、AUTO設定と自動ターン選択 | `repairEnhancePointBandOvergrant`, `chooseAutoTurn` |
| 5,657〜6,410 | 難易度(通常/極限/クイック/種族チャレンジ)、極限の特別ルール計算、修行の選択肢 | `DIFFICULTY_SETTINGS`, `EXTREME_*`, `SPECIES_CHALLENGE_*`, `extremeDamageTurnMultiplier` |
| 6,404〜6,660 | マーケット部品、画像先読みキュー、チュートリアル/通知の保存キー | `imagePreloadQueue`, `UPDATE_NOTICE_SEEN_KEY` |
| 6,654〜7,050 | ヘルプの実データ表、助手コンテキストと吹き出し | `helpDataRows`, `AssistantBubble` |
| 7,050〜7,246 | 敵の行動選択、敵生成、絆ランキング集計 | `chooseEnemyAction`, `createBattleEnemy` |
| 7,269〜7,742 | **RPGデバッグ戦闘**(本編とは別の簡易エンジン。入口は DEBUG_SETTINGS のみ) | `rpg*` |
| 7,780〜7,857 | **保存層** | `storeGet`, `storeSet`, `storeList`, `setStorageWriteBlocked` |
| 7,857〜8,456 | **Supabase ランキング**(REST) | `sbFetchRankings`, `sbInsertScore`, `persistRankingScore`, `sbInsertRhythmScore` |
| 8,457〜9,050 | リザルト部品、起動ゲージ連携、音ゲーの画面回転・静音・タイミング調整 | `RewardSummaryCard`, `applyScreenOrientation`, `RhythmTimingCalibrator` |
| 9,051〜9,808 | 音ゲーのオプション画面・曲選択・マスモン枠 | `RhythmOptions`, `RhythmSongSelect`, `RhythmMonsterSlotsPanel` |
| 9,809〜10,358 | **`RhythmTapTest`**(音ゲー演奏画面。549行。rAF 1本、判定、描画) | – |
| 10,359〜18,880 | **`MonsterHeroGame` ロジック部**(8,522行) | 下表 |
| 18,881〜25,082 | **`MonsterHeroGame` JSX 部**(6,201行。`return (` 以降に全画面を `gameState==='X'&&` で並べる) | – |
| 25,082〜25,628 | `createAnimationStyle`(CSS文字列 547行を `<style>` として注入) | – |
| 25,628〜 | `ReactDOM.createRoot(...).render(<MonsterHeroGame/>)`、HTMLローディング非表示 | – |

`MonsterHeroGame` の中身(抜粋。数値は 10,359〜25,082 行内の実測):

| 項目 | 実測 |
| --- | ---: |
| `useState` | 417 |
| `useRef` | 113 |
| `useEffect` | 72 |
| `useCallback` / `useMemo` | 26 / 19 |
| 内側で定義している関数・値 | 584(うち関数 348) |
| `setTimeout` / `clearTimeout` | 58 / 13 |
| 最大の内側ブロック | 起動ロード用 `useEffect` 約424行(12,781〜13,205)、`processTurn` 379行(16,608〜)、`loadRankings` 298行、`handleEnemyTurn` 162行 |

内部の主な塊(行はおおよそ): 10,360〜11,900 state 宣言と派生値 / 11,900〜12,730 ランキング読込・BGM 対応表 / 12,730〜13,220 起動・保存読込・移行 /
13,220〜13,660 スコア送信・バックアップ / 13,660〜15,300 マーケット・編成・マスモン育成・報酬 / 15,300〜16,100 カード操作・スキップ・プレビュー /
16,084〜17,120 ダメージ・敵ターン・`processTurn`・WAVE進行 / 17,120〜18,880 バトル初期化・チュートリアル・モーダル描画関数。

`RhythmTapTest`(9,809〜10,358)の内部はインデントが崩れており、`travelCacheRef` 以降の `const` が列0から始まるため
「トップレベル定義」に見えるが、すべて同コンポーネントの内側である(`grep '^const'` で探すとき注意)。

## 4. 画面遷移

- 状態は `const [gameState, setGameState] = useState('HOME')`(10,360行)の文字列1本。起動段階は別に `bootPhase`(`TITLE` → `ENTRY_READY` → `ENTERING_GAME` → `GAME`)。
- `setGameState('X')` の出現は 74 種。うち 13 種が `*_DEBUG` / `DEBUG_SETTINGS` / `RPG_DEBUG_*`。
- 描画は `return (` 以降に `{gameState==='X'&&(...)}` を並べる方式。画面ごとのマウント/アンマウントの単位はこの条件式で決まる。
- 戻り先は個別 state で持つ(`masuEnhanceFrom`, `battleTutorialReturn`, `NOTICE_DESTINATIONS` など)。ルーターや履歴スタックは無い。
- 画面追加時は `data/help.js` の `HELP_SCREEN_COVERAGE` にも登録が必要(`help-coverage-check.js` が検査)。

主な系統:

| 系統 | gameState |
| --- | --- |
| ホーム・プロフィール | `HOME`, `PROFILE`, `SETTINGS`, `ASSISTANT_SELECT`, `MISSIONS`, `GIFT_BOX`, `ITEM_INVENTORY`, `BREEDER_MARKET`, `PASTURE_SETTINGS` |
| バトル入口 | `BATTLE_MENU`(旧), `BATTLE_MODE_SELECT`, `BATTLE_DIFFICULTY_SELECT`, `EXTREME_DIFFICULTY_SELECT`, `SPECIES_CHALLENGE_SELECT`, `BATTLE_SCORE_RANKING` |
| ラン準備 | `PICK_HERO`, `PICK_SLOT`, `PICK_ALLY`, `PICK_PRO_ALLIES`, `PICK_TEACHING`, `QUICK_GROWTH`, `QUICK_JOIN`, `SKIP_PICK`, `SKIP_RESULT` |
| 戦闘 | `BATTLE`, `WAVE_RESULT`, `REWARD_PICK`, `UPGRADE_SKILL`, `CHAMPION` |
| モンスター管理 | `MB_MANAGEMENT`, `MONSTER_LIST_MENU`, `ROSTER`, `OWNED_MONSTERS`, `MASU_MONS`, `MONSTER_DEX(_DETAIL)`, `AUTO_SETTINGS` |
| マスモン育成 | `MASU_ENHANCE`, `MASU_FUSION`, `MASU_REBIRTH`, `MASU_REINCARNATE`, `MASU_TRANSCENDENCE`, `MASU_TRANSCEND_ENHANCE`, `MASU_REGENERATION(_DETAIL)`, `MASU_DONATION`, `TEMPLE` |
| 修行(未公開) | `TRAINING_INFO/SELECT/DIFFICULTY/CONFIRM/BOARD/RESULT` |
| 音ゲー | `RHYTHM_DEMO_HOME`, `RHYTHM_DEMO_MONSTERS`, `RHYTHM_DEMO_HELP`, `RHYTHM_INFO`, `RHYTHM_OPTIONS`, `RHYTHM_PLAY`, `RHYTHM_RANKING`, `RHYTHM_DEBUG` |
| デバッグ | `DEBUG_SETTINGS`, `RPG_DEBUG_SETUP/BATTLE/RESULT`, `MASU_PATTERN_DEBUG`, `MONSTER_IMAGE_DEBUG`, `DYE_MASK_POSITION_DEBUG`, `BREAKTHROUGH_STAR_DEBUG`, `REINCARNATE_DISPLAY_DEBUG`, `TRANSCEND_DEBUG`, `SPECIES_CHALLENGE_DEBUG`, `BREEDER_ICON_DEBUG` |

## 5. 状態管理

- ルート1コンポーネントに 417 個の `useState`。永続データ(`masuMons`, `ownedItems`, `gold`, `missions` …)、ラン中データ(手札・山札・HP・バフ)、
  UI一時状態(モーダル開閉・選択中ID・アニメ段階)が同じ階層に並ぶ。
- 派生値は `useMemo` 19 個と、毎描画で計算する素の式が混在。
- どの state 更新でも `MonsterHeroGame` 全体が再描画される(子コンポーネントは 43 個あるが `React.memo` は 0)。
- 二重実行防止は個別の `useRef` ロック(`processTurn` の実行ロック、`bootTapPending`、`gutsRecoveryLockRef` など)で行う。共通の仕組みは無い。
- アンマウント/画面遷移後の非同期完了を止める仕組みは、`let cancelled`/`mountedRef` 系が 42 箇所に個別実装。

## 6. データ管理

`data/*.js` は ES module ではなく classic script で、トップレベル `const` をグローバルとして本体から参照する。読み込み順は `index.html` が決める。

| ファイル | 公開しているグローバル(抜粋) | 性質 |
| --- | --- | --- |
| `ally-monsters.js` | `ALL_PLAYER_MONSTERS`, `HERO_ATK_NAMES`, `STARTER_MONSTER_IDS` | 純データ |
| `enemy-monsters.js` | `ENEMY_DATA`, `ENEMY_SEQUENCE` | 純データ |
| `skills.js` | `BASE_ATK_EVOLUTION`, `GUARD_EVOLUTION`, `RANGE_EVOLUTION`, `TYPE_COLORS` | 純データ |
| `lineages.js` | `MONSTER_LINEAGES`, `MONSTER_CATEGORIES`, `MONSTER_DEX_DESCRIPTIONS` | 純データ |
| `breeder.js` | `TEACHING_CARDS`, `BREEDER_MARKET_ITEMS`, `SKIP_TICKET_BY_DIFFICULTY`, 各種アイコン定数, `normalizeTeachingRoster` | データ + 正規化関数1つ |
| `assistants.js` | `ASSISTANTS`, `ASSISTANT_SCENES`, `addAssistantLinePack`, `pickAssistantLine`, `assistantUpdateNoticeFromChangelog`, チュートリアル台本 | データ + 選択ロジック |
| `help.js` | `HELP_CATEGORIES`, `HELP_SCREEN_COVERAGE`, `helpFindTopic` | データ + 検索 |
| `changelog.js` | `CHANGELOG` | 純データ(551件) |
| `rhythm-mode.js` | `RHYTHM_*` 定数、`rhythm*` 純関数、`RHYTHM_SONG_ENTRIES`(18曲。うちデバッグ用テスト曲を含む)、`RHYTHM_GESTURE_RUNTIME` ほか | データ + 純関数 + **ランタイム(後述)** |
| `rhythm-timing.js` | `RHYTHM_TIMING_DATA`, `rhythmSnapTimeToGrid` | データ + 関数 |

一方、次のゲームデータは `game-system.jsx` 側にある: `BATTLE_MODES`、`DIFFICULTY_SETTINGS`/極限/クイック/種族チャレンジの難易度、`BGM_TRACKS`、
`LOGIN_BONUS_REWARDS`、`MISSION_DEFS`、`COMPENSATION_GIFTS`、`TRAINING_*`、XP曲線、限界突破・超越の各定数。

## 7. セーブ管理

- 入口は `storeGet` / `storeSet` / `storeList`(7,790〜7,857行)。`window.storage` → `localStorage` → `_memStore` の順に落ちる。
  `storeSet` は失敗を握りつぶす。`setStorageWriteBlocked` で「初回プレビュー中は一切保存しない」を実現している(★意図的)。
- `localStorage` を直接触る箇所: `mh_player_id`(10,682)、`mh_ranking_debug`(7,994)、バックアップの書き出し/復元(13,555〜13,644)、`data/mhsave-backup.js`。
- 保存キーは `mh_*` 約 90 種(固定キー + `mh_hs_<難易度>` 等の動的キー)。一覧と互換ルールは `docs/spec/SAVE_DATA.md`。
- 起動時の読み込みは `MonsterHeroGame` 内の1本の `useEffect`(12,781〜13,205、約424行)に集中し、読込 → 正規化 → 一度きり移行 → 補償 → state 反映を直列に行う。
- 書き込みは操作単位で即時。同じキーを書く場所が分散している(`mh_masu_mons` 35 箇所、`mh_owned_items` 19、`mh_gold` 13、`mh_gifts` 4)。
  `setMasuMons(...)` と `storeSet('mh_masu_mons', ...)` を呼び出し側が毎回対で書く。
- 移行フラグ(`mh_*_migrated_v1` 等)による一度きり処理が 10 種以上。`diagnose*` 系はドライラン診断で保存しない。
- バックアップは `mh_` 全キーの生文字列を Base64 化。復元は含まれるキーだけ上書き。

## 8. バトル処理

ラン中の状態は `MonsterHeroGame` の state(HP・ガッツ・距離 `slots`・手札・山札・`waveBuffs`/`permaBuffs`/`turnBuffs`/`nextTurnBuffs` …)。

| 概念 | 実装 |
| --- | --- |
| 与ダメージ(実) | `processTurn`(16,608〜16,987)内で `getDmg(...)` → 会心ロール → 連撃 `rollCombo` → `attackHits` 蓄積 |
| 与ダメージ(予測表示) | `getAttackPredictedDmg` は 2026-09-06 から実処理と同じ `buildAttackHits`(`22-enemy-and-bond-entries.jsx`)を `rollCrit: () => false` で呼ぶ。分岐の倍率は `ATTACK_COMBO_RULES` の 1 表 |
| 被ダメージ | `getIncomingDamageBeforeTurnReduction` → `applyTurnDamageReduction` → `getPredictedDamage`。実処理(`handleEnemyTurn`)と予測が同じ関数を通る(こちらは一本化済み) |
| 敵AI | `chooseEnemyAction` / `evaluateEnemyActions`(7,074〜7,138) |
| 極限ルール | `extreme*` / `ultimate*` / `god*` の純関数群(6,003〜6,260) |
| AUTO | `chooseAutoTurn`(5,559)を `processTurn` 付近(16,988)から使用 |
| ターン進行 | `processTurn` は async で 17 回 `await`(演出待ち)。中断は個別の実行ロックで防ぐ |

勇者・モンスター固有の挙動は `mainHero?.id==='Zan'` のような文字列分岐として `processTurn` と予測関数の両方に散在する(23 箇所 + 5 箇所)。

## 9. 音声

- `Audio_`(2,734〜3,096)が唯一の音の入口。`AudioContext` 1 つ、BGM/ジングルは `fetch`+`decodeAudioData` → `AudioBufferSourceNode`、SE は Tone.js(CDN、SRI なし = KI-009)。
- ユーザー操作での `resume()` は `pointerdown/touchstart/click/keydown` に一度だけ束ね、`setPageHidden` で裏面時に止める。
- 音ゲーは `startRhythmTrack` が返すハンドルで `ctx.currentTime` 基準の曲時刻を得る(**現在正常に動いている基盤。触らない**)。
- `rhythm-mode.js` の `RHYTHM_NOTE_SE_RUNTIME` はノーツSEを別系統(直接 OscillatorNode)で鳴らす。

## 10. ランキング(Supabase)

- `SUPABASE_URL` / publishable key はソース埋め込み。`fetch` 直呼びが 6 箇所(取得3・送信2・絆Lv 1)。
- 送信は `persistRankingScore` の単一経路で `clear_id` による冪等化。失敗時は `mh_rank_<難易度>` へ端末内フォールバック。
- 音ゲーは `sbInsertRhythmScore` / `sbFetchRhythmRankings` と `mh_rhythm_rank_pending_v1`(送信待ち)を持つ別経路。
- テーブル定義の正本は `supabase/migrations/`、手順は `docs/sql/`。RLS は未確認(KI-010)。

## 11. その他の機能の所在

| 機能 | 所在 |
| --- | --- |
| ミッション | 定義 5,282〜5,400、保存 `mh_missions`、達成加算は各所から `bumpMission` 相当の更新 |
| ログインボーナス・補償・キャンペーン | 4,929〜5,180(`grantLoginBonus`, `grantCompensationGifts`, `grantNewPlayerCampaignGift`) |
| プロフィール・バックアップ | JSX `PROFILE`、13,540〜13,660 |
| ショップ(マーケット) | 商品定義 `data/breeder.js`、購入 `buildMarketItemPurchase`(1,062)、画面 `BREEDER_MARKET` |
| モンスター管理・図鑑 | 1,416〜1,470(血統)、JSX `MASU_MONS`/`MONSTER_DEX` |
| アシストカード(教え) | `TEACHING_CARDS`(data)、効果適用は `processTurn` 内分岐 |
| 助手 | `data/assistants.js` + `AssistantBubble`(6,926)、親密度 4,977〜5,040 |
| 更新通知 | `availableUpdateNotices`(6,615)、`RELEASE_FLAGS`(4,842) |
| イベント(季節・キャンペーン) | 助手セリフの `when`、`NEW_PLAYER_CAMPAIGN_*`、BGM `EVENT_BGM_SCENES` |
| デバッグ | `DEBUG_SETTINGS` 配下 13 画面、`RPG_DEBUG_*` エンジン、`mh_ranking_debug`、`RHYTHM_PERF`(性能計測) |

## 12. 音ゲー(モンヒロビート)

構成は3層に分かれる。

1. **純関数・定数・譜面**: `data/rhythm-mode.js`。判定窓、スコア、ライフ、投影(レーン座標)、SLIDE/HOLD の幅、モンスターノーツ能力、
   曲一覧 `RHYTHM_SONG_ENTRIES`(18 エントリ。公開曲 7 + テスト曲)。譜面はコード内の `t()/h()/f()/s()` 呼び出しの配列として 5,916 行。
2. **演奏画面**: `RhythmTapTest`(jsx 9,809〜10,358)。`requestAnimationFrame` 1 本の `scheduleTick`、`Audio_.startRhythmTrack` の曲時刻、
   `getBoundingClientRect` のキャッシュ(`travelCacheRef`)、判定・スコア・ライフ・能力・リザルト。オプション/曲選択/マスモン枠は別コンポーネント。
3. **ランタイムパッチ**(data 配下だが実行時に副作用を持つ):

| ファイル | やっていること | 常駐範囲 |
| --- | --- | --- |
| `rhythm-mode.js` `RHYTHM_GESTURE_RUNTIME`(944〜1,214) | `document` に capture の touch/pointer/click リスナーを登録し、指の位置を追跡 | ページ全体・解除なし |
| `rhythm-mode.js` `RHYTHM_TOUCH_SPAN_RUNTIME`(1,222〜1,368) | 同上(接触半径) | 同上 |
| `rhythm-mode.js` `installRhythmGestureVisuals`(7,910) | `MutationObserver(document.body, subtree)` で `[data-rhythm-note]` の出現を監視し装飾 | 同上(早期 return あり) |
| `rhythm-mode.js` `installRhythmPerspectiveNoteVisuals`(8,539) | `MutationObserver(body)` + `ResizeObserver` でプレイエリアを再レイアウト | 同上 |
| `rhythm-mode.js` `installRhythmAuthoringLoader`(8,609) | 譜面制作UIの遅延読込 | 同上 |
| `rhythm-lane-svg.js` | `MutationObserver` でレーン SVG を重ねる(DEBUG ONLY と明記) | 同上 |
| `rhythm-result-replay-remount.js` | **`React.createElement` を上書き**し、`RhythmTapTest` を `key` 更新で完全再マウントする境界に差し替える。`document` に touchend/click の capture リスナー | 全 createElement 呼び出しを経由 |
| `rhythm-geometry-calibration.js` / `rhythm-step3-release.js` | **`window.fetch` を上書き**し、`version.json` の応答を data 側 build で書き換える(データだけの出荷でも更新バナーを出すため)。`MutationObserver` で校正ガイドを差し込む | 全 fetch を経由 |
| `rhythm-authoring.js` | `MutationObserver` で制作パネルをマウント | 同上 |

これらは「モバイルからは `game-system.compiled.js` を再生成できない」制約の下で、data/*.js だけの変更で挙動を足すために積み上がったもの
(`build-and-check.yml` の導入で制約自体は緩和済み)。理由が明確なので**無断で外さない**。ただし本体側へ吸収できる候補として
`TECH_DEBT_AUDIT.md` TD-03 / TD-09 に記録した。

## 13. 描画・入力・タイマー(全体の数)

| 項目 | jsx 全体 | 備考 |
| --- | ---: | --- |
| `setTimeout` / `clearTimeout` | 120 / 36 | `wait(ms)` 経由の演出待ちを含む |
| `setInterval` / `clearInterval` | 4 / 5 | プレイ時間・更新検知 |
| `requestAnimationFrame` / `cancel…` | 19 / 13 | 音ゲー 3、カウントアップ演出、ドラッグ |
| `addEventListener` / `removeEventListener` | 31 / 28 | ほぼ対になっている(差分は同一行の複数登録) |
| `getBoundingClientRect` | 17 | 音ゲー 5(キャッシュ済み)、レイアウト計測 |
| `style={{…}}` | 522 | 毎描画で新オブジェクト |
| `key={i}` 系 | 37 | 並べ替えが起きる一覧では注意 |
| `new Image()` | 5 | 先読みキュー(同時 2 本)・染色 |
| 染色キャッシュ | `_dyeRecolorCache`(dataURL の Promise)、`_dyeRegionMaskCache` | 上限・破棄なし |
| エラー境界 | `MhErrorBoundary` 2 段(2026-09-06 追加) | ルート直下(読み込み直しのみ)と `MonsterHeroGame` の中(`gameState` が変わればエラーを捨て、「ホームへ戻る」で `returnToHome`) |

CSS は `index.html` の `<style>` 617 行(起動画面・Tailwind が来る前の最低限の形)と、本体が注入する `createAnimationStyle` 547 行の2系統。
それ以外は Tailwind ユーティリティ(CDN)。

## 14. 検査基盤

| 種類 | 本数 | 中身 |
| --- | ---: | --- |
| CI(`compiled-check.yml`) | 28 | `build.js --check`、`compiled-runtime-check`、構文・参照・起動経路・version、`data-cache-key-check`、音ゲー 21 本 |
| CLAUDE.md の必須(手動) | 5 + 5 | `build/check-syntax/undefined-reference/jsx-text-brace/render-error` と ヘルプ・助手系 5 本 |
| `tools/` 全体 | 385(検査 326) | `mode/` 160、`masu/` 36、`image/` 31、`battle/` 29、`ranking/` 23、`run/` 19、`boot/` 17、`audio/` 17、`monster/` 12、`assistant/` 6、`browser/` 3 |
| 実行方式 | – | Babel+vm スタブ(`harness.js`、`EXPORTED_NAMES` 138 個)193 本 / Playwright 実ブラウザ 58 本 / ソース文字列の静的検査 84 本 |

CI に入っていない検査(約 300 本)は、担当者が変更範囲を見て手で選ぶ。全部を一括で回す入口は無い。
2026-09-05 時点のベースライン: CI 相当 + CLAUDE.md 必須 + ヘルプ・助手・画像の各検査は**全件 OK**(`assistant-bond-check` も OK。KI-008 は解消済みの可能性が高い)。

## 15. モジュール間の依存(実体はすべてグローバル)

```text
index.html(読み込み順が依存の正本)
  data/images-*  →  data/ally-monsters → lineages → breeder → enemy → skills
        ↓                   ↓
  data/rhythm-mode ─ rhythm-lane-svg ─ rhythm-geometry-calibration ─ rhythm-result-replay-remount
        ↓            (React / window.fetch / document を実行時に加工)
  data/changelog → help → mhsave-backup → rhythm-step3-release → assistants
        ↓
  game-system.compiled.js  (上記すべてのグローバルを参照。逆方向の参照は無い)
        ├─ 共有層の純関数 ← MonsterHeroGame / RhythmTapTest / 各部品
        ├─ Audio_ ← MonsterHeroGame, RhythmTapTest, RhythmOptions
        ├─ storeGet/Set ← MonsterHeroGame と一部のトップレベル関数(species 報酬など)
        └─ Supabase ← MonsterHeroGame(loadRankings / submit*)
tools/harness.js → game-system.jsx を Babel で変換し、EXPORTED_NAMES を vm で取り出す(検査の依存)
```

循環依存は無い(data → 本体の一方向)。ただし **本体の識別子名そのものに依存する外部物**が3つある:
`rhythm-result-replay-remount.js`(`type.name==='RhythmTapTest'`)、`tools/harness.js`(`EXPORTED_NAMES`)、静的検査 84 本(文言・識別子を正規表現で探す)。
リネームや分割はこれらを同時に壊す。

## 16. actual / spec の差(記録のみ。どちらへ寄せるかは未決定)

| # | 項目 | spec(文書) | actual(コード) |
| --- | --- | --- | --- |
| D-01 | 入口画面 | `UI_RULES.md` §3 は `TITLE` を `gameState` として記載 | `gameState` の初期値は `HOME`。タイトルは `bootPhase==='TITLE'` |
| D-02 | AUTO 設定 | `UI_RULES.md` §3「戦闘処理とは未接続」 | `chooseAutoTurn` を 16,988 行で戦闘から使用(接続済み) |
| D-03 | 本体の規模 | `PROJECT_STRUCTURE.md` §4「16,000行を超える」、§5「tools は 162 本」 | 25,638 行、385 本 |
| D-04 | KI-008 | `KNOWN_ISSUES.md` は `assistant-bond-check` が GOD で NG と記載 | 2026-09-05 の実行では全件 OK |
| D-05 | 画面一覧 | `UI_RULES.md` §3 は 15 系統のみ | 実際は 74 種(音ゲー・種族・修行・デバッグを含む) |
| D-06 | 音ゲーの正本 | `RHYTHM_MODE.md`(4,522行)に「確定・未実装」項目が多数 | 実装済み範囲は `RHYTHM_FUTURE_IMPLEMENTATION_PLAN.md` の見出しに「実装済み」印。両文書の対応表は無い |
| D-07 | 未使用の配信物 | – | `data/images/title-screen-clean.PNG`(2.6MB)はどこからも参照されていなかった。**2026-09-06 に削除済み**。`data/images/` は `image-asset-check` の対象外ディレクトリ(検査の穴として残る) |
| D-08 | `game-v4.html` | `PROJECT_STRUCTURE.md` は互換入口として維持と記載 | 同じ(差なし。参考) |

D-01〜D-05 は文書側の更新で解消できる見込み(STEP 0 に含める)。D-07 はユーザー確認のうえ 2026-09-06 に削除した。
