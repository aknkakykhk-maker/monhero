// ぱんぷきん×ジャックのストーリー(第1.5部〜終章)の台本と再生を確かめる。台本の正本: docs/spec/RAID_JACK_STORY.md
//
//   node tools/mode/raid-jack-story-check.js
//
// 見るもの
//   ① 台本の本数と台詞数が文書どおり(第1.5部34 / 第2部16 / 第3部19 / 第4部21 / 第5部20 / 第6部 あつ解放あり34・なし32 / 終章 倒せた48・倒せなかった47)
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
// あつの解放の判定(assistantUnlockedBy)は公開の印も見るので、本番と同じく公開済みにしておく
const ctx = { JACK_ICON_IMG: 'images/raid/jack-icon.png', RELEASE_FLAGS: { assistantAtsu: true, assistantKyuko: true } };
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__e={EVENT_REPLAYS,ASSISTANTS,STORY_GUEST_SPEAKERS,RAID_JACK_STORY_1B,RAID_JACK_STORY_2,RAID_JACK_STORY_3,RAID_JACK_STORY_4,RAID_JACK_STORY_5,RAID_JACK_STORY_6,RAID_JACK_ENDING_CLEARED,RAID_JACK_ENDING_NOTCLEARED,eventScriptForPlayer};`, ctx);
const e = ctx.__e;

// ① 台本の本数
// 2026-10-23 社長「ジャック大王を倒した以降のイベントにあつときゅうこもいれて」「あつが解放されてるかどうかの分岐も」。
//   第6部と終章は、あつを解放している人(ATSU_SEEN)としていない人で行が替わる(atsu:'with'/'without'。台本 docs/playbot/reports/2026-10-23/raid-jack-after/story.md)
const ATSU_SEEN = ['atsu_join_2026_10_22'];
const pick = (s, on) => e.eventScriptForPlayer(s, on ? ATSU_SEEN : []);
const want = [['第1.5部', e.RAID_JACK_STORY_1B, 34, 'raid_jack_story_1b'], ['第2部', e.RAID_JACK_STORY_2, 16, 'raid_jack_story_2'], ['第3部', e.RAID_JACK_STORY_3, 19, 'raid_jack_story_3'], ['第4部', e.RAID_JACK_STORY_4, 21, 'raid_jack_story_4'],
  ['第5部', e.RAID_JACK_STORY_5, 20, 'raid_jack_story_5'],
  ['第6部(あつ解放あり)', pick(e.RAID_JACK_STORY_6, true), 34, 'raid_jack_story_6', ATSU_SEEN], ['第6部(あつ解放なし)', pick(e.RAID_JACK_STORY_6, false), 32, 'raid_jack_story_6', []],
  ['終章(倒せた・あつ解放あり)', pick(e.RAID_JACK_ENDING_CLEARED, true), 48, 'raid_jack_ending_cleared', ATSU_SEEN], ['終章(倒せた・あつ解放なし)', pick(e.RAID_JACK_ENDING_CLEARED, false), 48, 'raid_jack_ending_cleared', []],
  ['終章(倒せなかった・あつ解放あり)', pick(e.RAID_JACK_ENDING_NOTCLEARED, true), 47, 'raid_jack_ending_notcleared', ATSU_SEEN], ['終章(倒せなかった・あつ解放なし)', pick(e.RAID_JACK_ENDING_NOTCLEARED, false), 47, 'raid_jack_ending_notcleared', []]];
want.forEach(([n, s, c]) => check(`${n}の台詞は ${c} 行`, Array.isArray(s) && s.length === c, String(s && s.length)));
const allScripts = want.map(([, s]) => s);
check('あつを解放していない人の版には、あつが一度も出ない(話し手にも台詞にも)', want.filter((w) => /解放なし/.test(w[0])).every(([, s]) => s.every((l) => l.who !== 'atsu' && l.atsu !== 'with')));
check('あつを解放している人の版には、差し替えの行(atsu:\'without\')が出ない', want.filter((w) => /解放あり/.test(w[0])).every(([, s]) => s.every((l) => l.atsu !== 'without')) && want.filter((w) => /解放あり/.test(w[0])).every(([, s]) => s.some((l) => l.who === 'atsu')));
check('あつ・きゅうこが撃破後のお話に出る(社長「あつときゅうこもいれて」)', ['第6部(あつ解放あり)', '終章(倒せた・あつ解放あり)', '終章(倒せなかった・あつ解放あり)'].every((n) => { const s = want.find((w) => w[0] === n)[1]; return s.some((l) => l.who === 'atsu') && s.some((l) => l.who === 'kyuko'); }));
check('印の無いお話は、今までと同じ台本をそのまま返す', e.eventScriptForPlayer(e.RAID_JACK_STORY_2, []) === e.RAID_JACK_STORY_2);
check('台詞はすべて 話し手(who)・表情(e)・本文(t) を持つ',
  allScripts.every((s) => s.every((l) => l.who && l.e && typeof l.t === 'string' && l.t.length > 0)));
// {name} は、きゅうこの加入のお話と同じく再生でブリーダーの名前に替わる(終章の最後のお礼で使う。下の④で確かめる)
check('{name} を使うのは終章の最後のお礼だけ', allScripts.slice(0, 7).every((s) => s.every((l) => !/\{name\}/.test(l.t))));

// ② 話し手
check('ジャックは助手の一覧に入っていない(助手の選択画面などに出さない)', !e.ASSISTANTS.some((a) => a.id === 'jack'));
// 2026-10-22 きゅうこの加入のお話でイルミネ・ドリーミィが足された。ジャックのお話の2人は先頭のまま
check('話し手(STORY_GUEST_SPEAKERS)の先頭は ジャック と 素のぱんぷきん(pumpkin)', Array.isArray(e.STORY_GUEST_SPEAKERS) && e.STORY_GUEST_SPEAKERS.length >= 2 && e.STORY_GUEST_SPEAKERS[0].id === 'jack' && e.STORY_GUEST_SPEAKERS[1].id === 'pumpkin');
check('ぱんぷきんの顔アイコンは、ジャックとは別の絵(images/raid/pumpkin-icon.png)', fs.existsSync(path.join(root, 'monster-hero/images/raid/pumpkin-icon.png')) && /const PUMPKIN_ICON_IMG = "images\/raid\/pumpkin-icon\.png\?v=[0-9a-f]+"/.test(read('monster-hero/data/images/images-enemy.js')) && !/\?v=0"/.test(read('monster-hero/data/images/images-enemy.js').match(/const PUMPKIN_ICON_IMG = .*/)[0]));
const assistantIds = new Set(e.ASSISTANTS.map((a) => a.id));
check('台本の話し手は 助手(みゅあ・きき・もも・ドラ・あつ・きゅうこ)か jack・pumpkin だけ', allScripts.every((s) => s.every((l) => assistantIds.has(l.who) || l.who === 'jack' || l.who === 'pumpkin')));

// ③ 爵位ごとの名前
const jackNames = new Set();
allScripts.forEach((s) => s.forEach((l) => { if (l.who === 'jack') jackNames.add(l.name); }));
const wantNames = ['ジャック(男爵)', 'ジャック(子爵)', 'ジャック(伯爵)', 'ジャック(公爵)', 'ジャック(大王)'];
check('ジャックの名前は 男爵・子爵・伯爵・公爵・大王 の5種類(素のぱんぷきんは別の話し手 pumpkin)', wantNames.every((n) => jackNames.has(n)) && jackNames.size === wantNames.length, [...jackNames].join(' / '));
check('ジャックの台詞は、ぜんぶ name を持つ', allScripts.every((s) => s.every((l) => l.who !== 'jack' || (typeof l.name === 'string' && l.name))));
// 各部で出る爵位(解放のきっかけに合う爵位が出る)
const namesOf = (s) => [...new Set(s.filter((l) => l.who === 'jack').map((l) => l.name))].join(',');
check('第2部は男爵→子爵、第3部は子爵→伯爵、第4部は伯爵→公爵、第5部は公爵→大王、第6部は大王→ぱんぷきん',
  namesOf(e.RAID_JACK_STORY_2) === 'ジャック(男爵),ジャック(子爵)' && namesOf(e.RAID_JACK_STORY_3) === 'ジャック(子爵),ジャック(伯爵)'
  && namesOf(e.RAID_JACK_STORY_4) === 'ジャック(伯爵),ジャック(公爵)' && namesOf(e.RAID_JACK_STORY_5) === 'ジャック(公爵),ジャック(大王)'
  && /ジャック\(大王\)/.test(namesOf(e.RAID_JACK_STORY_6)) && e.RAID_JACK_STORY_6.some((l) => l.who === 'pumpkin'),
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
  + '  breederName, markRhythmEventStorySeen, markMomosukeIntroSeen, markTacticsIntroSeen, RHYTHM_EVENT_STORY_IDS, eventScriptForPlayer, rhythmEventStorySeen }) => (<>\n'
  + block + '\n</>);\nmodule.exports = { Screen };',
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'raid-jack-story-check.jsx' });
const moduleScope = { exports: {} };
new Function('module', 'exports', 'React', transformed.code)(moduleScope, moduleScope.exports, React);
const GUESTS = e.STORY_GUEST_SPEAKERS;
const byId = (id) => e.ASSISTANTS.find((x) => x.id === id) || GUESTS.find((x) => x.id === id) || e.ASSISTANTS[0];
const castOf = (script) => [...e.ASSISTANTS, ...GUESTS].filter((who) => script.some((l) => l.who === who.id));
const Face = ({ who, size, expression }) => React.createElement('img', { 'data-face': who && who.id, 'data-size': size, 'data-expression': expression, alt: who && who.name });
const render = (id, step, seen = ATSU_SEEN) => ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.Screen, {
  eventScriptForPlayer: e.eventScriptForPlayer, rhythmEventStorySeen: seen,
  eventReplay: { id, step }, setEventReplay: () => {}, EVENT_REPLAYS: e.EVENT_REPLAYS, eventReplayList: () => e.EVENT_REPLAYS,
  ASSISTANT_LIST: e.ASSISTANTS, assistantById: byId, storyCastOf: castOf, AssistantFace: Face,
  normalizeAssistantBond: (v) => ({ points: 0, ...(v && typeof v === 'object' ? v : {}) }), assistantBonds: {}, assistantCallStyles: {},
  assistantSpeakText: (t, name) => String(t).replace(/\{name\}/g, name || 'テスト'), assistantBondLevelOf: () => 1, breederName: 'テスト', markRhythmEventStorySeen: () => {},
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
const s6 = render('raid_jack_story_6', pick(e.RAID_JACK_STORY_6, true).findIndex((l) => l.who === 'pumpkin' && /ごめんなさい/.test(l.t)));
check('第6部の「素」の台詞は、名前が「ぱんぷきん」で出る', text(s6).includes('ぱんぷきん') && text(s6).includes('ごめんなさい'), text(s6).slice(0, 140));
// 助手の台詞は今までどおり
const sa = render('raid_jack_story_2', 2);
check('助手(みゅあ)の台詞は今までどおり助手の名前で出る', text(sa).includes('みゅあ') && sa.includes('data-face="mua"'));
// 最後まで進める(どの行でも落ちない)
let ok = true; let bad = '';
// あつを解放している人・していない人の両方で、最後の行まで流す。どの行でも、その版の台詞が出る(差し替えの行がずれない)
for (const [n, s, , id, seen] of want) {
  for (let i = 0; i < s.length; i++) {
    try {
      const html = text(render(id, i, seen || ATSU_SEEN));
      const want1 = String(s[i].t).replace(/\{name\}/g, 'テスト').slice(0, 12);
      if (!html.includes(want1)) { ok = false; bad = `${n} ${i + 1}行目: 「${want1}」が出ない`; break; }
      if (seen && seen.length === 0 && /data-face="atsu"/.test(render(id, i, seen))) { ok = false; bad = `${n} ${i + 1}行目: あつの顔が出ている`; break; }
    } catch (err) { ok = false; bad = `${n} ${i + 1}行目: ${err.message}`; break; }
  }
  if (!ok) break;
}
check('全部の台詞を最後まで再生しても画面が落ちず、どの行もその版の台詞が出る・解放していない人の版はあつの顔が一度も出ない', ok, bad);
check('終章の最後のお礼の {name} は、ブリーダーの名前に替わる', text(render('raid_jack_ending_cleared', 44, ATSU_SEEN)).includes('テスト、おつかれさまぁ'), text(render('raid_jack_ending_cleared', 44, ATSU_SEEN)).slice(0, 100));

// ⑦ 画面の出し方(2026-10-04・ユーザー指示「はじめからジャックやぱんぷきんが会話画面にいるのは違和感。出すタイミングをちゃんと」「敵側上部にコメント」「画面演出」)
{
  const s1 = e.RAID_JACK_STORY_1B;
  const firstPumpkin = s1.findIndex((l) => l.who === 'pumpkin');
  const transformIdx = s1.findIndex((l) => l.fx === 'transform');
  check('第1.5部の最初の5行は助手だけで、ぱんぷきんはまだ画面に出ていない(上のステージが無い)', firstPumpkin === 5 && s1.slice(0, firstPumpkin).every((l) => l.who !== 'pumpkin' && l.who !== 'jack')
    && [0, 1, 4].every((i) => !render('raid_jack_story_1b', i).includes('data-story-stage')));
  const sp = render('raid_jack_story_1b', firstPumpkin);
  check('ぱんぷきんが初めて話す行から、画面の上部のステージに出て、台詞は上の吹き出しに出る', sp.includes('data-story-stage') && sp.includes('data-story-guest="pumpkin"') && /data-story-guest-bubble[^>]*>[^]*?だ、だれ/.test(sp));
  check('ぱんぷきんが話している行でも、下の助手の列にぱんぷきんは並ばない(助手の顔だけ)', !/data-face="pumpkin"[^]*data-face="pumpkin"/.test(sp) && ['mua', 'kiki', 'momosuke', 'dra'].every((id) => sp.includes(`data-face="${id}"`)));
  check('ぱんぷきんが話している行の下の箱は、直前の助手の台詞を薄く残す', /opacity:0\.4[,;"]/.test(sp) && !/data-story-pop="1" class="rounded-2xl border-2 bg-slate-900 px-3 py-3"/.test(sp));
  const sAfter = render('raid_jack_story_1b', firstPumpkin + 1);
  check('助手が話す行では、ステージのぱんぷきんは残り(吹き出しは薄くなる)', sAfter.includes('data-story-guest="pumpkin"') && /data-story-guest-bubble[^>]*opacity:0\.4[,;"]/.test(sAfter) && !/data-story-guest-bubble="[^"]*"\s+data-story-pop="1"/.test(sAfter));
  const talkingOf = (html) => (html.match(/drop-shadow\(0 0 10px [^)]*\)/g) || []).length;
  check('ぱんぷきんが話しているときは、下の助手は誰も「話している(光る)」にならない', talkingOf(sp) === 1 && /data-story-guest-bubble="[^"]*"\s+data-story-pop="1"/.test(sp));
  check('助手が話しているときは、下の箱がぽんと出て、ステージの顔は暗くなる(話している人が一目で分かる)', /data-story-pop="1" class="rounded-2xl border-2 bg-slate-900/.test(sAfter) && /brightness\(\.7\)/.test(sAfter) && talkingOf(sAfter) === 1);
  check('ぱんぷきんがジャックになる行に、変身の演出(光・帯)があり、ステージの顔がジャックへ替わる', transformIdx > firstPumpkin
    && render('raid_jack_story_1b', transformIdx).includes('data-story-fx-flash="transform"') && render('raid_jack_story_1b', transformIdx).includes('ぱんぷきんが、ふくれあがった')
    && render('raid_jack_story_1b', transformIdx).includes('data-story-guest="jack"') && !render('raid_jack_story_1b', transformIdx - 1).includes('data-story-fx-flash'));
  const rank = [[e.RAID_JACK_STORY_2, '子爵'], [e.RAID_JACK_STORY_3, '伯爵'], [e.RAID_JACK_STORY_4, '公爵'], [e.RAID_JACK_STORY_5, '大王']];
  const rankIds = ['raid_jack_story_2', 'raid_jack_story_3', 'raid_jack_story_4', 'raid_jack_story_5'];
  check('第2〜5部の「次の爵位が出る行」に、爵位あがりの演出(帯の文言つき)がある', rank.every(([sc, t], i) => { const idx = sc.findIndex((l) => l.fx === 'rankup'); return idx > 0 && sc[idx].name === `ジャック(${t})` && render(rankIds[i], idx).includes(`ジャック(${t})があらわれた`) && render(rankIds[i], idx).includes('data-story-fx-flash="rankup"'); }));
  const shrinkIdx = pick(e.RAID_JACK_STORY_6, true).findIndex((l) => l.fx === 'shrink');
  const s6s = shrinkIdx >= 0 ? render('raid_jack_story_6', shrinkIdx) : '';
  check('第6部の「小さくなる」行で、ステージがぱんぷきんへ替わる(しぼむ演出・助手が話しているので吹き出しは出さない)', shrinkIdx > 0 && s6s.includes('data-story-guest="pumpkin"') && s6s.includes('data-story-fx-flash="shrink"') && !s6s.includes('data-story-guest-bubble'));
  check('第2部の最初の行(ジャックが話す)では、ジャックが上のステージに出て、下には「上のことばを読んでね」の案内が出る', render('raid_jack_story_2', 0).includes('data-story-guest="jack"') && render('raid_jack_story_2', 0).includes('上のことばを読んでね'));
  const cssSrc = read('monster-hero/src/parts/70-bootstrap.jsx');
  check('演出の動き(storyFlash・storyGrow・storyShrink・storyBanner・揺れ)が定義され、動きを減らす設定では止まる', ['storyStageIn', 'storyFlash', 'storyGrow', 'storyShrink', 'storyBanner', 'storyShakeA', 'storyShakeB'].every((k) => new RegExp(`@keyframes ${k}`).test(cssSrc)) && /prefers-reduced-motion: reduce\) \{\s*\[data-story-shake\]/.test(cssSrc));
  // 助手だけの会話(ジャックが出ない話)は、今までと同じ見た目のまま
  const mia = e.EVENT_REPLAYS.find((r) => r.id === 'halloween_night_2026_part1');
  const htm = ReactDOMServer.renderToStaticMarkup(React.createElement(moduleScope.exports.Screen, {
    eventReplay: { id: 'halloween_night_2026_part1', step: 3 }, setEventReplay: () => {}, EVENT_REPLAYS: e.EVENT_REPLAYS, eventReplayList: () => e.EVENT_REPLAYS,
    eventScriptForPlayer: e.eventScriptForPlayer, rhythmEventStorySeen: ATSU_SEEN,
    ASSISTANT_LIST: e.ASSISTANTS, assistantById: byId, storyCastOf: castOf, AssistantFace: Face,
    normalizeAssistantBond: (v) => ({ points: 0, ...(v && typeof v === 'object' ? v : {}) }), assistantBonds: {}, assistantCallStyles: {},
    assistantSpeakText: (t, name) => String(t).replace(/\{name\}/g, name || 'テスト'), assistantBondLevelOf: () => 1, breederName: 'テスト', markRhythmEventStorySeen: () => {},
    markMomosukeIntroSeen: () => {}, markTacticsIntroSeen: () => {}, RHYTHM_EVENT_STORY_IDS: ids,
  }));
  check('ジャックが出ない会話(ハロウィン第1部)には、上のステージも演出も出ない', !!mia && !htm.includes('data-story-stage') && !htm.includes('data-story-fx-flash') && !htm.includes('上のことばを読んでね') && htm.includes('data-face="mua"'));
}

// 段階を倒したあと・期間が終わったあとに流す話の選び方(raidJackStoryCandidates)
{
  const vm2 = require('vm');
  const c3 = { Object, Number, Math, Array, Date, Number };
  vm2.createContext(c3);
  vm2.runInContext(`${defs}\nglobalThis.__f={raidJackStoryCandidates,RAID_JACK_A_TIERS,RAID_JACK_EVENT};`, c3);
  const f = c3.__f;
  const tot = (n) => { const a = {}; f.RAID_JACK_A_TIERS.forEach((t, i) => { if (i < n) a[i + 1] = { total: t.hp }; }); return { a }; };
  const during = Date.parse(f.RAID_JACK_EVENT.startAt) + 3600000;
  const after = Date.parse(f.RAID_JACK_EVENT.endAt) + 1000;
  check('取れていない(null)ときは何も出さない', f.raidJackStoryCandidates(null, during).length === 0 && f.raidJackStoryCandidates(null, after).length === 0);
  check('1つも倒していなければ話は無い', f.raidJackStoryCandidates(tot(0), during).length === 0);
  check('男爵を倒すと第2部、子爵まで倒すと第2・3部の順', f.raidJackStoryCandidates(tot(1), during).join() === 'raid_jack_story_2' && f.raidJackStoryCandidates(tot(2), during).join() === 'raid_jack_story_2,raid_jack_story_3');
  check('大王まで倒すと第2〜6部。期間中は終章が出ない', f.raidJackStoryCandidates(tot(5), during).join() === 'raid_jack_story_2,raid_jack_story_3,raid_jack_story_4,raid_jack_story_5,raid_jack_story_6');
  check('期間が終わると、大王を倒していれば「倒せた」終章', f.raidJackStoryCandidates(tot(5), after).pop() === 'raid_jack_ending_cleared');
  check('期間が終わると、大王を倒せていなければ「倒せなかった」終章', f.raidJackStoryCandidates(tot(3), after).pop() === 'raid_jack_ending_notcleared');
  check('期間が終わっても、取れていなければ終章を出さない', f.raidJackStoryCandidates(null, after).length === 0);
  check('見回りが見るたびに数え直す(HOMEの見回りから呼ぶ・読み込み時に決めない)', /raidJackStoryCandidates\(raidTotals, Date\.now\(\)\)/.test(fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8')));
}

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');
