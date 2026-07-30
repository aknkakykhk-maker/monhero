
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
  ChevronLeft: '<polyline points="15 18 9 12 15 6"/>',
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
  Package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .3.28.68.42 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/>',
  List: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
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
const Heart=_icon('Heart'), Zap=_icon('Zap'), Sword=_icon('Sword'), Shield=_icon('Shield'), X=_icon('X'), Award=_icon('Award'), Skull=_icon('Skull'), PlusCircle=_icon('PlusCircle'), Target=_icon('Target'), ShieldCheck=_icon('ShieldCheck'), Trophy=_icon('Trophy'), Timer=_icon('Timer'), Play=_icon('Play'), Sparkles=_icon('Sparkles'), Activity=_icon('Activity'), ChevronLeft=_icon('ChevronLeft'), ChevronRight=_icon('ChevronRight'), Crown=_icon('Crown'), Edit3=_icon('Edit3'), ArrowLeft=_icon('ArrowLeft'), Search=_icon('Search'), Layers=_icon('Layers'), AlertCircle=_icon('AlertCircle'), Flag=_icon('Flag'), RotateCcw=_icon('RotateCcw'), MinusCircle=_icon('MinusCircle'), Star=_icon('Star'), Users=_icon('Users'), User=_icon('User'), Check=_icon('Check'), HelpCircle=_icon('HelpCircle'), BookOpen=_icon('BookOpen'), Info=_icon('Info'), RefreshCcw=_icon('RefreshCcw'), ArrowDownCircle=_icon('ArrowDownCircle'), Coins=_icon('Coins'), ShoppingBag=_icon('ShoppingBag'), Gem=_icon('Gem'), Package=_icon('Package'), Settings=_icon('Settings'), List=_icon('List');


// --- Helpers ---
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BUILD_DATE = "2026-07-30 22:32"; // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること

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
const INITIAL_MASU_LEVEL_CAP = 30;
const REBIRTH_LEVEL_CAP_GAIN = 5;
const MAX_UNIQUE_SKILL_LEVEL = 8;
const uniqueSkillAtLevel = (unique, level = 0) => {
  if (!unique) return null;
  const lvl = Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(level) || 0)));
  const mult = unique.baseMult + lvl * 0.5;
  return {
    ...unique,
    name: unique.names?.[lvl] || unique.name,
    evoLevel: lvl,
    mult,
    guts: Math.floor(unique.baseGuts * (mult / unique.baseMult)),
    crit: 0.10 + 0.05 * lvl,
  };
};
// 固有技の表示名は固有技Lvで変わるため、重複判定には技の出自を表す不変IDを使う。
// lineageId は今後データ側で明示でき、既存データは従来から保存されている monId へ安全にフォールバックする。
const uniqueLineageId = (unique, fallbackMonId = null) => unique?.lineageId || unique?.monId || fallbackMonId || null;
const normalizeInheritedUniqueLineages = (masuMons) => (Array.isArray(masuMons) ? masuMons : []).map(raw => {
  const masu = normalizeMasuProgression(raw);
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  const ownedLineages = new Set([uniqueLineageId(base?.unique, masu.baseId)].filter(Boolean));
  const kept = [];
  const keptLevels = [];
  (Array.isArray(masu.inheritedUniques) ? masu.inheritedUniques : []).forEach((unique, index) => {
    const lineageId = uniqueLineageId(unique);
    if (!lineageId || ownedLineages.has(lineageId)) return;
    const level = Math.max(0, Math.floor(Math.max(Number(masu.uniqueSkillLevels?.[`inh:${index}`]) || 0, Number(unique?.evoLevel) || 0)));
    const existingIndex = kept.findIndex(entry => uniqueLineageId(entry) === lineageId);
    if (existingIndex < 0) {
      kept.push({ ...unique, lineageId });
      keptLevels.push(level);
    } else if (level > keptLevels[existingIndex]) {
      kept[existingIndex] = { ...unique, lineageId };
      keptLevels[existingIndex] = level;
    }
  });
  const uniqueSkillLevels = { ...masu.uniqueSkillLevels };
  Object.keys(uniqueSkillLevels).filter(key => key.startsWith('inh:')).forEach(key => delete uniqueSkillLevels[key]);
  keptLevels.forEach((level, index) => { uniqueSkillLevels[`inh:${index}`] = level; });
  return { ...masu, inheritedUniques:kept, uniqueSkillLevels };
});
const totalBondXpForLevel = (level) => {
  let total = 0;
  for (let current = 1; current < Math.max(1, level); current++) total += xpForBondLevel(current);
  return total;
};
const normalizeMasuProgression = (masu) => ({
  ...masu,
  rebirthCount: Math.max(0, Math.floor(Number(masu?.rebirthCount) || 0)),
  levelCap: Math.max(INITIAL_MASU_LEVEL_CAP, Math.floor(Number(masu?.levelCap) || INITIAL_MASU_LEVEL_CAP)),
  uniqueSkillLevels: masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? { ...masu.uniqueSkillLevels } : {},
});
// 転生では個体の識別情報・外見・固有技・履歴だけを残し、育成値は同種の未育成Lv1へ戻す。
// オブジェクトスプレッドで旧育成値を残さないよう、維持対象を明示して新しい保存形を組み立てる。
const resetMasuForRebirth = (masu, { rebirthCount, levelCap, uniqueSkillLevels } = {}) => {
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu?.baseId] : null;
  const reset = {
    id: masu?.id,
    baseId: masu?.baseId,
    name: masu?.name,
    bondXp: totalBondXpForLevel(1),
    distAptPoints: 5,
    distApt: [...(base?.distAptitude || ['C','C','C','C'])],
    statPoints: { hp:0, atk:0, def:0, guts:0 },
    createdAt: masu?.createdAt,
    rebirthCount: Math.max(0, Math.floor(Number(rebirthCount ?? masu?.rebirthCount) || 0)),
    levelCap: Math.max(INITIAL_MASU_LEVEL_CAP, Math.floor(Number(levelCap ?? masu?.levelCap) || INITIAL_MASU_LEVEL_CAP)),
    uniqueSkillLevels: { ...(uniqueSkillLevels ?? masu?.uniqueSkillLevels ?? {}) },
  };
  if (Array.isArray(masu?.colors)) reset.colors = [...masu.colors];
  else if (masu?.color != null) reset.color = masu.color;
  if (Array.isArray(masu?.inheritedUniques)) reset.inheritedUniques = masu.inheritedUniques.map(unique => ({ ...unique }));
  if (Array.isArray(masu?.fusionHistory)) reset.fusionHistory = masu.fusionHistory.map(entry => ({ ...entry }));
  return reset;
};
const migrateRebornMasuToFullReset = (masuMons) => (Array.isArray(masuMons) ? masuMons : []).map(raw => {
  const masu = normalizeMasuProgression(raw);
  return masu.rebirthCount > 0 ? resetMasuForRebirth(masu) : masu;
});
const cappedBondXp = (masu, gain = 0) => {
  const normalized = normalizeMasuProgression(masu);
  return Math.min(totalBondXpForLevel(normalized.levelCap), donationDiamondValue(normalized.bondXp) + Math.max(0, Math.floor(Number(gain) || 0)));
};
// 周回終了時の絆経験値配布先を、表示処理やReact state更新から独立して一度だけ決定する。
// 優先順位は勇者モン(100%) > バトル参加マスモン(50%) > 編成内の控え(25%)。
// 同じ個体が複数枠に現れてもSetでまとめ、上位区分と下位区分の重複付与を防ぐ。
const buildRunBondAwards = ({ gain, heroMasuId, participantMasuIds, monsterRosterIds, masuMons }) => {
  const fullGain = Math.max(0, Math.floor(Number(gain) || 0));
  if (fullGain <= 0) return [];
  const ownedBondIds = new Set((Array.isArray(masuMons) ? masuMons : [])
    .filter(masu => masu && masu.id != null && Object.prototype.hasOwnProperty.call(masu, 'bondXp'))
    .map(masu => String(masu.id)));
  const heroId = heroMasuId != null && ownedBondIds.has(String(heroMasuId)) ? String(heroMasuId) : null;
  const participantIds = new Set((Array.isArray(participantMasuIds) ? participantMasuIds : [])
    .filter(id => id != null && ownedBondIds.has(String(id)) && String(id) !== heroId)
    .map(String));
  const rosterIds = new Set((Array.isArray(monsterRosterIds) ? monsterRosterIds : [])
    .filter(entry => typeof entry === 'string' && entry.startsWith('masu:'))
    .map(entry => entry.slice(5))
    .filter(id => ownedBondIds.has(String(id))));
  const awards = [];
  if (heroId) awards.push({ masuId:heroId, gain:fullGain, rate:1, showInResult:true });
  participantIds.forEach(masuId => awards.push({ masuId, gain:Math.max(1, Math.floor(fullGain / 2)), rate:0.5, showInResult:true }));
  rosterIds.forEach(masuId => {
    if (masuId === heroId || participantIds.has(masuId)) return;
    awards.push({ masuId, gain:Math.max(1, Math.floor(fullGain / 4)), rate:0.25, showInResult:false });
  });
  return awards;
};
const masuBondLevelInfo = (masu) => bondLevelInfo(cappedBondXp(masu));
const migrateMasuLevelCaps = (masuMons, gold) => {
  const capXp = totalBondXpForLevel(INITIAL_MASU_LEVEL_CAP);
  let compensation = 0;
  const nextMasuMons = (Array.isArray(masuMons) ? masuMons : []).map(raw => {
    const masu = normalizeMasuProgression(raw);
    if (masu.rebirthCount === 0 && donationDiamondValue(masu.bondXp) > capXp) {
      compensation += donationDiamondValue(masu.bondXp) - capXp;
      return { ...masu, bondXp: capXp };
    }
    return { ...masu, bondXp: cappedBondXp(masu) };
  });
  return { nextMasuMons, compensation, nextGold: donationDiamondValue(gold) + compensation };
};
const buildMasuRebirth = ({ masu, skillKey, gold }) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  const level = masuBondLevelInfo(normalized).level;
  if (level !== normalized.levelCap) return { ok:false, reason:`Lv.${normalized.levelCap}到達後に転生できます。` };
  const cost = level * 100;
  if (donationDiamondValue(gold) < cost) return { ok:false, reason:'ダイヤが不足しています。' };
  const currentSkillLevel = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[skillKey]) || 0));
  if (!skillKey || currentSkillLevel >= MAX_UNIQUE_SKILL_LEVEL) return { ok:false, reason:'強化できる固有技を選んでください。' };
  const uniqueSkillLevels = { ...normalized.uniqueSkillLevels, [skillKey]:currentSkillLevel + 1 };
  return { ok:true, cost, skillKey, skillLevel:currentSkillLevel + 1, nextGold:donationDiamondValue(gold) - cost, nextMasu:resetMasuForRebirth(normalized, { rebirthCount:normalized.rebirthCount + 1, levelCap:normalized.levelCap + REBIRTH_LEVEL_CAP_GAIN, uniqueSkillLevels }) };
};

// 神殿の寄付で受け取るダイヤ。保存データが古い・破損している場合も負数やNaNを返さない。
const donationDiamondValue = (bondXp) => {
  const value = Number(bondXp);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};
const rosterBaseId = (entryId, masuMons) => {
  if (typeof entryId !== 'string') return null;
  if (!entryId.startsWith('masu:')) return entryId;
  return masuMons.find(m => String(m.id) === entryId.slice(5))?.baseId || null;
};
const repairRosterAfterDonation = (roster, donated, remainingMasuMons, unlockedMonsterIds, validBaseIds, requiredCount) => {
  const donatedEntry = `masu:${donated.id}`;
  if (!roster.includes(donatedEntry)) return { ok: true, roster: [...roster] };
  const next = roster.filter(id => id !== donatedEntry);
  const usedBases = new Set(next.map(id => rosterBaseId(id, remainingMasuMons)).filter(Boolean));
  const candidates = [donated.baseId, ...unlockedMonsterIds];
  for (const baseId of candidates) {
    if (next.length >= requiredCount) break;
    if (!validBaseIds.includes(baseId) || usedBases.has(baseId)) continue;
    next.splice(Math.min(roster.indexOf(donatedEntry), next.length), 0, baseId);
    usedBases.add(baseId);
  }
  const valid = next.length === requiredCount && next.every(id => {
    const baseId = rosterBaseId(id, remainingMasuMons);
    return baseId && validBaseIds.includes(baseId);
  }) && new Set(next.map(id => rosterBaseId(id, remainingMasuMons))).size === next.length;
  return valid ? { ok: true, roster: next } : { ok: false, reason: '有効なモンスターを8体編成できないため、寄付を中止しました。' };
};
// HOME放牧設定の保存値を所持個体だけへ正規化する。nullは機能導入前のセーブを表し、
// 従来の1体表示を維持するため先頭の表示可能個体1体で初期化する。
const normalizeHomePastureIds = (savedIds, masuMons, validBaseIds) => {
  const validBases = validBaseIds instanceof Set ? validBaseIds : new Set(validBaseIds || []);
  const ownedIds = (Array.isArray(masuMons) ? masuMons : []).filter(m=>validBases.has(m.baseId)).map(m=>String(m.id));
  if (!Array.isArray(savedIds)) return ownedIds.slice(0,1);
  const owned = new Set(ownedIds);
  return [...new Set(savedIds.map(String))].filter(id=>owned.has(id)).slice(0,5);
};

const buildMasuDonation = ({ masuMons, targetId, gold, monsterRosterIds, draftMonsterRoster, unlockedMonsterIds, validBaseIds, requiredCount }) => {
  const donated = masuMons.find(m => String(m.id) === String(targetId));
  if (!donated) return { ok: false, reason: '対象のマスモンはすでに所持していません。' };
  const nextMasuMons = masuMons.filter(m => String(m.id) !== String(targetId));
  const active = repairRosterAfterDonation(monsterRosterIds, donated, nextMasuMons, unlockedMonsterIds, validBaseIds, requiredCount);
  if (!active.ok) return active;
  const draft = repairRosterAfterDonation(draftMonsterRoster, donated, nextMasuMons, unlockedMonsterIds, validBaseIds, requiredCount);
  if (!draft.ok) return draft;
  const diamonds = donationDiamondValue(donated.bondXp);
  return { ok: true, donated, diamonds, nextGold: donationDiamondValue(gold) + diamonds, nextMasuMons, nextRoster: active.roster, nextDraftRoster: draft.roster };
};

// 修行試作版は通常データ・チケット・ミッションから完全に分離したメモリ内デバッグセッション。
const TRAINING_MAP_ID = 'beginner_debug_v1';
const TRAINING_DIFFICULTIES = Object.freeze({
  BEGINNER:{id:'BEGINNER',label:'BEGINNER',available:true,turns:10,dice:[1,3],spaces:24,summary:'短い安全ルートと、遠回りの報酬ルートが分岐・再合流する試作マップ。'},
  EASY:{id:'EASY',label:'EASY',available:false,turns:10,dice:[1,3],spaces:28,summary:'分岐と妨害が増える予定です。説明のみ確認できます。'},
  NORMAL:{id:'NORMAL',label:'NORMAL',available:false,turns:10,dice:[1,3],spaces:32,summary:'道具の判断が重要になる予定です。説明のみ確認できます。'},
});
const TRAINING_TOOLS = Object.freeze({
 feather:{name:'加速の羽',emoji:'🪽',timing:'サイコロを振る前',mode:'消費型',desc:'次の出目に＋2'}, gale:{name:'疾風の札',emoji:'🌪️',timing:'サイコロを振る前',mode:'消費型',desc:'2回振り、高い出目を採用'}, reroll:{name:'振り直しの石',emoji:'🪨',timing:'出目の確定後・移動前',mode:'消費型',desc:'確定した出目を1回だけ振り直す'}, noReturn:{name:'戻らずのお守り',emoji:'🧿',timing:'取得後は自動待機',mode:'自動発動型',desc:'次に受ける後退効果を1回無効化して消滅'}, sand:{name:'時の砂',emoji:'⏳',timing:'移動していない時',mode:'消費型',desc:'残りターン＋1'}, fixed:{name:'確定サイコロ',emoji:'🎲',timing:'サイコロを振る前',mode:'消費型',desc:'次の出目を1・2・3から選択'}, returnCharm:{name:'帰還のお守り',emoji:'🏮',timing:'取得後は自動待機',mode:'自動発動型',desc:'ゴール失敗時、仮獲得した通常アイテムから1個選んで保護'},
});
const TRAINING_SPACE_TYPES = Object.freeze({
 start:{kind:'start',label:'スタート',emoji:'🚩',color:'#475569',desc:'修行の開始地点'}, xp30:{kind:'xp',value:30,label:'絆EXP',emoji:'💗',color:'#16a34a',desc:'仮獲得絆経験値＋30'}, xp60:{kind:'xp',value:60,label:'大EXP',emoji:'💖',color:'#15803d',desc:'仮獲得絆経験値＋60'}, gem50:{kind:'diamond',value:50,label:'ダイヤ',emoji:'💎',color:'#0891b2',desc:'仮獲得ダイヤ＋50'}, gem100:{kind:'diamond',value:100,label:'大ダイヤ',emoji:'💠',color:'#2563eb',desc:'仮獲得ダイヤ＋100'}, item:{kind:'item',value:'training_ticket',label:'アイテム',emoji:'🎁',color:'#ec4899',desc:'仮獲得通常アイテムを1個追加'}, tool:{kind:'tool',label:'修行道具',emoji:'🎒',color:'#d946ef',desc:'修行専用アイテムをランダム取得'}, forward:{kind:'move',value:1,label:'前進',emoji:'⏩',color:'#16a34a',desc:'1～3マス追加移動（停止マスだけ発動）'}, back:{kind:'move',value:-1,label:'後退',emoji:'⏪',color:'#dc2626',desc:'1～3マス戻る（停止マスだけ発動）'}, turnPlus:{kind:'turn',value:1,label:'ターン＋',emoji:'⏱️',color:'#059669',desc:'残りターン＋1'}, turnMinus:{kind:'turn',value:-1,label:'ターン－',emoji:'⚡',color:'#b91c1c',desc:'残りターン－1'}, boost:{kind:'effect',value:'boost',label:'強化',emoji:'✨',color:'#ca8a04',desc:'次回のサイコロ出目＋1'}, again:{kind:'effect',value:'again',label:'もう一度',emoji:'🔁',color:'#0d9488',desc:'ターンを消費せず再度サイコロ'}, happening:{kind:'happening',label:'ハプニング',emoji:'⁉️',color:'#9333ea',desc:'良い効果または悪い効果が発動'}, goal:{kind:'goal',label:'ゴール',emoji:'🏁',color:'#eab308',desc:'到達または通過で修行成功'},
});
// 接続先を持つ24ノード。3回分岐し、安全な短路と報酬の遠回りが再合流する。
const TRAINING_BEGINNER_NODES = Object.freeze([
 ['n0','start',8,86,['n1']],['n1','xp30',20,78,['n0','n2','n4']],['n2','turnPlus',31,66,['n1','n3']],['n3','gem50',44,58,['n2','n7']],
 ['n4','tool',19,52,['n1','n5']],['n5','gem100',29,40,['n4','n6']],['n6','item',42,37,['n5','n7']],['n7','again',53,52,['n3','n6','n8']],
 ['n8','xp60',62,65,['n7','n9','n11']],['n9','forward',72,74,['n8','n10']],['n10','boost',84,70,['n9','n14']],['n11','tool',61,42,['n8','n12']],
 ['n12','gem100',72,32,['n11','n13']],['n13','happening',85,38,['n12','n14']],['n14','xp30',91,55,['n10','n13','n15']],['n15','back',82,55,['n14','n16','n18']],
 ['n16','turnMinus',73,48,['n15','n17']],['n17','gem50',65,30,['n16','n21']],['n18','xp60',79,78,['n15','n19']],['n19','item',66,88,['n18','n20']],
 ['n20','tool',54,80,['n19','n21']],['n21','happening',49,61,['n17','n20','n22']],['n22','gem100',38,48,['n21','n23']],['n23','goal',27,34,['n22']]
].map(([id,type,x,y,next])=>Object.freeze({id,type,x,y,next:Object.freeze(next)})));
const TRAINING_NODE_BY_ID=Object.freeze(Object.fromEntries(TRAINING_BEGINNER_NODES.map(n=>[n.id,n])));
const trainingEmptyRewards=()=>({bondXp:0,diamonds:0,items:[]});
const trainingSeed=()=>Math.floor(Math.random()*2147483646)+1;
const createTrainingSession=(masuId,difficulty='BEGINNER')=>({status:'playing',masuId:String(masuId),difficulty,mapId:TRAINING_MAP_ID,seed:trainingSeed(),position:'n0',previous:null,remainingTurns:10,rewards:trainingEmptyRewards(),tools:[],effects:{},lastRoll:null,previousRoll:null,rollPending:false,branchOptions:[],movementRemaining:0,routePreview:[],stopPreview:null,forcedMoves:0,eventLog:['修行テスト開始'],message:'サイコロを振ってください'});
const trainingSpaceTiming=space=>space.kind==='goal'?'到達・通過時':space.kind==='start'?'修行開始時':'移動終了後、このマスに止まった時';
const trainingSpaceValue=space=>space.value===undefined?'ランダム':typeof space.value==='number'?`${space.value>0?'+':''}${space.value}`:String(space.value);
const settleTrainingRewards=(session,success)=>({bondXp:Math.floor(session.rewards.bondXp*(success?1:.5))+(success?100:0),diamonds:Math.floor(session.rewards.diamonds*(success?1:.5))+(success?100:0),items:success?[...session.rewards.items,'ゴール報酬']:session.effects.returnCharm&&session.rewards.items.length?[session.rewards.items[0]]:[],goalReward:success?'通常アイテム抽選1個':'なし'});
const trainingDistanceToGoal=start=>{const q=[[start,0]],seen=new Set([start]);while(q.length){const [id,d]=q.shift();if(id==='n23')return d;for(const n of TRAINING_NODE_BY_ID[id].next)if(!seen.has(n)){seen.add(n);q.push([n,d+1]);}}return '-';};
// =====================================================================
// AUDIO: BGM/ジングルはAudioBuffer、SEはTone.js(Web Audio)で再生
// デフォルトは無音。ユーザーが音量ボタンを押すと有効化される。
// =====================================================================
const BGM_TRACKS = [
  { id:'original_title', name:'タイトルテーマ', creator:'オリジナル', src:'audio/bgm-title-theme.mp3', gain:1, loop:true, legacyKey:'title' },
  { id:'original_home', name:'HOMEテーマ', creator:'オリジナル', src:'audio/bgm-title.mp3', gain:1, loop:true, legacyKey:'home' },
  { id:'original_prep', name:'強化テーマ', creator:'オリジナル', src:'audio/bgm-menu.mp3', gain:1, loop:true, legacyKey:'prep' },
  { id:'original_battle', name:'バトルテーマ', creator:'オリジナル', src:'audio/bgm-battle.mp3', gain:1, loop:true, legacyKey:'battle' },
  { id:'original_boss', name:'ボステーマ', creator:'オリジナル', src:'audio/bgm-boss.mp3', gain:1, loop:true, legacyKey:'boss' },
  { id:'original_dullahan', name:'デュラハンテーマ', creator:'オリジナル', src:'audio/bgm-dullahan.mp3', gain:1, loop:true, legacyKey:'dullahan' },
  { id:'original_game_over', name:'ゲームオーバーテーマ', creator:'オリジナル', src:'audio/bgm-game-over.mp3', gain:1, loop:true, legacyKey:'gameOver' },
  { id:'original_fusion', name:'合体テーマ', creator:'オリジナル', src:'audio/bgm-fusion.mp3', gain:1, loop:true, legacyKey:'fusion' },
  { id:'original_enhance', name:'強化画面テーマ', creator:'オリジナル', src:'audio/bgm-enhance.mp3', gain:1, loop:true, legacyKey:'enhance' },
  { id:'original_result', name:'リザルトテーマ', creator:'オリジナル', src:'audio/bgm-result.mp3', gain:1, loop:true, legacyKey:'result' },
  { id:'original_market', name:'マーケットテーマ', creator:'オリジナル', src:'audio/bgm-market.mp3', gain:1, loop:true, legacyKey:'market' },
  { id:'original_profile', name:'プロフィールテーマ', creator:'オリジナル', src:'audio/bgm-profile.mp3', gain:1, loop:true, legacyKey:'profile' },
  { id:'ichika_home', name:'ホームテーマ by いちか', creator:'いちか', src:'audio/bgm-home-ichika.mp3', gain:1, loop:true },
  { id:'ichika_battle', name:'バトルテーマ by いちか', creator:'いちか', src:'audio/bgm-battle-ichika.mp3', gain:1, loop:true },
  { id:'ichika_boss', name:'ボステーマ by いちか', creator:'いちか', src:'audio/bgm-boss-ichika.mp3', gain:1, loop:true },
  { id:'ichika_clear', name:'クリアテーマ by いちか', creator:'いちか', src:'audio/bgm-clear-ichika.mp3', gain:1, loop:true, legacyKey:'clear' },
];
const BGM_TRACK_BY_ID = Object.fromEntries(BGM_TRACKS.map(track => [track.id, track]));
const BGM_TRACK_BY_KEY = Object.fromEntries(BGM_TRACKS.filter(track => track.legacyKey).map(track => [track.legacyKey, track]));
const DEFAULT_BGM_ARRANGEMENT = Object.freeze({ home:'original_home', management:'original_profile', market:'original_market', temple:'original_fusion', trainingMenu:'original_home', trainingBoard:'original_home', battle:'original_battle', boss:'original_boss', clear:'ichika_clear' });
const normalizeBgmArrangement = value => Object.fromEntries(Object.entries(DEFAULT_BGM_ARRANGEMENT).map(([scene, fallback]) => [scene, BGM_TRACK_BY_ID[value?.[scene]] ? value[scene] : fallback]));

const Audio_ = (() => {
  let Tone = null, ready = false, loading = null, started = false;
  let reverb = null, seBus = null;
  let audioCtx = null, bgmGain = null;
  const buffers = new Map();
  const loadingBuffers = new Map();
  let bgmSource = null, bgmSourceKey = null, bgmRequest = 0, previewSource = null, previewKey = null;
  let jingleSource = null, jingleTimer = null;
  let currentKey = null, bgmVolumePct = 0, seVolumePct = 0, pageHidden = false;
  let enabled = false;

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
    } catch (e) { audioCtx = null; bgmGain = null; }
    return audioCtx;
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
    try { source.start(0); } catch (e) { stopOthers(); }
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
  const stopPreview = (resume = true) => { stopSource(previewSource); previewSource = null; previewKey = null; if (resume && currentKey) playBGM(currentKey); };
  const previewBGM = async key => {
    const track = resolveTrack(key); if (!track) return false;
    if (previewKey === track.id) { stopPreview(true); return false; }
    stopPreview(false); stopJingles(); stopOthers(); previewKey = track.id;
    try { const buffer = await loadBuffer(track.src); if (previewKey !== track.id || !enabled || pageHidden || bgmVolumePct <= 0) return false;
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return false; applyTrackGain(track);
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = track.loop !== false; source.connect(bgmGain); previewSource = source;
      source.onended = () => { if (previewSource === source) stopPreview(true); }; source.start(0); return true;
    } catch (e) { if (previewKey === track.id) stopPreview(true); return false; }
  };
  const stopBGM = () => { currentKey = null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers(); };
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
  const setEnabled = async (on) => { enabled = !!on; if (!enabled) { ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); } else if (currentKey) playBGM(currentKey); await ensure(); };
  const isEnabled = () => enabled;
  const setSeVolume = (pct) => { seVolumePct = pct; if (seBus && Tone) { try { seBus.gain.rampTo(_gainFromPct(pct), 0.05); } catch (e) {} } };
  const setBgmVolume = (pct) => { bgmVolumePct = pct; applyTrackGain(resolveTrack(previewKey || currentKey)); if (pct <= 0) { stopPreview(false); stopOthers(); } else if (enabled && currentKey && !previewKey) playBGM(currentKey); };
  const resumeIfNeeded = async () => { await ensureAudioCtxRunning(); if (Tone) { try { await Tone.start(); started = true; } catch (e) {} } if (enabled && currentKey && !bgmSource) playBGM(currentKey); };
  const unlock = async (playTestTone = false) => {
    if (!enabled) enabled = true;
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
    enemyMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 }, volume: -14 }).connect(seBus); s.triggerAttackRelease('E4', '32n', t); s.triggerAttackRelease('B3', '16n', t + 0.06); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 400); },
    join: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.4 }, volume: -10 }).connect(reverb); const t = Tone.now(); const seq = [[0,'E5','8n'],[0.15,'G5','8n'],[0.3,'C6','8n'],[0.45,'E6','4n'],[0.45,'C6','4n'],[0.45,'G5','4n'],[0.8,'D6','8n'],[0.95,'E6','4n'],[0.95,'C6','4n'],[0.95,'G5','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1800); },
    victory: async () => { if (!enabled) return; await ensure(); if (!Tone) return; stopOthers(null); currentKey = null; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, volume: -19 }).connect(reverb); const vb = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -19 }).connect(seBus); const t = Tone.now(); const seq = [[0,'C5','8n'],[0,'E5','8n'],[0,'G5','8n'],[0.18,'C5','8n'],[0.18,'E5','8n'],[0.18,'G5','8n'],[0.36,'C5','8n'],[0.36,'E5','8n'],[0.36,'G5','8n'],[0.54,'G5','4n'],[0.54,'C6','4n'],[0.54,'E6','4n'],[0.9,'F5','8n'],[0.9,'A5','8n'],[1.08,'G5','8n'],[1.08,'B5','8n'],[1.26,'C6','2n'],[1.26,'E6','2n'],[1.26,'G6','2n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); [[0,'C3'],[0.54,'C3'],[0.9,'F2'],[1.08,'G2'],[1.26,'C3']].forEach(([tt, n]) => vb.triggerAttackRelease(n, '4n', t + tt)); setTimeout(() => { try { v.dispose(); vb.dispose(); } catch (e) {} }, 2600); },
    levelUp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -12 }).connect(reverb); const seq = [[0,'C5','16n'],[0.08,'E5','16n'],[0.16,'G5','16n'],[0.24,'C6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const sp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }, volume: -16 }).connect(reverb); sp.triggerAttackRelease('C6', '2n', t + 0.24); setTimeout(() => { try { v.dispose(); sp.dispose(); } catch (e) {} }, 1200); },
    // 合体演出用: 上昇アルペジオ→(両者が重なるタイミングで)ベルの一撃+きらめき和音の「ピカーン」
    fusion: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.5 }, volume: -10 }).connect(reverb); const seq = [[0,'C5','8n'],[0.12,'E5','8n'],[0.24,'G5','8n'],[0.36,'C6','8n'],[0.48,'E6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const bt = t + 0.6; const bell = new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.6, release: 0.3 }, harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 1.5, volume: -14 }).connect(reverb); bell.triggerAttackRelease('16n', bt); const sparkle = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 }, volume: -12 }).connect(reverb); ['C6','E6','G6','C7'].forEach((n, i) => sparkle.triggerAttackRelease(n, '8n', bt + i * 0.03)); setTimeout(() => { try { v.dispose(); bell.dispose(); sparkle.dispose(); } catch (e) {} }, 2200); }
  };

  return { playBGM, stopBGM, previewBGM, stopPreview, setEnabled, isEnabled, setSeVolume, setBgmVolume, unlock, resumeIfNeeded, setPageHidden, preloadBGM, prepareBGM, prepareSE, playJingle, ensurePlaying, isContextRunning, se };
})();


const MOO_IMG = "";


// --- Game Data ---
const RANGE_LABELS = ["零", "近", "中", "遠"];
const rangeAttackDamageMultiplier = (card, attackStartDist) => {
  if (!card || card.type !== 'range_atk') return card?.mult || card?.baseMult || 1.0;
  return attackStartDist === card.rangeIdx ? card.mult : card.mult * 0.4;
};
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
// 染色マスクを作るときに解析する画像の最大サイズ(px)。表示は大きくても250px程度なので、
// これ以上の解像度で判定しても見た目は変わらず、時間だけがかかる
const MASK_ANALYSIS_MAX_SIZE = 384;
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
          const natW = img.naturalWidth || img.width, natH = img.naturalHeight || img.height;
          // 解析は元の解像度ではなく縮小した画像で行う。
          // マスクはCSSのmask-imageとして表示サイズへ引き伸ばして使うため、立ち絵の表示は
          // せいぜい250px程度。1000px超の元絵をそのまま1画素ずつ判定すると1体あたり
          // 数秒かかり(実測3〜7秒)、起動時の読み込みが毎回長くなっていた。
          // 判定は正規化座標で行っており、平滑化の半径も画像幅に比例させているため、
          // 縮小しても部位の分かれ方は変わらない。
          const scale = Math.min(1, MASK_ANALYSIS_MAX_SIZE / Math.max(natW, natH));
          const w = Math.max(1, Math.round(natW * scale)), h = Math.max(1, Math.round(natH * scale));
          const regionDefs = _resolveRegionDefsForSize(baseId, hues, natW);
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = w; srcCanvas.height = h;
          const srcCtx = srcCanvas.getContext('2d');
          if (!srcCtx) { resolve(null); return; }
          srcCtx.imageSmoothingEnabled = true;
          srcCtx.imageSmoothingQuality = 'high';
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
const RebirthStars = ({ count = 0, className = '' }) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (!value) return null;
  const tier = Math.floor((value - 1) / 5) % 4;
  const colors = ['#fde047','#f472b6','#ef4444','#ffffff'];
  const shadows = ['#ca8a04','#db2777','#991b1b','#22d3ee'];
  return <span className={`mh-rebirth-stars ${className}`} aria-label={`転生${value}回`}>{Array.from({length:Math.min(5, value)},(_,i)=><span key={i} style={{color:colors[tier],textShadow:tier===3?`0 0 2px #f472b6,0 0 4px ${shadows[tier]}`:`0 0 3px ${shadows[tier]}`}}>★</span>)}</span>;
};
// HOME中央の安全領域だけを歩くマスモン。HOMEから外れるとコンポーネントごと破棄され、
// visibilitychangeでもタイマーを止めるため、画面遷移やバックグラウンド復帰で処理が重複しない。
const HomeWalkingMasumon = ({ masu, base, masuColors, index = 0, count = 1 }) => {
  // 個体ごとに開始位置と速度係数を固定し、再描画で動き方が跳ねないようにする。
  const laneCenter = count <= 1 ? 50 : 12 + (76 * index / Math.max(1, count - 1));
  const speedFactor = 0.9 + ((index * 17) % 5) * 0.045;
  const [motion, setMotion] = useState({ x: laneCenter, y: 24 + (index % 3) * 22, facing: index % 2 ? -1 : 1, walking: false, duration: 0 });
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const motionRef = useRef(motion);
  useEffect(() => {
    mountedRef.current = true;
    const clearMotionTimer = () => { if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; } };
    const scheduleWalk = (delay = 550 + Math.random() * 1050 + index * 90) => {
      clearMotionTimer();
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current || document.visibilityState === 'hidden') return;
        const current = motionRef.current;
        // 横方向は個体ごとの緩いレーンを持たせ、5体が同じ場所に居続けるのを避ける。
        const laneWidth = count <= 1 ? 84 : 30;
        const x = Math.max(6, Math.min(94, laneCenter + (Math.random() - 0.5) * laneWidth));
        const y = 10 + Math.random() * 80;
        const distance = Math.hypot(x - current.x, y - current.y);
        const duration = Math.max(2100, Math.min(4800, (1850 + distance * 32) * speedFactor));
        const next = { x, y, facing: x < current.x ? -1 : 1, walking: true, duration };
        motionRef.current = next;
        setMotion(next);
        timerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          const stopped = { ...motionRef.current, walking: false };
          motionRef.current = stopped;
          setMotion(stopped);
          scheduleWalk(750 + Math.random() * 1750 + index * 110);
        }, duration);
      }, delay);
    };
    const onVisibilityChange = () => {
      clearMotionTimer();
      if (document.visibilityState === 'hidden') {
        const stopped = { ...motionRef.current, walking: false };
        motionRef.current = stopped;
        setMotion(stopped);
      } else scheduleWalk(350);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (document.visibilityState !== 'hidden') scheduleWalk();
    return () => { mountedRef.current = false; clearMotionTimer(); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [masu.id, index, count]);
  return <div className={`mh-home-masumon ${motion.walking ? 'is-walking' : ''}`} style={{left:`${motion.x}%`,top:`${motion.y}%`,zIndex:Math.round(motion.y),transitionDuration:`${motion.duration}ms`}}>
    <div className="mh-home-masumon-bob" style={{transform:`scaleX(${motion.facing})`}}>
      <DyedMonsterImage baseId={masu.baseId} src={base.imgUrl || base.iconUrl} alt="" masuColors={masuColors} draggable={false}/>
      <RebirthStars count={masu.rebirthCount} className="mh-home-masumon-stars"/>
    </div>
  </div>;
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
const CHANGELOG_TYPES = ['update', 'issue'];
// 日付やBUILD_DATEではなく、内容から作った安定IDでお知らせを識別する。同じID・同じ本文は
// ビルドし直しても未読へ戻らず、本文を変更した場合だけ新しい項目として扱う。
const changelogEntryId = entry => {
  const source = entry.id || [entry.type, entry.title, ...(entry.items || [])].join('\u001f');
  let hash = 2166136261;
  for (let i=0;i<source.length;i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${entry.type || 'notice'}-${(hash >>> 0).toString(36)}`;
};
const CHANGELOG_ENTRIES = (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []).map(entry => Object.freeze({...entry,id:changelogEntryId(entry)}));
const CHANGELOG_IDS_BY_TYPE = Object.fromEntries(CHANGELOG_TYPES.map(type => [type, CHANGELOG_ENTRIES.filter(entry=>entry.type===type).map(entry=>entry.id)]));
const DEFAULT_MONSTER_LIST_SETTINGS = { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', display: { base: true, masu: true, fused: true, active: true, reborn: true } };
const DEFAULT_FUSION_SORT_SETTINGS = { version: 1, sortKey: 'bond', sortDir: 'desc' };
const DEFAULT_DONATION_SORT_SETTINGS = { version: 1, sortKey: 'bondXp', sortDir: 'desc' };
const normalizeMonsterListSettings = (value) => {
  const sortKeys = ['base', 'masu', 'lineage', 'bond', 'name', 'active', 'fused', 'reborn'];
  const displayKeys = ['base', 'masu', 'fused', 'active', 'reborn'];
  if (!value || value.version !== 1 || !sortKeys.includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir) || !['sort', 'display'].includes(value.modalTab) || !value.display) return DEFAULT_MONSTER_LIST_SETTINGS;
  return { version: 1, modalTab: value.modalTab, sortKey: value.sortKey, sortDir: value.sortDir, display: Object.fromEntries(displayKeys.map(key => [key, typeof value.display[key] === 'boolean' ? value.display[key] : DEFAULT_MONSTER_LIST_SETTINGS.display[key]])) };
};
const normalizeFusionSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bond', 'lineage', 'name', 'fused'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_FUSION_SORT_SETTINGS;
  return { version: 1, sortKey: value.sortKey, sortDir: value.sortDir };
};
const normalizeDonationSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bondXp', 'bond', 'name', 'lineage', 'newest', 'active'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_DONATION_SORT_SETTINGS;
  return value;
};
// 不具合情報タブに出す状態バッジの見た目
const CHANGELOG_STATUS = {
  fixed:         { label: '修正済み', cls: 'bg-emerald-900/70 text-emerald-300 border-emerald-500/50' },
  investigating: { label: '調査中',   cls: 'bg-amber-900/70 text-amber-300 border-amber-500/50' },
  known:         { label: '判明済み', cls: 'bg-slate-800 text-slate-300 border-slate-500/50' },
};
// 音量の既定値。初期状態は「音がオン」で、いきなり大きな音が鳴らないよう最小の1から始める
// (ミュートを解除したときの音量もこの値に合わせている)
const DEFAULT_VOLUME = 1;
const LOGIN_BONUS_REWARDS = [
  [{ type:'diamond', amount:500 }],
  [{ type:'dyeMock', amount:1 }],
  [{ type:'diamond', amount:1000 }],
  [{ type:'breederPoint', amount:100 }],
  [{ type:'dyeMock', amount:1 }],
  [{ type:'diamond', amount:2000 }],
  [{ type:'bondPointReset', amount:1 }],
];
const GIFT_REWARD_LABELS = { diamond:'ダイヤ', breederPoint:'ブリーダーポイント', dyeMock:'染色もどき', bondPointReset:'絆ポイントリセットアイテム', trainingTicket:'トレーニングチケット', trainingTicketLarge:'修行チケット' };
const LOGIN_BONUS_DEFAULT = { currentDay:1, lastGrantedPeriod:null, totalLoginDays:0 };
// 日本時間へ直した後に4時間戻した暦日を期間キーにする。03:59と04:00は別の日、
// 04:00から翌03:59までは同じ日として扱える、比較・保存しやすい YYYY-MM-DD 形式。
const loginBonusPeriodKey = (now=Date.now()) => new Date(Number(now) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const normalizeLoginBonus = (value) => ({
  currentDay: Number.isInteger(value?.currentDay) && value.currentDay >= 1 && value.currentDay <= 7 ? value.currentDay : 1,
  lastGrantedPeriod: typeof value?.lastGrantedPeriod === 'string' ? value.lastGrantedPeriod : null,
  totalLoginDays: Math.max(0, Math.floor(Number(value?.totalLoginDays) || 0)),
});
const grantLoginBonus = (loginBonus, gifts, now=Date.now()) => {
  const state = normalizeLoginBonus(loginBonus);
  const period = loginBonusPeriodKey(now);
  // 同一期間に加え、端末時計が前回より過去へ戻った場合も配布しない。
  if (state.lastGrantedPeriod && period <= state.lastGrantedPeriod) return { granted:false, loginBonus:state, gifts:Array.isArray(gifts)?gifts:[] };
  const day = state.currentDay;
  const createdAt = new Date(now).toISOString();
  const gift = { id:`gift_login_${period}`, source:'loginBonus', title:`ログインボーナス ${day}日目`, description:'ログインボーナスです。', rewards:LOGIN_BONUS_REWARDS[day-1].map(r=>({...r})), createdAt, expiresAt:new Date(Number(now)+30*24*60*60*1000).toISOString(), claimedAt:null };
  const list = Array.isArray(gifts) ? gifts : [];
  // 期間由来の固定IDでも重複を防ぐ。既に存在する場合は進捗だけを勝手に進めない。
  if (list.some(item=>item?.id===gift.id)) return { granted:false, loginBonus:{...state,lastGrantedPeriod:period}, gifts:list };
  return { granted:true, day, gift, gifts:[gift,...list], loginBonus:{ currentDay:day===7?1:day+1, lastGrantedPeriod:period, totalLoginDays:state.totalLoginDays+1 } };
};
const normalizeGiftRewards = (gift) => {
  if (!gift || !Array.isArray(gift.rewards) || gift.rewards.length === 0) return null;
  const supported = Object.keys(GIFT_REWARD_LABELS);
  const rewards = gift.rewards.map(r=>({ type:r?.type, amount:Math.floor(Number(r?.amount)) }));
  return rewards.every(r=>supported.includes(r.type) && Number.isFinite(r.amount) && r.amount > 0) ? rewards : null;
};
const giftIsExpired = (gift, now=Date.now()) => !gift?.expiresAt || !Number.isFinite(Date.parse(gift.expiresAt)) || Date.parse(gift.expiresAt) <= Number(now);
// 「今すぐ受け取れるギフト」。未受取・期限内・報酬が有効、の3つを満たすもの。
// HOMEの通知バッジ・ギフト画面のバッジ・「すべて受け取る」が同じ判定を使う
const giftIsClaimable = (gift, now=Date.now()) => !!gift && !gift.claimedAt && !giftIsExpired(gift, now) && !!normalizeGiftRewards(gift);
const giftClaimableCount = (gifts, now=Date.now()) => (Array.isArray(gifts) ? gifts : []).filter(g => giftIsClaimable(g, now)).length;
const buildGiftClaim = (gift, balances, now=Date.now()) => {
  if (!gift || gift.claimedAt || giftIsExpired(gift, now)) return { ok:false, reason:gift?.claimedAt?'claimed':'expired' };
  const rewards = normalizeGiftRewards(gift);
  if (!rewards) return { ok:false, reason:'invalidReward' };
  const next = { gold:Math.max(0,Number(balances?.gold)||0), breederPoints:Math.max(0,Number(balances?.breederPoints)||0), ownedItems:{...(balances?.ownedItems||{})} };
  const itemIds = { dyeMock:'dye_mock', bondPointReset:'bond_reset_scroll', trainingTicket:'training_ticket', trainingTicketLarge:'training_ticket_l' };
  rewards.forEach(({type,amount})=>{ if(type==='diamond') next.gold+=amount; else if(type==='breederPoint') next.breederPoints+=amount; else { const id=itemIds[type]; next.ownedItems[id]=(next.ownedItems[id]||0)+amount; } });
  return { ok:true, balances:next, gift:{...gift,claimedAt:new Date(now).toISOString()} };
};
const giftRewardText = (reward) => `${GIFT_REWARD_LABELS[reward.type] || reward.type} ×${Number(reward.amount).toLocaleString()}`;
const giftTitleDisplay = (gift) => {
  const fallback = '名称なしギフト';
  const title = typeof gift?.title === 'string' && gift.title.trim() ? gift.title.trim() : fallback;
  if (gift?.source !== 'mission') return { label:null, title };
  const missionTitle = title.replace(/^ミッション報酬[「『]?/, '').replace(/[」』]$/, '').trim();
  return { label:'ミッション', title:missionTitle || title };
};
const MISSION_DEFS = {
  daily: [
    {id:'daily_login',name:'今日もMonster Hero！',condition:'その期間中にログインする',key:'login',target:1,rewards:[{type:'diamond',amount:100}]},
    {id:'daily_battles',name:'バトルに挑戦',condition:'バトルを3回行う',key:'battles',target:3,rewards:[{type:'diamond',amount:100}]},
    {id:'daily_wins',name:'勝利をつかめ',condition:'バトルに5回勝利する',key:'wins',target:5,rewards:[{type:'diamond',amount:100}]},
    {id:'daily_enhance',name:'モンスター育成',condition:'モンスターを1回強化する',key:'enhances',target:1,rewards:[{type:'trainingTicket',amount:3}]},
    {id:'daily_complete',name:'デイリーコンプリート',condition:'通常デイリー4個をすべて達成する',key:'complete',target:4,rewards:[{type:'diamond',amount:500}],complete:true},
  ],
  weekly: [
    {id:'weekly_logins',name:'継続は力なり',condition:'異なる5日分のログインを行う',key:'loginDays',target:5,rewards:[{type:'diamond',amount:500}]},
    {id:'weekly_battles',name:'バトル週間',condition:'バトルを20回行う',key:'battles',target:20,rewards:[{type:'diamond',amount:500}]},
    {id:'weekly_wins',name:'勝利の積み重ね',condition:'バトルに50回勝利する',key:'wins',target:50,rewards:[{type:'diamond',amount:500}]},
    {id:'weekly_enhance',name:'育成週間',condition:'モンスターを10回強化する',key:'enhances',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
    {id:'weekly_daily_claims',name:'デイリー挑戦者',condition:'デイリー個別報酬を15回ギフトへ送る',key:'dailyClaims',target:15,rewards:[{type:'diamond',amount:1000}]},
    {id:'weekly_market',name:'マーケット常連',condition:'マーケットで3回取引を正常完了する',key:'marketTrades',target:3,rewards:[{type:'dyeMock',amount:1}]},
    {id:'weekly_donations',name:'神殿への貢献',condition:'神殿で3回寄付を正常完了する',key:'donations',target:3,rewards:[{type:'breederPoint',amount:200}]},
    {id:'weekly_complete',name:'ウィークリーコンプリート',condition:'通常ウィークリー7個のうち6個を達成する',key:'complete',target:6,rewards:[{type:'diamond',amount:2000}],complete:true},
  ],
};
const missionDailyPeriod = loginBonusPeriodKey;
const missionWeeklyPeriod = (now=Date.now()) => { const d=new Date(Number(now)+5*60*60*1000); const day=d.getUTCDay(); d.setUTCDate(d.getUTCDate()-((day+6)%7)); return d.toISOString().slice(0,10); };
const emptyMissionCounts = () => ({login:0,battles:0,wins:0,enhances:0,dailyClaims:0,marketTrades:0,donations:0});
const normalizeMissions = (value,now=Date.now()) => {
  const dailyPeriod=missionDailyPeriod(now), weeklyPeriod=missionWeeklyPeriod(now), old=value&&typeof value==='object'?value:{};
  const dailySame=old.dailyPeriod===dailyPeriod, weeklySame=old.weeklyPeriod===weeklyPeriod;
  return {version:1,dailyPeriod,weeklyPeriod,daily:dailySame?{...emptyMissionCounts(),...(old.daily||{})}:emptyMissionCounts(),weekly:weeklySame?{...emptyMissionCounts(),...(old.weekly||{})}:emptyMissionCounts(),sentDaily:dailySame&&Array.isArray(old.sentDaily)?old.sentDaily:[],sentWeekly:weeklySame&&Array.isArray(old.sentWeekly)?old.sentWeekly:[],weeklyLoginDays:weeklySame&&Array.isArray(old.weeklyLoginDays)?old.weeklyLoginDays:[]};
};
const missionValue = (state,type,mission) => { if(mission.complete){ const normal=MISSION_DEFS[type].filter(m=>!m.complete); return normal.filter(m=>missionValue(state,type,m)>=m.target).length; } if(mission.key==='loginDays') return state.weeklyLoginDays.length; return Number(state[type]?.[mission.key])||0; };
// 「達成済みかつ未受取(ギフト未送付)」のミッション。HOMEの通知バッジ・タブのバッジ・一括受取が
// すべてこの判定を共有するので、どこか1か所だけ数え方がずれることがない
const missionClaimableList = (state,type) => MISSION_DEFS[type].filter(m=>missionValue(state,type,m)>=m.target && !(type==='daily'?state.sentDaily:state.sentWeekly).includes(m.id));
const missionClaimableCount = state => ['daily','weekly'].reduce((sum,type)=>sum+missionClaimableList(state,type).length,0);
const missionNextReset = (type,now=Date.now()) => { const shifted=new Date(Number(now)+5*60*60*1000); shifted.setUTCHours(0,0,0,0); shifted.setUTCDate(shifted.getUTCDate()+(type==='daily'?1:7-((shifted.getUTCDay()+6)%7))); return shifted.getTime()-5*60*60*1000; };
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
  // 合体XPで上がったレベルは強化ポイントの付与対象外。ロード時の不足補填でも復活させない。
  const earned = Math.max(0, masuBondLevelInfo(masu).level - 1 - donationDiamondValue(masu.fusionBondLevels));
  const missing = earned - (aptSpent + statSpent + (masu.distAptPoints || 0));
  return missing > 0 ? { ...masu, distAptPoints: (masu.distAptPoints || 0) + missing } : masu;
};
const RANGE_STYLES = {
  0: { bg: "bg-red-950/90", border: "border-red-500", text: "text-red-400", shadow: "shadow-red-500/50", glow: "drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]", slotBg: "bg-red-900/50", labelBg: "bg-red-600 text-white" },
  1: { bg: "bg-yellow-950/90", border: "border-yellow-500", text: "text-yellow-400", shadow: "shadow-yellow-500/50", glow: "drop-shadow-[0_0_15px_rgba(234,179,8,0.9)]", slotBg: "bg-yellow-900/50", labelBg: "bg-yellow-600 text-black" },
  2: { bg: "bg-emerald-950/90", border: "border-emerald-500", text: "text-emerald-400", shadow: "shadow-emerald-500/50", glow: "drop-shadow-[0_0_15px_rgba(16,185,129,0.9)]", slotBg: "bg-emerald-900/50", labelBg: "bg-emerald-600 text-white" },
  3: { bg: "bg-blue-950/90", border: "border-blue-500", text: "text-blue-400", shadow: "shadow-blue-500/50", glow: "drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]", slotBg: "bg-blue-900/50", labelBg: "bg-blue-600 text-white" }
};

// 難易度。keyはランキングの記録やハイスコアの保存にも使うので、既存のものは変更しない。
// bg=選んだときの背景色 / text=選んでいないときの文字色(難易度の雰囲気に合わせた色)。
// Tailwindの動的なクラス生成は稀に失敗して色が出ないことがあるため、実際の色はinline styleで指定する
const DIFFICULTY_SETTINGS = {
  Beginner:    { label: "Beginner",     power: 0.25, score: 0.25, gold: 0.25, bg: '#0891b2', text: '#67e8f9', color: "bg-cyan-600", shadow: "shadow-cyan-600/50" },
  Easy:        { label: "Easy",         power: 0.5,  score: 0.5,  gold: 0.5,  bg: '#059669', text: '#6ee7b7', color: "bg-emerald-600", shadow: "shadow-emerald-600/50" },
  Normal:      { label: "Normal",       power: 1.0,  score: 1.0,  gold: 1.0,  bg: '#4f46e5', text: '#a5b4fc', color: "bg-indigo-600", shadow: "shadow-indigo-600/50" },
  Hard:        { label: "Hard",         power: 1.5,  score: 2.0,  gold: 1.2,  bg: '#dc2626', text: '#fca5a5', color: "bg-red-600", shadow: "shadow-red-600/50" },
  Expert:      { label: "Expert",       power: 3.0,  score: 3.0,  gold: 1.5,  bg: '#9333ea', text: '#d8b4fe', color: "bg-purple-600", shadow: "shadow-purple-600/50" },
  Master:      { label: "Master",       power: 5.0,  score: 5.0,  gold: 2.0,  bg: '#e2e8f0', text: '#f1f5f9', color: "bg-slate-200 text-black", shadow: "shadow-white/50", darkText: true },
  GrandMaster: { label: "Grand Master", power: 6.5,  score: 8.0,  gold: 2.5,  bg: '#d97706', text: '#fcd34d', color: "bg-amber-600", shadow: "shadow-amber-500/50" },
  Hell:        { label: "Hell",         power: 8.0,  score: 12.0, gold: 3.0,  bg: '#7f1d1d', text: '#f87171', color: "bg-red-900", shadow: "shadow-red-900/60" },
  Legend:      { label: "Legend",       power: 10.0, score: 18.0, gold: 4.0,  bg: '#be185d', text: '#f9a8d4', color: "bg-pink-700", shadow: "shadow-pink-600/60" },
};
const normalizeBattleDifficulty = (value) => Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, value) ? value : 'Normal';
// 難易度の色をそのまま反映するためのinline style。選択中は背景色、未選択は文字色だけを難易度の色にする
const difficultyStyle = (setting, selected) => (selected
  ? { backgroundColor: setting.bg, color: setting.darkText ? '#0f172a' : '#ffffff' }
  : { backgroundColor: 'rgba(15,23,42,0.9)', color: setting.text });

// 透明余白を含む画像キャンバスではなく、画面ごとの見た目を基準に調整する。
// contextを必須にすることで、SCANの調整が全WAVE詳細へ波及しないようにする。
const ENEMY_ART_LAYOUT = {
  default: { scanScale:1, waveDetailScale:1, objectPosition:'center' },
  Moo: { scanScale:2.75, waveDetailScale:2, objectPosition:'center 48%' },
};
const enemyArtStyle = (enemyId, context='scan') => {
  const layout=ENEMY_ART_LAYOUT[enemyId]||ENEMY_ART_LAYOUT.default;
  const scale=context==='waveDetail'?layout.waveDetailScale:layout.scanScale;
  return {transform:`scale(${scale})`,transformOrigin:layout.objectPosition,objectPosition:layout.objectPosition};
};

// 実戦の抽選とSCANは同じ定義・使用可否評価を参照する。SCAN側は候補を評価するだけで乱数を使わない。
const ENEMY_ACTION_DEFINITIONS = [
  {id:'normal',type:'ATTACK',category:'通常攻撃',weight:45,multiplier:1,hits:1,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'special',type:'CHARGE',category:'特殊攻撃',weight:15,multiplier:2.5,hits:1,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'wait',type:'WAIT',category:'特殊行動',weight:20,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'move',type:'MOVE',category:'移動',weight:20,multiplier:0,hits:0,range:'現在以外の3間合い',condition:'移動先がある',cooldown:0,useLimit:null},
];
const evaluateEnemyActions = (ent,currentDist) => ENEMY_ACTION_DEFINITIONS.map(def => {
  const available=!!ent && (def.type!=='MOVE'||RANGE_LABELS.some((_,i)=>i!==currentDist));
  return {...def,available,unavailableReason:available?'':(!ent?'敵情報がありません':'移動先がありません')};
});
const enemyActionProbabilities = (ent,currentDist) => {
  const actions=evaluateEnemyActions(ent,currentDist),total=actions.reduce((sum,a)=>sum+(a.available?a.weight:0),0);
  return actions.map(a=>({...a,probability:a.available&&total>0?a.weight/total:0}));
};
const chooseEnemyAction = (ent,currentDist,random=Math.random) => {
  const actions=enemyActionProbabilities(ent,currentDist),roll=random(),available=actions.filter(a=>a.available);
  let cursor=roll;
  const selected=available.find(a=>{cursor-=a.probability;return cursor<0;})||available[available.length-1];
  if(!selected)return null;
  if(selected.type==='MOVE'){
    const targets=RANGE_LABELS.map((_,i)=>i).filter(i=>i!==currentDist);
    const targetDist=targets[Math.min(targets.length-1,Math.floor(random()*targets.length))];
    return {type:selected.type,value:0,label:`移動: ${RANGE_LABELS[targetDist]}`,targetDist,icon:'🏃',actionId:selected.id};
  }
  const label=selected.type==='ATTACK'?(ent.normal||'通常攻撃'):selected.type==='CHARGE'?(ent.special||'必殺技！'):'様子を見ている';
  return {type:selected.type,value:Math.floor(ent.atk*selected.multiplier),label,icon:selected.type==='ATTACK'?'👊':selected.type==='CHARGE'?'🔥':'⏳',actionId:selected.id};
};

// 難易度選択プレビューと本番の敵生成が必ず同じ値になるための唯一の生成ヘルパー。
const createBattleEnemy = (wave, difficulty, forcedEnemyKey=null) => {
  const enemyKey = forcedEnemyKey || ENEMY_SEQUENCE[wave - 1];
  const base = ENEMY_DATA[enemyKey];
  const safeDifficulty = normalizeBattleDifficulty(difficulty);
  const mod = DIFFICULTY_SETTINGS[safeDifficulty].power;
  const baseHp = Number.isFinite(Number(base?.baseHp)) ? Math.max(1, Number(base.baseHp)) : 1;
  const baseAtk = Number.isFinite(Number(base?.baseAtk)) ? Math.max(0, Number(base.baseAtk)) : 0;
  return {
    ...(base || {}),
    id:enemyKey || `missing-wave-${wave}`,
    name:base?.name || '敵データ未設定',
    imgUrl:base?.imgUrl || '',
    emoji:base?.emoji || '❓',
    hp:Math.floor(baseHp*mod),
    maxHp:Math.floor(baseHp*mod),
    atk:Math.floor(baseAtk*mod),
  };
};

const collectBondRankingEntries = (rankingPool) => {
  const byIndividual=new Map();
  Object.values(rankingPool||{}).forEach(rows=>(rows||[]).forEach(record=>{
    const userName=record?.userName||'名無しのブリーダー';
    (Array.isArray(record?.party)?record.party:[]).forEach(member=>{
      const bondLevel=Number(member?.bondLevel);
      if(!member||!Number.isFinite(bondLevel)||bondLevel<=0)return;
      const recordedMonsterId=member.baseId||member.monsterId||member.id||null;
      const monsterId=recordedMonsterId||Object.keys(ALL_PLAYER_MONSTERS).find(id=>ALL_PLAYER_MONSTERS[id]?.name===member.name)||null;
      const monName=ALL_PLAYER_MONSTERS[monsterId]?.name||member.name||null;
      if(!monName)return;
      const individualId=member.masuId!=null&&String(member.masuId)!==''
        ? `masu:${String(member.masuId)}`
        : `legacy:${monsterId||monName}`;
      const key=`${userName}\u0000${individualId}`;
      const entry={userName,icon:record.icon,monName,bondLevel,imgUrl:ALL_PLAYER_MONSTERS[monsterId]?.iconUrl||member.imgUrl||null,emoji:member.emoji||ALL_PLAYER_MONSTERS[monsterId]?.emoji||null,masuId:member.masuId??null,monsterId};
      const current=byIndividual.get(key);
      if(!current)byIndividual.set(key,entry);
      else byIndividual.set(key,{...(bondLevel>current.bondLevel?entry:current),bondLevel:Math.max(current.bondLevel,bondLevel)});
    });
  }));
  // 同じ人・同じ種類で「個体ID(masuId)付きの記録」と「個体IDの無い古い記録」が両方あると、
  // 同じマスモンが2件に分かれて並んでしまう。古い記録はどの個体かを特定できないので、
  // 個体ID付きの記録がある種類では古い記録を出さない。
  // ただし古い記録の方が高い絆Lvを持っている場合は、その値だけ個体側へ引き継ぐ。
  const entries=[...byIndividual.values()];
  const speciesKey=e=>`${e.userName}\u0000${e.monsterId||e.monName}`;
  const bestMasuOfSpecies=new Map();
  entries.forEach(e=>{
    if(e.masuId==null||String(e.masuId)==='')return;
    const key=speciesKey(e);
    const current=bestMasuOfSpecies.get(key);
    if(!current||e.bondLevel>current.bondLevel)bestMasuOfSpecies.set(key,e);
  });
  const deduped=entries.filter(e=>{
    if(e.masuId!=null&&String(e.masuId)!=='')return true;
    const owner=bestMasuOfSpecies.get(speciesKey(e));
    if(!owner)return true; // 個体IDの記録が無ければ、古い記録をそのまま出す
    if(e.bondLevel>owner.bondLevel)owner.bondLevel=e.bondLevel;
    return false;
  });
  return deduped.sort((a,b)=>b.bondLevel-a.bondLevel||a.userName.localeCompare(b.userName,'ja'));
};

// ランキングに出すモンスターの絵。記録にはIDだけが入っているので、同梱の絵を引いて使う。
// 画像を埋め込んでいた頃の古い記録は、そのimgUrlをそのまま使って表示できるようにしておく。
const rankingMonsterIdOf = (member) => {
  if (!member) return null;
  const recorded = member.baseId||member.monsterId||member.id;
  if (recorded && ALL_PLAYER_MONSTERS[recorded]) return recorded;
  // 古い記録は種類のIDを持たず名前しか無いことがあるので、名前からも引く
  return Object.keys(ALL_PLAYER_MONSTERS).find(id=>ALL_PLAYER_MONSTERS[id]?.name===member.name) || null;
};
// 編成の各モンスターに、そのプレイ時点の絆Lvを添える。
// bondLevel は記録にもとから入っているので、表示するだけで通信は増えない。
// マスモンでない(絆Lvを持たない)モンスターは何も出さない。
const rankingMemberLevel = (member) => {
  const level = Number(member?.bondLevel);
  return Number.isFinite(level) && level > 0 ? level : null;
};
const rankingMemberImage = (member) => {
  if (!member) return null;
  const base = ALL_PLAYER_MONSTERS[rankingMonsterIdOf(member)];
  return base?.iconUrl || member.imgUrl || null;
};

const splitRankingParty = (entry) => {
  if (!Array.isArray(entry?.party)) return {hero:null,allies:null};
  const members = entry.party.filter(Boolean);
  const roleHeroIndex = members.findIndex(member=>member?.role==='hero');
  if (roleHeroIndex >= 0) return {hero:members[roleHeroIndex],allies:members.filter((_,i)=>i!==roleHeroIndex && members[i]?.role!=='hero')};
  // 旧記録は個体IDを優先し、無ければ表示名一致の最初の1体だけを勇者として分離する。
  let heroIndex = entry?.heroMasuId != null ? members.findIndex(m=>m?.masuId!=null&&String(m.masuId)===String(entry.heroMasuId)) : -1;
  if (heroIndex < 0) heroIndex = members.findIndex(member=>member?.name===entry?.hero);
  if (heroIndex < 0) return {hero:null,allies:null};
  return {hero:members[heroIndex],allies:members.filter((_,i)=>i!==heroIndex)};
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
// sb_publishable_* は Data API の apikey 用であり、JWT ではない。Bearer にも設定すると
// PostgREST が publishable key を JWT として検証して 401 (Invalid JWT) にするため送らない。
// ログには秘密値そのものを出さず、公開設定を読み込めたことだけを記録する。
const SB_HEADERS = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };

// 画面表示名とDB識別子を分離し、ランキング通信では必ず既存の難易度keyへ正規化する。
const normalizeRankingDifficulty = (value) => {
  const compact = String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
  const canonical = Object.keys(DIFFICULTY_SETTINGS).find(key => key.toLowerCase() === compact);
  if (!canonical) throw new Error(`unknown ranking difficulty: ${String(value)}`);
  return canonical;
};
// 通信、state、リクエスト管理、画面参照で共有する唯一のランキング内部キー。
// 表示ラベルや大文字小文字の異なる入力を、そのままオブジェクトキーにしない。
const rankingDifficultyKey = (value) => normalizeRankingDifficulty(value);

// 難易度ごとの記録を取得する。order を変えることで「スコア上位」と「レベル上位」を出し分ける
// 表示件数。rankingsテーブルにdifficulty+scoreの索引が無く、取得のたびに全行を走査して
// 並べ替えているため、件数を増やすとそのまま待ち時間になる。索引を追加するまでは20件にする。
const RANKING_DIAGNOSTIC_LIMIT = 20;
// 取得ごとの詳細ログは切り分け用。常時出すと件数ぶんの文字列生成が毎回走るので、
// 必要なときだけ localStorage の mh_ranking_debug='1' で有効にする(エラーは常に出す)。
const rankingDebugEnabled = () => { try { return window.localStorage.getItem('mh_ranking_debug') === '1'; } catch { return false; } };
const rankingLog = (requestId, event, detail={}) => { if (rankingDebugEnabled()) console.info('[ranking][diagnostic]', { requestId, event, at: new Date().toISOString(), ...detail }); };
// レベル系ランキングは難易度で絞らず1回で取る。件数が多いほど並べ替えと転送に時間がかかるため、
// 表示に必要な範囲にとどめる
const RANKING_LEVEL_FETCH_LIMIT = 60;
// ブリーダーLvは編成(party)を使わない。partyはJSONで1行あたりが大きいため、
// 使わない場面では取得しないだけで転送量と待ち時間がはっきり減る
const RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon';
const RANKING_SELECT_NO_PARTY = 'user_name,hero,score,level,icon';
const sbFetchRankings = async (diff, limit=RANKING_DIAGNOSTIC_LIMIT, order='score.desc.nullslast', offset=0, requestId='untracked', selectColumns=RANKING_SELECT_FULL) => {
  // diff を省略(null)すると難易度で絞らず、全難易度をまとめて取る
  const normalizedDifficulty = diff == null ? null : normalizeRankingDifficulty(diff);
  // 必要な列だけを受け取り、過去記録が多い難易度でもレスポンスを不用意に大きくしない。
  const select = selectColumns || RANKING_SELECT_FULL;
  // DBに保存する正規keyと同じ値をeqで取得する。ilikeによる別系統の
  // 取得条件を残さず、NormalもHardと完全に同じSELECT経路にする。
  const difficultyFilter = normalizedDifficulty == null ? '' : `&difficulty=eq.${encodeURIComponent(normalizedDifficulty)}`;
  const url = `${SUPABASE_URL}/rest/v1/rankings?select=${select}${difficultyFilter}&order=${order}&limit=${limit}&offset=${offset}`;
  const startedAt = Date.now();
  rankingLog(requestId, 'request-start', {
    difficulty: normalizedDifficulty, requestedDifficulty: diff, category: 'ranking', rankingType: order, table: 'rankings',
    columns: select, limit, offset, url, supabaseUrl: SUPABASE_URL,
    keyLoaded: Boolean(SUPABASE_KEY), keyType: SUPABASE_KEY.startsWith('sb_publishable_') ? 'publishable' : 'legacy'
  });
  // モバイル回線などで接続だけが残り続けても、ランキング画面を永久に待機させない。
  const controller = new AbortController();
  // 8秒では「遅いだけで成功する取得」まで失敗扱いになり、そのたびに端末内の復旧表示へ
  // 落ちていた。回線が細くても待てる範囲まで伸ばす(それでも返らなければ打ち切る)
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    rankingLog(requestId, 'supabase-response', { difficulty: normalizedDifficulty, endedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt, status: res.status, statusText: res.statusText, ok: res.ok, dataCount: res.ok ? (() => { try { const parsed = JSON.parse(body); return Array.isArray(parsed) ? parsed.length : null; } catch { return null; } })() : null, error: res.ok ? null : body });
    if (!res.ok) throw new Error(`fetch ${res.status} ${res.statusText}; url=${url}; response=${body || '(empty)'}`);
    try {
      return JSON.parse(body);
    } catch (e) {
      throw new Error(`invalid JSON; url=${url}; response=${body || '(empty)'}; error=${e.message}`);
    }
  } catch (error) {
    const normalized = error?.name === 'AbortError'
      ? new Error(`ranking request timed out after 8000ms; url=${url}`)
      : error;
    rankingLog(requestId, 'supabase-error', { difficulty: normalizedDifficulty, endedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt, timeout: error?.name === 'AbortError', networkError: error instanceof TypeError, name: normalized?.name, message: normalized?.message, stack: normalized?.stack });
    throw normalized;
  } finally {
    clearTimeout(timer);
  }
};
// 記録を1件挿入する(1プレイ=1件)
const sbInsertScore = async (row) => {
  // 全国ランキングの書き込みは常にclear_id必須とする。呼び出し側の指定漏れで通常POSTへ
  // 戻る経路を残すと、タイムアウト後の再送などが同じクリアを別行として保存してしまう。
  if (typeof row?.clear_id !== 'string' || !row.clear_id.trim()) {
    throw new Error('ranking clear_id is required; unsafe insert skipped');
  }
  const normalizedRow = { ...row, difficulty: normalizeRankingDifficulty(row?.difficulty) };
  const requestId = `insert-${normalizedRow.difficulty}-${Date.now()}`;
  const query = '?on_conflict=clear_id';
  const prefer = 'resolution=ignore-duplicates,return=minimal';
  // 結果画面はこのPOSTが確定するまで入力をロックするため、通信が切れかけた端末でも
  // 永久に「処理中」にならないようGETと同じ上限を設ける。タイムアウト後はclear_id付きの
  // ローカル記録へ退避し、同じクリアを非冪等なPOSTで再送しない。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    rankingLog(requestId, 'insert-start', {
      difficulty: normalizedRow.difficulty, table: 'rankings', clearId: normalizedRow.clear_id,
      score: normalizedRow.score, userName: normalizedRow.user_name, level: normalizedRow.level,
      hasIcon: Boolean(normalizedRow.icon), columns: Object.keys(normalizedRow), payload: normalizedRow
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings${query}`, { method:'POST', headers:{...SB_HEADERS, 'Prefer':prefer}, body: JSON.stringify(normalizedRow), signal: controller.signal });
    const body = await res.text();
    let errorCode = null;
    if (body) {
      try { errorCode = JSON.parse(body)?.code || null; } catch {}
    }
    const isUniqueViolation = res.status === 409 && errorCode === '23505';
    rankingLog(requestId, 'insert-response', {
      difficulty: normalizedRow.difficulty, clearId: normalizedRow.clear_id,
      status: res.status, statusText: res.statusText, ok: res.ok,
      errorCode, isUniqueViolation, error: res.ok ? null : (body || res.statusText)
    });
    if (!res.ok) {
      const error = new Error(`insert ${res.status}: ${body || res.statusText}`);
      error.status = res.status;
      error.body = body;
      error.code = errorCode;
      error.isUniqueViolation = isUniqueViolation;
      throw error;
    }
    return { saved: true, status: res.status, body, row: normalizedRow };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('ranking insert timed out after 8000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// 全国保存と端末内フォールバックの成否を混同しない共通送信経路。
// insertが失敗しても診断情報を端末側の行へ残すが、全国保存成功としては返さない。
const persistRankingScore = async ({ row, insertScore=sbInsertScore, saveLocal }) => {
  try {
    const response = await insertScore(row);
    return { nationalSaved: response?.saved === true, localSaved: false, response, error: null };
  } catch (error) {
    let localSaved = false;
    try {
      await saveLocal(error);
      localSaved = true;
    } catch (localError) {
      console.error('[ranking] local fallback also failed:', localError && localError.message ? localError.message : localError);
    }
    return { nationalSaved: false, localSaved, response: null, error };
  }
};

const createRunId = () => globalThis.crypto?.randomUUID?.() || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

// 難易度に依存しない周回開始処理。Normalだけ前周のclear_idや送信ロックを引き継ぐ
// 分岐が生まれないよう、タイトル復帰と再挑戦の両方からこの1か所を呼ぶ。
const beginNewRankingRun = ({ runIdRef, scoreSubmittedRef, runFinalizingRef, rewardsAwardedRef, clearRecordedRef }) => {
  runFinalizingRef.current = false;
  scoreSubmittedRef.current = false;
  rewardsAwardedRef.current = false;
  clearRecordedRef.current = false;
  runIdRef.current = createRunId();
  return runIdRef.current;
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
  const [gameState, setGameState] = useState('HOME');
  const [battleMenuTab, setBattleMenuTab] = useState('difficulty');
  const [managementTab, setManagementTab] = useState('monster');
  const [homeBackgroundReady, setHomeBackgroundReady] = useState(false);
  const [showOfficialTitleConfirm, setShowOfficialTitleConfirm] = useState(false);
  const [difficulty, setDifficulty] = useState('Normal');
  const safeDifficulty = normalizeBattleDifficulty(difficulty);
  useEffect(() => {
    if (difficulty !== safeDifficulty) setDifficulty(safeDifficulty);
  }, [difficulty, safeDifficulty]);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState({});
  const highScoresRef = useRef({});
  useEffect(() => { highScoresRef.current = highScores; }, [highScores]);
  const [attemptCounts, setAttemptCounts] = useState({}); // 難易度別 挑戦回数(端末保存)
  const [clearCounts, setClearCounts] = useState({}); // 難易度別 クリア回数(端末保存)
  const [highestWaves, setHighestWaves] = useState({});
  const [onboarded, setOnboarded] = useState(true); // false=初回起動(プロフィール設定へ誘導)
  const [onboardingStep, setOnboardingStep] = useState('intro-0');
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingIcon, setOnboardingIcon] = useState(null);
  const [showWaveDetails, setShowWaveDetails] = useState(false);
  const [waveScanPreview, setWaveScanPreview] = useState(null);
  const difficultyCarouselRef = useRef(null);
  // 起動UIはゲーム本体と別の明示的な状態機械で管理する。
  const [bootPhase, setBootPhase] = useState('LOADING');
  const [titleStarting, setTitleStarting] = useState(false);
  const [entryAnimating, setEntryAnimating] = useState(false);
  const [enteringSlow, setEnteringSlow] = useState(false);
  // ハブ側の操作はこのDocumentのuser activationにならないため、起動画面内での解除だけを記録する。
  // refも併用し、pointerdown直後のclickが同じ操作でトップ遷移を始めないよう同期的に判定する。
  const [bootSoundUnlocked, setBootSoundUnlocked] = useState(false);
  const bootSoundUnlockedRef = useRef(false);
  // タイトル表示を止めずにHOME背景を先読みする。decode非対応時もload完了で表示する。
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.src = 'data/images/home-background.png';
    const reveal = () => { if (active) setHomeBackgroundReady(true); };
    image.onload = () => {
      if (image.decode) image.decode().catch(()=>{}).then(reveal);
      else reveal();
    };
    image.onerror = reveal;
    if (image.complete) image.onload();
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, []);
  const entryAnimatingRef = useRef(false);
  const titleStartingRef = useRef(false);
  const [showTitleSettings, setShowTitleSettings] = useState(false);
  const [titlePlayerId] = useState(() => {
    try {
      const saved = window.localStorage.getItem('mh_player_id');
      if (saved) return saved;
      const id = `MH-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      window.localStorage.setItem('mh_player_id', id);
      return id;
    } catch { return 'MH-LOCAL'; }
  });
  const [dataLoaded, setDataLoaded] = useState(false); // 端末に保存したセーブデータの読み込みが終わったか
  const [bootProgress, setBootProgress] = useState({ done: 0, total: 10, label: 'ゲームシステムを起動中' });
  const [localRankings, setLocalRankings] = useState({});
  // ブリーダーLv・絆Lvの集計に使う記録。スコア上位に入らなかった直近のプレイも含むので、
  // スコアランキングの表示(localRankings)とは別に持つ
  const [bondRankingData, setBondRankingData] = useState(null);
  const [bondRankingLoading, setBondRankingLoading] = useState(false);
  const [bondRankingError, setBondRankingError] = useState(null);
  const [rankingSourceByDiff, setRankingSourceByDiff] = useState({}); // {[diff]: 'global'|'local'} 表示中データの取得元
  // 表示状態はランキング単位で独立させる。取得済み（0件を含む）なら再取得中も
  // loadingへ戻さず、キャッシュを表示したままrefreshingだけを立てる。
  const [rankingStatusByKey, setRankingStatusByKey] = useState({});
  // 絆Lvとは結果も進行中Promiseも共有せず、タブを往復しても表示済み結果を保持する。
  const [breederRankingPool, setBreederRankingPool] = useState({});
  // 起動時の先読みと画面を開いた時の取得を共有し、同じ難易度への二重通信を防ぐ。
  const rankingRequestsRef = useRef(new Map());
  // 前回表示したランキングを端末に残しておき、次に開いたときは通信を待たずにそのまま出す。
  // (取得は裏で走らせ、返ってきたら差し替える)
  const RANKING_CACHE_KEY = 'mh_ranking_cache';
  const rankingCacheRef = useRef({ score: {}, breeder: null, bond: null });
  const rankingFetchedAtRef = useRef(new Map());
  const rankingLatestRequestRef = useRef(new Map());
  const rankingRequestSequenceRef = useRef(0);
  const rankingStatusGenerationRef = useRef(new Map());
  const [showRanking, setShowRanking] = useState(false);
  // ラン終了処理は通信中の連打や再レンダーがあっても、1周につき必ず1回だけ実行する。
  // stateでは更新前に次のイベントが入る余地があるため、同期的に書き換わるrefをロックに使う
  const runFinalizingRef = useRef(false);
  const scoreSubmittedRef = useRef(false);
  const rewardsAwardedRef = useRef(false);
  const clearRecordedRef = useRef(false);
  const runIdRef = useRef(createRunId());
  const [runFinalizing, setRunFinalizing] = useState(false);
  const [resultProcessing, setResultProcessing] = useState(false);
  // 最終画面の遷移ボタンも、最初のpointer/clickを受けた瞬間に同期ロックする。
  // Reactのstate反映前に「再挑戦」「トップへ」が続けて押されても、初回だけを通す。
  const resultActionRef = useRef(false);
  const [resultActionPending, setResultActionPending] = useState(false);
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
  const rankingViewKey = rankingDifficultyKey(rankingViewDiff);
  const [rankingKind, setRankingKind] = useState('score'); // 'score' | 'breeder' | 'bond'
  const [bondRankMonFilter, setBondRankMonFilter] = useState('all'); // 絆レベルランキングのモンスター種別フィルタ
  // マスモン強化の「まとめて振る」下書き。確定するまで実際のポイントは減らさない
  const [bulkPlan, setBulkPlan] = useState(null); // null=1ポイントずつのモード / {apt:[0,0,0,0], stat:{...}}
  // 合体画面の並べかえ。マスモンが増えると目的の個体を探しにくいため
  const [fusionSortKey, setFusionSortKey] = useState('bond'); // 'bond'|'lineage'|'name'|'fused'
  const [fusionSortDir, setFusionSortDir] = useState('desc');
  const [donationSortKey, setDonationSortKey] = useState('bondXp');
  const [donationSortDir, setDonationSortDir] = useState('desc');
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
  // 勇者モンを配置した間合いを、最初のWAVE開始時の内部距離にも使用する。
  // state更新直後にバトルへ進んでも取りこぼさないよう同期的なrefで保持する。
  const initialBattleDistanceRef = useRef(2);
  const [selectedCards, setSelectedCards] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [monSelection, setMonSelection] = useState([]);
  const [currentPickingMon, setCurrentPickingMon] = useState(null);
  const [ownedUniques, setOwnedUniques] = useState([]);
  const [slotUniqueChoice, setSlotUniqueChoice] = useState({}); // スロットidx→選択中の固有技キー('own'または'inh0'等)。合体で引き継いだ固有技をバトル中に切り替えるための選択状態
  const [slotUniqueLevelChoice, setSlotUniqueLevelChoice] = useState({}); // スロットidx→選択中の固有技レベル(0〜評価上限)。未指定(undefined)ならそのモンスターの現在の強化到達レベル(最大)を使う
  // 合体で引き継いだ固有技の、このランでの強化到達レベル。キーは「スロットidx:引き継ぎ技の番号」。
  // 自分の固有技(ownedUniques)と同じく1ランかぎりで、強化フェーズのポイントで上げ下げする
  const [inheritedUniqueEvo, setInheritedUniqueEvo] = useState({});
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
  const [skillEffectDetail, setSkillEffectDetail] = useState(null); // 技の効果が枠に収まらないときに全文を出すモーダル
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
  const [homePastureIds, setHomePastureIds] = useState([]);
  const [draftHomePastureIds, setDraftHomePastureIds] = useState([]);
  const [pastureLoaded, setPastureLoaded] = useState(false);
  const [ownedItems, setOwnedItems] = useState({}); // マーケットで買った消耗アイテムの所持数 { itemId: count } (端末保存)
  const [trainingSelectedId, setTrainingSelectedId] = useState(null);
  const [trainingDifficulty, setTrainingDifficulty] = useState('BEGINNER');
  const [trainingSession, setTrainingSession] = useState(null);
  const trainingFinalizingRef = useRef(false);
  const trainingMovingRef = useRef(false);
  const trainingRollTimerRef = useRef(null);
  const trainingMapRef = useRef(null);
  const trainingPieceRef = useRef(null);
  const [trainingModal,setTrainingModal]=useState(null);
  const [trainingDebugOpen,setTrainingDebugOpen]=useState(false);
  const [trainingDebugRoll,setTrainingDebugRoll]=useState(null);
  const [trainingMapOverview,setTrainingMapOverview]=useState(false);
  const [trainingDiceStage,setTrainingDiceStage]=useState('idle');
  const [trainingDiceFace,setTrainingDiceFace]=useState(1);
  const [trainingMapScale,setTrainingMapScale]=useState(1);
  const trainingPointersRef=useRef(new Map());
  const trainingGestureRef=useRef({distance:0,scale:1,last:null,moved:false});
  const trainingSuppressTapRef=useRef(0);
  const [trainingEffect,setTrainingEffect]=useState(null);
  const trainingEffectTimerRef=useRef(null);
  useEffect(()=>()=>{if(trainingRollTimerRef.current)clearInterval(trainingRollTimerRef.current);},[]);
  useEffect(()=>()=>{if(trainingEffectTimerRef.current)clearTimeout(trainingEffectTimerRef.current);},[]);
  useEffect(()=>{if(gameState!=='TRAINING_BOARD'||trainingMapOverview)return;requestAnimationFrame(()=>{const viewport=trainingMapRef.current,current=TRAINING_NODE_BY_ID[trainingSession?.position],next=TRAINING_NODE_BY_ID[trainingSession?.routePreview?.[0]];if(!viewport||!current)return;const focus=next?{x:current.x+(next.x-current.x)*.7,y:current.y+(next.y-current.y)*.7}:current;viewport.scrollTo({left:720*focus.x/100-viewport.clientWidth*.42,top:520*focus.y/100-viewport.clientHeight*.5,behavior:'smooth'});});},[gameState,trainingSession?.position,trainingSession?.routePreview?.[0],trainingMapOverview]);
  const [gifts, setGifts] = useState([]);
  const [giftTab, setGiftTab] = useState('unclaimed');
  const [missions, setMissions] = useState(()=>normalizeMissions(null));
  const missionsRef = useRef(missions);
  missionsRef.current = missions;
  const [missionTab, setMissionTab] = useState('daily');
  const missionClaimingRef = useRef(false);
  const [loginBonusPopup, setLoginBonusPopup] = useState(null);
  const giftClaimingRef = useRef(false);
  const [pendingItemUse, setPendingItemUse] = useState(null); // アイテム欄で「使う」を押した後、対象のマスモンを選ぶ画面用(itemId)
  const [xpTicketUse, setXpTicketUse] = useState(null); // 絆経験値チケットをまとめて使う画面用 {itemId, masuId, count}
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
  const [donationSelectedId, setDonationSelectedId] = useState(null);
  const [donationResult, setDonationResult] = useState(null);
  const [donationError, setDonationError] = useState('');
  const [donationProcessing, setDonationProcessing] = useState(false);
  const [donationAnimation, setDonationAnimation] = useState(null);
  const donationProcessingRef = useRef(false);
  const [rebirthSelectedId, setRebirthSelectedId] = useState(null);
  const [rebirthSkillKey, setRebirthSkillKey] = useState('');
  const [rebirthError, setRebirthError] = useState('');
  const [rebirthAnimation, setRebirthAnimation] = useState(null);
  const rebirthProcessingRef = useRef(false);
  const [levelCapCompensation, setLevelCapCompensation] = useState(null);
  const masuMonsRef = useRef(masuMons);
  masuMonsRef.current = masuMons;
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
  const [monsterDisplayFlags, setMonsterDisplayFlags] = useState({ ...DEFAULT_MONSTER_LIST_SETTINGS.display }); // 各カードに出す情報(複数選択可、オフで非表示)
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
  const [latestBuild, setLatestBuild] = useState(null); // 見つかった新しいバージョン
  // 「あとで更新する」で閉じたバージョン。バトル中など今すぐ更新したくない場面で
  // 画面から消せるようにする。閉じても更新は行わず、次に開き直したときや
  // さらに新しいバージョンが出たときはまた表示する
  const [dismissedUpdateBuild, setDismissedUpdateBuild] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false); // 更新履歴モーダルの表示状態
  const [changelogTab, setChangelogTab] = useState('update'); // 'update'=更新情報 / 'issue'=不具合情報
  const [changelogSeen, setChangelogSeen] = useState({ update: [], issue: [] }); // タブごとの既読ID一覧(端末に保存)
  const displayedChangelogTabRef = useRef(null); // 表示中のタブは、そこから離れるまで未読のまま保つ
  const [seVolume, setSeVolumeState] = useState(DEFAULT_VOLUME); // SE音量 0〜100(端末に保存、初期値は読み込み後に上書き)
  const [bgmVolume, setBgmVolumeState] = useState(DEFAULT_VOLUME); // BGM音量 0〜100(同上)
  // 音は初期状態でオン(音量1)。ただしブラウザは操作なしに音を鳴らせないため、
  // 実際に音が出るのは最初のタップ以降になる(下のuseEffectで自動的に解除する)
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [showAudioSettings, setShowAudioSettings] = useState(false); // 音量設定モーダルの表示状態
  const [showBgmArrangement, setShowBgmArrangement] = useState(false);
  const [bgmArrangement, setBgmArrangement] = useState(DEFAULT_BGM_ARRANGEMENT);
  const [previewTrackId, setPreviewTrackId] = useState(null);
  const [quickMuted, setQuickMuted] = useState(false);
  const audioOn = audioUnlocked && !quickMuted;
  const setSeVolumeRaw = (nv) => { setSeVolumeState(nv); storeSet('mh_se_volume', nv, false); };
  const setBgmVolumeRaw = (nv) => { setBgmVolumeState(nv); storeSet('mh_bgm_volume', nv, false); };
  // 音量スライダー操作時に呼ぶ: 未解除ならブラウザの音声ロックを解除しつつ値を保存する
  const changeSeVolume = (v) => { const nv = Math.max(0, Math.min(100, v)); setSeVolumeRaw(nv); setQuickMuted(false); if (!audioUnlocked) setAudioUnlocked(true); Audio_.unlock(true); };
  const changeBgmVolume = (v) => { const nv = Math.max(0, Math.min(100, v)); setBgmVolumeRaw(nv); setQuickMuted(false); if (!audioUnlocked) setAudioUnlocked(true); Audio_.unlock(true); };
  const audioMuted = !audioOn;
  // バトル画面などスペースが限られる場所向けの1タップミュート切替(詳細な音量調整は設定パネルのスライダーで行う)
  const toggleQuickMute = () => {
    storeSet('mh_audio_muted', !quickMuted, false);
    if (quickMuted) Audio_.unlock();
    else Audio_.setEnabled(false);
    setQuickMuted(current => !current);
  };
  const closeBgmArrangement = () => { Audio_.stopPreview(); setPreviewTrackId(null); setShowBgmArrangement(false); };
  const changeBgmArrangement = (scene, trackId) => {
    if (!BGM_TRACK_BY_ID[trackId] || bgmArrangement[scene] === trackId) return;
    setBgmArrangement(current => ({ ...current, [scene]:trackId }));
  };
  const toggleBgmPreview = async trackId => {
    await Audio_.unlock();
    const started = await Audio_.previewBGM(trackId);
    setPreviewTrackId(started ? trackId : null);
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
  // タブ別の既読ID集合を比較するため、再ビルドやBUILD_DATE変更で過去項目は復活しない。
  const changelogUnreadIds = Object.fromEntries(CHANGELOG_TYPES.map(type => [type, CHANGELOG_IDS_BY_TYPE[type].filter(id=>!(changelogSeen[type]||[]).includes(id))]));
  const changelogUnread = Object.fromEntries(CHANGELOG_TYPES.map(type => [type, changelogUnreadIds[type].length>0]));
  const hasUnreadChangelog = changelogUnread.update || changelogUnread.issue;
  const markChangelogTabSeen = (type) => {
    const ids = CHANGELOG_IDS_BY_TYPE[type];
    if (!ids.length || !changelogUnreadIds[type].length) return;
    setChangelogSeen(prev => ({ ...prev, [type]: ids }));
    storeSet(`mh_changelog_seen_ids_${type}`, ids, false);
  };
  const selectChangelogTab = (type) => {
    if (displayedChangelogTabRef.current === type) return;
    if (displayedChangelogTabRef.current) markChangelogTabSeen(displayedChangelogTabRef.current);
    displayedChangelogTabRef.current = type;
    setChangelogTab(type);
  };
  const openChangelog = () => {
    displayedChangelogTabRef.current = 'update';
    setChangelogTab('update');
    setShowChangelog(true);
  };
  const closeChangelog = () => {
    if (displayedChangelogTabRef.current) markChangelogTabSeen(displayedChangelogTabRef.current);
    displayedChangelogTabRef.current = null;
    setShowChangelog(false);
  };
  const [helpTab, setHelpTab] = useState('goal');
  const [pendingReward, setPendingReward] = useState(null);
  // 隠しデバッグ戦は通常周回と結果処理を共有しない。stateに加えて同期的なrefを持ち、
  // 敗北・諦め・勝利の非同期処理が通常の保存処理へ入る前に必ず判定できるようにする。
  const [debugBattle, setDebugBattle] = useState(false);
  const debugBattleRef = useRef(false);
  const [debugEnemyKey, setDebugEnemyKey] = useState(null);
  const [debugOutcome, setDebugOutcome] = useState(null);
  const debugResultRef = useRef(false);

  const scoreMultiplier = useMemo(() => DIFFICULTY_SETTINGS[safeDifficulty].score, [safeDifficulty]);
  const goldMultiplier = useMemo(() => DIFFICULTY_SETTINGS[safeDifficulty].gold, [safeDifficulty]);
  const effectiveMaxHp = useMemo(() => Math.floor(maxHp * (1.0 + getPermaBuff('muaHpPct'))), [maxHp, permaBuffs]);
  const effectiveMaxGuts = useMemo(() => Math.floor(maxGuts * (1.0 + getPermaBuff('muaGutsPct'))), [maxGuts, permaBuffs]);

  // 全国ランキングをSupabaseから取得。失敗時は端末内保存の値にフォールバック
  // ブリーダーレベルのランキング。ランキング行は難易度ごとに保存されているので、
  // 同じプレイヤーが複数の難易度に現れる。名前で1件にまとめ、最も高いレベルを採用する。
  // (専用の列を増やさず、スコア送信時に一緒に保存しているlevelから集計している)
  const breederRanking = useMemo(() => {
    const byName = new Map();
    Object.values(breederRankingPool).forEach(rows => (rows || []).forEach(r => {
      const name = r.userName || '名無しのブリーダー';
      const lv = r.level || 0;
      const cur = byName.get(name);
      if (!cur || lv > cur.level) byName.set(name, { ...r, userName: name, level: lv });
    }));
    return [...byName.values()].filter(x => x.level > 0).sort((a, b) => b.level - a.level).slice(0, 50);
  }, [breederRankingPool]);

  // party内の全マスモンを対象にし、新形式はmasuId、旧形式は種族ID/名前で個体を互換集計する。
  const bondRankingAll = useMemo(() => collectBondRankingEntries(bondRankingData || {}), [bondRankingData]);

  // 種類別フィルタの選択肢。まだ誰も記録を出していないモンスターもタブに出したいので、
  // 記録から拾った名前ではなく、全モンスターの名前を並べる(記録が無い種は「まだいません」になる)
  const bondRankingMonNames = useMemo(() => {
    const all = Object.values(ALL_PLAYER_MONSTERS).map(m => m.name);
    // 念のため、記録にしか出てこない名前(過去に居たモンスター等)も取りこぼさないよう足しておく
    bondRankingAll.forEach(x => { if (x.monName && !all.includes(x.monName)) all.push(x.monName); });
    return [...new Set(all)];
  }, [bondRankingAll]);
  const bondRanking = useMemo(() => (
    bondRankMonFilter === 'all' ? bondRankingAll.slice(0, 50) : bondRankingAll.filter(x => x.monName === bondRankMonFilter).slice(0, 50)
  ), [bondRankingAll, bondRankMonFilter]);
  const emptyRankingStatus = { loading:false, refreshing:false, error:null, fetched:false };
  const rankingStatus = (key) => rankingStatusByKey[key] || emptyRankingStatus;
  const saveRankingCache = (patch) => {
    const current = rankingCacheRef.current || { score: {}, breeder: null, bond: null };
    const next = { ...current, ...patch };
    if (patch.score) next.score = { ...(current.score || {}), ...patch.score };
    rankingCacheRef.current = next;
    // 保存の失敗(容量超過など)は表示に影響しないので握りつぶす
    try { storeSet(RANKING_CACHE_KEY, { ...next, at: Date.now() }, false); } catch {}
  };
  // 端末に残っている前回の内容を、通信を待たずに画面へ出す
  const hydrateRankingCache = (cached) => {
    if (!cached || typeof cached !== 'object') return;
    const score = (cached.score && typeof cached.score === 'object') ? cached.score : {};
    const breeder = Array.isArray(cached.breeder) ? cached.breeder : null;
    const bond = Array.isArray(cached.bond) ? cached.bond : null;
    rankingCacheRef.current = { score, breeder, bond };
    const cachedStatus = { loading:false, refreshing:false, error:null, fetched:true };
    const statusPatch = {};
    Object.entries(score).forEach(([diff, rows]) => { if (Array.isArray(rows) && rows.length) statusPatch[`score:${diff}`] = cachedStatus; });
    if (Object.keys(score).length) setLocalRankings(prev => ({ ...score, ...prev }));
    if (breeder && breeder.length) { setBreederRankingPool(prev => (Object.keys(prev||{}).length ? prev : { all: breeder })); statusPatch['breeder:all'] = cachedStatus; }
    if (bond && bond.length) setBondRankingData(prev => (prev ? prev : { all: bond }));
    if (Object.keys(statusPatch).length) setRankingStatusByKey(prev => ({ ...statusPatch, ...prev }));
  };
  const beginRankingStatus = (key) => {
    const generation = (rankingStatusGenerationRef.current.get(key) || 0) + 1;
    rankingStatusGenerationRef.current.set(key, generation);
    setRankingStatusByKey(prev => {
      const current = prev[key] || emptyRankingStatus;
      return { ...prev, [key]: { ...current, loading:!current.fetched, refreshing:current.fetched, error:null } };
    });
    return generation;
  };
  const finishRankingStatus = (key, generation, error=null, fetched=true) => {
    if (rankingStatusGenerationRef.current.get(key) !== generation) return;
    setRankingStatusByKey(prev => {
      const current = prev[key] || emptyRankingStatus;
      return { ...prev, [key]: { ...current, loading:false, refreshing:false, error, fetched:current.fetched || fetched } };
    });
  };

  const loadRankings = useCallback(async (targetDiff=null, includeLevels=false, force=false, levelKind='bond') => {
    const normalizedTargetDiff = targetDiff == null ? null : rankingDifficultyKey(targetDiff);
    const byDiff = {};
    const poolByDiff = {};
    const sourceByDiff = {};
    // 古い記録には編成に画像が埋め込まれている。表示には使わないので、
    // 画面のstateへ持ち込む前に落として、端末側のメモリと再描画の負担を減らす
    // 同梱の絵で置き換えられる相手だけ落とす。どのモンスターか分からない古い記録は、
    // 埋め込まれた絵をそのまま残す(消すと絵文字表示に落ちてしまうため)
    const stripPartyImages = (party) => (Array.isArray(party) ? party.map(m => (m && m.imgUrl && rankingMonsterIdOf(m)) ? { ...m, imgUrl: undefined } : m) : party);
    const toEntry = (r) => ({ userName: r.user_name, hero: r.hero, party: stripPartyImages(r.party), score: r.score, level: r.level, icon: r.icon });
    // 過去の多重送信はidが異なるため、プレイ内容そのものをキーにして畳む。
    const rowKey = (r) => `v:${r?.user_name}|${r?.score}|${r?.level}|${r?.hero}|${JSON.stringify(r?.party || null)}|${r?.icon || ''}`;
    const mergeRows = (a, b) => {
      const seen = new Map();
      [...(a || []), ...(b || [])].forEach(r => { const key = rowKey(r); if (!seen.has(key)) seen.set(key, r); });
      return [...seen.values()];
    };
    const restoreLocalRows = async (d) => {
      let rows = [];
      try { const saved = await storeGet(`mh_rank_${d}`, [], false); if (Array.isArray(saved)) rows = saved.slice(); } catch {}
      const savedBest = Number(await storeGet(`mh_hs_${d}`, 0, false)) || 0;
      const best = Math.max(savedBest, Number(highScoresRef.current[d]) || 0);
      if (best > 0) {
        const userName = await storeGet('mh_breeder_name', '名無しのブリーダー', false);
        const xp = Number(await storeGet('mh_breeder_xp', 0, false)) || 0;
        const icon = await storeGet('mh_breeder_icon', null, false);
        const recovered = { userName: userName || '名無しのブリーダー', score: best, level: levelInfo(xp).level, icon, hero: '記録復旧', party: null, recovered: true };
        if (!rows.some(r => Number(r?.score) === best && r?.userName === recovered.userName)) rows.push(recovered);
      }
      return rows.sort((a,b)=>(b.score||0)-(a.score||0));
    };
    // Masterだけは不正行を診断する。難易度の表記揺れは共通SELECTが吸収し、正常な1行まで巻き添えにせず、
    // 必須項目を満たす行だけを残す（他難易度の取得仕様には触れない）。
    const fetchMasterRows = async (order, requestId) => {
      if (rankingDebugEnabled()) console.info('[ranking][Master] 正規化したdifficulty値: Master', 'order:', order);
      const rows = await sbFetchRankings('Master', RANKING_DIAGNOSTIC_LIMIT, order, 0, requestId);
      if (rankingDebugEnabled()) console.info('[ranking][Master] Supabase成功; difficulty: Master', '取得件数:', Array.isArray(rows) ? rows.length : '配列ではない');
      if (!Array.isArray(rows)) throw new Error(`response is not an array: ${JSON.stringify(rows)}`);
      const valid = rows.filter((r, i) => {
        const reasons = [];
        if (!r || typeof r !== 'object') reasons.push('レコードがobjectではない');
        if (typeof r?.user_name !== 'string' || !r.user_name.trim()) reasons.push('user_nameが空または文字列ではない');
        if (!Number.isFinite(Number(r?.score))) reasons.push('scoreが有限数ではない');
        if (r?.party != null && !Array.isArray(r.party)) reasons.push('partyが配列ではない');
        if (reasons.length) console.warn('[ranking][Master] 不正レコードを除外:', i, reasons.join(', '), r);
        return reasons.length === 0;
      }).map(r => ({ ...r, score: Number(r.score) }));
      if (rankingDebugEnabled()) console.info('[ranking][Master] 整形後件数:', valid.length, '除外件数:', rows.length - valid.length);
      return valid;
    };
    // ブリーダーLv・絆Lvは難易度をまたいで名前ごとにまとめるので、難易度で絞る必要がない。
    // 以前は難易度ごとに取得していたため、ブリーダーLvは18回(9難易度×2種の並び)、
    // 絆Lvは9回の通信が走り、1件でも遅い通信があると表示までとても待たされていた。
    // ここを「絞り込み無しの1回」にまとめる。
    if (includeLevels) {
      const statusKey = levelKind === 'bond' ? null : `${levelKind}:all`;
      const generation = statusKey ? beginRankingStatus(statusKey) : null;
      if (levelKind === 'bond') { setBondRankingLoading(true); setBondRankingError(null); }
      const cacheKey = `levels:${levelKind}`;
      const fetchedAt = rankingFetchedAtRef.current.get(cacheKey) || 0;
      // 直前に取得済みなら通信しない(タブを往復するだけで取り直さない)
      if (!force && Date.now() - fetchedAt < 30000) {
        if (statusKey) finishRankingStatus(statusKey, generation, null, true);
        if (levelKind === 'bond') setBondRankingLoading(false);
        return;
      }
      // 進行中の同じ取得があれば相乗りする
      if (!force && rankingRequestsRef.current.has(cacheKey)) return rankingRequestsRef.current.get(cacheKey);
      const requestId = `levels-${levelKind}-${Date.now()}-${++rankingRequestSequenceRef.current}`;
      rankingLatestRequestRef.current.set(cacheKey, requestId);
      const request = (async () => {
        let error = null, rows = [];
        try {
          // ブリーダーLvはレベル上位、絆Lvは編成(party)を見るので新しい記録から取る
          const order = levelKind === 'bond' ? 'id.desc' : 'level.desc.nullslast';
          const columns = levelKind === 'bond' ? RANKING_SELECT_FULL : RANKING_SELECT_NO_PARTY;
          rows = await sbFetchRankings(null, RANKING_LEVEL_FETCH_LIMIT, order, 0, requestId, columns);
        } catch (e) {
          const message = e?.message || String(e);
          console.error('[ranking] level fetch failed:', message);
          error = /timed out|abort/i.test(message) ? '通信が混み合っています。少し待って再読込してください' : '取得に失敗しました';
        }
        // 取得中に新しい要求が始まっていたら、そちらに任せて古い結果は捨てる
        if (rankingLatestRequestRef.current.get(cacheKey) !== requestId) return;
        const entries = mergeRows([], Array.isArray(rows) ? rows : []).map(toEntry);
        if (entries.length) {
          if (levelKind === 'bond') setBondRankingData({ all: entries });
          else setBreederRankingPool({ all: entries });
          rankingFetchedAtRef.current.set(cacheKey, Date.now());
          saveRankingCache(levelKind === 'bond' ? { bond: entries } : { breeder: entries });
        }
        if (statusKey) finishRankingStatus(statusKey, generation, entries.length ? null : error, entries.length > 0);
        if (levelKind === 'bond') { setBondRankingLoading(false); setBondRankingError(entries.length ? null : error); }
      })().finally(() => {
        if (rankingRequestsRef.current.get(cacheKey) === request) rankingRequestsRef.current.delete(cacheKey);
      });
      rankingRequestsRef.current.set(cacheKey, request);
      return request;
    }
    // 起動時は利用者から不調報告のあるNormal/Masterを先に取得する。
    // 全難易度を一斉取得すると記録の多い難易度同士がSupabase側で競合するため、2件ずつに制限する。
    const allDiffs = Object.keys(DIFFICULTY_SETTINGS);
    const diffs = (includeLevels || !normalizedTargetDiff)
      ? ['Normal', 'Master', ...allDiffs.filter(d => d !== 'Normal' && d !== 'Master')]
      : [normalizedTargetDiff];
    if (diffs.length === 0) return;
    const levelStatusKey = includeLevels && levelKind !== 'bond' ? `${levelKind}:all` : null;
    const levelGeneration = levelStatusKey ? beginRankingStatus(levelStatusKey) : null;
    if (includeLevels && levelKind === 'bond') {
      setBondRankingLoading(true);
      setBondRankingError(null);
    }
    const loadOne = async (requestedDiff) => {
      const d = rankingDifficultyKey(requestedDiff);
      // 2種類のLvランキングでキャッシュと進行中Promiseを共有しない。
      const requestKey = `${d}:${includeLevels ? levelKind : 'score'}`;
      const latestKey = includeLevels ? requestKey : d;
      const fetchedAt = rankingFetchedAtRef.current.get(requestKey) || 0;
      if (!force && Date.now() - fetchedAt < 30000) return true;
      let requestId = null;
      if (force) {
        // POST成功（または更新操作）の時点で、それ以前のGETを即座に失効させる。
        // pendingをawaitしてからlatestを更新すると、その待ち時間中に保存前の応答が
        // localRankingsへ入り、Normal画面が古いまま描画される時間が生じる。
        requestId = `${d}-${Date.now()}-${++rankingRequestSequenceRef.current}`;
        rankingLatestRequestRef.current.set(latestKey, requestId);
      }
      // 保存直後の強制再取得は、保存前から走っている同難易度の通信が終わってから新しく開始する。
      // ここで古いPromiseを共有すると、POST済みなのに保存前の結果を再表示してしまう。
      if (rankingRequestsRef.current.has(requestKey)) {
        const pending = rankingRequestsRef.current.get(requestKey);
        if (!force) return pending;
        await pending;
        // 待機中に、より新しい保存後再取得や更新操作が開始された場合は、
        // その1本に取得を任せて重複GETと逆順反映を防ぐ。
        if (rankingLatestRequestRef.current.get(latestKey) !== requestId) return;
      }
      if (!requestId) requestId = `${d}-${Date.now()}-${++rankingRequestSequenceRef.current}`;
      const concurrent = [...rankingRequestsRef.current.keys()];
      rankingLatestRequestRef.current.set(latestKey, requestId);
      const scoreStatusKey = includeLevels ? null : `score:${d}`;
      const scoreGeneration = scoreStatusKey ? beginRankingStatus(scoreStatusKey) : null;
      let scoreStatusSettled = false;
      rankingLog(requestId, 'fetch-start', { selectedDifficulty: d, includeLevels, force, concurrentRequests: concurrent });
      const request = (async () => {
      let succeeded = true;
      let requestError = null;
      try {
        if (d === 'Master' && rankingDebugEnabled()) console.info('[ranking][Master] Master取得開始');
        let rows;
        try {
          // 診断中は21件目以降を一切取得せず、20件と50件の差だけを比較できるようにする。
          // 旧データのscore=NULLが上位枠を埋めて有効な記録を押し出さないよう、明示的にNULLを末尾へ送る。
          const primaryOrder = includeLevels && levelKind === 'bond' ? 'id.desc' : 'score.desc.nullslast';
          rows = mergeRows([], d === 'Master' ? await fetchMasterRows(primaryOrder, requestId) : await sbFetchRankings(d, RANKING_DIAGNOSTIC_LIMIT, primaryOrder, 0, requestId));
        } catch (scoreError) {
          console.error('[ranking] score order fetch failed for', d, scoreError && scoreError.message ? scoreError.message : scoreError);
          // 診断条件を変えないため、代替順の取得も20件に限定する。
          rows = d === 'Master' ? await fetchMasterRows('id.desc', requestId) : await sbFetchRankings(d, RANKING_DIAGNOSTIC_LIMIT, 'id.desc', 0, requestId);
          rows = mergeRows([], rows).sort((a,b)=>(b.score||0)-(a.score||0));
        }
        rankingLog(requestId, 'format-start', { difficulty: d, dataCount: Array.isArray(rows) ? rows.length : null });
        const uniqueScoreRows = mergeRows([], rows).slice(0, RANKING_DIAGNOSTIC_LIMIT);
        byDiff[d] = uniqueScoreRows.map(toEntry);
        let pool = uniqueScoreRows;
        if (includeLevels && levelKind !== 'bond') try {
          const order = 'level.desc.nullslast';
          pool = mergeRows(pool, d === 'Master' ? await fetchMasterRows(order, requestId) : await sbFetchRankings(d, RANKING_DIAGNOSTIC_LIMIT, order, 0, requestId));
        } catch (eLv) {
          console.error('[ranking] level order fetch failed for', d, eLv && eLv.message ? eLv.message : eLv);
        }
        poolByDiff[d] = pool.map(toEntry);
        sourceByDiff[d] = 'global';
        rankingLog(requestId, 'format-end', { difficulty: d, dataCount: byDiff[d].length, source: 'global' });
      } catch (e) {
        console.error('[ranking] supabase fetch failed for', d, e && e.message ? e.message : e);
        const message = e?.message || String(e);
        // 画面にはURLを含む長い技術的な文言を出さない(詳細はコンソールに残す)
        requestError = /timed out|abort/i.test(message) ? '通信が混み合っています。少し待って再読込してください' : '取得に失敗しました';
        if (d === 'Master') console.error('[ranking][Master] フォールバックへ切り替わった理由: score.descとid.descの取得がともに失敗', e);
        try {
          const rows = await restoreLocalRows(d);
          if (rows.length) {
            byDiff[d] = rows.slice(0, RANKING_DIAGNOSTIC_LIMIT);
            poolByDiff[d] = rows.slice();
            sourceByDiff[d] = 'local';
            rankingLog(requestId, 'fallback', { difficulty: d, reason: message, dataCount: rows.length });
          }
        } catch {}
        succeeded = false;
      }
      // 1難易度ずつ反映し、遅い通信が残っていても取得済みのランキングはすぐ表示する。
      if (rankingLatestRequestRef.current.get(latestKey) !== requestId) {
        rankingLog(requestId, 'stale-result-discarded', { difficulty: d, latestRequestId: rankingLatestRequestRef.current.get(latestKey) });
        return;
      }
      rankingLog(requestId, 'render-start', { difficulty: d, source: sourceByDiff[d], dataCount: byDiff[d]?.length || 0 });
      // 反映先はタブごとに完全に分ける。
      // 以前はブリーダーLvの取得結果もスコアランキング(localRankings)へ書き込んでいたため、
      // ブリーダーLvタブを開いただけでスコア一覧が別の取得結果に置き換わり、
      // タブを行き来すると表示が安定しなかった。
      if (includeLevels && levelKind === 'bond') {
        setBondRankingData(prev => ({ ...(prev || {}), ...poolByDiff }));
      } else if (includeLevels && levelKind === 'breeder') {
        setBreederRankingPool(prev => ({ ...prev, ...poolByDiff }));
      } else {
        setRankingSourceByDiff(prev => ({ ...prev, ...sourceByDiff }));
        // 通信に失敗して端末内の復旧値しか無いときは、既に表示できている一覧を置き換えない。
        // (一度出たランキングが、あとから来た失敗の結果で消えてしまうのを防ぐ)
        setLocalRankings(prev => {
          const next = { ...prev };
          Object.keys(byDiff).forEach(key => {
            if (sourceByDiff[key] === 'local' && Array.isArray(prev[key]) && prev[key].length) return;
            next[key] = byDiff[key];
          });
          return next;
        });
        // 次に開いたとき通信を待たずに出せるよう、取得できた内容を端末へ残す
        const cachedScore = {};
        Object.keys(byDiff).forEach(key => { if (sourceByDiff[key] === 'global' && byDiff[key]?.length) cachedScore[key] = byDiff[key]; });
        if (Object.keys(cachedScore).length) saveRankingCache({ score: cachedScore });
      }
      rankingFetchedAtRef.current.set(requestKey, Date.now());
      rankingLog(requestId, 'render-end', { difficulty: d, appliedRequestId: requestId });
      if (scoreStatusKey) {
        finishRankingStatus(scoreStatusKey, scoreGeneration, requestError, Object.prototype.hasOwnProperty.call(byDiff, d));
        scoreStatusSettled = true;
      }
      return succeeded;
      })().finally(() => {
        // 後発リクエストを先発のfinallyでMapから消さない。
        if (rankingRequestsRef.current.get(requestKey) === request) rankingRequestsRef.current.delete(requestKey);
        if (scoreStatusKey && !scoreStatusSettled && rankingLatestRequestRef.current.get(latestKey) === requestId) {
          finishRankingStatus(scoreStatusKey, scoreGeneration, '取得に失敗しました', false);
        }
      });
      rankingRequestsRef.current.set(requestKey, request);
      return request;
    };
    // 取得は同時に開始し、終わった難易度から即座に画面へ反映する。
    // (遅い難易度や失敗した難易度が、取得済みデータの描画を止めない)
    // 順番待ちにすると1件の遅延がそのまま全体の待ち時間になるため、まとめて走らせる。
    const settled = await Promise.allSettled(diffs.map(loadOne));
    const results = settled.map(result => result.status === 'fulfilled' ? result.value : false);
    if (levelStatusKey) {
      const failures = results.filter(result => result === false).length;
      const successes = results.length - failures;
      finishRankingStatus(levelStatusKey, levelGeneration, failures ? '一部の記録を取得できませんでした' : null, successes > 0 || Object.keys(poolByDiff).length > 0);
    }
    if (includeLevels && levelKind === 'bond') {
      const failures = results.filter(result => result === false).length;
      setBondRankingLoading(false);
      setBondRankingError(failures ? (failures === results.length ? '取得に失敗しました' : '一部の記録を取得できませんでした') : null);
    }
  }, []);

  // 寄付・合体・削除で所持しなくなった個体は、保存済みの放牧設定からも自動除外する。
  useEffect(() => {
    if (!pastureLoaded) return;
    const ownedIds = new Set(masuMons.filter(m=>ALL_PLAYER_MONSTERS[m.baseId]).map(m=>String(m.id)));
    const normalized = [...new Set(homePastureIds.map(String))].filter(id=>ownedIds.has(id)).slice(0,5);
    if (JSON.stringify(normalized) !== JSON.stringify(homePastureIds)) {
      setHomePastureIds(normalized);
      setDraftHomePastureIds(prev=>prev.filter(id=>ownedIds.has(String(id))).slice(0,5));
      storeSet('mh_home_pasture_ids', normalized, false);
    }
  }, [masuMons, homePastureIds, pastureLoaded]);
  const homePastureMasumons = homePastureIds.map(id=>masuMons.find(m=>String(m.id)===String(id))).filter(m=>m&&ALL_PLAYER_MONSTERS[m.baseId]);
  const openPastureSettings = () => { setDraftHomePastureIds([...homePastureIds]); setGameState('PASTURE_SETTINGS'); };
  const toggleDraftPasture = (id) => setDraftHomePastureIds(prev => {
    const key=String(id);
    if (prev.includes(key)) return prev.filter(savedId=>savedId!==key);
    return prev.length>=5 ? prev : [...prev,key];
  });
  const savePastureSettings = async () => {
    const ownedIds=new Set(masuMons.filter(m=>ALL_PLAYER_MONSTERS[m.baseId]).map(m=>String(m.id)));
    const next=[...new Set(draftHomePastureIds.map(String))].filter(id=>ownedIds.has(id)).slice(0,5);
    setHomePastureIds(next);
    await storeSet('mh_home_pasture_ids',next,false);
    setGameState('MB_MANAGEMENT');
  };

  // 画面ごとに流すBGM
  const BGM_STATE_MAP = {
    SETTINGS: 'home',           // 設定ページはHOMEの曲を続ける
    GIFT_BOX: 'home',           // ギフトボックスはHOMEの曲を止めずに続ける
    MISSIONS: 'home',           // ミッション画面でもHOMEの曲を続ける
    BATTLE_MENU: 'enhance',      // 難易度・ランキング(モンスター選択と同じ曲)
    MONSTER_LIST_MENU: 'management', // モンスター一覧メニュー
    MB_MANAGEMENT: 'management', // M/B管理はモンスター一覧・編成と同じ曲を続ける
    PASTURE_SETTINGS: 'management', // 放牧設定もM/B管理の曲を続ける
    TEMPLE: 'temple',           // 神殿は合体と同じ曲を続ける
    MASU_FUSION: 'temple',      // 合体ページ
    MASU_DONATION: 'temple',    // 寄付ページも神殿の曲を続ける
    MASU_REBIRTH: 'temple',     // 転生ページも神殿の曲を継続する
    BREEDER_MARKET: 'market',   // マーケットページ
    TRAINING_SELECT: 'trainingMenu', TRAINING_DIFFICULTY: 'trainingMenu', TRAINING_CONFIRM: 'trainingMenu', TRAINING_RESULT: 'trainingMenu',
    TRAINING_BOARD: 'trainingBoard',
  };
  // プロフィール本体とアイテムはHOMEの曲を続ける。その他の詳細ページ群は従来のプロフィール曲を維持する。
  const PROFILE_BGM_STATES = ['ROSTER','OWNED_MONSTERS','MASU_MONS','MASU_ENHANCE'];
  // 1回のプレイの中で流れる画面。「まだ1度も戦っていない準備中」か「WAVEを終えたあと」かで曲を分ける。
  //  ・準備中(最初の勇者モン選択〜最初のバトルの直前) … 強化フェーズの曲
  //  ・WAVEを終えたあと(リザルト〜次のバトルの直前)   … リザルトの曲をそのまま続ける
  // 敵撃破のファンファーレのあと、リザルトの曲が強化フェーズまで途切れず流れるようにするための切り分け
  const RUN_PHASE_STATES = ['PICK_HERO','PICK_ALLY','PICK_SLOT','PICK_TEACHING','REWARD_PICK','UPGRADE_SKILL','WAVE_RESULT','CHAMPION'];
  // 画面から鳴らすべき曲のキーを決める
  const bgmKeyForState = (state, currentWave, enemyId, wavesDone, isGameOver) => {
    if (isGameOver) return 'gameOver';
    if (!debugBattleRef.current && currentWave === 10 && (state === 'WAVE_RESULT' || state === 'CHAMPION')) return bgmArrangement.clear;
    if (state === 'HOME' || state === 'PROFILE' || state === 'ITEM_INVENTORY') return bgmArrangement.home;
    if (BGM_STATE_MAP[state]) return bgmArrangement[BGM_STATE_MAP[state]] || BGM_STATE_MAP[state];
    if (PROFILE_BGM_STATES.includes(state)) return bgmArrangement.management;
    // デバッグ戦は選択した敵を直接生成するため、WAVE番号だけに頼らず敵IDでもムーを判定する。
    // デュラハン専用曲はアレンジ設定より優先する既存仕様を維持する。
    if (state === 'BATTLE') return enemyId === 'Durahan' ? 'dullahan' : (enemyId === 'Moo' || currentWave === 10 ? bgmArrangement.boss : bgmArrangement.battle);
    if (RUN_PHASE_STATES.includes(state)) return wavesDone ? 'result' : 'enhance';
    return null;
  };
  // BGM: 画面遷移に応じて自動切替(曲はaudio/のmp3。画面に応じて必要な曲だけ読み込む)
  useEffect(() => {
    const key = bootPhase === 'GAME' ? bgmKeyForState(gameState, wave, enemy?.id, (waveHistory||[]).length > 0, hp <= 0 || gaveUp) : (bootPhase === 'TITLE' || bootPhase === 'ENTERING_GAME' ? 'title' : null);
    // 音がオフでも、その画面で使う曲は先に読み込んでおく(タップした瞬間に鳴り始めるように)
    if (key) Audio_.preloadBGM(key);
    if (!audioOn) { Audio_.stopBGM(); return; }
    if (key) Audio_.playBGM(key);
    else Audio_.stopBGM();
  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement]);

  // SE/BGMそれぞれの音量をAudioエンジンへ反映
  useEffect(() => { Audio_.setSeVolume(seVolume); }, [seVolume]);
  useEffect(() => { Audio_.setBgmVolume(bgmVolume); }, [bgmVolume]);

  // 新バージョン検知: ホーム画面アプリ/背面タブ復帰時は自動再読み込みされず古いバージョンの
  // ままタップしても反応しないように見える不具合が繰り返し報告されたため、version.jsonを
  // 頻繁に確認しBUILD_DATEと異なれば更新ボタンを出す。初回確認でも自動再読み込みはせず、
  // プレイ中の進行を失わないよう必ず利用者のタップで更新する。
  useEffect(() => {
    let cancelled = false;
    const checkVersion = async () => {
      try {
        const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && data.build && data.build !== BUILD_DATE) { setLatestBuild(data.build); setUpdateAvailable(true); }
      } catch {}
    };
    checkVersion();
    const onVisible = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    const interval = setInterval(checkVersion, 30 * 1000);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pageshow', onVisible); clearInterval(interval); };
  }, []);

  const reloadLatestVersion = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mh_refresh', Date.now().toString());
    window.location.replace(url.toString());
  };

  // 正式タイトルに必要なものだけを直列に確認する。重いゲーム素材はENTRY_READY後の
  // idleキューへ分離し、タイトル操作と音声開始を妨げない。
  useEffect(() => {
    if (bootPhase !== 'LOADING' || !dataLoaded) return;
    let cancelled = false;
    let retryTimer = null;
    const required = async () => {
      const step = (done, label) => { if (!cancelled) setBootProgress({ done, total: 10, label }); };
      step(0, 'ゲームシステムを起動中');
      await new Promise((resolve, reject) => {
        const image = new Image(); let settled = false;
        const finish = () => { if (!settled) { settled = true; resolve(); } };
        image.onload = async () => { try { if (image.decode) await image.decode(); finish(); } catch (error) { if (!settled) { settled = true; reject(error); } } };
        image.onerror = () => { if (!settled) { settled = true; reject(new Error('title image unavailable')); } }; image.src = 'data/images/title-screen-clean.PNG';
        if (image.complete) image.onload();
      });
      step(1, 'タイトルBGMを準備中');
      if (!await Audio_.prepareBGM('title', 5000).catch(() => false)) throw new Error('title BGM unavailable');
      await Audio_.prepareSE(5000).catch(() => false);
      step(2, 'セーブデータを確認中');
      await Promise.resolve();
      step(3, '音量設定を確認中');
      await Promise.resolve({ bgmVolume, seVolume, audioOn });
      step(4, 'PLAYER IDを確認中');
      await Promise.resolve(titlePlayerId);
      step(5, 'ビルドバージョンを確認中');
      await Promise.resolve(BUILD_DATE);
      step(6, '更新情報を確認中');
      await Promise.resolve(typeof CHANGELOG !== 'undefined' ? CHANGELOG : []);
      step(7, 'お知らせを準備中');
      await Promise.resolve(changelogUnread);
      step(8, 'タイトル画面を準備中');
      await new Promise(r => requestAnimationFrame(() => r()));
      step(9, 'モンスターデータを展開中');
      await Promise.resolve(ALL_PLAYER_MONSTERS.Mocchi);
      step(10, '準備完了');
      if (!cancelled) setBootPhase('ENTRY_READY');
    };
    const runRequired = () => required().catch(() => {
      if (cancelled) return;
      setBootProgress(prev => ({...prev, label:'通信を確認して再試行しています'}));
      retryTimer = setTimeout(runRequired, 1500);
    });
    runRequired();
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [bootPhase, dataLoaded, bgmVolume, seVolume, audioOn, titlePlayerId, changelogUnread]);

  // 色マスクなど後続画面用の素材は、ブラウザが空いた時に1件ずつ処理する。
  useEffect(() => {
    if (bootPhase === 'LOADING') return;
    let cancelled = false;
    const jobs = [];
    const seen = new Set();
    masuMons.forEach((m) => {
      if (!getMasuColors(m).some(Boolean)) return;
      const base = ALL_PLAYER_MONSTERS[m.baseId];
      [base?.imgUrl, base?.iconUrl].forEach(url => {
        const key = `${m.baseId}::${url}`;
        if (url && !seen.has(key)) { seen.add(key); jobs.push(() => getDyeRegionMasks(m.baseId, url)); }
      });
    });
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(() => cb({timeRemaining:()=>8}), 24));
    const run = () => schedule(async () => { if (cancelled || !jobs.length) return; try { await jobs.shift()(); } catch {} run(); }, {timeout:250});
    run();
    return () => { cancelled = true; };
  }, [bootPhase, masuMons]);

  const unlockBootSound = async () => {
    if (entryAnimatingRef.current || bootPhase !== 'ENTRY_READY') return;
    entryAnimatingRef.current = true;
    setEntryAnimating(true);
    // iOSのuser activationが有効な同じイベント処理内で、解除とBGM開始を両方開始する。
    // 保存済みミュート中は有効化しない。オンの場合だけ、最初のawaitより前に有効化・resume・SE・BGMを開始する。
    let unlockAttempt;
    let bgmAttempt;
    if (!audioMuted) Audio_.setEnabled(true);
    try { unlockAttempt = audioMuted ? Promise.resolve(false) : Promise.resolve(Audio_.unlock(true)).catch(() => false); } catch { unlockAttempt = Promise.resolve(false); }
    try { bgmAttempt = audioMuted ? Promise.resolve(false) : Promise.resolve(Audio_.playBGM('title')).catch(() => false); } catch { bgmAttempt = Promise.resolve(false); }
    // ここでは完了を待たないが、拒否は上で処理し、同じタップ中に開始した試行を維持する。
    void bgmAttempt;
    try {
      const [audioResult] = await Promise.all([
        Promise.race([
          unlockAttempt.then(value => ({ settled:true, value })),
          new Promise(r => setTimeout(() => r({ settled:false, value:false }), 1000)),
        ]),
        new Promise(r => setTimeout(r, 760)),
      ]);
      // unlock()がvoidを返す実装でも、実際のAudioContext状態から成功を判定する。
      if (audioResult.settled && (audioResult.value === true || Audio_.isContextRunning())) {
        bootSoundUnlockedRef.current = true;
        setBootSoundUnlocked(true);
      }
    } catch {}
    // 音声の成否とは分離し、1回の操作から最大1秒で必ずタイトルへ進める。
    setBootPhase('TITLE');
  };

  useEffect(() => {
    if (bootPhase !== 'TITLE') return;
    const retryTimers = [0, 300, 1000].map(delay => setTimeout(() => {
      try { Audio_.ensurePlaying('title'); } catch {}
    }, delay));
    return () => retryTimers.forEach(clearTimeout);
  }, [bootPhase]);

  const prepareGameEntry = async () => {
    try {
      const image = new Image(); image.src = MOO_FULL;
      if (image.decode) await Promise.race([image.decode().catch(()=>{}), new Promise(r=>setTimeout(r,1800))]);
    } catch {}
  };

  const startGame = async () => {
    if (titleStartingRef.current || bootPhase !== 'TITLE' || showChangelog || showTitleSettings || showAudioSettings || showBackup) return;
    titleStartingRef.current = true;
    setTitleStarting(true);
    setGameState(onboarded ? 'HOME' : 'ONBOARDING');
    setShowChangelog(false); setShowTitleSettings(false); setShowAudioSettings(false); setShowBackup(false);
    setBootPhase('ENTERING_GAME');
    const slow = setTimeout(() => setEnteringSlow(true), 1200);
    try {
      await Promise.all([
        Promise.race([Promise.resolve().then(prepareGameEntry).catch(()=>{}), new Promise(r => setTimeout(r, 1900))]),
        new Promise(r => setTimeout(r, 850)),
      ]);
    } catch {}
    clearTimeout(slow); setEnteringSlow(false); setBootPhase('GAME');
  };


  // タブ切り替え/バックグラウンド化から復帰した際、OSにより自動停止されたAudioContextと
  // BGMのTransportを復帰させる(そのままだとBGM/SEが鳴らなくなったままになる不具合の対策)。
  // visibilitychangeだけだと、PWAをホーム画面から開き直した場合やアプリ切り替えで
  // 戻った場合に発火しないことがあるため、pageshow/focusでも復帰を試みる
  useEffect(() => {
    // 画面が見えなくなったらBGMを止める(他のアプリに切り替えたあとも鳴り続けないように)。
    // 戻ってきたら、止まっているAudioContextを復帰させて鳴らし直す
    const onHidden = () => Audio_.setPageHidden(true);
    const onVisible = () => { Audio_.setPageHidden(false); Audio_.resumeIfNeeded(); };
    const onVisibilityChange = () => (document.visibilityState === 'hidden' ? onHidden() : onVisible());
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pagehide', onHidden);
    window.addEventListener('blur', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pagehide', onHidden);
      window.removeEventListener('blur', onHidden);
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

  // 起動画面(TAP TO START)のタップが、その下のトップ画面まで届いてしまうのを防ぐ。
  //
  // 起動画面は「指を触れた瞬間(pointerdown)」に閉じる。音を鳴らす許可はこの操作でしか
  // 得られないので、ここで閉じるのは変えられない。ところが指を離すころには起動画面は
  // 既に消えているため、clickは「指の位置にあるトップ画面の要素」に対して発生する。
  // そこにボタンがあると、そのボタンのタップ音が鳴ったり、難易度が切り替わったりしていた
  // (「押した直後に一瞬違う音が鳴る」「押す位置によって挙動が変わる」の原因)。
  // 起動タップに続く1回のclickだけを捨てることで、指の位置に左右されないようにする。
  //
  // ※この効果は下の共通タップSEより先に登録する必要がある(先に登録した方が先に呼ばれ、
  //   stopImmediatePropagation で後続の登録を止められる)
  const bootTapPending = useRef(false);
  useEffect(() => {
    const swallow = (e) => {
      if (!bootTapPending.current) return;
      bootTapPending.current = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    // 起動タップのclickが来ないまま次の操作が始まったら、そこで捨てる予定は取り消す
    // (そうしないと、次に押したボタンが効かなくなってしまう)
    const cancel = () => { bootTapPending.current = false; };
    // 指を離してもclickが来ないブラウザもあるので、離した少しあとに取り消す。
    // 長押ししてから離した場合でも、離した直後のclickだけは確実に捨てられる
    const armExpire = () => {
      if (!bootTapPending.current) return;
      setTimeout(() => { bootTapPending.current = false; }, 400);
    };
    document.addEventListener('click', swallow, true);
    document.addEventListener('pointerdown', cancel, true);
    document.addEventListener('pointerup', armExpire, true);
    return () => {
      document.removeEventListener('click', swallow, true);
      document.removeEventListener('pointerdown', cancel, true);
      document.removeEventListener('pointerup', armExpire, true);
    };
  }, []);

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
      const savedSeVolume = await storeGet('mh_se_volume', DEFAULT_VOLUME, false);
      setSeVolumeState(savedSeVolume);
      const savedBgmVolume = await storeGet('mh_bgm_volume', DEFAULT_VOLUME, false);
      setBgmVolumeState(savedBgmVolume);
      const savedAudioMuted = !!await storeGet('mh_audio_muted', false, false);
      setQuickMuted(savedAudioMuted);
      if (savedAudioMuted) Audio_.setEnabled(false);
      const savedBgmArrangement = normalizeBgmArrangement(await storeGet('mh_bgm_arrangement', DEFAULT_BGM_ARRANGEMENT, false));
      setBgmArrangement(savedBgmArrangement);
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
      // Lv30上限導入時の一度限りの補償。計算結果をpendingへ先に保存してから、マスモンと
      // ダイヤを保存し、最後に完了フラグを立てる。途中終了してもpendingから同じ結果を再開し、
      // マスモンだけLv30になって補償ダイヤが失われる事故を防ぐ。
      const levelCapMigrated = await storeGet('mh_masu_level_cap_migrated_v1', false, false);
      if (!levelCapMigrated) {
        let migratedCap = await storeGet('mh_masu_level_cap_migration_pending_v1', null, false);
        if (!migratedCap || !Array.isArray(migratedCap.nextMasuMons)) {
          migratedCap = migrateMasuLevelCaps(savedMasuMons, savedGold);
          await storeSet('mh_masu_level_cap_migration_pending_v1', migratedCap, false);
        }
        savedMasuMons = migratedCap.nextMasuMons;
        await storeSet('mh_masu_mons', savedMasuMons, false);
        await storeSet('mh_gold', migratedCap.nextGold, false);
        if (migratedCap.compensation > 0) await storeSet('mh_masu_level_cap_compensation_notice_v1', { diamonds:migratedCap.compensation }, false);
        await storeSet('mh_masu_level_cap_migrated_v1', true, false);
        await storeSet('mh_masu_level_cap_migration_pending_v1', null, false);
        setGold(migratedCap.nextGold);
      } else {
        const normalized = savedMasuMons.map(normalizeMasuProgression);
        if (normalized.some((m,i)=>JSON.stringify(m)!==JSON.stringify(savedMasuMons[i]))) {
          savedMasuMons = normalized;
          await storeSet('mh_masu_mons', savedMasuMons, false);
        }
      }
      // 旧転生仕様で育成値や未使用ポイントを持ち越した個体を、一度だけ正しいLv1状態へ補正する。
      const rebirthFullResetMigrated = await storeGet('mh_masu_rebirth_full_reset_migrated_v1', false, false);
      if (!rebirthFullResetMigrated) {
        savedMasuMons = migrateRebornMasuToFullReset(savedMasuMons);
        await storeSet('mh_masu_mons', savedMasuMons, false);
        await storeSet('mh_masu_rebirth_full_reset_migrated_v1', true, false);
      }
      // 表示名ではなく固有技系統IDで既存の重複継承を整理する。最高Lvだけを残す正規化は
      // 冪等だが、過去の移行済みフラグに阻まれないよう今回専用のバージョンを持つ。
      const uniqueLineageMigrated = await storeGet('mh_unique_lineage_dedupe_migrated_v1', false, false);
      const normalizedUniqueLineages = normalizeInheritedUniqueLineages(savedMasuMons);
      if (!uniqueLineageMigrated || JSON.stringify(normalizedUniqueLineages) !== JSON.stringify(savedMasuMons)) {
        savedMasuMons = normalizedUniqueLineages;
        await storeSet('mh_masu_mons', savedMasuMons, false);
        await storeSet('mh_unique_lineage_dedupe_migrated_v1', true, false);
      }
      const compensationNotice = await storeGet('mh_masu_level_cap_compensation_notice_v1', null, false);
      const compensationNoticeSeen = await storeGet('mh_masu_level_cap_compensation_notice_seen_v1', false, false);
      if (compensationNotice?.diamonds > 0 && !compensationNoticeSeen) setLevelCapCompensation(compensationNotice);
      // 絆レベルに対して強化ポイントが不足しているマスモンがあれば、ここで不足分を補填する
      // (必要経験値を緩和した際、レベルだけ上がってポイントが配られないまま残っていた分の救済)
      const reconciledMasuMons = savedMasuMons.map(reconcileMasuPoints);
      if (reconciledMasuMons.some((m, i) => m !== savedMasuMons[i])) {
        savedMasuMons = reconciledMasuMons;
        await storeSet('mh_masu_mons', savedMasuMons, false);
      }
      setMasuMons(savedMasuMons);
      // 放牧設定導入前のセーブは、従来どおり所持マスモン1体を初期表示にして互換性を保つ。
      // 保存済みIDは重複・削除済み個体・表示不能な個体を取り除き、最大5体に制限する。
      const savedPastureIds = await storeGet('mh_home_pasture_ids', null, false);
      const normalizedPastureIds = normalizeHomePastureIds(savedPastureIds, savedMasuMons, new Set(Object.keys(ALL_PLAYER_MONSTERS)));
      setHomePastureIds(normalizedPastureIds);
      setDraftHomePastureIds(normalizedPastureIds);
      setPastureLoaded(true);
      if (JSON.stringify(savedPastureIds) !== JSON.stringify(normalizedPastureIds)) await storeSet('mh_home_pasture_ids', normalizedPastureIds, false);
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
      // 旧日時キーは一度だけID一覧へ移行する。旧日時以前の項目は既読のまま維持する。
      const legacyChangelogSeen = await storeGet('mh_changelog_seen', '', false);
      const migratedSeen = {};
      for (const type of CHANGELOG_TYPES) {
        const savedIds = await storeGet(`mh_changelog_seen_ids_${type}`, null, false);
        const legacyDate = await storeGet(`mh_changelog_seen_${type}`, legacyChangelogSeen, false);
        migratedSeen[type] = Array.isArray(savedIds) ? savedIds.filter(id=>CHANGELOG_IDS_BY_TYPE[type].includes(id)) : CHANGELOG_ENTRIES.filter(entry=>entry.type===type && legacyDate && entry.date<=legacyDate).map(entry=>entry.id);
        if (!Array.isArray(savedIds)) await storeSet(`mh_changelog_seen_ids_${type}`, migratedSeen[type], false);
      }
      setChangelogSeen(migratedSeen);
      const listSettings = normalizeMonsterListSettings(await storeGet('mh_monster_list_settings', DEFAULT_MONSTER_LIST_SETTINGS, false));
      setMonsterSortKey(listSettings.sortKey); setMonsterSortDir(listSettings.sortDir); setMonsterDisplayFlags(listSettings.display); setSortFilterModalTab(listSettings.modalTab);
      const fusionSettings = normalizeFusionSortSettings(await storeGet('mh_fusion_sort_settings', DEFAULT_FUSION_SORT_SETTINGS, false));
      setFusionSortKey(fusionSettings.sortKey); setFusionSortDir(fusionSettings.sortDir);
      const donationSettings = normalizeDonationSortSettings(await storeGet('mh_donation_sort_settings', DEFAULT_DONATION_SORT_SETTINGS, false));
      setDonationSortKey(donationSettings.sortKey); setDonationSortDir(donationSettings.sortDir);
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
      const savedGifts = await storeGet('mh_gifts', [], false);
      const savedLoginBonus = await storeGet('mh_login_bonus', LOGIN_BONUS_DEFAULT, false);
      const loginGrant = grantLoginBonus(savedLoginBonus, savedGifts);
      setGifts(loginGrant.gifts);
      await storeSet('mh_login_bonus', loginGrant.loginBonus, false);
      if (loginGrant.granted) {
        await storeSet('mh_gifts', loginGrant.gifts, false);
        setLoginBonusPopup({ day:loginGrant.day, rewards:loginGrant.gift.rewards });
      }
      const missionState = normalizeMissions(await storeGet('mh_missions', null, false));
      const loginDay = missionDailyPeriod();
      missionState.daily.login = 1;
      if (!missionState.weeklyLoginDays.includes(loginDay)) missionState.weeklyLoginDays.push(loginDay);
      await storeSet('mh_missions', missionState, false);
      setMissions(missionState);
      const savedUnlockedMonsters = await storeGet('mh_unlocked_monsters', STARTER_MONSTER_IDS, false);
      setUnlockedMonsterIds(savedUnlockedMonsters);
      const savedMonsterRoster = await storeGet('mh_monster_roster', savedUnlockedMonsters, false);
      setMonsterRosterIds(savedMonsterRoster);
      const savedUnlockedTeachings = await storeGet('mh_unlocked_teachings', STARTER_TEACHING_IDS, false);
      setUnlockedTeachingIds(savedUnlockedTeachings);
      const savedTeachingRoster = await storeGet('mh_teaching_roster', savedUnlockedTeachings, false);
      setTeachingRosterIds(savedTeachingRoster);
      const scores = {}; const attempts = {}; const clears = {}; const reachedWaves = {};
      await Promise.all(Object.keys(DIFFICULTY_SETTINGS).map(async d => {
        scores[d] = await storeGet(`mh_hs_${d}`, 0, false);
        attempts[d] = await storeGet(`mh_attempts_${d}`, 0, false);
        clears[d] = await storeGet(`mh_clears_${d}`, 0, false);
        reachedWaves[d] = await storeGet(`mh_highest_wave_${d}`, 0, false);
      }));
      setHighScores(scores);
      highScoresRef.current = scores;
      setAttemptCounts(attempts);
      setClearCounts(clears);
      setHighestWaves(reachedWaves);
      let wasOnboarded = await storeGet('mh_onboarded', null, false);
      const hasSavedName = typeof savedName==='string' && savedName.trim() && savedName!=='名無しのブリーダー';
      const hasSavedIcon = typeof savedIcon==='string' && savedIcon.length>0;
      if (wasOnboarded === null) {
        // 完成済みプロフィールは新フラグが無くても既存ユーザーとして扱う。
        wasOnboarded = !!(hasSavedName && hasSavedIcon);
        await storeSet('mh_onboarded', wasOnboarded, false);
      }
      if (wasOnboarded && !(hasSavedName && hasSavedIcon)) wasOnboarded = false;
      setOnboarded(wasOnboarded);
      if (!wasOnboarded) {
        const savedStep = await storeGet('mh_onboarding_step', null, false);
        const nextStep = hasSavedName ? (hasSavedIcon ? 'confirm' : 'icon') : (savedStep || 'intro-0');
        setOnboardingName(hasSavedName ? savedName.trim().slice(0,10) : '');
        setOnboardingIcon(hasSavedIcon ? savedIcon : null);
        setOnboardingStep(nextStep);
        setGameState('ONBOARDING');
      }
      setDataLoaded(true); // ここまでで起動に必要なセーブデータは揃っている
      // タイトル表示を待たせず、選んでいる難易度のスコアランキングだけを裏で取得する。
      // 以前は全難易度(9件)をまとめて取りに行っていたため、起動直後の通信が混み合い、
      // どのランキングも表示までとても待たされていた。他の難易度は開いたときに取る。
      // 画面を先読み中に開いてもloadRankings内で同じ通信を共有するため、二重取得にならない。
      // まず前回の内容をそのまま画面へ入れておく。これで開いた瞬間から一覧が出る
      try { hydrateRankingCache(await storeGet(RANKING_CACHE_KEY, null, false)); } catch {}
      // そのうえで最新を裏で取り直す。スコア→ブリーダーLv→絆Lvの順に少しずつ始めて、
      // 起動直後の通信が一度に混み合わないようにする
      const preload = (label, run) => run().catch(e => console.error(`[ranking] background preload failed (${label}):`, e && e.message ? e.message : e));
      setTimeout(() => preload('score', () => loadRankings('Normal')), 0);
      setTimeout(() => preload('breeder', () => loadRankings(null, true, false, 'breeder')), 1200);
      setTimeout(() => preload('bond', () => loadRankings(null, true, false, 'bond')), 2400);
    })();
  }, [loadRankings]);

  // 起動時の復元が終わってからだけ保存し、初期値で既存設定を上書きしない。
  useEffect(() => {
    if (!dataLoaded) return;
    storeSet('mh_monster_list_settings', { version: 1, modalTab: sortFilterModalTab, sortKey: monsterSortKey, sortDir: monsterSortDir, display: monsterDisplayFlags }, false);
  }, [dataLoaded, sortFilterModalTab, monsterSortKey, monsterSortDir, monsterDisplayFlags]);
  useEffect(() => {
    if (!dataLoaded) return;
    storeSet('mh_fusion_sort_settings', { version: 1, sortKey: fusionSortKey, sortDir: fusionSortDir }, false);
  }, [dataLoaded, fusionSortKey, fusionSortDir]);
  useEffect(() => {
    if (!dataLoaded) return;
    storeSet('mh_donation_sort_settings', { version: 1, sortKey: donationSortKey, sortDir: donationSortDir }, false);
  }, [dataLoaded, donationSortKey, donationSortDir]);
  useEffect(() => {
    if (!dataLoaded) return;
    storeSet('mh_bgm_arrangement', normalizeBgmArrangement(bgmArrangement), false);
  }, [dataLoaded, bgmArrangement]);

  const submitLocalScore = async (diff, finalScore, clearId) => {
    // マスモン(絆レベルを持つ育成済みインスタンス)で編成していた場合、ランキング表示にも絆レベルを出せるよう記録する。
    // 表示名はマスモンの個体名(ブリーダーが自由につけた名前)ではなく、血統(種族)の名前を使う
    let heroSlotIndex = slots.findIndex(s=>s===mainHero);
    if (heroSlotIndex<0 && mainHero?.masuId!=null) heroSlotIndex=slots.findIndex(s=>s?.masuId!=null&&String(s.masuId)===String(mainHero.masuId));
    if (heroSlotIndex<0) heroSlotIndex=slots.findIndex(s=>s?.id===mainHero?.id);
    // 【重要】記録に画像(imgUrl)を入れない。
    // モンスターの絵は1枚で約120KBのbase64で、以前はこれを編成の人数分そのまま保存し、
    // ランキングを開くたびに全員ぶん再ダウンロードしていた(20件×最大4体で数MB)。
    // これが「読み込みが終わらない」「取得が8秒で打ち切られる」直接の原因だった。
    // 絵はアプリに同梱しているので、記録にはIDだけ残して表示時にIDから引く。
    const party = slots.map((s,index) => s ? { role:index===heroSlotIndex?'hero':'ally', id:s.id, baseId:s.id, monsterId:s.id, masuId:s.masuId||null, name: ALL_PLAYER_MONSTERS[s.id]?.name || s.name, emoji:s.emoji||ALL_PLAYER_MONSTERS[s.id]?.emoji||null, bondLevel:s.masuId?getMasuBondLevel(s.masuId).level:null } : null);
    const name = breederName || '名無しのブリーダー';
    const heroName = (mainHero && (ALL_PLAYER_MONSTERS[mainHero.id]?.name || mainHero.name)) || 'Unknown';
    const level = breederLevel.level;
    const icon = breederIcon;
    const row = { difficulty: diff, user_name: name, hero: heroName, party, score: finalScore, level, icon, clear_id: clearId };
    const result = await persistRankingScore({
      row,
      saveLocal: async (error) => {
        console.error('[ranking] supabase submit failed, falling back to local:', error && error.message ? error.message : error);
        const entry = { userName: name, hero: heroName, party, score: finalScore, diff, level, icon, clearId, at: Date.now(), nationalSaved: false, nationalError: { message: error?.message || String(error), status: error?.status || null, code: error?.code || null, body: error?.body || null } };
        const rows = await storeGet(`mh_rank_${diff}`, [], false);
        const list = Array.isArray(rows) ? rows.slice() : [];
        // サーバー側と同じく、1プレイごとに1件として積む
        if (!list.some(r => r?.clearId === clearId)) list.push(entry);
        const kept = list.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,50);
        // スコア上位50件に加えて、名前ごとの最新1件は必ず残しておく。
        // ブリーダーLv・絆Lvのランキングはこの記録から集計するので、
        // 直近のプレイがスコア上位に入らなくてもレベルだけは最新にできる
        const latestByName = new Map();
        list.forEach(r => {
          const cur = latestByName.get(r.userName);
          if (!cur || (r.at || 0) >= (cur.at || 0)) latestByName.set(r.userName, r);
        });
        latestByName.forEach(r => { if (!kept.includes(r)) kept.push(r); });
        await storeSet(`mh_rank_${diff}`, kept, false);
      }
    });
    if (!result.nationalSaved) return result;
    // POSTが確定した難易度だけを強制再取得する。保存前の先読みが残っている場合は
    // loadRankings側で完了を待ち、その後の新しい結果だけを画面へ反映する。
    // 再取得失敗をPOST失敗と誤判定してローカルへ二重保存しない。
    try {
      await loadRankings(normalizeRankingDifficulty(diff), false, true);
    } catch (e) {
      console.error('[ranking] post-submit refresh failed:', e && e.message ? e.message : e);
    }
    return result;
  };

  // 敗北・降参・優勝のどの経路から呼ばれても、同じ周回のスコア送信は1回だけにする。
  // 保存後は対象難易度だけを強制再取得する。全難易度・レベル順まで取得せず、
  // Normal/Hard/Masterを同じ経路で保存・反映する。
  const submitRunScoreOnce = async () => {
    if (score <= 0 || scoreSubmittedRef.current) return;
    scoreSubmittedRef.current = true;
    try {
      const result = await submitLocalScore(difficulty, score, runIdRef.current);
      if (!result?.nationalSaved) {
        console.error('[result] national score save failed:', result?.error?.message || 'unknown ranking error');
        return result;
      }
      if (score > (highScores[difficulty] || 0)) {
        await storeSet(`mh_hs_${difficulty}`, score, false);
        setHighScores(prev => ({ ...prev, [difficulty]: score }));
      }
      return result;
    } catch (e) {
      console.error('[result] score submit failed:', e && e.message ? e.message : e);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    const n = tempName.trim().substring(0, 10);
    setBreederName(n);
    await storeSet('mh_breeder_name', n, false);
    setShowNameEdit(false);
  };
  const moveOnboarding = async step => { setOnboardingStep(step); await storeSet('mh_onboarding_step',step,false); };
  const finishOnboarding = async () => {
    const name=onboardingName.trim().slice(0,10);
    if(!name||!onboardingIcon)return;
    // プロフィールの両方を保存し終えた後でのみ完了フラグを立てる。
    await storeSet('mh_breeder_name',name,false);
    await storeSet('mh_breeder_icon',onboardingIcon,false);
    setBreederName(name);setBreederIcon(onboardingIcon);
    await storeSet('mh_onboarded',true,false);
    await storeSet('mh_onboarding_step',null,false);
    setOnboarded(true);setGameState('HOME');
  };

  useEffect(()=>{
    if(gameState!=='BATTLE_MENU'||battleMenuTab!=='difficulty')return;
    const id=requestAnimationFrame(()=>{const index=Object.keys(DIFFICULTY_SETTINGS).indexOf(difficulty);difficultyCarouselRef.current?.children[index]?.scrollIntoView({inline:'center',block:'nearest'});});
    return()=>cancelAnimationFrame(id);
  },[gameState,battleMenuTab]);

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
      unique: uniqueSkillAtLevel(base.unique, masu.uniqueSkillLevels?.own),
      inheritedUniques: (masu.inheritedUniques || []).map((unique,index)=>uniqueSkillAtLevel(unique, Math.max(Number(unique.evoLevel)||0, Number(masu.uniqueSkillLevels?.[`inh:${index}`])||0))),
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
    { key: 'reborn', label: '転生済み' },
  ];
  const MONSTER_DISPLAY_OPTIONS = [
    { key: 'base', label: 'ベースモン' },
    { key: 'masu', label: 'マスモン' },
    { key: 'fused', label: '合体済み' },
    { key: 'active', label: '編成中' },
    { key: 'reborn', label: '転生済み' },
  ];
  // 「ベースモン(未マスモン化の種)」「マスモン(育成済み個体)」を1つの配列に統一して扱うための変換。
  // activeIdsには現在編成に入っている種id/'masu:'付きidの配列を渡す(画面によって draftMonsterRoster か
  // 確定済みの monsterRosterIds かが変わる)
  const buildUnifiedMonsterEntries = (baseIds, masuList, activeIds) => {
    const baseEntries = baseIds.map(id => {
      const base = ALL_PLAYER_MONSTERS[id];
      if (!base) return null;
      return { type: 'base', key: id, entryId: id, baseId: id, base, masu: null, name: base.name, lineageName: base.name, bondLevel: null, active: activeIds.includes(id), fusionCount: 0, rebirthCount: 0 };
    }).filter(Boolean);
    const masuEntries = masuList.map(masu => {
      const base = ALL_PLAYER_MONSTERS[masu.baseId];
      if (!base) return null;
      const entryId = 'masu:' + masu.id;
      return { type: 'masu', key: entryId, entryId, baseId: masu.baseId, base, masu, name: masu.name, lineageName: base.name, bondLevel: masuBondLevelInfo(masu).level, active: activeIds.includes(entryId), fusionCount: (masu.fusionHistory||[]).length, rebirthCount: donationDiamondValue(masu.rebirthCount) };
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
      else if (monsterSortKey === 'reborn') cmp = (a.rebirthCount || 0) - (b.rebirthCount || 0);
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
  // ignoreTypeFlags: ベースモン一覧・マスモン一覧のように種別が画面で固定されている場合に使う。
  // これらの画面はモーダルに「ベースモン」「マスモン」の選択肢を出していないため、種別のチェックまで
  // 見てしまうと、編成画面でそのチェックを外していた場合に一覧が空のまま元に戻せなくなる。
  const monsterEntryMatchesDisplayFlags = (e, flags, { ignoreTypeFlags = false } = {}) => {
    const reborn = (e.rebirthCount || 0) > 0;
    const categoryMatch = ignoreTypeFlags || !!flags[e.type] || (!!flags.fused && (e.fusionCount || 0) > 0) || (!!flags.active && !!e.active) || (!!flags.reborn && reborn);
    return categoryMatch && (!!flags.reborn || !reborn);
  };
  // モンスター一覧・マスモン一覧・編成画面のソート/表示設定つき一覧は、画面を開くたび・
  // 無関係な状態更新のたびに毎回全件ソートし直すと重くなり(タップ反応が悪くなる原因の一つ)、
  // useMemoで実際に関係する値が変わった時だけ計算し直すようにする
  // 種別が画面で固定されている一覧(ベースモン一覧・マスモン一覧)用。種別のチェックは見ない
  const unifiedMonsterEntriesSingleType = useMemo(
    () => sortMonsterEntries(buildUnifiedMonsterEntries(unlockedMonsterIds, masuMons, monsterRosterIds)).filter(e => monsterEntryMatchesDisplayFlags(e, monsterDisplayFlags, { ignoreTypeFlags: true })),
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
    saveMissionProgress('market');
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
    // 決定したらM/B管理のモンスタータブへ戻る(古い編成メニューは経由しない)
    setManagementTab('monster');
    setGameState('MB_MANAGEMENT');
  };
  const confirmTeachingRoster = () => {
    if (draftTeachingRoster.length !== STARTER_TEACHING_IDS.length) return;
    setTeachingRosterIds(draftTeachingRoster);
    storeSet('mh_teaching_roster', draftTeachingRoster, false);
    // 決定したらM/B管理のブリーダーカードタブへ戻る(古い編成メニューは経由しない)
    setManagementTab('breeder');
    setGameState('MB_MANAGEMENT');
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
  const STAT_POINT_KEYS = { hp: 'ライフ', atk: 'ちから', def: '丈夫さ', guts: 'ガッツ' };
  // 強化ポイントをまとめて振る。1つずつタップするのが手間だったため、
  // 「間合い適性を何段階」「どのステータスを何回」を一度に指定して確定できるようにしている。
  // plan の形は { apt: [0,0,0,0], stat: { hp:0, atk:0, def:0, guts:0 } }。
  // 実際に振れる分だけを反映し、更新後のマスモンを返す(足りない場合は何もしない)
  const spendPointsBulk = (masuId, plan) => {
    const masu = getMasuMon(masuId);
    if (!masu) return null;
    const available = masu.distAptPoints || 0;
    const aptPlan = plan.apt || [0, 0, 0, 0];
    const statPlan = plan.stat || {};
    const total = aptPlan.reduce((a, b) => a + (b || 0), 0) + Object.values(statPlan).reduce((a, b) => a + (b || 0), 0);
    if (total <= 0 || total > available) return null;

    const distApt = [...(masu.distApt || ['C', 'C', 'C', 'C'])];
    let used = 0;
    aptPlan.forEach((n, idx) => {
      for (let i = 0; i < (n || 0); i++) {
        const cur = DIST_APTITUDE_GRADES.indexOf(distApt[idx] || 'C');
        if (cur < 0 || cur >= DIST_APTITUDE_GRADES.length - 1) break; // 上限Mに達したらそこで止める
        distApt[idx] = DIST_APTITUDE_GRADES[cur + 1];
        used++;
      }
    });
    const statPoints = { ...(masu.statPoints || {}) };
    Object.entries(statPlan).forEach(([key, n]) => {
      if (!STAT_POINT_KEYS[key]) return;
      for (let i = 0; i < (n || 0); i++) {
        statPoints[key] = (statPoints[key] || 0) + (STAT_POINT_GAIN[key] || 1);
        used++;
      }
    });
    if (used <= 0) return null;

    const updatedMasu = { ...masu, distApt, statPoints, distAptPoints: available - used };
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? updatedMasu : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    Audio_.se.levelUp();
    return updatedMasu;
  };

  // マスモンの強化ポイントを1消費し、対象のステータスを1上げる(バランス調整前の暫定仕様: 1pt=+1)
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
  // 絆経験値のチケット(トレーニング/修行)をまとめて使う。
  // 1枚あたりの絆経験値はアイテム側(bondXp)が持つので、枚数ぶんをまとめて加算する
  const useBondXpTickets = (itemId, masuId, count) => {
    const item = BREEDER_MARKET_ITEMS.find(i => i.id === itemId);
    if (!item || !item.bondXp) return;
    const have = ownedItems[itemId] || 0;
    const n = Math.max(0, Math.min(count | 0, have));
    if (n <= 0) return;
    const masu = getMasuMon(masuId);
    if (!masu) return;
    const gain = item.bondXp * n;
    setMasuMons(prev => {
      const next = prev.map(m => m.id === masuId ? { ...m, bondXp: cappedBondXp(m, gain) } : m);
      storeSet('mh_masu_mons', next, false);
      return next;
    });
    setOwnedItems(prev => { const next = { ...prev, [itemId]: have - n }; storeSet('mh_owned_items', next, false); return next; });
    Audio_.se.levelUp();
  };
  const openTrainingInfo=()=>setGameState('TRAINING_INFO');
  const openDebugTraining=()=>{setTrainingSelectedId(null);setTrainingDifficulty('BEGINNER');setTrainingSession(null);setGameState('TRAINING_SELECT');};
  const startTraining=()=>{if(!trainingSelectedId||trainingDifficulty!=='BEGINNER')return;setTrainingMapScale(1);setTrainingMapOverview(false);setTrainingSession(createTrainingSession(trainingSelectedId));setTrainingDebugRoll(null);setGameState('TRAINING_BOARD');};
  const patchTraining=patch=>setTrainingSession(prev=>({...prev,...patch}));
  const showTrainingEffect=(space,text=space?.desc)=>{if(!space)return;if(trainingEffectTimerRef.current)clearTimeout(trainingEffectTimerRef.current);setTrainingEffect({kind:space.kind,emoji:space.emoji,text});trainingEffectTimerRef.current=setTimeout(()=>setTrainingEffect(null),1250);};
  const focusTrainingCurrent=()=>{setTrainingMapOverview(false);setTrainingMapScale(1);requestAnimationFrame(()=>{const viewport=trainingMapRef.current,node=TRAINING_NODE_BY_ID[trainingSession?.position];if(viewport&&node)viewport.scrollTo({left:720*node.x/100-viewport.clientWidth/2,top:520*node.y/100-viewport.clientHeight/2,behavior:'smooth'});});};
  const trainingPointerDown=e=>{const viewport=trainingMapRef.current;if(!viewport)return;viewport.setPointerCapture?.(e.pointerId);trainingPointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const points=[...trainingPointersRef.current.values()];trainingGestureRef.current={distance:points.length===2?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0,scale:trainingMapScale,last:points[0],moved:false};};
  const trainingPointerMove=e=>{const viewport=trainingMapRef.current,pointers=trainingPointersRef.current;if(!viewport||!pointers.has(e.pointerId))return;e.preventDefault();const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const points=[...pointers.values()],gesture=trainingGestureRef.current;if(points.length>=2){const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);if(gesture.distance){const scale=Math.max(.48,Math.min(2.15,gesture.scale*distance/gesture.distance));setTrainingMapScale(scale);setTrainingMapOverview(false);}gesture.moved=true;}else if(old){const dx=e.clientX-old.x,dy=e.clientY-old.y;if(Math.abs(dx)+Math.abs(dy)>1){viewport.scrollLeft-=dx;viewport.scrollTop-=dy;gesture.moved=true;}}};
  const trainingPointerUp=e=>{trainingPointersRef.current.delete(e.pointerId);if(trainingGestureRef.current.moved)trainingSuppressTapRef.current=Date.now()+350;trainingGestureRef.current.last=null;};
  const trainingWheel=e=>{if(!e.ctrlKey)return;e.preventDefault();setTrainingMapScale(scale=>Math.max(.48,Math.min(2.15,scale-e.deltaY*.002)));setTrainingMapOverview(false);};
  const logTraining=(session,text)=>[...(session.eventLog||[]),text].slice(-80);
  const finishTraining=(success,base=trainingSession)=>{if(!base||base.status==='result')return;const result={...base,status:'result',success,finalRewards:settleTrainingRewards(base,success),branchOptions:[],movementRemaining:0,message:success?'修行成功！':'修行失敗…',eventLog:logTraining(base,success?'強制/通常成功':'ターン切れ/強制失敗')};setTrainingSession(result);setGameState('TRAINING_RESULT');success?Audio_.se.trainingGoal():Audio_.se.trainingFail();};
  const addTrainingTool=(id,base=trainingSession)=>{if(!base||!TRAINING_TOOLS[id])return;if(base.tools.length<3){const auto=['noReturn','returnCharm'].includes(id);patchTraining({tools:[...base.tools,id],effects:auto?{...base.effects,[id]:true}:base.effects,eventLog:logTraining(base,`${TRAINING_TOOLS[id].name}取得`)});return;}setTrainingModal({type:'discard',newTool:id});};
  const applyTrainingSpace=async base=>{const node=TRAINING_NODE_BY_ID[base.position],space=TRAINING_SPACE_TYPES[node.type];showTrainingEffect(space);let next={...base,rewards:{...base.rewards,items:[...base.rewards.items]},tools:[...base.tools],effects:{...base.effects},branchOptions:[],movementRemaining:0,message:space.desc,eventLog:logTraining(base,`${space.label}: ${space.desc}`)};setTrainingModal({type:'effect',space});
    if(space.kind==='goal')return finishTraining(true,next);if(space.kind==='xp')next.rewards.bondXp+=space.value;else if(space.kind==='diamond')next.rewards.diamonds+=space.value;else if(space.kind==='item')next.rewards.items.push('修行仮アイテム');else if(space.kind==='tool'){setTrainingSession(next);return addTrainingTool(Object.keys(TRAINING_TOOLS)[Math.floor(Math.random()*7)],next);}else if(space.kind==='turn')next.remainingTurns=Math.max(0,next.remainingTurns+space.value);else if(space.kind==='effect'){if(space.value==='again')next.remainingTurns++;else next.effects[space.value]=true;}else if(space.kind==='happening'){if(Math.random()<.5){next.rewards.bondXp+=60;next.message='幸運！ 仮獲得絆経験値＋60';}else{next.remainingTurns=Math.max(0,next.remainingTurns-1);next.message='足止め！ 残りターン－1';}}
    if(space.kind==='move'&&next.forcedMoves<3){let backward=space.value<0;if(backward&&next.effects.noReturn){delete next.effects.noReturn;next.tools.splice(next.tools.indexOf('noReturn'),1);next.message='戻らずのお守りが後退を無効化';}else{const count=1+Math.floor(Math.random()*3);let cur=next.position,prev=next.previous;for(let i=0;i<count;i++){const options=TRAINING_NODE_BY_ID[cur].next.filter(x=>x!==prev);const chosen=(backward&&prev)||options[0];if(!chosen)break;prev=cur;cur=chosen;if(cur==='n23')break;}next={...next,previous:next.position,position:cur,forcedMoves:next.forcedMoves+1};setTrainingSession(next);await new Promise(r=>setTimeout(r,350));return applyTrainingSpace(next);}}
    setTrainingSession(next);if(next.remainingTurns<=0)setTimeout(()=>finishTraining(false,next),500);else Audio_.se.trainingReward();};
  const trainingForwardOptions=id=>TRAINING_NODE_BY_ID[id].next.filter(next=>TRAINING_BEGINNER_NODES.findIndex(n=>n.id===next)>TRAINING_BEGINNER_NODES.findIndex(n=>n.id===id));
  const previewTrainingRoute=(position,steps,chosenFirst=null)=>{const path=[];let id=position,chosen=chosenFirst;for(let left=steps;left>0;left--){const options=trainingForwardOptions(id);if(!options.length)break;if(options.length>1&&!chosen)return {path,branches:options,stop:null};id=chosen&&options.includes(chosen)?chosen:options[0];chosen=null;path.push(id);if(id==='n23')break;}return {path,branches:[],stop:path[path.length-1]||null};};
  const advanceTraining=async(base,steps,chosenFirst=null)=>{if(trainingMovingRef.current)return;trainingMovingRef.current=true;const initialPreview=previewTrainingRoute(base.position,steps,chosenFirst);let next={...base,branchOptions:[],movementRemaining:steps,routePreview:initialPreview.path,stopPreview:initialPreview.stop},chosen=chosenFirst;while(next.movementRemaining>0){const options=trainingForwardOptions(next.position);if(!options.length)break;if(options.length>1&&!chosen){const preview=previewTrainingRoute(next.position,next.movementRemaining);trainingMovingRef.current=false;setTrainingSession({...next,branchOptions:options,routePreview:preview.path,stopPreview:null,message:`分岐です。光る矢印から進む方向を選んでください（あと${next.movementRemaining}マス）`});return;}const id=chosen&&options.includes(chosen)?chosen:options[0];chosen=null;const previous=next.position;const routePreview=next.routePreview[0]===id?next.routePreview.slice(1):previewTrainingRoute(id,next.movementRemaining-1).path;next={...next,position:id,previous,movementRemaining:next.movementRemaining-1,branchOptions:[],routePreview,stopPreview:routePreview[routePreview.length-1]||null,message:`あと ${next.movementRemaining-1} マス`};Audio_.se.trainingMove();setTrainingSession(next);await new Promise(r=>setTimeout(r,320));if(id==='n23'){trainingMovingRef.current=false;return finishTraining(true,next);}}trainingMovingRef.current=false;next={...next,routePreview:[],stopPreview:null};setTrainingSession(next);await applyTrainingSpace(next);};
  const rollTrainingDice=async(fixedValue=null,isReroll=false,sessionOverride=null)=>{const base=sessionOverride||trainingSession;if(!base||base.status!=='playing'||trainingMovingRef.current||trainingRollTimerRef.current||base.branchOptions.length||(!isReroll&&base.rollPending))return;Audio_.se.trainingDice();setTrainingDiceStage('rolling');setTrainingDiceFace(1+Math.floor(Math.random()*3));trainingRollTimerRef.current=setInterval(()=>setTrainingDiceFace(1+Math.floor(Math.random()*3)),75);await new Promise(r=>setTimeout(r,720));clearInterval(trainingRollTimerRef.current);trainingRollTimerRef.current=null;const roll=()=>1+Math.floor(Math.random()*3);let value=fixedValue||trainingDebugRoll||roll();if(!isReroll&&base.effects.gale)value=Math.max(value,roll());if(!isReroll&&base.effects.boost)value++;if(!isReroll&&base.effects.feather)value+=2;const effects={...base.effects};delete effects.gale;delete effects.boost;delete effects.feather;delete effects.fixed;const canReroll=!isReroll&&base.tools.includes('reroll');const next={...base,previousRoll:base.lastRoll,lastRoll:value,rollPending:canReroll,effects,remainingTurns:base.remainingTurns-(isReroll?0:1),forcedMoves:0,message:canReroll?`${value}が出た！ 振り直すか、この出目で進んでください`:`${value}が出た！ 自動で進みます`,eventLog:logTraining(base,`${isReroll?'振り直し':'サイコロ'} ${value}`)};setTrainingDiceFace(value);setTrainingDiceStage('result');setTrainingSession(next);await new Promise(r=>setTimeout(r,850));setTrainingDiceStage('idle');if(!canReroll)advanceTraining({...next,rollPending:false},value);};
  const acceptTrainingRoll=()=>{if(!trainingSession?.rollPending)return;const preview=previewTrainingRoute(trainingSession.position,trainingSession.lastRoll);const next={...trainingSession,rollPending:false,routePreview:preview.path,stopPreview:preview.stop,message:`${trainingSession.lastRoll}で自動前進します`};setTrainingSession(next);advanceTraining(next,next.lastRoll);};
  const chooseTrainingBranch=id=>{if(!trainingSession.branchOptions.includes(id))return;Audio_.se.trainingDecide();advanceTraining(trainingSession,trainingSession.movementRemaining,id);};
  const trainingToolAvailability=id=>{if(['noReturn','returnCharm'].includes(id))return {ok:false,reason:'取得後に自動で待機し、条件を満たすと発動します'};if(id==='reroll')return trainingSession?.rollPending?{ok:true}:{ok:false,reason:'サイコロの出目確定後、移動前のみ使用可能'};if(trainingMovingRef.current||trainingSession?.movementRemaining||trainingSession?.branchOptions.length||trainingSession?.rollPending)return {ok:false,reason:'移動していない時のみ使用可能'};return {ok:true};};
  const useTrainingTool=id=>{const t=TRAINING_TOOLS[id],availability=trainingToolAvailability(id);if(!t||!availability.ok)return;const tools=[...trainingSession.tools];tools.splice(tools.indexOf(id),1);let effects={...trainingSession.effects},remainingTurns=trainingSession.remainingTurns;if(id==='sand')remainingTurns++;else if(id==='reroll'){const next={...trainingSession,tools,rollPending:false};Audio_.se.trainingTool();setTrainingSession(next);setTimeout(()=>rollTrainingDice(null,true,next),0);return;}else effects[id]=true;Audio_.se.trainingTool();patchTraining({tools,effects,remainingTurns,eventLog:logTraining(trainingSession,`${t.name}使用`)});};
  const restartTraining=()=>{if(trainingSelectedId){setTrainingMapScale(1);setTrainingMapOverview(false);setTrainingSession(createTrainingSession(trainingSelectedId));setGameState('TRAINING_BOARD');}};
  const leaveTrainingResult=()=>{setTrainingSession(null);setTrainingSelectedId(null);setGameState('DEBUG_SETTINGS');};
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
  // 副の固有技を「継承した固有技」としてinheritedUniquesに記録する。能力値・距離適性・
  // 強化ポイントは合体では増減させず、合体XPによるレベル上昇もポイント補填から除外する。
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
    const afterXp = cappedBondXp(main, gainedXp);
    const before = bondLevelInfo(beforeXp);
    const after = bondLevelInfo(afterXp);
    const gainedLevels = after.level - before.level;
    const subBase = ALL_PLAYER_MONSTERS[sub.baseId];
    const mainBase = ALL_PLAYER_MONSTERS[main.baseId];
    const ownedUniqueIds = new Set([uniqueLineageId(mainBase?.unique, mainBase?.id), ...(main.inheritedUniques || []).map(unique=>uniqueLineageId(unique))].filter(Boolean));
    const subUniqueLineageId = uniqueLineageId(subBase?.unique, subBase?.id);
    const canInherit = mainLvl.level >= 10 && subLvl.level >= 10 && fusionInheritUnique && subBase?.unique && !ownedUniqueIds.has(subUniqueLineageId);
    const inheritedLevel = Math.max(0, Number(sub.uniqueSkillLevels?.own) || Number(subBase?.unique?.evoLevel) || 0);
    const inheritedUnique = canInherit ? { ...uniqueSkillAtLevel(subBase.unique, inheritedLevel), monId: subBase.id, lineageId:subUniqueLineageId, sourceMasuName: sub.name } : null;
    const historyEntry = { subName: sub.name, subBaseId: sub.baseId, subBondLevel: subLvl.level, xpGained: gainedXp, inherited: !!inheritedUnique, timestamp: Date.now() };
    setMasuMons(prev => {
      const next = prev
        .filter(m => m.id !== sub.id)
        .map(m => m.id === main.id ? {
          ...m,
          bondXp: afterXp,
          fusionBondLevels: donationDiamondValue(m.fusionBondLevels) + gainedLevels,
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
  const resetDonationFlow = () => { if (donationProcessingRef.current) return; setDonationSelectedId(null); setDonationResult(null); setDonationAnimation(null); setDonationError(''); };
  const getRebirthSkillChoices = (masu) => {
    const base = ALL_PLAYER_MONSTERS[masu.baseId];
    const own = base?.unique ? [{ key:'own', name:base.unique.name, unique:base.unique }] : [];
    return [...own, ...(masu.inheritedUniques || []).map((unique,index)=>({ key:`inh:${index}`, name:unique.name, unique }))]
      .map(choice=>({ ...choice, level:Math.max(0, Math.floor(Number(masu.uniqueSkillLevels?.[choice.key]) || 0)) }));
  };
  const executeMasuRebirth = async () => {
    if (rebirthProcessingRef.current || !rebirthSelectedId) return;
    const masu = masuMonsRef.current.find(m=>String(m.id)===String(rebirthSelectedId));
    const result = buildMasuRebirth({ masu, skillKey:rebirthSkillKey, gold });
    if (!result.ok) { setRebirthError(result.reason); return; }
    rebirthProcessingRef.current = true;
    setRebirthError('');
    const next = masuMonsRef.current.map(m=>String(m.id)===String(masu.id)?result.nextMasu:m);
    try {
      await storeSet('mh_masu_mons', next, false);
      await storeSet('mh_gold', result.nextGold, false);
      masuMonsRef.current = next;
      setMasuMons(next); setGold(result.nextGold);
      const base = ALL_PLAYER_MONSTERS[masu.baseId];
      const skill = getRebirthSkillChoices(masu).find(choice=>choice.key===rebirthSkillKey);
      setRebirthAnimation({ masu:result.nextMasu, base, skillName:skill?.name || '固有技', skillLevel:result.skillLevel });
      setTimeout(()=>{ setRebirthAnimation(null); setRebirthSelectedId(null); setRebirthSkillKey(''); rebirthProcessingRef.current=false; }, 4100);
    } catch {
      rebirthProcessingRef.current=false;
      setRebirthError('転生データを保存できませんでした。もう一度お試しください。');
    }
  };
  const executeMasuDonation = async () => {
    if (donationProcessingRef.current || !donationSelectedId) return;
    donationProcessingRef.current = true;
    setDonationProcessing(true);
    setDonationError('');
    try {
      // state更新前の連打でも同じ個体を再利用できないよう、同期参照からIDで再取得する。
      const result = buildMasuDonation({
        masuMons: masuMonsRef.current, targetId: donationSelectedId, gold,
        monsterRosterIds, draftMonsterRoster, unlockedMonsterIds,
        validBaseIds: Object.keys(ALL_PLAYER_MONSTERS), requiredCount: STARTER_MONSTER_IDS.length,
      });
      if (!result.ok) { setDonationError(result.reason); setDonationSelectedId(null); return; }
      masuMonsRef.current = result.nextMasuMons;
      await storeSet('mh_masu_mons', result.nextMasuMons, false);
      await storeSet('mh_gold', result.nextGold, false);
      await storeSet('mh_monster_roster', result.nextRoster, false);
      await saveMissionProgress('donation');
      setMasuMons(result.nextMasuMons);
      setGold(result.nextGold);
      setMonsterRosterIds(result.nextRoster);
      setDraftMonsterRoster(result.nextDraftRoster);
      if (fusionMainId === result.donated.id || fusionSubId === result.donated.id) resetFusionFlow();
      setMasuMonDetail(null);
      setDonationSelectedId(null);
      setDonationAnimation({ name: result.donated.name, baseId: result.donated.baseId, src: ALL_PLAYER_MONSTERS[result.donated.baseId]?.iconUrl, colors: getMasuColors(result.donated), diamonds: result.diamonds });
      await wait(1500);
      setDonationAnimation(null);
      setDonationResult({ name: result.donated.name, diamonds: result.diamonds, gold: result.nextGold });
    } catch (error) {
      setDonationError('寄付データを保存できませんでした。もう一度お試しください。');
    } finally {
      donationProcessingRef.current = false;
      setDonationProcessing(false);
    }
  };
  // ラン終了画面: 今回のランで勇者モンに選んでいた(まだマスモン化していない)モンスター種を、
  // 今回のランで得た絆経験値をそのまま初期値として、名前を付けてマスモンとして登録する
  // ラン終了画面(CHAMPION/敗北/リタイア)共通: マスモン登録ボタン・登録済み表示
  const masuRegisterButtonNode = () => {
    if (!finalRewardSummary?.heroBondGain || finalRewardSummary.heroBondGain.masuId) return null;
    if (masuRegisteredThisRun) return <div className="text-[10px] text-pink-300 font-black mt-1 flex items-center justify-center gap-1 shrink-0"><Heart size={11}/>マスモンとして登録しました！</div>;
    // 見落とされやすいので、ただのボタンではなく枠つきの案内にして光らせる
    return (
      <div
        className="w-full max-w-xs mt-2 shrink-0 rounded-2xl border-2 p-2.5"
        style={{ borderColor:'#ec4899', backgroundColor:'rgba(236,72,153,0.12)', animation:'masuCallout 1.6s ease-in-out infinite' }}
      >
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="text-[8px] font-black text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor:'#ec4899', animation:'masuBadge 1.6s ease-in-out infinite' }}>登録できます</span>
          <span className="text-[10px] font-black text-pink-200">{mainHero?.name||'このモンスター'}をマスモンに！</span>
        </div>
        <div className="text-[8px] text-pink-100/80 font-bold leading-snug mb-2 text-center">今回ためた絆経験値をそのまま引き継いで、次のランからも育てられます</div>
        <button
          onClick={()=>{setMasuNameInput(mainHero?.name||''); setShowMasuRegisterModal(true);}}
          className="w-full text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2 active:scale-95"
          style={{ backgroundColor:'#db2777' }}
        ><Heart size={14}/>マスモンとして登録する</button>
      </div>
    );
  };
  const registerMasuMon = (name) => {
    if (!mainHero || mainHero.masuId) return null; // 既にマスモンの勇者は登録不要(既存インスタンスに加算済み)
    const base = ALL_PLAYER_MONSTERS[mainHero.id];
    if (!base) return null;
    const startXp = Math.min(finalRewardSummary?.heroBondGain?.xpGain || 0, totalBondXpForLevel(INITIAL_MASU_LEVEL_CAP));
    const startLevel = bondLevelInfo(startXp);
    const id = 'masu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const masu = {
      id, baseId: mainHero.id,
      name: (name || base.name).trim().slice(0, 12) || base.name,
      bondXp: Math.min(startXp, totalBondXpForLevel(INITIAL_MASU_LEVEL_CAP)),
      rebirthCount: 0,
      levelCap: INITIAL_MASU_LEVEL_CAP,
      uniqueSkillLevels: {},
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
    // awaitより前に同期ロックする。敗北effectとボタン連打が同時に到達しても報酬は一度だけ。
    if (rewardsAwardedRef.current) return;
    rewardsAwardedRef.current = true;
    // 敗北・リタイア時は未決着だった現在WAVEを「挑戦」にだけ数える。勝利WAVEは撃破時に記録済み。
    if (wavesCleared < wave) await saveMissionProgress('battle');
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
    // バトルへ参加した供モンには勇者モンの1/2、モンスター編成内で参加しなかった控えのマスモンには
    // 1/4を加算する。勇者・参加・控えの区分と個体IDは先に一意化し、同じ個体へ重複付与しない。
    const gain = xpForWavesCleared(wavesCleared, scoreMult);
    const bondAwards = buildRunBondAwards({
      gain,
      heroMasuId: mainHero?.masuId,
      participantMasuIds: slots.filter(s => s?.masuId).map(s => s.masuId),
      monsterRosterIds,
      masuMons,
    });
    const awardByMasuId = new Map(bondAwards.map(award => [String(award.masuId), award]));
    // 表示用の獲得内訳は、setMasuMonsの更新関数(Reactが後で非同期に呼び出すため、この関数の続きの
    // 行が実行される時点ではまだ実行されているとは限らない)の中で計算するのではなく、現在のmasuMons
    // (getMasuMon)を直接読んでこの場で同期的に計算する。以前はupdater内でのみ計算していたため、
    // タイミングによって勇者モン自身の絆経験値欄がリザルト画面に出ないことがあった
    let heroBondGain = null;
    if (mainHero?.masuId) {
      const masu = getMasuMon(mainHero.masuId);
      const before = bondLevelInfo(masu?.bondXp || 0);
      const after = bondLevelInfo(cappedBondXp(masu || {}, gain));
      heroBondGain = { name: mainHero.masuName || mainHero.name, emoji: mainHero.emoji, iconUrl: mainHero.iconUrl, xpGain:Math.max(0,cappedBondXp(masu || {}, gain)-(masu?.bondXp||0)), levelBefore: before, levelAfter: after, masuId: mainHero.masuId };
    } else if (mainHero) {
      const before = bondLevelInfo(0);
      const after = bondLevelInfo(gain);
      heroBondGain = { name: mainHero.name, emoji: mainHero.emoji, iconUrl: mainHero.iconUrl, xpGain: gain, levelBefore: before, levelAfter: after, masuId: null };
    }
    const allyBondGains = bondAwards.filter(award => award.rate === 0.5 && award.showInResult).map(award => {
      const masuId = award.masuId;
      const masu = getMasuMon(masuId);
      if (!masu) return null;
      const before = bondLevelInfo(masu.bondXp || 0);
      const after = bondLevelInfo(cappedBondXp(masu, award.gain));
      return { name: masu.name, xpGain:Math.max(0,cappedBondXp(masu, award.gain)-(masu.bondXp||0)), levelBefore: before, levelAfter: after, masuId };
    }).filter(Boolean);

    if (bondAwards.length > 0) {
      setMasuMons(prev => {
        const next = prev.map(m => {
          const award = awardByMasuId.get(String(m.id));
          if (!award) return m;
          const before = bondLevelInfo(m.bondXp || 0);
          const afterXp = cappedBondXp(m, award.gain);
          const after = bondLevelInfo(afterXp);
          return { ...m, bondXp: afterXp, distAptPoints: (m.distAptPoints || 0) + (after.level - before.level) };
        });
        storeSet('mh_masu_mons', next, false);
        return next;
      });
    }

    setFinalRewardSummary({ breederXpGain, breederLevelBefore, breederLevelAfter, goldBefore, goldAfter, heroBondGain, allyBondGains, waveHistory });
  };

  // Masterを含む最終WAVEのクリア回数も、報酬・ランキングとは独立した同期ロックで1回だけ記録する。
  // Reactのstate updater内で永続化すると開発時のStrict Modeでupdaterが再評価され得るため、
  // 保存する値をrefロック後に確定し、副作用をupdaterの外へ出す。
  const recordClearOnce = async () => {
    if (clearRecordedRef.current) return;
    clearRecordedRef.current = true;
    const nextCount = (clearCounts[difficulty] || 0) + 1;
    setClearCounts(prev => ({ ...prev, [difficulty]: Math.max(prev[difficulty] || 0, nextCount) }));
    await storeSet(`mh_clears_${difficulty}`, nextCount, false);
  };

  // Save score on game end (CHAMPION is awarded synchronously in handleNextWave instead, so its result screen never renders before the summary is ready)
  useEffect(() => {
    if (hp <= 0) {
      if (debugBattleRef.current) {
        if (!debugResultRef.current) {
          debugResultRef.current = true;
          setResultProcessing(false);
          setDebugOutcome('lose');
        }
        return;
      }
      if (runFinalizingRef.current) return;
      runFinalizingRef.current = true;
      setRunFinalizing(true);
      setResultProcessing(true);
      (async () => {
        // 経験値・ダイヤの付与は端末内で完結するので必ず先に行う。
        // 以前はスコア送信(全国ランキングへの通信)の完了を待ってから付与していたため、
        // 通信が遅い・不安定なときにリザルトの獲得内訳がなかなか表示されなかった。
        try {
          await awardRunRewards(Math.max(0, wave - 1));
        } catch (e) { console.error('[result] award rewards failed:', e && e.message ? e.message : e); }
        // リザルト自体は背面に表示するが、ランキング保存の成否が確定するまでは全面ロックを
        // 維持する。タイトル遷移や再挑戦で周回IDを先に更新させない。
        await submitRunScoreOnce();
        setResultProcessing(false);
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
    monSelection:getActiveMonsterList(), ownedUniques:[], slotUniqueChoice:{}, slotUniqueLevelChoice:{}, inheritedUniqueEvo:{}, ownedTeachings:[],
    atkLevel:0, guardLevel:0, guardBonusCount:0, upgradePoints:0, turnCount:1,
    permaBuffs:{ autoHpRecovery:0.1 }, waveBuffs:{}, turnBuffs:{}, nextTurnBuffs:{},
    currentWaveDamage:0, waveDistDamage:[0,0,0,0], distDmgBonus:[0,0,0,0], distAptBonus:[0,0,0,0], totalDistDamage:[0,0,0,0], totalAllDamage:0, totalRecoveryDelta:0, waveResult:null,
    focusedCard:null, enemyIntent:null, effect:null, finalRewardSummary:null, waveHistory:[], gaveUp:false
  });

  const returnToHome = () => {
    debugBattleRef.current = false;
    debugResultRef.current = false;
    setDebugBattle(false);
    setDebugOutcome(null);
    beginNewRankingRun({ runIdRef, scoreSubmittedRef, runFinalizingRef, rewardsAwardedRef, clearRecordedRef });
    setRunFinalizing(false);
    const s = resetAllState();
    setScore(s.score); setWave(s.wave); setHp(s.hp); setMaxHp(s.maxHp); setGuts(s.guts); setMaxGuts(s.maxGuts);
    setAtk(s.atk); setDef(s.def); setSlots(s.slots); setMainHero(s.mainHero); setHand(s.hand); setDeck(s.deck);
    setGraveyard(s.graveyard); setEnemy(s.enemy); setEnemyDist(s.enemyDist); setSelectedCards(s.selectedCards); setCardAssignments({}); setPendingCard(null);
    setIsBusy(s.isBusy); setMonSelection(s.monSelection); setOwnedUniques(s.ownedUniques); setSlotUniqueChoice(s.slotUniqueChoice||{}); setSlotUniqueLevelChoice(s.slotUniqueLevelChoice||{}); setInheritedUniqueEvo(s.inheritedUniqueEvo||{});
    setOwnedTeachings(s.ownedTeachings); setAtkLevel(s.atkLevel); setGuardLevel(s.guardLevel);
    setGuardBonusCount(s.guardBonusCount); setUpgradePoints(s.upgradePoints); setTurnCount(s.turnCount);
    setPermaBuffs(s.permaBuffs); setWaveBuffs(s.waveBuffs); setTurnBuffs(s.turnBuffs); setNextTurnBuffs(s.nextTurnBuffs);
    setCurrentWaveDamage(s.currentWaveDamage); setWaveDistDamage(s.waveDistDamage||[0,0,0,0]); setDistDmgBonus(s.distDmgBonus||[0,0,0,0]); setDistAptBonus(s.distAptBonus||[0,0,0,0]); setTotalDistDamage(s.totalDistDamage||[0,0,0,0]); setTotalAllDamage(s.totalAllDamage||0); setTotalRecoveryDelta(s.totalRecoveryDelta||0);
    setWaveResult(s.waveResult);
    setPendingReward(null); setFocusedCard(s.focusedCard); setSkillPicker(null); setShowQuitConfirm(false); setEnemyIntent(s.enemyIntent); setEffect(s.effect); setFinalRewardSummary(s.finalRewardSummary); setWaveHistory(s.waveHistory||[]); setGaveUp(s.gaveUp);
    setMasuRegisteredThisRun(false); setShowMasuRegisterModal(false); setMasuNameInput('');
    setGameState('HOME');
  };

  const claimGiftIds = async (ids) => {
    if (giftClaimingRef.current) return;
    giftClaimingRef.current = true;
    try {
      const wanted = new Set(ids);
      let balances = { gold, breederPoints, ownedItems };
      let claimedCount = 0;
      const now = Date.now();
      const nextGifts = gifts.map(gift => {
        if (!wanted.has(gift?.id)) return gift;
        const result = buildGiftClaim(gift, balances, now);
        if (!result.ok) return gift;
        balances = result.balances; claimedCount++;
        return result.gift;
      });
      if (!claimedCount) return;
      // 報酬検証を全件終えた確定値だけを保存し、画面stateも同じ値へ揃える。
      await storeSet('mh_gold', balances.gold, false);
      await storeSet('mh_breeder_points', balances.breederPoints, false);
      await storeSet('mh_owned_items', balances.ownedItems, false);
      await storeSet('mh_gifts', nextGifts, false);
      setGold(balances.gold); setBreederPoints(balances.breederPoints); setOwnedItems(balances.ownedItems); setGifts(nextGifts);
    } finally { giftClaimingRef.current = false; }
  };
  // タブに出す赤い丸バッジ。0件なら何も出さない。
  // Tailwindの動的クラス生成に頼らず色と形はinline styleで指定する(生成に失敗して透明になるのを避ける)
  const tabCountBadge = (count) => (count > 0 ? (
    <span
      className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[10px] font-black leading-none"
      style={{ minWidth: '20px', height: '20px', padding: '0 5px', backgroundColor: '#dc2626', color: '#ffffff', border: '2px solid #0f172a' }}
      aria-label={`未受取 ${count}件`}
    >{count > 99 ? '99+' : count}</span>
  ) : null);
  const openGiftBox = () => { setGiftTab('unclaimed'); setGameState('GIFT_BOX'); };
  const saveMissionProgress = async (event,amount=1) => {
    const next=normalizeMissions(missionsRef.current);
    const key={battle:'battles',win:'wins',enhance:'enhances',market:'marketTrades',donation:'donations'}[event];
    if(!key)return;
    next.daily[key]=(Number(next.daily[key])||0)+amount;
    next.weekly[key]=(Number(next.weekly[key])||0)+amount;
    missionsRef.current=next; setMissions(next); await storeSet('mh_missions',next,false);
  };
  // ミッション報酬のギフト。IDは「種別+期間+ミッションID」で固定なので、
  // 何度実行しても同じミッションのギフトが二重に増えることはない
  const buildMissionGift = (type,period,mission) => ({id:`gift_mission_${type}_${period}_${mission.id}`,source:'mission',missionId:mission.id,missionType:type,periodId:period,title:`ミッション報酬「${mission.name}」`,description:`${mission.condition}の達成報酬です。`,rewards:mission.rewards.map(r=>({...r})),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*24*60*60*1000).toISOString(),claimedAt:null});
  // 達成済み・未受取のミッションをまとめてギフトへ送る共通処理。
  // 個別受取(1件)も一括受取(複数件)も、同じ保存の流れ(ギフト→ミッションの順)を通す
  const sendMissionsToGiftBox = async (type,missionList) => {
    if(missionClaimingRef.current)return 0;
    missionClaimingRef.current=true;
    try{
      const state=normalizeMissions(missionsRef.current), sentKey=type==='daily'?'sentDaily':'sentWeekly';
      // 進捗と送付済みは保存されている値で判定し直す(画面の表示が古くても二重送付しない)
      const targets=(missionList||[]).filter(m=>m&&!state[sentKey].includes(m.id)&&missionValue(state,type,m)>=m.target);
      if(!targets.length)return 0;
      const period=type==='daily'?state.dailyPeriod:state.weeklyPeriod;
      let nextGifts=Array.isArray(gifts)?[...gifts]:[];
      const sent=[...state[sentKey]];
      targets.forEach(mission=>{
        const gift=buildMissionGift(type,period,mission);
        if(!nextGifts.some(g=>g?.id===gift.id)) nextGifts=[gift,...nextGifts];
        if(!sent.includes(mission.id)) sent.push(mission.id);
        if(type==='daily'&&!mission.complete) state.weekly.dailyClaims=(Number(state.weekly.dailyClaims)||0)+1;
      });
      state[sentKey]=sent;
      // 固定IDと同期ロックに加え、ギフトを先に保存する。途中終了時も再操作では同じIDを再利用する。
      await storeSet('mh_gifts',nextGifts,false);
      await storeSet('mh_missions',state,false);
      missionsRef.current=state; setGifts(nextGifts); setMissions(state);
      return targets.length;
    }finally{missionClaimingRef.current=false;}
  };
  const claimMission = (type,mission) => sendMissionsToGiftBox(type,[mission]);
  // 選択中のタブで、達成済み・未受取のものをまとめてギフトへ送る
  const claimMissionsBulk = (type) => sendMissionsToGiftBox(type,missionClaimableList(normalizeMissions(missionsRef.current),type));
  const openMissions = () => { setMissionTab('daily'); setGameState('MISSIONS'); };

  const returnToOfficialTitle = () => {
    returnToHome();
    setShowOfficialTitleConfirm(false);
    setShowRanking(false); setShowHelp(false); setShowChangelog(false);
    setShowTitleSettings(false); setShowAudioSettings(false); setShowBackup(false);
    setShowDeckInfo(false); setShowEnemyInfo(false); setShowHeroInfo(false); setShowQuitConfirm(false);
    setShowMasuRegisterModal(false); setShowMasuRenameModal(false); setShowIconPicker(false);
    setShowSortFilterModal(false); setShowNameEdit(false);
    setPendingItemUse(null); setXpTicketUse(null); setDyeTargetMasuId(null); setCustomColorPicker(null); setMasuMonDetail(null);
    setFocusedCard(null); setSkillPicker(null); setRosterDetailMon(null); setRosterDetailTeaching(null); setRosterSkillDetail(null);
    titleStartingRef.current = false; setTitleStarting(false);
    entryAnimatingRef.current = false; setEntryAnimating(false);
    setEnteringSlow(false);
    setBootPhase('TITLE');
  };

  // Give up mid-run: record current score to ranking, award rewards, then show the final result screen (gaveUp)
  const handleGiveUp = useCallback(async () => {
    if (debugBattleRef.current) {
      if (debugResultRef.current) return;
      debugResultRef.current = true;
      setShowQuitConfirm(false);
      setGaveUp(true);
      setDebugOutcome('giveup');
      return;
    }
    if (runFinalizingRef.current) return;
    runFinalizingRef.current = true;
    setRunFinalizing(true);
    setResultProcessing(true);
    // 敗北時と同じく、端末内で完結する経験値・ダイヤの付与とリザルト表示を先に済ませる。
    // ランキング保存中は全面ロックを維持するが、POSTには8秒の上限がある。
    try { await awardRunRewards(Math.max(0, wave - 1)); } catch {}
    setShowQuitConfirm(false);
    setGaveUp(true);
    await submitRunScoreOnce();
    setResultProcessing(false);
  }, [score, difficulty, highScores, breederName, mainHero, slots, wave]);

  const handleRetry = () => {
    beginNewRankingRun({ runIdRef, scoreSubmittedRef, runFinalizingRef, rewardsAwardedRef, clearRecordedRef });
    setRunFinalizing(false);
    const s = resetAllState();
    setScore(s.score); setWave(s.wave); setHp(s.hp); setMaxHp(s.maxHp); setGuts(s.guts); setMaxGuts(s.maxGuts);
    setAtk(s.atk); setDef(s.def); setSlots(s.slots); setMainHero(s.mainHero); setHand(s.hand); setDeck(s.deck);
    setGraveyard(s.graveyard); setEnemy(s.enemy); setEnemyDist(s.enemyDist); setSelectedCards(s.selectedCards); setCardAssignments({}); setPendingCard(null);
    setIsBusy(s.isBusy); setMonSelection(s.monSelection); setOwnedUniques(s.ownedUniques); setSlotUniqueChoice(s.slotUniqueChoice||{}); setSlotUniqueLevelChoice(s.slotUniqueLevelChoice||{}); setInheritedUniqueEvo(s.inheritedUniqueEvo||{});
    setOwnedTeachings(s.ownedTeachings); setAtkLevel(s.atkLevel); setGuardLevel(s.guardLevel);
    setGuardBonusCount(s.guardBonusCount); setUpgradePoints(s.upgradePoints); setTurnCount(s.turnCount);
    setPermaBuffs(s.permaBuffs); setWaveBuffs(s.waveBuffs); setTurnBuffs(s.turnBuffs); setNextTurnBuffs(s.nextTurnBuffs);
    setCurrentWaveDamage(s.currentWaveDamage); setWaveDistDamage(s.waveDistDamage||[0,0,0,0]); setDistDmgBonus(s.distDmgBonus||[0,0,0,0]); setDistAptBonus(s.distAptBonus||[0,0,0,0]); setTotalDistDamage(s.totalDistDamage||[0,0,0,0]); setTotalAllDamage(s.totalAllDamage||0); setTotalRecoveryDelta(s.totalRecoveryDelta||0);
    setWaveResult(s.waveResult);
    setFocusedCard(s.focusedCard); setSkillPicker(null); setEnemyIntent(s.enemyIntent); setEffect(s.effect); setPendingReward(null); setFinalRewardSummary(s.finalRewardSummary); setWaveHistory(s.waveHistory||[]); setGaveUp(s.gaveUp);
    setMasuRegisteredThisRun(false); setShowMasuRegisterModal(false); setMasuNameInput('');
    setGameState('PICK_HERO');
  };

  const runResultActionOnce = (action) => {
    if (resultActionRef.current) return;
    resultActionRef.current = true;
    setResultActionPending(true);
    action();
    // 遷移先で次の周回を開始できるよう、現在の連打イベントが終わってから解除する。
    setTimeout(() => {
      resultActionRef.current = false;
      setResultActionPending(false);
    }, 0);
  };

  const getNextEnemyAction = useCallback((ent, currentDist) => chooseEnemyAction(ent,currentDist), []);

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

  // 同じターンに2枚目以降で使ったカードは効果が半減する(ハムの連続攻撃で複数枚使うときの調整)。
  // ブリーダーカード(教えカード)だけは対象外で、何枚目に使っても効果は変わらない。
  // 「何枚目か」の数え方をここに集約し、画面のダメージ予測とprocessTurnの実処理がずれないようにする。
  const isBreederCard = (card) => !!card && TEACHING_CARDS.some(t => t.id === card.id);
  // ガードカードの重み(弱ガードは半分)。軽減量の合計表示と実処理で同じ式を使う。
  const guardCardWeight = (card) => card?.type === 'guard' ? 1 : (card?.type === 'weak_guard' ? 0.5 : 0);
  // 軽減量は「固定値の合計 + 丈夫さ × 倍率の合計」。handleEnemyTurnの計算と同じ式にする。
  const guardValueOf = (flat, mult) => (flat > 0 || mult > 0) ? Math.floor(flat + def * mult) : 0;
  const getDmg = useCallback((card, slotIdx, mon, additionalOryo=0, additionalDmgMod=0, isSecondOrLaterAtk=false, attackStartDist=enemyDist) => {
    if (!mon||!card||['guard','draw','buff','heal','weak_guard'].includes(card.type)) return 0;
    const distDiff = Math.abs(slotIdx-attackStartDist);
    const distMult = [1.5,1.3,1.1,0.9][distDiff]||1.0;
    let baseDmgMult = 1.0;
    if (card.subType==='stun_atsu') { baseDmgMult = card.baseValue||1.5; }
    else if (card.type==='unique') { const level=card.evoLevel||0; const chuuniBonus=(card.monId==='Ark'||card.monId==='Iblis')?0.1*getPermaBuff('chuuniUniqueStack'):0; baseDmgMult=card.baseMult+(level*0.5)+chuuniBonus; }
    else if (card.type==='range_atk') { baseDmgMult=rangeAttackDamageMultiplier(card,attackStartDist); }
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
    setEffect({type:'heal',label:"緊急回復",icon:"💊",monEmoji:mainHero?.emoji||"🏥",imgUrl:mainHero?.imgUrl,baseId:mainHero?.id,colors:mainHero?.colors});
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
    let forcedMoveTarget=null; // 最後に使った距離撃の指定距離を、敵行動後にも最終距離として再適用する
    let attackDistance=enemyDist; // 同一ターンの各攻撃開始時点の距離。距離撃後は指定距離へ進める
    const attackHits=[]; // {dmg, isCrit, slotIdx}

    // カットイン廃止: 技名はスロット上にインライン表示する（実行ループ内で行う）

    let penaltyCardCount=0; // ブリーダーカード以外を何枚使ったか(2枚目以降は効果半減)
    for (const entry of usedCardEntries) {
      const card=entry.card;
      // 2枚目以降のカードは効果が半減する。ブリーダーカードは対象外で、枚数にも数えない。
      const isBreeder=isBreederCard(card);
      const halved=!isBreeder&&penaltyCardCount>0;
      const effMul=halved?0.5:1;
      if(!isBreeder) penaltyCardCount++;
      if(halved) addPopup('2枚目以降 効果半減','hero','text-slate-300 text-sm font-black');
      const slotIdx=entry.slotIdx!=null?entry.slotIdx:defaultSlot;
      lastType=card.type;
      if (card.type==='guard') { Audio_.se.guard(); guardTypeInTurn='guard'; currentTurnGuardFlat+=GUARD_EVOLUTION[guardLevel].flat*effMul; currentTurnGuardMult+=GUARD_EVOLUTION[guardLevel].mult*effMul; }
      else if (card.type==='weak_guard') { if(guardTypeInTurn!=='guard') guardTypeInTurn='weak_guard'; currentTurnGuardFlat+=(GUARD_EVOLUTION[guardLevel].flat*0.5*effMul); currentTurnGuardMult+=(GUARD_EVOLUTION[guardLevel].mult*0.5*effMul); }
      setGuts(p=>Math.max(0,p-getCardGuts(card)));
      if (card.type==='draw') continue;
      if (card.type==='buff'||card.type==='debuff') {
        fireTeachingFx(card.id);
        if (card.subType==='atk_buff') { addPopup(`攻撃UP!`,'hero','text-red-400 font-black text-2xl drop-shadow-md'); addPermaBuff('atkPct',card.baseValue); localOryoAdd+=card.baseValue; }
        else if (card.subType==='dmg_cut_buff') { addPopup(`防御UP!`,'hero','text-emerald-400 font-black text-2xl drop-shadow-md'); const owned=ownedTeachings.find(ot=>ot.id===card.id); const level=owned?owned.evoLevel:0; let cutValue=level===0?0.03:(level===1?0.06:0.10); setPermaBuffs(p=>({...p, dmgCutPct:Math.min(0.9,(p.dmgCutPct||0)+cutValue)})); }
        // かどみうむ: 効果量はdata/breeder.jsのCADMIUM_TIERSに集約している(説明文の生成も同じ値を見る)
        else if (card.subType==='guts_buff') { const owned=ownedTeachings.find(ot=>ot.id===card.id); const tier=CADMIUM_TIERS[Math.min(owned?owned.evoLevel:0,CADMIUM_TIERS.length-1)]; addPopup(tier.gutsLimit>0?`⚡ ガッツ上限UP!`:`⚡ ガッツ回復UP!`,'guts','text-amber-400 font-black text-2xl drop-shadow-md'); if(tier.autoGuts>0) addPermaBuff('gutsRecoverPct',tier.autoGuts); if(tier.gutsLimit>0) addPermaBuff('muaGutsPct',tier.gutsLimit); if(tier.hpLimit>0) addPermaBuff('muaHpPct',tier.hpLimit); if(tier.autoHp>0){ addPermaBuff('autoHpRecovery',tier.autoHp); addPopup(`💚 再生強化`,'life','text-emerald-400 font-black text-xl drop-shadow-md'); } }
        else if (card.subType==='stun_atsu') {
          immediateInvincible=true; setImmediateTurnBuff('invincible',true);
          const stunMon=slots[slotIdx];
          const d=getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false); totalDmg+=d; attackCount++; attackHits.push({dmg:d, isCrit:false, slotIdx});
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
          if(card.monId==='Mocchi'||card.monId==='Mitarashi'){addPermaBuff('dmgCutPct',0.03*effMul); addWaveBuff('enemyTakenDmgBonus',0.1*effMul); localDmgModAdd+=0.1*effMul; addPopup('丈夫さUP!','hero','text-emerald-400 text-lg font-bold');}
          else if(card.monId==='Golem'){addPermaBuff('atkPct',0.1*effMul); localOryoAdd+=0.1*effMul; addPopup('闘志UP!','hero','text-red-600 text-lg font-bold');}
          else if(card.monId==='Zan'){addPermaBuff('comboDmgPct',0.03*effMul); addPopup('連斬!','hero','text-cyan-400 text-lg font-bold');}
        }
        const attackStartDist=attackDistance;
        const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist); attackCount++;
        const critRateBonus=getPermaBuff('critRatePct'), critDmgBonus=getPermaBuff('critDmgPct');
        const isCrit=getTurnBuff('guaranteedCrit',false)||(Math.random()<((card.crit||0.1)+critRateBonus));
        const finalD=isCrit?Math.floor(d*(1.5+critDmgBonus)):d; if(isCrit) hasCrit=true; totalDmg+=finalD;
        const rangeMoveTarget=card.type==='range_atk' && card.rangeIdx!=null ? card.rangeIdx : null;
        attackHits.push({dmg:finalD, isCrit, slotIdx, isSpecial:(card.type==='unique'||card.type==='range_atk'), skillName:(card.name||card.baseName), isUnique:card.type==='unique', monId:card.type==='unique'?card.monId:undefined, rangeMoveTarget});
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
        if (rangeMoveTarget!=null) { forcedMoveTarget=rangeMoveTarget; attackDistance=rangeMoveTarget; }
        if (card.type==='unique') {
          // 固有技の効果は技の出自(card.monId)で判定する(activeMon.idではない)。理由は上のコメントと同じ
          if(card.monId==='Ham'){immediateStun=true; setImmediateTurnBuff('stunEnemy',true); addPopup('スタン!','enemy','text-yellow-400 text-lg font-bold');}
          else if(card.monId==='Suezo'){const gRec=Math.floor(effectiveMaxGuts*0.5*effMul); setGuts(p=>Math.min(effectiveMaxGuts,p+gRec)); addPopup(`⚡ ガッツ +${gRec}`,'guts','text-amber-400 text-xl font-black drop-shadow-md');}
          else if(card.monId==='Pixie'){setNextTurnBuff('zeroGuts',true); addPopup('次ターン消費0!','hero','text-blue-400 text-lg font-bold');}
          else if(card.monId==='Tiger'){setNextTurnBuff('guaranteedCrit',true); addPermaBuff('critRatePct',0.02*effMul); addPermaBuff('critDmgPct',0.02*effMul); addPopup('次ターン会心確定!','hero','text-red-400 text-lg font-bold'); addPopup(`会心率+${(2*effMul).toFixed(effMul===1?0:1)}% 会心ダメ+${(2*effMul).toFixed(effMul===1?0:1)}%`,'hero','text-yellow-400 text-sm font-bold');}
          else if(card.monId==='Monol'){addPermaBuff('dmgCutPct',0.03*effMul); addWaveBuff('enemyAtkDebuffPct',0.10*effMul); setNextTurnBuff('reflect',true); addPopup('次ターン反射！','hero','text-purple-400 text-lg font-bold');}
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
            if (hit.rangeMoveTarget!=null) {
              setEnemyDist(hit.rangeMoveTarget);
              syncAtkTierForDist(hit.rangeMoveTarget);
              addPopup(`${RANGE_LABELS[hit.rangeMoveTarget]}距離へ移動！`,'enemy','text-cyan-400 font-black text-lg drop-shadow-md');
              await wait(350);
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
          if (hit.rangeMoveTarget!=null) {
            setEnemyDist(hit.rangeMoveTarget);
            syncAtkTierForDist(hit.rangeMoveTarget);
            addPopup(`${RANGE_LABELS[hit.rangeMoveTarget]}距離へ移動！`,'enemy','text-cyan-400 font-black text-lg drop-shadow-md');
            await wait(350);
          }
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
      Audio_.playJingle('victory'); // 敵撃破のファンファーレ
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
      await saveMissionProgress('battle');
      await saveMissionProgress('win');
      setWaveHistory(prev => [...prev, { wave, roundScore: finalRoundScore, totalScore: score + finalRoundScore, xpGain: waveXpGain(wave, scoreMultiplier), goldGain: waveGoldGain(wave, goldMultiplier) }]);
      setTimeout(()=>setGameState('WAVE_RESULT'),500); return;
    }
    // 予測表示している enemyIntent をそのまま実行する（再抽選しない）
    const finalActionType=guardTypeInTurn!=='none'?guardTypeInTurn:lastType;
    const executedIntent=enemyIntent;
    await handleEnemyTurn(finalActionType,{invincible:immediateInvincible,stun:immediateStun,guardFlat:currentTurnGuardFlat,guardMult:currentTurnGuardMult},executedIntent);
    // 通常の距離変更を先に処理した後、最後の距離撃の指定距離を再適用して最終距離を確定する。
    if (forcedMoveTarget!=null) {
      setEnemyDist(forcedMoveTarget);
      syncAtkTierForDist(forcedMoveTarget);
    }
    // 敵の行動が終わった後で、次ターンの予測を1回だけ抽選してセット
    // 敵が移動した場合は移動後の距離を基準にする
    const distForNextPredict=forcedMoveTarget!=null?forcedMoveTarget:((executedIntent&&executedIntent.type==='MOVE')?executedIntent.targetDist:enemyDist);
    setEnemyIntent(getNextEnemyAction(enemy,distForNextPredict));
  };

  // WAVE 10のムー撃破後は同期ロックしたまま報酬計算とランキング保存を各1回だけ行う。
  // リザルトは先に表示するが、保存確定までは全面入力ロックで遷移・連打を通さない。
  const handleNextWave = async () => {
    if (debugBattleRef.current) {
      if (debugResultRef.current) return;
      debugResultRef.current = true;
      setDebugOutcome('win');
      return;
    }
    if (runFinalizingRef.current) return;
    setEffect(null);
    if (wave === 10) {
      // awaitに入る前にロックし、通信中の連打を同一周回の別処理として通さない
      runFinalizingRef.current = true;
      setRunFinalizing(true);
      setResultProcessing(true);
      try {
        await awardRunRewards(10);
        await recordClearOnce();
      } catch (e) { console.error('[result] award rewards failed:', e && e.message ? e.message : e); }
      setGameState('CHAMPION');
      await submitRunScoreOnce();
      setResultProcessing(false);
    } else {
      setGameState('REWARD_PICK');
    }
  };

  // スロットで現在選べる固有技一覧(自分の固有技+合体で引き継いだ固有技)を返す。
  // 表示・選択UIとbuildDeckの両方から使う共通ロジック
  // 引き継いだ固有技の強化レベルを覚えておくキー。スロットの位置と何番目の引き継ぎ技かで決める
  const inhEvoKey = (slotIdx, inhIdx) => `${slotIdx}:${inhIdx}`;
  const getAvailableUniquesForSlot = (mon, cUniques, slotIdx, cInhEvo) => {
    if (!mon) return [];
    const own = (cUniques||ownedUniques).find(uq=>uq.monId===mon.id);
    const inherited = mon.inheritedUniques||[];
    // 引き継いだ固有技も自分の固有技と同じく、このランでの強化到達レベルを持たせる
    const evoMap = cInhEvo || inheritedUniqueEvo;
    return [
      ...(own?[{key:'own',unique:own}]:[]),
      ...inherited.map((iu,ii)=>({
        key:`inh${ii}`,
        inhIdx:ii,
        unique:{...iu, evoLevel: (slotIdx!=null && evoMap[inhEvoKey(slotIdx,ii)]!=null) ? evoMap[inhEvoKey(slotIdx,ii)] : (iu.evoLevel||0)},
      })),
    ];
  };
  const buildDeck = (currentSlots, aLvl, gLvl, cUniques, cTeachings, gBonus, uChoice, uLevelChoice, cInhEvo, heroOverride=null) => {
    const atkNames=HERO_ATK_NAMES[(heroOverride||mainHero)?.id]||HERO_ATK_NAMES['Mocchi'];
    let pool=[];
    pool.push({...BASE_ATK_EVOLUTION[aLvl],name:atkNames[aLvl],type:'atk',uid:Math.random()},{...BASE_ATK_EVOLUTION[aLvl],name:atkNames[aLvl],type:'atk',uid:Math.random()});
    for(let i=0;i<2+gBonus;i++) pool.push({...GUARD_EVOLUTION[gLvl],type:'guard',uid:Math.random()});
    currentSlots.forEach((s,idx)=>{
      if(s){
        const revo=RANGE_EVOLUTION[aLvl];
        // 距離撃は攻撃開始時の指定距離で最大威力になり、ダメージ確定後にその指定距離へ移動する。
        // 各モンスター自身が配置されたスロットの距離撃を取得する。適性は威力計算だけに使う。
        const rIdx=idx;
        pool.push({name:`${RANGE_LABELS[rIdx]}${revo.name}`,type:'range_atk',rangeIdx:rIdx,guts:revo.guts,baseGuts:revo.baseGuts,mult:revo.mult,baseMult:revo.baseMult,crit:revo.crit,icon:RANGE_LABELS[rIdx],uid:Math.random(),evoLevel:aLvl});
        const options=getAvailableUniquesForSlot(s,cUniques,idx,cInhEvo);
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
    const options=getAvailableUniquesForSlot(mon,ownedUniques,slotIdx);
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
    const options=getAvailableUniquesForSlot(mon,ownedUniques,slotIdx);
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
    const options=getAvailableUniquesForSlot(mon,ownedUniques,slotIdx);
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

  const spawnEnemy = useCallback((w, forcedEnemyKey=null, initialDistance=null) => {
    const newEnemy=createBattleEnemy(w,difficulty,forcedEnemyKey);
    if (!newEnemy) return null;
    if (!forcedEnemyKey && w>(highestWaves[difficulty]||0)) {
      setHighestWaves(prev=>({...prev,[difficulty]:w}));
      storeSet(`mh_highest_wave_${difficulty}`,w,false);
    }
    const dist=Number.isInteger(initialDistance)&&initialDistance>=0&&initialDistance<RANGE_LABELS.length
      ? initialDistance
      : Math.floor(Math.random()*4);
    setEnemy(newEnemy); setEnemyDist(dist); setEnemyIntent(getNextEnemyAction(newEnemy,dist));
    setTurnCount(1); setSelectedCards([]); setLastActionSlot(null); setCardAssignments({}); setPendingCard(null); setCurrentWaveDamage(0); setWaveDistDamage([0,0,0,0]); setWaveBuffs({}); // WAVE毎リセットのバフ・デバフ(waveEnemyAtkDebuff/chuuniDmgCutUses/enemyTakenDmgBonus等)を全てクリア
    return dist;
  }, [getNextEnemyAction, difficulty, highestWaves]);

  // defValは呼び出し元が直前に算出したばかりの丈夫さ(setDefで更新中の値)を明示的に渡すための引数。
  // handleReward等のsetTimeout内からdef(state)を直接読むと、同じ関数呼び出し内で行ったsetDefの
  // 結果がまだ反映されていない「一つ前のレンダーの値」を掴んでしまう(クロージャの陳腐化)ため、
  // 必ず呼び出し元が保持している最新のローカル値を渡す
  const initBattle = (w, s, u, t, defVal, forcedEnemyKey=null, heroForDeck=null) => {
    setWave(w);
    const currentSlots = s||slots;
    // 通常周回の初戦だけ、デッキ編成で勇者モンを置いた初期間合いから開始する。
    // 敵の選択・以降のWAVEの距離決定は従来どおりランダムのまま維持する。
    const selectedInitialDistance = w===1 && !forcedEnemyKey ? initialBattleDistanceRef.current : null;
    const dist = spawnEnemy(w, forcedEnemyKey, selectedInitialDistance);
    if (dist === null) return;
    const nAtkL = computeAtkTier(currentSlots, dist);
    const nGrdL = computeGuardLevel(defVal!==undefined?defVal:def);
    const nGB = nGrdL;
    setAtkLevel(nAtkL); setGuardLevel(nGrdL); setGuardBonusCount(nGB);
    const pool=buildDeck(currentSlots,nAtkL,nGrdL,u||ownedUniques,t||ownedTeachings,nGB,slotUniqueChoice,slotUniqueLevelChoice,inheritedUniqueEvo,heroForDeck);
    setHand(pool.slice(0,5)); setDeck(pool.slice(5)); setGraveyard([]); setGameState('BATTLE'); setIsBusy(false);
    setTurnBuffs({}); setNextTurnBuffs({}); // WAVE毎リセットの一時バフ・デバフを全てクリア
  };

  // 通常の敵順と敵定義の両方に存在するものだけを候補にする。敵名・能力値を複製せず、
  // 選択した難易度で通常生成に使う倍率もspawnEnemyへそのまま委ねる。
  const getDebugEnemyOptions = (diff) => DIFFICULTY_SETTINGS[diff]
    ? [...new Set(ENEMY_SEQUENCE)].map((key) => ({ key, wave: ENEMY_SEQUENCE.indexOf(key)+1, enemy: ENEMY_DATA[key] })).filter(item => item.enemy && item.enemy.name && item.enemy.baseHp > 0 && item.enemy.baseAtk >= 0)
    : [];

  const startDebugBattle = () => {
    const option = getDebugEnemyOptions(difficulty).find(item => item.key === debugEnemyKey);
    const party = getActiveMonsterList().slice(0, 4);
    if (!option || party.length === 0) return;
    const hero = party[0];
    const debugSlots = [party[0]||null, party[1]||null, party[2]||null, party[3]||null];
    const allies = debugSlots.slice(1).filter(Boolean);
    const total = (key, base) => allies.reduce((value, mon) => value + (mon.plusStats?.[key]||0), base);
    const debugMaxHp = total('hp', hero.baseHp);
    const debugAtk = total('atk', hero.baseAtk);
    const debugDef = total('def', hero.baseDef);
    const debugMaxGuts = total('guts', hero.baseGuts);
    const uniques = debugSlots.filter(Boolean).map(mon => ({...mon.unique,evoLevel:0}));
    const teachings = getActiveTeachingCards().map(card => ({...card,evoLevel:0,uid:Math.random()}));
    debugBattleRef.current = true;
    debugResultRef.current = false;
    setDebugBattle(true); setDebugOutcome(null); setGaveUp(false); setScore(0); setWaveHistory([]);
    setPermaBuffs({autoHpRecovery:0.1}); setWaveBuffs({}); setTurnBuffs({}); setNextTurnBuffs({});
    setDistDmgBonus([0,0,0,0]); setTotalDistDamage([0,0,0,0]); setTotalAllDamage(0); setTotalRecoveryDelta(0);
    setUpgradePoints(0); setAtkLevel(0); setGuardLevel(0); setGuardBonusCount(0); setFinalRewardSummary(null);
    setMainHero(hero); setSlots(debugSlots); setOwnedUniques(uniques); setOwnedTeachings(teachings);
    setMaxHp(debugMaxHp); setHp(debugMaxHp); setAtk(debugAtk); setDef(debugDef);
    setMaxGuts(debugMaxGuts); setGuts(Math.floor(debugMaxGuts*0.5));
    setDistAptBonus(allies.reduce((sum, mon) => sum.map((v,i)=>v+getMonsterAptDelta(mon)[i]), [0,0,0,0]));
    initBattle(option.wave, debugSlots, uniques, teachings, debugDef, option.key, hero);
  };

  const setupMon = (m, slotIdx) => {
    if (!m) return;
    const isHero=!mainHero; const nextSlots=[...slots]; nextSlots[slotIdx]={...m}; setSlots(nextSlots);
    if (!isHero) Audio_.se.join();
    if (isHero) {
      initialBattleDistanceRef.current=slotIdx;
      const initialUnique={...m.unique,evoLevel:Math.max(0,m.unique.evoLevel||0)};
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
      const newAllyUnique={...m.unique,evoLevel:Math.max(0,m.unique.evoLevel||0)}; setOwnedUniques([...ownedUniques,newAllyUnique]);
      setUpgradePoints(prev=>prev+(Math.floor(Math.random()*4)+1));
      setEffect({type:'mega',label:`${m.name}合流！`,icon:"🤝",monEmoji:m.emoji,imgUrl:m.imgUrl,baseId:m.id,colors:m.colors,subLabel:`HP:${bHp}→${nMaxHp}  ちから:${bAtk}→${nAtk}\n丈夫さ:${bDef}→${nDef}  ガッツ:${bGuts}→${nMaxGuts}${aptLabel?`\n間合い適性:${aptLabel}`:''}`});
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
    setTimeout(()=>{setOwnedTeachings(nextTeachings); if(!enemy) initBattle(1,slots,ownedUniques,nextTeachings,def); else initBattle(wave+1,slots,ownedUniques,nextTeachings,def); setSelectedTeachingCard(null);},150);
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
  // 合体で引き継いだ固有技の強化。自分の固有技(upgradeUnique)と同じポイントを使い、
  // 上げ下げの範囲・1回あたりの消費もまったく同じにしている
  const upgradeInheritedUnique = (slotIdx, inhIdx, diff) => {
    const key=inhEvoKey(slotIdx,inhIdx);
    const cur=inheritedUniqueEvo[key]||0;
    if(diff>0&&(upgradePoints<=0||cur>=8)) return;
    if(diff<0&&cur<=0) return;
    const nextEvo=Math.max(0,Math.min(8,cur+diff));
    setInheritedUniqueEvo(prev=>({...prev,[key]:nextEvo}));
    setUpgradePoints(p=>diff>0?p-1:p+1);
  };
  // 固有技の強化フェーズ(UPGRADE_SKILL)の1行分。自分の固有技と引き継いだ固有技で
  // 同じ見た目・同じ操作にするため、描画をここにまとめている
  const uniqueUpgradeRow = ({ rowKey, u, holderMon, inherited, onStep }) => {
    const ownerMon=ALL_PLAYER_MONSTERS[u.monId];
    const lvl=u.evoLevel||0;
    const currentMult=u.baseMult+(lvl*0.5); const nextMult=u.baseMult+((lvl+1)*0.5);
    const currentGuts=Math.floor(u.baseGuts*(currentMult/u.baseMult)); const nextGuts=Math.floor(u.baseGuts*(nextMult/u.baseMult));
    const curCrit=Math.round((0.10+0.05*Math.min(lvl,8))*100); const nextCrit=Math.round((0.10+0.05*Math.min(lvl+1,8))*100);
    // 引き継いだ技は「どのモンスターが使えるのか」と「元はどの血統の技か」の両方を出す
    const heading=inherited ? `${holderMon?.name||'？'} ← ${ownerMon?.name||'？'}の技` : (ownerMon?.name||'');
    return(
      <div key={rowKey} className={`p-3 rounded-2xl border shrink-0 ${inherited?'bg-cyan-950/40 border-cyan-700/60':'bg-slate-900 border-slate-800'}`}>
        <div className="flex items-center gap-3 mb-2">
          {ownerMon?.iconUrl?(<img src={ownerMon.iconUrl} alt={ownerMon.name} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"/>):(<span style={{fontSize:'30px'}}>{cardIconNode(u.icon,40)}</span>)}
          <div className="text-left flex-1">
            <div className={`text-[8px] font-black uppercase tracking-wider flex items-center gap-1 ${inherited?'text-cyan-300':'text-indigo-400'}`}>
              {inherited&&<span className="bg-cyan-600 text-white px-1 rounded-sm not-italic">引き継ぎ</span>}{heading}
            </div>
            <div className="font-black uppercase text-white" style={{fontSize:'13px'}}>{u.names[Math.min(lvl,u.names.length-1)]} <span className="text-slate-500">Lv.{lvl}{lvl<8&&<span className="text-amber-500"> → {lvl+1}</span>}</span></div>
            {lvl<8?(
              <div className="text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-0.5 mt-1" style={{fontSize:'9px'}}><div>技威力 {Math.floor(currentMult*100)} → <span className="text-red-400 font-bold">{Math.floor(nextMult*100)}</span></div><div>消費 {currentGuts} → <span className="text-amber-400 font-bold">{nextGuts}</span></div><div>会心 {curCrit}% → <span className="text-yellow-400 font-bold">{nextCrit}%</span></div></div>
            ):(
              <div className="text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-0.5 mt-1" style={{fontSize:'9px'}}><div>技威力 {Math.floor(currentMult*100)}</div><div>消費 {currentGuts}</div><div className="text-yellow-400">会心 {curCrit}%</div><div className="text-amber-500 font-black">MAX</div></div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
          <span className="text-slate-500 font-black uppercase tracking-wider" style={{fontSize:'9px'}}>レベル調整</span>
          <div className="flex items-center gap-3">
            <button disabled={lvl<=0} onClick={()=>onStep(-1)} className="w-9 h-9 flex items-center justify-center bg-slate-700 rounded-lg text-white disabled:opacity-20 active:scale-90"><MinusCircle size={18}/></button>
            <button disabled={upgradePoints<=0||lvl>=8} onClick={()=>onStep(1)} className={`w-9 h-9 flex items-center justify-center rounded-lg text-white disabled:opacity-20 active:scale-90 ${inherited?'bg-cyan-600':'bg-amber-600'}`}><PlusCircle size={18}/></button>
          </div>
        </div>
      </div>
    );
  };
  // 強化フェーズに並べる固有技の一覧。自分の固有技のあとに、合体で引き継いだ固有技を続ける
  const uniqueUpgradeEntries = () => {
    const rows=ownedUniques.map(u=>({ rowKey:`own:${u.monId}`, u, inherited:false, onStep:(d)=>upgradeUnique(u.monId,d) }));
    slots.forEach((mon,idx)=>{
      (mon?.inheritedUniques||[]).forEach((iu,ii)=>{
        const lvl=inheritedUniqueEvo[inhEvoKey(idx,ii)]||0;
        rows.push({ rowKey:`inh:${idx}:${ii}`, u:{...iu, evoLevel:lvl}, holderMon:mon, inherited:true, onStep:(d)=>upgradeInheritedUnique(idx,ii,d) });
      });
    });
    return rows;
  };

  // ブリーダーカードの効果説明。表記は全カードで次のルールに統一している。
  //  ・区切りは中黒「・」だけを使う(以前は「＆」「＋」「/」「()」が混在していた)
  //  ・増減は「アップ」「ダウン」と書く(以前は「UP」「DOWN」「+」が混在していた)
  //  ・ステータス名は画面表記に合わせて「ライフ」「ガッツ」「攻撃」に統一する
  //    (以前は「HP」「G」「攻」など略称が混在していた)
  //  ・数値と単位の間は詰め、項目名と数値の間は半角スペースを入れる
  const getDynamicDesc = (t, isOwned, level) => {
    // 0.5%のような小数の効果量があるため、小数第1位まで残す(整数のときは「1」「10」と表示する)
    const pct=(v)=>String(Math.round(v*1000)/10);
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
  // モンスター詳細の情報部分。編成・ベースモン一覧・マスモン一覧・勇者モン選択のどこから開いても
  // 同じ内容(基本ステータス・勇者特性・合流ボーナス・間合い適性・技)が見られるよう1か所へまとめる。
  // 以前は画面ごとに別々のJSXで組んでいたため、勇者特性が勇者モン選択でしか見られない等の差があった。
  // 画面ごとの操作(強化ポイントの割り振りなど)は、呼び出し側が statValues / aptExtra / aptPointsLabel で足す。
  const renderMonsterDetailInfo = (mon, opts = {}) => {
    if (!mon) return null;
    const { statTitle = '基本ステータス', statValues = null, aptExtra = null, aptPointsLabel = null, extraAfterApt = null } = opts;
    const plus = mon.plusStats || {};
    const rows = statValues || [
      ['ライフ', mon.baseHp, 'text-pink-400'],
      ['ちから', mon.baseAtk, 'text-red-400'],
      ['丈夫さ', mon.baseDef, 'text-emerald-400'],
      ['ガッツ', mon.baseGuts, 'text-amber-400'],
    ];
    const joinBonus = [plus.hp>0&&`HP+${plus.hp}`, plus.atk>0&&`攻+${plus.atk}`, plus.def>0&&`防+${plus.def}`, plus.guts>0&&`G+${plus.guts}`].filter(Boolean).join(' ');
    const aptBonus = formatAptBonus(mon);
    return (<>
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <div className="bg-black/40 p-2 rounded-xl border border-white/5"><div className="text-[7px] text-slate-500 uppercase font-bold">{statTitle}</div><div className="space-y-1 mt-1">{rows.map(([label,value,color])=><div key={label} className="flex justify-between text-[10px] font-mono"><span>{label}:</span><span className={`${color} font-bold`}>{value}</span></div>)}</div></div>
        <div className="bg-black/40 p-2 rounded-xl border border-indigo-500/30"><div className="text-[7px] text-indigo-400 uppercase font-bold">勇者特性</div>{mon.trait&&<div className="text-[8px] text-indigo-300 font-black mt-0.5">{mon.trait}</div>}<div className="text-[9px] text-white font-bold leading-tight mt-1">{mon.traitDesc||'特性なし'}</div></div>
      </div>
      <div className="bg-black/40 p-2 rounded-xl border border-pink-500/30"><div className="text-[7px] text-pink-400 uppercase font-bold">合流ボーナス</div><div className="text-[8px] text-white font-bold mt-1">{joinBonus||'なし'}</div>{aptBonus&&<div className="text-[8px] text-cyan-300 font-bold mt-0.5">間合い適性 {aptBonus}</div>}</div>
      <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/30"><div className="flex items-center justify-between mb-0.5"><div className="text-[7px] text-cyan-400 uppercase font-bold">間合い適性</div>{aptPointsLabel}</div><div className="grid grid-cols-4 gap-1 mt-1">{RANGE_LABELS.map((label,idx)=>{const grade=getDistAptitude(mon,idx); return(<div key={idx} className="flex flex-col items-center gap-0.5"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span><span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[grade]}`}>{grade}</span>{aptExtra?aptExtra(idx,grade):null}</div>);})}</div></div>
      {extraAfterApt}
      {renderSkillSection(mon)}
    </>);
  };
  const renderSkillSection = (mon) => { const currentUnique=uniqueSkillAtLevel(mon.unique, mon.unique?.evoLevel); return (<>
    <button onClick={()=>setRosterSkillDetail({mon,kind:'atk'})} className="w-full text-left bg-slate-800/50 p-3 rounded-2xl border border-white/10 shrink-0 active:scale-95 transition-all"><div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1"><div className="flex items-center gap-2"><Sword size={12} className="text-red-400"/><span className="text-[10px] font-black uppercase">通常技: {(HERO_ATK_NAMES[mon.id]||HERO_ATK_NAMES['Mocchi'])[0]}</span></div><ChevronRight size={12} className="text-slate-500"/></div><div className="flex gap-4 text-[9px] font-mono"><span className="text-red-400 font-bold">技威力 {Math.floor(BASE_ATK_EVOLUTION[0].mult*100)}</span><span className="text-amber-400 font-bold">消費G {BASE_ATK_EVOLUTION[0].baseGuts}</span></div></button>
    <button onClick={()=>setRosterSkillDetail({mon,kind:'unique'})} className="w-full text-left bg-slate-800/50 p-3 rounded-2xl border border-white/10 shrink-0 active:scale-95 transition-all"><div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1"><div className="flex items-center gap-2"><Zap size={12} className="text-amber-400"/><span className="text-[10px] font-black uppercase">固有技 Lv.{currentUnique.evoLevel}: {currentUnique.name}</span></div><ChevronRight size={12} className="text-slate-500"/></div><div className="flex gap-3 text-[9px] font-mono mb-2"><span className="text-red-400 font-bold">技威力 {Math.floor(currentUnique.mult*100)}</span><span className="text-yellow-400 font-bold">会心率 {Math.round(currentUnique.crit*100)}%</span><span className="text-amber-400 font-bold">消費G {currentUnique.guts}</span></div><div className="text-[9px] text-slate-300 leading-relaxed italic">"{currentUnique.effectDesc}"</div></button>
  </>); };


  const pct = Math.round((bootProgress.done / Math.max(1, bootProgress.total)) * 100);
  // body直下へ描画し、各画面のoverflow・transform・モーダルの積層に隠されないようにする。
  // 新しいバージョンの通知。本体を押すと更新、×を押すと今回は閉じる(更新はしない)。
  // 閉じたバージョンを覚えておき、同じバージョンのあいだは出さない。
  const updateNoticeVisible = updateAvailable && (!latestBuild || latestBuild !== dismissedUpdateBuild);
  const updateNotice = updateNoticeVisible ? ReactDOM.createPortal(
    <div aria-live="assertive" className="fixed z-[100000] left-3 right-3 flex items-stretch gap-1.5" style={{top:'calc(8px + env(safe-area-inset-top))'}}>
      <button type="button" onClick={reloadLatestVersion} className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl border border-amber-200/80 bg-amber-500 text-slate-950 font-black text-sm shadow-[0_8px_28px_rgba(0,0,0,0.55)] active:scale-[.98]"><RefreshCcw size={18}/><span>新しいバージョンがあります　更新する</span></button>
      <button type="button" aria-label="あとで更新する（この通知を閉じる）" onClick={()=>setDismissedUpdateBuild(latestBuild||BUILD_DATE)} className="shrink-0 w-12 min-h-[48px] flex items-center justify-center rounded-2xl border border-amber-200/80 bg-amber-500/90 text-slate-950 shadow-[0_8px_28px_rgba(0,0,0,0.55)] active:scale-[.98]"><X size={18}/></button>
    </div>,
    document.body
  ) : null;
  const titleModal = showChangelog ? (
    <div className="mh-title-modal" onPointerDown={e=>e.stopPropagation()}>
      <div className="mh-title-dialog"><div className="mh-dialog-head"><h3>✦ 更新履歴</h3><button onClick={closeChangelog}><X size={18}/></button></div>
        <div className="mh-changelog-tabs">{[{key:'update',label:'更新情報'},{key:'issue',label:'不具合情報'}].map(t=><button key={t.key} onClick={()=>selectChangelogTab(t.key)} className={changelogTab===t.key?'active':''}>{t.label}{changelogUnread[t.key]&&<em className="mh-unread-badge" aria-label="未読あり">!</em>}</button>)}</div>
        <div className="mh-changelog-list">{CHANGELOG_ENTRIES.filter(c=>c.type===changelogTab).map(c=><article key={c.id} className={changelogUnreadIds[changelogTab].includes(c.id)?'unread':''}><time>{c.date}{changelogUnreadIds[changelogTab].includes(c.id)&&<em>NEW</em>}</time><b>{c.title}</b>{(c.items||[]).map((x,j)=><p key={j}>・{x}</p>)}</article>)}</div>
      </div>
    </div>
  ) : showTitleSettings ? (
    <div className="mh-title-modal" onPointerDown={e=>e.stopPropagation()}><div className="mh-title-dialog"><div className="mh-dialog-head"><h3>設定</h3><button onClick={()=>setShowTitleSettings(false)}><X size={18}/></button></div><button className="mh-dialog-choice" onClick={()=>{setShowTitleSettings(false);setShowAudioSettings(true)}}>🔊 音量設定 <ChevronRight size={18}/></button><button className="mh-dialog-choice" onClick={()=>{setShowTitleSettings(false);setShowBgmArrangement(true)}}>🎼 BGMアレンジ <ChevronRight size={18}/></button><button className="mh-dialog-choice" onClick={()=>{setShowTitleSettings(false);setShowBackup(true)}}>🛡️ データ引き継ぎ <ChevronRight size={18}/></button></div></div>
  ) : showAudioSettings ? (
    <div className="mh-title-modal"><div className="mh-title-dialog"><div className="mh-dialog-head"><h3>音量設定</h3><button onClick={()=>setShowAudioSettings(false)}><X size={18}/></button></div><button className="mh-dialog-choice" onClick={toggleQuickMute}>{audioMuted?'🔇 音がオフです':'🔊 音はオンです'}</button><VolumeSlider label="SE" icon="🔔" value={seVolume} onChange={changeSeVolume} gradient="from-cyan-500 to-indigo-500" thumbRing="border-indigo-400"/><VolumeSlider label="BGM" icon="🎵" value={bgmVolume} onChange={changeBgmVolume} gradient="from-fuchsia-500 to-pink-500" thumbRing="border-fuchsia-400"/></div></div>
  ) : showBgmArrangement ? (
    <div className="mh-title-modal"><div className="mh-title-dialog" style={{maxHeight:'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)',overflowY:'auto'}}><div className="mh-dialog-head"><h3>BGMアレンジ</h3><button onClick={closeBgmArrangement}><X size={18}/></button></div><div className="space-y-4">{[
      ['home','HOME BGM'],['management','M/B管理 BGM'],['market','マーケット BGM'],['temple','神殿 BGM'],['trainingMenu','修行メニュー BGM'],['trainingBoard','修行中 BGM'],['battle','通常バトル BGM'],['boss','ボスバトル BGM'],['clear','ゲームクリア BGM']
    ].map(([scene,label])=><label key={scene} className="block text-left"><span className="text-xs font-black text-slate-300">{label}</span><div className="flex gap-2 mt-1"><select aria-label={label} value={bgmArrangement[scene]} onChange={e=>changeBgmArrangement(scene,e.target.value)} className="min-w-0 flex-1 bg-slate-950 border border-white/15 rounded-xl px-2 py-3 text-xs text-white">{BGM_TRACKS.map(track=><option key={track.id} value={track.id}>{track.name}</option>)}</select><button type="button" aria-label={`${label}を試聴`} onClick={()=>toggleBgmPreview(bgmArrangement[scene])} className="shrink-0 min-w-[58px] rounded-xl bg-indigo-700 px-2 text-xs font-black">{previewTrackId===bgmArrangement[scene]?'停止':'試聴'}</button></div></label>)}</div><button className="mh-dialog-choice mt-4" onClick={()=>setBgmArrangement({...DEFAULT_BGM_ARRANGEMENT})}>デフォルトに戻す</button></div></div>
  ) : showBackup ? (
    <div className="mh-title-modal"><div className="mh-title-dialog"><div className="mh-dialog-head"><h3>データ引き継ぎ</h3><button onClick={()=>setShowBackup(false)}><X size={18}/></button></div><div className="mh-changelog-tabs"><button className={backupTab==='export'?'active':''} onClick={()=>setBackupTab('export')}>バックアップ</button><button className={backupTab==='import'?'active':''} onClick={()=>setBackupTab('import')}>復元</button></div>{backupTab==='export'?<>{backupCode&&<textarea readOnly value={backupCode}/>}<button className="mh-dialog-choice" onClick={generateBackupCode}>バックアップコードを作成</button></>:<><textarea value={restoreInput} onChange={e=>setRestoreInput(e.target.value)} placeholder="バックアップコードを貼り付け"/><button className="mh-dialog-choice" onClick={restoreFromBackupCode}>このコードで復元する</button></>}{restoreMsg&&<p>{restoreMsg}</p>}</div></div>
  ) : null;

  if (bootPhase === 'LOADING' || bootPhase === 'ENTRY_READY') return (
    <><main className={`mh-boot-screen ${bootPhase==='ENTRY_READY'?'is-ready':''} ${entryAnimating?'is-entering':''}`}>
      <div className="mh-boot-stars" aria-hidden="true"></div><div className="mh-mocchi-wrap"><img src={MOCCHI_IMG} alt="モッチー"/><span></span><i>✦</i><i>✧</i></div>
      <section className="mh-boot-copy">{bootPhase==='LOADING'?<><h1>NOW LOADING</h1><h2>冒険の準備をしています</h2><div className="mh-progress"><span style={{width:`${pct}%`}}></span></div><strong>{pct}%</strong><p>{bootProgress.label}</p></>:<><h1>READY</h1><button disabled={entryAnimating} onPointerDown={unlockBootSound}>TAP TO START</button><h2>― 冒険の扉を開く ―</h2><p>追加データはバックグラウンドで読み込みを続けます</p></>}</section>
      <footer>VERSION {BUILD_DATE}</footer><div className="mh-entry-flash"></div>
    </main>{updateNotice}</>
  );
  const rankingPlace = index => <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[9px] shrink-0 ${index===0?'bg-amber-500 text-black':index===1?'bg-slate-300 text-black':index===2?'bg-orange-600 text-white':'bg-slate-800 text-slate-400'}`}>{index+1}</div>;
  const rankingBreederIcon = entry => resolveIconUrl(entry?.icon)?<img src={resolveIconUrl(entry.icon)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0"/>:<div className="w-8 h-8 rounded-full bg-slate-800 shrink-0 flex items-center justify-center text-xs">👤</div>;
  const rankingCardClass = index => `rounded-xl border ${index===0?'bg-amber-500/10 border-amber-500/50':'bg-slate-900 border-white/5'}`;
  // スコア専用カード。編成表示と勇者モン重複防止はこのカードだけが担当する。
  const renderScoreRankingEntry = (entry, index) => {
    const separatedParty = splitRankingParty(entry);
    const heroMember = separatedParty.hero;
    const allies = separatedParty.allies;
    const finiteNumber = value => value==null || value==='' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
    const scoreValue = finiteNumber(entry?.score);
    const breederLevelValue = finiteNumber(entry?.level);
    const scoreLabel = Number.isFinite(scoreValue) ? `${scoreValue.toLocaleString()} pt` : 'スコア情報なし';
    const breederLevelLabel = Number.isFinite(breederLevelValue) && breederLevelValue>0 ? `ブリーダーLv.${breederLevelValue}` : 'ブリーダーLv情報なし';
    const heroName = entry?.hero || heroMember?.name || '勇者モン情報なし';
    return (
      <article key={`score-${entry?.userName||'unknown'}-${index}`} data-ranking-kind="score" className={`${rankingCardClass(index)} px-2 py-1.5`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {rankingPlace(index)}{rankingBreederIcon(entry)}
          <div className="flex flex-1 items-baseline gap-1 min-w-0"><span className="text-[10px] font-black text-white truncate">{entry?.userName||'名無しのブリーダー'}</span><span className="text-[7px] text-indigo-300 whitespace-nowrap shrink-0">{breederLevelLabel}</span></div>
          <div className="text-right text-[10px] font-black whitespace-nowrap text-indigo-300">{scoreLabel}</div>
        </div>
        <div className="mt-1 bg-black/40 rounded-lg px-1.5 py-1 border border-white/5">
          <div className="flex items-center gap-1 min-w-0 leading-none">
            <Crown size={9} className="text-amber-400 shrink-0"/><span className="text-[8px] text-amber-300 shrink-0">勇者モン:</span>
            {rankingMemberImage(heroMember)?<img src={rankingMemberImage(heroMember)} alt={heroName} className="w-5 h-5 object-contain shrink-0"/>:<span className="w-5 text-center text-[9px] shrink-0">{heroMember?.emoji||'❓'}</span>}
            <span className="text-[9px] font-black text-white truncate">{heroName}</span>
            {rankingMemberLevel(heroMember)!=null&&<span className="text-[7px] font-black text-pink-300 whitespace-nowrap shrink-0">Lv.{rankingMemberLevel(heroMember)}</span>}
          </div>
          {allies===null?<div className="mt-0.5 text-[7px] text-slate-500">編成情報なし（過去の記録）</div>:allies.length===0?<div className="mt-0.5 text-[7px] text-slate-500">供モンなし</div>:<div className="flex items-center gap-1 mt-0.5 min-w-0"><span className="text-[7px] text-slate-500 shrink-0">供モン:</span>{allies.slice(0,3).map((member, memberIndex)=><div key={member?.masuId||`${member?.id||'ally'}-${memberIndex}`} className="flex flex-1 items-center justify-center gap-0.5 min-w-0">{rankingMemberImage(member)?<img src={rankingMemberImage(member)} alt="" className="w-4 h-4 object-contain shrink-0"/>:<span className="w-4 text-center text-[8px] shrink-0">{member?.emoji||'❓'}</span>}<span className="text-[7px] text-slate-300 truncate">{member?.name||'不明'}</span>{rankingMemberLevel(member)!=null&&<span className="text-[7px] font-black text-pink-300 whitespace-nowrap shrink-0">Lv.{rankingMemberLevel(member)}</span>}</div>)}</div>}
        </div>
      </article>
    );
  };
  // ブリーダーLv専用カード。編成・スコア・絆情報をDOMへ一切出さず、1行でコンパクトに表示する。
  const renderBreederRankingEntry = (entry, index) => {
    const level = Number(entry?.level);
    return <article key={`breeder-${entry?.userName||'unknown'}-${index}`} data-ranking-kind="breeder" className={`${rankingCardClass(index)} px-2 py-2 flex items-center gap-2 min-w-0`}>{rankingPlace(index)}{rankingBreederIcon(entry)}<b className="flex-1 min-w-0 truncate text-[11px]">{entry?.userName||'名無しのブリーダー'}</b><strong className="shrink-0 text-xs text-indigo-300">{Number.isFinite(level)&&level>0?`ブリーダーLv.${level}`:'Lv情報なし'}</strong></article>;
  };
  // 絆Lv専用カード。スコアや編成・役割は表示せず、ブリーダーと個体だけを表示する。
  const renderBondRankingEntry = (entry, index) => {
    const level = Number(entry?.bondLevel);
    return <article key={`bond-${entry?.userName||'unknown'}-${entry?.masuId||entry?.monsterId||entry?.monName}-${index}`} data-ranking-kind="bond" className={`${rankingCardClass(index)} p-2`}><div className="grid grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-2 min-w-0">{rankingPlace(index)}{rankingBreederIcon(entry)}<b className="truncate text-[10px]">{entry?.userName||'名無しのブリーダー'}</b><strong className="text-xs text-pink-300 whitespace-nowrap">絆Lv.{level}</strong></div><div className="ml-[76px] mt-1 flex items-center gap-2 min-w-0 rounded-lg bg-black/35 px-2 py-1">{entry?.imgUrl?<img src={entry.imgUrl} alt="" className="w-7 h-7 object-contain shrink-0"/>:<span className="w-7 text-center shrink-0">{entry?.emoji||'❓'}</span>}<b className="truncate text-[10px]">{entry.monName}</b></div></article>;
  };
  if (bootPhase === 'TITLE') return (
    <><main className="mh-title-gate" aria-label="Monster Hero タイトル画面">
      <img className="mh-title-visual" src="data/images/title-screen-clean.PNG" alt="モンスターヒーロー グランドチャンピオンクエスト"/>
      <header className="mh-title-header"><div className="mh-title-build"><b>VERSION</b><span>{BUILD_DATE}</span><b>PLAYER ID</b><span>{titlePlayerId}</span></div><div className="mh-title-actions"><button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();openChangelog()}}><Sparkles size={19}/><span>お知らせ</span>{hasUnreadChangelog&&<em>NEW</em>}</button><button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setShowTitleSettings(true)}}><Settings size={19}/><span>設定</span></button></div></header>
      <button type="button" className="mh-title-start" disabled={!!titleModal || titleStarting} onPointerDown={startGame} aria-label="トップ画面へ進む"></button>{titleModal}
    </main>{updateNotice}</>
  );
  if (bootPhase === 'ENTERING_GAME') return <><main className="mh-entering"><img src="data/images/title-screen-clean.PNG" alt=""/><div className="mh-gate-core"></div><div className="mh-gate-particles"></div><div className="mh-gate-flash"></div>{enteringSlow&&<p>世界を構築しています…</p>}</main>{updateNotice}</>;

  return (
    <div onPointerDown={(e)=>{const rect=e.currentTarget.getBoundingClientRect(); spawnRipple(e.clientX-rect.left, e.clientY-rect.top);}} className="h-full w-full bg-slate-950 text-white overflow-hidden relative select-none font-sans" style={{height:'100%'}}>
      {updateNotice}
      <div className="relative z-10 h-full flex flex-col" style={screenShake?{animation:bigShake?'mooQuake 750ms ease-in-out':'screenShake 450ms ease-in-out'}:undefined}>

        {gameState==='ONBOARDING'&&(()=>{const introPages=[{title:'ゲームの目的',icon:'🏆',text:'勇者モンと全10 WAVEを進み、ラスボス「ムー」の撃破と最高スコアを目指します。'},{title:'バトルの基本',icon:'⚔️',text:'カードを選び、モンスターへ割り当てて攻撃・防御します。間合いとガッツが勝負の鍵です。'},{title:'育成・編成',icon:'✨',text:'勇者モンを育て、供モンやブリーダーカードを編成して自分だけのチームを作れます。'}];const introIndex=Number(onboardingStep.split('-')[1]||0);return <main className="flex-1 min-h-0 flex flex-col p-5 text-center" style={{paddingTop:'calc(2rem + env(safe-area-inset-top))',paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}><div className="text-[10px] tracking-[.25em] text-indigo-300 font-black">WELCOME TO MONSTER HERO</div>{onboardingStep.startsWith('intro-')&&<><section className="flex-1 flex flex-col items-center justify-center"><div className="text-7xl mb-6">{introPages[introIndex].icon}</div><h1 className="text-2xl font-black text-indigo-200">{introPages[introIndex].title}</h1><p className="mt-4 max-w-xs text-sm leading-7 text-slate-300">{introPages[introIndex].text}</p><div className="flex gap-2 mt-8">{introPages.map((_,i)=><i key={i} className={`w-2 h-2 rounded-full ${i===introIndex?'bg-indigo-300':'bg-slate-700'}`}/>)}</div></section><footer className="grid grid-cols-2 gap-3"><button disabled={introIndex===0} onClick={()=>moveOnboarding(`intro-${introIndex-1}`)} className="min-h-[50px] rounded-2xl bg-slate-800 font-black disabled:opacity-30">戻る</button><button onClick={()=>moveOnboarding(introIndex===2?'name':`intro-${introIndex+1}`)} className="min-h-[50px] rounded-2xl bg-indigo-600 font-black">次へ</button></footer></>}{onboardingStep==='name'&&<><section className="flex-1 flex flex-col justify-center"><h1 className="text-2xl font-black">プレイヤーネーム</h1><p className="text-xs text-slate-400 mt-2">10文字まで・前後の空白は保存時に除去します</p><input autoFocus maxLength={10} value={onboardingName} onChange={e=>setOnboardingName(e.target.value)} className="mt-8 w-full rounded-2xl border-2 border-indigo-500 bg-black/50 p-4 text-center text-lg font-black"/></section><footer className="grid grid-cols-2 gap-3"><button onClick={()=>moveOnboarding('intro-2')} className="min-h-[50px] rounded-2xl bg-slate-800 font-black">戻る</button><button disabled={!onboardingName.trim()} onClick={()=>moveOnboarding('icon')} className="min-h-[50px] rounded-2xl bg-indigo-600 font-black disabled:opacity-30">次へ</button></footer></>}{onboardingStep==='icon'&&<><section className="flex-1 min-h-0 flex flex-col justify-center"><h1 className="text-2xl font-black">プレイヤーアイコン</h1><div className="grid grid-cols-4 gap-3 mt-7">{STARTER_MONSTER_IDS.map(id=>ALL_PLAYER_MONSTERS[id]).map(m=><button key={m.id} onClick={()=>setOnboardingIcon(m.id)} className={`aspect-square rounded-2xl overflow-hidden border-2 ${onboardingIcon===m.id?'border-amber-300 ring-4 ring-amber-300/30 scale-105':'border-slate-700'}`}><img src={m.faceIconUrl||m.iconUrl} alt={m.name} className="w-full h-full object-cover"/></button>)}</div></section><footer className="grid grid-cols-2 gap-3"><button onClick={()=>moveOnboarding('name')} className="min-h-[50px] rounded-2xl bg-slate-800 font-black">戻る</button><button disabled={!onboardingIcon} onClick={()=>moveOnboarding('confirm')} className="min-h-[50px] rounded-2xl bg-indigo-600 font-black disabled:opacity-30">確認へ</button></footer></>}{onboardingStep==='confirm'&&<><section className="flex-1 flex flex-col items-center justify-center"><h1 className="text-2xl font-black">設定内容確認</h1>{resolveIconUrl(onboardingIcon)&&<img src={resolveIconUrl(onboardingIcon)} alt="選択アイコン" className="w-28 h-28 object-cover rounded-full border-4 border-amber-300 mt-7"/>}<b className="text-xl mt-4">{onboardingName.trim()}</b><p className="text-xs text-slate-400 mt-3">保存後、ゲームを開始します</p></section><footer className="grid grid-cols-2 gap-3"><button onClick={()=>moveOnboarding('icon')} className="min-h-[50px] rounded-2xl bg-slate-800 font-black">戻る</button><button disabled={!onboardingName.trim()||!onboardingIcon} onClick={finishOnboarding} className="min-h-[50px] rounded-2xl bg-emerald-600 font-black disabled:opacity-30">保存して開始</button></footer></>}</main>})()}

        {/* HOME: 背景・将来のマスモン・施設操作・情報UIの順に重ねる */}
        {gameState==='HOME'&&(
          <main className="mh-home-scene" aria-label="村の広場">
            <picture className={`mh-home-background ${homeBackgroundReady?'is-ready':''}`} aria-hidden="true"><img src="data/images/home-background.png" alt=""/></picture>
            <div className="mh-home-masumon-layer" aria-hidden="true">{homePastureMasumons.map((masu,index)=><HomeWalkingMasumon key={masu.id} masu={masu} base={ALL_PLAYER_MONSTERS[masu.baseId]} masuColors={getMasuColors(masu)} index={index} count={homePastureMasumons.length}/>)}</div>
            <header className="mh-home-status">
              <button type="button" className="mh-home-player" onClick={()=>setGameState('PROFILE')} aria-label="プロフィールを開く">
                <div className="mh-home-avatar">{resolveIconUrl(breederIcon)?<img src={resolveIconUrl(breederIcon)} alt="プロフィール画像"/>:<User size={24}/>}</div>
                <div className="mh-home-player-copy"><strong>{breederName}</strong><span>ブリーダー Lv.{breederLevel.level}</span><div className="mh-home-xp"><i style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></i></div><small>{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</small></div>
                <ChevronRight className="mh-home-profile-arrow" size={15}/>
              </button>
              <section className="mh-home-wallet">
                <div><Gem size={14}/><b>{gold.toLocaleString()}</b><small>ダイヤ</small></div><div><Coins size={14}/><b>{breederPoints}</b><small>pt</small></div>
                <button onClick={()=>setGameState('SETTINGS')} aria-label="設定"><Settings size={20}/><span>設定</span></button>
              </section>
            </header>
            <nav className="mh-home-facilities" aria-label="拠点施設">
              <button className="mh-home-facility management" onClick={()=>{setManagementTab('monster');setGameState('MB_MANAGEMENT');}} aria-label="M/B管理"><span><Layers size={18}/>M/B管理</span></button>
              <button className="mh-home-facility temple" onClick={()=>setGameState('TEMPLE')} aria-label="神殿"><span><Sparkles size={18}/>神殿</span></button>
              <button className="mh-home-facility market" onClick={()=>setGameState('BREEDER_MARKET')} aria-label="マーケット"><span><ShoppingBag size={17}/>マーケット</span></button>
              <button className="mh-home-facility training" onClick={openTrainingInfo} aria-label="修行（準備中）"><span>🎲 修行<small>準備中</small></span></button>
              <button className="mh-home-facility battle" onClick={()=>{setBattleMenuTab('difficulty');setGameState('BATTLE_MENU');}} aria-label="バトル"><span><Sword size={25}/>バトル</span></button>
            </nav>
            <button onClick={openMissions} className="mh-home-mission"><List size={16}/>ミッション
              {missionClaimableCount(normalizeMissions(missions))>0&&<em>{missionClaimableCount(normalizeMissions(missions))}</em>}
            </button>
            <button onClick={openGiftBox} className="mh-home-gift"><Package size={16}/>ギフト
              {giftClaimableCount(gifts)>0&&<em>{giftClaimableCount(gifts)}</em>}
            </button>
            <button onClick={openChangelog} className="mh-home-update"><RefreshCcw size={15}/>更新履歴{hasUnreadChangelog&&<em className="mh-unread-badge" aria-label="未読あり">!</em>}</button>
          </main>
        )}

        {gameState==='TRAINING_INFO'&&<main className="mh-training-screen"><header className="mh-training-head"><button onClick={returnToHome}><ArrowLeft/></button><div><small>COMING SOON</small><h2>修行</h2></div><i/></header><section className="mh-training-confirm"><div className="text-6xl text-center my-6">🎲</div><h3>修行は準備中です</h3><p>マスモンとすごろく形式のマップを進み、さまざまなマス効果や修行道具を使ってゴールを目指す予定です。</p><div className="mh-training-ticket"><b>正式実装前のお知らせ</b><small>通常プレイから修行本編は開始できません。修行チケットの消費、報酬の付与、進行状況の保存も行いません。</small></div></section><footer className="mh-training-footer"><button onClick={returnToHome}>HOMEへ戻る</button></footer></main>}

        {gameState==='TRAINING_SELECT'&&(()=>{const selected=masuMons.find(m=>String(m.id)===String(trainingSelectedId));return <main className="mh-training-screen"><div className="mh-debug-banner">DEBUG・報酬や進行状況は保存されません</div><header className="mh-training-head"><button onClick={()=>setGameState('DEBUG_SETTINGS')}><ArrowLeft/></button><div><small>TRAINING TEST</small><h2>所持マスモン選択</h2></div><i/></header>{selected&&<section className="mh-training-selected"><DyedMonsterImage baseId={selected.baseId} src={ALL_PLAYER_MONSTERS[selected.baseId]?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)}/><div><b>{selected.name}</b><span>絆Lv.{bondLevelInfo(selected.bondXp||0).level}</span></div></section>}<p className="mh-training-note">デバッグ修行に参加する所持マスモンを1体選択してください。</p><div className="mh-training-mon-list">{masuMons.map(m=><button key={m.id} className={String(m.id)===String(trainingSelectedId)?'active':''} onClick={()=>setTrainingSelectedId(m.id)}><DyedMonsterImage baseId={m.baseId} src={ALL_PLAYER_MONSTERS[m.baseId]?.iconUrl} alt={m.name} masuColors={getMasuColors(m)}/><b>{m.name}</b><small>絆Lv.{bondLevelInfo(m.bondXp||0).level}</small></button>)}</div><footer className="mh-training-footer"><button disabled={!selected} onClick={()=>setGameState('TRAINING_DIFFICULTY')}>難易度選択へ</button></footer></main>})()}

        {gameState==='TRAINING_DIFFICULTY'&&<main className="mh-training-screen"><div className="mh-debug-banner">DEBUG・報酬や進行状況は保存されません</div><header className="mh-training-head"><button onClick={()=>setGameState('TRAINING_SELECT')}><ArrowLeft/></button><div><small>TRAINING TEST</small><h2>難易度選択</h2></div><i/></header><div className="mh-training-difficulties">{Object.values(TRAINING_DIFFICULTIES).map(d=><button key={d.id} className={`${trainingDifficulty===d.id?'active':''} ${d.available?'':'soon'}`} onClick={()=>setTrainingDifficulty(d.id)}><div><b>{d.label}</b><em>{d.available?'テスト可能':'準備中'}</em></div><p>{d.summary}</p><dl><span>{d.turns}ターン</span><span>🎲 {d.dice[0]}～{d.dice[1]}</span><span>約{d.spaces}マス</span></dl></button>)}</div><footer className="mh-training-footer"><button disabled={trainingDifficulty!=='BEGINNER'} onClick={()=>setGameState('TRAINING_CONFIRM')}>{trainingDifficulty==='BEGINNER'?'マップとルール確認へ':'説明のみ・準備中'}</button></footer></main>}

        {gameState==='TRAINING_CONFIRM'&&<main className="mh-training-screen"><div className="mh-debug-banner">DEBUG・報酬や進行状況は保存されません</div><header className="mh-training-head"><button onClick={()=>setGameState('TRAINING_DIFFICULTY')}><ArrowLeft/></button><div><small>BEGINNER</small><h2>マップとルール確認</h2></div><i/></header><section className="mh-training-confirm"><h3>BEGINNER 試作マップ</h3><p>24マス / 10ターン / サイコロ1～3。3か所の分岐で短い安全ルートと遠回りの報酬ルートを選び、再合流してゴールを目指します。</p><h4>移動ルール</h4><p>サイコロ後は出目ぶん1マスずつ自動で進みます。操作が必要なのは、移動中に分岐へ着いた時の進行方向だけです。ゴールは到達または通過で成功。前進・後退は最終停止マスだけ発動し、強制移動は1ターン3回までです。</p><button className="mh-rule-button" onClick={()=>setTrainingModal({type:'rules'})}>マス一覧／ルール・全道具を見る</button><div className="mh-training-ticket"><b>デバッグ専用</b><small>チケット・通常データ・報酬・ミッション・ランキング・実績には一切反映しません。</small></div></section><footer className="mh-training-footer"><button onClick={startTraining}>BEGINNER 修行開始</button></footer></main>}

        {gameState==='TRAINING_BOARD'&&trainingSession&&(()=>{const m=masuMons.find(x=>String(x.id)===String(trainingSession.masuId));const current=TRAINING_NODE_BY_ID[trainingSession.position];const highlighted=new Set([current.id,...trainingSession.routePreview,...trainingSession.branchOptions]);return <main className="mh-training-board">{trainingEffect&&<div className={`mh-training-effect ${trainingEffect.kind}`} aria-live="polite"><span>{trainingEffect.emoji}</span><b>{trainingEffect.text}</b><i/><i/><i/><i/><i/><i/></div>}{trainingDiceStage!=='idle'&&<div className={`mh-dice-overlay ${trainingDiceStage}`} aria-live="assertive"><div className="mh-dice-cube">{trainingDiceFace}</div><b>{trainingDiceStage==='rolling'?'サイコロを振っています…':`${trainingDiceFace} が出た！`}</b></div>}<header><div><b>{m?.name||'マスモン'} <small>BEGINNER・DEBUG保存なし</small></b><span>残り {trainingSession.remainingTurns}ターン　・　ゴールまであと {trainingDistanceToGoal(current.id)}マス</span></div><button className="mh-debug-toggle" onClick={()=>setTrainingDebugOpen(v=>!v)}>DEBUG</button></header><section className="mh-training-hud"><span>💗 仮XP <b>{trainingSession.rewards.bondXp}</b></span><span>💎 仮ダイヤ <b>{trainingSession.rewards.diamonds}</b></span><span>🎁 仮アイテム <b>{trainingSession.rewards.items.length}</b></span></section><div ref={trainingMapRef} className={`mh-tile-viewport ${trainingMapOverview?'overview':''}`} onPointerDown={trainingPointerDown} onPointerMove={trainingPointerMove} onPointerUp={trainingPointerUp} onPointerCancel={trainingPointerUp} onWheel={trainingWheel}><div className="mh-map-legend"><b>🚩 START</b><b>📍 現在地</b><b>⚡ 安全ルート</b><b>🎁 報酬ルート</b><b>🏁 GOAL</b></div><div className="mh-goal-guide">GOAL <span>➜</span></div><div className="mh-tile-board" style={{width:`${720*trainingMapScale}px`,height:`${520*trainingMapScale}px`,'--map-scale':trainingMapScale}}>{TRAINING_BEGINNER_NODES.map(n=><React.Fragment key={n.id}>{n.next.filter(id=>TRAINING_BEGINNER_NODES.findIndex(x=>x.id===id)>TRAINING_BEGINNER_NODES.findIndex(x=>x.id===n.id)).map(id=>{const to=TRAINING_NODE_BY_ID[id],dx=to.x-n.x,dy=to.y-n.y,isRoute=highlighted.has(n.id)&&highlighted.has(id);return <i className={isRoute?'route':''} key={id} style={{left:`${n.x}%`,top:`${n.y}%`,width:`${Math.hypot(dx,dy)}%`,transform:`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`}}/>})}<button ref={n.id===current.id?trainingPieceRef:null} style={{left:`${n.x}%`,top:`${n.y}%`,'--tile-color':TRAINING_SPACE_TYPES[n.type].color}} className={`mh-training-tile ${n.id===current.id?'current':''} ${trainingSession.routePreview.includes(n.id)?'route-preview':''} ${trainingSession.stopPreview===n.id?'stop-preview':''} ${trainingSession.branchOptions.includes(n.id)?'branch-choice':''} ${trainingForwardOptions(n.id).length>1?'branch':''} ${n.type==='goal'?'goal':''} ${n.type==='start'?'start':''}`} onClick={()=>{if(Date.now()<trainingSuppressTapRef.current)return;trainingSession.branchOptions.includes(n.id)?chooseTrainingBranch(n.id):setTrainingModal({type:'space',space:TRAINING_SPACE_TYPES[n.type]});}}>{trainingSession.branchOptions.includes(n.id)&&<em className="mh-branch-arrow">➜ 選ぶ</em>}<small>{n.type==='start'?'START':n.type==='goal'?'GOAL':TRAINING_SPACE_TYPES[n.type].label}</small><span>{TRAINING_SPACE_TYPES[n.type].emoji}</span>{n.id===current.id&&m&&<div className="mh-training-piece"><DyedMonsterImage baseId={m.baseId} src={ALL_PLAYER_MONSTERS[m.baseId]?.iconUrl} alt={m.name} masuColors={getMasuColors(m)}/><b>{m.name}</b></div>}</button></React.Fragment>)}</div></div><div className="mh-board-buttons"><button onClick={()=>{setTrainingMapOverview(true);setTrainingMapScale(.48);trainingMapRef.current?.scrollTo({left:0,top:0,behavior:'smooth'});}}>🗺️ 全体</button><button onClick={focusTrainingCurrent}>📍 現在地</button><span>{Math.round(trainingMapScale*100)}%</span><button onClick={()=>setTrainingModal({type:'rules'})}>マス詳細・ルール</button></div><p className="mh-training-message">{trainingSession.lastRoll&&<strong>出目 {trainingSession.lastRoll}</strong>}{trainingSession.movementRemaining>0&&<strong>あと {trainingSession.movementRemaining} マス</strong>}{trainingSession.message}{trainingSession.previousRoll&&<small>前回の出目 {trainingSession.previousRoll}</small>}</p><section className="mh-training-tools"><strong>修行道具</strong>{trainingSession.tools.length?trainingSession.tools.map((id,i)=><button key={`${id}-${i}`} className={trainingSession.effects[id]?'waiting':''} onClick={()=>setTrainingModal({type:'tool',id})}><span>{TRAINING_TOOLS[id].emoji}</span><small>{TRAINING_TOOLS[id].name}<br/>{trainingSession.effects[id]?'待機中':TRAINING_TOOLS[id].timing}</small></button>):<p>所持なし（最大3個）</p>}</section><footer>{trainingSession.rollPending?<div className="mh-roll-decision"><b>🎲 出目 {trainingSession.lastRoll}</b><button onClick={acceptTrainingRoll}>この出目で進む</button></div>:trainingSession.effects.fixed?<div className="mh-fixed-dice"><span>確定サイコロ</span>{[1,2,3].map(n=><button key={n} onClick={()=>rollTrainingDice(n)}>{n}</button>)}</div>:<button disabled={trainingSession.movementRemaining>0||trainingSession.branchOptions.length>0||trainingMovingRef.current} onClick={()=>rollTrainingDice()} className="mh-roll-button">🎲 サイコロを振る<small>{trainingSession.branchOptions.length?'分岐方向を選んでください':'出目ぶん自動で進みます'}</small></button>}</footer>{trainingDebugOpen&&<aside className="mh-training-debug"><b>DEBUG PANEL</b><button className="mh-debug-close" onClick={()=>setTrainingDebugOpen(false)}>閉じる</button><div>次の出目 {[1,2,3].map(n=><button key={n} onClick={()=>setTrainingDebugRoll(n)} className={trainingDebugRoll===n?'active':''}>{n}</button>)}<button onClick={()=>setTrainingDebugRoll(null)}>解除</button></div><div><button onClick={()=>patchTraining({remainingTurns:trainingSession.remainingTurns+1})}>ターン＋1</button><button onClick={()=>patchTraining({remainingTurns:Math.max(0,trainingSession.remainingTurns-1)})}>－1</button></div><select onChange={e=>{if(e.target.value)addTrainingTool(e.target.value)}} defaultValue=""><option value="">道具を追加</option>{Object.entries(TRAINING_TOOLS).map(([id,t])=><option key={id} value={id}>{t.name}</option>)}</select><button onClick={()=>setTrainingModal({type:'rewards'})}>仮報酬確認</button><button onClick={()=>finishTraining(true)}>強制成功</button><button onClick={()=>finishTraining(false)}>強制失敗</button><button onClick={restartTraining}>最初から</button><pre>map: {trainingSession.mapId}{'\n'}seed: {trainingSession.seed}{'\n'}{trainingSession.eventLog.join('\n')}</pre></aside>}</main>})()}

        {gameState==='TRAINING_RESULT'&&trainingSession&&(()=>{const r=trainingSession.finalRewards;return <main className={`mh-training-result ${trainingSession.success?'success':'failure'}`}><div><div className="mh-debug-banner">DEBUG・報酬や進行状況は保存されません</div><span className="mh-result-mark">{trainingSession.success?'🏁':'🌧️'}</span><h2>{trainingSession.success?'修行成功！':'修行失敗…'}</h2><section><div><span>仮獲得XP（{trainingSession.success?'100':'50'}%）</span><b>{r.bondXp} XP</b></div><div><span>仮獲得ダイヤ（{trainingSession.success?'100':'50'}%）</span><b>{r.diamonds}</b></div><div><span>通常アイテム</span><b>{r.items.length?`${r.items.length}個`:'没収'}</b></div><div><span>ゴール報酬</span><b>{r.goalReward}</b></div></section><p className="mh-result-note">計算表示のみです。所持データには反映されません。</p><button onClick={restartTraining}>もう一度</button><button onClick={leaveTrainingResult}>設定へ戻る</button><button onClick={()=>{setTrainingSession(null);returnToHome();}}>HOMEへ戻る</button></div></main>})()}

        {trainingModal&&<div className="mh-training-modal" onClick={()=>setTrainingModal(null)}><div onClick={e=>e.stopPropagation()}>{trainingModal.type==='rules'?<><h3>マス一覧／ルール</h3><div className="mh-rules-list">{Object.values(TRAINING_SPACE_TYPES).map(s=><p><b>{s.emoji} {s.label}</b><span>{s.desc}</span></p>)}</div><h3>修行道具</h3><div className="mh-rules-list">{Object.entries(TRAINING_TOOLS).map(([id,t])=><p><b>{t.emoji} {t.name}</b><span>使用：{t.timing}<br/>効果：{t.desc}</span></p>)}</div></>:trainingModal.type==='tool'?<><h3>{TRAINING_TOOLS[trainingModal.id].emoji} {TRAINING_TOOLS[trainingModal.id].name}</h3><p>種類：{TRAINING_TOOLS[trainingModal.id].mode}<br/>使用可能なタイミング：{TRAINING_TOOLS[trainingModal.id].timing}</p><p>正確な効果：{TRAINING_TOOLS[trainingModal.id].desc}</p>{trainingToolAvailability(trainingModal.id).ok?<button className="mh-route-choice" onClick={()=>{useTrainingTool(trainingModal.id);setTrainingModal(null)}}>使用する</button>:<p className="mh-tool-unavailable">今は使えません：{trainingToolAvailability(trainingModal.id).reason}</p>}</>:trainingModal.type==='discard'?<><h3>道具の所持上限（3個）</h3><p>捨てる道具を選ぶか、新しい道具を諦めてください。</p>{trainingSession.tools.map((id,i)=><button className="mh-route-choice" onClick={()=>{const tools=[...trainingSession.tools];tools.splice(i,1,trainingModal.newTool);patchTraining({tools});setTrainingModal(null)}}>{TRAINING_TOOLS[id].name}を捨てる</button>)}<button className="mh-route-choice" onClick={()=>setTrainingModal(null)}>新しい道具を諦める</button></>:trainingModal.type==='rewards'?<><h3>仮報酬</h3><p>絆経験値：{trainingSession?.rewards.bondXp||0}<br/>ダイヤ：{trainingSession?.rewards.diamonds||0}<br/>通常アイテム：{trainingSession?.rewards.items.length||0}個</p></>:<><h3>{trainingModal.space?.emoji} {trainingModal.space?.label}</h3><dl className="mh-space-detail"><div><dt>効果内容</dt><dd>{trainingModal.space?.desc}</dd></div><div><dt>数値</dt><dd>{trainingSpaceValue(trainingModal.space)}</dd></div><div><dt>発動タイミング</dt><dd>{trainingSpaceTiming(trainingModal.space)}</dd></div><div><dt>補足</dt><dd>仮報酬・効果はデバッグ修行中だけ有効で、通常データには保存されません。</dd></div></dl></>}<button className="mh-modal-close" onClick={()=>setTrainingModal(null)}>閉じる</button></div></div>}

        {gameState==='GIFT_BOX'&&(()=>{const now=Date.now();const unclaimed=gifts.filter(g=>!g?.claimedAt);const history=gifts.filter(g=>g?.claimedAt);const shown=giftTab==='unclaimed'?unclaimed:history;const claimable=unclaimed.filter(g=>giftIsClaimable(g,now));return <div className="flex-1 flex flex-col h-full min-h-0 p-3" style={{paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0"><button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-cyan-200 flex items-center gap-2"><Package size={22}/>ギフトボックス</h2><div className="w-11"></div></div>
          <div className="grid grid-cols-2 gap-2 mb-2 shrink-0"><button onClick={()=>setGiftTab('unclaimed')} className={`relative min-h-[44px] rounded-xl font-black text-sm ${giftTab==='unclaimed'?'bg-cyan-600 text-white':'bg-slate-900 text-slate-400'}`}>未受取 ({unclaimed.filter(g=>!giftIsExpired(g,now)).length}){tabCountBadge(claimable.length)}</button><button onClick={()=>setGiftTab('history')} className={`min-h-[44px] rounded-xl font-black text-sm ${giftTab==='history'?'bg-indigo-600 text-white':'bg-slate-900 text-slate-400'}`}>受取済み ({history.length})</button></div>
          {giftTab==='unclaimed'&&<button disabled={!claimable.length} onClick={()=>claimGiftIds(claimable.map(g=>g.id))} className="shrink-0 mb-2 min-h-[44px] rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black disabled:opacity-40">すべて受け取る</button>}
          <div className="mh-gift-list flex-1 min-h-0 overflow-y-auto mh-scroll pb-1">{shown.length===0?<div className="mt-16 text-center text-slate-500 font-bold">{giftTab==='unclaimed'?'未受取のギフトはありません':'受取済みのギフトはありません'}</div>:shown.map(g=>{const expired=giftIsExpired(g,now);const valid=!!normalizeGiftRewards(g);const display=giftTitleDisplay(g);return <article key={g.id} title={g.description||g.title||undefined} className={`mh-gift-card rounded-xl border ${g.claimedAt?'bg-slate-900/70 border-slate-700':expired?'bg-red-950/30 border-red-800/60':'bg-cyan-950/30 border-cyan-500/50'}`}>
            <div className="mh-gift-heading"><h3>{display.label&&<span>{display.label}</span>}<b>{display.title}</b></h3><em className={`${g.claimedAt?'bg-slate-700 text-slate-300':expired?'bg-red-900 text-red-200':valid?'bg-cyan-700 text-white':'bg-amber-900 text-amber-200'}`}>{g.claimedAt?'受取済み':expired?'期限切れ':valid?'受取可':'要確認'}</em></div>
            <div className="mh-gift-main"><div className="mh-gift-rewards">{Array.isArray(g.rewards)&&g.rewards.map((r,i)=><span key={i}>{giftRewardText(r)}</span>)}</div>{!g.claimedAt&&<button disabled={expired||!valid} onClick={()=>claimGiftIds([g.id])}>受け取る</button>}</div>
            <div className="mh-gift-deadline">{g.claimedAt?`受取日時: ${new Date(g.claimedAt).toLocaleString('ja-JP')}`:`受取期限: ${g.expiresAt?new Date(g.expiresAt).toLocaleString('ja-JP'):'期限情報なし'}`}</div>
          </article>})}</div>
        </div>})()}
        {gameState==='MISSIONS'&&(()=>{const state=normalizeMissions(missions),defs=MISSION_DEFS[missionTab],sent=missionTab==='daily'?state.sentDaily:state.sentWeekly;const resetAt=missionNextReset(missionTab);return <div className="flex-1 flex flex-col h-full min-h-0 p-3" style={{paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0"><button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-amber-200 flex items-center gap-2"><List size={21}/>ミッション</h2><div className="w-11"></div></div>
          <div className="grid grid-cols-2 gap-2 mb-2 shrink-0"><button onClick={()=>setMissionTab('daily')} className={`relative min-h-[44px] rounded-xl font-black text-sm ${missionTab==='daily'?'bg-amber-600 text-white':'bg-slate-900 text-slate-400'}`}>デイリー{tabCountBadge(missionClaimableList(state,'daily').length)}</button><button onClick={()=>setMissionTab('weekly')} className={`relative min-h-[44px] rounded-xl font-black text-sm ${missionTab==='weekly'?'bg-violet-600 text-white':'bg-slate-900 text-slate-400'}`}>ウィークリー{tabCountBadge(missionClaimableList(state,'weekly').length)}</button></div>
          {(()=>{const bulk=missionClaimableList(state,missionTab);return <button disabled={!bulk.length} onClick={()=>claimMissionsBulk(missionTab)} className="shrink-0 mb-2 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black disabled:opacity-40">一括受け取り{bulk.length>0&&` (${bulk.length})`}</button>;})()}
          <div className="mb-2 text-center text-[10px] font-bold text-slate-400 shrink-0">次回更新: {new Date(resetAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</div>
          <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2 pb-2">{defs.map(m=>{const value=missionValue(state,missionTab,m),done=value>=m.target,isSent=sent.includes(m.id),pct=Math.min(100,Math.floor(value/m.target*100));return <article key={m.id} className={`rounded-2xl border p-3 ${isSent?'bg-slate-900/70 border-slate-700':done?'bg-amber-950/40 border-amber-400/70':'bg-slate-900 border-white/10'}`}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-black text-sm text-white break-words">{m.name}</h3><p className="text-[10px] text-slate-400 break-words">{m.condition}</p></div><b className="shrink-0 text-xs text-amber-200">{Math.min(value,m.target)} / {m.target}</b></div>
            <div className="h-2 my-2 overflow-hidden rounded-full bg-black/50"><div className={`h-full rounded-full ${done?'bg-amber-400':'bg-cyan-500'}`} style={{width:`${pct}%`}}></div></div>
            <div className="flex items-center justify-between gap-2"><div className="min-w-0 text-[10px] font-black text-cyan-200 break-words">報酬: {m.rewards.map(giftRewardText).join(' / ')}</div>{isSent?<button disabled className="shrink-0 min-h-[38px] px-3 rounded-xl bg-slate-700 text-[10px] font-black text-slate-400">ギフト送付済み</button>:done?<button onClick={()=>claimMission(missionTab,m)} className="shrink-0 min-h-[38px] px-4 rounded-xl bg-amber-500 text-[11px] font-black text-black active:scale-95">受け取る</button>:<span className="shrink-0 text-[10px] font-black text-slate-500">進行中 {pct}%</span>}</div>
          </article>})}</div>
        </div>})()}
        {loginBonusPopup&&<div className="fixed inset-0 flex items-center justify-center p-5" style={{zIndex:60000,backgroundColor:'rgba(2,6,23,.88)'}} role="dialog" aria-modal="true" aria-label="ログインボーナス"><div className="w-full max-w-sm rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-indigo-950 to-slate-950 p-6 text-center shadow-2xl"><Sparkles size={46} className="mx-auto mb-3 text-amber-300"/><h2 className="text-2xl font-black text-amber-200">ログインボーナス</h2><p className="mt-3 text-sm font-black text-white">{loginBonusPopup.day}日目のログインボーナスを獲得しました！</p><div className="my-4 space-y-2">{loginBonusPopup.rewards.map((reward,i)=><div key={i} className="rounded-xl bg-black/35 px-3 py-2 font-black text-cyan-200 break-words">{giftRewardText(reward)}</div>)}</div><p className="text-xs text-slate-300">報酬はギフトボックスへ送られました。</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>{setLoginBonusPopup(null);openGiftBox();}} className="min-h-[48px] rounded-xl bg-cyan-600 px-2 text-sm font-black text-white">ギフトを確認</button><button onClick={()=>setLoginBonusPopup(null)} className="min-h-[48px] rounded-xl bg-slate-700 px-2 text-sm font-black text-white">閉じる</button></div></div></div>}

        {gameState==='MB_MANAGEMENT'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
            <div className="flex items-center gap-2 mb-5 shrink-0"><button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-indigo-300">M/B管理</h2></div>
            <div className="grid grid-cols-2 gap-2 mb-5 shrink-0"><button onClick={()=>setManagementTab('monster')} className={`min-h-[48px] rounded-xl font-black ${managementTab==='monster'?'bg-indigo-600 text-white':'bg-slate-900 text-slate-400'}`}>モンスター</button><button onClick={()=>setManagementTab('breeder')} className={`min-h-[48px] rounded-xl font-black ${managementTab==='breeder'?'bg-purple-600 text-white':'bg-slate-900 text-slate-400'}`}>ブリーダーカード</button></div>
            <div className="w-full max-w-md mx-auto space-y-3 overflow-y-auto mh-scroll">
              {managementTab==='monster'?<><button onClick={()=>setGameState('OWNED_MONSTERS')} className="mh-management-link">ベースモン一覧</button><button onClick={()=>setGameState('MASU_MONS')} className="mh-management-link">マスモン一覧</button><button onClick={()=>{setDraftMonsterRoster(monsterRosterIds);setDraftTeachingRoster(teachingRosterIds);setRosterTab('monster');setGameState('ROSTER');}} className="mh-management-link">モンスター編成</button><button onClick={openPastureSettings} className="mh-management-link">放牧設定</button></>:<button onClick={()=>{setDraftMonsterRoster(monsterRosterIds);setDraftTeachingRoster(teachingRosterIds);setRosterTab('teaching');setGameState('ROSTER');}} className="mh-management-link">ブリーダーカード編成</button>}
            </div>
          </div>
        )}

        {gameState==='TEMPLE'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
            <div className="flex items-center gap-2 mb-5 shrink-0"><button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">神殿</h2></div>
            <div className="w-full max-w-md mx-auto space-y-3"><button onClick={()=>{resetFusionFlow();setGameState('MASU_FUSION');}} className="mh-management-link mh-temple-link"><Sparkles size={18}/>合体</button><button onClick={()=>{resetDonationFlow();setGameState('MASU_DONATION');}} className="mh-management-link mh-temple-link"><Gem size={18}/>寄付</button><button onClick={()=>{setRebirthSelectedId(null);setRebirthSkillKey('');setRebirthError('');setGameState('MASU_REBIRTH');}} className="mh-management-link mh-temple-link"><Star size={18}/>転生</button></div>
          </div>
        )}

        {gameState==='MASU_REBIRTH'&&(()=>{
          const selected=masuMons.find(m=>String(m.id)===String(rebirthSelectedId));
          if (!selected) { const entries=sortMonsterEntries(buildUnifiedMonsterEntries([],masuMons,monsterRosterIds)).filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e,monsterDisplayFlags)); return <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-3"><button onClick={()=>setGameState('TEMPLE')} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">転生</h2></div><div className="text-[10px] text-slate-400 mb-3">現在のレベル上限に到達したマスモンだけが転生できます。</div>{renderMonsterSortFilterBar({singleType:true})}<div className="grid grid-cols-3 gap-2 overflow-y-auto mh-scroll">{entries.map(({masu})=>{const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;const lvl=masuBondLevelInfo(masu);const can=lvl.level===normalizeMasuProgression(masu).levelCap;return <button key={masu.id} disabled={!can} onClick={()=>{setRebirthSelectedId(masu.id);setRebirthSkillKey('');}} className="relative rounded-2xl border border-violet-500/40 bg-slate-900 p-2 disabled:opacity-35"><div className="relative w-14 h-14 mx-auto rounded-full overflow-hidden"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/></div><div className="text-[9px] font-black truncate">{masu.name}</div><div className="text-[8px] text-pink-300">Lv.{lvl.level}/{masu.levelCap||30}</div></button>})}</div></div>; }
          const normalized=normalizeMasuProgression(selected), base=ALL_PLAYER_MONSTERS[selected.baseId], lvl=masuBondLevelInfo(selected), cost=lvl.level*100, skills=getRebirthSkillChoices(selected);
          return <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-3"><button disabled={rebirthProcessingRef.current} onClick={()=>setRebirthSelectedId(null)} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">転生・固有技選択</h2></div><div className="flex items-center gap-3 bg-slate-900 rounded-2xl p-3 mb-3"><div className="relative w-20 h-20 rounded-full overflow-hidden"><DyedMonsterImage baseId={selected.baseId} src={base?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)} className="w-full h-full object-cover"/><RebirthStars count={selected.rebirthCount} className="mh-rebirth-stars-overlay"/></div><div><b>{selected.name}</b><div className="text-pink-300 text-xs">Lv.{lvl.level} / 上限Lv.{normalized.levelCap}</div><div className="text-amber-300 text-xs">必要 {cost.toLocaleString()}ダイヤ</div></div></div><div className="text-[10px] text-slate-300 mb-2">LvUPする固有技を1つ選択してください（最大Lv.8）</div><div className="space-y-2 flex-1 overflow-y-auto mh-scroll">{skills.map(skill=><button key={skill.key} disabled={skill.level>=MAX_UNIQUE_SKILL_LEVEL} onClick={()=>setRebirthSkillKey(skill.key)} className={`w-full p-3 rounded-xl border text-left disabled:opacity-30 ${rebirthSkillKey===skill.key?'bg-violet-700 border-white':'bg-slate-900 border-violet-500/40'}`}><div className="font-black text-xs">{skill.name}</div><div className="text-[10px] text-amber-300">現在Lv.{skill.level} → Lv.{Math.min(MAX_UNIQUE_SKILL_LEVEL,skill.level+1)}</div></button>)}</div>{rebirthError&&<div className="text-red-300 text-[10px] my-2">{rebirthError}</div>}<button disabled={!rebirthSkillKey||gold<cost||rebirthProcessingRef.current} onClick={executeMasuRebirth} className="w-full py-3.5 bg-violet-600 rounded-2xl font-black disabled:opacity-30">転生する</button></div>;
        })()}

        {gameState==='MASU_DONATION'&&(()=>{
          const options=[{key:'bondXp',label:'絆経験値'},{key:'bond',label:'絆レベル'},{key:'name',label:'名前'},{key:'lineage',label:'血統'},{key:'newest',label:'新しい順'},{key:'active',label:'編成中'}];
          const dir=donationSortDir==='asc'?1:-1;
          const sorted=[...masuMons].sort((a,b)=>{const active=m=>monsterRosterIds.includes(`masu:${m.id}`)?1:0;const val=m=>donationSortKey==='bondXp'?donationDiamondValue(m.bondXp):donationSortKey==='bond'?bondLevelInfo(m.bondXp||0).level:donationSortKey==='name'?(m.name||''):donationSortKey==='lineage'?((ALL_PLAYER_MONSTERS[m.baseId]||{}).name||''):donationSortKey==='active'?active(m):(Number(m.createdAt)||Number(m.id)||0);const av=val(a),bv=val(b);return (typeof av==='string'?av.localeCompare(bv,'ja'):av-bv)*dir;});
          return <div className="flex-1 flex flex-col h-full min-h-0 p-3" style={{paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
            <div className="flex items-center gap-2 mb-1 shrink-0"><button disabled={donationProcessing} onClick={()=>{resetDonationFlow();setGameState('TEMPLE');}} className="p-3 text-slate-400 active:scale-90 disabled:opacity-40"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">寄付</h2></div>
            <p className="text-[10px] text-slate-300 leading-relaxed bg-violet-950/40 border border-violet-500/30 rounded-xl px-3 py-2 mb-2 shrink-0">累計絆経験値と同じ数のダイヤを受け取れます</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2 shrink-0">{options.map(o=>{const active=donationSortKey===o.key;return <button key={o.key} onClick={()=>{if(active)setDonationSortDir(d=>d==='asc'?'desc':'asc');else{setDonationSortKey(o.key);setDonationSortDir(o.key==='name'||o.key==='lineage'?'asc':'desc');}}} className={`min-w-0 px-1 py-2 rounded-lg text-[8px] font-black border ${active?'bg-violet-600 border-violet-400 text-white':'bg-slate-900 border-white/10 text-slate-400'}`}>{o.label}{active&&(donationSortDir==='asc'?' ▲':' ▼')}</button>})}</div>
            {donationError&&<div className="text-[9px] text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-xl p-2 mb-2 shrink-0"><AlertCircle size={12} className="inline mr-1"/>{donationError}</div>}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              {masuMons.length===0?<div className="flex flex-col items-center justify-center h-full text-center text-slate-500"><Gem size={42}/><p className="text-[11px] mt-3 font-bold">寄付できるマスモンがいません</p></div>:<div className="grid grid-cols-3 gap-1.5 pb-4">{sorted.map(masu=>{const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;const diamonds=donationDiamondValue(masu.bondXp);const lvl=bondLevelInfo(diamonds);const active=monsterRosterIds.includes(`masu:${masu.id}`);return <button key={masu.id} disabled={donationProcessing} onClick={()=>{setDonationError('');setDonationSelectedId(masu.id);}} className="min-w-0 overflow-hidden bg-slate-900 border border-violet-500/30 rounded-xl p-1.5 flex flex-col items-center text-center active:scale-[.97] disabled:opacity-50">
                <div className="relative w-full aspect-square max-h-24 rounded-lg overflow-hidden bg-black/30"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-contain"/><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/>{active&&<span className="absolute top-1 left-1 right-1 text-[7px] leading-4 bg-pink-600/95 text-white rounded-full font-black">編成中</span>}</div>
                <div className="w-full mt-1 font-black text-[9px] leading-tight text-white truncate">{masu.name}</div><div className="text-[8px] leading-tight text-pink-300 font-black">絆Lv.{lvl.level}</div><div className="w-full text-[7px] leading-tight text-slate-300 truncate">累計 {diamonds.toLocaleString()} XP</div><div className="w-full text-[8px] leading-tight text-amber-300 font-black truncate"><Gem size={8} className="inline"/> {diamonds.toLocaleString()}</div>
              </button>})}</div>}
            </div>
          </div>;
        })()}

        {gameState==='MASU_DONATION'&&donationSelectedId&&(()=>{const masu=masuMons.find(m=>String(m.id)===String(donationSelectedId));if(!masu)return null;const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;const diamonds=donationDiamondValue(masu.bondXp);const after=donationDiamondValue(gold)+diamonds;const active=monsterRosterIds.includes(`masu:${masu.id}`);return <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,.95)',zIndex:32000}}><div className="w-full max-w-sm bg-slate-900 border-2 border-violet-400 rounded-3xl p-5 shadow-2xl">
          <h3 className="text-lg font-black text-violet-200 text-center mb-4">寄付の最終確認</h3><div className="flex items-center gap-3 mb-4"><div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400/60 shrink-0"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div><div><div className="font-black text-white">{masu.name}</div><div className="text-[10px] text-slate-400">ベースモン {base.name}</div><div className="text-[10px] text-slate-300 mt-1">累計絆経験値 {diamonds.toLocaleString()} XP</div><div className="text-sm text-amber-300 font-black">獲得ダイヤ {diamonds.toLocaleString()}</div></div></div>
          <div className="bg-black/40 rounded-2xl p-3 space-y-1 text-[11px] mb-3"><div className="flex justify-between"><span>現在の所持ダイヤ</span><b>{donationDiamondValue(gold).toLocaleString()}</b></div><div className="flex justify-between text-amber-300"><span>寄付後の所持ダイヤ</span><b>{after.toLocaleString()}</b></div></div>
          <div className="bg-amber-950/40 border border-amber-500/50 text-amber-100 text-[10px] leading-relaxed rounded-xl p-3 mb-3"><AlertCircle size={14} className="inline mr-1"/>寄付したマスモンはいなくなります。この操作は取り消せません。{active&&<div className="mt-2 font-black">このマスモンは編成中です。寄付すると編成から外れます。</div>}</div>
          <div className="flex gap-2"><button onClick={()=>setDonationSelectedId(null)} disabled={donationProcessing} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-2xl font-black text-xs disabled:opacity-40">キャンセル</button><button onClick={executeMasuDonation} disabled={donationProcessing} className="flex-[2] bg-gradient-to-r from-violet-600 to-amber-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg disabled:opacity-40">{donationProcessing?'処理中…':`寄付して${diamonds.toLocaleString()}ダイヤを受け取る`}</button></div>
        </div></div>})()}

        {levelCapCompensation&&<div className="fixed inset-0 flex items-center justify-center p-5" style={{position:'fixed',inset:0,zIndex:50000,backgroundColor:'rgba(2,6,23,.96)'}}><div className="max-w-sm w-full bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 text-center"><Gem size={38} className="text-amber-300 mx-auto mb-3"/><h2 className="font-black text-lg mb-2">Lv30上限補償</h2><p className="text-[11px] text-slate-300 leading-relaxed">Lv30を超えていた未転生マスモンの超過絆経験値を削除し、同数のダイヤへ還元しました。</p><div className="text-2xl text-amber-300 font-black my-4">+{levelCapCompensation.diamonds.toLocaleString()} ダイヤ</div><button onClick={()=>{setLevelCapCompensation(null);storeSet('mh_masu_level_cap_compensation_notice_seen_v1',true,false);}} className="w-full bg-amber-500 text-black py-3 rounded-2xl font-black">受け取る</button></div></div>}
        {rebirthAnimation&&<div className="mh-rebirth-animation" role="status" aria-live="polite"><div className="mh-rebirth-circle">✧</div><div className="mh-rebirth-glow"></div><div className="mh-rebirth-mon"><DyedMonsterImage baseId={rebirthAnimation.masu.baseId} src={rebirthAnimation.base?.iconUrl} alt={rebirthAnimation.masu.name} masuColors={getMasuColors(rebirthAnimation.masu)} className="w-full h-full object-contain"/><RebirthStars count={rebirthAnimation.masu.rebirthCount} className="mh-rebirth-stars-overlay"/></div><div className="mh-rebirth-copy"><b>転生完了！</b><span>★ 転生星を追加</span><span>レベル上限UP → {rebirthAnimation.masu.levelCap}</span><span>{rebirthAnimation.skillName} Lv.{rebirthAnimation.skillLevel}へ進化</span><span>強化ポイント +5</span></div></div>}
        {donationAnimation&&<div className="mh-donation-animation" role="status" aria-live="polite" aria-label="寄付を処理中"><div className="mh-donation-beam"></div><div className="mh-donation-monster"><DyedMonsterImage baseId={donationAnimation.baseId} src={donationAnimation.src} alt={donationAnimation.name} masuColors={donationAnimation.colors} className="w-full h-full object-contain"/></div><div className="mh-donation-gem"><Gem size={42}/></div><div className="mh-donation-particles">{Array.from({length:8},(_,i)=><i key={i} style={{'--i':i}}></i>)}</div><div className="mh-donation-copy">神殿へ寄付中…</div></div>}

        {gameState==='MASU_DONATION'&&donationResult&&<div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,.96)',zIndex:32100}}><div className="w-full max-w-sm bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 text-center shadow-2xl"><Gem size={48} className="text-amber-300 mx-auto mb-3"/><h3 className="text-xl font-black text-white mb-3">寄付完了</h3><p className="text-sm text-violet-200 font-bold">{donationResult.name}を寄付しました</p><p className="text-lg text-amber-300 font-black mt-2">{donationResult.diamonds.toLocaleString()}ダイヤを受け取りました</p><p className="text-[11px] text-slate-300 mt-2">所持ダイヤ {donationResult.gold.toLocaleString()}</p><button onClick={()=>setDonationResult(null)} className="w-full mt-5 bg-gradient-to-r from-violet-600 to-amber-600 text-white py-3.5 rounded-2xl font-black text-sm">寄付一覧へ戻る</button></div></div>}

        {showWaveDetails&&<div className="fixed inset-0 flex items-center justify-center p-3" style={{zIndex:70000,backgroundColor:'rgba(2,6,23,.96)',paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}} role="dialog" aria-modal="true"><section className="w-full max-w-md max-h-full flex flex-col rounded-3xl border-2 border-indigo-400 bg-slate-950 p-4"><header className="flex items-center justify-between mb-3"><div><small className="text-indigo-300 font-black">{DIFFICULTY_SETTINGS[safeDifficulty].label}</small><h2 className="text-xl font-black">全WAVE詳細</h2></div><button aria-label="閉じる" onClick={()=>{setWaveScanPreview(null);setShowWaveDetails(false);}} className="p-3 rounded-full bg-white/10"><X/></button></header><div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2">{ENEMY_SEQUENCE.map((enemyKey,index)=>{const enemy=createBattleEnemy(index+1,safeDifficulty);const boss=index===ENEMY_SEQUENCE.length-1;return <article key={`${enemyKey}-${index}`} data-wave={index+1} role="button" tabIndex={0} aria-label={`WAVE ${index+1} ${enemy.name}を解析`} onClick={()=>setWaveScanPreview({enemy,wave:index+1,difficulty:safeDifficulty})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setWaveScanPreview({enemy,wave:index+1,difficulty:safeDifficulty});}}} className={`grid grid-cols-[34px_104px_minmax(0,1fr)_72px] items-center gap-2 rounded-2xl border bg-slate-900 px-2 cursor-pointer active:scale-[.99] ${boss?'border-amber-400/40 min-h-[120px]':'border-white/10 min-h-[64px]'}`}><b className={`${boss?'text-amber-300':'text-indigo-300'} whitespace-nowrap`}>W{index+1}</b><div data-wave-art className="relative w-[104px] h-full min-h-[60px] flex items-center justify-center overflow-hidden">{enemy.imgUrl?<img src={enemy.imgUrl} alt={enemy.name} style={enemyArtStyle(enemy.id,'waveDetail')} className="w-14 h-14 object-contain"/>:<span className="text-3xl">{enemy.emoji}</span>}</div><div className="min-w-0"><b className={`block truncate whitespace-nowrap ${boss?'text-amber-300':''}`} title={enemy.name}>{enemy.name}</b>{boss&&<span className="block text-[9px] leading-tight font-black text-amber-400">BOSS</span>}</div><div data-wave-stats className="w-[72px] text-right text-[10px] whitespace-nowrap"><div>HP <b>{enemy.maxHp.toLocaleString()}</b></div><div>攻撃 <b>{enemy.atk.toLocaleString()}</b></div></div></article>})}</div></section></div>}
        {gameState==='BATTLE_MENU'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 px-4" style={{paddingTop:'calc(.35rem + env(safe-area-inset-top))',paddingBottom:'calc(.35rem + env(safe-area-inset-bottom))'}}>
            <div className="flex items-center gap-1 mb-1 shrink-0"><button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">バトル</h2></div>
            <div className="w-full max-w-md mx-auto flex-1 min-h-0 flex flex-col pt-1">
            <div className="grid grid-cols-2 gap-1.5 mb-1 shrink-0 rounded-xl bg-slate-900/60 p-1 border border-white/5">
              <button onClick={()=>setBattleMenuTab('difficulty')} className={`py-1.5 rounded-lg text-[11px] font-black transition-all ${battleMenuTab==='difficulty'?'bg-indigo-600 text-white shadow-[0_0_18px_rgba(99,102,241,0.4)]':'bg-slate-950/70 text-slate-400'}`}>難易度</button>
              <button onClick={()=>{setBattleMenuTab('ranking');setRankingKind('score');setRankingViewDiff(difficulty);loadRankings(difficulty);}} className={`py-1.5 rounded-lg text-[11px] font-black transition-all ${battleMenuTab==='ranking'?'bg-indigo-600 text-white shadow-[0_0_18px_rgba(99,102,241,0.4)]':'bg-slate-950/70 text-slate-400'}`}>ランキング</button>
            </div>
            {battleMenuTab==='difficulty'&&(()=>{
              const difficulties=Object.entries(DIFFICULTY_SETTINGS),selectedIndex=difficulties.findIndex(([key])=>key===safeDifficulty);
              const selectDifficultyIndex=(index,behavior='smooth')=>{const safe=Math.max(0,Math.min(difficulties.length-1,index));setDifficulty(difficulties[safe][0]);difficultyCarouselRef.current?.children[safe]?.scrollIntoView({behavior,inline:'center',block:'nearest'});};
              const preview=createBattleEnemy(1,safeDifficulty);
              return <div className="flex-1 min-h-0 flex flex-col overflow-hidden"><div className="text-center text-[9px] tracking-[.18em] text-slate-400 font-black mb-1">左右にスワイプして難易度を選択</div><div className="relative shrink-0"><button aria-label="前の難易度" disabled={selectedIndex===0} onClick={()=>selectDifficultyIndex(selectedIndex-1)} className="absolute left-0 top-[42%] z-20 w-9 h-12 rounded-r-xl bg-black/70 disabled:opacity-20"><ChevronLeft/></button><div ref={difficultyCarouselRef} onScroll={e=>{const root=e.currentTarget,c=root.scrollLeft+root.clientWidth/2;let best=0,d=Infinity;[...root.children].forEach((card,i)=>{const n=Math.abs(card.offsetLeft+card.offsetWidth/2-c);if(n<d){d=n;best=i;}});if(difficulties[best]?.[0]!==safeDifficulty)setDifficulty(difficulties[best][0]);}} className="flex items-start gap-3 overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-x-contain py-1 mh-scroll" style={{paddingLeft:'11%',paddingRight:'11%',touchAction:'pan-x pinch-zoom'}}>
              {difficulties.map(([key,setting])=>{const active=key===safeDifficulty,enemy=createBattleEnemy(1,key);return <article key={key} className={`snap-center shrink-0 w-[82%] rounded-[28px] border-2 px-3 py-2 overflow-hidden transition-all ${active?'scale-100 opacity-100':'scale-[.92] opacity-55'}`} style={{borderColor:active?setting.text:'rgba(255,255,255,.12)',background:'linear-gradient(180deg,#152044,#0d142b)',boxShadow:active?`0 0 30px ${setting.bg}55`:'none'}}><div className="text-center text-[8px] tracking-[.2em] text-slate-400 font-black">BATTLE DIFFICULTY</div><h3 className="text-center text-xl font-black mt-0.5" style={{color:setting.text}}>{setting.label}</h3><div className="mt-1.5 rounded-xl bg-black/45 px-2.5 py-1.5"><small className="text-[8px] text-slate-400 font-black">MY HIGH SCORE</small><b className="block text-right text-lg leading-tight text-indigo-200">{(highScores[key]||0).toLocaleString()} pt</b><span className="block text-right text-[9px] text-amber-300">最高到達 WAVE {highestWaves[key]||0}</span></div><div className="grid grid-cols-[80px_1fr] items-center gap-2 my-1.5 rounded-xl border border-white/10 bg-black/25 p-2"><div className="h-20 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">{enemy?.imgUrl?<img src={enemy.imgUrl} alt={enemy.name} className="w-full h-full object-contain"/>:<span className="text-5xl">{enemy?.emoji}</span>}</div><div><small className="text-amber-300 font-black">WAVE 1</small><h4 className="font-black">{enemy?.name}</h4><div className="flex justify-between text-xs mt-2"><span>HP</span><b>{enemy?.maxHp.toLocaleString()}</b></div><div className="flex justify-between text-xs mt-1"><span>攻撃力</span><b>{enemy?.atk.toLocaleString()}</b></div></div></div><div className="grid grid-cols-3 gap-1">{[['敵強度',setting.power],['スコア',setting.score],['ダイヤ',setting.gold]].map(([label,value])=><div key={label} className="rounded-xl bg-black/35 p-1 text-center text-[8px] text-slate-400">{label}<b className="block text-sm text-white">×{value}</b></div>)}</div><div className="grid gap-1.5 mt-1.5"><button onClick={()=>{setDifficulty(key);setShowWaveDetails(true);}} className="min-h-[44px] rounded-xl bg-slate-700 font-black text-xs">全WAVE詳細</button><button onClick={()=>{setDifficulty(key);debugBattleRef.current=false;setDebugBattle(false);setDebugOutcome(null);setMonSelection(getActiveMonsterList());setGameState('PICK_HERO');}} className="min-h-[44px] rounded-xl font-black text-sm text-white" style={{backgroundColor:setting.bg}}>この難易度で挑戦</button></div></article>})}</div><button aria-label="次の難易度" disabled={selectedIndex===difficulties.length-1} onClick={()=>selectDifficultyIndex(selectedIndex+1)} className="absolute right-0 top-[42%] z-20 w-9 h-12 rounded-l-xl bg-black/70 disabled:opacity-20"><ChevronRight/></button></div><div className="flex justify-center gap-1.5 py-1">{difficulties.map(([key],i)=><button key={key} aria-label={`${i+1}ページ目`} onClick={()=>selectDifficultyIndex(i)} className={`w-2 h-2 rounded-full ${key===safeDifficulty?'bg-indigo-300 scale-125':'bg-slate-700'}`}/>)}</div></div>;})()}
            {battleMenuTab==='ranking'&&<div className="flex-1 min-h-0 flex flex-col">
              <div className="grid grid-cols-3 gap-1 mb-1.5 shrink-0">{[{k:'score',label:'スコア'},{k:'breeder',label:'ブリーダーLv'},{k:'bond',label:'絆Lv'}].map(t=><button key={t.k} onClick={()=>{setRankingKind(t.k);if(t.k==='score')loadRankings(rankingViewKey);else {if(t.k==='bond')setBondRankMonFilter('all');loadRankings(null,true,false,t.k);}}} className={`py-1.5 rounded-lg text-[9px] font-black border ${rankingKind===t.k?'bg-indigo-600 border-indigo-400':'bg-slate-900 border-white/10 text-slate-400'}`}>{t.label}</button>)}</div>
              {rankingKind==='score'&&(()=>{const rows=localRankings[rankingViewKey]||[],status=rankingStatus(`score:${rankingViewKey}`);return <><div className="flex gap-1 overflow-x-auto pb-1.5 shrink-0">{Object.entries(DIFFICULTY_SETTINGS).map(([d,st])=><button key={d} onClick={()=>{setRankingViewDiff(d);loadRankings(d);}} className={`px-2.5 py-1 rounded-full text-[8px] font-black shrink-0 ${rankingViewDiff===d?'ring-1 ring-white':'border border-white/10'}`} style={difficultyStyle(st,rankingViewDiff===d)}>{st.label}</button>)}</div><div className="flex-1 overflow-y-auto mh-scroll space-y-1.5">{status.refreshing&&<div className="text-center text-[9px] text-indigo-300">更新中…</div>}{status.error&&status.fetched&&<div className="text-center text-[9px] text-amber-300">{status.error}</div>}{rows.map(renderScoreRankingEntry)}{rows.length===0&&(status.loading?<div className="text-center text-slate-400 py-8">Loading...</div>:status.error&&!status.fetched?<div className="text-center text-red-300 py-8"><p>取得に失敗しました</p><button onClick={()=>loadRankings(rankingViewKey,false,true)} className="mt-3 min-h-[44px] px-5 rounded-xl bg-indigo-600 text-white font-black">再読込</button></div>:<div className="text-center text-slate-500 py-8">記録はまだありません</div>)}</div></>;})()}
              {rankingKind==='breeder'&&(()=>{const status=rankingStatus('breeder:all');return <div className="flex-1 overflow-y-auto mh-scroll space-y-1.5">{status.refreshing&&<div className="text-center text-[9px] text-indigo-300">更新中…</div>}{status.error&&status.fetched&&<div className="text-center text-[9px] text-amber-300">{status.error}</div>}{breederRanking.map(renderBreederRankingEntry)}{breederRanking.length===0&&(status.loading?<div className="text-center text-slate-400 py-8">Loading...</div>:status.error&&!status.fetched?<div className="text-center text-red-300 py-8"><p>取得に失敗しました</p><button onClick={()=>loadRankings(null,true,true,'breeder')} className="mt-3 min-h-[44px] px-5 rounded-xl bg-indigo-600 text-white font-black">再読込</button></div>:<div className="text-center text-slate-500 py-8">記録はまだありません</div>)}</div>;})()}
              {rankingKind==='bond'&&<><div className="flex gap-1 overflow-x-auto pb-1.5 shrink-0">{['all',...bondRankingMonNames].map(n=><button key={n} onClick={()=>setBondRankMonFilter(n)} className={`px-2.5 py-1 rounded-full text-[8px] font-black shrink-0 border ${bondRankMonFilter===n?'bg-pink-600 border-pink-400':'bg-slate-900 border-white/10 text-slate-400'}`}>{n==='all'?'すべて':n}</button>)}</div><div className="flex-1 overflow-y-auto mh-scroll space-y-1.5">{bondRankingLoading&&bondRankingData&&<div className="text-center text-[9px] text-indigo-300">更新中…</div>}{bondRankingError&&bondRankingData&&<div className="text-center text-[9px] text-amber-300">{bondRankingError}</div>}{bondRanking.map(renderBondRankingEntry)}{bondRanking.length===0&&(bondRankingLoading&&!bondRankingData?<div className="text-center text-slate-400 py-8">Loading...</div>:bondRankingError&&!bondRankingData?<div className="text-center text-red-300 py-8"><p>取得に失敗しました</p><button onClick={()=>loadRankings(null,true,true,'bond')} className="mt-3 min-h-[44px] px-5 rounded-xl bg-indigo-600 text-white font-black">再読込</button></div>:<div className="text-center text-slate-500 py-8">記録はまだありません</div>)}</div></>}
            </div>}
            </div>
          </div>
        )}


        {gameState==='MONSTER_LIST_MENU'&&(
          <div className="flex-1 flex flex-col h-full p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}><div className="flex items-center gap-2"><button onClick={returnToHome} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-cyan-400">モンスター一覧</h2></div><div className="w-full max-w-md mx-auto space-y-4 mt-[clamp(3.5rem,14vh,8rem)]"><button onClick={()=>setGameState('OWNED_MONSTERS')} className="w-full min-h-[72px] bg-cyan-950/50 border border-cyan-500/40 px-4 py-5 rounded-2xl font-black shadow-lg active:scale-[.98]">ベースモン</button><button onClick={()=>setGameState('MASU_MONS')} className="w-full min-h-[72px] bg-pink-950/50 border border-pink-500/40 px-4 py-5 rounded-2xl font-black shadow-lg active:scale-[.98]">マスモン</button></div></div>
        )}

        {gameState==='SETTINGS'&&(
          <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-5"><button onClick={returnToHome} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-slate-200">設定</h2></div><div className="space-y-3"><button onClick={()=>setShowAudioSettings(true)} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">音量設定</button><button onClick={()=>setShowBgmArrangement(true)} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">BGMアレンジ</button><button onClick={()=>{setShowBackup(true);setBackupTab('export');setBackupCode('');setRestoreInput('');setRestoreMsg('');}} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">データ引き継ぎ</button><button onClick={()=>setShowHelp(true)} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">ヘルプ</button><button onClick={()=>setShowOfficialTitleConfirm(true)} className="w-full bg-red-950/50 border border-red-500/40 text-red-200 py-4 rounded-2xl font-black">タイトルへ戻る</button></div></div>
        )}

        {gameState==='DEBUG_SETTINGS'&&(
          <div className="flex-1 flex flex-col h-full p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
            <div className="flex items-center gap-2 mb-4 shrink-0"><button onClick={()=>{setGameState('SETTINGS');setShowHelp(true);}} className="p-3 text-slate-500"><ArrowLeft size={20}/></button><h2 className="text-base font-black text-slate-400 tracking-widest">BATTLE TEST</h2></div>
            <div className="flex-1 overflow-y-auto mh-scroll space-y-5"><button onClick={openDebugTraining} className="w-full min-h-[64px] bg-fuchsia-950 border-2 border-fuchsia-500 text-fuchsia-100 rounded-2xl font-black">🎲 修行テスト<small className="block text-[8px] text-fuchsia-300">報酬・進行は保存されません</small></button>
              <section><div className="text-[10px] text-slate-500 font-black mb-2">1. 難易度</div><div className="grid grid-cols-3 gap-2">{Object.entries(DIFFICULTY_SETTINGS).map(([key,setting])=><button key={key} onClick={()=>{setDifficulty(key);const options=getDebugEnemyOptions(key);if(!options.some(o=>o.key===debugEnemyKey))setDebugEnemyKey(options[0]?.key||null);}} className={`min-h-[48px] rounded-xl text-[9px] font-black ${difficulty===key?'ring-2 ring-white':'border border-white/10'}`} style={difficultyStyle(setting,difficulty===key)}>{setting.label}</button>)}</div></section>
              <section><div className="text-[10px] text-slate-500 font-black mb-2">2. 敵</div><div className="grid grid-cols-2 gap-2">{getDebugEnemyOptions(difficulty).map(({key,enemy:debugEnemy})=><button key={key} onClick={()=>setDebugEnemyKey(key)} className={`min-h-[46px] px-3 rounded-xl text-[11px] font-black ${debugEnemyKey===key?'bg-purple-950 border-2 border-purple-400 text-purple-100':'bg-slate-900 border border-white/10 text-slate-400'}`}>{debugEnemy.emoji} {debugEnemy.name}</button>)}</div></section>
              <button disabled={!getDebugEnemyOptions(difficulty).some(o=>o.key===debugEnemyKey)||getActiveMonsterList().length===0} onClick={startDebugBattle} className="w-full min-h-[58px] bg-slate-200 text-slate-950 rounded-2xl font-black disabled:opacity-30">3. デバッグ戦開始</button>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {gameState==='PROFILE'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
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
              <div className="w-full flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/30 px-4 py-2.5 rounded-xl">
                <Coins size={14} className="text-amber-400"/><span className="text-[11px] font-black text-amber-200">{breederPoints} pt</span>
              </div>
              <button onClick={()=>setGameState('ITEM_INVENTORY')} className="w-full flex items-center justify-center gap-2 bg-teal-950/40 border border-teal-500/40 px-4 py-2.5 rounded-xl active:scale-95">
                <Package size={12} className="text-teal-400"/><span className="text-[10px] font-black text-teal-200">アイテム（{Object.values(ownedItems).reduce((sum,n)=>sum+(n||0),0)}個）</span>
              </button>
            </div>
            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2 px-1 shrink-0">難易度別 記録</div>
            <div className="flex flex-col gap-2 mb-4">
              {Object.entries(DIFFICULTY_SETTINGS).map(([key,setting])=>(
                <div key={key} className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                  <div className="px-1 py-1 rounded-lg text-[9px] font-black uppercase shrink-0 w-20 text-center leading-[1.05]" style={difficultyStyle(setting, true)}>{setting.label}</div>
                  <div className="flex-1 grid grid-cols-3 gap-1">
                    <div className="text-center"><div className="text-[7px] text-slate-500 uppercase tracking-wide">挑戦</div><div className="text-xs font-black text-white">{attemptCounts[key]||0}</div></div>
                    <div className="text-center"><div className="text-[7px] text-slate-500 uppercase tracking-wide">クリア</div><div className="text-xs font-black text-emerald-400">{clearCounts[key]||0}</div></div>
                    <div className="text-right"><div className="text-[7px] text-slate-500 uppercase tracking-wide">ハイスコア</div><div className="text-xs font-black text-amber-400">{(highScores[key]||0).toLocaleString()}</div></div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}

        {/* BREEDER MARKET */}
        {gameState==='BREEDER_MARKET'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
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
              <button onClick={()=>{setManagementTab(rosterTab==='monster'?'monster':'breeder');setGameState('MB_MANAGEMENT');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
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
                          {isMasu?(<><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/></>):(<img src={base.iconUrl} alt={base.name} className="w-full h-full object-cover"/>)}
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
                <div className="flex-1"><h3 className="text-xl font-black text-white">{rosterDetailMon.name}</h3><div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Monster Profile{rosterDetailMon.masuId&&<span className="ml-1 text-pink-400">・マスモン({ALL_PLAYER_MONSTERS[rosterDetailMon.id]?.name})</span>}</div>{rosterDetailMon.masuId?bondGaugeNode(rosterDetailMon.masuId):<div className="text-[8px] text-slate-500 font-bold mt-1">勇者モンとして選んでラン終了時に登録すると「マスモン」化できます</div>}</div>
                <button onClick={()=>setRosterDetailMon(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                {renderMonsterDetailInfo(rosterDetailMon)}
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
              <button onClick={()=>setGameState('MB_MANAGEMENT')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-cyan-400 uppercase tracking-widest">ベースモン一覧</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-1 px-1 shrink-0">解放済み{unlockedMonsterIds.length}体・タップで詳細を確認できます</div>
            {renderMonsterSortFilterBar({ singleType: true })}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              <div className="grid grid-cols-3 gap-2.5 pb-4">
                {unifiedMonsterEntriesSingleType.filter(e=>e.type==='base').map(e=>{
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

        {gameState==='PASTURE_SETTINGS'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('MB_MANAGEMENT')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-emerald-300">放牧設定</h2>
              <div className="min-w-[52px] text-center text-sm font-black text-emerald-200">{draftHomePastureIds.length} / 5</div>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-3 px-1 shrink-0">HOMEに表示するマスモンをタップで選択してください。0体でも保存できます。</div>
            <div className="grid grid-cols-5 gap-2 mb-2 shrink-0" aria-label="選択中の放牧マスモン">
              {Array.from({length:5},(_,index)=>{const id=draftHomePastureIds[index],masu=id?masuMons.find(m=>String(m.id)===id):null,base=masu&&ALL_PLAYER_MONSTERS[masu.baseId];return masu&&base?(
                <button key={id} onClick={()=>toggleDraftPasture(id)} aria-label={`${masu.name}を放牧から外す`} className="relative min-w-0 aspect-square rounded-full border-2 border-emerald-300 bg-emerald-950 active:scale-90 overflow-hidden">
                  <DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/>
                  <RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/>
                </button>
              ):<div key={`empty-${index}`} className="aspect-square rounded-full border-2 border-dashed border-slate-700 bg-slate-900/50" aria-hidden="true"/>;})}
            </div>
            {renderMonsterSortFilterBar({singleType:true})}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              <div className="grid grid-cols-3 gap-2.5 pb-4">
                {sortMonsterEntries(buildUnifiedMonsterEntries([],masuMons,monsterRosterIds)).filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e,monsterDisplayFlags)).map(({masu,base})=>{
                  const id=String(masu.id), selected=draftHomePastureIds.includes(id), disabled=!selected&&draftHomePastureIds.length>=5;
                  const lvl=masuBondLevelInfo(masu);
                  return <div key={id} className="relative"><button disabled={disabled} onClick={()=>toggleDraftPasture(id)} aria-pressed={selected} className={`w-full relative rounded-2xl border-2 p-2 flex flex-col items-center gap-1 active:scale-95 ${selected?'border-emerald-300 bg-emerald-950/80 ring-2 ring-emerald-400/30':'border-slate-800 bg-slate-900'} disabled:opacity-35`}>
                    {selected&&<span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs">✓</span>}
                    <div className="relative w-12 h-12"><div className="w-12 h-12 rounded-full overflow-hidden border border-pink-400/40"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/></div>
                    <div className="text-[9px] font-black text-pink-100 truncate w-full text-center">{masu.name}</div>
                    <div className="text-[7px] text-pink-300 font-black"><Heart size={6} className="inline"/> 絆Lv.{lvl.level}</div>
                  </button><button onClick={(ev)=>{ev.stopPropagation();setMasuMonDetail(masu);}} aria-label={`${masu.name}の詳細`} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button></div>;
                })}
              </div>
            </div>
            <button onClick={savePastureSettings} className="w-full min-h-[52px] shrink-0 rounded-2xl bg-emerald-600 text-white font-black shadow-lg active:scale-[.98]">決定（{draftHomePastureIds.length}体）</button>
          </div>
        )}

        {/* マスモン一覧: ラン終了時に登録した固有インスタンス。タップで詳細・改名・強化ポイント使用 */}
        {gameState==='MASU_MONS'&&(
          <div className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>setGameState('MB_MANAGEMENT')} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-pink-400 uppercase tracking-widest">マスモン一覧</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-1 px-1 shrink-0">勇者モンをラン終了時に登録すると、ここに並びます。編成画面で選ぶと次の周回で使えます(同じ種は1体まで)。</div>
            {renderMonsterSortFilterBar({ singleType: true })}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              {(()=>{
                const entries = unifiedMonsterEntriesSingleType.filter(e=>e.type==='masu');
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
                              <div className={`w-12 h-12 rounded-full overflow-hidden border ${fusionCount>0?'border-amber-400 ring-1 ring-amber-400':'border-pink-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className="w-full h-full object-cover"/></div><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/>
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
          const closeFusion = () => { resetFusionFlow(); setGameState('TEMPLE'); };
          const fusedBorder = (masu) => (masu.fusionHistory||[]).length>0 ? 'border-amber-400 ring-1 ring-amber-400' : 'border-violet-400/40';
          // 合体の仕様説明。何が引き継がれて何が消えるのか、固有技の引き継ぎ条件は何かが
          // 画面から読み取れず分かりにくかったため、選択画面の余白に常設で出す
          // 合体画面の一覧の並べかえ。押すたびに昇順/降順が入れ替わる
          const FUSION_SORT_OPTIONS = [
            { key: 'bond', label: '絆レベル' },
            { key: 'lineage', label: '血統' },
            { key: 'name', label: '名前' },
            { key: 'fused', label: '合体回数' },
          ];
          const sortMasuList = (list) => {
            const dir = fusionSortDir === 'asc' ? 1 : -1;
            const val = (m) => {
              if (fusionSortKey === 'bond') return bondLevelInfo(m.bondXp||0).level;
              if (fusionSortKey === 'fused') return (m.fusionHistory||[]).length;
              if (fusionSortKey === 'lineage') return (ALL_PLAYER_MONSTERS[m.baseId]||{}).name || '';
              return m.name || '';
            };
            return [...list].sort((a,b)=>{
              const va = val(a), vb = val(b);
              if (typeof va === 'string') return va.localeCompare(vb, 'ja') * dir;
              return (va - vb) * dir;
            });
          };
          const fusionSortBar = (
            <div className="flex gap-1.5 mb-2 shrink-0 overflow-x-auto scrollbar-hide">
              {FUSION_SORT_OPTIONS.map(o=>{
                const active = fusionSortKey === o.key;
                return (
                  <button key={o.key} onClick={()=>{ if(active) setFusionSortDir(d=>d==='asc'?'desc':'asc'); else { setFusionSortKey(o.key); setFusionSortDir('desc'); } }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black border active:scale-95 ${active?'bg-violet-600 border-violet-400 text-white':'bg-slate-900 border-white/10 text-slate-400'}`}>
                    {o.label}{active&&<span className="ml-0.5">{fusionSortDir==='asc'?'▲':'▼'}</span>}
                  </button>
                );
              })}
            </div>
          );
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
                {fusionSortBar}
                <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                  <div className="grid grid-cols-3 gap-2.5 pb-4">
                    {sortMasuList(masuMons).map(masu=>{
                      const base = ALL_PLAYER_MONSTERS[masu.baseId];
                      if (!base) return null;
                      const lvl = bondLevelInfo(masu.bondXp||0);
                      return (
                        <div key={masu.id} className="relative">
                          <button onClick={()=>{setFusionMainId(masu.id); setFusionStep('sub');}} className="w-full rounded-2xl border-2 border-violet-900/50 bg-slate-900 p-2 flex flex-col items-center gap-1 active:scale-95">
                            <div className="relative w-12 h-12 shrink-0"><div className={`w-12 h-12 rounded-full overflow-hidden border ${fusedBorder(masu)}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/></div>
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
            const candidates = sortMasuList(masuMons.filter(m=>m.id!==fusionMainId));
            return (
              <div className="flex-1 flex flex-col h-full min-h-0 p-4">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <button onClick={()=>{setFusionMainId(null); setFusionStep('main');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                  <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体・副を選ぶ</h2>
                </div>
                <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">「{main.name}」に絆経験値を渡す「副」を選んでください。副は合体後にいなくなります</div>
                {fusionGuide}
                {fusionSortBar}
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
                              <div className="relative w-12 h-12 shrink-0"><div className={`w-12 h-12 rounded-full overflow-hidden border ${fusedBorder(masu)}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} draggable={false} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div><RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/></div>
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
          const ownedUniqueIds = new Set([uniqueLineageId(mainBase.unique, mainBase.id), ...(main.inheritedUniques || []).map(unique=>uniqueLineageId(unique))].filter(Boolean));
          const duplicateUnique = ownedUniqueIds.has(uniqueLineageId(subBase.unique, subBase.id));
          const canChooseInherit = mainLvl.level>=10 && subLvl.level>=10 && !!subBase.unique && !duplicateUnique;
            // 合体後にどうなるかを先に計算して見せる(実行してみないと分からない状態だったため)
            const afterXp = (main.bondXp||0) + (sub.bondXp||0);
            const afterLvl = bondLevelInfo(afterXp);
            const gainedLevels = afterLvl.level - mainLvl.level;
            const mainPointsNow = main.distAptPoints || 0;
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
                  {/* 合体後にどう変わるかの内訳。実行前に結果が分かるようにしている */}
                  <div className="bg-black/40 p-3 rounded-xl border border-pink-500/30 mb-2">
                    <div className="text-[9px] font-black text-pink-300 uppercase tracking-wider mb-2">合体後の「{main.name}」</div>
                    <div className="grid grid-cols-3 items-center gap-1 mb-2">
                      <div className="text-center">
                        <div className="text-[7px] text-slate-500 font-bold">いま</div>
                        <div className="text-[15px] font-mono font-black text-slate-300">絆Lv.{mainLvl.level}</div>
                      </div>
                      <div className="text-center text-slate-500 text-[14px] font-black">→</div>
                      <div className="text-center">
                        <div className="text-[7px] text-pink-400 font-bold">合体後</div>
                        <div className="text-[15px] font-mono font-black text-pink-300">絆Lv.{afterLvl.level}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">絆レベル</span><span className={`font-black ${gainedLevels>0?'text-pink-300':'text-slate-400'}`}>{gainedLevels>0?`+${gainedLevels}`:'変化なし'}</span></div>
                      <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">絆経験値</span><span className="text-white font-black">{(main.bondXp||0).toLocaleString()} → {afterXp.toLocaleString()} XP</span></div>
                      <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">次のレベルまで</span><span className="text-slate-300 font-black">{afterLvl.xpIntoLevel.toLocaleString()} / {afterLvl.xpForNext.toLocaleString()} XP</span></div>
                      <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">強化ポイント</span><span className={`font-black ${gainedLevels>0?'text-amber-300':'text-slate-400'}`}>{mainPointsNow} → {mainPointsNow + gainedLevels}{gainedLevels>0&&<span className="text-amber-200"> (+{gainedLevels})</span>}</span></div>
                    </div>
                    {gainedLevels===0&&<div className="text-[8px] text-slate-500 leading-relaxed mt-2">※ 絆経験値は加算されますが、次のレベルには届きません(強化ポイントは増えません)</div>}
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
                  {duplicateUnique&&<div className="text-[9px] text-slate-400 font-bold bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 mb-2">同じ固有技はすでに所持しているため引き継げません。</div>}
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
              <h2 className="text-xl font-black italic text-teal-400 uppercase tracking-widest">アイテム</h2>
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
                          } else if (BREEDER_MARKET_ITEMS.find(i=>i.id===pendingItemUse)?.bondXp) {
                            // 絆経験値のチケットは「何枚使うか」を決める画面へ進む
                            setXpTicketUse({ itemId: pendingItemUse, masuId: masu.id, count: 1 }); setPendingItemUse(null);
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

        {/* 絆経験値チケットをまとめて使う画面。枚数を動かすと、増える経験値と絆レベルの変化がその場で分かる */}
        {xpTicketUse&&(()=>{
          const item = BREEDER_MARKET_ITEMS.find(i=>i.id===xpTicketUse.itemId);
          const masu = getMasuMon(xpTicketUse.masuId);
          const base = masu && ALL_PLAYER_MONSTERS[masu.baseId];
          if (!item || !masu || !base) return null;
          const have = ownedItems[item.id]||0;
          const count = Math.max(1, Math.min(xpTicketUse.count||1, Math.max(1, have)));
          const gain = (item.bondXp||0) * count;
          const before = bondLevelInfo(masu.bondXp||0);
          const after = bondLevelInfo((masu.bondXp||0) + gain);
          const gaugePct = (l)=>Math.max(0, Math.min(100, (l.xpIntoLevel/Math.max(1,l.xpForNext))*100));
          const setCount = (n)=>setXpTicketUse(p=>({...p, count: Math.max(1, Math.min(have, n))}));
          return (
            <div className="fixed inset-0 flex flex-col p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.97)',zIndex:31500,paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <button onClick={()=>setXpTicketUse(null)} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                <h2 className="text-lg font-black italic text-teal-400 uppercase tracking-widest truncate">{item.name}を使う</h2>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
                <div className="bg-slate-900 border border-teal-500/40 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-teal-400/40 shrink-0"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white truncate">{masu.name}</div>
                      <div className="text-[9px] text-slate-500 font-bold truncate">({base.name})</div>
                      <div className="text-[10px] text-pink-300 font-black flex items-center gap-1 mt-0.5"><Heart size={10}/>絆Lv.{before.level}{after.level>before.level&&<span className="text-emerald-400"> → {after.level}</span>}</div>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">使う枚数</span>
                      <span className="text-[10px] font-mono font-black text-teal-300">所持 {have}枚</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={()=>setCount(count-1)} disabled={count<=1} className="w-10 h-10 flex items-center justify-center bg-slate-700 rounded-lg text-white disabled:opacity-20 active:scale-90 shrink-0"><MinusCircle size={20}/></button>
                      <div className="flex-1 min-w-0">
                        <input type="range" min="1" max={Math.max(1,have)} value={count} onChange={(e)=>setCount(Number(e.target.value))} className="w-full accent-teal-400" style={{accentColor:'#2dd4bf'}}/>
                        <div className="text-center text-2xl font-mono font-black text-white leading-none mt-1">{count}<span className="text-[10px] text-slate-500 font-black"> 枚</span></div>
                      </div>
                      <button onClick={()=>setCount(count+1)} disabled={count>=have} className="w-10 h-10 flex items-center justify-center bg-teal-600 rounded-lg text-white disabled:opacity-20 active:scale-90 shrink-0"><PlusCircle size={20}/></button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-3">
                      {[1,10,50].map(n=>(
                        <button key={n} onClick={()=>setCount(n)} disabled={have<n} className="py-1.5 rounded-lg bg-slate-800 border border-white/10 text-[10px] font-black text-slate-300 disabled:opacity-25 active:scale-95">{n}枚</button>
                      ))}
                      <button onClick={()=>setCount(have)} className="py-1.5 rounded-lg bg-slate-800 border border-teal-500/40 text-[10px] font-black text-teal-300 active:scale-95">最大</button>
                    </div>
                  </div>

                  <div className="mt-3 bg-black/30 rounded-xl p-3 border border-white/5">
                    <div className="flex justify-between items-center text-[11px] font-black mb-2">
                      <span className="text-slate-400 uppercase tracking-wider">もらえる絆経験値</span>
                      <span className="text-emerald-400 font-mono text-base">+{gain.toLocaleString()}</span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold mb-1">絆Lv.{before.level} → <span className="text-white font-black">Lv.{after.level}</span>{after.level>before.level&&<span className="text-emerald-400 font-black"> (+{after.level-before.level})</span>}</div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 relative">
                      <div className="h-full bg-slate-600 absolute inset-y-0 left-0" style={{width:`${gaugePct(before)}%`}}></div>
                      <div className="h-full bg-gradient-to-r from-pink-500 to-rose-400 absolute inset-y-0 left-0" style={{width:`${gaugePct(after)}%`}}></div>
                    </div>
                    <div className="text-[8px] text-slate-500 font-mono mt-1 text-right">次のLvまで あと {Math.max(0, after.xpForNext-after.xpIntoLevel).toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 mt-3">
                <button onClick={()=>setXpTicketUse(null)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-xs uppercase active:scale-95">やめる</button>
                <button onClick={()=>{ useBondXpTickets(item.id, masu.id, count); setXpTicketUse(null); }} disabled={have<=0} className="flex-[2] bg-teal-600 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 disabled:opacity-30">{count}枚 使う</button>
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
          // 詳細の表示内容は他のモンスター詳細と同じ共通実装を使う(勇者特性などの見落としを無くす)
          const mergedMasu = mergeMasuIntoMon(masu);
          const sp = masu.statPoints || {};
          const masuStatRow = (label, value, plus, color) => [label, (<>{value}{plus>0&&<span className="text-emerald-400 text-[8px]"> (+{plus})</span>}</>), color];
          return (
            <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:31000}}>
              <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
                <div className="flex items-center gap-4 border-b border-white/10 pb-4 shrink-0">
                  <div className="relative w-20 h-20 shrink-0">
                    <div className={`w-20 h-20 rounded-full overflow-hidden border ${(masu.fusionHistory||[]).length>0?'border-amber-400 ring-2 ring-amber-400':'border-pink-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                    {(masu.fusionHistory||[]).length>0&&<div className="absolute -bottom-1 -left-1 bg-amber-500 rounded-full px-1.5 py-0.5 text-[8px] font-black text-black leading-tight">+{masu.fusionHistory.length}</div>}
                    <RebirthStars count={masu.rebirthCount} className="mh-rebirth-stars-overlay"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <button onClick={()=>{setMasuRenameInput(masu.name); setShowMasuRenameModal(true);}} className="flex items-center gap-1.5 active:scale-95">
                      <h3 className="text-lg font-black text-white truncate">{masu.name}</h3><Edit3 size={12} className="text-slate-500 shrink-0"/>
                    </button>
                    <div className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">マスモン・元は{base.name}</div>
                    <div className="mt-1">
                      <div className="text-[9px] text-pink-300 font-black flex items-center gap-1"><Heart size={9}/>絆Lv.{lvl.level}</div>
                      <div className="flex items-center gap-2 text-[8px] font-black"><span className="text-violet-300">転生 {masu.rebirthCount||0}回</span><span className="text-cyan-300">上限 Lv.{masu.levelCap||INITIAL_MASU_LEVEL_CAP}</span></div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 mt-0.5"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pct}%`}}></div></div>
                      <div className="text-[7px] text-pink-400/70 font-mono mt-0.5">{lvl.xpIntoLevel.toLocaleString()} / {lvl.xpForNext.toLocaleString()} XP</div>
                    </div>
                  </div>
                  <button onClick={()=>setMasuMonDetail(null)} className="p-2 bg-white/5 rounded-full active:scale-90 shrink-0"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-2">
                  {renderMonsterDetailInfo(mergedMasu, {
                    statTitle: '現在のステータス(強化分込み)',
                    statValues: [
                      masuStatRow('ライフ', base.baseHp+(sp.hp||0), sp.hp||0, 'text-pink-400'),
                      masuStatRow('ちから', base.baseAtk+(sp.atk||0), sp.atk||0, 'text-red-400'),
                      masuStatRow('丈夫さ', base.baseDef+(sp.def||0), sp.def||0, 'text-emerald-400'),
                      masuStatRow('ガッツ', base.baseGuts+(sp.guts||0), sp.guts||0, 'text-amber-400'),
                    ],
                    aptPointsLabel: <div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {masu.distAptPoints||0}</div>,
                  })}
                  <div className="bg-black/40 p-2 rounded-xl border border-violet-500/30"><div className="text-[7px] text-violet-300 uppercase font-bold mb-1">所持固有技Lv</div>{getRebirthSkillChoices(masu).map(skill=>{const current=uniqueSkillAtLevel(skill.unique,skill.level);return <button key={skill.key} onClick={()=>setRosterSkillDetail({mon:{...mergedMasu,unique:current},kind:'unique'})} className="w-full flex justify-between text-[9px] py-1 text-left"><span>{current.name}</span><span className="text-amber-300 font-black">Lv.{skill.level} ›</span></button>;})}</div>
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
                  <div className="text-[8px] text-teal-400/80 font-bold text-center px-2">絆ポイントリセットの書・染色もどきは「アイテム」から使用できます</div>
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
          const backToList = () => { setGameState(masuEnhanceFrom||'MASU_MONS'); setMasuMonDetail(null); setMasuEnhanceFrom(null); setBulkPlan(null); };
          // --- まとめて振るモード ---
          const plan = bulkPlan || { apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0} };
          const planUsed = plan.apt.reduce((a,b)=>a+b,0) + Object.values(plan.stat).reduce((a,b)=>a+b,0);
          const planLeft = points - planUsed;
          // 下書き段階での間合い適性(何段階上がるか)。上限Mを超えないようにする
          const plannedGrade = (idx) => {
            const cur = DIST_APTITUDE_GRADES.indexOf((masu.distApt&&masu.distApt[idx])||'C');
            return DIST_APTITUDE_GRADES[Math.min(DIST_APTITUDE_GRADES.length-1, Math.max(0, cur + plan.apt[idx]))];
          };
          const canPlanApt = (idx) => planLeft>0 && DIST_APTITUDE_GRADES.indexOf(plannedGrade(idx)) < DIST_APTITUDE_GRADES.length-1;
          const addPlanApt = (idx, d) => setBulkPlan(p=>{const q=p?{apt:[...p.apt],stat:{...p.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}}; q.apt[idx]=Math.max(0,q.apt[idx]+d); return q;});
          const addPlanStat = (key, d) => setBulkPlan(p=>{const q=p?{apt:[...p.apt],stat:{...p.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}}; q.stat[key]=Math.max(0,(q.stat[key]||0)+d); return q;});
          const applyPlan = () => {
            const updated = spendPointsBulk(masu.id, plan);
            if (!updated) return;
            setMasuMonDetail(updated);
            saveMissionProgress('enhance');
            setBulkPlan(null);
            const lines = [];
            plan.apt.forEach((n,i)=>{ if(n>0) lines.push(`${RANGE_LABELS[i]}距離適性 +${n}`); });
            Object.entries(plan.stat).forEach(([k,n])=>{ if(n>0) lines.push(`${STAT_POINT_KEYS[k]} +${n*(STAT_POINT_GAIN[k]||1)}`); });
            setEffect({type:'enhance',label:'まとめて強化！',icon:'💪',monEmoji:base.emoji,imgUrl:base.iconUrl,baseId:masu.baseId,colors:getMasuColors(updated),subLabel:lines.join('\n')});
            setTimeout(()=>setEffect(null),1200);
          };
          return (
            <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 p-4 shrink-0 border-b border-white/10" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
                <button onClick={backToList} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-black italic text-amber-400 uppercase tracking-widest flex-1">マスモン強化</h2>
              </div>
              <div className="flex-1 overflow-y-auto mh-scroll p-4 space-y-3 max-w-md mx-auto w-full">

                {/* まとめて強化: 1ポイントずつタップするのが手間なので、
                    振り分けを下書きしてから一度に確定できるようにしている */}
                {points>0&&(
                  <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={14}/>まとめて強化</div>
                      <div className="text-[10px] font-black text-white">残り <span className={`font-mono text-[15px] ${planLeft>0?'text-amber-300':'text-slate-500'}`}>{planLeft}</span> / {points} pt</div>
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold mb-2">間合い適性</div>
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {RANGE_LABELS.map((label,idx)=>{
                        const g = plannedGrade(idx);
                        const added = plan.apt[idx];
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span>
                            <span className={`w-full text-center py-0.5 rounded-lg border text-[13px] font-black leading-none ${DIST_APTITUDE_COLOR[g]}`}>{g}</span>
                            <div className="flex items-center gap-1 w-full">
                              <button disabled={added<=0} onClick={()=>addPlanApt(idx,-1)} className="flex-1 text-[11px] font-black bg-slate-800 text-slate-300 rounded py-0.5 active:scale-90 disabled:opacity-20">−</button>
                              <span className="text-[9px] font-mono font-black text-amber-300 w-4 text-center">{added>0?`+${added}`:'0'}</span>
                              <button disabled={!canPlanApt(idx)} onClick={()=>addPlanApt(idx,1)} className="flex-1 text-[11px] font-black bg-amber-600 text-white rounded py-0.5 active:scale-90 disabled:opacity-20 disabled:bg-slate-700">＋</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold mb-2">ステータス</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {Object.entries(STAT_POINT_KEYS).map(([key,label])=>{
                        const n = plan.stat[key]||0;
                        const gain = n*(STAT_POINT_GAIN[key]||1);
                        return (
                          <div key={key} className="bg-black/40 border border-emerald-500/25 rounded-xl p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-emerald-300 font-black">{label}</span>
                              <span className="text-[10px] font-mono font-black text-white">{currentStatValue(key)}{gain>0&&<span className="text-emerald-400"> → {currentStatValue(key)+gain}</span>}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button disabled={n<=0} onClick={()=>addPlanStat(key,-1)} className="flex-1 text-[11px] font-black bg-slate-800 text-slate-300 rounded py-0.5 active:scale-90 disabled:opacity-20">−</button>
                              <span className="text-[9px] font-mono font-black text-amber-300 w-6 text-center">{n>0?`+${n}pt`:'0'}</span>
                              <button disabled={planLeft<=0} onClick={()=>addPlanStat(key,1)} className="flex-1 text-[11px] font-black bg-emerald-700 text-white rounded py-0.5 active:scale-90 disabled:opacity-20 disabled:bg-slate-700">＋</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button disabled={planUsed<=0} onClick={()=>setBulkPlan(null)} className="px-4 py-2.5 rounded-xl font-black text-[11px] bg-slate-800 text-slate-300 active:scale-95 disabled:opacity-30">リセット</button>
                      <button disabled={planUsed<=0} onClick={applyPlan} className="flex-1 py-2.5 rounded-xl font-black text-[12px] bg-gradient-to-r from-amber-600 to-orange-600 text-white active:scale-95 disabled:opacity-30 disabled:from-slate-700 disabled:to-slate-700 shadow-lg">{planUsed>0?`${planUsed}pt を使って強化する`:'振り分けてください'}</button>
                    </div>
                    <div className="text-[8px] text-slate-500 mt-2 leading-relaxed">※ 確定するまでポイントは減りません。1つずつ振りたい場合は下の各項目からも操作できます。</div>
                  </div>
                )}
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
                            saveMissionProgress('enhance');
                            const afterGrade=(updated.distApt&&updated.distApt[idx])||beforeGrade;
                            setEffect({type:'enhance',label:`${label}距離適性 強化！`,icon:'📈',monEmoji:base.emoji,imgUrl:base.iconUrl,baseId:masu.baseId,colors:getMasuColors(updated),subLabel:`${label}距離適性 ${beforeGrade} → ${afterGrade}`});
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
                          saveMissionProgress('enhance');
                          setEffect({type:'enhance',label:`${label}強化！`,icon:'💪',monEmoji:base.emoji,imgUrl:base.iconUrl,baseId:masu.baseId,colors:getMasuColors(updated),subLabel:`${label} ${before} → ${after}`});
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
              <div className="flex items-center gap-2">{debugBattle&&<span className="text-[7px] font-black text-fuchsia-300 border border-fuchsia-500/40 rounded px-1.5 py-0.5 tracking-widest">DEBUG</span>}<span className={`text-[8px] font-black bg-opacity-10 px-2 py-0.5 rounded border tracking-wider ${difficulty==='Hard'?'text-red-400 bg-red-500 border-red-500':'text-indigo-400 bg-indigo-500 border-indigo-500'}`}>WAVE {wave}/10</span><span className="text-[8px] font-black text-blue-400 flex items-center gap-1 uppercase tracking-widest"><Timer size={8}/> TURN {turnCount}/20</span></div>
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
                // 2枚目以降のカードは効果半減。processTurnと同じく「ブリーダーカード以外の枚数」で数える。
                // 保留中(タップしただけでまだ置いていない)カードは、まだ使っていないので枚数に数えない。
                // ここを数えてしまうと、1枚目なのに自分自身を2枚目とみなして半減表示になる。
                const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
                const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
                let committedTotal=0; let committedPenaltyCnt=0; let guardFlat=0; let guardMult=0;
                selectedCards.forEach(idx=>{
                  if(idx===pendingIdx) return;
                  const card=hand[idx]; const slotIdx=cardAssignments[idx];
                  const isPenalty=!isBreederCard(card);
                  const halved=isPenalty&&committedPenaltyCnt>0;
                  if(slotIdx!=null&&isAttackCard(card)) committedTotal+=getDmg(card,slotIdx,slots[slotIdx],0,0,halved);
                  const gw=guardCardWeight(card);
                  if(gw>0){ const e=halved?0.5:1; guardFlat+=GUARD_EVOLUTION[guardLevel].flat*gw*e; guardMult+=GUARD_EVOLUTION[guardLevel].mult*gw*e; }
                  if(isPenalty) committedPenaltyCnt++;
                });
                const committedGuard=guardValueOf(guardFlat,guardMult);
                // 保留カードがガードなら、置いたあとの合計軽減も出す
                const pendingGuardWeight=guardCardWeight(pendingCardObj);
                const pendingGuardHalved=pendingGuardWeight>0&&committedPenaltyCnt>0;
                const projectedGuard=pendingGuardWeight>0
                  ? guardValueOf(guardFlat+GUARD_EVOLUTION[guardLevel].flat*pendingGuardWeight*(pendingGuardHalved?0.5:1), guardMult+GUARD_EVOLUTION[guardLevel].mult*pendingGuardWeight*(pendingGuardHalved?0.5:1))
                  : committedGuard;
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
                    pendingValidSlot=i; pendingAdd=getDmg(pendingCardObj,i,s,0,0,!isBreederCard(pendingCardObj)&&committedPenaltyCnt>0); break;
                  }
                }
                const projectedTotal=committedTotal+pendingAdd;
                const showProjected=pendingIsAtk&&pendingValidSlot!=null&&pendingAdd>0;
                // 合計軽減は、ガードを置いたぶんの合計。2枚目以降のガードは半分で計算される。
                const showGuardProjected=pendingGuardWeight>0&&projectedGuard>committedGuard;
                const showDmg=committedTotal>0||showProjected;
                const showGuard=committedGuard>0||showGuardProjected;
                if(!showDmg&&!showGuard) return null;
                return(
                  <div className="absolute left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center justify-center gap-1 pointer-events-none" style={{bottom:'calc(78% + 2px)'}}>
                    {showDmg&&(
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
                    )}
                    {showGuard&&(
                    <div className={`flex items-center gap-2 px-3 py-0.5 rounded-full border shadow-lg ${showGuardProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-emerald-950/90 border-emerald-500/50'} backdrop-blur-sm`}>
                      <Shield size={11} className={showGuardProjected?'text-yellow-400':'text-emerald-400'}/>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">合計軽減</span>
                      {showGuardProjected?(
                        <span className="text-[11px] font-black font-mono flex items-center gap-1">
                          <span className="text-slate-400">{committedGuard}</span>
                          <span className="text-yellow-400">+{projectedGuard-committedGuard}</span>
                          <ChevronRight size={10} className="text-slate-500"/>
                          <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedGuard}</span>
                        </span>
                      ):(
                        <span className="text-[11px] font-black font-mono text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">{committedGuard}</span>
                      )}
                    </div>
                    )}
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
                  // 保留中のカードはまだ使っていないので、「何枚目か」の枚数には数えない
                  const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
                  // Can this slot accept the pending card?
                  let canAssign=false;
                  if(s && pendingCardObj){
                    canAssign = assignedCount<maxUses;
                    if(pendingCardObj.type==='unique') canAssign = canAssign && (pendingCardObj.ownerSlotIdx===i);
                  }
                  // 選択順に「ブリーダーカード以外」を数え、どのカードが2枚目以降(効果半減)かを出す。
                  // 保留中のカードはまだ使っていないので数えない。
                  const halvedByIdx={};
                  {let n=0; selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; const c=hand[idx]; const p=!isBreederCard(c); halvedByIdx[idx]=p&&n>0; if(p) n++; });}
                  // Preview damage:
                  // - if a card is pending assignment, show what THIS card would do on this monster
                  // - otherwise show the sum of damage from cards already assigned to this slot,
                  //   using the GLOBAL attack order (2nd+ attack = half damage), matching processTurn
                  let previewDmg=0; let isPendingPreview=false; let isPendingHalved=false;
                  if(s && pendingCardObj && canAssign && isAttackCard(pendingCardObj)){
                    // 既に選んだ「ブリーダーカード以外」の枚数を数え、保留カードはその次の1枚として扱う
                    let committedPenalty=0;
                    selectedCards.forEach(idx=>{if(idx!==pendingIdx&&!isBreederCard(hand[idx]))committedPenalty++;});
                    const isSecondOrLater = committedPenalty>=1 && !isBreederCard(pendingCardObj);
                    const baseDmg=getDmg(pendingCardObj,i,s,0,0,isSecondOrLater);
                    previewDmg=baseDmg+getComboBonusDmg(pendingCardObj,s,baseDmg);
                    isPendingPreview=true; isPendingHalved=isSecondOrLater;
                  } else if(s){
                    // 選択順で「ブリーダーカード以外」を数え、2枚目以降は半減として予測する
                    let globalPenaltyCnt=0;
                    selectedCards.forEach(idx=>{
                      if(idx===pendingIdx) return;
                      const card=hand[idx];
                      const isPenalty=!isBreederCard(card);
                      const halved=isPenalty&&globalPenaltyCnt>0;
                      if(cardAssignments[idx]===i){
                        const baseDmg=getDmg(card,i,s,0,0,halved);
                        previewDmg+=baseDmg+getComboBonusDmg(card,s,baseDmg);
                      }
                      if(isPenalty)globalPenaltyCnt++;
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
                    {(()=>{const uOptions=getAvailableUniquesForSlot(s,ownedUniques,i); if(uOptions.length<2) return null; const curKey=slotUniqueChoice[i]||'own'; const curIdx=Math.max(0,uOptions.findIndex(o=>o.key===curKey));
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
                          {slotAssignedCards.map(({idx,card})=>{
                            // ガードは軽減量をその場で出す。2枚目以降なら半分になった値をそのまま表示する
                            const gw=guardCardWeight(card), ge=halvedByIdx[idx]?0.5:1;
                            const gv=gw>0?guardValueOf(GUARD_EVOLUTION[guardLevel].flat*gw*ge,GUARD_EVOLUTION[guardLevel].mult*gw*ge):0;
                            return(
                            <div key={idx} className={`flex items-center gap-0.5 px-1 rounded w-full justify-center min-w-0 ${cardNeedsMonster(card)?'bg-red-600/85':'bg-emerald-600/85'}`}>
                              <span style={{fontSize:'7px'}} className="leading-none shrink-0">{cardIconNode(card.icon,9)}</span>
                              <span style={{fontSize:'7px'}} className="font-black text-white leading-none truncate min-w-0">{halvedByIdx[idx]?'½':''}{card.name}</span>
                              {gv>0&&<span style={{fontSize:'7px'}} className="font-black text-emerald-100 leading-none shrink-0">-{gv}</span>}
                            </div>
                            );
                          })}
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
                      {previewDmg>0&&(<div className={`absolute ${slotAssignedCards.length>0?'top-[18px]':'top-0'} ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'} text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg z-50 animate-bounce ring-1`}>{isPendingPreview&&isPendingHalved?'½ ':''}DMG:{previewDmg}</div>)}
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
          <div className="mb-2 text-center flex items-center justify-between px-2 shrink-0"><button onClick={returnToHome} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">{gameState==='PICK_HERO'?'勇者モンを選択':'供モンを選択'}</h2><div className="w-10"></div></div>
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
                  {/* 表示内容は共通実装(renderMonsterDetailInfo)。この画面だけの違いは
                      「現在値 → 合流後」のステータス表記と、強化Pの割り振りボタン。 */}
                  {renderMonsterDetailInfo(currentPickingMon, {
                    statValues: gameState==='PICK_HERO' ? null : [
                      ['ライフ', `${maxHp} → ${maxHp+(currentPickingMon.plusStats?.hp||0)}`, 'text-pink-400'],
                      ['ちから', `${atk} → ${atk+(currentPickingMon.plusStats?.atk||0)}`, 'text-red-400'],
                      ['丈夫さ', `${def} → ${def+(currentPickingMon.plusStats?.def||0)}`, 'text-emerald-400'],
                      ['ガッツ', `${maxGuts} → ${maxGuts+(currentPickingMon.plusStats?.guts||0)}`, 'text-amber-400'],
                    ],
                    statTitle: gameState==='PICK_HERO' ? '基本ステータス' : '基本ステータス(現在 → 合流後)',
                    aptPointsLabel: currentPickingMon.masuId?<div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {getMasuMon(currentPickingMon.masuId)?.distAptPoints||0}</div>:null,
                    aptExtra: (idx,grade)=>{const pts=currentPickingMon.masuId?(getMasuMon(currentPickingMon.masuId)?.distAptPoints||0):0; const canUp=pts>0 && DIST_APTITUDE_GRADES.indexOf(grade)<DIST_APTITUDE_GRADES.length-1; return canUp?<button onClick={()=>{const updated=spendAptPoint(currentPickingMon.masuId,idx); if(updated) setCurrentPickingMon(mergeMasuIntoMon(updated));}} className="w-full text-[8px] font-black bg-amber-600 text-white rounded py-0.5 active:scale-95">+1</button>:null;},
                    extraAfterApt: (<>
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
                    </>),
                  })}
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
              {s?(s.imgUrl?<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} className="w-10 h-10 mt-1 object-contain drop-shadow-md scale-125"/>:<span className="text-xl mt-1 drop-shadow-md">{s.emoji}</span>):<PlusCircle className="text-white/50 mt-1" size={20}/>}
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
            {uniqueUpgradeEntries().map(e=>uniqueUpgradeRow(e))}
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
          <button onClick={handleNextWave} disabled={runFinalizing} aria-busy={runFinalizing} className={`w-full max-w-xs py-3 rounded-2xl font-black text-lg uppercase shadow-[0_0_20px_rgba(255,255,255,0.3)] shrink-0 ${runFinalizing?'bg-slate-500 text-slate-300 cursor-not-allowed':'bg-white text-indigo-900 active:scale-95'}`}>{runFinalizing?'処理中…':<>次へ進む <ChevronRight className="inline" size={20}/></>}</button>
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
            {helpTab==='goal'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-emerald-400 font-black text-base mb-3 flex items-center gap-2"><Trophy size={18}/> ゲームの目的</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">勇者モンを選び、カードで戦いながら全10 WAVEを進み、ラスボス「ムー」の撃破と最高スコアを目指します。</p><div className="grid grid-cols-2 gap-3"><div className="bg-black/50 p-3 rounded-2xl border border-white/5"><div className="text-[9px] text-slate-500 font-black uppercase mb-1">勝利条件</div><div className="text-[11px] text-white font-bold leading-tight">WAVE 10のラスボス「ムー」を撃破すること</div></div><div className="bg-black/50 p-3 rounded-2xl border border-white/5"><div className="text-[9px] text-slate-500 font-black uppercase mb-1">敗北条件</div><div className="text-[11px] text-white font-bold leading-tight">・ライフが0になる<br/>・20ターン経過</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-emerald-400 font-black text-base mb-3">基本的な流れ</h3><div className="space-y-3">{[{step:"1",text:"勇者モン（1体目）を選んでスタート"},{step:"2",text:"カードを選び、対象のモンスター枠をタップして決定"},{step:"3",text:"報酬を選んで強化（WAVE 2,4,6で仲間が合流）"},{step:"4",text:"WAVEごとに強化し、10 WAVE目のムー撃破を目指す"}].map(item=>(<div key={item.step} className="flex items-center gap-4"><span className="shrink-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-[11px] font-black">{item.step}</span><span className="text-[12px] text-slate-300">{item.text}</span></div>))}</div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-300 font-black text-base mb-3 flex items-center gap-2"><Trophy size={18}/> 難易度とランキング</h3><p className="text-[12px] text-slate-200 leading-relaxed">HOMEの「バトル」から難易度を選びます。難しいほど敵が強くなり、スコアと獲得ダイヤの倍率も上がります。同じ画面の「ランキング」で、難易度別スコア・ブリーダーLv・絆Lvを確認できます。</p></section></div>)}
            {helpTab==='battle' &&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-blue-400 font-black text-base mb-3 flex items-center gap-2"><Target size={18}/> 距離システム</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">自分と敵の「距離」が威力を左右します。このゲーム最大の戦略要素です。</p><div className="space-y-3"><div className="bg-black/50 p-4 rounded-2xl border border-blue-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">距離の一致（超重要）</div><div className="text-[12px] text-slate-400 leading-relaxed">敵と同じ距離枠にいるモンスターで攻撃すると大ダメージ！距離がずれるほど威力は低下します。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">解析と予測</div><div className="text-[12px] text-slate-400 leading-relaxed">敵は移動することがあります。「解析ボタン」で敵の行動を予測し、防御か攻撃か判断しましょう。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-teal-400 font-black text-base mb-3 flex items-center gap-2"><Target size={18}/> 間合い適性</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">モンスターごとに4つの距離それぞれで得意・不得意があり、C(標準・±0%)を基準にG(-20%)〜M(+25%)のグレードでダメージが変動します。モンスター詳細画面のグレード表示で確認できます。</p><div className="text-[11px] text-slate-400 leading-relaxed">絆レベルが上がると貯まる「強化ポイント」を1つ消費すると、詳細画面からその距離の適性グレードを1段階アップできます(上限はM)。</div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Zap size={18}/> GUTSの管理</h3><p className="text-[12px] text-slate-200 leading-relaxed">行動にはガッツを消費します。ガッツは毎ターン自動回復しますが、上限を増やすことで強力な技を安定して使えます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-cyan-400 font-black text-base mb-3 flex items-center gap-2"><Crown size={18}/> 勇者特性・固有技</h3><p className="text-[12px] text-slate-200 leading-relaxed">最初に選ぶ「勇者モン」ごとに専用の特性(勇者モン選択時のみ発動)と、進化する固有技(必殺技)を持ちます。編成する勇者モンによって戦い方が大きく変わります。詳しくは召喚時のモンスター詳細で確認できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-blue-300 font-black text-base mb-3 flex items-center gap-2"><Activity size={18}/> 緊急回復</h3><p className="text-[12px] text-slate-200 leading-relaxed">画面左下の「緊急」ボタンでライフとガッツをそれぞれ最大値の30%回復できます。ただし使用すると自分のターンを消費し、敵の行動が発生します。回数制限はありません。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-pink-400 font-black text-base mb-3 flex items-center gap-2"><Heart size={18}/> 合流ボーナス</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">WAVE 2・4・6で仲間が合流すると、そのモンスターの合流ボーナス分だけライフ・ちから・丈夫さ・ガッツが上がります。</p><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[12px] text-slate-400 leading-relaxed">さらに、合流したモンスターの<span className="text-white font-bold">間合い適性</span>も加算されます。Cを±0として、Aなら+2段階、Eなら-2段階というように、得意・不得意がそのまま反映されます。合流させる順番や組み合わせで、狙った距離を伸ばせます。</div></div></section></div>)}
            {helpTab==='growth'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-purple-400 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> 能力覚醒（報酬）</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-4">WAVEクリア後、3つの能力から1つを選んで強化します。</p><div className="grid grid-cols-3 gap-2"><div className="bg-red-900/30 border border-red-500/40 p-3 rounded-2xl text-center"><Sword size={16} className="mx-auto text-red-400 mb-2"/><div className="text-[10px] font-black">攻撃覚醒</div></div><div className="bg-emerald-900/30 border border-emerald-500/40 p-3 rounded-2xl text-center"><Shield size={16} className="mx-auto text-emerald-400 mb-2"/><div className="text-[10px] font-black">防御覚醒</div></div><div className="bg-pink-900/30 border border-pink-500/40 p-3 rounded-2xl text-center"><Heart size={16} className="mx-auto text-pink-400 mb-2"/><div className="text-[10px] font-black">精神強化</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><BookOpen size={18}/> ブリーダー継承</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">WAVE 1,3,5,7,9で、ブリーダーの「教え」をカードとして加えられます。同じ教えを重ねると「進化」し、効果が飛躍的に高まります(最大Lv2)。編成したブリーダーカードの中から候補が出ます。</p><div className="grid grid-cols-2 gap-2">{[{n:"おりょうの力",d:"攻撃ステータスUP"},{n:"ドラの緑膝",d:"被ダメージDOWN"},{n:"かどみうむの計算",d:"自動ライフ/ガッツ回復UP"},{n:"みゅあの愛",d:"回復＆能力永続UP"},{n:"あつの挑発",d:"敵行動無効＆攻撃"},{n:"みゃるの薬",d:"次ターン攻撃2倍＆自傷"}].map(c=>(<div key={c.n} className="bg-black/50 p-2.5 rounded-xl border border-white/5"><div className="text-[10px] font-black text-white">{c.n}</div><div className="text-[9px] text-slate-400">{c.d}</div></div>))}</div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-cyan-400 font-black text-base mb-3 flex items-center gap-2"><Zap size={18}/> 技レベル</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">通常技・距離技・固有技には段階があります。通常技・距離技は、その距離にいる味方の間合い適性と距離ダメージ補正で上位段階が解放されます。固有技はバトル中の強化ポイントで強化します。上位ほど強力ですが、消費ガッツも増えます。</p><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[12px] text-slate-400 leading-relaxed">バトル中はタイル選択式で、解放済みのレベルであれば下位の技に戻して使うこともできます(消費ガッツを節約したいときに便利です)。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-emerald-400 font-black text-base mb-3 flex items-center gap-2"><Sword size={18}/> ガード</h3><p className="text-[12px] text-slate-200 leading-relaxed">ガードカードの軽減量は<span className="text-white font-bold">固定値＋(丈夫さ×倍率)</span>で決まります(ガード=200＋丈夫さ×1.1、ハイガード=300＋丈夫さ×1.2)。丈夫さが100上がるごとに上位のガードが解放され、手札に入るガードの枚数も増えます。</p></section></div>)}
            {helpTab==='meta'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Crown size={18}/> ブリーダーレベル</h3><p className="text-[12px] text-slate-200 leading-relaxed">WAVEをクリアするとブリーダー経験値を獲得してレベルアップします。レベルが上がるたびにブリーダーポイント(pt)を1獲得できます。ptはマーケットのアイコン購入に使います。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-violet-400 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> マスモン</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">プレイ終了後のリザルト画面で、そのとき勇者モンだったモンスターに名前を付けて登録できます。登録した個体を<span className="text-white font-bold">マスモン</span>と呼び、絆レベル・強化ポイント・見た目の色をその個体だけのものとして持ち続けます。同じ種類でも別々に育てられます。</p><div className="bg-black/50 p-4 rounded-2xl border border-violet-500/30"><div className="text-[11px] font-black text-white mb-1">強化ポイントの使い道</div><div className="text-[12px] text-slate-400 leading-relaxed">絆レベルが1上がるごとに1ポイント獲得します。1ポイント消費して、間合い適性を1段階上げるか、ライフ・ちから・丈夫さ・ガッツのいずれかを上げられます。振り直したいときはマーケットの「絆ポイントリセットの書」を使います。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-300 font-black text-base mb-3 flex items-center gap-2"><Gem size={18}/> 寄付</h3><p className="text-[12px] text-slate-200 leading-relaxed">HOMEの「神殿」内にある「寄付」は、マスモンを手放し、累計絆経験値と同じ数のダイヤを受け取る機能です。寄付は取り消せず、手放したマスモンは元に戻せません。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-pink-400 font-black text-base mb-3 flex items-center gap-2"><Heart size={18}/> 絆レベル</h3><p className="text-[12px] text-slate-200 leading-relaxed">勇者モンに選んだモンスターは、WAVEクリアごとに絆経験値を獲得して絆レベルが上がります(WAVEが進むほど1回あたりの獲得量も増加)。供モンとして合流したマスモンにも経験値が入ります。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-violet-300 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> 合体</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">HOMEの「神殿」内にある「合体」から、マスモン同士を合体できます。残す側を<span className="text-white font-bold">主</span>、消える側を<span className="text-white font-bold">副</span>として選びます。</p><div className="space-y-2"><div className="bg-black/50 p-4 rounded-2xl border border-white/5"><div className="text-[12px] text-slate-300 leading-relaxed">副の絆経験値が累計のまま主に加算されます。合体では能力値・間合い適性・強化ポイントは増減しません。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-white/5"><div className="text-[12px] text-slate-300 leading-relaxed">主の名前・見た目・間合い適性・ステータス強化はそのまま維持されます(副の強化は引き継がれません)。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[12px] text-amber-200 leading-relaxed"><span className="font-bold">固有技の引き継ぎ</span>は、主と副が両方とも絆Lv.10以上のときだけ選べます。消費ダイヤは(主の絆Lv＋副の絆Lv)×100です。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-400 font-black text-base mb-3 flex items-center gap-2"><Coins size={18}/> pt とダイヤ(2つの通貨)</h3><div className="space-y-3"><div className="bg-black/50 p-4 rounded-2xl border border-amber-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">pt（ポイント）</div><div className="text-[12px] text-slate-400 leading-relaxed">ブリーダーレベルアップで獲得。マーケットの「アイコン」購入に使います。</div></div><div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30"><div className="text-[11px] font-black text-white mb-1 uppercase">ダイヤ</div><div className="text-[12px] text-slate-400 leading-relaxed">WAVEクリアで獲得(Normal基準100ダイヤ/WAVE、難易度で変動)。「円盤石」「ブリーダー」「アイテム」の購入と、合体の費用に使います。神殿でマスモンを寄付することでも獲得できます。</div></div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-orange-400 font-black text-base mb-3 flex items-center gap-2"><ShoppingBag size={18}/> マーケット</h3><p className="text-[12px] text-slate-200 leading-relaxed mb-3">HOMEの「マーケット」から入れます。4つのカテゴリがあります。</p><div className="grid grid-cols-2 gap-2"><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">アイコン</div><div className="text-[9px] text-slate-400">ptで購入<br/>プロフィール画像に</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">円盤石</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>新モンスター解放</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">ブリーダー</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>新カード解放</div></div><div className="bg-black/50 p-3 rounded-2xl text-center border border-white/5"><div className="text-[10px] font-black text-white mb-1">アイテム</div><div className="text-[9px] text-slate-400">ダイヤで購入<br/>マスモンに使う</div></div></div><div className="bg-black/50 p-4 rounded-2xl border border-white/5 mt-3"><div className="text-[11px] font-black text-white mb-1">アイテム</div><div className="text-[12px] text-slate-400 leading-relaxed"><span className="text-white font-bold">絆ポイントリセットの書</span>: 使用済みの強化ポイントをすべて未使用に戻します(絆レベル・絆経験値はそのまま)。<br/><span className="text-white font-bold">染色もどき</span>: 見た目の色を変えられます。モンスターによっては体・目・口などの部位ごとに別々の色を選べ、プリセット27色に加えてカスタムカラーも使えます。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-cyan-300 font-black text-base mb-3 flex items-center gap-2"><Info size={18}/> ベースモンとマスモン</h3><p className="text-[12px] text-slate-200 leading-relaxed">ベースモンはモンスター種の基本データです。マスモンはプレイ後に登録した育成個体で、名前・絆・強化・色・合体履歴を個別に持ちます。どちらの一覧もHOMEの「M/B管理」から開けます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> M/B管理と編成</h3><p className="text-[12px] text-slate-200 leading-relaxed">マーケットで新しいモンスターやブリーダーカードを解放しても、次の周回で候補になるのは編成で選んだものだけです。HOMEの「M/B管理」ではベースモン一覧、マスモン一覧、モンスター編成、ブリーダーカード編成を利用できます。編成ではモンスター8体・ブリーダーカード6枚をちょうど選び、「決定」ボタンで確定します(最初から解放済みの8体・6枚は編成済みです)。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-300 font-black text-base mb-3 flex items-center gap-2"><Trophy size={18}/> 最終リザルト</h3><p className="text-[12px] text-slate-200 leading-relaxed">優勝・敗北・リタイアいずれかでプレイが終了すると、獲得したブリーダー経験値・ダイヤ・絆経験値と、WAVEごとの獲得スコア/経験値/ダイヤの内訳を確認できます。この画面から勇者モンをマスモンとして登録できます。</p></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-amber-300 font-black text-base mb-3 flex items-center gap-2"><Sparkles size={18}/> 更新履歴</h3><p className="text-[12px] text-slate-200 leading-relaxed">HOME画面右上の「更新履歴」ボタンから、アップデート内容と不具合情報をタブで切り替えて確認できます。未読の更新があるときはNEWマークが付きます。</p></section></div>)}
            {helpTab==='tips'&&(<div className="space-y-5"><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-orange-400 font-black text-base mb-3 flex items-center gap-2"><Layers size={18}/> 複数枚同時使用の解放</h3><div className="bg-black/50 p-4 rounded-2xl space-y-2"><div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">同時2枚:</span><span className="text-white font-black">最大ガッツ120 ＋ 味方2体</span></div><div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">同時3枚:</span><span className="text-white font-black">最大ガッツ180 ＋ 味方3体</span></div><div className="text-[10px] text-amber-500 font-black italic pt-2 border-t border-white/5">※ハムは勇者時、常に上限＋1</div><div className="text-[10px] text-slate-400 font-bold pt-2 border-t border-white/5 leading-relaxed">※同じターンに2枚目以降で使ったカードは、ダメージもガードも効果が半分になります。ブリーダーカードは対象外で、何枚目に使っても効果は変わりません。</div></div></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-indigo-400 font-black text-base mb-3 flex items-center gap-2"><Activity size={18}/> 攻略のヒント</h3><ul className="text-[12px] text-slate-300 space-y-3 list-disc pl-5"><li><span className="font-black text-white">防御は最大の攻撃</span>: 敵の必殺技は即死級。解析を使い確実に防御しましょう。</li><li><span className="font-black text-white">再生の強化</span>: 教えにより毎ターンの「再生ライフ」を増やすと後半が有利になります。</li><li><span className="font-black text-white">勇者特性を理解する</span>: 1体目に選んだモンスターの特性は最後まで影響します。</li><li><span className="font-black text-white">データのバックアップ</span>: ホーム画面のアイコンを作り直すと進行状況が引き継がれないことがあります。HOMEの「設定」内にある「データ引き継ぎ」で定期的にコードを控えておくと安心です。</li></ul></section><section className="bg-slate-900/60 p-5 rounded-3xl border border-white/10 shadow-lg"><h3 className="text-slate-200 font-black text-base mb-3 flex items-center gap-2"><Settings size={18}/> プロフィールと設定</h3><div className="text-[12px] text-slate-300 leading-relaxed space-y-2"><p>プロフィールはHOME上部のプレイヤー情報から開き、名前・アイコン・難易度別記録・所持アイテムを確認できます。</p><p>ヘルプ、音量設定、データ引き継ぎ、タイトルへ戻る操作はHOMEの「設定」にあります。音量設定ではBGMとSEを個別に調整でき、引き継ぎコードは端末移行やバックアップに使えます。</p><p>更新履歴はHOME右上の独立した「更新履歴」ボタンから確認します。</p></div></section></div>)}
          </div>
          <footer className="shrink-0 p-5 bg-slate-900 border-t border-white/10 text-center" style={{backgroundColor:'#0f172a'}}>
            <button onClick={()=>setShowHelp(false)} className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase shadow-2xl active:scale-95 transition-transform">わかった！冒険に戻る</button>
            <button aria-label="" onClick={()=>{const options=getDebugEnemyOptions(difficulty);setDebugEnemyKey(options[0]?.key||null);debugBattleRef.current=false;setDebugBattle(false);setDebugOutcome(null);setShowHelp(false);setGameState('DEBUG_SETTINGS');}} className="mt-7 mx-auto block text-[10px] opacity-25 hover:opacity-40 active:opacity-60">💊</button>
          </footer>
        </div>
      )}

      {titleModal}

      {showOfficialTitleConfirm&&(<div className="fixed inset-0 flex items-center justify-center p-6" style={{position:'fixed',inset:0,zIndex:99000,backgroundColor:'rgba(0,0,0,0.94)'}}><div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 text-center"><h3 className="text-lg font-black mb-6">タイトル画面へ戻りますか？</h3><div className="space-y-3"><button onClick={()=>setShowOfficialTitleConfirm(false)} className="w-full bg-slate-800 py-3 rounded-xl font-black">キャンセル</button><button onClick={returnToOfficialTitle} className="w-full bg-red-600 py-3 rounded-xl font-black">タイトルへ戻る</button></div></div></div>)}

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
            const e = card.type==='atk'?BASE_ATK_EVOLUTION[lvl]:RANGE_EVOLUTION[lvl];
            const power = Math.floor(e.mult*100);
            // 消費ガッツは「基礎ガッツ × 現在の倍率 ÷ 基礎倍率」(getCardGutsと同じ式)
            const guts = Math.floor(e.baseGuts * (e.mult / (e.baseMult||1)));
            const crit = Math.round(e.crit*100);
            const effect = card.type==='atk' ? '敵1体を攻撃' : `${RANGE_LABELS[card.rangeIdx]}距離で威力アップ。攻撃後、${RANGE_LABELS[card.rangeIdx]}距離へ移動する`;
            return {key:String(lvl), label, power, guts, crit, effect, unlocked, isActive, onSelect:()=>applyAtkTierChoice(lvl)};
          });
        } else if (card.type==='unique') {
          const mon = slots[card.ownerSlotIdx];
          uniqueSources = getAvailableUniquesForSlot(mon, ownedUniques, card.ownerSlotIdx);
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
              const mult = u.baseMult+lvl*0.5;
              const power = Math.floor(mult*100);
              const guts = Math.floor((u.baseGuts||0) * (mult / (u.baseMult||1)));
              const crit = Math.round((0.10+0.05*Math.min(lvl,8))*100);
              return {key:String(lvl), label, power, guts, crit, effect:u.effectDesc, unlocked, isActive, onSelect:()=>applyUniqueLevelChoiceForSlot(card.ownerSlotIdx, lvl)};
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
                    // タブ名は「自分の技」「みゅあの技」ではなく血統名(ザン・ピクシー等)にする。
                    // 引き継いだ技は出どころが分かるよう色を変え、印を付ける
                    const isInherited = opt.key !== 'own';
                    const lineage = (ALL_PLAYER_MONSTERS[opt.unique.monId]||{}).name || opt.unique.monId || '?';
                    const activeCls = isInherited ? 'bg-amber-600 border-amber-300 text-white' : 'bg-indigo-600 border-indigo-300 text-white';
                    const idleCls = isInherited ? 'bg-amber-950/50 border-amber-600/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400';
                    return(<button key={opt.key} onClick={()=>applyUniqueChoiceForSlot(card.ownerSlotIdx,opt.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black border-2 whitespace-nowrap active:scale-95 ${isActiveSource?activeCls:idleCls}`}>{isInherited&&'⇄ '}{lineage}</button>);
                  })}
                </div>
              )}
              <div className="overflow-y-auto mh-scroll flex-1 grid grid-cols-1 gap-1.5 pt-1">
                {tiles.map(t=>(
                  <div key={t.key} className={`w-full rounded-xl border-2 transition-all ${t.unlocked?(t.isActive?'bg-indigo-600/40 border-indigo-400 ring-2 ring-indigo-300':'bg-slate-800/70 border-slate-600'):'bg-slate-950/60 border-slate-800 grayscale opacity-45'}`}>
                    <button disabled={!t.unlocked} onClick={()=>{t.onSelect(); setSkillPicker(null);}} className="w-full px-3 pt-2 pb-1.5 text-left active:scale-95">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-[11px] font-black truncate ${t.unlocked?'text-white':'text-slate-500'}`}>{t.label}{t.isActive&&<span className="ml-1 text-[8px] text-indigo-300">(使用中)</span>}</div>
                        {!t.unlocked&&<span className="text-[9px] text-slate-500 shrink-0">🔒未解放</span>}
                      </div>
                      {/* 技威力だけでは強さが分かりにくいため、消費ガッツと会心率も併記する */}
                      {t.unlocked&&(
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className="text-[9px] font-mono text-red-400 font-bold">威力 {t.power}</span>
                          {t.guts>0&&<span className="text-[9px] font-mono text-amber-400 font-bold">消費G {t.guts}</span>}
                          {t.crit>0&&<span className="text-[9px] font-mono text-yellow-300 font-bold">会心 {t.crit}%</span>}
                        </div>
                      )}
                      {t.sub&&<div className="text-[8px] text-amber-400 font-bold truncate mt-0.5">{t.sub}</div>}
                    </button>
                    {/* 効果の説明。枠に収まらない長さなら「詳細」から全文を見られるようにする */}
                    {t.unlocked&&t.effect&&(
                      <div className="flex items-center gap-1.5 px-3 pb-2">
                        <div className="text-[8px] text-slate-300 leading-tight flex-1 min-w-0 truncate">{t.effect}</div>
                        {t.effect.length>18&&(
                          <button onClick={(e)=>{e.stopPropagation(); setSkillEffectDetail({name:t.label, power:t.power, guts:t.guts, crit:t.crit, effect:t.effect});}} className="shrink-0 text-[8px] font-black text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 rounded-full px-2 py-0.5 active:scale-90">詳細</button>
                        )}
                      </div>
                    )}
                  </div>
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
            {focusedCard.type==='guard'&&(()=>{
              // 2枚目以降で使うガードは軽減量が半分になる。実際に効く値をそのまま出す。
              const raw=(focusedCard.flat||0)+def*(focusedCard.mult||0);
              const fIdx=hand.findIndex(c=>c&&c.uid===focusedCard.uid);
              let n=0, halved=false, found=false;
              selectedCards.forEach(idx=>{ if(idx===pendingCard) return; const c=hand[idx]; const p=!isBreederCard(c); if(idx===fIdx){ halved=p&&n>0; found=true; } if(p) n++; });
              if(!found) halved=n>0; // まだ置いていないカードは「次に使う1枚」として判定する
              return(<div className="text-center font-bold">敵の攻撃を最大 {Math.floor(halved?raw*0.5:raw)} 軽減{halved&&<span className="text-amber-300 font-black">（2枚目以降のため半減）</span>}<span className="text-slate-400 font-normal">（{focusedCard.flat||0} ＋ 丈夫さ×{focusedCard.mult||0}{halved?' の半分':''}）</span></div>);
            })()}
            {focusedCard.type==='range_atk'&&focusedCard.rangeIdx!=null&&(<div className="border-t border-white/10 pt-1 mt-1 text-[7px] text-cyan-200 font-bold"><span className="text-cyan-400">距離効果:</span> {RANGE_LABELS[focusedCard.rangeIdx]}距離で威力アップ。攻撃後、{RANGE_LABELS[focusedCard.rangeIdx]}距離へ移動する</div>)}
            {['buff','debuff','heal'].includes(focusedCard.type)&&(<div className="text-center italic text-amber-300 font-bold text-[7px] leading-tight">{getDynamicDesc(focusedCard,true,focusedCard.evoLevel||0)}</div>)}
            {focusedCard.effectDesc&&<div className="border-t border-white/10 pt-1 mt-1 text-[7px] text-amber-200 font-bold"><span className="text-indigo-400">特殊効果:</span> {focusedCard.effectDesc}</div>}
          </div>
        </div>
      )}

      {/* ENEMY INFO */}
      {/* 技の効果の全文表示。ピッカーの枠に収まらない説明を「詳細」から開く */}
      {skillEffectDetail&&(
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:70000}} onClick={()=>setSkillEffectDetail(null)}>
          <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-5 w-full max-w-xs shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <h3 className="text-[13px] font-black text-white truncate">{skillEffectDetail.name}</h3>
              <button onClick={()=>setSkillEffectDetail(null)} className="p-1.5 bg-white/10 rounded-full active:scale-90 shrink-0"><X size={14}/></button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-mono text-red-400 font-bold">威力 {skillEffectDetail.power}</span>
              {skillEffectDetail.guts>0&&<span className="text-[10px] font-mono text-amber-400 font-bold">消費G {skillEffectDetail.guts}</span>}
              {skillEffectDetail.crit>0&&<span className="text-[10px] font-mono text-yellow-300 font-bold">会心 {skillEffectDetail.crit}%</span>}
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-3">
              <div className="text-[9px] text-indigo-300 font-black uppercase tracking-wider mb-1">効果</div>
              <div className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">{skillEffectDetail.effect}</div>
            </div>
            <button onClick={()=>setSkillEffectDetail(null)} className="w-full bg-indigo-600 text-white py-2.5 rounded-2xl font-black text-[12px] mt-3 active:scale-95">閉じる</button>
          </div>
        </div>
      )}
      {(showEnemyInfo&&enemy||waveScanPreview)&&(()=>{const scanEnemy=waveScanPreview?.enemy||enemy;const scanDist=waveScanPreview?2:enemyDist;const scanBeforeBattle=!!waveScanPreview;const actions=enemyActionProbabilities(scanEnemy,scanDist);return (<div className="fixed inset-0 flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'#020617',zIndex:waveScanPreview?71000:40000,paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}} role="dialog" aria-modal="true" aria-label="敵行動詳細"><header className="flex justify-between items-center px-5 py-3 border-b border-white/10 shrink-0 bg-slate-950/95 z-10"><div><h3 className="font-black italic uppercase text-red-500 text-lg">Enemy Scan</h3>{waveScanPreview&&<small className="text-indigo-300 font-black">WAVE {waveScanPreview.wave}・戦闘開始前</small>}</div><button onClick={()=>{if(waveScanPreview)setWaveScanPreview(null);else setShowEnemyInfo(false);}} className="min-h-[44px] px-6 bg-white/10 rounded-full text-[11px] text-white active:scale-90">戻る</button></header><div className="flex-1 min-h-0 overflow-y-auto mh-scroll"><div className="w-full max-w-md mx-auto flex flex-col items-center text-center px-4 pb-8">{scanEnemy.imgUrl?(<div className={`${scanEnemy.id==='Moo'?'w-[min(92vw,380px)] h-[clamp(250px,38vh,310px)]':'w-[140px] h-[160px]'} flex shrink-0 items-center justify-center overflow-hidden`}><img src={scanEnemy.imgUrl} alt={scanEnemy.name} style={enemyArtStyle(scanEnemy.id,'scan')} className={`${scanEnemy.id==='Moo'?'w-[140px] h-[140px]':'w-[140px] h-[140px]'} object-contain drop-shadow-[0_0_50px_rgba(239,68,68,0.4)]`}/></div>):(<div style={{fontSize:'112px'}} className="my-4">{scanEnemy.emoji}</div>)}<h4 className="text-2xl font-black italic mb-4 uppercase shrink-0">{scanEnemy.name}</h4><section className="w-full space-y-3"><div className="grid grid-cols-2 gap-4 text-left bg-slate-900/60 p-4 rounded-2xl border border-white/5"><div><div className="text-[9px] text-pink-400 font-black">ライフ</div><div className="text-xl font-mono font-black">{scanEnemy.hp.toLocaleString()}</div></div><div><div className="text-[9px] text-red-400 font-black">攻撃力</div><div className="text-xl font-mono font-black">{scanEnemy.atk.toLocaleString()}</div></div></div><div className="text-left bg-slate-900/60 p-4 rounded-2xl border border-cyan-500/20"><div className="text-[9px] text-cyan-400 font-black">{scanBeforeBattle?'戦闘状況':'現在の間合い'}</div><b>{scanBeforeBattle?'戦闘開始前':`${RANGE_LABELS[scanDist]}距離`}</b></div><div className="space-y-2 text-left">{actions.map((action,index)=>{const actionName=action.type==='ATTACK'?(scanEnemy.normal||'通常攻撃'):action.type==='CHARGE'?(scanEnemy.special||'必殺技！'):action.type==='MOVE'?'間合い移動':'様子を見る';const power=Math.floor(scanEnemy.atk*action.multiplier);return <details key={action.id} open={index<2} className={`rounded-2xl border p-3 ${action.available?'bg-slate-900/80 border-white/10':'bg-slate-950 border-red-500/30'}`}><summary className="cursor-pointer list-none flex items-center justify-between gap-2"><span><b className="block">{actionName}</b><small className="text-slate-400">{action.category}</small></span><span className="text-right"><b className="text-amber-300">{(action.probability*100).toFixed(action.probability*100%1?1:0)}%</b>{!scanBeforeBattle&&enemyIntent?.actionId===action.id&&<small className="block text-cyan-300">予告中</small>}</span></summary><div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-white/10 text-[10px]"><span>威力倍率 <b>×{action.multiplier}</b></span><span>基準威力 <b>{power.toLocaleString()}</b></span><span>攻撃回数 <b>{action.hits}回</b></span><span>使用間合い <b>{action.range}</b></span><span className="col-span-2">発動条件 <b>{action.condition}</b></span><span className="col-span-2">移動効果 <b>{action.type==='MOVE'?`${RANGE_LABELS.filter((_,i)=>i!==scanDist).join('・')}距離のいずれかへ移動`:'なし'}</b></span><span className="col-span-2">バフ・デバフ・状態異常 <b>なし</b></span><span>クールダウン <b>{action.cooldown?`${action.cooldown}ターン`:'なし'}</b></span><span>回数制限 <b>{action.useLimit??'なし'}</b></span></div>{!action.available&&<div className="mt-2 text-[10px] text-red-300">現在は使用不可：{action.unavailableReason}</div>}</details>})}</div><aside className="text-left text-[10px] leading-relaxed text-slate-400 bg-black/30 rounded-xl p-3"><b className="block text-slate-200 mb-1">行動ルール</b>使用可能な行動の重みを合計100%に正規化して抽選します。移動が選ばれた場合は、現在以外の3間合いから同率で移動先を選びます。SCAN表示では抽選しません。</aside></section></div></div></div>);})()}
      {showHeroInfo&&mainHero&&(<div className="fixed inset-0 p-6 flex flex-col" style={{position:'fixed',inset:0,backgroundColor:'#020617',zIndex:40000,paddingTop:'calc(1.5rem + env(safe-area-inset-top))'}}><div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4"><h3 className="font-black italic uppercase text-indigo-400 text-lg">Hero Scan</h3><button onClick={()=>setShowHeroInfo(false)} className="px-6 py-2 bg-white/10 rounded-full text-[11px] text-white active:scale-90">戻る</button></div><div className="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto mh-scroll">{mainHero.imgUrl?(<DyedMonsterImage baseId={mainHero.id} src={mainHero.imgUrl} alt={mainHero.name} masuColors={mainHero.colors} style={{width:'140px',height:'140px'}} className="mx-auto mb-6 object-contain drop-shadow-[0_0_50px_rgba(99,102,241,0.4)]"/>):(<div style={{fontSize:'112px'}} className="mb-6 drop-shadow-[0_0_50px_rgba(99,102,241,0.4)]">{mainHero.emoji}</div>)}<h4 className="text-2xl font-black italic mb-6 uppercase">{mainHero.name}</h4><div className="w-full max-w-sm space-y-4 bg-slate-900/50 p-6 rounded-3xl border border-white/5"><div className="grid grid-cols-2 gap-6 text-left"><div><div className="text-[9px] text-pink-400 font-black uppercase">ライフ</div><div className="text-xl font-mono font-black">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</div></div><div><div className="text-[9px] text-red-400 font-black uppercase">攻撃力</div><div className="text-xl font-mono font-black">{atk}</div></div><div><div className="text-[9px] text-emerald-400 font-black uppercase">丈夫さ</div><div className="text-xl font-mono font-black">{def}{getPermaBuff('dmgCutPct')>0&&<span className="text-[10px] text-emerald-400 ml-1">(+{Math.round(getPermaBuff('dmgCutPct')*100)}%軽減)</span>}</div></div><div><div className="text-[9px] text-amber-400 font-black uppercase">ガッツ</div><div className="text-xl font-mono font-black">{guts} / {effectiveMaxGuts}</div></div></div><div className="bg-black/40 p-3 rounded-xl border border-indigo-500/30 text-left"><div className="text-[9px] text-indigo-400 uppercase font-black">勇者特性</div><div className="text-[11px] text-white font-bold leading-relaxed mt-1">{mainHero.traitDesc}</div></div></div></div></div>)}

      {/* ラン終了処理中は画面全体で入力を遮断する。ボタン自身のdisabledだけに頼らず、
          state反映後は背面のカード・モーダル・ナビゲーションにもタップを通さない。 */}
      {resultProcessing&&(
        <div
          role="status"
          aria-live="polite"
          aria-label="クリア結果を処理中"
          className="fixed inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm"
          style={{position:'fixed',inset:0,zIndex:120000,pointerEvents:'auto',touchAction:'none'}}
          onPointerDown={e=>e.preventDefault()}
          onClick={e=>e.preventDefault()}
        >
          <div className="rounded-2xl border border-white/20 bg-slate-950/90 px-6 py-4 text-sm font-black text-white shadow-2xl">処理中…</div>
        </div>
      )}

      {/* QUIT CONFIRM */}
      {showQuitConfirm&&(<div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.94)',zIndex:95000,pointerEvents:'auto'}}><AlertCircle size={48} className="text-red-500 mb-4"/><h2 className="text-xl font-black text-white uppercase mb-2">降参しますか？</h2><p className="text-[11px] text-slate-400 mb-2">{debugBattle?'このデバッグ戦を終了します':<>現在のスコア {score.toLocaleString()} pt がランキングに記録されます</>}</p><div className="flex flex-col gap-3 w-full max-w-xs mt-4" style={{position:'relative',zIndex:95001}}><button type="button" onClick={handleGiveUp} style={{position:'relative',zIndex:95002,pointerEvents:'auto'}} className="w-full bg-red-600 text-white py-3 rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95">降参する</button><button type="button" onClick={()=>setShowQuitConfirm(false)} style={{position:'relative',zIndex:95002,pointerEvents:'auto'}} className="w-full bg-slate-800 text-slate-300 py-3 rounded-2xl font-black uppercase text-sm active:scale-95">戦いを続ける</button></div></div>)}

      {debugBattle&&debugOutcome&&(
        <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:81000,backgroundColor:'rgba(2,6,23,.98)'}}>
          <div className="text-[10px] font-black text-fuchsia-300 tracking-[.35em] mb-3">DEBUG</div>
          <h2 className="text-2xl font-black text-white mb-8">{debugOutcome==='win'?'勝利':debugOutcome==='lose'?'敗北':'リタイア'}</h2>
          <div className="w-full max-w-xs space-y-3">
            <button onClick={()=>runResultActionOnce(startDebugBattle)} disabled={resultActionPending} className="w-full bg-fuchsia-700 text-white py-3.5 rounded-2xl font-black disabled:opacity-50">同じ条件でもう一度</button>
            <button onClick={()=>runResultActionOnce(()=>{returnToHome();setGameState('DEBUG_SETTINGS');})} disabled={resultActionPending} className="w-full bg-slate-800 text-slate-200 py-3.5 rounded-2xl font-black disabled:opacity-50">デバッグ設定へ戻る</button>
            <button onClick={()=>runResultActionOnce(()=>{returnToHome();setGameState('SETTINGS');setShowHelp(true);})} disabled={resultActionPending} className="w-full bg-slate-900 border border-white/10 text-slate-400 py-3.5 rounded-2xl font-black disabled:opacity-50">ヘルプへ戻る</button>
          </div>
        </div>
      )}

      {/* CHAMPION */}
      {gameState==='CHAMPION'&&(<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,background:'linear-gradient(to bottom right,#fbbf24,#78350f)'}}><div className="shrink-0 flex flex-col items-center"><Crown size={64} className="text-white animate-bounce mb-3"/><h1 className="text-3xl font-black italic text-white uppercase">CHAMPION</h1><div className="w-full max-w-xs bg-black/40 border border-white/20 rounded-3xl p-6 mb-3 mt-3 shadow-2xl"><div className="text-5xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{masuRegisterButtonNode()}</div><button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} aria-busy={resultActionPending} className="w-full max-w-xs bg-white text-amber-900 py-4 rounded-3xl font-black text-xl uppercase shadow-2xl active:scale-95 transition-transform shrink-0 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">{resultActionPending?'処理中…':'HOMEへ'}</button></div>)}

      {/* GAME OVER */}
      {hp<=0&&!debugBattle&&(<div className="mh-game-over-screen fixed inset-0 flex flex-col items-center text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="mh-game-over-head shrink-0 flex flex-col items-center"><Skull size={48} className="text-red-700 mb-3 animate-pulse"/><h2 className="text-2xl font-black italic text-white uppercase">敗 北</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{masuRegisterButtonNode()}</div><div className="mh-game-over-actions flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={()=>runResultActionOnce(handleRetry)} disabled={resultActionPending} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><RotateCcw size={20}/> {resultActionPending?'処理中…':'再挑戦'}</button><button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed">トップへ</button></div></div>)}

      {gaveUp&&!debugBattle&&(<div className="mh-game-over-screen fixed inset-0 flex flex-col items-center text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="mh-game-over-head shrink-0 flex flex-col items-center"><Flag size={48} className="text-slate-400 mb-3"/><h2 className="text-2xl font-black italic text-white uppercase">リタイア</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div></div><div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-y-auto mh-scroll">{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{masuRegisterButtonNode()}</div><div className="mh-game-over-actions flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={()=>runResultActionOnce(handleRetry)} disabled={resultActionPending} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><RotateCcw size={20}/> {resultActionPending?'処理中…':'再挑戦'}</button><button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed">トップへ</button></div></div>)}

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
        {effect.imgUrl?(effect.baseId?<DyedMonsterImage baseId={effect.baseId} src={effect.imgUrl} alt="effect" masuColors={effect.colors} style={{width:effect.type==='unique'?'180px':(effect.type==='enhance'?'160px':'150px'),height:effect.type==='unique'?'180px':(effect.type==='enhance'?'160px':'150px'),animation:(effect.type==='unique'||effect.type==='enhance')?'specialThrob 500ms ease-in-out infinite':undefined}} className={`mb-6 object-contain relative ${effect.type==='unique'?'drop-shadow-[0_0_45px_rgba(168,85,247,0.95)]':(effect.type==='enhance'?'drop-shadow-[0_0_45px_rgba(251,191,36,0.9)]':'drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]')}`}/>:<img src={effect.imgUrl} alt="effect" style={{width:effect.type==='unique'?'180px':(effect.type==='enhance'?'160px':'150px'),height:effect.type==='unique'?'180px':(effect.type==='enhance'?'160px':'150px'),animation:(effect.type==='unique'||effect.type==='enhance')?'specialThrob 500ms ease-in-out infinite':undefined}} className={`mb-6 object-contain relative ${effect.type==='unique'?'drop-shadow-[0_0_45px_rgba(168,85,247,0.95)]':(effect.type==='enhance'?'drop-shadow-[0_0_45px_rgba(251,191,36,0.9)]':'drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]')}`}/>):(<div style={{fontSize:effect.type==='unique'?'128px':(effect.type==='enhance'?'120px':'112px'),animation:(effect.type==='unique'||effect.type==='enhance')?'specialThrob 500ms ease-in-out infinite':undefined}} className="mb-6 relative">{effect.monEmoji}</div>)}
        <h2 className={`text-2xl font-black italic uppercase px-8 py-3 rounded-2xl border relative ${effect.type==='unique'?'text-purple-100 bg-purple-600/30 border-purple-400/60 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]':(effect.type==='enhance'?'text-amber-100 bg-amber-600/30 border-amber-400/60 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]':'text-white bg-white/10 border-white/20')}`}>{effect.label}</h2>
        {effect.subLabel&&<p className={`font-mono text-[10px] mt-4 font-black whitespace-pre-line relative ${effect.type==='enhance'?'text-amber-300':'text-indigo-400'}`}>{effect.subLabel}</p>}
        <div style={{fontSize:effect.type==='unique'?'60px':'48px'}} className="mt-8 animate-bounce relative">{effect.icon}</div>
      </div>)}
        {rosterSkillDetail&&(()=>{const mon=rosterSkillDetail.mon; const isUnique=rosterSkillDetail.kind==='unique'; const levels=isUnique?getUniqueSkillLevels(mon):getAtkSkillLevels(mon); const currentLevel=isUnique?Math.max(0,Number(mon.unique?.evoLevel)||0):0; const title=isUnique?`固有技 Lv.${currentLevel}: ${mon.unique.names?.[currentLevel]||mon.unique.name}`:`通常技: ${(HERO_ATK_NAMES[mon.id]||HERO_ATK_NAMES['Mocchi'])[0]}`; return(
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:32000}}>
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-2 shadow-2xl h-auto max-h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0"><h3 className="text-sm font-black text-white uppercase">{title}</h3><button onClick={()=>setRosterSkillDetail(null)} className="p-2 bg-white/5 rounded-full active:scale-90"><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-1.5">
                {levels.map(info=>{const locked=isUnique&&info.lvl>currentLevel; const current=isUnique&&info.lvl===currentLevel; return <div key={info.lvl} className={`p-2 rounded-xl border ${locked?'bg-slate-950/70 border-slate-800 opacity-45':'bg-black/30'} ${current?'border-amber-400 ring-1 ring-amber-400/40':'border-white/5'}`}><div className="flex justify-between items-center mb-1"><span className={`text-[9px] font-black ${locked?'text-slate-500':'text-amber-300'}`}>{locked?'🔒 ':''}Lv.{info.lvl} {info.name}</span>{isUnique&&<span className={`text-[8px] font-black ${current?'text-amber-300':locked?'text-slate-600':'text-emerald-400'}`}>{current?'現在の技':locked?'未解放':'解放済み'}</span>}</div><div className="flex gap-4 text-[9px] font-mono"><span className="text-red-400 font-bold">技威力 {info.power}</span><span className="text-yellow-400 font-bold">会心率 {info.crit}%</span><span className="text-amber-400 font-bold">消費G {info.guts}</span></div>{isUnique&&<div className="text-[8px] text-slate-400 mt-1">{mon.unique.effectDesc}</div>}</div>;})}
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
    /* マスモン登録の誘導。見落とされやすいので枠がゆっくり光る */
    @keyframes masuCallout {
      0%, 100% { box-shadow: 0 0 0 0 rgba(236,72,153,0.55), 0 0 14px rgba(236,72,153,0.25); }
      50% { box-shadow: 0 0 0 6px rgba(236,72,153,0), 0 0 22px rgba(236,72,153,0.65); }
    }
    @keyframes masuBadge {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.12); }
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
    .mh-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) rgba(255,255,255,0.05); }
    .mh-game-over-screen{padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))}.mh-game-over-head{width:100%}.mh-game-over-actions{padding-bottom:0}
    @media(max-height:620px){.mh-game-over-screen{padding-top:calc(14px + env(safe-area-inset-top));padding-bottom:calc(12px + env(safe-area-inset-bottom))}.mh-game-over-head>svg{width:38px;height:38px;margin-bottom:6px}.mh-game-over-head h2{font-size:20px}.mh-game-over-head>div{padding:10px;margin-top:7px;margin-bottom:7px}.mh-game-over-actions{gap:7px;margin-top:5px}.mh-game-over-actions button:first-child{padding-top:10px;padding-bottom:10px}.mh-game-over-actions button:last-child{padding-top:8px;padding-bottom:8px}}
    .mh-home-scene{position:relative;isolation:isolate;flex:1;min-height:0;overflow:hidden;background:#263f35;color:#fff}.mh-home-background{position:absolute;z-index:-2;inset:0;display:block;opacity:0;transition:opacity .45s ease;background:#263f35;pointer-events:none}.mh-home-background.is-ready{opacity:1}.mh-home-background img{display:block;width:100%;height:100%;object-fit:contain;object-position:50% 50%}.mh-home-masumon-layer{position:absolute;z-index:0;left:18%;right:18%;top:34%;bottom:29%;pointer-events:none}.mh-home-masumon{position:absolute;width:clamp(48px,14vw,72px);aspect-ratio:1;transform:translate(-50%,-72%);transition-property:left,top;transition-timing-function:linear;will-change:left,top}.mh-home-masumon-bob{position:relative;width:100%;height:100%;transform-origin:center bottom}.mh-home-masumon-bob>div:first-child,.mh-home-masumon-bob>img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 5px 4px #0008)}.mh-home-masumon.is-walking .mh-home-masumon-bob{animation:mhHomeMasumonWalk .42s ease-in-out infinite}.mh-home-masumon-stars{position:absolute;left:0;right:0;bottom:1px;color:#fde68a;text-shadow:0 1px 3px #000}.mh-home-status{position:relative;z-index:5;display:flex;gap:7px;justify-content:space-between;padding:calc(8px + env(safe-area-inset-top)) 9px 0;pointer-events:none}.mh-home-player,.mh-home-wallet{border:1px solid #f7df9a88;background:#102522e8;box-shadow:0 4px 14px #071613cc,inset 0 1px #fff3;backdrop-filter:blur(3px);pointer-events:auto}.mh-home-player{display:flex;align-items:center;gap:6px;min-width:0;flex:1;padding:5px;border-radius:14px;text-align:left;color:#fff;transition:transform .1s,filter .1s,box-shadow .1s}.mh-home-player:active{transform:scale(.97);filter:brightness(1.2);box-shadow:0 0 18px #f5d879aa}.mh-home-profile-arrow{flex:0 0 auto;color:#f8dc8d}.mh-home-avatar{flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#ffe18c;background:#142728;border:2px solid #eaca72}.mh-home-avatar img{width:100%;height:100%;object-fit:cover}.mh-home-player-copy{min-width:0;flex:1}.mh-home-player-copy strong{display:block;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.mh-home-player-copy span{display:block;color:#f8dc8d;font-size:7px;font-weight:900}.mh-home-player-copy small{display:block;text-align:right;color:#d7e3dc;font:6px monospace}.mh-home-xp{height:4px;margin-top:2px;overflow:hidden;border-radius:9px;background:#071b1c}.mh-home-xp i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5dd79c,#f5e16d)}.mh-home-wallet{display:grid;grid-template-columns:auto 43px;grid-template-rows:1fr 1fr;width:139px;padding:4px;border-radius:14px}.mh-home-wallet>div{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:2px;padding:1px 3px;color:#ffe08a}.mh-home-wallet>div b{font-size:8px;text-align:right}.mh-home-wallet>div small{font-size:6px;color:#f4e7c3}.mh-home-wallet>button{grid-column:2;grid-row:1/3;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #fff2;color:#fce6ab;font-size:7px;font-weight:900;min-width:42px}.mh-home-facilities{position:absolute;z-index:3;inset:0;pointer-events:none}.mh-home-facility{position:absolute;pointer-events:auto;border:0;background:transparent;color:#fff;touch-action:manipulation}.mh-home-facility>span{position:absolute;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 13px;border:2px solid #ffe6a7a8;border-radius:14px;background:#10211df2;box-shadow:0 3px 12px #0009,inset 0 0 12px #ffe09822;text-shadow:0 2px 4px #000;font-size:11px;font-weight:1000;white-space:nowrap;transition:transform .1s,filter .1s,box-shadow .1s}.mh-home-facility:active>span{transform:scale(.92);filter:brightness(1.4);box-shadow:0 0 22px #ffe7a8}.mh-home-facility.management{left:0;top:14%;width:42%;height:34%}.mh-home-facility.management>span{left:6%;top:37%;border-color:#67e8f9dd;background:linear-gradient(135deg,#082f49f2,#123b3cf2);box-shadow:0 3px 12px #0009,0 0 15px #22d3ee66,inset 0 0 12px #38bdf833}.mh-home-facility.temple{right:0;top:14%;width:42%;height:34%}.mh-home-facility.temple>span{right:7%;top:35%;border-color:#d8b4fedd;background:linear-gradient(135deg,#2e1065f2,#44301cf2);box-shadow:0 3px 12px #0009,0 0 15px #c084fc66,inset 0 0 12px #fbbf2433}.mh-home-facility.market{right:0;top:45%;width:39%;height:30%}.mh-home-facility.market>span{right:5%;top:40%;border-color:#86efacdd;background:linear-gradient(135deg,#052e24f2,#3b3518f2);box-shadow:0 3px 12px #0009,0 0 15px #4ade8066,inset 0 0 12px #facc1533}.mh-home-facility.battle{left:16%;right:16%;bottom:0;height:31%}.mh-home-facility.battle>span{left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);min-width:156px;padding:10px 17px;border:2px solid #ffe3a8;border-radius:18px;background:linear-gradient(135deg,#4c1d95e8,#8b301ae8);box-shadow:0 0 23px #c084fcbb,inset 0 0 20px #ffcb6255;font-size:20px;letter-spacing:.08em;animation:mhHomeBattlePulse 2.3s ease-in-out infinite}.mh-home-facility.battle>span small{font-size:7px;letter-spacing:0;color:#ffe4b2}.mh-home-facility.battle:active>span{transform:translateX(-50%) scale(.94)}.mh-home-gift{position:absolute;z-index:5;right:5%;top:73%;display:flex;align-items:center;justify-content:center;gap:4px;width:112px;min-height:44px;padding:7px 8px;border:1px solid #67e8f9aa;border-radius:13px;background:#083344e8;color:#cffafe;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-gift em{display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-style:normal;font-size:9px}.mh-home-gift:active{transform:scale(.94);filter:brightness(1.25)}.mh-home-update{position:absolute;z-index:5;right:9px;top:calc(69px + env(safe-area-inset-top));display:flex;align-items:center;gap:4px;min-height:32px;padding:6px 11px;border:1px solid #eed995aa;border-radius:13px;background:#102c29e8;color:#f9eac2;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-update:active{transform:scale(.94);filter:brightness(1.25)}.mh-management-link{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:64px;padding:16px;border:1px solid #818cf877;border-radius:16px;background:#172554aa;color:#fff;font-weight:900;box-shadow:0 5px 16px #0005}.mh-management-link:active{transform:scale(.98);filter:brightness(1.2)}.mh-temple-link{border-color:#a78bfa99;background:#2e1065aa}.mh-rebirth-stars{display:flex;justify-content:center;gap:0;font-size:8px;line-height:1;font-weight:1000;pointer-events:none}.mh-rebirth-stars-overlay{position:absolute;left:0;right:0;bottom:1px}.mh-rebirth-animation{position:fixed;inset:0;z-index:51000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle,#7c3aed88,#020617 62%);pointer-events:auto;touch-action:none}.mh-rebirth-circle{position:absolute;width:240px;height:240px;border:3px solid #c4b5fd;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fde68a;font-size:150px;animation:mhRebirthCircle 4s ease-in-out forwards}.mh-rebirth-glow{position:absolute;width:100%;height:42%;background:linear-gradient(90deg,transparent,#fff8,transparent);filter:blur(14px);animation:mhRebirthGlow 4s ease-in-out forwards}.mh-rebirth-mon{position:relative;width:145px;height:145px;animation:mhRebirthFloat 4s ease-in-out forwards}.mh-rebirth-copy{position:absolute;bottom:calc(8% + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;color:#fff;font-size:11px;font-weight:900;animation:mhRebirthCopy 4s ease-out forwards}.mh-rebirth-copy b{font-size:20px;color:#fde68a}.mh-rebirth-copy span{margin-top:2px}@keyframes mhRebirthCircle{0%{opacity:0;transform:scale(.3) rotate(0)}25%{opacity:1}100%{opacity:.25;transform:scale(1.5) rotate(180deg)}}@keyframes mhRebirthGlow{0%,20%{opacity:0}40%,70%{opacity:1}100%{opacity:0}}@keyframes mhRebirthFloat{0%{transform:translateY(30px);filter:brightness(1)}45%{transform:translateY(-25px);filter:brightness(2)}60%{filter:brightness(0)}78%{filter:brightness(3)}100%{transform:translateY(0);filter:brightness(1)}}@keyframes mhRebirthCopy{0%,55%{opacity:0;transform:translateY(20px)}68%,100%{opacity:1;transform:none}}.mh-donation-animation{position:fixed;inset:0;z-index:33000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at center,#7c3aed55 0,#020617 58%);pointer-events:auto;touch-action:none}.mh-donation-beam{position:absolute;width:150px;height:110%;background:linear-gradient(90deg,transparent,#fff9c477,transparent);filter:blur(8px);animation:mhDonationBeam 1.5s ease-in-out forwards}.mh-donation-monster{position:absolute;width:140px;height:140px;filter:drop-shadow(0 0 22px #fff);animation:mhDonationRise 1.25s ease-in forwards}.mh-donation-gem{position:absolute;color:#fde68a;opacity:0;filter:drop-shadow(0 0 18px #fbbf24);animation:mhDonationGem .55s 1s ease-out forwards}.mh-donation-particles i{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#fde68a;box-shadow:0 0 8px #fff;opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-20px);animation:mhDonationParticle .55s 1s ease-out forwards}.mh-donation-copy{position:absolute;bottom:calc(15% + env(safe-area-inset-bottom));font-size:14px;font-weight:1000;color:#f5d0fe;text-shadow:0 0 12px #a855f7}@keyframes mhDonationRise{0%{transform:translateY(25px) scale(1);opacity:1}55%{transform:translateY(-28px) scale(1.08);opacity:1}100%{transform:translateY(-55px) scale(.05);opacity:0;filter:drop-shadow(0 0 50px #fff)}}@keyframes mhDonationBeam{0%{opacity:0;transform:scaleX(.2)}35%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(.1)}}@keyframes mhDonationGem{to{opacity:1;transform:scale(1.2)}}@keyframes mhDonationParticle{0%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-95px) scale(.2)}}@keyframes mhHomeMasumonWalk{0%,100%{translate:0 0}50%{translate:0 -5px}}@keyframes mhHomeBattlePulse{50%{filter:brightness(1.16);box-shadow:0 0 34px #d8b4fddd,inset 0 0 26px #ffdc8366}}@media(max-width:350px){.mh-home-player-copy strong{max-width:80px}.mh-home-wallet{width:124px}.mh-home-facility>span{font-size:9px;padding:6px 8px}.mh-home-facility.battle>span{min-width:140px;font-size:18px}}@media(max-height:620px){.mh-home-facility.management,.mh-home-facility.temple{top:13%;height:32%}.mh-home-facility.market{top:43%}.mh-home-facility.battle{height:30%}}@media(prefers-reduced-motion:reduce){.mh-home-background,.mh-home-player,.mh-home-facility>span{transition:none}.mh-home-facility.battle>span{animation:none}.mh-home-masumon.is-walking .mh-home-masumon-bob{animation:none}}
    .mh-home-mission{position:absolute;z-index:5;right:5%;top:65%;display:flex;align-items:center;justify-content:center;gap:4px;width:112px;min-height:44px;padding:7px 8px;border:1px solid #fbbf24aa;border-radius:13px;background:#422006e8;color:#fef3c7;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-mission em{display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-style:normal;font-size:9px}.mh-home-mission:active{transform:scale(.94);filter:brightness(1.25)}
    .mh-gift-list{display:flex;flex-direction:column;gap:5px}.mh-gift-card{display:flex;flex-direction:column;min-height:80px;padding:5px 8px}.mh-gift-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;height:18px}.mh-gift-heading h3{display:flex;align-items:center;gap:4px;min-width:0;font-size:12px;line-height:18px;color:#fff}.mh-gift-heading h3 span{flex:none;padding:1px 4px;border-radius:5px;background:#78350f;color:#fde68a;font-size:8px;line-height:14px}.mh-gift-heading h3 b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mh-gift-heading>em{flex:none;padding:1px 6px;border-radius:999px;font-size:8px;line-height:15px;font-style:normal;font-weight:900}.mh-gift-main{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:37px}.mh-gift-rewards{display:flex;flex:1;flex-wrap:wrap;align-items:center;gap:2px 7px;min-width:0;color:#fde68a;font-size:11px;line-height:15px;font-weight:900}.mh-gift-rewards span{overflow-wrap:anywhere}.mh-gift-main>button{flex:none;min-width:76px;height:36px;padding:0 10px;border-radius:10px;background:#0891b2;color:#fff;font-size:12px;font-weight:900;white-space:nowrap}.mh-gift-main>button:disabled{background:#334155;color:#64748b}.mh-gift-deadline{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:8px;line-height:12px}
    @media(max-height:620px){.mh-home-mission{top:64%}.mh-home-gift{top:73%}}
    .mh-boot-screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:calc(12px + env(safe-area-inset-top)) 24px calc(16px + env(safe-area-inset-bottom));color:#fff;text-align:center;background:radial-gradient(circle at 50% 35%,#34205c 0,#100c29 38%,#040511 76%);isolation:isolate}
    .mh-boot-stars{position:absolute;inset:0;background-image:radial-gradient(circle,#e9d5ff 0 1px,transparent 1.5px);background-size:39px 41px;opacity:.28}
    .mh-mocchi-wrap{position:relative;z-index:2;width:min(42vw,180px);height:min(42vw,180px);display:flex;align-items:flex-end;justify-content:center;margin-bottom:clamp(8px,3vh,24px)}
    .mh-mocchi-wrap img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 14px #000);transform-origin:50% 88%;animation:mhMocchiHop 1.2s ease-in-out infinite}.mh-mocchi-wrap span{position:absolute;bottom:-5px;width:60%;height:13px;border-radius:50%;background:#0008;filter:blur(3px);animation:mhShadow 1.2s ease-in-out infinite}.mh-mocchi-wrap i{display:none;position:absolute;color:#ffeaa7;font-style:normal;font-size:22px;filter:drop-shadow(0 0 8px #fff)}
    .mh-boot-copy{position:relative;z-index:2;width:min(100%,340px)}.mh-boot-copy h1{font-size:clamp(20px,6vw,30px);font-weight:1000;letter-spacing:.22em;color:#fff;text-shadow:0 0 18px #c084fc;margin:0 0 8px}.mh-boot-copy h2{font-size:12px;color:#ddd6fe;letter-spacing:.12em;margin:0 0 18px}.mh-boot-copy p{min-height:18px;font-size:10px;color:#c4b5fd;margin-top:10px}.mh-progress{height:10px;border:1px solid #c4b5fd88;border-radius:99px;background:#080617;overflow:hidden}.mh-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7c3aed,#d8b4fe,#fbbf24);box-shadow:0 0 14px #c084fc;transition:width .25s}.mh-boot-copy strong{display:block;margin-top:7px;font:800 11px monospace}.mh-boot-copy button{width:100%;min-height:56px;border:1px solid #f8d477;border-radius:18px;background:linear-gradient(135deg,#4c1d95dd,#7e22cedd);box-shadow:0 0 25px #a855f766;color:#fff;font-size:clamp(15px,5vw,20px);font-weight:1000;letter-spacing:.12em;touch-action:manipulation}.mh-boot-screen footer{position:absolute;z-index:2;bottom:calc(8px + env(safe-area-inset-bottom));font:8px monospace;color:#7773a0;letter-spacing:.15em}
    .mh-boot-screen.is-ready .mh-mocchi-wrap img{animation:mhReadyHop .75s ease-out 1,mhMocchiHop 1.8s ease-in-out .75s infinite}.mh-boot-screen.is-ready .mh-boot-copy{animation:titleReveal .55s ease-out both}.mh-boot-screen.is-ready .mh-mocchi-wrap i{display:block;animation:mhSparkle 1.5s infinite}.mh-boot-screen.is-ready .mh-mocchi-wrap i:nth-of-type(1){top:10%;left:4%}.mh-boot-screen.is-ready .mh-mocchi-wrap i:nth-of-type(2){top:24%;right:0;animation-delay:.55s}.mh-boot-screen.is-entering .mh-mocchi-wrap img{animation:mhBigHop .75s ease-in-out both}.mh-entry-flash{position:absolute;z-index:9;inset:0;pointer-events:none;background:radial-gradient(circle,#fff 0,#d8b4fe 18%,transparent 58%);opacity:0}.mh-boot-screen.is-entering .mh-entry-flash{animation:mhEntryFlash .76s ease-in both}
    .mh-title-gate,.mh-entering{position:fixed;inset:0;overflow:hidden;color:#fff;background:#05020e;isolation:isolate}.mh-title-gate{animation:titleReveal .65s ease-out both}.mh-title-visual,.mh-entering>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%}
    .mh-title-header{position:absolute;z-index:22;top:0;left:0;right:0;padding:calc(11px + env(safe-area-inset-top)) 12px 0;display:flex;justify-content:space-between;align-items:flex-start;text-shadow:0 2px 5px #000;pointer-events:none}.mh-title-build{display:grid;padding:6px 8px;text-align:left;font-family:monospace;line-height:1.15;border:1px solid #ffffff30;border-radius:10px;background:#160d2588;backdrop-filter:blur(3px)}.mh-title-build b{font-size:7px;letter-spacing:.18em;color:#eadcff}.mh-title-build span{font-size:8px;margin-bottom:5px;color:#fff;max-width:130px;overflow:hidden;text-overflow:ellipsis}.mh-title-actions{display:flex;gap:7px;pointer-events:auto}.mh-title-actions button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:50px;height:50px;border-radius:50%;background:#26152ecc;border:1px solid #ffd87a;color:#fff;font-size:8px;font-weight:800;box-shadow:0 2px 8px #000}.mh-title-actions em{position:absolute;right:-3px;top:-6px;background:#e33;padding:2px 4px;border-radius:8px;font-size:6px;font-style:normal}.mh-title-start{position:absolute;z-index:21;inset:0;width:100%;height:100%;border:0;background:transparent;touch-action:manipulation}.mh-title-start:disabled{pointer-events:none}
    .mh-title-modal{position:fixed;z-index:100;inset:0;display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));background:#03020eef}.mh-title-dialog{display:flex;flex-direction:column;gap:12px;width:min(100%,380px);max-height:86vh;padding:18px;border:1px solid #a78bfa77;border-radius:22px;background:#0f172a;color:#fff;overflow:auto}.mh-dialog-head{display:flex;align-items:center;justify-content:space-between}.mh-dialog-head h3{font-weight:900}.mh-dialog-head button{padding:8px}.mh-dialog-choice{display:flex;justify-content:space-between;align-items:center;padding:14px;border:1px solid #ffffff22;border-radius:14px;background:#ffffff0c;font-weight:800}.mh-changelog-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mh-changelog-tabs button{position:relative;padding:9px;border-radius:10px;background:#1e293b;font-size:11px;font-weight:800}.mh-changelog-tabs button.active{background:#b45309}.mh-unread-badge{position:absolute;right:-5px;top:-6px;display:flex;align-items:center;justify-content:center;width:17px;height:17px;border:2px solid #fff;border-radius:50%;background:#dc2626;color:#fff;font:900 11px/1 sans-serif;font-style:normal;box-shadow:0 2px 5px #0008;pointer-events:none}.mh-changelog-list{overflow:auto}.mh-changelog-list article{padding:11px;margin-bottom:8px;border:1px solid #ffffff18;border-radius:13px;background:#0005}.mh-changelog-list time,.mh-changelog-list b{display:block}.mh-changelog-list time{font:9px monospace;color:#94a3b8}.mh-changelog-list b{font-size:12px;margin:4px 0}.mh-changelog-list p{font-size:10px;color:#cbd5e1}.mh-title-dialog textarea{min-height:90px;padding:8px;border-radius:10px;background:#0008;font:9px monospace}
    .mh-tile-viewport{touch-action:none;overscroll-behavior:contain;cursor:grab}.mh-tile-viewport:active{cursor:grabbing}.mh-tile-viewport.overview{overflow:auto}.mh-tile-viewport.overview .mh-tile-board{transform:none}.mh-training-tile{transform:scale(var(--map-scale,1))}.mh-training-tile.current{transform:scale(calc(var(--map-scale,1)*1.08))}.mh-tile-board>i.route{height:17px;border-color:#fef08a;background:#facc15;box-shadow:0 0 14px #fde047;animation:trainingRoutePulse .7s infinite alternate}.mh-training-tile.route-preview{border-color:#fde047;box-shadow:0 0 16px #fde047,0 5px 0 #713f12}.mh-training-tile.stop-preview{z-index:7;border-color:#fff;box-shadow:0 0 0 5px #f97316,0 0 25px #fb923c}.mh-board-buttons{display:flex;align-items:center;gap:4px}.mh-board-buttons button{min-height:34px;padding:0 8px;border-radius:9px;background:#164e63;font-size:8px;font-weight:900}.mh-board-buttons span{padding:3px 5px;border-radius:7px;background:#020617;color:#bae6fd;font:8px monospace}.mh-changelog-list article.unread{border-color:#f59e0b88}.mh-changelog-list time em{float:right;padding:2px 5px;border-radius:6px;background:#dc2626;color:#fff;font:900 7px sans-serif;font-style:normal}.mh-training-effect{position:fixed;z-index:45000;left:50%;top:43%;width:min(78vw,300px);min-height:150px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border:3px solid #fff;border-radius:28px;background:radial-gradient(circle,#0ea5e9dd,#020617ee 72%);box-shadow:0 0 55px #38bdf8;pointer-events:none;animation:trainingEffectPop 1.25s ease-out both}.mh-training-effect>span{font-size:58px;filter:drop-shadow(0 0 15px #fff)}.mh-training-effect>b{z-index:2;max-width:90%;text-align:center;color:#fff;font-size:16px;text-shadow:0 2px 5px #000}.mh-training-effect.xp,.mh-training-effect.effect,.mh-training-effect.turn{background:radial-gradient(circle,#22c55edd,#052e16ee 72%);box-shadow:0 0 55px #4ade80}.mh-training-effect.diamond{background:radial-gradient(circle,#38bdf8ee,#172554ee 72%)}.mh-training-effect.item,.mh-training-effect.tool,.mh-training-effect.goal{background:radial-gradient(circle,#fbbf24ee,#581c87ee 72%);box-shadow:0 0 70px #fde047}.mh-training-effect.move,.mh-training-effect.happening{background:radial-gradient(circle,#ef4444dd,#450a0aee 72%);box-shadow:0 0 55px #fb7185}.mh-training-effect i{position:absolute;width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 12px #fff;animation:trainingParticle 1s ease-out both}.mh-training-effect i:nth-of-type(1){--a:0deg}.mh-training-effect i:nth-of-type(2){--a:60deg}.mh-training-effect i:nth-of-type(3){--a:120deg}.mh-training-effect i:nth-of-type(4){--a:180deg}.mh-training-effect i:nth-of-type(5){--a:240deg}.mh-training-effect i:nth-of-type(6){--a:300deg}@keyframes trainingEffectPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-58%) scale(.96)}}@keyframes trainingParticle{from{transform:rotate(var(--a)) translateX(18px);opacity:1}to{transform:rotate(var(--a)) translateX(115px) scale(.2);opacity:0}}@keyframes trainingRoutePulse{to{filter:brightness(1.6)}}
    .mh-entering>img{animation:mhGateZoom 1.15s ease-in both}.mh-gate-core{position:absolute;z-index:3;left:50%;top:44%;width:12vmin;height:12vmin;border-radius:50%;background:#fff;box-shadow:0 0 25px 12px #d8b4fe,0 0 90px 40px #7e22ce;transform:translate(-50%,-50%);animation:mhCoreGrow 1.15s ease-in both}.mh-gate-particles{position:absolute;z-index:2;inset:-30%;background:repeating-conic-gradient(from 0deg,transparent 0 8deg,#fbbf2444 9deg,#a855f766 10deg,transparent 11deg 19deg);animation:mhParticles 1.1s ease-in both}.mh-gate-flash{position:absolute;z-index:4;inset:0;background:#f5f0ff;animation:mhGateFlash 1.15s ease-in both}.mh-entering p{position:absolute;z-index:6;left:0;right:0;bottom:calc(9% + env(safe-area-inset-bottom));text-align:center;font-size:11px;font-weight:800;text-shadow:0 2px 6px #000}
    @keyframes mhMocchiHop{0%,100%{transform:translateY(0) scale(1.05,.95)}45%{transform:translateY(-14px) rotate(-2deg) scale(.98,1.02)}70%{transform:translateY(0) scale(1.08,.9)}}@keyframes mhReadyHop{45%{transform:translateY(-25px) scale(1.1)}100%{transform:translateY(0)}}@keyframes mhShadow{0%,100%{transform:scaleX(1);opacity:.6}45%{transform:scaleX(.65);opacity:.3}}@keyframes mhSparkle{50%{transform:scale(1.5) rotate(90deg);opacity:.35}}@keyframes mhBigHop{45%{transform:translateY(-34px) scale(.95,1.08)}100%{transform:translateY(5px) scale(1.12,.88)}}@keyframes mhEntryFlash{45%{opacity:0}80%{opacity:1}100%{opacity:0}}@keyframes titleReveal{from{opacity:0;filter:brightness(2)}to{opacity:1;filter:none}}@keyframes mhGateZoom{to{transform:scale(1.16);filter:blur(2px) brightness(1.5)}}@keyframes mhCoreGrow{0%{transform:translate(-50%,-50%) scale(.15);opacity:0}70%{opacity:1}100%{transform:translate(-50%,-50%) scale(18)}}@keyframes mhParticles{to{transform:rotate(35deg) scale(.2);opacity:0}}@keyframes mhGateFlash{0%,68%{opacity:0}85%{opacity:.95}100%{opacity:1}}
    @media(max-width:350px){.mh-title-actions button{width:46px;height:46px}.mh-mocchi-wrap{width:130px;height:130px}.mh-title-header{padding-left:9px;padding-right:9px}}
    @media(max-height:620px){.mh-mocchi-wrap{width:105px;height:105px;margin-bottom:5px}.mh-boot-copy h2{margin-bottom:10px}.mh-boot-copy p{margin-top:5px}}
    @media(prefers-reduced-motion:reduce){.mh-mocchi-wrap img,.mh-mocchi-wrap span,.mh-mocchi-wrap i{animation:none!important}.mh-entering>img{animation:mhReducedFade .85s ease both}.mh-gate-core,.mh-gate-particles{display:none}.mh-gate-flash{animation:mhReducedFlash .85s ease both}}@keyframes mhReducedFade{to{opacity:.4}}@keyframes mhReducedFlash{0%,55%{opacity:0}100%{opacity:1}}
    .mh-home-facility.training{left:0;top:46%;width:38%;height:25%}.mh-home-facility.training>span{left:5%;top:37%;border-color:#f9a8d4dd;background:linear-gradient(135deg,#831843ee,#4c1d95ee);box-shadow:0 3px 12px #0009,0 0 15px #ec489966}
    .mh-debug-banner{flex:none;text-align:center;background:#be123c;color:white;padding:5px;font-size:9px;font-weight:1000;letter-spacing:.04em}.mh-home-facility.training small{display:block;font-size:7px;color:#fde68a}.mh-rule-button{width:100%;margin-top:18px;padding:13px;border-radius:14px;background:#4338ca;font-weight:900}.mh-node-map{position:relative;flex:1;min-height:250px;overflow:hidden;border:1px solid #ffffff33;border-radius:15px;background:radial-gradient(circle,#164e63,#020617);transition:.4s}.mh-node-map>i{position:absolute;height:3px;background:#94a3b8;transform-origin:0 50%;z-index:0}.mh-node-map>button{position:absolute;z-index:2;width:52px;height:52px;margin:-26px;border:3px solid #ffffff88;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;transition:.25s}.mh-node-map>button span{font-size:17px}.mh-node-map>button small{font-size:6px;font-weight:900}.mh-node-map>button.current{border-color:#fff700;box-shadow:0 0 18px #fff700}.mh-node-map>button.destination{animation:trainingGlow .7s infinite alternate;pointer-events:auto}.mh-node-map>button:not(.destination){pointer-events:auto}.mh-node-map img,.mh-node-map>button>div{position:absolute;width:48px;height:48px;object-fit:contain;z-index:3}.mh-board-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}.mh-board-buttons button{min-height:34px;border-radius:8px;background:#334155;font-size:8px;font-weight:900}@keyframes trainingGlow{to{transform:scale(1.2);border-color:#fff;box-shadow:0 0 24px #fde047}}.mh-training-debug{position:absolute;right:8px;bottom:82px;z-index:30;width:min(270px,82vw);max-height:55vh;overflow:auto;padding:10px;border:2px solid #e879f9;border-radius:14px;background:#0f172ff5;font-size:8px}.mh-training-debug button,.mh-training-debug select{margin:3px;padding:6px;border-radius:6px;background:#334155}.mh-training-debug button.active{background:#db2777}.mh-training-debug pre{max-height:110px;overflow:auto;white-space:pre-wrap;background:#000;padding:5px}.mh-training-modal{position:fixed;z-index:50000;inset:0;display:flex;align-items:center;padding:16px;background:#020617e8}.mh-training-modal>div{width:100%;max-height:85vh;overflow:auto;padding:18px;border:1px solid #a78bfa;border-radius:20px;background:#111827}.mh-training-modal h3{margin:8px 0;font-size:17px;font-weight:1000}.mh-training-modal p{margin:7px 0;color:#cbd5e1;font-size:10px}.mh-rules-list p{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #ffffff22;padding:7px}.mh-rules-list b{font-size:10px}.mh-rules-list span{font-size:8px;text-align:right}.mh-route-choice,.mh-modal-close{display:block;width:100%;margin-top:8px;padding:12px;border-radius:10px;background:#4338ca;font-size:10px;font-weight:900}.mh-modal-close{background:#475569}.mh-training-result>div>button+button{margin-top:7px;background:#334155;color:white}
    .mh-training-screen{height:100%;display:flex;flex-direction:column;overflow:hidden;padding:calc(10px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#312e81,#07101f 60%)}.mh-training-head{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;flex:none}.mh-training-head>button{min-height:44px;display:flex;align-items:center;justify-content:center}.mh-training-head div{text-align:center}.mh-training-head small{display:block;color:#f9a8d4;font:900 8px monospace;letter-spacing:.25em}.mh-training-head h2{font-size:18px;font-weight:1000}.mh-training-selected{display:flex;align-items:center;gap:10px;margin:9px 0;padding:10px;border:1px solid #f9a8d477;border-radius:18px;background:#3b076455}.mh-training-selected>img,.mh-training-selected>div:first-child{width:56px;height:56px;object-fit:contain;flex:none}.mh-training-selected>div{display:flex;flex:1;min-width:0;flex-direction:column}.mh-training-selected b{font-size:14px}.mh-training-selected span{color:#fbcfe8;font-size:9px}.mh-training-selected button{padding:9px;border-radius:10px;background:#7e22ce;font-size:9px;font-weight:900}.mh-training-note{font-size:9px;color:#cbd5e1;padding:2px 3px 8px}.mh-training-mon-list{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;overflow-y:auto;padding:2px 1px 90px}.mh-training-mon-list>button{position:relative;min-width:0;padding:7px 4px;border:2px solid #334155;border-radius:16px;background:#0f172acc}.mh-training-mon-list>button.active{border-color:#f472b6;background:#83184377;box-shadow:0 0 13px #ec489966}.mh-training-mon-list img,.mh-training-mon-list>button>div:first-child{width:54px;height:54px;object-fit:contain;margin:auto}.mh-training-mon-list b,.mh-training-mon-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mh-training-mon-list b{font-size:10px}.mh-training-mon-list small{font-size:7px;color:#94a3b8}.mh-training-mon-list span{position:absolute;right:5px;top:4px;color:#fde68a;font-size:8px}.mh-training-empty{grid-column:1/-1;text-align:center;margin-top:50px;color:#64748b}.mh-training-footer{position:absolute;z-index:6;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));padding-top:20px;background:linear-gradient(transparent,#07101f 24%)}.mh-training-footer button{width:100%;min-height:52px;border-radius:18px;background:linear-gradient(90deg,#db2777,#7c3aed);font-weight:1000;box-shadow:0 6px 20px #0008}.mh-training-footer button:disabled{background:#334155;color:#64748b}.mh-training-difficulties{overflow:auto;padding:10px 1px 95px}.mh-training-difficulties>button{display:block;width:100%;margin-bottom:10px;padding:14px;text-align:left;border:2px solid #334155;border-radius:20px;background:#0f172acc}.mh-training-difficulties>button.active{border-color:#f472b6}.mh-training-difficulties>button.soon{opacity:.72}.mh-training-difficulties>button>div{display:flex;justify-content:space-between}.mh-training-difficulties b{font-size:18px}.mh-training-difficulties em{padding:4px 8px;border-radius:999px;background:#475569;font-size:8px;font-style:normal}.mh-training-difficulties p{margin:8px 0;color:#cbd5e1;font-size:10px}.mh-training-difficulties dl{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.mh-training-difficulties dl span{padding:5px;border-radius:7px;background:#02061788;text-align:center;font-size:8px}.mh-training-confirm{overflow:auto;padding:12px 2px 100px}.mh-training-confirm h3{margin:10px 0 2px;color:#f9a8d4;font-size:26px;font-weight:1000}.mh-training-confirm h4{margin-top:16px;color:#c4b5fd;font-size:11px;font-weight:1000}.mh-training-confirm p{color:#cbd5e1;font-size:10px}.mh-training-ticket{display:flex;flex-wrap:wrap;justify-content:space-between;margin-top:16px;padding:14px;border:1px solid #fbbf24aa;border-radius:16px;background:#78350f55}.mh-training-ticket b{color:#fde68a}.mh-training-ticket small{width:100%;margin-top:5px;color:#fef3c7;font-size:8px}
    .mh-training-board{height:100%;display:flex;flex-direction:column;padding:calc(8px + env(safe-area-inset-top)) 9px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(#0c4a6e,#082f49 44%,#052e16)}.mh-training-board>header{display:flex;align-items:center;justify-content:space-between}.mh-training-board>header div{display:flex;flex-direction:column}.mh-training-board>header b{font-size:14px}.mh-training-board>header span{font-size:8px;color:#bae6fd}.mh-training-board>header button{min-height:40px;padding:0 10px;border-radius:10px;background:#7f1d1d;font-size:9px;font-weight:900}.mh-training-hud{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:7px 0}.mh-training-hud span{padding:6px 2px;border-radius:8px;background:#020617aa;text-align:center;font-size:8px;font-weight:900}.mh-training-map{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;flex:1;min-height:0;padding:7px;overflow:auto;border:1px solid #ffffff22;border-radius:16px;background:#0005}.mh-training-map>div{position:relative;aspect-ratio:1;border:2px solid #64748b;border-radius:10px;background:#334155;display:flex;align-items:center;justify-content:center}.mh-training-map>div.passed{opacity:.52}.mh-training-map>div.current{border-color:#fde047;background:#854d0e;box-shadow:0 0 14px #fde047}.mh-training-map span{font-size:17px}.mh-training-map small{position:absolute;left:3px;top:1px;font-size:6px}.mh-training-map img,.mh-training-map>div.current>div{position:absolute;width:45px;height:45px;object-fit:contain;filter:drop-shadow(0 3px 3px #000);z-index:2}.mh-training-message{min-height:28px;padding:7px;text-align:center;font-size:10px;font-weight:900}.mh-training-tools{display:flex;min-height:54px;gap:5px}.mh-training-tools button{flex:1;display:flex;align-items:center;justify-content:center;gap:3px;padding:4px;border:1px solid #a78bfa;border-radius:10px;background:#312e81}.mh-training-tools button span{font-size:17px}.mh-training-tools button small{font-size:7px}.mh-training-tools p{margin:auto;color:#94a3b8;font-size:8px}.mh-training-board>footer{margin-top:7px}.mh-roll-button{width:100%;min-height:58px;border-radius:19px;background:linear-gradient(#fbbf24,#d97706);color:#451a03;font-size:17px;font-weight:1000}.mh-roll-button small{display:block;font-size:7px}.mh-fixed-dice{display:grid;grid-template-columns:1fr repeat(3,58px);gap:5px;align-items:center}.mh-fixed-dice button{height:54px;border-radius:14px;background:#fbbf24;color:#422006;font-size:20px;font-weight:1000}.mh-training-branch{position:fixed;z-index:40000;inset:0;display:flex;align-items:center;padding:20px;background:#020617dd}.mh-training-branch>div{width:100%;padding:18px;border:1px solid #c4b5fd;border-radius:22px;background:#111827}.mh-training-branch h3{text-align:center;font-size:18px;font-weight:1000}.mh-training-branch button{display:flex;justify-content:space-between;width:100%;margin-top:8px;padding:14px;border-radius:12px;background:#312e81}.mh-training-branch span{font-size:9px;color:#cbd5e1}.mh-training-board{position:relative;background:linear-gradient(160deg,#082f49,#0f172a 52%,#14532d)}.mh-training-board>header{gap:8px}.mh-training-board>header b small{margin-left:5px;color:#facc15;font-size:7px}.mh-debug-toggle{background:#be185d!important;letter-spacing:.08em}.mh-training-hud{grid-template-columns:repeat(3,1fr)}.mh-training-hud span{display:flex;flex-direction:column;gap:2px}.mh-training-hud b{color:white;font-size:11px}.mh-tile-viewport{position:relative;flex:1;min-height:250px;overflow:auto;scroll-behavior:smooth;border:2px solid #67e8f966;border-radius:18px;background:linear-gradient(#0c4a6e99,#052e1699),repeating-linear-gradient(45deg,#ffffff08 0 8px,transparent 8px 16px);box-shadow:inset 0 0 30px #020617}.mh-tile-board{position:relative;width:720px;height:520px;transform-origin:center;transition:transform .3s}.mh-tile-viewport.overview{overflow:hidden}.mh-tile-viewport.overview .mh-tile-board{transform:scale(.46) translate(-58%,-58%)}.mh-tile-board>i{position:absolute;height:13px;border:2px solid #dbeafe99;background:#64748b;box-shadow:0 2px 0 #0f172a;transform-origin:0 50%;z-index:0}.mh-training-tile{position:absolute;z-index:2;width:68px;height:68px;margin:-34px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:4px solid #e2e8f0;border-radius:12px;color:white;background:var(--tile-color);box-shadow:0 5px 0 #0f172a,0 8px 14px #0008;transition:left .25s,top .25s,transform .2s}.mh-training-tile>span{font-size:23px;line-height:1}.mh-training-tile>small{max-width:62px;font-size:7px;font-weight:1000;text-shadow:0 1px 2px #000}.mh-training-tile.branch:after{content:'分岐';position:absolute;right:-9px;top:-10px;padding:2px 4px;border-radius:6px;background:#f97316;font-size:6px;font-weight:1000}.mh-training-tile.start{border-color:#86efac}.mh-training-tile.goal{border-color:#fde047;box-shadow:0 0 22px #facc15,0 5px 0 #713f12}.mh-training-tile.current{z-index:8;border-color:#fff;box-shadow:0 0 0 4px #facc15,0 8px 18px #000;transform:scale(1.05)}.mh-training-tile.branch-choice{z-index:9;animation:trainingGlow .55s infinite alternate;pointer-events:auto}.mh-training-piece{position:absolute;left:50%;bottom:34px;width:62px;height:73px;transform:translateX(-50%);pointer-events:none;filter:drop-shadow(0 5px 3px #000)}.mh-training-piece img,.mh-training-piece>div{width:58px!important;height:58px!important;object-fit:contain}.mh-training-piece b{position:absolute;bottom:0;left:50%;max-width:75px;transform:translateX(-50%);padding:2px 5px;border-radius:8px;background:#020617e8;white-space:nowrap;font-size:7px}.mh-training-message{color:#fef3c7}.mh-training-tools{align-items:stretch}.mh-training-tools>strong{display:flex;align-items:center;font-size:8px}.mh-training-tools button{min-width:0}.mh-training-tools button small{line-height:1.25}.mh-training-debug{right:8px;top:calc(52px + env(safe-area-inset-top));bottom:auto;box-shadow:0 14px 30px #000}.mh-debug-close{float:right;background:#be123c!important}.mh-training-board>footer{flex:none}.mh-roll-button:disabled{filter:grayscale(.7);opacity:.65}.mh-training-tools button.waiting{border-color:#fde047;box-shadow:inset 0 0 12px #facc1544}.mh-roll-decision{display:grid;grid-template-columns:1fr 2fr;gap:7px;align-items:center;min-height:58px;padding:6px 8px;border:2px solid #fbbf24;border-radius:19px;background:#451a03}.mh-roll-decision b{text-align:center;color:#fde68a}.mh-roll-decision button{height:44px;border-radius:13px;background:#fbbf24;color:#451a03;font-weight:1000}.mh-tool-unavailable{padding:9px;border:1px solid #f8717177;border-radius:10px;background:#450a0a;color:#fecaca!important}@media(max-width:380px){.mh-training-piece{transform:translateX(-50%) scale(.85)}.mh-training-tools{min-height:48px}.mh-training-message{min-height:24px;padding:4px}.mh-tile-viewport{min-height:220px}}
.mh-dice-overlay{position:absolute;z-index:200;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#020617c9;pointer-events:none}.mh-dice-overlay b{font-size:24px;color:#fef3c7;text-shadow:0 3px 8px #000}.mh-dice-cube{display:grid;place-items:center;width:112px;height:112px;border:7px solid #f8fafc;border-radius:25px;background:linear-gradient(145deg,#fff,#cbd5e1);color:#172554;font-size:62px;font-weight:1000;box-shadow:0 18px 35px #000b,inset -8px -8px 12px #64748b55}.mh-dice-overlay.rolling .mh-dice-cube{animation:trainingDiceRoll .22s linear infinite}.mh-dice-overlay.result .mh-dice-cube{animation:trainingDiceResult .5s cubic-bezier(.2,1.7,.4,1)}@keyframes trainingDiceRoll{25%{transform:translate(-18px,-8px) rotate(-18deg) scale(.92)}50%{transform:translate(12px,-22px) rotate(22deg) scale(1.08)}75%{transform:translate(20px,4px) rotate(8deg)}}@keyframes trainingDiceResult{0%{transform:scale(.35) rotate(-90deg)}70%{transform:scale(1.18) rotate(8deg)}100%{transform:scale(1)}}.mh-training-message{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap}.mh-training-message strong{padding:3px 7px;border-radius:7px;background:#fbbf24;color:#451a03;font-size:11px}.mh-training-message small{color:#94a3b8;font-size:7px}.mh-space-detail div{padding:8px 0;border-bottom:1px solid #ffffff1f}.mh-space-detail dt{color:#a5b4fc;font-size:8px;font-weight:1000}.mh-space-detail dd{margin-top:2px;color:#e2e8f0;font-size:10px}
.mh-tile-viewport{background:radial-gradient(circle at 55% 45%,#365314aa,#0f2940 55%,#061521),repeating-linear-gradient(135deg,#fff4 0 2px,transparent 2px 14px)}.mh-tile-board>i{height:18px;border:3px solid #f8fafccc;background:linear-gradient(#94a3b8,#475569);box-shadow:0 4px 0 #020617,0 0 8px #000;transition:.2s}.mh-tile-board>i.route{z-index:1;border-color:#fef9c3;background:#facc15;box-shadow:0 0 14px #fde047,0 4px 0 #713f12}.mh-training-tile{width:64px;height:64px;margin:-32px;border-radius:9px}.mh-training-tile.route-preview{box-shadow:0 0 0 4px #fef08a99,0 0 20px #fde047,0 5px 0 #0f172a}.mh-training-tile.stop-preview{z-index:7;border-color:#fff;box-shadow:0 0 0 6px #fb923c,0 0 28px #f97316,0 5px 0 #7c2d12;animation:trainingStop  .65s infinite alternate}.mh-branch-arrow{position:absolute;z-index:12;top:-27px;left:50%;transform:translateX(-50%);min-width:52px;padding:4px 6px;border-radius:999px;background:#f97316;color:#fff;font-size:8px;font-style:normal;font-weight:1000;white-space:nowrap;box-shadow:0 0 14px #fb923c}.mh-map-legend{position:sticky;z-index:20;left:7px;top:7px;display:flex;width:max-content;gap:4px;padding:5px;border:1px solid #ffffff55;border-radius:9px;background:#020617df;pointer-events:none}.mh-map-legend b{padding:2px 4px;border-radius:5px;background:#ffffff12;font-size:6px}.mh-goal-guide{position:sticky;z-index:20;float:right;right:7px;top:7px;padding:5px 8px;border-radius:8px;background:#713f12e8;color:#fef08a;font-size:8px;font-weight:1000;pointer-events:none}.mh-goal-guide span{display:inline-block;animation:goalPoint .7s infinite alternate}.mh-tile-viewport.overview .mh-map-legend{position:absolute;left:6px;top:6px}.mh-tile-viewport.overview .mh-goal-guide{display:none}@keyframes trainingStop{to{transform:scale(1.1)}}@keyframes goalPoint{to{transform:translateX(4px)}}
.mh-training-result{height:100%;display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));text-align:center;background:radial-gradient(circle,#14532d,#020617 65%)}.mh-training-result.failure{background:radial-gradient(circle,#3f3f46,#020617 65%)}.mh-training-result>div{width:100%;max-width:360px}.mh-result-mark{display:block;font-size:64px}.mh-training-result small{color:#f9a8d4;font:900 9px monospace;letter-spacing:.22em}.mh-training-result h2{font-size:28px;font-weight:1000}.mh-training-result>div>p{margin:7px;color:#cbd5e1;font-size:10px}.mh-training-result section{margin:18px 0;padding:13px;border:1px solid #ffffff22;border-radius:18px;background:#0007}.mh-training-result section div{display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #ffffff12}.mh-training-result section div:last-child{border:0}.mh-training-result section span{font-size:11px}.mh-training-result section b{color:#fde68a}.mh-training-result .mh-result-note{font-size:8px}.mh-training-result>div>button{width:100%;min-height:52px;margin-top:10px;border-radius:18px;background:#fff;color:#172554;font-weight:1000}
    `;
  document.head.appendChild(style);
};
createAnimationStyle();


// ==== GitHub Pages 用: グローバルからReact/フックを取得してレンダリング ====
const rootEl = document.getElementById('root');
const _root = ReactDOM.createRoot(rootEl);
_root.render(React.createElement(MonsterHeroGame));

// ==== 起動時: HTMLのローディング表示を消す ====
// 事前ロードの進捗表示はReact側の起動画面(bootPhase)が受け持つので、
// ここではHTMLに置いてある簡易ローディングを消すだけにする
try {
  const l=document.getElementById('loading'); if(l) l.style.display='none';
  const b=document.getElementById('ver-banner'); if(b) b.style.display='none';
} catch(e){ window.__mhErr && window.__mhErr('render tail: '+e.message); }
