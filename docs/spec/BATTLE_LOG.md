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
| `app_build` / `schema_version` | ゲームの版(`BUILD_DATE`)と形の版 |

- **送らないもの**: 名前・ブリーダーID・アイコン・プロフィールフレーム・マスモンの個体名や育て方・端末の情報。行と人は結び付かない。
- 形は `buildBattleLogRow`(`monster-hero/src/parts/26-supabase.jsx`)が決める。決めた項目だけを通し、数は範囲に収め、ほかの項目は捨てる。

## いつ送るか

- バトルが終わってランキングへ記録を送るのと同じ所(`submitLocalScore`・60-app.jsx)で、1回だけ送る。クリア・負け・リタイアのどれもここを通る。
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
2. 社長が「集めていい」と決めたら、表を作る。
   - `docs/sql/battle-log/BATTLE_LOG_APPLY_TEST.sql` を流す(予行演習・末尾 rollback)。
   - `BATTLE_LOG_APPLY.sql` を流す。
   - `BATTLE_LOG_VERIFY.sql` で、列 13・RLS・INSERT と SELECT だけのポリシーを確かめる。
3. `RELEASE_FLAGS.battleLog` を真にする。表を作る前に真にしても、404 で止まるだけで壊れない。
4. 読む道具を足す。`player-battle-stats.js` に `battle_logs` を読む口を足し、overall の「役割ごとの働き」へ混ぜる。

## 見張り

- `node tools/ranking/battle-log-check.js` が見る。
  - 印が偽のあいだ送らないこと。
  - 送る形に名前・idが無いこと。
  - SQL が既存の表に触らないこと。
- `node tools/playbot/tier-method-check.js` が見る。
  - 決め方 current が変わらないこと。
  - overall が別ファイルにだけ書くこと。
  - 実戦の集計が名前を持たないこと。
