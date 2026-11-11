// roam-bot.js が、ゲームを開く前にページへ入れる「記録係」。ゲーム本体は変えずに、外から次を見えるようにする。
//   ・音: いま鳴っている音源(AudioBufferSource / Oscillator / <audio>)と、どの画面で鳴らし始めたか・出口までの音量
//   ・演出: 走っている CSS アニメーションの名前(画面ごと)と、画面の切り替わりの間の1コマずつ
//   ・窓: 画面を覆う窓が「出た」時刻(同じ窓が2回出たかを見る)
//   ・画面の名前(見出しから作る)・押せるもの・はみ出し・真っ白
// ★ここは page.addInitScript へ関数ごと渡す。外の変数は見えないので、この関数の中だけで完結させる。
// ★外への通信(WebSocket・sendBeacon)もここでふさぐ(HTTP は roam-bot.js の route と起動引数でふさぐ)。
module.exports = function roamRecorder() {
  if (window.__roam) return;
  const R = window.__roam = { tag: 'boot', seq: 0, sources: [], media: new Set(), overlayLog: [], anims: {}, frames: null, blockedSockets: 0, starts: [], leaveAt: 0 };

  // ── 外への通信をふさぐ(保存データ・ランキング・マルチの部屋へ何も届かせない) ──
  try {
    const local = (u) => /^(wss?|https?):\/\/(localhost|127\.0\.0\.1)[:/]/.test(String(u));
    const RealWS = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      if (local(url)) return new RealWS(url, protocols);
      R.blockedSockets++;
      const fake = new EventTarget();
      Object.assign(fake, { url: String(url), readyState: 3, bufferedAmount: 0, protocol: '', extensions: '', binaryType: 'blob', send() {}, close() {}, onopen: null, onclose: null, onerror: null, onmessage: null });
      setTimeout(() => { for (const type of ['error', 'close']) { const e = new Event(type); try { fake['on' + type] && fake['on' + type](e); } catch (_) {} fake.dispatchEvent(e); } }, 30);
      return fake;
    };
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (navigator.sendBeacon) navigator.sendBeacon = () => true;
  } catch (_) {}

  // ── 音 ──
  const edges = new WeakMap(); // つなぎ元 → つなぎ先の集まり(出口までの音量をたどるため)
  try {
    const AN = AudioNode.prototype, conn = AN.connect, disc = AN.disconnect;
    AN.connect = function (dest) {
      try { if (dest instanceof AudioNode) { let s = edges.get(this); if (!s) edges.set(this, s = new Set()); s.add(dest); } } catch (_) {}
      return conn.apply(this, arguments);
    };
    AN.disconnect = function (dest) {
      try { const s = edges.get(this); if (s) { if (dest instanceof AudioNode) s.delete(dest); else if (dest === undefined) s.clear(); } } catch (_) {}
      return disc.apply(this, arguments);
    };
    const track = (proto, kind) => {
      const start = proto.start;
      proto.start = function () {
        try {
          const rec = { node: this, kind, tag: R.tag, t0: performance.now(), ended: false };
          this.addEventListener('ended', () => { rec.ended = true; });
          R.sources.push(rec);
          R.starts.push(rec.t0); if (R.starts.length > 600) R.starts.shift();
        } catch (_) {}
        return start.apply(this, arguments);
      };
    };
    track(AudioBufferSourceNode.prototype, 'buffer');
    track(OscillatorNode.prototype, 'osc');
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { this.__roamTag = R.tag; this.__roamT0 = performance.now(); R.media.add(this); } catch (_) {} return play.apply(this, arguments); };
  } catch (_) {}
  // その音源から出口(スピーカー)までの音量。途中の Gain が 0 なら「鳴っていない」
  const gainToOut = (node, g, depth, seen) => {
    if (!node || depth > 40 || seen.has(node)) return 0;
    seen.add(node);
    if (node instanceof AudioDestinationNode) return g;
    if (node instanceof GainNode) { g *= Math.abs(node.gain.value); if (g < 0.002) return 0; }
    let best = 0;
    const next = edges.get(node);
    if (next) for (const d of next) best = Math.max(best, gainToOut(d, g, depth + 1, seen));
    return best;
  };
  // いま耳に聞こえている音の一覧
  R.audioNow = () => {
    const now = performance.now(), out = [];
    R.sources = R.sources.filter((s) => !s.ended);
    for (const s of R.sources) {
      let gain = 0, dur = null, loop = false, sig = s.kind;
      try {
        if (s.node.context.state !== 'running') continue;
        gain = gainToOut(s.node, 1, 0, new Set());
        if (s.kind === 'buffer') {
          const b = s.node.buffer; if (!b) continue;
          dur = b.duration; loop = !!s.node.loop; sig = `${b.duration.toFixed(2)}s/${b.numberOfChannels}ch`;
          if (!loop && (now - s.t0) / 1000 > dur + 0.5) continue; // 終わったのに ended が来ていないもの
        }
      } catch (_) { continue; }
      if (gain < 0.002) continue;
      out.push({ kind: s.kind, tag: s.tag, age: Math.round((now - s.t0) / 100) / 10, loop, dur: dur == null ? null : Math.round(dur * 10) / 10, gain: Math.round(gain * 100) / 100, sig });
    }
    for (const m of [...R.media]) {
      try {
        if (m.paused || m.ended) { if (m.ended) R.media.delete(m); continue; }
        if (m.muted || m.volume < 0.002) continue;
        out.push({ kind: 'media', tag: m.__roamTag, age: Math.round((now - m.__roamT0) / 100) / 10, loop: !!m.loop, dur: Number.isFinite(m.duration) ? Math.round(m.duration * 10) / 10 : null, gain: m.volume, sig: 'media:' + String(m.currentSrc || m.src).split('/').pop().split('?')[0].slice(0, 30) });
      } catch (_) {}
    }
    return out;
  };

  // ── 画面の名前・窓 ──
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const text = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  const norm = (s) => s.replace(/[0-9０-９]+/g, '#');
  // 画面を覆っている窓(固定配置で、画面の45%より広く、押せるもの)。いちばん手前の1つを返す
  const overlays = () => {
    const area = innerWidth * innerHeight, out = [];
    for (const e of document.querySelectorAll('.fixed,[role=dialog],[style*="position: fixed"],[style*="position:fixed"]')) {
      const r = e.getBoundingClientRect();
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0), h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (w <= 0 || h <= 0 || w * h < area * 0.45) continue;
      const st = getComputedStyle(e);
      if (st.position !== 'fixed' && e.getAttribute('role') !== 'dialog') continue;
      if (st.pointerEvents === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05 || st.display === 'none') continue;
      if (e.closest('.mh-home-scene') && !e.matches('[role=dialog]')) continue; // HOME の背景そのもの
      out.push(e);
    }
    // 入れ子は外側を捨てて内側(手前)を残す
    return out.filter((e) => !out.some((o) => o !== e && e.contains(o)));
  };
  const overlaySig = (e) => {
    const attr = [...e.attributes].map((a) => a.name).find((n) => n.startsWith('data-') && !/^data-(mh|ja|fx|more)/.test(n));
    if (attr) return attr.slice(5);
    const h = [...e.querySelectorAll('h1,h2,h3,b,strong')].find(vis);
    return norm((h ? text(h) : text(e)).slice(0, 14)) || '窓';
  };
  // いちばん手前の窓。窓が重なっているときは、画面の真ん中で実際に手前にある物を選ぶ
  R.topOverlay = () => {
    const l = overlays();
    if (!l.length) return null;
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return l.filter((o) => hit && o.contains(hit)).pop() || l[l.length - 1];
  };
  R.sig = () => {
    let base = '';
    const roots = [...document.querySelectorAll('[data-mh-screen]')].filter(vis);
    const root = roots[roots.length - 1];
    if (root) {
      const h = [...root.querySelectorAll('h1,h2')].find(vis);
      const extra = [...root.attributes].map((a) => a.name).find((n) => n.startsWith('data-') && n !== 'data-mh-screen');
      base = (h && norm(text(h).slice(0, 14))) || (extra && extra.slice(5)) || '';
      if (!base) { const b = [...root.querySelectorAll('h3,b,strong')].find(vis); base = b ? norm(text(b).slice(0, 14)) : '名前のない画面'; }
    } else if (document.querySelector('.mh-home-scene')) base = 'HOME';
    else if (document.querySelector('[data-screen-error]')) base = '画面エラー';
    else {
      const any = [...document.querySelectorAll('#root h1,#root h2,#root h3,#root b,#root strong')].find(vis);
      base = any ? norm(text(any).slice(0, 14)) : (document.querySelector('#root canvas,#root svg,#root img') ? '絵だけの画面' : '');
    }
    const top = R.topOverlay();
    return top ? `${base}>${overlaySig(top)}` : base;
  };
  // HOME を触れる状態か。窓として見つけられない覆い(小さな窓・絶対配置の窓)もあるので、HOME のボタンが実際に押せるかで確かめる
  R.isHome = () => {
    if (!document.querySelector('.mh-home-scene') || [...document.querySelectorAll('[data-mh-screen]')].some(vis) || R.topOverlay()) return false;
    const list = [...document.querySelectorAll('.mh-home-facility,.mh-home-mission,.mh-home-gift,.mh-home-settings')].filter(vis);
    const free = list.filter((b) => { const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && (b === hit || b.contains(hit)); });
    return list.length > 0 && free.length >= list.length * 0.6;
  };

  // ── 押せるもの ──
  const BACK = /^(←|×|✕|やめる|キャンセル)$|戻る|もどる|閉じる|とじる/;
  R.candidates = () => {
    const layer = R.topOverlay(), scope = layer || document.body, out = [];
    for (const el of scope.querySelectorAll('button,[role=button],a[href],input[type=checkbox],input[type=range],summary')) {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      if (el.tagName === 'A' && (el.origin !== location.origin || el.target === '_blank')) continue; // 外へ出るリンクは押さない
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;
      const label = norm(text(el).slice(0, 24)) || el.getAttribute('title') || el.tagName.toLowerCase();
      out.push({ label, aria: el.getAttribute('aria-label') || '', x: Math.round(x), y: Math.round(y), back: BACK.test(text(el)) || BACK.test(el.getAttribute('aria-label') || '') });
      if (out.length >= 90) break;
    }
    return out;
  };
  // ラベル(正規表現)・CSS・aria のどれかで1つ探して、その真ん中の座標を返す
  R.find = (q) => {
    let el = null;
    const ok = (x) => vis(x) && !x.disabled;
    if (q.sel) el = [...document.querySelectorAll(q.sel)].find(ok);
    else if (q.aria) el = [...document.querySelectorAll(`[aria-label="${q.aria}"]`)].find(ok);
    else if (q.tap) { const re = new RegExp(q.tap); el = [...document.querySelectorAll(q.within || 'button,[role=button],article')].find((x) => ok(x) && re.test(text(x))); }
    if (!el) return null;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: text(el).slice(0, 20) };
  };

  // ── 画面の具合 ──
  R.health = () => {
    const root = document.querySelector('#root');
    const big = (e) => { const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight; };
    const white = !root || (!text(root) && ![...root.querySelectorAll('img,canvas,svg,video')].some(big));
    // 半分切れたボタン: 画面の端で25%より多く切れていて、スクロールでも届かないもの
    const scrollable = (el) => { for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const st = getComputedStyle(e); if ((/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 1) || (/(auto|scroll)/.test(st.overflowX) && e.scrollWidth > e.clientWidth + 1)) return true; } return false; };
    const cut = [];
    const layer = R.topOverlay() || document.body;
    for (const b of layer.querySelectorAll('button,[role=button]')) {
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0), h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (w <= 0 || h <= 0) continue; // まるごと外は、引き出しなどわざと隠している物が多いので数えない
      const shown = (w * h) / (r.width * r.height);
      if (shown > 0.75) continue;
      const st = getComputedStyle(b);
      if (st.visibility === 'hidden' || Number(st.opacity) < 0.05 || st.pointerEvents === 'none') continue;
      if (b.closest('[aria-hidden=true],[inert]') || scrollable(b)) continue;
      // 見えている部分が、ほかの物の下に隠れているなら数えない(窓の後ろの画面など)
      const hit = document.elementFromPoint(Math.max(r.left, 0) + w / 2, Math.max(r.top, 0) + h / 2);
      if (!hit || !(b === hit || b.contains(hit))) continue;
      cut.push(`${norm(text(b).slice(0, 12)) || '(名前なし)'}(見えているのは${Math.round(shown * 100)}%)`);
      if (cut.length >= 6) break;
    }
    // 窓のボタンがまるごと画面の外にあって、スクロールでも届かない(その窓を閉じられない・進められない)
    const lost = [];
    const top = R.topOverlay();
    if (top) for (const b of top.querySelectorAll('button,[role=button]')) {
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (!(r.top >= innerHeight - 2 || r.bottom <= 2 || r.left >= innerWidth - 2 || r.right <= 2)) continue;
      const st = getComputedStyle(b);
      if (st.visibility === 'hidden' || Number(st.opacity) < 0.05 || st.pointerEvents === 'none') continue;
      if (b.closest('[aria-hidden=true],[inert]') || scrollable(b)) continue;
      lost.push(`${norm(text(b).slice(0, 12)) || '(名前なし)'}(上から${Math.round(r.top)}〜${Math.round(r.bottom)}px・画面の高さ${innerHeight}px)`);
      if (lost.length >= 4) break;
    }
    const sw = document.documentElement.scrollWidth;
    return { sig: R.sig(), home: R.isHome(), white, error: !!document.querySelector('[data-screen-error]'), hOver: sw > innerWidth + 1 ? sw - innerWidth : 0, cut, lost, overlay: !!R.topOverlay() };
  };

  // ── 演出 ──
  // 走っているアニメーションの名前。carriedOnly のときは「画面を出る前から同じ要素で走っていた物」だけ
  //(HOME で新しく出た要素が、たまたま同じ名前のアニメーションを使っているのは持ち越しではない)
  const firstSeen = new WeakMap(); // 要素 → はじめて動いているのを見た時刻
  const animNames = (carriedOnly) => {
    const names = new Set(), t = performance.now();
    try {
      for (const a of document.getAnimations()) {
        if (a.playState !== 'running' || !a.animationName) continue;
        const el = a.effect && a.effect.target;
        if (el && !firstSeen.has(el)) firstSeen.set(el, t);
        // 持ち越し = 画面を出る前からその要素にあり、アニメーションも出る前に始まっていた物(出るタップの波紋などは数えない)
        if (carriedOnly && !(el && firstSeen.get(el) < R.leaveAt && typeof a.startTime === 'number' && a.startTime < R.leaveAt - 80)) continue;
        names.add(a.animationName);
      }
    } catch (_) {}
    return [...names];
  };
  // 画面そのもの(根・body)が動かされているか(画面揺れの残り)
  const shaken = () => {
    for (const e of [document.body, document.querySelector('#root'), document.querySelector('#root > div')]) {
      if (!e) continue;
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t)) return true;
    }
    return false;
  };
  R.animsNow = () => ({ names: animNames(true), shaken: shaken() });
  // 切り替わりの間を1コマずつ撮る(ms ミリ秒)
  R.watch = (ms) => {
    const frames = R.frames = [], until = performance.now() + ms;
    const tick = () => {
      const t = performance.now();
      try { frames.push({ t: Math.round(t), sig: R.sig(), names: animNames(true), shaken: shaken() }); } catch (_) {}
      if (t < until && frames.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ── ずっと回す見張り(0.2秒ごと): 画面ごとのアニメーション名・窓が出た時刻 ──
  let prev = new Set();
  setInterval(() => {
    try {
      const set = R.anims[R.tag] || (R.anims[R.tag] = {});
      for (const n of animNames()) set[n] = 1;
      const now = new Set(overlays().map((e) => `${overlaySig(e)}|${norm(text(e).slice(0, 40))}`));
      for (const s of now) if (!prev.has(s)) { R.overlayLog.push({ sig: s, t: Math.round(performance.now()), seq: R.seq, tag: R.tag }); if (R.overlayLog.length > 300) R.overlayLog.shift(); }
      prev = now;
    } catch (_) {}
  }, 200);
};
