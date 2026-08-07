// 勇者モンの「素の能力」が壊れた形になっていないかを、実装と同じ式で見張る。
//
// 【なぜ道具にするか】
// 能力値は data/ally-monsters.js のただの数字なので、どんな値を書いても例外は出ない。
// おかしさは実際に何ランも遊んで初めて分かる。実際にゴーレムが
//   ・最大ガッツ70に対して固有技「合掌」の消費が68だったため、自動回復(最大の5%)では
//     初めて合掌を撃てるのが11ターン目。他の11種は全員1ターン目に撃てていた
//     → 看板の必殺技がほとんど出ないまま終わり、その効果「闘志」も積めなかった
//   ・そのかわり ちからが250で、2位(160)の1.56倍。通常技1発が2位の1.88倍あった
// という「長所も短所も極端」な状態になっていた。
// どちらも数字を並べれば機械的に分かるので、同じ壊れ方を全種について見張る。
//
// ここで見るのは種ごとの素の値だけで、育て方や難易度は見ない。
// 「この種は強い/弱い」ではなく「遊びとして成立しない形になっていないか」を見る。
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

// --- ゲームのデータを読む ---
const ctx = { Math };
vm.createContext(ctx);
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/skills.js'),
  read('monster-hero/data/ally-monsters.js'),
  'globalThis.__d = { ALL_PLAYER_MONSTERS, BASE_ATK_EVOLUTION };',
].join('\n'), ctx);
const { ALL_PLAYER_MONSTERS: MONS, BASE_ATK_EVOLUTION: ATK_EV } = ctx.__d;

// --- 実装から式の定数を読む(ここが変わったらこの検査の前提も変わる) ---
const source = read('monster-hero/src/game-system.jsx');
const num = (re, label) => {
  const m = source.match(re);
  if (!m) { check(`${label}を実装から読める`, false); return null; }
  return Number(m[1]);
};
// 毎ターンの自動ガッツ回復率(強化なしのラン開始時)
const gutsRecoveryRate = num(/const gutsRecoveryRate=Math\.max\(0,([\d.]+)\+\(autoHpRecoveryRate-0\.1\)\)/, '自動ガッツ回復率');
// ラン開始時の手持ちガッツは最大の半分
const startGutsRatio = num(/setMaxGuts\(m\.baseGuts\); setGuts\(Math\.floor\(m\.baseGuts\*([\d.]+)\)\)/, '開始時ガッツの割合');
// ゴーレムの勇者特性「怪力」の倍率
const golemTrait = num(/mainHero\?\.id==='Golem'\?([\d.]+):1\.0/, '怪力の倍率');
check('式の定数を実装から読めている',
  gutsRecoveryRate !== null && startGutsRatio !== null && golemTrait !== null,
  `自動回復${gutsRecoveryRate} / 開始${startGutsRatio} / 怪力×${golemTrait}`);
if (gutsRecoveryRate === null || startGutsRatio === null || golemTrait === null) {
  console.log(`\n${failed}件のNGがあります`); process.exit(1);
}

const ids = Object.keys(MONS);
// 固有技の消費ガッツは Math.floor(baseGuts * (現在倍率 / 基礎倍率))。Lv0なら baseGuts そのもの
const uniqueCost = (m) => Math.floor(m.unique.baseGuts * (m.unique.baseMult / m.unique.baseMult));
// 「ガッツを貯めるだけで、固有技を初めて撃てるターン」
const firstUniqueTurn = (m) => {
  const max = m.baseGuts, cost = uniqueCost(m);
  let g = Math.floor(max * startGutsRatio);
  const regen = Math.floor(max * gutsRecoveryRate);
  for (let t = 1; t <= 40; t++) { g = Math.min(max, g + regen); if (g >= cost) return t; }
  return Infinity;
};

// --- ① 固有技が現実的に撃てること ---
// 看板の必殺技なので、1回の戦いのうちに出せる回転であってほしい。
// 上限を8ターンにしているのは、実際に11ターンかかっていたゴーレムが
// 「1回の戦いが終わるまでに撃てない=実質使えない」状態だったため。
// ゴーレムは重量級として意図的に遅く(7ターン目)、他11種は1ターン目に撃てる。
const FIRST_UNIQUE_TURN_MAX = 8;
console.log('種ごとの固有技の回り:');
for (const id of ids) {
  const m = MONS[id];
  const t = firstUniqueTurn(m);
  console.log(`  ${m.name.padEnd(10)} 最大G ${String(m.baseGuts).padStart(3)} / 回復 ${String(Math.floor(m.baseGuts * gutsRecoveryRate)).padStart(2)}per turn / 消費 ${String(uniqueCost(m)).padStart(3)} / 初回 ${t === Infinity ? '撃てない' : `${t}ターン目`}`);
}
for (const id of ids) {
  const m = MONS[id];
  check(`${m.name}: 固有技の消費が最大ガッツを超えない`, uniqueCost(m) <= m.baseGuts,
    `消費${uniqueCost(m)} / 最大${m.baseGuts}`);
}
for (const id of ids) {
  const m = MONS[id];
  const t = firstUniqueTurn(m);
  check(`${m.name}: 固有技を${FIRST_UNIQUE_TURN_MAX}ターン以内に撃てる`, t <= FIRST_UNIQUE_TURN_MAX,
    t === Infinity ? '貯めても撃てない' : `${t}ターン目 (上限 ${FIRST_UNIQUE_TURN_MAX})`);
}

// --- ② 素の火力が桁違いになっていないこと ---
// どの種がどれだけ強いかは調整で決めることなので、ここでは踏み込まない。
// 見たいのは「0を1つ多く書いた」「桁を間違えた」類の事故なので、上限は緩く取り、
// 比そのものは毎回表示して目で追えるようにしておく。
const ATK_TOP_RATIO_MAX = 2.0;   // ちから1位 ÷ 2位
const PLUS_ATK_RATIO_MAX = 2.0;  // 供モンのちから加算 1位 ÷ 2位
const sortedAtk = ids.map(id => ({ name: MONS[id].name, v: MONS[id].baseAtk })).sort((a, b) => b.v - a.v);
check('ちからが1種だけ突出していない', sortedAtk[0].v <= sortedAtk[1].v * ATK_TOP_RATIO_MAX,
  `1位 ${sortedAtk[0].name} ${sortedAtk[0].v} / 2位 ${sortedAtk[1].name} ${sortedAtk[1].v} = ${(sortedAtk[0].v / sortedAtk[1].v).toFixed(2)}倍 (上限 ${ATK_TOP_RATIO_MAX}倍)`);
const sortedPlus = ids.map(id => ({ name: MONS[id].name, v: (MONS[id].plusStats || {}).atk || 0 })).sort((a, b) => b.v - a.v);
check('供モンのちから加算が1種だけ突出していない', sortedPlus[0].v <= sortedPlus[1].v * PLUS_ATK_RATIO_MAX,
  `1位 ${sortedPlus[0].name} +${sortedPlus[0].v} / 2位 ${sortedPlus[1].name} +${sortedPlus[1].v} = ${(sortedPlus[0].v / sortedPlus[1].v).toFixed(2)}倍 (上限 ${PLUS_ATK_RATIO_MAX}倍)`);

// 通常技1発の重さ(得意距離・敵が同距離・強化なし)。倍率の掛かり方まで含めて比べる
const DIST_MULT_SAME = 1.5;
const APT_MULT = { G: 0.8, F: 0.85, E: 0.9, D: 0.95, C: 1.0, B: 1.05, A: 1.1, S: 1.15, 'S+': 1.175, SS: 1.2, 'SS+': 1.225, M: 1.25 };
const bestAptMult = (m) => Math.max(...(m.distAptitude || ['C']).map(g => APT_MULT[g] ?? 1.0));
const normalHit = (m) => Math.floor(m.baseAtk * DIST_MULT_SAME * ATK_EV[0].mult * (m.id === 'Golem' ? golemTrait : 1.0) * bestAptMult(m));
const NORMAL_HIT_RATIO_MAX = 2.0;
const sortedHit = ids.map(id => ({ name: MONS[id].name, v: normalHit(MONS[id]) })).sort((a, b) => b.v - a.v);
check('通常技1発の重さが1種だけ突出していない', sortedHit[0].v <= sortedHit[1].v * NORMAL_HIT_RATIO_MAX,
  `1位 ${sortedHit[0].name} ${sortedHit[0].v} / 2位 ${sortedHit[1].name} ${sortedHit[1].v} = ${(sortedHit[0].v / sortedHit[1].v).toFixed(2)}倍 (上限 ${NORMAL_HIT_RATIO_MAX}倍)`);

// --- ③ ゴーレムの指定値が意図せず変わっていないこと ---
// ライフ・ちから・丈夫さ・ガッツ・間合い適性・闘志の効果量はユーザー指定の値。
// 変えるときは指示を確認したうえで、この検査も一緒に直す(=意図した変更だと分かるように)
const golem = MONS.Golem;
check('ゴーレム: ライフ600', golem.baseHp === 600, String(golem.baseHp));
check('ゴーレム: ちから220', golem.baseAtk === 220, String(golem.baseAtk));
check('ゴーレム: 丈夫さ150', golem.baseDef === 150, String(golem.baseDef));
check('ゴーレム: 最大ガッツ70', golem.baseGuts === 70, String(golem.baseGuts));
check('ゴーレム: 間合い適性 A/E/G/G', golem.distAptitude.join('/') === 'A/E/G/G', golem.distAptitude.join('/'));
// 合掌の消費ガッツは指定に無い。68へ戻すと初回が11ターン目になり実質撃てなくなるため、
// 「①で見張っているだけ」にせず、意図した値であることをここでも明示しておく
check('ゴーレム: 合掌の消費ガッツ56', golem.unique.baseGuts === 56, String(golem.unique.baseGuts));
check('ゴーレム: 供モンのちから加算+60', (golem.plusStats || {}).atk === 60, String((golem.plusStats || {}).atk));
check('ゴーレム: 合掌の倍率3.2(全種で最高)',
  golem.unique.baseMult === 3.2 && ids.every(id => MONS[id].unique.baseMult <= 3.2),
  `${golem.unique.baseMult}`);
check('ゴーレム: 怪力の×1.2が実装に残っている', golemTrait === 1.2, `×${golemTrait}`);
check('ゴーレム: ちからは全種で1位', sortedAtk[0].name === golem.name,
  `1位 ${sortedAtk[0].name} ${sortedAtk[0].v}`);

// --- ④ 闘志(合掌の効果)の効果量が、表示と実装で一致していること ---
// 表示だけ直して実装を直し忘れる(逆も)と、遊んでいる側からは絶対に気付けない。
const toushiCode = num(/card\.monId==='Golem'\)\{addPermaBuff\('atkPct',([\d.]+)\*effMul\)/, '闘志の効果量(実装)');
const toushiCodeLocal = num(/card\.monId==='Golem'\)\{addPermaBuff\('atkPct',[\d.]+\*effMul\); localOryoAdd\+=([\d.]+)\*effMul/, '闘志の効果量(使ったターン)');
const toushiDesc = (golem.unique.effectDesc || '').match(/([\d.]+)%/);
check('闘志: 実装の効果量が7.5%', toushiCode === 0.075, `${(toushiCode * 100).toFixed(1)}%`);
check('闘志: 使ったターンにも同じ量が乗る', toushiCodeLocal === toushiCode,
  `永続${(toushiCode * 100).toFixed(1)}% / そのターン${(toushiCodeLocal * 100).toFixed(1)}%`);
check('闘志: 説明文の数字が実装と一致', !!toushiDesc && Number(toushiDesc[1]) === toushiCode * 100,
  `説明「${golem.unique.effectDesc}」 / 実装 ${(toushiCode * 100).toFixed(1)}%`);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
