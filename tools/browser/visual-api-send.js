#!/usr/bin/env node
// 見た目の点検(r1119-014 PR3): 撮った止め絵を、分析の入り口(Supabase の Edge Function)経由で Claude API に見てもらう「送る口」。
//
//   node tools/browser/visual-api-send.js <結果のフォルダ>                 送る前の量と費用の見込みだけ出す(送らない)
//   node tools/browser/visual-api-send.js <結果のフォルダ> --flagged        機械が何か見つけた止め絵だけにする
//   node tools/browser/visual-api-send.js <結果のフォルダ> --write-payload  送る中身を <結果>/api-payload/ に書く(送らない)
//   VISUAL_API_URL=... VISUAL_API_PASS=... node tools/browser/visual-api-send.js <結果のフォルダ> --send
//                                                                         入り口へ送り、返ってきた問題の表を <結果>/api-findings.json に置く
//
// 【費用の見込み】(claude-opus-5-5・2026-11 の API 価格: 入力 $4 / 出力 $20(100万トークンあたり)・Batch は半額)
//   画像1枚のトークン ≒ 幅×高さ÷750(長辺は 2576px まで)。止め絵は縮めて送る(長辺 MAX_EDGE px)
//   1回に送る絵の枚数 PER_REQ 枚ごとに、指示文(約 PROMPT_TOK)を付ける。出力は1枚あたり約 OUT_PER_IMAGE を見込む
//   1回 $20 を超える見込みなら送らない(入り口も 1回 $20・1日 $25 で止める。窓口へ知らせる)
//
// 【入り口】別の会話(開発部)が作る Edge Function を使う。仕様が決まるまでは --send は「VISUAL_API_URL が無い」で止まる。
//   送る形(案): POST { kind: 'visual', model, batch, items: [{ id, scene, size, w, h, media_type, data(base64) , machine: [機械の見つけ物] }], prompt }
//   ヘッダ: x-analysis-pass: <合言葉>。返り: { findings: [{ id, kind, priority, detail }], usage: { input_tokens, output_tokens }, cost_usd }
//   合言葉・キーはリポジトリにも止め絵にも書かない(環境変数だけ)。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const dir = argv.find((a) => !a.startsWith('--'));
if (!dir || !fs.existsSync(path.join(dir, 'results.json'))) { console.log('使い方: node tools/browser/visual-api-send.js <visual-shoot.js の結果のフォルダ> [--flagged] [--write-payload] [--send]'); process.exit(1); }
let sharp;
try { sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp')); } catch (e) { sharp = null; }

const MODEL = 'claude-opus-5-5';
const PRICE = { in: 4, out: 20 }; // 100万トークンあたりのドル
const MAX_EDGE = 1280, PER_REQ = 8, PROMPT_TOK = 900, OUT_PER_IMAGE = 250;
const LIMIT_RUN = 20;
const BATCH = !has('--no-batch'); // 急がないので既定は Batch(半額)

const PROMPT = [
  'あなたはスマホ向けブラウザゲーム「モンスターヒーロー」の画面の見た目を点検する係です。',
  '渡す止め絵それぞれについて、プレイヤーが困る見た目の問題だけを挙げてください: 字の切れ・はみ出し、字と字・字と絵の重なり、読みにくい色、',
  '押しにくい・見つけにくいボタン、画面の端で切れた部品、空白が大きすぎる・詰まりすぎ、縦横で崩れた並び、文の誤字・不自然な日本語。',
  'デザインの好みや、意図した飾り(わざと重ねたバッジなど)は挙げない。各止め絵には機械の見つけ物(machine)を付けるので、本物か空振りかも判定する。',
  '出力は JSON の配列だけ: [{"id": 止め絵のid, "kind": 起きること(短く), "priority": "高"|"中"|"低", "detail": どこで何が(1文), "machine_verdict": "本物"|"空振り"|null}]。',
].join('\n');

(async () => {
  const res = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
  const sizeOf = Object.fromEntries(res.sizes.map((z) => [z.tag, z]));
  const byShot = new Map();
  for (const f of res.findings) if (f.shot) (byShot.get(f.shot) || byShot.set(f.shot, []).get(f.shot)).push({ kind: f.kind, detail: f.detail });
  const shots = [];
  for (const sc of res.scenes) {
    for (const z of res.sizes) {
      const rel = path.join('shots', z.tag, `${sc.id}.png`);
      if (!fs.existsSync(path.join(dir, rel))) continue;
      if (has('--flagged') && !byShot.has(rel)) continue;
      const k = Math.min(1, MAX_EDGE / Math.max(z.w, z.h));
      const w = Math.round(z.w * k), h = Math.round(z.h * k);
      shots.push({ id: `${sc.id}@${z.tag}`, scene: sc.name, size: z.tag, rel, w, h, tok: Math.ceil((w * h) / 750), machine: byShot.get(rel) || [] });
    }
  }
  const reqs = Math.ceil(shots.length / PER_REQ);
  const inTok = shots.reduce((n, s) => n + s.tok + 40 + s.machine.length * 40, 0) + reqs * PROMPT_TOK;
  const outTok = shots.length * OUT_PER_IMAGE;
  const full = (inTok * PRICE.in + outTok * PRICE.out) / 1e6;
  const cost = BATCH ? full / 2 : full;
  console.log(`送る止め絵 ${shots.length}枚(${reqs}回に分ける・1回 ${PER_REQ}枚)/ 入力 約${Math.round(inTok / 1000)}千・出力 約${Math.round(outTok / 1000)}千トークン`);
  console.log(`費用の見込み(${MODEL}${BATCH ? '・Batch で半額' : ''}): 約 $${cost.toFixed(2)}(Batch なしなら $${full.toFixed(2)})/ 1回の上限 $${LIMIT_RUN}`);
  const bySize = res.sizes.map((z) => `${z.tag} ${shots.filter((s) => s.size === z.tag).length}枚×約${shots.find((s) => s.size === z.tag)?.tok || 0}トークン`).join(' / ');
  console.log(`  内訳: ${bySize}`);
  fs.writeFileSync(path.join(dir, 'api-estimate.json'), JSON.stringify({ model: MODEL, batch: BATCH, images: shots.length, requests: reqs, inputTokens: inTok, outputTokens: outTok, costUsd: Math.round(cost * 100) / 100, costUsdNoBatch: Math.round(full * 100) / 100 }, null, 2));
  if (cost > LIMIT_RUN) { console.log(`見込みが1回の上限 $${LIMIT_RUN} を超えるので送らない(--flagged で絞るか、窓口へ)`); process.exit(2); }
  if (!has('--write-payload') && !has('--send')) return;
  if (!sharp) { console.log('sharp が無いので絵を縮められない(cd tools && npm ci)'); process.exit(1); }
  const payloadDir = path.join(dir, 'api-payload');
  fs.mkdirSync(payloadDir, { recursive: true });
  const bodies = [];
  for (let i = 0; i < shots.length; i += PER_REQ) {
    const items = [];
    for (const s of shots.slice(i, i + PER_REQ)) {
      const buf = await sharp(path.join(dir, s.rel)).resize(s.w, s.h, { fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer();
      items.push({ id: s.id, scene: s.scene, size: s.size, w: s.w, h: s.h, media_type: 'image/png', data: buf.toString('base64'), machine: s.machine });
    }
    const body = { kind: 'visual', model: MODEL, batch: BATCH, prompt: PROMPT, items };
    bodies.push(body);
    fs.writeFileSync(path.join(payloadDir, `req-${String(i / PER_REQ + 1).padStart(3, '0')}.json`), JSON.stringify(body));
  }
  console.log(`送る中身を ${path.relative(ROOT, payloadDir)} に書いた(${bodies.length}本)`);
  if (!has('--send')) return;
  const url = process.env.VISUAL_API_URL, pass = process.env.VISUAL_API_PASS;
  if (!url || !pass) { console.log('VISUAL_API_URL / VISUAL_API_PASS が無いので送らない(入り口ができたら窓口から知らせが来る)'); process.exit(1); }
  const all = [];
  let spent = 0;
  for (const [n, body] of bodies.entries()) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-analysis-pass': pass }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.log(`  ${n + 1}本目で断られた: ${r.status} ${JSON.stringify(j).slice(0, 200)}(上限なら窓口へ)`); break; }
    spent += Number(j.cost_usd) || 0;
    (j.findings || []).forEach((f) => all.push({ ...f, by: 'API' }));
    console.log(`  ${n + 1}/${bodies.length} 本目 OK(見つけ物 ${(j.findings || []).length}件・ここまで $${spent.toFixed(2)})`);
  }
  fs.writeFileSync(path.join(dir, 'api-findings.json'), JSON.stringify({ model: MODEL, spentUsd: spent, findings: all }, null, 2));
  console.log(`API の見つけ物 ${all.length}件 → ${path.relative(ROOT, path.join(dir, 'api-findings.json'))}`);
})();
