-- public.breeder_levels が正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。 本番変更が残るか: いいえ。

with facts as (
  select 1 as sort, 'breeder_levels テーブル' as item,
         (select case when to_regclass('public.breeder_levels') is null then 'なし' else 'あり' end) as value
  union all
  select 2, '列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='breeder_levels')
  union all
  select 3, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='breeder_levels')
  union all
  select 4, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='breeder_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 5, '登録されているブリーダー数',
         (select count(*)::text from public.breeder_levels)
  union all
  select 6, 'いちばん高いLv',
         (select coalesce(max(level)::text, 'まだ無し') from public.breeder_levels)
  union all
  select 7, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;
