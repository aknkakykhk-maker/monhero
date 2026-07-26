
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
  Gem: '<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>',
  Package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>'
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
const Heart=_icon('Heart'), Zap=_icon('Zap'), Sword=_icon('Sword'), Shield=_icon('Shield'), X=_icon('X'), Award=_icon('Award'), Skull=_icon('Skull'), PlusCircle=_icon('PlusCircle'), Target=_icon('Target'), ShieldCheck=_icon('ShieldCheck'), Trophy=_icon('Trophy'), Timer=_icon('Timer'), Play=_icon('Play'), Sparkles=_icon('Sparkles'), Activity=_icon('Activity'), ChevronRight=_icon('ChevronRight'), Crown=_icon('Crown'), Edit3=_icon('Edit3'), ArrowLeft=_icon('ArrowLeft'), Search=_icon('Search'), Layers=_icon('Layers'), AlertCircle=_icon('AlertCircle'), Flag=_icon('Flag'), RotateCcw=_icon('RotateCcw'), MinusCircle=_icon('MinusCircle'), Star=_icon('Star'), Users=_icon('Users'), User=_icon('User'), Check=_icon('Check'), HelpCircle=_icon('HelpCircle'), BookOpen=_icon('BookOpen'), Info=_icon('Info'), RefreshCcw=_icon('RefreshCcw'), ArrowDownCircle=_icon('ArrowDownCircle'), Coins=_icon('Coins'), ShoppingBag=_icon('ShoppingBag'), Gem=_icon('Gem'), Package=_icon('Package');


// --- Helpers ---
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BUILD_DATE = "2026-07-27 14:30"; // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること

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
// そのレベルから次レベルに必要なXP(基準値)。指数を上げるほど高レベルが急に重くなる。
// 10WAVE完全クリアを1周=100XPとして、Lv30到達までの周回数は次のように緩和してきている。
//   指数1.8(当初)  … ブリーダー約580周 / 絆約410周
//   指数1.6         … ブリーダー約190周 / 絆約130周
//   指数1.4(現在)  … ブリーダー約56周  / 絆約35周
const XP_CURVE_EXPONENT = 1.4;
const xpForLevel = (level) => Math.round(50 * Math.pow(level, XP_CURVE_EXPONENT));
// 緩和前(指数1.8)の必要XPで求めたレベル。今回の緩和で上がったレベル分の
// ブリーダーポイントを一度だけ遡って配るための計算にのみ使う
const legacyLevelBefore160 = (totalXp, discount) => {
  let level = 1, xp = totalXp;
  for (let i = 0; i < 200; i++) {
    const need = Math.max(1, Math.round(50 * Math.pow(level, 1.8) * discount));
    if (xp < need) break;
    xp -= need; level++;
  }
  return level;
};
// --- ブリーダーレベル: 上がり方を緩和するため、必要XPを基準値から割り引く
// (バランス調整用の係数。小さくするほど上げやすい。後日調整しやすいようここに1箇所だけ置く。
// 0.25 → 0.15 → 0.08 と緩和してきている)
const BREEDER_XP_DISCOUNT = 0.08;
const xpForBreederLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * BREEDER_XP_DISCOUNT));
const levelInfo = (totalXp) => {
  let level = 1, xp = totalXp;
  for (let i = 0; i < 200; i++) {
    const need = xpForBreederLevel(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForBreederLevel(level) };
};
// --- マスモンの絆レベル: ブリーダーレベルより上げやすくするため、必要XPを基準値から大幅に割り引く
// (バランス調整用の係数。小さくするほど上げやすい。後日調整しやすいようここに1箇所だけ置く。
// 0.35 → 0.175 → 0.10 → 0.05 と緩和してきている。係数を下げると同じ絆経験値でも絆レベルが上がるため、
// レベルアップ時に配る強化ポイントが後追いにならないよう、読み込み時にreconcileMasuPointsで
// 必ず不足分を補填している)
const BOND_XP_DISCOUNT = 0.05;
const xpForBondLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * BOND_XP_DISCOUNT));
const bondLevelInfo = (totalXp) => {
  let level = 1, xp = totalXp;
  for (let i = 0; i < 200; i++) {
    const need = xpForBondLevel(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForBondLevel(level) };
};

// =====================================================================
// AUDIO: すべてオリジナル生成のBGM/SE (Tone.jsをCDNから動的読込)
// デフォルトは無音。ユーザーが音量ボタンを押すと有効化される。
// =====================================================================
const Audio_ = (() => {
  let Tone = null, ready = false, loading = null, started = false;
  let reverb = null, lead = null, arp = null, bass = null, bgmBus = null, seBus = null;
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
      bgmBus = new Tone.Gain(0.04).toDestination(); // BGM専用バス
      seBus = new Tone.Gain(1).toDestination(); // SE専用バス(BGMとは別ゲインなので互いの音量操作が影響しない)
      reverb = new Tone.Reverb({ decay: 2.4, wet: 0.22 }).connect(seBus); // SE用リバーブ
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
  // タブ切り替え/バックグラウンド化からの復帰時、iOS等のブラウザは AudioContext を自動的に
  // 止めることがあり、それを明示的に resume() しないと音が鳴らなくなったままになる。
  // ensure()内のTone.start()は初回アンロック用でstartedフラグにより一度しか呼ばれないため、
  // 復帰のたびに呼び直す必要がある(startedフラグ自体には触れないので初回アンロック挙動は変えない)
  //
  // 以前はここで「state === 'suspended' なら resume()」しか見ていなかったため、次の2点を
  // 取りこぼして「アプリを切り替えて戻ると音が消えたまま」になっていた。
  //  ① iOS SafariはWeb Audioが中断されると 'interrupted' という独自の状態になる。
  //    'suspended' との比較では引っかからず、resume()が一度も呼ばれない
  //  ② AudioContextが動き出しても、Tone.Transportは止まったままなのでBGMは無音のまま。
  //    現在の曲を組み直して鳴らし直す必要がある(SEは都度生成なのでcontextさえ戻れば鳴る)
  let pendingResume = false;
  const resumeIfNeeded = async () => {
    if (!Tone || !enabled) return;
    try {
      const ctx = Tone.context;
      if (ctx && ctx.state !== 'running') {
        try { await ctx.resume(); } catch (e) {}
        // Toneのラッパーが状態を取りこぼす場合に備え、生のAudioContextにも直接かける
        try { if (ctx.rawContext && ctx.rawContext.state !== 'running') await ctx.rawContext.resume(); } catch (e) {}
      }
      // ユーザー操作なしでは復帰を許さないブラウザ向けに、次のタップで1回だけ再試行する
      if (ctx && ctx.state !== 'running' && !pendingResume && typeof document !== 'undefined') {
        pendingResume = true;
        const retry = () => {
          document.removeEventListener('pointerdown', retry);
          document.removeEventListener('touchend', retry);
          pendingResume = false;
          resumeIfNeeded();
        };
        document.addEventListener('pointerdown', retry);
        document.addEventListener('touchend', retry);
        return;
      }
      // BGMが止まっていれば現在の曲を組み直す
      if (ready && currentKey && T[currentKey] && Tone.Transport.state !== 'started') {
        clearParts();
        buildLoop(T[currentKey]);
      }
    } catch (e) {}
  };

  // 0〜100(%)を-40dB〜0dB相当のゲイン(0=無音)へ線形マッピング。SEはseBus、BGMはbgmBusの
  // ゲインをそれぞれ個別に操作するため、片方を変えてももう片方の音量には影響しない
  // (以前はSE側をTone.Destination(全体マスター)で調整していたため、SEを変えるとBGMの
  // 音量まで一緒に変わってしまう不具合があった)
  const _gainFromPct = (pct) => pct <= 0 ? 0 : Math.pow(10, (-40 + (Math.min(100, pct) / 100) * 40) / 20);
  const setSeVolume = async (pct) => {
    await load();
    if (!Tone || !seBus) return;
    try { seBus.gain.rampTo(_gainFromPct(pct), 0.1); } catch (e) {}
  };
  const setBgmVolume = async (pct) => {
    await load();
    if (!Tone || !bgmBus) return;
    // BGMバスの実ゲインはクリップ回避のため最大0.65に抑える
    const gain = _gainFromPct(pct) * 0.65;
    try { bgmBus.gain.rampTo(gain, 0.1); } catch (e) {}
  };
  // iOS等のブラウザ音声ロック解除: ユーザー操作(スライダー等)の直後に1回だけ呼ぶ
  const unlock = async () => {
    if (enabled) return;
    await load();
    if (Tone) {
      try {
        const tb = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:0.005,decay:0.15,sustain:0.1,release:0.2}, volume: -6 }).connect(seBus);
        const now = Tone.now();
        tb.triggerAttackRelease('C5','8n', now);
        tb.triggerAttackRelease('G5','8n', now+0.12);
        setTimeout(()=>{ try{tb.dispose();}catch(e){} }, 800);
      } catch(e){}
    }
    await setEnabled(true);
  };

  const se = {
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
    enemyMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 }, volume: -14 }).connect(seBus); s.triggerAttackRelease('E4', '32n', t); s.triggerAttackRelease('B3', '16n', t + 0.06); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 400); },
    join: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.4 }, volume: -10 }).connect(reverb); const t = Tone.now(); const seq = [[0,'E5','8n'],[0.15,'G5','8n'],[0.3,'C6','8n'],[0.45,'E6','4n'],[0.45,'C6','4n'],[0.45,'G5','4n'],[0.8,'D6','8n'],[0.95,'E6','4n'],[0.95,'C6','4n'],[0.95,'G5','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1800); },
    victory: async () => { if (!enabled) return; await ensure(); if (!Tone) return; clearParts(); currentKey = null; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, volume: -19 }).connect(reverb); const vb = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -19 }).connect(seBus); const t = Tone.now(); const seq = [[0,'C5','8n'],[0,'E5','8n'],[0,'G5','8n'],[0.18,'C5','8n'],[0.18,'E5','8n'],[0.18,'G5','8n'],[0.36,'C5','8n'],[0.36,'E5','8n'],[0.36,'G5','8n'],[0.54,'G5','4n'],[0.54,'C6','4n'],[0.54,'E6','4n'],[0.9,'F5','8n'],[0.9,'A5','8n'],[1.08,'G5','8n'],[1.08,'B5','8n'],[1.26,'C6','2n'],[1.26,'E6','2n'],[1.26,'G6','2n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); [[0,'C3'],[0.54,'C3'],[0.9,'F2'],[1.08,'G2'],[1.26,'C3']].forEach(([tt, n]) => vb.triggerAttackRelease(n, '4n', t + tt)); setTimeout(() => { try { v.dispose(); vb.dispose(); } catch (e) {} }, 2600); },
    levelUp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -12 }).connect(reverb); const seq = [[0,'C5','16n'],[0.08,'E5','16n'],[0.16,'G5','16n'],[0.24,'C6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const sp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }, volume: -16 }).connect(reverb); sp.triggerAttackRelease('C6', '2n', t + 0.24); setTimeout(() => { try { v.dispose(); sp.dispose(); } catch (e) {} }, 1200); },
    // 合体演出用: 上昇アルペジオ→(両者が重なるタイミングで)ベルの一撃+きらめき和音の「ピカーン」
    fusion: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.5 }, volume: -10 }).connect(reverb); const seq = [[0,'C5','8n'],[0.12,'E5','8n'],[0.24,'G5','8n'],[0.36,'C6','8n'],[0.48,'E6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const bt = t + 0.6; const bell = new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.6, release: 0.3 }, harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 1.5, volume: -14 }).connect(reverb); bell.triggerAttackRelease('16n', bt); const sparkle = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 }, volume: -12 }).connect(reverb); ['C6','E6','G6','C7'].forEach((n, i) => sparkle.triggerAttackRelease(n, '8n', bt + i * 0.03)); setTimeout(() => { try { v.dispose(); bell.dispose(); sparkle.dispose(); } catch (e) {} }, 2200); }
  };

  return { playBGM, stopBGM, setEnabled, isEnabled, setSeVolume, setBgmVolume, unlock, resumeIfNeeded, se };
})();


const MOO_IMG = "";


// --- Game Data ---
const RANGE_LABELS = ["零", "近", "中", "遠"];
// モンスターごとの間合い(距離)適性。距離ラベル配列と同じ並び([零,近,中,遠])のグレードを
// distAptitude:['C','C','C','C'] の形でモンスターデータに持たせ、そのモンスターが
// 該当スロットで攻撃した時のダメージに以下の倍率を掛ける。値は今後モンスターごとに調整予定。
// グレード配列: 下から上へ。C(=0%)を基準にG~Sは±5%刻み、S以上(S+~M)は+2.5%刻みで頭打ちはM(+25%)
// マスモンの「染色もどき」: Canvas上でHSVを直接置き換える簡易パレットスワップ。
// 元絵の全色相を一律にずらすだけの処理のため、モンスターによって仕上がりの色味は変わる("もどき")
// 以前はCSSのgrayscale/sepia/hue-rotateを重ねる方式だったが、grayscale()が知覚輝度(赤や青は
// 暗く見える重み)で明度を潰すため、部位の元の色によって同じ「白」「黒」でも明るさがバラバラに
// なったり、色付きの部位が元の色相の名残でくすんで見えたりする不具合があった。
// 現在は各ピクセルをHSVに変換し、色相・彩度は狙った色に固定で置き換え、明度(v)だけは元の陰影を
// 保つように狙った範囲(vMin〜vMax)へ線形に写像する方式にして、元の色に関わらず安定した発色にしている。
const MASU_COLOR_TARGET = {
  red: { h: 355, s: 0.8, vMin: 0.35, vMax: 0.95 },
  orange: { h: 28, s: 0.85, vMin: 0.4, vMax: 0.98 },
  yellow: { h: 48, s: 0.85, vMin: 0.45, vMax: 1.0 },
  lime: { h: 78, s: 0.75, vMin: 0.4, vMax: 0.95 },
  green: { h: 135, s: 0.65, vMin: 0.35, vMax: 0.9 },
  teal: { h: 168, s: 0.6, vMin: 0.3, vMax: 0.85 },
  cyan: { h: 190, s: 0.7, vMin: 0.35, vMax: 0.95 },
  sky: { h: 200, s: 0.75, vMin: 0.4, vMax: 0.98 },
  blue: { h: 220, s: 0.75, vMin: 0.35, vMax: 0.95 },
  purple: { h: 265, s: 0.65, vMin: 0.3, vMax: 0.9 },
  magenta: { h: 300, s: 0.65, vMin: 0.35, vMax: 0.95 },
  pink: { h: 330, s: 0.65, vMin: 0.4, vMax: 0.98 },
  black: { h: 0, s: 0, vMin: 0.06, vMax: 0.32 },
  white: { h: 0, s: 0, vMin: 0.78, vMax: 1.0 },
  gray: { h: 0, s: 0, vMin: 0.5, vMax: 0.82 },
};
// 薄め(パステル)系: 彩度を抑えて明度レンジを底上げし、鮮やかな色よりふんわりした発色にする
['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'purple', 'magenta', 'pink'].forEach((k) => {
  const t = MASU_COLOR_TARGET[k];
  MASU_COLOR_TARGET[k + '_light'] = { h: t.h, s: t.s * 0.45, vMin: Math.min(0.6, t.vMin + 0.2), vMax: 1.0 };
});
const MASU_COLOR_LABELS = { red: '赤', orange: '橙', yellow: '黄', lime: '黄緑', green: '緑', teal: '青緑', cyan: 'シアン', sky: '空色', blue: '青', purple: '紫', magenta: 'マゼンタ', pink: 'ピンク', black: '黒', white: '白', gray: '薄灰', red_light: '薄赤', orange_light: '薄橙', yellow_light: '薄黄', lime_light: '薄黄緑', green_light: '薄緑', teal_light: '薄青緑', cyan_light: '薄水色', sky_light: '薄空色', blue_light: '薄青', purple_light: '薄紫', magenta_light: '薄マゼンタ', pink_light: '薄ピンク' };
const MASU_COLOR_SWATCH = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', lime: '#84cc16', green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4', sky: '#38bdf8', blue: '#3b82f6', purple: '#a855f7', magenta: '#d946ef', pink: '#ec4899', black: '#1f2937', white: '#f8fafc', gray: '#cbd5e1', red_light: '#fca5a5', orange_light: '#fdba74', yellow_light: '#fde047', lime_light: '#bef264', green_light: '#86efac', teal_light: '#5eead4', cyan_light: '#67e8f9', sky_light: '#7dd3fc', blue_light: '#93c5fd', purple_light: '#d8b4fe', magenta_light: '#f0abfc', pink_light: '#f9a8d4' };
// 「カスタム」色: プリセット18色に無い任意の色相・彩度・明度を選べるようにするため、
// 色id文字列自体に "custom:色相:彩度:明度"(彩度・明度は0-100の整数)を埋め込んでエンコードする。
// masu.colorsは元々ただの文字列配列なので、この方式ならデータモデルを変えずに保存できる
const _encodeCustomColorId = (h, s, v) => `custom:${Math.round(h)}:${Math.round(s * 100)}:${Math.round(v * 100)}`;
const _parseCustomColorId = (colorId) => {
  if (typeof colorId !== 'string' || !colorId.startsWith('custom:')) return null;
  const parts = colorId.slice(7).split(':').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const [h, s, v] = parts;
  return { h: Math.max(0, Math.min(360, h)), s: Math.max(0, Math.min(1, s / 100)), v: Math.max(0, Math.min(1, v / 100)) };
};
// プリセット色id・カスタム色idのどちらでも、染色エンジンが使う{h,s,vMin,vMax}形式に解決する
const _resolveColorTarget = (colorId) => {
  if (MASU_COLOR_TARGET[colorId]) return MASU_COLOR_TARGET[colorId];
  const custom = _parseCustomColorId(colorId);
  if (!custom) return null;
  // プリセットは狙った明度を中心に前後へ幅を持たせて元絵の陰影を残す(だいたい0.5〜0.6幅)ため、
  // カスタムも選んだ明度(v)を中心に同じくらいの幅を取ってレンジ化する
  const vMin = Math.max(0.05, custom.v - 0.32);
  const vMax = Math.min(1.0, Math.max(custom.v + 0.24, vMin + 0.2));
  return { h: custom.h, s: custom.s, vMin, vMax };
};
const getColorSwatchHex = (colorId) => {
  if (MASU_COLOR_SWATCH[colorId]) return MASU_COLOR_SWATCH[colorId];
  const custom = _parseCustomColorId(colorId);
  if (!custom) return '#64748b';
  const [r, g, b] = _hsvToRgb(custom.h, custom.s, Math.max(0.35, custom.v));
  return `rgb(${r},${g},${b})`;
};
// モンスター種ごとの「染色もどき」部位分割データ。各要素は画像内でその部位が持つ代表色相(度)。
// 事前にモンスター画像を解析して求めた、染色可能な部位ごとの判定条件。
// 各要素は次のいずれか:
//   数値(色相の角度)                    … その色相に最も近い彩度のあるピクセルを対象にする
//   {hue, vMin?, vMax?, sMin?, sMax?}     … 同じ色相でも明度・彩度が違う部位を区別したい場合(例: 体は明るい黄、目は暗い黄)
//   {hue, bbox?:[x0,y0,x1,y1]}           … 画像内の特定範囲(0〜1の相対座標)に絞って同じ色相の部位を区別したい場合
//   {white:true, sMax?, vMin?}           … 彩度が低い明るい部位(白目・白い毛など)を対象にする
//   {band:[y0,y1]}                       … 色を問わず、画像の縦位置(0〜1)だけで区切りたい場合(単色の直方体など)
//   [def, def, ...]                      … 上記のいずれかを複数並べ、いずれかにマッチすれば同じ1部位として扱う
//                                          (例: 色相の判定+離れた場所の白い部位を1つの染色枠にまとめたい場合)
// 配列が空/未定義のモンスターは部位分割が綺麗に取れなかった(単色に近い等)ため、従来通り全身一括の染色のみ対応。
const MASU_COLOR_REGION_HUES = {
  // 画像はダウンスケールせず元の解像度に近い状態のまま実装している。口ばし(染色③)は
  // 体との色相の距離が近い場面があり、色相判定だけだと輪郭がガビガビになっていたため、
  // 高解像度な元イラストにflood-fillを掛けて輪郭を実測し、行ごとにセグメント単位で
  // 矩形を積み重ねるposBboxに変更している
  Mocchi: [{ hue: 350, sMin: 0.08 }, { hue: 92, sMin: 0.2 }, { posBbox: [[0.4659,0.2797,0.5324,0.2831],[0.4538,0.2831,0.5436,0.2866],[0.4435,0.2866,0.5548,0.29],[0.4332,0.29,0.5281,0.2935],[0.5227,0.29,0.5651,0.2935],[0.422,0.2935,0.5754,0.2969],[0.5235,0.2935,0.572,0.2969],[0.4099,0.2969,0.5883,0.3003],[0.3919,0.3003,0.6021,0.3038],[0.3729,0.3038,0.6176,0.3072],[0.3506,0.3072,0.6426,0.3107],[0.3402,0.3107,0.6632,0.3141],[0.3342,0.3141,0.6675,0.3176],[0.3316,0.3176,0.6667,0.321],[0.6587,0.3176,0.6675,0.321],[0.3308,0.321,0.6667,0.3244],[0.3316,0.3244,0.6391,0.3279],[0.6346,0.3244,0.6658,0.3279],[0.3342,0.3279,0.615,0.3313],[0.6242,0.3279,0.6641,0.3313],[0.3368,0.3313,0.5815,0.3348],[0.5158,0.3313,0.6615,0.3348],[0.3402,0.3348,0.4369,0.3382],[0.564,0.3348,0.6572,0.3382],[0.3428,0.3382,0.6546,0.3417],[0.5537,0.3382,0.6555,0.3417],[0.3506,0.3417,0.6503,0.3451],[0.354,0.3451,0.6451,0.3485],[0.6337,0.3451,0.6434,0.3485],[0.3626,0.3485,0.6383,0.352],[0.3686,0.352,0.6305,0.3554],[0.6105,0.352,0.6228,0.3554],[0.3824,0.3554,0.615,0.3589],[0.5984,0.3554,0.6202,0.3589],[0.3953,0.3589,0.5987,0.3623],[0.5735,0.3589,0.6064,0.3623],[0.4151,0.3623,0.5711,0.3657],[0.5494,0.3623,0.584,0.3657],[0.4581,0.3657,0.5393,0.3666]], noAAGuard: true, noEdgeGuard: true }],
  // 2026年に新規イラストへ差し替え。体(明るい黄)と瞳(暗い黄褐色)は同じ色相のため、
  // 明度で明暗を分けて別部位にしている(白目・彩度の低い部分は染色対象外のまま)。
  // 画像はダウンスケールせず元の解像度に近い状態のまま実装している。口(染色③)は
  // 瞳の下に三日月形で見える部位。単純な色相の閾値スキャンだと、瞳の暗部が偶然
  // 同じ色相域に誤判定され口と瞳の間を橋渡しして瞳まで巻き込んでしまっていたため、
  // 口の左右それぞれから色距離ベースのflood-fillで輪郭を実測し、行ごとに(瞳を挟んだ
  // 左右を橋渡ししないよう)セグメント単位で矩形を積み重ねている
  Suezo: [{ hue: 45, sMin: 0.3, vMin: 0.55 }, { hue: 45, sMin: 0.3, vMax: 0.55 }, { posBbox: [[0.2799,0.4901,0.2922,0.4935],[0.2773,0.4935,0.293,0.497],[0.7078,0.4935,0.7236,0.497],[0.2764,0.497,0.293,0.5004],[0.7061,0.497,0.7262,0.5004],[0.2773,0.5004,0.2939,0.5039],[0.7044,0.5004,0.727,0.5039],[0.2816,0.5039,0.2956,0.5073],[0.7035,0.5039,0.7244,0.5073],[0.2825,0.5073,0.2991,0.5108],[0.7009,0.5073,0.7201,0.5108],[0.2833,0.5108,0.3025,0.5142],[0.6983,0.5108,0.7184,0.5142],[0.2833,0.5142,0.306,0.5177],[0.6949,0.5142,0.7167,0.5177],[0.2842,0.5177,0.3094,0.5211],[0.6914,0.5177,0.715,0.5211],[0.2859,0.5211,0.3137,0.5246],[0.688,0.5211,0.7132,0.5246],[0.2885,0.5246,0.3181,0.528],[0.6837,0.5246,0.7106,0.528],[0.2937,0.528,0.3224,0.5315],[0.6802,0.528,0.7063,0.5315],[0.298,0.5315,0.3258,0.5349],[0.6759,0.5315,0.7003,0.5349],[0.3032,0.5349,0.331,0.5384],[0.6716,0.5349,0.6951,0.5384],[0.3049,0.5384,0.3362,0.5418],[0.6673,0.5384,0.6925,0.5418],[0.3066,0.5418,0.3431,0.5453],[0.6621,0.5418,0.6899,0.5453],[0.3092,0.5453,0.3465,0.5487],[0.6569,0.5453,0.6882,0.5487],[0.3109,0.5487,0.3517,0.5522],[0.6509,0.5487,0.6865,0.5522],[0.3135,0.5522,0.3578,0.5557],[0.6448,0.5522,0.6848,0.5557],[0.3161,0.5557,0.3647,0.5591],[0.6388,0.5557,0.6822,0.5591],[0.3187,0.5591,0.3716,0.5626],[0.6319,0.5591,0.6796,0.5626],[0.3213,0.5626,0.3793,0.566],[0.6233,0.5626,0.677,0.566],[0.3239,0.566,0.388,0.5695],[0.6146,0.566,0.6753,0.5695],[0.3265,0.5695,0.3974,0.5729],[0.6034,0.5695,0.6718,0.5729],[0.329,0.5729,0.4112,0.5764],[0.5922,0.5729,0.6692,0.5764],[0.3325,0.5764,0.4225,0.5798],[0.5827,0.5764,0.6666,0.5798],[0.3351,0.5798,0.438,0.5833],[0.5646,0.5798,0.6632,0.5833],[0.3385,0.5833,0.4673,0.5867],[0.5447,0.5833,0.6606,0.5867],[0.342,0.5867,0.5553,0.5902],[0.5102,0.5867,0.6571,0.5902],[0.3454,0.5902,0.6511,0.5936],[0.5232,0.5902,0.6537,0.5936],[0.3498,0.5936,0.6502,0.5971],[0.3506,0.5971,0.6459,0.6005],[0.6362,0.5971,0.6459,0.6005],[0.3541,0.6005,0.6442,0.604],[0.6328,0.6005,0.6425,0.604],[0.3584,0.604,0.639,0.6074],[0.6284,0.604,0.6382,0.6074],[0.3636,0.6074,0.6347,0.6109],[0.3679,0.6109,0.6304,0.6143],[0.3713,0.6143,0.6261,0.6178],[0.3782,0.6178,0.6209,0.6212],[0.3843,0.6212,0.6157,0.6247],[0.3894,0.6247,0.6097,0.6281],[0.3955,0.6281,0.6037,0.6316],[0.5663,0.6281,0.6054,0.6316],[0.4024,0.6316,0.57,0.635],[0.5594,0.6316,0.5968,0.635],[0.4093,0.635,0.5614,0.6385],[0.5508,0.635,0.5898,0.6385],[0.4145,0.6385,0.5519,0.6419],[0.5016,0.6385,0.5829,0.6419],[0.4222,0.6419,0.5105,0.6454],[0.5025,0.6419,0.5778,0.6454],[0.4326,0.6454,0.5597,0.6488],[0.5085,0.6454,0.5691,0.6488],[0.4412,0.6488,0.5571,0.6523],[0.543,0.6488,0.5597,0.6523],[0.4533,0.6523,0.545,0.6557],[0.5292,0.6523,0.5484,0.6557],[0.4636,0.6557,0.5286,0.6592],[0.4964,0.6557,0.5346,0.6592]], noAAGuard: true, noEdgeGuard: true }],
  // ほぼ単色の岩肌のため色相だけでは部位を分けられないが、3部位に分けたいという要望を受け、
  // 位置だけで区切るposBbox(色を問わない)を使って両腕・両脚を強制的に別部位にした
  // (頭部・胴体は他のどのposBboxにも属さない残りとして自動的に染色①になる)
  Golem: [{ hue: 30, sMin: 0.08 }, { posBbox: [[0.0, 0.20, 0.30, 0.82], [0.70, 0.20, 1.0, 0.82]] }, { posBbox: [[0.0, 0.82, 1.0, 1.0]] }],
  // 2026年に新規イラストへ差し替え。全身の紫がかった青毛(染色①)、白い胸元・腹(染色②)、
  // 頭上の角(染色③、地味な差し色なので未設定時は染色①の色を引き継ぐ。MASU_COLOR_FALLBACK_REGION参照)
  // の3部位。新イラストはICON/IMGとも同じ構図(process-new-art.jsで正方形に統一済み)で作成しているため、
  // 旧イラストで必要だった部位ごとのサイズ別posBbox補正(MASU_COLOR_REGION_SIZE_OVERRIDES)は不要になった
  // 尻尾の先端が体本体と同じ青紫の色相ながら彩度が非常に低い(薄い水色寄りの陰影)ため、
  // bbox無しの白バケツだと尻尾まで白(染色②)に誤判定されてしまう。体の輪郭(尻尾を除く胴体・脚・顔)
  // の実測範囲にbboxを絞り、尻尾側は常に染色①(体の毛)のままになるようにしている
  Tiger: [{ hue: 235, sMin: 0.1, vMin: 0.3 }, { white: true, sMax: 0.16, vMin: 0.55, bbox: [0.05, 0.20, 0.63, 1.0] }, { hue: 38, sMin: 0.15 }],
  Ham: [25, { white: true, sMax: 0.35, vMin: 0.7 }, 355],
  // 2026年に新規イラスト(悪魔っ子)へ差し替え。染色②は要望により地肌(顔・腕・お腹・脚、
  // 彩度0.05〜0.15程度の低彩度)にした。髪・衣装(hue321〜350のグラデーション)は彩度が
  // ずっと高いため、白バケツ(染色②)とは彩度の閾値だけで衝突なく住み分けられる。
  // 翼は染色③(衣装)側の色相・彩度と近すぎるため、色を問わず位置で強制するposBboxにして
  // 衣装と同じ染色③にまとめている(でないと髪色/衣装色のどちらつかずで斑になる)
  Pixie: [{ hue: 321, sMin: 0.15, bbox: [0.25, 0.0, 0.75, 0.30] }, { white: true, sMax: 0.2, vMin: 0.6 }, [{ hue: 347, sMin: 0.15, bbox: [0.0, 0.28, 1.0, 1.0] }, { posBbox: [[0.02, 0.28, 0.30, 0.55], [0.68, 0.28, 0.98, 0.55]] }]],
  Monol: [{ band: [0, 1/3] }, { band: [1/3, 2/3] }, { band: [2/3, 1] }],
  // 花の中心(淡い黄色、hue50前後)は彩度が0.18前後あり白バケツ(sMax0.18)に入りきらず、
  // どの部位にも属さないまま常に無染色で残っていた(花びらだけ染まって中心だけ元の黄色が浮く)ため、
  // 花びらと同じ染色①にまとめて含めた
  Oboro: [[{ hue: 239 }, { hue: 50, sMax: 0.3, vMin: 0.8 }], { hue: 205 }, { white: true, sMax: 0.18, vMin: 0.85 }],
  // 2026年に新規イラストへ差し替え。ほぼ単色の甲殻(染色①)+赤い目(染色②、小さいのでsMinを
  // 上げて実測範囲のみ拾う)+両腕・翼(染色③、色相は本体とほぼ同じなので位置指定で分離)
  Zan: [{ hue: 232, sMin: 0.15 }, { hue: 2, sMin: 0.4 }, { posBbox: [[0.0, 0.30, 0.30, 0.88], [0.70, 0.30, 1.0, 0.88]] }],
  // 2026年に新規イラストへ差し替え。体(赤、染色①)・お腹/頭上クレスト/翼の金色(染色②)・
  // 口元(染色③)の3部位。
  // 以前は口元を位置だけで決めるposBboxで指定していたが、矩形を積み重ねた形が実際の口の輪郭と
  // 合っておらず、赤い頬まで青く塗り分けられて一番汚い見た目になっていた。
  // クレスト・お腹・翼・爪・口元はどれも同じ金色なので色相だけでは分けられないが、
  // 口元だけは頭部の中央(縦0.265〜0.40・横0.29〜0.71)に収まっているため、
  // 「金色」という色の条件に、口元とそれ以外を分けるbboxを組み合わせて切り分けている。
  // こうすると判定が実際の塗りの形に沿うので、赤い部分を巻き込むことがない
  // (元絵の実測値: 赤はS0.82〜0.91、金色はS0.40〜0.65、口元は縦0.265〜0.395の範囲)
  Mitarashi: [
    { hue: 0, sMin: 0.3 },
    { hue: 38, sMin: 0.25, bbox: [[0.15, 0.0, 0.85, 0.265], [0.0, 0.265, 0.29, 1.0], [0.71, 0.265, 1.0, 1.0], [0.29, 0.40, 0.71, 1.0]] },
    { hue: 38, sMin: 0.25, bbox: [0.29, 0.265, 0.71, 0.40], noEdgeGuard: true },
  ],
  Ark: [219, 187, [60, { white: true, sMax: 0.15, vMin: 0.85, bbox: [0.30, 0.56, 0.70, 0.79] }]],
  // 2026年に新規イラスト(羊の天使)へ差し替え。もふもふの白い毛(染色①)、紫のパーツ(染色②)、
  // 翼の黒(染色③)の3部位。元絵の実測値(高解像度版570px)に基づいて次のように切り分けている。
  //  ・白い毛: ほぼ白(彩度0.02)〜薄いピンク紫の影(色相295〜326・彩度0.06〜0.19・明度0.85以上)。
  //    彩度の上限を0.20にしてあるのは、体の下側の毛先の影(彩度0.156〜0.19)まで拾いつつ、
  //    お腹の模様の水色(彩度0.21)は拾わないようにするため。以前は0.15だったので毛先の影が
  //    どの部位にも属さず、染色したとき体の下側だけ元の色が残っていた
  //  ・紫のパーツ: 輪(色相281・彩度0.62)、耳と鼻(色相273・彩度0.49)、首元(色相278・彩度0.45)、
  //    顔・前足・後ろ足(色相263〜271・彩度0.26〜0.34・明度0.42〜0.51)、顔の輪郭線(明度0.2前後)。
  //    元絵では顔・前足・後ろ足はどれも同じ濃い紫で塗られているため、まとめて1部位にしている
  //  ・翼: 同じ紫系でも明度が0.17〜0.33と明確に暗い。明度の上限0.34で前足(明度0.44以上)と分かれる
  Iblis: [
    { white: true, sMax: 0.20, vMin: 0.80, bbox: [0.24, 0.14, 0.76, 0.82] },
    { hue: 272, sMin: 0.18, vMin: 0.15, bbox: [0.16, 0.13, 0.84, 0.82] },
    { white: true, sMax: 0.55, vMin: 0.05, vMax: 0.34, bbox: [[0.02, 0.42, 0.34, 0.80], [0.64, 0.42, 0.98, 0.80]] },
  ],
};
// 染色の対象外にする装飾(モンスター本体ではない背景の飾りなど)。ここに合致した画素はどの部位にも
// 属さないものとして扱い、常に元の絵のまま残す。MASU_COLOR_REGION_HUESは「どの部位か」しか表現できず
// 「そもそも染めない」を指定する手段が無かったため、背景の飾りが各部位のbboxの境目で矩形状に
// 分断されて塗り分けられてしまう不具合があった(イブリースの背景にある淡い紫の円)
const MASU_COLOR_EXCLUDE = {
  // イブリース: 右上にある淡い紫の円は背景の飾りなので染色しない。体の白い毛の影は
  // 色相295〜326のピンク寄りなのに対し、この円は色相245〜263の青寄りとはっきり分かれるため、
  // 色相と彩度・明度の組み合わせで確実に区別できる(bboxで円のある範囲にも絞っている)
  Iblis: [{ bbox: [0.63, 0.27, 0.88, 0.61], hue: [235, 278], sMin: 0.06, sMax: 0.24, vMin: 0.84 }],
};
// 画素(色相hh・彩度ss・明度vv・画像内の相対位置nx,ny)が染色対象外の装飾かどうかを判定する
const _isExcludedDyePixel = (baseId, hh, ss, vv, nx, ny) => {
  const rules = MASU_COLOR_EXCLUDE[baseId];
  if (!rules) return false;
  return rules.some((rule) => {
    if (rule.bbox && !_bboxMatches(rule.bbox, nx, ny)) return false;
    if (rule.hue && !(hh >= rule.hue[0] && hh <= rule.hue[1])) return false;
    if (rule.sMin !== undefined && ss < rule.sMin) return false;
    if (rule.sMax !== undefined && ss > rule.sMax) return false;
    if (rule.vMin !== undefined && vv < rule.vMin) return false;
    if (rule.vMax !== undefined && vv > rule.vMax) return false;
    return true;
  });
};
// 部位判定後の平滑化(ごま塩ノイズ除去)の強さをモンスターごとに調整するテーブル。
// 既定は半径2の多数決を1回。細かい毛並みの陰影で判定が激しく入れ替わるモンスターは
// radius/iterationsを上げて、小さな塊単位に均す(ただし小さな部位(目など)まで塗り潰さないよう
// 既定は控えめにしてあり、必要なモンスターだけ個別に強めている)。
// radiusは160px幅の画像を基準にしたピクセル半径として定義し、実際の画像幅に比例させて
// 換算する(高解像度画像に差し替えても毛並みノイズの見た目の粒の大きさに対して
// 常に同じ強さの平滑化がかかるようにするため)
// (イブリースは以前ここで半径3に強めていたが、羊毛のガビガビの原因は平滑化不足ではなく
//  白バケツ判定への色相境界除外の誤爆だった。そちらを直したことで既定の半径2で十分きれいに
//  なり、逆に半径3だとまつ毛のような小さな部位まで塗り潰されてしまうため個別指定を撤去した)
const MASU_COLOR_SMOOTH = {
  Tiger: { radius: 3, iterations: 1 },
};
const _getSmoothParams = (baseId, w) => {
  const base = MASU_COLOR_SMOOTH[baseId] || { radius: 2, iterations: 1 };
  const scale = w ? w / 160 : 1;
  return { radius: Math.max(1, Math.round(base.radius * scale)), iterations: base.iterations };
};
// モンスター種ごとに、ICON(128px)とIMG(160px)で構図(トリミング位置)が異なる場合の補正テーブル。
// 2026年の新規イラスト差し替え以降、新イラストはprocess-new-art.jsで両サイズとも同じ正規化座標(0〜1)に
// 統一して書き出しているため、現時点では補正が必要なモンスターは無い(空のまま維持)
const MASU_COLOR_REGION_SIZE_OVERRIDES = {};
// baseIdの部位定義を、実際に読み込んだ画像の幅wに応じて調整する(該当する上書きが無ければそのまま返す)
const _resolveRegionDefsForSize = (baseId, defs, w) => {
  const overrides = MASU_COLOR_REGION_SIZE_OVERRIDES[baseId] && MASU_COLOR_REGION_SIZE_OVERRIDES[baseId][w];
  if (!overrides) return defs;
  return defs.map((def, idx) => (overrides[idx] && def && typeof def === 'object') ? { ...def, ...overrides[idx] } : def);
};
// 染色もどきの色選択UIで見せる部位数(部位分割データが無いモンスターも全身一括の1枠は必ず出す)
const dyeRegionCount = (baseId) => { const hues = MASU_COLOR_REGION_HUES[baseId]; return (hues && hues.length > 0) ? hues.length : 1; };
const _rgbToHsv = (r,g,b) => {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), v=max, d=max-min;
  const s = max===0?0:d/max;
  let h=0;
  if (d!==0) {
    if (max===r) h = ((g-b)/d) % 6;
    else if (max===g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h *= 60; if (h<0) h += 360;
  }
  return [h,s,v];
};
const _hueDist = (a,b) => { const d = Math.abs(a-b) % 360; return d>180 ? 360-d : d; };
// HSV(色相0-360,彩度0-1,明度0-1) -> RGB(各0-255)。染色もどきの色置き換えで使う
const _hsvToRgb = (h,s,v) => {
  const c = v*s, x = c*(1-Math.abs((h/60)%2-1)), m = v-c;
  let r,g,b;
  if (h<60) [r,g,b]=[c,x,0];
  else if (h<120) [r,g,b]=[x,c,0];
  else if (h<180) [r,g,b]=[0,c,x];
  else if (h<240) [r,g,b]=[0,x,c];
  else if (h<300) [r,g,b]=[x,0,c];
  else [r,g,b]=[c,0,x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
};
// def.bboxが[x0,y0,x1,y1]なら単一の範囲、[[x0,y0,x1,y1],...]なら複数範囲のどれかに
// 入っていればtrue(離れた複数箇所(例:両耳と両前足)を1つの部位として扱いたい場合に使う)
const _bboxMatches = (bbox, nx, ny) => {
  const boxes = Array.isArray(bbox[0]) ? bbox : [bbox];
  return boxes.some(([x0, y0, x1, y1]) => nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1);
};
// regionDefsの1要素は数値/オブジェクトの他、配列(サブ定義の配列)も指定できる。配列にした場合は
// 「いずれかのサブ定義にマッチすればこの部位」という意味になる(例:色相の判定+別の白バケツ判定を
// 同じ染色枠にまとめたい場合。1要素=1部位という制約はそのままに、判定条件だけを複数持たせられる)
const _defAtoms = (def) => Array.isArray(def) ? def : [def];
// ピクセル(色相hh・彩度ss・明度vv・画像内の相対位置nx,ny)がregionDefs(MASU_COLOR_REGION_HUESの1モンスター分)の
// どの部位に属するかを判定し、インデックスを返す(どれにも属さなければ-1=無染色のまま)
const _classifyDyePixel = (hh, ss, vv, nx, ny, regionDefs) => {
  // 色を問わず位置だけで区切る部位(band=縦位置のみ、posBbox=矩形範囲(複数可))が
  // 定義されていれば最優先で判定する(耳と尻尾の先のように、色は共通しないが
  // まとめて1つの部位として選びたい離れた箇所を指定する場合などに使う)
  for (let idx = 0; idx < regionDefs.length; idx++) {
    for (const def of _defAtoms(regionDefs[idx])) {
      if (def && typeof def === 'object' && def.band) {
        const [y0, y1] = def.band;
        if (ny >= y0 && ny < y1) return idx;
      }
      if (def && typeof def === 'object' && def.posBbox && _bboxMatches(def.posBbox, nx, ny)) return idx;
    }
  }
  // 白系・黒系(彩度が低い)部位が定義されていれば次に判定する(vMaxも指定すれば暗い方の
  // 彩度の低いバケツ、例えば黒に近い羽など明度が低すぎて色相が不安定な部位も拾える)。
  // bboxを指定すれば、離れた場所にある似た彩度・明度の部位(例:顔は白いが背中の影も
  // たまたま彩度が低い、等)へ誤って広がらないよう、判定範囲を画像内の特定領域に絞れる
  for (let idx = 0; idx < regionDefs.length; idx++) {
    for (const def of _defAtoms(regionDefs[idx])) {
      if (def && typeof def === 'object' && def.white) {
        if (def.bbox && !_bboxMatches(def.bbox, nx, ny)) continue;
        if (ss <= (def.sMax ?? 0.18) && vv >= (def.vMin ?? 0.55) && vv <= (def.vMax ?? 1)) return idx;
      }
    }
  }
  // 明度が極端に低い(ほぼ黒)ピクセルは色相自体が不安定なので、white系バケツで拾えなかった分は対象外にする
  if (vv < 0.12) return -1;
  let best = -1, bestD = 999;
  regionDefs.forEach((rawDef, idx) => {
    for (const def of _defAtoms(rawDef)) {
      if (def && typeof def === 'object' && (def.white || def.band)) continue; // 上で判定済み
      if (def && typeof def === 'object' && def.posBbox && def.hue === undefined) continue; // 位置のみで判定する部位(色相を持たない)は上で判定済み
      if (def && typeof def === 'object' && def.bbox && !_bboxMatches(def.bbox, nx, ny)) continue;
      const hue = (typeof def === 'number') ? def : def.hue;
      const vMin = (def && typeof def === 'object') ? def.vMin : undefined;
      const vMax = (def && typeof def === 'object') ? def.vMax : undefined;
      // sMinは部位ごとに指定できる(既定0.18)。彩度の低いパステル調の部位を拾いたい場合はここを下げる
      const sMin = (def && typeof def === 'object' && def.sMin !== undefined) ? def.sMin : 0.18;
      const sMax = (def && typeof def === 'object') ? def.sMax : undefined;
      if (vMin !== undefined && vv < vMin) continue;
      if (vMax !== undefined && vv > vMax) continue;
      if (ss < sMin) continue;
      if (sMax !== undefined && ss > sMax) continue;
      // hueは単一の角度の他、配列で複数の色相をまとめて1部位として扱うこともできる
      // (例:本来離れた色相の部位(青い毛と黄色い角)を1つの染色枠にまとめたい場合)
      const d = Array.isArray(hue) ? Math.min(...hue.map(h => _hueDist(hh, h))) : _hueDist(hh, hue);
      if (d < bestD) { bestD = d; best = idx; }
    }
  });
  // 色相フォールバックには本来「近さ」の上限が無く、どの部位の色相からも遠いピクセル
  // (例: 花の黄色い中心が、定義済みの青系バケツへ強制的に割り当てられる等)まで
  // 無理やり最も近い部位に押し込まれ、染色時に浮いた色ムラの原因になっていた。
  // 明らかに違う色相(60°=オレンジ→黄のように「同系色」とみなせる範囲を超える)は
  // 無染色のまま(-1)残し、元の絵の色を保つようにする
  const MAX_HUE_MATCH_DIST = 60;
  return bestD <= MAX_HUE_MATCH_DIST ? best : -1;
};
// baseIdの画像をCanvasで解析し、部位ごとのアルファマスク(dataURL)を作って返す(同じbaseIdでも
// 画面によって表示に使う画像(iconUrl/imgUrl)が違うため、両方を含めたキーでキャッシュする)
const _dyeRegionMaskCache = {};
const getDyeRegionMasks = (baseId, imgUrl) => {
  const hues = MASU_COLOR_REGION_HUES[baseId];
  if (!hues || hues.length === 0) return null;
  const cacheKey = baseId + '::' + imgUrl;
  if (_dyeRegionMaskCache[cacheKey]) return _dyeRegionMaskCache[cacheKey];
  const promise = new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const regionDefs = _resolveRegionDefsForSize(baseId, hues, w);
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = w; srcCanvas.height = h;
          const srcCtx = srcCanvas.getContext('2d');
          if (!srcCtx) { resolve(null); return; }
          srcCtx.drawImage(img, 0, 0, w, h);
          const src = srcCtx.getImageData(0, 0, w, h).data;
          const maskCanvases = regionDefs.map(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
          const maskCtxs = maskCanvases.map(c => c.getContext('2d'));
          if (maskCtxs.some(c => !c)) { resolve(null); return; }
          const maskDatas = maskCtxs.map(ctx => ctx.createImageData(w, h));
          // 塗り分けの境目(色が隣接するピクセルとの間でにじむ部分)も誤判定しやすいため、
          // 先に全ピクセルの色相を計算しておき、隣接ピクセルと色相が大きく違う場所も除外する
          const hueMap = new Float32Array(w*h).fill(NaN);
          for (let i = 0; i < w*h; i++) {
            const o = i*4;
            if (src[o+3] < 20) continue;
            hueMap[i] = _rgbToHsv(src[o], src[o+1], src[o+2])[0];
          }
          const hueAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? NaN : hueMap[y*w+x];
          // 1パス目: 画素ごとに所属部位を判定してグリッド化する(-1=無染色のまま)
          const grid = new Int8Array(w*h).fill(-1);
          for (let i = 0; i < w*h; i++) {
            const o = i*4;
            const r = src[o], g = src[o+1], b = src[o+2], a = src[o+3];
            if (a < 20) continue;
            const x = i % w, y = (i / w) | 0;
            const [hh, ss, vv] = _rgbToHsv(r, g, b);
            // 背景の飾りなど、そもそも染色対象にしない画素はここで除外する
            if (_isExcludedDyePixel(baseId, hh, ss, vv, x / w, y / h)) continue;
            const region = _classifyDyePixel(hh, ss, vv, x / w, y / h, regionDefs);
            if (region < 0) continue;
            const def = regionDefs[region];
            // 輪郭線のうち実際に半透明でにじんでいる1px(自分自身の不透明度が低いピクセル)は
            // 色が正確でなく誤判定しやすいため、染色対象から除外し常に元の絵のまま残す。
            // 以前は「隣が透明に近いか」で判定していたため、体の輪郭を縁取る不透明な線画
            // (太さがあり色も正確)まで巻き込んで無染色のまま残ってしまい、染色後にモンスター
            // 元々の縁取り色だけが浮いて見える不具合があった。自分自身の不透明度で判定する
            // ことで、本当ににじんでいる最外周のみを除外し、輪郭線本体は正しく染色されるようにする。
            // ただし尻尾の先や小さな翼のように1〜2px幅しかない細い付属物は、全域が薄い不透明度に
            // なって丸ごと消えてしまうため、部位定義でnoAAGuard:trueを指定すればこの除外もスキップできる
            // (posBboxで位置を絞っているぶん、色のにじみを気にする理由がそもそも無い部位向け)
            const skipAAGuard = !!(def && typeof def === 'object' && def.noAAGuard);
            if (!skipAAGuard && a < 200) continue;
            // 塗り分けの境目(色が隣接するピクセルとの間でにじむ部分)も誤判定しやすいため、
            // 隣接ピクセルと色相が大きく違う場所は既定で除外する。ただし目のように細い部位は
            // 全域が境目になってしまい丸ごと消えるため、部位定義でnoEdgeGuard:trueを指定すれば
            // この除外をスキップできる。band/posBboxは色を見ずに位置だけで判定する部位なので、
            // 石材のようなノイズ質感がある絵だと隣接色相差の誤爆でごま塩状に穴が空きやすい。
            // 位置だけで確定している以上そもそも色境界を気にする必要がないため、既定で除外をスキップする。
            // 白バケツ(white:true)判定はそもそも彩度・明度だけで確定しており色相を見ていないため、
            // 白に近いピクセル同士でもRGBのわずかなノイズで色相が大きく暴れる(例:彩度0.13の
            // ほぼ白いピクセルが隣接ピクセルと色相が100°以上ズレる)性質があり、この色相差ベースの
            // 境界除外をそのまま当てはめると白い毛並みのテクスチャ線が無差別にごま塩状に無染色化されて
            // しまう(イブリースの羊毛でガビガビに見えていた主因)。白バケツ判定は自己のS/Vで既に
            // 確定しているため、こちらも既定で除外をスキップする
            const wantsEdgeGuard = !(def && typeof def === 'object' && (def.noEdgeGuard || def.posBbox || def.band || def.white));
            if (wantsEdgeGuard && ss >= 0.1 && vv >= 0.12) {
              let isColorEdge = false;
              for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
                const nh = hueAt(nx, ny);
                if (!Number.isNaN(nh) && _hueDist(hh, nh) > 35) { isColorEdge = true; break; }
              }
              if (isColorEdge) continue;
            }
            grid[i] = region;
          }
          // 2パス目: 毛並みなど細かい濃淡で判定がごま塩状に入れ替わる箇所を、
          // 周囲の多数決で均して滑らかな塊にする(境界のジグザグ自体は保つ)。
          // 強さ(半径・回数)はモンスターごとにMASU_COLOR_SMOOTHで調整
          const { radius, iterations } = _getSmoothParams(baseId, w);
          let smoothed = grid;
          for (let iter = 0; iter < iterations; iter++) {
            const next = new Int8Array(smoothed);
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = y*w + x;
                if (smoothed[i] < 0) continue;
                const counts = {};
                for (let dy = -radius; dy <= radius; dy++) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x+dx, ny = y+dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const nv = smoothed[ny*w+nx];
                    if (nv < 0) continue;
                    counts[nv] = (counts[nv] || 0) + 1;
                  }
                }
                let bestK = smoothed[i], bestC = -1;
                for (const k in counts) { if (counts[k] > bestC) { bestC = counts[k]; bestK = +k; } }
                next[i] = bestK;
              }
            }
            smoothed = next;
          }
          // 目のように面積が小さい部位(noEdgeGuardまたはposBboxで指定)は、周囲を広い部位(体など)に
          // 囲まれているため多数決の平滑化で塗り潰されて消えてしまうことがある。
          // そのため元の判定(1パス目の結果)を平滑化後に上書き復元し、確実に残す
          for (let i = 0; i < w*h; i++) {
            const orig = grid[i];
            if (orig < 0) continue;
            const def = regionDefs[orig];
            if (def && typeof def === 'object' && (def.noEdgeGuard || def.posBbox)) smoothed[i] = orig;
          }
          for (let i = 0; i < w*h; i++) {
            const best = smoothed[i];
            if (best < 0) continue;
            maskDatas[best].data[i*4+3] = src[i*4+3]; // マスクはアルファのみ使う(CSS maskとして重ねる)
          }
          const urls = maskCtxs.map((ctx, idx) => { ctx.putImageData(maskDatas[idx], 0, 0); return maskCanvases[idx].toDataURL(); });
          resolve(urls);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imgUrl;
    } catch (e) { resolve(null); }
  });
  _dyeRegionMaskCache[cacheKey] = promise;
  return promise;
};
// 光沢のあるグラデーション塗り(彩度の低いハイライト〜彩度の高い陰の帯で立体感を出す絵)を持つ
// モンスターの一覧。染色時に彩度を狙った値へ一律固定すると、このグラデーションが均一に塗り潰されて
// のっぺり・安っぽく見えてしまうため、該当モンスターだけ元の彩度分布に比例させて塗る(下記参照)
const MASU_COLOR_PRESERVE_GLOSS = { Ark: true, Tiger: true };
// ImageDataのピクセル配列(RGBA)を、指定した染色色idの狙った色相・彩度に置き換える(明度は元の陰影を保つ)
const _recolorImageData = (data, colorId, baseId) => {
  const t = _resolveColorTarget(colorId);
  if (!t) return;
  let satRef = 1;
  if (MASU_COLOR_PRESERVE_GLOSS[baseId]) {
    // 光沢グラデーションを保つモンスターは、画像全体の最大彩度を基準に各ピクセルの彩度を正規化する
    // (元絵の彩度が高い部分ほど狙った彩度に近づき、低いハイライト部分はより白っぽく残る)
    let maxS = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] < 10) continue;
      const s = _rgbToHsv(data[i], data[i+1], data[i+2])[1];
      if (s > maxS) maxS = s;
    }
    satRef = Math.max(maxS, 0.3);
  }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] < 10) continue;
    const [, ss, vv] = _rgbToHsv(data[i], data[i+1], data[i+2]);
    const newV = t.vMin + (t.vMax - t.vMin) * vv;
    const newS = MASU_COLOR_PRESERVE_GLOSS[baseId] ? t.s * Math.min(1, ss / satRef) : t.s;
    const [r, g, b] = _hsvToRgb(t.h, newS, newV);
    data[i] = r; data[i+1] = g; data[i+2] = b;
  }
};
// imgUrlの画像全体を指定色に染め直した画像をCanvasで生成し、dataURLで返す(色ごとにキャッシュ)
const _dyeRecolorCache = {};
const getRecoloredImage = (imgUrl, colorId, baseId) => {
  if (!_resolveColorTarget(colorId)) return null;
  const cacheKey = imgUrl + '::' + colorId;
  if (_dyeRecolorCache[cacheKey]) return _dyeRecolorCache[cacheKey];
  const promise = new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          _recolorImageData(imgData.data, colorId, baseId);
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL());
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imgUrl;
    } catch (e) { resolve(null); }
  });
  _dyeRecolorCache[cacheKey] = promise;
  return promise;
};
// 部位間の既定色フォールバック: 指定した部位が「元の色」(未設定)のとき、別の部位の色をそのまま
// 引き継いで表示する。ライガーは耳・尻尾の先端(染色③)が未設定なら本体(染色①)の色に自動で
// 追従するようにし、「染色①だけで耳まで含めた全身が染まる」→染色③は耳・尻尾だけを別の
// アクセント色にしたいときだけ使う任意スロット、という運用にする
const MASU_COLOR_FALLBACK_REGION = { Tiger: { 2: 0 } };
// マスモンの画像を、部位別の染色(masuColors配列)を反映して表示するコンポーネント。
// 部位分割データが無いモンスターは画像全体を染め直した1枚を表示する。
const DyedMonsterImage = ({ baseId, src, masuColors, alt, className, style, draggable }) => {
  const hues = MASU_COLOR_REGION_HUES[baseId];
  const [masks, setMasks] = useState(null);
  const [recolored, setRecolored] = useState({});
  const rawColors = masuColors || [];
  const fallbackMap = MASU_COLOR_FALLBACK_REGION[baseId];
  const colors = (fallbackMap && hues) ? hues.map((_, idx) => rawColors[idx] || (fallbackMap[idx] !== undefined ? rawColors[fallbackMap[idx]] : rawColors[idx])) : rawColors;
  const colorKey = colors.join('|');
  useEffect(() => {
    if (!hues || hues.length === 0 || !colors.some(Boolean)) { setMasks(null); return; }
    let cancelled = false;
    Promise.resolve(getDyeRegionMasks(baseId, src)).then(urls => { if (!cancelled) setMasks(urls); });
    return () => { cancelled = true; };
  }, [baseId, src, colorKey]);
  useEffect(() => {
    const wanted = Array.from(new Set(colors.filter(Boolean)));
    if (wanted.length === 0) { setRecolored({}); return; }
    let cancelled = false;
    Promise.all(wanted.map((c) => Promise.resolve(getRecoloredImage(src, c, baseId)).then((url) => [c, url])))
      .then((entries) => { if (!cancelled) setRecolored(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [src, colorKey]);
  if (!hues || hues.length === 0) {
    const recoloredSrc = colors[0] && recolored[colors[0]];
    return <img src={recoloredSrc || src} alt={alt} draggable={draggable} className={className} style={style}/>;
  }
  if (!masks || !colors.some(Boolean)) {
    return <img src={src} alt={alt} draggable={draggable} className={className} style={style}/>;
  }
  return (
    <div className={className} style={{...style, position:'relative', overflow:'hidden'}}>
      <img src={src} alt={alt} draggable={draggable} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'inherit'}}/>
      {hues.map((_, idx) => (colors[idx] && masks[idx] && recolored[colors[idx]]) ? (
        <img key={idx} src={recolored[colors[idx]]} alt="" draggable={false} style={{
          position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'inherit',
          WebkitMaskImage:`url(${masks[idx]})`, maskImage:`url(${masks[idx]})`,
          WebkitMaskSize:'100% 100%', maskSize:'100% 100%',
        }}/>
      ) : null)}
    </div>
  );
};
// 染色もどきの「カスタム」色選択: 色相バー(1本)+彩度・明度パッド(正方形)で任意の色を選べる
// 自前のスペクトラムピッカー。端末のOS標準カラーピッカー(<input type="color">)はiOS/Android/PCで
// 見た目も操作感もバラバラで、アプリのテーマにも合わせられず自動テストもできないため使わず、
// 既存のVolumeSliderと同じくpointerdown/move/upでドラッグを自前実装している
const CustomColorPicker = ({ h, s, v, onChange }) => {
  const squareRef = useRef(null);
  const hueRef = useRef(null);
  const [dragTarget, setDragTarget] = useState(null); // 'square'|'hue'|null
  const updateFromSquare = (clientX, clientY) => {
    const el = squareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ns = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    onChange(h, ns, nv);
  };
  const updateFromHue = (clientX) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nh = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    onChange(nh, s, v);
  };
  useEffect(() => {
    if (!dragTarget) return;
    const onMove = (e) => { if (dragTarget === 'square') updateFromSquare(e.clientX, e.clientY); else updateFromHue(e.clientX); };
    const onUp = () => setDragTarget(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragTarget, h, s, v]);
  const [pr, pg, pb] = _hsvToRgb(h, s, v);
  const previewColor = `rgb(${pr},${pg},${pb})`;
  const [hr, hg, hb] = _hsvToRgb(h, 1, 1);
  const pureHueColor = `rgb(${hr},${hg},${hb})`;
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={squareRef}
        onPointerDown={(e) => { setDragTarget('square'); updateFromSquare(e.clientX, e.clientY); }}
        className="relative w-full aspect-square rounded-2xl cursor-pointer touch-none overflow-hidden border border-white/10"
        style={{ backgroundColor: pureHueColor, backgroundImage: 'linear-gradient(to right, #fff, rgba(255,255,255,0)), linear-gradient(to top, #000, rgba(0,0,0,0))' }}
      >
        <div
          className="absolute rounded-full border-2 border-white shadow-[0_0_6px_rgba(0,0,0,0.8)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, width: '20px', height: '20px', transform: 'translate(-50%,-50%)', backgroundColor: previewColor }}
        ></div>
      </div>
      <div
        ref={hueRef}
        onPointerDown={(e) => { setDragTarget('hue'); updateFromHue(e.clientX); }}
        className="relative w-full h-6 rounded-full cursor-pointer touch-none"
        style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
      >
        <div
          className="absolute top-1/2 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_6px_rgba(0,0,0,0.8)]"
          style={{ left: `${(h / 360) * 100}%`, width: '18px', height: '18px', transform: 'translate(-50%,-50%)' }}
        ></div>
      </div>
    </div>
  );
};
// SE/BGM音量調整用スライダー(0〜100、ドラッグ操作+微調整用の±ボタン)
const VolumeSlider = ({ label, icon, value, onChange, onInteractStart, gradient, thumbRing }) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const valueFromClientX = (clientX) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return value;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => onChange(valueFromClientX(e.clientX));
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);
  const startDrag = (e) => {
    onInteractStart && onInteractStart();
    setDragging(true);
    onChange(valueFromClientX(e.clientX));
  };
  const step = (delta) => { onInteractStart && onInteractStart(); onChange(Math.max(0, Math.min(100, value + delta))); };
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-9 shrink-0 flex flex-col items-center gap-0.5">
        <span className="text-xs leading-none">{icon}</span>
        <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none">{label}</span>
      </div>
      <button onClick={()=>step(-1)} className="shrink-0 w-6 h-6 rounded-lg bg-slate-800 border border-white/10 text-slate-300 font-black text-xs active:scale-90 active:bg-slate-700 flex items-center justify-center select-none">−</button>
      <div ref={trackRef} onPointerDown={startDrag} className="relative flex-1 h-2 rounded-full bg-slate-800 border border-white/10 cursor-pointer touch-none">
        <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradient}`} style={{width:`${value}%`}}></div>
        <div className={`absolute top-1/2 rounded-full bg-white border-2 ${thumbRing} shadow-[0_0_6px_rgba(255,255,255,0.7)] transition-transform ${dragging?'scale-125':''}`} style={{left:`${value}%`, width:'14px', height:'14px', transform:'translate(-50%,-50%)'}}></div>
      </div>
      <button onClick={()=>step(1)} className="shrink-0 w-6 h-6 rounded-lg bg-slate-800 border border-white/10 text-slate-300 font-black text-xs active:scale-90 active:bg-slate-700 flex items-center justify-center select-none">＋</button>
      <span className="w-6 shrink-0 text-right text-[9px] font-mono font-black text-slate-300">{value}</span>
    </div>
  );
};
const DIST_APTITUDE_GRADES = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];
const DIST_APTITUDE_MULT = { G: 0.8, F: 0.85, E: 0.9, D: 0.95, C: 1.0, B: 1.05, A: 1.1, S: 1.15, 'S+': 1.175, SS: 1.2, 'SS+': 1.225, M: 1.25 };
const DIST_APTITUDE_COLOR = { S: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'S+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", SS: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'SS+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", M: "text-fuchsia-300 bg-gradient-to-br from-purple-950/70 to-pink-950/70 border-fuchsia-400/60", A: "text-red-400 bg-red-950/60 border-red-400/50", B: "text-pink-300 bg-pink-950/60 border-pink-400/50", C: "text-green-300 bg-green-950/60 border-green-400/50", D: "text-teal-300 bg-teal-950/60 border-teal-400/50", E: "text-cyan-300 bg-cyan-950/60 border-cyan-400/50", F: "text-purple-300 bg-purple-950/60 border-purple-400/50", G: "text-slate-400 bg-slate-800/60 border-slate-500/50" };
// 強化ポイント1つあたりのステータス上昇量。ライフだけ他より大きく上がる(バランス調整中の暫定値)
// 更新履歴のうち一番新しいエントリの日時。未読(NEW)判定の基準にする。
// data/changelog.js に追記すればこの値が自動的に新しくなり、NEWマークが復活する
const CHANGELOG_LATEST = (typeof CHANGELOG !== 'undefined' && CHANGELOG.length) ? CHANGELOG[0].date : '';
// 不具合情報タブに出す状態バッジの見た目
const CHANGELOG_STATUS = {
  fixed:         { label: '修正済み', cls: 'bg-emerald-900/70 text-emerald-300 border-emerald-500/50' },
  investigating: { label: '調査中',   cls: 'bg-amber-900/70 text-amber-300 border-amber-500/50' },
  known:         { label: '判明済み', cls: 'bg-slate-800 text-slate-300 border-slate-500/50' },
};
const STAT_POINT_GAIN = { hp: 10, atk: 3, def: 3, guts: 3 };
// 間合い適性のグレードを「Cを±0とした段階数」に直す(A→+2、E→-2)。
// 合流ボーナスでは、この段階数をプラスマイナス問わずそのまま勇者モンの適性に足す
const APT_NEUTRAL_INDEX = DIST_APTITUDE_GRADES.indexOf('C');
const aptGradeToDelta = (grade) => {
  const idx = DIST_APTITUDE_GRADES.indexOf(grade);
  return idx < 0 ? 0 : idx - APT_NEUTRAL_INDEX;
};
// モンスター(素の種・マスモン反映後のどちらでも可)の4距離分の適性段階数を返す
// 合流ボーナス欄に出す間合い適性の加算表示(例: 「接近+2 中距離-1」)。加算が無ければ空文字
const formatAptBonus = (mon) => getMonsterAptDelta(mon)
  .map((d, i) => d !== 0 ? `${RANGE_LABELS[i]}${d > 0 ? '+' : ''}${d}` : null)
  .filter(Boolean).join(' ');
const getMonsterAptDelta = (mon) => {
  const apt = (mon && mon.distAptitude) || ['C','C','C','C'];
  return [0,1,2,3].map(i => aptGradeToDelta(apt[i] || 'C'));
};
// マスモンが「これまでに得たはずの強化ポイント総数」は絆レベル-1で決まる。
// 使用済み(間合い適性・ステータス強化に振った分)と未使用の合計がこれを下回っていたら、
// 不足分を未使用ポイントとして補填したマスモンを返す。
//
// 必要経験値の緩和(BOND_XP_DISCOUNTの引き下げ)を行うと、同じ絆経験値のまま絆レベルだけが
// 上がるため、レベルアップ時に配っている強化ポイントが後追いで配られず
// 「絆レベル8なのにポイントが4しかない」という食い違いが起きていた。
// 読み込み時にここを通すことで、過去の緩和分も今後の調整分も自動的に辻褄が合う。
const reconcileMasuPoints = (masu) => {
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  if (!base) return masu;
  const baseApt = base.distAptitude || ['C','C','C','C'];
  const aptSpent = (masu.distApt || baseApt).reduce((sum, g, i) => sum + Math.max(0, DIST_APTITUDE_GRADES.indexOf(g) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])), 0);
  const statSpent = Object.entries(masu.statPoints || {}).reduce((sum, [key, val]) => sum + Math.ceil((val || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  const earned = Math.max(0, bondLevelInfo(masu.bondXp || 0).level - 1);
  const missing = earned - (aptSpent + statSpent + (masu.distAptPoints || 0));
  return missing > 0 ? { ...masu, distAptPoints: (masu.distAptPoints || 0) + missing } : masu;
};
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
  // 次のレベルまで残り何XPかの表示。バーの伸び(pct)と同じタイミングで切り替える
  const [remain, setRemain] = useState(Math.max(0, levelBefore.xpForNext - levelBefore.xpIntoLevel));
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timers = [];
    if (leveledUp) {
      timers.push(setTimeout(() => setPct(100), 200));
      timers.push(setTimeout(() => { Audio_.se.levelUp(); setFlash(true); }, 900));
      timers.push(setTimeout(() => { setFlash(false); setCurLevel(levelAfter.level); setPct(0); setRemain(levelAfter.xpForNext); }, 2000));
      timers.push(setTimeout(() => { setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))); setRemain(Math.max(0, levelAfter.xpForNext - levelAfter.xpIntoLevel)); }, 2100));
    } else {
      timers.push(setTimeout(() => { setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))); setRemain(Math.max(0, levelAfter.xpForNext - levelAfter.xpIntoLevel)); }, 200));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="font-mono text-slate-300 font-bold">LV.{curLevel}</span>
        {flash ? <span className="text-amber-400 font-black animate-pulse">LEVEL UP!</span> : <span className="text-slate-500 font-mono">次Lvまで{remain.toLocaleString()}</span>}
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
      {summary.allyBondGains && summary.allyBondGains.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-[10px] text-pink-300 font-black flex items-center gap-1"><Heart size={10}/>仲間の絆経験値</div>
          {summary.allyBondGains.map((a, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-slate-300 font-bold truncate">{a.name}</span>
                <span className="text-white font-mono font-bold shrink-0">+{a.xpGain.toLocaleString()}</span>
              </div>
              <LevelGrowthBar levelBefore={a.levelBefore} levelAfter={a.levelAfter}/>
              {a.levelAfter.level > a.levelBefore.level && (
                <div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{a.levelAfter.level - a.levelBefore.level}</div>
              )}
            </div>
          ))}
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
  const [slotUniqueChoice, setSlotUniqueChoice] = useState({}); // スロットidx→選択中の固有技キー('own'または'inh0'等)。合体で引き継いだ固有技をバトル中に切り替えるための選択状態
  const [slotUniqueLevelChoice, setSlotUniqueLevelChoice] = useState({}); // スロットidx→選択中の固有技レベル(0〜評価上限)。未指定(undefined)ならそのモンスターの現在の強化到達レベル(最大)を使う
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
  const [skillPicker, setSkillPicker] = useState(null); // {handIndex} 技名タップで開く、通常技/距離技/固有技の選択タイル一覧
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
  // 合流ボーナスとして加算される間合い適性の段階数(距離ごと)。供モンが合流するたびに、
  // そのモンスターの適性値(Cを±0とした段階数)をプラスマイナス問わずそのまま足し込む
  const [distAptBonus, setDistAptBonus] = useState([0,0,0,0]);
  const [totalDistDamage, setTotalDistDamage] = useState([0,0,0,0]); // cumulative per-distance damage across all waves
  const [totalAllDamage, setTotalAllDamage] = useState(0); // cumulative damage across all waves
  const [totalRecoveryDelta, setTotalRecoveryDelta] = useState(0); // cumulative recovery-rate correction across all waves
  const [waveResult, setWaveResult] = useState(null);
  const [breederName, setBreederName] = useState('名無しのブリーダー');
  const [breederXp, setBreederXp] = useState(0); // 累計経験値(WAVEクリア数ベース・端末保存)
  const [gold, setGold] = useState(0); // 累計ゴールド(WAVEクリア数ベース・端末保存)
  // マスモン: 勇者モンに選んだモンスターをラン終了時に名前を付けて登録した、固有の育成インスタンス。
  // { id, baseId(元のモンスター種id), name, bondXp, distAptPoints(未使用の強化ポイント),
  //   distApt:[g0,g1,g2,g3](このマスモン専用の間合い適性), statPoints:{hp,atk,def,guts}, color(染色もどきで変えた色id、無ければnull), createdAt }
  const [masuMons, setMasuMons] = useState([]);
  const [ownedItems, setOwnedItems] = useState({}); // マーケットで買った消耗アイテムの所持数 { itemId: count } (端末保存)
  const [pendingItemUse, setPendingItemUse] = useState(null); // アイテム欄で「使う」を押した後、対象のマスモンを選ぶ画面用(itemId)
  const [dyeTargetMasuId, setDyeTargetMasuId] = useState(null); // 染色もどき: 対象に選んだマスモンid(色選択モーダル表示のトリガー)
  const [dyePreviewColors, setDyePreviewColors] = useState([]); // 染色もどき: 確定前にプレビュー中の部位別色id配列(染色①②③)
  const [customColorPicker, setCustomColorPicker] = useState(null); // 染色もどき: カスタム色選択中の{idx,h,s,v}(nullなら非表示)
  const [showMasuRegisterModal, setShowMasuRegisterModal] = useState(false); // ラン終了画面: マスモン登録の名前入力
  const [masuNameInput, setMasuNameInput] = useState('');
  const [masuRegisteredThisRun, setMasuRegisteredThisRun] = useState(false); // 今回のランで既に登録済みか(二重登録防止)
  const [masuMonDetail, setMasuMonDetail] = useState(null); // マスモン一覧: タップ中のマスモン詳細
  const [masuEnhanceFrom, setMasuEnhanceFrom] = useState(null); // マスモン強化ページを開く直前のgameState(戻る先。masuMonDetailはROSTER等の複数画面から開けるため)
  const [showMasuRenameModal, setShowMasuRenameModal] = useState(false);
  const [masuRenameInput, setMasuRenameInput] = useState('');
  // 合体: マスモン同士を合体させ、副の絆経験値を主に受け継ぐ機能。fusionStepで画面内の段階を管理する
  const [fusionStep, setFusionStep] = useState('main'); // 'main'|'sub'|'confirm'|'anim'|'result'
  const [fusionMainId, setFusionMainId] = useState(null); // 主として選んだマスモンid
  const [fusionSubId, setFusionSubId] = useState(null); // 副として選んだマスモンid(合体後に消滅する)
  const [fusionInheritUnique, setFusionInheritUnique] = useState(false); // 副の固有技を引き継ぐか(絆Lv10以上同士のみ選択可)
  const [fusionAnimPhase, setFusionAnimPhase] = useState(0); // 合体演出の進行段階(0=開始前,1=接近,2=フラッシュ)
  const [fusionResultData, setFusionResultData] = useState(null); // 演出後の結果画面表示用スナップショット
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
  // モンスター一覧系画面(編成・ベースモン一覧・マスモン一覧)共通のソート・表示設定。3画面で共有する
  const [monsterSortKey, setMonsterSortKey] = useState('lineage'); // 'base'|'masu'|'lineage'|'bond'|'name'|'active'
  const [monsterSortDir, setMonsterSortDir] = useState('asc'); // 'asc'|'desc'
  const [monsterDisplayFlags, setMonsterDisplayFlags] = useState({ base: true, masu: true, fused: true, active: true }); // 各カードに出す情報(複数選択可、オフで非表示)
  const [showSortFilterModal, setShowSortFilterModal] = useState(false); // ならべかえ・表示設定モーダルの開閉
  const [sortFilterModalTab, setSortFilterModalTab] = useState('sort'); // モーダル内タブ: 'sort'|'display'
  const [sortFilterModalSingleType, setSortFilterModalSingleType] = useState(false); // ベースモン一覧/マスモン一覧から開いた場合true(種別チップを出さない)
  const [draftTeachingRoster, setDraftTeachingRoster] = useState([]); // 編成画面での仮選択(決定を押すまでteachingRosterIdsには反映しない)
  const [rosterDetailMon, setRosterDetailMon] = useState(null); // 編成画面: 長押しで詳細表示中のモンスター
  const [rosterDetailTeaching, setRosterDetailTeaching] = useState(null); // 編成画面: 長押しで詳細表示中のブリーダーカード
  const [rosterSkillDetail, setRosterSkillDetail] = useState(null); // モンスタープロフィール: タップ中の技(通常技/固有技)のレベル別詳細 {mon,kind}
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
  const [showChangelog, setShowChangelog] = useState(false); // 更新履歴モーダルの表示状態
  const [changelogTab, setChangelogTab] = useState('update'); // 'update'=更新情報 / 'issue'=不具合情報
  const [changelogSeen, setChangelogSeen] = useState(''); // 最後に更新履歴を開いたときの、最新エントリの日時(端末に保存)
  // 履歴を開いた時点の既読日時。開くと同時に既読を更新するため、そのまま比較すると
  // 表示中にNEWバッジが消えてしまう。開いている間はこちらを基準にバッジを出す
  const [changelogSeenAtOpen, setChangelogSeenAtOpen] = useState('');
  const [seVolume, setSeVolumeState] = useState(70); // SE音量 0〜100(端末に保存、初期値は読み込み後に上書き)
  const [bgmVolume, setBgmVolumeState] = useState(70); // BGM音量 0〜100(同上)
  const [audioUnlocked, setAudioUnlocked] = useState(false); // ブラウザの自動再生制限解除のため、スライダー等の操作を1回行うまでfalse
  const [showAudioSettings, setShowAudioSettings] = useState(false); // 音量設定モーダルの表示状態
  const audioOn = audioUnlocked;
  const setSeVolumeRaw = (nv) => { setSeVolumeState(nv); storeSet('mh_se_volume', nv, false); };
  const setBgmVolumeRaw = (nv) => { setBgmVolumeState(nv); storeSet('mh_bgm_volume', nv, false); };
  // 音量スライダー操作時に呼ぶ: 未解除ならブラウザの音声ロックを解除しつつ値を保存する
  const changeSeVolume = (v) => { const nv = Math.max(0, Math.min(100, v)); setSeVolumeRaw(nv); if (!audioUnlocked) { setAudioUnlocked(true); Audio_.unlock(); } };
  const changeBgmVolume = (v) => { const nv = Math.max(0, Math.min(100, v)); setBgmVolumeRaw(nv); if (!audioUnlocked) { setAudioUnlocked(true); Audio_.unlock(); } };
  const audioMuted = !audioOn || (seVolume === 0 && bgmVolume === 0);
  // ミュート解除時に設定する音量。以前は「ミュート直前の音量」に戻していたが、
  // いきなり大きな音が鳴って驚くため、必ず最小値の1から始めてスライダーで
  // 好みの大きさまで上げてもらう方式にした(設定パネル・バトル画面どちらのボタンでも同じ)
  const UNMUTE_VOLUME = 1;
  // バトル画面などスペースが限られる場所向けの1タップミュート切替(詳細な音量調整は設定パネルのスライダーで行う)
  const toggleQuickMute = () => {
    if (audioMuted) {
      changeSeVolume(UNMUTE_VOLUME);
      changeBgmVolume(UNMUTE_VOLUME);
    } else {
      changeSeVolume(0);
      changeBgmVolume(0);
    }
  };
  const breederLevel = levelInfo(breederXp);
  // マスモン関連のヘルパー。絆レベル・間合い適性・ステータス強化ポイントは、すべてマスモン
  // インスタンス(masuMons内の1件)に紐づく。プレーンな(マスモン化していない)モンスター種には
  // 絆レベルの概念自体が存在しない
  const getMasuMon = (masuId) => masuMons.find(m => m.id === masuId) || null;
  // マスモンの染色データを部位別配列で返す。旧仕様(単一色のcolorフィールド)しか無いデータは
  // 染色①に割り当てて読み替える(染色もどきの部位別対応より前に染色していた分を引き継ぐ)
  const getMasuColors = (masu) => (masu && masu.colors) || (masu && masu.color ? [masu.color] : []);
  const getMasuBondLevel = (masuId) => bondLevelInfo(getMasuMon(masuId)?.bondXp || 0);
  // モンスター詳細画面(rosterDetailMon/currentPickingMon/マスモン一覧)共通: 絆レベルとその進捗ゲージを表示。
  // masuIdが無い(=まだマスモン化していない)場合は何も表示しない
  const bondGaugeNode = (masuId) => {
    if (!masuId) return null;
    const lvl = getMasuBondLevel(masuId);
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
  // mon引数は素のモンスター種、またはresolveRosterEntryToMonで解決済みのマスモン反映後オブジェクトのどちらもあり得る。
  // どちらの場合もmon.distAptitudeを見るだけでよい(マスモンの場合はresolve時にdistApt配列が既に反映されている)
  const getDistAptitude = (mon, slotIdx) => {
    if (!mon) return 'C';
    const grade = (mon.distAptitude && mon.distAptitude[slotIdx]) || 'C';
    const shift = (distAptBonus && distAptBonus[slotIdx]) || 0;
    if (!shift) return grade;
    const idx = DIST_APTITUDE_GRADES.indexOf(grade);
    if (idx < 0) return grade;
    return DIST_APTITUDE_GRADES[Math.max(0, Math.min(DIST_APTITUDE_GRADES.length - 1, idx + shift))];
  };
  // 更新履歴に未読があるか。data/changelog.js に追記すると CHANGELOG_LATEST が新しくなるため、
  // 既読日時と一致しなくなり自動的にNEWマークが復活する
  const hasUnreadChangelog = !!CHANGELOG_LATEST && changelogSeen !== CHANGELOG_LATEST;
  // 更新履歴を開く。開いた時点で最新エントリの日時を既読として保存する
  const openChangelog = () => {
    setChangelogTab('update');
    setChangelogSeenAtOpen(changelogSeen);
    setShowChangelog(true);
    if (CHANGELOG_LATEST && changelogSeen !== CHANGELOG_LATEST) {
      setChangelogSeen(CHANGELOG_LATEST);
      storeSet('mh_changelog_seen', CHANGELOG_LATEST, false);
    }
  };
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

  // SE/BGMそれぞれの音量をAudioエンジンへ反映
  useEffect(() => { Audio_.setSeVolume(seVolume); }, [seVolume]);
  useEffect(() => { Audio_.setBgmVolume(bgmVolume); }, [bgmVolume]);

  // 新バージョン検知: ホーム画面アプリ/背面タブ復帰時は自動再読み込みされず古いバージョンの
  // ままタップしても反応しないように見える不具合が繰り返し報告されたため、version.jsonを
  // 頻繁に確認しBUILD_DATEと異なれば更新バナーを出す。さらに、ページを開いた直後(まだ
  // ゲーム進行中でなく再読み込みしても損失が無いタイミング)に限っては、バナーのタップ待ちにせず
  // 自動でリロードして常に最新版に揃える(タップし忘れて古いまま使い続けてしまう問題への対策)
  useEffect(() => {
    let isFirstCheck = true;
    const checkVersion = async () => {
      const wasFirstCheck = isFirstCheck;
      isFirstCheck = false;
      try {
        const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.build && data.build !== BUILD_DATE) {
          if (wasFirstCheck) window.location.reload();
          else setUpdateAvailable(true);
        }
      } catch {}
    };
    checkVersion();
    const onVisible = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    const interval = setInterval(checkVersion, 2 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pageshow', onVisible); clearInterval(interval); };
  }, []);

  // タブ切り替え/バックグラウンド化から復帰した際、OSにより自動停止されたAudioContextと
  // BGMのTransportを復帰させる(そのままだとBGM/SEが鳴らなくなったままになる不具合の対策)。
  // visibilitychangeだけだと、PWAをホーム画面から開き直した場合やアプリ切り替えで
  // 戻った場合に発火しないことがあるため、pageshow/focusでも復帰を試みる
  useEffect(() => {
    const tryResume = () => { if (document.visibilityState !== 'hidden') Audio_.resumeIfNeeded(); };
    document.addEventListener('visibilitychange', tryResume);
    window.addEventListener('pageshow', tryResume);
    window.addEventListener('focus', tryResume);
    return () => {
      document.removeEventListener('visibilitychange', tryResume);
      window.removeEventListener('pageshow', tryResume);
      window.removeEventListener('focus', tryResume);
    };
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

  // 合体演出: anim段階に入ったら接近→マージ→フラッシュの順で進行し、最後に結果画面へ遷移する
  useEffect(() => {
    if (fusionStep !== 'anim') return;
    setFusionAnimPhase(1);
    const timers = [
      setTimeout(() => setFusionAnimPhase(2), 700),
      setTimeout(() => setFusionAnimPhase(3), 1300),
      setTimeout(() => setFusionStep('result'), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [fusionStep]);

  // Load saved data
  useEffect(() => {
    (async () => {
      const savedSeVolume = await storeGet('mh_se_volume', 70, false);
      setSeVolumeState(savedSeVolume);
      const savedBgmVolume = await storeGet('mh_bgm_volume', 70, false);
      setBgmVolumeState(savedBgmVolume);
      const savedName = await storeGet('mh_breeder_name', '名無しのブリーダー', false);
      setBreederName(savedName);
      const savedIcon = await storeGet('mh_breeder_icon', null, false);
      setBreederIcon(savedIcon);
      const savedXp = await storeGet('mh_breeder_xp', 0, false);
      setBreederXp(savedXp);
      const savedGold = await storeGet('mh_gold', 0, false);
      setGold(savedGold);
      // 旧仕様(モンスター種ごとの絆レベル)。マスモン導入により廃止済みだが、既存プレイヤーの
      // 育成データをマスモンへ1回だけ移行するために読み込む(このデータ自体はstateとして保持しない)
      const savedBondXp = await storeGet('mh_bond_xp', {}, false);
      const savedAptPoints = await storeGet('mh_dist_apt_points', {}, false);
      const savedAptOverrides = await storeGet('mh_dist_apt_overrides', {}, false);
      let savedMasuMons = await storeGet('mh_masu_mons', [], false);
      // マスモン移行: 旧仕様(モンスター種ごとの絆レベル)で貯まっていた絆経験値・強化ポイント・
      // 間合い適性を、種の名前を初期名としたマスモンへ1回だけ自動移行する
      // (既存プレイヤーがそれまで育てていた絆レベルの進捗を消してしまわないため)
      const masuMigrated = await storeGet('mh_masu_migrated', false, false);
      if (!masuMigrated) {
        const migrated = [];
        Object.keys(savedBondXp).forEach(monId => {
          if ((savedBondXp[monId] || 0) <= 0) return;
          const base = ALL_PLAYER_MONSTERS[monId];
          if (!base) return;
          migrated.push({
            id: 'masu_migrated_' + monId,
            baseId: monId,
            name: base.name,
            bondXp: savedBondXp[monId] || 0,
            distAptPoints: savedAptPoints[monId] || 0,
            distApt: savedAptOverrides[monId] ? [...savedAptOverrides[monId]] : [...(base.distAptitude || ['C','C','C','C'])],
            statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
            createdAt: Date.now(),
          });
        });
        if (migrated.length) {
          savedMasuMons = [...savedMasuMons, ...migrated];
          await storeSet('mh_masu_mons', savedMasuMons, false);
        }
        await storeSet('mh_masu_migrated', true, false);
      }
      // 絆レベルに対して強化ポイントが不足しているマスモンがあれば、ここで不足分を補填する
      // (必要経験値を緩和した際、レベルだけ上がってポイントが配られないまま残っていた分の救済)
      const reconciledMasuMons = savedMasuMons.map(reconcileMasuPoints);
      if (reconciledMasuMons.some((m, i) => m !== savedMasuMons[i])) {
        savedMasuMons = reconciledMasuMons;
        await storeSet('mh_masu_mons', savedMasuMons, false);
      }
      setMasuMons(savedMasuMons);
      let savedPoints = await storeGet('mh_breeder_points', 0, false);
      // ブリーダーポイントは「これまでに配った総数」を別に保存しておき、
      // 本来配られているはずの数(ブリーダーレベル-1)との差額を読み込みのたびに補填する。
      // 必要経験値を緩和するとレベルだけが上がってポイントが後追いにならないため
      // (絆レベル側で実際に起きていた食い違いと同じ問題)、この方式で自動的に辻褄を合わせる。
      const pointsMigrated = await storeGet('mh_points_migrated', false, false);
      let grantedPoints = await storeGet('mh_breeder_points_granted', null, false);
      const expectedPoints = Math.max(0, levelInfo(savedXp).level - 1);
      if (!pointsMigrated) {
        // ブリーダーポイント導入前からのプレイヤー: 既存レベル分(Lv-1)を一度だけ遡って付与
        savedPoints += expectedPoints;
        grantedPoints = expectedPoints;
        await storeSet('mh_points_migrated', true, false);
      } else if (grantedPoints === null) {
        // ポイント導入後・今回の必要経験値の緩和より前からのプレイヤー:
        // 緩和前の計算式で求めたレベル分までは配布済みとみなす(差額は下で補填される)
        grantedPoints = Math.max(0, legacyLevelBefore160(savedXp, 0.25) - 1);
      }
      if (expectedPoints > grantedPoints) {
        savedPoints += expectedPoints - grantedPoints;
        grantedPoints = expectedPoints;
      }
      await storeSet('mh_breeder_points_granted', grantedPoints, false);
      // 更新履歴の既読日時(未読があればトップの更新履歴ボタンにNEWマークを出す)
      setChangelogSeen(await storeGet('mh_changelog_seen', '', false));
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
      const savedOwnedItems = await storeGet('mh_owned_items', {}, false);
      setOwnedItems(savedOwnedItems);
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
    // マスモン(絆レベルを持つ育成済みインスタンス)で編成していた場合、ランキング表示にも絆レベルを出せるよう記録する。
    // 表示名はマスモンの個体名(ブリーダーが自由につけた名前)ではなく、血統(種族)の名前を使う
    const party = slots.map(s => s ? { name: ALL_PLAYER_MONSTERS[s.id]?.name || s.name, emoji: s.emoji, imgUrl: s.imgUrl || null, bondLevel: s.masuId ? getMasuBondLevel(s.masuId).level : null } : null);
    const name = breederName || '名無しのブリーダー';
    const heroName = (mainHero && (ALL_PLAYER_MONSTERS[mainHero.id]?.name || mainHero.name)) || 'Unknown';
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

  // 編成の1枠(monsterRosterIdsの要素)を、実際に使えるモンスターオブジェクトに変換する。
  // 通常は素のモンスター種idの文字列だが、"masu:<masuId>"の形式ならマスモンインスタンスを指す。
  // マスモンの場合、表示名をマスモン名に差し替え、ステータス強化ポイント・間合い適性を反映した
  // オブジェクトを返す(idは元のモンスター種idのまま保つ。mainHero?.id==='Golem'等の特性判定を壊さないため)
  // マスモンインスタンスに、種の基礎データ(ALL_PLAYER_MONSTERS)とstatPointsによる強化分を
  // 合成した「モンスターらしいオブジェクト」を作る。resolveRosterEntryToMon(id経由)と、
  // spendAptPoint/spendStatPointが返す最新のマスモンをその場で反映したい場面(PICK_ALLYモーダルの
  // 再同期など)の両方から使う共通ロジック
  const mergeMasuIntoMon = (masu) => {
    const base = ALL_PLAYER_MONSTERS[masu.baseId];
    if (!base) return null;
    const sp = masu.statPoints || {};
    return {
      ...base,
      masuId: masu.id,
      masuName: masu.name,
      name: masu.name,
      baseHp: base.baseHp + (sp.hp || 0),
      baseAtk: base.baseAtk + (sp.atk || 0),
      baseDef: base.baseDef + (sp.def || 0),
      baseGuts: base.baseGuts + (sp.guts || 0),
      plusStats: {
        hp: (base.plusStats?.hp || 0) + (sp.hp || 0),
        atk: (base.plusStats?.atk || 0) + (sp.atk || 0),
        def: (base.plusStats?.def || 0) + (sp.def || 0),
        guts: (base.plusStats?.guts || 0) + (sp.guts || 0),
      },
      distAptitude: masu.distApt || base.distAptitude,
      colors: getMasuColors(masu),
      inheritedUniques: masu.inheritedUniques || [],
    };
  };
  const resolveRosterEntryToMon = (entry) => {
    if (typeof entry === 'string' && entry.startsWith('masu:')) {
      const masu = getMasuMon(entry.slice(5));
      if (!masu) return null;
      return mergeMasuIntoMon(masu);
    }
    return ALL_PLAYER_MONSTERS[entry] || null;
  };
  // 編成の1枠が対象とする「モンスター種id」を返す(プレーン種でもマスモンでも、種としては同じ扱い)
  const baseIdOfRosterEntry = (entry) => {
    if (typeof entry === 'string' && entry.startsWith('masu:')) return getMasuMon(entry.slice(5))?.baseId || null;
    return entry;
  };
  // モンスター一覧系画面(編成/ベースモン一覧/マスモン一覧)共通のソートキー定義とラベル
  const MONSTER_SORT_OPTIONS = [
    { key: 'base', label: 'ベースモン' },
    { key: 'masu', label: 'マスモン' },
    { key: 'lineage', label: '血統' },
    { key: 'bond', label: '絆レベル' },
    { key: 'name', label: '名前' },
    { key: 'active', label: '編成中' },
    { key: 'fused', label: '合体済み' },
  ];
  const MONSTER_DISPLAY_OPTIONS = [
    { key: 'base', label: 'ベースモン' },
    { key: 'masu', label: 'マスモン' },
    { key: 'fused', label: '合体済み' },
    { key: 'active', label: '編成中' },
  ];
  // 「ベースモン(未マスモン化の種)」「マスモン(育成済み個体)」を1つの配列に統一して扱うための変換。
  // activeIdsには現在編成に入っている種id/'masu:'付きidの配列を渡す(画面によって draftMonsterRoster か
  // 確定済みの monsterRosterIds かが変わる)
  const buildUnifiedMonsterEntries = (baseIds, masuList, activeIds) => {
    const baseEntries = baseIds.map(id => {
      const base = ALL_PLAYER_MONSTERS[id];
      if (!base) return null;
      return { type: 'base', key: id, entryId: id, baseId: id, base, masu: null, name: base.name, lineageName: base.name, bondLevel: null, active: activeIds.includes(id), fusionCount: 0 };
    }).filter(Boolean);
    const masuEntries = masuList.map(masu => {
      const base = ALL_PLAYER_MONSTERS[masu.baseId];
      if (!base) return null;
      const entryId = 'masu:' + masu.id;
      return { type: 'masu', key: entryId, entryId, baseId: masu.baseId, base, masu, name: masu.name, lineageName: base.name, bondLevel: bondLevelInfo(masu.bondXp || 0).level, active: activeIds.includes(entryId), fusionCount: (masu.fusionHistory||[]).length };
    }).filter(Boolean);
    return [...baseEntries, ...masuEntries];
  };
  const sortMonsterEntries = (entries) => {
    const dirMul = monsterSortDir === 'desc' ? -1 : 1;
    const sorted = [...entries].sort((a, b) => {
      let cmp = 0;
      if (monsterSortKey === 'base') cmp = (a.type === 'base' ? 0 : 1) - (b.type === 'base' ? 0 : 1);
      else if (monsterSortKey === 'masu') cmp = (a.type === 'masu' ? 0 : 1) - (b.type === 'masu' ? 0 : 1);
      else if (monsterSortKey === 'lineage') cmp = a.lineageName.localeCompare(b.lineageName, 'ja');
      else if (monsterSortKey === 'bond') cmp = (a.bondLevel ?? -1) - (b.bondLevel ?? -1);
      else if (monsterSortKey === 'name') cmp = a.name.localeCompare(b.name, 'ja');
      else if (monsterSortKey === 'active') cmp = (a.active ? 0 : 1) - (b.active ? 0 : 1);
      else if (monsterSortKey === 'fused') cmp = (a.fusionCount || 0) - (b.fusionCount || 0);
      if (cmp === 0) cmp = a.lineageName.localeCompare(b.lineageName, 'ja');
      return cmp * dirMul;
    });
    return sorted;
  };
  // 表示設定の4つのチェック(ベースモン/マスモン/合体済み/編成中)は、どれか1つでも該当すれば
  // 表示する独立したOR条件として扱う(例: ベースモン・マスモンを両方オフにして合体済みだけ
  // オンにすると、種別に関わらず合体済みのモンスターだけが絞り込まれる)。
  // 以前は種別(base/masu)しか見ていなかったため、合体済み・編成中のチェックが実質無視され、
  // 種別を両方オフにすると何も表示されなくなる不具合があった
  const monsterEntryMatchesDisplayFlags = (e, flags) =>
    !!flags[e.type] || (!!flags.fused && (e.fusionCount || 0) > 0) || (!!flags.active && !!e.active);
  // モンスター一覧・マスモン一覧・編成画面のソート/表示設定つき一覧は、画面を開くたび・
  // 無関係な状態更新のたびに毎回全件ソートし直すと重くなり(タップ反応が悪くなる原因の一つ)、
  // useMemoで実際に関係する値が変わった時だけ計算し直すようにする
  const unifiedMonsterEntriesActive = useMemo(
    () => sortMonsterEntries(buildUnifiedMonsterEntries(unlockedMonsterIds, masuMons, monsterRosterIds)).filter(e => monsterEntryMatchesDisplayFlags(e, monsterDisplayFlags)),
    [unlockedMonsterIds, masuMons, monsterRosterIds, monsterSortKey, monsterSortDir, monsterDisplayFlags]
  );
  const unifiedMonsterEntriesDraft = useMemo(
    () => sortMonsterEntries(buildUnifiedMonsterEntries(unlockedMonsterIds, masuMons, draftMonsterRoster)).filter(e => monsterEntryMatchesDisplayFlags(e, monsterDisplayFlags)),
    [unlockedMonsterIds, masuMons, draftMonsterRoster, monsterSortKey, monsterSortDir, monsterDisplayFlags]
  );
  // ソート/表示設定の起動バー(編成/ベースモン一覧/マスモン一覧で使い回す)。
  // 以前は横スクロールの小さいチップを並べていたがタップしづらいという指摘を受け、
  // ボタン1つでフルスクリーンの選択モーダル(showSortFilterModal)を開く方式に変更した。
  // singleType=trueの画面(ベースモン一覧・マスモン一覧)では、種別が固定で意味を持たない
  // 「ベースモン」「マスモン」の選択肢をモーダル側で出さない(編成画面のみ両方混在するため出す)
  // ※コンポーネント本体の中でJSXコンポーネント(<MonsterSortFilterBar/>)として定義すると、
  // 親が再レンダリングされるたびに毎回「新しい型」とみなされてDOMごと作り直され(アンマウント→再マウント)、
  // その直下の一覧(モンスターグリッド)がタップの瞬間にレイアウトごと組み直されてタップが取りこぼされる
  // 不具合の原因になっていたため、あえて通常の関数として呼び出す形にしている(コンポーネント境界を作らない)
  const renderMonsterSortFilterBar = ({ singleType } = {}) => {
    const sortOpts = singleType ? MONSTER_SORT_OPTIONS.filter(o => o.key !== 'base' && o.key !== 'masu') : MONSTER_SORT_OPTIONS;
    const dispOpts = singleType ? MONSTER_DISPLAY_OPTIONS.filter(o => o.key !== 'base' && o.key !== 'masu') : MONSTER_DISPLAY_OPTIONS;
    const currentSortOpt = sortOpts.find(o => o.key === monsterSortKey) || sortOpts[0];
    const activeDisplayCount = dispOpts.filter(o => monsterDisplayFlags[o.key]).length;
    const openModal = (tab) => { setSortFilterModalSingleType(!!singleType); setSortFilterModalTab(tab); setShowSortFilterModal(true); };
    return (
      <div className="mb-2 shrink-0 flex gap-2">
        <button onClick={() => openModal('sort')} style={{minHeight:'40px'}} className="flex-1 min-w-0 flex items-center justify-between gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 active:scale-95">
          <span className="text-[11px] font-black text-white truncate">並べかえ: {currentSortOpt?.label}{monsterSortKey === currentSortOpt?.key && <span>{monsterSortDir === 'asc' ? '▲' : '▼'}</span>}</span>
          <ChevronRight size={14} className="text-slate-500 shrink-0"/>
        </button>
        <button onClick={() => openModal('display')} style={{minHeight:'40px'}} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 active:scale-95">
          <span className="text-[11px] font-black text-white">表示設定</span>
          <span className="text-[9px] text-teal-400 font-black">{activeDisplayCount}</span>
          <ChevronRight size={14} className="text-slate-500 shrink-0"/>
        </button>
      </div>
    );
  };
  // 現在の周回で使う候補モンスター/ブリーダーカード(編成で選んだもの)。空の場合は解放済み全体にフォールバック
  const getActiveMonsterList = () => {
    const list = monsterRosterIds.map(resolveRosterEntryToMon).filter(Boolean);
    return list.length > 0 ? list : Object.values(ALL_PLAYER_MONSTERS).filter(m => unlockedMonsterIds.includes(m.id));
  };
  const getActiveTeachingCards = () => {
    const list = TEACHING_CARDS.filter(t => teachingRosterIds.includes(t.id));
    return list.length > 0 ? list : TEACHING_CARDS.filter(t => unlockedTeachingIds.includes(t.id));
  };

  // マーケットアイテムが購入済み(=解放済み)かどうか。typeによって参照する解放リストが異なる。
  // type:'item'の消耗品は何度でも買えるため、常にfalse(所持数はownedItemsで別途表示)
  const isMarketItemOwned = (item) => {
    if (item.type === 'disc') return unlockedMonsterIds.includes(item.id);
    if (item.type === 'breeder') return unlockedTeachingIds.includes(item.id);
    if (item.type === 'item') return false;
    return ownedMarketIcons.includes(item.id);
  };

  // ブリーダーマーケットでアイテムを購入。アイコンはpt、円盤石/ブリーダー/消耗品はゴールドを消費し、
  // 種別ごとの解放リストに追加(端末保存)。円盤石/ブリーダーは解放と同時に編成へも自動追加する
  const buyMarketItem = (item) => {
    if (item.available === false) return; // 実装準備中のアイテムは購入不可
    if (isMarketItemOwned(item)) return;
    const usesGold = item.type === 'disc' || item.type === 'breeder' || item.type === 'item';
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
    } else if (item.type === 'item') {
      setOwnedItems(prev => { const next = { ...prev, [item.id]: (prev[item.id] || 0) + 1 }; storeSet('mh_owned_items', next, false); return next; });
    } else {
      setOwnedMarketIcons(prev => { const next = [...prev, item.id]; storeSet('mh_market_icons', next, false); return next; });
    }
  };

  // 編成画面: 解放済みモンスター/ブリーダーカードの中から、次回以降の周回で使う候補を仮選択する。
  // 仮選択は自由に増減でき、「決定」を押してモンスター8体・ブリーダーカード6枚ちょうどの時だけ確定保存する。
  // モンスターは同じ種(baseId)につき1枠のみ選べるため、プレーン種・マスモンを問わず同じ種の
  // 別の候補を選ぶと、既に選択中だった同じ種の候補は自動的に選択解除される
  const toggleDraftMonster = (entry) => {
    setDraftMonsterRoster(prev => {
      if (prev.includes(entry)) return prev.filter(x => x !== entry);
      const base = baseIdOfRosterEntry(entry);
      const withoutSameBase = prev.filter(x => baseIdOfRosterEntry(x) !== base);
      return [...withoutSameBase, entry];
    });
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

  // マスモンの強化ポイントを1消費し、対象の距離の間合い適性を1段階上げる。
  // 更新後のマスモンを同期的に返す(呼び出し側がPICK_ALLYモーダルのスナップショットである
  // currentPickingMonをその場で再同期できるようにするため。setMasuMonsは非同期反映のため
  // 直後にmasuMonsを読み直しても古い値のままになってしまう)
  const spendAptPoint = (masuId, slotIdx) => {
    const masu = getMasuMon(masuId);
    if (!masu || (masu.distAptPoints || 0) <= 0) return null;
    const current = (masu.distApt && masu.distApt[slotIdx]) || 'C';
    const idx = DIST_APTITUDE_GRADES.indexOf(current);
    if (idx < 0 || idx >= DIST_APTITUDE_GRADES.length - 1) return null; // 既にM(上限)
    const nextGrade = DIST_APTITUDE_GRADES[idx + 1];
    const distApt = [...(masu.distApt || ['C','C','C','C'])];
    distApt[slotIdx] = nextGrade;
    const updatedMasu = { ...masu, distApt, distAptPoints: (masu.distAptPoints || 0) - 1 };
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? updatedMasu : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    Audio_.se.tap();
    return updatedMasu;
  };
  // マスモンの強化ポイントを1消費し、対象のステータスを1上げる(バランス調整前の暫定仕様: 1pt=+1)
  const STAT_POINT_KEYS = { hp: 'ライフ', atk: 'ちから', def: '丈夫さ', guts: 'ガッツ' };
  // spendAptPointと同様、更新後のマスモンを同期的に返す
  const spendStatPoint = (masuId, statKey) => {
    const masu = getMasuMon(masuId);
    if (!masu || (masu.distAptPoints || 0) <= 0) return null;
    if (!STAT_POINT_KEYS[statKey]) return null;
    const statPoints = { ...(masu.statPoints || {}) };
    statPoints[statKey] = (statPoints[statKey] || 0) + (STAT_POINT_GAIN[statKey] || 1);
    const updatedMasu = { ...masu, statPoints, distAptPoints: (masu.distAptPoints || 0) - 1 };
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? updatedMasu : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    Audio_.se.tap();
    return updatedMasu;
  };
  // 強化ポイントリセットの書: 使用済みの強化ポイント(間合い適性・ステータス強化)をすべて未使用に戻す。
  // 絆レベル・絆経験値そのものは変更しない
  const useBondResetScroll = (masuId) => {
    if ((ownedItems.bond_reset_scroll || 0) <= 0) return;
    const masu = getMasuMon(masuId);
    if (!masu) return;
    const base = ALL_PLAYER_MONSTERS[masu.baseId];
    if (!base) return;
    const baseApt = base.distAptitude || ['C','C','C','C'];
    const aptSpent = (masu.distApt || baseApt).reduce((sum, g, i) => sum + Math.max(0, DIST_APTITUDE_GRADES.indexOf(g) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])), 0);
    const statSpent = Object.entries(masu.statPoints || {}).reduce((sum, [key, val]) => sum + Math.ceil((val || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
    const totalRefund = aptSpent + statSpent;
    if (totalRefund <= 0) return; // 使った強化ポイントが無ければ意味が無いので何もしない
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? { ...m, distApt: [...baseApt], statPoints: { hp:0, atk:0, def:0, guts:0 }, distAptPoints: (m.distAptPoints || 0) + totalRefund } : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    setOwnedItems(prev => { const next = { ...prev, bond_reset_scroll: (prev.bond_reset_scroll || 0) - 1 }; storeSet('mh_owned_items', next, false); return next; });
    Audio_.se.tap();
  };
  // 染色もどき: マスモンの見た目の色(部位ごとにCSSフィルターで簡易パレットスワップ)を変える。
  // colorsはモンスターの染色可能な部位数と同じ長さの配列(各要素は色idまたはnull=染色しない)
  const useDyeItem = (masuId, colors) => {
    if ((ownedItems.dye_mock || 0) <= 0) return;
    const cleaned = (colors || []).map(c => (c && _resolveColorTarget(c)) ? c : null);
    if (!cleaned.some(Boolean)) return;
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? { ...m, colors: cleaned, color: undefined } : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    setOwnedItems(prev => { const next = { ...prev, dye_mock: (prev.dye_mock || 0) - 1 }; storeSet('mh_owned_items', next, false); return next; });
    Audio_.se.tap();
  };
  // マスモンの名前を変更する(12文字まで)
  const renameMasuMon = (masuId, newName) => {
    const name = (newName || '').trim().slice(0, 12);
    if (!name) return;
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? { ...m, name } : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
  };
  // マスモンを削除する。編成に入っていた場合はその枠も取り除く
  const deleteMasuMon = (masuId) => {
    setMasuMons(prev => {
      const next = prev.filter(m => m.id !== masuId);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    const entry = 'masu:' + masuId;
    setMonsterRosterIds(prev => {
      if (!prev.includes(entry)) return prev;
      const next = prev.filter(x => x !== entry);
      storeSet('mh_monster_roster', next, false);
      return next;
    });
  };
  // 合体: 副の絆経験値(累計bondXp)をまるごと主に加算し、副は消滅させる。
  // 消費ダイヤは(主の絆Lv+副の絆Lv)×100。両者とも絆Lv10以上でfusionInheritUniqueがtrueなら、
  // 副の固有技を「継承した固有技」としてinheritedUniquesに記録する(現時点ではバトルでは未使用。
  // 今後バトル中に複数の固有技から選べる仕様に対応した際に使う想定のデータ保持のみ)
  const executeMasuFusion = () => {
    const main = getMasuMon(fusionMainId);
    const sub = getMasuMon(fusionSubId);
    if (!main || !sub || main.id === sub.id) return null;
    const mainLvl = bondLevelInfo(main.bondXp || 0);
    const subLvl = bondLevelInfo(sub.bondXp || 0);
    const cost = (mainLvl.level + subLvl.level) * 100;
    if (gold < cost) return null;
    const beforeXp = main.bondXp || 0;
    const gainedXp = sub.bondXp || 0;
    const afterXp = beforeXp + gainedXp;
    const before = bondLevelInfo(beforeXp);
    const after = bondLevelInfo(afterXp);
    const gainedLevels = after.level - before.level;
    const subBase = ALL_PLAYER_MONSTERS[sub.baseId];
    const mainBase = ALL_PLAYER_MONSTERS[main.baseId];
    const canInherit = mainLvl.level >= 10 && subLvl.level >= 10 && fusionInheritUnique;
    const inheritedUnique = (canInherit && subBase) ? { ...subBase.unique, monId: subBase.id, sourceMasuName: sub.name, evoLevel: 0 } : null;
    const historyEntry = { subName: sub.name, subBaseId: sub.baseId, subBondLevel: subLvl.level, xpGained: gainedXp, inherited: !!inheritedUnique, timestamp: Date.now() };
    setMasuMons(prev => {
      const next = prev
        .filter(m => m.id !== sub.id)
        .map(m => m.id === main.id ? {
          ...m,
          bondXp: afterXp,
          distAptPoints: (m.distAptPoints || 0) + gainedLevels,
          fusionHistory: [...(m.fusionHistory || []), historyEntry],
          ...(inheritedUnique ? { inheritedUniques: [...(m.inheritedUniques || []), inheritedUnique] } : {}),
        } : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    const subEntry = 'masu:' + sub.id;
    setMonsterRosterIds(prev => {
      if (!prev.includes(subEntry)) return prev;
      const next = prev.filter(x => x !== subEntry);
      storeSet('mh_monster_roster', next, false);
      return next;
    });
    const goldAfter = gold - cost;
    setGold(goldAfter);
    storeSet('mh_gold', goldAfter, false);
    return {
      mainName: main.name, mainIconUrl: mainBase?.iconUrl, mainBaseId: main.baseId, mainEmoji: mainBase?.emoji, mainColors: getMasuColors(main),
      subName: sub.name, subIconUrl: subBase?.iconUrl, subBaseId: sub.baseId, subEmoji: subBase?.emoji, subColors: getMasuColors(sub),
      before, after, gainedXp, gainedLevels, inherited: !!inheritedUnique, cost,
    };
  };
  const resetFusionFlow = () => {
    setFusionStep('main'); setFusionMainId(null); setFusionSubId(null); setFusionInheritUnique(false); setFusionAnimPhase(0); setFusionResultData(null);
  };
  // ラン終了画面: 今回のランで勇者モンに選んでいた(まだマスモン化していない)モンスター種を、
  // 今回のランで得た絆経験値をそのまま初期値として、名前を付けてマスモンとして登録する
  // ラン終了画面(CHAMPION/敗北/リタイア)共通: マスモン登録ボタン・登録済み表示
  const masuRegisterButtonNode = () => {
    if (!finalRewardSummary?.heroBondGain || finalRewardSummary.heroBondGain.masuId) return null;
    if (masuRegisteredThisRun) return <div className="text-[10px] text-pink-300 font-black mt-1 flex items-center justify-center gap-1 shrink-0"><Heart size={11}/>マスモンとして登録しました！</div>;
    return (
      <button onClick={()=>{setMasuNameInput(mainHero?.name||''); setShowMasuRegisterModal(true);}} className="w-full max-w-xs bg-pink-600 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2 mt-1 shrink-0 active:scale-95"><Heart size={14}/>マスモンとして登録する</button>
    );
  };
  const registerMasuMon = (name) => {
    if (!mainHero || mainHero.masuId) return null; // 既にマスモンの勇者は登録不要(既存インスタンスに加算済み)
    const base = ALL_PLAYER_MONSTERS[mainHero.id];
    if (!base) return null;
    const startXp = finalRewardSummary?.heroBondGain?.xpGain || 0;
    const startLevel = bondLevelInfo(startXp);
    const id = 'masu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const masu = {
      id, baseId: mainHero.id,
      name: (name || base.name).trim().slice(0, 12) || base.name,
      bondXp: startXp,
      distAptPoints: Math.max(0, startLevel.level - 1),
      distApt: [...(base.distAptitude || ['C','C','C','C'])],
      statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
      createdAt: Date.now(),
    };
    setMasuMons(prev => { const next = [...prev, masu]; storeSet('mh_masu_mons', next, false); return next; });
    setMasuRegisteredThisRun(true);
    return masu;
  };

  // クリアしたWAVE数に応じてブリーダー経験値・ゴールド・勇者モンの絆経験値をまとめて加算(端末保存)。
  // 最終リザルト画面(CHAMPION/敗北)に出す獲得内訳もここで組み立てる
  const awardRunRewards = async (wavesCleared) => {
    if (wavesCleared <= 0) { setFinalRewardSummary({ breederXpGain: 0, breederLevelBefore: breederLevel, breederLevelAfter: breederLevel, goldBefore: gold, goldAfter: gold, heroBondGain: null, allyBondGains: [], waveHistory }); return; }
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
      // 配った総数も記録しておく(読み込み時の補填処理が二重に配らないようにするため)
      storeSet('mh_breeder_points_granted', Math.max(0, breederLevelAfter.level - 1), false);
    }

    const goldGain = goldForWavesCleared(wavesCleared, goldMult);
    const goldBefore = gold;
    const goldAfter = gold + goldGain;
    setGold(goldAfter);
    storeSet('mh_gold', goldAfter, false);

    // 勇者モンの絆経験値: 既にマスモン化済み(masuIdあり)ならそのインスタンスへ直接加算して確定保存する。
    // まだマスモン化していないプレーンな種のままなら、加算先が無いため保存はせず(=絆レベルの概念自体が
    // プレーン種には存在しない)、獲得量だけを計算してラン終了画面に表示する。そこで「マスモンとして
    // 登録する」を選んだ場合にのみ、この獲得量を初期値として新しいマスモンが作られる(registerMasuMon参照)
    // 供モン(仲間として編成したマスモン)にも、勇者モンの1/4の絆経験値を加算する。勇者モン自身は
    // slots内にも含まれるが、masuIdで比較して除外する(hero.masuIdが無い=プレーン種の場合は比較先が
    // 無いので単純にtruthyなmasuIdを持つ全枠が対象になる)
    const gain = xpForWavesCleared(wavesCleared, scoreMult);
    const allyGain = Math.max(1, Math.floor(gain / 4));
    const allyMasuIds = slots.filter(s => s && s.masuId && s.masuId !== mainHero?.masuId).map(s => s.masuId);
    // 表示用の獲得内訳は、setMasuMonsの更新関数(Reactが後で非同期に呼び出すため、この関数の続きの
    // 行が実行される時点ではまだ実行されているとは限らない)の中で計算するのではなく、現在のmasuMons
    // (getMasuMon)を直接読んでこの場で同期的に計算する。以前はupdater内でのみ計算していたため、
    // タイミングによって勇者モン自身の絆経験値欄がリザルト画面に出ないことがあった
    let heroBondGain = null;
    if (mainHero?.masuId) {
      const masu = getMasuMon(mainHero.masuId);
      const before = bondLevelInfo(masu?.bondXp || 0);
      const after = bondLevelInfo((masu?.bondXp || 0) + gain);
      heroBondGain = { name: mainHero.masuName || mainHero.name, emoji: mainHero.emoji, iconUrl: mainHero.iconUrl, xpGain: gain, levelBefore: before, levelAfter: after, masuId: mainHero.masuId };
    } else if (mainHero) {
      const before = bondLevelInfo(0);
      const after = bondLevelInfo(gain);
      heroBondGain = { name: mainHero.name, emoji: mainHero.emoji, iconUrl: mainHero.iconUrl, xpGain: gain, levelBefore: before, levelAfter: after, masuId: null };
    }
    const allyBondGains = allyMasuIds.map(masuId => {
      const masu = getMasuMon(masuId);
      if (!masu) return null;
      const before = bondLevelInfo(masu.bondXp || 0);
      const after = bondLevelInfo((masu.bondXp || 0) + allyGain);
      return { name: masu.name, xpGain: allyGain, levelBefore: before, levelAfter: after, masuId };
    }).filter(Boolean);

    if (mainHero?.masuId || allyMasuIds.length > 0) {
      setMasuMons(prev => {
        const next = prev.map(m => {
          if (mainHero?.masuId && m.id === mainHero.masuId) {
            const before = bondLevelInfo(m.bondXp || 0);
            const afterXp = (m.bondXp || 0) + gain;
            const after = bondLevelInfo(afterXp);
            return { ...m, bondXp: afterXp, distAptPoints: (m.distAptPoints || 0) + (after.level - before.level) };
          }
          if (allyMasuIds.includes(m.id)) {
            const before = bondLevelInfo(m.bondXp || 0);
            const afterXp = (m.bondXp || 0) + allyGain;
            const after = bondLevelInfo(afterXp);
            return { ...m, bondXp: afterXp, distAptPoints: (m.distAptPoints || 0) + (after.level - before.level) };
          }
          return m;
        });
        storeSet('mh_masu_mons', next, false);
        return next;
      });
    }

    setFinalRewardSummary({ breederXpGain, breederLevelBefore, breederLevelAfter, goldBefore, goldAfter, heroBondGain, allyBondGains, waveHistory });
  };

  // Save score on game end (CHAMPION is awarded synchronously in handleNextWave instead, so its result screen never renders before the summary is ready)
  useEffect(() => {
    if (hp <= 0) {
      (async () => {
        // 経験値・ダイヤの付与は端末内で完結するので必ず先に行う。
        // 以前はスコア送信(全国ランキングへの通信)の完了を待ってから付与していたため、
        // 通信が遅い・不安定なときにリザルトの獲得内訳がなかなか表示されなかった。
        try {
          await awardRunRewards(Math.max(0, wave - 1));
        } catch (e) { console.error('[result] award rewards failed:', e && e.message ? e.message : e); }
        // スコア送信はリザルトの表示に必要ないため、完了を待たず後追いで行う
        (async () => {
          try {
            if (score > 0) await submitLocalScore(difficulty, score);
            if (score > (highScores[difficulty] || 0)) {
              await storeSet(`mh_hs_${difficulty}`, score, false);
              setHighScores(prev => ({ ...prev, [difficulty]: score }));
            }
          } catch (e) { console.error('[result] score submit failed:', e && e.message ? e.message : e); }
        })();
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
    monSelection:getActiveMonsterList(), ownedUniques:[], slotUniqueChoice:{}, slotUniqueLevelChoice:{}, ownedTeachings:[],
    atkLevel:0, guardLevel:0, guardBonusCount:0, upgradePoints:0, turnCount:1,
    permaBuffs:{ autoHpRecovery:0.1 }, waveBuffs:{}, turnBuffs:{}, nextTurnBuffs:{},
    currentWaveDamage:0, waveDistDamage:[0,0,0,0], distDmgBonus:[0,0,0,0], distAptBonus:[0,0,0,0], totalDistDamage:[0,0,0,0], totalAllDamage:0, totalRecoveryDelta:0, waveResult:null,
    focusedCard:null, enemyIntent:null, effect:null, finalRewardSummary:null, waveHistory:[], gaveUp:false
  });

  const handleGoToTitle = () => {
    const s = resetAllState();
    setScore(s.score); setWave(s.wave); setHp(s.hp); setMaxHp(s.maxHp); setGuts(s.guts); setMaxGuts(s.maxGuts);
    setAtk(s.atk); setDef(s.def); setSlots(s.slots); setMainHero(s.mainHero); setHand(s.hand); setDeck(s.deck);
    setGraveyard(s.graveyard); setEnemy(s.enemy); setEnemyDist(s.enemyDist); setSelectedCards(s.selectedCards); setCardAssignments({}); setPendingCard(null);
    setIsBusy(s.isBusy); setMonSelection(s.monSelection); setOwnedUniques(s.ownedUniques); setSlotUniqueChoice(s.slotUniqueChoice||{}); setSlotUniqueLevelChoice(s.slotUniqueLevelChoice||{});
    setOwnedTeachings(s.ownedTeachings); setAtkLevel(s.atkLevel); setGuardLevel(s.guardLevel);
    setGuardBonusCount(s.guardBonusCount); setUpgradePoints(s.upgradePoints); setTurnCount(s.turnCount);
    setPermaBuffs(s.permaBuffs); setWaveBuffs(s.waveBuffs); setTurnBuffs(s.turnBuffs); setNextTurnBuffs(s.nextTurnBuffs);
    setCurrentWaveDamage(s.currentWaveDamage); setWaveDistDamage(s.waveDistDamage||[0,0,0,0]); setDistDmgBonus(s.distDmgBonus||[0,0,0,0]); setDistAptBonus(s.distAptBonus||[0,0,0,0]); setTotalDistDamage(s.totalDistDamage||[0,0,0,0]); setTotalAllDamage(s.totalAllDamage||0); setTotalRecoveryDelta(s.totalRecoveryDelta||0);
    setWaveResult(s.waveResult);
    setPendingReward(null); setFocusedCard(s.focusedCard); setSkillPicker(null); setShowQuitConfirm(false); setEnemyIntent(s.enemyIntent); setEffect(s.effect); setFinalRewardSummary(s.finalRewardSummary); setWaveHistory(s.waveHistory||[]); setGaveUp(s.gaveUp);
    setMasuRegisteredThisRun(false); setShowMasuRegisterModal(false); setMasuNameInput('');
    setGameState('TITLE');
  };

  // Give up mid-run: record current score to ranking, award rewards, then show the final result screen (gaveUp)
  const handleGiveUp = useCallback(async () => {
    // 敗北時と同じく、端末内で完結する経験値・ダイヤの付与とリザルト表示を先に済ませ、
    // 通信を伴うスコア送信は完了を待たず後追いで行う(通信待ちでリザルトが遅れないように)
    try { await awardRunRewards(Math.max(0, wave - 1)); } catch {}
    setShowQuitConfirm(false);
    setGaveUp(true);
    if (score > 0) {
      (async () => {
        try {
          await submitLocalScore(difficulty, score);
          if (score > (highScores[difficulty] || 0)) {
            await storeSet(`mh_hs_${difficulty}`, score, false);
            setHighScores(prev => ({ ...prev, [difficulty]: score }));
          }
        } catch {}
      })();
    }
  }, [score, difficulty, highScores, breederName, mainHero, slots, wave]);

  const handleRetry = () => {
    const s = resetAllState();
    setScore(s.score); setWave(s.wave); setHp(s.hp); setMaxHp(s.maxHp); setGuts(s.guts); setMaxGuts(s.maxGuts);
    setAtk(s.atk); setDef(s.def); setSlots(s.slots); setMainHero(s.mainHero); setHand(s.hand); setDeck(s.deck);
    setGraveyard(s.graveyard); setEnemy(s.enemy); setEnemyDist(s.enemyDist); setSelectedCards(s.selectedCards); setCardAssignments({}); setPendingCard(null);
    setIsBusy(s.isBusy); setMonSelection(s.monSelection); setOwnedUniques(s.ownedUniques); setSlotUniqueChoice(s.slotUniqueChoice||{}); setSlotUniqueLevelChoice(s.slotUniqueLevelChoice||{});
    setOwnedTeachings(s.ownedTeachings); setAtkLevel(s.atkLevel); setGuardLevel(s.guardLevel);
    setGuardBonusCount(s.guardBonusCount); setUpgradePoints(s.upgradePoints); setTurnCount(s.turnCount);
    setPermaBuffs(s.permaBuffs); setWaveBuffs(s.waveBuffs); setTurnBuffs(s.turnBuffs); setNextTurnBuffs(s.nextTurnBuffs);
    setCurrentWaveDamage(s.currentWaveDamage); setWaveDistDamage(s.waveDistDamage||[0,0,0,0]); setDistDmgBonus(s.distDmgBonus||[0,0,0,0]); setDistAptBonus(s.distAptBonus||[0,0,0,0]); setTotalDistDamage(s.totalDistDamage||[0,0,0,0]); setTotalAllDamage(s.totalAllDamage||0); setTotalRecoveryDelta(s.totalRecoveryDelta||0);
    setWaveResult(s.waveResult);
    setFocusedCard(s.focusedCard); setSkillPicker(null); setEnemyIntent(s.enemyIntent); setEffect(s.effect); setPendingReward(null); setFinalRewardSummary(s.finalRewardSummary); setWaveHistory(s.waveHistory||[]); setGaveUp(s.gaveUp);
    setMasuRegisteredThisRun(false); setShowMasuRegisterModal(false); setMasuNameInput('');
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
      // uniqueは自分のモンスターのスロットのみ(合体で引き継いだ固有技はownerSlotIdxで判定する。
      // monIdは技の出自(元モンスター)を表すため、継承技だとtargetMon.idとは一致しない)
      if(c.type==='unique' && c.ownerSlotIdx!==slotIdx){ setFocusedCard(c); return; }
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
    if (baseDmg<=0) return 0;
    const comboDmgBonus = getPermaBuff('comboDmgPct');
    let bonus = 0;
    if (mainHero?.id==='Zan' && mon?.id==='Zan') bonus += Math.floor(baseDmg*(0.3+comboDmgBonus)); // 勇者特性「連撃」
    if (card.type==='unique' && card.monId==='Zan') bonus += Math.floor(baseDmg*(0.2+comboDmgBonus)); // 固有技「連斬」自体の連撃(引き継ぎでも発生)
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
        syncAtkTierForDist(intent.targetDist);
        await wait(350);
        setEnemyAttackAnim(false);
        setEnemyAttackFx(null);
        await wait(200);
      } else if (intent.type==='WAIT') {
        addPopup("待機中...",'enemy','text-slate-400 text-lg'); await wait(500);
      } else if (intent.type==='ATTACK'||intent.type==='CHARGE') {
        // 軽減量は「固定値の合計 + 丈夫さ × 倍率の合計」(GUARD_EVOLUTIONのflat/mult参照)
        const guardValue = (immediateEffects.guardFlat>0||immediateEffects.guardMult>0) ? Math.floor(immediateEffects.guardFlat + def*immediateEffects.guardMult) : 0;
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
    let lastType='none', guardTypeInTurn='none', totalDmg=0, totalHeal=0, localOryoAdd=0, localDmgModAdd=0, attackCount=0, hasCrit=false, immediateInvincible=false, immediateStun=false, currentTurnGuardFlat=0, currentTurnGuardMult=0;
    let forcedMoveTarget=null; // range_atk forces enemy to move at turn end
    const attackHits=[]; // {dmg, isCrit, slotIdx}

    // カットイン廃止: 技名はスロット上にインライン表示する（実行ループ内で行う）

    for (const entry of usedCardEntries) {
      const card=entry.card;
      const slotIdx=entry.slotIdx!=null?entry.slotIdx:defaultSlot;
      lastType=card.type;
      if (card.type==='guard') { Audio_.se.guard(); guardTypeInTurn='guard'; currentTurnGuardFlat+=GUARD_EVOLUTION[guardLevel].flat; currentTurnGuardMult+=GUARD_EVOLUTION[guardLevel].mult; }
      else if (card.type==='weak_guard') { if(guardTypeInTurn!=='guard') guardTypeInTurn='weak_guard'; currentTurnGuardFlat+=(GUARD_EVOLUTION[guardLevel].flat*0.5); currentTurnGuardMult+=(GUARD_EVOLUTION[guardLevel].mult*0.5); }
      setGuts(p=>Math.max(0,p-getCardGuts(card)));
      if (card.type==='draw') continue;
      if (card.type==='buff'||card.type==='debuff') {
        fireTeachingFx(card.id);
        if (card.subType==='atk_buff') { addPopup(`攻撃UP!`,'hero','text-red-400 font-black text-2xl drop-shadow-md'); addPermaBuff('atkPct',card.baseValue); localOryoAdd+=card.baseValue; }
        else if (card.subType==='dmg_cut_buff') { addPopup(`防御UP!`,'hero','text-emerald-400 font-black text-2xl drop-shadow-md'); const owned=ownedTeachings.find(ot=>ot.id===card.id); const level=owned?owned.evoLevel:0; let cutValue=level===0?0.03:(level===1?0.06:0.10); setPermaBuffs(p=>({...p, dmgCutPct:Math.min(0.9,(p.dmgCutPct||0)+cutValue)})); }
        // かどみうむ: 効果量はdata/breeder.jsのCADMIUM_TIERSに集約している(説明文の生成も同じ値を見る)
        else if (card.subType==='guts_buff') { addPopup(`⚡ ガッツ上限UP!`,'guts','text-amber-400 font-black text-2xl drop-shadow-md'); const owned=ownedTeachings.find(ot=>ot.id===card.id); const tier=CADMIUM_TIERS[Math.min(owned?owned.evoLevel:0,CADMIUM_TIERS.length-1)]; addPermaBuff('gutsRecoverPct',tier.autoGuts); addPermaBuff('muaGutsPct',tier.gutsLimit); if(tier.hpLimit>0) addPermaBuff('muaHpPct',tier.hpLimit); if(tier.autoHp>0){ addPermaBuff('autoHpRecovery',tier.autoHp); addPopup(`💚 再生強化`,'life','text-emerald-400 font-black text-xl drop-shadow-md'); } }
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
          // 固有技の効果は技の出自(card.monId)で判定する(activeMon.idではない)。合体で引き継いだ
          // 固有技を別のモンスターが使う場合でも、元モンスターの固有技効果を正しく再現するため
          if(card.monId==='Mocchi'||card.monId==='Mitarashi'){addPermaBuff('dmgCutPct',0.03); addWaveBuff('enemyTakenDmgBonus',0.1); localDmgModAdd+=0.1; addPopup('丈夫さUP!','hero','text-emerald-400 text-lg font-bold');}
          else if(card.monId==='Golem'){addPermaBuff('atkPct',0.1); localOryoAdd+=0.1; addPopup('闘志UP!','hero','text-red-600 text-lg font-bold');}
          else if(card.monId==='Zan'){addPermaBuff('comboDmgPct',0.03); addPopup('連斬!','hero','text-cyan-400 text-lg font-bold');}
        }
        const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,attackCount>0); attackCount++;
        const critRateBonus=getPermaBuff('critRatePct'), critDmgBonus=getPermaBuff('critDmgPct');
        const isCrit=getTurnBuff('guaranteedCrit',false)||(Math.random()<((card.crit||0.1)+critRateBonus));
        const finalD=isCrit?Math.floor(d*(1.5+critDmgBonus)):d; if(isCrit) hasCrit=true; totalDmg+=finalD;
        attackHits.push({dmg:finalD, isCrit, slotIdx, isSpecial:(card.type==='unique'||card.type==='range_atk'), skillName:(card.name||card.baseName), isUnique:card.type==='unique', monId:card.type==='unique'?card.monId:undefined});
        if (activeMon.id==='Zan' || (card.type==='unique' && card.monId==='Zan')) {
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
          // 勇者特性「連撃」: ザン自身が攻撃していて、かつザンが勇者モンの時のみ、攻撃(通常/固有問わず)に連撃ヒットを追加
          if (mainHero?.id==='Zan' && activeMon.id==='Zan') rollCombo(0.3+comboDmgBonus);
          // 固有技「連斬」自体の連撃: 技の出自(card.monId)がザンなら、誰が使っても発生する(合体で引き継いだ場合も含む)
          if (card.type==='unique' && card.monId==='Zan') rollCombo(0.2+comboDmgBonus);
        }
        if (card.type==='range_atk' && card.rangeIdx!=null) { forcedMoveTarget=(card.rangeIdx+1)%4; }
        if (card.type==='unique') {
          // 固有技の効果は技の出自(card.monId)で判定する(activeMon.idではない)。理由は上のコメントと同じ
          if(card.monId==='Ham'){immediateStun=true; setImmediateTurnBuff('stunEnemy',true); addPopup('スタン!','enemy','text-yellow-400 text-lg font-bold');}
          else if(card.monId==='Suezo'){const gRec=Math.floor(effectiveMaxGuts*0.5); setGuts(p=>Math.min(effectiveMaxGuts,p+gRec)); addPopup(`⚡ ガッツ +${gRec}`,'guts','text-amber-400 text-xl font-black drop-shadow-md');}
          else if(card.monId==='Pixie'){setNextTurnBuff('zeroGuts',true); addPopup('次ターン消費0!','hero','text-blue-400 text-lg font-bold');}
          else if(card.monId==='Tiger'){setNextTurnBuff('guaranteedCrit',true); addPermaBuff('critRatePct',0.02); addPermaBuff('critDmgPct',0.02); addPopup('次ターン会心確定!','hero','text-red-400 text-lg font-bold'); addPopup('会心率+2% 会心ダメ+2%','hero','text-yellow-400 text-sm font-bold');}
          else if(card.monId==='Monol'){addPermaBuff('dmgCutPct',0.03); addWaveBuff('enemyAtkDebuffPct',0.10); setNextTurnBuff('reflect',true); addPopup('次ターン反射！','hero','text-purple-400 text-lg font-bold');}
          else if(card.monId==='Oboro'){const hRec=Math.floor(finalD*0.5); const gRec=Math.floor(finalD*0.05); setHp(p=>Math.min(effectiveMaxHp,p+hRec)); setGuts(p=>Math.min(effectiveMaxGuts,p+gRec)); addPopup(`💚 ドレイン +${hRec}`,'life','text-emerald-400 text-xl font-black drop-shadow-md'); addPopup(`⚡ ガッツ +${gRec}`,'guts','text-amber-400 text-base font-bold drop-shadow-md');}
          else if(card.monId==='Ark'||card.monId==='Iblis'){
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
          // 連撃ヒットの有無に依存させると、供モン加入時に通常攻撃のモーションが変わってしまうため)。
          // 固有技(hit.isUnique)の場合は技の出自(hit.monId)側のatkMotionを優先する。合体で引き継いだ
          // 固有技を別のモンスターが使う場合でも、元モンスターの専用モーションを再現するため
          const hitMotion = (hit.isUnique && hit.monId && ALL_PLAYER_MONSTERS[hit.monId]?.atkMotion) || slots[hit.slotIdx]?.atkMotion;
          const isZanGroupStart = hit.skillName!=='連撃' && hitMotion==='zanCombo';
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
            const motion = (hit.isUnique && hit.monId && ALL_PLAYER_MONSTERS[hit.monId]?.atkMotion) || slots[animSlot]?.atkMotion; // モンスターごとの専用モーション種別('default'/'zanCombo'/'floatStab'等)。全モンスターがdata側で必ず指定する。固有技は技の出自(継承元)のモーションを優先する
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
      syncAtkTierForDist(forcedMoveTarget);
      addPopup(`強制移動！ ${RANGE_LABELS[forcedMoveTarget]}距離へ`,'enemy','text-cyan-400 font-black text-lg drop-shadow-md');
      await wait(700);
      forcedMoveHappened=true;
    }
    // 予測表示している enemyIntent をそのまま実行する（再抽選しない）
    const finalActionType=guardTypeInTurn!=='none'?guardTypeInTurn:lastType;
    // 距離撃で強制移動させた場合は、敵自身のMOVE行動で上書きされないよう優先する(距離撃 > 敵の自発的な移動)
    const executedIntent=(forcedMoveHappened&&enemyIntent?.type==='MOVE')?{type:'WAIT',value:0,label:"様子を見ている",icon:"⏳"}:enemyIntent;
    await handleEnemyTurn(finalActionType,{invincible:immediateInvincible,stun:immediateStun,guardFlat:currentTurnGuardFlat,guardMult:currentTurnGuardMult},executedIntent);
    // 敵の行動が終わった後で、次ターンの予測を1回だけ抽選してセット
    // 敵が移動した場合は移動後の距離を基準にする
    const distForNextPredict=(executedIntent&&executedIntent.type==='MOVE')?executedIntent.targetDist:endTurnDist;
    setEnemyIntent(getNextEnemyAction(enemy,distForNextPredict));
  };

  // WAVE 10のムーを撃破した場合はリザルト画面(CHAMPION)に切り替える前にスコア記録・獲得報酬の計算を完了させ、
  // ギブアップ時と同様に画面が出た瞬間から獲得内訳が表示された状態にする
  const handleNextWave = async () => {
    setEffect(null);
    if (wave === 10) {
      try {
        if (score > 0) await submitLocalScore(difficulty, score);
        if (score > (highScores[difficulty] || 0)) {
          await storeSet(`mh_hs_${difficulty}`, score, false);
          setHighScores(prev => ({ ...prev, [difficulty]: score }));
        }
      } catch (e) { console.error('[result] score submit failed:', e && e.message ? e.message : e); }
      try {
        await awardRunRewards(10);
        setClearCounts(prev => { const next = { ...prev, [difficulty]: (prev[difficulty]||0)+1 }; storeSet(`mh_clears_${difficulty}`, next[difficulty], false); return next; });
      } catch (e) { console.error('[result] award rewards failed:', e && e.message ? e.message : e); }
      setGameState('CHAMPION');
    } else {
      setGameState('REWARD_PICK');
    }
  };

  // スロットで現在選べる固有技一覧(自分の固有技+合体で引き継いだ固有技)を返す。
  // 表示・選択UIとbuildDeckの両方から使う共通ロジック
  const getAvailableUniquesForSlot = (mon, cUniques) => {
    if (!mon) return [];
    const own = (cUniques||ownedUniques).find(uq=>uq.monId===mon.id);
    const inherited = mon.inheritedUniques||[];
    return [...(own?[{key:'own',unique:own}]:[]), ...inherited.map((iu,ii)=>({key:`inh${ii}`,unique:iu}))];
  };
  const buildDeck = (currentSlots, aLvl, gLvl, cUniques, cTeachings, gBonus, uChoice, uLevelChoice) => {
    const atkNames=HERO_ATK_NAMES[mainHero?.id]||HERO_ATK_NAMES['Mocchi'];
    let pool=[];
    pool.push({...BASE_ATK_EVOLUTION[aLvl],name:atkNames[aLvl],type:'atk',uid:Math.random()},{...BASE_ATK_EVOLUTION[aLvl],name:atkNames[aLvl],type:'atk',uid:Math.random()});
    for(let i=0;i<2+gBonus;i++) pool.push({...GUARD_EVOLUTION[gLvl],type:'guard',uid:Math.random()});
    currentSlots.forEach((s,idx)=>{
      if(s){
        const revo=RANGE_EVOLUTION[aLvl];
        pool.push({name:`${RANGE_LABELS[idx]}${revo.name}`,type:'range_atk',rangeIdx:idx,guts:revo.guts,baseGuts:revo.baseGuts,mult:revo.mult,baseMult:revo.baseMult,crit:revo.crit,icon:RANGE_LABELS[idx],uid:Math.random(),evoLevel:aLvl});
        const options=getAvailableUniquesForSlot(s,cUniques);
        if(options.length>0){
          const chosenKey=(uChoice&&uChoice[idx])||'own';
          const u=(options.find(o=>o.key===chosenKey)||options[0]).unique;
          const maxLevel=u.evoLevel||0;
          const lvl=(uLevelChoice&&uLevelChoice[idx]!=null)?Math.min(uLevelChoice[idx],maxLevel):maxLevel;
          const currentEvoName=u.names[Math.min(lvl,u.names.length-1)]; const uCrit=0.10+0.05*Math.min(lvl,8);
          pool.push({...u,name:currentEvoName,type:'unique',uid:Math.random(),guts:u.guts||u.baseGuts,baseGuts:u.baseGuts,baseMult:u.baseMult,evoLevel:lvl,monId:u.monId,crit:uCrit,effectDesc:u.effectDesc,ownerSlotIdx:idx});
        }
      }
    });
    cTeachings.forEach(t=>{let name=BREEDER_EVO_NAMES[t.id][Math.min(t.evoLevel||0,2)]; pool.push({...t,name,guts:20,uid:Math.random()});});
    return pool.sort(()=>Math.random()-0.5);
  };
  // 指定スロットの固有技の選択(key)を直接適用する共通処理。手札・山札・捨て札に既に配られている
  // そのスロットの固有技カードも、名前や威力等をその場で差し替える(山札から引き直しても最新の
  // 選択が反映されるよう、控えているカードにも同じ内容を適用する)
  const applyUniqueChoiceForSlot = (slotIdx, key) => {
    const mon=slots[slotIdx]; if(!mon) return;
    const options=getAvailableUniquesForSlot(mon,ownedUniques);
    const chosen=options.find(o=>o.key===key); if(!chosen) return;
    setSlotUniqueChoice(prev=>({...prev,[slotIdx]:chosen.key}));
    setSlotUniqueLevelChoice(prev=>{if(!(slotIdx in prev)) return prev; const n={...prev}; delete n[slotIdx]; return n;}); // 出典切替時はそのまま最大解放レベルへ戻す
    const u=chosen.unique;
    const currentEvoName=u.names[Math.min(u.evoLevel||0,u.names.length-1)]; const uCrit=0.10+0.05*Math.min(u.evoLevel||0,8);
    const patch={name:currentEvoName,guts:u.guts||u.baseGuts,baseGuts:u.baseGuts,baseMult:u.baseMult,evoLevel:u.evoLevel||0,monId:u.monId,crit:uCrit,effectDesc:u.effectDesc,names:u.names,icon:u.icon,sourceMasuName:u.sourceMasuName};
    const patchCard=(c)=>(c.type==='unique'&&c.ownerSlotIdx===slotIdx)?{...c,...patch}:c;
    setHand(prev=>prev.map(patchCard)); setDeck(prev=>prev.map(patchCard)); setGraveyard(prev=>prev.map(patchCard));
    Audio_.se.card();
  };
  // 現在アクティブな固有技(自分の技/継承技)の中で、レベル(0〜そのモンスターの現在の強化到達レベル)を
  // 直接指定して適用する。手札・山札・捨て札に既に配られているそのスロットの固有技カードも差し替える
  const applyUniqueLevelChoiceForSlot = (slotIdx, level) => {
    const mon=slots[slotIdx]; if(!mon) return;
    const options=getAvailableUniquesForSlot(mon,ownedUniques);
    const activeKey=slotUniqueChoice[slotIdx]||'own';
    const chosen=options.find(o=>o.key===activeKey)||options[0]; if(!chosen) return;
    const u=chosen.unique;
    const maxLevel=u.evoLevel||0;
    const lvl=Math.max(0,Math.min(level,maxLevel));
    setSlotUniqueLevelChoice(prev=>({...prev,[slotIdx]:lvl}));
    const currentEvoName=u.names[Math.min(lvl,u.names.length-1)]; const uCrit=0.10+0.05*Math.min(lvl,8);
    const patch={name:currentEvoName,guts:u.guts||u.baseGuts,baseGuts:u.baseGuts,baseMult:u.baseMult,evoLevel:lvl,monId:u.monId,crit:uCrit,effectDesc:u.effectDesc,names:u.names,icon:u.icon,sourceMasuName:u.sourceMasuName};
    const patchCard=(c)=>(c.type==='unique'&&c.ownerSlotIdx===slotIdx)?{...c,...patch}:c;
    setHand(prev=>prev.map(patchCard)); setDeck(prev=>prev.map(patchCard)); setGraveyard(prev=>prev.map(patchCard));
    Audio_.se.card();
  };
  // そのスロットで選択中の固有技を次の候補(自分の固有技⇔合体で引き継いだ固有技)へ切り替える
  const cycleActiveUniqueForSlot = (slotIdx) => {
    const mon=slots[slotIdx]; if(!mon) return;
    const options=getAvailableUniquesForSlot(mon,ownedUniques);
    if(options.length<2) return;
    const curKey=slotUniqueChoice[slotIdx]||'own';
    const curIdx=Math.max(0,options.findIndex(o=>o.key===curKey));
    applyUniqueChoiceForSlot(slotIdx, options[(curIdx+1)%options.length].key);
  };
  // 通常攻撃・距離攻撃カードのレベルをlvlへ直接適用する共通処理。手札・山札・捨て札に
  // 既に配られている対象カードも、名前や威力等をその場で差し替える
  const applyAtkTierChoice = (lvl) => {
    setAtkLevel(lvl);
    const atkNames=HERO_ATK_NAMES[mainHero?.id]||HERO_ATK_NAMES['Mocchi'];
    const patchCard=(c)=>{
      if(c.type==='atk') return {...c,...BASE_ATK_EVOLUTION[lvl],name:atkNames[lvl]};
      if(c.type==='range_atk'){const revo=RANGE_EVOLUTION[lvl]; return {...c,name:`${RANGE_LABELS[c.rangeIdx]}${revo.name}`,guts:revo.guts,baseGuts:revo.baseGuts,mult:revo.mult,baseMult:revo.baseMult,crit:revo.crit,evoLevel:lvl};}
      return c;
    };
    setHand(prev=>prev.map(patchCard)); setDeck(prev=>prev.map(patchCard)); setGraveyard(prev=>prev.map(patchCard));
  };
  // 敵の距離が変わった(自発的な移動・距離攻撃による強制移動)直後に呼ぶ: 新しい距離に応じて
  // 通常攻撃・距離攻撃カードのレベルを再算出し、変化していれば適用する(このタイミングでは
  // プレイヤーが個別に選んだ下位レベルよりも、その時点で解放されている最上位へ揃え直す)
  const syncAtkTierForDist = (dist) => {
    const nAtkL = computeAtkTier(slots, dist);
    if (nAtkL === atkLevel) return;
    applyAtkTierChoice(nAtkL);
  };

  // 通常攻撃・距離攻撃カードの上位レベルは、敵と同じ距離枠にいる味方の距離適性(%)と、
  // その距離枠で永続蓄積している距離ダメージ補正(distDmgBonus、ウェーブ報酬で上昇・上限なし)
  // を合算した値(誰もいなければ0%扱い)で決まる。この合算値はWAVE_RESULT画面の合計表示や
  // 実際のダメージ計算(4502行付近のtotalBonus)と同じ考え方
  const ATK_TIER_THRESHOLDS = [0, 15, 20, 25, 30, 40, 50, 75, 100]; // Lv0〜8の解放に必要な合算%
  const computeAtkTier = (currentSlots, dist) => {
    const mon = currentSlots?.[dist];
    if (!mon) return 0;
    const pct = ((distDmgBonus[dist] || 0) + (DIST_APTITUDE_MULT[getDistAptitude(mon, dist)] - 1.0)) * 100;
    let lvl = 0;
    for (let i = ATK_TIER_THRESHOLDS.length - 1; i >= 0; i--) { if (pct >= ATK_TIER_THRESHOLDS[i]) { lvl = i; break; } }
    return Math.max(0, Math.min(BASE_ATK_EVOLUTION.length - 1, lvl));
  };
  // 防御カードの上位レベル・追加枚数は、丈夫さ(バフ・デバフを含まない基礎ステ=defそのもの)が
  // 100毎に自動で1段階上がる
  const computeGuardLevel = (defVal) => Math.max(0, Math.min(GUARD_EVOLUTION.length - 1, Math.floor((defVal || 0) / 100)));

  const spawnEnemy = useCallback((w) => {
    const enemyKey=ENEMY_SEQUENCE[w-1]; const base=ENEMY_DATA[enemyKey];
    let mod=DIFFICULTY_SETTINGS[difficulty]?.power||1.0;
    const newEnemy={...base,id:enemyKey,hp:Math.floor(base.baseHp*mod),maxHp:Math.floor(base.baseHp*mod),atk:Math.floor(base.baseAtk*mod)};
    const dist=Math.floor(Math.random()*4);
    setEnemy(newEnemy); setEnemyDist(dist); setEnemyIntent(getNextEnemyAction(newEnemy,dist));
    setTurnCount(1); setSelectedCards([]); setLastActionSlot(null); setCardAssignments({}); setPendingCard(null); setCurrentWaveDamage(0); setWaveDistDamage([0,0,0,0]); setWaveBuffs({}); // WAVE毎リセットのバフ・デバフ(waveEnemyAtkDebuff/chuuniDmgCutUses/enemyTakenDmgBonus等)を全てクリア
    return dist;
  }, [getNextEnemyAction, difficulty]);

  // defValは呼び出し元が直前に算出したばかりの丈夫さ(setDefで更新中の値)を明示的に渡すための引数。
  // handleReward等のsetTimeout内からdef(state)を直接読むと、同じ関数呼び出し内で行ったsetDefの
  // 結果がまだ反映されていない「一つ前のレンダーの値」を掴んでしまう(クロージャの陳腐化)ため、
  // 必ず呼び出し元が保持している最新のローカル値を渡す
  const initBattle = (w, s, u, t, defVal) => {
    setWave(w);
    const currentSlots = s||slots;
    const dist = spawnEnemy(w);
    const nAtkL = computeAtkTier(currentSlots, dist);
    const nGrdL = computeGuardLevel(defVal!==undefined?defVal:def);
    const nGB = nGrdL;
    setAtkLevel(nAtkL); setGuardLevel(nGrdL); setGuardBonusCount(nGB);
    const pool=buildDeck(currentSlots,nAtkL,nGrdL,u||ownedUniques,t||ownedTeachings,nGB,slotUniqueChoice,slotUniqueLevelChoice);
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
      // 合流ボーナスに間合い適性も加算する。合流したモンスターの適性値をCを±0とした
      // 段階数に直し、プラスマイナス問わずそのまま足す(A(+2)なら+2段階、E(-2)なら-2段階)
      const aptDelta=getMonsterAptDelta(m);
      if (aptDelta.some(d=>d!==0)) setDistAptBonus(prev=>prev.map((v,i)=>v+aptDelta[i]));
      const aptLabel=aptDelta.map((d,i)=>d!==0?`${RANGE_LABELS[i]}${d>0?'+':''}${d}`:null).filter(Boolean).join(' ');
      const newAllyUnique={...m.unique,evoLevel:0}; setOwnedUniques([...ownedUniques,newAllyUnique]);
      setUpgradePoints(prev=>prev+(Math.floor(Math.random()*4)+1));
      setEffect({type:'mega',label:`${m.name}合流！`,icon:"🤝",monEmoji:m.emoji,imgUrl:m.imgUrl,subLabel:`HP:${bHp}→${nMaxHp}  ちから:${bAtk}→${nAtk}\n丈夫さ:${bDef}→${nDef}  ガッツ:${bGuts}→${nMaxGuts}${aptLabel?`\n間合い適性:${aptLabel}`:''}`});
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
    setTimeout(()=>{setOwnedTeachings(nextTeachings); if(!enemy) initBattle(testMooMode?ENEMY_SEQUENCE.length:1,slots,ownedUniques,nextTeachings,def); else initBattle(wave+1,slots,ownedUniques,nextTeachings,def); setSelectedTeachingCard(null);},150);
  };

  const handleReward = (type) => {
    if (effect) return;
    // 攻撃強化・防御強化はステータスのみ上昇させる(技レベル・防御カード枚数は距離適性/丈夫さから
    // 自動算出されるため、ここでは直接いじらない)
    let nMaxHp=maxHp, nAtk=atk, nDef=def, nMaxGuts=maxGuts;
    if(type==='atk'){nAtk=Math.floor(atk*1.10);}
    else if(type==='def'){nDef=Math.floor((def+20)*1.10); nMaxHp=Math.floor(maxHp*1.20);}
    else if(type==='hp'){nMaxGuts=Math.floor((maxGuts+10)*1.1);}
    setMaxHp(nMaxHp); setAtk(nAtk); setDef(nDef); setMaxGuts(nMaxGuts);
    const nGrdL=computeGuardLevel(nDef);
    const guardLevelUp=type==='def'&&nGrdL>computeGuardLevel(def);
    const guardName=GUARD_EVOLUTION[nGrdL].name;
    setEffect({type:'heal',label:guardLevelUp?`${guardName}解放！ 枚数UP`:(type==='def'?"丈夫さUP":"能力覚醒完了"),icon:type==='def'?"🛡️":"⚡",monEmoji:"🆙",subLabel:guardLevelUp?`丈夫さが100上がるごとに、デッキの防御カードが自動で [${guardName}] へ進化し、枚数も増えます。`:''});
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
      } else { initBattle(wave+1,slots,ownedUniques,ownedTeachings,nDef); }
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

  // ブリーダーカードの効果説明。表記は全カードで次のルールに統一している。
  //  ・区切りは中黒「・」だけを使う(以前は「＆」「＋」「/」「()」が混在していた)
  //  ・増減は「アップ」「ダウン」と書く(以前は「UP」「DOWN」「+」が混在していた)
  //  ・ステータス名は画面表記に合わせて「ライフ」「ガッツ」「攻撃」に統一する
  //    (以前は「HP」「G」「攻」など略称が混在していた)
  //  ・数値と単位の間は詰め、項目名と数値の間は半角スペースを入れる
  const getDynamicDesc = (t, isOwned, level) => {
    const pct=(v)=>Math.round(v*100);
    if(t.id==='oryo') return `攻撃 ${pct(0.1+level*0.1)}%アップ`;
    if(t.id==='dra') return `被ダメージ ${[3,6,10][level]}%ダウン`;
    if(t.id==='cadmium'){
      const tier=CADMIUM_TIERS[Math.min(level,CADMIUM_TIERS.length-1)];
      const parts=[];
      if(tier.autoHp>0) parts.push(`ライフ自動回復 ${pct(tier.autoHp)}%アップ`);
      if(tier.autoGuts>0) parts.push(`ガッツ自動回復 ${pct(tier.autoGuts)}%アップ`);
      if(tier.hpLimit>0&&tier.hpLimit===tier.gutsLimit) parts.push(`ライフ/ガッツ上限 ${pct(tier.gutsLimit)}%アップ`);
      else { if(tier.hpLimit>0) parts.push(`ライフ上限 ${pct(tier.hpLimit)}%アップ`); if(tier.gutsLimit>0) parts.push(`ガッツ上限 ${pct(tier.gutsLimit)}%アップ`); }
      return parts.join('・');
    }
    if(t.id==='mua') return level===0?"ライフ 50%回復・ライフ/攻撃/ガッツ上限 3%アップ":(level===1?"ライフ・ガッツ 70%回復・ライフ上限 5%アップ・攻撃 3%アップ・ガッツ上限 3%アップ":"ライフ・ガッツ 90%回復・ライフ上限 8%アップ・攻撃 5%アップ・ガッツ上限 5%アップ");
    if(t.id==='atsu') return `このターン敵の行動を無効・攻撃 ${(t.baseValue+level*t.step).toFixed(1)}倍`;
    if(t.id==='myaru'){const v=t.baseValue+level*t.step, d=pct(Math.max(0.1,t.selfDmg-level*t.dmgStep)); return `次ターン攻撃 ${v.toFixed(1)}倍・自傷 ${d}%`;}
    return t.desc;
  };
  const getFullEvolutionDetails = (t) => [0,1,2].map(lvl=>({lvl,name:BREEDER_EVO_NAMES[t.id][lvl],desc:getDynamicDesc(t,true,lvl)}));
  // 消費ガッツはgetCardGutsと同じ式(基礎ガッツ×現在倍率/基礎倍率)でレベルごとに再計算する(技威力が上がるほど消費ガッツも増える)
  const getAtkSkillLevels = (mon) => { const names=HERO_ATK_NAMES[mon.id]||HERO_ATK_NAMES['Mocchi']; return [0,1,2,3,4,5,6,7,8].map(lvl=>{const e=BASE_ATK_EVOLUTION[lvl]; return {lvl,name:names[lvl],power:Math.floor(e.mult*100),crit:Math.round(e.crit*100),guts:Math.floor(e.baseGuts*(e.mult/e.baseMult))};}); };
  const getUniqueSkillLevels = (mon) => [0,1,2,3,4,5,6,7,8].map(lvl=>{const curMult=mon.unique.baseMult+lvl*0.5; return {lvl,name:mon.unique.names[lvl],power:Math.floor(curMult*100),crit:Math.round((0.10+0.05*Math.min(lvl,8))*100),guts:Math.floor(mon.unique.baseGuts*(curMult/mon.unique.baseMult))};});
  // モンスター詳細系のポップアップ(編成画面/勇者選択画面など)で共通利用する、通常技・固有技セクション(タップでレベル別詳細)
  const renderSkillSection = (mon) => (<>
    <button onClick={()=>setRosterSkillDetail({mon,kind:'atk'})} className="w-full text-left bg-slate-800/50 p-3 rounded-2xl border border-white/10 shrink-0 active:scale-95 transition-all"><div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1"><div className="flex items-center gap-2"><Sword size={12} className="text-red-400"/><span className="text-[10px] font-black uppercase">通常技: {(HERO_ATK_NAMES[mon.id]||HERO_ATK_NAMES['Mocchi'])[0]}</span></div><ChevronRight size={12} className="text-slate-500"/></div><div className="flex gap-4 text-[9px] font-mono"><span className="text-red-400 font-bold">技威力 {Math.floor(BASE_ATK_EVOLUTION[0].mult*100)}</span><span className="text-amber-400 font-bold">消費G {BASE_ATK_EVOLUTION[0].baseGuts}</span></div></button>
    <button onClick={()=>setRosterSkillDetail({mon,kind:'unique'})} className="w-full text-left bg-slate-800/50 p-3 rounded-2xl border border-white/10 shrink-0 active:scale-95 transition-all"><div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1"><div className="flex items-center gap-2"><Zap size={12} className="text-amber-400"/><span className="text-[10px] font-black uppercase">固有技: {mon.unique.name}</span></div><ChevronRight size={12} className="text-slate-500"/></div><div className="flex gap-4 text-[9px] font-mono mb-2"><span className="text-red-400 font-bold">技威力 {Math.floor(mon.unique.baseMult*100)}</span><span className="text-amber-400 font-bold">消費G {mon.unique.baseGuts}</span></div><div className="text-[9px] text-slate-300 leading-relaxed italic">"{mon.unique.effectDesc}"</div></button>
  </>);

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
                <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-500 leading-none uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,1)] whitespace-nowrap">Monster Hero</h1>
                <p className="text-purple-300 text-[9px] tracking-[0.4em] uppercase font-bold mt-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Grand Champion Quest</p>
                {/* バージョン表示。BUILD_DATE(JSTの日付+時刻)をそのまま出す */}
                <div className="text-purple-400/70 text-[8px] font-mono tracking-widest mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">ver {BUILD_DATE}</div>
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
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={()=>setGameState('PROFILE')} className="w-full bg-slate-900 border border-violet-500/50 text-violet-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-2"><User size={14}/> Profile</button>
                  <button onClick={()=>{setRankingViewDiff(difficulty); setShowRanking(true); loadRankings();}} className="w-full bg-slate-900 border border-indigo-500/50 text-indigo-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-2"><Users size={14}/> Ranking</button>
                  <button onClick={()=>setShowHelp(true)} className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-2"><HelpCircle size={14}/> Help</button>
                  <button onClick={openChangelog} className="relative w-full bg-slate-900 border border-amber-500/50 text-amber-400 py-2.5 rounded-xl font-black text-xs active:scale-95 uppercase flex items-center justify-center gap-1"><Sparkles size={14}/>更新{hasUnreadChangelog&&<span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full border border-white/40 shadow">NEW</span>}</button>
                </div>
                <button onClick={()=>setShowAudioSettings(true)} className={`w-full border py-2 rounded-xl font-black text-[11px] active:scale-95 uppercase flex items-center justify-center gap-2 ${audioMuted?'bg-slate-900 border-slate-600/50 text-slate-400':'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'}`}>{audioMuted?'🔇':'🔊'} 音量設定</button>
              </div>
            </div>
            {/* 更新履歴: 更新情報と不具合情報をタブで切り替える。エントリはdata/changelog.jsに追記する */}
            {showChangelog&&(
              <div className="fixed inset-0 z-[9500] flex flex-col items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.94)',zIndex:95000}}>
                <div className="bg-slate-900 border border-amber-500/50 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col" style={{maxHeight:'85vh'}}>
                  <div className="flex items-center justify-between p-4 pb-2 shrink-0">
                    <h3 className="text-base font-black text-white uppercase flex items-center gap-2"><Sparkles size={18} className="text-amber-400"/>更新履歴</h3>
                    <button onClick={()=>setShowChangelog(false)} className="p-2 text-slate-400 active:scale-90"><X size={18}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-4 pb-3 shrink-0">
                    {[{key:'update',label:'更新情報'},{key:'issue',label:'不具合情報'}].map(t=>(
                      <button key={t.key} onClick={()=>setChangelogTab(t.key)} className={`py-2 rounded-xl font-black text-[11px] uppercase border active:scale-95 ${changelogTab===t.key?'bg-amber-600 border-amber-400 text-white':'bg-slate-800 border-white/10 text-slate-400'}`}>{t.label}</button>
                    ))}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto mh-scroll px-4 pb-4 space-y-2.5">
                    {(()=>{
                      const list=(typeof CHANGELOG!=='undefined'?CHANGELOG:[]).filter(c=>c.type===changelogTab);
                      if(!list.length) return (<div className="text-center text-[11px] text-slate-500 py-8">まだ{changelogTab==='update'?'更新情報':'不具合情報'}はありません</div>);
                      return list.map((c,idx)=>{
                        const isNew=c.date>changelogSeenAtOpen;
                        const st=c.status?CHANGELOG_STATUS[c.status]:null;
                        return (
                          <div key={idx} className="bg-black/40 border border-white/10 rounded-2xl p-3">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className="text-[9px] font-mono text-slate-500">{c.date}</span>
                              {isNew&&<span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">NEW</span>}
                              {st&&<span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>}
                            </div>
                            <div className="text-[12px] font-black text-white mb-1.5">{c.title}</div>
                            <ul className="space-y-1">
                              {(c.items||[]).map((it,i)=>(<li key={i} className="text-[10px] text-slate-300 leading-relaxed flex gap-1.5"><span className="text-amber-500 shrink-0">・</span><span>{it}</span></li>))}
                            </ul>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
            {showAudioSettings&&(
              <div className="fixed inset-0 z-[9500] flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:95000}}>
                <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-black text-white flex items-center gap-2">{audioMuted?'🔇':'🔊'} 音量設定</h3>
                    <button onClick={()=>setShowAudioSettings(false)} className="p-1.5 bg-white/10 rounded-full active:scale-90"><X size={16}/></button>
                  </div>
                  {!audioOn && <div className="text-[9px] text-slate-500 font-bold mb-3">操作すると音が有効になります</div>}
                  <button onClick={toggleQuickMute} className={`w-full border py-2.5 rounded-xl font-black text-xs uppercase active:scale-95 mt-2 mb-4 flex items-center justify-center gap-2 ${audioMuted?'bg-slate-800 border-slate-600/50 text-slate-300':'bg-indigo-600 border-indigo-400 text-white'}`}>{audioMuted?'🔇 音がオフです（タップでオン）':'🔊 音はオンです（タップでオフ）'}</button>
                  <div className="flex flex-col gap-3">
                    <VolumeSlider label="SE" icon="🔔" value={seVolume} onChange={changeSeVolume} gradient="from-cyan-500 to-indigo-500" thumbRing="border-indigo-400"/>
                    <VolumeSlider label="BGM" icon="🎵" value={bgmVolume} onChange={changeBgmVolume} gradient="from-fuchsia-500 to-pink-500" thumbRing="border-fuchsia-400"/>
                  </div>
                  <button onClick={()=>setShowAudioSettings(false)} className="w-full bg-white text-black py-3 rounded-xl font-black text-xs uppercase active:scale-95 mt-5">閉じる</button>
                </div>
              </div>
            )}
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
                        <div className="mt-2 bg-black/40 rounded-xl p-2 border border-white/5">
                          {(()=>{ const heroMember = r.party&&r.party.find(p=>p?.name===r.hero); return (
                            <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30 w-fit max-w-full"><Crown size={8} className="text-amber-400 shrink-0"/>{heroMember?.imgUrl?(<img src={heroMember.imgUrl} alt="hero" className="w-5 h-5 object-contain shrink-0"/>):(<span className="text-[10px] shrink-0">{heroMember?.emoji||'👑'}</span>)}<span className="text-[10px] font-black text-white ml-1 truncate">{r.hero}</span>{heroMember?.bondLevel!=null&&<span className="text-[7px] font-black text-pink-300 ml-0.5 shrink-0">Lv.{heroMember.bondLevel}</span>}</div>
                          ); })()}
                          {r.party&&r.party.some(p=>p&&p.name!==r.hero)&&(
                            <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 mt-1.5">
                              {r.party.filter(p=>p&&p.name!==r.hero).map((p,idx)=>(<div key={idx} className="flex items-center gap-0.5 min-w-0">{p.imgUrl?<img src={p.imgUrl} alt="sub" className="w-5 h-5 object-contain shrink-0"/>:<span className="text-[9px] shrink-0">{p.emoji}</span>}<span className="text-[8px] font-bold text-slate-300 truncate">{p.name}</span>{p.bondLevel!=null&&<span className="text-[7px] font-black text-pink-300 shrink-0">Lv{p.bondLevel}</span>}</div>))}
                            </div>
                          )}
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
              <button onClick={()=>{ if(!onboarded){ setOnboarded(true); storeSet('mh_onboarded', true, false); } setGameState('TITLE'); }} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
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
                <button onClick={()=>setGameState('OWNED_MONSTERS')} className="flex flex-col items-center justify-center gap-1 bg-cyan-950/40 border border-cyan-500/40 px-2 py-2.5 rounded-xl active:scale-95">
                  <span className="flex items-center gap-1 text-[9px] font-black text-cyan-400 uppercase"><User size={11}/>モンスター一覧</span>
                  <span className="text-[12px] font-black text-cyan-200">{unlockedMonsterIds.length}体</span>
                </button>
                <button onClick={()=>setGameState('MASU_MONS')} className="flex flex-col items-center justify-center gap-1 bg-pink-950/40 border border-pink-500/40 px-2 py-2.5 rounded-xl active:scale-95">
                  <span className="flex items-center gap-1 text-[9px] font-black text-pink-400 uppercase"><Heart size={11}/>マスモン</span>
                  <span className="text-[12px] font-black text-pink-200">{masuMons.length}体</span>
                </button>
                <button onClick={()=>setGameState('ITEM_INVENTORY')} className="flex flex-col items-center justify-center gap-1 bg-teal-950/40 border border-teal-500/40 px-2 py-2.5 rounded-xl active:scale-95">
                  <span className="flex items-center gap-1 text-[9px] font-black text-teal-400 uppercase"><Package size={11}/>アイテム欄</span>
                  <span className="text-[12px] font-black text-teal-200">{Object.values(ownedItems).reduce((sum,n)=>sum+(n||0),0)}個</span>
                </button>
                <button onClick={()=>{ if(masuMons.length<2) return; resetFusionFlow(); setGameState('MASU_FUSION'); }} disabled={masuMons.length<2} className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl ${masuMons.length<2?'bg-slate-900/60 border border-slate-800 opacity-50':'bg-violet-950/40 border border-violet-500/40 active:scale-95'}`}>
                  <span className="flex items-center gap-1 text-[9px] font-black text-violet-400 uppercase"><Sparkles size={11}/>合体</span>
                  <span className="text-[12px] font-black text-violet-200">{masuMons.length<2?'2体〜':'マスモン同士'}</span>
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
              <button onClick={()=>setGameState('PROFILE')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
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
              {[{key:'icon',label:'アイコン'},{key:'disc',label:'円盤石'},{key:'breeder',label:'ブリーダー'},{key:'item',label:'アイテム'}].map(tab=>(
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
                  const usesGold = item.type==='disc' || item.type==='breeder' || item.type==='item';
                  const balance = usesGold ? gold : breederPoints;
                  const canBuy = !comingSoon && !owned && balance>=item.cost;
                  const detailMon = item.type==='disc' ? ALL_PLAYER_MONSTERS[item.id] : null;
                  const detailTeaching = item.type==='breeder' ? TEACHING_CARDS.find(t=>t.id===item.id) : null;
                  return (
                    <div key={item.id} className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-2 ${owned?'bg-emerald-900/30 border-emerald-500/50':comingSoon?'bg-slate-900/60 border-slate-800/60':'bg-slate-900 border-slate-800'}`}>
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center bg-black/30 ${comingSoon?'grayscale opacity-50':''}`}>{item.icon?<img src={item.icon} alt={item.name} className="w-full h-full object-cover"/>:<span className="text-3xl">{item.emoji}</span>}</div>
                      <div className={`text-xs font-black ${comingSoon?'text-slate-500':'text-white'}`}>{item.name}</div>
                      {item.type==='item'&&item.desc&&(<div className="text-[8px] text-slate-400 text-center leading-tight">{item.desc}</div>)}
                      {item.type==='item'&&(ownedItems[item.id]||0)>0&&(<div className="text-[9px] font-black text-cyan-300">所持数: {ownedItems[item.id]}</div>)}
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
              <button onClick={()=>setGameState('PROFILE')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">{rosterTab==='monster'?'モンスター編成':'ブリーダーカード編成'}</h2>
            </div>
            {rosterTab==='monster'?(
              <div className="flex-1 min-h-0 flex flex-col">
                {/* 編成中のモンスターを小さいアイコンで並べ、タップで編成から外せる */}
                <div className="flex items-center gap-2 mb-2 shrink-0 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl px-2 py-2">
                  <span className="text-[9px] font-black text-indigo-300 shrink-0 leading-tight">編成中<br/>{draftMonsterRoster.length}/{STARTER_MONSTER_IDS.length}</span>
                  <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide min-h-[36px] items-center">
                    {draftMonsterRoster.length===0?(
                      <span className="text-[9px] text-slate-600 font-bold">まだ選ばれていません</span>
                    ):(draftMonsterRoster.map(entryId=>{
                      const isMasu = entryId.startsWith('masu:');
                      const masu = isMasu ? getMasuMon(entryId.slice(5)) : null;
                      const base = isMasu ? (masu && ALL_PLAYER_MONSTERS[masu.baseId]) : ALL_PLAYER_MONSTERS[entryId];
                      if (!base) return null;
                      return (
                        <button key={entryId} onClick={()=>toggleDraftMonster(entryId)} className="shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-400 active:scale-90 relative">
                          {isMasu?(<DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/>):(<img src={base.iconUrl} alt={base.name} className="w-full h-full object-cover"/>)}
                        </button>
                      );
                    }))}
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 font-bold mb-1 px-1 shrink-0">解放済み{unlockedMonsterIds.length}体・ちょうど{STARTER_MONSTER_IDS.length}体選ぶと「決定」できます・アイコンタップで編成/解除、iボタンで詳細・同じ種は1体まで(マスモン含む)</div>
                {renderMonsterSortFilterBar()}
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="grid grid-cols-3 gap-3 pb-4">
                    {unifiedMonsterEntriesDraft.map(e=>{
                      if (e.type==='base') {
                        const m = e.base;
                        const selected = e.active;
                        return (
                          <div key={e.key} className="relative">
                            <button onClick={()=>toggleDraftMonster(e.entryId)} className={`w-full rounded-2xl border-2 p-2 flex flex-col items-center gap-1.5 active:scale-95 select-none ${selected?'bg-indigo-900/40 border-indigo-400 ring-2 ring-indigo-400':'bg-slate-900 border-slate-800'}`}>
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0"><img src={m.iconUrl} alt={m.name} draggable={false} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="w-full h-full object-cover"/></div>
                              <div className="text-[10px] font-black text-white truncate w-full text-center">{m.name}</div>
                              {monsterDisplayFlags.active&&<div className={`text-[8px] font-black px-2 py-0.5 rounded-full ${selected?'bg-indigo-500 text-white':'bg-slate-800 text-slate-500'}`}>{selected?'選択中':'未選択'}</div>}
                            </button>
                            <button onClick={(ev)=>{ev.stopPropagation(); setRosterDetailMon(m);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                          </div>
                        );
                      }
                      const masu = e.masu, base = e.base, selected = e.active;
                      const lvl = bondLevelInfo(masu.bondXp || 0);
                      return (
                        <div key={e.key} className="relative">
                          <button onClick={()=>toggleDraftMonster(e.entryId)} className={`w-full rounded-2xl border-2 p-2 flex flex-col items-center gap-1.5 active:scale-95 select-none ${selected?'bg-pink-900/40 border-pink-400 ring-2 ring-pink-400':'bg-slate-900 border-pink-900/50'}`}>
                            <div className="relative w-10 h-10 shrink-0">
                              <div className={`w-10 h-10 rounded-full overflow-hidden border ${(masu.fusionHistory||[]).length>0?'border-amber-400 ring-1 ring-amber-400':'border-pink-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="w-full h-full object-cover"/></div>
                              <div className="absolute -top-1 -right-1 bg-pink-500 rounded-full px-1 text-[6px] font-black text-white leading-tight">マスモン</div>
                              {monsterDisplayFlags.fused&&(masu.fusionHistory||[]).length>0&&<div className="absolute -bottom-1 -left-1 bg-amber-500 rounded-full px-1 text-[6px] font-black text-black leading-tight">+{masu.fusionHistory.length}</div>}
                            </div>
                            <div className="text-[10px] font-black text-pink-200 truncate w-full text-center">{masu.name}</div>
                            <div className="w-full">
                              <div className="text-[8px] text-pink-300 font-black flex items-center gap-0.5 mb-0.5"><Heart size={7}/>絆Lv.{lvl.level}</div>
                              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${Math.max(0,Math.min(100,(lvl.xpIntoLevel/Math.max(1,lvl.xpForNext))*100))}%`}}></div></div>
                            </div>
                            {monsterDisplayFlags.active&&<div className={`text-[8px] font-black px-2 py-0.5 rounded-full ${selected?'bg-pink-500 text-white':'bg-slate-800 text-slate-500'}`}>{selected?'選択中':'未選択'}</div>}
                          </button>
                          <button onClick={(ev)=>{ev.stopPropagation(); setMasuMonDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button onClick={confirmMonsterRoster} disabled={draftMonsterRoster.length!==STARTER_MONSTER_IDS.length} className={`w-full py-3 rounded-2xl font-black text-sm mt-2 shrink-0 ${draftMonsterRoster.length===STARTER_MONSTER_IDS.length?'bg-indigo-500 text-white active:scale-95':'bg-slate-800 text-slate-500'}`}>決定 ({draftMonsterRoster.length}/{STARTER_MONSTER_IDS.length})</button>
              </div>
            ):(
              <div className="flex-1 min-h-0 flex flex-col">
                {/* 編成中のブリーダーカードを小さいアイコンで並べ、タップで編成から外せる */}
                <div className="flex items-center gap-2 mb-2 shrink-0 bg-purple-950/30 border border-purple-500/30 rounded-2xl px-2 py-2">
                  <span className="text-[9px] font-black text-purple-300 shrink-0 leading-tight">編成中<br/>{draftTeachingRoster.length}/{STARTER_TEACHING_IDS.length}</span>
                  <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide min-h-[36px] items-center">
                    {draftTeachingRoster.length===0?(
                      <span className="text-[9px] text-slate-600 font-bold">まだ選ばれていません</span>
                    ):(draftTeachingRoster.map(id=>{
                      const t = TEACHING_CARDS.find(tc=>tc.id===id);
                      if (!t) return null;
                      return (
                        <button key={id} onClick={()=>toggleDraftTeaching(id)} className="shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-purple-400 active:scale-90 flex items-center justify-center bg-black/30">{cardIconNode(t.icon,32)}</button>
                      );
                    }))}
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 font-bold mb-2 px-1 shrink-0">解放済み{unlockedTeachingIds.length}枚・ちょうど{STARTER_TEACHING_IDS.length}枚選ぶと「決定」できます・アイコンタップで編成/解除、iボタンで詳細</div>
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="grid grid-cols-3 gap-3 pb-4">
                    {unlockedTeachingIds.map(id=>TEACHING_CARDS.find(t=>t.id===id)).filter(Boolean).map(t=>{
                      const selected = draftTeachingRoster.includes(t.id);
                      return (
                        <div key={t.id} className="relative">
                          <button onClick={()=>toggleDraftTeaching(t.id)} className={`w-full rounded-2xl border-2 p-2 flex flex-col items-center gap-1.5 active:scale-95 select-none ${selected?'bg-purple-900/40 border-purple-400 ring-2 ring-purple-400':'bg-slate-900 border-slate-800'}`}>
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0 flex items-center justify-center bg-black/30">{cardIconNode(t.icon,40)}</div>
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
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:31000}}>
            <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
              <div className="flex items-center gap-4 border-b border-white/10 pb-4 shrink-0">
                {rosterDetailMon.imgUrl?(<DyedMonsterImage baseId={rosterDetailMon.id} src={rosterDetailMon.imgUrl} alt={rosterDetailMon.name} masuColors={rosterDetailMon.colors} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110"/>):(<div className="text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{rosterDetailMon.emoji}</div>)}
                <div className="flex-1"><h3 className="text-xl font-black text-white">{rosterDetailMon.name}</h3><div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Monster Profile</div><div className="text-[8px] text-slate-500 font-bold mt-1">勇者モンとして選んでラン終了時に登録すると「マスモン」化できます</div></div>
                <button onClick={()=>setRosterDetailMon(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5"><div className="text-[7px] text-slate-500 uppercase font-bold">基本ステータス</div><div className="space-y-1 mt-1"><div className="flex justify-between text-[10px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{rosterDetailMon.baseHp}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{rosterDetailMon.baseAtk}</span></div><div className="flex justify-between text-[10px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{rosterDetailMon.baseDef}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{rosterDetailMon.baseGuts}</span></div></div></div>
                  <div className="bg-black/40 p-2 rounded-xl border border-indigo-500/30"><div className="text-[7px] text-indigo-400 uppercase font-bold">勇者特性</div><div className="text-[9px] text-white font-bold leading-tight mt-1">{rosterDetailMon.traitDesc}</div></div>
                </div>
                <div className="bg-black/40 p-2 rounded-xl border border-pink-500/30"><div className="text-[7px] text-pink-400 uppercase font-bold">合流ボーナス</div><div className="text-[8px] text-white font-bold mt-1">{rosterDetailMon.plusStats.hp>0&&`HP+${rosterDetailMon.plusStats.hp} `}{rosterDetailMon.plusStats.atk>0&&`攻+${rosterDetailMon.plusStats.atk} `}{rosterDetailMon.plusStats.def>0&&`防+${rosterDetailMon.plusStats.def} `}{rosterDetailMon.plusStats.guts>0&&`G+${rosterDetailMon.plusStats.guts} `}</div>{formatAptBonus(rosterDetailMon)&&<div className="text-[8px] text-cyan-300 font-bold mt-0.5">間合い適性 {formatAptBonus(rosterDetailMon)}</div>}</div>
                <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/30"><div className="text-[7px] text-cyan-400 uppercase font-bold mb-1">間合い適性</div><div className="grid grid-cols-4 gap-1 mt-1">{RANGE_LABELS.map((label,idx)=>{const grade=getDistAptitude(rosterDetailMon,idx); return(<div key={idx} className="flex flex-col items-center gap-0.5"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span><span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span></div>);})}</div></div>
                {renderSkillSection(rosterDetailMon)}
              </div>
              <button onClick={()=>setRosterDetailMon(null)} className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg mt-2 shrink-0 active:scale-95">閉じる</button>
            </div>
          </div>
        )}
        {rosterDetailTeaching&&(()=>{const owned=ownedTeachings.find(ot=>ot.id===rosterDetailTeaching.id); const currentLvl=owned?owned.evoLevel:-1; return(
          <div className="fixed inset-0 flex items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:31000}}>
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

        {/* モンスター一覧(解放済みの種を一覧表示・タップで詳細) */}
        {gameState==='OWNED_MONSTERS'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('PROFILE')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-cyan-400 uppercase tracking-widest">モンスター一覧</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-1 px-1 shrink-0">解放済み{unlockedMonsterIds.length}体・タップで詳細を確認できます</div>
            {renderMonsterSortFilterBar({ singleType: true })}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              <div className="grid grid-cols-3 gap-2.5 pb-4">
                {unifiedMonsterEntriesActive.filter(e=>e.type==='base').map(e=>{
                  const m = e.base;
                  const masuCount = masuMons.filter(ms=>ms.baseId===m.id).length;
                  return (
                    <div key={e.key} className="relative">
                      <button onClick={()=>setRosterDetailMon(m)} className="w-full rounded-2xl border-2 border-slate-800 bg-slate-900 p-2 flex flex-col items-center gap-1.5 active:scale-95">
                        <div className="w-14 h-14 rounded-full overflow-hidden border border-white/10 shrink-0"><img src={m.iconUrl} alt={m.name} draggable={false} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="w-full h-full object-cover"/></div>
                        <div className="text-[10px] font-black text-white truncate w-full text-center">{m.name}</div>
                        <div className="text-[7px] text-pink-400 font-bold">{masuCount>0?`マスモン${masuCount}体`:'マスモン未登録'}</div>
                        {monsterDisplayFlags.active&&e.active&&<div className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500 text-white mt-0.5">編成中</div>}
                      </button>
                      <button onClick={(ev)=>{ev.stopPropagation(); setRosterDetailMon(m);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* マスモン一覧: ラン終了時に登録した固有インスタンス。タップで詳細・改名・強化ポイント使用 */}
        {gameState==='MASU_MONS'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('PROFILE')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-pink-400 uppercase tracking-widest">マスモン</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-1 px-1 shrink-0">勇者モンをラン終了時に登録すると、ここに並びます。編成画面で選ぶと次の周回で使えます(同じ種は1体まで)。</div>
            {renderMonsterSortFilterBar({ singleType: true })}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              {(()=>{
                const entries = unifiedMonsterEntriesActive.filter(e=>e.type==='masu');
                if (entries.length===0) return (
                  <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>🐾</span><div className="text-[11px] text-slate-400 mt-2">{masuMons.length===0?<>まだマスモンがいません。<br/>勇者モンでランを終えると登録できます。</>:'表示設定で対象がすべてオフになっています。'}</div></div>
                );
                return (
                  <div className="grid grid-cols-3 gap-2.5 pb-4">
                    {entries.map(e=>{
                      const masu = e.masu, base = e.base;
                      const lvl = bondLevelInfo(masu.bondXp||0);
                      const pct = Math.max(0, Math.min(100, (lvl.xpIntoLevel/Math.max(1,lvl.xpForNext))*100));
                      const fusionCount = (masu.fusionHistory||[]).length;
                      return (
                        <div key={e.key} className="relative">
                          <button onClick={()=>setMasuMonDetail(masu)} className="w-full rounded-2xl border-2 border-pink-900/50 bg-slate-900 p-2 flex flex-col items-center gap-1 active:scale-95">
                            <div className="relative w-12 h-12 shrink-0">
                              <div className={`w-12 h-12 rounded-full overflow-hidden border ${fusionCount>0?'border-amber-400 ring-1 ring-amber-400':'border-pink-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="w-full h-full object-cover"/></div>
                              {monsterDisplayFlags.fused&&fusionCount>0&&<div className="absolute -bottom-1 -left-1 bg-amber-500 rounded-full px-1 text-[6px] font-black text-black leading-tight">+{fusionCount}</div>}
                            </div>
                            <div className="text-[9px] font-black text-pink-200 truncate w-full text-center">{masu.name}</div>
                            <div className="w-full mt-0.5">
                              <div className="text-[7px] text-pink-300 font-black flex items-center gap-0.5"><Heart size={6}/>絆Lv.{lvl.level}</div>
                              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 mt-0.5"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pct}%`}}></div></div>
                            </div>
                            {(masu.distAptPoints||0)>0&&<div className="text-[7px] text-amber-300 font-black flex items-center gap-0.5 mt-0.5"><Sparkles size={7}/>強化P {masu.distAptPoints}</div>}
                            {monsterDisplayFlags.active&&e.active&&<div className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-pink-500 text-white mt-0.5">編成中</div>}
                          </button>
                          <button onClick={(ev)=>{ev.stopPropagation(); setMasuMonDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 合体: マスモン同士を合体させ、副の絆経験値を主に受け継ぐ。主選択→副選択→確認→演出→結果の5段階 */}
        {gameState==='MASU_FUSION'&&(()=>{
          const closeFusion = () => { resetFusionFlow(); setGameState('PROFILE'); };
          const fusedBorder = (masu) => (masu.fusionHistory||[]).length>0 ? 'border-amber-400 ring-1 ring-amber-400' : 'border-violet-400/40';
          // 合体の仕様説明。何が引き継がれて何が消えるのか、固有技の引き継ぎ条件は何かが
          // 画面から読み取れず分かりにくかったため、選択画面の余白に常設で出す
          const fusionGuide = (
            <div className="shrink-0 mt-2 bg-black/40 border border-violet-500/30 rounded-2xl p-3 space-y-1.5">
              <div className="text-[9px] font-black text-violet-300 uppercase tracking-wider">合体のルール</div>
              <div className="text-[9px] text-slate-300 leading-relaxed">・<span className="text-white font-bold">主</span>が残り、<span className="text-white font-bold">副</span>は消滅します。副の絆経験値は累計のまま主に加算されます</div>
              <div className="text-[9px] text-slate-300 leading-relaxed">・上がった絆レベルの数だけ、主が<span className="text-amber-300 font-bold">強化ポイント</span>を獲得します</div>
              <div className="text-[9px] text-slate-300 leading-relaxed">・主の名前・見た目・間合い適性・ステータス強化は<span className="text-white font-bold">そのまま維持</span>されます(副の強化は引き継がれません)</div>
              <div className="text-[9px] text-slate-300 leading-relaxed">・消費ダイヤは<span className="text-cyan-300 font-bold">(主の絆Lv＋副の絆Lv)×100</span>です</div>
              <div className="text-[9px] text-amber-200 leading-relaxed border-t border-white/10 pt-1.5">・<span className="font-bold">固有技の引き継ぎ</span>は、<span className="font-bold">主と副が両方とも絆Lv.10以上</span>のときだけ選べます。条件を満たすと副の固有技が主に記録されます</div>
            </div>
          );

          if (fusionStep==='main') {
            return (
              <div className="flex-1 flex flex-col h-full min-h-0 p-4">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <button onClick={closeFusion} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                  <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体・主を選ぶ</h2>
                </div>
                <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">絆経験値を受け継いで残る「主」となるマスモンを選んでください</div>
                {fusionGuide}
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="grid grid-cols-3 gap-2.5 pb-4">
                    {masuMons.map(masu=>{
                      const base = ALL_PLAYER_MONSTERS[masu.baseId];
                      if (!base) return null;
                      const lvl = bondLevelInfo(masu.bondXp||0);
                      return (
                        <div key={masu.id} className="relative">
                          <button onClick={()=>{setFusionMainId(masu.id); setFusionStep('sub');}} className="w-full rounded-2xl border-2 border-violet-900/50 bg-slate-900 p-2 flex flex-col items-center gap-1 active:scale-95">
                            <div className={`w-12 h-12 rounded-full overflow-hidden border shrink-0 ${fusedBorder(masu)}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                            <div className="text-[9px] font-black text-violet-200 truncate w-full text-center">{masu.name}</div>
                            <div className="text-[7px] text-pink-300 font-black flex items-center gap-0.5"><Heart size={6}/>絆Lv.{lvl.level}</div>
                          </button>
                          <button onClick={(ev)=>{ev.stopPropagation(); setMasuMonDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          if (fusionStep==='sub') {
            const main = getMasuMon(fusionMainId);
            if (!main) { resetFusionFlow(); return null; }
            const candidates = masuMons.filter(m=>m.id!==fusionMainId);
            return (
              <div className="flex-1 flex flex-col h-full min-h-0 p-4">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <button onClick={()=>{setFusionMainId(null); setFusionStep('main');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                  <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体・副を選ぶ</h2>
                </div>
                <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">「{main.name}」に絆経験値を渡す「副」を選んでください。副は合体後にいなくなります</div>
                {fusionGuide}
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  {candidates.length===0?(
                    <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>💫</span><div className="text-[11px] text-slate-400 mt-2">合体できる他のマスモンがいません。</div></div>
                  ):(
                    <div className="grid grid-cols-3 gap-2.5 pb-4">
                      {candidates.map(masu=>{
                        const base = ALL_PLAYER_MONSTERS[masu.baseId];
                        if (!base) return null;
                        const lvl = bondLevelInfo(masu.bondXp||0);
                        return (
                          <div key={masu.id} className="relative">
                            <button onClick={()=>{setFusionSubId(masu.id); setFusionStep('confirm');}} className="w-full rounded-2xl border-2 border-violet-900/50 bg-slate-900 p-2 flex flex-col items-center gap-1 active:scale-95">
                              <div className={`w-12 h-12 rounded-full overflow-hidden border shrink-0 ${fusedBorder(masu)}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                              <div className="text-[9px] font-black text-violet-200 truncate w-full text-center">{masu.name}</div>
                              <div className="text-[7px] text-pink-300 font-black flex items-center gap-0.5"><Heart size={6}/>絆Lv.{lvl.level}</div>
                            </button>
                            <button onClick={(ev)=>{ev.stopPropagation(); setMasuMonDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (fusionStep==='confirm') {
            const main = getMasuMon(fusionMainId);
            const sub = getMasuMon(fusionSubId);
            if (!main || !sub) { resetFusionFlow(); return null; }
            const mainBase = ALL_PLAYER_MONSTERS[main.baseId];
            const subBase = ALL_PLAYER_MONSTERS[sub.baseId];
            if (!mainBase || !subBase) { resetFusionFlow(); return null; }
            const mainLvl = bondLevelInfo(main.bondXp||0);
            const subLvl = bondLevelInfo(sub.bondXp||0);
            const cost = (mainLvl.level + subLvl.level) * 100;
            const canAfford = gold >= cost;
            const canChooseInherit = mainLvl.level>=10 && subLvl.level>=10 && !!subBase.unique;
            return (
              <div className="flex-1 flex flex-col h-full min-h-0 p-4">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <button onClick={()=>{setFusionSubId(null); setFusionStep('sub');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                  <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体の確認</h2>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-violet-400 shrink-0"><DyedMonsterImage baseId={main.baseId} src={mainBase.iconUrl} alt={main.name} masuColors={getMasuColors(main)} className="w-full h-full object-cover"/></div>
                      <div className="text-[9px] font-black text-violet-200">{main.name}</div>
                      <div className="text-[7px] text-amber-300 font-black">主(残る)</div>
                    </div>
                    <Sparkles size={20} className="text-amber-300"/>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-500 shrink-0"><DyedMonsterImage baseId={sub.baseId} src={subBase.iconUrl} alt={sub.name} masuColors={getMasuColors(sub)} className="w-full h-full object-cover"/></div>
                      <div className="text-[9px] font-black text-slate-300">{sub.name}</div>
                      <div className="text-[7px] text-slate-500 font-black">副(消える)</div>
                    </div>
                  </div>
                  <div className="bg-black/40 p-3 rounded-xl border border-violet-500/30 mb-2 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">受け継ぐ絆経験値</span><span className="text-pink-300 font-black">{(sub.bondXp||0).toLocaleString()} XP</span></div>
                    <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">必要ダイヤ</span><span className={`font-black flex items-center gap-1 ${canAfford?'text-amber-300':'text-red-400'}`}><Gem size={10}/>{cost.toLocaleString()}</span></div>
                    <div className="text-[7px] text-slate-500">({main.name}絆Lv.{mainLvl.level} + {sub.name}絆Lv.{subLvl.level}) × 100</div>
                    {!canAfford&&<div className="text-[8px] text-red-400 font-black">ダイヤが足りません(所持: {gold.toLocaleString()})</div>}
                  </div>
                  {canChooseInherit && (
                    <button onClick={()=>setFusionInheritUnique(v=>!v)} className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border mb-2 active:scale-95 ${fusionInheritUnique?'bg-amber-950/50 border-amber-500':'bg-slate-900 border-slate-800'}`}>
                      <span className="text-[10px] font-black text-left text-white">「{sub.name}」の固有技「{subBase.unique.name}」を引き継ぐ<br/><span className="text-[7px] text-slate-500 font-bold">※データとして記録のみ。現在はバトルで使用できません</span></span>
                      <div className={`w-9 h-5 rounded-full shrink-0 relative ${fusionInheritUnique?'bg-amber-500':'bg-slate-700'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${fusionInheritUnique?'left-4':'left-0.5'}`}></div></div>
                    </button>
                  )}
                  <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3 mb-2">
                    <div className="text-[9px] text-red-300 font-black flex items-center gap-1 mb-1"><AlertCircle size={11}/>注意</div>
                    <div className="text-[8px] text-red-200/90 leading-relaxed">合体すると副の「{sub.name}」はいなくなります。この操作は取り消せません。</div>
                  </div>
                </div>
                <button onClick={()=>{
                  if (!canAfford) return;
                  const result = executeMasuFusion();
                  if (!result) return;
                  setFusionResultData(result);
                  setFusionStep('anim');
                  Audio_.se.fusion();
                }} disabled={!canAfford} className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg shrink-0 mt-1 flex items-center justify-center gap-2 ${canAfford?'bg-violet-600 text-white active:scale-95':'bg-slate-800 text-slate-600'}`}><Sparkles size={16}/>合体する</button>
              </div>
            );
          }

          if (fusionStep==='anim') {
            const d = fusionResultData;
            if (!d) return null;
            return (
              <div className="fixed inset-0 flex items-center justify-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.97)',zIndex:32000,overflow:'hidden'}}>
                {fusionAnimPhase>=3&&(<div className="absolute inset-0" style={{animation:'fusionFlashFade 700ms ease-out forwards'}}></div>)}
                <div className="flex items-center justify-center gap-6 relative">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-violet-400 shadow-[0_0_30px_rgba(167,139,250,0.6)] bg-slate-900" style={{animation: fusionAnimPhase===1?'fusionSlideInLeft 700ms ease-out forwards':fusionAnimPhase>=2?'fusionMergeShake 600ms ease-in-out':'none'}}>
                    {d.mainIconUrl?(<DyedMonsterImage baseId={d.mainBaseId} src={d.mainIconUrl} alt={d.mainName} masuColors={d.mainColors} className="w-full h-full object-cover"/>):(<div className="w-full h-full flex items-center justify-center text-5xl">{d.mainEmoji}</div>)}
                  </div>
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-400 shadow-[0_0_30px_rgba(148,163,184,0.5)] bg-slate-900" style={{animation: fusionAnimPhase===1?'fusionSlideInRight 700ms ease-out forwards':fusionAnimPhase>=2?'fusionMergeShake 600ms ease-in-out':'none'}}>
                    {d.subIconUrl?(<DyedMonsterImage baseId={d.subBaseId} src={d.subIconUrl} alt={d.subName} masuColors={d.subColors} className="w-full h-full object-cover"/>):(<div className="w-full h-full flex items-center justify-center text-5xl">{d.subEmoji}</div>)}
                  </div>
                  {fusionAnimPhase>=3&&(
                    <div className="absolute left-1/2 top-1/2 rounded-full bg-white" style={{width:'40px',height:'40px',marginLeft:'-20px',marginTop:'-20px',animation:'fusionFlashBurst 700ms ease-out forwards'}}></div>
                  )}
                </div>
              </div>
            );
          }

          // result
          const d = fusionResultData;
          if (!d) { resetFusionFlow(); return null; }
          const pctAfter = Math.max(0,Math.min(100,(d.after.xpIntoLevel/Math.max(1,d.after.xpForNext))*100));
          return (
            <div className="fixed inset-0 flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.97)',zIndex:32000}}>
              <Sparkles size={32} className="text-amber-300 mb-2"/>
              <h2 className="text-lg font-black text-white mb-1">合体完了！</h2>
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)] mb-3 bg-slate-900">
                {d.mainIconUrl?(<DyedMonsterImage baseId={d.mainBaseId} src={d.mainIconUrl} alt={d.mainName} masuColors={d.mainColors} className="w-full h-full object-cover"/>):(<div className="w-full h-full flex items-center justify-center text-5xl">{d.mainEmoji}</div>)}
              </div>
              <div className="text-sm font-black text-white text-center mb-3">{d.mainName}が「{d.subName}」の絆経験値<span className="text-pink-300"> {d.gainedXp.toLocaleString()} XP</span>を受け継いだ！</div>
              <div className="w-full max-w-xs bg-black/40 border border-pink-500/30 rounded-2xl p-3 mb-2">
                <div className="flex justify-between text-[9px] text-pink-300 font-black mb-1"><span>絆Lv.{d.before.level}</span><span>→</span><span>絆Lv.{d.after.level}</span></div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pctAfter}%`}}></div></div>
                {d.gainedLevels>0&&<div className="text-[9px] text-emerald-400 font-black text-center mt-1">絆レベルが{d.gainedLevels}上がった！</div>}
              </div>
              {d.inherited&&(<div className="text-[10px] text-amber-300 font-black bg-amber-950/50 border border-amber-500/40 rounded-xl px-3 py-1.5 mb-2">「{d.subName}」の固有技を継承データとして記録しました</div>)}
              <div className="text-[9px] text-slate-500 font-bold mb-4">ダイヤを{d.cost.toLocaleString()}消費しました</div>
              <button onClick={()=>{ resetFusionFlow(); setGameState('MASU_MONS'); }} className="w-full max-w-xs bg-violet-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95">とじる</button>
            </div>
          );
        })()}

        {/* アイテム欄: 所持している消耗アイテムを一覧表示し、「使う」から対象のマスモンを選ぶ */}
        {gameState==='ITEM_INVENTORY'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('PROFILE')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-teal-400 uppercase tracking-widest">アイテム欄</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">マーケットで買った消耗アイテムです。「使う」から対象のマスモンを選べます。</div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              {BREEDER_MARKET_ITEMS.filter(item=>item.type==='item'&&(ownedItems[item.id]||0)>0).length===0?(
                <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>🎒</span><div className="text-[11px] text-slate-400 mt-2">まだアイテムを持っていません。<br/>マーケットの「アイテム」タブから購入できます。</div></div>
              ):(
                <div className="flex flex-col gap-2 pb-4">
                  {BREEDER_MARKET_ITEMS.filter(item=>item.type==='item'&&(ownedItems[item.id]||0)>0).map(item=>(
                    <div key={item.id} className="rounded-2xl border-2 border-teal-900/50 bg-slate-900 p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center bg-black/30">{item.icon?<img src={item.icon} alt={item.name} className="w-full h-full object-cover"/>:<span className="text-2xl">{item.emoji}</span>}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-white truncate">{item.name}</div>
                        <div className="text-[8px] text-slate-400 leading-tight mt-0.5">{item.desc}</div>
                        <div className="text-[9px] font-black text-teal-300 mt-0.5">所持数: {ownedItems[item.id]}</div>
                      </div>
                      <button onClick={()=>setPendingItemUse(item.id)} className="shrink-0 bg-teal-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 uppercase">使う</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* アイテムの使用対象マスモンを選ぶ画面(アイテム欄で「使う」を押した直後) */}
        {pendingItemUse&&(()=>{
          const item = BREEDER_MARKET_ITEMS.find(i=>i.id===pendingItemUse);
          return (
            <div className="fixed inset-0 flex flex-col p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.97)',zIndex:31000,paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <button onClick={()=>setPendingItemUse(null)} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                <h2 className="text-lg font-black italic text-teal-400 uppercase tracking-widest truncate">{item?.name}を使う対象を選択</h2>
              </div>
              <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">対象のマスモンをタップしてください</div>
              <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                {masuMons.length===0?(
                  <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>🐾</span><div className="text-[11px] text-slate-400 mt-2">まだマスモンがいません。</div></div>
                ):(
                  <div className="grid grid-cols-4 gap-2 pb-4">
                    {masuMons.map(masu=>{
                      const base = ALL_PLAYER_MONSTERS[masu.baseId];
                      if (!base) return null;
                      const lvl = bondLevelInfo(masu.bondXp||0);
                      return (
                        <button key={masu.id} onClick={()=>{
                          if (pendingItemUse==='dye_mock') {
                            const n = dyeRegionCount(masu.baseId);
                            const cur = getMasuColors(masu);
                            setDyeTargetMasuId(masu.id); setDyePreviewColors(Array.from({length:n},(_,i)=>cur[i]||null)); setPendingItemUse(null);
                          } else if (pendingItemUse==='bond_reset_scroll') {
                            if (window.confirm(`「${masu.name}」の強化ポイント(間合い適性・ステータス強化)をすべて未使用に戻しますか？絆Lvはそのままです。`)) { useBondResetScroll(masu.id); setPendingItemUse(null); }
                          }
                        }} className="rounded-2xl border-2 border-teal-900/50 bg-slate-900 p-1.5 flex flex-col items-center gap-0.5 active:scale-95">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-teal-400/40 shrink-0"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                          <div className="text-[9px] font-black text-teal-200 truncate w-full text-center">{masu.name}</div>
                          <div className="text-[6px] text-slate-500 font-bold -mt-0.5 truncate w-full text-center">({base.name})</div>
                          <div className="text-[7px] text-pink-300 font-black flex items-center gap-0.5"><Heart size={6}/>絆Lv.{lvl.level}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ならべかえ・表示設定モーダル: 編成/ベースモン一覧/マスモン一覧のMonsterSortFilterBarから開く。
            以前は横スクロールの小さいチップだったが押しづらいという指摘を受け、フルスクリーンの
            タブ切り替え+大きいボタン方式に変更した */}
        {showSortFilterModal&&(()=>{
          const sortOpts = sortFilterModalSingleType ? MONSTER_SORT_OPTIONS.filter(o => o.key !== 'base' && o.key !== 'masu') : MONSTER_SORT_OPTIONS;
          const dispOpts = sortFilterModalSingleType ? MONSTER_DISPLAY_OPTIONS.filter(o => o.key !== 'base' && o.key !== 'masu') : MONSTER_DISPLAY_OPTIONS;
          return (
            <div className="fixed inset-0 flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.98)',zIndex:32500,paddingTop:'env(safe-area-inset-top)'}}>
              <div className="flex items-center gap-2 p-4 shrink-0 border-b border-white/10">
                <h3 className="text-base font-black text-white flex-1">ならべかえ・表示設定</h3>
                <button onClick={()=>setShowSortFilterModal(false)} className="p-2.5 bg-white/5 rounded-full active:scale-90"><X size={18}/></button>
              </div>
              <div className="flex gap-2 px-4 pt-3 shrink-0">
                {[{key:'sort',label:'ならべかえ'},{key:'display',label:'表示設定'}].map(tab=>(
                  <button key={tab.key} onClick={()=>setSortFilterModalTab(tab.key)} style={{minHeight:'44px'}} className={`flex-1 rounded-xl text-xs font-black uppercase active:scale-95 ${sortFilterModalTab===tab.key?'bg-indigo-500 text-white':'bg-slate-900 border border-slate-800 text-slate-400'}`}>{tab.label}</button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto mh-scroll p-4">
                {sortFilterModalTab==='sort'?(
                  <div className="grid grid-cols-2 gap-2.5">
                    {sortOpts.map(opt=>{
                      const active = monsterSortKey===opt.key;
                      return (
                        <button key={opt.key} onClick={()=>{ if (active) setMonsterSortDir(d=>d==='asc'?'desc':'asc'); else { setMonsterSortKey(opt.key); setMonsterSortDir('asc'); } }} style={{minHeight:'56px'}} className={`rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 ${active?'bg-indigo-500 text-white ring-2 ring-indigo-300':'bg-slate-900 border border-slate-800 text-slate-300'}`}>
                          {opt.label}{active&&<span>{monsterSortDir==='asc'?'▲':'▼'}</span>}
                        </button>
                      );
                    })}
                  </div>
                ):(
                  <div className="grid grid-cols-2 gap-2.5">
                    {dispOpts.map(opt=>{
                      const on = !!monsterDisplayFlags[opt.key];
                      return (
                        <button key={opt.key} onClick={()=>setMonsterDisplayFlags(prev=>({...prev,[opt.key]:!prev[opt.key]}))} style={{minHeight:'56px'}} className={`rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 ${on?'bg-teal-600 text-white ring-2 ring-teal-300':'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                          {on&&<Check size={15}/>}{opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button onClick={()=>setShowSortFilterModal(false)} className="mx-4 mb-4 bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95 shrink-0">とじる</button>
            </div>
          );
        })()}

        {masuMonDetail&&gameState!=='MASU_ENHANCE'&&(()=>{
          const masu = getMasuMon(masuMonDetail.id) || masuMonDetail;
          const base = ALL_PLAYER_MONSTERS[masu.baseId];
          if (!base) { setMasuMonDetail(null); return null; }
          const lvl = bondLevelInfo(masu.bondXp||0);
          const pct = Math.max(0, Math.min(100, (lvl.xpIntoLevel/Math.max(1,lvl.xpForNext))*100));
          const inRoster = monsterRosterIds.includes('masu:'+masu.id);
          return (
            <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:31000}}>
              <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
                <div className="flex items-center gap-4 border-b border-white/10 pb-4 shrink-0">
                  <div className="relative w-20 h-20 shrink-0">
                    <div className={`w-20 h-20 rounded-full overflow-hidden border ${(masu.fusionHistory||[]).length>0?'border-amber-400 ring-2 ring-amber-400':'border-pink-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                    {(masu.fusionHistory||[]).length>0&&<div className="absolute -bottom-1 -left-1 bg-amber-500 rounded-full px-1.5 py-0.5 text-[8px] font-black text-black leading-tight">+{masu.fusionHistory.length}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button onClick={()=>{setMasuRenameInput(masu.name); setShowMasuRenameModal(true);}} className="flex items-center gap-1.5 active:scale-95">
                      <h3 className="text-lg font-black text-white truncate">{masu.name}</h3><Edit3 size={12} className="text-slate-500 shrink-0"/>
                    </button>
                    <div className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">マスモン・元は{base.name}</div>
                    <div className="mt-1">
                      <div className="text-[9px] text-pink-300 font-black flex items-center gap-1"><Heart size={9}/>絆Lv.{lvl.level}</div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 mt-0.5"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pct}%`}}></div></div>
                      <div className="text-[7px] text-pink-400/70 font-mono mt-0.5">{lvl.xpIntoLevel.toLocaleString()} / {lvl.xpForNext.toLocaleString()} XP</div>
                    </div>
                  </div>
                  <button onClick={()=>setMasuMonDetail(null)} className="p-2 bg-white/5 rounded-full active:scale-90 shrink-0"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5"><div className="text-[7px] text-slate-500 uppercase font-bold">現在のステータス(強化分込み)</div><div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1"><div className="flex justify-between text-[10px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{base.baseHp+(masu.statPoints?.hp||0)}{(masu.statPoints?.hp||0)>0&&<span className="text-emerald-400 text-[8px]"> (+{masu.statPoints.hp})</span>}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{base.baseAtk+(masu.statPoints?.atk||0)}{(masu.statPoints?.atk||0)>0&&<span className="text-emerald-400 text-[8px]"> (+{masu.statPoints.atk})</span>}</span></div><div className="flex justify-between text-[10px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{base.baseDef+(masu.statPoints?.def||0)}{(masu.statPoints?.def||0)>0&&<span className="text-emerald-400 text-[8px]"> (+{masu.statPoints.def})</span>}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{base.baseGuts+(masu.statPoints?.guts||0)}{(masu.statPoints?.guts||0)>0&&<span className="text-emerald-400 text-[8px]"> (+{masu.statPoints.guts})</span>}</span></div></div></div>
                  {(()=>{const ps=mergeMasuIntoMon(masu)?.plusStats||{}; return(<div className="bg-black/40 p-2 rounded-xl border border-pink-500/30"><div className="text-[7px] text-pink-400 uppercase font-bold">合流ボーナス</div><div className="text-[8px] text-white font-bold mt-1">{ps.hp>0&&`HP+${ps.hp} `}{ps.atk>0&&`攻+${ps.atk} `}{ps.def>0&&`防+${ps.def} `}{ps.guts>0&&`G+${ps.guts} `}</div>{formatAptBonus(mergeMasuIntoMon(masu))&&<div className="text-[8px] text-cyan-300 font-bold mt-0.5">間合い適性 {formatAptBonus(mergeMasuIntoMon(masu))}</div>}</div>);})()}
                  <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/30"><div className="flex items-center justify-between mb-0.5"><div className="text-[7px] text-cyan-400 uppercase font-bold">間合い適性</div><div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {masu.distAptPoints||0}</div></div><div className="grid grid-cols-4 gap-1 mt-1">{RANGE_LABELS.map((label,idx)=>{const grade=(masu.distApt&&masu.distApt[idx])||'C'; return(<div key={idx} className="flex flex-col items-center gap-0.5"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span><span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span></div>);})}</div></div>
                  <button onClick={()=>{setMasuEnhanceFrom(gameState); setGameState('MASU_ENHANCE');}} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-2.5 rounded-xl font-black text-[11px] uppercase active:scale-95 flex items-center justify-center gap-1.5 shadow-lg"><Sparkles size={13}/>強化する{(masu.distAptPoints||0)>0&&<span className="bg-white/25 px-1.5 rounded-full text-[9px]">強化P {masu.distAptPoints}</span>}</button>
                  {(masu.fusionHistory||[]).length>0&&(
                    <div className="bg-black/40 p-2 rounded-xl border border-amber-500/30">
                      <div className="text-[7px] text-amber-400 uppercase font-bold mb-1 flex items-center gap-1"><Sparkles size={9}/>合体履歴</div>
                      <div className="space-y-1">
                        {masu.fusionHistory.map((h,idx)=>(
                          <div key={idx} className="text-[8px] text-slate-300 font-bold flex items-center justify-between gap-1 bg-black/30 rounded-lg px-2 py-1">
                            <span className="truncate">{h.subName}（{ALL_PLAYER_MONSTERS[h.subBaseId]?.name||'?'}）と合体{h.inherited&&<span className="text-amber-300">(固有技継承)</span>}</span>
                            <span className="text-pink-300 font-black shrink-0">+{h.xpGained.toLocaleString()}XP</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(masu.inheritedUniques||[]).length>0&&(
                    <div className="bg-black/40 p-2 rounded-xl border border-amber-500/30">
                      <div className="text-[7px] text-amber-400 uppercase font-bold mb-1">継承した固有技(バトル中にスロットのバッジをタップで切替可能)</div>
                      <div className="space-y-1">
                        {masu.inheritedUniques.map((u,idx)=>(
                          <div key={idx} className="text-[8px] text-amber-200 font-bold bg-black/30 rounded-lg px-2 py-1">{u.name}<span className="text-slate-500 font-normal">(元{u.sourceMasuName})</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[8px] text-slate-500 font-bold text-center px-2">{inRoster?'現在、編成に入っています':'編成画面で選ぶと、次の周回でこのマスモンを使えます'}</div>
                  <div className="text-[8px] text-teal-400/80 font-bold text-center px-2">絆ポイントリセットの書・染色もどきは「アイテム欄」から使用できます</div>
                  <button onClick={()=>{ if(window.confirm(`「${masu.name}」を削除しますか？この操作は取り消せません。`)){ deleteMasuMon(masu.id); setMasuMonDetail(null); } }} className="w-full bg-red-950/40 border border-red-500/30 text-red-400 py-2.5 rounded-xl font-black text-[10px] uppercase active:scale-95">このマスモンを削除する</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* マスモン強化: 専用ページ(間合い適性・ステータス強化を、変動値のプレビュー付きで行う) */}
        {gameState==='MASU_ENHANCE'&&masuMonDetail&&(()=>{
          const masu = getMasuMon(masuMonDetail.id) || masuMonDetail;
          const base = ALL_PLAYER_MONSTERS[masu.baseId];
          if (!base) { setGameState(masuEnhanceFrom||'MASU_MONS'); setMasuMonDetail(null); setMasuEnhanceFrom(null); return null; }
          const lvl = bondLevelInfo(masu.bondXp||0);
          const pct = Math.max(0, Math.min(100, (lvl.xpIntoLevel/Math.max(1,lvl.xpForNext))*100));
          const points = masu.distAptPoints||0;
          const currentStatValue = (key) => ({hp:base.baseHp,atk:base.baseAtk,def:base.baseDef,guts:base.baseGuts}[key]||0) + (masu.statPoints?.[key]||0);
          const ps = mergeMasuIntoMon(masu)?.plusStats||{};
          const backToList = () => { setGameState(masuEnhanceFrom||'MASU_MONS'); setMasuMonDetail(null); setMasuEnhanceFrom(null); };
          return (
            <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 p-4 shrink-0 border-b border-white/10" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
                <button onClick={backToList} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-black italic text-amber-400 uppercase tracking-widest flex-1">マスモン強化</h2>
              </div>
              <div className="flex-1 overflow-y-auto mh-scroll p-4 space-y-3 max-w-md mx-auto w-full">
                <div className="flex items-center gap-4 bg-slate-900 border border-amber-500/30 rounded-3xl p-4 shadow-xl">
                  <div className="relative w-20 h-20 shrink-0">
                    <div className={`w-20 h-20 rounded-full overflow-hidden border ${(masu.fusionHistory||[]).length>0?'border-amber-400 ring-2 ring-amber-400':'border-amber-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                    {(masu.fusionHistory||[]).length>0&&<div className="absolute -bottom-1 -left-1 bg-amber-500 rounded-full px-1.5 py-0.5 text-[8px] font-black text-black leading-tight">+{masu.fusionHistory.length}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-white truncate">{masu.name}</h3>
                    <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">マスモン・元は{base.name}</div>
                    <div className="mt-1">
                      <div className="text-[9px] text-pink-300 font-black flex items-center gap-1"><Heart size={9}/>絆Lv.{lvl.level}</div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 mt-0.5"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pct}%`}}></div></div>
                    </div>
                  </div>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-amber-500/40 flex items-center justify-between">
                  <div className="text-[10px] text-amber-300 uppercase font-black flex items-center gap-1.5"><Sparkles size={12}/>強化ポイント</div>
                  <div className="text-xl text-white font-black font-mono">{points}</div>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">現在のステータス(強化分込み)</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1"><div className="flex justify-between text-[11px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{currentStatValue('hp')}{(masu.statPoints?.hp||0)>0&&<span className="text-emerald-400 text-[9px]"> (+{masu.statPoints.hp})</span>}</span></div><div className="flex justify-between text-[11px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{currentStatValue('atk')}{(masu.statPoints?.atk||0)>0&&<span className="text-emerald-400 text-[9px]"> (+{masu.statPoints.atk})</span>}</span></div><div className="flex justify-between text-[11px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{currentStatValue('def')}{(masu.statPoints?.def||0)>0&&<span className="text-emerald-400 text-[9px]"> (+{masu.statPoints.def})</span>}</span></div><div className="flex justify-between text-[11px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{currentStatValue('guts')}{(masu.statPoints?.guts||0)>0&&<span className="text-emerald-400 text-[9px]"> (+{masu.statPoints.guts})</span>}</span></div></div>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-pink-500/30">
                  <div className="text-[8px] text-pink-400 uppercase font-bold">合流ボーナス(このマスモンが供モンとして合流した時に加算される値)</div>
                  <div className="text-[10px] text-white font-bold mt-1">{ps.hp>0&&`HP+${ps.hp} `}{ps.atk>0&&`攻+${ps.atk} `}{ps.def>0&&`防+${ps.def} `}{ps.guts>0&&`G+${ps.guts} `}{!(ps.hp>0||ps.atk>0||ps.def>0||ps.guts>0)&&'なし'}</div>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-cyan-500/30">
                  <div className="text-[9px] text-cyan-400 uppercase font-bold mb-2">間合い適性を強化</div>
                  <div className="grid grid-cols-4 gap-2">
                    {RANGE_LABELS.map((label,idx)=>{
                      const grade=(masu.distApt&&masu.distApt[idx])||'C';
                      const gIdx=DIST_APTITUDE_GRADES.indexOf(grade);
                      const nextGrade=gIdx<DIST_APTITUDE_GRADES.length-1?DIST_APTITUDE_GRADES[gIdx+1]:null;
                      const canUp=points>0&&nextGrade;
                      return(
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span>
                          <span className={`w-full text-center py-1 rounded-lg border text-base font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span>
                          <span className="text-[7px] text-slate-500 font-mono h-3">{nextGrade?`次: ${nextGrade}`:'MAX'}</span>
                          <button disabled={!canUp} onClick={()=>{
                            const beforeGrade=grade;
                            const updated=spendAptPoint(masu.id,idx);
                            if(!updated) return;
                            setMasuMonDetail(updated);
                            const afterGrade=(updated.distApt&&updated.distApt[idx])||beforeGrade;
                            setEffect({type:'enhance',label:`${label}距離適性 強化！`,icon:'📈',monEmoji:base.emoji,imgUrl:base.iconUrl,subLabel:`${label}距離適性 ${beforeGrade} → ${afterGrade}`});
                            setTimeout(()=>setEffect(null),900);
                          }} className="w-full text-[9px] font-black bg-amber-600 text-white rounded-lg py-1 active:scale-95 disabled:opacity-20 disabled:bg-slate-700">+1</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-emerald-500/30">
                  <div className="text-[9px] text-emerald-400 uppercase font-bold mb-2">ステータスを強化</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(STAT_POINT_KEYS).map(([key,label])=>{
                      const before=currentStatValue(key);
                      const gain=STAT_POINT_GAIN[key]||1;
                      const after=before+gain;
                      return(
                        <button key={key} disabled={points<=0} onClick={()=>{
                          const updated=spendStatPoint(masu.id,key);
                          if(!updated) return;
                          setMasuMonDetail(updated);
                          setEffect({type:'enhance',label:`${label}強化！`,icon:'💪',monEmoji:base.emoji,imgUrl:base.iconUrl,subLabel:`${label} ${before} → ${after}`});
                          setTimeout(()=>setEffect(null),900);
                        }} className="flex flex-col items-center gap-1 bg-emerald-950/50 border border-emerald-500/30 rounded-xl py-2.5 active:scale-95 disabled:opacity-20">
                          <span className="text-[9px] text-emerald-300 font-black">{label}</span>
                          <span className="text-[11px] text-white font-mono font-black">{before} → <span className="text-emerald-400">{after}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={backToList} className="w-full bg-white text-black py-3.5 rounded-2xl font-black text-sm uppercase active:scale-95 shadow-lg mt-2">完了</button>
              </div>
            </div>
          );
        })()}

        {/* 染色もどき: 対象マスモンを選んだ後の部位別色選択・合成プレビューモーダル */}
        {dyeTargetMasuId&&(()=>{
          const masu = getMasuMon(dyeTargetMasuId);
          const base = masu && ALL_PLAYER_MONSTERS[masu.baseId];
          if (!masu || !base) { setDyeTargetMasuId(null); setDyePreviewColors([]); return null; }
          const closeDyePicker = () => { setDyeTargetMasuId(null); setDyePreviewColors([]); setCustomColorPicker(null); };
          const regionCount = dyeRegionCount(masu.baseId);
          const curColors = getMasuColors(masu);
          const regionLabels = ['①','②','③'];
          const noChange = Array.from({length:regionCount},(_,i)=>(dyePreviewColors[i]||null)===(curColors[i]||null)).every(Boolean);
          const hasAnyColor = dyePreviewColors.some(Boolean);
          return (
            <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:31500}}>
              <div className="bg-slate-900 border-2 border-fuchsia-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-3 shadow-2xl max-h-full overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-black text-white">🎨 {masu.name}の色をプレビュー</h3>
                  <button onClick={closeDyePicker} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
                </div>
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-fuchsia-400/40 mx-auto shrink-0"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={dyePreviewColors} className="w-full h-full object-cover"/></div>
                <div className="text-[9px] text-fuchsia-300 font-black text-center -mt-1 shrink-0">{hasAnyColor?'プレビュー中(合成後の見た目です)':'現在の色のまま'}</div>
                {regionCount===1&&(
                  <div className="text-[8px] text-slate-500 font-bold text-center px-2 -mt-1 shrink-0">このモンスターは全身一括の染色のみ対応しています</div>
                )}
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2">
                  {Array.from({length:regionCount}).map((_,idx)=>(
                    <div key={idx} className="bg-black/30 rounded-xl p-2 border border-white/5">
                      <div className="text-[8px] text-fuchsia-300 font-black uppercase mb-1">{regionCount>1?`染色${regionLabels[idx]||idx+1}`:'染色'}</div>
                      <div className="grid grid-cols-6 gap-0.5">
                        <button onClick={()=>setDyePreviewColors(prev=>{const next=[...prev]; next[idx]=null; return next;})} className={`flex flex-col items-center gap-0.5 bg-black/40 border rounded-lg py-1 active:scale-95 ${!dyePreviewColors[idx]?'border-fuchsia-400 ring-2 ring-fuchsia-400':'border-white/10'}`}>
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center" style={{background:'conic-gradient(#ef4444,#eab308,#22c55e,#3b82f6,#ef4444)'}}><RotateCcw size={7} className="text-white drop-shadow"/></span>
                          <span className="text-[5.5px] text-white font-black leading-none">元の色</span>
                        </button>
                        {Object.keys(MASU_COLOR_TARGET).map(colorId=>(
                          <button key={colorId} onClick={()=>setDyePreviewColors(prev=>{const next=[...prev]; next[idx]=colorId; return next;})} className={`flex flex-col items-center gap-0.5 bg-black/40 border rounded-lg py-1 active:scale-95 ${dyePreviewColors[idx]===colorId?'border-fuchsia-400 ring-2 ring-fuchsia-400':'border-white/10'}`}>
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{backgroundColor:MASU_COLOR_SWATCH[colorId]}}></span>
                          <span className="text-[5.5px] text-white font-black leading-none">{MASU_COLOR_LABELS[colorId]}</span>
                        </button>
                        ))}
                        <button onClick={()=>{
                          const cur = dyePreviewColors[idx];
                          const parsed = cur && _parseCustomColorId(cur);
                          setCustomColorPicker({ idx, h: parsed?.h ?? 210, s: parsed?.s ?? 0.7, v: parsed?.v ?? 0.7 });
                        }} className={`flex flex-col items-center gap-0.5 bg-black/40 border rounded-lg py-1 active:scale-95 ${_parseCustomColorId(dyePreviewColors[idx])?'border-fuchsia-400 ring-2 ring-fuchsia-400':'border-white/10'}`}>
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{background:_parseCustomColorId(dyePreviewColors[idx])?getColorSwatchHex(dyePreviewColors[idx]):'conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#d946ef,#ef4444)'}}></span>
                          <span className="text-[5.5px] text-white font-black leading-none">カスタム</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-1 shrink-0">
                  <button onClick={closeDyePicker} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-black text-xs uppercase">キャンセル</button>
                  <button onClick={()=>{ useDyeItem(masu.id, dyePreviewColors); closeDyePicker(); }} disabled={noChange} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase ${noChange?'bg-slate-800 text-slate-600':'bg-fuchsia-600 text-white active:scale-95'}`}>この色に染める</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 染色もどき: カスタム色選択(色相バー+彩度・明度パッドのスペクトラムピッカー) */}
        {customColorPicker&&(()=>{
          const { idx, h, s, v } = customColorPicker;
          const masu = getMasuMon(dyeTargetMasuId);
          const base = masu && ALL_PLAYER_MONSTERS[masu.baseId];
          const applyCustom = () => {
            setDyePreviewColors(prev => { const next = [...prev]; next[idx] = _encodeCustomColorId(h, s, v); return next; });
            setCustomColorPicker(null);
          };
          // ドラッグ中は毎フレームcolorIdが変わり染色エンジンの再描画(Canvas処理)が大量発生するため、
          // プレビュー表示だけは色相/彩度/明度を粗く丸めて再描画の頻度を抑える(確定時は元の値をそのまま使う)
          const previewColorId = _encodeCustomColorId(Math.round(h / 4) * 4, Math.round(s * 20) / 20, Math.round(v * 20) / 20);
          const previewColors = dyePreviewColors.map((c, i) => i === idx ? previewColorId : c);
          return (
            <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.94)',zIndex:32000}}>
              <div className="bg-slate-900 border-2 border-fuchsia-500 rounded-3xl p-5 w-full max-w-xs flex flex-col gap-3 shadow-2xl">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-black text-white">🎨 カスタムカラー</h3>
                  <button onClick={()=>setCustomColorPicker(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
                </div>
                {masu&&base&&(
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-fuchsia-400/40 mx-auto shrink-0"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={previewColors} className="w-full h-full object-cover"/></div>
                )}
                <CustomColorPicker h={h} s={s} v={v} onChange={(nh,ns,nv)=>setCustomColorPicker(prev=>prev?{...prev, h:nh, s:ns, v:nv}:prev)}/>
                <div className="flex gap-2 mt-1 shrink-0">
                  <button onClick={()=>setCustomColorPicker(null)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-black text-xs uppercase">キャンセル</button>
                  <button onClick={applyCustom} className="flex-1 py-3 rounded-xl font-black text-xs uppercase bg-fuchsia-600 text-white active:scale-95">この色に決定</button>
                </div>
              </div>
            </div>
          );
        })()}

        {showMasuRenameModal&&masuMonDetail&&(
          <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:91000}}>
            <div className="bg-slate-900 border border-pink-500 rounded-3xl p-6 w-full max-w-xs shadow-2xl">
              <h3 className="text-lg font-black text-white mb-1">マスモンの名前を変更</h3>
              <input type="text" value={masuRenameInput} onChange={e=>setMasuRenameInput(e.target.value.slice(0,12))} maxLength={12} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white font-bold text-center mb-4"/>
              <div className="flex gap-2">
                <button onClick={()=>setShowMasuRenameModal(false)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-bold text-xs">戻る</button>
                <button onClick={()=>{ renameMasuMon(masuMonDetail.id, masuRenameInput); setMasuMonDetail(prev=>prev?{...prev, name:(masuRenameInput||'').trim().slice(0,12)||prev.name}:prev); setShowMasuRenameModal(false); }} className="flex-1 bg-pink-600 text-white py-3 rounded-xl font-black text-xs">保存</button>
              </div>
            </div>
          </div>
        )}

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
              <div className="flex items-center gap-2"><div className="text-[10px] font-mono font-black text-amber-500 flex items-center gap-1 uppercase tracking-tighter mr-1"><Award size={10}/> {score.toLocaleString()}</div><button onClick={toggleQuickMute} className="p-1.5 bg-slate-800 rounded text-slate-300 active:scale-90 text-[12px] leading-none w-[26px] h-[26px] flex items-center justify-center">{audioMuted?'🔇':'🔊'}</button><button onClick={()=>setShowHelp(true)} className="p-1.5 bg-slate-800 rounded text-emerald-400 active:scale-90"><HelpCircle size={14}/></button><button onClick={()=>setShowQuitConfirm(true)} className="p-1.5 bg-slate-800 rounded text-slate-400 active:scale-90"><Flag size={14}/></button></div>
            </header>
            {enemy&&(
              <div className="shrink-0 bg-slate-950/95 border-b border-red-900/40 px-4 py-1.5 z-[6400] shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
                <div className="flex justify-between items-center text-[10px] font-black italic uppercase tracking-tighter mb-1">
                  <span className={`flex items-center gap-1 ${wave===10?'text-red-500 animate-pulse':'text-slate-200'}`}><Skull size={11}/> {enemy.name} <span className={`ml-1 px-2 py-0.5 rounded-full text-[8px] text-white font-bold border ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}</span></span>
                  <span className="text-red-500 flex items-center gap-1 font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/20 relative shadow-inner">
                  <div className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-1000" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`,backgroundImage:'linear-gradient(to right, #b91c1c, #ef4444, #fb923c)'}}></div>
                </div>
              </div>
            )}
            <main className="flex-1 relative flex flex-col items-center justify-between pt-3 pb-1 px-2 overflow-x-visible overflow-y-auto min-h-0">
              <button onClick={()=>setShowEnemyInfo(true)} className="absolute right-2 top-10 flex flex-col items-center justify-center p-2 rounded-2xl border border-red-500 bg-red-950/30 active:scale-90 z-20 shadow-lg"><Search className="text-red-400 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">解析</span></button>
              <button onClick={()=>setShowHeroInfo(true)} className="absolute left-2 top-10 flex flex-col items-center justify-center p-2 rounded-2xl border border-indigo-500 bg-indigo-950/30 active:scale-90 z-20 shadow-lg"><Crown className="text-indigo-400 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">ステータス</span></button>
              <button onClick={useEmergency} disabled={isBusy} className="absolute left-2 top-24 flex flex-col items-center justify-center p-2 rounded-2xl border border-blue-500 bg-blue-900/30 active:scale-90 disabled:opacity-20 z-20 shadow-lg"><Activity className="text-blue-400 mb-0.5" size={16}/><span className="text-[7px] font-black text-white">緊急</span></button>
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
                          <div className="fixed inset-0 pointer-events-none" style={{position:'fixed',inset:0,zIndex:85000,background:'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(168,85,247,0.25) 72%, rgba(127,29,29,0.55) 100%)', animation:'specialDangerPulse 700ms ease-in-out infinite'}}></div>
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
                <div className="flex items-center gap-2 relative"><Heart className="text-pink-500 shrink-0" size={12}/><div className="flex-1"><div className="flex justify-between text-[7px] font-bold text-pink-400 mb-0.5 uppercase tracking-widest"><span>Ally Life</span><span className="font-mono">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-pink-700 to-rose-400 transition-all duration-1000" style={{width:`${(hp/effectiveMaxHp)*100}%`,backgroundImage:'linear-gradient(to right, #be185d, #fb7185)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='life').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
                <div className="flex items-center gap-2 relative"><Zap className="text-amber-500 shrink-0" size={10}/><div className="flex-1"><div className="flex justify-between text-[7px] font-bold text-amber-400 mb-0.5 uppercase tracking-widest"><span>Ally Guts</span><span className="font-mono">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500" style={{width:`${(guts/effectiveMaxGuts)*100}%`,backgroundImage:'linear-gradient(to right, #d97706, #fde047)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
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
                    if(pendingCardObj.type==='unique'&&pendingCardObj.ownerSlotIdx!==i) continue;
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
                    if(pendingCardObj.type==='unique') canAssign = canAssign && (pendingCardObj.ownerSlotIdx===i);
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
                    {(()=>{const uOptions=getAvailableUniquesForSlot(s,ownedUniques); if(uOptions.length<2) return null; const curKey=slotUniqueChoice[i]||'own'; const curIdx=Math.max(0,uOptions.findIndex(o=>o.key===curKey));
                      return(<div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); if(isBusy)return; cycleActiveUniqueForSlot(i);}} className="shrink-0 z-20 flex items-center justify-center gap-0.5 bg-purple-700/90 border-b border-purple-300/50 py-0.5 active:scale-95">
                        <RefreshCcw size={7} className="text-white"/><span className="text-[6px] font-black text-white leading-none">固有技 {curIdx+1}/{uOptions.length}</span>
                      </div>);
                    })()}
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
                      {s?.imgUrl?(<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:'64px',height:'64px'}} className="z-10 object-contain drop-shadow-md"/>):(<span style={{fontSize:'40px'}} className="z-10 drop-shadow-md">{s?.emoji||''}</span>)}
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
                    <div className="text-3xl mt-1.5">{cardIconNode(c.icon,32)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5">{['atk','range_atk','unique'].includes(c.type)?(<div onPointerDown={(ev)=>ev.stopPropagation()} onClick={(ev)=>{ev.stopPropagation(); if(isBusy)return; setSkillPicker({handIndex:i});}} className="text-[9px] font-black leading-tight w-full whitespace-normal h-7 flex items-center justify-center overflow-hidden uppercase italic px-0.5 underline decoration-dotted decoration-white/60 underline-offset-2 active:opacity-60">{c.name}</div>):(<div className="text-[9px] font-black leading-tight w-full whitespace-normal h-7 flex items-center justify-center overflow-hidden uppercase italic px-0.5">{c.name}</div>)}<div className="text-[9px] font-black bg-black/40 text-white rounded py-1 flex items-center justify-center gap-0.5"><Zap size={9}/>{curGuts}</div></div></button></div>);
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PICK HERO / ALLY */}
      {(gameState==='PICK_HERO'||gameState==='PICK_ALLY')&&(
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] p-4 pt-6 flex flex-col justify-start overflow-hidden">
          <div className="mb-2 text-center flex items-center justify-between px-2 shrink-0"><button onClick={handleGoToTitle} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">{gameState==='PICK_HERO'?'勇者モンを選択':'供モンを選択'}</h2><div className="w-10"></div></div>
          <div className={`flex-1 overflow-y-auto mh-scroll w-full max-w-md mx-auto pb-4 min-h-0 flex flex-col ${gameState==='PICK_ALLY'?'justify-center':''}`}>
            <div className="grid grid-cols-2 gap-2.5">
            {monSelection.map(m=>{const isSel=currentPickingMon?.id===m.id;
              return(<button key={m.id} onClick={()=>setCurrentPickingMon(m)} className={`bg-slate-900 border-2 rounded-2xl flex flex-col items-center transition-all active:scale-95 ${isSel?'border-indigo-400 bg-indigo-900/30 ring-4 ring-indigo-500/50 scale-[1.03] shadow-[0_0_25px_rgba(99,102,241,0.6)]':'border-slate-800'}`} style={{padding:'12px 8px'}}>
              <div className="relative">{m.imgUrl?(<DyedMonsterImage baseId={m.id} src={m.imgUrl} alt={m.name} masuColors={m.colors} className="object-contain transition-transform" style={{width:'68px',height:'68px',transform:isSel?'scale(1.12)':'scale(1)'}}/>):(<span style={{fontSize:'52px'}}>{m.emoji}</span>)}{isSel&&<div className="absolute -top-1 -right-1 bg-indigo-500 rounded-full p-1 shadow-lg"><Check size={12} className="text-white"/></div>}</div>
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
                  {currentPickingMon.imgUrl?(<DyedMonsterImage baseId={currentPickingMon.id} src={currentPickingMon.imgUrl} alt={currentPickingMon.name} masuColors={currentPickingMon.colors} className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110"/>):(<div className="text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{currentPickingMon.emoji}</div>)}
                  <div className="flex-1"><h3 className="text-xl font-black text-white">{currentPickingMon.name}</h3><div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Monster Profile{currentPickingMon.masuId&&<span className="ml-1 text-pink-400">・マスモン({ALL_PLAYER_MONSTERS[currentPickingMon.id]?.name})</span>}</div>{bondGaugeNode(currentPickingMon.masuId)}</div><button onClick={()=>setCurrentPickingMon(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2 shrink-0">
                    <div className="bg-black/40 p-2 rounded-xl border border-white/5"><div className="text-[7px] text-slate-500 uppercase font-bold">基本ステータス</div><div className="space-y-1 mt-1"><div className="flex justify-between text-[10px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseHp:`${maxHp} → ${maxHp+(currentPickingMon.plusStats?.hp||0)}`}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseAtk:`${atk} → ${atk+(currentPickingMon.plusStats?.atk||0)}`}</span></div><div className="flex justify-between text-[10px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseDef:`${def} → ${def+(currentPickingMon.plusStats?.def||0)}`}</span></div><div className="flex justify-between text-[10px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{gameState==='PICK_HERO'?currentPickingMon.baseGuts:`${maxGuts} → ${maxGuts+(currentPickingMon.plusStats?.guts||0)}`}</span></div></div></div>
                    {gameState==='PICK_HERO'?(<div className="bg-black/40 p-2 rounded-xl border border-indigo-500/30"><div className="text-[7px] text-indigo-400 uppercase font-bold">勇者特性</div><div className="text-[9px] text-white font-bold leading-tight mt-1">{currentPickingMon.traitDesc}</div></div>):(<div className="bg-black/40 p-2 rounded-xl border border-pink-500/30"><div className="text-[7px] text-pink-400 uppercase font-bold">合流ボーナス</div><div className="text-[8px] text-white font-bold mt-1">{currentPickingMon.plusStats.hp>0&&`HP+${currentPickingMon.plusStats.hp} `}{currentPickingMon.plusStats.atk>0&&`攻+${currentPickingMon.plusStats.atk} `}{currentPickingMon.plusStats.def>0&&`防+${currentPickingMon.plusStats.def} `}{currentPickingMon.plusStats.guts>0&&`G+${currentPickingMon.plusStats.guts} `}</div>{formatAptBonus(currentPickingMon)&&<div className="text-[8px] text-cyan-300 font-bold mt-0.5">間合い適性 {formatAptBonus(currentPickingMon)}</div>}</div>)}
                  </div>
                  <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/30"><div className="flex items-center justify-between mb-0.5"><div className="text-[7px] text-cyan-400 uppercase font-bold">間合い適性</div>{currentPickingMon.masuId&&<div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {getMasuMon(currentPickingMon.masuId)?.distAptPoints||0}</div>}</div><div className="grid grid-cols-4 gap-1 mt-1">{RANGE_LABELS.map((label,idx)=>{const grade=getDistAptitude(currentPickingMon,idx); const pts=currentPickingMon.masuId?(getMasuMon(currentPickingMon.masuId)?.distAptPoints||0):0; const canUp=pts>0 && DIST_APTITUDE_GRADES.indexOf(grade)<DIST_APTITUDE_GRADES.length-1; return(<div key={idx} className="flex flex-col items-center gap-0.5"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span><span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span>{canUp&&<button onClick={()=>{const updated=spendAptPoint(currentPickingMon.masuId,idx); if(updated) setCurrentPickingMon(mergeMasuIntoMon(updated));}} className="w-full text-[8px] font-black bg-amber-600 text-white rounded py-0.5 active:scale-95">+1</button>}</div>);})}</div></div>
                  {currentPickingMon.masuId&&(getMasuMon(currentPickingMon.masuId)?.distAptPoints||0)>0&&(
                    <div className="bg-black/40 p-2 rounded-xl border border-emerald-500/30">
                      <div className="text-[7px] text-emerald-400 uppercase font-bold mb-1">ステータス強化(強化P 1つにつき使用・調整中)</div>
                      <div className="grid grid-cols-4 gap-1">
                        {Object.entries(STAT_POINT_KEYS).map(([key,label])=>(
                          <button key={key} onClick={()=>{const updated=spendStatPoint(currentPickingMon.masuId,key); if(updated) setCurrentPickingMon(mergeMasuIntoMon(updated));}} className="flex flex-col items-center gap-0.5 bg-emerald-950/50 border border-emerald-500/30 rounded-lg py-1.5 active:scale-95">
                            <span className="text-[7px] text-emerald-300 font-black">{label}</span>
                            <span className="text-[10px] text-white font-black">+{STAT_POINT_GAIN[key]||1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!currentPickingMon.masuId&&(
                    <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-[8px] text-slate-500 font-bold text-center">
                      {gameState==='PICK_HERO'?'勇者モンとして選び、ラン終了時に登録すると「マスモン」として絆レベル・ステータスを強化できます':'絆レベルの強化は勇者モン(マスモン)のみ対象です'}
                    </div>
                  )}
                  {renderSkillSection(currentPickingMon)}
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
          {currentPickingMon?.imgUrl?(<DyedMonsterImage baseId={currentPickingMon.id} src={currentPickingMon.imgUrl} alt="mon" masuColors={currentPickingMon.colors} className="w-28 h-28 mb-4 object-contain animate-bounce drop-shadow-[0_0_40px_rgba(99,102,241,0.4)] scale-110"/>):(<div className="text-7xl mb-4 animate-bounce drop-shadow-[0_0_40px_rgba(99,102,241,0.4)]">{currentPickingMon?.emoji}</div>)}
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
                {['零','近','中','遠'].map((lbl,i)=>{const dmg=waveResult.distDamage[i]||0; const cumDmg=waveResult.totalDistDamage?.[i]||0; const gained=(waveResult.gainedDistBonus?.[i]||0)*100; const total=(waveResult.newDistBonus?.[i]||0)*100; const mon=slots[i]; const aptPct=mon?(DIST_APTITUDE_MULT[getDistAptitude(mon,i)]-1.0)*100:0; const combinedTotal=total+aptPct;
                  return(<div key={i} className="bg-black/40 rounded-lg border border-white/5 flex flex-col items-center justify-center" style={{padding:'4px 2px',gap:'2px'}}>
                    <div className="flex items-center" style={{gap:'3px'}}><div className="rounded-full bg-indigo-600/40 border border-indigo-400/50 flex items-center justify-center overflow-hidden shrink-0" style={{width:'26px',height:'26px'}}>{mon?(mon.imgUrl?<img src={mon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span style={{fontSize:'13px'}}>{mon.emoji}</span>):<span className="text-slate-600" style={{fontSize:'9px'}}>-</span>}</div><div className="font-black text-slate-300" style={{fontSize:'10px'}}>{lbl}</div></div>
                    <div className="font-mono font-black text-red-400 leading-none" style={{fontSize:'11px'}}>{dmg.toLocaleString()}</div>
                    <div className="text-orange-300/80 font-mono leading-none" style={{fontSize:'7px'}}>累計{cumDmg.toLocaleString()}</div>
                    <div className="font-mono font-black text-cyan-300 leading-none" style={{fontSize:'9px'}}>+{total.toFixed(1)}%</div>
                    {gained>0&&<div className="text-emerald-400 font-mono leading-none" style={{fontSize:'7px'}}>(+{gained.toFixed(1)})</div>}
                    {mon&&<div className="text-indigo-300 font-mono font-black leading-none" style={{fontSize:'8px'}}>適性込合計+{combinedTotal.toFixed(1)}%</div>}
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
              <div className="text-left flex-1"><div className="font-black text-white uppercase flex items-center gap-2" style={{fontSize:'13px'}}>攻撃覚醒</div><div className="flex flex-wrap justify-between gap-x-2 text-slate-300 font-mono mt-1.5" style={{fontSize:'9px'}}><div>ちから {atk} → <span className="text-red-400 font-bold">{Math.floor(atk*1.10)}</span></div></div><div className="text-slate-500 mt-1" style={{fontSize:'8px'}}>※技レベルは距離適性、防御カードは丈夫さに応じて自動で決まります</div></div>
            </button>
            <button disabled={!!effect} onClick={()=>setPendingReward('def')} className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 shrink-0 shadow-lg transition-all disabled:opacity-40 ${pendingReward==='def'?'bg-emerald-900/40 border-emerald-400 scale-[1.03] ring-4 ring-emerald-500/50 shadow-[0_0_25px_rgba(52,211,153,0.5)]':'bg-slate-900/50 border-slate-800'}`}>
              <div className="p-2 bg-emerald-600/20 rounded-xl text-emerald-500 relative"><ShieldCheck size={18}/>{pendingReward==='def'&&<div className="absolute -top-1.5 -right-1.5 bg-emerald-500 rounded-full p-0.5"><Check size={10} className="text-white"/></div>}</div>
              <div className="text-left flex-1"><div className="font-black text-white uppercase flex items-center gap-2" style={{fontSize:'13px'}}>防御覚醒</div><div className="grid grid-cols-2 gap-x-2 text-slate-300 font-mono mt-1.5" style={{fontSize:'9px'}}><div>ライフ {maxHp} → <span className="text-pink-400 font-bold">{Math.floor(maxHp*1.20)}</span></div><div>丈夫さ {def} → <span className="text-emerald-400 font-bold">{Math.floor((def+20)*1.10)}</span></div></div>
              {(()=>{const nextDef=Math.floor((def+20)*1.10); const curGL=computeGuardLevel(def); const nextGL=computeGuardLevel(nextDef); return nextGL>curGL&&(<div className="text-emerald-400 font-mono font-bold mt-1" style={{fontSize:'9px'}}>丈夫さ100到達で [{GUARD_EVOLUTION[nextGL].name}] 解放！ガード枚数 {2+curGL} → {2+nextGL}</div>);})()}
              </div>
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
            {helpTab==='battle'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-blue-400 font-black text-base mb-3 flex items-center gap-2"><Target size={18}/> 距離システム</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">自分と敵の「距離」が威力を左右します。このゲーム最大の戦略要素です。</p><div className="space-y-3"><div className="bg-black/50 p-4 rounded-2xl border border-blue-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">距離の一致（超重要）</div><div className="text-[12px] text-slate-400 leading-relaxed">敵と同じ距離枠にいるモンスターで攻撃すると大ダメージ！距離がずれるほど威力は低下します。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">解析と予測</div><div className="text-[12px] text-slate-400 leading-relaxed">敵は移動することがあります。「解析ボタン」で敵の行動を予測し、防御か攻撃か判断しましょう。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-teal-400 font-black text-base mb-3 flex items-center gap-2"><Target size={18}/> 間合い適性</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">モンスターごとに4つの距離それぞれで得意・不得意があり、C(標準・±0%)を基準にG(-20%)〜M(+25%)のグレードでダメージが変動します。モンスター詳細画面のグレード表示で確認できます。</p><div className="text-[11px] text-slate-400 leading-relaxed">絆レベルが上がると貯まる「強化ポイント」を1つ消費すると、詳細画面からその距離の適性グレードを1段階アップできます(上限はM)。</div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Zap size={18}/> GUTSの管理</h3><p className="text-[12px] text-slate-200 leading-relaxed">行動にはガッツを消費します。ガッツは毎ターン自動回復しますが、上限を増やすことで強力な技を安定して使えます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-cyan-400 font-black text-base mb-3 flex items-center gap-2"><Crown size={18}/> 勇者特性・固有技</h3><p className="text-[12px] text-slate-200 leading-relaxed">最初に選ぶ「勇者モン」ごとに専用の特性(勇者モン選択時のみ発動)と、進化する固有技(必殺技)を持ちます。編成する勇者モンによって戦い方が大きく変わります。詳しくは召喚時のモンスター詳細で確認できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-blue-300 font-black text-base mb-3 flex items-center gap-2"><Activity size={18}/> 緊急回復</h3><p className="text-[12px] text-slate-200 leading-relaxed">画面左下の「緊急」ボタンでライフとガッツをそれぞれ最大値の30%回復できます。ただし使用すると自分のターンを消費し、敵の行動が発生します。回数制限はありません。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-pink-400 font-black text-base mb-3 flex items-center gap-2"><Heart size={18}/> 合流ボーナス</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">WAVE 2・4・6で仲間が合流すると、そのモンスターの合流ボーナス分だけライフ・ちから・丈夫さ・ガッツが上がります。</p><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[12px] text-slate-400 leading-relaxed">さらに、合流したモンスターの<span className="text-white font-bold">間合い適性</span>も加算されます。Cを±0として、Aなら+2段階、Eなら-2段階というように、得意・不得意がそのまま反映されます。合流させる順番や組み合わせで、狙った距離を伸ばせます。</div></div></section></div>)}
            {helpTab==='growth'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-purple-400 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> 能力覚醒（報酬）</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">WAVEクリア後、3つの能力から1つを選んで強化します。</p><div className="grid grid-cols-3 gap-2"><div className="bg-red-900/30 border border-red-500/40 p-3 rounded-2xl text-center"><Sword size={16} className="mx-auto text-red-400 mb-2"/><div className="text-[10px] font-black">攻撃覚醒</div></div><div className="bg-emerald-900/30 border border-emerald-500/40 p-3 rounded-2xl text-center"><Shield size={16} className="mx-auto text-emerald-400 mb-2"/><div className="text-[10px] font-black">防御覚醒</div></div><div className="bg-pink-900/30 border border-pink-500/40 p-3 rounded-2xl text-center"><Heart size={16} className="mx-auto text-pink-400 mb-2"/><div className="text-[10px] font-black">精神強化</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><BookOpen size={18}/> ブリーダー継承</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">WAVE 1,3,5,7,9で、ブリーダーの「教え」をカードとして加えられます。同じ教えを重ねると「進化」し、効果が飛躍的に高まります(最大Lv2)。編成したブリーダーカードの中から候補が出ます。</p><div className="grid grid-cols-2 gap-2">{[{n:"おりょうの力",d:"攻撃ステータスUP"},{n:"ドラの緑膝",d:"被ダメージDOWN"},{n:"かどみうむの計算",d:"自動ライフ/ガッツ回復UP"},{n:"みゅあの愛",d:"回復＆能力永続UP"},{n:"あつの挑発",d:"敵行動無効＆攻撃"},{n:"みゃるの薬",d:"次ターン攻撃2倍＆自傷"}].map(c=>(<div key={c.n} className="bg-black/50 p-2.5 rounded-xl border border-white/5"><div className="text-[10px] font-black text-white">{c.n}</div><div className="text-[9px] text-slate-400">{c.d}</div></div>))}</div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-cyan-400 font-black text-base mb-3 flex items-center gap-2"><Zap size={18}/> 技レベル</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">通常技・距離技・固有技にはそれぞれ9段階のレベルがあります。WAVEクリア時の報酬で解放ポイントを獲得し、技を1段階ずつ強化していきます。レベルが上がると威力と会心率が上がりますが、消費ガッツも増えます。</p><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[12px] text-slate-400 leading-relaxed">バトル中はタイル選択式で、解放済みのレベルであれば下位の技に戻して使うこともできます(消費ガッツを節約したいときに便利です)。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-emerald-400 font-black text-base mb-3 flex items-center gap-2"><Sword size={18}/> ガード</h3><p className="text-[12px] text-slate-200 leading-relaxed">ガードカードの軽減量は<span className="text-white font-bold">固定値＋(丈夫さ×倍率)</span>で決まります(ガード=200＋丈夫さ×1.1、ハイガード=300＋丈夫さ×1.2)。丈夫さが100上がるごとに上位のガードが解放され、手札に入るガードの枚数も増えます。</p></section></div>)}
            {helpTab==='meta'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Crown size={18}/> ブリーダーレベル</h3><p className="text-[12px] text-slate-200 leading-relaxed">WAVEをクリアするとブリーダー経験値を獲得してレベルアップします。レベルが上がるたびにブリーダーポイント(pt)を1獲得できます。ptはマーケットのアイコン購入に使います。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-violet-400 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> マスモン</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">プレイ終了後のリザルト画面で、そのとき勇者モンだったモンスターに名前を付けて登録できます。登録した個体を<span className="text-white font-bold">マスモン</span>と呼び、絆レベル・強化ポイント・見た目の色をその個体だけのものとして持ち続けます。同じ種類でも別々に育てられます。</p><div className="bg-black/50 p-4 rounded-2xl border border-violet-500/30"><div className="text-[11px] font-black text-white mb-1">強化ポイントの使い道</div><div className="text-[12px] text-slate-400 leading-relaxed">絆レベルが1上がるごとに1ポイント獲得します。1ポイント消費して、間合い適性を1段階上げるか、ライフ・ちから・丈夫さ・ガッツのいずれかを上げられます。振り直したいときはマーケットの「絆ポイントリセットの書」を使います。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-pink-400 font-black text-base mb-3 flex items-center gap-2"><Heart size={18}/> 絆レベル</h3><p className="text-[12px] text-slate-200 leading-relaxed">勇者モンに選んだモンスターは、WAVEクリアごとに絆経験値を獲得して絆レベルが上がります(WAVEが進むほど1回あたりの獲得量も増加)。供モンとして合流したマスモンにも経験値が入ります。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-violet-300 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> 合体</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">プロフィール画面の「合体」から、マスモン同士を合体できます。残す側を<span className="text-white font-bold">主</span>、消える側を<span className="text-white font-bold">副</span>として選びます。</p><div className="space-y-2"><div className="bg-black/50 p-4 rounded-2xl border border-white/5"><div className="text-[12px] text-slate-300 leading-relaxed">副の絆経験値が累計のまま主に加算され、上がったレベルの数だけ主が強化ポイントを獲得します。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-white/5"><div className="text-[12px] text-slate-300 leading-relaxed">主の名前・見た目・間合い適性・ステータス強化はそのまま維持されます(副の強化は引き継がれません)。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[12px] text-amber-200 leading-relaxed"><span className="font-bold">固有技の引き継ぎ</span>は、主と副が両方とも絆Lv.10以上のときだけ選べます。消費ダイヤは(主の絆Lv＋副の絆Lv)×100です。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Coins size={18}/> pt とダイヤ(2つの通貨)</h3><div className="space-y-3"><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">pt（ポイント）</div><div className="text-[12px] text-slate-400 leading-relaxed">ブリーダーレベルアップで獲得。マーケットの「アイコン」購入に使います。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">ダイヤ</div><div className="text-[12px] text-slate-400 leading-relaxed">WAVEクリアで獲得(Normal基準100ダイヤ/WAVE、難易度で変動)。「円盤石」「ブリーダー」「アイテム」の購入と、合体の費用に使います。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-orange-400 font-black text-base mb-3 flex items-center gap-2"><ShoppingBag size={18}/> マーケット</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">プロフィール画面から入れます。4つのカテゴリがあります。</p><div className="grid grid-cols-2 gap-2"><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">アイコン</div><div className="text-[9px] text-slate-400">ptで購入<br/>プロフィール画像に</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">円盤石</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>新モンスター解放</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">ブリーダー</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>新カード解放</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">アイテム</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>マスモンに使う</div></div></div><div className="bg-black/50 p-4 rounded-2xl border border-white/5 mt-3"><div className="text-[11px] font-black text-white mb-1">アイテム</div><div className="text-[12px] text-slate-400 leading-relaxed"><span className="text-white font-bold">絆ポイントリセットの書</span>: 使用済みの強化ポイントをすべて未使用に戻します(絆レベル・絆経験値はそのまま)。<br/><span className="text-white font-bold">染色もどき</span>: 見た目の色を変えられます。モンスターによっては体・目・口などの部位ごとに別々の色を選べ、プリセット27色に加えてカスタムカラーも使えます。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> 編成</h3><p className="text-[12px] text-slate-200 leading-relaxed">マーケットで新しいモンスターやブリーダーカードを解放しても、次の周回で候補になるのは編成で選んだものだけです。プロフィール画面の「編成」からモンスター8体・ブリーダーカード6枚をちょうど選び、「決定」ボタンで確定します(最初から解放済みの8体・6枚は編成済みです)。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-300 font-black text-base mb-3 flex items-center gap-2"><Trophy size={18}/> 最終リザルト</h3><p className="text-[12px] text-slate-200 leading-relaxed">優勝・敗北・リタイアいずれかでプレイが終了すると、獲得したブリーダー経験値・ダイヤ・絆経験値と、WAVEごとの獲得スコア/経験値/ダイヤの内訳を確認できます。この画面から勇者モンをマスモンとして登録できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-300 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> 更新履歴</h3><p className="text-[12px] text-slate-200 leading-relaxed">トップ画面の「更新」ボタンから、アップデート内容と不具合情報をタブで切り替えて確認できます。未読の更新があるときはNEWマークが付きます。</p></section></div>)}
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
      {/* 技選択: 通常技/距離技/固有技カードの名前をタップすると開く、選択可能なタイル一覧
          (使えるものは色あり、まだ使えないものはグレーで選べない) */}
      {skillPicker&&(()=>{
        const card = hand[skillPicker.handIndex];
        if (!card) { setSkillPicker(null); return null; }
        const isAtkFamily = card.type==='atk' || card.type==='range_atk';
        let tiles = [];
        let uniqueSources = [];
        if (isAtkFamily) {
          const atkNames = HERO_ATK_NAMES[mainHero?.id]||HERO_ATK_NAMES['Mocchi'];
          // 解放上限は「現在選んでいるレベル(atkLevel)」ではなく、距離適性から算出される
          // 上限レベルを都度計算する。atkLevelを直接使うと、一度下位レベルを選んだ後に
          // 上限自体が下がってしまい、本来解放済みの上位レベルへ戻せなくなる不具合になる
          const ceilingLvl = computeAtkTier(slots, enemyDist);
          tiles = BASE_ATK_EVOLUTION.map((_,lvl)=>{
            const unlocked = lvl<=ceilingLvl;
            const isActive = lvl===atkLevel;
            const label = card.type==='atk' ? atkNames[lvl] : `${RANGE_LABELS[card.rangeIdx]}${RANGE_EVOLUTION[lvl].name}`;
            const power = Math.floor((card.type==='atk'?BASE_ATK_EVOLUTION[lvl].mult:RANGE_EVOLUTION[lvl].mult)*100);
            return {key:String(lvl), label, power, unlocked, isActive, onSelect:()=>applyAtkTierChoice(lvl)};
          });
        } else if (card.type==='unique') {
          const mon = slots[card.ownerSlotIdx];
          uniqueSources = getAvailableUniquesForSlot(mon, ownedUniques);
          const activeKey = slotUniqueChoice[card.ownerSlotIdx]||'own';
          const activeOpt = uniqueSources.find(o=>o.key===activeKey) || uniqueSources[0];
          if (activeOpt) {
            const u = activeOpt.unique;
            // 解放上限はそのモンスターの固有技強化到達レベル(evoLevel)。atk/range_atkと同様、
            // 現在選んでいるレベルではなく強化到達レベル自体を都度参照することで、
            // 一度下位レベルを選んだ後も上位レベルへ戻せるようにする
            const maxLevel = u.evoLevel||0;
            const curLevel = (slotUniqueLevelChoice[card.ownerSlotIdx]!=null) ? Math.min(slotUniqueLevelChoice[card.ownerSlotIdx], maxLevel) : maxLevel;
            tiles = Array.from({length:9},(_,lvl)=>{
              const unlocked = lvl<=maxLevel;
              const isActive = lvl===curLevel;
              const label = u.names[Math.min(lvl,u.names.length-1)];
              const power = Math.floor((u.baseMult+lvl*0.5)*100);
              return {key:String(lvl), label, power, unlocked, isActive, onSelect:()=>applyUniqueLevelChoiceForSlot(card.ownerSlotIdx, lvl)};
            });
          }
        }
        const title = card.type==='atk'?'通常技を選択':(card.type==='range_atk'?'距離技を選択':'固有技を選択');
        return (
          <div className="fixed inset-0 z-[60000] flex items-end justify-center" style={{backgroundColor:'rgba(0,0,0,0.85)'}} onClick={()=>setSkillPicker(null)}>
            <div className="bg-slate-900 border-t-2 border-x-2 border-indigo-500 rounded-t-3xl p-4 w-full max-w-md max-h-[75vh] flex flex-col gap-2" onClick={e=>e.stopPropagation()} style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
              <div className="flex justify-between items-center border-b border-white/10 pb-2 shrink-0">
                <h3 className="text-sm font-black text-white uppercase italic">{title}</h3>
                <button onClick={()=>setSkillPicker(null)} className="p-1.5 bg-white/10 rounded-full active:scale-90"><X size={14}/></button>
              </div>
              {card.type==='unique'&&uniqueSources.length>1&&(
                <div className="flex gap-1.5 pb-2 border-b border-white/10 shrink-0 overflow-x-auto">
                  {uniqueSources.map(opt=>{
                    const isActiveSource=(slotUniqueChoice[card.ownerSlotIdx]||'own')===opt.key;
                    return(<button key={opt.key} onClick={()=>applyUniqueChoiceForSlot(card.ownerSlotIdx,opt.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black border-2 whitespace-nowrap active:scale-95 ${isActiveSource?'bg-indigo-600 border-indigo-400 text-white':'bg-slate-800 border-slate-700 text-slate-400'}`}>{opt.key==='own'?'自分の技':`${opt.unique.sourceMasuName}から継承`}</button>);
                  })}
                </div>
              )}
              <div className="overflow-y-auto mh-scroll flex-1 grid grid-cols-1 gap-1.5 pt-1">
                {tiles.map(t=>(
                  <button key={t.key} disabled={!t.unlocked} onClick={()=>{t.onSelect(); setSkillPicker(null);}} className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 text-left active:scale-95 transition-all ${t.unlocked?(t.isActive?'bg-indigo-600/40 border-indigo-400 ring-2 ring-indigo-300':'bg-slate-800/70 border-slate-600'):'bg-slate-950/60 border-slate-800 grayscale opacity-45'}`}>
                    <div className="min-w-0">
                      <div className={`text-[11px] font-black truncate ${t.unlocked?'text-white':'text-slate-500'}`}>{t.label}{t.isActive&&<span className="ml-1 text-[8px] text-indigo-300">(使用中)</span>}</div>
                      {t.sub&&<div className="text-[8px] text-amber-400 font-bold truncate">{t.sub}</div>}
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {t.unlocked?(<span className="text-[9px] font-mono text-red-400 font-bold">技威力{t.power}</span>):(<span className="text-[9px] text-slate-500">🔒未解放</span>)}
                    </div>
                  </button>
                ))}
              </div>
              {isAtkFamily&&<div className="text-[8px] text-slate-500 text-center pt-1 shrink-0">敵と同じ距離枠にいる味方の距離適性・距離ダメージ補正の合計値を上げると、上位レベルが解放されます</div>}
              {card.type==='unique'&&<div className="text-[8px] text-slate-500 text-center pt-1 shrink-0">固有技の強化(強化ポイント)で上位レベルが解放されます</div>}
            </div>
          </div>
        );
      })()}
      {focusedCard&&(
        <div className="fixed left-1/2 -translate-x-1/2 bg-slate-900/98 border-2 border-indigo-400 p-2.5 rounded-2xl w-[90%] max-w-[260px] shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-md" style={{bottom:'calc(34% + 80px)',zIndex:110000}} onClick={()=>setFocusedCard(null)}>
          <div className="flex items-center gap-2.5 mb-1 border-b border-white/10 pb-1"><span className="text-xl bg-indigo-500/20 p-1 rounded-xl">{cardIconNode(focusedCard.icon,22)}</span><div className="text-left flex-1 overflow-hidden"><div className="text-[9px] font-black text-white uppercase truncate">{focusedCard.name||focusedCard.baseName}</div><div className="text-[7px] font-bold text-indigo-400 flex items-center gap-1"><Zap size={7}/> {getCardGuts(focusedCard)} Guts</div></div></div>
          <div className="text-[8px] text-slate-200 font-medium leading-relaxed bg-black/50 p-1.5 rounded-lg border border-white/5 space-y-1">
            {['atk','range_atk','unique'].includes(focusedCard.type)&&(<div className="flex justify-between items-center text-xs"><span>技威力:</span><span className="text-red-400 font-black">{focusedCard.type==='range_atk'?`${Math.floor(focusedCard.mult*100)} / ${Math.floor(focusedCard.mult*0.4*100)}`:Math.floor((focusedCard.type==='unique'?(focusedCard.baseMult+(focusedCard.evoLevel||0)*0.5+((focusedCard.monId==='Ark'||focusedCard.monId==='Iblis')?0.1*getPermaBuff('chuuniUniqueStack'):0)):(focusedCard.mult||focusedCard.baseMult||1.0))*100)}</span></div>)}
            {['atk','range_atk','unique'].includes(focusedCard.type)&&(<div className="flex justify-between items-center text-xs"><span>会心率:</span><span className="text-yellow-400 font-black">{Math.round(((focusedCard.crit||0.1)+getPermaBuff('critRatePct'))*100)}%{getPermaBuff('critRatePct')>0&&<span className="text-yellow-200 text-[8px]"> (+{Math.round(getPermaBuff('critRatePct')*100)})</span>} <span className="text-yellow-200/70 text-[8px]">×{(1.5+getPermaBuff('critDmgPct')).toFixed(2)}</span></span></div>)}
            {focusedCard.type==='guard'&&<div className="text-center font-bold">敵の攻撃を最大 {Math.floor((focusedCard.flat||0)+def*(focusedCard.mult||0))} 軽減<span className="text-slate-400 font-normal">（{focusedCard.flat||0} ＋ 丈夫さ×{focusedCard.mult||0}）</span></div>}
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
      {gameState==='CHAMPION'&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,background:'linear-gradient(to bottom right,#fbbf24,#78350f)'}}><div className="shrink-0 flex flex-col items-center"><Crown size={64} className="text-white animate-bounce mb-3"/><h1 className="text-3xl font-black italic text-white uppercase">CHAMPION</h1><div className="w-full max-w-xs bg-black/40 border border-white/20 rounded-3xl p-6 mb-3 mt-3 shadow-2xl"><div className="text-5xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{masuRegisterButtonNode()}</div><button onClick={handleGoToTitle} className="w-full max-w-xs bg-white text-amber-900 py-4 rounded-3xl font-black text-xl uppercase shadow-2xl active:scale-95 transition-transform shrink-0 mt-2">タイトルへ</button></div>)}

      {/* GAME OVER */}
      {hp<=0&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="shrink-0 flex flex-col items-center"><Skull size={48} className="text-red-700 mb-3 animate-pulse"/><h2 className="text-2xl font-black italic text-white uppercase">敗 北</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{masuRegisterButtonNode()}</div><div className="flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={handleRetry} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2"><RotateCcw size={20}/> 再挑戦</button><button onClick={handleGoToTitle} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase">トップへ</button></div></div>)}

      {gaveUp&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="shrink-0 flex flex-col items-center"><Flag size={48} className="text-slate-400 mb-3"/><h2 className="text-2xl font-black italic text-white uppercase">リタイア</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{masuRegisterButtonNode()}</div><div className="flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={handleRetry} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2"><RotateCcw size={20}/> 再挑戦</button><button onClick={handleGoToTitle} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase">トップへ</button></div></div>)}

      {/* マスモン登録: ラン終了画面(CHAMPION/敗北/リタイア)から名前を付けて登録するモーダル */}
      {showMasuRegisterModal&&(
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:90000}}>
          <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-2">🐾</div>
              <h3 className="text-lg font-black text-white">マスモンとして登録</h3>
              <div className="text-[10px] text-slate-400 mt-1">名前を付けて保存すると、今回得た絆レベル・強化ポイントが引き継がれます。同じ種でも違う名前で複数登録できます。</div>
            </div>
            <input type="text" value={masuNameInput} onChange={e=>setMasuNameInput(e.target.value.slice(0,12))} placeholder={mainHero?.name||'名前'} maxLength={12} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-black focus:outline-none focus:border-pink-400"/>
            <div className="flex gap-2">
              <button onClick={()=>setShowMasuRegisterModal(false)} className="w-2/5 bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-xs uppercase active:scale-95">キャンセル</button>
              <button onClick={()=>{ registerMasuMon(masuNameInput); setShowMasuRegisterModal(false); }} className="w-3/5 bg-pink-600 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95">登録する</button>
            </div>
          </div>
        </div>
      )}

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
        {effect.type==='enhance'&&(
          <>
            <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 42%, rgba(251,191,36,0.5) 0%, rgba(234,88,12,0.3) 35%, rgba(0,0,0,0) 68%)', animation:'auraPulse 600ms ease-out infinite'}}></div>
            <div className="absolute" style={{top:'42%',left:'50%',width:'min(70vw,300px)',height:'min(70vw,300px)',transform:'translate(-50%,-50%)'}}>
              <div className="absolute inset-0 rounded-full border-4 border-amber-400/70" style={{animation:'auraRing 700ms ease-out infinite'}}></div>
              <div className="absolute inset-0 rounded-full border-2 border-orange-300/60" style={{animation:'auraRing 900ms ease-out 150ms infinite'}}></div>
              {[0,60,120,180,240,300].map(deg=>(
                <div key={deg} className="absolute left-1/2 top-1/2 text-2xl" style={{transform:`translate(-50%,-50%) rotate(${deg}deg) translateY(-120px)`, animation:'sparkFlicker 350ms ease-in-out infinite', animationDelay:`${deg}ms`}}>✨</div>
              ))}
            </div>
          </>
        )}
        {effect.imgUrl?(<img src={effect.imgUrl} alt="effect" style={{width:effect.type==='unique'?'180px':(effect.type==='enhance'?'160px':'150px'),height:effect.type==='unique'?'180px':(effect.type==='enhance'?'160px':'150px'),animation:(effect.type==='unique'||effect.type==='enhance')?'specialThrob 500ms ease-in-out infinite':undefined}} className={`mb-6 object-contain relative ${effect.type==='unique'?'drop-shadow-[0_0_45px_rgba(168,85,247,0.95)]':(effect.type==='enhance'?'drop-shadow-[0_0_45px_rgba(251,191,36,0.9)]':'drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]')}`}/>):(<div style={{fontSize:effect.type==='unique'?'128px':(effect.type==='enhance'?'120px':'112px'),animation:(effect.type==='unique'||effect.type==='enhance')?'specialThrob 500ms ease-in-out infinite':undefined}} className="mb-6 relative">{effect.monEmoji}</div>)}
        <h2 className={`text-2xl font-black italic uppercase px-8 py-3 rounded-2xl border relative ${effect.type==='unique'?'text-purple-100 bg-purple-600/30 border-purple-400/60 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]':(effect.type==='enhance'?'text-amber-100 bg-amber-600/30 border-amber-400/60 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]':'text-white bg-white/10 border-white/20')}`}>{effect.label}</h2>
        {effect.subLabel&&<p className={`font-mono text-[10px] mt-4 font-black whitespace-pre-line relative ${effect.type==='enhance'?'text-amber-300':'text-indigo-400'}`}>{effect.subLabel}</p>}
        <div style={{fontSize:effect.type==='unique'?'60px':'48px'}} className="mt-8 animate-bounce relative">{effect.icon}</div>
      </div>)}
        {rosterSkillDetail&&(()=>{const mon=rosterSkillDetail.mon; const isUnique=rosterSkillDetail.kind==='unique'; const levels=isUnique?getUniqueSkillLevels(mon):getAtkSkillLevels(mon); const title=isUnique?`固有技: ${mon.unique.name}`:`通常技: ${(HERO_ATK_NAMES[mon.id]||HERO_ATK_NAMES['Mocchi'])[0]}`; return(
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:32000}}>
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0"><h3 className="text-sm font-black text-white uppercase">{title}</h3><button onClick={()=>setRosterSkillDetail(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-1.5">
                {levels.map(info=>(<div key={info.lvl} className="p-2 rounded-xl border bg-black/30 border-white/5"><div className="flex justify-between items-center mb-1"><span className="text-[9px] font-black text-amber-300">Lv.{info.lvl} {info.name}</span></div><div className="flex gap-4 text-[9px] font-mono"><span className="text-red-400 font-bold">技威力 {info.power}</span><span className="text-yellow-400 font-bold">会心率 {info.crit}%</span><span className="text-amber-400 font-bold">消費G {info.guts}</span></div></div>))}
              </div>
              <button onClick={()=>setRosterSkillDetail(null)} className="w-full bg-amber-600 text-white py-3 rounded-2xl font-black text-sm uppercase shadow-lg mt-2 shrink-0 active:scale-95">閉じる</button>
            </div>
          </div>
        );})()}
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
    @keyframes fusionSlideInLeft {
      0% { transform: translateX(-160%) scale(0.8); opacity: 0; }
      55% { transform: translateX(6%) scale(1.06); opacity: 1; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes fusionSlideInRight {
      0% { transform: translateX(160%) scale(0.8); opacity: 0; }
      55% { transform: translateX(-6%) scale(1.06); opacity: 1; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes fusionMergeShake {
      0%,100% { transform: translate(0,0) scale(1); }
      20% { transform: translate(-7px,4px) scale(1.03); }
      40% { transform: translate(7px,-4px) scale(1.06); }
      60% { transform: translate(-5px,3px) scale(1.04); }
      80% { transform: translate(4px,-3px) scale(1.02); }
    }
    @keyframes fusionFlashBurst {
      0% { transform: scale(0); opacity: 0; }
      35% { transform: scale(1.5); opacity: 1; }
      100% { transform: scale(3.2); opacity: 0; }
    }
    @keyframes fusionFlashFade {
      0%,55% { background-color: rgba(255,255,255,0); }
      70% { background-color: rgba(255,255,255,0.9); }
      100% { background-color: rgba(255,255,255,0); }
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
