-- public.rankings のスコアを 1/1000 にするSQL(予行演習(最後に rollback。本番には何も残らない))。2026-10-03・ユーザー指示。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: いいえ(rollback)。
--
-- 
-- 先に SCORE_SHRINK_AUDIT.sql の結果を見て、対象外の難易度に見覚えのないキーが無いことを確かめる。
--
-- ねらい: タクティクス以外のスコアの桁が大きくなりすぎたため、アプリ側で 1/1000 に縮めた。
--         すでにあるランキングの数字も同じ割り方にそろえる(割った商の切り捨て。1点以上は最低1点を残す)。
--
-- ★縮めるのは「cutoff より前に作られた行」だけ。新しいアプリが公開されたあとに作られた行は
--   最初から縮んだ点数で入っているので、もう一度割ってはいけない。
--   cutoff には「新しいアプリの公開が終わった時刻(日本時間)」を書く。
--   書き換えるのは下の1行だけ。書き換えていないと日時の変換で止まる(何も変わらない)。
--
-- ★二度走らせてはいけない(割りすぎは戻せない)。控えの表 rankings_score_shrink_backup_20261003 が
--   すでにあると、作成に失敗して止まる。元に戻すときは SCORE_SHRINK_RESTORE.sql を使う。
--
-- 縮める難易度は SCORE_SHRINK_AUDIT.sql の冒頭に書いたとおり。ほかの行・列・RLS・権限・ビューは変えない。
begin;

-- 短時間だけ書き込みを止め、点検から更新までの間に行が増えないようにする
lock table public.rankings in share row exclusive mode;

create temporary table score_shrink_params on commit drop as
select timestamptz 'ここを「2026-10-03 12:34+09」のような公開が終わった日本時間に書き換える' as cutoff;

do $$
begin
  if (select cutoff from score_shrink_params) > now() then
    raise exception 'cutoff が未来の時刻です。公開が終わった時刻を書いてください。';
  end if;
  if to_regclass('public.rankings') is null then
    raise exception 'public.rankings がありません。';
  end if;
end $$;

-- ---- 適用前のひかえ ----
create temporary table score_shrink_before on commit drop as
select
  count(*) filter (where r.difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and r.created_at < p.cutoff) as shrink_rows,
  count(*) filter (where r.difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and r.created_at < p.cutoff and r.score > 0) as shrink_positive_rows,
  max(r.score) filter (where r.difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and r.created_at < p.cutoff) as shrink_max,
  count(*) filter (where not (r.difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and r.created_at < p.cutoff)
                      or r.difficulty is null) as other_rows,
  coalesce(sum(r.score) filter (where not (r.difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and r.created_at < p.cutoff)
                      or r.difficulty is null), 0)::numeric as other_sum,
  count(*) as total_rows
from public.rankings r cross join score_shrink_params p;

-- ---- 元に戻すための控え(行のIDと縮める前の点数) ----
-- 一度でも実適用したら残る。二度目の実適用はここで止まる。
create table public.rankings_score_shrink_backup_20261003 as
select r.id, r.difficulty, r.score as score_before, r.created_at, p.cutoff, now() as backed_up_at
from public.rankings r cross join score_shrink_params p
where r.difficulty ~ '^((Pro)?(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend)|Extreme(EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK)|Species-.+-(Beginner|Easy|Normal|Hard|Expert|Master|GrandMaster|Hell|Legend|EXTREME|NIGHTMARE|CHAOS|ULTIMATE|INFINITY|GOD|RAGNAROK))$' and r.created_at < p.cutoff and r.score > 0;

-- 控えはAPIから見えないようにする(RLSを有効にしてポリシーを作らない＋権限を外す)
alter table public.rankings_score_shrink_backup_20261003 enable row level security;
revoke all on public.rankings_score_shrink_backup_20261003 from anon, authenticated, public;

-- ---- 本体: 1/1000(切り捨て・最低1) ----
update public.rankings r
set score = greatest(1, r.score / 1000)
from public.rankings_score_shrink_backup_20261003 b
where r.id = b.id;

-- ---- 適用後の確認(1つでも違えば例外で全部巻き戻る) ----
do $$
declare
  b record;
  a record;
  backed int;
begin
  select * into b from score_shrink_before;
  select count(*) into backed from public.rankings_score_shrink_backup_20261003;
  select count(*) as total_rows,
         count(k.id) as shrunk_rows,
         coalesce(sum(r.score) filter (where k.id is null), 0)::numeric as other_sum,
         max(r.score) filter (where k.id is not null) as shrunk_max
    into a
    from public.rankings r
    left join public.rankings_score_shrink_backup_20261003 k on k.id = r.id;

  if a.total_rows <> b.total_rows then
    raise exception '行数が変わりました(% → %)', b.total_rows, a.total_rows;
  end if;
  if backed <> b.shrink_positive_rows or a.shrunk_rows <> b.shrink_positive_rows then
    raise exception '縮めた行数が想定と違います(控え % / 更新後 % / 想定 %)', backed, a.shrunk_rows, b.shrink_positive_rows;
  end if;
  if a.other_sum <> b.other_sum then
    raise exception '対象外の行の合計点が変わりました(% → %)', b.other_sum, a.other_sum;
  end if;
  if b.shrink_positive_rows > 0 and a.shrunk_max > greatest(1, b.shrink_max / 1000) then
    raise exception '縮めたあとの最大点が想定を超えています(% > %)', a.shrunk_max, greatest(1, b.shrink_max / 1000);
  end if;
  if exists (
    select 1 from public.rankings r join public.rankings_score_shrink_backup_20261003 k on k.id = r.id
    where r.score <> greatest(1, k.score_before / 1000)
  ) then
    raise exception '縮めた点数が 1/1000 になっていない行があります';
  end if;
end $$;

-- ---- まとめ(成功すると表が出る) ----
select '縮めた行数' as item, count(*)::text as value from public.rankings_score_shrink_backup_20261003
union all select '縮める前の最大点', max(score_before)::text from public.rankings_score_shrink_backup_20261003
union all select '縮めたあとの最大点', max(r.score)::text from public.rankings r
  join public.rankings_score_shrink_backup_20261003 k on k.id = r.id
union all select '対象外の行数(タクティクス・モンヒロビート・cutoff以降)', other_rows::text from score_shrink_before
union all select 'cutoff', cutoff::text from score_shrink_params;

rollback;
