// 助手の仲良し度の節目のごほうび(Lv22・25・28・30。2026-10-21)を確かめる。
//
// 見るもの
//   ① 表の中身(社長の決定どおり)と、ギフトとして読めること
//   ② 組み立て(buildAssistantBondRewardGrant): 越えた節目だけ・助手ごとに1回・印があれば二重に届かない
//   ③ 本体の届ける処理を取り出して、保存の上で実際に動かす
//      ・上のLvの人は、起動時に越えた節目のぶんがまとめて届く
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
const bondNames = ['normalizeAssistantBond', 'assistantBondLevelOf', 'ASSISTANT_BOND_REWARDS_KEY', 'normalizeAssistantBondRewardsDelivered', 'assistantBondRewardGiftId', 'buildAssistantBondRewardGrant'];
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
this.out = { ASSISTANTS, ASSISTANT_BOND_LEVELS, ASSISTANT_BOND_LEVEL_REWARDS, normalizeGiftRewards, grantGiftOnce,
  ASSISTANT_BOND_REWARDS_KEY, normalizeAssistantBondRewardsDelivered, buildAssistantBondRewardGrant, assistantBondLevelOf,
  normalizeAssistantBond, saveStoredValuesOrRollback };`, ctx);
const A = ctx.out;
const ids = A.ASSISTANTS.map(a => a.id);
const needOf = (lv) => A.ASSISTANT_BOND_LEVELS.find(s => s.level === lv).need;

// ① 表
{
  const T = A.ASSISTANT_BOND_LEVEL_REWARDS;
  const want = {
    22: [{ type:'diamond', amount:50000 }, { type:'rainbowPsyche', amount:30 }],
    25: [{ type:'rainbowTranscendFruit', amount:5 }, { type:'gameItem', itemId:'hero_proof_shard', amount:10 }],
    28: [{ type:'gameItem', itemId:'hero_proof', amount:1 }, { type:'diamond', amount:100000 }],
    30: [{ type:'gameItem', itemId:'soul_crystal', amount:3 }, { type:'gameItem', itemId:'hero_proof', amount:2 }, { type:'diamond', amount:200000 }],
  };
  check('節目は Lv22・25・28・30', Object.keys(T).join() === '22,25,28,30', Object.keys(T).join());
  check('中身は決定どおり', JSON.stringify(T) === JSON.stringify(want));
  check('どの節目もギフトとして読める', Object.values(T).every(r => !!A.normalizeGiftRewards({ rewards: r })));
  check('節目は上限(Lv30)以内', Object.keys(T).every(lv => Number(lv) <= A.ASSISTANT_BOND_LEVELS[A.ASSISTANT_BOND_LEVELS.length - 1].level));
  check('助手は4人', ids.join() === 'mua,kiki,momosuke,dra', ids.join());
}
// ② 組み立て
{
  const B = A.buildAssistantBondRewardGrant;
  const none = B({ gifts: [], delivered: null, levels: { mua: 21, kiki: 5 } });
  check('Lv21以下なら何も届かない', !none.changed && none.gifts.length === 0);
  const r = B({ gifts: [], delivered: null, levels: { mua: 30, kiki: 25, momosuke: 22, dra: 1 } });
  const giftIds = r.gifts.map(g => g.id).sort();
  check('越えた節目のぶんがまとめて届く(みゅあ4・きき2・ももすけ1)', r.gifts.length === 7 && r.granted.length === 7, giftIds.join(','));
  check('印も同じだけ付く', JSON.stringify(r.delivered) === JSON.stringify({ mua: [22, 25, 28, 30], kiki: [22, 25], momosuke: [22] }), JSON.stringify(r.delivered));
  check('ギフトのidは助手と節目で決まる', giftIds.includes('gift_assistant_bond_mua_lv30') && giftIds.includes('gift_assistant_bond_kiki_lv25'));
  check('題名に助手の名前とLvが入る', r.gifts.some(g => g.title === 'みゅあとの仲良し度 Lv30 のごほうび'));
  check('期限なし・未受取', r.gifts.every(g => g.expiresAt == null && g.claimedAt === null));
  const again = B({ gifts: r.gifts, delivered: r.delivered, levels: { mua: 30, kiki: 25, momosuke: 22 } });
  check('印があれば二重に届かない', !again.changed && again.gifts.length === 7);
  const afterClaim = B({ gifts: [], delivered: r.delivered, levels: { mua: 30, kiki: 25, momosuke: 22 } });
  check('ギフトが一覧から消えていても、印があれば届かない', !afterClaim.changed && afterClaim.gifts.length === 0);
  const noMark = B({ gifts: r.gifts, delivered: null, levels: { mua: 30 } });
  check('ギフトが残っていて印だけ無いときは、増やさず印だけ付ける', noMark.changed && noMark.granted.length === 0 && noMark.gifts.length === 7
    && JSON.stringify(noMark.delivered.mua) === '[22,25,28,30]');
  const up = B({ gifts: r.gifts, delivered: r.delivered, levels: { mua: 30, kiki: 28, momosuke: 22 } });
  check('Lvが上がった節目のぶんだけ増える', up.granted.length === 1 && up.granted[0].assistantId === 'kiki' && up.granted[0].level === 28);
  const broken = A.normalizeAssistantBondRewardsDelivered({ mua: ['22', 'x', 22, -1], kiki: 'no', zz: [] });
  check('壊れた印は読める形に直す', JSON.stringify(broken) === '{"mua":[22]}', JSON.stringify(broken));
  check('印が配列や文字でも壊れない', B({ gifts: null, delivered: [1, 2], levels: { mua: 22 } }).gifts.length === 1
    && B({ gifts: 'x', delivered: 'x', levels: { mua: 22 } }).gifts.length === 1);
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
      const { normalizeAssistantBond, assistantBondLevelOf, buildAssistantBondRewardGrant, saveStoredValuesOrRollback, ASSISTANT_BOND_REWARDS_KEY } = A;
      const ASSISTANT_LIST = A.ASSISTANTS;
      const onboardingPreview = false;
      const useCallback = (f) => f;
      const assistantBondRewardRunningRef = { current:false };
      const assistantBondRewardAgainRef = { current:false };
      const assistantBondsRef = { current:{} };
      const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
      const storeGet = async (k, d) => (k in store ? clone(store[k]) : d);
      const storeSet = async (k, v) => { if (${failSave} && k === ASSISTANT_BOND_REWARDS_KEY && v !== null && Object.keys(v).length) { store[k] = { broken:true }; return; } store[k] = clone(v); };
      const setGifts = (g) => setGiftsCalls.push(g.length);
      ${body}
      this.api = { deliver: deliverAssistantBondRewards, bonds: assistantBondsRef, running: assistantBondRewardRunningRef };`, c);
    return c;
  };
  // 上のLvの人が起動した
  const store = { mh_gifts: [{ id: 'gift_login_x', title: 'ログイン', rewards: [{ type: 'diamond', amount: 1 }] }] };
  const c = makeApp(store);
  c.api.bonds.current = { mua: { points: needOf(30) + 999 }, kiki: { points: needOf(25) }, momosuke: { points: needOf(22) - 1 }, dra: { points: 0 } };
  await c.api.deliver();
  const got = (store.mh_gifts || []).filter(g => String(g.id).startsWith('gift_assistant_bond_')).map(g => g.id).sort();
  check('起動時に越えた節目のぶんがまとめて届く(みゅあ4・きき2・ももすけはLv21なので無し)', got.length === 6 && !got.some(id => id.includes('momosuke')), got.join(','));
  check('今までのギフトは残る', store.mh_gifts.some(g => g.id === 'gift_login_x'));
  check('印が保存される', JSON.stringify(store.mh_assistant_bond_rewards_v1) === JSON.stringify({ mua: [22, 25, 28, 30], kiki: [22, 25] }), JSON.stringify(store.mh_assistant_bond_rewards_v1));
  check('画面のギフト一覧も更新する', c.setGiftsCalls.length === 1 && c.setGiftsCalls[0] === 7);
  await c.api.deliver();
  await c.api.deliver();
  check('何度呼んでも二重に届かない', store.mh_gifts.filter(g => String(g.id).startsWith('gift_assistant_bond_')).length === 6 && c.setGiftsCalls.length === 1);
  store.mh_gifts = store.mh_gifts.filter(g => !String(g.id).startsWith('gift_assistant_bond_'));
  await c.api.deliver();
  check('受け取ってギフトが一覧から消えても、二度目は届かない', !store.mh_gifts.some(g => String(g.id).startsWith('gift_assistant_bond_')));
  // Lvが上がった(ももすけが22へ)
  c.api.bonds.current = { ...c.api.bonds.current, momosuke: { points: needOf(22) } };
  await Promise.all([c.api.deliver(), c.api.deliver()]);
  const momo = store.mh_gifts.filter(g => g.id === 'gift_assistant_bond_momosuke_lv22');
  check('Lvが上がると、その節目だけ1回届く(同時に呼ばれても1つ)', momo.length === 1, String(momo.length));
  check('走り終わったら次も呼べる', c.api.running.current === false);
  // 保存に失敗した
  const store2 = { mh_gifts: [] };
  const c2 = makeApp(store2, { failSave: true });
  c2.api.bonds.current = { mua: { points: needOf(30) } };
  await c2.api.deliver();
  check('保存に失敗したらギフトも印も元のまま', Array.isArray(store2.mh_gifts) && store2.mh_gifts.length === 0
    && store2.mh_assistant_bond_rewards_v1 == null && c2.setGiftsCalls.length === 0, JSON.stringify(store2));
};
// ④ つなぎ
const wiring = () => {
  const fAt = app.indexOf('const addAssistantBondFor = useCallback(');
  const fBody = app.slice(fAt, app.indexOf('\n  }, [', fAt) + 60);
  check('Lvが上がったときに届ける', /if \(after > before\) void deliverAssistantBondRewards\(\);/.test(fBody));
  check('起動が済んだら届ける', /useEffect\(\(\) => \{ if \(dataLoaded\) void deliverAssistantBondRewards\(\); \}, \[dataLoaded, deliverAssistantBondRewards\]\);/.test(app));
  check('届ける処理は Lv の処理より前に書いてある(使う前に作る)', at >= 0 && at < fAt);
  check('「見るだけ」のプレビュー中は届けない', /if \(onboardingPreview\) return;/.test(body));
  check('ギフトと印を同じ取引で保存する', /saveStoredValuesOrRollback\(\[[\s\S]*key:'mh_gifts'[\s\S]*key:ASSISTANT_BOND_REWARDS_KEY/.test(body));
  check('新しいキー mh_assistant_bond_rewards_v1', A.ASSISTANT_BOND_REWARDS_KEY === 'mh_assistant_bond_rewards_v1');
  check('保存キーの資料に書いてある', saveSpec.includes('`mh_assistant_bond_rewards_v1`'));
};
run().then(() => { wiring(); console.log(failed ? `\n${failed}件 NG` : '\nすべて OK'); process.exit(failed ? 1 : 0); })
  .catch(e => { console.error(e); process.exit(1); });
