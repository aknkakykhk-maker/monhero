#!/usr/bin/env node
// MFバトルカードの画面にいるあいだ、裏の周回(裏クイック)の曲・ジングルがカードの曲に割り込まないかの検査(台帳 r1126-101 追記2)
//   社長「カードバトル中に裏クイックまとめたら裏の音楽が割り込んでくる」
//
//   node tools/card/card-quick-bgm-check.js
//
// 見るもの(60-app.jsx の bgmKeyForState を取り出して、本当に呼んで確かめる)
//   ① カードの画面(CARD_TOP・CARD_BATTLE)では、裏の周回が負け・やめ(isGameOver)でもカードの曲のまま(ゲームオーバーの曲にしない)
//   ② パックを開ける画面(CARD_PACK_OPEN)も HOME の曲のまま
//   ③ ふつうのバトルの負けは今までどおりゲームオーバーの曲(壊していない)
//   ④ 敵を倒したジングルは、カードの画面で裏の周回が回っているあいだは鳴らさない(事件簿・イベントページと同じ条件の並び)
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '60-app.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// bgmKeyForState の本体を切り出す(次の「const bgmPreloadKeys」の手前まで)
const start = src.indexOf('const bgmKeyForState = (');
const end = src.indexOf('const bgmPreloadKeys = (', start);
check('bgmKeyForState が見つかる', start > 0 && end > start);
const body = src.slice(start, end);
// 中で使う名前は、ここで決めた物を渡す(曲の名前は印の文字にする)
const names = ['eventLineBgm', 'eventBgmScene', 'battleBgmOverlay', 'assistantLifeOpenNow', 'raidJackRunRef', 'RAID_JACK_BGM_STATES', 'raidEvRef', 'HALLOWEEN_NIGHT_START_AT', 'HALLOWEEN_NIGHT_END_AT',
  'RELEASE_FLAGS', 'raidJackWindowAt', 'raidJackDebugForce', 'bgmArrangement', 'DEFAULT_BGM_ARRANGEMENT', 'RAID_JACK_BGM_TRACK', 'xmasEventBgmOpenAt', 'XMAS_HOME_BGM_TRACK', 'debugBattleRef', 'autoRepeatRef',
  'BGM_SILENT_STATES', 'cardBgm', 'BGM_STATE_MAP', 'bgmArrangementWithEventDefault', 'PROFILE_BGM_STATES', 'ASSISTANT_LIFE_BGM_TRACK', 'XMAS_RAID_BATTLE_BGM_TRACK', 'RAID_JACK_BATTLE_BGM_TRACK', 'XMAS_EVENT_BGM_TRACK', 'BGM_TRACK_BY_ID'];
const arr = { home: 'HOME曲', gameOver: 'ゲームオーバー曲', clear: 'クリア曲', result: 'リザルト曲', enhance: '強化曲', battle: 'バトル曲', normal: '通常曲' };
const env = {
  eventLineBgm: null, eventBgmScene: null, battleBgmOverlay: null, assistantLifeOpenNow: false, raidJackRunRef: { current: null }, RAID_JACK_BGM_STATES: [], raidEvRef: { current: 'jack' },
  HALLOWEEN_NIGHT_START_AT: '2000-01-01T00:00:00Z', HALLOWEEN_NIGHT_END_AT: '2000-01-02T00:00:00Z', RELEASE_FLAGS: {}, raidJackWindowAt: () => 'closed', raidJackDebugForce: false,
  bgmArrangement: arr, DEFAULT_BGM_ARRANGEMENT: { home: 'ちがう' }, RAID_JACK_BGM_TRACK: 'ジャック曲', xmasEventBgmOpenAt: () => false, XMAS_HOME_BGM_TRACK: 'X曲', debugBattleRef: { current: false },
  autoRepeatRef: { current: false }, BGM_SILENT_STATES: [], cardBgm: 'カードの対戦曲', BGM_STATE_MAP: {}, bgmArrangementWithEventDefault: (a, k) => a[k], PROFILE_BGM_STATES: [],
  ASSISTANT_LIFE_BGM_TRACK: 'ライフ曲', XMAS_RAID_BATTLE_BGM_TRACK: 'winter', RAID_JACK_BATTLE_BGM_TRACK: 'Monster', XMAS_EVENT_BGM_TRACK: 'Kiss', BGM_TRACK_BY_ID: {},
};
let fn = null;
try {
  // 本体の中で使うほかの名前(modeBgm など)は、カードの画面と負けの道では通らない
  fn = new Function(...names, `${body.replace(/;\s*$/, '')}; return bgmKeyForState;`)(...names.map((k) => env[k]));
} catch (e) { check('bgmKeyForState を組み立てられる', false, String(e.message).slice(0, 200)); }
if (fn) {
  check('① 対戦中(CARD_BATTLE)に裏の周回がやめ・負けでも、カードの曲のまま', fn('CARD_BATTLE', 3, null, false, true) === 'カードの対戦曲', fn('CARD_BATTLE', 3, null, false, true));
  check('① カードのトップ(CARD_TOP)でも、カードの曲のまま', fn('CARD_TOP', 3, null, false, true) === 'カードの対戦曲', fn('CARD_TOP', 3, null, false, true));
  env.cardBgm = null;
  const top = new Function(...names, `${body.replace(/;\s*$/, '')}; return bgmKeyForState;`)(...names.map((k) => env[k]));
  check('① カードの曲が無いときは HOME の曲(ゲームオーバーの曲にしない)', top('CARD_TOP', 3, null, false, true) === 'HOME曲', top('CARD_TOP', 3, null, false, true));
  check('② パックを開ける画面も HOME の曲のまま', top('CARD_PACK_OPEN', 3, null, false, true) === 'HOME曲', top('CARD_PACK_OPEN', 3, null, false, true));
  check('③ ふつうのバトルの負けはゲームオーバーの曲', top('BATTLE', 3, 'X', false, true) === 'ゲームオーバー曲', top('BATTLE', 3, 'X', false, true));
}
// ④ ジングル
const jingle = src.split('\n').find((l) => /Audio_\.playJingle\('victory'\)/.test(l)) || '';
check('④ 敵を倒したジングルは、カードの画面で裏の周回が回っているあいだ鳴らさない', /!\(runBackgroundAllowedRef\.current\s*&&\s*\(.*isCardRunScreen\(gameStateNowRef\.current\)\)\)\)\s*Audio_\.playJingle/.test(jingle), jingle.trim().slice(0, 160));
console.log(failed ? `NG ${failed} 件` : 'OK: カードの画面で裏クイックの曲が割り込まない');
process.exit(failed ? 1 : 0);
