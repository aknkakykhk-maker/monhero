-- モンヒロサクセス 総合力ランキング: 流したあとの確かめ(読むだけ・何も書かない)
select count(*) as finishes from public.monsuc_finishes;                 -- はじめは 0
select * from public.monsuc_rank_all limit 1;                             -- 空で通る
select * from public.monsuc_rank_lineage limit 1;                         -- 空で通る
select public.monsuc_rank_power('{"life":100,"pow":100,"wise":100,"hit":100,"eva":100,"tough":100}'::jsonb, '[50,0]'::jsonb, 10, 50, 20) as power_2600; -- 1500+250+150+500+200 = 2600
select public.monsuc_rank_grade(14000) as s, public.monsuc_rank_grade(7999) as c;  -- 'S' / 'C'
select has_function_privilege('anon', 'public.monsuc_rank_submit(text, text, jsonb)', 'execute') as anon_can_submit,  -- true
       has_table_privilege('anon', 'public.monsuc_finishes', 'select') as anon_reads_table;                             -- false
