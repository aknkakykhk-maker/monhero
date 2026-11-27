#!/usr/bin/env node
// クリスマスイベントのモンヒロビート5倍(周回5倍・ビートP5倍。2026-11-30 0:00 〜 12-31 3:59・イベントの開幕 11/28 10:00 より遅い・r1126-063)が、時刻どおりに開いて閉じるか(2026-11-25)。
//
//   node tools/boot/rhythm-xmas-campaign-check.js
//
// 台帳 r1119-172 追記(期間中のボーナス)・追跡 r1125-044。社長「本オープン記念・パンドライベントと同じ形」。
// 実際の定義(data/rhythm-event.js と、周回の倍率を決める 10-core.jsx の関数)を vm で動かし、時計を合わせて確かめる。
//   ① 11/29 23:59:59 までは前のイベント(咲かせて！ハナウタ・ノート / 本オープン記念)。11/30 0:00 からクリスマス(すき間も重なりも無し・社長「重複無し」)
//      (重ならない = 倍率が重なることはない。前の終わりとクリスマスの始まりのあいだは、いつもの倍率)
//   ② 12/31 3:59:59 まではクリスマス・4:00 で終わる
//   ③ 期間中は、どの曲でも周回 ×10(いつもの5倍)・ビートPは5倍(100万点・2分の曲で200P)。前の本オープン記念と同じ数字
//   ④ 期間中、11/30 の境目の前後で倍率がずれない(前のイベントの公開曲の5倍と同じ量・イベント曲だけの7倍はクリスマスへ持ち越さない)
//   ⑤ 保存・ランキングには触らない(ランキングのイベント RHYTHM_EVENTS に足していない)。開始の前は数えない
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
check('周回の倍率を決める関数と定数を読める', loopFns.every(Boolean) && /RHYTHM_PLAY_RUN_LOOP_SCALE/.test(consts));
const ctx = { console, Date };
vm.createContext(ctx);
vm.runInContext(`${eventSrc}\nconst RHYTHM_DEMO_SONG_IDS = ['monster_hero','humanoid'];\n${consts}\n${loopFns.join('\n')}\n`
  + 'globalThis.api={rhythmEventPointCampaignAt,rhythmLoopCampaignAt,rhythmPlayRunLoopScale,rhythmEventPointAwardAt,rhythmLimitedEventAt,RHYTHM_EVENT_POINT_CAMPAIGNS};', ctx);
const A = ctx.api;
const at = (s) => Date.parse(s);
const id = (s) => { const c = A.rhythmEventPointCampaignAt(at(s)); return c ? c.id : null; };
const def = A.RHYTHM_EVENT_POINT_CAMPAIGNS.find((c) => c.id === 'xmas_2026');
check('キャンペーン xmas_2026 がある', !!def);

// ①②
const before = id('2026-11-29T23:59:59+09:00');
check('11/29 23:59:59 は前のイベント(クリスマスではない)', before !== 'xmas_2026' && before !== null, String(before));
check('11/28 10:00(イベントの開幕)にはまだクリスマスの5倍ではない', id('2026-11-28T10:05:00+09:00') !== 'xmas_2026');
check('11/30 0:00 ちょうどからクリスマス(すき間なし)', id('2026-11-30T00:00:00+09:00') === 'xmas_2026' && def && def.startAt === '2026-11-30T00:00:00+09:00');
check('期間のあいだ、ほかのキャンペーンと重ならない(どの時刻でもクリスマスだけ)',
  A.RHYTHM_EVENT_POINT_CAMPAIGNS.filter((c) => c.id !== 'xmas_2026').every((c) => Date.parse(c.endAt) <= Date.parse(def.startAt) || Date.parse(c.startAt) >= Date.parse(def.endAt)));
check('12/31 3:59:59 まではクリスマス・4:00 で終わる', id('2026-12-31T03:59:59+09:00') === 'xmas_2026' && id('2026-12-31T04:00:00+09:00') === null);
check('案内の終わりは 12/31 3:59', def && def.displayEndAt === '2026-12-31T03:59:00+09:00' && def.banner && def.banner.sub === '開催中 〜12/31 3:59');

// ③
const IN = at('2026-12-10T20:00:00+09:00');
const camp = A.rhythmEventPointCampaignAt(IN);
check('期間中は周回のキャンペーンとして出る(画面の案内も同じものを見る)', !!A.rhythmLoopCampaignAt(IN) && A.rhythmLoopCampaignAt(IN).id === 'xmas_2026');
check('期間中は、どの曲でも周回 ×10(いつもの ×2 の5倍)', A.rhythmPlayRunLoopScale('monster_hero', A.rhythmLimitedEventAt(IN), camp) === 10 && A.rhythmPlayRunLoopScale('humanoid', null, camp) === 10);
check('期間の外(12/31 4:00)は、周回 ×2 に戻る', A.rhythmPlayRunLoopScale('monster_hero', null, A.rhythmEventPointCampaignAt(at('2026-12-31T04:00:00+09:00'))) === 2);
check('期間中にランキングの期間限定イベントは開いていない(ビートPはキャンペーンの計算になる)', A.rhythmLimitedEventAt(IN) === null);
const award = A.rhythmEventPointAwardAt(IN, 'monster_hero', 1000000, 120000);
const awardOff = A.rhythmEventPointAwardAt(at('2026-12-31T04:00:00+09:00'), 'monster_hero', 1000000, 120000);
check('期間中のビートPは、いつもの5倍', !!award && !!awardOff && award.campaignId === 'xmas_2026' && award.amount === awardOff.amount * 5, JSON.stringify({ in: award && award.amount, off: awardOff && awardOff.amount }));

// ④ 境目の前後: 前のイベントの公開曲(イベント曲でない曲)と同じ量
const lastBefore = A.rhythmEventPointAwardAt(at('2026-11-29T23:00:00+09:00'), 'humanoid', 1000000, 120000);
const firstXmas = A.rhythmEventPointAwardAt(at('2026-11-30T00:00:00+09:00'), 'humanoid', 1000000, 120000);
check('11/30 の境目の前後で、公開曲のビートPが同じ(5倍のまま)', !!lastBefore && !!firstXmas && lastBefore.amount === firstXmas.amount, JSON.stringify({ before: lastBefore && lastBefore.amount, xmas: firstXmas && firstXmas.amount }));
const loopBefore = A.rhythmPlayRunLoopScale('humanoid', A.rhythmLimitedEventAt(at('2026-11-29T23:00:00+09:00')), A.rhythmEventPointCampaignAt(at('2026-11-29T23:00:00+09:00')));
check('11/30 の境目の前後で、周回の倍率が同じ(×10)', loopBefore === 10 && A.rhythmPlayRunLoopScale('humanoid', null, A.rhythmEventPointCampaignAt(at('2026-11-30T00:00:00+09:00'))) === 10, String(loopBefore));
check('イベント曲だけの7倍(targetBoost)はクリスマスへ持ち越さない', def && !('targetBoost' in def));

// ⑤
check('開始の前(11/29 23:59)はクリスマスとして数えない(定義は時刻で数え直す)', (A.rhythmLoopCampaignAt(at('2026-11-29T23:59:00+09:00')) || {}).id !== 'xmas_2026');
check('ランキングのイベント(RHYTHM_EVENTS)には足していない', !/xmas_2026/.test((eventSrc.match(/const RHYTHM_EVENTS = [\s\S]*?\n\]\);/) || [''])[0]));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
