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
> 実装は §10 のフェーズ順に進める。

---

## 1. 2026-09-11 にユーザーが決めたこと

先に結論だけ。詳細はそれぞれの節にある。

| 論点 | 決定 |
| --- | --- |
| 合算の単位 | **曲ごとのベスト1件（難易度を問わない最高スコア）を全曲合計**（§3） |
| 集計をどこでやるか | **Supabase に読み取り専用の集計ビュー／関数を追加**する（§6） |
| 週の区切り | **毎週月曜 5:00 JST**。期間限定イベントは開始・終了を自由に決める（§4・§5） |
| イベントの部門構成 | **対象3曲＋週間総合の4部門**（`RHYTHM_MODE.md` §19 のまま）（§5） |

---

## 2. いまあるもの（実装済み・2026-09-04〜）

新しい仕組みは、すべてこの上に足す。既存の動きは変えない。

- **曲別ランキング**（難易度合算）。曲えらびの「🏆この曲の全国ランキング」から開く
- 保存先は既存の Supabase `rankings` テーブル。`difficulty` 列へ
  `Rhythm-<songId>-<難易度id>` という専用キーを入れて他モードと区別する。
  **新しいテーブルも新しい列も作っていない**
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

17曲すべてで MASTER 満点＝ **17,000,000点**。曲が増えれば上限も上がる。

「曲×難易度ごとのベストを全部足す（5難易度ぶん埋める）」方式は採らない。
EASY まで含めて全部埋めた人が強くなる＝作業量が順位になってしまうため。

### 3.3 曲が増えたとき

新しい曲が出た直後は、**誰もその曲ぶんを持っていない**ので順位は動かない。
遊んだ人から順に加算されて順位が入れ替わる。これは仕様として正しい動きとする。
曲を足すたびにランキングを作り直したり、リセットしたりはしない。

### 3.4 同点のとき

合計点が同じときは、**その合計に先に到達したほうを上**にする
（合算に採用された記録のうち、いちばん新しいものの記録時刻が早い順）。

現行の曲別ランキングは同点処理を持たない（取得順に並ぶ）が、合算は同点が起きやすいので
ここだけ決めておく。既存の曲別ランキングの並びには手を触れない。

### 3.5 一覧に出す項目

| 項目 | 内容 |
| --- | --- |
| 順位 | 1位から |
| ブリーダー名・アイコン | 既存の曲別ランキングと同じ |
| 合算スコア | 例: 12,480,300 |
| 載っている曲数 | 例: 「14 / 17曲」。全曲そろっていない人がひと目で分かる |
| ブリーダーLv | 最後にプレイしたときの値 |

「載っている曲数」を出すのは、**まだ遊んでいない曲がある人に伸びしろを見せる**ため。
1曲も遊んでいない人は載らない。

表示件数は上位50件（現行の `RHYTHM_RANKING_DISPLAY_LIMIT` と同じ）。

### 3.6 対象にする記録

- 対象は `rankings` テーブルの `Rhythm-` で始まる行すべて
- テスト曲・デバッグプレイは**送信の入口で弾いている**ので、そもそも記録として入らない。
  そのため集計側で曲の一覧を二重に持たない（曲を足すたびに SQL を直す運用にしない）
- ただし万一まぎれ込んだときに備え、**除外用の小さなテーブルを1つ用意**する（§6.4）。
  平常時は空のまま

---

## 4. 週間ランキング

### 4.1 期間の区切り

**毎週月曜 5:00 JST**（＝日曜 20:00 UTC）。

- ウィークリーミッションの区切りは月曜 **4:00** JST（`missionWeeklyPeriod`）で、**1時間ずれる**。
  これは意図したずれで、「4:00 に週の記録が締まり、順位と報酬が固まってから 5:00 に
  次の週へ切り替わる」という並びにするため。実装のときにこの1時間を集計の締めに使う
- 期間の権威は**サーバー（Supabase）側**に置く。端末の時計を進めても週は変わらない。
  クライアントは DB から「今週の開始・終了」を受け取って表示する（§6.3）
- 画面には残り時間を出す。残り時間の見た目だけは端末時計で数える（1秒ごとの再描画を
  サーバーへ聞きに行かないため）

### 4.2 何を競うか

週間は**その週のあいだに出した記録だけ**で競う。常設の合算ランキング（§3）とは
完全に別枠で、互いに影響しない。先週の記録は今週のランキングに載らないが、
**常設ランキングと自己ベスト（`mh_rhythm_best_v1`）には残り続ける**。

### 4.3 部門

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

### 4.4 対象曲の選び方

その週の対象3曲は、**正式譜面が完成している曲**から選ぶ。
曲として並んでいるだけでは対象にしない（`RHYTHM_MODE.md` §19 の条件をそのまま引き継ぐ）。

対象曲の一覧は**クライアント側の静的データ**（`data/rhythm-event.js` 予定）に置き、
デプロイで切り替える。Supabase 側は「曲ごと・期間ごとの集計」までを汎用に返し、
どの3曲を対象にするかは知らない（§6.3）。こうしておくと、
**イベントを差し替えるのに SQL を触らなくて済む**。

---

## 5. イベント曲ランキング

「週間ランキング」と「イベントランキング」は**同じ1つの仕組み**として作る。
違うのは期間の決め方だけ。

| | 週間 | 期間限定イベント |
| --- | --- | --- |
| 期間 | 毎週月曜 5:00 JST 区切りで自動更新 | イベント定義に開始・終了日時を直接書く |
| 対象曲 | その週の3曲 | イベントごとに決める（3曲を基本とする） |
| 部門 | 対象3曲＋総合の4部門 | 同じ |
| 報酬 | §7 | 同じ表を使う。イベント固有の報酬を足せる |

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
- 開催の告知は助手（みゅあ）の吹き出しで出す。`CLAUDE.md` ⑤の
  「大きい追加は画面のなかでの使い方案内もセット」に該当する

---

## 6. Supabase の設計

### 6.1 守ること

- **既存の `rankings` テーブルの行・列・RLS・権限は一切変えない**。足すのは
  読み取り専用のビュー／関数と索引だけ
- ビューは `security_invoker = on` で作り、`rankings` の RLS をすり抜けないようにする
- 適用は `docs/sql/rankings/` の既存手順と同じ形（`*_APPLY.sql` / `*_VERIFY.sql` /
  `*_IPHONE_STEPS.md`）で用意する。iPhone の Supabase 画面から貼れること

### 6.2 常設の合算ランキング

`Rhythm-<songId>-<難易度id>` を曲と難易度へ割る土台のビューを1枚置き、その上に積む。

```sql
-- ① Rhythm行を曲・難易度へ割る
create or replace view public.rhythm_scores
with (security_invoker = on) as
select r.id, r.created_at, r.user_name, r.level, r.icon, r.score,
       split_part(r.difficulty, '-', 2) as song_id,
       split_part(r.difficulty, '-', 3) as difficulty_id
  from public.rankings r
 where r.difficulty like 'Rhythm-%'
   and array_length(string_to_array(r.difficulty, '-'), 1) = 3
   and r.score is not null;

-- ② 曲ごとのベスト1件（難易度は問わない）
create or replace view public.rhythm_song_bests
with (security_invoker = on) as
select distinct on (s.user_name, s.song_id)
       s.user_name, s.song_id, s.difficulty_id, s.score, s.created_at, s.level, s.icon
  from public.rhythm_scores s
 where not exists (select 1 from public.rhythm_ranking_song_exclusions x
                    where x.song_id = s.song_id)
 order by s.user_name, s.song_id, s.score desc, s.created_at asc, s.id asc;

-- ③ ブリーダー別 全曲合算
create or replace view public.rhythm_total_rankings
with (security_invoker = on) as
select b.user_name,
       sum(b.score)::bigint                                  as total_score,
       count(*)::int                                         as song_count,
       max(b.created_at)                                     as last_scored_at,
       (array_agg(b.level order by b.created_at desc))[1]    as level,
       (array_agg(b.icon  order by b.created_at desc))[1]    as icon
  from public.rhythm_song_bests b
 group by b.user_name;
```

- `split_part` で割れるのは **songId にハイフンが入っていない**ことが前提。
  これは現行の `rhythmRankingDifficultyKey` のコメントにも書いてある約束なので、
  **今後も songId にハイフンを使わない**。検査で見張る（§9）
- 並び順はビューに書かず、取得のたびに指定する（PostgREST は `order` で上書きするため）

```
GET /rest/v1/rhythm_total_rankings
    ?select=user_name,total_score,song_count,level,icon
    &order=total_score.desc,last_scored_at.asc
    &limit=50
```

同点処理（§3.4）は、この `order` の2番目でそのまま実現できる。

### 6.3 週間・イベント

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
returns table(user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select distinct on (s.user_name, s.song_id)
         s.user_name, s.song_id, s.difficulty_id, s.score, s.created_at, s.level, s.icon
    from public.rhythm_scores s
   where s.song_id = any(song_ids)
     and s.created_at >= from_at and s.created_at < to_at
   order by s.user_name, s.song_id, s.score desc, s.created_at asc, s.id asc;
$$;

-- 期間×対象曲の「総合」
create or replace function public.rhythm_event_totals(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(user_name text, total_score bigint, song_count int,
              last_scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select b.user_name, sum(b.score)::bigint, count(*)::int, max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1],
         (array_agg(b.icon  order by b.scored_at desc))[1]
    from public.rhythm_event_song_bests(song_ids, from_at, to_at) b
   group by b.user_name;
$$;
```

`date_trunc('week', ...)` は月曜始まりなので、5時間ずらすだけで「月曜5:00 JST」になる。
期間限定イベント（§5）は、`from_at` / `to_at` にイベント定義の日時をそのまま渡す。

### 6.4 除外テーブル（平常時は空）

```sql
create table if not exists public.rhythm_ranking_song_exclusions (
  song_id text primary key,
  reason  text,
  created_at timestamptz not null default now()
);
```

テスト曲の記録がまぎれ込んだときに1行足すためだけのもの。
**行を消す運用はしない**（`CLAUDE.md` ⑦「消さない・上書きしない・別のキーに足す」）。
`rankings` の行はそのまま残し、集計から外れるだけになる。

### 6.5 索引

Rhythm行だけを対象にした部分索引を足す。既存の索引は触らない。

```sql
create index if not exists rankings_rhythm_user_song_score_idx
  on public.rankings (user_name, difficulty, score desc)
  where difficulty like 'Rhythm-%';

create index if not exists rankings_rhythm_created_at_idx
  on public.rankings (created_at desc)
  where difficulty like 'Rhythm-%';
```

1つめが合算（ユーザー×曲のベスト取り）、2つめが週間の期間絞り込み用。

> 索引を足すのは、2026-07 に「記録が増えて実機で8秒待っても返らず、
> 一度出たランキングが消える」障害を出しているため
> （`supabase/migrations/202607300001_rankings_indexes.sql`）。同じことを繰り返さない。

### 6.6 なぜ端末側で集計しないか

ブリーダーLvランキングは端末側で最大24,000行を取って集計している（`sbFetchAllBreederRows`）。
同じやり方を合算へ持ち込むと、**17曲×5難易度の全プレイ行**を端末が取ることになる。
1プレイ＝1行で増え続ける構造なので、記録が貯まるほど確実に上の障害へ近づく。
集計済みの数十行だけを受け取る形にすれば、曲が増えても通信量は変わらない。

### 6.7 権限

```sql
grant select on public.rhythm_scores, public.rhythm_song_bests,
                public.rhythm_total_rankings, public.rhythm_week_window to anon, authenticated;
grant execute on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz),
                          public.rhythm_event_totals(text[], timestamptz, timestamptz) to anon, authenticated;
grant select on public.rhythm_ranking_song_exclusions to anon, authenticated;
```

書き込み権限は一切与えない。除外テーブルへの追加は Supabase の画面から手で行う。

---

## 7. 報酬

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

### 7.1 受け取り方（案・未確定）

このゲームはサーバー処理を持たない（Supabase は記録の保存と閲覧だけ）。そのため、

1. 週／イベントが終わったあと、最初に起動したときに、締め切り後の順位をサーバーへ問い合わせる
2. 自分の順位に応じた報酬をその場で受け取る
3. 受け取り済みは**新しい保存キー** `mh_rhythm_event_reward_v1` へイベントIDの配列で残し、
   二重受取を防ぐ（`CLAUDE.md` ⑦「一度きりの付与には専用のフラグ」）

という形にする。未受取のまま次の週へ入っても、フラグに無いイベントIDは受け取れる
（何週ぶんか貯めておける）。ただし**受け取れる期間の上限**は決めていない（§11）。

### 7.2 参加報酬（未確定）

`RHYTHM_MODE.md` §20 の候補（ダイヤ×3,000 / プシュケー×50）はそのまま未確定。
成立条件（1曲でも遊べば成立か、3曲すべてか）と付与単位（週で1回か部門ごとか）も未確定。

---

## 8. 画面と導線

### 8.1 ランキング画面にタブを置く

いまの `RHYTHM_RANKING` 画面（`RhythmRankingScreen`）へタブを足す。
**新しい `gameState` は増やさない**（画面を増やすと `HELP_SCREEN_COVERAGE` から
ヘルプ・戻り先・BGM継続の対象漏れが出るため）。

| タブ | 中身 | 出す条件 |
| --- | --- | --- |
| この曲 | 現行の曲別ランキング（難易度合算） | 常時 |
| 総合 | ブリーダー別 全曲合算（§3） | 常時 |
| イベント | 対象3曲＋総合の4部門（§5） | 開催中だけ |

- 開いたときの既定は「この曲」。曲えらびの「🏆この曲の全国ランキング」から入る
  導線をそのまま保つため
- 「総合」には自分の順位・合算スコア・載っている曲数を上に固定で出す。
  50位以内に入っていない人でも自分の位置が分かるようにする
- イベントの部門はタブの中でさらに切り替える（曲A / 曲B / 曲C / 総合）

### 8.2 ヘルプ・更新履歴・告知

`CLAUDE.md` ⑤のとおり、実装のたびに次をセットで行う。

- ヘルプ（`data/help.js`）にランキングの項目を作る／書き直す。
  部門・集計方法・週の区切りを載せる。報酬表のような一覧になるものは
  `{ t:'data', id:'...' }` で実データから作り、手で書き写さない
- 更新履歴（`data/changelog.js`）へ1件。日時は書いているその時刻（JST）
- 助手（みゅあ）の告知を付ける。種別は
  **合算ランキング＝`content`**、**イベント開始＝`content`**
- 開催中は曲えらびにも助手の吹き出しで「今週の対象曲」を出す。
  一度きりの案内には新しい `mh_rhythm_event_notice_v1` を作る（既存キーは触らない）

---

## 9. 既存を壊さないための決めごと

`CLAUDE.md` ⑦を、この機能に当てはめたもの。

- **既存の `rankings` の行・列・RLS・権限を変えない。** 足すのはビュー・関数・索引・
  除外テーブルだけ
- **既存の曲別ランキングの送受信（`sbInsertRhythmScore` / `sbFetchRhythmRankings`）を変えない。**
  合算・週間は取得の口を別に足す
- **`normalizeRankingDifficulty` を緩めない**（他モードの検証まで一緒に緩むため）
- **保存キーは新しく足す。** `mh_rhythm_best_v1` は触らない。
  報酬フラグは `mh_rhythm_event_reward_v1`、案内は `mh_rhythm_event_notice_v1`
- **songId にハイフンを使わない**（§6.2）。検査で見張る
- 週間・イベントの結果を端末へ書き戻さない。ランキングの正本は常に Supabase 側に置く

### 追加する検査（実装時）

| 検査 | 見るもの |
| --- | --- |
| `tools/mode/rhythm-total-ranking-check.js` | 合算の集計（曲ごとベスト→合計）・同点処理・表示件数 |
| `tools/mode/rhythm-event-window-check.js` | 月曜5:00 JST の週境界、期間限定の開始・終了 |
| `tools/mode/rhythm-song-id-hyphen-check.js` | songId にハイフンが入っていないこと |
| 既存 `tools/mode/rhythm-ranking-check.js` | 既存の曲別ランキングが変わっていないこと |

---

## 10. 実装フェーズ

小さく切って、それぞれで公開まで通す。

### フェーズ1 — ブリーダー別 全曲合算ランキング（常設）

1. `docs/sql/rankings/` へ適用SQL・確認SQL・iPhone手順を用意する（§6.2・§6.4・§6.5・§6.7）
2. ユーザーが Supabase の画面から適用する
3. 取得関数（`sbFetchRhythmTotalRankings`）を `26-supabase.jsx` へ足す。既存の口は触らない
4. ランキング画面へ「この曲 / 総合」タブを足す
5. ヘルプ・更新履歴・助手の告知（§8.2）
6. 検査（§9）と `node tools/build.js`

### フェーズ2 — 週間ランキング（報酬なし）

1. 週境界ビューと期間×対象曲の関数を適用する（§6.3）
2. `data/rhythm-event.js` を作り、対象3曲を書く
3. イベントタブ（曲A / 曲B / 曲C / 総合）と残り時間表示
4. 曲えらびでの「今週の対象曲」案内
5. ヘルプ・更新履歴・助手の告知

### フェーズ3 — 報酬と期間限定イベント

1. 順位の問い合わせと受取（§7.1）、受取フラグ `mh_rhythm_event_reward_v1`
2. 超越の実の種族対応表をユーザーと確定させてから実装する
3. 期間限定イベント（`kind:'limited'`）
4. 週間ミッション（`RHYTHM_MODE.md` §21）は、必要になった時点で改めて決める

フェーズ1は**いまのデータのまま動く**（過去のプレイもそのまま合算に載る）。
フェーズ2以降は、開始した週からの記録で走り出す。

---

## 11. まだ決めていないこと

実装のときに必ず確認する。勝手に決めてコードやスキーマへ固定しない。

- **ブリーダーの同一性**。いまは `user_name` だけで人を見分けている。合算は「その人の
  全曲を足す」ので、同じ名前の人がいると**合計が混ざる**（曲別の最高1件より影響が大きい）。
  端末で作る `breeder_id` を `rankings` へ新しい列として足し、
  `coalesce(breeder_id, user_name)` で束ねる案があるが、**列を足す判断はユーザーに確認してから**。
  報酬（フェーズ3）へ進む前に決める必要がある
- 週間総合に載る最低条件（いまは「1曲でも遊べば載る」＝§4.3）
- 未受取報酬をいつまで受け取れるか（何週ぶん貯めておけるか）
- 参加報酬の成立条件と付与単位（§7.2）
- 3曲側の超越の実の種族対応表（§7）
- プシュケーの個数（暫定値のまま）
- 週間ミッション（`RHYTHM_MODE.md` §21 のまま未確定）
- 上位N曲だけを足す方式（新しく始めた人が追いつきやすい）へ将来切り替えるかどうか。
  今回は「全曲合計」で確定したが、曲が30曲・50曲と増えたときに再検討する余地は残す

---

## 12. 参照

- [`RHYTHM_MODE.md`](RHYTHM_MODE.md) §9.5（現行の曲別ランキングの実装）・§18〜22（この文書の元になった検討）
- [`RHYTHM_FUTURE_IMPLEMENTATION_PLAN.md`](RHYTHM_FUTURE_IMPLEMENTATION_PLAN.md) §5（マスモン能力込みのプレイを正式に許可する方針）
- [`../sql/rankings/RANKINGS_IPHONE_STEPS.md`](../sql/rankings/RANKINGS_IPHONE_STEPS.md)（iPhone から SQL を適用する手順）
- [`SAVE_DATA.md`](SAVE_DATA.md)（保存キーの一覧）
