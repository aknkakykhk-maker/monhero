-- マスモンランキング用テーブルの適用後の確認(読み取り専用。何も変更しない)。
with facts as (
  select 1 as sort, 'テーブル' as item,
         (select count(*)::text from information_schema.tables
          where table_schema='public' and table_name='rhythm_buddy_ranks') as value
  union all
  select 2, '主キー',
         (select coalesce(string_agg(pg_get_constraintdef(c.oid), ' / '), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rhythm_buddy_ranks' and c.contype='p')
  union all
  select 3, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rhythm_buddy_ranks')
  union all
  select 4, 'ポリシー(select/insert/updateの3つ)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='rhythm_buddy_ranks')
  union all
  select 5, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='rhythm_buddy_ranks'
            and grantee in ('anon','authenticated'))
  union all
  select 6, 'rhythm_buddy_ranks の件数', (select count(*)::text from public.rhythm_buddy_ranks)
  union all
  select 7, 'ビートLv上位5件',
         (select coalesce(string_agg(user_name||'/'||coalesce(mon_name,'?')||' Lv.'||beat_level, ' , ' order by beat_level desc, beat_exp desc), 'まだ無し')
          from (select * from public.rhythm_buddy_ranks order by beat_level desc, beat_exp desc limit 5) t)
  union all
  select 8, 'rankings の件数', (select count(*)::text from public.rankings)
  union all
  select 9, 'bond_levels の件数', (select count(*)::text from public.bond_levels)
)
select item as "項目", value as "値" from facts order by sort;
