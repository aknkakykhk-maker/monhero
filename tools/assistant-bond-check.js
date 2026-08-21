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
  ASSISTANT_LINE_PACKS, ASSISTANTS, assistantBondLevelsOf, assistantBondStageByLevel,
  assistantCallStylesOf, ASSISTANT_CALL_STYLE_UNLOCK_LEVEL,
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

// --- 獲得量と1日上限が指定どおりか(1つずつ突き合わせる) ---
// ここを表で持っておくと、あとから誰かが1行だけ書き換えたときに必ず落ちる
const WANT_AMOUNTS = {
  login: [10, 10], battle: [6, 30], challenge: [4, 20], quick: [2, 12], pro: [4, 20],
  ranking: [2, 6], temple: [2, 8], mission: [4, 16], gift: [2, 8], market: [2, 6],
  talk: [2, 10], management: [2, 8], fusion: [4, 12], breakthrough: [4, 12],
  reincarnate: [4, 12], regenerate: [2, 6], donate: [4, 12], enhance: [2, 12],
  dye: [2, 6], partySet: [2, 6], extreme: [6, 18], clear: [4, 16],
  quickClear: [2, 12], proClear: [4, 16], extremeClear: [8, 24],
  // 助手のアシストカード専用
  assistantCardEquip: [4, 20], assistantCardUse: [6, 24],
};
const wrongAmounts = Object.entries(WANT_AMOUNTS)
  .filter(([k, [amount, dailyMax]]) => !actions[k] || actions[k].amount !== amount || actions[k].dailyMax !== dailyMax)
  .map(([k, [amount, dailyMax]]) => `${k}: ${actions[k] ? `${actions[k].amount}/${actions[k].dailyMax}` : 'なし'} (期待 ${amount}/${dailyMax})`);
check('すべての行動の獲得量と1日上限が指定どおり', wrongAmounts.length === 0, wrongAmounts.join(' 、 '));
check('表にない行動が増えていない',
  Object.keys(actions).every(k => WANT_AMOUNTS[k]), Object.keys(actions).filter(k => !WANT_AMOUNTS[k]).join(', '));
// 既存行動だけの理論上限(=カード分を足す前の値)。仕様の318と一致すること
const LEGACY_KEYS = Object.keys(WANT_AMOUNTS).filter(k => !k.startsWith('assistantCard'));
const legacySum = LEGACY_KEYS.reduce((a, k) => a + actions[k].dailyMax, 0);
check('既存行動だけの1日理論上限は318', legacySum === 318, `${legacySum}`);
check('カード分を足した理論上限が全体の上限と一致する(手入力していない)',
  A.ASSISTANT_BOND_DAILY_MAX === legacySum + actions.assistantCardEquip.dailyMax + actions.assistantCardUse.dailyMax,
  `${A.ASSISTANT_BOND_DAILY_MAX} / 318+20+24=${legacySum + 44}`);
// Lvアップに必要な累積量は変えていない(増やしたのは1回の獲得量だけ)。
// 獲得量をいじるときにここまで一緒に動かすと、既存プレイヤーのLvが勝手に変わってしまう
const WANT_NEEDS = [0, 60, 180, 400, 800, 1250, 1750, 2300, 2900, 3550,
  4250, 5000, 5800, 6650, 7550, 8500, 9500, 10550, 11650, 12800];
check('Lvアップに必要な累積仲良し度は変えていない',
  A.ASSISTANT_BOND_LEVELS.length === WANT_NEEDS.length
    && WANT_NEEDS.every((n, i) => A.ASSISTANT_BOND_LEVELS[i].need === n),
  A.ASSISTANT_BOND_LEVELS.map(s => s.need).join('/'));
check('行動ごとに1日の上限がある', Object.values(actions).every(a => a.amount > 0 && a.dailyMax >= a.amount));
check('1日の合計にも上限がある', Number.isFinite(A.ASSISTANT_BOND_DAILY_MAX) && A.ASSISTANT_BOND_DAILY_MAX > 0, `${A.ASSISTANT_BOND_DAILY_MAX}`);
// 全体の頭打ちは、行動ごとの上限をすべて合わせた理論上の最大値と一致させている
// (行動ごとの1日上限がすでに「連打で稼げない」役目を担うため、全体側で二重に絞らない)
const actionDailyMaxSum = Object.values(actions).reduce((a, x) => a + x.dailyMax, 0);
check('1日の合計上限は、行動ごとの上限の合計(理論値)と一致する',
  A.ASSISTANT_BOND_DAILY_MAX === actionDailyMaxSum, `上限${A.ASSISTANT_BOND_DAILY_MAX} / 理論値${actionDailyMaxSum}`);

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
// ぜんぶの行動を混ぜても、行動ごとの上限を合わせた理論値(=全体の頭打ち)で止まる
const ALL_ACTION_KEYS = Object.keys(actions);
check('1日の合計上限(理論値)で止まる', (() => {
  let s = G.ASSISTANT_BOND_EMPTY;
  for (let i = 0; i < 100; i++) for (const k of ALL_ACTION_KEYS) s = G.gainAssistantBond(s, k, day1).state;
  return s.points === A.ASSISTANT_BOND_DAILY_MAX && s.dailyTotal === A.ASSISTANT_BOND_DAILY_MAX;
})());
// 一部の行動だけを連打しても、それらの行動ごとの上限の合計より先へは増えない
// (全体の頭打ちが理論値と一致していても、少数の行動だけでは理論値まで届かないことの確認)
check('一部の行動だけでは全体の頭打ちまで届かない', (() => {
  let s = G.ASSISTANT_BOND_EMPTY;
  for (let i = 0; i < 100; i++) for (const k of WANTED_ACTIONS) s = G.gainAssistantBond(s, k, day1).state;
  const wantedSum = WANTED_ACTIONS.reduce((a, k) => a + actions[k].dailyMax, 0);
  return s.points === wantedSum && wantedSum < A.ASSISTANT_BOND_DAILY_MAX;
})());
// 日付が変われば、その日の集計だけ戻る(貯めた量は減らない)
check('日付が変わると、その日ぶんだけ戻る', (() => {
  let s = G.ASSISTANT_BOND_EMPTY;
  for (let i = 0; i < 100; i++) for (const k of ALL_ACTION_KEYS) s = G.gainAssistantBond(s, k, day1).state;
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
check('吹き出しは渡されたLvと助手でセリフを選ぶ',
  has('pickAssistantLine(scene, condition, bond.level, who.id)'));
check('セリフの{name}を呼び方へ置き換えて出す',
  has('const text = assistantSpeakText(line || shown?.t || who.greeting || \'\', bond.name, bond.level, bond.callStyle, who.id);'));
check('画面側はこれまでどおり scene を渡すだけ',
  !/<AssistantBubble[^>]*bondLevel=/.test(source));
for (const [key, wired] of Object.entries({
  login: "gainAssistantBond(loadedBonds[activeAssistant], 'login')",
  battle: "addAssistantBond('battle')",
  challenge: "addAssistantBond(extremeRunRef.current ? 'extreme' : modeBondAction(runMode))",
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
  extreme: "addAssistantBond(extremeRunRef.current ? 'extreme' : modeBondAction(runMode))",
  clear: "addAssistantBond('clear')",
  quickClear: "addAssistantBond('quickClear')",
  proClear: "addAssistantBond('proClear')",
  extremeClear: "addAssistantBond('extremeClear')",
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
  '呼び方の一覧': "assistantSpeakText('{name}',breederName,s.level,null,selectedAssistantId)",
  '全コメント確認': "setAssistantDebug('lines')",
  '画面別の件数表示': 'このLvで{usable}件',
})) check(`デバッグ: ${label}`, has(needle));
check('デバッグはデバッグ設定からだけ開ける',
  source.indexOf('💖 みゅあデバッグ') > source.indexOf("gameState==='DEBUG_SETTINGS'"));


// ==========================================================================
// 第2助手「きき」。みゅあの回帰を壊さずに、ききも同じ仕組みで動くことを見る
// ==========================================================================
const KIKI = 'kiki';
check('ききが助手として定義されている', A.ASSISTANTS.some(x => x.id === KIKI));
// --- 段階(必要量は共通・タイトルと呼び方は専用) ---
const kikiLevels = A.assistantBondLevelsOf(KIKI);
check('ききもLv20まである', kikiLevels.length === A.ASSISTANT_BOND_LEVELS.length, `${kikiLevels.length}段階`);
check('必要な仲良し度はみゅあと同じ',
  kikiLevels.every((s, i) => s.need === A.ASSISTANT_BOND_LEVELS[i].need));
check('ききのタイトルは指定どおり', (() => {
  const want = ['はじめまして','顔なじみ','気になる存在','なかよし','お気に入り','心を許せる仲','頼れる相方',
    '気の合うふたり','いつもの相棒','腐れ縁','阿吽の呼吸','特別な存在','一心同体','最高の相方','伝説のコンビ',
    '運命共同体','生涯のパートナー','かけがえのない存在','唯一の理解者','永遠の相棒'];
  return want.every((t, i) => kikiLevels[i].title === t);
})(), kikiLevels.map(s => s.title).join('/'));
check('タイトルはみゅあと別物', (() => {
  const diff = kikiLevels.filter((s, i) => s.title !== A.ASSISTANT_BOND_LEVELS[i].title);
  return diff.length > 0;
})());
// --- 呼び方 ---
const kcall = (lv, custom) => A.assistantCallName('あつ', lv, custom, KIKI);
check('ききはLv1〜3が「さん」付け',
  [1, 2, 3].every(lv => kcall(lv) === 'あつさん'), [1, 2, 3].map(kcall).join(' / '));
check('ききはLv4〜5が「ちー」付け',
  [4, 5].every(lv => kcall(lv) === 'あつちー'), [4, 5].map(kcall).join(' / '));
check('ききはLv6以降の既定も「ちー」付け',
  [6, 10, 20].every(lv => kcall(lv) === 'あつちー'), [6, 10, 20].map(kcall).join(' / '));
check('ききもLv6から自由入力が効く',
  kcall(6, '{name}先輩') === 'あつ先輩' && kcall(6, 'せんせい') === 'せんせい');
check('Lv5以下では自由入力を受け付けない', kcall(5, '{name}先輩') === 'あつちー');
check('ききの自由入力の候補は「ちー」付けを含む',
  A.assistantCallStylesOf(KIKI).some(x => x.template === '{name}ちー'));
check('みゅあの呼び方はこれまでどおり(ききの影響を受けない)',
  A.assistantCallName('あつ', 1, null, 'mua') === 'あつさん'
    && A.assistantCallName('あつ', 3, null, 'mua') === 'あつ'
    && A.assistantCallName('あつ', 5, null, 'mua') === 'あつちん');
// --- セリフ ---
const kikiLines = (key, cond, lv) => A.assistantSceneLines(key, cond || null, lv, KIKI);
const sceneKeys = Object.keys(A.ASSISTANT_SCENES);
check('全部の場面にききのセリフが5件以上ある', (() => {
  const few = sceneKeys.filter(k => kikiLines(k, null, 1).length < 5);
  return few.length === 0;
})(), sceneKeys.filter(k => kikiLines(k, null, 1).length < 5).map(k => `${k}(${kikiLines(k, null, 1).length})`).join(', '));
check('ききもどのLvでも候補が3件以上ある', (() => {
  const thinK = [];
  for (const k of sceneKeys) for (let lv = 1; lv <= 20; lv++) if (kikiLines(k, null, lv).length < 3) thinK.push(`${k}/Lv${lv}`);
  return thinK.length === 0;
})());
check('ききの条件つきセリフも用意されている', (() => {
  const missing = [];
  for (const k of sceneKeys) for (const cond of Object.keys(A.ASSISTANT_SCENES[k].when || {})) {
    const list = kikiLines(k, cond, 1);
    if (!list.length || !list.some(l => l.who === KIKI)) missing.push(`${k}/${cond}`);
  }
  return missing.length === 0;
})());
// ★ここが混ざると、選んでいない助手のセリフを話してしまう
check('みゅあとききのセリフが混ざらない', (() => {
  for (const k of sceneKeys) for (const lv of [1, 5, 10, 20]) {
    if (kikiLines(k, null, lv).some(l => l.who !== KIKI)) return false;
    if (A.assistantSceneLines(k, null, lv, 'mua').some(l => (l.who || 'mua') !== 'mua')) return false;
  }
  return true;
})());
check('ききも仲良し度で距離感が変わる', (() => {
  const at = (lv) => kikiLines('home', null, lv).map(l => l.t).join('\n');
  return at(1) !== at(4) && at(4) !== at(20);
})());
check('ききのセリフは一人称が「私」', (() => {
  const all = sceneKeys.flatMap(k => [...(A.ASSISTANT_SCENES[k].lines || []),
    ...Object.values(A.ASSISTANT_SCENES[k].when || {}).flat()]).filter(l => l.who === KIKI);
  return all.length > 0 && !all.some(l => /あたし/.test(l.t));
})());

// --- 画面側の結線(助手ごとに分ける) ---
check('助手の選択を新しいキーへ保存する',
  has("const ASSISTANT_SELECTED_KEY = 'mh_assistant_selected_v1';"));
check('仲良し度の保存キーを助手ごとに分ける',
  has('const assistantBondKeyFor = (assistantId) => {')
    && has("? ASSISTANT_BOND_KEY : `mh_assistant_bond_${id}_v1`;"));
check('みゅあの保存キーは今までのまま',
  has("const ASSISTANT_BOND_KEY = 'mh_assistant_bond_v1';")
    && has("const ASSISTANT_CALL_STYLE_KEY = 'mh_assistant_call_style';"));
check('呼び方の保存キーも助手ごとに分ける',
  has('const assistantCallStyleKeyFor = (assistantId) => {')
    && has('? ASSISTANT_CALL_STYLE_KEY : `mh_assistant_call_style_${id}`;'));
check('仲良し度は助手ごとに持つ',
  has('const [assistantBonds, setAssistantBonds] = useState({});')
    && has('const assistantBond = normalizeAssistantBond(assistantBonds[selectedAssistantId]);'));
// ★通常の加算で増えるのは選んでいる助手のぶんだけ。ここが崩れると両方が同時に上がってしまう
check('通常の加算で増えるのは選んでいる助手のぶんだけ',
  has('const id = selectedAssistantIdRef.current;')
    && has('addAssistantBondFor(id, actionKey);')
    && has('setAssistantBonds(prev => ({ ...prev, [id]: result.state }));')
    && has('try { storeSet(assistantBondKeyFor(id), result.state, false); } catch {}'));
check('指定した助手へ加算できる共通処理がある(既存処理はこれを使い回す)',
  has('const addAssistantBondFor = useCallback((assistantId, actionKey) => {')
    && has('const id = normalizeAssistantId(assistantId);'));
// 選んでいない助手のLvが上がっても「Lvが上がった」とは言わせない(本人以外が言ってしまうため)
check('Lvアップの通知は、いま選んでいる助手のときだけ出す',
  has("if (id === selectedAssistantIdRef.current && assistantBondLevelOf(result.state.points) > before) setAssistantBondUp(true);"));
check('助手を切り替えても、もう片方の仲良し度に触れない',
  has('const chooseAssistant = useCallback((id) => {')
    && !/chooseAssistant[\s\S]{0,400}setAssistantBonds\(\{\}\)/.test(source));
check('吹き出しへ、いま選んでいる助手を配る',
  has('assistantId: selectedAssistantId,') && has('const activeId = assistantId || sceneDef?.assistantId || bond.assistantId || null;'));
check('プロフィールから助手を変更できる',
  has('const [showAssistantPicker, setShowAssistantPicker] = useState(false);')
    && has('いっしょに遊ぶ助手'));
check('プロフィールで両方の助手のLvとタイトルを確認できる',
  has('const lv=assistantBondLevelOf(normalizeAssistantBond(assistantBonds[who.id]).points);')
    && has('assistantBondStageByLevel(lv,who.id)'));
check('アップデート通知も、いま選んでいる助手が出す',
  has("const last=page===pages.length-1;const who=activeAssistant;return("));


// ==========================================================================
// 助手のアシストカード(みゅあ・きき)で仲良し度が増える。★重要
// ここだけは「いま選んでいる助手」ではなく「そのカード本人」へ入る。
// 混ざると、みゅあを選んだままききカードを使って、みゅあの仲良し度が上がってしまう
// ==========================================================================

// --- カードIDから本人を引く処理を、本体から取り出して実際に動かす ---
const cardCtx = {};
vm.createContext(cardCtx);
vm.runInContext([
  `const ASSISTANTS = ${JSON.stringify(A.ASSISTANTS.map(a => ({ id: a.id, name: a.name })))};`,
  grab(source, 'const assistantIdOfAssistCard = (cardId) => {', '// 呼び方の上書きも助手ごとに分ける'),
  'globalThis.__c = { assistantIdOfAssistCard };',
].join('\n'), cardCtx);
const C = cardCtx.__c;

check('みゅあカード(id:mua)はみゅあ本人へ結び付く', C.assistantIdOfAssistCard('mua') === 'mua', String(C.assistantIdOfAssistCard('mua')));
check('ききカード(id:kiki)はきき本人へ結び付く', C.assistantIdOfAssistCard('kiki') === 'kiki', String(C.assistantIdOfAssistCard('kiki')));
check('助手以外のアシストカードは結び付かない',
  ['oryo', 'dra', 'atsu', 'cadmium', 'meloso', 'mocchi'].every(id => C.assistantIdOfAssistCard(id) === null));
check('壊れた値でも落ちずにnullを返す',
  [null, undefined, '', 0, {}, []].every(v => C.assistantIdOfAssistCard(v) === null));
// カード名は進化で変わる(みゅあの愛→深愛→慈愛)。名前で判定していたら、ここで外れる
check('カード名ではなくIDで判定している(進化で名前が変わっても外れない)',
  !/assistantIdOfAssistCard[\s\S]{0,300}(baseName|BREEDER_EVO_NAMES|みゅあの愛)/.test(source)
    && has('const assistantIdOfAssistCard = (cardId) => {'));

// --- 誰の仲良し度に入るか。両助手ぶんの保存を並べて実際に加算してみる ---
// 本体と同じ「助手ごとに別の入れ物へ持つ」形を作り、addAssistantBondFor と同じ手順で動かす
const bondsOf = () => ({ mua: G.ASSISTANT_BOND_EMPTY, kiki: G.ASSISTANT_BOND_EMPTY });
const addFor = (bonds, assistantId, actionKey, now = day1) => {
  const r = G.gainAssistantBond(bonds[assistantId], actionKey, now);
  return { ...bonds, [assistantId]: r.state };
};
const pointsOf = (bonds, id) => G.normalizeAssistantBond(bonds[id]).points;

check('ききカードを使うと、ききだけが増える(みゅあは0のまま)', (() => {
  const after = addFor(bondsOf(), 'kiki', 'assistantCardUse');
  return pointsOf(after, 'kiki') === actions.assistantCardUse.amount && pointsOf(after, 'mua') === 0;
})());
check('みゅあカードを使うと、みゅあだけが増える(ききは0のまま)', (() => {
  const after = addFor(bondsOf(), 'mua', 'assistantCardUse');
  return pointsOf(after, 'mua') === actions.assistantCardUse.amount && pointsOf(after, 'kiki') === 0;
})());
check('両方のカードを編成していれば、それぞれ本人へ1回ずつ入る', (() => {
  let b = bondsOf();
  b = addFor(b, 'mua', 'assistantCardEquip');
  b = addFor(b, 'kiki', 'assistantCardEquip');
  const want = actions.assistantCardEquip.amount;
  return pointsOf(b, 'mua') === want && pointsOf(b, 'kiki') === want;
})());
check('カード分を足しても、両助手の保存データは混ざらない', (() => {
  let b = bondsOf();
  // みゅあを選んで通常行動 → みゅあだけ増える
  b = addFor(b, 'mua', 'battle');
  // ききカードを使用 → ききだけ増える
  b = addFor(b, 'kiki', 'assistantCardUse');
  return pointsOf(b, 'mua') === actions.battle.amount && pointsOf(b, 'kiki') === actions.assistantCardUse.amount;
})());
// 指示の例そのまま: ききを選択中＋ききカード編成＋チャレンジクリア＋カード使用
check('仕様の例どおりに積み上がる(きき選択＋ききカード＋チャレンジクリア＋カード使用)', (() => {
  let b = bondsOf();
  for (const k of ['battle', 'challenge', 'clear']) b = addFor(b, 'kiki', k);      // 通常分は選択中の助手へ
  for (const k of ['assistantCardEquip', 'assistantCardUse']) b = addFor(b, 'kiki', k); // カード分も本人へ
  const want = actions.battle.amount + actions.challenge.amount + actions.clear.amount
    + actions.assistantCardEquip.amount + actions.assistantCardUse.amount;
  return pointsOf(b, 'kiki') === want && pointsOf(b, 'mua') === 0;
})(), `期待 ${actions.battle.amount}+${actions.challenge.amount}+${actions.clear.amount}+${actions.assistantCardEquip.amount}+${actions.assistantCardUse.amount}`);
// 行動ごとの1日上限
check('カード編成は1日20で止まる', (() => {
  let b = bondsOf();
  for (let i = 0; i < 50; i++) b = addFor(b, 'kiki', 'assistantCardEquip');
  return pointsOf(b, 'kiki') === actions.assistantCardEquip.dailyMax;
})());
check('カード使用は1日24で止まる', (() => {
  let b = bondsOf();
  for (let i = 0; i < 50; i++) b = addFor(b, 'kiki', 'assistantCardUse');
  return pointsOf(b, 'kiki') === actions.assistantCardUse.dailyMax;
})());
check('上限はみゅあ・ききで別々に数える(片方が上限でももう片方は増える)', (() => {
  let b = bondsOf();
  for (let i = 0; i < 50; i++) b = addFor(b, 'kiki', 'assistantCardUse');
  b = addFor(b, 'mua', 'assistantCardUse');
  return pointsOf(b, 'kiki') === actions.assistantCardUse.dailyMax && pointsOf(b, 'mua') === actions.assistantCardUse.amount;
})());

// --- 編成→加算の経路そのものを動かす ---
// 本体の grantEquippedAssistantCardBond / addAssistantBondFor を取り出し、
// 「いま選んでいる助手」と「編成しているカード」を差し替えて実際に走らせる。
// 文字列の一致だけでは「本人へ入っているか」までは分からないため、ここで通しで確かめる
const runEquip = ({ selected, equippedCardIds, actionKey = 'assistantCardEquip' }) => {
  const bonds = bondsOf();
  const wireCtx = {};
  vm.createContext(wireCtx);
  wireCtx.__bonds = bonds;
  wireCtx.__selected = selected;
  vm.runInContext([
    `const ASSISTANTS = ${JSON.stringify(A.ASSISTANTS.map(a => ({ id: a.id })))};`,
    `const ASSISTANT_BOND_ACTIONS = ${JSON.stringify(actions)};`,
    `const ASSISTANT_BOND_DAILY_MAX = ${A.ASSISTANT_BOND_DAILY_MAX};`,
    `const DEFAULT_ASSISTANT_ID = 'mua';`,
    // normalizeAssistantId は本体側(下のslice)の実装をそのまま使う。ここでは土台だけ用意する
    `const assistantIdOrDefault = (id) => ASSISTANTS.some(a => a.id === id) ? id : DEFAULT_ASSISTANT_ID;`,
    // このsliceの中に normalizeAssistantId・assistantIdOfAssistCard・仲良し度の計算がまとめて入っている
    grab(source, 'const loginBonusPeriodKey =', 'const assistantBondLevelOf'),
    // 本体の中身をそのまま持ってくる(refやsetStateの部分だけ、この場の入れ物へ差し替える)
    `const selectedAssistantIdRef = { current: __selected };`,
    `let bondUp = false;`,
    `const addAssistantBondFor = (assistantId, actionKey) => {
       const id = normalizeAssistantId(assistantId);
       const current = normalizeAssistantBond(__bonds[id]);
       const before = ((p) => p >= 60 ? 2 : 1)(current.points);
       const result = gainAssistantBond(current, actionKey);
       if (!result.changed) return;
       __bonds[id] = result.state;
       if (id === selectedAssistantIdRef.current && ((p) => p >= 60 ? 2 : 1)(result.state.points) > before) bondUp = true;
     };`,
    `const getActiveTeachingCards = () => ${JSON.stringify(equippedCardIds.map(id => ({ id })))};`,
    grab(source, 'const grantEquippedAssistantCardBond = (actionKey) => {', '  const assistantBondLevelNow ='),
    `grantEquippedAssistantCardBond(${JSON.stringify(actionKey)});`,
    `globalThis.__out = { mua: __bonds.mua.points, kiki: __bonds.kiki.points, bondUp };`,
  ].join('\n'), wireCtx);
  return wireCtx.__out;
};

const EQUIP = actions.assistantCardEquip.amount;
check('【通し】みゅあカードを編成して開始 → みゅあ本人へ入る', (() => {
  const r = runEquip({ selected: 'mua', equippedCardIds: ['oryo', 'mua', 'dra'] });
  return r.mua === EQUIP && r.kiki === 0;
})(), JSON.stringify(runEquip({ selected: 'mua', equippedCardIds: ['oryo', 'mua', 'dra'] })));
check('【通し】ききカードを編成して開始 → きき本人へ入る', (() => {
  const r = runEquip({ selected: 'kiki', equippedCardIds: ['kiki', 'atsu'] });
  return r.kiki === EQUIP && r.mua === 0;
})(), JSON.stringify(runEquip({ selected: 'kiki', equippedCardIds: ['kiki', 'atsu'] })));
// ★指示の中心。助手＝みゅあ／カード＝きき なら、増えるのは「きき」でなければならない
check('【通し】選択中がみゅあでも、ききカードならききへ入る(みゅあは0のまま)', (() => {
  const r = runEquip({ selected: 'mua', equippedCardIds: ['kiki'] });
  return r.kiki === EQUIP && r.mua === 0;
})(), JSON.stringify(runEquip({ selected: 'mua', equippedCardIds: ['kiki'] })));
check('【通し】選択中がききでも、みゅあカードならみゅあへ入る(ききは0のまま)', (() => {
  const r = runEquip({ selected: 'kiki', equippedCardIds: ['mua'] });
  return r.mua === EQUIP && r.kiki === 0;
})(), JSON.stringify(runEquip({ selected: 'kiki', equippedCardIds: ['mua'] })));
check('【通し】両方編成していれば、それぞれ本人へ1回ずつ入る', (() => {
  const r = runEquip({ selected: 'mua', equippedCardIds: ['mua', 'kiki', 'oryo'] });
  return r.mua === EQUIP && r.kiki === EQUIP;
})(), JSON.stringify(runEquip({ selected: 'mua', equippedCardIds: ['mua', 'kiki', 'oryo'] })));
check('【通し】助手カードを編成していなければ、どちらも増えない', (() => {
  const r = runEquip({ selected: 'mua', equippedCardIds: ['oryo', 'dra', 'atsu', 'cadmium'] });
  return r.mua === 0 && r.kiki === 0;
})(), JSON.stringify(runEquip({ selected: 'mua', equippedCardIds: ['oryo', 'dra', 'atsu', 'cadmium'] })));
check('【通し】選んでいない助手が上がっても、Lvアップ通知は出さない', (() => {
  // ききだけが上がる状況で、選択中はみゅあ。bondUp が立つと、みゅあが他人のLvアップを話してしまう
  const r = runEquip({ selected: 'mua', equippedCardIds: ['kiki'] });
  return r.bondUp === false;
})());

// --- 画面側の結線。いつ数えるかがここでずれると、付け外しで稼げてしまう ---
check('編成を保存しただけではカード分が増えない', (() => {
  // 編成保存(confirmRoster付近)には partySet しか結線しない
  const at = source.indexOf("addAssistantBond('partySet')");
  if (at < 0) return false;
  const around = source.slice(Math.max(0, at - 1500), at + 1500);
  return !around.includes('assistantCardEquip');
})());
check('カード編成分は、実際にバトルを始めた時だけ数える',
  has("if (!debugBattleRef.current) grantEquippedAssistantCardBond('assistantCardEquip');")
    && /if \(w === 1 && !forcedEnemyKey\) \{[\s\S]{0,600}grantEquippedAssistantCardBond\('assistantCardEquip'\);/.test(source));
check('編成中のカードから本人を引いて加算する',
  has('const grantEquippedAssistantCardBond = (actionKey) => {')
    && has('getActiveTeachingCards().forEach(card => {')
    && has('const who = assistantIdOfAssistCard(card && card.id);')
    && has('if (who) addAssistantBondFor(who, actionKey);'));
check('カード使用分は、実際にカードを使った時だけ数える',
  has("if(isBreeder&&!debugBattleRef.current){ const cardAssistant=assistantIdOfAssistCard(card.id); if(cardAssistant) addAssistantBondFor(cardAssistant,'assistantCardUse'); }"));
check('カード使用の加算は、実際に使ったカードを回すループの中にある', (() => {
  const at = source.indexOf('for (const entry of usedCardEntries) {');
  if (at < 0) return false;
  const use = source.indexOf("addAssistantBondFor(cardAssistant,'assistantCardUse')");
  return use > at && use - at < 1200;
})());
check('デバッグ戦では、カード分を数えない',
  /if\(isBreeder&&!debugBattleRef\.current\)/.test(source)
    && /if \(!debugBattleRef\.current\) grantEquippedAssistantCardBond/.test(source));
// 通常の加算はこれまでどおり選択中の助手へ入る(カード分を足したせいで壊れていないこと)
check('通常のバトル・モード・クリア分は、これまでどおり選択中の助手へ入る',
  has("addAssistantBond('battle');")
    && has("addAssistantBond(extremeRunRef.current ? 'extreme' : modeBondAction(runMode));")
    && has("addAssistantBond('clear');"));

// --- ヘルプ・更新履歴 ---
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelogSrc = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
check('ヘルプは獲得量を実データから表にしている(手で書き写していない)',
  /\{ t:'data', id:'assistantBondActions' \}/.test(helpSrc));
check('ヘルプに助手カードで仲良し度が増えることが書いてある',
  helpSrc.includes('助手のアシストカード'));
check('更新履歴に書いてある',
  changelogSrc.includes('仲良し度') && changelogSrc.includes('助手のアシストカード'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
