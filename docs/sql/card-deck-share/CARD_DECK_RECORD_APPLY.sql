-- MFバトルカード: 登録デッキの「最近の戦績」(2026-10-31 社長「誰に挑まれてとか戦績も見たい」)。CARD_DECK_REPLAYS_APPLY.sql のあとに流す。
--
-- 足すだけ。関数を1つ足すだけで、表(card_deck_entries・card_deck_replays)は読むだけ。形も中身も変えない。行を消す命令(DELETE)は使わない。
-- 何度流しても同じになる(create or replace)。
--
--   card_deck_record_of(owner) … だれでも読める。その人の登録デッキが戦われた最近の試合(新しい順・20まで)の「いつ・このデッキが勝ったか・何ターン」だけ。
--                                 挑んだ人の名前・アイコン・デッキ・手の並びは返さない(挑んだ人には「デッキを登録した人があとから見返せます」と
--                                 案内しているので、その約束より広げない。名前つきの一覧は、今までどおり本人だけが card_deck_replays_of で読める)
--                                 登録をやめた人(active でない)の分は返さない

create or replace function public.card_deck_record_of(p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', r.at, 'deck_won', r.deck_won, 'turns', r.turns, 'old', r.owner_version <> e.version) order by r.at desc), '[]'::jsonb)
  from (select * from public.card_deck_replays where owner_id = p_owner order by at desc limit 20) r
  join public.card_deck_entries e on e.owner_id = r.owner_id and e.active
$$;

revoke all on function public.card_deck_record_of(text) from public;
grant execute on function public.card_deck_record_of(text) to anon, authenticated;
