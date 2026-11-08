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
  PEER_USER_LIMIT,
  PEER_TOTAL_LIMIT,
  USER_DAILY_LIMIT,
  FRIEND_TOTAL_LIMIT,
  MASMON_NAME_TOTAL_LIMIT,
  MASMON_NAME_USER_LIMIT,
} from "./core.js";
import { RANKING_FUNCTIONS, RANKING_TABLES } from "./ranking.js";

// キーは環境変数から SDK が読む(ANTHROPIC_API_KEY)
const anthropic = new Anthropic({ maxRetries: 1, timeout: 20_000 });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// ランキングを読む入れ物(2026-10-21)。ゲームと同じ公開の鍵(anon)で読むので、ランキング画面で見えるものしか読めない。
// 読むだけ(select と、読むための既存の関数)。表・関数の名前は ranking.js の一覧にあるものだけ
const rankingClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  { auth: { persistSession: false } },
);
type RankingOpts = { select: string; filters?: [string, string, unknown][]; order?: [string, boolean][]; limit?: number; count?: boolean };
// deno-lint-ignore no-explicit-any
const applyRankingQuery = (q: any, opts: RankingOpts) => {
  for (const [col, op, val] of opts.filters || []) {
    q = op === "eq" ? q.eq(col, val) : op === "in" ? q.in(col, val as unknown[]) : op === "gt" ? q.gt(col, val) : q;
  }
  for (const [col, asc] of opts.order || []) q = q.order(col, { ascending: asc, nullsFirst: false });
  return opts.limit ? q.limit(opts.limit) : q;
};
// 公開の鍵が無い環境では読まない(ランキングの話題でも、ランキング無しでふつうに答える)
const rankingDb = !Deno.env.get("SUPABASE_ANON_KEY") ? null : {
  async select(table: string, opts: RankingOpts) {
    if (!RANKING_TABLES.includes(table)) throw new Error("table");
    const { data, error, count } = await applyRankingQuery(rankingClient.from(table).select(opts.select, opts.count ? { count: "exact" } : undefined), opts);
    if (error) throw new Error("select");
    return { rows: data || [], count };
  },
  async rpc(fn: string, args: Record<string, unknown>, opts: RankingOpts) {
    if (!RANKING_FUNCTIONS.includes(fn)) throw new Error("function");
    const { data, error, count } = await applyRankingQuery(rankingClient.rpc(fn, args, opts.count ? { count: "exact" } : undefined).select(opts.select), opts);
    if (error) throw new Error("rpc");
    return { rows: data || [], count };
  },
};

// 0 を「止める」として受け取る版(未設定・壊れた値は既定値)
const envIntOrZero = (name: string, fallback: number) => {
  const raw = Deno.env.get(name);
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};
const envInt = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const limits = {
  user: envInt("ASSISTANT_CHAT_USER_DAILY_LIMIT", USER_DAILY_LIMIT),
  total: envInt("ASSISTANT_CHAT_TOTAL_DAILY_LIMIT", TOTAL_DAILY_LIMIT),
  // 助手どうしの掛け合い(kind:'peer_talks'・2026-11-07)。おしゃべりとは別の表で数える
  peerUser: envInt("ASSISTANT_PEER_TALK_USER_DAILY_LIMIT", PEER_USER_LIMIT),
  peerTotal: envInt("ASSISTANT_PEER_TALK_TOTAL_DAILY_LIMIT", PEER_TOTAL_LIMIT),
  // 助手ライフのフレンドの家の場面(kind:'friend_scenes'・2026-11-08)。おしゃべりと同じ表・全員の上限を分け合い、そのうえで専用の上限。0 で止まる
  friendTotal: envIntOrZero("ASSISTANT_FRIEND_DAILY_LIMIT", FRIEND_TOTAL_LIMIT),
  // 助手のマスモンの名前(kind:'masmon_names'・2026-11-08)。別の表で数える。全員の上限は 0 で止まる
  masmonUser: envInt("ASSISTANT_MASMON_NAME_USER_DAILY_LIMIT", MASMON_NAME_USER_LIMIT),
  masmonTotal: envIntOrZero("ASSISTANT_MASMON_NAME_TOTAL_DAILY_LIMIT", MASMON_NAME_TOTAL_LIMIT),
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
const takePeer = async (breederId: string, userLimit: number, totalLimit: number) => {
  const { data, error } = await supabase.rpc("assistant_peer_talk_take", {
    p_breeder: breederId, p_user_limit: userLimit, p_total_limit: totalLimit,
  });
  if (error) throw new Error("take");
  return data;
};
const refundPeer = async (breederId: string) => {
  const { error } = await supabase.rpc("assistant_peer_talk_refund", { p_breeder: breederId });
  if (error) throw new Error("refund");
};
// 助手のマスモンの名前の回数(supabase/migrations/202611080002_assistant_masmon_name_usage.sql)
const takeMasmon = async (breederId: string, userLimit: number, totalLimit: number) => {
  const { data, error } = await supabase.rpc("assistant_masmon_name_take", { p_breeder: breederId, p_user_limit: userLimit, p_total_limit: totalLimit });
  if (error) throw new Error("take");
  return data;
};
const refundMasmon = async (breederId: string) => {
  const { error } = await supabase.rpc("assistant_masmon_name_refund", { p_breeder: breederId });
  if (error) throw new Error("refund");
};
// friend_scenes の今日の回数(おしゃべりと同じ表の 'friend:' の行の合計。日の区切りは表と同じ朝4時)
const friendUsed = async () => {
  const d = new Date(Date.now() + 9 * 3600000 - 4 * 3600000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("assistant_chat_usage").select("count").eq("day", d).like("breeder_id", "friend:%");
  if (error) throw new Error("friend_used");
  return (data || []).reduce((t: number, r: { count: number }) => t + (Number(r.count) || 0), 0);
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
  const result = await handleRequest({ body, digest, client: anthropic, take, refund, takePeer, refundPeer, takeMasmon, refundMasmon, log, limits, rankingDb, friendUsed });
  return new Response(JSON.stringify(result.json), { status: result.status, headers });
});
