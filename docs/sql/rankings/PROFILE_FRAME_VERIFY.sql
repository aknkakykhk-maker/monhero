-- public.rankings の profile_frame 列と、モンビーのビュー・関数への通し方が
-- 正しく入っているかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- PROFILE_FRAME_APPLY.sql の後と、アプリを公開してしばらく経ったあとに実行する。
-- 「フレームを選んだ人の記録が増えているか」がここで分かる。

with facts as (
  select 1 as sort, 'profile_frame 列' as item,
         (select coalesce(string_agg(data_type || ' / ' || is_nullable, ''), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='rankings' and column_name='profile_frame')
         || ' (text / YES なら正しい)' as value
  union all
  select 2, '検査制約',
         (select coalesce(string_agg(c.conname, ', ' order by c.conname), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rankings'
            and c.conname = 'rankings_profile_frame_shape')
  union all
  select 3, 'profile_frame を返すビュー(4つそろっていること)',
         (select coalesce(string_agg(table_name, ', ' order by table_name), 'なし')
          from information_schema.columns
          where table_schema='public' and column_name='profile_frame'
            and table_name in ('rhythm_scores','rhythm_identified_scores','rhythm_song_bests','rhythm_total_rankings'))
  union all
  select 4, 'profile_frame を返す関数(5つそろっていること)',
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public'
            and p.proname in ('rhythm_event_song_bests','rhythm_event_totals','rhythm_week_score_totals',
                              'rhythm_event_song_bests_bonus','rhythm_event_totals_bonus')
            and 'profile_frame' = any(p.proargnames))
  union all
  select 5, 'rankings の総件数',
         (select count(*)::text from public.rankings)
  union all
  select 6, 'profile_frame が入っている記録(フレームを選んだ人のプレイ)',
         (select count(*)::text from public.rankings where profile_frame is not null)
  union all
  select 7, '入っているフレームの内訳',
         (select coalesce(string_agg(profile_frame || '×' || n::text, ', ' order by n desc), 'まだ無し')
          from (select profile_frame, count(*) as n from public.rankings
                 where profile_frame is not null group by profile_frame) t)
  union all
  select 8, 'RLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rankings')
)
select item as "項目", value as "値" from facts order by sort;
