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
check('判定窓と通常スコア式は不変',JSON.stringify(RHYTHM_JUDGMENTS.map(x=>[x.id,x.windowMs,x.scoreRate]))===JSON.stringify([['MARVELOUS',55,1],['EXCELLENT',100,.98],['GREAT',150,.9],['GOOD',170,.7],['BAD',185,.3],['MISS',null,0]])&&RHYTHM_SCORE_WEIGHTS.judgment===.9&&RHYTHM_SCORE_WEIGHTS.combo===.1);
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

// ===== ライフの見せ方とリザルトのクリア／失敗(2026-09-12・ユーザー指示) =====
// 「ライフ変動や0になったときとか気付きにくいからもっと強調して / 0だとライフが赤くなるとか
//   バーが割れるとか」「終了後にクリアか失敗かもわかるようにして / それによって経験値も変わるから」。
// ★ライフの数値・減少量・DOWNの扱いは1つも変えていないこと(上のチェックが見張っている)。
//   ここでは「見せ方」と「クリア／失敗の扱い」だけを見る。
const html=read('monster-hero/index.html');
const lifeStateBlock=game.match(/const rhythmLifeState = life => \{[\s\S]*?\n\};/)?.[0]||'';
check('ライフの段は1か所(rhythmLifeState)で決めている',lifeStateBlock.length>0
  &&/const ratio = rhythmLifeRatio\(life\);/.test(lifeStateBlock));
if(lifeStateBlock){
  // ★rhythmLifeRatio は rhythmLifeValue を呼ぶので、上で組み立てた同じ実行環境の中で動かす
  //   (関数だけ取り出して外で動かすと、呼び先が見えずに落ちる)
  vm.runInContext(`${lifeStateBlock}\nthis.out.rhythmLifeState=rhythmLifeState;`,context);
  const rhythmLifeStateFn=context.out.rhythmLifeState;
  check('段は 0 / 25%以下 / 50%以下 / それ以外 で分かれる',
    rhythmLifeStateFn(0)==='down'&&rhythmLifeStateFn(250)==='danger'
    &&rhythmLifeStateFn(251)==='caution'&&rhythmLifeStateFn(500)==='caution'
    &&rhythmLifeStateFn(501)==='ok'&&rhythmLifeStateFn(1000)==='ok');
  check('壊れた値・値なしは満タン(ok)として扱う',
    rhythmLifeStateFn(null)==='ok'&&rhythmLifeStateFn(undefined)==='ok'&&rhythmLifeStateFn('')==='ok');
}
check('HUDは段をdata属性で伝える(見た目だけ・判定には触らない)',
  game.includes('data-rhythm-life data-life-state={lifeState}')
  &&html.includes('[data-rhythm-life][data-life-state="danger"]')
  &&html.includes('[data-rhythm-life][data-life-state="down"] [data-rhythm-life-track]'));
check('0だとハート・数字・バーの見た目が変わる(赤くなる・割れる)',
  game.includes("{lifeState==='down'?'💔':'♥'}")
  &&game.includes("{lifeState==='down'?'DOWN':view.life}")
  // ひび割れは、要素を増やさずバーの ::before / ::after をハの字に置いて描く
  &&html.includes('[data-rhythm-life][data-life-state="down"] [data-rhythm-life-track]::before')
  &&html.includes('[data-rhythm-life][data-life-state="down"] [data-rhythm-life-track]::after'));
// 2026-09-12: 印の付け直し(CSSアニメーションの流し直し)を rhythmRestartAnimations へ
// まとめたので、「その場で印を付ける」文字列は無くなった。強制同期レイアウトを
// 演出の数だけ走らせないための変更で、揺らす・数字を出すという作りは同じ。
check('減った瞬間に揺らし、減った量を一瞬だけ出す',
  game.includes('const lifeDelta=run.life-lifeBefore;')
  &&game.includes("lifeRestarts.push({el:lifeBox,attr:'rhythmLifeHit'})")
  &&game.includes('lifeDamage.textContent=String(lifeDelta);')
  &&game.includes('rhythmRestartAnimations(lifeRestarts)')
  &&html.includes('[data-rhythm-life][data-rhythm-life-hit="1"]'));
// ★根性で蘇生したときは「増えた」側なので出さない。増減どちらでも出すと、回復のたびに揺れる
check('増えたときには出さない(減ったときだけ)',game.includes('if(lifeDelta<0){'));
check('0になった瞬間だけ大きく1度知らせる',
  game.includes('if(run.life===0&&lifeBefore>0)setLifeDownCount(count=>count+1);')
  &&game.includes('data-rhythm-life-down-slam')
  // ★段(lifeDownCount)だけを依存にする。view.life を依存にすると、ライフが動くたびに
  //   後片付けが走って「消すタイマー」を解除してしまう(コンボ演出で実際に踏んだ形)
  &&game.includes('},[lifeDownCount]);'));
check('倒れているあいだは画面のふちを赤く縁取る',
  game.includes("{lifeState==='down'&&<div data-rhythm-down-vignette")
  &&html.includes('[data-rhythm-down-vignette]{'));
check('動きを減らす設定の端末では、色と表示だけにする',
  /@media \(prefers-reduced-motion:reduce\)\{[\s\S]{0,600}?\[data-rhythm-down-vignette\]/.test(html));

// --- リザルトのクリア／失敗 ---
check('失敗はライフ0のまま終えたときだけ(練習は必ずクリア)',
  game.includes('const failed=!tutorial&&run.lifeDepleted===true;')
  &&game.includes('cleared:!failed,'));
check('リザルトの最上段にCLEAR / FAILEDを出す',
  game.includes('data-rhythm-result-clear')
  &&game.includes("{failed?'FAILED':'CLEAR'}")
  &&html.includes('[data-rhythm-result-clear][data-cleared="false"]'));
// ★BEST記録は保存キーも形も変えず、項目を1つ足すだけ(CLAUDE.md ⑦)
check('BEST記録は played(遊んだ) と clear(ライフを残して終えた) を分ける',
  game.includes('played:source.played===true||source.clear===true,clear:source.clear===true,')
  &&game.includes('clear:previous.clear||result?.cleared!==false,'));
check('一度立ったclearは、あとで失敗しても下がらない',
  game.includes('clear:previous.clear||'));
check('保存キーは増やしていない',
  game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';")
  &&!game.includes('mh_rhythm_clear')&&!game.includes('mh_rhythm_failed'));
check('曲えらびのひし形に「失敗」の段がある',
  game.includes("if(!record.clear)return 'FAILED';")
  &&game.includes("FAILED:    Object.freeze({label:'失敗（ライフ0）'"));
// --- 入る周回数(=経験値) ---
const forResult=game.match(/const rhythmPlayRunLoopsForResult = \(loops, cleared\) => \{[\s\S]*?\n\};/)?.[0]||'';
check('失敗したときの周回数の決め方を取り出せる',forResult.length>0);
if(forResult){
  const fn=new Function(`${forResult}return rhythmPlayRunLoopsForResult;`)();
  check('クリアならこれまでどおり全部入る',fn(4,true)===4&&fn(9,true)===9);
  // ★半分(最低1周)入るようにしていたが、叩かずに放っておいても半分もらえてしまうため0にした
  //   (2026-09-12・ユーザー指示「失敗しても入るようにすると放置で稼げるようになるから
  //    失敗は0にして」)。半分へ戻さないよう、0であることを名指しで見る。
  check('失敗は1周も入らない(0)',fn(1,false)===0&&fn(4,false)===0&&fn(9,false)===0);
  check('もともと0周のときは0のまま',fn(0,false)===0&&fn(0,true)===0);
  check('クリアかどうかを渡さない古い呼び出しは全部入る',fn(4)===4&&fn(4,undefined)===4);
}
check('半分にする決めごとは残していない',!game.includes('RHYTHM_PLAY_RUN_LOOP_FAILED_RATE'));
// ★追いつきは「実際に周回が入ったか」で判断する。失敗(0周)は途中でやめたときと同じ扱いにして、
//   止まっていたぶんだけは取り戻せるようにする(損はしないが、得もしない)
check('失敗したときは追いつきを止めない',
  game.includes('if (Number(rhythmPlayRunAwardRef.current?.loops) > 0) { stopCatchUp(); return; }')
  ||game.includes('if(Number(rhythmPlayRunAwardRef.current?.loops)>0){stopCatchUp();return;}'));
check('裏で周回していた人には、入らなかった理由を曲リザルトで伝える',
  game.includes('if(!cleared&&baseLoops>0)setRhythmPlayRunAward({loops:0,baseLoops,cleared:false,')
  &&game.includes('data-rhythm-result-quick-run-failed'));
check('仕様書にクリア／失敗と周回数の扱いを記載',
  docs.includes('リザルトのクリア／失敗')&&docs.includes('rhythmPlayRunLoopsForResult')
  &&docs.includes('**失敗は0周。**'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
