-- MFバトルカード 個人杯: 終わった杯の見方(2026-10-31 社長「案A・30日」)。CARD_CUP_APPLY.sql のあとに流す。足す・差しかえるだけ(表は変えない・行を消さない)。何度流しても同じになる
--   ・公開にした杯は、終わったあともだれでも結果と見返しを見られる(公開の一覧の「終わった杯」)。合言葉だけの杯は参加者だけ
--   ・終わった杯は、終わって30日まで一覧に出す(前は14日)
--   card_cup_list_done()                … 終わった公開の杯(終わって30日まで・新しい順に50まで)… 新しい
--   card_cup_mine(owner)                … 自分の杯。終わった杯は30日まで … 差しかえ
--   card_cup_view(cup, owner)           … 合言葉だけの杯の結果は参加者にだけ … 差しかえ
--   card_cup_match_for(id, owner)       … 1試合の見返しの材料(公開の杯はだれでも・合言葉だけの杯は参加者だけ)… 新しい
--   card_cup_match(id)                  … 公開の杯だけ返す形に差しかえ(番号だけで合言葉だけの杯の試合を見られないように)

create or replace function public.card_cup_list_done()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card_cup_row(c) order by c.done_at desc), '[]'::jsonb)
  from (select * from card_cups where status = 'done' and listed and now() >= start_at and done_at > now() - interval '30 days' order by done_at desc limit 50) c
$$;

create or replace function public.card_cup_mine(p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card_cup_row(c) order by c.start_at desc), '[]'::jsonb)
  from card_cups c
  where exists (select 1 from card_cup_entries e where e.cup_id = c.id and e.owner_id = p_owner and not e.dropped)
    and (c.status in ('entry', 'running') or coalesce(c.done_at, c.updated_at) > now() - interval '30 days')
$$;

-- 杯の様子。合言葉は参加者にだけ。結果: オート杯は発表の時刻を過ぎて終わった杯だけ・リアルタイム杯はすぐ。合言葉だけの杯の結果は参加者にだけ
create or replace function public.card_cup_view(p_cup text, p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select * from card_cups where id = p_cup),
  me as (select exists (select 1 from card_cup_entries e where e.cup_id = p_cup and e.owner_id = p_owner and not e.dropped) as v),
  vis as (select ((c.mode = 'live' or (c.status = 'done' and now() >= c.start_at)) and (c.listed or (select v from me))) as v from c)
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'cup', (select card_cup_row(c) || jsonb_build_object('code', case when (select v from me) then c.code end, 'bracket', case when (select v from vis) then c.bracket end) from c),
    'me', (select v from me),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('owner_id', e.owner_id, 'mine', e.owner_id = p_owner, 'user_name', e.user_name, 'icon', e.icon,
        'monsters', e.deck -> 'monsters', 'seat', e.seat, 'checkin', e.checkin_at is not null,
        'place', case when (select v from vis) then e.place end, 'wins', case when (select v from vis) then e.wins end) order by e.seat nulls last, e.entered_at)
      from card_cup_entries e where e.cup_id = p_cup and not e.dropped), '[]'::jsonb),
    'matches', case when (select v from vis) then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'round', m.round, 'slot', m.slot, 'a', m.a_seat, 'b', m.b_seat,
        'winner', m.winner, 'kos', to_jsonb(m.kos), 'decided', m.decided, 'live', m.live) order by m.round, m.slot)
      from card_cup_matches m where m.cup_id = p_cup), '[]'::jsonb) else '[]'::jsonb end) end
$$;

-- 1試合の見返しの材料。公開の杯はだれでも・合言葉だけの杯は参加者だけ。見せてよい試合だけ
create or replace function public.card_cup_match_for(p_id bigint, p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', m.id, 'cup_id', m.cup_id, 'round', m.round, 'slot', m.slot, 'seed', m.seed, 'first', m.first, 'winner', m.winner, 'kos', to_jsonb(m.kos),
    'rules', m.rules, 'acts', m.acts, 'live', m.live,
    'a', jsonb_build_object('name', ea.user_name, 'icon', ea.icon, 'deck', ea.deck),
    'b', jsonb_build_object('name', eb.user_name, 'icon', eb.icon, 'deck', eb.deck))
  from card_cup_matches m
  join card_cups c on c.id = m.cup_id
  join card_cup_entries ea on ea.cup_id = m.cup_id and ea.seat = m.a_seat
  join card_cup_entries eb on eb.cup_id = m.cup_id and eb.seat = m.b_seat
  where m.id = p_id and m.winner is not null and m.acts is not null and (c.mode = 'live' or (c.status = 'done' and now() >= c.start_at))
    and (c.listed or exists (select 1 from card_cup_entries x where x.cup_id = m.cup_id and x.owner_id = p_owner and not x.dropped))
$$;
create or replace function public.card_cup_match(p_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.card_cup_match_for(p_id, '')
$$;

revoke all on function public.card_cup_list_done() from public;
revoke all on function public.card_cup_match_for(bigint, text) from public;
grant execute on function public.card_cup_list_done() to anon, authenticated;
grant execute on function public.card_cup_match_for(bigint, text) to anon, authenticated;
