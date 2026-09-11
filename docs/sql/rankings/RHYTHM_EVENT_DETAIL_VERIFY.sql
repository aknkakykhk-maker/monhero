-- イベントの「詳細」が出せる状態になったかを見るだけのSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ(select だけ。何度実行してもよい)。
--
-- RHYTHM_EVENT_DETAIL_APPLY.sql の後に実行する。
--
-- ★Supabase の SQL Editor は「最後のクエリの結果」しか表示しない。
--   そのため、確かめたいこと全部を1つの表(項目 / 値)へまとめてある
--   (2026-09-11・ユーザー指摘「今貼ったやつしか出ないよ」)。
--   RHYTHM_EVENT_VERIFY.sql と同じ作り方。

with ev as (
  -- いま開催中(または直近)のイベントの期間と対象曲。
  -- ★ここは週末ゲリラ杯の値。別のイベントで確かめるときはこの3つだけ書き換える
  select array['monster_hero','kaze_ga_soyogu','close_to_your_heart']::text[] as song_ids,
         timestamptz '2026-09-11 15:00+09' as from_at,
         timestamptz '2026-09-14 05:00+09' as to_at
),
bests as (
  select b.* from ev, lateral public.rhythm_event_song_bests(ev.song_ids, ev.from_at, ev.to_at) b
),
facts as (
  select 1 as sort, 'ビューに party が入った(2枚あること)' as item,
         (select coalesce(string_agg(table_name, ', ' order by table_name), 'なし')
            from information_schema.columns
           where table_schema='public' and column_name='party'
             and table_name in ('rhythm_scores','rhythm_identified_scores')) as value
  union all
  select 2, '関数の戻り値(最後が party jsonb であること)',
         (select pg_get_function_result(p.oid)
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='rhythm_event_song_bests')
  union all
  select 3, '実行権限(anon にあること)',
         (select coalesce(string_agg(distinct grantee, ', '), 'なし')
            from information_schema.routine_privileges
           where specific_schema='public' and routine_name='rhythm_event_song_bests')
  union all
  select 4, 'イベント期間の記録(件)',
         (select count(*)::text from bests)
  union all
  select 5, 'うち 内訳あり(詳細ボタンが出る)',
         (select count(*) filter (where party is not null)::text from bests)
  union all
  select 6, 'うち 内訳なし(古い記録。0でなくてよい)',
         (select count(*) filter (where party is null)::text from bests)
  union all
  select 7, '内訳の中身の例(最大コンボ)',
         (select coalesce(string_agg(x, ' / '), 'なし')
            from (select user_name||'='||coalesce(party->0->>'maxCombo','?') as x
                    from bests where party is not null
                   order by score desc limit 3) t)
  union all
  select 8, '総合の集計(壊れていないこと・件)',
         (select count(*)::text from ev,
            lateral public.rhythm_event_totals(ev.song_ids, ev.from_at, ev.to_at) t)
  union all
  select 9, 'この曲タブの土台(rhythm_scores・件)',
         (select count(*)::text from public.rhythm_scores)
  union all
  select 10, '総合タブの土台(rhythm_total_rankings・件)',
         (select count(*)::text from public.rhythm_total_rankings)
)
select item as "項目", value as "値" from facts order by sort;
