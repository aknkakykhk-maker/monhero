-- MFバトルカード大会: サーバの上の関数 card-tournament-run を、決まった時刻に呼ぶ仕組み(2026-10-30 ルールくん)
-- 流すのは統括部長。CARD_TOURNAMENT_APPLY.sql と、サーバの上の関数を置いたあとに流す。何度流しても同じになる
--   ・合言葉: サーバの中で作って vault に入れる(だれも見ない・どこにも書かない)。関数は card_tournament_secret_ok で確かめる
--   ・時刻: 日本時間の 0:30 に回し、失敗したときのために 1:30・2:30 にも呼ぶ(何度呼ばれても同じになる作り)。結果は 4:00 から見せる
--     pg_cron は世界時(UTC)で書く: 0:30 JST = 15:30 UTC(前の日)

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
select cron.schedule('card-tournament-run', '30 15,16,17 * * *', $job$
  select net.http_post(
    url := 'https://zrzevudkbgtxlbvmuziy.supabase.co/functions/v1/card-tournament-run',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-tour-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'card_tournament_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000)
$job$);
