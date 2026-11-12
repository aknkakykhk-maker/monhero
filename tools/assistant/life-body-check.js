// 助手の疲れ・ストレス・けが・病気と🏥病院(56-assistant-life-body.jsx)を、画面を開かずに確かめる。
//   node tools/assistant/life-body-check.js
//   ① 保存 mh_assistant_life_body_v1 の読み: 壊れている・知らない助手・おかしな値 → はじめの値/捨てる。値は0〜100
//   ② 1回の動き: 場所の表のとおり・家で寝ると疲れ−25・好きな場所はストレス−5・0〜100で止まる
//   ③ けが・病気: 線の下では起きない。線の上ではいつか起きる(多くの種で数える)。重いと日数・病院の回数が増える
//   ④ 病院: 軽いけがは1回、重いけがは2回、軽い病気は2回で治る。自然にも治る。見ていない回でも治っていく・疲れが取れる
//   ⑤ 様子の直し: けが・病気の助手は家か病院・サボりは家へ・だれも消えない・2つの所に居ない・同じ種なら同じ結果
//   ⑥ 印が偽なら何もしない(様子はそのまま・保存を読まない・書かない・画面の口は空)。予定表の一覧に病院が出ない
//   ⑦ assistantLifeNow: 印が真なら1回ぶん進めて保存・同じ回では二度進めない。口 assistantLifeHospitalSlotsOf が病院の回を返す
//   ⑧ おまかせの助手だけで30日回しても、けが・病気はまれ(疲れ・ストレスがたまり続けない)
//   ⑩ 特別な治療(life_cure): 病院にいる回でけが・病気が残っているときだけ使える・使うと治って記録が 'cure'・口 assistantLifeHospitalCureSlotsOf が返す
//      交換所に 300P・印 assistantLifeBody つきで並ぶ・品物の説明がある・60-app は減らしてから治し、治せなければ戻す
//   ⑫ 体のせいで行き先が変わった回(サボり・けが病気)は記録に why を残し、予定表の結果の札がそれを出す
//   ⑪ けが・病気が予定表の外でも見える(家の部屋・部屋のシート・町の名札)・横の8人の表から1人の表示(体の窓)へ行ける
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const mem = {};
const writes = [];
const flags = { assistantPeer: true, assistantLife: true, assistantLifePlan: true, assistantLifeBody: true };
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
load('monster-hero/src/parts/56-assistant-life-body.jsx');
const G = (expr) => vm.runInContext(expr, ctx);
G('var assistantLifeBondPointsOf = () => 0; var assistantBondLevelOf = () => 1;');
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const rngOf = (seed) => G('assistantLifeRng')(seed);
const fixed = (v) => () => v;

(async () => {
  // ①
  {
    const N = G('normalizeAssistantLifeBody');
    const a = N(null); const b = N('x'); const c = N([1]);
    check('① 壊れている → 空', a.at === null && !Object.keys(a.s).length && b.at === null && c.at === null);
    const d = N({ at: 50, s: { mua: { fat: 250, st: -3, cond: { k: 'hurt', sev: 'heavy', left: 10, visits: 2 } }, nobody: { fat: 1, st: 1 }, kiki: { fat: 'x', st: null, cond: { k: 'flu', sev: 'light', left: 3, visits: 1 } } }, log: { mua: [{ abs: 49, place: 'home' }, { abs: 'x' }], nobody: [] } });
    check('① 値は0〜100・知らない助手は捨てる・壊れた値ははじめの値', d.s.mua.fat === 100 && d.s.mua.st === 0 && !d.s.nobody && d.s.kiki.fat === 20 && d.s.kiki.st === 20, JSON.stringify(d.s));
    check('① けが・病気の形がおかしい → 何も起きていない/正しい形は残る', d.s.kiki.cond === null && d.s.mua.cond && d.s.mua.cond.k === 'hurt' && d.s.mua.cond.visits === 2);
    check('① 記録は形の合うものだけ', d.log.mua.length === 1 && !d.log.nobody);
  }
  // ②
  {
    const S = G('assistantLifeBodyStepOne');
    const e = { fat: 50, st: 30, cond: null };
    const r1 = S(e, 'battle', 'battle', 'plaza', fixed(0.99)).e;
    const r2 = S(e, 'home', 'sleep', 'plaza', fixed(0.99)).e;
    const r3 = S(e, 'home', 'idle', 'plaza', fixed(0.99)).e;
    const r4 = S(e, 'plaza', 'walk', 'plaza', fixed(0.99)).e;
    const r5 = S({ fat: 5, st: 98, cond: null }, 'hill', 'idle', 'home', fixed(0.99)).e;
    check('② バトルは疲れ+12・ストレス+5', r1.fat === 62 && r1.st === 35, JSON.stringify(r1));
    check('② 家で寝ると疲れ−25・起きていると−10', r2.fat === 25 && r3.fat === 40);
    check('② 好きな場所はストレスがさらに−5', r4.st === 30 - 8 - 5, String(r4.st));
    check('② 0〜100で止まる', r5.fat === 0 && r5.st === 88);
  }
  // ③
  {
    const S = G('assistantLifeBodyStepOne');
    let low = 0; for (let i = 0; i < 400; i++) if (S({ fat: 50, st: 40, cond: null }, 'battle', 'battle', 'home', rngOf(`low${i}`)).e.cond) low++;
    check('③ 線の下(疲れ65・ストレス45)では けが・病気は起きない', low === 0, String(low));
    let hurt = 0, heavy = 0, sick = 0;
    for (let i = 0; i < 2000; i++) { const r = S({ fat: 85, st: 30, cond: null }, 'battle', 'battle', 'home', rngOf(`h${i}`)); if (r.ev === 'hurt') { hurt++; if (r.e.cond.sev === 'heavy') heavy++; } }
    for (let i = 0; i < 2000; i++) { const r = S({ fat: 10, st: 85, cond: null }, 'cardroom', 'cards', 'home', rngOf(`s${i}`)); if (r.ev === 'sick') sick++; }
    check('③ 疲れ100でバトル → けがは約30%', hurt > 450 && hurt < 750, String(hurt));
    check('③ 重いけがも起きる(線を大きく超えるほど)', heavy > 0 && heavy < hurt, `${heavy}/${hurt}`);
    check('③ ストレス88でカード → 病気は約27%', sick > 400 && sick < 700, String(sick));
    let calm = 0; for (let i = 0; i < 400; i++) if (S({ fat: 95, st: 30, cond: null }, 'cafe', 'snack', 'home', rngOf(`c${i}`)).ev === 'hurt') calm++;
    check('③ 休む場所ではけがをしない', calm === 0);
    const C = G('ASSISTANT_LIFE_BODY_COND');
    check('③ 重いほど日数・病院の回数が多い', C.hurt.heavy.slots > C.hurt.light.slots && C.hurt.heavy.visits > C.hurt.light.visits && C.sick.heavy.visits > C.sick.light.visits && C.hurt.light.visits === 1);
  }
  // ④
  {
    const S = G('assistantLifeBodyStepOne'); const C = G('ASSISTANT_LIFE_BODY_COND');
    const cnd = (k, sev) => ({ fat: 30, st: 30, cond: { k, sev, left: C[k][sev].slots, visits: C[k][sev].visits } });
    const visit = (e) => S(e, 'clinic', 'checkup', 'home', fixed(0.5)).e;
    check('④ 軽いけがは病院1回で治る', visit(cnd('hurt', 'light')).cond === null);
    const h2 = visit(cnd('hurt', 'heavy'));
    check('④ 重いけがは1回では治らず、2回で治る', h2.cond !== null && visit(h2).cond === null);
    const s1 = visit(cnd('sick', 'light'));
    check('④ 軽い病気は2回で治る', s1.cond !== null && visit(s1).cond === null);
    let e = cnd('hurt', 'heavy'); for (let i = 0; i < C.hurt.heavy.slots; i++) e = S(e, 'home', 'idle', 'home', fixed(0.5)).e;
    check('④ 病院へ行かなくても日数で治る', e.cond === null);
    const g = G('assistantLifeBodyGapOne')({ fat: 90, st: 70, cond: { k: 'sick', sev: 'light', left: 10, visits: 2 } }, 12);
    check('④ 見ていない回は休んでいた扱い(疲れ・ストレスが下がり、病気も治っていく)', g.fat < 90 && g.st < 70 && g.cond === null, JSON.stringify(g));
  }
  // ⑤
  await G('ASSISTANT_LIFE_BODY_STORE.load()');
  const decide = (abs) => G('assistantLifeDecide')({ abs, members: IDS, salt: 'chk' });
  const placeOf = (life, id) => { const g = life.groups.find(x => x.ids.includes(id)); return g ? g.place : (life.solo[id] || {}).place; };
  const allIds = (life) => [...life.groups.flatMap(g => g.ids), ...Object.keys(life.solo)].sort();
  {
    const abs = 12 * 700 + 6;
    const D = G('ASSISTANT_LIFE_BODY_STORE.state.data');
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...D, at: abs - 1, s: { mua: { fat: 20, st: 20, cond: { k: 'hurt', sev: 'light', left: 10, visits: 1 } }, atsu: { fat: 100, st: 100, cond: null } } } });
    let okAll = true, okMua = true, okDup = true, atsuHome = 0;
    for (let i = 0; i < 40; i++) {
      const a = abs + i * 12;
      G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...G('ASSISTANT_LIFE_BODY_STORE.state.data'), at: a - 1 } });
      const d0 = decide(a); const d1 = G('assistantLifeBodyOnDecide')(d0, 'chk');
      const ids = allIds(d1);
      if (ids.join() !== allIds(d0).join()) okAll = false;
      if (new Set(ids).size !== ids.length) okDup = false;
      if (!['home', 'clinic'].includes(placeOf(d1, 'mua'))) okMua = false;
      if (placeOf(d1, 'atsu') === 'home') atsuHome++;
    }
    check('⑤ だれも消えない', okAll);
    check('⑤ 2つの所に居ない', okDup);
    check('⑤ けがの助手は家か病院にいる', okMua);
    check('⑤ 疲れ・ストレス100の助手は、たいてい家で休む(サボり・自分で休む)', atsuHome >= 20, `${atsuHome}/40`);
    const x1 = JSON.stringify(G('assistantLifeBodyOnDecide')(decide(abs), 'chk')); const x2 = JSON.stringify(G('assistantLifeBodyOnDecide')(decide(abs), 'chk'));
    check('⑤ 同じ種なら同じ結果', x1 === x2);
  }
  // ⑥
  {
    flags.assistantLifeBody = false;
    const d0 = decide(12 * 800 + 5);
    const w0 = writes.length;
    check('⑥ 印が偽なら様子はそのまま', G('assistantLifeBodyOnDecide')(d0, 'chk') === d0);
    check('⑥ 印が偽なら進めない・書かない', G('assistantLifeBodyOnSlot')(d0, G('assistantLifeSlotOfAbs')(12 * 800 + 5)) === null && writes.length === w0);
    check('⑥ 印が偽なら口は空', G('assistantLifeBodyOf')('mua') === null && G('assistantLifeHospitalSlotsOf')('mua').length === 0 && G('assistantLifeBodyPerk')('cafe') === '');
    const shown = G('assistantLifeBodyPlaces')(G('ASSISTANT_LIFE_PLAN_PLACES'));
    check('⑥ 印が偽なら予定表に病院が出ない', !shown.includes('clinic') && shown.length === 10);
    const mapSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-map.jsx'), 'utf8');
    const mapBase = /const ASSISTANT_LIFE_MAP_ORDER = Object\.freeze\(\[([^\]]*)\]\);\s*const ASSISTANT_LIFE_MAP_TOWN_ONLY = Object\.freeze\(\[([^\]]*)\]\)/.exec(mapSrc);
    const mapUses = (mapSrc.split('assistantLifeMapTownOnlyNow = ')[1] || '').match(/ASSISTANT_LIFE_MAP_(ORDER|TOWN_ONLY)\./g);
    check('⑥ 印が偽なら地図に病院の札が無い(並び・町の札に clinic を持たず、使う所は印つきの関数を通す)', !!mapBase && !/clinic/.test(mapBase[1] + mapBase[2]) && !mapUses && /assistantLifeMapClinicOn\(\) \? \[\.\.\.ASSISTANT_LIFE_MAP_TOWN_ONLY, 'clinic'\]/.test(mapSrc), mapUses ? mapUses.join(',') : '');
    flags.assistantLifeBody = true;
    check('⑥ 印が真なら予定表の最後に病院', G('assistantLifeBodyPlaces')(G('ASSISTANT_LIFE_PLAN_PLACES')).slice(-1)[0] === 'clinic');
    check('⑥ ふだんの決め方では病院を選ばない(好みの重みが0)', Object.values(G('ASSISTANT_LIFE_PREFS')).every(p => !p.w.checkup));
  }
  // ⑦
  {
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: G('normalizeAssistantLifeBody')(null) });
    nowMs += 2 * 3600000;
    const life = await G(`assistantLifeNow({ members: ${JSON.stringify(IDS)}, now: ${nowMs} })`);
    const D = G('ASSISTANT_LIFE_BODY_STORE.state.data');
    check('⑦ 印が真なら1回ぶん進めて保存する', D.at === life.abs && mem.mh_assistant_life_body_v1 && Object.keys(D.s).length === 8);
    const w = writes.filter(k => k === 'mh_assistant_life_body_v1').length;
    G('assistantLifeBodyOnSlot')(life, G('assistantLifeSlotOfAbs')(life.abs));
    check('⑦ 同じ回では二度進めない', writes.filter(k => k === 'mh_assistant_life_body_v1').length === w);
    // 端末の時刻を戻したとき(保存の回が今より先)は、今の回に置き直して進める
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...G('ASSISTANT_LIFE_BODY_STORE.state.data'), at: life.abs + 30 } });
    G('assistantLifeBodyOnSlot')(life, G('assistantLifeSlotOfAbs')(life.abs));
    check('⑦ 時刻を戻したときは今の回に置き直す', G('ASSISTANT_LIFE_BODY_STORE.state.data').at === life.abs);
    const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life.jsx'), 'utf8');
    check('⑦ assistantLifeNow は印が真のときだけ読む(typeof で確かめる)', /assistantLifeBodyOn === 'function' && assistantLifeBodyOn\(\)\) \{ try \{ await ASSISTANT_LIFE_BODY_STORE\.load\(\)/.test(src) && /typeof assistantLifeBodyOnSlot === 'function'/.test(src));
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...D, log: { ...D.log, kiki: [{ abs: 5, place: 'clinic', ev: 'clinic' }, { abs: 6, place: 'home', ev: '' }, { abs: 7, place: 'clinic', ev: 'healed' }] } } });
    check('⑦ 口 assistantLifeHospitalSlotsOf が病院の回を返す', JSON.stringify(G('assistantLifeHospitalSlotsOf')('kiki')) === '[5,7]');
  }
  // ⑧ おまかせだけで30日(1日の12回をすべて見たとして)
  {
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: G('normalizeAssistantLifeBody')(null) });
    const start = 12 * 900; let conds = 0; let maxFat = 0; let maxSt = 0; const per = {}; const top = {};
    for (let a = start; a < start + 12 * 30; a++) {
      const d = G('assistantLifeBodyOnDecide')(decide(a), 'sim');
      const evs = G('assistantLifeBodyOnSlot')({ ...d, salt: 'sim' }, G('assistantLifeSlotOfAbs')(a)) || {};
      conds += Object.values(evs).filter(v => v === 'hurt' || v === 'sick').length;
      for (const [id, v] of Object.entries(evs)) if (v === 'hurt' || v === 'sick') per[id] = (per[id] || 0) + 1;
      for (const [id, e] of Object.entries(G('ASSISTANT_LIFE_BODY_STORE.state.data').s)) { maxFat = Math.max(maxFat, e.fat); maxSt = Math.max(maxSt, e.st); top[id] = Math.max(top[id] || 0, e.fat); }
    }
    check('⑧ おまかせだけの30日・8人で、けが・病気は合わせて3回まで', conds <= 3, `${conds}回 / 疲れの最大 ${maxFat}・ストレスの最大 ${maxSt} / けが・病気 ${JSON.stringify(per)} / 疲れの最大 ${JSON.stringify(top)}`);
  }
  // ⑨ おまかせのモンヒロバトルの回(修行)を減らしすぎない(印が偽のときの8割より多い)
  {
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: G('normalizeAssistantLifeBody')(null) });
    const start = 12 * 1000; let on = 0, off = 0; const onD = {}, offD = {};
    for (let a = start; a < start + 12 * 30; a++) {
      const d0 = decide(a); const d = G('assistantLifeBodyOnDecide')(d0, 'sim');
      G('assistantLifeBodyOnSlot')({ ...d, salt: 'sim' }, G('assistantLifeSlotOfAbs')(a));
      for (const id of IDS) { const k = `${id}|${Math.floor(a / 12)}`; if (placeOf(d0, id) === 'battle') offD[k] = (offD[k] || 0) + 1; if (placeOf(d, id) === 'battle') onD[k] = (onD[k] || 0) + 1; }
    }
    // 修行は1日3回まで(シュギョウ)。その日に修行できた回の合計で比べる
    const sum3 = (m) => Object.values(m).reduce((t, n) => t + Math.min(3, n), 0); on = sum3(onD); off = sum3(offD);
    check('⑨ 修行できた回(1日3回まで)は、印が偽のときの9割より多い', on > off * 0.9, `${on} / ${off}`);
  }
  // ⑩ 特別な治療
  {
    const A = 12 * 1100 + 6;
    const base = G('normalizeAssistantLifeBody')(null);
    const sick = { k: 'sick', sev: 'heavy', left: 50, visits: 2 };
    const at = (place, cond = sick, abs = A) => G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...base, at: A, s: { kiki: { fat: 30, st: 30, cond } }, log: { kiki: [{ abs: A - 1, place: 'home', ev: '' }, { abs, place, ev: 'clinic' }] } } });
    const can = G('assistantLifeBodyCanCure');
    at('clinic'); check('⑩ 病院にいる回・病気が残っている → 使える', can('kiki', A) === true);
    at('home'); check('⑩ 家にいる回 → 使えない', can('kiki', A) === false);
    at('clinic', null); check('⑩ けが・病気がない → 使えない', can('kiki', A) === false);
    at('clinic'); check('⑩ ちがう回(前の回の画面のまま) → 使えない', can('kiki', A + 1) === false && can('mua', A) === false);
    flags.assistantLifeBody = false; check('⑩ 印が偽 → 使えない', can('kiki', A) === false); flags.assistantLifeBody = true;
    at('clinic');
    const w = writes.length;
    const ok = G('assistantLifeBodyCure')('kiki', A);
    const D = G('ASSISTANT_LIFE_BODY_STORE.state.data');
    check('⑩ 使うと重い病気でもその場で治り、記録が cure になって保存される', ok === true && D.s.kiki.cond === null && D.log.kiki.slice(-1)[0].ev === 'cure' && writes.length > w && mem.mh_assistant_life_body_v1.s.kiki.cond === null);
    check('⑩ 口 assistantLifeHospitalCureSlotsOf がその回を返す・二度は使えない', JSON.stringify(G('assistantLifeHospitalCureSlotsOf')('kiki')) === `[${A}]` && G('assistantLifeBodyCure')('kiki', A) === false);
    const shop = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-event.js'), 'utf8');
    check('⑩ 交換所に 300P・印 assistantLifeBody つきで並ぶ', /id:'life_cure'[^\n]*cost:300, releaseFlag:'assistantLifeBody'/.test(shop));
    check('⑩ 品物の説明がある', /id:'life_cure', name:"特別な治療"/.test(fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8')));
    const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
    const fn = (app.match(/const cureAssistantLifeBody = async[\s\S]*?\n  \};/) || [''])[0];
    check('⑩ 60-app は使えるか確かめ → 1枚減らして保存 → 治す → 治せなければ戻す', fn.indexOf('assistantLifeBodyCanCure') > 0 && fn.indexOf('have - 1') > fn.indexOf('assistantLifeBodyCanCure') && fn.indexOf("storeSet('mh_owned_items'") < fn.indexOf('assistantLifeBodyCure(who') && /\+ 1 \}/.test(fn));
  }
  // ⑪ 予定表の外・横の表
  {
    const A = 12 * 1200 + 6;
    G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...G('normalizeAssistantLifeBody')(null), at: A, s: { kiki: { fat: 30, st: 30, cond: { k: 'hurt', sev: 'light', left: 10, visits: 1 } } } } });
    check('⑪ けが・病気の一言が出る・元気な助手は空', /けが/.test(G('assistantLifeBodyCondShort')('kiki')) && G('assistantLifeBodyCondShort')('mua') === '');
    flags.assistantLifeBody = false; check('⑪ 印が偽なら一言は空', G('assistantLifeBodyCondShort')('kiki') === ''); flags.assistantLifeBody = true;
    const rd = (f) => fs.readFileSync(path.join(root, 'monster-hero/src/parts', f), 'utf8');
    check('⑪ 家の部屋・部屋のシート・町の名札が一言/印を出す', /data-assistant-life-room-body/.test(rd('56-assistant-life-house.jsx')) && /data-assistant-life-room-cond/.test(rd('56-assistant-life-house.jsx')) && /assistantLifeBodyCondShort\(id\) \? assistantLifeBodyBadge\(id\)/.test(rd('56-assistant-life-map.jsx')));
    const plan = rd('56-assistant-life-plan.jsx');
    check('⑪ 横の表の名前から1人の表示へ・表へ戻れる・けが病気の行き先えらびに理由', /data-assistant-life-plan-who-open/.test(plan) && /onWho=\{setWho\}/.test(plan) && /data-assistant-life-plan-back/.test(plan) && /data-assistant-life-plan-cond-note/.test(plan));
  }
  // ⑫ 行き先が変わった理由
  {
    const N = G('normalizeAssistantLifeBody');
    const d = N({ at: 3, s: {}, log: { kiki: [{ abs: 2, place: 'home', ev: '', why: 'skip' }, { abs: 3, place: 'home', ev: '', why: 'bogus' }] } });
    check('⑫ 読み: why は決まった語だけ残す', d.log.kiki[0].why === 'skip' && !('why' in d.log.kiki[1]));
    // 疲れきった助手(サボる見込みが高い)に、予定で「モンヒロバトル」をお願いした回を多くの種で回す
    let skips = 0, wrote = 0, n = 0;
    for (let a = 12 * 1300; a < 12 * 1300 + 240; a++) {
      const life = decide(a); const id = IDS.find(x => placeOf(life, x) === 'battle'); if (!id) continue;
      G('ASSISTANT_LIFE_BODY_STORE').set({ data: { ...N(null), at: a - 1, s: { [id]: { fat: 95, st: 90, cond: null } } } });
      const d2 = G('assistantLifeBodyOnDecide')(life, 'why');
      const moved = placeOf(d2, id) !== 'battle';
      G('assistantLifeBodyOnSlot')({ ...d2, salt: 'why' }, G('assistantLifeSlotOfAbs')(a));
      const w = G('assistantLifeBodyWhyOf')(a, id); n++;
      if (moved) { skips++; if (w && (w.why === 'skip' || w.why === 'rest' || w.why === 'cond')) wrote++; }
      else if (w) wrote = -999;
    }
    check('⑫ 行き先が変わった回だけ why が残り、口 assistantLifeBodyWhyOf が返す', skips > 0 && wrote === skips, `${n}回中 変わった ${skips}・why あり ${wrote}`);
    check('⑫ 予定表の結果の札が理由を出す(お願いどおりと出さない)', /data-assistant-life-plan-body-why/.test(fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-plan.jsx'), 'utf8')));
  }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
