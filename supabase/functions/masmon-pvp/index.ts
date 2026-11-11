// 助手のマスモンのフレンド対戦(非同期PvP・第④段階)の入口(2026-11-11 タイセン)。Supabase Edge Function(Deno)。
// 本体は serve.js(Deno で動く部分)・core.js(検査から偽物の表で動かせる部分)・engine.js(計算と技データの写し。
// tools/masmon-battle/build-masmon-pvp-bundle.js が作る。手で直さない)。
// ここは npm の部品を渡して start() を呼ぶだけ。配るときは serve.js を読む行を GitHub の固定の版の URL に替えた数行を送る
// (node tools/ctx.js redeploy masmon-pvp が作る。docs/rules/EDGE_REDEPLOY.md)
// 公開の設定: verify_jwt を外す(ゲームが送る publishable key は JWT ではないため。assistant-chat と同じ)
import { createClient } from "npm:@supabase/supabase-js@2";
import { start } from "./serve.js";

start({ createClient });
