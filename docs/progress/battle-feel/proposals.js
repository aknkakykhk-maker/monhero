// 手ごたえの案A・B・C の見本(ゲーム本体には入っていない。tools/battle/battle-feel-filmstrip.js が、本物のバトル画面の上へその場で足して撮る)。
// 数字(24・68 など)は見本用の作り物で、ゲームの計算とは関係ない。演出は transform と opacity だけで作ってある(本体へ入れるときも同じ)。
//   window.__feel.stage(案, 場面) … 演出を用意して止めておく。返り値 { duration } は実時間(ms)
//   window.__feel.seek(t)         … 実時間 t(ms) の絵にする(当たりの間・スローは warp で時間を曲げて表す)
(() => {
  const F = window.__feel = { anims: [], warp: [], layer: null };
  const root = () => document.querySelector('[data-tactics-look]') || document.getElementById('root');
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  const enemy = () => rectOf(document.querySelector('[data-enemy-ring]'));
  const ally = () => { const el = document.querySelector('[data-slot-index]') || document.querySelector('[data-tactics-board-band]'); const r = rectOf(el); return { ...r, y: r.y - r.h * 0.1 }; };
  const anim = (el, frames, o) => { const a = el.animate(frames, { fill: 'both', easing: 'cubic-bezier(.2,.9,.3,1)', ...o }); a.pause(); F.anims.push(a); return a; };
  const box = (x, y, css = '', html = '') => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);white-space:nowrap;font-weight:900;font-family:inherit;line-height:1;${css}`;
    d.innerHTML = html; F.layer.appendChild(d); return d;
  };
  const OUT = 'text-shadow:0 2px 0 #000,0 -1px 0 #000,2px 0 0 #000,-2px 0 0 #000,0 4px 10px rgba(0,0,0,.7);';
  const T = (s) => `translate(-50%,-50%) ${s}`;
  // 数字: 大きく出て縮んで止まり、上へ抜ける
  const num = (text, x, y, { size = 26, color = '#fff', at = 0, from = 1.7, hold = 520, label = '', labelColor = '#fde047' } = {}) => {
    const d = box(x, y, `font-size:${size}px;color:${color};${OUT}text-align:center;`, `${label ? `<div style="font-size:${Math.round(size * 0.42)}px;color:${labelColor};margin-bottom:2px;letter-spacing:.08em">${label}</div>` : ''}${text}`);
    anim(d, [{ opacity: 0, transform: T(`scale(${from})`) }, { opacity: 1, transform: T('scale(.94)'), offset: .55 }, { opacity: 1, transform: T('scale(1)') }], { duration: 170, delay: at });
    anim(d, [{ opacity: 1, transform: T('translateY(0)') }, { opacity: 0, transform: T('translateY(-22px)') }], { duration: 280, delay: at + hold, easing: 'ease-in', fill: 'forwards' });
    return d;
  };
  const chip = (html, x, y, color, at = 0, hold = 700) => {
    const d = box(x, y, `font-size:13px;color:#fff;padding:4px 10px;border-radius:999px;background:rgba(2,6,23,.92);border:2px solid ${color};box-shadow:0 4px 12px rgba(0,0,0,.6);`, html);
    anim(d, [{ opacity: 0, transform: T('scale(1.25)') }, { opacity: 1, transform: T('scale(1)') }], { duration: 130, delay: at });
    anim(d, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: at + hold, easing: 'linear', fill: 'forwards' });
    return d;
  };
  const shake = (amp, ms, at = 0) => {
    const k = [[0, 0], [-1, .5], [1, -.6], [-.8, -.5], [.7, .5], [-.4, .2], [0, 0]].map(([x, y], i) => ({ transform: `translate(${(x * amp * (1 - i / 9)).toFixed(1)}px,${(y * amp * (1 - i / 9)).toFixed(1)}px)` }));
    anim(root(), k, { duration: ms, delay: at, easing: 'linear', fill: 'none' });
  };
  const ring = (x, y, size, color, at = 0, ms = 380, to = 2.1) => {
    const d = box(x, y, `width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${color};`);
    anim(d, [{ opacity: .95, transform: T('scale(.45)') }, { opacity: 0, transform: T(`scale(${to})`) }], { duration: ms, delay: at, easing: 'ease-out' });
  };
  const flashOn = (r, at = 0, ms = 200, color = 'rgba(255,255,255,.9)') => {
    const d = box(r.x, r.y, `width:${r.w}px;height:${r.h}px;border-radius:50%;background:radial-gradient(circle,${color} 0%,rgba(255,255,255,0) 70%);`);
    anim(d, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: ms, delay: at, easing: 'linear' });
  };
  const screenFlash = (at = 0, ms = 140, a = .55) => {
    const d = box(0, 0, `left:0;top:0;width:100vw;height:100vh;transform:none;background:#fff;`);
    anim(d, [{ opacity: a }, { opacity: 0 }], { duration: ms, delay: at, easing: 'ease-out' });
  };
  const beam = (a, b, color, at = 0, ms = 240) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), deg = Math.atan2(dy, dx) * 180 / Math.PI;
    const d = box(a.x, a.y, `width:${len}px;height:5px;border-radius:3px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,255,255,0),${color});`);
    anim(d, [{ opacity: 1, transform: `translate(0,-50%) rotate(${deg}deg) scaleX(0)` }, { opacity: 1, transform: `translate(0,-50%) rotate(${deg}deg) scaleX(1)`, offset: .6 }, { opacity: 0, transform: `translate(0,-50%) rotate(${deg}deg) scaleX(1)` }], { duration: ms, delay: at, easing: 'ease-out' });
  };
  const burst = (x, y, color, at = 0, n = 10, len = 70) => {
    for (let i = 0; i < n; i += 1) {
      const deg = i * 360 / n + 8, d = box(x, y, `width:${len}px;height:4px;border-radius:2px;transform-origin:0 50%;background:linear-gradient(90deg,${color},rgba(255,255,255,0));`);
      anim(d, [{ opacity: 1, transform: `translate(0,-50%) rotate(${deg}deg) translateX(20px) scaleX(.3)` }, { opacity: 0, transform: `translate(0,-50%) rotate(${deg}deg) translateX(${len + 30}px) scaleX(1)` }], { duration: 300, delay: at, easing: 'ease-out' });
    }
  };
  const stamp = (text, x, y, color, at, size = 34) => {
    const d = box(x, y, `font-size:${size}px;color:${color};${OUT}letter-spacing:.06em;`, text);
    anim(d, [{ opacity: 0, transform: T('scale(2.8) rotate(-12deg)') }, { opacity: 1, transform: T('scale(.92) rotate(-6deg)'), offset: .7 }, { opacity: 1, transform: T('scale(1) rotate(-6deg)') }], { duration: 200, delay: at });
    anim(d, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: at + 750, easing: 'linear', fill: 'forwards' });
  };
  const counter = (x, y, hits, total, times, big) => {
    const d = box(x, y, `font-size:${big ? 22 : 17}px;color:#fde047;${OUT}text-align:right;`, `<span data-n>1</span> HIT<div style="font-size:11px;color:#fff;margin-top:2px">計 <span data-t>0</span></div>`);
    times.forEach((at, i) => anim(d, [{ opacity: 1, transform: T(`scale(${big ? 1.5 : 1.3})`) }, { opacity: 1, transform: T('scale(1)') }], { duration: 120, delay: at, fill: i === 0 ? 'both' : 'forwards' }));
    anim(d, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: times[times.length - 1] + 800, easing: 'linear', fill: 'forwards' });
    F.counters.push({ d, hits, total, times });
  };
  // 本物の「くらった動き」(敵の絵がのけぞる・白く光る)も一緒に動かす
  const hurt = () => { const el = document.querySelector('[data-enemy-ring]'); el.setAttribute('data-enemy-hurt', 'true'); F.hurtEl = el; };
  const stop = (at, len) => F.warp.push({ at, len, rate: 0 });
  const slow = (at, len, rate) => F.warp.push({ at, len, rate });

  const SCENES = {
    a: {
      normal: (e) => { hurt(); stop(0, 50); num('24', e.x + 34, e.y - 50); shake(2.5, 160); },
      crit: (e) => { hurt(); stop(0, 90); ring(e.x, e.y, 70, '#fde047'); num('68', e.x + 30, e.y - 54, { size: 38, color: '#fde047', label: '会心!', from: 2 }); shake(6, 300); },
      combo: (e) => { hurt(); const ts = [0, 170, 340]; ts.forEach((at, i) => { stop(at, 30); num('8', e.x - 38 + i * 30, e.y - 44 - i * 8, { size: 22, at, hold: 380 }); shake(2, 120, at); }); counter(e.x + e.w / 2 + 6, e.y - 30, 3, 24, ts); },
      effect: (e, a) => { num('↩ 12', e.x + 30, e.y - 46, { size: 24, color: '#d8b4fe', label: '反射', labelColor: '#d8b4fe' }); num('+8', a.x, a.y - 20, { size: 24, color: '#86efac', label: '吸収', labelColor: '#86efac', at: 420 }); num('MISS', a.x, a.y - 20, { size: 22, color: '#bae6fd', at: 900 }); },
      defeat: (e) => { hurt(); stop(0, 140); flashOn(e, 0, 260); num('120', e.x + 26, e.y - 56, { size: 40, from: 2.1 }); shake(9, 420); stamp('撃破!', e.x, e.y + 10, '#fca5a5', 150, 30); },
    },
    b: {
      normal: (e) => { hurt(); stop(0, 50); ring(e.x, e.y, 60, '#fff', 0, 300); num('24', e.x + 34, e.y - 50, { size: 28 }); shake(3, 180); },
      crit: (e) => { hurt(); stop(0, 110); screenFlash(0, 150, .5); burst(e.x, e.y, '#fde047', 0, 12, 80); ring(e.x, e.y, 80, '#fde047', 0, 420, 2.6); anim(root(), [{ transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: 260, fill: 'none' }); num('68', e.x + 26, e.y - 58, { size: 48, color: '#fde047', label: '会心!!', from: 2.6 }); shake(7, 320, 60); },
      combo: (e) => { hurt(); const ts = [0, 170, 340]; ts.forEach((at, i) => { stop(at, i === 2 ? 70 : 30); ring(e.x - 20 + i * 20, e.y - 6 + i * 6, 44, '#fff', at, 260); num('8', e.x - 38 + i * 30, e.y - 44 - i * 8, { size: 24, at, hold: 380 }); shake(2 + i * 1.5, 130, at); }); counter(e.x + e.w / 2 + 2, e.y - 30, 3, 24, ts, true); },
      effect: (e, a) => { beam(a, e, '#d8b4fe', 0); num('↩ 12', e.x + 30, e.y - 46, { size: 28, color: '#d8b4fe', label: '反射', labelColor: '#d8b4fe', at: 120 }); ring(e.x, e.y, 60, '#d8b4fe', 120); beam(e, a, '#86efac', 480); num('+8', a.x, a.y - 20, { size: 28, color: '#86efac', label: '吸収', labelColor: '#86efac', at: 600 }); ring(a.x, a.y, 50, '#86efac', 600); num('MISS', a.x + 10, a.y - 20, { size: 26, color: '#bae6fd', at: 1050 }); },
      defeat: (e) => { hurt(); slow(0, 320, .25); screenFlash(0, 200, .6); flashOn(e, 0, 300); burst(e.x, e.y, '#fff', 0, 14, 90); num('120', e.x + 26, e.y - 60, { size: 46, from: 2.4 }); shake(10, 460, 80); stamp('撃破!', e.x, e.y + 8, '#fca5a5', 110, 44); },
    },
    c: {
      normal: (e) => { hurt(); num('24', e.x + 34, e.y - 50, { size: 24, from: 1.25 }); },
      crit: (e) => { hurt(); num('68', e.x + 34, e.y - 50, { size: 32, color: '#fde047', from: 1.3 }); chip('★ 会心', e.x - 44, e.y - 52, '#fde047', 0, 620); },
      combo: (e) => { hurt(); const ts = [0, 170, 340]; ts.forEach((at, i) => num('8', e.x - 30 + i * 26, e.y - 50, { size: 20, at, from: 1.25, hold: 520 - at })); chip('3 HIT ・ 計 24', e.x, e.y - 78, '#fde047', 400, 700); },
      effect: (e, a) => { chip('<span style="color:#d8b4fe">↩ 反射</span> 12', e.x, e.y - 52, '#d8b4fe', 0); chip('<span style="color:#86efac">♥ 吸収</span> +8', a.x, a.y - 24, '#86efac', 420); chip('<span style="color:#bae6fd">≫ 回避</span>', a.x, a.y - 24, '#bae6fd', 900); },
      defeat: (e) => { hurt(); num('120', e.x + 34, e.y - 50, { size: 30, from: 1.3 }); chip('✕ 撃破', e.x, e.y + 6, '#fca5a5', 120, 800); shake(3, 200); },
    },
  };

  F.stage = (variant, scene) => {
    F.anims.forEach((a) => a.cancel()); F.anims = []; F.warp = []; F.counters = [];
    if (F.hurtEl) F.hurtEl.removeAttribute('data-enemy-hurt');
    if (F.layer) F.layer.remove();
    F.layer = document.createElement('div');
    F.layer.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden;';
    document.body.appendChild(F.layer);
    void document.body.offsetWidth;
    SCENES[variant][scene](enemy(), ally());
    if (F.hurtEl && F.hurtEl.hasAttribute('data-enemy-hurt')) F.hurtEl.getAnimations({ subtree: true }).forEach((a) => { if (a.effect.getComputedTiming().iterations !== Infinity) { a.pause(); F.anims.push(a); } });
    F.warp.sort((x, y) => x.at - y.at);
    const lost = F.warp.reduce((s, w) => s + w.len * (1 - w.rate), 0);
    const end = Math.max(...F.anims.map((a) => a.effect.getComputedTiming().endTime));
    F.seek(0);
    return { duration: Math.round(end + lost), anims: F.anims.length };
  };
  // 実時間 → 演出の時間(当たりの間は進まない・スローは遅く進む)
  F.map = (t) => { let lost = 0; for (const w of F.warp) { const start = w.at + lost; if (t <= start) break; lost += Math.min(t - start, w.len) * (1 - w.rate); } return t - lost; };
  F.seek = (t) => {
    const eff = F.map(t);
    F.anims.forEach((a) => { a.currentTime = eff; });
    F.counters.forEach((c) => { const n = c.times.filter((at) => eff >= at).length; c.d.querySelector('[data-n]').textContent = Math.max(1, n); c.d.querySelector('[data-t]').textContent = Math.round(c.total * n / c.hits); c.d.style.visibility = n ? 'visible' : 'hidden'; });
  };
})();
