-- モンビー(モンヒロビート)の「週間ランキング」用の期間の窓と集計関数を作るSQL。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(RHYTHM_EVENT_APPLY.sql)の前にこちらを通す。
--
-- 既存の public.rankings の行・列・RLS・ポリシー・権限は変更しない
-- (DROP・DELETE・UPDATE・ALTERをしない)。足すのは次だけ。
--
--   ・読み取り専用のビュー1枚(rhythm_week_window。今週の始まりと終わり)
--   ・読み取り専用の関数2つ(rhythm_event_song_bests / rhythm_event_totals)
--   ・rankings のRhythm行だけを見る部分索引1つ(期間で絞るため)
--
-- ★先に RHYTHM_TOTAL_APPLY.sql を適用しておくこと。ここで作る関数は、そちらで作った
--   public.rhythm_identified_scores(人の単位を付けた記録)の上に乗る。
-- ★これをエラー無く通してから、末尾が commit; の RHYTHM_EVENT_APPLY.sql を実行する。
-- 仕様は docs/spec/RHYTHM_RANKING.md §6(週間)・§7(イベント)・§8.4(この設計)。

begin;

-- security_invoker はPostgreSQL 15から。これより古い環境では、ビューが
-- rankings のRLSをすり抜けて読んでしまうため、作らずに止める。
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'PostgreSQL 15以上が必要です(security_invoker)。いまのバージョン: %', current_setting('server_version');
  end if;
end $$;

-- 土台(フェーズ2で作ったビュー)が無ければ、ここで止める。
-- 無いまま作ると、関数だけができて中身がいつまでも空になる。
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v' and c.relname = 'rhythm_identified_scores') then
    raise exception 'public.rhythm_identified_scores がありません。先に RHYTHM_TOTAL_APPLY.sql を適用してください';
  end if;
end $$;

-- 適用前の状態を控える。rankings は一切変えないので、最後に
-- 「件数もRLSもポリシーも権限も変わっていない」ことを機械的に確かめる。
create temporary table rhythm_event_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table rhythm_event_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table rhythm_event_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table rhythm_event_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

-- 同じ名前の「テーブル」が既にある環境では、ビューを作れず取り違えも起きるので止める。
do $$
declare
  conflicting text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into conflicting
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p', 'f')
     and c.relname in ('rhythm_week_window');
  if conflicting is not null then
    raise exception 'ビューと同じ名前のテーブルが既にあります: %', conflicting;
  end if;
end $$;

-- ===== ① 今週の始まりと終わり(月曜 5:00 JST 区切り) =====
-- 期間の正本はここ。端末の時計を進めても週は変わらない(docs/spec/RHYTHM_RANKING.md §6.1)。
-- date_trunc('week', …) は月曜始まりなので、5時間ずらしてから戻すだけで「月曜5:00 JST」になる。
create or replace view public.rhythm_week_window
with (security_invoker = on) as
select ws.week_start,
       ws.week_start + interval '7 days' as week_end
  from (select ((date_trunc('week', (now() at time zone 'Asia/Tokyo') - interval '5 hours')
                 + interval '5 hours') at time zone 'Asia/Tokyo') as week_start) ws;

comment on view public.rhythm_week_window is
  '週間ランキングの今週の始まり・終わり(毎週月曜5:00 JST区切り)。期間の正本。';

-- ===== ② 期間×対象曲の「曲ごとベスト」 =====
-- 期間と対象曲をパラメータで受ける。どの曲を対象にするかはアプリ側の静的データが決めるので、
-- イベントを差し替えてもこのSQLは触らない(§6.4)。対象曲は配列なので3曲でも5曲でも足りる。
-- ★列の型は明示的にそろえる。rankings 側の型が違っても「戻り値の型が合わない」で落ちないように。
create or replace function public.rhythm_event_song_bests(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select distinct on (s.identity_key, s.song_id)
         s.identity_key::text, s.user_name::text, s.song_id::text, s.difficulty_id::text,
         s.score::integer, s.created_at, s.level::integer, s.icon::text
    from public.rhythm_identified_scores s
   where s.song_id = any(song_ids)
     and s.created_at >= from_at and s.created_at < to_at
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;
$$;

comment on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz) is
  '期間×対象曲の、人×曲ごとの最高スコア1件(難易度は問わない)。週間・イベントの土台。';

-- ===== ③ 期間×対象曲の「総合」 =====
-- 対象曲それぞれのその期間のベストを単純合算したもの(§6.3)。
-- 対象曲のうち1曲しか遊んでいない人も載る(残りは0点として扱う)。
create or replace function public.rhythm_event_totals(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, total_score bigint, song_count integer,
              last_scored_at timestamptz, level integer, icon text)
language sql stable security invoker as $$
  select b.identity_key,
         (array_agg(b.user_name order by b.scored_at desc))[1],
         sum(b.score)::bigint,
         count(*)::integer,
         max(b.scored_at),
         (array_agg(b.level order by b.scored_at desc))[1],
         (array_agg(b.icon  order by b.scored_at desc))[1]
    from public.rhythm_event_song_bests(song_ids, from_at, to_at) b
   group by b.identity_key;
$$;

comment on function public.rhythm_event_totals(text[], timestamptz, timestamptz) is
  '期間×対象曲の総合ランキング。対象曲それぞれのベストを足し合わせた合計。';

-- ===== 索引 =====
-- 週間は期間で絞るので、Rhythm行だけを時刻順に見る部分索引を足す。既存の索引は触らない。
-- (2026-07に「記録が増えて実機で8秒待っても返らない」障害を出しているため・§8.6)
create index if not exists rankings_rhythm_created_at_idx
  on public.rankings (created_at desc)
  where difficulty like 'Rhythm-%';

-- ===== 権限 =====
-- 読むだけ。書き込みは一切与えない。
grant select   on public.rhythm_week_window to anon, authenticated;
grant execute  on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz) to anon, authenticated;
grant execute  on function public.rhythm_event_totals(text[], timestamptz, timestamptz)     to anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====

-- 既存の rankings に触っていないこと
do $$
begin
  if (select row_count from rhythm_event_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from rhythm_event_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from rhythm_event_security_before)
  ) then raise exception 'rankings のRLS状態が変化しました'; end if;

  if exists (
    (select * from rhythm_event_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from rhythm_event_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from rhythm_event_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from rhythm_event_grants_before)
  ) then raise exception 'rankings のData API権限が変化しました'; end if;
end $$;

-- 週の区切りが本当に「月曜 5:00 JST」になっているか。
-- ここを間違えると、誰の記録がどの週に入るかが静かにずれる。
do $$
declare
  start_jst timestamp;
  span      interval;
begin
  select (week_start at time zone 'Asia/Tokyo'), (week_end - week_start)
    into start_jst, span
    from public.rhythm_week_window;

  if extract(isodow from start_jst) <> 1 then
    raise exception '週の始まりが月曜になっていません: %', start_jst;
  end if;
  if extract(hour from start_jst) <> 5 or extract(minute from start_jst) <> 0
     or extract(second from start_jst) <> 0 then
    raise exception '週の始まりが5:00になっていません: %', start_jst;
  end if;
  if span <> interval '7 days' then
    raise exception '週の長さが7日ではありません: %', span;
  end if;
  if (select now() < week_start or now() >= week_end from public.rhythm_week_window) then
    raise exception 'いまの時刻が今週の窓の中に入っていません';
  end if;
end $$;

-- ★プレイヤーと同じ立場(anon)で本当に読めるか。
-- security_invoker / security invoker は rankings のRLSをそのまま通すので、SELECTのポリシーが
-- 無ければ「管理画面では見えるのにアプリでは空」になる。ここで必ず捕まえる。
do $$
declare
  as_owner int;
  as_anon  int;
  win_start timestamptz;
  win_end   timestamptz;
  songs     text[];
begin
  select week_start, week_end into win_start, win_end from public.rhythm_week_window;
  -- 対象曲はアプリ側が決めるものなので、ここでは「記録のある曲を最大3つ」で試すだけにする
  select coalesce(array_agg(song_id), '{}') into songs
    from (select distinct song_id from public.rhythm_identified_scores limit 3) t;

  select count(*) into as_owner from public.rhythm_event_totals(songs, win_start, win_end);

  execute 'set local role anon';
  select count(*) into as_anon from public.rhythm_event_totals(songs, win_start, win_end);
  execute 'reset role';

  if as_owner > 0 and as_anon = 0 then
    raise exception 'anon から週間ランキングが読めません(管理者では%件)。rankings のSELECTポリシーを確認してください', as_owner;
  end if;
  if as_owner <> as_anon then
    raise warning 'anon から見える人数(%)と管理者から見える人数(%)が違います', as_anon, as_owner;
  end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
-- Supabase の SQL Editor はファイル全体を実行すると「最後の1文」の結果しか出さないため。
with win as (select week_start, week_end from public.rhythm_week_window),
     sample as (select coalesce(array_agg(song_id), '{}') as song_ids
                  from (select distinct song_id from public.rhythm_identified_scores limit 3) t),
facts as (
  select 1 as sort, '今週の始まり(JST)' as item,
         (select to_char(week_start at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') from win) as value
  union all
  select 2, '今週の終わり(JST)',
         (select to_char(week_end at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') from win)
  union all
  select 3, '作ったビュー',
         (select coalesce(string_agg(c.relname, ', ' order by c.relname), 'なし')
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v' and c.relname in ('rhythm_week_window'))
  union all
  select 4, 'RLSをすり抜けない設定(on であること)',
         (select coalesce(string_agg(c.relname || '=' ||
                   case when exists (select 1 from unnest(coalesce(c.reloptions, '{}')) o
                                      where split_part(o, '=', 1) = 'security_invoker'
                                        and lower(split_part(o, '=', 2)) in ('on','true'))
                        then 'on' else 'off' end, ', '), 'なし')
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v' and c.relname in ('rhythm_week_window'))
  union all
  select 5, '作った関数',
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('rhythm_event_song_bests','rhythm_event_totals'))
  union all
  select 6, '足した索引',
         (select coalesce(string_agg(i.relname, ', ' order by i.relname), 'なし')
            from pg_class t join pg_namespace n on n.oid=t.relnamespace
            join pg_index ix on ix.indrelid=t.oid
            join pg_class i on i.oid=ix.indexrelid
           where n.nspname='public' and t.relname='rankings'
             and i.relname in ('rankings_rhythm_created_at_idx'))
  union all
  select 7, '今週のモンビーの記録(件)',
         (select count(*)::text from public.rhythm_identified_scores s, win
           where s.created_at >= win.week_start and s.created_at < win.week_end)
  union all
  select 8, '試しの3曲(記録のある曲から)',
         (select coalesce(array_to_string(song_ids, ', '), 'なし') from sample)
  union all
  select 9, 'その3曲の今週の総合に載る人数',
         (select count(*)::text from public.rhythm_event_totals((select song_ids from sample),
                                                                (select week_start from win),
                                                                (select week_end from win)))
  union all
  select 10, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
  union all
  select 11, 'rankings のRLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname='rankings')
  union all
  select 12, 'rankings の権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
            from information_schema.role_table_grants
           where table_schema='public' and table_name='rankings'
             and grantee in ('anon','authenticated'))
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
