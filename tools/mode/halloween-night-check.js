// ハロウィン・ナイト(2026-10-04 8:00 〜 11-01 3:59)を確かめる。
//
//   ユーザー指示「イベント期間はモンビーポイント5倍、モンビー中のクイック周回5倍」「開始と終了にストーリーイベント
//   (第1部だけ時刻で出し、第2部以降はレイドの進み具合で開く)」「開始と同時に Crazy Party Night ～ぱんぷきんの逆襲～ を新規実装」
//
// 見るもの(時刻を動かして、本物のデータと式をNodeで動かす)
//   ① ビートP: 期間の中だけ5倍(ビートPアップキャンペーンと重なる10/4 8:00〜10/5 5:00も5倍で、重ねがけしない)
//   ② クイック周回: 期間の中は全曲5倍(ふだん2倍・ランキングイベントの対象曲3倍を置き換える)。期間の外は今までどおり
//   ③ ストーリー: 時刻で出す第1部と、第2部以降(ジャックの話)に置き換わっていること
//   ④ 台本・回想・BGM・見たかどうかの結線
//   ⑤ 新曲: 開始の時刻まで曲えらびに出さず、時刻から出る
//   ⑥ お知らせの時刻が期間と食い違っていない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const jst = (text) => Date.parse(text);
const START = '2026-10-04T08:00:00+09:00';
const END = '2026-11-01T04:00:00+09:00';

const rhythmEvent = read('monster-hero/data/rhythm-event.js');
const rhythmMode = read('monster-hero/data/rhythm-mode.js');
const core = read('monster-hero/src/parts/10-core.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const assistants = read('monster-hero/data/assistants.js');
const bgm = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const changelog = read('monster-hero/data/changelog.js');

// rhythm-event.js を動かす(曲の一覧 RHYTHM_DEMO_SONG_IDS だけ仮に渡す)
const ctx = { console, Object, Number, Math, Array, JSON, String, Boolean, isNaN, Date, Map, Set,
  RHYTHM_DEMO_SONG_IDS: ['monster_hero', 'crazy_party_night'] };
vm.createContext(ctx);
vm.runInContext(`${rhythmEvent}\nthis.out={RHYTHM_EVENT_POINT_CAMPAIGNS,HALLOWEEN_NIGHT_STORIES,halloweenNightStoryIdsAt,rhythmEventPointCampaignAt,rhythmEventPointAwardAt,rhythmLimitedEventAt};`, ctx);
const o = ctx.out;

// ① ビートP
const hw = o.RHYTHM_EVENT_POINT_CAMPAIGNS.find((c) => c.id === 'halloween_night_2026');
check('キャンペーンが1件ある(期間は10/4 8:00〜11/1 4:00の前・5倍)', !!hw && hw.startAt === START && hw.endAt === END && hw.boost === 5 && hw.loopScale === 10 && hw.loopBoost === 5);
const at = (text) => jst(text);
check('開始の1ミリ秒前はハロウィンではない', o.rhythmEventPointCampaignAt(at(START) - 1)?.id !== 'halloween_night_2026');
check('開始の時刻からハロウィン', o.rhythmEventPointCampaignAt(at(START))?.id === 'halloween_night_2026');
check('終了の直前(3:59:59)はまだハロウィン', o.rhythmEventPointCampaignAt(at(END) - 1000)?.id === 'halloween_night_2026');
check('終了の時刻で終わる', o.rhythmEventPointCampaignAt(at(END)) === null);
check('ビートPアップキャンペーンと重なる時間は、あとから始まったハロウィンを使う', o.rhythmEventPointCampaignAt(jst('2026-10-04T12:00:00+09:00'))?.id === 'halloween_night_2026');
check('重なりが終わった(10/5 5:00)あとも、ハロウィンのまま', o.rhythmEventPointCampaignAt(jst('2026-10-05T05:00:00+09:00'))?.id === 'halloween_night_2026');
const score = 950000;
const base = o.rhythmEventPointAwardAt(jst('2026-09-25T12:00:00+09:00'), 'monster_hero', score);
const during = o.rhythmEventPointAwardAt(jst('2026-10-10T12:00:00+09:00'), 'monster_hero', score);
const overlap = o.rhythmEventPointAwardAt(jst('2026-10-04T12:00:00+09:00'), 'monster_hero', score);
const pt = (x) => x && (x.points ?? x.awarded ?? x.amount ?? x.beatPoints);
// ふだんは基本の1/5(切り捨て)なので、5倍にすると基本ビートPそのもの(29P×5=145ではなく148P)になる。ビートPアップキャンペーンと同じ貯まり方
check('期間中のビートPは、ふだんの5倍(切り捨ての誤差の範囲)', pt(base) > 0 && pt(during) >= pt(base) * 5 && pt(during) < (pt(base) + 1) * 5, `ふだん ${pt(base)} / 期間中 ${pt(during)}`);
check('ビートPアップキャンペーンと重なる時間も5倍のまま(重ねがけしない)', pt(overlap) === pt(during), `重なる時間 ${pt(overlap)}`);
check('新曲もビートPが貯まる', pt(o.rhythmEventPointAwardAt(jst('2026-10-10T12:00:00+09:00'), 'crazy_party_night', score)) === pt(during));

// ② クイック周回
const sStart = core.indexOf('const RHYTHM_PLAY_RUN_LOOP_MIN');
const sEnd = core.indexOf('\n};\n', core.indexOf('const rhythmPlayRunLoopScale = ')) + 4;
check('周回の倍率の式を取り出せる', sStart >= 0 && sEnd > sStart);
const c2 = { Number, Math, Array, String };
vm.createContext(c2);
vm.runInContext(`${core.slice(sStart, sEnd)}\nthis.out={rhythmPlayRunLoops,rhythmPlayRunLoopScale};`, c2);
const { rhythmPlayRunLoops, rhythmPlayRunLoopScale } = c2.out;
const hwCampaign = o.rhythmEventPointCampaignAt(jst('2026-10-10T12:00:00+09:00'));
const ranking = { songIds: ['monster_hero'] };
// ふだん(2倍)の5倍=10。ユーザー指示「クイック無限周回は普段の5倍にして」
check('期間中は全曲、ふだん(2倍)の5倍=10(対象外の曲も)', rhythmPlayRunLoopScale('crazy_party_night', null, hwCampaign) === 10 && rhythmPlayRunLoopScale('monster_hero', null, hwCampaign) === 10 && hwCampaign.loopBoost * 2 === 10);
check('ランキングイベントの対象曲の3倍とは重ねず、10に置き換える', rhythmPlayRunLoopScale('monster_hero', ranking, hwCampaign) === 10);
check('期間の外は今までどおり(2倍・イベント対象曲は3倍)', rhythmPlayRunLoopScale('monster_hero', null, null) === 2 && rhythmPlayRunLoopScale('monster_hero', ranking, null) === 3);
check('loopScale を書いていないキャンペーンは周回を変えない', rhythmPlayRunLoopScale('monster_hero', null, { boost: 5 }) === 2 && rhythmPlayRunLoopScale('monster_hero', null, { loopScale: 'x' }) === 2 && rhythmPlayRunLoopScale('monster_hero', null, { loopScale: 0 }) === 2);
check('3分の曲は、ふだん6周・期間中30周(5倍)', rhythmPlayRunLoops(180000, 2) === 6 && rhythmPlayRunLoops(180000, 10) === 30);

// ③ ストーリー(時刻で出すのは第1部だけ。第2部以降はレイドの進み具合で開く=ジャックの話 raid_jack_story_*)
const stories = o.HALLOWEEN_NIGHT_STORIES;
check('時刻で出るのは第1部だけ(開始の時刻)', stories.length === 1 && stories[0].at === START && stories[0].part === 1 && stories[0].id === 'halloween_night_2026_part1');
check('開始の前は読める部が無い', o.halloweenNightStoryIdsAt(jst(START) - 1).length === 0);
check('開始の時刻に第1部だけ', o.halloweenNightStoryIdsAt(jst(START)).join() === stories[0].id);
check('終了の時刻を過ぎても第1部のまま増えない(続きはレイドの話が受け持つ)', o.halloweenNightStoryIdsAt(jst(END)).join() === stories[0].id);
check('壊れた時刻でも落ちない', o.halloweenNightStoryIdsAt(null).length === 0 && o.halloweenNightStoryIdsAt('x').length === 0);

// ④ 台本・回想・BGM・見たか
const ac = { console, Object, Number, Math, Array, JSON, String, Boolean, Date, Map, Set };
vm.createContext(ac);
let replays = null;
try {
  vm.runInContext(`${assistants}\nthis.out={EVENT_REPLAYS,ASSISTANT_UPDATE_NOTICE_SCRIPTS};`, ac);
  replays = ac.out.EVENT_REPLAYS;
} catch (e) { check('assistants.js を動かせる', false, e.message); }
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const WHO = ['mua', 'kiki', 'momosuke', 'dra'];
const JACK_STORY_IDS = ['raid_jack_story_1b', 'raid_jack_story_2', 'raid_jack_story_3', 'raid_jack_story_4', 'raid_jack_story_5', 'raid_jack_story_6', 'raid_jack_ending_cleared', 'raid_jack_ending_notcleared'];
if (replays) {
  for (const story of stories) {
    const rp = replays.find((r) => r.id === story.id);
    check(`第${story.part}部: 回想に登録されている`, !!rp && rp.unlockedKey === `halloweenNightPart${story.part}Seen`);
    const lines = (rp && rp.script) || [];
    check(`第${story.part}部: 30行以上で、表情と話し手が正しい`, lines.length >= 30 && lines.every((l) => WHO.includes(l.who) && EXPR.includes(l.e) && typeof l.t === 'string' && l.t.length > 0), `${lines.length}行`);
    check(`第${story.part}部: 持っていなくても3人が衣装で出る(costumes)`, !!rp && rp.costumes && rp.costumes.mua === 'mua_halloween_2026' && rp.costumes.kiki === 'kiki_halloween_2026' && rp.costumes.momosuke === 'momosuke_halloween_2026');
    check(`第${story.part}部: ドラが話す`, lines.some((l) => l.who === 'dra'));
    check(`第${story.part}部: 回想の日時が出る時刻と同じ`, !!rp && Date.parse(rp.date.replace(' ', 'T') + ':00+09:00') === Date.parse(story.at));
    check(`第${story.part}部: BGMの場面が決まっている`, new RegExp(`${story.id}:'halloweenNightEvent'`).test(bgm));
  }
  // 第2部以降(ジャックの話)は、時刻ではなくレイドの進み具合で開く。衣装・ドラ・BGMだけはここでも確かめる
  for (const id of JACK_STORY_IDS) {
    const rp = replays.find((r) => r.id === id);
    check(`${id}: 回想に登録され、3人が衣装で出て、BGMの場面が決まっている`, !!rp && !!rp.costumes && rp.costumes.mua === 'mua_halloween_2026' && rp.costumes.kiki === 'kiki_halloween_2026' && rp.costumes.momosuke === 'momosuke_halloween_2026' && new RegExp(`${id}:'halloweenNightEvent'`).test(bgm));
  }
  check('旧い時刻制の第2〜5部(halloween_night_2026_part2〜5)が、回想にも台本にも残っていない', !replays.some((r) => /halloween_night_2026_part[2-5]/.test(r.id)) && !/ASSISTANT_HALLOWEEN_NIGHT_[2-5]\b/.test(assistants));
  const all = stories.map((s) => (replays.find((r) => r.id === s.id)?.script || []).map((l) => l.t).join('\n')).join('\n');
  check('「Crazy Party Night ～ぱんぷきんの逆襲～」を正式名称で書いている(略称のモンビーはキャラの会話だけ)', all.includes('Crazy Party Night ～ぱんぷきんの逆襲～'));
  check('ドラの口調に「なんよ」「ほんま」を使っていない', !stories.some((s) => (replays.find((r) => r.id === s.id)?.script || []).some((l) => l.who === 'dra' && /なんよ|んよ|ほんま|せやけど/.test(l.t))));
  const scripts = ac.out.ASSISTANT_UPDATE_NOTICE_SCRIPTS;
  for (const id of ['update_notice_halloween_night_v1', 'update_notice_assistant_costume_v1']) {
    check(`${id}: 4人ぶんの告知がある`, WHO.every((w) => Array.isArray(scripts[id]?.[w]) && scripts[id][w].length >= 3));
  }
}
check('見たかどうかは既存の保存キーの配列に入れる(新しいキーを作らない)', /HALLOWEEN_NIGHT_STORY_IDS\s*=\s*HALLOWEEN_NIGHT_STORIES\.map/.test(app) && /const RHYTHM_EVENT_STORY_IDS = \[\.\.\.HALLOWEEN_NIGHT_STORY_IDS/.test(app));
check('時刻が来た部を古いほうから1つずつ流す(見回りのたびに数え直す)', /halloweenNightStoryIdsAt\(Date\.now\(\)\)\.find\(id => notPlayedYet\(id\)\)/.test(app));
check('回想の「見た」判定が結線されている', /halloweenNightPart\$\{story\.part\}Seen/.test(app));
check('会話のあいだだけ衣装を着せる(setAssistantCostumeStoryNow)', /setAssistantCostumeStoryNow\(eventReplay/.test(app));
// BGMの初期値の差し替え(保存値は書き換えず、鳴らす瞬間だけ)
{
  const st=bgm.indexOf('const BGM_EVENT_DEFAULT_OVERRIDES'), en=bgm.indexOf('const normalizeBgmArrangement');
  const bc={Date,Object,Array,rhythmEventPointCampaignAt:o.rhythmEventPointCampaignAt,BGM_TRACK_BY_ID:{melo_crazy_party_night_full:{},melo_crazy_party_night:{},original_profile:{},custom_x:{}}};
  vm.createContext(bc);
  vm.runInContext(`${bgm.slice(st,en)}\nthis.f=bgmArrangementWithEventDefault;`,bc);
  const f=bc.f, inEv=jst('2026-10-10T12:00:00+09:00'), out=jst('2026-11-01T04:00:00+09:00');
  check('M/B管理: 設定を変えていない人は、期間中だけ全編版', f({management:'original_profile'},'management',inEv)==='melo_crazy_party_night_full' && f({management:'original_profile'},'management',out)==='original_profile' && f({management:'original_profile'},'management',jst(START)-1)==='original_profile');
  check('M/B管理: 自分で曲を選んでいる人は期間中も変えない', f({management:'custom_x'},'management',inEv)==='custom_x');
  check('お話の場面: 全編版が初期値(閉幕の時刻の後でも)', f({halloweenNightEvent:'melo_crazy_party_night'},'halloweenNightEvent',out)==='melo_crazy_party_night_full' && f({halloweenNightEvent:'custom_x'},'halloweenNightEvent',out)==='custom_x');
  check('ほかの場面は変えない', f({home:'original_home'},'home',inEv)==='original_home');
}
check('BGMの既定が新曲', /halloweenNightEvent:'melo_crazy_party_night_full'/.test(bgm));

// ⑤ 新曲
const m = { console, Object, Number, Math, Array, JSON, String, Boolean, Date, Map, Set };
vm.createContext(m);
vm.runInContext(`${rhythmMode}\nthis.out={RHYTHM_SONG_RELEASE_AT,rhythmSongReleased,rhythmDemoSongs,RHYTHM_DEMO_SONG_IDS};`, m);
const ms = m.out;
check('新曲は開始の時刻に出す', ms.RHYTHM_SONG_RELEASE_AT.crazy_party_night === START);
check('開始の前は曲として出ず、時刻から出る', ms.rhythmSongReleased('crazy_party_night', jst(START) - 1) === false && ms.rhythmSongReleased('crazy_party_night', jst(START)) === true);
check('ほかの曲は今までどおりいつでも出る', ms.rhythmSongReleased('monster_hero', 0) === true);
check('一覧に載る曲の宣言(RHYTHM_DEMO_SONG_IDS)には入っている', ms.RHYTHM_DEMO_SONG_IDS.includes('crazy_party_night'));

// ⑥ お知らせ
const body = changelog.slice(0, changelog.indexOf('2026-10-04 02:45'));
check('更新履歴: イベント・着替え・新曲の3件が開始の時刻に出る', (body.match(/visibleFrom:'2026-10-04T08:00:00\+09:00'/g) || []).length === 3 && (body.match(/date: "2026-10-04 08:00"/g) || []).length === 3);
check('イベントのお知らせは期間いっぱい出る(notifyUntil が終了と同じ)', body.includes("notifyUntil:'2026-11-01T04:00:00+09:00'"));
check('お知らせの画像がある', fs.existsSync(path.join(ROOT, 'monster-hero/images/events/halloween-night-2026.jpg')));

console.log(failed ? `\n${failed} 件失敗` : '\nすべてOK');
process.exit(failed ? 1 : 0);
