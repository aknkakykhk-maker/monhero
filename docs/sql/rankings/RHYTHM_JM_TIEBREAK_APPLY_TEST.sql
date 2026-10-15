-- モンヒロビートの総合・週間・イベントの同点を「JUST MARVELOUS の数」で分けるための関数を足すSQL。
-- RHYTHM_JM_TIEBREAK_APPLY.sql の予行演習。末尾が rollback; なので何も残らない。
-- 読み取り専用: 実質はい(最後に rollback)。本番変更は残らない。
-- 何度流しても同じ結果になる(create or replace だけ)。
--
-- 新しい関数を足すだけ。既存の表・列・ビュー・関数・RLS・ポリシー・権限・データには一切触らない
-- (rankings・rhythm_total_rankings・rhythm_week_score_totals・rhythm_event_* への alter / drop / delete / update / 置き換えをしない)。
-- 先に RHYTHM_JM_TIEBREAK_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
--
-- なぜ(2026-10-15・社長の決定「案2: 総合・週間・イベントも JUST MARVELOUS でこの曲とそろえる」):
--   「この曲」はスコアが同じなら JUST MARVELOUS の多いほうを上にした(#3030)。総合・週間・イベントは
--   合計点が同じだと先に出した人が上のまま。合計点の並びは今のビュー・関数のまま変えず、
--   同じ合計点の中だけをアプリが並べ直せるように「その人の JUST MARVELOUS の合計」を返す関数を足す。
--   JUST MARVELOUS の数は送信済みの記録の party の先頭(判定の内訳)の precise。無い・壊れている記録は 0 と数える。
--
--   ・rhythm_party_precise(party)                         … 1件の記録の JUST MARVELOUS の数
--   ・rhythm_total_precise(identity_keys)                 … 総合: 曲ごとのベスト1件(難易度は問わない)の合計
--   ・rhythm_week_precise(from_at, to_at, identity_keys)  … 週間: 期間中に出した記録すべての合計(累計スコアと同じ数え方)
--   ・rhythm_event_precise(song_ids, from_at, to_at, identity_keys) … イベント総合: 期間×対象曲の曲ごとのベスト1件の合計
--   identity_keys に人の単位(identity_key)を並べると、その人たちの分だけを返す(null なら全員)。
--   曲ごとのベストは、同じ点の記録が2件あれば JUST MARVELOUS の多いほうを取る(「この曲」と同じ)。
--
-- アプリ側はこのSQLを当てる前でも壊れない。関数が無い間は今の並び(合計点→先に出した人)のまま出す
-- (26-supabase.jsx の rhythmTieFix)。SQLの適用とアプリの公開はどちらが先でもよい。

begin;

do $$
begin
  if to_regclass('public.rhythm_identified_scores') is null then
    raise exception 'public.rhythm_identified_scores がありません。RHYTHM_TOTAL_APPLY.sql が当たっている環境で流してください(このSQLは何も変えていません)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'rhythm_identified_scores' and column_name = 'party') then
    raise exception 'public.rhythm_identified_scores に party の列がありません(このSQLは何も変えていません)';
  end if;
end $$;

create temporary table rhythm_jm_count_before on commit drop as
select count(*) as row_count from public.rankings;

-- 1件の記録の JUST MARVELOUS の数。party は [ {perfect:…, precise:…, …} ] の形。違う形なら 0
create or replace function public.rhythm_party_precise(party jsonb)
returns bigint
language sql immutable as $$
  select case
           when jsonb_typeof(party) = 'array'
            and jsonb_typeof(party -> 0) = 'object'
            and (party -> 0 ->> 'precise') ~ '^[0-9]{1,12}(\.[0-9]+)?$'
           then floor((party -> 0 ->> 'precise')::numeric)::bigint
           else 0
         end;
$$;

comment on function public.rhythm_party_precise(jsonb) is
  'モンビーの記録1件の JUST MARVELOUS の数(party の先頭の precise)。無い・壊れているときは 0。';

create or replace function public.rhythm_total_precise(identity_keys text[] default null)
returns table(identity_key text, total_precise bigint)
language sql stable security invoker as $$
  with bests as (
    select distinct on (s.identity_key, s.song_id)
           s.identity_key, public.rhythm_party_precise(s.party) as precise
      from public.rhythm_identified_scores s
     where (identity_keys is null or s.identity_key = any(identity_keys))
       and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                        where x.song_id = s.song_id)
     order by s.identity_key, s.song_id, s.score desc,
              public.rhythm_party_precise(s.party) desc, s.created_at asc, s.id asc
  )
  select b.identity_key::text, coalesce(sum(b.precise), 0)::bigint
    from bests b
   group by b.identity_key;
$$;

comment on function public.rhythm_total_precise(text[]) is
  '総合ランキング(rhythm_total_rankings)の同点を分けるための、人ごとの JUST MARVELOUS の合計(曲ごとのベスト1件)。';

create or replace function public.rhythm_week_precise(from_at timestamptz, to_at timestamptz, identity_keys text[] default null)
returns table(identity_key text, total_precise bigint)
language sql stable security invoker as $$
  select s.identity_key::text, coalesce(sum(public.rhythm_party_precise(s.party)), 0)::bigint
    from public.rhythm_identified_scores s
   where s.created_at >= from_at and s.created_at < to_at
     and (identity_keys is null or s.identity_key = any(identity_keys))
     and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                      where x.song_id = s.song_id)
   group by s.identity_key;
$$;

comment on function public.rhythm_week_precise(timestamptz, timestamptz, text[]) is
  '週間ランキング(rhythm_week_score_totals)の同点を分けるための、期間中の記録すべての JUST MARVELOUS の合計。';

create or replace function public.rhythm_event_precise(song_ids text[], from_at timestamptz, to_at timestamptz, identity_keys text[] default null)
returns table(identity_key text, total_precise bigint)
language sql stable security invoker as $$
  with bests as (
    select distinct on (s.identity_key, s.song_id)
           s.identity_key, public.rhythm_party_precise(s.party) as precise
      from public.rhythm_identified_scores s
     where s.song_id = any(song_ids)
       and s.created_at >= from_at and s.created_at < to_at
       and (identity_keys is null or s.identity_key = any(identity_keys))
       and not exists (select 1 from public.rhythm_ranking_song_exclusions x
                        where x.song_id = s.song_id)
     order by s.identity_key, s.song_id, s.score desc,
              public.rhythm_party_precise(s.party) desc, s.created_at asc, s.id asc
  )
  select b.identity_key::text, coalesce(sum(b.precise), 0)::bigint
    from bests b
   group by b.identity_key;
$$;

comment on function public.rhythm_event_precise(text[], timestamptz, timestamptz, text[]) is
  'イベント総合(rhythm_event_totals / _bonus)の同点を分けるための、期間×対象曲の曲ごとのベスト1件の JUST MARVELOUS の合計。';

grant execute on function public.rhythm_party_precise(jsonb)                                    to anon, authenticated;
grant execute on function public.rhythm_total_precise(text[])                                   to anon, authenticated;
grant execute on function public.rhythm_week_precise(timestamptz, timestamptz, text[])          to anon, authenticated;
grant execute on function public.rhythm_event_precise(text[], timestamptz, timestamptz, text[]) to anon, authenticated;

-- 安全確認: rankings の件数が変わっていない
do $$
begin
  if (select row_count from rhythm_jm_count_before) <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;
end $$;

-- PostgREST に新しい関数を知らせる
-- 予行演習なので知らせない・残さない
select identity_key, total_precise from public.rhythm_total_precise() order by total_precise desc limit 5;

rollback;
