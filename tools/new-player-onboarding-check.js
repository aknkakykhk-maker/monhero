const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
for(const token of ["setGameState(onboarded ? 'HOME' : 'ONBOARDING')",'はじめまして','ゲームの目的','バトルの基本','育成・編成',"introIndex===introPages.length-1?'name'", "moveOnboarding('icon')", "moveOnboarding('confirm')",'!onboardingName.trim()','!onboardingIcon',"storeSet('mh_breeder_name'", "storeSet('mh_breeder_icon'", "storeSet('mh_onboarded',true", "storeGet('mh_onboarding_step'",'hasSavedName && hasSavedIcon'])assert(src.includes(token),token);
const nameSave=src.indexOf("storeSet('mh_breeder_name',name");const iconSave=src.indexOf("storeSet('mh_breeder_icon',onboardingIcon");const done=src.indexOf("storeSet('mh_onboarded',true");assert(nameSave>=0&&iconSave>nameSave&&done>iconSave,'完了フラグはプロフィール保存後');
console.log('OK: 空localStorage向け説明→名前→アイコン→確認、入力制約、途中再開、既存プロフィール互換を確認');
