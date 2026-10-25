// MFバトルカード: 助手の手を Claude Haiku 5.5 に選ばせる試し(2026-10-25)。Supabase Edge Function(Deno)。本番のゲームからは呼ばない。
// 中身は core.js(試合を回す道具 tools/card/card-ai-trial.js --fake から、偽物の Claude で動かせるように分けてある)。
// Secrets: ANTHROPIC_API_KEY(SDK が読む)/ CARD_AI_TRIAL_TOKEN(合言葉。x-trial-token と同じときだけ動く。無ければ全部断る)
//          CARD_AI_TRIAL_TIMEOUT_MS(任意。既定 8000・最大 20000)
// 公開の設定: verify_jwt を外す(合言葉で守る。道具は Supabase の鍵を持たない)
// ★合言葉・鍵・場面の本文はログに書かない
import Anthropic from "npm:@anthropic-ai/sdk";
import { handleRequest, TIMEOUT_MS, TIMEOUT_MS_MAX } from "./core.js";

// 待ち時間は1手ごとに core.js が渡す。やり直しはしない(遅れたら今のAIの手に置きかえる)
const anthropic = new Anthropic({ maxRetries: 0 });

const n = Number(Deno.env.get("CARD_AI_TRIAL_TIMEOUT_MS"));
const timeoutMs = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), TIMEOUT_MS_MAX) : TIMEOUT_MS;

Deno.serve(async (req: Request) => {
  const bodyText = req.method === "POST" ? await req.text() : "";
  const out = await handleRequest(
    { method: req.method, token: req.headers.get("x-trial-token") ?? "", bodyText },
    { client: anthropic, expectedToken: Deno.env.get("CARD_AI_TRIAL_TOKEN") ?? "", timeoutMs },
  );
  if (out.status !== 200) console.log(`card-ai-trial: ${out.status} ${out.body.error}`);
  else console.log(`card-ai-trial: ok fallback=${out.body.fallback} why=${out.body.why} ms=${out.body.ms} in=${out.body.usage.input} out=${out.body.usage.output} cache=${out.body.usage.cacheRead}`);
  return new Response(JSON.stringify(out.body), {
    status: out.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});
