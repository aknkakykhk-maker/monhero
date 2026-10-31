# 公式杯を開くとき(どこに何を入れれば出るか)

2026-10-31 社長「大会名・開催日・ビートPの量は、やるときに決める」。ゲームの側は、**サーバの大会の表(`card_tournaments`)に1行足すだけ**で、HOME の札・大会の画面・プロフィールの記録まで出る作りにしてある。ゲームの公開(PR)は要らない。

## 入れるもの(大会ごとに1行)

| 列 | 中身 | どこに出るか |
| --- | --- | --- |
| `id` | 英小文字・数字・`-`・`_` で32字まで(例 `cup-2026-11`)。大会ごとに別の名前 | 画面には出ない(受け取ったごほうびの記録の見分けに使う) |
| `name` | 大会名(40字まで。例「第1回 MFバトルカード公式杯」) | HOME の札・大会のトップ・プロフィールの記録 |
| `open_on` | 受付を始める日(日本時間の日付。その日の 0:00 から) | HOME の札はこの日から出る |
| `entry_until` | 受付の締め切り(日時) | HOME の札の「受付中 あと◯日」・大会のトップ |
| `rewards` | ごほうびの表(ビートPだけ。下の形) | HOME の札は1位の量だけ「1位 ビートP ◯◯」。0 なら出さない |

`status`(`entry` のまま)・`first_day`・`groups`・`done_day` は入れない。締め切りのあとサーバが書く(組分け・日程・最終日)。

### ごほうびの表(`rewards`)

```json
{ "ranks": [{ "point": 10000 }, { "point": 5000 }, { "point": 3000 }], "participation": { "point": 500 }, "perWin": 100 }
```

- `ranks` … 1位から順のビートP。表に無い順位は `participation`(出ただけでもらえる量)
- `perWin` … 1勝ごとに足すビートP

### 足し方(窓口。足すだけ)

```sql
insert into card_tournaments (id, name, open_on, entry_until, rewards)
values ('cup-2026-11', '第1回 MFバトルカード公式杯', date '2026-11-07', timestamptz '2026-11-09 23:59:00+09',
        '{"ranks":[{"point":10000},{"point":5000},{"point":3000}],"participation":{"point":500},"perWin":100}');
```

(値は例。名前・日付・ビートPは社長が決めたものに替える)

## 出る・消える時期

| 時期 | HOME の札(ハロウィン・ナイトの札の下、MFバトルカードの上) | プロフィール |
| --- | --- | --- |
| 大会の行が1つも無い | 出ない | 「公式杯の記録」は出ない |
| `open_on` の前 | 出ない | — |
| 受付中 | 「受付中 あと◯日」(1日を切ったら時間・1時間を切ったら分) | — |
| 締め切り〜組分けまで | 「組み合わせ中」 | — |
| 開催中 | 「開催中」/「開催中 頂上決戦」 | — |
| 結果発表(最終日の 4:00)から1週間 | 「結果発表」 | 「公式杯の記録(◯件)」に並ぶ |
| 1週間のあと | 出ない | 並んだまま(新しい順に50件まで) |

- HOME の札を押すと、いつも大会のトップ(戻ると HOME)
- 札の中身を決める所: `monster-hero/src/parts/99-card-tournament.jsx` の `cardTourHomeBanner`。1週間は `CARD_TOUR_HOME_KEEP_MS`
- プロフィールの記録: 同じファイルの `CardTourHistoryButton`。読むのは `card_tournament_history`(`docs/sql/card-tournament/CARD_TOURNAMENT_HISTORY_APPLY.sql`。読むだけ)

## 先に済ませておくこと(1回だけ)

- `CARD_TOURNAMENT_APPLY.sql`・`CARD_TOURNAMENT_SCHEDULE.sql`・サーバの関数 `card-tournament-run`(手順は [`docs/spec/CARD_TOURNAMENT.md`](../../spec/CARD_TOURNAMENT.md)「公開の手順」)
- `CARD_TOURNAMENT_HISTORY_APPLY.sql`(プロフィールの記録)
- 告知(更新履歴・助手のお知らせ)は、大会を開くたびに文を決める
