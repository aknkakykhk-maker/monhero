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

// ★止まった理由を帯へ出すため、引数つき(reason)になった(2026-09-07)
const stopAll=between("const stopAllAuto = (reason = '') => {",'const [monSelection');
for(const token of ['stopAutoBattle()','finishQuickRunProgress(reason)','autoRepeatRef.current = false','autoRepeatStartingRef.current = false','autoRepeatBondAwardMasuIdsRef.current = []','setAutoRepeat(false)'])if(!stopAll.includes(token))fail(`stopAllAutoに ${token} がありません`);
const victory=between('const handleNextWave = async () => {','// ===== クイックモード');
const finalizeOrder=['await awardRunRewards(10)','await recordClearOnce()',"advanceRunStage('CHAMPION')",'await submitRunScoreOnce()','setResultProcessing(false)'];
let cursor=-1;
for(const token of finalizeOrder){const next=victory.indexOf(token,cursor+1);if(next<0)fail(`勝利finalization順序の ${token} がありません`);cursor=next;}
if(victory.includes('startRunFromRepeatTemplate('))fail('結果表示前の勝利処理から次周を開始しています');
const rewards=between('const awardRunRewards = async (wavesCleared) => {','// スキップ:');
for(const token of ['const bondAwards = buildRunBondAwards({','autoRepeatBondAwardMasuIdsRef.current = autoRepeatRef.current','bondAwards.map(award => award.masuId)'])if(!rewards.includes(token))fail(`絆報酬対象IDの引き継ぎ ${token} がありません`);
if(!source.includes('const getMasuMon = (masuId) => masuMonsRef.current.find'))fail('次周の個体解決が最新masuMonsRefを使っていません');
const breakthroughExec=between('const executeAutoRepeatBreakthroughs = async (masuIds) => {','// 限界突破: レベルはそのままで上限だけ上げる');
for(const token of [
  'reserveGold:autoSettings?.breakthroughReserve?.gold || 0',
  'reservePsyche:autoSettings?.breakthroughReserve?.psyche || 0',
])if(!breakthroughExec.includes(token))fail(`自動限凸の資源保護接続 ${token} がありません`);
const reset=between('const applyResetAllState = () => {','const createRepeatRunTemplate');
if(!reset.includes('autoRepeatBondAwardMasuIdsRef.current = []'))fail('新しいrun開始時に前周の絆報酬対象を消していません');
const presentation=between('// 正規リザルトの全報酬演出が完了した場合だけ','// 操作可能なBATTLEへ');
for(const token of ["runStage!=='CHAMPION'",'!championPresentationComplete','!autoRepeatRef.current','autoRepeatStartingRef.current',"if(!isQuickMode(runMode)){setAutoRepeatEnabled(false);return;}",'document.visibilityState===\'hidden\'','await executeAutoRepeatBreakthroughs(autoRepeatBondAwardMasuIdsRef.current)','startRunFromRepeatTemplate(repeatTemplateForNewRun())','if(repeatResult.ok)','autoBattleRef.current=true','setAutoBattle(true)',"stopAllAuto('error')"])if(!presentation.includes(token))fail(`結果表示後の再周回処理 ${token} がありません`);
if(presentation.indexOf('await executeAutoRepeatBreakthroughs')>presentation.indexOf('startRunFromRepeatTemplate'))fail('限界突破の保存完了前に次周を開始しています');
if((presentation.match(/startRunFromRepeatTemplate\(/g)||[]).length!==1)fail('結果表示後のテンプレート開始呼び出しが1箇所ではありません');
// 次周に使うテンプレートは「1周目に自分で組んだ編成」が最優先。
// AUTO設定の事前設定(PR5)はそれが無いときだけ使う
if(!source.includes('const repeatTemplateForNewRun = () => repeatRunTemplateRef.current || repeatTemplateFromAutoSettings();'))fail('次周のテンプレートが周回テンプレートを優先していません');
for(const token of ['onPresentationComplete?.()',"key={resultProcessing?'locked':'ready'}",'onPresentationComplete={resultProcessing?undefined:()=>setChampionPresentationComplete(true)}','setChampionPresentationComplete(false)'])if(!source.includes(token))fail(`報酬演出完了の接続 ${token} がありません`);
if(!source.includes('onClick={()=>setAutoRepeatEnabled(false)}')||!source.includes('onClick={()=>setAutoBattleEnabled(false)}'))fail('結果表示中にAUTO∞/AUTOを停止できません');
if(!source.includes('if(autoRepeatRef.current&&!isQuickMode(runMode))setAutoRepeatEnabled(false)'))fail('クイック以外の不正な∞状態を単独解除していません');

const extremeAuto=between('// 特殊ルール説明を閉じる正規経路','// ランの終了表示');
for(const token of ['const closeExtremeRule = () =>','requestAnimationFrame','autoBattleRef.current','autoRepeatRef.current',"document.visibilityState==='hidden'",'closeExtremeRule()'])if(!extremeAuto.includes(token))fail(`極限ルールのAUTO通過処理 ${token} がありません`);
if(!source.includes('onClick={closeExtremeRule}'))fail('極限ルールの手動操作が共通handlerを使っていません');

// ★止め方は同じで、渡す理由だけが分かれた(2026-09-07・帯へ「なぜ止まったか」を出すため)
for(const token of [
  "if(hp<=0)stopAllAuto('defeat');",
  "else if(gaveUp)stopAllAuto('retire');",
  "else if(gameState==='PICK_HERO')stopAllAuto('manual');",
  'const returnToHome = () => {\n    stopAllAuto()',
  // あきらめるは理由つき(帯に「途中でやめた」と出す)
  'const handleGiveUp = useCallback(async () => {',
  "    stopAllAuto('retire');",
  'const handleRetry = () => {\n    stopAllAuto()',
  "const onHidden = () => { Audio_.setPageHidden(true); stopAllAuto('hidden'); }",
  'const startBattleTutorial =', 'const startDebugBattle =',
])if(!source.includes(token))fail(`停止経路 ${token} がありません`);
// ★blur/pagehide は「他のアプリへ行った」以外でも飛ぶので、visibilityState で裏を取ってから止める
//   (2026-09-07・ユーザー報告「クイック中に1曲やったら周回が止まってた」)
if(!source.includes("window.addEventListener('pagehide', onMaybeHidden)"))fail('pagehide停止がありません');
if(!source.includes("if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return;"))fail('blur/pagehideの裏取りがありません');
if(/autoRepeat[\s\S]{0,300}(?:handleRetry|masuRegister|registerMasu)/i.test(victory))fail('自動Retryまたはマスモン自動登録の疑いがあります');
if(/setInterval[\s\S]{0,200}autoRepeat|(?:elapsed|offline)[\s\S]{0,200}autoRepeat/i.test(source))fail('オフライン/経過時間による再周回の疑いがあります');
console.log('auto repeat internal check passed');
