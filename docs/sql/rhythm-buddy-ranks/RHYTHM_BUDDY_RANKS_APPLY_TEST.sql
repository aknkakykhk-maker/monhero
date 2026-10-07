-- マスモンランキング用テーブル public.rhythm_buddy_ranks を追加する「予行演習」。
-- 本番変更が残るか: いいえ。末尾が rollback; なので、この実行では何も保存されない。
-- 目的: 実適用と同じSQLを一度通し、エラーが出ないことと、既存の rankings・bond_levels にいっさい影響しないことを確かめる。

begin;

-- 既存の rankings と bond_levels の件数を先に控える。この作業ではどちらにも触らないので、
-- 最後に「件数が変わっていない」ことを機械的に確かめる。
create temporary table buddy_rank_counts_before on commit drop as
select (select count(*) from public.rankings) as rankings_count,
       (select count(*) from public.bond_levels) as bond_count;

-- 既に別物の rhythm_buddy_ranks がある環境では、上書きせず安全側で停止する。
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'rhythm_buddy_ranks'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rhythm_buddy_ranks'
      and column_name = 'individual_id'
  ) then
    raise exception 'public.rhythm_buddy_ranks が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

-- マスモンランキング(モンヒロビート)の正本。「1人 × 1マスモン」で必ず1行になるので、
-- 記録が何回増えても一覧から人が消えない。並べ替えもDB側で完結する。
create table if not exists public.rhythm_buddy_ranks (
  user_name     text        not null,
  breeder_id    text,
  -- マスモンの個体ID(masuId)
  individual_id text        not null,
  monster_id    text        not null,
  -- そのマスモンの名前(血統の名前ではなく、本人がつけた名前)
  mon_name      text,
  icon          text,
  profile_frame text,
  -- 染色(部位の位置を保った色の並び)
  colors        jsonb,
  beat_level    integer     not null default 0,
  beat_exp      integer     not null default 0,
  lives         integer     not null default 0,
  score_easy    integer,
  score_normal  integer,
  score_hard    integer,
  score_expert  integer,
  score_master  integer,
  -- 難易度ごとの最高スコアを出した曲 { "MASTER": "曲ID" }
  best_songs    jsonb,
  updated_at    timestamptz not null default now(),
  constraint rhythm_buddy_ranks_pkey primary key (user_name, individual_id),
  constraint rhythm_buddy_ranks_level_range check (beat_level >= 0 and beat_level <= 1000),
  constraint rhythm_buddy_ranks_exp_range check (beat_exp >= 0 and beat_exp <= 100000000),
  constraint rhythm_buddy_ranks_lives_range check (lives >= 0 and lives <= 100000000),
  constraint rhythm_buddy_ranks_score_range check (
    coalesce(score_easy, 0) between 0 and 10000000 and coalesce(score_normal, 0) between 0 and 10000000
    and coalesce(score_hard, 0) between 0 and 10000000 and coalesce(score_expert, 0) between 0 and 10000000
    and coalesce(score_master, 0) between 0 and 10000000)
);

comment on table public.rhythm_buddy_ranks is
  'マスモンランキング(モンヒロビート)の正本。1人1マスモン1行。育ちが変わるたびにクライアントがupsertする。';

-- ビートLv順・難易度ごとのスコア順に上位だけを取る。
create index if not exists rhythm_buddy_ranks_level_idx
  on public.rhythm_buddy_ranks (beat_level desc, beat_exp desc);
create index if not exists rhythm_buddy_ranks_score_easy_idx on public.rhythm_buddy_ranks (score_easy desc nulls last);
create index if not exists rhythm_buddy_ranks_score_normal_idx on public.rhythm_buddy_ranks (score_normal desc nulls last);
create index if not exists rhythm_buddy_ranks_score_hard_idx on public.rhythm_buddy_ranks (score_hard desc nulls last);
create index if not exists rhythm_buddy_ranks_score_expert_idx on public.rhythm_buddy_ranks (score_expert desc nulls last);
create index if not exists rhythm_buddy_ranks_score_master_idx on public.rhythm_buddy_ranks (score_master desc nulls last);

-- 「最後に更新した時刻」を必ずサーバー側で入れ直す(upsertは指定した列しか更新しないため)。
create or replace function public.rhythm_buddy_ranks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rhythm_buddy_ranks_set_updated_at on public.rhythm_buddy_ranks;
create trigger rhythm_buddy_ranks_set_updated_at
  before insert or update on public.rhythm_buddy_ranks
  for each row execute function public.rhythm_buddy_ranks_touch_updated_at();

-- RLSと権限。公開キーで読み書きする点は既存の rankings・bond_levels と同じ信頼レベルにそろえる。
-- 削除だけはどのロールにも許可しない(消えたら復旧できないため)。
alter table public.rhythm_buddy_ranks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='rhythm_buddy_ranks' and policyname='rhythm_buddy_ranks_select') then
    create policy rhythm_buddy_ranks_select on public.rhythm_buddy_ranks
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='rhythm_buddy_ranks' and policyname='rhythm_buddy_ranks_insert') then
    create policy rhythm_buddy_ranks_insert on public.rhythm_buddy_ranks
      for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='rhythm_buddy_ranks' and policyname='rhythm_buddy_ranks_update') then
    create policy rhythm_buddy_ranks_update on public.rhythm_buddy_ranks
      for update to anon, authenticated using (true) with check (true);
  end if;
end $$;

-- Supabaseは既定で anon/authenticated へ全権限(DELETEを含む)を自動付与することがあるので、
-- いったん全て外してから、必要な3つだけを与え直す。
revoke all on public.rhythm_buddy_ranks from anon, authenticated;
grant select, insert, update on public.rhythm_buddy_ranks to anon, authenticated;

-- 既存の rankings と bond_levels に触っていないことの検査。違えば例外で止まる。
do $$
begin
  if (select rankings_count from buddy_rank_counts_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
  if (select bond_count from buddy_rank_counts_before) <> (select count(*) from public.bond_levels) then
    raise exception 'bond_levels の件数が変化しました';
  end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する(最後の1文の結果だけが表示されるため)。
with facts as (
  select 1 as sort, 'テーブル' as item,
         (select count(*)::text from information_schema.tables
          where table_schema='public' and table_name='rhythm_buddy_ranks') || ' (1なら作成済み)' as value
  union all
  select 2, 'カラム',
         (select string_agg(column_name, ', ' order by ordinal_position)
          from information_schema.columns
          where table_schema='public' and table_name='rhythm_buddy_ranks')
  union all
  select 3, '主キー',
         (select coalesce(string_agg(pg_get_constraintdef(c.oid), ' / '), 'なし')
          from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='rhythm_buddy_ranks' and c.contype='p')
  union all
  select 4, '索引(valid/readyがすべてtrueであること)',
         (select string_agg(i.relname||':'||ix.indisvalid||'/'||ix.indisready, ', ' order by i.relname)
          from pg_class t join pg_namespace n on n.oid=t.relnamespace
          join pg_index ix on ix.indrelid=t.oid join pg_class i on i.oid=ix.indexrelid
          where n.nspname='public' and t.relname='rhythm_buddy_ranks')
  union all
  select 5, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rhythm_buddy_ranks')
  union all
  select 6, 'ポリシー(select/insert/updateの3つ)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='rhythm_buddy_ranks')
  union all
  select 7, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='rhythm_buddy_ranks'
            and grantee in ('anon','authenticated'))
  union all
  select 8, 'updated_atのトリガー',
         (select coalesce(string_agg(tgname, ', '), 'なし')
          from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
          join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='rhythm_buddy_ranks' and not tg.tgisinternal)
  union all
  select 9, 'rankings の件数(適用前と同じであること)', (select count(*)::text from public.rankings)
  union all
  select 10, 'bond_levels の件数(適用前と同じであること)', (select count(*)::text from public.bond_levels)
)
select item as "項目", value as "値" from facts order by sort;

-- 予行演習なので必ず取り消す。実適用は RHYTHM_BUDDY_RANKS_APPLY.sql を使う。
rollback;
