const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 与ダメージの「予測表示」と「実処理」が同じヒット列(同じ合計)になることを、乱数を固定して確かめる。
//
//   node tools/battle/damage-parity-check.js
//
// 【なぜ要るか】
// 予測(getAttackPredictedDmg)と実処理(processTurn の攻撃ブロック)は、勇者特性・固有技の連撃・全体連撃を
// 別々に書いている(docs/refactor/BATTLE_DAMAGE_MAP.md)。片方だけ直すと「予測と実際が違う」になる。
// 一本化(STEP 5)の前後で等価であることを固定するため、本体から両方を切り出し、同じ入力で回して比べる。
//
// 【見かた】
// ・会心の乱数は Math.random を差し替えて固定する(会心なし / 確定会心)。予測は乱数会心を乗せない仕様なので、
//   「会心なし」と「guaranteedCrit」の2通りで一致すればよい
// ・贖罪の追撃(アーク・イブリースの固有技)は実処理側では固有技の効果ブロックの中にあり、ここでは切り出さない。
//   予測側の floor(mainDmg×0.2) を差し引いて比べる
const fs = require('fs');
const path = require('path');
const { GAME_SYSTEM, loadDyeModule } = require(path.join(TOOLS_DIR, 'harness'));
// 魂格(masu)の攻撃プロフィールは、予測・実処理の両方が使うようになった。
// 本体から切り出した関数へ本物を渡す(ここで作るモンスターは masuId を持たないので
// getMasuMon は呼ばれず、魂格なし=素の値で比べることになる)
const soulTraitAttackProfile = loadDyeModule().soulTraitAttackProfile;
const getMasuMon = () => null;

const source = fs.readFileSync(GAME_SYSTEM, 'utf8');
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const slice = (from, to, fromIndex = 0) => {
  const i = source.indexOf(from, fromIndex); if (i < 0) throw new Error(`見つからない: ${from}`);
  const j = source.indexOf(to, i); if (j < 0) throw new Error(`見つからない: ${to}`);
  return { text: source.slice(i, j), start: i, end: j };
};

// --- 予測: useCallback の中の関数だけを取り出す ---
const pred = slice('const getAttackPredictedDmg = useCallback(', ', [mainHero, turnBuffs, permaBuffs]);');
const predictedArrow = pred.text.slice('const getAttackPredictedDmg = useCallback('.length);
// 共通の正本(buildAttackHits / attackAtonementDmg)も本体から取り出す
const rules = slice('const ATTACK_COMBO_RULES = Object.freeze({', '\n// 贖罪の追撃(アーク・イブリースの固有技)');
// attackAtonementDmg は1行から複数行の関数になったので、閉じの「};」まで取り出す
const atoneStart = source.indexOf('const attackAtonementDmg =');
const atone = source.slice(atoneStart, source.indexOf('\n};', atoneStart) + 3);
const shared = Function(`${rules.text}\n${atone}\nreturn { buildAttackHits, attackAtonementDmg, ATTACK_COMBO_RULES };`)();
const makePredicted = (mainHero, getPermaBuff, getTurnBuff) => Function('mainHero', 'getPermaBuff', 'getTurnBuff', 'Math', 'buildAttackHits', 'attackAtonementDmg', 'soulTraitAttackProfile', 'getMasuMon', `return (${predictedArrow});`)(mainHero, getPermaBuff, getTurnBuff, Math, shared.buildAttackHits, shared.attackAtonementDmg, soulTraitAttackProfile, getMasuMon);

// --- 実処理: processTurn の攻撃ブロック(会心判定 〜 全体連撃)を取り出す ---
const anchor = source.indexOf("const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist)");
if (anchor < 0) throw new Error('processTurn の攻撃ブロックが見つからない');
const act = slice("const soulAttack=soulTraitAttackProfile(activeMon?.masuId?getMasuMon(activeMon.masuId):null,card,slotIdx);", 'if (rangeMoveTarget!=null)', anchor);
const makeActual = (rng) => Function('d', 'card', 'activeMon', 'mainHero', 'getPermaBuff', 'getTurnBuff', 'localGlobalComboAdd', 'slotIdx', 'Math', 'buildAttackHits', 'soulTraitAttackProfile', 'getMasuMon', `
  let totalDmg = 0, hasCrit = false; const attackHits = [];
  ${act.text}
  return { totalDmg, attackHits, hasCrit };
`)
  .bind(null);
const mathWith = (random) => Object.assign(Object.create(Math), { random, floor: Math.floor, max: Math.max, min: Math.min });

check('予測と実処理の両方が共通の buildAttackHits を使っている', predictedArrow.includes('buildAttackHits(') && act.text.includes('buildAttackHits('));

const heroes = ['Zan', 'Eiki', 'Pandora', 'KenshiMocchi', 'Ark', 'Golem'];
const uniqueOwners = ['Zan', 'Eiki', 'Pandora', 'KenshiMocchi', 'Ark', 'Iblis', 'Suezo'];
const cards = [{ type: 'atk' }, { type: 'range_atk', rangeIdx: 1 }, ...uniqueOwners.map(id => ({ type: 'unique', monId: id }))];
let cases = 0; const mismatches = [];
for (const heroId of heroes) for (const attackerId of [heroId, 'Suezo']) for (const card of cards)
  for (const d of [100, 333]) for (const combo of [0, 0.05]) for (const global of [0, 0.1]) for (const localGlobal of [0, 0.03])
    for (const critMode of ['none', 'guaranteed']) for (const extra of [0, 2]) {
      // 剣士モッチーの永久追加連撃(ソードスキルで増える本数)も、予測と実処理の両方へ同じ数が
      // 渡っていなければならない。0本と2本の両方を回す(組み合わせは extra で分ける)
      const perma = { comboDmgPct: combo, globalComboDmgPct: global, critDmgPct: 0.1, critRatePct: 0, kenshiExtraCombo: extra };
      const turn = { guaranteedCrit: critMode === 'guaranteed' };
      const getPermaBuff = (k, def = 0) => (k in perma ? perma[k] : def);
      const getTurnBuff = (k, def) => (k in turn ? turn[k] : def);
      const mainHero = { id: heroId }; const mon = { id: attackerId };
      const predicted = makePredicted(mainHero, getPermaBuff, getTurnBuff)(card, mon, d, localGlobal);
      const M = mathWith(() => 1); // 乱数会心は起きない(guaranteedCrit だけが会心)
      const actual = makeActual()(d, card, mon, mainHero, getPermaBuff, getTurnBuff, localGlobal, 1, M, shared.buildAttackHits, soulTraitAttackProfile, getMasuMon);
      // 贖罪の追撃は予測にだけ入っている(実処理では固有技の効果ブロック側)
      const atonement = card.type === 'unique' && (card.monId === 'Ark' || card.monId === 'Iblis')
        ? Math.floor((() => { const split = heroId === 'Pandora' && attackerId === 'Pandora' && ['atk', 'range_atk'].includes(card.type); const mb = split ? Math.floor(d * 0.5) : d; return turn.guaranteedCrit ? Math.floor(mb * 1.6) : mb; })() * 0.2)
        : 0;
      cases++;
      if (predicted - atonement !== actual.totalDmg) mismatches.push(`${heroId}/${attackerId}/${card.type}${card.monId ? ':' + card.monId : ''} d=${d} combo=${combo} global=${global}+${localGlobal} ${critMode}: 予測${predicted - atonement} ≠ 実${actual.totalDmg}`);
    }
check(`乱数を固定すると予測と実処理の合計が一致する(${cases} 通り)`, mismatches.length === 0, mismatches.slice(0, 5).join(' / '));

// ヒット列の順序(メイン → 連撃 → 全体連撃)と本数の代表例
{
  const perma = { comboDmgPct: 0, globalComboDmgPct: 0.1, critDmgPct: 0, critRatePct: 0 };
  const getPermaBuff = (k, def = 0) => (k in perma ? perma[k] : def); const getTurnBuff = (k, def) => def;
  const hits = makeActual()(100, { type: 'unique', monId: 'Eiki' }, { id: 'Eiki' }, { id: 'Eiki' }, getPermaBuff, getTurnBuff, 0, 1, mathWith(() => 1), shared.buildAttackHits, soulTraitAttackProfile, getMasuMon).attackHits;
  const names = hits.map(h => h.skillName || 'main').join(',');
  check('エイキ勇者の固有技: メイン → 桜花連舞×2 → +30% → 緋桜連華×2 → 全体連撃 の順と本数', hits.length === 7 && hits[0].dmg === 100, names);
}


// --- あつの挑発(stun_atsu): メインに会心が乗らない以外は同じヒット列 ---
// processTurn のバフ・デバフ側ブロックを取り出し、通常攻撃と同じ buildAttackHits(mainCanCrit:false)を通していることと、
// 乱数を固定したときの合計が「予測の合計」と一致すること(確定会心のときだけ、メイン分の会心差が出る)を確かめる。
{
  const stun = slice("const stunMon=slots[slotIdx];", "else if (card.subType==='buff_myaru')");
  check('あつの挑発も buildAttackHits を通し、メインの会心だけ無し(mainCanCrit:false)にしている',
    stun.text.includes('buildAttackHits({') && stun.text.includes('mainCanCrit:false') && !stun.text.includes('stunComboRates'));
  check('予測表示も同じ条件でメインの会心を外している', predictedArrow.includes("mainCanCrit:card.subType!=='stun_atsu'"));
  // 切り出した範囲は else-if ブロックの閉じ } で終わるので、その 1 文字だけ落として関数本体にする
  const makeStun = () => Function('d0', 'card', 'stunMon0', 'mainHero', 'getPermaBuff', 'getTurnBuff', 'localGlobalComboAdd', 'slotIdx', 'Math', 'buildAttackHits', 'soulTraitAttackProfile', 'getMasuMon', `
    let totalDmg = 0, hasCrit = false, attackCount = 0; const attackHits = [];
    const slots = { [slotIdx]: stunMon0 }; const effMul = 1; const localOryoAdd = 0, localDmgModAdd = 0;
    const getDmg = () => d0; const setImmediateTurnBuff = () => {};
    ${stun.text.replace(/\}\s*$/, '')}
    return { totalDmg, attackHits, hasCrit, attackCount };
  `);
  let stunCases = 0; const stunMismatches = [];
  const stunCard = { type: 'debuff', subType: 'stun_atsu', baseValue: 1.5 };
  for (const heroId of heroes) for (const attackerId of [heroId, 'Suezo'])
    for (const d of [100, 333]) for (const combo of [0, 0.05]) for (const global of [0, 0.1]) for (const localGlobal of [0, 0.03])
      for (const critMode of ['none', 'guaranteed']) for (const extra of [0, 2]) {
        // あつの挑発でも、剣士モッチーの永久追加連撃の本数は予測と実処理へ同じ数が渡る
        const perma = { comboDmgPct: combo, globalComboDmgPct: global, critDmgPct: 0.1, critRatePct: 0, kenshiExtraCombo: extra };
        const turn = { guaranteedCrit: critMode === 'guaranteed' };
        const getPermaBuff = (k, def = 0) => (k in perma ? perma[k] : def);
        const getTurnBuff = (k, def) => (k in turn ? turn[k] : def);
        const mainHero = { id: heroId }; const mon = { id: attackerId };
        const actual = makeStun()(d, stunCard, mon, mainHero, getPermaBuff, getTurnBuff, localGlobal, 1, mathWith(() => 1), shared.buildAttackHits, soulTraitAttackProfile, getMasuMon);
        const predicted = makePredicted(mainHero, getPermaBuff, getTurnBuff)(stunCard, mon, d, localGlobal);
        // 予測側も mainCanCrit:false を渡すので、確定会心のときもメインには会心が乗らず、実処理と完全に一致する
        const knownGap = 0;
        // 実処理・予測と同じ引数で呼ぶ。永久追加連撃の本数(kenshiExtraCombos)を渡し忘れると、
        // ここだけ剣士モッチーの追撃が抜けて「実と予測は合っているのに直接だけ足りない」になる
        const direct = shared.buildAttackHits({ d, card: stunCard, attackerId, heroId, comboDmgBonus: combo, critDmgBonus: 0.1, guaranteedCrit: turn.guaranteedCrit, rollCrit: () => false, globalComboRate: global + localGlobal, mainCanCrit: false, kenshiExtraCombos: extra });
        stunCases++;
        if (actual.totalDmg !== predicted - knownGap || actual.totalDmg !== direct.reduce((s, h) => s + h.dmg, 0)
          || actual.attackHits[0].isCrit !== false || actual.attackCount !== 1)
          stunMismatches.push(`${heroId}/${attackerId} d=${d} combo=${combo} global=${global}+${localGlobal} ${critMode}: 実${actual.totalDmg} 予測${predicted} 直接${direct.reduce((s, h) => s + h.dmg, 0)}`);
      }
  check(`あつの挑発: 乱数を固定すると実処理の合計が予測と一致し、メインは会心なし(${stunCases} 通り)`, stunMismatches.length === 0, stunMismatches.slice(0, 5).join(' / '));
  const perma = { comboDmgPct: 0, globalComboDmgPct: 0.1, critDmgPct: 0, critRatePct: 0 };
  const getPermaBuff = (k, def = 0) => (k in perma ? perma[k] : def);
  const zan = makeStun()(100, stunCard, { id: 'Zan' }, { id: 'Zan' }, getPermaBuff, (k, def) => def, 0, 1, mathWith(() => 1), shared.buildAttackHits, soulTraitAttackProfile, getMasuMon).attackHits;
  check('あつの挑発(ザン勇者): メイン → 連撃 30% → 全体連撃(noAnim)の順で 3 ヒット',
    zan.length === 3 && zan[0].dmg === 100 && zan[1].skillName === '連撃' && zan[1].dmg === 30 && zan[2].skillName === '全体連撃' && zan[2].dmg === 10 && zan[2].noAnim === true);
  const eiki = makeStun()(100, stunCard, { id: 'Eiki' }, { id: 'Eiki' }, getPermaBuff, (k, def) => def, 0, 1, mathWith(() => 1), shared.buildAttackHits, soulTraitAttackProfile, getMasuMon).attackHits;
  check('あつの挑発(エイキ勇者): メイン → 連撃 10%×2 → 全体連撃の 4 ヒット(固有技ぶんの 30% は付かない)',
    eiki.length === 4 && eiki[1].dmg === 10 && eiki[2].dmg === 10 && eiki[3].skillName === '全体連撃');
}
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
