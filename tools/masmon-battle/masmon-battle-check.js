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
//   ⑧ 技表(ASSISTANT_MASMON_TECHS。無ければ仮の draft-techs.js)の形: 数字は MF2 の幅の中・技 id は種の中で一意・
//      どの種もどの距離にも届く技がある・距離撃の名前を使わない・既存の技の表を計算で使わない
//   ⑬ 能力の差の効き方のつまみ(A=いまのまま/B=ゆるめ/C=強め): A は結果を変えない・記録に残る・B<A<C の順
//   ⑭ 作戦(attack/guard/range/big)と交代の早さ(early/late)は名前で受けて表の倍率・重みは範囲で切る・記録に残る
//   ⑪ 育成・修行の入れ物(st・Lv 1〜99・覚えた技・熟練)から1体を作れる/熟練で命中・ガッツ消費・ガードが「中」の分だけ変わる
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
  {
    let tr = 0;
    const rng2 = engine.makeRng('chk-trace');
    for (let i = 0; i < 100; i++) {
      const inp = mkInput(`tr-${i}`, 3, 3, rng2);
      const a = engine.simulate(inp), b = engine.simulate(Object.assign({}, inp, { trace: true }));
      if (a.digest === b.digest && b.log.some(e => e.cands)) tr++;
    }
    check('① trace:true でも指紋は同じ(見返しとサーバの照合が1回で済む)', tr === 100, `${tr}/100`);
  }
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
          f.guts -= e.gd || 0;
          if (e.foeGuts != null && f.guts !== e.foeGuts) { ng.guts.push(`${tag} r${e.r} ガッツダウン ${f.guts}≠${e.foeGuts}`); bad = 1; }
          if (f.hp !== e.foeHp) { ng.hp.push(`${tag} r${e.r} ${f.hp}≠${e.foeHp}`); bad = 1; }
        } else if (e.ev === 'move') {
          if (Math.abs(e.to - dist) !== 1 || e.to < 0 || e.to > 3) { ng.dist.push(`${tag} r${e.r} ${dist}→${e.to}`); bad = 1; }
          dist = e.to;
          const u = st.teams[e.side].units[active[e.side]]; u.guts = Math.min(100, u.guts + engine.GUTS_MOVE);
        } else if (e.ev === 'guard') {
          const u = st.teams[e.side].units[active[e.side]]; u.guts = Math.min(100, u.guts + engine.GUTS_MOVE);
        } else if (e.ev === 'charge') {
          const u = st.teams[e.side].units[active[e.side]]; u.guts = Math.min(100, u.guts + 22);
        } else if (e.ev === 'swap' || (e.ev === 'enter' && e.r > 0)) {
          active[e.side] = e.i;
          const u = st.teams[e.side].units[e.i]; u.guts = Math.max(u.guts, 40);
          if (u.hp <= 0) { ng.hp.push(`${tag} 倒れた体が出てきた`); bad = 1; }
        }
        if (e.ev === 'tech' && e.ti !== active[e.side === 'A' ? 'B' : 'A']) { ng.hp.push(`${tag} r${e.r} 受けた側 ${e.ti}`); bad = 1; }
        if (e.ga != null && (st.teams.A.units[active.A].guts !== e.ga || st.teams.B.units[active.B].guts !== e.gb)) {
          ng.guts.push(`${tag} r${e.r} ${e.ev} 両方のガッツ ${st.teams.A.units[active.A].guts}/${st.teams.B.units[active.B].guts}≠${e.ga}/${e.gb}`); bad = 1;
        }
        if (['tech', 'move', 'guard', 'charge', 'swap'].includes(e.ev) && !engine.WHY[e.why]) { ng.hp.push(`${tag} r${e.r} 理由が無い ${e.why}`); bad = 1; }
        if (e.ev === 'tech' && !(e.p >= 15 && e.p <= 97)) { ng.hp.push(`${tag} r${e.r} 命中率 ${e.p}`); bad = 1; }
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
  check('④ ガッツは 0〜100・技の分だけ減り、決まった分だけ増える・手のあとの両方のガッツ(ga/gb)が合う', !ng.guts.length, ng.guts.slice(0, 3).join(' / '));
  check('④ ライフの減り方・受けた側・命中率・手の理由が記録と合う・倒れた体は出てこない', !ng.hp.length, ng.hp.slice(0, 3).join(' / '));
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

// ── ⑧ 技表の形 ──
{
  const bad = [];
  const table = data.ASSISTANT_MASMON_TECHS.species;
  const L = engine.TECH_LIMITS;
  const oneKind = [];
  // 名前は既存の技の名前(HERO_ATK_NAMES・固有技)から選んでよい(シュギョウ)。距離撃の系統の名前だけは使わない(社長「距離撃はなし」)
  const banned = new Set(['距離撃', '強・距離撃', '極・距離撃', '真・距離撃', '超・距離撃', '銀河距離撃', '次元距離撃', '覇王距離撃', '神罰距離撃']);
  for (const id of Object.keys(data.ALL_PLAYER_MONSTERS)) {
    const list = table[id];
    if (!Array.isArray(list) || !list.length) { bad.push(`${id} 技が無い`); continue; }
    const ids = new Set();
    const reach = new Set();
    const kinds = new Set();
    for (const t of list) {
      if (typeof t.id !== 'string' || !t.id || ids.has(t.id)) bad.push(`${id} id ${t.id}`);
      ids.add(t.id);
      for (const k of ['power', 'hit', 'guts', 'crit', 'gd']) {
        if (!Number.isFinite(t[k]) || t[k] < L[k][0] || t[k] > L[k][1]) bad.push(`${id} ${t.name} ${k}=${t[k]}`);
      }
      if (!['pow', 'wise'].includes(t.kind)) bad.push(`${id} ${t.name} kind=${t.kind}`);
      if (!Array.isArray(t.dist) || !t.dist.length || t.dist.some(d => ![0, 1, 2, 3].includes(d))) bad.push(`${id} ${t.name} dist`);
      else t.dist.forEach(d => reach.add(d));
      if (banned.has(t.name)) bad.push(`${id} ${t.name} は距離撃の名前`);
      kinds.add(t.kind);
    }
    if (reach.size < 4) bad.push(`${id} 届かない距離がある(${[...reach].join(',')})`);
    if (kinds.size < 2) oneKind.push(id);   // 片方だけの種(ゴーレムなど)はあってよい。数だけ知らせる
  }
  check(`⑧ 技表の形(${data.ASSISTANT_MASMON_TECHS.draft ? '仮の技表' : '本番の技表'}): MF2 の幅の中・id 一意・どの距離にも届く`, !bad.length, bad.slice(0, 4).join(' / ') || (oneKind.length ? `ちから技かかしこさ技だけの種: ${oneKind.join('・')}` : ''));
  check('⑧ 実装済みのモンスターがすべて対戦に出られる', Object.keys(catalog.species).length === Object.keys(data.ALL_PLAYER_MONSTERS).length,
    `${Object.keys(catalog.species).length}/${Object.keys(data.ALL_PLAYER_MONSTERS).length}`);
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistant-masmon-battle.js'), 'utf8');
  const old = ['BASE_ATK_EVOLUTION', 'RANGE_EVOLUTION', 'GUARD_EVOLUTION', 'HERO_ATK_NAMES'].filter(w => src.split('\n').some(l => !/^\s*\/\//.test(l) && l.includes(w)));
  check('⑧ 既存のモンヒロバトルの技(通常攻撃・距離撃・固有技・ガード)の表を使わない', !old.length, old.join('・'));
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

// ⑪ 育成・修行の入れ物から作れる/熟練の効き
{
  const golem = catalog.species.Golem.techs;
  const t0 = golem[0], t1 = golem[1];
  const u = engine.unitFromGrow({ monster: 'Golem', nick: 'ごろ', lv: 7, slot: 1 },
    { st: { life: 500, pow: 610, wise: 40, hit: 200, eva: 90, tough: 700 }, lv: 99 },
    { m: { [t0.id]: 100, guard: 100 }, learn: [t0.id] });
  const n = I.normalizeUnit(u, catalog);
  const n2 = I.normalizeUnit(engine.unitFromGrow({ monster: 'Golem', nick: 'ごろ', lv: 7 }, null), catalog);
  check('⑪ 育成・修行の入れ物(st・Lv 1〜99・覚えた技・熟練)から1体を作れる・入れ物が無ければ既定値',
    n.species === 'Golem' && n.name === 'ごろ' && n.lv === 99 && n.stats.pow === 610 && n.stats.tough === 700
      && n.techs.length === 1 && n.techs[0] === t0.id && n.mastery[t0.id] === 100 && n.mastery[t1.id] === 0
      && n2.lv === 7 && n2.techs === null && n2.mastery[t0.id] === 0, JSON.stringify(n));
  const starts = catalog.species.Golem.techs.filter(t => t.start).map(t => t.id);
  const def = I.buildMoves(catalog, 'Golem', null, {}).map(m => m.key);
  check('⑪ 覚えた技の記録が無ければ、はじめの技(learn.start)だけ(無い種は全部)',
    starts.length ? JSON.stringify(def) === JSON.stringify(starts) : def.length === golem.length, def.join('・'));
  const n3 = I.normalizeUnit(engine.unitFromGrow({ monster: 'Golem', nick: 'ごろ' }, null, { techs: [t0.id], mastery: { [t0.id]: 40 } }), catalog);
  check('⑪ 修行の受け渡し amgtBattleOf の { techs, mastery } もそのまま受ける', n3.techs.length === 1 && n3.techs[0] === t0.id && n3.mastery[t0.id] === 40);
  const mv = I.buildMoves(catalog, 'Golem', n.techs, n.mastery);
  const raw = I.buildMoves(catalog, 'Golem', golem.map(t => t.id), {});
  const m0 = mv.find(m => m.key === t0.id), r0 = raw.find(m => m.key === t0.id);
  const nope = I.buildMoves(catalog, 'Golem', ['nope'], {}).map(m => m.key);
  const startIds = golem.filter(t => t.start).map(t => t.id);
  check('⑪ 覚えている技だけ出す・当てはまる技が0なら、はじめの技(無ければ最初の技)',
    mv.length === 1 && raw.length === golem.length && JSON.stringify(nope) === JSON.stringify(startIds.length ? startIds : [golem[0].id]), nope.join('・'));
  check('⑪ 熟練100で 命中+6%・ガッツ消費−15%(四捨五入)',
    Math.abs(m0.hit - r0.hit - engine.MASTERY_HIT_MAX) < 1e-9 && m0.guts === Math.round(t0.guts * (1 - engine.MASTERY_GUTS_CUT)),
    `命中 ${r0.hit}→${m0.hit} / ガッツ ${r0.guts}→${m0.guts}`);
  check('⑪ 熟練の数字は社長の「中」(6%・15%・8%)', engine.MASTERY_HIT_MAX === 0.06 && engine.MASTERY_GUTS_CUT === 0.15 && engine.MASTERY_GUARD_ADD === 0.08);
}

// ⑫ 種ごとのガッツのたまる速さは幅(GUTS_REGEN_MIN〜MAX)の整数(既存の baseGuts から。2026-11-13 社長「種の差も広げる」)・与ダメの補正は回復の速さと逆向き・等級 G〜S の表も読める
{
  const bad = Object.entries(catalog.species).filter(([, v]) => !Number.isInteger(v.regen) || v.regen < engine.GUTS_REGEN_MIN || v.regen > engine.GUTS_REGEN_MAX || !(Math.abs((v.dmgMul || 0) - (1 - (v.regen - (engine.GUTS_REGEN_MIN + engine.GUTS_REGEN_MAX) / 2) / ((engine.GUTS_REGEN_MAX - engine.GUTS_REGEN_MIN) / 2) * engine.REGEN_DMG_SWING)) < 0.002)).map(([k, v]) => `${k}:${v.regen}`);
  const vals = new Set(Object.values(catalog.species).map(v => v.regen));
  const gc = engine.buildCatalog({ ...data, ASSISTANT_MASMON_GUTS_REGEN: { [Object.keys(catalog.species)[0]]: 'S', [Object.keys(catalog.species)[1]]: 'g', [Object.keys(catalog.species)[2]]: 'X' } });
  const gs = Object.keys(catalog.species).slice(0, 3).map((k) => gc.species[k].regen);
  const gradeOk = gs[0] === engine.GUTS_REGEN_MAX && gs[1] === engine.GUTS_REGEN_MIN && gs[2] === catalog.species[Object.keys(catalog.species)[2]].regen;
  check('⑫ 種ごとのガッツのたまる速さは幅の中(既存の baseGuts から)・種でちがう・速い種ほど与ダメが下がる・等級 G〜S の表が読める(知らない等級は無視)', !bad.length && vals.size >= 5 && gradeOk && engine.GUTS_REGEN_MIN < engine.GUTS_REGEN_MAX && engine.GUTS_MOVE < engine.GUTS_CHARGE, bad.join(' ') || [...vals].sort().join('・'));
}

// ⑬ 能力の差の効き方のつまみ(A/B/C。社長が観戦してから決める)
{
  const rng = engine.makeRng('chk-bal');
  let sameA = 0, okLog = 0, w = { A: 0, B: 0, C: 0 };
  const M = 600;
  for (let i = 0; i < M; i++) {
    const strong = { assistantId: 'atsu', tactics: 50, members: team(rng, 3, { total: 1980 }) };
    const weak = { assistantId: 'atsu', tactics: 50, members: team(rng, 3, { total: 1800 }) };
    const sf = i % 2 === 0;
    const base = { seed: `bal-${i}`, catalog, teamA: sf ? strong : weak, teamB: sf ? weak : strong };
    const r0 = engine.simulate(base);
    const rA = engine.simulate(Object.assign({}, base, { balance: 'A' }));
    const rX = engine.simulate(Object.assign({}, base, { balance: 'へんな値' }));
    if (r0.digest === rA.digest && rX.digest === rA.digest) sameA++;
    for (const b of ['A', 'B', 'C']) {
      const r = b === 'A' ? rA : engine.simulate(Object.assign({}, base, { balance: b }));
      if (r.balance === b && r.log[0].balance === b && r.log[0].v === engine.VERSION_PLAIN && r.version === engine.VERSION_PLAIN) okLog++; // 忠誠度・人気が効かない編成の版(版5から VERSION と同じ。masmon-bond-battle-check)
      if (r.winner === (sf ? 'A' : 'B')) w[b]++;
    }
  }
  check('⑬ つまみ A は渡さないときと同じ結果・知らない値は A', sameA === M, `${sameA}/${M}`);
  check('⑬ つまみと計算の版が結果と記録に残る', okLog === M * 3, `${okLog}/${M * 3}`);
  check('⑬ 能力の合計が多い側の勝率が B < A < C の順(B はゆるめ・C は強め)', w.B < w.A && w.A < w.C,
    ['A', 'B', 'C'].map(b => `${b} ${(w[b] / M * 100).toFixed(1)}%`).join(' / '));
}

// ⑭ 作戦と交代の早さ(名前で受けて計算側で倍率)・重みの範囲
{
  const rng = engine.makeRng('chk-plan');
  const st0 = I.styleOf('atsu');
  const sa = I.styleOf('atsu', null, 'attack', 'early');
  const sx = I.styleOf('atsu', null, 'へんな作戦', 'へんな早さ');
  const big = I.styleOf('dra', { aggr: 99, swap: -5, read: 1000 });
  check('⑭ 作戦・交代の早さは表の倍率で掛かる・知らない名前はおまかせ',
    Math.abs(sa.aggr - st0.aggr * 1.25) < 1e-9 && Math.abs(sa.swap - st0.swap * 1.5) < 1e-9 && JSON.stringify(sx) === JSON.stringify(st0));
  check('⑭ 重みは範囲で切る(上書きの改ざんを通さない)', big.aggr === 1.8 && big.swap === 0.3 && big.read === 30, JSON.stringify(big));
  let same = 0, rec = 0, sw = { early: 0, none: 0, late: 0 };
  for (let i = 0; i < 300; i++) {
    const inp = mkInput(`pl-${i}`, 3, 3, rng);
    const r0 = engine.simulate(inp);
    const r1 = engine.simulate(JSON.parse(JSON.stringify(Object.assign({}, inp, { teamA: Object.assign({}, inp.teamA, { plan: 'zzz' }) }))));
    if (r0.digest === r1.digest) same++;
    for (const [pace, key] of [['early', 'early'], [undefined, 'none'], ['late', 'late']]) {
      const r = engine.simulate(Object.assign({}, inp, { teamA: Object.assign({}, inp.teamA, { plan: 'range', swapPace: pace }) }));
      if (r.log[0].plan.A === 'range' && r.log[0].swapPace.A === (pace || null)) rec++;
      sw[key] += r.log.filter(e => e.ev === 'swap' && e.side === 'A').length;
    }
  }
  check('⑭ 知らない作戦は渡さないときと同じ結果', same === 300, `${same}/300`);
  check('⑭ 作戦と交代の早さが記録の最初の行に残る', rec === 900, `${rec}/900`);
  check('⑭ 交代の回数が 早め > ふつう > ねばる', sw.early > sw.none && sw.none > sw.late, `早め ${sw.early}・ふつう ${sw.none}・ねばる ${sw.late}`);
}

console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
