#!/usr/bin/env node
// セッション券1枚で「オートで挑む」のごほうびを1回ふやす(2026-11-07 社長・1日20回まで)の決まりを確かめる。
//
//   node tools/card/card-auto-ticket-check.js
//
// 96-card-tactics.jsx の cardAutoRewardNormalize・cardAutoRewardLoad・cardAutoRewardEntry・cardAutoRewardAddExtra を取り出し、
// 保存(storeGet/storeSet)と券の出し入れ(60 の consumeBuddyTicket/refundBuddyTicket の代わり)を手元の入れ物で動かして見る。
//   ① 券が1枚減って、ごほうびが1回戻る(残りが0→1)
//   ② 1日20回で止まる(21回目は券を減らさない)
//   ③ 券が0枚なら増えない(ボタンも押せない: 87 の disabled)
//   ④ 保存に失敗したら券が戻る(券だけ減ってごほうびが戻らない、を作らない)
//   ⑤ 日が変わると extra も0に戻る
//   ⑥ まだごほうびが残っているときは券を使わない(ボタンも出さない)
//   ⑦ 11/7 の戻しの印 r を消さない・ごほうびを数えるときも extra を引き継ぐ
//   ⑧ 券は 60 の consumeBuddyTicket・refundBuddyTicket を通す(別の減らし方を作らない)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero', f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const src = P('src/parts/96-card-tactics.jsx');
const a = src.indexOf("const CARD_AUTO_REWARD_KEY");
const b = src.indexOf('// 1試合ぶんの経験値の保存の項目');
check('96 から部品を取り出せた', a >= 0 && b > a && /cardAutoRewardAddExtra/.test(src.slice(a, b)));

// 手元の入れ物で動かす。today は日付を切り替えるため、外から変えられるようにする
const box = { store: {}, today: '2026-11-08', failSave: false, tickets: 0, consumed: 0, refunded: 0 };
const ctx = vm.createContext({
  box,
  storeGet: async (k, d) => (k in box.store ? JSON.parse(JSON.stringify(box.store[k])) : d),
  storeSet: async (k, v) => { if (box.failSave) return false; box.store[k] = JSON.parse(JSON.stringify(v)); return true; },
  cardTodayJst: () => box.today,
});
vm.runInContext(`${src.slice(a, b)}\nthis.E = { CARD_AUTO_REWARD_KEY, CARD_AUTO_REWARD_EXTRA_MAX, cardAutoRewardNormalize, cardAutoRewardLoad, cardAutoRewardEntry, cardAutoRewardAddExtra };`, ctx);
const E = ctx.E;
const KEY = E.CARD_AUTO_REWARD_KEY;
// 60 の consumeBuddyTicket と同じ振る舞い(持っていなければ false・持っていれば1減らして true)
const consume = async () => { if (box.tickets <= 0) return false; box.tickets -= 1; box.consumed += 1; return true; };
const refund = async () => { box.tickets += 1; box.refunded += 1; };
const reset = (raw, tickets) => { box.store = raw ? { [KEY]: raw } : {}; box.tickets = tickets; box.consumed = 0; box.refunded = 0; box.failSave = false; };

(async () => {
  check('1日の上限は20回', E.CARD_AUTO_REWARD_EXTRA_MAX === 20);

  // ① 券が減る・回数が戻る
  reset({ v: 1, day: '2026-11-08', n: 3 }, 5);
  let l0 = await E.cardAutoRewardLoad();
  check('使い切ったときは残り0・ふやせるのはあと20回', l0.left === 0 && l0.extraLeft === 20, JSON.stringify({ left: l0.left, extraLeft: l0.extraLeft }));
  let r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('① 券が1枚減る(5→4)', r.ok && box.tickets === 4 && box.consumed === 1, `${box.tickets}枚`);
  check('① ごほうびが1回戻る(残り0→1)・ふやせるのはあと19回', r.loaded.left === 1 && r.loaded.extraLeft === 19, JSON.stringify(box.store[KEY]));
  check('① 保存は n の意味を変えず extra を足す形', box.store[KEY].n === 3 && box.store[KEY].extra === 1 && box.store[KEY].day === '2026-11-08');

  // ⑥ まだ残っているときは券を使わない
  r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('⑥ ごほうびが残っているあいだは券を使わない', !r.ok && r.why === 'notEmpty' && box.tickets === 4, r.why);
  // 戻った1回をごほうびで使う(cardAutoRewardEntry)と、extra は引き継いだまま n が4になる
  const e = E.cardAutoRewardEntry(await E.cardAutoRewardLoad());
  check('⑦ ごほうびを数えるとき extra を引き継ぐ', e.next.n === 4 && e.next.extra === 1, JSON.stringify(e.next));
  box.store[KEY] = e.next;
  check('⑦ 数えたあとは残り0に戻る', (await E.cardAutoRewardLoad()).left === 0);

  // ② 上限20で止まる
  reset({ v: 1, day: '2026-11-08', n: 22, extra: 19 }, 3);
  r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('② 20回目まではふやせる', r.ok && r.loaded.extra === 20 && box.tickets === 2, JSON.stringify(box.store[KEY]));
  box.store[KEY].n = 23;
  r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('② 21回目は止まり、券を減らさない', !r.ok && r.why === 'limit' && box.tickets === 2 && box.consumed === 1, r.why);
  check('② 壊れた大きすぎる extra(999)は0として読む(上限を越えた値をうのみにしない)', E.cardAutoRewardNormalize({ day: '2026-11-08', n: 0, extra: 999 }, '2026-11-08').extra === 0);

  // ③ 券0枚
  reset({ v: 1, day: '2026-11-08', n: 3 }, 0);
  r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('③ 券が0枚ならふやさない', !r.ok && r.why === 'noTicket' && !box.store[KEY].extra, r.why);
  const pick = P('src/parts/87-card-deck-pick.jsx');
  check('③ 券が0枚ならボタンを押せない(87 の disabled)', /data-card-auto-ticket disabled=\{!\(auto\.tickets > 0\)\}/.test(pick));
  check('⑥ ボタンは今日のごほうびを使い切ったときだけ出す(87)', /auto\.left === 0 && typeof auto\.onExtra === 'function'/.test(pick));

  // ④ 保存に失敗したら券が戻る
  reset({ v: 1, day: '2026-11-08', n: 3 }, 2);
  box.failSave = true;
  r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('④ 保存に失敗したら券を返す(2→1→2)', !r.ok && r.why === 'save' && box.tickets === 2 && box.consumed === 1 && box.refunded === 1, `${box.tickets}枚・返した${box.refunded}`);
  check('④ 失敗したときは extra を足していない', !box.store[KEY].extra);

  // ⑤ 日が変わると extra も0
  reset({ v: 1, day: '2026-11-08', n: 10, extra: 7 }, 1);
  box.today = '2026-11-09';
  const l9 = await E.cardAutoRewardLoad();
  check('⑤ 次の日は n も extra も0(残りは3・ふやせるのはあと20回)', l9.n === 0 && l9.extra === 0 && l9.left === 3 && l9.extraLeft === 20, JSON.stringify(l9));
  box.today = '2026-11-08';

  // ⑦ 11/7 の戻しの印 r を消さない
  reset({ v: 1, day: '2026-11-07', n: 3, r: '20261107' }, 1);
  box.today = '2026-11-07';
  r = await E.cardAutoRewardAddExtra({ consume, refund });
  check('⑦ 11/7 は印 r を付けたまま書く(n は0に戻らない)', r.ok && box.store[KEY].r === '20261107' && box.store[KEY].n === 3 && r.loaded.left === 1, JSON.stringify(box.store[KEY]));
  const e7 = E.cardAutoRewardEntry(await E.cardAutoRewardLoad());
  check('⑦ 11/7 にごほうびを数えるときも印と extra を残す', e7.next.r === '20261107' && e7.next.extra === 1, JSON.stringify(e7.next));
  box.today = '2026-11-08';

  // ⑧ 券は 60 の consumeBuddyTicket・refundBuddyTicket を通す
  const app = P('src/parts/60-app.jsx');
  check('⑧ 60 が consumeBuddyTicket・refundBuddyTicket をバトルカードの画面へ渡す', /<CardBattleScreen[^>]*onUseSessionTicket=\{consumeBuddyTicket\}[^>]*onRefundSessionTicket=\{refundBuddyTicket\}/.test(app));
  const card = P('src/parts/84-screen-card-battle.jsx');
  check('⑧ 84 は cardAutoRewardAddExtra に渡された券の関数で減らす', /cardAutoRewardAddExtra\(\{ consume: onUseSessionTicket, refund: onRefundSessionTicket \}\)/.test(card));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
