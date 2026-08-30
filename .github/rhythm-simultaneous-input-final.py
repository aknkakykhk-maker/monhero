from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    return text.replace(old, new, 1)


# 1) rhythm-mode.js: PR #871 の疑似PointerEvent bridgeを外し、同時入力を原子的に割り当てる純粋関数へ置換。
data_path = Path('monster-hero/data/rhythm-mode.js')
data = data_path.read_text()
bridge_marker = '// iPhone Safariの同時押し検証用。\n'
if data.count(bridge_marker) != 1:
    raise SystemExit(f'native bridge marker: expected 1 occurrence, got {data.count(bridge_marker)}')
data = data.split(bridge_marker, 1)[0].rstrip() + '\n'
anchor = "const RHYTHM_SCORE_WEIGHTS = Object.freeze({ judgment:.9, combo:.1 });\n"
helper = """const RHYTHM_SCORE_WEIGHTS = Object.freeze({ judgment:.9, combo:.1 });
const rhythmMatchInputBatch=(notes,inputs,nowMs,offsetMs=0)=>{
  const source=Array.isArray(notes)?notes:[],claimed=new Set(),seenInputs=new Set(),now=Number(nowMs),offset=Number(offsetMs)||0;
  return (Array.isArray(inputs)?inputs:[]).map(input=>{
    const inputKey=String(input?.inputKey??'');
    if(!inputKey||seenInputs.has(inputKey))return {input,target:null,deltaMs:null};
    seenInputs.add(inputKey);
    const lane=Number(input?.lane);
    const candidates=source.map((note,index)=>({note,index})).filter(({note,index})=>!claimed.has(index)&&!note.done&&note.activePointerId===null&&(note.type==='TAP'||note.type==='HOLD')&&note.lane===lane&&Math.abs(now-(note.timeMs+offset))<=200).sort((a,b)=>Math.abs(now-(a.note.timeMs+offset))-Math.abs(now-(b.note.timeMs+offset))||a.index-b.index);
    const picked=candidates[0];
    if(!picked)return {input,target:null,deltaMs:null};
    claimed.add(picked.index);
    return {input,target:picked.note,deltaMs:now-(picked.note.timeMs+offset)};
  });
};
"""
data = replace_once(data, anchor, helper, 'rhythm batch helper')
data_path.write_text(data)


# 2) game-system.jsx: React synthetic TouchEvent + 1本ずつ判定をやめ、play area native TouchEventを一括処理。
src_path = Path('monster-hero/src/game-system.jsx')
src = src_path.read_text()
pattern = re.compile(r"  const inputStart=\(lane,inputKey,captureTarget,pointerId\)=>\{.*?\n  const touchEnd=e=>\{.*?\};\n", re.S)
match = pattern.search(src)
if not match:
    raise SystemExit('input handler block not found')
new_block = """  const inputStarts=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs).forEach(({input,target,deltaMs})=>{if(!target)return;const judgment=rhythmJudgeTap(deltaMs);if(target.type==='HOLD'){target.activePointerId=input.inputKey;target.holdJudgment=judgment;target.holdDeltaMs=deltaMs;run.activePointers.set(input.inputKey,target.index);if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}const side=rhythmFastSlow(deltaMs);setView(v=>({...v,last:'HOLD',fastSlow:side||''}));return;}applyJudgment(target,judgment,deltaMs);});};
  const inputEnds=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();inputs.forEach(input=>{const noteIndex=run.activePointers.get(input.inputKey);if(noteIndex===undefined)return;run.activePointers.delete(input.inputKey);const note=run.notes[noteIndex];if(!note||note.done)return;note.activePointerId=null;const holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;if(now<holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS)applyJudgment(note,'MISS',now-holdEndMs);else applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);if(input.releaseTarget&&input.pointerId!==undefined){try{if(input.releaseTarget.hasPointerCapture?.(input.pointerId))input.releaseTarget.releasePointerCapture(input.pointerId);}catch{}}});};
  const pointerDown=e=>{if(e.pointerType==='touch')return;e.preventDefault();const area=playAreaRef.current;if(!area)return;const rect=area.getBoundingClientRect(),lane=rhythmLaneFromClientX(e.clientX,rect.left,rect.width);if(lane===null)return;inputStarts([{lane,inputKey:rhythmInputKey('pointer',e.pointerId),captureTarget:e.currentTarget,pointerId:e.pointerId}]);};
  const pointerEnd=e=>{if(e.pointerType==='touch')return;inputEnds([{inputKey:rhythmInputKey('pointer',e.pointerId),releaseTarget:e.currentTarget,pointerId:e.pointerId}]);};
  useEffect(()=>{const area=playAreaRef.current;if(!area||view.status==='result')return;const syncTouches=e=>{if(e.cancelable)e.preventDefault();const current=runRef.current;if(!current||current.finished||current.paused)return;current.activeTouchInputs=current.activeTouchInputs||new Set();const rect=area.getBoundingClientRect(),live=new Set(),starts=[];Array.from(e.touches||[]).forEach(touch=>{const inputKey=rhythmInputKey('touch',touch.identifier);live.add(inputKey);if(current.activeTouchInputs.has(inputKey))return;current.activeTouchInputs.add(inputKey);const lane=rhythmLaneFromClientX(touch.clientX,rect.left,rect.width);if(lane!==null)starts.push({lane,inputKey});});if(starts.length)inputStarts(starts);const ended=[];Array.from(current.activeTouchInputs).forEach(inputKey=>{if(!live.has(inputKey)){current.activeTouchInputs.delete(inputKey);ended.push({inputKey});}});if(ended.length)inputEnds(ended);};area.addEventListener('touchstart',syncTouches,{passive:false});area.addEventListener('touchmove',syncTouches,{passive:false});area.addEventListener('touchend',syncTouches,{passive:false});area.addEventListener('touchcancel',syncTouches,{passive:false});return()=>{area.removeEventListener('touchstart',syncTouches);area.removeEventListener('touchmove',syncTouches);area.removeEventListener('touchend',syncTouches);area.removeEventListener('touchcancel',syncTouches);};},[view.status]);
"""
src = src[:match.start()] + new_block + src[match.end():]

# 各run lifecycleへactiveTouchInputsを追加。既存保存形式には影響しないランタイム状態のみ。
src, n = re.subn(r'activePointers:new Map\(\),combo:0', 'activePointers:new Map(),activeTouchInputs:new Set(),combo:0', src)
if n < 2:
    raise SystemExit(f'run init activeTouchInputs: expected >=2 replacements, got {n}')
src, n_restart = re.subn(r'run\.activePointers=new Map\(\);run\.combo=0', 'run.activePointers=new Map();run.activeTouchInputs=new Set();run.combo=0', src)
if n_restart != 1:
    raise SystemExit(f'restart activeTouchInputs: expected 1 replacement, got {n_restart}')
src, n_pause = re.subn(r'run\.activePointers\.clear\(\);run\.notes\.forEach', 'run.activePointers.clear();run.activeTouchInputs?.clear();run.notes.forEach', src)
if n_pause != 1:
    raise SystemExit(f'pause touch cleanup: expected 1 replacement, got {n_pause}')
src, n_abort = re.subn(r'run\.activePointers\.clear\(\);run\.audio\?\.stop\(\);', 'run.activePointers.clear();run.activeTouchInputs?.clear();run.audio?.stop();', src)
if n_abort != 1:
    raise SystemExit(f'abort touch cleanup: expected 1 replacement, got {n_abort}')

old_open = '<div ref={playAreaRef} data-rhythm-play-area onTouchStart={touchStart} onTouchEnd={touchEnd} onTouchCancel={touchEnd} className="relative mx-2 mb-2 flex-1 min-h-0 overflow-hidden border-x border-cyan-400/50"'
new_open = '<div ref={playAreaRef} data-rhythm-play-area onPointerDown={pointerDown} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className="relative mx-2 mb-2 flex-1 min-h-0 overflow-hidden border-x border-cyan-400/50"'
src = replace_once(src, old_open, new_open, 'play area input handlers')
old_lanes = '<div className="absolute inset-0 grid grid-cols-5">{Array.from({length:5},(_,lane)=><button key={lane} aria-label={`レーン${lane+1}`} onPointerDown={e=>pointerDown(lane,e)} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className="relative border-r border-white/20 bg-slate-900/40 active:bg-cyan-800/50" style={{touchAction:\'none\'}}><span className="absolute bottom-[9%] left-1/2 -translate-x-1/2 text-xs text-slate-500">{lane+1}</span></button>)}</div>'
new_lanes = '<div className="pointer-events-none absolute inset-0 grid grid-cols-5">{Array.from({length:5},(_,lane)=><div key={lane} aria-hidden="true" className="relative border-r border-white/20 bg-slate-900/40"><span className="absolute bottom-[9%] left-1/2 -translate-x-1/2 text-xs text-slate-500">{lane+1}</span></div>)}</div>'
src = replace_once(src, old_lanes, new_lanes, 'lane input surface')
src_path.write_text(src)


# 3) foundation checkからPR #871固有bridge検査だけを外す。基盤検査本来の責務へ戻す。
foundation_path = Path('tools/mode/rhythm-mode-foundation-check.js')
foundation = foundation_path.read_text()
start = foundation.find('const touchHandlers={};\n')
end = foundation.find('const logic=game.match/', start)
if start < 0 or end < 0:
    raise SystemExit('foundation native bridge test block not found')
foundation = foundation[:start] + foundation[end:]
foundation_path.write_text(foundation)


# 4) HOLD check: 新batch入力構造に追従。
hold_check = r'''#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const context={};vm.runInNewContext(`${data}\nthis.out={RHYTHM_SONGS};`,context);const song=context.out.RHYTHM_SONGS[0],easy=song.difficulties.EASY,normal=song.difficulties.NORMAL;
check('EASYのSTEP 2 TAP専用譜面を維持',easy.notes.length>0&&easy.notes.every(n=>n.type==='TAP'));
check('NORMALに20〜30秒のTAP/HOLD混在譜面',normal.durationMs>=20000&&normal.durationMs<=30000&&normal.notes.some(n=>n.type==='TAP')&&normal.notes.some(n=>n.type==='HOLD')&&normal.notes.every(n=>n.type==='TAP'||n.type==='HOLD'));
const holds=normal.notes.filter(n=>n.type==='HOLD');
check('HOLDは開始より後のendTimeMsと有効レーンを持つ',holds.length>=5&&holds.every(n=>Number.isFinite(n.endTimeMs)&&n.endTimeMs>n.timeMs&&n.endTimeMs<=normal.durationMs&&n.lane>=0&&n.lane<5));
check('HOLD中の別レーンTAPを含む',holds.some(h=>normal.notes.some(n=>n.type==='TAP'&&n.timeMs>h.timeMs&&n.timeMs<h.endTimeMs&&n.lane!==h.lane)));
check('同時2本HOLDを含む',holds.some((a,i)=>holds.some((b,j)=>j>i&&a.timeMs===b.timeMs&&a.lane!==b.lane)));
check('HOLD開始はTAPと同じ判定幅を使い、完了時に1ノーツとして確定',game.includes("target.type==='HOLD'")&&game.includes('target.holdJudgment=judgment')&&game.includes("applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0)"));
check('終端到達でHOLDを自動確定',game.includes("note.type==='HOLD'&&note.activePointerId!==null&&songTimeMs>=note.endTimeMs+settings.judgmentTimingOffsetMs"));
check('終端100ms手前より早い離しはMISS',game.includes('const RHYTHM_HOLD_RELEASE_GRACE_MS=100')&&game.includes('now<holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS')&&game.includes("applyJudgment(note,'MISS',now-holdEndMs)"));
check('入力ID別Mapで複数入力を独立管理',game.includes('activePointers:new Map()')&&game.includes('run.activePointers.set(input.inputKey,target.index)')&&game.includes('run.activePointers.get(input.inputKey)'));
check('HOLD表示は専用ボディを持ち、rAF内transform/opacity中心',game.includes('data-rhythm-hold-body')&&game.includes("--rhythm-hold-body")&&game.includes('translate3d(0,${Math.round(yPx)}px,0)')&&game.includes('requestAnimationFrame(tick)'));
check('ポーズ・リスタート・中断で入力管理を残さない',game.includes('run.activePointers.clear();run.activeTouchInputs?.clear();run.notes.forEach')&&game.includes('run.activePointers=new Map();run.activeTouchInputs=new Set();run.combo=0')&&game.includes('run.finished=true;run.paused=true;run.activePointers.clear();run.activeTouchInputs?.clear();run.audio?.stop()'));
check('FLICK/SLIDEはSTEP 3Aの実譜面へ入れない',normal.notes.every(n=>!['FLICK','SLIDE'].includes(n.type)));
check('通常公開はOFF',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
'''
Path('tools/mode/rhythm-mode-hold-engine-check.js').write_text(hold_check)


# 5) iPhone native multitouch経路の静的回帰。
multitouch_check = r'''#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const game=read('monster-hero/src/game-system.jsx'),data=read('monster-hero/data/rhythm-mode.js');
const helper=game.match(/const rhythmInputKey=[\s\S]*?\n};\nconst RhythmTapTest/)?.[0]?.replace(/\nconst RhythmTapTest$/,'');
check('タッチ入力ヘルパーを抽出できる',!!helper);
if(helper){const c={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmInputKey,rhythmLaneFromClientX};`,c);const L=c.out;
  check('入力IDはtouch/pointerで衝突しない',L.rhythmInputKey('touch',7)==='touch:7'&&L.rhythmInputKey('pointer',7)==='pointer:7');
  check('5レーン境界をplay area幅から算出',L.rhythmLaneFromClientX(0,0,500)===0&&L.rhythmLaneFromClientX(99.9,0,500)===0&&L.rhythmLaneFromClientX(100,0,500)===1&&L.rhythmLaneFromClientX(499,0,500)===4&&L.rhythmLaneFromClientX(500,0,500)===4);
  check('範囲外座標を安全に端レーンへ丸める',L.rhythmLaneFromClientX(-50,0,500)===0&&L.rhythmLaneFromClientX(900,0,500)===4&&L.rhythmLaneFromClientX(0,0,0)===null);
}
check('PR #871の疑似Pointer bridgeを残さない',!data.includes('installRhythmNativeMultitouchBridge')&&!data.includes('__mhRhythmNativeTouchBridgeInstalled'));
check('同時入力はbatch matcherを使う',data.includes('const rhythmMatchInputBatch=')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('inputStarts(starts)'));
check('iPhone向けnative Touch Eventsをpassive:falseでplay areaへ直接登録',game.includes("addEventListener('touchstart',syncTouches,{passive:false})")&&game.includes("addEventListener('touchmove',syncTouches,{passive:false})")&&game.includes("addEventListener('touchend',syncTouches,{passive:false})")&&game.includes("addEventListener('touchcancel',syncTouches,{passive:false})"));
check('touches全体を同期し各touch.identifierを独立管理',game.includes('Array.from(e.touches||[])')&&game.includes("rhythmInputKey('touch',touch.identifier)")&&game.includes('activeTouchInputs'));
check('同時に始まった複数指を1batchで判定',game.includes('const rect=area.getBoundingClientRect(),live=new Set(),starts=[]')&&game.includes('if(starts.length)inputStarts(starts)'));
check('同時に離れた複数指も1batchで終了',game.includes('const ended=[]')&&game.includes('if(ended.length)inputEnds(ended)'));
check('Touch由来PointerEventの二重処理を防ぐ',game.includes("if(e.pointerType==='touch')return")&&(game.match(/if\(e\.pointerType==='touch'\)return/g)||[]).length>=2);
check('各指のclientXから個別レーンを判定',game.includes('rhythmLaneFromClientX(touch.clientX,rect.left,rect.width)'));
check('レーン表示は入力面を分断しない非操作div',game.includes('pointer-events-none absolute inset-0 grid grid-cols-5')&&!game.includes('onTouchStart={touchStart}'));
check('ノーツ描画もタッチ面を遮らない',game.includes("pointerEvents:'none'"));
check('play areaでブラウザ既定ジェスチャを抑止',game.includes("touchAction:'none'")&&game.includes("WebkitTouchCallout:'none'"));
check('Pointer Eventsはマウス/ペン用フォールバックとして維持',game.includes("rhythmInputKey('pointer',e.pointerId)")&&game.includes('input.captureTarget.setPointerCapture(input.pointerId)'));
check('ポーズ/リスタート/中断でtouch IDもcleanup',game.includes('activeTouchInputs?.clear()')&&game.includes('activeTouchInputs:new Set()'));
check('通常公開はOFF',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
'''
Path('tools/mode/rhythm-mode-multitouch-check.js').write_text(multitouch_check)


# 6) 実際のbatch matcherを動かす挙動検査。
simultaneous_check = r'''#!/usr/bin/env node
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const data=fs.readFileSync('monster-hero/data/rhythm-mode.js','utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(data,ctx);
const match=(notes,inputs,now=1000)=>vm.runInContext(`rhythmMatchInputBatch(${JSON.stringify(notes)},${JSON.stringify(inputs)},${now},0).map(x=>({key:x.input&&x.input.inputKey,lane:x.target&&x.target.lane,type:x.target&&x.target.type,delta:x.deltaMs}))`,ctx);
const n=(type,lane,index,timeMs=1000,extra={})=>({type,lane,index,timeMs,done:false,activePointerId:null,...extra});
let out=match([n('TAP',0,0),n('TAP',4,1)],[{lane:0,inputKey:'touch:1'},{lane:4,inputKey:'touch:2'}]);
assert.deepEqual(out.map(x=>x.lane),[0,4],'two simultaneous TAPs must both match');
out=match([n('TAP',0,0),n('TAP',4,1)],[{lane:4,inputKey:'touch:2'},{lane:0,inputKey:'touch:1'}]);
assert.deepEqual(out.map(x=>x.lane),[4,0],'reversed input order must still match both');
out=match([n('HOLD',0,0,1000,{endTimeMs:1800}),n('HOLD',4,1,1000,{endTimeMs:1800})],[{lane:0,inputKey:'touch:1'},{lane:4,inputKey:'touch:2'}]);
assert.deepEqual(out.map(x=>x.type),['HOLD','HOLD'],'two simultaneous HOLD starts must both match');
out=match([n('HOLD',0,0,1000,{endTimeMs:1800}),n('TAP',4,1)],[{lane:0,inputKey:'touch:1'},{lane:4,inputKey:'touch:2'}]);
assert.deepEqual(out.map(x=>x.type),['HOLD','TAP'],'HOLD + TAP must both match');
out=match([n('TAP',2,0)],[{lane:2,inputKey:'touch:1'},{lane:2,inputKey:'touch:1'}]);
assert.strictEqual(out.filter(x=>x.lane!==null).length,1,'duplicate input id must not double-process');
out=match([n('TAP',2,0)],[{lane:2,inputKey:'touch:1'},{lane:2,inputKey:'touch:2'}]);
assert.strictEqual(out.filter(x=>x.lane!==null).length,1,'one note must not be claimed twice');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
assert(src.includes("addEventListener('touchstart',syncTouches,{passive:false})"),'native non-passive touchstart required');
assert(src.includes('Array.from(e.touches||[])'),'all currently active touches must be synchronized');
assert(src.includes('inputStarts(starts)'),'simultaneous starts must be submitted as one batch');
assert(src.includes('inputEnds(ended)'),'simultaneous ends must be submitted as one batch');
assert(src.includes('activeTouchInputs'),'active touch ids must be tracked independently');
assert(!src.includes('onTouchStart={touchStart}'),'React synthetic touch start must not remain on rhythm play area');
assert(src.includes('pointer-events-none absolute inset-0 grid grid-cols-5'),'lane visuals must not be interactive buttons');
console.log('OK: simultaneous rhythm input batch + native iPhone touch handling');
'''
Path('tools/mode/rhythm-mode-simultaneous-input-check.js').write_text(simultaneous_check)
