-- あつ杯運営ツール: 共有データベースのセットアップ
-- Supabaseの管理画面 > SQL Editor に貼り付けて実行してください(1回だけでOK)。
-- モンスターヒーローの全国ランキングと同じSupabaseプロジェクトを使う想定です。

create extension if not exists pgcrypto;

-- 大会(告知ポスター・詳細・開催状況)。1件が「1回のあつ杯」に対応します。
create table if not exists atsucup_tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  poster_url text,
  details text,
  entry_open boolean not null default true,
  finished boolean not null default false,
  champion_name text,
  created_at timestamptz not null default now()
);

-- エントリー(参加者が自分の端末から送信)
create table if not exists atsucup_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references atsucup_tournaments(id) on delete cascade,
  name text not null,
  freematch_id text not null,
  video_ok boolean not null default true,
  created_at timestamptz not null default now()
);

-- コメント欄
create table if not exists atsucup_comments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references atsucup_tournaments(id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- 対戦結果(名前ごとの過去の戦績を出すために、対戦表で勝敗が決まるたびに記録)
create table if not exists atsucup_match_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references atsucup_tournaments(id) on delete cascade,
  round_label text not null,
  player_name text not null,
  opponent_name text,
  result text not null check (result in ('win','lose','bye')),
  created_at timestamptz not null default now()
);

alter table atsucup_tournaments enable row level security;
alter table atsucup_entries enable row level security;
alter table atsucup_comments enable row level security;
alter table atsucup_match_results enable row level security;

-- 個人開発・友人間イベント向けのため、モンヒロのランキング表と同様に
-- 匿名キーからの読み書きをそのまま許可するシンプルなポリシーにしています。
-- (荒らし対策の認証機能は今のところ実装していません)

drop policy if exists "atsucup_tournaments_select" on atsucup_tournaments;
drop policy if exists "atsucup_tournaments_insert" on atsucup_tournaments;
drop policy if exists "atsucup_tournaments_update" on atsucup_tournaments;
create policy "atsucup_tournaments_select" on atsucup_tournaments for select using (true);
create policy "atsucup_tournaments_insert" on atsucup_tournaments for insert with check (true);
create policy "atsucup_tournaments_update" on atsucup_tournaments for update using (true);

drop policy if exists "atsucup_entries_select" on atsucup_entries;
drop policy if exists "atsucup_entries_insert" on atsucup_entries;
create policy "atsucup_entries_select" on atsucup_entries for select using (true);
create policy "atsucup_entries_insert" on atsucup_entries for insert with check (true);

drop policy if exists "atsucup_comments_select" on atsucup_comments;
drop policy if exists "atsucup_comments_insert" on atsucup_comments;
create policy "atsucup_comments_select" on atsucup_comments for select using (true);
create policy "atsucup_comments_insert" on atsucup_comments for insert with check (true);

drop policy if exists "atsucup_match_results_select" on atsucup_match_results;
drop policy if exists "atsucup_match_results_insert" on atsucup_match_results;
create policy "atsucup_match_results_select" on atsucup_match_results for select using (true);
create policy "atsucup_match_results_insert" on atsucup_match_results for insert with check (true);

-- 告知ポスター画像のアップロード先(Storageバケット)
insert into storage.buckets (id, name, public)
values ('atsucup-posters', 'atsucup-posters', true)
on conflict (id) do nothing;

drop policy if exists "atsucup_posters_read" on storage.objects;
drop policy if exists "atsucup_posters_write" on storage.objects;
create policy "atsucup_posters_read" on storage.objects for select using (bucket_id = 'atsucup-posters');
create policy "atsucup_posters_write" on storage.objects for insert with check (bucket_id = 'atsucup-posters');
