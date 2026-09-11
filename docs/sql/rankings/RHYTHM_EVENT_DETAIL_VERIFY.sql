-- 適用後の確認。読み取り専用: はい。本番変更が残るか: いいえ。
-- RHYTHM_EVENT_DETAIL_APPLY.sql を実行したあとに、上から順に流して結果を見る。

-- ① ビューに party が入ったか(2行とも出れば OK)
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('rhythm_scores', 'rhythm_identified_scores')
   and column_name = 'party'
 order by table_name;

-- ② 関数の戻り値に party が入ったか(最後の行が party jsonb なら OK)
select p.proname, pg_get_function_result(p.oid) as returns
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'rhythm_event_song_bests';

-- ③ 実データで party が返るか。
--    いま開催中のイベントの対象曲と期間を入れて確かめる(週末ゲリラ杯の例)。
--    party が null の行は、判定の内訳が保存される前の古い記録。画面では詳細ボタンが出ない。
select user_name, song_id, difficulty_id, score,
       (party is not null) as has_detail,
       party -> 0 ->> 'maxCombo' as max_combo
  from public.rhythm_event_song_bests(
         array['monster_hero','kaze_ga_soyogu','close_to_your_heart'],
         timestamptz '2026-09-11 15:00+09',
         timestamptz '2026-09-14 05:00+09')
 order by score desc
 limit 10;

-- ④ 内訳が入っている行の割合(古い記録がどれくらいあるかの目安)
select count(*) as 全体,
       count(*) filter (where party is not null) as 内訳あり,
       count(*) filter (where party is null) as 内訳なし
  from public.rhythm_event_song_bests(
         array['monster_hero','kaze_ga_soyogu','close_to_your_heart'],
         timestamptz '2026-09-11 15:00+09',
         timestamptz '2026-09-14 05:00+09');

-- ⑤ 総合のほうが壊れていないか(party を足したのは曲ごとの関数だけ。こちらは変えていない)
select user_name, total_score, song_count
  from public.rhythm_event_totals(
         array['monster_hero','kaze_ga_soyogu','close_to_your_heart'],
         timestamptz '2026-09-11 15:00+09',
         timestamptz '2026-09-14 05:00+09')
 order by total_score desc
 limit 5;

-- ⑥ 既存の「この曲」タブと「総合」タブが壊れていないか
select count(*) as rhythm_scores件数 from public.rhythm_scores;
select count(*) as 総合ランキング件数 from public.rhythm_total_rankings;
