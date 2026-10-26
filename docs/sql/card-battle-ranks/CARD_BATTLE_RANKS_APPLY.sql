-- MFバトルカードのランキング用テーブル public.card_battle_ranks を本番へ追加するSQL(社長 台帳 #3513)。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。1回で流せる形にまとめてある。
--
-- 既存の public.rankings / public.bond_levels / public.rhythm_buddy_ranks は変更しない(DROP・DELETE・ALTER・RLS/権限の変更をしない)。
-- 追加するのは新しいテーブル1つと、その索引・トリガー・ポリシー・権限だけ。作りは rhythm_buddy_ranks と同じ。

begin;

-- 既存の表の件数を先に控える。この作業ではどれにも触らないので、最後に「件数が変わっていない」ことを機械的に確かめる。
create temporary table card_rank_counts_before on commit drop as
select (select count(*) from public.rankings) as rankings_count,
       (select count(*) from public.bond_levels) as bond_count,
       (select count(*) from public.rhythm_buddy_ranks) as buddy_count;

-- 既に別物の card_battle_ranks がある環境では、上書きせず安全側で停止する。
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'card_battle_ranks'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'card_battle_ranks'
      and column_name = 'wins_master'
  ) then
    raise exception 'public.card_battle_ranks が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

-- MFバトルカードのランキングの正本。「1人1行」(名前で上書き)。並べ替えはDB側で完結する。
--   wins_*      … 助手と対戦の勝ち数(通算・難易度ごと)
--   week_key    … 週の鍵(日本時間の月曜の日付 YYYY-MM-DD)。week_wins_* はその週の勝ち数
--   best_streak … いちばん長い連勝 / current_streak … いまの連勝
--   dex_count   … カード図鑑の集めた種類 / dex_total … 図鑑の全種類(そのときの)
create table if not exists public.card_battle_ranks (
  user_name        text        not null,
  breeder_id       text,
  icon             text,
  profile_frame    text,
  week_key         text,
  wins_easy        integer     not null default 0,
  wins_normal      integer     not null default 0,
  wins_hard        integer     not null default 0,
  wins_expert      integer     not null default 0,
  wins_master      integer     not null default 0,
  week_wins_easy   integer     not null default 0,
  week_wins_normal integer     not null default 0,
  week_wins_hard   integer     not null default 0,
  week_wins_expert integer     not null default 0,
  week_wins_master integer     not null default 0,
  best_streak      integer     not null default 0,
  current_streak   integer     not null default 0,
  dex_count        integer     not null default 0,
  dex_total        integer     not null default 0,
  updated_at       timestamptz not null default now(),
  constraint card_battle_ranks_pkey primary key (user_name),
  constraint card_battle_ranks_week_key_format check (week_key is null or week_key ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint card_battle_ranks_wins_range check (
    wins_easy between 0 and 10000000 and wins_normal between 0 and 10000000 and wins_hard between 0 and 10000000
    and wins_expert between 0 and 10000000 and wins_master between 0 and 10000000),
  constraint card_battle_ranks_week_wins_range check (
    week_wins_easy between 0 and 100000 and week_wins_normal between 0 and 100000 and week_wins_hard between 0 and 100000
    and week_wins_expert between 0 and 100000 and week_wins_master between 0 and 100000),
  constraint card_battle_ranks_streak_range check (best_streak between 0 and 10000000 and current_streak between 0 and 10000000 and current_streak <= best_streak),
  constraint card_battle_ranks_dex_range check (dex_count between 0 and 100000 and dex_total between 0 and 100000)
);

comment on table public.card_battle_ranks is
  'MFバトルカードのランキングの正本。1人1行。対戦のあとにクライアントがupsertする。公開後のふつうの対戦の勝ちだけを数える。';

-- 並べる列ごとに上位だけを取る。週の勝ち数は週の鍵でしぼってから並べる。
create index if not exists card_battle_ranks_wins_easy_idx on public.card_battle_ranks (wins_easy desc);
create index if not exists card_battle_ranks_wins_normal_idx on public.card_battle_ranks (wins_normal desc);
create index if not exists card_battle_ranks_wins_hard_idx on public.card_battle_ranks (wins_hard desc);
create index if not exists card_battle_ranks_wins_expert_idx on public.card_battle_ranks (wins_expert desc);
create index if not exists card_battle_ranks_wins_master_idx on public.card_battle_ranks (wins_master desc);
create index if not exists card_battle_ranks_week_idx on public.card_battle_ranks (week_key);
create index if not exists card_battle_ranks_streak_idx on public.card_battle_ranks (best_streak desc);
create index if not exists card_battle_ranks_dex_idx on public.card_battle_ranks (dex_count desc);

-- 「最後に更新した時刻」を必ずサーバー側で入れ直す(upsertは指定した列しか更新しないため)。
create or replace function public.card_battle_ranks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists card_battle_ranks_set_updated_at on public.card_battle_ranks;
create trigger card_battle_ranks_set_updated_at
  before insert or update on public.card_battle_ranks
  for each row execute function public.card_battle_ranks_touch_updated_at();

-- RLSと権限。公開キーで読み書きする点は既存の rankings・bond_levels・rhythm_buddy_ranks と同じ信頼レベルにそろえる。
-- 削除だけはどのロールにも許可しない(消えたら復旧できないため)。
alter table public.card_battle_ranks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_ranks' and policyname='card_battle_ranks_select') then
    create policy card_battle_ranks_select on public.card_battle_ranks
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_ranks' and policyname='card_battle_ranks_insert') then
    create policy card_battle_ranks_insert on public.card_battle_ranks
      for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_ranks' and policyname='card_battle_ranks_update') then
    create policy card_battle_ranks_update on public.card_battle_ranks
      for update to anon, authenticated using (true) with check (true);
  end if;
end $$;

-- Supabaseは既定で anon/authenticated へ全権限(DELETEを含む)を自動付与することがあるので、
-- いったん全て外してから、必要な3つだけを与え直す。
revoke all on public.card_battle_ranks from anon, authenticated;
grant select, insert, update on public.card_battle_ranks to anon, authenticated;

-- 既存の表に触っていないことの検査。違えば例外で止まる(commitされない)。
do $$
begin
  if (select rankings_count from card_rank_counts_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
  if (select bond_count from card_rank_counts_before) <> (select count(*) from public.bond_levels) then
    raise exception 'bond_levels の件数が変化しました';
  end if;
  if (select buddy_count from card_rank_counts_before) <> (select count(*) from public.rhythm_buddy_ranks) then
    raise exception 'rhythm_buddy_ranks の件数が変化しました';
  end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する(最後の1文の結果だけが表示されるため)。
with facts as (
  select 1 as sort, 'テーブル' as item,
         (select count(*)::text from information_schema.tables
          where table_schema='public' and table_name='card_battle_ranks') || ' (1なら作成済み)' as value
  union all
  select 2, 'カラム',
         (select string_agg(column_name, ', ' order by ordinal_position)
          from information_schema.columns
          where table_schema='public' and table_name='card_battle_ranks')
  union all
  select 3, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='card_battle_ranks')
  union all
  select 4, 'ポリシー(select/insert/updateの3つ)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='card_battle_ranks')
  union all
  select 5, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='card_battle_ranks'
            and grantee in ('anon','authenticated'))
  union all
  select 6, 'rankings / bond_levels / rhythm_buddy_ranks の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings) || ' / ' || (select count(*)::text from public.bond_levels) || ' / ' || (select count(*)::text from public.rhythm_buddy_ranks)
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しいテーブルを認識させる。忘れると、しばらくアプリから見えないことがある。
notify pgrst, 'reload schema';
