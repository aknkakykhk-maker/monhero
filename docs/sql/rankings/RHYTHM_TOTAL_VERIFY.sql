-- 全曲合算ランキングの集計ビューが正しく動いているかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- RHYTHM_TOTAL_APPLY.sql の後と、うまく出ないときの切り分けに使う。

with facts as (
  select 1 as sort, '作ったビュー(5枚あること)' as item,
         (select coalesce(string_agg(c.relname, ', ' order by c.relname), 'なし')
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v'
             and c.relname in ('rhythm_scores','rhythm_identity_map','rhythm_identified_scores',
                               'rhythm_song_bests','rhythm_total_rankings')) as value
  union all
  select 2, 'RLSをすり抜けない設定(5枚とも on)',
         (select coalesce(string_agg(c.relname || '=' ||
                   case when exists (select 1 from unnest(coalesce(c.reloptions, '{}')) o
                                      where split_part(o, '=', 1) = 'security_invoker'
                                        and lower(split_part(o, '=', 2)) in ('on','true'))
                        then 'on' else 'off' end,
                   ', ' order by c.relname), 'なし')
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v'
             and c.relname in ('rhythm_scores','rhythm_identity_map','rhythm_identified_scores',
                               'rhythm_song_bests','rhythm_total_rankings'))
  union all
  select 3, '読み取り権限(anon にあること)',
         (select coalesce(string_agg(distinct table_name||':'||grantee, ', '), 'なし')
            from information_schema.role_table_grants
           where table_schema='public' and grantee='anon' and privilege_type='SELECT'
             and table_name in ('rhythm_total_rankings','rhythm_song_bests','rhythm_ranking_song_exclusions'))
  union all
  select 4, '足した索引',
         (select coalesce(string_agg(i.relname, ', ' order by i.relname), 'なし')
            from pg_class t join pg_namespace n on n.oid=t.relnamespace
            join pg_index ix on ix.indrelid=t.oid
            join pg_class i on i.oid=ix.indexrelid
           where n.nspname='public' and t.relname='rankings'
             and i.relname in ('rankings_rhythm_breeder_score_idx','rankings_rhythm_user_score_idx'))
  union all
  select 5, '除外している曲(平常時はなし)',
         (select coalesce(string_agg(song_id, ', ' order by song_id), 'なし')
            from public.rhythm_ranking_song_exclusions)
  union all
  select 6, 'モンビーの記録(Rhythm-)',
         (select count(*)::text from public.rhythm_scores)
  union all
  select 7, 'そのうち breeder_id が入っている記録',
         (select count(*)::text from public.rhythm_scores where breeder_id is not null)
  union all
  -- ★ここが「いま遊べる公開曲の数」と合わないときは、もう遊べない曲の記録が
  --   合算に混ざっている。RHYTHM_TOTAL_SONGS.sql でどの曲かを確かめ、
  --   RHYTHM_TOTAL_EXCLUDE.sql で除外する(記録そのものは消さない)
  select 8, '曲の数(合算に入っている曲)',
         (select count(distinct b.song_id)::text from public.rhythm_song_bests b)
  union all
  select 9, '合算に入っている曲の一覧',
         (select coalesce(string_agg(distinct b.song_id, ', ' order by b.song_id), 'なし')
            from public.rhythm_song_bests b)
  union all
  select 10, '合算に載るブリーダー数',
         (select count(*)::text from public.rhythm_total_rankings)
  union all
  select 11, '上位3人(名前 / 合計点 / 曲数)',
         (select coalesce(string_agg(line, ' | '), 'なし') from (
            select user_name || ' / ' || total_score || ' / ' || song_count || '曲' as line
              from public.rhythm_total_rankings
             order by total_score desc, last_scored_at asc limit 3) t)
  union all
  select 12, '同名で複数のIDが観測されている名前',
         (select coalesce(string_agg(user_name, ', ' order by user_name), 'なし')
            from (select user_name from public.rhythm_scores
                   where breeder_id is not null
                   group by user_name having count(distinct breeder_id) > 1) t)
  union all
  -- ここが0でないなら、IDの無い古い記録がIDへ寄せられている(=過去の記録が引き継げている)
  select 13, 'IDの無い記録のうち、名前からIDへ寄せられた件数',
         (select count(*)::text from public.rhythm_identified_scores
           where breeder_id is null and identity_key not like 'name:%')
  union all
  select 14, 'rankings のRLS(有効であること)',
         (select case when c.relrowsecurity then '有効' else '無効' end
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname='rankings')
)
select item as "項目", value as "値" from facts order by sort;
