// 分析の入り口(r1119-014 PR1)。Supabase Edge Function(Deno)。中身は core.js(検査から偽物で動かせるように分けてある)。
// 呼ぶのは開発の道具だけ(tools/analysis/gateway-client.js)。ゲームからは呼ばない。CORS も開けない。
// 公開の設定: verify_jwt を外す(合言葉 x-analysis-token で守る)。
// ★API キーは Secrets の ANTHROPIC_API_KEY を SDK が読む(助手のおしゃべりと同じキー。新しいキーは作らない)。
// ★合言葉は Secrets の ANALYSIS_GATEWAY_TOKEN(値は窓口が入れる)。無い・16文字未満なら、全部を断る(503)。
// 上限は Secrets の ANALYSIS_DAY_USD(既定 25)・ANALYSIS_CALL_USD(既定 20)で変えられる。0 にすると全部を断る。
// 記録は表 analysis_gateway_usage(supabase/migrations/202611190001_analysis_gateway.sql)。ほかの表には触らない。
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_LIMITS, handle } from "./core.js";

const anthropic = new Anthropic({ maxRetries: 1, timeout: 140_000 });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ fn: "analysis-gateway", ...entry }));
const envNumber = (name: string, fallback: number) => {
  const raw = Deno.env.get(name);
  const v = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

const db = {
  reserve: async (a: { day: string; kind: string; label: string | null; mode: string; usdEst: number; dayCap: number }) => {
    const { data, error } = await supabase.rpc("analysis_gateway_reserve", {
      p_day: a.day, p_kind: a.kind, p_label: a.label, p_mode: a.mode, p_usd_est: a.usdEst, p_day_cap: a.dayCap,
    });
    if (error) throw new Error("reserve");
    return data;
  },
  attachBatch: async (id: number, batchId: string) => {
    const { error } = await supabase.rpc("analysis_gateway_attach_batch", { p_id: id, p_batch_id: batchId });
    if (error) throw new Error("attach");
  },
  finish: async (id: number, f: { status: string; usdActual: number; usage: unknown; model: string | null }) => {
    const { data, error } = await supabase.rpc("analysis_gateway_finish", {
      p_id: id, p_status: f.status, p_usd_actual: f.usdActual, p_usage: f.usage, p_model: f.model,
    });
    if (error) throw new Error("finish");
    return data === true;
  },
  findBatch: async (batchId: string) => {
    const { data, error } = await supabase.from("analysis_gateway_usage")
      .select("id,status,usd_actual").eq("batch_id", batchId).maybeSingle();
    if (error) throw new Error("find");
    return data;
  },
  dayUsed: async (day: string) => {
    const { data, error } = await supabase.rpc("analysis_gateway_day_used", { p_day: day });
    if (error) throw new Error("used");
    return Number(data) || 0;
  },
};

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json" };
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  try {
    const result = await handle({
      token: req.headers.get("x-analysis-token") ?? "",
      expectedToken: Deno.env.get("ANALYSIS_GATEWAY_TOKEN") ?? "",
      body,
      limits: {
        dayUsd: envNumber("ANALYSIS_DAY_USD", DEFAULT_LIMITS.dayUsd),
        callUsd: envNumber("ANALYSIS_CALL_USD", DEFAULT_LIMITS.callUsd),
      },
      client: anthropic,
      db,
      log,
    });
    return new Response(JSON.stringify(result.json), { status: result.status, headers });
  } catch {
    // 記録の表へ書けなかったとき。上限を数えられないので、Claude は呼んでいない(reserve の前)か、呼んだ額が残っていない
    log({ event: "error", reason: "db" });
    return new Response(JSON.stringify({ ok: false, error: "db" }), { status: 500, headers });
  }
});
