#!/usr/bin/env node
// アシストカード「ポルツ」の回帰チェック。
//
// ポルツは「使ったターンには何も起きず、そのあと敵の攻撃を受けたときに発動する」カードで、
// 効果が発生する場所(handleEnemyTurn)とカードを使う場所(processTurn)が離れている。
// そのため次の2つを機械的に確かめる。
//
//   ① 効果量の表(POLTZ_TIERS)と、実際に発動を処理する関数(consumePoltzCharge)を
//      本体からそのまま取り出して動かし、1回あたり・全部使い切ったあとの累計が仕様どおりか
//   ② 発動する場面・しない場面の結線。とくに「ガードは最終ダメージ0でも発動する」ことと、
//      回避・無効化・反射・吸収・スタンでは発動しない(待機回数も減らない)ことを、
//      handleEnemyTurn の分岐の中で tookEnemyAttack を立てている位置から確かめる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const TOOLS_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(TOOLS_DIR, '..');
const breederSource = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/breeder.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const helpSource = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---------- データ側 ----------
// breeder.js は images-ally.js の顔アイコン定数を参照するので、index.html と同じ順に流し込む
const sandbox = { console };
vm.createContext(sandbox);
sandbox.globalThis = sandbox;
const NAMES = ['POLTZ_TIERS', 'BREEDER_EVO_NAMES', 'TEACHING_CARDS', 'STARTER_TEACHING_IDS', 'BREEDER_MARKET_ITEMS'];
vm.runInContext([
  fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8'),
  breederSource,
  `;globalThis.__data = { ${NAMES.join(', ')} };`,
].join('\n'), sandbox, { filename: 'data/breeder.js' });
const { POLTZ_TIERS, BREEDER_EVO_NAMES, TEACHING_CARDS, STARTER_TEACHING_IDS, BREEDER_MARKET_ITEMS } = sandbox.__data;

check('進化名が3段階そろっている',
  Array.isArray(BREEDER_EVO_NAMES.poltz)
  && BREEDER_EVO_NAMES.poltz.join('/') === 'ポルツの弁当/ポルツの挫折/ポルツの目覚め',
  (BREEDER_EVO_NAMES.poltz || []).join('/'));

const card = TEACHING_CARDS.find(t => t.id === 'poltz');
check('アシストカードとして登録されている', !!card);
check('消費ガッツは既存アシストカードと同じ20', card && card.guts === 20, card && String(card.guts));
check('バフ系カードとして扱われる', card && card.type === 'buff' && card.subType === 'buff_poltz');
check('進化段階の初期値は0', card && card.evoLevel === 0);
check('初期から無料で使えるアシストには入れない',
  !STARTER_TEACHING_IDS.includes('poltz') && STARTER_TEACHING_IDS.length === 6,
  STARTER_TEACHING_IDS.join(','));
check('既存アシストカードの構成を変えていない',
  TEACHING_CARDS.length === 9 && TEACHING_CARDS.slice(0, 8).map(t => t.id).join(',') === 'oryo,dra,cadmium,mua,atsu,myaru,kiki,meloso',
  TEACHING_CARDS.map(t => t.id).join(','));

const market = BREEDER_MARKET_ITEMS.find(i => i.id === 'poltz');
check('マーケットのアシストタブに並んでいる', !!market && market.type === 'assist');
// 販売価格はきき・メロソと同じ1500ダイヤ(2026年8月にユーザーが指定)。
// available:false(「近日追加」)は外してあるので、ダイヤがあれば購入して解放できる
check('きき・メロソと同じ1500ダイヤで購入できる',
  !!market && market.cost === 1500 && market.available !== false,
  market && `${market.cost}ダイヤ`);
check('アシストカードの価格がきき・メロソと揃っている',
  BREEDER_MARKET_ITEMS.filter(i => i.type === 'assist').every(i => i.cost === 1500),
  BREEDER_MARKET_ITEMS.filter(i => i.type === 'assist').map(i => `${i.id}:${i.cost}`).join(' / '));

// プロフィールアイコンはカードと同じ絵を id を分けて並べる(きき/kiki_icon と同じ作り)。
// 値段はほかのアイコン商品と同じ1pt
const iconItem = BREEDER_MARKET_ITEMS.find(i => i.id === 'poltz_icon');
check('プロフィールアイコンがアイコンタブに並んでいる',
  !!iconItem && iconItem.type === 'icon' && iconItem.icon === market.icon);
check('アイコンの値段がほかのアイコン商品と同じ1pt', !!iconItem && iconItem.cost === 1, iconItem && `${iconItem.cost}pt`);

// ---------- ① 発動処理そのものを取り出して動かす ----------
const grab = (source, startMark, endMark) => {
  const from = source.indexOf(startMark);
  assert(from >= 0, `見つからない: ${startMark}`);
  const to = source.indexOf(endMark, from);
  assert(to >= 0, `見つからない: ${endMark}`);
  return source.slice(from, to);
};
const consumeSource = grab(gameSource, '  const consumePoltzCharge = async () => {', '  // enemyHpAtAttackStart:');

// 実効最大ガッツ1000・ポルツ以外のバフ無しの状態で、カードを1枚使ったところから始める
const runPoltz = async (level, effMul) => {
  const perma = {};
  const popups = [];
  let guts = 0;
  const env = {
    POLTZ_TIERS, BREEDER_EVO_NAMES, Number, Math, console,
    livePermaBuff: (key, def = 0) => (perma[key] ?? def),
    writePermaBuffs: (fn) => { Object.assign(perma, fn({ ...perma })); },
    addPermaBuff: (key, delta) => { perma[key] = (perma[key] || 0) + delta; },
    liveEffectiveMaxGuts: () => 1000,
    setGuts: (fn) => { guts = fn(guts); },
    addPopup: (text) => popups.push(text),
    battleWait: async () => {},
  };
  const ctx = vm.createContext(env);
  vm.runInContext(`${consumeSource}\nglobalThis.__consume = consumePoltzCharge;`, ctx);

  // カード使用時に predeposit される値(processTurn の buff_poltz 分岐と同じ形)
  const tier = POLTZ_TIERS[level];
  Object.assign(perma, { poltzTier: level, poltzEffMul: effMul, poltzCharges: tier.charges });

  const chargesSeen = [];
  // 待機回数より多く敵の攻撃を受けても、余分に発動しないことまで見る
  for (let i = 0; i < tier.charges + 2; i++) {
    await env.__consume();
    chargesSeen.push(perma.poltzCharges);
  }
  return { perma, guts, popups, chargesSeen };
};

// 仕様: Lv1=1回/回復20%/自動ガッツ回復+1%、Lv2=2回/+2.5%ずつ(累計+5%)、
//       Lv3=3回/+3.5%ずつ(累計+10.5%)・攻撃+10%ずつ(累計+30%)
const SPEC = [
  { level: 0, charges: 1, guts: 200, recover: 0.01,  atk: 0 },
  { level: 1, charges: 2, guts: 400, recover: 0.05,  atk: 0 },
  { level: 2, charges: 3, guts: 600, recover: 0.105, atk: 0.30 },
];
const round = (v) => Math.round(v * 1e6) / 1e6;

(async () => {
  for (const spec of SPEC) {
    const name = BREEDER_EVO_NAMES.poltz[spec.level];
    const r = await runPoltz(spec.level, 1);
    check(`${name}: 待機できるのは${spec.charges}回だけ`,
      r.chargesSeen.every(c => c >= 0) && r.chargesSeen[spec.charges - 1] === 0 && r.chargesSeen[r.chargesSeen.length - 1] === 0,
      r.chargesSeen.join('→'));
    check(`${name}: 回復は1回あたり実効最大ガッツの20%(合計${spec.guts})`, r.guts === spec.guts, String(r.guts));
    check(`${name}: 自動ガッツ回復の累計が +${round(spec.recover * 100)}%`,
      round(r.perma.gutsRecoverPct || 0) === spec.recover, String(round((r.perma.gutsRecoverPct || 0) * 100)));
    check(`${name}: 攻撃アップの累計が +${round(spec.atk * 100)}%`,
      round(r.perma.atkPct || 0) === spec.atk, String(round((r.perma.atkPct || 0) * 100)));
    check(`${name}: 待機回数が0になっても得た効果は消えない`,
      (r.perma.gutsRecoverPct || 0) > 0 && r.perma.poltzCharges === 0);

    // EXTREME等の共通倍率(assistCardEffect=0.5)は効果量にだけかかり、発動回数は変わらない
    const half = await runPoltz(spec.level, 0.5);
    check(`${name}: EXTREMEでも待機回数は${spec.charges}回のまま`,
      half.chargesSeen[spec.charges - 1] === 0, half.chargesSeen.join('→'));
    check(`${name}: EXTREMEでは効果量だけが半分になる`,
      half.guts === spec.guts / 2
      && round(half.perma.gutsRecoverPct || 0) === round(spec.recover / 2)
      && round(half.perma.atkPct || 0) === round(spec.atk / 2),
      `ガッツ${half.guts} / 回復${round((half.perma.gutsRecoverPct || 0) * 100)}% / 攻撃${round((half.perma.atkPct || 0) * 100)}%`);
  }

  // 壊れた保存値・待機していない状態で呼ばれても何も起きない
  const broken = await (async () => {
    const perma = { poltzCharges: 0 };
    let guts = 0;
    const env = {
      POLTZ_TIERS, BREEDER_EVO_NAMES, Number, Math, console,
      livePermaBuff: (key, def = 0) => (perma[key] ?? def),
      writePermaBuffs: (fn) => { Object.assign(perma, fn({ ...perma })); },
      addPermaBuff: (key, delta) => { perma[key] = (perma[key] || 0) + delta; },
      liveEffectiveMaxGuts: () => 1000,
      setGuts: (fn) => { guts = fn(guts); },
      addPopup: () => {},
      battleWait: async () => {},
    };
    const ctx = vm.createContext(env);
    vm.runInContext(`${consumeSource}\nglobalThis.__consume = consumePoltzCharge;`, ctx);
    await env.__consume();
    // 保存値が壊れていた場合(文字列・NaN・範囲外)も落ちず、既定値で動く
    Object.assign(perma, { poltzCharges: 1, poltzTier: 99, poltzEffMul: 'こわれた値' });
    await env.__consume();
    return { guts, perma };
  })();
  check('待機していないときは何も起きない・壊れた保存値でも落ちない',
    broken.guts === Math.floor(1000 * POLTZ_TIERS[POLTZ_TIERS.length - 1].healGuts) && broken.perma.poltzCharges === 0,
    `ガッツ${broken.guts}`);

  // ---------- ② 発動する場面・しない場面の結線 ----------
  const enemyTurn = grab(gameSource, '  const handleEnemyTurn = async (', '  const useEmergency = async () => {');
  const guardBranch = grab(enemyTurn, '} else if (guardValue>0) {', '        } else {');
  const plainBranch = grab(enemyTurn, `        } else {\n          tookEnemyAttack=true;`, 'if (tookEnemyAttack)');
  const reflectBranch = grab(enemyTurn, 'if (isReflect) {', '} else if (guardValue>0) {');

  check('待機を消化するのは敵の攻撃(ATTACK/SPECIAL)を受け止めたときだけ',
    (enemyTurn.match(/tookEnemyAttack=true;/g) || []).length === 2
    && (enemyTurn.match(/if \(tookEnemyAttack\) await consumePoltzCharge\(\);/g) || []).length === 1);
  check('ガードで受け止めたときは発動する(最終ダメージ0・余剰回復でも同じ)',
    guardBranch.includes('tookEnemyAttack=true;')
    && guardBranch.includes('const diff=guardValue-incomingBeforeTurnReduction;')
    && guardBranch.includes('貫通!') && guardBranch.includes('🛡 ガード成功'));
  check('普通にダメージを受けたときも発動する', plainBranch.includes('triggerShake();'));
  check('反射・吸収・回避では発動しない',
    !reflectBranch.includes('tookEnemyAttack')
    && reflectBranch.includes('反射！') && reflectBranch.includes('吸収！') && reflectBranch.includes('回避！'));
  check('無効化・スタン・眼力で敵が攻撃できなかったターンでは発動しない',
    !grab(enemyTurn, "if (getTurnBuff('invincible',false)", "} else if (intent.type==='ATTACK'").includes('tookEnemyAttack'));
  check('移動・待機・ためのターンでは発動しない',
    !grab(enemyTurn, "} else if (intent.type==='MOVE') {", "} else if (intent.type==='ATTACK'").includes('tookEnemyAttack'));

  // ---------- カードを使ったときの結線・表示 ----------
  check('カード使用時は待機回数を張り直すだけ(効果は発生しない)',
    gameSource.includes("else if (card.subType==='buff_poltz') {")
    && gameSource.includes('writePermaBuffs(p=>({...p, poltzTier:tier, poltzEffMul:effMul, poltzCharges:conf.charges}));'));
  check('待機の残り回数をバフ欄に出す',
    gameSource.includes("{getPermaBuff('poltzCharges')>0&&")
    && gameSource.includes("BREEDER_EVO_NAMES.poltz[Math.max(0,Math.min(getPermaBuff('poltzTier'),2))]")
    && gameSource.includes("×{Math.floor(getPermaBuff('poltzCharges'))}"));
  check('カード説明(getDynamicDesc)を POLTZ_TIERS から作っている',
    gameSource.includes("if(t.id==='poltz'){")
    && gameSource.includes('const tier=POLTZ_TIERS[Math.min(level,POLTZ_TIERS.length-1)];')
    && !/if\(t\.id==='poltz'\)[^\n]*20%/.test(gameSource));
  // 「待機」ではなく「発動（N回まで）」で統一する(2026年8月にユーザーが指定)。
  // カード説明・ヘルプ・更新履歴でばらけると、同じ仕組みが別物に見えてしまう
  check('カード説明が「発動（N回まで）」の言い方になっている',
    gameSource.includes('敵の攻撃を受けるたびに発動（${tier.charges}回まで）')
    && gameSource.includes('発動ごとにガッツ ${pct(tier.healGuts)}%回復'));
  check('ヘルプ・更新履歴にも「待機」が残っていない',
    !/ポルツ[^\n]*待機|待機[^\n]*ポルツ/.test(helpSource)
    && !/ポルツ[^\n]*待機/.test(fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/changelog.js'), 'utf8')));
  check('カード使用時の演出が登録されている', /poltz:\s*\{ icon:"🍱"/.test(gameSource));
  // 待機回数・段階・倍率は既存の permaBuffs(バトル中だけの数値)へ足すだけで、保存キーは増やさない
  check('新しい保存キーを増やしていない',
    !gameSource.includes("'mh_poltz") && !gameSource.includes('mh_poltz'));
  check('バトル開始時に待機がリセットされる',
    (gameSource.match(/writePermaBuffs\(\{autoHpRecovery:0\.1\}\)/g) || []).length === 2);

  // ---------- ヘルプ ----------
  check('ヘルプに発動する場面・しない場面が書いてある',
    helpSource.includes('ポルツが発動する場面・しない場面')
    && helpSource.includes('ポルツの弁当・挫折・目覚め')
    && helpSource.includes('ポルツとEXTREME'));
  check('旧名称「ブリーダーカード」を新しく増やしていない',
    !/ポルツ[^\n]*ブリーダーカード|ブリーダーカード[^\n]*ポルツ/.test(helpSource + gameSource + breederSource));

  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
