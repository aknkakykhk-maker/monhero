const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンヒロビート プレオープン記念 新規プレイヤーキャンペーンを、本番ソースの関数で検証する。
//
//   node tools/boot/new-player-campaign-check.js
//
// このキャンペーンでいちばん怖いのは「既存プレイヤー全員へ配ってしまう」こと。
// 一度配ってしまうと取り消せないので、次の2つを機械的に見張る。
//
//   ① 配る条件が「キャンペーンの保存キーが無い」だけになっていないこと
//      (新しく始めた人も既存の人も、アップデート直後はどちらも持っていない)
//   ② 配る量と回数(ダイヤ100,000・虹のプシュケー100を、ひとり1回だけ)
//
// 受取そのものは既存のギフト基盤(buildGiftClaim)を通すので、加算の正しさも
// そこを使って確かめる。専用の受取処理を作っていないこと自体が大事なので、
// ここで既存関数を呼べること＝基盤に乗っていることの確認にもなっている。
const fs = require('fs'), vm = require('vm'), path = require('path');
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const prefix = source.slice(source.indexOf('const LOGIN_BONUS_REWARDS'), source.indexOf('const STAT_POINT_GAIN'));
const context = { React:{ createElement(){}, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} } };
vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.x={grantNewPlayerCampaignGift,NEW_PLAYER_CAMPAIGN_GIFT,NEW_PLAYER_CAMPAIGN_KEY,NEW_PLAYER_CAMPAIGN_ENABLED,buildGiftClaim,giftIsExpired,giftIsClaimable,giftTitleDisplay,normalizeGiftRewards,giftClaimableCount};`, context);
const { grantNewPlayerCampaignGift, NEW_PLAYER_CAMPAIGN_GIFT, NEW_PLAYER_CAMPAIGN_KEY, NEW_PLAYER_CAMPAIGN_ENABLED,
        buildGiftClaim, giftIsExpired, giftIsClaimable, giftTitleDisplay, normalizeGiftRewards, giftClaimableCount } = context.x;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const rewardOf = (gift, type) => (gift.rewards.find(r => r.type === type) || {}).amount;

// ---- 報酬の中身 ----
check('キャンペーンが有効になっている', NEW_PLAYER_CAMPAIGN_ENABLED === true);
check('ギフトidが固定されている', NEW_PLAYER_CAMPAIGN_GIFT.id === 'monhiro_beat_preopen_new_player_v1', NEW_PLAYER_CAMPAIGN_GIFT.id);
check('専用の保存キーがある', NEW_PLAYER_CAMPAIGN_KEY === 'mh_monhiro_beat_preopen_new_player_campaign_v1', NEW_PLAYER_CAMPAIGN_KEY);
check('タイトルでキャンペーンだと分かる', /モンヒロビート/.test(NEW_PLAYER_CAMPAIGN_GIFT.title) && /プレオープン/.test(NEW_PLAYER_CAMPAIGN_GIFT.title), NEW_PLAYER_CAMPAIGN_GIFT.title);
check('本文で新規プレイヤーキャンペーンだと分かる', /新規プレイヤーキャンペーン/.test(NEW_PLAYER_CAMPAIGN_GIFT.description || ''));
check('報酬はダイヤ100,000と虹のプシュケー100の2件だけ',
  NEW_PLAYER_CAMPAIGN_GIFT.rewards.length === 2
  && rewardOf(NEW_PLAYER_CAMPAIGN_GIFT, 'diamond') === 100000
  && rewardOf(NEW_PLAYER_CAMPAIGN_GIFT, 'rainbowPsyche') === 100,
  JSON.stringify(NEW_PLAYER_CAMPAIGN_GIFT.rewards));
check('報酬の形式が既存のギフト基盤で扱える', !!normalizeGiftRewards(NEW_PLAYER_CAMPAIGN_GIFT));

// ---- 受取期限(ユーザー未指定なので付けない) ----
const issued = grantNewPlayerCampaignGift([], Date.parse('2026-09-05T00:00:00Z'));
const gift = issued.gifts[0];
check('新規へ発行できる', issued.granted && issued.gifts.length === 1);
check('受取期限を勝手に付けていない', gift.expiresAt == null, String(gift.expiresAt));
check('期限なしでも期限切れにならない', !giftIsExpired(gift, Date.parse('2099-01-01T00:00:00Z')));
check('期限なしでも受け取れる状態として数える', giftIsClaimable(gift) && giftClaimableCount([gift]) === 1);
check('ギフト画面でキャンペーンだと分かる', giftTitleDisplay(gift).label === 'キャンペーン');

// ---- 一度だけ ----
const again = grantNewPlayerCampaignGift(issued.gifts);
check('同じidが既にあれば足さない(再起動しても増えない)', !again.granted && again.gifts.length === 1);
let repeat = issued.gifts;
for (let i = 0; i < 5; i++) repeat = grantNewPlayerCampaignGift(repeat).gifts;
check('何度呼んでも1件のまま', repeat.filter(g => g.id === NEW_PLAYER_CAMPAIGN_GIFT.id).length === 1, `${repeat.length}件`);
// 受け取ったあとに再び通っても、増えない(idで見ているので受取済みでも足さない)
const claimedOnce = [{ ...gift, claimedAt:'2026-09-05T01:00:00.000Z' }];
check('受取済みでも再発行しない', !grantNewPlayerCampaignGift(claimedOnce).granted);

// ---- 受け取ると加算される(上書きではない) ----
const before = { gold: 12345, breederPoints: 7, breederXp: 0, ownedItems: { rainbow_psyche: 3, dye_mock: 1 } };
const claim = buildGiftClaim(gift, before, Date.parse('2026-09-05T02:00:00Z'));
check('受け取れる', claim.ok);
check('ダイヤが +100000 される(上書きではない)', claim.ok && claim.balances.gold === 112345, claim.ok ? String(claim.balances.gold) : '');
check('虹のプシュケーが +100 される(上書きではない)', claim.ok && claim.balances.ownedItems.rainbow_psyche === 103, claim.ok ? String(claim.balances.ownedItems.rainbow_psyche) : '');
check('虹のプシュケーは既存のアイテムidへ入る', claim.ok && Object.prototype.hasOwnProperty.call(claim.balances.ownedItems, 'rainbow_psyche'));
check('関係ない持ち物を壊さない', claim.ok && claim.balances.ownedItems.dye_mock === 1 && claim.balances.breederPoints === 7);
check('2回目の受取は加算されない', !buildGiftClaim(claim.gift, claim.balances, Date.parse('2026-09-05T03:00:00Z')).ok);

// ---- 誰に配るか(ソースの作りを見る) ----
// 「保存キーが無いから配る」だけになっていないかを、実装の文面で確かめる。
// ここが崩れると既存プレイヤー全員へ配ってしまうので、いちばん強く見張る。
check('配る条件に「一度もオンボーディングを終えていない」判定を使っている',
  source.includes('const everOnboarded = wasOnboarded === true;')
  && source.includes('setNewPlayerCampaignEligible(!everOnboarded);'));
check('名前やアイコンが欠けた既存プレイヤーを新規と誤認しない',
  // everOnboarded を「未完了へ戻す行」より前で決めていること
  source.indexOf('const everOnboarded = wasOnboarded === true;')
    < source.indexOf('if (wasOnboarded && !(hasSavedName && hasSavedIcon)) wasOnboarded = false;'));
check('発行は、はじめての設定を終えたときだけ',
  source.includes('newPlayerCampaignEligible') && source.includes('grantNewPlayerCampaignGift('));
check('完了フラグ(mh_onboarded)より前に配っている',
  source.indexOf('grantNewPlayerCampaignGift(Array.isArray(savedGifts)') < source.indexOf("await storeSet('mh_onboarded',true,false);"));
check('配布済みフラグも保存している', source.includes(`await storeSet(NEW_PLAYER_CAMPAIGN_KEY, true, false);`));
check('配布済みフラグが立っていれば配らない', source.includes('if (issued !== true) {'));
check('デバッグのプレビューでは配らない', source.includes('if (!onboardingPreview && NEW_PLAYER_CAMPAIGN_ENABLED && newPlayerCampaignEligible)'));
check('受け取りは既存のギフト経路(専用画面を作っていない)',
  !source.includes('CampaignClaimScreen') && !/gold\s*\+=\s*100000/.test(source));
check('助手の選択に依存していない',
  !/newPlayerCampaignEligible[^\n]*selectedAssistantId/.test(source)
  && !/selectedAssistantId[^\n]*newPlayerCampaignEligible/.test(source));
check('モンビーを遊んだかどうかに依存していない',
  !/newPlayerCampaignEligible[^\n]*rhythm/i.test(source));
check('終了日時を勝手に決めていない',
  !/CAMPAIGN[_A-Z]*(END|DEADLINE|EXPIRES)/.test(source));
check('あとからOFFにできる形になっている', source.includes('const NEW_PLAYER_CAMPAIGN_ENABLED ='));

// ---- 既存のギフトを壊していないこと ----
const loginGift = { id:'gift_login_2026-09-05', source:'loginBonus', title:'ログインボーナス 1日目',
  rewards:[{type:'diamond',amount:500}], expiresAt:'2026-10-05T00:00:00.000Z', claimedAt:null };
check('期限つきの既存ギフトはこれまでどおり期限で切れる',
  !giftIsExpired(loginGift, Date.parse('2026-09-10T00:00:00Z'))
  && giftIsExpired(loginGift, Date.parse('2026-11-01T00:00:00Z')));
check('壊れた期限はこれまでどおり期限切れ扱い',
  giftIsExpired({ ...loginGift, expiresAt:'こわれた値' }, Date.parse('2026-09-10T00:00:00Z')));
check('キャンペーンと既存ギフトが同じ一覧に並ぶ',
  giftClaimableCount([gift, loginGift], Date.parse('2026-09-10T00:00:00Z')) === 2);

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
