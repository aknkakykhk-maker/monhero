// 効果音の素材庫: その場で合成して鳴らす部品(台帳 r1126-121・資料 docs/progress/SE_LIBRARY.md)
//
// 使い方(ブラウザ):
//   const ctx = new AudioContext();
//   const h = MH_SE_SYNTH.play('knock', ctx, ctx.destination, { count: 3 });   // h.dur = 長さ(秒)
//   const loop = MH_SE_SYNTH.play('pendulum', ctx, ctx.destination);           // 続く音は h.stop() で止める
//
// 決まり:
//   ・WebAudio の標準の部品(OscillatorNode・BiquadFilterNode・ConvolverNode など)だけで作る。Tone.js も音源ファイルも使わない
//     (ゲームの 14-audio.jsx へ移すときは、out にゲームの効果音の出口 seBus を渡せばよい)
//   ・どの音も最大で -1dBFS を超えないくらいの大きさにしてある。場面の音量は out の手前の GainNode で決める
//   ・雑音は種を決めた乱数で作るので、毎回同じ音色になる
//   ・まだゲームのどこにも差し込んでいない(2026-11-28 時点)
(function (root) {
  'use strict';

  // ---- 下ごしらえ --------------------------------------------------------
  const cache = new WeakMap();
  const store = (ctx) => { let c = cache.get(ctx); if (!c) { c = {}; cache.set(ctx, c); } return c; };
  const rand = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // 白い雑音(2秒・決まった種)
  const noiseBuf = (ctx) => {
    const c = store(ctx); if (c.noise) return c.noise;
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rand(12345);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return (c.noise = b);
  };
  // 桃色の雑音(低い所が多い。風・息に)
  const pinkBuf = (ctx) => {
    const c = store(ctx); if (c.pink) return c.pink;
    const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rand(777);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    return (c.pink = b);
  };
  // 残響(減っていく雑音を響きにする。sec ごとに1つだけ作って使い回す)
  const reverbOf = (ctx, sec) => {
    const c = store(ctx), k = 'rv' + sec; if (c[k]) return c[k];
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rand(99 + ch);
      for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.exp(-6.9 * i / n);
    }
    const cv = ctx.createConvolver(); cv.buffer = b;
    return (c[k] = cv);
  };
  // out の前に「そのまま + 残響」を作る。戻り値へつなぐ
  const withReverb = (ctx, out, sec, wet) => {
    const inp = ctx.createGain(), dry = ctx.createGain(), w = ctx.createGain(), cv = ctx.createConvolver();
    cv.buffer = reverbOf(ctx, sec).buffer;
    dry.gain.value = 1 - wet * 0.5; w.gain.value = wet;
    inp.connect(dry).connect(out); inp.connect(cv).connect(w).connect(out);
    return inp;
  };
  const gainNode = (ctx, out, v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(out); return g; };
  const filter = (ctx, out, type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; x.connect(out); return x; };
  // 雑音の一粒: t 秒から dur 秒、type/f/q のフィルタを通し、peak の大きさで、attack のあと減る
  const noiseHit = (ctx, out, t, o) => {
    const s = ctx.createBufferSource(); s.buffer = o.pink ? pinkBuf(ctx) : noiseBuf(ctx);
    const g = ctx.createGain(), f = filter(ctx, g, o.type || 'bandpass', o.f || 1000, o.q == null ? 1 : o.q);
    g.connect(out);
    const a = o.attack || 0.002, d = o.dur || 0.05;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.peak || 0.5, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    if (o.sweep) { f.frequency.setValueAtTime(o.f, t); f.frequency.exponentialRampToValueAtTime(o.sweep, t + a + d); }
    s.connect(f); s.start(t, (o.offset || 0) % 1.5); s.stop(t + a + d + 0.05);
    return t + a + d;
  };
  // 音の高さのある一粒(sine/triangle など)。to があれば高さが to へ動く
  const tone = (ctx, out, t, o) => {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || o.dur || 0.1));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack || 0.003, d = o.dur || 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.peak || 0.3, t + a);
    if (o.hold) g.gain.setValueAtTime(o.peak || 0.3, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (o.hold || 0) + d);
    osc.connect(g).connect(out); osc.start(t); osc.stop(t + a + (o.hold || 0) + d + 0.05);
    return t + a + (o.hold || 0) + d;
  };
  // 続く音の止め方: master を 0.4 秒で小さくしてから、残りの音を止める
  const looper = (ctx, master, stoppers) => {
    let stopped = false;
    return {
      dur: Infinity,
      stop: (fade = 0.4) => {
        if (stopped) return; stopped = true;
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + fade);
        setTimeout(() => stoppers.forEach((f) => { try { f(); } catch (e) {} }), (fade + 0.1) * 1000);
      },
    };
  };

  // ---- 音 ----------------------------------------------------------------
  const S = {};

  // ノック「コン、コン、コン」(木の扉)。count 回数 / hard 強く叩く
  S.knock = (ctx, out, o = {}) => {
    const n = o.count || 3, t0 = ctx.currentTime + 0.02, r = rand(31);
    const bus = withReverb(ctx, out, 0.6, 0.25);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const v = (o.hard ? 1 : 0.6) * (i === n - 1 ? 0.85 : 1);
      tone(ctx, bus, t, { f: 150, to: 95, glide: 0.06, dur: 0.09, peak: 0.55 * v });
      tone(ctx, bus, t, { f: 420, to: 300, glide: 0.03, dur: 0.04, peak: 0.25 * v, type: 'triangle' });
      noiseHit(ctx, bus, t, { f: 900, q: 1.2, dur: 0.035, peak: 0.45 * v, offset: i * 0.3 });
      t += 0.19 + r() * 0.05;
    }
    return { dur: t - t0 + 0.6 };
  };

  // 木の床の足音(ゆっくり歩く)。count 歩 / every 間隔 / creak ときどき床がきしむ
  S.stepWood = (ctx, out, o = {}) => {
    const n = o.count || 4, every = o.every || 0.55, t0 = ctx.currentTime + 0.02, r = rand(52);
    const bus = withReverb(ctx, out, 0.9, 0.2);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * every + r() * 0.04, v = i % 2 ? 0.8 : 1;
      tone(ctx, bus, t, { f: 110, to: 70, glide: 0.05, dur: 0.08, peak: 0.5 * v });
      noiseHit(ctx, bus, t + 0.005, { f: 650, q: 0.9, dur: 0.05, peak: 0.25 * v, offset: i * 0.21 });
      noiseHit(ctx, bus, t + 0.06, { f: 1800, q: 1.5, dur: 0.03, peak: 0.08 * v, offset: i * 0.37 });
      if (o.creak !== false && i === 1) creak(ctx, bus, t + 0.04, { len: 0.28, from: 38, to: 24, peak: 0.08, body: 900 });
    }
    return { dur: n * every + 0.6 };
  };

  // 雪を踏む「ギュッ、ギュッ」。count 歩 / every 間隔
  S.stepSnow = (ctx, out, o = {}) => {
    const n = o.count || 4, every = o.every || 0.6, t0 = ctx.currentTime + 0.02, r = rand(77);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * every + r() * 0.05;
      // 小さな粒がつぶれる音をたくさん(押しつぶす 0.15 秒)
      for (let k = 0; k < 26; k++) {
        const tk = t + Math.pow(r(), 0.8) * 0.16;
        noiseHit(ctx, out, tk, { f: 1500 + r() * 3500, q: 3 + r() * 4, dur: 0.008 + r() * 0.012, peak: 0.35 + r() * 0.45, offset: r() });
      }
      noiseHit(ctx, out, t, { f: 300, q: 0.7, dur: 0.12, peak: 0.8, pink: true, attack: 0.02 });
    }
    return { dur: n * every + 0.3 };
  };

  // 心臓の音「ドクン、ドクン」。bpm 速さ / beats 回数(0 で止めるまで続く)
  S.heartbeat = (ctx, out, o = {}) => {
    const bpm = o.bpm || 66, gap = 60 / bpm, master = gainNode(ctx, out, 1);
    const lp = filter(ctx, master, 'lowpass', 260, 0.7);
    const beat = (t, v) => {
      tone(ctx, lp, t, { f: 62, to: 40, glide: 0.1, dur: 0.14, peak: 0.7 * v, attack: 0.008 });
      tone(ctx, lp, t + 0.27, { f: 70, to: 46, glide: 0.08, dur: 0.11, peak: 0.47 * v, attack: 0.006 });
    };
    if (o.beats !== 0) {
      const n = o.beats || 6, t0 = ctx.currentTime + 0.02;
      for (let i = 0; i < n; i++) beat(t0 + i * gap, 1);
      return { dur: n * gap + 0.4 };
    }
    let next = ctx.currentTime + 0.05;
    const timer = setInterval(() => { while (next < ctx.currentTime + 0.3) { beat(next, 1); next += gap; } }, 100);
    return looper(ctx, master, [() => clearInterval(timer)]);
  };

  // 息づかい(吸って吐く)。count 回 / fast 早い息(おびえ)
  S.breath = (ctx, out, o = {}) => {
    const n = o.count || 2, inS = o.fast ? 0.35 : 0.9, exS = o.fast ? 0.45 : 1.3, t0 = ctx.currentTime + 0.02;
    let t = t0;
    for (let i = 0; i < n; i++) {
      noiseHit(ctx, out, t, { pink: true, f: 1100, sweep: 1600, q: 0.9, attack: inS * 0.7, dur: inS * 0.4, peak: 1.4 });
      t += inS + 0.08;
      noiseHit(ctx, out, t, { pink: true, f: 800, sweep: 450, q: 0.8, attack: exS * 0.25, dur: exS * 0.8, peak: 1.6 });
      t += exS + (o.fast ? 0.05 : 0.35);
    }
    return { dur: t - t0 };
  };

  // 低いうなり(暗い場面の下敷き)。sec 長さ(0 で止めるまで続く)/ f 高さ(既定 55Hz)
  S.drone = (ctx, out, o = {}) => {
    const f0 = o.f || 55, t = ctx.currentTime + 0.02, master = gainNode(ctx, out, 0);
    const lp = filter(ctx, master, 'lowpass', 320, 2);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.13; lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start(t);
    const oscs = [[f0, 0], [f0, 9], [f0 * 1.5, -6], [f0 * 0.5, 0]].map(([f, d], i) => {
      const x = ctx.createOscillator(), g = ctx.createGain(); x.type = i === 3 ? 'sine' : 'sawtooth';
      x.frequency.value = f; x.detune.value = d; g.gain.value = i === 3 ? 0.35 : 0.12; x.connect(g).connect(lp); x.start(t); return x;
    });
    const stopAll = [() => { oscs.forEach((x) => x.stop()); lfo.stop(); }];
    master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(0.7, t + 2.0);
    if (o.sec !== 0) {
      const sec = o.sec || 8;
      master.gain.setValueAtTime(0.7, t + sec - 2.5); master.gain.linearRampToValueAtTime(0, t + sec);
      oscs.forEach((x) => x.stop(t + sec + 0.1)); lfo.stop(t + sec + 0.1);
      return { dur: sec };
    }
    return looper(ctx, master, stopAll);
  };

  // 振り子時計「チク・タク」(柱時計)。止めるまで続く。every 1打の間隔(既定 0.5 秒 = 1秒でチク・タク)/ beats 回数を決めると止まる
  S.pendulum = (ctx, out, o = {}) => {
    const every = o.every || 0.5, master = gainNode(ctx, out, 1), bus = withReverb(ctx, master, 1.2, 0.35);
    let i = 0;
    const tick = (t, hi) => {
      noiseHit(ctx, bus, t, { f: hi ? 3400 : 2700, q: 6, dur: 0.018, peak: 1.2 });
      tone(ctx, bus, t, { f: hi ? 1250 : 940, dur: 0.05, peak: 0.25, type: 'triangle' });
      tone(ctx, bus, t, { f: hi ? 210 : 180, dur: 0.06, peak: 0.25 });
    };
    if (o.beats) {
      const t0 = ctx.currentTime + 0.02;
      for (let k = 0; k < o.beats; k++) tick(t0 + k * every, k % 2 === 0);
      return { dur: o.beats * every + 1.2 };
    }
    let next = ctx.currentTime + 0.05;
    const timer = setInterval(() => { while (next < ctx.currentTime + 0.3) { tick(next, (i++) % 2 === 0); next += every; } }, 100);
    return looper(ctx, master, [() => clearInterval(timer)]);
  };

  // 風「ヒュウゥ……」(すきま風から吹雪まで)。strong 強い風 / sec 長さ(0 で止めるまで続く)
  S.wind = (ctx, out, o = {}) => {
    const t = ctx.currentTime + 0.02, master = gainNode(ctx, out, 0), r = rand(5);
    const mk = (f, q, v) => {
      const s = ctx.createBufferSource(); s.buffer = pinkBuf(ctx); s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = v; s.connect(bp).connect(g).connect(master); s.start(t, r() * 3);
      return { s, bp, g, f };
    };
    const layers = [mk(o.strong ? 500 : 380, 0.8, 0.9), mk(o.strong ? 1300 : 900, 6, 0.35), mk(2200, 10, o.strong ? 0.18 : 0.08)];
    // 強さと高さを 0.4 秒ごとにゆっくり揺らす(ふきつけ・ゆるむ)
    let wob = t;
    const sched = () => {
      while (wob < ctx.currentTime + 1.2) {
        const k = 0.35 + r() * 0.65;
        layers.forEach((L, j) => {
          L.bp.frequency.linearRampToValueAtTime(L.f * (0.7 + k * 0.7 + j * 0.05 * r()), wob + 0.8);
          L.g.gain.linearRampToValueAtTime((j === 0 ? 0.9 : j === 1 ? 0.35 : 0.12) * k, wob + 0.8);
        });
        wob += 0.8;
      }
    };
    sched();
    const timer = setInterval(sched, 300);
    const level = o.strong ? 2.6 : 1.8;
    master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(level, t + 1.5);
    const stops = [() => clearInterval(timer), () => layers.forEach((L) => L.s.stop())];
    if (o.sec !== 0) {
      const sec = o.sec || 6;
      master.gain.setValueAtTime(level, t + sec - 1.5); master.gain.linearRampToValueAtTime(0, t + sec);
      setTimeout(() => stops.forEach((f) => f()), (sec + 0.2) * 1000);
      return { dur: sec };
    }
    return looper(ctx, master, stops);
  };

  // 鍵束「チャリ」。shake 振る回数
  S.keys = (ctx, out, o = {}) => {
    const t0 = ctx.currentTime + 0.02, r = rand(404), n = (o.shake || 1) * 7;
    const bus = withReverb(ctx, out, 0.5, 0.2);
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.floor(i / 7) * 0.35 + r() * 0.3, f = 2300 + r() * 1800;
      [1, 1.62, 2.41].forEach((m, j) => tone(ctx, bus, t, { f: f * m, dur: 0.08 + r() * 0.12, peak: (0.07 + r() * 0.05) / (j + 1) }));
      noiseHit(ctx, bus, t, { type: 'highpass', f: 5000, dur: 0.01, peak: 0.12, offset: r() });
    }
    return { dur: (o.shake || 1) * 0.35 + 0.6 };
  };

  // 鍵を回す「カチャ……ガチャン」(鍵を開ける・閉める)
  S.lockTurn = (ctx, out) => {
    const t = ctx.currentTime + 0.02, bus = withReverb(ctx, out, 0.5, 0.2);
    const click = (tt, f, v) => {
      noiseHit(ctx, bus, tt, { type: 'highpass', f: 2500, dur: 0.006, peak: 0.5 * v });
      tone(ctx, bus, tt, { f, dur: 0.05, peak: 0.12 * v, type: 'triangle' });
    };
    click(t, 2100, 0.6); click(t + 0.09, 1900, 0.5);
    noiseHit(ctx, bus, t + 0.1, { f: 3000, q: 2, dur: 0.18, peak: 0.08, attack: 0.05 }); // こすれ
    click(t + 0.34, 1300, 1);
    tone(ctx, bus, t + 0.34, { f: 160, to: 110, dur: 0.1, peak: 0.4 });
    return { dur: 1.0 };
  };

  // タイプライター「カタカタ……チーン」。chars 打つ文字数 / bell 最後に「チーン」と行を戻す
  S.typewriter = (ctx, out, o = {}) => {
    const n = o.chars || 14, t0 = ctx.currentTime + 0.02, r = rand(88), bus = withReverb(ctx, out, 0.4, 0.15);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const v = 0.7 + r() * 0.3;
      noiseHit(ctx, bus, t, { type: 'highpass', f: 1800, dur: 0.012, peak: 0.45 * v, offset: r() });
      tone(ctx, bus, t, { f: 380 + r() * 60, to: 250, dur: 0.035, peak: 0.25 * v, type: 'square' });
      tone(ctx, bus, t + 0.012, { f: 140, dur: 0.04, peak: 0.25 * v });
      t += 0.075 + r() * 0.09 + (r() < 0.15 ? 0.15 : 0);
    }
    if (o.bell !== false) {
      t += 0.12;
      tone(ctx, bus, t, { f: 2093, dur: 1.2, peak: 0.22 }); tone(ctx, bus, t, { f: 5274, dur: 0.5, peak: 0.05 });
      noiseHit(ctx, bus, t + 0.25, { f: 900, sweep: 2600, q: 2, attack: 0.03, dur: 0.38, peak: 0.12 }); // 行を戻す「ザッ」
      t += 0.8;
    }
    return { dur: t - t0 + 0.4 };
  };

  // 判子を押す「ポン」(紙に朱肉で)
  S.stamp = (ctx, out) => {
    const t = ctx.currentTime + 0.02, bus = withReverb(ctx, out, 0.5, 0.15);
    tone(ctx, bus, t, { f: 120, to: 60, glide: 0.08, dur: 0.12, peak: 0.8 });
    noiseHit(ctx, bus, t, { f: 1100, q: 0.8, dur: 0.05, peak: 0.4 });
    noiseHit(ctx, bus, t + 0.22, { f: 2400, q: 2, dur: 0.02, peak: 0.08 }); // 離すときの小さな「ペタ」
    return { dur: 0.8 };
  };

  // ページをめくる「パラッ」
  S.pageTurn = (ctx, out, o = {}) => {
    const t = ctx.currentTime + 0.02, r = rand(o.seed || 9);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx);
    const bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 0.8; s.connect(bp).connect(g).connect(out);
    bp.frequency.setValueAtTime(1300, t); bp.frequency.exponentialRampToValueAtTime(4800, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    // 紙がしなって鳴るばらつき
    for (let k = 0; k < 9; k++) g.gain.linearRampToValueAtTime(0.12 + r() * 0.3, t + 0.04 + k * 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    s.start(t, r()); s.stop(t + 0.5);
    noiseHit(ctx, out, t + 0.42, { f: 600, q: 0.7, dur: 0.06, peak: 0.12, pink: true }); // 置く「パサ」
    return { dur: 0.6 };
  };

  // 決定「ピコン」(やわらかく明るい2音)
  S.decide = (ctx, out) => {
    const t = ctx.currentTime + 0.02, bus = withReverb(ctx, out, 0.8, 0.2);
    tone(ctx, bus, t, { f: 988, dur: 0.12, peak: 0.25, type: 'triangle' });
    tone(ctx, bus, t + 0.07, { f: 1480, dur: 0.25, peak: 0.25, type: 'triangle' });
    tone(ctx, bus, t + 0.07, { f: 2960, dur: 0.15, peak: 0.04 });
    return { dur: 0.8 };
  };

  // 取り消し「ポゥ」(下がる2音・小さめ)
  S.cancel = (ctx, out) => {
    const t = ctx.currentTime + 0.02, lp = filter(ctx, out, 'lowpass', 2200, 0.7);
    tone(ctx, lp, t, { f: 740, dur: 0.09, peak: 0.22, type: 'triangle' });
    tone(ctx, lp, t + 0.08, { f: 494, to: 440, dur: 0.18, peak: 0.2, type: 'triangle' });
    return { dur: 0.4 };
  };

  // 解放「キラララン」(新しい物が使えるようになった・ひらく)
  S.unlock = (ctx, out) => {
    const t = ctx.currentTime + 0.02, bus = withReverb(ctx, out, 2.2, 0.4);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(ctx, bus, t + i * 0.07, { f, dur: 0.6, peak: 0.16, type: 'triangle' });
      tone(ctx, bus, t + i * 0.07, { f: f * 2, dur: 0.3, peak: 0.04 });
    });
    tone(ctx, bus, t + 0.38, { f: 2093, dur: 1.3, peak: 0.12 });
    noiseHit(ctx, bus, t + 0.3, { type: 'highpass', f: 7000, attack: 0.1, dur: 0.6, peak: 0.06 }); // きらめき
    return { dur: 2.6 };
  };

  // 恋の場面のやわらかな音(ふわっと広がるベルの和音)
  S.loveSoft = (ctx, out) => {
    const t = ctx.currentTime + 0.02, bus = withReverb(ctx, out, 3, 0.55);
    [349.23, 440, 523.25, 659.25, 880].forEach((f, i) => {
      const tt = t + i * 0.12;
      tone(ctx, bus, tt, { f, dur: 1.8, peak: 0.13, attack: 0.02 });
      tone(ctx, bus, tt, { f: f * 3, dur: 0.6, peak: 0.02 });
    });
    return { dur: 4.2 };
  };

  // 鐘(合成版)「ゴォーン」。f 高さ(既定 98Hz。低いほど不吉)
  S.bellToll = (ctx, out, o = {}) => {
    const f0 = o.f || 98, t = ctx.currentTime + 0.02, bus = withReverb(ctx, out, 4, 0.45);
    const lp = filter(ctx, bus, 'lowpass', 3000, 0.7);
    // 鐘の倍音(ハム音・基音・短三度・五度・オクターブ…)。高い音ほど早く消える
    [[0.5, 0.35, 7], [1, 0.3, 5], [1.19, 0.18, 3.5], [1.5, 0.12, 3], [2, 0.12, 2.6], [2.52, 0.06, 1.8], [3.01, 0.05, 1.4], [4.1, 0.03, 1]]
      .forEach(([m, v, d]) => tone(ctx, lp, t, { f: f0 * m, dur: d, peak: v, attack: 0.004, detune: (m * 7) % 5 - 2 }));
    noiseHit(ctx, lp, t, { f: 1800, q: 1, dur: 0.05, peak: 0.25 }); // 撞木が当たる
    return { dur: 7.5 };
  };

  // 扉のきしみ「ギィィ……」(こすれて引っかかる音を、木の箱の響きに通す)。len 長さ / high 高めのきしみ
  const creak = (ctx, out, t, o) => {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const f = o.from, to = o.to, len = o.len, r = rand(17);
    osc.frequency.setValueAtTime(f, t);
    // 引っかかり: 速さが細かくゆらぐ
    for (let k = 1; k <= 12; k++) osc.frequency.linearRampToValueAtTime((f + (to - f) * (k / 12)) * (0.85 + r() * 0.3), t + len * k / 12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.peak, t + 0.05);
    g.gain.setValueAtTime(o.peak, t + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const b1 = filter(ctx, out, 'bandpass', o.body || 700, 7), b2 = filter(ctx, out, 'bandpass', (o.body || 700) * 2.3, 9);
    osc.connect(g); g.connect(b1); g.connect(b2); osc.start(t); osc.stop(t + len + 0.05);
  };
  S.doorCreak = (ctx, out, o = {}) => {
    const t = ctx.currentTime + 0.02, len = o.len || 1.6, bus = withReverb(ctx, out, 1.4, 0.3);
    creak(ctx, bus, t, { len, from: o.high ? 70 : 45, to: o.high ? 120 : 75, peak: 0.55, body: o.high ? 1100 : 650 });
    creak(ctx, bus, t + len * 0.35, { len: len * 0.5, from: 90, to: 60, peak: 0.25, body: 1500 });
    return { dur: len + 1.4 };
  };

  // ---- 一覧(試し聴きのページと資料が読む)------------------------------------
  const LIST = [
    ['knock', 'ノック「コン、コン、コン」', '事件簿: 部屋を訪ねる・夜中の訪問者。ほかのモード: 助手の部屋に入る', { count: 3 }],
    ['stepWood', '木の床の足音', '事件簿: 廊下を歩く・誰かが近づく', { count: 4 }],
    ['stepSnow', '雪を踏む足音', '事件簿: 雪の庭・足跡を調べる', { count: 4 }],
    ['heartbeat', '心臓の音「ドクン」', '事件簿: 緊張・推理の問いの直前(beats:0 で止めるまで続く)', { beats: 6 }],
    ['breath', '息づかい', '事件簿: 隠れている・おびえる(fast:true で早い息)', { count: 2 }],
    ['drone', '低いうなり', '事件簿: 不穏な場面の下敷き(sec:0 で止めるまで続く)', { sec: 8 }],
    ['pendulum', '振り子時計「チク・タク」', '事件簿: 選択肢を待つ間・広間(止めるまで続く)', { beats: 8 }],
    ['wind', '風「ヒュウゥ」', '事件簿: 外の風・吹雪(strong:true)。止めるまで続けるには sec:0', { sec: 6 }],
    ['keys', '鍵束「チャリ」', '事件簿: 鍵を見つける・管理人が来る', {}],
    ['lockTurn', '鍵を回す「カチャ……ガチャン」', '事件簿: 扉を開ける・閉じこめられる', {}],
    ['typewriter', 'タイプライター「カタカタ……チーン」', '事件簿: 調書・手紙を打つ・章の題名', { chars: 14 }],
    ['stamp', '判子を押す「ポン」', '事件簿: 証拠を確定・解決の印。ほかのモード: ミッション達成の判', {}],
    ['pageTurn', 'ページをめくる「パラッ」', '事件簿: 手帳・日記を読む。ほかのモード: ヘルプ・図鑑', {}],
    ['decide', '決定「ピコン」', 'どのモードでも: 決める・選ぶ', {}],
    ['cancel', '取り消し「ポゥ」', 'どのモードでも: やめる・戻る', {}],
    ['unlock', '解放「キラララン」', 'どのモードでも: 新しい章・物・機能がひらく', {}],
    ['loveSoft', '恋の場面のやわらかな和音', '事件簿: 心が動く一言。ほかのモード: 好感度が上がる', {}],
    ['bellToll', '鐘「ゴォーン」(合成版)', '事件簿: 時を告げる・死の知らせ(f で高さ)', {}],
    ['doorCreak', '扉のきしみ「ギィィ」', '事件簿: 古い扉が開く・地下室への扉(high:true で高め)', {}],
  ];

  root.MH_SE_SYNTH = {
    list: LIST.map(([id, name, scene, demo]) => ({ id, name, scene, demo })),
    play: (id, ctx, out, opts) => {
      const f = S[id]; if (!f) throw new Error('MH_SE_SYNTH: 知らない音 ' + id);
      return f(ctx, out || ctx.destination, opts || {}) || { dur: 0 };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
