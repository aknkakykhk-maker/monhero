-- 週間ランキングの週の区切りを「月曜 4:00 JST」へ(2026-11-07 社長「てかぜんぶ4時に統一して」→ 週は次の週から)。
-- ★ビュー rhythm_week_window の本体を差し替えるだけ(create or replace view)。表・関数・列の名前と型は変えない。
--   2026-11-09(月)04:00 JST より前は、いままでと同じ「月曜 5:00 区切り」をそのまま返す。
--   その瞬間から「月曜 4:00 区切り」に切り替わる。切り替えの週(11/2 5:00 〜 11/9 4:00)だけ1時間短い。
--   ゲーム側(monster-hero/data/rhythm-event.js の RHYTHM_WEEK_SWITCH_MS)も同じ日時で切り替わる。
-- ★いつ流すか: ゲームの公開(週を4時にそろえる版)のあと、2026-11-09 04:00 JST より前。
--   流した時点で、今週(11/2 の週)の終わりが 11/9 5:00 → 4:00 になる(始まりはそのまま)。ほかの週は変わらない。
--   4:00 より後に流すと、4:00〜流すまでのあいだ、サーバーは前の週のまま・ゲームは新しい週になり、
--   その間のスコアが「サーバーでは前の週・ゲームの画面では今週」と食い違うので、必ず前に流す。
-- 元に戻すときは RHYTHM_EVENT_APPLY.sql ① のビュー(5時間)を流し直す。
create or replace view public.rhythm_week_window
with (security_invoker = on) as
with sw as (select timestamptz '2026-11-09 04:00:00+09' as switch_at),
     ws as (
       select sw.switch_at,
              case when now() >= sw.switch_at
                then ((date_trunc('week', (now() at time zone 'Asia/Tokyo') - interval '4 hours') + interval '4 hours') at time zone 'Asia/Tokyo')
                else ((date_trunc('week', (now() at time zone 'Asia/Tokyo') - interval '5 hours') + interval '5 hours') at time zone 'Asia/Tokyo')
              end as week_start
         from sw)
select ws.week_start,
       case when ws.week_start < ws.switch_at then least(ws.week_start + interval '7 days', ws.switch_at)
            else ws.week_start + interval '7 days' end as week_end
  from ws;

comment on view public.rhythm_week_window is
  '週間ランキングの今週の始まり・終わり(毎週月曜4:00 JST区切り。2026-11-09 04:00 より前の週は月曜5:00)。期間の正本。';

-- 確かめ(読むだけ)。11/9 4:00 より前に流したら「11/02 05:00 〜 11/09 04:00」、後なら「月曜 04:00 〜 次の月曜 04:00」と出れば正しい
select to_char(week_start at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') as 始まり,
       to_char(week_end at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI (Dy)') as 終わり
  from public.rhythm_week_window;
