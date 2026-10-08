#!/usr/bin/env node
// メロディー・クロミーの「効き目」を見張る(2026-10-08 正式実装)。
//
//   node tools/monster/melody-kuromy-effects-check.js
//
// 数値の正本: docs/spec/MELODY_KUROMY_SKILLS.md。説明文(traitDesc・effectDesc・EXの desc)を書いただけでは何も起きず、
// 効き目は本体のあちこちの分岐が作る。どれか1か所書き忘れても画面はふつうに動いてしまうので、ここで1本ずつ確かめる。
//   ① 本体の登録(能力値・技名・固有技・血統・図鑑・案の段階から外れたか・マーケット)
//   ② 勇者特性のスタック(クッキー・黒音符)の決めごと(貯まり方・上限・段階)
//   ③ 本体の分岐(貯める・与ダメ・会心・連撃・被ダメ・毎ターン回復・ランの片付け・札)
//   ④ 固有技の効果(大樹の加護と同じ中身・名前違い)
//   ⑤ タクティクスEX(おねがい♪メロディボックス・悪夢全開！メロディ・キー)
//   ⑥ ふたりを「よその作品との共同企画」と呼ぶ言葉を使っていない(ユーザー指示。禁止語は文字コードで持つ)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const slice = (text, from, to) => { const i = text.indexOf(from), j = text.indexOf(to, i); return i >= 0 && j > i ? text.slice(i, j) : ''; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const allies = read('monster-hero/data/ally-monsters.js');
const lineages = read('monster-hero/data/lineages.js');
const breeder = read('monster-hero/data/breeder.js');
const event = read('monster-hero/data/rhythm-event.js');
const bond = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const rpg = read('monster-hero/src/parts/23-rpg-debug.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const screen = read('monster-hero/src/parts/71-screen-battle.jsx');
const game = read('monster-hero/src/game-system.jsx');

// ---------- ① 本体の登録 ----------
const sd = {};
vm.createContext(sd);
vm.runInContext(`${allies.replace(/\b[A-Z_]+_(IMG|ICON|FACE_ICON)\b/g, "'img'")}\nglobalThis.M=ALL_PLAYER_MONSTERS;globalThis.N=HERO_ATK_NAMES;globalThis.D=UPCOMING_MONSTER_DRAFTS;`, sd);
const { M, N, D } = sd;
check('メロディーとクロミーが本体の一覧にいて、案の段階からは外れた', !!M.Melody && !!M.Kuromy && !D.Melody && !D.Kuromy);
check('能力値がユーザーと決めた値(メロディー 760/135/105/160・クロミー 680/125/175/110)',
  M.Melody && M.Melody.baseHp === 760 && M.Melody.baseGuts === 135 && M.Melody.baseAtk === 105 && M.Melody.baseDef === 160
  && M.Kuromy && M.Kuromy.baseHp === 680 && M.Kuromy.baseGuts === 125 && M.Kuromy.baseAtk === 175 && M.Kuromy.baseDef === 110);
check('供モン加算と間合い適性', JSON.stringify(M.Melody?.plusStats) === '{"hp":360,"atk":15,"def":60,"guts":25}'
  && JSON.stringify(M.Kuromy?.plusStats) === '{"hp":320,"atk":45,"def":30,"guts":15}'
  && M.Melody?.distAptitude.join('') === 'CBAD' && M.Kuromy?.distAptitude.join('') === 'CABD');
check('固有技はユグドラシル種と同じ ×3.2・消費64・同じ9段階', ['Melody', 'Kuromy'].every(id => M[id]?.unique?.baseMult === 3.2
  && M[id]?.unique?.baseGuts === 64 && JSON.stringify(M[id]?.unique?.names) === JSON.stringify(M.Yggdrasil.unique.names) && M[id]?.unique?.monId === id));
check('通常技は9段階ずつ、ユーザーの資料の名前', N.Melody?.length === 9 && N.Kuromy?.length === 9
  && N.Melody[0] === 'ぞうさん頭突き' && N.Melody[8] === 'ドリームパワー' && N.Kuromy[0] === 'バク頭突き' && N.Kuromy[5] === "KUROMI'S5アタック");
check('勇者特性の名前', M.Melody?.trait === 'メロディの手作りクッキー' && M.Kuromy?.trait === 'クロミノート');
check('血統はユグドラシル×？？？(レア)と図鑑の文',
  /Melody:\s*\{ main:'yggdrasil', sub:'unknown' \}/.test(lineages) && /Kuromy:\s*\{ main:'yggdrasil', sub:'unknown' \}/.test(lineages)
  && /Melody: 'マイメロディとぞうさんの力を宿した/.test(lineages) && /Kuromy: 'クロミとバクの力を宿した/.test(lineages));
// ★2026-10-08 ユーザー指示「新モンスター実装は早く取り下げて」で、販売と交換を止めた(本体は残し、交換済みの人はそのまま使える)
check('取り下げ中: マーケットの6件はすべて近日追加(available:false)',
  ['melody_icon', 'melody_disc_icon', 'Melody', 'kuromy_icon', 'kuromy_disc_icon', 'Kuromy'].every(id => new RegExp(`id:'${id}',[^\\n]*available:false`).test(breeder)));
check('取り下げ中: ビートP交換所に円盤石を並べていない', !/rhythmEventDiscOffer\('(Melody|Kuromy)'/.test(event));
check('技の動きはユグドラシルの型を名前で引く', /SKILL_ATTACK_THEME_MONSTERS = Object\.freeze\(\['Yggdrasil', 'MelWhip', 'Melody', 'Kuromy'\]\)/.test(rpg)
  && [...N.Melody, ...N.Kuromy].every(n => rpg.includes(`'${n}':'yg`) || rpg.includes(`"${n}":'yg`)));

// ---------- ② スタックの決めごと ----------
const stackSrc = slice(bond, '// ==== 勇者特性「メロディの手作りクッキー」', '// ==== 固有技「運命のコイン」');
check('スタックの決めごとを本体から切り出せる', stackSrc.length > 0);
const sb = {};
vm.createContext(sb);
vm.runInContext(`${stackSrc}\nglobalThis.s={SWEET_STACK_MAX,sweetStackTraitOf,sweetStackGainOf,addSweetStack,cookieEffectOf,blackNoteEffectOf,withBlackNoteCombo,sweetStackEffectText};`, sb);
const s = sb.s;
const atkCard = { type: 'atk' }, uniqueCard = { type: 'unique', monId: 'Kuromy' }, guardCard = { type: 'guard' };
check('上限は10', s.SWEET_STACK_MAX === 10 && s.addSweetStack(9, 2) === 10 && s.addSweetStack(10, 1) === 10 && s.addSweetStack(null, 1) === 1);
check('クッキー: メロディー本人のカード1枚で+1(どの種類のカードでも)',
  s.sweetStackGainOf('Melody', 'Melody', atkCard) === 1 && s.sweetStackGainOf('Melody', 'Melody', guardCard) === 1);
check('クッキー: ほかの子のカードでは貯まらない(本人の行動だけ)', s.sweetStackGainOf('Melody', 'Mocchi', atkCard) === 0 && s.sweetStackGainOf('Mocchi', 'Mocchi', atkCard) === 0);
check('黒音符: 当たったときだけ+1、固有技は+2',
  s.sweetStackGainOf('Kuromy', 'Kuromy', atkCard, true) === 1 && s.sweetStackGainOf('Kuromy', 'Kuromy', uniqueCard, true) === 2
  && s.sweetStackGainOf('Kuromy', 'Kuromy', atkCard, false) === 0 && s.sweetStackGainOf('Kuromy', 'Ghost', atkCard, true) === 0);
const c1 = s.cookieEffectOf(1), c2 = s.cookieEffectOf(2), c4 = s.cookieEffectOf(4), c7 = s.cookieEffectOf(7), c10 = s.cookieEffectOf(10);
check('クッキーの段階(2個 回復+5% / 4個 ガッツ+5% / 7個 被ダメ−15% / 10個 与ダメ+15%)',
  c1.hpRegen === 0 && c2.hpRegen === 0.05 && c2.gutsRegen === 0 && c4.gutsRegen === 0.05 && c4.takenMult === 1
  && near(c7.takenMult, 0.85) && c7.dmgMult === 1 && near(c10.dmgMult, 1.15) && near(c10.takenMult, 0.85));
const n0 = s.blackNoteEffectOf(0), n4 = s.blackNoteEffectOf(4), n5 = s.blackNoteEffectOf(5), n10 = s.blackNoteEffectOf(10);
check('黒音符の段階(1個ごと与ダメ+3% / 5個 会心率+10% / 10個 連撃15%)',
  n0.dmgMult === 1 && n0.critAdd === 0 && !n0.combo && near(n4.dmgMult, 1.12) && n4.critAdd === 0 && n5.critAdd === 0.1
  && near(n10.dmgMult, 1.3) && n10.combo && n10.combo.count === 1 && near(n10.combo.rate, 0.15));
check('黒音符の連撃は、EXや運命の連撃のうしろへ並べる', s.withBlackNoteCombo(null, null) === null
  && s.withBlackNoteCombo({ count: 4, rate: 0.3 }, n10.combo).length === 2 && s.withBlackNoteCombo(null, n10.combo).length === 1);
check('札に出す文', s.sweetStackEffectText('Melody', 10).includes('与ダメージ+15%') && s.sweetStackEffectText('Kuromy', 5).includes('会心率+10%'));

// ---------- ③ 本体の分岐 ----------
check('スタックはランのあいだ持ち越し、ランの片付けで0へ戻す', /resetSweetStack\(\); \/\/ メロディー・クロミーのスタックもランごと/.test(app)
  && slice(app, 'const resetTacticsJoinCatchUp', '};').includes('resetSweetStack()'));
check('クッキーはカードを払った直後に、本人の枠を決めたカードだけ数える', app.includes('if(!isBreeder&&entry.slotIdx!=null) gainSweetStack(slotIdx,slots[slotIdx]?.id,card);'));
check('黒音符は攻撃が当たったときに数える', app.includes('if (finalD>0) gainSweetStack(slotIdx,activeMon?.id,card,true);'));
check('与ダメ(getDmg)にクッキー10個と黒音符が乗る', app.includes('const totalBuffMult=traitMult*cookieEffectNow().dmgMult*blackNoteEffectAt(slotIdx,mon?.id).dmgMult*'));
check('会心率に黒音符(5個から)が足される', app.includes('+blackNoteEffectAt(slotIdx,activeMon?.id).critAdd)*tacticsExMultiBuffNow(slotIdx).critRate'));
check('連撃は実際の攻撃と予測表示の両方に付く', (app.match(/withBlackNoteCombo\(withFateCombo\(/g) || []).length === 2);
check('被ダメの最後にクッキー7個からの軽減が掛かる', app.includes('*cookieEffectNow().takenMult)) // クッキー7個から'));
check('毎ターンの回復にクッキーのぶんが入る', app.includes('const cookie=cookieEffectNow();') && app.includes('tacticsRateHeal(cookie.hpRegen,cookie.gutsRegen,false)'));
check('バトル画面の札に貯まった数が出る', screen.includes("Object.entries(sweetStackView||{}).forEach") && app.includes('sweetStackView={sweetStackView}'));

// ---------- ④ 固有技の効果 ----------
const guardSrc = slice(bond, '// 固有技「大樹の加護」', '// ==== 勇者特性「トリックスタート」');
const gb = {};
vm.createContext(gb);
vm.runInContext(`${guardSrc}\nglobalThis.g={isLifeTreeGuardCard,lifeTreeGuardNameOf};`, gb);
check('固有技の効果は大樹の加護と同じ中身で、名前だけ違う',
  gb.g.isLifeTreeGuardCard({ type: 'unique', monId: 'Melody' }) && gb.g.isLifeTreeGuardCard({ type: 'unique', monId: 'Kuromy' })
  && gb.g.isLifeTreeGuardCard({ type: 'unique', monId: 'Yggdrasil' }) && !gb.g.isLifeTreeGuardCard({ type: 'atk', monId: 'Melody' })
  && !gb.g.isLifeTreeGuardCard({ type: 'unique', monId: 'Ghost' })
  && gb.g.lifeTreeGuardNameOf('Melody') === 'ピンク音符の加護' && gb.g.lifeTreeGuardNameOf('Kuromy') === 'メロディ・ボゥの旋律');
check('本体の分岐は isLifeTreeGuardCard を見る', app.includes('else if(isLifeTreeGuardCard(card)){') && app.includes('${lifeTreeGuardNameOf(card.monId)}！'));

// ---------- ⑤ タクティクスEX ----------
const gs = (from, to) => slice(game, from, to);
const ex = {};
vm.createContext(ex);
vm.runInContext([
  gs('const tacticsSafeInt', 'const tacticsClamp'),
  gs('const tacticsAliveSlots', 'const tacticsFilledSlots'),
  gs('// ==== タクティクス専用 EXスキル(STEP1: 共通基盤) ====', '// ==== タクティクス専用 EXスキルここまで ===='),
  'globalThis.e={tacticsExDefOf,checkTacticsExUse,applyTacticsExUse,isTacticsExEffectActive,tacticsExCookieBoxOf,tacticsExNightmareOf,tacticsExNightmareEnemyOf,tacticsExMultiBuffOf,tacticsExExtraCombosAt,tacticsExStackSpendNote,tacticsExTurnsLeft,isTacticsExEffectImplemented,createTacticsExState};',
].join('\n'), ex);
const e = ex.e;
const mel = e.tacticsExDefOf('Melody'), kur = e.tacticsExDefOf('Kuromy');
check('EXの定義(1ラン5回・併用できる・3ターン・スタックを使う)', mel && kur && mel.maxUses === 5 && kur.maxUses === 5 && mel.withCards && kur.withCards
  && mel.duration === 'turns' && mel.turns === 3 && kur.turns === 3 && mel.effect === 'cookieBox' && kur.effect === 'nightmareKey'
  && e.isTacticsExEffectImplemented(mel) && e.isTacticsExEffectImplemented(kur));
const now = { wave: 1, turn: 2 };
const base = { def: mel, state: e.createTacticsExState(), slot: 0, monId: 'Melody', alive: true, now };
check('スタックが0個のときは使えない(理由つき)', !e.checkTacticsExUse({ ...base, stacks: 0, stackLabel: 'クッキー' }).ok
  && /クッキーが1つも無い/.test(e.checkTacticsExUse({ ...base, stacks: 0, stackLabel: 'クッキー' }).reason)
  && e.checkTacticsExUse({ ...base, stacks: 1, stackLabel: 'クッキー' }).ok);
const units = [{ id: 'Melody', hp: 10, maxHp: 10 }, { id: 'Kuromy', hp: 10, maxHp: 10 }, null, null];
const used6 = e.applyTacticsExUse(e.createTacticsExState(), { def: mel, slot: 0, monId: 'Melody', now, snapshot: { spent: 6 } });
const box6 = e.tacticsExCookieBoxOf(used6, units, now);
check('メロディボックス: 6個なら全員の与ダメ+12%・被ダメ−12%、3ターン', near(box6.dmgMult, 1.12) && near(box6.takenMult, 0.88)
  && e.tacticsExTurnsLeft(used6, 0, 'Melody', now) === 3 && !e.isTacticsExEffectActive(used6, 0, 'Melody', { wave: 1, turn: 5 }));
const used10 = e.applyTacticsExUse(e.createTacticsExState(), { def: mel, slot: 0, monId: 'Melody', now, snapshot: { spent: 10 } });
check('メロディボックス: 10個なら5ターンに伸び、WAVEをまたがない', e.isTacticsExEffectActive(used10, 0, 'Melody', { wave: 1, turn: 6 })
  && !e.isTacticsExEffectActive(used10, 0, 'Melody', { wave: 1, turn: 7 }) && !e.isTacticsExEffectActive(used10, 0, 'Melody', { wave: 2, turn: 3 })
  && near(e.tacticsExCookieBoxOf(used10, units, now).dmgMult, 1.2));
const k5 = e.applyTacticsExUse(e.createTacticsExState(), { def: kur, slot: 1, monId: 'Kuromy', now, snapshot: { spent: 5 } });
const kb5 = e.tacticsExMultiBuffOf(k5, units, 1, now);
check('メロディ・キー: 5個なら与ダメ+20%・会心率+15%(足し算)・敵の被ダメ+10%・連撃なし', kb5 && near(kb5.dmg, 1.2) && near(kb5.critAdd, 0.15)
  && near(e.tacticsExNightmareEnemyOf(k5, units, now).enemyTaken, 0.1) && e.tacticsExExtraCombosAt(k5, units, 1, now) === null);
const k10 = e.applyTacticsExUse(e.createTacticsExState(), { def: kur, slot: 1, monId: 'Kuromy', now, snapshot: { spent: 10 } });
const kc10 = e.tacticsExExtraCombosAt(k10, units, 1, now);
check('メロディ・キー: 10個なら連撃30%×2が付く', kc10 && kc10.count === 2 && near(kc10.rate, 0.3) && e.tacticsExTurnsLeft(k10, 1, 'Kuromy', now) === 3);
check('使った直後の文に個数と数字が出る', /クッキー6個を配った/.test(e.tacticsExStackSpendNote(mel, 6)) && /連撃30%×2/.test(e.tacticsExStackSpendNote(kur, 10)));
check('使うとスタックを0へ戻し、メロディボックスは全員を回復する', app.includes('const spentStacks=def.stackSpend?sweetStackAt(slotIdx):0;')
  && app.includes('writeSweetStackAt(slotIdx,0);') && app.includes('tacticsRateHeal(def.stackSpend.heal*spentStacks,def.stackSpend.guts*spentStacks,false)')
  && (app.match(/stacks:sweetStackAt\(slotIdx\), stackLabel:sweetStackTraitOf\(mon\.id\)\?\.label\|\|null/g) || []).length === 2);
check('メロディボックスは全体バフへ、メロディ・キーの敵の被ダメは敵の被ダメの枠へ', app.includes('const box=tacticsExCookieBoxOf(st,units,live.now);')
  && app.includes('const nm=tacticsExNightmareEnemyOf(tacticsExStateRef.current,tacticsUnitsRef.current,live.now);'));

// ---------- ⑥ 言葉 ----------
const texts = [allies, lineages, breeder, read('monster-hero/data/help.js'), slice(read('monster-hero/data/changelog.js'), 'const CHANGELOG = [', "id:'update_notice_melody_kuromy_release_v1'"),
  read('docs/spec/MELODY_KUROMY_SKILLS.md'), stackSrc,
  read('tools/image/make-melody-kuromy-release-notice.js')];
// 禁止語そのものをソースへ書かないよう、文字コードで持つ
const BANNED = new RegExp(['\\u30b3\\u30e9\\u30dc', '\\u30b5\\u30f3\\u30ea\\u30aa'].join('|'));
check('共同企画を指す禁止語を使っていない', texts.every(t => !BANNED.test(t)));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
