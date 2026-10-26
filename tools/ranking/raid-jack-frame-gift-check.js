// プロフィールフレーム「ハロウィン・妖」をギフトで届ける(2026-10-20 社長の決定)を確かめる。
// レイド「カボチャの大王ジャック」で大王まで倒せたときの終章(raid_jack_ending_cleared)を見た参加者へ、1回だけ届ける。
//
// 見るもの
//   ① ギフトの報酬 profileFrame の読み方(知らない・未公開の枠はギフトごと無効)と、受け取ったときに持ち物へ足すこと
//   ② 参加したかの判定(この端末のレイドの記録)
//   ③ 本体のつなぎ: 倒せたときの終章を見たときだけ・期間が終わってから・参加者だけ・新しい印のキーで1回だけ・ギフトと印を同じ取引で保存
//   ④ 受け取りの取引で、枠の持ち物(mh_profile_frame_owned_v1)も一緒に保存する
//   ⑤ 届くまでは選択画面に出さない
//   node tools/ranking/raid-jack-frame-gift-check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const giftsSrc = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const raidSrc = read('monster-hero/src/parts/35-raid-jack.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const breeder = read('monster-hero/data/breeder.js');
const saveSpec = read('docs/spec/SAVE_DATA.md');

// 定義を取り出す(1行の定義はその行、関数は「const 名前 = 」から行頭の「};」または「);」まで)
const take = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) return '';
  // 1行で終わる定義(const X = 'a'; など)はその行だけ
  const firstLine = src.slice(at, src.indexOf('\n', at));
  if (/;\s*(\/\/.*)?$/.test(firstLine)) return firstLine + '\n';
  const end = src.slice(at).search(/\n(\};|\}\);|\);)\n/);
  if (end >= 0) return src.slice(at, at + end + 3);
  return src.slice(at, src.indexOf('\n', at) + 1);
};
// ① ギフトの報酬
{
  const names = ['GIFT_REWARD_LABELS', 'GIFT_ITEM_REWARD_TYPE', 'GIFT_FRAME_REWARD_TYPE', 'giftFrameRewardInfo', 'giftItemRewardInfo', 'normalizeGiftRewards', 'giftIsExpired', 'buildGiftClaim', 'giftRewardText', 'grantGiftOnce'];
  const code = names.map((n) => take(giftsSrc, n)).join('\n');
  check('ギフトの関数を取り出せる', names.every((n) => code.includes(`const ${n} = `)), names.filter((n) => !code.includes(`const ${n} = `)).join(','));
  const frames = { frame_halloween_pumpkin: { id: 'frame_halloween_pumpkin', name: 'ハロウィン・妖', released: true }, frame_hidden: { id: 'frame_hidden', name: '未公開', released: false } };
  const ctx = { profileFrameById: (id) => frames[id] || null, BREEDER_MARKET_ITEMS: [] };
  vm.createContext(ctx);
  vm.runInContext(`${code}\nthis.out={normalizeGiftRewards,buildGiftClaim,giftRewardText,grantGiftOnce};`, ctx);
  const G = ctx.out;
  const gift = (frameId) => ({ id: 'g1', title: 't', source: 'raidJack', rewards: [{ type: 'profileFrame', frameId, amount: 1 }] });
  check('フレームの報酬を読める', !!G.normalizeGiftRewards(gift('frame_halloween_pumpkin')));
  check('知らない枠・未公開の枠の報酬はギフトごと無効', !G.normalizeGiftRewards(gift('nope')) && !G.normalizeGiftRewards(gift('frame_hidden')));
  const claim = G.buildGiftClaim(gift('frame_halloween_pumpkin'), { gold: 5, breederPoints: 1, breederXp: 0, ownedItems: { a: 1 }, ownedProfileFrames: ['frame_moo'] });
  check('受け取ると枠の持ち物に足され、ほかの残高は変わらない', claim.ok && claim.balances.ownedProfileFrames.join() === 'frame_moo,frame_halloween_pumpkin'
    && claim.balances.gold === 5 && claim.balances.breederPoints === 1 && JSON.stringify(claim.balances.ownedItems) === '{"a":1}', JSON.stringify(claim.balances));
  const again = G.buildGiftClaim(gift('frame_halloween_pumpkin'), { ownedProfileFrames: ['frame_halloween_pumpkin'] });
  check('もう持っている枠なら増やさない', again.ok && again.balances.ownedProfileFrames.join() === 'frame_halloween_pumpkin');
  check('受け取り済みのギフトは受け取れない', !G.buildGiftClaim({ ...gift('frame_halloween_pumpkin'), claimedAt: '2026-11-01T00:00:00Z' }, {}).ok);
  check('報酬の表示は「プロフィールフレーム「名前」」', /プロフィールフレーム「ハロウィン・妖」/.test(G.giftRewardText({ type: 'profileFrame', frameId: 'frame_halloween_pumpkin', amount: 1 })));
  check('同じidのギフトは二重に作らない', G.grantGiftOnce(G.grantGiftOnce([], gift('frame_halloween_pumpkin')).gifts, gift('frame_halloween_pumpkin')).granted === false);
  check('今までのギフト(ダイヤ)はそのまま読める', !!G.normalizeGiftRewards({ rewards: [{ type: 'diamond', amount: 100 }] })
    && G.buildGiftClaim({ id: 'x', rewards: [{ type: 'diamond', amount: 100 }] }, { gold: 1 }).balances.gold === 101);
}
// ② 参加したか
{
  // 保存の正規化はひとまとまり(既定値〜raidJackNormalizeState)で取り出す
  const from = raidSrc.indexOf('const raidJackDefaultState = '), to = raidSrc.indexOf('const raidJackRemaining = ');
  const code = `${raidSrc.slice(from, to)}\n${take(raidSrc, 'raidJackParticipated')}`;
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${code}\nthis.out={raidJackParticipated};`, ctx);
  const P = ctx.out.raidJackParticipated;
  check('記録が無い・壊れていれば参加していない', P(null) === false && P('x') === false && P({}) === false);
  check('1回でも挑んだ日があれば参加', P({ a: { day: '2026-10-10', used: 1 } }) === true && P({ b: { day: '2026-10-10' } }) === true);
  check('グランドスラムの累計・受け取った報酬があれば参加', P({ b: { total: 10 } }) === true && P({ claimed: ['a1_first'] }) === true);
  check('ギフトの中身はフレーム「ハロウィン・妖」1枚', /rewards: \[\{ type: 'profileFrame', frameId: RAID_JACK_FRAME_GIFT_FRAME_ID, amount: 1 \}\]/.test(raidSrc)
    && /RAID_JACK_FRAME_GIFT_FRAME_ID = 'frame_halloween_pumpkin'/.test(raidSrc));
}
// ③ 本体のつなぎ
{
  const at = app.indexOf('const grantRaidJackFrameGift = async () => {');
  const body = at >= 0 ? app.slice(at, app.indexOf('\n  };', at)) : '';
  check('届ける処理がある', !!body);
  check('公開フラグが偽・デバッグの強制表示中は届けない', /RELEASE_FLAGS\.raidJack !== true \|\| raidJackDebugForce/.test(body));
  check('期間が終わってからだけ届ける', /raidJackWindowAt\(Date\.now\(\)\) !== 'after'/.test(body));
  check('届けた印(新しいキー)があれば何もしない', /storeGet\(RAID_JACK_FRAME_GIFT_KEY, null, false\)/.test(body) && /if \(mark\) return false;/.test(body)
    && /RAID_JACK_FRAME_GIFT_KEY = 'mh_raid_jack_frame_gift_v1'/.test(raidSrc));
  check('参加していなければ届けない(印も付けない)', /if \(!raidJackParticipated\(await raidJackLoadState\(\)\)\) return false;/.test(body));
  check('ギフトと印を同じ取引で保存する', /saveStoredValuesOrRollback\(\[[\s\S]*key:'mh_gifts'[\s\S]*key:RAID_JACK_FRAME_GIFT_KEY/.test(body));
  check('倒せたときの終章(raid_jack_ending_cleared)を見たときだけ呼ぶ',
    /rhythmEventStorySeen\.includes\(RAID_JACK_ENDING_CLEARED_ID\)\) return;\n    void grantRaidJackFrameGift\(\);/.test(app)
    && !/RAID_JACK_ENDING_NOTCLEARED_ID[^\n]*grantRaidJackFrameGift/.test(app));
  check('新しい保存キーが SAVE_DATA.md に載っている', saveSpec.includes('mh_raid_jack_frame_gift_v1'));
}
// ④ 受け取りの取引
{
  const at = app.indexOf('const claimGiftIds = async');
  const body = at >= 0 ? app.slice(at, app.indexOf('\n  };', at)) : '';
  check('受け取りでは、枠の持ち物を保存から読み直して持って回る', /storedFramesBefore = normalizeOwnedProfileFrames\(await storeGet\(PROFILE_FRAME_OWNED_KEY, \[\], false\)\)/.test(body));
  check('枠が増えたときだけ、同じ取引で枠の持ち物を保存する', /if \(framesAfter\.length !== storedFramesBefore\.length\) entries\.push\(\{ key:PROFILE_FRAME_OWNED_KEY/.test(body)
    && body.indexOf('PROFILE_FRAME_OWNED_KEY, before') < body.indexOf('saveStoredValuesOrRollback(entries'));
}
// ⑤ 選択画面
check('ハロウィン・妖はプレゼントの枠(unlock.gift)', /id:'frame_halloween_pumpkin', name:'ハロウィン・妖', kind:'image', released:true[^\n]*\n    unlock:\{ gift:'raidJackEnding' \}/.test(breeder));
check('届くまでは選択画面に並べない', /releasedProfileFrames\(\)\.filter\(frame=>!profileFrameGift\(frame\)\|\|ownedOf\(frame\)\)/.test(app));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
