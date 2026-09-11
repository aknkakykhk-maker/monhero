-- モンビー(モンヒロビート)のイベントランキングに「詳細」を出せるようにするSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 2026-09-11・ユーザー指摘「イベント側の対象曲のほうの詳細がない」。
--
-- 【なぜ要るのか】
-- 「この曲」タブは public.rankings を直接読んでいるので、判定の内訳が入っている
-- party 列をそのまま取れる。イベントタブは関数 rhythm_event_song_bests を通しており、
-- 関数は定義に書いた列しか返せないため、アプリ側が何を頼んでも party が取れない。
--
-- 【やること】
-- 既存の public.rankings の行・列・RLS・ポリシー・権限は変更しない
-- (DROP TABLE・DELETE・UPDATE・ALTER TABLE をしない)。やるのは次の3つだけ。
--
--   ・ビュー public.rhythm_scores            へ party 列を足す(create or replace)
--   ・ビュー public.rhythm_identified_scores へ party 列を足す(create or replace)
--   ・関数 public.rhythm_event_song_bests    の戻り値へ party 列を足す
--
-- ★1回やれば以後のイベントでもそのまま効く。イベントごとに流し直す必要はない
--   (対象曲と期間は引数で渡しているため)。
-- ★先に RHYTHM_TOTAL_APPLY.sql と RHYTHM_EVENT_APPLY.sql を適用しておくこと。
-- ★先に RHYTHM_EVENT_DETAIL_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
-- 仕様は docs/spec/RHYTHM_RANKING.md §6・§7。

begin;

-- 土台が無ければ止める。無いまま作ると、関数だけができて中身が空になる。
do $$
begin
  if to_regclass('public.rhythm_identified_scores') is null then
    raise exception 'public.rhythm_identified_scores がありません。先に RHYTHM_TOTAL_APPLY.sql を適用してください。';
  end if;
  if to_regprocedure('public.rhythm_event_song_bests(text[], timestamptz, timestamptz)') is null then
    raise exception 'public.rhythm_event_song_bests がありません。先に RHYTHM_EVENT_APPLY.sql を適用してください。';
  end if;
end $$;

-- ===== ① Rhythm行を曲・難易度へ割るビューへ party を足す =====
-- 足すのは列1つだけ。where も select の他の列も RHYTHM_TOTAL_APPLY.sql のまま。
create or replace view public.rhythm_scores
with (security_invoker = on) as
select r.id, r.created_at, r.user_name, r.breeder_id, r.level, r.icon, r.score, r.party,
       split_part(r.difficulty, '-', 2) as song_id,
       split_part(r.difficulty, '-', 3) as difficulty_id
  from public.rankings r
 where r.difficulty like 'Rhythm-%'
   and array_length(string_to_array(r.difficulty, '-'), 1) = 3
   and r.score is not null;

comment on view public.rhythm_scores is
  'モンビーの記録を曲IDと難易度IDへ割ったもの。rankings の読み取り専用ビュー。party に判定の内訳が入る。';

-- ===== ② 人の単位を付けたビューへ party を足す =====
create or replace view public.rhythm_identified_scores
with (security_invoker = on) as
select s.id, s.created_at, s.user_name, s.breeder_id, s.level, s.icon, s.score, s.party,
       s.song_id, s.difficulty_id,
       coalesce(s.breeder_id, m.merged_breeder_id, 'name:' || s.user_name) as identity_key
  from public.rhythm_scores s
  left join public.rhythm_identity_map m on m.user_name = s.user_name;

comment on view public.rhythm_identified_scores is
  'モンビーの記録に、集計で使う人の単位(identity_key)を付けたもの。party に判定の内訳が入る。';

-- ===== ③ 曲ごとベストの関数へ party を足す =====
-- ★戻り値の並びと型を変えるので、いったん drop してから作り直す
--   (create or replace では戻り値の型を変えられない)。
--   関数を消している時間はこのトランザクションの中だけで、commit するまで外からは見えない。
-- ★並び・絞り込み・型の明示は RHYTHM_EVENT_APPLY.sql のまま。足したのは party だけ。
drop function if exists public.rhythm_event_song_bests(text[], timestamptz, timestamptz);
create function public.rhythm_event_song_bests(
  song_ids text[], from_at timestamptz, to_at timestamptz)
returns table(identity_key text, user_name text, song_id text, difficulty_id text,
              score integer, scored_at timestamptz, level integer, icon text, party jsonb)
language sql stable security invoker as $$
  select distinct on (s.identity_key, s.song_id)
         s.identity_key::text, s.user_name::text, s.song_id::text, s.difficulty_id::text,
         s.score::integer, s.created_at, s.level::integer, s.icon::text, s.party::jsonb
    from public.rhythm_identified_scores s
   where s.song_id = any(song_ids)
     and s.created_at >= from_at and s.created_at < to_at
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;
$$;

comment on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz) is
  '期間×対象曲の、人×曲ごとの最高スコア1件(難易度は問わない)。party に判定の内訳が入る。';

-- 読み取りだけ。書き込み権限は与えない(RHYTHM_EVENT_APPLY.sql と同じ)。
grant execute on function public.rhythm_event_song_bests(text[], timestamptz, timestamptz) to anon, authenticated;

-- ===== 安全確認 =====
do $$
declare
  cols int;
begin
  -- party がちゃんと返り値に入っているか
  select count(*) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'rhythm_identified_scores' and column_name = 'party';
  if cols <> 1 then raise exception 'rhythm_identified_scores に party がありません'; end if;

  -- 関数が呼べるか(空の対象曲で呼ぶだけ。行は返らない)
  perform * from public.rhythm_event_song_bests('{}'::text[], now() - interval '1 day', now());
end $$;

commit;
