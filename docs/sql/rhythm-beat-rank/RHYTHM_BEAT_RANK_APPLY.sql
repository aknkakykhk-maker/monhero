-- モンヒロビートの「ビートランク」の全国ランキング用の表 public.rhythm_beat_ranks を足すSQL(2026-10-29 社長の決め)。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後に commit する。1回で流せる形にまとめてある。
--
-- ★足すだけ。既存の表(rankings・rhythm_buddy_ranks・card_battle_ranks_v2 など)には一切触らない
--   (DROP・DELETE・ALTER・UPDATE・RLS/権限の変更をしない)。最後に「件数が変わっていない」ことを機械的に確かめる。
-- 書き込みの守り: このゲームはログインが無いので、auth.uid() で「自分の行だけ」を守れない。
--   代わりに、みんなのデッキ(card_deck_entries)と同じ「持ち主の鍵」の形にする。
--   端末が長い鍵を作って持ち、表には md5 の指紋だけを置く。表へ直接は書かせず、鍵を確かめる関数 rhythm_beat_rank_put だけが書く。
--   ブリーダーの番号は人に見えるが、番号だけではほかの人の行を書きかえられない。
-- ランクはサーバが経験値の合計から計算する(次のランクまで 20+3×ランク・全員ランク1から・上限なし)。経験値の合計は減らせない。
-- 並べ方: ランクの高い順、同じなら経験値の合計の多い順、同じならはやく着いた順(updated_at)。
begin;

create temporary table beat_rank_counts_before on commit drop as
select (select count(*) from public.rankings) as rankings_count,
       (select count(*) from public.rhythm_buddy_ranks) as buddy_count,
       (select count(*) from public.card_battle_ranks_v2) as card_count;

-- 既に別物の rhythm_beat_ranks がある環境では、上書きせず止める
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rhythm_beat_ranks')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'rhythm_beat_ranks' and column_name = 'xp_total') then
    raise exception 'public.rhythm_beat_ranks が別の形で既に存在します。内容を確認してから再実行してください';
  end if;
end $$;

create table if not exists public.rhythm_beat_ranks (
  breeder_id    text        not null,
  key_hash      text        not null,
  user_name     text        not null,
  icon          text,
  profile_frame text,
  rank          integer     not null default 1,
  xp_total      bigint      not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint rhythm_beat_ranks_pkey primary key (breeder_id),
  constraint rhythm_beat_ranks_breeder_id_format check (breeder_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  constraint rhythm_beat_ranks_user_name_len check (char_length(user_name) between 1 and 40),
  constraint rhythm_beat_ranks_range check (rank between 1 and 1000000 and xp_total between 0 and 1000000000000)
);
comment on table public.rhythm_beat_ranks is
  'モンヒロビートのビートランク(2026-10-29から)。1人1行・breeder_id。書くのは rhythm_beat_rank_put だけ(持ち主の鍵の指紋を確かめる)';

create index if not exists rhythm_beat_ranks_order_idx on public.rhythm_beat_ranks (rank desc, xp_total desc, updated_at asc);

-- 経験値の合計からランクを出す(アプリの playerRankInfo と同じ式: 次のランクまで 20+3×ランク)
create or replace function public.rhythm_beat_rank_of(p_xp bigint)
returns integer language plpgsql immutable set search_path = public as $$
declare left_xp bigint := greatest(0, coalesce(p_xp, 0)); r integer := 1;
begin
  while left_xp >= 20 + 3 * r loop
    left_xp := left_xp - (20 + 3 * r);
    r := r + 1;
  end loop;
  return r;
end $$;

-- 自分の行を書く。返り値: 'ok' | 'bad'(形がちがう) | 'locked'(鍵がちがう)
-- 経験値の合計は、今より少ない値が来ても下げない(別の端末の古い値で上書きしない)
create or replace function public.rhythm_beat_rank_put(
  p_id text, p_key text, p_name text, p_icon text, p_frame text, p_xp bigint)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.rhythm_beat_ranks; xp bigint;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{8,64}$' or p_key is null or length(p_key) not between 24 and 128
     or p_xp is null or p_xp < 0 or p_xp > 1000000000000 or char_length(coalesce(p_name, '')) not between 1 and 40 then
    return 'bad';
  end if;
  select * into cur from public.rhythm_beat_ranks where breeder_id = p_id for update;
  if found then
    if cur.key_hash <> md5(p_key) then return 'locked'; end if;
    xp := greatest(cur.xp_total, p_xp);
    update public.rhythm_beat_ranks
       set user_name = p_name, icon = left(p_icon, 64), profile_frame = left(p_frame, 40),
           xp_total = xp, rank = public.rhythm_beat_rank_of(xp),
           updated_at = case when xp > cur.xp_total then now() else cur.updated_at end
     where breeder_id = p_id;
  else
    insert into public.rhythm_beat_ranks (breeder_id, key_hash, user_name, icon, profile_frame, rank, xp_total)
    values (p_id, md5(p_key), p_name, left(p_icon, 64), left(p_frame, 40), public.rhythm_beat_rank_of(p_xp), p_xp);
  end if;
  return 'ok';
end $$;

-- 自分の順位(自分より上にいる人の数 + 1)。行が無ければ null
create or replace function public.rhythm_beat_rank_place(p_id text)
returns integer language sql stable security definer set search_path = public as $$
  select 1 + (select count(*) from public.rhythm_beat_ranks o
              where (o.rank, o.xp_total, -extract(epoch from o.updated_at)) > (m.rank, m.xp_total, -extract(epoch from m.updated_at)))::integer
  from public.rhythm_beat_ranks m where m.breeder_id = p_id
$$;

alter table public.rhythm_beat_ranks enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'rhythm_beat_ranks' and policyname = 'rhythm_beat_ranks_select') then
    create policy rhythm_beat_ranks_select on public.rhythm_beat_ranks for select to anon, authenticated using (true);
  end if;
end $$;
-- 表へは直接書かせない(insert・update・delete の権限を与えない)。読むのは見せてよい列だけ(key_hash は見せない)
revoke all on public.rhythm_beat_ranks from anon, authenticated;
grant select (breeder_id, user_name, icon, profile_frame, rank, xp_total, updated_at) on public.rhythm_beat_ranks to anon, authenticated;
revoke all on function public.rhythm_beat_rank_put(text, text, text, text, text, bigint) from public;
grant execute on function public.rhythm_beat_rank_put(text, text, text, text, text, bigint) to anon, authenticated;
grant execute on function public.rhythm_beat_rank_place(text) to anon, authenticated;
grant execute on function public.rhythm_beat_rank_of(bigint) to anon, authenticated;

-- 安全確認: 既存の表の件数が変わっていなければ commit。変わっていたら止めて、何も残さない
do $$
declare b record;
begin
  select * into b from beat_rank_counts_before;
  if b.rankings_count <> (select count(*) from public.rankings)
     or b.buddy_count <> (select count(*) from public.rhythm_buddy_ranks)
     or b.card_count <> (select count(*) from public.card_battle_ranks_v2) then
    raise exception '既存の表の件数が変わりました。止めます(何も残しません)';
  end if;
end $$;

select 'rhythm_beat_ranks を足しました' as 結果,
       (select count(*) from public.rhythm_beat_ranks) as 行の数,
       public.rhythm_beat_rank_of(0) as 経験値0のランク,
       public.rhythm_beat_rank_of(56) as 経験値56のランク;

commit;
