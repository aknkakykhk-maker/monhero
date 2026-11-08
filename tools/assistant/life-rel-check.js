// 助手ライフ: 人間らしい関係の出来事(56-assistant-life-rel.jsx)の決まりを確かめる。ブラウザは使わない。
//   node tools/assistant/life-rel-check.js
// 案: docs/progress/assistant-peer/LIFE-HOUSE-PLAN.md の 10。担当: 助手部キズナ
//   ① 台本: 書き出しが台本と同じ/28組それぞれに原因つきけんか3本・謝る・差し入れ・取り持つ/悪口・いじめの言葉が無い/
//      「ブリーダー」と直に書かない/助手・モンスターを「子」と呼ばない/えるびんの私生活(家族・仕事)に触れない
//   ② けんかで友情Lv は下がらない
//   ③ 仲直り +5(謝る・取り持つ・差し入れ・朝4時の自分たちで)/間に入った助手と2人それぞれ +3
//   ④ 仲直りした日から2日は、同じ組はけんかしない(家の様子・HOME の掛け合いの両方)
//   ⑤ 前の日からのけんかは、次の日(朝4時の切り替え)には仲直りしている
//   ⑥ 家の見せ方: 部屋にひとり → 扉/家で2人 → 居間で離れて座る/出かけている → 札/仲直りしたて → 🤝/やきもち → 💭/寝ている助手は扉にしない
//   ⑦ 台本の選び方: ライバルは練習・カード研究のときだけ/ないしょ話は友情Lv5〜の夜だけ/相談は相談する人の気分が合うときだけ/
//      やきもちは3人の組だけ(4人では出さない)/間に入るは3人目がいるときだけ
//   ⑧ 保存: 新しいキー mh_assistant_life_rel_v1 だけ。壊れた値でも空として読む/印 assistantLife が偽なら何もしない
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ① 書き出しが台本と同じ
try { execFileSync('node', [path.join(__dirname, 'life-rel-talks-import.js'), '--check'], { stdio: 'pipe' }); check('① 書き出しが台本と同じ', true); }
catch (e) { check('① 書き出しが台本と同じ', false, String(e.stdout || e.message).trim()); }

const mem = {};
const writes = [];
const flags = { assistantPeer: true, assistantLife: true };
let dayNow = '2026-11-08';
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
  React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
  RELEASE_FLAGS: flags,
  __day: () => dayNow,
  __oldAt: 1762400000000,
});
const load = (rel) => {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = rel.endsWith('.jsx') ? babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code : src;
  vm.runInContext(code, ctx);
};
load('monster-hero/data/assistants.js');
vm.runInContext('var assistantBubbleDayKey = () => __day(); var assistantPeerDayKey = () => __day(); var jstDayKey4 = (t) => (t === __oldAt ? "2026-11-07" : __day()); var assistantById = (id) => ASSISTANTS.find(a => a.id === id); var AssistantFace = () => null;', ctx);
load('monster-hero/src/parts/56-assistant-peer.jsx');
load('monster-hero/src/parts/56-assistant-life.jsx');
load('monster-hero/src/parts/56-assistant-life-house.jsx');
load('monster-hero/src/parts/56-assistant-life-rel.jsx');
const G = (expr) => vm.runInContext(expr, ctx);
const run = async (expr) => vm.runInContext(`(async () => { ${expr} })()`, ctx);

const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const pairKey = (a, b) => [a, b].sort().join('-');
const PAIRS = []; for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) PAIRS.push(pairKey(IDS[i], IDS[j]));
const TALKS = G('ASSISTANT_LIFE_REL_TALKS');

// ① 台本の中身
{
  const by = (kind, pred = () => true) => TALKS.filter(t => t.kind === kind && pred(t));
  const miss = [];
  for (const pk of PAIRS) {
    const f = by('fight', t => pairKey(t.ppl[0], t.ppl[1]) === pk).length;
    const hows = ['apology', 'gift', 'player'].map(h => by('mend', t => pairKey(t.ppl[0], t.ppl[1]) === pk && t.keys.how === h).length);
    if (f < 3 || hows.some(n => n < 1)) miss.push(`${pk}(けんか${f}・謝る${hows[0]}・差し入れ${hows[1]}・取り持つ${hows[2]})`);
  }
  check('① 28組それぞれに、原因つきけんか3本と謝る・差し入れ・取り持つ', !miss.length, miss.slice(0, 4).join(' / '));
  // 間に入るの台本が無い組は、謝る・けんか自身の仲直りに戻る(⑦で確かめる)。いまある組の数だけ出す
  const mend3 = new Set(by('mend3').map(t => pairKey(t.ppl[1], t.ppl[2])));
  check('① 間に入るの台本が28組すべてにある', mend3.size === 28, `${mend3.size}組`);
  const text = (t) => [...t.lines, ...(t.distance || []), ...(t.makeup || [])].map(l => l.t).join('\n');
  const BAD = /バカ|ばか(?!り)|馬鹿|アホ|あほ(?!う)|うざ|ウザ|きもい|キモ|最低|クズ|ブス|死ね|(?<![るだ])しね(?![ぇえ])|消えろ|大嫌い|だいきらい|嫌い(だ|！|!)|むかつく|ムカつく/;
  const bad = TALKS.filter(t => BAD.test(text(t)));
  check('① 悪口・人格を責める言葉が無い', !bad.length, bad.slice(0, 3).map(t => `${t.id}「${(text(t).match(BAD) || [''])[0]}」`).join(' / '));
  const br = TALKS.filter(t => /ブリーダー(さん)?(?!Lv|P|ランク|経験|の教え)/.test(text(t)));
  check('① プレイヤーは {name}(「ブリーダー」と直に書かない)', !br.length, br.slice(0, 3).map(t => t.id).join(' '));
  const ko = TALKS.filter(t => /(あの|その|うちの|いい)子(?![どもう])|子たち/.test(text(t)));
  check('① 助手・モンスターを「子」と呼ばない', !ko.length, ko.slice(0, 3).map(t => `${t.id}「${(text(t).match(/.{0,6}子.{0,4}/) || [''])[0]}」`).join(' / '));
  const er = TALKS.filter(t => t.ppl.includes('erubin') && /奥さん|妻|嫁|家族|子ども|子供|会社|仕事場|本業|年収/.test(text(t)));
  check('① えるびんの私生活に触れない', !er.length, er.slice(0, 3).map(t => t.id).join(' '));
  const love = TALKS.filter(t => /好きな人|恋|付き合|デート|キス/.test(text(t)));
  check('① 恋愛にしない(やきもち・照れるは友だちとして)', !love.length, love.slice(0, 3).map(t => `${t.id}「${(text(t).match(/.{0,6}(好きな人|恋|付き合|デート|キス).{0,4}/) || [''])[0]}」`).join(' / '));
}

const main = async () => {
  const st = () => G('ASSISTANT_PEER_STORE.state');
  const pts = (a, b) => (st().bond || {})[pairKey(a, b)] || 0;
  await run('await ASSISTANT_PEER_STORE.load(); await ASSISTANT_LIFE_STORE.load(); await ASSISTANT_LIFE_REL_STORE.load();');
  const fight = G("assistantLifeRelQuarrelTalks().find(t => t.kind === 'quarrel' && t.pair.join('-') === 'kiki-mua')");
  check('① けんかの台本が言い合いの流れ(quarrel・makeup・距離)に入っている', !!fight && G(`assistantPeerExtraTalks().quarrels.some(t => t.id === '${fight.id}m' && t.kind === 'makeup')`) && fight.distance.length > 0);

  // ② けんかで友情Lv は下がらない
  ctx.__fight = fight;
  await run(`ASSISTANT_PEER_STORE.set({ bond: { 'kiki-mua': 400, 'kiki-kyuko': 100, 'kyuko-mua': 100 } });`);
  const before = pts('mua', 'kiki');
  await run(`assistantPeerMarkShown(__fight, { scene: 'life', special: false, now: Date.now() });`);
  check('② けんかで友情Lv は下がらない', pts('mua', 'kiki') === before && st().quarrel.pending && st().quarrel.pending.pair === 'kiki-mua', `${before} → ${pts('mua', 'kiki')}`);
  check('⑥ 部屋のシートに原因が出る', G(`assistantLifeRelCauseOf('${fight.id}')`) === G('ASSISTANT_LIFE_REL_CAUSES')[fight.cause]);

  // ③ 取り持つ: +5・待っている仲直りが消える・mended が付く
  const b1 = pts('mua', 'kiki');
  const t1 = await run(`return await assistantLifeRelMediate('mua');`);
  await new Promise(r => setTimeout(r, 10));
  check('③ 取り持つ: 仲直りの掛け合いが出て +5', !!t1 && t1.how === 'player' && pts('mua', 'kiki') - b1 === 5 && !st().quarrel.pending, `${b1} → ${pts('mua', 'kiki')}`);
  check('⑧ 仲直りは新しいキー mh_assistant_life_rel_v1 に足す', !!(mem.mh_assistant_life_rel_v1 && mem.mh_assistant_life_rel_v1.mended['kiki-mua']));
  // ④ 2日はけんかしない
  check('④ 仲直りした日と次の2日はけんかしない', G("assistantLifeRelCooling('kiki-mua')") === true);
  dayNow = '2026-11-10'; check('④ 2日後もまだしない', G("assistantLifeRelCooling('kiki-mua')") === true);
  dayNow = '2026-11-11'; check('④ 3日後からはまたけんかすることがある', G("assistantLifeRelCooling('kiki-mua')") === false);
  dayNow = '2026-11-08';
  {
    // 家の様子でも、HOME の掛け合いでも、冷めているあいだはけんかの台本を選ばない
    let q = 0;
    for (let i = 0; i < 200; i++) {
      const t = G(`assistantLifePickPairTalk(['kiki', 'mua'], { ids: ['kiki', 'mua'], place: 'cafe', doing: 'snack' }, ASSISTANT_PEER_STORE.state, { ...ASSISTANT_LIFE_STORE.state.life, moods: { mua: 'sulky', kiki: 'sulky' } }, {}, (() => { let s = ${i + 1}; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })())`);
      if (t && t.kind === 'quarrel') q++;
    }
    check('④ 冷めているあいだは家の様子でけんかを選ばない', q === 0, `${q}回`);
  }

  // ③ 差し入れで仲直り
  ctx.__f2 = G("assistantLifeRelQuarrelTalks().find(t => t.kind === 'quarrel' && t.pair.join('-') === 'atsu-sorashido')");
  await run(`ASSISTANT_PEER_STORE.set({ gift: null, bond: { ...ASSISTANT_PEER_STORE.state.bond, 'atsu-sorashido': 300 } }); assistantPeerMarkShown(__f2, { scene: 'life', special: false, now: Date.now() });`);
  const b2 = pts('atsu', 'sorashido');
  const t2 = await run(`return await assistantPeerUseItem('gift', ['atsu', 'sorashido']);`);
  const giftAmt = G('ASSISTANT_PEER_BOND_ACTIONS.gift.amount');
  check('③ けんか中に差し入れ: 仲直りの掛け合いが出て、道具のぶん+5', !!t2 && t2.how === 'gift' && !st().quarrel.pending && pts('atsu', 'sorashido') - b2 === giftAmt + 5, `+${pts('atsu', 'sorashido') - b2}(差し入れ ${giftAmt})`);
  const t2b = await run(`ASSISTANT_PEER_STORE.set({ gift: null }); return await assistantPeerUseItem('gift', ['atsu', 'sorashido']);`);
  check('③ けんかしていない2人の差し入れは、今までの掛け合いのまま', !!t2b && t2b.how !== 'gift');

  // ③ 間に入る: 3人の組で待っている仲直り → 間に入る台本・間に入った人と2人それぞれ +3
  const m3 = G("assistantLifeRelSet().mend3[0]");
  ctx.__f3 = G(`assistantLifeRelQuarrelTalks().find(t => t.kind === 'quarrel' && t.pair.join('-') === '${m3.pk}')`);
  await run(`ASSISTANT_PEER_STORE.set({ quarrel: { pending: null, done: [] } }); assistantPeerMarkShown(__f3, { scene: 'life', special: false, now: Date.now() });`);
  const [p, q2] = m3.pk.split('-');
  const pre = [pts(m3.mediator, p), pts(m3.mediator, q2), pts(p, q2)];
  const t3 = G(`assistantLifePickGroupTalk({ ids: ['${m3.mediator}', '${p}', '${q2}'], place: 'home', doing: 'snack' }, ASSISTANT_PEER_STORE.state, ASSISTANT_LIFE_STORE.state.life, () => 0.1)`);
  check('⑦ 3人目がいる組では「間に入る」を選ぶ', !!t3 && t3.kind === 'makeup' && t3.mediator === m3.mediator, t3 ? `${t3.id} ${t3.kind}` : 'なし');
  ctx.__t3 = t3;
  await run(`if (assistantPeerMakeupDone(__t3)) { await assistantPeerGain(__t3.pair[0], __t3.pair[1], 'makeup'); }`);
  await new Promise(r => setTimeout(r, 30));
  const post = [pts(m3.mediator, p), pts(m3.mediator, q2), pts(p, q2)];
  check('③ 間に入った助手と2人それぞれ +3・2人は +5', post[0] - pre[0] === 3 && post[1] - pre[1] === 3 && post[2] - pre[2] === 5, `${pre.join(',')} → ${post.join(',')}`);

  // ⑤ 前の日からのけんかは、次の日には自分たちで仲直り
  ctx.__f4 = G("assistantLifeRelQuarrelTalks().find(t => t.kind === 'quarrel' && t.pair.join('-') === 'dra-kyuko')");
  await run(`assistantPeerMarkShown(__f4, { scene: 'life', special: false, now: Date.now() });`);
  const b4 = pts('dra', 'kyuko');
  const same = await run('return await assistantLifeRelTick();');
  check('⑤ その日のうちは、自分たちではまだ仲直りしない', same === false && !!st().quarrel.pending);
  // けんかした時刻を前の日(朝4時の切り替えの前)にする
  await run(`ASSISTANT_PEER_STORE.set({ quarrel: { ...ASSISTANT_PEER_STORE.state.quarrel, pending: { ...ASSISTANT_PEER_STORE.state.quarrel.pending, at: __oldAt } } });`);
  const next = await run('return await assistantLifeRelTick();');
  check('⑤ 朝4時の切り替えのあとは、自分たちで仲直りしている(+5)', next === true && !st().quarrel.pending && pts('dra', 'kyuko') - b4 === 5, `${b4} → ${pts('dra', 'kyuko')}`);
  dayNow = '2026-11-08';

  // ⑥ 家の見せ方
  ctx.__f5 = G("assistantLifeRelQuarrelTalks().find(t => t.kind === 'quarrel' && t.pair.join('-') === 'atsu-mua')");
  await run(`ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, mended: {} }; assistantPeerMarkShown(__f5, { scene: 'life', special: false, now: Date.now() });`);
  const life0 = G('ASSISTANT_LIFE_STORE.state.life');
  const mk = (groups, solo) => ({ ...life0, abs: G('assistantLifeSlotAt().abs'), groups, solo, moods: {} });
  const rooms = (life) => { ctx.__life = life; return G('assistantLifeRoomsOf(__life, ' + JSON.stringify(IDS) + ')'); };
  let r = rooms(mk([], { mua: { place: 'home', doing: 'idle', reason: 'distance' }, atsu: { place: 'cafe', doing: 'snack', reason: 'distance' } }));
  check('⑥ けんか中で部屋にひとり → 🚪 扉', r.mua && r.mua.door === true && r.mua.bub.join('').includes('そっとして'));
  check('⑥ けんか中で出かけている → 札に「💢 ◯◯とけんか中」', r.atsu && r.atsu.tag && /💢 みゅあとけんか中/.test(r.atsu.tag[1]), r.atsu && r.atsu.tag ? r.atsu.tag[1] : '');
  r = rooms(mk([], { mua: { place: 'home', doing: 'sleep', reason: 'distance' } }));
  check('⑥ 寝ている助手は扉にしない(💤 のまま)', r.mua && !r.mua.door && r.mua.sleep);
  const livingLife = mk([{ ids: ['atsu', 'mua'], place: 'home', doing: 'snack' }], {});
  r = rooms(livingLife);
  ctx.__life = livingLife;
  check('⑥ けんか中の2人が家で同じ組 → 居間で離れて座る(部屋の札は「みんなの居間に」)', !!G('assistantLifeRelLivingPair(__life, ASSISTANT_PEER_STORE.state)') && r.mua.tag && /居間/.test(r.mua.tag[0]) && r.atsu.tag && /居間/.test(r.atsu.tag[0]));
  // 仲直りしたて
  await run(`ASSISTANT_PEER_STORE.set({ quarrel: { pending: null, done: [] } }); ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, mended: { 'atsu-mua': { day: '2026-11-08', abs: assistantLifeSlotAt().abs } } };`);
  r = rooms(mk([], { mua: { place: 'home', doing: 'idle', reason: 'mypace' }, atsu: { place: 'cafe', doing: 'snack', reason: 'mypace' } }));
  check('⑥ 仲直りしたて → 🤝 仲直りの札', r.mua.mend === 'atsu' && r.atsu.mend === 'mua' && /仲直り/.test(r.atsu.tag[1]));
  // やきもち
  const jt = G('assistantLifeRelSet().jealous[0]');
  const [x, y] = jt.pk.split('-');
  await run(`ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, mended: {} }; ASSISTANT_PEER_STORE.set({ bond: { ...ASSISTANT_PEER_STORE.state.bond, '${jt.pk}': 2000 } });`);
  r = rooms(mk([{ ids: [x, y], place: 'plaza', doing: 'walk' }], { [jt.watcher]: { place: 'home', doing: 'idle', reason: 'lonely' } }));
  check('⑥ 仲のいい2人が出かけていて、家にひとり → 💭 …いいなぁ', r[jt.watcher] && r[jt.watcher].jealous && /いいなぁ/.test(r[jt.watcher].bub.join('')), jt.watcher);
  await run(`ASSISTANT_PEER_STORE.set({ bond: { ...ASSISTANT_PEER_STORE.state.bond, '${jt.pk}': 0 } });`);
  r = rooms(mk([{ ids: [x, y], place: 'plaza', doing: 'walk' }], { [jt.watcher]: { place: 'home', doing: 'idle', reason: 'lonely' } }));
  check('⑥ 友情Lv の低い2人には、やきもちを出さない', !(r[jt.watcher] && r[jt.watcher].jealous));

  // ⑦ 選び方
  const rnd = (seed) => { let s = seed; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
  const pickMany = (pair, group, lifeX, n = 400) => { const out = []; ctx.__g = group; ctx.__l = lifeX; for (let i = 0; i < n; i++) { const t = G(`assistantLifeRelPickPair(${JSON.stringify(pair)}, __g, ASSISTANT_PEER_STORE.state, __l, {}, (() => { let s = ${i + 7}; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })())`); if (t) out.push(t); } return out; };
  await run(`ASSISTANT_PEER_STORE.set({ bond: { ...ASSISTANT_PEER_STORE.state.bond, 'atsu-sorashido': 3000 } });`);
  const lv = G("assistantPeerLevel(ASSISTANT_PEER_STORE.state, 'atsu', 'sorashido')");
  const walk = pickMany(['atsu', 'sorashido'], { ids: ['atsu', 'sorashido'], place: 'plaza', doing: 'walk' }, { ...life0, recent: [], moods: {} });
  const prac = pickMany(['atsu', 'sorashido'], { ids: ['atsu', 'sorashido'], place: 'studio', doing: 'practice' }, { ...life0, recent: [], moods: {} });
  check('⑦ ライバルは練習・カード研究のときだけ', !walk.some(t => t.rel === 'rival') && prac.some(t => t.rel === 'rival' && t.keys.game === 'beat'), `友情Lv${lv} 散歩${walk.filter(t => t.rel === 'rival').length}・練習${prac.filter(t => t.rel === 'rival').length}`);
  const secretOk = walk.concat(prac).filter(t => t.rel === 'secret');
  const isNight = G("assistantLifeLookNow() === 'night' || assistantLifeSlotAt().i === 0");
  check('⑦ ないしょ話は友情Lv5〜の夜だけ', isNight || !secretOk.length, `夜=${isNight} ${secretOk.length}本`);
  const consult = pickMany(['atsu', 'sorashido'], { ids: ['atsu', 'sorashido'], place: 'plaza', doing: 'walk' }, { ...life0, recent: [], moods: {} }).filter(t => t.rel === 'consult');
  check('⑦ 相談は、相談する人の気分が合うときだけ', !consult.length, `${consult.length}本`);
  const four = G(`assistantLifeRelPickGroup({ ids: ['${jt.watcher}', '${x}', '${y}', '${IDS.find(i => ![jt.watcher, x, y].includes(i))}'], place: 'home', doing: 'snack' }, ASSISTANT_PEER_STORE.state, ASSISTANT_LIFE_STORE.state.life, {}, () => 0.01)`);
  check('⑦ やきもちは4人の組では出さない', four == null);
  await run(`ASSISTANT_PEER_STORE.set({ bond: { ...ASSISTANT_PEER_STORE.state.bond, '${jt.pk}': 2000 } });`);
  const three = G(`assistantLifeRelPickGroup({ ids: ['${jt.watcher}', '${x}', '${y}'], place: 'home', doing: 'snack' }, ASSISTANT_PEER_STORE.state, ASSISTANT_LIFE_STORE.state.life, {}, () => 0.01)`);
  check('⑦ やきもちは3人の組で、仲のいい2人とそれを見ている人', !!three && three.rel === 'jealous' && three.trio.length === 3);
  const nomed = G(`assistantLifeRelPickMend({ id: 'x', pair: 'kiki-mua', ids: ['kiki', 'mua'] }, { ids: ['kiki', 'mua'] }, ASSISTANT_PEER_STORE.state, {}, () => 0.9)`);
  check('⑦ 2人だけの組では「間に入る」を出さない', !nomed || !nomed.mediator);
  {
    // 間に入るの台本が無い組で3人目がいても、謝る・けんか自身の仲直りに戻って、必ず仲直りできる
    const have = new Set(G('assistantLifeRelSet().mend3').map(t => t.pk));
    const pk = G('assistantLifeRelSet().quarrel').map(t => t.pair.join('-')).find(k => !have.has(k));
    if (pk) {
      const [a, b] = pk.split('-'); const c = IDS.find(i => i !== a && i !== b);
      const qid = G(`assistantLifeRelSet().quarrel.find(t => t.kind === 'quarrel' && t.pair.join('-') === '${pk}').id`);
      await run(`ASSISTANT_PEER_STORE.set({ quarrel: { pending: { id: '${qid}', pair: '${pk}', at: Date.now() }, done: [] } });`);
      const t = G(`assistantLifeRelPickGroup({ ids: ['${a}', '${b}', '${c}'], place: 'home', doing: 'snack' }, ASSISTANT_PEER_STORE.state, ASSISTANT_LIFE_STORE.state.life, {}, () => 0.9)`);
      check('⑦ 間に入るの台本が無い組でも、3人の組で仲直りできる', !!t && t.kind === 'makeup' && t.quarrelId === qid, pk);
      await run(`ASSISTANT_PEER_STORE.set({ quarrel: { pending: null, done: [] } });`);
    }
  }

  // ⑧ 保存
  const norm = G('normalizeAssistantLifeRel');
  const bad = [null, 3, 'x', [], { mended: [] }, { mended: { 'kiki-mua': 'x', 'BAD': { day: '2026-11-08' } } }].map(v => JSON.stringify(norm(v).mended));
  check('⑧ 壊れた保存値でも空として読む', bad.every(s => s === '{}'), bad.join(' '));
  const keys = [...new Set(writes)].filter(k => /^mh_assistant_life_rel/.test(k));
  check('⑧ 新しく書くキーは mh_assistant_life_rel_v1 だけ', keys.length === 1 && keys[0] === 'mh_assistant_life_rel_v1', keys.join(','));
  flags.assistantLife = false;
  const off = await run(`ASSISTANT_PEER_STORE.set({ quarrel: { pending: { id: '${fight.id}', pair: 'kiki-mua', at: Date.now() - 2 * 86400000 }, done: [] } }); return [await assistantLifeRelMediate('mua'), assistantLifeRelPickPair(['atsu','sorashido'], { ids: ['atsu','sorashido'], doing: 'practice' }, ASSISTANT_PEER_STORE.state, ASSISTANT_LIFE_STORE.state.life, {}, () => 0)];`);
  check('⑧ 印 assistantLife が偽なら何もしない', off.every(v => v == null));
  flags.assistantLife = true;
  console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
};
main().catch(e => { console.error(e); process.exit(1); });
