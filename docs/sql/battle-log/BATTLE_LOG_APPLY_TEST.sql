-- バトルの1回ごとの記録の表 public.battle_logs を新しく作るSQL(2026-10-21・下準備)。
-- ★まだ流していない。流すのは社長が「集めていい」と決めてから。設計: docs/spec/BATTLE_LOG.md
-- 既存の表・列・行・権限には触らない(新しい表を1つ足すだけ。DROP TABLE・DELETE・UPDATE をしない)。
-- 送る側(ゲーム)は RELEASE_FLAGS.battleLog が偽のあいだ何も送らないので、表を作っても行は増えない。
-- 予行演習。読み取り専用: いいえ(トランザクション内で作るが、最後に必ず取り消す)。本番変更が残るか: いいえ(末尾 rollback;)。

begin;

do $$
begin
  if to_regclass('public.battle_logs') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'battle_logs' and column_name = 'units') then
      raise exception 'public.battle_logs が別の形で既にあります。中身を確かめてから進めてください(このSQLは何も変えていません)';
    end if;
  end if;
end $$;

-- 1回のバトルで1行。名前・ブリーダーID・アイコン・マスモンの個体名は持たない(列が無い)
create table if not exists public.battle_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  difficulty text not null,                 -- ランキングと同じ難易度のキー(TacticsProBetaHard・ProMaster・ExtremeCHAOS など)
  result text not null,                     -- 'clear' か 'end'(負け・リタイア)
  reached_wave smallint,                    -- 届いた WAVE
  turns integer,                            -- クリアしたときの累計ターン(クリアした回だけ)
  score bigint,
  hero text not null,                       -- 勇者モンの monsterId
  allies text[] not null default '{}',      -- 供モンの monsterId(最大3)
  units jsonb not null default '{}'::jsonb, -- { monsterId: { dmg, ex, unique, taken } }(数えるのは次の段から)
  app_build text not null default '',
  schema_version smallint not null default 1,
  constraint battle_logs_difficulty_check check (difficulty ~ '^[A-Za-z0-9_-]{1,48}$'),
  constraint battle_logs_result_check check (result in ('clear', 'end')),
  constraint battle_logs_wave_check check (reached_wave is null or reached_wave between 0 and 100),
  constraint battle_logs_turns_check check (turns is null or turns between 1 and 100000),
  constraint battle_logs_hero_check check (hero ~ '^[A-Za-z0-9_]{1,40}$'),
  constraint battle_logs_allies_check check (cardinality(allies) <= 3),
  constraint battle_logs_units_check check (jsonb_typeof(units) = 'object' and octet_length(units::text) <= 4000),
  constraint battle_logs_app_build_check check (char_length(app_build) <= 32),
  constraint battle_logs_version_check check (schema_version between 1 and 100)
);
create index if not exists battle_logs_difficulty_idx on public.battle_logs (difficulty, created_at);
create index if not exists battle_logs_hero_idx on public.battle_logs (hero, created_at);

-- 足すのと読むのだけ。書き換え・削除のポリシーは作らない
alter table public.battle_logs enable row level security;
drop policy if exists battle_logs_insert on public.battle_logs;
create policy battle_logs_insert on public.battle_logs
  for insert to anon, authenticated with check (true);
drop policy if exists battle_logs_select on public.battle_logs;
create policy battle_logs_select on public.battle_logs
  for select to anon, authenticated using (true);
grant select, insert on public.battle_logs to anon, authenticated;

do $$
declare
  column_count integer;
  policy_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'battle_logs';
  if column_count <> 13 then
    raise exception 'battle_logs の列が % 個です(13個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'battle_logs' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'battle_logs に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'battle_logs') as "列の数(13)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'battle_logs') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'battle_logs') as "ポリシー(INSERT と SELECT だけ)",
  (select count(*) from public.battle_logs) as "記録の件数";

rollback;
