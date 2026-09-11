# セーブデータ設計書

## 1. 保存層

`storeGet` / `storeSet` が保存の唯一の共通入口である。優先順位は次のとおり。

1. `window.storage` があれば JSON 文字列で読み書きする。
2. なければブラウザ `localStorage` を使う。
3. どちらも使えなければ `_memStore` に保存する。この場合は再読み込みで消える。

全呼び出しは `shared=false` であり、共有ストレージ利用は現行コードにない。書き込み失敗は基本的に握りつぶされ、利用者へ永続化失敗を通知する仕組みは**未確認**。

## 2. キー一覧

| キー | 値・既定値 | 用途 |
| --- | --- | --- |
| `mh_se_volume` | number / `1` | SE音量0～100 |
| `mh_bgm_volume` | number / `1` | BGM音量0～100 |
| `mh_bgm_arrangement` | object / 既定の組み合わせ | 場面ごとに選んだBGMのtrack ID。読み込み時に正規化し、知らない項目・不正なIDは既定値で補う |
| `mh_breeder_name` | string / `名無しのブリーダー` | 表示名（保存時最大10文字） |
| `mh_breeder_icon` | string or null | 種IDまたは購入アイコンID |
| `mh_breeder_xp` | number / `0` | 累計ブリーダーXP |
| `mh_gold` | number / `0` | ゴールド（UI上のダイヤ表記を含む） |
| `mh_breeder_points` | number / `0` | 未使用マーケットポイント |
| `mh_breeder_points_granted` | number or null | 累計付与済み相当数 |
| `mh_breeder_id_v1` | string or null | 端末ごとに1回だけ作るブリーダーID。全国ランキングで同名の別人を見分けるために送る(名前を変えても変わらない。`docs/spec/RHYTHM_RANKING.md` §4) |
| `mh_market_icons` | string[] / `[]` | 購入アイコンID |
| `mh_owned_items` | object / `{}` | 消耗品ID→個数 |
| `mh_missions` | object / 期間ごとの既定値 | デイリー・ウィークリー・マンスリーの進捗、期間ID、ギフト送付済みID。旧データの欠損項目は読み込み時に補う |
| `mh_unlocked_monsters` | string[] / 初期8種 | 解放済み種ID |
| `mh_monster_roster` | string[] / 解放済み一覧 | 候補編成。種IDまたは `masu:<id>` |
| `mh_auto_settings_v1` | object / `{strategy:'random', allies:[{rosterEntry:null,slot:null} × 3], breakthroughReserve:{gold:0,psyche:0}, quickRun:{heroRosterEntry:null,distance:null,difficulty:null,autoStart:false}}` | AUTO用の事前設定。方針・供モン・クイック周回設定に加え、AUTO∞自動限界突破で最低限残すダイヤ/虹のプシュケーを `breakthroughReserve` に保存する。`quickRun.autoStart` は「モンヒロビートを開いたら自動で∞周回を始めるか」（既定 `false`。項目の無い既存データ・壊れた値は `false` へ倒す）。欠損・不正値は0へ正規化し、0は保護なし |
| `mh_unlocked_teachings` | string[] / 初期6枚 | 解放済み教えID |
| `mh_teaching_roster` | string[] / 解放済み一覧 | 教え候補編成 |
| `mh_masu_mons` | object[] / `[]` | マスモン個体一覧。AUTO∞自動限界突破は個体ごとに `autoRepeatBreakthroughMode`（`off` / `fixed` / `follow`）と既存の `autoRepeatBreakthroughLevel` を持つ。旧データで数値Lvがあれば `fixed` として保持する。旧仕様で保存できたLv405以上の5刻み値は、通常限界突破の実上限と同じLv400へ丸めて意味を保つ。旧boolean・欠損・不正値はOFFへ落とす。`uniqueSkillPoints`（未使用の固有技ポイント）など後から足した項目も既定値へ正規化する |
| `mh_changelog_seen` | string / `''` | 最後に既読にした更新日時 |
| `mh_onboarded` | boolean or null | 初回プロフィール誘導完了 |
| `mh_kiki_intro_seen_v1` | boolean / `false` | きき加入の会話を見たか。既存プレイヤーへ1回だけ流すための判定に使う |
| `mh_momosuke_intro_seen_v1` | boolean / `false` | ももすけ登場の会話を見たか。**これが立っている＝ももすけを助手に選べる**。本編で見ても、プロフィールの回想から先に見ても同じように立つ。新規プレイヤーは助手選択を通る時点で立てる |
| `mh_monhiro_beat_preopen_new_player_campaign_v1` | boolean / `false` | 新規プレイヤーキャンペーンを配布済みか。詳細は第3章 |
| `mh_hs_<難易度>` | number / `0` | 端末ハイスコア（チャレンジ） |
| `mh_attempts_<難易度>` | number / `0` | 挑戦回数 |
| `mh_clears_<難易度>` | number / `0` | 完走回数（チャレンジ） |
| `mh_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（チャレンジ） |
| `mh_quick_hs_<難易度>` | number / `0` | 端末ハイスコア（クイック） |
| `mh_quick_clears_<難易度>` | number / `0` | 完走回数（クイック） |
| `mh_quick_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（クイック） |
| `mh_pro_hs_<難易度>` | number / `0` | 端末ハイスコア（プロ） |
| `mh_pro_clears_<難易度>` | number / `0` | 完走回数（プロ） |
| `mh_pro_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（プロ） |
| `mh_species_challenge_progress_v1` | object / `{version:1,species:{}}` | 種族チャレンジの種族・難易度別クリアと初回報酬受取状況 |
| `mh_rank_<難易度>` | object[] / `[]` | 全国送信失敗時の端末ランキング |

難易度部分は `Beginner`, `Easy`, `Normal`, `Hard`, `Expert`, `Master`, `GrandMaster`, `Hell`, `Legend`。難易度キーは保存・ランキング識別子なので既存名を変更しない。

バトルモードごとの記録は接頭辞で分ける（`modeKeyPrefix`：チャレンジ `mh_`／クイック `mh_quick_`／プロ `mh_pro_`）。モードを増やしても既存キーの意味は変えず、新しい接頭辞のキーを足すだけにする。未プレイのモードのキーは存在しないので、読み込みは既定値 `0` に落ちる。

全国ランキング（Supabase）はテーブルの列を増やさず、`difficulty` へ入れる値でモードを分ける。プロは `ProHard` のように先頭へ `Pro` を付けた値（`rankingDifficultyForMode`）。既存のチャレンジの行（`Hard` など）は書き換えも変換もしない。

種族チャレンジの進行は次の独立した形式で保存する。`cleared` と `firstRewardClaimed` はそれぞれ値が `true` の有効難易度だけを保持し、欠損・不正な値は空の状態へ正規化する。難易度IDの正本は `SPECIES_CHALLENGE_DIFFICULTY_IDS` とし、未知の難易度は破棄する。一方、空でない文字列の未知speciesIdは将来追加される種族との互換性のため保持する。

```js
{
  version: 1,
  species: {
    [speciesId]: {
      cleared: { [difficultyId]: true },
      firstRewardClaimed: { [difficultyId]: true },
    },
  },
}
```

## 2.5 そのほかのキー(設定・既読・記録・音ゲー)

第2章の表に載っていなかったキー。いずれも `storeGet` / `storeSet` 経由(例外は明記)。一覧は `node tools/boot/save-keys-check.js` が
コード中の文字列と突き合わせるので、キーを足したらここへも 1 行足す。

| キー | 値・既定値 | 用途 |
| --- | --- | --- |
| `mh_audio_muted` | boolean / `false` | ミュート状態 |
| `mh_battle_speed_v1` | string | バトル速度(`normalizeBattleSpeed` で既定へ) |
| `mh_login_bonus` | object / `LOGIN_BONUS_DEFAULT` | ログインボーナスの受取状況(期間キーと日数) |
| `mh_playtime_v1` | object | プレイ時間の累計と日別(`normalizePlaytime`) |
| `mh_player_id` | string | ランキング送信に使う端末ID。`localStorage` 直接アクセス(`storeGet` を通さない) |
| `mh_ranking_cache` | object | 全国ランキングの取得結果の控え(表示用。無くても取り直す) |
| `mh_pro_last_party` | object / `EMPTY_PRO_LAST_PARTY` | プロモードで最後に使った編成(`normalizeProLastParty`) |
| `mh_home_pasture_ids` | string[] / `[]` | HOME の牧場に出すマスモンの個体ID(`normalizeHomePastureIds`) |
| `mh_monster_roster_sets_v1` | object | 編成セット(`normalizeMonsterPartySets`)。`mh_monster_roster` は現在のセットの写し |
| `mh_monster_list_settings` | object / `DEFAULT_MONSTER_LIST_SETTINGS` | マスモン一覧の並び・絞り込み |
| `mh_fusion_sort_settings` | object / `DEFAULT_FUSION_SORT_SETTINGS` | 合体画面の並び |
| `mh_donation_sort_settings` | object / `DEFAULT_DONATION_SORT_SETTINGS` | 寄付画面の並び |
| `mh_temple_regeneration_used_v1` | boolean / `false` | 神殿の再生を一度でも使ったか |
| `mh_onboarding_step` | string or null | はじめての設定の途中段階(完了で `null`) |
| `mh_tutorial_seen_v1` | boolean / `false` | 村の案内(チュートリアル)を見たか |
| `mh_battle_tutorial_seen_v1` | boolean / `false` | バトルのれんしゅうを見たか |
| `mh_battle_tutorial_guide_shown_v1` | boolean / `false` | バトルのれんしゅうへの誘導を出したか |
| `mh_rhythm_tutorial_seen_v1` | boolean / `false` | モンビーの練習を見たか |
| `mh_daily_masu_advice_date_v1` | string | 助手の「今日のマスモン助言」を出した日 |
| `mh_seen_update_notices_v1` | string[] / `[]` | 助手の更新告知の既読ID(`normalizeSeenUpdateNoticeIds`) |
| `mh_changelog_seen_ids_<種別>` | string[] | 更新履歴タブごとの既読エントリID(旧 `mh_changelog_seen_<種別>` の日時からは起動時に一度だけ移す) |
| `mh_assistant_selected_v1` | string / 既定の助手 | 選んでいる助手(`normalizeAssistantId`) |
| `mh_assistant_bond_v1` / `mh_assistant_bond_<id>_v1` | object / `ASSISTANT_BOND_EMPTY` | 助手ごとの親密度。みゅあは無印、ほかの助手は `<id>` 付き(`assistantBondKeyFor`) |
| `mh_assistant_call_style` / `mh_assistant_call_style_<id>` | string | 助手の呼び方(さん付けなど)。みゅあは無印(`assistantCallStyleKeyFor`) |
| `mh_assistant_unlock_seen_v1` | object / `{}` | 助手の解放告知を見たか(`data/assistants.js` の `normalizeAssistantUnlockSeen`) |
| `mh_extreme_hs_<難易度>` / `mh_extreme_clears_<難易度>` | number / `0` | 極限チャレンジ(`EXTREME` `NIGHTMARE` `CHAOS` `ULTIMATE` `INFINITY` `GOD`)のハイスコアと完走回数 |
| `mh_rhythm_settings_v1` | object / `DEFAULT_RHYTHM_SETTINGS` | モンビーの演奏設定(`normalizeRhythmSettings`) |
| `mh_rhythm_select_v1` | object / `DEFAULT_RHYTHM_SELECT_VIEW` | 曲えらび画面の見え方(並び順など) |
| `mh_rhythm_best_v1` | object | 曲×難易度ごとの BEST(`normalizeRhythmBestRecords`) |
| `mh_rhythm_monsters_v1` | string[] | モンスターノーツ用のマスモン枠(`data/rhythm-mode.js`) |
| `mh_rhythm_rank_pending_v1` | object[] | 全国ランキングへ送れなかったモンビーの記録(次回に再送) |
| `mh_rhythm_perf_v1` | boolean / `false` | 性能計測(デバッグ限定)の ON/OFF |
| `mh_rhythm_event_notice_v1` | string / `''` | 曲えらびで「今週の対象曲」の案内を見たイベントのID(週が変わると新しいIDになり、その週の初回にもう一度だけ出る。`docs/spec/RHYTHM_RANKING.md` §10.2) |
| `mh_changelog_timed_seen_fix_v1` | boolean / `false` | `visibleFrom` 付きの更新履歴（時刻が来てから出る項目）を、一度きりで未読へ戻したか。開始前に一覧を開いた端末で既読になり、公開時刻にNEWが付かなかったための補正フラグ（二重適用を防ぐ） |
| `mh_rhythm_event_story_v1` | string[] / `[]` | イベントの会話ストーリーを最後まで見たイベントのID(開催中に1度だけ流すためのフラグ。回想からはいつでも見られる) |
| `mh_rhythm_event_reward_v1` | string[] / `[]` | イベント報酬を受け取り済みのイベントID。二重受取を防ぐためのフラグ(入賞しなかった場合もここへ入れて、問い合わせ直さないようにする。`docs/spec/RHYTHM_RANKING.md` §9.1) |
| `mh_rhythm_canvas_v1` | `'canvas'` / `'dom'` / 未設定 | デバッグ画面の「ノーツの描き方」の上書き(未設定なら公開フラグに従う) |
| `mh_quick_rhythm_intro_seen_v1` | boolean / `false` | クイック∞周回とモンビーの連携の案内(バトル画面)を見たか |
| `mh_quick_rhythm_bg_seen_v1` | boolean / `false` | 裏で周回したままモンビーを開いたときの案内を見たか |
| `mh_screen_note_open_v1` | object / `{}` | 画面ごとの「詳しく」を開いているか(画面idごとの真偽値) |
| `mh_ranking_debug` | `'1'` のとき有効 | ランキングの詳細ログ(手で `localStorage` に入れるデバッグ用。ゲームは書かない) |

移行・補償のフラグ(第3章の表に載っていないもの):

| キー | 処理 |
| --- | --- |
| `mh_masu_level_cap_migrated_v1` / `mh_masu_level_cap_migration_pending_v1` | 限界突破の上限Lv形式への一度きり移行と、その途中経過(中断しても続きから) |
| `mh_masu_level_cap_compensation_notice_v1` / `mh_masu_level_cap_compensation_notice_seen_v1` | 上記移行で配ったダイヤの補償の案内と、その既読 |
| `mh_inherited_unique_level_compensation_v1` / `mh_inherited_unique_level_compensation_pending_v1` | 継承固有技Lvの補償を一度だけ行うフラグと、その途中経過 |
| `mh_unique_lineage_dedupe_migrated_v1` | 継承固有技の系統IDの重複を一度だけ整理した記録 |
| `mh_changelog_timed_seen_fix_v1` | 時刻で出しはじめるお知らせ(`visibleFrom`)を、始まる前に既読にしてしまった端末で一度だけ未読へ戻した記録。外すのは `visibleFrom` を持つ項目だけで、ほかの既読には触らない |
| `mh_monster_roster_sets_migrated_v1` | 編成セット形式への一度きり移行 |
| `mh_login_pt_to_xp_v1` | 誤って配ったログインポイントを XP へ一度だけ振り替えた記録 |
| `mh_bgm_dullahan_default_migrated_v1` / `mh_bgm_quick_extreme_default_migrated_v1` | BGM の既定曲を変えたときの一度きりの入れ替え(自分で選んだ曲には触らない) |

## 3. マイグレーション・補正フラグ

| キー | 処理 |
| --- | --- |
| `mh_masu_migrated` | false時、旧種別絆データからマスモンを一度だけ生成 |
| `mh_points_migrated` | false時、現ブリーダーLv-1相当ポイントを遡及付与 |
| `mh_points_base_granted` | false時、全プレイヤーへ初期1ポイントを一度付与 |
| `mh_breeder_points_granted` | XPカーブ緩和後の不足ポイント補填と二重付与防止 |
| `mh_masu_rebirth_full_reset_migrated_v1` | 旧仕様で転生済みの個体をLv1・未使用強化ポイント5へ一度だけ補正 |
| `mh_masu_baseline_relative_migrated_v1` | 第6Cの基礎値追従形式への安全移行を記録。trueでも未移行個体を再診断する |
| `mh_bgm_pro_default_migrated_v1` | プロモードの既定BGMを専用曲へ変えたときの一度きりの入れ替えを記録。以前の既定のままの項目だけ差し替え、自分で選んだ曲には触らない |

旧形式として `mh_bond_xp`（種ID→XP）、`mh_dist_apt_points`（種ID→未使用点）、`mh_dist_apt_overrides`（種ID→適性配列）を読み込む。XPが正の既知種だけ `masu_migrated_<種ID>` として追加する。旧キーは削除しない。

さらに起動時、各マスモンの現在絆Lvから得られるはずの総点と、使用済み＋未使用点を比較し、不足分だけを補う。通常の補填処理は過剰分を減らさない。

例外として、2026-08-29の既知不具合（34/35凸の現在倍率をLv.1から全レベルへ遡及して補填したもの）だけは `repairEnhancePointBandOvergrant` で不具合由来の差分を特定して戻す。誤式の総数まで到達していない個体は触らず、不具合以前から存在した余剰分も保持する。過剰分が未使用Pだけで戻せる場合は配分を維持し、使用済みに食い込んでいる場合だけ通常の `statPoints` / `distAptBoosts` を0へ戻し、正しい総数を `distAptPoints` へ返す。`enhancePointBandRepairVersion` で二重適用を防ぐ。超越強化・個体基礎値・技・限界突破・転生・合体履歴には触れない。 ただし、過去のベース間合い適性変更により使用済み適性Pを安全に逆算できない `distAptBoosts` 未保持の旧形式ゴーレムは、通常の不足補填と同様に推測補正の対象外とし、現在の保存内容をそのまま維持する。`distAptBoosts` を持つ新形式ゴーレムは他種と同じ補正対象とする。

`mh_onboarded` が存在しない場合、名前が既定値でない、XPが正、またはいずれかのハイスコアが正なら既存利用者としてtrueにする。

### モンヒロビート プレオープン記念 新規プレイヤーキャンペーン

2026-09-05のプレオープンより後に**はじめてゲームを始めた人だけ**へ、ダイヤ100,000と虹のプシュケー100を1回だけ配る。既存プレイヤーへは配らない。

対象の判定に `mh_monhiro_beat_preopen_new_player_campaign_v1` の有無を使ってはいけない。アップデート直後は新規・既存のどちらもこのキーを持っていないため、有無だけで判断すると既存プレイヤー全員へ配ってしまう。判定は起動時に読んだ `mh_onboarded` が `true` だったか（`everOnboarded`）で行う。名前かアイコンが欠けていて再度オンボーディングを通る既存プレイヤーを新規と取り違えないよう、`everOnboarded` は「未完了へ戻す補正」より前の値で決める。

配布は `finishOnboarding`（はじめての設定の完了）でのみ行い、`mh_onboarded` を `true` にする**前**に `mh_gifts` へ追加する。順序を逆にすると、ギフトを足す前に閉じられたときに完了フラグだけが立ち、対象外になって永久に受け取れなくなる。

二重配布は2段構えで防ぐ。配布済みフラグに加えて、`mh_gifts` に同じギフトid（`monhiro_beat_preopen_new_player_v1`、固定）が既にあれば追加しない。これによりギフト追加後・フラグ保存前に終了しても増えない。受け取りは既存のギフト基盤（`buildGiftClaim`）を通すので、ダイヤは `gold` へ、虹のプシュケーは `ownedItems.rainbow_psyche` へ**加算**される（上書きではない）。受取期限は指定がないため付けない（`expiresAt` を書かない＝期限なし）。

キャンペーン自体は `NEW_PLAYER_CAMPAIGN_ENABLED` で後からOFFにできる。終了日時は設定していない。

### ミッション

`mh_missions` は既存のデイリー／ウィークリーに、マンスリーの項目を追加した単一オブジェクトである。既存キーの改名・削除は行わない。`normalizeMissions` が欠損を補い、日次・週次・月次の期間が変わった部分だけを初期化する。

- 日次: `dailyPeriod`, `daily`, `sentDaily`（JST 04:00更新）
- 週次: `weeklyPeriod`, `weekly`, `sentWeekly`, `weeklyLoginDays`（月曜JST 04:00更新）
- 月次: `monthlyPeriod`, `monthly`, `sentMonthly`, `monthlyLoginDays`, `monthlyDailyCompletePeriods`, `monthlyWeeklyCompletePeriods`（毎月1日JST 04:00更新）

月次のコンプリート履歴配列は、同じ日次・週次期間を二重加算しないための期間IDだけを保持する。月途中の初導入時は既存の進捗を壊さず月次を空で補い、導入前に完了していた現在の日次・週次は遡及加算しない。個別報酬とコンプリート報酬の二重送付は、`sentMonthly` と `gift_mission_monthly_<期間>_<missionId>` の固定ギフトIDで防ぐ。

## 4. マスモン形式

必須または新規生成時のフィールドは `id`, `baseId`, `name`, `bondXp`, `distAptPoints`, `distApt[4]`,
`statPoints.{hp,atk,def,guts}`, `createdAt`。任意で次を持つ。

- `colors`: 部位別色ID。旧 `color` は読み取り互換あり。
- `fusionHistory[]`: `{subName, subBaseId, subBondLevel, xpGained, inherited, timestamp}`。
- `inheritedUniques[]`: 副の固有技データ、`sourceMasuName`、継承技1件ごとの永久一意な `inheritedUniqueId`。`lineageId` は血統・継承元情報として別に保持する。
- `uniqueSkillLevels`: 自前技は `own`、継承技は `inhId:<inheritedUniqueId>` が恒久Lvの正本。旧 `inh:0`, `inh:1` … は互換用に削除せず残す。
- `fusionBondLevels`: 合体XPによるレベル上昇数。ロード時の強化ポイント不足補填から除外するための累計値。
- `reincarnateBonusPoints`: その個体自身が転生で実際に獲得した強化ポイント累計。欠損する旧個体だけ `reincarnateCount × 10` で補完し、保存値があれば回数から再計算しない。
- `inheritedReincarnateBonusPoints`: 合体で受け継いだ転生由来の強化ポイント累計。欠損時は0。
- `inheritedReincarnateCount`: 合体で受け継いだ転生育成の表示用回数分。自身の転生回数・条件判定には使わず、欠損時は0。
- `enhancePointBandRepairVersion`: 34/35凸の倍率が過去Lvへ遡及された既知不具合を補正済みの個体だけが持つ版番号。欠損は未補正として扱うが、誤式の総数に達していない個体は減算しない。
- `individualStatOffsets`: 第3段階以降に新規再生した個体が持つ `{hp,atk,def,guts}`。同時に保存する `individualStats` と生成時点の種基礎値との差で、最新の種基礎値へ加算して解決する。存在時は `individualStats` より優先する。
- `distAptBoosts`: 第3段階以降に新規登録・新規再生した個体が持つ、零・近・中・遠の順の上昇段階数。生成直後は `[0,0,0,0]` で、最新の種適性へ加え、上限Mで解決する。互換用の完成値 `distApt` も併記・同期する。

第3段階では新規生成個体から新旧形式の併記を開始した。既存 `mh_masu_mons` は未移行であり、ロード時の一括書換えや新フィールドの自動追加は行わない。旧フィールドの `individualStats` と `distApt` も削除せず、欠損は正常な旧データとして扱う。したがって基礎値追従化はまだ完了していない。

継承固有技Lvについては別の構造ベース移行を起動時に行う。`inheritedUniqueId` または対応する安定Lvキーが欠けた
有効な継承技だけを、現在の配列順と旧 `inh:N` を対応させて補完する。専用トップレベルフラグは持たず、2回目は変更せず、
古いバックアップを復元すれば同じ規則で再移行する。解決順は安定IDキー、旧 `inh:N`、`evoLevel` の順である。
配列は表示順にすぎず、ID移行後の本人確認には使わない。継承技削除UI・削除処理・返却処理は未実装である。

第4段階では純粋なドライラン診断だけを追加した。`diagnoseMasuBaselineMigration` は候補と保全検査を返し、一覧版は3分類を集計するが、いずれも保存処理や起動処理から呼ばれない。**第4段階：既存個体の移行可否をドライラン診断可能。実データは未移行。** `mh_masu_mons`、旧個体の各フィールド、移行完了フラグは一切変更しない。

第6Cでは起動時診断が個体全体を `SAFE_EXACT` と確定した場合だけ実移行し、`individualStatOffsets` /
`distAptBoosts` を追加する。`individualStats`、`distApt` とその他の既存フィールドは削除・変更しない。能力は確定した
生成時ベースとの個体差と `statPoints` を維持したまま最新ベースへ追従するため、旧ベース由来個体では基礎値変更分だけ
移行前から変化し、総合力も移行後の能力・4距離適性・固有技Lv等から現行式で再計算される。

保存直前に個体差、能力変化量、4距離適性、ポイント、既存フィールド、総合力を検証し、候補の再診断が
`ALREADY_MODERN` になることまで確認する。少しでも不整合なら元個体をそのまま残す。専用キーは
`mh_masu_baseline_relative_migrated_v1` で、trueでも前回保留個体を再診断する。`PARTIAL` / `AMBIGUOUS` /
`BLOCKED` は推測移行せず完全に未変更とする。

旧形式のゴーレムは、歴代ベース適性の差から実際の間合い適性への投入段階数を一意に復元できないため、
ポイント不足補填でも現在ベースとの差を推測しない。`statPoints`、`distAptPoints`、`distApt` をそのまま保留し、
`distAptBoosts` を持つ新形式のゴーレムだけを通常の不足補填対象とする。

超越(Lv上限を500まで伸ばす育成)で足した項目は `transcended`（真偽）、`transcendPoints`（未使用の超越ポイント）、
`transcendStatPoints`（`{hp,atk,def,guts}` の投入数）、`transcendAptBoosts`（4距離ぶんの上昇段階数）の4つで、
いずれも `mh_masu_mons` の個体オブジェクトへ**追加**するだけである。既存キーの改名・削除・意味変更はしていない。
これらを持たない既存個体は未超越（Lv上限400、超越ポイント0、基礎値の加算なし）として読み、
壊れた値・負数・NaNは0へ落とす。超越ぶんは基礎値側に乗るため、絆ポイントリセットでも転生でも消えない。

`transcended` は神殿で正式に超越したかどうかだけを表す。超越ポイントで基礎値を上げる「超越強化」は
`transcended` が false の個体でも使えるため、**`transcendPoints` / `transcendStatPoints` / `transcendAptBoosts` は
`transcended` が false のままでも 0 以外になりうる**。正式な超越（`buildMasuTranscendence`）は
正規化済みの個体をスプレッドして `transcended` と `levelCap` だけを変えるので、それまでの値は保持され、
超越ポイントの二重付与も起きない。

マーケットの「超越ポイントリセットの書」(`transcend_reset_scroll`) は既存の `mh_owned_items` に個数を持つだけで、
新しい保存キーは作らない。使用時に書き換えるのは `mh_masu_mons`（対象個体の超越3項目）と `mh_owned_items`（本を1冊）の2つだけで、
マスモンの保存が済んでからアイテムを減らすため「本だけ減る」状態にはならない。

固有技設定で足した項目は `uniqueOrder`（並び順。安定キーの配列）と `initialUniqueKey`（初期技。安定キー1つ）の
2つだけで、いずれも `mh_masu_mons` の個体オブジェクトへ**追加**する。新しい保存キーは作らず、既存キーの
改名・削除・意味変更もしていない。キーは恒久Lvと同じ `own` / `inhId:<inheritedUniqueId>` で、配列位置
（`inh:N`）は保存しない。これらを持たない既存個体は「設定なし」として読み、従来どおり自前の固有技が先頭かつ
初期技になる。読み取りのたびに現在の手持ちへ正規化し（存在しない技は無視、増えた技は末尾へ追加、
無効な初期技は自前へフォールバック）、起動時に既存個体を一括で書き換えることはしない。
設定の保存は `uniqueSkillLevels` と `uniqueSkillPoints` に触れないため、並び替えや初期技の変更で
固有技Lv・固有技ポイントが変化することはない。

### 魂格システム

魂格の詳細仕様は [SOUL_RANK_SYSTEM.md](./SOUL_RANK_SYSTEM.md) を正本とする。保存形式としては、新しいトップレベル `mh_*` キーを増やさず、既存 `mh_masu_mons` の各個体へ次を追加する。

- `soulRankStage`: 魂格段階。0〜5へ正規化し、欠損する旧個体は0。
- `soulPointMaxReachedLevel`: 魂格Pの初到達判定に使う過去最高Lv。500〜1000へ正規化し、欠損する旧個体は500。
- `soulTraitLevels`: 特性ID→強化段階。未知IDは無視し、欠損は空オブジェクト。

未使用魂格Pは保存せず、`soulPointMaxReachedLevel` と `soulTraitLevels` から導出する。転生では上記3項目を明示的に維持し、合体の通常経路では副の魂格段階・最高到達Lv・特性振り分けを主へコピーしない。魂格継承合体を選んだ場合だけ、主の不足段階分の通常進化コストを支払って `soulRankStage` / `levelCap` を先に解放する。

勇者の証 `hero_proof` と魂格再編の書 `soul_rank_respec_scroll` は、既存 `mh_owned_items` の個数として保存する。専用保存キーは作らない。

ランキング個体詳細は `RANKING_DETAIL_VERSION = 6` で、記録時の `soulRankStage` / `soulTraitLevels` / `soulSpentPoints` を既存detail内へ追加する。未使用魂格Pはランキングへ保存しない。旧ランキングは魂格なし・特性なし・使用済み0Pとして読む。

既存バックアップは `mh_*` の生文字列を丸ごと保存するため、`mh_masu_mons` 内の魂格項目と `mh_owned_items` 内の勇者の証・再編の書も同じ仕組みで往復する。回帰確認は `node tools/boot/soul-rank-backup-check.js`。

明示的な `schemaVersion` は存在しない。未知フィールドはオブジェクトスプレッドにより多くの更新で維持されるが、全経路での保証は**未確認**。

## 5. ラン中データと保存タイミング

HP、ガッツ、現在WAVE、手札、山札、バフ、技強化、スコア等のラン中stateは保存しない。再読み込みによるラン再開機能はない。

永続データは操作単位で即時保存する。主なタイミングは名前・アイコン・音量変更、購入、編成確定、個体育成・改名・削除・融合、ラン終了報酬、挑戦開始、完走、スコア更新。React state更新と `storeSet` はトランザクションではなく、複数キーをまとめて原子的に更新する仕組みは**未確認**。

## 6. バックアップと復元

プロフィールの手動バックアップは、`localStorage` 内の `mh_` で始まる全キーについて「保存済みの生文字列」をオブジェクトにし、JSON→UTF-8互換変換→Base64化する。従来のコード方式に加えて、この同じBase64文字列を `.mhsave` ファイルとして保存・復元できる。保存ファイル名は `MonsterHero_Backup_YYYYMMDD_HHMM.mhsave`（日時部分は保存時刻）とする。iPhone / iPadでは共有メニューから「ファイルに保存」を選び、Android Chrome / PC Chromeでは共有APIを使わずブラウザのダウンロードとして直接保存する。復元はコードまたは `.mhsave` のBase64を逆変換し、`mh_` キーが1つ以上あれば各値をそのまま `localStorage` へ書き、再読み込みする。

注意事項:

- `window.storage` やメモリフォールバックの内容は書き出さず、`localStorage` 専用。
- 署名、暗号化、チェックサム、スキーマ検証、値型検証はない。
- 復元は既存の `mh_` キーを全消去せず、コードに含まれるキーだけ上書きする。
- バックアップコードには進行データと表示名が含まれるため、公開場所へ貼らない。

## 7. ランキングデータ

Supabaseへ `{difficulty, user_name, hero, party, score, level, icon, clear_id}` の全項目を、全難易度共通の経路から1回だけ送る。`difficulty`は表示名ではなく既存の難易度keyへ正規化し、取得時は過去行の大文字小文字の揺れを含む完全一致で検索する。`clear_id`は送信の冪等化だけに使い、取得・表示のフィルターには使わないため、`clear_id=NULL`の旧記録も表示対象となる。全国保存の成否は端末内フォールバックと別に保持する。全国保存失敗時は `mh_rank_<難易度>` へ `{userName, hero, party, score, diff, level, icon, clearId, at, nationalSaved, nationalError}` を追加し、HTTP status・PostgREST code・response bodyを診断可能にしたうえで、スコア上位50件と名前ごとの最新1件を保持する。

`party` は各枠の `{name, emoji, imgUrl, bondLevel}`。個体名ではなく種名を送る。全国側の保持期間、RLS、重複排除制約、削除方針はリポジトリからは**未確認**。

## 8. 互換性ルール

- キー名、難易度ID、種ID、教えID、アイテムIDを表示文言の都合で変更しない。
- 新形式導入時は既存値の既定値補完と一度限りの移行フラグを用意する。
- `mh_masu_mons` は利用者の育成資産であり、破壊的再生成をしない。
- 保存変更時はバックアップ往復、旧キー移行、起動、購入・報酬、ランキングフォールバックを確認する。
