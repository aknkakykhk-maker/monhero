// アイコンのまとめ売り(2026-10-03・ユーザー指示)を確かめる。
//
//   ユーザー指示「顔アイコンで表情別だったりで同じキャラのアイコンが数種類あると思うけど、販売ではそれは1つにまとめて
//   詳細で中身を見れるようにして / プロフィールで設定するときはそこで表情別に設定できる /
//   現在どれかでも持ってる人は全部持ってることになる」。
//
// 見るもの
//   ① まとめの決め方: 同じキャラ(助手の表情・モンスターの顔と円盤石・覚醒など)が1つにまとまり、1つしかないアイコンはまとまらない
//   ② どの商品もどれか1つのまとめにしか入らず、商品そのもの(id・名前・絵・値段)は変えていない
//   ③ ★持っているアイコンは「まとめの中身を全部持っている」形へ広げる。保存値は書き換えない(広げるだけ)。壊れた値は捨てる
//   ④ 画面のつなぎ: ショップは1キャラ1枚・詳細で中身・買うと全部入る・プロフィールは中身を1つずつ選べる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/ally-monsters.js'),
  read('monster-hero/data/breeder.js'),
  'globalThis.__x={BREEDER_MARKET_ITEMS,BREEDER_ICON_GROUPS,breederIconGroupOf,expandOwnedMarketIcons};',
].join('\n'), ctx);
const { BREEDER_MARKET_ITEMS: items, BREEDER_ICON_GROUPS: groups, breederIconGroupOf: groupOf, expandOwnedMarketIcons: expand } = ctx.__x;

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const idsOf = (key) => (groups.find(g => g.id === key) || { memberIds: [] }).memberIds;

// ① まとめの決め方
check('助手の表情アイコンが、キャラごとにまとまる(みゅあ・きき・ももすけ・ドラ)',
  ['mua', 'kiki', 'momosuke', 'dra'].every(key => idsOf(key).length >= 8), ['mua', 'kiki', 'momosuke', 'dra'].map(k => `${k}:${idsOf(k).length}`).join(' '));
check('みゅあは、前からあるアイコン(mua)と表情8種(myua_*)が同じまとまり', idsOf('mua').includes('mua') && idsOf('mua').filter(id => /^myua_/.test(id)).length === 8);
check('ききは、前からあるアイコン(kiki_icon)と表情8種(kiki_*)が同じまとまり', idsOf('kiki').includes('kiki_icon') && idsOf('kiki').filter(id => /^kiki_(?!icon)/.test(id)).length === 8);
check('モンスターは、顔のアイコンと円盤石アイコンが同じまとまり',
  ['undine', 'yaobikuni', 'plant', 'mia', 'pandora', 'eiki', 'kenshi_mocchi', 'yggdrasil', 'mel_whip']
    .every(key => idsOf(key).join() === `${key}_icon,${key}_disc_icon`), groups.map(g => g.id).join(','));
check('スネグーラチカは、通常と覚醒が同じまとまり', idsOf('snegurochka').join() === 'snegurochka_icon,snegurochka_awakened_icon');
check('1つしかないアイコンはまとまらない(ポルツ・ザンなど)', groupOf('poltz_icon') === null && groupOf('zan_icon') === null && groupOf('oryo') === null);
check('まとまりは2つ以上の中身を持つ', groups.every(g => g.memberIds.length >= 2));
check('まとまりに名前が付いている(「◯◯のアイコン」と出せる)', groups.every(g => typeof g.name === 'string' && g.name.length > 0 && !/アイコン/.test(g.name)), groups.map(g => g.name).join(','));

// ② 商品そのものは変えていない
const iconItems = items.filter(i => i.type === 'icon');
const inGroups = groups.flatMap(g => g.memberIds);
check('どの商品も、どれか1つのまとまりにしか入らない', new Set(inGroups).size === inGroups.length);
check('まとまりの中身は、実在するアイコン商品だけ', inGroups.every(id => iconItems.some(i => i.id === id)));
check('アイコン商品のid・値段は今までどおり(全部1pt)', iconItems.every(i => i.cost === 1));

// ③ 持っているアイコンを広げる
const one = expand(['undine_icon']);
check('円盤石アイコンだけ持っていても、顔のアイコンも持っていることになる', expand(['undine_disc_icon']).includes('undine_icon') && expand(['undine_disc_icon']).includes('undine_disc_icon'));
check('顔のアイコンを持っていれば、円盤石アイコンも持っていることになる', one.includes('undine_disc_icon'));
check('助手の表情は、どれか1つで8種ぜんぶ', expand(['myua_wink']).filter(id => /^myua_/.test(id)).length === 8 && expand(['myua_wink']).includes('mua'));
check('別のキャラは巻き込まない', !one.includes('yaobikuni_icon') && !one.includes('mia_icon'));
check('まとまらないアイコンは、そのまま', expand(['zan_icon']).join() === 'zan_icon');
check('持っていなければ空のまま', expand([]).length === 0 && expand(undefined).length === 0 && expand(null).length === 0);
check('壊れた値(文字列でない・配列でない)は捨てる', expand(['undine_icon', 5, null, {}]).every(id => typeof id === 'string') && expand('undine_icon').length === 0);
check('広げても重複しない', new Set(expand(['undine_icon', 'undine_disc_icon', 'undine_icon'])).size === expand(['undine_icon', 'undine_disc_icon', 'undine_icon']).length);
const input = ['undine_icon'];
expand(input);
check('広げても、元の配列(保存値)は書き換えない', input.length === 1 && input[0] === 'undine_icon');

// ④ 画面のつなぎ
const app = read('monster-hero/src/parts/60-app.jsx');
const market = read('monster-hero/src/parts/55-screen-breeder-market.jsx');
const widgets = read('monster-hero/src/parts/20-market-notices-help.jsx');
check('ショップは、同じキャラを1枚の商品カードにまとめて出す',
  market.includes('breederIconGroupOf(item.id)') && market.includes('groupMembers:members'));
check('「詳細」でまとめの中身を見られる', market.includes('item.groupMembers?<MarketDetailChip') && widgets.includes('data-market-icon-group={item.groupId}'));
check('円盤石アイコンのタブは、中身が無ければ出さない', market.includes('hasDiscIconCards?[{key:\'disc\',label:\'円盤石アイコン\'}]:[]'));
check('持っている判定は、まとめの中身を全部持っている形へ広げてから見る', app.includes('return expandOwnedMarketIcons(ownedMarketIcons).includes(item.id);'));
check('買うと、まとめの中身が全部 mh_market_icons に入る', /breederIconGroupOf\(item\.id\)[\s\S]{0,200}group\.memberIds[\s\S]{0,100}storeSet\('mh_market_icons', next, false\)/.test(app));
check('プロフィールのアイコン選択は、広げた持ち物から中身を1つずつ並べる', app.includes('breederIconOptions({ownedMarketIconIds:expandOwnedMarketIcons(ownedMarketIcons)})'));
check('新しい保存キーを増やしていない(mh_market_icons のまま)', !/mh_market_icon_group|mh_icon_group/.test(app + read('monster-hero/data/breeder.js')));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
