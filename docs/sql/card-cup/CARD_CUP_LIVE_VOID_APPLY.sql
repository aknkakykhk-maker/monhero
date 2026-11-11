-- MFバトルカード 個人杯: リアルタイム杯の「無効試合」(2026-11-08 ブレイブくん・案A)
-- ★足すだけ(関数を1つ足す。表・列・ほかの関数は変えない。DELETE なし)。CARD_CUP_LIVE_APPLY.sql・CARD_CUP_LIVE_AUTO_APPLY.sql のあとに流す
--
-- マルチの試合で、届いた手がルールに合わず2台の場が食い違ったら、その試合は続けない(91 の goVoid)。
-- 杯の試合では、どちらの負けにもせず「食い違い」(live.dispute)の印を付ける。あとは今の決まり方どおり、
-- 2人の登録デッキどうしの auto の試合で決まる(杯の画面を開いている端末の auto・サーバの30分の自動。settle は食い違いの試合を決めない)
--
--   card_cup_live_void(match, owner, key) … その試合の席の人だけが、まだ決まっていない試合に食い違いの印を付ける
--   返り値: ok(印を付けた・もう付いていた)/ done(もう決まっていた)/ early(まだ始まっていない)/ bad / none

create or replace function public.card_cup_live_void(p_match bigint, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare m public.card_cup_matches; c public.card_cups; e public.card_cup_entries;
begin
  select * into m from card_cup_matches where id = p_match for update;
  if not found then return 'bad'; end if;
  if m.winner is not null then return 'done'; end if;
  select * into c from card_cups where id = m.cup_id;
  if c.mode <> 'live' or c.status <> 'running' then return 'bad'; end if;
  e := card_cup_live_who(m.cup_id, p_owner, p_key);
  if e.owner_id is null or e.checkin_at is null then return 'none'; end if;
  if e.seat is distinct from m.a_seat and e.seat is distinct from m.b_seat then return 'none'; end if;
  if (m.live ->> 'ready_at') is null then return 'early'; end if;
  if coalesce((m.live ->> 'dispute')::boolean, false) then return 'ok'; end if;
  update card_cup_matches set live = live || jsonb_build_object('dispute', true, 'void_at', now()) where id = p_match;
  return 'ok';
end $$;

revoke all on function public.card_cup_live_void(bigint, text, text) from public;
grant execute on function public.card_cup_live_void(bigint, text, text) to anon, authenticated;
