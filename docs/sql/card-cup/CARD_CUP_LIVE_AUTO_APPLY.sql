-- MFバトルカード 個人杯: リアルタイム杯の「止まった試合はサーバが決める」と「ごほうびのある杯の決まり方」(④ 2026-10-31 ブレイブくん)
-- ★足すだけ(表・列は増やさない。DELETE なし)。CARD_CUP_LIVE_APPLY.sql のあとに流す。仕様は docs/spec/CARD_CUP.md「リアルタイム杯」
--
-- 社長の判断(2026-10-31):
--   ・始まった杯をだれも開かないときは、一定時間(30分)たったら残りをサーバがオートで決める。始まらないままの杯も30分で始めて自動で決める
--     待ち時間はサーバの関数(supabase/functions/card-tournament-run/cup.js の CUP_LIVE_IDLE_MS)1か所。ここへは引数で渡す
--   ・ごほうび・参加費のある杯は、2台のなぞり直しが合ったときだけ確定。合わなければオート対戦で決め直す(A)
--     印の欄はまだ無い → card_cup_live_reward(杯) が今はいつも false。欄ができたら、この関数1つを差し替える
--
--   card_cup_live_reward(cup)                     … ごほうびのある杯か(いまは false)
--   card_cup_live_begin(cup)                      … 始める中身(鍵は見ない)。card_cup_live_start は鍵を見てからこれを呼ぶ(差し替え)
--   card_cup_live_report(…)                       … 差し替え: ごほうびのある杯は、なぞり直しが合ったときだけ確定
--   card_cup_live_server_due(wait_minutes)        … サーバだけ: 始まらないまま待ち時間を過ぎた杯を始め、待ち時間を過ぎても決まらない試合と両方の写しを返す
--   card_cup_live_server_decide(match, winner, kos, acts, rules) … サーバだけ: その試合を auto で決める(1試合1回だけ)

-- ごほうびのある杯か。印の欄ができたら、ここだけ差し替える(例: return coalesce(c.reward, 0) > 0)
create or replace function public.card_cup_live_reward(c public.card_cups)
returns boolean language sql immutable as $$
  select false
$$;

-- 始める中身(鍵は見ない)。状態が entry の杯だけ。ゲームからは card_cup_live_start、サーバからは card_cup_live_server_due が呼ぶ
create or replace function public.card_cup_live_begin(p_cup text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; e public.card_cup_entries; r record; v_n integer := 0; v_size integer; v_order integer[]; v_seeds integer[];
  v_pairs jsonb := '[]'::jsonb; k integer; v_a integer; v_b integer; v_seats integer[]; v_m integer; v_day integer; v_slot integer := 0; i integer;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.mode <> 'live' then return 'bad'; end if;
  if c.status in ('running', 'done') then return 'ok'; end if;
  if c.status <> 'entry' then return 'closed'; end if;
  -- 登録デッキの写しを取り、受付の順に席を決める(写しが取れない人は外す)
  for r in select x.owner_id, d.deck, d.tactics, d.version from card_cup_entries x
      left join card_deck_entries d on d.owner_id = x.owner_id and d.active
      where x.cup_id = p_cup and not x.dropped order by x.entered_at loop
    if r.deck is null then
      update card_cup_entries set dropped = true where cup_id = p_cup and owner_id = r.owner_id;
    else
      update card_cup_entries set seat = v_n, deck = r.deck, tactics = coalesce(r.tactics, '{}'::jsonb), deck_version = coalesce(r.version, 1)
        where cup_id = p_cup and owner_id = r.owner_id;
      v_n := v_n + 1;
    end if;
  end loop;
  if v_n < 2 then
    update card_cups set status = 'closed', closed_reason = 'few', updated_at = now() where id = p_cup;
    return 'few';
  end if;
  if c.format = 'ko' then
    -- トーナメント: 山の大きさ・山の並び(82 の cardTourKoOrder と同じ作り)・種順は混ぜる。足りない分は上の種の不戦勝(b が null)
    v_size := 2; while v_size < v_n loop v_size := v_size * 2; end loop;
    v_order := array[0];
    while array_length(v_order, 1) < v_size loop
      v_m := array_length(v_order, 1) * 2;
      v_order := (select array_agg(y order by o, s) from (select o, 0 as s, x as y from unnest(v_order) with ordinality t(x, o)
        union all select o, 1, v_m - 1 - x from unnest(v_order) with ordinality t(x, o)) z);
    end loop;
    v_seeds := (select array_agg(s order by random()) from generate_series(0, v_n - 1) s);
    for k in 0 .. v_size / 2 - 1 loop
      v_a := case when v_order[2 * k + 1] < v_n then v_seeds[v_order[2 * k + 1] + 1] end;
      v_b := case when v_order[2 * k + 2] < v_n then v_seeds[v_order[2 * k + 2] + 1] end;
      if v_a is null then v_a := v_b; v_b := null; end if;
      v_pairs := v_pairs || jsonb_build_array(jsonb_build_array(v_a, v_b));
      if v_b is not null then perform card_cup_live_add(p_cup, 0, k, v_a, v_b, true); end if;
    end loop;
    update card_cups set status = 'running', bracket = jsonb_build_object('rounds', jsonb_build_array(v_pairs)), updated_at = now() where id = p_cup;
  else
    -- 総当たり: 輪の回し方(82 の cardTourRoundRobin と同じ作り)。1日目 = 1回戦だけすぐ戦える。次の回戦は前の回戦が全部終わってから
    v_m := case when v_n % 2 = 1 then v_n + 1 else v_n end;
    v_seats := (select array_agg(s order by s) from generate_series(0, v_m - 1) s);
    for v_day in 0 .. v_m - 2 loop
      for i in 0 .. v_m / 2 - 1 loop
        v_a := v_seats[i + 1]; v_b := v_seats[v_m - i];
        if v_a < v_n and v_b < v_n then
          if v_day % 2 = 1 then perform card_cup_live_add(p_cup, v_day, v_slot, v_b, v_a, v_day = 0);
          else perform card_cup_live_add(p_cup, v_day, v_slot, v_a, v_b, v_day = 0); end if;
          v_slot := v_slot + 1;
        end if;
      end loop;
      v_seats := array[v_seats[1], v_seats[v_m]] || v_seats[2:v_m - 1];
    end loop;
    update card_cups set status = 'running', updated_at = now() where id = p_cup;
  end if;
  return 'ok';
end $$;

-- 2. 始める(差し替え: 中身は card_cup_live_begin へ移した。ふるまいは同じ)
create or replace function public.card_cup_live_start(p_cup text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; e public.card_cup_entries;
begin
  select * into c from card_cups where id = p_cup;
  if not found or c.mode <> 'live' then return 'bad'; end if;
  if c.status in ('running', 'done') then return 'ok'; end if;
  if c.status <> 'entry' then return 'closed'; end if;
  e := card_cup_live_who(p_cup, p_owner, p_key);
  if e.owner_id is null then return 'none'; end if;
  if now() < c.start_at then
    -- 早めに始められるのは、主催が押して、2人以上いて、全員が来ているときだけ
    if e.owner_id <> c.host_id or now() < c.start_at - interval '10 minutes' then return 'early'; end if;
    if (select count(*) from card_cup_entries where cup_id = p_cup and not dropped) < 2
      or exists (select 1 from card_cup_entries where cup_id = p_cup and not dropped and checkin_at is null) then return 'wait'; end if;
  end if;
  return card_cup_live_begin(p_cup);
end $$;

-- 4. 結果(差し替え: ごほうびのある杯の決まり方 A を足した。ほかは同じ)。winner … 0 = a・1 = b / how … pvp(2台で戦った)・absent(相手が来ず、相手の登録デッキと戦った)・auto(2人とも来ない・食い違い)
--   返り値: ok(決まった)/ wait(相手の結果を待つ)/ done(もう決まっていた)/ early(まだ決められない)/ bad / none
create or replace function public.card_cup_live_report(p_match bigint, p_owner text, p_key text, p_winner integer, p_how text, p_verified boolean,
  p_kos integer[], p_acts jsonb, p_rules integer)
returns text language plpgsql security definer set search_path = public as $$
declare m public.card_cup_matches; c public.card_cups; e public.card_cup_entries; ea public.card_cup_entries; eb public.card_cup_entries;
  v_side integer; v_mine text; v_other text; v_rep jsonb; v_ready timestamptz; v_late boolean;
begin
  if p_winner is null or p_winner not in (0, 1) or p_how not in ('pvp', 'absent', 'auto')
    or (p_kos is not null and array_length(p_kos, 1) <> 2) or octet_length(coalesce(p_acts, '[]'::jsonb)::text) > 200000 then return 'bad'; end if;
  select * into m from card_cup_matches where id = p_match for update;
  if not found then return 'bad'; end if;
  if m.winner is not null then return 'done'; end if;
  select * into c from card_cups where id = m.cup_id;
  if c.mode <> 'live' or c.status <> 'running' then return 'bad'; end if;
  e := card_cup_live_who(m.cup_id, p_owner, p_key);
  if e.owner_id is null or e.checkin_at is null then return 'none'; end if;
  v_ready := (m.live ->> 'ready_at')::timestamptz;
  if v_ready is null then return 'early'; end if;
  select * into ea from card_cup_entries where cup_id = m.cup_id and seat = m.a_seat;
  select * into eb from card_cup_entries where cup_id = m.cup_id and seat = m.b_seat;
  v_side := case when e.seat = m.a_seat then 0 when e.seat = m.b_seat then 1 end;
  -- 部屋に来ないまま2分たったら「来ない」とみなす(集合はしたが、その試合に来ない)
  v_late := now() >= v_ready + interval '2 minutes';
  if p_how = 'auto' then
    if coalesce((m.live ->> 'dispute')::boolean, false)
      or (ea.checkin_at is null and eb.checkin_at is null)
      or (v_late and (m.live ->> 'join_a') is null and (m.live ->> 'join_b') is null) then
      perform card_cup_live_decide(p_match, p_winner, 'auto', p_kos, p_acts, p_rules);
      return 'ok';
    end if;
    return 'early';
  end if;
  if v_side is null then return 'none'; end if;
  if p_how = 'absent' then
    if (case when v_side = 0 then eb.checkin_at is null else ea.checkin_at is null end)
      or (v_late and (m.live ->> case when v_side = 0 then 'join_b' else 'join_a' end) is null) then
      perform card_cup_live_decide(p_match, p_winner, 'absent', p_kos, p_acts, p_rules);
      return 'ok';
    end if;
    return 'early';
  end if;
  -- pvp: 自分の端末でなぞり直しが合った(verified)ら決まる。合わなかった・まだのときは、2台の答えが同じなら決まる。違えば「食い違い」(auto で決める)
  v_mine := case when v_side = 0 then 'rep_a' else 'rep_b' end;
  v_other := case when v_side = 0 then 'rep_b' else 'rep_a' end;
  if p_verified then
    perform card_cup_live_decide(p_match, p_winner, 'pvp', p_kos, p_acts, p_rules);
    return 'ok';
  end if;
  v_rep := m.live -> v_other;
  -- ごほうびのある杯(2026-10-31 社長 A): なぞり直しが合わない・確かめていない答えでは決めない。食い違いにして auto で決め直す
  if card_cup_live_reward(c) then
    update card_cup_matches set live = jsonb_set(live, array[v_mine], jsonb_build_object('w', p_winner, 'v', false, 'at', now(), 'kos', to_jsonb(p_kos)))
      || jsonb_build_object('dispute', true) where id = p_match;
    return 'wait';
  end if;
  if v_rep is not null and (v_rep ->> 'w')::int = p_winner then
    perform card_cup_live_decide(p_match, p_winner, 'pvp', p_kos, p_acts, p_rules);
    return 'ok';
  end if;
  -- 待つあいだに、先に送った側の手の並びを残す(相手が抜けて settle で決まっても見返せるように)。食い違ったら残さない(auto の手で上書きする)
  update card_cup_matches set live = jsonb_set(live, array[v_mine], jsonb_build_object('w', p_winner, 'v', false, 'at', now(), 'kos', to_jsonb(p_kos)))
    || case when v_rep is not null then jsonb_build_object('dispute', true) else '{}'::jsonb end,
    acts = case when v_rep is null then coalesce(acts, p_acts) end, rules = case when v_rep is null then coalesce(rules, p_rules) end
    where id = p_match;
  return 'wait';
end $$;

-- サーバだけ: 止まった杯と試合
create or replace function public.card_cup_live_server_due(p_wait_minutes integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_wait interval := make_interval(mins => greatest(coalesce(p_wait_minutes, 30), 5));
begin
  -- 始まらないまま待ち時間を過ぎた杯を始める
  for r in select id from card_cups where mode = 'live' and status = 'entry' and start_at <= now() - v_wait order by start_at limit 20 loop
    perform card_cup_live_begin(r.id);
  end loop;
  -- 戦えるようになって待ち時間を過ぎても決まらない試合(写しどうしで回すための材料)
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'cup_id', m.cup_id, 'round', m.round, 'slot', m.slot, 'seed', m.seed, 'first', m.first,
      'a', jsonb_build_object('deck', ea.deck, 'tactics', ea.tactics), 'b', jsonb_build_object('deck', eb.deck, 'tactics', eb.tactics)) order by m.cup_id, m.round, m.slot)
    from (select m.* from card_cup_matches m join card_cups c on c.id = m.cup_id
          where c.mode = 'live' and c.status = 'running' and m.winner is null and (m.live ->> 'ready_at')::timestamptz <= now() - v_wait
          order by m.id limit 40) m
    join card_cup_entries ea on ea.cup_id = m.cup_id and ea.seat = m.a_seat
    join card_cup_entries eb on eb.cup_id = m.cup_id and eb.seat = m.b_seat), '[]'::jsonb);
end $$;

-- サーバだけ: その試合を auto で決める(だれかが先に決めていれば何もしない)
create or replace function public.card_cup_live_server_decide(p_match bigint, p_winner integer, p_kos integer[], p_acts jsonb, p_rules integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_winner is null or p_winner not in (0, 1) then return false; end if;
  return card_cup_live_decide(p_match, p_winner, 'auto', p_kos, p_acts, p_rules);
end $$;

revoke all on function public.card_cup_live_reward(public.card_cups) from public, anon, authenticated;
revoke all on function public.card_cup_live_begin(text) from public, anon, authenticated;
revoke all on function public.card_cup_live_server_due(integer) from public, anon, authenticated;
revoke all on function public.card_cup_live_server_decide(bigint, integer, integer[], jsonb, integer) from public, anon, authenticated;
grant execute on function public.card_cup_live_server_due(integer) to service_role;
grant execute on function public.card_cup_live_server_decide(bigint, integer, integer[], jsonb, integer) to service_role;
