#!/usr/bin/env node
// はじめての人に、時刻で流れるお話(ハロウィン・ナイトなど)を、バトルのれんしゅうの案内・れんしゅうより先に流さないこと
// (2026-10-10・改善部の指摘G8。れんしゅうの案内とお話が同時に重なって出ていた)。
// 順番は「れんしゅうの案内 →(見る/見ない)→ れんしゅう → HOME → お話」。実際の画面での確かめは、
// プレイボットの新人係(tools/playbot/scenarios/new-player.js の「会話が重なっている」)が毎回やる。
//
//   node tools/boot/story-after-battle-guide-check.js
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// HOMEでお話を流し始める判定の本体
const start = src.indexOf('if (!rhythmEventStoryPending) return;');
const body = src.slice(start, src.indexOf('setEventReplay({ id: storyId, step: 0, live: true });', start));
check('お話を流し始める判定が見つかる', start > 0 && body.length > 0);
check('れんしゅうの案内の判定が終わるまで、お話を流さない', /battleGuideChecked/.test(body));
check('れんしゅうの最中は、お話を流さない', /battleTutorialStep == null/.test(body));
check('既存の順番(きき・ももすけの紹介・設定中の案内)も見ている',
  /tutorialStep == null/.test(body) && /kikiIntroStep == null/.test(body) && /momosukeIntroStep == null/.test(body));

// れんしゅうの案内の判定: 出すと決めたのと同じタイミングで「判定が終わった」にする。村案内がこれからのときは終わりにしない
const g = src.indexOf('battleTutorialGuideCheckedRef.current = true;');
const guide = src.slice(g, src.indexOf('}, [bootPhase, gameState, dataLoaded, onboarded, tutorialStep]);', g));
check('案内を出すときは、案内と同時に判定済みにする', /setTutorialKind\('battleGuide'\); setTutorialStep\(0\); \}\s*setBattleGuideChecked\(true\)/.test(guide));
check('すでに見た人・断った人は、すぐ判定済みにする(お話を止め続けない)', /seen === true \|\| shown === true\) \{ setBattleGuideChecked\(true\)/.test(guide));
check('保存キーを増やしていない(判定済みは画面の状態だけ)', !/storeSet\([^)]*GuideChecked/.test(src));

if (failed) { console.error(`\n${failed}件の確認に失敗しました。`); process.exit(1); }
console.log('\nすべてOK');
