#!/usr/bin/env node
// API 総点検③の「画面の文」の点検(読むだけ)。更新履歴(2026-11-15 以降)とヘルプ全文を Opus に読ませる。
//   node text-check.js <corpus置き場> <出力置き場> [--send] [--fetch]
// corpus置き場には recent-changelog.json と help.json(game の data/*.js から取り出した物)を置く。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const gw = require(path.join(ROOT, 'tools/analysis/gateway-client'));
const [CORP, OUT] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const has = (n) => process.argv.includes(n);
fs.mkdirSync(OUT, { recursive: true });
const SYSTEM = `あなたはスマホ向けブラウザゲーム「モンスターヒーロー」の「画面の文」を点検する校正係です。更新履歴とヘルプ(遊ぶ人が読む文)を渡します。次の観点で、直すべき所だけを挙げてください。好みの話・わざとの言い回しは挙げません。
観点:
1 用語: 下の用語表に反する言い方。モンスターを「子」と呼ぶ(「育てた子」「あの子」。キャラクターの台詞の中は除く)/ 使わない言い方に当たる言葉 / 「札」を画面の文・ヘルプで使う / 音ゲーの正式名は「モンヒロビート」(略称「モンビー」はキャラクターの会話だけ)/ 「イベントP」は「ビートP」/ 「購入曲・解放曲」は「有料の曲・持っている曲」/ 助手を「コーチ」と呼ぶ / 「けんか」は「喧嘩」
2 漢字・表記: 誤字・脱字・変換ミス・「、」「。」の抜け・全角半角のゆれ・敬語のゆれ
3 言葉の揺れ: 同じ物を文ごとに違う名前で呼ぶ(例: マスモン/マスターモン/育成済みモンスター)
4 ネタバレ: まだ出ていない敵・段階・イベントの中身、敵のライフや攻撃力の数字
5 内部の仕組み: 作業報告の言い方(「◯◯本追加」「全60場面」「今回はここまで」「さきほど見送っていた」)、内部の数え方・コード名・ファイル名・保存キー(mh_ で始まる名)・変数名・「PR」「コミット」「API」「Supabase」「フラグ」などの開発用語が遊ぶ人向けの文に出ている
6 助手の呼び方: 助手がプレイヤーを「ブリーダー」「ブリーダーさん」と直に呼ぶ書き方(役目・物の名前の「ブリーダーLv」「ブリーダーP」「ほかのブリーダー」などはそのまま)
7 作り手の都合: タイトルが数を誇るだけ・何が良くなったか分からない・同じ日の同じ出来事が分かれている
用語表(抜き): モンヒロサクセス(略称モンサクはキャラクターの会話だけ)/ ベースモン / マスモン / 合体円盤石 / サクセスモン / 円盤石 / 保存枠 / 編成 / 助手 / 合体 / 総合力・ランク / 親密度 / 助手マスモン / 種類 / 血統 / 仲良し度 / おなじみ度 / モンヒロビート / ビートP / 助手とのセッション / 相棒 / ビートランク / 難易度・譜面・版。
出力は JSON の配列だけ(前置き・コードフェンスなし): [{"where":"どの項目か(日時+題名 / ヘルプのカテゴリ・題名)","quote":"問題の文の該当部分(40字以内)","kind":"用語|漢字|揺れ|ネタバレ|内部の仕組み|助手の呼び方|作り手の都合","fix":"直し案(40字以内)","priority":"高|中|低","owner_hint":"更新履歴|ヘルプ"}]。優先度: 高=遊ぶ人に誤解や不快を与える(ネタバレ・内部の数字・用語違反の見出し)/ 中=読みにくい・揺れ / 低=念のため。1回の頼みで最大 40 件。無ければ []。`;
const reqs = [];
const mk = (id, area, text) => reqs.push({ custom_id: id, area, request: { system: SYSTEM, cache_system: true, messages: [{ role: 'user', content: [{ type: 'text', text }] }], max_tokens: 12000, effort: 'medium' } });
const cl = JSON.parse(fs.readFileSync(path.join(CORP, 'recent-changelog.json'), 'utf8'));
const clText = cl.map((e) => `■${e.date} [${e.type || ''}] ${e.title}\n${(e.items || []).map((x) => `・${x}`).join('\n')}`);
const half = Math.ceil(clText.length / 2);
mk('t001', '更新履歴', `更新履歴(2026-11-15 以降・前半 ${half}件)\n\n${clText.slice(0, half).join('\n\n')}`);
mk('t002', '更新履歴', `更新履歴(2026-11-15 以降・後半 ${clText.length - half}件)\n\n${clText.slice(half).join('\n\n')}`);
const help = JSON.parse(fs.readFileSync(path.join(CORP, 'help.json'), 'utf8'));
let n = 3, buf = '', bufName = [];
const flush = () => { if (buf) { mk(`t${String(n++).padStart(3, '0')}`, 'ヘルプ', `ヘルプ(${bufName.join('・')})\n\n${buf}`); buf = ''; bufName = []; } };
for (const c of help) for (const t of c.topics) {
  const piece = `■[${c.title || c.id}] ${t.text}\n\n`;
  if (buf.length + piece.length > 60000) flush();
  buf += piece; if (!bufName.includes(c.title || c.id)) bufName.push(c.title || c.id);
}
flush();
const parseJson = (text) => {
  const t = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { const j = JSON.parse(t); if (Array.isArray(j)) return j; } catch (e) { /* 途中で切れた返事は下で拾う */ }
  const s = t.indexOf('[');
  for (let k = t.lastIndexOf('}'); s >= 0 && k > s; k = t.lastIndexOf('}', k - 1)) { try { const j = JSON.parse(t.slice(s, k + 1) + ']'); if (Array.isArray(j)) return j; } catch (e) { /* 次の候補へ */ } }
  return null;
};
(async () => {
  if ((has('--send') || has('--fetch')) && gw.ensureProxyEnv()) return;
  if (has('--fetch')) {
    const b = JSON.parse(fs.readFileSync(path.join(OUT, 'batch.json'), 'utf8')); const results = []; let usd = 0, waiting = 0;
    for (const x of b.batches) {
      const r = await gw.send({ action: 'batch_get', batch_id: x.batch_id });
      if (!r.json?.ok) { console.log('受け取れない', JSON.stringify(r.json).slice(0, 200)); process.exit(1); }
      if (!r.json.results) { waiting++; continue; }
      results.push(...r.json.results); usd += Number(r.json.usd) || 0;
    }
    if (waiting) { console.log(`まだ ${waiting}本`); process.exit(3); }
    const man = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')); const all = [], bad = [];
    for (const r of results) {
      const list = r.type === 'succeeded' ? parseJson(r.text) : null;
      if (!list) { bad.push(`${r.custom_id}(${r.type}・${r.stop_reason || ''})`); continue; }
      const g = man.requests.find((q) => q.custom_id === r.custom_id) || {};
      list.forEach((f) => all.push({ group: r.custom_id, area: g.area, ...f }));
    }
    fs.writeFileSync(path.join(OUT, 'text-findings.json'), JSON.stringify({ usd: Math.round(usd * 10000) / 10000, findings: all, unreadable: bad }, null, 1));
    const c = (p) => all.filter((f) => f.priority === p).length;
    console.log(`件数 ${all.length}(高 ${c('高')}・中 ${c('中')}・低 ${c('低')})/ $${usd.toFixed(4)} / 読めない ${bad.join(',') || 'なし'}`);
    return;
  }
  let usd = 0;
  for (const q of reqs) { const e = await gw.estimate(q.request, { batch: true }); if (!e.ok) { console.log(q.custom_id, e.error); process.exit(1); } q.usd_est = e.usd_est; usd += e.usd_est; }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), usd_est: Math.round(usd * 100) / 100, requests: reqs.map(({ request, ...r }) => r) }, null, 1));
  console.log(`頼み ${reqs.length}本(更新履歴 ${cl.length}件・ヘルプ ${help.reduce((a, c) => a + c.topics.length, 0)}題)/ 多めの見積り $${usd.toFixed(2)}`);
  if (!has('--send')) return;
  if (usd > 10) { console.log('$10 超え。送らない'); process.exit(2); }
  const sent = [];
  for (let i = 0; i < reqs.length; i += 4) {
    const part = reqs.slice(i, i + 4);
    const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: `text-${part[0].custom_id}`, requests: part.map((q) => ({ custom_id: q.custom_id, request: q.request })) });
    if (!r.json?.ok) { console.log('断られた', JSON.stringify(r.json).slice(0, 300)); break; }
    sent.push({ batch_id: r.json.batch_id, custom_ids: part.map((q) => q.custom_id) });
    fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ batches: sent }, null, 1));
  }
  console.log(`バッチ ${sent.length}本 頼んだ`);
})().catch((e) => { console.error(e.message); process.exit(1); });
