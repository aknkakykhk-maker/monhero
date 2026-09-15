-- public.bond_levels の profile_frame 列が正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- PROFILE_FRAME_BOND_APPLY.sql の後と、しばらく遊んだあとに実行する。

with facts as (
  select 1 as sort, 'profile_frame 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='profile_frame')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels'
            and c.conname = 'bond_levels_profile_frame_shape')
  union all
  select 3, 'bond_levels の総件数',
         (select count(*)::text from public.bond_levels)
  union all
  select 4, 'profile_frame が入っている記録(フレームを選んだ人のプレイ)',
         (select count(*)::text from public.bond_levels where profile_frame is not null)
  union all
  select 5, '入っているフレームの内訳',
         (select coalesce(string_agg(profile_frame || '×' || n::text, ', ' order by n desc), 'まだ無し')
          from (select profile_frame, count(*) as n from public.bond_levels
                 where profile_frame is not null group by profile_frame) t)
  union all
  select 6, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
)
select item as "項目", value as "値" from facts order by sort;
