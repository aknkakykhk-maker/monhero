-- バトルの1回ごとの記録の表 public.battle_logs を新しく作るSQL(2026-10-21・下準備)。
-- ★まだ流していない。流すのは社長が「集めていい」と決めてから。設計: docs/spec/BATTLE_LOG.md
-- 既存の表・列・行・権限には触らない(新しい表を1つ足すだけ。DROP TABLE・DELETE・UPDATE をしない)。
-- 送る側(ゲーム)は RELEASE_FLAGS.battleLog が偽のあいだ何も送らないので、表を作っても行は増えない。
-- 読み取り専用: いいえ。本番変更が残るか: はい。先に BATTLE_LOG_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから。

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
  hero text,                                -- 勇者モンの monsterId(モンヒロビート挑戦は編成が無いので null)
  allies text[] not null default '{}',      -- 供モンの monsterId(最大3)
  units jsonb not null default '{}'::jsonb, -- { monsterId: { dmg, ex, unique, taken } }(数えるのは次の段から)
  -- レイド「カボチャの大王ジャック」の1回(難易度のキー RaidJackA / RaidJackB / RaidJackRhythm)。ほかのバトルでは null。
  -- raid_jack_hits(与ダメージ・討伐の正本)・ランキング・討伐報酬には触らず、ここへ別に残す
  raid_event text,                          -- イベントid(raid_jack_2026)
  raid_kind text,                           -- a = レイドバトル / b = グランドスラム
  raid_tier smallint,                       -- 段階
  raid_source text,                         -- battle / rhythm(モンヒロビート挑戦)
  raid_damage bigint,                       -- その1回で与えたダメージ
  app_build text not null default '',
  schema_version smallint not null default 1,
  constraint battle_logs_difficulty_check check (difficulty ~ '^[A-Za-z0-9_-]{1,48}$'),
  constraint battle_logs_result_check check (result in ('clear', 'end')),
  constraint battle_logs_wave_check check (reached_wave is null or reached_wave between 0 and 100),
  constraint battle_logs_turns_check check (turns is null or turns between 1 and 100000),
  constraint battle_logs_hero_check check (hero is null or hero ~ '^[A-Za-z0-9_]{1,40}$'),
  constraint battle_logs_hero_needed_check check (hero is not null or raid_source = 'rhythm'),
  constraint battle_logs_raid_event_check check (raid_event is null or raid_event ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint battle_logs_raid_kind_check check (raid_kind is null or raid_kind in ('a', 'b')),
  constraint battle_logs_raid_tier_check check (raid_tier is null or raid_tier between 1 and 10),
  constraint battle_logs_raid_source_check check (raid_source is null or raid_source in ('battle', 'rhythm')),
  constraint battle_logs_raid_damage_check check (raid_damage is null or raid_damage between 0 and 1000000000000),
  constraint battle_logs_allies_check check (cardinality(allies) <= 3),
  constraint battle_logs_units_check check (jsonb_typeof(units) = 'object' and octet_length(units::text) <= 4000),
  constraint battle_logs_app_build_check check (char_length(app_build) <= 32),
  constraint battle_logs_version_check check (schema_version between 1 and 100)
);
create index if not exists battle_logs_difficulty_idx on public.battle_logs (difficulty, created_at);
create index if not exists battle_logs_hero_idx on public.battle_logs (hero, created_at);
create index if not exists battle_logs_raid_idx on public.battle_logs (raid_event, raid_kind, raid_tier) where raid_event is not null;

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
  if column_count <> 18 then
    raise exception 'battle_logs の列が % 個です(18個のはず)。取り消しました', column_count;
  end if;
  select count(*) into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'battle_logs' and cmd in ('UPDATE','DELETE','ALL');
  if policy_count <> 0 then
    raise exception 'battle_logs に書き換え・削除のポリシーがあります。取り消しました';
  end if;
end $$;

commit;

select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'battle_logs') as "列の数(18)",
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'battle_logs') as "RLS(true)",
  (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'battle_logs') as "ポリシー(INSERT と SELECT だけ)",
  (select count(*) from public.battle_logs) as "記録の件数";
