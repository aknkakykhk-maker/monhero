// 助手とおしゃべり(2026-10-14)の中継役。Supabase Edge Function(Deno)。
// ゲームは API キーを持たない。ここが Secrets の ANTHROPIC_API_KEY で Claude を呼ぶ。
// 中身は serve.js(Deno で動く部分)と core.js(検査から偽物の Claude で動かせる部分)。
// ここは npm の部品を渡して start() を呼ぶだけ。配るときは serve.js を読む行を GitHub の固定の版の URL に替えた数行を送る
// (node tools/ctx.js redeploy assistant-chat が作る。docs/rules/EDGE_REDEPLOY.md)
// 公開の設定: verify_jwt を外す(ゲームが送る publishable key は JWT ではないため)。手順は docs/spec/ASSISTANT_CHAT.md
// ★会話の本文はログに書かない
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { start } from "./serve.js";

start({ Anthropic, createClient });
