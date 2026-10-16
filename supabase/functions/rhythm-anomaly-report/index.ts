// 判定の異変を毎日報告する(2026-10-16 社長の決定)の入口。Supabase Edge Function(Deno)。
// 毎晩 3:10 JST に pg_cron(rhythm-anomaly-report)が pg_net で呼ぶ。手で呼ぶときは ?day=YYYY-MM-DD。
// 中身は core.js(検査から偽物の Claude・偽物の DB で動かせるように分けてある)。
// 公開の設定: verify_jwt を外す(合言葉 x-cron-token を DB の rhythm_anomaly_token_ok で照らすため)
// ★API キーは Secrets の ANTHROPIC_API_KEY を SDK が読む。合言葉の値はこの関数も知らない(DB の Vault にだけある)
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { runReport } from "./core.js";

const anthropic = new Anthropic({ maxRetries: 1, timeout: 60_000 });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ fn: "rhythm-anomaly-report", ...entry }));

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json" };
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  const url = new URL(req.url);
  try {
    const result = await runReport({
      token: req.headers.get("x-cron-token") ?? "",
      day: url.searchParams.get("day"),
      tokenOk: async (token: string) => {
        const { data, error } = await supabase.rpc("rhythm_anomaly_token_ok", { p_token: token });
        if (error) throw new Error("token");
        return data === true;
      },
      loadFacts: async (day: string) => {
        const { data, error } = await supabase.rpc("rhythm_anomaly_facts", { p_day: day });
        if (error) throw new Error("facts");
        return data;
      },
      save: async (row: Record<string, unknown>) => {
        const { error } = await supabase.from("rhythm_anomaly_reports").upsert(row, { onConflict: "report_date" });
        if (error) throw new Error("save");
      },
      client: anthropic,
      log,
    });
    return new Response(JSON.stringify(result.json), { status: result.status, headers });
  } catch {
    // 表へ書けなかったとき(save)。報告は残らないので、ログで分かるようにする
    log({ event: "error", reason: "save" });
    return new Response(JSON.stringify({ ok: false, error: "save" }), { status: 500, headers });
  }
});
