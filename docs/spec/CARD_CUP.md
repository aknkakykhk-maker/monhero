# MFバトルカード 個人杯(仕様)

プレイヤーが自分で開ける杯。案と社長の答え: [`docs/progress/card-tournament/personal-cup/README.md`](../progress/card-tournament/personal-cup/README.md)。
公式杯(運営が開く大会)は [`CARD_TOURNAMENT.md`](CARD_TOURNAMENT.md)。

## 決まり(2026-10-31 社長)

| | 決まり |
| --- | --- |
| 遊び方 | **リアルタイム杯**(`mode='live'`・決めた時刻に集まって自分で戦う)と **オート杯**(`mode='auto'`・登録デッキでサーバが自動で回し、発表の時刻に結果) |
| 形式 | **総当たり**(`format='rr'`・4〜8人)か **トーナメント**(`format='ko'`・4〜16人)を主催が選ぶ |
| 開ける人 | だれでも(条件なし)。主催は自動で参加者になる。オート杯は主催も登録デッキが要る |
| 募り方 | 合言葉(6けたの数字。参加者だけが見られる)と公開の一覧(`listed`)。杯の名前・主催名は画面に出すとき `cardChatMask`(91 の悪い言葉の置き換え)を通す |
| 上限 | 1人が開ける杯は同時に1つ / 出られる杯は同時に3つ / 同時に開いている杯は全体で200まで / オート杯は同じ発表の時刻に3杯まで |
| 時刻 | オート杯: 締め切りは10分後〜3日後・発表は締め切りの1時間後から・ちょうどの時(分は0)。リアルタイム杯: 始まる時刻は15分後〜3日後・15分きざみ(締め切り = 始まる時刻) |
| ごほうび | なし。ランキング・カードランク・強さの点数にも入らない |
| 公開 | 新しい公開の印を立てる。公開までは遊ぶ人に見えない |

## 上限の数の決め方(サーバの負担)

- サーバの関数は1回に CPU を2秒まで。1回に回す試合は 1.2秒ぶん(`PLAY_BUDGET_MS`)まで。1試合およそ 80ms(LEGEND の登録デッキで 200ms)
- 呼ぶのは1日中10分おき(1時間に6回)。1回で 6〜15試合 → **1時間に 36〜90試合**
- オート杯は発表の2時間前から回す(`CUP_PLAY_LEAD_MS`)= 12回の呼び出し = **72〜180試合**。いちばん重い杯は総当たり8人の28試合
- 同じ発表の時刻を3杯までにすると、最大 84試合 → 2時間で回し切れる(公式杯の 0:00〜4:00 と重なる時刻でも、公式杯は1日に数試合)
- 1日で最大 24時 × 3杯 = 72杯。実況・解説の AI は優勝が決まる1試合だけ → 1日 72回まで(全体の上限 2,000回の中)

## サーバ(足すだけ)

| 物 | 場所 |
| --- | --- |
| 表と関数 | `docs/sql/card-cup/CARD_CUP_APPLY.sql`(`card_cups`・`card_cup_entries`・`card_cup_matches` と、下の関数) |
| オート杯を回す所 | `supabase/functions/card-tournament-run/cup.js`(`runCups`。公式杯のあと、同じ残りの時間で回す) |
| 呼ぶ時刻 | `docs/sql/card-tournament/CARD_TOURNAMENT_SCHEDULE.sql`(1日中10分おき `*/10 * * * *`) |
| 計算 | `82-card-tournament-core.jsx` の総当たり(`cardTourSchedule`・`cardTourStandings`)とトーナメント(`cardTourKoFirst`・`cardTourKoMatches`・`cardTourKoWinners`・`cardTourKoNextPairs`・`cardTourKoPlaces`) |
| 検査 | `tools/card/card-cup-run-check.js`(偽物の表で回す)・`tools/card/card-tournament-core-check.js` の G |

### 関数(ゲームから呼ぶ。`rest/v1/rpc/<名前>`)

| 関数 | 引数 | 返り値 |
| --- | --- | --- |
| `card_cup_create` | `p_owner, p_key, p_name, p_host_name, p_icon, p_mode, p_format, p_max, p_listed, p_entry_until, p_start_at` | `{ status, id, code }`。status: `ok` / `bad` / `busy`(開いている杯がもうある)/ `slot`(その発表の時刻はいっぱい)/ `crowded`(全体の上限)/ `many`(出ている杯が3つ)/ `nodeck`(オート杯は登録デッキが要る)/ `locked`(鍵がちがう) |
| `card_cup_list` | なし | 受付中・一覧に出す杯(始まりの早い順に50まで)。合言葉は入らない |
| `card_cup_mine` | `p_owner` | 自分が開いた・出ている杯(受付中・開催中と、終わって14日まで) |
| `card_cup_find` | `p_code` | 合言葉の杯(受付中だけ)・無ければ null |
| `card_cup_join` | `p_cup, p_owner, p_key, p_name, p_icon` | `ok` / `bad` / `closed` / `full` / `many` / `nodeck` / `locked` |
| `card_cup_leave` | `p_cup, p_owner, p_key` | `ok` / `closed` / `none` / `locked` / `host`(主催は抜けられない) |
| `card_cup_cancel` | `p_cup, p_owner, p_key` | `ok` / `closed` / `locked`(主催だけ・受付中だけ。状態を `closed` にする) |
| `card_cup_view` | `p_cup, p_owner` | `{ cup(code は参加者だけ・bracket), me, entries, matches }`。オート杯の結果は「終わって、発表の時刻を過ぎた」ときだけ。リアルタイム杯はすぐ |
| `card_cup_match` | `p_id` | 1試合の見返しの材料(種・先攻・手・ルールの版・両方のデッキ・実況) |

杯の1行(`card_cup_row`)の形: `{ id, name, host_id, host_name, host_icon, mode, format, max, listed, status, entry_until, start_at, closed_reason, done_at, players }`。
`status`: `entry`(受付中)/ `running`(開催中)/ `done`(終わり)/ `closed`(取り消し `host`・人数が足りない `few`)。

鍵: オート杯はみんなのデッキと同じ持ち主の鍵(`mh_card_deck_owner_key_v1`。登録デッキの鍵の指紋と合うこと)。
リアルタイム杯は登録デッキが無くても入れる。鍵は `cardShareOwnerKey(true)` で端末に作り、入ったときの指紋を杯の参加者の行に持つ。

### オート杯の流れ(サーバ)

1. 締め切り(`entry_until`)を過ぎたら、登録デッキの写しを取り、受付の順に席(0 から)を決める。デッキが壊れた人は外す。2人に足りなければ `closed`(`few`)
2. 試合を作る: 総当たりは全部(`round` = 日・`slot` = 通し番号)、トーナメントは1回戦(不戦勝は試合にしない。山の並びは `card_cups.bracket.rounds`)
3. 発表の2時間前から回す。トーナメントは回戦が終わるごとに次の回戦を作る
4. 全部終わったら順位(総当たり: 勝ち数 → 倒した数 → 2人の対戦 → 受付の早さ / トーナメント: 1・2・3・5・9)と勝ち数を書いて `done`
5. 画面に出るのは発表の時刻(`start_at`)から

### リアルタイム杯(あとの段階 ④ で作る)

表の列は用意してある: `card_cup_entries.checkin_at`(集合)・`card_cup_matches.report_a` / `report_b`(2台の結果の申告)。
集合・不戦敗・マルチ対戦の部屋の割り当て・結果の突き合わせ・勝ち上がり・観戦の関数と画面は ④ で足す。
画面は公式杯の 99-card-tournament.jsx とは別の部品ファイルに分け、84 には入口を1か所だけ置く。

## 公開の手順(窓口)

1. `CARD_CUP_APPLY.sql` を流す(足すだけ)
2. 呼ぶ時刻を1日中にする(`CARD_TOURNAMENT_SCHEDULE.sql` の呼ぶ仕組みの所だけ流し直す)
3. サーバの関数 `card-tournament-run` を出し直す(`index.ts`・`core.js`・`cup.js`・`game.js`。game.js の配り方は CARD_TOURNAMENT.md)
