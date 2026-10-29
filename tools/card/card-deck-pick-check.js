#!/usr/bin/env node
// MFバトルカードの「対戦の前のデッキ選び」(87-card-deck-pick.jsx・2026-10-29 社長 案C)を確かめる(カード部ミカエシくん)。
//
//   node tools/card/card-deck-pick-check.js
//
//   ① 選べる一覧(cardDeckPickChoices): デッキの数だけ並ぶ/使えるデッキは理由なし/枚数が足りない・持っていないカードがあるデッキは理由つき
//   ② 84 のつなぎ: 「対戦する」「もう一度」「マルチ対戦」「招待の知らせ」「マルチの試合のあと入口へ戻る」でデッキ選びを挟む。練習試合には挟まない
//   ③ 選んだデッキは mh_card_decks_v1 の active を書き換えるだけ(保存の形は変えない)。対戦は選んだデッキで組む
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const pickSrc = read('src/parts/87-card-deck-pick.jsx');
const p84 = read('src/parts/84-screen-card-battle.jsx');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n${pickSrc.split('const CardDeckPick = ')[0]}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardDeckPickChoices, cardAiBuildDeck };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let seed = 5;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ① 選べる一覧
const full = E.cardAiBuildDeck(db, 'mua', 'normal', rng);
const own = {};
for (const no of [...full.monsters, ...full.cards]) own[no] = (own[no] || 0) + 1;
const decks = { active: 'b', decks: [
  { id: 'a', name: 'ぜんぶある', monsters: full.monsters.slice(), cards: full.cards.slice() },
  { id: 'b', name: 'たりない', monsters: full.monsters.slice(), cards: full.cards.slice(0, 20) },
] };
const list = E.cardDeckPickChoices(db, decks, own);
check('① デッキの数だけ並ぶ', list.length === 2, `${list.length}`);
check('① 使えるデッキは理由なし', list[0].why.length === 0, list[0].why.join('・'));
check('① 枚数が足りないデッキは理由つき(選べない)', list[1].why.length > 0, list[1].why.join('・'));
check('① 持っていないカードがあると理由つき', E.cardDeckPickChoices(db, decks, {})[0].why.length > 0);
check('① 名前・3体・枚数・種類を持つ(借りたデッキは kind を変えて足す)', list[0].name === 'ぜんぶある' && list[0].monsters.length === 3 && list[0].count === full.cards.length && list[0].kind === 'own');
check('① 壊れた値でも落ちない', Array.isArray(E.cardDeckPickChoices(db, null, null)) && E.cardDeckPickChoices(db, { decks: [] }, {}).length === 0);
check('① 前に使ったデッキが使えないときは、使える最初のデッキを選んでおく', /choices\.find\(\(c\) => c\.id === decks\.active && usable\(c\)\) \|\| choices\.find\(usable\)/.test(pickSrc));

// ② 84 のつなぎ
const opens = (src) => (src.match(/setDeckPick\(\{ next: '(cpu|pvp)'/g) || []).length;
check('② 「対戦する」はデッキ選びを開く(すぐには始めない)', /data-card-start [^\n]*setDeckPick\(\{ next: 'cpu', pick: foe \}\); setView\('deckPick'\)/.test(p84));
check('② 結果の「もう一度」もデッキ選びを開く', /setDeckPick\(\{ next: 'cpu', pick: again \}\); setView\('deckPick'\); \}\}>もう一度/.test(p84));
check('② 「マルチ対戦」もデッキ選びを開く', /data-card-mode-multi [^\n]*setDeckPick\(\{ next: 'pvp' \}\); setView\('deckPick'\)/.test(p84));
check('② 招待の知らせから入るときも、先にデッキ選び', /const go = \(c\) => \{ if \(c\) \{ setDeckPick\(\{ next: 'pvp' \}\); setView\('deckPick'\); \} \}; go\(CARD_PVP_JOIN\.peek\(\)\)/.test(p84));
check('② マルチの試合のあと(over → idle)入口へ戻る前にもデッキ選び', /prev === 'over' && r\.phase === 'idle' && viewRef\.current === 'pvp'\) \{ setDeckPick\(\{ next: 'pvp' \}\)/.test(p84));
check('② 開く所は 5 つ', opens(p84) === 5, `${opens(p84)}`);
const tutorial = p84.slice(p84.indexOf('const startTutorial = '), p84.indexOf('const startBattle = '));
check('② 練習試合には挟まない', tutorial.length > 0 && !/deckPick|setDeckPick/.test(tutorial));

// ③ 保存と、選んだデッキで組むこと
const view = p84.slice(p84.indexOf("if (view === 'deckPick' && deckPick)"), p84.indexOf("if (view === 'pvp') {"));
check('③ 選んだら active だけを書き換える(保存の形は変えない)', /persist\(\{ decks: \{ \.\.\.save\.decks, active: deck\.id \} \}\)/.test(view));
check('③ 保存できなかったら始めない', /if \(!ok\) \{ setNotice\('保存できませんでした'\); return; \}/.test(view));
check('③ 助手と対戦は選んだデッキで始める', /startBattle\(next\.pick, deck\)/.test(view) && /const startBattle = \(pick = foe, deck = activeDeck\) =>/.test(p84));
check('③ 戻るは、助手と対戦なら相手えらび・マルチならモードえらび', /setView\(toPvp \? 'mode' : 'foe'\)/.test(view));

if (failed) { console.log(`\nNG ${failed} 件`); process.exit(1); }
console.log('\nすべてOK');
