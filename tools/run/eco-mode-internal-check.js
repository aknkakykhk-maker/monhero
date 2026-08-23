#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../../monster-hero/src/game-system.jsx'),'utf8');
const fail=message=>{throw new Error(message);};
const has=token=>source.includes(token);
const between=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);if(start<0||end<0)fail(`${from} の範囲を取得できません`);return source.slice(start,end);};

const eco=between('// 省エネ設定はAUTO∞中だけ有効な一時状態','// 停止時は実行中のターンを完走させつつ');
for(const token of [
  "const ECO_MODES = ['off','lite','ultra']",
  "const [ecoMode, setEcoMode] = useState('off')",
  "const ecoModeRef = useRef('off')",
  'const setEcoModeSafe = (mode) =>',
  "autoRepeatRef.current===true&&ECO_MODES.includes(mode)?mode:'off'",
  'const cycleEcoMode = () =>',
  "const liteBattleView = gameState==='BATTLE'&&ecoMode==='lite'",
])if(!eco.includes(token))fail(`省エネ状態に ${token} がありません`);
if(/ecoMode==='ultra'|ecoMode!=='off'/.test(source))fail('ultraが表示へ接続されています');
const stopAll=between('const stopAllAuto = () => {','const [monSelection');
if(!stopAll.includes("setEcoModeSafe('off')"))fail('stopAllAutoで省エネをOFFにしていません');

const battle=between("{gameState==='BATTLE'&&(",'{/* スキップ: 勇者モンと供モン3体を選ぶ */}');
for(const token of [
  "data-eco-view={liteBattleView?'lite':'off'}",
  'data-lite-eco-dimmer','pointer-events-none',
  'WAVE {wave}/10','{turnCount}/20','{enemy.name}',
  'enemy.hp','Ally Life','Ally Guts','slots.map((s,i)=>','Action Cards',
  '{slotSkill.name}','{enemySkillName.label}','data-lite-damage',
])if(!battle.includes(token))fail(`liteでも残す戦闘表示 ${token} がありません`);
for(const token of [
  '!liteBattleView&&guardFx','!liteBattleView&&teachingFx',
  "!liteBattleView&&enemyAttackFx?.kind==='move'",
  "!liteBattleView&&enemyAttackFx?.kind==='normal'",
  "!liteBattleView&&enemyAttackFx?.kind==='special'",
  'const isAnimating = !liteBattleView && attackAnim',
  'screenShake&&!liteBattleView',
])if(!has(token))fail(`liteの重い描画省略 ${token} がありません`);

// 省エネは描画分岐だけ。ターン処理・待機・速度・報酬へ判定を持ち込ませない。
const turn=between('const processTurn = async','// 今回はUIやeffectから呼ばず');
if(/liteBattleView|ecoMode|ecoModeRef/.test(turn))fail('戦闘計算へ省エネ判定が混入しています');
for(const token of ['return processTurn(entries)','const battleWait = useCallback((baseMs)','BATTLE_SPEEDS','cycleBattleSpeed'])if(!has(token))fail(`既存wait/速度処理 ${token} がありません`);
const championStart=source.indexOf("{gameState==='CHAMPION'");
if(championStart<0)fail('CHAMPION画面を取得できません');
const champion=source.slice(championStart,championStart+5000);
if(/liteBattleView|ecoMode|data-lite/.test(champion))fail('CHAMPION報酬演出へ省エネが接続されています');

const repeatToggle=between('const setAutoRepeatEnabled = (enabled) => {','// 特殊ルール説明を閉じる正規経路');
if(!repeatToggle.includes('const next=!!enabled&&isQuickMode(runMode)'))fail('∞周回のクイック限定が維持されていません');
if(!repeatToggle.includes("if(!next)setEcoModeSafe('off')"))fail('AUTO∞ OFF時に省エネをOFFにしていません');
for(const token of ['flex-1 min-w-0 flex flex-wrap','min-w-[52px] shrink-0'])if(!battle.includes(token))fail('ACTION見切れ防止レイアウトが維持されていません');
if(/['"]mh_[^'"]*eco/i.test(source)||/localStorage[\s\S]{0,160}(?:ecoMode|eco_mode)/i.test(source))fail('省エネ状態を永続化しています');
console.log('eco mode battle render check passed');
