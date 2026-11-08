// 助手のマスモン(一覧・編成・好きな血統/苦手な血統)に、まだ実装されていないモンスターが混ざらないかを見る。
//   node tools/assistant/assistant-masmon-plan-check.js
// 2026-11-08 社長「まだ実装されてないベースモンが入ってる。」→ 実装済み(ALL_PLAYER_MONSTERS)からだけ選ぶ(台帳)。
// 見るもの: 案 docs/progress/assistant-peer/masmon-plan.json と、ゲームに入れたあとの ASSISTANT_MASMON_PLAN(monster-hero/data か src/parts にあれば)
//   ① モンスターは ALL_PLAYER_MONSTERS の id だけ(UPCOMING_MONSTER_DRAFTS の案は入れない)
//   ② 血統は MONSTER_LINEAGE_MAP の main で、実装済みのモンスターがいる血統だけ
//   ③ 8人それぞれ3体・先頭(lead)は1体・ニックネームは空でなく8文字まで・「子」と書かない
//   ④ 好き・苦手はモンスター単位で3つずつ(社長「剣士モッチーが好きならモッチー種も好き」→ その血統にも少し広がる)。
//      好きと苦手の血統は重ならない/苦手なモンスター・その血統のマスモンは持たない
//   ⑥ 成長と染色: Lv は 1〜100/染色は、プレイヤーと同じ染色のマスク(images/monsters/<名前>-dye-mask)がある種類だけ・3部位の色
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
  for (const a of data) {
    const team = a.team || [];
    for (const m of team) if (!IMPL.has(m.monster)) bad.push(`${a.id}:${m.monster}${upBlock.includes(`${m.monster}:`) ? '(まだ案のモンスター)' : ''}`);
    for (const l of [...(a.like || []), ...(a.dislike || [])]) if (!IMPL_LINEAGES.has(l.lineage)) bad.push(`${a.id}:血統 ${l.lineage}`);
    if (team.length !== 3 || team.filter(m => m.lead).length !== 1) teamNg.push(`${a.id}(${team.length}体・先頭${team.filter(m => m.lead).length})`);
    for (const m of team) if (!m.nick || m.nick.length > 8 || /子/.test(m.nick) || team.filter(x => x.nick === m.nick).length > 1) teamNg.push(`${a.id}:${m.nick || '名前なし'}`);
    // 好き・苦手(モンスター単位)と、そこから広がる血統
    const likeMon = (a.likeMon || []).map(x => x.monster), disMon = (a.dislikeMon || []).map(x => x.monster);
    for (const id of [...likeMon, ...disMon]) if (!IMPL.has(id)) bad.push(`${a.id}:好き/苦手 ${id}${upBlock.includes(`${id}:`) ? '(まだ案のモンスター)' : ''}`);
    const like = new Set(likeMon.map(id => MAP.get(id))), dis = new Set(disMon.map(id => MAP.get(id)));
    if (likeMon.length !== 3 || disMon.length !== 3) likeNg.push(`${a.id}(好き${likeMon.length}・苦手${disMon.length})`);
    for (const l of like) if (dis.has(l)) likeNg.push(`${a.id}:血統 ${l} が好きと苦手の両方に広がる`);
    for (const m of team) { const ln = MAP.get(m.monster); if (disMon.includes(m.monster) || dis.has(ln)) likeNg.push(`${a.id}:${m.nick}(${m.monster})が苦手なモンスター・血統`); }
    if (!likeMon.includes((team.find(m => m.lead) || {}).monster)) likeNg.push(`${a.id}:先頭のマスモンが好きなモンスターに入っていない`);
    // 成長と染色
    for (const m of team) {
      if (!Number.isFinite(m.lv) || m.lv < 1 || m.lv > 100) dyeNg.push(`${a.id}:${m.nick} の Lv`);
      if (m.dye) {
        const file = IMGFILE[m.monster];
        const has = file && fs.readdirSync(path.join(root, 'monster-hero/images/monsters')).some(f => f.toLowerCase().startsWith(`${file}-dye-mask`));
        if (!has) dyeNg.push(`${a.id}:${m.nick}(${m.monster})は染色のマスクが無いのに染めている`);
        if (!Array.isArray(m.dye.colors) || m.dye.colors.length !== 3 || !m.dye.colors.every(c => /^#[0-9a-f]{6}$/i.test(c))) dyeNg.push(`${a.id}:${m.nick} の色は3部位`);
      }
    }
    if (a.later && [...IMPL.values()].includes(a.later.monster)) laterNg.push(`${a.id}:${a.later.monster} はもう実装済み(一覧に入れ直す)`);
  }
  check(`${T}① ② まだ実装されていないモンスター・血統が混ざっていない`, !bad.length, bad.join(' / '));
  check(`${T}③ 3体・先頭1体・ニックネーム`, !teamNg.length, teamNg.join(' / '));
  check(`${T}④ 好き・苦手のモンスター3つずつ・広がる血統が重ならない・苦手なものは持たない`, !likeNg.length, likeNg.join(' / '));
  check(`${T}⑥ 成長(Lv)と染色(マスクのある種類だけ・3部位)`, !dyeNg.length, dyeNg.join(' / '));
  check(`${T}⑤ 「あとで加わる」は、まだ実装されていないモンスターだけ`, !laterNg.length, laterNg.join(' / '));
}
console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
