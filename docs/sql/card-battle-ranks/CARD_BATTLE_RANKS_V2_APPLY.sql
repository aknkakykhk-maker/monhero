-- MFバトルカードのランキングを「一人ひとりのID(breeder_id)」で数えるための表 public.card_battle_ranks_v2 を足すSQL
-- (2026-10-26 社長「ブリーダーIDで数える形に直す」)。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。1回で流せる形にまとめてある。
--
-- ★足すだけ。既存の public.card_battle_ranks(名前で1行)には一切触らない(DROP・DELETE・ALTER・UPDATE・RLS/権限の変更をしない)。
--   アプリは、これからは新しい表へ ID で上書きし、並べるときは「新しい表」＋「新しい表にまだ来ていない人の古い行」を合わせて出す。
--   古い行はそのまま残り、その人が次に対戦すると新しい表に移る(古い行は読まれなくなるだけで、消さない)。
-- 作りは card_battle_ranks と同じ(列・範囲の決まり・索引・updated_at のトリガー・RLS・DELETE を与えない)。違いは主キーが breeder_id なことだけ。
begin;

-- 既存の表の件数を先に控える。この作業ではどれにも触らないので、最後に「件数が変わっていない」ことを機械的に確かめる。
create temporary table card_rank_v2_counts_before on commit drop as
select (select count(*) from public.card_battle_ranks) as old_count,
       (select count(*) from public.rankings) as rankings_count,
       (select count(*) from public.rhythm_buddy_ranks) as buddy_count;

-- 既に別物の card_battle_ranks_v2 がある環境では、上書きせず安全側で停止する。
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'card_battle_ranks_v2'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'card_battle_ranks_v2'
      and column_name = 'wins_master'
  ) then
    raise exception 'public.card_battle_ranks_v2 が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

create table if not exists public.card_battle_ranks_v2 (
  breeder_id       text        not null,
  user_name        text        not null,
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
  constraint card_battle_ranks_v2_pkey primary key (breeder_id),
  constraint card_battle_ranks_v2_breeder_id_format check (char_length(breeder_id) between 8 and 64),
  constraint card_battle_ranks_v2_user_name_len check (char_length(user_name) between 1 and 40),
  constraint card_battle_ranks_v2_week_key_format check (week_key is null or week_key ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint card_battle_ranks_v2_wins_range check (
    wins_easy between 0 and 10000000 and wins_normal between 0 and 10000000 and wins_hard between 0 and 10000000
    and wins_expert between 0 and 10000000 and wins_master between 0 and 10000000),
  constraint card_battle_ranks_v2_week_wins_range check (
    week_wins_easy between 0 and 100000 and week_wins_normal between 0 and 100000 and week_wins_hard between 0 and 100000
    and week_wins_expert between 0 and 100000 and week_wins_master between 0 and 100000),
  constraint card_battle_ranks_v2_streak_range check (best_streak between 0 and 10000000 and current_streak between 0 and 10000000 and current_streak <= best_streak),
  constraint card_battle_ranks_v2_dex_range check (dex_count between 0 and 100000 and dex_total between 0 and 100000)
);
comment on table public.card_battle_ranks_v2 is
  'MFバトルカードのランキングの正本(2026-10-26から)。1人1行・breeder_id で上書き。旧表 card_battle_ranks は残し、まだ移っていない人の行として読むだけ。';

create index if not exists card_battle_ranks_v2_wins_easy_idx on public.card_battle_ranks_v2 (wins_easy desc);
create index if not exists card_battle_ranks_v2_wins_normal_idx on public.card_battle_ranks_v2 (wins_normal desc);
create index if not exists card_battle_ranks_v2_wins_hard_idx on public.card_battle_ranks_v2 (wins_hard desc);
create index if not exists card_battle_ranks_v2_wins_expert_idx on public.card_battle_ranks_v2 (wins_expert desc);
create index if not exists card_battle_ranks_v2_wins_master_idx on public.card_battle_ranks_v2 (wins_master desc);
create index if not exists card_battle_ranks_v2_week_idx on public.card_battle_ranks_v2 (week_key);
create index if not exists card_battle_ranks_v2_streak_idx on public.card_battle_ranks_v2 (best_streak desc);
create index if not exists card_battle_ranks_v2_dex_idx on public.card_battle_ranks_v2 (dex_count desc);

-- updated_at は旧表と同じ関数で入れ直す(関数は旧表のSQLで作ったものをそのまま使う。無ければ作る)
create or replace function public.card_battle_ranks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists card_battle_ranks_v2_set_updated_at on public.card_battle_ranks_v2;
create trigger card_battle_ranks_v2_set_updated_at
  before insert or update on public.card_battle_ranks_v2
  for each row execute function public.card_battle_ranks_touch_updated_at();

alter table public.card_battle_ranks_v2 enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_ranks_v2' and policyname='card_battle_ranks_v2_select') then
    create policy card_battle_ranks_v2_select on public.card_battle_ranks_v2
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_ranks_v2' and policyname='card_battle_ranks_v2_insert') then
    create policy card_battle_ranks_v2_insert on public.card_battle_ranks_v2
      for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_ranks_v2' and policyname='card_battle_ranks_v2_update') then
    create policy card_battle_ranks_v2_update on public.card_battle_ranks_v2
      for update to anon, authenticated using (true) with check (true);
  end if;
end $$;
-- 削除はどのロールにも許可しない(消えたら復旧できないため)。
revoke all on public.card_battle_ranks_v2 from anon, authenticated;
grant select, insert, update on public.card_battle_ranks_v2 to anon, authenticated;

-- 既存の表に触っていないことの検査。違えば例外で止まる(commitされない)。
do $$
begin
  if (select old_count from card_rank_v2_counts_before) <> (select count(*) from public.card_battle_ranks) then
    raise exception 'card_battle_ranks の件数が変化しました';
  end if;
  if (select rankings_count from card_rank_v2_counts_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
  if (select buddy_count from card_rank_v2_counts_before) <> (select count(*) from public.rhythm_buddy_ranks) then
    raise exception 'rhythm_buddy_ranks の件数が変化しました';
  end if;
end $$;

with facts as (
  select 1 as sort, 'テーブル' as item,
         (select count(*)::text from information_schema.tables
          where table_schema='public' and table_name='card_battle_ranks_v2') || ' (1なら作成済み)' as value
  union all
  select 2, '主キー',
         (select string_agg(kcu.column_name, ', ')
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
          where tc.table_schema='public' and tc.table_name='card_battle_ranks_v2' and tc.constraint_type='PRIMARY KEY')
  union all
  select 3, 'RLS',
         (select case when c.relrowsecurity then '有効' else '無効(要確認)' end
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname='card_battle_ranks_v2')
  union all
  select 4, 'ポリシー(select/insert/updateの3つ)',
         (select coalesce(string_agg(policyname||'('||cmd||')', ', ' order by policyname), 'なし')
          from pg_policies where schemaname='public' and tablename='card_battle_ranks_v2')
  union all
  select 5, '権限(DELETEが無いこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
          from information_schema.role_table_grants
          where table_schema='public' and table_name='card_battle_ranks_v2'
            and grantee in ('anon','authenticated'))
  union all
  select 6, '旧表 card_battle_ranks / rankings / rhythm_buddy_ranks の件数(適用前と同じであること)',
         (select count(*)::text from public.card_battle_ranks) || ' / ' || (select count(*)::text from public.rankings) || ' / ' || (select count(*)::text from public.rhythm_buddy_ranks)
)
select item as "項目", value as "値" from facts order by sort;

commit;
notify pgrst, 'reload schema';
