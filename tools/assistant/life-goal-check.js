// 助手ライフの作り直し 段5: 今日の目標の土台(56-assistant-life-goal.jsx)を確かめる。ブラウザは使わない。
//   node tools/assistant/life-goal-check.js
//   ① 形: 壊れた値・違う形でも空の目標から読む(normalizeAssistantLifeGoal)
//   ② 数え方: 4つのうち3つで達成(2026-11-21 社長 A)・同じ行動は1日1回・3つ目で streak +1(4つ目では足さない)・日が変わると done だけ空
//   ③ 一度きりの写し: 初めて読むときだけ mh_assistant_life_daily_v1 の days の数と claims を写し、印を付ける。2回目は写さない
//   ④ 古いキーは消さず・書き換えない。新しいキーがすでにあれば写さない
//   ⑤ 保存の一覧(SAVE_DATA.md)・部品の並び(parts.json)に載っている
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const transform = (rel) => babel.transformSync(fs.readFileSync(path.join(root, rel), 'utf8'), { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code;
// 7日の記録の部分だけ(56-assistant-life-ux.jsx の ASSISTANT_LIFE_DAILY_KEY〜assistantLifeDailyNormalize)
const uxSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-ux.jsx'), 'utf8');
const dailySrc = uxSrc.slice(uxSrc.indexOf("const ASSISTANT_LIFE_DAILY_KEY = "), uxSrc.indexOf('// 聞いたときの次の状態'));
const goalCode = transform('monster-hero/src/parts/56-assistant-life-goal.jsx');

const fresh = (mem) => {
  const writes = [];
  const ctx = vm.createContext({
    console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
    storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
    storeSet: async (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
    assistantLifePerkDay: () => '2026-11-21',
  });
  vm.runInContext(dailySrc, ctx);
  vm.runInContext(goalCode, ctx);
  return { G: (e) => vm.runInContext(e, ctx), writes, mem };
};

(async () => {
  const { G } = fresh({});
  const N = G('normalizeAssistantLifeGoal');
  const empty = N(null);
  check('① 空の目標: v1・done は4つとも false・streak 0・basket 0', empty.v === 1 && Object.keys(empty.done).join() === 'watch,talk,give,play' && Object.values(empty.done).every(v => v === false) && empty.streak === 0 && empty.basket === 0);
  const broken = [N('x'), N([1]), N({ done: 'a', streak: -3, basket: 'b', day: 5 }), N({ done: { watch: 'yes', talk: true, zzz: true }, streak: 2.7 })];
  check('① 壊れた値でも空から(数は0以上の整数・done は true だけ・知らない行動は捨てる)', broken.slice(0, 3).every(b => b.streak === 0 && b.basket === 0 && b.day === '' && Object.values(b.done).every(v => v === false))
    && broken[3].done.watch === false && broken[3].done.talk === true && !('zzz' in broken[3].done) && broken[3].streak === 2, JSON.stringify(broken[3]));

  // ② 数え方
  const M = G('assistantLifeGoalMark');
  let s = N(null), r;
  r = M(s, 'watch', 'D1'); s = r.st;
  check('② 1つ目: 数える・まだ達成でない', r.added && !r.achieved && G('assistantLifeGoalDoneCount')(s) === 1 && s.streak === 0);
  r = M(s, 'watch', 'D1');
  check('② 同じ日の同じ行動は2回数えない', !r.added && G('assistantLifeGoalDoneCount')(r.st) === 1);
  check('② 知らない行動は数えない', !M(s, 'zzz', 'D1').added);
  r = M(s, 'talk', 'D1'); s = r.st;
  check('② 2つ目ではまだ達成でない', !r.achieved && s.streak === 0);
  r = M(s, 'give', 'D1'); s = r.st;
  check('② 4つのうち3つで達成・その日だけ streak +1', r.achieved && G('assistantLifeGoalAchieved')(s) && s.streak === 1);
  r = M(s, 'play', 'D1'); s = r.st;
  check('② 4つ目では streak を足さない', r.added && !r.achieved && s.streak === 1);
  const v1 = G('assistantLifeGoalView')(s, 'D2');
  check('② 日が変わると done だけ空(streak・basket はそのまま)', v1.count === 0 && !v1.achieved && v1.streak === 1 && v1.need === 3 && v1.days === 7);
  r = M(s, 'play', 'D2'); r = M(r.st, 'talk', 'D2'); r = M(r.st, 'watch', 'D2');
  check('② 次の日も3つで達成し、streak が 2', r.achieved && r.st.streak === 2);

  // ③④ 一度きりの写し
  const oldDaily = { day: '2026-11-20', heard: ['noon'], days: ['2026-11-15', '2026-11-17', '2026-11-20'], claims: 2 };
  const memA = { mh_assistant_life_daily_v1: JSON.parse(JSON.stringify(oldDaily)), mh_owned_items: { peer_gift: 1 } };
  const A = fresh(memA);
  const st1 = await A.G('ASSISTANT_LIFE_GOAL_STORE').load();
  check('③ 初めて読むと、続けた日数(days の数 3)と受け取った回数(claims 2)だけを写す', st1.streak === 3 && st1.basket === 2 && Object.values(st1.done).every(v => v === false), JSON.stringify(st1));
  check('③ 写したら新しいキーと印を書く', memA.mh_assistant_life_goal_v1 && memA.mh_assistant_life_goal_v1.streak === 3 && memA.mh_assistant_life_goal_migrated_v1 === true);
  check('④ 古いキー(mh_assistant_life_daily_v1)は消さず・書き換えない・ほかの保存も触らない', JSON.stringify(memA.mh_assistant_life_daily_v1) === JSON.stringify(oldDaily) && memA.mh_owned_items.peer_gift === 1
    && A.writes.every(k => k === 'mh_assistant_life_goal_v1' || k === 'mh_assistant_life_goal_migrated_v1'), A.writes.join(','));
  // 2回目(新しい起動): 古いキーが増えても写さない
  memA.mh_assistant_life_daily_v1 = { ...oldDaily, days: ['a', 'b', 'c', 'd', 'e', 'f'], claims: 9 };
  memA.mh_assistant_life_goal_v1 = { ...memA.mh_assistant_life_goal_v1, streak: 4 };
  const B = fresh(memA);
  const st2 = await B.G('ASSISTANT_LIFE_GOAL_STORE').load();
  check('③ 印があれば二度と写さない(今の新しいキーをそのまま読む)', st2.streak === 4 && st2.basket === 2 && B.writes.length === 0, JSON.stringify({ st2, w: B.writes }));
  // 印は無いが新しいキーがある(写しの途中で止まった等): 写さず、印だけ付ける
  const memC = { mh_assistant_life_daily_v1: oldDaily, mh_assistant_life_goal_v1: { v: 1, day: '', done: {}, streak: 5, basket: 1 } };
  const C = fresh(memC);
  const st3 = await C.G('ASSISTANT_LIFE_GOAL_STORE').load();
  check('④ 新しいキーがすでにあれば写さず(上書きしない)、印だけ付ける', st3.streak === 5 && st3.basket === 1 && memC.mh_assistant_life_goal_migrated_v1 === true && C.writes.join() === 'mh_assistant_life_goal_migrated_v1', C.writes.join(','));
  // 古いキーも無い人(初めての人)
  const memD = {};
  const D = fresh(memD);
  const st4 = await D.G('ASSISTANT_LIFE_GOAL_STORE').load();
  check('③ 古いキーが無い人は空の目標から(印は付ける)', st4.streak === 0 && st4.basket === 0 && memD.mh_assistant_life_goal_migrated_v1 === true);
  // 壊れた古いキー
  const memE = { mh_assistant_life_daily_v1: 'broken' };
  const E = fresh(memE);
  const st5 = await E.G('ASSISTANT_LIFE_GOAL_STORE').load();
  check('③ 古いキーが壊れていても空から写す・古いキーはそのまま', st5.streak === 0 && st5.basket === 0 && memE.mh_assistant_life_daily_v1 === 'broken');
  // 数える口
  const memF = {};
  const F = fresh(memF);
  await F.G("assistantLifeGoalNote('watch')"); await F.G("assistantLifeGoalNote('watch')"); await F.G("assistantLifeGoalNote('talk')");
  const last = await F.G("assistantLifeGoalNote('give')");
  check('② 数える口(assistantLifeGoalNote): 3つ目で達成・保存に書く', last.achieved && memF.mh_assistant_life_goal_v1.streak === 1 && memF.mh_assistant_life_goal_v1.day === '2026-11-21' && memF.mh_assistant_life_goal_v1.done.watch === true);

  // ⑤ 一覧
  const sd = fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8');
  check('⑤ 保存の一覧(SAVE_DATA.md)に新しいキーと印', sd.includes('`mh_assistant_life_goal_v1`') && sd.includes('`mh_assistant_life_goal_migrated_v1`'));
  const parts = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero/src/parts/parts.json'), 'utf8'));
  const flat = JSON.stringify(parts);
  check('⑤ 部品の並び(parts.json)に入っていて、7日の記録(-ux)より後ろ', flat.includes('56-assistant-life-goal.jsx') && flat.indexOf('56-assistant-life-ux.jsx') < flat.indexOf('56-assistant-life-goal.jsx'));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
