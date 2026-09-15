-- public.breeder_profiles が正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。 本番変更が残るか: いいえ。

with facts as (
  select 1 as sort, 'breeder_profiles テーブル' as item,
         (select case when to_regclass('public.breeder_profiles') is null then 'なし' else 'あり' end) as value
  union all
  select 2, '列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='breeder_profiles')
  union all
  select 3, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='breeder_profiles')
  union all
  select 4, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='breeder_profiles'
            and grantee in ('anon','authenticated'))
  union all
  select 5, '登録されているブリーダー数',
         (select count(*)::text from public.breeder_profiles)
  union all
  select 6, 'フレームを選んでいる人',
         (select count(*)::text from public.breeder_profiles where profile_frame is not null)
  union all
  select 7, '選ばれているフレームの内訳',
         (select coalesce(string_agg(profile_frame||'×'||n::text, ', ' order by n desc), 'まだ無し')
          from (select profile_frame, count(*) as n from public.breeder_profiles
                 where profile_frame is not null group by profile_frame) t)
  union all
  select 8, '同じ名前が2人以上いる名前(その人たちは記録の見た目のまま出ます)',
         (select coalesce(string_agg(user_name||'×'||n::text, ', ' order by n desc), 'なし')
          from (select user_name, count(*) as n from public.breeder_profiles
                 where user_name is not null group by user_name having count(*) > 1) t)
  union all
  select 9, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;
