// 5人目の助手「あつ」(2026-10-22 社長の決定)の決まりを見張る。ブラウザは使わない。
//
//   node tools/assistant/atsu-check.js
//
// 見ているもの:
//   ・口調 … 一人称は「俺」(ときどき「オレ」)。ほかの助手の一人称・笑い方(w・ｗ)・下ネタが混ざっていない。くせ(とりあえず・てか・まじで・やっぱ・いいね・笑)が出ている
//   ・呼び方 … あつ→みゅあ「みゅあ」/きき「きき」/もも「もも」/ドラ「ドラちゃん」、みゅあ→「あつくん」/きき→「あっくん」/もも→「あつ」/ドラ→「あっくん」。お話の中でも守る
//   ・仲良し度の段階 … 30段で「パーティの仲間」の流れ
//   ・解放 … みゅあ・きき・ももすけ がそろって Lv5 以上 → お話 → 選べる。見たかどうかはドラと同じ「見終えたお話の id」で持つ(新しいキーを作らない)
//   ・公開前 … 公開の印 assistantAtsu が偽のあいだは選べない・カード「あつの挑発」で仲良し度が貯まらない・おしゃべりの材料に入らない
//   ・絵 … 仮の顔の絵がそろっている。印を真にするなら、仮の絵(tempImageDir)をやめて大きい絵へ差し替えてあること
// 実ブラウザでの流れは tools/assistant/atsu-unlock-browser-check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };

const load = (extra = '') => {
  const ctx = { console, Date, Math, JSON, Object, Array, Set, Map, WeakMap, Number, String, RegExp, localStorage: { getItem() { return null; }, setItem() {} }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(`${extra}\n${read('monster-hero/data/assistants.js')}
;globalThis.__a = { ASSISTANTS, ASSISTANT_SCENES, ASSISTANT_LINE_PACKS, ASSISTANT_PEER_CALLS, ASSISTANT_UNLOCK_STORIES, ASSISTANT_ATSU_UNLOCK_BONDS, EVENT_REPLAYS,
  assistantBondLevelsOf, assistantReleased, assistantUnlockedBy, assistantAtsuUnlockReady, assistantCallStylesOf, ASSISTANT_CHAT_EXAMPLES,
  assistantFaceImage, assistantFullImage };`, ctx);
  return ctx.__a;
};
const a = load();
const atsu = a.ASSISTANTS.find(x => x.id === 'atsu');
check('ASSISTANTS にあつがいる', !!atsu && atsu.name === 'あつ' && atsu.role === '助手');
check('モンヒロビートの呼び方は「モンビー」', atsu && atsu.rhythmCall === 'モンビー');

// ---- 口調 ----
const lines = Object.entries(a.ASSISTANT_SCENES).flatMap(([k, d]) => [...(d.lines || []), ...Object.values(d.when || {}).flat()]
  .filter(l => l.who === 'atsu').map(l => ({ k, t: l.t })));
const story = a.EVENT_REPLAYS.find(e => e.id === a.ASSISTANT_UNLOCK_STORIES.atsu);
const storyLines = (story ? story.script : []);
const allAtsu = [...lines, ...storyLines.filter(l => l.who === 'atsu').map(l => ({ k: 'story', t: l.t }))];
const bad = (re) => allAtsu.filter(l => re.test(l.t));
check('あつのセリフが十分にある(全場面で500本以上)', lines.length >= 500, `${lines.length}本`);
// 場面の定義を持たず、束(addAssistantLinePack)だけで作る場面(rhythmModeSelect など)は ASSISTANT_SCENES に入らない。
// ほかの助手が持っているのにあつが持っていないと、みゅあのセリフへ落ちる(2026-10-22 モードえらびで実際にそうなっていた)
const packOnly = {};
for (const pack of a.ASSISTANT_LINE_PACKS) for (const [k, list] of Object.entries(pack.lines || {})) {
  if (a.ASSISTANT_SCENES[k] || !Array.isArray(list) || !list.length) continue;
  (packOnly[k] = packOnly[k] || new Set()).add(pack.assistantId || 'mua');
}
const packMissing = Object.entries(packOnly).filter(([, who]) => who.size > 1 && !who.has('atsu')).map(([k]) => k);
check('束だけで作る場面にも、あつのセリフがある', packMissing.length === 0, packMissing.join(', ') || Object.keys(packOnly).join(', '));
check('一人称に、ほかの助手のもの(おで・ワイ・あたし・私・僕・もも)が混ざらない', bad(/おで|ワイ|あたし|私|僕|ももは|ももが/).length === 0, bad(/おで|ワイ|あたし|私|僕|ももは|ももが/).map(l => `${l.k}:${l.t}`).slice(0, 3).join(' / '));
check('一人称「俺」を使っている', allAtsu.filter(l => /俺|オレ/.test(l.t)).length >= 15, `${allAtsu.filter(l => /俺|オレ/.test(l.t)).length}本`);
check('笑いは全角の「笑」(ももすけの w・みゅあの ｗ を使わない)', bad(/(?<![A-Za-z])[wｗ]+(?![A-Za-z])/).length === 0, bad(/(?<![A-Za-z])[wｗ]+(?![A-Za-z])/).map(l => l.t).slice(0, 3).join(' / '));
check('下ネタを言わない(ドラの冗談の言い回しが混ざらない)', bad(/膝枕|おなら|何がとは|何想像|夜の部|下ネタ/).length === 0, bad(/膝枕|おなら|何がとは|何想像|夜の部|下ネタ/).map(l => l.t).slice(0, 3).join(' / '));
check('です・ます調にしない', bad(/(です|ます|でした|ました|ください)[。！？]?$/).length === 0, bad(/(です|ます|でした|ました|ください)[。！？]?$/).map(l => l.t).slice(0, 3).join(' / '));
// 2026-10-22 社長の決定(台帳 docs/rules/PRESIDENT_DECISIONS.md): セリフの最後に必ず「笑」か顔文字か記号。自分で「リーダー」と言わない(まわりを立てる)
const endBad = allAtsu.filter(l => !/(笑|[！？!?…♪〜]|[)）]|[\u{1F300}-\u{1FAFF}])$/u.test(String(l.t).trim()));
check('あつのセリフは、最後に必ず「笑」か顔文字か記号が付く', endBad.length === 0, endBad.slice(0, 3).map(l => `${l.k}:${l.t}`).join(' / '));
// 2026-10-22 社長「S要素は遠回しに」: あつにもまわりにも「S」「ドS」と言わせない(お話のだれのセリフでも)
const sBad = [...allAtsu.map(l => l.t), ...storyLines.map(l => l.t)].filter(t => /ドS|Sっ気|Sな(?:とこ|ところ|人)|(?<![A-Za-z])S(?![A-Za-z.])/.test(t));
check('「S」「ドS」とは言わせない(からかい方でにじませる)', sBad.length === 0, sBad.join(' / '));
check('あつは自分で「リーダー」と言わない', bad(/(?<!ブ)リーダー/).length === 0, bad(/(?<!ブ)リーダー/).map(l => l.t).join(' / '));
const exBad = (a.ASSISTANT_CHAT_EXAMPLES.atsu || []).filter(x => !/(笑|[！？!?…♪〜]|[)）])$/.test(String(x.a).trim()));
check('おしゃべりの見本も、最後に「笑」か記号が付く', exBad.length === 0, exBad.map(x => x.a).join(' / '));
const quirk = (re) => allAtsu.filter(l => re.test(l.t)).length;
check('くせが出ている(とりあえず・てか・まじで・やっぱ・いいね・笑)',
  quirk(/とりあえず/) >= 5 && quirk(/てか/) >= 5 && quirk(/まじで/) >= 5 && quirk(/やっぱ/) >= 5 && quirk(/いいね/) >= 5 && quirk(/笑/) >= 20,
  `とりあえず${quirk(/とりあえず/)}・てか${quirk(/てか/)}・まじで${quirk(/まじで/)}・やっぱ${quirk(/やっぱ/)}・いいね${quirk(/いいね/)}・笑${quirk(/笑/)}`);
check('上の難易度へ誘う(HELL 推し)', quirk(/HELL|上の難易度|上いこ/) >= 8, `${quirk(/HELL|上の難易度|上いこ/)}本`);
check('アシストカード「あつの挑発」にセリフで触れる', quirk(/あつの挑発/) >= 2);
// 遊ぶ人の腕はけなさない(厳しいのは釣り合いと見た目の話だけ)
check('遊ぶ人の腕をけなす言い方をしない', bad(/下手|へたくそ|ヘタ|雑魚|ざこ|センスない|向いてない/).length === 0, bad(/下手|へたくそ|ヘタ|雑魚|ざこ|センスない|向いてない/).map(l => l.t).join(' / '));

// ---- 呼び方 ----
const pc = a.ASSISTANT_PEER_CALLS;
check('呼び方の表(あつ→ほか)', pc.atsu && pc.atsu.mua === 'みゅあ' && pc.atsu.kiki === 'きき' && pc.atsu.momosuke === 'もも' && pc.atsu.dra === 'ドラちゃん', JSON.stringify(pc.atsu));
check('呼び方の表(ほか→あつ)', pc.mua.atsu === 'あつくん' && pc.kiki.atsu === 'あっくん' && pc.momosuke.atsu === 'あつ' && pc.dra.atsu === 'あっくん');
// カード名「あつの挑発」は呼び方ではないので、除いてから見る
const callBad = storyLines.map(l => ({ ...l, t: String(l.t).replace(/あつの挑発/g, '') })).filter(l => (l.who === 'mua' && /あつ|あっく/.test(l.t) && !/あつくん/.test(l.t))
  || (l.who === 'kiki' && /あつ|あっく/.test(l.t) && !/あっくん/.test(l.t))
  || (l.who === 'momosuke' && /あつくん|あっくん/.test(l.t))
  || (l.who === 'atsu' && /ひめちん|みゅあねぇ|ききちゃん|ももさん|みゅあちん|靴下さん|ドラケン/.test(l.t)));
check('お話の中でも呼び方を守る', callBad.length === 0, callBad.map(l => `${l.who}:${l.t}`).join(' / '));
// 仲間の呼び方(2026-10-22 社長の決定): もも→はるちゃん・ともちゃん・みりちゃん・さえちゃん・デムさん / みゅあ→キラボス・らっせ・ろむちゃん / きき→デロチー・デムさん・はるさん
const storyText = storyLines.map(l => l.t).join('\n');
const friendBad = storyLines.filter(l => /ガッデム|ゲズデロ|みりあ|ともちん|キラ(?!ボス)/.test(l.t)
  || (l.who === 'momosuke' && /キラボス|ろむちゃん|デロチー|はるさん/.test(l.t))
  || (l.who === 'mua' && /はるちゃん|デロチー|デムさん/.test(l.t))
  || (l.who === 'kiki' && /はるちゃん|キラボス|みりちゃん/.test(l.t)));
check('お話の仲間の呼び方が社長の決定どおり', friendBad.length === 0 && ['はるちゃん', 'ともちゃん', 'みりちゃん', 'さえちゃん', 'キラボス', 'らっせ', 'ろむちゃん', 'デロチー', 'デムさん'].every(w => storyText.includes(w)),
  friendBad.map(l => `${l.who}:${l.t}`).join(' / '));
check('お話では、あつの顔は登場するまで伏せる(hideUntilFirstLine)', !!story && Array.isArray(story.hideUntilFirstLine) && story.hideUntilFirstLine.includes('atsu'));
check('お話に出るのは みゅあ・きき・ももすけ・あつ の4人', story && [...new Set(storyLines.map(l => l.who))].sort().join(',') === 'atsu,kiki,momosuke,mua');

// ---- 仲良し度の段階・呼び方の例 ----
const stages = a.assistantBondLevelsOf('atsu');
const titles = stages.map(s => s.title);
check('仲良し度は30段で、段階の名前は「パーティの仲間」の流れ', stages.length === 30 && titles[0] === '旅の道連れ' && titles[29] === 'ともに世界を救う勇者'
  && ['パーティの一員', '背中を預ける仲間', 'ギルドの右腕'].every(t => titles.includes(t)) && new Set(titles).size === 30, `${titles[0]} … ${titles[29]}`);
check('呼び方の例(Lv6から)が、あつ用にある', a.assistantCallStylesOf('atsu').some(st => st.template === '{name}'));

// ---- 解放 ----
check('解放の条件は みゅあ・きき・ももすけ がそろって Lv5 以上(2026-10-22 社長の変更)', JSON.stringify(a.ASSISTANT_ATSU_UNLOCK_BONDS) === JSON.stringify({ mua: 5, kiki: 5, momosuke: 5 }));
const lv = (m) => (id) => m[id];
check('条件がそろったときだけ満たす(1人でも足りなければ満たさない・壊れた値は満たさない)',
  a.assistantAtsuUnlockReady(lv({ mua: 5, kiki: 5, momosuke: 5 })) === true && a.assistantAtsuUnlockReady(lv({ mua: 4, kiki: 30, momosuke: 30 })) === false && a.assistantAtsuUnlockReady(lv({ mua: 30, kiki: 30, momosuke: 4 })) === false
  && a.assistantAtsuUnlockReady(lv({ mua: 5, kiki: NaN, momosuke: 5 })) === false && a.assistantAtsuUnlockReady(null) === false);
const storyId = a.ASSISTANT_UNLOCK_STORIES.atsu;
check('お話は回想に登録され、公開の印 assistantAtsu で出る', !!story && story.releaseFlag === 'assistantAtsu' && story.unlockedKey === 'atsuJoinSeen');
const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
check('ゲーム側のお話の id がデータと同じ', rel.includes(`const ATSU_JOIN_STORY_ID = '${storyId}';`));
check('見たかどうかは既存の「見終えたお話の id」の並びで持つ(新しい保存キーを作らない)',
  /RHYTHM_EVENT_STORY_IDS = \[[^\]]*ATSU_JOIN_STORY_ID[,\]]/.test(app) && /atsuJoinSeen: Array\.isArray\(rhythmEventStorySeen\) && rhythmEventStorySeen\.includes\(ATSU_JOIN_STORY_ID\)/.test(app)
  && !/mh_[a-z_]*atsu[a-z_]*_seen/.test(app + rel));
check('お話を流すのは、公開の印と仲良し度の条件がそろったときだけ',
  /EVENT_REPLAY_RELEASE_FLAGS\.assistantAtsu\) return;[\s\S]{0,200}rhythmEventStorySeen\.includes\(ATSU_JOIN_STORY_ID\)[\s\S]{0,200}assistantAtsuUnlockReady\(/.test(app));

// ---- 公開前 ----
const flagOn = /assistantAtsu:\s*true/.test(rel);
check('公開の印 assistantAtsu が RELEASE_FLAGS にある', /assistantAtsu:\s*(true|false)/.test(rel));
check('印が偽(読めない)ときは選べない', a.assistantReleased('atsu') === false && a.assistantUnlockedBy('atsu', [storyId]) === false
  && a.assistantReleased('dra') === true);
const on = load('var RELEASE_FLAGS = { assistantAtsu: true };');
check('印が真なら、お話を見たあとだけ選べる', on.assistantUnlockedBy('atsu', [storyId]) === true && on.assistantUnlockedBy('atsu', []) === false);
check('公開前は、カード「あつの挑発」をあつの仲良し度に結び付けない',
  /const assistantIdOfAssistCard[\s\S]{0,600}assistantReleased\(id\)\) return null;/.test(rel));
check('公開前は、プロフィールの助手の一覧・ヘルプの一覧に出さない',
  /ASSISTANT_LIST\.filter\(who=>assistantReleased\(who\.id\)\)/.test(app) && /assistantReleased\(who\.id\)/.test(read('monster-hero/src/parts/20-market-notices-help.jsx')));
const digest = JSON.parse(read('monster-hero/data/assistant-chat-digest.json'));
if (!flagOn) {
  check('公開前は、おしゃべりの材料にあつを入れない(ほかの助手が名前を出さない)',
    !digest.assistants.atsu && !/あつくん|あっくん/.test(JSON.stringify(digest)));
} else {
  check('公開したら、おしゃべりの材料にあつの人柄がある', !!digest.assistants.atsu);
}
check('おしゃべりの見本がある', Array.isArray(a.ASSISTANT_CHAT_EXAMPLES.atsu) && a.ASSISTANT_CHAT_EXAMPLES.atsu.length >= 5);

// ---- 絵 ----
const exps = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const face = exps.map(e => a.assistantFaceImage(atsu, e));
check('顔の絵が8表情ぶんそろっている', face.every(p => fs.existsSync(path.join(ROOT, 'monster-hero', p))), face.filter(p => !fs.existsSync(path.join(ROOT, 'monster-hero', p))).join(', '));
check('大きい絵の場所も、ある絵を指している', exps.every(e => fs.existsSync(path.join(ROOT, 'monster-hero', a.assistantFullImage(atsu, e)))));
if (flagOn) check('公開するときは、仮の顔の絵(tempImageDir)をやめて大きい絵へ差し替えてある', !atsu.tempImageDir);
// マーケットのあつの顔アイコン(id atsu_<表情>・images/breeder-icons/atsu_<表情>.png)は、助手の顔と同じ絵(2026-10-22 社長「アイコンも今回の絵に差し替える」)
const sameArt = exps.filter(e => { try { return !fs.readFileSync(path.join(ROOT, 'monster-hero/images/breeder-icons', `atsu_${e}.png`)).equals(fs.readFileSync(path.join(ROOT, 'monster-hero', a.assistantFaceImage(atsu, e)))); } catch { return true; } });
check('マーケットのあつの顔アイコン8枚は、助手の顔と同じ絵', sameArt.length === 0, sameArt.join(', '));
check('フレンド申請の知らせ・対戦画面の絵の寄せ方にもあつがいる',
  /\n  atsu: \(who\) =>/.test(read('monster-hero/src/parts/69-screen-home.jsx')) && /\n  atsu: \{ zoom:/.test(read('monster-hero/src/parts/77-screen-rhythm-multi.jsx')));

console.log(failed ? `\n${failed}件のNGがあります` : '\nOK: あつの決まりは守られている');
process.exit(failed ? 1 : 0);
