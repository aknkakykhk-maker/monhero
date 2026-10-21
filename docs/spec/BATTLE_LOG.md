# バトルの1回ごとの記録(battle_logs)の設計

2026-10-21 社長「(ティア表を変えるのは)まだやらなくていいけど仕組みは作って」。ティア表が勇者モンの評価に寄りすぎている、という指摘への材料集め。
**いまは下準備だけ。表はまだ作っておらず(SQL は流していない)、ゲームからも何も送らない(`RELEASE_FLAGS.battleLog = false`)。**

## 何のために

- ティア表(`tools/playbot/tactics-tier.js`)は、ボットが「すべて解放してバトル」で戦った回だけを材料にしている。
- プレイヤーの実戦は全国ランキング(`rankings`)にもあるが、残るのは勇者モン・供モン・スコア・届いた WAVE・ターンまで。**誰がどれだけ働いたか**(ダメージ・EX・固有技・受けたダメージ)が無い。
- ここを集めると、overall の決め方(`--method overall`)の「役割ごとの働き」を、ボットだけでなくプレイヤーの戦いからも測れる。

## 今ある記録だけでできること(この PR で入れた)

- `node tools/playbot/player-battle-stats.js`: `rankings` を公開の鍵(読むだけ)で読み、勇者モン別・供モン別に「使われた回数・届いた WAVE・クリア率・伸び」を集計する。
  - 出力は `docs/playbot/reports/tier/player-battle-stats.json`。
  - 名前・ブリーダーid・アイコン・マスモンの中身は読まない。
- `--from-cache` を付けると、前に読んだ `tools/playbot/player-battle-cache.json` から作り直す(ネットに出られない環境用)。
- `tactics-tier.js --method overall --player-weight 0.5` で、ティア表へ「実戦の重み」として混ぜられる。既定は混ぜない。

## 何を送るか(1回のバトルで1行)

| 列 | 中身 |
| --- | --- |
| `difficulty` | ランキングと同じ難易度のキー(`TacticsProBetaHard`・`ProMaster`・`ExtremeCHAOS` など) |
| `result` | `clear`(クリア)か `end`(負け・リタイア)。負けた回も送る |
| `reached_wave` / `turns` / `score` | 届いた WAVE・クリアまでの累計ターン(クリアした回だけ)・スコア |
| `hero` / `allies` | 勇者モンと供モンの monsterId(供モンは最大3) |
| `units` | `{ monsterId: { dmg, ex, unique, taken } }`。与えたダメージ・EX を使った回数・固有技を撃った回数・受けたダメージ |
| `raid_event` / `raid_kind` / `raid_tier` / `raid_source` / `raid_damage` | レイドの1回だけ。イベントid・a(レイドバトル)か b(グランドスラム)・段階・battle か rhythm(モンヒロビート挑戦)・その1回で与えたダメージ |
| `app_build` / `schema_version` | ゲームの版(`BUILD_DATE`)と形の版 |

- **送らないもの**: 名前・ブリーダーID・アイコン・プロフィールフレーム・マスモンの個体名や育て方・端末の情報。行と人は結び付かない。
- 形は `buildBattleLogRow`(`monster-hero/src/parts/26-supabase.jsx`)が決める。決めた項目だけを通し、数は範囲に収め、ほかの項目は捨てる。

## レイド(2026-10-21 社長「バトルデータはレイドからのデータも取れるよね？」)

- 今の `raid_jack_hits` は、与えたダメージ・倒したか・段階・a/b・source だけで、**使ったモンスターは入っていない**。
  - `player-battle-stats.js` は、この表も公開の鍵で読める(読むのは event_id・kind・tier・damage・defeated・source だけ。hit_id・breeder_id は読まない)。
  - 集計は「段階ごとの回数・倒した回数・1回あたりのダメージ・最大ダメージ」。モンスター別には分けられない。
- `battle_logs` ではレイドの1回も1行にする。勇者モン・供モン・段階・与えたダメージ・使ったターンを一緒に残す。
  - 難易度のキーは `RaidJackA`(レイドバトル)・`RaidJackB`(グランドスラム)・`RaidJackRhythm`(モンヒロビート挑戦)。
  - 倒した回は `result = clear`。
  - モンヒロビート挑戦は編成が無いので、勇者モンは null。
- **`raid_jack_hits`・ランキング・討伐報酬・mh_raid_jack_v1 には触らない**。送る所は今の送信のあとに足すだけで、待たない。デバッグの戦いは送らない。

## タクティクスプロは「全部」(2026-10-21 社長「タクティクスバトルのプロモード仕様は全部取ってほしい」)

タクティクスプロだけは、`battle_logs` とは別の表 **`tactics_pro_logs`** に、1回1行で全部を残す。
- 勝ち(clear)・負け(lose)・途中でやめた回(retire)のどれも残す。
- ほかのモードは上の `battle_logs` の範囲のまま。
- 入れ物と出来事を足す関数は `tacticsProLog*`(26-supabase.jsx)。送るのは `sbSendTacticsProLog`。
- **印(`RELEASE_FLAGS.battleLog`)が偽のあいだは、入れ物そのものを作らない(null)ので、何も貯めず何も送らない。** デバッグの戦いも作らない。

| 中身 | どこで拾うか(60-app.jsx) | 入る所 |
| --- | --- | --- |
| 難易度・極限の難易度・勇者モンと最初の間合い・供モンの候補5体 | `confirmProParty`(始まり) | 列 `difficulty`・`hero`・`candidates`、`detail.heroDistance`・`detail.extreme` |
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

- 1回だけ送る。送るのは次の3か所。
  - 通常のバトル: ランキングへ記録を送るのと同じ所(`submitLocalScore`・60-app.jsx)。クリア・負け・リタイアのどれもここを通る。
  - レイドバトル・グランドスラム: `finishRaidJack`。
  - モンヒロビート挑戦: その結果を送る所。
- ランキングの送信とは別に送り、待たない。送れなくてもゲームは何も変わらず、やり直しもしない。
- 次のときは送らない。
  - `RELEASE_FLAGS.battleLog` が偽のあいだ(いま)。
  - 手元のサーバー(検査・ローカル確認)から開いたとき(`sbTelemetryLocal`)。
  - 表が無い(404)・権限が無い(401/403)と分かったあと、ページを閉じるまで。

## どれだけの量か

- 今の全国ランキングのバトルの行は約 1,550 件(2026-10-21 時点・音ゲーを除く)。プレイヤーが記録を送る回数と同じ程度なので、1日に数十〜数百行。
- 1行はおよそ 300〜600 バイト(`units` の上限は 4,000 バイト)。1年で数十 MB に収まる見込み。

## 次の段(まだやっていない)

1. **バトル中の数え方**を足す。いまのゲームは、モンスターごとのダメージ・EX の回数を数えていない。ダメージを与えた所・EX を使った所・固有技を撃った所・ダメージを受けた所で、`units` を ref に足していく。
2. 社長が「集めていい」と決めたら、表を作る(タクティクスプロは `TACTICS_PRO_LOG_*.sql` も同じ順で)。
   - `docs/sql/battle-log/BATTLE_LOG_APPLY_TEST.sql` を流す(予行演習・末尾 rollback)。
   - `BATTLE_LOG_APPLY.sql` を流す。
   - `BATTLE_LOG_VERIFY.sql` で、列 18・RLS・INSERT と SELECT だけのポリシーを確かめる。
3. `RELEASE_FLAGS.battleLog` を真にする。表を作る前に真にしても、404 で止まるだけで壊れない。
4. 読む道具を足す。`player-battle-stats.js` に `battle_logs` を読む口を足し、overall の「役割ごとの働き」へ混ぜる。

## 見張り

- `node tools/ranking/tactics-pro-log-check.js` が見る。
  - タクティクスプロの記録は、印が偽なら作らないこと。
  - 全部の中身が入ること。
  - 大きさが上限に収まること。
  - ゲームの13か所につながっていること。
  - SQL が既存の表に触らないこと。
- `node tools/ranking/battle-log-check.js` が見る。
  - 印が偽のあいだ送らないこと。
  - 送る形に名前・idが無いこと。
  - SQL が既存の表に触らないこと。
- `node tools/playbot/tier-method-check.js` が見る。
  - 決め方 current が変わらないこと。
  - overall が別ファイルにだけ書くこと。
  - 実戦の集計が名前を持たないこと。
