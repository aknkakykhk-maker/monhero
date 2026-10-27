// アシカ「ソラシドの自動化」(copy_sorashido・2026-10-27 社長の決定)のデータと、AIコピーの計算(32-sorashido-copy.jsx)を確かめる。
//
//   node tools/battle/sorashido-copy-check.js
//
// 見ること:
//   ・カード・段階の名前・効果量の表・マーケット(公開の印とお話を見たあとだけ・150,000)・ヘイト(強めると同じ)・ヘルプ(公開の印で隠す)
//   ・コピーの強さ(Lv1 50/60/50/60%・Lv2 70/80/70/80%・Lv3 80/90/80/90%。ライフはタクティクスだけ。EXTREME では半分)
//   ・続くターン 2→3→4、もう一度使うと最初へ戻る、別の子なら切りかわる(前の固有技を抜き、新しい固有技を1枚足す)
//   ・タクティクスの🔥(出たときは元の子の 50/75/100%・たまり方 ×1.0/1.25/1.5)
//   ・コピーの固有技は山札・手札・墓地のどこからでも抜ける
//   ・コピーの手札(山札は減らさない・距離技とソラシドは選ばない)と使うカード(いちばん点の高いものを見込みで選ぶ・Lv3 は条件つきで2枚)
//   ・保存キーを増やしていない
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- データ(data/breeder.js) ----
const breeder = read('monster-hero/data/breeder.js');
const grabArray = (name) => { const i = breeder.indexOf(`const ${name} = `); return breeder.slice(i, breeder.indexOf('\n];', i) + 3).replace(/^const /, 'var '); };
const ctx = { console, Math, JSON, Object, Array, Number, String };
vm.createContext(ctx);
vm.runInContext(`${grabArray('SORASHIDO_TIERS')}
${breeder.slice(breeder.indexOf('let sorashidoJoinSeenForShop'), breeder.indexOf('const BREEDER_MARKET_ITEMS'))}
var BREEDER_EVO_NAMES = ${breeder.slice(breeder.indexOf('const BREEDER_EVO_NAMES = ') + 'const BREEDER_EVO_NAMES = '.length, breeder.indexOf('};', breeder.indexOf('const BREEDER_EVO_NAMES = ')) + 1)};
${read('monster-hero/src/parts/32-sorashido-copy.jsx')}
globalThis.__s = { SORASHIDO_TIERS, BREEDER_EVO_NAMES, setSorashidoJoinSeenForShop, sorashidoCardOnSale, teachingCardReleased,
  aiCopyRules, aiCopyTurns, aiCopyStats, aiCopyStartHate, aiCopyHateGainMult, aiCopySummonPlan, aiCopyTurnEnd,
  aiCopyUniqueCard, aiCopyRemoveUnique, aiCopyCanPick, aiCopyHand, aiCopyPickCards, sorashidoCopyDesc,
  SORASHIDO_COPY_SLOT, SORASHIDO_COPY_UNIQUE_COUNT, SORASHIDO_COPY_HAND_DRAW };`, ctx);
const s = ctx.__s;

check('段階の名前は 自動化 → 全自動 → 無人運転', JSON.stringify(s.BREEDER_EVO_NAMES.sorashido) === JSON.stringify(['ソラシドの自動化', 'ソラシドの全自動', 'ソラシドの無人運転']));
check('効果量の表は社長の決定どおり(強さ・続くターン 2→3→4・選ぶ見込み 50→65→80%・枚数・🔥)', JSON.stringify(s.SORASHIDO_TIERS) === JSON.stringify([
  { rates: { hp: 0.5, atk: 0.6, def: 0.5, guts: 0.6 }, turns: 2, pick: 0.5, maxCards: 1, hateStart: 0.5, hateGain: 1.0, uniqueRate: 0.3 },
  { rates: { hp: 0.7, atk: 0.8, def: 0.7, guts: 0.8 }, turns: 3, pick: 0.65, maxCards: 1, hateStart: 0.75, hateGain: 1.25, uniqueRate: 0.4 },
  { rates: { hp: 0.8, atk: 0.9, def: 0.8, guts: 0.9 }, turns: 4, pick: 0.8, maxCards: 2, hateStart: 1.0, hateGain: 1.5, gutsFor2: 120, uniqueRate: 0.5 },
]));
check('カードはガッツ20・公開の印 assistantSorashido・はじめから持つカードではない',
  /\{ id:'sorashido', baseName:"ソラシドの自動化", icon:SORASHIDO_FACE_ICON, type:'buff', subType:'copy_sorashido',[^\n]*guts:20, releaseFlag:'assistantSorashido' \}/.test(breeder)
  && !/STARTER_TEACHING_IDS = \[[^\]]*'sorashido'/.test(breeder));
check('マーケットに 150000 で置く', /\{ id:'sorashido', name:"アシストカード「ソラシド」", type:'assist', icon:SORASHIDO_FACE_ICON, cost:150000,/.test(breeder));
ctx.RELEASE_FLAGS = { assistantSorashido: false }; s.setSorashidoJoinSeenForShop(true);
const offUnreleased = s.sorashidoCardOnSale() === false && s.teachingCardReleased({ releaseFlag: 'assistantSorashido' }) === false;
ctx.RELEASE_FLAGS = { assistantSorashido: true }; s.setSorashidoJoinSeenForShop(false);
const offBeforeStory = s.sorashidoCardOnSale() === false;
s.setSorashidoJoinSeenForShop(true);
check('マーケットに並ぶのは、公開の印が立ち、加入のお話を見たあとだけ', offUnreleased && offBeforeStory && s.sorashidoCardOnSale() === true && s.teachingCardReleased({ releaseFlag: 'assistantSorashido' }) === true);
check('公開の印が無いアシカは、いつも出す', s.teachingCardReleased({ id: 'kyuko' }) === true);
const tac = read('monster-hero/src/parts/32-tactics-units.jsx');
check('ヘイトはアシカを使ったとき「強める」と同じ(assist の buff)', /assist: \{[^}]*sorashido: 'buff'/.test(tac) && /action: \{[^}]*buff: 5[,\s]/.test(tac));
const help = read('monster-hero/data/help.js');
check('ヘルプの説明は公開の印 assistantSorashido で出し入れする', /\{ t:'note', releaseFlag:'assistantSorashido', title:'ソラシドの自動化・全自動・無人運転'/.test(help));
const helpPart = read('monster-hero/src/parts/20-market-notices-help.jsx');
check('ヘルプの「ブリーダーの教え」の表は、公開前のアシカを出さない', /filter\(card => typeof teachingCardReleased !== 'function' \|\| teachingCardReleased\(card\)\)/.test(helpPart));
const app = read('monster-hero/src/parts/60-app.jsx');
check('説明文(getDynamicDesc)はこの表から作る', /if\(t\.id==='sorashido'\) return sorashidoCopyDesc\(level\);/.test(app));
// MFバトルカードには、助手ソラシドが対戦相手として出る(カード部・2026-10-27)。入れないのはアシカの効果(AIコピー)のほう
const cardParts = fs.readdirSync(path.join(ROOT, 'monster-hero/src/parts')).filter((f) => /^(8\d|9\d)-card/.test(f)).map((f) => read(`monster-hero/src/parts/${f}`)).join('\n');
check('MFバトルカードにはアシカの効果(AIコピー)を入れない', cardParts.length > 0 && !/copy_sorashido|aiCopy[A-Z]/.test(cardParts));
const copySrc = read('monster-hero/src/parts/32-sorashido-copy.jsx');
check('保存しない(storeGet・storeSet・localStorage を使わない)', !/storeGet|storeSet|localStorage/.test(copySrc));

// ---- 強さ ----
const src = { maxHp: 1000, atk: 200, def: 100, maxGuts: 300 };
const st0 = s.aiCopyStats(src, 0), st1 = s.aiCopyStats(src, 1), st2 = s.aiCopyStats(src, 2);
check('Lv1 の強さはライフ50%・ちから60%・丈夫さ50%・ガッツ60%(満タンで出る)', st0.maxHp === 500 && st0.hp === 500 && st0.atk === 120 && st0.def === 50 && st0.maxGuts === 180 && st0.guts === 180, JSON.stringify(st0));
check('Lv2 は 70/80/70/80%、Lv3 は 80/90/80/90%', st1.maxHp === 700 && st1.atk === 160 && st1.def === 70 && st1.maxGuts === 240 && st2.maxHp === 800 && st2.atk === 180 && st2.def === 80 && st2.maxGuts === 270, `${JSON.stringify(st1)} ${JSON.stringify(st2)}`);
const classic = s.aiCopyStats(src, 0, { mode: 'classic' });
check('5つの遊びではライフを写さない(パーティのライフを使う)・ちから・丈夫さ・ガッツは写す', !('maxHp' in classic) && !('hp' in classic) && classic.atk === 120 && classic.maxGuts === 180, JSON.stringify(classic));
const ext = s.aiCopyStats(src, 0, { effMul: 0.5 });
check('EXTREME(effMul 0.5)では強さが半分', ext.maxHp === 250 && ext.atk === 60 && ext.def === 25 && ext.maxGuts === 90, JSON.stringify(ext));
check('EXTREME でも、続くターン・選ぶ見込みは変わらない', s.aiCopyTurns(0) === 2 && s.aiCopyRules(0).pick === 0.5);
check('ずっと続く攻撃アップは、コピーした時点のぶんを写す', s.aiCopyStats(src, 0, { permaAtkPct: 0.12 }).permaAtkPct === 0.12);
check('壊れた値でも落ちない(タクティクスのライフは1以上)', s.aiCopyStats(null, 9).maxHp === 1 && s.aiCopyStats({ maxHp: 'x' }, -3).atk === 0);
check('タクティクスの🔥: 出たときは元の子の 50/75/100%(上限100)', s.aiCopyStartHate(40, 0) === 20 && s.aiCopyStartHate(40, 1) === 30 && s.aiCopyStartHate(40, 2) === 40 && s.aiCopyStartHate(250, 2) === 100 && s.aiCopyStartHate(-5, 0) === 0);
check('タクティクスの🔥のたまり方は ×1.0/×1.25/×1.5', s.aiCopyHateGainMult(0) === 1 && s.aiCopyHateGainMult(1) === 1.25 && s.aiCopyHateGainMult(2) === 1.5);

// ---- 続くターン・もう一度・切りかえ ----
const p0 = s.aiCopySummonPlan(null, { srcSlot: 1, srcMonsterId: 'Mocchi', level: 0 });
check('はじめて使うと new・固有技を1枚足す・続くターン2', p0.kind === 'new' && p0.turnsLeft === 2 && p0.addUniqueOf === 'Mocchi' && p0.removeUniqueOf === null && !p0.removeCopy);
const copy = { srcSlot: 1, srcMonsterId: 'Mocchi', level: 0, turnsLeft: 1 };
const again = s.aiCopySummonPlan(copy, { srcSlot: 1, srcMonsterId: 'Mocchi', level: 0 });
check('出ているあいだにもう一度使うと、続くターンが最初に戻る(固有技は足さない)', again.kind === 'refresh' && again.turnsLeft === 2 && again.addUniqueOf === null && !again.removeCopy);
const sw = s.aiCopySummonPlan(copy, { srcSlot: 2, srcMonsterId: 'Golem', level: 1 });
check('別の子で使うと切りかわる(前のコピーと前の固有技を抜き、新しい固有技を1枚)', sw.kind === 'switch' && sw.removeCopy && sw.removeUniqueOf === 'Mocchi' && sw.addUniqueOf === 'Golem' && sw.turnsLeft === 3);
let left = { srcSlot: 0, srcMonsterId: 'Tiger', turnsLeft: s.aiCopyTurns(2) };
const ends = [];
for (let i = 0; i < 4; i++) { const x = s.aiCopyTurnEnd(left); ends.push(x.expired); left = { ...left, turnsLeft: x.turnsLeft }; if (x.expired) check('消えたら固有技を抜く', x.removeUniqueOf === 'Tiger'); }
check('Lv3 は 4ターン戦って消える', JSON.stringify(ends) === JSON.stringify([false, false, false, true]));

// ---- 固有技の出し入れ ----
const uni = { id: 'u-mocchi', type: 'unique', name: 'モッチ砲', uid: 'u1' };
const tagged = s.aiCopyUniqueCard(uni, 'Mocchi');
check('足す固有技は、どの Lv でもいつも1枚(印と uid つきの写し)', s.SORASHIDO_COPY_UNIQUE_COUNT === 1 && tagged.sorashidoCopyOf === 'Mocchi' && tagged.uid !== uni.uid && uni.sorashidoCopyOf === undefined);
const zones = { deck: [uni, tagged, { id: 'a' }], hand: [tagged, { id: 'b' }], discard: [{ id: 'c' }, tagged], other: 1 };
const byOwner = s.aiCopyRemoveUnique(zones, { srcMonsterId: 'Mocchi' });
const byUid = s.aiCopyRemoveUnique(zones, { uid: tagged.uid });
check('山札・手札・墓地のどこからでもコピーの固有技を抜く(元の子の固有技は残す・持ち主でも uid でも)', byOwner.deck.length === 2 && byOwner.deck[0] === uni && byOwner.hand.length === 1 && byOwner.discard.length === 1 && byOwner.other === 1 && zones.deck.length === 3
  && JSON.stringify(byUid) === JSON.stringify(byOwner) && s.aiCopyRemoveUnique(zones, { srcMonsterId: 'Golem' }).deck.length === 3);

// ---- 手札と使うカード ----
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const deck = [
  { id: 'atk1', type: 'atk', p: 10 }, { id: 'range1', type: 'range_atk', p: 99 }, { id: 'sorashido', type: 'buff', p: 99 },
  { id: 'guard1', type: 'guard', p: 3 }, { id: 'kyuko', type: 'buff', p: 5 },
];
const deckBefore = deck.length;
const hand = s.aiCopyHand(deck, tagged, seq([0, 0]));
check('uniqueRate を渡さなければ、固有技はいつも入る(前の形)', hand.length === 3 && deck.length === deckBefore && hand[2] === tagged, hand.map((c) => c.id).join(','));
const rate = (lv) => s.aiCopyRules(lv).uniqueRate;
check('固有技が手札に入る見込みは Lv1 30%・Lv2 40%・Lv3 50%(EXTREME でも変えない)', rate(0) === 0.3 && rate(1) === 0.4 && rate(2) === 0.5);
const withRate = (roll, lv) => s.aiCopyHand(deck, tagged, seq([0, 0, roll]), 2, rate(lv));
check('見込みの内側なら固有技が入り、外れたら入らない(2枚は引く・山札は減らさない)',
  withRate(0.29, 0).length === 3 && withRate(0.3, 0).length === 2 && withRate(0.49, 2).includes(tagged) && !withRate(0.5, 2).includes(tagged) && deck.length === deckBefore);
let uniqueIn = 0;
for (let i = 0; i < 1000; i++) if (withRate((i + 0.5) / 1000, 1).includes(tagged)) uniqueIn++;
check('Lv2 は 1000回のうち400回だけ固有技が入る', uniqueIn === 400, `${uniqueIn}/1000`);
check('距離技(青い枠)とソラシドのアシカは選ばない・固有技とほかのアシカは選べる', !hand.some((c) => c.type === 'range_atk' || c.id === 'sorashido')
  && s.aiCopyCanPick({ type: 'unique' }) && s.aiCopyCanPick({ id: 'kyuko', type: 'buff' }) && !s.aiCopyCanPick({ type: 'range_atk' }) && !s.aiCopyCanPick({ id: 'sorashido' }));
const pickHand = [{ id: 'x', p: 1, guts: 10 }, { id: 'best', p: 9, guts: 30 }, { id: 'y', p: 5, guts: 20 }];
const score = (c) => c.p;
const pick = (opt) => s.aiCopyPickCards(pickHand, { score, guts: 100, maxGuts: 100, ...opt }).map((c) => c.id);
check('見込みの内側なら、いちばん点の高いカード(Lv1 は 50%)', JSON.stringify(pick({ rng: seq([0.49]), level: 0 })) === '["best"]');
const second = pick({ rng: seq([0.5, 0]), level: 0 });
check('外れたら2番目以降から選ぶ', second.length === 1 && ['x', 'y'].includes(second[0]), second.join(','));
check('Lv3 も 80% の見込み', pick({ rng: seq([0.79]), level: 2 })[0] === 'best' && pick({ rng: seq([0.8, 0.99]), level: 2 })[0] !== 'best');
check('ガッツが足りないカードは選ばない・何も使えなければ空', JSON.stringify(pick({ guts: 25, rng: seq([0]), level: 0 })) === '["y"]' && pick({ guts: 5, rng: seq([0]), level: 0 }).length === 0);
check('Lv1・Lv2 は1ターンに1枚', pick({ guts: 999, maxGuts: 999, rng: seq([0]), level: 1 }).length === 1);
check('Lv3 はガッツの上限120以上で、2枚ぶん足りるときだけ2枚(同じカードは選ばない)',
  JSON.stringify(pick({ guts: 60, maxGuts: 120, rng: seq([0]), level: 2 })) === '["best","y"]'
  && pick({ guts: 60, maxGuts: 119, rng: seq([0]), level: 2 }).length === 1
  && JSON.stringify(pick({ guts: 35, maxGuts: 200, rng: seq([0]), level: 2 })) === '["best"]'
  && pick({ guts: 999, maxGuts: 999, rng: seq([0]), level: 2 }).length === 2);
let bestCount = 0;
for (let i = 0; i < 1000; i++) { const v = (i + 0.5) / 1000; if (pick({ rng: seq([v, v]), level: 1 })[0] === 'best') bestCount++; }
check('Lv2 は いちばん点の高いカードを 65% の見込みで選ぶ', bestCount === 650, `${bestCount}/1000`);
check('5人目の枠は 4・コピーが見る枚数は 2', s.SORASHIDO_COPY_SLOT === 4 && s.SORASHIDO_COPY_HAND_DRAW === 2);
check('説明文に Lv ごとの続くターンと強さが出る', /2ターン/.test(s.sorashidoCopyDesc(0)) && /4ターン/.test(s.sorashidoCopyDesc(2)) && /ちから90%/.test(s.sorashidoCopyDesc(2)) && /2枚まで/.test(s.sorashidoCopyDesc(2)) && !/2枚まで/.test(s.sorashidoCopyDesc(1)) && /固有技が手札に入る見込み 30%/.test(s.sorashidoCopyDesc(0)));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
