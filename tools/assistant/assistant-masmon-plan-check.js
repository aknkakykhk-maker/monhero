// 助手のマスモン(一覧・編成・好きな血統/苦手な血統)に、まだ実装されていないモンスターが混ざらないかを見る。
//   node tools/assistant/assistant-masmon-plan-check.js
// 2026-11-08 社長「まだ実装されてないベースモンが入ってる。」→ 実装済み(ALL_PLAYER_MONSTERS)からだけ選ぶ(台帳)。
// 見るもの: 案 docs/progress/assistant-peer/masmon-plan.json と、ゲームに入れたあとの ASSISTANT_MASMON_PLAN(monster-hero/data か src/parts にあれば)
//   ① モンスターは ALL_PLAYER_MONSTERS の id だけ(UPCOMING_MONSTER_DRAFTS の案は入れない)
//   ② 血統は MONSTER_LINEAGE_MAP の main で、実装済みのモンスターがいる血統だけ
//   ③ 8人それぞれ3体・先頭(lead)は1体・ニックネームは空でなく8文字まで・「子」と書かない
//   ④ 好き・苦手はモンスター単位で3つずつ(社長「剣士モッチーが好きならモッチー種も好き」→ その血統にも少し広がる)。
//      好きと苦手の血統は重ならない/苦手なモンスター・その血統のマスモンは持たない
//   ⑥ 成長と染色: Lv は 1〜100/染色はプレイヤーと同じ仕組み・同じ枠数(MASU_COLOR_REGION_HUES の部位数。書いていない種類は全身1枠)。
//      どの種類も染められる(「染めない種類」は作らない)。色はゲームの色の名前(MASU_COLOR_TARGET の名前と _light)
//   ⑦ 助手どうしで好き・苦手がかぶりすぎない(同じモンスター・血統は2人まで)・好きな色はゲームの色の名前
//   ⑤ 「あとで加わる」(later)は、まだ実装されていないモンスターだけ(実装されたら一覧に入れ直す合図)
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const ally = fs.readFileSync(path.join(root, 'monster-hero/data/ally-monsters.js'), 'utf8');
const block = (src, head) => { const a = src.indexOf(head); if (a < 0) return ''; const b = src.indexOf('\n};', a); return src.slice(a, b < 0 ? undefined : b); };
const allBlock = block(ally, 'const ALL_PLAYER_MONSTERS');
const IMPL = new Map([...allBlock.matchAll(/^\s{2}(\w+):\s*(?:Object\.freeze\()?\{[^\n]*?name:\s*["']([^"']+)/gm)].map(m => [m[1], m[2]]));
const upBlock = block(ally, 'const UPCOMING_MONSTER_DRAFTS');
const lin = fs.readFileSync(path.join(root, 'monster-hero/data/lineages.js'), 'utf8');
const MAP = new Map([...block(lin, 'const MONSTER_LINEAGE_MAP').matchAll(/^\s*(\w+):\s*\{\s*main:'(\w+)'/gm)].map(m => [m[1], m[2]]));
const IMPL_LINEAGES = new Set([...IMPL.keys()].map(id => MAP.get(id)).filter(Boolean));
check('① 実装済みのモンスターの一覧が読める', IMPL.size >= 20 && IMPL_LINEAGES.size >= 10, `${IMPL.size}体・${IMPL_LINEAGES.size}血統`);
// 絵のファイル名(染色のマスクを探す)。images-ally.js の imgUrl の定数から
const imgs = fs.readFileSync(path.join(root, 'monster-hero/data/images/images-ally.js'), 'utf8');
const IMGFILE = Object.fromEntries([...IMPL.keys()].map(id => { const m = allBlock.match(new RegExp(`^\\s{2}${id}:[^\\n]*?imgUrl:\\s*(\\w+)`, 'm')); const c = m && imgs.match(new RegExp(`const ${m[1]} = "images/monsters/([^."?]+)`)); return [id, c ? c[1].toLowerCase() : null]; }));
// プレイヤーの染色の枠数(MASU_COLOR_REGION_HUES の配列の長さ。書いていない種類は全身1枠)と、色の名前
const dyeSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/15-dye-and-art.jsx'), 'utf8');
// 表の式をそのまま読む(中で使っている BOXES などの定数は空の値にして数だけ取る)。後から足している種類は REGION_HUES の代入も読む
const IDS_NAMES = new Set(['みゅあ', 'きき', 'ももすけ', 'ドラ', 'あつ', 'きゅうこ', 'ソラシド', 'えるびん']);
const REGIONS = (() => {
  const a0 = dyeSrc.indexOf('const MASU_COLOR_REGION_HUES = {');
  const expr = dyeSrc.slice(a0 + 'const MASU_COLOR_REGION_HUES = '.length, dyeSrc.indexOf('\n};', a0) + 2);
  const scope = new Proxy({}, { has: (t, k) => k !== 'Math' && k !== 'Object' && k !== 'Array', get: (t, k) => (k === Symbol.unscopables ? undefined : []) });
  const obj = Function('scope', `with (scope) { return (${expr}); }`)(scope);
  const out = {}; for (const [k, v] of Object.entries(obj)) out[k] = Array.isArray(v) ? v.length : 0;
  for (const m of dyeSrc.matchAll(/MASU_COLOR_REGION_HUES\.(\w+)\s*=\s*MASU_COLOR_REGION_HUES\.(\w+)/g)) out[m[1]] = out[m[2]];
  // あとから足した枠(MASU_COLOR_REGION_HUES.Pandora = [ {…}, … ];)も数える
  for (const m of dyeSrc.matchAll(/MASU_COLOR_REGION_HUES\.(\w+)\s*=\s*\[([\s\S]*?)\n\];/g)) out[m[1]] = (m[2].match(/\{/g) || []).length;
  return out;
})();
const COLOR_IDS = new Set((() => { const a0 = dyeSrc.indexOf('const MASU_COLOR_TARGET = {'); const keys = [...dyeSrc.slice(a0, dyeSrc.indexOf('\n};', a0)).matchAll(/^  (\w+):/gm)].map(m => m[1]); return [...keys, ...keys.filter(k => !['black', 'white', 'gray'].includes(k)).map(k => `${k}_light`)]; })());
check('⑥ プレイヤーの染色の枠数が読める', Object.keys(REGIONS).length >= 20 && REGIONS.KenshiMocchi === 5 && REGIONS.Mocchi === 3, `${Object.keys(REGIONS).length}種・色${COLOR_IDS.size}`);
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const sources = [];
const planPath = path.join(root, 'docs/progress/assistant-peer/masmon-plan.json');
if (fs.existsSync(planPath)) sources.push({ name: '案 masmon-plan.json', data: JSON.parse(fs.readFileSync(planPath, 'utf8')).assistants });
// ゲームに入れたあと: どこかに const ASSISTANT_MASMON_PLAN = [...] (JSON と同じ形)があれば、それも見る
for (const dir of ['monster-hero/data', 'monster-hero/src/parts']) for (const f of fs.readdirSync(path.join(root, dir)).filter(f => /\.(js|jsx)$/.test(f))) {
  const src = fs.readFileSync(path.join(root, dir, f), 'utf8');
  const i = src.indexOf('const ASSISTANT_MASMON_PLAN = ');
  if (i < 0) continue;
  try { const expr = src.slice(i + 'const ASSISTANT_MASMON_PLAN = '.length, src.indexOf('\n];', i) + 2).replace(/Object\.freeze\(/g, '('); sources.push({ name: `${dir}/${f}`, data: Function(`return ${expr}`)() }); }
  catch (e) { check(`${dir}/${f} の ASSISTANT_MASMON_PLAN が読める`, false, String(e.message)); }
}
for (const { name, data } of sources) {
  const T = `[${name}] `;
  check(`${T}8人ぶんある`, IDS.every(id => data.some(a => a.id === id)), data.map(a => a.id).join(','));
  const bad = [], teamNg = [], likeNg = [], laterNg = [], dyeNg = [];
  const likeCount = {}, disCount = {};
  for (const a of data) {
    const team = a.team || [];
    const extra = Array.isArray(a.extra) ? a.extra : []; // 控え(2026-11-08 社長「空いてる枠にほかのますもんもふやす」)。今の3体 team は変えずに足す
    const all = [...team, ...extra];
    for (const m of all) if (!IMPL.has(m.monster)) bad.push(`${a.id}:${m.monster}${upBlock.includes(`${m.monster}:`) ? '(まだ案のモンスター)' : ''}`);
    for (const l of [...(a.like || []), ...(a.dislike || [])]) if (!IMPL_LINEAGES.has(l.lineage)) bad.push(`${a.id}:血統 ${l.lineage}`);
    if (team.length !== 3 || team.filter(m => m.lead).length !== 1) teamNg.push(`${a.id}(${team.length}体・先頭${team.filter(m => m.lead).length})`);
    if (extra.length > 3 || extra.some(m => m.lead)) teamNg.push(`${a.id}(控え${extra.length}体。3体まで・先頭にしない)`);
    if (new Set(all.map(m => m.monster)).size !== all.length) teamNg.push(`${a.id}: 同じモンスターが2体`);
    for (const m of all) if (!m.nick || m.nick.length > 8 || /子/.test(m.nick) || all.filter(x => x.nick === m.nick).length > 1 || IDS_NAMES.has(m.nick)) teamNg.push(`${a.id}:${m.nick || '名前なし'}`);
    // 好き・苦手: モンスター単位か血統ごと(社長「ユグドラシル種」「アーク種」など)。モンスターの好き・苦手はその血統にも少し広がる
    const likeMon = (a.likeMon || []).filter(x => x.monster).map(x => x.monster), disMon = (a.dislikeMon || []).filter(x => x.monster).map(x => x.monster);
    const likeLin = (a.likeMon || []).filter(x => x.lineage).map(x => x.lineage), disLin = (a.dislikeMon || []).filter(x => x.lineage).map(x => x.lineage);
    for (const id of [...likeMon, ...disMon]) if (!IMPL.has(id)) bad.push(`${a.id}:好き/苦手 ${id}${upBlock.includes(`${id}:`) ? '(まだ案のモンスター)' : ''}`);
    for (const l of [...likeLin, ...disLin]) if (!IMPL_LINEAGES.has(l)) bad.push(`${a.id}:好き/苦手の血統 ${l}`);
    const like = new Set([...likeMon.map(id => MAP.get(id)), ...likeLin]), dis = new Set([...disMon.map(id => MAP.get(id)), ...disLin]);
    const nl = (a.likeMon || []).length, nd = (a.dislikeMon || []).length;
    if (nl < 1 || nl > 4 || nd > 4) likeNg.push(`${a.id}(好き${nl}・苦手${nd}。好きは1〜4・苦手は0〜4)`);
    for (const l of like) if (dis.has(l)) likeNg.push(`${a.id}:血統 ${l} が好きと苦手の両方に広がる`);
    for (const m of all) { const ln = MAP.get(m.monster); if (disMon.includes(m.monster) || dis.has(ln)) likeNg.push(`${a.id}:${m.nick}(${m.monster})が苦手なモンスター・血統`); }
    const lead = (team.find(m => m.lead) || {}).monster;
    if (!likeMon.includes(lead) && !likeLin.includes(MAP.get(lead))) likeNg.push(`${a.id}:先頭のマスモンが好きなモンスター・血統に入っていない`);
    for (const c of (a.favColors || [])) if (!COLOR_IDS.has(c.color)) likeNg.push(`${a.id}:好きな色「${c.color}」はゲームの色の名前にない`);
    for (const x of (a.likeMon || [])) { const k = x.monster || `種:${x.lineage}`; (likeCount[k] = likeCount[k] || []).push(a.id); }
    for (const x of (a.dislikeMon || [])) { const k = x.monster || `種:${x.lineage}`; (disCount[k] = disCount[k] || []).push(a.id); }
    // 成長と染色
    for (const m of all) {
      if (!Number.isFinite(m.lv) || m.lv < 1 || m.lv > 100) dyeNg.push(`${a.id}:${m.nick} の Lv`);
      const want = REGIONS[m.monster] || 1;
      const cols = m.dye && Array.isArray(m.dye.colors) ? m.dye.colors : null;
      if (!cols) dyeNg.push(`${a.id}:${m.nick} が染まっていない(どの種類も染められる)`);
      else {
        if (cols.length !== want) dyeNg.push(`${a.id}:${m.nick}(${m.monster})の色は ${cols.length}枠・プレイヤーは ${want}枠`);
        for (const c of cols) if (!COLOR_IDS.has(c)) dyeNg.push(`${a.id}:${m.nick} の色「${c}」はゲームの色の名前にない`);
      }
    }
    if (a.later && [...IMPL.values()].includes(a.later.monster)) laterNg.push(`${a.id}:${a.later.monster} はもう実装済み(一覧に入れ直す)`);
  }
  check(`${T}① ② まだ実装されていないモンスター・血統が混ざっていない`, !bad.length, bad.join(' / '));
  check(`${T}③ 3体・先頭1体・控え3体まで・同じモンスターなし・ニックネーム(助手の名前と同じにしない)`, !teamNg.length, teamNg.join(' / '));
  check(`${T}④ 好き(1〜4)・苦手(0〜4)・広がる血統が重ならない・苦手なものは持たない・好きな色`, !likeNg.length, likeNg.join(' / '));
  check(`${T}⑥ 成長(Lv)と染色(プレイヤーと同じ枠数・ゲームの色)`, !dyeNg.length, dyeNg.join(' / '));
  // ⑦ 助手どうしで好き・苦手がかぶりすぎない(同じモンスター・血統を好き/苦手に入れる助手は2人まで。社長「かぶりすぎない」)
  const over = [...Object.entries(likeCount).filter(([, v]) => v.length > 2).map(([k, v]) => `好き ${k}: ${v.join('・')}`), ...Object.entries(disCount).filter(([, v]) => v.length > 2).map(([k, v]) => `苦手 ${k}: ${v.join('・')}`)];
  check(`${T}⑦ 好き・苦手が助手どうしでかぶりすぎない(同じものは2人まで)`, !over.length, over.join(' / '));
  check(`${T}⑤ 「あとで加わる」は、まだ実装されていないモンスターだけ`, !laterNg.length, laterNg.join(' / '));
}
console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
