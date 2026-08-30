// 音ゲーモードの拡張用データ。音源そのものは既存 BGM_TRACKS を正本とし、trackId だけを参照する。
const RHYTHM_LANE_COUNT = 5;
const RHYTHM_NOTE_TYPES = Object.freeze(['TAP', 'HOLD', 'FLICK', 'SLIDE']);
const RHYTHM_DIFFICULTIES = Object.freeze([
  Object.freeze({ id:'EASY', maxScore:600000 }),
  Object.freeze({ id:'NORMAL', maxScore:700000 }),
  Object.freeze({ id:'HARD', maxScore:800000 }),
  Object.freeze({ id:'EXPERT', maxScore:900000 }),
  Object.freeze({ id:'MASTER', maxScore:1000000 }),
]);
const RHYTHM_JUDGMENTS = Object.freeze([
  Object.freeze({ id:'MARVELOUS', windowMs:25, scoreRate:1 }),
  Object.freeze({ id:'EXCELLENT', windowMs:50, scoreRate:.98 }),
  Object.freeze({ id:'GREAT', windowMs:100, scoreRate:.9 }),
  Object.freeze({ id:'GOOD', windowMs:150, scoreRate:.7 }),
  Object.freeze({ id:'BAD', windowMs:200, scoreRate:.3 }),
  Object.freeze({ id:'MISS', windowMs:null, scoreRate:0 }),
]);
const RHYTHM_SCORE_WEIGHTS = Object.freeze({ judgment:.9, combo:.1 });
const emptyRhythmChart = (level=0) => Object.freeze({ level, notes:Object.freeze([]), totalNotes:0 });
const atsuCupTapNotes = Object.freeze([
  [1800,2],[2600,0],[3200,4],[4000,1],[4400,3],[5200,2],[5800,2],[6400,0],[6400,4],
  [7200,1],[7600,2],[8000,3],[8800,0],[9200,4],[10000,2],[10600,1],[11200,3],[11800,0],
  [11800,4],[12600,2],[13000,1],[13400,0],[14200,3],[14600,4],[15000,2],[15800,0],[16200,1],
  [16600,2],[17000,3],[17400,4],[18200,1],[18200,3],[19000,0],[19400,2],[19800,4],[20600,2],
  [21200,1],[21600,3],[22200,0],[22200,4],[23000,2],[23400,1],[23800,3],[24600,0],[24600,4],
].map(([timeMs,lane])=>Object.freeze({type:'TAP',timeMs,lane})));
const atsuCupTapChart = Object.freeze({level:1,notes:atsuCupTapNotes,totalNotes:atsuCupTapNotes.length,durationMs:26000});

// STEP 3A: HOLDと複数指入力を検証するNORMAL専用テスト譜面。
// HOLD中の別レーンTAPと、同時2本HOLDを意図的に含める。
const atsuCupHoldTestNotes = Object.freeze([
  Object.freeze({type:'TAP',timeMs:1800,lane:2}),
  Object.freeze({type:'HOLD',timeMs:2600,endTimeMs:4000,lane:0}),
  Object.freeze({type:'TAP',timeMs:3200,lane:4}),
  Object.freeze({type:'TAP',timeMs:3600,lane:2}),
  Object.freeze({type:'TAP',timeMs:4600,lane:1}),
  Object.freeze({type:'HOLD',timeMs:5200,endTimeMs:6800,lane:3}),
  Object.freeze({type:'TAP',timeMs:5800,lane:0}),
  Object.freeze({type:'TAP',timeMs:6400,lane:4}),
  Object.freeze({type:'TAP',timeMs:7600,lane:2}),
  Object.freeze({type:'HOLD',timeMs:8400,endTimeMs:10000,lane:1}),
  Object.freeze({type:'TAP',timeMs:9000,lane:3}),
  Object.freeze({type:'TAP',timeMs:9600,lane:4}),
  Object.freeze({type:'HOLD',timeMs:11800,endTimeMs:13600,lane:0}),
  Object.freeze({type:'HOLD',timeMs:11800,endTimeMs:13600,lane:4}),
  Object.freeze({type:'TAP',timeMs:14200,lane:2}),
  Object.freeze({type:'HOLD',timeMs:15000,endTimeMs:16600,lane:3}),
  Object.freeze({type:'TAP',timeMs:15600,lane:0}),
  Object.freeze({type:'TAP',timeMs:16200,lane:1}),
  Object.freeze({type:'HOLD',timeMs:17400,endTimeMs:19000,lane:2}),
  Object.freeze({type:'TAP',timeMs:18000,lane:4}),
  Object.freeze({type:'TAP',timeMs:18600,lane:0}),
  Object.freeze({type:'HOLD',timeMs:19800,endTimeMs:21600,lane:1}),
  Object.freeze({type:'TAP',timeMs:20400,lane:3}),
  Object.freeze({type:'TAP',timeMs:21200,lane:4}),
  Object.freeze({type:'TAP',timeMs:22800,lane:0}),
  Object.freeze({type:'TAP',timeMs:23400,lane:2}),
  Object.freeze({type:'TAP',timeMs:24200,lane:4}),
]);
const atsuCupHoldTestChart = Object.freeze({level:5,notes:atsuCupHoldTestNotes,totalNotes:atsuCupHoldTestNotes.length,durationMs:26000});
const RHYTHM_SONGS = Object.freeze([
  Object.freeze({
    songId:'atsu_cup_theme_test',
    displayName:'あつ杯テーマ',
    bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,
      id==='EASY'?atsuCupTapChart:id==='NORMAL'?atsuCupHoldTestChart:emptyRhythmChart()
    ])))
  }),
]);

// iPhone Safariの同時押し検証用。
// Reactの委譲TouchEventだけに頼らず、音ゲー領域のnative TouchEventをcaptureで先に受け、
// 指ごとに既存PointerEvent経路へ渡す。元のTouchEventはReactへ流さず二重判定を防ぐ。
(function installRhythmNativeMultitouchBridge(){
  if (typeof document === 'undefined' || typeof window === 'undefined' || typeof PointerEvent === 'undefined') return;
  if (window.__mhRhythmNativeTouchBridgeInstalled) return;
  window.__mhRhythmNativeTouchBridgeInstalled = true;

  const activeTouches = new Map();
  let nextPointerId = 10000;

  const playAreaForTouch = (touch, fallbackTarget) => {
    const target = touch?.target && typeof touch.target.closest === 'function' ? touch.target : fallbackTarget;
    return target?.closest?.('[data-rhythm-play-area]') || null;
  };

  const laneTargetFromTouch = (area, touch) => {
    const rect = area.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) return null;
    const relative = Math.min(Math.max(Number(touch.clientX) - Number(rect.left), 0), Math.max(0, rect.width - .001));
    const lane = Math.min(RHYTHM_LANE_COUNT - 1, Math.max(0, Math.floor(relative / rect.width * RHYTHM_LANE_COUNT)));
    const lanes = area.querySelectorAll('button[aria-label^="レーン"]');
    return lanes[lane] || null;
  };

  const dispatchPointer = (target, type, pointerId, touch) => {
    target.dispatchEvent(new PointerEvent(type, {
      bubbles:true,
      cancelable:true,
      composed:true,
      pointerId,
      pointerType:'pen',
      isPrimary:false,
      button:0,
      buttons:type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      pressure:type === 'pointerup' || type === 'pointercancel' ? 0 : .5,
      clientX:Number(touch.clientX) || 0,
      clientY:Number(touch.clientY) || 0,
      screenX:Number(touch.screenX) || 0,
      screenY:Number(touch.screenY) || 0,
    }));
  };

  const blockOriginalTouch = event => {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onTouchStart = event => {
    let handled = false;
    Array.from(event.changedTouches || []).forEach(touch => {
      const area = playAreaForTouch(touch, event.target);
      if (!area) return;
      handled = true;
      if (activeTouches.has(touch.identifier)) return;
      const target = laneTargetFromTouch(area, touch);
      if (!target) return;
      const pointerId = nextPointerId++;
      activeTouches.set(touch.identifier, { target, pointerId });
      dispatchPointer(target, 'pointerdown', pointerId, touch);
    });
    if (handled) blockOriginalTouch(event);
  };

  const onTouchMove = event => {
    let handled = false;
    Array.from(event.changedTouches || []).forEach(touch => {
      const active = activeTouches.get(touch.identifier);
      if (!active) return;
      handled = true;
      dispatchPointer(active.target, 'pointermove', active.pointerId, touch);
    });
    if (handled) blockOriginalTouch(event);
  };

  const finishTouches = (event, pointerType) => {
    let handled = false;
    Array.from(event.changedTouches || []).forEach(touch => {
      const active = activeTouches.get(touch.identifier);
      if (!active) return;
      handled = true;
      activeTouches.delete(touch.identifier);
      dispatchPointer(active.target, pointerType, active.pointerId, touch);
    });
    if (handled) blockOriginalTouch(event);
  };

  document.addEventListener('touchstart', onTouchStart, { capture:true, passive:false });
  document.addEventListener('touchmove', onTouchMove, { capture:true, passive:false });
  document.addEventListener('touchend', event => finishTouches(event, 'pointerup'), { capture:true, passive:false });
  document.addEventListener('touchcancel', event => finishTouches(event, 'pointercancel'), { capture:true, passive:false });
})();
