-- ★2026-10-29 統括部長が適用済み(本番に card_battle_week_v1 がある。流し直さない)。
-- MFバトルカードの週間報酬のための「週ごとの記録」の表 public.card_battle_week_v1 を足すSQL
-- (2026-10-29 社長: 週間報酬は MASTER の週の勝ち数だけ・1〜10位にガチャポイントとビートP)。作: カード部パックくん
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。1回で流せる形にまとめてある。
--
-- 【なぜ要るか】
--   いまのランキングの表 card_battle_ranks_v2 は1人1行で、週が変わって遊ぶと week_key と「今週の勝ち数」が上書きされる。
--   そのため、終わった週の順位をあとから正しく数えられない。週ごとに1行を残す表を別に足す。
--   アプリは、いまのランキングを送るときに、同じ週の勝ち数をこちらにも送る(週+人で1行を上書き)。
--   週間報酬を受け取るとき、終わった週の行で「自分より勝ち数が多い人の数」を数えて順位を出す(いまのランキングと同じ数え方)。
--
-- ★足すだけ。既存の表(card_battle_ranks・card_battle_ranks_v2・rankings・rhythm_buddy_ranks)には一切触らない
--   (DROP・DELETE・ALTER・UPDATE・RLS/権限の変更をしない)。最後に件数が変わっていないことを機械で確かめる。
-- 作りは card_battle_ranks_v2 と同じ(範囲の決まり・updated_at のトリガー・RLS・DELETE を与えない)。
-- 違いは、主キーが (week_key, breeder_id) なことと、週の勝ち数だけを持つこと。
begin;

create temporary table card_week_v1_counts_before on commit drop as
select (select count(*) from public.card_battle_ranks) as old_count,
       (select count(*) from public.card_battle_ranks_v2) as v2_count,
       (select count(*) from public.rankings) as rankings_count,
       (select count(*) from public.rhythm_buddy_ranks) as buddy_count;

-- 既に別物の card_battle_week_v1 がある環境では、上書きせず安全側で停止する。
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'card_battle_week_v1'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'card_battle_week_v1'
      and column_name = 'week_wins_master'
  ) then
    raise exception 'public.card_battle_week_v1 が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

create table if not exists public.card_battle_week_v1 (
  week_key         text        not null,
  breeder_id       text        not null,
  user_name        text        not null,
  icon             text,
  profile_frame    text,
  week_wins_easy   integer     not null default 0,
  week_wins_normal integer     not null default 0,
  week_wins_hard   integer     not null default 0,
  week_wins_expert integer     not null default 0,
  week_wins_master integer     not null default 0,
  updated_at       timestamptz not null default now(),
  constraint card_battle_week_v1_pkey primary key (week_key, breeder_id),
  constraint card_battle_week_v1_week_key_format check (week_key ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint card_battle_week_v1_breeder_id_format check (char_length(breeder_id) between 8 and 64),
  constraint card_battle_week_v1_user_name_len check (char_length(user_name) between 1 and 40),
  constraint card_battle_week_v1_week_wins_range check (
    week_wins_easy between 0 and 100000 and week_wins_normal between 0 and 100000 and week_wins_hard between 0 and 100000
    and week_wins_expert between 0 and 100000 and week_wins_master between 0 and 100000)
);
comment on table public.card_battle_week_v1 is
  'MFバトルカードの週ごとの記録(2026-10-29から)。週(week_key・月曜5時の日付)+breeder_id で1行。週間報酬の順位を数えるために残す。card_battle_ranks_v2 の今週の勝ち数と同じ値を送る';

create index if not exists card_battle_week_v1_master_idx on public.card_battle_week_v1 (week_key, week_wins_master desc);

create or replace function public.card_battle_ranks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists card_battle_week_v1_set_updated_at on public.card_battle_week_v1;
create trigger card_battle_week_v1_set_updated_at
  before insert or update on public.card_battle_week_v1
  for each row execute function public.card_battle_ranks_touch_updated_at();

alter table public.card_battle_week_v1 enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_week_v1' and policyname='card_battle_week_v1_select') then
    create policy card_battle_week_v1_select on public.card_battle_week_v1
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_week_v1' and policyname='card_battle_week_v1_insert') then
    create policy card_battle_week_v1_insert on public.card_battle_week_v1
      for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='card_battle_week_v1' and policyname='card_battle_week_v1_update') then
    create policy card_battle_week_v1_update on public.card_battle_week_v1
      for update to anon, authenticated using (true) with check (true);
  end if;
end $$;
-- 削除はどのロールにも許可しない(消えたら復旧できないため)。
revoke all on public.card_battle_week_v1 from anon, authenticated;
grant select, insert, update on public.card_battle_week_v1 to anon, authenticated;

-- 既存の表に触っていないことの検査。違えば例外で止まる(commitされない)。
do $$
begin
  if (select old_count from card_week_v1_counts_before) <> (select count(*) from public.card_battle_ranks) then
    raise exception 'card_battle_ranks の件数が変化しました';
  end if;
  if (select v2_count from card_week_v1_counts_before) <> (select count(*) from public.card_battle_ranks_v2) then
    raise exception 'card_battle_ranks_v2 の件数が変化しました';
  end if;
  if (select rankings_count from card_week_v1_counts_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
  if (select buddy_count from card_week_v1_counts_before) <> (select count(*) from public.rhythm_buddy_ranks) then
    raise exception 'rhythm_buddy_ranks の件数が変化しました';
  end if;
end $$;

commit;
