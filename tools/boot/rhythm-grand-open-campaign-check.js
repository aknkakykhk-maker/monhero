#!/usr/bin/env node
// 本オープン記念キャンペーン(周回5倍・ビートP5倍。2026-11-09 10:00 〜 11-23 3:59)が、時刻どおりに開いて閉じるか(2026-11-08)。
//
//   node tools/boot/rhythm-grand-open-campaign-check.js
//
// 社長「本オープン開始したら5倍キャンペーンもありで。いまのパンドライベントのやつ」・期間は2週間。
// 実際の定義(data/rhythm-event.js と、周回の倍率を決める 10-core.jsx の関数)を vm で動かし、時計を合わせて確かめる。
//   ① 11/9 3:59:59 はパンドラ・4:00〜9:59:59 は5倍なし・10:00 から本オープン記念
//   ② 11/23 3:59:59 までは本オープン記念・4:00 で終わる
//   ③ 期間中は、どの曲でも周回 ×10(いつもの5倍)・ビートPは5倍(100万点・2分の曲で200P)
//   ④ 始まりは本オープンの時刻(RHYTHM_GRAND_OPEN_START_AT)と同じ・終わりは週の区切り(月曜4:00)
//   ⑤ 保存・ランキングには触らない(キャンペーンの定義にランキングのイベントを足していない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const eventSrc = read('monster-hero/data/rhythm-event.js');
const core = read('monster-hero/src/parts/10-core.jsx');
const grab = (src, name) => { const m = src.match(new RegExp(`const ${name} = [\\s\\S]*?\\n\\};\\n`)); return m ? m[0] : ''; };
const loopFns = ['rhythmPlayRunLoopScale', 'rhythmLoopCampaignAt'].map((n) => grab(core, n));
const consts = (core.match(/^const RHYTHM_PLAY_RUN_LOOP_(?:EVENT_)?SCALE = [^;]+;/gm) || []).join('\n');
check('周回の倍率を決める関数と定数を読める', loopFns.every(Boolean) && /RHYTHM_PLAY_RUN_LOOP_SCALE/.test(consts) && /RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE/.test(consts));
const ctx = { console, Date };
vm.createContext(ctx);
vm.runInContext(`${eventSrc}\nconst RHYTHM_DEMO_SONG_IDS = ['monster_hero','humanoid'];\n${consts}\n${loopFns.join('\n')}\n`
  + 'globalThis.api={rhythmEventPointCampaignAt,rhythmLoopCampaignAt,rhythmPlayRunLoopScale,rhythmEventPointAwardAt,rhythmLimitedEventAt,RHYTHM_EVENT_POINT_CAMPAIGNS};', ctx);
const A = ctx.api;
const at = (s) => Date.parse(s);
const id = (s) => { const c = A.rhythmEventPointCampaignAt(at(s)); return c ? c.id : null; };

// ①②
check('11/9 3:59:59 はまだパンドラ', id('2026-11-09T03:59:59+09:00') === 'pandora_wings_2026', String(id('2026-11-09T03:59:59+09:00')));
check('11/9 4:00 〜 9:59:59 は5倍なし', id('2026-11-09T04:00:00+09:00') === null && id('2026-11-09T09:59:59+09:00') === null);
check('11/9 10:00 から本オープン記念', id('2026-11-09T10:00:00+09:00') === 'grand_open_2026');
check('11/23 3:59:59 までは本オープン記念', id('2026-11-16T12:00:00+09:00') === 'grand_open_2026' && id('2026-11-23T03:59:59+09:00') === 'grand_open_2026');
check('11/23 4:00 で終わる', id('2026-11-23T04:00:00+09:00') === null);

// ③
const IN = at('2026-11-12T20:00:00+09:00');
const camp = A.rhythmEventPointCampaignAt(IN);
check('期間中は周回のキャンペーンとして出る(画面の案内も同じものを見る)', !!A.rhythmLoopCampaignAt(IN) && A.rhythmLoopCampaignAt(IN).id === 'grand_open_2026');
check('期間中は、どの曲でも周回 ×10(いつもの ×2 の5倍)', A.rhythmPlayRunLoopScale('monster_hero', A.rhythmLimitedEventAt(IN), camp) === 10 && A.rhythmPlayRunLoopScale('humanoid', null, camp) === 10);
check('期間の外は、周回 ×2 に戻る', A.rhythmPlayRunLoopScale('monster_hero', null, A.rhythmEventPointCampaignAt(at('2026-11-23T04:00:00+09:00'))) === 2);
check('期間中にランキングの期間限定イベントは開いていない(ビートPはキャンペーンの計算になる)', A.rhythmLimitedEventAt(IN) === null);
const award = A.rhythmEventPointAwardAt(IN, 'monster_hero', 1000000, 120000);
const awardOff = A.rhythmEventPointAwardAt(at('2026-11-23T04:00:00+09:00'), 'monster_hero', 1000000, 120000);
check('期間中のビートPは、いつもの5倍', !!award && !!awardOff && award.campaignId === 'grand_open_2026' && award.amount === awardOff.amount * 5, JSON.stringify({ in: award && award.amount, off: awardOff && awardOff.amount }));

// ④⑤
const release = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const startAt = (release.match(/const RHYTHM_GRAND_OPEN_START_AT = '([^']+)'/) || [])[1];
const def = A.RHYTHM_EVENT_POINT_CAMPAIGNS.find((c) => c.id === 'grand_open_2026');
check('始まりは本オープンの時刻と同じ', !!def && !!startAt && Date.parse(def.startAt) === Date.parse(startAt), `${def && def.startAt} / ${startAt}`);
check('終わりは月曜4:00(週の区切り)・案内は3:59', !!def && new Date(Date.parse(def.endAt) + 9 * 3600e3).getUTCDay() === 1 && def.endAt.endsWith('T04:00:00+09:00') && def.displayEndAt === '2026-11-23T03:59:00+09:00');
// 2026-11-14 社長: 何の本オープンか分かるよう、題を2行「モンヒロビート/本オープン記念」に(案B)
check('HOMEの札は「モンヒロビート/本オープン記念 開催中 〜11/23 3:59」', !!def && def.banner && def.banner.title === 'モンヒロビート' && def.banner.title2 === '本オープン記念' && def.banner.sub === '開催中 〜11/23 3:59');
check('ランキングのイベント(RHYTHM_EVENTS)には足していない', !/grand_open_2026/.test((eventSrc.match(/const RHYTHM_EVENTS = [\s\S]*?\n\]\);/) || [''])[0]));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
