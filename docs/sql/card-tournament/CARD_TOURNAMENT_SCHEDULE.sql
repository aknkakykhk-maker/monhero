-- MFバトルカード大会: サーバの上の関数 card-tournament-run を、決まった時刻に呼ぶ仕組み(2026-10-30 ルールくん)
-- 流すのは統括部長。CARD_TOURNAMENT_APPLY.sql と、サーバの上の関数を置いたあとに流す。何度流しても同じになる
--   ・合言葉: サーバの中で作って vault に入れる(だれも見ない・どこにも書かない)。関数は card_tournament_secret_ok で確かめる
--   ・時刻: 1日中10分おきに呼ぶ(何度呼ばれても同じになる作り)。公式杯は日本時間の 0:00 からその日の試合を回し、結果は 4:00 から見せる。
--     個人杯のオート杯は、発表の2時間前から回す(2026-10-31 に、日本時間 0:00〜3:50 だけから1日中へ変えた)
--     サーバの関数は1回に CPU を2秒までしか使えないので、1回に回す試合は 1.2秒ぶんまで。残りは次の呼び出しで回す(2026-10-30 に 0:30・1:30・2:30 の3回から変えた)

-- 合言葉(無いときだけ作る)
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'card_tournament_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'card_tournament_secret', 'MFバトルカード大会: card-tournament-run を呼ぶ合言葉');
  end if;
end $$;

-- 呼ぶ仕組み(同じ名前があれば作り直す)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'card-tournament-run') then perform cron.unschedule('card-tournament-run'); end if;
end $$;
select cron.schedule('card-tournament-run', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://zrzevudkbgtxlbvmuziy.supabase.co/functions/v1/card-tournament-run',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-tour-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'card_tournament_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000)
$job$);
