const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ギフト箱の「受け取る」が、複数の保存キーを**まとめて1つの取引**で書いているかを確かめる。
//
//   node tools/boot/gift-claim-transaction-check.js
//
// 【なぜ要るか】
// 1件のギフトで、ダイヤ・強化ポイント・アイテム・ブリーダー経験値が同時に動く。
// 以前はこれを1件ずつ storeSet していたので、途中で失敗すると
// 「ダイヤは増えたのにアイテムが入っていない」「経験値だけ増えてギフトは未受け取りのまま」
// という片方だけの状態がそのまま残った(2026-09-11 に saveStoredValuesOrRollback へ寄せた)。
//
// 取引関数そのものの挙動(書く→読み戻す→食い違えば全部戻す)は
// masu/save-transaction-check.js が実際に走らせて固定している。こちらは
// 「ギフト受け取りがその正本を使い続けているか」を見る。
//
// 【見かた】claimGiftIds の本体を切り出して、
//   ・4つのキーが entries に入っている(mh_gold / mh_breeder_points / mh_owned_items / mh_gifts)
//   ・ブリーダー経験値が増えたときは mh_breeder_xp と mh_breeder_points_granted も同じ取引に入る
//   ・保存が成立しなかったら、画面の state を1つも更新せずに戻る
//   ・1件ずつの storeSet が残っていない
const path = require('path');
const { readAppSource } = require(path.join(TOOLS_DIR, 'harness'));

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const source = readAppSource();
const from = source.indexOf('const claimGiftIds = async (ids) => {');
if (from < 0) { console.log('NG: claimGiftIds が見つかりません'); process.exit(1); }
// 関数の終わり。giftClaimingRef を戻す finally が最後にあるので、そこまでを本体とする
const endMark = 'giftClaimingRef.current = false; }';
const to = source.indexOf(endMark, from);
if (to < 0) { console.log('NG: claimGiftIds の終わりが見つかりません'); process.exit(1); }
const body = source.slice(from, to + endMark.length);

const KEYS = ['mh_gold', 'mh_breeder_points', 'mh_owned_items', 'mh_gifts'];
const missing = KEYS.filter(k => !body.includes(`key:'${k}'`) && !body.includes(`key: '${k}'`));
check('ダイヤ・強化ポイント・アイテム・ギフト箱を1つの取引でまとめて保存する', missing.length === 0,
  missing.length ? `entries に入っていない: ${missing.join(', ')}` : '4キー');

check('取引の正本(saveStoredValuesOrRollback)を通す', body.includes('saveStoredValuesOrRollback('));

check('ブリーダー経験値が増えたときは経験値も同じ取引に入る',
  body.includes("key:'mh_breeder_xp'") || body.includes("key: 'mh_breeder_xp'"));
check('レベルが上がったぶんの「配った総数」も同じ取引に入る',
  body.includes("key:'mh_breeder_points_granted'") || body.includes("key: 'mh_breeder_points_granted'"));
// 巻き戻す先が要るので、state を持たないこのキーだけは保存から読んでから取引に入れる
check('「配った総数」の巻き戻し先を保存から読んでいる',
  /storeGet\(\s*'mh_breeder_points_granted'/.test(body));

// 保存が成立しなかったときに画面を動かさない。saved を見てから setGold などへ進むこと
const savedAt = body.indexOf('saveStoredValuesOrRollback(');
const guardAt = body.indexOf('if (!saved)');
const setGoldAt = body.indexOf('setGold(');
check('保存が成立しなかったら画面の state を更新せずに戻る',
  guardAt > savedAt && setGoldAt > guardAt,
  guardAt < 0 ? 'if (!saved) の分岐がありません' : '');

// 1件ずつの保存へ戻っていないこと(取引に寄せた意味が消える)
const singles = KEYS.concat(['mh_breeder_xp', 'mh_breeder_points_granted'])
  .filter(k => body.includes(`storeSet('${k}'`) || body.includes(`storeSet("${k}"`));
check('1件ずつの storeSet が残っていない', singles.length === 0, singles.join(', '));

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
