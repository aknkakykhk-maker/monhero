#!/usr/bin/env node
// MFバトルカードのマルチ: 「だれとでも」で待っている人の一覧の部品を確かめる(2026-10-27・カード部 ツナグくん)。
// 社長「マルチで誰かが募集してたりしたらここで見れるようにして」。案: docs/progress/card-multi-plus/lobby-list/README.md
//
//   node tools/card/card-pvp-lobby-list-check.js
//
//   ① 待っています の知らせ(seek)に、名前・アイコン・フレーム・強さが入る。古い版(名前なし)の知らせも、今までどおり受け取れる
//   ② 知らせの掃除: 長すぎる名前は切る・強さは0〜10000の整数だけ・知らない項目は捨てる・合言葉の形でない物は捨てる
//   ③ 一覧: 古い知らせ(6秒より前)は出さない・先に待っている人が上・名前の無い人は「ブリーダー」・待っている秒数は0〜999に収める
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).replace(/[\\u0000-\\u001f]/g, "").slice(0, max);\n'
  + 'const rhythmMultiNormalizeCode = (v) => { const c = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return /^[A-Z0-9]{4}$/.test(c) ? c : ""; };\n'
  + `${multi}\n;\nthis.E = { cardPvpCleanMessage, cardPvpSeekerList, CARD_PVP_NAME_MAX };`, ctx);
const E = ctx.E;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ①
const full = E.cardPvpCleanMessage({ t: 'seek', from: 'c1', code: 'ab12', at: 1000, name: 'ドラゴン使い', icon: 'snegurochka', fr: 'frame_x', rt: 1564 });
check('① 名前・アイコン・フレーム・強さが入る', full && full.code === 'AB12' && full.name === 'ドラゴン使い' && full.icon === 'snegurochka' && full.fr === 'frame_x' && full.rt === 1564, JSON.stringify(full));
const old = E.cardPvpCleanMessage({ t: 'seek', from: 'c2', code: 'CD34', at: 2000 });
check('① 古い版の知らせ(名前なし)も受け取れる', old && old.code === 'CD34' && old.name === null && old.icon === null && old.rt === null, JSON.stringify(old));
// ②
const long = E.cardPvpCleanMessage({ t: 'seek', from: 'c3', code: 'EF56', at: 3000, name: 'あ'.repeat(99), rt: 99999, secret: 'x', deck: [1, 2] });
check('② 長すぎる名前は切る・強さの範囲外は出さない・知らない項目は捨てる', long && long.name.length === E.CARD_PVP_NAME_MAX && long.rt === null && !('secret' in long) && !('deck' in long), JSON.stringify(long));
check('② 強さは整数だけ', E.cardPvpCleanMessage({ t: 'seek', from: 'c4', code: 'GH78', at: 1, rt: 1500.5 }).rt === null);
check('② 合言葉の形でない・時刻が無い知らせは捨てる', E.cardPvpCleanMessage({ t: 'seek', from: 'c5', code: 'x', at: 1 }) === null && E.cardPvpCleanMessage({ t: 'seek', from: 'c6', code: 'IJ90' }) === null);
// ③
const now = 100000;
const seekers = {
  b: { code: 'BBBB', at: now - 41000, seen: now - 1000, name: 'ひよこ', icon: '🐣', rt: 1500 },
  a: { code: 'AAAA', at: now - 12000, seen: now - 500, name: 'ドラゴン使い', rt: 1564 },
  old: { code: 'OOOO', at: now - 90000, seen: now - 7000, name: 'いなくなった人' },
  noname: { code: 'NNNN', at: now - 3000, seen: now - 200 },
  skew: { code: 'SSSS', at: now + 50000, seen: now - 100, name: '時計のずれ' },
};
const list = E.cardPvpSeekerList(seekers, now);
check('③ 古い知らせ(6秒より前)は出さない', !list.some((x) => x.name === 'いなくなった人') && list.length === 4, list.map((x) => x.name).join(','));
check('③ 先に待っている人が上', list[0].name === 'ひよこ' && list[1].name === 'ドラゴン使い', list.map((x) => x.name).join(','));
check('③ 名前の無い人は「ブリーダー」・強さは出さない', list.some((x) => x.code === 'NNNN' && x.name === 'ブリーダー' && x.rt === null));
check('③ 待っている秒数は0〜999に収める(相手の時計がずれていても)', list.every((x) => x.waitSec >= 0 && x.waitSec <= 999) && list.find((x) => x.code === 'SSSS').waitSec === 0 && list[0].waitSec === 41, list.map((x) => x.waitSec).join(','));
check('③ 壊れた一覧でも落ちない', E.cardPvpSeekerList(null, now).length === 0 && E.cardPvpSeekerList({ x: null, y: { code: 1 } }, now).length === 0);

if (failed) { console.log(`\nNG: ${failed} 件`); process.exit(1); }
console.log('\nすべて OK');
