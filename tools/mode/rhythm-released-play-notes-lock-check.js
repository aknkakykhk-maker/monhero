#!/usr/bin/env node
// 公開中の曲の「演奏が始まるときのノーツ列」が変わっていないかを見張る(2026-11-07・ビート部 マモリ)。
//
//   node tools/mode/rhythm-released-play-notes-lock-check.js                          # 見張る(CI でも回す)
//   node tools/mode/rhythm-released-play-notes-lock-check.js --update --reason "<理由>"  # 意図して変えたときだけ控えを更新
//   node tools/mode/rhythm-released-play-notes-lock-check.js --root <フォルダ> --print   # 別のチェックアウトの指紋を出すだけ(過去との比べ)
//
// 【なぜ要るか】社長「既存曲ちょこちょこ勝手に変わるけどそうならないようにできないの？」(2026-11-07)。
//   rhythm-released-chart-lock-check.js はマーカーの中身(データ)しか見ない。データが同じでも、ゲームが
//   ノーツを組み立てる処理(rhythm-mode.js の t/h/f/S・parts の makeRuntimeNotes・ミラー・アシスト)が変わると、遊ぶ譜面が変わる。
// 【何を見るか】曲えらびに出ている曲 × 5難易度 + HELL を、ゲームと同じ関数で組み立てた最終のノーツ列
//   (時刻・レーン・幅・種類・長さ・フリックの向き・終点フリック・空中・スライドの点と刻み・判定の刻み・難易度ごとの追い方の余裕 など全部)
//   と、譜面の総ノーツ数・長さ・速さの変化。ふつう・ミラー・アシストの3通りの指紋を控え(rhythm-released-play-notes-lock.json)と比べる。
//   控えに無い曲(新曲)は OK のまま知らせる。
'use strict';
const path=require('path');
const L=require('./rhythm-play-lock-lib.js');

const LOCK=path.join(__dirname,'rhythm-released-play-notes-lock.json');
const NOTE='公開中の曲の、演奏が始まるときのノーツ列の指紋(ふつう・ミラー・アシスト)。勝手に書き換えない。意図して変えたときだけ rhythm-released-play-notes-lock-check.js --update --reason で更新する';
const args=process.argv.slice(2);
const root=L.rootFrom(args);

const collect=()=>{
  const play=L.loadPlay(root);
  const charts=L.playCharts(play);
  const items={};for(const [key,entry] of Object.entries(charts))items[key]=L.chartPrints(play,entry);
  return {play,items};
};

if(require.main===module){
  const {play,items}=collect();
  if(args.includes('--print')){console.log(JSON.stringify({hasMakeRuntime:play.hasMakeRuntime,items}));process.exit(0);}
  if(args.includes('--update')){
    const reason=L.argOf(args,'--reason');if(!reason)throw new Error('--reason "<理由>" が要る(だれが決めた、どの直しか)');
    const old=L.readLock(LOCK).items||{};
    const changed=Object.keys(items).filter(k=>JSON.stringify(old[k])!==JSON.stringify(items[k]));
    L.writeLock(LOCK,NOTE,items,reason,changed);
    console.log(`控えを更新した(${changed.length}譜面): ${changed.join(' ')||'なし'}`);
    process.exit(0);
  }
  const r=L.reporter();
  r.ok('ゲームの組み立て処理(makeRuntimeNotes・ミラー・アシスト)が見つかる',play.hasMakeRuntime&&!!play.rhythmTransformChart,
    'parts から切り出せなかった。名前や書き方を変えたなら rhythm-play-lock-lib.js も合わせる');
  const lock=L.readLock(LOCK).items||{};
  const diffs=[];
  for(const [key,want] of Object.entries(lock)){
    const got=items[key];if(!got)continue;
    const bad=Object.keys(want).filter(v=>want[v]!==got[v]);
    if(bad.length)diffs.push(`${key}(${bad.join('・')})`);
  }
  const missing=Object.keys(lock).filter(k=>!items[k]);
  const fresh=Object.keys(items).filter(k=>!lock[k]);
  r.ok(`公開中の譜面(${Object.keys(lock).length}譜面)の、組み立て後のノーツ列が控えと同じ`,!diffs.length,
    `変わった: ${diffs.slice(0,30).join(' ')}${diffs.length>30?` ほか${diffs.length-30}`:''}。データが同じでも組み立て方が変わると遊ぶ譜面が変わる。`
    +'意図した変更なら node tools/mode/rhythm-released-play-notes-lock-check.js --update --reason "<理由>"、そうでなければ元へ戻す');
  r.ok('控えにある譜面が消えていない',!missing.length,missing.join(' '));
  if(fresh.length)console.log(`(まだ控えに無い譜面 ${fresh.length}: ${fresh.join(' ')}。公開したら --update で控えに入れる)`);
  r.finish();
}
module.exports={collect};
