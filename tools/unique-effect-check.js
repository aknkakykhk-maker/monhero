// 固有技の「効果の説明文」と「実際の実装」が食い違っていないかを見張る。
//
// 【なぜ道具にするか】
// 説明文(data/ally-monsters.js の effectDesc)と実装(game-system.jsx の card.monId 分岐)は
// 別のファイルにあり、片方だけ直しても例外は出ない。遊んでいる側からは
// 「書いてあるとおりに効いていない」としか分からず、原因の切り分けもできない。
//
// 実際に、モッチ砲の効果が
//   説明 「味方丈夫さ3%増」 / 実装 addPermaBuff('dmgCutPct', 0.03)(＝被ダメージ3%軽減)
// と食い違っていた。丈夫さの数値もガードの軽減量も増えないので、
// 「バフが効いていない」という報告になった。数字も意味も、ここで機械的に突き合わせる。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const ctx = { Math };
vm.createContext(ctx);
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/skills.js'),
  read('monster-hero/data/ally-monsters.js'),
  'globalThis.__d = { ALL_PLAYER_MONSTERS };',
].join('\n'), ctx);
const MONS = ctx.__d.ALL_PLAYER_MONSTERS;

const source = read('monster-hero/src/game-system.jsx');

// --- 固有技の効果分岐だけを切り出す ---
// card.monId==='X' は getDmg やザンの連撃判定にも出てくるので、
// 「固有技を使ったときの効果」を書いている範囲へ先に絞ってから探す。
// 範囲は processTurn の中の、モッチーの分岐からアーク/イブリースの分岐までの間。
const EFFECT_FROM = "if(card.monId==='Mocchi'||card.monId==='Mitarashi')";
const EFFECT_TO = "else if(card.monId==='Ark'||card.monId==='Iblis'){";
const effectRegion = (() => {
  const from = source.indexOf(EFFECT_FROM);
  const to = source.indexOf(EFFECT_TO, from);
  return (from >= 0 && to > from) ? source.slice(from, to) : null;
})();
check('固有技の効果を書いている範囲を取り出せる', !!effectRegion);
if (!effectRegion) { console.log('\n1件のNGがあります'); process.exit(1); }
const branchOf = (monId) => {
  // 1行で書かれているので、その行末までで足りる
  const m = effectRegion.match(new RegExp(`card\\.monId==='${monId}'[^\\n]*`));
  return m ? m[0] : null;
};

// 効果の「意味」まで見るために、実装で使っている関数とキーを明示的に突き合わせる。
//   impl … その分岐に必ず出てほしい実装(関数名とキー、割合)
//   desc … 説明文に必ず出てほしい言葉
// 割合は実装から読み取り、説明文の数字と一致するかを数値で確かめる。
const RULES = [
  {
    monId: 'Mocchi', label: 'モッチー(モッチ砲)',
    impl: [
      { re: /addPermaBuff\('dmgCutPct',([\d.]+)\*effMul\)/, mustSay: '被ダメージ', unit: '%', note: '被ダメージの割合軽減' },
      { re: /addWaveBuff\('enemyTakenDmgBonus',([\d.]+)\*effMul\)/, mustSay: '敵被ダメ', unit: '%', note: '敵の被ダメージ増加' },
    ],
    forbid: [{ re: /addDefPct\(/, why: 'モッチーは丈夫さそのものは上げない(被ダメージ軽減)' }],
  },
  {
    monId: 'Monol', label: 'モノリス(トリオビームX)',
    impl: [
      { re: /addDefPct\(([\d.]+)\*effMul\)/, mustSay: '丈夫さ', unit: '%', note: '丈夫さそのものの増加' },
      { re: /addWaveBuff\('enemyAtkDebuffPct',([\d.]+)\*effMul\)/, mustSay: '敵攻', unit: '%', note: '敵攻撃力の低下' },
    ],
    forbid: [{ re: /addPermaBuff\('dmgCutPct'/, why: 'モノリスは被ダメージ軽減ではなく丈夫さアップ' }],
  },
  {
    monId: 'Golem', label: 'ゴーレム(合掌)',
    impl: [{ re: /addPermaBuff\('atkPct',([\d.]+)\*effMul\)/, mustSay: '与ダメージ', unit: '%', note: '与ダメージの増加' }],
    forbid: [],
  },
  {
    monId: 'Zan', label: 'ザン(リバースレイド)',
    impl: [{ re: /addPermaBuff\('comboDmgPct',([\d.]+)\*effMul\)/, mustSay: '連撃ダメージ', unit: '%', note: '連撃ダメージの増加' }],
    forbid: [],
  },
];

// 説明文に「その数字」がパーセントとして出てくるか。3% / 7.5% / 10% のいずれの書き方でも拾う
const descHasPercent = (desc, value) => {
  const pct = value * 100;
  const shown = Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(1)));
  return new RegExp(`${shown.replace('.', '\\.')}\\s*%`).test(desc);
};

for (const rule of RULES) {
  const mon = MONS[rule.monId];
  if (!mon) { check(`${rule.label}: モンスターが存在する`, false); continue; }
  const desc = mon.unique?.effectDesc || '';
  const branch = branchOf(rule.monId);
  check(`${rule.label}: 効果の実装が見つかる`, !!branch);
  if (!branch) continue;
  console.log(`  説明文「${desc}」`);
  for (const one of rule.impl) {
    const m = branch.match(one.re);
    check(`${rule.label}: ${one.note}が実装されている`, !!m, m ? `${(Number(m[1]) * 100)}%` : '見つからない');
    if (!m) continue;
    const value = Number(m[1]);
    check(`${rule.label}: 説明文が「${one.mustSay}」と書いている`, desc.includes(one.mustSay), desc);
    check(`${rule.label}: 説明文の数字が実装と一致(${(value * 100)}%)`, descHasPercent(desc, value), desc);
  }
  for (const f of rule.forbid) {
    check(`${rule.label}: ${f.why}`, !f.re.test(branch), branch.match(f.re)?.[0] || '');
  }
}

// --- 2枚目以降の半減(effMul)が全ての固有技効果へ掛かっていること ---
// 掛け忘れると、2枚目に使ったときだけ効果が丸ごと1枚目ぶん乗ってしまう
// chuuniUniqueStack は「使った回数」を数える積み上げなので、半減の対象外
const NOT_HALVED = new Set(['chuuniUniqueStack']);
const buffCalls = [...effectRegion.matchAll(/add(?:PermaBuff|WaveBuff)\('(\w+)',([^)]+)\)/g)];
check('固有技の効果に効果量がある', buffCalls.length > 0, `${buffCalls.length}件`);
for (const [, key, arg] of buffCalls) {
  if (NOT_HALVED.has(key)) continue;
  check(`2枚目以降の半減が効く: ${key}`, /\*effMul/.test(arg), arg);
}
check('丈夫さアップにも2枚目以降の半減が効く',
  !/addDefPct\(/.test(effectRegion) || /addDefPct\([\d.]+\*effMul\)/.test(effectRegion));

// --- 丈夫さアップの実装が「0にならない」こと ---
// 割合を切り捨てるだけだと、丈夫さが低いうちは +0 になって何も起きない
check('丈夫さアップは最低でも+1上がる',
  /const addDefPct = \(rate\) => setDef\(d => d \+ Math\.max\(1, Math\.floor\(d \* rate\)\)\);/.test(source));

// --- 画面の表示が意味と合っていること ---
// 「被ダメージ軽減」を「DEF +3%」と出していたため、丈夫さが増えたように見えていた
check('被ダメージ軽減のバッジが「被ダメ -◯%」と出る', /被ダメ -\{Math\.floor\(getPermaBuff\('dmgCutPct'\)\*100\)\}%/.test(source));
check('被ダメージ軽減を「DEF +◯%」と表示していない', !/DEF \+\{Math\.floor\(getPermaBuff\('dmgCutPct'\)\*100\)\}%/.test(source));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
