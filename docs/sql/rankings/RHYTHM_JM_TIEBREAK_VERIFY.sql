-- RHYTHM_JM_TIEBREAK_APPLY.sql の前後に流して確かめるSQL(読み取りだけ)。
-- 読み取り専用: はい。本番変更は残らない。
-- 当てる前: ①だけ流す(関数の数は 0・既存の件数を控える)。当てたあと: ①〜④を流す。

-- ① 関数があるか(当てる前 0 / 当てたあと 4)と、既存の件数(当てる前後で同じ)
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('rhythm_party_precise','rhythm_total_precise','rhythm_week_precise','rhythm_event_precise')) as "新しい関数の数(当てたあと 4)",
  (select count(*) from public.rankings)              as "rankings の件数(前後で同じ)",
  (select count(*) from public.rhythm_total_rankings) as "総合ランキングの人数(前後で同じ)";

-- ② 総合: 人数が総合ランキングと同じで、JUST MARVELOUS の合計が負になっていない
select
  (select count(*) from public.rhythm_total_precise())                          as "JMを出せた人数(総合の人数と同じ)",
  (select count(*) from public.rhythm_total_precise() where total_precise < 0) as "負の合計(0)",
  (select max(total_precise) from public.rhythm_total_precise())                as "いちばん多い合計";

-- ③ 総合の同点(合計点が同じ人がいる所)と、新しい並び(合計点 → JUST MARVELOUS → 先に出した人)
select t.total_score as "合計点", p.total_precise as "JUST MARVELOUS", t.user_name as "名前", t.last_scored_at as "最後に出した時刻"
  from public.rhythm_total_rankings t
  join public.rhythm_total_precise() p on p.identity_key = t.identity_key
 where t.total_score in (select total_score from public.rhythm_total_rankings group by total_score having count(*) > 1)
 order by t.total_score desc, p.total_precise desc, t.last_scored_at asc
 limit 30;

-- ④ 今週の週間: 同点の所と、新しい並び
with w as (select week_start, week_end from public.rhythm_week_window)
select t.total_score as "累計スコア", p.total_precise as "JUST MARVELOUS", t.user_name as "名前", t.last_scored_at as "最後に出した時刻"
  from w,
       lateral public.rhythm_week_score_totals(w.week_start, w.week_end) t
  join lateral public.rhythm_week_precise(w.week_start, w.week_end) p on p.identity_key = t.identity_key
 where t.total_score in (select total_score from public.rhythm_week_score_totals(w.week_start, w.week_end) group by total_score having count(*) > 1)
 order by t.total_score desc, p.total_precise desc, t.last_scored_at asc
 limit 30;
