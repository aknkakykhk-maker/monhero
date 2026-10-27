// 解放が要る助手の服(2026-10-27)を確かめる。ブラウザは使わない。
//
//   node tools/market/assistant-costume-unlock-check.js
//
//   社長「みゅあの新衣装解放。バトルカードでみゅあのマスターに勝つと解放。他の衣装の同じように売られる。新衣装は準備中」。
//   部長の割り振り: 勝つ前はマーケットに出さない(「近日追加」も出さない)。覚え方は新しいキー mh_assistant_costume_unlocked_v1。
//   前から勝っている人は mh_card_record_detail_v1 の foes.mua.levels.master が1以上なら解放とみなす(読むだけ)。
//
// 見るもの
//   ① 公開の印が偽なら、解放していても並ばない(印を切り替えて確かめる。10/27 に公開して本物は真)
//   ② (印を真にしたつもりで)勝つ前は並ばない/勝ったら並ぶ(ダイヤショップ・仮の 100,000 ダイヤ)
//   ③ 前からの記録(詳しい記録・もとの記録の最近の30戦)で MASTER に勝っている人は並ぶ。0勝なら並ばない
//   ④ 勝ち以外・ほかの相手・ほかの難易度では解放しない。足すだけで前の id を消さない
//   ⑤ 壊れた値でも落ちない(配列に落とす)
//   ⑥ アプリの読み込みが2つのキーを読み、カードの記録は書き換えない。保存の一覧に新しいキーがある
//   ⑦ MFバトルカードの精算(84)が、勝ちを保存できたあとに、デバッグ以外の助手と対戦でだけ解放を保存する
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const breeder = read('monster-hero/data/breeder.js');
const app = read('monster-hero/src/parts/60-app.jsx');
const saveSpec = read('docs/spec/SAVE_DATA.md');
const cardBattle = read('monster-hero/src/parts/84-screen-card-battle.jsx');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const start = breeder.indexOf('const ASSISTANT_COSTUME_OWNED_KEY');
const endMarker = '    BREEDER_MARKET_ITEMS.push({ id:costume.id';
const end = breeder.indexOf('\n  });', breeder.indexOf(endMarker)) + '\n  });'.length;
const block = breeder.slice(start, end);
check('着替えの定義を取り出せる', start >= 0 && end > start && block.includes('const assistantCostumeUnlockEntry'));

const ID = 'mua_card_master_v1';
// released … 公開の印を真にして読むか
const load = (released) => {
  const ctx = { BREEDER_MARKET_ITEMS: [] };
  vm.createContext(ctx);
  // 公開の印を、ファイルの値に関係なく決めて読む(10/27 から本物は真)
  const src = block.replace(/const ASSISTANT_COSTUME_MUA_MASTER_RELEASE = (true|false);/, `const ASSISTANT_COSTUME_MUA_MASTER_RELEASE = ${released ? 'true' : 'false'};`);
  vm.runInContext(`${src}\nthis.out={ASSISTANT_COSTUMES,ASSISTANT_COSTUME_UNLOCKED_KEY,normalizeUnlockedAssistantCostumes,resolveUnlockedAssistantCostumes,assistantCostumeUnlockEntry,setAssistantCostumeUnlockedNow,addAssistantCostumeUnlockedNow,assistantCostumeById,items:BREEDER_MARKET_ITEMS};`, ctx);
  const out = ctx.out;
  out.item = () => out.items.find(item => item.id === ID);
  out.listed = () => { const item = out.item(); return !!item && item.shop !== false && item.available !== false; };
  return out;
};

// ① 公開の印が偽のとき
const hidden = load(false);
check('服が1着、みゅあの服として足されている', hidden.ASSISTANT_COSTUMES.filter(c => c.id === ID && c.assistantId === 'mua').length === 1);
check('解放の条件は「みゅあの MASTER に勝つ」', (() => { const c = hidden.ASSISTANT_COSTUMES.find(x => x.id === ID); return c.unlock && c.unlock.cardFoe === 'mua' && c.unlock.cardLevel === 'master'; })());
check('公開の印が偽のあいだは服として見えない', hidden.assistantCostumeById(ID) === null);
hidden.setAssistantCostumeUnlockedNow([ID]);
check('公開の印が偽のあいだは、解放していてもマーケットに並ばない', hidden.item() && hidden.item().shop === false);

// ② 勝つ前・勝ったあと
const shop = load(true);
check('勝つ前は並ばない(「近日追加」も出さない = shop が false)', shop.item() && shop.item().shop === false && shop.item().available === false);
const entry = shop.assistantCostumeUnlockEntry(null, { who: 'mua', level: 'master', outcome: 'win' });
check('みゅあの MASTER に勝つと、新しいキーへ保存する1件ができる',
  !!entry && entry.key === 'mh_assistant_costume_unlocked_v1' && entry.before === null && JSON.stringify(entry.next) === JSON.stringify([ID]));
shop.addAssistantCostumeUnlockedNow(entry.next);
check('勝ったら並ぶ(ダイヤショップの着替え・仮の 100,000 ダイヤ)', shop.listed() && shop.item().currency === 'diamond' && shop.item().cost === 100000 && shop.item().type === 'costume');

// ③ 前からの記録
check('前からの記録で MASTER に勝っている人は解放', load(true).resolveUnlockedAssistantCostumes([], { foes: { mua: { win: 5, levels: { master: 2 } } } }).includes(ID));
check('MASTER が0勝なら解放しない', !load(true).resolveUnlockedAssistantCostumes([], { foes: { mua: { win: 5, levels: { master: 0, expert: 3 } } } }).includes(ID));
check('もとの記録(mh_card_record_v1)の最近の30戦に みゅあ MASTER の勝ちがあれば解放(詳しい記録が無い人)',
  load(true).resolveUnlockedAssistantCostumes([], null, { recent: [{ who: 'kiki', level: 'master', outcome: 'win' }, { who: 'mua', level: 'master', outcome: 'win' }] }).includes(ID));
check('最近の30戦でも、負け・投了・ほかの難易度・ほかの助手では解放しない',
  !load(true).resolveUnlockedAssistantCostumes([], null, { recent: [{ who: 'mua', level: 'master', outcome: 'lose' }, { who: 'mua', level: 'master', outcome: 'surrender' }, { who: 'mua', level: 'expert', outcome: 'win' }, { who: 'kiki', level: 'master', outcome: 'win' }] }).includes(ID));
check('もとの記録が壊れていても落ちない', [null, 'x', { recent: 'x' }, { recent: [null, 1, 'a'] }].every(r => Array.isArray(load(true).resolveUnlockedAssistantCostumes([], null, r))));
check('ほかの助手の MASTER では解放しない', !load(true).resolveUnlockedAssistantCostumes([], { foes: { kiki: { levels: { master: 4 } } } }).includes(ID));
const seeded = load(true);
seeded.setAssistantCostumeUnlockedNow(seeded.resolveUnlockedAssistantCostumes(null, { foes: { mua: { levels: { master: 1 } } } }));
check('前からの記録だけでも並ぶ', seeded.listed());

// ④ 勝ち以外・足すだけ
const E = load(true).assistantCostumeUnlockEntry;
check('負け・投了・EXPERT の勝ち・ほかの助手の MASTER では解放しない',
  E(null, { who: 'mua', level: 'master', outcome: 'lose' }) === null && E(null, { who: 'mua', level: 'master', outcome: 'surrender' }) === null
  && E(null, { who: 'mua', level: 'expert', outcome: 'win' }) === null && E(null, { who: 'kiki', level: 'master', outcome: 'win' }) === null);
check('もう解放していれば保存しない(null)', E([ID], { who: 'mua', level: 'master', outcome: 'win' }) === null);
const keep = E(['some_other_v1'], { who: 'mua', level: 'master', outcome: 'win' });
check('前の id を消さずに足す', !!keep && keep.next.includes('some_other_v1') && keep.next.includes(ID));

// ⑤ 壊れた値
const broken = load(true);
const safe = (fn) => { try { return fn(); } catch (e) { return e; } };
const results = [
  safe(() => broken.resolveUnlockedAssistantCostumes('x', 'garbage')),
  safe(() => broken.resolveUnlockedAssistantCostumes({ a: 1 }, { foes: [] })),
  safe(() => broken.resolveUnlockedAssistantCostumes([1, null, ' ', ID, ID], { foes: { mua: { levels: null } } })),
  safe(() => broken.resolveUnlockedAssistantCostumes(undefined, { foes: { mua: { levels: { master: 'abc' } } } })),
];
check('壊れた値でも配列に落ちて止まらない', results.every(r => Array.isArray(r)) && JSON.stringify(results[2]) === JSON.stringify([ID]) && results[3].length === 0,
  results.map(r => (Array.isArray(r) ? JSON.stringify(r) : String(r))).join(' / '));
const brokenEntry = safe(() => broken.assistantCostumeUnlockEntry('garbage', { who: 'mua', level: 'master', outcome: 'win' }));
check('壊れた保存値の上でも1件を作れる(前の値は before にそのまま残す)', brokenEntry && brokenEntry.before === 'garbage' && JSON.stringify(brokenEntry.next) === JSON.stringify([ID]));
check('引数が無くても止まらない', safe(() => broken.assistantCostumeUnlockEntry()) === null);

// ⑥ つなぎ
check('アプリの読み込みが、新しいキーとカードの記録2つから解放を起こす',
  /setAssistantCostumeUnlockedNow\(resolveUnlockedAssistantCostumes\(await storeGet\(ASSISTANT_COSTUME_UNLOCKED_KEY, \[\], false\), await storeGet\(CARD_RECORD_DETAIL_KEY, null, false\), await storeGet\(CARD_SAVE_KEYS\.record, null, false\)\)\)/.test(app));
check('アプリはもとの記録(mh_card_record_v1)も書き換えない(この読み込みは storeGet だけ)', !/storeSet\(CARD_SAVE_KEYS\.record/.test(app));
check('アプリはカードの記録を書き換えない(この PR で storeSet(CARD_RECORD_DETAIL_KEY) を足していない)', !/storeSet\(CARD_RECORD_DETAIL_KEY/.test(app));
check('マーケットの商品は、解放するまで shop と available を偽にする',
  breeder.includes("get shop() { return costume.released === true && assistantCostumeUnlockedNow(costume) ? undefined : false; }")
  && breeder.includes("get available() { return assistantCostumeSaleIn(costume, 'diamond') && assistantCostumeUnlockedNow(costume) ? undefined : false; }"));
check('保存の一覧(SAVE_DATA.md)に新しいキーがある', saveSpec.includes('`mh_assistant_costume_unlocked_v1`'));

// ⑦ カードの精算(84。カード部 ソランドくん・リプレイくんと決めた形)
const callAt = cardBattle.indexOf('assistantCostumeUnlockEntry(');
const syncAt = cardBattle.indexOf('if (ok && rankable) void cardRankSync(');
const demoAt = cardBattle.indexOf('if (game.demo) {');
const tutorialAt = cardBattle.indexOf('if (game.tutorial) {');
const callBlock = callAt >= 0 ? cardBattle.slice(cardBattle.lastIndexOf('\n', cardBattle.lastIndexOf('if (', callAt)), cardBattle.indexOf('} catch', callAt)) : '';
check('精算から1回だけ呼ぶ', callAt >= 0 && cardBattle.indexOf('assistantCostumeUnlockEntry(', callAt + 1) < 0);
check('勝ちの記録を保存できたあと(cardRankSync の後)に呼ぶ', syncAt >= 0 && callAt > syncAt);
check('見本(game.demo)・練習試合(game.tutorial)の分かれ道より後ろ(そこでは抜けて呼ばない)', demoAt >= 0 && tutorialAt >= 0 && callAt > demoAt && callAt > tutorialAt);
check('条件は「保存できた・勝ち・デバッグでない」', /if \(ok && outcome === 'win' && !debug\) \{/.test(callBlock));
check('解放の保存が書けたときだけ、いまの画面へ伝える', /if \(unlockEntry && await storeSet\(unlockEntry\.key, unlockEntry\.next\)\) addAssistantCostumeUnlockedNow\(unlockEntry\.next\);/.test(cardBattle));
check('失敗しても対戦の結果を止めない(try で包む)', /try \{\s*const unlockEntry/.test(cardBattle));
check('カードの記録(mh_card_record_detail_v1)をこの呼び出しで書かない', !/storeSet\(CARD_RECORD_DETAIL_KEY/.test(cardBattle));

// ⑧ 公開(10/27 社長「公開まで進めてかまわない」)
check('本物は公開の印が真で、名前は「デュエルマスター」・絵は card-master', /const ASSISTANT_COSTUME_MUA_MASTER_RELEASE = true;/.test(breeder)
  && (() => { const c = load(true).ASSISTANT_COSTUMES.find(x => x.id === ID); return c.name === 'デュエルマスター' && c.imageDir === 'images/assistant/card-master' && /card-master\/face\/myua_happy\.PNG/.test(c.icon); })());
check('解放の前にプロフィールで押すと、買える場所ではなく条件を出す',
  /assistantCostumeUnlockedNow\(lockedCostume\)\?/.test(app) && app.includes('lockedCostume.unlockHow') && typeof load(true).ASSISTANT_COSTUMES.find(x => x.id === ID).unlockHow === 'string');

console.log(failed ? `\n${failed} 件失敗` : '\nすべてOK');
process.exit(failed ? 1 : 0);
