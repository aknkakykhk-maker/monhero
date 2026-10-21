-- 判定の異変の報告: 曲の途中から放置したプレイ(入力5回以下・未クリア)を集計から外し、外した数を abandoned_excluded_day で返す(2026-10-21 社長の決定)。
-- 10/20 に1台が toriko MASTER を1回、最初の1回だけ押して放置し(MISS 158/159・未クリア・縦向き)、
-- その日の toriko MASTER android の MISS 率が 3.90%(除くと 0.49%)・android 全体が 4.11%(除くと 2.39%)になって旗の元になった。
-- 外すのは見張りの集計だけ。表・既存の行・ランキング・記録・cron は変えない。前の決まり(連打の多いプレイを外す・前の7日に遊んだ端末が2台以上)はそのまま。
--   rhythm_touch_diagnostics: stats.inputs が5以下 かつ stats.cleared が false の1回を外す
--   rhythm_play_logs(曲の区間ごとの MISS): 入力の数が無いので、未クリア かつ MISS でないノーツ('zz' 以外)が5個以下の1回を外す
-- 流したあと、最後の select で 10/20 分を作り直し、abandoned_excluded_day が 1・flagged が 0 であることを確かめる。
create or replace function public.rhythm_anomaly_facts(p_day date)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
with win as (
  select ((p_day - 7)::timestamp at time zone 'Asia/Tokyo') as t0,
         ((p_day + 1)::timestamp at time zone 'Asia/Tokyo') as t1
),
d0 as (
  select t.song_id, t.difficulty, coalesce(t.platform,'?') as platform,
         (t.created_at at time zone 'Asia/Tokyo')::date = p_day as is_day,
         t.note_count as notes,
         coalesce((t.stats->>'misses')::int,0) as misses,
         coalesce((t.stats->>'noInputMisses')::int,0) as no_input,
         coalesce((t.stats->>'lateDelivery')::int,0) as late,
         coalesce((t.stats->'frame'->>'over34')::int,0) as slow_frames,
         coalesce((t.stats->'frame'->>'n')::int,0) as frames,
         coalesce((t.stats->>'touchStarts')::int,0) as touches,
         -- 曲の途中から放置したプレイ(2026-10-21): 入力5回以下・未クリア
         (coalesce((t.stats->>'inputs')::int,0) <= 5 and coalesce((t.stats->>'cleared')::boolean,true) = false) as abandoned,
         t.app_build, t.device_key
  from public.rhythm_touch_diagnostics t, win
  where t.created_at >= win.t0 and t.created_at < win.t1 and coalesce(t.note_count,0) > 0
),
-- 連打の多いプレイ(1ノーツあたりのタッチが5回を超える)は集計から外す(2026-10-19 社長の決定)。
-- 10/18 に1台が toriko EASY を1ノーツ12.6回のタッチで36回遊び、遅れたタッチの率(タッチごとに数えてノーツ数で割る)が 1 を超えて iOS 全体が跳ねた
-- 曲の途中から放置したプレイ(入力5回以下・未クリア)も外す(2026-10-21 社長の決定)。10/20 に toriko MASTER の1回(MISS 158/159)が android の MISS 率を押し上げた
d as (select * from d0 where touches <= notes * 5 and not abandoned),
g as (
  select song_id, difficulty, platform,
    count(*) filter (where is_day) as plays_day,
    coalesce(sum(notes) filter (where is_day),0) as notes_day,
    coalesce(sum(misses) filter (where is_day),0) as miss_day,
    coalesce(sum(no_input) filter (where is_day),0) as noinput_day,
    count(*) filter (where not is_day) as plays_base,
    count(distinct device_key) filter (where not is_day) as devices_base,
    coalesce(sum(notes) filter (where not is_day),0) as notes_base,
    coalesce(sum(misses) filter (where not is_day),0) as miss_base,
    coalesce(sum(no_input) filter (where not is_day),0) as noinput_base
  from d group by 1,2,3
),
f as (
  select g.*,
    round(miss_day::numeric/nullif(notes_day,0),4) as rate_day,
    round(miss_base::numeric/nullif(notes_base,0),4) as rate_base
  from g
  where plays_day >= 2 and notes_day >= 300 and plays_base >= 2 and notes_base > 0
    and devices_base >= 2
    and miss_day::numeric/notes_day >= 1.5 * (miss_base::numeric/notes_base)
    and miss_day::numeric/notes_day - miss_base::numeric/notes_base >= 0.02
  order by (miss_day::numeric/notes_day - miss_base::numeric/notes_base) desc
  limit 10
),
p as (
  select l.song_id, l.difficulty, l.note_count, l.deltas,
         (l.created_at at time zone 'Asia/Tokyo')::date = p_day as is_day
  from public.rhythm_play_logs l, win
  where l.created_at >= win.t0 and l.created_at < win.t1 and coalesce(l.note_count,0) > 0
    -- 放置したプレイ(未クリア・MISS でないノーツが5個以下)は区間ごとの MISS からも外す(2026-10-21)
    and not (l.cleared = false and (select count(*) from generate_series(0, length(l.deltas)/2 - 1) as j
                                    where substring(l.deltas from j*2+1 for 2) <> 'zz') <= 5)
    and exists (select 1 from f where f.song_id = l.song_id and f.difficulty = l.difficulty)
),
bins as (
  select song_id, difficulty, is_day, least(19, i*20/greatest(note_count,1))::int as bin, count(*)::int as misses
  from p cross join lateral generate_series(0, length(deltas)/2 - 1) as i
  where substring(deltas from i*2+1 for 2) = 'zz'
  group by 1,2,3,4
),
plays as (select song_id, difficulty, is_day, count(*)::int as n from p group by 1,2,3),
bin_arr as (
  select s.song_id, s.difficulty, s.is_day, s.n as plays,
    (select jsonb_agg(coalesce(b.misses,0) order by k) from generate_series(0,19) k
       left join bins b on b.song_id=s.song_id and b.difficulty=s.difficulty and b.is_day=s.is_day and b.bin=k) as by_bin
  from plays s
),
plat as (
  select platform,
    count(*) filter (where is_day) as plays_day,
    round(sum(misses) filter (where is_day)::numeric / nullif(sum(notes) filter (where is_day),0),4) as miss_rate_day,
    round(sum(misses) filter (where not is_day)::numeric / nullif(sum(notes) filter (where not is_day),0),4) as miss_rate_base,
    round(sum(no_input) filter (where is_day)::numeric / nullif(sum(notes) filter (where is_day),0),4) as no_input_rate_day,
    round(sum(no_input) filter (where not is_day)::numeric / nullif(sum(notes) filter (where not is_day),0),4) as no_input_rate_base,
    round(sum(late) filter (where is_day)::numeric / nullif(sum(notes) filter (where is_day),0),4) as late_rate_day,
    round(sum(late) filter (where not is_day)::numeric / nullif(sum(notes) filter (where not is_day),0),4) as late_rate_base,
    round(sum(slow_frames) filter (where is_day)::numeric*1000 / nullif(sum(frames) filter (where is_day),0),2) as slow_per_1000_day,
    round(sum(slow_frames) filter (where not is_day)::numeric*1000 / nullif(sum(frames) filter (where not is_day),0),2) as slow_per_1000_base
  from d group by platform
)
select jsonb_build_object(
  'day', p_day,
  'plays_day', (select count(*) from d where is_day),
  'mashed_excluded_day', (select count(*) from d0 where is_day and touches > notes * 5),
  'abandoned_excluded_day', (select count(*) from d0 where is_day and abandoned and touches <= notes * 5),
  'plays_base_per_day', (select round(count(*)::numeric/7,1) from d where not is_day),
  'builds_day', (select coalesce(jsonb_agg(distinct app_build),'[]'::jsonb) from d where is_day),
  'platforms', (select coalesce(jsonb_agg(to_jsonb(plat)),'[]'::jsonb) from plat),
  'flagged', (select coalesce(jsonb_agg(jsonb_build_object(
      'song', f.song_id, 'difficulty', f.difficulty, 'platform', f.platform,
      'plays_day', f.plays_day, 'plays_base', f.plays_base, 'devices_base', f.devices_base,
      'miss_rate_day', f.rate_day, 'miss_rate_base', f.rate_base,
      'no_input_miss_day', f.noinput_day, 'no_input_miss_base', f.noinput_base,
      'miss_by_5pct_day', (select a.by_bin from bin_arr a where a.song_id=f.song_id and a.difficulty=f.difficulty and a.is_day),
      'miss_by_5pct_base', (select a.by_bin from bin_arr a where a.song_id=f.song_id and a.difficulty=f.difficulty and not a.is_day),
      'logs_day', (select a.plays from bin_arr a where a.song_id=f.song_id and a.difficulty=f.difficulty and a.is_day),
      'logs_base', (select a.plays from bin_arr a where a.song_id=f.song_id and a.difficulty=f.difficulty and not a.is_day)
    )),'[]'::jsonb) from f)
)
$function$;

-- 確かめ(読むだけ): 10/20 分を作り直す
select public.rhythm_anomaly_facts('2026-10-20'::date)->'abandoned_excluded_day' as abandoned_1020,
       public.rhythm_anomaly_facts('2026-10-20'::date)->'mashed_excluded_day' as mashed_1020,
       (select jsonb_agg(jsonb_build_object('platform',p->>'platform','miss',p->>'miss_rate_day','base',p->>'miss_rate_base','plays',p->>'plays_day'))
          from jsonb_array_elements(public.rhythm_anomaly_facts('2026-10-20'::date)->'platforms') p) as platforms_1020,
       jsonb_array_length(public.rhythm_anomaly_facts('2026-10-20'::date)->'flagged') as flagged_1020;
