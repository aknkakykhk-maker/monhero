-- モンヒロビートの「週間ランキング」を**累計スコア方式**へ変えるSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 2026-09-13・ユーザーが決めた「曲別合算方式じゃなくて、どの曲でもやった分のスコア加算」。
--
-- 【何が変わるか】
--   これまで … 曲ごとのその週のベストを、全曲ぶん合計（＝うまさ）
--   これから … その週に出した記録を**ぜんぶそのまま足す**（＝やりこみ量）
--
-- 同じ曲を何回遊んでも、そのつど積み上がる。難易度ごとに満点が違う
-- (EASY 60万 〜 MASTER 100万)ので、足すだけで難易度差は自然に付く。重み付けはしない。
--
-- 【やること】
-- 既存のテーブル・ビュー・関数は**何も変えない**(DROP・DELETE・UPDATE・ALTERをしない)。
-- 足すのは読み取り専用の関数1つだけ。
--
--   ・public.rhythm_week_score_totals(timestamptz, timestamptz)
--
-- 常設の「総合」(rhythm_total_rankings)と、イベントの関数
-- (rhythm_event_song_bests / rhythm_event_totals とその _bonus)はそのまま残る。
-- 役割が分かれる: 総合＝うまさ / 週間＝やりこみ / イベント＝対象曲＋回数ボーナス。
--
-- ★対象曲という引数は持たない。**週間は公開曲すべてが対象**なので、期間だけで足りる。
-- ★除外曲(rhythm_ranking_song_exclusions)はこれまでどおり外す。
-- ★並べ替えは PostgREST の order=total_score.desc がそのまま使う。
--
-- ★先に RHYTHM_TOTAL_APPLY.sql と RHYTHM_EVENT_APPLY.sql を適用しておくこと。
-- ★先に RHYTHM_WEEK_TOTAL_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
-- ★このファイルは**何度流しても同じ結果**になる(drop してから作り直す)。
-- 仕様は docs/spec/RHYTHM_RANKING.md §6。

begin;

-- 土台が無ければ止める。無いまま作ると、関数だけができて中身が空になる。
do $$
begin
  if to_regclass('public.rhythm_identified_scores') is null then
    raise exception 'public.rhythm_identified_scores がありません。先に RHYTHM_TOTAL_APPLY.sql を適用してください。';
  end if;
  if to_regclass('public.rhythm_week_window') is null then
    raise exception 'public.rhythm_week_window がありません。先に RHYTHM_EVENT_APPLY.sql を適用してください。';
  end if;
end $$;

-- 適用前の状態を控える。rankings は一切変えないので、最後に機械的に確かめる。
create temporary table rhythm_week_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table rhythm_week_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

-- ===== 期間の累計スコア =====
-- 人ごとに、その期間の記録を全部足す。名前・Lv・アイコンは**いちばん新しい記録のもの**を使う
-- (名前を変えても最新の呼び方で出るようにするため。既存の関数と同じ考え方)。
-- play_count は参加報酬(その週に3回遊ぶ)の判定にも使う。
drop function if exists public.rhythm_week_score_totals(timestamptz, timestamptz);
create function public.rhythm_week_score_totals(from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, play_count integer,
              song_count integer, last_scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select s.identity_key::text,
         (array_agg(s.user_name order by s.created_at desc))[1]::text,
         sum(s.score)::bigint,
         count(*)::integer,
         count(distinct s.song_id)::integer,
         max(s.created_at),
         (array_agg(s.level order by s.created_at desc))[1]::integer,
         (array_agg(s.icon  order by s.created_at desc))[1]::text
    from public.rhythm_identified_scores s
   where s.created_at >= from_at and s.created_at < to_at
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   group by s.identity_key;
$$;

comment on function public.rhythm_week_score_totals(timestamptz, timestamptz) is
  '期間中に出した記録の累計スコア(週間ランキング)。曲ごとのベストではなく、遊んだ分をすべて足す。';

-- ===== 権限 =====
-- 読むだけ。書き込みは一切与えない。
grant execute on function public.rhythm_week_score_totals(timestamptz, timestamptz) to anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====

-- 既存の rankings に触っていないこと
do $$
begin
  if (select row_count from rhythm_week_count_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
  if exists (
    (select * from rhythm_week_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname='public' and tablename='rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname='public' and tablename='rankings'
     except select * from rhythm_week_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;
end $$;

-- 既存の関数がそのまま残っていること(総合・イベントを壊していない)
do $$
begin
  if to_regprocedure('public.rhythm_event_song_bests(text[], timestamptz, timestamptz)') is null
     or to_regprocedure('public.rhythm_event_totals(text[], timestamptz, timestamptz)') is null then
    raise exception 'イベントの関数が消えています(残っていないといけません)';
  end if;
end $$;

-- 計算が合っているか
do $$
declare
  win_start timestamptz;
  win_end   timestamptz;
  raw_sum   bigint;
  fn_sum    bigint;
  raw_rows  int;
  fn_rows   int;
begin
  select week_start, week_end into win_start, win_end from public.rhythm_week_window;

  -- 累計の合計と件数が、元の記録をそのまま足したものと一致すること
  select coalesce(sum(s.score), 0)::bigint, count(*)::int into raw_sum, raw_rows
    from public.rhythm_identified_scores s
   where s.created_at >= win_start and s.created_at < win_end
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x where x.song_id = s.song_id);

  select coalesce(sum(t.total_score), 0)::bigint, coalesce(sum(t.play_count), 0)::int into fn_sum, fn_rows
    from public.rhythm_week_score_totals(win_start, win_end) t;

  if raw_sum <> fn_sum then
    raise exception '累計スコアが元の記録と合いません(元 % / 関数 %)', raw_sum, fn_sum;
  end if;
  if raw_rows <> fn_rows then
    raise exception 'プレイ回数が元の記録と合いません(元 % / 関数 %)', raw_rows, fn_rows;
  end if;

  -- 累計はベスト合算以上になるはず(同じ曲を2回以上遊んだ人がいれば必ず大きい)
  if exists (
    select 1 from public.rhythm_week_score_totals(win_start, win_end) t
     where t.total_score < 0 or t.play_count < 1 or t.song_count < 1
  ) then
    raise exception '累計・回数・曲数に負の値か0の行があります';
  end if;
end $$;

-- ★プレイヤーと同じ立場(anon)で本当に読めるか。
do $$
declare
  as_owner int;
  as_anon  int;
  win_start timestamptz;
  win_end   timestamptz;
begin
  select week_start, week_end into win_start, win_end from public.rhythm_week_window;
  select count(*) into as_owner from public.rhythm_week_score_totals(win_start, win_end);
  execute 'set local role anon';
  select count(*) into as_anon from public.rhythm_week_score_totals(win_start, win_end);
  execute 'reset role';
  if as_owner > 0 and as_anon = 0 then
    raise exception 'anon から週間ランキングが読めません(管理者では%件)', as_owner;
  end if;
end $$;

-- 結果を1つの表にまとめて出す(Supabase の SQL Editor は最後の1文しか表示しないため)。
with win as (select week_start, week_end from public.rhythm_week_window),
     wk as (select t.* from win, lateral public.rhythm_week_score_totals(win.week_start, win.week_end) t),
     bests as (select b.* from win,
                 lateral public.rhythm_event_totals(
                   (select coalesce(array_agg(distinct song_id), '{}') from public.rhythm_identified_scores),
                   win.week_start, win.week_end) b),
facts as (
  select 1::numeric as sort, '足した関数' as item,
         (select coalesce(string_agg(p.proname, ', '), 'なし')
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='rhythm_week_score_totals') as value
  union all
  select 2, 'アプリ(anon)から実行できる',
         (select coalesce(string_agg(distinct grantee, ', '), 'なし')
            from information_schema.role_routine_grants
           where specific_schema='public' and routine_name='rhythm_week_score_totals'
             and grantee in ('anon','authenticated'))
  union all
  select 3, '今週の始まり(JST)',
         (select to_char(week_start at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') from win)
  union all
  select 4, '今週の終わり(JST)',
         (select to_char(week_end at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') from win)
  union all
  select 5, '今週の週間に載る人数', (select count(*)::text from wk)
  union all
  select 6, '今週のプレイ回数(のべ)', (select coalesce(sum(play_count), 0)::text from wk)
  union all
  select 7, '累計が元の記録と一致する',
         (select case when (select coalesce(sum(total_score),0) from wk)
                         = (select coalesce(sum(s.score),0) from public.rhythm_identified_scores s, win
                             where s.created_at >= win.week_start and s.created_at < win.week_end
                               and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                                                where x.song_id = s.song_id))
                      then 'はい' else 'いいえ' end)
  union all
  select 8, '週間の1位(累計)',
         (select coalesce(user_name || ' … ' || total_score || '点（' || play_count || '回 / '
                          || song_count || '曲）', 'まだありません')
            from wk order by total_score desc, last_scored_at asc limit 1)
  union all
  select 9, '参考: ベスト合算だったときの1位',
         (select coalesce(user_name || ' … ' || total_score || '点', 'まだありません')
            from bests order by total_score desc, last_scored_at asc limit 1)
  union all
  select 10, '3回以上遊んだ人(参加報酬の対象)',
         (select count(*)::text from wk where play_count >= 3)
  union all
  select 11, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しい関数を認識させる。
-- これを忘れると、しばらくの間アプリから週間ランキングが読めない
-- (アプリは「準備中」と出すので画面は壊れない)。
notify pgrst, 'reload schema';
