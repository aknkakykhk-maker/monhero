#!/usr/bin/env node
// モンヒロバトルにいる助手の 👀 修行を見る・📣 応援する・一人修行の伸び(56-assistant-life-masmon-cheer.jsx)を画面なしで確かめる。
//   印が偽なら何もしない/モンヒロバトルにいるときだけ/移動1回に1回・合わせて1日3回・朝4時に戻る/熟練+1はいちばん低い技・100で止まる/
//   💗 は lifeCheer で +5/練習の相手(フレンド → 自分の別のマスモン → 一人)と一人の伸び/保存の正規化と読み込み前は書かない/数字が台帳と合う
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const train = read('monster-hero/src/parts/56-assistant-life-masmon-train.jsx');
const trainBody = train.slice(0, train.indexOf('// ---------- 画面'));
const cheer = read('monster-hero/src/parts/56-assistant-life-masmon-cheer.jsx');
const cheerBody = cheer.slice(0, cheer.indexOf('// ---------- 👀 修行を見る'));
const techsSrc = read('monster-hero/data/assistant-masmon-techs.js');
const lifeSlots = read('monster-hero/src/parts/56-assistant-life.jsx').match(/^const ASSISTANT_LIFE_SLOTS = [\s\S]*?^\]\);/m)[0];
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const ROWS2 = [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25 }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12 }];
// now … 2026-11-11 12:30 JST(昼)。abs は生活の回の番号
const NOW = Date.UTC(2026, 10, 11, 3, 30);
const make = ({ on = true, rows = ROWS2, place = 'battle', abs = 1000 } = {}) => {
  const saved = {}; const bond = [];
  const ctx = { console, Promise, setTimeout: () => 0,
    RELEASE_FLAGS: { assistantMasmonTrain: true, assistantMasmonCheer: on }, ASSISTANT_MASMON_STORE: { state: { seed: 's' } },
    assistantMasmonRowsOf: () => rows, ALL_PLAYER_MONSTERS: { Golem: {}, Pixie: {} },
    ASSISTANT_LIFE_STORE: { state: { life: { abs, groups: [], solo: { kiki: { place, doing: 'battle' } } } } },
    assistantLifeWhereOf: (life, id) => (life.solo[id] ? { place: life.solo[id].place } : null),
    assistantLifeAddBondWithFx: (who, key, n) => bond.push([who, key, n]),
    storeSet: (k, v) => { saved[k] = JSON.parse(JSON.stringify(v)); }, storeGet: async (k, d) => (k in saved ? saved[k] : d) };
  vm.createContext(ctx);
  vm.runInContext(`${techsSrc}\n${lifeSlots}\n${trainBody}\n${cheerBody}\nthis.T = { AMGT_STORE, AMGC_STORE, AMGC_NUM, amgtDo, amgtKeyOf, amgtInitMon, normalizeAssistantMasmonCheer, assistantMasmonTrainRowInfo, assistantMasmonCheer, amgcSparOf, amgcSparMult, amgcSave, amgcNoteFriend, amgcToday };`, ctx);
  ctx.T.AMGT_STORE.loaded = true; ctx.T.AMGC_STORE.loaded = true;
  return { T: ctx.T, ctx, saved, bond };
};

// ① 印が偽
{
  const { T, bond } = make({ on: false });
  check('① 印が偽なら RowInfo は null', T.assistantMasmonTrainRowInfo('kiki', NOW) === null);
  check('① 印が偽なら応援しない・💗 も入らない', T.assistantMasmonCheer('kiki', 'cheer', NOW).ok === false && bond.length === 0);
  check('① 印が偽なら一人修行の掛け算は 1', T.amgcSparMult('kiki') === 1);
}
// ② 応援の得と回数
{
  const { T, ctx, bond, saved } = make();
  const info = T.assistantMasmonTrainRowInfo('kiki', NOW);
  check('② モンヒロバトルにいれば応援できる(今日 0/3)', info && info.canCheer && info.left === 3 && info.perDay === 3, JSON.stringify(info));
  const r = T.assistantMasmonCheer('kiki', 'cheer', NOW);
  const me = T.AMGT_STORE.state.mons.kiki['1:Golem'];
  const lows = me.learn.map(id => me.m[id] || 0);
  check('② 熟練は +1(いちばん低い技)', r.ok && r.to - r.from === 1 && Math.min(...lows) <= r.to, JSON.stringify(r));
  check('② 💗 は lifeCheer で +5', bond.length === 1 && bond[0][1] === 'lifeCheer' && bond[0][2] === 5, JSON.stringify(bond));
  check('② 同じ移動の回ではもう応援できない', T.assistantMasmonCheer('kiki', 'cheer', NOW).ok === false && bond.length === 1);
  check('② 修行の保存へ書いた', !!(saved.mh_assistant_masmon_train_v1 || ctx.T.AMGT_STORE.state.mons.kiki));
  ctx.ASSISTANT_LIFE_STORE.state.life.abs = 1001;
  check('② 次の移動の回ではまた応援できる(👀 で見ても同じ数え方)', T.assistantMasmonCheer('kiki', 'watch', NOW).ok === true);
  ctx.ASSISTANT_LIFE_STORE.state.life.abs = 1002; T.assistantMasmonCheer('kiki', 'cheer', NOW);
  ctx.ASSISTANT_LIFE_STORE.state.life.abs = 1003;
  const i4 = T.assistantMasmonTrainRowInfo('kiki', NOW);
  check('② 合わせて1日3回まで', i4.left === 0 && !i4.canCheer && T.assistantMasmonCheer('kiki', 'cheer', NOW).ok === false && bond.length === 3, JSON.stringify(i4));
  const next = NOW + 24 * 3600000;
  check('② 朝4時を過ぎた次の日はまた3回', T.assistantMasmonTrainRowInfo('kiki', next).left === 3);
}
// ③ モンヒロバトルにいないとき
{
  const { T } = make({ place: 'cafe' });
  const i = T.assistantMasmonTrainRowInfo('kiki', NOW);
  check('③ モンヒロバトルにいなければ応援できない', i && !i.canCheer && /モンヒロバトル/.test(i.why) && T.assistantMasmonCheer('kiki', 'cheer', NOW).ok === false);
  const none = make({ rows: [] });
  check('③ マスモンがいなければ RowInfo は null', none.T.assistantMasmonTrainRowInfo('kiki', NOW) === null);
}
// ④ 熟練は100で止まる
{
  const { T } = make();
  T.assistantMasmonCheer('kiki', 'cheer', NOW);
  const me = T.AMGT_STORE.state.mons.kiki['1:Golem'];
  for (const id of me.learn) me.m[id] = 100;
  T.ctx = null;
  const st = T.AMGT_STORE.state; st.mons.kiki['1:Golem'] = me;
  // 次の回
  const m2 = make(); m2.T.AMGT_STORE.state = st; m2.ctx.ASSISTANT_LIFE_STORE.state.life.abs = 1001;
  const r = m2.T.assistantMasmonCheer('kiki', 'cheer', NOW);
  check('④ 熟練は100より上がらない', r.ok && r.to === 100, JSON.stringify(r));
}
// ⑤ 練習の相手と一人修行の伸び
{
  check('⑤ 自分のマスモンが2体なら相手あり(own)', make().T.amgcSparOf('kiki', NOW) === 'own');
  const one = make({ rows: [ROWS2[0]] });
  check('⑤ 1体だけ・フレンド無しは一人(solo)・伸び×0.5', one.T.amgcSparOf('kiki', NOW) === 'solo' && one.T.amgcSparMult('kiki') === 0.5);
  one.T.amgcNoteFriend(true, NOW);
  check('⑤ フレンドの登録編成を見つけたら friend(伸びは1)', one.T.amgcSparOf('kiki', NOW) === 'friend' && one.T.amgcSparMult('kiki') === 1);
  check('⑤ フレンドは7日で切れる', one.T.amgcSparOf('kiki', NOW + 7 * 86400000) === 'solo');
  // 同じ種で修行1回: 一人のほうが伸びが小さい
  const gain = (rows) => {
    const { T } = make({ rows });
    const e = { st: { life: 150, pow: 220, wise: 110, hit: 130, eva: 120, tough: 120 }, fat: 0, str: 0, lv: 25 };
    const slot = 20403 * 3 + 1; let sum = 0;
    for (let k = 0; k < 12; k++) { const ee = { ...e, st: { ...e.st } }; T.amgtDo('kiki', ee, rows[0], null, slot + k * 3, { a: 'shugyo', k: 'pow' }, () => {}, () => 0); if (ee.shugyo) sum += Object.values(ee.shugyo.g).reduce((a, b) => a + b, 0); }
    return sum;
  };
  const own = gain(ROWS2), solo = gain([ROWS2[0]]);
  check('⑤ 一人で修行すると伸びが下がる(12回の合計)', solo < own && solo >= Math.floor(own * 0.3), `相手あり ${own} / 一人 ${solo}`);
}
// ⑥ 保存の正規化・読み込み前は書かない
{
  const { T } = make();
  const n = T.normalizeAssistantMasmonCheer({ day: { kiki: { d: 5, n: 2, s: [1, 1, 'x', 3] }, BAD: { d: 1 } }, fr: 'x' });
  check('⑥ 正規化: 正しい助手だけ・回の番号は整数だけ・fr は -1', JSON.stringify(n) === JSON.stringify({ v: 1, day: { kiki: { d: 5, n: 2, s: [1, 3] } }, fr: -1 }), JSON.stringify(n));
  check('⑥ 壊れた値は既定値', JSON.stringify(T.normalizeAssistantMasmonCheer('x')) === JSON.stringify({ v: 1, day: {}, fr: -1 }));
  const m = make(); m.T.AMGC_STORE.loaded = false;
  check('⑥ 読み込む前は書かない', m.T.amgcSave({ v: 1, day: {}, fr: 3 }) === false && !m.saved.mh_assistant_masmon_cheer_v1);
}
// ⑦ 数字と印
{
  const { T } = make();
  check('⑦ 数字は社長の答えのまま(熟練+1・💗+5・1日3回・一人×0.5)', T.AMGC_NUM.mastery === 1 && T.AMGC_NUM.bond === 5 && T.AMGC_NUM.perDay === 3 && T.AMGC_NUM.soloMult === 0.5);
  check('⑦ assistants.js の lifeCheer は +5・1日15', /lifeCheer:\s*\{\s*amount:5,\s*dailyMax:15,/.test(read('monster-hero/data/assistants.js')));
  check('⑦ 公開の印 assistantMasmonCheer は偽(社長の「この文で」の前)', /assistantMasmonCheer: false,/.test(read('monster-hero/src/parts/17-release-changelog-login-missions.jsx')));
}

console.log(ng ? `\n${ng} 件 NG` : '\nすべてOK');
process.exit(ng ? 1 : 0);
