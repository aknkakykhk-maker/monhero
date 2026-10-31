# MFバトルカード 個人杯(仕様)

プレイヤーが自分で開ける杯。案と社長の答え: [`docs/progress/card-tournament/personal-cup/README.md`](../progress/card-tournament/personal-cup/README.md)。
公式杯(運営が開く大会)は [`CARD_TOURNAMENT.md`](CARD_TOURNAMENT.md)。

## 決まり(2026-10-31 社長)

| | 決まり |
| --- | --- |
| 遊び方 | **リアルタイム杯**(`mode='live'`・決めた時刻に集まって自分で戦う)と **オート杯**(`mode='auto'`・登録デッキでサーバが自動で回し、発表の時刻に結果) |
| 形式 | **総当たり**(`format='rr'`・4〜8人)か **トーナメント**(`format='ko'`・4〜16人)を主催が選ぶ |
| 開ける人 | だれでも(条件なし)。主催は自動で参加者になる。主催も参加者も登録デッキが要る(リアルタイム杯でも、来ない人は登録デッキが自動で戦うため) |
| 募り方 | 合言葉(6けたの数字。参加者だけが見られる)と公開の一覧(`listed`)。杯の名前・主催名は画面に出すとき `cardChatMask`(91 の悪い言葉の置き換え)を通す |
| 上限 | 1人が開ける杯は同時に1つ / 出られる杯は同時に3つ / 同時に開いている杯は全体で200まで / オート杯は同じ発表の時刻に3杯まで |
| 時刻 | オート杯: 締め切りは10分後〜3日後・発表は締め切りの1時間後から・ちょうどの時(分は0)。リアルタイム杯: 始まる時刻は15分後〜3日後・15分きざみ(締め切り = 始まる時刻) |
| ごほうび | 主催・主催仲間が自分の持ち物から出せる。参加費も決められる(なしでもよい)。サーバで預かり、終わったらギフトボックスへ配る(下の「ごほうびと参加費」)。ランキング・カードランク・強さの点数には入らない |
| 見返し | 各試合を「見返す」で見られる。公開にした杯は、終わって30日のあいだ、だれでも結果と見返しを見られる(公開の一覧の「終わった杯」)。合言葉だけの杯は参加者だけ(2026-10-31 社長 案A・30日) |
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
| 表と関数 | `docs/sql/card-cup/CARD_CUP_APPLY.sql`(`card_cups`・`card_cup_entries`・`card_cup_matches` と、下の関数)と続きの `CARD_CUP_PUBLIC_DONE.sql`(終わった杯の見方) |
| オート杯を回す所 | `supabase/functions/card-tournament-run/cup.js`(`runCups`。公式杯のあと、同じ残りの時間で回す) |
| 呼ぶ時刻 | `docs/sql/card-tournament/CARD_TOURNAMENT_SCHEDULE.sql`(1日中10分おき `*/10 * * * *`) |
| 計算 | `82-card-tournament-core.jsx` の総当たり(`cardTourSchedule`・`cardTourStandings`)とトーナメント(`cardTourKoFirst`・`cardTourKoMatches`・`cardTourKoWinners`・`cardTourKoNextPairs`・`cardTourKoPlaces`) |
| 検査 | `tools/card/card-cup-run-check.js`(偽物の表で回す)・`tools/card/card-tournament-core-check.js` の G |

### 関数(ゲームから呼ぶ。`rest/v1/rpc/<名前>`)

| 関数 | 引数 | 返り値 |
| --- | --- | --- |
| `card_cup_create` | `p_owner, p_key, p_name, p_host_name, p_icon, p_mode, p_format, p_max, p_listed, p_entry_until, p_start_at` | `{ status, id, code }`。status: `ok` / `bad` / `busy`(開いている杯がもうある)/ `slot`(その発表の時刻はいっぱい)/ `crowded`(全体の上限)/ `many`(出ている杯が3つ)/ `nodeck`(登録デッキが要る)/ `locked`(鍵がちがう) |
| `card_cup_list` | なし | 受付中・一覧に出す杯(始まりの早い順に50まで)。合言葉は入らない |
| `card_cup_mine` | `p_owner` | 自分が開いた・出ている杯(受付中・開催中と、終わって14日まで) |
| `card_cup_find` | `p_code` | 合言葉の杯(受付中だけ)・無ければ null |
| `card_cup_join` | `p_cup, p_owner, p_key, p_name, p_icon` | `ok` / `bad` / `closed` / `full` / `many` / `nodeck` / `locked` |
| `card_cup_leave` | `p_cup, p_owner, p_key` | `ok` / `closed` / `none` / `locked` / `host`(主催は抜けられない) |
| `card_cup_cancel` | `p_cup, p_owner, p_key` | `ok` / `closed` / `locked`(主催だけ・受付中だけ。状態を `closed` にする) |
| `card_cup_view` | `p_cup, p_owner` | `{ cup(code は参加者だけ・bracket), me, entries, matches }`。オート杯の結果は「終わって、発表の時刻を過ぎた」ときだけ。リアルタイム杯はすぐ |
| `card_cup_match` | `p_id` | 1試合の見返しの材料(種・先攻・手・ルールの版・両方のデッキ・実況)。公開の杯だけ(CARD_CUP_PUBLIC_DONE.sql で差しかえ) |
| `card_cup_match_for` | `p_id, p_owner` | 同じ材料。公開の杯はだれでも・合言葉だけの杯は参加者だけ(2026-10-31) |
| `card_cup_list_done` | なし | 終わった公開の杯(終わって30日まで・新しい順に50まで)(2026-10-31) |

杯の1行(`card_cup_row`)の形: `{ id, name, host_id, host_name, host_icon, mode, format, max, listed, status, entry_until, start_at, closed_reason, done_at, players }`。
`status`: `entry`(受付中)/ `running`(開催中)/ `done`(終わり)/ `closed`(取り消し `host`・人数が足りない `few`)。

鍵: オート杯はみんなのデッキと同じ持ち主の鍵(`mh_card_deck_owner_key_v1`。登録デッキの鍵の指紋と合うこと)。
どちらの遊び方も、入るときに登録デッキの鍵の指紋と合うか確かめる。

### オート杯の流れ(サーバ)

1. 締め切り(`entry_until`)を過ぎたら、登録デッキの写しを取り、受付の順に席(0 から)を決める。デッキが壊れた人は外す。2人に足りなければ `closed`(`few`)
2. 試合を作る: 総当たりは全部(`round` = 日・`slot` = 通し番号)、トーナメントは1回戦(不戦勝は試合にしない。山の並びは `card_cups.bracket.rounds`)
3. 発表の2時間前から回す。トーナメントは回戦が終わるごとに次の回戦を作る
4. 全部終わったら順位(総当たり: 勝ち数 → 倒した数 → 2人の対戦 → 受付の早さ / トーナメント: 1・2・3・5・9)と勝ち数を書いて `done`
5. 画面に出るのは発表の時刻(`start_at`)から

### リアルタイム杯(④ で作る。2026-10-31 社長の答え)

- **試合はいまのマルチ対戦と同じ仕組み**: 同じ試合を2台で同時に戦い、終わったら山札を見せ合って正しく終わったか確かめる(なぞり直し `cardPvpVerify`)。
  結果の決め方・切断・途中で抜けたときの扱い(抜けた側の負けなど)も、いまのマルチ対戦に合わせる。新しい「申告して突き合わせる」仕組みは作らない
  (社長「リアルタイムでマルチで同じで同時に戦うんじゃないの?」)。部屋の合言葉はサーバが試合ごとに割り当てる(91 の部屋・Realtime の Broadcast)
- **来ない人は登録デッキが自動で戦う**(社長「いない人はオートになる」): 試合の時刻に来ていない人は、不戦敗ではなく、その人の登録デッキ(戦術カードどおりの賢さ)が戦う。
  来ている相手は自分で操作して、そのデッキと戦う(フリー対戦の「ほかのブリーダー」と同じ)。2人とも来ない試合は、オート杯と同じくサーバが自動で決める
- そのため、リアルタイム杯も**主催と参加者に登録デッキが要る**(`card_cup_create`・`card_cup_join` が確かめる。下の「決めてほしい所」の案A)。
  来ない人のデッキは、始まる時刻に登録デッキの写しを取る
- 表の列は用意してある: `card_cup_entries.checkin_at`(来ているかの印)・`deck`/`tactics`(写し)・`card_cup_matches.decided`(決まり方。例 `ko`/`deck`/`limit`/`auto`)
- 画面は公式杯の 99-card-tournament.jsx とは別の部品ファイルに分け、84 には入口を1か所だけ置く

#### サーバの関数(④ 区切り1・`docs/sql/card-cup/CARD_CUP_LIVE_APPLY.sql`。②のあとに流す・足すだけ)

| 関数 | 引数 | 返り値・決まり |
| --- | --- | --- |
| `card_cup_live_checkin` | `p_cup, p_owner, p_key` | `ok` / `early`(始まる10分前より前)/ `closed` / `none`(参加者でない・鍵が違う)/ `bad`。来たら杯の終わりまで「来ている」(`checkin_at`) |
| `card_cup_live_start` | `p_cup, p_owner, p_key` | `ok`(始めた・もう始まっている)/ `early` / `wait`(主催が早く始めたいが全員そろっていない)/ `few`(2人に足りず中止)/ `none` / `closed`。始まる時刻を過ぎたら参加者のだれでも。写しを取り、席・1回戦(総当たりは全部。戦えるのは1回戦だけ)を作る |
| `card_cup_live_match` | `p_match, p_owner, p_key` | 1試合の材料(種・先攻・来ているか・両方の写し)。部屋の合言葉(8文字)は**その試合の2人だけ**に返す。2人のどちらかが呼ぶと「部屋に入った」(`join_a`/`join_b`)を記す |
| `card_cup_live_report` | `p_match, p_owner, p_key, p_winner(0=a・1=b), p_how, p_verified, p_kos, p_acts, p_rules` | `ok`(決まった)/ `wait` / `done` / `early` / `none` / `bad`。下の決まり方 |
| `card_cup_live_settle` | `p_cup` | 片方だけが結果を送って90秒たった試合を `leave` で決め、決めた数を返す(相手が抜けた・閉じた) |

決まり方(`decided`):

- `pvp`: 2台で戦った。自分の端末でなぞり直し(`cardPvpVerify`)が合えば、その答えで決まる。合わない・まだのときは、2台の答えが同じなら決まる
- `leave`: 片方だけが送り、90秒たっても相手が送らない(いまのマルチ対戦と同じく、抜けた側の負け)
- `absent`: 相手が集合していない、または部屋に来ないまま2分たった。来ている側が、相手の写し(登録デッキ・`cardSharePolicy`)と戦って送る
- `auto`: 2人とも来ない・2台の答えが食い違った。来ている参加者のだれかの端末が、写しどうしを試合の種で回して送る(`cardTourPlay` と同じ。だれが回しても同じ結果)

見返し(2026-10-31 社長「個人杯はあとから各バトルの結果を見返すことはできる?」): 決まった試合には、種・先攻・手の並び(`acts`)・ルールの版(`rules`)が残る。
両方のデッキは `card_cup_entries` の写し。読むのは②の `card_cup_match`(入口と画面は③)。**手の並びを書くのは、その試合を決めた1回だけ**
(2台とも送っても、決まったあとの送りは `done` で書かない)。片方だけが送って抜けた試合は、待つあいだに先に送った側の手を残し、`leave` で決まるときに使う。
食い違った試合は、auto の手で書く。

止まった杯(2026-10-31 社長): 戦えるようになって **30分** たっても決まらない試合(だれも開かない杯)は、サーバ(`card-tournament-run` の `cup.js` の `runLiveCups`・10分おき)が
写しどうしで回して `auto` で決める。始まらないまま30分を過ぎた杯も、そこで始める。待ち時間は `cup.js` の `CUP_LIVE_IDLE_MS` 1か所。
SQL は `docs/sql/card-cup/CARD_CUP_LIVE_AUTO_APPLY.sql`(`card_cup_live_server_due`・`card_cup_live_server_decide`。サーバ(service_role)だけが呼べる)。
回し方の key は「杯|回戦|枠」(端末が auto で回すときも同じにして、だれが回しても同じ結果)。

ごほうび・参加費のある杯(2026-10-31 社長 A): 2台のなぞり直しが合ったときだけ確定し、合わない・確かめていない答えは食い違いにして auto で決め直す。
印の欄はまだ無いので、SQL の `card_cup_live_reward(杯)` が今はいつも false(欄ができたら、この関数1つを差し替える)。

試合が決まるたびに進める: トーナメントは回戦が終わると次の回戦(勝ち上がりは隣どうし・山の並びは `bracket.rounds`)、総当たりは次の回戦を戦えるようにする。
全部終わったら順位・勝ち数を書いて `done`(トーナメント 1・2・3・5・9 / 総当たり 勝ち数 → 倒した数 → 2人の対戦 → 席)。
確かめ: `tools/card/card-cup-live-sql-check.js`(手元に PostgreSQL があれば、使い捨てのデータベースで筋書きを流す)

#### 決めてほしい所: 登録デッキの無い人(社長に聞いている)

- **案A(おすすめ・いまの SQL はこの形)**: リアルタイム杯も参加の条件にデッキ登録を入れる。来ない人の代わりに戦うデッキと戦い方が、いつも決まっている
- 案B: エントリーのときに、手持ちのデッキから1つ選んで写しを送る(戦術カードは無し = EXPERT の打ち方)。デッキ登録をしていない人も出られるが、写しを送る口と検査が増える

## 公開の手順(窓口)

1. `CARD_CUP_APPLY.sql` を流す(足すだけ)
2. 呼ぶ時刻を1日中にする(`CARD_TOURNAMENT_SCHEDULE.sql` の呼ぶ仕組みの所だけ流し直す)
3. サーバの関数 `card-tournament-run` を出し直す(`index.ts`・`core.js`・`cup.js`・`game.js`。game.js の配り方は CARD_TOURNAMENT.md)

## ごほうびと参加費(2026-10-31 社長)

案と絵: [`docs/progress/card-tournament/personal-cup/prize/README.md`](../progress/card-tournament/personal-cup/prize/README.md)。SQL: `docs/sql/card-cup/CARD_CUP_PRIZE_APPLY.sql`(足すだけ)。

- 出せる物: 表 `card_cup_prize_items`(ダイヤ・ビートP・虹のプシュケー・虹の超越の実・勇者の証・証片・セッション券・スキップチケット・トレーニングチケット・染色もどき・戦術カードのかけら・カードパック券・カタログ)。**出す量・参加費の額に上限は付けない**(2026-10-31 社長「やっぱり上限はなしでいい」。持っている分なら、どの物もいくつでも。参加費にもどの物でも使える)。窓口が行を足して物を増やす
- 主催仲間: 主催・主催仲間が自分のフレンドを誘う(何人でも)。受けた仲間は主催と同じように動ける(出す・合言葉を見る・参加費と配り方・仲間の出し入れ)。**杯の取り消しは主催だけ**
- 主催・主催仲間は参加費を払わず、ごほうびも受け取らない(配る順位に入れない。その分は次の順位の人へ)
- 配り方: 1位から8位までの割合(合計100)。人数が足りず使わない順位の分は1位へ。同じ順位は人数で分ける。端数は1位へ
- 預かり: 端末で減らすのと同じ取引で `mh_card_cup_wallet_v1` に印 → `card_cup_deposit` / `card_cup_join_pay`(nonce ごとに1回)。受け取りは `card_cup_claim`(最初の nonce だけに中身)→ ギフトボックス
- 戻す: 取り消し・人数不足・受付が終わった時点で抜けていた人・外された主催仲間・配る人がいない杯
- リアルタイム杯: `card_cup_live_reward` が「預かった物か参加費があれば true」(ごほうびのある杯は、なぞり直しが合ったときだけ確定)
- 今の関数で触るのは `card_cup_live_reward` と `card_cup_join` の先頭1行(参加費のある杯は `card_cup_join_pay` からだけ)の2つだけ

