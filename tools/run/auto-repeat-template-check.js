#!/usr/bin/env node
// AUTO∞の一時テンプレートと、開始条件の保持。
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'monster-hero/src/game-system.jsx'),'utf8');
const fail=message=>{throw new Error(message);};
const body=(name,next)=>{const start=source.indexOf(`const ${name} =`),end=source.indexOf(`const ${next} =`,start+1);if(start<0||end<0)fail(`${name} の範囲を取得できません`);return source.slice(start,end);};
const create=body('createRepeatRunTemplate','resolveRepeatRunTemplate');
const resolve=body('resolveRepeatRunTemplate','startRunFromRepeatTemplate');
const start=body('startRunFromRepeatTemplate','updateNoticeVisible');
if(!/const repeatRunTemplateRef = useRef\(null\)/.test(source))fail('一時テンプレートrefがありません');
for(const field of ['runMode','difficulty','heroRosterEntry','initialDistance','quickRewardPolicy','proAllyRosterEntries'])if(!create.includes(field))fail(`開始条件 ${field} を保持していません`);
if(!/const joinRosterEntry = \(mon\) => mon\?\.masuId != null \? `masu:\$\{mon\.masuId\}` : mon\?\.id \|\| null/.test(source))fail('ベースIDとmasu個体IDの正規形式がありません');
if(/\b(mainHero|slots|proAllyPool)\s*[,}]/.test(create))fail('テンプレートへmonster object/stateを保存しています');
for(const forbidden of ['hp:','score:','wave:','guts:','upgradePoints:','hand:','deck:','graveyard:'])if(create.includes(forbidden))fail(`途中成長値 ${forbidden} を保存しています`);
if(!/repeatRunTemplateRef\.current=createRepeatRunTemplate\(\{ hero:m, allies:\[\] \}\)/.test(source))fail('通常ラン確定時に作成していません');
if(!/repeatRunTemplateRef\.current=createRepeatRunTemplate\(\{ hero:mainHero, allies:proAllyPool \}\)/.test(source))fail('Proラン確定時に作成していません');
for(const token of ['resolveRosterEntryToMon','allowedEntries.has',"reason:'hero-unavailable'","reason:'pro-ally-unavailable'",'PRO_ALLY_POOL_SIZE','mon.masuId != null'])if(!resolve.includes(token))fail(`再resolve条件 ${token} がありません`);
const reset=body('applyResetAllState','createRepeatRunTemplate');
for(const token of ['resolveRepeatRunTemplate(template)','beginNewRankingRun({','applyResetAllState()',"advanceRunStage('PICK_TEACHING')",'runId:runIdRef.current','resetAllState()'])if(!(start+reset).includes(token))fail(`新規ラン初期化 ${token} がありません`);
if(/['"]mh_[^'"]*(?:repeat|infinity)/.test(source))fail('再周回用保存キーが追加されています');
// ★∞周回はクイック専用。テンプレートは勇者モンを決めた時点でモードを問わず作られるので、
//   読むときにクイックだけへ絞れていないと、直前に遊んだチャレンジ・プロ・極限の編成で
//   モンビーの裏周回が立ち上がる(∞はクイック限定の判定ですぐ外れ、帯は出るのに進まない)
//   (2026-09-19・ユーザー報告「事前にチャレンジノーマルをやったからなのか、それを
//    引き継いでるみたいで進まないし止まったらうごかなくなるし
//    設定してるモンスターでも出発してない」)。
//   文字列の一致ではなく、実際に切り出して動かして確かめる
const pickLines=source.match(/ {2}const isQuickRepeatTemplate = [^\n]+\n {2}const repeatTemplateForNewRun = [^\n]+\n/);
if(!pickLines)fail('周回テンプレートの選び方を切り出せません');
const core=fs.readFileSync(path.join(root,'monster-hero/src/parts/10-core.jsx'),'utf8');
const lineOf=(name)=>{const m=core.match(new RegExp(`^const ${name} = .+$`,'m'));if(!m)fail(`${name} を切り出せません`);return m[0];};
const fromSettings=Object.freeze({runMode:'quick',difficulty:'Beginner',heroRosterEntry:'Suezo',extremeRun:false});
const pickWith=(current)=>new Function('repeatRunTemplateRef','repeatTemplateFromAutoSettings',[
  "const BATTLE_MODE_CHALLENGE='challenge';const BATTLE_MODE_QUICK='quick';const BATTLE_MODE_PRO='pro';",
  lineOf('normalizeBattleMode'),lineOf('isQuickMode'),pickLines[0],'return repeatTemplateForNewRun();',
].join('\n'))({current},()=>fromSettings);
const quickTemplate=Object.freeze({runMode:'quick',difficulty:'Expert',heroRosterEntry:'Golem',extremeRun:false});
if(pickWith(quickTemplate)!==quickTemplate)fail('クイックの編成を持ち越していません');
if(pickWith(null)!==fromSettings)fail('編成が無いときにAUTO設定の事前設定を使っていません');
for(const [label,template] of [
  ['チャレンジ',{runMode:'challenge',difficulty:'Normal',heroRosterEntry:'Tiger',extremeRun:false}],
  ['プロ',{runMode:'pro',difficulty:'Normal',heroRosterEntry:'Tiger',extremeRun:false}],
  ['極限',{runMode:'extreme',difficulty:'EXTREME',heroRosterEntry:'Tiger',extremeRun:true}],
  ['種族チャレンジ',{runMode:'speciesChallenge',difficulty:'Normal',heroRosterEntry:'Tiger',extremeRun:false}],
])if(pickWith(template)!==fromSettings)fail(`${label}の編成を周回へ持ち越しています`);
console.log('auto repeat template check passed');
