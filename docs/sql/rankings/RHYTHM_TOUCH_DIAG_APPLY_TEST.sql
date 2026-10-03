-- 【予行演習】RHYTHM_TOUCH_DIAG_APPLY.sql と同じ中身を、最後に rollback して何も残さずに試す。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: いいえ(予行演習。末尾で rollback する)。
--
-- 新しい表を1つ作るだけ。既存の表・列・ビュー・関数・RLS・ポリシー・権限には一切触らない
-- (rankings・rhythm_play_logs などへの alter / drop / delete / update をしない)。
-- これが通ってから RHYTHM_TOUCH_DIAG_APPLY.sql(末尾 commit;)を実行する。
--
-- なぜ作るのか(2026-09-30・ユーザー報告「iPhoneで両手の高速連打のとき、押しても音も光も出ないことがある」
-- 「前からずっとある」「Androidの人からは聞かない」、ユーザー指示「こっち側に委ねないで調べる仕組みと直せる仕組みを作って」):
--   ゲームは1曲ごとに、指がブラウザのどの段階で消えたかを数える(ポインタとタッチの突き合わせ・遅れ・取り消し・入力の無いMISS)。
--   その数だけを1行送る。道具(tools/mode/rhythm-touch-diag.js)が iPhone と Android を比べて原因を判定する(docs/spec/RHYTHM_TOUCH_DIAG.md)。
--   ・名前・ブリーダーID・セーブデータは入らない。端末ごとのでたらめなID(遊んだ記録と同じ device_key)だけ
--   ・誰でも追加と読み出しはできるが、書き換え・削除はできない(update / delete のポリシーを作らない)
--   ・1行の大きさに上限を付け(stats は 4KB まで)、形の違う行は受け付けない(check 制約)
--
-- アプリ側はこのSQLを当てる前でも壊れない。表が無い間は送信が 404 になり、アプリはそのページを閉じるまで送らない
-- (26-supabase.jsx の sbSendRhythmTouchDiag)。SQLの適用とアプリの公開はどちらが先でもよい。

begin;

-- 既に同じ名前の表があって形が違うときは、作り替えずに止まる
do $$
begin
  if to_regclass('public.rhythm_touch_diagnostics') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'rhythm_touch_diagnostics' and column_name = 'stats') then
      raise exception 'public.rhythm_touch_diagnostics が別の形で既にあります。中身を確かめてから進めてください(このSQLは何も変えていません)';
    end if;
  end if;
end $$;

create table if not exists public.rhythm_touch_diagnostics (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device_key text not null,
  app_build text not null default '',
  platform text not null,
  standalone boolean not null default false,
  song_id text not null,
  difficulty text not null,
  note_count integer not null,
  stats jsonb not null,
  schema_version smallint not null default 1,
  constraint rhythm_touch_diag_device_key_check check (device_key ~ '^[0-9a-z]{8,40}$'),
  constraint rhythm_touch_diag_app_build_check check (char_length(app_build) <= 32),
  constraint rhythm_touch_diag_platform_check check (platform in ('ios','android','other')),
  constraint rhythm_touch_diag_song_id_check check (char_length(song_id) between 1 and 64),
  constraint rhythm_touch_diag_difficulty_check check (difficulty in ('EASY','NORMAL','HARD','EXPERT','MASTER')),
  constraint rhythm_touch_diag_note_count_check check (note_count between 1 and 6000),
  constraint rhythm_touch_diag_stats_check check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) <= 4096),
  constraint rhythm_touch_diag_version_check check (schema_version between 1 and 100)
);

create index if not exists rhythm_touch_diag_created_idx on public.rhythm_touch_diagnostics (created_at);
create index if not exists rhythm_touch_diag_platform_idx on public.rhythm_touch_diagnostics (platform, created_at);

alter table public.rhythm_touch_diagnostics enable row level security;

drop policy if exists rhythm_touch_diag_insert on public.rhythm_touch_diagnostics;
create policy rhythm_touch_diag_insert on public.rhythm_touch_diagnostics
  for insert to anon, authenticated with check (true);
drop policy if exists rhythm_touch_diag_select on public.rhythm_touch_diagnostics;
create policy rhythm_touch_diag_select on public.rhythm_touch_diagnostics
  for select to anon, authenticated using (true);

grant select, insert on public.rhythm_touch_diagnostics to anon, authenticated;

-- 形が思ったとおりかを確かめ、違えば全部取り消す
do $$
declare
  column_count integer;
  policy_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'rhythm_touch_diagnostics';
  if column_count <> 11 then
    raise exception 'rhythm_touch_diagnostics の列が % 個です(11個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'rhythm_touch_diagnostics' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'rhythm_touch_diagnostics に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

-- まとめ(予行演習では rollback の前に出す。この表が出れば本番も通る)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'rhythm_touch_diagnostics') as "列の数(11)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'rhythm_touch_diagnostics') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'rhythm_touch_diagnostics') as "ポリシー(INSERT と SELECT だけ)",
  (select count(*) from public.rhythm_touch_diagnostics) as "記録の件数";

rollback;
