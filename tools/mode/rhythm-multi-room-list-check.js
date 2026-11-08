#!/usr/bin/env node
// モンヒロビートのフリーマッチ「部屋に入る」の一覧(2026-11-07 社長「部屋を作ると入るで一覧が見れるような感じ」)を見る。
//
//   node tools/mode/rhythm-multi-room-list-check.js
//
// 【なぜ要るか】
// 一覧は、部屋主が受付へ流す知らせ({t:'room', code, n})に、部屋主の名前・アイコン・ブリーダーLv.・段階(hn/hi/hr/ph)を足して作る。
// 古い版の端末も同じ受付にいるので、次の2つを守る。
//   ① 古い版の知らせ(4つが無い)も、一覧に「部屋 ◯◯◯◯」として並ぶ(読めずに落ちない)
//   ② 新しい版の知らせを古い版が読んでも、今までどおり {code, n} として読める(古い版の読み方で確かめる)
// あわせて、壊れた値・満員・古すぎる知らせが一覧に出ないこと、画面の部品(シート・一覧・💌・HOME の帯)がそろっていることを見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const src = read('monster-hero/src/parts/77-screen-rhythm-multi.jsx');
const head = src.slice(0, src.indexOf('// ---- 通信'));
// 切り出した頭には、ほかの部品の名前(RHYTHM_LOOK_PRESETS など)が出てくる。見えないものは空の箱で埋める
const load = (code) => {
  const stub = new Set();
  for (let i = 0; i < 40; i++) {
    const ctx = { console, Math, Date, Number, String, Object, Array, JSON, RegExp, Set, Map, RELEASE_FLAGS: {}, window: {}, localStorage: { getItem() { return null; } } };
    // 箱は「空の配列」にする(.find や .map を呼ばれても落ちない)。関数として呼ばれる名前は無い前提(頭は定数と純粋な関数だけ)
    stub.forEach((k) => { ctx[k] = []; });
    vm.createContext(ctx);
    try { vm.runInContext(code, ctx); return ctx; } catch (e) {
      const m = /(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      stub.add(m[1]);
    }
  }
  throw new Error('読み込めませんでした');
};
const ctx = load(`${head};this.f={clean:rhythmMultiCleanRoomNotice,list:rhythmMultiRoomList,max:RHYTHM_MULTI_ROOM_MAX};`);
const { clean, list, max } = ctx.f;

// ① 古い版の知らせ
const oldNotice = clean({ t: 'room', code: 'ABCD', n: 2 });
ok('古い版の知らせ(名前などが無い)も読める', !!oldNotice && oldNotice.code === 'ABCD' && oldNotice.n === 2 && oldNotice.hn === '' && oldNotice.ph === '', JSON.stringify(oldNotice));
// 新しい版の知らせ
const newNotice = clean({ t: 'room', code: 'efgh', n: 3, hn: 'たろう', hi: 'Mocchi', hr: 24, ph: 'select' });
ok('新しい版の知らせから、部屋主の名前・アイコン・Lv.・段階を読む', !!newNotice && newNotice.code === 'EFGH' && newNotice.hn === 'たろう' && newNotice.hi === 'Mocchi' && newNotice.hr === 24 && newNotice.ph === 'select', JSON.stringify(newNotice));
// 壊れた値・満員
ok('名前が長すぎ・Lv.が数でない・段階が知らない値でも、落ちずに切り詰める',
  (() => { const n = clean({ t: 'room', code: 'JKLM', n: 1, hn: 'あ'.repeat(40), hr: 'x', ph: 'playing' }); return !!n && n.hn.length <= 12 && n.hr === 0 && n.ph === ''; })());
ok('満員の部屋・人数0・合言葉の無い知らせは読まない',
  clean({ t: 'room', code: 'ABCD', n: max }) === null && clean({ t: 'room', code: 'ABCD', n: 0 }) === null && clean({ t: 'room', n: 2 }) === null && clean({ t: 'chat' }) === null);

// ② 古い版の読み方(2026-11-06 までの rhythmMultiCleanRoomNotice)で、新しい版の知らせを読む
// 2026-11-06 までの rhythmMultiCleanRoomNotice をそのまま写したもの(古い版の端末の読み方)
const OLD_READER = `(raw) => {
  if (!raw || typeof raw !== 'object' || raw.t !== 'room') return null;
  const code = rhythmMultiNormalizeCode(raw.code);
  const n = rhythmMultiInt(raw.n, RHYTHM_MULTI_ROOM_MAX);
  return code && n >= 1 && n < RHYTHM_MULTI_ROOM_MAX ? { code, n } : null;
}`;
const sent = { t: 'room', code: 'EFGH', n: 3, hn: 'たろう', hi: 'Mocchi', hr: 24, ph: 'select' };
const byOld = vm.runInContext(`(${OLD_READER})(${JSON.stringify(sent)})`, ctx);
ok('新しい版の知らせを古い版の読み方で読んでも、今までどおり {code, n} になる', !!byOld && byOld.code === 'EFGH' && byOld.n === 3, JSON.stringify(byOld));

// 一覧の並びと古さ
const now = 1_000_000;
const rooms = { AAAA: { ...newNotice, code: 'AAAA', n: 1, seen: now - 1000 }, BBBB: { ...oldNotice, code: 'BBBB', n: 3, seen: now - 2000 }, CCCC: { n: 2, seen: now - 9000 } };
const shown = list(rooms, now, 8000);
ok('一覧は人の多い順。8秒より古い知らせは出さない', shown.length === 2 && shown[0].code === 'BBBB' && shown[1].code === 'AAAA', shown.map((r) => r.code).join(','));
ok('古い版の部屋も一覧に並ぶ(名前は空のまま→画面では「部屋 ◯◯◯◯」)', shown.some((r) => r.code === 'BBBB' && r.hn === ''));

// 画面の部品
ok('フリーマッチを押すとシート(部屋を作る/部屋に入る/おまかせ)', /data-rhythm-mode-free-sheet/.test(src) && /data-rhythm-multi-free-create/.test(src) && /data-rhythm-multi-free-list-open/.test(src) && /data-rhythm-multi-free-auto/.test(src));
ok('部屋に入る: 一覧と「入る」、部屋が無いときの案内', /data-rhythm-multi-room-row=/.test(src) && /data-rhythm-multi-room-join=/.test(src) && /data-rhythm-multi-room-list-empty/.test(src) && /古い版の部屋は名前が無いので「部屋 ◯◯◯◯」/.test(src));
// 2026-11-08: 部屋主のブリーダーID(hb)を足した(モードえらびの「いまモンヒロビートにいる人」でフレンドの部屋を見分ける)
ok('部屋主が知らせに名前など(とブリーダーID)を足して送る', /lobby\.socket\.send\(\{ t: 'room', code: s\.code, n: humans, hn: me\.name, hi: me\.icon, hr: me\.level, ph: s\.room\.phase, hb: me\.bid \|\| undefined \}\)/.test(src));
ok('「部屋を作る」で作った部屋は、ひとりでもほかの部屋へまとめない', /noMerge: !!\(opts && opts\.create\)/.test(src) && /!s\.noMerge/.test(src));
ok('招待はプライベートでもフリーでも(待合いの欄と💌のシート)', /\{friendsOn && view && \(\n\s*<section data-rhythm-multi-friend-invite/.test(src) && /data-rhythm-multi-invite-open/.test(src) && /\{chatSheet\}\{inviteSheetLayer\}/.test(src));
const app = read('monster-hero/src/parts/60-app.jsx');
ok('HOME の上の帯で招待が届く(入る→その部屋へ)', /function RhythmInviteHomeBar/.test(src) && /<RhythmInviteHomeBar show=\{gameState==='HOME'\}/.test(app) && /rhythmMultiPendingInvite = invite/.test(src) && /joinFromInvite\(pending\)/.test(src));

// 途中で抜けた部屋へ戻る(2026-11-07 社長「途中抜けして戻ろうとしたときに部屋がなかった」)
ok('自分で抜けた部屋を覚える(部屋を移るときは覚えない)', /leave\(opts = \{\}\)/.test(src) && /rhythmMultiLastRoom = \{ code: s\.code/.test(src) && /this\.leave\(\{ silent: true \}\)/.test(src));
ok('「↩ さっきの部屋に戻る」は10分のあいだ・フリーだけ。戻るときはほかの部屋へまとめない', /RHYTHM_MULTI_REJOIN_MS = 10 \* 60 \* 1000/.test(src) && /data-rhythm-multi-rejoin=/.test(src) && /RHYTHM_MULTI\.join\(r\.code, myProfile\(\), r\.mode, \{ create: true \}\)/.test(src));
ok('シートの「部屋に入る」に、いま待っている部屋の数と顔(無いときは「部屋を作る」を目立たせる)', /data-rhythm-multi-free-room-count=/.test(src) && /data-rhythm-multi-free-create-hot=/.test(src));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
