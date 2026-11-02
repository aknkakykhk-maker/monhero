-- モンヒロビートのイベントのランキングで、原曲とショート版を「同じ曲」として数える(2026-11-01 社長)
--   イベント「鍵の向こう側へ ～パンドラとふたつの翼～」(11/2〜11/9)から。
--   ★まとめるのはイベントの集計だけ(この4つの関数)。ふだんの曲ごとのランキング・自己ベスト・週間は触らない。
--   ★表(rhythm_identified_scores など)は読むだけ。記録を消したり書き換えたりしない。
--   ★まとめ方: 曲の id の末尾の「_short」を外したものを曲のまとまり(song_id)として、その中のいちばん良い記録を1件だけ使う。
--     端末がショート版の id も渡したときだけまとまる。これまでのイベントは原曲の id しか渡していないので、結果は1件も変わらない。
--   ★関数の名前・引数・返す列は今までと同じ(CREATE OR REPLACE)。返す song_id はまとまりの id(原曲の id)。
--   rhythm_event_totals / rhythm_event_totals_bonus は下の2つを呼んでいるので、そのままでまとまる(曲数 song_count も原曲とショートで1曲)。

CREATE OR REPLACE FUNCTION public.rhythm_event_song_bests(song_ids text[], from_at timestamp with time zone, to_at timestamp with time zone)
 RETURNS TABLE(identity_key text, user_name text, song_id text, difficulty_id text, score integer, scored_at timestamp with time zone, level integer, icon text, party jsonb, profile_frame text)
 LANGUAGE sql
 STABLE
AS $function$
  select distinct on (s.identity_key, regexp_replace(s.song_id, '_short$', ''))
         s.identity_key::text, s.user_name::text, regexp_replace(s.song_id, '_short$', '')::text, s.difficulty_id::text,
         s.score::integer, s.created_at, s.level::integer, s.icon::text, s.party::jsonb,
         s.profile_frame::text
    from public.rhythm_identified_scores s
   where s.song_id = any(song_ids)
     and s.created_at >= from_at and s.created_at < to_at
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   order by s.identity_key, regexp_replace(s.song_id, '_short$', ''), s.score desc, s.created_at asc, s.id asc;
$function$;

CREATE OR REPLACE FUNCTION public.rhythm_event_song_bests_bonus(song_ids text[], from_at timestamp with time zone, to_at timestamp with time zone, bonus_rates jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(identity_key text, user_name text, song_id text, difficulty_id text, score integer, scored_at timestamp with time zone, level integer, icon text, party jsonb, base_score integer, bonus_score integer, play_count integer, play_counts jsonb, profile_frame text)
 LANGUAGE sql
 STABLE
AS $function$
  with plays as (
    select s.id, s.identity_key, s.user_name, regexp_replace(s.song_id, '_short$', '') as song_id, s.difficulty_id,
           s.score, s.created_at, s.level, s.icon, s.party, s.profile_frame
      from public.rhythm_identified_scores s
     where s.song_id = any(song_ids)
       and s.created_at >= from_at and s.created_at < to_at
       and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                        where x.song_id = s.song_id)
  ),
  bests as (
    select distinct on (p.identity_key, p.song_id)
           p.identity_key, p.user_name, p.song_id, p.difficulty_id,
           p.score, p.created_at, p.level, p.icon, p.party, p.profile_frame
      from plays p
     order by p.identity_key, p.song_id, p.score desc, p.created_at asc, p.id asc
  ),
  per_diff as (
    select p.identity_key, p.song_id, p.difficulty_id, count(*)::integer as n
      from plays p
     group by p.identity_key, p.song_id, p.difficulty_id
  ),
  counts as (
    select d.identity_key, d.song_id,
           sum(d.n)::integer as play_count,
           sum(d.n * least(greatest(
             case when (bonus_rates ->> d.difficulty_id) ~ '^[0-9]+(\.[0-9]+)?$'
                  then (bonus_rates ->> d.difficulty_id)::numeric else 0 end, 0), 0.1)) as rate_sum,
           jsonb_object_agg(d.difficulty_id, d.n) as play_counts
      from per_diff d
     group by d.identity_key, d.song_id
  )
  select b.identity_key::text,
         b.user_name::text,
         b.song_id::text,
         b.difficulty_id::text,
         (b.score + floor(b.score * coalesce(c.rate_sum, 0)))::integer,
         b.created_at,
         b.level::integer,
         b.icon::text,
         b.party::jsonb,
         b.score::integer,
         floor(b.score * coalesce(c.rate_sum, 0))::integer,
         coalesce(c.play_count, 0)::integer,
         coalesce(c.play_counts, '{}'::jsonb),
         b.profile_frame::text
    from bests b
    left join counts c on c.identity_key = b.identity_key and c.song_id = b.song_id;
$function$;

CREATE OR REPLACE FUNCTION public.rhythm_event_precise(song_ids text[], from_at timestamp with time zone, to_at timestamp with time zone, identity_keys text[] DEFAULT NULL::text[])
 RETURNS TABLE(identity_key text, total_precise bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with bests as (
    select distinct on (s.identity_key, regexp_replace(s.song_id, '_short$', ''))
           s.identity_key, public.rhythm_party_precise(s.party) as precise
      from public.rhythm_identified_scores s
     where s.song_id = any(song_ids)
       and s.created_at >= from_at and s.created_at < to_at
       and (identity_keys is null or s.identity_key = any(identity_keys))
       and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                        where x.song_id = s.song_id)
     order by s.identity_key, regexp_replace(s.song_id, '_short$', ''), s.score desc,
              public.rhythm_party_precise(s.party) desc, s.created_at asc, s.id asc
  )
  select b.identity_key::text, coalesce(sum(b.precise), 0)::bigint
    from bests b
   group by b.identity_key;
$function$;
