// 限界突破の★（凸数と色・個数）と、最終限界突破（Lv.180 → Lv.200）を確認する。
//
// ★の色と個数は保存していない。保存してある rebirthCount から毎回組み立てるので、
// 組み立て方がずれても例外にならず「なんとなく色が違う」としか分からない。
// 実際、以前は 6凸で5個とも次の色になってしまい、凸数と表示が一致していなかった。
// 仕様の凸数を1つずつ並べて、色と個数を機械的に突き合わせる。
const fs = require('fs');
const path = require('path');

const { REPO_ROOT, loadDyeModule } = require('./harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/game-system.compiled.js'), 'utf8')
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const {
  breakthroughStars, isFinalBreakthroughCount,
  BREAKTHROUGH_STAR_TIERS, BREAKTHROUGH_STARS_PER_TIER, BREAKTHROUGH_MAX_COUNT,
  BREAKTHROUGH_FINAL_LEVEL_CAP, FINAL_BREAKTHROUGH_COUNT, RAINBOW_STAR_COLORS,
  MAX_MASU_LEVEL_CAP, INITIAL_MASU_LEVEL_CAP, BREAKTHROUGH_LEVEL_CAP_GAIN,
  buildMasuBreakthrough, normalizeMasuProgression, totalBondXpForLevel, masuRebirthCost,
} = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== 1. 段階の並び =====
check('段階は 青→黄→ピンク→紫→赤→金 の6段階',
  BREAKTHROUGH_STAR_TIERS.map(t => t.key).join(',') === 'blue,yellow,pink,purple,red,gold',
  BREAKTHROUGH_STAR_TIERS.map(t => t.key).join(','));
check('1段階は5凸で完成する', BREAKTHROUGH_STARS_PER_TIER === 5);
check('通常の限界突破は30回まで', BREAKTHROUGH_MAX_COUNT === 30, String(BREAKTHROUGH_MAX_COUNT));
check('最終限界突破は31回目', FINAL_BREAKTHROUGH_COUNT === 31, String(FINAL_BREAKTHROUGH_COUNT));
check('虹は5色ぶん用意されている', Array.isArray(RAINBOW_STAR_COLORS) && RAINBOW_STAR_COLORS.length === 5);
check('虹の5個は全部ちがう色（小さくても見分けられる）', new Set(RAINBOW_STAR_COLORS).size === 5);
// 黄色と金が見分けにくくならないこと
const yellow = BREAKTHROUGH_STAR_TIERS.find(t => t.key === 'yellow');
const gold = BREAKTHROUGH_STAR_TIERS.find(t => t.key === 'gold');
check('黄色と金は違う色', yellow.color.toLowerCase() !== gold.color.toLowerCase(), `黄=${yellow.color} 金=${gold.color}`);
check('黄色には光沢を付けない', !/0 0 \d+px/.test(yellow.shadow), yellow.shadow);
check('金は金属的な縁取りを持つ', /0 -1px 0/.test(gold.shadow) && /0 1px 0/.test(gold.shadow), gold.shadow);
check('金は暗金・明金・白金の静的グラデーションを持つ',
  /linear-gradient/.test(gold.background || '') && /#fff/.test(gold.background) && /#7a3d05/.test(gold.background), gold.background);
check('金は濃い輪郭を持つ', /#6b3605/.test(gold.stroke || ''), gold.stroke);

// ===== 2. 凸数ごとの表示（仕様の確認項目をそのまま並べる） =====
const nameOf = { blue:'青', yellow:'黄色', pink:'ピンク', purple:'紫', red:'赤', gold:'金', rainbow:'虹' };
// 「青4」のように、色ごとの並びを人が読める文字列にする
const describe = (count) => {
  const stars = breakthroughStars(count);
  if (!stars.length) return 'なし';
  if (stars[0].key === 'rainbow') return `虹★${stars.length}`;
  const parts = [];
  for (const s of stars) {
    const last = parts[parts.length - 1];
    if (last && last.key === s.key) last.n++;
    else parts.push({ key: s.key, n: 1 });
  }
  return parts.map(p => `${nameOf[p.key]}★${p.n}`).join(' + ');
};
const expected = [
  [0,  'なし'],
  [1,  '青★1'],
  [5,  '青★5'],
  [6,  '黄色★1 + 青★4'],
  [10, '黄色★5'],
  [11, 'ピンク★1 + 黄色★4'],
  [15, 'ピンク★5'],
  [16, '紫★1 + ピンク★4'],
  [20, '紫★5'],
  [21, '赤★1 + 紫★4'],
  [25, '赤★5'],
  [26, '金★1 + 赤★4'],
  [30, '金★5'],
  [31, '虹★5'],
];
for (const [count, want] of expected) {
  const got = describe(count);
  check(`${count}凸 = ${want}`, got === want, got === want ? '' : `実際は ${got}`);
}
// 1〜30凸のどこでも星は5個以内。1段階目だけは凸数ぶんしか出さない
let countOk = true, countNg = '';
for (let n = 1; n <= BREAKTHROUGH_MAX_COUNT; n++) {
  const len = breakthroughStars(n).length;
  const want = n < BREAKTHROUGH_STARS_PER_TIER ? n : BREAKTHROUGH_STARS_PER_TIER;
  if (len !== want) { countOk = false; countNg = `${n}凸で${len}個(期待${want})`; break; }
}
check('1〜30凸のどこでも★の個数が仕様どおり', countOk, countNg);
// 5凸ごとに1段階ずつ進み、色が飛ばない
let tierOk = true, tierNg = '';
for (let n = 1; n <= BREAKTHROUGH_MAX_COUNT; n++) {
  const want = BREAKTHROUGH_STAR_TIERS[Math.floor((n - 1) / BREAKTHROUGH_STARS_PER_TIER)].key;
  if (breakthroughStars(n)[0].key !== want) { tierOk = false; tierNg = `${n}凸の先頭が${breakthroughStars(n)[0].key}(期待${want})`; break; }
  const rest = breakthroughStars(n).slice(((n - 1) % BREAKTHROUGH_STARS_PER_TIER) + 1);
  if (rest.length && rest.some(s => s.key !== BREAKTHROUGH_STAR_TIERS[Math.floor((n - 1) / BREAKTHROUGH_STARS_PER_TIER) - 1].key)) {
    tierOk = false; tierNg = `${n}凸の残りが1つ前の色でない`; break;
  }
}
check('5凸ごとに段階が進み、残りは1つ前の色', tierOk, tierNg);
check('最終段階の判定', isFinalBreakthroughCount(30) === false && isFinalBreakthroughCount(31) === true);
// 旧仕様で31回を超えて進めていた個体も虹で出す(壊れた表示にしない)
check('31回を超えていても虹★5', describe(34) === '虹★5' && describe(99) === '虹★5');
check('おかしな値でも落ちない',
  breakthroughStars(null).length === 0 && breakthroughStars(-3).length === 0
  && breakthroughStars('あ').length === 0 && breakthroughStars(2.7).length === 2);

// ===== 3. レベル上限 =====
check('初期のレベル上限はLv.30', INITIAL_MASU_LEVEL_CAP === 30);
check('通常の限界突破は上限+5', BREAKTHROUGH_LEVEL_CAP_GAIN === 5);
check('30凸時点の上限はLv.180', BREAKTHROUGH_FINAL_LEVEL_CAP === 180, String(BREAKTHROUGH_FINAL_LEVEL_CAP));
check('最終上限はLv.200', MAX_MASU_LEVEL_CAP === 200);

// 実際に限界突破を30回＋最終1回まわして、回数と上限が仕様どおり進むかを見る
const makeMasu = (levelCap, rebirthCount) => ({
  id: 'x', baseId: 'Golem', name: 'テスト',
  bondXp: totalBondXpForLevel(levelCap), levelCap, rebirthCount, reincarnateCount: 0,
  statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptPoints: 0,
  uniqueSkillLevels: { own: 0 }, inheritedUniques: [], fusionHistory: [],
});
let masu = makeMasu(INITIAL_MASU_LEVEL_CAP, 0);
const caps = [];
let steps = 0, buildFail = '';
while (steps < 40) {
  // 虹のプシュケーはここでは見ないので、必ず足りる数を渡す(専用の検査は breakthrough-item-check.js)
  const result = buildMasuBreakthrough({ masu, skillKey: 'own', gold: 9_999_999, psycheOwned: 9_999_999 });
  if (!result.ok) { buildFail = result.reason; break; }
  masu = { ...result.nextMasu, bondXp: totalBondXpForLevel(result.nextMasu.levelCap), uniqueSkillLevels: { own: 0 } };
  caps.push([masu.rebirthCount, masu.levelCap, result.finalBreakthrough === true]);
  steps++;
}
const at = (n) => caps.find(c => c[0] === n);
check('1凸で上限Lv.35', at(1) && at(1)[1] === 35, at(1) ? `Lv.${at(1)[1]}` : 'なし');
check('30凸で上限Lv.180', at(30) && at(30)[1] === 180, at(30) ? `Lv.${at(30)[1]}` : 'なし');
check('30凸までは通常の限界突破', caps.filter(c => c[0] <= 30).every(c => c[2] === false));
check('31凸で上限Lv.200', at(31) && at(31)[1] === 200, at(31) ? `Lv.${at(31)[1]}` : 'なし');
check('31凸だけが最終限界突破', at(31) && at(31)[2] === true);
check('31凸で打ち止め（32回目はできない）', caps.length === 31 && /Lv\.200/.test(buildFail),
  `${caps.length}回で停止 / 理由=${buildFail}`);
check('30凸→31凸で上限が一気に+20', at(30) && at(31) && at(31)[1] - at(30)[1] === 20);
check('31凸の★は虹', describe(31) === '虹★5');

// 旧仕様で上限Lv.185〜195まで進んでいた個体も、次の1回でLv.200へ入れる（壊さない）
for (const legacyCap of [185, 190, 195]) {
  const legacy = makeMasu(legacyCap, 31);
  const r = buildMasuBreakthrough({ masu: legacy, skillKey: 'own', gold: 9_999_999, psycheOwned: 9_999_999 });
  check(`旧データ(上限Lv.${legacyCap})も最終限界突破でLv.200へ`, r.ok && r.nextMasu.levelCap === 200 && r.finalBreakthrough === true,
    r.ok ? `Lv.${r.nextMasu.levelCap}` : r.reason);
}
check('上限Lv.200の個体はもう限界突破できない',
  buildMasuBreakthrough({ masu: makeMasu(200, 31), skillKey: 'own', gold: 9_999_999, psycheOwned: 9_999_999 }).ok === false);
// 既存の保存値をそのまま使う(表示用の項目を増やしていない)
check('★のために保存する項目を増やしていない',
  !/starTier|starColor|rebirthTier|breakthroughTier/.test(source));
check('保存キーの名前を変えていない', source.includes("'mh_masu_mons'") && /rebirthCount/.test(source));

// ===== 4. 画面側 =====
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  check(`${label}: ★の組み立ては共通実装1か所`,
    (code.match(/const breakthroughStars = /g) || []).length === 1
    && (code.match(/breakthroughStars\(/g) || []).length >= 2);
  // 配信用JSでは引数の分解が改行されるので、空白をまたいで見る
  check(`${label}: 星を描く実装は RebirthStars だけ`,
    /const RebirthStars = \(\{\s*count = 0,\s*className = ''\s*\}\)/.test(code)
    && /const stars = breakthroughStars\(value\);/.test(code)
    && !/Math\.floor\(\(value - 1\) \/ 5\) % 4/.test(code));
  check(`${label}: 演出でも同じ色を使う`, /starList\.map\(\(s,i\)=>/.test(code) || /starList\.map\(\(s, i\) =>/.test(code));
  check(`${label}: 限界突破の説明に最終突破がある`, code.includes('最終限界突破'));
  check(`${label}: 最終突破ではLv.200へ上げる`,
    /const isFinal = normalized\.levelCap >= BREAKTHROUGH_FINAL_LEVEL_CAP;/.test(code)
    && /isFinal[\s\S]{0,80}MAX_MASU_LEVEL_CAP/.test(code));
  check(`${label}: デバッグ画面も共通の RebirthStars を使う`,
    code.includes("gameState==='BREAKTHROUGH_STAR_DEBUG'") || code.includes("gameState === 'BREAKTHROUGH_STAR_DEBUG'"));
  check(`${label}: デバッグ画面に指定された代表段階がある`,
    /\[0,\s*5,\s*10,\s*15,\s*20,\s*25,\s*30,\s*31\]/.test(code)
    && /\[1,\s*6,\s*11,\s*16,\s*21,\s*26\]/.test(code)
    && /\[10,\s*30,\s*31\]/.test(code));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
