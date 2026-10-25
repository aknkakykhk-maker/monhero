#!/usr/bin/env node
// お話「MFバトルカード ～物置の古い箱～」(card_battle_intro_2026・2026-10-24)の台本と、公開のつなぎ方を見張る。
// 台本: docs/playbot/reports/2026-10-24/card-battle-intro/story.md / 決まり: docs/spec/CARD_BATTLE.md 7-3
//
//   node tools/boot/card-battle-intro-story-check.js
//
//   ① あつの解放あり/なしの2通りで、行の数が台本どおり。解放していない子は一度も出ない
//     きゅうこは最初から選べる(台帳 #53・assistantKyuko は公開済み)ので、分かれ(kyuko の印)は付けない。きゅうこの公開の印が偽でも同じ台本
//   ② きゅうこの印(kyuko:'with'/'without')を足しても、印の無い台本・あつの印だけの台本の結果は変わらない
//   ③ 話し方の決まり(あつは文末に笑か記号・みゅあは「てか」を言わない・ききは初めての人)
//   ④ 公開の印が偽のあいだは流れない。本編で見た(飛ばした)ときだけ mh_story_card_battle_seen_v1 を立て、見終えたら CARD_TOP へ
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const load = (kyukoReleased) => {
  const ctx = { JACK_ICON_IMG: 'images/raid/jack-icon.png', RELEASE_FLAGS: { assistantAtsu: true, assistantKyuko: kyukoReleased } };
  vm.createContext(ctx);
  vm.runInContext(`${read('monster-hero/data/assistants.js')}\nglobalThis.__e={EVENT_REPLAYS,ASSISTANT_CARD_BATTLE_INTRO,RAID_JACK_STORY_6,ASSISTANT_KYUKO_JOIN_STORY,ASSISTANT_TACTICS_TYPES,eventScriptForPlayer};`, ctx);
  return ctx.__e;
};
const on = load(true), off = load(false);
const ATSU = ['atsu_join_2026_10_22'];
// ① 2通り(きゅうこはいつも出る)
const want = [[on, ATSU, 49, true, true], [on, [], 41, false, true]];
for (const [e, seen, n, atsu, kyuko] of want) {
  const lines = e.eventScriptForPlayer(e.ASSISTANT_CARD_BATTLE_INTRO, seen);
  const label = `あつ${atsu ? 'あり' : 'なし'}・きゅうこ${kyuko ? 'あり' : 'なし'}`;
  check(`① ${label}: ${n}行`, lines.length === n, `${lines.length}行`);
  const text = lines.map((l) => `${l.who}:${l.t}`).join('\n');
  check(`① ${label}: いない子は出ない(話す人にも、セリフにも)`,
    (atsu || (!/(^|\n)atsu:/.test(text) && !/あつ/.test(text))) && (kyuko || (!/(^|\n)kyuko:/.test(text) && !/きゅうこ/.test(text))));
}
// ② 前からある台本の結果は変わらない
for (const [name, script] of [['ハロウィン第6部', on.RAID_JACK_STORY_6], ['きゅうこの加入', on.ASSISTANT_KYUKO_JOIN_STORY], ['4人のタイプ', on.ASSISTANT_TACTICS_TYPES]]) {
  for (const seen of [ATSU, []]) {
    const atsuOn = seen.length > 0;
    const old = script.filter((l) => !l || (l.atsu !== 'with' && l.atsu !== 'without') || ((l.atsu === 'with') === atsuOn));
    check(`② ${name}(あつ${atsuOn ? 'あり' : 'なし'}): 前と同じ行`, JSON.stringify(on.eventScriptForPlayer(script, seen)) === JSON.stringify(old));
  }
}
// ③ 話し方
const all = on.ASSISTANT_CARD_BATTLE_INTRO;
const bad = (who, re) => all.filter((l) => l.who === who && re.test(l.t)).map((l) => l.t);
check('③ あつのセリフは、文末に笑か記号', bad('atsu', /[^笑！？…!?)）]$/).length === 0, bad('atsu', /[^笑！？…!?)）]$/).join(' / '));
check('③ みゅあは「てか」と言わない(あつの口ぐせ)', bad('mua', /てか/).length === 0, bad('mua', /てか/).join(' / '));
check('③ ききは遊んだことがない(経験者はドラ・あつ)', bad('kiki', /遊んだことがあり|やってました|なつかしい/).length === 0);
check('③ きゅうこは分かれ(kyuko の印)を付けない・公開の印が偽でも同じ台本', all.every((l) => l.kyuko === undefined) && JSON.stringify(off.eventScriptForPlayer(off.ASSISTANT_CARD_BATTLE_INTRO, ATSU)) === JSON.stringify(on.eventScriptForPlayer(all, ATSU)));
check('③ きゅうこは初めての人(経験者はドラ・あつ・台帳 #115)', bad('kyuko', /任せて|細かい|昔|やってた|なつかしい/).length === 0, bad('kyuko', /任せて|細かい|昔|やってた|なつかしい/).join(' / '));
check('③ 黄色の箱は「一発逆転」の言い方(台帳 #118・前の「一発で決める」は使わない)', !all.some((l) => /一発で決める|一発必殺/.test(l.t)));
check('③ きゅうこは1文に笑とwを両方付けない', bad('kyuko', /笑w|w笑/).length === 0);
check('③ 印は atsu/kyuko の with/without だけ', all.every((l) => [l.atsu, l.kyuko].every((v) => v === undefined || v === 'with' || v === 'without')));
const ev = on.EVENT_REPLAYS.find((x) => x.id === 'card_battle_intro_2026');
check('③ 回想に並ぶ(新しい遊びのお話・公開の印 cardBattle・見た印 cardBattleIntroSeen)', !!ev && ev.group === 'update' && ev.releaseFlag === 'cardBattle' && ev.unlockedKey === 'cardBattleIntroSeen' && ev.script === all);
// ④ つなぎ方
const core = read('monster-hero/src/parts/10-core.jsx'), rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx'), app = read('monster-hero/src/parts/60-app.jsx');
check('④ 公開の印は RELEASE_FLAGS.cardBattle を見るたびに引く(getter)', /get cardBattle\(\) \{ return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS\.cardBattle === true; \}/.test(core));
check('④ 新しい保存キー mh_story_card_battle_seen_v1 と id', /const CARD_BATTLE_INTRO_STORY_SEEN_KEY = 'mh_story_card_battle_seen_v1';/.test(rel) && /const CARD_BATTLE_INTRO_STORY_ID = 'card_battle_intro_2026';/.test(rel));
check('④ 公開の印が偽なら流さない・読み込みも印のあと', /if \(!EVENT_REPLAY_RELEASE_FLAGS\.cardBattle\) return;\s*if \(!cardBattleIntroSeenLoaded \|\| cardBattleIntroSeenFlag\) return;/.test(app)
  && /if \(EVENT_REPLAY_RELEASE_FLAGS\.cardBattle\) \{\s*try \{ setCardBattleIntroSeenFlag\(\(await storeGet\(CARD_BATTLE_INTRO_STORY_SEEN_KEY, false, false\)\) === true\)/.test(app));
check('④ ほかのお話が先なら上書きしない', /setRhythmEventStoryPending\(prev => prev \|\| CARD_BATTLE_INTRO_STORY_ID\)/.test(app));
check('④ 本編で見終えたら見た印を立てて CARD_TOP へ(回想・デバッグでは立てない)',
  /event\.id===CARD_BATTLE_INTRO_STORY_ID&&eventReplay\.live&&!eventReplay\.debug\)\{\s*markCardBattleIntroSeen\(\);\s*setEventReplay\(null\);setGameState\('CARD_TOP'\);return;/.test(app));
check('④ 本編で飛ばしても見た印を立てる(HOME のまま)', /eventReplay\.live&&!eventReplay\.debug&&event&&event\.id===CARD_BATTLE_INTRO_STORY_ID\) markCardBattleIntroSeen\(\);/.test(app));
check('④ 保存へ書くのは markCardBattleIntroSeen の1か所だけ', (app.match(/storeSet\(CARD_BATTLE_INTRO_STORY_SEEN_KEY/g) || []).length === 1);
check('④ 回想の解放の対応に cardBattleIntroSeen がある', /cardBattleIntroSeen: cardBattleIntroSeenFlag,/.test(app));
check('④ SAVE_DATA.md に新しいキーの行がある', /\| `mh_story_card_battle_seen_v1` \| boolean \|/.test(read('docs/spec/SAVE_DATA.md')));
console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
