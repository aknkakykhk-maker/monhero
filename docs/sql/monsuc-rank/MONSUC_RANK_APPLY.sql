-- モンヒロサクセス 育成完了時の総合力ランキングの表と関数(2026-11-12 クラフト)。設計: docs/progress/player-raise/RANKING.md
-- 流すのは窓口。**足すだけ**(既存の表・関数・ランキングには触らない)。何度流しても同じになる(if not exists・create or replace)。
-- 前提: 助手マスモン対戦の 202611110001_masmon_pvp.sql が流してあること(持ち主の鍵 masmon_pvp_owner_check を使い回す)。
--
-- 表(どれも新しい。書くのは下の関数 monsuc_rank_submit だけ。端末は表に直接書けない)
--   monsuc_finishes    … 1行 = 育て終えた子1体。run_id(育成の id)が主キーなので、同じ育成は二度入らない
--   monsuc_rank_usage  … 送った回数((人・日)で1行)。読ませない
-- 見え方(読むだけ・hidden の行は出さない)
--   monsuc_rank_all     … 全モンスター。総合力の高い順の順位 place
--   monsuc_rank_lineage … 血統ごとの順位 place
-- 関数(端末から呼べる)
--   monsuc_rank_submit(owner, key, row) … 1件を入れる。総合力と評価はサーバが出し直す(端末の値は使わない)
--     返り値 { ok, reason?, power, grade, place_all, place_lineage }
--     reason: 'bad'(形が違う) | 'locked'(別の端末の鍵) | 'over_cap'(上限を超えた) | 'busy'(1分に1回・1日50回を超えた) | 'dup'(同じ育成はもう入っている・ok は真)
-- 日の区切りは朝4:00(JST)。ほかの回数の表と同じ。

create table if not exists public.monsuc_finishes (
  run_id         text        not null,
  owner_id       text        not null,
  user_name      text        not null default '',
  child_name     text        not null default '',
  species        text        not null,
  lineage        text        not null,
  dye            jsonb       not null default '[]'::jsonb,
  stats          jsonb       not null,
  techs          jsonb       not null default '[]'::jsonb,
  lv             integer     not null default 1,
  loyal          integer     not null default 0,
  pop            integer     not null default 0,
  power          integer     not null,
  grade          text        not null,
  engine_version integer     not null default 1,
  hidden         boolean     not null default false,
  finished_at    timestamptz not null default now(),
  constraint monsuc_finishes_pkey primary key (run_id),
  constraint monsuc_finishes_shape check (
    run_id ~ '^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$' and owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and left(run_id, length(owner_id) + 1) = owner_id || '-'
    and species ~ '^[A-Za-z]{2,32}$' and lineage ~ '^[A-Za-z_]{1,32}$'
    and length(user_name) <= 40 and length(child_name) <= 24
    and octet_length(dye::text) <= 2000 and octet_length(stats::text) <= 400 and octet_length(techs::text) <= 800),
  constraint monsuc_finishes_counts check (
    lv between 1 and 99 and loyal between 0 and 100 and pop between 0 and 100
    and power between 0 and 16500 and grade in ('G','F','E','D','C','B','A','S','SS','SSS','M') and engine_version between 1 and 1000)
);
create index if not exists monsuc_finishes_power_idx on public.monsuc_finishes (hidden, power desc);
create index if not exists monsuc_finishes_lineage_idx on public.monsuc_finishes (hidden, lineage, power desc);
create index if not exists monsuc_finishes_owner_idx on public.monsuc_finishes (owner_id);

create table if not exists public.monsuc_rank_usage (
  owner_id  text        not null,
  day       date        not null,
  sent      integer     not null default 0,
  last_at   timestamptz not null default now(),
  constraint monsuc_rank_usage_pkey primary key (owner_id, day)
);

alter table public.monsuc_finishes   enable row level security;
alter table public.monsuc_rank_usage enable row level security;
revoke all on public.monsuc_finishes   from anon, authenticated;
revoke all on public.monsuc_rank_usage from anon, authenticated;

-- 読むのは見え方だけ(hidden の行は出さない・owner_id と持ち主の鍵は出さない)
create or replace view public.monsuc_rank_all as
  select run_id, user_name, child_name, species, lineage, dye, stats, jsonb_array_length(techs) as tech_count, lv, power, grade, finished_at,
         rank() over (order by power desc, finished_at asc) as place
  from public.monsuc_finishes where not hidden;
create or replace view public.monsuc_rank_lineage as
  select run_id, user_name, child_name, species, lineage, dye, stats, jsonb_array_length(techs) as tech_count, lv, power, grade, finished_at,
         rank() over (partition by lineage order by power desc, finished_at asc) as place
  from public.monsuc_finishes where not hidden;
revoke all on public.monsuc_rank_all     from anon, authenticated;
revoke all on public.monsuc_rank_lineage from anon, authenticated;
grant select on public.monsuc_rank_all     to anon, authenticated;
grant select on public.monsuc_rank_lineage to anon, authenticated;

-- 総合力(端末の MASMON_CALC.power と同じ式): 6能力の合計×2.5 + 技ごとに(100+熟練) + Lv×15 + 忠誠×10 + 人気×10
create or replace function public.monsuc_rank_power(p_stats jsonb, p_techs jsonb, p_lv int, p_loyal int, p_pop int)
returns integer language sql immutable set search_path = public as $$
  select round(
      coalesce((select sum(least(greatest(coalesce((p_stats->>k)::numeric, 0), 0), 999)) from unnest(array['life','pow','wise','hit','eva','tough']) k), 0) * 2.5
    + coalesce((select sum(100 + least(greatest(coalesce(m.v::numeric, 0), 0), 100)) from (select value as v from jsonb_array_elements_text(p_techs) limit 8) m), 0)
    + least(greatest(p_lv, 1), 99) * 15 + least(greatest(p_loyal, 0), 100) * 10 + least(greatest(p_pop, 0), 100) * 10)::int
$$;
-- 評価(助手マスモンのランクの区切りと同じ)
create or replace function public.monsuc_rank_grade(p_power int)
returns text language sql immutable set search_path = public as $$
  select case when p_power >= 19500 then 'M' when p_power >= 18000 then 'SSS' when p_power >= 16000 then 'SS' when p_power >= 14000 then 'S'
              when p_power >= 11000 then 'A' when p_power >= 8000 then 'B' when p_power >= 6000 then 'C' when p_power >= 4500 then 'D'
              when p_power >= 3000 then 'E' when p_power >= 2000 then 'F' else 'G' end
$$;

-- 1件を入れる。p_row = { run_id, user_name, child_name, species, lineage, dye:[部位ごとの色の id(6つまで・40字まで)], stats:{life,pow,wise,hit,eva,tough}, techs:[熟練…], lv, loyal, pop, engine_version }
create or replace function public.monsuc_rank_submit(p_owner text, p_key text, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
  v_chk text; u record; v_run text; v_lin text; v_stats jsonb; v_techs jsonb; v_sum int := 0; v_k text; v_n numeric;
  v_lv int; v_loy int; v_pop int; v_power int; v_grade text; v_ver int;
  r_power int; r_grade text; r_lin text; r_at timestamptz; p_all int; p_lin int;
begin
  if p_row is null or jsonb_typeof(p_row) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  v_chk := public.masmon_pvp_owner_check(p_owner, p_key);
  if v_chk <> 'ok' then return jsonb_build_object('ok', false, 'reason', v_chk); end if;

  v_run := p_row->>'run_id';
  if v_run is null or v_run !~ '^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$' or left(v_run, length(p_owner) + 1) <> p_owner || '-' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  -- 同じ育成がもう入っていれば、その順位を返す(送り直しで二重にならない・回数も使わない)
  select power, grade, lineage, finished_at into r_power, r_grade, r_lin, r_at from public.monsuc_finishes where run_id = v_run;
  if found then
    select count(*) + 1 into p_all from public.monsuc_finishes where not hidden and (power > r_power or (power = r_power and finished_at < r_at));
    select count(*) + 1 into p_lin from public.monsuc_finishes where not hidden and lineage = r_lin and (power > r_power or (power = r_power and finished_at < r_at));
    return jsonb_build_object('ok', true, 'reason', 'dup', 'power', r_power, 'grade', r_grade, 'place_all', p_all, 'place_lineage', p_lin);
  end if;

  -- 形を確かめる
  v_stats := p_row->'stats'; v_techs := coalesce(p_row->'techs', '[]'::jsonb); v_lin := p_row->>'lineage';
  if v_stats is null or jsonb_typeof(v_stats) <> 'object' or jsonb_typeof(v_techs) <> 'array' or jsonb_array_length(v_techs) > 8 then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  foreach v_k in array array['life','pow','wise','hit','eva','tough'] loop
    if jsonb_typeof(v_stats->v_k) <> 'number' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
    v_n := (v_stats->>v_k)::numeric;
    if v_n <> trunc(v_n) or v_n < 0 or v_n > 999 then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
    v_sum := v_sum + v_n::int;
  end loop;
  if exists (select 1 from jsonb_array_elements(v_techs) e where case when jsonb_typeof(e) <> 'number' then true else (e::text)::numeric not between 0 and 100 end) then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  if jsonb_typeof(p_row->'lv') <> 'number' or jsonb_typeof(p_row->'loyal') <> 'number' or jsonb_typeof(p_row->'pop') <> 'number' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  v_lv := round((p_row->>'lv')::numeric); v_loy := round((p_row->>'loyal')::numeric); v_pop := round((p_row->>'pop')::numeric);
  if v_lv not between 1 and 99 or v_loy not between 0 and 100 or v_pop not between 0 and 100 then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  if coalesce(p_row->>'species', '') !~ '^[A-Za-z]{2,32}$' or coalesce(v_lin, '') !~ '^[A-Za-z_]{1,32}$'
     or length(coalesce(p_row->>'user_name', '')) > 40 or length(coalesce(p_row->>'child_name', '')) > 24
     or (p_row ? 'dye' and case when jsonb_typeof(p_row->'dye') <> 'array' then true
                            else jsonb_array_length(p_row->'dye') > 6
                              or exists (select 1 from jsonb_array_elements(p_row->'dye') c where jsonb_typeof(c) not in ('string', 'null') or length(c #>> '{}') > 40) end) then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  v_ver := case when jsonb_typeof(p_row->'engine_version') = 'number' then least(greatest(round((p_row->>'engine_version')::numeric)::int, 1), 1000) else 1 end;

  -- 総合力はサーバで出し直す。46ターンで届く上限(6能力の合計 5,400・総合力 16,500)を超えたら弾く
  v_power := public.monsuc_rank_power(v_stats, v_techs, v_lv, v_loy, v_pop);
  if v_sum > 5400 or v_power > 16500 then return jsonb_build_object('ok', false, 'reason', 'over_cap'); end if;
  v_grade := public.monsuc_rank_grade(v_power);

  -- 1分に1回・1日50回まで
  perform pg_advisory_xact_lock(hashtext('monsuc_rank_submit_' || p_owner));
  select * into u from public.monsuc_rank_usage where owner_id = p_owner and day = v_day;
  if found and (u.sent >= 50 or u.last_at > now() - interval '1 minute') then return jsonb_build_object('ok', false, 'reason', 'busy'); end if;

  insert into public.monsuc_finishes (run_id, owner_id, user_name, child_name, species, lineage, dye, stats, techs, lv, loyal, pop, power, grade, engine_version)
  values (v_run, p_owner, coalesce(p_row->>'user_name', ''), coalesce(p_row->>'child_name', ''), p_row->>'species', v_lin,
          coalesce(p_row->'dye', '[]'::jsonb),
          jsonb_build_object('life', (v_stats->>'life')::int, 'pow', (v_stats->>'pow')::int, 'wise', (v_stats->>'wise')::int,
                             'hit', (v_stats->>'hit')::int, 'eva', (v_stats->>'eva')::int, 'tough', (v_stats->>'tough')::int),
          v_techs, v_lv, v_loy, v_pop, v_power, v_grade, v_ver)
  on conflict (run_id) do nothing;
  if not found then return jsonb_build_object('ok', true, 'reason', 'dup', 'power', v_power, 'grade', v_grade); end if;
  insert into public.monsuc_rank_usage (owner_id, day, sent, last_at) values (p_owner, v_day, 1, now())
  on conflict (owner_id, day) do update set sent = public.monsuc_rank_usage.sent + 1, last_at = now();

  select count(*) + 1 into p_all from public.monsuc_finishes where not hidden and run_id <> v_run and power > v_power;
  select count(*) + 1 into p_lin from public.monsuc_finishes where not hidden and run_id <> v_run and lineage = v_lin and power > v_power;
  return jsonb_build_object('ok', true, 'power', v_power, 'grade', v_grade, 'place_all', p_all, 'place_lineage', p_lin);
end $$;

revoke all on function public.monsuc_rank_power(jsonb, jsonb, int, int, int) from public, anon, authenticated;
revoke all on function public.monsuc_rank_grade(int) from public, anon, authenticated;
revoke all on function public.monsuc_rank_submit(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.monsuc_rank_submit(text, text, jsonb) to anon, authenticated, service_role;
