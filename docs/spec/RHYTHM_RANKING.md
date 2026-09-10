# モンヒロビート ランキング設計書

モンヒロビート（音ゲー）のランキング全体の**正本**。
2026-09-11、ユーザーの指示「ランキングにブリーダー別の全スコア合算ランキングがほしい。
また今後イベントで実装するための週間ランキングとイベント曲に選ばれたランキングなども含めて
まず仕様から決めたい」を受けてまとめた。

- 現行の曲別ランキング（実装済み）の仕組みは
  [`RHYTHM_MODE.md`](RHYTHM_MODE.md) §9.5 に詳しい。ここでは前提として要約だけ置く
- [`RHYTHM_MODE.md`](RHYTHM_MODE.md) §18〜22 にあった「週間ランキング（確定・未実装）」
  「未確定事項」は、この文書へ引き継いだ。あちらは経緯として残し、
  **確定内容の参照先はこの文書**とする

> この文書は仕様だけを決めたもので、**2026-09-11 時点でコードは1行も書いていない**。
> 実装は §12 のフェーズ順に進める。

---

## 1. 2026-09-11 にユーザーが決めたこと

先に結論だけ。詳細はそれぞれの節にある。

| 論点 | 決定 |
| --- | --- |
| 合算の単位 | **曲ごとのベスト1件（難易度を問わない最高スコア）を全曲合計**（§3） |
| 集計をどこでやるか | **Supabase に読み取り専用の集計ビュー／関数を追加**する（§8） |
| 週の区切り | **毎週月曜 5:00 JST**。期間限定イベントは開始・終了を自由に決める（§6・§7） |
| イベントの部門構成 | **対象3曲＋週間総合の4部門**（`RHYTHM_MODE.md` §19 のまま）（§7） |
| ブリーダーの見分け方 | **`rankings` へ `breeder_id` 列を足す**（§4） |
| 曲が増えることへの備え | **曲数をどこにも書かない作りにする**（§5） |

---

## 2. いまあるもの（実装済み・2026-09-04〜）

新しい仕組みは、すべてこの上に足す。既存の動きは変えない。

- **曲別ランキング**（難易度合算）。曲えらびの「🏆この曲の全国ランキング」から開く
- 保存先は既存の Supabase `rankings` テーブル。`difficulty` 列へ
  `Rhythm-<songId>-<難易度id>` という専用キーを入れて他モードと区別する。
  **新しいテーブルは作っていない**
- 1プレイ＝1行。表示のときにユーザー名で畳んで最高スコア1件だけを見せる
  （`rhythmRankingDedupeByUser`）
- 送るのは体験版からのプレイだけ（`rhythmPlay.from==='demo'`）。デバッグプレイは送らない
- 公開曲は17曲（`RHYTHM_DEMO_SONG_IDS`）、難易度は EASY / NORMAL / HARD / EXPERT / MASTER の5つ

難易度ごとの最大スコアは `RHYTHM_MODE.md` §3 のとおり。

| 難易度 | 最大スコア |
| --- | ---: |
| EASY | 600,000 |
| NORMAL | 700,000 |
| HARD | 800,000 |
| EXPERT | 900,000 |
| MASTER | 1,000,000 |

---

## 3. ブリーダー別 全曲合算ランキング（常設）

### 3.1 何を競うか

**その人が持っている「曲ごとのベスト1件」を、公開曲すべてぶん足した合計点**で競う。

1. ある曲について、その人のいちばん高いスコアを1件だけ取る（**難易度は問わない**）
2. それを公開曲すべてぶん合計する
3. 合計点の高い順に並べる

難易度を問わないのは、既存の曲別ランキングとまったく同じ考え方
（`RHYTHM_MODE.md` §19「難易度別ランキングへ分けない」）。難易度が高いほど満点も高いので、
**MASTER を高精度で通した曲の記録が自然と採用される**。ただし MASTER で崩れたときは
HARD をフルコンボしたほうが上になることもあり、その場合はそちらが採用される。
難易度そのものへの順位補正は付けない。

### 3.2 いまの上限

17曲すべてで MASTER 満点＝ **17,000,000点**。曲が増えれば上限も上がる（§5）。

「曲×難易度ごとのベストを全部足す（5難易度ぶん埋める）」方式は採らない。
EASY まで含めて全部埋めた人が強くなる＝作業量が順位になってしまうため。

### 3.3 同点のとき

合計点が同じときは、**その合計に先に到達したほうを上**にする
（合算に採用された記録のうち、いちばん新しいものの記録時刻が早い順）。

現行の曲別ランキングは同点処理を持たない（取得順に並ぶ）が、合算は同点が起きやすいので
ここだけ決めておく。既存の曲別ランキングの並びには手を触れない。

### 3.4 一覧に出す項目

| 項目 | 内容 |
| --- | --- |
| 順位 | 1位から |
| ブリーダー名・アイコン | 既存の曲別ランキングと同じ |
| 合算スコア | 例: 12,480,300 |
| 載っている曲数 | 例: 「14 / 17曲」。分母は公開曲数から自動で入る（§5） |
| 達成率 | 例: 「73.4%」。合計 ÷（公開曲数 × 1,000,000） |
| ブリーダーLv | 最後にプレイしたときの値 |

「載っている曲数」と「達成率」を出すのは、**まだ遊んでいない曲がある人に伸びしろを見せる**ため。
1曲も遊んでいない人は載らない。

表示件数は上位50件（現行の `RHYTHM_RANKING_DISPLAY_LIMIT` と同じ）。

### 3.5 対象にする記録

- 対象は `rankings` テーブルの `Rhythm-` で始まる行すべて
- テスト曲・デバッグプレイは**送信の入口で弾いている**ので、そもそも記録として入らない。
  そのため集計側で曲の一覧を二重に持たない（§5）
- ただし万一まぎれ込んだときや、曲を下げることになったときに備え、
  **除外用の小さなテーブルを1つ用意**する（§8.5）。平常時は空のまま

---

## 4. ブリーダーの同一性（`breeder_id`）

**2026-09-11、ユーザーが「ID列を足すでオーケー」と判断した。**

### 4.1 なぜ要るか

いまは `user_name` だけで人を見分けている。曲別ランキング（最高1件を見せるだけ）なら
同名がいても「その名前でいちばん高い記録」が出るだけだが、**合算は「その人の全曲を足す」ため、
同名の人がいると合計が混ざって別人の点まで足されてしまう**。報酬（§9）を配るなら、
ここが曖昧なままでは進められない。

### 4.2 端末側

- 新しい保存キー **`mh_breeder_id_v1`** に、端末で1回だけ作った UUID を保存する
- `crypto.randomUUID()` を使い、無い環境では `createRunId()` と同じ作り方へ落とす
- **一度作ったら変えない。** ブリーダー名を変えても同じIDのまま
- 端末を変えると別IDになる（引き継ぎの仕組みが無いため）。これは現行と同じ状況で、
  悪くはならない
- 保存キーは**新設のみ**。既存の `mh_*` は読みも書きも変えない（`CLAUDE.md` ⑦）

### 4.3 DB側

```sql
alter table public.rankings add column if not exists breeder_id text;
```

- **既存行は NULL のまま。** 行の書き換えも移行も一切しない
- `turns` / `reached_wave` を後から足したときとまったく同じやり方（前例がある）
- 列を足す前でも送信が壊れないよう、**「その列は無い」という応答を見て自動で落として送り直す**
  仕組みを用意する（既存の `_isMissingColumnError` / `rankingRunStatsUnavailable` と同じ形）。
  これがあると、SQLの適用とアプリの公開の順番が前後しても記録が失われない

### 4.4 IDが無かった時代の記録をどう引き継ぐか

そのまま「IDのある行」と「IDの無い行」を別人扱いすると、**これまで遊んだぶんが消えたように見える**。
かといって名前だけで結び付けると、同名別人を混ぜてしまう。そこで、
**名前とIDの対応が1対1のときだけ橋渡しする。**

集計に使う人の単位（`identity_key`）はこう決める。

| その行 | 使うキー |
| --- | --- |
| `breeder_id` がある | その `breeder_id` |
| `breeder_id` が無く、その名前に結び付くIDが**1つだけ**観測されている | そのID（＝過去の記録が引き継がれる） |
| `breeder_id` が無く、その名前に**2つ以上**のIDがある（＝同名別人がいる） | `name:<名前>`（推測で誰かに足さない） |

3つめは「昔の記録が誰のものか判定できない」ケース。**推測で足すより、分けたまま置く**。

### 4.5 表示

- 表示名は、そのグループの**いちばん新しい記録の `user_name`**。名前を変えても追従する
- 同名別人は、同じ表示名で2行並ぶことがある。これは正しい状態
  （ブリーダーLvとアイコンで見分ける）

### 4.6 対策の水準

`breeder_id` はクライアントが送る値なので、他人のIDを送ること自体は技術的には可能。
ただし現行も名前を自由に名乗れるので、**水準は下がらない（むしろ上がる）**。
`RHYTHM_MODE.md` §9.5 の「既存モードと同じ水準」をそのまま引き継ぐ。

### 4.7 適用範囲

- 列は `rankings` 全体へ足すが、**送るのはまずモンビーの送信経路だけ**（`sbInsertRhythmScore`）。
  既存モードの送信（`sbInsertScore`）は今回触らない
- 通常バトル・プロ・極限・種族チャレンジや、ブリーダーLvランキングの名寄せへ広げるのは
  別の依頼として扱う。**列は共通なので、あとから送り始めるだけで使える**

---

## 5. 曲が増え続けることへの対応

**2026-09-11、ユーザーの指示「曲数はこれからふえるからそれも対応できる仕様にして」。**

### 5.1 曲数をどこにも書かない

| 場所 | 曲を足したときにやること |
| --- | --- |
| 公開曲の一覧 | `RHYTHM_DEMO_SONG_IDS` へ1行（いまと同じ） |
| 集計SQL | **なし**。`Rhythm-` で始まる行すべてが対象で、曲の一覧を持たない |
| 「◯ / ◯曲」の分母 | **なし**。`RHYTHM_DEMO_SONG_IDS.length` から取る |
| 達成率の理論満点 | **なし**。公開曲数 × 1,000,000 で計算する |
| ヘルプ | **なし**。`{ t:'data', id:'...' }` が実データから作る（`CLAUDE.md` ⑤） |
| 週間・イベントの対象曲 | イベント定義に曲IDを3つ書くだけ（§7） |

つまり、**新曲を足す手順（`RHYTHM_MODE.md`「動画1本から曲を足す手順」）は今までどおりで、
ランキングのための追加作業は発生しない。** 曲数を数字で書き写した場所を作らないことが、
この節の一番の中身。

### 5.2 曲が増えても重くならない

- 端末が受け取るのは**集計済みの上位50件**。曲数に依存しない
- 集計そのものは行数に比例するが、Rhythm行だけを見る部分索引で足りる（§8.6）
- さらに増えて重くなったときは、`rhythm_total_rankings` を
  **マテリアライズドビューへ差し替えられる**ようにしておく。
  ビューの名前と列を先に決めてあるので、**クライアントの取得URLを変えずに置き換えられる**。
  そのときは更新間隔（5分程度を想定）と、画面へ「◯分前の集計」と出すことをセットにする

### 5.3 新しい曲が出た直後

- 全員がその曲ぶん0点なので、**相対順位は動かない**。上限だけが上がる
- 総合タブに「**まだ載っていない曲: 3曲**」を出し、そこから曲えらびへ飛べるようにする。
  新曲が「伸びしろ」として見えるようにする
- 曲が増えたことを理由にランキングをリセットしたり、作り直したりはしない

### 5.4 数字のインフレを見えるようにする

合計点だけだと、曲が増えるほど数字が大きくなって「去年の1,200万点」と比べられなくなる。
**達成率**（合計 ÷ 公開曲数 × 1,000,000）を必ず併記して、
「全曲MASTER満点に対してどこまで来たか」で比べられるようにする。

### 5.5 曲が減る方向

権利などの都合で曲を下げることになったら、**除外テーブルへ1行足す**と合算から外れる。
`rankings` の行は消さない（`CLAUDE.md` ⑦「消さない・上書きしない・別のキーに足す」）。

### 5.6 将来の逃げ道 — 「ベストN曲合計」

曲が30曲・50曲と増えると、「全曲やった人が強い＝作業量が順位になる」度合いが上がり、
新しく始めた人が追いつけなくなる。そうなったときは
**「ベストN曲合計」を新しい部門として足す**（既存の全曲合算は消さない）。

そのための土台を先に用意しておく。集計は §8.3 の `rhythm_song_bests`（曲ごとのベスト）を
共有しているので、**ビューを1枚足すだけ**で作れる。

```sql
-- 将来の例: 上位20曲だけ合計する（いまは作らない）
select identity_key, sum(score)::bigint as total_score
  from (select b.*, row_number() over (partition by b.identity_key order by b.score desc) as rn
          from public.rhythm_song_bests b) t
 where rn <= 20
 group by identity_key;
```

**切り替えの目安は公開曲30曲。** そこへ来たら改めて相談する（勝手に切り替えない）。
この判断があることを忘れないよう、§13 の未確定事項にも残す。

### 5.7 週間・イベントの対象曲えらび

曲が増えるほど選べる曲が増える。同じ曲が続けて選ばれないよう、イベント定義に `id` を
持たせてある（§7）ので、**過去の対象曲を見て避けるローテーションを後から足せる**。
いまは手で選ぶ。

### 5.8 `songId` の約束

**`songId` にハイフンを使わない。** ランキングキー `Rhythm-<songId>-<難易度id>` を
ハイフンで割って曲と難易度に戻しているため（§8.2）。曲が増えるほど踏みやすくなるので、
検査で見張る（§11）。

---

## 6. 週間ランキング

### 6.1 期間の区切り

**毎週月曜 5:00 JST**（＝日曜 20:00 UTC）。

- ウィークリーミッションの区切りは月曜 **4:00** JST（`missionWeeklyPeriod`）で、**1時間ずれる**。
  これは意図したずれで、「4:00 に週の記録が締まり、順位と報酬が固まってから 5:00 に
  次の週へ切り替わる」という並びにするため。実装のときにこの1時間を集計の締めに使う
- 期間の権威は**サーバー（Supabase）側**に置く。端末の時計を進めても週は変わらない。
  クライアントは DB から「今週の開始・終了」を受け取って表示する（§8.4）
- 画面には残り時間を出す。残り時間の見た目だけは端末時計で数える（1秒ごとの再描画を
  サーバーへ聞きに行かないため）

### 6.2 何を競うか

週間は**その週のあいだに出した記録だけ**で競う。常設の合算ランキング（§3）とは
完全に別枠で、互いに影響しない。先週の記録は今週のランキングに載らないが、
**常設ランキングと自己ベスト（`mh_rhythm_best_v1`）には残り続ける**。

### 6.3 部門

`RHYTHM_MODE.md` §19 のとおり、**対象3曲＋週間総合の4部門**。

1. 対象曲A スコアランキング
2. 対象曲B スコアランキング
3. 対象曲C スコアランキング
4. 週間総合スコアランキング

- 各曲ランキング＝その週に出したその曲のベスト1件（難易度は問わない）
- 週間総合＝**対象3曲それぞれのその週のベストを単純合算**した点数。
  上限は 3,000,000点（3曲すべて MASTER 満点）
- 3曲のうち1曲しか遊んでいない人も総合に載る（残り2曲は0点として扱う）。
  「3曲そろわないと載らない」にすると、途中参加した人が一切見えなくなるため

### 6.4 対象曲の選び方

その週の対象3曲は、**正式譜面が完成している曲**から選ぶ。
曲として並んでいるだけでは対象にしない（`RHYTHM_MODE.md` §19 の条件をそのまま引き継ぐ）。

対象曲の一覧は**クライアント側の静的データ**（`data/rhythm-event.js` 予定）に置き、
デプロイで切り替える。Supabase 側は「期間×曲ごとの集計」までを汎用に返し、
どの3曲を対象にするかは知らない（§8.4）。こうしておくと、
**イベントを差し替えるのに SQL を触らなくて済む**。

---

## 7. イベント曲ランキング

「週間ランキング」と「イベントランキング」は**同じ1つの仕組み**として作る。
違うのは期間の決め方だけ。

| | 週間 | 期間限定イベント |
| --- | --- | --- |
| 期間 | 毎週月曜 5:00 JST 区切りで自動更新 | イベント定義に開始・終了日時を直接書く |
| 対象曲 | その週の3曲 | イベントごとに決める（3曲を基本とする） |
| 部門 | 対象3曲＋総合の4部門 | 同じ |
| 報酬 | §9 | 同じ表を使う。イベント固有の報酬を足せる |

イベント定義（案）は次のような形にする。

```js
// data/rhythm-event.js（実装時に作る）
const RHYTHM_EVENTS = Object.freeze([
  {
    id: 'weekly_2026_09_14',      // 受取フラグの一部になるので、後から変えない
    kind: 'weekly',               // 'weekly' | 'limited'
    name: '今週のモンヒロビート',
    songIds: ['monster_hero', 'toriko', 'crossing_field'],
    // kind:'weekly' は期間を書かない（月曜5:00 JST 区切りで自動）
    // kind:'limited' は startAt / endAt を ISO8601 で書く
  },
]);
```

- 同時に成立するイベントは**1つまで**にする。週間と期間限定を重ねない
  （どちらの報酬か分からなくなるため）。期間限定を挟む週は、その週の週間を休む
- 開催していないときは、ランキング画面のイベントタブそのものを出さない
- `songIds` の数は3曲を基本とするが、**配列の長さで動く**ように作る。
  曲が増えて4曲・5曲のイベントをやりたくなったときに、部門の数だけが変わる（§5）
- 開催の告知は助手（みゅあ）の吹き出しで出す。`CLAUDE.md` ⑤の
  「大きい追加は画面のなかでの使い方案内もセット」に該当する

---

## 8. Supabase の設計

### 8.1 守ること

- **既存の `rankings` テーブルの行・RLS・権限は一切変えない。** 足すのは
  `breeder_id` 列（NULL許容・既存行は NULL のまま）、読み取り専用のビュー／関数、索引だけ
- ビューは `security_invoker = on` で作り、`rankings` の RLS をすり抜けないようにする
- 適用は `docs/sql/rankings/` の既存手順と同じ形（`*_APPLY.sql` / `*_VERIFY.sql` /
  `*_IPHONE_STEPS.md`）で用意する。iPhone の Supabase 画面から貼れること

### 8.2 土台 — Rhythm行を曲・難易度・人へ割る

```sql
-- ① Rhythm行を曲・難易度へ割る
create or replace view public.rhythm_scores
with (security_invoker = on) as
select r.id, r.created_at, r.user_name, r.breeder_id, r.level, r.icon, r.score,
       split_part(r.difficulty, '-', 2) as song_id,
       split_part(r.difficulty, '-', 3) as difficulty_id
  from public.rankings r
 where r.difficulty like 'Rhythm-%'
   and array_length(string_to_array(r.difficulty, '-'), 1) = 3
   and r.score is not null;

-- ② 名前とIDの橋渡し（§4.4）。1対1のときだけIDへ寄せる
create or replace view public.rhythm_identity_map
with (security_invoker = on) as
select user_name,
       case when count(distinct breeder_id) = 1 then min(breeder_id) end as merged_breeder_id
  from public.rhythm_scores
 where breeder_id is not null
 group by user_name;

-- ③ 人の単位(identity_key)を付ける
create or replace view public.rhythm_identified_scores
with (security_invoker = on) as
select s.*,
       coalesce(s.breeder_id, m.merged_breeder_id, 'name:' || s.user_name) as identity_key
  from public.rhythm_scores s
  left join public.rhythm_identity_map m on m.user_name = s.user_name;
```

`split_part` で割れるのは **songId にハイフンが入っていない**ことが前提（§5.8）。

### 8.3 常設の合算ランキング

```sql
-- ④ 曲ごとのベスト1件（難易度は問わない）
create or replace view public.rhythm_song_bests
with (security_invoker = on) as
select distinct on (s.identity_key, s.song_id)
       s.identity_key, s.user_name, s.song_id, s.difficulty_id,
       s.score, s.created_at, s.level, s.icon
  from public.rhythm_identified_scores s
 where not exists (select 1 from public.rhythm_ranking_song_exclusions x
                    where x.song_id = s.song_id)
 order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;

-- ⑤ ブリーダー別 全曲合算
create or replace view public.rhythm_total_rankings
with (security_invoker = on) as
select b.identity_key,
       (array_agg(b.user_name order by b.created_at desc))[1] as user_name,
       sum(b.score)::bigint                                   as total_score,
       count(*)::int                                          as song_count,
       max(b.created_at)                                      as last_scored_at,
       (array_agg(b.level order by b.created_at desc))[1]     as level,
       (array_agg(b.icon  order by b.created_at desc))[1]     as icon
  from public.rhythm_song_bests b
 group by b.identity_key;
```

表示名・Lv・アイコンは**いちばん新しい記録のもの**を採る（§4.5）。

並び順はビューに書かず、取得のたびに指定する（PostgREST は `order` で上書きするため）。

```
GET /rest/v1/rhythm_total_rankings
    ?select=identity_key,user_name,total_score,song_count,level,icon
    &order=total_score.desc,last_scored_at.asc
    &limit=50
```

同点処理（§3.3）は、この `order` の2番目でそのまま実現できる。
自分の順位は `identity_key` が自分の `breeder_id`（IDが無かった人は `name:<名前>`）の行を
探して求める。

### 8.4 週間・イベント

**期間と対象曲をパラメータで受ける関数**にする。イベントを差し替えても SQL を触らない。

```sql
-- 今週の開始・終了（月曜5:00 JST 区切り）。端末時計に依存させないための正本
create or replace view public.rhythm_week_window
with (security_invoker = on) as
select ws.week_start,
       ws.week_start + interval '7 days' as week_end
  from (select ((date_trunc('week', (now() at time zone 'Asia/Tokyo') - interval '5 hours')
                 + interval '5 hours') at time zone 'Asia/Tokyo') as week_start) ws;

-- 期間×対象曲の「曲ごとベスト」
create or replace function public.rhythm_event_song_bests(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select distinct on (s.identity_key, s.song_id)
         s.identity_key, s.user_name, s.song_id, s.difficulty_id,
         s.score, s.created_at, s.level, s.icon
    from public.rhythm_identified_scores s
   where s.song_id = any(song_ids)
     and s.created_at >= from_at and s.created_at < to_at
   order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;
$$;

-- 期間×対象曲の「総合」
create or replace function public.rhythm_event_totals(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, song_count int,
              last_scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select b.identity_key,
         (array_agg(b.user_name order by b.scored_at desc))[1],
         sum(b.score)::bigint, count(*)::int, max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1],
         (array_agg(b.icon  order by b.scored_at desc))[1]
    from public.rhythm_event_song_bests(song_ids, from_at, to_at) b
   group by b.identity_key;
$$;
```

`date_trunc('week', ...)` は月曜始まりなので、5時間ずらすだけで「月曜5:00 JST」になる。
期間限定イベント（§7）は、`from_at` / `to_at` にイベント定義の日時をそのまま渡す。
**対象曲は配列で渡すので、3曲でも5曲でも同じ関数で足りる**（§5.7）。

### 8.5 除外テーブル（平常時は空）

```sql
create table if not exists public.rhythm_ranking_song_exclusions (
  song_id text primary key,
  reason  text,
  created_at timestamptz not null default now()
);
```

テスト曲の記録がまぎれ込んだときや、曲を下げることになったとき（§5.5）に
1行足すためだけのもの。**`rankings` の行を消す運用はしない**（`CLAUDE.md` ⑦）。
記録はそのまま残り、集計から外れるだけになる。

### 8.6 索引

Rhythm行だけを対象にした部分索引を足す。既存の索引は触らない。

```sql
-- 合算（人×曲のベスト取り）。IDが付く前の行も名前で束ねるため両方置く
create index if not exists rankings_rhythm_breeder_score_idx
  on public.rankings (breeder_id, difficulty, score desc)
  where difficulty like 'Rhythm-%' and breeder_id is not null;

create index if not exists rankings_rhythm_user_score_idx
  on public.rankings (user_name, difficulty, score desc)
  where difficulty like 'Rhythm-%';

-- 週間・イベントの期間絞り込み
create index if not exists rankings_rhythm_created_at_idx
  on public.rankings (created_at desc)
  where difficulty like 'Rhythm-%';
```

> 索引を足すのは、2026-07 に「記録が増えて実機で8秒待っても返らず、
> 一度出たランキングが消える」障害を出しているため
> （`supabase/migrations/202607300001_rankings_indexes.sql`）。同じことを繰り返さない。

### 8.7 なぜ端末側で集計しないか

ブリーダーLvランキングは端末側で最大24,000行を取って集計している（`sbFetchAllBreederRows`）。
同じやり方を合算へ持ち込むと、**公開曲すべて×5難易度の全プレイ行**を端末が取ることになる。
1プレイ＝1行で増え続けるうえ、**曲が増えるほど行も増える**構造なので、
記録が貯まるほど確実に上の障害へ近づく。
集計済みの数十行だけを受け取る形にすれば、曲が増えても通信量は変わらない（§5.2）。

### 8.8 権限

```sql
grant select on public.rhythm_scores, public.rhythm_identity_map,
                public.rhythm_identified_scores, public.rhythm_song_bests,
                public.rhythm_total_rankings, public.rhythm_week_window,
                public.rhythm_ranking_song_exclusions to anon, authenticated;
grant execute on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz),
                          public.rhythm_event_totals(text[], timestamptz, timestamptz) to anon, authenticated;
```

書き込み権限は一切与えない。除外テーブルへの追加は Supabase の画面から手で行う。

---

## 9. 報酬

`RHYTHM_MODE.md` §20 で確定していた表をそのまま引き継ぐ。

| 順位 | 超越の実 | プシュケー |
| --- | ---: | ---: |
| 1位 | 5個 | 1,000 |
| 2位 | 4個 | 800 |
| 3位 | 3個 | 600 |
| 4位 | 2個 | 400 |
| 5位 | 1個 | 200 |

- 各曲ランキングは対応する種族の**超越の実**、**週間総合は虹の超越の実**
- プシュケー数は暫定値。実装前に経済バランスを見直す
- 3曲側でどの種族の超越の実を使うかは**実装前に対応表を確認する**。会話だけから割り当てない

### 9.1 受け取り方（案・未確定）

このゲームはサーバー処理を持たない（Supabase は記録の保存と閲覧だけ）。そのため、

1. 週／イベントが終わったあと、最初に起動したときに、締め切り後の順位をサーバーへ問い合わせる
2. 自分の順位に応じた報酬をその場で受け取る
3. 受け取り済みは**新しい保存キー** `mh_rhythm_event_reward_v1` へイベントIDの配列で残し、
   二重受取を防ぐ（`CLAUDE.md` ⑦「一度きりの付与には専用のフラグ」）

自分がどの行かは `identity_key`（§4）で確実に分かるので、同名の人がいても取り違えない。
未受取のまま次の週へ入っても、フラグに無いイベントIDは受け取れる（何週ぶんか貯めておける）。
ただし**受け取れる期間の上限**は決めていない（§13）。

### 9.2 参加報酬（未確定）

`RHYTHM_MODE.md` §20 の候補（ダイヤ×3,000 / プシュケー×50）はそのまま未確定。
成立条件（1曲でも遊べば成立か、3曲すべてか）と付与単位（週で1回か部門ごとか）も未確定。

---

## 10. 画面と導線

### 10.1 ランキング画面にタブを置く

いまの `RHYTHM_RANKING` 画面（`RhythmRankingScreen`）へタブを足す。
**新しい `gameState` は増やさない**（画面を増やすと `HELP_SCREEN_COVERAGE` から
ヘルプ・戻り先・BGM継続の対象漏れが出るため）。

| タブ | 中身 | 出す条件 |
| --- | --- | --- |
| この曲 | 現行の曲別ランキング（難易度合算） | 常時 |
| 総合 | ブリーダー別 全曲合算（§3） | 常時 |
| イベント | 対象曲＋総合の部門（§7） | 開催中だけ |

- 開いたときの既定は「この曲」。曲えらびの「🏆この曲の全国ランキング」から入る
  導線をそのまま保つため
- 「総合」には自分の順位・合算スコア・載っている曲数・達成率を上に固定で出す。
  50位以内に入っていない人でも自分の位置が分かるようにする
- 「総合」には**まだ載っていない曲**も出し、そこから曲えらびへ飛べるようにする（§5.3）
- イベントの部門はタブの中でさらに切り替える（曲ごと＋総合）。
  部門の数は対象曲の数から作る（§7）

### 10.2 ヘルプ・更新履歴・告知

`CLAUDE.md` ⑤のとおり、実装のたびに次をセットで行う。

- ヘルプ（`data/help.js`）にランキングの項目を作る／書き直す。
  部門・集計方法・週の区切りを載せる。報酬表のような一覧になるものは
  `{ t:'data', id:'...' }` で実データから作り、手で書き写さない
  （**曲の一覧や曲数もここへ手で書かない**。§5.1）
- 更新履歴（`data/changelog.js`）へ1件。日時は書いているその時刻（JST）
- 助手（みゅあ）の告知を付ける。種別は
  **合算ランキング＝`content`**、**イベント開始＝`content`**
- 開催中は曲えらびにも助手の吹き出しで「今週の対象曲」を出す。
  一度きりの案内には新しい `mh_rhythm_event_notice_v1` を作る（既存キーは触らない）

---

## 11. 既存を壊さないための決めごと

`CLAUDE.md` ⑦を、この機能に当てはめたもの。

- **既存の `rankings` の行・RLS・権限を変えない。** 足すのは `breeder_id` 列（NULL許容）・
  ビュー・関数・索引・除外テーブルだけ。**既存行の書き換えや移行は一切しない**
- **既存の曲別ランキングの送受信（`sbInsertRhythmScore` / `sbFetchRhythmRankings`）を変えない。**
  合算・週間は取得の口を別に足す
- **`normalizeRankingDifficulty` を緩めない**（他モードの検証まで一緒に緩むため）
- **保存キーは新しく足す。** `mh_rhythm_best_v1` は触らない。
  新設するのは `mh_breeder_id_v1` / `mh_rhythm_event_reward_v1` / `mh_rhythm_event_notice_v1`
- **`breeder_id` 列が無い環境でも送信が通る**ようにする（§4.3）
- **songId にハイフンを使わない**（§5.8）
- 週間・イベントの結果を端末へ書き戻さない。ランキングの正本は常に Supabase 側に置く

### 追加する検査（実装時）

| 検査 | 見るもの |
| --- | --- |
| `tools/mode/rhythm-total-ranking-check.js` | 合算の集計（曲ごとベスト→合計）・同点処理・表示件数・達成率 |
| `tools/mode/rhythm-identity-check.js` | `identity_key` の決め方（§4.4 の3ケース）と、IDが無い行の引き継ぎ |
| `tools/mode/rhythm-event-window-check.js` | 月曜5:00 JST の週境界、期間限定の開始・終了 |
| `tools/mode/rhythm-song-count-check.js` | 曲数を数字で書き写した場所が無いこと（分母・理論満点・ヘルプ・SQL）（§5.1） |
| `tools/mode/rhythm-song-id-hyphen-check.js` | songId にハイフンが入っていないこと |
| 既存 `tools/mode/rhythm-ranking-check.js` | 既存の曲別ランキングが変わっていないこと |

---

## 12. 実装フェーズ

小さく切って、それぞれで公開まで通す。

### フェーズ1 — `breeder_id` を送り始める

1. `docs/sql/rankings/` へ `breeder_id` 列を足す適用SQL・確認SQL・iPhone手順を用意する（§4.3）
2. ユーザーが Supabase の画面から適用する
3. `mh_breeder_id_v1` を作り、モンビーの送信（`sbInsertRhythmScore`）へ `breeder_id` を足す。
   列が無い環境でも通るフォールバック付き
4. 画面の見た目は変わらない。**早く始めるほど、IDの付いた記録が貯まる**

> このフェーズを先にやるのは、合算の正しさがIDの有無で決まるため。
> 公開が1日でも早ければ、その日ぶんの記録にIDが付く。

### フェーズ2 — ブリーダー別 全曲合算ランキング（常設）

1. 集計ビュー・除外テーブル・索引・権限の適用SQLを用意し、ユーザーが適用する（§8.2・§8.3・§8.5〜§8.8）
2. 取得関数（`sbFetchRhythmTotalRankings`）を `26-supabase.jsx` へ足す。既存の口は触らない
3. ランキング画面へ「この曲 / 総合」タブを足す。自分の順位・達成率・未プレイ曲も出す
4. ヘルプ・更新履歴・助手の告知（§10.2）
5. 検査（§11）と `node tools/build.js`

### フェーズ3 — 週間ランキング（報酬なし）

1. 週境界ビューと期間×対象曲の関数を適用する（§8.4）
2. `data/rhythm-event.js` を作り、対象3曲を書く
3. イベントタブ（曲ごと＋総合）と残り時間表示
4. 曲えらびでの「今週の対象曲」案内
5. ヘルプ・更新履歴・助手の告知

### フェーズ4 — 報酬と期間限定イベント

1. 順位の問い合わせと受取（§9.1）、受取フラグ `mh_rhythm_event_reward_v1`
2. 超越の実の種族対応表をユーザーと確定させてから実装する
3. 期間限定イベント（`kind:'limited'`）
4. 週間ミッション（`RHYTHM_MODE.md` §21）は、必要になった時点で改めて決める

フェーズ2は**いまのデータのまま動く**（過去のプレイもそのまま合算に載る。§4.4）。
フェーズ3以降は、開始した週からの記録で走り出す。

---

## 13. まだ決めていないこと

実装のときに必ず確認する。勝手に決めてコードやスキーマへ固定しない。

- 週間総合に載る最低条件（いまは「1曲でも遊べば載る」＝§6.3）
- 未受取報酬をいつまで受け取れるか（何週ぶんか貯めておけるが、上限は未定）
- 参加報酬の成立条件と付与単位（§9.2）
- 3曲側の超越の実の種族対応表（§9）
- プシュケーの個数（暫定値のまま）
- 週間ミッション（`RHYTHM_MODE.md` §21 のまま未確定）
- **公開曲が30曲に近づいたときに「ベストN曲合計」を足すかどうか**、足すなら N の値（§5.6）
- `breeder_id` を他モード（通常バトル・プロ・極限・種族チャレンジ、ブリーダーLvランキング）へ
  広げるかどうか（§4.7）
- `rhythm_total_rankings` をマテリアライズドビューへ差し替える時期と更新間隔（§5.2）

---

## 14. 参照

- [`RHYTHM_MODE.md`](RHYTHM_MODE.md) §9.5（現行の曲別ランキングの実装）・§18〜22（この文書の元になった検討）
- [`RHYTHM_FUTURE_IMPLEMENTATION_PLAN.md`](RHYTHM_FUTURE_IMPLEMENTATION_PLAN.md) §5（マスモン能力込みのプレイを正式に許可する方針）
- [`../sql/rankings/RANKINGS_IPHONE_STEPS.md`](../sql/rankings/RANKINGS_IPHONE_STEPS.md)（iPhone から SQL を適用する手順）
- [`SAVE_DATA.md`](SAVE_DATA.md)（保存キーの一覧）
