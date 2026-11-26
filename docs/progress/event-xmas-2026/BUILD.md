# クリスマスのレイド: 部のあいだのつなぎ目(BUILD.md)

台帳 r1119-172 / 追跡 r1125-004・r1125-041。決めたのはバトル部(ジンくん)。企画は [`PLAN.md`](PLAN.md)。
**カード部・ビート部はこの紙の名前と形でつなぐ。** 名前・引数を変えたいときは、変える前にバトル部へ知らせる(この紙を直してから)。
まだバトル部の側ができていない所は、自分の側を作り進めて、つなぐ所だけ後に回す(できたら下の「できた物」の表に PR 番号を書く)。

## 0. 前提(ジャックとの関係)

- 土台はジャック(`35-raid-jack.jsx`・`36-raid-jack-api.jsx`・`79-screen-raid-jack.jsx`・`60-app.jsx` の `finishRaidJack*`)。
  **ジャックのデータ・キー・関数の動きは変えない。** クリスマスは「新しいイベントの定義」を足し、通信と保存はジャックの関数にイベントidと保存キーを渡して使い回す
- サーバーの表はジャックと同じ `raid_jack_hits`(イベントidで分ける)。端末の保存は新しいキー `mh_raid_xmas_v1`
- 名前の頭は `raidXmas` / `RAID_XMAS_`(定数)。ジャックの `raidJack*` を直接呼ぶのは、下に書いた物だけ

## 1. イベントの定義(バトル部・`monster-hero/src/parts/35-raid-xmas.jsx`)

```js
const RAID_XMAS_EVENT = Object.freeze({
  id: 'raid_xmas_2026',             // raid_jack_hits.event_id(本番)
  debugId: 'raid_xmas_debug',       // デバッグで送るとき(本番の集計を汚さない)
  title: '聖夜の名探偵',             // イベントの名前(社長決定)。画面に出すイベント名はここを読む
  name: '黒いサンタ',                // ボスの名前(社長決定 r1126-024)。画面はここを読む(直書きしない)
  startAt: '2026-11-30T10:00:00+09:00',
  endAt:   '2026-12-31T04:00:00+09:00',
  storageKey: 'mh_raid_xmas_v1',
});
const RAID_XMAS_SOURCES = Object.freeze(['battle', 'rhythm', 'card']);  // 与ダメージの入口(表の列 source の値)
const RAID_XMAS_A_TIERS = [...5段階];   // レイドバトル(協力・共有ライフ)。形はジャックの段階と同じ { id:'a1'.., name, power, actionCount, atkPower, hp, atk }
const RAID_XMAS_B_TIERS = [...5段階];   // グランドスラム(個人・累計)。カードは入れない
raidXmasWindowAt(nowMs)   // 'before' | 'open' | 'after'(見るたびに数え直す)
raidXmasTierAt(kind, index)   // kind 'a' | 'b'、index は 0 始まり
```

- 開始時刻まで外に出さない: `RELEASE_FLAGS.raidXmas`(開始時刻を過ぎたら真になる getter)。入口・HOMEのボス・ヘルプ・更新履歴は、これが偽のあいだ出さない
- デバッグで開始前に見るときは、ジャックと同じくデバッグの強制表示(送るイベントidは `debugId`)

## 2. 回数(3つの入口で共通)

レイドバトル(A)の回数は、バトル・モンヒロビート・バトルカードで**同じもの**を使う(毎日4:00に無料3回 + ビートP300で追加)。
始めた時点で1回使い、途中でやめても戻らない(ジャックのビート挑戦と同じ)。

```js
// 36-raid-xmas-api.jsx(どこからでも呼べる)。始める直前に呼ぶ。ok が false なら始めない(残りが無い・保存に失敗)
const t = await raidXmasUseTry();   // → { ok, hitId, eventId }
```

- `hitId` は、この1回の与ダメージを送るときに必ずそのまま渡す(同じ hitId は何度送っても1行。再送してよい)
- `eventId` は本番なら `raid_xmas_2026`、デバッグの強制表示中なら `raid_xmas_debug`(デバッグ中は回数を減らさない)

## 3. ダメージを足す関数(3つの入口で共通)

```js
// 36-raid-xmas-api.jsx(どこからでも呼べる)。1回の挑戦が終わったら1度だけ呼ぶ
const res = await raidXmasAddDamage({
  source: 'card',          // 'battle' | 'rhythm' | 'card'
  kind: 'a',               // カード・ビートは 'a' だけ。'b'(グランドスラム)はバトルだけ
  tierIndex: 0,            // 挑んだ段階(0 始まり)。レイド画面から渡された数をそのまま返す
  damage: 123456,          // 0 以上の整数(上限 1億。超えたら 1億で切る)。換算は各部の関数で済ませてから渡す
  hitId: t.hitId, eventId: t.eventId,
  detail: { /* 結果画面に出したい物(任意)。例: カードなら { won, turns, ko } / ビートなら { songName, difficultyName, score, assist } */ },
});
// res = { way, outcome, damage, defeated, opened, tierIndex, tierName, lifeBefore, lifeLeft, lifeMax, afterBoss, detail }
//   outcome: 'sent'(送れた)| 'pending'(送れず端末に残した・あとで自動で送り直す)| 'invalid'(形が違う・送らない)
//   defeated: この1回で段階を倒しきったか(共有ライフの残りと比べる。大王のあとの無限の段階は倒さない)
openRaidXmasResult(res);   // App の中(バトル部・③で作る)。レイドの結果画面を出す(閉じるとレイド画面へ戻る)。カード・ビートの結果画面を出し終えてから呼ぶ
```

- 送る・送れなかったら端末に残す・段階を倒した印・次の段階を開く・バトルの記録、は全部この中でやる。**各部は表へ直接送らない**
- ダメージが 0 のとき(アシストモード・途中でやめた)は呼ばなくてよい(回数だけ使った扱い)。呼んでも送らない
- 途中でやめたときに結果画面を出すなら `openRaidXmasResult({ way, damage: 0, tierIndex, outcome: 'sent', detail })`

## 4. 入口の受け渡し(レイド画面 → 各部)

レイド画面(バトル部・`79-screen-raid-xmas.jsx`)の各段階に「バトルで挑む」「モンヒロビートで挑む」「バトルカードで挑む」を置き、App の関数を呼ぶ。

| ボタン | App の関数(作る部) | 中でやること |
| --- | --- | --- |
| バトルで挑む | `startRaidXmasBattle(kind, tierIndex)`(バトル部) | 編成 → 1戦 → `raidXmasAddDamage({source:'battle'})` |
| モンヒロビートで挑む | `startRaidXmasRhythm(tierIndex)`(**ビート部**) | 曲えらび → `raidXmasUseTry()` → 演奏 → `raidXmasRhythmDamageOf(result, difficulty)` → `raidXmasAddDamage({source:'rhythm'})` → リザルトのあと `openRaidXmasResult` |
| バトルカードで挑む | `startRaidXmasCard(tierIndex)`(**カード部**) | デッキえらび → `raidXmasUseTry()` → ボスのデッキと1戦 → `raidXmasCardDamageOf(...)`(カード部) → `raidXmasAddDamage({source:'card'})` → `openRaidXmasResult` |

- ビートの換算 `raidXmasRhythmDamageOf` はバトル部が `35-raid-xmas.jsx` に置く。はじめはジャックの式(`raidJackRhythmDamageOf`)そのまま。数字を変えるときはこの関数だけ直す
- ビート部はジャックのビート挑戦(`startRaidJackRhythmSelect` / `startRaidJackRhythmPlay` / `completeRaidJackRhythm` / `finishRaidJackRhythm`)を、クリスマスでも動く形にする(例: `raidRhythm` に `event: 'xmas'` を持たせ、クリスマスのときは上の2つの関数を呼ぶ)。ジャックの流れは変えない
- カードの換算 `raidXmasCardDamageOf` はカード部の受け持ち(数字の案は表にして窓口へ)。ボスのデッキ・考え方もカード部
- レイド画面が渡す「いまのボスの絵・名前」は `RAID_XMAS_EVENT.name` と `raidXmasTierAt('a', i).name`、絵は `RAID_XMAS_BOSS_IMG`(仮の絵・バトル部が置く)

## 5. ひとりで進める物語(バトル部が仕組み・台本は SCRIPT.md)

```js
const XMAS_STORY_CHAPTERS = [ { id: 'xs01', openAt: '2026-11-30T10:00:00+09:00', type: 'read' | 'fight', title, scriptId }, ... ];  // 約25話・毎日1話
// 進み具合の保存: 新しいキー mh_xmas_story_v1 = { v: 1, cleared: ['xs01', ...], rewardClaimed: false }
```

- 戦う話(`type: 'fight'`)は、プレイヤーが遊びを選ぶ → App の各部の関数を呼ぶ。**レイドの回数は使わない・レイドのダメージにもならない**

| 遊び | App の関数(作る部) | 勝ったら / 負けたら |
| --- | --- | --- |
| モンヒロバトル | `startXmasStoryBattle(chapterId)`(バトル部) | `completeXmasStoryChapter(chapterId, { way: 'battle', won })` |
| モンヒロビート | `startXmasStoryRhythm(chapterId)`(**ビート部**) | `completeXmasStoryChapter(chapterId, { way: 'rhythm', won })` |
| MFバトルカード | `startXmasStoryCard(chapterId)`(**カード部**) | `completeXmasStoryChapter(chapterId, { way: 'card', won })` |

- **イベントページ(2026-11-26・台帳 r1126-006)**: 話はイベントページの「物語」タブから選ぶ(`79-screen-xmas-event.jsx`)。戦う話の札を押すと、App に置かれた `startXmasStory*` の分だけボタンが出る(`typeof` で確かめる。無い遊びは「準備中」)。呼ぶときは `startXmasStoryBattle(chapterId)` の形
- 話の表は `35-raid-xmas.jsx` の `XMAS_STORY_CHAPTERS`(id `xs01`〜`xs25`・`openAt`・`type`・`title`・`scriptId` = `xmas_story_01`〜)。お話の中身は `data/assistants.js` の `EVENT_REPLAYS` に `scriptId` の id で入れる(入るまでは「準備中」)。読む話は最後まで読む(飛ばしても)と「読んだ」
- 登場人物パネルは `XmasCastPanel({ no, animate })`(`no` = 読み終えた話の番号。`animate` でその話にいなくなった人だけ色が抜けてはんこが押される)。お話の終わりに出すときもこの部品を使う。いなくなる人の表は `XMAS_STORY_MISSING`
- `completeXmasStoryChapter` はバトル部が作る(App の中・**作った**)。勝ちなら進み具合に印を付け、話の続きを流し、イベントの頁へ戻す。負けならイベントの頁へ戻す(何度でも挑める)
- 難易度は低め(社長「誰でも勝てるように」)。案: バトル=Easy 相当の弱い敵 / ビート=EASY・NORMAL の好きな曲を最後まで遊べば勝ち(アシストモード可) / カード=弱いデッキのコンピューター。中身は各部で決めて窓口へ
- 報酬は最後の話まで進めたときだけ(中身は社長が決める)

## 6. 段階を倒すたびのお話

- id: `raid_xmas_story_1b`(レイド開始)/ `raid_xmas_story_2`〜`_6`(段階1〜5を倒したあと)/ `raid_xmas_ending_cleared`・`raid_xmas_ending_notcleared`(期間のあと)
- 流し方はジャックと同じ(共有の合計から倒れた段階を数え、まだ見ていない最初の1本を HOME で流す。見た印は既存の `rhythmEventStorySeen` の並び)
- 台本の中身は別の会話が [`SCRIPT.md`](SCRIPT.md) に書く。仕組みは仮の文で先に動かす

## 7. 保存とサーバー(⑦)

| 物 | 扱い |
| --- | --- |
| `raid_jack_hits` | そのまま使う。`event_id = 'raid_xmas_2026'`(デバッグは `raid_xmas_debug`)。**既存の行は消さない・変えない** |
| 列 `source` | 許す値に `'card'` を**足す**(下の SQL)。`'battle'` `'rhythm'` はそのまま |
| ビュー(段階の合計・貢献・入口ごとのランキング) | どれも `event_id` で分かれているので、作り直さない |
| `raid_battle_logs`(バトルの記録) | バトル・ビートだけ送る。カードは送らない(モンスターの編成が無い)。表は触らない |
| 端末 `mh_raid_xmas_v1` | 新しいキー。形はジャックの `mh_raid_jack_v1` と同じ(`a`・`b`・`claimed`・`pending` …) |
| 端末 `mh_xmas_story_v1` | 新しいキー。ひとりで進める物語の進み具合 |
| `mh_raid_jack_v1` ほかジャックのキー | **触らない** |

- 端末の再送待ち(`pending`)の正規化は、今は `source` を battle / rhythm にしか戻さない。カードが battle に化けないように、バトル部が `'card'` を通すよう直す(ジャックの動きは変わらない)
- SQL を当てる前に `'card'` を送ると、制約で弾かれる。弾かれたら端末に残して後で送り直す(battle として送り直さない)ように、バトル部が送る所を直す。**カードの入口を開ける前に SQL を流す**

### SQL(窓口が流す)

```sql
-- クリスマスのレイド: raid_jack_hits の source に 'card'(MFバトルカードの与ダメージ)を足す。
-- 既存の行・列・ビュー・ポリシーは消さない・書き換えない(制約を広げるだけ。今ある行はすべて新しい制約にも合う)。
begin;

do $$
begin
  if to_regclass('public.raid_jack_hits') is null then
    raise exception 'public.raid_jack_hits がありません(何も変えていません)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'raid_jack_hits' and column_name = 'source') then
    raise exception 'source 列がありません。先に RAID_JACK_SOURCE.sql を当ててください(何も変えていません)';
  end if;
end $$;

alter table public.raid_jack_hits drop constraint if exists raid_jack_hits_source_check;
alter table public.raid_jack_hits add constraint raid_jack_hits_source_check
  check (source in ('battle', 'rhythm', 'card'));

commit;

select
  (select count(*) from public.raid_jack_hits) as "行の数(変わらないはず)",
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'raid_jack_hits_source_check') as "source の制約";
```

### 窓口に引いてほしい数(読むだけ・数字の案を決めるため)

```sql
-- ジャックの実績: 段階ごとの合計・人数・入口ごとの合計
select kind, tier, source, count(distinct breeder_id) as players, sum(damage)::bigint as total, max(damage) as max_hit,
       min(created_at) as first_hit, max(created_at) as last_hit
  from public.raid_jack_hits where event_id = 'raid_jack_2026'
 group by kind, tier, source order by kind, tier, source;
```

## 8. 数字(仮。社長が決めたら `35-raid-xmas.jsx` の表だけ差し替える)

はじめは**ジャックの最後の数字と同じ**で作る(仮)。案は報告で表にして出す(期間が31日でジャックより4日長い・入口が1つ増える)。

| 項目 | ジャック(実績の設定) | 仮に入れる値 |
| --- | --- | --- |
| A ライフ(段階1〜5) | 175万 / 320万 / 800万 / 3,500万 / 8,000万 | **875万 / 1,600万 / 4,000万 / 4,200万 / 9,600万**(社長決定 11/25: 前半はジャックの5倍・後半は1.2倍) |
| A 攻撃力(段階1〜5) | 350 / 500 / 600 / 800 / 1,000 | 同じ |
| 大王のあと | 共有ライフ無限・1戦のライフ 455万・攻撃力 700 | 同じ |
| B 倍率(段階1〜5) | 0.2 / 2 / 10 / 40 / 100 | 同じ |
| ビートの換算 | ジャストマーベラス1,000個で100万(難易度・達成の補正つき) | 同じ式 |
| カードの換算 | (無し) | カード部の案 |
| 回数 | 無料3回/日 + ビートP300で追加 | 同じ(3つの入口で共通) |
| 報酬 | ジャックの表 | 同じ表(社長決定) |

## 9. できた物(PR を出したら足す)

| 物 | 部 | PR |
| --- | --- | --- |
| この紙 | バトル部 | #7591 |
| 定義 `35-raid-xmas.jsx`・回数と与ダメージ `36-raid-xmas-api.jsx`(`raidXmasUseTry`・`raidXmasAddDamage` は App ではなく**どこからでも呼べる関数**にした)・`RELEASE_FLAGS.raidXmas`・検査 `tools/battle/raid-xmas-check.js` | バトル部 | (この PR) |
| レイド画面・バトルの1戦・結果画面 `openRaidXmasResult`(App の中)・ランキングの「バトルカード」・ボスの絵 `RAID_XMAS_BOSS_IMG` | バトル部 | (③の PR) |
| カード: ボスのデッキ・考え方・換算 `raidXmasCardDamageOf`(`82-card-raid-core.jsx`)・対戦の画面の受け口 `raidChallenge`(`84-screen-card-battle.jsx`)。口の形は [`CARD_RAID_XMAS.md`](../../spec/CARD_RAID_XMAS.md)「つなぐ口」。App の `startRaidXmasCard` は §2・§3 の関数ができたらつなぐ | カード部 | #7607 |
| イベントページ `79-screen-xmas-event.jsx`(題・ポスター・期間・タブ 物語/レイド/ボーナス)・話の一覧と読んだ印 `mh_xmas_story_v1`・登場人物パネル・`completeXmasStoryChapter`・HOME のイベントの札から開く | バトル部 | (この PR・r1126-006) |
| ビート挑戦をイベントのつなぎ口で動かす部品 `39-raid-rhythm.jsx`(ジャックは同じ動き・クリスマスのつなぎ口は §2〜§4 の形で用意。App でつなぐのは §3 の関数が入ってから。[`BEAT.md`](BEAT.md)) | ビート部 | #7618 |
| 動線の点検の道具 `tools/battle/xmas-flow-browser-check.js`(11/28・11/30・12/31 の3つの時刻 × 縦・横・タブレットで、入口・ボス・3タブ・挑戦・事件簿・序章・戻る先を通す)と止め絵・見つけた所の一覧 [`flow/README.md`](flow/README.md)・カードで挑む前のスターターの案内(r1126-028) | バトル部 | (この PR) |

## 10. つなぎ方(③でできた所・2026-11-25)

- **レイド画面のボタン**: App の中に `const startRaidXmasRhythm = (tierIndex) => …`(ビート部)/ `const startRaidXmasCard = (tierIndex) => …`(カード部)を置けば、**レイド画面にボタンが自動で出る**(呼び出し側が `typeof … === 'function'` で確かめる。`tools/undefined-reference-check.js` の「後から足す口」に登録済み)
- **結果画面**: `openRaidXmasResult(res)`(App の中)。`res` は `raidXmasAddDamage` の返り値そのまま。`detail` はカード `{ won, turns, ko }` / ビート `{ songName, difficultyName, score, assist }`。閉じるとクリスマスのレイド画面へ戻る(デバッグの記録のときはレイドの確認画面へ)
- **途中でやめた**: `openRaidXmasResult({ way, tierIndex, damage: 0, outcome: 'sent', detail })`
- **レイド画面へ戻す**: `setGameState('RAID_JACK')`(画面の名前はジャックと同じ。どのイベントかは App の `raidEvRef` が持つ)。2026-11-26 から、クリスマスはイベントページ(`XmasEventScreen`)の「レイド」タブの中にレイド画面がある。戻るとレイドのタブのまま(タブは App の `xmasEventTab`)
- **デバッグ**: DEBUG MENU → ⚔️バトル → レイドの確認画面の「🎅 クリスマスのレイド画面を開く」。送り先は `raid_xmas_debug`
- このあとバトル部が足す: 報酬の受け取り・HOME のボス・段階のお話・再送待ちを HOME で送り直す
