-- タクティクスプロの1回ごとの記録の表 public.tactics_pro_logs を新しく作るSQL(2026-10-21・下準備)。
-- ★まだ流していない。流すのは社長が「集めていい」と決めてから。設計: docs/spec/BATTLE_LOG.md
-- 既存の表・列・行・権限には触らない(新しい表を1つ足すだけ。DROP TABLE・DELETE・UPDATE をしない)。
-- 送る側(ゲーム)は RELEASE_FLAGS.battleLog が偽のあいだ何も送らないので、表を作っても行は増えない。
-- 予行演習。読み取り専用: いいえ(トランザクション内で作るが、最後に必ず取り消す)。本番変更が残るか: いいえ(末尾 rollback;)。

begin;

do $$
begin
  if to_regclass('public.tactics_pro_logs') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'tactics_pro_logs' and column_name = 'detail') then
      raise exception 'public.tactics_pro_logs が別の形で既にあります。中身を確かめてから進めてください(このSQLは何も変えていません)';
    end if;
  end if;
end $$;

-- タクティクスプロの1回で1行(勝ち・負け・途中でやめた回のどれも)。名前・ブリーダーID・アイコン・マスモンの中身は持たない(列が無い)
create table if not exists public.tactics_pro_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  difficulty text not null,                    -- Beginner〜Legend など(極限は detail.extreme)
  result text not null,                        -- clear / lose / retire
  reached_wave smallint,
  turns integer,                               -- クリアまでの累計ターン(クリアした回だけ)
  score bigint,
  hero text not null,                          -- 勇者モンの monsterId
  candidates text[] not null default '{}',     -- 始める前に選んだ供モンの候補5体
  cause text,                                  -- 負けたときの敵
  seconds integer,                             -- 始めてから終わるまでの秒
  detail jsonb not null,                       -- WAVE ごとのまとめ・アシカ・トレーニング・モンスターごとの数・出来事(docs/spec/BATTLE_LOG.md)
  app_build text not null default '',
  schema_version smallint not null default 1,
  constraint tactics_pro_logs_difficulty_check check (difficulty ~ '^[A-Za-z0-9_-]{1,32}$'),
  constraint tactics_pro_logs_result_check check (result in ('clear', 'lose', 'retire')),
  constraint tactics_pro_logs_wave_check check (reached_wave is null or reached_wave between 0 and 99),
  constraint tactics_pro_logs_turns_check check (turns is null or turns between 0 and 100000),
  constraint tactics_pro_logs_hero_check check (hero ~ '^[A-Za-z0-9_]{1,40}$'),
  constraint tactics_pro_logs_candidates_check check (cardinality(candidates) <= 5),
  constraint tactics_pro_logs_cause_check check (cause is null or char_length(cause) <= 40),
  constraint tactics_pro_logs_seconds_check check (seconds is null or seconds between 0 and 86400),
  constraint tactics_pro_logs_detail_check check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 32000),
  constraint tactics_pro_logs_app_build_check check (char_length(app_build) <= 32),
  constraint tactics_pro_logs_version_check check (schema_version between 1 and 100)
);
create index if not exists tactics_pro_logs_difficulty_idx on public.tactics_pro_logs (difficulty, created_at);
create index if not exists tactics_pro_logs_hero_idx on public.tactics_pro_logs (hero, created_at);

-- 足すのと読むのだけ。書き換え・削除のポリシーは作らない
alter table public.tactics_pro_logs enable row level security;
drop policy if exists tactics_pro_logs_insert on public.tactics_pro_logs;
create policy tactics_pro_logs_insert on public.tactics_pro_logs
  for insert to anon, authenticated with check (true);
drop policy if exists tactics_pro_logs_select on public.tactics_pro_logs;
create policy tactics_pro_logs_select on public.tactics_pro_logs
  for select to anon, authenticated using (true);
grant select, insert on public.tactics_pro_logs to anon, authenticated;

do $$
declare
  column_count integer;
  policy_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'tactics_pro_logs';
  if column_count <> 15 then
    raise exception 'tactics_pro_logs の列が % 個です(15個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'tactics_pro_logs' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'tactics_pro_logs に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tactics_pro_logs') as "列の数(15)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'tactics_pro_logs') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'tactics_pro_logs') as "ポリシー(INSERT と SELECT だけ)",
  (select count(*) from public.tactics_pro_logs) as "記録の件数";

rollback;
