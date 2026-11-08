// 助手のマスモン(一覧・編成・好きな血統/苦手な血統)に、まだ実装されていないモンスターが混ざらないかを見る。
//   node tools/assistant/assistant-masmon-plan-check.js
// 2026-11-08 社長「まだ実装されてないベースモンが入ってる。」→ 実装済み(ALL_PLAYER_MONSTERS)からだけ選ぶ(台帳)。
// 見るもの: 案 docs/progress/assistant-peer/masmon-plan.json と、ゲームに入れたあとの ASSISTANT_MASMON_PLAN(monster-hero/data か src/parts にあれば)
//   ① モンスターは ALL_PLAYER_MONSTERS の id だけ(UPCOMING_MONSTER_DRAFTS の案は入れない)
//   ② 血統は MONSTER_LINEAGE_MAP の main で、実装済みのモンスターがいる血統だけ
//   ③ 8人それぞれ3体・先頭(lead)は1体・ニックネームは空でなく8文字まで・「子」と書かない
//   ④ 好きな血統3つ・苦手な血統3つ。持っているマスモンの血統は好きに入る/苦手と好きは重ならない/苦手な血統のマスモンは持たない
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
  const bad = [], teamNg = [], likeNg = [], laterNg = [];
  for (const a of data) {
    const team = a.team || [];
    for (const m of team) if (!IMPL.has(m.monster)) bad.push(`${a.id}:${m.monster}${upBlock.includes(`${m.monster}:`) ? '(まだ案のモンスター)' : ''}`);
    for (const l of [...(a.like || []), ...(a.dislike || [])]) if (!IMPL_LINEAGES.has(l.lineage)) bad.push(`${a.id}:血統 ${l.lineage}`);
    if (team.length !== 3 || team.filter(m => m.lead).length !== 1) teamNg.push(`${a.id}(${team.length}体・先頭${team.filter(m => m.lead).length})`);
    for (const m of team) if (!m.nick || m.nick.length > 8 || /子/.test(m.nick) || team.filter(x => x.nick === m.nick).length > 1) teamNg.push(`${a.id}:${m.nick || '名前なし'}`);
    const like = new Set((a.like || []).map(l => l.lineage)), dis = new Set((a.dislike || []).map(l => l.lineage));
    if (like.size !== 3 || dis.size !== 3) likeNg.push(`${a.id}(好き${like.size}・苦手${dis.size})`);
    for (const l of like) if (dis.has(l)) likeNg.push(`${a.id}:${l} が好きと苦手の両方`);
    for (const m of team) { const ln = MAP.get(m.monster); if (!like.has(ln)) likeNg.push(`${a.id}:${m.nick}(${ln})が好きな血統に無い`); if (dis.has(ln)) likeNg.push(`${a.id}:${m.nick}(${ln})が苦手な血統`); }
    if (a.later && [...IMPL.values()].includes(a.later.monster)) laterNg.push(`${a.id}:${a.later.monster} はもう実装済み(一覧に入れ直す)`);
  }
  check(`${T}① ② まだ実装されていないモンスター・血統が混ざっていない`, !bad.length, bad.join(' / '));
  check(`${T}③ 3体・先頭1体・ニックネーム`, !teamNg.length, teamNg.join(' / '));
  check(`${T}④ 好きな血統3・苦手な血統3が持っているマスモンと合っている`, !likeNg.length, likeNg.join(' / '));
  check(`${T}⑤ 「あとで加わる」は、まだ実装されていないモンスターだけ`, !laterNg.length, laterNg.join(' / '));
}
console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
