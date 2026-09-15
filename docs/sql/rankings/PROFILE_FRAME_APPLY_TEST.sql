-- public.rankings へ profile_frame 列を1つ追加し、モンビーのビュー・関数へその列を通すSQLの【予行演習】。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(PROFILE_FRAME_APPLY.sql)の前にこちらを通す。
--
-- 既存の行・列・RLS・ポリシー・権限は変更しない(DROP TABLE・DELETE・UPDATEをしない)。
-- 足すのはNULL許容の列1つだけなので、既存の記録はすべてNULLのまま残る(NULL = フレームなし)。
-- これをエラー無く通してから PROFILE_FRAME_APPLY.sql(末尾 commit;)を実行する。
--
-- なぜ足すのか:
--   プロフィールフレーム(2026-09-15)は、ブリーダーアイコンの外側へ重ねる飾り枠。
--   ランキングには**他の人の枠も**出すので、記録と一緒にそのidを残す必要がある。
--   既存の icon / party へ詰め込まず、専用のNULL許容列を1つ足す。
--   順位・スコア・集計方法は一切変えない(この列は表示にしか使わない)。
--
-- 先に必要なSQL:
--   RANKINGS_APPLY.sql → BREEDER_ID_APPLY.sql → RHYTHM_TOTAL_APPLY.sql →
--   RHYTHM_EVENT_APPLY.sql → RHYTHM_EVENT_DETAIL_APPLY.sql → RHYTHM_EVENT_BONUS_APPLY.sql →
--   RHYTHM_WEEK_TOTAL_APPLY.sql → (ここ)
--
-- アプリ側はこのSQLを当てる前でも壊れない。列が無い間は
--   ・送るとき … profile_frame を外して送り直す(記録は必ず残る)
--   ・出すとき … profile_frame を外して取り直す(枠が出ないだけ)
-- ので、SQLの適用とアプリの公開はどちらが先でもよい(26-supabase.jsx)。

begin;

-- 土台が揃っているかを先に見る。揃っていなければ何もせず止まる。
do $$
begin
  if to_regclass('public.rankings') is null then
    raise exception 'public.rankings がありません。先に RANKINGS_APPLY.sql を適用してください。';
  end if;
  if to_regclass('public.rhythm_identified_scores') is null then
    raise exception 'public.rhythm_identified_scores がありません。先に RHYTHM_TOTAL_APPLY.sql を適用してください。';
  end if;
  if to_regprocedure('public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb)') is null then
    raise exception 'public.rhythm_event_song_bests_bonus がありません。先に RHYTHM_EVENT_BONUS_APPLY.sql を適用してください。';
  end if;
  if to_regprocedure('public.rhythm_week_score_totals(timestamptz, timestamptz)') is null then
    raise exception 'public.rhythm_week_score_totals がありません。先に RHYTHM_WEEK_TOTAL_APPLY.sql を適用してください。';
  end if;
end $$;

-- 短時間だけDDLと競合する書き込みを止め、検査から列追加までの競合を防ぐ。
lock table public.rankings in share row exclusive mode;

-- 適用前の状態を控える。この作業では中身も権限も変えないので、
-- 最後に「件数もRLSもポリシーも権限も変わっていない」ことを機械的に確かめる。
create temporary table profile_frame_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table profile_frame_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table profile_frame_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table profile_frame_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

-- 既に同名の列が別の型である環境では、作り替えず安全側で停止する。
do $$
declare
  frame_type text;
begin
  select data_type into frame_type from information_schema.columns
  where table_schema = 'public' and table_name = 'rankings' and column_name = 'profile_frame';
  if frame_type is not null and frame_type <> 'text' then
    raise exception 'public.rankings.profile_frame が別の型(%)で既に存在します。内容を確認してから再実行してください', frame_type;
  end if;
end $$;

-- 【① 列を1つ足す】
-- 選んでいるプロフィールフレームのid。列を足す前の記録はNULLのままで、あとから埋めない
-- (NULL = フレームなし)。順位・スコア・集計には一切関わらない。
alter table public.rankings add column if not exists profile_frame text;

comment on column public.rankings.profile_frame is
  'プロフィールフレームのid(data/breeder.js の PROFILE_FRAMES)。NULL = フレームなし。表示だけに使い、順位・スコア・集計には影響しない。';

-- 明らかにありえない値を弾く。既存行はすべてNULLなので、この制約に引っかかる行は無い
-- (idは英小文字・数字・アンダースコアの短い文字列)。
do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'rankings'
                   and c.conname = 'rankings_profile_frame_shape') then
    alter table public.rankings add constraint rankings_profile_frame_shape
      check (profile_frame is null or (profile_frame ~ '^[a-z0-9_]{1,40}$'));
  end if;
end $$;

-- 【② モンビーのビューへ profile_frame を通す】
-- ★足すのは**いちばん最後**。create or replace view は列の名前も並びも変えられず、
--   後ろへ足すことしかできない。真ん中へ入れると
--   「42P16: cannot change name of view column ...」で止まる
--   (2026-09-11・party を足したときに実際に踏んだ)。
-- ★where も他の列も RHYTHM_TOTAL_APPLY.sql / RHYTHM_EVENT_DETAIL_APPLY.sql のまま。
create or replace view public.rhythm_scores
with (security_invoker = on) as
select r.id, r.created_at, r.user_name, r.breeder_id, r.level, r.icon, r.score,
       split_part(r.difficulty, '-', 2) as song_id,
       split_part(r.difficulty, '-', 3) as difficulty_id,
       r.party,
       r.profile_frame
  from public.rankings r
 where r.difficulty like 'Rhythm-%'
   and array_length(string_to_array(r.difficulty, '-'), 1) = 3
   and r.score is not null;

comment on view public.rhythm_scores is
  'モンビーの記録を曲IDと難易度IDへ割ったもの。rankings の読み取り専用ビュー。party に判定の内訳、profile_frame に飾り枠。';

create or replace view public.rhythm_identified_scores
with (security_invoker = on) as
select s.id, s.created_at, s.user_name, s.breeder_id, s.level, s.icon, s.score,
       s.song_id, s.difficulty_id,
       coalesce(s.breeder_id, m.merged_breeder_id, 'name:' || s.user_name) as identity_key,
       s.party,
       s.profile_frame
  from public.rhythm_scores s
  left join public.rhythm_identity_map m on m.user_name = s.user_name;

comment on view public.rhythm_identified_scores is
  'モンビーの記録に、集計で使う人の単位(identity_key)を付けたもの。party に判定の内訳、profile_frame に飾り枠。';

-- 曲ごとのベスト1件。並び・絞り込みは RHYTHM_TOTAL_APPLY.sql のまま(足したのは列1つだけ)
create or replace view public.rhythm_song_bests
with (security_invoker = on) as
select distinct on (s.identity_key, s.song_id)
       s.identity_key, s.user_name, s.song_id, s.difficulty_id,
       s.score, s.created_at, s.level, s.icon,
       s.profile_frame
  from public.rhythm_identified_scores s
 where not exists (select 1 from public.rhythm_ranking_song_exclusions x
                    where x.song_id = s.song_id)
 order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;

comment on view public.rhythm_song_bests is
  '人×曲ごとの最高スコア1件(難易度は問わない)。全曲合算とイベント集計の土台。';

-- 全曲合算。表示名・Lv・アイコンと同じく、飾り枠もその人のいちばん新しい記録のものを採る
create or replace view public.rhythm_total_rankings
with (security_invoker = on) as
select b.identity_key,
       (array_agg(b.user_name order by b.created_at desc))[1] as user_name,
       sum(b.score)::bigint                                   as total_score,
       count(*)::int                                          as song_count,
       max(b.created_at)                                      as last_scored_at,
       (array_agg(b.level order by b.created_at desc))[1]     as level,
       (array_agg(b.icon  order by b.created_at desc))[1]     as icon,
       (array_agg(b.profile_frame order by b.created_at desc))[1] as profile_frame
  from public.rhythm_song_bests b
 group by b.identity_key;

comment on view public.rhythm_total_rankings is
  'ブリーダー別の全曲合算ランキング。曲ごとのベスト1件を全曲ぶん合計したもの。';

-- 【③ 期間の関数へ profile_frame を通す】
-- ★戻り値の並びを変えるので、いったん drop してから作り直す
--   (create or replace では戻り値の型を変えられない)。
--   消えている時間はこのトランザクションの中だけで、commit するまで外からは見えない。
-- ★中身(並び・絞り込み・加点の計算)は元のSQLのまま。足したのは列1つだけ。
drop function if exists public.rhythm_event_song_bests(text[], timestamptz, timestamptz);
create function public.rhythm_event_song_bests(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text, party jsonb,
              profile_frame text)
language sql stable security invoker as $$
  select distinct on (s.identity_key, s.song_id)
         s.identity_key::text, s.user_name::text, s.song_id::text, s.difficulty_id::text,
         s.score::integer, s.created_at, s.level::integer, s.icon::text, s.party::jsonb,
         s.profile_frame::text
    from public.rhythm_identified_scores s
   where s.song_id = any(song_ids)
     and s.created_at >= from_at and s.created_at < to_at
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;
$$;

comment on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz) is
  '期間×対象曲の、人×曲ごとの最高スコア1件(難易度は問わない)。party に判定の内訳、profile_frame に飾り枠。';

drop function if exists public.rhythm_event_totals(text[], timestamptz, timestamptz);
create function public.rhythm_event_totals(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, song_count integer,
              last_scored_at timestamptz, level integer, icon text, profile_frame text)
language sql stable security invoker as $$
  select b.identity_key,
         (array_agg(b.user_name order by b.scored_at desc))[1],
         sum(b.score)::bigint,
         count(*)::integer,
         max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1],
         (array_agg(b.icon  order by b.scored_at desc))[1],
         (array_agg(b.profile_frame order by b.scored_at desc))[1]
    from public.rhythm_event_song_bests(song_ids, from_at, to_at) b
   group by b.identity_key;
$$;

comment on function public.rhythm_event_totals(text[], timestamptz, timestamptz) is
  '期間×対象曲の総合ランキング。対象曲それぞれのベストを足し合わせた合計。';

drop function if exists public.rhythm_week_score_totals(timestamptz, timestamptz);
create function public.rhythm_week_score_totals(from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, play_count integer,
              song_count integer, last_scored_at timestamptz, level integer, icon text,
              profile_frame text)
language sql stable security invoker as $$
  select s.identity_key::text,
         (array_agg(s.user_name order by s.created_at desc))[1]::text,
         sum(s.score)::bigint,
         count(*)::integer,
         count(distinct s.song_id)::integer,
         max(s.created_at),
         (array_agg(s.level order by s.created_at desc))[1]::integer,
         (array_agg(s.icon  order by s.created_at desc))[1]::text,
         (array_agg(s.profile_frame order by s.created_at desc))[1]::text
    from public.rhythm_identified_scores s
   where s.created_at >= from_at and s.created_at < to_at
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   group by s.identity_key;
$$;

comment on function public.rhythm_week_score_totals(timestamptz, timestamptz) is
  '期間中に出した記録の累計スコア(週間ランキング)。曲ごとのベストではなく、遊んだ分をすべて足す。';

drop function if exists public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb);
create function public.rhythm_event_song_bests_bonus(
  song_ids text[], from_at timestamptz, to_at timestamptz, bonus_rates jsonb default '{}'::jsonb)
returns table(identity_key text, user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text, party jsonb,
              base_score integer, bonus_score integer, play_count integer, play_counts jsonb,
              profile_frame text)
language sql stable security invoker as $$
  with plays as (
    select s.id, s.identity_key, s.user_name, s.song_id, s.difficulty_id,
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
$$;

comment on function public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb) is
  '期間×対象曲の、人×曲ごとの最高スコアへ「遊んだ回数ぶんの加点」を乗せたもの。割合は引数で渡す。play_counts に難易度ごとの回数、profile_frame に飾り枠。';

drop function if exists public.rhythm_event_totals_bonus(text[], timestamptz, timestamptz, jsonb);
create function public.rhythm_event_totals_bonus(
  song_ids text[], from_at timestamptz, to_at timestamptz, bonus_rates jsonb default '{}'::jsonb)
returns table(identity_key text, user_name text, total_score bigint, song_count integer,
              last_scored_at timestamptz, level integer, icon text,
              base_total bigint, bonus_total bigint, play_count integer, play_counts jsonb,
              profile_frame text)
language sql stable security invoker as $$
  with bests as (
    select * from public.rhythm_event_song_bests_bonus(song_ids, from_at, to_at, bonus_rates)
  ),
  per_diff as (
    select b.identity_key, e.key as difficulty_id, sum((e.value)::integer)::integer as n
      from bests b,
           lateral jsonb_each_text(coalesce(b.play_counts, '{}'::jsonb)) e
     group by b.identity_key, e.key
  ),
  merged as (
    select d.identity_key, jsonb_object_agg(d.difficulty_id, d.n) as play_counts
      from per_diff d
     group by d.identity_key
  )
  select b.identity_key,
         (array_agg(b.user_name order by b.scored_at desc))[1],
         sum(b.score)::bigint,
         count(*)::integer,
         max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1],
         (array_agg(b.icon  order by b.scored_at desc))[1],
         sum(b.base_score)::bigint,
         sum(b.bonus_score)::bigint,
         sum(b.play_count)::integer,
         coalesce((select m.play_counts from merged m where m.identity_key = b.identity_key), '{}'::jsonb),
         (array_agg(b.profile_frame order by b.scored_at desc))[1]
    from bests b
   group by b.identity_key;
$$;

comment on function public.rhythm_event_totals_bonus(text[], timestamptz, timestamptz, jsonb) is
  '期間×対象曲の総合ランキング(回数ボーナス込み)。対象曲それぞれの加点込みスコアの合計。play_counts に難易度ごとの回数、profile_frame に飾り枠。';

-- 【④ 権限】読むだけ。書き込みは一切与えない(元のSQLと同じ)。
grant execute on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz)            to anon, authenticated;
grant execute on function public.rhythm_event_totals(text[], timestamptz, timestamptz)                to anon, authenticated;
grant execute on function public.rhythm_week_score_totals(timestamptz, timestamptz)                   to anon, authenticated;
grant execute on function public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.rhythm_event_totals_bonus(text[], timestamptz, timestamptz, jsonb)     to anon, authenticated;

-- ===== ここから先は「既存の中身と権限に触っていないこと」の検査。1つでも違えば例外で止まる =====
do $$
begin
  if (select row_count from profile_frame_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from profile_frame_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from profile_frame_security_before)
  ) then raise exception 'rankings のRLS状態が変化しました'; end if;

  if exists (
    (select * from profile_frame_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from profile_frame_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from profile_frame_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from profile_frame_grants_before)
  ) then raise exception 'rankings のData API権限が変化しました'; end if;

  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'rankings'
      and grantee = 'anon' and privilege_type = 'INSERT'
  ) then raise exception 'anon が rankings へINSERTできません'; end if;
end $$;

-- ビュー・関数がちゃんと profile_frame を返すか(空の引数で呼ぶだけ。行は返らない)
do $$
declare
  cols int;
begin
  select count(*) into cols from information_schema.columns
   where table_schema='public' and table_name='rhythm_identified_scores' and column_name='profile_frame';
  if cols <> 1 then raise exception 'rhythm_identified_scores に profile_frame がありません'; end if;

  select count(*) into cols from information_schema.columns
   where table_schema='public' and table_name='rhythm_total_rankings' and column_name='profile_frame';
  if cols <> 1 then raise exception 'rhythm_total_rankings に profile_frame がありません'; end if;

  perform * from public.rhythm_event_song_bests('{}'::text[], now() - interval '1 day', now());
  perform * from public.rhythm_event_totals('{}'::text[], now() - interval '1 day', now());
  perform * from public.rhythm_week_score_totals(now() - interval '1 day', now());
  perform * from public.rhythm_event_song_bests_bonus('{}'::text[], now() - interval '1 day', now(), '{}'::jsonb);
  perform * from public.rhythm_event_totals_bonus('{}'::text[], now() - interval '1 day', now(), '{}'::jsonb);
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
with facts as (
  select 1 as sort, 'profile_frame 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='profile_frame')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rankings'
            and c.conname = 'rankings_profile_frame_shape')
  union all
  select 3, 'profile_frame を返すビュー',
         (select coalesce(string_agg(table_name, ', ' order by table_name), 'なし')
          from information_schema.columns
          where table_schema='public' and column_name='profile_frame'
            and table_name like 'rhythm%')
  union all
  select 4, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rankings')
  union all
  select 5, 'ポリシー(変わっていないこと)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='rankings')
  union all
  select 6, '権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='rankings'
            and grantee in ('anon','authenticated'))
  union all
  select 7, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
  union all
  select 8, 'profile_frame が入っている記録(適用直後は0)',
         (select count(*)::text from public.rankings where profile_frame is not null)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
