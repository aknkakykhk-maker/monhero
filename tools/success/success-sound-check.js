// モンヒロサクセスの音の割り当て(data/success-sounds.js)と鳴らす口(src/parts/14-success-sound.jsx)の見張り(1秒ほど)。画面は開かない。
//   node tools/success/success-sound-check.js
// 確かめること:
//  1. 表の場面が全部そろっていて、曲は BGM_TRACKS に、効果音は Audio_.fgSe にある(新しい音源を作っていない)
//  2. 使う曲が、モンヒロビート専用・アレンジ専用・ボス曲でない
//  3. 鳴らす口が使う Audio_ は決めた口だけ(音量・消音・モンヒロビート・1回だけ流す曲に触らない)
//  4. 使う効果音・曲は、消音・音量0のときに Audio_ 側で鳴らさない作りのまま
//  5. 動き: 入る前の曲と印を覚える / 同じ場面の曲は鳴らし直さない / 待たせた効果音は離れたら捨てる /
//     離れると印と曲を戻す(サクセスが替えなかった曲は触らない) / 入る前に何も鳴っていなければ止める / useSuccessSound の後片付け
//  6. 音を意味で引く表(SUCCESS_SFX・2026-11-19 r1119 ①音): 場面は効果音の名前を直接書かず意味(mean)で引く。意味の音は fgSe にある
//  7. 場面ごとに鳴る音が表どおりか(呼び出しの記録): 大会の受付・試合は効果音なし / 勝ち負けはジングルだけ / 休む・遊ぶ・通院は場面の音なし /
//     期の区切りはジングルを切らず、ジングルと効果音を重ねない / 意味で鳴らす口はモンサクの外でも鳴る
//  8. 画面を見張る(点検 Q-6-1): モンサクの部品(56-monhero-success-*・56-monsuc-*)は Audio_・fgSe を直接呼ばない。sfx・se・scene に渡す名前は表にある。
//     60-app の全ボタンのタップ音は、モンサクの画面では fgSe で鳴らす(点検 Q-1-3)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const problems = [];
const ng = (m) => problems.push(m);

const data = require(path.join(root, 'monster-hero/data/success-sounds.js'));
const audioSrc = read('monster-hero/src/parts/14-audio.jsx');
const bgmSrc = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const partSrc = read('monster-hero/src/parts/14-success-sound.jsx');

const REQUIRED = ['main', 'training', 'rest', 'play', 'hospital', 'menu', 'cupPre', 'trainGreat', 'trainOk', 'trainFail', 'trainSkip', 'scold', 'praise', 'trainLvUp', 'ascetic',
  'cupEntry', 'cupMatch', 'cupWin', 'cupLose', 'cupAfter', 'issa', 'gameOver', 'retire', // cupAfter: 決着のあとに大会の曲をループ(2026-11-17 社長の依頼「モンサク改善」)
  'ending', 'endingBad', // エンディングの曲(r1115-091・窓口の依頼)
  // 2026-11-14 演出の音(トレーニングの場面・修行の段・覚醒の入り・期の区切り)
  'trainAct', 'actStep', 'actLeap', 'actHit', 'actDodge', 'actThrow', 'actDrop', 'actGuard', 'actBlock', 'actIdea', 'actFlash', 'actTag', // actTag: 友情タッグのカットイン
  'trainGreatTag', 'actTagJoin', 'actTagFin', 'actGreatCharge', 'actGreatBoom', 'actComboBoom', 'itemUse', 'itemHeal', 'itemBuff', 'itemBond', 'itemBox', // r1115-079 持ち物の演出 / 2026-11-15 社長 OK r1115-067〜069(docs/progress/r1115-067/plan.md)
  'trainTag', 'actTagSpark', 'actGreatFlash', 'actGreatSpark', // 2026-11-18 社長「友情タッグや大成功はSEも激しく」。決めの重ねと、タッグ成功の結果のファンファーレ
  'qStage', 'qCharge', 'qStrike', 'qLeap', 'qSlam', 'qShine', 'qLearn', 'qMiss', 'awakeShow', 'awQi', 'awFlash', 'awKira', 'kiShow', 'kiNext',
  // 2026-11-14 博士の大きな賭けの演出(窓口経由の社長の依頼「大成功の専用の効果音と演出」)
  'issaIn', 'issaDrum', 'issaZap', 'issaPuff', 'issaWin', 'issaWin2', 'issaLose'];
const trackIds = new Set([...bgmSrc.matchAll(/\{\s*id:'([a-z0-9_]+)'/g)].map((m) => m[1]));
const fgStart = audioSrc.indexOf('const fgSe = {');
const fgEnd = audioSrc.indexOf('const se = Object.fromEntries', fgStart);
const fgBlock = audioSrc.slice(fgStart, fgEnd);
const fgNames = new Set([...fgBlock.matchAll(/^    ([A-Za-z]+): async/gm)].map((m) => m[1]));
// 使わない曲: アレンジ専用(自動では使わない)・ボスの曲・モンヒロビート専用(曲名に Beat/Remix)
const FORBIDDEN_BGM = /^(original_event_02|original_boss|ichika_boss|original_dullahan|.*_beat|.*_remix)$/;

// 1・2
const ids = data.SUCCESS_SOUND_SCENES.map((s) => s.id);
for (const r of REQUIRED) if (!ids.includes(r)) ng(`表に場面 ${r} がない`);
for (const id of ids) if (!REQUIRED.includes(id)) ng(`表に決めていない場面 ${id} がある(PLAN と窓口に確認してから足す)`);
if (new Set(ids).size !== ids.length) ng('表の場面 id が重なっている');
const usedBgm = [];
for (const s of data.SUCCESS_SOUND_SCENES) {
  const keys = s.bgmBySeason ? Object.values(s.bgmBySeason) : (s.bgm ? [s.bgm] : []);
  if (s.bgmBySeason && data.SUCCESS_SOUND_SEASONS.some((k) => !s.bgmBySeason[k])) ng(`${s.id}: 季節の曲が4つそろっていない`);
  for (const k of keys) {
    usedBgm.push(k);
    if (!trackIds.has(k)) ng(`${s.id}: 曲 ${k} が BGM_TRACKS にない`);
    if (FORBIDDEN_BGM.test(k)) ng(`${s.id}: 曲 ${k} は使わない曲(アレンジ専用・ボス・モンヒロビート)`);
  }
  if ('se' in s) ng(`${s.id}: 場面に効果音の名前(se)を直接書いている。意味(mean)で書く`);
  if (s.mean && !data.successSfx(s.mean)) ng(`${s.id}: 意味 ${s.mean} が意味の表 SUCCESS_SFX にない`);
}
// 6: 意味の表
const sfxIds = data.SUCCESS_SFX.map((x) => x.id);
if (new Set(sfxIds).size !== sfxIds.length) ng('意味の表の id が重なっている');
for (const need of ['decide', 'back', 'entry', 'matchReady', 'matchGo', 'win', 'lose', 'winSolo', 'loseSolo', 'periodEnd', 'heal', 'hit', 'ko', 'move', 'charge', 'swap']) if (!sfxIds.includes(need)) ng(`意味の表に ${need} がない`);
for (const x of data.SUCCESS_SFX) {
  if (!x.se) continue;
  if (!fgNames.has(x.se)) ng(`意味 ${x.id}: 効果音 ${x.se} が Audio_.fgSe にない`);
  if (!new RegExp(`^    ${x.se}: async \\(\\) => \\{ if \\(!enabled\\) return;`, 'm').test(fgBlock)) ng(`意味 ${x.id}: 効果音 ${x.se} が消音で鳴らさない作りでなくなっている`);
}
// 決めた音(社長の2件・点検 Q-1-1〜Q-1-9)。ここを替えるときは窓口と点検の表に確かめてから
const want = { decide: 'tap', back: 'tap', entry: null, win: null, lose: null, matchReady: 'card' };
for (const [k, v] of Object.entries(want)) if (data.successSfxSe(k) !== v) ng(`意味 ${k} の音が ${v} でない(${data.successSfxSe(k)})`);
for (const k of ['ko', 'charge', 'move']) if (/^training/.test(data.successSfxSe(k) || '')) ng(`試合の ${k} がトレーニングの音の流用になっている(点検 Q-1-8)`);
if (data.successSfxSe('ko') === data.successSfxSe('charge')) ng('KO と溜めが同じ音(点検 Q-1-8)');
for (const x of data.SUCCESS_SFX) if (x.se === 'victory' && x.id !== 'winSolo') ng(`意味 ${x.id} が victory(曲を止める音)を使っている。モンサクでは winSolo だけ`);
const joinUsers = data.SUCCESS_SFX.filter((x) => x.se === 'join').map((x) => x.id);
if (joinUsers.join() !== 'gather') ng(`join(仲間が加わる音)を「仲間」以外の意味に使っている: ${joinUsers.join('・')}(点検 Q-1-9)`);
for (const id of ['cupEntry', 'cupMatch', 'cupWin', 'cupLose', 'rest', 'play', 'hospital']) if (data.successSoundSe(id) !== null) ng(`場面 ${id} に効果音が付いている(点検 Q-1-1・Q-1-4・Q-1-2・Q-1-7)`);
if (!data.successSoundScene('kiShow').afterJingle) ng('期の区切りがジングルを待たない(点検 Q-1-6)');
if (!/if \(!enabled \|\| bgmVolumePct <= 0 \|\| pageHidden\)/.test(audioSrc)) ng('playBGM が消音・音量0・裏のとき鳴らさない作りでなくなっている');
if (data.successSoundBgm('main', 'nonsense') !== data.successSoundBgm('main', 'spring')) ng('知らない季節が春に寄っていない');
if (data.successSoundBgm('trainOk') !== null || data.successSoundBgm('nothing') !== null) ng('曲を替えない場面・知らない場面が null でない');
if (data.successSoundSe('nothing') !== null) ng('知らない場面の効果音が null でない');

// 3
const used = new Set([...partSrc.matchAll(/\ba\.([A-Za-z]+)/g)].map((m) => m[1]));
const ALLOWED = new Set(['currentBgmKey', 'isBackgroundSeQuiet', 'setBackgroundSeQuiet', 'playBGM', 'stopBGM', 'fgSe', 'ensurePlaying']); // ensurePlaying: いまの曲が止まっていたら鳴らし直すだけ(r1115-048 試合の曲の見張り)
for (const u of used) if (!ALLOWED.has(u)) ng(`鳴らす口が決めていない口 Audio_.${u} を使っている`);
if (/Audio_\.(setSeVolume|setBgmVolume|setEnabled|startRhythmTrack|setBgmOnce|setPageHidden|unlock|se\b)/.test(partSrc)) ng('鳴らす口が音量・消音・モンヒロビート・裏の音の口に触っている');
if (/\bAudio_\.se\./.test(partSrc) || /\ba\.se\b/.test(partSrc)) ng('効果音は fgSe(表の音)から鳴らす。se.* は裏の周回の印で消える');
if (!/currentBgmKey/.test(audioSrc.match(/return \{[^\n]*isBackgroundSeQuiet[^\n]*\};/)?.[0] || '')) ng('Audio_ が currentBgmKey を出していない');

// 5: 動き
const calls = [];
let quiet = false; let curKey = 'hometheme';
const fakeAudio = {
  currentBgmKey: () => curKey,
  isBackgroundSeQuiet: () => quiet,
  setBackgroundSeQuiet: (v) => { quiet = !!v; calls.push(['quiet', !!v]); },
  playBGM: (k) => { curKey = k; calls.push(['play', k]); },
  stopBGM: () => { curKey = null; calls.push(['stop']); },
  fgSe: new Proxy({}, { get: (_, n) => () => { calls.push(['se', n]); } }),
};
const effects = [];
const timers = [];
const sandbox = {
  Audio_: fakeAudio,
  BGM_TRACK_BY_ID: Object.fromEntries([...trackIds].concat(['hometheme']).map((i) => [i, { id: i, loop: !/^monsuc_(win|lose)$/.test(i) }])),
  successSoundBgm: data.successSoundBgm, successSoundSe: data.successSoundSe, successSoundScene: data.successSoundScene, successSfxSe: data.successSfxSe,
  setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  useEffect: (fn) => { effects.push(fn); },
};
vm.createContext(sandbox);
vm.runInContext(partSrc.replace('const SuccessSound =', 'var SuccessSound =').replace('const useSuccessSound =', 'var useSuccessSound ='), sandbox);
const S = sandbox.SuccessSound;
const last = () => calls.splice(0).map((c) => c.join(':'));
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) ng(`${name}: ${JSON.stringify(got)} のはずが ${JSON.stringify(want)} ではない`); };

S.scene('main', { season: 'summer' });
eq('入る→メイン(夏・4季節とも同じ曲)', last(), ['quiet:true', 'play:original_home_2']);
S.scene('main', { season: 'summer' });
eq('同じ曲は鳴らし直さない', last(), []);
S.scene('trainGreat');
eq('トレーニングの結果は曲を替えず効果音だけ', last(), ['se:rankFanfare']);
S.scene('cupWin');
eq('大会の勝ち(ジングルを鳴らし効果音は付けない)', last(), ['play:monsuc_win']);
S.scene('trainOk', { delayMs: 500 });
eq('待たせた効果音はまだ鳴らさない', last(), []);
S.leave();
eq('離れる→印を戻し、入る前の曲へ', last(), ['quiet:false', 'play:hometheme']);
timers.forEach((t) => t.fn());
eq('離れたあと待たせた効果音は捨てる', last(), []);
S.scene('trainOk');
S.leave();
eq('曲を替えなかったら曲は触らない', last(), ['quiet:true', 'se:trainingGoal', 'quiet:false']);
S.leave();
eq('二重に離れても何も起きない', last(), []);
curKey = null; S.scene('gameOver'); last(); S.leave();
eq('入る前に何も鳴っていなければ止める', last(), ['quiet:false', 'stop']);
quiet = true; S.scene('issa'); last(); S.leave();
eq('入る前から印が立っていたら立ったまま戻す', last().filter((c) => c.startsWith('quiet')), ['quiet:true']);
sandbox.useSuccessSound('ascetic', { season: 'winter' });
if (effects.length !== 2) ng('useSuccessSound の effect が2つでない');
else { effects[0](); const cleanup = effects[1](); eq('フックで入る', last(), ['quiet:true', 'play:original_prep', 'se:trainingDecide']); if (typeof cleanup !== 'function') ng('useSuccessSound が後片付けを返さない'); else { cleanup(); if (S.isActive()) ng('後片付けのあとも入ったままになっている'); last(); } }

// 7: 場面ごとの呼び出しの記録(大会の流れ)
const flow = [];
sandbox.SuccessSound.sfx('decide'); flow.push(['ボタンの決定音(入る前でも鳴る)', last(), ['se:tap']]);
sandbox.SuccessSound.sfx('win'); flow.push(['大会の勝ちは意味で鳴らしても効果音なし', last(), []]);
S.scene('main', { season: 'spring' }); last();
S.scene('cupEntry'); flow.push(['大会の受付: 曲だけ・効果音なし(社長①)', last(), ['play:monsuc_cup']]);
S.scene('cupMatch'); flow.push(['試合: 曲だけ(さいころの音を重ねない)', last(), ['play:ichika_battle']]);
S.sfx('matchReady'); flow.push(['試合の入りの合図1つ', last(), ['se:card']]);
S.scene('cupWin'); flow.push(['勝ち: ジングルだけ(victory を鳴らさない・社長②)', last(), ['play:monsuc_win']]);
timers.length = 0;
S.scene('kiShow'); flow.push(['ジングル中の期の区切り: すぐには何も鳴らさない', last(), []]);
timers.splice(0).forEach((t) => t.fn()); flow.push(['ジングルのあと: 曲だけ替え、ファンファーレは重ねない', last(), ['play:monster_hero_theme']]);
S.scene('cupLose'); last(); timers.length = 0;
S.scene('main', { season: 'spring' }); flow.push(['負けのジングルのあとの画面替え(曲)', last(), ['play:original_home_2']]);
S.scene('kiShow'); flow.push(['ジングルが無いときの期の区切り: 曲 + ファンファーレ', last(), ['play:monster_hero_theme', 'se:rankFanfare']]);
for (const id of ['rest', 'play', 'hospital']) { S.scene(id); const got = last().filter((c) => c.startsWith('se:')); flow.push([`${id}: 場面の効果音なし(ゲージの音1つにする)`, got, []]); }
S.leave(); last();
for (const [name, got, w] of flow) eq(name, got, w);

// 8: 画面を見張る
const partsDir = path.join(root, 'monster-hero/src/parts');
const monsucFiles = fs.readdirSync(partsDir).filter((f) => /^56-(monhero-success-|monsuc-).*\.jsx$/.test(f));
// 試合の部品はバトルの会話(②)が差し替え中。差し替えが済んだらこの行を消す(残したままにしない)
const PENDING = { '56-monhero-success-arena.jsx': 'バトルの会話(②)が msaSe を意味の表へ差し替え中' };
const code = (src) => src.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, '')).join('\n');
const sceneIds = new Set(ids);
const pending = [];
for (const f of monsucFiles) {
  const src = code(fs.readFileSync(path.join(partsDir, f), 'utf8'));
  const bad = [];
  if (/\bAudio_\b/.test(src)) bad.push('Audio_ を直接呼んでいる');
  if (/\bfgSe\b/.test(src)) bad.push('fgSe を直接呼んでいる');
  for (const m of src.matchAll(/\bmsaSe\(\s*'([A-Za-z]+)'/g)) if (!data.successSfx(m[1])) bad.push(`msaSe('${m[1]}') が意味の表にない(効果音の名前を直接書いている)`);
  for (const m of src.matchAll(/SuccessSound\.sfx\(\s*'([A-Za-z]+)'/g)) if (!data.successSfx(m[1])) ng(`${f}: SuccessSound.sfx('${m[1]}') が意味の表にない`);
  for (const m of src.matchAll(/SuccessSound\.(?:se|scene|keep|sceneAfterOnce)\(\s*'([A-Za-z0-9]+)'/g)) if (!sceneIds.has(m[1])) ng(`${f}: 場面 ${m[1]} が表にない`);
  if (/SuccessSound\.se\(\s*'cupEntry'/.test(src)) bad.push('大会の受付で効果音を鳴らしている(点検 Q-1-1)');
  if (!bad.length) continue;
  if (PENDING[f]) pending.push(`${f}: ${bad.length} 件(${PENDING[f]})`);
  else for (const b of bad) ng(`${f}: ${b}`);
}
const appSrc = read('monster-hero/src/parts/60-app.jsx');
if (!/quickAnywhereSeQuietRef\.current = [^\n]*successScreenOpen/.test(appSrc)) ng('60-app: モンサクの画面でボタンのタップ音が fgSe で鳴らない(印で消える・点検 Q-1-3)');

if (problems.length) { console.log(`NG: ${problems.length} 件`); problems.slice(0, 20).forEach((p) => console.log('  - ' + p)); process.exit(1); }
console.log(`OK: 場面 ${ids.length} / 曲 ${new Set(usedBgm).size} 種 / 効果音 ${new Set(data.SUCCESS_SOUND_SCENES.map((s) => data.successSoundSe(s.id)).filter(Boolean)).size} 種 / 動き 12 項目 / 意味 ${sfxIds.length} 種 / 場面の記録 ${flow.length} 項目 / 画面 ${monsucFiles.length} ファイル`);
if (pending.length) { console.log('待ち(バトルの会話の差し替え後に PENDING から消す):'); pending.forEach((p) => console.log('  - ' + p)); }
