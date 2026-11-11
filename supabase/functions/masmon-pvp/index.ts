// 助手のマスモンのフレンド対戦(非同期PvP・第④段階)の入口(2026-11-11 タイセン)。Supabase Edge Function(Deno)。
// 中身は core.js(検査から偽物の表で動かせるように分けてある)。計算の本体と技データは engine.js
// (tools/masmon-battle/build-masmon-pvp-bundle.js が monster-hero/data/assistant-masmon-battle.js から作る写し。手で直さない)。
// 公開の設定: verify_jwt を外す(ゲームが送る publishable key は JWT ではないため。assistant-chat と同じ)。
// 表と関数: supabase/migrations/202611110001_masmon_pvp.sql。手順: docs/spec/MASMON_PVP_SERVER.md
// ★記録に書くのは件数・エラーの種類だけ
import { createClient } from "npm:@supabase/supabase-js@2";
import { CHALLENGE_DAILY_LIMIT, PAIR_RATED_DAILY_LIMIT, handle } from "./core.js";
import { ASSISTANT_MASMON_BATTLE as engine, MASMON_PVP_CATALOG as catalog } from "./engine.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const DEFAULT_ALLOWED_ORIGINS = ["https://aknkakykhk-maker.github.io"];
const allowedOrigins = (Deno.env.get("MASMON_PVP_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization, x-client-info",
  "Vary": "Origin",
});
const envInt = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};
// 止めたいときは MASMON_PVP_CHALLENGE_DAILY_LIMIT=0(挑めなくなる。登録と読むのはそのまま)
const limits = {
  challengeDaily: envInt("MASMON_PVP_CHALLENGE_DAILY_LIMIT", CHALLENGE_DAILY_LIMIT),
  pairRated: envInt("MASMON_PVP_PAIR_RATED_DAILY_LIMIT", PAIR_RATED_DAILY_LIMIT),
};

const must = <T>(r: { data: T; error: unknown }, step: string): T => {
  if (r.error) throw new Error(`db:${step}`);
  return r.data;
};
const db = {
  ownerCheck: async (owner: string, key: string) =>
    must(await supabase.rpc("masmon_pvp_owner_check", { p_owner: owner, p_key: key }), "ownerCheck"),
  getEntry: async (owner: string, assistant: string) =>
    must(await supabase.from("masmon_pvp_entries").select("*").eq("owner_id", owner).eq("assistant_id", assistant).maybeSingle(), "getEntry"),
  getAnchors: async (owner: string, assistant: string, keys: string[]) => {
    if (!keys.length) return {};
    const rows = must(await supabase.from("masmon_pvp_anchors").select("unit_key, first_day, first_stats, first_total, first_lv")
      .eq("owner_id", owner).eq("assistant_id", assistant).in("unit_key", keys), "getAnchors") ?? [];
    return Object.fromEntries(rows.map((r: { unit_key: string }) => [r.unit_key, r]));
  },
  // 初めの値は一度だけ(もう入っていれば変えない)
  insertAnchors: async (rows: Record<string, unknown>[]) => {
    must(await supabase.from("masmon_pvp_anchors").upsert(rows, { onConflict: "owner_id,assistant_id,unit_key", ignoreDuplicates: true }), "insertAnchors");
  },
  upsertEntry: async (row: Record<string, unknown>) => {
    const cur = must(await supabase.from("masmon_pvp_entries").select("version").eq("owner_id", row.owner_id).eq("assistant_id", row.assistant_id).maybeSingle(), "entryVersion");
    const version = cur ? Math.min(1000000, Number(cur.version) + 1) : 1;
    must(await supabase.from("masmon_pvp_entries").upsert({ ...row, version, active: true, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,assistant_id" }), "upsertEntry");
  },
  deactivate: async (owner: string, assistant: string) => {
    must(await supabase.from("masmon_pvp_entries").update({ active: false, updated_at: new Date().toISOString() })
      .eq("owner_id", owner).eq("assistant_id", assistant), "deactivate");
  },
  // 承認済みのフレンドどうしか(friend_links は1組1行。どちらが申請したかは問わない)
  areFriends: async (a: string, b: string) => {
    const rows = must(await supabase.from("friend_links").select("status")
      .or(`and(requester_id.eq.${a},target_id.eq.${b}),and(requester_id.eq.${b},target_id.eq.${a})`), "areFriends") ?? [];
    return rows.some((r: { status: string }) => r.status === "accepted");
  },
  take: async (owner: string, limit: number) => must(await supabase.rpc("masmon_pvp_take", { p_owner: owner, p_limit: limit }), "take"),
  refund: async (owner: string) => { must(await supabase.rpc("masmon_pvp_refund", { p_owner: owner }), "refund"); },
  record: async (args: Record<string, unknown>) => must(await supabase.rpc("masmon_pvp_record", args), "record"),
};

// 種はサーバが作る(端末からは受け取らない)
const newSeed = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return "mp" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ fn: "masmon-pvp", ...entry }));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  if (!origin || !origins.includes(origin)) return new Response(JSON.stringify({ ok: false, error: "origin" }), { status: 403, headers });
  let body: unknown = null;
  try { body = await req.json(); } catch { /* 下で bad_request */ }
  const result = await handle({ body, db, engine, catalog, nowMs: Date.now(), newSeed, log, limits });
  return new Response(JSON.stringify(result.json), { status: result.status, headers });
});
