-- ブリーダーLvを1人1行で持つテーブル public.breeder_levels を追加するSQLの【予行演習】。
-- 読み取り専用: いいえ(ただし末尾でrollbackするため、本番には何も残らない)。
-- 本番変更が残るか: いいえ。実適用(BREEDER_LEVELS_APPLY.sql)の前にこちらを通す。
--
-- 既存のテーブル(rankings / bond_levels / breeder_profiles)には一切触らない。新しいテーブルを1つ作るだけ。
-- これをエラー無く通してから BREEDER_LEVELS_APPLY.sql(末尾 commit;)を実行する。
--
-- なぜ作るのか:
--   ブリーダーLvのランキングは、今は rankings(チャレンジなどの1プレイ＝1行)の level を全部読んで並べている。
--   そのため、裏周回やMFバトルカードだけで遊んでいて rankings に1行も送っていない人は、Lvが高くても載らない
--   (2026-10-27・社長の決定「ブリーダーLvランキングに、裏周回・MFバトルカードだけの人も載るようにする」)。
--   そこで、ゲームが「レベルが上がった時」と「ゲームを開いた時」に、今のLvだけをこの表へ1行で送る。
--   ランキングはこの表から並べ、まだこの表に来ていない人は今までどおり rankings の level で補う。
--
-- ★記録(rankings / bond_levels / breeder_profiles)は1行も書き換えない。順位・スコア・集計にも関わらない。
-- ★1人1行しか増えない(送るたびに増えることはない)。
-- ★レベルは下がらない(古い端末が低いLvを送り直しても、高いほうが残る)。
-- ★消す権限は与えない(間違って書き始めても、行が消えることはない)。
--
-- 先に必要なSQL: BREEDER_ID_APPLY.sql(端末ごとのブリーダーIDを送るようになっていること)

begin;

do $$
begin
  if to_regclass('public.rankings') is null then
    raise exception 'public.rankings がありません。先に RANKINGS_APPLY.sql を適用してください。';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='rankings' and column_name='breeder_id') then
    raise exception 'public.rankings.breeder_id がありません。先に BREEDER_ID_APPLY.sql を適用してください。';
  end if;
end $$;

-- 既に別物の breeder_levels がある環境では、上書きせず安全側で停止する。
do $$
begin
  if to_regclass('public.breeder_levels') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='breeder_levels' and column_name='breeder_id') then
    raise exception 'public.breeder_levels が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

-- ===== ① テーブル =====
-- breeder_id は端末ごとに1回だけ作るID(mh_breeder_id_v1)。名前を変えても変わらない。
create table if not exists public.breeder_levels (
  breeder_id text        not null,
  user_name  text,
  icon       text,
  level      integer     not null,
  updated_at timestamptz not null default now(),
  constraint breeder_levels_pkey primary key (breeder_id),
  -- 明らかにありえない値を弾く(ブリーダーLvに意図した上限は無いので、広めに取る)
  constraint breeder_levels_breeder_id_shape check (length(breeder_id) between 1 and 100),
  constraint breeder_levels_user_name_len    check (user_name is null or length(user_name) <= 40),
  constraint breeder_levels_icon_len         check (icon is null or length(icon) <= 100),
  constraint breeder_levels_level_range      check (level >= 1 and level <= 1000000)
);

comment on table public.breeder_levels is
  'ブリーダーの「いまのブリーダーLv」。1人1行。ブリーダーLvランキングの並べ方に使う。記録(rankings/bond_levels)は一切変えない。';
comment on column public.breeder_levels.breeder_id is
  '端末ごとに1回だけ作るブリーダーID(mh_breeder_id_v1)。rankings.breeder_id と同じ値。';
comment on column public.breeder_levels.level is
  'いまのブリーダーLv。上書きしても下がらない(下の trigger が高いほうを残す)。';

-- 上書きのたびに updated_at を進め、レベルは下げない
create or replace function public.breeder_levels_keep_highest()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.level is not null and new.level < old.level then
    new.level := old.level;
  end if;
  return new;
end $$;

drop trigger if exists breeder_levels_keep_highest on public.breeder_levels;
create trigger breeder_levels_keep_highest
  before insert or update on public.breeder_levels
  for each row execute function public.breeder_levels_keep_highest();

-- ===== ② 権限 =====
-- 読み書きは rankings・breeder_profiles と同じ考え方(公開キーの anon が触れる)。
-- 消す権限は与えない。
alter table public.breeder_levels enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='breeder_levels' and policyname='anyone can read breeder levels') then
    create policy "anyone can read breeder levels"
      on public.breeder_levels for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='breeder_levels' and policyname='anyone can insert breeder levels') then
    create policy "anyone can insert breeder levels"
      on public.breeder_levels for insert with check (true);
  end if;
  -- 自分の行を上書きするために要る(on_conflict のupsertがUPDATEを使う)
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='breeder_levels' and policyname='anyone can update breeder levels') then
    create policy "anyone can update breeder levels"
      on public.breeder_levels for update using (true) with check (true);
  end if;
end $$;

grant select, insert, update on public.breeder_levels to anon, authenticated;
-- 削除は与えない(与えていないことを下の検査で確かめる)
revoke delete on public.breeder_levels from anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====
do $$
declare
  cnt int;
  lv int;
begin
  if to_regclass('public.breeder_levels') is null then
    raise exception 'breeder_levels が作られていません';
  end if;

  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='breeder_levels'
     and column_name in ('breeder_id','user_name','icon','level','updated_at');
  if cnt <> 5 then raise exception 'breeder_levels の列がそろっていません(%件)', cnt; end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='breeder_levels' and c.relrowsecurity) then
    raise exception 'breeder_levels のRLSが有効になっていません';
  end if;

  if exists (select 1 from information_schema.role_table_grants
              where table_schema='public' and table_name='breeder_levels'
                and grantee in ('anon','authenticated') and privilege_type='DELETE') then
    raise exception 'breeder_levels に削除の権限が付いています';
  end if;

  -- 既存のテーブルに触っていないこと
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='rankings' and column_name='breeder_id') then
    raise exception 'rankings.breeder_id が見当たりません(既存テーブルを壊した可能性)';
  end if;

  -- 実際に1行書けて、同じIDで上書きになること(行が増えないこと)・レベルが下がらないこと
  insert into public.breeder_levels (breeder_id, user_name, icon, level)
  values ('__apply_check__', 'テスト', 'Mocchi', 50);
  insert into public.breeder_levels (breeder_id, user_name, icon, level)
  values ('__apply_check__', 'テスト2', 'Suezo', 60)
  on conflict (breeder_id) do update
     set user_name = excluded.user_name, icon = excluded.icon, level = excluded.level;
  select count(*) into cnt from public.breeder_levels where breeder_id = '__apply_check__';
  if cnt <> 1 then raise exception '同じIDで2行になりました(1行で上書きされていません)'; end if;
  select level into lv from public.breeder_levels where breeder_id = '__apply_check__';
  if lv <> 60 then raise exception '上書きでLvが上がりませんでした(%)', lv; end if;
  insert into public.breeder_levels (breeder_id, user_name, icon, level)
  values ('__apply_check__', 'テスト3', 'Suezo', 10)
  on conflict (breeder_id) do update
     set user_name = excluded.user_name, icon = excluded.icon, level = excluded.level;
  select level into lv from public.breeder_levels where breeder_id = '__apply_check__';
  if lv <> 60 then raise exception 'Lvが下がりました(%)。高いほうが残るはずです', lv; end if;
  delete from public.breeder_levels where breeder_id = '__apply_check__';
end $$;

-- 追加した内容をまとめて表示する。
with facts as (
  select 1 as sort, 'breeder_levels テーブル' as item,
         (select case when to_regclass('public.breeder_levels') is null then 'なし' else 'あり' end) as value
  union all
  select 2, '列',
         (select coalesce(string_agg(column_name, ', ' order by ordinal_position), 'なし')
          from information_schema.columns
          where table_schema='public' and table_name='breeder_levels')
  union all
  select 3, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='breeder_levels')
  union all
  select 4, 'ポリシー',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='breeder_levels')
  union all
  select 5, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='breeder_levels'
            and grantee in ('anon','authenticated'))
  union all
  select 6, 'breeder_levels の件数(最初は0)',
         (select count(*)::text from public.breeder_levels)
  union all
  select 7, 'rankings の件数(触っていないこと)',
         (select count(*)::text from public.rankings)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので、ここまでの変更をすべて捨てる。本番には何も残らない。
rollback;
