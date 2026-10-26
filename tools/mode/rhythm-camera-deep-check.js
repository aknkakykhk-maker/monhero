#!/usr/bin/env node
// 案3の2段目「カメラを寝かせる」(2026-10-16・確認待ちの試作 mh_rhythm_floor3d_proto_v1='c3b')で、押した場所とノーツがずれないことを見張る。
//
//   node tools/mode/rhythm-camera-deep-check.js
//
// 見ること:
//   ・既定(試作が切)の道の遠近とノーツの近づき方は、カメラの入れ物(RHYTHM_PROJECTION_CAMERA)を通しても今までと1つも変わらない
//   ・カメラを寝かせたとき、どのレーン・どの高さでも、描いたノーツの真ん中を押すとそのレーンに当たる(入力は描くときと同じ遠近で逆にたどる)
//   ・道の遠近の値(奥の幅・近づき方)を、カメラの入れ物を通さずに直接読んでいる所が無い(GPU の帯の uTop・uFar も入れ物から)
//   ・演奏画面が演奏を始めるときに入れ、離れるときに戻す(曲えらびの見本などに持ち越さない)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const {rhythmProjectionSource}=require('./rhythm-projection-source.js');
const settingsSrc=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
let failed=0;const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 道の遠近とノーツの近づき方(RHYTHM_PROJECTION_TOP_SCALE 〜 rhythmProjectTravelProgress)を切り出して動かす
const from=data.indexOf('const RHYTHM_PROJECTION_TOP_SCALE='),travel=data.indexOf('const rhythmProjectTravelProgress=',from),travelEnd=data.indexOf('\n};',travel);
const lane=(data.match(/const RHYTHM_LANE_COUNT\s*=[^\n]*/)||[''])[0];
const api=new Function(`${lane}\n${data.slice(from,travelEnd+3)}\nreturn {RHYTHM_PROJECTION_CAMERA,rhythmProjectionDepth,rhythmProjectBoundary,rhythmProjectLane,rhythmProjectTravelProgress,RHYTHM_LANE_COUNT};`)();
check('道の遠近の計算を切り出せる(rhythm-projection-source.js と同じ始まり)',!!rhythmProjectionSource(data));

const ys=[-.2,0,.1,.25,.4,.55,.7,.85,.88,1],ps=[-.3,0,.2,.5,.8,1,1.2];
// 既定: 今までの式(奥の幅 .07・直線・近づき方 .4)と同じ
api.RHYTHM_PROJECTION_CAMERA.reset();
const oldDepth=y=>{const v=Math.min(1,Number(y)||0);if(v<0)return Math.max(0,.07+(1-.07)*v);return .07+(1-.07)*Math.pow(Math.max(0,Math.min(1,v)),1);};
const oldTravel=p=>{const far=.4,k=1/far;if(p<0)return p*(k-1)/(k*k)/(1-far);if(p>1)return 1+(p-1)*(k-1)/(1-far);return (1/(k-(k-1)*p)-far)/(1-far);};
check('既定の道の遠近は今までと同じ',ys.every(y=>api.rhythmProjectionDepth(y)===oldDepth(y)));
check('既定のノーツの近づき方は今までと同じ',ps.every(p=>api.rhythmProjectTravelProgress(p)===oldTravel(p)));

// カメラを寝かせる: 描いたノーツの真ん中を、入力と同じやり方(その高さの道の左右の端からの割合)で逆にたどる
api.RHYTHM_PROJECTION_CAMERA.set(true);
const inputCoord=(nx,y)=>{const left=api.rhythmProjectBoundary(0,y),right=api.rhythmProjectBoundary(api.RHYTHM_LANE_COUNT,y),w=(right-left)/api.RHYTHM_LANE_COUNT;return (nx-left)/w-.5;};
let worst=0;
for(const y of ys.filter(v=>v>0))for(let l=0;l<api.RHYTHM_LANE_COUNT;l++){const c=api.rhythmProjectLane(l,y).center;worst=Math.max(worst,Math.abs(inputCoord(c,y)-l));}
check('カメラを寝かせても、描いたノーツの真ん中を押すとそのレーンに当たる',worst<1e-9,`最大のずれ ${worst.toExponential(1)} レーン`);
check('カメラを寝かせると奥が細くなる(道が深く見える)',api.rhythmProjectionDepth(0)<oldDepth(0));
check('カメラを寝かせると遠くのノーツはゆっくり・手前で速く近づく',api.rhythmProjectTravelProgress(.5)<oldTravel(.5)&&api.rhythmProjectTravelProgress(1)===1);
check('カメラを寝かせても道の両端はまっすぐ(曲げるとラッパの形に戻る)',/const RHYTHM_PROJECTION_CURVE=1;/.test(data)&&!/RHYTHM_PROJECTION_CAMERA[\s\S]{0,400}curve:/.test(data.slice(from,from+2000)));
api.RHYTHM_PROJECTION_CAMERA.reset();
check('戻すと既定の値に戻る',ys.every(y=>api.rhythmProjectionDepth(y)===oldDepth(y))&&ps.every(p=>api.rhythmProjectTravelProgress(p)===oldTravel(p)));

// 直接読んでいる所が無い(宣言・入れ物の既定値・近づき方の既定値の受け皿だけ)
const uses=name=>[...data.matchAll(new RegExp(name,'g'))].length;
check('奥の幅の値は入れ物を通して読む',uses('RHYTHM_PROJECTION_TOP_SCALE[^_]')===3,`${uses('RHYTHM_PROJECTION_TOP_SCALE[^_]')}か所(宣言と入れ物の既定の2か所だけ)`);
check('GPU の帯も入れ物から読む(uTop・uFar)',/gl\.uniform1f\(U\.uTop,RHYTHM_PROJECTION_CAMERA\.top\)/.test(data)&&/gl\.uniform1f\(U\.uFar,RHYTHM_PROJECTION_CAMERA\.far\|\|RHYTHM_TRAVEL_FAR_SCALE\)/.test(data));
check('演奏画面が演奏を始めるときに入れ、離れるときに戻す',/RHYTHM_PROJECTION_CAMERA\.set\(cameraDeep\)/.test(play)&&/RHYTHM_PROJECTION_CAMERA\.reset\(\)/.test(play)&&/const cameraDeep=useState\(\(\)=>settings\.roadDepth==='DEEP'\|\|rhythmCameraDeepActive\(\)\)\[0\]/.test(play));
// 2026-10-27 社長の選択「案A」: カメラはオプション「道の奥行き」(roadDepth)で選べる。既定は「いまの」で、保存値に無い人もいまのまま
check('オプション「道の奥行き」は既定が「いまの」で、知らない値も「いまの」に戻す',/roadDepth:'NORMAL'/.test(settingsSrc)&&/roadDepth:RHYTHM_ROAD_DEPTH_LEVELS\.includes\(source\.roadDepth\)\?source\.roadDepth:DEFAULT_RHYTHM_SETTINGS\.roadDepth/.test(settingsSrc));
check('試作の値 c3b でも寝かせる(デバッグ)',/const rhythmCameraDeepActive=\(\)=>rhythmFloor3dPreference\(\)==='c3b';/.test(data));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
