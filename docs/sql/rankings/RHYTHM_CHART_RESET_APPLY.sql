-- モンヒロビート: 作り直した譜面のスコアを数え直す(2026-11-23・台帳 r1119-136・全部必殺技でつ( `･ω･) の HELL)
--   社長「スコアはリセット。ただし回数ボーナスはのこし」。
--
-- 【端末側(アプリ)でしたこと】作り直した HELL の記録は、ランキングの鍵の末尾に版の印を付けて送る
--   (Rhythm-zenbu_hissatsuwaza-HELL-r2・4つ区切り。data/rhythm-mode.js の RHYTHM_CHART_RESETS)。
--   旧の HELL の記録(Rhythm-zenbu_hissatsuwaza-HELL・3つ区切り)は消さず書き換えず、そのまま残る。
--   曲ごとの順位(端末が鍵で直接読む)は、これだけで新しい譜面の記録だけになる。
--
-- 【このSQLですること】(記録の行は1件も消さない・書き換えない。CLAUDE.md ⑦)
--   ① 表 rhythm_chart_resets を足し、作り直した譜面を1行書く(足すだけ)
--   ② 見方 rhythm_scores の「どの行を数えるか」だけを変える:
--      新しい鍵(…-r2)の行を、同じ曲・同じ難易度として数える / 旧の鍵の行は数えない
--      → これを読む合算ランキング・イベントの点・週間(累計)が、新しい譜面の記録だけになる
--   ③ イベントの回数ボーナス(rhythm_event_song_bests_bonus)は、旧の HELL を遊んだ回数も数え続ける
--      (点のもとになる「いちばん良い記録」は新しい譜面だけ・回数は旧と新の合計)
--
-- 【影響】
--   ・合算ランキング・イベントの点: この曲の HELL は新しい譜面の記録だけで数え直し(旧の HELL の点は入らない)
--   ・イベントの遊んだ回数(ボーナスの割合・回数の表示): 旧の HELL の回数も今のまま入る
--   ・週間ランキング(累計): 今週(11/23 5:00〜)遊んだ旧の HELL の点が週の累計から外れる。
--     外したくなければ、週の関数にも③と同じ足し方が要る(窓口の判断)
--   ・古い版のアプリが旧の鍵で送った記録は、点には入らず回数だけに入る
--
-- 【流す前に】★このファイルは docs/sql/rankings/ の控え(PROFILE_FRAME_APPLY.sql・RHYTHM_EVENT_SONG_VERSIONS_APPLY.sql)から作った。
--   本番の定義が控えと違う(列が増えた等)ときは、本番の定義(pg_get_viewdef / pg_get_functiondef)を元に、
--   ②は where の条件だけ、③は per_diff の材料だけを同じように変える。返す列・名前・引数は変えない。
--   確かめる: select pg_get_viewdef('public.rhythm_scores'::regclass, true);
--             select pg_get_functiondef('public.rhythm_event_song_bests_bonus(text[],timestamptz,timestamptz,jsonb)'::regprocedure);

begin;

-- ① 作り直した譜面の一覧(足すだけ)
create table if not exists public.rhythm_chart_resets (
  legacy_key text primary key,          -- 旧の譜面の鍵(3つ区切り)。この鍵の行は点に数えない
  current_key text not null unique,     -- 新しい譜面の鍵(4つ区切り)。この行を同じ曲・難易度として数える
  song_id text not null,
  difficulty_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.rhythm_chart_resets enable row level security;
drop policy if exists rhythm_chart_resets_read on public.rhythm_chart_resets;
create policy rhythm_chart_resets_read on public.rhythm_chart_resets for select using (true);
grant select on public.rhythm_chart_resets to anon, authenticated;

insert into public.rhythm_chart_resets (legacy_key, current_key, song_id, difficulty_id, reason)
values ('Rhythm-zenbu_hissatsuwaza-HELL', 'Rhythm-zenbu_hissatsuwaza-HELL-r2', 'zenbu_hissatsuwaza', 'HELL',
        '2026-11-23 r1119-136 社長: HELL を作り直し・スコアは数え直し(回数ボーナスは残す)')
on conflict (legacy_key) do nothing;

-- ② 数える行だけを変える(列・並び・名前は今のまま)
create or replace view public.rhythm_scores
with (security_invoker = on) as
select r.id, r.created_at, r.user_name, r.breeder_id, r.level, r.icon, r.score,
       split_part(r.difficulty, '-', 2) as song_id,
       split_part(r.difficulty, '-', 3) as difficulty_id,
       r.party,
       r.profile_frame
  from public.rankings r
 where r.difficulty like 'Rhythm-%'
   and r.score is not null
   and (
     (array_length(string_to_array(r.difficulty, '-'), 1) = 3
       and not exists (select 1 from public.rhythm_chart_resets c where c.legacy_key = r.difficulty))
     or exists (select 1 from public.rhythm_chart_resets c where c.current_key = r.difficulty)
   );

-- ③ 回数ボーナスは旧の譜面の回数も数える(per_diff の材料に旧の鍵の行を足すだけ。ほかは今のまま)
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
  -- 作り直す前の譜面を遊んだ回数(点には使わない。回数ボーナスだけ)
  legacy_plays as (
    select coalesce(r.breeder_id, m.merged_breeder_id, 'name:' || r.user_name) as identity_key,
           regexp_replace(c.song_id, '_short$', '') as song_id, c.difficulty_id
      from public.rankings r
      join public.rhythm_chart_resets c on c.legacy_key = r.difficulty
      left join public.rhythm_identity_map m on m.user_name = r.user_name
     where r.score is not null
       and c.song_id = any(song_ids)
       and r.created_at >= from_at and r.created_at < to_at
       and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                        where x.song_id = c.song_id)
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
      from (select identity_key, song_id, difficulty_id from plays
            union all
            select identity_key, song_id, difficulty_id from legacy_plays) p
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

-- 確かめ(行の数が変わっていない・旧の HELL の行が残っている)
select count(*) as rankings_rows from public.rankings;
select count(*) as legacy_hell_rows_kept from public.rankings where difficulty = 'Rhythm-zenbu_hissatsuwaza-HELL';
select count(*) as new_hell_rows from public.rankings where difficulty = 'Rhythm-zenbu_hissatsuwaza-HELL-r2';
select difficulty_id, count(*) from public.rhythm_scores where song_id = 'zenbu_hissatsuwaza' group by difficulty_id order by 1;

commit;
