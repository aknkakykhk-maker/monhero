#!/usr/bin/env node
// モンヒロサクセスのフレンドからのレンタル(段取りの回5・2026-11-12 オトズレ)の検査。
//   A サーバの形の確かめ(lend.js の parseLend)・アシストの id が計算の芯と同じ
//   B サーバの口(handleLend)を偽物の表で動かす: 鍵・フレンドどうし・続けて2回まで・受け取り
//   C 端末の借りる側(monsucLendMember): 送られた数字を信じない(アシストのポイント・4種類)・芯にそのまま渡せる
//   D SQL は足すだけ(消す文なし・新しい表だけ・端末に書かせない)・端末の口は読むだけ・印の後ろ
// 使い方: node tools/friends/monsuc-lend-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { load, sliceConst } = require('../success/load.js');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'masmon-pvp');
const SQL = path.join(ROOT, 'supabase', 'migrations', '202611120002_monsuc_lend.sql');
const PART = path.join(ROOT, 'monster-hero', 'src', 'parts', '56-assistant-life-friend-monsuc-lend.jsx');

let ng = 0;
const check = (label, ok, detail) => {
  if (ok) console.log(`OK  ${label}`);
  else { ng += 1; console.log(`NG  ${label}${detail ? ` … ${detail}` : ''}`); }
};

(async () => {
  const core = await import(pathToFileURL(path.join(FN, 'core.js')).href);
  const lend = await import(pathToFileURL(path.join(FN, 'lend.js')).href);
  const bundle = await import(pathToFileURL(path.join(FN, 'engine.js')).href);
  const catalog = bundle.MASMON_PVP_CATALOG;
  const { SUC } = load();

  // ---- A ----
  // 2026-11-12: サーバは第2版の表(40種類・段1〜5)の id を受ける。芯が効き目を持つ種類はその中にある(新しい種類は効き目を作るまで芯が無視する)
  const AT = require(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'monhero-success-assist.js'));
  check('A アシストの id がサーバとアシストの表(第2版)で同じ・段の上限も同じ', lend.LEND_ASSIST_IDS.slice().sort().join() === AT.LIST.map((a) => a.id).sort().join() && lend.LEND_ASSIST_LV_MAX === AT.LV_MAX,
    `${lend.LEND_ASSIST_IDS.length}種・段${lend.LEND_ASSIST_LV_MAX} / 表 ${AT.LIST.length}種・段${AT.LV_MAX}`);
  check('A 芯が効き目を持つ種類は、どれもサーバが受ける', Object.keys(SUC.ASSISTS).every((id) => lend.LEND_ASSIST_IDS.includes(id)), Object.keys(SUC.ASSISTS).filter((id) => !lend.LEND_ASSIST_IDS.includes(id)).join(','));
  const missing = SUC.speciesList.filter((sp) => !catalog.species[sp]);
  check('A 育成できる種はサーバの図鑑に全部ある(貸し出せる)', missing.length === 0, missing.join(','));
  const sp = SUC.speciesList[0];
  const good = { species: sp, name: 'テスト', type: 2, stats: { life: 300, pow: 200, wise: 100, hit: 100, eva: 100, tough: 100 }, assists: [{ id: 'sokoji', lv: 2 }], colors: { a: '#ff0000' } };
  const p = (m) => lend.parseLend(m, catalog, core.nameProblem);
  check('A ふつうの子は通る', !p(good).error && p(good).mon.assists.length === 1);
  check('A 中身は 6能力・種・名前・色・型・アシストだけ', Object.keys(p({ ...good, rank: 'M', bonus: { pow: 99 }, power: 99999 }).mon).sort().join() === 'assists,colors,name,species,stats,type');
  check('A 能力 1000 は断る', p({ ...good, stats: { ...good.stats, pow: 1000 } }).error === 'stats');
  check('A 能力が小数・文字は断る', p({ ...good, stats: { ...good.stats, pow: 1.5 } }).error === 'stats' && p({ ...good, stats: { ...good.stats, pow: '9' } }).error === 'stats');
  check('A 知らない種は断る', p({ ...good, species: 'NoSuchMon' }).error === 'species');
  check('A アシスト5種類・同じ id 2つ・段6・段0・知らない id は断る', [
    [{ id: 'sokoji', lv: 1 }, { id: 'kaketsuke', lv: 1 }, { id: 'hirameki', lv: 1 }, { id: 'atooshi', lv: 1 }, { id: 'kizuna', lv: 1 }],
    [{ id: 'sokoji', lv: 1 }, { id: 'sokoji', lv: 2 }], [{ id: 'sokoji', lv: 6 }], [{ id: 'sokoji', lv: 0 }], [{ id: 'boost', lv: 1 }],
  ].every((a) => p({ ...good, assists: a }).error === 'assists'));
  check('A 段5・第2版の新しい種類は通る', !p({ ...good, assists: [{ id: 'sokoji', lv: 5 }, { id: 'miharu', lv: 3 }] }).error);
  check('A 名前に URL・長すぎ・< は断る', ['http://x', 'あ'.repeat(13), 'a<b'].every((n) => p({ ...good, name: n }).error === 'name'));
  check('A 色が長すぎ・< を含むと断る', p({ ...good, colors: { a: 'x'.repeat(500) } }).error === 'colors' && p({ ...good, colors: { a: '<script>' } }).error === 'colors');

  // ---- B ----
  const fakeDb = () => {
    const keys = {}; const lends = {}; const uses = []; const friends = new Set(['A|B', 'A|C']);
    return {
      lends, uses,
      ownerCheck: async (o, k) => { if (!keys[o]) keys[o] = k; return keys[o] === k ? 'ok' : 'locked'; },
      areFriends: async (a, b) => friends.has(`${a}|${b}`) || friends.has(`${b}|${a}`),
      lendGet: async (o) => lends[o] || null,
      lendUpsert: async (row) => { lends[row.owner_id] = { ...row, version: (lends[row.owner_id] ? lends[row.owner_id].version : 0) + 1, active: true }; },
      lendDeactivate: async (o) => { if (lends[o]) lends[o].active = false; },
      // SQL の monsuc_lend_use と同じ決まり
      lendUse: async (b, l, streak) => {
        const last = uses.filter((u) => u.borrower === b).slice(-streak);
        if (last.length >= streak && last.every((u) => u.lender === l)) return { ok: false, reason: 'streak' };
        uses.push({ borrower: b, lender: l, claimed: false }); return { ok: true };
      },
      lendClaim: async (o, n, each) => {
        const mine = uses.filter((u) => u.lender === o && !u.claimed); const k = Math.min(n, mine.length);
        mine.forEach((u) => { u.claimed = true; }); return { n: mine.length, paid: k, fame: k * each };
      },
    };
  };
  const db = fakeDb();
  const KEY_A = 'a'.repeat(48); const KEY_B = 'b'.repeat(48); const KEY_C = 'c'.repeat(48); const KEY_D = 'd'.repeat(48);
  const h = (body) => core.handle({ body, db, engine: bundle.ASSISTANT_MASMON_BATTLE, catalog, learn: {}, nowMs: Date.parse('2026-11-12T03:00:00Z'), newSeed: () => 'mpseed000', log: () => {} });
  let r = await h({ action: 'lend_set', owner: 'B', key: KEY_B, mon: good, name: 'Bさん' });
  check('B 貸し出しの子を置ける', r.status === 200 && db.lends.B && db.lends.B.active && db.lends.B.mon.name === 'テスト', JSON.stringify(r.json));
  r = await h({ action: 'lend_set', owner: 'B', key: KEY_A, mon: good });
  check('B 鍵がちがうと置き直せない(locked)', r.status === 403 && r.json.error === 'locked');
  r = await h({ action: 'lend_set', owner: 'B', key: KEY_B, mon: { ...good, stats: { ...good.stats, pow: 5000 } } });
  check('B 形が悪い子は置けない', r.status === 400 && r.json.error === 'mon');
  await h({ action: 'lend_set', owner: 'C', key: KEY_C, mon: good });
  await h({ action: 'lend_set', owner: 'D', key: KEY_D, mon: good });
  r = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'D' });
  check('B フレンドでない人の子は借りられない', r.status === 403 && r.json.error === 'not_friend');
  r = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'A' });
  check('B 自分の子は借りられない', r.status === 400 && r.json.error === 'self');
  const u1 = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'B' });
  const u2 = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'B' });
  const u3 = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'B' });
  check('B 同じフレンドの子は続けて2回まで(3回目は streak)', u1.status === 200 && u2.status === 200 && u3.status === 409 && u3.json.error === 'streak');
  const u4 = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'C' });
  const u5 = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'B' });
  check('B ほかの人の子をはさめば、また借りられる', u4.status === 200 && u5.status === 200);
  await h({ action: 'lend_clear', owner: 'C', key: KEY_C });
  r = await h({ action: 'lend_use', owner: 'A', key: KEY_A, lender: 'C' });
  check('B 貸し出しをやめた子は借りられない', r.status === 404 && r.json.error === 'no_lend');
  r = await h({ action: 'lend_claim', owner: 'B', key: KEY_B });
  check('B 貸した側は借りられた回数と名声を受け取れる', r.status === 200 && r.json.n === 3 && r.json.fame === 3 * lend.LEND_FAME_EACH, JSON.stringify(r.json));
  r = await h({ action: 'lend_claim', owner: 'B', key: KEY_B });
  check('B 受け取りは1回だけ(2回目は0)', r.status === 200 && r.json.n === 0 && r.json.fame === 0);
  r = await h({ action: 'lend_claim', owner: 'B', key: KEY_A });
  check('B 受け取りにも鍵が要る', r.status === 403);

  // ---- C ----
  const partSrc = fs.readFileSync(PART, 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext([sliceConst(partSrc, 'MONSUC_LEND_STAT_KEYS'), sliceConst(partSrc, 'monsucLendPayloadOf'), sliceConst(partSrc, 'monsucLendMember'),
    'globalThis.__o = { monsucLendPayloadOf, monsucLendMember };'].join('\n'), ctx);
  const { monsucLendPayloadOf, monsucLendMember } = ctx.__o;
  const row = (m) => ({ friendId: 'B', name: 'Bさん', lend: m });
  const strong = { species: sp, name: 'つよい', stats: { life: 900, pow: 900, wise: 900, hit: 900, eva: 900, tough: 900 } };
  const m1 = monsucLendMember(row({ ...strong, assists: [{ id: 'sokoji', lv: 3 }, { id: 'kizuna', lv: 2 }] }), SUC);
  check('C ポイント以内のアシストは効く', m1 && m1.assists.length === 2 && m1.kind === 'raised' && m1.friend.id === 'B');
  const weak = { species: sp, name: 'よわい', stats: { life: 10, pow: 10, wise: 10, hit: 10, eva: 10, tough: 10 } };
  const all3 = ['sokoji', 'kizuna', 'kaketsuke', 'hirameki'].map((id) => ({ id, lv: 3 }));
  const m2 = monsucLendMember(row({ ...weak, assists: all3 }), SUC);
  check('C 6能力から出せる最大のポイントを超えたアシストは効かせない', m2 && m2.assists.length === 0);
  const m3 = monsucLendMember(row({ ...strong, assists: [{ id: 'boost', lv: 1 }] }), SUC);
  check('C 知らないアシストがあれば効かせない', m3 && m3.assists.length === 0);
  const m4 = monsucLendMember(row({ ...strong, stats: { ...strong.stats, pow: 5000 } }), SUC);
  check('C 能力は 999 に丸める', m4 && m4.stats.pow === 999);
  check('C 知らない種・中身なしは借りない', monsucLendMember(row({ ...strong, species: 'NoSuchMon' }), SUC) === null && monsucLendMember({ friendId: 'B' }, SUC) === null);
  const mem = SUC.memberOf(m1);
  check('C 芯の memberOf にそのまま渡せる(ランクと効きは6能力から出す)', mem && mem.kind === 'raised' && typeof mem.rank === 'string' && mem.assists.length === 2 && mem.top.length === 3);
  let runOk = false;
  try { const s = SUC.newRun({ id: 'lend-test', species: sp, aid: 'mua', team: [m1] }); runOk = Array.isArray(s.team) && s.team.length === 6 && s.team[0].kind === 'raised'; } catch (_) { runOk = false; }
  check('C 借りた子を入れて育成を始められる', runOk);
  const pay = monsucLendPayloadOf({ id: 'x1', species: sp, nick: 'ニックネーム', colors: { a: '#fff' }, gt: 3, st: good.stats, rank: 'M', score: 999, asp: { pts: 100, picks: { sokoji: 2, kizuna: 1 }, done: true } });
  check('C 保存枠の子から送る中身を作れる(ランク・点は送らない)', pay && pay.name === 'ニックネーム' && pay.type === 3 && pay.assists.length === 2 && !('rank' in pay) && !('score' in pay));
  check('C 送る中身はサーバの形の確かめを通る', pay && !p(pay).error, pay && p(pay).error);

  // ---- D ----
  const sql = fs.readFileSync(SQL, 'utf8').replace(/--.*$/gm, '');
  check('D SQL に消す・空にする文が無い', !/\b(drop|truncate|delete\s+from)\b/i.test(sql));
  const touched = [...sql.matchAll(/\b(?:alter\s+table|create\s+table\s+if\s+not\s+exists|insert\s+into|update|create\s+index\s+if\s+not\s+exists\s+\w+\s+on)\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]);
  check('D SQL が触る表は monsuc_lend* だけ', touched.length > 0 && touched.every((t) => /^monsuc_lend/.test(t)), touched.join(','));
  check('D 端末(anon)に書く権限を渡していない', !/grant\s+(insert|update|delete|all)[^;]*to\s+[^;]*anon/i.test(sql) && !/grant\s+execute[^;]*monsuc_lend_(use|claim)[^;]*anon/i.test(sql));
  const serveSrc = fs.readFileSync(path.join(FN, 'serve.js'), 'utf8');
  const rpcs = [...serveSrc.matchAll(/rpc\("(monsuc_\w+)"/g)].map((m) => m[1]);
  check('D サーバが呼ぶ monsuc_ の関数が SQL にある', rpcs.length === 2 && rpcs.every((n) => sql.includes(`function public.${n}(`)), rpcs.join(','));
  const lendSrc = fs.readFileSync(path.join(FN, 'lend.js'), 'utf8');
  const errs = [...new Set([...lendSrc.matchAll(/fail\(\d+, (?:\(r && r\.reason\) === 'streak' \? )?'(\w+)'/g)].map((m) => m[1]))].filter((e) => e !== 'action');
  const noText = errs.filter((e) => !new RegExp(`\\b${e}:`).test(partSrc));
  check('D サーバが返す断りは、端末の口で日本語にできる', noText.length === 0, noText.join(','));
  check('D 端末の口は表へ書かない(読むだけ)', !/method:\s*'(PATCH|DELETE|PUT)'/.test(partSrc) && !/rest\/v1\/monsuc_lend[^?]*', \{\s*method/.test(partSrc));
  const fns = ['monsucLendFriends', 'monsucLendSet', 'monsucLendClear', 'monsucLendUse', 'monsucLendClaim'];
  const behind = fns.every((f) => { const body = sliceConst(partSrc, f); return /if \(!monsucLendOn\(\)\) return/.test(body); });
  check('D 通信する口はどれも公開の印 monheroSuccess の後ろ', behind);
  check('D 新しい保存キーを作らない', !/storeSet\(|mh_monsuc_/.test(partSrc.replace(/^\s*\/\/.*$/gm, '')));

  console.log(ng ? `NG ${ng} 件` : 'OK モンヒロサクセスのレンタルの検査を全部通過');
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
