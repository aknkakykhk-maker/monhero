// 助手とおしゃべり(2026-10-14)の中継役。Supabase Edge Function(Deno)。
// ゲームは API キーを持たない。ここが Secrets の ANTHROPIC_API_KEY で Claude を呼ぶ。
// 中身は core.js(検査から偽物の Claude で動かせるように分けてある)。
// 公開の設定: verify_jwt を外す(ゲームが送る publishable key は JWT ではないため)。手順は docs/spec/ASSISTANT_CHAT.md
// ★会話の本文はログに書かない
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DEFAULT_ALLOWED_ORIGINS,
  handleRequest,
  loadDigest,
  TOTAL_DAILY_LIMIT,
  USER_DAILY_LIMIT,
} from "./core.js";

// キーは環境変数から SDK が読む(ANTHROPIC_API_KEY)
const anthropic = new Anthropic({ maxRetries: 1, timeout: 20_000 });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const envInt = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const limits = {
  user: envInt("ASSISTANT_CHAT_USER_DAILY_LIMIT", USER_DAILY_LIMIT),
  total: envInt("ASSISTANT_CHAT_TOTAL_DAILY_LIMIT", TOTAL_DAILY_LIMIT),
};
const allowedOrigins = (Deno.env.get("ASSISTANT_CHAT_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization, x-client-info",
  "Vary": "Origin",
});

const take = async (breederId: string, userLimit: number, totalLimit: number) => {
  const { data, error } = await supabase.rpc("assistant_chat_take", {
    p_breeder: breederId, p_user_limit: userLimit, p_total_limit: totalLimit,
  });
  if (error) throw new Error("take");
  return data;
};
const refund = async (breederId: string) => {
  const { error } = await supabase.rpc("assistant_chat_refund", { p_breeder: breederId });
  if (error) throw new Error("refund");
};
// 本文を含まない記録だけ
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ fn: "assistant-chat", ...entry }));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  if (!origin || !origins.includes(origin)) {
    return new Response(JSON.stringify({ ok: false, error: "origin" }), { status: 403, headers });
  }
  let body: unknown = null;
  try { body = await req.json(); } catch { /* 下で bad_request */ }
  const digest = await loadDigest(fetch);
  if (!digest) {
    log({ event: "digest_unavailable" });
    return new Response(JSON.stringify({ ok: true, kind: "sorry", reply: "ごめん、今うまく話せないや", expression: "troubled" }), { status: 200, headers });
  }
  // kind:'daily_lines' はふだんの吹き出しを1日1回まとめて作る頼み。それ以外はおしゃべり(core.js の handleRequest が分ける)
  const result = await handleRequest({ body, digest, client: anthropic, take, refund, log, limits });
  return new Response(JSON.stringify(result.json), { status: result.status, headers });
});
