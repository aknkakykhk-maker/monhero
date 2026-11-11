#!/usr/bin/env node
// 助手のマスモンのフレンド対戦(非同期PvP)のサーバの関数の検査(2026-11-11 タイセン)。本番の表には触らない(偽物の表で動かす)。
//   A. 計算の写し(masmon-pvp/engine.js)が、いまの計算と技データと合っている
//   B. 写しで回した試合と、端末の計算(monster-hero/data/assistant-masmon-battle.js)で見返した試合の指紋(digest)が同じ
//   C. 登録の形の見張り(種・Lv・能力・名前・枠・体数・戦術経験)
//   D. 上限の見張り(初めての登録・日数 × 1日の成長上限・能力ごと・合計・Lv・戦術経験)
//   E. 公平の区分(合計がそろう・比が保たれる・999 を超えない・Lv がそろう)
//   F. 頼みの流れ(鍵・フレンドだけ・登録が要る・回数・端末の勝ち負けは受け取らない・種はサーバが作る)
//   G. SQL が足すだけ(消す・変える・既存の表に触る文が無い)・関数の引数がサーバの呼び方と合う
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'masmon-pvp');
const SQL = path.join(ROOT, 'supabase', 'migrations', '202611110001_masmon_pvp.sql');

let fails = 0;
const check = (name, ok, extra) => {
  if (ok) console.log('OK  ' + name);
  else { fails++; console.log('NG  ' + name + (extra ? ' … ' + extra : '')); }
};

(async () => {
  const fresh = require('./build-masmon-pvp-bundle').run({ check: true });
  check('A 計算の写し(masmon-pvp/engine.js)が、いまの計算と技データと合っている', fresh.ok, fresh.reason);
  const core = await import(pathToFileURL(path.join(FN, 'core.js')).href);
  const bundle = await import(pathToFileURL(path.join(FN, 'engine.js')).href);
  const engine = bundle.ASSISTANT_MASMON_BATTLE;
  const catalog = bundle.MASMON_PVP_CATALOG;
  const learn = bundle.MASMON_PVP_LEARN;
  const client = require('./load.js').load();
  const SPEC = Object.keys(catalog.species);
  const K = engine.STAT_KEYS;

  // ---- 偽物の表 ----
  const T0 = Date.parse('2026-11-20T03:00:00Z'); // JST 12:00
  const fakeDb = () => {
    const s = { owners: {}, entries: {}, anchors: {}, friends: new Set(), usage: {}, matches: [], refunds: 0 };
    const ek = (o, a) => o + '|' + a;
    return {
      s,
      ownerCheck: async (o, k) => {
        if (typeof k !== 'string' || k.length < 24) return 'bad';
        if (!s.owners[o]) s.owners[o] = k;
        return s.owners[o] === k ? 'ok' : 'locked';
      },
      getEntry: async (o, a) => s.entries[ek(o, a)] || null,
      getAnchors: async (o, a, keys) => Object.fromEntries(keys.filter((k) => s.anchors[ek(o, a) + '|' + k]).map((k) => [k, s.anchors[ek(o, a) + '|' + k]])),
      insertAnchors: async (rows) => { for (const r of rows) { const kk = ek(r.owner_id, r.assistant_id) + '|' + r.unit_key; if (!s.anchors[kk]) s.anchors[kk] = r; } },
      upsertEntry: async (row) => { s.entries[ek(row.owner_id, row.assistant_id)] = { ...row, active: true }; },
      deactivate: async (o, a) => { if (s.entries[ek(o, a)]) s.entries[ek(o, a)].active = false; },
      areFriends: async (a, b) => s.friends.has([a, b].sort().join('|')),
      take: async (o, limit) => { const n = s.usage[o] || 0; if (n >= limit) return { ok: false, remaining: 0 }; s.usage[o] = n + 1; return { ok: true, remaining: limit - n - 1 }; },
      refund: async (o) => { s.refunds++; s.usage[o] = Math.max(0, (s.usage[o] || 0) - 1); },
      record: async (args) => { s.matches.push(args); return { id: s.matches.length, rated: args.p_size === 3, a: { delta: 0, rating: 1500 }, b: { delta: 0, rating: 1500 } }; },
    };
  };
  const KEY_A = 'a'.repeat(32);
  const KEY_B = 'b'.repeat(32);
  const st = (v) => Object.fromEntries(K.map((k) => [k, v]));
  const member = (slot, species, o = {}) => ({ slot, species, name: o.name ?? 'もち', lv: o.lv || 10, stats: o.stats || st(300) });
  const team3 = (o = {}) => ({ tactics: o.tactics ?? 10, members: [member(0, SPEC[0], o), member(1, SPEC[1], o), member(2, SPEC[2], o)] });
  let seedN = 0;
  const call = (db, body, nowMs = T0) => core.handle({ body, db, engine, catalog, learn, nowMs, newSeed: () => 'mptestseed' + (++seedN), limits: {} });

  // ---- B ----
  {
    const ta = { assistantId: 'mua', tactics: 30, members: [member(0, SPEC[3]), member(1, SPEC[4]), member(2, SPEC[5])].map(({ slot, ...u }) => u) };
    const tb = { assistantId: 'erubin', tactics: 70, members: [member(0, SPEC[6], { stats: st(350) }), member(1, SPEC[7]), member(2, SPEC[8])].map(({ slot, ...u }) => u) };
    let same = 0;
    for (let i = 0; i < 50; i++) {
      const seed = 'mpcheck' + i;
      const s1 = engine.simulate({ seed, catalog, teamA: ta, teamB: tb });
      const s2 = client.engine.simulate({ seed, catalog: client.catalog, teamA: JSON.parse(JSON.stringify(ta)), teamB: JSON.parse(JSON.stringify(tb)) });
      if (s1.digest === s2.digest && s1.winner === s2.winner && s1.version === s2.version) same++;
    }
    check('B 写しで回した試合と端末の計算の指紋が同じ(50戦)', same === 50, `${same}/50`);
  }

  // ---- C ----
  {
    const bad = (t, why) => core.parseTeam(t, engine, catalog, learn).error === why;
    check('C 正しい3体は通る', !core.parseTeam(team3(), engine, catalog, learn).error);
    {
      const sp = SPEC[0];
      const ts = catalog.species[sp].techs;
      const start = ts.filter((t) => t.start).map((t) => t.id);
      const later = ts.find((t) => !t.start && learn[t.id] && learn[t.id].st && !learn[t.id].need);
      const needT = ts.find((t) => learn[t.id] && learn[t.id].need);
      const P = (o) => core.parseTeam({ tactics: 0, members: [{ ...member(0, sp), ...o }] }, engine, catalog, learn);
      const def = P({});
      check('C 技を送らなければ初めからの技になる', !def.error && def.team.members[0].techs.join() === start.join());
      check('C ほかの種の技・知らない技ははじく', P({ techs: [...start, catalog.species[SPEC[1]].techs[0].id] }).error === 'techs' && P({ techs: ['nope'] }).error === 'techs');
      check('C 同じ技を2回ははじく', P({ techs: [start[0], start[0]] }).error === 'techs');
      const lowSt = Object.fromEntries(K.map((k) => [k, 0]));
      check('C 能力の下限に届かない技ははじく(技の習得条件)', P({ techs: [...start, later.id], stats: lowSt }).error === 'learn');
      check('C 能力の下限に届いていれば通る', !P({ techs: [...start, later.id], stats: st(999) }).error);
      const needOk = Object.entries(learn[needT.id].need).every(([tid]) => true);
      const pre = Object.keys(learn[needT.id].need);
      check('C 前の技の熟練が足りない技ははじく', needOk && P({ techs: [...new Set([...start, ...pre, needT.id])], stats: st(999) }).error === 'learn');
      check('C 前の技の熟練が足りていれば通る', !P({ techs: [...new Set([...start, ...pre, needT.id])], stats: st(999),
        mastery: Object.fromEntries(pre.map((t) => [t, 100])) }).error);
      check('C 覚えていない技の熟練・101 ははじく', P({ mastery: { [later.id]: 10 } }).error === 'mastery' && P({ mastery: { guard: 101 } }).error === 'mastery');
    }
    check('C 実装されていない種ははじく', bad({ tactics: 0, members: [member(0, 'NotAMonster')] }, 'species'));
    check('C Lv が上限を超えたらはじく', bad({ tactics: 0, members: [member(0, SPEC[0], { lv: core.LV_CAP + 1 })] }, 'lv'));
    check('C 能力が 999 を超えたらはじく', bad({ tactics: 0, members: [member(0, SPEC[0], { stats: { ...st(100), pow: 1000 } })] }, 'stats'));
    check('C 能力が整数でなければはじく', bad({ tactics: 0, members: [member(0, SPEC[0], { stats: { ...st(100), pow: 10.5 } })] }, 'stats'));
    check('C 能力が足りなければはじく', bad({ tactics: 0, members: [member(0, SPEC[0], { stats: { life: 1 } })] }, 'stats'));
    check('C 4体ははじく', bad({ tactics: 0, members: [0, 1, 2, 3].map((i) => member(i, SPEC[i])) }, 'size'));
    check('C 同じ枠を2回ははじく', bad({ tactics: 0, members: [member(1, SPEC[0]), member(1, SPEC[1])] }, 'slot'));
    check('C 名前に URL・メール・長い数字ははじく', ['http://x', 'a@b', 'もち12345', ''].every((n) => bad({ tactics: 0, members: [member(0, SPEC[0], { name: n })] }, 'name')));
    check('C 名前は13字ではじく・12字は通る', bad({ tactics: 0, members: [member(0, SPEC[0], { name: 'あ'.repeat(13) })] }, 'name')
      && !core.parseTeam({ tactics: 0, members: [member(0, SPEC[0], { name: 'あ'.repeat(12) })] }, engine, catalog).error);
    check('C 作戦(style)は 0.5〜1.5 の数で通る・幅の外や読み(read)・知らない名前ははじく',
      !core.parseTeam({ ...team3(), style: { aggr: 1.3, swap: 0.5 } }, engine, catalog, learn).error
      && bad({ ...team3(), style: { aggr: 1.6 } }, 'style') && bad({ ...team3(), style: { read: 1 } }, 'style') && bad({ ...team3(), style: { nope: 1 } }, 'style'));
    check('C 戦術経験が 0〜100 の整数でなければはじく', bad({ tactics: 101, members: [member(0, SPEC[0])] }, 'tactics'));
  }

  // ---- D ----
  {
    const today = '2026-11-20';
    const days = Math.round((Date.parse(today) - Date.parse(core.GROW_EPOCH)) / 86400000) + 1;
    const grow = core.DAILY_GROWTH_CAP * days;
    const t1 = (stats, lv = 10) => ({ tactics: 0, members: [member(0, SPEC[0], { stats, lv })] });
    const P = (team, anchors = {}, entry = null, d = today) => core.capProblems({ team, anchors, entry, today: d, engine });
    check('D 初めて: 初めの上限+日数×20 ちょうどは通る', P(t1({ ...st(400), life: 600 + grow })).length === 0);
    check('D 初めて: 1つの能力が1超えるとはじく', P(t1({ ...st(400), life: 601 + grow })).some((p) => p.what === 'stat'));
    check('D 初めて: 合計の上限を超えるとはじく', P(t1({ life: 600, pow: 600, tough: 600, wise: 400, hit: 400, eva: 400 })).some((p) => p.what === 'total')
      === (3000 > core.INITIAL_TOTAL_CAP + grow));
    const anc = { [`0:${SPEC[0]}`]: { first_day: today, first_stats: st(300), first_total: 1800, first_lv: 10 } };
    const plus = (n) => ({ ...st(300), pow: 300 + n });
    check('D 同じ日: +20 は通る・+21 ははじく', P(t1(plus(20)), anc).length === 0 && P(t1(plus(21)), anc).length > 0);
    check('D 3日後: +80(=20×4) は通る・+81 ははじく', P(t1(plus(80)), anc, null, '2026-11-23').length === 0 && P(t1(plus(81)), anc, null, '2026-11-23').length > 0);
    check('D 合計も見る(6能力を少しずつ上げて合計で超える)', P(t1({ life: 304, pow: 304, wise: 304, hit: 304, eva: 304, tough: 301 }), anc).some((p) => p.what === 'total'));
    check('D Lv は同じ日に上がらない', P(t1(st(300), 11), anc).some((p) => p.what === 'lv'));
    check('D 戦術経験: 初めの登録の基準 + 1日5 まで(同じ日は +5)', P({ ...t1(st(300)), tactics: 10 }, anc, { tactics_first: 5, tactics_day: today }).length === 0
      && P({ ...t1(st(300)), tactics: 11 }, anc, { tactics_first: 5, tactics_day: today }).some((p) => p.what === 'tactics'));
    check('D 能力が下がるのは通す', P(t1(st(100)), anc).length === 0);
  }

  // ---- E ----
  {
    const u = { species: SPEC[0], name: 'x', lv: 3, stats: { life: 999, pow: 999, wise: 10, hit: 500, eva: 0, tough: 777 } };
    const f = core.fairUnit(u, K);
    const sum = K.reduce((t, k) => t + f.stats[k], 0);
    check('E 公平: 合計がそろう', sum === core.FAIR_TOTAL, String(sum));
    check('E 公平: 999 を超えない・0 より下がない', K.every((k) => f.stats[k] >= 0 && f.stats[k] <= 999));
    check('E 公平: 大小の順が保たれる', f.stats.life >= f.stats.hit && f.stats.hit >= f.stats.wise && f.stats.wise >= f.stats.eva);
    check('E 公平: Lv がそろう', f.lv === core.FAIR_LV);
    const z = core.fairUnit({ ...u, stats: st(0) }, K);
    check('E 公平: 能力が全部 0 でも合計がそろう', K.reduce((t, k) => t + z.stats[k], 0) === core.FAIR_TOTAL);
  }

  // ---- F ----
  {
    const db = fakeDb();
    const reg = (owner, key, assistant, team, now) => call(db, { action: 'register', owner, key, assistant, name: owner, team }, now);
    let r = await reg('alice', KEY_A, 'mua', team3());
    check('F 登録できる', r.status === 200 && r.json.ok, JSON.stringify(r.json));
    r = await reg('alice', KEY_B, 'mua', team3());
    check('F 鍵がちがうと登録できない', r.status === 403 && r.json.error === 'locked');
    r = await reg('alice', KEY_A, 'nobody', team3());
    check('F 知らない助手ははじく', r.status === 400 && r.json.error === 'assistant');
    r = await reg('alice', KEY_A, 'mua', team3({ stats: { ...st(300), pow: 340 } }));
    check('F 同じ日に +40 した登録ははじく(上限の見張り)', r.status === 422 && r.json.error === 'over_cap');
    r = await reg('alice', KEY_A, 'mua', team3({ stats: { ...st(300), pow: 340 } }), T0 + 86400000);
    check('F 次の日なら +40 まで通る', r.status === 200);
    await reg('bob', KEY_B, 'erubin', team3({ stats: st(280) }));
    const ch = (body, now) => call(db, { action: 'challenge', owner: 'alice', key: KEY_A, assistant: 'mua', opp_owner: 'bob', opp_assistant: 'erubin', division: 'raw', ...body }, now);
    r = await ch({});
    check('F フレンドでなければ挑めない', r.status === 403 && r.json.error === 'not_friend');
    db.s.friends.add(['alice', 'bob'].sort().join('|'));
    r = await ch({ owner: 'bob', key: KEY_B, assistant: 'erubin', opp_owner: 'bob' });
    check('F 自分には挑めない', r.status === 400 && r.json.error === 'self');
    r = await ch({ winner: 'A', seed: 'cheat', digest: 'ffffffff' });
    const m = r.json.match;
    check('F 挑める(結果はサーバが回す)', r.status === 200 && m && ['A', 'B', 'draw'].includes(m.winner));
    check('F 端末が送った種・勝ち負けは使わない', m && m.seed !== 'cheat' && /^mptestseed/.test(m.seed));
    const rec = db.s.matches[db.s.matches.length - 1];
    check('F 記録の勝ち負けはサーバの計算と同じ', rec && rec.p_winner === m.winner && rec.p_digest === m.digest && rec.p_seed === m.seed);
    check('F 記録に計算の版・技表の版・balance が残る', rec && rec.p_engine_version === engine.VERSION && rec.p_tech_version === catalog.techVersion && rec.p_balance === 'A' && m.balance === 'A');
    const replay = client.engine.simulate({ seed: m.seed, catalog: client.catalog, teamA: m.teamA, teamB: m.teamB, balance: m.balance });
    check('F 端末が返ってきた種と編成で見返すと同じ指紋', replay.digest === m.digest && replay.winner === m.winner);
    r = await ch({ division: 'fair' });
    const fm = r.json.match;
    check('F 公平の区分は能力をそろえて回す', fm && fm.teamA.members.every((u) => K.reduce((t, k) => t + u.stats[k], 0) === core.FAIR_TOTAL));
    r = await ch({ size: 1 });
    check('F 作戦を登録すると計算に渡る', (await reg('alice', KEY_A, 'mua', { ...team3(), style: { aggr: 0.6 } }, T0 + 86400000)).status === 200
      && (await ch({}, T0 + 86400000)).json.match.teamA.style.aggr === 0.6);
    check('F 1対1 も回せる(先頭の1体)', r.status === 200 && r.json.match.teamA.members.length === 1);
    r = await ch({ division: 'cheat' });
    check('F 知らない区分ははじく', r.status === 400 && r.json.error === 'division');
    r = await ch({ opp_assistant: 'kiki' });
    check('F 相手が登録していなければ挑めない', r.status === 404 && r.json.error === 'no_opponent');
    await call(db, { action: 'unregister', owner: 'bob', key: KEY_B, assistant: 'erubin' });
    r = await ch({});
    check('F 登録をやめた相手には挑めない', r.status === 404);
    await reg('bob', KEY_B, 'erubin', team3({ stats: st(280) }));
    db.s.usage.alice = core.CHALLENGE_DAILY_LIMIT;
    r = await ch({});
    check('F 1日の回数を超えたら挑めない', r.status === 429 && r.json.error === 'limit');
    db.s.usage.alice = 0;
    const throwing = { ...engine, simulate: () => { throw new Error('x'); } };
    const before = db.s.refunds;
    r = await core.handle({ body: { action: 'challenge', owner: 'alice', key: KEY_A, assistant: 'mua', opp_owner: 'bob', opp_assistant: 'erubin', division: 'raw' }, db, engine: throwing, catalog, nowMs: T0, newSeed: () => 'mptestseedx' });
    check('F 計算が失敗したら回数を戻す', r.status === 500 && db.s.refunds === before + 1);
    r = await call(db, { action: 'nope' });
    check('F 知らない頼みははじく', r.status === 400);
  }

  // ---- G ----
  {
    const sql = fs.readFileSync(SQL, 'utf8').replace(/--.*$/gm, '');
    check('G SQL に消す・空にする文が無い', !/\b(drop|truncate|delete\s+from)\b/i.test(sql));
    const touched = [...sql.matchAll(/\b(?:alter\s+table|create\s+table\s+if\s+not\s+exists|insert\s+into|update|create\s+index\s+if\s+not\s+exists\s+\w+\s+on)\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]);
    const foreign = touched.filter((t) => t !== 'set' && !/^masmon_pvp_/.test(t));
    check('G SQL が触る表は masmon_pvp_* だけ', foreign.length === 0, foreign.join(','));
    const fnArgs = (sql.match(/function public\.masmon_pvp_record\(([\s\S]*?)\)\s*returns/) || [])[1] || '';
    const sqlNames = [...fnArgs.matchAll(/\b(p_\w+)\s+\w+/g)].map((m) => m[1]).sort();
    const coreSrc = fs.readFileSync(path.join(FN, 'core.js'), 'utf8');
    const recCall = (coreSrc.match(/db\.record\(\{([\s\S]*?)\}\);/) || [])[1] || '';
    const jsNames = [...recCall.matchAll(/\b(p_\w+):/g)].map((m) => m[1]).sort();
    check('G masmon_pvp_record の引数がサーバの呼び方と合う', sqlNames.length === 22 && sqlNames.join() === jsNames.join(), `${sqlNames.length}/${jsNames.length}`);
    const idx = fs.readFileSync(path.join(FN, 'serve.js'), 'utf8');
    const entry = fs.readFileSync(path.join(FN, 'index.ts'), 'utf8');
    check('G index.ts は serve.js を読む数行だけ(配り直しの形・docs/rules/EDGE_REDEPLOY.md)', entry.split('"./serve.js"').length === 2 && entry.split('\n').filter((l) => l.trim() && !l.startsWith('//')).length <= 4);
    const rpcs = [...idx.matchAll(/rpc\("(\w+)"/g)].map((m) => m[1]);
    check('G サーバが呼ぶ関数が SQL にある', rpcs.length >= 4 && rpcs.every((n) => sql.includes(`function public.${n}(`)), rpcs.join(','));
    check('G 端末(anon)に書く権限を渡していない', !/grant\s+(insert|update|delete|all)[^;]*to\s+anon/i.test(sql)
      && !/grant\s+execute\s+on\s+function\s+public\.masmon_pvp_(owner_check|take|refund|record)[^;]*anon/i.test(sql));
  }

  // ---- H 端末の口(56-assistant-masmon-pvp.jsx) ----
  {
    const part = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', '56-assistant-masmon-pvp.jsx'), 'utf8');
    const coreSrc = fs.readFileSync(path.join(FN, 'core.js'), 'utf8');
    const errs = [...new Set([...coreSrc.matchAll(/fail\(\d+, '(\w+)'/g)].map((m) => m[1]))]
      .filter((e) => !['bad_request', 'action', 'assistant', 'owner', 'opponent', 'division', 'size', 'engine'].includes(e));
    const missing = errs.filter((e) => !new RegExp(`\\b${e}:`).test(part));
    check('H サーバが返す断りの種類は、端末の口で日本語にできる', missing.length === 0, missing.join(','));
    check('H 端末の口は公開の印 assistantMasmonBattlePvp の後ろ', /RELEASE_FLAGS\.assistantMasmonBattlePvp === true/.test(part));
    check('H 端末の口は勝ち負けをサーバへ送らない', !/winner\s*:/.test((part.match(/action: 'challenge'[\s\S]*?\}\);/) || [''])[0]));
    check('H 端末の口は表へ書かない(読むだけ)', !/method:\s*'(PATCH|DELETE|PUT)'/.test(part) && !/rest\/v1\/rpc/.test(part));
  }

  console.log(fails ? `NG ${fails} 件` : 'OK フレンド対戦のサーバの関数の検査を全部通過');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
