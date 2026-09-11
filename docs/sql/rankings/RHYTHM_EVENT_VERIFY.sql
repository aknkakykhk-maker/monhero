-- 週間ランキングの期間の窓と集計関数が正しく動いているかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- RHYTHM_EVENT_APPLY.sql の後と、うまく出ないときの切り分けに使う。
-- 「今週の始まり」が月曜 5:00 になっていること、今週の上位に実際の名前と点が並ぶことを見る。

with win as (select week_start, week_end from public.rhythm_week_window),
     sample as (select coalesce(array_agg(song_id), '{}') as song_ids
                  from (select distinct s.song_id
                          from public.rhythm_identified_scores s, win
                         where s.created_at >= win.week_start and s.created_at < win.week_end
                         limit 3) t),
facts as (
  select 1 as sort, '今週の始まり(JST・月曜5:00であること)' as item,
         (select to_char(week_start at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') from win) as value
  union all
  select 2, '今週の終わり(JST)',
         (select to_char(week_end at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') from win)
  union all
  select 3, '残り時間',
         (select to_char(week_end - now(), 'DD"日" HH24"時間" MI"分"') from win)
  union all
  select 4, '作った関数(2つあること)',
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('rhythm_event_song_bests','rhythm_event_totals'))
  union all
  select 5, '実行権限(anon にあること)',
         (select coalesce(string_agg(distinct routine_name||':'||grantee, ', '), 'なし')
            from information_schema.role_routine_grants
           where routine_schema='public' and grantee='anon'
             and routine_name in ('rhythm_event_song_bests','rhythm_event_totals'))
  union all
  select 6, '週の窓の読み取り権限(anon にあること)',
         (select coalesce(string_agg(distinct table_name||':'||grantee, ', '), 'なし')
            from information_schema.role_table_grants
           where table_schema='public' and grantee='anon' and privilege_type='SELECT'
             and table_name='rhythm_week_window')
  union all
  select 7, '期間で絞る索引',
         (select coalesce(string_agg(i.relname, ', ' order by i.relname), 'なし')
            from pg_class t join pg_namespace n on n.oid=t.relnamespace
            join pg_index ix on ix.indrelid=t.oid
            join pg_class i on i.oid=ix.indexrelid
           where n.nspname='public' and t.relname='rankings'
             and i.relname='rankings_rhythm_created_at_idx')
  union all
  select 8, '今週のモンビーの記録(件)',
         (select count(*)::text from public.rhythm_identified_scores s, win
           where s.created_at >= win.week_start and s.created_at < win.week_end)
  union all
  select 9, '今週記録のある曲(最大3つ)',
         (select coalesce(array_to_string(song_ids, ', '), 'なし') from sample)
  union all
  select 10, 'その曲の今週の総合に載る人数',
         (select count(*)::text from public.rhythm_event_totals((select song_ids from sample),
                                                                (select week_start from win),
                                                                (select week_end from win)))
  union all
  select 11, '上位3人(今週の総合)',
         (select coalesce(string_agg(t.user_name || ' ' || t.total_score, ' / ' order by t.total_score desc), 'なし')
            from (select * from public.rhythm_event_totals((select song_ids from sample),
                                                           (select week_start from win),
                                                           (select week_end from win))
                   order by total_score desc, last_scored_at asc limit 3) t)
  union all
  select 12, '先週の記録が今週に混ざっていないこと(先週の件数)',
         (select count(*)::text from public.rhythm_identified_scores s, win
           where s.created_at >= win.week_start - interval '7 days' and s.created_at < win.week_start)
)
select item as "項目", value as "値" from facts order by sort;
