-- モンビー(モンヒロビート)の回数ボーナスが本番で効いているかを確かめるSQL。
-- 読み取り専用: はい。何も書き換えない(select だけ)。
-- 本番変更が残るか: いいえ。
--
-- RHYTHM_EVENT_BONUS_APPLY.sql を流したあとに、これを貼って実行する。
-- ★Supabase の SQL Editor は「最後の1文」の結果しか出さないので、
--   確かめたいこと全部を1つの表にまとめてある(2026-09-11・ユーザー指摘「今貼ったやつしか出ないよ」)。
--
-- 【見かた】いちばん左が項目、右が値。「なし」「いいえ」が出たら、その行が直っていない。

with rates as (
  -- アプリ側(data/rhythm-event.js の RHYTHM_EVENT_PLAY_BONUS_RATES)と同じ割合
  select '{"EASY":0.001,"NORMAL":0.002,"HARD":0.003,"EXPERT":0.005,"MASTER":0.007}'::jsonb as j
),
ev as (
  -- 週末ゲリラ杯(2026-09-11 15:00 〜 2026-09-14 05:00 JST)の対象曲と期間
  select array['monster_hero','kaze_ga_soyogu','close_to_your_heart']::text[] as song_ids,
         '2026-09-11 15:00:00+09'::timestamptz as from_at,
         '2026-09-14 05:00:00+09'::timestamptz as to_at
),
songs as (
  select b.* from ev,
    lateral public.rhythm_event_song_bests_bonus(ev.song_ids, ev.from_at, ev.to_at, (select j from rates)) b
),
totals as (
  select t.* from ev,
    lateral public.rhythm_event_totals_bonus(ev.song_ids, ev.from_at, ev.to_at, (select j from rates)) t
),
plain as (
  select a.* from ev,
    lateral public.rhythm_event_song_bests(ev.song_ids, ev.from_at, ev.to_at) a
),
facts as (
  select 1::numeric as sort, '回数ボーナスの関数がある' as item,
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('rhythm_event_song_bests_bonus','rhythm_event_totals_bonus')) as value
  union all
  select 2, '加点なしの関数も残っている',
         (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'なし')
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('rhythm_event_song_bests','rhythm_event_totals'))
  union all
  select 3, 'アプリ(anon)から実行できる',
         (select coalesce(string_agg(distinct grantee, ', '), 'なし')
            from information_schema.role_routine_grants
           where specific_schema = 'public'
             and routine_name in ('rhythm_event_song_bests_bonus','rhythm_event_totals_bonus')
             and grantee in ('anon','authenticated'))
  union all
  select 4, 'イベント期間中の対象曲の記録(人×曲)',
         (select count(*)::text from songs)
  union all
  select 5, 'イベント期間中のプレイ回数(のべ)',
         (select coalesce(sum(play_count), 0)::text from songs)
  union all
  select 6, '加点が入っている行',
         (select count(*)::text from songs where bonus_score > 0)
  union all
  select 6.1, '難易度ごとの回数が返っている',
         (select coalesce((select play_counts::text from songs order by play_count desc limit 1), 'なし'))
  union all
  select 6.2, '難易度ごとの回数の合計が全体の回数と合う',
         (select case when count(*) = 0 then 'はい' else 'いいえ（' || count(*) || '件ずれ）' end
            from songs s
           where s.play_count <> (select coalesce(sum((e.value)::integer), 0)
                                    from jsonb_each_text(coalesce(s.play_counts, '{}'::jsonb)) e))
  union all
  select 7, '素点と加点の合計が表のスコアと一致する',
         (select case when count(*) = 0 then 'はい' else 'いいえ（' || count(*) || '件ずれ）' end
            from songs where score <> base_score + bonus_score)
  union all
  select 8, '素点は加点なしの関数と同じ',
         (select case when count(*) = 0 then 'はい' else 'いいえ（' || count(*) || '件ずれ）' end
            from songs s join plain p
              on p.identity_key = s.identity_key and p.song_id = s.song_id
           where p.score <> s.base_score)
  union all
  select 9, '総合は曲ごとの加点込みスコアの合計',
         (select case when count(*) = 0 then 'はい' else 'いいえ（' || count(*) || '件ずれ）' end
            from totals t
            join (select identity_key, sum(score)::bigint as s, sum(base_score)::bigint as b
                    from songs group by identity_key) g on g.identity_key = t.identity_key
           where t.total_score <> g.s or t.base_total <> g.b)
  union all
  select 10, '加点でいちばん伸びた人（曲の部門）',
         (select coalesce(user_name || ' … 素点 ' || base_score || ' ＋ 加点 ' || bonus_score
                          || '（' || play_count || '回）＝ ' || score, 'まだありません')
            from songs order by bonus_score desc, score desc limit 1)
  union all
  select 11, '総合の1位（加点込み）',
         (select coalesce(user_name || ' … ' || total_score || '（素点 ' || base_total
                          || ' ＋ 加点 ' || bonus_total || ' / ' || play_count || '回 '
                          || coalesce(play_counts::text, '{}') || '）', 'まだありません')
            from totals order by total_score desc, last_scored_at asc limit 1)
  union all
  select 12, '総合の1位が加点なしのときと入れ替わったか',
         (select case when bonus.k is not distinct from base.k then 'いいえ（同じ人）'
                      else 'はい（' || coalesce(base.n,'—') || ' → ' || coalesce(bonus.n,'—') || '）' end
            from (select identity_key as k, user_name as n from totals
                   order by total_score desc, last_scored_at asc limit 1) bonus
            full join (select identity_key as k, user_name as n from totals
                        order by base_total desc, last_scored_at asc limit 1) base on true)
  union all
  select 13, 'rankings は読み取りだけ（件数）',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;
