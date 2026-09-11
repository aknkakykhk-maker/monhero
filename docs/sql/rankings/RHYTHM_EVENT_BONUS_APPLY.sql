-- モンビー(モンヒロビート)のイベントランキングへ「回数ボーナス」を足すSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 2026-09-11・ユーザー指示「イベントランキングでただスコアを競うだけだと、うまい人が
-- 毎回上位に行く。それはそれでいいけど、頑張った人が報われるシステムにもしたい。
-- 例えばやった回数×1%の加点がかかるみたいな」。
--
-- 【やること】
-- 既存のテーブル・ビュー・関数は**何も変えない**(DROP・DELETE・UPDATE・ALTERをしない)。
-- 足すのは読み取り専用の関数2つだけ。
--
--   ・public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb)
--   ・public.rhythm_event_totals_bonus     (text[], timestamptz, timestamptz, jsonb)
--
-- 既存の rhythm_event_song_bests / rhythm_event_totals はそのまま残る。
-- 回数ボーナスを使わないイベント(週間ランキングなど)は、これまでどおり古いほうを呼ぶ。
--
-- 【計算】
--   その人・その曲の素点  = 期間中のベストスコア1件(いままでと同じ)
--   1回ごとの割合        = その回を遊んだ難易度の割合(引数 bonus_rates の値)
--   加点                 = floor(素点 × 期間中の割合の合計)
--   表に出るスコア       = 素点 + 加点
--
-- ★割合は**引数で渡す**。アプリ側(data/rhythm-event.js の RHYTHM_EVENT_PLAY_BONUS_RATES)を
--   書き換えるだけで割合を変えられる。**このSQLを流し直す必要はない**。
-- ★上限は付けない(2026-09-11・ユーザー指示「回数で抜かれたら抜き返せばいいから、
--   上限とかはいらない」)。ただし1回あたりの割合だけは 0〜0.1(=10%)へ丸める。
--   これは上限ではなく**書き間違いよけ**(0.007 のつもりで 7 と書くと1回で800%になる)。
-- ★並べ替えは PostgREST の order=score.desc / total_score.desc がそのまま使う。
--   加点込みの値を score / total_score として返しているので、
--   「加点すれば上位50件に入るはずの人」が切り捨てで消えることはない。
--
-- ★先に RHYTHM_EVENT_APPLY.sql と RHYTHM_EVENT_DETAIL_APPLY.sql を適用しておくこと。
-- ★先に RHYTHM_EVENT_BONUS_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
-- 仕様は docs/spec/RHYTHM_RANKING.md §7。

begin;

-- 土台が無ければ止める。無いまま作ると、関数だけができて中身が空になる。
do $$
begin
  if to_regclass('public.rhythm_identified_scores') is null then
    raise exception 'public.rhythm_identified_scores がありません。先に RHYTHM_TOTAL_APPLY.sql を適用してください。';
  end if;
  if to_regprocedure('public.rhythm_event_song_bests(text[], timestamptz, timestamptz)') is null then
    raise exception 'public.rhythm_event_song_bests がありません。先に RHYTHM_EVENT_APPLY.sql を適用してください。';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='rhythm_identified_scores'
                    and column_name='party') then
    raise exception 'rhythm_identified_scores に party がありません。先に RHYTHM_EVENT_DETAIL_APPLY.sql を適用してください。';
  end if;
end $$;

-- 適用前の状態を控える。rankings は一切変えないので、最後に機械的に確かめる。
create temporary table rhythm_bonus_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table rhythm_bonus_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

-- ===== ① 回数ボーナス込みの「曲ごとベスト」 =====
-- 素点(base_score)・加点(bonus_score)・回数(play_count)も一緒に返す。
-- 画面の「内訳」はこの3つをそのまま出すだけで作れる。
create or replace function public.rhythm_event_song_bests_bonus(
  song_ids text[], from_at timestamptz, to_at timestamptz, bonus_rates jsonb default '{}'::jsonb)
returns table(identity_key text, user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text, party jsonb,
              base_score integer, bonus_score integer, play_count integer)
language sql stable security invoker as $$
  with plays as (
    select s.id, s.identity_key, s.user_name, s.song_id, s.difficulty_id,
           s.score, s.created_at, s.level, s.icon, s.party
      from public.rhythm_identified_scores s
     where s.song_id = any(song_ids)
       and s.created_at >= from_at and s.created_at < to_at
       and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                        where x.song_id = s.song_id)
  ),
  -- 期間中のベスト1件。並び・絞り込みは rhythm_event_song_bests と同じ
  bests as (
    select distinct on (p.identity_key, p.song_id)
           p.identity_key, p.user_name, p.song_id, p.difficulty_id,
           p.score, p.created_at, p.level, p.icon, p.party
      from plays p
     order by p.identity_key, p.song_id, p.score desc, p.created_at asc, p.id asc
  ),
  -- 期間中の回数と、割合の合計。
  -- ★数値として読めない値・書かれていない難易度は 0 として扱う(壊れた引数で落とさない)。
  -- ★1回あたりは 0〜0.1 へ丸める(書き間違いよけ。上限ではない)。
  counts as (
    select p.identity_key, p.song_id,
           count(*)::integer as play_count,
           sum(least(greatest(
             case when (bonus_rates ->> p.difficulty_id) ~ '^[0-9]+(\.[0-9]+)?$'
                  then (bonus_rates ->> p.difficulty_id)::numeric else 0 end, 0), 0.1)) as rate_sum
      from plays p
     group by p.identity_key, p.song_id
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
         coalesce(c.play_count, 0)::integer
    from bests b
    left join counts c on c.identity_key = b.identity_key and c.song_id = b.song_id;
$$;

comment on function public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb) is
  '期間×対象曲の、人×曲ごとの最高スコアへ「遊んだ回数ぶんの加点」を乗せたもの。割合は引数で渡す。';

-- ===== ② 回数ボーナス込みの「総合」 =====
-- 対象曲それぞれの**加点込みのスコア**を足し合わせる。素点の合計と加点の合計も返す。
create or replace function public.rhythm_event_totals_bonus(
  song_ids text[], from_at timestamptz, to_at timestamptz, bonus_rates jsonb default '{}'::jsonb)
returns table(identity_key text, user_name text, total_score bigint, song_count integer,
              last_scored_at timestamptz, level integer, icon text,
              base_total bigint, bonus_total bigint, play_count integer)
language sql stable security invoker as $$
  select b.identity_key,
         (array_agg(b.user_name order by b.scored_at desc))[1],
         sum(b.score)::bigint,
         count(*)::integer,
         max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1],
         (array_agg(b.icon  order by b.scored_at desc))[1],
         sum(b.base_score)::bigint,
         sum(b.bonus_score)::bigint,
         sum(b.play_count)::integer
    from public.rhythm_event_song_bests_bonus(song_ids, from_at, to_at, bonus_rates) b
   group by b.identity_key;
$$;

comment on function public.rhythm_event_totals_bonus(text[], timestamptz, timestamptz, jsonb) is
  '期間×対象曲の総合ランキング(回数ボーナス込み)。対象曲それぞれの加点込みスコアの合計。';

-- ===== 権限 =====
-- 読むだけ。書き込みは一切与えない。
grant execute on function public.rhythm_event_song_bests_bonus(text[], timestamptz, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.rhythm_event_totals_bonus(text[], timestamptz, timestamptz, jsonb)     to anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====

-- 既存の rankings に触っていないこと
do $$
begin
  if (select row_count from rhythm_bonus_count_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
  if exists (
    (select * from rhythm_bonus_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname='public' and tablename='rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname='public' and tablename='rankings'
     except select * from rhythm_bonus_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;
end $$;

-- 既存の関数がそのまま残っていること(古いほうを消していない)
do $$
begin
  if to_regprocedure('public.rhythm_event_song_bests(text[], timestamptz, timestamptz)') is null
     or to_regprocedure('public.rhythm_event_totals(text[], timestamptz, timestamptz)') is null then
    raise exception '加点なしの関数が消えています(残っていないといけません)';
  end if;
end $$;

-- 計算が合っているか。割合を 0 にしたときは、加点なしの関数と1点も違わないはず。
do $$
declare
  songs      text[];
  win_start  timestamptz;
  win_end    timestamptz;
  diff       int;
  neg        int;
begin
  select coalesce(array_agg(song_id), '{}') into songs
    from (select distinct song_id from public.rhythm_identified_scores limit 3) t;
  select week_start, week_end into win_start, win_end from public.rhythm_week_window;

  -- 割合 0 → 素点そのまま
  select count(*) into diff
    from public.rhythm_event_song_bests(songs, win_start, win_end) a
    join public.rhythm_event_song_bests_bonus(songs, win_start, win_end, '{}'::jsonb) b
      on b.identity_key = a.identity_key and b.song_id = a.song_id
   where b.score <> a.score or b.base_score <> a.score or b.bonus_score <> 0;
  if diff > 0 then
    raise exception '割合0のときに加点が入っています(%件)', diff;
  end if;

  -- 割合を入れたとき、加点は素点の割合ぶんで、必ず0以上
  select count(*) into neg
    from public.rhythm_event_song_bests_bonus(songs, win_start, win_end,
           '{"EASY":0.001,"NORMAL":0.002,"HARD":0.003,"EXPERT":0.005,"MASTER":0.007}'::jsonb) b
   where b.bonus_score < 0 or b.score < b.base_score or b.play_count < 1;
  if neg > 0 then
    raise exception '加点の計算がおかしい行があります(%件)', neg;
  end if;

  -- 壊れた引数でも落ちないこと(文字・null・数でない値)
  perform * from public.rhythm_event_totals_bonus(songs, win_start, win_end,
    '{"EASY":"あ","NORMAL":null,"HARD":-5,"MASTER":7}'::jsonb);
end $$;

-- ★プレイヤーと同じ立場(anon)で本当に読めるか。
do $$
declare
  as_owner int;
  as_anon  int;
  songs    text[];
  win_start timestamptz;
  win_end   timestamptz;
begin
  select coalesce(array_agg(song_id), '{}') into songs
    from (select distinct song_id from public.rhythm_identified_scores limit 3) t;
  select week_start, week_end into win_start, win_end from public.rhythm_week_window;

  select count(*) into as_owner from public.rhythm_event_totals_bonus(songs, win_start, win_end, '{}'::jsonb);
  execute 'set local role anon';
  select count(*) into as_anon from public.rhythm_event_totals_bonus(songs, win_start, win_end, '{}'::jsonb);
  execute 'reset role';

  if as_owner > 0 and as_anon = 0 then
    raise exception 'anon から回数ボーナス込みのランキングが読めません(管理者では%件)', as_owner;
  end if;
end $$;

-- 結果を1つの表にまとめて出す(Supabase の SQL Editor は最後の1文しか表示しないため)。
with sample as (select coalesce(array_agg(song_id), '{}') as song_ids
                  from (select distinct song_id from public.rhythm_identified_scores limit 3) t),
     win as (select week_start, week_end from public.rhythm_week_window),
     rates as (select '{"EASY":0.001,"NORMAL":0.002,"HARD":0.003,"EXPERT":0.005,"MASTER":0.007}'::jsonb as j),
facts as (
  select 1 as sort, '足した関数' as item,
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public'
             and p.proname in ('rhythm_event_song_bests_bonus','rhythm_event_totals_bonus')) as value
  union all
  select 2, '加点なしの関数(残っていること)',
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public'
             and p.proname in ('rhythm_event_song_bests','rhythm_event_totals'))
  union all
  select 3, 'anon/authenticated から実行できること',
         (select coalesce(string_agg(distinct grantee, ', '), 'なし')
            from information_schema.role_routine_grants
           where specific_schema='public'
             and routine_name in ('rhythm_event_song_bests_bonus','rhythm_event_totals_bonus')
             and grantee in ('anon','authenticated'))
  union all
  select 4, '試しの3曲(記録のある曲から)',
         (select coalesce(array_to_string(song_ids, ', '), 'なし') from sample)
  union all
  select 5, 'その3曲の今週の総合に載る人数',
         (select count(*)::text from public.rhythm_event_totals_bonus(
            (select song_ids from sample), (select week_start from win), (select week_end from win),
            (select j from rates)))
  union all
  select 6, '加点が入った行(今週・その3曲)',
         (select count(*)::text from public.rhythm_event_song_bests_bonus(
            (select song_ids from sample), (select week_start from win), (select week_end from win),
            (select j from rates)) b where b.bonus_score > 0)
  union all
  select 7, '加点のいちばん大きい人の内訳',
         (select coalesce(b.user_name || ' … 素点 ' || b.base_score || ' ＋ 加点 ' || b.bonus_score
                          || '（' || b.play_count || '回）＝ ' || b.score, 'まだありません')
            from public.rhythm_event_song_bests_bonus(
              (select song_ids from sample), (select week_start from win), (select week_end from win),
              (select j from rates)) b
           order by b.bonus_score desc limit 1)
  union all
  select 8, '割合0なら加点なしと一致すること',
         (select case when count(*) = 0 then 'はい（一致）' else '違いあり ' || count(*) || '件' end
            from public.rhythm_event_song_bests((select song_ids from sample), (select week_start from win), (select week_end from win)) a
            join public.rhythm_event_song_bests_bonus((select song_ids from sample), (select week_start from win), (select week_end from win), '{}'::jsonb) b
              on b.identity_key = a.identity_key and b.song_id = a.song_id
           where b.score <> a.score)
  union all
  select 9, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しい関数を認識させる。
-- これを忘れると、しばらくの間アプリから回数ボーナス込みのランキングが読めない
-- (アプリは加点なしのほうへ自動で戻るので、画面は壊れず加点だけ出ない)。
notify pgrst, 'reload schema';
