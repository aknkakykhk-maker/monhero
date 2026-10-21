#!/usr/bin/env node
// ホールド・スライドの刻みもノーツとして数える(2026-10-17 社長の決定・docs/playbot/reports/2026-10-17/combo-tick-v2/PLAN.md)を見張る。
//
//   node tools/mode/rhythm-tick-notes-check.js
//
// 見ること:
//   ・刻みの置き方: EASY〜HARD は4分・EXPERT 以上は8分・速い曲は1段粗く・折れ点には必ず・100ms に1つまで・始まりと終わりの前後40ms には置かない
//   ・スコア: 刻みの重みは半分。ノーツも刻みも全部つなげば満点(今の満点のまま)。今の計算(rhythmCalculateScore)は変えない
//   ・称号: 刻みを1つでも落とすと FC・AE・AM は付かない。渡さない呼び出しは今までどおり
//   ・自己ベストは新キー mh_rhythm_best_v2。v1 は書き換えず、クリア・称号の印だけを重ねて読む
//   ・ランキング: 新しい物差しは Rhythm-曲-難易度-2(今の見方は3つ区切りだけを数えるので混ざらない)。期間は始まった時点の物差し。足すだけの SQL がある
//   ・レイド: 刻みも判定の数に入れる。HELL の補正(MASTER と同じ)。マルチは通信路を版で分ける
//   ・遊んだ記録・端末の記録に刻みを入れない(判定の数 run.counts はノーツだけ)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const data=read('monster-hero/data/rhythm-mode.js'),settings=read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),play=read('monster-hero/src/parts/30-rhythm-play.jsx');
const storage=read('monster-hero/src/parts/25-storage.jsx'),app=read('monster-hero/src/parts/60-app.jsx'),raid=read('monster-hero/src/parts/35-raid-jack.jsx'),multi=read('monster-hero/src/parts/77-screen-rhythm-multi.jsx'),supa=read('monster-hero/src/parts/26-supabase.jsx');
let failed=0;const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const grab=(src,from,end='\n};')=>{const i=src.indexOf(from),j=src.indexOf(end,i);return i>=0&&j>i?src.slice(i,j+end.length):'';};
const constLine=(src,name)=>{const m=src.match(new RegExp(`const ${name}=[^\\n]*`));return m?m[0]:'';};

// ===== 刻みの置き方 =====
const tickSrc=['RHYTHM_COMBO_TICK_EDGE_MS','RHYTHM_COMBO_TICK_MIN_GAP_MS','RHYTHM_COMBO_TICK_MIN_STEP_MS','RHYTHM_COMBO_TICK_FALLBACK_MS','RHYTHM_COMBO_TICK_DIVISION'].map(n=>constLine(data,n)).join('\n')
  +'\n'+constLine(data,'rhythmBeatLineTime')+'\n'+grab(data,'const rhythmSlideBendTimes=')+'\n'+grab(data,'const rhythmComboTickTimes=');
const api=new Function('rhythmBeatCurveAt',`${tickSrc}\nreturn {rhythmComboTickTimes};`)(()=>0);
const T=api.rhythmComboTickTimes;
const grid={beatMs:500,zeroMs:0,splices:[],curve:[]};// 120BPM
const hold={timeMs:1000,endTimeMs:3000};
const easy=T(hold,grid,'EASY'),master=T(hold,grid,'MASTER');
check('EASY〜HARD は4分音符(1拍)ごと',JSON.stringify(easy)===JSON.stringify([1500,2000,2500]),JSON.stringify(easy));
check('EXPERT 以上は8分音符ごと',JSON.stringify(master)===JSON.stringify([1250,1500,1750,2000,2250,2500,2750]),JSON.stringify(master));
const fast=T(hold,{beatMs:250,zeroMs:0,splices:[],curve:[]},'MASTER');// 240BPM の8分は125ms → 1段粗く250ms
check('速い曲(150ms 未満)は1段粗く',fast.every((t,i)=>!i||t-fast[i-1]>=150)&&fast.length===7,JSON.stringify(fast));
check('始まりと終わりの前後40ms には置かない',T({timeMs:1000,endTimeMs:2010},grid,'MASTER').every(t=>t>=1040&&t<=1970)&&!T({timeMs:960,endTimeMs:2040},grid,'EASY').includes(1000)&&!T({timeMs:960,endTimeMs:2030},grid,'EASY').includes(2000));
const slide={timeMs:1000,endTimeMs:3000,slidePoints:[{timeMs:1000,lane:0},{timeMs:1630,lane:3},{timeMs:2240,lane:1},{timeMs:2290,lane:2},{timeMs:3000,lane:2}]};
const s=T(slide,grid,'MASTER');
check('帯の折れ点には必ず置く',s.includes(1630)&&s.includes(2240),JSON.stringify(s));
check('1本の帯で100ms に1つまで(近い折れ点は先のほう・拍の刻みは外す)',s.every((t,i)=>!i||t-s[i-1]>=100)&&!s.includes(2290)&&!s.includes(2250)&&s.includes(1750),JSON.stringify(s));
check('拍の表が無い曲は 250ms ごと',JSON.stringify(T(hold,null,'MASTER'))===JSON.stringify([1250,1500,1750,2000,2250,2500,2750]));
check('タップには刻みを付けない(ホールド・スライドだけ)',/_rhythmTickRules:true,_rhythmComboTicks:rhythmComboTickTimes\(note,tickGrid,difficulty\.id\)/.test(play)&&/tickRules&&rhythmNoteHasBody\(note\)\?/.test(play));

// ===== スコア・称号 =====
const scoreSrc=[constLine(settings,'RHYTHM_TICK_SCORE_WEIGHT'),grab(settings,'const rhythmCalculateScoreTicks = '),grab(settings,'const rhythmCalculateScore = '),grab(settings,'const rhythmResultAchievements = ')].join('\n');
const J=[{id:'MARVELOUS',scoreRate:1},{id:'EXCELLENT',scoreRate:.98},{id:'GREAT',scoreRate:.9},{id:'GOOD',scoreRate:.7},{id:'BAD',scoreRate:.3},{id:'MISS',scoreRate:0}];
const sc=new Function('RHYTHM_JUDGMENTS','RHYTHM_JUDGMENT_IDS','RHYTHM_SCORE_WEIGHTS',`${scoreSrc}\nreturn {rhythmCalculateScoreTicks,rhythmCalculateScore,rhythmResultAchievements,RHYTHM_TICK_SCORE_WEIGHT};`)(J,J.map(x=>x.id),{judgment:.9,combo:.1});
const all={MARVELOUS:600,EXCELLENT:0,GREAT:0,GOOD:0,BAD:0,MISS:0};
check('全部つなげば満点(刻みがあっても今の満点のまま)',sc.rhythmCalculateScoreTicks({judgments:all,maxCombo:1100,totalNotes:600,maxScore:1000000,tickJust:500,tickTotal:500})===1000000);
check('今の計算(刻みなし)は変えていない',sc.rhythmCalculateScore({judgments:all,maxCombo:600,totalNotes:600,maxScore:1000000})===1000000&&!/comboTotal/.test(grab(settings,'const rhythmCalculateScore = ')));
check('刻みの重みはふつうのノーツの半分',sc.RHYTHM_TICK_SCORE_WEIGHT===.5);
const drop=sc.rhythmCalculateScoreTicks({judgments:all,maxCombo:1100,totalNotes:600,maxScore:1000000,tickJust:499,tickTotal:500});
check('刻みを1つ落とすと少し下がる',drop<1000000&&drop>990000,String(drop));
check('刻みを1つでも落とすと FC・AE・AM は付かない',JSON.stringify(sc.rhythmResultAchievements(all,600,1))===JSON.stringify({fullCombo:false,allExcellent:false,allMarvelous:false})&&sc.rhythmResultAchievements(all,600).allMarvelous===true);
check('刻みは判定の数(run.counts)に入れない(遊んだ記録・端末の記録・異変の報告に入らない)',/if\(drop>0\)\{run\.tickMiss\+=drop;/.test(play)&&/if\(ok>0\)\{run\.tickJust\+=ok;/.test(play)&&!/run\.counts\[[^\]]*\]\+\+[^;]*tick/i.test(play));
check('刻みの MISS ではライフを減らさない',!/tickMiss[^\n]{0,200}rhythmLifeAfter/.test(play));
check('いたずら(ゴースト血統)は刻みの MISS でもコンボを守る',/rhythmItazuraKeepsCombo\(run\.abilities,'MISS'/.test(play));
check('押し終わりに残りの刻みを清算する(GOOD 以上は取った・BAD/MISS は落とした)',/comboTicksRef\.current\(note,judgment\);/.test(play)&&/if\(judgment==='BAD'\|\|judgment==='MISS'\)note\._rhythmComboDrop=dropNow\(\)\+rest;else note\._rhythmComboOk=okNow\(\)\+rest;/.test(play));
check('ホールドも外れで切らない(刻みの数え方のとき)',/if\(session\.kind==='SLIDE'\|\|session\.note\?\._rhythmTickRules===true\)return;/.test(data));
check('切り替えの時刻は1か所・演奏を始めるときに見る',(data.match(/const RHYTHM_TICK_SWITCH_AT=/g)||[]).length===1&&/const tickRules=rhythmTickRulesActive\(\);rhythmFloatingNotesClear\(\);runRef\.current=/.test(play));

// ===== 自己ベスト =====
check('自己ベストは新キー mh_rhythm_best_v2',/const RHYTHM_BEST_RECORDS_V2_KEY = 'mh_rhythm_best_v2';/.test(settings)&&/const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';/.test(settings));
check('結果の版で書くキーを分け、その版の保存値へ入れる',/const key=version===2\?RHYTHM_BEST_RECORDS_V2_KEY:RHYTHM_BEST_RECORDS_KEY;/.test(storage)&&/const bestVersion=result\?\.scoreVersion===2\?2:1;/.test(app));
check('新しい数え方では v2 に v1 のクリア・称号の印だけを重ねて読む',/rhythmBestRecordsWithLegacyMarks\(await loadRhythmBestRecordsOf\(2\),legacy\)/.test(storage)&&/clear:a\.clear\|\|b\.clear===true/.test(settings));
check('SAVE_DATA.md に新しいキー',read('docs/spec/SAVE_DATA.md').includes('`mh_rhythm_best_v2`')&&read('docs/spec/SAVE_DATA.md').includes('`mh_rhythm_tick_preview_proto`'));

// ===== ランキング =====
check('新しい数え方の記録も今までの鍵で送り、今までの順位に1つにつなげる(2026-10-17 社長「ランキング全部リセットされてる」)',/rhythmRankingDifficultyKey\(song\?\.songId, difficulty\?\.id, 1\)/.test(app)&&/const rhythmRankingViewVersion=\(\)=>1;/.test(data));
check('…-2 で届いた記録も曲ごとの順位で読み、送れなかった記録の …-2 は今までの鍵に直して送る',/rhythmRankingKeysWithV2\(rhythmRankingDifficultyKey\(song\.songId, diff\)\)/.test(app)&&/difficulty: rhythmRankingKeyToV1\(columns\.difficulty\)/.test(app));
check('切り替え前(試作)の新しい記録は送らない',/if \(scoreVersion === 2 && !\(typeof rhythmTickRulesReleased === 'function' && rhythmTickRulesReleased\(\)\)\) return;/.test(app));
check('週間・イベントも今までの見方で数える(切り替え前の記録もふくめる)',/const rhythmRankingPeriodVersion=\(\)=>1;/.test(data));
check('自己ベストは前の記録と新しい記録の高いほうを出す(前の記録には「旧」の印)',/if\(Number\(b\.bestScore\)>Number\(a\.bestScore\)/.test(settings)&&/rhythmBestShowsLegacy\(song\.songId,difficulty\.id\)/.test(read('monster-hero/src/parts/29-rhythm-screens.jsx')));
check('旧の記録を一緒に送らない(2026-10-17 社長「切り替えちゃっていいよ」)',!/rhythmTickDual/.test(app+data)&&!/legacy:\{score:/.test(play));
check('「旧記録」のボタンはもう出さない',!/data-rhythm-ranking-legacy/.test(read('monster-hero/src/parts/58-screen-rhythm.jsx'))&&(app.match(/legacyView/g)||[]).length>=1&&/const legacyView = RHYTHM_RANKING_VIEW\.legacy === true;/.test(app));
const sql=fs.existsSync(path.join(ROOT,'docs/sql/rankings/RHYTHM_TICK_V2_APPLY.sql'))?read('docs/sql/rankings/RHYTHM_TICK_V2_APPLY.sql'):'';
check('足すだけの SQL がある(既存を alter・drop・delete・update しない)',sql.includes('create or replace view public.rhythm2_scores')&&!/\b(alter|drop|delete|update|truncate)\b\s+(table|view|function|from|public\.)/i.test(sql.replace(/^--.*$/gm,'')));
check('SQL の新しい見方は4つ区切りの -2 だけを数える',/array_length\(string_to_array\(difficulty, '-'\), 1\) = 4/.test(sql)&&/split_part\(difficulty, '-', 4\) = '2'/.test(sql));

// ===== レイド・マルチ =====
check('レイドは刻みも判定の数に入れる(取った刻みは JUST MARVELOUS・落とした刻みは MISS)',/MARVELOUS: \(Math\.floor\(Number\(r\.judgments\.MARVELOUS\) \|\| 0\)\) \+ tickJust/.test(raid)&&/const precise = \(Math\.floor\(Number\(r\.precise\) \|\| 0\)\) \+ tickJust;/.test(raid));
// 2026-10-21 社長の決定で HELL は MASTER の1.5倍(それまでは MASTER と同じ 1.0)
check('レイドの HELL の補正は MASTER の1.5倍',/MASTER: 1\.0, HELL: 1\.5 \}/.test(raid));
check('マルチは通信路を版で分ける',(multi.match(/rhythmMultiTopicTag\(\)/g)||[]).length>=4);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
