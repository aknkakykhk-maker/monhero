// モンヒロくんの「指の合図」を作る共有の部品(2026-10-07)。反応の点検(lib/feel.js)と、毎晩の演奏(scenarios/rhythm.js の installPlayer)が
// 同じ作り方で合図を送るために切り出した。ページの中で動くので、関数の中身そのものを文字(touchInputSource)にして、
// page.evaluate へ渡す側が (0, eval)('(' + touchInputSource + ')') で取り出す(page.evaluate は外の関数を閉じ込めて運べないため)。
//   mode 'mouse' … マウスのポインタの合図だけ(これまでのモンヒロくん)
//   mode 'touch' … 本物のタッチの経路(touchstart と pointerType 'touch')
//   mode 'ios'   … touch に加え、dropPointer: true でポインタの合図だけ抜く(iPhone のくせ)。遅れて届く合図は send の lateMs で起こす
// 使い方: const ti = createTouchInput(area, mode); ti.send(ti.makeEvents('down'|'move'|'up', id, {x, y}, { dropPointer }), lateMs)
function createTouchInput(area, mode) {
// ---- 指の合図。mouse はこれまでのモンヒロくんと同じ。touch / ios は本物のタッチの経路(touchstart と pointerType 'touch')を通す ----
const live = new Map(); // 画面に触れている指 id → 位置
const mkTouch = (id, p) => new Touch({ identifier: id, target: area, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y, radiusX: 11, radiusY: 11, force: 1 });
const makeEvents = (type, id, p, { dropPointer = false } = {}) => {
  const out = [];
  if (mode === 'mouse') {
    out.push(new PointerEvent({ down: 'pointerdown', move: 'pointermove', up: 'pointerup' }[type], { bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse', isPrimary: false, clientX: p.x, clientY: p.y, buttons: type === 'up' ? 0 : 1 }));
    return out;
  }
  if (type === 'up') live.delete(id); else live.set(id, p);
  const touches = [...live.entries()].map(([k, q]) => mkTouch(k, q));
  if (!dropPointer) out.push(new PointerEvent({ down: 'pointerdown', move: 'pointermove', up: 'pointerup' }[type], { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: p.x, clientY: p.y, width: 22, height: 22, pressure: type === 'up' ? 0 : 0.5, buttons: type === 'up' ? 0 : 1 }));
  out.push(new TouchEvent({ down: 'touchstart', move: 'touchmove', up: 'touchend' }[type], { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [mkTouch(id, p)] }));
  return out;
};
// 合図は作った時刻(timeStamp)のまま、lateMs あとに届ける(＝遅れて届くタッチ。ゲームは timeStamp から遅れを引く)
const send = (events, lateMs = 0) => { const go = () => events.forEach((e) => area.dispatchEvent(e)); if (lateMs > 0) setTimeout(go, lateMs); else go(); };
  return { makeEvents, send };
}

const touchInputSource = createTouchInput.toString();

module.exports = { createTouchInput, touchInputSource };
