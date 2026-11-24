#!/usr/bin/env node
// モンヒロビートの場面の音が「何回・いつ」鳴るかを数える(2026-11-20 音の点検 docs/progress/kensa/beat-sound-2026-11/ の F2〜F7)。
//   node tools/mode/rhythm-scene-se-check.js
// 耳で聞かずに、鳴らす時を決める関数をソースから取り出して回し、鳴らす場所の数と守り(ノーツの効果音OFF・音量0・全体ミュート)を確かめる。
// 形は tools/mode/rhythm-fullcombo-se-check.js と同じ。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'monster-hero');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PLAY = read('src/parts/30-rhythm-play.jsx');
const RT = read('data/rhythm-mode.js');
let ng = 0; const ok = (name, pass, detail) => { console.log(`${pass ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); if (!pass) ng++; };
const pick = (src, re, name) => { const m = src.match(re); return m ? new Function(`${m[0]};return ${name};`)() : null; };
const count = (src, s) => src.split(s).length - 1;

// ---- 音の部品(playCue)の守り ----
const cueAt = RT.indexOf('const playCue=(kind)=>{');
const cue = cueAt >= 0 ? RT.slice(cueAt, cueAt + 700) : '';
ok('場面の合図の音 playCue がある(count・join・mvp)', cueAt >= 0 && /RHYTHM_CUE_NOTES=\{count:.*join:.*mvp:/.test(RT));
ok('playCue が鳴らないのは「ノーツの効果音OFF・音量0・全体ミュート」(playFullCombo と同じ守り)', /!settings\.enabled\|\|settings\.volume<=0\|\|!rhythmAudioGloballyEnabled\(\)/.test(cue));
ok('playCue を外から呼べる', /playNewRecord,(?:playResultCount,)?playCue,holdSync/.test(RT));

// ---- F6 演奏前の 3・2・1 ----
const cueOf = pick(PLAY, /const rhythmCountdownCueOf=step=>[^\n]*;/, 'rhythmCountdownCueOf');
const stepsM = RT.match(/const RHYTHM_COUNTDOWN_STEPS=Object\.freeze\((\[[^\]]*\])\)/);
const resumeM = PLAY.match(/const RHYTHM_RESUME_COUNTDOWN_STEPS=Object\.freeze\((\[[^\]]*\])\)/);
const startSteps = stepsM ? JSON.parse(stepsM[1].replace(/'/g, '"')) : [];
const resumeSteps = resumeM ? JSON.parse(resumeM[1].replace(/'/g, '"')) : [];
ok('数えの音を決める関数がある', typeof cueOf === 'function');
if (cueOf) {
  const n = startSteps.filter(cueOf).length, r = resumeSteps.filter(cueOf).length;
  ok('演奏前(READY・3・2・1)で鳴るのは3回(READY では鳴らさない)', n === 3, `${startSteps.join(',')}→${n}回`);
  ok('再開前(3・2・1)も3回', r === 3, `${resumeSteps.join(',')}→${r}回`);
}
ok('数えの音を鳴らすのは数えの1か所だけ(ソロ・マルチとも同じ数え runCountdown)', count(PLAY, "RHYTHM_NOTE_SE_RUNTIME.playCue('count')") === 1
  && /setCountdownStep\(steps\[index\]\);[\s\S]{0,200}if\(rhythmCountdownCueOf\(steps\[index\]\)\)try\{RHYTHM_NOTE_SE_RUNTIME\.playCue\('count'\)/.test(PLAY));

// ---- F7 初めてのクリアの NEW RECORD ----
const recDelay = pick(PLAY, /const RHYTHM_RECORD_SE_AFTER_FULLCOMBO_MS=\d+;\nconst rhythmRecordSeDelayOf=[^\n]*;/, 'rhythmRecordSeDelayOf');
const celebWhen = pick(PLAY, /const rhythmCelebrateSeWhen=\(title,failed,showCelebrate\)=>[^\n]*;/, 'rhythmCelebrateSeWhen');
ok('新記録の音の時を決める関数がある', typeof recDelay === 'function' && typeof celebWhen === 'function');
if (recDelay && celebWhen) {
  let bad = [];
  for (const isNew of [false, true]) for (const failed of [false, true]) for (const practice of [false, true])
    for (const title of [null, 'FULL COMBO!']) for (const show of [false, true]) {
      const d = recDelay(isNew, failed, practice, celebWhen(title, failed, show && !!title));
      const plays = d === null ? 0 : 1, want = isNew && !failed && !practice ? 1 : 0;
      if (plays !== want) bad.push(`new=${isNew}/failed=${failed}/practice=${practice}`);
      // フルコンボの音を結果で鳴らすときは重ならないよう 0.7 秒(上昇アルペジオの長さ)より後
      if (plays && celebWhen(title, failed, show && !!title) === 'result' && !(d >= 700)) bad.push(`重なる ${d}ms`);
      if (plays && celebWhen(title, failed, show && !!title) !== 'result' && d !== 0) bad.push(`遅れる ${d}ms`);
    }
  ok('NEW RECORD の札が出るとき(初めてのクリアも)1回・失敗と練習は0回・フルコンボの音とは重ならない', bad.length === 0, bad.slice(0, 3).join(' '));
}
ok('playNewRecord を呼ぶのは結果の1か所だけ(演出の有無と分けた)', count(PLAY, 'RHYTHM_NOTE_SE_RUNTIME.playNewRecord()') === 1
  && /const recordSeId=view\.status==='result'/.test(PLAY) && /\},\[recordSeId\]\);/.test(PLAY));
ok('初めてのクリアの印は札と同じ isNewRecord から作る', /rhythmRecordSeDelayOf\(isNewRecord,failed,tutorial\|\|calibrating,rhythmCelebrateSeWhen\(celebrateTitle,failed,showCelebrate\)\)/.test(PLAY));

// ---- F4 結果の経験値の数え上げ / F5 ランクアップの重なり(ソロの結果・カードランクと同じ部品 43-player-rank-ui) ----
const RANK = read('src/parts/43-player-rank-ui.jsx');
const AUDIO = read('src/parts/14-audio.jsx');
const gapM = RANK.match(/const PLAYER_RANK_XP_TICK_GAP_MS = (\d+);\nconst playerRankXpTickDue = [^\n]*;/);
const tickDue = gapM ? new Function(`${gapM[0]};return playerRankXpTickDue;`)() : null;
ok('数え上げの音の間を決める関数がある(0.08秒以上)', !!tickDue && Number(gapM[1]) >= 80, gapM ? `${gapM[1]}ms` : '');
if (tickDue) {
  // 本物と同じ数え方: 1つの札を0.32秒で数え上げ、数が変わるたび(60fps の毎フレーム)に音の番を聞く。札は0.48秒おき(ランクが上がる札は1.15秒)
  for (const [label, parts] of [['経験値3札(よくある結果)', [120, 60, 40]], ['大きい数(1札 2000)', [2000]], ['小さい数(1札 5)', [5]]]) {
    const run = {}; const times = []; let t0 = 0;
    for (const xp of parts) {
      let last = -1;
      for (let f = 0; f <= 22; f++) { const now = t0 + f * 16.7; const kk = Math.min(1, f * 16.7 / 320), val = Math.round(xp * kk); if (val !== last) { last = val; if (tickDue(run, now)) times.push(now); } }
      t0 += 480;
    }
    const gaps = times.slice(1).map((x, i) => x - times[i]);
    const minGap = gaps.length ? Math.min(...gaps) : Infinity;
    ok(`数え上げの音は0.08秒以上あけて鳴る: ${label}`, minGap >= 80 && times.length >= 1, `${times.length}回・最短の間 ${Number.isFinite(minGap) ? Math.round(minGap) : '-'}ms`);
  }
}
ok('数え上げはボタンの音(tap)ではなく専用の xpTick', /if \(playerRankXpTickDue\(run, now\)\) se\('xpTick'\);/.test(RANK) && !/val % 3 === 0\) se\('tap'\)/.test(RANK)
  && /xpTick: async \(\) => \{ if \(!enabled\) return;/.test(AUDIO));
const finalM = RANK.match(/const playerRankXpFinalSe = [^\n]*;/);
const finalSe = finalM ? new Function(`${finalM[0]};return playerRankXpFinalSe;`)() : null;
ok('ランクが上がって演出が出るときは、棒の伸び終わりのごほうびの音を鳴らさない(割れる音・ファンファーレと重ねない)', !!finalSe
  && finalSe(true, true) === false && finalSe(false, true) === true && finalSe(true, false) === true && finalSe(false, false) === true);
ok('棒の伸び終わりの trainingReward は playerRankXpFinalSe を通す', /if \(playerRankXpFinalSe\(rankUp, !!onFull\)\) se\('trainingReward'\);/.test(RANK));
ok('演出側は 割れる音 → ファンファーレ → ごほうび の順で、ごほうびはファンファーレより後', /setTimeout\(\(\) => se\('crit'\), 500\)/.test(RANK) && /\(gainStart \+ i \* 0\.35\) \* 1000 \+ 150/.test(RANK));

// ---- F2 マルチで人・マスモンが加わった / F3 マルチのみんなの結果の MVP ----
const MULTI = read('src/parts/77-screen-rhythm-multi.jsx');
const joinCue = pick(MULTI, /const rhythmMultiJoinCue = \(memo, code, ids, selfId\) => \{[\s\S]*?\n\};/, 'rhythmMultiJoinCue');
const mvpCue = pick(MULTI, /const rhythmMultiMvpCueRound = \(memo, round, shown, waiting, mvpId\) => \{[\s\S]*?\n\};/, 'rhythmMultiMvpCueRound');
ok('入室の音・MVP の音を決める関数がある', typeof joinCue === 'function' && typeof mvpCue === 'function');
if (joinCue) {
  // 部屋の流れを1画面ぶん再生し、鳴った回数を数える
  const memo = { code: '', seen: new Set() }; let plays = 0; const step = (code, ids) => { if (joinCue(memo, code, ids, 'me')) plays++; };
  step('A', ['host', 'me']);            // 自分が入った(先にいた人では鳴らさない)
  const p0 = plays;
  step('A', ['host', 'me', 'p2']);      // 人が入った → 1回
  const p1 = plays;
  step('A', ['host', 'me', 'p2', 'cpu1']); // マスモン(CPU)が入った → 1回
  const p2 = plays;
  step('A', ['host', 'me', 'p2', 'cpu1']); step('A', ['host', 'me', 'cpu1']); step('A', ['host', 'me', 'p2', 'cpu1']); // 同じ顔ぶれ・ゆらぎで消えて戻る → 鳴らない
  const p3 = plays;
  step('A', ['host', 'me', 'p2', 'cpu1', 'p3', 'p4']); // 2人同時 → 1回(重ねない)
  const p4 = plays;
  step('B', ['x', 'me']);               // 別の部屋へ入り直した → 覚え直すだけ
  const p5 = plays;
  ok('自分が入ったときは鳴らさない', p0 === 0, `${p0}回`);
  ok('人が入ったら1回・マスモンが入っても1回', p1 === 1 && p2 === 2, `${p1}・${p2 - p1}回`);
  ok('同じ顔ぶれ・通信のゆらぎで消えて戻った人では鳴らさない', p3 === p2, `${p3 - p2}回`);
  ok('同時に何人入っても1回だけ', p4 === p3 + 1, `${p4 - p3}回`);
  ok('別の部屋に入り直したときは鳴らさない', p5 === p4, `${p5 - p4}回`);
}
if (mvpCue) {
  const memo = { round: '' }; let plays = 0; const step = (...a) => { const r = mvpCue(memo, ...a); if (r) plays++; };
  step('r1', true, true, 'p2');   // ほかの人を待っている → 鳴らさない
  const w = plays;
  step('r1', true, false, 'p2'); step('r1', true, false, 'p2'); step('r1', true, false, 'p2'); // 出そろった → 1回だけ(描き直しで鳴り直さない)
  const one = plays;
  step('r1', false, false, 'p2'); // 結果を閉じた
  step('r2', true, false, null);  // MVP がいない(全員やめた) → 鳴らさない
  const none = plays;
  step('r2', true, false, 'me');  // 次のライブ → 1回
  ok('MVP の音: 待っている間は鳴らさない・出そろったら1回・描き直しで鳴り直さない・MVP がいなければ鳴らさない・次のライブでまた1回',
    w === 0 && one === 1 && none === 1 && plays === 2, `${w}/${one}/${none}/${plays}`);
}
ok('入室の音は playCue(\'join\') を1か所・MVP の音は playCue(\'mvp\') を1か所', count(MULTI, "RHYTHM_NOTE_SE_RUNTIME.playCue('join')") === 1 && count(MULTI, "RHYTHM_NOTE_SE_RUNTIME.playCue('mvp')") === 1);
{
  // フックはモードえらびの早い return より前に置く(部屋に入る前後でフックの数が変わると画面が落ちる)
  const hook = MULTI.indexOf('const joinCueRef = React.useRef('), early = MULTI.indexOf('  if (!view && !searching && modeSelect) {');
  ok('部屋の音のフックは、画面の早い return より前にある', hook > 0 && early > 0 && hook < early);
}

console.log(ng ? `\n${ng}件のNGがあります` : '\nすべてOK'); process.exit(ng ? 1 : 0);
