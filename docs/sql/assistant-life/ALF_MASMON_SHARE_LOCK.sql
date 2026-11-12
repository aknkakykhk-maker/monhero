-- 助手ライフ: alf_masmon_share を「持ち主の鍵」でしか書けないようにする(案B・2026-11-12 オトズレ。ミハリ4のメモへの答え)
-- まだ流さない。窓口が社長に選んでもらってから。前半(足すだけ)と後半(既存の権限を変える)に分かれている。
-- 鍵: 端末が作る長い文字列(新しいキー mh_alf_masmon_share_key_v1)。表には md5 の指紋だけを置く(card_deck_entries と同じ考え方)。
-- 最初に書いた端末の鍵がその人の鍵になる。鍵をなくした人は、窓口が alf_masmon_share_keys のその人の1行だけ消して戻す(毎回社長に確認)。

-- ===== 前半: 足すだけ =====
create table if not exists public.alf_masmon_share_keys (
  breeder_id text        primary key,
  key_hash   text        not null,
  created_at timestamptz not null default now(),
  constraint alf_masmon_share_keys_id_shape check (length(breeder_id) between 1 and 100)
);
alter table public.alf_masmon_share_keys enable row level security;
revoke all on public.alf_masmon_share_keys from anon, authenticated;

-- 書き込みの口。返り値: 'ok' | 'bad' | 'locked'
create or replace function public.alf_masmon_share_put(p_breeder text, p_key text, p_aid text, p_body jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare cur_hash text;
begin
  if p_breeder is null or length(p_breeder) not between 1 and 100 or p_key is null or length(p_key) not between 24 and 128
    or p_aid is null or p_aid !~ '^[a-z0-9_]{1,24}$'
    or p_body is null or jsonb_typeof(p_body) <> 'object' or length(p_body::text) > 5000 then
    return 'bad';
  end if;
  select key_hash into cur_hash from public.alf_masmon_share_keys where breeder_id = p_breeder for update;
  if not found then
    insert into public.alf_masmon_share_keys (breeder_id, key_hash) values (p_breeder, md5(p_key));
  elsif cur_hash <> md5(p_key) then
    return 'locked';
  end if;
  insert into public.alf_masmon_share (breeder_id, assistant_id, body) values (p_breeder, p_aid, p_body)
    on conflict (breeder_id, assistant_id) do update set body = excluded.body;
  return 'ok';
end $$;
revoke all on function public.alf_masmon_share_put(text, text, text, jsonb) from public;
grant execute on function public.alf_masmon_share_put(text, text, text, jsonb) to anon, authenticated;

-- ===== 後半: 既存の権限を変える(社長の確認が要る)。端末が口を使う版を公開してから流す =====
-- revoke insert, update on public.alf_masmon_share from anon, authenticated;
-- drop policy if exists "alf masmon share insert" on public.alf_masmon_share;
-- drop policy if exists "alf masmon share update" on public.alf_masmon_share;
