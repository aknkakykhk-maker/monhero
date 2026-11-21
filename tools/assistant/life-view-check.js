// 助手ライフの作り直し 段4: 🌡 調子・好き苦手・予定の通りやすさの「見る口」(計算だけ・保存は今のまま)を確かめる。ブラウザは使わない。
//   node tools/assistant/life-view-check.js
//   ① 🌡 調子の5段: 境目(2026-11-20 社長「部の案で進める」)どおり・壊れた値でも落ちない・けが/病気の印
//   ② 🌡 は新しく保存しない(読むだけで storeSet を呼ばない)
//   ③ 予定の通りやすさ: assistantLifePlanTrustOf が今までの式(Lv + 調子の上げ下げ)と同じ数・予定を当てる所もこれを使う
//   ④ ◎○△: 0.85以上 ◎・0.65以上 ○・それ未満 △。◎○△ の元の数と、本当に当てる数が同じ
//   ⑤ 好き苦手: 道具と家具を1つの一覧で数える。今の「分かった ◯/14」と同じ数え方の道具の分・家具の分の和になる。保存は読むだけ
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const mem = {};
const writes = [];
const flags = { assistantPeer: true, assistantLife: true, assistantLifeFurniture: true, assistantLifeBody: true, assistantLifePlan: true, assistantLifeSolo: true, assistantLifeTaste: true };
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
  React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f, useMemo: (f) => f() },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
  RELEASE_FLAGS: flags,
});
const load = (rel) => {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = rel.endsWith('.jsx') ? babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code : src;
  vm.runInContext(code, ctx);
};
load('monster-hero/data/assistants.js');
vm.runInContext("var assistantBubbleDayKey = () => '2026-11-21'; var assistantPeerDayKey = () => '2026-11-21'; var jstDayKey4 = () => '2026-11-21'; var assistantById = (id) => ASSISTANTS.find(a => a.id === id);", ctx);
for (const f of ['56-assistant-peer.jsx', '56-assistant-life.jsx', '56-assistant-life-gifts.jsx', '56-assistant-life-body.jsx', '56-assistant-life-plan.jsx', '56-assistant-life-taste-gift.jsx']) load(`monster-hero/src/parts/${f}`);
const G = (expr) => vm.runInContext(expr, ctx);

// ① 🌡 調子の5段
const K = G('assistantLifeCondFaceKey');
const cases = [
  [{ fat: 10, st: 10 }, {}, 'genki'],
  [{ fat: 29, st: 29 }, {}, 'genki'],
  [{ fat: 30, st: 10 }, {}, 'futsu'],
  [{ fat: 59, st: 49 }, {}, 'futsu'],
  [{ fat: 60, st: 10 }, {}, 'otsukare'],
  [{ fat: 10, st: 50 }, {}, 'otsukare'],
  [{ fat: 69, st: 59 }, {}, 'otsukare'],
  [{ fat: 70, st: 10 }, {}, 'hetoheto'],
  [{ fat: 10, st: 60 }, {}, 'hetoheto'],
  [{ fat: 10, st: 10, cond: { k: 'hurt', sev: 'light', left: 3, visits: 1 } }, {}, 'hetoheto'],
  [{ fat: 10, st: 10, cond: { k: 'sick', sev: 'light', left: 3, visits: 1 } }, {}, 'hetoheto'],
  [{ fat: 90, st: 90 }, { sleeping: true }, 'nemui'],
  [{ fat: 10, st: 10 }, { hour: 0 }, 'nemui'],
  [{ fat: 10, st: 10 }, { hour: 5 }, 'nemui'],
  [{ fat: 10, st: 10 }, { hour: 6 }, 'genki'],
];
const bad = cases.filter(([e, o, want]) => K(e, o) !== want).map(([e, o, want]) => `${JSON.stringify(e)} ${JSON.stringify(o)} → ${K(e, o)}(期待 ${want})`);
check('① 🌡 5段の境目(ねむい 深夜・寝ている / へとへと 疲れ70・ストレス60・けが・病気 / おつかれ 疲れ60・ストレス50 / 元気 どちらも30未満)', bad.length === 0, bad.join(' 、 '));
check('① 🌡 壊れた値でも落ちず「ふつう」か計算できる段', K(null) === 'futsu' && K('x') === 'futsu' && ['genki', 'futsu'].includes(K({ fat: 'abc', st: undefined })));
const F = G('ASSISTANT_LIFE_COND_FACES');
check('① 🌡 5段それぞれに顔と名前(元気・ふつう・おつかれ・へとへと・ねむい)', ['genki', 'futsu', 'otsukare', 'hetoheto', 'nemui'].every(k => F[k] && F[k].emoji && F[k].label)
  && ['元気', 'ふつう', 'おつかれ', 'へとへと', 'ねむい'].join() === ['genki', 'futsu', 'otsukare', 'hetoheto', 'nemui'].map(k => F[k].label).join());

// ② 保存は読むだけ: ストアに今の形の保存を入れて読む
const BODY_KEY = G('ASSISTANT_LIFE_BODY_KEY');
const data = G('normalizeAssistantLifeBody')({ s: { mua: { fat: 72, st: 20, cond: null }, kiki: { fat: 20, st: 20, cond: { k: 'hurt', sev: 'light', left: 5, visits: 1 } } } });
vm.runInContext(`ASSISTANT_LIFE_BODY_STORE.state = { ...ASSISTANT_LIFE_BODY_STORE.state, loaded: true, data: ${JSON.stringify(data)} };`, ctx);
writes.length = 0;
const mua = G("assistantLifeCondFaceOf('mua', { hour: 12 })");
const kiki = G("assistantLifeCondFaceOf('kiki', { hour: 12 })");
check('② 🌡 今の保存から計算する(みゅあ 疲れ72 → へとへと・きき けが → へとへと+🤕)', mua && mua.key === 'hetoheto' && mua.mark === '' && kiki && kiki.key === 'hetoheto' && kiki.mark === '🤕', JSON.stringify({ mua, kiki }));
check('② 🌡 読むだけで保存しない(新しいキーも書かない)', writes.length === 0 && !Object.keys(mem).some(k => k !== BODY_KEY && /cond|face/.test(k)), writes.join(','));
flags.assistantLifeBody = false;
check('② 🌡 体の印が偽なら null(今までどおり何も出さない)', G("assistantLifeCondFaceOf('mua', {})") === null);
flags.assistantLifeBody = true;

// ③ 予定の通りやすさ: 今までの式と同じ数(体の保存を変えて、調子の上げ下げ 0 と -0.3 の両方で比べる)
const T = G('ASSISTANT_LIFE_PLAN_TRUST');
const lvs = [1, 2, 5, 10, 20, 30, 40];
check('③ 仲良し度Lv の通りやすさは今までの数のまま', lvs.every(lv => Math.abs(G('assistantLifePlanTrust')(lv) - Math.min(T.max, T.base + (lv - 1) * T.perLv)) < 1e-9));
const setBody = (stv) => vm.runInContext(`ASSISTANT_LIFE_BODY_STORE.state = { ...ASSISTANT_LIFE_BODY_STORE.state, loaded: true, data: normalizeAssistantLifeBody({ s: { mua: { fat: 20, st: ${stv}, cond: null } } }) };`, ctx);
const diff = [];
for (const stv of [20, 85]) {
  setBody(stv);
  const lv = G("assistantLifePlanLvOf('mua')");
  const adj = G("assistantLifeBodyTrustAdj('mua', 100)");
  const want = Math.max(0, Math.min(1, G('assistantLifePlanTrust')(lv) + adj));
  const p = G("assistantLifePlanTrustOf('mua', 100)");
  if (Math.abs(p - want) > 1e-9) diff.push(`ストレス${stv}: ${p} / ${want}`);
  if (stv === 85 && adj !== -0.3) diff.push(`ストレス85の上げ下げ ${adj}`);
}
check('③ 通りやすさが今までの式(仲良し度Lv + 調子の上げ下げ)と同じ数', diff.length === 0, diff.join(' 、 '));
const planSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-plan.jsx'), 'utf8');
check('③ 予定を当てる所(assistantLifePlanOnDecide)も assistantLifePlanTrustOf を使う(見せる数と当てる数が1つ)', /trust\[id\] = assistantLifePlanTrustOf\(id, decided\.abs\)/.test(planSrc) && !/assistantLifePlanTrust\(assistantLifePlanLvOf\(id\)\) \+/.test(planSrc));

// ④ ◎○△
const E = G('assistantLifePlanEaseOfP');
const marks = [[1, '◎'], [0.85, '◎'], [0.8499, '○'], [0.65, '○'], [0.6499, '△'], [0, '△'], [NaN, '△']].filter(([p, m]) => E(p).mark !== m);
check('④ ◎○△ の境目(0.85以上 ◎・0.65以上 ○・それ未満 △)', marks.length === 0, marks.map(([p]) => `${p} → ${E(p).mark}`).join(' 、 '));
const pairs = [];
for (const stv of [20, 85]) {
  setBody(stv);
  const ez = G("assistantLifePlanEaseOf('mua', 100)");
  if (ez.p !== G("assistantLifePlanTrustOf('mua', 100)") || ez.mark !== E(ez.p).mark) pairs.push(`ストレス${stv}`);
}
check('④ ◎○△ の元の数は、本当に当てる通りやすさと同じ', pairs.length === 0, pairs.join(','));
const lv1 = G("assistantLifePlanLvOf('mua')");
setBody(20); const m0 = G("assistantLifePlanEaseOf('mua', 100)").mark;
setBody(85); const m1 = G("assistantLifePlanEaseOf('mua', 100)").mark;
check('④ はじめ(Lv1)は ○・ストレスが高いと △', lv1 !== 1 || (m0 === '○' && m1 === '△'), `Lv${lv1} ${m0}/${m1}`);

// ⑤ 好き苦手を1か所で
const known = { mua: { basket: 'gift', misanga: 'gift', bear: 'gift', sofa: 'gift', zzz: 'gift' } };
const st = { ...G('ASSISTANT_LIFE_GIFT_STORE').state, likes: { known, told: [] } };
writes.length = 0;
const v = G('assistantLifeLikesViewOf')('mua', st);
const giftKeys = v.items.filter(x => x.kind === 'gift').map(x => x.key);
const furnKeys = v.items.filter(x => x.kind === 'furn').map(x => x.key);
const giftKnown = v.items.filter(x => x.kind === 'gift' && x.shown !== 'unknown').length;
const furnKnown = v.items.filter(x => x.kind === 'furn' && x.shown !== 'unknown').length;
check('⑤ 道具と家具を1つの一覧に(🧸 ぬいぐるみは入れない・同じ物が二重に入らない)', giftKeys.length >= 10 && furnKeys.length === G('assistantLifeFurnDefs()').length && !giftKeys.includes('monplush') && new Set(v.items.map(x => `${x.kind}:${x.key}`)).size === v.items.length,
  `道具 ${giftKeys.length}・家具 ${furnKeys.length}`);
check('⑤ 分かった数 = 道具の分 + 家具の分(知らない key は数えない)・合計も同じ', v.known === giftKnown + furnKnown && v.total === giftKeys.length + furnKeys.length && v.known === 4, JSON.stringify({ known: v.known, total: v.total }));
check('⑤ 好き・苦手の一覧は、画面の好みの出し方(assistantLifeGiftShownLike)と同じ', v.items.every(x => G('assistantLifeGiftShownLike')('mua', x.key, st) === x.shown) && v.like.every(k => v.items.find(x => x.key === k).shown === 'like'));
check('⑤ 読むだけで保存しない', writes.length === 0, writes.join(','));
flags.assistantLifeFurniture = false;
check('⑤ 家具の印が偽なら家具は数えない', G('assistantLifeLikesViewOf')('mua', st).items.every(x => x.kind === 'gift'));
flags.assistantLifeFurniture = true;
check('⑤ 壊れた値でも落ちない', G('assistantLifeLikesViewOf')('mua', null).total >= 0);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
process.exit(failed ? 1 : 0);
