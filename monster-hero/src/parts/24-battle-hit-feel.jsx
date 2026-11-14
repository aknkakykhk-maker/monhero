// バトルの「手ごたえ」(2026-11-11 社長が選んだ形: 案A キレを土台 + 会心と撃破だけ案B ドカン + 効果の知らせは案C の札。
// 「当たりの間は入れる・設定で切れる・はじめは入」)。資料: docs/progress/battle-feel/README.md
//
// ★見た目と間だけ。ダメージ・命中・会心の判定・スコア・ランキング・勝敗・ターンの進み・AUTO の回し方には一切触れない。
//   この部品は「敵に出た数字の札」と「敵のライフ」を読むだけで、何も書き戻さない。
//   「当たりの間」は CSS のアニメーションを一瞬止めるだけ(#root の data-feel-stop)。ゲームの時計(battleWait)は止めない。
// ★React の state は持たない(ref と DOM だけ)。当たるたびにアプリ全体を描き直させないため。
// ★動かすのは transform / opacity / translate / scale だけ(描き直しにならない)。

// 当たりの間の長さ(ms・×1速のとき)。速さを上げているときは同じ割合で短くする
const BATTLE_FEEL_STOP_MS = Object.freeze({ normal: 50, crit: 110, defeat: 140, chain: 30 });

// 札の文から、効果の種類を決める(色と印を付けるだけ。案C)。当てはまらなければ undefined(いままでの見た目)
const battleFeelKindOf = (text) => {
  const s = String(text == null ? '' : text);
  if (/反射/.test(s)) return 'reflect';
  if (/吸収|ドレイン/.test(s)) return 'absorb';
  if (/回避|かわし|MISS/i.test(s)) return 'evade';
  if (/会心/.test(s)) return 'crit';
  if (/撃破/.test(s)) return 'defeat';
  return undefined;
};

// 敵に出た数字の札が「1発ぶんのダメージ」かどうか。会心は 60-app が末尾に「!!」を付けている
const battleFeelTierOf = (text) => {
  const s = String(text == null ? '' : text);
  if (!/^\d[\d,]*!*$/.test(s)) return null;
  return /!!$/.test(s) ? 'crit' : 'normal';
};

// popups … 敵に出ている数字の札(効果の小さな札を除いたもの)。enemyHp … 敵のライフ(0 になった瞬間を「倒した」とする)
// speed … バトルの速さ(×1・×2…)。stopOn / shakeOn / defeatOn / richOn … 設定。off … 軽量表示・省エネ(何もしない)
function BattleHitFeel({ popups, enemyHp, speed = 1, stopOn = true, shakeOn = true, defeatOn = true, richOn = true, off = false }) {
  const hostRef = React.useRef(null);
  const seenRef = React.useRef(undefined);
  const hpRef = React.useRef(enemyHp);
  const lastHitAtRef = React.useRef(0);
  const stopTimerRef = React.useRef(0);
  const last = Array.isArray(popups) && popups.length ? popups[popups.length - 1] : null;
  const lastId = last ? last.id : null;
  const lastText = last ? last.text : '';

  React.useEffect(() => () => {
    clearTimeout(stopTimerRef.current);
    try { document.querySelectorAll('[data-feel-stop]').forEach((el) => el.removeAttribute('data-feel-stop')); } catch (e) {}
  }, []);

  React.useEffect(() => {
    const prevHp = hpRef.current;
    hpRef.current = enemyHp;
    const first = seenRef.current === undefined;
    const fresh = lastId != null && lastId !== seenRef.current;
    seenRef.current = lastId;
    if (first || off) return;
    const defeated = Number.isFinite(enemyHp) && Number.isFinite(prevHp) && enemyHp <= 0 && prevHp > 0;
    let tier = fresh ? battleFeelTierOf(lastText) : null;
    if (defeated && defeatOn) tier = 'defeat';
    if (!tier) return;
    const host = hostRef.current;
    if (!host) return;
    let reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    if (reduce) return;
    const k = 1 / Math.max(1, Number(speed) || 1);
    const now = Date.now();
    const chain = tier === 'normal' && now - lastHitAtRef.current < 220;   // 連撃の2発目から先は短く
    lastHitAtRef.current = now;
    const made = [];
    const run = (el, frames, opts) => {
      if (!el || typeof el.animate !== 'function') return null;
      try { const a = el.animate(frames, { fill: 'both', easing: 'cubic-bezier(.2,.9,.3,1)', ...opts, duration: Math.max(60, (opts.duration || 200) * k), delay: (opts.delay || 0) * k }); made.push(a); return a; } catch (e) { return null; }
    };
    const piece = (css) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:50%;top:50%;pointer-events:none;${css}`;
      host.appendChild(d);
      return d;
    };
    const fade = (d, a, ms) => { if (a) a.onfinish = () => d.remove(); else d.remove(); setTimeout(() => d.remove(), ms * k + 400); };
    const T = (s) => `translate(-50%,-50%) ${s}`;
    const burst = (color, n, len) => {
      for (let i = 0; i < n; i += 1) {
        const deg = i * 360 / n + 8;
        const d = piece(`width:${len}px;height:4px;border-radius:2px;transform-origin:0 50%;background:linear-gradient(90deg,${color},rgba(255,255,255,0));`);
        fade(d, run(d, [{ opacity: 1, transform: `translate(0,-50%) rotate(${deg}deg) translateX(20px) scaleX(.3)` }, { opacity: 0, transform: `translate(0,-50%) rotate(${deg}deg) translateX(${len + 30}px) scaleX(1)` }], { duration: 300, easing: 'ease-out' }), 300);
      }
    };
    const ring = (color, size, to) => {
      const d = piece(`width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${color};`);
      fade(d, run(d, [{ opacity: .95, transform: T('scale(.45)') }, { opacity: 0, transform: T(`scale(${to})`) }], { duration: 420, easing: 'ease-out' }), 420);
    };
    const flash = (css, peak, ms) => {
      const d = piece(css);
      fade(d, run(d, [{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }), ms);
    };
    const stamp = (text, color, size, dx, dy, hold) => {
      const d = piece(`margin-left:${dx}px;margin-top:${dy}px;white-space:nowrap;font-weight:900;line-height:1;font-size:${size}px;color:${color};letter-spacing:.06em;text-shadow:0 2px 0 #000,0 -1px 0 #000,2px 0 0 #000,-2px 0 0 #000,0 4px 10px rgba(0,0,0,.7);`);
      d.textContent = text;
      d.setAttribute('data-feel-stamp', tier);
      run(d, [{ opacity: 0, transform: T('scale(2.6) rotate(-12deg)') }, { opacity: 1, transform: T('scale(.92) rotate(-6deg)'), offset: .7 }, { opacity: 1, transform: T('scale(1) rotate(-6deg)') }], { duration: 200 });
      fade(d, run(d, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: hold, easing: 'linear', fill: 'forwards' }), hold + 240);
    };
    // 敵の舞台(この部品の親)を揺らす・寄せる。transform は使わず translate / scale で足す(舞台の元の位置を壊さない)
    const stage = host.parentElement;
    const shake = (amp, ms) => {
      if (!shakeOn) return;
      const pts = [[0, 0], [-1, .5], [1, -.6], [-.8, -.5], [.7, .5], [-.4, .2], [0, 0]];
      run(stage, pts.map(([x, y], i) => ({ translate: `${(x * amp * (1 - i / 9)).toFixed(1)}px ${(y * amp * (1 - i / 9)).toFixed(1)}px` })), { duration: ms, easing: 'linear', fill: 'none' });
    };

    if (tier === 'crit') {
      // 会心(案B): 白い光・光の筋・金の輪・「会心!!」・舞台が少し寄る。画面全体の揺れは今までどおり 60-app が出す
      if (richOn) { flash('width:4000px;height:4000px;margin-left:-2000px;margin-top:-2000px;background:#fff;', .42, 150); burst('#fde047', 12, 80); }
      ring('#fde047', 80, 2.6);
      stamp('会心!!', '#fde047', 20, -44, -108, 620);
      if (shakeOn) run(stage, [{ scale: '1.07' }, { scale: '1' }], { duration: 240, fill: 'none' });
    } else if (tier === 'defeat') {
      // 撃破(案B): 敵が白く光る・光の筋・「撃破!」の判・強い揺れ
      flash('width:120%;height:120%;margin-left:-60%;margin-top:-60%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.9) 0%,rgba(255,255,255,0) 70%);', 1, 300);
      if (richOn) burst('#ffffff', 14, 90);
      stamp('撃破!', '#fca5a5', 40, 0, 12, 750);
      shake(9, 420);
    } else if (!chain) {
      shake(2.5, 160);
    }

    // 当たりの間: CSS のアニメーションだけを一瞬止める(70-bootstrap の #root[data-feel-stop])。自前の演出も一緒に止めて、同じ絵で固める
    if (stopOn) {
      const ms = (chain ? BATTLE_FEEL_STOP_MS.chain : BATTLE_FEEL_STOP_MS[tier]) * k;
      // 止める範囲はバトル画面の中だけ(スタイル計算を広げない)。見つからなければ従来どおり #root
      const root = (host.closest && host.closest('[data-battle-speed]')) || document.getElementById('root');
      if (root && ms >= 12) {
        root.setAttribute('data-feel-stop', tier);
        made.forEach((a) => { try { a.pause(); } catch (e) {} });
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
          root.removeAttribute('data-feel-stop');
          made.forEach((a) => { try { if (a.playState === 'paused') a.play(); } catch (e) {} });
        }, ms);
      }
    }
  }, [lastId, enemyHp]);

  return <div ref={hostRef} data-battle-hit-feel={off ? 'OFF' : 'ON'} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ zIndex: 49 }}></div>;
}
