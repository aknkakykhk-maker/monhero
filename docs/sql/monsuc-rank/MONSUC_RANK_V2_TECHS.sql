-- モンヒロサクセスの総合力ランキング: 技の数え方の作り直し(2026-11-13 社長の案)。既存の行と送信は壊さない・何度流しても同じ
--   ・古い端末(techs = 熟練の数の並び・8つまで)は今までどおり通り、今までの式で計算する(既存の行は書き換えない)
--   ・新しい端末(techs = { r: ランク, a: 間合い適性の段 } の並び・99 まで)は新しい式: 技1つ = ランクの値(40/80/160/320/640)×(1 + (段 − C) × 0.1)
--   ・技の並びの大きさの上限 800 バイト → 6,000 バイト・総合力の上限 40,000 → 60,000

-- ① 表の制約を広げる(狭めない)
alter table public.monsuc_finishes drop constraint if exists monsuc_finishes_shape;
alter table public.monsuc_finishes add constraint monsuc_finishes_shape check (
  run_id ~ '^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$' and owner_id ~ '^[A-Za-z0-9_-]{1,64}$' and left(run_id, length(owner_id) + 1) = owner_id || '-'
  and species ~ '^[A-Za-z]{2,32}$' and lineage ~ '^[A-Za-z_]{1,32}$'
  and length(user_name) <= 40 and length(child_name) <= 24
  and octet_length(dye::text) <= 2000 and octet_length(stats::text) <= 400 and octet_length(techs::text) <= 6000);
alter table public.monsuc_finishes drop constraint if exists monsuc_finishes_counts;
alter table public.monsuc_finishes add constraint monsuc_finishes_counts check (
  lv between 1 and 99 and loyal between 0 and 100 and pop between 0 and 100
  and power between 0 and 60000 and grade ~ '^(G|F|E|D|C|B|A|S|SS|SSS|M)[0-9]{1,3}$' and engine_version between 1 and 1000);

-- ② 新しい式(端末のモンサクの総合力と同じ): 6能力の合計×2.5 + 技ごとに ランクの値 × 間合い適性の補正 + Lv×15 + 忠誠×10 + 人気×10(熟練は入れない)
create or replace function public.monsuc_rank_power2(p_stats jsonb, p_techs jsonb, p_lv int, p_loyal int, p_pop int)
returns integer language sql immutable set search_path = public as $$
  select round(
      coalesce((select sum(least(greatest(coalesce((p_stats->>k)::numeric, 0), 0), 999)) from unnest(array['life','pow','wise','hit','eva','tough']) k), 0) * 2.5
    + coalesce((select sum((array[40, 80, 160, 320, 640])[least(greatest((e->>'r')::int, 1), 5)]
                         * (1 + (coalesce(array_position(array['G','F','E','D','C','B','A','S','S+','SS','SS+','M'], e->>'a'), 5) - 5) * 0.1))
                from (select value as e from jsonb_array_elements(p_techs) limit 99) t where jsonb_typeof(e) = 'object'), 0)
    + least(greatest(p_lv, 1), 99) * 15 + least(greatest(p_loyal, 0), 100) * 10 + least(greatest(p_pop, 0), 100) * 10)::int
$$;

-- ③ 1件を入れる(②を使い、技の形と数を広げる。ほかは今までと同じ)
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
  if v_stats is null or jsonb_typeof(v_stats) <> 'object' or jsonb_typeof(v_techs) <> 'array' or jsonb_array_length(v_techs) > 99 then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  foreach v_k in array array['life','pow','wise','hit','eva','tough'] loop
    if jsonb_typeof(v_stats->v_k) <> 'number' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
    v_n := (v_stats->>v_k)::numeric;
    if v_n <> trunc(v_n) or v_n < 0 or v_n > 999 then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
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
  v_power := case when exists (select 1 from jsonb_array_elements(v_techs) e where jsonb_typeof(e) = 'object')
                  then public.monsuc_rank_power2(v_stats, v_techs, v_lv, v_loy, v_pop)
                  else public.monsuc_rank_power(v_stats, v_techs, v_lv, v_loy, v_pop) end;
  if v_sum > 5994 or v_power > 60000 then return jsonb_build_object('ok', false, 'reason', 'over_cap'); end if;
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

-- ④ ②は登録の関数の中からだけ使う(外からは呼べない)
revoke all on function public.monsuc_rank_power2(jsonb, jsonb, int, int, int) from public, anon, authenticated;
