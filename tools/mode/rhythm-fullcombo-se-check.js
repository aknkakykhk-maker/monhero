#!/usr/bin/env node
// フルコンボ・ALL EXCELLENT・ALL MARVELOUS の音が、設定ごとに「1回だけ」鳴ることを数える(2026-11-20 社長
// 「フルコンボのとき鳴っていた SE が気づいたら無くなっている」。お祝い画面が出ない設定だと音も消えていた)。
//   node tools/mode/rhythm-fullcombo-se-check.js
// 鳴らす場所は2つだけ: (1) お祝い画面に入ったとき(status==='celebrate') (2) お祝い画面が出ない設定で結果へ進むとき。
// どの設定でも、称号があって失敗でないなら ちょうど1回。称号がない・失敗なら0回。鳴らさないのは playFullCombo の中の守り
// (ノーツの効果音OFF・音量0・全体ミュート)だけ。
'use strict';
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '30-rhythm-play.jsx'), 'utf8');
let ng = 0; const ok = (name, pass, detail) => { console.log(`${pass ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); if (!pass) ng++; };

const m = SRC.match(/const rhythmCelebrateSeWhen=\(title,failed,showCelebrate\)=>[^\n]*;/);
ok('音を鳴らす時を決める関数がある', !!m);
const when = m ? new Function(`${m[0]};return rhythmCelebrateSeWhen;`)() : () => null;

// 設定の組み合わせ(軽量モード・演出量・フルコン演出)から showCelebrate を同じ式で出し、鳴る回数を数える
const fxOn = (setting, def) => (setting === 'ON' ? true : setting === 'OFF' ? false : def);
let all = true, detail = [];
for (const title of [null, 'FULL COMBO!', 'ALL EXCELLENT!!', 'ALL MARVELOUS!!'])
  for (const failed of [false, true])
    for (const lightweight of [false, true])
      for (const amount of ['MINIMAL', 'NORMAL', 'MAX'])
        for (const big of ['AUTO', 'ON', 'OFF']) {
          const show = !!title && !failed && fxOn(big, !lightweight && amount !== 'MINIMAL');
          const w = when(title, failed, show);
          const plays = (w === 'celebrate' ? 1 : 0) + (w === 'result' ? 1 : 0);
          const want = title && !failed ? 1 : 0;
          if (plays !== want || (w === 'celebrate') !== show) { all = false; detail.push(`${title}/${failed}/${lightweight}/${amount}/${big}→${w}`); }
        }
ok('どの設定でも、称号があって失敗でないときは1回だけ・無いか失敗なら0回', all, detail.slice(0, 3).join(' '));
ok('お祝い画面が出る設定では、結果へ進むところでは鳴らさない(二重に鳴らさない)', when('FULL COMBO!', false, true) === 'celebrate');
ok('お祝い画面が出ない設定(軽量モード・演出量が最小・演出OFF)でも鳴らす', when('FULL COMBO!', false, false) === 'result');

const calls = SRC.split('RHYTHM_NOTE_SE_RUNTIME.playFullCombo()').length - 1;
ok('playFullCombo を呼ぶ場所は2つだけ(お祝い画面・結果へ進むところ)', calls === 2, `${calls}か所`);
ok('結果へ進むところは rhythmCelebrateSeWhen が \'result\' のときだけ', /rhythmCelebrateSeWhen\(celebrateTitle,failed,showCelebrate\)==='result'\)\{try\{RHYTHM_NOTE_SE_RUNTIME\.playFullCombo\(\)/.test(SRC));
ok('お祝い画面に入ったときは status===\'celebrate\' で1回', /if\(view\.status!=='celebrate'\)return;\s*RHYTHM_NOTE_SE_RUNTIME\.playFullCombo\(\);/.test(SRC));

const RT = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'rhythm-mode.js'), 'utf8');
const pf = RT.slice(RT.indexOf('const playFullCombo=()=>'), RT.indexOf('const playFullCombo=()=>') + 400);
ok('音が鳴らないのは「ノーツの効果音OFF・音量0・全体ミュート」だけ(playFullCombo の守りのまま)', /!settings\.enabled\|\|settings\.volume<=0\|\|!rhythmAudioGloballyEnabled\(\)/.test(pf));
console.log(ng ? `\n${ng}件のNGがあります` : '\nすべてOK'); process.exit(ng ? 1 : 0);
