-- public.bond_levels へ breeder_id 列を1つ追加するSQLの【予行演習】。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(BOND_LEVELS_BREEDER_ID_APPLY.sql)の前にこちらを通す。
--
-- 既存の行・列・主キー・RLS・ポリシー・権限は変更しない(DROP・DELETE・UPDATEをしない)。
-- 足すのはNULL許容の列1つと索引1つだけなので、既存の記録はすべてNULLのまま残る。
-- これをエラー無く通してから BOND_LEVELS_BREEDER_ID_APPLY.sql(末尾 commit;)を実行する。
--
-- なぜ足すのか:
--   bond_levels は主キーが (user_name, individual_id) ＝「名前 × 個体」で1行という作りで、
--   人を見分ける手がかりが名前しか無かった。そのため
--     ・名前を変えると、同じマスモンが古い名前と新しい名前の2行に分かれて一覧に並ぶ
--     ・同じ名前の人が複数いると、どれが誰か決められない
--   という状態だった(2026-09-16・ユーザー指摘「名前管理はさすがにだめだろ」)。
--   rankings には既に breeder_id があるので、こちらにも同じ列を足して
--   「表示は必ずIDで見分ける」ようにする。
--
-- ★主キーは変えない。 (user_name, individual_id) のまま。
--   既存の行はそのまま残り、これまでのupsertも今までどおり動く。
--   改名して増えてしまった古い行は、**画面側がIDでまとめて1行に見せる**。
--   行を消すのは危険なので、消さない(CLAUDE.md ⑦)。
--
-- 先に必要なSQL: BOND_LEVELS_APPLY.sql(テーブルそのもの)
--
-- アプリ側はこのSQLを当てる前でも壊れない。列が無い間は
--   ・送るとき … breeder_id を外して送り直す(絆Lvの記録は必ず残る)
--   ・出すとき … breeder_id を外して取り直す(今までどおり名前で見分けるだけ)
-- ので、SQLの適用とアプリの公開はどちらが先でもよい(26-supabase.jsx)。

begin;

do $$
begin
  if to_regclass('public.bond_levels') is null then
    raise exception 'public.bond_levels がありません。先に BOND_LEVELS_APPLY.sql を適用してください。';
  end if;
end $$;

-- 短時間だけDDLと競合する書き込みを止める。
lock table public.bond_levels in share row exclusive mode;

-- 適用前の状態を控える。中身も権限も主キーも変えないので、最後に機械的に確かめる。
create temporary table bond_bid_count_before on commit drop as
select count(*) as row_count from public.bond_levels;

create temporary table bond_bid_pkey_before on commit drop as
select a.attname
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
where n.nspname = 'public' and t.relname = 'bond_levels' and c.contype = 'p';

create temporary table bond_bid_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'bond_levels';

create temporary table bond_bid_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'bond_levels';

create temporary table bond_bid_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'bond_levels'
  and grantee in ('anon', 'authenticated');

-- 既に同名の列が別の型である環境では、作り替えず安全側で停止する。
do $$
declare
  id_type text;
begin
  select data_type into id_type from information_schema.columns
  where table_schema = 'public' and table_name = 'bond_levels' and column_name = 'breeder_id';
  if id_type is not null and id_type <> 'text' then
    raise exception 'public.bond_levels.breeder_id が別の型(%)で既に存在します。内容を確認してから再実行してください', id_type;
  end if;
end $$;

-- 列を1つ足す。足す前の記録はNULLのままで、あとから埋めない
-- (誰のものか分かる印が無いため。NULLの行は今までどおり名前で見分ける)。
alter table public.bond_levels add column if not exists breeder_id text;

comment on column public.bond_levels.breeder_id is
  '端末ごとに1回だけ作るブリーダーID(mh_breeder_id_v1)。rankings.breeder_id と同じ値。NULL = IDが無かった時代の記録。表示で人を見分けるためだけに使い、順位や集計には影響しない。';

-- 明らかにありえない値を弾く。rankings / breeder_profiles と同じ形にそろえる。
do $$
begin
  if not exists (select 1 from pg_constraint c
                 join pg_class t on t.oid = c.conrelid
                 join pg_namespace n on n.oid = t.relnamespace
                 where n.nspname = 'public' and t.relname = 'bond_levels'
                   and c.conname = 'bond_levels_breeder_id_shape') then
    alter table public.bond_levels add constraint bond_levels_breeder_id_shape
      check (breeder_id is null or (length(breeder_id) between 1 and 100));
  end if;
end $$;

-- 「同じ人の同じ個体」をまとめて引くための索引。
-- ★unique にはしない。改名して2行になっている人が既にいる可能性があり、
--   unique を付けると適用そのものが失敗する(既存データを壊しにいかない)。
create index if not exists bond_levels_breeder_idx
  on public.bond_levels (breeder_id, individual_id);

-- ===== ここから先は「既存の中身・主キー・権限に触っていないこと」の検査 =====
do $$
begin
  if (select row_count from bond_bid_count_before)
     <> (select count(*) from public.bond_levels) then
    raise exception 'bond_levels の件数が変化しました';
  end if;

  if exists (
    (select * from bond_bid_pkey_before except
     select a.attname from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     join unnest(c.conkey) k(attnum) on true
     join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
     where n.nspname = 'public' and t.relname = 'bond_levels' and c.contype = 'p')
    union all
    (select a.attname from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     join unnest(c.conkey) k(attnum) on true
     join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
     where n.nspname = 'public' and t.relname = 'bond_levels' and c.contype = 'p'
     except select * from bond_bid_pkey_before)
  ) then raise exception 'bond_levels の主キーが変化しました'; end if;

  if exists (
    (select * from bond_bid_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'bond_levels')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'bond_levels'
     except select * from bond_bid_security_before)
  ) then raise exception 'bond_levels のRLS状態が変化しました'; end if;

  if exists (
    (select * from bond_bid_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'bond_levels')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'bond_levels'
     except select * from bond_bid_policies_before)
  ) then raise exception 'bond_levels のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from bond_bid_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bond_levels'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bond_levels'
       and grantee in ('anon', 'authenticated')
     except select * from bond_bid_grants_before)
  ) then raise exception 'bond_levels のData API権限が変化しました'; end if;

  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'bond_levels'
      and grantee = 'anon' and privilege_type = 'INSERT'
  ) then raise exception 'anon が bond_levels へINSERTできません'; end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bond_levels' and column_name='breeder_id') then
    raise exception 'bond_levels.breeder_id が作られていません';
  end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
with facts as (
  select 1 as sort, 'breeder_id 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='breeder_id')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels'
            and c.conname = 'bond_levels_breeder_id_shape')
  union all
  select 3, '索引',
         (select coalesce(string_agg(indexname, ', ' order by indexname), 'なし')
          from pg_indexes where schemaname='public' and tablename='bond_levels'
            and indexname = 'bond_levels_breeder_idx')
  union all
  select 4, '主キー(変わっていないこと)',
         (select coalesce(string_agg(a.attname, ', ' order by a.attname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum
          where n.nspname='public' and t.relname='bond_levels' and c.contype='p')
  union all
  select 5, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
  union all
  select 6, '権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='bond_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 7, 'bond_levels の件数(適用前と同じであること)',
         (select count(*)::text from public.bond_levels)
  union all
  select 8, 'breeder_id が入っている記録(初回の適用直後は0)',
         (select count(*)::text from public.bond_levels where breeder_id is not null)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
