// クリスマスのサンタ服の助手の顔アイコン販売(2026-11-28・台帳 r1126-096)を確かめる。
//
//   社長「顔アイコンの販売ないから出しといて」。ハロウィン(halloween-icon-check.js)と同じ仕様で、
//   8人(みゅあ・きき・ももすけ・ドラ・あつ・きゅうこ・ソラシド・えるびん)×8表情を売る。
//
// 見るもの
//   ① 8人×8表情の商品があり、ふだん・ハロウィンとは別のまとまり(mua_santa など)。ふだんのまとまりは変わらない
//   ② 売り場が時刻で切り替わる: 開始前は売らない / イベント中はビートP交換所の1000Pだけ / 終わったあとはブリーダーP交換所の1ptだけ
//      時刻はクリスマスの服と同じ定数(ASSISTANT_COSTUME_XMAS_START_AT・_END_AT)を読む
//   ③ ビートP交換: 8表情ぜんぶ入る・持っていれば交換できない・ポイント不足は断る・壊れた値で落ちない
//   ④ 絵はサンタ服の顔アイコン(images/assistant/santa/face/)で、ファイルが実在する。名前は16文字まで
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const breederSrc = read('monster-hero/data/breeder.js');
const constOf = (name) => (new RegExp(`const ${name} = '([^']+)'`).exec(breederSrc) || [])[1];
const START = constOf('ASSISTANT_COSTUME_XMAS_START_AT');
const END = constOf('ASSISTANT_COSTUME_XMAS_END_AT');

const load = (clock) => {
  const ctx = {};
  if (clock !== null) ctx.Date = { now: () => clock, parse: Date.parse };
  vm.createContext(ctx);
  const rhythm = read('monster-hero/data/rhythm-event.js');
  const start = rhythm.indexOf('const RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS');
  const end = rhythm.indexOf('// 近日公開予定の商品(交換ボタンは出さず');
  const pStart = rhythm.indexOf('const rhythmEventPointExchangePreview');
  const pEnd = rhythm.indexOf('// ===== 回数ボーナス');
  vm.runInContext([
    read('monster-hero/data/images/images-ally.js'),
    read('monster-hero/data/ally-monsters.js'),
    breederSrc,
    rhythm.slice(start, end),
    rhythm.slice(pStart, pEnd),
    'globalThis.__x={BREEDER_MARKET_ITEMS,BREEDER_ICON_GROUPS,expandOwnedMarketIcons,XMAS_ICON_SETS,xmasIconSale,halloweenIconSale,RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS,rhythmEventPointExchangePreview};',
  ].join('\n'), ctx);
  const x = ctx.__x;
  x.xmasOffers = x.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS.filter(o => /_santa$/.test(o.groupId));
  return x;
};

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const EXPR = ['normal', 'happy', 'wink', 'excited', 'surprise', 'troubled', 'angry', 'crying'];
const SETS = [['mua', 'myua', 'みゅあ'], ['kiki', 'kiki', 'きき'], ['momosuke', 'momosuke', 'ももすけ'], ['dra', 'dra', 'ドラ'],
  ['atsu', 'atsu', 'あつ'], ['kyuko', 'kyuko', 'きゅうこ'], ['sorashido', 'sorashido', 'ソラシド'], ['erubin', 'erubin', 'えるびん']];

check('期間の定数が読める(11/28 10:00〜12/31 4:00)', START === '2026-11-28T10:00:00+09:00' && END === '2026-12-31T04:00:00+09:00', `${START} 〜 ${END}`);

// ① まとまり
const now = load(Date.parse(START));
const base = load(Date.parse(START) - 1);
const idsOf = (g, key) => (g.BREEDER_ICON_GROUPS.find(x => x.id === key) || { memberIds: [] }).memberIds;
check('8人とも、クリスマスの8表情が別のまとまりになる', SETS.every(([a, p]) => idsOf(now, `${a}_santa`).join() === EXPR.map(k => `${p}_santa_${k}`).join()));
check('まとまりの名前が「◯◯（クリスマス）」', SETS.every(([a, , who]) => now.BREEDER_ICON_GROUPS.find(x => x.id === `${a}_santa`)?.name === `${who}（クリスマス）`));
check('ふだん・ハロウィンのまとまりに、クリスマスが混ざらない', now.BREEDER_ICON_GROUPS.filter(g => !/_santa$/.test(g.id)).every(g => !g.memberIds.some(id => /_santa_/.test(id))));
check('ふだんのまとまりの数は今までと同じ', ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin', 'mua_halloween'].map(k => idsOf(now, k).length).join() === '9,9,8,9,9,8,8,8,8',
  ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin', 'mua_halloween'].map(k => idsOf(now, k).length).join());
check('クリスマスを1つ持つと同じ人の8表情を全部持っていることになり、ふだんは持っていることにならない',
  (() => { const out = now.expandOwnedMarketIcons(['kyuko_santa_wink']); return EXPR.every(k => out.includes(`kyuko_santa_${k}`)) && !out.includes('kyuko_normal') && !out.some(id => /^myua_santa_/.test(id)); })());
check('ふだん・ハロウィンのアイコンを持っていても、クリスマスは持っていることにならない', !now.expandOwnedMarketIcons(['myua_normal', 'mua', 'myua_halloween_happy', 'atsu']).some(id => /_santa_/.test(id)));

// ② 売り場の切り替え
const last = load(Date.parse(END) - 1);
const after = load(Date.parse(END));
const items = (g) => g.BREEDER_MARKET_ITEMS.filter(i => i.type === 'icon' && /_santa_/.test(i.id));
check('商品は8人×8表情=64個で、1つ1pt', items(now).length === 64 && items(now).every(i => i.cost === 1));
check('id がほかの商品と重ならない', new Set(now.BREEDER_MARKET_ITEMS.map(i => i.id)).size === now.BREEDER_MARKET_ITEMS.length);
check('開始の前は、どこでも売らない', base.xmasIconSale() === null && items(base).every(i => i.shop === false) && base.xmasOffers.every(o => o.available === false));
check('イベント中は、ビートP交換所の1000Pだけで売る(ブリーダーP交換所には並ばない)', now.xmasIconSale() === 'beatPoint' && items(now).every(i => i.shop === false)
  && now.xmasOffers.length === 8 && now.xmasOffers.every(o => o.available === true && o.cost === 1000 && o.kind === 'icon' && o.memberIds.length === 8));
check('終了の直前(3:59:59)はまだビートP交換所', last.xmasIconSale() === 'beatPoint');
check('終了の時刻からは、ビートP交換所では売らず、ブリーダーP交換所の1ptで売る', after.xmasIconSale() === 'breederPoint'
  && items(after).every(i => i.shop !== false && i.cost === 1) && after.xmasOffers.every(o => o.available === false));
check('ハロウィンの売り方は変わらない(いまはブリーダーP交換所)', now.halloweenIconSale() === 'breederPoint');

// ③ ビートP交換
const offer = now.xmasOffers.find(o => o.groupId === 'atsu_santa');
const ex = (over = {}) => now.rhythmEventPointExchangePreview({ offer, eventPoints: 2500, ...over });
const ok = ex();
check('1000Pで交換でき、8表情ぜんぶ入る(ポイントは1000だけ減る)', ok.ok && ok.eventPoints === 1500 && EXPR.every(k => ok.ownedMarketIcons.includes(`atsu_santa_${k}`)));
check('持っているアイコンは残る(足すだけ)', ex({ ownedMarketIcons: ['atsu', 'atsu_normal'] }).ownedMarketIcons.slice(0, 2).join() === 'atsu,atsu_normal');
check('ふだんのあつのアイコンを持っていても交換できる', ex({ ownedMarketIcons: ['atsu', 'atsu_normal'] }).ok === true);
check('クリスマスを1つでも持っていれば交換できない(owned)', ex({ ownedMarketIcons: ['atsu_santa_crying'] }).reason === 'owned');
check('ポイントが足りないと断る(points)', ex({ eventPoints: 999 }).reason === 'points' && ex({ eventPoints: 1000 }).ok === true);
check('終わったあとの交換は断る(invalidOffer)', after.rhythmEventPointExchangePreview({ offer: after.xmasOffers[0], eventPoints: 5000 }).reason === 'invalidOffer');
check('壊れた持ち物でも落ちない', [ex({ ownedMarketIcons: 'x' }), ex({ ownedMarketIcons: null }), ex({ ownedMarketIcons: [1, null, {}] })].every(r => r.ok === true));

// ④ 絵と名前
const missing = items(now).filter(i => !fs.existsSync(path.join(ROOT, 'monster-hero', i.icon.split('?')[0])));
check('64個とも、絵の実ファイルがある', missing.length === 0, missing.map(i => i.icon).slice(0, 3).join(' '));
check('絵はサンタ服と同じ images/assistant/santa/face/ (別のファイルを作らない)', items(now).every(i => i.icon.startsWith('images/assistant/santa/face/')));
check('名前は16文字まで', items(now).every(i => [...i.name].length <= 16), items(now).filter(i => [...i.name].length > 16).map(i => i.name).join(' '));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed} 件失敗`);
process.exit(failed === 0 ? 0 : 1);
