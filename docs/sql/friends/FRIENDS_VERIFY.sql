-- フレンド機能のテーブルが正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。 本番変更が残るか: いいえ。

with facts as (
  select 1 as sort, 'friend_codes テーブル' as item,
         (select case when to_regclass('public.friend_codes') is null then 'なし' else 'あり' end) as value
  union all
  select 2, 'friend_links / friend_invites テーブル',
         (select (case when to_regclass('public.friend_links') is null then 'なし' else 'あり' end)
              ||' / '||(case when to_regclass('public.friend_invites') is null then 'なし' else 'あり' end))
  union all
  select 3, 'RLS(3つとも有効なら 3)',
         (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname in ('friend_codes','friend_links','friend_invites') and c.relrowsecurity)
  union all
  select 4, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct table_name||':'||grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name in ('friend_codes','friend_links','friend_invites')
            and grantee in ('anon','authenticated'))
  union all
  select 5, 'フレンドコードを持つ人の数',
         (select count(*)::text from public.friend_codes)
  union all
  select 6, '関係の内訳(status×件数)',
         (select coalesce(string_agg(status||'×'||n::text, ', ' order by n desc), 'まだ無し')
          from (select status, count(*) as n from public.friend_links group by status) t)
  union all
  select 7, '招待の件数(上書きされるので、人数の組み合わせ以上には増えない)',
         (select count(*)::text from public.friend_invites)
  union all
  select 8, 'breeder_profiles の件数(触っていないこと)',
         (select count(*)::text from public.breeder_profiles)
  union all
  select 9, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;
