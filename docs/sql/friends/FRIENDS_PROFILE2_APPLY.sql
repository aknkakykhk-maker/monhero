-- friend_profiles(第2弾で作ったテーブル)へ、列を2つ足すSQL(フレンド機能の第3弾)。
-- 読み取り専用: いいえ。 本番変更が残るか: はい(全体が1つの処理。途中で失敗すれば何も残らない)。
--
-- 足す列(どちらもNULL可。足す前の行はそのまま):
--   message … 自分で書く「ひとこと」(40文字まで)
--   records … フレンドのプロフィールに出す記録のまとめ(JSON。バトル記録・曲ごとのベスト・所持/図鑑の進み)
-- 既存の列・行・権限・ほかのテーブルには触らない(列を足すだけ。DROP/DELETE/UPDATEなし)。
-- 先に必要なSQL: FRIENDS_PROFILE_APPLY.sql
-- ★アプリは「列がまだ無い」と分かると、この2つを外して送り直す。SQLを先に流しても、アプリの公開を先にしても記録は失われない。

begin;

do $$
begin
  if to_regclass('public.friend_profiles') is null then
    raise exception 'public.friend_profiles がありません。先に FRIENDS_PROFILE_APPLY.sql を適用してください。';
  end if;
end $$;

alter table public.friend_profiles add column if not exists message text;
alter table public.friend_profiles add column if not exists records jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'friend_profiles_message_len'
                  and conrelid = 'public.friend_profiles'::regclass) then
    alter table public.friend_profiles
      add constraint friend_profiles_message_len check (message is null or length(message) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'friend_profiles_records_size'
                  and conrelid = 'public.friend_profiles'::regclass) then
    alter table public.friend_profiles
      add constraint friend_profiles_records_size check (records is null or length(records::text) <= 12000);
  end if;
end $$;

do $$
declare
  cnt int;
begin
  select count(*) into cnt from information_schema.columns
   where table_schema='public' and table_name='friend_profiles' and column_name in ('message','records');
  if cnt <> 2 then raise exception '列がそろっていません(%件)', cnt; end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema='public' and table_name='friend_profiles'
                and grantee in ('anon','authenticated') and privilege_type='DELETE') then
    raise exception 'friend_profiles に削除の権限が付いています';
  end if;

  insert into public.friend_profiles (breeder_id, message, records)
  values ('__apply_check__', 'よろしくね', '{"v":1}'::jsonb);
  insert into public.friend_profiles (breeder_id, message) values ('__apply_check__', 'ひとこと')
  on conflict (breeder_id) do update set message = excluded.message;
  select count(*) into cnt from public.friend_profiles where breeder_id = '__apply_check__';
  if cnt <> 1 then raise exception '同じIDが2行になりました'; end if;
  begin
    insert into public.friend_profiles (breeder_id, message) values ('__apply_check_x__', repeat('あ', 41));
    raise exception '41文字のひとことが入りました';
  exception when check_violation then null;
  end;
  begin
    insert into public.friend_profiles (breeder_id, records) values ('__apply_check_y__', to_jsonb(repeat('x', 12001)));
    raise exception '大きすぎる記録が入りました';
  exception when check_violation then null;
  end;
  delete from public.friend_profiles where breeder_id like '\_\_apply\_check\_%';
end $$;

select 'friend_profiles の列' as "項目",
       (select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
         where table_schema='public' and table_name='friend_profiles') as "値"
union all select 'friend_profiles の件数(増えていないこと)', (select count(*)::text from public.friend_profiles)
union all select 'rankings の件数(触っていないこと)', (select count(*)::text from public.rankings);

commit;

notify pgrst, 'reload schema';
