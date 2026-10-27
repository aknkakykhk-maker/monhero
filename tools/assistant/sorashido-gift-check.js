// ソラシドの沖縄のおみやげ(10,000ビートP)をギフトで1回だけ届ける(2026-10-27 社長)を確かめる。
//
// 見るもの
//   ① ギフトの報酬 beatPoint の読み方と、受け取ったときにビートPへ足すこと(ほかの残高は変わらない)
//   ② 本体のつなぎ: 加入のお話を見たときだけ・公開の印が要る・新しい印のキーで1回だけ・ギフトと印を同じ取引で保存
//   ③ 受け取りの取引で、ビートP(mh_rhythm_event_points_v1)も一緒に保存する
//   ④ 新しい保存キーを SAVE_DATA.md に書いてある
//   node tools/assistant/sorashido-gift-check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const giftsSrc = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const saveSpec = read('docs/spec/SAVE_DATA.md');

const take = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) return '';
  const firstLine = src.slice(at, src.indexOf('\n', at));
  if (/;\s*(\/\/.*)?$/.test(firstLine)) return firstLine + '\n';
  const end = src.slice(at).search(/\n(\};|\}\);|\);)\n/);
  if (end >= 0) return src.slice(at, at + end + 3);
  return src.slice(at, src.indexOf('\n', at) + 1);
};
// ① ギフトの報酬
{
  const names = ['GIFT_REWARD_LABELS', 'GIFT_ITEM_REWARD_TYPE', 'GIFT_FRAME_REWARD_TYPE', 'giftFrameRewardInfo', 'giftItemRewardInfo', 'normalizeGiftRewards', 'giftIsExpired', 'buildGiftClaim', 'giftRewardText', 'grantGiftOnce', 'SORASHIDO_GIFT_BEAT_POINTS', 'sorashidoJoinGift'];
  const code = names.map((n) => take(giftsSrc, n)).join('\n');
  check('ギフトの関数を取り出せる', names.every((n) => code.includes(`const ${n} = `)), names.filter((n) => !code.includes(`const ${n} = `)).join(','));
  const ctx = { profileFrameById: () => null, BREEDER_MARKET_ITEMS: [] };
  vm.createContext(ctx);
  vm.runInContext(`${code}\nthis.out={normalizeGiftRewards,buildGiftClaim,giftRewardText,grantGiftOnce,sorashidoJoinGift};`, ctx);
  const G = ctx.out;
  const gift = G.sorashidoJoinGift();
  check('おみやげは 10,000ビートPの1件', gift.rewards.length === 1 && gift.rewards[0].type === 'beatPoint' && gift.rewards[0].amount === 10000 && !!G.normalizeGiftRewards(gift), JSON.stringify(gift.rewards));
  const claim = G.buildGiftClaim(gift, { gold: 5, breederPoints: 1, breederXp: 0, ownedItems: { a: 1 }, ownedProfileFrames: [], beatPoints: 300 });
  check('受け取るとビートPに足され、ほかの残高は変わらない', claim.ok && claim.balances.beatPoints === 10300 && claim.balances.gold === 5
    && claim.balances.breederPoints === 1 && JSON.stringify(claim.balances.ownedItems) === '{"a":1}', JSON.stringify(claim.balances));
  check('ビートPの残高を渡さない呼び方でも壊れない(0から数える)', G.buildGiftClaim(gift, { gold: 1 }).balances.beatPoints === 10000);
  check('ビートPの無いギフトでは、ビートPは変わらない', G.buildGiftClaim({ id: 'x', rewards: [{ type: 'diamond', amount: 100 }] }, { gold: 1, beatPoints: 7 }).balances.beatPoints === 7);
  check('報酬の表示は「ビートP ×10,000」', G.giftRewardText(gift.rewards[0]) === 'ビートP ×10,000', G.giftRewardText(gift.rewards[0]));
  check('同じidのギフトは二重に作らない', G.grantGiftOnce(G.grantGiftOnce([], gift).gifts, gift).granted === false);
}
// ② 本体のつなぎ
{
  check('印は新しいキー mh_sorashido_gift_v1', giftsSrc.includes("const SORASHIDO_GIFT_KEY = 'mh_sorashido_gift_v1';"));
  const at = app.indexOf('const grantSorashidoGift = async () => {');
  const body = at >= 0 ? app.slice(at, app.indexOf('\n  };\n', at)) : '';
  check('届ける関数がある', !!body);
  check('公開の印が偽なら届けない', /RELEASE_FLAGS\.assistantSorashido !== true\) return false/.test(body));
  check('印があれば届けない(回想で見直しても二度目は無い)', /storeGet\(SORASHIDO_GIFT_KEY[\s\S]*?if \(mark\) return false/.test(body));
  check('ギフトと印を同じ取引で保存する', /saveStoredValuesOrRollback\(\[[\s\S]*?'mh_gifts'[\s\S]*?SORASHIDO_GIFT_KEY[\s\S]*?\]/.test(body));
  check('加入のお話を見たときに呼ぶ', /rhythmEventStorySeen\.includes\(SORASHIDO_JOIN_STORY_ID\)\) return;\s*void grantSorashidoGift\(\);/.test(app));
}
// ③ 受け取りの取引
{
  const at = app.indexOf('const claimGiftIds = async');
  const body = at >= 0 ? app.slice(at, app.indexOf('\n  };\n', at)) : '';
  check('受け取りでビートPを保存から読み直す', /storeGet\(RHYTHM_EVENT_POINTS_KEY/.test(body) && /beatPoints: beatBefore/.test(body));
  check('ビートPが増えたときだけ同じ取引で保存する', /if \(beatAfter !== beatBefore\) entries\.push\(\{ key:RHYTHM_EVENT_POINTS_KEY/.test(body));
  check('保存に成功したら画面のビートPもそろえる', /if \(beatAfter !== beatBefore\) setRhythmEventPoints\(beatAfter\)/.test(body));
}
// ④ 保存キーの一覧
check('SAVE_DATA.md に mh_sorashido_gift_v1 がある', saveSpec.includes('`mh_sorashido_gift_v1`'));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
