// MFバトルカード大会: 試合を回すサーバの上の関数(2026-10-30 ルールくん)。Supabase Edge Function(Deno)。
// 呼ぶのは決まった時刻の仕組み(pg_cron。docs/sql/card-tournament/CARD_TOURNAMENT_SCHEDULE.sql)だけ。日本時間 0:30 に回し、1:30・2:30 にやり直す。
// 中身は core.js(検査から偽物の表と偽物の Claude で動かせるように分けてある)。ルール本体は game.js(tools/build-card-tournament-bundle.js が作る写し)。
// 公開の設定: verify_jwt を外す(合言葉で確かめる)。合言葉は vault の card_tournament_secret を card_tournament_secret_ok で比べる
// 実況・解説は Secrets の ANTHROPIC_API_KEY(助手のおしゃべりと同じキー)。回数は card_assistant_talk_take で数える
// ★実況・解説の本文はログに書かない
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { runAll } from "./core.js";
import * as game from "./game.js";

const anthropic = new Anthropic({ maxRetries: 0, timeout: 15_000 });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const must = <T>(r: { data: T; error: unknown }, step: string): T => {
  if (r.error) throw new Error(`db:${step}`);
  return r.data;
};
const db = {
  listActive: async () => must(await supabase.from("card_tournaments").select("*").neq("status", "done").order("open_on"), "listActive") ?? [],
  getTour: async (id: string) => must(await supabase.from("card_tournaments").select("*").eq("id", id).single(), "getTour"),
  listEntries: async (id: string) => must(await supabase.from("card_tournament_entries").select("*").eq("tournament_id", id), "listEntries") ?? [],
  decksOf: async (owners: string[]) => {
    if (!owners.length) return {};
    const rows = must(await supabase.from("card_deck_entries").select("owner_id, deck, tactics, version, user_name, icon, profile_frame")
      .in("owner_id", owners).eq("active", true), "decksOf") ?? [];
    return Object.fromEntries(rows.map((r: { owner_id: string }) => [r.owner_id, r]));
  },
  updateEntry: async (id: string, seat: string, patch: Record<string, unknown>) => {
    must(await supabase.from("card_tournament_entries").update(patch).eq("tournament_id", id).eq("seat_id", seat), "updateEntry");
  },
  insertEntry: async (id: string, seat: string, patch: Record<string, unknown>) => {
    must(await supabase.from("card_tournament_entries").upsert({ tournament_id: id, seat_id: seat, ...patch }, { onConflict: "tournament_id,seat_id" }), "insertEntry");
  },
  insertMatches: async (id: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    const body = rows.map((m) => ({
      tournament_id: id, stage: m.stage, grp: m.group, day: m.day, a_seat: m.a, b_seat: m.b,
      seed: m.seed, first: m.first, play_on: m.play_on, visible_at: m.visible_at,
    }));
    // 同じ試合はもう入っていれば足さない(やり直しで二重にしない)
    must(await supabase.from("card_tournament_matches").upsert(body, { onConflict: "tournament_id,stage,grp,a_seat,b_seat", ignoreDuplicates: true }), "insertMatches");
  },
  listMatches: async (id: string) => must(await supabase.from("card_tournament_matches")
    .select("id, stage, grp, day, a_seat, b_seat, seed, first, play_on, winner, kos").eq("tournament_id", id), "listMatches") ?? [],
  updateMatch: async (mid: number, patch: Record<string, unknown>) => {
    // 回し終えた試合は書き換えない
    must(await supabase.from("card_tournament_matches").update(patch).eq("id", mid).is("winner", null), "updateMatch");
  },
  updateTour: async (id: string, patch: Record<string, unknown>) => {
    must(await supabase.from("card_tournaments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id), "updateTour");
  },
  insertRewards: async (id: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    const body = rows.map((r) => ({ tournament_id: id, owner_id: r.owner_id, place: r.place, point: r.point }));
    must(await supabase.from("card_tournament_rewards").upsert(body, { onConflict: "tournament_id,owner_id", ignoreDuplicates: true }), "insertRewards");
  },
};

const ai = (q: { model: string; max_tokens: number; system: string; messages: { role: "user"; content: string }[]; timeout: number }) =>
  anthropic.messages.create({ model: q.model, max_tokens: q.max_tokens, system: q.system, messages: q.messages }, { timeout: q.timeout });
const take = async (breederId: string, bucket: string, userLimit: number, totalLimit: number) => {
  const { data, error } = await supabase.rpc("card_assistant_talk_take", {
    p_breeder: breederId, p_bucket: bucket, p_user_limit: userLimit, p_total_limit: totalLimit,
  });
  if (error) throw new Error("take");
  return data;
};
const refund = async (breederId: string, bucket: string) => {
  const { error } = await supabase.rpc("card_assistant_talk_refund", { p_breeder: breederId, p_bucket: bucket });
  if (error) throw new Error("refund");
};
// 本文を含まない記録だけ
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ fn: "card-tournament-run", ...entry }));

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json" };
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  const secret = req.headers.get("x-tour-secret") ?? "";
  const { data: okSecret, error } = await supabase.rpc("card_tournament_secret_ok", { p_secret: secret });
  if (error || okSecret !== true) return new Response(JSON.stringify({ ok: false, error: "secret" }), { status: 403, headers });
  const out = await runAll({ db, game, nowMs: Date.now(), ai, take, refund, log });
  log({ step: "run", ...out });
  return new Response(JSON.stringify({ ok: true, ...out }), { status: 200, headers });
});
