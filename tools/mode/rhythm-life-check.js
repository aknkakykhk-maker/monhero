// 音ゲーのライフ0以降の不可逆DOWNとスコア固定を、実装中の純粋関数で確認する。
//   node tools/mode/rhythm-life-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const docs=read('docs/spec/RHYTHM_MODE.md');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const dataBlock=data.match(/const RHYTHM_JUDGMENTS = [\s\S]*?const rhythmLifeRatio = [^\n]*;/)?.[0];
const scoreBlock=game.match(/const rhythmCalculateScore = \([\s\S]*?\n};/)?.[0];
check('ライフ・スコア・ランクの実装を抽出できる',!!dataBlock&&!!scoreBlock);
if(!dataBlock||!scoreBlock)process.exit(1);
const context={};vm.createContext(context);
vm.runInContext(`${dataBlock}\nconst RHYTHM_JUDGMENT_IDS=RHYTHM_JUDGMENTS.map(item=>item.id);\n${scoreBlock}\nthis.out={RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS,RHYTHM_RANKS,rhythmRankForScore,RHYTHM_LIFE_MAX,RHYTHM_LIFE_DELTA,rhythmLifeAfter,rhythmLifeRatio,rhythmCalculateScore};`,context);
const {RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS,RHYTHM_RANKS,rhythmRankForScore,RHYTHM_LIFE_MAX,RHYTHM_LIFE_DELTA,rhythmLifeAfter,rhythmLifeRatio,rhythmCalculateScore}=context.out;
check('最大ライフと判定増減値は不変',RHYTHM_LIFE_MAX===1000&&JSON.stringify(RHYTHM_LIFE_DELTA)===JSON.stringify({MARVELOUS:2,EXCELLENT:2,GREAT:1,GOOD:0,BAD:-20,MISS:-50}));
check('判定窓と通常スコア式は不変',JSON.stringify(RHYTHM_JUDGMENTS.map(x=>[x.id,x.windowMs,x.scoreRate]))===JSON.stringify([['MARVELOUS',25,1],['EXCELLENT',50,.98],['GREAT',100,.9],['GOOD',150,.7],['BAD',200,.3],['MISS',null,0]])&&RHYTHM_SCORE_WEIGHTS.judgment===.9&&RHYTHM_SCORE_WEIGHTS.combo===.1);
check('ライフ1以上では回復できる',rhythmLifeAfter(1,'MARVELOUS')===3&&rhythmLifeAfter(999,'GREAT')===1000);
check('ライフ0以降はMARVELOUSでも0固定',rhythmLifeAfter(0,'MARVELOUS')===0&&rhythmLifeAfter(0,'EXCELLENT')===0&&rhythmLifeAfter(0,'GREAT')===0);
check('減少と表示クランプは従来どおり',rhythmLifeAfter(500,'MISS')===450&&rhythmLifeAfter(500,'BAD')===480&&rhythmLifeRatio(-1)===0&&rhythmLifeRatio(2000)===1);

const ids=RHYTHM_JUDGMENTS.map(x=>x.id),empty=()=>Object.fromEntries(ids.map(id=>[id,0]));
const run={life:51,lifeDepleted:false,score:0,lockedScore:0,combo:0,maxCombo:0,counts:empty()};
const apply=judgment=>{run.combo=['MARVELOUS','EXCELLENT','GREAT','GOOD'].includes(judgment)?run.combo+1:0;run.maxCombo=Math.max(run.maxCombo,run.combo);run.counts[judgment]++;run.life=rhythmLifeAfter(run.life,judgment);const calculatedScore=rhythmCalculateScore({judgments:run.counts,maxCombo:run.maxCombo,totalNotes:5,maxScore:1000000});if(!run.lifeDepleted)run.score=calculatedScore;if(!run.lifeDepleted&&run.life===0){run.lifeDepleted=true;run.lockedScore=run.score;}return run.lifeDepleted?run.lockedScore:run.score;};
const beforeDown=apply('MARVELOUS');apply('MISS'); // 53 -> 3
check('DOWN前の成功判定は通常どおりスコア加算',beforeDown>0&&run.score>=beforeDown);
const atDown=apply('MISS'); // 3 -> 0。このMISSまでを含むスコアを固定
const countsAtDown={...run.counts},comboAtDown=run.combo;
const afterDown=apply('MARVELOUS');
check('0到達判定の終了時点でスコアを固定',run.lifeDepleted&&run.lockedScore===atDown);
check('DOWN後のMARVELOUSでライフ・スコアが増えない',run.life===0&&afterDown===atDown&&run.score===atDown);
check('DOWN後も判定数・コンボ処理は継続',run.counts.MARVELOUS===countsAtDown.MARVELOUS+1&&run.combo===comboAtDown+1);
const resultScore=run.lifeDepleted?run.lockedScore:run.score;
check('リザルトは再計算せず固定スコアを使う',resultScore===atDown&&game.includes('const score=run.lifeDepleted?run.lockedScore:run.score;'));
check('スコアランクは固定スコア基準',rhythmRankForScore(resultScore)===rhythmRankForScore(atDown)&&game.includes('rank=rhythmRankForScore(view.score)'));
const previousBest=atDown+1,isNewRecord=resultScore>previousBest;
check('DOWN後の判定ではBESTを更新できない',!isNewRecord&&game.includes('const isNewRecord=score>run.startBestScore;'));
check('ライフ0でもfinishせず曲・判定処理を継続',!game.includes('if(run.life===0)finish')&&!game.includes('if(run.life<=0)finish')&&game.includes('run.lifeDepleted=true;run.lockedScore=run.score;'));
// モンスターノーツの蘇生でスコア加算を再開できるよう、差し引く量(scoreOffset)も0から始める
check('run開始時にDOWNと固定スコアを初期化',game.includes('lifeDepleted:false,score:0,lockedScore:0,scoreOffset:0,'));
check('DOWN中に止まっていた分を遡って加算しない差し引きを持つ',
  game.includes('run.score=calculatedScore-run.scoreOffset;')
  &&game.includes('run.scoreOffset=rhythmScoreOffsetAfterRevive(calculatedScore,run.lockedScore);'));
check('既存BEST形式・保存キーを変更していない',!game.includes('bestLife')&&!game.includes('lockedScore:score')&&game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';"));
check('新しいlocalStorageキーを追加していない',!game.includes('mh_rhythm_life')&&!game.includes('mh_rhythm_down'));
check('仕様書に不可逆DOWNと固定スコアを記載',docs.includes('不可逆のDOWN')&&docs.includes('固定スコア'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
