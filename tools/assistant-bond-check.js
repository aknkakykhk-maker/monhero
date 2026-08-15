// みゅあの親密度(仲良し度)まわりを確認する。
//
// ・段階の並び、呼び方の変わり方
// ・どのLvでも、主要な画面で話すことが尽きないか
// ・1日に増える量が頭打ちになっているか(1回・行動ごと・1日の合計)
// ・保存が新しいキーへ分かれていて、既存のセーブデータに触っていないか
//
// このサンドボックスでは実ブラウザで最後まで起動できないため、
// データと計算はここでNode上に持ち出して実際に動かして確かめる。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));

// --- データを読み込む ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}
globalThis.__a = {
  ASSISTANT_BOND_LEVELS, ASSISTANT_BOND_ACTIONS, ASSISTANT_BOND_DAILY_MAX,
  ASSISTANT_SCENES, assistantBondLevel, assistantBondNext, assistantCallName,
  assistantSpeak, assistantSceneLines, pickAssistantLine, assistantLineMatchesBond,
  ASSISTANT_LINE_PACKS,
};`, ctx);
const A = ctx.__a;

// --- 段階の定義 ---
check('親密度の段階がデータで定義されている', Array.isArray(A.ASSISTANT_BOND_LEVELS) && A.ASSISTANT_BOND_LEVELS.length >= 5,
  `${A.ASSISTANT_BOND_LEVELS.length}段階`);
check('必要量が昇順に並んでいる',
  A.ASSISTANT_BOND_LEVELS.every((s, i) => i === 0 ? s.need === 0 : s.need > A.ASSISTANT_BOND_LEVELS[i - 1].need));
check('段階ごとに呼び方と話し方が書いてある',
  A.ASSISTANT_BOND_LEVELS.every(s => typeof s.call === 'string' && s.call.includes('{name}') && s.tone && s.title));

// --- 呼び方 ---
const call = (lv) => A.assistantCallName('あつ', lv);
check('Lv1・Lv2はさん付け', call(1) === 'あつさん' && call(2) === 'あつさん', `${call(1)} / ${call(2)}`);
check('Lv3・Lv4は呼び捨て', call(3) === 'あつ' && call(4) === 'あつ', `${call(3)} / ${call(4)}`);
check('Lv5はちん付け', call(5) === 'あつちん', call(5));
check('名前が未設定でも文が壊れない', typeof call.length === 'number' && A.assistantCallName('', 1).length > 0, A.assistantCallName('', 1));
check('セリフの{name}が呼び方に置き換わる',
  A.assistantSpeak('{name}、いこ！', 'あつ', 5) === 'あつちん、いこ！', A.assistantSpeak('{name}、いこ！', 'あつ', 5));

// --- 仲良し度からLvを出す ---
check('壊れた値でもLv1へ落ちる', A.assistantBondLevel(undefined) === 1 && A.assistantBondLevel(-99) === 1 && A.assistantBondLevel(NaN) === 1);
check('必要量に届くとLvが上がる',
  A.ASSISTANT_BOND_LEVELS.every(s => A.assistantBondLevel(s.need) === s.level));
check('最大まで行くと次は無い', A.assistantBondNext(99999) === null);

// --- セリフの数 ---
// 画面ごとの目標。長く遊んでも同じことばかり言わないようにするための下限
const SCENE_TARGET = {
  home: 40, battleChallenge: 30, battleQuick: 20, battlePro: 20, temple: 30, ranking: 20,
  roster: 25, masuList: 20, market: 20, profile: 15, settings: 15, helpTop: 20,
};
const countOf = (key) => (A.ASSISTANT_SCENES[key]?.lines || []).length;
for (const [key, want] of Object.entries(SCENE_TARGET)) {
  check(`${key} のセリフが${want}件以上`, countOf(key) >= want, `${countOf(key)}件`);
}
check('ミッションのセリフが合計20件以上', countOf('missionsClaimable') + countOf('missionsNormal') >= 20,
  `${countOf('missionsClaimable') + countOf('missionsNormal')}件`);
check('ギフトのセリフが合計20件以上', countOf('giftClaimable') + countOf('giftEmpty') >= 20,
  `${countOf('giftClaimable') + countOf('giftEmpty')}件`);
const total = Object.keys(A.ASSISTANT_SCENES).reduce((a, k) => a + countOf(k), 0);
check('セリフの総数が250件以上', total >= 250, `${total}件`);

// --- どのLvでも話すことが尽きないか ---
// 仲良し度で絞ったあとに候補が減りすぎると、同じセリフばかりになる
const thin = [];
for (const key of Object.keys(A.ASSISTANT_SCENES)) {
  for (let lv = 1; lv <= 5; lv++) {
    const n = A.assistantSceneLines(key, null, lv).length;
    if (n < 3) thin.push(`${key}/Lv${lv}=${n}`);
  }
}
check('どの画面・どのLvでも候補が3件以上ある', thin.length === 0, thin.join(', '));

// --- Lvごとに違うことを言うか ---
// 主要な画面では、Lv1で出る一覧とLv5で出る一覧が同じであってはいけない
const sameAtBothEnds = Object.keys(SCENE_TARGET).filter(key => {
  const low = A.assistantSceneLines(key, null, 1).map(l => l.t).join('\n');
  const high = A.assistantSceneLines(key, null, 5).map(l => l.t).join('\n');
  return low === high;
});
check('主要な画面はLvでセリフが変わる', sameAtBothEnds.length === 0, sameAtBothEnds.join(', '));
// 呼びかけ({name})を含むセリフが、どのLvにもあること
const noCall = [];
for (let lv = 1; lv <= 5; lv++) {
  const hit = Object.keys(SCENE_TARGET).filter(key => A.assistantSceneLines(key, null, lv).some(l => String(l.t).includes('{name}')));
  if (hit.length < Object.keys(SCENE_TARGET).length) {
    noCall.push(`Lv${lv}: ${Object.keys(SCENE_TARGET).filter(k => !hit.includes(k)).join('/')}`);
  }
}
check('主要な画面はどのLvでも名前を呼ぶセリフがある', noCall.length === 0, noCall.join(' 、 '));

// --- 話し方がLvに合っているか ---
// Lv3から呼び捨てになり、ていねい語(です・ます)は使わなくなる。
// 「Lv2以上」と書いたつもりのていねいなセリフがLv5まで残っていると、距離感がちぐはぐになる
const POLITE = /です(ね|よ|か)?[！。♪]|ますね|ますよ|ましょ|ください/;
const politeLate = [];
for (const key of Object.keys(A.ASSISTANT_SCENES)) {
  for (const lv of [3, 4, 5]) {
    for (const l of A.assistantSceneLines(key, null, lv)) {
      if (POLITE.test(l.t)) politeLate.push(`Lv${lv} ${key}: ${l.t}`);
    }
  }
}
check('Lv3以上ではていねい語を使わない', politeLate.length === 0, politeLate.slice(0, 5).join(' 、 '));
// 逆に、Lv1・Lv2にはていねいなセリフが残っていること(いきなり馴れ馴れしくならない)
const politeEarly = Object.keys(SCENE_TARGET).filter(key =>
  ![1, 2].some(lv => A.assistantSceneLines(key, null, lv).some(l => POLITE.test(l.t))));
check('Lv1・Lv2にはていねいなセリフがある', politeEarly.length === 0, politeEarly.join(', '));

// --- 続けて同じセリフを出さないか ---
const repeats = [];
for (const key of ['home', 'temple', 'battleChallenge']) {
  for (let lv = 1; lv <= 5; lv++) {
    let prev = null; let hit = 0;
    for (let i = 0; i < 200; i++) {
      const line = A.pickAssistantLine(key, null, lv);
      if (prev && line && line.t === prev.t) hit++;
      prev = line;
    }
    if (hit > 0) repeats.push(`${key}/Lv${lv}=${hit}回`);
  }
}
check('同じセリフが続けて出ない', repeats.length === 0, repeats.join(', '));

// --- レア(出やすさ)の指定 ---
const rare = Object.values(A.ASSISTANT_SCENES).flatMap(d => d.lines || []).filter(l => Number.isFinite(l.w) && l.w < 1);
check('たまにしか出ないセリフを作れる', rare.length > 0, `${rare.length}件`);

// --- あとから足せる形になっているか ---
check('セリフを束で足せる', Array.isArray(A.ASSISTANT_LINE_PACKS) && A.ASSISTANT_LINE_PACKS.length > 0,
  A.ASSISTANT_LINE_PACKS.map(p => p.id).join(', '));
check('束は期間限定にもできる', assistantsSrc.includes('if (typeof pack.when === \'function\')'));
check('二重に合流しない', assistantsSrc.includes('ASSISTANT_PACKS_APPLIED[pack.id]'));

// --- 増える行動 ---
const actions = A.ASSISTANT_BOND_ACTIONS;
const WANTED_ACTIONS = ['login', 'battle', 'challenge', 'quick', 'ranking', 'temple', 'mission', 'gift', 'market', 'talk'];
check('仕様どおりの行動がそろっている', WANTED_ACTIONS.every(k => actions[k]), WANTED_ACTIONS.filter(k => !actions[k]).join(', '));
check('行動ごとに1日の上限がある', Object.values(actions).every(a => a.amount > 0 && a.dailyMax >= a.amount));
check('1日の合計にも上限がある', Number.isFinite(A.ASSISTANT_BOND_DAILY_MAX) && A.ASSISTANT_BOND_DAILY_MAX > 0, `${A.ASSISTANT_BOND_DAILY_MAX}`);
check('1日の合計上限は、行動ごとの合計より小さい',
  A.ASSISTANT_BOND_DAILY_MAX < Object.values(actions).reduce((a, x) => a + x.dailyMax, 0));

// --- 加算の計算を実際に動かす ---
const gainCtx = {};
vm.createContext(gainCtx);
vm.runInContext([
  `const ASSISTANT_BOND_ACTIONS = ${JSON.stringify(actions)};`,
  `const ASSISTANT_BOND_DAILY_MAX = ${A.ASSISTANT_BOND_DAILY_MAX};`,
  // 日付の区切りと、仲良し度の計算をまとめて取り出す(この間に両方が入っている)
  grab(source, 'const loginBonusPeriodKey =', 'const assistantBondLevelOf'),
  'globalThis.__g = { normalizeAssistantBond, gainAssistantBond, ASSISTANT_BOND_KEY, ASSISTANT_BOND_EMPTY };',
].join('\n'), gainCtx);
const G = gainCtx.__g;

check('保存キーは新しく分けてある', G.ASSISTANT_BOND_KEY === 'mh_assistant_bond_v1', G.ASSISTANT_BOND_KEY);
check('壊れた値でも既定値に落ちる', (() => {
  const a = G.normalizeAssistantBond(null);
  const b = G.normalizeAssistantBond({ points: 'abc', daily: 'x', dailyTotal: -5 });
  return a.points === 0 && b.points === 0 && b.dailyTotal === 0 && typeof b.daily === 'object';
})());

const day1 = Date.parse('2026-07-31T05:00:00Z');
const day2 = day1 + 24 * 60 * 60 * 1000;
// 同じ行動をくり返しても、その行動の1日ぶんで止まる
check('行動ごとの1日上限で止まる', (() => {
  let s = G.ASSISTANT_BOND_EMPTY;
  for (let i = 0; i < 50; i++) s = G.gainAssistantBond(s, 'ranking', day1).state;
  return s.daily.ranking === actions.ranking.dailyMax;
})());
// いろいろな行動を混ぜても、1日の合計で止まる
check('1日の合計上限で止まる', (() => {
  let s = G.ASSISTANT_BOND_EMPTY;
  for (let i = 0; i < 100; i++) for (const k of WANTED_ACTIONS) s = G.gainAssistantBond(s, k, day1).state;
  return s.points === A.ASSISTANT_BOND_DAILY_MAX && s.dailyTotal === A.ASSISTANT_BOND_DAILY_MAX;
})());
// 日付が変われば、その日の集計だけ戻る(貯めた量は減らない)
check('日付が変わると、その日ぶんだけ戻る', (() => {
  let s = G.ASSISTANT_BOND_EMPTY;
  for (let i = 0; i < 100; i++) for (const k of WANTED_ACTIONS) s = G.gainAssistantBond(s, k, day1).state;
  const before = s.points;
  const after = G.gainAssistantBond(s, 'login', day2).state;
  return after.points === before + actions.login.amount && after.dailyTotal === actions.login.amount;
})());
check('放置しても減らない', !source.includes('bondDecay') && !/仲良し度[^\n]*減ら(す|し)/.test(source));
check('知らない行動では増えない', G.gainAssistantBond(G.ASSISTANT_BOND_EMPTY, 'unknown_action', day1).state.points === 0);

// --- 画面側の結線 ---
check('親密度はContextで配る',
  has('const AssistantBondContext = React.createContext(ASSISTANT_BOND_FALLBACK);')
    && has('<AssistantBondContext.Provider value={assistantBondValue}>'));
check('吹き出しは渡されたLvでセリフを選ぶ',
  has('pickAssistantLine(scene, condition, bond.level)'));
check('セリフの{name}を呼び方へ置き換えて出す',
  has('const text = assistantSpeakText(line || shown?.t || who.greeting || \'\', bond.name, bond.level, bond.callStyle);'));
check('画面側はこれまでどおり scene を渡すだけ',
  !/<AssistantBubble[^>]*bondLevel=/.test(source));
for (const [key, wired] of Object.entries({
  login: "gainAssistantBond(savedBond, 'login')",
  battle: "addAssistantBond('battle')",
  challenge: "addAssistantBond(modeBondAction(runMode))",
  ranking: "addAssistantBond('ranking')",
  temple: "addAssistantBond('temple')",
  market: "addAssistantBond('market')",
  mission: "addAssistantBond('mission')",
  gift: "addAssistantBond('gift')",
  talk: "if (typeof bond.onTalk === 'function') bond.onTalk();",
  management: "addAssistantBond('management')",
  fusion: "addAssistantBond('fusion')",
  breakthrough: "addAssistantBond('breakthrough')",
  reincarnate: "addAssistantBond('reincarnate')",
  regenerate: "addAssistantBond('regenerate')",
  donate: "addAssistantBond('donate')",
  enhance: "addAssistantBond('enhance')",
  dye: "addAssistantBond('dye')",
  partySet: "addAssistantBond('partySet')",
})) check(`${key} で仲良し度が増える`, has(wired));

// --- 既存データを壊していないか ---
check('既存の保存キーの読み書きを変えていない',
  has("storeGet('mh_breeder_name'") && has("storeSet('mh_gold'") && !source.includes("storeSet('mh_assistant_bond'"));
check('Lvが上がったことをHOMEで伝える',
  has("condition={assistantBondUp?'bondUp':(masuMons.length===0?'firstRun':null)}")
    && Array.isArray(A.ASSISTANT_SCENES.home?.when?.bondUp) && A.ASSISTANT_SCENES.home.when.bondUp.length >= 5);
check('プロフィールで仲良し度を確認できる', has('みゅあとの仲良し度'));

// --- デバッグ ---
for (const [label, needle] of Object.entries({
  '親密度の確認と変更': "setAssistantDebug('bond')",
  'ランダムテスト': "setAssistantDebug('random')",
  'Lvの切替': 'setAssistantDebugLevel(',
  '親密度リセット': 'debugSetAssistantBond(0)',
  '呼び方の一覧': "assistantSpeakText('{name}',breederName,s.level)",
  '全コメント確認': "setAssistantDebug('lines')",
  '画面別の件数表示': 'このLvで{usable}件',
})) check(`デバッグ: ${label}`, has(needle));
check('デバッグはデバッグ設定からだけ開ける',
  source.indexOf('💖 みゅあデバッグ') > source.indexOf("gameState==='DEBUG_SETTINGS'"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
