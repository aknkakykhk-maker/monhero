-- ★案(2026-10-31 リプレイくん)。まだ流さない。社長が案を選んだら、選んだ形に直してから APPLY として出し直す。
-- MFバトルカード 個人杯: 主催・主催仲間が出すごほうびと、参加費(サーバで預かる)
-- 案の本文: docs/progress/card-tournament/personal-cup/prize/README.md
--
-- 足すだけ。ルールくん・ブレイブくんの表(card_cups・card_cup_entries・card_cup_matches)の形は変えない。行を消す命令(DELETE)は使わない。
-- 触る今の関数は2つだけ(どちらも中身の差し替え。引数と返り値の形は同じ):
--   card_cup_join          … 参加費のある杯には 'fee' を返す(参加費は card_cup_join_pay で払って入る)
--   card_cup_live_reward   … ごほうびのある杯なら true(リアルタイム杯は、なぞり直しが合ったときだけ確定する口。ブレイブくんの #4356)
--
-- 持ち物の名前(item)は、端末のギフトの種類と同じ言葉にそろえる:
--   'diamond'(mh_gold)/ 'beatPoint'(mh_rhythm_event_points_v1)/ 'rainbowPsyche' / 'rainbowTranscendFruit' / 'dyeMock'
--   'gameItem:<アイテムid>'(mh_owned_items。勇者の証 hero_proof・証片 hero_proof_shard・セッション券 session_ticket・スキップチケット など)
--   'card:shard'(戦術カードのかけら)/ 'card:ticket'(カードパック券)/ 'card:catalog'(バトルカードカタログ)/ 'card:gacha'(ガチャポイント)

-- ---- 出せる物と上限(窓口が行を足して増やす。消さない。止めるときは enabled を false に) ----
create table if not exists public.card_cup_prize_items (
  item      text    not null,
  label     text    not null,
  give_max  integer not null,  -- 1人が1杯に出せる上限
  fee_max   integer not null,  -- 参加費の上限(0 なら参加費には使えない)
  day_max   integer not null,  -- 1人が1日に預けられる上限(出す+参加費)
  enabled   boolean not null default true,
  constraint card_cup_prize_items_pkey primary key (item),
  constraint card_cup_prize_items_shape check (item ~ '^(diamond|beatPoint|rainbowPsyche|rainbowTranscendFruit|dyeMock|gameItem:[a-z0-9_]{1,40}|card:(shard|ticket|catalog|gacha))$'
    and give_max >= 0 and fee_max >= 0 and day_max >= 0)
);
insert into public.card_cup_prize_items (item, label, give_max, fee_max, day_max) values
  ('diamond', 'ダイヤ', 50000, 5000, 100000),
  ('beatPoint', 'ビートP', 5000, 500, 10000),
  ('rainbowPsyche', '虹のプシュケー', 30, 3, 60),
  ('rainbowTranscendFruit', '虹の超越の実', 3, 0, 5),
  ('dyeMock', '染色もどき', 10, 1, 20),
  ('gameItem:hero_proof', '勇者の証', 3, 0, 5),
  ('gameItem:hero_proof_shard', '勇者の証片', 30, 3, 60),
  ('gameItem:session_ticket', 'セッション券', 10, 1, 20),
  ('gameItem:skip_ticket_jo', 'スキップチケット・序', 10, 1, 20),
  ('gameItem:skip_ticket_ha', 'スキップチケット・破', 10, 1, 20),
  ('gameItem:skip_ticket_kyu', 'スキップチケット・急', 10, 1, 20),
  ('gameItem:training_ticket', 'トレーニングチケット', 10, 1, 20),
  ('card:shard', '戦術カードのかけら', 30, 3, 60),
  ('card:ticket', 'カードパック券', 5, 1, 10),
  ('card:catalog', 'バトルカードカタログ', 3, 0, 5)
on conflict (item) do nothing;

-- ---- 主催と主催仲間(1杯に主催1人 + 主催仲間2人まで) ----
create table if not exists public.card_cup_hosts (
  cup_id     text        not null references public.card_cups (id),
  owner_id   text        not null,
  role       text        not null,                -- 'host' | 'cohost'
  state      text        not null default 'invited', -- 'invited' | 'joined' | 'removed' | 'declined'
  key_hash   text,
  user_name  text        not null default '',
  icon       text,
  at         timestamptz not null default now(),
  constraint card_cup_hosts_pkey primary key (cup_id, owner_id),
  constraint card_cup_hosts_shape check (role in ('host', 'cohost') and state in ('invited', 'joined', 'removed', 'declined') and length(user_name) <= 40)
);

-- ---- 杯ごとの参加費と配り方 ----
create table if not exists public.card_cup_prizes (
  cup_id     text        not null references public.card_cups (id),
  fee_item   text        references public.card_cup_prize_items (item),
  fee_amount integer     not null default 0,
  split      integer[]   not null default array[70, 30], -- 1位から。合計100・1つ1以上・8位まで
  updated_at timestamptz not null default now(),
  constraint card_cup_prizes_pkey primary key (cup_id),
  constraint card_cup_prizes_shape check (fee_amount >= 0 and (fee_amount = 0 or fee_item is not null)
    and array_length(split, 1) between 1 and 8)
);

-- ---- 預かった記録(主催・主催仲間のごほうび / 参加費)。1回預けるごとに1行。nonce(端末が作る長い文字)が鍵なので、同じ送り直しは1回分 ----
create table if not exists public.card_cup_deposits (
  cup_id   text        not null references public.card_cups (id),
  owner_id text        not null,
  kind     text        not null,  -- 'prize' | 'fee'
  item     text        not null references public.card_cup_prize_items (item),
  amount   integer     not null,
  nonce    text        not null,
  at       timestamptz not null default now(),
  constraint card_cup_deposits_pkey primary key (nonce),
  constraint card_cup_deposits_shape check (kind in ('prize', 'fee') and amount > 0 and nonce ~ '^[0-9a-f]{32,64}$')
);
create index if not exists card_cup_deposits_cup_idx on public.card_cup_deposits (cup_id, owner_id);
-- 参加費は1杯1人1回だけ(抜けて入り直しても二重に取らない)
create unique index if not exists card_cup_deposits_fee_once_idx on public.card_cup_deposits (cup_id, owner_id) where kind = 'fee';
create index if not exists card_cup_deposits_day_idx on public.card_cup_deposits (owner_id, at);

-- ---- 配った・戻した記録(1杯・1人で1行。最初の nonce だけに中身を返す) ----
create table if not exists public.card_cup_claims (
  cup_id   text        not null references public.card_cups (id),
  owner_id text        not null,
  items    jsonb       not null,  -- [{ "item": 'diamond', "amount": 1000 }, …]
  reason   text        not null,  -- 'prize'(順位で配る)| 'refund'(中止・人数不足・受付中に抜けた・主催仲間を外れた)| 'none'
  nonce    text        not null,
  at       timestamptz not null default now(),
  constraint card_cup_claims_pkey primary key (cup_id, owner_id),
  constraint card_cup_claims_shape check (reason in ('prize', 'refund', 'none') and jsonb_typeof(items) = 'array' and nonce ~ '^[0-9a-f]{32,64}$')
);

alter table public.card_cup_prize_items enable row level security;
alter table public.card_cup_hosts enable row level security;
alter table public.card_cup_prizes enable row level security;
alter table public.card_cup_deposits enable row level security;
alter table public.card_cup_claims enable row level security;
revoke all on public.card_cup_prize_items, public.card_cup_hosts, public.card_cup_prizes, public.card_cup_deposits, public.card_cup_claims from anon, authenticated;

-- ---- 内側の確かめ ----
-- 持ち主の鍵(登録デッキと同じ鍵の md5)
create or replace function public.card_cup_key_ok(p_owner text, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_key is not null and exists (select 1 from card_deck_entries where owner_id = p_owner and key_hash = md5(p_key))
$$;
-- 主催か主催仲間(承けた人)か
create or replace function public.card_cup_is_host(p_cup text, p_owner text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from card_cups where id = p_cup and host_id = p_owner)
    or exists (select 1 from card_cup_hosts where cup_id = p_cup and owner_id = p_owner and role = 'cohost' and state = 'joined')
$$;
-- その人がその日(日本時間)に預けた量
create or replace function public.card_cup_day_total(p_owner text, p_item text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from card_cup_deposits
  where owner_id = p_owner and item = p_item and (at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date
$$;

-- ---- 差し替え1: ごほうびのある杯か(リアルタイム杯は、なぞり直しが合ったときだけ確定する) ----
create or replace function public.card_cup_live_reward(c public.card_cups)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from card_cup_deposits d where d.cup_id = c.id)
    or exists (select 1 from card_cup_prizes p where p.cup_id = c.id and p.fee_amount > 0)
$$;
revoke all on function public.card_cup_live_reward(public.card_cups) from public, anon, authenticated;

-- ---- 主催: 参加費と配り方を決める(受付中・まだだれも参加費を払っていないあいだだけ) ----
create or replace function public.card_cup_prize_set(p_cup text, p_owner text, p_key text, p_fee_item text, p_fee_amount integer, p_split integer[])
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; it card_cup_prize_items; s integer; v integer;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' then return 'closed'; end if;
  if c.host_id <> p_owner or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  if exists (select 1 from card_cup_deposits where cup_id = p_cup and kind = 'fee') then return 'paid'; end if;
  if p_split is null or array_length(p_split, 1) not between 1 and 8 then return 'bad'; end if;
  s := 0; foreach v in array p_split loop if v < 1 then return 'bad'; end if; s := s + v; end loop;
  if s <> 100 then return 'bad'; end if;
  if coalesce(p_fee_amount, 0) > 0 then
    select * into it from card_cup_prize_items where item = p_fee_item and enabled;
    if not found or p_fee_amount > it.fee_max then return 'bad'; end if;
  end if;
  insert into card_cup_prizes (cup_id, fee_item, fee_amount, split) values (p_cup, case when coalesce(p_fee_amount, 0) > 0 then p_fee_item end, greatest(coalesce(p_fee_amount, 0), 0), p_split)
    on conflict (cup_id) do update set fee_item = excluded.fee_item, fee_amount = excluded.fee_amount, split = excluded.split, updated_at = now();
  return 'ok';
end $$;

-- ---- 主催仲間: 主催がフレンドを誘う / 誘われた人が承ける・断る / 主催が外す ----
create or replace function public.card_cup_cohost_invite(p_cup text, p_owner text, p_key text, p_friend text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' then return 'closed'; end if;
  if c.host_id <> p_owner or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  if p_friend is null or p_friend = p_owner then return 'bad'; end if;
  if not exists (select 1 from friend_links where status = 'accepted'
    and least(requester_id, target_id) = least(p_owner, p_friend) and greatest(requester_id, target_id) = greatest(p_owner, p_friend)) then return 'notfriend'; end if;
  if (select count(*) from card_cup_hosts where cup_id = p_cup and role = 'cohost' and state in ('invited', 'joined') and owner_id <> p_friend) >= 2 then return 'full'; end if;
  insert into card_cup_hosts (cup_id, owner_id, role, state) values (p_cup, p_friend, 'cohost', 'invited')
    on conflict (cup_id, owner_id) do update set state = case when card_cup_hosts.state = 'joined' then 'joined' else 'invited' end, at = now();
  return 'ok';
end $$;
create or replace function public.card_cup_cohost_answer(p_cup text, p_owner text, p_key text, p_accept boolean, p_name text, p_icon text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; h card_cup_hosts;
begin
  select * into c from card_cups where id = p_cup;
  if not found or c.status <> 'entry' then return 'closed'; end if;
  select * into h from card_cup_hosts where cup_id = p_cup and owner_id = p_owner for update;
  if not found or h.state <> 'invited' then return 'none'; end if;
  if not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  update card_cup_hosts set state = case when p_accept then 'joined' else 'declined' end, key_hash = md5(p_key),
    user_name = left(coalesce(p_name, ''), 40), icon = left(p_icon, 64), at = now() where cup_id = p_cup and owner_id = p_owner;
  return 'ok';
end $$;
-- 外した主催仲間が出していた物は、その人の受け取りで戻る(card_cup_claim)
create or replace function public.card_cup_cohost_remove(p_cup text, p_owner text, p_key text, p_target text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' then return 'closed'; end if;
  if c.host_id <> p_owner or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  update card_cup_hosts set state = 'removed', at = now() where cup_id = p_cup and owner_id = p_target and role = 'cohost';
  return 'ok';
end $$;

-- ---- 預ける(主催・主催仲間のごほうび)。返り値 'ok' | 'dup'(同じ nonce・もう預かっている)| 'closed' | 'locked' | 'bad' | 'over'(上限)----
create or replace function public.card_cup_deposit(p_cup text, p_owner text, p_key text, p_item text, p_amount integer, p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; it card_cup_prize_items; cur integer;
begin
  if exists (select 1 from card_cup_deposits where nonce = p_nonce) then return 'dup'; end if;
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  if not card_cup_is_host(p_cup, p_owner) or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  select * into it from card_cup_prize_items where item = p_item and enabled;
  if not found or p_amount is null or p_amount < 1 or p_nonce !~ '^[0-9a-f]{32,64}$' then return 'bad'; end if;
  select coalesce(sum(amount), 0)::int into cur from card_cup_deposits where cup_id = p_cup and owner_id = p_owner and kind = 'prize' and item = p_item;
  if coalesce(cur, 0) + p_amount > it.give_max or card_cup_day_total(p_owner, p_item) + p_amount > it.day_max then return 'over'; end if;
  insert into card_cup_deposits (cup_id, owner_id, kind, item, amount, nonce) values (p_cup, p_owner, 'prize', p_item, p_amount, p_nonce)
    on conflict (nonce) do nothing;
  return 'ok';
end $$;

-- ---- 参加と参加費を1回で(今の card_cup_join と同じ確かめをしてから預かる) ----
create or replace function public.card_cup_join_pay(p_cup text, p_owner text, p_key text, p_name text, p_icon text, p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare p card_cup_prizes; it card_cup_prize_items; r text;
begin
  if exists (select 1 from card_cup_deposits where nonce = p_nonce) then return 'dup'; end if;
  select * into p from card_cup_prizes where cup_id = p_cup;
  if not found or p.fee_amount = 0 then return 'nofee'; end if;
  if card_cup_is_host(p_cup, p_owner) then return 'host'; end if;  -- 主催・主催仲間は参加費を払わない
  select * into it from card_cup_prize_items where item = p.fee_item and enabled;
  if not found then return 'bad'; end if;
  if card_cup_day_total(p_owner, p.fee_item) + p.fee_amount > it.day_max then return 'over'; end if;
  perform set_config('card_cup.paying', '1', true);  -- card_cup_join に「払って入る途中」と知らせる(この取引の中だけ)
  r := card_cup_join(p_cup, p_owner, p_key, p_name, p_icon);
  if r <> 'ok' then return r; end if;
  if exists (select 1 from card_cup_deposits where cup_id = p_cup and owner_id = p_owner and kind = 'fee') then return 'paid'; end if; -- 抜けて入り直した人は、前に払った分のまま(端末は払わずに戻す)
  insert into card_cup_deposits (cup_id, owner_id, kind, item, amount, nonce) values (p_cup, p_owner, 'fee', p.fee_item, p.fee_amount, p_nonce);
  return 'ok';
end $$;
-- 差し替え2: card_cup_join の先頭に1行足す(参加費のある杯は、払って入る card_cup_join_pay からだけ)
--   if exists (select 1 from card_cup_prizes where cup_id = p_cup and fee_amount > 0) and coalesce(current_setting('card_cup.paying', true), '') <> '1' then return 'fee'; end if;
--   ※ ルールくん・ブレイブくんの今の本文に、この1行だけを足して出し直す(ここには本文を写さない。ぶつからないように)

-- ---- 受け取り・戻し ----
-- 返り値 { status:'ok'|'claimed'|'wait'|'locked'|'none', reason, items:[{item, amount}] }。
--   同じ nonce なら何度でも同じ中身(返事が途中で切れても、送り直せば受け取れる)。ちがう nonce には中身を返さない(二重に受け取れない)
create or replace function public.card_cup_claim(p_cup text, p_owner text, p_key text, p_nonce text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c card_cups; p card_cup_prizes; cl card_cup_claims; e card_cup_entries; v_items jsonb := '[]'::jsonb; v_reason text := 'none';
  v_refund boolean; v_rank integer; v_pct integer; v_ties integer; r record; v_pool integer; v_share integer; v_paid integer;
begin
  if p_nonce is null or p_nonce !~ '^[0-9a-f]{32,64}$' then return jsonb_build_object('status', 'bad'); end if;
  select * into cl from card_cup_claims where cup_id = p_cup and owner_id = p_owner;
  if found then
    if cl.nonce = p_nonce then return jsonb_build_object('status', 'ok', 'reason', cl.reason, 'items', cl.items); end if;
    return jsonb_build_object('status', 'claimed');
  end if;
  if not card_cup_key_ok(p_owner, p_key) then return jsonb_build_object('status', 'locked'); end if;
  select * into c from card_cups where id = p_cup for update;
  if not found then return jsonb_build_object('status', 'none'); end if;
  select * into p from card_cup_prizes where cup_id = p_cup;
  select * into e from card_cup_entries where cup_id = p_cup and owner_id = p_owner;
  -- 戻す: 中止・人数不足 / 受付中に抜けた(受付が終わってから) / 外された主催仲間
  v_refund := c.status = 'closed'
    or (c.status in ('running', 'done') and e.owner_id is not null and e.dropped)
    or exists (select 1 from card_cup_hosts h where h.cup_id = p_cup and h.owner_id = p_owner and h.state = 'removed');
  if v_refund then
    select coalesce(jsonb_agg(jsonb_build_object('item', item, 'amount', total)), '[]'::jsonb) into v_items
      from (select item, sum(amount)::int as total from card_cup_deposits where cup_id = p_cup and owner_id = p_owner group by item) t;
    v_reason := 'refund';
  elsif c.status = 'done' then
    -- 配る: 主催・主催仲間を除いた順位(主催が上位なら、その分は次の人へ)。同じ順位の人は、その順位からの割合を合わせて人数で分ける
    select rk into v_rank from (
      select x.owner_id, dense_rank() over (order by x.place) as rk from card_cup_entries x
      where x.cup_id = p_cup and not x.dropped and x.place is not null and not card_cup_is_host(p_cup, x.owner_id)) t
      where t.owner_id = p_owner;
    if v_rank is not null and p is not null and v_rank <= array_length(p.split, 1) then
      v_pct := p.split[v_rank];
      select count(*) into v_ties from (
        select x.owner_id, dense_rank() over (order by x.place) as rk from card_cup_entries x
        where x.cup_id = p_cup and not x.dropped and x.place is not null and not card_cup_is_host(p_cup, x.owner_id)) t where t.rk = v_rank;
      for r in select item, sum(amount)::int as total from card_cup_deposits d
        where d.cup_id = p_cup and not exists (select 1 from card_cup_hosts h where h.cup_id = p_cup and h.owner_id = d.owner_id and h.state = 'removed')
        group by item loop
        v_share := floor(r.total * v_pct / 100.0 / greatest(v_ties, 1));
        -- 1位は端数ももらう
        if v_rank = 1 then v_share := v_share + (r.total - (select coalesce(sum(floor(r.total * s / 100.0)), 0)::int from unnest(p.split) s)); end if;
        -- 預かった量を超えて配らない(これまでに配った量と合わせて確かめる)
        select coalesce(sum((it ->> 'amount')::int), 0) into v_paid from card_cup_claims cc, jsonb_array_elements(cc.items) it
          where cc.cup_id = p_cup and cc.reason = 'prize' and it ->> 'item' = r.item;
        v_share := least(v_share, r.total - v_paid);
        if v_share > 0 then v_items := v_items || jsonb_build_object('item', r.item, 'amount', v_share); end if;
      end loop;
      v_reason := case when jsonb_array_length(v_items) > 0 then 'prize' else 'none' end;
    end if;
  else
    return jsonb_build_object('status', 'wait');
  end if;
  insert into card_cup_claims (cup_id, owner_id, items, reason, nonce) values (p_cup, p_owner, v_items, v_reason, p_nonce);
  return jsonb_build_object('status', 'ok', 'reason', v_reason, 'items', v_items);
end $$;

-- ---- 見せる: 杯のごほうび(一覧・参加・結果の画面)。だれでも読める(鍵は見ない・預けた人の名前は主催と主催仲間だけ) ----
create or replace function public.card_cup_prize_view(p_cup text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fee', (select jsonb_build_object('item', fee_item, 'amount', fee_amount) from card_cup_prizes where cup_id = p_cup),
    'split', (select to_jsonb(split) from card_cup_prizes where cup_id = p_cup),
    'pool', (select coalesce(jsonb_agg(jsonb_build_object('item', item, 'amount', total)), '[]'::jsonb) from (
      select d.item, sum(d.amount)::int as total from card_cup_deposits d where d.cup_id = p_cup
        and not exists (select 1 from card_cup_hosts h where h.cup_id = p_cup and h.owner_id = d.owner_id and h.state = 'removed') group by d.item) t),
    'hosts', (select coalesce(jsonb_agg(jsonb_build_object('name', user_name, 'icon', icon, 'role', role)), '[]'::jsonb)
      from card_cup_hosts where cup_id = p_cup and state = 'joined'))
$$;

grant execute on function public.card_cup_prize_set(text, text, text, text, integer, integer[]) to anon, authenticated;
grant execute on function public.card_cup_cohost_invite(text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_cohost_answer(text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.card_cup_cohost_remove(text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_deposit(text, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.card_cup_join_pay(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_claim(text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_prize_view(text) to anon, authenticated;
revoke all on function public.card_cup_key_ok(text, text) from public, anon, authenticated;
revoke all on function public.card_cup_is_host(text, text) from public, anon, authenticated;
revoke all on function public.card_cup_day_total(text, text) from public, anon, authenticated;
