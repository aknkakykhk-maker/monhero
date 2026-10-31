-- MFバトルカード 個人杯: リアルタイム杯(④ 2026-10-31 ブレイブくん)。仕様は docs/spec/CARD_CUP.md「リアルタイム杯」
-- ★足すだけ。表は CARD_CUP_APPLY.sql(②)のものをそのまま使い、列も表も増やさない。DELETE は書かない
-- ★CARD_CUP_APPLY.sql を流したあとに流す
--
-- 試合はいまのマルチ対戦と同じ(2台で同じ試合を同時に・終わったら山札を見せ合って確かめる cardPvpVerify)。部屋の合言葉はここで試合ごとに作る。
-- 来ない人は登録デッキ(始まる時刻の写し)が自動で戦う。2人とも来ない試合も、同じ写しどうしで自動で決める(打ち方は cardSharePolicy・種は試合の種)
--
--   card_cup_live_checkin(cup, owner, key)  … 集合(始まる時刻の10分前から。来たら、その杯の終わりまで「来ている」)
--   card_cup_live_start(cup, owner, key)    … 始める(始まる時刻を過ぎたらだれでも・全員そろえば主催が早めに)。写しを取り、席・1回戦(総当たりは全部)を作る
--   card_cup_live_match(match, owner, key)  … 1試合の材料(合言葉・種・先攻・来ているか・自分と相手の写し)。自分の試合なら「部屋に入った」を記す
--   card_cup_live_report(match, owner, key, winner, how, verified, kos, acts, rules) … 結果(how: pvp / absent / auto)
--   card_cup_live_settle(cup)               … 片方だけが結果を送って 90秒たった試合を決める(相手が抜けた・閉じた)
--
-- card_cup_matches.live(jsonb)の中身: { room, ready_at, join_a, join_b, rep_a: { w, v, at }, rep_b, dispute }
-- 見返し: 決まった試合には、種・先攻・手の並び(acts)・ルールの版(rules)が残る。両方のデッキは card_cup_entries の写し。読むのは②の card_cup_match
-- card_cup_matches.decided: pvp(2台で戦った)/ leave(片方が抜けた)/ absent(片方が来ず、登録デッキと戦った)/ auto(2人とも来ず・食い違い)

-- 部屋の合言葉(8文字。ふつうのマルチ対戦の4文字とぶつからない。文字は 77 の RHYTHM_MULTI_CODE_CHARS と同じ)
create or replace function public.card_cup_live_code()
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8)
$$;

-- 参加者か(鍵の指紋が合うか)。合わなければ null
create or replace function public.card_cup_live_who(p_cup text, p_owner text, p_key text)
returns public.card_cup_entries language sql stable security definer set search_path = public as $$
  select e.* from card_cup_entries e
  where e.cup_id = p_cup and e.owner_id = p_owner and not e.dropped and p_key is not null and length(p_key) between 24 and 128 and e.key_hash = md5(p_key)
$$;

-- 1. 集合
create or replace function public.card_cup_live_checkin(p_cup text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; e public.card_cup_entries;
begin
  select * into c from card_cups where id = p_cup;
  if not found or c.mode <> 'live' then return 'bad'; end if;
  if c.status not in ('entry', 'running') then return 'closed'; end if;
  if now() < c.start_at - interval '10 minutes' then return 'early'; end if;
  e := card_cup_live_who(p_cup, p_owner, p_key);
  if e.owner_id is null then return 'none'; end if;
  update card_cup_entries set checkin_at = coalesce(checkin_at, now()) where cup_id = p_cup and owner_id = p_owner;
  return 'ok';
end $$;

-- 試合を1つ足す(種・先攻・合言葉)。ready … すぐ戦える回戦か
create or replace function public.card_cup_live_add(p_cup text, p_round integer, p_slot integer, p_a integer, p_b integer, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_seed bigint := 1 + floor(random() * 2147483646)::bigint;
begin
  insert into card_cup_matches (cup_id, round, slot, a_seat, b_seat, seed, first, live)
  values (p_cup, p_round, p_slot, p_a, p_b, v_seed, (v_seed % 2)::int,
    jsonb_build_object('room', card_cup_live_code(), 'ready_at', case when p_ready then now() end))
  on conflict (cup_id, round, slot) do nothing;
end $$;

-- 2. 始める
create or replace function public.card_cup_live_start(p_cup text, p_owner text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; e public.card_cup_entries; r record; v_n integer := 0; v_size integer; v_order integer[]; v_seeds integer[];
  v_pairs jsonb := '[]'::jsonb; k integer; v_a integer; v_b integer; v_seats integer[]; v_m integer; v_day integer; v_slot integer := 0; i integer;
begin
  select * into c from card_cups where id = p_cup for update;
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

-- 終わり(順位・勝ち数)。トーナメント: 優勝 1・決勝で負け 2・その前 3・5・9 … / 総当たり: 勝ち数 → 倒した数 → 2人の対戦 → 受付の早さ(席)
create or replace function public.card_cup_live_finish(p_cup text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.card_cups; v_total integer; rr record; v_place integer; mm record;
begin
  select * into c from card_cups where id = p_cup;
  update card_cup_entries x set wins = (select count(*) from card_cup_matches m where m.cup_id = p_cup and m.winner is not null
    and (case when m.winner = 0 then m.a_seat else m.b_seat end) = x.seat) where x.cup_id = p_cup and not x.dropped;
  if c.format = 'ko' then
    v_total := jsonb_array_length(c.bracket -> 'rounds');
    for mm in select * from card_cup_matches where cup_id = p_cup and winner is not null loop
      update card_cup_entries set place = (2 ^ (v_total - mm.round - 1))::int + 1
        where cup_id = p_cup and seat = case when mm.winner = 0 then mm.b_seat else mm.a_seat end;
      if mm.round = v_total - 1 then
        update card_cup_entries set place = 1 where cup_id = p_cup and seat = case when mm.winner = 0 then mm.a_seat else mm.b_seat end;
      end if;
    end loop;
  else
    v_place := 0;
    for rr in
      with s as (
        select x.seat, x.wins,
          coalesce((select sum(case when m.a_seat = x.seat then m.kos[1] else m.kos[2] end) from card_cup_matches m
            where m.cup_id = p_cup and (m.a_seat = x.seat or m.b_seat = x.seat)), 0) as kos
        from card_cup_entries x where x.cup_id = p_cup and not x.dropped and x.seat is not null)
      select s.seat from s order by s.wins desc, s.kos desc,
        -- 2人の対戦: 勝ち数と倒した数が同じ人の中で、その人たちに勝った数
        (select count(*) from card_cup_matches m join s t on t.seat = case when m.winner = 0 then m.b_seat else m.a_seat end
          where m.cup_id = p_cup and m.winner is not null and (case when m.winner = 0 then m.a_seat else m.b_seat end) = s.seat
          and t.wins = s.wins and t.kos = s.kos) desc,
        s.seat
    loop
      v_place := v_place + 1;
      update card_cup_entries set place = v_place where cup_id = p_cup and seat = rr.seat;
    end loop;
  end if;
  update card_cups set status = 'done', done_at = now(), updated_at = now() where id = p_cup;
end $$;

-- 進める(試合が決まるたびに呼ぶ)。トーナメント: 回戦が終わったら次の回戦 / 総当たり: 回戦が終わったら次の回戦を戦えるように
create or replace function public.card_cup_live_advance(p_cup text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.card_cups; v_r integer; v_pairs jsonb; v_win integer[] := '{}'; k integer; v_a integer; v_b integer; v_w integer; v_next jsonb := '[]'::jsonb; v_round integer;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'running' then return; end if;
  if c.format = 'ko' then
    v_r := jsonb_array_length(c.bracket -> 'rounds') - 1;
    v_pairs := c.bracket -> 'rounds' -> v_r;
    for k in 0 .. jsonb_array_length(v_pairs) - 1 loop
      v_a := (v_pairs -> k ->> 0)::int; v_b := (v_pairs -> k ->> 1)::int;
      if v_b is null then v_win := v_win || v_a; continue; end if;
      select winner into v_w from card_cup_matches where cup_id = p_cup and round = v_r and slot = k;
      if v_w is null then return; end if;
      v_win := v_win || case when v_w = 0 then v_a else v_b end;
    end loop;
    if array_length(v_win, 1) < 2 then perform card_cup_live_finish(p_cup); return; end if;
    for k in 0 .. array_length(v_win, 1) / 2 - 1 loop
      v_next := v_next || jsonb_build_array(jsonb_build_array(v_win[2 * k + 1], v_win[2 * k + 2]));
      perform card_cup_live_add(p_cup, v_r + 1, k, v_win[2 * k + 1], v_win[2 * k + 2], true);
    end loop;
    update card_cups set bracket = jsonb_build_object('rounds', (c.bracket -> 'rounds') || jsonb_build_array(v_next)), updated_at = now() where id = p_cup;
  else
    if not exists (select 1 from card_cup_matches where cup_id = p_cup and winner is null) then perform card_cup_live_finish(p_cup); return; end if;
    select min(round) into v_round from card_cup_matches where cup_id = p_cup and winner is null;
    update card_cup_matches set live = jsonb_set(coalesce(live, '{}'::jsonb), '{ready_at}', to_jsonb(now()))
      where cup_id = p_cup and round = v_round and (live ->> 'ready_at') is null;
  end if;
end $$;

-- 3. 1試合の材料。自分の試合なら「部屋に入った」を記す(相手が来ているかを見分けるため)
create or replace function public.card_cup_live_match(p_match bigint, p_owner text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.card_cup_matches; c public.card_cups; e public.card_cup_entries; ea public.card_cup_entries; eb public.card_cup_entries; v_side integer;
begin
  select * into m from card_cup_matches where id = p_match;
  if not found then return null; end if;
  select * into c from card_cups where id = m.cup_id;
  if c.mode <> 'live' then return null; end if;
  e := card_cup_live_who(m.cup_id, p_owner, p_key);
  if e.owner_id is null then return null; end if;
  select * into ea from card_cup_entries where cup_id = m.cup_id and seat = m.a_seat;
  select * into eb from card_cup_entries where cup_id = m.cup_id and seat = m.b_seat;
  v_side := case when e.seat = m.a_seat then 0 when e.seat = m.b_seat then 1 end;
  if v_side is not null and m.winner is null and (m.live ->> 'ready_at') is not null then
    update card_cup_matches set live = jsonb_set(live, array[case when v_side = 0 then 'join_a' else 'join_b' end], to_jsonb(now()))
      where id = p_match and (live ->> case when v_side = 0 then 'join_a' else 'join_b' end) is null
      returning * into m;
    if not found then select * into m from card_cup_matches where id = p_match; end if;
  end if;
  return jsonb_build_object('id', m.id, 'cup_id', m.cup_id, 'round', m.round, 'slot', m.slot, 'a', m.a_seat, 'b', m.b_seat, 'seed', m.seed, 'first', m.first,
    'winner', m.winner, 'decided', m.decided, 'side', v_side,
    'room', case when v_side is not null then m.live ->> 'room' end,
    'ready_at', m.live -> 'ready_at', 'join_a', m.live -> 'join_a', 'join_b', m.live -> 'join_b', 'dispute', coalesce((m.live ->> 'dispute')::boolean, false),
    'checkin_a', ea.checkin_at is not null, 'checkin_b', eb.checkin_at is not null,
    'a_side', jsonb_build_object('name', ea.user_name, 'icon', ea.icon, 'deck', ea.deck, 'tactics', ea.tactics),
    'b_side', jsonb_build_object('name', eb.user_name, 'icon', eb.icon, 'deck', eb.deck, 'tactics', eb.tactics));
end $$;

-- 試合を決める(だれが送っても1回だけ)
create or replace function public.card_cup_live_decide(p_match bigint, p_winner integer, p_decided text, p_kos integer[], p_acts jsonb, p_rules integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_cup text;
begin
  -- 手の並びは、決めた人が送った物。送らなかったとき(settle の leave)は、待っている間に先に残した物(見返しに使う。1試合1回だけ書く)
  update card_cup_matches set winner = p_winner, decided = p_decided, kos = p_kos, acts = coalesce(p_acts, acts), rules = coalesce(p_rules, rules), done_at = now()
    where id = p_match and winner is null returning cup_id into v_cup;
  if v_cup is null then return false; end if;
  perform card_cup_live_advance(v_cup);
  return true;
end $$;

-- 4. 結果。winner … 0 = a・1 = b / how … pvp(2台で戦った)・absent(相手が来ず、相手の登録デッキと戦った)・auto(2人とも来ない・食い違い)
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

-- 5. 片方だけが結果を送って90秒たった試合(相手が抜けた・閉じた)を、送った側の答えで決める。返り値: 決めた試合の数
create or replace function public.card_cup_live_settle(p_cup text)
returns integer language plpgsql security definer set search_path = public as $$
declare m record; v_rep jsonb; v_n integer := 0;
begin
  for m in select * from card_cup_matches where cup_id = p_cup and winner is null and not coalesce((live ->> 'dispute')::boolean, false)
      and ((live -> 'rep_a') is null) <> ((live -> 'rep_b') is null) loop
    v_rep := coalesce(m.live -> 'rep_a', m.live -> 'rep_b');
    if (v_rep ->> 'at')::timestamptz <= now() - interval '90 seconds' then
      if card_cup_live_decide(m.id, (v_rep ->> 'w')::int, 'leave',
          case when jsonb_typeof(v_rep -> 'kos') = 'array' then array[(v_rep -> 'kos' ->> 0)::int, (v_rep -> 'kos' ->> 1)::int] end, null, null) then
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function public.card_cup_live_code() from public, anon, authenticated;
revoke all on function public.card_cup_live_who(text, text, text) from public, anon, authenticated;
revoke all on function public.card_cup_live_add(text, integer, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.card_cup_live_finish(text) from public, anon, authenticated;
revoke all on function public.card_cup_live_advance(text) from public, anon, authenticated;
revoke all on function public.card_cup_live_decide(bigint, integer, text, integer[], jsonb, integer) from public, anon, authenticated;
revoke all on function public.card_cup_live_checkin(text, text, text) from public;
revoke all on function public.card_cup_live_start(text, text, text) from public;
revoke all on function public.card_cup_live_match(bigint, text, text) from public;
revoke all on function public.card_cup_live_report(bigint, text, text, integer, text, boolean, integer[], jsonb, integer) from public;
revoke all on function public.card_cup_live_settle(text) from public;
grant execute on function public.card_cup_live_checkin(text, text, text) to anon, authenticated;
grant execute on function public.card_cup_live_start(text, text, text) to anon, authenticated;
grant execute on function public.card_cup_live_match(bigint, text, text) to anon, authenticated;
grant execute on function public.card_cup_live_report(bigint, text, text, integer, text, boolean, integer[], jsonb, integer) to anon, authenticated;
grant execute on function public.card_cup_live_settle(text) to anon, authenticated;
