-- MFバトルカード 公式杯: 終わった大会の一覧(プロフィールの「MFバトルカード 公式杯の記録」。2026-10-31 社長・案B、ブレイブくん)
-- 足すだけ・読むだけ。表は作らず、行を書き換えない。何度流しても同じになる。CARD_TOURNAMENT_APPLY.sql のあとに流す
--   ・いまの一覧(card_tournament_list)は、終わってから14日までしか返さない。こちらは終わった大会を新しい順に50件まで返す
--   ・結果発表(最終日の日本時間 4:00)の前は返さない(結果より先に順位が見えないように)
--   ・p_owner(端末のブリーダーID)が出ていた大会は、その順位(my_place)を付ける。出ていなければ null
--   ・優勝した席は名前と、助手かどうか(助手なら assist_id。まだ会っていない助手の名前は、ゲームの側で伏せる)
create or replace function public.card_tournament_history(p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.done_day desc, x.id desc), '[]'::jsonb) from (
    select t.id, t.done_day, jsonb_build_object(
      'id', t.id, 'name', t.name, 'open_on', t.open_on, 'done_day', t.done_day, 'rewards', t.rewards,
      'players', (select count(*) from card_tournament_entries e where e.tournament_id = t.id and not e.is_assist and not e.dropped),
      'winner', (select jsonb_build_object('name', w.user_name, 'is_assist', w.is_assist, 'assist_id', w.assist_id)
                 from card_tournament_entries w where w.tournament_id = t.id and w.place = 1 and not w.dropped order by w.seat_id limit 1),
      'my_place', (select m.place from card_tournament_entries m
                   where m.tournament_id = t.id and p_owner is not null and m.owner_id = p_owner and not m.is_assist and not m.dropped limit 1),
      'my_entered', exists (select 1 from card_tournament_entries m
                   where m.tournament_id = t.id and p_owner is not null and m.owner_id = p_owner and not m.is_assist and not m.dropped)) as j
    from card_tournaments t
    where t.status = 'done' and t.done_day is not null
      and ((t.done_day::timestamp + interval '4 hours') at time zone 'Asia/Tokyo') <= now()
    order by t.done_day desc, t.id desc
    limit 50
  ) x
$$;
revoke all on function public.card_tournament_history(text) from public;
grant execute on function public.card_tournament_history(text) to anon, authenticated;
