from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    return text.replace(old, new, 1)

# 1) Put the batch matcher in the rhythm data layer so the gameplay code and tests share one implementation.
data_path = Path('monster-hero/data/rhythm-mode.js')
data = data_path.read_text()
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

# 2) Make the play engine consume simultaneous starts/ends as batches and use native non-passive Touch Events.
src_path = Path('monster-hero/src/game-system.jsx')
src = src_path.read_text()
old_block = """  const inputStart=(lane,inputKey,captureTarget,pointerId)=>{const run=runRef.current;if(!run||run.finished||run.paused||view.status!=='playing')return;const now=run.audio.songTimeMs(),target=run.notes.filter(note=>!note.done&&note.activePointerId===null&&(note.type==='TAP'||note.type==='HOLD')&&note.lane===lane&&Math.abs(now-(note.timeMs+settings.judgmentTimingOffsetMs))<=200).sort((a,b)=>Math.abs(now-(a.timeMs+settings.judgmentTimingOffsetMs))-Math.abs(now-(b.timeMs+settings.judgmentTimingOffsetMs)))[0];if(!target)return;const delta=now-(target.timeMs+settings.judgmentTimingOffsetMs),judgment=rhythmJudgeTap(delta);if(target.type==='HOLD'){target.activePointerId=inputKey;target.holdJudgment=judgment;target.holdDeltaMs=delta;run.activePointers.set(inputKey,target.index);if(captureTarget&&pointerId!==undefined){try{captureTarget.setPointerCapture(pointerId);}catch{}}const side=rhythmFastSlow(delta);setView(v=>({...v,last:'HOLD',fastSlow:side||''}));return;}applyJudgment(target,judgment,delta);};
  const inputEnd=(inputKey,releaseTarget,pointerId)=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const noteIndex=run.activePointers.get(inputKey);if(noteIndex===undefined)return;run.activePointers.delete(inputKey);const note=run.notes[noteIndex];if(!note||note.done)return;note.activePointerId=null;const now=run.audio.songTimeMs(),holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;if(now<holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS)applyJudgment(note,'MISS',now-holdEndMs);else applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);if(releaseTarget&&pointerId!==undefined){try{if(releaseTarget.hasPointerCapture?.(pointerId))releaseTarget.releasePointerCapture(pointerId);}catch{}}};
  const pointerDown=(lane,e)=>{if(e.pointerType==='touch')return;e.preventDefault();inputStart(lane,rhythmInputKey('pointer',e.pointerId),e.currentTarget,e.pointerId);};
  const pointerEnd=e=>{if(e.pointerType==='touch')return;inputEnd(rhythmInputKey('pointer',e.pointerId),e.currentTarget,e.pointerId);};
  const touchStart=e=>{if(e.cancelable)e.preventDefault();const area=playAreaRef.current;if(!area)return;const rect=area.getBoundingClientRect();Array.from(e.changedTouches||[]).forEach(touch=>{const lane=rhythmLaneFromClientX(touch.clientX,rect.left,rect.width);if(lane!==null)inputStart(lane,rhythmInputKey('touch',touch.identifier));});};
  const touchEnd=e=>{if(e.cancelable)e.preventDefault();Array.from(e.changedTouches||[]).forEach(touch=>inputEnd(rhythmInputKey('touch',touch.identifier)));};
"""
new_block = """  const inputStarts=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs).forEach(({input,target,deltaMs})=>{if(!target)return;const judgment=rhythmJudgeTap(deltaMs);if(target.type==='HOLD'){target.activePointerId=input.inputKey;target.holdJudgment=judgment;target.holdDeltaMs=deltaMs;run.activePointers.set(input.inputKey,target.index);if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}const side=rhythmFastSlow(deltaMs);setView(v=>({...v,last:'HOLD',fastSlow:side||''}));return;}applyJudgment(target,judgment,deltaMs);});};
  const inputEnds=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();inputs.forEach(input=>{const noteIndex=run.activePointers.get(input.inputKey);if(noteIndex===undefined)return;run.activePointers.delete(input.inputKey);const note=run.notes[noteIndex];if(!note||note.done)return;note.activePointerId=null;const holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;if(now<holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS)applyJudgment(note,'MISS',now-holdEndMs);else applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);if(input.releaseTarget&&input.pointerId!==undefined){try{if(input.releaseTarget.hasPointerCapture?.(input.pointerId))input.releaseTarget.releasePointerCapture(input.pointerId);}catch{}}});};
  const pointerDown=e=>{if(e.pointerType==='touch')return;e.preventDefault();const area=playAreaRef.current;if(!area)return;const rect=area.getBoundingClientRect(),lane=rhythmLaneFromClientX(e.clientX,rect.left,rect.width);if(lane===null)return;inputStarts([{lane,inputKey:rhythmInputKey('pointer',e.pointerId),captureTarget:e.currentTarget,pointerId:e.pointerId}]);};
  const pointerEnd=e=>{if(e.pointerType==='touch')return;inputEnds([{inputKey:rhythmInputKey('pointer',e.pointerId),releaseTarget:e.currentTarget,pointerId:e.pointerId}]);};
  useEffect(()=>{const area=playAreaRef.current,run=runRef.current;if(!area||view.status==='result')return;const syncTouches=e=>{if(e.cancelable)e.preventDefault();const current=runRef.current;if(!current||current.finished||current.paused)return;current.activeTouchInputs=current.activeTouchInputs||new Set();const rect=area.getBoundingClientRect(),live=new Set(),starts=[];Array.from(e.touches||[]).forEach(touch=>{const inputKey=rhythmInputKey('touch',touch.identifier);live.add(inputKey);if(current.activeTouchInputs.has(inputKey))return;current.activeTouchInputs.add(inputKey);const lane=rhythmLaneFromClientX(touch.clientX,rect.left,rect.width);if(lane!==null)starts.push({lane,inputKey});});if(starts.length)inputStarts(starts);const ended=[];Array.from(current.activeTouchInputs).forEach(inputKey=>{if(!live.has(inputKey)){current.activeTouchInputs.delete(inputKey);ended.push({inputKey});}});if(ended.length)inputEnds(ended);};area.addEventListener('touchstart',syncTouches,{passive:false});area.addEventListener('touchmove',syncTouches,{passive:false});area.addEventListener('touchend',syncTouches,{passive:false});area.addEventListener('touchcancel',syncTouches,{passive:false});return()=>{area.removeEventListener('touchstart',syncTouches);area.removeEventListener('touchmove',syncTouches);area.removeEventListener('touchend',syncTouches);area.removeEventListener('touchcancel',syncTouches);};},[view.status]);
"""
src = replace_once(src, old_block, new_block, 'input handler block')

# Native touch tracking needs lifecycle cleanup alongside HOLD pointer cleanup.
src = src.replace('activePointers:new Map(),combo:0', 'activePointers:new Map(),activeTouchInputs:new Set(),combo:0')
src = src.replace('run.activePointers=new Map();run.combo=0', 'run.activePointers=new Map();run.activeTouchInputs=new Set();run.combo=0')
src = src.replace('run.activePointers.clear();run.notes.forEach', 'run.activePointers.clear();run.activeTouchInputs?.clear();run.notes.forEach')
src = src.replace('run.activePointers.clear();run.audio?.stop();', 'run.activePointers.clear();run.activeTouchInputs?.clear();run.audio?.stop();')

# Remove React synthetic touch handlers and route mouse/pen pointers through the single play surface.
old_open = "<div ref={playAreaRef} data-rhythm-play-area onTouchStart={touchStart} onTouchEnd={touchEnd} onTouchCancel={touchEnd} className=\"relative mx-2 mb-2 flex-1 min-h-0 overflow-hidden border-x border-cyan-400/50\""
new_open = "<div ref={playAreaRef} data-rhythm-play-area onPointerDown={pointerDown} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className=\"relative mx-2 mb-2 flex-1 min-h-0 overflow-hidden border-x border-cyan-400/50\""
src = replace_once(src, old_open, new_open, 'play area handlers')

old_lanes = "<div className=\"absolute inset-0 grid grid-cols-5\">{Array.from({length:5},(_,lane)=><button key={lane} aria-label={`レーン${lane+1}`} onPointerDown={e=>pointerDown(lane,e)} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className=\"relative border-r border-white/20 bg-slate-900/40 active:bg-cyan-800/50\" style={{touchAction:'none'}}><span className=\"absolute bottom-[9%] left-1/2 -translate-x-1/2 text-xs text-slate-500\">{lane+1}</span></button>)}</div>"
new_lanes = "<div className=\"pointer-events-none absolute inset-0 grid grid-cols-5\">{Array.from({length:5},(_,lane)=><div key={lane} aria-hidden=\"true\" className=\"relative border-r border-white/20 bg-slate-900/40\"><span className=\"absolute bottom-[9%] left-1/2 -translate-x-1/2 text-xs text-slate-500\">{lane+1}</span></div>)}</div>"
src = replace_once(src, old_lanes, new_lanes, 'lane input buttons')
src_path.write_text(src)

# 3) Behavioral check: exercise the actual data-layer batch matcher, not just source strings.
check = r'''const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const data=fs.readFileSync('monster-hero/data/rhythm-mode.js','utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(data,ctx);
const match=(notes,inputs,now=1000)=>vm.runInContext(`rhythmMatchInputBatch(${JSON.stringify(notes)},${JSON.stringify(inputs)},${now},0).map(x=>({key:x.input&&x.input.inputKey,lane:x.target&&x.target.lane,type:x.target&&x.target.type,delta:x.deltaMs}))`,ctx);
const n=(type,lane,index,timeMs=1000,extra={})=>({type,lane,index,timeMs,done:false,activePointerId:null,...extra});
let out=match([n('TAP',0,0),n('TAP',4,1)],[{lane:0,inputKey:'touch:1'},{lane:4,inputKey:'touch:2'}]);
assert.deepStrictEqual(out.map(x=>x.lane),[0,4],'two simultaneous TAPs must both match');
out=match([n('TAP',0,0),n('TAP',4,1)],[{lane:4,inputKey:'touch:2'},{lane:0,inputKey:'touch:1'}]);
assert.deepStrictEqual(out.map(x=>x.lane),[4,0],'reversed input order must still match both');
out=match([n('HOLD',0,0,1000,{endTimeMs:1800}),n('HOLD',4,1,1000,{endTimeMs:1800})],[{lane:0,inputKey:'touch:1'},{lane:4,inputKey:'touch:2'}]);
assert.deepStrictEqual(out.map(x=>x.type),['HOLD','HOLD'],'two simultaneous HOLD starts must both match');
out=match([n('HOLD',0,0,1000,{endTimeMs:1800}),n('TAP',4,1)],[{lane:0,inputKey:'touch:1'},{lane:4,inputKey:'touch:2'}]);
assert.deepStrictEqual(out.map(x=>x.type),['HOLD','TAP'],'HOLD + TAP must both match');
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
Path('tools/mode/rhythm-mode-simultaneous-input-check.js').write_text(check)
