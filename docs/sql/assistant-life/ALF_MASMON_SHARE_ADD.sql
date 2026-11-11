-- 助手ライフ: フレンドの家で「その人の助手のマスモン」をくわしく見せる表(2026-11-12 社長・オトズレ)
-- 案: docs/progress/assistant-peer/FRIEND-SHOWCASE-PLAN.md
-- 足すだけ。DROP なし。既存の表(assistant_life_friend_houses・assistant_life_friend_house_more)は消さず・書き換えない。
-- 1人 × 助手 で1行。中身(body)は端末が作る: { v, ms:[マスモン], dk:[デッキ3つ] } か、見せない設定のときは { v, off:1 }。
-- 端末は「変わった助手の行だけ」上書きする。読むのはフレンドがその家の部屋で「🐾 マスモン」を開いたときの1行だけ。
-- 表が無い・行が無いときは、端末は今までどおり(絵と名前だけ)で動く。
create table if not exists public.alf_masmon_share (
  breeder_id   text        not null,
  assistant_id text        not null,
  body         jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  constraint alf_masmon_share_pkey primary key (breeder_id, assistant_id),
  constraint alf_masmon_share_id_shape check (length(breeder_id) between 1 and 100 and assistant_id ~ '^[a-z0-9_]{1,24}$'),
  constraint alf_masmon_share_object check (jsonb_typeof(body) = 'object'),
  constraint alf_masmon_share_size check (length(body::text) <= 5000)
);
comment on table public.alf_masmon_share is
  '助手ライフ: その人の助手のマスモン(Lv・型・6能力など)とデッキ3つの写し。1人×助手で1行を端末が上書きする。フレンドが家の部屋で開いたときだけ読む。';

-- 更新日の見張り(alf_more_touch と同じ考え方。新しい名前の関数)
create or replace function public.alf_masmon_share_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.breeder_id is distinct from old.breeder_id or new.assistant_id is distinct from old.assistant_id) then
    raise exception 'breeder_id・assistant_id は変えられません';
  end if;
  new.updated_at := now();
  return new;
end $$;
create or replace trigger alf_masmon_share_touch before insert or update on public.alf_masmon_share
  for each row execute function public.alf_masmon_share_touch();

-- 権限(控えの表と同じ: 読む・足す・上書き。消す権限は無し。見せない設定は { off:1 } で上書きする)
alter table public.alf_masmon_share enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alf_masmon_share' and policyname='alf masmon share read') then
    create policy "alf masmon share read"   on public.alf_masmon_share for select using (true);
    create policy "alf masmon share insert" on public.alf_masmon_share for insert with check (true);
    create policy "alf masmon share update" on public.alf_masmon_share for update using (true) with check (true);
  end if;
end $$;
revoke all on public.alf_masmon_share from anon, authenticated;
grant select, insert, update on public.alf_masmon_share to anon, authenticated;
