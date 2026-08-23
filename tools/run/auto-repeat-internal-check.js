#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../../monster-hero/src/game-system.jsx'),'utf8');
const fail=message=>{throw new Error(message);};
const between=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);if(start<0||end<0)fail(`${from} の範囲を取得できません`);return source.slice(start,end);};

for(const pattern of [
  /const \[autoRepeat, setAutoRepeat\] = useState\(false\)/,
  /const autoRepeatRef = useRef\(false\)/,
  /const autoRepeatStartingRef = useRef\(false\)/,
]) if(!pattern.test(source)) fail('AUTO∞が初期OFFのstate/ref構成ではありません');
if(/['"]mh_[^'"]*(?:repeat|infinity)/.test(source)) fail('AUTO∞を永続化する保存キーがあります');

const stopAll=between('const stopAllAuto = () => {','const [monSelection');
for(const token of ['stopAutoBattle()','autoRepeatRef.current = false','autoRepeatStartingRef.current = false','setAutoRepeat(false)'])if(!stopAll.includes(token))fail(`stopAllAutoに ${token} がありません`);
const victory=between('const handleNextWave = async () => {','// ===== クイックモード');
const finalizeOrder=['await awardRunRewards(10)','await recordClearOnce()',"setGameState('CHAMPION')",'await submitRunScoreOnce()','setResultProcessing(false)','startRunFromRepeatTemplate(repeatRunTemplateRef.current)'];
let cursor=-1;
for(const token of finalizeOrder){const next=victory.indexOf(token,cursor+1);if(next<0)fail(`勝利finalization順序の ${token} がありません`);cursor=next;}
if(!/if \(wave === 10\)[\s\S]*autoRepeatRef\.current && !autoRepeatStartingRef\.current/.test(victory))fail('WAVE10正常勝利だけの再周回条件または二重開始ロックがありません');
if((victory.match(/startRunFromRepeatTemplate\(repeatRunTemplateRef\.current\)/g)||[]).length!==1)fail('勝利ごとのテンプレート開始呼び出しが1箇所ではありません');
for(const token of ['if (repeatResult.ok)','autoBattleRef.current = true','setAutoBattle(true)','stopAllAuto()'])if(!victory.includes(token))fail(`再周回の成功/失敗処理 ${token} がありません`);

for(const token of [
  "if(hp<=0||gaveUp||gameState==='PICK_HERO')stopAllAuto()",
  'const returnToHome = () => {\n    stopAllAuto()',
  'const handleGiveUp = useCallback(async () => {\n    stopAllAuto()',
  'const handleRetry = () => {\n    stopAllAuto()',
  "const onHidden = () => { Audio_.setPageHidden(true); stopAllAuto(); }",
  'const startBattleTutorial =', 'const startDebugBattle =',
])if(!source.includes(token))fail(`停止経路 ${token} がありません`);
if(!source.includes("window.addEventListener('pagehide', onHidden)"))fail('pagehide停止がありません');
if(/autoRepeat[\s\S]{0,300}(?:handleRetry|masuRegister|registerMasu)/i.test(victory))fail('自動Retryまたはマスモン自動登録の疑いがあります');
if(/setInterval[\s\S]{0,200}autoRepeat|(?:elapsed|offline)[\s\S]{0,200}autoRepeat/i.test(source))fail('オフライン/経過時間による再周回の疑いがあります');
console.log('auto repeat internal check passed');
