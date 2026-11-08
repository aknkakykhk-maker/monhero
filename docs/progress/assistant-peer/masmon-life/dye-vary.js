// 助手のマスモンの染め方を「同じ助手でもマスモンごとに変える」形で masmon-plan.json に書く(2026-11-08 社長「好き色はあるけどバリエーションをもっとだしてほしい」)。
//   node docs/progress/assistant-peer/masmon-life/dye-vary.js
// 5体の型: 1 好きな色を濃いめ / 2 差し色だけ(1か所) / 3 反対色と季節(秋)の色 / 4 元の色に近い(薄く1か所) / 5 思い切った色(全部の部位)
// 性格は濃さで出す: 控えめ=濃さを下げる(5体目の思い切った色は下げない)/大胆=濃さを上げる(4体目の元の色に近いものは上げない)。濃さは最大90%(べた塗りで陰影が消えるのを避ける)
// 色は「色id@濃さ」・null は元の色のまま(プレイヤーの染色と同じ書き方)
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..', '..', '..');
const planPath = path.join(__dirname, '..', 'masmon-plan.json');
const dyeSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/15-dye-and-art.jsx'), 'utf8');
const REGIONS = (() => {
  const a0 = dyeSrc.indexOf('const MASU_COLOR_REGION_HUES = {');
  const expr = dyeSrc.slice(a0 + 'const MASU_COLOR_REGION_HUES = '.length, dyeSrc.indexOf('\n};', a0) + 2);
  const scope = new Proxy({}, { has: (t, k) => k !== 'Math' && k !== 'Object' && k !== 'Array', get: (t, k) => (k === Symbol.unscopables ? undefined : []) });
  const obj = Function('scope', `with (scope) { return (${expr}); }`)(scope);
  const out = {}; for (const [k, v] of Object.entries(obj)) out[k] = Array.isArray(v) ? v.length : 0;
  for (const m of dyeSrc.matchAll(/MASU_COLOR_REGION_HUES\.(\w+)\s*=\s*MASU_COLOR_REGION_HUES\.(\w+)/g)) out[m[1]] = out[m[2]];
  for (const m of dyeSrc.matchAll(/MASU_COLOR_REGION_HUES\.(\w+)\s*=\s*\[([\s\S]*?)\n\];/g)) out[m[1]] = (m[2].match(/\{/g) || []).length;
  return out;
})();
const OPP = { red: 'cyan', orange: 'blue', yellow: 'purple', lime: 'magenta', green: 'pink', teal: 'red', cyan: 'red', sky: 'orange', blue: 'orange', purple: 'yellow', magenta: 'green', pink: 'green', black: 'white', white: 'black', gray: 'black' };
const opp = (c) => { const light = c.endsWith('_light'); const b = c.replace('_light', ''); const o = OPP[b] || 'gray'; return light && !['black', 'white', 'gray'].includes(o) ? `${o}_light` : o; };
const SEASON = 'orange'; // 11月(秋・紅葉)
const TEMPER = { kiki: 'quiet', kyuko: 'quiet', sorashido: 'quiet', mua: 'mid', erubin: 'mid', momosuke: 'bold', atsu: 'bold', dra: 'bold' };
const at = (c, a) => (c ? (a >= 100 ? c : `${c}@${Math.round(a)}`) : null);
const J = JSON.parse(fs.readFileSync(planPath, 'utf8'));
for (const a of J.assistants) {
  const fav = a.favColors.map(x => x.color);
  const f = (i) => fav[i % fav.length];
  const t = TEMPER[a.id];
  const k = (base, slot) => { if (t === 'quiet' && slot !== 5) return base * 0.75; if (t === 'bold' && slot !== 4) return Math.min(90, base * 1.12); return base; };
  const tpl = {
    1: [at(f(0), k(85, 1)), at(f(1), k(65, 1)), null, at(f(0), k(70, 1)), null],
    2: [null, at(f(0), k(90, 2)), null, null, null],
    3: [at(opp(f(0)), k(70, 3)), null, at(SEASON, k(55, 3)), null, at(opp(f(0)), k(60, 3))],
    4: [at(f(1), 35), null, null, null, null],
    5: [at(f(0), 90), at(f(2) || opp(f(0)), 90), at(f(1), 90), at(opp(f(1)), 85), at(f(0), 90)],
  };
  const mons = [...a.team.filter(m => m.lead), ...a.team.filter(m => !m.lead), ...(a.extra || [])];
  mons.forEach((m, i) => {
    const n = REGIONS[m.monster] || 3;
    let cols = tpl[i + 1].slice(0, n);
    while (cols.length < n) cols.push(null);
    if (!cols.some(Boolean)) cols[0] = tpl[i + 1].find(Boolean); // 1枠しかない子でも、どこかは染める
    m.dye = { colors: cols, style: ['濃いめ', '差し色', '反対色と秋の色', '元の色に近い', '思い切った色'][i] };
  });
}
J._ = J._.replace(/ \/ dye: .*$/, '') + ' / dye: 2026-11-08 社長「好き色はあるけどバリエーションをもっとだしてほしい」で、マスモンごとに染め方を変えた(masmon-life/dye-vary.js が書く)';
fs.writeFileSync(planPath, JSON.stringify(J, null, 1) + '\n');
console.log('書きました');
