-- レイドとタクティクスプロ(ベースモンだけの回)の1回ごとの記録の表を2つ新しく作るSQL(2026-10-21・下準備)。
--   public.raid_battle_logs … レイド(レイドバトル・グランドスラム・モンヒロビート挑戦)の1回1行
--   public.tactics_pro_logs … タクティクスプロのうち、ベースモン(育てていない基本の強さ)だけで戦った回の1回1行
-- 2026-10-21 社長「レイド、タクティクスプロのタクティクスバトルのベースモンを使ったもののデータでいい。育てたモンスターははかれない」。
-- 既存の表・列・行・権限には触らない(新しい表を2つ足すだけ。DROP TABLE・DELETE・UPDATE をしない。raid_jack_hits・rankings も触らない)。
-- 送る側(ゲーム)は RELEASE_FLAGS.battleLog が偽のあいだ何も送らないので、表を作っても行は増えない。設計: docs/spec/BATTLE_LOG.md
-- 予行演習。読み取り専用: いいえ(トランザクション内で作るが、最後に必ず取り消す)。本番変更が残るか: いいえ(末尾 rollback;)。

begin;

do $$
begin
  if to_regclass('public.raid_battle_logs') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'raid_battle_logs' and column_name = 'units') then
      raise exception 'public.raid_battle_logs が別の形で既にあります。中身を確かめてから進めてください(このSQLは何も変えていません)';
    end if;
  end if;
end $$;

-- レイド「カボチャの大王ジャック」の1回で1行(レイドバトル・グランドスラム・モンヒロビート挑戦)。
-- raid_jack_hits(与ダメージ・討伐の正本)・ランキング・討伐報酬とは別。名前・ブリーダーID・アイコン・マスモンの中身は持たない(列が無い)
create table if not exists public.raid_battle_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_id text not null,                   -- イベントid(raid_jack_2026)
  kind text not null,                       -- a = レイドバトル / b = グランドスラム
  tier smallint not null,                   -- 段階
  source text not null,                     -- battle / rhythm(モンヒロビート挑戦)
  result text not null,                     -- defeated(倒した) / end
  damage bigint,                            -- その1回で与えたダメージ
  turns integer,                            -- 使ったターン
  score bigint,                             -- モンヒロビート挑戦のスコア
  hero text,                                -- 勇者モンの monsterId(モンヒロビート挑戦は編成が無いので null)
  allies text[] not null default '{}',      -- 供モンの monsterId(最大3)
  units jsonb not null default '{}'::jsonb, -- { monsterId: { dmg, ex, unique, taken } }(数えるのは次の段から)
  app_build text not null default '',
  schema_version smallint not null default 1,
  constraint raid_battle_logs_event_check check (event_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint raid_battle_logs_kind_check check (kind in ('a', 'b')),
  constraint raid_battle_logs_tier_check check (tier between 1 and 10),
  constraint raid_battle_logs_source_check check (source in ('battle', 'rhythm')),
  constraint raid_battle_logs_result_check check (result in ('defeated', 'end')),
  constraint raid_battle_logs_damage_check check (damage is null or damage between 0 and 1000000000000),
  constraint raid_battle_logs_turns_check check (turns is null or turns between 1 and 1000),
  constraint raid_battle_logs_hero_check check (hero is null or hero ~ '^[A-Za-z0-9_]{1,40}$'),
  constraint raid_battle_logs_hero_needed_check check (hero is not null or source = 'rhythm'),
  constraint raid_battle_logs_allies_check check (cardinality(allies) <= 3),
  constraint raid_battle_logs_units_check check (jsonb_typeof(units) = 'object' and octet_length(units::text) <= 4000),
  constraint raid_battle_logs_app_build_check check (char_length(app_build) <= 32),
  constraint raid_battle_logs_version_check check (schema_version between 1 and 100)
);
create index if not exists raid_battle_logs_tier_idx on public.raid_battle_logs (event_id, kind, tier, created_at);
create index if not exists raid_battle_logs_hero_idx on public.raid_battle_logs (hero, created_at);

-- 足すのと読むのだけ。書き換え・削除のポリシーは作らない
alter table public.raid_battle_logs enable row level security;
drop policy if exists raid_battle_logs_insert on public.raid_battle_logs;
create policy raid_battle_logs_insert on public.raid_battle_logs
  for insert to anon, authenticated with check (true);
drop policy if exists raid_battle_logs_select on public.raid_battle_logs;
create policy raid_battle_logs_select on public.raid_battle_logs
  for select to anon, authenticated using (true);
-- Supabase は新しい表に anon・authenticated へ全部の権限を初めから付けることがあるので、いったん外して読む・足すだけにする(この表だけ)
revoke all on public.raid_battle_logs from anon, authenticated;
grant select, insert on public.raid_battle_logs to anon, authenticated;

do $$
declare
  column_count integer;
  policy_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'raid_battle_logs';
  if column_count <> 15 then
    raise exception 'raid_battle_logs の列が % 個です(15個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'raid_battle_logs' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'raid_battle_logs に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

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
-- Supabase は新しい表に anon・authenticated へ全部の権限を初めから付けることがあるので、いったん外して読む・足すだけにする(この表だけ)
revoke all on public.tactics_pro_logs from anon, authenticated;
grant select, insert on public.tactics_pro_logs to anon, authenticated;

do $$
declare
  column_count integer;
  policy_count integer;
begin
  select count(*) into column_count from information_schema.columns
   where table_schema = 'public' and table_name = 'tactics_pro_logs';
  if column_count <> 14 then
    raise exception 'tactics_pro_logs の列が % 個です(14個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'tactics_pro_logs' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'tactics_pro_logs に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

select t.table_name as "表",
  (select count(*) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as "列の数(raid 15・tactics 14)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = t.table_name) as "RLS(true)",
  (select string_agg(p.policyname || ':' || p.cmd, ', ' order by p.policyname) from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name) as "ポリシー(INSERT と SELECT だけ)",
  (select string_agg(g.privilege_type, ',' order by g.privilege_type) from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = t.table_name and g.grantee = 'anon') as "anon の権限(INSERT,SELECT)"
from (values ('raid_battle_logs'), ('tactics_pro_logs')) as t(table_name);

rollback;
