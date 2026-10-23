// 助手の仲良し度のLvごとのごほうび(Lv2〜30。2026-10-21)を確かめる。
//
// 見るもの
//   ① 表の中身(社長の決定どおり)と、ギフトとして読めること。最初に配った量(V1)が #3241 のまま残っていること
//   ② 組み立て(buildAssistantBondRewardGrant): 越えたLvだけ・助手ごとに1回・印があれば二重に届かない
//      ・最初の量を受け取った節目(v1 の印)は、今の量との差のぶんだけ「追加ぶん」で届く(多く渡した品は取り上げない)
//      ・まだの人には今の量だけを1回
//   ③ 本体の届ける処理を取り出して、保存の上で実際に動かす
//      ・上のLvの人は、起動時に越えたLvのぶんがまとめて届く
//      ・何度呼んでも、ギフトが受け取り後に一覧から消えていても、二重に届かない
//      ・保存に失敗したら、ギフトも印も元のまま
//   ④ つなぎ: Lvが上がったときと起動が済んだときに呼ぶ・新しいキー・資料に書いてある
//   node tools/assistant-bond-reward-check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const assistantsSrc = read('monster-hero/data/assistants.js');
const giftsSrc = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const masuSrc = read('monster-hero/src/parts/11-masu-progression.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const saveSpec = read('docs/spec/SAVE_DATA.md');

// 定義を取り出す(1行の定義はその行、関数は「const 名前 = 」から行頭の「};」または「);」まで)
const take = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) return '';
  const firstLine = src.slice(at, src.indexOf('\n', at));
  if (/;\s*(\/\/.*)?$/.test(firstLine)) return firstLine + '\n';
  const end = src.slice(at).search(/\n(\};|\}\);|\);)\n/);
  if (end >= 0) return src.slice(at, at + end + 3);
  return src.slice(at, src.indexOf('\n', at) + 1);
};
const giftNames = ['GIFT_REWARD_LABELS', 'GIFT_ITEM_REWARD_TYPE', 'GIFT_FRAME_REWARD_TYPE', 'giftFrameRewardInfo', 'giftItemRewardInfo', 'normalizeGiftRewards', 'grantGiftOnce'];
const bondNames = ['normalizeAssistantBond', 'assistantBondLevelOf', 'ASSISTANT_BOND_REWARDS_KEY', 'ASSISTANT_BOND_REWARDS_V2_KEY', 'normalizeAssistantBondRewardsDelivered', 'assistantBondRewardGiftId', 'assistantBondRewardV2GiftId', 'assistantBondRewardRemainder', 'buildAssistantBondRewardGrant'];
const masuNames = ['HERO_PROOF_ITEM_ID', 'HERO_PROOF_SHARD_ITEM_ID', 'SOUL_CRYSTAL_ITEM_ID', 'saveStoredValuesOrRollback'];
const code = [...masuNames.map(n => take(masuSrc, n)), ...giftNames.map(n => take(giftsSrc, n)), ...bondNames.map(n => take(giftsSrc, n))].join('\n');
check('使う関数を取り出せる', [...giftNames, ...bondNames, ...masuNames].every(n => code.includes(`const ${n} = `)),
  [...giftNames, ...bondNames, ...masuNames].filter(n => !code.includes(`const ${n} = `)).join(','));

// 品物の定義はid・名前だけで足りる(giftItemRewardInfo が id で照らし合わせる)
const ctx = { BREEDER_MARKET_ITEMS: [], console };
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}
${code}
const HERO_PROOF_ITEM = { id:HERO_PROOF_ITEM_ID, name:'勇者の証' };
const HERO_PROOF_SHARD_ITEM = { id:HERO_PROOF_SHARD_ITEM_ID, name:'勇者の証片' };
const SOUL_CRYSTAL_ITEM = { id:SOUL_CRYSTAL_ITEM_ID, name:'魂格の結晶' };
this.out = { ASSISTANTS, ASSISTANT_BOND_LEVELS, ASSISTANT_BOND_LEVEL_REWARDS, ASSISTANT_BOND_REWARD_MILESTONES, ASSISTANT_BOND_LEVEL_REWARDS_V1, normalizeGiftRewards, grantGiftOnce,
  ASSISTANT_BOND_REWARDS_KEY, ASSISTANT_BOND_REWARDS_V2_KEY, assistantBondRewardRemainder, normalizeAssistantBondRewardsDelivered, buildAssistantBondRewardGrant, assistantBondLevelOf,
  normalizeAssistantBond, saveStoredValuesOrRollback };`, ctx);
const A = ctx.out;
const ids = A.ASSISTANTS.map(a => a.id);
const needOf = (lv) => A.ASSISTANT_BOND_LEVELS.find(s => s.level === lv).need;

// ① 表
const M = 10000, O = 100000000;
const d = (n) => ({ type:'diamond', amount:n }), p = (n) => ({ type:'rainbowPsyche', amount:n });
const f = (n) => ({ type:'rainbowTranscendFruit', amount:n }), h = (n) => ({ type:'gameItem', itemId:'hero_proof', amount:n });
{
  const T = A.ASSISTANT_BOND_LEVEL_REWARDS;
  const want = {
    2:[d(1*M),p(10)], 3:[d(3*M),p(20)], 4:[d(5*M),p(30)], 5:[d(10*M),p(50),f(1)],
    6:[d(300*M),p(1000)], 7:[d(400*M),p(1200)], 8:[d(500*M),p(1500)], 9:[d(600*M),p(1500)], 10:[d(1500*M),p(3000),f(20),h(1)],
    11:[d(800*M),p(2000)], 12:[d(900*M),p(2000)], 13:[d(1000*M),p(2500)], 14:[d(1100*M),p(2500)], 15:[d(2500*M),p(5000),f(30),h(2)],
    16:[d(1300*M),p(3000)], 17:[d(1400*M),p(3000)], 18:[d(1500*M),p(3500)], 19:[d(1600*M),p(3500)], 20:[d(4000*M),p(8000),f(50),h(3)],
    21:[d(5000*M),p(5000)], 22:[d(O),p(20000)], 23:[d(5000*M),p(5000),f(50)], 24:[d(5000*M),p(5000),h(3)], 25:[d(2*O),f(300),h(10)],
    26:[d(7000*M),p(10000)], 27:[d(7000*M),p(10000),f(100)], 28:[d(3*O),h(20)], 29:[d(O),p(20000),h(5)], 30:[d(5*O),h(30)],
  };
  check('Lv2〜30 の全部にごほうびがある', Object.keys(T).join() === Object.keys(want).join(), Object.keys(T).join());
  check('中身は決定どおり', JSON.stringify(T) === JSON.stringify(want));
  check('魂格の結晶は入っていない', !JSON.stringify(T).includes('soul_crystal'));
  check('どのLvもギフトとして読める', Object.values(T).every(r => !!A.normalizeGiftRewards({ rewards: r })));
  check('最初に配った量(V1)は #3241 のまま', JSON.stringify(A.ASSISTANT_BOND_LEVEL_REWARDS_V1) === JSON.stringify({
    22:[d(50000),p(30)], 25:[f(5),{ type:'gameItem', itemId:'hero_proof_shard', amount:10 }], 28:[h(1),d(100000)],
    30:[{ type:'gameItem', itemId:'soul_crystal', amount:3 },h(2),d(200000)] }));
  // 2026-10-22 にあつが加わって5人(ごほうびは助手ごとに各Lv1回。あつは仲良し度が上がったときに受け取る)
  // 2026-10-22 にきゅうこが加わって6人(公開の印が立つまでは一覧に出ないので、仲良し度もごほうびも動かない)
  check('助手は6人', ids.join() === 'mua,kiki,momosuke,dra,atsu,kyuko', ids.join());
  // 節目の説明が表とずれていないか(改善部 N4「Lv10・15・20・25 は特に豪華」)
  const ms = [...A.ASSISTANT_BOND_REWARD_MILESTONES];
  check('節目は Lv5・10・15・20・22・25・28・30', ms.join() === '5,10,15,20,22,25,28,30', ms.join());
  const msText = `Lv${ms.join('・')}`;
  const changelog = read('monster-hero/data/changelog.js'), help = read('monster-hero/data/help.js'), profile = read('monster-hero/src/parts/56-screen-profile.jsx');
  check('更新履歴の説明が節目と同じ', changelog.includes(`節目の ${msText} はほかのLvより豪華`) && !changelog.includes('Lv10・15・20・25 は特に豪華'));
  check('ヘルプの説明が節目と同じ', help.includes(`節目の ${msText} はほかのLvより豪華`));
  check('ごほうび一覧は節目を表から出す(書き写さない)', profile.includes('ASSISTANT_BOND_REWARD_MILESTONES') && profile.includes("milestones.join('・')") && profile.includes('data-bond-reward-milestone'));
  check('節目にはほかのLvより多いダイヤか品がある', ms.every(lv => {
    const dia = (r) => (r || []).filter(x => x.type === 'diamond').reduce((n, x) => n + x.amount, 0);
    const extra = (T[lv] || []).some(x => x.type === 'rainbowTranscendFruit' || x.itemId === 'hero_proof');
    return extra || dia(T[lv]) > dia(T[lv - 1]);
  }));
}
// ② 組み立て
{
  const B = A.buildAssistantBondRewardGrant;
  const none = B({ gifts: [], levels: { mua: 1, kiki: 1 } });
  check('Lv1なら何も届かない', !none.changed && none.gifts.length === 0);
  const r = B({ gifts: [], delivered: null, deliveredV2: null, levels: { mua: 30, kiki: 25, momosuke: 2, dra: 1 } });
  check('越えたLvのぶんがまとめて届く(みゅあ29・きき24・ももすけ1)', r.gifts.length === 54 && r.granted.length === 54, String(r.gifts.length));
  check('印も同じだけ付く', r.deliveredV2.mua.length === 29 && r.deliveredV2.kiki.length === 24 && r.deliveredV2.momosuke.join() === '2' && !r.deliveredV2.dra);
  check('まだの人には今の量だけ(追加ぶんは無い)', r.gifts.every(g => !g.id.endsWith('_topup')) && JSON.stringify(r.gifts.find(g => g.id === 'gift_assistant_bond_v2_mua_lv30').rewards) === JSON.stringify([d(5*O),h(30)]));
  check('題名に助手の名前とLvが入る', r.gifts.some(g => g.title === 'みゅあとの仲良し度 Lv30 のごほうび'));
  check('期限なし・未受取', r.gifts.every(g => g.expiresAt == null && g.claimedAt === null));
  const again = B({ gifts: r.gifts, deliveredV2: r.deliveredV2, levels: { mua: 30, kiki: 25, momosuke: 2 } });
  check('印があれば二重に届かない', !again.changed && again.gifts.length === 54);
  const afterClaim = B({ gifts: [], deliveredV2: r.deliveredV2, levels: { mua: 30, kiki: 25, momosuke: 2 } });
  check('ギフトが一覧から消えていても、印があれば届かない', !afterClaim.changed && afterClaim.gifts.length === 0);
  const up = B({ gifts: r.gifts, deliveredV2: r.deliveredV2, levels: { mua: 30, kiki: 26, momosuke: 2 } });
  check('Lvが上がったぶんだけ増える', up.granted.length === 1 && up.granted[0].assistantId === 'kiki' && up.granted[0].level === 26);
  // 最初の量(#3241)を受け取った人
  const v1 = { mua: [22, 25, 28, 30] };
  const t = B({ gifts: [], delivered: v1, deliveredV2: null, levels: { mua: 30 } });
  const topups = t.gifts.filter(g => g.id.endsWith('_topup')).map(g => g.id).sort();
  check('最初の量を受け取った節目は「追加ぶん」で届く', topups.join() === ['gift_assistant_bond_v2_mua_lv22_topup','gift_assistant_bond_v2_mua_lv25_topup','gift_assistant_bond_v2_mua_lv28_topup','gift_assistant_bond_v2_mua_lv30_topup'].join(), topups.join());
  check('ほかのLv(2〜21・23・24・26・27・29)は今の量で届く', t.gifts.length === 29 && t.gifts.filter(g => !g.id.endsWith('_topup')).length === 25);
  const rw = (lv) => JSON.stringify(t.gifts.find(g => g.id === `gift_assistant_bond_v2_mua_lv${lv}_topup`).rewards);
  check('Lv22 の追加ぶん = ダイヤ 99,950,000 + プシュケー 19,970', rw(22) === JSON.stringify([d(99950000),p(19970)]), rw(22));
  check('Lv25 の追加ぶん = ダイヤ 2億 + 実 295 + 証 10(証片は取り上げない)', rw(25) === JSON.stringify([d(2*O),f(295),h(10)]), rw(25));
  check('Lv28 の追加ぶん = ダイヤ 299,900,000 + 証 19', rw(28) === JSON.stringify([d(299900000),h(19)]), rw(28));
  check('Lv30 の追加ぶん = ダイヤ 499,800,000 + 証 28(結晶は取り上げない)', rw(30) === JSON.stringify([d(499800000),h(28)]), rw(30));
  check('追加ぶんの題名で分かる', t.gifts.some(g => g.title === 'みゅあとの仲良し度 Lv22 のごほうび(追加ぶん)'));
  const t2 = B({ gifts: t.gifts, delivered: v1, deliveredV2: t.deliveredV2, levels: { mua: 30 } });
  check('追加ぶんも二重に届かない', !t2.changed);
  const oldGift = { id: 'gift_assistant_bond_mua_lv22', title: 'x', rewards: [d(50000), p(30)], claimedAt: null };
  const t3 = B({ gifts: [oldGift], delivered: null, deliveredV2: null, levels: { mua: 22 } });
  check('最初の量のギフトが残っていれば(印が無くても)追加ぶんにする', t3.gifts.some(g => g.id === 'gift_assistant_bond_v2_mua_lv22_topup') && !t3.gifts.some(g => g.id === 'gift_assistant_bond_v2_mua_lv22'));
  check('差を引いても0になる品は入れない', JSON.stringify(A.assistantBondRewardRemainder([d(10), p(5)], [d(10), p(9)])) === '[]');
  const broken = A.normalizeAssistantBondRewardsDelivered({ mua: ['22', 'x', 22, -1], kiki: 'no', zz: [] });
  check('壊れた印は読める形に直す', JSON.stringify(broken) === '{"mua":[22]}', JSON.stringify(broken));
  check('印や一覧が配列や文字でも壊れない', B({ gifts: null, delivered: [1, 2], deliveredV2: 'x', levels: { mua: 2 } }).gifts.length === 1
    && B({ gifts: 'x', delivered: 'x', levels: { mua: 2 } }).gifts.length === 1);
}
// ③ 本体の届ける処理を動かす
const at = app.indexOf('const deliverAssistantBondRewards = useCallback(async () => {');
const end = app.indexOf('}, [onboardingPreview]);', at);
const body = at >= 0 && end > at ? app.slice(at, end + '}, [onboardingPreview]);'.length) : '';
check('本体の届ける処理がある', !!body);
const run = async () => {
  const makeApp = (store, { failSave = false } = {}) => {
    const c = { console: { error() {} }, store, setGiftsCalls: [], A };
    vm.createContext(c);
    vm.runInContext(`
      const { normalizeAssistantBond, assistantBondLevelOf, buildAssistantBondRewardGrant, saveStoredValuesOrRollback, ASSISTANT_BOND_REWARDS_KEY, ASSISTANT_BOND_REWARDS_V2_KEY } = A;
      const ASSISTANT_LIST = A.ASSISTANTS;
      const onboardingPreview = false;
      const useCallback = (f) => f;
      const assistantBondRewardRunningRef = { current:false };
      const assistantBondRewardAgainRef = { current:false };
      const assistantBondsRef = { current:{} };
      const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
      const storeGet = async (k, d) => (k in store ? clone(store[k]) : d);
      const storeSet = async (k, v) => { if (${failSave} && k === ASSISTANT_BOND_REWARDS_V2_KEY && v !== null && Object.keys(v).length) { store[k] = { broken:true }; return; } store[k] = clone(v); };
      const setGifts = (g) => setGiftsCalls.push(g.length);
      ${body}
      this.api = { deliver: deliverAssistantBondRewards, bonds: assistantBondsRef, running: assistantBondRewardRunningRef };`, c);
    return c;
  };
  const bondGifts = (st) => (st.mh_gifts || []).filter(g => String(g.id).startsWith('gift_assistant_bond_'));
  // 上のLvの人が起動した(まだ何も受け取っていない)
  const store = { mh_gifts: [{ id: 'gift_login_x', title: 'ログイン', rewards: [{ type: 'diamond', amount: 1 }] }] };
  const c = makeApp(store);
  c.api.bonds.current = { mua: { points: needOf(30) + 999 }, kiki: { points: needOf(25) }, momosuke: { points: needOf(22) - 1 }, dra: { points: 0 } };
  await c.api.deliver();
  check('起動時に越えたLvのぶんがまとめて届く(みゅあ29・きき24・ももすけ20)', bondGifts(store).length === 73, String(bondGifts(store).length));
  check('まだの人には今の量だけ(追加ぶんは無い)', !bondGifts(store).some(g => g.id.endsWith('_topup')));
  check('今までのギフトは残る', store.mh_gifts.some(g => g.id === 'gift_login_x'));
  const v2 = store.mh_assistant_bond_rewards_v2 || {};
  check('今の量の印(v2)が保存される', (v2.mua || []).length === 29 && (v2.kiki || []).length === 24 && (v2.momosuke || []).length === 20, JSON.stringify(v2).slice(0, 80));
  check('最初の量の印(v1)には触らない', !('mh_assistant_bond_rewards_v1' in store));
  check('画面のギフト一覧も更新する', c.setGiftsCalls.length === 1 && c.setGiftsCalls[0] === 74);
  await c.api.deliver();
  await c.api.deliver();
  check('何度呼んでも二重に届かない', bondGifts(store).length === 73 && c.setGiftsCalls.length === 1);
  store.mh_gifts = store.mh_gifts.filter(g => !String(g.id).startsWith('gift_assistant_bond_'));
  await c.api.deliver();
  check('受け取ってギフトが一覧から消えても、二度目は届かない', bondGifts(store).length === 0);
  // Lvが上がった(ももすけが22へ)
  c.api.bonds.current = { ...c.api.bonds.current, momosuke: { points: needOf(22) } };
  await Promise.all([c.api.deliver(), c.api.deliver()]);
  check('Lvが上がると、そのLvだけ1回届く(同時に呼ばれても1つ)', bondGifts(store).map(g => g.id).join() === 'gift_assistant_bond_v2_momosuke_lv22', bondGifts(store).map(g => g.id).join());
  check('走り終わったら次も呼べる', c.api.running.current === false);
  // #3241 で最初の量を受け取った人(v1 の印があり、ギフトは受け取って消えている)
  const store3 = { mh_gifts: [], mh_assistant_bond_rewards_v1: { mua: [22, 25, 28, 30], kiki: [22] } };
  const c3 = makeApp(store3);
  c3.api.bonds.current = { mua: { points: needOf(30) }, kiki: { points: needOf(22) } };
  await c3.api.deliver();
  const ids3 = bondGifts(store3).map(g => g.id);
  check('最初の量を受け取った節目は差のぶんだけ届く', ['mua_lv22', 'mua_lv25', 'mua_lv28', 'mua_lv30', 'kiki_lv22'].every(k => ids3.includes(`gift_assistant_bond_v2_${k}_topup`))
    && !ids3.includes('gift_assistant_bond_v2_mua_lv22'), ids3.filter(x => x.endsWith('_topup')).join(','));
  check('ほかのLvは今の量で届く(みゅあ25・きき20)', ids3.length === 29 + 21, String(ids3.length));
  check('最初の量の印(v1)は変えない', JSON.stringify(store3.mh_assistant_bond_rewards_v1) === JSON.stringify({ mua: [22, 25, 28, 30], kiki: [22] }));
  await c3.api.deliver();
  check('差のぶんも二重に届かない', bondGifts(store3).length === 50);
  // 保存に失敗した
  const store2 = { mh_gifts: [] };
  const c2 = makeApp(store2, { failSave: true });
  c2.api.bonds.current = { mua: { points: needOf(30) } };
  await c2.api.deliver();
  check('保存に失敗したらギフトも印も元のまま', Array.isArray(store2.mh_gifts) && store2.mh_gifts.length === 0
    && store2.mh_assistant_bond_rewards_v2 == null && c2.setGiftsCalls.length === 0, JSON.stringify(store2).slice(0, 120));
};
// ④ つなぎ
const wiring = () => {
  const fAt = app.indexOf('const addAssistantBondFor = useCallback(');
  const fBody = app.slice(fAt, app.indexOf('\n  }, [', fAt) + 60);
  check('Lvが上がったときに届ける', /if \(after > before\) void deliverAssistantBondRewards\(\);/.test(fBody));
  // 2026-10-23 から、加入のお話を見て助手を解放したとき(rhythmEventStorySeen)にも届け直す
  check('起動が済んだら届ける', /useEffect\(\(\) => \{ if \(dataLoaded\) void deliverAssistantBondRewards\(\); \}, \[dataLoaded, deliverAssistantBondRewards(?:, rhythmEventStorySeen)?\]\);/.test(app));
  check('まだ解放していない助手の仲良し度は増やさず、ごほうびも解放まで待たせる',
    /if \(typeof assistantUnlockedBy === 'function' && !assistantUnlockedBy\(id, rhythmEventStorySeenRef\.current\)\) return;/.test(app)
    && /\(typeof assistantUnlockedBy === 'function' && !assistantUnlockedBy\(who\.id, rhythmEventStorySeenRef\.current\)\) \? 0/.test(app));
  check('届ける処理は Lv の処理より前に書いてある(使う前に作る)', at >= 0 && at < fAt);
  check('「見るだけ」のプレビュー中は届けない', /if \(onboardingPreview\) return;/.test(body));
  check('ギフトと今の量の印を同じ取引で保存する', /saveStoredValuesOrRollback\(\[[\s\S]*key:'mh_gifts'[\s\S]*key:ASSISTANT_BOND_REWARDS_V2_KEY/.test(body));
  check('最初の量の印(v1)は読むだけで書かない', !/key:ASSISTANT_BOND_REWARDS_KEY\b/.test(body) && /storeGet\(ASSISTANT_BOND_REWARDS_KEY, null, false\)/.test(body));
  check('キーの名前', A.ASSISTANT_BOND_REWARDS_KEY === 'mh_assistant_bond_rewards_v1' && A.ASSISTANT_BOND_REWARDS_V2_KEY === 'mh_assistant_bond_rewards_v2');
  check('保存キーの資料に2つとも書いてある', saveSpec.includes('`mh_assistant_bond_rewards_v1`') && saveSpec.includes('`mh_assistant_bond_rewards_v2`'));
};
run().then(() => { wiring(); console.log(failed ? `\n${failed}件 NG` : '\nすべて OK'); process.exit(failed ? 1 : 0); })
  .catch(e => { console.error(e); process.exit(1); });
