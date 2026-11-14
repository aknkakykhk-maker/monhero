// モンヒロサクセスの音の割り当て(data/success-sounds.js)と鳴らす口(src/parts/14-success-sound.jsx)の見張り(1秒ほど)。画面は開かない。
//   node tools/success/success-sound-check.js
// 確かめること:
//  1. 表の場面が全部そろっていて、曲は BGM_TRACKS に、効果音は Audio_.fgSe にある(新しい音源を作っていない)
//  2. 使う曲が、モンヒロビート専用・アレンジ専用・ボス曲でない
//  3. 鳴らす口が使う Audio_ は決めた口だけ(音量・消音・モンヒロビート・1回だけ流す曲に触らない)
//  4. 使う効果音・曲は、消音・音量0のときに Audio_ 側で鳴らさない作りのまま
//  5. 動き: 入る前の曲と印を覚える / 同じ場面の曲は鳴らし直さない / 待たせた効果音は離れたら捨てる /
//     離れると印と曲を戻す(サクセスが替えなかった曲は触らない) / 入る前に何も鳴っていなければ止める / useSuccessSound の後片付け
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

const REQUIRED = ['main', 'training', 'rest', 'trainGreat', 'trainOk', 'trainFail', 'trainSkip', 'scold', 'praise', 'trainLvUp', 'ascetic',
  'cupEntry', 'cupMatch', 'cupWin', 'cupLose', 'issa', 'gameOver', 'retire'];
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
  if (s.se && !fgNames.has(s.se)) ng(`${s.id}: 効果音 ${s.se} が Audio_.fgSe にない`);
  if (s.se && !new RegExp(`^    ${s.se}: async \\(\\) => \\{ if \\(!enabled\\) return;`, 'm').test(fgBlock)) ng(`${s.id}: 効果音 ${s.se} が消音で鳴らさない作りでなくなっている`);
}
if (!/if \(!enabled \|\| bgmVolumePct <= 0 \|\| pageHidden\)/.test(audioSrc)) ng('playBGM が消音・音量0・裏のとき鳴らさない作りでなくなっている');
if (data.successSoundBgm('main', 'nonsense') !== data.successSoundBgm('main', 'spring')) ng('知らない季節が春に寄っていない');
if (data.successSoundBgm('trainOk') !== null || data.successSoundBgm('nothing') !== null) ng('曲を替えない場面・知らない場面が null でない');
if (data.successSoundSe('nothing') !== null) ng('知らない場面の効果音が null でない');

// 3
const used = new Set([...partSrc.matchAll(/\ba\.([A-Za-z]+)/g)].map((m) => m[1]));
const ALLOWED = new Set(['currentBgmKey', 'isBackgroundSeQuiet', 'setBackgroundSeQuiet', 'playBGM', 'stopBGM', 'fgSe']);
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
  BGM_TRACK_BY_ID: Object.fromEntries([...trackIds].concat(['hometheme']).map((i) => [i, { id: i }])),
  successSoundBgm: data.successSoundBgm, successSoundSe: data.successSoundSe,
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
eq('トレーニングの結果は曲を替えず効果音だけ', last(), ['se:trainingGoal']);
S.scene('cupWin');
eq('大会の勝ち', last(), ['play:ichika_clear', 'se:rankFanfare']);
S.scene('trainOk', { delayMs: 500 });
eq('待たせた効果音はまだ鳴らさない', last(), []);
S.leave();
eq('離れる→印を戻し、入る前の曲へ', last(), ['quiet:false', 'play:hometheme']);
timers.forEach((t) => t.fn());
eq('離れたあと待たせた効果音は捨てる', last(), []);
S.scene('trainOk');
S.leave();
eq('曲を替えなかったら曲は触らない', last(), ['quiet:true', 'se:trainingGood', 'quiet:false']);
S.leave();
eq('二重に離れても何も起きない', last(), []);
curKey = null; S.scene('gameOver'); last(); S.leave();
eq('入る前に何も鳴っていなければ止める', last(), ['quiet:false', 'stop']);
quiet = true; S.scene('issa'); last(); S.leave();
eq('入る前から印が立っていたら立ったまま戻す', last().filter((c) => c.startsWith('quiet')), ['quiet:true']);
sandbox.useSuccessSound('ascetic', { season: 'winter' });
if (effects.length !== 2) ng('useSuccessSound の effect が2つでない');
else { effects[0](); const cleanup = effects[1](); eq('フックで入る', last(), ['quiet:true', 'play:original_prep', 'se:trainingDecide']); if (typeof cleanup !== 'function') ng('useSuccessSound が後片付けを返さない'); else { cleanup(); if (S.isActive()) ng('後片付けのあとも入ったままになっている'); last(); } }

if (problems.length) { console.log(`NG: ${problems.length} 件`); problems.slice(0, 20).forEach((p) => console.log('  - ' + p)); process.exit(1); }
console.log(`OK: 場面 ${ids.length} / 曲 ${new Set(usedBgm).size} 種 / 効果音 ${new Set(data.SUCCESS_SOUND_SCENES.map((s) => s.se).filter(Boolean)).size} 種 / 動き 12 項目`);
