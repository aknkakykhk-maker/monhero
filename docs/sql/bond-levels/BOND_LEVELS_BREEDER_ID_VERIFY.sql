-- public.bond_levels の breeder_id 列が正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- BOND_LEVELS_BREEDER_ID_APPLY.sql の後と、しばらく遊んだあとに実行する。

with facts as (
  select 1 as sort, 'breeder_id 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='breeder_id')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '索引',
         (select coalesce(string_agg(indexname, ', ' order by indexname), 'なし')
          from pg_indexes where schemaname='public' and tablename='bond_levels'
            and indexname = 'bond_levels_breeder_idx')
  union all
  select 3, '主キー(変わっていないこと)',
         (select coalesce(string_agg(a.attname, ', ' order by a.attname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum
          where n.nspname='public' and t.relname='bond_levels' and c.contype='p')
  union all
  select 4, 'bond_levels の総件数',
         (select count(*)::text from public.bond_levels)
  union all
  select 5, 'IDが入っている記録(遊ぶたびに増える)',
         (select count(*)::text from public.bond_levels where breeder_id is not null)
  union all
  select 6, 'IDがまだ無い記録(名前で見分ける行)',
         (select count(*)::text from public.bond_levels where breeder_id is null)
  union all
  select 7, '改名で2行になっている人(同じID×同じ個体が2行以上)',
         (select coalesce(string_agg(names, ' / ' order by names), 'なし')
          from (select string_agg(distinct user_name, '→') as names
                from public.bond_levels
                where breeder_id is not null
                group by breeder_id, individual_id
                having count(*) > 1) t)
  union all
  select 8, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
)
select item as "項目", value as "値" from facts order by sort;
