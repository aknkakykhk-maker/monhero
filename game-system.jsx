
// ==== グローバル(UMD)から React フックと lucide アイコンを取得 ====
const { useState, useEffect, useCallback, useMemo, useRef } = React;
// ==== アイコン: lucide-react UMDが不安定なため、インラインSVGで自己完結 ====
const _LI = {};
// lucide公式のSVGパス(strokeベース)。無いものは汎用ドットにフォールバック
const _ICON_PATHS = {
  Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z"/>',
  Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  Sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
  Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  ShieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  Check: '<polyline points="20 6 9 17 4 12"/>',
  Award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  Skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="M12.5 17l-.5-1-.5 1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
  PlusCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  MinusCircle: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
  Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  Trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  Timer: '<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/>',
  Play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  Sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  Activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  ChevronRight: '<polyline points="9 18 15 12 9 6"/>',
  Crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
  Edit3: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  ArrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  ArrowDownCircle: '<circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>',
  Search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  Layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  AlertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  Flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  RotateCcw: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  Users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  User: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  HelpCircle: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  BookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  Info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  RefreshCcw: '<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>',
  Coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  ShoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  Gem: '<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>'
};
const _icon = (name) => (props) => {
  props = props || {};
  const size = props.size || 20;
  const inner = _ICON_PATHS[name] || '<circle cx="12" cy="12" r="4"/>';
  return React.createElement('svg', {
    xmlns:'http://www.w3.org/2000/svg', width:size, height:size, viewBox:'0 0 24 24',
    fill: name==='Heart'||name==='Zap'||name==='Star'||name==='Crown'||name==='Play'||name==='Sparkles' ? 'currentColor' : 'none',
    stroke:'currentColor', strokeWidth: props.strokeWidth||2, strokeLinecap:'round', strokeLinejoin:'round',
    className: props.className||'', style: props.style||{},
    dangerouslySetInnerHTML:{ __html: inner }
  });
};
const Heart=_icon('Heart'), Zap=_icon('Zap'), Sword=_icon('Sword'), Shield=_icon('Shield'), X=_icon('X'), Award=_icon('Award'), Skull=_icon('Skull'), PlusCircle=_icon('PlusCircle'), Target=_icon('Target'), ShieldCheck=_icon('ShieldCheck'), Trophy=_icon('Trophy'), Timer=_icon('Timer'), Play=_icon('Play'), Sparkles=_icon('Sparkles'), Activity=_icon('Activity'), ChevronRight=_icon('ChevronRight'), Crown=_icon('Crown'), Edit3=_icon('Edit3'), ArrowLeft=_icon('ArrowLeft'), Search=_icon('Search'), Layers=_icon('Layers'), AlertCircle=_icon('AlertCircle'), Flag=_icon('Flag'), RotateCcw=_icon('RotateCcw'), MinusCircle=_icon('MinusCircle'), Star=_icon('Star'), Users=_icon('Users'), User=_icon('User'), Check=_icon('Check'), HelpCircle=_icon('HelpCircle'), BookOpen=_icon('BookOpen'), Info=_icon('Info'), RefreshCcw=_icon('RefreshCcw'), ArrowDownCircle=_icon('ArrowDownCircle'), Coins=_icon('Coins'), ShoppingBag=_icon('ShoppingBag'), Gem=_icon('Gem');


// --- Helpers ---
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BUILD_DATE = "2026-07-04 21:22"; // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること

// --- ブリーダーレベル/絆レベル: WAVEクリアごとに獲得する経験値。WAVEが進むほど段階的に増加するが、
// 10WAVE制覇時の合計は旧仕様(一律10XP×10WAVE=100)と変わらない
const WAVE_XP_TABLE = [4, 5, 6, 7, 8, 10, 12, 14, 16, 18];
const waveXpGain = (waveNum, mult) => Math.round((WAVE_XP_TABLE[waveNum - 1] || 0) * mult);
const xpForWavesCleared = (wavesCleared, mult) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveXpGain(w, mult);
  return sum;
};
// --- ゴールド: WAVEクリアごとに獲得。経験値と同じ配分でWAVEが進むほど段階的に増加するが、
// 10WAVE制覇時の合計は旧仕様(一律100G×10WAVE=1000、Normal基準)と変わらない
const WAVE_GOLD_TABLE = WAVE_XP_TABLE.map(v => v * 10);
const waveGoldGain = (waveNum, mult) => Math.round((WAVE_GOLD_TABLE[waveNum - 1] || 0) * mult);
const goldForWavesCleared = (wavesCleared, mult) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveGoldGain(w, mult);
  return sum;
};
const xpForLevel = (level) => Math.round(50 * Math.pow(level, 1.8)); // そのレベルから次レベルに必要なXP
const levelInfo = (totalXp) => {
  let level = 1, xp = totalXp;
  for (let i = 0; i < 200; i++) {
    const need = xpForLevel(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForLevel(level) };
};

// =====================================================================
// AUDIO: すべてオリジナル生成のBGM/SE (Tone.jsをCDNから動的読込)
// デフォルトは無音。ユーザーが音量ボタンを押すと有効化される。
// =====================================================================
const Audio_ = (() => {
  let Tone = null, ready = false, loading = null, started = false;
  let reverb = null, lead = null, arp = null, bass = null, bgmBus = null;
  let parts = [], currentKey = null;
  let enabled = false; // デフォルト無音

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
      bgmBus = new Tone.Gain(0.04).toDestination(); // BGM専用バス(SEには影響しない・初期は最小)
      reverb = new Tone.Reverb({ decay: 2.4, wet: 0.22 }).toDestination(); // SE用リバーブ
      lead = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 }, volume: -13 }).connect(bgmBus);
      arp = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -21 }).connect(bgmBus);
      bass = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -15 }).connect(bgmBus);
      try { await reverb.ready; } catch (e) {}
      ready = true;
      } catch(e){}
    });
    return loading;
  };

  const ensure = async () => { await load(); if (Tone && !started) { try { await Tone.start(); started = true; } catch (e) {} } };

  const T = {
    title: { bpm: 120, mel: [['C5','8n'],['C5','8n'],['C5','4n'],['G5','8n'],['C5','8n'],['E5','4n'],['F5','8n'],['G5','8n'],['A5','4n'],['G5','4n'],['E5','4n'],['D5','8n'],['E5','8n'],['F5','4n'],['A5','8n'],['G5','8n'],['F5','4n'],['E5','8n'],['D5','8n'],['C5','2n'],['G5','4n'],['C6','4n'],['B5','8n'],['A5','8n'],['G5','4n'],['A5','4n'],['F5','8n'],['G5','8n'],['A5','4n'],['C6','4n'],['B5','4n'],['A5','8n'],['G5','8n'],['F5','4n'],['E5','8n'],['D5','8n'],['E5','4n'],['G5','4n'],['F5','8n'],['E5','8n'],['C5','2n']], bass: ['C2','C2','F2','G2','C2','F2','G2','C2'], arp: [['C4','E4','G4'],['C4','E4','G4'],['F3','A3','C4'],['G3','B3','D4'],['C4','E4','G4'],['F3','A3','C4'],['G3','B3','D4'],['C4','E4','G4']] },
    prep: { bpm: 124, mel: [['G4','8n'],['C5','8n'],['E5','8n'],['G5','8n'],['E5','8n'],['C5','8n'],['E5','4n'],['F4','8n'],['A4','8n'],['C5','8n'],['F5','8n'],['C5','8n'],['A4','8n'],['C5','4n'],['G4','8n'],['B4','8n'],['D5','8n'],['G5','8n'],['D5','8n'],['B4','8n'],['D5','4n'],['C5','8n'],['E5','8n'],['G5','8n'],['C6','8n'],['G5','4n'],['E5','4n'],['A4','8n'],['C5','8n'],['E5','8n'],['A5','8n'],['E5','8n'],['C5','8n'],['E5','4n'],['F4','8n'],['A4','8n'],['C5','8n'],['A4','8n'],['G4','8n'],['F4','8n'],['G4','4n'],['E4','8n'],['G4','8n'],['C5','8n'],['E5','8n'],['D5','8n'],['C5','8n'],['B4','4n'],['C5','8n'],['G4','8n'],['E4','8n'],['G4','8n'],['C5','2n']], bass: ['C3','F2','G2','C3','A2','F2','C3','G2'], arp: [['C4','E4','G4'],['F3','A3','C4'],['G3','B3','D4'],['C4','E4','G4'],['A3','C4','E4'],['F3','A3','C4'],['C4','E4','G4'],['G3','B3','D4']] },
    battle: { bpm: 160, mel: [['A4','8n'],['A4','8n'],['A4','8n'],['B4','8n'],['C5','8n'],['B4','8n'],['A4','8n'],['G#4','8n'],['A4','4n'],['E5','4n'],['A4','8n'],['C5','8n'],['B4','8n'],['A4','8n'],['G4','8n'],['G4','8n'],['G4','8n'],['A4','8n'],['B4','8n'],['A4','8n'],['G4','8n'],['F#4','8n'],['G4','4n'],['D5','4n'],['G4','8n'],['B4','8n'],['A4','8n'],['G4','8n'],['E5','8n'],['F5','8n'],['F#5','8n'],['G5','8n'],['G#5','8n'],['A5','8n'],['G#5','8n'],['A5','8n'],['E5','4n'],['C5','4n'],['A4','4n'],['B4','4n'],['C5','8n'],['B4','8n'],['C5','8n'],['D5','8n'],['E5','8n'],['D5','8n'],['C5','8n'],['B4','8n'],['A4','2n'],['E5','4n'],['A5','4n']], bass: ['A2','A2','G2','G2','E2','F2','A2','E2'], arp: [['A3','C4','E4'],['A3','C4','E4'],['G3','B3','D4'],['G3','B3','D4'],['E3','G#3','B3'],['F3','A3','C4'],['A3','C4','E4'],['E3','G#3','B3']] },
    boss: { bpm: 150, mel: [['D4','8n'],['D4','8n'],['Eb4','8n'],['D4','8n'],['A4','8n'],['G4','8n'],['F4','8n'],['E4','8n'],['D4','4n'],['A3','4n'],['D4','8n'],['F4','8n'],['E4','8n'],['D4','8n'],['Bb4','8n'],['A4','8n'],['Bb4','8n'],['A4','8n'],['G4','8n'],['F4','8n'],['E4','8n'],['D4','8n'],['C#4','4n'],['A4','4n'],['G4','8n'],['F4','8n'],['E4','8n'],['C#4','8n'],['D5','8n'],['C5','8n'],['Bb4','8n'],['A4','8n'],['G4','8n'],['F4','8n'],['E4','8n'],['D4','8n'],['A4','4n'],['F4','4n'],['D4','4n'],['E4','4n'],['F4','8n'],['G4','8n'],['A4','8n'],['Bb4','8n'],['A4','8n'],['G4','8n'],['F4','8n'],['E4','8n'],['D4','2n'],['A4','4n'],['D5','4n']], bass: ['D2','D2','Bb1','Bb1','G1','A1','D2','A1'], arp: [['D3','F3','A3'],['D3','F3','A3'],['Bb2','D3','F3'],['Bb2','D3','F3'],['G2','Bb2','D3'],['A2','C#3','E3'],['D3','F3','A3'],['A2','C#3','E3']] }
  };

  const clearParts = () => { parts.forEach(p => { try { p.dispose(); } catch (e) {} }); parts = []; if (Tone) { Tone.Transport.stop(); Tone.Transport.cancel(); } };

  const buildLoop = (def) => {
    Tone.Transport.bpm.value = def.bpm;
    let acc = 0; const melArr = [];
    def.mel.forEach(([note, dur]) => { melArr.push({ time: acc, note, dur }); acc += Tone.Time(dur).toSeconds(); });
    const melEnd = acc;
    const leadSeq = new Tone.Part((time, ev) => lead.triggerAttackRelease(ev.note, ev.dur, time), melArr);
    leadSeq.loop = true; leadSeq.loopEnd = melEnd; leadSeq.start(0); parts.push(leadSeq);
    const barLen = Tone.Time('1m').toSeconds();
    const bassSeq = new Tone.Part((time, ev) => { bass.triggerAttackRelease(ev.note, '2n', time); bass.triggerAttackRelease(ev.note, '2n', time + barLen / 2); }, def.bass.map((n, i) => ({ time: i * barLen, note: n })));
    bassSeq.loop = true; bassSeq.loopEnd = def.bass.length * barLen; bassSeq.start(0); parts.push(bassSeq);
    const arpSeq = new Tone.Part((time, ev) => { ev.notes.forEach((n, j) => { arp.triggerAttackRelease(n, '8n', time + j * (barLen / 6)); arp.triggerAttackRelease(n, '8n', time + (j + 3) * (barLen / 6)); }); }, def.arp.map((notes, i) => ({ time: i * barLen, notes })));
    arpSeq.loop = true; arpSeq.loopEnd = def.arp.length * barLen; arpSeq.start(0); parts.push(arpSeq);
    Tone.Transport.start();
  };

  const playBGM = async (key) => {
    if (!enabled) { currentKey = key; return; }
    if (key === currentKey && parts.length) return;
    currentKey = key;
    await ensure(); if (!Tone || !ready) return;
    clearParts();
    if (T[key]) buildLoop(T[key]);
  };

  const stopBGM = () => { currentKey = null; clearParts(); };

  const setEnabled = async (on) => {
    enabled = on;
    if (!on) { clearParts(); return; }
    await ensure();
    if (ready && currentKey && T[currentKey]) { clearParts(); buildLoop(T[currentKey]); }
  };
  const isEnabled = () => enabled;

  // 段階的音量: vol=0/0.4/0.7/1.0 を BGMバスの実ゲインへマッピング(段階差を明確に・全体小さめ)
  const setVolume = async (vol) => {
    const on = vol > 0;
    // BGM実音量: バスは1以下に抑える(クリップ回避)
    const bgmGain = vol <= 0 ? 0 : (vol <= 0.4 ? 0.22 : (vol <= 0.7 ? 0.42 : 0.65));
    // SE用マスター: BGMと同程度の控えめな音量に(SE=master, BGM=master×bgmGain)
    const seDb = vol <= 0 ? -Infinity : (vol <= 0.4 ? -30 : (vol <= 0.7 ? -25 : -21));
    await load();
    if (Tone) {
      try { Tone.Destination.volume.value = seDb; } catch (e) {}
      try { if (bgmBus) bgmBus.gain.rampTo(bgmGain, 0.1); } catch (e) {}
      // iOS音声ロック解除: 有効化時に即座にテスト音を鳴らす
      if (on) {
        try {
          const tb = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:0.005,decay:0.15,sustain:0.1,release:0.2}, volume: -6 }).toDestination();
          const now = Tone.now();
          tb.triggerAttackRelease('C5','8n', now);
          tb.triggerAttackRelease('G5','8n', now+0.12);
          setTimeout(()=>{ try{tb.dispose();}catch(e){} }, 800);
        } catch(e){}
      }
    }
    if (on && !enabled) { await setEnabled(true); }
    else if (!on && enabled) { await setEnabled(false); }
    else if (on) { enabled = true; await ensure(); }
  };

  const se = {
    attack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -4 }).toDestination(); s.triggerAttackRelease('C2', '8n', t); const n = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -16 }).toDestination(); n.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 500); },
    special: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const c = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.18, decay: 0.05, sustain: 0.3, release: 0.1 }, volume: -12 }).connect(reverb); c.triggerAttackRelease('C3', '8n.', t); try { c.frequency.rampTo('C4', 0.22, t); } catch (e) {} const bt = t + 0.26; const boom = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -2 }).toDestination(); boom.triggerAttackRelease('C1', '4n', bt); const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -12 }).toDestination(); blast.triggerAttackRelease('8n', bt); const sh = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.2 }, volume: -8 }).connect(reverb); ['C5','G5','C6','E6','G6'].forEach((nn, i) => sh.triggerAttackRelease(nn, '32n', bt + i * 0.05)); setTimeout(() => { try { c.dispose(); boom.dispose(); blast.dispose(); sh.dispose(); } catch (e) {} }, 1400); },
    guard: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.18, release: 0.1 }, harmonicity: 5.1, modulationIndex: 16, resonance: 4000, octaves: 1.2, volume: -20 }).toDestination(); s.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 500); },
    card: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 }, volume: -12 }).toDestination(); s.triggerAttackRelease('E6', '32n', t); s.triggerAttackRelease('A6', '32n', t + 0.04); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 300); },
    crit: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.1, sustain: 0.1, release: 0.15 }, volume: -8 }).connect(reverb); ['C5','E5','G5','C6','E6'].forEach((n, i) => s.triggerAttackRelease(n, '32n', t + i * 0.04)); const b = new Tone.MembraneSynth({ volume: -6 }).toDestination(); b.triggerAttackRelease('C2', '8n', t); setTimeout(() => { try { s.dispose(); b.dispose(); } catch (e) {} }, 700); },
    zanSlash: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const swish = (st) => { const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -18 }).connect(reverb); n.triggerAttackRelease('32n', st); const p = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.04 }, volume: -13 }).connect(reverb); p.triggerAttackRelease('C7', '32n', st); try { p.frequency.rampTo('G6', 0.1, st); } catch (e) {} setTimeout(() => { try { n.dispose(); p.dispose(); } catch (e) {} }, 350); }; swish(t); swish(t + 0.09); },
    heal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -12 }).connect(reverb); ['G4','C5','E5','G5','C6'].forEach((n, i) => s.triggerAttackRelease(n, '16n', t + i * 0.07)); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 900); },
    tap: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -16 }).toDestination(); s.triggerAttackRelease('C6', '64n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 200); },
    enemyAttack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -3 }).toDestination(); s.triggerAttackRelease('A1', '4n', t); const g = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -12 }).toDestination(); g.triggerAttackRelease('8n', t); setTimeout(() => { try { s.dispose(); g.dispose(); } catch (e) {} }, 700); },
    enemySpecial: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      // ① 溜め: 下降する不穏なうなり
      const charge = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.25, decay: 0.05, sustain: 0.4, release: 0.1 }, volume: -8 }).toDestination();
      charge.triggerAttackRelease('A2', '4n', t); try { charge.frequency.rampTo('A1', 0.4, t); } catch (e) {}
      // ② 大炸裂: 超低音ドゥーン + 金属的インパクト + ホワイトノイズ爆発
      const bt = t + 0.42;
      const boom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 8, envelope: { attack: 0.001, decay: 0.6, sustain: 0 }, volume: 2 }).toDestination();
      boom.triggerAttackRelease('C1', '2n', bt);
      const metal = new Tone.MetalSynth({ frequency: 120, envelope: { attack: 0.001, decay: 0.5, release: 0.2 }, harmonicity: 3.5, modulationIndex: 32, resonance: 3000, octaves: 1.5, volume: -10 }).toDestination();
      metal.triggerAttackRelease('16n', bt);
      const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6 }).toDestination();
      blast.triggerAttackRelease('4n', bt);
      // ③ 不穏な残響: 不協和音(半音ぶつけ)
      const dread = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.6 }, volume: -16 }).connect(reverb);
      ['C2','C#2','G2'].forEach(n => dread.triggerAttackRelease(n, '2n', bt + 0.05));
      setTimeout(() => { try { charge.dispose(); boom.dispose(); metal.dispose(); blast.dispose(); dread.dispose(); } catch (e) {} }, 2000); },
    enemyMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 }, volume: -14 }).toDestination(); s.triggerAttackRelease('E4', '32n', t); s.triggerAttackRelease('B3', '16n', t + 0.06); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 400); },
    join: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.4 }, volume: -10 }).connect(reverb); const t = Tone.now(); const seq = [[0,'E5','8n'],[0.15,'G5','8n'],[0.3,'C6','8n'],[0.45,'E6','4n'],[0.45,'C6','4n'],[0.45,'G5','4n'],[0.8,'D6','8n'],[0.95,'E6','4n'],[0.95,'C6','4n'],[0.95,'G5','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1800); },
    victory: async () => { if (!enabled) return; await ensure(); if (!Tone) return; clearParts(); currentKey = null; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, volume: -19 }).connect(reverb); const vb = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -19 }).toDestination(); const t = Tone.now(); const seq = [[0,'C5','8n'],[0,'E5','8n'],[0,'G5','8n'],[0.18,'C5','8n'],[0.18,'E5','8n'],[0.18,'G5','8n'],[0.36,'C5','8n'],[0.36,'E5','8n'],[0.36,'G5','8n'],[0.54,'G5','4n'],[0.54,'C6','4n'],[0.54,'E6','4n'],[0.9,'F5','8n'],[0.9,'A5','8n'],[1.08,'G5','8n'],[1.08,'B5','8n'],[1.26,'C6','2n'],[1.26,'E6','2n'],[1.26,'G6','2n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); [[0,'C3'],[0.54,'C3'],[0.9,'F2'],[1.08,'G2'],[1.26,'C3']].forEach(([tt, n]) => vb.triggerAttackRelease(n, '4n', t + tt)); setTimeout(() => { try { v.dispose(); vb.dispose(); } catch (e) {} }, 2600); },
    levelUp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -12 }).connect(reverb); const seq = [[0,'C5','16n'],[0.08,'E5','16n'],[0.16,'G5','16n'],[0.24,'C6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const sp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }, volume: -16 }).connect(reverb); sp.triggerAttackRelease('C6', '2n', t + 0.24); setTimeout(() => { try { v.dispose(); sp.dispose(); } catch (e) {} }, 1200); }
  };

  return { playBGM, stopBGM, setEnabled, isEnabled, setVolume, se };
})();


const MOO_IMG = "";


// --- Game Data ---
const RANGE_LABELS = ["零", "近", "中", "遠"];
// モンスターごとの間合い(距離)適性。距離ラベル配列と同じ並び([零,近,中,遠])のグレードを
// distAptitude:['C','C','C','C'] の形でモンスターデータに持たせ、そのモンスターが
// 該当スロットで攻撃した時のダメージに以下の倍率を掛ける。値は今後モンスターごとに調整予定。
// グレード配列: 下から上へ。C(=0%)を基準にG~Sは±5%刻み、S以上(S+~M)は+2.5%刻みで頭打ちはM(+25%)
const DIST_APTITUDE_GRADES = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];
const DIST_APTITUDE_MULT = { G: 0.8, F: 0.85, E: 0.9, D: 0.95, C: 1.0, B: 1.05, A: 1.1, S: 1.15, 'S+': 1.175, SS: 1.2, 'SS+': 1.225, M: 1.25 };
const DIST_APTITUDE_COLOR = { S: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'S+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", SS: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'SS+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", M: "text-fuchsia-300 bg-gradient-to-br from-purple-950/70 to-pink-950/70 border-fuchsia-400/60", A: "text-red-400 bg-red-950/60 border-red-400/50", B: "text-pink-300 bg-pink-950/60 border-pink-400/50", C: "text-green-300 bg-green-950/60 border-green-400/50", D: "text-teal-300 bg-teal-950/60 border-teal-400/50", E: "text-cyan-300 bg-cyan-950/60 border-cyan-400/50", F: "text-purple-300 bg-purple-950/60 border-purple-400/50", G: "text-slate-400 bg-slate-800/60 border-slate-500/50" };
const RANGE_STYLES = {
  0: { bg: "bg-red-950/90", border: "border-red-500", text: "text-red-400", shadow: "shadow-red-500/50", glow: "drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]", slotBg: "bg-red-900/50", labelBg: "bg-red-600 text-white" },
  1: { bg: "bg-yellow-950/90", border: "border-yellow-500", text: "text-yellow-400", shadow: "shadow-yellow-500/50", glow: "drop-shadow-[0_0_15px_rgba(234,179,8,0.9)]", slotBg: "bg-yellow-900/50", labelBg: "bg-yellow-600 text-black" },
  2: { bg: "bg-emerald-950/90", border: "border-emerald-500", text: "text-emerald-400", shadow: "shadow-emerald-500/50", glow: "drop-shadow-[0_0_15px_rgba(16,185,129,0.9)]", slotBg: "bg-emerald-900/50", labelBg: "bg-emerald-600 text-white" },
  3: { bg: "bg-blue-950/90", border: "border-blue-500", text: "text-blue-400", shadow: "shadow-blue-500/50", glow: "drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]", slotBg: "bg-blue-900/50", labelBg: "bg-blue-600 text-white" }
};

const DIFFICULTY_SETTINGS = {
  Beginner: { label: "Beginner", power: 0.25, score: 0.25, gold: 0.25, color: "bg-cyan-600", shadow: "shadow-cyan-600/50" },
  Easy:     { label: "Easy",     power: 0.5,  score: 0.5,  gold: 0.5,  color: "bg-emerald-600", shadow: "shadow-emerald-600/50" },
  Normal:   { label: "Normal",   power: 1.0,  score: 1.0,  gold: 1.0,  color: "bg-indigo-600", shadow: "shadow-indigo-600/50" },
  Hard:     { label: "Hard",     power: 1.5,  score: 2.0,  gold: 1.2,  color: "bg-red-600", shadow: "shadow-red-600/50" },
  Expert:   { label: "Expert",   power: 3.0,  score: 3.0,  gold: 1.5,  color: "bg-purple-600", shadow: "shadow-purple-600/50" },
  Master:   { label: "Master",   power: 5.0,  score: 5.0,  gold: 2.0,  color: "bg-slate-200 text-black", shadow: "shadow-white/50" },
};

// ブリーダー教えカード使用時の専用演出(色・アイコン・掛け声)
const TEACHING_FX_STYLE = {
  oryo:    { icon:"🌸", label:"闘気上昇!",   text:"text-red-300",     ring:"border-red-300",     rgb:"239,68,68" },
  dra:     { icon:"🐉", label:"鉄壁化!",     text:"text-emerald-300", ring:"border-emerald-300", rgb:"16,185,129" },
  cadmium: { icon:"🧪", label:"計算完了!",   text:"text-cyan-300",    ring:"border-cyan-300",    rgb:"6,182,212" },
  mua:     { icon:"💖", label:"祝福!",       text:"text-pink-300",    ring:"border-pink-300",    rgb:"236,72,153" },
  atsu:    { icon:"🔥", label:"挑発!",       text:"text-orange-300",  ring:"border-orange-300",  rgb:"234,88,12" },
  myaru:   { icon:"🐈", label:"怪薬投与!",   text:"text-purple-300",  ring:"border-purple-300",  rgb:"168,85,247" },
};


// Storage helpers — window.storage は元々の別プラットフォーム向けAPIで、
// GitHub Pages上には存在しない。実ブラウザのlocalStorageを使い、
// それも使えない場合のみメモリ内フォールバック(リロードで消える)にする。
const _memStore = {};
const hasWinStorage = () => typeof window !== 'undefined' && !!window.storage;
const hasLocalStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const k = '__mh_ls_test__'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k);
    return true;
  } catch { return false; }
};

const storeGet = async (key, def, shared=false) => {
  try {
    if (hasWinStorage()) {
      const r = await window.storage.get(key, shared);
      return r && r.value !== undefined && r.value !== null ? JSON.parse(r.value) : def;
    }
  } catch { /* fall through */ }
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : def;
    }
  } catch { /* fall through to memory */ }
  return key in _memStore ? _memStore[key] : def;
};
const storeSet = async (key, val, shared=false) => {
  _memStore[key] = val;
  try {
    if (hasWinStorage()) { await window.storage.set(key, JSON.stringify(val), shared); return; }
  } catch {}
  try {
    if (hasLocalStorage()) { window.localStorage.setItem(key, JSON.stringify(val)); }
  } catch {}
};
const storeList = async (prefix, shared=false) => {
  try {
    if (hasWinStorage()) {
      const r = await window.storage.list(prefix, shared);
      return (r && r.keys) ? r.keys : [];
    }
  } catch {}
  try {
    if (hasLocalStorage()) {
      const keys = [];
      for (let i=0;i<window.localStorage.length;i++){ const k=window.localStorage.key(i); if(k&&k.startsWith(prefix)) keys.push(k); }
      return keys;
    }
  } catch {}
  return Object.keys(_memStore).filter(k => k.startsWith(prefix));
};

// ===== Supabase shared ranking (REST API via fetch) =====
const SUPABASE_URL = 'https://zrzevudkbgtxlbvmuziy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D4WJBXJ1xE97amndZarEPw_0M4LAwOp';
const SB_HEADERS = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// Fetch top scores for a difficulty (returns array sorted by score desc)
const sbFetchRankings = async (diff, limit=20) => {
  const url = `${SUPABASE_URL}/rest/v1/rankings?difficulty=eq.${encodeURIComponent(diff)}&order=score.desc&limit=${limit}`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return await res.json();
};
// Find this player's existing row for a difficulty (by user_name)
const sbFindPlayer = async (diff, name) => {
  const url = `${SUPABASE_URL}/rest/v1/rankings?difficulty=eq.${encodeURIComponent(diff)}&user_name=eq.${encodeURIComponent(name)}&select=id,score&limit=1`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`find ${res.status}`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
};
// Insert a new score row
const sbInsertScore = async (row) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings`, { method:'POST', headers:{...SB_HEADERS, 'Prefer':'return=minimal'}, body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`insert ${res.status}`);
};
// Update an existing score row by id
const sbUpdateScore = async (id, row) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings?id=eq.${id}`, { method:'PATCH', headers:{...SB_HEADERS, 'Prefer':'return=minimal'}, body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`update ${res.status}`);
};

// 最終リザルト画面(CHAMPION/敗北)共通: レベルの経験値バーが直前の進捗から今回の獲得分まで伸びる演出。
// レベルを跨ぐ場合は満タンまで伸ばしてからLEVEL UPを見せ、次レベルの進捗へ切り替える
const LevelGrowthBar = ({ levelBefore, levelAfter }) => {
  const leveledUp = levelAfter.level > levelBefore.level;
  const [curLevel, setCurLevel] = useState(levelBefore.level);
  const [pct, setPct] = useState(Math.max(0, Math.min(100, (levelBefore.xpIntoLevel / Math.max(1, levelBefore.xpForNext)) * 100)));
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timers = [];
    if (leveledUp) {
      timers.push(setTimeout(() => setPct(100), 200));
      timers.push(setTimeout(() => { Audio_.se.levelUp(); setFlash(true); }, 900));
      timers.push(setTimeout(() => { setFlash(false); setCurLevel(levelAfter.level); setPct(0); }, 2000));
      timers.push(setTimeout(() => setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))), 2100));
    } else {
      timers.push(setTimeout(() => setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))), 200));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="font-mono text-slate-300 font-bold">LV.{curLevel}</span>
        {flash && <span className="text-amber-400 font-black animate-pulse">LEVEL UP!</span>}
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-700 ease-out" style={{width:`${pct}%`}}></div>
      </div>
    </div>
  );
};

// 数値がfrom→toへカウントアップする演出(ダイヤ表示用、バー無し)
const CountUpNumber = ({ from, to }) => {
  const [val, setVal] = useState(from);
  useEffect(() => {
    const duration = 700, start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 200);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []);
  return <span>{val.toLocaleString()}</span>;
};

// 最終リザルト画面(CHAMPION/敗北)共通: 今回の周回で獲得したブリーダー経験値・ダイヤ・
// 勇者モンの絆経験値をまとめて表示するカード
const RewardSummaryCard = ({ summary }) => (
  <div className="w-full max-w-xs bg-black/30 border border-white/10 rounded-2xl p-3 mb-2 text-left shrink-0 flex flex-col min-h-0">
    <div className="space-y-3 shrink-0">
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-indigo-300 font-black flex items-center gap-1"><Crown size={12}/>ブリーダー経験値</span>
          <span className="text-white font-mono font-bold">+{summary.breederXpGain.toLocaleString()}</span>
        </div>
        <LevelGrowthBar levelBefore={summary.breederLevelBefore} levelAfter={summary.breederLevelAfter}/>
      </div>
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
        <span className="text-amber-300 font-black flex items-center gap-1"><Gem size={12}/>ダイヤ</span>
        <span className="text-white font-mono font-bold"><CountUpNumber from={summary.goldBefore} to={summary.goldAfter}/></span>
      </div>
      {summary.heroBondGain && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-pink-300 font-black flex items-center gap-1 truncate"><Heart size={12}/>絆レベル：{summary.heroBondGain.name}</span>
            <span className="text-white font-mono font-bold shrink-0">+{summary.heroBondGain.xpGain.toLocaleString()}</span>
          </div>
          <LevelGrowthBar levelBefore={summary.heroBondGain.levelBefore} levelAfter={summary.heroBondGain.levelAfter}/>
          {summary.heroBondGain.levelAfter.level > summary.heroBondGain.levelBefore.level && (
            <div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{summary.heroBondGain.levelAfter.level - summary.heroBondGain.levelBefore.level}</div>
          )}
        </div>
      )}
    </div>
    {summary.waveHistory && summary.waveHistory.length > 0 && (
      <div className="pt-2 mt-3 border-t border-white/10 shrink-0 flex flex-col min-h-0">
        <div className="text-[10px] text-cyan-300 font-black flex items-center gap-1 mb-1 shrink-0"><Trophy size={11}/>WAVE別ログ</div>
        <div className="space-y-0.5 overflow-y-auto mh-scroll max-h-[18vh]">
          {summary.waveHistory.map(w => (
            <div key={w.wave} className="flex items-center justify-between gap-1 text-[9px] bg-white/5 rounded-lg px-2 py-1">
              <span className="text-slate-400 font-bold shrink-0">WAVE {w.wave}</span>
              <span className="text-white font-mono font-bold truncate">スコア +{w.roundScore.toLocaleString()}</span>
              <span className="text-indigo-300 font-mono font-bold shrink-0">XP+{w.xpGain.toLocaleString()}</span>
              <span className="text-amber-300 font-mono font-bold shrink-0">💎+{w.goldGain.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

function MonsterHeroGame() {
  const [gameState, setGameState] = useState('TITLE');
  const [difficulty, setDifficulty] = useState('Normal');
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState({});
  const [attemptCounts, setAttemptCounts] = useState({}); // 難易度別 挑戦回数(端末保存)
  const [clearCounts, setClearCounts] = useState({}); // 難易度別 クリア回数(端末保存)
  const [onboarded, setOnboarded] = useState(true); // false=初回起動(プロフィール設定へ誘導)
  const [localRankings, setLocalRankings] = useState({});
  const [rankingSourceByDiff, setRankingSourceByDiff] = useState({}); // {[diff]: 'global'|'local'} 表示中データの取得元
  const [showRanking, setShowRanking] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [bigShake, setBigShake] = useState(false);
  const triggerShake = useCallback((big=false) => {
    setScreenShake(false); setBigShake(false);
    requestAnimationFrame(() => { setScreenShake(true); setBigShake(big); setTimeout(()=>{setScreenShake(false); setBigShake(false);}, big?750:450); });
  }, []);
  const [ripples, setRipples] = useState([]);
  const spawnRipple = useCallback((x, y) => {
    const id = Date.now() + Math.random();
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 650);
  }, []);
  const [rankingViewDiff, setRankingViewDiff] = useState('Normal');
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(500);
  const [maxHp, setMaxHp] = useState(500);
  const [guts, setGuts] = useState(50);
  const [maxGuts, setMaxGuts] = useState(100);
  const [atk, setAtk] = useState(100);
  const [def, setDef] = useState(100);
  const [slots, setSlots] = useState([null,null,null,null]);
  const [mainHero, setMainHero] = useState(null);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [graveyard, setGraveyard] = useState([]);
  const [enemy, setEnemy] = useState(null);
  const [enemyDist, setEnemyDist] = useState(2);
  const [selectedCards, setSelectedCards] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [monSelection, setMonSelection] = useState([]);
  const [currentPickingMon, setCurrentPickingMon] = useState(null);
  const [ownedUniques, setOwnedUniques] = useState([]);
  const [ownedTeachings, setOwnedTeachings] = useState([]);
  const [teachingPool, setTeachingPool] = useState([]);
  const [popups, setPopups] = useState([]);
  const [effect, setEffect] = useState(null);
  const [enemyIntent, setEnemyIntent] = useState(null);
  const [atkLevel, setAtkLevel] = useState(0);
  const [guardLevel, setGuardLevel] = useState(0);
  const [guardBonusCount, setGuardBonusCount] = useState(0);
  const [showDeckInfo, setShowDeckInfo] = useState(false);
  const [showEnemyInfo, setShowEnemyInfo] = useState(false);
  const [showHeroInfo, setShowHeroInfo] = useState(false); // バトル中に勇者モンの特性を確認するオーバーレイ
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [gaveUp, setGaveUp] = useState(false); // ギブアップ確定後、最終リザルト画面を表示中かどうか
  const [lastActionSlot, setLastActionSlot] = useState(null);
  const [cardAssignments, setCardAssignments] = useState({}); // {cardHandIndex: slotIndex}
  const [pendingCard, setPendingCard] = useState(null); // cardHandIndex awaiting monster assignment
  const [upgradePoints, setUpgradePoints] = useState(0);
  const [turnCount, setTurnCount] = useState(1);
  const [focusedCard, setFocusedCard] = useState(null);
  const [selectedTeachingCard, setSelectedTeachingCard] = useState(null);
  // ==================== バフ・デバフ統合管理システム ====================
  // 新しいバフ・デバフ効果を追加する際は、専用のuseStateやターン切り替え/WAVE切り替え時の
  // リセット処理を個別に書き足す必要はない。下記3つの汎用マップのいずれかにキーを追加するだけでよい。
  // - permaBuffs: 今回の挑戦(タイトルに戻る/リタイア/再挑戦まで)ずっと有効な永続バフ
  // - waveBuffs:  現在のWAVE中だけ有効(WAVEが変わるとリセットされる)
  // - turnBuffs / nextTurnBuffs: 今ターンだけ有効な一時バフ・デバフ。次ターン分はnextTurnBuffsに
  //   予約し、ターン開始時にnextTurnBuffsの中身がそのままturnBuffsへ入れ替わる(=1ターンのみ持続)
  const [permaBuffs, setPermaBuffs] = useState({ autoHpRecovery: 0.1 });
  const addPermaBuff = (key, delta) => setPermaBuffs(p => ({ ...p, [key]: (p[key] || 0) + delta }));
  const getPermaBuff = (key, def = 0) => permaBuffs[key] ?? def;
  const [waveBuffs, setWaveBuffs] = useState({});
  const addWaveBuff = (key, delta) => setWaveBuffs(p => ({ ...p, [key]: (p[key] || 0) + delta }));
  const getWaveBuff = (key, def = 0) => waveBuffs[key] ?? def;
  const [turnBuffs, setTurnBuffs] = useState({});
  const [nextTurnBuffs, setNextTurnBuffs] = useState({});
  const getTurnBuff = (key, def) => turnBuffs[key] ?? def;
  const getNextTurnBuff = (key, def) => nextTurnBuffs[key] ?? def;
  const setNextTurnBuff = (key, value) => setNextTurnBuffs(p => ({ ...p, [key]: value }));
  const setImmediateTurnBuff = (key, value) => setTurnBuffs(p => ({ ...p, [key]: value })); // 次ターンへ持ち越さない、このターン限りの即時効果
  // ======================================================================
  const [attackAnim, setAttackAnim] = useState(null); // {slotIndex}
  const [slotSkill, setSlotSkill] = useState(null); // {slotIndex, name, type} スロット上の技名インライン表示
  const [dragState, setDragState] = useState(null); // {cardIndex, x, y, active, card} カードドラッグ
  const [dragOverSlot, setDragOverSlot] = useState(null); // ドラッグ中にホバーしているスロット
  const [slotSettle, setSlotSettle] = useState(null); // はめ込み成功したスロットindex
  const [enemySkillName, setEnemySkillName] = useState(null); // 敵アクションの技名インライン表示
  const [guardFx, setGuardFx] = useState(false); // ガード成功のキーン演出
  const [teachingFx, setTeachingFx] = useState(null); // {id} ブリーダー教えカード使用時の専用演出
  const [enemyAttackAnim, setEnemyAttackAnim] = useState(false);
  const [enemyAttackFx, setEnemyAttackFx] = useState(null); // null | {kind:'normal'|'special'}
  const [currentWaveDamage, setCurrentWaveDamage] = useState(0);
  const [waveDistDamage, setWaveDistDamage] = useState([0,0,0,0]); // per-distance damage this wave
  const [distDmgBonus, setDistDmgBonus] = useState([0,0,0,0]); // permanent per-distance dmg multiplier bonus
  const [totalDistDamage, setTotalDistDamage] = useState([0,0,0,0]); // cumulative per-distance damage across all waves
  const [totalAllDamage, setTotalAllDamage] = useState(0); // cumulative damage across all waves
  const [totalRecoveryDelta, setTotalRecoveryDelta] = useState(0); // cumulative recovery-rate correction across all waves
  const [waveResult, setWaveResult] = useState(null);
  const [breederName, setBreederName] = useState('名無しのブリーダー');
  const [breederXp, setBreederXp] = useState(0); // 累計経験値(WAVEクリア数ベース・端末保存)
  const [gold, setGold] = useState(0); // 累計ゴールド(WAVEクリア数ベース・端末保存)
  const [bondXp, setBondXp] = useState({}); // モンスターごとの絆レベル累計経験値 { [monId]: xp } (端末保存・勇者モンのみ加算)
  const [distAptPoints, setDistAptPoints] = useState({}); // 絆レベルアップで貯まる間合い適性強化ポイント { [monId]: pt } (端末保存)
  const [distAptOverrides, setDistAptOverrides] = useState({}); // 強化ポイントで上げた間合い適性 { [monId]: [g0,g1,g2,g3] } (端末保存)
  const [finalRewardSummary, setFinalRewardSummary] = useState(null); // 最終リザルト画面に出す今回の獲得内訳
  const [waveHistory, setWaveHistory] = useState([]); // 今回のプレイでWAVEをクリアするたびに記録するスコア・経験値ログ(最終リザルト画面表示用)
  const [breederIcon, setBreederIcon] = useState(null); // 選択中アイコンのモンスターid、またはマーケットで購入したアイコンid(未選択はnull)
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [breederPoints, setBreederPoints] = useState(0); // レベルアップ毎に+1、ブリーダーマーケットで消費(端末保存)
  const [ownedMarketIcons, setOwnedMarketIcons] = useState([]); // ブリーダーマーケットで購入済みのアイコンidリスト(端末保存)
  const [unlockedMonsterIds, setUnlockedMonsterIds] = useState(STARTER_MONSTER_IDS); // 解放済みモンスターid(初期8体+円盤石購入分、端末保存)
  const [monsterRosterIds, setMonsterRosterIds] = useState(STARTER_MONSTER_IDS); // モンスター編成(解放済みの中から周回で使う候補、端末保存)
  const [unlockedTeachingIds, setUnlockedTeachingIds] = useState(STARTER_TEACHING_IDS); // 解放済みブリーダーカードid(初期6枚+購入分、端末保存)
  const [teachingRosterIds, setTeachingRosterIds] = useState(STARTER_TEACHING_IDS); // ブリーダーカード編成(解放済みの中から周回で使う候補、端末保存)
  const [marketTab, setMarketTab] = useState('icon'); // ブリーダーマーケットの表示カテゴリ: 'icon'|'disc'|'breeder'
  const [rosterTab, setRosterTab] = useState('monster'); // 編成画面の表示カテゴリ: 'monster'|'teaching'
  const [draftMonsterRoster, setDraftMonsterRoster] = useState([]); // 編成画面での仮選択(決定を押すまでmonsterRosterIdsには反映しない)
  const [draftTeachingRoster, setDraftTeachingRoster] = useState([]); // 編成画面での仮選択(決定を押すまでteachingRosterIdsには反映しない)
  const [rosterDetailMon, setRosterDetailMon] = useState(null); // 編成画面: 長押しで詳細表示中のモンスター
  const [rosterDetailTeaching, setRosterDetailTeaching] = useState(null); // 編成画面: 長押しで詳細表示中のブリーダーカード
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showBackup, setShowBackup] = useState(false); // データバックアップ/復元モーダル
  const [backupTab, setBackupTab] = useState('export'); // 'export'|'import'
  const [backupCode, setBackupCode] = useState('');
  const [backupCopied, setBackupCopied] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false); // version.jsonが現在のBUILD_DATEと異なる場合true(新バージョン通知)
  const [showHelp, setShowHelp] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0=OFF,1=低,2=中,3=高
  const audioOn = audioLevel > 0;
  const breederLevel = levelInfo(breederXp);
  const getBondLevel = (monId) => levelInfo(bondXp[monId] || 0);
  // モンスター詳細画面(rosterDetailMon/currentPickingMon)共通: 絆レベルとその進捗ゲージを表示
  const bondGaugeNode = (monId) => {
    const lvl = getBondLevel(monId);
    const pct = Math.max(0, Math.min(100, (lvl.xpIntoLevel / Math.max(1, lvl.xpForNext)) * 100));
    return (
      <div className="mt-1">
        <div className="text-[9px] text-pink-300 font-black flex items-center gap-1"><Heart size={9}/>絆Lv.{lvl.level}</div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 mt-0.5">
          <div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pct}%`}}></div>
        </div>
        <div className="text-[7px] text-pink-400/70 font-mono mt-0.5">{lvl.xpIntoLevel.toLocaleString()} / {lvl.xpForNext.toLocaleString()} XP</div>
      </div>
    );
  };
  const getDistAptitude = (mon, slotIdx) => {
    if (!mon) return 'C';
    const ov = distAptOverrides[mon.id];
    if (ov && ov[slotIdx]) return ov[slotIdx];
    return (mon.distAptitude && mon.distAptitude[slotIdx]) || 'C';
  };
  const AUDIO_VOLS = [0, 0.4, 0.7, 1.0];
  const AUDIO_LABELS = ['🔇 OFF', '🔈 低', '🔉 中', '🔊 高'];
  const [helpTab, setHelpTab] = useState('goal');
  const [pendingReward, setPendingReward] = useState(null);
  const [testMooMode, setTestMooMode] = useState(false); // TEMP: ムー戦テストモード

  const scoreMultiplier = useMemo(() => DIFFICULTY_SETTINGS[difficulty]?.score || 1.0, [difficulty]);
  const goldMultiplier = useMemo(() => DIFFICULTY_SETTINGS[difficulty]?.gold || 1.0, [difficulty]);
  const effectiveMaxHp = useMemo(() => Math.floor(maxHp * (1.0 + getPermaBuff('muaHpPct'))), [maxHp, permaBuffs]);
  const effectiveMaxGuts = useMemo(() => Math.floor(maxGuts * (1.0 + getPermaBuff('muaGutsPct'))), [maxGuts, permaBuffs]);

  // 全国ランキングをSupabaseから取得。失敗時は端末内保存の値にフォールバック
  const loadRankings = useCallback(async () => {
    const byDiff = {};
    const sourceByDiff = {};
    try {
      await Promise.all(Object.keys(DIFFICULTY_SETTINGS).map(async (d) => {
        try {
          const rows = await sbFetchRankings(d, 20);
          byDiff[d] = (rows || []).map(r => ({ userName: r.user_name, hero: r.hero, party: r.party, score: r.score, level: r.level, icon: r.icon }));
          sourceByDiff[d] = 'global';
        } catch (e) {
          console.error('[ranking] supabase fetch failed for', d, e && e.message ? e.message : e);
          sourceByDiff[d] = 'local';
          try {
            const rows = await storeGet(`mh_rank_${d}`, [], false);
            if (Array.isArray(rows) && rows.length) {
              byDiff[d] = rows.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,20);
            }
          } catch {}
        }
      }));
      setRankingSourceByDiff(sourceByDiff);
      setLocalRankings(byDiff);
    } catch {}
  }, []);

  // BGM: 画面遷移に応じて自動切替 (すべてオリジナル生成・デフォルト無音)
  useEffect(() => {
    if (!audioOn) { Audio_.stopBGM(); return; }
    const isBoss = wave === 10 || enemy?.id === 'Moo';
    if (gameState === 'TITLE') Audio_.playBGM('title');
    else if (['PICK_HERO','PICK_ALLY','PICK_SLOT','PICK_TEACHING','REWARD_PICK','UPGRADE_SKILL'].includes(gameState)) Audio_.playBGM('prep');
    else if (gameState === 'BATTLE') Audio_.playBGM(isBoss ? 'boss' : 'battle');
    else if (gameState === 'WAVE_RESULT' || gameState === 'CHAMPION') Audio_.stopBGM();
  }, [gameState, wave, enemy?.id, audioOn]);

  // 音の有効/無効・音量を反映
  useEffect(() => { Audio_.setVolume(AUDIO_VOLS[audioLevel]); }, [audioLevel]);

  // 新バージョン検知: ホーム画面アプリはバックグラウンドから復帰しても自動再読み込みされず
  // 古いバージョンのまま使い続けてしまうことがあるため、version.jsonを定期的に確認し
  // BUILD_DATEと異なれば更新バナーを表示する
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.build && data.build !== BUILD_DATE) setUpdateAvailable(true);
      } catch {}
    };
    checkVersion();
    const onVisible = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(interval); };
  }, []);

  // カードドラッグ中のグローバル処理(タッチ/マウス両対応)
  useEffect(() => {
    if(!dragState) return;
    const DRAG_THRESHOLD=8;
    const startX=dragState.x, startY=dragState.y;
    const findSlot=(x,y)=>{
      const el=document.elementFromPoint(x,y);
      if(!el) return null;
      const slotEl=el.closest('[data-slot-index]');
      return slotEl?Number(slotEl.getAttribute('data-slot-index')):null;
    };
    const onMove=(e)=>{
      const pt=e.touches?e.touches[0]:e;
      const x=pt.clientX, y=pt.clientY;
      const moved=Math.hypot(x-startX,y-startY);
      const active=(dragState.active)||moved>DRAG_THRESHOLD;
      setDragState(prev=>prev?{...prev,x,y,active}:null);
      if(active){ setDragOverSlot(findSlot(x,y)); }
      if(moved>DRAG_THRESHOLD&&e.cancelable) e.preventDefault();
    };
    const onUp=(e)=>{
      const pt=e.changedTouches?e.changedTouches[0]:e;
      const moved=Math.hypot(pt.clientX-startX,pt.clientY-startY);
      const wasActive=dragState.active||moved>DRAG_THRESHOLD;
      const cardIndex=dragState.cardIndex;
      if(wasActive){
        const si=findSlot(pt.clientX,pt.clientY);
        if(si!=null){
          dragAssignToSlot(cardIndex, si);
          setSlotSettle(si);
          setTimeout(()=>{ setSlotSettle(null); }, 500);
        }
      } else {
        selectCardAt(cardIndex);
      }
      setDragState(null);
      setDragOverSlot(null);
    };
    window.addEventListener('pointermove',onMove,{passive:false});
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',onUp);
    return ()=>{
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onUp);
    };
  }, [dragState?.cardIndex]);

  // 全ボタンのタップに共通SE (音量ボタン自身は二重に鳴らさない)
  useEffect(() => {
    const onClick = (e) => {
      const btn = e.target.closest && e.target.closest('button');
      if (btn) Audio_.se.tap();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Load saved data
  useEffect(() => {
    (async () => {
      const savedName = await storeGet('mh_breeder_name', '名無しのブリーダー', false);
      setBreederName(savedName);
      const savedIcon = await storeGet('mh_breeder_icon', null, false);
      setBreederIcon(savedIcon);
      const savedXp = await storeGet('mh_breeder_xp', 0, false);
      setBreederXp(savedXp);
      const savedGold = await storeGet('mh_gold', 0, false);
      setGold(savedGold);
      const savedBondXp = await storeGet('mh_bond_xp', {}, false);
      setBondXp(savedBondXp);
      const savedAptPoints = await storeGet('mh_dist_apt_points', {}, false);
      setDistAptPoints(savedAptPoints);
      const savedAptOverrides = await storeGet('mh_dist_apt_overrides', {}, false);
      setDistAptOverrides(savedAptOverrides);
      let savedPoints = await storeGet('mh_breeder_points', 0, false);
      // ブリーダーポイント導入前からのプレイヤーには、既存レベル分(Lv-1)を一度だけ遡って付与
      const pointsMigrated = await storeGet('mh_points_migrated', false, false);
      if (!pointsMigrated) {
        const backfill = Math.max(0, levelInfo(savedXp).level - 1);
        if (backfill > 0) savedPoints += backfill;
        await storeSet('mh_points_migrated', true, false);
      }
      // 全プレイヤー(新規・既存問わず)に初期ポイントを1回だけ付与
      const baseGranted = await storeGet('mh_points_base_granted', false, false);
      if (!baseGranted) {
        savedPoints += 1;
        await storeSet('mh_points_base_granted', true, false);
      }
      await storeSet('mh_breeder_points', savedPoints, false);
      setBreederPoints(savedPoints);
      const savedMarketIcons = await storeGet('mh_market_icons', [], false);
      setOwnedMarketIcons(savedMarketIcons);
      const savedUnlockedMonsters = await storeGet('mh_unlocked_monsters', STARTER_MONSTER_IDS, false);
      setUnlockedMonsterIds(savedUnlockedMonsters);
      const savedMonsterRoster = await storeGet('mh_monster_roster', savedUnlockedMonsters, false);
      setMonsterRosterIds(savedMonsterRoster);
      const savedUnlockedTeachings = await storeGet('mh_unlocked_teachings', STARTER_TEACHING_IDS, false);
      setUnlockedTeachingIds(savedUnlockedTeachings);
      const savedTeachingRoster = await storeGet('mh_teaching_roster', savedUnlockedTeachings, false);
      setTeachingRosterIds(savedTeachingRoster);
      const scores = {}; const attempts = {}; const clears = {};
      await Promise.all(Object.keys(DIFFICULTY_SETTINGS).map(async d => {
        scores[d] = await storeGet(`mh_hs_${d}`, 0, false);
        attempts[d] = await storeGet(`mh_attempts_${d}`, 0, false);
        clears[d] = await storeGet(`mh_clears_${d}`, 0, false);
      }));
      setHighScores(scores);
      setAttemptCounts(attempts);
      setClearCounts(clears);
      let wasOnboarded = await storeGet('mh_onboarded', null, false);
      if (wasOnboarded === null) {
        // onboardedフラグ自体が無い = 既存プレイヤーか初回か不明なので、
        // 既存のセーブデータ(名前変更済み/XPあり/ハイスコアあり)があれば既存プレイヤーとみなす
        const hasExistingData = savedName !== '名無しのブリーダー' || savedXp > 0 || Object.values(scores).some(s => s > 0);
        wasOnboarded = hasExistingData;
        await storeSet('mh_onboarded', wasOnboarded, false);
      }
      setOnboarded(wasOnboarded);
      if (!wasOnboarded) setGameState('PROFILE');
      await loadRankings();
    })();
  }, [loadRankings]);

  const submitLocalScore = async (diff, finalScore) => {
    const party = slots.map(s => s ? { name: s.name, emoji: s.emoji, imgUrl: s.imgUrl || null } : null);
    const name = breederName || '名無しのブリーダー';
    const heroName = mainHero?.name || 'Unknown';
    const level = breederLevel.level;
    const icon = breederIcon;
    // 全国ランキング(Supabase)への送信を優先。失敗時のみ端末内保存にフォールバック
    try {
      const existing = await sbFindPlayer(diff, name);
      const rowCore = { difficulty: diff, user_name: name, hero: heroName, party, score: finalScore };
      // level/icon列がテーブルに無い場合でも、片方だけでも保存できるよう段階的に試す
      // (level無し/icon無しどちらかだけが未対応でも、対応している方は失わない)
      const variants = [
        { ...rowCore, level, icon },
        { ...rowCore, level },
        { ...rowCore, icon },
        rowCore,
      ];
      let saved = false;
      for (const row of variants) {
        try {
          if (existing) {
            if ((existing.score || 0) < finalScore) await sbUpdateScore(existing.id, row); // keep best
          } else {
            await sbInsertScore(row);
          }
          saved = true;
          break;
        } catch (eVariant) {
          console.error('[ranking] submit variant failed, trying next:', eVariant && eVariant.message ? eVariant.message : eVariant);
        }
      }
      if (!saved) throw new Error('all submit variants failed');
    } catch (e) {
      console.error('[ranking] supabase submit failed, falling back to local:', e && e.message ? e.message : e);
      const entry = { userName: name, hero: heroName, party, score: finalScore, diff, level, icon };
      try {
        const rows = await storeGet(`mh_rank_${diff}`, [], false);
        const list = Array.isArray(rows) ? rows.slice() : [];
        const idx = list.findIndex(r => r.userName === name);
        if (idx >= 0) {
          if ((list[idx].score || 0) < finalScore) list[idx] = entry; // keep best
        } else {
          list.push(entry);
        }
        list.sort((a,b)=>(b.score||0)-(a.score||0));
        await storeSet(`mh_rank_${diff}`, list.slice(0,50), false);
      } catch (e2) {
        console.error('[ranking] local fallback also failed:', e2 && e2.message ? e2.message : e2);
      }
    }
    await loadRankings();
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    const n = tempName.trim().substring(0, 10);
    setBreederName(n);
    await storeSet('mh_breeder_name', n, false);
    setShowNameEdit(false);
  };

  // 端末のlocalStorageに保存された進行状況(mh_で始まる全キー)をひとつの文字列コードに書き出す。
  // ホーム画面アイコンを作り直すとiOSではデータが引き継がれないため、その手動バックアップ手段として使う
  const generateBackupCode = () => {
    try {
      if (!hasLocalStorage()) { setBackupCode(''); return; }
      const data = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('mh_')) data[k] = window.localStorage.getItem(k);
      }
      const json = JSON.stringify(data);
      const code = btoa(unescape(encodeURIComponent(json)));
      setBackupCode(code);
    } catch { setBackupCode(''); }
  };
  const copyBackupCode = async () => {
    try { await navigator.clipboard.writeText(backupCode); setBackupCopied(true); setTimeout(()=>setBackupCopied(false), 2000); } catch {}
  };
  const restoreFromBackupCode = () => {
    setRestoreMsg('');
    try {
      const json = decodeURIComponent(escape(atob(restoreInput.trim())));
      const data = JSON.parse(json);
      const keys = Object.keys(data).filter(k => k.startsWith('mh_'));
      if (keys.length === 0) { setRestoreMsg('コードが正しくありません'); return; }
      keys.forEach(k => window.localStorage.setItem(k, data[k]));
      setRestoreMsg('復元しました。再読み込みします...');
      setTimeout(() => window.location.reload(), 900);
    } catch { setRestoreMsg('コードが正しくありません'); }
  };

  // 現在の周回で使う候補モンスター/ブリーダーカード(編成で選んだもの)。空の場合は解放済み全体にフォールバック
  const getActiveMonsterList = () => {
    const list = Object.values(ALL_PLAYER_MONSTERS).filter(m => monsterRosterIds.includes(m.id));
    return list.length > 0 ? list : Object.values(ALL_PLAYER_MONSTERS).filter(m => unlockedMonsterIds.includes(m.id));
  };
  const getActiveTeachingCards = () => {
    const list = TEACHING_CARDS.filter(t => teachingRosterIds.includes(t.id));
    return list.length > 0 ? list : TEACHING_CARDS.filter(t => unlockedTeachingIds.includes(t.id));
  };

  // マーケットアイテムが購入済み(=解放済み)かどうか。typeによって参照する解放リストが異なる
  const isMarketItemOwned = (item) => {
    if (item.type === 'disc') return unlockedMonsterIds.includes(item.id);
    if (item.type === 'breeder') return unlockedTeachingIds.includes(item.id);
    return ownedMarketIcons.includes(item.id);
  };

  // ブリーダーマーケットでアイテムを購入。アイコンはpt、円盤石/ブリーダーはゴールドを消費し、
  // 種別ごとの解放リストに追加(端末保存)。円盤石/ブリーダーは解放と同時に編成へも自動追加する
  const buyMarketItem = (item) => {
    if (item.available === false) return; // 実装準備中のアイテムは購入不可
    if (isMarketItemOwned(item)) return;
    const usesGold = item.type === 'disc' || item.type === 'breeder';
    if (usesGold) {
      if (gold < item.cost) return;
      setGold(prev => { const next = prev - item.cost; storeSet('mh_gold', next, false); return next; });
    } else {
      if (breederPoints < item.cost) return;
      setBreederPoints(prev => { const next = prev - item.cost; storeSet('mh_breeder_points', next, false); return next; });
    }
    if (item.type === 'disc') {
      setUnlockedMonsterIds(prev => { const next = [...prev, item.id]; storeSet('mh_unlocked_monsters', next, false); return next; });
      // 編成はモンスター8体固定。既に8体埋まっている場合は自動追加せず、編成画面で手動入れ替えしてもらう
      setMonsterRosterIds(prev => { if (prev.length >= STARTER_MONSTER_IDS.length) return prev; const next = [...prev, item.id]; storeSet('mh_monster_roster', next, false); return next; });
    } else if (item.type === 'breeder') {
      setUnlockedTeachingIds(prev => { const next = [...prev, item.id]; storeSet('mh_unlocked_teachings', next, false); return next; });
      // 編成はブリーダーカード6枚固定。既に6枚埋まっている場合は自動追加せず、編成画面で手動入れ替えしてもらう
      setTeachingRosterIds(prev => { if (prev.length >= STARTER_TEACHING_IDS.length) return prev; const next = [...prev, item.id]; storeSet('mh_teaching_roster', next, false); return next; });
    } else {
      setOwnedMarketIcons(prev => { const next = [...prev, item.id]; storeSet('mh_market_icons', next, false); return next; });
    }
  };

  // 編成画面: 解放済みモンスター/ブリーダーカードの中から、次回以降の周回で使う候補を仮選択する。
  // 仮選択は自由に増減でき、「決定」を押してモンスター8体・ブリーダーカード6枚ちょうどの時だけ確定保存する
  const toggleDraftMonster = (id) => {
    setDraftMonsterRoster(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleDraftTeaching = (id) => {
    setDraftTeachingRoster(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const confirmMonsterRoster = () => {
    if (draftMonsterRoster.length !== STARTER_MONSTER_IDS.length) return;
    setMonsterRosterIds(draftMonsterRoster);
    storeSet('mh_monster_roster', draftMonsterRoster, false);
    setGameState('PROFILE');
  };
  const confirmTeachingRoster = () => {
    if (draftTeachingRoster.length !== STARTER_TEACHING_IDS.length) return;
    setTeachingRosterIds(draftTeachingRoster);
    storeSet('mh_teaching_roster', draftTeachingRoster, false);
    setGameState('PROFILE');
  };

  // 間合い適性の強化ポイントを1消費し、対象モンスターの対象距離の適性を1段階上げる
  const spendAptPoint = (monId, slotIdx) => {
    if ((distAptPoints[monId] || 0) <= 0) return;
    const mon = ALL_PLAYER_MONSTERS[monId];
    if (!mon) return;
    const current = getDistAptitude(mon, slotIdx);
    const idx = DIST_APTITUDE_GRADES.indexOf(current);
    if (idx < 0 || idx >= DIST_APTITUDE_GRADES.length - 1) return; // 既にM(上限)
    const nextGrade = DIST_APTITUDE_GRADES[idx + 1];
    setDistAptOverrides(prev => {
      const base = prev[monId] ? [...prev[monId]] : [...(mon.distAptitude || ['C','C','C','C'])];
      base[slotIdx] = nextGrade;
      const next = { ...prev, [monId]: base };
      storeSet('mh_dist_apt_overrides', next, false);
      return next;
    });
    setDistAptPoints(prev => {
      const next = { ...prev, [monId]: (prev[monId] || 0) - 1 };
      storeSet('mh_dist_apt_points', next, false);
      return next;
    });
    Audio_.se.tap();
  };

  // クリアしたWAVE数に応じてブリーダー経験値・ゴールド・勇者モンの絆経験値をまとめて加算(端末保存)。
  // 最終リザルト画面(CHAMPION/敗北)に出す獲得内訳もここで組み立てる
  const awardRunRewards = async (wavesCleared) => {
    if (wavesCleared <= 0) { setFinalRewardSummary({ breederXpGain: 0, breederLevelBefore: breederLevel, breederLevelAfter: breederLevel, goldBefore: gold, goldAfter: gold, heroBondGain: null, waveHistory }); return; }
    const scoreMult = DIFFICULTY_SETTINGS[difficulty]?.score || 1.0;
    const goldMult = DIFFICULTY_SETTINGS[difficulty]?.gold || 1.0;

    const breederXpGain = xpForWavesCleared(wavesCleared, scoreMult);
    const breederLevelBefore = levelInfo(breederXp);
    const nextXp = breederXp + breederXpGain;
    const breederLevelAfter = levelInfo(nextXp);
    setBreederXp(nextXp);
    storeSet('mh_breeder_xp', nextXp, false);
    const gainedLevels = breederLevelAfter.level - breederLevelBefore.level;
    if (gainedLevels > 0) {
      setBreederPoints(prev => { const next = prev + gainedLevels; storeSet('mh_breeder_points', next, false); return next; });
    }

    const goldGain = goldForWavesCleared(wavesCleared, goldMult);
    const goldBefore = gold;
    const goldAfter = gold + goldGain;
    setGold(goldAfter);
    storeSet('mh_gold', goldAfter, false);

    let heroBondGain = null;
    if (mainHero) {
      const before = levelInfo(bondXp[mainHero.id] || 0);
      const gain = xpForWavesCleared(wavesCleared, scoreMult);
      const nextMonXp = (bondXp[mainHero.id] || 0) + gain;
      const after = levelInfo(nextMonXp);
      const nextBondXp = { ...bondXp, [mainHero.id]: nextMonXp };
      setBondXp(nextBondXp);
      storeSet('mh_bond_xp', nextBondXp, false);
      const gainedBondLevels = after.level - before.level;
      if (gainedBondLevels > 0) {
        setDistAptPoints(prev => { const next = { ...prev, [mainHero.id]: (prev[mainHero.id] || 0) + gainedBondLevels }; storeSet('mh_dist_apt_points', next, false); return next; });
      }
      heroBondGain = { monId: mainHero.id, name: mainHero.name, emoji: mainHero.emoji, iconUrl: mainHero.iconUrl, xpGain: gain, levelBefore: before, levelAfter: after };
    }

    setFinalRewardSummary({ breederXpGain, breederLevelBefore, breederLevelAfter, goldBefore, goldAfter, heroBondGain, waveHistory });
  };

  // Save score on game end
  useEffect(() => {
    if (hp <= 0 || gameState === 'CHAMPION') {
      (async () => {
        // スコア送信(全国ランキング等、通信を伴う)が失敗しても、経験値・ダイヤ付与(最終リザルト画面表示に必須)は
        // 必ず実行されるよう、try/catchを分離する
        try {
          if (score > 0) await submitLocalScore(difficulty, score);
          if (score > (highScores[difficulty] || 0)) {
            await storeSet(`mh_hs_${difficulty}`, score, false);
            setHighScores(prev => ({ ...prev, [difficulty]: score }));
          }
        } catch (e) { console.error('[result] score submit failed:', e && e.message ? e.message : e); }
        try {
          await awardRunRewards(gameState === 'CHAMPION' ? 10 : Math.max(0, wave - 1));
          if (gameState === 'CHAMPION') {
            setClearCounts(prev => { const next = { ...prev, [difficulty]: (prev[difficulty]||0)+1 }; storeSet(`mh_clears_${difficulty}`, next[difficulty], false); return next; });
          }
        } catch (e) { console.error('[result] award rewards failed:', e && e.message ? e.message : e); }
      })();
    }
  }, [hp, gameState]);


  const cardLimit = useMemo(() => {
    const allyCount = slots.filter(s => s !== null).length;
    let limit = 1;
    if (effectiveMaxGuts >= 180 && allyCount >= 3) limit = 3;
    else if (effectiveMaxGuts >= 120 && allyCount >= 2) limit = 2;
    if (mainHero?.id === 'Ham') limit += 1;
    return limit;
  }, [effectiveMaxGuts, slots, mainHero]);

  const getCardGuts = (card) => {
    if (!card) return 0;
    if (card.type === 'guard') return 0;
    if (['buff','debuff','heal','draw'].includes(card.type)) return card.guts || 20;
    let cost = 20;
    if (['atk','range_atk','unique'].includes(card.type)) {
      let actualBaseMult = 1.0, actualCurrentMult = 1.0, actualBaseGuts = 20;
      if (card.type === 'unique') { const level = card.evoLevel || 0; actualBaseMult = card.baseMult; actualCurrentMult = card.baseMult + (level * 0.5); actualBaseGuts = card.baseGuts; }
      else { actualCurrentMult = card.mult; actualBaseMult = card.baseMult; actualBaseGuts = card.baseGuts; }
      if (actualBaseMult > 0) { const increaseRate = actualCurrentMult / actualBaseMult; cost = Math.floor(actualBaseGuts * increaseRate); }
      // 中二病特性: 固有技使用のたびに永続で消費ガッツ+10%(重複可)
      if (card.type === 'unique' && (card.monId==='Ark'||card.monId==='Iblis')) cost = Math.floor(cost * (1 + 0.1*getPermaBuff('chuuniUniqueStack')));
    }
    if (getTurnBuff('zeroGuts', false) && ['atk','range_atk','unique'].includes(card.type)) cost = 0;
    cost = Math.floor(cost * getTurnBuff('gutsCostMult', 1.0));
    return cost;
  };

  const resetAllState = () => ({
    score:0, wave:1, hp:500, maxHp:500, guts:50, maxGuts:100, atk:100, def:100,
    slots:[null,null,null,null], mainHero:null, hand:[], deck:[], graveyard:[],
    enemy:null, enemyDist:2, selectedCards:[], isBusy:false,
    monSelection:getActiveMonsterList(), ownedUniques:[], ownedTeachings:[],
    atkLevel:0, guardLevel:0, guardBonusCount:0, upgradePoints:0, turnCount:1,
    permaBuffs:{ autoHpRecovery:0.1 }, waveBuffs:{}, turnBuffs:{}, nextTurnBuffs:{},
    currentWaveDamage:0, waveDistDamage:[0,0,0,0], distDmgBonus:[0,0,0,0], totalDistDamage:[0,0,0,0], totalAllDamage:0, totalRecoveryDelta:0, waveResult:null,
    focusedCard:null, enemyIntent:null, effect:null, finalRewardSummary:null, waveHistory:[], gaveUp:false
  });

  const handleGoToTitle = () => {
    const s = resetAllState();
    setScore(s.score); setWave(s.wave); setHp(s.hp); setMaxHp(s.maxHp); setGuts(s.guts); setMaxGuts(s.maxGuts);
    setAtk(s.atk); setDef(s.def); setSlots(s.slots); setMainHero(s.mainHero); setHand(s.hand); setDeck(s.deck);
    setGraveyard(s.graveyard); setEnemy(s.enemy); setEnemyDist(s.enemyDist); setSelectedCards(s.selectedCards); setCardAssignments({}); setPendingCard(null);
    setIsBusy(s.isBusy); setMonSelection(s.monSelection); setOwnedUniques(s.ownedUniques);
    setOwnedTeachings(s.ownedTeachings); setAtkLevel(s.atkLevel); setGuardLevel(s.guardLevel);
    setGuardBonusCount(s.guardBonusCount); setUpgradePoints(s.upgradePoints); setTurnCount(s.turnCount);
    setPermaBuffs(s.permaBuffs); setWaveBuffs(s.waveBuffs); setTurnBuffs(s.turnBuffs); setNextTurnBuffs(s.nextTurnBuffs);
    setCurrentWaveDamage(s.currentWaveDamage); setWaveDistDamage(s.waveDistDamage||[0,0,0,0]); setDistDmgBonus(s.distDmgBonus||[0,0,0,0]); setTotalDistDamage(s.totalDistDamage||[0,0,0,0]); setTotalAllDamage(s.totalAllDamage||0); setTotalRecoveryDelta(s.totalRecoveryDelta||0);
    setWaveResult(s.waveResult);
    setPendingReward(null); setFocusedCard(s.focusedCard); setShowQuitConfirm(false); setEnemyIntent(s.enemyIntent); setEffect(s.effect); setFinalRewardSummary(s.finalRewardSummary); setWaveHistory(s.waveHistory||[]); setGaveUp(s.gaveUp);
    setGameState('TITLE');
  };

  // Give up mid-run: record current score to ranking, award rewards, then show the final result screen (gaveUp)
  const handleGiveUp = useCallback(async () => {
    if (score > 0) {
      try {
        await submitLocalScore(difficulty, score);
        if (score > (highScores[difficulty] || 0)) {
          await storeSet(`mh_hs_${difficulty}`, score, false);
          setHighScores(prev => ({ ...prev, [difficulty]: score }));
        }
      } catch {}
    }
    try { await awardRunRewards(Math.max(0, wave - 1)); } catch {}
    setShowQuitConfirm(false);
    setGaveUp(true);
  }, [score, difficulty, highScores, breederName, mainHero, slots, wave]);

  const handleRetry = () => {
    const s = resetAllState();
    setScore(s.score); setWave(s.wave); setHp(s.hp); setMaxHp(s.maxHp); setGuts(s.guts); setMaxGuts(s.maxGuts);
    setAtk(s.atk); setDef(s.def); setSlots(s.slots); setMainHero(s.mainHero); setHand(s.hand); setDeck(s.deck);
    setGraveyard(s.graveyard); setEnemy(s.enemy); setEnemyDist(s.enemyDist); setSelectedCards(s.selectedCards); setCardAssignments({}); setPendingCard(null);
    setIsBusy(s.isBusy); setMonSelection(s.monSelection); setOwnedUniques(s.ownedUniques);
    setOwnedTeachings(s.ownedTeachings); setAtkLevel(s.atkLevel); setGuardLevel(s.guardLevel);
    setGuardBonusCount(s.guardBonusCount); setUpgradePoints(s.upgradePoints); setTurnCount(s.turnCount);
    setPermaBuffs(s.permaBuffs); setWaveBuffs(s.waveBuffs); setTurnBuffs(s.turnBuffs); setNextTurnBuffs(s.nextTurnBuffs);
    setCurrentWaveDamage(s.currentWaveDamage); setWaveDistDamage(s.waveDistDamage||[0,0,0,0]); setDistDmgBonus(s.distDmgBonus||[0,0,0,0]); setTotalDistDamage(s.totalDistDamage||[0,0,0,0]); setTotalAllDamage(s.totalAllDamage||0); setTotalRecoveryDelta(s.totalRecoveryDelta||0);
    setWaveResult(s.waveResult);
    setFocusedCard(s.focusedCard); setEnemyIntent(s.enemyIntent); setEffect(s.effect); setPendingReward(null); setFinalRewardSummary(s.finalRewardSummary); setWaveHistory(s.waveHistory||[]); setGaveUp(s.gaveUp);
    setGameState('PICK_HERO');
  };

  const getNextEnemyAction = useCallback((ent, currentDist) => {
    if (!ent) return null;
    const roll = Math.random() * 100;
    if (roll < 45) return { type:'ATTACK', value:ent.atk, label:ent.normal||"通常攻撃", icon:"👊" };
    else if (roll < 60) return { type:'CHARGE', value:Math.floor(ent.atk*2.5), label:ent.special||"必殺技！", icon:"🔥" };
    else if (roll < 80) return { type:'WAIT', value:0, label:"様子を見ている", icon:"⏳" };
    else { let nextDist=currentDist; while(nextDist===currentDist){nextDist=Math.floor(Math.random()*4);} return {type:'MOVE',value:0,label:`移動: ${RANGE_LABELS[nextDist]}`,targetDist:nextDist,icon:"🏃"}; }
  }, []);

  const getPredictedDamage = useCallback((intent) => {
    if (!intent||(intent.type!=='ATTACK'&&intent.type!=='CHARGE')) return 0;
    const atkVal = Math.floor(intent.value*(1.0-getWaveBuff('enemyAtkDebuffPct')));
    const chuuniCutActive = (mainHero?.id==='Ark'||mainHero?.id==='Iblis') && getWaveBuff('chuuniDmgCutUses')<2; // 中二病特性: WAVE毎2回まで被ダメ50%カット
    const dmgBase = Math.max(30,(atkVal*getTurnBuff('takenDamageMult',1.0))-(def*0.15))*((mainHero?.id==='Mocchi'||mainHero?.id==='Mitarashi')?0.8:1.0)*(chuuniCutActive?0.5:1.0);
    return Math.max(1,Math.floor(dmgBase*Math.max(0.01,(1.0-getPermaBuff('dmgCutPct')))));
  }, [def, turnBuffs, mainHero, permaBuffs, waveBuffs]);

  const addPopup = (text, side, color) => {
    const id = Date.now()+Math.random();
    setPopups(prev=>[...prev,{id,text,side,color}]);
    setTimeout(()=>setPopups(p=>p.filter(x=>x.id!==id)),2500);
  };

  // ブリーダー教えカード使用時の専用演出を発火
  const fireTeachingFx = (id) => {
    if (!TEACHING_FX_STYLE[id]) return;
    const fxId = Date.now()+Math.random();
    setTeachingFx({id, fxId});
    setTimeout(()=>setTeachingFx(p=>(p&&p.fxId===fxId?null:p)), 900);
  };

  // Whether a card needs to be assigned to a monster (attack-type cards)
  const cardNeedsMonster = (card) => {
    if(!card) return false;
    if(['atk','range_atk','unique'].includes(card.type)) return true;
    if(card.type==='debuff'&&card.subType==='stun_atsu') return true;
    return false;
  };
  // ダメージを与える(攻撃順・ダメージ予測の対象になる)カードか。あつの挑発(stun_atsu)は
  // debuffだが実際にダメージを与えるためprocessTurnと同様ここでも攻撃扱いする
  const isAttackCard = (card) => !!card && (['atk','range_atk','unique'].includes(card.type) || (card.type==='debuff'&&card.subType==='stun_atsu'));
  // カードのicon欄が画像(顔アイコン)かemoji文字かを判別して描画
  const cardIconNode = (icon, sizePx) => (typeof icon==='string' && icon.startsWith('data:'))
    ? <img src={icon} alt="" draggable={false} style={{width:sizePx,height:sizePx,WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="rounded-full object-cover inline-block shrink-0"/>
    : icon;
  // プロフィールアイコンidから表示URLを解決(味方モンスター由来 or ブリーダーマーケット購入品)
  const resolveIconUrl = (id) => {
    if (!id) return null;
    if (ALL_PLAYER_MONSTERS[id]?.iconUrl) return ALL_PLAYER_MONSTERS[id].faceIconUrl || ALL_PLAYER_MONSTERS[id].iconUrl;
    const item = BREEDER_MARKET_ITEMS.find(m => m.id === id && m.type === 'icon');
    return item ? item.icon : null;
  };

  // カード選択(タップ/ドラッグ共通)
  const selectCardAt = (i) => {
    if(isBusy) return;
    const c=hand[i]; if(!c) return;
    if(pendingCard!==null && pendingCard!==i){ setFocusedCard(c); return; }
    const isSel=selectedCards.includes(i);
    if(isSel){
      setSelectedCards(p=>p.filter(x=>x!==i));
      setCardAssignments(p=>{const n={...p}; delete n[i]; return n;});
      if(pendingCard===i) setPendingCard(null);
      setFocusedCard(null);
    } else {
      const curGuts=getCardGuts(c);
      const remainingGuts=guts-selectedCards.reduce((acc,idx)=>acc+getCardGuts(hand[idx]),0);
      const isSelectable=remainingGuts>=curGuts && selectedCards.length<cardLimit;
      if(isSelectable){
        Audio_.se.card();
        setSelectedCards(p=>[...p,i]);
        setFocusedCard(c);
        if(cardNeedsMonster(c)){ setPendingCard(i); }
      } else { setFocusedCard(c); }
    }
  };

  // ドラッグでカードをスロットに割り当て
  const dragAssignToSlot = (cardIndex, slotIdx) => {
    if(isBusy) return;
    const c=hand[cardIndex]; if(!c) return;
    const targetMon=slots[slotIdx];
    // 攻撃カード: モンスターのいるスロットに割り当て
    if(cardNeedsMonster(c)){
      if(!targetMon) { setFocusedCard(c); return; }
      // uniqueは自分のモンスターのみ
      if(c.type==='unique' && targetMon.id!==c.monId){ setFocusedCard(c); return; }
      // 既存の割当数チェック(ハム勇者時は複数可)
      const assignedCount=Object.values(cardAssignments).filter(v=>v===slotIdx).length;
      const maxUses=(mainHero?.id==='Ham'&&targetMon?.id==='Ham')?cardLimit:1;
      const alreadySelected=selectedCards.includes(cardIndex);
      // 未選択なら選択枠とガッツを確認
      if(!alreadySelected){
        const curGuts=getCardGuts(c);
        const remainingGuts=guts-selectedCards.reduce((acc,idx)=>acc+getCardGuts(hand[idx]),0);
        if(remainingGuts<curGuts || selectedCards.length>=cardLimit){ setFocusedCard(c); return; }
        if(assignedCount>=maxUses){ setFocusedCard(c); return; }
        Audio_.se.card();
        setSelectedCards(p=>[...p,cardIndex]);
        setCardAssignments(p=>({...p,[cardIndex]:slotIdx}));
        setPendingCard(null);
        setFocusedCard(c);
      } else {
        // 既に選択済み: 割当先を変更(別カードの占有を超えない範囲で)
        const otherCount=Object.entries(cardAssignments).filter(([k,v])=>v===slotIdx&&Number(k)!==cardIndex).length;
        if(otherCount>=maxUses){ setFocusedCard(c); return; }
        Audio_.se.card();
        setCardAssignments(p=>({...p,[cardIndex]:slotIdx}));
        if(pendingCard===cardIndex) setPendingCard(null);
        setFocusedCard(c);
      }
    } else {
      // モン不要カード: ドラッグでも単に選択扱い
      if(!selectedCards.includes(cardIndex)) selectCardAt(cardIndex);
    }
  };

  const getDmg = useCallback((card, slotIdx, mon, additionalOryo=0, additionalDmgMod=0, isSecondOrLaterAtk=false) => {
    if (!mon||!card||['guard','draw','buff','heal','weak_guard'].includes(card.type)) return 0;
    const distDiff = Math.abs(slotIdx-enemyDist);
    const distMult = [1.5,1.3,1.1,0.9][distDiff]||1.0;
    let baseDmgMult = 1.0;
    if (card.subType==='stun_atsu') { baseDmgMult = card.baseValue||1.5; }
    else if (card.type==='unique') { const level=card.evoLevel||0; const chuuniBonus=(card.monId==='Ark'||card.monId==='Iblis')?0.1*getPermaBuff('chuuniUniqueStack'):0; baseDmgMult=card.baseMult+(level*0.5)+chuuniBonus; }
    else if (card.type==='range_atk') { const isTargetDist=(enemyDist===card.rangeIdx); baseDmgMult=isTargetDist?card.mult:(card.mult*0.4); }
    else { baseDmgMult=card.mult||card.baseMult||1.0; }
    let traitMult=(mainHero?.id==='Golem'?1.2:1.0)*(mainHero?.id==='Pixie'&&card.type==='unique'?2.0:1.0);
    const aptBonus=DIST_APTITUDE_MULT[getDistAptitude(mon,slotIdx)]-1.0;
    const distBonusMult=1.0+(distDmgBonus[slotIdx]||0)+aptBonus;
    const totalBuffMult=traitMult*getTurnBuff('atkMult',1.0)*(1.0+getPermaBuff('atkPct')+getPermaBuff('muaAtkPct')+additionalOryo)*distBonusMult;
    let finalDmg=Math.floor(atk*distMult*baseDmgMult*totalBuffMult*(1.0+getWaveBuff('enemyTakenDmgBonus')+additionalDmgMod));
    if (isSecondOrLaterAtk) finalDmg=Math.floor(finalDmg*0.5);
    return finalDmg;
  }, [enemyDist, mainHero, atk, turnBuffs, permaBuffs, waveBuffs, distDmgBonus]);

  // ザンの勇者特性「連撃」による追加ヒット分の合計(プレビュー用)。実際のバトルログはprocessTurn内で別枠ヒットとして計算する
  const getComboBonusDmg = useCallback((card, mon, baseDmg) => {
    if (!(mainHero?.id==='Zan' && mon?.id==='Zan') || baseDmg<=0) return 0;
    const comboDmgBonus = getPermaBuff('comboDmgPct');
    let bonus = Math.floor(baseDmg*(0.3+comboDmgBonus));
    if (card.type==='unique') bonus += Math.floor(baseDmg*(0.2+comboDmgBonus));
    return bonus;
  }, [mainHero, permaBuffs]);

  const handleEnemyTurn = async (lastActionType, immediateEffects={}, overrideIntent=null) => {
    if (!enemy) return;
    const intent = overrideIntent||enemyIntent;
    setEnemySkillName({label:intent.label, icon:intent.icon});
    await wait(600);
    let currentHp = hp;

    if (getTurnBuff('invincible',false)||immediateEffects.invincible) {
      addPopup("無効化！",'hero','text-blue-400 font-black text-xl drop-shadow-md');
      setImmediateTurnBuff('invincible',false); await wait(1000);
    } else if (getTurnBuff('stunEnemy',false)||immediateEffects.stun) {
      addPopup("スタン！",'enemy','text-indigo-400 font-black text-xl drop-shadow-md');
      setImmediateTurnBuff('stunEnemy',false); await wait(1000);
    } else if (mainHero?.id==='Suezo'&&Math.random()<0.4) {
      addPopup("眼力！",'enemy','text-indigo-400 font-black text-xl drop-shadow-md'); await wait(1000);
    } else {
      if (intent.type==='MOVE') {
        // 移動専用エフェクト: ダッシュマーク＋残像
        Audio_.se.enemyMove();
        setEnemyAttackFx({kind:'move'});
        setEnemyAttackAnim(true);
        addPopup(`${RANGE_LABELS[intent.targetDist]}へ移動！`,'enemy','text-cyan-300 font-black text-xl drop-shadow-md');
        await wait(450);
        setEnemyDist(intent.targetDist);
        await wait(350);
        setEnemyAttackAnim(false);
        setEnemyAttackFx(null);
        await wait(200);
      } else if (intent.type==='WAIT') {
        addPopup("待機中...",'enemy','text-slate-400 text-lg'); await wait(500);
      } else if (intent.type==='ATTACK'||intent.type==='CHARGE') {
        const guardValue = immediateEffects.guardPower>0 ? Math.floor(def*immediateEffects.guardPower) : 0;
        const incomingDmg = getPredictedDamage(intent);
        if ((mainHero?.id==='Ark'||mainHero?.id==='Iblis') && getWaveBuff('chuuniDmgCutUses')<2) {
          addWaveBuff('chuuniDmgCutUses',1);
          addPopup('中二病発動!被ダメ50%カット','hero','text-pink-400 text-sm font-bold');
        }
        const isReflect = getTurnBuff('reflect',false)||(mainHero?.id==='Monol'&&Math.random()<0.3);
        const isAbsorb = mainHero?.id==='Oboro'&&Math.random()<0.3;

        // Enemy lunge animation + attack effect (normal = ! mark, special = aura burst)
        const fxKind = enemy?.id==='Moo' ? 'moo' : (intent.type==='CHARGE' ? 'special' : 'normal');
        setEnemyAttackFx({kind: fxKind});
        if(intent.type==='CHARGE') Audio_.se.enemySpecial(); else Audio_.se.enemyAttack();
        setEnemyAttackAnim(true);
        if(fxKind==='moo') triggerShake(true);
        await wait(fxKind==='moo' ? 900 : (intent.type==='CHARGE' ? 1100 : 450));
        setEnemyAttackAnim(false);
        await wait(fxKind==='moo' ? 250 : (intent.type==='CHARGE' ? 300 : 100));
        setEnemyAttackFx(null);

        if (isReflect) {
          addPopup("反射！",'hero','text-purple-400 font-black text-2xl drop-shadow-lg'); await wait(600);
          addPopup(`反射 ${incomingDmg}!!`,'enemy','text-purple-400 font-black text-4xl drop-shadow-lg');
          setCurrentWaveDamage(p=>p+incomingDmg);
          setEnemy(prev=>({...prev,hp:Math.max(0,prev.hp-incomingDmg)})); await wait(1000);
        } else if (isAbsorb) {
          addPopup("吸収！",'hero','text-emerald-400 font-black text-2xl drop-shadow-lg'); await wait(600);
          const hpGain=incomingDmg; const gutsGain=Math.floor(incomingDmg*0.1);
          addPopup(`💚 ライフ +${hpGain}`,'life','text-emerald-400 font-black text-2xl drop-shadow-md');
          addPopup(`⚡ ガッツ +${gutsGain}`,'guts','text-amber-400 font-black text-2xl drop-shadow-md');
          currentHp=Math.min(effectiveMaxHp,currentHp+hpGain); setHp(currentHp);
          setGuts(p=>Math.min(effectiveMaxGuts,p+gutsGain)); await wait(1000);
        } else if (mainHero?.id==='Tiger'&&Math.random()<0.5) {
          addPopup("回避！",'hero','text-blue-400 font-black text-xl drop-shadow-lg'); await wait(1000);
        } else if (guardValue>0) {
          const diff=guardValue-incomingDmg;
          // キーンと弾くガード演出
          setGuardFx(true); Audio_.se.guard(); triggerShake();
          await wait(550); setGuardFx(false);
          if (diff<0) { const fd=Math.abs(diff); addPopup(`貫通! -${fd}`,'hero','text-pink-600 text-3xl font-black drop-shadow-lg'); await wait(1000); currentHp=Math.max(0,currentHp-fd); setHp(currentHp); await wait(1000); }
          else { const gGain=Math.floor(diff*0.1); addPopup(`🛡 ガード成功`,'hero','text-emerald-400 text-2xl font-black drop-shadow-md'); addPopup(`💚 ライフ +${diff}`,'life','text-emerald-400 text-2xl font-black drop-shadow-md'); addPopup(`⚡ ガッツ +${gGain}`,'guts','text-amber-400 text-xl font-bold drop-shadow-md'); await wait(1000); currentHp=Math.min(effectiveMaxHp,currentHp+diff); setHp(currentHp); setGuts(p=>Math.min(effectiveMaxGuts,p+gGain)); await wait(1000); }
        } else {
          addPopup(`-${incomingDmg}`,'hero','text-pink-600 text-4xl font-black drop-shadow-lg animate-bounce'); triggerShake(); await wait(1000);
          currentHp=Math.max(0,currentHp-incomingDmg); setHp(currentHp); await wait(1000);
        }
      }
    }
    setEnemySkillName(null);
    if (currentHp<=0) { setIsBusy(false); return; }
    const autoHpRecoveryRate=getPermaBuff('autoHpRecovery',0.1);
    const gutsRecoveryRate=Math.max(0,0.05+(autoHpRecoveryRate-0.1))+getPermaBuff('gutsRecoverPct');
    const gutsRegen=Math.floor(effectiveMaxGuts*gutsRecoveryRate);
    setGuts(p=>Math.min(effectiveMaxGuts,p+gutsRegen));
    let didRegen=false;
    if (autoHpRecoveryRate>0) {
      const autoHealVal=Math.floor(effectiveMaxHp*autoHpRecoveryRate);
      if (autoHealVal>0) { setHp(p=>Math.min(effectiveMaxHp,p+autoHealVal)); addPopup(`🌿 自動再生 +${autoHealVal}`,'life','text-teal-300 font-black text-lg italic drop-shadow-md'); didRegen=true; }
    }
    if (gutsRegen>0) { addPopup(`🌿 自動ガッツ +${gutsRegen}`,'guts','text-cyan-300 font-black text-lg italic drop-shadow-md'); didRegen=true; }
    if (didRegen) { await wait(500); }
    // 次ターン予約分(nextTurnBuffs)をそのまま今ターンの一時バフ(turnBuffs)へ入れ替える(新しい一時効果を追加してもここは変更不要)
    // 関数更新式で読むことで、このターン中に予約された最新のnextTurnBuffsを確実に反映する(古いクロージャ値を使わない)
    setNextTurnBuffs(latestNextTurnBuffs => { setTurnBuffs(latestNextTurnBuffs); return {}; });
    const nextTurn=turnCount+1; setTurnCount(nextTurn); if(nextTurn>20){setHp(0);} setIsBusy(false);
  };

  const useEmergency = async () => {
    if (isBusy||hp<=0) return; setIsBusy(true);
    Audio_.se.heal();
    const recoverHp=Math.floor(effectiveMaxHp*0.3);
    setEffect({type:'heal',label:"緊急回復",icon:"💊",monEmoji:mainHero?.emoji||"🏥",imgUrl:mainHero?.imgUrl});
    await wait(500); setEffect(null);
    const recoverGuts=Math.floor(effectiveMaxGuts*0.3);
    addPopup(`💚 ライフ +${recoverHp}`,'life','text-emerald-400 text-2xl font-black drop-shadow-md');
    addPopup(`⚡ ガッツ +${recoverGuts}`,'guts','text-amber-400 text-2xl font-black drop-shadow-md'); await wait(1000);
    setHp(p=>Math.min(effectiveMaxHp,p+recoverHp)); setGuts(p=>Math.min(effectiveMaxGuts,p+recoverGuts)); await wait(1000);
    setEnemyIntent(getNextEnemyAction(enemy,enemyDist)); await handleEnemyTurn('none');
  };

  const processTurn = async () => {
    if (isBusy||!enemy||selectedCards.length===0) return;
    setFocusedCard(null); setPendingCard(null);
    // Build list of {card, handIndex, slotIdx} pairs
    const usedCardEntries=selectedCards.map(i=>({card:hand[i], handIndex:i, slotIdx:cardAssignments[i]!=null?cardAssignments[i]:null}));
    const usedCards=usedCardEntries.map(e=>e.card);
    const totalGuts=usedCards.reduce((a,c)=>a+getCardGuts(c),0);
    if (guts<totalGuts) return;
    // Fallback slot for cards without assignment (buffs etc.)
    const defaultSlot=slots.findIndex(s=>s!==null);
    setIsBusy(true);
    let lastType='none', guardTypeInTurn='none', totalDmg=0, totalHeal=0, localOryoAdd=0, localDmgModAdd=0, attackCount=0, hasCrit=false, immediateInvincible=false, immediateStun=false, currentTurnGuardPower=0;
    let forcedMoveTarget=null; // range_atk forces enemy to move at turn end
    const attackHits=[]; // {dmg, isCrit, slotIdx}

    // カットイン廃止: 技名はスロット上にインライン表示する（実行ループ内で行う）

    for (const entry of usedCardEntries) {
      const card=entry.card;
      const slotIdx=entry.slotIdx!=null?entry.slotIdx:defaultSlot;
      lastType=card.type;
      if (card.type==='guard') { Audio_.se.guard(); guardTypeInTurn='guard'; currentTurnGuardPower+=GUARD_EVOLUTION[guardLevel].power; }
      else if (card.type==='weak_guard') { if(guardTypeInTurn!=='guard') guardTypeInTurn='weak_guard'; currentTurnGuardPower+=(GUARD_EVOLUTION[guardLevel].power*0.5); }
      setGuts(p=>Math.max(0,p-getCardGuts(card)));
      if (card.type==='draw') continue;
      if (card.type==='buff'||card.type==='debuff') {
        fireTeachingFx(card.id);
        if (card.subType==='atk_buff') { addPopup(`攻撃UP!`,'hero','text-red-400 font-black text-2xl drop-shadow-md'); addPermaBuff('atkPct',card.baseValue); localOryoAdd+=card.baseValue; }
        else if (card.subType==='dmg_cut_buff') { addPopup(`防御UP!`,'hero','text-emerald-400 font-black text-2xl drop-shadow-md'); const owned=ownedTeachings.find(ot=>ot.id===card.id); const level=owned?owned.evoLevel:0; let cutValue=level===0?0.03:(level===1?0.06:0.10); setPermaBuffs(p=>({...p, dmgCutPct:Math.min(0.9,(p.dmgCutPct||0)+cutValue)})); }
        else if (card.subType==='guts_buff') { addPopup(`⚡ ガッツ上限UP!`,'guts','text-amber-400 font-black text-2xl drop-shadow-md'); const owned=ownedTeachings.find(ot=>ot.id===card.id); const level=owned?owned.evoLevel:0; let gutsRecoverAdd=level===0?0.02:(level===1?0.03:0.05); addPermaBuff('gutsRecoverPct',gutsRecoverAdd); let gutsLimitUp=level===1?0.05:(level>=2?0.07:0.05); addPermaBuff('muaGutsPct',gutsLimitUp); if(level>=1){let hpLimitUp=level===1?0.05:0.07; let autoHeal=level===1?0.02:0.05; addPermaBuff('muaHpPct',hpLimitUp); addPermaBuff('autoHpRecovery',autoHeal); addPopup(`💚 再生強化`,'life','text-emerald-400 font-black text-xl drop-shadow-md');} }
        else if (card.subType==='stun_atsu') {
          immediateInvincible=true; setImmediateTurnBuff('invincible',true);
          const stunMon=slots[slotIdx];
          const d=getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,attackCount>0); totalDmg+=d; attackCount++; attackHits.push({dmg:d, isCrit:false, slotIdx});
          // 勇者特性「連撃」: ザンが勇者モンの時、ザンの攻撃(あつの挑発シリーズ含む)に連撃ヒットを追加
          if (stunMon?.id==='Zan' && mainHero?.id==='Zan') {
            const comboBase=Math.floor(d*(0.3+getPermaBuff('comboDmgPct')));
            if (comboBase>0) {
              const comboCrit=getTurnBuff('guaranteedCrit',false)||(Math.random()<((card.crit||0.1)+getPermaBuff('critRatePct')));
              const comboFinal=comboCrit?Math.floor(comboBase*(1.5+getPermaBuff('critDmgPct'))):comboBase;
              if (comboCrit) hasCrit=true; totalDmg+=comboFinal;
              attackHits.push({dmg:comboFinal, isCrit:comboCrit, slotIdx, isSpecial:true, skillName:'連撃', isUnique:false});
            }
          }
        }
        else if (card.subType==='buff_myaru') { setNextTurnBuff('atkMult',card.baseValue); const selfDmgAmt=Math.floor(hp*card.selfDmg); addPopup(`自傷-${selfDmgAmt}`,'hero','text-red-600 text-2xl font-black'); setHp(p=>Math.max(1,p-selfDmgAmt)); }
      }
      else if (card.type==='heal') {
        Audio_.se.heal();
        fireTeachingFx(card.id);
        const owned=ownedTeachings.find(t=>t.id===card.id); const level=owned?owned.evoLevel:0;
        if (card.id==='mua') {
          let hpRecRate=level===1?0.7:(level>=2?0.9:0.5), gutsRecRate=level>=1?(level>=2?0.9:0.7):0;
          let hpB=level===1?0.05:(level>=2?0.08:0.03), atkB=level>=2?0.05:0.03, gutsB=level>=2?0.05:0.03;
          const healVal=Math.floor(effectiveMaxHp*hpRecRate); totalHeal+=healVal;
          addPermaBuff('muaHpPct',hpB); addPermaBuff('muaAtkPct',atkB); addPermaBuff('muaGutsPct',gutsB);
          if(gutsRecRate>0){const gv=Math.floor(effectiveMaxGuts*gutsRecRate); setGuts(p=>Math.min(effectiveMaxGuts,p+gv)); addPopup(`⚡ ガッツ +${gv}`,'guts','text-amber-400 font-black text-2xl drop-shadow-md');}
        } else {
          const healVal=Math.floor(effectiveMaxHp*(0.5+level*0.2)); totalHeal+=healVal;
          addPermaBuff('muaHpPct',0.10); addPermaBuff('muaAtkPct',0.05); addPermaBuff('muaGutsPct',0.10);
          if(level>=1){const gv=Math.floor(effectiveMaxGuts*(0.5+level*0.2)); setGuts(p=>Math.min(effectiveMaxGuts,p+gv)); addPopup(`⚡ ガッツ +${gv}`,'guts','text-amber-400 font-black text-2xl drop-shadow-md');}
        }
      }
      else if (card.type!=='guard'&&card.type!=='weak_guard') {
        const activeMon=slots[slotIdx];
        if (card.type==='unique') {
          if(activeMon.id==='Mocchi'||activeMon.id==='Mitarashi'){addPermaBuff('dmgCutPct',0.03); addWaveBuff('enemyTakenDmgBonus',0.1); localDmgModAdd+=0.1; addPopup('丈夫さUP!','hero','text-emerald-400 text-lg font-bold');}
          else if(activeMon.id==='Golem'){addPermaBuff('atkPct',0.1); localOryoAdd+=0.1; addPopup('闘志UP!','hero','text-red-600 text-lg font-bold');}
          else if(activeMon.id==='Zan'){addPermaBuff('comboDmgPct',0.03); addPopup('連斬!','hero','text-cyan-400 text-lg font-bold');}
        }
        const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,attackCount>0); attackCount++;
        const critRateBonus=getPermaBuff('critRatePct'), critDmgBonus=getPermaBuff('critDmgPct');
        const isCrit=getTurnBuff('guaranteedCrit',false)||(Math.random()<((card.crit||0.1)+critRateBonus));
        const finalD=isCrit?Math.floor(d*(1.5+critDmgBonus)):d; if(isCrit) hasCrit=true; totalDmg+=finalD;
        attackHits.push({dmg:finalD, isCrit, slotIdx, isSpecial:(card.type==='unique'||card.type==='range_atk'), skillName:(card.name||card.baseName), isUnique:card.type==='unique'});
        if (activeMon.id==='Zan') {
          // 会心はメイン攻撃とは独立して判定する(元ダメージdを基準にすることで、メイン攻撃の会心を二重に乗せない)
          const comboDmgBonus=getPermaBuff('comboDmgPct');
          const rollCombo=(rate)=>{
            const base=Math.floor(d*rate);
            if (base<=0) return;
            const crit=getTurnBuff('guaranteedCrit',false)||(Math.random()<((card.crit||0.1)+critRateBonus));
            const final=crit?Math.floor(base*(1.5+critDmgBonus)):base;
            if (crit) hasCrit=true; totalDmg += final;
            attackHits.push({dmg:final, isCrit:crit, slotIdx, isSpecial:true, skillName:'連撃', isUnique:false});
          };
          // 勇者特性「連撃」: ザンが勇者モンの時のみ、ザンの攻撃(通常/固有問わず)に連撃ヒットを追加
          if (mainHero?.id==='Zan') rollCombo(0.3+comboDmgBonus);
          // 固有技「連斬」自体の連撃: 勇者モンかどうかに関わらず、固有技を使えば発生する
          if (card.type==='unique') rollCombo(0.2+comboDmgBonus);
        }
        if (card.type==='range_atk' && card.rangeIdx!=null) { forcedMoveTarget=(card.rangeIdx+1)%4; }
        if (card.type==='unique') {
          if(activeMon.id==='Ham'){immediateStun=true; setImmediateTurnBuff('stunEnemy',true); addPopup('スタン!','enemy','text-yellow-400 text-lg font-bold');}
          else if(activeMon.id==='Suezo'){const gRec=Math.floor(effectiveMaxGuts*0.5); setGuts(p=>Math.min(effectiveMaxGuts,p+gRec)); addPopup(`⚡ ガッツ +${gRec}`,'guts','text-amber-400 text-xl font-black drop-shadow-md');}
          else if(activeMon.id==='Pixie'){setNextTurnBuff('zeroGuts',true); addPopup('次ターン消費0!','hero','text-blue-400 text-lg font-bold');}
          else if(activeMon.id==='Tiger'){setNextTurnBuff('guaranteedCrit',true); addPermaBuff('critRatePct',0.02); addPermaBuff('critDmgPct',0.02); addPopup('次ターン会心確定!','hero','text-red-400 text-lg font-bold'); addPopup('会心率+2% 会心ダメ+2%','hero','text-yellow-400 text-sm font-bold');}
          else if(activeMon.id==='Monol'){addPermaBuff('dmgCutPct',0.03); addWaveBuff('enemyAtkDebuffPct',0.10); setNextTurnBuff('reflect',true); addPopup('次ターン反射！','hero','text-purple-400 text-lg font-bold');}
          else if(activeMon.id==='Oboro'){const hRec=Math.floor(finalD*0.5); const gRec=Math.floor(finalD*0.05); setHp(p=>Math.min(effectiveMaxHp,p+hRec)); setGuts(p=>Math.min(effectiveMaxGuts,p+gRec)); addPopup(`💚 ドレイン +${hRec}`,'life','text-emerald-400 text-xl font-black drop-shadow-md'); addPopup(`⚡ ガッツ +${gRec}`,'guts','text-amber-400 text-base font-bold drop-shadow-md');}
          else if(activeMon.id==='Ark'||activeMon.id==='Iblis'){
            // 贖罪: 与ダメの20%で追撃(ザンの「連撃」とは別名にして、ザン専用の連撃モーション判定と衝突しないようにする)
            // noAnim:true → 専用モーションを2回連続再生させず、直前のヒットに続けてダメージ数値だけ表示する
            const comboAmt=Math.floor(finalD*0.2);
            if(comboAmt>0){totalDmg+=comboAmt; attackHits.push({dmg:comboAmt, isCrit:false, slotIdx, isSpecial:true, skillName:'追撃', isUnique:false, noAnim:true});}
            // 中二病: 固有技使用のたびに永続で消費ガッツ+10%・ダメージ倍率+0.1(重複可)
            addPermaBuff('chuuniUniqueStack',1);
            // 贖罪: 次ターン消費ガッツ15%増・被ダメージ50%減(1回)
            setNextTurnBuff('takenDamageMult',0.5); setNextTurnBuff('gutsCostMult',1.15);
            addPopup('次ターン被ダメ50%減!','hero','text-pink-400 text-lg font-bold');
          }
        }
      }
    }

    if (totalDmg>0||totalHeal>0) {
      if(totalHeal>0){addPopup(`💚 回復 +${totalHeal}`,'life','text-emerald-400 text-4xl font-black drop-shadow-lg'); await wait(600); setHp(p=>Math.min(effectiveMaxHp,p+totalHeal)); await wait(400);}
      if(totalDmg>0){
        const fallbackSlot = lastActionSlot !== null ? lastActionSlot : slots.findIndex(s => s !== null);
        const multiHit = attackHits.length > 1;
        // Process each attack hit one by one (ザンの連撃グループのみ特別扱い)
        let hitIdx=0;
        while (hitIdx < attackHits.length) {
          const hit = attackHits[hitIdx];
          // 専用モーションはモンスターの atkMotion フィールドで判定する(勇者モン選択時のみ発生する
          // 連撃ヒットの有無に依存させると、供モン加入時に通常攻撃のモーションが変わってしまうため)
          const isZanGroupStart = hit.skillName!=='連撃' && slots[hit.slotIdx]?.atkMotion==='zanCombo';
          if (isZanGroupStart) {
            // ザンの連撃グループ: 残像のような一瞬の突進を1回だけ見せ、モーションが終わってからダメージをバババッと立て続けに表示する
            const group=[hit]; let j=hitIdx+1;
            while (attackHits[j] && attackHits[j].skillName==='連撃') { group.push(attackHits[j]); j++; }
            const animSlot = (hit.slotIdx!=null && slots[hit.slotIdx]) ? hit.slotIdx : fallbackSlot;
            if(animSlot >= 0 && slots[animSlot]) {
              setSlotSkill({slotIndex: animSlot, name: hit.skillName, type: hit.isUnique?'unique':(hit.isSpecial?'special':'normal')});
              if (hit.isUnique) {
                // 固有技は他のモンスターと同じタメ(charge)を先に見せてから、連撃らしい残像ダッシュへ移る
                Audio_.se.special();
                setAttackAnim({slotIndex: animSlot, charge:true});
                await wait(650);
              }
              setAttackAnim({slotIndex: animSlot, zanCombo:true});
              Audio_.se.zanSlash(); // ザン専用の高めなシュシュ音
              await wait(320);
              setAttackAnim(null);
              setSlotSkill(null);
              await wait(100);
            }
            for (const h of group) {
              const hitColor=h.isCrit?'text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.9)] scale-110':'text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]';
              if(h.isCrit) triggerShake();
              addPopup(h.isCrit?`${h.dmg}!!`:`${h.dmg}`,'enemy',`${hitColor} text-5xl font-black animate-bounce`);
              setEnemy(prev=>({...prev,hp:Math.max(0,prev.hp-h.dmg)}));
              await wait(140);
            }
            hitIdx=j;
            continue;
          }
          const animSlot = (hit.slotIdx!=null && slots[hit.slotIdx]) ? hit.slotIdx : fallbackSlot;
          // noAnim: 直前のヒットの専用モーションに続く追撃分。モーションを2回連続再生させず、ダメージ数値だけ続けて表示する
          if(!hit.noAnim && animSlot >= 0 && slots[animSlot]) {
            // スロット上に技名をインライン表示
            setSlotSkill({slotIndex: animSlot, name: hit.skillName, type: hit.isUnique?'unique':(hit.isSpecial?'special':'normal')});
            const motion = slots[animSlot]?.atkMotion; // モンスターごとの専用モーション種別('default'/'zanCombo'/'floatStab'等)。全モンスターがdata側で必ず指定する
            if(hit.isUnique){
              // 固有技: タメ(下に沈む)は全モンスター共通→その後は専用モーションがあればそちらへ、なければ敵に向かって突進
              setAttackAnim({slotIndex: animSlot, charge:true});
              Audio_.se.special();
              await wait(650);
              setAttackAnim({slotIndex: animSlot, charge:false, motion});
              await wait(motion==='floatStab'?700:500);
            } else {
              setAttackAnim({slotIndex: animSlot, motion});
              if(hit.isSpecial) Audio_.se.special(); else if(hit.isCrit) Audio_.se.crit(); else Audio_.se.attack();
              await wait(motion==='floatStab'?650:450);
            }
            setAttackAnim(null);
            setSlotSkill(null);
          }
          const hitColor=hit.isCrit?'text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.9)] scale-110':'text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]';
          if(hit.isCrit) triggerShake();
          addPopup(hit.isCrit?`${hit.dmg}!!`:`${hit.dmg}`,'enemy',`${hitColor} text-5xl font-black animate-bounce`);
          setEnemy(prev=>({...prev,hp:Math.max(0,prev.hp-hit.dmg)})); await wait(hit.noAnim?150:550);
          hitIdx++;
        }
        setCurrentWaveDamage(p=>p+totalDmg);
        const turnDistDmg=[0,0,0,0];
        for(const h of attackHits){ const si=(h.slotIdx!=null)?h.slotIdx:fallbackSlot; if(si>=0&&si<4) turnDistDmg[si]+=h.dmg; }
        setWaveDistDamage(prev=>{const n=[...prev]; for(let k=0;k<4;k++) n[k]=(n[k]||0)+turnDistDmg[k]; return n;});
        // Show combined total for multi-hit
        if(multiHit){
          await wait(150);
          addPopup(`合計 ${totalDmg}`,'enemy',`text-white text-3xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]`);
          await wait(600);
        }
      }
    } else { await wait(100); }

    const drawCount=usedCards.filter(c=>c.type==='draw').length;
    let nextHand=hand.filter((_,i)=>!selectedCards.includes(i));
    let nextDeck=[...deck], nextGraveyard=[...graveyard,...usedCards];
    const replenish=(count)=>{for(let i=0;i<count;i++){if(nextDeck.length===0){if(nextGraveyard.length===0)break; nextDeck=[...nextGraveyard].sort(()=>Math.random()-0.5); nextGraveyard=[];} if(nextDeck.length>0)nextHand.push(nextDeck.pop());}};
    replenish(selectedCards.length+drawCount);
    while(nextHand.length<5&&(nextDeck.length>0||nextGraveyard.length>0))replenish(1);
    if(getTurnBuff('zeroGuts',false)) setImmediateTurnBuff('zeroGuts',false);
    setHand(nextHand); setDeck(nextDeck); setGraveyard(nextGraveyard); setSelectedCards([]); setLastActionSlot(null); setCardAssignments({}); setPendingCard(null); setFocusedCard(null);

    if (enemy&&(enemy.hp-totalDmg)<=0) {
      Audio_.se.victory();
      const totalWaveDamage=currentWaveDamage+totalDmg;
      const waveMult=1.0+(wave*0.1); const remainingTurns=Math.max(0,21-turnCount);
      const turnMult=Math.max(1.0,2.0-((20-remainingTurns)*0.05));
      const finalRoundScore=Math.floor(((totalWaveDamage*waveMult)+(totalWaveDamage*turnMult))*scoreMultiplier);
      setScore(s=>s+finalRoundScore);
      // Final per-distance damage for this wave (include the killing turn's damage, by ally slot distance)
      const finalDistDamage=[...waveDistDamage];
      { const fbSlot = lastActionSlot!==null?lastActionSlot:slots.findIndex(s=>s!==null); for(const h of attackHits){ const si=(h.slotIdx!=null)?h.slotIdx:fbSlot; if(si>=0&&si<4) finalDistDamage[si]+=h.dmg; } }
      // 1. Permanent per-distance damage bonus: +0.1% of damage dealt at each distance
      const gainedDistBonus=finalDistDamage.map(d=>d*0.001/100); // damage*0.1% as a multiplier fraction (10000 dmg => +0.10 = +10%)
      const newDistBonus=distDmgBonus.map((b,i)=>b+gainedDistBonus[i]);
      setDistDmgBonus(newDistBonus);
      // Cumulative totals across all waves
      const newTotalDistDamage=totalDistDamage.map((d,i)=>d+finalDistDamage[i]);
      const newTotalAllDamage=totalAllDamage+totalWaveDamage;
      setTotalDistDamage(newTotalDistDamage); setTotalAllDamage(newTotalAllDamage);
      // 2. Permanent recovery-rate correction based on speed (remaining turns). +0.5%/turn above 10, -0.5%/turn below 10, cap ±5%.
      const recoveryDelta=Math.max(-0.05,Math.min(0.05,(remainingTurns-10)*0.005));
      const newTotalRecoveryDelta=totalRecoveryDelta+recoveryDelta;
      setPermaBuffs(p=>({...p, autoHpRecovery:Math.max(0,(p.autoHpRecovery??0.1)+recoveryDelta)}));
      setTotalRecoveryDelta(newTotalRecoveryDelta);
      setWaveResult({wave,waveMult,turn:turnCount,remainingTurns,turnMult,totalDamage:totalWaveDamage,roundScore:finalRoundScore,totalScore:score+finalRoundScore,distDamage:finalDistDamage,gainedDistBonus,newDistBonus,recoveryDelta,totalDistDamage:newTotalDistDamage,totalAllDamage:newTotalAllDamage,totalRecoveryDelta:newTotalRecoveryDelta});
      setWaveHistory(prev => [...prev, { wave, roundScore: finalRoundScore, totalScore: score + finalRoundScore, xpGain: waveXpGain(wave, scoreMultiplier), goldGain: waveGoldGain(wave, goldMultiplier) }]);
      setTimeout(()=>setGameState('WAVE_RESULT'),500); return;
    }
    let endTurnDist=enemyDist;
    let forcedMoveHappened=false;
    if (forcedMoveTarget!=null && forcedMoveTarget!==enemyDist) {
      endTurnDist=forcedMoveTarget;
      setEnemyDist(forcedMoveTarget);
      addPopup(`強制移動！ ${RANGE_LABELS[forcedMoveTarget]}距離へ`,'enemy','text-cyan-400 font-black text-lg drop-shadow-md');
      await wait(700);
      forcedMoveHappened=true;
    }
    // 予測表示している enemyIntent をそのまま実行する（再抽選しない）
    const finalActionType=guardTypeInTurn!=='none'?guardTypeInTurn:lastType;
    // 距離撃で強制移動させた場合は、敵自身のMOVE行動で上書きされないよう優先する(距離撃 > 敵の自発的な移動)
    const executedIntent=(forcedMoveHappened&&enemyIntent?.type==='MOVE')?{type:'WAIT',value:0,label:"様子を見ている",icon:"⏳"}:enemyIntent;
    await handleEnemyTurn(finalActionType,{invincible:immediateInvincible,stun:immediateStun,guardPower:currentTurnGuardPower},executedIntent);
    // 敵の行動が終わった後で、次ターンの予測を1回だけ抽選してセット
    // 敵が移動した場合は移動後の距離を基準にする
    const distForNextPredict=(executedIntent&&executedIntent.type==='MOVE')?executedIntent.targetDist:endTurnDist;
    setEnemyIntent(getNextEnemyAction(enemy,distForNextPredict));
  };

  const handleNextWave = () => { setEffect(null); if(wave===10) setGameState('CHAMPION'); else setGameState('REWARD_PICK'); };

  const buildDeck = (currentSlots, aLvl, gLvl, cUniques, cTeachings, gBonus) => {
    const atkNames=HERO_ATK_NAMES[mainHero?.id]||HERO_ATK_NAMES['Mocchi'];
    let pool=[];
    pool.push({...BASE_ATK_EVOLUTION[aLvl],name:atkNames[aLvl],type:'atk',uid:Math.random()},{...BASE_ATK_EVOLUTION[aLvl],name:atkNames[aLvl],type:'atk',uid:Math.random()});
    for(let i=0;i<2+gBonus;i++) pool.push({...GUARD_EVOLUTION[gLvl],type:'guard',uid:Math.random()});
    currentSlots.forEach((s,idx)=>{
      if(s){
        const revo=RANGE_EVOLUTION[aLvl];
        pool.push({name:`${RANGE_LABELS[idx]}${revo.name}`,type:'range_atk',rangeIdx:idx,guts:revo.guts,baseGuts:revo.baseGuts,mult:revo.mult,baseMult:revo.baseMult,crit:revo.crit,icon:RANGE_LABELS[idx],uid:Math.random(),evoLevel:aLvl});
        const u=cUniques.find(uq=>uq.monId===s.id);
        if(u){const currentEvoName=u.names[Math.min(u.evoLevel,u.names.length-1)]; const uCrit=0.10+0.05*Math.min(u.evoLevel,8); pool.push({...u,name:currentEvoName,type:'unique',uid:Math.random(),guts:u.guts||u.baseGuts,baseGuts:u.baseGuts,baseMult:u.baseMult,evoLevel:u.evoLevel,monId:u.monId,crit:uCrit,effectDesc:u.effectDesc});}
      }
    });
    cTeachings.forEach(t=>{let name=BREEDER_EVO_NAMES[t.id][Math.min(t.evoLevel||0,2)]; pool.push({...t,name,guts:20,uid:Math.random()});});
    return pool.sort(()=>Math.random()-0.5);
  };

  const spawnEnemy = useCallback((w) => {
    const enemyKey=ENEMY_SEQUENCE[w-1]; const base=ENEMY_DATA[enemyKey];
    let mod=DIFFICULTY_SETTINGS[difficulty]?.power||1.0;
    const newEnemy={...base,id:enemyKey,hp:Math.floor(base.baseHp*mod),maxHp:Math.floor(base.baseHp*mod),atk:Math.floor(base.baseAtk*mod)};
    const dist=Math.floor(Math.random()*4);
    setEnemy(newEnemy); setEnemyDist(dist); setEnemyIntent(getNextEnemyAction(newEnemy,dist));
    setTurnCount(1); setSelectedCards([]); setLastActionSlot(null); setCardAssignments({}); setPendingCard(null); setCurrentWaveDamage(0); setWaveDistDamage([0,0,0,0]); setWaveBuffs({}); // WAVE毎リセットのバフ・デバフ(waveEnemyAtkDebuff/chuuniDmgCutUses/enemyTakenDmgBonus等)を全てクリア
  }, [getNextEnemyAction, difficulty]);

  const initBattle = (w, s, u, t, gB) => {
    setWave(w); spawnEnemy(w);
    const pool=buildDeck(s||slots,atkLevel,guardLevel,u||ownedUniques,t||ownedTeachings,gB!==undefined?gB:guardBonusCount);
    setHand(pool.slice(0,5)); setDeck(pool.slice(5)); setGraveyard([]); setGameState('BATTLE'); setIsBusy(false);
    setTurnBuffs({}); setNextTurnBuffs({}); // WAVE毎リセットの一時バフ・デバフを全てクリア
  };

  const setupMon = (m, slotIdx) => {
    if (!m) return;
    const isHero=!mainHero; const nextSlots=[...slots]; nextSlots[slotIdx]={...m}; setSlots(nextSlots);
    if (!isHero) Audio_.se.join();
    if (isHero) {
      const initialUnique={...m.unique,evoLevel:0};
      setOwnedUniques([initialUnique]); setMainHero(m); setMaxHp(m.baseHp); setHp(m.baseHp);
      setMaxGuts(m.baseGuts); setGuts(Math.floor(m.baseGuts*0.5)); setAtk(m.baseAtk); setDef(m.baseDef);
      setTeachingPool([...getActiveTeachingCards()]); setGameState('PICK_TEACHING');
    } else {
      const bonus=m.plusStats||{};
      const bHp=maxHp, bAtk=atk, bDef=def, bGuts=maxGuts;
      const nMaxHp=maxHp+(bonus.hp||0), nAtk=atk+(bonus.atk||0), nDef=def+(bonus.def||0), nMaxGuts=maxGuts+(bonus.guts||0);
      setMaxHp(nMaxHp); setAtk(nAtk); setDef(nDef); setMaxGuts(nMaxGuts); setHp(p=>p+(nMaxHp-bHp));
      const newAllyUnique={...m.unique,evoLevel:0}; setOwnedUniques([...ownedUniques,newAllyUnique]);
      setUpgradePoints(prev=>prev+(Math.floor(Math.random()*4)+1));
      setEffect({type:'mega',label:`${m.name}合流！`,icon:"🤝",monEmoji:m.emoji,imgUrl:m.imgUrl,subLabel:`HP:${bHp}→${nMaxHp}  ちから:${bAtk}→${nAtk}\n丈夫さ:${bDef}→${nDef}  ガッツ:${bGuts}→${nMaxGuts}`});
      setTimeout(()=>{setEffect(null); setGameState('UPGRADE_SKILL');},1400);
    }
    setCurrentPickingMon(null);
  };

  const confirmPickTeaching = () => {
    if (!selectedTeachingCard) return;
    const teaching=selectedTeachingCard; const alreadyOwned=ownedTeachings.find(t=>t.id===teaching.id);
    let nextTeachings=[...ownedTeachings]; let isUpgrade=false;
    if (alreadyOwned) {
      nextTeachings=nextTeachings.map(t=>{if(t.id===teaching.id){const nextEvo=Math.min(2,t.evoLevel+1); return {...t,evoLevel:nextEvo,baseValue:t.baseValue+t.step};} return t;}); isUpgrade=true;
    } else { nextTeachings.push({...teaching,uid:Math.random()}); }
    if (isUpgrade) addPopup("強化完了！",'hero','text-white bg-indigo-600 px-2 text-[10px]');
    if (!enemy) { // このWAVE1開始が今回の挑戦のスタート地点
      setAttemptCounts(prev => { const next = { ...prev, [difficulty]: (prev[difficulty]||0)+1 }; storeSet(`mh_attempts_${difficulty}`, next[difficulty], false); return next; });
    }
    setTimeout(()=>{setOwnedTeachings(nextTeachings); if(!enemy) initBattle(testMooMode?ENEMY_SEQUENCE.length:1,slots,ownedUniques,nextTeachings); else initBattle(wave+1,slots,ownedUniques,nextTeachings); setSelectedTeachingCard(null);},150);
  };

  const handleReward = (type) => {
    if (effect) return;
    let nAtkL=atkLevel, nGrdL=guardLevel, nMaxHp=maxHp, nAtk=atk, nDef=def, nMaxGuts=maxGuts, nGB=guardBonusCount;
    if(type==='atk'){nAtkL=Math.min(8,atkLevel+1); nAtk=Math.floor(atk*1.10);}
    else if(type==='def'){nGrdL=Math.min(8,guardLevel+1); nDef=Math.floor((def+20)*1.10); nGB+=1; nMaxHp=Math.floor(maxHp*1.20);}
    else if(type==='hp'){nMaxGuts=Math.floor((maxGuts+10)*1.1);}
    setAtkLevel(nAtkL); setGuardLevel(nGrdL); setMaxHp(nMaxHp); setAtk(nAtk); setDef(nDef); setMaxGuts(nMaxGuts); setGuardBonusCount(nGB);
    const guardName=GUARD_EVOLUTION[nGrdL].name;
    setEffect({type:'heal',label:type==='def'?`${guardName}取得！ 枚数UP`:"能力覚醒完了",icon:type==='def'?"🛡️":"⚡",monEmoji:"🆙",subLabel:type==='def'?`デッキの防御カードが [${guardName}] へ進化し、枚数が追加されます。`:''});
    setTimeout(()=>{
      setEffect(null);
      const joinWaves=[2,4,6];
      const activeIds=slots.filter(s=>s).map(s=>s.id);
      const avail=getActiveMonsterList().filter(m=>!activeIds.includes(m.id));
      if(joinWaves.includes(wave)&&slots.filter(s=>s).length<4&&avail.length>0){
        setMonSelection(avail.sort(()=>Math.random()-0.5).slice(0,4)); setGameState('PICK_ALLY');
      } else if([1,3,5,7,9].includes(wave)){
        const activeCards=getActiveTeachingCards();
        const upgradeableIds=ownedTeachings.filter(ot=>ot.evoLevel<2).map(ot=>ot.id);
        const upgradeableCards=activeCards.filter(tc=>upgradeableIds.includes(tc.id));
        const notOwnedCards=activeCards.filter(tc=>!ownedTeachings.some(ot=>ot.id===tc.id));
        let pool=[];
        if(upgradeableCards.length>0) pool.push(...upgradeableCards.sort(()=>Math.random()-0.5).slice(0,2));
        const needed=4-pool.length; if(needed>0&&notOwnedCards.length>0) pool.push(...notOwnedCards.sort(()=>Math.random()-0.5).slice(0,needed));
        while(pool.length<4&&activeCards.length>=4){const random=activeCards[Math.floor(Math.random()*activeCards.length)]; if(!pool.find(p=>p.id===random.id)) pool.push(random);}
        setTeachingPool(pool); setGameState('PICK_TEACHING');
      } else { initBattle(wave+1,slots,ownedUniques,ownedTeachings,nGB); }
    },900);
  };

  const upgradeUnique = (monId, diff) => {
    setOwnedUniques(prev=>prev.map(u=>{
      if(u.monId===monId){
        const nextEvo=Math.max(0,Math.min(8,u.evoLevel+diff));
        if(diff>0&&upgradePoints<=0) return u; if(diff<0&&u.evoLevel<=0) return u;
        if(diff>0) setUpgradePoints(p=>p-1); else setUpgradePoints(p=>p+1);
        return{...u,evoLevel:nextEvo};
      } return u;
    }));
  };

  const getDynamicDesc = (t, isOwned, level) => {
    const formatVal=(v)=>Math.round(v*100);
    if(t.id==='oryo') return `攻撃ステータス ${formatVal(0.1+level*0.1)}%アップ`;
    if(t.id==='dra') return `被ダメージ ${[3,6,10][level]}%ダウン`;
    if(t.id==='cadmium') return level===0?`G自動回復+2%・ガッツ上限5%UP`:(level===1?`自動ライフ回復2%・G自動回復+3%・ライフ/G上限5%UP`:`自動ライフ回復5%・G自動回復+5%・ライフ/G上限7%UP`);
    if(t.id==='mua') return level===0?"HP50%回復・HP/攻/ガッツ3%UP":(level===1?"HP&ガッツ70%回復・HP5%/攻3%/ガッツ3%UP":"HP&ガッツ90%回復・HP8%/攻5%/ガッツ5%UP");
    if(t.id==='atsu') return `敵行動無効＋攻撃 (${(t.baseValue+level*t.step).toFixed(1)}倍)`;
    if(t.id==='myaru'){const v=t.baseValue+level*t.step, d=formatVal(Math.max(0.1,t.selfDmg-level*t.dmgStep)); return `次ターン攻撃${v.toFixed(1)}倍・自傷${d}%`;}
    return t.desc;
  };
  const getFullEvolutionDetails = (t) => [0,1,2].map(lvl=>({lvl,name:BREEDER_EVO_NAMES[t.id][lvl],desc:getDynamicDesc(t,true,lvl)}));

  return (
    <div onPointerDown={(e)=>{const rect=e.currentTarget.getBoundingClientRect(); spawnRipple(e.clientX-rect.left, e.clientY-rect.top);}} className="h-full w-full bg-slate-950 text-white overflow-hidden relative select-none font-sans" style={{height:'100%'}}>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-black z-0"></div>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:2147483647,overflow:'hidden'}}>
        {ripples.map(r=>(
          <span key={r.id} style={{position:'absolute',left:r.x,top:r.y,width:'48px',height:'48px',marginLeft:'-24px',marginTop:'-24px',borderRadius:'9999px',border:'2px solid rgba(255,255,255,0.9)',boxShadow:'0 0 10px rgba(255,255,255,0.6)',transformOrigin:'center',animation:'mhRipple 550ms ease-out forwards'}}/>
        ))}
      </div>
      {updateAvailable&&(
        <div className="fixed left-0 right-0 flex justify-center px-4" style={{position:'fixed',top:'calc(10px + env(safe-area-inset-top))',left:0,right:0,zIndex:2147483647,pointerEvents:'none'}}>
          <button onClick={()=>window.location.reload()} className="bg-emerald-500 text-black font-black text-[11px] px-4 py-2.5 rounded-full shadow-2xl active:scale-95 flex items-center gap-1.5 animate-pulse" style={{pointerEvents:'auto'}}><RefreshCcw size={12}/>新しいバージョンがあります。タップして更新</button>
        </div>
      )}
      <div className="relative z-10 h-full flex flex-col" style={screenShake?{animation:bigShake?'mooQuake 750ms ease-in-out':'screenShake 450ms ease-in-out'}:undefined}>

        {/* TITLE */}
        {gameState==='TITLE'&&(
          <div className="flex-1 relative flex flex-col items-center justify-end p-4 pb-8 text-center overflow-hidden">
            {/* Full-body Moo backdrop, allowed to bleed off-screen */}
            <div className="absolute inset-0 flex items-start justify-center pointer-events-none overflow-hidden">
              <div style={{width:'620px',height:'620px',background:'radial-gradient(circle at 50% 30%, rgba(168,85,247,0.55) 0%, rgba(2,6,23,0) 56%)'}} className="absolute top-0 animate-pulse"></div>
              <div className="absolute top-0 left-0 right-0 overflow-hidden" style={{height:'62%'}}>
                {MOO_FULL && <img src={MOO_FULL} alt="Moo" className="absolute object-contain object-top drop-shadow-[0_0_50px_rgba(168,85,247,0.6)]" style={{width:'250%',maxWidth:'none',top:'2%',left:'50%',transform:'translateX(-50%)'}}/>}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-2/3" style={{background:'linear-gradient(to bottom, rgba(2,6,23,0) 0%, rgba(2,6,23,0.5) 32%, rgba(2,6,23,0.95) 58%, #020617 72%)'}}></div>
            </div>
            <div className="relative z-10 flex flex-col items-center justify-end w-full max-w-sm gap-2">
              <div className="shrink-0 w-full flex flex-col items-center mb-1">
                <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-500 leading-none uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,1)]">Monster Hero</h1>
                <p className="text-purple-300 text-[9px] tracking-[0.4em] uppercase font-bold mt-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Grand Champion Quest</p>
              </div>
              <div className="shrink-0 w-full flex flex-col items-center mb-2 relative">
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={16} className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"/>
                  <span className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-purple-200 to-indigo-200 drop-shadow-[0_2px_10px_rgba(129,140,248,0.8)]">LV.{breederLevel.level}</span>
                </div>
                <div className="w-full max-w-[240px]">
                  <div className="h-2.5 bg-slate-900/80 rounded-full overflow-hidden border border-indigo-400/40 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400" style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></div>
                  </div>
                  <div className="text-[8px] text-indigo-300 font-mono font-bold text-center mt-1 tracking-wider">{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
                  <Gem size={11} className="text-amber-400"/>
                  <span className="text-[11px] font-black text-amber-300 font-mono">{gold.toLocaleString()}</span>
                  <span className="text-[8px] text-amber-500/70 font-bold">ダイヤ</span>
                </div>
              </div>
              <div className="shrink-0 w-full flex flex-col items-center mb-2">
                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">Breeder Profile</div>
                <button onClick={()=>setGameState('PROFILE')} className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-4 py-2 rounded-xl active:scale-95 group backdrop-blur-sm">{resolveIconUrl(breederIcon)?(<div className="w-4 h-4 rounded-full overflow-hidden shrink-0"><img src={resolveIconUrl(breederIcon)} alt="" className="w-full h-full object-cover"/></div>):(<User size={14} className="text-indigo-400"/>)}<span className="font-black text-sm text-white group-hover:text-indigo-300 transition-colors">{breederName}</span><ChevronRight size={12} className="text-slate-500 group-hover:text-white"/></button>
              </div>
              <div className="shrink-0 flex flex-col gap-2 w-full">
                <div className="grid grid-cols-3 gap-2 justify-center">
                  {Object.entries(DIFFICULTY_SETTINGS).map(([key,setting])=>(
                    <button key={key} onClick={()=>setDifficulty(key)} className={`relative h-10 rounded-lg text-[8px] font-black uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${difficulty===key?`${setting.color} text-white ${setting.shadow} shadow-lg scale-105 z-10 ring-1 ring-white/50`:'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}><span>{setting.label}</span></button>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-amber-500 font-bold bg-white/5 py-1.5 rounded-lg border border-white/10">HIGH SCORE ({difficulty}): {(highScores[difficulty]||0).toLocaleString()}</div>
              </div>
              <div className="shrink-0 flex flex-col gap-2 w-full mt-2">
                <button onClick={()=>{setTestMooMode(false); setMonSelection(getActiveMonsterList()); setGameState('PICK_HERO');}} className="w-full bg-white text-black py-3 rounded-xl font-black text-lg active:scale-95 transition-transform uppercase shadow-[0_0_20px_rgba(255,255,255,0.2)]">召喚開始</button>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={()=>setGameState('PROFILE')} className="w-full bg-slate-900 border border-violet-500/50 text-violet-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-2"><User size={14}/> Profile</button>
                  <button onClick={()=>{setRankingViewDiff(difficulty); setShowRanking(true); loadRankings();}} className="w-full bg-slate-900 border border-indigo-500/50 text-indigo-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-2"><Users size={14}/> Ranking</button>
                  <button onClick={()=>setShowHelp(true)} className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-2"><HelpCircle size={14}/> Help</button>
                </div>
                <button onClick={()=>setAudioLevel(l=>(l+1)%4)} className={`w-full border py-2 rounded-xl font-black text-[11px] active:scale-95 uppercase flex items-center justify-center gap-2 ${audioOn?'bg-indigo-950 border-indigo-500/60 text-indigo-300':'bg-slate-900 border-slate-600/50 text-slate-400'}`}>{AUDIO_LABELS[audioLevel]} {audioLevel===0?'（タップで再生）':'BGM/SE'}</button>
              </div>
            </div>
            {showRanking&&(
              <div className="fixed inset-0 z-[8000] flex flex-col p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.97)',zIndex:80000,paddingTop:'calc(1.5rem + env(safe-area-inset-top))'}}>
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4"><h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Trophy size={20}/> Ranking</h2><div className="flex items-center gap-2"><button onClick={()=>loadRankings()} className="p-2 bg-white/10 rounded-full active:scale-90"><RefreshCcw size={18}/></button><button onClick={()=>setShowRanking(false)} className="p-2 bg-white/10 rounded-full"><X size={20}/></button></div></div>
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide px-1 shrink-0">{Object.keys(DIFFICULTY_SETTINGS).map(d=>(<button key={d} onClick={()=>setRankingViewDiff(d)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase shrink-0 ${rankingViewDiff===d?'bg-indigo-600 text-white shadow-lg':'bg-slate-800 text-slate-500'}`}>{d}</button>))}</div>
                <div className="flex-1 overflow-y-auto mh-scroll space-y-3 min-h-0">
                  {(localRankings[rankingViewDiff]||[]).length===0?(<div className="h-full flex items-center justify-center text-slate-600 font-black uppercase text-xs italic">No records yet</div>):(
                    (localRankings[rankingViewDiff]||[]).map((r,i)=>(
                      <div key={i} className={`flex flex-col p-3 rounded-2xl border ${i===0?'bg-amber-500/10 border-amber-500/50':'bg-slate-900 border-white/5'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${i===0?'bg-amber-500 text-black':i===1?'bg-slate-300 text-black':i===2?'bg-orange-600 text-white':'bg-slate-800 text-slate-400'}`}>{i+1}</div>
                          {resolveIconUrl(r.icon)&&(<div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0"><img src={resolveIconUrl(r.icon)} alt="" className="w-full h-full object-cover"/></div>)}
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">{r.level!=null&&<span className="shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-600/90 border border-indigo-400/50 text-[7px] font-black text-white">Lv.{r.level}</span>}<div className="text-[11px] font-black text-white truncate uppercase tracking-tighter">{r.userName}</div></div>
                          <div className="text-right font-mono font-black text-indigo-400 text-sm whitespace-nowrap">{r.score.toLocaleString()} pt</div>
                        </div>
                        <div className="mt-2 bg-black/40 rounded-xl p-2 border border-white/5 flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30"><Crown size={8} className="text-amber-400"/>{r.party&&r.party.find(p=>p?.name===r.hero)?.imgUrl?(<img src={r.party.find(p=>p?.name===r.hero).imgUrl} alt="hero" className="w-5 h-5 object-contain"/>):(<span className="text-[10px]">{r.party?(r.party.find(p=>p?.name===r.hero)?.emoji||'👑'):'👑'}</span>)}<span className="text-[10px] font-black text-white ml-1">{r.hero}</span></div>
                          {r.party&&r.party.filter(p=>p&&p.name!==r.hero).map((p,idx)=>(<div key={idx} className="flex items-center gap-0.5">{p.imgUrl?<img src={p.imgUrl} alt="sub" className="w-5 h-5 object-contain"/>:<span className="text-[9px]">{p.emoji}</span>}<span className="text-[8px] font-bold text-slate-300">{p.name.substring(0,4)}</span></div>))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="text-center text-[9px] text-slate-600 pt-2 shrink-0 italic">{rankingSourceByDiff[rankingViewDiff]==='local'?'※ サーバーに接続できず、この端末に保存されたトップ20記録を表示中':'※ 全国のブリーダーから集計したトップ20記録'}</div>
              </div>
            )}
            <div className="text-[7px] text-slate-600 font-mono tracking-widest uppercase shrink-0 pt-2">スコアはブラウザ内に保存されます</div>
            <div className="absolute bottom-1.5 left-2 text-[7px] text-slate-700 font-mono tracking-wide pointer-events-none select-none">Updated {BUILD_DATE}</div>
          </div>
        )}

        {/* PROFILE */}
        {gameState==='PROFILE'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <button onClick={()=>{ if(!onboarded){ setOnboarded(true); storeSet('mh_onboarded', true, false); } setGameState('TITLE'); }} className="p-2 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">プロフィール</h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
            {!onboarded&&(
              <div className="mb-4 bg-indigo-950/60 border border-indigo-500/40 rounded-2xl p-4 text-center shrink-0">
                <div className="text-sm font-black text-white mb-1">ようこそ、ブリーダーさん！</div>
                <div className="text-[11px] text-indigo-300">まずは名前を設定しましょう</div>
              </div>
            )}
            <div className="shrink-0 bg-slate-900/80 border border-white/10 rounded-3xl p-5 flex flex-col items-center gap-3 mb-4">
              <button onClick={()=>setShowIconPicker(true)} className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-indigo-400/50 flex items-center justify-center overflow-hidden active:scale-95">
                {resolveIconUrl(breederIcon)?(<img src={resolveIconUrl(breederIcon)} alt="icon" className="w-full h-full object-cover"/>):(<User size={36} className="text-indigo-400"/>)}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 flex items-center justify-center"><Edit3 size={9} className="text-white"/></div>
              </button>
              <button onClick={()=>{setTempName(breederName); setShowNameEdit(true);}} className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl active:scale-95 group">
                <span className="font-black text-base text-white">{breederName}</span><Edit3 size={13} className="text-slate-500 group-hover:text-white"/>
              </button>
              <div className="flex items-center gap-2"><Crown size={16} className="text-amber-300"/><span className="text-lg font-black text-indigo-200">LV.{breederLevel.level}</span></div>
              <div className="w-full max-w-[240px]">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></div></div>
                <div className="text-[8px] text-slate-500 font-mono text-center mt-1">{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</div>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
                <Gem size={11} className="text-amber-400"/>
                <span className="text-[11px] font-black text-amber-300 font-mono">{gold.toLocaleString()}</span>
                <span className="text-[8px] text-amber-500/70 font-bold">ダイヤ</span>
              </div>
              <button onClick={()=>setGameState('BREEDER_MARKET')} className="w-full flex items-center justify-between gap-2 bg-amber-950/40 border border-amber-500/40 px-4 py-2.5 rounded-xl active:scale-95 group">
                <span className="flex items-center gap-1.5"><Coins size={14} className="text-amber-400"/><span className="text-[11px] font-black text-amber-200">{breederPoints} pt</span></span>
                <span className="flex items-center gap-1 text-[10px] font-black text-amber-400 group-hover:text-amber-200"><ShoppingBag size={12}/>マーケット<ChevronRight size={11}/></span>
              </button>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button onClick={()=>{setDraftMonsterRoster(monsterRosterIds); setDraftTeachingRoster(teachingRosterIds); setRosterTab('monster'); setGameState('ROSTER');}} className="flex flex-col items-center justify-center gap-1 bg-indigo-950/40 border border-indigo-500/40 px-2 py-2.5 rounded-xl active:scale-95">
                  <span className="flex items-center gap-1 text-[9px] font-black text-indigo-400 uppercase"><Layers size={11}/>モンスター編成</span>
                  <span className="text-[12px] font-black text-indigo-200">{unlockedMonsterIds.length}体</span>
                </button>
                <button onClick={()=>{setDraftMonsterRoster(monsterRosterIds); setDraftTeachingRoster(teachingRosterIds); setRosterTab('teaching'); setGameState('ROSTER');}} className="flex flex-col items-center justify-center gap-1 bg-purple-950/40 border border-purple-500/40 px-2 py-2.5 rounded-xl active:scale-95">
                  <span className="flex items-center gap-1 text-[9px] font-black text-purple-400 uppercase"><Layers size={11}/>ブリーダーカード編成</span>
                  <span className="text-[12px] font-black text-purple-200">{unlockedTeachingIds.length}枚</span>
                </button>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2 px-1 shrink-0">難易度別 記録</div>
            <div className="flex flex-col gap-2 mb-4">
              {Object.entries(DIFFICULTY_SETTINGS).map(([key,setting])=>(
                <div key={key} className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                  <div className={`px-1 py-1 rounded-lg text-[9px] font-black uppercase shrink-0 w-20 text-center ${setting.color} ${key==='Master'?'':'text-white'}`}>{setting.label}</div>
                  <div className="flex-1 grid grid-cols-3 gap-1">
                    <div className="text-center"><div className="text-[7px] text-slate-500 uppercase tracking-wide">挑戦</div><div className="text-xs font-black text-white">{attemptCounts[key]||0}</div></div>
                    <div className="text-center"><div className="text-[7px] text-slate-500 uppercase tracking-wide">クリア</div><div className="text-xs font-black text-emerald-400">{clearCounts[key]||0}</div></div>
                    <div className="text-right"><div className="text-[7px] text-slate-500 uppercase tracking-wide">ハイスコア</div><div className="text-xs font-black text-amber-400">{(highScores[key]||0).toLocaleString()}</div></div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={()=>{setShowBackup(true); setBackupTab('export'); setBackupCode(''); setBackupCopied(false); setRestoreInput(''); setRestoreMsg('');}} className="shrink-0 w-full flex items-center justify-center gap-2 bg-slate-900/60 border border-white/10 text-slate-300 py-3 rounded-2xl font-black text-xs uppercase active:scale-95 mb-2"><ShieldCheck size={14} className="text-emerald-400"/>データのバックアップ・復元</button>
            </div>
          </div>
        )}

        {/* BREEDER MARKET */}
        {gameState==='BREEDER_MARKET'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('PROFILE')} className="p-2 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-amber-400 uppercase tracking-widest">マーケット</h2>
            </div>
            <div className="flex gap-2 mb-4 shrink-0">
              <div className="flex-1 flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/30 rounded-2xl py-3">
                <Coins size={16} className="text-amber-400"/>
                <span className="text-lg font-black text-amber-300">{breederPoints}</span>
                <span className="text-[9px] text-slate-400 font-bold">pt(Lv.UPで+1)</span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/30 rounded-2xl py-3">
                <Gem size={16} className="text-amber-400"/>
                <span className="text-lg font-black text-amber-300">{gold.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400 font-bold">ダイヤ(WAVEクリアで獲得)</span>
              </div>
            </div>
            <div className="flex gap-1.5 mb-3 shrink-0">
              {[{key:'icon',label:'アイコン'},{key:'disc',label:'円盤石'},{key:'breeder',label:'ブリーダー'}].map(tab=>(
                <button key={tab.key} onClick={()=>setMarketTab(tab.key)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${marketTab===tab.key?'bg-amber-500 text-black':'bg-slate-900 border border-slate-800 text-slate-400'}`}>{tab.label}</button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
            {BREEDER_MARKET_ITEMS.filter(item=>item.type===marketTab).length===0?(
              <div className="text-center text-[11px] text-slate-600 font-bold py-10">まだ商品がありません</div>
            ):(
              <div className="grid grid-cols-2 gap-3 pb-4">
                {BREEDER_MARKET_ITEMS.filter(item=>item.type===marketTab).map(item=>{
                  const comingSoon = item.available === false;
                  const owned = !comingSoon && isMarketItemOwned(item);
                  const usesGold = item.type==='disc' || item.type==='breeder';
                  const balance = usesGold ? gold : breederPoints;
                  const canBuy = !comingSoon && !owned && balance>=item.cost;
                  const detailMon = item.type==='disc' ? ALL_PLAYER_MONSTERS[item.id] : null;
                  const detailTeaching = item.type==='breeder' ? TEACHING_CARDS.find(t=>t.id===item.id) : null;
                  return (
                    <div key={item.id} className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-2 ${owned?'bg-emerald-900/30 border-emerald-500/50':comingSoon?'bg-slate-900/60 border-slate-800/60':'bg-slate-900 border-slate-800'}`}>
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shrink-0 ${comingSoon?'grayscale opacity-50':''}`}><img src={item.icon} alt={item.name} className="w-full h-full object-cover"/></div>
                      <div className={`text-xs font-black ${comingSoon?'text-slate-500':'text-white'}`}>{item.name}</div>
                      {(detailMon||detailTeaching)&&!comingSoon&&(
                        <button onClick={()=>{if(detailMon) setRosterDetailMon(detailMon); else setRosterDetailTeaching(detailTeaching);}} className="text-[9px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-3 py-1 rounded-full active:scale-95 flex items-center gap-1"><BookOpen size={9}/>詳細を見る</button>
                      )}
                      {comingSoon?(
                        <div className="text-[9px] font-black text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-full">近日追加予定</div>
                      ):owned?(
                        <div className="text-[9px] font-black text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-full">所持済み</div>
                      ):(
                        <button onClick={()=>buyMarketItem(item)} disabled={!canBuy} className={`text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1 ${canBuy?'bg-amber-500 text-black active:scale-95':'bg-slate-800 text-slate-500'}`}>{usesGold?<Gem size={10}/>:<Coins size={10}/>}{item.cost}{usesGold?'ダイヤ':'pt'} で購入</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        )}

        {/* ROSTER (編成) */}
        {gameState==='ROSTER'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('PROFILE')} className="p-2 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">編成</h2>
            </div>
            <div className="flex gap-1.5 mb-3 shrink-0">
              {[{key:'monster',label:'モンスター編成'},{key:'teaching',label:'ブリーダーカード編成'}].map(tab=>(
                <button key={tab.key} onClick={()=>setRosterTab(tab.key)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${rosterTab===tab.key?'bg-indigo-500 text-white':'bg-slate-900 border border-slate-800 text-slate-400'}`}>{tab.label}</button>
              ))}
            </div>
            {rosterTab==='monster'?(
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">仮選択中: {draftMonsterRoster.length}/{STARTER_MONSTER_IDS.length}体 / 解放済み{unlockedMonsterIds.length}体<br/>※ちょうど{STARTER_MONSTER_IDS.length}体選ぶと「決定」できます・右上のiボタンで詳細表示</div>
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="grid grid-cols-3 gap-3 pb-4">
                    {unlockedMonsterIds.map(id=>ALL_PLAYER_MONSTERS[id]).filter(Boolean).map(m=>{
                      const selected = draftMonsterRoster.includes(m.id);
                      return (
                        <div key={m.id} className="relative">
                          <button onClick={()=>toggleDraftMonster(m.id)} className={`w-full rounded-2xl border-2 p-2 flex flex-col items-center gap-1.5 active:scale-95 select-none ${selected?'bg-indigo-900/40 border-indigo-400 ring-2 ring-indigo-400':'bg-slate-900 border-slate-800'}`}>
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0"><img src={m.iconUrl} alt={m.name} draggable={false} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="w-full h-full object-cover"/></div>
                            <div className="text-[10px] font-black text-white truncate w-full text-center">{m.name}</div>
                            <div className="w-full">
                              <div className="text-[8px] text-pink-300 font-black flex items-center gap-0.5 mb-0.5"><Heart size={7}/>絆Lv.{getBondLevel(m.id).level}</div>
                              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${Math.max(0,Math.min(100,(getBondLevel(m.id).xpIntoLevel/Math.max(1,getBondLevel(m.id).xpForNext))*100))}%`}}></div></div>
                            </div>
                            <div className={`text-[8px] font-black px-2 py-0.5 rounded-full ${selected?'bg-indigo-500 text-white':'bg-slate-800 text-slate-500'}`}>{selected?'選択中':'未選択'}</div>
                          </button>
                          <button onClick={(e)=>{e.stopPropagation(); setRosterDetailMon(m);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button onClick={confirmMonsterRoster} disabled={draftMonsterRoster.length!==STARTER_MONSTER_IDS.length} className={`w-full py-3 rounded-2xl font-black text-sm mt-2 shrink-0 ${draftMonsterRoster.length===STARTER_MONSTER_IDS.length?'bg-indigo-500 text-white active:scale-95':'bg-slate-800 text-slate-500'}`}>決定 ({draftMonsterRoster.length}/{STARTER_MONSTER_IDS.length})</button>
              </div>
            ):(
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">仮選択中: {draftTeachingRoster.length}/{STARTER_TEACHING_IDS.length}枚 / 解放済み{unlockedTeachingIds.length}枚<br/>※ちょうど{STARTER_TEACHING_IDS.length}枚選ぶと「決定」できます・右上のiボタンで詳細表示</div>
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="grid grid-cols-3 gap-3 pb-4">
                    {unlockedTeachingIds.map(id=>TEACHING_CARDS.find(t=>t.id===id)).filter(Boolean).map(t=>{
                      const selected = draftTeachingRoster.includes(t.id);
                      return (
                        <div key={t.id} className="relative">
                          <button onClick={()=>toggleDraftTeaching(t.id)} className={`w-full rounded-2xl border-2 p-2 flex flex-col items-center gap-1.5 active:scale-95 select-none ${selected?'bg-purple-900/40 border-purple-400 ring-2 ring-purple-400':'bg-slate-900 border-slate-800'}`}>
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0 flex items-center justify-center bg-black/30">{cardIconNode(t.icon,48)}</div>
                            <div className="text-[10px] font-black text-white truncate w-full text-center">{t.baseName}</div>
                            <div className={`text-[8px] font-black px-2 py-0.5 rounded-full ${selected?'bg-purple-500 text-white':'bg-slate-800 text-slate-500'}`}>{selected?'選択中':'未選択'}</div>
                          </button>
                          <button onClick={(e)=>{e.stopPropagation(); setRosterDetailTeaching(t);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button onClick={confirmTeachingRoster} disabled={draftTeachingRoster.length!==STARTER_TEACHING_IDS.length} className={`w-full py-3 rounded-2xl font-black text-sm mt-2 shrink-0 ${draftTeachingRoster.length===STARTER_TEACHING_IDS.length?'bg-purple-500 text-white active:scale-95':'bg-slate-800 text-slate-500'}`}>決定 ({draftTeachingRoster.length}/{STARTER_TEACHING_IDS.length})</button>
              </div>
            )}
          </div>
        )}

        {rosterDetailMon&&(
          <div className="fixed inset-0 z-[31000] flex items-center justify-center p-4" style={{backgroundColor:'rgba(0,0,0,0.92)'}}>
            <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
              <div className="flex items-center gap-4 border-b border-white/10 pb-4 shrink-0">
                {rosterDetailMon.imgUrl?(<img src={rosterDetailMon.imgUrl} alt={rosterDetailMon.name} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110"/>):(<div className="text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{rosterDetailMon.emoji}</div>)}
                <div className="flex-1"><h3 className="text-xl font-black text-white">{rosterDetailMon.name}</h3><div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Monster Profile</div>{bondGaugeNode(rosterDetailMon.id)}</div>
                <button onClick={()=>setRosterDetailMon(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5"><div className="text-[7px] text-slate-500 uppercase font-bold">基本ステータス</div><div className="space-y-1 mt-1"><div className="flex justify-between text-[10px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{rosterDetailMon.baseHp}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{rosterDetailMon.baseAtk}</span></div><div className="flex justify-between text-[10px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{rosterDetailMon.baseDef}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{rosterDetailMon.baseGuts}</span></div></div></div>
                  <div className="bg-black/40 p-2 rounded-xl border border-indigo-500/30"><div className="text-[7px] text-indigo-400 uppercase font-bold">勇者特性</div><div className="text-[9px] text-white font-bold leading-tight mt-1">{rosterDetailMon.traitDesc}</div></div>
                </div>
                <div className="bg-black/40 p-2 rounded-xl border border-pink-500/30"><div className="text-[7px] text-pink-400 uppercase font-bold">合流ボーナス</div><div className="text-[8px] text-white font-bold mt-1">{rosterDetailMon.plusStats.hp>0&&`HP+${rosterDetailMon.plusStats.hp} `}{rosterDetailMon.plusStats.atk>0&&`攻+${rosterDetailMon.plusStats.atk} `}{rosterDetailMon.plusStats.def>0&&`防+${rosterDetailMon.plusStats.def} `}{rosterDetailMon.plusStats.guts>0&&`G+${rosterDetailMon.plusStats.guts} `}</div></div>
                <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/30"><div className="flex items-center justify-between mb-0.5"><div className="text-[7px] text-cyan-400 uppercase font-bold">間合い適性</div><div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {distAptPoints[rosterDetailMon.id]||0}</div></div><div className="grid grid-cols-4 gap-1 mt-1">{RANGE_LABELS.map((label,idx)=>{const grade=getDistAptitude(rosterDetailMon,idx); const canUp=(distAptPoints[rosterDetailMon.id]||0)>0 && DIST_APTITUDE_GRADES.indexOf(grade)<DIST_APTITUDE_GRADES.length-1; return(<div key={idx} className="flex flex-col items-center gap-0.5"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span><span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span>{canUp&&<button onClick={()=>spendAptPoint(rosterDetailMon.id,idx)} className="w-full text-[8px] font-black bg-amber-600 text-white rounded py-0.5 active:scale-95">+1</button>}</div>);})}</div></div>
                <div className="bg-slate-800/50 p-3 rounded-2xl border border-white/10 shrink-0"><div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-1"><Zap size={12} className="text-amber-400"/><span className="text-[10px] font-black uppercase">固有技: {rosterDetailMon.unique.name}</span></div><div className="text-[9px] text-slate-300 leading-relaxed italic mb-2">"{rosterDetailMon.unique.effectDesc}"</div></div>
              </div>
              <button onClick={()=>setRosterDetailMon(null)} className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg mt-2 shrink-0 active:scale-95">閉じる</button>
            </div>
          </div>
        )}
        {rosterDetailTeaching&&(()=>{const owned=ownedTeachings.find(ot=>ot.id===rosterDetailTeaching.id); const currentLvl=owned?owned.evoLevel:-1; return(
          <div className="fixed inset-0 z-[31000] flex items-center justify-center p-6" style={{backgroundColor:'rgba(0,0,0,0.92)'}}>
            <div className="bg-slate-900 border-2 border-purple-500 rounded-3xl p-6 w-full max-w-xs flex flex-col items-center gap-4 shadow-2xl h-auto max-h-full">
              <div className="text-6xl mb-2 shrink-0">{cardIconNode(rosterDetailTeaching.icon,76)}</div>
              <h3 className="text-lg font-black text-white mb-4 shrink-0">{BREEDER_EVO_NAMES[rosterDetailTeaching.id][Math.max(currentLvl,0)]}</h3>
              <div className="w-full space-y-2 mb-4 overflow-y-auto min-h-0 flex-1">
                {getFullEvolutionDetails(rosterDetailTeaching).map(info=>{const isCurrent=info.lvl===currentLvl; const isNext=info.lvl===currentLvl+1;
                  return(<div key={info.lvl} className={`p-2 rounded-xl border ${isCurrent?'bg-purple-900/50 border-purple-400':isNext?'bg-amber-900/30 border-amber-500/50':'bg-black/30 border-white/5'}`}><div className="flex justify-between items-center mb-1"><span className={`text-[9px] font-black ${isCurrent?'text-purple-300':isNext?'text-amber-300':'text-slate-500'}`}>Lv.{info.lvl} {info.name}</span>{isCurrent&&<span className="text-[7px] bg-purple-500 text-white px-1.5 rounded">所持</span>}{!owned&&info.lvl===0&&<span className="text-[7px] bg-slate-600 text-white px-1.5 rounded">未習得</span>}</div><div className="text-[8px] text-slate-300">{info.desc}</div></div>);
                })}
              </div>
              <button onClick={()=>setRosterDetailTeaching(null)} className="w-full bg-purple-600 text-white py-3 rounded-xl font-black shadow-lg text-xs shrink-0">閉じる</button>
            </div>
          </div>
        );})()}

        {showNameEdit&&(
          <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:90000}}>
            <div className="bg-slate-900 border border-indigo-500 rounded-3xl p-6 w-full max-w-xs shadow-2xl">
              <h3 className="text-lg font-black text-white mb-1">ブリーダー名変更</h3>
              <input type="text" value={tempName} onChange={e=>setTempName(e.target.value)} maxLength={10} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white font-bold text-center mb-4"/>
              <div className="flex gap-2"><button onClick={()=>setShowNameEdit(false)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-bold text-xs">戻る</button><button onClick={handleSaveName} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black text-xs">保存</button></div>
            </div>
          </div>
        )}

        {showIconPicker&&(
          <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:90000}}>
            <div className="bg-slate-900 border border-indigo-500 rounded-3xl p-6 w-full max-w-xs shadow-2xl">
              <h3 className="text-lg font-black text-white mb-4 text-center">アイコンを選択</h3>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {STARTER_MONSTER_IDS.map(id=>ALL_PLAYER_MONSTERS[id]).map(m=>(
                  <button key={m.id} onClick={()=>{setBreederIcon(m.id); storeSet('mh_breeder_icon', m.id, false); setShowIconPicker(false);}} className={`aspect-square rounded-2xl overflow-hidden border-2 active:scale-90 ${breederIcon===m.id?'border-indigo-400 ring-2 ring-indigo-400':'border-slate-700'}`}>
                    <img src={m.faceIconUrl||m.iconUrl} alt={m.name} className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
              {ownedMarketIcons.length>0&&(<>
                <h4 className="text-[10px] font-black text-amber-400 mb-2 text-center uppercase tracking-widest flex items-center justify-center gap-1"><ShoppingBag size={10}/>マーケット購入アイコン</h4>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {BREEDER_MARKET_ITEMS.filter(m=>m.type==='icon'&&ownedMarketIcons.includes(m.id)).map(m=>(
                    <button key={m.id} onClick={()=>{setBreederIcon(m.id); storeSet('mh_breeder_icon', m.id, false); setShowIconPicker(false);}} className={`aspect-square rounded-2xl overflow-hidden border-2 active:scale-90 ${breederIcon===m.id?'border-amber-400 ring-2 ring-amber-400':'border-slate-700'}`}>
                      <img src={m.icon} alt={m.name} className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              </>)}
              <button onClick={()=>setShowIconPicker(false)} className="w-full bg-slate-800 text-slate-400 py-3 rounded-xl font-bold text-xs">閉じる</button>
            </div>
          </div>
        )}

        {showBackup&&(
          <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:90000}}>
            <div className="bg-slate-900 border border-indigo-500 rounded-3xl p-5 w-full max-w-sm shadow-2xl max-h-full overflow-y-auto mh-scroll">
              <h3 className="text-lg font-black text-white mb-1 text-center flex items-center justify-center gap-2"><ShieldCheck size={18} className="text-emerald-400"/>データのバックアップ</h3>
              <p className="text-[9px] text-slate-500 text-center mb-4 leading-tight">ホーム画面のアイコンを作り直すとデータが引き継がれないことがあります。バックアップコードを控えておけば、新しいアイコンから復元できます。</p>
              <div className="flex gap-1.5 mb-4">
                <button onClick={()=>setBackupTab('export')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${backupTab==='export'?'bg-indigo-500 text-white':'bg-slate-800 text-slate-500'}`}>バックアップ作成</button>
                <button onClick={()=>setBackupTab('import')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${backupTab==='import'?'bg-indigo-500 text-white':'bg-slate-800 text-slate-500'}`}>復元する</button>
              </div>
              {backupTab==='export'?(
                <div className="space-y-3">
                  {backupCode?(
                    <>
                      <textarea readOnly value={backupCode} onFocus={(e)=>e.target.select()} className="w-full h-24 bg-black/50 border border-slate-700 rounded-xl p-2 text-white text-[9px] font-mono resize-none"/>
                      <button onClick={copyBackupCode} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs active:scale-95">{backupCopied?'コピーしました！':'コードをコピー'}</button>
                    </>
                  ):(
                    <button onClick={generateBackupCode} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs active:scale-95">バックアップコードを作成</button>
                  )}
                </div>
              ):(
                <div className="space-y-3">
                  <textarea value={restoreInput} onChange={(e)=>setRestoreInput(e.target.value)} placeholder="バックアップコードを貼り付け" className="w-full h-24 bg-black/50 border border-slate-700 rounded-xl p-2 text-white text-[9px] font-mono resize-none"/>
                  {restoreMsg&&<div className="text-[10px] text-center font-bold text-amber-300">{restoreMsg}</div>}
                  <button onClick={restoreFromBackupCode} disabled={!restoreInput.trim()} className={`w-full py-3 rounded-xl font-black text-xs ${restoreInput.trim()?'bg-emerald-600 text-white active:scale-95':'bg-slate-800 text-slate-500'}`}>このコードで復元する</button>
                </div>
              )}
              <button onClick={()=>setShowBackup(false)} className="w-full bg-slate-800 text-slate-400 py-3 rounded-xl font-bold text-xs mt-3">閉じる</button>
            </div>
          </div>
        )}

        {/* BATTLE */}
        {gameState==='BATTLE'&&(
          <div className="flex-1 flex flex-col h-full">
            <header className="h-[5%] shrink-0 bg-slate-900 px-4 flex items-center justify-between border-b border-white/5 z-[6500]">
              <div className="flex items-center gap-4"><span className={`text-[8px] font-black bg-opacity-10 px-2 py-0.5 rounded border tracking-wider ${difficulty==='Hard'?'text-red-400 bg-red-500 border-red-500':'text-indigo-400 bg-indigo-500 border-indigo-500'}`}>WAVE {wave}/10</span><span className="text-[8px] font-black text-blue-400 flex items-center gap-1 uppercase tracking-widest"><Timer size={8}/> TURN {turnCount}/20</span></div>
              <div className="flex items-center gap-2"><div className="text-[10px] font-mono font-black text-amber-500 flex items-center gap-1 uppercase tracking-tighter mr-1"><Award size={10}/> {score.toLocaleString()}</div><button onClick={()=>setAudioLevel(l=>(l+1)%4)} className="p-1.5 bg-slate-800 rounded text-slate-300 active:scale-90 text-[12px] leading-none w-[26px] h-[26px] flex items-center justify-center">{['🔇','🔈','🔉','🔊'][audioLevel]}</button><button onClick={()=>setShowHelp(true)} className="p-1.5 bg-slate-800 rounded text-emerald-400 active:scale-90"><HelpCircle size={14}/></button><button onClick={()=>setShowQuitConfirm(true)} className="p-1.5 bg-slate-800 rounded text-slate-400 active:scale-90"><Flag size={14}/></button></div>
            </header>
            {enemy&&(
              <div className="shrink-0 bg-slate-950/95 border-b border-red-900/40 px-4 py-1.5 z-[6400] shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
                <div className="flex justify-between items-center text-[10px] font-black italic uppercase tracking-tighter mb-1">
                  <span className={`flex items-center gap-1 ${wave===10?'text-red-500 animate-pulse':'text-slate-200'}`}><Skull size={11}/> {enemy.name} <span className={`ml-1 px-2 py-0.5 rounded-full text-[8px] text-white font-bold border ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}</span></span>
                  <span className="text-red-500 flex items-center gap-1 font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/20 relative shadow-inner">
                  <div className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-1000" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`}}></div>
                </div>
              </div>
            )}
            <main className="flex-1 relative flex flex-col items-center justify-between pt-3 pb-1 px-2 overflow-visible min-h-0">
              <button onClick={()=>setShowEnemyInfo(true)} className="absolute right-2 top-10 flex flex-col items-center justify-center p-2 rounded-2xl border border-red-500 bg-red-950/30 active:scale-90 z-20 shadow-lg"><Search className="text-red-400 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">解析</span></button>
              <button onClick={()=>setShowHeroInfo(true)} className="absolute left-2 top-10 flex flex-col items-center justify-center p-2 rounded-2xl border border-indigo-500 bg-indigo-950/30 active:scale-90 z-20 shadow-lg"><Crown className="text-indigo-400 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">ステータス</span></button>
              <button onClick={useEmergency} disabled={isBusy} className="absolute left-2 bottom-20 flex flex-col items-center justify-center p-2 rounded-2xl border border-blue-500 bg-blue-900/30 active:scale-90 disabled:opacity-20 z-20 shadow-lg"><Activity className="text-blue-400 mb-0.5" size={16}/><span className="text-[7px] font-black text-white">緊急</span></button>
              <div className="mt-1 relative flex flex-col items-center">
                {enemySkillName&&(
                  <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{top:'14%',zIndex:65000,animation:'skillNamePop 350ms ease-out forwards'}}>
                    <div className="px-4 py-1.5 rounded-xl font-black text-[13px] bg-red-700 border-2 border-red-200 text-white shadow-[0_2px_16px_rgba(0,0,0,0.9)] flex items-center gap-2"><span>{enemySkillName.icon}</span>{enemySkillName.label}</div>
                  </div>
                )}
                {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='CHARGE'&&(
                  <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 500ms ease-in-out infinite'}}>
                    <div className="text-5xl drop-shadow-[0_0_20px_rgba(217,70,239,1)]">☠️</div>
                    <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-900 via-fuchsia-700 to-purple-900 border-2 border-fuchsia-300 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(217,70,239,0.9)]">必 殺 技</div>
                  </div>
                )}
                {slotSkill&&(
                  <div className="fixed -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{left:`${12.5+slotSkill.slotIndex*25}%`,bottom:'30%',zIndex:65000,animation:'skillNamePop 350ms ease-out forwards'}}>
                    <div className={`px-3 py-1 rounded-xl font-black text-[12px] border-2 shadow-[0_2px_16px_rgba(0,0,0,0.9)] ${slotSkill.type==='unique'?'bg-purple-700 border-purple-200 text-white drop-shadow-[0_0_10px_rgba(217,70,239,0.9)]':slotSkill.type==='special'?'bg-amber-600 border-amber-200 text-white':'bg-red-700 border-red-200 text-white'}`}>{slotSkill.name}</div>
                  </div>
                )}
                {guardFx&&(
                  <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex:64000}}>
                    <div className="absolute" style={{animation:'guardShine 550ms ease-out forwards'}}>
                      <div className="text-[120px] drop-shadow-[0_0_30px_rgba(56,189,248,1)]">🛡️</div>
                    </div>
                    {[0,1,2,3,4,5].map(k=>(
                      <div key={k} className="absolute" style={{transform:`rotate(${k*60}deg)`}}>
                        <div className="rounded-full border-4 border-cyan-200" style={{width:'36px',height:'36px',animation:`guardSpark 500ms ease-out ${k*25}ms forwards`}}></div>
                      </div>
                    ))}
                    <div className="absolute font-black text-cyan-100 text-4xl tracking-widest drop-shadow-[0_0_16px_rgba(56,189,248,1)]" style={{top:'34%',animation:'guardShine 550ms ease-out forwards'}}>キーン!</div>
                    <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.5) 0%, rgba(56,189,248,0.3) 20%, rgba(0,0,0,0) 45%)',animation:'guardFlash 350ms ease-out forwards'}}></div>
                  </div>
                )}
                {teachingFx&&TEACHING_FX_STYLE[teachingFx.id]&&(()=>{
                  const fx=TEACHING_FX_STYLE[teachingFx.id];
                  return (
                    <div key={teachingFx.fxId} className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex:63000}}>
                      <div className="absolute" style={{animation:'guardShine 550ms ease-out forwards'}}>
                        <div className="text-[110px] drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">{fx.icon}</div>
                      </div>
                      {[0,1,2,3,4,5,6,7].map(k=>(
                        <div key={k} className="absolute" style={{transform:`rotate(${k*45}deg)`}}>
                          <div className={`rounded-full border-4 ${fx.ring}`} style={{width:'30px',height:'30px',animation:`guardSpark 550ms ease-out ${k*20}ms forwards`}}></div>
                        </div>
                      ))}
                      <div className={`absolute font-black text-3xl tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${fx.text}`} style={{top:'32%',animation:'guardShine 550ms ease-out forwards'}}>{fx.label}</div>
                      <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 45%, rgba(${fx.rgb},0.5) 0%, rgba(${fx.rgb},0.25) 22%, rgba(0,0,0,0) 48%)`,animation:'guardFlash 400ms ease-out forwards'}}></div>
                    </div>
                  );
                })()}
                {enemy?.id==='Moo'&&enemy?.imgUrl&&(
                  <div className="fixed left-1/2 pointer-events-none flex items-center justify-center" style={{top:'30%',transform:'translate(-50%,-50%)',zIndex:focusedCard?5:30,width:'min(108vw,560px)',height:'min(108vw,560px)'}}>
                    <img src={enemy.imgUrl} alt="ムー" style={{width:'100%',height:'100%',animation:enemyAttackAnim?(enemyAttackFx?.kind==='move'?'mooMoveSlide 1000ms ease-in-out forwards':'mooAttackLunge 900ms ease-in-out forwards'):'mooFloat 3000ms ease-in-out infinite',imageRendering:'auto',WebkitMaskImage:'radial-gradient(circle at 50% 42%, #000 60%, transparent 92%)',maskImage:'radial-gradient(circle at 50% 42%, #000 60%, transparent 92%)'}} className="object-contain drop-shadow-[0_0_55px_rgba(168,85,247,0.95)]"/>
                  </div>
                )}
                {/* ムー攻撃時: 全画面の破壊的演出 */}
                {enemy?.id==='Moo'&&enemyAttackFx?.kind==='moo'&&(
                  <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{zIndex:25}}>
                    <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 34%, rgba(168,85,247,0.55) 0%, rgba(239,68,68,0.4) 30%, rgba(251,191,36,0.25) 48%, rgba(0,0,0,0) 70%)', animation:'auraPulse 450ms ease-out infinite'}}></div>
                    <div className="absolute inset-0" style={{animation:'specialFlash 400ms ease-out infinite', background:'radial-gradient(circle at 50% 34%, rgba(255,255,255,0.45) 0%, rgba(168,85,247,0.15) 35%, rgba(255,255,255,0) 60%)'}}></div>
                    <div className="absolute" style={{top:'34%',left:'50%',transform:'translate(-50%,-50%)',width:'min(120vw,640px)',height:'min(120vw,640px)'}}>
                      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                        <div key={deg} className="absolute left-1/2 top-1/2 text-5xl" style={{transform:`translate(-50%,-50%) rotate(${deg}deg) translateY(-42vw)`, animation:'sparkFlicker 240ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                      ))}
                      <div className="absolute inset-0 rounded-full border-4 border-purple-300/80" style={{animation:'auraRing 500ms ease-out infinite'}}></div>
                      <div className="absolute inset-0 rounded-full border-4 border-red-500/60" style={{animation:'auraRing 650ms ease-out 120ms infinite'}}></div>
                    </div>
                  </div>
                )}
                {/* 行動予測ラベルはmain下部に移動 */}
                <div className={`rounded-full transition-all duration-500 border-4 relative ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border} ${RANGE_STYLES[enemyDist].shadow} ${RANGE_STYLES[enemyDist].glow} shadow-[0_0_50px]`} style={enemyAttackAnim?{padding:'clamp(8px,2.2dvh,28px)',animation:(enemyAttackFx?.kind==='move'?(enemy?.id==='Moo'?'enemyMoveSlideMoo 1000ms ease-in-out forwards':'enemyMoveSlide 1000ms ease-in-out forwards'):'enemyAttackFly 450ms ease-in forwards'), ...(enemy?.id==='Moo'&&enemyAttackFx?.kind!=='move'?{transform:'translateY(3dvh)'}:{}),...(enemy?.id!=='Moo'&&enemyAttackFx?.kind!=='move'?{zIndex:9999}:{})}:{padding:'clamp(8px,2.2dvh,28px)',...(enemy?.id==='Moo'?{transform:'translateY(3dvh)'}:{})}}>
                  {enemy?.imgUrl?(enemy?.id==='Moo'?<div style={{width:'clamp(70px,12dvh,120px)',height:'clamp(80px,16dvh,150px)'}}/>:<img src={enemy.imgUrl} alt={enemy?.name} style={{width:'clamp(70px,12dvh,120px)',height:'clamp(80px,16dvh,150px)'}} className="object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"/>):(<div style={{fontSize:'clamp(58px,11dvh,104px)',lineHeight:1}} className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">{enemy?.emoji}</div>)}
                  {/* ラスボス・ムー: 丸枠内は台座オーラのみ（本体は枠外に巨大表示） */}
                  {enemy?.id==='Moo'&&(
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible" style={{zIndex:1}}>
                      <div className="absolute -inset-8 rounded-full" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(139,0,139,0.32) 45%, rgba(0,0,0,0) 72%)', animation:'auraPulse 1500ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-3 rounded-full border-2 border-purple-500/60" style={{animation:'idleAuraPulse 1700ms ease-in-out infinite'}}></div>
                    </div>
                  )}
                  {/* Move: dash effect with motion marks */}
                  {enemyAttackFx?.kind==='move'&&(
                    <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                      <div className="absolute -inset-2 rounded-full border-4 border-cyan-300/80" style={{animation:'shockRing 600ms ease-out forwards'}}></div>
                      <div className="absolute -inset-5 rounded-full border-2 border-sky-400/50" style={{animation:'shockRing 600ms ease-out 100ms forwards'}}></div>
                      <div className="absolute text-5xl drop-shadow-[0_0_14px_rgba(34,211,238,1)]" style={{animation:'moveDash 700ms ease-in-out forwards'}}>💨</div>
                      <div className="absolute -top-3 text-4xl font-black text-cyan-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 600ms cubic-bezier(.2,1.4,.4,1) forwards'}}>🏃</div>
                    </div>
                  )}
                  {/* Normal attack: surprised exclamation burst */}
                  {enemyAttackFx?.kind==='normal'&&(
                    <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center" style={{animation:'enemyExclaim 500ms ease-out forwards'}}>
                      <div className="absolute -top-3 -right-2 text-5xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 500ms cubic-bezier(.2,1.4,.4,1) forwards'}}>❗</div>
                      <div className="absolute inset-0 rounded-full border-4 border-yellow-300/80" style={{animation:'shockRing 500ms ease-out forwards'}}></div>
                    </div>
                  )}
                  {/* Special attack: crackling aura + lightning burst */}
                  {enemyAttackFx?.kind==='special'&&(
                    <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(239,68,68,0.45) 40%, rgba(168,85,247,0.25) 60%, rgba(0,0,0,0) 75%)', animation:'auraPulse 600ms ease-out infinite'}}></div>
                      <div className="absolute -inset-3 rounded-full border-4 border-amber-300" style={{animation:'auraRing 600ms ease-out infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-2 border-red-500/70" style={{animation:'auraRing 700ms ease-out 120ms infinite'}}></div>
                      <div className="absolute -inset-12 rounded-full border-2 border-purple-500/50" style={{animation:'auraRing 800ms ease-out 240ms infinite'}}></div>
                      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                        <div key={deg} className="absolute text-3xl" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'sparkFlicker 300ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                      ))}
                      <div className="absolute text-7xl drop-shadow-[0_0_24px_rgba(251,191,36,1)]" style={{animation:'specialThrob 500ms ease-in-out infinite'}}>🔥</div>
                      <div className="absolute inset-0 rounded-full" style={{animation:'specialFlash 600ms ease-out infinite', background:'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)'}}></div>
                    </div>
                  )}
                  {/* MOO (last boss): catastrophic aura + lightning storm */}
                  {/* IDLE telegraph (player's turn): show what the enemy is about to do. Hidden while an attack is actually firing. */}
                  {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='ATTACK'&&(
                    <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center">
                      <div className="absolute -top-2 -right-1 text-4xl font-black text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" style={{animation:'idleExclaim 1100ms ease-in-out infinite'}}>❗</div>
                    </div>
                  )}
                  {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&(enemyIntent.type==='CHARGE'||(enemy?.id==='Moo'&&(enemyIntent.type==='ATTACK'||enemyIntent.type==='CHARGE')))&&(()=>{
                    const isSpecial = enemyIntent.type==='CHARGE';
                    // 通常技 = 赤系 / 必殺技(チャージ) = 紫＋金系 で明確に色分け
                    return (
                    <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                      {isSpecial ? (
                        <>
                          {/* 全画面の危険ビネット(画面端が赤紫に脈動) */}
                          <div className="fixed inset-0 pointer-events-none z-[8500]" style={{background:'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(168,85,247,0.25) 72%, rgba(127,29,29,0.55) 100%)', animation:'specialDangerPulse 700ms ease-in-out infinite'}}></div>
                          {/* 拡大する衝撃波リング(複数) */}
                          <div className="absolute -inset-8 rounded-full border-4 border-fuchsia-400/80" style={{animation:'specialShockwave 1400ms ease-out infinite'}}></div>
                          <div className="absolute -inset-8 rounded-full border-4 border-purple-300/70" style={{animation:'specialShockwave 1400ms ease-out 466ms infinite'}}></div>
                          <div className="absolute -inset-8 rounded-full border-4 border-amber-300/60" style={{animation:'specialShockwave 1400ms ease-out 933ms infinite'}}></div>
                          {/* 内側の脈動オーラ */}
                          <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(217,70,239,0.6) 0%, rgba(168,85,247,0.45) 38%, rgba(251,191,36,0.3) 62%, rgba(0,0,0,0) 82%)', animation:'specialWarnFlash 600ms ease-in-out infinite'}}></div>
                          <div className="absolute -inset-3 rounded-full border-[3px] border-fuchsia-300" style={{animation:'specialWarnFlash 600ms ease-in-out infinite', boxShadow:'0 0 30px rgba(217,70,239,0.9), inset 0 0 30px rgba(217,70,239,0.7)'}}></div>
                          {/* 回転する危険スパーク */}
                          {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                            <div key={deg} className="absolute text-2xl drop-shadow-[0_0_12px_rgba(217,70,239,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'idleSpark 600ms ease-in-out infinite', animationDelay:`${deg*1.5}ms`}}>⚡</div>
                          ))}
                          {/* 必殺技バナーは敵コンテナ直下(fixed)に移動済み */}
                        </>
                      ) : (
                        <>
                          {/* 通常技: 赤系のシンプルな警告 */}
                          <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(239,68,68,0.45) 0%, rgba(220,38,38,0.32) 42%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                          <div className="absolute -inset-4 rounded-full border-2 border-red-500/90" style={{animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                          <div className="absolute -inset-7 rounded-full border-2 border-orange-500/60" style={{animation:'idleAuraPulse 1300ms ease-in-out 120ms infinite'}}></div>
                          {[0,45,90,135,180,225,270,315].map(deg=>(
                            <div key={deg} className="absolute text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-96px, -12dvh, -60px))`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                          ))}
                          <div className="absolute -top-3 text-3xl drop-shadow-[0_0_12px_rgba(239,68,68,1)]" style={{animation:'idleExclaim 900ms ease-in-out infinite'}}>❗</div>
                        </>
                      )}
                    </div>
                    );
                  })()}
                </div>
                {getTurnBuff('stunEnemy',false)&&<div className="absolute inset-0 flex items-center justify-center text-3xl bg-indigo-500/20 rounded-full border-4 border-indigo-500 animate-pulse">💫</div>}
                <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-start pt-1 gap-0.5">{popups.filter(p=>p.side==='enemy').map(p=>(<div key={p.id} className={`text-center ${p.color} font-black drop-shadow-[0_0_15px_rgba(0,0,0,1)] whitespace-nowrap px-4`}>{p.text}</div>))}</div>
              </div>
              <div className="w-full max-w-[180px] mt-2 mb-1 shrink-0 relative z-[40]">
                <div className="h-2"></div>
              </div>
              {/* 技詳細パネルはmain外(画面直下)に移動して、ムー画像と同階層でz-index勝負させる */}
              {enemy&&enemyIntent&&!isBusy&&(<div className={`mt-auto mb-1 border p-1 px-4 rounded-full flex items-center gap-1.5 animate-pulse z-[45] shadow-lg shrink-0 ${focusedCard?'invisible':'visible'} ${enemyIntent.type==='CHARGE'?'bg-amber-950 border-amber-500 text-amber-400':'bg-red-950 border-red-600/50 text-red-400'}`}><Target size={12}/><div className="text-[9px] font-black uppercase tracking-tight">{enemyIntent.label} (予測: {getPredictedDamage(enemyIntent)})</div></div>)}
              <div className={`flex flex-wrap justify-center gap-1 max-w-[340px] mt-auto mb-1 shrink-0 relative z-[40] ${focusedCard?'invisible':'visible'}`}>
                {/* === 永続バフ（常時表示・数値が増減） === */}
                <div className="text-[7px] font-black text-red-500 bg-black/60 px-2 py-0.5 rounded border border-red-500/50 flex items-center gap-1 shadow-lg uppercase"><Sword size={7}/> ATK +{Math.floor((getPermaBuff('atkPct')+getPermaBuff('muaAtkPct'))*100)}%</div>
                <div className="text-[7px] font-black text-emerald-500 bg-black/60 px-2 py-0.5 rounded border border-emerald-500/50 flex items-center gap-1 shadow-lg uppercase"><Shield size={7}/> DEF +{Math.floor(getPermaBuff('dmgCutPct')*100)}%</div>
                <div className="text-[7px] font-black text-pink-500 bg-black/60 px-2 py-0.5 rounded border border-pink-500/50 flex items-center gap-1 shadow-lg uppercase"><Heart size={7}/> ライフ +{Math.floor(getPermaBuff('muaHpPct')*100)}%</div>
                <div className="text-[7px] font-black text-amber-500 bg-black/60 px-2 py-0.5 rounded border border-amber-500/50 flex items-center gap-1 shadow-lg uppercase"><Zap size={7}/> ガッツ +{Math.floor(getPermaBuff('muaGutsPct')*100)}%</div>
                <div className="text-[7px] font-black text-yellow-400 bg-black/60 px-2 py-0.5 rounded border border-yellow-400/50 flex items-center gap-1 shadow-lg uppercase"><Sparkles size={7}/> クリ率 +{Math.round(getPermaBuff('critRatePct')*100)}%</div>
                <div className="text-[7px] font-black text-yellow-400 bg-black/60 px-2 py-0.5 rounded border border-yellow-400/50 flex items-center gap-1 shadow-lg uppercase"><Sparkles size={7}/> クリダメ +{Math.round(getPermaBuff('critDmgPct')*100)}%</div>
                <div className="text-[7px] font-black text-cyan-400 bg-black/60 px-2 py-0.5 rounded border border-cyan-400/50 flex items-center gap-1 shadow-lg uppercase"><Sword size={7}/> 連撃 +{Math.round(getPermaBuff('comboDmgPct')*100)}%</div>
                <div className={`text-[7px] font-black bg-black/60 px-2 py-0.5 rounded border flex items-center gap-1 shadow-lg uppercase ${getPermaBuff('autoHpRecovery',0.1)>=0.1?'text-rose-400 border-rose-400/50':'text-red-400 border-red-400/50'}`}><Heart size={7}/> ライフ回復 {Math.round(getPermaBuff('autoHpRecovery',0.1)*100)}%</div>
                <div className="text-[7px] font-black text-amber-400 bg-black/60 px-2 py-0.5 rounded border border-amber-400/50 flex items-center gap-1 shadow-lg uppercase"><Zap size={7}/> ガッツ回復 {Math.round((Math.max(0,0.05+(getPermaBuff('autoHpRecovery',0.1)-0.1))+getPermaBuff('gutsRecoverPct'))*100)}%</div>
                {/* === ターン限定バフ（都度表示） === */}
                {getTurnBuff('atkMult',1.0)>1&&<div className="text-[7px] font-black text-red-500 bg-red-950/60 px-2 py-1 rounded-full border border-red-500/50 animate-pulse uppercase flex items-center gap-1"><Sparkles size={8}/> Boost x{getTurnBuff('atkMult',1.0).toFixed(1)}</div>}
                {getTurnBuff('stunEnemy',false)&&<div className="text-[7px] font-black text-yellow-400 bg-yellow-950/60 px-2 py-1 rounded-full border border-yellow-500/50 animate-pulse uppercase flex items-center gap-1"><Zap size={8}/> スタン予約</div>}
                {getTurnBuff('guaranteedCrit',false)&&<div className="text-[7px] font-black text-orange-400 bg-orange-950/60 px-2 py-1 rounded-full border border-orange-500/50 animate-pulse uppercase flex items-center gap-1"><Target size={8}/> 会心予約</div>}
                {(getTurnBuff('zeroGuts',false)||getNextTurnBuff('zeroGuts',false))&&<div className="text-[7px] font-black text-blue-400 bg-blue-950/60 px-2 py-1 rounded-full border border-blue-500/50 animate-pulse uppercase flex items-center gap-1"><Star size={8}/> 0消費中</div>}
                {getNextTurnBuff('reflect',false)&&<div className="text-[7px] font-black text-purple-400 bg-purple-950/60 px-2 py-1 rounded-full border border-purple-500/50 animate-pulse uppercase flex items-center gap-1"><RefreshCcw size={8}/> 次反射</div>}
                {getTurnBuff('reflect',false)&&<div className="text-[7px] font-black text-purple-300 bg-purple-900/80 px-2 py-1 rounded-full border border-purple-400 animate-bounce uppercase flex items-center gap-1"><RefreshCcw size={8}/> 反射待機</div>}
                {getWaveBuff('enemyAtkDebuffPct')>0&&<div className="text-[7px] font-black text-indigo-400 bg-indigo-950/60 px-2 py-1 rounded-full border border-indigo-500/50 animate-pulse uppercase flex items-center gap-1"><ArrowDownCircle size={8}/> 敵攻-{Math.round(getWaveBuff('enemyAtkDebuffPct')*100)}%</div>}
                {getWaveBuff('enemyTakenDmgBonus')>0&&<div className="text-[7px] font-black text-orange-400 bg-orange-950/60 px-2 py-1 rounded-full border border-orange-500/50 animate-pulse uppercase flex items-center gap-1"><PlusCircle size={8}/> 敵被ダメ+{Math.round(getWaveBuff('enemyTakenDmgBonus')*100)}%</div>}
                {getNextTurnBuff('takenDamageMult',1.0)<1&&<div className="text-[7px] font-black text-pink-400 bg-pink-950/60 px-2 py-1 rounded-full border border-pink-500/50 animate-pulse uppercase flex items-center gap-1"><Shield size={8}/> 次T被ダメ-{Math.round((1-getNextTurnBuff('takenDamageMult',1.0))*100)}%</div>}
                {getTurnBuff('takenDamageMult',1.0)<1&&<div className="text-[7px] font-black text-pink-300 bg-pink-900/80 px-2 py-1 rounded-full border border-pink-400 animate-bounce uppercase flex items-center gap-1"><Shield size={8}/> 被ダメ-{Math.round((1-getTurnBuff('takenDamageMult',1.0))*100)}%</div>}
                {getNextTurnBuff('gutsCostMult',1.0)>1&&<div className="text-[7px] font-black text-amber-400 bg-amber-950/60 px-2 py-1 rounded-full border border-amber-500/50 animate-pulse uppercase flex items-center gap-1"><Zap size={8}/> 次T消費G+{Math.round((getNextTurnBuff('gutsCostMult',1.0)-1)*100)}%</div>}
                {getTurnBuff('gutsCostMult',1.0)>1&&<div className="text-[7px] font-black text-amber-300 bg-amber-900/80 px-2 py-1 rounded-full border border-amber-400 animate-bounce uppercase flex items-center gap-1"><Zap size={8}/> 消費G+{Math.round((getTurnBuff('gutsCostMult',1.0)-1)*100)}%</div>}
              </div>
            </main>
            <div className="shrink-0 py-2 px-2 bg-slate-950 border-y border-white/5 flex flex-col items-center justify-center gap-1 z-10 relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1" style={{zIndex:200}}>{popups.filter(p=>p.side==='hero').map((p)=>(<div key={p.id} className={`${p.color} font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] leading-tight px-2 py-0.5 rounded-lg`} style={{backgroundColor:'rgba(2,6,23,0.55)'}}>{p.text}</div>))}</div>
              <div className="w-full space-y-1 px-2 py-1 bg-black/40 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 relative"><Heart className="text-pink-500 shrink-0" size={12}/><div className="flex-1"><div className="flex justify-between text-[7px] font-bold text-pink-400 mb-0.5 uppercase tracking-widest"><span>Ally Life</span><span className="font-mono">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-pink-700 to-rose-400 transition-all duration-1000" style={{width:`${(hp/effectiveMaxHp)*100}%`}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='life').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
                <div className="flex items-center gap-2 relative"><Zap className="text-amber-500 shrink-0" size={10}/><div className="flex-1"><div className="flex justify-between text-[7px] font-bold text-amber-400 mb-0.5 uppercase tracking-widest"><span>Ally Guts</span><span className="font-mono">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500" style={{width:`${(guts/effectiveMaxGuts)*100}%`}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
              </div>
              {(()=>{
                // Overall total damage across ALL monster slots, matching processTurn's global attack order.
                // Existing total = sum of already-assigned attack cards.
                // If a card is pending and validly assignable somewhere, also compute the projected new total.
                // committed (already assigned) attack cards in selection order
                let committedTotal=0; let committedAtkCnt=0;
                selectedCards.forEach(idx=>{
                  const card=hand[idx]; const slotIdx=cardAssignments[idx];
                  if(slotIdx==null) return;
                  const isAtk=isAttackCard(card);
                  if(isAtk){ committedTotal+=getDmg(card,slotIdx,slots[slotIdx],0,0,committedAtkCnt>0); committedAtkCnt++; }
                });
                const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
                const pendingIsAtk=isAttackCard(pendingCardObj);
                // projected damage the pending card would add (as the next attack in order)
                let pendingAdd=0; let pendingValidSlot=null;
                if(pendingIsAtk){
                  // find a slot it could legally hit (for unique: its own monster; else any occupied slot)
                  for(let i=0;i<slots.length;i++){
                    const s=slots[i]; if(!s) continue;
                    const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
                    const maxUses=(mainHero?.id==='Ham'&&s?.id==='Ham')?cardLimit:1; if(assignedCount>=maxUses) continue;
                    if(pendingCardObj.type==='unique'&&s.id!==pendingCardObj.monId) continue;
                    pendingValidSlot=i; pendingAdd=getDmg(pendingCardObj,i,s,0,0,committedAtkCnt>0); break;
                  }
                }
                const projectedTotal=committedTotal+pendingAdd;
                const showProjected=pendingIsAtk&&pendingValidSlot!=null&&pendingAdd>0;
                if(committedTotal<=0&&!showProjected) return null;
                return(
                  <div className="absolute left-1/2 -translate-x-1/2 z-[50] flex items-center justify-center pointer-events-none" style={{bottom:'calc(78% + 2px)'}}>
                    <div className={`flex items-center gap-2 px-3 py-0.5 rounded-full border shadow-lg ${showProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-red-950/90 border-red-500/50'} backdrop-blur-sm`}>
                      <Sword size={11} className={showProjected?'text-yellow-400':'text-red-400'}/>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">合計DMG</span>
                      {showProjected?(
                        <span className="text-[11px] font-black font-mono flex items-center gap-1">
                          <span className="text-slate-400">{committedTotal}</span>
                          <span className="text-yellow-400">+{pendingAdd}</span>
                          <ChevronRight size={10} className="text-slate-500"/>
                          <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedTotal}</span>
                        </span>
                      ):(
                        <span className="text-[11px] font-black font-mono text-red-300 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]">{committedTotal}</span>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-4 gap-2 w-full relative shrink-0" style={{height:'100px'}}>
                {slots.map((s,i)=>{
                  // Count how many cards already assigned to this slot
                  const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
                  // 通常は1枠1枚。ハム勇者モンが居る『ハムのスロット』のみ連続攻撃で複数枚OK
                  const maxUses=(mainHero?.id==='Ham'&&s?.id==='Ham')?cardLimit:1;
                  const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
                  // Can this slot accept the pending card?
                  let canAssign=false;
                  if(s && pendingCardObj){
                    canAssign = assignedCount<maxUses;
                    if(pendingCardObj.type==='unique') canAssign = canAssign && (s.id===pendingCardObj.monId);
                  }
                  // Count how many attack cards are already assigned (across all slots) to determine attack order
                  const assignedAttackCount=selectedCards.filter(idx=>{const c=hand[idx]; return cardAssignments[idx]!=null && isAttackCard(c);}).length;
                  // Preview damage:
                  // - if a card is pending assignment, show what THIS card would do on this monster
                  // - otherwise show the sum of damage from cards already assigned to this slot,
                  //   using the GLOBAL attack order (2nd+ attack = half damage), matching processTurn
                  let previewDmg=0; let isPendingPreview=false;
                  if(s && pendingCardObj && canAssign && isAttackCard(pendingCardObj)){
                    // 既に割り当て済みの攻撃カード枚数を選択順で正確に数え、保留カードはその次の攻撃として扱う
                    let committedAtk=0;
                    selectedCards.forEach(idx=>{const card=hand[idx]; if(isAttackCard(card)&&cardAssignments[idx]!=null)committedAtk++;});
                    const isSecondOrLater = committedAtk>=1;
                    const baseDmg=getDmg(pendingCardObj,i,s,0,0,isSecondOrLater);
                    previewDmg=baseDmg+getComboBonusDmg(pendingCardObj,s,baseDmg);
                    isPendingPreview=true;
                  } else if(s){
                    // global attack counter across all selected cards in selection order
                    let globalAtkCnt=0;
                    selectedCards.forEach(idx=>{
                      const card=hand[idx];
                      const isAtk=isAttackCard(card);
                      if(cardAssignments[idx]===i){
                        const baseDmg=getDmg(card,i,s,0,0,isAtk&&globalAtkCnt>0);
                        previewDmg+=baseDmg+getComboBonusDmg(card,s,baseDmg);
                      }
                      if(isAtk&&cardAssignments[idx]!=null)globalAtkCnt++;
                    });
                  }
                  const isAnimating = attackAnim && attackAnim.slotIndex === i;
                  // このスロットに固有技カードが割り当てられているか（セット中は常時エフェクト）
                  const hasUniqueSet = selectedCards.some(idx=>cardAssignments[idx]===i && hand[idx]?.type==='unique');
                  // このスロットに表示する選択中カード: 攻撃系は割当先スロット、全体系(ガード/バフ/回復等)は全スロット
                  const slotAssignedCards = selectedCards.filter(idx=>{
                    const card=hand[idx]; if(!card) return false;
                    if(cardNeedsMonster(card)) return cardAssignments[idx]===i;
                    return true; // 全体系は全スロット
                  }).map(idx=>({idx,card:hand[idx]}));
                  return(<button key={i} data-slot-index={i} onClick={()=>{
                    if(isBusy)return;
                    if(pendingCard!=null && canAssign){
                      setCardAssignments(p=>({...p,[pendingCard]:i}));
                      setPendingCard(null);
                      setFocusedCard(null);
                      Audio_.se.card();
                      setSlotSettle(i);
                      setTimeout(()=>{ setSlotSettle(null); }, 500);
                    }
                  }} disabled={isBusy} className={`relative rounded-xl border-2 flex flex-col items-stretch overflow-visible transition-all ${RANGE_STYLES[i].bg} ${RANGE_STYLES[i].border} ${(canAssign||(dragState?.active&&dragOverSlot===i))?'ring-2 ring-yellow-400 scale-105 z-10 shadow-lg animate-pulse':'opacity-100'} ${assignedCount>0?'ring-2 ring-indigo-500':''} ${dragState?.active&&dragOverSlot===i?'ring-4 ring-green-400 scale-110':''} ${slotSettle===i?'ring-4 ring-white':''}`} style={isAnimating?{zIndex:9999, animation:(attackAnim.zanCombo?'zanComboDash 320ms ease-out forwards':(attackAnim.charge?'specialCharge 650ms ease-out forwards':(attackAnim.charge===false?(attackAnim.motion==='floatStab'?'floatStabLunge 700ms ease-in forwards':'specialLunge 500ms ease-in forwards'):(attackAnim.motion==='floatStab'?'floatStabAttack 650ms ease-in forwards':'attackFly 450ms ease-in forwards'))))}:(slotSettle===i?{animation:'slotSettle 400ms ease-out'}:undefined)}>
                    <div className="h-[25%] bg-black/60 flex items-center justify-center px-1 border-b border-white/10 z-20"><span className="text-[7px] font-black text-white truncate uppercase leading-none">{s?.name||'---'}</span>{assignedCount>0&&<span className="ml-1 text-[7px] font-black text-indigo-300">×{assignedCount}</span>}</div>
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                      {slotSettle===i&&(
                        <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-visible">
                          <div className="absolute rounded-full border-4 border-cyan-300" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out forwards'}}></div>
                          <div className="absolute rounded-full border-2 border-white" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out 80ms forwards'}}></div>
                          <div className="absolute w-8 h-8 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-[0_0_16px_rgba(103,232,249,0.9)]" style={{animation:'setPop 500ms cubic-bezier(.2,1.5,.4,1) forwards'}}><Check size={18} className="text-white" strokeWidth={4}/></div>
                        </div>
                      )}
                      <div className={`absolute inset-0 rounded-xl ${RANGE_STYLES[i].slotBg} opacity-20 pointer-events-none`}></div>
                      {slotAssignedCards.length>0&&(
                        <div className="absolute top-0 left-0 right-0 flex flex-col gap-px items-center z-[55] pointer-events-none px-0.5">
                          {slotAssignedCards.map(({idx,card})=>(
                            <div key={idx} className={`flex items-center gap-0.5 px-1 rounded w-full justify-center min-w-0 ${cardNeedsMonster(card)?'bg-red-600/85':'bg-emerald-600/85'}`}>
                              <span style={{fontSize:'7px'}} className="leading-none shrink-0">{cardIconNode(card.icon,9)}</span>
                              <span style={{fontSize:'7px'}} className="font-black text-white leading-none truncate min-w-0">{card.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasUniqueSet&&(
                        <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center overflow-visible">
                          <div className="absolute inset-0 rounded-xl" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(99,102,241,0.28) 50%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                          <div className="absolute -inset-0.5 rounded-xl border-2 border-purple-400/80" style={{animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                          {[0,90,180,270].map(deg=>(
                            <div key={deg} className="absolute text-base" style={{transform:`rotate(${deg}deg) translateY(-26px)`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                          ))}
                        </div>
                      )}
                      {(()=>{const totalBonus=(distDmgBonus[i]||0)+(DIST_APTITUDE_MULT[getDistAptitude(s,i)]-1.0); return totalBonus!==0&&(<div className={`absolute bottom-0.5 right-0.5 text-[6px] font-black leading-none flex items-center gap-0.5 bg-black/50 px-1 py-0.5 rounded border z-30 ${totalBonus>0?'text-cyan-300 border-cyan-400/30':'text-red-300 border-red-400/30'}`}><Sword size={5}/>{totalBonus>0?'+':''}{(totalBonus*100).toFixed(1)}%</div>);})()}
                      {previewDmg>0&&(<div className={`absolute ${slotAssignedCards.length>0?'top-[18px]':'top-0'} ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'} text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg z-50 animate-bounce ring-1`}>{isPendingPreview&&assignedAttackCount>=1?'½ ':''}DMG:{previewDmg}</div>)}
                      {s?.imgUrl?(<img src={s.imgUrl} alt={s.name} style={{width:'64px',height:'64px'}} className="z-10 object-contain drop-shadow-md"/>):(<span style={{fontSize:'40px'}} className="z-10 drop-shadow-md">{s?.emoji||''}</span>)}
                    </div>
                    <div className={`h-[28%] ${RANGE_STYLES[i].labelBg} flex items-center justify-center border-t border-white/20 z-20`}><span className="text-[9px] font-black uppercase tracking-tighter leading-none">{RANGE_LABELS[i]}距離</span></div>
                  </button>);
                })}
              </div>
            </div>
            <div className="h-[24%] shrink-0 bg-slate-900/95 p-1 flex flex-col relative border-t border-white/10">
              <div className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 flex justify-between px-2 items-center gap-2">
                <span className="shrink-0">Action Cards <span className="bg-white/10 text-white px-2 py-0.5 rounded-full font-mono">{selectedCards.length}/{cardLimit}</span></span>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={()=>setShowDeckInfo(true)} className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg border border-white/10 active:scale-95"><Layers size={10}/><span className="text-[7px]">VIEW</span></button>
                  {(()=>{const allAttackAssigned=selectedCards.filter(idx=>cardNeedsMonster(hand[idx])).every(idx=>cardAssignments[idx]!=null); const canAct=!isBusy&&selectedCards.length>0&&pendingCard===null&&allAttackAssigned; return(<button onClick={processTurn} disabled={!canAct} className={`h-9 px-6 rounded-full font-black text-[13px] active:scale-90 flex items-center justify-center gap-1.5 border-2 border-black uppercase tracking-widest transition-all ${canAct?'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]':'bg-slate-700 text-slate-500 opacity-50'}`}><Play fill="currentColor" size={13}/> Action</button>);})()}
                </div>
              </div>
              <div className="flex-1 flex gap-1.5 overflow-x-auto items-stretch scrollbar-hide px-1 pb-1 justify-center">
                {hand.map((c,i)=>{
                  const isSel=selectedCards.includes(i), curGuts=getCardGuts(c), remainingGuts=guts-selectedCards.reduce((acc,idx)=>acc+(idx===i?0:getCardGuts(hand[idx])),0), isSelectable=isSel||(remainingGuts>=curGuts&&selectedCards.length<cardLimit);
                  const isPending=pendingCard===i;
                  const assignedSlot=cardAssignments[i];
                  const assignedMon=assignedSlot!=null?slots[assignedSlot]:null;
                  const isDragging=dragState?.active&&dragState?.cardIndex===i;
                  return(<div key={c.uid} className="flex-1 min-w-0 max-w-[20%] flex"><button onPointerDown={(e)=>{
                    if(isBusy)return;
                    const pt=e.touches?e.touches[0]:e;
                    setDragState({cardIndex:i, x:pt.clientX, y:pt.clientY, active:false, card:c});
                  }} style={{...(isDragging?{touchAction:'none',position:'fixed',left:dragState.x,top:dragState.y,transform:'translate(-50%,-50%) rotate(-3deg) scale(1.15)',zIndex:70000,width:'72px',pointerEvents:'none',transition:'none',filter:'drop-shadow(0 12px 18px rgba(0,0,0,0.65))'}:{touchAction:'none'}),...(TYPE_INLINE_STYLE[c.type]||{})}} className={`relative w-full rounded-xl border-2 p-1 flex flex-col items-center justify-between bg-gradient-to-b ${TYPE_COLORS[c.type]} ${isDragging?'ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.6)]':isSel?'transition-all -translate-y-1.5 ring-4 ring-cyan-300 z-20 scale-105 opacity-60 saturate-[0.7] shadow-[0_0_18px_rgba(103,232,249,0.6)]':'transition-all opacity-90'} ${isPending?'ring-4 ring-yellow-400 animate-pulse shadow-[0_0_20px_rgba(250,204,21,0.7)]':''} ${!isSelectable&&!isSel&&!isDragging?'grayscale opacity-50':''}`}>
                    {isSel&&!assignedMon&&(<div className="absolute top-0.5 left-0.5 z-30 w-5 h-5 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-lg"><Check size={10} className="text-white" strokeWidth={4}/></div>)}
                    {assignedMon&&(<div className="absolute top-0.5 right-0.5 z-30 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center overflow-hidden shadow-lg">{assignedMon.imgUrl?<img src={assignedMon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span className="text-[9px]">{assignedMon.emoji}</span>}</div>)}
                    <div className="text-3xl mt-1.5">{cardIconNode(c.icon,32)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5"><div className="text-[9px] font-black leading-tight w-full whitespace-normal h-7 flex items-center justify-center overflow-hidden uppercase italic px-0.5">{c.name}</div><div className="text-[9px] font-black bg-black/40 text-white rounded py-1 flex items-center justify-center gap-0.5"><Zap size={9}/>{curGuts}</div></div></button></div>);
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PICK HERO / ALLY */}
      {(gameState==='PICK_HERO'||gameState==='PICK_ALLY')&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] p-4 pt-6 flex flex-col justify-start overflow-hidden">
          <div className="mb-2 text-center flex items-center justify-between px-2 shrink-0"><button onClick={handleGoToTitle} className="p-2 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">{gameState==='PICK_HERO'?'勇者モンを選択':'供モンを選択'}</h2><div className="w-10"></div></div>
          <div className={`flex-1 overflow-y-auto mh-scroll w-full max-w-md mx-auto pb-4 min-h-0 flex flex-col ${gameState==='PICK_ALLY'?'justify-center':''}`}>
            <div className="grid grid-cols-2 gap-2.5">
            {monSelection.map(m=>{const isSel=currentPickingMon?.id===m.id;
              return(<button key={m.id} onClick={()=>setCurrentPickingMon(m)} className={`bg-slate-900 border-2 rounded-2xl flex flex-col items-center transition-all active:scale-95 ${isSel?'border-indigo-400 bg-indigo-900/30 ring-4 ring-indigo-500/50 scale-[1.03] shadow-[0_0_25px_rgba(99,102,241,0.6)]':'border-slate-800'}`} style={{padding:'12px 8px'}}>
              <div className="relative">{m.imgUrl?(<img src={m.imgUrl} alt={m.name} className="object-contain transition-transform" style={{width:'68px',height:'68px',transform:isSel?'scale(1.12)':'scale(1)'}}/>):(<span style={{fontSize:'52px'}}>{m.emoji}</span>)}{isSel&&<div className="absolute -top-1 -right-1 bg-indigo-500 rounded-full p-1 shadow-lg"><Check size={12} className="text-white"/></div>}</div>
              <span className="font-black text-white mt-1" style={{fontSize:'14px'}}>{m.name}</span>
              <div className="text-amber-400 font-black flex items-center gap-1 leading-tight mt-0.5" style={{fontSize:'9px'}}><Zap size={9}/> {m.unique.name}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0 w-full mt-2 px-1 font-mono" style={{fontSize:'9px'}}>
                <div className="flex justify-between"><span className="text-slate-500">HP</span><span className="text-pink-400 font-bold">{gameState==='PICK_HERO'?m.baseHp:`+${m.plusStats?.hp||0}`}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">力</span><span className="text-red-400 font-bold">{gameState==='PICK_HERO'?m.baseAtk:`+${m.plusStats?.atk||0}`}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">防</span><span className="text-emerald-400 font-bold">{gameState==='PICK_HERO'?m.baseDef:`+${m.plusStats?.def||0}`}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">G</span><span className="text-amber-400 font-bold">{gameState==='PICK_HERO'?m.baseGuts:`+${m.plusStats?.guts||0}`}</span></div>
              </div>
              <div className="text-indigo-400 font-black uppercase mt-2 flex items-center gap-0.5" style={{fontSize:'8px'}}>詳細を見る <ChevronRight size={9}/></div>
            </button>);})}
            </div>
          </div>
          {currentPickingMon&&(
            <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:31000}}>
              <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
                <div className="flex items-center gap-4 border-b border-white/10 pb-4 shrink-0">
                  {currentPickingMon.imgUrl?(<img src={currentPickingMon.imgUrl} alt={currentPickingMon.name} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110"/>):(<div className="text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{currentPickingMon.emoji}</div>)}
                  <div className="flex-1"><h3 className="text-xl font-black text-white">{currentPickingMon.name}</h3><div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Monster Profile</div>{bondGaugeNode(currentPickingMon.id)}</div><button onClick={()=>setCurrentPickingMon(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2 shrink-0">
                    <div className="bg-black/40 p-2 rounded-xl border border-white/5"><div className="text-[7px] text-slate-500 uppercase font-bold">基本ステータス</div><div className="space-y-1 mt-1"><div className="flex justify-between text-[10px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseHp:`${maxHp} → ${maxHp+(currentPickingMon.plusStats?.hp||0)}`}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseAtk:`${atk} → ${atk+(currentPickingMon.plusStats?.atk||0)}`}</span></div><div className="flex justify-between text-[10px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseDef:`${def} → ${def+(currentPickingMon.plusStats?.def||0)}`}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseGuts:`${maxGuts} → ${maxGuts+(currentPickingMon.plusStats?.guts||0)}`}</span></div></div></div>
                    {gameState==='PICK_HERO'?(<div className="bg-black/40 p-2 rounded-xl border border-indigo-500/30"><div className="text-[7px] text-indigo-400 uppercase font-bold">勇者特性</div><div className="text-[9px] text-white font-bold leading-tight mt-1">{currentPickingMon.traitDesc}</div></div>):(<div className="bg-black/40 p-2 rounded-xl border border-pink-500/30"><div className="text-[7px] text-pink-400 uppercase font-bold">合流ボーナス</div><div className="text-[8px] text-white font-bold mt-1">{currentPickingMon.plusStats.hp>0&&`HP+${currentPickingMon.plusStats.hp} `}{currentPickingMon.plusStats.atk>0&&`攻+${currentPickingMon.plusStats.atk} `}{currentPickingMon.plusStats.def>0&&`防+${currentPickingMon.plusStats.def} `}{currentPickingMon.plusStats.guts>0&&`G+${currentPickingMon.plusStats.guts} `}</div></div>)}
                  </div>
                  <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/30"><div className="flex items-center justify-between mb-0.5"><div className="text-[7px] text-cyan-400 uppercase font-bold">間合い適性</div><div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {distAptPoints[currentPickingMon.id]||0}</div></div><div className="grid grid-cols-4 gap-1 mt-1">{RANGE_LABELS.map((label,idx)=>{const grade=getDistAptitude(currentPickingMon,idx); const canUp=(distAptPoints[currentPickingMon.id]||0)>0 && DIST_APTITUDE_GRADES.indexOf(grade)<DIST_APTITUDE_GRADES.length-1; return(<div key={idx} className="flex flex-col items-center gap-0.5"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span><span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span>{canUp&&<button onClick={()=>spendAptPoint(currentPickingMon.id,idx)} className="w-full text-[8px] font-black bg-amber-600 text-white rounded py-0.5 active:scale-95">+1</button>}</div>);})}</div></div>
                  <div className="bg-slate-800/50 p-3 rounded-2xl border border-white/10 shrink-0"><div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-1"><Zap size={12} className="text-amber-400"/><span className="text-[10px] font-black uppercase">固有技: {currentPickingMon.unique.name}</span></div><div className="text-[9px] text-slate-300 leading-relaxed italic mb-2">"{currentPickingMon.unique.effectDesc}"</div></div>
                </div>
                <div className="flex gap-2 mt-2 shrink-0"><button onClick={()=>setCurrentPickingMon(null)} className="w-2/5 bg-slate-800 text-slate-400 py-3.5 rounded-2xl font-black text-sm uppercase">戻る</button><button onClick={()=>setGameState('PICK_SLOT')} className="w-3/5 bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg">決定</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PICK SLOT */}
      {gameState==='PICK_SLOT'&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
          {currentPickingMon?.imgUrl?(<img src={currentPickingMon.imgUrl} alt="mon" className="w-28 h-28 mb-4 object-contain animate-bounce drop-shadow-[0_0_40px_rgba(99,102,241,0.4)] scale-110"/>):(<div className="text-7xl mb-4 animate-bounce drop-shadow-[0_0_40px_rgba(99,102,241,0.4)]">{currentPickingMon?.emoji}</div>)}
          <h2 className="text-lg font-black mb-6 italic uppercase tracking-widest text-indigo-400">配置場所を決定せよ</h2>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            {slots.map((s,i)=>{const grade=getDistAptitude(currentPickingMon,i); const pct=Math.round((DIST_APTITUDE_MULT[grade]-1)*100);
              return(<button key={i} disabled={s!==null} onClick={()=>setupMon(currentPickingMon,i)} className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${RANGE_STYLES[i].bg} ${RANGE_STYLES[i].border} ${s?'opacity-100 shadow-xl':'opacity-90 ring-2 ring-white/20 animate-pulse'} active:scale-90`}>
              <span className={`text-[10px] font-black mb-1 uppercase px-3 py-0.5 rounded-full ${RANGE_STYLES[i].labelBg} ${RANGE_STYLES[i].text} border border-white/10 shadow-md`}>{RANGE_LABELS[i]}距離</span>
              {s?(s.imgUrl?<img src={s.imgUrl} alt={s.name} className="w-10 h-10 mt-1 object-contain drop-shadow-md scale-125"/>:<span className="text-xl mt-1 drop-shadow-md">{s.emoji}</span>):<PlusCircle className="text-white/50 mt-1" size={20}/>}
              {!s&&<span className={`text-[9px] font-black mt-1 px-2 py-0.5 rounded-full border ${DIST_APTITUDE_COLOR[grade]}`}>{grade} {pct>=0?'+':''}{pct}%</span>}
            </button>);})}
          </div>
          <button onClick={()=>setGameState(mainHero?'PICK_ALLY':'PICK_HERO')} className="mt-8 text-slate-400 flex items-center gap-2 font-black uppercase text-[10px] active:scale-90"><ArrowLeft size={14}/> モンスターを選び直す</button>
        </div>
      )}

      {/* PICK TEACHING */}
      {gameState==='PICK_TEACHING'&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] p-4 flex flex-col items-center justify-center overflow-hidden">
          <div className="mb-4 text-center shrink-0"><h2 className="text-xl font-black text-purple-400 italic">ブリーダーカードの継承・強化</h2><p className="text-[9px] text-slate-400 uppercase mt-1 tracking-widest">Select Breeder Card</p></div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto overflow-y-auto min-h-0 p-1 flex-1 content-center">
            {teachingPool.map(t=>{const owned=ownedTeachings.find(ot=>ot.id===t.id); const level=owned?owned.evoLevel:0; const isMax=level>=2;
              return(<button key={t.id} onClick={()=>setSelectedTeachingCard(t)} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-2 transition-all aspect-square ${owned?'bg-purple-900/40 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]':'bg-slate-900 border-slate-800 active:scale-95'}`}>
                <span style={{fontSize:'44px'}}>{cardIconNode(t.icon,52)}</span>
                <div className="text-[11px] font-black leading-tight flex flex-col items-center justify-center">{owned&&!isMax&&<div className="text-[8px] text-amber-400 mb-0.5 line-through">{BREEDER_EVO_NAMES[t.id][level]}</div>}<div className={owned?"text-white":""}>{owned?(isMax?BREEDER_EVO_NAMES[t.id][level]:BREEDER_EVO_NAMES[t.id][level+1]):BREEDER_EVO_NAMES[t.id][0]}</div></div>
                <div className="text-[8px] text-slate-200 bg-black/20 px-2 py-1 rounded-full">{owned?(isMax?"MAXレベル":"進化：効果上昇"):"新規習得"}</div>
              </button>);
            })}
          </div>
          {selectedTeachingCard&&(
            <div className="fixed inset-0 z-[3100] flex items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.85)',zIndex:31000}}>
              <div className="bg-slate-900 border-2 border-purple-500 rounded-3xl p-6 w-full max-w-xs flex flex-col items-center gap-4 shadow-2xl h-auto max-h-full">
                <div className="text-6xl mb-2 shrink-0">{cardIconNode(selectedTeachingCard.icon,76)}</div>
                <h3 className="text-lg font-black text-white mb-4 shrink-0">{(()=>{const t=selectedTeachingCard; const owned=ownedTeachings.find(ot=>ot.id===t.id); return BREEDER_EVO_NAMES[t.id][owned?owned.evoLevel:0];})()}</h3>
                <div className="w-full space-y-2 mb-4 overflow-y-auto min-h-0 flex-1">
                  {getFullEvolutionDetails(selectedTeachingCard).map(info=>{const owned=ownedTeachings.find(ot=>ot.id===selectedTeachingCard.id); const currentLvl=owned?owned.evoLevel:-1; const isCurrent=info.lvl===currentLvl; const isNext=info.lvl===currentLvl+1;
                    return(<div key={info.lvl} className={`p-2 rounded-xl border ${isCurrent?'bg-purple-900/50 border-purple-400':isNext?'bg-amber-900/30 border-amber-500/50':'bg-black/30 border-white/5'}`}><div className="flex justify-between items-center mb-1"><span className={`text-[9px] font-black ${isCurrent?'text-purple-300':isNext?'text-amber-300':'text-slate-500'}`}>Lv.{info.lvl} {info.name}</span>{isCurrent&&<span className="text-[7px] bg-purple-500 text-white px-1.5 rounded">所持</span>}{isNext&&<span className="text-[7px] bg-amber-600 text-white px-1.5 rounded">強化後</span>}</div><div className="text-[8px] text-slate-300">{info.desc}</div></div>);
                  })}
                </div>
                <div className="flex gap-2 w-full mt-auto shrink-0"><button onClick={()=>setSelectedTeachingCard(null)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-bold text-xs">戻る</button><button onClick={confirmPickTeaching} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-black shadow-lg text-xs">{ownedTeachings.find(ot=>ot.id===selectedTeachingCard.id)?"強化する":"習得する"}</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UPGRADE SKILL */}
      {gameState==='UPGRADE_SKILL'&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-start p-4 pt-8 text-center overflow-hidden">
          <div className="mb-2 shrink-0"><h2 className="text-xl font-black text-amber-400 italic uppercase">固有技の強化</h2><div className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest flex items-center justify-center gap-2">Remaining Points: <span className="text-white bg-amber-600 px-2 rounded-full font-mono">{upgradePoints}</span></div></div>
          <div className="w-full max-w-sm space-y-3 mb-2 min-h-0 overflow-y-auto mh-scroll flex-1 p-1 flex flex-col justify-start pt-2">
            {ownedUniques.map(u=>{const ownerMon=ALL_PLAYER_MONSTERS[u.monId]; const currentMult=u.baseMult+(u.evoLevel*0.5); const nextMult=u.baseMult+((u.evoLevel+1)*0.5); const currentGuts=Math.floor(u.baseGuts*(currentMult/u.baseMult)); const nextGuts=Math.floor(u.baseGuts*(nextMult/u.baseMult)); const curCrit=Math.round((0.10+0.05*Math.min(u.evoLevel,8))*100); const nextCrit=Math.round((0.10+0.05*Math.min(u.evoLevel+1,8))*100);
              return(<div key={u.monId} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 shrink-0"><div className="flex items-center gap-3 mb-2">{ownerMon?.iconUrl?(<img src={ownerMon.iconUrl} alt={ownerMon.name} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"/>):(<span style={{fontSize:'30px'}}>{cardIconNode(u.icon,40)}</span>)}<div className="text-left flex-1"><div className="text-[8px] font-black text-indigo-400 uppercase tracking-wider">{ownerMon?.name}</div><div className="font-black uppercase text-white" style={{fontSize:'13px'}}>{u.names[u.evoLevel]} <span className="text-slate-500">Lv.{u.evoLevel}{u.evoLevel<8&&<span className="text-amber-500"> → {u.evoLevel+1}</span>}</span></div>{u.evoLevel<8?(<div className="text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-0.5 mt-1" style={{fontSize:'9px'}}><div>技威力 {Math.floor(currentMult*100)} → <span className="text-red-400 font-bold">{Math.floor(nextMult*100)}</span></div><div>消費 {currentGuts} → <span className="text-amber-400 font-bold">{nextGuts}</span></div><div>会心 {curCrit}% → <span className="text-yellow-400 font-bold">{nextCrit}%</span></div></div>):(<div className="text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-0.5 mt-1" style={{fontSize:'9px'}}><div>技威力 {Math.floor(currentMult*100)}</div><div>消費 {currentGuts}</div><div className="text-yellow-400">会心 {curCrit}%</div><div className="text-amber-500 font-black">MAX</div></div>)}</div></div><div className="flex items-center justify-between bg-black/20 p-2 rounded-xl"><span className="text-slate-500 font-black uppercase tracking-wider" style={{fontSize:'9px'}}>レベル調整</span><div className="flex items-center gap-3"><button disabled={u.evoLevel<=0} onClick={()=>upgradeUnique(u.monId,-1)} className="w-9 h-9 flex items-center justify-center bg-slate-700 rounded-lg text-white disabled:opacity-20 active:scale-90"><MinusCircle size={18}/></button><button disabled={upgradePoints<=0||u.evoLevel>=8} onClick={()=>upgradeUnique(u.monId,1)} className="w-9 h-9 flex items-center justify-center bg-amber-600 rounded-lg text-white disabled:opacity-20 active:scale-90"><PlusCircle size={18}/></button></div></div></div>);
            })}
          </div>
          <button onClick={()=>{const availableTeachings=getActiveTeachingCards().filter(tc=>{const owned=ownedTeachings.find(ot=>ot.id===tc.id); return!owned||owned.evoLevel<2;}); setTeachingPool(availableTeachings.sort(()=>Math.random()-0.5).slice(0,4)); setGameState('PICK_TEACHING');}} className="w-full max-w-xs bg-white text-black py-3 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-transform mt-auto shrink-0">ブリーダー継承へ</button>
        </div>
      )}

      {/* WAVE RESULT */}
      {gameState==='WAVE_RESULT'&&waveResult&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-center p-3 text-center overflow-hidden">
          <div className="mb-2 shrink-0"><Trophy className="text-yellow-400 mx-auto mb-1" size={32}/><h2 className="text-xl font-black italic uppercase tracking-tighter text-white">WAVE {waveResult.wave} リザルト</h2></div>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5 mb-3 shadow-2xl shrink-0">
            <div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">WAVE 与ダメージ</span><span className="text-red-400 font-mono font-black text-base">{waveResult.totalDamage.toLocaleString()}</span></div>
            {waveResult.totalAllDamage!=null&&(<div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">全WAVE累計ダメージ</span><span className="text-orange-400 font-mono font-black text-base">{waveResult.totalAllDamage.toLocaleString()}</span></div>)}
            {waveResult.distDamage&&(<div className="border-b border-white/10 pb-1.5">
              <div className="text-cyan-400 font-black uppercase tracking-widest mb-1 text-left" style={{fontSize:'9px'}}>距離別ダメージ（味方位置）& 補正値(永続)</div>
              <div className="grid grid-cols-4 gap-1">
                {['零','近','中','遠'].map((lbl,i)=>{const dmg=waveResult.distDamage[i]||0; const cumDmg=waveResult.totalDistDamage?.[i]||0; const gained=(waveResult.gainedDistBonus?.[i]||0)*100; const total=(waveResult.newDistBonus?.[i]||0)*100; const mon=slots[i];
                  return(<div key={i} className="bg-black/40 rounded-lg border border-white/5 flex flex-col items-center justify-center" style={{padding:'4px 2px',gap:'2px'}}>
                    <div className="flex items-center" style={{gap:'3px'}}><div className="rounded-full bg-indigo-600/40 border border-indigo-400/50 flex items-center justify-center overflow-hidden shrink-0" style={{width:'26px',height:'26px'}}>{mon?(mon.imgUrl?<img src={mon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span style={{fontSize:'13px'}}>{mon.emoji}</span>):<span className="text-slate-600" style={{fontSize:'9px'}}>-</span>}</div><div className="font-black text-slate-300" style={{fontSize:'10px'}}>{lbl}</div></div>
                    <div className="font-mono font-black text-red-400 leading-none" style={{fontSize:'11px'}}>{dmg.toLocaleString()}</div>
                    <div className="text-orange-300/80 font-mono leading-none" style={{fontSize:'7px'}}>累計{cumDmg.toLocaleString()}</div>
                    <div className="font-mono font-black text-cyan-300 leading-none" style={{fontSize:'9px'}}>+{total.toFixed(1)}%</div>
                    {gained>0&&<div className="text-emerald-400 font-mono leading-none" style={{fontSize:'7px'}}>(+{gained.toFixed(1)})</div>}
                  </div>);})}
              </div>
            </div>)}
            {waveResult.recoveryDelta!=null&&(<div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">自動回復率 補正</span><span className="flex items-baseline gap-2"><span className={`font-mono font-black text-base ${waveResult.recoveryDelta>=0?'text-emerald-400':'text-red-400'}`}>{waveResult.recoveryDelta>=0?'+':''}{(waveResult.recoveryDelta*100).toFixed(1)}%</span><span className="text-[8px] text-slate-500 font-mono">累計 <span className={`${waveResult.totalRecoveryDelta>=0?'text-emerald-300':'text-red-300'}`}>{waveResult.totalRecoveryDelta>=0?'+':''}{(waveResult.totalRecoveryDelta*100).toFixed(1)}%</span></span></span></div>)}
            <div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">WAVE ボーナス ({waveResult.wave} WAVE)</span><span className="text-yellow-400 font-mono font-black text-base">x{waveResult.waveMult.toFixed(2)}</span></div>
            <div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">残りターン数ボーナス ({waveResult.remainingTurns})</span><span className="text-blue-400 font-mono font-black text-base">x{waveResult.turnMult.toFixed(2)}</span></div>
            <div className="pt-1 flex flex-col gap-0.5 text-right"><div className="text-[9px] text-slate-500 font-bold uppercase italic">難易度ボーナス ({difficulty}): x{scoreMultiplier}</div><div className="flex justify-between items-end"><span className="text-indigo-400 text-xs font-black uppercase">獲得スコア</span><span className="text-white font-mono font-black text-xl">{waveResult.roundScore.toLocaleString()}</span></div></div>
            <div className="pt-1 flex justify-between items-end border-t border-white/20"><span className="text-amber-500 text-[11px] font-black uppercase">累計スコア</span><span className="text-amber-400 font-mono font-black text-lg">{waveResult.totalScore.toLocaleString()}</span></div>
          </div>
          <button onClick={handleNextWave} className="w-full max-w-xs bg-white text-indigo-900 py-3 rounded-2xl font-black text-lg active:scale-95 uppercase shadow-[0_0_20px_rgba(255,255,255,0.3)] shrink-0">次へ進む <ChevronRight className="inline" size={20}/></button>
        </div>
      )}

      {/* REWARD PICK */}
      {gameState==='REWARD_PICK'&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-start p-4 pt-8 text-center overflow-hidden">
          <div className="mb-2 shrink-0"><Trophy className="text-amber-400 mx-auto mb-1" size={32}/><h2 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">能力覚醒</h2><p className="text-[9px] text-slate-400 uppercase mt-1 tracking-widest">強化を1つ選んで決定</p></div>
          <div className="w-full max-w-sm space-y-3 mb-3 shrink-0 flex-1 min-h-0 overflow-y-auto mh-scroll flex flex-col justify-center">
            <button disabled={!!effect} onClick={()=>setPendingReward('atk')} className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 shrink-0 shadow-lg transition-all disabled:opacity-40 ${pendingReward==='atk'?'bg-red-900/40 border-red-400 scale-[1.03] ring-4 ring-red-500/50 shadow-[0_0_25px_rgba(248,113,113,0.5)]':'bg-slate-900/50 border-slate-800'}`}>
              <div className="p-2 bg-red-600/20 rounded-xl text-red-500 relative"><Sword size={18}/>{pendingReward==='atk'&&<div className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5"><Check size={10} className="text-white"/></div>}</div>
              <div className="text-left flex-1"><div className="font-black text-white uppercase flex items-center gap-2" style={{fontSize:'13px'}}>攻撃覚醒 <ChevronRight size={12}/> {(HERO_ATK_NAMES[mainHero?.id]||HERO_ATK_NAMES['Mocchi'])[Math.min(8,atkLevel+1)]}</div><div className="flex flex-wrap justify-between gap-x-2 text-slate-300 font-mono mt-1.5" style={{fontSize:'9px'}}><div>ちから {atk} → <span className="text-red-400 font-bold">{Math.floor(atk*1.10)}</span></div><div>技威力 {Math.floor(BASE_ATK_EVOLUTION[Math.min(8,atkLevel)].mult*100)} → <span className="text-red-400 font-bold">{Math.floor(BASE_ATK_EVOLUTION[Math.min(8,atkLevel+1)].mult*100)}</span></div><div>会心 {Math.round(BASE_ATK_EVOLUTION[Math.min(8,atkLevel)].crit*100)}% → <span className="text-yellow-400 font-bold">{Math.round(BASE_ATK_EVOLUTION[Math.min(8,atkLevel+1)].crit*100)}%</span></div></div></div>
            </button>
            <button disabled={!!effect} onClick={()=>setPendingReward('def')} className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 shrink-0 shadow-lg transition-all disabled:opacity-40 ${pendingReward==='def'?'bg-emerald-900/40 border-emerald-400 scale-[1.03] ring-4 ring-emerald-500/50 shadow-[0_0_25px_rgba(52,211,153,0.5)]':'bg-slate-900/50 border-slate-800'}`}>
              <div className="p-2 bg-emerald-600/20 rounded-xl text-emerald-500 relative"><ShieldCheck size={18}/>{pendingReward==='def'&&<div className="absolute -top-1.5 -right-1.5 bg-emerald-500 rounded-full p-0.5"><Check size={10} className="text-white"/></div>}</div>
              <div className="text-left flex-1"><div className="font-black text-white uppercase flex items-center gap-2" style={{fontSize:'13px'}}>防御覚醒 <ChevronRight size={12}/> {GUARD_EVOLUTION[Math.min(8,guardLevel+1)].name}</div><div className="grid grid-cols-2 gap-x-2 text-slate-300 font-mono mt-1.5" style={{fontSize:'9px'}}><div>ライフ {maxHp} → <span className="text-pink-400 font-bold">{Math.floor(maxHp*1.20)}</span></div><div>丈夫さ {def} → <span className="text-emerald-400 font-bold">{Math.floor((def+20)*1.10)}</span></div></div><div className="text-emerald-400 font-mono font-bold mt-1" style={{fontSize:'9px'}}>ガード枚数 {2+guardBonusCount} → {3+guardBonusCount}</div></div>
            </button>
            <button disabled={!!effect} onClick={()=>setPendingReward('hp')} className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 shrink-0 shadow-lg transition-all disabled:opacity-40 ${pendingReward==='hp'?'bg-pink-900/40 border-pink-400 scale-[1.03] ring-4 ring-pink-500/50 shadow-[0_0_25px_rgba(244,114,182,0.5)]':'bg-slate-900/50 border-slate-800'}`}>
              <div className="p-2 bg-pink-600/20 rounded-xl text-pink-500 relative"><Heart size={18}/>{pendingReward==='hp'&&<div className="absolute -top-1.5 -right-1.5 bg-pink-500 rounded-full p-0.5"><Check size={10} className="text-white"/></div>}</div>
              <div className="text-left flex-1"><div className="font-black text-white uppercase flex items-center gap-1" style={{fontSize:'13px'}}>精神強化 <Sparkles size={10} className="text-amber-400"/> 最大GUTS +10 & 10% UP</div><div className="text-amber-300 font-mono font-bold mt-1.5 text-center" style={{fontSize:'10px'}}>ガッツ {maxGuts} → {Math.floor((maxGuts+10)*1.1)}</div></div>
            </button>
          </div>
          <button disabled={!pendingReward||!!effect} onClick={()=>{const r=pendingReward; setPendingReward(null); handleReward(r);}} className={`w-full max-w-sm py-4 rounded-2xl font-black text-lg uppercase shadow-lg active:scale-95 transition-all shrink-0 mt-auto ${pendingReward&&!effect?'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]':'bg-slate-800 text-slate-600'}`}>{pendingReward?'決定する':'強化を選択'}</button>
        </div>
      )}

      {/* HELP */}
      {showHelp&&(
        <div className="fixed inset-0 z-[99999] flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'#000000',zIndex:99999}}>
          <header className="shrink-0 p-4 border-b border-white/10 flex justify-between items-center bg-slate-900 shadow-xl" style={{backgroundColor:'#0f172a',paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
            <div className="flex items-center gap-2"><HelpCircle className="text-emerald-400" size={24}/><h2 className="text-xl font-black italic text-white uppercase tracking-widest leading-none">Help Guide</h2></div>
            <button onClick={()=>setShowHelp(false)} className="p-2 bg-white/10 rounded-full active:scale-90 shadow-inner"><X size={24}/></button>
          </header>
          <nav className="shrink-0 flex bg-slate-900 border-b border-white/5">
            {[{id:'goal',label:'目的',icon:<Trophy size={14}/>},{id:'battle',label:'戦闘',icon:<Sword size={14}/>},{id:'growth',label:'成長',icon:<Sparkles size={14}/>},{id:'meta',label:'育成',icon:<Crown size={14}/>},{id:'tips',label:'コツ',icon:<Info size={14}/>}].map(tab=>(
              <button key={tab.id} onClick={()=>setHelpTab(tab.id)} className={`flex-1 py-3 text-[10px] font-black uppercase flex flex-col items-center gap-1 transition-all ${helpTab===tab.id?'text-emerald-400 bg-emerald-500/20 border-b-4 border-emerald-400':'text-slate-500'}`}>{tab.icon}{tab.label}</button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto mh-scroll p-5 space-y-6 bg-black" style={{backgroundColor:'#000000'}}>
            {helpTab==='goal'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-emerald-400 font-black text-base mb-3 flex items-center gap-2"><Trophy size={18}/> ゲームの目的</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">全10 WAVEのボスモンスターを撃破し、最高スコアを目指す戦略的カードバトルRPGです。</p><div className="grid grid-cols-2 gap-3"><div className="bg-black/50 p-3 rounded-2xl border border-white/5"><div className="text-[9px] text-slate-500 font-black uppercase mb-1">勝利条件</div><div className="text-[11px] text-white font-bold leading-tight">WAVE 10のラスボス「ムー」を撃破すること</div></div><div className="bg-black/50 p-3 rounded-2xl border border-white/5"><div className="text-[9px] text-slate-500 font-black uppercase mb-1">敗北条件</div><div className="text-[11px] text-white font-bold leading-tight">・ライフが0になる<br/>・20ターン経過</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-emerald-400 font-black text-base mb-3">基本的な流れ</h3><div className="space-y-3">{[{step:"1",text:"勇者モン（1体目）を選んでスタート"},{step:"2",text:"カードを選び、対象のモンスター枠をタップして決定"},{step:"3",text:"報酬を選んで強化（WAVE 2,4,6で仲間が合流）"},{step:"4",text:"10 WAVE目のチャンピオンを目指す！"}].map(item=>(<div key={item.step} className="flex items-center gap-4"><span className="shrink-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-[11px] font-black">{item.step}</span><span className="text-[12px] text-slate-300">{item.text}</span></div>))}</div></section></div>)}
            {helpTab==='battle'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-blue-400 font-black text-base mb-3 flex items-center gap-2"><Target size={18}/> 距離システム</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">自分と敵の「距離」が威力を左右します。このゲーム最大の戦略要素です。</p><div className="space-y-3"><div className="bg-black/50 p-4 rounded-2xl border border-blue-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">距離の一致（超重要）</div><div className="text-[12px] text-slate-400 leading-relaxed">敵と同じ距離枠にいるモンスターで攻撃すると大ダメージ！距離がずれるほど威力は低下します。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">解析と予測</div><div className="text-[12px] text-slate-400 leading-relaxed">敵は移動することがあります。「解析ボタン」で敵の行動を予測し、防御か攻撃か判断しましょう。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-teal-400 font-black text-base mb-3 flex items-center gap-2"><Target size={18}/> 間合い適性</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">モンスターごとに4つの距離それぞれで得意・不得意があり、C(標準・±0%)を基準にG(-20%)〜M(+25%)のグレードでダメージが変動します。モンスター詳細画面のグレード表示で確認できます。</p><div className="text-[11px] text-slate-400 leading-relaxed">絆レベルが上がると貯まる「強化ポイント」を1つ消費すると、詳細画面からその距離の適性グレードを1段階アップできます(上限はM)。</div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Zap size={18}/> GUTSの管理</h3><p className="text-[12px] text-slate-200 leading-relaxed">行動にはガッツを消費します。ガッツは毎ターン自動回復しますが、上限を増やすことで強力な技を安定して使えます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-cyan-400 font-black text-base mb-3 flex items-center gap-2"><Crown size={18}/> 勇者特性・固有技</h3><p className="text-[12px] text-slate-200 leading-relaxed">最初に選ぶ「勇者モン」ごとに専用の特性(勇者モン選択時のみ発動)と、進化する固有技(必殺技)を持ちます。編成する勇者モンによって戦い方が大きく変わります。詳しくは召喚時のモンスター詳細で確認できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-blue-300 font-black text-base mb-3 flex items-center gap-2"><Activity size={18}/> 緊急回復</h3><p className="text-[12px] text-slate-200 leading-relaxed">画面左下の「緊急」ボタンでライフとガッツをそれぞれ最大値の30%回復できます。ただし使用すると自分のターンを消費し、敵の行動が発生します。回数制限はありません。</p></section></div>)}
            {helpTab==='growth'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-purple-400 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> 能力覚醒（報酬）</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">WAVEクリア後、3つの能力から1つを選んで強化します。</p><div className="grid grid-cols-3 gap-2"><div className="bg-red-900/30 border border-red-500/40 p-3 rounded-2xl text-center"><Sword size={16} className="mx-auto text-red-400 mb-2"/><div className="text-[10px] font-black">攻撃覚醒</div></div><div className="bg-emerald-900/30 border border-emerald-500/40 p-3 rounded-2xl text-center"><Shield size={16} className="mx-auto text-emerald-400 mb-2"/><div className="text-[10px] font-black">防御覚醒</div></div><div className="bg-pink-900/30 border border-pink-500/40 p-3 rounded-2xl text-center"><Heart size={16} className="mx-auto text-pink-400 mb-2"/><div className="text-[10px] font-black">精神強化</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><BookOpen size={18}/> ブリーダー継承</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">WAVE 1,3,5,7,9で、ブリーダーの「教え」をカードとして加えられます。同じ教えを重ねると「進化」し、効果が飛躍的に高まります(最大Lv2)。編成したブリーダーカードの中から候補が出ます。</p><div className="grid grid-cols-2 gap-2">{[{n:"おりょうの力",d:"攻撃ステータスUP"},{n:"ドラの緑膝",d:"被ダメージDOWN"},{n:"かどみうむの計算",d:"自動ライフ/ガッツ回復UP"},{n:"みゅあの愛",d:"回復＆能力永続UP"},{n:"あつの挑発",d:"敵行動無効＆攻撃"},{n:"みゃるの薬",d:"次ターン攻撃2倍＆自傷"}].map(c=>(<div key={c.n} className="bg-black/50 p-2.5 rounded-xl border border-white/5"><div className="text-[10px] font-black text-white">{c.n}</div><div className="text-[9px] text-slate-400">{c.d}</div></div>))}</div></section></div>)}
            {helpTab==='meta'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Crown size={18}/> ブリーダーレベル</h3><p className="text-[12px] text-slate-200 leading-relaxed">WAVEをクリアするとブリーダーXPを獲得してレベルアップします。レベルが上がるたびにブリーダーポイント(pt)を1獲得できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-pink-400 font-black text-base mb-3 flex items-center gap-2"><Heart size={18}/> 絆レベル</h3><p className="text-[12px] text-slate-200 leading-relaxed">勇者モンに選んだモンスターは、WAVEクリアごとに絆経験値を獲得して絆レベルが上がります(WAVEが進むほど1回あたりの獲得量も増加)。レベルが上がるたびに「強化ポイント」を1獲得でき、そのモンスターの間合い適性を強化できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-300 font-black text-base mb-3 flex items-center gap-2"><Trophy size={18}/> 最終リザルト</h3><p className="text-[12px] text-slate-200 leading-relaxed">優勝・敗北・リタイアいずれかでプレイが終了すると、獲得したブリーダー経験値・ダイヤ・絆経験値と、WAVEごとの獲得スコア/経験値/ダイヤの内訳を確認できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Coins size={18}/> pt とダイヤ(2つの通貨)</h3><div className="space-y-3"><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">pt（ポイント）</div><div className="text-[12px] text-slate-400 leading-relaxed">ブリーダーレベルアップで獲得。マーケットの「アイコン」購入に使います。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">ダイヤ</div><div className="text-[12px] text-slate-400 leading-relaxed">WAVEクリアで獲得(Normal基準100ダイヤ/WAVE、難易度で変動)。マーケットの「円盤石」「ブリーダー」購入に使います。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-orange-400 font-black text-base mb-3 flex items-center gap-2"><ShoppingBag size={18}/> マーケット</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">プロフィール画面から入れます。3つのカテゴリがあります。</p><div className="grid grid-cols-3 gap-2"><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">アイコン</div><div className="text-[9px] text-slate-400">ptで購入<br/>プロフィール画像に</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">円盤石</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>新モンスター解放</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">ブリーダー</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>新カード解放</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> 編成</h3><p className="text-[12px] text-slate-200 leading-relaxed">マーケットで新しいモンスターやブリーダーカードを解放しても、次の周回で候補になるのは編成で選んだものだけです。プロフィール画面の「編成」からモンスター8体・ブリーダーカード6枚をちょうど選び、「決定」ボタンで確定します(最初から解放済みの8体・6枚は編成済みです)。</p></section></div>)}
            {helpTab==='tips'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-orange-400 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> 複数枚同時使用の解放</h3><div className="bg-black/50 p-4 rounded-2xl space-y-2"><div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">同時2枚:</span><span className="text-white font-black">最大ガッツ120 ＋ 味方2体</span></div><div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">同時3枚:</span><span className="text-white font-black">最大ガッツ180 ＋ 味方3体</span></div><div className="text-[10px] text-amber-500 font-black italic pt-2 border-t border-white/5">※ハムは勇者時、常に上限＋1</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><Activity size={18}/> 攻略のヒント</h3><ul className="text-[12px] text-slate-300 space-y-3 list-disc pl-5"><li><span className="font-black text-white">防御は最大の攻撃</span>: 敵の必殺技は即死級。解析を使い確実に防御しましょう。</li><li><span className="font-black text-white">再生の強化</span>: 教えにより毎ターンの「再生ライフ」を増やすと後半が有利になります。</li><li><span className="font-black text-white">勇者特性を理解する</span>: 1体目に選んだモンスターの特性は最後まで影響します。</li><li><span className="font-black text-white">データのバックアップ</span>: ホーム画面のアイコンを作り直すと進行状況が引き継がれないことがあります。プロフィール画面の「データのバックアップ・復元」で定期的にコードを控えておくと安心です。</li></ul></section></div>)}
          </div>
          <footer className="shrink-0 p-5 bg-slate-900 border-t border-white/10 text-center" style={{backgroundColor:'#0f172a'}}>
            <button onClick={()=>setShowHelp(false)} className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase shadow-2xl active:scale-95 transition-transform">わかった！冒険に戻る</button>
            {gameState==='TITLE'&&(
              <button onClick={()=>{setShowHelp(false); setTestMooMode(true); setMonSelection(Object.values(ALL_PLAYER_MONSTERS)); setGameState('PICK_HERO');}} className="mt-3 mx-auto block text-[9px] text-slate-700 hover:text-slate-500 active:text-purple-500 tracking-widest">· · 🧪 · ·</button>
            )}
          </footer>
        </div>
      )}

      {/* DECK INFO */}
      {showDeckInfo&&(<div className="fixed inset-0 z-[40000] p-4 flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'#020617',zIndex:40000,paddingTop:'calc(1rem + env(safe-area-inset-top))'}}><div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2"><h3 className="font-black italic uppercase text-indigo-400 text-base">Deck View</h3><button onClick={()=>setShowDeckInfo(false)} className="px-4 py-2 bg-white/10 rounded-full text-[11px] active:scale-90 text-white">閉じる</button></div><div className="flex-1 overflow-y-auto">{(()=>{
        const renderCard=(c,isUsed)=>(<button key={c.uid} onClick={()=>setFocusedCard(c)} style={TYPE_INLINE_STYLE[c.type]||{}} className={`relative w-full aspect-square rounded-xl border-2 p-1 flex flex-col items-center justify-between bg-gradient-to-b active:scale-95 transition-all ${TYPE_COLORS[c.type]} ${isUsed?'opacity-35 grayscale':''}`}>{isUsed&&<div className="absolute top-1 right-1 text-[6px] font-black text-white bg-black/60 px-1 rounded uppercase z-10">済</div>}<div className="text-3xl mt-1.5">{cardIconNode(c.icon,32)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5"><div className="text-[9px] font-black leading-tight w-full whitespace-normal h-7 flex items-center justify-center overflow-hidden uppercase italic px-0.5">{c.name}</div><div className="text-[9px] font-black bg-black/40 text-white rounded py-1 flex items-center justify-center gap-0.5"><Zap size={9}/>{getCardGuts(c)}</div></div></button>);
        return(<>
          {hand.length>0&&(<div className="mb-4"><div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2">手札 ({hand.length})</div><div className="grid gap-1.5" style={{gridTemplateColumns:'repeat(5, minmax(0, 1fr))'}}>{hand.map(c=>renderCard(c,false))}</div></div>)}
          {deck.length>0&&(<div className="mb-4"><div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">山札 ({deck.length})</div><div className="grid gap-1.5" style={{gridTemplateColumns:'repeat(5, minmax(0, 1fr))'}}>{deck.map(c=>renderCard(c,false))}</div></div>)}
          {graveyard.length>0&&(<div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">捨て札 ({graveyard.length})</div><div className="grid gap-1.5" style={{gridTemplateColumns:'repeat(5, minmax(0, 1fr))'}}>{graveyard.map(c=>renderCard(c,true))}</div></div>)}
        </>);
      })()}</div></div>)}
      {focusedCard&&(
        <div className="fixed left-1/2 -translate-x-1/2 bg-slate-900/98 border-2 border-indigo-400 p-2.5 rounded-2xl w-[90%] max-w-[260px] shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-md" style={{bottom:'calc(34% + 80px)',zIndex:110000}} onClick={()=>setFocusedCard(null)}>
          <div className="flex items-center gap-2.5 mb-1 border-b border-white/10 pb-1"><span className="text-xl bg-indigo-500/20 p-1 rounded-xl">{cardIconNode(focusedCard.icon,22)}</span><div className="text-left flex-1 overflow-hidden"><div className="text-[9px] font-black text-white uppercase truncate">{focusedCard.name||focusedCard.baseName}</div><div className="text-[7px] font-bold text-indigo-400 flex items-center gap-1"><Zap size={7}/> {getCardGuts(focusedCard)} Guts</div></div></div>
          <div className="text-[8px] text-slate-200 font-medium leading-relaxed bg-black/50 p-1.5 rounded-lg border border-white/5 space-y-1">
            {['atk','range_atk','unique'].includes(focusedCard.type)&&(<div className="flex justify-between items-center text-xs"><span>技威力:</span><span className="text-red-400 font-black">{focusedCard.type==='range_atk'?`${Math.floor(focusedCard.mult*100)} / ${Math.floor(focusedCard.mult*0.4*100)}`:Math.floor((focusedCard.type==='unique'?(focusedCard.baseMult+(focusedCard.evoLevel||0)*0.5+((focusedCard.monId==='Ark'||focusedCard.monId==='Iblis')?0.1*getPermaBuff('chuuniUniqueStack'):0)):(focusedCard.mult||focusedCard.baseMult||1.0))*100)}</span></div>)}
            {['atk','range_atk','unique'].includes(focusedCard.type)&&(<div className="flex justify-between items-center text-xs"><span>会心率:</span><span className="text-yellow-400 font-black">{Math.round(((focusedCard.crit||0.1)+getPermaBuff('critRatePct'))*100)}%{getPermaBuff('critRatePct')>0&&<span className="text-yellow-200 text-[8px]"> (+{Math.round(getPermaBuff('critRatePct')*100)})</span>} <span className="text-yellow-200/70 text-[8px]">×{(1.5+getPermaBuff('critDmgPct')).toFixed(2)}</span></span></div>)}
            {focusedCard.type==='guard'&&<div className="text-center font-bold">敵の攻撃を最大 {Math.floor(def*(focusedCard.power||1))} 軽減</div>}
            {focusedCard.type==='range_atk'&&focusedCard.rangeIdx!=null&&(<div className="border-t border-white/10 pt-1 mt-1 text-[7px] text-cyan-200 font-bold"><span className="text-cyan-400">強制移動:</span> ターン終了時、敵を{RANGE_LABELS[(focusedCard.rangeIdx+1)%4]}距離へ移動させる</div>)}
            {['buff','debuff','heal'].includes(focusedCard.type)&&(<div className="text-center italic text-amber-300 font-bold text-[7px] leading-tight">{getDynamicDesc(focusedCard,true,focusedCard.evoLevel||0)}</div>)}
            {focusedCard.effectDesc&&<div className="border-t border-white/10 pt-1 mt-1 text-[7px] text-amber-200 font-bold"><span className="text-indigo-400">特殊効果:</span> {focusedCard.effectDesc}</div>}
          </div>
        </div>
      )}

      {/* ENEMY INFO */}
      {showEnemyInfo&&enemy&&(<div className="fixed inset-0 p-6 flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'#020617',zIndex:40000,paddingTop:'calc(1.5rem + env(safe-area-inset-top))'}}><div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4"><h3 className="font-black italic uppercase text-red-500 text-lg">Enemy Scan</h3><button onClick={()=>setShowEnemyInfo(false)} className="px-6 py-2 bg-white/10 rounded-full text-[11px] text-white active:scale-90">戻る</button></div><div className="flex-1 flex flex-col items-center justify-center text-center">{enemy.imgUrl?(<img src={enemy.imgUrl} alt={enemy.name} style={{width:'140px',height:'140px'}} className="mx-auto mb-6 object-contain drop-shadow-[0_0_50px_rgba(239,68,68,0.4)]"/>):(<div style={{fontSize:'112px'}} className="mb-6 drop-shadow-[0_0_50px_rgba(239,68,68,0.4)]">{enemy.emoji}</div>)}<h4 className="text-2xl font-black italic mb-6 uppercase">{enemy.name}</h4><div className="w-full max-w-sm space-y-4 bg-slate-900/50 p-6 rounded-3xl border border-white/5"><div className="grid grid-cols-2 gap-6 text-left"><div><div className="text-[9px] text-pink-400 font-black uppercase">ライフ</div><div className="text-xl font-mono font-black">{enemy.hp.toLocaleString()}</div></div><div><div className="text-[9px] text-red-400 font-black uppercase">攻撃力</div><div className="text-xl font-mono font-black">{enemy.atk}</div></div></div></div></div></div>)}
      {showHeroInfo&&mainHero&&(<div className="fixed inset-0 p-6 flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'#020617',zIndex:40000,paddingTop:'calc(1.5rem + env(safe-area-inset-top))'}}><div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4"><h3 className="font-black italic uppercase text-indigo-400 text-lg">Hero Scan</h3><button onClick={()=>setShowHeroInfo(false)} className="px-6 py-2 bg-white/10 rounded-full text-[11px] text-white active:scale-90">戻る</button></div><div className="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto mh-scroll">{mainHero.imgUrl?(<img src={mainHero.imgUrl} alt={mainHero.name} style={{width:'140px',height:'140px'}} className="mx-auto mb-6 object-contain drop-shadow-[0_0_50px_rgba(99,102,241,0.4)]"/>):(<div style={{fontSize:'112px'}} className="mb-6 drop-shadow-[0_0_50px_rgba(99,102,241,0.4)]">{mainHero.emoji}</div>)}<h4 className="text-2xl font-black italic mb-6 uppercase">{mainHero.name}</h4><div className="w-full max-w-sm space-y-4 bg-slate-900/50 p-6 rounded-3xl border border-white/5"><div className="grid grid-cols-2 gap-6 text-left"><div><div className="text-[9px] text-pink-400 font-black uppercase">ライフ</div><div className="text-xl font-mono font-black">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</div></div><div><div className="text-[9px] text-red-400 font-black uppercase">攻撃力</div><div className="text-xl font-mono font-black">{atk}</div></div><div><div className="text-[9px] text-emerald-400 font-black uppercase">丈夫さ</div><div className="text-xl font-mono font-black">{def}{getPermaBuff('dmgCutPct')>0&&<span className="text-[10px] text-emerald-400 ml-1">(+{Math.round(getPermaBuff('dmgCutPct')*100)}%軽減)</span>}</div></div><div><div className="text-[9px] text-amber-400 font-black uppercase">ガッツ</div><div className="text-xl font-mono font-black">{guts} / {effectiveMaxGuts}</div></div></div><div className="bg-black/40 p-3 rounded-xl border border-indigo-500/30 text-left"><div className="text-[9px] text-indigo-400 uppercase font-black">勇者特性</div><div className="text-[11px] text-white font-bold leading-relaxed mt-1">{mainHero.traitDesc}</div></div></div></div></div>)}

      {/* QUIT CONFIRM */}
      {showQuitConfirm&&(<div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.94)',zIndex:95000,pointerEvents:'auto'}}><AlertCircle size={48} className="text-red-500 mb-4"/><h2 className="text-xl font-black text-white uppercase mb-2">降参しますか？</h2><p className="text-[11px] text-slate-400 mb-2">現在のスコア {score.toLocaleString()} pt がランキングに記録されます</p><div className="flex flex-col gap-3 w-full max-w-xs mt-4" style={{position:'relative',zIndex:95001}}><button type="button" onClick={handleGiveUp} style={{position:'relative',zIndex:95002,pointerEvents:'auto'}} className="w-full bg-red-600 text-white py-3 rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95">降参する</button><button type="button" onClick={()=>setShowQuitConfirm(false)} style={{position:'relative',zIndex:95002,pointerEvents:'auto'}} className="w-full bg-slate-800 text-slate-300 py-3 rounded-2xl font-black uppercase text-sm active:scale-95">戦いを続ける</button></div></div>)}

      {/* CHAMPION */}
      {gameState==='CHAMPION'&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,background:'linear-gradient(to bottom right,#fbbf24,#78350f)'}}><div className="shrink-0 flex flex-col items-center"><Crown size={64} className="text-white animate-bounce mb-3"/><h1 className="text-3xl font-black italic text-white uppercase">CHAMPION</h1><div className="w-full max-w-xs bg-black/40 border border-white/20 rounded-3xl p-6 mb-3 mt-3 shadow-2xl"><div className="text-5xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}</div><button onClick={handleGoToTitle} className="w-full max-w-xs bg-white text-amber-900 py-4 rounded-3xl font-black text-xl uppercase shadow-2xl active:scale-95 transition-transform shrink-0 mt-2">タイトルへ</button></div>)}

      {/* GAME OVER */}
      {hp<=0&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="shrink-0 flex flex-col items-center"><Skull size={48} className="text-red-700 mb-3 animate-pulse"/><h2 className="text-2xl font-black italic text-white uppercase">敗 北</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}</div><div className="flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={handleRetry} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2"><RotateCcw size={20}/> 再挑戦</button><button onClick={handleGoToTitle} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase">トップへ</button></div></div>)}

      {gaveUp&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="shrink-0 flex flex-col items-center"><Flag size={48} className="text-slate-400 mb-3"/><h2 className="text-2xl font-black italic text-white uppercase">リタイア</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}</div><div className="flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={handleRetry} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2"><RotateCcw size={20}/> 再挑戦</button><button onClick={handleGoToTitle} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase">トップへ</button></div></div>)}

      {/* EFFECT OVERLAY */}
      {effect&&(<div className="fixed inset-0 z-[70000] flex flex-col items-center justify-center pointer-events-none text-center p-8 overflow-hidden" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.96)',zIndex:70000}}>
        {effect.type==='unique'&&(
          <>
            <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 42%, rgba(168,85,247,0.5) 0%, rgba(99,102,241,0.35) 35%, rgba(0,0,0,0) 68%)', animation:'auraPulse 600ms ease-out infinite'}}></div>
            <div className="absolute" style={{top:'42%',left:'50%',width:'min(80vw,360px)',height:'min(80vw,360px)',transform:'translate(-50%,-50%)'}}>
              <div className="absolute inset-0 rounded-full border-4 border-purple-400/70" style={{animation:'auraRing 700ms ease-out infinite'}}></div>
              <div className="absolute inset-0 rounded-full border-2 border-indigo-300/60" style={{animation:'auraRing 900ms ease-out 150ms infinite'}}></div>
              {[0,45,90,135,180,225,270,315].map(deg=>(
                <div key={deg} className="absolute left-1/2 top-1/2 text-3xl" style={{transform:`translate(-50%,-50%) rotate(${deg}deg) translateY(-150px)`, animation:'sparkFlicker 350ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
              ))}
            </div>
            <div className="absolute inset-0" style={{animation:'specialFlash 500ms ease-out infinite', background:'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%)'}}></div>
          </>
        )}
        {effect.imgUrl?(<img src={effect.imgUrl} alt="effect" style={{width:effect.type==='unique'?'180px':'150px',height:effect.type==='unique'?'180px':'150px',animation:effect.type==='unique'?'specialThrob 500ms ease-in-out infinite':undefined}} className={`mb-6 object-contain relative ${effect.type==='unique'?'drop-shadow-[0_0_45px_rgba(168,85,247,0.95)]':'drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]'}`}/>):(<div style={{fontSize:effect.type==='unique'?'128px':'112px',animation:effect.type==='unique'?'specialThrob 500ms ease-in-out infinite':undefined}} className="mb-6 relative">{effect.monEmoji}</div>)}
        <h2 className={`text-2xl font-black italic uppercase px-8 py-3 rounded-2xl border relative ${effect.type==='unique'?'text-purple-100 bg-purple-600/30 border-purple-400/60 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]':'text-white bg-white/10 border-white/20'}`}>{effect.label}</h2>
        {effect.subLabel&&<p className="text-indigo-400 font-mono text-[10px] mt-4 font-black whitespace-pre-line relative">{effect.subLabel}</p>}
        <div style={{fontSize:effect.type==='unique'?'60px':'48px'}} className="mt-8 animate-bounce relative">{effect.icon}</div>
      </div>)}
    </div>
  );
}

const createAnimationStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mh-anim-style')) return;
  const style = document.createElement('style');
  style.id = 'mh-anim-style';
  style.textContent = `
    @keyframes attackFly {
      0% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 6px rgba(250,204,21,0.5));
      }
      45% {
        transform: translateY(-180px) scale(1.35);
        filter: drop-shadow(0 0 20px rgba(250,204,21,0.9));
      }
      60% {
        transform: translateY(-180px) scale(1.35);
        filter: drop-shadow(0 0 25px rgba(220,38,38,1));
      }
      100% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    @keyframes zanComboDash {
      0% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 4px rgba(34,211,238,0.4));
      }
      18% {
        transform: translate(-100px,-14px) scale(1.08) skewX(18deg);
        filter: drop-shadow(48px 6px 0 rgba(34,211,238,0.35)) drop-shadow(84px 10px 0 rgba(34,211,238,0.16)) drop-shadow(0 0 14px rgba(34,211,238,0.9));
      }
      40% {
        transform: translate(150px,-8px) scale(1.15) skewX(-22deg);
        filter: drop-shadow(-70px -4px 0 rgba(34,211,238,0.32)) drop-shadow(-130px -8px 0 rgba(34,211,238,0.15)) drop-shadow(0 0 24px rgba(255,255,255,0.95));
      }
      58% {
        transform: translate(-70px,-4px) scale(1.1) skewX(14deg);
        filter: drop-shadow(36px 3px 0 rgba(34,211,238,0.28)) drop-shadow(0 0 20px rgba(34,211,238,0.9));
      }
      78% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 24px rgba(255,255,255,0.9));
      }
      100% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    @keyframes specialCharge {
      0% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 6px rgba(168,85,247,0.5)); }
      40% { transform: translateY(34px) scale(0.82) rotate(-3deg); filter: drop-shadow(0 0 16px rgba(168,85,247,0.9)); }
      100% { transform: translateY(44px) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
    }
    @keyframes skillNamePop {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes dragGrab {
      0% { transform: translate(-50%,-100%) scale(0.6); opacity: 0.4; }
      60% { transform: translate(-50%,-100%) scale(1.12); opacity: 1; }
      100% { transform: translate(-50%,-100%) scale(1); opacity: 1; }
    }
    @keyframes cardSnap {
      0% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
      100% { transform: translate(calc(-50% + var(--snapDX)), calc(-50% + var(--snapDY))) scale(0.35); opacity: 0; }
    }
    @keyframes slotSettle {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      65% { transform: scale(0.96); }
      100% { transform: scale(1); }
    }
    @keyframes setRing {
      0% { transform: scale(0.4); opacity: 0.9; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes setPop {
      0% { transform: scale(0); opacity: 0; }
      55% { transform: scale(1.25); opacity: 1; }
      80% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes guardShine {
      0% { transform: scale(0.4); opacity: 0; }
      30% { transform: scale(1.25); opacity: 1; }
      70% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes guardSpark {
      0% { transform: translateY(0) scale(0.3); opacity: 0; }
      40% { opacity: 1; }
      100% { transform: translateY(-140px) scale(1); opacity: 0; }
    }
    @keyframes guardFlash {
      0% { opacity: 0; }
      25% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes specialLunge {
      0% { transform: translateY(44px) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
      35% { transform: translateY(-220px) scale(1.5) rotate(4deg); filter: drop-shadow(0 0 34px rgba(217,70,239,1)); }
      55% { transform: translateY(-220px) scale(1.5); filter: drop-shadow(0 0 40px rgba(255,255,255,1)); }
      100% { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    /* アーク/イブリース専用モーション: ゆっくり宙に浮かび上がって漂い、最後に光が鋭く突き刺さる */
    @keyframes floatStabAttack {
      0%   { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 4px rgba(255,255,255,0.3)); }
      55%  { transform: translateY(-100px) scale(1.05) rotate(-3deg); filter: drop-shadow(0 0 14px rgba(255,255,255,0.7)); }
      70%  { transform: translateY(-104px) scale(1.05) rotate(3deg); filter: drop-shadow(0 0 18px rgba(255,255,255,0.85)); }
      85%  { transform: translateY(10px) scale(1.4) rotate(0deg); filter: drop-shadow(0 40px 10px rgba(253,224,71,1)) drop-shadow(0 0 40px rgba(255,255,255,1)); }
      100% { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    @keyframes floatStabLunge {
      0%   { transform: translateY(44px) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
      50%  { transform: translateY(-140px) scale(1.1) rotate(-2deg); filter: drop-shadow(0 0 24px rgba(255,255,255,0.8)); }
      65%  { transform: translateY(-146px) scale(1.1) rotate(2deg); filter: drop-shadow(0 0 30px rgba(255,255,255,0.9)); }
      85%  { transform: translateY(20px) scale(1.55) rotate(0deg); filter: drop-shadow(0 50px 12px rgba(253,224,71,1)) drop-shadow(0 0 60px rgba(255,255,255,1)); }
      100% { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    @keyframes enemyAttackFly {
      0% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 6px rgba(239,68,68,0.5));
      }
      45% {
        transform: translateY(90px) scale(1.18);
        filter: drop-shadow(0 0 20px rgba(239,68,68,0.9));
      }
      60% {
        transform: translateY(90px) scale(1.18);
        filter: drop-shadow(0 0 28px rgba(220,38,38,1));
      }
      100% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    @keyframes enemyMoveSlide {
      0% { transform: translateX(0) scale(1); }
      30% { transform: translateX(-70px) scale(0.95); }
      70% { transform: translateX(70px) scale(0.95); }
      100% { transform: translateX(0) scale(1); }
    }
    @keyframes enemyMoveSlideMoo {
      0% { transform: translate(0, 24px) scale(1); }
      30% { transform: translate(-90px, 24px) scale(0.97); }
      70% { transform: translate(90px, 24px) scale(0.97); }
      100% { transform: translate(0, 24px) scale(1); }
    }
    @keyframes exclaimPop {
      0% { transform: scale(0) translateY(8px) rotate(-12deg); opacity: 0; }
      55% { transform: scale(1.5) translateY(-4px) rotate(8deg); opacity: 1; }
      100% { transform: scale(1.15) translateY(0) rotate(0deg); opacity: 1; }
    }
    @keyframes shockRing {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(1.55); opacity: 0; }
    }
    @keyframes enemyExclaim {
      0%,100% { opacity: 1; }
    }
    @keyframes auraPulse {
      0% { transform: scale(0.85); opacity: 0.55; }
      50% { transform: scale(1.12); opacity: 0.95; }
      100% { transform: scale(0.85); opacity: 0.55; }
    }
    @keyframes auraRing {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes sparkFlicker {
      0%,100% { opacity: 0.2; transform: scale(0.8) rotate(var(--r,0deg)) translateY(clamp(-92px, -12dvh, -58px)); }
      50% { opacity: 1; }
    }
    @keyframes specialThrob {
      0%,100% { transform: scale(1); filter: drop-shadow(0 0 12px rgba(251,191,36,0.9)); }
      50% { transform: scale(1.25); filter: drop-shadow(0 0 22px rgba(239,68,68,1)); }
    }
    @keyframes idleExclaim {
      0%,100% { transform: scale(0.95) translateY(0) rotate(-4deg); opacity: 0.85; }
      50% { transform: scale(1.18) translateY(-3px) rotate(4deg); opacity: 1; }
    }
    @keyframes idleAuraPulse {
      0%,100% { transform: scale(0.92); opacity: 0.5; }
      50% { transform: scale(1.08); opacity: 0.85; }
    }
    @keyframes idleSpark {
      0%,100% { opacity: 0.15; }
      50% { opacity: 0.9; }
    }
    @keyframes specialShockwave {
      0% { transform: scale(0.4); opacity: 0.9; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes specialDangerPulse {
      0%,100% { opacity: 0.25; }
      50% { opacity: 0.7; }
    }
    @keyframes specialWarnFlash {
      0%,100% { opacity: 0.55; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.06); }
    }
    @keyframes mhRipple {
      0% { transform: scale(0.3); opacity: 0.55; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes moveDash {
      0% { transform: translateX(-40px) scale(0.7); opacity: 0; }
      40% { opacity: 1; }
      100% { transform: translateX(40px) scale(1.1); opacity: 0; }
    }
    @keyframes specialFlash {
      0%,100% { opacity: 0; }
      50% { opacity: 1; }
    }
    @keyframes mooFloat {
      0%,100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-12px) scale(1.03); }
    }
    @keyframes mooAttackLunge {
      0% { transform: translateY(0) scale(1); }
      18% { transform: translateY(-40px) scale(1.18) rotate(-3deg); }
      42% { transform: translateY(70px) scale(1.55) rotate(3deg); }
      58% { transform: translateY(45px) scale(1.42) rotate(-1deg); }
      78% { transform: translateY(20px) scale(1.2); }
      100% { transform: translateY(0) scale(1); }
    }
    @keyframes mooMoveSlide {
      0% { transform: translateX(0) scale(1); }
      25% { transform: translateX(-110px) scale(0.95) rotate(-2deg); }
      50% { transform: translateX(0) scale(0.92); }
      75% { transform: translateX(110px) scale(0.95) rotate(2deg); }
      100% { transform: translateX(0) scale(1); }
    }
    @keyframes screenShake {
      0%,100% { transform: translate(0,0); }
      10% { transform: translate(-6px,-4px); }
      20% { transform: translate(7px,3px); }
      30% { transform: translate(-8px,5px); }
      40% { transform: translate(6px,-6px); }
      50% { transform: translate(-5px,4px); }
      60% { transform: translate(7px,2px); }
      70% { transform: translate(-4px,-5px); }
      80% { transform: translate(5px,3px); }
      90% { transform: translate(-3px,2px); }
    }
    @keyframes mooQuake {
      0%,100% { transform: translate(0,0) scale(1); }
      8% { transform: translate(-16px,-10px) scale(1.015); }
      18% { transform: translate(18px,9px) scale(1.02); }
      28% { transform: translate(-20px,13px) scale(1.025); }
      38% { transform: translate(16px,-15px) scale(1.02); }
      48% { transform: translate(-14px,11px) scale(1.015); }
      58% { transform: translate(17px,7px) scale(1.01); }
      68% { transform: translate(-11px,-12px) scale(1.008); }
      80% { transform: translate(9px,6px) scale(1.004); }
      90% { transform: translate(-6px,4px) scale(1.002); }
    }
    .mh-scroll::-webkit-scrollbar { width: 6px; }
    .mh-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 9999px; }
    .mh-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 9999px; }
    .mh-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) rgba(255,255,255,0.05); }`;
  document.head.appendChild(style);
};
createAnimationStyle();


// ==== GitHub Pages 用: グローバルからReact/フックを取得してレンダリング ====
const rootEl = document.getElementById('root');
const _root = ReactDOM.createRoot(rootEl);
_root.render(React.createElement(MonsterHeroGame));

try {
  const l=document.getElementById('loading'); if(l) l.style.display='none';
  const b=document.getElementById('ver-banner'); if(b) b.style.display='none';
} catch(e){ window.__mhErr && window.__mhErr('render tail: '+e.message); }
