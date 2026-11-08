#!/usr/bin/env node
// 検査用の「お話を見た」の種(tools/boot/quiet-boot-seed.js の INTRO_STORY_KEY_IDS)に、本体のお話・紹介の既読の印が全部入っているかを見張る(2026-11-08 検査部ミハリ)。
//
//   node tools/boot/quiet-boot-seed-coverage-check.js
//
// なぜ: HOME で画面いっぱいに流れるお話・紹介は、既読の印が種に無いと、検査のたびに先に出てボタンを覆う。
//   「あたらしい助手」の紹介(きき・ももすけ)が種から漏れていて、ビート部の検査で紹介が先に出ていた(2026-11-08 テンポの報告)。
//   前にも、タクティクスの導入・話せるようになった日・4人のタイプで同じことが起きている(quiet-boot-seed.js のコメント)。
// 見ること:
//   ① parts の `const ◯◯_KEY = 'mh_…'` のうち、名前に INTRO・STORY・ENDING_REPLAY を含むもの(お話・紹介の既読の印)が、
//      INTRO_STORY_KEY_IDS か、下の「種に入れない理由」(NOT_SEED)のどちらかに入っている
//   ② INTRO_STORY_KEY_IDS の名前が、本体で全部見つかる(印の名前を変えたのに種が古いまま、を止める)
//   ③ NOT_SEED に、もう本体に無い名前が残っていない
//   ④ ブラウザで開く検査(addInitScript を使うもの)が、お話の既読(mh_rhythm_event_story_v1・紹介の既読)を手で書くなら、
//      そのあとに共通の種(eventStorySeed / quietBootSeed)も入れている。手で書いた並びだけだと、新しいお話が増えたとき
//      HOME で先に流れて落ちる(2026-11-08 飾り枠の検査がタクティクス「4人のタイプ」の回想で止まった)。
//      お話そのものを確かめる検査は STORY_TESTERS に理由つきで入れる
// プレイヤー側の挙動は変えない(検査の道具だけを見る)
'use strict';
const fs = require('fs');
const path = require('path');
const { INTRO_STORY_KEY_IDS, introStoryKeys, partsSource, eventStoryKey } = require('./quiet-boot-seed');

// ④で、お話の既読を自分で出し入れしてよい検査(お話・紹介そのものを確かめる)。足すときは理由を書く
const STORY_TESTERS = Object.freeze({
  'tools/boot/new-player-stories-browser-check.js': 'はじめて遊ぶ人のお話の流れそのものを確かめる',
  'tools/boot/event-replay-tap-check.js': 'イベント回想のお話を流して確かめる',
  'tools/boot/card-battle-intro-story-browser-check.js': 'MFバトルカードの導入のお話そのものを確かめる',
  'tools/assistant/assistant-chat-check.js': '話せるようになった日のお話そのものを確かめる',
});

// 種に入れない印と、その理由(足すときは理由を書く)
const NOT_SEED = Object.freeze({
  // MFバトルカードの🤖オートの吹き出し。お話ではなく、ONE_TIME_NOTICE_SCRIPT(oneTimeNoticeSeed)が見たことにする
  CARD_AUTO_INTRO_SEEN_KEY: 'oneTimeNoticeSeed が入れる(吹き出しで、お話ではない)',
  // HELL のお話の試し見(デバッグの見本)。プレイヤーの HOME では流れない
  RHYTHM_HELL_STORY_SEEN_PREVIEW_KEY: 'デバッグの試し見だけで使う(HOME では流れない)',
  // イベントの開幕・閉幕のお話。eventStorySeed(quietBootSeed の中)が RHYTHM_EVENT_STORY_IDS から別に入れる
  RHYTHM_EVENT_STORY_KEY: 'eventStorySeed が別に入れる',
  // 助手ライフの家の入場の演出。毎回出る作り(その日の最初は長い・タップで飛ばせる)で、既読で止めるものではない
  ASSISTANT_LIFE_INTRO_KEY: '毎回出る入場の演出(既読で止めない)',
  // HOME で1回だけの「はじめての差し入れ」の案内。助手ライフの検査が案内そのものを確かめるので、要る検査が自分で入れる
  ASSISTANT_LIFE_ITEM_INTRO_KEY: '案内そのものを確かめる検査がある(life-browser-shared の seed が intro で出し入れする)',
  // その画面の中に出る小さな案内(HOME で画面いっぱいに流れるお話ではない)
  AUTO_ENHANCE_INTRO_KEY: 'マスモンの自動強化の画面の中の案内',
  OFFERING_INTRO_KEY: '神殿のお布施の画面の中の案内',
  QUICK_RHYTHM_INTRO_KEY: 'クイックの∞からモンヒロビートへ行く所の案内',
  RHYTHM_LOOK_INTRO_KEY: '曲えらびの最初の1回の、見た目の設定の案内',
  RHYTHM_SIX_LANE_INTRO_KEY: '曲えらびの最初の1回の、6レーンの案内',
  TACTICS_EX_INTRO_KEY: 'タクティクスのバトルの中の、EX の案内',
  ALF_INTRO_KEY: '助手ライフのフレンドの画面の中の、はじめての案内(56-assistant-life-friend.jsx)',
  // 名前に STORY を含むだけで、お話の既読ではないもの
  CARD_PVP_HISTORY_KEY: 'MFバトルカードの対戦の記録(HISTORY)',
  STORY_ONE_AT_A_TIME_KEY: 'はじめて遊ぶ人のお話の流し方の印(既読ではない)',
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed += 1; };

const src = partsSource();
const found = [...src.matchAll(/const ([A-Z0-9_]+_KEY) = '(mh_[^']+)'/g)].map((m) => m[1]);
const storyKeys = [...new Set(found.filter((n) => /(INTRO|STORY|ENDING_REPLAY)/.test(n)))].sort();

const missing = storyKeys.filter((n) => !(n in INTRO_STORY_KEY_IDS) && !(n in NOT_SEED));
check('① お話・紹介の既読の印が、全部 種(INTRO_STORY_KEY_IDS)か NOT_SEED に入っている', !missing.length,
  missing.length ? `漏れ: ${missing.join(', ')} → tools/boot/quiet-boot-seed.js の INTRO_STORY_KEY_IDS へ足す` : `${storyKeys.length}件`);

const unresolved = Object.keys(INTRO_STORY_KEY_IDS).filter((n) => !found.includes(n));
check('② 種の名前が、本体で全部見つかる', !unresolved.length, unresolved.join(', '));
check('② 種から作る既読のキーの数が、種の名前の数と同じ', introStoryKeys().length === Object.keys(INTRO_STORY_KEY_IDS).length,
  `${introStoryKeys().length} / ${Object.keys(INTRO_STORY_KEY_IDS).length}`);

const stale = Object.keys(NOT_SEED).filter((n) => !found.includes(n));
check('③ NOT_SEED に、もう本体に無い名前が残っていない', !stale.length, stale.join(', '));

// ④ 手で書いた既読のあとに、共通の種が入っているか
const TOOLS = path.resolve(__dirname, '..');
const ROOT = path.resolve(TOOLS, '..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  if (d.name === 'node_modules' || d.name.startsWith('.')) return [];
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : (d.name.endsWith('.js') ? [p] : []);
});
const storyKeyNames = [eventStoryKey(), ...introStoryKeys()];
// 害になるのは、(a) 種をまったく入れず手で書いた並びだけのとき、(b) 種のあとに、お話の並び(mh_rhythm_event_story_v1)を一部だけで書き直すとき。
//   紹介の既読を true で書くのは種と同じなので害はない
const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const handWrite = new RegExp(`(?:put|set|s|setItem)\\(\\s*['"](${storyKeyNames.map(esc).join('|')})['"]`, 'g');
const listWrite = new RegExp(`(?:put|set|s|setItem)\\(\\s*['"]${esc(eventStoryKey())}['"]`, 'g');
const seedUse = /addInitScript\([^\n]*?(?:eventStorySeed|quietBootSeed)\(/g;
const late = [];
let looked = 0;
for (const file of walk(TOOLS)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (rel === 'tools/boot/quiet-boot-seed.js' || rel === 'tools/boot/quiet-boot-seed-coverage-check.js' || rel in STORY_TESTERS) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!/addInitScript/.test(src) || !handWrite.test(src)) continue;
  handWrite.lastIndex = 0;
  looked += 1;
  const seeds = [...src.matchAll(seedUse)].map((m) => m.index);
  const lists = [...src.matchAll(listWrite)].map((m) => m.index);
  if (!seeds.length || (lists.length && !seeds.some((i) => i > Math.max(...lists)))) late.push(rel);
}
check('④ お話の既読を手で書く検査は、そのあとに共通の種(eventStorySeed / quietBootSeed)も入れている', !late.length,
  late.length ? `${late.join(', ')} → 手で書いた seed の addInitScript のすぐあとに await page.addInitScript(eventStorySeed()) を足す(お話そのものの検査なら STORY_TESTERS へ理由つきで)` : `${looked}本`);
const goneTesters = Object.keys(STORY_TESTERS).filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
check('④ STORY_TESTERS に、もう無い検査が残っていない', !goneTesters.length, goneTesters.join(', '));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
