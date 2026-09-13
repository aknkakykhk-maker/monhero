-- 【下調べ】今週の週間ランキングに、送り直しで混ざった記録がないか見る。
-- 読み取り専用: はい。何も変えない(SELECT だけ)。
--
-- 2026-09-14・ユーザー指摘「この時間は開いた時間なんだけどそれがスコアとして
-- 何かしらの方法でカウントされてる？」。
--
-- 送り直し(2026-09-13追加)が created_at を付けずに送っていたため、
-- **アプリを開いた瞬間**の時刻で入った行がある。見分け方は次の2つ。
--   ・同じブリーダーの複数曲が、ほぼ同じ分(数秒〜1分のあいだ)に並んでいる
--   ・その時刻が「遊んでいない」と本人が言える時刻
--
-- ここでは消さない。消したいときは RHYTHM_RESEND_WEEK_DELETE.sql を使う。

with win as (
  select week_start as start_at, week_end as end_at from public.rhythm_week_window
),
rows_this_week as (
  select r.clear_id, r.user_name, r.breeder_id, r.difficulty, r.score, r.created_at
    from public.rankings r, win w
   where r.difficulty like 'Rhythm-%'
     and r.created_at >= w.start_at
     and r.created_at <  w.end_at
),
-- 同じ人・同じ分にまとまって入っている固まり(＝送り直しの疑い)
bursts as (
  select user_name,
         to_char(created_at at time zone 'Asia/Tokyo', 'MM/DD(Dy) HH24:MI') as 時刻,
         count(*) as 件数,
         sum(score) as 合計スコア
    from rows_this_week
   group by user_name, to_char(created_at at time zone 'Asia/Tokyo', 'MM/DD(Dy) HH24:MI')
  having count(*) >= 2
)
select '① 今週の期間(JST)' as 項目,
       (select to_char(start_at at time zone 'Asia/Tokyo','MM/DD(Dy) HH24:MI') || ' 〜 '
            || to_char(end_at   at time zone 'Asia/Tokyo','MM/DD(Dy) HH24:MI') from win) as 値
union all
select '② 今週のモンビーの記録の件数', (select count(*)::text from rows_this_week)
union all
select '③ 同じ分に2件以上まとまっている固まり',
       coalesce((select string_agg(user_name || ' / ' || 時刻 || ' / ' || 件数::text || '件 / '
                                   || to_char(合計スコア, 'FM999,999,999'), E'\n'
                                   order by 時刻)
                   from bursts), '(なし)')
union all
select '④ 今週の記録の一覧(時刻の新しい順・上位20件)',
       coalesce((select string_agg(line, E'\n') from (
         select to_char(created_at at time zone 'Asia/Tokyo','MM/DD HH24:MI') || ' / '
             || user_name || ' / ' || difficulty || ' / '
             || to_char(score, 'FM999,999,999') || ' / ' || clear_id as line,
             created_at
           from rows_this_week
          order by created_at desc
          limit 20) t), '(なし)');
