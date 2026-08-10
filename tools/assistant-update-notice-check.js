#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const assistants = fs.readFileSync('monster-hero/data/assistants.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const context = {};
vm.runInNewContext(`${assistants}\nthis.notices=ASSISTANT_UPDATE_NOTICES;`, context);
const notices = context.notices;
assert(Array.isArray(notices) && notices.length, '検証用通知が必要です');
assert.strictEqual(new Set(notices.map(n=>n.id)).size, notices.length, '通知IDは一意である必要があります');
notices.forEach(n=>{ assert(n.title && n.expression && Array.isArray(n.pages) && n.pages.length); });
assert(notices.filter(n=>n.debugOnly!==true).every(n=>n.id!=='update_notice_debug_v1'), 'テスト通知を通常配信してはいけません');
const nightmareNotice = notices.find(n=>n.id==='update_notice_nightmare_v1');
assert(nightmareNotice && nightmareNotice.enabled && nightmareNotice.debugOnly!==true, 'NIGHTMARE正式追加通知が必要です');
assert(notices.some(n=>n.id==='update_notice_extreme_challenge_v1') && nightmareNotice.id!=='update_notice_extreme_challenge_v1', 'EXTREMEとは別の通知IDが必要です');

assert(game.includes("const UPDATE_NOTICE_SEEN_KEY = 'mh_seen_update_notices_v1'"));
assert(game.includes('new Set((Array.isArray(value) ? value : [])'), '不正値の正規化と重複除去が必要です');
assert(game.includes('else await storeSet(UPDATE_NOTICE_SEEN_KEY'), '新規プレイヤーの既存通知seedが必要です');
assert(game.includes('await storeSet(UPDATE_NOTICE_SEEN_KEY, normalizeSeenUpdateNoticeIds([...seen, current.id])'), '終了時の既読保存が必要です');
assert(!/BUILD_DATE[^\n]*ASSISTANT_UPDATE_NOTICES|ASSISTANT_UPDATE_NOTICES[^\n]*BUILD_DATE/.test(game+assistants), 'BUILD_DATEと通知を連動してはいけません');
assert(game.includes("destination === 'market'") && game.includes("setGameState('BREEDER_MARKET')"));
assert(game.includes("destination === 'battle'") && game.includes("setGameState('BATTLE_MODE_SELECT')"));
assert(game.includes("destination === 'training'") && game.includes("setGameState('TRAINING_INFO')"));
assert(game.includes("notice.destination?'あとで':'閉じる'"));
console.log('assistant update notice check: OK');
