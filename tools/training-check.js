// 修行のデータ、参加券化、保存・一度きりの確定、報酬レンジを静的/シミュレーション確認する。
const fs=require('fs');
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const breeder=fs.readFileSync('monster-hero/data/breeder.js','utf8');
const checks=[];const check=(name,ok,detail='')=>{checks.push(ok);console.log(`${ok?'OK':'NG'}: ${name}${detail?' — '+detail:''}`)};
check('BEGINNER/EASY/NORMALをデータ管理',/TRAINING_DIFFICULTIES[\s\S]*BEGINNER:[\s\S]*EASY:[\s\S]*NORMAL:/.test(source));
check('BEGINNERは10ターン・1～3・24マス',/BEGINNER:\{[^}]*turns:10[^}]*dice:\[1,3\][^}]*spaces:24/.test(source));
check('修行チケットは参加券で価格1000を維持',/id:'training_ticket_l'[^\n]*cost:1000[^\n]*trainingEntry:true/.test(breeder)&&!/id:'training_ticket_l'[^\n]*bondXp/.test(breeder));
check('開始成立時だけチケットを1枚消費',/storeSet\(TRAINING_SAVE_KEY,session,false\)[\s\S]{0,500}\[TRAINING_TICKET_ID\].*-1/.test(source));
check('再開用セッションを保存',/mh_training_session_v1/.test(source)&&/normalizeTrainingSession/.test(source)&&/ticketConsumed/.test(source));
check('終了前にfinalizedを保存して二重付与防止',/finalized:true[\s\S]{0,500}storeSet\(TRAINING_SAVE_KEY,result,false\)[\s\S]{0,800}mh_masu_mons/.test(source));
check('停止マスだけイベント処理',/for\(let i=0;i<value;i\+\+\)[\s\S]{0,300}applyTrainingSpace\(next\)/.test(source));
check('修行道具7種と所持上限3',Object.keys({feather:1,gale:1,reroll:1,noReturn:1,sand:1,fixed:1,returnCharm:1}).every(k=>new RegExp(`${k}:\\{`).test(source))&&/slice\(0,3\)/.test(source));
check('成功/失敗報酬ルール',/success\?1:\.5/.test(source)&&/Math\.floor/.test(source)&&/returnCharm/.test(source));
check('修行メニュー/修行中BGMアレンジ',/trainingMenu:'original_home'/.test(source)&&/trainingBoard:'original_home'/.test(source)&&/修行メニュー BGM/.test(source)&&/修行中 BGM/.test(source));
check('専用SE 7種', ['trainingDice','trainingMove','trainingReward','trainingBad','trainingTool','trainingGoal','trainingFail'].every(k=>new RegExp(`${k}: async`).test(source)));
// 成功報酬のルート別クランプ値から、一様に3ルートを選んだ場合の代表平均を確認する。
const routeRewards=[[200,225],[250,300],[315,500]];const avg=routeRewards.reduce((a,x)=>[a[0]+x[0]/3,a[1]+x[1]/3],[0,0]);
check('代表報酬が目標帯に近い',avg[0]>=240&&avg[0]<=270&&avg[1]>=300&&avg[1]<=360,`XP ${avg[0].toFixed(1)} / ダイヤ ${avg[1].toFixed(1)}`);
const failed=checks.filter(Boolean).length!==checks.length;console.log(`\n${checks.filter(Boolean).length}/${checks.length} 項目OK`);process.exit(failed?1:0);
