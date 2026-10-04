// ぱんぷきん×ジャックのストーリー(第1.5部〜終章)の台本と再生を確かめる。台本の正本: docs/spec/RAID_JACK_STORY.md
//
//   node tools/mode/raid-jack-story-check.js
//
// 見るもの
//   ① 台本の本数と台詞数が文書どおり(第1.5部15 / 第2部16 / 第3部19 / 第4部21 / 第5部20 / 第6部19 / 終章は結末ごとに29)
//   ② ジャックは助手(ASSISTANT_LIST)に入れず、話し手(STORY_GUEST_SPEAKERS)として持つ
//   ③ ジャックの台詞は、爵位ごとの名前(ジャック(男爵)など)かぱんぷきんを name に持つ
//   ④ 再生画面が、ジャックを話し手として出せる(名前の上書き・顔の並び)
//   ⑤ 回想には公開フラグ(raidJack)がついていて、公開するまで出ない。見たかの記録は新しいキーを作らない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const assistantsSrc = read('monster-hero/data/assistants.js');
const ctx = { JACK_ICON_IMG: 'images/raid/jack-icon.png' };
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__e={EVENT_REPLAYS,ASSISTANTS,STORY_GUEST_SPEAKERS,RAID_JACK_STORY_1B,RAID_JACK_STORY_2,RAID_JACK_STORY_3,RAID_JACK_STORY_4,RAID_JACK_STORY_5,RAID_JACK_STORY_6,RAID_JACK_ENDING_CLEARED,RAID_JACK_ENDING_NOTCLEARED};`, ctx);
const e = ctx.__e;

// ① 台本の本数
const want = [['第1.5部', e.RAID_JACK_STORY_1B, 15], ['第2部', e.RAID_JACK_STORY_2, 16], ['第3部', e.RAID_JACK_STORY_3, 19], ['第4部', e.RAID_JACK_STORY_4, 21],
  ['第5部', e.RAID_JACK_STORY_5, 20], ['第6部', e.RAID_JACK_STORY_6, 19], ['終章(大王まで倒せた)', e.RAID_JACK_ENDING_CLEARED, 29], ['終章(倒せなかった)', e.RAID_JACK_ENDING_NOTCLEARED, 29]];
want.forEach(([n, s, c]) => check(`${n}の台詞は ${c} 行`, Array.isArray(s) && s.length === c, String(s && s.length)));
const allScripts = want.map(([, s]) => s);
check('台詞はすべて 話し手(who)・表情(e)・本文(t) を持つ',
  allScripts.every((s) => s.every((l) => l.who && l.e && typeof l.t === 'string' && l.t.length > 0)));
check('台詞に {name} が残っていない(ジャックの台本は名前を呼ばない)', allScripts.every((s) => s.every((l) => !/\{name\}/.test(l.t))));

// ② 話し手
check('ジャックは助手の一覧に入っていない(助手の選択画面などに出さない)', !e.ASSISTANTS.some((a) => a.id === 'jack'));
check('ジャックは STORY_GUEST_SPEAKERS に1人だけいる', Array.isArray(e.STORY_GUEST_SPEAKERS) && e.STORY_GUEST_SPEAKERS.length === 1 && e.STORY_GUEST_SPEAKERS[0].id === 'jack');
const assistantIds = new Set(e.ASSISTANTS.map((a) => a.id));
check('台本の話し手は 助手(みゅあ・きき・もも・ドラ)か jack だけ', allScripts.every((s) => s.every((l) => assistantIds.has(l.who) || l.who === 'jack')));

// ③ 爵位ごとの名前
const jackNames = new Set();
allScripts.forEach((s) => s.forEach((l) => { if (l.who === 'jack') jackNames.add(l.name); }));
const wantNames = ['ジャック(男爵)', 'ジャック(子爵)', 'ジャック(伯爵)', 'ジャック(公爵)', 'ジャック(大王)', 'ぱんぷきん'];
check('ジャックの名前は 男爵・子爵・伯爵・公爵・大王・ぱんぷきん の6種類', wantNames.every((n) => jackNames.has(n)) && jackNames.size === wantNames.length, [...jackNames].join(' / '));
check('ジャックの台詞は、ぜんぶ name を持つ', allScripts.every((s) => s.every((l) => l.who !== 'jack' || (typeof l.name === 'string' && l.name))));
// 各部で出る爵位(解放のきっかけに合う爵位が出る)
const namesOf = (s) => [...new Set(s.filter((l) => l.who === 'jack').map((l) => l.name))].join(',');
check('第2部は男爵→子爵、第3部は子爵→伯爵、第4部は伯爵→公爵、第5部は公爵→大王、第6部は大王→ぱんぷきん',
  namesOf(e.RAID_JACK_STORY_2) === 'ジャック(男爵),ジャック(子爵)' && namesOf(e.RAID_JACK_STORY_3) === 'ジャック(子爵),ジャック(伯爵)'
  && namesOf(e.RAID_JACK_STORY_4) === 'ジャック(伯爵),ジャック(公爵)' && namesOf(e.RAID_JACK_STORY_5) === 'ジャック(公爵),ジャック(大王)'
  && /ジャック\(大王\)/.test(namesOf(e.RAID_JACK_STORY_6)) && /ぱんぷきん/.test(namesOf(e.RAID_JACK_STORY_6)),
  [e.RAID_JACK_STORY_2, e.RAID_JACK_STORY_3, e.RAID_JACK_STORY_4, e.RAID_JACK_STORY_5, e.RAID_JACK_STORY_6].map(namesOf).join(' | '));

// ⑤ 回想の登録
const ids = ['raid_jack_story_1b', 'raid_jack_story_2', 'raid_jack_story_3', 'raid_jack_story_4', 'raid_jack_story_5', 'raid_jack_story_6', 'raid_jack_ending_cleared', 'raid_jack_ending_notcleared'];
const reg = ids.map((id) => e.EVENT_REPLAYS.find((x) => x.id === id));
check('回想に8本とも登録されている', reg.every(Boolean));
check('どれも公開フラグ(releaseFlag: raidJack)がついている(公開するまで回想にも出さない)', reg.every((x) => x && x.releaseFlag === 'raidJack'));
const core = read('monster-hero/src/parts/10-core.jsx');
check('公開フラグの対応表に raidJack がある(RELEASE_FLAGS.raidJack = RAID_JACK_PUBLIC_RELEASE で決まる)', /get raidJack\(\) \{ return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS\.raidJack === true; \}/.test(core));
// ★getter(読むたびに調べる)であること。値で書くと、あとの部品の const を読み込み時に触って画面が真っ白になる
check('raidJack の公開フラグは getter で、読み込み時にあとの部品の定数を触らない(初期化前の参照を作らない)', !/^\s+raidJack: typeof (RAID_JACK_PUBLIC_RELEASE|RELEASE_FLAGS)/m.test(core));
const defs = read('monster-hero/src/parts/35-raid-jack.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
check('見たかの記録は、既存の配列(rhythmEventStorySeen)へ id を入れる。新しい保存キーを作らない',
  /RHYTHM_EVENT_STORY_IDS = \[\.\.\.HALLOWEEN_NIGHT_STORY_IDS, \.\.\.RAID_JACK_STORY_IDS,/.test(app) && !/mh_raid_jack_story/.test(app + defs));
check('段階を倒したあとの話は a1→第2部 … a5→第6部', /a1: 'raid_jack_story_2', a2: 'raid_jack_story_3', a3: 'raid_jack_story_4', a4: 'raid_jack_story_5', a5: 'raid_jack_story_6'/.test(defs));

// ⑥ 流す順番: 第1部 → 第1.5部 → 遊び方(2026-10-04・ユーザー指示「第1.5部を先に流して、そのあと遊び方を続ける」)
check('第1.5部は、第1部を見終えていて、まだ見ていないときに並べる(公開フラグ・ビートPの公開が前提)',
  /const raidStartStoryReady = RELEASE_FLAGS\.raidJack === true && RELEASE_FLAGS\.rhythmEventPoints === true\s*&& !notPlayedYet\(RAID_JACK_HOWTO_AFTER_STORY_ID\) && notPlayedYet\(RAID_JACK_STORY_START_ID\);/.test(app));
check('遊び方は、第1.5部を見終えてから並べる(第1部を見終えただけでは出ない)',
  /const raidHowtoReady = RELEASE_FLAGS\.raidJack === true && RELEASE_FLAGS\.rhythmEventPoints === true\s*&& !notPlayedYet\(RAID_JACK_STORY_START_ID\) && notPlayedYet\(RAID_JACK_HOWTO_STORY_ID\);/.test(app));
check('HOMEの見回りは、第1.5部を遊び方より先に並べる(2か所とも)',
  (app.match(/raidStartStoryReady\) setRhythmEventStoryPending\(prev => prev \|\| RAID_JACK_STORY_START_ID\);\s*\n\s*else if \(raidHowtoReady\)/g) || []).length === 2);
check('本編で第1部を見終えたら第1.5部へ、第1.5部を見終えたら遊び方へ、続けて流す(公開前・回想からのときは流さない)',
  /event\.id===RAID_JACK_HOWTO_AFTER_STORY_ID&&eventReplay\.live&&!eventReplay\.debug&&RELEASE_FLAGS\.raidJack===true[\s\S]{0,200}setRhythmEventStoryPending\(prev=>prev\|\|RAID_JACK_STORY_START_ID\)/.test(app)
  && /event\.id===RAID_JACK_STORY_START_ID&&eventReplay\.live&&!eventReplay\.debug&&RELEASE_FLAGS\.raidJack===true[\s\S]{0,200}setRhythmEventStoryPending\(prev=>prev\|\|RAID_JACK_HOWTO_STORY_ID\)/.test(app));

// ④ 再生画面(60-app.jsx の eventReplay の部分だけを切り出して動かす)
// 既存の回想の検査(tools/boot/event-replay-check.js)と同じ切り出し方。ソースは連結後の game-system.jsx
const gameSource = read('monster-hero/src/game-system.jsx');
const START = '      {eventReplay!=null&&(()=>{';
const END = '      {dailyMasuAdvice&&(()=>{';
const from = gameSource.indexOf(START);
const to = gameSource.indexOf(END, from);
check('再生画面のJSXを切り出せる', from >= 0 && to > from);
const block = gameSource.slice(from, to);   // 既存の検査と同じく、そのまま <>…</> の中に入れる
const transformed = babel.transformSync(
  'const Screen = ({ eventReplay, setEventReplay, EVENT_REPLAYS, eventReplayList, ASSISTANT_LIST, assistantById, storyCastOf, AssistantFace,\n'
  + '  normalizeAssistantBond, assistantBonds, assistantCallStyles, assistantSpeakText, assistantBondLevelOf,\n'
  + '  breederName, markRhythmEventStorySeen, markMomosukeIntroSeen, markTacticsIntroSeen, RHYTHM_EVENT_STORY_IDS }) => (<>\n'
  + block + '\n</>);\nmodule.exports = { Screen };',
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'raid-jack-story-check.jsx' });
const moduleScope = { exports: {} };
new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
const GUESTS = e.STORY_GUEST_SPEAKERS;
const byId = (id) => e.ASSISTANTS.find((x) => x.id === id) || GUESTS.find((x) => x.id === id) || e.ASSISTANTS[0];
const castOf = (script) => [...e.ASSISTANTS, ...GUESTS].filter((who) => script.some((l) => l.who === who.id));
const Face = ({ who, size, expression }) => React.createElement('img', { 'data-face': who && who.id, 'data-size': size, 'data-expression': expression, alt: who && who.name });
const render = (id, step) => ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.Screen, {
  eventReplay: { id, step }, setEventReplay: () => {}, EVENT_REPLAYS: e.EVENT_REPLAYS, eventReplayList: () => e.EVENT_REPLAYS,
  ASSISTANT_LIST: e.ASSISTANTS, assistantById: byId, storyCastOf: castOf, AssistantFace: Face,
  normalizeAssistantBond: (v) => ({ points: 0, ...(v && typeof v === 'object' ? v : {}) }), assistantBonds: {}, assistantCallStyles: {},
  assistantSpeakText: (t) => t, assistantBondLevelOf: () => 1, breederName: 'テスト', markRhythmEventStorySeen: () => {},
  markMomosukeIntroSeen: () => {}, markTacticsIntroSeen: () => {}, RHYTHM_EVENT_STORY_IDS: ids,
}));
const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
// 第2部の最初の台詞(男爵)
const s2 = render('raid_jack_story_2', 0);
check('第2部の最初は、吹き出しの名前が「ジャック(男爵)」で、台詞が出る', text(s2).includes('ジャック(男爵)') && text(s2).includes('吾輩が、負けただと'), text(s2).slice(0, 140));
check('第2部の顔の並びに、ジャックが入る(話しているのでジャックの顔が出る)', s2.includes('data-face="jack"'));
// 第2部の途中の子爵
const s2k = render('raid_jack_story_2', 8);
check('第2部の9行目は「ジャック(子爵)」の台詞', text(s2k).includes('ジャック(子爵)') && text(s2k).includes('ほっほっほ'), text(s2k).slice(0, 140));
// 第6部の「素」はぱんぷきんの名前
const s6 = render('raid_jack_story_6', 5);
check('第6部の「素」の台詞は、名前が「ぱんぷきん」で出る', text(s6).includes('ぱんぷきん') && text(s6).includes('ごめんなさい'), text(s6).slice(0, 140));
// 助手の台詞は今までどおり
const sa = render('raid_jack_story_2', 2);
check('助手(みゅあ)の台詞は今までどおり助手の名前で出る', text(sa).includes('みゅあ') && sa.includes('data-face="mua"'));
// 最後まで進める(どの行でも落ちない)
let ok = true; let bad = '';
for (const [n, s] of want) { const id = ids[want.findIndex((w) => w[0] === n)]; for (let i = 0; i < s.length; i++) { try { render(id, i); } catch (err) { ok = false; bad = `${n} ${i}: ${err.message}`; break; } } if (!ok) break; }
check('全部の台詞を最後まで再生しても、画面が落ちない', ok, bad);

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');
