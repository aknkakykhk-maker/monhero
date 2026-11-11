// 助手のマスモンのフレンド対戦(非同期PvP)のサーバの関数の本体(Deno で動く部分)。index.ts から start() を呼ぶ(2026-11-11 タイセン)。
// 配り方は assistant-chat と同じ(docs/rules/EDGE_REDEPLOY.md): 配る index.ts は「GitHub の固定の版の serve.js を読む」数行だけ。
// core.js・engine.js はこのファイルからの相対の import なので、同じ版から一緒に読まれる(node tools/ctx.js redeploy masmon-pvp)。
// ・npm の部品(Supabase のクライアント)は index.ts から渡してもらう。型の注釈は書かない(.js のまま raw から読ませる)
// 表と関数: supabase/migrations/202611110001_masmon_pvp.sql。設計: docs/spec/MASMON_PVP_SERVER.md
// ★記録に書くのは件数・エラーの種類だけ
import { CHALLENGE_DAILY_LIMIT, PAIR_RATED_DAILY_LIMIT, handle } from "./core.js";
import { ASSISTANT_MASMON_BATTLE as engine, MASMON_PVP_CATALOG as catalog, MASMON_PVP_LEARN as learn } from "./engine.js";

export function start({ createClient }) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const DEFAULT_ALLOWED_ORIGINS = ["https://aknkakykhk-maker.github.io"];
  const allowedOrigins = (Deno.env.get("MASMON_PVP_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
  const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, content-type, authorization, x-client-info",
    "Vary": "Origin",
  });
  const envInt = (name, fallback) => {
    const n = Number(Deno.env.get(name));
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  // 止めたいときは MASMON_PVP_CHALLENGE_DAILY_LIMIT=0(挑めなくなる。登録と読むのはそのまま)
  const limits = {
    challengeDaily: envInt("MASMON_PVP_CHALLENGE_DAILY_LIMIT", CHALLENGE_DAILY_LIMIT),
    pairRated: envInt("MASMON_PVP_PAIR_RATED_DAILY_LIMIT", PAIR_RATED_DAILY_LIMIT),
    // 能力の差の効き方(A|B|C)。社長が観戦して決めたら、ここ(または core.js の BALANCE)で替える
    balance: Deno.env.get("MASMON_PVP_BALANCE") ?? undefined,
  };

  const must = (r, step) => {
    if (r.error) throw new Error(`db:${step}`);
    return r.data;
  };
  const db = {
    ownerCheck: async (owner, key) =>
      must(await supabase.rpc("masmon_pvp_owner_check", { p_owner: owner, p_key: key }), "ownerCheck"),
    getEntry: async (owner, assistant) =>
      must(await supabase.from("masmon_pvp_entries").select("*").eq("owner_id", owner).eq("assistant_id", assistant).maybeSingle(), "getEntry"),
    getAnchors: async (owner, assistant, keys) => {
      if (!keys.length) return {};
      const rows = must(await supabase.from("masmon_pvp_anchors").select("unit_key, first_day, first_stats, first_total, first_lv")
        .eq("owner_id", owner).eq("assistant_id", assistant).in("unit_key", keys), "getAnchors") ?? [];
      return Object.fromEntries(rows.map((r) => [r.unit_key, r]));
    },
    // 初めの値は一度だけ(もう入っていれば変えない)
    insertAnchors: async (rows) => {
      must(await supabase.from("masmon_pvp_anchors").upsert(rows, { onConflict: "owner_id,assistant_id,unit_key", ignoreDuplicates: true }), "insertAnchors");
    },
    upsertEntry: async (row) => {
      const cur = must(await supabase.from("masmon_pvp_entries").select("version").eq("owner_id", row.owner_id).eq("assistant_id", row.assistant_id).maybeSingle(), "entryVersion");
      const version = cur ? Math.min(1000000, Number(cur.version) + 1) : 1;
      must(await supabase.from("masmon_pvp_entries").upsert({ ...row, version, active: true, updated_at: new Date().toISOString() },
        { onConflict: "owner_id,assistant_id" }), "upsertEntry");
    },
    deactivate: async (owner, assistant) => {
      must(await supabase.from("masmon_pvp_entries").update({ active: false, updated_at: new Date().toISOString() })
        .eq("owner_id", owner).eq("assistant_id", assistant), "deactivate");
    },
    // 承認済みのフレンドどうしか(friend_links は1組1行。どちらが申請したかは問わない)
    areFriends: async (a, b) => {
      const rows = must(await supabase.from("friend_links").select("status")
        .or(`and(requester_id.eq.${a},target_id.eq.${b}),and(requester_id.eq.${b},target_id.eq.${a})`), "areFriends") ?? [];
      return rows.some((r) => r.status === "accepted");
    },
    take: async (owner, limit) => must(await supabase.rpc("masmon_pvp_take", { p_owner: owner, p_limit: limit }), "take"),
    refund: async (owner) => { must(await supabase.rpc("masmon_pvp_refund", { p_owner: owner }), "refund"); },
    record: async (args) => must(await supabase.rpc("masmon_pvp_record", args), "record"),
  };

  // 種はサーバが作る(端末からは受け取らない)
  const newSeed = () => {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return "mp" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  };
  const log = (entry) => console.log(JSON.stringify({ fn: "masmon-pvp", ...entry }));

  Deno.serve(async (req) => {
    const origin = req.headers.get("origin");
    const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
    if (!origin || !origins.includes(origin)) return new Response(JSON.stringify({ ok: false, error: "origin" }), { status: 403, headers });
    let body = null;
    try { body = await req.json(); } catch { /* 下で bad_request */ }
    const result = await handle({ body, db, engine, catalog, learn, nowMs: Date.now(), newSeed, log, limits });
    return new Response(JSON.stringify(result.json), { status: result.status, headers });
  });
}
