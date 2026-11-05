#!/usr/bin/env node
// レジェンドブリーダー優待パス(2026-11-05 社長)の決まりを見張る。
//   node tools/market/legend-breeder-pass-check.js
// ・ブリーダーレベル1000に届いた人の HOME で、お話「レジェンドブリーダーへの招待状」を一度だけ流す
// ・見た印は新しいキー mh_beat_shop_vip_letter_seen_v1。見た(飛ばした)あとだけ、ビートP交換所の3つが優待パス還元になる
// ・お話の中では数字を言わない/「値下げ」「安く」と言わない/更新履歴には書かない/ヘルプは受け取った人だけ
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const ev=read('monster-hero/data/rhythm-event.js');
const ctx={console};vm.createContext(ctx);
vm.runInContext(`${ev}\nthis.out={RHYTHM_EVENT_POINT_SHOP_OFFERS,LEGEND_BREEDER_PASS_LEVEL,LEGEND_BREEDER_PASS_OFFERS,rhythmEventPointShopOfferWithPass,rhythmEventPointExchangePreview};`,ctx);
const E=ctx.out;
ok('優待パスは Lv1000 から',E.LEGEND_BREEDER_PASS_LEVEL===1000);
const want={diamond_300:[1,5000],training_ticket_x3:[1,50],training_ticket_l:[9,50]};
ok('優待パスの対象はダイヤ・トレーニングチケット・重トレーニングチケットの3つだけ',JSON.stringify(Object.keys(E.LEGEND_BREEDER_PASS_OFFERS).sort())===JSON.stringify(Object.keys(want).sort()));
for(const [id,[cost,grant]] of Object.entries(want)){
  const base=E.RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o=>o.id===id);
  const pass=E.rhythmEventPointShopOfferWithPass(base,true),plain=E.rhythmEventPointShopOfferWithPass(base,false);
  ok(`${id}: パスがあると ${cost}P→${grant}`,pass.cost===cost&&pass.grantAmount===grant&&pass.legendPass===true&&pass.baseCost===base.cost&&pass.baseGrantAmount===base.grantAmount);
  ok(`${id}: パスが無ければいつもの交換のまま`,plain===base);
  const r=E.rhythmEventPointExchangePreview({offer:pass,eventPoints:cost*3,gold:0,ownedItems:{},quantity:3});
  ok(`${id}: 3回ぶんの交換が正しく計算される`,r.ok&&r.eventPoints===0&&(base.kind==='diamond'?r.gold===grant*3:r.ownedItems[base.itemId]===grant*3));
}
// いつもの値段は変えていない
ok('いつもの値段はそのまま(ダイヤ 5P→300 / チケット 5P→3枚 / 重チケット 15P→1枚)',
  [['diamond_300',5,300],['training_ticket_x3',5,3],['training_ticket_l',15,1]].every(([id,c,g])=>{const o=E.RHYTHM_EVENT_POINT_SHOP_OFFERS.find(x=>x.id===id);return o&&o.cost===c&&o.grantAmount===g;}));
// 大きい数でも計算が切れない
const big=E.rhythmEventPointExchangePreview({offer:E.rhythmEventPointShopOfferWithPass(E.RHYTHM_EVENT_POINT_SHOP_OFFERS[0],true),eventPoints:100000,gold:0,ownedItems:{},quantity:100000});
ok('10万回ぶんの交換(5億ダイヤ)でも切れずに計算される',big.ok&&big.gold===500000000&&big.eventPoints===0);

// お話
const as=read('monster-hero/data/assistants.js');
const story=as.slice(as.indexOf('const LEGEND_BREEDER_PASS_STORY = ['),as.indexOf('];',as.indexOf('const LEGEND_BREEDER_PASS_STORY = [')));
ok('お話の台本がある',story.length>100);
ok('お話の中で交換の数字を言わない',!/\d+P|5,000|5000|50枚|→/.test(story.replace(/ブリーダーレベル1000/g,'')));
ok('お話の中で「値下げ」「安く」と言わない',!/値下げ|安く|安い/.test(story));
ok('お話の中で優待パスが届く',story.includes('レジェンドブリーダー優待パスが届きました'));
ok('イベント回想に入っていて、見た人だけ見直せる',/id: 'legend_breeder_pass_2026_11'[^\n]*unlockedKey: 'legendBreederPassSeen'/.test(as));

// 本体
const parts=['17-release-changelog-login-missions.jsx','60-app.jsx','55-screen-breeder-market.jsx','21-assistant.jsx'].map(f=>read(`monster-hero/src/parts/${f}`)).join('\n');
ok('見た印は新しいキー mh_beat_shop_vip_letter_seen_v1',parts.includes("LEGEND_BREEDER_PASS_SEEN_KEY = 'mh_beat_shop_vip_letter_seen_v1'"));
ok('レベルが1000に届いてからだけ流す',/Number\(breederLevel\?\.level\) >= LEGEND_BREEDER_PASS_LEVEL/.test(parts));
ok('最後まで見ても、飛ばしても印を立てる(本編のときだけ)',(parts.match(/LEGEND_BREEDER_PASS_STORY_ID[^\n]*live&&!eventReplay\.debug[^\n]*markLegendPassSeen|live&&!eventReplay\.debug&&event&&event\.id===LEGEND_BREEDER_PASS_STORY_ID\) markLegendPassSeen/g)||[]).length>=2);
ok('交換するときは、画面の値段を使わず保存の印から決め直す',/LEGEND_BREEDER_PASS_OFFERS\[offer\.id\][\s\S]{0,400}storeGet\(LEGEND_BREEDER_PASS_SEEN_KEY[\s\S]{0,200}rhythmEventPointShopOfferWithPass\(base, hasPass\)/.test(parts));
// 画面に出る文字(> と < のあいだ)に「値下げ」「安く」が無いこと。説明のための注記(// …)は見ない
const passCard=parts.slice(parts.indexOf('const passPart='),parts.indexOf('const middle=passPart'));
ok('交換所の札は「優待パス還元」で、値下げとは書かない',parts.includes('🎫 優待パス還元')&&passCard.length>0&&!/値下げ|安く/.test(passCard));
ok('見ていない人(Lv1000以上)には「優待パスの手紙を読む」',parts.includes('🎫 優待パスの手紙を読む')&&/legendPassLetterAvailable=\{legendPassSeenLoaded&&!legendPassSeenFlag&&Number\(breederLevel\?\.level\)>=LEGEND_BREEDER_PASS_LEVEL\}/.test(parts));
ok('ヘルプの本文は、受け取った人だけに描く(playerFlag)',parts.includes('helpPlayerFlagOn(b.playerFlag)')&&parts.includes('HELP_PLAYER_FLAGS.legendBreederPass = legendPassSeenFlag === true'));

// ヘルプ・更新履歴・助手の要約
const help=read('monster-hero/data/help.js');
ok('ヘルプの「レジェンドブリーダー優待パス」は playerFlag つき',/playerFlag:'legendBreederPass', title:'レジェンドブリーダー優待パス'/.test(help));
ok('更新履歴には書かない(社長)',!read('monster-hero/data/changelog.js').includes('レジェンドブリーダー'));
const digest=path.join(ROOT,'monster-hero/data/assistant-chat-digest.json');
ok('だれにでも話す助手の要約に入れない',!fs.existsSync(digest)||!fs.readFileSync(digest,'utf8').includes('レジェンドブリーダー優待パス'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
