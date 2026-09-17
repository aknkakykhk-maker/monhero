// 第2回モンヒロビート「異世界交響祭」(2026-09-17)の回帰検査。
//
// このイベントで新しく入ったのは「期間限定イベント1件 + 助手ドラの加入」で、
// どちらも既存の基盤(RHYTHM_EVENTS / イベント会話 / 助手システム)へ乗せてある。
// 乗せ違いは**公開してからでないと分からない**ものが多いので、ここで機械的に確かめる。
//
//   node tools/mode/rhythm-symphony-event-check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- データを実際に評価して読む(文字列の一致ではなく、動かした結果で見る) ----
const modeSrc = read('monster-hero/data/rhythm-mode.js');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(modeSrc.match(/const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/)[0], ctx);
vm.runInContext(`${read('monster-hero/data/rhythm-event.js')}
globalThis.__e = { RHYTHM_EVENTS, rhythmLimitedEventAt, rhythmEventPointAwardAt, RHYTHM_DEMO_SONG_IDS };`, ctx);
const { RHYTHM_EVENTS, rhythmLimitedEventAt, rhythmEventPointAwardAt } = ctx.__e;

const EVENT_ID = 'symphony_2026_09_17';
const FIRST_EVENT_ID = 'weekend_2026_09_11';
const STORY_ID = 'symphony_2026_09_17';
const SONGS = ['mou_hitotsu_no_sekai_e', 'pandora_boss_remix', 'the_city_beneath_the_comets'];
const START_MS = Date.parse('2026-09-17T12:00:00+09:00');
const END_MS = Date.parse('2026-09-21T04:00:00+09:00');

const event = RHYTHM_EVENTS.find(e => e && e.id === EVENT_ID) || null;

// ---- ① イベントの定義 ----
check('第2回イベントが定義されている', !!event, EVENT_ID);
check('第1回とは別のイベントとして並んでいる',
  !!event && RHYTHM_EVENTS.some(e => e && e.id === FIRST_EVENT_ID) && EVENT_ID !== FIRST_EVENT_ID,
  `第1回=${FIRST_EVENT_ID} / 第2回=${EVENT_ID}`);
check('期間が 2026-09-17 12:00 〜 2026-09-21 04:00 JST',
  !!event && Date.parse(event.startAt) === START_MS && Date.parse(event.endAt) === END_MS,
  event ? `${event.startAt} 〜 ${event.endAt}` : '');
check('週をまたがない(終わりが週の区切り 月曜5:00 JST 以前)',
  !!event && Date.parse(event.endAt) <= Date.parse('2026-09-21T05:00:00+09:00'));
check('対象曲がちょうど3曲', !!event && event.songIds.length === 3, event ? `${event.songIds.length}曲` : '');
check('対象曲が指定の3曲', !!event && SONGS.every(id => event.songIds.includes(id)),
  event ? event.songIds.join(', ') : '');
check('対象曲はすべて公開済みの既存曲(新曲を足していない)',
  !!event && event.songIds.every(id => ctx.__e.RHYTHM_DEMO_SONG_IDS.includes(id)));
check('「もう一つの世界へ」は既存の曲データを参照している(作り直していない)',
  modeSrc.includes("songId:'mou_hitotsu_no_sekai_e'")
  && modeSrc.includes("bgmTrackId:'melo_mou_hitotsu_no_sekai_e'"));

// ---- ② 開催期間の判定 ----
const at = (iso) => rhythmLimitedEventAt(Date.parse(iso));
check('開始前は開催していない', at('2026-09-17T11:59:00+09:00')?.id !== EVENT_ID);
check('開始直後は開催している', at('2026-09-17T12:00:00+09:00')?.id === EVENT_ID);
check('終了直前は開催している', at('2026-09-21T03:59:00+09:00')?.id === EVENT_ID);
check('終了時刻には開催していない', at('2026-09-21T04:00:00+09:00')?.id !== EVENT_ID);

// ---- ③ ビートP(docs/spec/RHYTHM_EVENT_POINTS.md) ----
// 対象曲1.5倍・通常曲1.0倍・期間外は獲得なし。式そのものは既存実装のまま使う
const during = Date.parse('2026-09-18T12:00:00+09:00');
const award = (songId, score, whenMs = during) => rhythmEventPointAwardAt(whenMs, songId, score);
check('期間外はビートPを獲得しない', award('mou_hitotsu_no_sekai_e', 1000000, Date.parse('2026-09-16T12:00:00+09:00')) === null);
check('イベント対象曲は1.5倍', award('mou_hitotsu_no_sekai_e', 1000000)?.amount === 300,
  `100万点 → ${award('mou_hitotsu_no_sekai_e', 1000000)?.amount}P`);
check('対象曲すべてが1.5倍', SONGS.every(id => award(id, 1000000)?.multiplier === 1.5));
check('期間中なら公開中の通常曲でも1.0倍で獲得できる',
  award('monster_hero', 1000000)?.amount === 200 && award('monster_hero', 1000000)?.target === false,
  `100万点 → ${award('monster_hero', 1000000)?.amount}P`);
check('既存の計算式を変えていない(80万→80P / 95万→95P)',
  award('monster_hero', 800000)?.amount === 80 && award('monster_hero', 950000)?.amount === 95);

// ---- ④ イベント会話と助手ドラ ----
const assistantsSrc = read('monster-hero/data/assistants.js');
const actx = { console };
vm.createContext(actx);
vm.runInContext(`${assistantsSrc}
globalThis.__a = { ASSISTANTS, EVENT_REPLAYS, ASSISTANT_EXPRESSIONS, ASSISTANT_UNLOCK_STORIES,
  assistantUnlockedBy, assistantsUnlockedFrom, ASSISTANT_UPDATE_NOTICE_SCRIPTS, ASSISTANT_SCENES };`, actx);
const A = actx.__a;
const dra = A.ASSISTANTS.find(a => a && a.id === 'dra') || null;
const replay = A.EVENT_REPLAYS.find(r => r && r.id === STORY_ID) || null;

check('助手ドラが助手一覧にいる', !!dra);
check('ドラの表情が既存助手と同じ8種の枠に乗っている',
  !!dra && Array.isArray(dra.expressions) && dra.expressions.length === A.ASSISTANT_EXPRESSIONS.length
  && A.ASSISTANT_EXPRESSIONS.every(e => dra.expressions.includes(e)));
check('ドラの表情画像8枚が配信フォルダにある',
  A.ASSISTANT_EXPRESSIONS.every(e => exists(`monster-hero/images/assistant/dra_${e}.PNG`)),
  A.ASSISTANT_EXPRESSIONS.filter(e => !exists(`monster-hero/images/assistant/dra_${e}.PNG`)).join(', '));
check('ドラの吹き出し用の顔アイコン8枚が作られている',
  A.ASSISTANT_EXPRESSIONS.every(e => exists(`monster-hero/images/assistant/face/dra_${e}.PNG`)),
  A.ASSISTANT_EXPRESSIONS.filter(e => !exists(`monster-hero/images/assistant/face/dra_${e}.PNG`)).join(', '));
check('イベント会話が回想一覧に登録されている', !!replay, replay ? replay.title : '');
check('会話にドラ・みゅあ・きき・ももすけの4人が出ている',
  !!replay && ['dra', 'mua', 'kiki', 'momosuke'].every(id => replay.script.some(l => l.who === id)));
check('会話の表情はすべて既定の8種のどれか',
  !!replay && replay.script.every(l => A.ASSISTANT_EXPRESSIONS.includes(l.e)),
  replay ? [...new Set(replay.script.filter(l => !A.ASSISTANT_EXPRESSIONS.includes(l.e)).map(l => l.e))].join(', ') : '');
check('ドラの一人称が「おで」でそろっている',
  !!replay && !replay.script.some(l => l.who === 'dra' && /(?:^|[^ぁ-ん])(わたし|私|僕|ぼく|俺|おれ)/.test(l.t)));

// ---- ⑤ ドラの解放(ストーリーを最後まで見たときだけ・冪等) ----
check('ドラの解放条件がイベント会話に結び付いている', A.ASSISTANT_UNLOCK_STORIES.dra === STORY_ID);
check('ストーリー未完了ではドラを選べない',
  A.assistantUnlockedBy('dra', []) === false && !A.assistantsUnlockedFrom([]).some(a => a.id === 'dra'));
check('ストーリー完了後はドラを選べる',
  A.assistantUnlockedBy('dra', [STORY_ID]) === true && A.assistantsUnlockedFrom([STORY_ID]).some(a => a.id === 'dra'));
check('回想で見直しても二重に解放されない(冪等)',
  A.assistantsUnlockedFrom([STORY_ID, STORY_ID]).filter(a => a.id === 'dra').length === 1);
check('イベントが終わっても解放は残る(判定に期間を使っていない)',
  A.assistantUnlockedBy('dra', [STORY_ID]) === true
  && !/startAt|endAt|Date\.now/.test(String(A.assistantUnlockedBy)));
check('既存の助手3人は条件なしで選べるまま',
  ['mua', 'kiki', 'momosuke'].every(id => A.assistantUnlockedBy(id, [])));

// ---- ⑥ 画面のつなぎ(本体側) ----
const appSrc = read('monster-hero/src/parts/60-app.jsx');
const bgmSrc = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
check('会話が「見た」として記録される一覧に入っている',
  /RHYTHM_EVENT_STORY_IDS\s*=\s*\[[^\]]*SYMPHONY_STORY_ID/.test(appSrc));
check('開催中の会話をイベントidから引いている(第1回のidを直書きしていない)',
  appSrc.includes('RHYTHM_EVENT_STORY_BY_EVENT')
  && !/notPlayedYet\(MONBEAT_CUP_STORY_ID\)/.test(appSrc));
check('閉幕の会話もイベントidから引いている(第2回の終了で第1回のお礼を流さない)',
  appSrc.includes('RHYTHM_EVENT_THANKS_STORY_BY_EVENT')
  && !/notPlayedYet\(MONBEAT_CUP_THANKS_STORY_ID\)/.test(appSrc));
check('助手えらびが解放済みだけを並べている',
  appSrc.includes('assistantsUnlockedFrom(rhythmEventStorySeen)')
  && appSrc.includes('assistantUnlockedBy(who.id,rhythmEventStorySeen)'));
check('イベントBGMが「もう一つの世界へ」に設定されている',
  /symphony_2026_09_17:'symphonyEvent'/.test(bgmSrc)
  && /symphonyEvent:'melo_mou_hitotsu_no_sekai_e'/.test(bgmSrc));

// ---- ⑦ 音源を複製していない ----
// 既存のBGMをそのまま指すだけで、mp3は1バイトも足していないこと
const audioDir = path.join(root, 'monster-hero/audio');
const audioForSong = fs.readdirSync(audioDir).filter(f => /symphony|isekai|交響/i.test(f));
check('イベント用に音源を複製していない', audioForSong.length === 0, audioForSong.join(', '));

// ---- ⑧ 告知(画像・更新履歴・助手のセリフ) ----
const changelogSrc = read('monster-hero/data/changelog.js');
check('正方形の告知画像がある', exists('monster-hero/images/events/monbeat-event-2026-09-17.jpg'));
check('横長の告知画像がある', exists('monster-hero/images/events/monbeat-event-2026-09-17-wide.jpg'));
check('横長の画像がイベントのバナーに指定されている',
  !!event && String(event.banner || '').includes('monbeat-event-2026-09-17-wide.jpg'));
check('更新履歴に第2回の項目がある', changelogSrc.includes('異世界交響祭'));
check('更新履歴が開始時刻まで一覧に出ない(visibleFrom)',
  /visibleFrom:'2026-09-17T12:00:00\+09:00'/.test(changelogSrc));
check('助手の告知も同じ時刻から出る(notifyFrom が visibleFrom と同じ)',
  /notifyFrom:'2026-09-17T12:00:00\+09:00'/.test(changelogSrc));
check('助手の告知がイベント終了で止まる(notifyUntil)',
  /notifyUntil:'2026-09-21T04:00:00\+09:00'/.test(changelogSrc));
check('告知のセリフが助手4人ぶんそろっている',
  ['mua', 'kiki', 'momosuke', 'dra'].every(id =>
    (A.ASSISTANT_UPDATE_NOTICE_SCRIPTS.update_notice_rhythm_symphony_v1 || {})[id]),
  Object.keys(A.ASSISTANT_UPDATE_NOTICE_SCRIPTS.update_notice_rhythm_symphony_v1 || {}).join(', '));
check('ドラの通常セリフが主要画面に入っている',
  ['home', 'market', 'rhythmHome', 'resultWin', 'resultLose'].every(scene =>
    (A.ASSISTANT_SCENES[scene]?.lines || []).some(l => l.who === 'dra')));

// ---- ⑨ 第1回を壊していない ----
const first = RHYTHM_EVENTS.find(e => e && e.id === FIRST_EVENT_ID) || null;
check('第1回の定義がそのまま残っている',
  !!first && first.songIds.length === 3 && first.totalReward === 'heroProof'
  && first.participationReward.heroProof === 10);
check('第1回の会話と閉幕の会話が残っている',
  ['monbeat_cup_2026_09', 'monbeat_cup_2026_09_thanks'].every(id => A.EVENT_REPLAYS.some(r => r.id === id)));

console.log('');
if (failed) { console.log(`${failed}件のNGがあります`); process.exit(1); }
console.log('すべてOK');
