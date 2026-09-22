const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 新モード(id: tactics)の作り込みが、既存5モードの計算へ1ミリも漏れていないことを確かめる。
//
//   node tools/battle/legacy-mode-parity-check.js
//
// 【なぜ要るか】
// 新モードは「ステータスを1体ずつ持つ」ために、被ダメ・与ダメ・カード枚数・自動回復・
// 特殊防御の抽選へ次々と分岐を足してきた。分岐はすべて isTacticsMode(runMode) を通す決まりだが、
// 「通したつもり」を人が読んで確かめるのは当てにならない。実際に式を動かして確かめる。
//
// 【見かた】
// 既存モードでは、**新モード用の入力を何に変えても結果が変わらない**ことを総当たりで見る。
//   新モード用の入力 = 狙われた枠(targetSlot) / 攻撃した枠(slotIdx) / 勇者モンの枠(heroDist) /
//                      盤面(tacticsUnits) / 狙われた枠の一覧(aimedSlots)
// これが1つでも揺れたら、その分岐は既存モードへ漏れている。
// あわせて「新モードでは実際に変わる」ことも見る(分岐が死んでいたら意味がないため)。
const fs = require('fs');
const path = require('path');
const { GAME_SYSTEM } = require(path.join(TOOLS_DIR, 'harness'));
const source = fs.readFileSync(GAME_SYSTEM, 'utf8');

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from);
  if (i < 0) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  const j = source.indexOf(to, i);
  if (j <= i) { console.log(`NG: 終わりが見つかりません（${to}）`); process.exit(1); }
  return source.slice(i + from.length, j);
};

// ===== 本体から式を切り出して動かす =====
// ★数式を検査へ書き写さない。本体を切り出して、そのまま動かす

// (1) 被ダメージ
const incomingBody = slice(
  'const getIncomingDamageBeforeTurnReduction = useCallback((intent, targetSlot=null) => {',
  '  }, [effectiveDef,');
const makeIncoming = (deps) => new Function('d', `
  const {getWaveBuff,mainHero,isTacticsMode,runMode,heroDist,tacticsUnitsRef,
    resolveEffectiveMaxStat,normalizeTacticsUnit,effectiveDef,getPermaBuff,
    soulBattleParty,iceLockEnemyDamageMult} = d;
  return (intent, targetSlot=null) => {${incomingBody}};
`)(deps);

// (2) 与ダメージの勇者特性ぶん
const traitBody = slice(
  '    // ★タクティクスバトルは**攻撃した子自身の特性**が乗る(2026-09-20 ユーザー提案)。',
  '    // 間合い適性は');
// 2026-09-22: 特性の「持ち主」を決める1行も本体から取り出して持ち込む
// (検査へ書き写すと、本体の決め方を変えたときに検査だけ古くなる)
const traitOwnerSrc = `const traitOwnerOf = ${slice('const traitOwnerOf = ', '\n')}`;
const makeTrait = (deps) => new Function('d', `
  const {isTacticsMode,runMode,mainHero} = d;
  ${traitOwnerSrc}
  return (card, slotIdx, mon) => {${traitBody} return traitMult; };
`)(deps);

// (3) 1ターンに選べる枚数
const limitBody = slice('const baseCardLimit = useMemo(() => {', '  }, [effectiveMaxGuts,');
const makeLimit = (deps) => new Function('d', `
  const {isTacticsMode,runMode,tacticsAliveSlots,tacticsUnits,slots,
    effectiveMaxGuts,heroCardBonus,kikiCardBonus} = d;
  return () => {${limitBody}};
`)(deps);

// ===== 共通のスタブ =====
// 既存モードで使う値。新モード用の入力だけを揺らして、結果が動かないことを見る
const baseDeps = (over = {}) => ({
  getWaveBuff: () => 0,
  getPermaBuff: () => 0,
  mainHero: null,
  isTacticsMode: (mode) => mode === 'tactics',
  runMode: 'challenge',
  heroDist: -1,
  tacticsUnitsRef: { current: [null, null, null, null] },
  resolveEffectiveMaxStat: (baseMax, buffPct) => Math.floor((Number(baseMax) || 0) * (1 + (Number(buffPct) || 0))),
  normalizeTacticsUnit: (u) => u,
  effectiveDef: 200,
  soulBattleParty: { damageReduction: 0 },
  iceLockEnemyDamageMult: 1,
  tacticsAliveSlots: (units) => (units || []).map((u, i) => (u && !u.downed ? i : -1)).filter(i => i >= 0),
  tacticsUnits: [null, null, null, null],
  slots: [{ id: 'A' }, { id: 'B' }, null, null],
  effectiveMaxGuts: 200,
  heroCardBonus: 0,
  kikiCardBonus: 0,
  ...over,
});
// 新モード用の入力を揺らす組み合わせ。既存モードではどれを選んでも結果が同じはず
const BOARD = [
  { def: 500, downed: false }, { def: 50, downed: false },
  { def: 900, downed: true }, { def: 120, downed: false },
];
const HERO_DISTS = [-1, 0, 1, 2, 3];
const SLOTS = [null, 0, 1, 2, 3];
const HEROES = [null, { id: 'Mocchi' }, { id: 'Ark' }, { id: 'Golem' }, { id: 'Pixie' }, { id: 'Pandora' }];
const INTENT = { type: 'ATTACK', value: 1000 };
const CARDS = [{ type: 'atk' }, { type: 'unique', monId: 'Zan' }, { type: 'unique', monId: 'Pandora' }];

// ===== ① 被ダメージ: 既存モードでは新モード用の入力に反応しない =====
const incomingOf = (over, targetSlot) => makeIncoming(baseDeps(over))(INTENT, targetSlot);
for (const hero of HEROES) {
  const want = incomingOf({ mainHero: hero }, null);
  let same = true, detail = '';
  for (const heroDist of HERO_DISTS) for (const targetSlot of SLOTS) {
    const got = incomingOf({ mainHero: hero, heroDist, tacticsUnitsRef: { current: BOARD } }, targetSlot);
    if (got !== want) { same = false; detail = `枠${targetSlot}/勇者枠${heroDist} で ${want}→${got}`; break; }
  }
  check(`被ダメは既存モードだと新モードの入力で動かない（勇者モン ${hero ? hero.id : 'なし'}）`, same, detail || `${want}`);
}
// 勇者特性が既存モードで効いていること自体も確かめる(分岐を入れて殺していないか)
const plain = incomingOf({ mainHero: null }, null);
check('既存モードでは勇者特性が誰にでも効く（もち肌）',
  incomingOf({ mainHero: { id: 'Mocchi' } }, null) < plain,
  `素${plain} / もち肌${incomingOf({ mainHero: { id: 'Mocchi' } }, null)}`);
check('既存モードでは勇者特性が誰にでも効く（中二病）',
  incomingOf({ mainHero: { id: 'Ark' } }, null) < plain,
  `素${plain} / 中二病${incomingOf({ mainHero: { id: 'Ark' } }, null)}`);

// ===== ② 与ダメージの勇者特性: 既存モードでは攻撃した枠に反応しない =====
// ★既存モードは「攻撃したのが誰か」に関係なく、勇者モンの特性が乗る
for (const hero of HEROES) for (const card of CARDS) {
  const fn = makeTrait(baseDeps({ mainHero: hero }));
  const want = fn(card, 0, { id: 'Mocchi' });
  let same = true, detail = '';
  for (const slotIdx of [0, 1, 2, 3]) for (const mon of [null, { id: 'Golem' }, { id: 'Pixie' }, { id: 'Suezo' }]) {
    const got = makeTrait(baseDeps({ mainHero: hero, heroDist: 2 }))(card, slotIdx, mon);
    if (got !== want) { same = false; detail = `枠${slotIdx}/攻撃 ${mon ? mon.id : 'なし'} で ${want}→${got}`; break; }
  }
  check(`与ダメ倍率は既存モードだと攻撃した子で動かない（${hero ? hero.id : 'なし'} / ${card.type}${card.monId ? `:${card.monId}` : ''}）`,
    same, detail || `×${want}`);
}
check('既存モードでは怪力が誰の攻撃にも乗る',
  makeTrait(baseDeps({ mainHero: { id: 'Golem' } }))(CARDS[0], 3, { id: 'Suezo' }) === 1.2);

// ===== ③ 1ターンに選べる枚数: 既存モードでは盤面に反応しない =====
for (const [maxGuts, label] of [[100, 'ガッツ100'], [130, 'ガッツ130'], [200, 'ガッツ200']]) {
  const want = makeLimit(baseDeps({ effectiveMaxGuts: maxGuts }))();
  let same = true, detail = '';
  for (const units of [[null, null, null, null], BOARD, [BOARD[0], null, null, null]]) {
    const got = makeLimit(baseDeps({ effectiveMaxGuts: maxGuts, tacticsUnits: units }))();
    if (got !== want) { same = false; detail = `${want}→${got}`; break; }
  }
  check(`枚数は既存モードだと盤面で動かない（${label}）`, same, detail || `${want}枚`);
}
check('既存モードの枚数はガッツのしきいで決まる（2体編成）',
  makeLimit(baseDeps({ effectiveMaxGuts: 119 }))() === 1
    && makeLimit(baseDeps({ effectiveMaxGuts: 120 }))() === 2,
  `119→${makeLimit(baseDeps({ effectiveMaxGuts: 119 }))()}枚 / 120→${makeLimit(baseDeps({ effectiveMaxGuts: 120 }))()}枚`);

// ===== ④ 新モードでは実際に変わる（分岐が死んでいないこと） =====
const tactics = (over) => baseDeps({ runMode: 'tactics', ...over });
check('新モードは狙われた子で被ダメが変わる', (() => {
  // 0番はもち肌持ち、1番は持っていない
  const board = [{ id: 'Mocchi', def: 200 }, { id: 'Suezo', def: 200 }, null, null];
  const fn = makeIncoming(tactics({ mainHero: null, tacticsUnitsRef: { current: board } }));
  return fn(INTENT, 0) < fn(INTENT, 1);
})());
check('新モードは攻撃した子で与ダメ倍率が変わる', (() => {
  // 勇者モンにしていなくても、怪力持ちが攻撃すれば乗る
  const fn = makeTrait(tactics({ mainHero: null }));
  return fn(CARDS[0], 1, { id: 'Golem' }) === 1.2 && fn(CARDS[0], 1, { id: 'Suezo' }) === 1.0;
})());
check('新モードの枚数は盤面の人数で決まる', (() => {
  const two = makeLimit(tactics({ effectiveMaxGuts: 1, tacticsUnits: [BOARD[0], BOARD[1], null, null] }))();
  const three = makeLimit(tactics({ effectiveMaxGuts: 1, tacticsUnits: [BOARD[0], BOARD[1], BOARD[3], null] }))();
  return two === 2 && three === 3; // ガッツのしきいを見ないので上限1でも人数どおり
})());

// ===== ⑤ 分岐の書き方そのもの =====
// ★新モード用の値を、isTacticsMode の外で使っていないか
const has = (needle) => source.includes(needle);
check('特殊防御の抽選は既存モードだと従来の表を通る',
  has('const defenseTable = !isTacticsMode(runMode) ? unifiedSpecialDefense : buildUnifiedSpecialDefense({')
    && has('const aimedSlots = isTacticsMode(runMode)'));
check('自動回復の率は既存モードだと従来のまま',
  has('tacticsRegen(autoHpRecoveryRate,isTacticsMode(runMode)?baseGutsRecoveryRate:soulAdjustedGutsRecoveryRate)'));
check('威圧は既存モードだと編成から決まる',
  has("(!isTacticsMode(runMode)&&mainHero?.id==='Suezo')?40:0,"));
// 2026-09-22: タクティクスは「1＋その子の👑＋きき＋連携」で数えるようになった。
// 既存5モードは今までどおり、勇者モン本人ときき中がそのターンの総数まで重ねられる
check('1枚多く使えるのは既存モードだと勇者モン本人だけ',
  has('const bonusOwner=heroCardBonusOf(mainHero?.id)>0&&mon?.id===mainHero?.id;')
    && has('const base=(bonusOwner||kikiCardBonus>0) ? baseCardLimit : 1;'));
check('ガッツ回復のボタンは既存モードだと合計で見る',
  has('(isTacticsMode(runMode) ? tacticsHasGutsRoom(tacticsUnits) : guts < effectiveMaxGuts)'));
check('味方全体の反射は既存モードだと今までどおり通る',
  has('if (isReflect && (forcedReflect || !isTacticsMode(runMode))) {'));
check('回避は既存モードだと今までどおり「回避！」の枝へ',
  has('} else if (isEvasion && !isTacticsMode(runMode)) {'));
// 敵の行動表そのもの
check('既存モードの行動表に新モードの技が混ざっていない',
  /const ENEMY_ACTION_DEFINITIONS = \[[\s\S]*?\];/.test(source)
    && !/const ENEMY_ACTION_DEFINITIONS = \[[\s\S]*?variant:/.test(source.match(/const ENEMY_ACTION_DEFINITIONS = \[[\s\S]*?\];/)[0]));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
