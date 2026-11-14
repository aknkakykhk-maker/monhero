// モンヒロサクセスの台本エンジン(monster-hero/data/monhero-success-script-engine.js)と、
// その生成物(monster-hero/data/monhero-success-script-<common|助手>.js・tools/success/build-script.js が作る)を見張る。
//   node tools/success/success-script-engine-check.js
// 見るもの
//   ① 生成物が台本(docs/progress/player-raise/script/*.js)と同じ(build-script.js を打ち忘れていない)
//   ② 8人の助手それぞれで、助手が話す場面すべてに、仲良し度のどの段でも台詞が出る(シナリオの話・ライバルの持ち主も)
//   ③ 画面が使う場面(SCENE の作り方の全部)に台詞がある
//   ④ 差しこみ漏れなし: 全部の行を、差しこみを全部渡したとき・何も渡さなかったときの両方で埋め、「{」「}」が残らない
//   ⑤ 決まった乱数: 同じ育成・同じターンなら同じ1本・続くターンで同じ台詞にならない・recent を避ける
//   ⑥ 種ごとの鳴き声: 味方モンスター全種に mon.cry がある(無ければ「…」で出る。数だけ知らせる)
'use strict';
const fs = require('fs');
const path = require('path');
const { build } = require('./build-script.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const top = (list, n = 5) => (list.length ? `${list.length}件: ${list.slice(0, n).join(' / ')}` : '');

// ① 生成物のそろい
const { out, total } = build();
const stale = Object.entries(out).filter(([p, text]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text).map(([p]) => path.basename(p));
check('生成物が台本と同じ(node tools/success/build-script.js)', stale.length === 0, stale.length ? stale.join(', ') : `${total}本`);

const E = require('../../monster-hero/data/monhero-success-script-engine.js');
E.load(E.ASSTS).then((ok) => {
  check('共通と8人ぶんを読めた', ok && E.ASSTS.every(a => E.has(a)) && E.ready());
  const scenes = E.scenes();
  const LVS = [1, 2, 3, 4, 8, 9, 15, 16, 20];
  const ctxFull = { id: 'chk', turn: 7, callName: 'あいな', mon: 'ぷらんと', species: 'Plant', cheer: 'ゴーレム', cheer2: 'メロディ', stat: 'ちから', train: 'ちからトレーニング',
    tech: 'たいあたり', cup: 'ジュニアしめくくり杯', food: 'にがうり', rival: 'ガルム', owner: 'あつ' };

  // ② 助手が話す場面(あつの場面を物差しに、助手の名前が入る場面は人ごとに置きかえる)
  const ATSU_ONLY = /^issa\.(tease\.|after\.fire)/; // あつだけのかけ合い・受けて立った
  const ref = scenes.filter(sc => !ATSU_ONLY.test(sc) && E.say(sc, { ...ctxFull, aid: 'atsu' }));
  const miss = [];
  for (const aid of E.ASSTS) {
    const mine = ref.map(sc => sc.replace(/^scn\.atsu\./, `scn.${aid}.`).replace(/^ev\.rival\.owner\.atsu\./, `ev.rival.owner.${aid}.`));
    for (const sc of mine) for (const lv of LVS) {
      const ctx = { ...ctxFull, aid, bond: lv };
      const hit = E.say(sc, ctx) || (sc.startsWith('scn.') && E.event(sc, ctx).lines.some(l => l.who === aid));
      if (!hit) { miss.push(`${aid} Lv${lv} ${sc}`); break; }
    }
    // シナリオの話は、地の文だけの場面も含めて行がある(4話の土台・選択肢)
    for (const k of ['ep1', 'ep2', 'ep3', 'ep4', 'sp']) if (!E.event(`scn.${aid}.${k}`, { ...ctxFull, aid }).lines.length) miss.push(`${aid} scn.${aid}.${k}(行なし)`);
    for (const k of ['ep1', 'ep2', 'ep3']) if (E.event(`scn.${aid}.${k}`, { ...ctxFull, aid }).choices.length < 2) miss.push(`${aid} scn.${aid}.${k}(札が2つない)`);
  }
  check('8人とも、助手が話す場面すべてに、どの段でも台詞がある', miss.length === 0, top(miss) || `${ref.length}場面 × 8人 × ${LVS.length}段`);

  // ③ 画面が使う場面(SCENE の作り方)
  const S = E.SCENE; const want = [];
  ['great', 'good', 'normal', 'tired', 'worn', 'stress'].forEach(k => want.push([`turn.start.${k}`]));
  [S.start(null), S.start({ hp: 10, hpMax: 100, stress: 0 }), S.start({ hp: 100, hpMax: 100, stress: 0 })].forEach(sc => want.push([sc]));
  ['great', 'ok', 'fail', 'sab'].forEach(r => want.push([S.result(r)])); want.push([S.result('ok', true)]);
  ['praise', 'scold'].forEach(k => [true, false].forEach(f => want.push([S.react(k, f)])));
  ['poor', 'normal', 'great'].forEach(k => want.push([S.rest(k)]));
  [1, 2, 3, 4].forEach(b => want.push([S.retire(b)]));
  ['injury', 'ill', 'runaway'].forEach(k => ['in', 'out'].forEach(p => want.push([S.cond(k, p)])));
  ['self', 'rest', 'talk', 'tip', 'pal'].forEach(k => want.push([S.lottery(k), 'event']));
  ['attacker', 'tank', 'supporter', 'healer', 'shadow'].forEach(t => [1, 2, 3].forEach(ep => want.push([S.cheer({ kind: 'raised' }, t, ep), 'event'])));
  [1, 2, 3].forEach(ep => want.push([S.cheer({ kind: 'base' }, null, ep), 'event']));
  ['notice', 'meet', 'win', 'lose'].forEach(st => ['asst', 'friend', 'self'].forEach(k => want.push([S.rival(st, k), 'event'])));
  E.ASSTS.forEach(o => ['meet', 'win', 'lose'].forEach(st => want.push([S.rivalOwner(o, st), 'owner', o])));
  ['first', 'won', 'lost', 'again'].forEach(m => want.push([S.issa('meet', m), 'issa']));
  ['stat', 'cap', 'heal', 'loy', 'pop'].forEach(c => ['pick', 'ok', 'ng'].forEach(st => want.push([S.issa(st, c), 'issa'])));
  want.push([S.issa('offer'), 'issa']); want.push([S.issa('bye'), 'event']);
  E.ASSTS.forEach(a => { [1, 2, 3, 4, 'special'].forEach(ep => want.push([S.story(a, ep), 'event', a])); [1, 2].forEach(n => ['before', 'win', 'lose'].forEach(w => want.push([S.storyCup(a, n, w), 'event', a]))); });
  ['joy', 'hype', 'calm', 'tired', 'sulky', 'sad', 'surprise', 'clingy'].forEach(m => want.push([`mon.mood.${m}`, 'mon']));
  const noLine = [];
  for (const [sc, how, who] of want) {
    for (const aid of (who && how !== 'owner' ? [who] : E.ASSTS)) {
      const ctx = { ...ctxFull, aid };
      const ok = how === 'event' ? E.event(sc, ctx).lines.length > 0 : how === 'issa' ? !!E.say(sc, ctx, { who: 'issa' }) : how === 'mon' ? !!E.say(sc, ctx, { who: 'mon' })
        : how === 'owner' ? !!E.say(sc, ctx, { who }) : !!E.say(sc, ctx);
      if (!ok) { noLine.push(`${aid} ${sc}`); break; }
    }
  }
  check('画面が使う場面(SCENE)すべてに台詞がある', noLine.length === 0, top(noLine) || `${want.length}場面`);

  // ④ 差しこみ漏れ(全部の行)
  const leak = [];
  for (const sc of scenes) for (const aid of E.ASSTS) {
    for (const ctx of [{ ...ctxFull, aid, bond: 5 }, { aid }]) {
      const ev = E.event(sc, ctx, { who: [...E.ASSTS, 'choice'] });
      for (const l of [...ev.lines, ...ev.after, ...ev.choices]) if (/[{}]/.test(l.t)) leak.push(`${l.id}「${l.t.slice(0, 30)}」`);
    }
  }
  const SLOT_SRC = fs.readFileSync(path.join(__dirname, '../../monster-hero/data/monhero-success-script-common.js'), 'utf8');
  const unknown = [...new Set([...SLOT_SRC.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].filter(k => !E.SLOTS.includes(k));
  check('差しこみ漏れなし(全部渡したとき・何も渡さないとき)', leak.length === 0 && unknown.length === 0, top([...new Set(leak)]) || (unknown.length ? `知らない差しこみ ${unknown.join(',')}` : ''));
  const filled = E.fill('{name}{mon}{cheer}{cheer2}{stat}{train}{tech}{cup}{food}{rival}{owner}{cry}', ctxFull);
  check('差しこみ12種が渡した値で埋まる', !/[{}]/.test(filled) && filled.includes('あいな') && filled.includes('ぷらんと') && filled.includes('ガルム') && filled.includes('ジュニアしめくくり杯') && !filled.endsWith('…'), filled);
  const empty = E.fill('{mon}{cheer}{rival}', {});
  check('差しこみが無いときにモンスターを「子」と呼ばない', !/子/.test(empty), empty);

  // ⑤ 決まった乱数・続けて同じ台詞にしない
  const base = { ...ctxFull, aid: 'mua', bond: 5 };
  const a1 = E.say('turn.start.great', base).id; const a2 = E.say('turn.start.great', base).id;
  let same = 0; for (let t = 1; t < 46; t++) if (E.say('turn.result.ok', { ...base, turn: t }).id === E.say('turn.result.ok', { ...base, turn: t + 1 }).id) same++;
  const r1 = E.say('turn.result.ok', base); const r2 = E.say('turn.result.ok', base, { recent: E.remember([], r1) });
  check('同じ育成・同じターンは同じ1本/続くターンで同じ台詞にならない/最近の行を避ける', a1 === a2 && same === 0 && r1.id !== r2.id, `続いた ${same}回`);

  // ⑥ 種ごとの鳴き声
  let noCry = [];
  try {
    const all = require('../masmon-battle/load.js').load().data.ALL_PLAYER_MONSTERS || {};
    const mons = Array.isArray(all) ? all : Object.values(all);
    noCry = mons.map(m => m.id).filter(Boolean).filter(id => E.fill('{cry}', { species: id }) === E.FALLBACK.cry);
    console.log(`  (鳴き声: 味方モンスター ${mons.length}種のうち、mon.cry が無い ${noCry.length}種${noCry.length ? `: ${noCry.slice(0, 6).join(',')}` : ''}。無い種は「…」で出る)`);
  } catch (e) { console.log(`  (鳴き声の見比べは飛ばした: ${e.message})`); }

  if (failed) { console.log(`NG: ${failed}件`); process.exit(1); }
  console.log('OK: 台本エンジン');
});
