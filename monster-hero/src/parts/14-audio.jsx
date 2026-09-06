const Audio_ = (() => {
  let Tone = null, ready = false, loading = null, started = false;
  let reverb = null, seBus = null;
  let audioCtx = null, bgmGain = null;
  const buffers = new Map();
  const loadingBuffers = new Map();
  // previewRequest は試聴の「この呼び出しが今も最新か」を見るための番号。
  // 通常BGM(bgmRequest)と同じ役目で、読み込みを待っているあいだに止められたり
  // 押し直されたりした古い呼び出しが、あとから音を鳴らし始めるのを防ぐ
  let bgmSource = null, bgmSourceKey = null, bgmRequest = 0, previewSource = null, previewKey = null, previewRequest = 0;
  let jingleSource = null, jingleTimer = null;
  let currentKey = null, bgmVolumePct = 0, seVolumePct = 0, pageHidden = false;
  let enabled = false;
  // 音ゲーのBGM音量は、メインのBGM音量設定(対数カーブ・bgmGain)を経由させず独立させる。
  // ただし全体ミュート(タイトルの「音がオフです」)だけは共通で効かせる。
  // 稼働中のgainノードを覚えておき、ミュート切り替え時にまとめて反映する。
  const activeRhythmGains = new Set();
  const applyRhythmMute = () => { activeRhythmGains.forEach(entry => { entry.node.gain.value = enabled ? entry.raw : 0; }); };

  const load = () => {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res) => {
      if (typeof window !== 'undefined' && window.Tone) { Tone = window.Tone; res(); return; }
      if (typeof document === 'undefined') { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
      s.onload = () => { Tone = window.Tone; res(); };
      s.onerror = () => { res(); };
      document.head.appendChild(s);
    }).then(async () => {
      if (!Tone) return;
      try {
        seBus = new Tone.Gain(_gainFromPct(seVolumePct)).toDestination();
        reverb = new Tone.Reverb({ decay: 2.4, wet: 0.22 }).connect(seBus);
        try { await reverb.ready; } catch (e) {}
        ready = true;
      } catch(e){}
    });
    return loading;
  };

  const ensure = async () => { await load(); if (Tone && !started) { try { await Tone.start(); started = true; } catch (e) {} } };

  const JINGLE_FILES = { victory: 'audio/jingle-victory.mp3' };
  const _gainFromPct = (pct) => pct <= 0 ? 0 : Math.pow(10, (-40 + (Math.min(100, pct) / 100) * 40) / 20);
  const _bgmGain = (pct) => pct <= 0 ? 0 : Math.pow(10, (-55 + (Math.min(100, pct) / 100) * 55) / 20) * 0.55;

  // HTMLAudioElementはiOSの消音スイッチを無視するため使用しない。mp3を取得・デコードし、
  // BGMもジングルもAudioBufferSourceNodeだけで出力する。
  const getAudioCtx = () => {
    if (audioCtx) return audioCtx;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = _bgmGain(bgmVolumePct);
      bgmGain.connect(audioCtx.destination);
      bindResumeOnGesture();
    } catch (e) { audioCtx = null; bgmGain = null; }
    return audioCtx;
  };
  // AudioContextは端末側の自動再生制限・省電力・他アプリの音声フォーカスで止められる。
  // 止まったまま start() しても無音になるだけなので、次のタップで必ず復帰させる。
  // タップはuser activationが有効な唯一の機会なので、ここでresume()を呼ぶ意味がある
  let resumeOnGestureBound = false;
  const bindResumeOnGesture = () => {
    if (resumeOnGestureBound || typeof document === 'undefined') return;
    resumeOnGestureBound = true;
    const onGesture = () => {
      const ctx = audioCtx;
      if (!ctx || ctx.state === 'running') return;
      let done = null;
      try { done = ctx.resume(); } catch (e) {}
      const after = () => { if (audioCtx && audioCtx.state === 'running' && enabled && !pageHidden && currentKey && !bgmSource && !jingleSource && !previewSource) playBGM(currentKey); };
      if (done && done.then) done.then(after, () => {}); else setTimeout(after, 0);
    };
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(type => {
      try { document.addEventListener(type, onGesture, { capture: true, passive: true }); } catch (e) { document.addEventListener(type, onGesture, true); }
    });
  };
  const resumeAudioCtxNoWait = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    return ctx;
  };
  const ensureAudioCtxRunning = async () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    return ctx;
  };
  const decode = (ctx, data) => new Promise((resolve, reject) => {
    let settled = false;
    const ok = (value) => { if (!settled) { settled = true; resolve(value); } };
    const ng = (error) => { if (!settled) { settled = true; reject(error); } };
    try { const p = ctx.decodeAudioData(data, ok, ng); if (p && p.then) p.then(ok, ng); } catch (e) { ng(e); }
  });
  const loadBuffer = (url) => {
    if (buffers.has(url)) return Promise.resolve(buffers.get(url));
    if (loadingBuffers.has(url)) return loadingBuffers.get(url);
    const ctx = getAudioCtx();
    if (!ctx || typeof fetch !== 'function') return Promise.reject(new Error('Web Audio unavailable'));
    const request = fetch(url, { cache: 'force-cache' }).then((res) => {
      if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
      return res.arrayBuffer();
    }).then((data) => decode(ctx, data)).then((buffer) => { buffers.set(url, buffer); return buffer; })
      .finally(() => loadingBuffers.delete(url));
    loadingBuffers.set(url, request);
    return request;
  };
  const stopSource = (source) => { if (source) { try { source.onended = null; source.stop(); } catch (e) {} try { source.disconnect(); } catch (e) {} } };
  const stopJingles = () => { if (jingleTimer) clearTimeout(jingleTimer); jingleTimer = null; stopSource(jingleSource); jingleSource = null; };
  const stopOthers = () => { stopSource(bgmSource); bgmSource = null; bgmSourceKey = null; };
  const resolveTrack = key => BGM_TRACK_BY_ID[key] || BGM_TRACK_BY_KEY[key] || null;
  const safeTrackGain = track => Math.max(0, Math.min(1.25, Number.isFinite(track?.gain) ? track.gain : 1));
  const applyTrackGain = track => { if (bgmGain) bgmGain.gain.value = Math.min(1, _bgmGain(bgmVolumePct) * safeTrackGain(track)); };

  const startBgmBuffer = (key, track, buffer, request) => {
    const ctx = getAudioCtx();
    if (!ctx || request !== bgmRequest || key !== currentKey || !enabled || bgmVolumePct <= 0 || pageHidden || jingleSource || previewSource) return;
    if (bgmSource && bgmSourceKey === key) return;
    stopOthers();
    const source = ctx.createBufferSource();
    applyTrackGain(track);
    source.buffer = buffer; source.loop = track.loop !== false; source.connect(bgmGain);
    bgmSource = source; bgmSourceKey = key;
    source.onended = () => { if (bgmSource === source) { bgmSource = null; bgmSourceKey = null; } };
    try { source.start(0); } catch (e) { stopOthers(); return; }
    // 止まったままのAudioContextで鳴らしても無音のままになる。すぐに復帰を試す
    // (失敗しても、次のタップで bindResumeOnGesture が鳴らし直す)
    if (ctx.state !== 'running') resumeAudioCtxNoWait();
  };
  const playBGM = (key) => {
    const track = resolveTrack(key); if (!track) return Promise.resolve();
    currentKey = track.id;
    const request = ++bgmRequest;
    if (bgmSourceKey && bgmSourceKey !== track.id) stopOthers();
    if (!enabled || bgmVolumePct <= 0 || pageHidden) { stopOthers(); stopJingles(); return Promise.resolve(); }
    resumeAudioCtxNoWait();
    // 起動タップ前にdecode済みなら、user activation中に同期的に再生開始する。
    if (buffers.has(track.src)) {
      startBgmBuffer(track.id, track, buffers.get(track.src), request);
      return Promise.resolve();
    }
    return loadBuffer(track.src).then((buffer) => startBgmBuffer(track.id, track, buffer, request)).catch(() => {});
  };
  // 番号を進めることで、読み込み待ちの古い試聴を無効にする(あとから鳴り出さない)
  const stopPreview = (resume = true) => { ++previewRequest; stopSource(previewSource); previewSource = null; previewKey = null; if (resume && currentKey) playBGM(currentKey); };
  const previewBGM = async key => {
    const track = resolveTrack(key); if (!track) return false;
    if (previewKey === track.id) { stopPreview(true); return false; }
    stopPreview(false); stopJingles(); stopOthers();
    // stopPreview が番号を進めたあとに受け取るので、この値はこの呼び出し専用。
    // 曲名だけで見張っていると、同じ曲を素早く押し直したときに古い呼び出しも
    // 条件を通ってしまい、音源が2つ鳴って片方が参照から外れる(誰も止められなくなる)。
    // 実際に「止めても鳴り続ける・アレンジを閉じても鳴り続ける」不具合になっていた
    const request = previewRequest;
    previewKey = track.id;
    // 通常BGM(playBGM)と同じく、タップが効いているうちに同期でresumeを始める。
    // 読み込みを待ってから初めてresumeすると、user activationが切れていて復帰できない端末がある
    resumeAudioCtxNoWait();
    try { const buffer = await loadBuffer(track.src);
      if (request !== previewRequest || previewKey !== track.id || !enabled || pageHidden || bgmVolumePct <= 0) return false;
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return false;
      // ensureAudioCtxRunning も待つので、そのあいだに止められていないかもう一度見る
      if (request !== previewRequest) return false;
      applyTrackGain(track);
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = track.loop !== false; source.connect(bgmGain); previewSource = source;
      source.onended = () => { if (previewSource === source) stopPreview(true); }; source.start(0);
      // 止まったままのAudioContextで鳴らしても無音。もう一度だけ復帰を試し、
      // それでも動かなければ「鳴っている」と嘘をつかずに戻す(次のタップでやり直せる)
      if (ctx.state !== 'running') { await ensureAudioCtxRunning(); }
      // 復帰待ちのあいだに止められていたら、いま鳴らし始めたぶんを取り逃さず止める
      if (request !== previewRequest) { stopSource(source); if (previewSource === source) { previewSource = null; previewKey = null; } return false; }
      if (ctx.state !== 'running') { if (previewKey === track.id) stopPreview(false); return false; }
      return true;
    } catch (e) { if (request === previewRequest && previewKey === track.id) stopPreview(true); return false; }
  };
  const stopBGM = () => { currentKey = null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers(); };
  // 音ゲーの時刻は AudioContext.currentTime と再生offsetだけを正本にする。
  // BufferSourceNodeは一度stopしたら再利用せず、再開のたびにoffsetから作り直す。
  // options.autoStart:false を渡すと「音源の用意だけして、まだ鳴らさない」。
  // 音ゲー本体は、画面が組み上がるのを待ってから start() で鳴らし始める
  // (先に鳴らすと、まだノーツを置けていない間に曲だけ進んでMISSが積み上がる)。
  const startRhythmTrack = async (key,rhythmVolumePct=100,options=null) => {
    const autoStart=options?.autoStart!==false;
    const track=resolveTrack(key); if(!track) return null;
    currentKey=null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers();
    resumeAudioCtxNoWait();
    try {
      const buffer=await loadBuffer(track.src),ctx=await ensureAudioCtxRunning();
      if(!ctx) return null;
      let source=null,startedAt=ctx.currentTime,offsetSeconds=0,playing=false,stopped=false,naturallyEnded=false,gainEntry=null;
      const dropGainEntry=()=>{if(gainEntry){activeRhythmGains.delete(gainEntry);gainEntry=null;}};
      const startSource=offset=>{
        if(stopped||offset>=buffer.duration){naturallyEnded=true;return false;}
        const nextSource=ctx.createBufferSource(),rhythmGain=ctx.createGain();
        const raw=Math.max(0,Math.min(1,Number(rhythmVolumePct)/100))*safeTrackGain(track);
        dropGainEntry(); gainEntry={node:rhythmGain,raw}; activeRhythmGains.add(gainEntry);
        rhythmGain.gain.value=enabled?raw:0;
        // 音ゲー専用の音量なので、メインのBGM音量(bgmGain)は経由せず直接destinationへ繋ぐ。
        // 全体ミュート(enabled)だけはactiveRhythmGains経由で共通に反映する。
        nextSource.buffer=buffer; nextSource.loop=false; nextSource.connect(rhythmGain);rhythmGain.connect(ctx.destination);
        source=nextSource; offsetSeconds=offset; startedAt=ctx.currentTime; playing=true;
        nextSource.onended=()=>{if(source===nextSource&&playing){playing=false;naturallyEnded=true;source=null;}};
        nextSource.start(0,offset); return true;
      };
      const songTimeSeconds=()=>Math.min(buffer.duration,Math.max(0,offsetSeconds+(playing?ctx.currentTime-startedAt:0)));
      if(autoStart)startSource(0);
      return {
        // autoStart:false で用意したぶんを、頭から鳴らし始める。
        // すでに鳴っている・止めたあとなら何もしない(二重に鳴らさない)
        start:()=>{if(playing||stopped||naturallyEnded)return playing;return startSource(0);},
        started:()=>playing,
        songTimeMs:()=>songTimeSeconds()*1000,
        durationMs:buffer.duration*1000,
        ended:()=>naturallyEnded||songTimeSeconds()>=buffer.duration,
        paused:()=>!playing&&!stopped&&!naturallyEnded,
        pause:()=>{if(!playing||stopped)return;offsetSeconds=songTimeSeconds();playing=false;const old=source;source=null;stopSource(old);},
        resume:async()=>{if(playing||stopped||naturallyEnded)return playing;await ensureAudioCtxRunning();return startSource(offsetSeconds);},
        restart:async()=>{if(stopped)return false;playing=false;naturallyEnded=false;const old=source;source=null;stopSource(old);offsetSeconds=0;await ensureAudioCtxRunning();return startSource(0);},
        // 譜面より音源のほうが長い曲を途中で終わらせるとき、最後の少しだけ音量を落とす。
        // (2026-09-06) デュラハンの2曲は音源がバトルのBGMと同じファイルなので切れない。
        // 何もしないと曲の途中でぶつっと止まるため、終わりの手前からなめらかに消す。
        // 全体ミュートの控え(raw)も0にしておく。ミュートを切り替えても音が戻らないようにするため。
        fadeOut:(ms)=>{
          if(stopped||!playing||!gainEntry)return false;
          const seconds=Math.max(.05,(Number(ms)||0)/1000);
          try{
            const node=gainEntry.node,at=ctx.currentTime;
            node.gain.cancelScheduledValues(at);
            node.gain.setValueAtTime(node.gain.value,at);
            node.gain.linearRampToValueAtTime(0,at+seconds);
            gainEntry.raw=0;
          }catch{return false;}
          return true;
        },
        stop:()=>{if(stopped)return;stopped=true;playing=false;const old=source;source=null;stopSource(old);dropGainEntry();},
      };
    } catch(e){ return null; }
  };
  const preloadBGM = (key) => { const track = resolveTrack(key); if (track) loadBuffer(track.src).catch(() => {}); };
  const prepareBGM = (key, timeoutMs = 2000) => {
    const track = resolveTrack(key); if (!track) return Promise.resolve(false);
    return Promise.race([loadBuffer(track.src).then(() => true).catch(() => false), new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
  };
  const prepareSE = (timeoutMs = 5000) => Promise.race([
    load().then(() => true).catch(() => false),
    new Promise((r) => setTimeout(() => r(false), timeoutMs)),
  ]);
  const playJingle = async (key) => {
    if (!enabled || bgmVolumePct <= 0 || pageHidden || !JINGLE_FILES[key]) return;
    const request = ++bgmRequest;
    try {
      const buffer = await loadBuffer(JINGLE_FILES[key]);
      if (request !== bgmRequest || !enabled || pageHidden) return;
      stopJingles(); stopOthers();
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return;
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(bgmGain); jingleSource = source;
      const backToBGM = () => { if (jingleSource !== source) return; stopJingles(); if (currentKey) playBGM(currentKey); };
      source.onended = backToBGM;
      source.start(0);
      jingleTimer = setTimeout(backToBGM, Math.ceil(buffer.duration * 1000) + 250);
    } catch (e) { if (currentKey) playBGM(currentKey); }
  };
  const setPageHidden = (hidden) => { pageHidden = !!hidden; if (pageHidden) { ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); } else if (currentKey) playBGM(currentKey); };
  const setEnabled = async (on) => { enabled = !!on; if (typeof window !== 'undefined') window.__mhAudioEnabled = enabled; applyRhythmMute(); if (!enabled) { ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); } else if (currentKey) playBGM(currentKey); await ensure(); };
  const isEnabled = () => enabled;
  // いま実際に鳴っている曲を、外(検査)から見るための口。
  // BGMは <audio> ではなく Web Audio (AudioBufferSourceNode) で鳴らしているので、
  // document.querySelectorAll('audio') では1つも見えない。
  // そのため起動まわりの検査(tools/boot/boot-check.js)が「鳴っていない」と誤判定していた
  // (2026-09-05)。プレイヤーの画面には何も出ないし、ゲームの動きも変えない。
  const debugPlayingTracks = () => {
    // 曲キーだけでなく、実際に鳴っている音のファイル名も返す。
    // 検査は「bgm-title で始まる」のようにファイル名で見たいため。
    const entry = (kind, key) => {
      const track = resolveTrack(key);
      const url = String(track?.url || track?.src || '');
      return { kind, key: String(key || ''), src: url.split('/').pop().split('?')[0] };
    };
    const list = [];
    // 鳴らしているのは同時に1つ(BGM / 試聴 / ジングル のどれか)
    if (jingleSource) list.push(entry('jingle', currentKey));
    else if (previewSource) list.push(entry('preview', previewKey));
    else if (bgmSource) list.push(entry('bgm', bgmSourceKey));
    return { enabled, ctxState: (() => { try { return getAudioCtx()?.state || 'none'; } catch (e) { return 'none'; } })(), playing: list };
  };
  // 「その場面で本来どの曲が鳴るはずか」も外から引けるようにする。
  // 検査がファイル名を書き写すと、既定を変えたときに黙って落ちるため。
  const debugExpectedSrc = (scene) => {
    const track = resolveTrack(DEFAULT_BGM_ARRANGEMENT[scene]);
    const url = String(track?.url || track?.src || '');
    return url ? url.split('/').pop().split('?')[0] : null;
  };
  if (typeof window !== 'undefined') {
    try { window.__mhAudioDebug = debugPlayingTracks; window.__mhAudioExpectedSrc = debugExpectedSrc; } catch (e) {}
  }
  const setSeVolume = (pct) => { seVolumePct = pct; if (seBus && Tone) { try { seBus.gain.rampTo(_gainFromPct(pct), 0.05); } catch (e) {} } };
  const setBgmVolume = (pct) => { bgmVolumePct = pct; applyTrackGain(resolveTrack(previewKey || currentKey)); if (pct <= 0) { stopPreview(false); stopOthers(); } else if (enabled && currentKey && !previewKey) playBGM(currentKey); };
  const resumeIfNeeded = async () => { await ensureAudioCtxRunning(); if (Tone) { try { await Tone.start(); started = true; } catch (e) {} } if (enabled && currentKey && !bgmSource) playBGM(currentKey); };
  const unlock = async (playTestTone = false) => {
    if (!enabled) { enabled = true; if (typeof window !== 'undefined') window.__mhAudioEnabled = true; applyRhythmMute(); }
    // resume・決定SEはuser activationが残るイベント処理内で開始し、最初の再生前に待たない。
    const ctx = resumeAudioCtxNoWait();
    let toneStart = null;
    if (Tone) {
      try { toneStart = Tone.start(); if (toneStart?.catch) toneStart.catch(() => {}); } catch (e) {}
      if (playTestTone && ready && enabled && seVolumePct > 0) {
        try { const tb = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:0.005,decay:0.15,sustain:0.1,release:0.2}, volume: -6 }).connect(seBus); const now = Tone.now(); tb.triggerAttackRelease('C5','8n', now); tb.triggerAttackRelease('G5','8n', now+0.12); setTimeout(()=>{ try{tb.dispose();}catch(e){} }, 800); } catch(e){}
      }
    }
    await Promise.all([ensureAudioCtxRunning(), toneStart || Promise.resolve(), load()]);
    started = !!Tone;
    if (currentKey) playBGM(currentKey);
    return !ctx || ctx.state === 'running';
  };
  const ensurePlaying = (key) => { if (enabled && key === currentKey && !bgmSource && !jingleSource) playBGM(key); };
  const isContextRunning = () => !!audioCtx && audioCtx.state === 'running';

  const se = {
    trainingDice: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t=Tone.now(); const n=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:.001,decay:.22,sustain:0},volume:-15}).connect(seBus); n.triggerAttackRelease('8n',t); setTimeout(()=>{try{n.dispose();}catch(e){}},500); },
    trainingDecide: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({volume:-14}).connect(seBus); s.triggerAttackRelease('C6','16n'); setTimeout(()=>{try{s.dispose();}catch(e){}},300); },
    trainingGood: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({volume:-14}).connect(reverb); s.triggerAttackRelease('E6','8n'); setTimeout(()=>{try{s.dispose();}catch(e){}},400); },
    trainingMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.001,decay:.05,sustain:0},volume:-16}).connect(seBus); s.triggerAttackRelease('G5','32n'); setTimeout(()=>{try{s.dispose();}catch(e){}},250); },
    trainingReward: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.003,decay:.15,sustain:0},volume:-12}).connect(reverb); const t=Tone.now(); s.triggerAttackRelease('C6','16n',t); s.triggerAttackRelease('E6','16n',t+.08); setTimeout(()=>{try{s.dispose();}catch(e){}},500); },
    trainingBad: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:.003,decay:.18,sustain:0},volume:-15}).connect(seBus); s.triggerAttackRelease('C3','8n'); setTimeout(()=>{try{s.dispose();}catch(e){}},500); },
    trainingTool: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.003,decay:.2,sustain:0},volume:-13}).connect(reverb); const t=Tone.now(); ['G5','B5','D6'].forEach((n,i)=>s.triggerAttackRelease(n,'16n',t+i*.07)); setTimeout(()=>{try{s.dispose();}catch(e){}},600); },
    trainingGoal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.PolySynth(Tone.Synth,{volume:-15}).connect(reverb); s.triggerAttackRelease(['C5','E5','G5','C6'],'2n'); setTimeout(()=>{try{s.dispose();}catch(e){}},1200); },
    trainingFail: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.01,decay:.5,sustain:0},volume:-13}).connect(reverb); const t=Tone.now(); s.triggerAttackRelease('E4','4n',t); s.triggerAttackRelease('C4','2n',t+.25); setTimeout(()=>{try{s.dispose();}catch(e){}},1200); },
    attack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -4 }).connect(seBus); s.triggerAttackRelease('C2', '8n', t); const n = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -16 }).connect(seBus); n.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 500); },
    special: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const c = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.18, decay: 0.05, sustain: 0.3, release: 0.1 }, volume: -12 }).connect(reverb); c.triggerAttackRelease('C3', '8n.', t); try { c.frequency.rampTo('C4', 0.22, t); } catch (e) {} const bt = t + 0.26; const boom = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -2 }).connect(seBus); boom.triggerAttackRelease('C1', '4n', bt); const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -12 }).connect(seBus); blast.triggerAttackRelease('8n', bt); const sh = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.2 }, volume: -8 }).connect(reverb); ['C5','G5','C6','E6','G6'].forEach((nn, i) => sh.triggerAttackRelease(nn, '32n', bt + i * 0.05)); setTimeout(() => { try { c.dispose(); boom.dispose(); blast.dispose(); sh.dispose(); } catch (e) {} }, 1400); },
    guard: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.18, release: 0.1 }, harmonicity: 5.1, modulationIndex: 16, resonance: 4000, octaves: 1.2, volume: -20 }).connect(seBus); s.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 500); },
    card: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 }, volume: -12 }).connect(seBus); s.triggerAttackRelease('E6', '32n', t); s.triggerAttackRelease('A6', '32n', t + 0.04); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 300); },
    crit: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.1, sustain: 0.1, release: 0.15 }, volume: -8 }).connect(reverb); ['C5','E5','G5','C6','E6'].forEach((n, i) => s.triggerAttackRelease(n, '32n', t + i * 0.04)); const b = new Tone.MembraneSynth({ volume: -6 }).connect(seBus); b.triggerAttackRelease('C2', '8n', t); setTimeout(() => { try { s.dispose(); b.dispose(); } catch (e) {} }, 700); },
    zanSlash: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const swish = (st) => { const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -18 }).connect(reverb); n.triggerAttackRelease('32n', st); const p = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.04 }, volume: -13 }).connect(reverb); p.triggerAttackRelease('C7', '32n', st); try { p.frequency.rampTo('G6', 0.1, st); } catch (e) {} setTimeout(() => { try { n.dispose(); p.dispose(); } catch (e) {} }, 350); }; swish(t); swish(t + 0.09); },
    heal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -12 }).connect(reverb); ['G4','C5','E5','G5','C6'].forEach((n, i) => s.triggerAttackRelease(n, '16n', t + i * 0.07)); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 900); },
    tap: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -16 }).connect(seBus); s.triggerAttackRelease('C6', '64n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 200); },
    enemyAttack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -3 }).connect(seBus); s.triggerAttackRelease('A1', '4n', t); const g = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -12 }).connect(seBus); g.triggerAttackRelease('8n', t); setTimeout(() => { try { s.dispose(); g.dispose(); } catch (e) {} }, 700); },
    enemySpecial: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      // ① 溜め: 下降する不穏なうなり
      const charge = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.25, decay: 0.05, sustain: 0.4, release: 0.1 }, volume: -8 }).connect(seBus);
      charge.triggerAttackRelease('A2', '4n', t); try { charge.frequency.rampTo('A1', 0.4, t); } catch (e) {}
      // ② 大炸裂: 超低音ドゥーン + 金属的インパクト + ホワイトノイズ爆発
      const bt = t + 0.42;
      const boom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 8, envelope: { attack: 0.001, decay: 0.6, sustain: 0 }, volume: 2 }).connect(seBus);
      boom.triggerAttackRelease('C1', '2n', bt);
      const metal = new Tone.MetalSynth({ frequency: 120, envelope: { attack: 0.001, decay: 0.5, release: 0.2 }, harmonicity: 3.5, modulationIndex: 32, resonance: 3000, octaves: 1.5, volume: -10 }).connect(seBus);
      metal.triggerAttackRelease('16n', bt);
      const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6 }).connect(seBus);
      blast.triggerAttackRelease('4n', bt);
      // ③ 不穏な残響: 不協和音(半音ぶつけ)
      const dread = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.6 }, volume: -16 }).connect(reverb);
      ['C2','C#2','G2'].forEach(n => dread.triggerAttackRelease(n, '2n', bt + 0.05));
      setTimeout(() => { try { charge.dispose(); boom.dispose(); metal.dispose(); blast.dispose(); dread.dispose(); } catch (e) {} }, 2000); },
    // 必殺技の準備(ためる)の音。上へ登っていくうなりと、集まっていくきらめきだけで、
    // 炸裂音は鳴らさない。必殺技そのものの音(enemySpecial)を使うと
    // 「準備しただけなのに撃たれた」ように聞こえてしまうため分けている
    enemyCharge: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      const hum = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.35, decay: 0.1, sustain: 0.5, release: 0.35 }, volume: -14 }).connect(seBus);
      hum.triggerAttackRelease('A1', '2n', t); try { hum.frequency.rampTo('A2', 0.85, t); } catch (e) {}
      const shimmer = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.16, sustain: 0, release: 0.1 }, volume: -18 }).connect(reverb);
      [[0.05,'E5'],[0.24,'G5'],[0.43,'B5'],[0.62,'E6'],[0.8,'B6']].forEach(([tt, n]) => shimmer.triggerAttackRelease(n, '16n', t + tt));
      setTimeout(() => { try { hum.dispose(); shimmer.dispose(); } catch (e) {} }, 1600); },
    enemyMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 }, volume: -14 }).connect(seBus); s.triggerAttackRelease('E4', '32n', t); s.triggerAttackRelease('B3', '16n', t + 0.06); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 400); },
    join: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.4 }, volume: -10 }).connect(reverb); const t = Tone.now(); const seq = [[0,'E5','8n'],[0.15,'G5','8n'],[0.3,'C6','8n'],[0.45,'E6','4n'],[0.45,'C6','4n'],[0.45,'G5','4n'],[0.8,'D6','8n'],[0.95,'E6','4n'],[0.95,'C6','4n'],[0.95,'G5','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1800); },
    victory: async () => { if (!enabled) return; await ensure(); if (!Tone) return; stopOthers(null); currentKey = null; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, volume: -19 }).connect(reverb); const vb = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -19 }).connect(seBus); const t = Tone.now(); const seq = [[0,'C5','8n'],[0,'E5','8n'],[0,'G5','8n'],[0.18,'C5','8n'],[0.18,'E5','8n'],[0.18,'G5','8n'],[0.36,'C5','8n'],[0.36,'E5','8n'],[0.36,'G5','8n'],[0.54,'G5','4n'],[0.54,'C6','4n'],[0.54,'E6','4n'],[0.9,'F5','8n'],[0.9,'A5','8n'],[1.08,'G5','8n'],[1.08,'B5','8n'],[1.26,'C6','2n'],[1.26,'E6','2n'],[1.26,'G6','2n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); [[0,'C3'],[0.54,'C3'],[0.9,'F2'],[1.08,'G2'],[1.26,'C3']].forEach(([tt, n]) => vb.triggerAttackRelease(n, '4n', t + tt)); setTimeout(() => { try { v.dispose(); vb.dispose(); } catch (e) {} }, 2600); },
    levelUp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -12 }).connect(reverb); const seq = [[0,'C5','16n'],[0.08,'E5','16n'],[0.16,'G5','16n'],[0.24,'C6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const sp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }, volume: -16 }).connect(reverb); sp.triggerAttackRelease('C6', '2n', t + 0.24); setTimeout(() => { try { v.dispose(); sp.dispose(); } catch (e) {} }, 1200); },
    // 合体演出用: 上昇アルペジオ→(両者が重なるタイミングで)ベルの一撃+きらめき和音の「ピカーン」
    fusion: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.5 }, volume: -10 }).connect(reverb); const seq = [[0,'C5','8n'],[0.12,'E5','8n'],[0.24,'G5','8n'],[0.36,'C6','8n'],[0.48,'E6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const bt = t + 0.6; const bell = new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.6, release: 0.3 }, harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 1.5, volume: -14 }).connect(reverb); bell.triggerAttackRelease('16n', bt); const sparkle = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 }, volume: -12 }).connect(reverb); ['C6','E6','G6','C7'].forEach((n, i) => sparkle.triggerAttackRelease(n, '8n', bt + i * 0.03)); setTimeout(() => { try { v.dispose(); bell.dispose(); sparkle.dispose(); } catch (e) {} }, 2200); }
  };

  return { playBGM, stopBGM, startRhythmTrack, previewBGM, stopPreview, setEnabled, isEnabled, setSeVolume, setBgmVolume, unlock, resumeIfNeeded, setPageHidden, preloadBGM, prepareBGM, prepareSE, playJingle, ensurePlaying, isContextRunning, se };
})();
