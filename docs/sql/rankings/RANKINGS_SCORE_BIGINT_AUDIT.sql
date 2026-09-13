-- public.rankings の score 列が int4(integer) のままかどうかを確認するSQL。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。
--
-- 背景(2026-09-12):
--   チャレンジ LEGEND で 45,054,226,345(約450億)のスコアが出たのにランキングへ載らなかった。
--   int4 の上限は 2,147,483,647(約21億)なので、これを超える行は Postgres が
--   22003 (numeric value out of range) で丸ごと拒否する。ゲーム側はスコアを丸めずに
--   そのまま送るため、失敗するとローカルへ退避するだけで画面には何も出ない。
--   音ゲー(モンヒロビート)のスコアも同じ rankings テーブルへ入るので、影響はバトルだけではない。
--
-- このSQLで見るのはつぎの6点。
--   A-1 列の型(score が integer か bigint か)
--   A-2 いまの件数・最大スコア・21億超の件数(超えが0件なら「弾かれている」裏付けになる)
--   A-3 score を参照しているビュー(APPLYが落として同じ姿で作り直す対象)
--   A-4 RLS・ポリシー・Data API権限(適用前のひかえ)
--   A-5 score に関わるIndex(型変更で作り直される)
--   A-6 ほかの整数列とほかのテーブル(同じ上限を踏みそうな場所)

-- A-1. rankings の列と型。score/level/reached_wave/turns に注目する
select ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
order by ordinal_position;

-- A-2. 件数と、int4 の上限に対する現状。
--   over_int4 が 0 のまま max_score が 21億未満で止まっていれば、
--   それを超える記録が保存できていない(拒否されている)ことの裏付けになる。
select count(*) as row_count,
       max(score) as max_score,
       count(*) filter (where score > 2147483647) as over_int4_rows,
       round(max(score)::numeric / 2147483647, 3) as max_score_per_int4_limit
from public.rankings;

-- A-2b. 難易度ごとの最大スコア(どの区分が上限に近いか)
select difficulty, count(*) as row_count, max(score) as max_score
from public.rankings
group by difficulty
order by max_score desc nulls last
limit 30;

-- A-3. score 列に依存しているビュー・ルール。
--   ビューがあると ALTER TYPE は
--   「cannot alter type of a column used by a view or rule」で失敗するため、
--   APPLY はここに出るビュー(とその上に乗るビュー)を落としてから型を広げ、
--   いまの定義・所有者・コメント・権限のまま作り直す。
--   モンビーの集計(rhythm_scores → … → rhythm_total_rankings)が並ぶはず。
--   VIEW ではなく MATERIALIZED VIEW が混ざっていたら、中身の作り直しが要るので
--   APPLY_TEST が止まる。そのときは結果を共有すること。
--   定義はここで控えておく(万一のときの復元用)。
select distinct dependent.relname as dependent_name,
       case dependent.relkind when 'v' then 'VIEW' when 'm' then 'MATERIALIZED VIEW'
            else dependent.relkind::text end as dependent_kind,
       pg_get_viewdef(dependent.oid, true) as definition
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class dependent on dependent.oid = r.ev_class
join pg_class t on t.oid = d.refobjid
join pg_namespace n on n.oid = t.relnamespace
join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
where n.nspname = 'public' and t.relname = 'rankings' and a.attname = 'score'
  and dependent.relname <> 'rankings'
order by dependent_name;

-- A-4. RLS状態・ポリシー・Data API role の権限。適用の前後で変わっていないことを確かめるための控え
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rankings';

select policyname, permissive, roles::text, cmd,
       coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies
where schemaname = 'public' and tablename = 'rankings'
order by policyname;

select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rankings'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- A-5. score に関わるIndex。型を変えると自動で作り直されるので、前後で同じ定義に戻るか見る
select i.relname as index_name, ix.indisunique as is_unique,
       ix.indisvalid as is_valid, ix.indisready as is_ready,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public' and t.relname = 'rankings'
  and pg_get_indexdef(i.oid) like '%score%'
order by i.relname;

-- A-6. ほかに同じ上限を踏みそうな整数列。
--   ゲームが読み書きするテーブル(rankings / bond_levels / rhythm_total_rankings)の
--   integer 列をまとめて出す。合計や倍率が乗る列が integer なら、いずれ同じことが起きる。
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('rankings', 'bond_levels', 'rhythm_total_rankings')
  and data_type in ('integer', 'smallint')
order by table_name, ordinal_position;

-- A-6b. rhythm_total_rankings がテーブルかビューか(ビューなら元テーブル側を直せばよい)
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in ('rankings', 'bond_levels', 'rhythm_total_rankings')
order by table_name;
