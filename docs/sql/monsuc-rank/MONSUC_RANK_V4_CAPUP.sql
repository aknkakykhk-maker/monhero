-- モンヒロサクセスの総合力ランキング: 能力の上限アップ(2026-11-15 社長・r1115-103/105)
--   能力は 999 を超えてよい(形の見張りは 1つ 99,999 まで。ゲームの天井ではない)。
--   新しい総合力(power_v3)の能力の分: 999 までは今までの式(能力 × (2.5 + 2.0 × 能力 ÷ 900))、999 を超えた分は 1点 3.5。端末の芯 monhero-success.js(powerOverOf)と同じ
--   すでにある行は能力が全部 999 まで=この式で出し直しても同じ値。行は消さない・書き換えない(power_v3 を埋め直さない)。
--   古い列 power・grade(古い式)は今までどおり 999 で切った値のまま
--   前提: MONSUC_RANK_V3_POWER.sql が流してあること。流す順: このファイル1つ(何度流しても同じ)

-- ① power_v3 の範囲を広げる(100,000 → 2,500,000。6能力が 99,999 でも入る)
alter table public.monsuc_finishes drop constraint if exists monsuc_finishes_v3;
alter table public.monsuc_finishes add constraint monsuc_finishes_v3 check (
  (power_v3 is null or power_v3 between 0 and 2500000)
  and (grade_v3 is null or grade_v3 ~ '^((G|F|E|D|C|B|A|S|SS|SSS)[0-9]{1,3}|M[GFEDCBA]?[1-9]?)$'));

-- ② 能力の分: 999 を超えた分は 1点 3.5
create or replace function public.monsuc_rank_stat_power3(p_stats jsonb)
returns numeric language sql immutable set search_path = public as $$
  select coalesce((select sum(least(v, 999) * (2.5 + 2.0 * least(v, 999) / 900) + greatest(v - 999, 0) * 3.5)
                   from (select least(greatest(coalesce((p_stats->>k)::numeric, 0), 0), 99999) as v
                         from unnest(array['life','pow','wise','hit','eva','tough']) k) t), 0)
$$;

-- ③ 送信: 能力の形の見張りを 1つ 99,999・合計 599,994・新しい総合力 2,500,000 に(ほかは今までと同じ)
create or replace function public.monsuc_rank_submit(p_owner text, p_key text, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date;
  v_chk text; u record; v_run text; v_lin text; v_stats jsonb; v_techs jsonb; v_sum int := 0; v_k text; v_n numeric;
  v_lv int; v_loy int; v_pop int; v_power int; v_grade text; v_ver int; v_power3 int; v_grade3 text;
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
  select coalesce(power_v3, power), coalesce(grade_v3, grade), lineage, finished_at into r_power, r_grade, r_lin, r_at from public.monsuc_finishes where run_id = v_run;
  if found then
    select count(*) + 1 into p_all from public.monsuc_finishes where not hidden and (coalesce(power_v3, power) > r_power or (coalesce(power_v3, power) = r_power and finished_at < r_at));
    select count(*) + 1 into p_lin from public.monsuc_finishes where not hidden and lineage = r_lin and (coalesce(power_v3, power) > r_power or (coalesce(power_v3, power) = r_power and finished_at < r_at));
    return jsonb_build_object('ok', true, 'reason', 'dup', 'power', r_power, 'grade', r_grade, 'place_all', p_all, 'place_lineage', p_lin);
  end if;

  -- 形を確かめる
  v_stats := p_row->'stats'; v_techs := coalesce(p_row->'techs', '[]'::jsonb); v_lin := p_row->>'lineage';
  if v_stats is null or jsonb_typeof(v_stats) <> 'object' or jsonb_typeof(v_techs) <> 'array' or jsonb_array_length(v_techs) > 99 then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  foreach v_k in array array['life','pow','wise','hit','eva','tough'] loop
    if jsonb_typeof(v_stats->v_k) <> 'number' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
    v_n := (v_stats->>v_k)::numeric;
    if v_n <> trunc(v_n) or v_n < 0 or v_n > 99999 then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
    v_sum := v_sum + v_n::int;
  end loop;
  -- 技は「熟練の数(古い端末)」か「{ r: ランク1〜5, a: 間合い適性の段 G〜M }(新しい端末・2026-11-13)」のどちらか。混ぜない
  if exists (select 1 from jsonb_array_elements(v_techs) e where case
       when jsonb_typeof(e) = 'number' then (e::text)::numeric not between 0 and 100
       when jsonb_typeof(e) = 'object' then jsonb_typeof(e->'r') <> 'number' or (e->>'r')::numeric not in (1, 2, 3, 4, 5)
                                         or coalesce(e->>'a', '') not in ('G','F','E','D','C','B','A','S','S+','SS','SS+','M')
                                         or (select count(*) from jsonb_object_keys(e)) <> 2
       else true end)
     or ((select count(*) from jsonb_array_elements(v_techs) e where jsonb_typeof(e) = 'number') > 0
         and (select count(*) from jsonb_array_elements(v_techs) e where jsonb_typeof(e) = 'object') > 0) then
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

  -- 総合力はサーバで出し直す(6能力は 1つ 999 まで=合計 5,994 まで)。古い端末(熟練の数)は今までの式、新しい端末(ランクと段)は新しい式。
  --   総合力の上限は 60,000(新しい式の最大は 6能力 14,985 + 技 99 × 640 × 1.7 + Lv・忠誠・人気 3,485 を、技の数の現実の上限 24 で見て 約44,600)
  --   v2 の CASE は、PostgreSQL が両方の枝の関数を先に計算してしまい、新しい形の技で monsuc_rank_power(熟練の数の式)が落ちていた。IF で分ける
  if exists (select 1 from jsonb_array_elements(v_techs) e where jsonb_typeof(e) = 'object') then
    v_power := public.monsuc_rank_power2(v_stats, v_techs, v_lv, v_loy, v_pop);
  else
    v_power := public.monsuc_rank_power(v_stats, v_techs, v_lv, v_loy, v_pop);
  end if;
  v_power3 := public.monsuc_rank_power3(v_stats, v_techs, v_lv, v_loy, v_pop);   -- 新しい式(2026-11-14)
  if v_sum > 599994 or v_power > 60000 or v_power3 > 2500000 then return jsonb_build_object('ok', false, 'reason', 'over_cap'); end if;
  v_grade := public.monsuc_rank_grade(v_power);
  v_grade3 := public.monsuc_rank_grade3(v_power3);

  -- 1分に1回・1日50回まで
  perform pg_advisory_xact_lock(hashtext('monsuc_rank_submit_' || p_owner));
  select * into u from public.monsuc_rank_usage where owner_id = p_owner and day = v_day;
  if found and (u.sent >= 50 or u.last_at > now() - interval '1 minute') then return jsonb_build_object('ok', false, 'reason', 'busy'); end if;

  insert into public.monsuc_finishes (run_id, owner_id, user_name, child_name, species, lineage, dye, stats, techs, lv, loyal, pop, power, grade, engine_version, power_v3, grade_v3)
  values (v_run, p_owner, coalesce(p_row->>'user_name', ''), coalesce(p_row->>'child_name', ''), p_row->>'species', v_lin,
          coalesce(p_row->'dye', '[]'::jsonb),
          jsonb_build_object('life', (v_stats->>'life')::int, 'pow', (v_stats->>'pow')::int, 'wise', (v_stats->>'wise')::int,
                             'hit', (v_stats->>'hit')::int, 'eva', (v_stats->>'eva')::int, 'tough', (v_stats->>'tough')::int),
          v_techs, v_lv, v_loy, v_pop, v_power, v_grade, v_ver, v_power3, v_grade3)
  on conflict (run_id) do nothing;
  if not found then return jsonb_build_object('ok', true, 'reason', 'dup', 'power', v_power3, 'grade', v_grade3); end if;
  insert into public.monsuc_rank_usage (owner_id, day, sent, last_at) values (p_owner, v_day, 1, now())
  on conflict (owner_id, day) do update set sent = public.monsuc_rank_usage.sent + 1, last_at = now();

  select count(*) + 1 into p_all from public.monsuc_finishes where not hidden and run_id <> v_run and coalesce(power_v3, power) > v_power3;
  select count(*) + 1 into p_lin from public.monsuc_finishes where not hidden and run_id <> v_run and lineage = v_lin and coalesce(power_v3, power) > v_power3;
  return jsonb_build_object('ok', true, 'power', v_power3, 'grade', v_grade3, 'place_all', p_all, 'place_lineage', p_lin);
end $$;

-- ④ 計算の関数は登録の関数の中からだけ使う(今までと同じ)
revoke all on function public.monsuc_rank_stat_power3(jsonb) from public, anon, authenticated;
revoke all on function public.monsuc_rank_submit(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.monsuc_rank_submit(text, text, jsonb) to anon, authenticated, service_role;
