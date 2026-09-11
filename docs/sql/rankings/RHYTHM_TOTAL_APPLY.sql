-- モンビー(音ゲー)の「ブリーダー別 全曲合算ランキング」用の集計ビューを作るSQL。
-- 読み取り専用: いいえ。
-- 本番変更が残るか: はい。安全確認に成功した場合だけ最後にcommitする。
--
-- 既存の public.rankings の行・列・RLS・ポリシー・権限は変更しない
-- (DROP・DELETE・UPDATE・ALTERをしない)。足すのは次だけ。
--
--   ・読み取り専用のビュー5枚(rhythm_scores / rhythm_identity_map /
--     rhythm_identified_scores / rhythm_song_bests / rhythm_total_rankings)
--   ・除外テーブル1つ(rhythm_ranking_song_exclusions。平常時は空)
--   ・rankings のRhythm行だけを見る部分索引2つ
--
-- 先に RHYTHM_TOTAL_APPLY_TEST.sql(末尾 rollback;)をエラー無く通してから実行する。
-- 仕様は docs/spec/RHYTHM_RANKING.md §3(何を競うか)・§4(人の見分け方)・§8(この設計)。

begin;

-- security_invoker はPostgreSQL 15から。これより古い環境では、ビューが
-- rankings のRLSをすり抜けて読んでしまうため、作らずに止める。
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'PostgreSQL 15以上が必要です(security_invoker)。いまのバージョン: %', current_setting('server_version');
  end if;
end $$;

-- 適用前の状態を控える。rankings は一切変えないので、最後に
-- 「件数もRLSもポリシーも権限も変わっていない」ことを機械的に確かめる。
create temporary table rhythm_total_count_before on commit drop as
select count(*) as row_count from public.rankings;

create temporary table rhythm_total_security_before on commit drop as
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

create temporary table rhythm_total_policies_before on commit drop as
select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies where schemaname = 'public' and tablename = 'rankings';

create temporary table rhythm_total_grants_before on commit drop as
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated');

-- 同じ名前の「テーブル」が既にある環境では、ビューを作れず取り違えも起きるので止める。
do $$
declare
  conflicting text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into conflicting
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p', 'f')   -- 通常テーブル・パーティション・外部テーブル
     and c.relname in ('rhythm_scores','rhythm_identity_map','rhythm_identified_scores',
                       'rhythm_song_bests','rhythm_total_rankings');
  if conflicting is not null then
    raise exception 'ビューと同じ名前のテーブルが既にあります: %', conflicting;
  end if;
end $$;

-- ===== 除外テーブル(平常時は空) =====
-- テスト曲の記録がまぎれ込んだときや、曲を下げることになったときに1行足すためだけのもの。
-- rankings の行は消さない(docs/spec/RHYTHM_RANKING.md §5.5・§8.5)。
create table if not exists public.rhythm_ranking_song_exclusions (
  song_id text primary key,
  reason  text,
  created_at timestamptz not null default now()
);

comment on table public.rhythm_ranking_song_exclusions is
  '全曲合算ランキングの集計から外す曲。平常時は空。行を足すと集計から外れるだけで、rankingsの記録は残る。';

alter table public.rhythm_ranking_song_exclusions enable row level security;

-- 読むだけ許可する。ビューがsecurity_invokerで参照するため、これが無いと
-- 一般のプレイヤーからは除外判定ができず、合算が空になってしまう。
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public'
                    and tablename = 'rhythm_ranking_song_exclusions'
                    and policyname = 'anyone can read rhythm ranking exclusions') then
    create policy "anyone can read rhythm ranking exclusions"
      on public.rhythm_ranking_song_exclusions for select using (true);
  end if;
end $$;

-- ===== ① Rhythm行を曲・難易度へ割る =====
-- キーは Rhythm-<songId>-<難易度id>。songId にハイフンが入らない約束なので、
-- ハイフンが2つ(=3つに割れる)ものだけを対象にする(docs/spec/RHYTHM_RANKING.md §5.8)。
create or replace view public.rhythm_scores
with (security_invoker = on) as
select r.id, r.created_at, r.user_name, r.breeder_id, r.level, r.icon, r.score,
       split_part(r.difficulty, '-', 2) as song_id,
       split_part(r.difficulty, '-', 3) as difficulty_id
  from public.rankings r
 where r.difficulty like 'Rhythm-%'
   and array_length(string_to_array(r.difficulty, '-'), 1) = 3
   and r.score is not null;

comment on view public.rhythm_scores is
  'モンビーの記録を曲IDと難易度IDへ割ったもの。rankings の読み取り専用ビュー。';

-- ===== ② 名前とIDの橋渡し =====
-- IDが無かった時代の記録を引き継ぐための対応表。
-- 「その名前に結び付くIDが1つだけ」のときに限って寄せる。同名の別人がいる名前は
-- どちらのものとも決められないので寄せない(docs/spec/RHYTHM_RANKING.md §4.4)。
create or replace view public.rhythm_identity_map
with (security_invoker = on) as
select user_name,
       case when count(distinct breeder_id) = 1 then min(breeder_id) end as merged_breeder_id
  from public.rhythm_scores
 where breeder_id is not null
 group by user_name;

comment on view public.rhythm_identity_map is
  '名前→ブリーダーIDの対応表。1対1のときだけIDを返し、同名の別人がいる名前はNULLを返す。';

-- ===== ③ 人の単位(identity_key)を付ける =====
create or replace view public.rhythm_identified_scores
with (security_invoker = on) as
select s.id, s.created_at, s.user_name, s.breeder_id, s.level, s.icon, s.score,
       s.song_id, s.difficulty_id,
       coalesce(s.breeder_id, m.merged_breeder_id, 'name:' || s.user_name) as identity_key
  from public.rhythm_scores s
  left join public.rhythm_identity_map m on m.user_name = s.user_name;

comment on view public.rhythm_identified_scores is
  'モンビーの記録に、集計で使う人の単位(identity_key)を付けたもの。';

-- ===== ④ 曲ごとのベスト1件(難易度は問わない) =====
create or replace view public.rhythm_song_bests
with (security_invoker = on) as
select distinct on (s.identity_key, s.song_id)
       s.identity_key, s.user_name, s.song_id, s.difficulty_id,
       s.score, s.created_at, s.level, s.icon
  from public.rhythm_identified_scores s
 where not exists (select 1 from public.rhythm_ranking_song_exclusions x
                    where x.song_id = s.song_id)
 order by s.identity_key, s.song_id, s.score desc, s.created_at asc, s.id asc;

comment on view public.rhythm_song_bests is
  '人×曲ごとの最高スコア1件(難易度は問わない)。全曲合算とイベント集計の土台。';

-- ===== ⑤ ブリーダー別 全曲合算 =====
-- 表示名・Lv・アイコンは、その人のいちばん新しい記録のものを採る(名前を変えたら追従する)。
-- 並び順はここに書かない。取りにいくときに order で指定する(PostgRESTが上書きするため)。
create or replace view public.rhythm_total_rankings
with (security_invoker = on) as
select b.identity_key,
       (array_agg(b.user_name order by b.created_at desc))[1] as user_name,
       sum(b.score)::bigint                                   as total_score,
       count(*)::int                                          as song_count,
       max(b.created_at)                                      as last_scored_at,
       (array_agg(b.level order by b.created_at desc))[1]     as level,
       (array_agg(b.icon  order by b.created_at desc))[1]     as icon
  from public.rhythm_song_bests b
 group by b.identity_key;

comment on view public.rhythm_total_rankings is
  'ブリーダー別の全曲合算ランキング。曲ごとのベスト1件を全曲ぶん合計したもの。';

-- ===== 索引 =====
-- Rhythm行だけを見る部分索引。既存の索引は触らない。
-- 記録が増えても「読み込みが終わらない」状態にしないため
-- (2026-07に実際に起きている。supabase/migrations/202607300001_rankings_indexes.sql)。
create index if not exists rankings_rhythm_breeder_score_idx
  on public.rankings (breeder_id, difficulty, score desc)
  where difficulty like 'Rhythm-%' and breeder_id is not null;

create index if not exists rankings_rhythm_user_score_idx
  on public.rankings (user_name, difficulty, score desc)
  where difficulty like 'Rhythm-%';

-- ===== 権限 =====
-- 読むだけ。書き込みは一切与えない(除外テーブルへの追加はSupabaseの画面から手で行う)。
grant select on public.rhythm_scores               to anon, authenticated;
grant select on public.rhythm_identity_map         to anon, authenticated;
grant select on public.rhythm_identified_scores    to anon, authenticated;
grant select on public.rhythm_song_bests           to anon, authenticated;
grant select on public.rhythm_total_rankings       to anon, authenticated;
grant select on public.rhythm_ranking_song_exclusions to anon, authenticated;

-- ===== ここから先は検査。1つでも違えば例外で止まる =====

-- 既存の rankings に触っていないこと
do $$
begin
  if (select row_count from rhythm_total_count_before)
     <> (select count(*) from public.rankings) then
    raise exception 'rankings の件数が変化しました';
  end if;

  if exists (
    (select * from rhythm_total_security_before except
     select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings')
    union all
    (select c.relrowsecurity, c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rankings'
     except select * from rhythm_total_security_before)
  ) then raise exception 'rankings のRLS状態が変化しました'; end if;

  if exists (
    (select * from rhythm_total_policies_before except
     select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings')
    union all
    (select policyname, permissive, roles::text, cmd,
            coalesce(qual, ''), coalesce(with_check, '')
     from pg_policies where schemaname = 'public' and tablename = 'rankings'
     except select * from rhythm_total_policies_before)
  ) then raise exception 'rankings のRLSポリシーが変化しました'; end if;

  if exists (
    (select * from rhythm_total_grants_before except
     select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated'))
    union all
    (select grantee, privilege_type, is_grantable
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'rankings'
       and grantee in ('anon', 'authenticated')
     except select * from rhythm_total_grants_before)
  ) then raise exception 'rankings のData API権限が変化しました'; end if;
end $$;

-- ★プレイヤーと同じ立場(anon)で本当に読めるか。
-- security_invoker のビューは rankings のRLSをそのまま通すので、SELECTのポリシーが
-- 無ければ「管理画面では見えるのにアプリでは空」になる。ここで必ず捕まえる。
do $$
declare
  as_owner int;
  as_anon  int;
begin
  select count(*) into as_owner from public.rhythm_total_rankings;

  -- PL/pgSQL から確実にロールを切り替えるため execute で実行する。
  -- set local なので、この後どう終わってもトランザクションの終わりで元へ戻る
  execute 'set local role anon';
  select count(*) into as_anon from public.rhythm_total_rankings;
  execute 'reset role';

  if as_owner > 0 and as_anon = 0 then
    raise exception 'anon から合算ランキングが読めません(管理者では%件)。rankings のSELECTポリシーを確認してください', as_owner;
  end if;
  if as_owner <> as_anon then
    raise warning 'anon から見える人数(%)と管理者から見える人数(%)が違います', as_anon, as_owner;
  end if;
end $$;

-- 追加した内容が期待どおりかを、1つの結果表にまとめて表示する。
-- Supabase の SQL Editor はファイル全体を実行すると「最後の1文」の結果しか出さないため。
with facts as (
  select 1 as sort, '作ったビュー' as item,
         (select coalesce(string_agg(c.relname, ', ' order by c.relname), 'なし')
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v'
             and c.relname in ('rhythm_scores','rhythm_identity_map','rhythm_identified_scores',
                               'rhythm_song_bests','rhythm_total_rankings')) as value
  union all
  select 2, 'RLSをすり抜けない設定(5枚とも on であること)',
         (select coalesce(string_agg(c.relname || '=' ||
                   case when exists (select 1 from unnest(coalesce(c.reloptions, '{}')) o
                                      where split_part(o, '=', 1) = 'security_invoker'
                                        and lower(split_part(o, '=', 2)) in ('on','true'))
                        then 'on' else 'off' end,
                   ', ' order by c.relname), 'なし')
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='v'
             and c.relname in ('rhythm_scores','rhythm_identity_map','rhythm_identified_scores',
                               'rhythm_song_bests','rhythm_total_rankings'))
  union all
  select 3, '除外テーブル(平常時は0件)',
         (select count(*)::text from public.rhythm_ranking_song_exclusions)
  union all
  select 4, '足した索引',
         (select coalesce(string_agg(i.relname, ', ' order by i.relname), 'なし')
            from pg_class t join pg_namespace n on n.oid=t.relnamespace
            join pg_index ix on ix.indrelid=t.oid
            join pg_class i on i.oid=ix.indexrelid
           where n.nspname='public' and t.relname='rankings'
             and i.relname in ('rankings_rhythm_breeder_score_idx','rankings_rhythm_user_score_idx'))
  union all
  select 5, 'モンビーの記録(Rhythm-)',
         (select count(*)::text from public.rhythm_scores)
  union all
  select 6, '合算に載るブリーダー数',
         (select count(*)::text from public.rhythm_total_rankings)
  union all
  select 7, '1位の合計点',
         (select coalesce(max(total_score)::text, '0') from public.rhythm_total_rankings)
  union all
  select 8, '同名で複数のIDが観測されている名前',
         (select coalesce(string_agg(user_name, ', ' order by user_name), 'なし')
            from (select user_name from public.rhythm_scores
                   where breeder_id is not null
                   group by user_name having count(distinct breeder_id) > 1) t)
  union all
  select 9, 'rankings の件数(適用前と同じであること)',
         (select count(*)::text from public.rankings)
  union all
  select 10, 'rankings のRLS(変わっていないこと)',
         (select case when c.relrowsecurity then '有効' else '無効' end
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname='rankings')
  union all
  select 11, 'rankings の権限(変わっていないこと)',
         (select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), 'なし')
            from information_schema.role_table_grants
           where table_schema='public' and table_name='rankings'
             and grantee in ('anon','authenticated'))
)
select item as "項目", value as "値" from facts order by sort;

-- 安全確認済みの変更を本番へ保存する。
commit;

-- Data API(PostgREST)へ新しいビューを認識させる。
-- これを忘れると、しばらくの間アプリから合算ランキングが見えないことがある。
notify pgrst, 'reload schema';
