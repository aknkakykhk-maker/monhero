#!/usr/bin/env node
// 助手のマスモンの修行と助手の成長(56-assistant-life-masmon-train.jsx・社長の仕様書の第②段階)と技表(data/assistant-masmon-techs.js)を、画面なしで確かめる。
//   技表の形と幅/印が偽なら何もしない/初めの値は一度だけ/同じ種なら同じ結果/修行はモンヒロバトルにいた回だけ・1日2回まで/熟練は0〜100で下がらない/
//   技の習得は条件どおり/ブリーダー能力の天井と効き目の幅/相談は1日1回/保存の正規化/第③段階へ渡す形
//   第①段階(育成)の受け口は、ここでは小さな代わり(drive)で回す。--sim で 30・90・180 日の伸びを表に出す
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const all = read('monster-hero/src/parts/56-assistant-life-masmon-train.jsx');
const body = all.slice(0, all.indexOf('// ---------- 画面'));
const techsSrc = read('monster-hero/data/assistant-masmon-techs.js');
const lifeSlots = read('monster-hero/src/parts/56-assistant-life.jsx').match(/^const ASSISTANT_LIFE_SLOTS = [\s\S]*?^\]\);/m)[0];
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const make = (on, seed = 'seed-1') => {
  const saved = {};
  const ctx = { console, Promise, RELEASE_FLAGS: { assistantMasmonTrain: on }, ASSISTANT_MASMON_STORE: { state: { seed } },
    storeSet: (k, v) => { saved[k] = JSON.parse(JSON.stringify(v)); }, storeGet: async (k, d) => (k in saved ? saved[k] : d) };
  vm.createContext(ctx);
  vm.runInContext(`${techsSrc}\n${lifeSlots}\n${body}\nthis.T = { ASSISTANT_MASMON_TECHS, AMGT_STORE, AMGT_NUM, AMGT_KINDS, AMGT_SENSE_KEYS, AMGT_BR_KEYS, AMGT_BR_INIT, normalizeAssistantMasmonTrain, amgtChoose, amgtDo, amgtAfterAct, amgtLeadMult, amgtFailMult, amgtStressMult, amgtRestAt, amgtAskOf, amgtAnswer, amgtBattleOf, amgtTacticsOf, amgtEntryOf, amgtInitMon, amgtActName, amgtBrCap, amgtNoteLife, amgtSlotOf, amgtCanLearn, amgtTechsOf, amgtRoomLine };`, ctx);
  ctx.T.AMGT_STORE.loaded = true;
  return { T: ctx.T, saved, ctx };
};
const rows = [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25 }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12 }];
const START = 20403 * 3; // ある日の朝
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; // よく混ぜる(似た文字列で片寄らない)
// 第①段階の代わり: 疲れたら休む・ストレスが高ければ遊ぶ・それ以外は軽トレ(伸ばす能力は回ごとに変わる)。修行の回は amgtDo。
//   モンヒロバトルにいた回は、プレイヤーが開いていたとして半分くらいの回に印を付ける
const KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const drive = (T, aid, days, opt = {}) => {
  const E = {}; for (const r of rows) E[r.slot] = { st: { life: 150, pow: r.monster === 'Golem' ? 220 : 90, wise: r.monster === 'Pixie' ? 170 : 110, hit: 130, eva: 120, tough: 120 }, fat: 0, str: 0, lv: r.lv };
  const per = {}; const atSlots = new Set();
  for (let s = START; s < START + days * 3; s++) {
    if (hash(`${aid}|at|${s}`) < (opt.atRate == null ? 0.5 : opt.atRate)) { const at = T.AMGT_STORE.state.at; T.AMGT_STORE.state = { ...T.AMGT_STORE.state, at: { ...at, [aid]: [...(at[aid] || []), s].slice(-12) } }; atSlots.add(s); }
    if (opt.answer && s % 3 === 0) { const ask = T.amgtAskOf(aid, rows, Math.floor(s / 3), (r) => E[r.slot]); if (ask) T.amgtAnswer(aid, ask, ask.opts[0], s); }
    for (const r of rows) {
      const e = E[r.slot];
      const rest = T.amgtRestAt(aid, 60);
      const act = e.fat >= rest ? { a: 'rest' } : e.str >= 50 ? { a: 'play' } : (T.amgtChoose(aid, e, r, null, s) || { a: 'light', k: KEYS[s % 6] });
      if (act.a === 'shugyo') {
        const add = (k, lo) => { e.st[k] = Math.min(999, e.st[k] + lo); };
        T.amgtDo(aid, e, r, null, s, act, add, (x) => 0.05 + x);
        const d = Math.floor(s / 3); per[d] = per[d] || {}; per[d][r.slot] = (per[d][r.slot] || 0) + 1;
        if (![...atSlots].some(n => Math.floor(n / 3) === Math.floor(s / 3) && n <= s)) per.outside = (per.outside || 0) + 1;
      } else {
        if (act.a === 'rest') e.fat = Math.max(0, e.fat - 30); else if (act.a === 'play') { e.fat = Math.max(0, e.fat - 10); e.str = Math.max(0, e.str - 15); } else { e.fat = Math.min(100, e.fat + 5); e.str = Math.min(100, e.str + 1); e.st[act.k] = Math.min(999, e.st[act.k] + 5); }
        T.amgtAfterAct(aid, act, false, s);
      }
    }
  }
  return { E, per };
};

// ⓪ 技表
{
  const { T } = make(true);
  const M = {}; const c = {}; vm.createContext(c);
  vm.runInContext(read('monster-hero/data/images/images-ally.js') + read('monster-hero/data/ally-monsters.js') + ';this.M = ALL_PLAYER_MONSTERS; this.N = HERO_ATK_NAMES;', c);
  Object.assign(M, c.M);
  const S = T.ASSISTANT_MASMON_TECHS.species;
  const ids = Object.keys(M);
  check('⓪ 技表に全部の種族がある(1種族8つ)', ids.every(id => Array.isArray(S[id]) && S[id].length === 8), ids.filter(id => !S[id] || S[id].length !== 8).join(','));
  const allT = Object.values(S).flat();
  check('⓪ 技の id はかぶらない', new Set(allT.map(t => t.id)).size === allT.length);
  const inRange = (t) => t.power >= 4 && t.power <= 70 && t.hit >= -25 && t.hit <= 22 && t.guts >= 10 && t.guts <= 55 && t.crit >= 5 && t.crit <= 30 && t.gd >= 0 && t.gd <= 45 && ['pow', 'wise'].includes(t.kind) && Array.isArray(t.dist) && t.dist.length >= 1 && t.dist.length <= 2 && t.dist.every(d => d >= 0 && d <= 3);
  check('⓪ 数字はモンスターファーム2の幅の中', allT.every(inRange), allT.filter(t => !inRange(t)).map(t => t.id).join(','));
  check('⓪ どの種族も零・近・中・遠のどこにでも届く技がある', ids.every(id => [0, 1, 2, 3].every(d => S[id].some(t => t.dist.includes(d)))));
  check('⓪ 初めから使える技が2つ・近くに届く', ids.every(id => S[id].filter(t => t.learn.start).length === 2 && S[id].some(t => t.learn.start && (t.dist.includes(0) || t.dist.includes(1)))));
  const names = (id) => [...(c.N[id] || []), ...((M[id].unique && M[id].unique.names) || [])];
  check('⓪ 名前はその種族がいまゲームで持っている技の名前', ids.every(id => S[id].every(t => names(id).includes(t.name))));
  check('⓪ 先に磨く技は同じ種族の・先の技', ids.every(id => S[id].every((t, i) => !t.learn.need || Object.keys(t.learn.need).every(n => S[id].slice(0, i).some(x => x.id === n)))));
  check('⓪ 覚える修行の系統は決まった6つのどれか', allT.every(t => t.learn.start || T.AMGT_KINDS[t.learn.by]));
  check('⓪ 距離撃という技は無い', !allT.some(t => /距離撃/.test(t.name)));
}

// ① 印が偽: 受け口は何もしない
{
  const { T, saved } = make(false);
  const e = { st: { pow: 100 }, fat: 0, str: 0, lv: 30 };
  T.AMGT_STORE.state = { ...T.AMGT_STORE.state, at: { kiki: [START] } };
  check('① 印が偽なら修行を選ばない', T.amgtChoose('kiki', e, rows[0], null, START) === null);
  const before = JSON.stringify(e);
  T.amgtDo('kiki', e, rows[0], null, START, { a: 'shugyo', k: 'pow' }, () => { throw new Error('add を呼んだ'); }, () => 0);
  T.amgtAfterAct('kiki', { a: 'light', k: 'pow' }, false, START);
  check('① 印が偽なら当てない・保存しない', JSON.stringify(e) === before && Object.keys(saved).length === 0 && JSON.stringify(T.AMGT_STORE.state.br) === '{}');
  check('① 印が偽なら掛け算は全部1・休ませる目安もそのまま', T.amgtLeadMult('kiki') === 1 && T.amgtFailMult('kiki') === 1 && T.amgtStressMult('kiki') === 1 && T.amgtRestAt('kiki', 65) === 65);
  check('① 印が偽なら生活の居場所も覚えない', T.amgtNoteLife({ abs: 100, groups: [], solo: { kiki: { place: 'battle' } } }) === false);
}

// ①-2 保存を読み込む前は書かない(ミハリ 11-11)
{
  const { T, saved } = make(true);
  T.AMGT_STORE.loaded = false;
  const e = { st: { pow: 300 }, fat: 0, str: 0, lv: 30 };
  T.amgtDo('kiki', e, rows[0], null, START, { a: 'shugyo', k: 'pow' }, () => {}, () => 0);
  const ask = { q: 'next', slot: 1, opts: ['pow', 'wise'] };
  const ok = T.amgtAnswer('kiki', ask, 'pow', START);
  T.amgtAfterAct('kiki', { a: 'light', k: 'pow' }, false, START);
  check('① 読み込む前に amgtDo・amgtAnswer・amgtAfterAct を呼んでも保存しない', Object.keys(saved).length === 0 && ok === false && JSON.stringify(T.AMGT_STORE.state.mons) === '{}');
  const r = make(true);
  const qr = { q: 'rest', slot: 1, opts: ['rest', 'more'] };
  check('① 「休ませよう」は第①段階が受けなければ答えを残さない', r.T.amgtAnswer('kiki', qr, 'rest', START) === false && !r.T.AMGT_STORE.state.ask.kiki);
  r.ctx.amgAdvise = () => true;
  check('① 第①段階が受ければ「休ませよう」を残す', r.T.amgtAnswer('kiki', qr, 'rest', START) === true && r.T.AMGT_STORE.state.ask.kiki.a === 'rest');
}

// ② 初めの値
{
  const { T } = make(true);
  const g = T.amgtInitMon('Golem', 30, { pow: 220, wise: 100, hit: 80 }); const p = T.amgtInitMon('Pixie', 12, { pow: 80, wise: 120, hit: 150 });
  check('② 初めからの技は覚えている', T.amgtTechsOf('Golem').filter(t => t.learn.start).every(t => g.learn.includes(t.id)));
  check('② 初めは「初めから」の技の2つだけ(能力が高くても先に覚えない・ヘルプ「初めは2つだけ」)', g.learn.length === 2 && p.learn.length === 2, g.learn.join(','));
  check('② 熟練の初めの値は育成 Lv×0.3(最大30)', g.m.golem_01 === 9 && p.m.pixie_01 === 4 && T.amgtInitMon('Golem', 99, null).m.guard === 30);
}

// ③ 同じ種なら同じ結果・モンヒロバトルにいた回だけ・1日2回まで・下がらない・上限
{
  const a = make(true); const b = make(true);
  const ra = drive(a.T, 'kyuko', 60); drive(b.T, 'kyuko', 60);
  check('③ 同じ種なら同じ結果', JSON.stringify(a.T.AMGT_STORE.state) === JSON.stringify(b.T.AMGT_STORE.state));
  const c = make(true, 'seed-2'); drive(c.T, 'kyuko', 60);
  check('③ 違う種なら違う結果', JSON.stringify(c.T.AMGT_STORE.state.mons) !== JSON.stringify(a.T.AMGT_STORE.state.mons));
  check('③ 修行は、その日にモンヒロバトルにいた回から(その日の残りの回)だけ', !ra.per.outside);
  const z = make(true); const rz = drive(z.T, 'kyuko', 30, { atRate: 0 });
  check('③ モンヒロバトルにいなかったら修行しない', Object.keys(rz.per).length === 0);
  const over = Object.entries(ra.per).filter(([k]) => k !== 'outside').some(([, d]) => Object.values(d).some(n => n > a.T.AMGT_NUM.perDay));
  check('③ 修行は1日2回まで', !over);
  const days = Object.entries(ra.per).filter(([k, d]) => k !== 'outside' && d[1]).length;
  check('③ 修行はほどよく起きる(1体あたり60日のうち3割〜9割の日)', days >= 18 && days <= 54, `${days}日`);
  const ms = Object.values(a.T.AMGT_STORE.state.mons.kyuko);
  check('③ 熟練は0〜100', ms.every(me => Object.values(me.m).every(v => v >= 0 && v <= 100)));
  check('③ 熟練の伸びはどれもプラス(下がらない)', ms.flatMap(me => me.log).every(x => Object.values(x.g).every(n => n > 0)));
  check('③ 修行の記録は21回まで', ms.every(me => me.log.length <= 21));
  check('③ 修行の名前', a.T.amgtActName({ a: 'shugyo', k: 'tough' }) === 'モンヒロバトルで受け止め(防御修行)');
}

// ③-2 その日にいたら残りの回も・同じ回は二度当てない
{
  const { T } = make(true);
  const r = rows[0]; const e = { st: { pow: 300 }, fat: 0, str: 0, lv: 25 };
  T.AMGT_STORE.state = { ...T.AMGT_STORE.state, at: { kyuko: [START] } };
  let ok = false; for (let i = 0; i < 20 && !ok; i++) { const c = make(true, `seed-${i}`); c.T.AMGT_STORE.state = { ...c.T.AMGT_STORE.state, at: { kyuko: [START] } }; ok = !!c.T.amgtChoose('kyuko', { ...e }, r, null, START + 2); }
  check('③ 朝にいたら、同じ日の夜にも修行できる', ok);
  T.AMGT_STORE.state = { ...T.AMGT_STORE.state, at: { kyuko: [START + 2] } };
  check('③ 夜にいただけなら、同じ日の朝には修行しない', T.amgtChoose('kyuko', { ...e }, r, null, START) === null);
  check('③ 前の日にいただけなら、次の日は修行しない', T.amgtChoose('kyuko', { ...e }, r, null, START + 3) === null);
  const e2 = { st: { pow: 300, life: 100 }, fat: 0, str: 0, lv: 25 };
  T.amgtDo('kyuko', e2, r, null, START, { a: 'shugyo', k: 'pow' }, () => {}, () => 0);
  const before = JSON.stringify(T.AMGT_STORE.state.mons.kyuko); const fat = e2.fat;
  T.amgtDo('kyuko', e2, r, null, START, { a: 'shugyo', k: 'pow' }, () => {}, () => 0);
  check('③ 同じ回の修行は二度当てない', JSON.stringify(T.AMGT_STORE.state.mons.kyuko) === before && e2.fat === fat);
}

// ④ 技の習得・ブリーダー能力
{
  const { T } = make(true);
  const r = drive(T, 'mua', 120);
  const S = T.ASSISTANT_MASMON_TECHS.species;
  const g = T.AMGT_STORE.state.mons.mua['1:Golem'];
  check('④ 修行で新しい技を覚える', g.learn.length > 3, `ゴーレム ${g.learn.length}個`);
  const okNeed = Object.entries(T.AMGT_STORE.state.mons.mua).every(([k, me]) => me.learn.every(id => { const t = S[k.split(':')[1]].find(x => x.id === id); return t && (!t.learn.need || Object.keys(t.learn.need).every(n => me.learn.includes(n))); }));
  check('④ 先に磨く技を覚えずに次の技は覚えない', okNeed);
  const golemLog = g.log.filter(x => x.l);
  check('④ 覚えた回は、その技の系統の修行', golemLog.every(x => S.Golem.find(t => t.id === x.l).learn.by === x.k), golemLog.map(x => `${x.k}:${x.l}`).join(' '));
  const br = T.AMGT_STORE.state.br.mua; const init = T.AMGT_BR_INIT.mua;
  check('④ ブリーダー能力は初めの値から下がらない', T.AMGT_BR_KEYS.every((k, i) => br.ab[k] >= init[i]), JSON.stringify(br.ab));
  check('④ ブリーダー能力は天井(60+育成経験×0.4)を越えない', T.AMGT_BR_KEYS.every(k => br.ab[k] <= T.amgtBrCap(br, k)));
  check('④ 120日で育成経験が伸びる', br.ab.exp > init[5], `${init[5]}→${br.ab.exp}`);
  const L = T.amgtLeadMult('mua'), F = T.amgtFailMult('mua'), St = T.amgtStressMult('mua');
  check('④ 効き目の幅(伸び 1〜1.20・失敗 0.4〜1・ストレス 0.4〜1)', L >= 1 && L <= 1.2 && F >= 0.4 && F <= 1 && St >= 0.4 && St <= 1, `${L.toFixed(3)}/${F.toFixed(3)}/${St.toFixed(3)}`);
  const r1 = T.amgtRestAt('mua', 65), r2 = T.amgtRestAt('mua', 45);
  check('④ 観察力で休ませる目安が55へ寄る', r1 <= 65 && r1 >= 55 && r2 >= 45 && r2 <= 55, `${r1}/${r2}`);
  void r;
}

// ⑤ 相談
{
  const { T } = make(true);
  const E = (r) => ({ fat: 0, lv: r.lv, st: { life: 100, pow: 300, wise: 300, hit: 300, eva: 100, tough: 100 } });
  const day = START / 3;
  const q1 = T.amgtAskOf('kiki', rows, day, E); const q2 = T.amgtAskOf('kiki', rows, day, E);
  check('⑤ 同じ日は同じ相談', JSON.stringify(q1) === JSON.stringify(q2) && q1.opts.length >= 2, `${q1.q} ${q1.opts} ${q1.tech}`);
  const qr = T.amgtAskOf('kiki', rows, day, (r) => ({ fat: 70, lv: r.lv, st: {} }));
  check('⑤ 疲れていたら「休ませる?」の相談', qr.q === 'rest' && qr.opts.join() === 'rest,more');
  const qn = Object.assign({}, q1, { q: 'next', opts: ['wise', 'eva', 'hit'] });
  check('⑤ 答えられる', T.amgtAnswer('kiki', qn, 'eva', START) === true);
  check('⑤ その日の2回目は答えられない', T.amgtAnswer('kiki', qn, 'wise', START + 1) === false);
  check('⑤ 選択肢にない答えは受けない', T.amgtAnswer('kiki', qn, 'pow', START + 3) === false);
  const row = rows.find(r => r.slot === qn.slot);
  T.AMGT_STORE.state = { ...T.AMGT_STORE.state, at: { kiki: [START + 1] } };
  const act = T.amgtChoose('kiki', { fat: 0, str: 0, lv: row.lv, st: {} }, row, null, START + 1);
  check('⑤ 答えた系統を、モンヒロバトルにいた次の回に修行する(相談の倍率つき)', act && act.k === 'eva' && act.asked === true, JSON.stringify(act));
  check('⑤ 答えると信頼構築に経験', T.AMGT_STORE.state.br.kiki.xp.trust > 0);
}

// ⑥ 保存の正規化
{
  const { T } = make(true);
  const n0 = T.normalizeAssistantMasmonTrain(null);
  check('⑥ 何も無いときは空の形', JSON.stringify(n0) === JSON.stringify({ v: 1, mons: {}, br: {}, ask: {}, ev: {}, at: {} }));
  const bad = T.normalizeAssistantMasmonTrain({ mons: { kiki: { '1:Golem': { m: { golem_01: 500, guard: -3, dist: 'x', 'bad id': 4 }, learn: ['golem_01', 'golem_01', 7, 'x y'], log: [{ s: 1, k: 'zzz' }, { s: 2, k: 'pow', g: { golem_01: 4, life: 9 } }] }, 'bad key': { m: {} } }, 'BAD': {} }, br: { kiki: { ab: { know: 300 } } }, ask: { kiki: { d: 'x' } }, at: { kiki: [3, 3, -1, 'x', 2] } });
  const me = bad.mons.kiki['1:Golem'];
  check('⑥ 壊れた値は範囲に収める・知らない項目は捨てる', me.m.golem_01 === 100 && me.m.guard === 0 && me.m.dist === 0 && !('bad id' in me.m) && me.learn.join() === 'golem_01' && me.log.length === 1 && !('life' in me.log[0].g) && !bad.mons.BAD && !bad.mons.kiki['bad key'] && bad.br.kiki.ab.know === 100 && !bad.ask.kiki && bad.at.kiki.join() === '2,3');
  const a = make(true); drive(a.T, 'erubin', 20);
  const round = a.T.normalizeAssistantMasmonTrain(JSON.parse(JSON.stringify(a.T.AMGT_STORE.state)));
  check('⑥ 正規化しても中身が変わらない(行って戻る)', JSON.stringify(round) === JSON.stringify(a.T.AMGT_STORE.state));
}

// ⑦ 生活の居場所 → 修行できる回
{
  const { T } = make(true);
  const now = Date.UTC(2026, 10, 11, 1, 0); // 10:00 JST = 生活の「昼」(10〜14時)・育成の「朝」(4〜12時)と「昼」(12時〜)
  const day = Math.floor((now + 9 * 3600000) / 86400000); const abs = day * 6 + 2;
  T.amgtNoteLife({ abs, groups: [{ ids: ['kiki', 'mua'], place: 'battle', doing: 'training' }], solo: { dra: { place: 'cafe' } } });
  const at = T.AMGT_STORE.state.at;
  const want = [T.amgtSlotOf(now), T.amgtSlotOf(now + 3 * 3600000)];
  check('⑦ モンヒロバトルにいた助手の回を覚える(生活の1区切りが育成の2回にまたがる)', JSON.stringify(at.kiki) === JSON.stringify(want) && JSON.stringify(at.mua) === JSON.stringify(want) && !at.dra, JSON.stringify(at));
}

// ⑦-2 部屋の行の一言
{
  const off = make(false);
  check('⑦ 印が偽なら部屋の一言は出さない', off.T.amgtRoomLine('kiki') === null);
  const { T, ctx } = make(true);
  const now = Date.UTC(2026, 10, 11, 1, 0);
  ctx.assistantLifeSlotAt = (t) => ({ abs: Math.floor((t + 9 * 3600000) / 86400000) * 6 + 2 });
  ctx.ASSISTANT_LIFE_STORE = { state: { life: { abs: ctx.assistantLifeSlotAt(now).abs, groups: [], solo: { kiki: { place: 'battle' } } } } };
  check('⑦ いまモンヒロバトルにいる助手は「修行中」', T.amgtRoomLine('kiki', now) === 'いまモンヒロバトルで修行中');
  check('⑦ いない助手でマスモンもいなければ何も出さない', T.amgtRoomLine('mua', now) === null);
}

// ⑧ 第③段階(タタカイ)へ渡す形
{
  const { T } = make(true);
  drive(T, 'dra', 30);
  const u = T.amgtBattleOf('dra', rows[0], 25);
  const S = T.ASSISTANT_MASMON_TECHS.species.Golem.map(t => t.id);
  check('⑧ 1体: techs(覚えた技の id)と mastery(0〜100の整数)', Array.isArray(u.techs) && u.techs.every(id => S.includes(id)) && Object.values(u.mastery).every(v => Number.isInteger(v) && v >= 0 && v <= 100) && ['guard', 'dist', 'swap'].every(k => k in u.mastery));
  const none = T.amgtBattleOf('dra', { slot: 5, monster: 'Ark' }, 10);
  check('⑧ 入れ物が無いマスモンは初めからの技だけ', none.techs.join() === 'ark_01,ark_02' && none.mastery.ark_01 === 3);
  const tac = T.amgtTacticsOf('dra', rows);
  check('⑧ 戦術経験は 0〜100 の整数', Number.isInteger(tac) && tac >= 0 && tac <= 100, String(tac));
}

// --sim: 伸びの目安
const SIM_RATE = Number((process.argv.find(a => a.startsWith('--rate=')) || '--rate=0.07').split('=')[1]); // 本物の生活でモンヒロバトルにいる回は1割弱(ミハリ 11-11 の実測 平均7%)
if (process.argv.includes('--sim')) {
  for (const days of [30, 90, 180]) {
    const out = [];
    for (const aid of Object.keys(make(true).T.AMGT_BR_INIT)) {
      const { T } = make(true); const r = drive(T, aid, days, { answer: true, atRate: SIM_RATE }); r.shu = Object.entries(r.per).filter(([k]) => k !== 'outside').reduce((x, [, d]) => x + (d[1] || 0), 0);
      const g = (T.AMGT_STORE.state.mons[aid] || {})['1:Golem'] || T.amgtInitMon('Golem', 25, null); const b = (T.AMGT_STORE.state.br[aid] || { ab: Object.fromEntries(T.AMGT_BR_KEYS.map((k, i) => [k, T.AMGT_BR_INIT[aid][i]])) }).ab;
      out.push(`${aid.padEnd(10)} 修行 ${String(r.shu || 0).padStart(3)}回 技 ${g.learn.length}/8 熟練 ${g.learn.map(id => String(g.m[id]).padStart(3)).join(' ')} | 判断 ${['guard', 'dist', 'swap'].map(k => String(g.m[k]).padStart(3)).join(' ')} | 腕 ${T.AMGT_BR_KEYS.map(k => String(b[k]).padStart(3)).join(' ')}`);
    }
    console.log(`\n[${days}日・ゴーレム・モンヒロバトルにいる回 ${Math.round(SIM_RATE * 100)}%・相談に毎日答えた] 腕=know lead obs tac trust exp\n${out.join('\n')}`);
  }
}

console.log(ng ? `\n${ng} 件 NG` : '\nすべてOK');
process.exit(ng ? 1 : 0);
