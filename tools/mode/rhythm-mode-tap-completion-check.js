#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const context={};vm.runInNewContext(`${data}\nthis.out={RHYTHM_JUDGMENTS,RHYTHM_SONGS};`,context);
const helper=game.match(/const rhythmResultAchievements = [\s\S]*?\n};\n\/\/ 今回の完走結果[\s\S]*?\n};/)?.[0];
check('達成条件とBEST統合の純粋関数を抽出できる',!!helper);
if(helper){const c={RHYTHM_JUDGMENTS:context.out.RHYTHM_JUDGMENTS,RHYTHM_JUDGMENT_IDS:context.out.RHYTHM_JUDGMENTS.map(x=>x.id),normalizeRhythmBestRecord:value=>{const v=value||{},ids=context.out.RHYTHM_JUDGMENTS.map(x=>x.id);return {bestScore:+v.bestScore||0,maxCombo:+v.maxCombo||0,clear:v.clear===true,fullCombo:v.fullCombo===true,allExcellent:v.allExcellent===true,allMarvelous:v.allMarvelous===true,judgments:Object.fromEntries(ids.map(id=>[id,+v.judgments?.[id]||0]))};}};vm.runInNewContext(`${helper}\nthis.out={rhythmResultAchievements,mergeRhythmBestRecord};`,c);const L=c.out;
  const j=(values={})=>({MARVELOUS:0,EXCELLENT:0,GREAT:0,GOOD:0,BAD:0,MISS:0,...values});
  check('FULL COMBOはBAD=0かつMISS=0',L.rhythmResultAchievements(j({MARVELOUS:8,GREAT:2}),10).fullCombo&&!L.rhythmResultAchievements(j({BAD:1}),10).fullCombo&&!L.rhythmResultAchievements(j({MISS:1}),10).fullCombo);
  check('ALL EXCELLENTはGREAT以下がすべて0',L.rhythmResultAchievements(j({MARVELOUS:8,EXCELLENT:2}),10).allExcellent&&!L.rhythmResultAchievements(j({GREAT:1}),10).allExcellent);
  check('ALL MARVELOUSは全ノーツMARVELOUS',L.rhythmResultAchievements(j({MARVELOUS:10}),10).allMarvelous&&!L.rhythmResultAchievements(j({MARVELOUS:9,EXCELLENT:1}),10).allMarvelous);
  const old={bestScore:500,maxCombo:8,clear:true,fullCombo:true,allExcellent:true,allMarvelous:true,judgments:j({MARVELOUS:5})};
  const low=L.mergeRhythmBestRecord(old,{score:400,maxCombo:7,judgments:j({MISS:5})});
  check('bestScoreは最高値だけ保持し同点もNEW RECORDにしない',low.bestScore===500&&L.mergeRhythmBestRecord(old,{score:500,judgments:j({MISS:2})}).bestScore===500&&game.includes('score>run.startBestScore'));
  check('bestScore更新時だけjudgments更新',low.judgments.MARVELOUS===5&&L.mergeRhythmBestRecord(old,{score:501,judgments:j({EXCELLENT:5})}).judgments.EXCELLENT===5);
  check('maxComboは歴代最大値',low.maxCombo===8&&L.mergeRhythmBestRecord(old,{score:501,maxCombo:9}).maxCombo===9);
  check('達成フラグtrueを後から消さない',low.clear&&low.fullCombo&&low.allExcellent&&low.allMarvelous);
}
check('ノーツ移動は時刻を変えず非線形projectionでpx計算',game.includes('travelPx:judgmentY-spawnY')&&game.includes('rhythmProjectTravelProgress(progress)*travel.travelPx')&&game.includes('yPx=Math.round(yPx);')&&game.includes('const nextTransform=`translate3d(0,${yPx}px,0)`;')&&game.includes('if(el._rhythmTransform!==nextTransform){el.style.transform=nextTransform;')&&!game.includes('el.style.transform=`translate3d(0,${yPx}px,0) scale('));
check('ポーズ中は音源とrAFを止め入力・MISSを停止',game.includes('run.paused=true;stopFrame();run.audio.pause()')&&game.includes('run.finished||run.paused||note.done')&&(game.includes("run.paused||view.status!=='playing'")||game.includes('if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')));
check('再開は同じoffsetから新しいBufferSourceを生成',game.includes('offsetSeconds=songTimeSeconds()')&&game.includes('const nextSource=ctx.createBufferSource()')&&game.includes('startSource(offsetSeconds)'));
// 曲の時刻は今も AudioContext だけを正本にする。
// ただし 2026-09-05 に足した「画面が組み上がるのを待つ」処理は曲の時刻とは無関係の
// 待ち時間の上限なので、performance.now() が無い場合の控えとして Date.now() を使う。
// ここで見たいのは「曲の時刻に Date.now() を混ぜていないこと」なので、待ち処理は外して見る
const tapTestSource=(game.match(/const RhythmTapTest=[\s\S]*?\n};\n\nfunction MonsterHeroGame/)?.[0]||'')
  .replace(/const waitUntilPlayable=[\s\S]*?\n  \}\);\n/,'');
check('ポーズ中songTimeは進まずAudioContext時刻を正本にする',game.includes('offsetSeconds+(playing?ctx.currentTime-startedAt:0)')&&!/Date\.now\(\)/.test(tapTestSource));
check('PAUSEとリザルト再プレイは同じbeginRunを使用',game.includes('const restart=()=>')&&game.includes('beginRun(startBest)')&&game.includes('onClick={()=>beginRun(mergeRhythmBestRecord'));
check('中断は保存せず共通disposeRunで停止',game.includes('const abort=()=>')&&game.includes('disposeRun();onExit()')&&!/const abort=[^;]*onComplete/.test(game));
check('正常完走だけBEST保存しReact stateを即時更新',game.includes('onComplete(result,merged)')&&game.includes('saveRhythmBestRecord(rhythmBestRecords')&&game.includes('setRhythmBestRecords(records)'));
check('source/rAF cleanupと再プレイ導線を持つ',game.includes('const disposeRun=useCallback')&&game.includes('runRef.current=null')&&game.includes('もう一度プレイ')&&game.includes('音ゲーデバッグへ戻る'));
check('多重開始ロックとgenerationで古いPromiseを無効化',game.includes('if(startLockRef.current)return')&&game.includes('const generation=++generationRef.current')&&game.includes('generation!==generationRef.current')&&game.includes('audio?.stop();return'));
check('プレオープンで公開されている',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = true'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
