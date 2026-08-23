#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../../monster-hero/src/game-system.jsx'),'utf8');
const fail=message=>{throw new Error(message);};
const between=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);if(start<0||end<0)fail(`${from} の範囲を取得できません`);return source.slice(start,end);};

const eco=between('// 省エネ設定はAUTO∞中だけ有効な一時状態','// 停止時は実行中のターンを完走させつつ');
for(const token of [
  "const ECO_MODES = ['off','lite','ultra']",
  "const [ecoMode, setEcoMode] = useState('off')",
  "const ecoModeRef = useRef('off')",
  'const setEcoModeSafe = (mode) =>',
  "autoRepeatRef.current===true&&ECO_MODES.includes(mode)?mode:'off'",
  'ecoModeRef.current=next',
  'setEcoMode(next)',
  'const cycleEcoMode = () =>',
  'ECO_MODES[(currentIndex+1)%ECO_MODES.length]',
])if(!eco.includes(token))fail(`省エネ内部状態に ${token} がありません`);

const modes=['off','lite','ultra'];
const safe=(mode,autoRepeat)=>autoRepeat===true&&modes.includes(mode)?mode:'off';
let current='off';
const cycle=autoRepeat=>current=safe(modes[(modes.indexOf(current)+1)%modes.length],autoRepeat);
if(safe('invalid',true)!=='off'||safe(null,true)!=='off')fail('未定義の省エネモードを拒否できません');
if(cycle(true)!=='lite'||cycle(true)!=='ultra'||cycle(true)!=='off')fail('省エネモードのcycle順が正しくありません');
if(safe('ultra',false)!=='off')fail('AUTO∞ OFF時に省エネがOFFになりません');

const stopAll=between('const stopAllAuto = () => {','const [monSelection');
if(!stopAll.includes("setEcoModeSafe('off')"))fail('stopAllAutoで省エネをOFFにしていません');
const repeatToggle=between('const setAutoRepeatEnabled = (enabled) => {','// 特殊ルール説明を閉じる正規経路');
if(!repeatToggle.includes("if(!next)setEcoModeSafe('off')"))fail('AUTO∞ OFF時に省エネをOFFにしていません');
if(/['"]mh_[^'"]*eco/i.test(source)||/localStorage[\s\S]{0,160}(?:ecoMode|eco_mode)/i.test(source))fail('省エネ状態を永続化しています');

const outsideEco=source.slice(0,source.indexOf('// 省エネ設定はAUTO∞中だけ有効な一時状態'))+source.slice(source.indexOf('// 停止時は実行中のターンを完走させつつ'));
if(/ecoMode|ECO_MODES|setEcoModeSafe|cycleEcoMode/.test(outsideEco.replace(/setEcoModeSafe\('off'\)/g,'')))fail('省エネ状態が表示・戦闘・AUTO処理へ接続されています');
for(const token of [
  'const runAutoTurnOnce = () => {',
  'return processTurn(entries)',
  'startRunFromRepeatTemplate(repeatRunTemplateRef.current)',
])if(!source.includes(token))fail(`既存の戦闘/AUTO∞本体 ${token} が維持されていません`);
console.log('eco mode internal check passed');
