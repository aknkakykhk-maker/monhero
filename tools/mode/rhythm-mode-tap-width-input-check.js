#!/usr/bin/env node
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('monster-hero/data/rhythm-mode.js','utf8');
const laneSvg=fs.readFileSync('monster-hero/data/rhythm-lane-svg.js','utf8');
const calibration=fs.readFileSync('monster-hero/data/rhythm-geometry-calibration.js','utf8');
const indexHtml=fs.readFileSync('monster-hero/index.html','utf8');
const game=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
const run=code=>vm.runInContext(code,ctx);
const note=(subLane,subLaneWidth,index=0,extra={})=>({type:'TAP',timeMs:1000,lane:Math.floor(subLane/2),subLane,subLaneWidth,index,done:false,activePointerId:null,...extra});
const match=(notes,inputs)=>run(`rhythmMatchInputBatch(${JSON.stringify(notes)},${JSON.stringify(inputs)},1000,0).map(x=>x.target&&x.target.index)`);
const input=(subLaneCoordinate,key='touch:1')=>({lane:Math.max(0,Math.min(4,Math.floor(subLaneCoordinate/2))),subLaneCoordinate,inputKey:key});
const close=(a,b)=>Math.abs(Number(a)-Number(b))<1e-10;
assert.deepEqual(match([note(4,1)],[input(4.5)]),[0],'幅1中央');
for(const width of [2,3,4]) assert.deepEqual(match([note(3,width)],[input(3+width-.01)]),[0],`幅${width}内側`);
// 入力側の余白(2026-09-05に2回ゆるくした)。見えている帯のふちギリギリを押しても取れるが、
// その外は取れない。幅1以外は .60 サブレーン、幅1は .45 サブレーン。
// 幅1だけ据え置きなのは、幅1どうしが隣り合うと帯のふちから隣の中心まで0.5しかないため。
assert.deepEqual(match([note(3,2)],[input(2.45)]),[0],'幅2の余白の内側なら取れる');
assert.deepEqual(match([note(3,2)],[input(2.35)]),[null],'幅2の余白より外は取れない');
assert.deepEqual(match([note(0,1)],[input(.5)]),[0],'左端');
assert.deepEqual(match([note(9,1)],[input(9.5)]),[0],'右端');
assert.deepEqual(match([note(4,1)],[input(3.6)]),[0],'幅1の最小タッチ許容内');
// 隣に幅1のノーツが並ぶとき、その中心はサブレーン3.5にある。
// 余白がそこまで届くと「隣を狙ったのにこちらが取れる」ので、3.5では取れないこと。
assert.deepEqual(match([note(4,1)],[input(3.5)]),[null],'細ノーツ許容を隣の中心までは広げない');
assert.strictEqual(match([note(4,1,0),note(5,1,1)],[input(5)]).filter(x=>x!==null).length,1,'1入力1ノーツ');
assert.deepEqual(match([note(4,1,0),note(5,1,1)],[input(4.5,'touch:1'),input(5.5,'touch:2')]),[0,1],'別指同時取得');
// 判定の優先順は「時刻を過ぎたノーツが先 → 時間差 → 位置差」。
// 2026-09-05 に、時間差の**絶対値**だけで選ぶのをやめた。
// 絶対値だと、次のノーツとの間隔の半分を超えて遅れた瞬間に判定が次へ移ってしまい、
// 狙ったノーツと違うものが取れていたため(ユーザー指摘)。
// ここは now=1000 に対し 1100(まだ来ていない)と 900(過ぎている)で時間差が同じ100msのケース。
// 過ぎているほうを先に見るので 900 のノーツ(index 1)が取れる。
assert.deepEqual(match([
  {type:'TAP',timeMs:1100,lane:2,index:0,done:false,activePointerId:null},
  {type:'TAP',timeMs:900,lane:2,index:1,done:false,activePointerId:null},
],[{lane:2,inputKey:'touch:tie'}]),[1],'時間差が同じなら、時刻を過ぎているノーツを先に取る');
// 過ぎたノーツどうしなら、時刻が**遅いほう(＝後ろのノーツ)**を取る。
// ここは2026-09-05に2回直している。
//   1回目 … 時間差の絶対値で選ぶ → 遅れて叩くと、まだ来ていない次のノーツへ移る
//   2回目 … 過ぎている中で「前のほう」を取る → 今度は後ろのノーツを巻き込み、
//           2つめの時刻ちょうどで叩いても1つめが取られて2つめが必ずMISSになる
//           (ユーザー指摘「あとのノーツを巻き込んでる」)
// いまは「過ぎている中でいちばん後ろ」。1つのノーツが取られるのは次のノーツの時刻が
// 来るまでで、そこから先は次のノーツのものになる。
// 詳しくは tools/mode/rhythm-near-note-match-check.js
assert.deepEqual(match([
  {type:'TAP',timeMs:800,lane:2,index:0,done:false,activePointerId:null},
  {type:'TAP',timeMs:950,lane:2,index:1,done:false,activePointerId:null},
],[{lane:2,inputKey:'touch:both-late'}]),[1],'過ぎたノーツが2つなら後ろのほうを取る(前を巻き込まない)');
// まだ来ていないノーツしか無ければ、そのなかで近いほうを取る(早押し)
assert.deepEqual(match([
  {type:'TAP',timeMs:1200,lane:2,index:0,done:false,activePointerId:null},
  {type:'TAP',timeMs:1050,lane:2,index:1,done:false,activePointerId:null},
],[{lane:2,inputKey:'touch:both-early'}]),[1],'まだ来ていないノーツが2つなら近いほうを取る');
assert.deepEqual(match([
  {type:'TAP',timeMs:1080,lane:2,index:0,done:false,activePointerId:null},
  {type:'TAP',timeMs:950,lane:2,index:1,done:false,activePointerId:null},
],[{lane:2,inputKey:'touch:nearest'}]),[1],'判定時刻に近いノーツを優先する');
assert.deepEqual(match([
  {type:'TAP',timeMs:1000,lane:2,subLane:4,subLaneWidth:4,index:0,done:false,activePointerId:null},
  {type:'TAP',timeMs:1000,lane:1,subLane:3,subLaneWidth:4,index:1,done:false,activePointerId:null},
],[input(5.1,'touch:spatial')]),[1],'時刻差が同じなら入力位置に近いノーツを優先する');
assert.deepEqual(match([
  {type:'TAP',timeMs:1100,lane:2,index:0,done:false,activePointerId:null},
  {type:'TAP',timeMs:900,lane:2,index:1,done:false,activePointerId:null},
  {type:'TAP',timeMs:1000,lane:2,index:2,done:false,activePointerId:null},
// 時刻順でない譜面では二分探索の絞り込みが使えないので、全範囲を見る経路へ落ちる。
// そのうえで選び方は同じ(過ぎているノーツのうち、いちばん時刻が遅いもの＝1000ms)
],[{lane:2,inputKey:'touch:unsorted'}]),[2],'時刻順でない譜面も全範囲fallbackして同じ選び方で拾う');
assert(source.includes('const RHYTHM_INPUT_MATCH_META=new WeakMap();')&&source.includes('const rhythmInputMatchBounds=(source,now,offset)=>')&&!source.includes('source.map((note,index)=>({note,index})).filter'),'入力ごとの全ノーツmap/filter/sortを廃止して候補時刻窓へ絞る');
const matchReads=run(`(()=>{let reads=0;const notes=Array.from({length:400},(_,i)=>{const n={type:'TAP',lane:2,index:i,done:false,activePointerId:null};Object.defineProperty(n,'timeMs',{get(){reads++;return i*100;}});return n;});rhythmMatchInputBatch(notes,[{lane:2,inputKey:'touch:perf'}],20000,0);reads=0;rhythmMatchInputBatch(notes,[{lane:2,inputKey:'touch:perf2'}],20000,0);return reads;})()`);
assert(matchReads<80,`昇順400ノーツの2回目入力は±200ms周辺だけを見る reads=${matchReads}`);
assert.deepEqual(match([{type:'TAP',timeMs:1000,lane:2,index:0,done:false,activePointerId:null}],[{lane:2,inputKey:'touch:1'}]),[0],'旧5レーンTAP互換');
for(const y of [.05,.5,.88,1]) for(const sub of [.1,2.5,5.5,9.9]){
  const rect={left:10,top:20,width:400,height:800},left=run(`rhythmProjectBoundary(0,${y})`),right=run(`rhythmProjectBoundary(5,${y})`),x=rect.left+rect.width*(left+(right-left)*sub/10),cy=rect.top+rect.height*y;
  const actual=run(`rhythmSubLaneCoordinateAtPoint(${x},${cy},${JSON.stringify(rect)})`);
  assert(Math.abs(actual-sub)<1e-9,'描画projectionと入力逆変換');
}
for(const y of [0,.2,.5,.88,1]) for(let lane=0;lane<5;lane++){
  const main=run(`rhythmProjectLane(${lane},${y})`),sub=run(`rhythmProjectSubLaneSpan(${lane*2},2,${y})`);
  assert(close(main.left,sub.left)&&close(main.right,sub.right)&&close(main.center,sub.center),`5レーンと10サブレーン幅2が同一projection lane=${lane} y=${y}`);
}
for(const y of [0,.25,.5,.88,1]) for(let subLane=0;subLane<10;subLane++){
  const span=run(`rhythmProjectSubLaneSpan(${subLane},1,${y})`),left=run(`rhythmProjectBoundary(${subLane/2},${y})`),right=run(`rhythmProjectBoundary(${(subLane+1)/2},${y})`);
  assert(close(span.left,left)&&close(span.right,right),`幅1ノーツ端とサブレーン境界が一致 sub=${subLane} y=${y}`);
}
assert(calibration.includes("dataset.rhythmGeometryCalibration='ready'")&&calibration.includes("toggle.dataset.rhythmCalibrationToggle=placement")&&calibration.includes("'data-rhythm-calibration-guide':''"),'座標校正トグルとガイドをデバッグ専用レイヤーへ実装');
assert(calibration.includes('rhythmProjectBoundary(boundary/2,0)')&&calibration.includes('rhythmProjectSubLaneSpan(sample.subLane,sample.width,y)')&&calibration.includes('rhythmProjectSlideSpan(sample.lane,note,y,0)'),'校正ガイドはレーン・可変幅・SLIDEの共通projection helperだけを使用');
assert(calibration.includes("{subLane:0,width:1")&&calibration.includes("{subLane:2,width:2")&&calibration.includes("{subLane:4,width:3")&&calibration.includes("{subLane:6,width:4"),'TAP/HOLD/FLICK幅1〜4の基準帯を表示');
assert(calibration.includes("{lane:.5,width:1")&&calibration.includes("{lane:1.5,width:2")&&calibration.includes("{lane:2.5,width:3")&&calibration.includes("{lane:3.5,width:4"),'SLIDE half-lane幅1〜4の基準帯を表示');
assert(calibration.includes("for(let subLane=0;subLane<10;subLane++)")&&calibration.includes('rhythmProjectSubLaneSpan(subLane,1,judgeY)'),'判定ライン上の10サブレーン中心を同じprojectionで表示');
assert(indexHtml.includes('data/rhythm-geometry-calibration.js?v='),'座標校正ガイドを起動経路へ登録');
assert(calibration.includes("const label=enabled?'座標校正 ON':'座標校正';")&&calibration.includes('if(toggle.textContent!==label)toggle.textContent=label;')&&!calibration.includes("toggle.textContent=enabled?'座標校正 ON':'座標校正';"),'MutationObserver監視中は同じボタン文字を再代入せず自己ループを防止');
const touchRect={left:0,top:0,width:400,height:800};
const centerX=run(`rhythmProjectBoundary(2.25,1)`)*touchRect.width;
const contact=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${centerX},clientY:800,radiusX:45},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(contact.subLanes),[3,4,5],'Touch.radiusXを70%へ縮小してprojectionへ通す');
const narrowedContact=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${centerX},clientY:800,radiusX:25},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(narrowedContact.subLanes),[4],'通常の細い接触は中心1サブレーン');
const boundaryX=run(`rhythmProjectBoundary(2.5,1)`)*touchRect.width;
const slightOverlap=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${boundaryX-10},clientY:800,radiusX:25},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(slightOverlap.subLanes),[4],'隣接サブレーンへの20%未満のはみ出しは拾わない');
const solidOverlap=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${boundaryX-5},clientY:800,radiusX:25},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(solidOverlap.subLanes),[4,5],'隣接サブレーンへ20%以上重なれば接触扱い');
const broadContact=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${centerX},clientY:800,radiusX:100},${JSON.stringify(touchRect)})`);
assert(broadContact.subLanes.length>3,'十分広い実接触は固定3サブレーン上限なしで反映');
const fallback=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${centerX},clientY:800,radiusX:0},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(fallback.subLanes),[4],'接触幅なしは中心1サブレーンへfallback');
const invalidFallback=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${centerX},clientY:800,radiusX:'invalid'},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(invalidFallback.subLanes),[4],'不正なradiusXも中心1サブレーンへfallback');
const hugeContact=run(`RHYTHM_TOUCH_SPAN_RUNTIME.contactsForTouch({clientX:${centerX},clientY:800,radiusX:9999},${JSON.stringify(touchRect)})`);
assert.deepEqual(Array.from(hugeContact.subLanes),[4],'異常に大きいradiusXは中心1サブレーンへfallback');
assert(source.includes('RHYTHM_TOUCH_RADIUS_SCALE=.70')&&source.includes('RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE=.20')&&source.includes('overlap>=RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE')&&!source.includes('subLanes.length>3'),'接触半径70%補正・隣接20%重なり条件・固定3上限なし');
assert(source.includes('candidateEntered=next.subLanes.filter(lane=>!previousSet.has(lane))')&&source.includes('radiusExpansionAccepted(acceptedRadiusX,rawRadiusX)'),'touchmoveは新規接触とradius拡張を分離判定');
const stableMove=run(`RHYTHM_TOUCH_SPAN_RUNTIME._stabilizedMoveTouch({centerAnchorX:${centerX}},{clientX:${centerX+4},clientY:800,radiusX:27},${JSON.stringify(touchRect)})`);
assert.strictEqual(stableMove.centerMoved,false,'指腹変形による数pxの中心揺れは移動扱いにしない');
assert(Math.abs(stableMove.touch.clientX-centerX)<1e-9,'微小中心揺れでは元の中心位置を維持');
const realMove=run(`RHYTHM_TOUCH_SPAN_RUNTIME._stabilizedMoveTouch({centerAnchorX:${centerX}},{clientX:${centerX+12},clientY:800,radiusX:27},${JSON.stringify(touchRect)})`);
assert.strictEqual(realMove.centerMoved,true,'明確な横移動は従来どおり追従');
assert(source.includes('if(isStart||centerChanged||entered.length)actions.push')&&!source.includes('centerChanged||stabilized.centerMoved||entered.length'),'中心だけ動いて新規ラインなしの時は空入力グループを作らない');
assert.strictEqual(run(`RHYTHM_TOUCH_SPAN_RUNTIME._radiusExpansionAccepted(25,27)`),false,'radiusXの小さな揺れは追加TAPにしない');
assert.strictEqual(run(`RHYTHM_TOUCH_SPAN_RUNTIME._radiusExpansionAccepted(25,29)`),true,'指の腹を明確に広げた時は追加接触を許可');
assert(!laneSvg.includes("window.addEventListener('touchmove'")&&!laneSvg.includes('installTouchSpanMoveGuard'),'旧window幅同期ガードを撤去してruntimeへ一元化');
assert(laneSvg.includes('[data-rhythm-lane-svg]{position:absolute;inset:0;width:100%;height:100%;z-index:1')&&laneSvg.includes('[data-rhythm-sublane-feedback]{z-index:2!important}')&&laneSvg.includes('[data-rhythm-note]{z-index:4}'),'10サブレーン発光をSVGレーンより上・ノーツより下へ表示');
run(`['pointer:910001','pointer:910002','pointer:910003','pointer:910004'].forEach(key=>RHYTHM_TOUCH_SPAN_RUNTIME._syntheticTapKeys.add(key))`);
assert.deepEqual(match([note(3,1,0),note(4,1,1),note(5,1,2)],[input(3.5,'pointer:910001'),input(4.5,'pointer:910002'),input(5.5,'pointer:910003')]),[0,1,2],'1本指接触幅のTAP専用入力で幅1×3を同時取得');
assert.strictEqual(match([note(3,3,0)],[input(3.5,'pointer:910001'),input(4.5,'pointer:910002'),input(5.5,'pointer:910003')]).filter(x=>x!==null).length,1,'幅2〜4の同一TAPを接触幅で重複取得しない');
assert.deepEqual(match([{type:'HOLD',timeMs:1000,lane:2,subLane:4,subLaneWidth:1,index:0,done:false,activePointerId:null}],[input(4.5,'pointer:910004')]),[null],'接触幅の追加入力はHOLD/SLIDE/FLICKを横取りしない');
assert(source.includes("id==='EASY'?widthTestChart")&&/\[7200,4,1\],\[7200,5,1\]/.test(source)&&/\[11200,3,1\],\[11200,4,1\],\[11200,5,1\]/.test(source),'WIDTH TEST譜面');
assert(game.includes('subLaneCoordinate=rhythmSubLaneCoordinateAtPoint')&&game.includes('{lane,subLaneCoordinate,inputKey'),'Touch/Pointerが実座標を渡す');
assert(source.includes("note?.type==='TAP'||note?.type==='HOLD'")&&source.includes('return note.lane===lane'),'HOLD可変幅・FLICK/SLIDE回帰');
assert(source.includes('rhythmReleaseTargetMs')&&source.includes('data-rhythm-end-bar'),'ENDバー回帰');
console.log('OK: 10サブレーン可変幅TAP入力・表示座標校正ガイド・Observer自己ループ防止・接触半径70%補正・隣接20%重なり条件・指腹拡張追従・中心揺れデッドゾーン・固定3上限なし・異常radius fallback・押しっぱなし回帰防止・発光レイヤー・旧譜面・projection回帰');
