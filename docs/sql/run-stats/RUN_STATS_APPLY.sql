-- public.rankings へ turns / reached_wave の2列を追加するSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 既存の行・列・RLS・ポリシー・権限は変更しない(DROP・DELETE・UPDATEをしない)。
-- 足すのはNULL許容の列2つだけなので、既存の記録はすべてNULLのまま残る。
-- 先に RUN_STATS_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。

begin;

-- 短時間だけDDLと競合する書き込みを止め、検査から列追加までの競合を防ぐ。
lock table public.rankings in share row exclusive mode;

-- 適用前の状態を控える。この作業では中身も権限も変えないので、
-- 最後に「件数もRLSもポリシーも権限も変わっていない」ことを機械的に確かめる。
create temporary table run_stats_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table run_stats_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table run_stats_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table run_stats_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

-- 既に同名の列が別の型である環境では、作り替えず安全側で停止する。
do $$
declare
  turns_type text;
  wave_type text;
begin
  select data_type into turns_type from information_schema.columns
  where table_schema = 'public' and table_name = 'rankings' and column_name = 'turns';
  select data_type into wave_type from information_schema.columns
  where table_schema = 'public' and table_name = 'rankings' and column_name = 'reached_wave';
  if turns_type is not null and turns_type <> 'integer' then
    raise exception 'public.rankings.turns が別の型(%)で既に存在します。内容を確認してから再実行してください', turns_type;
  end if;
  if wave_type is not null and wave_type <> 'integer' then
    raise exception 'public.rankings.reached_wave が別の型(%)で既に存在します。内容を確認してから再実行してください', wave_type;
  end if;
end $$;

-- クリアしたときにかかった累計ターン数。クリアしていない周回はNULLのまま。
-- 途中で終わった周回は「倒しきっていないWAVEのターン」が入らないため、
-- クリアの記録と同じ列へ並べると少ないターンで終えたように見えてしまう。だから入れない。
alter table public.rankings add column if not exists turns integer;
-- その周回がどのWAVEで終わったか。クリアは10、途中で終わった周回は最後に挑んでいたWAVE。
alter table public.rankings add column if not exists reached_wave integer;

comment on column public.rankings.turns is
  'クリアした周回でかかった累計ターン数。クリアしていない周回はNULL。';
comment on column public.rankings.reached_wave is
  'その周回がどのWAVEで終わったか。クリアは10。列を足す前の記録はNULL。';

-- 明らかにありえない値を弾く。既存行はすべてNULLなので、この制約に引っかかる行は無い
-- (WAVEは最大10、1WAVEは最大20ターンなので累計は200を超えない)。
do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'rankings'
                   and c.conname = 'rankings_turns_range') then
    alter table public.rankings add constraint rankings_turns_range
      check (turns is null or (turns > 0 and turns <= 1000));
  end if;
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'rankings'
                   and c.conname = 'rankings_reached_wave_range') then
    alter table public.rankings add constraint rankings_reached_wave_range
      check (reached_wave is null or (reached_wave > 0 and reached_wave <= 100));
  end if;
end $$;

-- ここから先は「既存の中身と権限に触っていないこと」の検査。1つでも違えば例外で止まる。
do $$
begin
  if (select row_count from run_stats_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from run_stats_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from run_stats_security_before)
  ) then raise exception 'rankings のRLS状態が変化しました'; end if;

  if exists (
    (select * from run_stats_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from run_stats_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from run_stats_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from run_stats_grants_before)
  ) then raise exception 'rankings のData API権限が変化しました'; end if;

  -- 新しい列にも既存と同じ権限が要る。Supabaseはテーブル単位の権限を引き継ぐが、
  -- 列単位の権限が設定されている環境では引き継がれないため、ここで確かめる
  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'rankings'
      and grantee = 'anon' and privilege_type = 'INSERT'
  ) then raise exception 'anon が rankings へINSERTできません'; end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
-- Supabase の SQL Editor はファイル全体を実行すると「最後の1文」の結果しか出さないため、
-- 見たい項目を縦に並べた1文にしてある。
with facts as (
  select 1 as sort, 'turns 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='turns')
         || ' (integer / YES なら正しい)' as value
  union all
  select 2, 'reached_wave 列',
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='reached_wave')
         || ' (integer / YES なら正しい)'
  union all
  select 3, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rankings'
            and c.conname in ('rankings_turns_range','rankings_reached_wave_range'))
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
  select 8, 'ターン数が入っている記録(適用直後は0)',
         (select count(*)::text from public.rankings where turns is not null)
  union all
  select 9, '到達WAVEが入っている記録(適用直後は0)',
         (select count(*)::text from public.rankings where reached_wave is not null)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しい列を認識させる。
-- これを忘れると、しばらくの間アプリから turns / reached_wave が見えないことがある。
notify pgrst, 'reload schema';
