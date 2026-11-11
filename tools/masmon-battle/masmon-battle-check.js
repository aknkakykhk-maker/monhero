#!/usr/bin/env node
// 助手のマスモンの完全オートバトルの計算(monster-hero/data/assistant-masmon-battle.js)の検査(2026-11-11 タタカイ)。
//   node tools/masmon-battle/masmon-battle-check.js
// 見るもの:
//   ① 同じ種・同じ編成なら同じ結果(指紋 digest も同じ)/技データを JSON にして持っていっても同じ(サーバで回す前提)
//   ② 全滅で決着(負けた側は全員ライフ 0・勝った側に立っている者がいる)
//   ③ 無限に続かない(ラウンドの上限を超えない・上限に届いたら判定で必ず終わる)
//   ④ 距離とガッツの整合(記録を最初からたどり直す: 距離は零〜遠で1歩ずつ・技はその距離で届くものだけ・
//      ガッツは 0〜100 で、技の分だけ減り、毎ラウンド・移動・ガード・ためるで決まった分だけ増える)
//   ⑤ 弱い AI(戦術経験 0)でも最低限の手を選ぶ(倒しきれる相手には撃つ・満タンでためない・届かない技は撃たない)
//   ⑥ 1対1・2対2・3対3・1対2・2対3・3対1 すべて動く/4体目以降は切る/空の編成は断る
//   ⑦ 純粋な計算(Math.random・Date・window・localStorage・document・Math.exp/log/pow/sin/cos を使わない)
//   ⑧ 技は既存の技データだけ(通常攻撃の名前=HERO_ATK_NAMES・距離撃=RANGE_EVOLUTION・固有技=unique.names)
//   ⑨ 壊れた入力(能力が文字・範囲外・種類が無い)は既定値で補う
//   ⑩ 好き嫌い・疲労・ストレスは入力に取らない(渡しても結果が変わらない)
'use strict';
const fs = require('fs');
const path = require('path');
const { load, makeUnit, ROOT } = require('./load.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const { engine, catalog, data } = load();
const I = engine._internal;
const STYLE_IDS = Object.keys(engine.STYLES);
const team = (rng, size, opts) => Array.from({ length: size }, () => makeUnit(engine, catalog, rng, opts));
const mkInput = (seed, na, nb, rng, extra = {}) => Object.assign({
  seed, catalog,
  teamA: { assistantId: STYLE_IDS[na % 8], tactics: (na * 31) % 101, members: team(rng, na) },
  teamB: { assistantId: STYLE_IDS[(nb + 3) % 8], tactics: (nb * 17) % 101, members: team(rng, nb) },
}, extra);

// ── ① 同じ種なら同じ結果 ──
{
  const rng = engine.makeRng('chk-det');
  let same = 0, differ = 0, jsonSame = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const inp = mkInput(`det-${i}`, 3, 3, rng);
    const r1 = engine.simulate(inp);
    const r2 = engine.simulate(JSON.parse(JSON.stringify(inp)));        // 編成も技データも JSON を通す
    if (r1.digest === r2.digest && JSON.stringify(r1.log) === JSON.stringify(r2.log)) jsonSame++;
    const r3 = engine.simulate(inp);
    if (r3.digest === r1.digest) same++;
    if (engine.simulate(Object.assign({}, inp, { seed: `det-${i}-other` })).digest !== r1.digest) differ++;
  }
  check('① 同じ種・同じ編成なら同じ結果', same === N, `${same}/${N}`);
  check('① 編成と技データを JSON にして持っていっても同じ結果(サーバで回す前提)', jsonSame === N, `${jsonSame}/${N}`);
  check('① 種が違えば結果もたいてい変わる', differ >= N * 0.9, `${differ}/${N}`);
}

// ── ②③④ 数千戦をたどり直す ──
const FORMATS = [[1, 1], [2, 2], [3, 3], [1, 2], [2, 3], [3, 1]];
{
  const rng = engine.makeRng('chk-replay');
  const ng = { wipe: [], limit: [], dist: [], guts: [], range: [], hp: [] };
  const fmtSeen = {};
  let total = 0;
  for (const [na, nb] of FORMATS) {
    for (let i = 0; i < 400; i++) {
      const inp = mkInput(`rp-${na}${nb}-${i}`, na, nb, rng);
      const r = engine.simulate(inp);
      total++;
      fmtSeen[`${na}対${nb}`] = (fmtSeen[`${na}対${nb}`] || 0) + 1;
      const tag = `${na}対${nb}#${i}`;
      if (r.rounds > engine.ROUND_LIMIT) ng.limit.push(tag);
      if (r.reason === 'wipe') {
        const loser = r.winner === 'A' ? 'B' : 'A';
        if (!r.final[loser].every(x => x.hp === 0) || !r.final[r.winner].some(x => x.hp > 0)) ng.wipe.push(tag);
      } else if (r.reason !== 'judge') ng.wipe.push(`${tag}(reason=${r.reason})`);
      // たどり直す
      const st = I.setupState(inp, catalog);
      let dist = r.log[0].d, round = 0;
      const active = { A: 0, B: 0 };
      let bad = null;
      for (const e of r.log) {
        if (bad) break;
        if (e.r !== round) {                      // 新しいラウンド: 場の2体に自然回復
          round = e.r;
          for (const s of ['A', 'B']) { const u = st.teams[s].units[active[s]]; u.guts = Math.min(100, u.guts + u.regen); }
        }
        if (e.ev === 'tech') {
          const u = st.teams[e.side].units[active[e.side]];
          const mv = u.moves.find(m => m.key === e.move);
          if (!mv || !mv.dist.includes(dist)) { ng.range.push(`${tag} r${e.r} ${e.name}@${dist}`); bad = 1; break; }
          if (u.guts < mv.guts) { ng.guts.push(`${tag} r${e.r} ガッツ不足 ${u.guts}<${mv.guts}`); bad = 1; break; }
          u.guts -= mv.guts;
          const foe = e.side === 'A' ? 'B' : 'A';
          const f = st.teams[foe].units[active[foe]];
          f.hp = Math.max(0, f.hp - e.dmg);
          if (f.hp !== e.foeHp) { ng.hp.push(`${tag} r${e.r} ${f.hp}≠${e.foeHp}`); bad = 1; }
        } else if (e.ev === 'move') {
          if (Math.abs(e.to - dist) !== 1 || e.to < 0 || e.to > 3) { ng.dist.push(`${tag} r${e.r} ${dist}→${e.to}`); bad = 1; }
          dist = e.to;
          const u = st.teams[e.side].units[active[e.side]]; u.guts = Math.min(100, u.guts + 4);
        } else if (e.ev === 'guard') {
          const u = st.teams[e.side].units[active[e.side]]; u.guts = Math.min(100, u.guts + 4);
        } else if (e.ev === 'charge') {
          const u = st.teams[e.side].units[active[e.side]]; u.guts = Math.min(100, u.guts + 22);
        } else if (e.ev === 'swap' || (e.ev === 'enter' && e.r > 0)) {
          active[e.side] = e.i;
          const u = st.teams[e.side].units[e.i]; u.guts = Math.max(u.guts, 40);
          if (u.hp <= 0) { ng.hp.push(`${tag} 倒れた体が出てきた`); bad = 1; }
        }
        if (e.d !== dist && e.ev !== 'move') { ng.dist.push(`${tag} r${e.r} 記録の距離 ${e.d}≠${dist}`); bad = 1; }
        if (e.guts != null) {
          const u = st.teams[e.side].units[active[e.side]];
          if (u.guts !== e.guts || e.guts < 0 || e.guts > 100) { ng.guts.push(`${tag} r${e.r} ${e.ev} ${u.guts}≠${e.guts}`); bad = 1; }
        }
      }
    }
  }
  check('② 全滅で決着(負けた側は全員ライフ 0)・決着は全滅か判定だけ', !ng.wipe.length, ng.wipe.slice(0, 3).join(' / '));
  check(`③ ラウンドの上限(${engine.ROUND_LIMIT})を超えない`, !ng.limit.length, ng.limit.slice(0, 3).join(' / '));
  check('④ 距離は零〜遠で1歩ずつ・記録の距離と合う', !ng.dist.length, ng.dist.slice(0, 3).join(' / '));
  check('④ 技はその距離で届くものだけ', !ng.range.length, ng.range.slice(0, 3).join(' / '));
  check('④ ガッツは 0〜100・技の分だけ減り、決まった分だけ増える', !ng.guts.length, ng.guts.slice(0, 3).join(' / '));
  check('④ ライフの減り方が記録と合う・倒れた体は出てこない', !ng.hp.length, ng.hp.slice(0, 3).join(' / '));
  check('⑥ 1対1・2対2・3対3・1対2・2対3・3対1 がすべて動く', Object.keys(fmtSeen).length === FORMATS.length, `${total} 戦`);
}

// ③ 上限に届いたら判定で必ず終わる
{
  const rng = engine.makeRng('chk-limit');
  let ok = 0;
  for (let i = 0; i < 50; i++) {
    const r = engine.simulate(mkInput(`lim-${i}`, 3, 3, rng, { roundLimit: 3 }));
    if (r.rounds <= 3 && ['A', 'B', 'draw'].includes(r.winner) && ['wipe', 'judge'].includes(r.reason)) ok++;
  }
  check('③ ラウンドの上限に届いたら判定で終わる(上限 3 で試す)', ok === 50, `${ok}/50`);
}

// ── ⑤ 弱い AI でも最低限の手 ──
{
  const ids = Object.keys(catalog.species);
  let killShots = 0, killTries = 0, fullCharge = 0, invalid = 0;
  const rng = engine.makeRng('chk-rookie');
  for (let i = 0; i < 400; i++) {
    const inp = {
      seed: `rk-${i}`, catalog,
      teamA: { assistantId: STYLE_IDS[i % 8], tactics: 0, members: [makeUnit(engine, catalog, rng, { species: ids[i % ids.length] })] },
      teamB: { assistantId: 'atsu', tactics: 0, members: [makeUnit(engine, catalog, rng)] },
    };
    const st = I.setupState(inp, catalog);
    st.dist = i % 4;
    const u = st.teams.A.units[0], f = st.teams.B.units[0];
    // (a) 相手が瀕死(ライフ 1)・ガッツ満タン → 届く技で撃つ
    u.guts = 100; f.hp = 1;
    const c = I.chooseAction({ state: st, rng: engine.makeRng(`rk-c-${i}`) }, 'A');
    killTries++;
    if (c.type === 'tech') killShots++;
    if (c.type === 'charge') fullCharge++;
    if (c.type === 'tech' && !u.moves.find(m => m.key === c.key).dist.includes(st.dist)) invalid++;
  }
  check('⑤ 戦術経験 0 でも、倒しきれる相手には撃つ', killShots >= killTries * 0.97, `${killShots}/${killTries}`);
  check('⑤ ガッツ満タンで「ためる」を選ばない', fullCharge === 0, `${fullCharge} 回`);
  check('⑤ 届かない距離の技は撃たない', invalid === 0, `${invalid} 回`);
  // (b) 経験 0 どうしでも、手の半分以上は技を撃っている(動いてばかり・守ってばかりにならない)
  let tech = 0, acts = 0;
  for (let i = 0; i < 300; i++) {
    const r = engine.simulate({ seed: `rk2-${i}`, catalog,
      teamA: { assistantId: STYLE_IDS[i % 8], tactics: 0, members: team(rng, 3) },
      teamB: { assistantId: STYLE_IDS[(i + 5) % 8], tactics: 0, members: team(rng, 3) } });
    for (const e of r.log) if (['tech', 'move', 'guard', 'charge', 'swap'].includes(e.ev)) { acts++; if (e.ev === 'tech') tech++; }
  }
  check('⑤ 戦術経験 0 どうしでも、手の4割以上は技を撃つ', tech >= acts * 0.4, `${(tech / acts * 100).toFixed(1)}%`);
}

// ── ⑥ 体数の切り詰めと空の編成 ──
{
  const rng = engine.makeRng('chk-size');
  const r = engine.simulate({ seed: 'size', catalog, teamA: { members: team(rng, 5) }, teamB: { members: team(rng, 1) } });
  check('⑥ 4体目以降は切る(最大3体)', r.final.A.length === 3 && r.final.B.length === 1, `${r.final.A.length}・${r.final.B.length}`);
  let threw = false;
  try { engine.simulate({ seed: 'x', catalog, teamA: { members: [] }, teamB: { members: team(rng, 1) } }); } catch (e) { threw = true; }
  check('⑥ 空の編成は断る', threw);
}

// ── ⑦ 純粋な計算 ──
{
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistant-masmon-battle.js'), 'utf8')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const banned = ['Math.random', 'Date', 'window', 'localStorage', 'document', 'Math.exp', 'Math.log', 'Math.pow', 'Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'performance', 'React'];
  const hits = banned.filter(w => new RegExp(`\\b${w.replace('.', '\\.')}\\b`).test(src));
  check('⑦ 画面・時刻・ずれうる計算を使わない', !hits.length, hits.join('・'));
}

// ── ⑧ 技は既存の技データだけ ──
{
  const bad = [];
  const atkNames = new Set(Object.values(data.HERO_ATK_NAMES).flat());
  const rangeNames = new Set(data.RANGE_EVOLUTION.map(e => e.name));
  for (const id of Object.keys(catalog.species)) {
    const uniq = new Set(data.ALL_PLAYER_MONSTERS[id].unique.names || [data.ALL_PLAYER_MONSTERS[id].unique.name]);
    for (const lv of [1, 30, 60, 99]) {
      for (const mv of I.buildMoves(catalog, id, lv, { pow: 100, wise: 100 })) {
        const ok = mv.key === 'atk' ? (atkNames.has(mv.name) || mv.name === '通常攻撃') : mv.key === 'range' ? rangeNames.has(mv.name) : uniq.has(mv.name);
        if (!ok) bad.push(`${id} Lv${lv} ${mv.name}`);
        if (!mv.dist.length) bad.push(`${id} ${mv.name} 届く距離なし`);
      }
    }
  }
  check('⑧ 技の名前はすべて既存の技データから・どの技にも届く距離がある', !bad.length, bad.slice(0, 4).join(' / '));
  check('⑧ 実装済みのモンスターがすべて対戦に出られる', Object.keys(catalog.species).length === Object.keys(data.ALL_PLAYER_MONSTERS).length,
    `${Object.keys(catalog.species).length}/${Object.keys(data.ALL_PLAYER_MONSTERS).length}`);
}

// ── ⑨ 壊れた入力 ──
{
  const u = I.normalizeUnit({ species: 'NoSuchMon', lv: 'x', stats: { life: 'abc', pow: -5, wise: 5000, hit: null, eva: 300.6 } }, catalog);
  const ok = catalog.species[u.species] && u.lv === 1 && u.stats.life === 100 && u.stats.pow === 0 && u.stats.wise === 999
    && u.stats.hit === 100 && u.stats.eva === 301 && u.stats.tough === 100;
  check('⑨ 壊れた入力は既定値で補う(種類・Lv・能力)', !!ok, JSON.stringify(u));
}

// ── ⑩ 好き嫌い・疲労・ストレスは効かない ──
{
  const rng = engine.makeRng('chk-like');
  let same = 0;
  for (let i = 0; i < 50; i++) {
    const inp = mkInput(`lk-${i}`, 3, 3, rng);
    const r1 = engine.simulate(inp);
    const inp2 = JSON.parse(JSON.stringify(inp));
    inp2.teamA.members.forEach(m => Object.assign(m, { like: 3, fatigue: 90, stress: 80, favorite: true }));
    inp2.teamA.likes = ['Mocchi'];
    if (engine.simulate(inp2).digest === r1.digest) same++;
  }
  check('⑩ 好き嫌い・疲労・ストレスを渡しても結果は同じ(強さに効かせない)', same === 50, `${same}/50`);
}

// ⑪ 育成の入れ物(キズナ4: st・Lv 1〜99)からそのまま作れる
{
  const u = engine.unitFromGrow({ monster: 'Golem', nick: 'ごろ', lv: 7, slot: 1 }, { st: { life: 500, pow: 610, wise: 40, hit: 200, eva: 90, tough: 700 }, lv: 99 });
  const n = I.normalizeUnit(u, catalog);
  const n2 = I.normalizeUnit(engine.unitFromGrow({ monster: 'Golem', nick: 'ごろ', lv: 7 }, null), catalog);
  check('⑪ 育成の入れ物(st・Lv 1〜99)から1体を作れる・入れ物が無ければ行の Lv',
    n.species === 'Golem' && n.name === 'ごろ' && n.lv === 99 && n.stats.pow === 610 && n.stats.tough === 700 && I.stageOf(99) === 8 && n2.lv === 7,
    JSON.stringify(n));
}

// ⑫ 種ごとのガッツのたまる速さは 8〜12 の整数(既存の baseGuts から)
{
  const bad = Object.entries(catalog.species).filter(([, v]) => !Number.isInteger(v.regen) || v.regen < 8 || v.regen > 12).map(([k, v]) => `${k}:${v.regen}`);
  const vals = new Set(Object.values(catalog.species).map(v => v.regen));
  check('⑫ 種ごとのガッツのたまる速さは 8〜12(既存の baseGuts から)・種でちがう', !bad.length && vals.size >= 3, bad.join(' ') || [...vals].sort().join('・'));
}

console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
