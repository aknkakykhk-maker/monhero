-- public.rankings の breeder_id 列が正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- BREEDER_ID_APPLY.sql の後と、アプリを公開してしばらく経ったあとに実行する。
-- 「IDの付いた記録が増えているか」がここで分かる。

with facts as (
  select 1 as sort, 'breeder_id 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='breeder_id')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rankings'
            and c.conname = 'rankings_breeder_id_shape')
  union all
  select 3, 'rankings の総件数',
         (select count(*)::text from public.rankings)
  union all
  select 4, 'モンビーの記録(Rhythm-)',
         (select count(*)::text from public.rankings where difficulty like 'Rhythm-%')
  union all
  select 5, 'そのうち breeder_id が入っている記録',
         (select count(*)::text from public.rankings
           where difficulty like 'Rhythm-%' and breeder_id is not null)
  union all
  -- 公開直後は0件で正しい。日が経っても0のままなら、アプリ側が送れていない
  select 6, '直近7日のモンビーの記録',
         (select count(*)::text from public.rankings
           where difficulty like 'Rhythm-%' and created_at >= now() - interval '7 days')
  union all
  select 7, 'そのうち breeder_id が入っている記録',
         (select count(*)::text from public.rankings
           where difficulty like 'Rhythm-%' and created_at >= now() - interval '7 days'
             and breeder_id is not null)
  union all
  -- 同じ名前に複数のIDがある＝同名の別人がいる。その名前だけは、IDの無い古い記録を
  -- どちらのものとも決められない(docs/spec/RHYTHM_RANKING.md §4.4)
  select 8, '同名で複数のIDが観測されている名前',
         (select coalesce(string_agg(user_name, ', ' order by user_name), 'なし')
            from (select user_name from public.rankings
                   where difficulty like 'Rhythm-%' and breeder_id is not null
                   group by user_name having count(distinct breeder_id) > 1) t)
  union all
  select 9, 'RLS(有効であること)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rankings')
  union all
  select 10, '権限',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='rankings'
            and grantee in ('anon','authenticated'))
)
select item as "項目", value as "値" from facts order by sort;
