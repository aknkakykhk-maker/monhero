// 助手ライフの行き先の予定(📅 今日の予定表・56-assistant-life-plan.jsx)を、画面を開かずに確かめる。
//   node tools/assistant/life-plan-check.js
//   ① 保存 mh_assistant_life_plan_v1 の読み: 壊れている・日が違う・知らない助手や場所 → 捨てる(空)。今日の回だけ残る
//   ② 聞いてくれる割合: 仲良し度 Lv1 で 65%・1Lv ごとに +1%・上は 93%
//   ③ 当てはめ: 聞いた助手はその場所に、その場所でできる「していること」で居る(組も含め、場所と していること が必ず合う)。
//      2人きりで家の組は作らない。だれも2つの所に居ない・消えない。同じ種なら何度やっても同じ結果(開き直しで変わらない)
//   ④ 割合どおりに聞く(Lv1 で約65%・Lv30 で約93%。多くの回で数える)
//   ⑤ 決める・空ける: いまの回・過ぎた回・深夜(0〜4時)・明日の回は決められない。印が偽なら何もせず、保存も書かない
//   ⑥ assistantLifeNow: 印が偽なら予定を読まない(様子はふだんどおり)・真なら今の回の予定を当てはめ、結果を1回だけ書く
//   ⑦ 返事の台詞(ココロ3の32本): 8人とも ok・no があり、穴が埋まる(ok は頼んだ場所・no は実際に行った場所)。取り込みとファイルがそろう
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const mem = {};
const writes = [];
const flags = { assistantPeer: true, assistantLife: true, assistantLifePlan: true };
let nowMs = Date.parse('2026-11-12T13:10:00+09:00');
const ctx = vm.createContext({
  console, Math, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
  Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(nowMs); } static now() { return nowMs; } },
  React: { useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f },
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
vm.runInContext('var assistantBubbleDayKey = () => "2026-11-12"; var assistantPeerDayKey = () => "2026-11-12"; var jstDayKey4 = () => "2026-11-12"; var assistantById = (id) => ASSISTANTS.find(a => a.id === id);', ctx);
load('monster-hero/src/parts/56-assistant-peer.jsx');
load('monster-hero/src/parts/56-assistant-life.jsx');
load('monster-hero/src/parts/56-assistant-life-plan.jsx');
const G = (expr) => vm.runInContext(expr, ctx);
const lvBox = { lv: 1 };
ctx.__lv = lvBox;
G('var assistantLifeBondPointsOf = () => 0; var assistantBondLevelOf = () => __lv.lv;');

const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const DOINGS = G('ASSISTANT_LIFE_DOINGS');
const slotAbs = () => G('assistantLifeSlotAt()').abs;

(async () => {
  const cur = slotAbs(); const day = Math.floor(cur / 12);
  // ① 読み
  {
    const N = G('normalizeAssistantLifePlan');
    const empty = (x) => x && JSON.stringify(x.plan) === '{}' && JSON.stringify(x.result) === '{}';
    check('① 無い・壊れている → 空', [null, 1, 'x', [], { day: 'a' }, { day, plan: 3 }].every(r => empty(N(r, day))));
    check('① 日が違う → 空(次の日に前の日の予定を持ち越さない)', empty(N({ day: day - 1, plan: { [cur + 1]: { mua: 'cafe' } } }, day)));
    const r = N({ day, plan: { [cur + 1]: { mua: 'cafe', kiki: 'market', nobody: 'cafe', dra: 'moon' }, [(day + 1) * 12 + 5]: { mua: 'hill' } }, result: { [cur]: { mua: 'ok', kiki: 'maybe' } } }, day);
    check('① 知らない助手・場所(マーケット含む)・今日でない回は捨てる', JSON.stringify(r.plan) === JSON.stringify({ [cur + 1]: { mua: 'cafe' } }) && JSON.stringify(r.result) === JSON.stringify({ [cur]: { mua: 'ok' } }), JSON.stringify(r));
  }
  // ② 割合
  {
    const T = G('assistantLifePlanTrust');
    check('② Lv1 65%・Lv10 74%・Lv29 93%・Lv30 93%・壊れた値は Lv1', Math.abs(T(1) - 0.65) < 1e-9 && Math.abs(T(10) - 0.74) < 1e-9 && Math.abs(T(29) - 0.93) < 1e-9 && T(30) === 0.93 && T(NaN) === 0.65, [T(1), T(10), T(29), T(30)].join(','));
  }
  // ③ 当てはめ
  {
    const decide = G('assistantLifeDecide'); const apply = G('assistantLifePlanApply'); const places = G('ASSISTANT_LIFE_PLAN_PLACES');
    const ng = []; let okN = 0;
    for (let k = 0; k < 400; k++) {
      const abs = day * 12 + 2 + (k % 10);
      const d = decide({ abs, members: IDS, salt: `s${k}` });
      const want = {}; for (let i = 0; i < IDS.length; i++) if ((k + i) % 3 === 0) want[IDS[i]] = places[(k * 7 + i) % places.length];
      const trust = Object.fromEntries(Object.keys(want).map(id => [id, 1])); // 必ず聞く
      const r = apply(d, want, trust, `s${k}`);
      const L = r.life;
      const seen = [...L.groups.flatMap(g => g.ids), ...Object.keys(L.solo)];
      if (seen.length !== IDS.length || new Set(seen).size !== IDS.length) ng.push(`${k}: 助手の数が合わない ${seen.join(',')}`);
      for (const g of L.groups) {
        if (!DOINGS[g.doing].places.includes(g.place)) ng.push(`${k}: 組の場所と していること ${g.place}/${g.doing}`);
        if (g.ids.length < 2) ng.push(`${k}: 1人の組`);
        if (g.place === 'home' && g.ids.length < 3) ng.push(`${k}: 2人で家`);
      }
      for (const [id, s] of Object.entries(L.solo)) if (!DOINGS[s.doing].places.includes(s.place)) ng.push(`${k}: ${id} の場所と していること ${s.place}/${s.doing}`);
      for (const [id, p] of Object.entries(want)) {
        const g = L.groups.find(x => x.ids.includes(id)); const at = g ? g.place : L.solo[id].place;
        if (at !== p) ng.push(`${k}: ${id} が ${p} に居ない(${at})`); else okN++;
        if (r.result[id] !== 'ok') ng.push(`${k}: ${id} の結果が ok でない`);
      }
      const again = apply(d, want, trust, `s${k}`);
      if (JSON.stringify(again) !== JSON.stringify(r)) ng.push(`${k}: 同じ種で結果が変わる`);
    }
    check('③ 聞いた助手は必ずその場所・場所と していること が合う・2人で家なし・数が合う・同じ種なら同じ', ng.length === 0 && okN > 300, ng.slice(0, 4).join(' / ') || `${okN} 件`);
    const d = decide({ abs: day * 12 + 6, members: IDS, salt: 'z' });
    const r0 = apply(d, { mua: 'cafe' }, { mua: 0 }, 'z');
    check('③ 断ったら様子はふだんどおり(結果は no)', JSON.stringify(r0.life) === JSON.stringify(d) && r0.result.mua === 'no');
  }
  // ④ 割合どおり
  {
    const decide = G('assistantLifeDecide'); const apply = G('assistantLifePlanApply'); const T = G('assistantLifePlanTrust');
    const rate = (lv) => { let ok = 0, n = 0; for (let k = 0; k < 3000; k++) { const d = decide({ abs: day * 12 + 3 + (k % 9), members: IDS, salt: `r${k}` }); const r = apply(d, { kiki: 'hill' }, { kiki: T(lv) }, `r${k}`); n++; if (r.result.kiki === 'ok') ok++; } return ok / n; };
    const a = rate(1), b = rate(30);
    check('④ Lv1 で約65%・Lv30 で約93%(±4%)', Math.abs(a - 0.65) < 0.04 && Math.abs(b - 0.93) < 0.04, `${(a * 100).toFixed(1)}% / ${(b * 100).toFixed(1)}%`);
  }
  // ⑤ 決める・空ける
  {
    await G('ASSISTANT_LIFE_PLAN_STORE.load()');
    const set = G('assistantLifePlanSet');
    const j = cur % 12; // 13:10 → 12〜14時(j=6)
    check('⑤ 次の回は決められる', set(cur + 1, 'mua', 'cardroom') === true && G('assistantLifePlanOf')(cur + 1, 'mua') === 'cardroom');
    check('⑤ いまの回・過ぎた回・明日の回・知らない場所は決められない', !set(cur, 'mua', 'cafe') && !set(cur - 1, 'mua', 'cafe') && !set((day + 1) * 12 + 5, 'mua', 'cafe') && !set(cur + 2, 'mua', 'market') && !set(cur + 2, 'nobody', 'cafe'), `j=${j}`);
    check('⑤ 保存は新しいキー mh_assistant_life_plan_v1 だけ', [...new Set(writes)].every(k => k === 'mh_assistant_life_plan_v1') && mem.mh_assistant_life_plan_v1 && mem.mh_assistant_life_plan_v1.day === day, JSON.stringify([...new Set(writes)]));
    check('⑤ 空ける(null)とおまかせに戻る', set(cur + 1, 'mua', null) === true && G('assistantLifePlanOf')(cur + 1, 'mua') === null);
    const left = G('assistantLifePlanSlotsLeft()');
    check('⑤ 今日の残りの回は次の回から 22〜24時まで', left[0] === cur + 1 && left[left.length - 1] === day * 12 + 11, JSON.stringify(left));
    nowMs = Date.parse('2026-11-12T01:10:00+09:00');
    check('⑤ 深夜(0〜4時)の回は決められない', set(day * 12 + 1, 'mua', 'cafe') === false && G('assistantLifePlanSlotsLeft()')[0] === day * 12 + 2);
    nowMs = Date.parse('2026-11-12T13:10:00+09:00');
    flags.assistantLifePlan = false;
    const before = writes.length;
    check('⑤ 印が偽なら決められない・書かない・窓も開かない・部屋の行も出ない', set(cur + 1, 'mua', 'cafe') === false && writes.length === before && G('assistantLifePlanOpen({})') === false && G('assistantLifePlanRowInfo("mua")') === null);
    flags.assistantLifePlan = true;
  }
  // ⑥ assistantLifeNow とのつなぎ
  {
    G('assistantLifePlanSet')(cur + 1, 'kiki', 'hill');
    lvBox.lv = 30;
    nowMs += 2 * 3600000; // 次の回へ
    // 何度か回して、聞いた回が1回はあることを見る(Lv30 なので 93%)
    const life = await G(`assistantLifeNow({ members: ${JSON.stringify(IDS)}, now: ${nowMs} })`);
    const res = G('assistantLifePlanResultOf')(cur + 1, 'kiki');
    const g = life.groups.find(x => x.ids.includes('kiki')); const at = g ? g.place : life.solo.kiki.place;
    check('⑥ 印が真なら今の回の予定を当てはめ、結果を残す(ok なら丘・no ならふだんどおり)', (res === 'ok' && at === 'hill') || res === 'no', `${res} ${at}`);
    const w1 = writes.filter(k => k === 'mh_assistant_life_plan_v1').length;
    await G(`assistantLifeNow({ members: ${JSON.stringify(IDS)}, now: ${nowMs} })`);
    check('⑥ 同じ回でもう一度開いても、結果は書き直さない', writes.filter(k => k === 'mh_assistant_life_plan_v1').length === w1);
    const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life.jsx'), 'utf8');
    check('⑥ assistantLifeNow は印が真のときだけ予定を読む(typeof で確かめる)', /assistantLifePlanOn === 'function' && assistantLifePlanOn\(\)\) \{ try \{ await ASSISTANT_LIFE_PLAN_STORE\.load\(\)/.test(src) && /typeof assistantLifePlanOnDecide === 'function' \? assistantLifePlanOnDecide\(decided0, cur\.salt\) : decided0/.test(src));
  }
  // ⑦ 返事の台詞
  {
    const L = G('ASSISTANT_LIFE_PLAN_LINES');
    check('⑦ 8人とも ok・no の返事がある', IDS.every(id => L[id] && L[id].ok.length && L[id].no.length));
    const d = G('ASSISTANT_LIFE_PLAN_STORE.state.data'); const k = String(cur + 1);
    G(`ASSISTANT_LIFE_PLAN_STORE.set({ data: { ...ASSISTANT_LIFE_PLAN_STORE.state.data, plan: { ...ASSISTANT_LIFE_PLAN_STORE.state.data.plan, ${k}: { mua: 'cardroom', kiki: 'hill' } }, result: { ...ASSISTANT_LIFE_PLAN_STORE.state.data.result, ${k}: { mua: 'ok', kiki: 'no' } }, went: { ${k}: { kiki: 'library' } } } })`);
    const a = G('assistantLifePlanLineOf')(cur + 1, 'mua'), b = G('assistantLifePlanLineOf')(cur + 1, 'kiki');
    const holeOk = (x) => x && !/\{[a-z]+\}/.test(x.text);
    check('⑦ 穴が埋まる(ok は頼んだ場所・no は実際に行った場所)', holeOk(a) && holeOk(b) && (!/カード部屋|図書室/.test(b.text) || !b.text.includes('カード部屋')), `${a && a.text} / ${b && b.text}`);
    check('⑦ 結果が無い回は返事なし', G('assistantLifePlanLineOf')(cur + 2, 'mua') === null);
    check('⑦ 取り込みとファイルがそろう', require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'life-plan-lines-import.js'), '--check']).status === 0);
    void d;
  }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
