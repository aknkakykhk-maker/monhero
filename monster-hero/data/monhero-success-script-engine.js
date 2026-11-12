// モンヒロサクセスの「台本エンジン」(キズナ 2026-11-12)。場面ごとに、正しい台詞を選んで差しこみを埋めて返す。
// 台本の正本は docs/progress/player-raise/script/*.js。ゲームが読む台詞は tools/success/build-script.js が作る生成物:
//   data/monhero-success-script-common.js        … 地の文・選択肢の札・イッサ博士・モンスターの声・ライバルの持ち主の行・見出しの表
//   data/monhero-success-script-<助手>.js         … その助手の行(シナリオの話の地の文・札もこちら)。選んだ助手の分だけ読む
// ★React・window・localStorage・Date・Math.random を使わない。乱数は「育成の id + ターン + 場面」から作る決まった乱数だけ。
//
// 使い方(画面から):
//   await MONHERO_SUCCESS_SCRIPT.load('mua');      // 共通 + みゅあ の分を読む(2回目からはすぐ返る)
//   const ctx = { id: s.id, turn: s.turn, aid: 'mua', bond: 5, callName: 'あいな', mon: 'ぷらんと', species: 'Plant', cup: 'ジュニアしめくくり杯' };
//   SCRIPT.say('turn.start.great', ctx)            // 1本 { id, who, e, t, head, label } か null
//   SCRIPT.event('ev.daily.nut', ctx)              // { head, label, lines:[…], choices:[{c,t}…], after:[…] }
//   SCRIPT.event('ev.daily.nut.a', ctx)            // 選んだあとの行(choices は空)
//   SCRIPT.mon('joy', ctx)                         // モンスターの声({cry} に種ごとの鳴き声)
// 場面 id の決め方は下の SCENE(芯の状態や結果から場面 id を作る)。
(function (root) {
  'use strict';

  const VERSION = 1;
  const ASSTS = Object.freeze(['mua', 'atsu', 'kiki', 'momosuke', 'dra', 'kyuko', 'sorashido', 'erubin']);
  const SLOTS = Object.freeze(['name', 'mon', 'cheer', 'cheer2', 'stat', 'train', 'tech', 'cup', 'food', 'rival', 'owner', 'cry']);
  // 差しこみが渡されなかったときの言葉(「{」「}」を画面に出さない・モンスターを「子」と呼ばない)
  const FALLBACK = Object.freeze({ name: 'きみ', mon: 'モンスター', cheer: '編成の仲間', cheer2: '編成の仲間', stat: '能力', train: '訓練',
    tech: '技', cup: '大会', food: '苦手なもの', rival: 'ライバル', owner: 'ライバルの育て手', cry: '…' });
  const ctxKey = Object.freeze({ name: 'callName' });

  // ---- 決まった乱数(芯 monhero-success.js と同じ作り) ----
  const hashStr = (s) => { let h = 0x811c9dc5; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };

  // ---- 読みこんだ台詞 ----
  // データのファイルは root.MONSUC_SCRIPT_PARTS[<common|助手>] = { rows:[…], heads:[…] } を置く
  const parts = () => (root && root.MONSUC_SCRIPT_PARTS) || {};
  let index = null; let indexKeys = '';
  const sceneOf = (id) => String(id).replace(/\.[^.]+$/, '');
  const keyOf = (r) => (r.bond !== undefined && /[bcd]$/.test(r.id) ? r.id.slice(0, -1) : r.id); // 段ごとの版は元の行と同じ key
  const buildIndex = () => {
    const p = parts(); const keys = Object.keys(p).sort().join(',');
    if (index && indexKeys === keys) return index;
    const scenes = new Map(); let order = 0; let heads = [];
    for (const k of ['common', ...ASSTS]) {
      const part = p[k]; if (!part || !Array.isArray(part.rows)) continue;
      if (Array.isArray(part.heads) && part.heads.length) heads = part.heads;
      for (const r of part.rows) {
        if (!r || typeof r.id !== 'string' || typeof r.t !== 'string') continue;
        const sc = sceneOf(r.id); if (!scenes.has(sc)) scenes.set(sc, []);
        scenes.get(sc).push({ ...r, n: order++ });
      }
    }
    for (const list of scenes.values()) list.sort((a, b) => a.n - b.n);
    index = { scenes, heads }; indexKeys = keys;
    return index;
  };
  const has = (aid) => !!parts()[aid];
  const ready = (aid) => !!parts().common && (!aid || has(aid));

  // ---- 読みこみ(ブラウザ: script を足す / Node: require) ----
  const fileOf = (k) => `monhero-success-script-${k}.js`;
  let base = 'data/';
  const loading = {};
  const loadPart = (k) => {
    if (parts()[k]) return Promise.resolve(true);
    if (loading[k]) return loading[k];
    if (typeof document === 'undefined') {
      try { if (typeof require === 'function') { require(`./${fileOf(k)}`); return Promise.resolve(!!parts()[k]); } } catch (e) { /* 読めなければ無し */ }
      return Promise.resolve(false);
    }
    loading[k] = new Promise((res) => {
      const s = document.createElement('script'); s.src = base + fileOf(k);
      s.onload = () => res(!!parts()[k]); s.onerror = () => { loading[k] = null; res(false); };
      document.head.appendChild(s);
    });
    return loading[k];
  };
  // 共通 + 指定した助手(配列でも可)。ライバルの持ち主の行は共通に入っている
  const load = (aids, opt = {}) => {
    if (typeof opt.base === 'string') base = opt.base;
    const list = (Array.isArray(aids) ? aids : [aids]).filter(a => ASSTS.includes(a));
    return Promise.all([loadPart('common'), ...list.map(loadPart)]).then(r => r.every(Boolean));
  };

  // ---- 見出し(育成イベント・編成の子のイベント・メインのお話・なし) ----
  const headOf = (id) => {
    const hit = buildIndex().heads.find(h => String(id).startsWith(h.prefix));
    return hit ? { head: hit.head, label: hit.label } : { head: null, label: '' };
  };

  // ---- 差しこみ ----
  const cryOf = (species) => {
    if (!species) return null;
    const list = buildIndex().scenes.get('mon.cry') || [];
    const r = list.find(x => x.id === `mon.cry.${String(species).toLowerCase()}`);
    return r ? r.t : null;
  };
  const slotValue = (k, ctx) => {
    if (k === 'cry') return (ctx && ctx.cry) || cryOf(ctx && ctx.species) || FALLBACK.cry;
    const v = ctx ? ctx[ctxKey[k] || k] : null;
    return (typeof v === 'string' && v.trim()) || (typeof v === 'number' && Number.isFinite(v)) ? String(v) : FALLBACK[k];
  };
  const fill = (t, ctx) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (SLOTS.includes(k) ? slotValue(k, ctx) : ''));

  // ---- 仲良し度の段 ----
  const bondOk = (r, lv) => {
    if (r.bond === undefined) return true;
    if (Array.isArray(r.bond)) return lv >= r.bond[0] && lv <= r.bond[1];
    return lv >= Number(r.bond);
  };
  // 同じ key(元の行と段ごとの版)から、いまの段に合う1本。段の版が合えばそれ、無ければ元の行
  const resolve = (rows, lv) => {
    const groups = new Map();
    for (const r of rows) { const k = keyOf(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const out = [];
    for (const g of groups.values()) {
      const hit = g.find(r => r.bond !== undefined && bondOk(r, lv)) || g.find(r => r.bond === undefined);
      if (hit) out.push(hit);
    }
    return out.sort((a, b) => a.n - b.n);
  };
  const lvOf = (ctx, who) => {
    const b = ctx && ctx.bond;
    const v = b && typeof b === 'object' ? b[who] : b; // { mua: 3, sorashido: 12 } でも数でもよい
    return Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 4;
  };
  const out1 = (r, ctx, scene) => ({ id: r.id, who: r.who, e: r.e || null, face: r.face || null, c: r.c || null, end: r.end || null,
    t: fill(r.t, ctx), scene, ...headOf(r.id) });

  // ---- 1本を選ぶ(同じ場面に2本以上あれば、くじで1本・続けて同じ台詞にしない) ----
  // opt.who … 話す人(既定は ctx.aid。'issa' / 'mon' / ライバルの持ち主の助手なども)
  // opt.salt … 同じターンに同じ場面を2回引くときに分ける
  // opt.recent … 最近出した id の配列(あれば避ける)
  const candidates = (scene, ctx, who) => {
    const list = buildIndex().scenes.get(scene) || [];
    return resolve(list.filter(r => r.who === who), lvOf(ctx, who));
  };
  const say = (scene, ctx = {}, opt = {}) => {
    const who = opt.who || ctx.aid;
    const rows = candidates(scene, ctx, who);
    if (!rows.length) return null;
    // 育成ごとに並びを決め、ターンで1つずつずらす(続くターンで同じ台詞にならない)
    const n = rows.length;
    let i = (hashStr([ctx.id || 'run', scene, who, opt.salt || ''].join('|')) + Math.max(0, Math.floor(Number(ctx.turn) || 0))) % n;
    const recent = Array.isArray(opt.recent) ? opt.recent : [];
    for (let k = 0; k < n && recent.includes(rows[i].id); k++) i = (i + 1) % n;
    return out1(rows[i], ctx, scene);
  };
  // 最近出した id を覚える(画面の手もと用。古いものから捨てる)
  const remember = (recent, line, max = 12) => {
    const list = Array.isArray(recent) ? recent.slice() : [];
    if (line && line.id) { list.push(line.id); while (list.length > max) list.shift(); }
    return list;
  };

  // ---- 出来事(地の文 → 助手 → 選択肢 → 選んだあと) ----
  // event(scene) … その場面の行を順に。話すのは地の文・イッサ博士・モンスター・ctx.aid(opt.who で足せる)
  //   lines   … 選択肢より前 / choices … `<scene>.choice` の札 / after … 選んだあとの話のあとに続く行(同じ場面で札より後ろ)
  //   選んだあとは event(`<scene>.<c>`) を続けて出す(4話の結末は `<scene>.good` / `.bitter`)
  const event = (scene, ctx = {}, opt = {}) => {
    const idx = buildIndex();
    const speakers = new Set(['narr', 'issa', 'mon', ctx.aid, ...(Array.isArray(opt.who) ? opt.who : opt.who ? [opt.who] : [])]);
    const list = (idx.scenes.get(scene) || []).filter(r => speakers.has(r.who));
    const rows = [];
    for (const who of speakers) rows.push(...resolve(list.filter(r => r.who === who), lvOf(ctx, who)));
    rows.sort((a, b) => a.n - b.n);
    const choiceRows = (idx.scenes.get(`${scene}.choice`) || []).filter(r => r.who === 'choice');
    const cut = choiceRows.length ? choiceRows[0].n : Infinity;
    const choices = resolve(choiceRows, lvOf(ctx, 'choice')).map(r => ({ c: r.c || r.id.split('.').pop(), t: fill(r.t, ctx), id: r.id }));
    const h = headOf(scene);
    return { scene, head: h.head, label: h.label, lines: rows.filter(r => r.n < cut).map(r => out1(r, ctx, scene)),
      choices, after: rows.filter(r => r.n > cut).map(r => out1(r, ctx, scene)) };
  };
  // モンスターの声(気分8つ: joy hype calm tired sulky sad surprise clingy)
  const mon = (mood, ctx = {}, opt = {}) => say(`mon.mood.${mood}`, ctx, { ...opt, who: 'mon' });
  // 場面に台詞があるか(その助手・その段で)
  const exists = (scene, ctx = {}, opt = {}) => !!say(scene, ctx, opt) || event(scene, ctx, opt).lines.length > 0;
  const scenes = () => [...buildIndex().scenes.keys()];

  // ---- 芯の状態・結果 → 場面 id ----
  const SCENE = Object.freeze({
    // ターンのはじめの様子(数字は言わない)。s は芯の育成の状態
    start: (s) => {
      if (!s) return 'turn.start.normal';
      const r = s.hpMax > 0 ? s.hp / s.hpMax : 0;
      if (r < 0.25) return 'turn.start.worn';
      if (s.stress >= 60) return 'turn.start.stress';
      if (r < 0.45) return 'turn.start.tired';
      if (r >= 0.85 && s.stress < 20) return 'turn.start.great';
      if (r >= 0.65) return 'turn.start.good';
      return 'turn.start.normal';
    },
    // 訓練の結果(芯の res: great / ok / fail / sab)。友情タッグが起きたら tag
    result: (res, tag) => (tag ? 'turn.result.tag' : `turn.result.${({ great: 'great', ok: 'ok', fail: 'fail', sab: 'slack' })[res] || 'ok'}`),
    // 褒める/叱る(合っていたか)
    react: (kind, fit) => `turn.${kind === 'scold' ? 'scold' : 'praise'}.${fit ? 'fit' : 'miss'}`,
    // 助手のお話(芯 storyDue の 1〜4・'special')。4話は end('good' / 'bitter')のあとに event(`<scene>.<end>`)
    story: (aid, ep) => (ep === 'special' ? `scn.${aid}.sp` : `scn.${aid}.ep${ep}`),
    // シナリオの大会(1つ目・2つ目)の前・勝ち・負け
    storyCup: (aid, n, when) => `scn.${aid}.cup${n === 2 ? 2 : 1}.${when}`,
    // 編成の子との連続の話(芯 out.event.story 1〜3)。type は attacker/tank/supporter/healer/shadow、ベースモンは base
    cheer: (member, type, ep) => `cheer.${member && member.kind === 'base' ? 'base' : (['attacker', 'tank', 'supporter', 'healer', 'shadow'].includes(type) ? type : 'attacker')}.ep${ep}`,
    // 小さなごほうびのくじ(芯 out.event.lottery)
    lottery: (key) => `cheer.lot.${({ self: 'drill', rest: 'rest', talk: 'chat', tip: 'tip', pal: 'friend' })[key] || 'friend'}`,
    // 休む(芯の休み方 poor / normal / great)
    rest: (key) => `turn.rest.${({ poor: 'little', normal: 'normal', great: 'deep' })[key] || 'normal'}`,
    // 引退(r1〜r4 はランクの帯。画面が決める)
    retire: (band) => `turn.retire.r${Math.min(4, Math.max(1, Math.floor(Number(band) || 1)))}`,
    // けが・病気・家出(芯の cond.kind: injury / ill / runaway)の始まり in・終わり out
    cond: (kind, phase) => `turn.cond.${kind === 'ill' ? 'sick' : kind === 'runaway' ? 'runaway' : 'injury'}.${phase === 'out' ? 'out' : 'in'}`,
    // ライバル(kind: asst / friend / self)
    rival: (step, kind) => `ev.rival.${step}.${['asst', 'friend', 'self'].includes(kind) ? kind : 'asst'}`,
    rivalOwner: (owner, step) => `ev.rival.owner.${owner}.${step}`,
    // イッサ博士(meet: first / won / lost / again・pick/ok/ng: stat cap heal loy pop)
    issa: (step, c) => (c ? `issa.${step}.${c}` : `issa.${step}`),
  });

  const api = Object.freeze({ VERSION, ASSTS, SLOTS, FALLBACK, load, ready, has, say, event, mon, remember, fill, headOf, exists, scenes, sceneOf, SCENE,
    _reset: () => { index = null; indexKeys = ''; } });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_SCRIPT_ENGINE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
