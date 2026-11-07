// 助手ライフの道具(2人に贈る10種類)・好み(56-assistant-life-gifts.jsx・2026-11-08 社長 GIFT-PLAN.md)を確かめる。ブラウザは使わない。
//   node tools/assistant/assistant-life-gift-check.js
//   ① 表: 10種類・今の2つは id(peer_gift・peer_token)と上がる量(友情Lv +15/+30・仲良し度 +30/+25)がそのまま・名前は社長の選んだ新しい名前
//      持ち物・交換所(ビートP 150〜500P・印 assistantLife の後ろ)にそろっている
//   ② 好みの表: 8人それぞれ 好き3つ・苦手2つ・重なりなし・どの道具も好きな人が1人以上。社長の OK の表と同じ(GIFT-PLAN.md)
//   ③ 上がる量: 好き ×1.5・ふつう ×1・苦手 ×0.5(苦手でも必ず上がる)。友情Lv は2人の平均
//   ④ 回数: 同じ道具は1日1回・合わせて1日3回・朝4時(日が変わる)で戻る。🧺🤝 は前のキーにも書く(前の版と二重に使えない)
//   ⑤ 好み: 最初は ? / 贈ると2人とも分かる / 仲良し度の段が上がると、まだ分からない好きな物を1つ教えてくれる(全部分かったら何もしない)
//   ⑥ 保存: 新しいキー(mh_assistant_life_gift_day_v1・mh_assistant_life_likes_v1・mh_assistant_life_cheki_v1)に足すだけ。壊れた値でも空で読む
//   ⑦ 台詞: 仮の1行(8人×好き・ふつう・苦手)と教えてくれる1行がそろい、{item} が道具の名前に置きかわる/口調(みゅあ「ぢゃん」・あつの文末)/「子」・「ブリーダー」を書かない
//   ⑧ 印が偽のとき: 今までの2つ(🧺🤝)だけ・それぞれ1日1回
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const mem = {};
const writes = [];
const flags = { assistantPeer: true, assistantLife: true };
let dayNow = '2026-11-08';
const added = [];
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
  React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
  RELEASE_FLAGS: flags, __day: () => dayNow,
});
const load = (rel) => {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = rel.endsWith('.jsx') ? babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code : src;
  vm.runInContext(code, ctx);
};
load('monster-hero/data/assistants.js');
// 持ち物(breeder.js)と交換所(rhythm-event.js)から、道具の行だけを切り出して読む
const itemSrc = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8').match(/\{ id:'peer_[a-z]+'[\s\S]*?desc:"[^"]*" \}/g) || [];
const offerSrc = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-event.js'), 'utf8').split('\n').filter(l => /Object\.freeze\(\{ id:'peer_[a-z]+'/.test(l)).map(l => l.trim().replace(/,$/, ''));
vm.runInContext(`var BREEDER_MARKET_ITEMS = [${itemSrc.join(',')}]; var RHYTHM_EVENT_POINT_SHOP_OFFERS = [${offerSrc.join(',')}];`, ctx);
vm.runInContext('var assistantBubbleDayKey = () => __day(); var assistantPeerDayKey = () => __day(); var jstDayKey4 = () => __day(); var assistantById = (id) => ASSISTANTS.find(a => a.id === id);', ctx);
load('monster-hero/src/parts/56-assistant-peer.jsx');
load('monster-hero/src/parts/56-assistant-life.jsx');
load('monster-hero/src/parts/56-assistant-life-gifts.jsx');
const G = (expr) => vm.runInContext(expr, ctx);
G('assistantPeerSetPlayerBondAdder')((id, action, amount) => added.push(`${id}:${action}:${amount}`));

const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const GIFTS = G('ASSISTANT_LIFE_GIFTS');
const LIKES = G('ASSISTANT_LIFE_GIFT_LIKES');
const ITEMS = G('BREEDER_MARKET_ITEMS');
const OFFERS = G('RHYTHM_EVENT_POINT_SHOP_OFFERS');

(async () => {
  // ① 表
  check('① 道具は10種類・key と kind と itemId が重ならない', GIFTS.length === 10 && new Set(GIFTS.map(g => g.key)).size === 10 && new Set(GIFTS.map(g => g.kind)).size === 10 && new Set(GIFTS.map(g => g.itemId)).size === 10);
  const basket = GIFTS.find(g => g.key === 'basket'), misanga = GIFTS.find(g => g.key === 'misanga');
  check('① 今の2つは id・渡す名前・上がる量がそのまま(peer_gift/gift 友情Lv+15 仲良し度+30・peer_token/token +30 +25)',
    basket.itemId === 'peer_gift' && basket.kind === 'gift' && basket.peer === 15 && basket.player === 30 && misanga.itemId === 'peer_token' && misanga.kind === 'token' && misanga.peer === 30 && misanga.player === 25);
  const PA = G('ASSISTANT_PEER_BOND_ACTIONS'), BA = G('ASSISTANT_BOND_ACTIONS');
  check('① 前からの上がり方の表(gift・token・peerGift・peerToken)は変えていない', PA.gift.amount === 15 && PA.token.amount === 30 && BA.peerGift.amount === 30 && BA.peerToken.amount === 25);
  check('① 好みで変わる量の上限: 友情Lv lifeItem 1回45(30×1.5)・仲良し度 lifeGift 1回60(40×1.5)・1日3回ぶん',
    PA.lifeItem && PA.lifeItem.amount >= Math.max(...GIFTS.map(g => g.peer)) * 1.5 && PA.lifeItem.uncapped && PA.lifeItem.dailyMax >= PA.lifeItem.amount * 3
    && BA.lifeGift && BA.lifeGift.amount >= Math.max(...GIFTS.map(g => g.player)) * 1.5 && BA.lifeGift.dailyMax >= BA.lifeGift.amount * 3 && BA.lifeGift.releaseFlag === 'assistantLife');
  const it = (id) => ITEMS.find(x => x.id === id);
  check('① 名前は社長の選んだ新しい名前(おやつバスケット・おそろいのミサンガ)', it('peer_gift').name === 'おやつバスケット' && it('peer_token').name === 'おそろいのミサンガ');
  const missItem = GIFTS.filter(g => !it(g.itemId) || !it(g.itemId).name || !it(g.itemId).emoji || it(g.itemId).shop !== false);
  check('① 10種類とも持ち物にある(名前・絵・マーケットでは売らない)', !missItem.length, missItem.map(g => g.key).join(','));
  const off = (id) => OFFERS.find(o => o.itemId === id);
  const missOffer = GIFTS.filter(g => { const o = off(g.itemId); return !o || !(o.cost >= 150 && o.cost <= 500) || o.name !== it(g.itemId).name || o.emoji !== it(g.itemId).emoji; });
  check('① 10種類ともビートP交換所にある(150〜500P・名前と絵は持ち物と同じ)', !missOffer.length, missOffer.map(g => g.key).join(','));
  check('① 新しい8種類は公開の印 assistantLife の後ろ(今の2つは assistantPeer のまま)',
    GIFTS.filter(g => g.kind !== 'gift' && g.kind !== 'token').every(g => off(g.itemId).releaseFlag === 'assistantLife') && off('peer_gift').releaseFlag === 'assistantPeer' && off('peer_token').releaseFlag === 'assistantPeer');
  const PLAN = { basket: 200, misanga: 500, cake: 300, onigiri: 150, tea: 250, earphone: 400, puzzle: 350, sleeve: 400, cheki: 450, flower: 250 };
  const badCost = GIFTS.filter(g => off(g.itemId).cost !== PLAN[g.key]);
  check('① 値段は案の表のまま', !badCost.length, badCost.map(g => g.key).join(','));

  // ② 好みの表
  const keys = new Set(GIFTS.map(g => g.key));
  const badRow = IDS.filter(id => { const t = LIKES[id]; return !t || t.like.length !== 3 || t.bad.length !== 2 || t.like.some(k => t.bad.includes(k)) || [...t.like, ...t.bad].some(k => !keys.has(k)); });
  check('② 8人それぞれ 好き3つ・苦手2つ・重なりなし・知らない道具なし', !badRow.length, badRow.join(','));
  const noFan = [...keys].filter(k => !IDS.some(id => LIKES[id].like.includes(k)));
  check('② どの道具にも好きな助手が1人以上いる', !noFan.length, noFan.join(','));
  const OK_TABLE = { mua: 'misanga cake cheki/puzzle sleeve', kiki: 'tea puzzle flower/onigiri earphone', momosuke: 'cake earphone cheki/tea puzzle', dra: 'basket cake onigiri/puzzle flower',
    atsu: 'misanga onigiri earphone/tea flower', kyuko: 'tea earphone puzzle/basket cheki', sorashido: 'onigiri puzzle sleeve/tea flower', erubin: 'tea sleeve flower/cake earphone' };
  const diff = IDS.filter(id => `${LIKES[id].like.join(' ')}/${LIKES[id].bad.join(' ')}` !== OK_TABLE[id]);
  check('② 社長の OK の表と同じ(GIFT-PLAN.md・2026-11-08)', !diff.length, diff.join(','));

  // ③ 上がる量
  const amt = G('assistantLifeGiftAmounts');
  const a1 = amt('cake', ['mua', 'kiki']); // みゅあ 好き・きき ふつう
  check('③ 好き ×1.5・ふつう ×1(ケーキ: みゅあ +60・きき +40・友情Lv +25)', a1.player[0] === 60 && a1.player[1] === 40 && a1.peer === 25 && a1.likes.join() === 'like,mid');
  const a2 = amt('onigiri', ['kiki', 'momosuke']); // きき 苦手・ももすけ ふつう
  check('③ 苦手 ×0.5 でも必ず上がる(おにぎり: きき +13・ももすけ +25)', a2.player[0] === 13 && a2.player[1] === 25 && a2.peer > 0);
  const minAll = Math.min(...GIFTS.flatMap(g => IDS.map(id => amt(g.kind, [id, id === 'mua' ? 'kiki' : 'mua']).player[0])));
  check('③ どの道具・どの助手でも仲良し度は1以上上がる', minAll >= 1, String(minAll));

  // ④ 回数(印が真)
  const store = G('ASSISTANT_PEER_STORE'), gstore = G('ASSISTANT_LIFE_GIFT_STORE');
  store.state = { ...store.state, loaded: true, gift: null, bond: {}, bondDay: null }; store.loaded = true;
  const use = G('assistantPeerUseItem');
  const t1 = await use('cake', ['mua', 'kiki']);
  check('④ 贈ると2人のひとこと(仮の1行・{item} が名前に)・2人の仲良し度(lifeGift・好みの量)・友情Lv', t1 && t1.lines.length === 2 && t1.lines[0].t.includes('はんぶんこケーキ') && !t1.lines.some(l => l.t.includes('{item}'))
    && added.includes('mua:lifeGift:60') && added.includes('kiki:lifeGift:40') && store.state.bond['kiki-mua'] === 25, `${added.join(' ')} / ${store.state.bond['kiki-mua']}`);
  check('④ 同じ道具は1日1回(ほかの2人にも贈れない)', (await use('cake', ['dra', 'atsu'])) === null);
  check('④ 別の道具なら贈れる(2回目)', !!(await use('gift', ['dra', 'atsu'])));
  check('④ 🧺🤝 は前のキー(mh_assistant_peer_gift_v1)にも書く', mem.mh_assistant_peer_gift_v1 && mem.mh_assistant_peer_gift_v1.gift === 'atsu-dra');
  check('④ 3回目まで贈れる', !!(await use('tea', ['kiki', 'erubin'])));
  check('④ 合わせて1日3回まで(4回目は贈れない・理由が出る)', (await use('flower', ['kiki', 'erubin'])) === null && /3回/.test(G('assistantLifeGiftReason')('flower', store.state, 1)));
  dayNow = '2026-11-09';
  check('④ 次の日(朝4時の区切り)はまた贈れる', G('assistantLifeGiftReason')('cake', store.state, 1) === '' && G('assistantLifeGiftLeft')(store.state) === 3);
  // 前の版で今日もう 🧺 を使っていたら、今の版でも 🧺 は贈れない(二重に使えない)
  store.state = { ...store.state, gift: { day: '2026-11-09', gift: 'kiki-mua', token: null } };
  check('④ 前の版で今日 🧺 を使っていたら、🧺 は贈れず回数にも数える', G('assistantLifeGiftReason')('gift', store.state, 1) !== '' && G('assistantLifeGiftLeft')(store.state) === 2);
  check('④ 持っていないときの理由', /持っていません/.test(G('assistantLifeGiftReason')('cake', store.state, 0)));

  // ⑤ 好み
  const shown = G('assistantLifeGiftShownLike');
  check('⑤ 贈った2人の好みは分かる(みゅあ ケーキ=好き・きき ケーキ=ふつう)', shown('mua', 'cake') === 'like' && shown('kiki', 'cake') === 'mid');
  check('⑤ 贈っていない物は ?(みゅあ パズル)', shown('mua', 'puzzle') === 'unknown');
  const told = await G('assistantLifeGiftOnBondLevel')('mua', 5, () => 0);
  check('⑤ 仲良し度の段が上がると、まだ分からない好きな物を1つ教えてくれる(ケーキは分かっているので別の物)', told && told !== 'cake' && LIKES.mua.like.includes(told) && shown('mua', told) === 'like', String(told));
  const hint = G('assistantLifeGiftHintLine')('mua', told);
  check('⑤ 教えてくれた知らせは部屋のシートで見るまで残り、ひとことに道具の名前が入る', gstore.state.likes.told.some(x => x.who === 'mua' && x.key === told) && hint && !hint.t.includes('{item}') && !hint.t.includes('{name}'));
  G('assistantLifeGiftToldSeen')('mua');
  check('⑤ 見たら知らせは消える(分かった好みは残る)', !gstore.state.likes.told.some(x => x.who === 'mua') && shown('mua', told) === 'like');
  await G('assistantLifeGiftOnBondLevel')('mua', 6, () => 0);
  const r3 = await G('assistantLifeGiftOnBondLevel')('mua', 7, () => 0);
  check('⑤ 好きな物が全部分かったら、もう教えない', r3 === null && LIKES.mua.like.every(k => shown('mua', k) === 'like'));

  // ⑥ 保存
  const used = new Set(writes);
  check('⑥ 新しいキーに書く(gift_day・likes)', used.has('mh_assistant_life_gift_day_v1') && used.has('mh_assistant_life_likes_v1'));
  const allowed = new Set(['mh_assistant_life_gift_day_v1', 'mh_assistant_life_likes_v1', 'mh_assistant_life_cheki_v1', 'mh_assistant_peer_gift_v1', 'mh_assistant_peer_bond_v1', 'mh_assistant_peer_bond_day_v1',
    'mh_assistant_life_diary_v1', 'mh_assistant_life_v1', 'mh_assistant_life_play_v1']);
  const strange = [...used].filter(k => !allowed.has(k));
  check('⑥ ほかの既存キーは書きかえない', !strange.length, strange.join(','));
  await use('cheki', ['mua', 'momosuke']);
  check('⑥ チェキを撮った日はペアごとに残る(アルバムに出す)', Array.isArray(mem.mh_assistant_life_cheki_v1['momosuke-mua']) && mem.mh_assistant_life_cheki_v1['momosuke-mua'][0] === '2026-11-09');
  const nd = G('normalizeAssistantLifeGiftDay'), nl = G('normalizeAssistantLifeGiftLikes'), nc = G('normalizeAssistantLifeGiftCheki');
  const broken = [null, 'x', 3, [], { day: 5, used: 'a' }, { known: [1], told: 'x' }];
  check('⑥ 壊れた値でも空として読む', broken.every(v => { const d = nd(v), l = nl(v), c = nc(v); return typeof d.used === 'object' && typeof l.known === 'object' && Array.isArray(l.told) && typeof c === 'object'; }));
  const sd = fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8');
  check('⑥ 保存の一覧(SAVE_DATA.md)に3つのキーが書いてある', ['mh_assistant_life_gift_day_v1', 'mh_assistant_life_likes_v1', 'mh_assistant_life_cheki_v1'].every(k => sd.includes(k)));

  // ⑦ 台詞
  const TL = G('ASSISTANT_LIFE_GIFT_TEMP_LINES'), HT = G('ASSISTANT_LIFE_GIFT_HINT_TEMP');
  const allT = IDS.flatMap(id => ['like', 'mid', 'bad'].map(k => ({ id, k, ...(TL[id] || {})[k] }))).concat(IDS.map(id => ({ id, k: 'hint', ...(HT[id] || {}) })));
  check('⑦ 仮の1行が8人×好き・ふつう・苦手と、教えてくれる1行がそろう(表情は8つの中)', allT.every(x => x.t && x.t.includes('{item}') && ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'].includes(x.e)));
  check('⑦ 口調: みゅあは「じゃん」「まじ」を使わない・あつは文の最後に笑か記号', allT.filter(x => x.id === 'mua').every(x => !/じゃん|まじ/.test(x.t)) && allT.filter(x => x.id === 'atsu').every(x => /(笑|[！？!?…。])$/.test(x.t)));
  check('⑦ 「子」・「ブリーダー」を書かない・60字まで', allT.every(x => !/ブリーダー|(この|あの|その)子/.test(x.t) && x.t.length <= 60));
  check('⑦ 苦手のときも嫌がりすぎない(「いらない」「嫌い」を書かない)', allT.filter(x => x.k === 'bad').every(x => !/いらない|嫌い|最悪/.test(x.t)));

  // ⑧ 印が偽
  flags.assistantLife = false;
  const kinds = G('assistantLifeGiftKinds()').map(g => g.kind);
  check('⑧ 印が偽なら今までの2つ(🧺🤝)だけ', kinds.join() === 'gift,token');
  store.state = { ...store.state, gift: { day: dayNow, gift: 'kiki-mua', token: null } };
  check('⑧ 印が偽なら 🧺🤝 それぞれ1日1回(3回の決まりは無し)', /今日はもう使いました/.test(G('assistantLifeGiftReason')('gift', store.state, 1)) && G('assistantLifeGiftReason')('token', store.state, 1) === '');
  flags.assistantLife = true;

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
