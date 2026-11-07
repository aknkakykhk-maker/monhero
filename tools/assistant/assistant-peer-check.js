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
  const lines = (who) => TALKS.flatMap(t => [...t.lines, ...(t.choice || []).flatMap(o => o.reply)].filter(l => l.who === who).map(l => ({ id: t.id, t: l.t })));
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
  const all = TALKS.flatMap(t => [...t.lines, ...(t.choice || []).flatMap(o => o.reply), ...(t.choice || []).map(o => ({ t: o.label }))].map(l => ({ id: t.id, t: l.t })));
  const ko = all.filter(x => /(この|あの|その|うちの|いい|強い)子|子たち/.test(x.t));
  check('③ モンスターを「子」と呼ばない(2026-11-06 社長)', ko.length === 0, ko.map(x => x.id).join(','));
  const love = all.filter(x => /恋|デート|付き合|キス|彼氏|彼女|結婚|ラブ/.test(x.t));
  check('③ 恋愛のことばが無い', love.length === 0, love.map(x => x.id).join(','));
  const dirty = all.filter(x => /バカ|ばか(?!り)|きらい|嫌い|うざ|ブス|最低/.test(x.t));
  check('③ 悪口のことばが無い', dirty.length === 0, dirty.map(x => `${x.id}「${x.t}」`).join(' / '));
  // 敬称が重ならない(「{c}さん」と書かない)
  const hon = TALKS.flatMap(t => t.lines.filter(l => /\{c\}(さん|ちゃん|くん|ちん)/.test(l.t)).map(() => t.id));
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
  // ⑦ で保存から読み直すので、置き場を読み込む前に戻す
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
  check('⑦ 書くのは mh_assistant_peer_* の新しいキーだけ', writes.length > 0 && writes.every(k => /^mh_assistant_peer_(bond|bond_day|talk_log|talk_day|special_seen|talk_gen|daily|choice|album)_v1$/.test(k)), writes.join(','));
  check('⑦ 上がった点数が保存される', mem.mh_assistant_peer_bond_v1['dra-mua'] === 42);
  ctx.RELEASE_FLAGS.assistantPeer = false;
  const off = await G('assistantPeerGain')('mua', 'dra', 'talk');
  check('⑦ 公開の印が偽なら上がらない', off.gained === 0);

  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
