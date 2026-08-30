const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text);

const replaceOnce = (text, before, after, label) => {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected text not found`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected text appears more than once`);
  return text.slice(0, first) + after + text.slice(first + before.length);
};

// 1) 本体: 旧形式ゴーレムは間合い適性の使用済みPを安全に逆算できないため、既知不具合の自動補正対象から外す。
{
  const rel = 'monster-hero/src/game-system.jsx';
  let src = read(rel);
  const before = `const repairEnhancePointBandOvergrant = (masu) => {\n  if (!masu || Math.floor(Number(masu.enhancePointBandRepairVersion) || 0) >= ENHANCE_POINT_BAND_REPAIR_VERSION) return masu;\n  const normalized = normalizeMasuProgression(masu);`;
  const after = `const repairEnhancePointBandOvergrant = (masu) => {\n  if (!masu || Math.floor(Number(masu.enhancePointBandRepairVersion) || 0) >= ENHANCE_POINT_BAND_REPAIR_VERSION) return masu;\n  // 旧形式ゴーレムは、過去のベース適性変更(A/C/E/G → A/E/G/G)により distApt だけでは\n  // 実際に使った適性Pを一意に戻せない。reconcileMasuPoints と同じく、distAptBoosts を持つ\n  // 新形式へ安全に移行済みになるまでは推測でポイントを減らしたり通常強化を白紙化しない。\n  if (masu.baseId === 'Golem' && !Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts')) return masu;\n  const normalized = normalizeMasuProgression(masu);`;
  src = replaceOnce(src, before, after, 'game-system old Golem guard');
  write(rel, src);
}

// 2) 回帰テスト: 旧形式だけ保護し、新形式ゴーレムは他種と同じ既知過剰補正を受けることを固定。
{
  const rel = 'tools/masu/enhance-point-total-check.js';
  let src = read(rel);
  const before = `const extraFixed = a.repairEnhancePointBandOvergrant(withLegacyExtra);\ncheck('不具合以前からの余剰12Pは保持して481+12へ戻す', extraFixed.distAptPoints === 493, \`${'${extraFixed.distAptPoints}'}\`);\n\n// --- ⑥ Lv401以降は通常Pを増やさず超越Pだけ ---`;
  const after = `const extraFixed = a.repairEnhancePointBandOvergrant(withLegacyExtra);\ncheck('不具合以前からの余剰12Pは保持して481+12へ戻す', extraFixed.distAptPoints === 493, \`${'${extraFixed.distAptPoints}'}\`);\n\n// 旧ゴーレムは過去にベース適性が変わっており、distAptだけの旧形式では実際の使用済み適性Pを\n// 安全に逆算できない。ここへ推測補正を掛けると他プレイヤーの古い個体を壊すため、そのまま保護する。\nconst legacyGolem = {\n  id:'legacy-golem', baseId:'Golem', levelCap:400, bondXp:a.totalBondXpForLevel(150),\n  rebirthCount:35, reincarnateCount:4, distAptPoints:526, distApt:['A','C','E','G'],\n  statPoints:{hp:0,atk:0,def:0,guts:0},\n};\nconst legacyGolemFixed = a.repairEnhancePointBandOvergrant(legacyGolem);\ncheck('distAptBoostsを持たない旧形式ゴーレムは推測補正せず完全に保持する',\n  legacyGolemFixed === legacyGolem && legacyGolemFixed.enhancePointBandRepairVersion == null);\n\n// 新形式へ移行済みなら使用済み適性Pが明示されているため、ゴーレムだけを一律除外しない。\nconst modernGolem = makeMasu(150,35,{ baseId:'Golem', reincarnateCount:4, distAptPoints:526 });\nconst modernGolemFixed = a.repairEnhancePointBandOvergrant(modernGolem);\ncheck('distAptBoostsを持つ新形式ゴーレムは通常どおり526→228へ補正する',\n  modernGolemFixed.distAptPoints === 228\n    && modernGolemFixed.enhancePointBandRepairVersion === a.ENHANCE_POINT_BAND_REPAIR_VERSION,\n  \`unused=${'${modernGolemFixed.distAptPoints}'}\`);\n\n// --- ⑥ Lv401以降は通常Pを増やさず超越Pだけ ---`;
  src = replaceOnce(src, before, after, 'enhance point Golem regression tests');
  write(rel, src);
}

// 3) 保存仕様: 既存のreconcileと同じ旧ゴーレム保護を、今回の過剰補正にも明文化。
{
  const rel = 'docs/spec/SAVE_DATA.md';
  let src = read(rel);
  const before = `例外として、2026-08-29の既知不具合（34/35凸の現在倍率をLv.1から全レベルへ遡及して補填したもの）だけは \`repairEnhancePointBandOvergrant\` で不具合由来の差分を特定して戻す。誤式の総数まで到達していない個体は触らず、不具合以前から存在した余剰分も保持する。過剰分が未使用Pだけで戻せる場合は配分を維持し、使用済みに食い込んでいる場合だけ通常の \`statPoints\` / \`distAptBoosts\` を0へ戻し、正しい総数を \`distAptPoints\` へ返す。\`enhancePointBandRepairVersion\` で二重適用を防ぐ。超越強化・個体基礎値・技・限界突破・転生・合体履歴には触れない。`;
  const after = before + ` ただし、過去のベース間合い適性変更により使用済み適性Pを安全に逆算できない \`distAptBoosts\` 未保持の旧形式ゴーレムは、通常の不足補填と同様に推測補正の対象外とし、現在の保存内容をそのまま維持する。\`distAptBoosts\` を持つ新形式ゴーレムは他種と同じ補正対象とする。`;
  src = replaceOnce(src, before, after, 'SAVE_DATA old Golem rule');
  write(rel, src);
}

// 4) 更新履歴。build.js がリリース日時をJSTの現在時刻へ正規化する。
{
  const rel = 'monster-hero/data/changelog.js';
  let src = read(rel);
  const marker = `const CHANGELOG = [\n`;
  const entry = `  {\n    date: \"2026-08-30 17:07\", type: 'fix', title: '旧形式ゴーレムの強化ポイント補正を安全化しました', status: 'new',\n    items: [\n      '過去の間合い適性変更より前から育成されている旧形式ゴーレムでは、使用済みの適性ポイントを現在値から推測して自動補正しないよう保護しました。',\n      '距離ごとの強化段階を保存している新形式ゴーレムは、ほかのマスモンと同じく高限界突破時の過剰ポイントだけを正しく補正します。',\n    ],\n  },\n`;
  if (src.includes("title: '旧形式ゴーレムの強化ポイント補正を安全化しました'")) throw new Error('changelog entry already exists');
  src = replaceOnce(src, marker, marker + entry, 'changelog insertion');
  write(rel, src);
}

console.log('Applied old Golem enhancement-repair safety guard and regression coverage.');
