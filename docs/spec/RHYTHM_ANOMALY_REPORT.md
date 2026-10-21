# 判定の異変を毎日報告する(モンヒロビート)

2026-10-16 社長の決定(APIクレジットの使い道「判定の異変を毎日報告」)。ゲーム本体は何も変わらない。

## しくみ
```
pg_cron 'rhythm-anomaly-report'(毎日 18:10 UTC = 3:10 JST)
  └ pg_net で POST {SUPABASE_URL}/functions/v1/rhythm-anomaly-report(ヘッダー x-cron-token = Vault の rhythm_anomaly_cron_token)
      └ supabase/functions/rhythm-anomaly-report/index.ts(入口・verify_jwt は外す)
          ├ rhythm_anomaly_token_ok(合言葉を DB で照らす。違えば 403。合言葉の値は関数も知らない)
          ├ rhythm_anomaly_facts(日付)(日本時間の前日と、その前の7日を比べた集計 JSON)
          ├ 異変0件・端末の種類ごとの急な上がりも無し → Claude を呼ばずに quiet
          ├ それ以外 → Claude Haiku 5.5(claude-haiku-5-5・effort low・max_tokens 4000)で短い日本語の報告
          └ rhythm_anomaly_reports へ1日1行(report_date で上書き)
```
中身は `core.js`。偽物の Claude・偽物の DB で `node tools/mode/rhythm-anomaly-report-check.js` が確かめる(合言葉ちがい 403・quiet・ok・refused・エラー・個人の情報の欄)。

## 異変の条件(rhythm_anomaly_facts)
- 曲×難易度×端末の種類(ios / android)ごとの MISS 率(`rhythm_touch_diagnostics` の stats.misses ÷ note_count)
- 前日2回以上・300ノーツ以上、前の7日にも2回以上**かつ2台以上の端末**、前日が前の7日の1.5倍以上かつ +2ポイント以上 → 多い順に10件まで
  - 端末の数(2026-10-16 社長の決定): 前の7日を1人だけが遊んだ曲では、新しい人が数回遊んだだけで MISS 率が大きく動き、異変に挙がっていた(風がそよぐ場所 HELL android)。
    端末は `device_key` で数える(数 `devices_base` だけを報告に入れ、値そのものは出さない)。SQL: `docs/sql/rankings/RHYTHM_ANOMALY_FACTS_DEVICES2_APPLY.sql`(窓口ではなくテンポくんが流した)
- 集計から外すプレイ(外すのは見張りの集計だけ。表・既存の行・ランキング・記録は変えない)
  - 連打の多いプレイ(1ノーツあたりのタッチが5回を超える・2026-10-19 社長の決定)。外した数は `mashed_excluded_day`。SQL: `docs/sql/rankings/RHYTHM_ANOMALY_FACTS_MASH_APPLY.sql`
  - 曲の途中から放置したプレイ(入力5回以下・未クリア・2026-10-21 社長の決定)。外した数は `abandoned_excluded_day`。
    10/20 に1台が toriko MASTER を最初の1回だけ押して放置し(MISS 158/159)、android の MISS 率が 4.11%(外すと 2.39%)になって旗の元になった。
    区間ごとの MISS(`rhythm_play_logs`)では入力の数が無いので、未クリアで MISS でないノーツが5個以下の1回を外す。SQL: `docs/sql/rankings/RHYTHM_ANOMALY_FACTS_ABANDON_APPLY.sql`
- 挙がった曲は `rhythm_play_logs` の deltas(`zz` が MISS)から、曲のはじめからノーツの順で5%ずつ20区間の MISS の数を出す(秒が要るときは `tools/mode/rhythm-play-log.js` で直す)
- 端末の種類ごとの全体(MISS 率・何も押していない MISS 率・遅れて届いたタッチの率・34ms超のコマ)と、前日に動いていた版(app_build)も入れる
- 個人を特定できるもの(device_key・名前・ブリーダーID)は SQL の時点で外す。関数も渡す前に欄が無いことを確かめる

## 読み方(窓口の毎晩の見張り)
```sql
select report_date, status, flagged_count, summary from public.rhythm_anomaly_reports order by report_date desc limit 3;
```
status: `ok`(報告あり)/ `quiet`(変化なし・Claude を呼んでいない)/ `refused`(断られた・数字の表だけ)/ `error`

## 費用
1回あたり 入力 約1,200・出力 約1,500トークン(10/16 のためしの実測 1,155 / 1,524)で約 $0.0009。変化の無い日は0。

## 手で動かす・止める
- 手で1日ぶん: cron と同じ `net.http_post` に `?day=YYYY-MM-DD` を付けて SQL で流す(合言葉を外に出さないため)
- 止める: `select cron.unschedule('rhythm-anomaly-report');`(表と関数は残してもゲームには何も起きない)

## DB 側
表 `rhythm_anomaly_reports`・関数 `rhythm_anomaly_facts` / `rhythm_anomaly_token_ok`・pg_cron / pg_net・Vault の合言葉は、2026-10-16 に窓口がまとめて流した(既存の表は変えていない)。
