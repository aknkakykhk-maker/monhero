#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};

const data=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');
const context={};
vm.runInNewContext(`${data}\nthis.out={RHYTHM_SONGS};`,context);
const songs=context.out.RHYTHM_SONGS;
const song=songs.find(item=>item.songId==='atsu_cup_theme_debug_short');
const chart=song?.difficulties?.HARD;
const notes=chart?.notes||[];

check('短縮DEBUG曲を専用songIdで登録',song?.displayName==='あつ杯テーマ DEBUG 60s');
check('既存あつ杯テーマ音源を再利用',song?.bgmTrackId==='atsu_cup_theme');
const matchingMp3=fs.readdirSync(path.join(ROOT,'monster-hero/audio')).filter(name=>/^bgm-atsu-cup-theme.*\.mp3$/i.test(name));
check('あつ杯テーマの重複MP3を追加しない',matchingMp3.length===1&&matchingMp3[0]==='bgm-atsu-cup-theme.mp3');
check('短縮再生時間は55〜65秒',song?.playDurationMs>=55000&&song.playDurationMs<=65000&&chart?.durationMs===song.playDurationMs);
check('4ノーツ種別を収録',['TAP','HOLD','FLICK','SLIDE'].every(type=>notes.some(note=>note.type===type)));
const widths=new Set();
notes.forEach(note=>{if(Number.isInteger(note.subLaneWidth))widths.add(note.subLaneWidth);(note.slidePoints||[]).forEach(point=>{if(Number.isInteger(point.subLaneWidth))widths.add(point.subLaneWidth);});});
check('幅1〜4をすべて収録',[1,2,3,4].every(width=>widths.has(width)));
check('0.5レーンSLIDEを収録',notes.some(note=>note.type==='SLIDE'&&(note.slidePoints||[]).some(point=>Number(point.lane)%1===.5)));
check('可変幅SLIDEを収録',notes.some(note=>note.type==='SLIDE'&&new Set((note.slidePoints||[]).map(point=>point.subLaneWidth).filter(Boolean)).size>=3));
check('HOLD中別TAPを収録',notes.some(hold=>hold.type==='HOLD'&&notes.some(note=>note.type==='TAP'&&note.timeMs>hold.timeMs&&note.timeMs<hold.endTimeMs)));
check('SLIDE中別TAPを収録',notes.some(slide=>slide.type==='SLIDE'&&notes.some(note=>note.type==='TAP'&&note.timeMs>slide.timeMs&&note.timeMs<slide.endTimeMs)));
check('短縮終了はsong固有値をaudio clock内でfallback適用',game.includes("const playEndTimeMs=Number.isFinite(Number(song.playDurationMs))?Number(song.playDurationMs):chart.durationMs")&&game.includes('songTimeMs>=playEndTimeMs||run.audio.ended()'));
check('既存曲は短縮値なしで従来chart終了を維持',songs.filter(item=>item.songId!=='atsu_cup_theme_debug_short').every(item=>item.playDurationMs===undefined));
check('リスタートは新run生成・入力と音声を破棄',game.includes('const restart=()=>{const startBest=runRef.current?.startBest;if(startBest)beginRun(startBest);};')&&game.includes('disposeRun();setView({...initialView(),status:\'loading\'});const audio=await Audio_.startRhythmTrack(song.bgmTrackId)'));
check('音声開始は直接ボタンonClick経路',game.includes("onClick={()=>{setRhythmPlay({song,difficulty});setGameState('RHYTHM_PLAY');}}")&&!game.includes("data-rhythm-tap-start')?.click"));
check('DOM判定ラインを維持',game.includes('data-rhythm-judgment-line')&&!game.includes('<line data-rhythm-judgment-line'));
const formal=JSON.parse(read('monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v1.json'));
check('正式EASY候補v1を未完成フル尺候補のまま維持',formal.noteCount===78&&formal.notes.length===78&&formal.typeCounts.TAP===72&&formal.typeCounts.HOLD===6&&formal.earReviewGrids.length===22&&formal.reviewRequired===true&&formal.runtimeConnected===false);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
