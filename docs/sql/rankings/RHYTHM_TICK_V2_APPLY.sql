-- モンヒロビートの「刻みもノーツとして数える」新しい物差しのランキングを足すSQL(2026-10-17・ビート部)。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい(新しいビュー4つ・新しい関数8つ)。安全確認に成功した場合だけ最後に commit する。
-- 何度流しても同じ結果になる(create or replace だけ)。
--
-- ★既存の表・列・ビュー・関数・RLS・ポリシー・権限・データには一切触らない
--   (rankings への alter / drop / delete / update をしない。rhythm_scores など既存のビュー・関数を置き換えない)。
--
-- なぜ(社長の決定・docs/playbot/reports/2026-10-17/combo-tick-v2/PLAN.md):
--   ホールド・スライドの刻みもノーツとして数えると、スコアの物差しが変わる。古い記録と混ぜないため、ランキングを版で分ける。
--   新しい物差しの記録は、同じ rankings 表の difficulty 列へ Rhythm-<曲>-<難易度>-2(4つ区切り)で入る(アプリが送る)。
--   今のビュー rhythm_scores は「3つ区切り」だけを数えるので、新しい記録は今の順位に一切混ざらない(古い版のアプリは3つ区切りで送り続け、旧の物差しに入る)。
--   このSQLは、4つ区切りで末尾が '2' の記録だけを数える rhythm2_* を足す。中身は今の rhythm_* と同じ作り(名前と数える記録だけが違う)。
--
-- 足すもの:
--   ビュー  rhythm2_scores / rhythm2_identified_scores / rhythm2_song_bests / rhythm2_total_rankings
--   関数    rhythm2_week_score_totals / rhythm2_event_song_bests / rhythm2_event_song_bests_bonus / rhythm2_event_totals / rhythm2_event_totals_bonus
--           rhythm2_total_precise / rhythm2_week_precise / rhythm2_event_precise
--   人の単位(identity_key)は今の rhythm_identity_map をそのまま使う(同じ人が新旧で別人にならない)。
--   同点の JUST MARVELOUS の数は今の rhythm_party_precise(party の先頭の precise = ノーツだけの数)を使う。
--
-- 戻し方: このSQLで足したビュー・関数を drop するだけ(既存のものは触っていないので、それで元どおり)。
--   drop view if exists public.rhythm2_total_rankings, public.rhythm2_song_bests, public.rhythm2_identified_scores, public.rhythm2_scores;
--   drop function if exists public.rhythm2_week_score_totals(timestamptz,timestamptz), public.rhythm2_event_song_bests(text[],timestamptz,timestamptz), …(下の関数すべて)
--   記録の行(…-2)は消さなくても、旧の物差しの順位には出ない。

begin;

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'PostgreSQL 15以上が必要です(security_invoker)。いまのバージョン: %', current_setting('server_version');
  end if;
end $$;

-- 既存の順位がこのSQLで1つも変わらないことを、前後で比べる
create temporary table rhythm_tick_v2_before on commit drop as
select
  (select count(*) from public.rhythm_scores) as scores,
  (select coalesce(sum(score),0) from public.rhythm_scores) as score_sum,
  (select count(*) from public.rhythm_total_rankings) as totals,
  (select coalesce(sum(total_score),0) from public.rhythm_total_rankings) as total_sum,
  (select count(*) from public.rankings) as ranking_rows;

-- ===== ビュー =====
create or replace view public.rhythm2_scores
with (security_invoker = on) as
select id, created_at, user_name, breeder_id, level, icon, score,
       split_part(difficulty, '-', 2) as song_id,
       split_part(difficulty, '-', 3) as difficulty_id,
       party, profile_frame
from public.rankings r
where difficulty like 'Rhythm-%'
  and array_length(string_to_array(difficulty, '-'), 1) = 4
  and split_part(difficulty, '-', 4) = '2'
  and score is not null;

create or replace view public.rhythm2_identified_scores
with (security_invoker = on) as
select s.id, s.created_at, s.user_name, s.breeder_id, s.level, s.icon, s.score, s.song_id, s.difficulty_id,
       coalesce(s.breeder_id, m.merged_breeder_id, 'name:' || s.user_name) as identity_key,
       s.party, s.profile_frame
from public.rhythm2_scores s
left join public.rhythm_identity_map m on m.user_name = s.user_name;

create or replace view public.rhythm2_song_bests
with (security_invoker = on) as
select distinct on (identity_key, song_id) identity_key, user_name, song_id, difficulty_id, score, created_at, level, icon, profile_frame
from public.rhythm2_identified_scores s
where not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
order by identity_key, song_id, score desc, created_at, id;

create or replace view public.rhythm2_total_rankings
with (security_invoker = on) as
select identity_key,
       (array_agg(user_name order by created_at desc))[1] as user_name,
       sum(score) as total_score,
       count(*)::integer as song_count,
       max(created_at) as last_scored_at,
       (array_agg(level order by created_at desc))[1] as level,
       (array_agg(icon order by created_at desc))[1] as icon,
       (array_agg(profile_frame order by created_at desc))[1] as profile_frame
from public.rhythm2_song_bests b
group by identity_key;

-- ===== 関数(今の rhythm_* と同じ中身で、数える記録だけ rhythm2_identified_scores) =====
create or replace function public.rhythm2_week_score_totals(from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, play_count integer, song_count integer, last_scored_at timestamptz, level integer, icon text, profile_frame text)
language sql stable security invoker as $$
  select s.identity_key::text, (array_agg(s.user_name order by s.created_at desc))[1]::text, sum(s.score)::bigint, count(*)::integer,
         count(distinct s.song_id)::integer, max(s.created_at), (array_agg(s.level order by s.created_at desc))[1]::integer,
         (array_agg(s.icon order by s.created_at desc))[1]::text, (array_agg(s.profile_frame order by s.created_at desc))[1]::text
  from public.rhythm2_identified_scores s
  where s.created_at >= from_at and s.created_at < to_at
    and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
  group by s.identity_key;
$$;

create or replace function public.rhythm2_event_song_bests(song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, song_id text, difficulty_id text, score integer, scored_at timestamptz, level integer, icon text, party jsonb, profile_frame text)
language sql stable security invoker as $$
  select distinct on (s.identity_key, s.song_id) s.identity_key::text, s.user_name::text, s.song_id::text, s.difficulty_id::text, s.score::integer,
         s.created_at, s.level::integer, s.icon::text, s.party::jsonb, s.profile_frame::text
  from public.rhythm2_identified_scores s
  where s.song_id = any(song_ids) and s.created_at >= from_at and s.created_at < to_at
    and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
  order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;
$$;

create or replace function public.rhythm2_event_song_bests_bonus(song_ids text[], from_at timestamptz, to_at timestamptz, bonus_rates jsonb default '{}'::jsonb)
returns table(identity_key text, user_name text, song_id text, difficulty_id text, score integer, scored_at timestamptz, level integer, icon text, party jsonb, base_score integer, bonus_score integer, play_count integer, play_counts jsonb, profile_frame text)
language sql stable security invoker as $$
  with plays as (
    select s.id, s.identity_key, s.user_name, s.song_id, s.difficulty_id, s.score, s.created_at, s.level, s.icon, s.party, s.profile_frame
    from public.rhythm2_identified_scores s
    where s.song_id = any(song_ids) and s.created_at >= from_at and s.created_at < to_at
      and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
  ), bests as (
    select distinct on (p.identity_key, p.song_id) p.identity_key, p.user_name, p.song_id, p.difficulty_id, p.score, p.created_at, p.level, p.icon, p.party, p.profile_frame
    from plays p order by p.identity_key, p.song_id, p.score desc, p.created_at asc, p.id asc
  ), per_diff as (
    select p.identity_key, p.song_id, p.difficulty_id, count(*)::integer as n from plays p group by p.identity_key, p.song_id, p.difficulty_id
  ), counts as (
    select d.identity_key, d.song_id, sum(d.n)::integer as play_count,
           sum(d.n * least(greatest(case when (bonus_rates ->> d.difficulty_id) ~ '^[0-9]+(\.[0-9]+)?$' then (bonus_rates ->> d.difficulty_id)::numeric else 0 end, 0), 0.1)) as rate_sum,
           jsonb_object_agg(d.difficulty_id, d.n) as play_counts
    from per_diff d group by d.identity_key, d.song_id
  )
  select b.identity_key::text, b.user_name::text, b.song_id::text, b.difficulty_id::text,
         (b.score + floor(b.score * coalesce(c.rate_sum, 0)))::integer, b.created_at, b.level::integer, b.icon::text, b.party::jsonb,
         b.score::integer, floor(b.score * coalesce(c.rate_sum, 0))::integer, coalesce(c.play_count, 0)::integer, coalesce(c.play_counts, '{}'::jsonb), b.profile_frame::text
  from bests b left join counts c on c.identity_key = b.identity_key and c.song_id = b.song_id;
$$;

create or replace function public.rhythm2_event_totals(song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, song_count integer, last_scored_at timestamptz, level integer, icon text, profile_frame text)
language sql stable security invoker as $$
  select b.identity_key, (array_agg(b.user_name order by b.scored_at desc))[1], sum(b.score)::bigint, count(*)::integer, max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1], (array_agg(b.icon order by b.scored_at desc))[1], (array_agg(b.profile_frame order by b.scored_at desc))[1]
  from public.rhythm2_event_song_bests(song_ids, from_at, to_at) b
  group by b.identity_key;
$$;

create or replace function public.rhythm2_event_totals_bonus(song_ids text[], from_at timestamptz, to_at timestamptz, bonus_rates jsonb default '{}'::jsonb)
returns table(identity_key text, user_name text, total_score bigint, song_count integer, last_scored_at timestamptz, level integer, icon text, base_total bigint, bonus_total bigint, play_count integer, play_counts jsonb, profile_frame text)
language sql stable security invoker as $$
  with bests as (
    select * from public.rhythm2_event_song_bests_bonus(song_ids, from_at, to_at, bonus_rates)
  ), per_diff as (
    select b.identity_key, e.key as difficulty_id, sum((e.value)::integer)::integer as n
    from bests b, lateral jsonb_each_text(coalesce(b.play_counts, '{}'::jsonb)) e
    group by b.identity_key, e.key
  ), merged as (
    select d.identity_key, jsonb_object_agg(d.difficulty_id, d.n) as play_counts from per_diff d group by d.identity_key
  )
  select b.identity_key, (array_agg(b.user_name order by b.scored_at desc))[1], sum(b.score)::bigint, count(*)::integer, max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1], (array_agg(b.icon order by b.scored_at desc))[1], sum(b.base_score)::bigint, sum(b.bonus_score)::bigint,
         sum(b.play_count)::integer, coalesce((select m.play_counts from merged m where m.identity_key = b.identity_key), '{}'::jsonb),
         (array_agg(b.profile_frame order by b.scored_at desc))[1]
  from bests b group by b.identity_key;
$$;

create or replace function public.rhythm2_total_precise(identity_keys text[] default null)
returns table(identity_key text, total_precise bigint)
language sql stable security invoker as $$
  with bests as (
    select distinct on (s.identity_key, s.song_id) s.identity_key, public.rhythm_party_precise(s.party) as precise
    from public.rhythm2_identified_scores s
    where (identity_keys is null or s.identity_key = any(identity_keys))
      and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
    order by s.identity_key, s.song_id, s.score desc, public.rhythm_party_precise(s.party) desc, s.created_at asc, s.id asc
  )
  select b.identity_key::text, coalesce(sum(b.precise), 0)::bigint from bests b group by b.identity_key;
$$;

create or replace function public.rhythm2_week_precise(from_at timestamptz, to_at timestamptz, identity_keys text[] default null)
returns table(identity_key text, total_precise bigint)
language sql stable security invoker as $$
  select s.identity_key::text, coalesce(sum(public.rhythm_party_precise(s.party)), 0)::bigint
  from public.rhythm2_identified_scores s
  where s.created_at >= from_at and s.created_at < to_at
    and (identity_keys is null or s.identity_key = any(identity_keys))
    and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
  group by s.identity_key;
$$;

create or replace function public.rhythm2_event_precise(song_ids text[], from_at timestamptz, to_at timestamptz, identity_keys text[] default null)
returns table(identity_key text, total_precise bigint)
language sql stable security invoker as $$
  with bests as (
    select distinct on (s.identity_key, s.song_id) s.identity_key, public.rhythm_party_precise(s.party) as precise
    from public.rhythm2_identified_scores s
    where s.song_id = any(song_ids) and s.created_at >= from_at and s.created_at < to_at
      and (identity_keys is null or s.identity_key = any(identity_keys))
      and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id)
    order by s.identity_key, s.song_id, s.score desc, public.rhythm_party_precise(s.party) desc, s.created_at asc, s.id asc
  )
  select b.identity_key::text, coalesce(sum(b.precise), 0)::bigint from bests b group by b.identity_key;
$$;

-- ===== 読む権限(今の rhythm_* と同じく、だれでも読むだけ) =====
grant select on public.rhythm2_scores, public.rhythm2_identified_scores, public.rhythm2_song_bests, public.rhythm2_total_rankings to anon, authenticated;
grant execute on function public.rhythm2_week_score_totals(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.rhythm2_event_song_bests(text[], timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.rhythm2_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.rhythm2_event_totals(text[], timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.rhythm2_event_totals_bonus(text[], timestamptz, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.rhythm2_total_precise(text[]) to anon, authenticated;
grant execute on function public.rhythm2_week_precise(timestamptz, timestamptz, text[]) to anon, authenticated;
grant execute on function public.rhythm2_event_precise(text[], timestamptz, timestamptz, text[]) to anon, authenticated;

-- ===== 安全確認(1つでも合わなければ例外で止まり、何も残らない) =====
do $$
declare b record; a record;
begin
  select * into b from rhythm_tick_v2_before;
  select (select count(*) from public.rhythm_scores) as scores, (select coalesce(sum(score),0) from public.rhythm_scores) as score_sum,
         (select count(*) from public.rhythm_total_rankings) as totals, (select coalesce(sum(total_score),0) from public.rhythm_total_rankings) as total_sum,
         (select count(*) from public.rankings) as ranking_rows into a;
  if a.scores <> b.scores or a.score_sum <> b.score_sum or a.totals <> b.totals or a.total_sum <> b.total_sum or a.ranking_rows <> b.ranking_rows then
    raise exception '既存の順位が変わった: before=% after=%', row_to_json(b), row_to_json(a);
  end if;
  -- 新しい物差しの記録(…-2)はまだ無いので、新しい見方は空のはず。今の見方に4つ区切りの行が混ざっていないこと
  if exists (select 1 from public.rhythm_scores where song_id = '' or difficulty_id = '') then
    raise exception '今の rhythm_scores に形の違う行がある';
  end if;
  perform 1 from public.rhythm2_total_rankings limit 1;
  perform 1 from public.rhythm2_week_score_totals(now() - interval '7 days', now());
  perform 1 from public.rhythm2_event_totals_bonus(array['sheriruth'], now() - interval '7 days', now(), '{}'::jsonb);
  perform 1 from public.rhythm2_total_precise(null);
  raise notice '安全確認OK: 既存の順位は変わらず(記録 % 件・合計の行 % 件)。rhythm2_* を足した', a.scores, a.totals;
end $$;

commit;
