// ミッション: 助手の1日1行の案内(2026-11-08 社長 ③A)の中継役。Supabase Edge Function(Deno)。
// ゲームは API キーを持たない。ここが Secrets の ANTHROPIC_API_KEY(助手とおしゃべりと同じキー)で Claude を呼ぶ。
// 中身は core.js(検査から偽物の Claude と偽物の表で動かせるように分けてある)。書き方は card-assistant-talk/index.ts にそろえた。
// Claude を呼ぶのは1日のはじめの1回だけ(全員で同じ文を読む)。表 mission_daily_lines と関数は supabase/migrations/202611080002_mission_daily_lines.sql
// 公開の設定: verify_jwt を外す(ゲームが送る publishable key は JWT ではないため)
// ★文の本文はログに書かない
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DAY_TRIES, DEFAULT_ALLOWED_ORIGINS, handleRequest, RETRY_SECONDS } from "./core.js";

// 待ち時間はゲームより短くする。遅れたらゲームは決まった台詞のまま(次の人が10分あとに呼び直す)
const anthropic = new Anthropic({ maxRetries: 0, timeout: 7_000 });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);
const allowedOrigins = (Deno.env.get("MISSION_LINE_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization, x-client-info",
  "Vary": "Origin",
});
const claim = async () => {
  const { data, error } = await supabase.rpc("mission_daily_line_claim", { p_max_tries: DAY_TRIES, p_retry_seconds: RETRY_SECONDS });
  if (error) throw new Error("claim");
  return data;
};
const put = async (day: string, lines: Record<string, string>, ok: boolean) => {
  const { error } = await supabase.rpc("mission_daily_line_put", { p_day: day, p_lines: lines, p_ok: ok });
  if (error) throw new Error("put");
};
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ fn: "mission-daily-line", ...entry }));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  if (!origin || !origins.includes(origin)) {
    return new Response(JSON.stringify({ ok: false, error: "origin" }), { status: 403, headers });
  }
  const result = await handleRequest({ claim, put, client: anthropic, log });
  return new Response(JSON.stringify(result.json), { status: result.status, headers });
});
