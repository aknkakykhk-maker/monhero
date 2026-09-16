-- PROFILE_LOOK_ALL_APPLY.sql が正しく入っているかを、①②まとめて見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- 適用の直後と、しばらく遊んだあとに実行する。

with facts as (
  select 1 as sort, '① bond_levels.profile_frame 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='profile_frame')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '① bond_levels の検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='bond_levels'
            and c.conname = 'bond_levels_profile_frame_shape')
  union all
  select 3, '① bond_levels の総件数',
         (select count(*)::text from public.bond_levels)
  union all
  select 4, '① フレーム入りの絆Lv記録',
         (select count(*)::text from public.bond_levels where profile_frame is not null)
  union all
  select 5, '① 入っているフレームの内訳',
         (select coalesce(string_agg(profile_frame || '×' || n::text, ', ' order by n desc), 'まだ無し')
          from (select profile_frame, count(*) as n from public.bond_levels
                 where profile_frame is not null group by profile_frame) t)
  union all
  select 6, '① bond_levels のRLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='bond_levels')
  union all
  select 7, '② breeder_profiles テーブル',
         (select case when to_regclass('public.breeder_profiles') is null then 'なし' else 'あり' end)
  union all
  select 8, '② breeder_profiles の列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='breeder_profiles')
  union all
  select 9, '② breeder_profiles のRLS',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='breeder_profiles')
  union all
  select 10, '② breeder_profiles の権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='breeder_profiles'
            and grantee in ('anon','authenticated'))
  union all
  select 11, '② 登録されているブリーダー数',
         (select count(*)::text from public.breeder_profiles)
  union all
  select 12, '② フレームを選んでいる人',
         (select count(*)::text from public.breeder_profiles where profile_frame is not null)
  union all
  select 13, '② 選ばれているフレームの内訳',
         (select coalesce(string_agg(profile_frame||'×'||n::text, ', ' order by n desc), 'まだ無し')
          from (select profile_frame, count(*) as n from public.breeder_profiles
                 where profile_frame is not null group by profile_frame) t)
  union all
  select 14, '② 同じ名前が2人以上いる名前(その人たちは記録の見た目のまま出ます)',
         (select coalesce(string_agg(user_name||'×'||n::text, ', ' order by n desc), 'なし')
          from (select user_name, count(*) as n from public.breeder_profiles
                 where user_name is not null group by user_name having count(*) > 1) t)
  union all
  select 15, '③ bond_levels.breeder_id 列',
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='bond_levels' and column_name='breeder_id')
         || ' (text / YES なら正しい)'
  union all
  select 16, '③ IDが入っている絆Lvの記録(遊ぶたびに増える)',
         (select count(*)::text from public.bond_levels where breeder_id is not null)
  union all
  select 17, '③ 改名で2行になっている人(消さずに画面でまとめています)',
         (select coalesce(string_agg(names, ' / ' order by names), 'なし')
          from (select string_agg(distinct user_name, '→') as names
                from public.bond_levels
                where breeder_id is not null
                group by breeder_id, individual_id
                having count(*) > 1) t)
  union all
  select 18, '③ bond_levels の主キー(変わっていないこと)',
         (select coalesce(string_agg(a.attname, ', ' order by a.attname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum
          where n.nspname='public' and t.relname='bond_levels' and c.contype='p')
  union all
  select 19, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;
