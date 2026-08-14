-- 絆Lvランキング用テーブル public.bond_levels を追加する前の、読み取り専用の現況調査。
-- 読み取り専用: はい。
-- 本番変更が残るか: いいえ。データ・スキーマ・権限を変更しない。
--
-- 目的
--   絆Lvランキングは rankings の party(JSON) の中に絆Lvが入っているため、DB側で
--   「絆Lvの高い順」に並べられない。そのため新着順に120行だけ取ってアプリ側で開いて
--   集計しており、よく遊ぶ人の記録で枠が埋まると、しばらく遊んでいない人が
--   一覧から丸ごと消える(ブリーダーLvで2度起きたのと同じ構造の問題)。
--   これを構造的に解消するため「1人1個体1行」の専用テーブルを新設する。
--
--   このセクションでは既存の rankings には一切触れない。追加先の名前が空いているか、
--   既存テーブルのRLS・ポリシー・権限がどうなっているか(新テーブルを同じ設計に
--   そろえるため)を確認するだけ。

-- A-1. 追加先の名前が空いているか(1行でも返ったら、既に何かが存在する)
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = 'public' and table_name = 'bond_levels';

-- A-2. public スキーマの既存テーブル一覧(取り違え防止)
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- A-3. 既存 rankings のカラム構成(新テーブルの型をそろえる参考)
select ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'rankings'
order by ordinal_position;

-- A-4. 既存 rankings の件数(適用前後で変わっていないことを後で確認する)
select count(*) as rankings_rows from public.rankings;

-- A-5. 既存 rankings のRLS状態(新テーブルも同じ考え方でそろえる)
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('rankings', 'bond_levels');

-- A-6. 既存 rankings のポリシー
select policyname, permissive, roles, cmd,
       qual as using_expression, with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename in ('rankings', 'bond_levels')
order by tablename, policyname;

-- A-7. Data APIロール(anon / authenticated)の権限
select table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('rankings', 'bond_levels')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- A-8. これから使う個体ID(masuId)が、既存の記録にどのくらい入っているかの目安。
--      party が JSON/JSONB ではなく text で保存されている環境では 0行になる。
--      その場合はA-3のdata_typeを確認して共有すること(集計方法を変える必要がある)。
--      masuIdを持たない古い記録は legacy:種ID として1行にまとめる方針のため、
--      移行後にどれだけ「個体を特定できる記録」があるかを事前に見ておく。
select count(*) as party_rows,
       count(*) filter (where member->>'masuId' is not null and member->>'masuId' <> '') as with_masu_id
from public.rankings r
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(to_jsonb(r.party)) = 'array' then to_jsonb(r.party) else '[]'::jsonb end
) as member
where member is not null and jsonb_typeof(member) = 'object';
