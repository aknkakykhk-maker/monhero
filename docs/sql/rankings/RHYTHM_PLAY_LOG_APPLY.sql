-- モンヒロビートの「遊んだ記録」を貯める表 public.rhythm_play_logs を新しく作るSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 新しい表を1つ作るだけ。既存の表・列・ビュー・関数・RLS・ポリシー・権限には一切触らない
-- (rankings などへの alter / drop / delete / update をしない)。
-- 先に RHYTHM_PLAY_LOG_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
--
-- なぜ作るのか(2026-09-28・ユーザー指示「人間が関与しないで完璧なツールに仕上がる仕組みを」「全プレイヤーから送る」):
--   譜面生成ツールが「プレイヤーが音に合わせて押せているか」を測るため。公開中の曲をふつうに最後まで遊ぶと、
--   ノーツごとの判定のずれを縮めた文字列が1行届く。ツールが週1回これを読み、次に足す曲の作り方を決める。
--   ・名前・ブリーダーID・セーブデータは入らない。端末ごとのでたらめなID(device_key)だけ
--   ・誰でも追加と読み出しはできるが、書き換え・削除はできない(update / delete のポリシーを作らない)
--   ・1行の大きさに上限を付け、形の違う行は受け付けない(check 制約)
--
-- アプリ側はこのSQLを当てる前でも壊れない。表が無い間は送信が 404 になり、アプリはそのページを閉じるまで送らない
-- (26-supabase.jsx の sbSendRhythmPlayLog)。SQLの適用とアプリの公開はどちらが先でもよい。

begin;

-- 既に同じ名前の表があって形が違うときは、作り替えずに止まる
do $$
begin
  if to_regclass('public.rhythm_play_logs') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'rhythm_play_logs' and column_name = 'deltas') then
      raise exception 'public.rhythm_play_logs が別の形で既にあります。中身を確かめてから進めてください(このSQLは何も変えていません)';
    end if;
  end if;
end $$;

create table if not exists public.rhythm_play_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  song_id text not null,
  difficulty text not null,
  fingerprint text not null,
  app_build text not null default '',
  device_key text not null,
  judge_offset_ms integer not null default 0,
  note_count integer not null,
  mirror boolean not null default false,
  cleared boolean not null default true,
  deltas text not null,
  schema_version smallint not null default 1,
  constraint rhythm_play_logs_song_id_check check (char_length(song_id) between 1 and 64),
  constraint rhythm_play_logs_difficulty_check check (difficulty in ('EASY','NORMAL','HARD','EXPERT','MASTER')),
  constraint rhythm_play_logs_fingerprint_check check (char_length(fingerprint) between 1 and 64),
  constraint rhythm_play_logs_app_build_check check (char_length(app_build) <= 32),
  constraint rhythm_play_logs_device_key_check check (device_key ~ '^[0-9a-z]{8,40}$'),
  constraint rhythm_play_logs_offset_check check (judge_offset_ms between -1000 and 1000),
  constraint rhythm_play_logs_note_count_check check (note_count between 1 and 6000),
  constraint rhythm_play_logs_deltas_check check (char_length(deltas) = note_count * 2 and deltas ~ '^([0-9a-z]{2}|--|__)*$'),
  constraint rhythm_play_logs_version_check check (schema_version between 1 and 100)
);

create index if not exists rhythm_play_logs_song_idx on public.rhythm_play_logs (song_id, difficulty, created_at);
create index if not exists rhythm_play_logs_created_idx on public.rhythm_play_logs (created_at);

alter table public.rhythm_play_logs enable row level security;

drop policy if exists rhythm_play_logs_insert on public.rhythm_play_logs;
create policy rhythm_play_logs_insert on public.rhythm_play_logs
  for insert to anon, authenticated with check (true);
drop policy if exists rhythm_play_logs_select on public.rhythm_play_logs;
create policy rhythm_play_logs_select on public.rhythm_play_logs
  for select to anon, authenticated using (true);

grant select, insert on public.rhythm_play_logs to anon, authenticated;

-- 形が思ったとおりかを確かめ、違えば全部取り消す
do $$
declare
  column_count integer;
  policy_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'rhythm_play_logs';
  if column_count <> 13 then
    raise exception 'rhythm_play_logs の列が % 個です(13個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'rhythm_play_logs' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'rhythm_play_logs に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

commit;

-- まとめ(Supabase の SQL Editor は最後の1文の結果だけを表示する)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'rhythm_play_logs') as "列の数(13)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'rhythm_play_logs') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'rhythm_play_logs') as "ポリシー(INSERT と SELECT だけ)",
  (select count(*) from public.rhythm_play_logs) as "記録の件数";
