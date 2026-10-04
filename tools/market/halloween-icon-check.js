// ハロウィン・ナイトの衣装のアイコン販売(2026-10-04)を確かめる。
//
//   ユーザー指示「みゅあ、きき、もものアイコンの販売。ハロウィンみたいな名称。同じキャラだけど通常のみゅあとかとは
//   混ぜずに販売。ただし表情とかはまとめる。ブリーダーポイント1(イベント後販売)、ビートポイント1000」。
//
// 見るもの
//   ① 3キャラ×8表情の商品があり、通常のアイコンとは別のまとまり(mua_halloween など)になる。通常のまとまりは変わらない
//   ② 売り場が時刻で切り替わる: 開始前は売らない / イベント中はビートP交換所の1000Pだけ / 終わったあとはブリーダーP交換所の1ptだけ
//   ③ ビートP交換: 8表情ぜんぶ入る・持っていれば交換できない(通常のアイコンを持っていても影響しない)・ポイント不足は断る・壊れた値で落ちない
//   ④ 絵は衣装の顔アイコンで、ファイルが実在する。新しい保存キーを増やさない
//   ⑤ 画面・処理のつなぎ
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const jst = (text) => Date.parse(text);
const START = '2026-10-04T08:00:00+09:00';
const END = '2026-11-01T04:00:00+09:00';

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
    read('monster-hero/data/breeder.js'),
    rhythm.slice(start, end),
    rhythm.slice(pStart, pEnd),
    'globalThis.__x={BREEDER_MARKET_ITEMS,BREEDER_ICON_GROUPS,breederIconGroupOf,expandOwnedMarketIcons,HALLOWEEN_ICON_SETS,halloweenIconSale,RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS,rhythmEventPointExchangePreview};',
  ].join('\n'), ctx);
  return ctx.__x;
};

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const EXPR = ['normal', 'happy', 'wink', 'excited', 'surprise', 'troubled', 'angry', 'crying'];
const SETS = [['mua', 'myua', 'みゅあ'], ['kiki', 'kiki', 'きき'], ['momosuke', 'momosuke', 'ももすけ']];

// ① まとまり
const now = load(jst(START));
const idsOf = (g, key) => (g.BREEDER_ICON_GROUPS.find(x => x.id === key) || { memberIds: [] }).memberIds;
check('3キャラとも、ハロウィンの8表情が別のまとまりになる', SETS.every(([a, p]) => idsOf(now, `${a}_halloween`).join() === EXPR.map(k => `${p}_halloween_${k}`).join()));
check('まとまりの名前が「◯◯（ハロウィン）」', SETS.every(([a, , who]) => now.BREEDER_ICON_GROUPS.find(x => x.id === `${a}_halloween`)?.name === `${who}（ハロウィン）`));
check('通常のアイコンのまとまりに、ハロウィンが混ざらない', SETS.every(([a]) => !idsOf(now, a).some(id => /_halloween_/.test(id))) && idsOf(now, 'mua').length === 9 && idsOf(now, 'kiki').length === 9 && idsOf(now, 'momosuke').length === 8);
check('ハロウィンを1つ持っていると、同じ表情違いは全部持っていることになり、通常のアイコンは持っていることにならない',
  (() => { const out = now.expandOwnedMarketIcons(['myua_halloween_wink']); return EXPR.every(k => out.includes(`myua_halloween_${k}`)) && !out.includes('myua_normal') && !out.includes('mua'); })());
check('通常のアイコンを持っていても、ハロウィンは持っていることにならない', !now.expandOwnedMarketIcons(['myua_normal', 'mua']).some(id => /_halloween_/.test(id)));

// ② 売り場の切り替え
const before = load(jst(START) - 1);
const during = load(jst(START));
const last = load(jst(END) - 1);
const after = load(jst(END));
const halloweenItems = (g) => g.BREEDER_MARKET_ITEMS.filter(i => i.type === 'icon' && /_halloween_/.test(i.id));
check('商品は3キャラ×8表情=24個で、1つ1pt', halloweenItems(now).length === 24 && halloweenItems(now).every(i => i.type === 'icon' && i.cost === 1));
check('開始の前は、どこでも売らない', before.halloweenIconSale() === null && halloweenItems(before).every(i => i.shop === false) && before.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS.every(o => o.available === false));
check('イベント中は、ビートP交換所の1000Pだけで売る(ブリーダーP交換所には並ばない)', during.halloweenIconSale() === 'beatPoint' && halloweenItems(during).every(i => i.shop === false)
  && during.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS.length === 3 && during.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS.every(o => o.available === true && o.cost === 1000 && o.kind === 'icon'));
check('終了の直前(3:59:59)はまだビートP交換所', last.halloweenIconSale() === 'beatPoint');
check('終了の時刻からは、ビートP交換所では売らず、ブリーダーP交換所の1ptで売る', after.halloweenIconSale() === 'breederPoint'
  && halloweenItems(after).every(i => i.shop !== false && i.cost === 1) && after.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS.every(o => o.available === false));

// ③ ビートP交換
const offer = during.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS.find(o => o.groupId === 'mua_halloween');
const ex = (over = {}) => during.rhythmEventPointExchangePreview({ offer, eventPoints: 2500, ...over });
const ok = ex();
check('1000Pで交換でき、8表情ぜんぶ入る(ポイントは1000だけ減る)', ok.ok && ok.eventPoints === 1500 && ok.ownedMarketIcons.length === 8 && EXPR.every(k => ok.ownedMarketIcons.includes(`myua_halloween_${k}`)), JSON.stringify(ok).slice(0, 80));
check('持っているアイコンは残る(足すだけ)', ex({ ownedMarketIcons: ['mua', 'myua_normal'] }).ownedMarketIcons.slice(0, 2).join() === 'mua,myua_normal');
check('通常のみゅあのアイコンを持っていても、ハロウィンは交換できる', ex({ ownedMarketIcons: ['mua', 'myua_normal'] }).ok === true);
check('ハロウィンを1つでも持っていれば、交換できない(owned)', ex({ ownedMarketIcons: ['myua_halloween_crying'] }).reason === 'owned');
check('ポイントが足りないと断る(points)', ex({ eventPoints: 999 }).reason === 'points' && ex({ eventPoints: 1000 }).ok === true);
check('終わったあとの交換は断る(invalidOffer)', after.rhythmEventPointExchangePreview({ offer: after.RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS[0], eventPoints: 5000 }).reason === 'invalidOffer');
check('壊れた持ち物(文字列・null・数値の混ざった配列)でも落ちない', [ex({ ownedMarketIcons: 'x' }), ex({ ownedMarketIcons: null }), ex({ ownedMarketIcons: [1, null, {}] })].every(r => r.ok === true));

// ④ 絵と保存
const missing = halloweenItems(now).filter(i => !fs.existsSync(path.join(ROOT, 'monster-hero', i.icon.split('?')[0])));
check('24個とも、衣装の顔アイコンの実ファイルがある', missing.length === 0, missing.map(i => i.icon).slice(0, 3).join(' '));
check('絵は衣装と同じ images/assistant/halloween/face/ (別のファイルを作らない)', halloweenItems(now).every(i => i.icon.startsWith('images/assistant/halloween/face/')));
const app = read('monster-hero/src/parts/60-app.jsx');
const saveSpec = read('docs/spec/SAVE_DATA.md');
check('保存は既存の mh_market_icons だけ(新しいキーを作らない)', /isIcon \? \[\{ key:'mh_market_icons'/.test(app));

// ⑤ つなぎ
const market = read('monster-hero/src/parts/55-screen-breeder-market.jsx');
check('ビートP交換所に「アイコン」タブが、並べられるときだけ出る', /RHYTHM_EVENT_POINT_SHOP_ICON_OFFERS\.some\(offer=>offer\.available!==false\)\?\[\{key:'icon',label:'アイコン'\}\]/.test(market));
check('交換の処理が、保存を読み直してから同じ取引で書く', /const storedIcons = isIcon \? await storeGet\('mh_market_icons'/.test(app) && /expandOwnedMarketIcons\(beforeIcons\)/.test(app));
check('SAVE_DATA.md の mh_market_icons に、ビートP交換でも入ることが書いてある', /mh_market_icons[^\n]*ビートP/.test(saveSpec));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed} 件失敗`);
process.exit(failed === 0 ? 0 : 1);
