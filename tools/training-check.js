// 修行デバッグ試作版が通常データから隔離され、タイル盤面・自動移動・全効果・道具を備えることを静的確認する。
const fs=require('fs');const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');const breeder=fs.readFileSync('monster-hero/data/breeder.js','utf8');let failed=false;const check=(n,v)=>{console.log(`${v?'OK':'NG'}: ${n}`);failed||=!v;};
check('HOMEは実装予定の紹介画面のみ',/修行（実装予定）/.test(source)&&/gameState==='TRAINING_INFO'/.test(source)&&/通常プレイから修行本編は開始できません/.test(source));
check('修行チケットの価格・絆XP効果を維持',/id:'training_ticket_l'[^\n]*cost:1000[^\n]*bondXp:100/.test(breeder));
check('デバッグ設定に修行テスト導線',/gameState==='DEBUG_SETTINGS'[\s\S]{0,1200}修行テスト/.test(source));
check('保存禁止バナーを常時表示',(source.match(/DEBUG・報酬や進行状況は保存されません/g)||[]).length>=4&&/DEBUG保存なし/.test(source));
check('24マスの分岐タイルマップ',/TRAINING_BEGINNER_NODES/.test(source)&&(source.match(/\['n\d+'/g)||[]).length>=24&&/mh-tile-board/.test(source)&&/mh-training-tile/.test(source));
check('出目ぶん自動移動し分岐時だけ方向選択',/advanceTraining/.test(source)&&/chooseTrainingBranch/.test(source)&&/branchOptions/.test(source)&&/出目ぶん自動で進みます/.test(source)&&!/chooseTrainingDestination/.test(source));
check('現在地追従と全体マップ切替',/scrollIntoView/.test(source)&&/全体マップ/.test(source)&&/trainingMapOverview/.test(source));
check('盤面上に選択マスモンのコマ',/mh-training-piece/.test(source)&&/trainingPieceRef/.test(source));
check('全13種の停止効果', ['xp30','xp60','gem50','gem100','item','tool','forward','back','turnPlus','turnMinus','boost','again','happening','goal'].every(k=>source.includes(`${k}:`)));
check('全7種の修行道具と上限処理', ['feather','gale','reroll','noReturn','sand','fixed','returnCharm'].every(k=>source.includes(`${k}:`))&&/所持上限（3個）/.test(source));
check('成功失敗計算は表示のみ',/settleTrainingRewards/.test(source)&&/所持データには反映されません/.test(source)&&!/storeSet\(TRAINING_SAVE_KEY/.test(source));
check('BGM2場面とSE9種',/trainingMenu:'original_home'/.test(source)&&/trainingBoard:'original_home'/.test(source)&&['trainingDice','trainingMove','trainingDecide','trainingReward','trainingGood','trainingBad','trainingTool','trainingGoal','trainingFail'].every(k=>source.includes(`${k}: async`)));
check('折りたたみDEBUG操作',/mh-training-debug/.test(source)&&/強制成功/.test(source)&&/強制失敗/.test(source)&&/seed:/.test(source));process.exit(failed?1:0);
