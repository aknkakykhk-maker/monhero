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
  "const ultraBattleView = gameState==='BATTLE'&&ecoMode==='ultra'",
  'const ecoBattleView = liteBattleView||ultraBattleView',
])if(!eco.includes(token))fail(`省エネ状態に ${token} がありません`);
const stopAll=between('const stopAllAuto = () => {','const [monSelection');
if(!stopAll.includes("setEcoModeSafe('off')"))fail('stopAllAutoで省エネをOFFにしていません');

const battle=between("{gameState==='BATTLE'&&(",' {/* スキップ: 勇者モンと供モン3体を選ぶ */}'.trimStart());
for(const token of [
  "data-eco-view={ultraBattleView?'ultra':liteBattleView?'lite':'off'}",
  'data-lite-eco-dimmer','bg-black/20','data-ultra-battle-view',
  'ultraBattleView?(','WAVE {wave}/10','{turnCount}/20','{enemy.name}','enemy.hp',
  '現在距離','味方HP','ガッツ','slots.map((s,i)=>','Action Cards','AUTO∞で進行中',
  '{slotSkill.name}','{enemySkillName.label}','popups.filter',
])if(!battle.includes(token))fail(`省エネでも残す戦闘表示 ${token} がありません`);
const ultra=between('data-ultra-battle-view','):(<>');
for(const token of ['hand.map((c,i)=>','enemyAttackFx?.kind','attackAnim &&','animate-pulse','transition-all','drop-shadow'])if(ultra.includes(token))fail(`ultra軽量表示へ通常の重い描画 ${token} が混入しています`);
if(!battle.includes('):(<>' ))fail('ultraと通常/liteのBATTLE描画ツリーが分離されていません');
for(const token of [
  '!ecoBattleView&&guardFx','!ecoBattleView&&teachingFx',
  "!ecoBattleView&&enemyAttackFx?.kind==='move'",
  "!ecoBattleView&&enemyAttackFx?.kind==='normal'",
  "!ecoBattleView&&enemyAttackFx?.kind==='special'",
  'const isAnimating = !ecoBattleView && attackAnim',
  'screenShake&&!ecoBattleView','enemyAttackAnim&&!ecoBattleView',
])if(!has(token))fail(`ultraのアクション描画省略 ${token} がありません`);
// liteは従来の個別分岐と20%遮光を保ち、ultra専用の全アニメ停止を混ぜない。
if(!battle.includes("animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'"))fail('liteの静的な技名表示が維持されていません');

// 省エネは描画分岐だけ。ターン処理・待機・速度・報酬へ判定を持ち込ませない。
const turn=between('const processTurn = async','// 今回はUIやeffectから呼ばず');
if(/(?:lite|ultra|eco)BattleView|ecoMode|ecoModeRef/.test(turn))fail('戦闘計算へ省エネ判定が混入しています');
for(const token of ['return processTurn(entries)','const battleWait = useCallback((baseMs)','BATTLE_SPEEDS','cycleBattleSpeed'])if(!has(token))fail(`既存wait/速度処理 ${token} がありません`);
const championStart=source.indexOf("{gameState==='CHAMPION'");
if(championStart<0)fail('CHAMPION画面を取得できません');
const champion=source.slice(championStart,championStart+5000);
if(/(?:lite|ultra|eco)BattleView|ecoMode|data-(?:lite|ultra)/.test(champion))fail('CHAMPION報酬演出へ省エネが接続されています');

const repeatToggle=between('const setAutoRepeatEnabled = (enabled) => {','// 特殊ルール説明を閉じる正規経路');
if(!repeatToggle.includes('const next=!!enabled&&isQuickMode(runMode)'))fail('∞周回のクイック限定が維持されていません');
if(!repeatToggle.includes("if(!next)setEcoModeSafe('off')"))fail('AUTO∞ OFF時に省エネをOFFにしていません');
for(const token of ['flex-1 min-w-0 flex flex-wrap','min-h-[44px] min-w-[84px] shrink-0'])if(!battle.includes(token))fail('ACTION見切れ防止レイアウトが維持されていません');
if(/['"]mh_[^'"]*eco/i.test(source)||/localStorage[\s\S]{0,160}(?:ecoMode|eco_mode)/i.test(source))fail('省エネ状態を永続化しています');
const controls=between('<span className={`flex-1 min-w-0 flex flex-wrap','{/* 使うカードが決まっている番は');
for(const token of [
  "gameState==='BATTLE'&&isQuickMode(runMode)&&autoRepeat===true",
  'onClick={cycleEcoMode}',
  "ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'",
  'w-[44px] shrink-0 flex flex-col',
  '省エネ',
])if(!controls.includes(token))fail(`省エネ切替UIに ${token} がありません`);
if(/onClick=\{\(\)=>setEcoMode|const \[[^\]]*(?:ecoUi|ecoButton|energySaving)[^\]]*\] = useState/i.test(controls))fail('省エネ切替UIが既存cycle/stateを再利用していません');
for(const width of [320,390,430])if(width-16-(40+44+84+4)<100)fail(`${width}pxで省エネをAUTO下に置いた操作列が収まりません`);
console.log('eco mode ultra battle render check passed');
