#!/usr/bin/env node
// 助手のマスモンの技表 第2版(2026-11-13・社長「技は血統ごとの共通技+固有技・資料の全部・技名も資料のまま」)を作る。
//   材料: tools/assistant/techs2/tuned-draft.json   … バトル部(ジンくん2)が資料852技から数字を調整した技表(map・fix・species)。
//                                                       作り方は tools/masmon-battle/masmon-grade-map.js --tune(バトル部の道具)
//         tools/assistant/techs2/tech-idmap.json    … 古い技 id(mocchi_01 など)→ 新しい技 id(sk-0402 など)の対応表(バトル部が案を作った)
//   出力: monster-hero/data/assistant-masmon-techs.js(version 2)
//         docs/progress/assistant-peer/masmon-train/techs-table.html(--shot で絵も撮る。見る用)
//   ここで足すもの: 各技の rank(1〜5)と learn(覚え方)。数字(威力・命中など)はバトル部の表のまま、ここでは変えない
//   使い方: node tools/assistant/assistant-masmon-techs-build.js [--shot]
//
// ★技の rank(1〜5)が正本(この1か所)。助手の修行の「覚える段」とモンヒロサクセスの修行の覚える率(rank1=70/2=55/3=40/4=25/5=15%)が、
//   どちらもこの rank を読む。決め方(資料にランクがあるので資料を使う。バトル部ジンくん2・モンサク クラフトくん2と合意):
//   ・資料の技ランク(docs/reference/line-mf/monster-skill-data/monster-skills-by-blood/*.json の rank 1〜6)をそのまま使う。6 は 5 にそろえる
//   ・初めからの技(tuned-draft の learn.start)は rank 1
//   ・資料に無い技(オリジナル5種の90技)は、消費ガッツの軽い順に並べて、同じ数ずつ rank 1〜5 に分ける(同じガッツなら威力の小さい方が先)
// ★learn の付け方(助手の修行): rank 1(初めからでない技)= 100 以上 / rank 2 = その技種の能力 150 以上 / rank 3 = 250 以上+ひとつ下の技を熟練 25 / rank 4 = 350 以上+熟練 40 /
//   rank 5 = 450 以上+熟練 50。「ひとつ下の技」は、同じ技種で rank がちょうどひとつ下の技(無ければ、同じ技種でいちばん近い下の rank)。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const SRC = path.join(__dirname, 'techs2');
const draft = JSON.parse(fs.readFileSync(path.join(SRC, 'tuned-draft.json'), 'utf8'));
const idmap = JSON.parse(fs.readFileSync(path.join(SRC, 'tech-idmap.json'), 'utf8'));

// 資料の技ランク: skillId → rank(1〜5)
const RES_DIR = path.join(root, 'docs/reference/line-mf/monster-skill-data/monster-skills-by-blood');
const resRank = {};
for (const f of fs.readdirSync(RES_DIR).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(RES_DIR, f), 'utf8'));
  for (const sk of j.skills || []) if (sk && sk.skillId && Number.isFinite(sk.rank)) resRank[sk.skillId] = Math.min(5, Math.max(1, Math.round(sk.rank)));
}
const LEARN_ST = { 1: 100, 2: 150, 3: 250, 4: 350, 5: 450 };   // その技種(pow か wise)の能力の下限
const LEARN_NEED = { 3: 25, 4: 40, 5: 50 };            // ひとつ下の技の熟練
const KEEP = ['id', 'name', 'kind', 'dist', 'power', 'hit', 'guts', 'crit', 'gd'];

const problems = [];
const dupNote = new Set();
const species = {};
for (const [sp, list0] of Object.entries(draft.species)) {
  // 同じ種類の中に同じ id の技が2つ入っている種類がある(オボロゲソウ・プラント: 主血統と副血統が同じ技を持つため)。中身が同じなら1つにまとめる
  const seen = new Map(); const list = [];
  for (const t of list0) {
    if (!seen.has(t.id)) { seen.set(t.id, t); list.push(t); continue; }
    const f = seen.get(t.id);
    // 中身がわずかに違う(消費ガッツなど)ものも、先に出てきた方を残す。バトル部に確かめ中(同じ技の2つの版が同じ id になっている)
    if (KEEP.some((k) => JSON.stringify(f[k]) !== JSON.stringify(t[k]))) { if (!dupNote.has(sp)) { dupNote.add(sp); console.error(`注意: ${sp} に同じ id で数字が少し違う技がある。先の方を残した`); } }
    else if (!dupNote.has(sp)) { dupNote.add(sp); console.error(`注意: ${sp} は同じ技が重複していたので1つにまとめた(${list0.length}技 → ${list0.length - list0.filter((x, i) => list0.findIndex((y) => y.id === x.id) !== i).length}技)`); }
  }
  const base = list.map((t) => { const o = {}; for (const k of KEEP) o[k] = t[k]; if (t.moveTo != null) o.moveTo = t.moveTo; if (t.learn && t.learn.start) o.start = true; return o; });
  const rank = new Map();
  for (const t of base) { if (t.start) rank.set(t.id, 1); else if (resRank[t.id]) rank.set(t.id, resRank[t.id]); }
  // 資料に無い技(オリジナル5種)は、消費ガッツの軽い順に同じ数ずつ rank 1〜5 へ
  const noRes = base.filter((t) => !rank.has(t.id)).sort((a, b) => (a.guts - b.guts) || (a.power - b.power) || a.id.localeCompare(b.id));
  noRes.forEach((t, i) => rank.set(t.id, 1 + Math.min(4, Math.floor((i * 5) / Math.max(1, noRes.length)))));
  const out = base.map((t) => {
    const r = rank.get(t.id);
    const o = { id: t.id, name: t.name, kind: t.kind, dist: t.dist, power: t.power, hit: t.hit, guts: t.guts, crit: t.crit, gd: t.gd };
    if (t.moveTo != null) o.moveTo = t.moveTo;
    o.rank = r;
    if (base.find((x) => x.id === t.id).start) o.learn = { start: true }; // 初めからの技(各種類2つ)
    else {
      const st = { [t.kind]: LEARN_ST[r] };
      o.learn = { by: t.kind, st };
      if (LEARN_NEED[r]) {
        // ひとつ下の rank から順に下へ、同じ技種の技を探す
        let need = null;
        for (let q = r - 1; q >= 1 && !need; q--) need = base.find((x) => x.kind === t.kind && rank.get(x.id) === q && x.id !== t.id) || null;
        if (need) o.learn.need = { [need.id]: LEARN_NEED[r] };
      }
    }
    return o;
  });
  const reach = new Set(out.flatMap((t) => t.dist));
  for (const d of [0, 1, 2, 3]) if (!reach.has(d)) problems.push(`${sp}: 間合い ${'零近中遠'[d]} に届く技が無い(資料どおりなら直さない)`);
  if (!out.some((t) => t.learn.start && (t.dist.includes(0) || t.dist.includes(1)))) problems.push(`${sp}: 初めの技で近くに届かない`);
  if (new Set(out.map((t) => t.id)).size !== out.length) problems.push(`${sp}: 技 id が重複`);
  species[sp] = out;
}
// 対応表の確かめ: 対応先は同じ種類の新しい技にある
const flatMap = {};
for (const [sp, m] of Object.entries(idmap)) {
  const own = new Set((species[sp] || []).map((t) => t.id));
  for (const [o, n] of Object.entries(m)) { if (!own.has(n)) problems.push(`${sp}: 対応表 ${o} → ${n} が新しい表に無い`); flatMap[o] = n; }
}
const fatal = problems.filter((p) => !/届く技が無い/.test(p));
for (const p of problems) console.error((fatal.includes(p) ? 'NG: ' : '注意: ') + p);
if (fatal.length) process.exit(1);

const out = `// 助手のマスモンの技表 第2版(2026-11-13・社長「技は血統ごとの共通技+固有技・資料の全部・技名も資料のまま」)
// このファイルは tools/assistant/assistant-masmon-techs-build.js が作る(材料は tools/assistant/techs2/)。直すのはその道具か材料
//   技 = { id(種の中で一意・変えない・sk-0000 の形), name, kind:'pow'(ちから技)|'wise'(かしこさ技), dist:[届く間合い 0零 1近 2中 3遠],
//          power(20 ≒ 通常攻撃1回), hit(命中の補正 %), guts(消費ガッツ), crit(クリティカル %), gd(当たったら相手のガッツを減らす),
//          moveTo(当たったあと間合いを動かす。あれば), rank(1〜5・覚えやすさの正本。モンサクの修行の覚える率もこれを読む),
//          learn:{ start:true }(初めから) か { by:覚える修行の系統, st:{ 能力: 下限 }, need?:{ 技id: 熟練 } } }
//   idmap … 第1版の技 id(mocchi_01 など)→ 第2版の技 id。保存データの読み替えに使う(canon)。古い id は消さずに読み替える
//   対戦の計算(タタカイ assistant-masmon-battle.js)は learn・rank を読まない。習得は修行(56-assistant-life-masmon-train.jsx)が決める
const ASSISTANT_MASMON_TECHS = (() => {
  const idmap = ${JSON.stringify(flatMap)};
  return Object.freeze({
  version: 2,
  rankRates: { 1: 70, 2: 55, 3: 40, 4: 25, 5: 15 },
  idmap: Object.freeze(idmap),
  canon: (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(idmap, id) ? idmap[id] : id),
  species: {
${Object.entries(species).map(([id, list]) => `    ${id}: [\n${list.map((t) => `      ${JSON.stringify(t)},`).join('\n')}\n    ],`).join('\n')}
  },
  });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { ASSISTANT_MASMON_TECHS };
`;
fs.writeFileSync(path.join(root, 'monster-hero/data/assistant-masmon-techs.js'), out);
console.log(`書きました: ${Object.keys(species).length} 種 / ${Object.values(species).reduce((n, l) => n + l.length, 0)} 技 / 対応表 ${Object.keys(flatMap).length}件`);

// 見る用の表
const dir = path.join(root, 'docs/progress/assistant-peer/masmon-train'); fs.mkdirSync(dir, { recursive: true });
const rows = Object.entries(species).map(([sp, l]) => `<h3>${sp}</h3><table border=1 cellpadding=3 style="border-collapse:collapse;font-size:12px"><tr><th>rank<th>名前<th>技種<th>間合い<th>威力<th>命中<th>ガッツ<th>会心<th>削り<th>覚え方</tr>${l.map((t) => `<tr><td>${t.rank}<td>${t.name}<td>${t.kind === 'wise' ? 'かしこさ' : 'ちから'}<td>${t.dist.map((d) => '零近中遠'[d]).join('')}<td>${t.power}<td>${t.hit}<td>${t.guts}<td>${t.crit}<td>${t.gd}<td>${t.learn.start ? '初めから' : JSON.stringify(t.learn.st) + (t.learn.need ? ' +' + Object.entries(t.learn.need).map(([k, v]) => k + '≥' + v) : '')}</tr>`).join('')}</table>`).join('');
fs.writeFileSync(path.join(dir, 'techs-table.html'), `<!doctype html><meta charset="utf-8"><title>助手のマスモンの技表 第2版</title><body style="font-family:sans-serif">${rows}`);
