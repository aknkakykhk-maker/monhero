// 助手どうしのつながり(2026-11-07 社長「ガッツリ作りこんで」)を確かめる。ブラウザは使わない。
//   node tools/assistant/assistant-peer-check.js
// 設計: docs/progress/assistant-peer-plan.md
//   ① 台本: 会った助手の全ペアに、Lv1 の掛け合い2本以上・Lv2 と Lv4 の掛け合い・Lv5 の特別なお話がある。
//      話し手はそのペアの2人だけ・表情は決まった8つ・{c} はかならず呼び方に置きかわる
//   ② 口調: みゅあは「じゃん」「まじ」ではなく「ぢゃん」「まぢ」/ あつは文の最後に「笑」か記号か顔文字 /
//      一人称の取り違え(ももすけの「私」「あたし」、ドラ以外の「おで」など)が無い
//   ③ 守り: モンスターを「子」と呼ばない・恋愛のことばが無い・呼び方に敬称が重ならない
//   ④ 呼び方は仲良し度が上がっても変えない(2026-11-07 社長「呼び方は変えないでいい」)
//   ⑤ 仲良し度: 行動ごと・ペアごとの1日の上限で止まる・日付が変わると数え直す・Lv の境目
//   ⑥ 掛け合いの選び方: 会っていない助手は出ない・Lv の足りない台本は出ない・1日の数の上限・
//      Lv5 の特別なお話を HOME で先に流す・ほかの画面はその画面の台本を先に出す
//   ⑥ API 版で作った掛け合い: 崩れたものは捨てる・HOME で台本より先に出す・見たもの/会っていない助手のものは出さない
//   ⑦ 保存: 新しいキー(mh_assistant_peer_*)だけに書く。壊れた値でも空として読む
//   ⑪ ③ ミニイベント・3人の掛け合い・けんか→仲直り・Lv10 の2本目の特別なお話(台本の形・出る条件・増え方)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// data/assistants.js と 56-assistant-peer.jsx を、保存をまねた入れ物の中で読む
const mem = {};
const writes = [];
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp,
  React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
  RELEASE_FLAGS: { assistantPeer: true },
});
vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistants.js'), 'utf8'), ctx);
let dayNow = '2026-11-07';
vm.runInContext('var assistantBubbleDayKey = () => __day(); var assistantPeerDayKey = () => __day(); var assistantById = (id) => ASSISTANTS.find(a => a.id === id);', Object.assign(ctx, { __day: () => dayNow }));
const part = babel.transformSync(fs.readFileSync(path.join(root, 'monster-hero', 'src', 'parts', '56-assistant-peer.jsx'), 'utf8'), { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code;
vm.runInContext(part, ctx);
const G = (expr) => vm.runInContext(expr, ctx);

const TALKS = G('ASSISTANT_PEER_TALKS');
// 口調・守りは ③ の台本(ミニイベント・けんか/仲直り・3人の掛け合い)もまとめて見る
const ALLT = G('assistantPeerAllTalks()');
const CALLS = G('ASSISTANT_PEER_CALLS');
const IDS = Object.keys(CALLS);
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const SCENES = ['any', 'home', 'market', 'rhythm', 'masu', 'card'];
const pairKey = (a, b) => [a, b].sort().join('-');

// ① 台本
{
  const pairs = [];
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) pairs.push(pairKey(IDS[i], IDS[j]));
  const missing = [];
  for (const p of pairs) {
    const list = TALKS.filter(t => pairKey(t.pair[0], t.pair[1]) === p);
    const anyLv1 = list.filter(t => !t.special && t.lv === 1).length;
    if (anyLv1 < 2 || !list.some(t => !t.special && t.lv === 2) || !list.some(t => !t.special && t.lv === 4) || !list.some(t => t.special && t.lv === 5)) missing.push(p);
  }
  check(`① 全${pairs.length}ペアに、Lv1 の掛け合い2本以上・Lv2 と Lv4 の掛け合い・Lv5 の特別なお話がある`, missing.length === 0, missing.join(','));
  const ids = TALKS.map(t => t.id);
  check('① 台本の id が重ならない', new Set(ids).size === ids.length);
  const bad = [];
  for (const t of TALKS) {
    if (!SCENES.includes(t.scene)) bad.push(`${t.id}:場面${t.scene}`);
    if (t.lines.length < 2) bad.push(`${t.id}:1行だけ`);
    for (const l of t.lines) {
      if (!t.pair.includes(l.who)) bad.push(`${t.id}:${l.who}はペアでない`);
      if (!EXPR.includes(l.e)) bad.push(`${t.id}:表情${l.e}`);
      const txt = G('assistantPeerLineText')(l, t);
      if (/\{|\}/.test(txt) || !txt) bad.push(`${t.id}:置きかえ残り`);
    }
    if (!new Set(t.lines.map(l => l.who)).size === 2) bad.push(`${t.id}:1人しか話さない`);
  }
  check('① 話し手はペアの2人だけ・表情は8つのうち・{c} は呼び方に置きかわる・場面は決まったもの', bad.length === 0, bad.slice(0, 8).join(' / '));
  const example = G('assistantPeerLineText')(TALKS.find(t => t.id === 'kiki-mua-1').lines[0], TALKS.find(t => t.id === 'kiki-mua-1'));
  check('① みゅあ→ききは「ひめちん」で呼ぶ(ASSISTANT_PEER_CALLS)', /^ひめちん、/.test(example), example);
  const draMomo = G('assistantPeerCall')('dra', 'momosuke');
  check('① 呼び方の ( ) の注記は外す(ドラ→もも「もも」)', draMomo === 'もも', draMomo);
}

// ② 口調
{
  const lines = (who) => ALLT.flatMap(t => [...t.lines, ...(t.choice || []).flatMap(o => o.reply)].filter(l => l.who === who).map(l => ({ id: t.id, t: l.t })));
  const ng = (who, re) => lines(who).filter(x => re.test(x.t)).map(x => `${x.id}「${x.t}」`);
  check('② みゅあは「じゃん」「まじ」を使わない(「ぢゃん」「まぢ」・2026-10-25 社長)', ng('mua', /じゃん|まじ/).length === 0, ng('mua', /じゃん|まじ/).join(' / '));
  const atsuBad = lines('atsu').filter(x => !/(笑|[！？!?…。]|[)）ノ])$/.test(x.t.trim()));
  check('② あつのセリフは、最後に「笑」か記号か顔文字(2026-10-22 社長)', atsuBad.length === 0, atsuBad.map(x => `${x.id}「${x.t}」`).join(' / '));
  check('② ももすけは自分を「私」「あたし」と言わない', ng('momosuke', /私|あたし/).length === 0, ng('momosuke', /私|あたし/).join(' / '));
  const notDra = IDS.filter(id => id !== 'dra').flatMap(id => ng(id, /おで|ワイ/));
  check('② 「おで」「ワイ」はドラだけ', notDra.length === 0, notDra.join(' / '));
  check('② ドラは「俺」「僕」「私」を使わない', ng('dra', /俺|僕|私/).length === 0, ng('dra', /俺|僕|私/).join(' / '));
  check('② みゅあは「あたし」(「私」「俺」を使わない)', ng('mua', /私|俺/).length === 0, ng('mua', /私|俺/).join(' / '));
  check('② ききはタメ口の語尾(「だよ」「だね」「してよ」)を使わない', ng('kiki', /だよ|だね|してよ/).length === 0, ng('kiki', /だよ|だね|してよ/).join(' / '));
  check('② あつは自分で「リーダー」と言わない・だれも「S」と言わない', ng('atsu', /(^|[^ブ])リーダー/).length === 0 && IDS.every(id => ng(id, /ドS|[^A-Za-z]S[^A-Za-z]/).length === 0));
}

// ③ 守り
{
  const all = ALLT.flatMap(t => [...t.lines, ...(t.choice || []).flatMap(o => o.reply), ...(t.choice || []).map(o => ({ t: o.label }))].map(l => ({ id: t.id, t: l.t })));
  const ko = all.filter(x => /(この|あの|その|うちの|いい|強い)子|子たち/.test(x.t));
  check('③ モンスターを「子」と呼ばない(2026-11-06 社長)', ko.length === 0, ko.map(x => x.id).join(','));
  const love = all.filter(x => /恋|デート|付き合|キス|彼氏|彼女|結婚|ラブ/.test(x.t));
  check('③ 恋愛のことばが無い', love.length === 0, love.map(x => x.id).join(','));
  const dirty = all.filter(x => /バカ|ばか(?!り)|きらい|嫌い|うざ|ブス|最低/.test(x.t));
  check('③ 悪口のことばが無い', dirty.length === 0, dirty.map(x => `${x.id}「${x.t}」`).join(' / '));
  // 敬称が重ならない(「{c}さん」と書かない)
  const hon = ALLT.flatMap(t => [...t.lines, ...(t.choice || []).flatMap(o => o.reply)].filter(l => /\{c(:[a-z]+)?\}(さん|ちゃん|くん|ちん)/.test(l.t)).map(() => t.id));
  check('③ {c} のあとに敬称を付けない(呼び方に入っている)', hon.length === 0, hon.join(','));
}

// ④ 呼び方は変えない
{
  check('④ 呼び方を仲良し度で変える表(ASSISTANT_PEER_CALLS_CLOSE)を持たない', G('typeof ASSISTANT_PEER_CALLS_CLOSE') === 'undefined');
  const t = TALKS.find(x => x.id === 'kiki-mua-4');
  const kiki = t && t.lines.find(l => l.who === 'kiki' && /\{c\}/.test(l.t));
  check('④ Lv4 の掛け合いでも今の呼び方(きき→みゅあ「みゅあちん」)', !!kiki && G('assistantPeerLineText')(kiki, t).startsWith('みゅあちん'));
}

// ⑤ 仲良し度
(async () => {
  const gain = G('assistantPeerGainState');
  const empty = () => ({ loaded: true, bond: {}, bondDay: { day: null, got: {} }, log: [], talkDay: { day: null, home: 0, other: 0 }, special: [], gen: { day: null, asked: 0, talks: [] }, daily: { day: null, pair: null, seen: 0, done: false, lastDay: null, streak: 0 }, choice: {}, album: {}, lastShownAt: 0 });
  let st = empty();
  let r = gain(st, 'mua', 'kiki', 'story', '2026-11-07'); st = r.st;
  check('⑤ お話に2人が出ると +6(ペアは名前順のキー "kiki-mua")', r.gained === 6 && st.bond['kiki-mua'] === 6);
  r = gain(st, 'kiki', 'mua', 'story', '2026-11-07');
  check('⑤ お話はペアごとに1日6まで', r.gained === 0);
  for (let i = 0; i < 5; i++) { r = gain(st, 'mua', 'kiki', 'talk', '2026-11-07'); st = r.st; }
  r = gain(st, 'mua', 'kiki', 'switch', '2026-11-07'); st = r.st;
  r = gain(st, 'mua', 'kiki', 'choice', '2026-11-07'); st = r.st; r = gain(st, 'mua', 'kiki', 'choice', '2026-11-07'); st = r.st;
  r = gain(st, 'mua', 'kiki', 'choice', '2026-11-07');
  check('⑤ ペアごとの1日の合計は20で止まる(お話6+掛け合い6+切り替え3+返事5で止まる)', st.bond['kiki-mua'] === 20 && r.gained === 0, String(st.bond['kiki-mua']));
  r = gain(st, 'mua', 'kiki', 'daily', '2026-11-07'); st = r.st;
  check('⑤ 今日のペアの達成(+10)は1日20の上限の外で数える', r.gained === 10 && st.bond['kiki-mua'] === 30);
  r = gain(st, 'mua', 'dra', 'switch', '2026-11-07');
  check('⑤ ほかのペアは別に数える', r.gained === 3);
  r = gain(st, 'mua', 'kiki', 'switch', '2026-11-08'); st = r.st;
  check('⑤ 日付が変わると数え直す', r.gained === 3 && st.bond['kiki-mua'] === 33);
  check('⑤ 同じ助手どうし・知らない行動は上がらない', gain(st, 'mua', 'mua', 'talk', 'x').gained === 0 && gain(st, 'mua', 'kiki', 'nope', 'x').gained === 0);
  const lv = G('assistantPeerBondLevel');
  check('⑤ Lv の境目(0/40/120/250/450/700/1000/1400/1900/2500・2026-11-07)', [0, 39, 40, 119, 120, 249, 250, 449, 450, 699, 700, 999, 1000, 1399, 1400, 1899, 1900, 2499, 2500, 99999].map(lv).join(',') === '1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10');
  const r2 = gain({ ...empty(), bond: { 'kiki-mua': 38 } }, 'mua', 'kiki', 'story', 'd');
  check('⑤ 上がったときは Lv の前と後を返す(Lv2 になった)', r2.levelBefore === 1 && r2.levelAfter === 2);

  // ⑥ 選び方
  const pick = G('assistantPeerPickTalk');
  const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
  const base = { ...empty() };
  const met = ['mua', 'kiki', 'momosuke'];
  let p = pick(base, { scene: 'home', metIds: met, selectedId: 'mua', now: Date.parse('2026-11-07T03:00:00Z'), rand: seq(0, 0.5) });
  check('⑥ 会った助手だけのペアから出る', p && met.includes(p.talk.pair[0]) && met.includes(p.talk.pair[1]), p && p.talk.id);
  let leak = 0;
  for (let i = 0; i < 200; i++) {
    const q = pick(base, { scene: 'home', metIds: met, selectedId: 'mua', now: 1e13, rand: Math.random });
    if (q && (q.talk.lv > 1 || q.talk.special || !(q.talk.scene === 'any' || q.talk.scene === 'home'))) leak++;
  }
  check('⑥ Lv1 のペアには Lv2 の台本・特別なお話・ほかの画面の台本が出ない', leak === 0, String(leak));
  check('⑥ 割合に外れたら出さない', pick(base, { scene: 'home', metIds: met, selectedId: 'mua', now: 1e13, rand: () => 0.99 }) === null);
  const day = G('assistantPeerDayKey')();
  check('⑥ HOME は1日5回まで', pick({ ...base, talkDay: { day, home: 5, other: 0 } }, { scene: 'home', metIds: met, selectedId: 'mua', now: Date.now(), rand: () => 0 }) === null);
  check('⑥ ほかの画面は1日3回まで', pick({ ...base, talkDay: { day, home: 0, other: 3 } }, { scene: 'market', metIds: met, selectedId: 'mua', now: Date.now(), rand: () => 0 }) === null);
  check('⑥ 続けて流さない(前に流してから90秒)', pick({ ...base, lastShownAt: Date.now() - 1000 }, { scene: 'home', metIds: met, selectedId: 'mua', now: Date.now(), rand: () => 0 }) === null);
  const lv5 = { ...base, bond: { 'kiki-mua': 500 } };
  p = pick(lv5, { scene: 'home', metIds: met, selectedId: 'momosuke', now: 1e13, rand: () => 0.99 });
  check('⑥ Lv5 になったペアの特別なお話は、割合に関係なく HOME で先に流す', p && p.special && p.talk.id === 'kiki-mua-sp');
  p = pick({ ...lv5, special: ['kiki-mua'] }, { scene: 'home', metIds: met, selectedId: 'momosuke', now: 1e13, rand: () => 0.99 });
  check('⑥ 見た特別なお話は、もう流さない', p === null);
  p = pick(base, { scene: 'market', metIds: met, selectedId: 'mua', now: 1e13, rand: seq(0, 0) });
  check('⑥ マーケットではマーケットの台本を先に出す', p && p.talk.scene === 'market', p && p.talk.id);
  p = pick(base, { scene: 'card', metIds: ['mua', 'kiki'], selectedId: 'mua', now: 1e13, rand: seq(0, 0) });
  check('⑥ その画面の台本が無いペアは、どこでもの台本から出す', p && p.talk.scene === 'any', p && p.talk.id);

  // ⑥-2 API 版で作った掛け合い(段階3)
  const ng = G('normalizeAssistantPeerGen');
  const gen = ng({ day, asked: 1, talks: [
    { id: 'gen-1', pair: ['mua', 'kiki'], lines: [{ who: 'mua', e: 'happy', t: '{c}、おはよ！' }, { who: 'kiki', e: 'wink', t: 'おはようございまつ' }] },
    { id: 'gen-bad1', pair: ['mua', 'kiki'], lines: [{ who: 'dra', e: 'happy', t: 'ちがう人' }, { who: 'kiki', e: 'wink', t: 'はい' }] },
    { id: 'gen-bad2', pair: ['mua', 'kiki'], lines: [{ who: 'mua', e: 'happy', t: '{name} の印' }, { who: 'kiki', e: 'wink', t: 'はい' }] },
    { id: 'gen-bad3', pair: ['mua', 'nobody'], lines: [{ who: 'mua', e: 'happy', t: 'だれ' }, { who: 'nobody', e: 'wink', t: 'はい' }] },
  ] });
  check('⑥ API 版の掛け合いは、形の崩れたもの(ペア外の話し手・{c} 以外の印・知らない助手)を捨てて読む', gen.talks.length === 1 && gen.talks[0].id === 'gen-1' && gen.talks[0].gen === true);
  p = pick({ ...base, gen }, { scene: 'home', metIds: met, selectedId: 'mua', now: Date.now() + 1e9, rand: seq(0, 0) });
  check('⑥ HOME では、その日に作った掛け合いを台本より先に出す', p && p.talk.id === 'gen-1', p && p.talk.id);
  p = pick({ ...base, gen, log: [{ id: 'gen-1', at: 1 }] }, { scene: 'home', metIds: met, selectedId: 'mua', now: Date.now() + 1e9, rand: seq(0, 0) });
  check('⑥ 見た作った掛け合いは出さず、台本へ戻る', p && !p.talk.gen, p && p.talk.id);
  p = pick({ ...base, gen }, { scene: 'home', metIds: ['mua', 'dra'], selectedId: 'mua', now: Date.now() + 1e9, rand: seq(0, 0) });
  check('⑥ 会っていない助手の入った作った掛け合いは出さない', p && !p.talk.gen, p && p.talk.id);
  check('⑥ API 版の公開の印(assistantPeerApi)が偽なら頼まない', (ctx.RELEASE_FLAGS.assistantPeerApi = false, G('assistantPeerApiEnabled')()) === false);

  // ⑧ 返事を選ぶ掛け合い・その日の出来事(2026-11-07)
  const pairsAll = [];
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) pairsAll.push(pairKey(IDS[i], IDS[j]));
  const noChoice = pairsAll.filter(pk => !TALKS.some(t => pairKey(t.pair[0], t.pair[1]) === pk && Array.isArray(t.choice)));
  check('⑧ 全28ペアに返事を選ぶ掛け合いがある', noChoice.length === 0, noChoice.join(','));
  const badChoice = TALKS.filter(t => t.choice && !(t.choice.length === 3 && t.choice.every(o => typeof o.label === 'string' && o.label.length <= 16 && o.reply.length >= 1 && o.reply.every(l => t.pair.includes(l.who) && EXPR.includes(l.e)))));
  check('⑧ 返事は3つ・16字まで・反応はペアの2人だけ', badChoice.length === 0, badChoice.map(t => t.id).join(','));
  const WHEN = G('ASSISTANT_PEER_WHEN');
  const badWhen = TALKS.filter(t => t.when && !WHEN[t.when]);
  check('⑧ その日の出来事は決まった種類だけ', badWhen.length === 0, badWhen.map(t => t.id).join(','));
  check('⑧ その日の出来事は、どの種類にも4本以上', Object.keys(WHEN).every(w => TALKS.filter(t => t.when === w).length >= 4));
  const wok = G('assistantPeerWhenOk');
  const jst = (s) => Date.parse(`${s}+09:00`);
  check('⑧ 時間・季節の判定(日本時間)', wok('morning', { now: jst('2026-11-07T07:00:00') }) && !wok('morning', { now: jst('2026-11-07T12:00:00') })
    && wok('night', { now: jst('2026-11-07T23:30:00') }) && wok('christmas', { now: jst('2026-12-24T12:00:00') }) && !wok('christmas', { now: jst('2026-12-26T12:00:00') })
    && wok('newyear', { now: jst('2027-01-03T12:00:00') }) && wok('winter', { now: jst('2027-02-10T12:00:00') }) && !wok('winter', { now: jst('2026-11-07T12:00:00') }));
  check('⑧ その日の遊び方・連続ログインの判定', wok('battle', { today: { battles: 1 } }) && !wok('battle', { today: {} }) && wok('clear', { today: { clears: 2 } }) && wok('streak', { streak: 3 }) && !wok('streak', { streak: 2 }));
  let leakWhen = 0;
  for (let i = 0; i < 200; i++) { const q = pick(base, { scene: 'home', metIds: IDS, selectedId: 'mua', now: jst('2026-11-07T13:00:00') + 1e3, rand: Math.random, today: {} }); if (q && q.talk.when && !['winter'].includes(q.talk.when)) leakWhen++; }
  check('⑧ 合わない日の出来事の掛け合いは出ない', leakWhen === 0, String(leakWhen));

  // ⑨ 今日のペア・アルバム・プレイヤーの親密度
  const store = G('ASSISTANT_PEER_STORE');
  const added = [];
  G('assistantPeerSetPlayerBondAdder')((id, act) => added.push(`${id}:${act}`));
  ctx.RELEASE_FLAGS.assistantPeer = true;
  store.set({ ...empty(), daily: { day: '2026-11-06', pair: 'dra-mua', seen: 3, done: true, lastDay: '2026-11-06', streak: 2 } });
  dayNow = '2026-11-07';
  const d1 = G('assistantPeerEnsureDaily')(['mua', 'kiki', 'dra'], Date.parse('2026-11-07T03:00:00Z'));
  check('⑨ 日が変わると今日のペアを決め直し、続けてログインした日数を数える', d1 && d1.day === '2026-11-07' && /^[a-z]+-[a-z]+$/.test(d1.pair) && d1.seen === 0 && d1.streak === 3);
  check('⑨ 今日のペアは会った助手のペアから、日付で決まる', G('assistantPeerTodayPairOf')(['mua', 'kiki', 'dra'], '2026-11-07') === d1.pair && ['dra-kiki', 'dra-mua', 'kiki-mua'].includes(d1.pair));
  const dt = TALKS.find(t => pairKey(t.pair[0], t.pair[1]) === d1.pair && !t.special);
  await G('assistantPeerDailyProgress')(dt); await G('assistantPeerDailyProgress')(dt);
  const before3 = store.state.bond[d1.pair] || 0;
  const p3 = await G('assistantPeerDailyProgress')(dt);
  check('⑨ 今日のペアの掛け合いを3回見ると達成。ペア +10・2人それぞれの親密度(peerDaily)', p3.done === true && store.state.daily.done === true && (store.state.bond[d1.pair] || 0) - before3 === 10
    && dt.pair.every(id => added.includes(`${id}:peerDaily`)), added.join(','));
  const p4 = await G('assistantPeerDailyProgress')(dt);
  check('⑨ 達成は1日1回', p4.done === false);
  const other = TALKS.find(t => pairKey(t.pair[0], t.pair[1]) !== d1.pair);
  check('⑨ 今日のペアでない掛け合いは数えない', (await G('assistantPeerDailyProgress')(other)).done === false);
  G('assistantPeerAlbumAdd')(dt); G('assistantPeerAlbumAdd')(dt);
  G('assistantPeerAlbumAdd')({ id: 'gen-x', pair: dt.pair, gen: true, lines: [] });
  const al = store.state.album[pairKey(dt.pair[0], dt.pair[1])] || [];
  check('⑨ アルバムには見た台本が1回だけ入り、API 版で作ったものは入らない', al.length === 1 && al[0] === dt.id);
  const PH = G('ASSISTANT_PEER_PHOTOS');
  check('⑨ ツーショット写真は Lv3・5・8・10 の4枚', JSON.stringify(PH.map(x => x.lv)) === '[3,5,8,10]' && PH.every(x => x.e.every(e => EXPR.includes(e))));
  const BA = G('ASSISTANT_BOND_ACTIONS');
  check('⑨ プレイヤーの親密度の新しい行動(掛け合いを見る+2/10・返事+5/15・今日のペア+20/20)は公開の印 assistantPeer の後ろ',
    BA.peerTalk.amount === 2 && BA.peerTalk.dailyMax === 10 && BA.peerChoice.amount === 5 && BA.peerChoice.dailyMax === 15 && BA.peerDaily.amount === 20 && BA.peerDaily.dailyMax === 20
    && ['peerTalk', 'peerChoice', 'peerDaily'].every(k => BA[k].releaseFlag === 'assistantPeer'));
  added.length = 0;
  ctx.RELEASE_FLAGS.assistantPeer = false;
  G('assistantPeerAddPlayerBond')(['mua', 'kiki'], 'peerTalk');
  check('⑨ 公開の印が偽ならプレイヤーの親密度も増やさない', added.length === 0);
  ctx.RELEASE_FLAGS.assistantPeer = true;

  // ⑪ ③ ミニイベント・3人の掛け合い・けんか→仲直り・Lv10 の2本目
  {
    const X = G('assistantPeerExtraTalks()');
    const lineOk = (t, l, members) => members.includes(l.who) && EXPR.includes(l.e) && l.t.length <= 60 && !/[{}]/.test(G('assistantPeerLineText')(l, t));
    // ミニイベント
    const evBad = X.events.filter(t => t.lines.length < 6 || t.lines.length > 8 || !Array.isArray(t.choice) || t.choice.length !== 3 || !t.title
      || t.choice.some(o => !o.label || o.label.length > 16 || !Array.isArray(o.reply) || o.reply.length < 1 || !o.reply.every(l => lineOk(t, l, t.pair)))
      || !t.lines.every(l => lineOk(t, l, t.pair)) || new Set(t.lines.map(l => l.who)).size !== 2);
    check(`⑪ ミニイベントは12本以上(いま${X.events.length}本)・6〜8行・判定の返事3つ(16字まで)・話し手はペアの2人・1行60字まで`, X.events.length >= 12 && evBad.length === 0, evBad.map(t => t.id).join(','));
    const evIds = new Set(X.events.map(t => pairKey(t.pair[0], t.pair[1])));
    check('⑪ ミニイベントは8人全員が出る', IDS.every(id => X.events.some(t => t.pair.includes(id))), [...evIds].join(','));
    // けんか→仲直り
    const qs = X.quarrels.filter(t => t.kind === 'quarrel'), mk = X.quarrels.filter(t => t.kind === 'makeup');
    const qBad = X.quarrels.filter(t => t.lines.length < 3 || !t.lines.every(l => lineOk(t, l, t.pair)) || new Set(t.lines.map(l => l.who)).size !== 2);
    check(`⑪ けんかと仲直りは8組(いま${qs.length}組)・どのけんかにも仲直りがある・話し手はペアの2人`, qs.length >= 8 && qs.every(q => mk.some(m => m.quarrelId === q.id)) && qBad.length === 0, qBad.map(t => t.id).join(','));
    check('⑪ 仲直りでは2人とも「ごめん」と言う(かわいい言い合いで終える)', mk.every(m => m.pair.every(id => m.lines.some(l => l.who === id && /ごめん/.test(l.t)))), mk.filter(m => !m.pair.every(id => m.lines.some(l => l.who === id && /ごめん/.test(l.t)))).map(m => m.id).join(','));
    // 3人の掛け合い
    const groups = [...new Set(X.trios.map(t => [...t.trio].sort().join('-')))];
    const trBad = X.trios.filter(t => t.trio.length !== 3 || new Set(t.trio).size !== 3 || !t.trio.every(id => IDS.includes(id)) || !t.lines.every(l => lineOk(t, l, t.trio))
      || new Set(t.lines.map(l => l.who)).size !== 3 || t.lines.some(l => /\{c\}/.test(l.t))
      || t.lines.some(l => [...l.t.matchAll(/\{c:([a-z]+)\}/g)].some(m => !t.trio.includes(m[1]) || m[1] === l.who)));
    check(`⑪ 3人の掛け合いは決まった8組×2本(いま${groups.length}組${X.trios.length}本)・3人とも話す・{c:id} は自分以外の2人`, groups.length === 8 && groups.every(g => X.trios.filter(t => [...t.trio].sort().join('-') === g).length >= 2) && trBad.length === 0, trBad.map(t => t.id).join(','));
    const tr = X.trios[0];
    const tx = G('assistantPeerLineText')(tr.lines[0], tr);
    check('⑪ 3人の {c:kiki} は話し手の呼び方に置きかわる(みゅあ→きき「ひめちん」・みゅあ→もも「もも」)', tx.startsWith('ひめちん、もも！'), tx);
    const allIds = ALLT.map(t => t.id);
    check('⑪ 台本の id が全体で重ならない', new Set(allIds).size === allIds.length);

    // 出る条件
    const now0 = Date.parse('2026-11-07T03:00:00Z');
    const bondOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v]));
    const many = (st, opts, n = 400) => { const got = []; for (let i = 0; i < n; i++) { const rr = (() => { let k = 0; const xs = [0, Math.random()]; return () => (k < xs.length ? xs[k++] : Math.random()); })(); const p = pick(st, { now: now0, rand: rr, ...opts }); if (p) got.push(p.talk); } return got; };
    // Lv2 のペアだけ: ミニイベント(Lv3)は出ない・けんかは HOME で出る
    const lv2 = { ...empty(), bond: bondOf({ 'kiki-kyuko': 50 }) };
    const g2 = many(lv2, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki' });
    check('⑪ ミニイベントは Lv3 から(Lv2 のペアには出ない)', !g2.some(t => t.kind === 'event'));
    check('⑪ Lv2〜3 のペアには、HOME でけんかがたまに出る', g2.some(t => t.kind === 'quarrel'));
    const g2m = many(lv2, { scene: 'market', metIds: ['kiki', 'kyuko'], selectedId: 'kiki' });
    check('⑪ けんかは HOME だけ', !g2m.some(t => t.kind === 'quarrel'));
    const lv4 = { ...empty(), bond: bondOf({ 'kiki-kyuko': 260 }) };
    const g4 = many(lv4, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki' });
    check('⑪ Lv4 になったペアにはけんかが出ない・ミニイベントは出る', !g4.some(t => t.kind === 'quarrel') && g4.some(t => t.kind === 'event'));
    const share = (list) => list.filter(t => t.kind === 'event').length / Math.max(1, list.length);
    const g6 = many({ ...empty(), bond: bondOf({ 'kiki-kyuko': 710 }), special: ['kiki-kyuko'] }, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki' }, 800);
    check('⑪ ミニイベントは Lv6 から出やすくなる', share(g6) > share(g4), `${share(g4).toFixed(2)} → ${share(g6).toFixed(2)}`);
    // 3人
    const trioMet = ['mua', 'kiki', 'momosuke'];
    const t1 = many({ ...empty(), bond: bondOf({ 'kiki-mua': 50, 'momosuke-mua': 50, 'kiki-momosuke': 10 }) }, { scene: 'home', metIds: trioMet, selectedId: 'mua' });
    check('⑪ 3人のうち1組でも Lv1 なら、3人の掛け合いは出ない', !t1.some(t => t.kind === 'trio'));
    const t2 = many({ ...empty(), bond: bondOf({ 'kiki-mua': 50, 'momosuke-mua': 50, 'kiki-momosuke': 50 }) }, { scene: 'home', metIds: trioMet, selectedId: 'mua' });
    check('⑪ 3組とも Lv2 以上なら、3人の掛け合いが出る(会った3人だけ)', t2.some(t => t.kind === 'trio') && t2.filter(t => t.kind === 'trio').every(t => t.trio.every(id => trioMet.includes(id))));
    const trioShare = (list) => list.filter(t => t.kind === 'trio').length / Math.max(1, list.length);
    const t7 = many({ ...empty(), bond: bondOf({ 'kiki-mua': 1000, 'momosuke-mua': 50, 'kiki-momosuke': 50 }), special: ['kiki-mua'] }, { scene: 'home', metIds: trioMet, selectedId: 'mua' }, 800);
    check('⑪ どれかのペアが Lv7 なら、3人の掛け合いに出やすくなる', trioShare(t7) > trioShare(t2), `${trioShare(t2).toFixed(2)} → ${trioShare(t7).toFixed(2)}`);

    // けんか → 仲直り(保存と増え方)
    store.set({ ...empty() });
    const q = X.quarrels.find(t => t.id === 'kiki-kyuko-q');
    const tq = now0;
    G('assistantPeerMarkShown')(q, { scene: 'home', special: false, now: tq });
    check('⑪ けんかを見ると、仲直りを待つ(mh_assistant_peer_quarrel_v1)', store.state.quarrel.pending && store.state.quarrel.pending.id === q.id && mem.mh_assistant_peer_quarrel_v1.done.includes(q.id));
    const soon = pick({ ...store.state, lastShownAt: 0 }, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki', now: tq + 10 * 1000, rand: () => 0.99 });
    check('⑪ すぐには仲直りしない(続けて流さない間をあける)', !soon || soon.talk.kind !== 'makeup');
    const later = pick(store.state, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki', now: tq + 120 * 1000, rand: () => 0.99 });
    check('⑪ 次に HOME を開いたとき、割合に関係なく仲直りを先に流す', later && later.talk.kind === 'makeup' && later.talk.quarrelId === q.id, later && later.talk.id);
    const notHome = pick(store.state, { scene: 'market', metIds: ['kiki', 'kyuko'], selectedId: 'kiki', now: tq + 120 * 1000, rand: () => 0.99 });
    check('⑪ 仲直りは HOME で流す(ほかの画面では先に出さない)', !notHome || notHome.talk.kind !== 'makeup');
    const q2 = many({ ...store.state, bond: { 'kiki-kyuko': 50 }, lastShownAt: 0 }, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki' });
    check('⑪ 仲直りを待つあいだ、新しいけんかは出ない', !q2.some(t => t.kind === 'quarrel'));
    check('⑪ 仲直りを見ると待ちが消え、2度目は増えない', G('assistantPeerMakeupDone')(later.talk) === true && !store.state.quarrel.pending && G('assistantPeerMakeupDone')(later.talk) === false);
    const q3 = many({ ...store.state, bond: { 'kiki-kyuko': 50 }, lastShownAt: 0 }, { scene: 'home', metIds: ['kiki', 'kyuko'], selectedId: 'kiki' });
    check('⑪ 見たけんかは2度出ない', !q3.some(t => t.id === q.id));
    const PA = G('ASSISTANT_PEER_BOND_ACTIONS');
    let gs = { ...empty() };
    for (let i = 0; i < 4; i++) gs = gain(gs, 'kiki', 'kyuko', 'talk', 'd').st;
    gs = gain(gs, 'kiki', 'kyuko', 'story', 'd').st; gs = gain(gs, 'kiki', 'kyuko', 'switch', 'd').st; gs = gain(gs, 'kiki', 'kyuko', 'choice', 'd').st; gs = gain(gs, 'kiki', 'kyuko', 'choice', 'd').st;
    const mkr = gain(gs, 'kiki', 'kyuko', 'makeup', 'd');
    check('⑪ ペアへの増え方: 仲直り +5(1日20の上限の外)・ミニイベント +5(1日5)', PA.makeup.amount === 5 && PA.makeup.uncapped === true && mkr.gained === 5
      && PA.event.amount === 5 && PA.event.dailyMax === 5 && gain(gain({ ...empty() }, 'a', 'b', 'event', 'd').st, 'a', 'b', 'event', 'd').gained === 0);
    check('⑪ プレイヤーの親密度: 3人 +3/6・ミニイベント +8/16・仲直り +8/8(公開の印 assistantPeer の後ろ)', BA.peerTrio.amount === 3 && BA.peerTrio.dailyMax === 6 && BA.peerEvent.amount === 8 && BA.peerEvent.dailyMax === 16
      && BA.peerMakeup.amount === 8 && BA.peerMakeup.dailyMax === 8 && ['peerTrio', 'peerEvent', 'peerMakeup'].every(k => BA[k].releaseFlag === 'assistantPeer'));
    // 3人の掛け合いはアルバムの3組それぞれに入る・今日のペアに数えない
    store.set({ ...empty(), daily: { day: dayNow, pair: 'kiki-mua', seen: 0, done: false, lastDay: dayNow, streak: 1 } });
    G('assistantPeerAlbumAdd')(tr);
    check('⑪ 3人の掛け合いは、3組のペアのアルバムそれぞれに入る', ['kiki-mua', 'momosuke-mua', 'kiki-momosuke'].every(k => (store.state.album[k] || []).includes(tr.id)));
    check('⑪ 3人の掛け合い・けんかは今日のペアに数えない', (await G('assistantPeerDailyProgress')(tr)).done === false && store.state.daily.seen === 0
      && (await G('assistantPeerDailyProgress')(X.quarrels.find(t => t.kind === 'quarrel' && t.pair.join('-') === 'kiki-mua') || q)).done === false && store.state.daily.seen === 0);

    // Lv10 の2本目の特別なお話。コトバの台本が届く前は、仮の1本を足した別の入れ物で仕組みだけ見る
    let C2 = ctx, sp2 = TALKS.find(t => t.special && t.lv >= 10 && pairKey(t.pair[0], t.pair[1]) === 'kiki-mua');
    if (!sp2) {
      sp2 = { id: 'kiki-mua-sp2', pair: ['kiki', 'mua'], lv: 10, scene: 'home', special: true, lines: [{ who: 'mua', e: 'happy', t: '{c}' }, { who: 'kiki', e: 'happy', t: '{c}' }] };
      const src = fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistants.js'), 'utf8');
      const at = src.indexOf('\n]);\n', src.indexOf('const ASSISTANT_PEER_TALKS = Object.freeze(['));
      C2 = vm.createContext({ ...ctx, ASSISTANT_PEER_STORE: undefined });
      vm.runInContext(`${src.slice(0, at)}\n${JSON.stringify(sp2)},${src.slice(at)}`, C2);
      vm.runInContext('var assistantBubbleDayKey = () => __day(); var assistantPeerDayKey = () => __day(); var assistantById = (id) => ASSISTANTS.find(a => a.id === id);', C2);
      vm.runInContext(part, C2);
    }
    const pick2 = vm.runInContext('assistantPeerPickTalk', C2), store2 = vm.runInContext('ASSISTANT_PEER_STORE', C2);
    const s10 = { ...empty(), bond: { 'kiki-mua': 2600 } };
    let pp = pick2(s10, { scene: 'home', metIds: ['kiki', 'mua'], selectedId: 'mua', now: now0, rand: () => 0.99 });
    check('⑪ Lv10 になっても、Lv5 の特別なお話を先に流す', pp && pp.special && pp.talk.id === 'kiki-mua-sp', pp && pp.talk.id);
    pp = pick2({ ...s10, special: ['kiki-mua'] }, { scene: 'home', metIds: ['kiki', 'mua'], selectedId: 'mua', now: now0, rand: () => 0.99 });
    check('⑪ Lv5 を見たあと、Lv10 の2本目の特別なお話を HOME で先に流す', pp && pp.special && pp.talk.id === sp2.id, pp && pp.talk.id);
    pp = pick2({ ...s10, bond: { 'kiki-mua': 2400 }, special: ['kiki-mua'] }, { scene: 'home', metIds: ['kiki', 'mua'], selectedId: 'mua', now: now0, rand: () => 0.99 });
    check('⑪ Lv9 では2本目は流れない', !pp || !pp.special);
    store2.set({ ...s10, special: ['kiki-mua'] });
    vm.runInContext('assistantPeerMarkShown', C2)(sp2, { scene: 'home', special: true, now: now0 });
    check('⑪ 2本目を見たことは別のキー(mh_assistant_peer_special2_seen_v1)に残し、Lv5 の記録は変えない', store2.state.special2.includes('kiki-mua') && mem.mh_assistant_peer_special2_seen_v1.includes('kiki-mua') && store2.state.special.length === 1);
    pp = pick2(store2.state, { scene: 'home', metIds: ['kiki', 'mua'], selectedId: 'mua', now: now0 + 1e6, rand: () => 0.99 });
    check('⑪ 見た2本目は、もう流さない', !pp || !pp.special);
    check(`⑪ (参考) コトバの Lv7・Lv9・Lv10 の台本: ${TALKS.filter(t => !t.special && t.lv === 7).length}・${TALKS.filter(t => !t.special && t.lv === 9).length}・${TALKS.filter(t => t.special && t.lv >= 10).length} 本(届いたら 28・28・28)`, true);
  }
  // ⑦ で保存から読み直すので、置き場を読み込む前に戻す
  store.state = { ...empty(), loaded: false }; store.loading = null;

  // ⑩ 差し入れ・友情のしるし・ペアで遊ぶ(②)
  const RE = G('ASSISTANT_PEER_REACTIONS');
  check('⑩ 8人全員に、差し入れ・友情のしるし・遊んだあとのひとことがある', IDS.every(id => RE[id] && ['gift', 'token', 'play'].every(k => RE[id][k] && EXPR.includes(RE[id][k].e) && RE[id][k].t.length > 0)));
  const reLines = Object.entries(RE).flatMap(([id, o]) => Object.values(o).map(x => ({ id, t: x.t })));
  check('⑩ ひとことの口調(みゅあは「じゃん」「まじ」を使わない・あつは文の最後に笑か記号)', reLines.filter(x => x.id === 'mua').every(x => !/じゃん|まじ/.test(x.t))
    && reLines.filter(x => x.id === 'atsu').every(x => /(笑|[！？!?…。])$/.test(x.t)));
  const PA = G('ASSISTANT_PEER_BOND_ACTIONS');
  check('⑩ ペアへの増え方: 差し入れ +15・しるし +30(1日20の上限の外)・遊ぶ +4(1日12)', PA.gift.amount === 15 && PA.gift.uncapped && PA.token.amount === 30 && PA.token.uncapped && PA.play.amount === 4 && PA.play.dailyMax === 12);
  check('⑩ プレイヤーの親密度: 差し入れ +30・しるし +25・遊ぶ +6(1日24)', BA.peerGift.amount === 30 && BA.peerToken.amount === 25 && BA.peerPlay.amount === 6 && BA.peerPlay.dailyMax === 24
    && ['peerGift', 'peerToken', 'peerPlay'].every(k => BA[k].releaseFlag === 'assistantPeer'));
  const OFF = vm.runInContext('typeof RHYTHM_EVENT_POINT_SHOP_OFFERS !== "undefined" ? RHYTHM_EVENT_POINT_SHOP_OFFERS : null', ctx) || (() => { const c2 = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', 'data', 'rhythm-event.js'), 'utf8') + ';this.O=RHYTHM_EVENT_POINT_SHOP_OFFERS', c2); return c2.O; })();
  const og = OFF.find(o => o.id === 'peer_gift'), ot = OFF.find(o => o.id === 'peer_token');
  check('⑩ ビートP交換所: 差し入れ 200P・友情のしるし 500P、どちらも公開の印 assistantPeer の後ろ', og && og.cost === 200 && ot && ot.cost === 500 && og.releaseFlag === 'assistantPeer' && ot.releaseFlag === 'assistantPeer');
  ctx.RELEASE_FLAGS.assistantPeer = true;
  store.state = { ...empty(), loaded: true }; store.loading = null;
  added.length = 0;
  const t1 = await G('assistantPeerUseItem')('gift', ['mua', 'kiki']);
  check('⑩ 差し入れを渡すと、ペア +15・2人の親密度(peerGift)・2人のひとことの台本', store.state.bond['kiki-mua'] === 15 && ['mua:peerGift', 'kiki:peerGift'].every(x => added.includes(x)) && t1 && t1.lines.length === 2 && t1.reaction === 'gift');
  check('⑩ 差し入れは全体で1日1回(ほかのペアにも渡せない)', (await G('assistantPeerUseItem')('gift', ['dra', 'atsu'])) === null && G('assistantPeerItemUsedToday')(store.state, 'gift'));
  const t2 = await G('assistantPeerUseItem')('token', ['mua', 'kiki']);
  check('⑩ 友情のしるしは差し入れとは別に1日1回。ペア +30', t2 && store.state.bond['kiki-mua'] === 45);
  dayNow = '2026-11-08';
  check('⑩ 次の日はまた使える', !G('assistantPeerItemUsedToday')(store.state, 'gift'));
  dayNow = '2026-11-07';
  added.length = 0;
  await G('assistantPeerOnPlay')('battle');
  check('⑩ 連れていくペアがいないときは、遊んでも何も増えない', added.length === 0 && !store.state.playNote);
  G('assistantPeerSetPlayPair')(['dra', 'mua']);
  await G('assistantPeerOnPlay')('rhythm');
  check('⑩ 連れていくペアがいれば、遊び終えるとペア +4・2人の親密度(peerPlay)・次の画面でひとこと', store.state.bond['dra-mua'] === 4 && added.includes('dra:peerPlay') && added.includes('mua:peerPlay') && store.state.playNote && store.state.playNote.kind === 'rhythm');
  await G('assistantPeerOnPlay')('card'); await G('assistantPeerOnPlay')('card'); await G('assistantPeerOnPlay')('card');
  check('⑩ 遊ぶ +4 はペアごとに1日12まで', store.state.bond['dra-mua'] === 12);
  store.state = { ...empty(), loaded: false }; store.loading = null;

  // ⑦ 保存
  writes.length = 0;
  mem.mh_assistant_peer_bond_v1 = { 'kiki-mua': 'x', 'BAD KEY': 5, 'dra-mua': 40 };
  mem.mh_assistant_peer_talk_day_v1 = 'こわれた';
  const st0 = await G('ASSISTANT_PEER_STORE').load();
  check('⑦ 壊れた値は空として読む(数でない点数・おかしなキーは捨てる)', JSON.stringify(st0.bond) === JSON.stringify({ 'dra-mua': 40 }) && st0.talkDay.home === 0);
  dayNow = '2026-11-07';
  await G('assistantPeerGain')('mua', 'dra', 'talk');
  G('assistantPeerMarkShown')(TALKS[0], { scene: 'home', special: false });
  check('⑦ 書くのは mh_assistant_peer_* の新しいキーだけ', writes.length > 0 && writes.every(k => /^mh_assistant_peer_(bond|bond_day|talk_log|talk_day|special_seen|talk_gen|daily|choice|album|gift|play|quarrel|special2_seen)_v1$/.test(k)), writes.join(','));
  check('⑦ 上がった点数が保存される', mem.mh_assistant_peer_bond_v1['dra-mua'] === 42);
  ctx.RELEASE_FLAGS.assistantPeer = false;
  const off = await G('assistantPeerGain')('mua', 'dra', 'talk');
  check('⑦ 公開の印が偽なら上がらない', off.gained === 0);

  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
