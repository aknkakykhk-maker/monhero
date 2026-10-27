# セーブデータ設計書

## 1. 保存層

`storeGet` / `storeSet` が保存の唯一の共通入口である。優先順位は次のとおり。

1. `window.storage` があれば JSON 文字列で読み書きする。
2. なければブラウザ `localStorage` を使う。
3. どちらも使えなければ `_memStore` に保存する。この場合は再読み込みで消える。

全呼び出しは `shared=false` である。共有ストレージ利用は現行コードにない。

**書き込みの成否は `storeSet` の戻り値と `getStorageHealth()` で分かる**（2026-09-21）。それまでは失敗を握りつぶすうえ、失敗しても `_memStore` へは書いていたため、保存できなくなっても同じセッション中は読み戻せて画面は正常に見え、落ちて読み込み直した瞬間に最後に書けた時点まで全キーが一斉に戻っていた。実測では保存データ1,678,420文字のうち86%が `mh_ranking_cache` で、`localStorage` の上限（iPhoneのSafariでおよそ5MB。1文字2バイトで数える）へ迫っていた。上限に達すると `hasLocalStorage()` のためし書きが落ち、**どのキーの保存も素通りする**。

- `getStorageHealth()` … 連続失敗数・最後のエラー名・失敗したキー・最後に書けた時刻・書けた最大の長さ
- `probeStorageWritable()` … 「次の1件（最大64KB）が入るか」を書いて消して試す
- `storageUsageReport()` … `mh_` で始まるキーごとの大きさと合計
- 画面側は30秒ごとに見回り、失敗していれば知らせを出し、クイックの∞周回は `stopAllAuto('storage')` で止める。報酬を配り終えたあとに判定するので、**止まった時点までのぶんは端末に入っている**

### 積もり続けるデータの上限（2026-09-21）

| データ | 上限 | 備考 |
| --- | --- | --- |
| `mh_ranking_cache` | 難易度は直近6つまで。行の `party[].detail` は保存しない | 画面が使う控え（`rankingCacheRef`）は `detail` を持ったまま。**保存する形だけ**削る。詳細は開けば取り直せる |
| `mh_gifts` の受け取り済み | 新しい50件まで（`pruneGiftHistory`） | `loginBonus` と `compensation` は消さない（一度きりの付け替え `mistakenLoginPoints` が受け取り済みを数えるため） |

どちらも起動時に一度だけ整理し、設定の「データバックアップ」からも手で整理できる。育成データ（`mh_masu_mons`・`mh_gold`・`mh_breeder_xp`・`mh_owned_items`）には触れない。実データでの効果は 3.20MB → 0.59MB。検査は `tools/boot/storage-quota-guard-check.js`。

## 2. キー一覧

| キー | 値・既定値 | 用途 |
| --- | --- | --- |
| `mh_se_volume` | number / `1` | SE音量0～100 |
| `mh_bgm_volume` | number / `1` | BGM音量0～100 |
| `mh_bgm_arrangement` | object / 既定の組み合わせ | 場面ごとに選んだBGMのtrack ID。読み込み時に正規化し、知らない項目・不正なIDは既定値で補う |
| `mh_title_art` | string / `'auto'` | タイトル画像アレンジ。`'auto'`(おまかせ)・`'halloween'`・`'classic'`。無い・知らない値は `'auto'`。起動時の先読み(index.html)もこのキーを読む |
| `mh_home_art` | string / `'auto'` | ホーム画面アレンジ。値は `mh_title_art` と同じ |
| `mh_screen_theme_v1` | object / 全部 `'auto'` | 画面テーマ。`{ menu, market, temple, battle, rhythm }` に `'auto'`/`'halloween'`/`'classic'`。`normalizeScreenTheme` で知らない項目・不正な値は `'auto'` に補う(docs/spec/SCREEN_THEME.md) |
| `mh_battle_perf_v1` | boolean / false | バトルの性能計測のON/OFF(デバッグ限定)。`BATTLE_PERF` が持つ |
| `mh_debug_battle_card_art_v1` | `'1'` / 未設定 | 行動カードの絵(試作)を出す切り替え(デバッグ限定・2026-10-15)。`BATTLE_CARD_ART_DEBUG` が持つ。公開の印 `battleCardArt` が真なら、未設定でも絵を出す |
| `mh_battle_card_look_v1` | `'art'` / `'classic'` / 未設定 | 行動カードの見た目(設定 → バトル設定。2026-10-16)。`'classic'` で前のカード、それ以外・未設定・壊れた値は新しいカードの絵(既定)。`BATTLE_CARD_LOOK`(71-screen-battle.jsx)が `normalizeBattleCardLook` を通して読む |
| `mh_asset_prefetch_v1` | object / `{ enabled:true, enabledChosen:false, auto:true, songs:[] }` | 事前ダウンロード(曲・画像を端末にためておく)の入/切・自動ダウンロード・最近選んだ曲(最大12)。`normalizeAssetCacheSettings` で壊れた値は既定に戻す。**`enabled` は `enabledChosen:true`(本人が入/切を押した)のときだけ読む**。既定が切だった 2026-10-11 の約20分に、曲を選んだだけで `enabled:false` が書かれた端末があるため(読み方だけで、保存値は書き換えない)。ためた中身は localStorage ではなく Cache Storage(`mh-assets-v1`)にあり、切にすると消す(docs/spec/ASSET_PREFETCH.md) |
| `mh_breeder_name` | string / `名無しのブリーダー` | 表示名（保存時最大10文字） |
| `mh_breeder_icon` | string or null | 種IDまたは購入アイコンID |
| `mh_breeder_xp` | number / `0` | 累計ブリーダーXP |
| `mh_gold` | number / `0` | ゴールド（UI上のダイヤ表記を含む） |
| `mh_breeder_points` | number / `0` | 未使用マーケットポイント |
| `mh_breeder_points_granted` | number or null | 累計付与済み相当数 |
| `mh_breeder_id_v1` | string or null | 端末ごとに1回だけ作るブリーダーID。全国ランキングで同名の別人を見分けるために送る(名前を変えても変わらない。`docs/spec/RHYTHM_RANKING.md` §4) |
| `mh_assistant_chat_log_v1` | object | 助手とおしゃべりの会話。`{ [助手id]: [{ role:'user'\|'assistant', text, e? }] }`、助手ごとに最後の60件。端末にだけ置き、サーバーには残さない(`docs/spec/ASSISTANT_CHAT.md`) |
| `mh_assistant_chat_memo_v1` | object | 助手とおしゃべりの思い出メモ(前の形)。`{ [助手id]: 120字までの文 }`。2026-10-14 からは**読むだけ**で書かない。新しいキーに無い助手のぶんは「前に話した話題」として引き継ぐ |
| `mh_assistant_chat_memo_v2` | object | 助手とおしゃべりの思い出メモ(2026-10-14〜)。`{ [助手id]: { likes, goals, events, topics, summary } }`(各100字・summary 160字まで)。次の会話で中継役へ渡す |
| `mh_assistant_daily_lines_v1` | object | ふだんの吹き出しを1日1回まとめて作ったひとこと(2026-10-14)。`{ day, assistantId, lines: { [場面]: [{ e, t, n }] } }`。日付が変われば使わず、次に作ったら入れ替える。n はその日に出した回数 |
| `mh_story_assistant_chat_seen_v1` | boolean | 助手とおしゃべりのお話「話せるようになった日」を本編で見たか(飛ばしても立つ)。公開の後の最初の HOME で1回だけ流すため。回想・デバッグでは立てない |
| `mh_story_tactics_types_seen_v1` | boolean | 助手4人がタイプを教えるお話「タクティクスバトル ～4人のタイプ～」を本編で見たか(飛ばしても立つ・2026-10-18)。ヘイトとタイプの公開のあと、タクティクスバトルの導入のお話を見た人の最初の HOME で1回流す。回想・デバッグから見たぶんは立てない |
| `mh_story_card_battle_seen_v1` | boolean | お話「MFバトルカード ～物置の古い箱～」を本編で見たか(飛ばしても立つ・2026-10-24)。MFバトルカードの公開(`RELEASE_FLAGS.cardBattle`)のあとの最初の HOME で1回流す。立っていると HOME に MFバトルカードの入口が出る。true 以外(無い・壊れた値)は「まだ」。回想・デバッグから見たぶんは立てない |
| `mh_story_one_at_a_time_v1` | boolean | はじめて遊ぶ人の印(2026-10-27)。はじめての案内を通る人にだけ起動時に true を書き、消さない。true の人は HOME に着くたびにお話を1本だけ流し、残りは HOME を離れて戻ったときに1本ずつ流す。前から遊んでいる人には書かない(無い・false なら今までどおり続けて流す) |
| `mh_help_new_seen_v1` | string[] | ヘルプの🆕(2026-10-18)。開いたことのあるトピックの id(`added` を持つ項目だけ・新しい200件まで)。無い・壊れている = まだ何も開いていない(載せてから14日の項目に🆕が出る) |
| `mh_market_icons` | string[] / `[]` | 購入アイコンID。ブリーダーP交換所だけでなく、**ビートP交換所のハロウィンのアイコン(1000P)の交換でも**、まとまりの中身が全部ここへ足される(2026-10-04)。**同じキャラのアイコン(助手の表情・モンスターの顔と円盤石など)は、どれか1つでも入っていれば全部持っている扱い**(2026-10-03・`BREEDER_ICON_GROUPS` / `expandOwnedMarketIcons`)。広げるのは読むときだけで、保存値は書き換えない。買うと、まとめの中身が全部入る |
| `mh_owned_items` | object / `{}` | 消耗品ID→個数 |
| `mh_missions` | object / 期間ごとの既定値 | デイリー・ウィークリー・マンスリーの進捗、期間ID、ギフト送付済みID。旧データの欠損項目は読み込み時に補う |
| `mh_unlocked_monsters` | string[] / 初期8種 | 解放済み種ID |
| `mh_monster_roster` | string[] / 解放済み一覧 | 候補編成。種IDまたは `masu:<id>` |
| `mh_auto_settings_v1` | object / `{strategy:'random', allies:[{rosterEntry:null,slot:null} × 3], breakthroughReserve:{gold:0,psyche:0}, quickRun:{heroRosterEntry:null,distance:null,difficulty:null,autoStart:false}}` | AUTO用の事前設定。方針・供モン・クイック周回設定に加え、AUTO∞自動限界突破で最低限残すダイヤ/虹のプシュケーを `breakthroughReserve` に保存する。`quickRun.autoStart` は「モンヒロビートを開いたら自動で∞周回を始めるか」（既定 `false`。項目の無い既存データ・壊れた値は `false` へ倒す）。欠損・不正値は0へ正規化し、0は保護なし |
| `mh_unlocked_teachings` | string[] / 初期6枚 | 解放済み教えID |
| `mh_teaching_roster` | string[] / 解放済み一覧 | 教え候補編成 |
| `mh_masu_mons` | object[] / `[]` | マスモン個体一覧。AUTO∞自動限界突破は個体ごとに `autoRepeatBreakthroughMode`（`off` / `fixed` / `follow`）と既存の `autoRepeatBreakthroughLevel` を持つ。旧データで数値Lvがあれば `fixed` として保持する。旧仕様で保存できたLv405以上の5刻み値は、通常限界突破の実上限と同じLv400へ丸めて意味を保つ。旧boolean・欠損・不正値はOFFへ落とす。`uniqueSkillPoints`（未使用の固有技ポイント）など後から足した項目も既定値へ正規化する |
| `mh_masu_locked_v1` | string[] / `[]` | マスモンのお気に入り(ロック)のIDの並び(2026-10-01)。お気に入りの子は削除・合体の副・寄付ができない。壊れた値は「お気に入りなし」(`normalizeMasuLockIds`)。`mh_masu_mons` には書かない |
| `mh_favorite_masu_v1` | string / `null` | 「好きなモンスター」にしたマスモン1体のID(フレンド機能・プロフィールで選ぶ。フレンドにだけ見える)。マスモンのロックの「お気に入り」(`mh_masu_locked_v1`)とは**別のもの** |
| `mh_profile_message_v1` | string / `''` | フレンドのプロフィールに出る「ひとこと」(30文字まで。`friendsCleanMessage` を通した文) |
| `mh_friend_favorites_v1` | string[] / `[]` | フレンド一覧で「お気に入り」にしたフレンドのID(`friendsNormalizeFavorites` を通す) |
| `mh_friend_recent_v1` | object[] / `[]` | 最近いっしょに遊んだ人(`{id,name,at}`。新しい順・同じ人は1件・最大30人。端末だけに覚え、サーバーへは送らない。`friendsNormalizeRecent` を通す) |
| `mh_friend_notes_v1` | object / `{}` | フレンドごとのメモ(フレンドのID→メモ。メモは12文字まで・最大200人ぶん。端末だけに覚え、サーバーへは送らない。`friendsNormalizeNotes` を通す) |
| `mh_raid_jack_v1` | object / `raidJackDefaultState()` | イベント・レイドボス「ジャック」の端末側の記録(A/Bそれぞれの今日の使用回数・買い足した回数・倒した段階、Bの累計ダメージの自分用の控え、受け取り済みの報酬ID、送れなかった与ダメージの再送待ち)。`raidJackNormalizeState` を通す。既存のキーには触らない。設計: `docs/spec/RAID_BOSS_JACK.md` |
| `mh_card_collection_v1` | object / `cardNormalizeCollection` | MFバトルカードの持っているカード `{ カード番号: 枚数 }`(モンスターカードも同じ表)。枚数は 1〜99。知らない番号は消さずに残す。設計: `docs/spec/CARD_BATTLE.md` 6-1 |
| `mh_card_pvp_penalty_v1` | number(時刻ms) | MFバトルカードのマルチ対戦で、試合の途中で部屋を出た・アプリを閉じたとき、この時刻(3分後)まで部屋に入れない(2026-10-24・91-card-battle-multi.jsx)。無い・壊れた値・過ぎた時刻は「入れる」 |
| `mh_card_pvp_history_v1` | array / `cardPvpNormalizeHistory` | MFバトルカードのマルチ対戦の履歴(2026-10-27・92-card-pvp-history.jsx)。新しい30試合まで `[{ match, at, room, outcome, reason, turns, verify, foe:{ bid, name, icon, frame, deckName }, foeDeck:{ monsters, cards }|null, foeSeen:[使われた札], myDeck:{ name, monsters, cards }, rating:{ before, after }|null }]`。相手のデッキは封を開けて「合っている」試合だけ。壊れた行は捨てる。端末の中だけ(Supabase に送らない) |
| `mh_card_replays_v1` | object / `cardReplayNormalize` | MFバトルカードの過去の対戦を見る(リプレイ)の記録 `{ v:1, list:[{ v:1, id(試合の番号), kind:'pvp'|'cpu', at, rules(ルールの版), first, names, foe:{ name, icon, frame, deckName, who }, outcome, reason, decks:[自分, 相手], seeds:[自分, 相手], acts:[[by, 手], …], prints(1手ごとの場の指紋4文字ずつ), fav, turn(最後の番。2026-10-27 に足した項目・無ければ null), level(助手と対戦の難易度。2026-10-27 に足した項目・無ければ null) }] }`(新しい順)。新しい50試合まで・お気に入り10まで(消さない)・合わせて約750KBまで(2026-10-27 に10試合・3つ・150KBから増やした。キーは同じ)。localStorage へは直に書き、いっぱいのときはゲーム全体の保存の失敗に数えず、128KBの空きが残るまで古い試合(★以外)から消す。それでも入らなければその試合だけ残さない。端末の中だけ(送らない)。壊れた1件は捨て、知らない値は既定で補う。マルチは確かめ(`cardPvpVerify`)が通った試合だけ書く。なぞり直して手が当たらない・指紋が合わない所で止め「ここまでしか見られません」(2026-10-27・93-card-replay.jsx) |
| `mh_card_decks_v1` | object / `cardNormalizeDecks` | MFバトルカードのデッキ `{ active, decks:[{ id, name, monsters:[3], cards:[50] }] }`(5つまで)。持っていないカードが入っていても消さない |
| `mh_card_point_v1` | number / `cardNormalizePoint` | MFバトルカードのカードポイント(**2026-10-26 から読まない**。カードポイントをやめてビートPにした・社長。キーは消さずに残す。カードの支払い・受け取りはビートPの `mh_rhythm_event_points_v1`。`CARD_POINT_STORE_KEY`) |
| `mh_card_points_to_beatp_migrated_v1` | `true` のみ | 前のカードポイント(`mh_card_point_v1`)の残りをビートPへ1回だけ移した印(2026-10-26 社長)。印とビートPを1つの取引で書く(`cardMigratePointsOnce`)。`CARD_SAVE_KEYS` には入れない(デバッグの記録の消去で消えて二重に足されないように)。`tools/card/card-point-migration-check.js` |
| `mh_card_starter_v1` | object / `cardNormalizeStarter` | スターターを受け取った一度きりの印 `{ kit, at }`。ある人には二度と配らない(`cardGrantStarter`) |
| `mh_card_daily_v1` | object / `cardNormalizeDaily` | MFバトルカードの今日の記録 `{ day(JST), cpuPoint, pvpPoint, firstWin, foes }`。日が変われば 0 に戻る |
| `mh_card_record_v1` | object / `cardNormalizeRecord` | MFバトルカードの戦績 `{ cpu:{win,lose,surrender}, pvp:{win,lose}, beaten:{助手id:true}, recent:[30件], byLevel:{win:{難易度:数},lose:{…}}, rank:{ total:{難易度:勝ち}, week:{key:月曜の日付, wins:{…}}, streak:{now,best} } }`。byLevel・rank は 2026-10-24 に足した項目(無い人は 0 で補う)。rank はランキングに数えてよい対戦(公開後・デバッグでない人)だけを数える(`cardRecordAfter`) |
| `mh_card_record_detail_v1` | object / `cardNormalizeRecordDetail` | MFバトルカードの記録をくわしく(2026-10-27。記録の画面の「全体」「助手ごと」「マルチ」)。`{ v:1, seeded, foes:{助手id:{win,lose,surrender,now,best,fastest,levels}}, wins:{n,turns,fastest}, day:{key,win}, decks:{id:{name,n}}(20まで), mons:{番号:数}, moves:{番号:回数}, quick, pvpBest }`。助手と対戦の精算と同じ取引で足す(90 の `cardRecordDetailEntry`)。`seeded` … はじめて書くときに `mh_card_record_v1` の最近の30戦から助手ごとの数を1回だけ起こした印(二度は足さない)。`mh_card_record_v1` は書き換えない・Supabase へは送らない |
| `mh_card_cpu_unlocked_v1` | object / `cardNormalizeCpuUnlocked` | コンピューター戦の難易度を開いた印 `{ hard, expert, master }`(EASY・NORMAL は最初から) |
| `mh_card_tutorial_v1` | object / `cardNormalizeTutorial` | MFバトルカードの練習試合(チュートリアル)の印 `{ done, skipped, rewarded, at }`。`rewarded` があれば 100 ビートPを二度と渡さない(`cardTutorialFinish`) |
| `mh_card_pack_pity_v1` | object / `cardNormalizePity` | MFバトルカードのパックの天井 `{ パックid: キラなしで開けた数 }`。2026-10-25 に8弾(p1〜p8)へ作り直した。以前の w1〜w4・hybrid の数も消さずに残す(知らないパックid・数でない値は捨てる。89-card-pack.jsx) |
| `mh_card_pack_pity_split_v1` | boolean | 以前の4弾(w1〜w4)の天井の数を、新しい8弾へ1回だけ写した印(w1→p1〜p3 / w2→p4・p5 / w3→p6 / w4→p7・p8。新しい弾に数があれば上書きしない。89 の `cardSplitPity`・60 の buyCardPacks) |
| `mh_card_shop_v1` | object / `cardNormalizeShop` | マーケットで買った選ばなかったスターターキットの印 `{ starters:{ キットid: 時刻 } }`。印があるキットは二度と買えない(`cardBuyStarter`) |
| `mh_card_top_assist_v1` | object | MFバトルカードのトップの助手の出し入れ `{ modeSelectArt, modeSelectComment }`。無い・壊れていたら両方ON |
| `mh_card_rank_sync_v1` | string | MFバトルカードのランキング(表 `card_battle_ranks_v2`。無い環境では旧表 `card_battle_ranks`)へ最後に送った行の中身。同じなら送り直さない(90-card-rank.jsx) |
| `mh_card_bgm_v1` | object / `normalizeCardBgm` | MFバトルカードのBGM `{ top: 曲id(トップ画面・2026-10-26 に足した項目), cpu: 'auto'(相手の助手に合わせる)か曲id, pvp: 曲id }`。オプションで曲を選んだときだけ書く。無い項目・知らない曲idは既定(top `atsu_cup_theme` = MF × ICHIKA MIX・cpu `auto`・pvp `ichika_battle`)へ。選んだ人の値は書き換えない |
| `mh_card_cpu_playlist_v1` | object / `cardNormalizeCpuPlaylist` | MFバトルカードの助手と対戦の曲の並び `{ v:1, assistants:{ 助手id: [曲id 1〜5] } }`(2026-10-26)。オプションで直したときだけ書く。無い・壊れていたら助手ごとの曲1つ。知らない助手・知らない曲・同じ曲の2つ目・6曲目からは落とし、0曲になった助手は既定の1曲。これがあれば助手と対戦では `mh_card_bgm_v1` の `cpu` を使わない(そちらは消さない・書き換えない) |
| `mh_card_cpu_open_v1` | object / `cardNormalizeCpuOpen` か `null` | MFバトルカードの助手と対戦の、いま遊んでいる試合の印 `{ id, who, level, rankable, at, beat, facts:{ ownTurns, kos } }`。始めたときに書き、ふつうに終わったら結果と同じ取引で `null` にする。残っていて `beat` が15秒より古ければ、次に開いたときに投了として数えて `null` にする(2026-10-26 社長「負け扱いにする」。84-screen-card-battle.jsx)。壊れていたら数えずに `null` |
| `mh_card_settings_v1` | object / `normalizeCardSettings` | MFバトルカードの演出 `{ speed: 'normal'|'fast', autoPass: 真偽 }`。無い人は ふつう・自動パスON |
| `mh_card_ai_talk_v1` | object / `cardNormalizeAiTalk` | MFバトルカードの助手のおしゃべり(AI)の入/切 `{ on: 真偽 }`(2026-10-25)。無い・壊れていたら入。呼べるのは公開の印かデバッグ端末だけ(83-card-battle-talk-ai.jsx) |
| `mh_raid_jack_frame_gift_v1` | object / `null` | プロフィールフレーム「ハロウィン・妖」をギフトで届けた印(`{ at, frameId }`・2026-10-20)。レイドで大王まで倒せたときの終章を見た参加者へ1回だけ届けるため。ギフトの一覧(`mh_gifts`)は古いものから消えるので、二重に届けないためにこの印を持つ。ギフトと同じ取引で保存する |
| `mh_assistant_bond_rewards_v1` | object / `null` | 助手の仲良し度の節目(Lv22・25・28・30)のごほうびを、**最初の量**(`ASSISTANT_BOND_LEVEL_REWARDS_V1`)で届けた印(`{ 助手のid: [22, 25, ...] }`・2026-10-21 #3241)。量を上げたあと(下の v2)は書かず、読むだけ。この印がある節目には、今の量との差のぶんだけを追加で届ける |
| `mh_assistant_bond_rewards_v2` | object / `null` | 助手の仲良し度のLvごとのごほうび(Lv2〜30・`ASSISTANT_BOND_LEVEL_REWARDS`)を**今の量**で届けた(または最初の量との差を届けた)印(`{ 助手のid: [2, 3, ...] }`・2026-10-21)。助手ごとに各Lv1回。ギフトの一覧(`mh_gifts`)は古いものから消えるので、二重に届けないためにこの印を持つ。ギフトと同じ取引で保存する。起動時に、もう越えているLvのぶんをまとめて届ける |
| `mh_raid_jack_boss_down_v1` | object / `null` | レイドの大王ジャックが(みんなで)倒されたのを見た印(`{ at }`・2026-10-20)。フレーム「ハロウィン・恐」をマーケットで買えるようにする条件。倒されたことは取り消されないので、一度見たら持っておき、サーバーへ届かないときも使う |
| `mh_raid_jack_guide_seen_v1` | boolean / `false` | レイド画面を開いた最初の1度だけ出す、画面のなかの案内(助手の吹き出し)を見たか。新しく足したキー。既存のキーには触らない |
| `mh_raid_jack_unused_hs_<難易度>` など | number / `0` | **実際には書かれない**保険のキー(`modeKeyPrefix`)。ジャック戦は記録を書かないが、万一書いても通常のタクティクスの自己ベスト(`mh_tactics_*`)と同じキーを指さないように、別の接頭辞へ逃がしてある |
| `mh_masu_lock_rebirth_v1` | string[] / `[]` | マスモンの転生ロックのIDの並び(2026-10-01)。転生ロックの子は転生できない。お気に入り(`mh_masu_locked_v1`)とは別々に付け外しできる。壊れた値は「ロックなし」。`mh_masu_mons` には書かない |
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
| `mh_tactics_hs_<難易度>` | number / `0` | 端末ハイスコア（新モード。公開前） |
| `mh_tactics_clears_<難易度>` | number / `0` | 完走回数（新モード。公開前） |
| `mh_tactics_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（新モード。公開前） |
| `mh_tactics_pro_hs_<難易度>` | number / `0` | 端末ハイスコア（タクティクスプロ。公開前） |
| `mh_tactics_pro_clears_<難易度>` | number / `0` | 完走回数（タクティクスプロ。公開前） |
| `mh_tactics_pro_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（タクティクスプロ。公開前） |
| `mh_species_challenge_progress_v1` | object / `{version:1,species:{}}` | 種族チャレンジの種族・難易度別クリアと初回報酬受取状況 |
| `mh_tactics_species_challenge_progress_v1` | object / `{version:1,species:{}}` | タクティクスの種族チャレンジの進行。クラシック側(`mh_species_challenge_progress_v1`)とは**別のキー**にして、どちらの記録も混ざらないようにしている（公開前） |
| `mh_rank_<難易度>` | object[] / `[]` | 全国送信失敗時の端末ランキング |

難易度部分は `Beginner`, `Easy`, `Normal`, `Hard`, `Expert`, `Master`, `GrandMaster`, `Hell`, `Legend`。難易度キーは保存・ランキング識別子なので既存名を変更しない。

バトルモードごとの記録は接頭辞で分ける（`modeKeyPrefix`：チャレンジ `mh_`／クイック `mh_quick_`／プロ `mh_pro_`／タクティクス `mh_tactics_`／タクティクスプロ `mh_tactics_pro_`）。モードを増やしても既存キーの意味は変えず、新しい接頭辞のキーを足すだけにする。未プレイのモードのキーは存在しないので、読み込みは既定値 `0` に落ちる。

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
| `mhdev_session_marker_v1` | object / 無し | **端末の中だけ**の「いま遊んでいる」印(`normalizeSessionMarker`)。起動から15秒ごとに書き直す(`startedAt`・`lastBeat`・`state` = `running`/`hidden`/`closed`・`screen`・`audioBuffers`・`heapMB`・`nav`、2026-10-12 から `audioMB`(持っている音の大きさ)・`decodedMB`(起動してから解いた合計)・`decodeCount`(解いた回数)。無い印は null として読む)。1件だけ。次の起動でこれを読み、正常に終わっていなければ `mhdev_reload_log_v1` へ足す。無い・壊れているときは何もしない。サーバーへは送らない。`localStorage` へ直接書く(`storeSet` は通さない)。**`mhdev_` なのでバックアップに入らない**(この端末の記録なので、別の端末へ引き継がない) |
| `mhdev_reload_log_v1` | array / `[]` | **端末の中だけ**の「前回、途中で読み込み直された」記録(`normalizeReloadLog`)。直近 `RELOAD_LOG_LIMIT`(12)件まで、新しいものが先頭。`kind` は `foreground`(遊んでいる最中に止まった)/ `background`(裏に回ったあと)。音量設定の「🔧 音が出ないとき」の下で見られる。サーバーへは送らない。`localStorage` へ直接書く。**`mhdev_` なのでバックアップに入らない** |
| `mh_battle_speed_v1` | string | バトル速度(`normalizeBattleSpeed` で既定へ) |
| `mh_battle_screen_style_v1` | string / `'TACTICS_NEW'` | タクティクス画面の表示設定（`TACTICS_OLD` / `TACTICS_NEW`）。未保存・旧`CLASSIC`値・不正値は新タクティクスUIへ正規化。通常のクラシックバトルには影響しない |
| `mh_dex_idle_motion_v1` | boolean / `true` | モンスター図鑑の立ち絵を動かすか(図鑑のページの「動きを止める／動かす」)。無い・`false` 以外は動かす。見た目だけ |
| `mh_battle_fx_v1` | object / `{idleMotion:'ON', shake:'ON', autoLoad:'OFF'}`(`autoLoad` の既定は 2026-10-01 に ON→OFF。以前 ON で保存していた人は一度きりの移行で OFF にし、済みの印は `mh_battle_fx_autoload_default_off_v1`) | バトル設定の「待機中の動き」「画面の揺れ」(`normalizeBattleFxSettings` で既定へ。項目が無い・不正値は `'ON'`)。見た目だけで戦闘には影響しない |
| `mh_login_bonus` | object / `LOGIN_BONUS_DEFAULT` | ログインボーナスの受取状況(期間キーと日数) |
| `mh_playtime_v1` | object | プレイ時間の累計と日別(`normalizePlaytime`) |
| `mhdev_playtime_device_v1` | object | **端末ごと**のプレイ時間(`normalizePlaytimeDevice`)。`deviceId`・`baseMs`(この仕組みが入った時点でその端末が持っていた時間)・`ownMs`(そのあとこの端末で遊んだぶん)・`since`。**わざと `mh_` で始めていない**: データ引き継ぎは `mh_` のキーだけを写すので、別の端末へコピーされない(コピーされると2台で二重に数える)。2026-10-06 |
| `mh_player_id` | string | ランキング送信に使う端末ID。`localStorage` 直接アクセス(`storeGet` を通さない) |
| `mh_ranking_cache` | object | 全国ランキングの取得結果の控え(表示用。無くても取り直す)。**保存する形は軽くする**(下記) |
| `mh_bond_live_sync_v1` | object / `{version:1,sent:{}}` | 絆Lv・総合力ランキング(`bond_levels`)へリアルタイムで送った行の指紋。見出しは「ブリーダー名＋個体ID」、値は行の内容から作った短い文字列。前と同じ行は送らないために使うだけで、壊れていたら空から数え直す(全員を1回送り直すだけで記録は壊れない)。送れた行だけ覚える(2026-09-27) |
| `mh_battle_score_shrink_migrated_v1` | boolean / `false` | スコアを全モード 1/1000 にした(2026-10-03)ときの、端末に残した数字の一度きりの移行が済んだか。縮めるのは `mh_hs_*` / `mh_quick_hs_*` / `mh_pro_hs_*` / `mh_extreme_hs_*` / `mh_species_challenge_progress_v1` の `bestScore` / 送信待ちの `mh_rank_<難易度>`(タクティクス・モンヒロビートは除く)。`mh_ranking_cache` は捨てて取り直させる。縮めた値とこのフラグは1つの取引で書く(途中で止まっても二重に縮まない)。ランキング側の数字は `docs/sql/rankings/SCORE_SHRINK_*.sql` で別に縮める |
| `mh_pro_last_party` | object / `EMPTY_PRO_LAST_PARTY` | プロモードで最後に使った編成(`normalizeProLastParty`) |
| `mh_pro_pick_prefs_v1` | object / `{recent:[],fav:[]}` | プロモードの勇者モン・供モンえらびの「前回使った子」(`recent`・最大8)と「お気に入り」(`fav`)。モンスターIDの配列。壊れている・無いときは空で読む(`readProPickPrefs`) |
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
| `mh_rhythm_settings_v1` | object / `DEFAULT_RHYTHM_SETTINGS` | モンビーの演奏設定(`normalizeRhythmSettings`)。2026-09-27 に `roadWidth`(`WIDE`/`STANDARD`/`NARROW`、横画面の道の幅)を足した。2026-10-27 に `roadDepth`(`NORMAL`/`DEEP`、道の奥行き。無い・知らない値は `NORMAL`)を足した。無い・知らない値は `WIDE`(それまでと同じ幅)へ補う。2026-09-28 に `noteSeHoldVolume`(押さえている間の溜める音の大きさ・0〜200・既定100)を足した 2026-10-03 に `multiLightLook`(boolean・既定 `true`。みんなで対戦のライブだけ見た目を「軽さ優先」に重ねる)を追加。無い既存の保存値は既定値で補う。2026-10-04 に `modeSelectArt` / `modeSelectComment`(boolean・既定 `true`。モードえらびの助手の立ち絵とコメントを出すか。無い保存値は `true` で補う)を追加。2026-10-03 に `multiLook`(`LIGHT`/`STANDARD`/`VIVID`/`OWN`・既定 `LIGHT`。対戦の演出の段階)を追加。無い保存値は `multiLightLook` から決める(ON→LIGHT・OFF→OWN)。選び直すときは `multiLightLook` も合わせて書く |
| `mh_rhythm_select_v1` | object / `DEFAULT_RHYTHM_SELECT_VIEW` | 曲えらび画面の見え方(並び順など) |
| `mh_rhythm_last_difficulty_v1` | string / `''` | 曲えらびで最後に選んだ難易度(2026-10-11)。`EASY`〜`MASTER` だけを入れる。無い・壊れている・公開していない難易度(HELL など)は `''` に正規化して EASY から(`normalizeRhythmLastDifficulty`)。デバッグの全解放の曲えらびの選択は入れない |
| `mh_rhythm_best_v1` | object | 曲×難易度ごとの BEST(`normalizeRhythmBestRecords`) |
| `mh_rhythm_best_v2` | object | 刻みの数え方(2026-10-17・ホールド・スライドの刻みもノーツとして数える)の BEST。形は `mh_rhythm_best_v1` と同じ(`normalizeRhythmBestRecords`)。切り替えの時刻(`RHYTHM_TICK_SWITCH_AT`)を過ぎて始めた演奏の記録だけが入る。`mh_rhythm_best_v1` は消さず書き換えない(旧記録)。読むときは v2 に v1 のクリア・称号の印だけを重ねる(`loadRhythmBestRecordsNow`) |
| `mh_rhythm_tick_preview_proto` | `'1'` / 未設定 | 確認用(デバッグ・自動演奏)。`'1'` なら切り替えの時刻より前でも刻みの数え方で遊ぶ(そのあいだはランキングへ送らない) |
| `mh_rhythm_achievements_v1` | object / 空の台帳 | モンヒロビートの実績の台帳(2026-10-05・`docs/spec/RHYTHM_ACHIEVEMENTS.md`)。`{v:1, items:{'曲:難易度:称号':{at:取った時刻ms(0=不明)}}, claimed:{'実績のid#報酬ルールのid':受け取った時刻ms}}`。称号は fullCombo・allExcellent・allMarvelous(上の称号は下の称号も含む)。**取れたかの正本は BEST のまま**(BESTには何も足さない)。受け取り済みの印は消さない。壊れた項目は読まずに捨てる。台帳が無い人は、モンヒロビートを開いたときに BEST から取り込む(1度きり・時刻は不明の0) |
| `mh_rhythm_monsters_v1` | string[] | モンスターノーツ用のマスモン枠(`data/rhythm-mode.js`) |
| `mh_rhythm_rank_pending_v1` | object[] | 全国ランキングへ送れなかったモンビーの記録(次回に再送) |
| `mh_rhythm_multi_penalty_v1` | object / `null` | みんなで対戦(マルチ)で、公開ルームのライブを途中でやめたときの入室待ち `{ until: 時刻(ms) }`。3分を超える値・壊れた値は0扱い(`rhythmMultiPenaltyLeftMs`)。2026-10-02 追加 |
| `mh_rhythm_multi_record_v1` | object / `null` | みんなで対戦の記録(2026-10-03 追加)。`{ lives, mvp, bestAvg, bestStreak, lastRound, recent:[{at, round, songId, avg, score, n, streak, mvp, quit, names}] }`。最近は30回ぶん。読むときは `rhythmMultiNormalizeRecord` を通し(無い・壊れた値は0から)、同じ回(`round`)は2度数えない(`rhythmMultiAddRecord`) |
| `mh_rhythm_buddy_v1` | object / `null` | マルチに呼んだマスモンのビートLvなど(2026-10-07 追加・docs/spec/RHYTHM_BUDDY.md)。`{ day, used, mons:{ [マスモンid]: { exp, lives, songs:{曲id:回数}, diffs:{EASY…MASTER:回数}, best:{EASY…MASTER:{score,songId}}(2026-10-07 追加。無い人は最近のスコアから拾い直す), longLives, trait, traitAt, lastRound, lastDay, firstAt } } }`。`day`/`used` は1日の無料回数(朝5:00区切り)。マスモン本体(`mh_masu_mons`)には書かない。読むときは `rhythmBuddyNormalize` を通し(無い・壊れた値は既定値)、同じ回(`lastRound`)は2度育てない(`rhythmBuddyApplyLive`) |
| `mh_rhythm_buddy_seen_v1` | boolean | 「マスモンを呼べるようになった」の一度きりの案内を見たか(2026-10-07 追加) |
| `mh_rhythm_buddy_rank_sync_v1` | object / `null` | マスモンランキング(`rhythm_buddy_ranks`)へ送った行の指紋(2026-10-07 追加)。`{ version, sent:{ "<名前>\u001f<個体ID>": "<指紋>" } }`。壊れていたら空から(全員を1回送り直すだけで、記録は壊れない)。`normalizeRhythmBuddyRankSync` を通して読む |
| `mh_rhythm_buddy_rank_seen_v1` | boolean | マスモンランキングの見かたの一度きりの案内を見たか(2026-10-08 追加) |
| `mh_rhythm_buddy_talk_seen_v1` | boolean | マスモンのおしゃべりの使い方の一度きりの案内を見たか(2026-10-08 追加) |
| `mh_rhythm_multi_select_sec_v1` | number / `null` | マルチでホストが決めた選曲の制限時間(秒。2026-10-07 追加)。`30` / `60` / `90` / `0`(なし)のどれか。次に部屋をつくるときのはじめの値。読むときは `rhythmMultiNormalizeSelectSec` を通す(無い・壊れているときは30) |
| `mh_masu_beat_list_v1` | object / `null` | マスモン一覧(モンヒロビート)の並べ替え・しぼりこみ(2026-10-07 追加)。`{ sort, dir, lineage, played, traits[], moods[], view }`(`view` は `'list'` か `'card'`。2026-10-07 追加)。読むときは `rhythmBuddyNormalizeListSettings` を通す(知らない値は既定値) |
| `mh_rhythm_perf_v1` | boolean / `false` | 性能計測(デバッグ限定)の ON/OFF |
| `mh_rhythm_chart_notes_v1` | object / `{}` | 譜面メモ(デバッグ限定・2026-09-26)。`曲id|難易度` → 区間ごとの 👍/👎 とひとことメモ。譜面の作り直しを見分ける `fingerprint` 付き(`normalizeRhythmChartNotes`) |
| `mh_rhythm_play_log_device_v1` | string / 無し | 遊んだ記録(2026-09-28)の端末ごとのでたらめなID(英小文字と数字20文字)。記録の送信(`rhythmPlayLogSend`)だけが使い、無い・形が違うときは作り直す。名前・ブリーダーIDとは結び付かない(`docs/spec/RHYTHM_PLAY_LOG.md`) |
| `mh_rhythm_touch_diag_v1` | array / `[]` | タッチの診断(2026-09-30・`docs/spec/RHYTHM_TOUCH_DIAG.md`)。演奏1曲ごとに、ポインタとタッチの突き合わせ・遅れ・取り消し・入力の無いMISSの数をまとめたもの。直近20曲だけ持つ。配列でない・要素がオブジェクトでないものは読まずに捨てる。判定・スコア・ランキングには使わない。2026-10-01から、要素の `stats` に `playId`(1曲ごとの番号)と `fixes`(効いていた直し方)が入り、リザルトの「押したのに反応しないことがあった」を押した曲には `reported:true` が付く(どれも項目を足しただけ。無い古い要素はそのまま読む) |
| `mh_sky_tap_style_proto` | string / 無し(`plate`) | 空中ノーツの見た目の案(2026-10-10・空中ノーツの試作)。**ゲームは読むだけで書かない**。手で入れたときだけ、空中のノーツ・空中の面の色の案が変わる(`gold`・`ruby` など)。無い・知らない値なら既定の `plate`。記録・判定には関わらない |
| `mh_rhythm_event_notice_v1` | string / `''` | 曲えらびで「今週の対象曲」の案内を見たイベントのID(週が変わると新しいIDになり、その週の初回にもう一度だけ出る。`docs/spec/RHYTHM_RANKING.md` §10.2) |
| `mh_changelog_timed_seen_fix_v1` | boolean / `false` | `visibleFrom` 付きの更新履歴（時刻が来てから出る項目）を、一度きりで未読へ戻したか。開始前に一覧を開いた端末で既読になり、公開時刻にNEWが付かなかったための補正フラグ（二重適用を防ぐ） |
| `mh_rhythm_event_story_v1` | string[] / `[]` | イベントの会話ストーリーを最後まで見たイベントのID(開催中に1度だけ流すためのフラグ。回想からはいつでも見られる) |
| `mh_rhythm_event_points_v1` | number / `0` | モンヒロビートの共通ビートP残高。プレイヤー向け名称のみ旧「イベントP」から変更し、互換性のため保存キーは維持する。0以上の整数へ正規化し、イベント終了時もリセットせず次回へ持ち越す。2026-10-26 から MFバトルカードの支払い・受け取りもこの残高(書く直前に読み直して差だけ足す)。`docs/spec/RHYTHM_EVENT_POINTS.md` |
| `mh_rhythm_event_reward_v1` | string[] / `[]` | イベント報酬を受け取り済みのイベントID。二重受取を防ぐためのフラグ(入賞しなかった場合もここへ入れて、問い合わせ直さないようにする。`docs/spec/RHYTHM_RANKING.md` §9.1) |
| `mh_rhythm_canvas_v1` | `'canvas'` / `'dom'` / 未設定 | デバッグ画面の「ノーツの描き方」の上書き(未設定なら公開フラグに従う) |
| `mh_rhythm_gpu_band_v1` | `'gpu'` / `'off'` / 未設定 | デバッグ画面の「スライドの帯の描き方(検証用)」。未設定 = 既定(2026-10-11 から、ノーツを WebGL で描いているときは帯・区切りの線・ノーツの板を GPU で描く)。`'gpu'` = 描画方式に関係なく WebGL+GPU。`'off'` = 使わない |
| `mh_rhythm_floor3d_proto_v1` | `'on'` / `'on2'` / `'on3'` / `'a3d'` / `'c3'` / `'c3b'` / 未設定 | デバッグ画面の「床と空中の見た目(試作)」(2026-10-16)。`'on'` = 地上のノーツを床に寝た台形・空中のノーツを側面と厚みのある箱にする(色は今のまま・見た目だけ)。`'on2'` = 試作2(空中の真下の濃い影と導線・宙に立った箱・空中スライドの床の影と幕。GPU の帯は使わない)。`'c3b'` = 案3の2段目(1段目+カメラを寝かせる。道の遠近と押す場所を同じ計算で替える)。`'c3'` = 案3(空中のタップを明るく薄い板と光る縁・空中スライドを光の帯。GPU の帯は使わない)。`'a3d'` = 段階A(空中のタップ・スライドを WebGL の本物の3D で。地上は今のまま)。`'on3'` = 試作3(空中の層のガラスの床と道の端の柱・空中の立方体・空中スライドの管。GPU の帯は使わない)。未設定 = 今の見た目。演奏を始めるときに1回読む。判定・入力には使わない |
| `mh_rhythm_sky_note_look_v1` | `'3d'` / `'normal'` / 未設定 | モンヒロビートの設定「空中のノーツの見た目」(2026-10-17)。`'3d'` = 立体(段階A: 空中のタップを光の当たる箱・空中スライドを丸い管。ノーツを WebGL で描くときだけ)。未設定・`'normal'`・壊れた値 = いつもの。既定の「いつもの」を選ぶとキーを消す。未設定で `mh_rhythm_floor3d_proto_v1` が `'a3d'` の端末は立体として読む。選び直すと `mh_rhythm_floor3d_proto_v1` の `'a3d'` だけを消す(ほかの試作の値は残す) |
| `mh_rhythm_mon_layers_v1` | `'on'` / 未設定 | デバッグの「🧪 確認待ちの試作」の「モンスターノーツのかくつきの手当て」(2026-10-16)。`'on'` = 両サイドのマスモンの絵と光の輪を曲の前から GPU の層にしておく(見た目は同じ)。未設定 = 今まで |
| `mh_rhythm_mon_ab_v1` | `'1'` / `'2'` / 未設定 | デバッグの「🧪 確認待ちの試作」の「モンスターノーツのかくつき調べ(1)(2)」(2026-10-27)。入れた日だけ、1曲の中のモンスターノーツごとに叩いた瞬間の演出を1つずつ止め、止めた物を実機の記録(stats.mon の i.ab)に控える。`'1'` = 跳ね/能力名/光の輪/止めない、`'2'` = 金色の光/音/カットイン/全部。見た目と音だけで、判定・スコア・ライフ・能力の効き目・保存は変えない。演奏を始めるときに1回読む |
| `mh_rhythm_prepare_v1` | `'on'` / `'off'` / 未設定 | デバッグ画面の「演奏前の準備(検証用)」(未設定なら既定。2026-10-11 から する) |
| `mh_rhythm_canvas_hits_v1` | `'canvas'` / `'dom'` / 未設定 | デバッグ画面の「叩いたときの光の描き方(検証用)」。未設定 = 既定(2026-10-11 から canvas)。`'dom'` = 今までどおり画面の要素で光らせる |
| `mh_rhythm_hit_spark_v1` | `'on'` / `'off'` / 未設定 | デバッグ画面の「叩いたときの光の粒(検証用)」。`'on'` = 焼いた丸を貼る(軽い)・`'off'` = 今の形・未設定 = 既定(今の形)。2026-10-12 |
| `mh_rhythm_stage_gl_v1` | `'css'` / `'webgl'` / 未設定 | デバッグ画面の「ライブ背景の描き方」の上書き(未設定ならノーツが WebGL のときだけ WebGL) |
| `mh_rhythm_look_intro_seen_v1` | `true` / 未設定 | 曲えらびで一度だけ出す「見た目の設定」の助手の案内を見たか(未設定なら出す) |
| `mh_rhythm_play_defaults_restored_v1` | `true` / 未設定 | モンヒロビートの設定の一度きりの戻し(ライブ背景「派手」→「シンプル」・フレームレート「省電力」→「端末に合わせる」。保存値がその当時の既定と同じときだけ)を済ませたか。二度走らせないためのフラグ(`restoreRhythmPlayDefaultsOnce`) |
| `mh_rhythm_six_lane_seen_v1` | `true` / 未設定 | 道が6レーンになり MASTER に横フリックが出ることを、曲えらびで一度だけ伝える助手の案内を見たか(未設定なら出す) |
| `mh_tactics_intro_seen_v1` | `true` / 未設定 | タクティクスバトルの導入会話を見たか(β公開後に1度だけ流す) |
| `mh_rhythm_hell_story_seen_v1` | `true` / 未設定 | 難易度 HELL のお話「空まで届くビート」を見たか(2026-10-11。HELL の公開まで読み書きしない。デバッグから見たぶんは立てない) |
| `mh_rhythm_hell_story_seen_preview_proto` | `true` / 未設定 | デバッグの「公開の印が真だったら」で HELL のお話を見たか(2026-10-12)。本番のキー `mh_rhythm_hell_story_seen_v1` とは別にして、試した人が公開のときに見そびれないようにする |
| `mh_rhythm_hell_best_rescaled_v1` | `true` / 未設定 | 一度きりの移行の完了の印(2026-10-12)。HELL の満点を 110万→105万にしたので、`mh_rhythm_best_v1` の各曲の `HELL.bestScore` を一度だけ 105/110 倍(切り捨て)に縮める。印を先に立ててから書き直すので二重に縮めない。5難易度の記録には触らない。記録が無い端末にも印だけ立つ(起動時の移行・60-app.jsx。計算は `rescaleRhythmHellBestScores`) |
| `mh_rhythm_hell_preview_proto` | `'1'` / 未設定 | デバッグ専用。HELL の「公開の印が真だったら」を試す(2026-10-12)。本番の印 `RELEASE_FLAGS.rhythmHell` は変えない |
| `mh_sky_box_look_proto` | `'z'`・`'a'`・`'c'` / 未設定 | デバッグ専用。SKY TAP の見た目の案を見比べるための選択(2026-10-11)。未設定なら既定の案B(赤い板・社長の決定)。ふつうのプレイは書かない |
| `mh_sky_lane_look_proto` | `'none'`・`'a'`〜`'c'`・`'d1l'`・`'d1m'`・`'d2l'`・`'d2m'`・`'el'`・`'elp'` / 未設定 | デバッグ専用。空中のレーンの見せ方の案を見比べるための選択(2026-10-11)。未設定なら案E はっきり(`'em'`・2026-10-12 社長の決定で既定。それまでは「なし」)。ふつうのプレイは書かない **2026-10-13 からは、HELL の公開後にオプションの「表示」タブ「空中の道の見え方」(はっきり=em・控えめ=el・なし=none だけを書く)からも書く**(キー・値の意味・既定は変えない。「保存」を押したときに書く) |
| `mh_hell_vis_proto` | `'now'`・`'v1'` / 未設定 | デバッグ専用。HELL の見やすさの案(空中の判定線の長さ・空中の板の明るさ・空中スライドの色・板の影)を見比べる(2026-10-12)。未設定なら案2 はっきり(`'v2'`・2026-10-12 社長の決定で既定)。ふつうのプレイは書かない |
| `mh_hell_sky_hit_proto` | `'on'`(短い柱)・`'far'`(奥まで)・`'off'` / 未設定 | デバッグ専用。HELL で空中を叩いたときに、空中の線の高さにレーンの柱の光を出す案を見比べる(2026-10-12)。未設定なら奥まで(2026-10-12 夜 社長の選択。その前は短い柱が既定。切を選ぶと `'off'` を保存する)。ふつうのプレイは書かない **2026-10-13 からは、HELL の公開後にオプションの「軽さ・演出」タブ「空中を叩いた柱の光」からも書く**(キー・値の意味・既定は変えない。「保存」を押したときに書く) |
| `mh_rhythm_sky_line_offset_v1` | 数(画面の高さの%・0.5刻み・-60〜60。2026-10-14 に ±8 から広げた。古い版は ±8 に丸めて読む)/ 未設定 | モンヒロビートの「空中の判定ライン」(2026-10-14)。実際の高さは画面に収まるよう `rhythmSkyLiftWith` で抑える。HELL の空中の判定線を、地上の判定線からの高さ(`RHYTHM_SKY_LIFT`)に足し引きしてずらす。上が+。空中のノーツ・空中の線・空中を受け付ける範囲が一緒に動く(地上を受け付ける範囲は動かない)。未設定・0なら今の位置(0のときはキーを消す)。数でない・範囲の外は正規化(`rhythmNormalizeSkyLineOffset`)。オプションの「保存」で書く |
| `mh_rhythm_ground_accept_pct_v1` | 数(%・5刻み・50〜100)/ 未設定 | モンヒロビート(HELL)の「地上を受け付ける範囲の広さ」(2026-10-14)。地上の線より上へはみ出して受け付けている部分だけを縮める(100が今の広さ・上限)。未設定・100なら今までどおり(100のときはキーを消す)。数でない・範囲の外は正規化(`rhythmNormalizeAcceptWidth`)。空中の範囲を狭めたときは、案A の自動の動きも狭めた範囲の外へは広げない。オプションの「保存」で書く |
| `mh_rhythm_sky_accept_pct_v1` | 数(%・5刻み・50〜100)/ 未設定 | モンヒロビート(HELL)の「空中を受け付ける範囲の広さ」(2026-10-14)。空中の線より下へはみ出して受け付けている部分だけを縮める(100が今の広さ・上限)。未設定・100なら今までどおり(100のときはキーを消す)。数でない・範囲の外は正規化(`rhythmNormalizeAcceptWidth`)。空中の範囲を狭めたときは、案A の自動の動きも狭めた範囲の外へは広げない。オプションの「保存」で書く |
| `mh_rhythm_sky_accept_top_pct_v1` | 数(%・10刻み・50〜300)/ 未設定 | モンヒロビート(HELL)の「空中の受付の上の端」(2026-10-14)。空中のノーツを受け付ける上の端を、空中の線から上へ画面の高さの20%×この値(%)にする。未設定・100なら既定(100のときはキーを消す)。数でない・範囲の外は正規化(`rhythmNormalizeSkyAcceptTop`)。オプションの「保存」か、演奏画面での合わせの「保存して戻る」で書く |
| `mh_sky_tap_distinct_proto` | `'white'`・`'block'`・`'deep'` / 未設定 | デバッグ専用。空中のタップを上フリックと見分けやすくする板の案(白い板/厚い赤い角材/深い赤+太い白い縁)を見比べる(2026-10-12)。未設定なら今のまま。ふつうのプレイは書かない |
| `mh_flick_up_color_proto` | `'fuchsia'`・`'silver'`・`'lemon'`・`'white'` / 未設定 | デバッグ専用。上フリックの色の案(マゼンタ紫/白銀/レモン黄/白)を見比べる(2026-10-12)。未設定なら今のピンク。読み込み時に1回だけ読む。ふつうのプレイは書かない。**同日の社長の決定(上フリックはピンクのまま)で切り替えを外し、いまは読まない**(端末に残った値は無視される) |
| `mh_sky_note_color_proto` | `'off'`・`'thin'`・`'k1'`・`'k2'`・`'k3'`(・既定と同じ `'deep'` は書かない)/ 未設定 | デバッグ専用。HELL の空中のノーツの色の組を見比べる(2026-10-12)。**未設定なら deep=空中のタップ 深い赤・縁を細く薄く(同日の社長の決定で既定。右手の空中の長押しは桃のまま)**。off=前の見た目(明るい赤・白い縁)/thin 前の色で縁だけ薄く/組1 タップ深い赤・右手マゼンタ紫/組2 タップ白銀・右手深い赤/組3 タップ深い赤・右手白銀(組はどれも白い縁を細く薄く)。既定以外を選んだ人の値はそのまま使う。既存のデータは読まない・変えない |
| `mh_monster_note_gold_proto` | `'goldGlow'`・`'now'`(・前の版で書いた `'gold'`)/ 未設定 | デバッグ専用。マスモンのノーツの形を見比べる(2026-10-12)。**未設定なら金の板(同日の社長の決定で既定)**。`goldGlow`=金の板+強い光・`now`=前の形(琥珀色)を選んだ人の値はそのまま使う。読み込み時に1回だけ読む。ふつうのプレイは書かない |
| `mh_hell_sky_text_proto` | `'above'` / 未設定 | デバッグ専用。HELL の空中の判定の文字の位置(2026-10-12)。未設定なら空中の線のすぐ下(社長の決定で既定)。`'above'` は前の位置(線の38px上) **2026-10-13 からは、HELL の公開後にオプションの「表示」タブ「空中の判定の文字の位置」からも書く**(キー・値の意味・既定は変えない。「保存」を押したときに書く) |
| `mh_rhythm_judge_text_pos_proto` | `'raise'`・`'fade'`・`'both'` / 未設定 | デバッグ専用。地上の判定の文字の置き場所の案(道の中ほどへ上げる/半分透かす/両方)を見比べる(2026-10-12)。未設定なら今の位置。空中のある譜面では効かない。ふつうのプレイは書かない |
| `mh_rhythm_judgment_snap_v1` | `'on'`・`'off'` / 未設定 | デバッグ専用。判定の文字の大きさを、なめらかに変えず一度で変える(2026-10-12・ドライバーくん #2842・発熱の手当て)。未設定なら一度で(2026-10-12 社長の決定で既定に。`'off'` を保存した人は今までの形のまま)。ふつうのプレイは書かない |
| `mh_rhythm_input_rec_v1` | `'on'` / 未設定 | デバッグ専用。モンヒロビートの演奏中の入力(指の時刻・位置・接触の幅)と判定の出来事を記録する(2026-10-15・ドライバーくん)。記録そのものは保存せずメモリに最後の1曲分だけ持ち、デバッグ設定の「最後の演奏の記録をコピー」で取り出す。判定・スコア・ランキングには使わない。ふつうのプレイは書かない |
| `mh_bgm_light_v1` | `'on'` / 未設定 | デバッグ専用。場面のBGM(タイトル・ホーム・バトルなど)を軽く持つ(24kHz に落とし、持つのは2本まで)(2026-10-16・ドライバーくん・社長の決定「案1＋案2」)。未設定なら今までどおり。モンヒロビートの曲・効果音には効かない。ふつうのプレイは書かない |
| `mh_debug_entry_v1` | `'1'` / 未設定 | デバッグ専用。デバッグ設定を一度でも開いた端末だけ、設定の画面に「🧪 デバッグ設定」の入口を出す(2026-10-16・ドライバーくん)。ふつうのプレイは書かない |
| `mh_debug_unlocked_v1` | `'1'` / 未設定 | デバッグ専用(2026-10-20)。デバッグ設定の入口で合言葉が合った端末だけ `'1'`。次から合言葉を聞かない。合言葉そのものは保存しない |
| `mh_debug_trials_seen_v1` | 文字の配列 / `[]` | デバッグ専用。デバッグ設定の「確認待ちの試作」で、入/切を一度でも押した試作の id(NEW の印を外すため)(2026-10-16)。配列でない・文字でない要素は捨てて読む。最大100件 |
| `mh_debug_menu_open_v1` | 文字の配列 / `[]` | デバッグ専用。デバッグメニューで開いたままにしているまとまりの id(`monster-look`・`battle` など。2026-10-27)。この端末の見た目だけで、遊び・記録には関わらない。壊れていれば全部閉じた状態で始める |
| `mh_tactics_hate_proto_v1` | `'on'` / 未設定 | デバッグの「🧪 確認待ちの試作」の「タクティクスのヘイト(試作)」(2026-10-17)。`'on'` = タクティクスバトルで、目立った子ほど狙われやすくなり、名前の横に🔥が出る(数字は `TACTICS_HATE`)。未設定 = 今までの狙い方。ヘイトの値そのものはバトル中だけで保存しない。**2026-10-18 に公開してからは読まない**(公開の印 `RELEASE_FLAGS.tacticsHate` で全員に効く)。キーは消さず残す |
| `mh_monster_type_proto_v1` | `'on'` / 未設定 | デバッグの「🧪 確認待ちの試作」の「モンスターのタイプ表記(試作)」(2026-10-17)。`'on'` = 図鑑・図鑑の詳細・パーティ選びにタイプの印を出す(表は `MONSTER_TYPES` / `MONSTER_TYPE_OF`)。未設定 = 出さない。タイプはタクティクスのヘイトの増え方にだけ効き、印の入/切とは関係なくヘイトの試作が入なら使われる。**2026-10-18 に公開してからは読まない**(公開の印 `RELEASE_FLAGS.tacticsHate` で全員に出る)。キーは消さず残す |
| `mh_sky_reach_adapt_proto` | `'1'` / `'0'` / 未設定 | HELL の空中の受け付けの下の境目を、その人の構えに合わせて下げる(案A・2026-10-12・テンポくん)。**未設定なら入**(2026-10-12 社長の決定で既定を入に)。`'0'` は切(固定の境目)を選んだ人。デバッグの切り替えで書く。前は切を選ぶとキーを消していたので、その人も未設定=入になる |
| `mh_tactics_ex_intro_seen_v1` | `true` / 未設定 | タクティクスで「距離枠をタップするとEXが開く」を一度だけ伝える案内を見たか(公開フラグ `tacticsExSkills` と同じで出し入れ) |
| `mh_profile_frame_v1` | string / `'none'` | 選んでいるプロフィールフレームのid(`data/breeder.js` の `PROFILE_FRAMES`)。ブリーダーアイコン(`mh_breeder_icon`)とは**独立した設定**で、アイコン側のキーは触らない。読み込みは必ず `normalizeProfileFrameId` を通し、値が無い・壊れている・知らないid・未公開(`released:false`)のidはすべて `'none'`(フレームなし)へ倒す |
| `mh_quick_rhythm_intro_seen_v1` | boolean / `false` | クイック∞周回とモンビーの連携の案内(バトル画面)を見たか |
| `mh_quick_rhythm_bg_seen_v1` | boolean / `false` | 裏で周回したままモンビーを開いたときの案内を見たか |
| `mh_screen_note_open_v1` | object / `{}` | 画面ごとの「詳しく」を開いているか(画面idごとの真偽値) |
| `mh_ranking_debug` | `'1'` のとき有効 | ランキングの詳細ログ(手で `localStorage` に入れるデバッグ用。ゲームは書かない) |
| `mh_masu_auto_enhance_intro_seen_v1` | boolean / `true` | マスモンの自動強化の案内を見たか。**既定値は `true`**(保存が無いときに「見た」扱いにすると案内が誰にも出ないため、読み込み側で未保存を判別してから出す) |
| `mh_profile_frame_owned_v1` | string[] / `[]` | 手に入れたプロフィールフレームのid。**一度もらったら外さない**(条件を変えても取り上げにならないよう、「いまのLv」ではなく「もらった記録」を持つ)。`normalizeOwnedProfileFrames` を通す |
| `mh_assistant_costume_owned_v1` | string[] / `[]` | 買った助手の着替え(服)のid。**一度買ったら外さない**。`normalizeOwnedAssistantCostumes` を通す。マーケット(ダイヤショップ・ビートP交換所)で買うたびに、保存を読み直して足す |
| `mh_assistant_costume_worn_v1` | object / `{}` | 助手ごとに今着ている服 `{ 助手id: 服id }`。無い助手は元の服。`normalizeWornAssistantCostumes` を通し、持っていない服・その助手の服ではないもの・消えた服は読み捨てて元の服へ戻す |
| `mh_assistant_costume_unlocked_v1` | string[] / `[]` | 解放が要る服(MFバトルカードでみゅあの MASTER に勝つと並ぶ服など。2026-10-27)のうち、解放したもののid。**足すだけで消さない**。`normalizeUnlockedAssistantCostumes` を通す。書くのは MFバトルカードの助手と対戦の精算(`assistantCostumeUnlockEntry`)だけ。読むときは、このキーに入っているか、`mh_card_record_detail_v1` の `foes[相手].levels[難易度]` が1以上、または `mh_card_record_v1` の最近の30戦(`recent`)にその相手・難易度の勝ちがあれば解放とみなす(前から勝っている人のため。カードの記録は2つとも読むだけで書き換えない) |
| `mh_profile_frame_notice_v1` | string[] / `[]` | フレームをもらったことを知らせ終えたid。枠ごとに覚える(1つのidで既読にすると2枚目以降が知らされない) |
| `mh_rhythm_clear_total_v1` | number / `0` | モンヒロビートの通算クリア回数(2026-10-03・スエゾービートのフレームを買える条件「10回クリア」に使う)。**この更新から数えはじめる**(既存の `mh_rhythm_best_v1` は曲×難易度ごとのクリア有無しか持たず、回数が分からないため。過去の分は入れない)。ライフを残して終えた演奏だけ+1(練習・アシストモード・失敗は数えない)。`normalizeRhythmClearTotal` を通す。減らさない・消さない |
| `mh_update_notice_style_v1` | `'FULL'` / `'MINI'` / `'OFF'` / 既定 `'FULL'` | 更新のお知らせの出し方(`normalizeUpdateNoticeStyle` で既定へ倒す) |
| `mh_rhythm_strip_v1` | object / `{}` | モンヒロビートの見た目をデバッグ画面で間引く設定。ふだんは空で、通常プレイでは何も起きない(既存の音ゲー設定・BESTには触らない別キー) |
| `mh_battle_select_assist_v1` | object / 未設定なら `{ modeSelectArt:true, modeSelectComment:true }` | モンヒロバトルの入口(`BATTLE_SYSTEM_SELECT`)で、助手の立ち絵・コメントを出すか(2026-10-08)。入口のトグルを押したときに書く。読むときは `false` のときだけ消し、それ以外・壊れた値は出す側へ倒す。モンヒロビート用のキーは流用しない |
| `mh_masu_offering_intro_seen_v1` | `true` / 未設定 | 神殿の「お布施」の使い方案内を見たか(2026-10-05)。初めてお布施の画面を開いたときに1度だけ出し、閉じたときに `true` を書く。読むときは `=== true` のときだけ見た扱い |
| `mh_rhythm_fix_override_v1` | object / 未設定なら `{}` | モンヒロビートの「実機でしか分からない直し方」(`RHYTHM_TOUCH_FIXES`)を、この端末だけで入れる/切る上書き(2026-10-07)。`{ 直し方の名前: boolean }`。**`storeSet` ではなく `localStorage` へ直接**書く(`rhythmTouchFixSetOverride`)。読むときは表にある名前の boolean だけ拾い、それ以外・壊れた値は捨てる(上書きなし=表のとおり)。いまゲームの画面からは書かない(検査と手で試すとき用) |
| `mh_sky_lift_portrait_proto` | 文字列 `'25'` / `'39'` / 未設定(=16%) | **デバッグ専用**。縦画面の空中の段の高さの差(道の高さの 16%・25%・39%)を見比べる切り替え(2026-10-11・HELL の試作)。音ゲーデバッグの「プレイ」タブの切り替え(`RhythmSkyLiftSwitch`)だけが `localStorage` へ直接書き、16% を選ぶとキーを消す。読むときは `25`・`39` 以外(未設定・壊れた値)を 16% として読む(`rhythmSkyLiftPortrait`)。空中の段がある譜面(デバッグの試作の枠)だけに効き、通常プレイには何も起きない |
| `mh_assistant_bubble_mode_v1` | `'ALWAYS'` / `'DAILY'` / `'OFF'` / 既定 `'ALWAYS'` | 助手の吹き出し(画面ごとのひとこと)の出し方(2026-10-10・改善G6)。設定画面のボタンで書く。`normalizeAssistantBubbleMode` で既定へ倒す。はじめての案内・`…Intro` の場面・HOMEの助手・助手の告知には効かない |
| `mh_assistant_bubble_seen_v1` | object / 未設定なら空 | 「1日1回」のときに、その日に出した場面 `{ day:'YYYY-MM-DD'(朝5:00区切り), scenes:[場面のキー] }`。日が違う・壊れた値は空として読む(`normalizeAssistantBubbleSeen`) |
| `mh_bubble_collapsed_v1` | object / 未設定なら空 | 助手の吹き出しを「小さくたたんだ」売り場の印 `{ 'market:event':true, 'help':true, … }`(2026-10-26 開発部 k02・e01。ヘルプの上の助手は 'help'。たたんだものだけ入れ、ひらけば消える)。キーは画面ごとの `collapseKey`。object でない・値が `true` でないものは捨てて「ひらいたまま」として読む(`normalizeBubbleCollapsed`)。既存のキーは触らない |

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

### はじめての人には7〜8月のお詫びを配らない（2026-10-09）

全員へ配る `COMPENSATION_GIFTS` のうち、固定の4件（`NEW_PLAYER_WAIVED_COMPENSATION_IDS`）は、これからはじめる人には配らない。
その人の分は、はじめての設定を終えたとき「プレオープン記念」のギフトへ合計を足す（ダイヤ1,000・スキップチケット 序2/破2/急7・染色もどき5）。

- **新しい保存キー `mh_compensation_waived_v1`**（配らなかったお詫びのidの配列）を足した。既存のキーは変えていない
- 控えに入れるのは「はじめて遊ぶ人（`compensationEverPlayed` が false）の起動時に、ギフトボックスに無かったid」だけ。
  すでに遊んでいる人は控えに入らず、これまでどおり届く。すでにボックスにあるお詫びは取り上げない・足さない
- 控えが無いと、はじめての設定を終えた次の起動で「idが無い」とみなして配ってしまうため、控えは消さない
- 記念のギフトに足すのは「控えたid かつ ボックスに無いもの」の合計だけ。途中まで届いていた人は二重にならない
- これから足すお詫び（新しいid）は控えの対象ではないので、はじめての人にも普通に届く
- 記念のギフトの定義（`NEW_PLAYER_CAMPAIGN_GIFT`）は変えていない。足すのは作るときだけで、以前に受け取った人のギフトは変わらない

### その人だけに届くお詫び（2026-09-21）

不具合の影響が特定の人にだけ出たときは、全員へ配る `COMPENSATION_GIFTS` とは別の `PLAYER_COMPENSATION_GIFTS` へ1件足す。項目は `playerIds` を持ち、タイトル画面に出している PLAYER ID（`mh_player_id`）が一致した端末でだけ `grantPlayerCompensationGifts` がギフトボックスへ入れる。受け取りは通常のギフトと同じ `buildGiftClaim` を通るので、ダイヤは `gold` へ**加算**される。

- PLAYER ID は `window.localStorage` へ直接書いているため、読むときも同じ経路で読む（`storeGet` ではない）。判定するだけで、ここでは作らない
- 新しい保存キーは作らない。二重配布はギフトidで防ぐ（固定id。既に `mh_gifts` にあれば足さない。受取済みでも再配布しない）
- 受取期限は付けない（`expiresAt` を書かない）。受け取りそこねると取り返しがつかないため
- 項目は消さない。消すと、まだ受け取っていない端末へ再び配られてしまう
- `playerIds` は配る相手を決めるためだけのもので、保存するギフトには残さない
- 限界: 対象IDは公開リポジトリのソースに載るので、保存値を書き換えれば対象外の人でも受け取れる。金額の大きいものはそれを承知で使う
- 限界: IDは端末ごと。機種変すると別IDになり届かなくなる

検査は `tools/boot/gift-login-check.js`。

### ミッション

`mh_missions` は既存のデイリー／ウィークリーに、マンスリーの項目を追加した単一オブジェクトである。既存キーの改名・削除は行わない。`normalizeMissions` が欠損を補い、日次・週次・月次の期間が変わった部分だけを初期化する。

- 日次: `dailyPeriod`, `daily`, `sentDaily`（JST 04:00更新）
- 週次: `weeklyPeriod`, `weekly`, `sentWeekly`, `weeklyLoginDays`（月曜JST 04:00更新）
- 月次: `monthlyPeriod`, `monthly`, `sentMonthly`, `monthlyLoginDays`, `monthlyDailyCompletePeriods`, `monthlyWeeklyCompletePeriods`（毎月1日JST 04:00更新）

`daily` / `weekly` / `monthly` の数え値に `speciesClears`(種族チャレンジのクリア)を追加した(2026-09-26)。モンヒロビートはミッションに入れない(遊ぶ人が分かれるため)。いったん入れた `rhythmPlays` が残っている保存もあるが、読まないだけで害はない。値を持たない既存の保存は `emptyMissionCounts` が0で補う。タクティクスバトルのクリアは、記録(`mh_tactics_*`)は分けたまま、ミッションだけクラシックの同じモードの数え値(`challengeClears` / `proClears` / `extremeClears`)へ足す。

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

(2026-10-04・決定・未実装)イベント報酬の「魂格の結晶(仮)」も同じく `mh_owned_items` の個数で持つ。使うと `mh_masu_mons` の個体へ足す `soulBonusPoints`(0以上の整数・欠損は0・0のときは保存しない)が+1される。仕様は SOUL_RANK_SYSTEM.md §5.3.1。

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
