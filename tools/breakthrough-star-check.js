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
  BREAKTHROUGH_FINAL_LEVEL_CAP, FINAL_BREAKTHROUGH_COUNT, RAINBOW_STAR_IMAGE,
  breakthroughLevelCap, levelUpPointMultiplier,
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
check('最終限界突破は35回目', FINAL_BREAKTHROUGH_COUNT === 35, String(FINAL_BREAKTHROUGH_COUNT));
check('虹画像は指定された大文字拡張子のパスを使う', RAINBOW_STAR_IMAGE === 'images/ui/breakthrough-rainbow-star.PNG', RAINBOW_STAR_IMAGE);
const rainbowAssetPath = path.join(REPO_ROOT, 'monster-hero', RAINBOW_STAR_IMAGE);
check('虹画像アセットが実在する', fs.existsSync(rainbowAssetPath), rainbowAssetPath);
// 黄色と金が見分けにくくならないこと
const yellow = BREAKTHROUGH_STAR_TIERS.find(t => t.key === 'yellow');
const gold = BREAKTHROUGH_STAR_TIERS.find(t => t.key === 'gold');
check('黄色と金は違う色', yellow.color.toLowerCase() !== gold.color.toLowerCase(), `黄=${yellow.color} 金=${gold.color}`);
check('黄色には光沢を付けない', !/0 0 \d+px/.test(yellow.shadow), yellow.shadow);
check('金は金属的な縁取りを持つ', /0 -1px 0/.test(gold.shadow) && /0 1px 0/.test(gold.shadow), gold.shadow);
check('金は暗金・明金・白金の静的グラデーションを持つ',
  /linear-gradient/.test(gold.background || '') && /#fff/.test(gold.background) && /#7a3d05/.test(gold.background), gold.background);
check('金は濃い輪郭を持つ', /#6b3605/.test(gold.stroke || ''), gold.stroke);
const rainbow = breakthroughStars(FINAL_BREAKTHROUGH_COUNT);
check('虹5個はすべて同じ専用画像を使う', rainbow.every(star => star.imageSrc === RAINBOW_STAR_IMAGE));

// ===== 2. 凸数ごとの表示（仕様の確認項目をそのまま並べる） =====
const nameOf = { blue:'青', yellow:'黄色', pink:'ピンク', purple:'紫', red:'赤', gold:'金', rainbow:'虹' };
// 「青4」のように、色ごとの並びを人が読める文字列にする
const describe = (count) => {
  const stars = breakthroughStars(count);
  if (!stars.length) return 'なし';
  if (stars[0].key === 'rainbow') return `虹★${stars.filter(s=>s.key==='rainbow').length}+金★${stars.filter(s=>s.key==='gold').length}`;
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
  [31, '虹★1+金★4'],
  [32, '虹★2+金★3'],
  [33, '虹★3+金★2'],
  [34, '虹★4+金★1'],
  [35, '虹★5+金★0'],
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
check('最終段階の判定', isFinalBreakthroughCount(34) === false && isFinalBreakthroughCount(35) === true);
// 旧仕様で31回を超えて進めていた個体も虹で出す(壊れた表示にしない)
check('35回を超えていても虹★5', describe(35) === '虹★5+金★0' && describe(99) === '虹★5+金★0');
check('おかしな値でも落ちない',
  breakthroughStars(null).length === 0 && breakthroughStars(-3).length === 0
  && breakthroughStars('あ').length === 0 && breakthroughStars(2.7).length === 2);

// ===== 3. レベル上限 =====
check('初期のレベル上限はLv.30', INITIAL_MASU_LEVEL_CAP === 30);
check('通常の限界突破は上限+5', BREAKTHROUGH_LEVEL_CAP_GAIN === 5);
check('30凸時点の上限はLv.180', BREAKTHROUGH_FINAL_LEVEL_CAP === 180, String(BREAKTHROUGH_FINAL_LEVEL_CAP));
check('最終上限はLv.400', MAX_MASU_LEVEL_CAP === 400);
check('31～35凸の固定上限', [180,200,230,270,330,400].every((cap,i)=>breakthroughLevelCap(30+i)===cap));
check('LvUP倍率は33凸以下×1・34凸×2・35凸×3', levelUpPointMultiplier(33)===1 && levelUpPointMultiplier(34)===2 && levelUpPointMultiplier(35)===3);

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
check('31～35凸の上限が固定表どおり', [31,32,33,34,35].every(n => at(n) && at(n)[1] === breakthroughLevelCap(n)));
check('35凸だけが最終限界突破', at(35) && at(35)[2] === true && [31,32,33,34].every(n => !at(n)[2]));
check('35凸で打ち止め（36回目はできない）', caps.length === 35 && /Lv\.400/.test(buildFail), buildFail);
check('既存31凸データは31凸・Lv200のまま', normalizeMasuProgression(makeMasu(200,31)).rebirthCount === 31 && normalizeMasuProgression(makeMasu(200,31)).levelCap === 200);
check('31～35凸の★が金から虹へ1個ずつ置換', [31,32,33,34,35].every(n => breakthroughStars(n).filter(star=>star.key==='rainbow').length === n-30));
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
  check(`${label}: 演出でも同じ星部品を使う`, /starList\.map\(\(s,i\)=>/.test(code) || /starList\.map\(\(s, i\) =>/.test(code));
  check(`${label}: 本番・デバッグ・限界突破演出は共通の星部品を使う`,
    (code.match(/BreakthroughStarGlyph/g) || []).length >= 3
    && (/\<RebirthStars count=\{count\}/.test(code) || /React\.createElement\(RebirthStars/.test(code)));
  check(`${label}: 虹画像は固定スロット内で縦横比を保つ`,
    code.includes('.mh-rebirth-star-slot{display:inline-flex;flex:0 0 1em;width:1em;height:1em')
    && code.includes('.mh-rebirth-star-image{display:block;width:100%;height:100%;object-fit:contain}'));
  check(`${label}: 限界突破の説明に虹5段階がある`, code.includes('31～35凸'));
  check(`${label}: 固定上限の共通関数を使う`,
    /const isFinal = nextCount === FINAL_BREAKTHROUGH_COUNT;/.test(code)
    && /const nextLevelCap = breakthroughLevelCap\(nextCount\)/.test(code));
  check(`${label}: デバッグ画面も共通の RebirthStars を使う`,
    code.includes("gameState==='BREAKTHROUGH_STAR_DEBUG'") || code.includes("gameState === 'BREAKTHROUGH_STAR_DEBUG'"));
  check(`${label}: デバッグ画面に指定された代表段階がある`,
    /\[0,\s*5,\s*10,\s*15,\s*20,\s*25,\s*30,\s*31,\s*32,\s*33,\s*34,\s*35\]/.test(code)
    && /\[1,\s*6,\s*11,\s*16,\s*21,\s*26\]/.test(code)
    && /\[10,\s*30,\s*35\]/.test(code));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
