-- public.rankings のスコアを 1/1000 にする作業(2026-10-03)の、実行前の点検SQL。
-- 読み取り専用: はい(select だけ。何も変わらない)。
--
-- 何を縮めるか(アプリの難易度キーと同じ。タクティクスとモンヒロビートは縮めない):
--   チャレンジ      Beginner / Easy / Normal / Hard / Expert / Master / GrandMaster / Hell / Legend
--   プロ            Pro + 上の9つ
--   極限チャレンジ  Extreme + (EXTREME / NIGHTMARE / CHAOS / ULTIMATE / INFINITY / GOD / RAGNAROK)
--   種族チャレンジ  Species-<血統>-<難易度>
-- 縮めない: Tactics* / TacticsPro* / TacticsSpecies-* (すでに1/1000)、Rhythm-* (モンヒロビート)
--
-- ★結果表②「対象外の難易度」に、見覚えのないキーが出たら、そこで止めて共有すること。

-- ① 縮める対象の難易度ごとの件数と、スコアの幅
select difficulty, count(*) as rows, min(score) as min_score, max(score) as max_score
from public.rankings
where difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$'
group by difficulty order by difficulty;

-- ② 対象外の難易度(タクティクス・モンヒロビートのほかに、見覚えのないものが無いか)
select difficulty, count(*) as rows, min(score) as min_score, max(score) as max_score
from public.rankings
where difficulty is null or difficulty !~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$'
group by difficulty order by difficulty;

-- ③ 全体の控え(適用前後で、対象外の合計が変わらないことを確かめるのに使う)
select count(*) as total_rows,
       count(*) filter (where difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$') as target_rows,
       (sum(score) filter (where difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$'))::numeric as target_sum,
       (sum(score) filter (where difficulty is null or difficulty !~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$'))::numeric as other_sum,
       count(*) filter (where score is null) as null_score,
       count(*) filter (where score <= 0) as nonpositive_score
from public.rankings;

-- ④ 直近の書き込み(公開時刻の前後に、新しいアプリの小さい点数が混ざっていないかを見る)
select date_trunc('hour', created_at) as hour, count(*) as rows, max(score) as max_score
from public.rankings
where difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and created_at >= now() - interval '3 days'
group by 1 order by 1 desc;
