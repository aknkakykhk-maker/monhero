-- SCORE_SHRINK_APPLY.sql を実行したあとの確認SQL。読み取り専用(select だけ)。
--
-- ① 縮めた行数と、縮める前後の最大点
select count(*) as shrunk_rows, max(b.score_before) as max_before, max(r.score) as max_after
from public.rankings_score_shrink_backup_20261003 b join public.rankings r on r.id = b.id;

-- ② 全ての縮めた行が、縮める前の 1/1000(切り捨て・最低1)になっているか。0行ならOK
select r.id, r.difficulty, b.score_before, r.score
from public.rankings_score_shrink_backup_20261003 b join public.rankings r on r.id = b.id
where r.score <> greatest(1, b.score_before / 1000);

-- ③ 難易度ごとの上位3件(桁が小さくなっていること)
select difficulty, score, user_name, created_at
from (select *, row_number() over (partition by difficulty order by score desc) as rn from public.rankings
      where difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK|HELHEIM)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK|HELHEIM))$') t
where rn <= 3 order by difficulty, score desc;

-- ④ cutoff のあとに作られた行を、点数の高い順に30件。新しいアプリの記録なら、縮んだあとの桁(②③と同じくらい)のはず。
--    桁が大きいまま(縮める前の最大点に近い)の行があれば、古いアプリで遊んだ人の記録です。その行を共有してください。
select difficulty, score, user_name, created_at
from public.rankings
where difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK|HELHEIM)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK|HELHEIM))$'
  and created_at >= (select max(cutoff) from public.rankings_score_shrink_backup_20261003)
order by score desc limit 30;

-- ⑤ タクティクス・モンヒロビートが変わっていないこと(適用前の AUDIT ③ の other_sum と見比べる)
select sum(score)::numeric as other_sum
from public.rankings
where difficulty is null or difficulty !~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK|HELHEIM)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK|HELHEIM))$';
