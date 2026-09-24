#!/usr/bin/env node
// ランを片付けたとき、そのターンの演出が画面に残らないか。
//
//   node tools/battle/run-abandon-fx-check.js
//
// 【なぜ要るか】(2026-09-20・ユーザー報告)
//   「デバッグモードでバトル確認しようとしたら、近距離に誰もいないのに攻撃アクションが起きる」
//   実際に出ていたのは技名(slotSkill)で、誰も立っていない間合いに「トリオビーム∞」
//   (モノリスの固有技の最終段階の名前)が浮いたままになっていた。
//
// 【仕組みの話】
//   ターンの演出はどれも「出す → await battleWait → 消す」の形で書かれている。
//   ところが battleWait は**世代(runGenerationRef)が変わると resolve しない**
//   (古い待ちが新しいランを触らないための作り)。つまり世代を進めると、
//   **消すほうへ二度と到達しない**。演出は state なので次のランへそのまま持ち越され、
//   関係のない画面に前のランの技名やモーションが残る。
//   同じ落とし穴は 2026-09-14 に ref の印(autoTurnRunningRef)でも踏んでいて、
//   そのときは abandonRunAnimations で印を下ろすことで直した。演出の state も同じ場所で捨てる。
//
// 【ここで見るもの】
//   ① battleWait が世代を見ていること(この前提が消えたら、上の話ごと変わる)
//   ② ターンの演出を出しっぱなしにしない = abandonRunAnimations が全部捨てていること
//   ③ 捨てている state が本当に存在すること(名前を変えたときに気づけるように)
//   ④ 技名は slotIndex だけで置き場所が決まり、そこに誰かいるかは見ていないこと
//      (＝残ると「誰もいない間合いに技名」になる。今回の見え方そのもの)
//
// ★演出の state を増やしたら、下の TURN_FX へも足すこと。
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
const battleScreen=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/71-screen-battle.jsx'),'utf8');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// そのターンかぎりの見た目。片付けたら消えていないといけないもの。
// ★進行データ(敵・盤面・ダメージ)はここに入れない。片付けは別の受け持ち。
// ★addPopup と fireTeachingFx は自前の setTimeout で消える(世代を見ていない)ので対象外。
const TURN_FX=[
  {state:'attackAnim',     clear:'setAttackAnim(null)',      what:'味方の攻撃モーション'},
  {state:'slotSkill',      clear:'setSlotSkill(null)',       what:'技名の表示(今回の報告)'},
  {state:'slotSettle',     clear:'setSlotSettle(null)',      what:'カードをはめ込んだ演出'},
  {state:'enemySkillName', clear:'setEnemySkillName(null)',  what:'敵の技名の表示'},
  {state:'guardFx',        clear:'setGuardFx(false)',        what:'ガード成功の演出'},
  {state:'enemyAttackAnim',clear:'setEnemyAttackAnim(false)',what:'敵の攻撃モーション'},
  {state:'enemyAttackFx',  clear:'setEnemyAttackFx(null)',   what:'敵の攻撃の演出'},
];

// ① 前提: battleWait は世代が変わったら resolve しない
{
  const start=app.indexOf('const battleWait = useCallback(');
  const body=start<0?'':app.slice(start,start+400);
  check('battleWait が世代を見ている(変わったら先へ進まない)',
    body.includes('const generation = runGenerationRef.current')
    &&body.includes('if (runGenerationRef.current === generation) resolve()'),
    start<0?'battleWait が見つからない':'');
}

// ② 片付けで演出を全部捨てているか
const start=app.indexOf('const abandonRunAnimations = () => {');
const end=app.indexOf('\n  };',start);
const abandon=start<0||end<0?'':app.slice(start,end);
check('ランの片付け(abandonRunAnimations)がある',!!abandon);
check('片付けで世代を進めている',abandon.includes('runGenerationRef.current += 1'));
for(const {state,clear,what} of TURN_FX){
  check(`片付けで「${what}」を捨てている`,abandon.includes(clear),clear);
  // ③ 名前が実在するか(state を消した・名前を変えたときに、上の行が素通りしないように)
  check(`「${what}」の state がある`,new RegExp(`const \\[${state}, set`).test(app),state);
}

// ④ 技名は置き場所しか見ていない = 残ると誰もいない間合いに出る
{
  // ★2026-09-24 に揺れの影響を受けないよう body 直下へ出した(ReactDOM.createPortal)。どちらの書き出しでも読む
  const start=Math.max(battleScreen.indexOf('{slotSkill&&('),battleScreen.indexOf('{slotSkill&&ReactDOM.createPortal('));
  const body=start<0?'':battleScreen.slice(start,start+700);
  check('技名は slotIndex だけで置き場所を決めている',
    body.includes('left:`${12.5+slotSkill.slotIndex*25}%`'),
    start<0?'技名の表示が見つからない':'');
  check('技名は「そこに誰かいるか」を見ていない(だから片付けが要る)',
    !!body&&!/slots\[slotSkill\.slotIndex\]/.test(body));
}

// ⑤ 演出は「出す → await battleWait → 消す」の形(＝中断されると残る)
{
  const at=app.indexOf('setSlotSkill({slotIndex: animSlot');
  const to=app.indexOf('setSlotSkill(null)',at);
  const between=at<0||to<0?'':app.slice(at,to);
  check('技名は await battleWait をはさんでから消している(中断されると残る形)',
    between.includes('await battleWait('),
    at<0?'技名を出す場所が見つからない':'');
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
