#!/usr/bin/env node
// モンヒロビートの本オープンが、2026-11-09(月)10:00 JST に時刻で切り替わるかを見る(2026-11-08 社長「まず告知をして明日の10時ぐらいにやりたい」)。
//
//   node tools/boot/rhythm-grand-open-time-check.js
//
// 【なぜ要るか】
// 本オープンは、人が印を立てに行かなくても時刻で開く。切り替わりは一度きりで、遅れても早すぎても取り返しがつかない
// (記念ギフトは配ったら戻せない・予告のまま朝を迎えると社長の告知とずれる)。
// 本物の定義(17-release-changelog-login-missions.jsx の RELEASE_FLAGS・rhythmGrandOpenReleased・grantGrandOpenAllGift)を
// 偽の時計で動かし、9:59:59 と 10:00:00 の前後で切り替わることを確かめる。更新履歴・助手の告知の時刻も同じ時刻にそろっているかを見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const START = '2026-11-09T10:00:00+09:00';
const startMs = Date.parse(START);
ok('本オープンの開始時刻は 2026-11-09 10:00 JST', rel.includes(`const RHYTHM_GRAND_OPEN_START_AT = '${START}';`));
ok('本オープンの印そのものは真(時刻が来たら開く)', /const RHYTHM_GRAND_OPEN_RELEASE = true;/.test(rel));
ok('RELEASE_FLAGS.rhythmGrandOpen は見るたびに時刻と比べる', /get rhythmGrandOpen\(\) \{ try \{ return RHYTHM_GRAND_OPEN_RELEASE === true && Date\.now\(\) >= Date\.parse\(RHYTHM_GRAND_OPEN_START_AT\); \} catch \(e\) \{ return false; \} \}/.test(rel));

// 本物の定義を、偽の時計で動かす
const pick = (from, to) => { const a = rel.indexOf(from); const b = rel.indexOf(to, a); return rel.slice(a, b + to.length); };
const consts = pick('const RHYTHM_GRAND_OPEN_RELEASE = true;', "const RHYTHM_GRAND_OPEN_START_AT = '2026-11-09T10:00:00+09:00';");
const giftPart = rel.slice(rel.indexOf('const NEW_PLAYER_CAMPAIGN_GIFT_GRAND = Object.freeze({'), rel.indexOf('// ===== ゲーム内アイテムをそのまま入れられるギフト'));
const getter = /get rhythmGrandOpen\(\) \{[^}]*\}[^}]*\}[^}]*\},/.exec(rel)[0];
const run = (ms) => {
  const ctx = { Object, Number, Math, Array, JSON, String, Date: class extends Date { static now() { return ms; } constructor(...a) { super(...(a.length ? a : [ms])); } } };
  vm.createContext(ctx);
  vm.runInContext(`${consts}\nconst NEW_PLAYER_CAMPAIGN_GIFT = { id:'monhiro_beat_preopen_new_player_v1' };\nconst NEW_PLAYER_CAMPAIGN_ENABLED = true;\n${giftPart}\nconst RELEASE_FLAGS = { ${getter} };\nthis.out = { flag: RELEASE_FLAGS.rhythmGrandOpen, released: rhythmGrandOpenReleased(), gift: grantGrandOpenAllGift([], { done:false, onboarded:true }).granted, again: grantGrandOpenAllGift(grantGrandOpenAllGift([], { done:false, onboarded:true }).gifts, { done:false, onboarded:true }).granted, done: grantGrandOpenAllGift([], { done:true, onboarded:true }).granted, newDef: newPlayerCampaignGiftDef().id };`, ctx);
  return ctx.out;
};
const before = run(startMs - 1000);
const atStart = run(startMs);
const after = run(startMs + 6 * 3600 * 1000);
ok('9:59:59 は本オープン前(印は偽・記念ギフトは配らない・新しく始める人はプレオープン記念)', before.flag === false && before.released === false && before.gift === false && before.newDef === 'monhiro_beat_preopen_new_player_v1', JSON.stringify(before));
ok('10:00:00 ちょうどで本オープン(印は真・記念ギフトを配る・新しく始める人は本オープン記念)', atStart.flag === true && atStart.released === true && atStart.gift === true && atStart.newDef === 'monhiro_beat_grand_open_new_player_v1', JSON.stringify(atStart));
ok('本オープンのあとも開いたまま', after.flag === true && after.gift === true, JSON.stringify(after));
ok('記念ギフトは二度配らない(同じギフトがある・配った印がある)', atStart.again === false && atStart.done === false);

// 更新履歴・助手の告知の時刻
const cl = read('monster-hero/data/changelog.js');
ok('本編の更新履歴は 11/9 10:00 に出(?:始|はじ)める(date と visibleFrom がそろっている)', /date: "2026-11-09 10:00", visibleFrom:'2026-11-09T10:00:00\+09:00', type:'update', group:'rhythm', title:'モンヒロビート本オープン記念のプレゼント'/.test(cl));
ok('予告の助手の告知は、本オープンの時刻で止まる', /id:'update_notice_rhythm_grand_open_teaser_v1', type:'content', notifyUntil:'2026-11-09T10:00:00\+09:00'/.test(cl));
// 開いたままの端末: HOME のお話は印を見るたびに読む(本編のお話・予告のお話の切り替え)
const app = read('monster-hero/src/parts/60-app.jsx');
ok('HOME のお話は、そのときの印で本編/予告を決める', /const open = RELEASE_FLAGS\.rhythmGrandOpen === true;\n\s*const id = open \? RHYTHM_GRAND_OPEN_STORY_ID : \(RELEASE_FLAGS\.rhythmGrandOpenTeaser === true \? RHYTHM_GRAND_OPEN_TEASER_STORY_ID : null\);/.test(app));
ok('新しく始めた人へ本オープン記念を配ったら、全員向けの記念ギフトの印も立てる(時刻で判断)', /if \(rhythmGrandOpenReleased\(\)\) await storeSet\(GRAND_OPEN_ALL_GIFT_KEY, true, false\);/.test(app));
// 本オープンのあとは、曲えらびに「体験版」の札を出さない(2026-11-08 ミハリ S1)
const scr = read('monster-hero/src/parts/58-screen-rhythm.jsx');
ok('曲えらびの「体験版」の札は、本オープンのあとは出さない(デバッグの「記録しない」は出す)', /\{\(debugAll\|\|!\(typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS\.rhythmGrandOpen===true\)\)&&<span data-rhythm-demo-badge/.test(scr));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
