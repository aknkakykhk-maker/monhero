-- モンサクのインフレ点検(r1126-109)。読むだけ(SELECT のみ)。名前・PLAYER ID は出さない(遊んだ人は回数の多い順の番号だけ)
with f as (
  select owner_id, finished_at, engine_version, rank_beta, hidden, species, lv,
         coalesce(power_v3, power) as pw,
         coalesce(grade_v3, grade) as gr,
         (stats->>'life')::numeric as s_life, (stats->>'pow')::numeric as s_pow, (stats->>'wise')::numeric as s_wise,
         (stats->>'hit')::numeric as s_hit, (stats->>'eva')::numeric as s_eva, (stats->>'tough')::numeric as s_tough,
         case when jsonb_typeof(cap_detail) = 'object' then greatest((cap_detail->>'life')::numeric, (cap_detail->>'pow')::numeric, (cap_detail->>'wise')::numeric,
              (cap_detail->>'hit')::numeric, (cap_detail->>'eva')::numeric, (cap_detail->>'tough')::numeric) end as capmax,
         case when jsonb_typeof(techs) = 'array' then jsonb_array_length(techs) else 0 end as ntech
  from public.monsuc_finishes
),
g as (
  select *, greatest(s_life, s_pow, s_wise, s_hit, s_eva, s_tough) as top1,
         s_life + s_pow + s_wise + s_hit + s_eva + s_tough as ssum,
         row_number() over (partition by owner_id order by finished_at) as nth
  from f
),
own as (
  select owner_id, count(*) as n, max(pw) as best, max(top1) as besttop,
         count(distinct (finished_at at time zone 'Asia/Tokyo')::date) as days
  from g group by owner_id
),
ownr as (select *, row_number() over (order by n desc, best desc) as heavy from own),
gx as (select g.*, o.heavy from g join ownr o using (owner_id)),
lend as (
  select l.owner_id, greatest((l.mon->'stats'->>'life')::numeric, (l.mon->'stats'->>'pow')::numeric, (l.mon->'stats'->>'wise')::numeric,
         (l.mon->'stats'->>'hit')::numeric, (l.mon->'stats'->>'eva')::numeric, (l.mon->'stats'->>'tough')::numeric) as top1
  from public.monsuc_lend l where l.active
),
uses as (
  select lender, count(*) as n, count(distinct borrower) as nb from public.monsuc_lend_uses
  where at > now() - interval '14 days' group by lender
)
select jsonb_build_object(
  'totals', (select jsonb_build_object('rows', count(*), 'owners', count(distinct owner_id), 'hidden', count(*) filter (where hidden),
      'first_day', min((finished_at at time zone 'Asia/Tokyo')::date), 'last_day', max((finished_at at time zone 'Asia/Tokyo')::date),
      'by_engine', (select jsonb_object_agg(engine_version, c) from (select engine_version, count(*) c from g group by 1) e),
      'by_beta', (select jsonb_object_agg(rank_beta, c) from (select rank_beta, count(*) c from g group by 1) e)) from g),
  'pct_all', (select jsonb_build_object(
      'power', jsonb_build_array(percentile_disc(0.5) within group (order by pw), percentile_disc(0.9) within group (order by pw), percentile_disc(0.99) within group (order by pw), max(pw)),
      'top_stat', jsonb_build_array(percentile_disc(0.5) within group (order by top1), percentile_disc(0.9) within group (order by top1), percentile_disc(0.99) within group (order by top1), max(top1)),
      'stat_sum', jsonb_build_array(percentile_disc(0.5) within group (order by ssum), percentile_disc(0.9) within group (order by ssum), max(ssum)),
      'cap_max', jsonb_build_array(percentile_disc(0.5) within group (order by capmax), percentile_disc(0.9) within group (order by capmax), max(capmax))) from g where not hidden),
  'over', (select jsonb_build_object(
      'top_gt_999', count(*) filter (where top1 > 999), 'top_gt_2000', count(*) filter (where top1 > 2000), 'top_gt_5000', count(*) filter (where top1 > 5000),
      'top_gt_10000', count(*) filter (where top1 > 10000), 'top_gt_30000', count(*) filter (where top1 > 30000), 'top_gt_80000', count(*) filter (where top1 > 80000),
      'pw_gt_30000', count(*) filter (where pw > 30000), 'pw_gt_60000', count(*) filter (where pw > 60000), 'pw_gt_100000', count(*) filter (where pw > 100000),
      'pw_gt_500000', count(*) filter (where pw > 500000), 'pw_gt_2000000', count(*) filter (where pw > 2000000)) from g),
  'owner_buckets', (select jsonb_agg(x order by x->>'b') from (select jsonb_build_object('b', b, 'owners', count(*),
      'best_power', jsonb_build_array(percentile_disc(0.5) within group (order by best), percentile_disc(0.9) within group (order by best), max(best)),
      'best_top_stat', jsonb_build_array(percentile_disc(0.5) within group (order by besttop), percentile_disc(0.9) within group (order by besttop), max(besttop))) as x
      from (select *, case when n = 1 then '1_1' when n <= 5 then '2_2-5' when n <= 20 then '3_6-20' when n <= 50 then '4_21-50' when n <= 150 then '5_51-150' else '6_151+' end as b from own) o group by b) t),
  'heavy10', (select jsonb_agg(jsonb_build_object('heavy', o.heavy, 'runs', o.n, 'days', o.days, 'best_power', o.best, 'best_top_stat', o.besttop,
      'path', (select jsonb_agg(jsonb_build_array(x.nth, x.pw, x.top1, x.ssum, x.capmax) order by x.nth) from gx x
               where x.heavy = o.heavy and (x.nth in (1, 2, 3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500) or x.nth = o.n))) order by o.heavy)
      from ownr o where o.heavy <= 10),
  'top20', (select jsonb_agg(jsonb_build_object('pw', pw, 'gr', gr, 'heavy', case when heavy <= 10 then heavy end, 'nth', nth, 'species', species, 'lv', lv, 'techs', ntech,
      'stats', jsonb_build_array(s_life, s_pow, s_wise, s_hit, s_eva, s_tough), 'cap', capmax, 'day', (finished_at at time zone 'Asia/Tokyo')::date) order by pw desc)
      from (select * from gx where not hidden order by pw desc limit 20) t),
  'top100_owners', (select jsonb_build_object('distinct', count(distinct owner_id),
      'by_heavy', (select jsonb_object_agg(coalesce(h::text, 'other'), c) from (select case when heavy <= 10 then heavy end as h, count(*) c from (select * from gx where not hidden order by pw desc limit 100) z group by 1) y))
      from (select * from gx where not hidden order by pw desc limit 100) t),
  'daily21', (select jsonb_agg(jsonb_build_array(d, c, p50, p90, mx, tmx) order by d) from (
      select (finished_at at time zone 'Asia/Tokyo')::date d, count(*) c, percentile_disc(0.5) within group (order by pw) p50,
             percentile_disc(0.9) within group (order by pw) p90, max(pw) mx, max(top1) tmx
      from g where finished_at > now() - interval '21 days' group by 1) t),
  'lend', (select jsonb_build_object('active', count(*),
      'top_stat', jsonb_build_array(percentile_disc(0.5) within group (order by top1), percentile_disc(0.9) within group (order by top1), max(top1)),
      'uses14_by_band', (select jsonb_agg(jsonb_build_object('band', band, 'lenders', nl, 'uses', nu, 'borrowers', nb) order by band) from (
          select band, count(*) nl, sum(coalesce(u.n, 0)) nu, sum(coalesce(u.nb, 0)) nb from (
            select l2.owner_id, case when l2.top1 <= 999 then '1_<=999' when l2.top1 < 3000 then '2_1000-2999' when l2.top1 < 10000 then '3_3000-9999' else '4_10000+' end as band from lend l2) b
          left join uses u on u.lender = b.owner_id group by band) bb)) from lend)
) as monsuc_inflation;
