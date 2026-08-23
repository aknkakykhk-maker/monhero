#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../../monster-hero/src/game-system.jsx'),'utf8');
const fail=message=>{throw new Error(message);};
const between=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);if(start<0||end<0)fail(`${from} の範囲を取得できません`);return source.slice(start,end);};
const repeatToggle=between('const setAutoRepeatEnabled = (enabled) => {','// ランの終了表示');
for(const token of ['const next=!!enabled&&isQuickMode(runMode)','autoRepeatRef.current=next','setAutoRepeat(next)','if(next)setAutoBattleEnabled(true)','else autoRepeatStartingRef.current=false',"if(!next)setEcoModeSafe('off')"])if(!repeatToggle.includes(token))fail(`∞周回切替に ${token} がありません`);
if(repeatToggle.includes('stopAutoBattle')||repeatToggle.includes('stopAllAuto'))fail('∞周回単独OFFが通常AUTOを停止します');
const battleToggle=between('const setAutoBattleEnabled = (enabled) => {','// ∞周回は');
if(!battleToggle.includes('if(!next){stopAllAuto();return;}'))fail('通常AUTO OFFがstopAllAutoを使っていません');
for(const token of ['{isQuickMode(runMode)&&<button type="button"','onClick={()=>setAutoRepeatEnabled(!autoRepeatRef.current)}','aria-pressed={autoRepeat}','∞周回'])if(!source.includes(token))fail(`クイック限定の∞周回UIに ${token} がありません`);
if(/['"]mh_[^'"]*(?:repeat|infinity)/.test(source))fail('AUTO∞を永続化する保存キーがあります');
console.log('auto repeat UI check passed');
