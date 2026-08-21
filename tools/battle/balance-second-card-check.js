const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バランス調整の検証:
//   ① 同じターンの2枚目以降のカードは効果半減(アシストカードは対象外・ガードも半減)
//   ② かどみうむカードの効果量(CADMIUM_TIERS)と、そこから作られる説明文
//   ③ みゃるの薬系の進化段階ごとの自傷率と表示
// 効果量と説明文は実際の定義・関数をNode上で動かして確かめ、画面側の結線はソースで確認する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
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
const isBreederSrc = source.match(/const isAssistCard = [^\n]+/);
check('アシストカード判定の定義がある', !!isBreederSrc);
vm.runInContext(`${isBreederSrc[0]}\nglobalThis.__f = isAssistCard;`, ctx);
const isAssistCard = ctx.__f;

// 実処理と同じ数え方を再現し、どのカードが半減になるかを確かめる
const halveFlags = (cards) => {
  let n = 0;
  return cards.map(c => {
    const breeder = isAssistCard(c);
    const halved = !breeder && n > 0;
    if (!breeder) n++;
    return halved;
  });
};
const atk = { type: 'atk' }, guard = { type: 'guard' }, uniq = { type: 'unique' }, oryo = { id: 'oryo', type: 'buff' };

check('アシストカードを見分けられる', isAssistCard(oryo) === true && isAssistCard(atk) === false);
check('1枚だけなら半減しない', halveFlags([atk]).join() === 'false');
check('攻撃2枚なら2枚目が半減', halveFlags([atk, atk]).join() === 'false,true');
check('攻撃3枚なら2枚目以降が半減', halveFlags([atk, atk, uniq]).join() === 'false,true,true');
check('ガードも半減の対象(攻撃→ガード)', halveFlags([atk, guard]).join() === 'false,true');
check('ガードが先でも2枚目の攻撃は半減', halveFlags([guard, atk]).join() === 'false,true');
check('アシストカードは何枚目でも半減しない', halveFlags([atk, oryo]).join() === 'false,false');
check('アシストカードは枚数に数えない', halveFlags([oryo, atk]).join() === 'false,false');
check('アシストカードを挟んでも攻撃の順番は変わらない', halveFlags([atk, oryo, atk]).join() === 'false,false,true');

// 画面側の結線
check('processTurnで2枚目以降を判定している',
  has('const halved=!isBreeder&&penaltyCardCount>0;')
    && has("const effMul=isBreeder&&specialRuleDifficulty?extremeSpecialRule(specialRuleDifficulty,'assistCardEffect'):(halved?0.5:1);"));
check('アシストカードは枚数に数えない(実処理)', has('if(!isBreeder) penaltyCardCount++;'));
check('ガードの軽減量を半減する',
  has('currentTurnGuardFlat+=GUARD_EVOLUTION[guardLevel].flat*effMul') && has('currentTurnGuardMult+=GUARD_EVOLUTION[guardLevel].mult*effMul'));
check('弱ガードも同じ扱い', has('GUARD_EVOLUTION[guardLevel].flat*0.5*effMul'));
// getDmgの引数は後ろへ増えることがある(絶氷の楔の判定を足した等)ので、
// 半減の判定に「攻撃枚数」ではなく halved を渡していることだけを見る
check('攻撃ダメージの半減が枚数基準になっている',
  /getDmg\(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist[,)]/.test(source)
    && !has('localDmgModAdd,attackCount>0,attackStartDist'));
check('あつの挑発(アシストカード)の攻撃は半減しない', has('getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false)'));
// 効果量そのものはバランス調整で変わるので、数字ではなく「*effMul が掛かっているか」を見る。
// (実際にゴーレムの闘志を 0.1 → 0.075 にしたときここが落ちた。見たいのは半減の結線であって
//  効果量ではないので、数字を書き写さない形にしてある)
const buffHalved = (fn, key) => new RegExp(`${fn}\\('${key}',[\\d.]+\\*effMul\\)`).test(source);
check('固有技の数値効果も半減する',
  buffHalved('addPermaBuff', 'dmgCutPct') && buffHalved('addPermaBuff', 'atkPct')
    && buffHalved('addPermaBuff', 'comboDmgPct') && has('effectiveMaxGuts*0.5*effMul')
    && buffHalved('addPermaBuff', 'critRatePct') && buffHalved('addWaveBuff', 'enemyAtkDebuffPct'));
check('半減したことを画面に出す', has("addPopup('2枚目以降 効果半減'"));
check('ダメージ予測も同じ数え方を使う',
  has('let committedTotal=0; let committedPenaltyCnt=0;') && has('const isPenalty=!isAssistCard(card);')
    && has('let globalPenaltyCnt=0;'));
check('攻撃だけを数える古い判定が残っていない',
  !has('committedAtkCnt') && !has('globalAtkCnt') && !has('let committedAtk=0;') && !has('assignedAttackCount'));

// 保留中(タップしただけでまだ置いていない)カードを自分自身で数えると、1枚目なのに半減表示になる
const pendingGuards = (source.match(/if\(idx===pendingIdx\) return;/g) || []).length;
check('予測は保留中のカードを枚数に数えない', pendingGuards >= 2, `${pendingGuards}か所`);
check('スロット予測も保留中のカードを除く', has('selectedCards.forEach(idx=>{if(idx!==pendingIdx&&!isAssistCard(hand[idx]))committedPenalty++;});'));
check('保留カードの判定にドラッグ中の手札位置も使う', has('dragState.cardIndex:null'));
check('半減マークは保留カード自身の判定で出す', has("{isPendingPreview&&isPendingHalved?'½ ':''}DMG:"));

// ガードの見え方
check('ガードの合計軽減を表示する', has('合計軽減') && has('const committedGuard=guardValueOf(guardFlat,guardMult);'));
check('合計軽減も置く前の予測を出す', has('const projectedGuard=') && has('showGuardProjected'));
// 表示と実処理が同じ丈夫さを見ていること。丈夫さのバフ(defPct)を入れたとき、
// 片方だけ実効値へ切り替えると「表示より実際のほうが硬い(柔らかい)」ことになる。
// どの変数名を使うかはバフの持ち方で変わるので、名前ではなく「両方が同じもの」を見る
const guardDefVar = (source.match(/const guardValueOf = \(flat, mult\) => \(flat > 0 \|\| mult > 0\) \? Math\.floor\(flat \+ (\w+) \* mult\) : 0;/) || [])[1];
const enemyTurnDefVar = (source.match(/Math\.floor\(immediateEffects\.guardFlat \+ (\w+)\*immediateEffects\.guardMult\)/) || [])[1];
check('合計軽減は実処理と同じ式で出す',
  !!guardDefVar && guardDefVar === enemyTurnDefVar && has('const guardCardWeight = (card) =>'),
  `表示=${guardDefVar} / 実処理=${enemyTurnDefVar}`);
check('弱ガードの重みも合計に反映する', has("card?.type === 'weak_guard' ? 0.5 : 0"));
check('スロットのガード表示に軽減量を出す', has('{gv>0&&<span'));
check('半減するカードには½を付ける', has("{halvedByIdx[idx]?'½':''}{card.name}"));
check('ガードのカード詳細も半減後の値を出す', has('（2枚目以降のため半減）') && has('Math.floor(halved?raw*0.5:raw)'));
check('ドラッグ中のカードも「次の1枚」として半減判定する',
  has('if(pendingIdx!=null&&selectedCards.includes(pendingIdx)) halvedByIdx[pendingIdx]=!isAssistCard(hand[pendingIdx])&&n>0;'));

// スワイプではカード効果のパネルを出さない(出したままだと合計表示が隠れる)
check('タップとスワイプでカード効果の表示を切り替えられる', has('const selectCardAt = (i, showDetail = true)') && has('const focus=(card)=>setFocusedCard(showDetail?card:null);'));
check('スワイプ経由の選択はパネルを出さない', has('selectCardAt(cardIndex, false);'));
const dragBlock = source.slice(source.indexOf('const dragAssignToSlot'), source.indexOf('const isAssistCard'));
check('スワイプで置いたときにパネルを出さない', !dragBlock.includes('setFocusedCard(c)'), `${(dragBlock.match(/setFocusedCard\(null\)/g)||[]).length}か所でパネルを閉じる`);
// ヘルプの本文は data/help.js にデータとして持っている
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
check('ヘルプに2枚目以降の説明がある', helpSrc.includes('2枚目以降で使ったカードは、ダメージもガードの軽減量も固有技の効果も半分になります'));

// --- ② かどみうむ ---
const cadCtx = {};
vm.createContext(cadCtx);
const tiersSrc = breeder.slice(breeder.indexOf('const CADMIUM_TIERS'), breeder.indexOf('const TEACHING_CARDS'));
vm.runInContext(`${tiersSrc}\nglobalThis.__t = CADMIUM_TIERS;`, cadCtx);
const tiers = cadCtx.__t;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('計算: ガッツ自動回復0.5%・ガッツ上限3%', same(tiers[0], { autoHp: 0, autoGuts: 0.005, hpLimit: 0, gutsLimit: 0.03 }), JSON.stringify(tiers[0]));
check('理論: ライフ/ガッツ自動回復0.5%・上限5%', same(tiers[1], { autoHp: 0.005, autoGuts: 0.005, hpLimit: 0.05, gutsLimit: 0.05 }), JSON.stringify(tiers[1]));
check('叡智: ライフ/ガッツ自動回復1%・上限7%', same(tiers[2], { autoHp: 0.01, autoGuts: 0.01, hpLimit: 0.07, gutsLimit: 0.07 }), JSON.stringify(tiers[2]));

// 説明文は本番のgetDynamicDescをそのまま動かす
const myaruRateSrc = source.match(/const myaruSelfDamageRate = [\s\S]+?;\n/);
check('みゃるの自傷率を共通計算する', !!myaruRateSrc);
const descCtx = { CADMIUM_TIERS: tiers };
vm.createContext(descCtx);
const descStart = source.indexOf('const getDynamicDesc');
const descEnd = source.indexOf('const getFullEvolutionDetails');
vm.runInContext(`${myaruRateSrc[0]}${source.slice(descStart, descEnd)}\nglobalThis.__d = getDynamicDesc; globalThis.__r = myaruSelfDamageRate;`, descCtx);
const desc = (level) => descCtx.__d({ id: 'cadmium' }, true, level);

check('計算の説明文', desc(0) === 'ガッツ自動回復 0.5%アップ・ガッツ上限 3%アップ', desc(0));
check('理論の説明文', desc(1) === 'ライフ自動回復 0.5%アップ・ガッツ自動回復 0.5%アップ・ライフ/ガッツ上限 5%アップ', desc(1));
check('叡智の説明文', desc(2) === 'ライフ自動回復 1%アップ・ガッツ自動回復 1%アップ・ライフ/ガッツ上限 7%アップ', desc(2));
check('0.5%が四捨五入で1%にならない', !desc(0).includes('1%'));

// 他カードの説明文が小数表示で崩れていないこと
const otherDesc = (id, level, extra = {}) => descCtx.__d({ id, ...extra }, true, level);
check('おりょうの説明文は整数のまま', otherDesc('oryo', 0) === '攻撃 10%アップ' && otherDesc('oryo', 2) === '攻撃 30%アップ');
check('みゃるの説明文は整数のまま', otherDesc('myaru', 0, { baseValue: 2.0, step: 0.5, selfDmg: 0.5, dmgStep: 0.1 }) === '次ターン攻撃 2.0倍・自傷 50%');

// --- ③ みゃる ---
const myaruRate = descCtx.__r;
const myaruCard = { selfDmg: 0.5, dmgStep: 0.1 };
check('みゃるの薬の自傷率は現在ライフの50%', myaruRate({ ...myaruCard, evoLevel: 0 }) === 0.5);
check('みゃるの怪薬の自傷率は現在ライフの40%', myaruRate({ ...myaruCard, evoLevel: 1 }) === 0.4);
check('みゃるの禁薬の自傷率は現在ライフの30%', myaruRate({ ...myaruCard, evoLevel: 2 }) === 0.3);
check('みゃるの実戦処理は進化後の自傷率と既存の特殊ルール倍率を使う',
  has('hpBeforeEnemyAttack*myaruSelfDamageRate(card)*effMul'));
check('みゃるの表示は実戦処理と同じ自傷率を使う', has('pct(myaruSelfDamageRate(t,level))'));
check('みゃるのLv1～Lv3表示',
  [0, 1, 2].map(level => otherDesc('myaru', level, { baseValue: 2.0, step: 0.5, selfDmg: 0.5, dmgStep: 0.1 }))
    .join('|') === '次ターン攻撃 2.0倍・自傷 50%|次ターン攻撃 2.5倍・自傷 40%|次ターン攻撃 3.0倍・自傷 30%');

// 効果が0の項目はバフを積まず、ポップアップの文言も実際の効果に合わせる
check('効果が0の上限アップはバフを積まない', has("if(tier.gutsLimit>0) addPermaBuff('muaGutsPct',tier.gutsLimit*effMul)"));
check('ポップアップは上限アップの有無で出し分ける', has('tier.gutsLimit>0?`⚡ ガッツ上限UP!`:`⚡ ガッツ回復UP!`'));
check('計算にもガッツ上限アップがある', tiers[0].gutsLimit === 0.03 && desc(0).includes('ガッツ上限 3%アップ'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
