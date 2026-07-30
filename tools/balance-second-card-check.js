// バランス調整の検証:
//   ① 同じターンの2枚目以降のカードは効果半減(ブリーダーカードは対象外・ガードも半減)
//   ② かどみうむカードの効果量(CADMIUM_TIERS)と、そこから作られる説明文
// 効果量と説明文は実際の定義・関数をNode上で動かして確かめ、画面側の結線はソースで確認する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const breeder = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- ① 2枚目以降の効果半減 ---

// 「何枚目か」の数え方を実際の定義で動かす
const ctx = { TEACHING_CARDS: [{ id: 'oryo' }, { id: 'dra' }, { id: 'cadmium' }, { id: 'mua' }, { id: 'atsu' }, { id: 'myaru' }] };
vm.createContext(ctx);
const isBreederSrc = source.match(/const isBreederCard = [^\n]+/);
check('ブリーダーカード判定の定義がある', !!isBreederSrc);
vm.runInContext(`${isBreederSrc[0]}\nglobalThis.__f = isBreederCard;`, ctx);
const isBreederCard = ctx.__f;

// 実処理と同じ数え方を再現し、どのカードが半減になるかを確かめる
const halveFlags = (cards) => {
  let n = 0;
  return cards.map(c => {
    const breeder = isBreederCard(c);
    const halved = !breeder && n > 0;
    if (!breeder) n++;
    return halved;
  });
};
const atk = { type: 'atk' }, guard = { type: 'guard' }, uniq = { type: 'unique' }, oryo = { id: 'oryo', type: 'buff' };

check('ブリーダーカードを見分けられる', isBreederCard(oryo) === true && isBreederCard(atk) === false);
check('1枚だけなら半減しない', halveFlags([atk]).join() === 'false');
check('攻撃2枚なら2枚目が半減', halveFlags([atk, atk]).join() === 'false,true');
check('攻撃3枚なら2枚目以降が半減', halveFlags([atk, atk, uniq]).join() === 'false,true,true');
check('ガードも半減の対象(攻撃→ガード)', halveFlags([atk, guard]).join() === 'false,true');
check('ガードが先でも2枚目の攻撃は半減', halveFlags([guard, atk]).join() === 'false,true');
check('ブリーダーカードは何枚目でも半減しない', halveFlags([atk, oryo]).join() === 'false,false');
check('ブリーダーカードは枚数に数えない', halveFlags([oryo, atk]).join() === 'false,false');
check('ブリーダーカードを挟んでも攻撃の順番は変わらない', halveFlags([atk, oryo, atk]).join() === 'false,false,true');

// 画面側の結線
check('processTurnで2枚目以降を判定している',
  has('const halved=!isBreeder&&penaltyCardCount>0;') && has('const effMul=halved?0.5:1;'));
check('ブリーダーカードは枚数に数えない(実処理)', has('if(!isBreeder) penaltyCardCount++;'));
check('ガードの軽減量を半減する',
  has('currentTurnGuardFlat+=GUARD_EVOLUTION[guardLevel].flat*effMul') && has('currentTurnGuardMult+=GUARD_EVOLUTION[guardLevel].mult*effMul'));
check('弱ガードも同じ扱い', has('GUARD_EVOLUTION[guardLevel].flat*0.5*effMul'));
check('攻撃ダメージの半減が枚数基準になっている',
  has('getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist)') && !has('localDmgModAdd,attackCount>0,attackStartDist'));
check('あつの挑発(ブリーダーカード)の攻撃は半減しない', has('getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false)'));
check('固有技の数値効果も半減する',
  has("addPermaBuff('dmgCutPct',0.03*effMul)") && has("addPermaBuff('atkPct',0.1*effMul)")
    && has("addPermaBuff('comboDmgPct',0.03*effMul)") && has('effectiveMaxGuts*0.5*effMul')
    && has("addPermaBuff('critRatePct',0.02*effMul)") && has("addWaveBuff('enemyAtkDebuffPct',0.10*effMul)"));
check('半減したことを画面に出す', has("addPopup('2枚目以降 効果半減'"));
check('ダメージ予測も同じ数え方を使う',
  has('let committedTotal=0; let committedPenaltyCnt=0;') && has('const isPenalty=!isBreederCard(card);')
    && has('let globalPenaltyCnt=0;'));
check('攻撃だけを数える古い判定が残っていない',
  !has('committedAtkCnt') && !has('globalAtkCnt') && !has('let committedAtk=0;'));
check('ヘルプに2枚目以降の説明がある', has('2枚目以降で使ったカードは、ダメージもガードも効果が半分'));

// --- ② かどみうむ ---
const cadCtx = {};
vm.createContext(cadCtx);
const tiersSrc = breeder.slice(breeder.indexOf('const CADMIUM_TIERS'), breeder.indexOf('const TEACHING_CARDS'));
vm.runInContext(`${tiersSrc}\nglobalThis.__t = CADMIUM_TIERS;`, cadCtx);
const tiers = cadCtx.__t;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('計算: ガッツ自動回復0.5%のみ', same(tiers[0], { autoHp: 0, autoGuts: 0.005, hpLimit: 0, gutsLimit: 0 }), JSON.stringify(tiers[0]));
check('理論: ライフ/ガッツ自動回復0.5%・上限5%', same(tiers[1], { autoHp: 0.005, autoGuts: 0.005, hpLimit: 0.05, gutsLimit: 0.05 }), JSON.stringify(tiers[1]));
check('叡智: ライフ/ガッツ自動回復1%・上限7%', same(tiers[2], { autoHp: 0.01, autoGuts: 0.01, hpLimit: 0.07, gutsLimit: 0.07 }), JSON.stringify(tiers[2]));

// 説明文は本番のgetDynamicDescをそのまま動かす
const descCtx = { CADMIUM_TIERS: tiers };
vm.createContext(descCtx);
const descStart = source.indexOf('const getDynamicDesc');
const descEnd = source.indexOf('const getFullEvolutionDetails');
vm.runInContext(`${source.slice(descStart, descEnd)}\nglobalThis.__d = getDynamicDesc;`, descCtx);
const desc = (level) => descCtx.__d({ id: 'cadmium' }, true, level);

check('計算の説明文', desc(0) === 'ガッツ自動回復 0.5%アップ', desc(0));
check('理論の説明文', desc(1) === 'ライフ自動回復 0.5%アップ・ガッツ自動回復 0.5%アップ・ライフ/ガッツ上限 5%アップ', desc(1));
check('叡智の説明文', desc(2) === 'ライフ自動回復 1%アップ・ガッツ自動回復 1%アップ・ライフ/ガッツ上限 7%アップ', desc(2));
check('0.5%が四捨五入で1%にならない', !desc(0).includes('1%'));

// 他カードの説明文が小数表示で崩れていないこと
const otherDesc = (id, level, extra = {}) => descCtx.__d({ id, ...extra }, true, level);
check('おりょうの説明文は整数のまま', otherDesc('oryo', 0) === '攻撃 10%アップ' && otherDesc('oryo', 2) === '攻撃 30%アップ');
check('みゃるの説明文は整数のまま', otherDesc('myaru', 0, { baseValue: 2.0, step: 0.5, selfDmg: 0.5, dmgStep: 0.1 }) === '次ターン攻撃 2.0倍・自傷 50%');

// Lv0は上限アップが無くなったので、上限バフを積まないこと
check('計算では上限バフを積まない', has('if(tier.gutsLimit>0) addPermaBuff(\'muaGutsPct\',tier.gutsLimit)'));
check('計算のポップアップは回復アップ表記', has('tier.gutsLimit>0?`⚡ ガッツ上限UP!`:`⚡ ガッツ回復UP!`'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
