-- 読むだけ(2026-11-03 ルールくん): 公式杯・個人杯の「1晩に回す試合の数」と「回し終わった時刻」を数える。
--   LEGEND の先読みを強くすると1試合が重くなる(約 2倍)ので、1晩(0:00〜3:50・10分おき)で回し切れるかを見る。
--   表を書き換えない。select だけ。
with tour as (
  select 'tournament' as kind, m.play_on as night, count(*) as matches,
         count(*) filter (where m.done_at is not null) as done,
         max(m.done_at at time zone 'Asia/Tokyo') as last_done_jst,
         count(distinct date_trunc('minute', m.done_at)) filter (where m.done_at is not null) as calls_used
  from public.card_tournament_matches m
  where m.play_on >= (now() at time zone 'Asia/Tokyo')::date - 14
  group by m.play_on
), cup as (
  select 'cup' as kind, (m.done_at at time zone 'Asia/Tokyo')::date as night, count(*) as matches,
         count(*) filter (where m.done_at is not null) as done,
         max(m.done_at at time zone 'Asia/Tokyo') as last_done_jst,
         count(distinct date_trunc('minute', m.done_at)) filter (where m.done_at is not null) as calls_used
  from public.card_cup_matches m
  where m.done_at >= now() - interval '14 days' or m.done_at is null
  group by 2
)
select * from tour
union all
select * from cup
order by night desc, kind;

-- まだ回していない試合(今夜以降に回す分)
select 'tournament' as kind, play_on, count(*) as waiting
from public.card_tournament_matches where done_at is null group by play_on
union all
select 'cup', null, count(*) from public.card_cup_matches where done_at is null
order by 2 nulls last;
