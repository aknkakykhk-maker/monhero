# レイドとタクティクスプロの1回ごとの記録(raid_battle_logs・tactics_pro_logs)の設計

2026-10-21 社長「(ティア表を変えるのは)まだやらなくていいけど仕組みは作って」。ティア表が勇者モンの評価に寄りすぎている、という指摘への材料集め。
**いまは下準備だけ。表はまだ作っておらず(SQL は流していない)、ゲームからも何も送らない(`RELEASE_FLAGS.battleLog = false`)。**

## 何を記録するか(範囲)

2026-10-21 社長「レイド、タクティクスプロのタクティクスバトルのベースモンを使ったもののデータでいい。育てたモンスターははかれないとおもう」。

記録するのは次の2つだけ。
- **レイド**(レイドバトル・グランドスラム・モンヒロビート挑戦): 表 `raid_battle_logs`
- **タクティクスプロのうち、ベースモン(育てていない基本の強さ)だけで戦う回**: 表 `tactics_pro_logs`
  - 勇者モンか候補の1体でもマスモンなら、入れ物を作らない。
  - タクティクスプロはもともとベースモンだけで組むが、念のため `confirmProParty` で確かめる。

記録しないもの:
- 通常のバトル(チャレンジ・クイック・プロ・極限など)。
- マスモン(育てた個体)で戦う回。育て方で強さが変わるので、モンスターの強さとして比べられない。

## 何のために

- ティア表(`tools/playbot/tactics-tier.js`)は、ボットが「すべて解放してバトル」で戦った回を主な材料にしている。プレイヤーの実戦は、全国ランキングの記録を重み 0.5 で混ぜている。
- 全国ランキング(`rankings`)に残るのは、勇者モン・供モン・スコア・届いた WAVE・ターンまで。**誰がどれだけ働いたか**(ダメージ・EX・固有技・受けたダメージ)が無い。
- ここを集めると、決め方の「役割ごとの働き」を、ボットだけでなくプレイヤーの戦いからも測れる。

## 今ある記録だけでできること

- `node tools/playbot/player-battle-stats.js`: `rankings` と `raid_jack_hits` を公開の鍵(読むだけ)で読み、集計する。
  - ランキングは、勇者モン別・供モン別の「使われた回数・届いた WAVE・クリア率・伸び」。
  - レイドは、段階ごとの「回数・倒した回数・1回あたりのダメージ」。`raid_jack_hits` には使ったモンスターが入っていないので、モンスター別には分けられない。
  - 名前・ブリーダーid・hit_id・アイコン・マスモンの中身は読まない。
  - `--from-cache` を付けると、前に読んだ `tools/playbot/player-battle-cache.json` から作り直す(ネットに出られない環境用)。

## レイドの1回(`raid_battle_logs`)

| 列 | 中身 |
| --- | --- |
| `event_id` | イベントid(`raid_jack_2026`) |
| `kind` / `tier` / `source` | a(レイドバトル)か b(グランドスラム)・段階・battle か rhythm(モンヒロビート挑戦) |
| `result` | `defeated`(倒した)か `end` |
| `damage` / `turns` / `score` | その1回で与えたダメージ・使ったターン・(モンヒロビート挑戦の)スコア |
| `hero` / `allies` | 勇者モンと供モンの monsterId(供モンは最大3。モンヒロビート挑戦は編成が無いので null) |
| `units` | `{ monsterId: { dmg, ex, unique, taken } }`(数えるのは次の段から) |
| `app_build` / `schema_version` | ゲームの版(`BUILD_DATE`)と形の版 |

- **送らないもの**: 名前・ブリーダーID・アイコン・プロフィールフレーム・マスモンの個体名や育て方・端末の情報。行と人は結び付かない。
- 形は `buildRaidBattleLogRow`(`monster-hero/src/parts/26-supabase.jsx`)が決める。レイドでない入力からは行を作らない。
- **`raid_jack_hits`・ランキング・討伐報酬・mh_raid_jack_v1 には触らない**。送る所は、今の送信のあとに足すだけで、待たない。デバッグの戦いは送らない。
- 送る所(60-app.jsx)は2か所。
  - レイドバトル・グランドスラム: `finishRaidJack`。
  - モンヒロビート挑戦: その結果を送る所。

## タクティクスプロは「全部」(2026-10-21 社長「タクティクスバトルのプロモード仕様は全部取ってほしい」)

タクティクスプロ(ベースモンだけの回)は、表 **`tactics_pro_logs`** に1回1行で全部を残す。
- 勝ち(clear)・負け(lose)・途中でやめた回(retire)のどれも残す。
- 入れ物と出来事を足す関数は `tacticsProLog*`(26-supabase.jsx)。送るのは `sbSendTacticsProLog`。
- **印(`RELEASE_FLAGS.battleLog`)が偽のあいだは、入れ物そのものを作らない(null)ので、何も貯めず何も送らない。** デバッグの戦いも作らない。

| 中身 | どこで拾うか(60-app.jsx) | 入る所 |
| --- | --- | --- |
| 難易度・極限の難易度・勇者モンと最初の間合い・供モンの候補5体(全員ベースモンのときだけ始める) | `confirmProParty`(始まり) | 列 `difficulty`・`hero`・`candidates`、`detail.heroDistance`・`detail.extreme` |
| アシカの選択(いつ・どれ) | `confirmPickTeaching` | `detail.assists[{wave,id}]` |
| WAVE ごとの並び(誰が・勇者モンの間合い)と敵 | `initBattle`(WAVE の始まり) | `detail.waves[].party`・`enemy` |
| WAVE ごとに見せた3体と選んだ1体 | 候補を出す所(2か所)と `setupMon` | `detail.waves[].offered`・`picked` |
| トレーニングの選び方(強化した枠と中身・起こした枠) | `handleTraining` | `detail.waves[].training` |
| EX・固有技の使用(誰が・何 WAVE の何ターン目) | `activateTacticsEx`・固有技の当たり | `detail.units[id].ex`・`unique`、`detail.events` |
| 誰がどれだけ与えたか | 敵のライフを減らす2か所 | `detail.units[id].dmg` |
| 誰がどれだけ受けたか・倒れた回とその敵 | `commitTacticsUnits`(味方のライフが変わるただ1か所) | `detail.units[id].taken`・`downs`、`detail.events` |
| WAVE ごとのかかったターンと1体ずつの残りライフ | WAVE の結果を出す所 | `detail.waves[].turns`・`lifeLeft` |
| 届いた WAVE・累計ターン・スコア・負けた原因の敵・かかった秒 | `submitLocalScore`(終わり) | 列 `result`・`reached_wave`・`turns`・`score`・`cause`・`seconds` |

- まだ拾っていないもの(次の段)
  - 立ち位置を戦いの途中で動かしたこと: 今は WAVE の始まりの勇者モンの間合いだけ。
  - 敵の行動の中身。
- 拾う所を足すときは、`tacticsProLog*` に関数を足して呼ぶ。印が偽のあいだは入れ物が null なので、呼んでも何も起きない。

### 量(大きさの見込み)

- **1回あたり約 4KB**(10 WAVE・1 WAVE 6ターン・4体の場合。`tools/ranking/tactics-pro-log-check.js` が測る)。
- 上限は送る側で 24KB(`TACTICS_PRO_LOG_MAX_BYTES`)、表で 32KB。
  - 長い戦いは、出来事(events)の古いほうから捨てて上限に収める。WAVE ごとのまとめとモンスターごとの数は残す。
  - 出来事は 1回最大 400件、WAVE は最大 20件。
- **1日の件数の見込み: 数件〜100件ほど。**
  - 全国ランキングに残ったタクティクスプロの記録は、2026-09-21〜10-21 の1か月で128件(1日4件ほど)。
  - ランキングに残らない回もあるとして、多めに見て1日100件。
  - 100件 × 4KB = 1日 400KB、1年で 150MB ほど。
  - 増えすぎたら、古い行を集計してから消す道具を足す(消すのは社長の確認のあと)。

## いつ送るか

- 1回だけ送る。送るのは次の所。
  - レイドバトル・グランドスラム: `finishRaidJack`。
  - モンヒロビート挑戦: その結果を送る所。
  - タクティクスプロ(ベースモンだけの回): ランキングへ記録を送るのと同じ所(`submitLocalScore`)。勝ち・負け・途中でやめた回のどれもここを通る。
- 送ったら待たない。送れなくてもゲームは何も変わらず、やり直しもしない。
- 次のときは送らない。
  - `RELEASE_FLAGS.battleLog` が偽のあいだ(いま)。
  - 手元のサーバー(検査・ローカル確認)から開いたとき(`sbTelemetryLocal`)。
  - 表が無い(404)・権限が無い(401/403)と分かったあと、ページを閉じるまで。

## 流すまでの順番

1. 社長の確認を取る(窓口)。
2. 表を作る。SQL は `docs/sql/battle-log/` の3本。
   - `BATTLE_LOGS_APPLY_TEST.sql`: 予行演習。末尾が rollback なので何も残らない。
   - `BATTLE_LOGS_APPLY.sql`: 本番用の1本。2つの表を1つのトランザクションで作る。
   - `BATTLE_LOGS_VERIFY.sql`: 流したあとに確かめる。読むだけ。
3. 確かめる: `BATTLE_LOGS_VERIFY.sql` で、2つの表とも次のとおりか。
   - 列は15。
   - RLS は true。
   - ポリシーは INSERT と SELECT だけ。
   - anon の権限は INSERT,SELECT。
4. `RELEASE_FLAGS.battleLog` を真にして公開する(ブレイブくん)。表を作る前に真にしても、404 で止まるだけで壊れない。

## 次の段(まだやっていない)

1. レイドの `units` を数える。今は、レイドのバトルでモンスターごとのダメージ・EX の回数を数えていない。タクティクスプロと同じ拾い方(`tacticsProLog*`)をレイドにも広げる。
2. 読む道具を足す。`player-battle-stats.js` に、`raid_battle_logs`・`tactics_pro_logs` を読む口を足し、ティア表の「役割ごとの働き」へ混ぜる。

## 見張り

- `node tools/ranking/battle-log-check.js` が見る。
  - 印が偽のあいだ送らないこと。
  - 送る所がレイドの2か所だけで、通常のバトルから送らないこと。
  - 送る形に名前・idが無いこと。
  - SQL が新しい2つの表だけで、本番用が1本なこと。
- `node tools/ranking/tactics-pro-log-check.js` が見る。
  - タクティクスプロは、ベースモンだけの回に限ること。
  - 全部の中身が入ること。
  - 大きさが上限に収まること。
  - ゲームの14か所につながっていること。
