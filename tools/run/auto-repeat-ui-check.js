#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../../monster-hero/src/game-system.jsx'),'utf8');
const fail=message=>{throw new Error(message);};
const between=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);if(start<0||end<0)fail(`${from} の範囲を取得できません`);return source.slice(start,end);};
// 見たいのは setAutoRepeatEnabled の中身だけ。
// 以前は「次の大きなコメント(// ランの終了表示)まで」を範囲にしていたが、
// あいだに別の関数が入ると、その中の stopAllAuto を拾って落ちてしまう
// (2026-09-06・モンビーから周回を始める startQuickRunFromRhythm を足したときに実際に起きた)。
// 関数の終わり(行頭2字下げの `};`)までで区切る
const repeatToggle=between('const setAutoRepeatEnabled = (enabled) => {','\n  };');
// 2026-09-07。「次周を始めている最中」の印は、入れるときも切るときも必ず戻す。
// ONのときに戻していなかったため、印が残ると∞を入れ直しても次の周へ入れなかった
// (ユーザー報告「バトルへ戻ってもう一度無限周回にしても裏周回が機能しない」)。
// else でだけ戻す書き方から、無条件で戻す書き方へ変えた。
for(const token of ['const next=!!enabled&&isQuickMode(runMode)','autoRepeatRef.current=next','setAutoRepeat(next)','setAutoRepeatBattleSpeed(next)','if(next)setAutoBattleEnabled(true)','autoRepeatStartingRef.current=false',"if(!next)setEcoModeSafe('off')"])if(!repeatToggle.includes(token))fail(`∞周回切替に ${token} がありません`);
// ★ON/OFFのどちらでも戻ることを、条件つきでないことで確かめる
if(/else\s+autoRepeatStartingRef\.current=false/.test(repeatToggle))fail('∞周回切替: 印を戻すのが else の中だけになっています(ONのときも戻すこと)');
// コメントに関数名が出ていても落ちないよう、行コメントを外してから見る
const repeatToggleCode=repeatToggle.replace(/\/\/[^\n]*/g,'');
if(repeatToggleCode.includes('stopAutoBattle')||repeatToggleCode.includes('stopAllAuto'))fail('∞周回単独OFFが通常AUTOを停止します');
const battleToggle=between('const setAutoBattleEnabled = (enabled) => {','// ∞周回は');
// 2026-09-07。止まった理由を帯へ出すため、引数で理由を渡すようになった
if(!battleToggle.includes("if(!next){stopAllAuto('manual');return;}"))fail('通常AUTO OFFがstopAllAutoを使っていません');
const cycle=between('const cycleBattleAuto = () => {','// 特殊ルール説明を閉じる正規経路');
for(const token of ['if(autoRepeatRef.current){setAutoBattleEnabled(false);return;}','if(autoBattleRef.current){','if(isQuickMode(runMode))setAutoRepeatEnabled(true);','else setAutoBattleEnabled(false);','setAutoBattleEnabled(true);'])if(!cycle.includes(token))fail(`統合AUTOの循環処理に ${token} がありません`);
const battleControls=between('<span className={`flex-1 min-w-0 flex flex-wrap','{/* 使うカードが決まっている番は');
for(const token of ['onClick={cycleBattleAuto}','aria-pressed={autoBattle}',"autoRepeat?'∞':autoBattle?'ON':'OFF'",'min-h-[44px] min-w-[84px] shrink-0'])if(!battleControls.includes(token))fail(`統合AUTO/ACTION UIに ${token} がありません`);
if(battleControls.includes('setAutoRepeatEnabled(!autoRepeatRef.current)')||battleControls.includes('∞周回</button>'))fail('バトル内に独立した∞周回ボタンが残っています');
if(/const \[[^\]]*(?:autoMode|autoStatus|battleAuto)[^\]]*\] = useState/i.test(source))fail('統合AUTO表示用のstateを追加しています');
for(const width of [320,390,430])if(width-16-(40+44+84+4)<100)fail(`${width}pxでACTIONを維持した操作列が収まりません`);
if(/['"]mh_[^'"]*(?:repeat|infinity)/.test(source))fail('AUTO∞を永続化する保存キーがあります');
const speedControl=between('const [battleSpeed, setBattleSpeed] = useState(1);','const [focusedCard, setFocusedCard]');
for(const token of ['const autoRepeatBattleSpeedRef = useRef(null)','if(autoRepeatBattleSpeedRef.current==null)autoRepeatBattleSpeedRef.current=normalizeBattleSpeed(battleSpeedRef.current)','battleSpeedRef.current=4','setBattleSpeed(4)','const restored=normalizeBattleSpeed(autoRepeatBattleSpeedRef.current)','battleSpeedRef.current=restored','setBattleSpeed(restored)','if (battleScenarioRef.current||autoRepeatRef.current) return;'])if(!speedControl.includes(token))fail(`AUTO∞の速度固定・復元に ${token} がありません`);
const repeatSpeed=between('const setAutoRepeatBattleSpeed = (enabled) => {','const cycleBattleSpeed = () => {');
if(repeatSpeed.includes('storeSet'))fail('AUTO∞の速度固定が通常の速度設定を保存しています');
const headerControls=between('<div data-battle-controls','</header>');
for(const token of ['disabled={!!battleTutorial||autoRepeat}',"autoRepeat?'∞周回中は4倍固定'","autoRepeat?'∞周回中は×4固定':undefined",'{autoRepeat&&<span'])if(!headerControls.includes(token))fail(`AUTO∞速度固定UIに ${token} がありません`);
console.log('auto repeat UI check passed');
