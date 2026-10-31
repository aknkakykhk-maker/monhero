-- MFバトルカード 個人杯: 主催・主催仲間が出すごほうびと、参加費(サーバで預かる)。2026-10-31 社長の判断(ソランド部長経由)
-- 案: docs/progress/card-tournament/personal-cup/prize/README.md / 仕様: docs/spec/CARD_CUP.md
--
-- 足すだけ。ルールくん・ブレイブくんの表(card_cups・card_cup_entries・card_cup_matches)の形は変えない。行を消す命令(DELETE)は使わない。
-- 今の関数で中身を差し替えるのは2つだけ(引数と返り値の形は同じ。2026-10-31 2人へ知らせた):
--   card_cup_join        … 先頭に1行: 参加費のある杯は、払って入る card_cup_join_pay からだけ入れる(それ以外は 'fee')
--   card_cup_live_reward … ごほうびのある杯なら true(リアルタイム杯は、なぞり直しが合ったときだけ確定する口。ブレイブくんの #4356)
--
-- 決まり(社長):
--   ・出せる物は card_cup_prize_items の表のとおり(窓口が行を足して増やす。止めるときは enabled = false)
--   ・出す量・参加費の額に上限は付けない(2026-10-31 社長「やっぱり上限はなしでいい」)。持っている分なら、どの物もいくつでも。参加費にもどの物でも使える
--     (1回に預ける量だけ 10億まで。数の桁あふれを防ぐためで、遊びの上限ではない)
--   ・主催仲間はフレンドなら何人でも。主催と同じように動ける(持ち物を出す・合言葉を見る・参加費と配り方を決める・仲間を誘う/外す)
--     杯の取り消し(card_cup_cancel・預かった物が全員へ戻る)だけは主催だけ(今の関数のまま)
--   ・主催・主催仲間は参加費を払わず、ごほうびも受け取らない(配る順位に入れない。その分は次の順位の人へ)
--
-- 持ち物の名前(item)は、端末のギフトの種類と同じ言葉にそろえる(受け取りはギフトボックスへ入れる):
--   'diamond'(mh_gold)/ 'beatPoint'(mh_rhythm_event_points_v1)/ 'rainbowPsyche' / 'rainbowTranscendFruit' / 'dyeMock'
--   'gameItem:<アイテムid>'(mh_owned_items)/ 'card:shard'・'card:ticket'(mh_card_tactics_v1)/ 'card:catalog'(mh_card_catalogs_v1)

-- ---- 出せる物(上限は持たない。並び順と、止める印だけ) ----
create table if not exists public.card_cup_prize_items (
  item      text    not null,
  label     text    not null,
  sort      integer not null default 100,
  enabled   boolean not null default true,
  constraint card_cup_prize_items_pkey primary key (item),
  constraint card_cup_prize_items_shape check (item ~ '^(diamond|beatPoint|rainbowPsyche|rainbowTranscendFruit|dyeMock|gameItem:[a-z0-9_]{1,40}|card:(shard|ticket|catalog))$'
    and length(label) between 1 and 40)
);
insert into public.card_cup_prize_items (item, label, sort) values
  ('diamond', 'ダイヤ', 10),
  ('beatPoint', 'ビートP', 20),
  ('rainbowPsyche', '虹のプシュケー', 30),
  ('rainbowTranscendFruit', '虹の超越の実', 40),
  ('gameItem:hero_proof', '勇者の証', 50),
  ('gameItem:hero_proof_shard', '勇者の証片', 60),
  ('gameItem:session_ticket', 'セッション券', 70),
  ('gameItem:skip_ticket_jo', 'スキップチケット・序', 80),
  ('gameItem:skip_ticket_ha', 'スキップチケット・破', 81),
  ('gameItem:skip_ticket_kyu', 'スキップチケット・急', 82),
  ('gameItem:training_ticket', 'トレーニングチケット', 90),
  ('dyeMock', '染色もどき', 100),
  ('card:shard', '戦術カードのかけら', 110),
  ('card:ticket', 'カードパック券', 120),
  ('card:catalog', 'バトルカードカタログ', 130)
on conflict (item) do nothing;

-- ---- 主催仲間(行は消さず、状態で表す) ----
create table if not exists public.card_cup_hosts (
  cup_id     text        not null references public.card_cups (id),
  owner_id   text        not null,
  state      text        not null default 'invited',  -- 'invited' | 'joined' | 'declined' | 'removed'
  invited_by text,
  key_hash   text,
  user_name  text        not null default '',
  icon       text,
  at         timestamptz not null default now(),
  constraint card_cup_hosts_pkey primary key (cup_id, owner_id),
  constraint card_cup_hosts_shape check (state in ('invited', 'joined', 'declined', 'removed') and owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and length(user_name) <= 40)
);
create index if not exists card_cup_hosts_owner_idx on public.card_cup_hosts (owner_id);

-- ---- 杯ごとの参加費と配る割合 ----
create table if not exists public.card_cup_prizes (
  cup_id     text        not null references public.card_cups (id),
  fee_item   text        references public.card_cup_prize_items (item),
  fee_amount integer     not null default 0,
  split      integer[]   not null default array[70, 30],  -- 1位から。1つ1以上・合計100・8位まで
  updated_at timestamptz not null default now(),
  constraint card_cup_prizes_pkey primary key (cup_id),
  constraint card_cup_prizes_shape check (fee_amount >= 0 and fee_amount <= 1000000000 and (fee_amount = 0 or fee_item is not null) and array_length(split, 1) between 1 and 8)
);

-- ---- 預かった記録。1回預けるごとに1行。nonce(端末が作る長い文字)が鍵なので、同じ送り直しは1回分 ----
create table if not exists public.card_cup_deposits (
  nonce    text        not null,
  cup_id   text        not null references public.card_cups (id),
  owner_id text        not null,
  kind     text        not null,  -- 'prize'(主催・主催仲間が出した)| 'fee'(参加費)
  item     text        not null references public.card_cup_prize_items (item),
  amount   integer     not null,
  at       timestamptz not null default now(),
  constraint card_cup_deposits_pkey primary key (nonce),
  constraint card_cup_deposits_shape check (kind in ('prize', 'fee') and amount > 0 and amount <= 1000000000 and nonce ~ '^[0-9a-f]{32,64}$')
);
create index if not exists card_cup_deposits_cup_idx on public.card_cup_deposits (cup_id, owner_id);
-- 参加費は1杯1人1回だけ(抜けて入り直しても二重に取らない)
create unique index if not exists card_cup_deposits_fee_once_idx on public.card_cup_deposits (cup_id, owner_id) where kind = 'fee';

-- ---- 配った・戻した記録(1杯・1人で1行。最初の nonce だけに中身を返す) ----
create table if not exists public.card_cup_claims (
  cup_id   text        not null references public.card_cups (id),
  owner_id text        not null,
  items    jsonb       not null,  -- [{ "item": 'diamond', "amount": 1000 }, …]
  reason   text        not null,  -- 'prize' | 'refund' | 'none'
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

-- ==== 内側の部品(ゲームからは呼べない) ====
-- 持ち主の鍵(登録デッキと同じ鍵の md5)
create or replace function public.card_cup_key_ok(p_owner text, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_key is not null and exists (select 1 from card_deck_entries where owner_id = p_owner and key_hash = md5(p_key))
$$;
-- 主催か、受けた主催仲間か
create or replace function public.card_cup_is_host(p_cup text, p_owner text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from card_cups where id = p_cup and host_id = p_owner)
    or exists (select 1 from card_cup_hosts where cup_id = p_cup and owner_id = p_owner and state = 'joined')
$$;
-- 配る物の合計(返す人の分を除く: 抜けた・外された参加者の参加費 / 外された主催仲間の出した物)
create or replace function public.card_cup_pool(p_cup text)
returns table (item text, total bigint) language sql stable security definer set search_path = public as $$
  select d.item, sum(d.amount)::bigint from card_cup_deposits d
  where d.cup_id = p_cup
    and not (d.kind = 'fee' and exists (select 1 from card_cup_entries e where e.cup_id = p_cup and e.owner_id = d.owner_id and e.dropped))
    and not (d.kind = 'prize' and exists (select 1 from card_cup_hosts h where h.cup_id = p_cup and h.owner_id = d.owner_id and h.state = 'removed'))
  group by d.item
$$;
-- 配る順位に入る人(主催・主催仲間・抜けた人を除く)と、その中での順位(同じ順位は同じ数)
create or replace function public.card_cup_eligible(p_cup text)
returns table (owner_id text, rk integer) language sql stable security definer set search_path = public as $$
  select x.owner_id, (dense_rank() over (order by x.place))::int from card_cup_entries x
  where x.cup_id = p_cup and not x.dropped and x.place is not null and not card_cup_is_host(p_cup, x.owner_id)
$$;
-- 1人ずつの取り分(物ごと)。配る割合は、人数が足りず使わない順位の分を1位へ寄せる。
-- 同じ順位の人は、その順位の分を人数で分ける。割り切れない端数は1位の人へ(1位が何人かいれば、owner_id の順で先の人)
create or replace function public.card_cup_payouts(p_cup text)
returns table (owner_id text, item text, amount bigint) language plpgsql stable security definer set search_path = public as $$
declare v_split integer[]; v_n integer; v_k integer; v_pct integer[]; i integer; r record; v_t integer; v_each bigint; v_given bigint; v_first text; v_eachs bigint[];
begin
  select p.split into v_split from card_cup_prizes p where p.cup_id = p_cup;
  if v_split is null then v_split := array[70, 30]; end if;
  select coalesce(max(e.rk), 0) into v_n from card_cup_eligible(p_cup) e;
  if v_n = 0 then return; end if;
  v_k := least(array_length(v_split, 1), v_n);
  v_pct := v_split[1:v_k];
  for i in v_k + 1 .. array_length(v_split, 1) loop v_pct[1] := v_pct[1] + v_split[i]; end loop;
  select e.owner_id into v_first from card_cup_eligible(p_cup) e where e.rk = 1 order by e.owner_id limit 1;
  for r in select * from card_cup_pool(p_cup) loop
    v_given := 0; v_eachs := array[]::bigint[];
    for i in 1 .. v_k loop
      select count(*) into v_t from card_cup_eligible(p_cup) e where e.rk = i;
      v_each := case when v_t > 0 then floor(r.total::numeric * v_pct[i] / 100 / v_t)::bigint else 0 end;
      v_eachs := v_eachs || v_each;
      v_given := v_given + v_each * v_t;
    end loop;
    return query select e.owner_id, r.item, (v_eachs[e.rk] + case when e.owner_id = v_first then r.total - v_given else 0 end)::bigint
      from card_cup_eligible(p_cup) e where e.rk <= v_k and (v_eachs[e.rk] + case when e.owner_id = v_first then r.total - v_given else 0 end) > 0;
  end loop;
end $$;

-- ==== 差し替え1: ごほうびのある杯か(リアルタイム杯は、なぞり直しが合ったときだけ確定。ブレイブくんの #4356 の口) ====
create or replace function public.card_cup_live_reward(c public.card_cups)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from card_cup_deposits d where d.cup_id = c.id)
    or exists (select 1 from card_cup_prizes p where p.cup_id = c.id and p.fee_amount > 0)
$$;

-- ==== 差し替え2: card_cup_join(今の本文の先頭に「参加費のある杯」の1行を足しただけ。ほかは CARD_CUP_APPLY.sql と同じ) ====
create or replace function public.card_cup_join(p_cup text, p_owner text, p_key text, p_name text, p_icon text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.card_cups; d public.card_deck_entries; e public.card_cup_entries; v_hash text;
begin
  -- 参加費のある杯は、払って入る card_cup_join_pay からだけ(2026-10-31 リプレイくん・ごほうびと参加費)
  if exists (select 1 from card_cup_prizes where cup_id = p_cup and fee_amount > 0) and coalesce(current_setting('card_cup.paying', true), '') <> '1' then return 'fee'; end if;
  if p_owner is null or p_owner !~ '^[A-Za-z0-9_-]{1,64}$' or p_key is null or length(p_key) not between 24 and 128 or length(coalesce(p_name, '')) > 40 then return 'bad'; end if;
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  v_hash := md5(p_key);
  select * into d from card_deck_entries where owner_id = p_owner and active;
  if not found then return 'nodeck'; end if;
  if d.key_hash <> v_hash then return 'locked'; end if;
  select * into e from card_cup_entries where cup_id = p_cup and owner_id = p_owner;
  if found and e.key_hash <> v_hash then return 'locked'; end if;
  if found and not e.dropped then return 'ok'; end if;
  if (select count(*) from card_cup_entries where cup_id = p_cup and not dropped) >= c.max_players then return 'full'; end if;
  if (select count(*) from card_cup_entries x join card_cups y on y.id = x.cup_id where x.owner_id = p_owner and not x.dropped and y.status in ('entry', 'running')) >= 3 then return 'many'; end if;
  insert into card_cup_entries (cup_id, owner_id, key_hash, user_name, icon) values (p_cup, p_owner, v_hash, coalesce(p_name, ''), p_icon)
    on conflict (cup_id, owner_id) do update set dropped = false, user_name = excluded.user_name, icon = excluded.icon, entered_at = now();
  return 'ok';
end $$;

-- ==== ゲームから呼ぶ ====
-- 参加費と配る割合を決める(主催・主催仲間。受付中・まだだれも参加費を払っていないあいだだけ)
create or replace function public.card_cup_prize_set(p_cup text, p_owner text, p_key text, p_fee_item text, p_fee_amount integer, p_split integer[])
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; it card_cup_prize_items; s integer := 0; v integer;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  if not card_cup_is_host(p_cup, p_owner) or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  if exists (select 1 from card_cup_deposits where cup_id = p_cup and kind = 'fee') then return 'paid'; end if;
  if p_split is null or array_length(p_split, 1) is null or array_length(p_split, 1) > 8 then return 'bad'; end if;
  foreach v in array p_split loop if v is null or v < 1 then return 'bad'; end if; s := s + v; end loop;
  if s <> 100 then return 'bad'; end if;
  if coalesce(p_fee_amount, 0) > 0 then
    select * into it from card_cup_prize_items where item = p_fee_item and enabled;
    if not found or p_fee_amount > 1000000000 then return 'bad'; end if;
  end if;
  insert into card_cup_prizes (cup_id, fee_item, fee_amount, split)
    values (p_cup, case when coalesce(p_fee_amount, 0) > 0 then p_fee_item end, greatest(coalesce(p_fee_amount, 0), 0), p_split)
    on conflict (cup_id) do update set fee_item = excluded.fee_item, fee_amount = excluded.fee_amount, split = excluded.split, updated_at = now();
  return 'ok';
end $$;

-- 主催仲間を誘う(主催・主催仲間が、自分のフレンドを。何人でも)
create or replace function public.card_cup_cohost_invite(p_cup text, p_owner text, p_key text, p_friend text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; h card_cup_hosts;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  if not card_cup_is_host(p_cup, p_owner) or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  if p_friend is null or p_friend !~ '^[A-Za-z0-9_-]{1,64}$' or p_friend = p_owner or p_friend = c.host_id then return 'bad'; end if;
  if not exists (select 1 from friend_links where status = 'accepted'
    and least(requester_id, target_id) = least(p_owner, p_friend) and greatest(requester_id, target_id) = greatest(p_owner, p_friend)) then return 'notfriend'; end if;
  select * into h from card_cup_hosts where cup_id = p_cup and owner_id = p_friend;
  if found and h.state = 'joined' then return 'ok'; end if;
  insert into card_cup_hosts (cup_id, owner_id, state, invited_by) values (p_cup, p_friend, 'invited', p_owner)
    on conflict (cup_id, owner_id) do update set state = 'invited', invited_by = excluded.invited_by, at = now();
  return 'ok';
end $$;
-- 誘われた人が受ける・断る
create or replace function public.card_cup_cohost_answer(p_cup text, p_owner text, p_key text, p_accept boolean, p_name text, p_icon text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; h card_cup_hosts;
begin
  select * into c from card_cups where id = p_cup;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  select * into h from card_cup_hosts where cup_id = p_cup and owner_id = p_owner for update;
  if not found or h.state <> 'invited' then return 'none'; end if;
  if not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  update card_cup_hosts set state = case when p_accept then 'joined' else 'declined' end, key_hash = md5(p_key),
    user_name = left(coalesce(p_name, ''), 40), icon = left(p_icon, 64), at = now() where cup_id = p_cup and owner_id = p_owner;
  return 'ok';
end $$;
-- 主催仲間を外す(主催・主催仲間。自分を外すのもよい)。外れた人が出していた物は、その人の受け取りで戻る
create or replace function public.card_cup_cohost_remove(p_cup text, p_owner text, p_key text, p_target text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups;
begin
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  if not card_cup_is_host(p_cup, p_owner) or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  if p_target = c.host_id then return 'host'; end if;
  update card_cup_hosts set state = 'removed', at = now() where cup_id = p_cup and owner_id = p_target and state in ('invited', 'joined');
  return 'ok';
end $$;

-- 預ける(主催・主催仲間のごほうび)。返り値 'ok' | 'dup'(同じ nonce)| 'closed' | 'locked' | 'bad'
create or replace function public.card_cup_deposit(p_cup text, p_owner text, p_key text, p_item text, p_amount integer, p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare c card_cups; it card_cup_prize_items;
begin
  if p_nonce is null or p_nonce !~ '^[0-9a-f]{32,64}$' then return 'bad'; end if;
  if exists (select 1 from card_cup_deposits where nonce = p_nonce) then return 'dup'; end if;
  select * into c from card_cups where id = p_cup for update;
  if not found or c.status <> 'entry' or now() >= c.entry_until then return 'closed'; end if;
  if not card_cup_is_host(p_cup, p_owner) or not card_cup_key_ok(p_owner, p_key) then return 'locked'; end if;
  select * into it from card_cup_prize_items where item = p_item and enabled;
  if not found or p_amount is null or p_amount < 1 or p_amount > 1000000000 then return 'bad'; end if;
  insert into card_cup_deposits (nonce, cup_id, owner_id, kind, item, amount) values (p_nonce, p_cup, p_owner, 'prize', p_item, p_amount);
  return 'ok';
end $$;

-- 参加(参加費のある杯は、参加と参加費を1回で)。参加費の無い杯・主催・主催仲間は、ふつうの参加と同じ('nofee')
-- 返り値: card_cup_join と同じ + 'nofee'(払わずに入った)| 'dup'(同じ nonce)| 'paid'(前に払った分のまま入り直した)
create or replace function public.card_cup_join_pay(p_cup text, p_owner text, p_key text, p_name text, p_icon text, p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare p card_cup_prizes; it card_cup_prize_items; r text;
begin
  if p_nonce is null or p_nonce !~ '^[0-9a-f]{32,64}$' then return 'bad'; end if;
  if exists (select 1 from card_cup_deposits where nonce = p_nonce) then return 'dup'; end if;
  perform set_config('card_cup.paying', '1', true);  -- card_cup_join に「払って入る途中」と知らせる(この取引の中だけ)
  select * into p from card_cup_prizes where cup_id = p_cup;
  if not found or p.fee_amount = 0 or card_cup_is_host(p_cup, p_owner) then
    r := card_cup_join(p_cup, p_owner, p_key, p_name, p_icon);
    return case when r = 'ok' then 'nofee' else r end;
  end if;
  select * into it from card_cup_prize_items where item = p.fee_item and enabled;
  if not found then return 'bad'; end if;
  if exists (select 1 from card_cup_deposits where cup_id = p_cup and owner_id = p_owner and kind = 'fee') then
    r := card_cup_join(p_cup, p_owner, p_key, p_name, p_icon);
    return case when r = 'ok' then 'paid' else r end;
  end if;
  r := card_cup_join(p_cup, p_owner, p_key, p_name, p_icon);
  if r <> 'ok' then return r; end if;
  insert into card_cup_deposits (nonce, cup_id, owner_id, kind, item, amount) values (p_nonce, p_cup, p_owner, 'fee', p.fee_item, p.fee_amount);
  return 'ok';
end $$;

-- 受け取り・戻し。返り値 { status:'ok'|'claimed'|'wait'|'locked'|'none'|'bad', reason, items:[{item, amount}] }
--   同じ nonce なら何度でも同じ中身(返事が途中で切れても、送り直せば受け取れる)。ちがう nonce には中身を返さない(二重に受け取れない)
create or replace function public.card_cup_claim(p_cup text, p_owner text, p_key text, p_nonce text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c card_cups; cl card_cup_claims; e card_cup_entries; v_items jsonb := '[]'::jsonb; v_reason text := 'none'; v_refund boolean;
begin
  if p_nonce is null or p_nonce !~ '^[0-9a-f]{32,64}$' or p_owner is null then return jsonb_build_object('status', 'bad'); end if;
  select * into cl from card_cup_claims where cup_id = p_cup and owner_id = p_owner;
  if found then
    if cl.nonce = p_nonce then return jsonb_build_object('status', 'ok', 'reason', cl.reason, 'items', cl.items); end if;
    return jsonb_build_object('status', 'claimed');
  end if;
  if not card_cup_key_ok(p_owner, p_key) then return jsonb_build_object('status', 'locked'); end if;
  select * into c from card_cups where id = p_cup for update;
  if not found then return jsonb_build_object('status', 'none'); end if;
  select * into e from card_cup_entries where cup_id = p_cup and owner_id = p_owner;
  -- 戻す: 取り消し・人数不足 / 受付が終わってから見て抜けていた(受付中に抜けた・デッキが壊れて外れた) / 外された主催仲間 / 配る人がいない杯
  v_refund := c.status = 'closed'
    or (c.status in ('running', 'done') and e.owner_id is not null and e.dropped)
    or exists (select 1 from card_cup_hosts h where h.cup_id = p_cup and h.owner_id = p_owner and h.state = 'removed')
    or (c.status = 'done' and not exists (select 1 from card_cup_eligible(p_cup)));
  if v_refund then
    select coalesce(jsonb_agg(jsonb_build_object('item', t.item, 'amount', t.total) order by t.item), '[]'::jsonb) into v_items
      from (select d.item, sum(d.amount)::bigint as total from card_cup_deposits d where d.cup_id = p_cup and d.owner_id = p_owner group by d.item) t;
    v_reason := case when jsonb_array_length(v_items) > 0 then 'refund' else 'none' end;
  elsif c.status = 'done' and (c.mode <> 'auto' or now() >= c.start_at) then
    select coalesce(jsonb_agg(jsonb_build_object('item', t.item, 'amount', t.amount) order by t.item), '[]'::jsonb) into v_items
      from card_cup_payouts(p_cup) t where t.owner_id = p_owner;
    v_reason := case when jsonb_array_length(v_items) > 0 then 'prize' else 'none' end;
  else
    return jsonb_build_object('status', 'wait');
  end if;
  insert into card_cup_claims (cup_id, owner_id, items, reason, nonce) values (p_cup, p_owner, v_items, v_reason, p_nonce);
  return jsonb_build_object('status', 'ok', 'reason', v_reason, 'items', v_items);
end $$;

-- 杯のごほうびを見せる(一覧・参加・結果の画面)。だれでも読める。合言葉と誘っている人は、主催・主催仲間にだけ
--   { fee:{item, amount}|null, split:[…], pool:[{item, total}], givers:[{name, icon, item, amount, host}], hosts:[{id, name, icon, state}],
--     me:{ host, invited, claimed }, code(主催・主催仲間だけ), payouts(終わった杯だけ:[{id, item, amount}]) }
create or replace function public.card_cup_prize_view(p_cup text, p_owner text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c card_cups; v_host boolean; v_out jsonb;
begin
  select * into c from card_cups where id = p_cup;
  if not found then return null; end if;
  v_host := p_owner is not null and card_cup_is_host(p_cup, p_owner);
  v_out := jsonb_build_object(
    'fee', (select case when fee_amount > 0 then jsonb_build_object('item', fee_item, 'amount', fee_amount) end from card_cup_prizes where cup_id = p_cup),
    'split', coalesce((select to_jsonb(split) from card_cup_prizes where cup_id = p_cup), '[70,30]'::jsonb),
    'pool', (select coalesce(jsonb_agg(jsonb_build_object('item', t.item, 'total', t.total) order by t.item), '[]'::jsonb) from card_cup_pool(p_cup) t),
    'givers', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'icon', g.icon, 'item', g.item, 'amount', g.amount, 'host', g.host) order by g.host desc, g.name), '[]'::jsonb) from (
      select coalesce(nullif(h.user_name, ''), case when d.owner_id = c.host_id then c.host_name end, 'ブリーダー') as name,
        coalesce(h.icon, case when d.owner_id = c.host_id then c.host_icon end) as icon, d.item, sum(d.amount)::bigint as amount, d.owner_id = c.host_id as host
      from card_cup_deposits d left join card_cup_hosts h on h.cup_id = d.cup_id and h.owner_id = d.owner_id
      where d.cup_id = p_cup and d.kind = 'prize' and coalesce(h.state, 'joined') <> 'removed'
      group by d.owner_id, h.user_name, h.icon, d.item) g),
    'hosts', (select coalesce(jsonb_agg(jsonb_build_object('id', owner_id, 'name', user_name, 'icon', icon, 'state', state) order by at), '[]'::jsonb)
      from card_cup_hosts where cup_id = p_cup and (state = 'joined' or (v_host and state = 'invited'))),
    'me', jsonb_build_object('host', v_host,
      'invited', p_owner is not null and exists (select 1 from card_cup_hosts where cup_id = p_cup and owner_id = p_owner and state = 'invited'),
      'claimed', p_owner is not null and exists (select 1 from card_cup_claims where cup_id = p_cup and owner_id = p_owner)));
  if v_host then v_out := v_out || jsonb_build_object('code', c.code); end if;
  if c.status = 'done' and (c.mode <> 'auto' or now() >= c.start_at) then
    v_out := v_out || jsonb_build_object('payouts', (select coalesce(jsonb_agg(jsonb_build_object('id', t.owner_id, 'item', t.item, 'amount', t.amount)), '[]'::jsonb) from card_cup_payouts(p_cup) t));
  end if;
  return v_out;
end $$;

-- 主催仲間として誘われている・入っている杯(受付中・開催中と、終わって30日まで)
create or replace function public.card_cup_hosting_of(p_owner text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card_cup_row(c) || jsonb_build_object('host_state', h.state) order by c.start_at desc), '[]'::jsonb)
  from card_cup_hosts h join card_cups c on c.id = h.cup_id
  where h.owner_id = p_owner and h.state in ('invited', 'joined')
    and (c.status in ('entry', 'running') or coalesce(c.done_at, c.updated_at) > now() - interval '30 days')
$$;

-- 出せる物の一覧(画面の「出す物をえらぶ」)
create or replace function public.card_cup_prize_items_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', item, 'label', label) order by sort, item), '[]'::jsonb)
  from card_cup_prize_items where enabled
$$;

revoke all on function public.card_cup_key_ok(text, text) from public, anon, authenticated;
revoke all on function public.card_cup_is_host(text, text) from public, anon, authenticated;
revoke all on function public.card_cup_pool(text) from public, anon, authenticated;
revoke all on function public.card_cup_eligible(text) from public, anon, authenticated;
revoke all on function public.card_cup_payouts(text) from public, anon, authenticated;
revoke all on function public.card_cup_live_reward(public.card_cups) from public, anon, authenticated;
revoke all on function public.card_cup_join(text, text, text, text, text) from public;
grant execute on function public.card_cup_join(text, text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_prize_set(text, text, text, text, integer, integer[]) to anon, authenticated;
grant execute on function public.card_cup_cohost_invite(text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_cohost_answer(text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.card_cup_cohost_remove(text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_deposit(text, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.card_cup_join_pay(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_claim(text, text, text, text) to anon, authenticated;
grant execute on function public.card_cup_prize_view(text, text) to anon, authenticated;
grant execute on function public.card_cup_hosting_of(text) to anon, authenticated;
grant execute on function public.card_cup_prize_items_list() to anon, authenticated;
