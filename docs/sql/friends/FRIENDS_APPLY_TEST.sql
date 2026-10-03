-- フレンド機能のテーブル(friend_codes / friend_links / friend_invites)を追加するSQLの【予行演習】。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(FRIENDS_APPLY.sql)の前にこちらを通す。
--
-- 既存のテーブル(rankings / bond_levels / breeder_profiles)には一切触らない。新しいテーブルを3つ作るだけ。
-- これをエラー無く通してから FRIENDS_APPLY.sql(末尾 commit;)を実行する。
--
-- しくみ:
--   friend_codes … 1人1行。ブリーダーID(breeder_id)に、人に伝えやすい8文字のフレンドコードを結びつける。
--   friend_links … 2人のあいだの関係を「1組1行」で持つ。申請・承認・断り・ブロック・解除を status で表す。
--   friend_invites … モンヒロビートのマルチ(プライベートルーム)への招待。送る人→受ける人ごとに1行(最新の1件だけ)。
--
-- ★ログインの仕組みは無い(端末ごとのブリーダーIDだけで人を見分けている)ので、rankings / breeder_profiles と同じく
--   公開キーの anon が読み書きできる。そのため「他人になりすまして関係を書き換える」ことまでは防げない。
--   ここで守っているのは「消せない(DELETEを与えない)」「1組は1行まで」「ありえない値を弾く」の3点。
-- ★消す権限は与えない。フレンド解除も行は消さず、status を 'removed' にする。
--   招待は同じ2人のあいだで上書きされる(古い招待が残り続けることはない。アプリは3分より古い招待を無視する)。
--
-- 先に必要なSQL: BREEDER_PROFILE_APPLY.sql(breeder_profiles があること。フレンドの名前・アイコンはそこから引く)

begin;

do $$
begin
  if to_regclass('public.breeder_profiles') is null then
    raise exception 'public.breeder_profiles がありません。先に docs/sql/rankings/BREEDER_PROFILE_APPLY.sql を適用してください。';
  end if;
end $$;

-- 既に別物の同名テーブルがある環境では、上書きせず安全側で停止する。
do $$
begin
  if to_regclass('public.friend_codes') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='friend_codes' and column_name='friend_code') then
    raise exception 'public.friend_codes が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
  if to_regclass('public.friend_links') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='friend_links' and column_name='requester_id') then
    raise exception 'public.friend_links が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
  if to_regclass('public.friend_invites') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='friend_invites' and column_name='room_code') then
    raise exception 'public.friend_invites が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

-- ===== ① フレンドコード =====
-- 文字は、まぎらわしい 0/O・1/I を抜いた32種(部屋コードと同じ並び)。8文字。
create table if not exists public.friend_codes (
  breeder_id  text        not null,
  friend_code text        not null,
  created_at  timestamptz not null default now(),
  constraint friend_codes_pkey primary key (breeder_id),
  constraint friend_codes_code_key unique (friend_code),
  constraint friend_codes_breeder_id_shape check (length(breeder_id) between 1 and 100),
  constraint friend_codes_code_shape check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$')
);

comment on table public.friend_codes is
  'ブリーダーID(端末ごとのID)とフレンドコード(8文字)の対応。1人1行。コードは一度決めたら変えない。';

-- ===== ② フレンドの関係 =====
-- 1組(2人)につき1行。申請した側が requester_id、された側が target_id。
-- status: pending=申請中 / accepted=フレンド / declined=断った / blocked=ブロック / removed=解除した
-- blocked_by: ブロックしたほうのID(status が blocked のときだけ入る)
create table if not exists public.friend_links (
  requester_id text        not null,
  target_id    text        not null,
  status       text        not null default 'pending',
  blocked_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint friend_links_pkey primary key (requester_id, target_id),
  constraint friend_links_id_shape check (
    length(requester_id) between 1 and 100 and length(target_id) between 1 and 100),
  constraint friend_links_not_self check (requester_id <> target_id),
  constraint friend_links_status_values check (status in ('pending','accepted','declined','blocked','removed')),
  constraint friend_links_blocked_by_rule check (
    (status = 'blocked' and coalesce(blocked_by in (requester_id, target_id), false))
    or (status <> 'blocked' and blocked_by is null))
);

comment on table public.friend_links is
  'フレンドの関係。2人で1行(向きは問わない)。申請・承認・断り・ブロック・解除を status で表し、行そのものは消さない。';

-- 「AからB」と「BからA」を別の行にさせない(1組は1行まで)。
create unique index if not exists friend_links_pair_uidx
  on public.friend_links (least(requester_id, target_id), greatest(requester_id, target_id));
-- 自分に関係する行を引くための索引(requester_id は主キーが効く)
create index if not exists friend_links_target_idx
  on public.friend_links (target_id);

-- 上書きのたびに updated_at を進める
create or replace function public.friend_links_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists friend_links_set_updated_at on public.friend_links;
create trigger friend_links_set_updated_at
  before insert or update on public.friend_links
  for each row execute function public.friend_links_touch_updated_at();

-- ===== ②-2 マルチへの招待 =====
-- 部屋コードは4文字(モンヒロビートのマルチの部屋コードと同じ並び)。
-- 同じ2人のあいだの招待は1行に上書きする。created_at は上書きのたびに現在時刻へ進める(下のトリガー)。
create table if not exists public.friend_invites (
  sender_id  text        not null,
  target_id  text        not null,
  room_code  text        not null,
  created_at timestamptz not null default now(),
  constraint friend_invites_pkey primary key (sender_id, target_id),
  constraint friend_invites_id_shape check (
    length(sender_id) between 1 and 100 and length(target_id) between 1 and 100),
  constraint friend_invites_not_self check (sender_id <> target_id),
  constraint friend_invites_code_shape check (room_code ~ '^[A-HJ-NP-Z2-9]{4}$')
);

comment on table public.friend_invites is
  'マルチ(プライベートルーム)への招待。送る人→受ける人ごとに最新の1件だけ。アプリは3分より古い招待を無視する。';

create index if not exists friend_invites_target_idx
  on public.friend_invites (target_id, created_at desc);

create or replace function public.friend_invites_touch_created_at()
returns trigger language plpgsql as $$
begin
  new.created_at := now();
  return new;
end $$;

drop trigger if exists friend_invites_set_created_at on public.friend_invites;
create trigger friend_invites_set_created_at
  before insert or update on public.friend_invites
  for each row execute function public.friend_invites_touch_created_at();

-- ===== ③ 権限 =====
-- 読み書きは rankings / breeder_profiles と同じ考え方(公開キーの anon が触れる)。
-- 消す権限は与えない。間違って書き始めても、行が消えることはない。
alter table public.friend_codes enable row level security;
alter table public.friend_links enable row level security;
alter table public.friend_invites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_codes' and policyname='anyone can read friend codes') then
    create policy "anyone can read friend codes"
      on public.friend_codes for select using (true);
  end if;
  -- コードは一度決めたら変えない(UPDATEは与えない)。登録だけ。
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_codes' and policyname='anyone can insert friend codes') then
    create policy "anyone can insert friend codes"
      on public.friend_codes for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_links' and policyname='anyone can read friend links') then
    create policy "anyone can read friend links"
      on public.friend_links for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_links' and policyname='anyone can insert friend links') then
    create policy "anyone can insert friend links"
      on public.friend_links for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_links' and policyname='anyone can update friend links') then
    create policy "anyone can update friend links"
      on public.friend_links for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_invites' and policyname='anyone can read friend invites') then
    create policy "anyone can read friend invites"
      on public.friend_invites for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_invites' and policyname='anyone can insert friend invites') then
    create policy "anyone can insert friend invites"
      on public.friend_invites for insert with check (true);
  end if;
  -- 同じ2人のあいだの招待を上書きするために要る(on_conflict のupsertがUPDATEを使う)
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='friend_invites' and policyname='anyone can update friend invites') then
    create policy "anyone can update friend invites"
      on public.friend_invites for update using (true) with check (true);
  end if;
end $$;

grant select, insert on public.friend_codes to anon, authenticated;
grant select, insert, update on public.friend_links to anon, authenticated;
grant select, insert, update on public.friend_invites to anon, authenticated;
-- 削除は与えない(与えていないことを下の検査で確かめる)
revoke delete on public.friend_codes from anon, authenticated;
revoke delete on public.friend_links from anon, authenticated;
revoke delete on public.friend_invites from anon, authenticated;
revoke update on public.friend_codes from anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====
do $$
declare
  cnt int;
begin
  if to_regclass('public.friend_codes') is null then raise exception 'friend_codes が作られていません'; end if;
  if to_regclass('public.friend_links') is null then raise exception 'friend_links が作られていません'; end if;
  if to_regclass('public.friend_invites') is null then raise exception 'friend_invites が作られていません'; end if;

  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='friend_codes'
     and column_name in ('breeder_id','friend_code','created_at');
  if cnt <> 3 then raise exception 'friend_codes の列がそろっていません(%件)', cnt; end if;

  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='friend_links'
     and column_name in ('requester_id','target_id','status','blocked_by','created_at','updated_at');
  if cnt <> 6 then raise exception 'friend_links の列がそろっていません(%件)', cnt; end if;

  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='friend_invites'
     and column_name in ('sender_id','target_id','room_code','created_at');
  if cnt <> 4 then raise exception 'friend_invites の列がそろっていません(%件)', cnt; end if;

  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname in ('friend_codes','friend_links','friend_invites') and c.relrowsecurity) <> 3 then
    raise exception 'フレンドの表のRLSが有効になっていません';
  end if;

  if exists (select 1 from information_schema.role_table_grants
              where table_schema='public' and table_name in ('friend_codes','friend_links','friend_invites')
                and grantee in ('anon','authenticated') and privilege_type='DELETE') then
    raise exception 'フレンドの表に削除の権限が付いています';
  end if;

  -- 既存のテーブルに触っていないこと
  if to_regclass('public.breeder_profiles') is null then
    raise exception 'breeder_profiles が見当たりません(既存テーブルを壊した可能性)';
  end if;

  -- 実際に書けて、制約が効いていること
  insert into public.friend_codes (breeder_id, friend_code) values ('__apply_check_a__', 'AAAA2222');
  begin
    insert into public.friend_codes (breeder_id, friend_code) values ('__apply_check_b__', 'AAAA2222');
    raise exception '同じフレンドコードが2人に付けられました(重複を弾けていません)';
  exception when unique_violation then null;
  end;
  begin
    insert into public.friend_codes (breeder_id, friend_code) values ('__apply_check_c__', 'abc');
    raise exception '形の違うフレンドコードが入りました';
  exception when check_violation then null;
  end;

  insert into public.friend_links (requester_id, target_id) values ('__apply_check_a__', '__apply_check_b__');
  begin
    insert into public.friend_links (requester_id, target_id) values ('__apply_check_b__', '__apply_check_a__');
    raise exception '逆向きの行が別に作られました(1組1行になっていません)';
  exception when unique_violation then null;
  end;
  begin
    insert into public.friend_links (requester_id, target_id) values ('__apply_check_a__', '__apply_check_a__');
    raise exception '自分自身への申請が入りました';
  exception when check_violation then null;
  end;
  update public.friend_links set status = 'accepted'
   where requester_id = '__apply_check_a__' and target_id = '__apply_check_b__';
  begin
    update public.friend_links set status = 'blocked'
     where requester_id = '__apply_check_a__' and target_id = '__apply_check_b__';
    raise exception 'blocked_by 無しのブロックが入りました';
  exception when check_violation then null;
  end;
  update public.friend_links set status = 'blocked', blocked_by = '__apply_check_b__'
   where requester_id = '__apply_check_a__' and target_id = '__apply_check_b__';

  -- 招待: 同じ2人は1行に上書きされ、created_at が進む。形の違う部屋コードは弾く
  insert into public.friend_invites (sender_id, target_id, room_code) values ('__apply_check_a__', '__apply_check_b__', 'AB23');
  insert into public.friend_invites (sender_id, target_id, room_code) values ('__apply_check_a__', '__apply_check_b__', 'CD45')
  on conflict (sender_id, target_id) do update set room_code = excluded.room_code;
  select count(*) into cnt from public.friend_invites where sender_id = '__apply_check_a__';
  if cnt <> 1 then raise exception '同じ2人の招待が2行になりました(1行で上書きされていません)'; end if;
  begin
    insert into public.friend_invites (sender_id, target_id, room_code) values ('__apply_check_a__', '__apply_check_c__', 'ab1');
    raise exception '形の違う部屋コードの招待が入りました';
  exception when check_violation then null;
  end;

  delete from public.friend_invites where sender_id like '\_\_apply\_check\_%';
  delete from public.friend_links where requester_id like '\_\_apply\_check\_%';
  delete from public.friend_codes where breeder_id like '\_\_apply\_check\_%';
end $$;

-- 追加した内容をまとめて表示する。
with facts as (
  select 1 as sort, 'friend_codes テーブル' as item,
         (select case when to_regclass('public.friend_codes') is null then 'なし' else 'あり' end) as value
  union all
  select 2, 'friend_links / friend_invites テーブル',
         (select (case when to_regclass('public.friend_links') is null then 'なし' else 'あり' end)
              ||' / '||(case when to_regclass('public.friend_invites') is null then 'なし' else 'あり' end))
  union all
  select 3, 'friend_codes の列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns where table_schema='public' and table_name='friend_codes')
  union all
  select 4, 'friend_links の列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns where table_schema='public' and table_name='friend_links')
  union all
  select 5, 'RLS(3つとも有効なら 3)',
         (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname in ('friend_codes','friend_links','friend_invites') and c.relrowsecurity)
  union all
  select 6, 'ポリシー',
         (select coalesce(string_agg(tablename||':'||policyname||'('||cmd||')', ', ' order by tablename, policyname), 'なし')
          from pg_policies where schemaname='public' and tablename in ('friend_codes','friend_links','friend_invites'))
  union all
  select 7, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct table_name||':'||grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name in ('friend_codes','friend_links','friend_invites')
            and grantee in ('anon','authenticated'))
  union all
  select 8, 'friend_codes / friend_links / friend_invites の件数(最初は0)',
         (select (select count(*) from public.friend_codes)::text||' / '||(select count(*) from public.friend_links)::text||' / '||(select count(*) from public.friend_invites)::text)
  union all
  select 9, 'breeder_profiles の件数(触っていないこと)',
         (select count(*)::text from public.breeder_profiles)
  union all
  select 10, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
