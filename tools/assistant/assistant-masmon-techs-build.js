#!/usr/bin/env node
// 助手のマスモンの技表(モンスターファームのような技の仕組み・2026-11-11 社長「距離撃はなしにして、技の性能自体も一新して」)を作る。
//   出力: monster-hero/data/assistant-masmon-techs.js(画面に頼らない純粋なデータ。対戦の計算はタタカイの assistant-masmon-battle.js が読む)
//         docs/progress/assistant-peer/masmon-train/techs-table.html・.jpg(社長に見せる表。--shot で絵も撮る)
//   名前は、その種族がいまゲームで持っている技の名前(HERO_ATK_NAMES の9つ+固有技 unique.names)から選ぶ。モンスターファームの技名は写さない
//   数字は「役割」ごとの型(下の ROLES)に、種族の得意(ちから/かしこさの伸びやすさ)と名前ごとの小さな揺れを足したもの
//   使い方: node tools/assistant/assistant-masmon-techs-build.js [--shot]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(['monster-hero/data/images/images-ally.js', 'monster-hero/data/ally-monsters.js'].map(p => fs.readFileSync(path.join(root, p), 'utf8')).join('\n') + '\nthis.M = ALL_PLAYER_MONSTERS; this.N = HERO_ATK_NAMES;', ctx);
const M = ctx.M, N = ctx.N;

// 役割の型(モンスターファーム2の技の数字の幅の中: 威力 4〜70・命中 −25〜+22・ガッツ 10〜55・クリティカル 5〜30・ガッツダウン 0〜45)
//   power は「20 ≒ いまの通常攻撃1回」(タタカイの戦闘の芯の約束)
const ROLES = {
  light: { label: '小技', power: 12, hit: 14, guts: 12, crit: 8, gd: 0 },
  mid: { label: '中技', power: 18, hit: 6, guts: 19, crit: 10, gd: 0 },
  skill: { label: '得意技', power: 24, hit: 2, guts: 25, crit: 12, gd: 4 },
  gdown: { label: 'ガッツ削り', power: 11, hit: 4, guts: 24, crit: 6, gd: 24 },
  heavy: { label: '重い技', power: 32, hit: -10, guts: 34, crit: 16, gd: 0 },
  far: { label: '飛び技', power: 26, hit: -4, guts: 30, crit: 10, gd: 6 },
  big: { label: '大技', power: 42, hit: -15, guts: 44, crit: 20, gd: 10 },
  ult: { label: '必殺技', power: 54, hit: -20, guts: 52, crit: 26, gd: 14 },
};
const ORDER = ['light', 'mid', 'skill', 'gdown', 'heavy', 'far', 'big', 'ult'];
// 習得の条件(役割ごと)。by=覚える修行の系統(pow/wise は技の種類に合わせる)・st=能力の下限・need=先に磨いておく技(役割)と熟練
const LEARN = {
  light: { start: true },
  mid: { start: true },
  skill: { by: 'kind', st: { kind: 180 } },
  gdown: { by: 'real', st: { kind: 200, hit: 150 } },
  heavy: { by: 'kind', st: { kind: 300 }, need: ['light', 25] },
  far: { by: 'kind', st: { kind: 300 }, need: ['mid', 25] },
  big: { by: 'kind', st: { kind: 450 }, need: ['heavy', 50] },
  ult: { by: 'real', st: { kind: 400, hit: 300 }, need: ['skill', 50] },
};
// 種族ごとの選び方: 役割の順(ORDER)に [名前の番号(0〜8=HERO_ATK_NAMES・9〜11=固有技), 種類 p=ちから/w=かしこさ, 届く距離(0零 1近 2中 3遠)]
const P = {
  Mocchi: [[0, 'p', [0, 1]], [1, 'p', [1]], [5, 'w', [2]], [3, 'p', [1]], [4, 'p', [0]], [7, 'w', [2, 3]], [8, 'p', [1, 2]], [9, 'w', [3]]],
  Suezo: [[0, 'p', [1]], [1, 'w', [2]], [7, 'w', [3]], [3, 'p', [0, 1]], [5, 'p', [0]], [10, 'w', [2, 3]], [2, 'p', [2]], [9, 'w', [3]]],
  Golem: [[0, 'p', [0]], [1, 'p', [0, 1]], [2, 'p', [1]], [4, 'p', [1, 2]], [6, 'p', [0]], [11, 'p', [2, 3]], [8, 'p', [1]], [9, 'p', [0]]],
  Tiger: [[1, 'p', [0, 1]], [0, 'p', [1]], [2, 'p', [1, 2]], [4, 'w', [2]], [5, 'p', [1]], [10, 'w', [2, 3]], [6, 'p', [1, 2]], [9, 'w', [3]]],
  Ham: [[0, 'p', [0]], [3, 'p', [1]], [1, 'p', [1, 2]], [9, 'w', [0, 1]], [5, 'p', [0, 1]], [10, 'p', [2, 3]], [8, 'p', [1, 2]], [11, 'w', [0, 1]]],
  Pixie: [[0, 'p', [0, 1]], [1, 'w', [2, 3]], [2, 'w', [3]], [7, 'w', [2]], [3, 'p', [1]], [5, 'w', [2, 3]], [6, 'w', [3]], [9, 'w', [2, 3]]],
  Mia: [[3, 'p', [0, 1]], [0, 'w', [1, 2]], [1, 'w', [2]], [7, 'w', [2, 3]], [2, 'w', [1, 2]], [5, 'w', [3]], [6, 'w', [2]], [9, 'w', [2, 3]]],
  Pandora: [[0, 'p', [0, 1]], [1, 'w', [2]], [3, 'p', [1]], [7, 'w', [2, 3]], [4, 'p', [0, 1]], [5, 'w', [3]], [6, 'w', [2, 3]], [9, 'w', [1, 2]]],
  Monol: [[0, 'p', [0]], [1, 'p', [1]], [3, 'p', [1, 2]], [10, 'w', [2, 3]], [2, 'p', [0]], [11, 'w', [3]], [6, 'p', [0, 1]], [9, 'w', [2, 3]]],
  Oboro: [[0, 'p', [0]], [1, 'p', [1]], [2, 'w', [1, 2]], [11, 'w', [2]], [4, 'p', [0]], [10, 'w', [2, 3]], [6, 'p', [1]], [9, 'w', [3]]],
  Zan: [[3, 'p', [0, 1]], [0, 'p', [2, 3]], [2, 'p', [1]], [1, 'w', [1, 2]], [5, 'p', [0, 1]], [6, 'p', [2, 3]], [8, 'p', [1, 2]], [9, 'p', [1, 2]]],
  Eiki: [[0, 'p', [0]], [1, 'p', [0, 1]], [2, 'w', [2]], [3, 'w', [1, 2]], [5, 'p', [1]], [4, 'w', [2, 3]], [6, 'p', [0, 1]], [9, 'p', [1, 2]]],
  KenshiMocchi: [[0, 'p', [0]], [2, 'p', [0, 1]], [1, 'p', [1, 2]], [5, 'w', [2, 3]], [4, 'p', [0, 1]], [3, 'p', [2]], [8, 'p', [1]], [9, 'p', [1, 2]]],
  Ark: [[1, 'p', [1]], [0, 'w', [2]], [2, 'p', [1, 2]], [5, 'w', [2, 3]], [4, 'p', [0, 1]], [3, 'w', [3]], [8, 'p', [1, 2]], [9, 'w', [2, 3]]],
  Snegurochka: [[0, 'p', [0, 1]], [1, 'w', [1, 2]], [2, 'w', [2, 3]], [7, 'w', [2]], [6, 'p', [0, 1]], [3, 'w', [3]], [8, 'w', [2, 3]], [9, 'w', [3]]],
  Yggdrasil: [[0, 'p', [0]], [3, 'p', [1]], [2, 'w', [2, 3]], [6, 'w', [2]], [1, 'p', [0, 1]], [5, 'w', [3]], [4, 'p', [1, 2]], [9, 'w', [2, 3]]],
  Melody: [[0, 'p', [0]], [3, 'p', [1]], [2, 'w', [2, 3]], [6, 'w', [2]], [1, 'p', [0, 1]], [5, 'w', [3]], [4, 'p', [1, 2]], [9, 'w', [1, 2]]],
  Ghost: [[0, 'p', [0, 1]], [5, 'w', [2]], [1, 'w', [2, 3]], [3, 'w', [1]], [7, 'p', [0]], [2, 'w', [3]], [8, 'p', [1, 2]], [9, 'w', [2, 3]]],
  Illumine: [[3, 'p', [0]], [1, 'p', [1]], [0, 'w', [2, 3]], [2, 'p', [0, 1]], [4, 'p', [1]], [6, 'p', [2, 3]], [8, 'p', [1, 2]], [9, 'w', [2, 3]]],
  Kyubi: [[0, 'p', [0, 1]], [1, 'w', [2]], [2, 'w', [2, 3]], [9, 'w', [1, 2]], [3, 'p', [0, 1]], [4, 'p', [3]], [6, 'p', [1, 2]], [8, 'w', [2, 3]]],
};
// 同じ名前の並びを持つ種族は、同じ選び方を使う(数字は種族の得意で変わる)
Object.assign(P, { Mitarashi: P.Mocchi, Plant: P.Oboro, Iblis: P.Ark, Undine: P.Snegurochka, Yaobikuni: P.Snegurochka, MelWhip: P.Yggdrasil, Kuromy: P.Melody, Spooky: P.Ghost, Dreamy: P.Illumine, Orihime: P.Kyubi });
// 種族の伸びやすさ(ライフ・ちから・かしこさ・命中・回避・丈夫さ の A〜E。第①段階の AMG_APT と同じ表)
const APT = { Mocchi: 'CCCBBB', Suezo: 'DCABDD', Golem: 'CACEEA', Tiger: 'DDBABE', Ham: 'CAECAE', Pixie: 'EDABBE', Mia: 'DCABBE', Pandora: 'DBAABE', Monol: 'DCCDEA', Oboro: 'BECCDD', Plant: 'AECCDE', Zan: 'EBEAAE', Eiki: 'DADBBE', KenshiMocchi: 'DAEACE', Mitarashi: 'CBBBCB', Ark: 'CCCDCB', Iblis: 'DCCDCC', Snegurochka: 'CEBABD', Undine: 'CEBABD', Yaobikuni: 'CEBABD', Yggdrasil: 'AECDEA', MelWhip: 'ADCCEA', Melody: 'AECBEA', Kuromy: 'BACBDB', Ghost: 'EEBBBE', Spooky: 'EEBBBE', Illumine: 'EEBCAE', Dreamy: 'DEBCAD', Kyubi: 'CCAACD', Orihime: 'CDAACC' };
const GRADE = { A: 2, B: 1, C: 0, D: -1, E: -2 };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0); };
const wob = (s, r) => (hash(s) % (2 * r + 1)) - r; // 名前ごとの小さな揺れ(−r〜+r・いつも同じ)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const RANGE = { power: [4, 70], hit: [-25, 22], guts: [10, 55], crit: [5, 30], gd: [0, 45] };

const species = {};
const problems = [];
for (const id of Object.keys(M)) {
  const picks = P[id];
  if (!picks) { problems.push(`${id}: 選び方が無い`); continue; }
  const names = [...(N[id] || []).slice(0, 9), ...((M[id].unique && M[id].unique.names) || [M[id].unique && M[id].unique.name]).slice(0, 3)];
  const apt = APT[id] || 'CCCCCC';
  const prefix = id.toLowerCase();
  const list = picks.map(([ni, k, dist], i) => {
    const role = ORDER[i]; const R = ROLES[role]; const kind = k === 'w' ? 'wise' : 'pow';
    const name = names[ni];
    if (!name) problems.push(`${id}: ${ni} 番の名前が無い`);
    const g = GRADE[apt[kind === 'pow' ? 1 : 2]] || 0; // その種族が得意な種類の技は少し強く・軽く
    const t = {
      id: `${prefix}_${String(i + 1).padStart(2, '0')}`, name, kind, dist: dist.slice().sort(), role,
      power: clamp(R.power + g * 2 + wob(`${id}|${name}|p`, 2), ...RANGE.power),
      hit: clamp(R.hit + wob(`${id}|${name}|h`, 3) + (dist.length > 1 ? -2 : 0), ...RANGE.hit),
      guts: clamp(R.guts - g + wob(`${id}|${name}|g`, 2), ...RANGE.guts),
      crit: clamp(R.crit + wob(`${id}|${name}|c`, 2), ...RANGE.crit),
      gd: R.gd ? clamp(R.gd + wob(`${id}|${name}|d`, 3), ...RANGE.gd) : 0,
    };
    const L = LEARN[role];
    if (L.start) t.learn = { start: true };
    else {
      const st = {}; for (const [sk, v] of Object.entries(L.st)) st[sk === 'kind' ? kind : sk] = Math.max(st[sk === 'kind' ? kind : sk] || 0, v);
      t.learn = { by: L.by === 'kind' ? kind : L.by, st };
      // 先に磨く技: 決めた役割の技が同じ種類ならそれ、違えば、それより前の同じ種類の技(無ければ決めた役割のまま)
      if (L.need) {
        const want = ORDER.indexOf(L.need[0]);
        const same = [want, ...ORDER.slice(0, i).map((_, j) => i - 1 - j)].find(j => j < i && (picks[j][1] === 'w' ? 'wise' : 'pow') === kind);
        const j = same == null ? want : same;
        t.learn.need = { [`${prefix}_${String(j + 1).padStart(2, '0')}`]: L.need[1] };
      }
    }
    return t;
  });
  const reach = new Set(list.flatMap(t => t.dist));
  for (const d of [0, 1, 2, 3]) if (!reach.has(d)) problems.push(`${id}: 距離 ${'零近中遠'[d]} に届く技が無い`);
  if (!list.filter(t => t.learn.start).some(t => t.dist.includes(0) || t.dist.includes(1))) problems.push(`${id}: 初めの技で近くに届かない`);
  if (new Set(list.map(t => t.name)).size !== list.length) problems.push(`${id}: 同じ名前の技がある`);
  species[id] = list;
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const out = `// 助手のマスモンの技表(2026-11-11・シュギョウ。社長「距離撃はなしにして、技の性能自体も一新して作ってほしい。モンファーみたいな感じで」)
// このファイルは tools/assistant/assistant-masmon-techs-build.js が作る。直すのはその道具の表(P・ROLES・LEARN)
//   名前は、その種族がいまゲームで持っている技の名前(HERO_ATK_NAMES・unique.names)から選んだ。モンスターファームの技名は写していない
//   技 = { id(種の中で一意・変えない), name, kind:'pow'(ちから技)|'wise'(かしこさ技), dist:[届く距離 0零 1近 2中 3遠], role(役割),
//          power(20 ≒ 通常攻撃1回), hit(命中の補正 %), guts(消費ガッツ), crit(クリティカル %), gd(当たったら相手のガッツを減らす),
//          learn:{ start:true }(初めから) か { by:覚える修行の系統, st:{ 能力: 下限 }, need?:{ 技id: 熟練 } } }
//   対戦の計算(タタカイ assistant-masmon-battle.js)は learn を読まない。習得は修行(56-assistant-life-masmon-train.jsx)が決める
const ASSISTANT_MASMON_TECHS = Object.freeze({
  version: 1,
  roles: ${JSON.stringify(Object.fromEntries(ORDER.map(r => [r, ROLES[r].label])))},
  species: {
${Object.entries(species).map(([id, list]) => `    ${id}: [\n${list.map(t => `      ${JSON.stringify(t)},`).join('\n')}\n    ],`).join('\n')}
  },
});
if (typeof module !== 'undefined' && module.exports) module.exports = { ASSISTANT_MASMON_TECHS };
`;
fs.writeFileSync(path.join(root, 'monster-hero/data/assistant-masmon-techs.js'), out);

// 社長に見せる表
const DN = '零近中遠';
const ST = { pow: 'ちから', wise: 'かしこさ', hit: '命中' };
const BY = { pow: 'ちから修行', wise: 'かしこさ修行', real: '実戦修行' };
const learnText = (t, list) => t.learn.start ? '<b class="s">初めから</b>' : `${BY[t.learn.by]}・${Object.entries(t.learn.st).map(([k, v]) => `${ST[k]}${v}`).join('・')}${t.learn.need ? `・${Object.entries(t.learn.need).map(([k, v]) => `「${(list.find(x => x.id === k) || {}).name}」熟練${v}`).join('')}` : ''}`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>助手のマスモンの技表(案)</title><style>
body{margin:0;padding:16px;background:#0b1220;color:#e2e8f0;font:12px/1.45 system-ui,sans-serif}
h1{font-size:18px;color:#fde68a;margin:0 0 4px}p.note{margin:0 0 12px;color:#94a3b8}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.sp{border:1px solid #334155;border-radius:12px;padding:8px 10px;background:#111a2e}.sp h2{margin:0 0 4px;font-size:14px;color:#f9a8d4}
table{border-collapse:collapse;width:100%}td,th{padding:2px 4px;border-bottom:1px solid #1e293b;text-align:right;white-space:nowrap}th{color:#94a3b8;font-weight:700}
td.n{text-align:left;font-weight:800}td.r{text-align:left;color:#94a3b8}td.l{text-align:left;font-size:10.5px;color:#cbd5e1;white-space:normal}
.k-pow{color:#fca5a5}.k-wise{color:#93c5fd}.d i{display:inline-block;width:13px;text-align:center;border-radius:3px;margin-left:1px;color:#475569;font-style:normal}.d i.on{background:#fbbf24;color:#111}b.s{color:#86efac}
</style></head><body><h1>助手のマスモンの技表(案)・30種族 × 8つ</h1>
<p class="note">名前は各種族がいまゲームで持っている技の名前から。数字はモンスターファーム2の技の幅の中(威力 20≒通常攻撃1回/命中 %/ガッツ=消費/会心 %/削り=当たると相手のガッツを減らす)。<span class="k-pow">赤=ちから技</span>・<span class="k-wise">青=かしこさ技</span>。距離は 零・近・中・遠。</p>
<div class="grid">${Object.entries(species).map(([id, list]) => `<div class="sp"><h2>${M[id].name}<small style="color:#94a3b8;font-weight:400"> 伸びやすさ ${APT[id]}</small></h2><table><tr><th style="text-align:left">技</th><th style="text-align:left">役割</th><th>距離</th><th>威力</th><th>命中</th><th>ガッツ</th><th>会心</th><th>削り</th><th style="text-align:left">覚え方</th></tr>
${list.map(t => `<tr><td class="n k-${t.kind}">${t.name}</td><td class="r">${ROLES[t.role].label}</td><td class="d">${[0, 1, 2, 3].map(d => `<i class="${t.dist.includes(d) ? 'on' : ''}">${DN[d]}</i>`).join('')}</td><td>${t.power}</td><td>${t.hit > 0 ? '+' : ''}${t.hit}</td><td>${t.guts}</td><td>${t.crit}</td><td>${t.gd || ''}</td><td class="l">${learnText(t, list)}</td></tr>`).join('')}</table></div>`).join('')}</div></body></html>`;
const dir = path.join(root, 'docs/progress/assistant-peer/masmon-train');
fs.writeFileSync(path.join(dir, 'techs-table.html'), html);
console.log(`OK: ${Object.keys(species).length} 種族 × 8 = ${Object.values(species).flat().length} 技`);
if (process.argv.includes('--shot')) (async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + path.join(dir, 'techs-table.html'));
  await p.screenshot({ path: path.join(dir, 'techs-table.jpg'), type: 'jpeg', quality: 80, fullPage: true });
  await b.close(); console.log('OK: techs-table.jpg');
})();
