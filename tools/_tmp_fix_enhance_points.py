from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'monster-hero/src/game-system.jsx'
HELP = ROOT / 'monster-hero/data/help.js'
CHANGELOG = ROOT / 'monster-hero/data/changelog.js'
MONSTER_DOC = ROOT / 'docs/spec/MONSTER_SYSTEM.md'
SAVE_DOC = ROOT / 'docs/spec/SAVE_DATA.md'
HARNESS = ROOT / 'tools/harness.js'
CHECK = ROOT / 'tools/masu/enhance-point-total-check.js'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 exact match, got {count}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=re.S):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 regex match, got {count}')
    return out


src = SRC.read_text()

# 1) 強化ポイントの正本を「現在の凸倍率」から「到達レベル帯」へ変更する。
point_block_pattern = re.escape('// レベルアップ時の強化ポイント倍率。経験値量・必要経験値には掛けない。') + r'.*?' + re.escape("const RAINBOW_STAR_IMAGE = 'images/ui/breakthrough-rainbow-star.PNG';")
point_block_replacement = r'''// 限界突破画面などの表示用。34凸でLv270→330帯が×2、35凸でLv330→400帯が×3になる。
// 実際の付与量は現在の凸数ではなく、下の「到達レベル帯」の共通関数を正本にする。
const levelUpPointMultiplier = (rebirthCount) => {
  const n = Math.max(0, Math.floor(Number(rebirthCount) || 0));
  return n >= 35 ? 3 : n >= 34 ? 2 : 1;
};
const ENHANCE_POINT_DOUBLE_LEVEL = 270;
const ENHANCE_POINT_TRIPLE_LEVEL = 330;
// 「そのレベルへ上がる1回」で得る通常強化ポイント。
// Lv2〜270は1、Lv271〜330は2、Lv331〜400は3。Lv401以降は超越ポイントの領域。
const levelEnhancePointMultiplier = (reachedLevel) => {
  const level = Math.max(1, Math.floor(Number(reachedLevel) || 1));
  return level > ENHANCE_POINT_TRIPLE_LEVEL ? 3 : level > ENHANCE_POINT_DOUBLE_LEVEL ? 2 : 1;
};
// 現在レベルまでに「レベル由来」で得ているべき通常強化ポイントの総数。
// 重要: 34/35凸になったからといって、過去のLv1〜270へ×2/×3を遡及適用しない。
const levelBasedEnhancePoints = (level) => {
  const capped = Math.max(1, Math.min(MAX_MASU_LEVEL_CAP, Math.floor(Number(level) || 1)));
  const single = Math.max(0, Math.min(capped, ENHANCE_POINT_DOUBLE_LEVEL) - 1);
  const doubled = Math.max(0, Math.min(capped, ENHANCE_POINT_TRIPLE_LEVEL) - ENHANCE_POINT_DOUBLE_LEVEL) * 2;
  const tripled = Math.max(0, capped - ENHANCE_POINT_TRIPLE_LEVEL) * 3;
  return single + doubled + tripled;
};
// バトル・チケット・合体などで複数レベルを一度にまたいでも、帯ごとの差分を正確に付与する。
const gainedEnhancePointsBetweenLevels = (beforeLevel, afterLevel) =>
  Math.max(0, levelBasedEnhancePoints(afterLevel) - levelBasedEnhancePoints(beforeLevel));
// 2026-08-29の不具合版(#827)が起動時補填に使ってしまった誤式。
// 既存セーブの「その不具合で増えた分だけ」を安全に特定して戻すために、移行処理からのみ使う。
const legacyRetroactiveLevelBasedEnhancePoints = (level, rebirthCount) =>
  Math.max(0, Math.min(MAX_MASU_LEVEL_CAP, Math.floor(Number(level) || 0)) - 1)
    * levelUpPointMultiplier(rebirthCount);
const RAINBOW_STAR_IMAGE = 'images/ui/breakthrough-rainbow-star.PNG';'''
src = sub_once(src, point_block_pattern, point_block_replacement, 'replace point formula block')

# 2) 実レベルアップ処理は、前後レベルの正本総数の差を使う。
src = replace_once(
    src,
    "  const gainedLevels = Math.max(0, after.level - before.level);\n  const pointMultiplier = levelUpPointMultiplier(masu?.rebirthCount);\n",
    "  const gainedLevels = Math.max(0, after.level - before.level);\n",
    'remove current-rebirth multiplier from applyBondXpGain',
)
src = replace_once(
    src,
    "  const gainedTranscendPoints = Math.max(0, after.level - Math.max(cap, before.level));\n  const gainedPoints = normalLevels * pointMultiplier;\n",
    "  const gainedTranscendPoints = Math.max(0, after.level - Math.max(cap, before.level));\n"
    "  const gainedPoints = gainedEnhancePointsBetweenLevels(before.level, Math.min(cap, after.level));\n"
    "  // 同一帯だけを上がった場合は従来UI用に×2/×3を返す。帯をまたぐ場合は誤解を避けて×表示を出さない。\n"
    "  const sameBandMultiplier = normalLevels > 0 ? (gainedPoints / normalLevels) : 1;\n"
    "  const pointMultiplier = Number.isInteger(sameBandMultiplier) ? sameBandMultiplier : 1;\n",
    'use level-band delta in applyBondXpGain',
)

# 3) 転生・起動時補填・合体プレビューも同じ正本へ統一する。
src = replace_once(src, 'levelBasedEnhancePoints(nextLevel, normalized.rebirthCount)', 'levelBasedEnhancePoints(nextLevel)', 'reincarnation total')
src = replace_once(src, 'levelBasedEnhancePoints(masuBondLevelInfo(masu).level, masu.rebirthCount)', 'levelBasedEnhancePoints(masuBondLevelInfo(masu).level)', 'reconcile total')
src = replace_once(
    src,
    'const gainedLevelPoints = gainedLevels * levelUpPointMultiplier(main.rebirthCount);',
    'const gainedLevelPoints = gainedEnhancePointsBetweenLevels(mainLvl.level, afterLvl.level);',
    'fusion preview points',
)

# 4) #827で既に増えたポイントだけを1回安全に戻す。
#    未使用Pで吸収できれば配分は維持。既に使っていた場合だけ通常強化を白紙にして正しい総数を未使用へ戻す。
repair_helper = r'''const ENHANCE_POINT_BAND_REPAIR_VERSION = 1;
const normalEnhanceSpentPoints = (masu, base) => {
  const aptSpent = Array.isArray(masu?.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (Array.isArray(masu?.distApt) && base?.distAptitude
      ? masu.distApt.reduce((sum, grade, index) => {
          const from = DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]);
          const to = DIST_APTITUDE_GRADES.indexOf(grade);
          return sum + (from >= 0 && to >= 0 ? Math.max(0, to - from) : 0);
        }, 0)
      : 0);
  const statSpent = Object.keys(STAT_POINT_GAIN).reduce((sum, key) => {
    const gain = Math.max(1, Number(STAT_POINT_GAIN[key]) || 1);
    const value = Math.max(0, Number(masu?.statPoints?.[key]) || 0);
    return sum + Math.ceil(value / gain);
  }, 0);
  return { aptSpent, statSpent, total:aptSpent + statSpent };
};
const earnedEnhancePointTotal = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  return levelBasedEnhancePoints(masuBondLevelInfo(normalized).level)
    + totalBreakthroughPoints(normalized.rebirthCount)
    + ownReincarnateBonusPoints(normalized)
    + inheritedReincarnateBonusPointsOf(normalized);
};
const repairEnhancePointBandOvergrant = (masu) => {
  if (!masu || Math.floor(Number(masu.enhancePointBandRepairVersion) || 0) >= ENHANCE_POINT_BAND_REPAIR_VERSION) return masu;
  const normalized = normalizeMasuProgression(masu);
  if (normalized.rebirthCount < 34) return masu;
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[normalized.baseId] : null;
  if (!base) return masu;
  const level = masuBondLevelInfo(normalized).level;
  const correctLevelPoints = levelBasedEnhancePoints(level);
  const badLevelPoints = legacyRetroactiveLevelBasedEnhancePoints(level, normalized.rebirthCount);
  const knownOvergrant = Math.max(0, badLevelPoints - correctLevelPoints);
  if (knownOvergrant <= 0) return masu;
  const bonusPoints = totalBreakthroughPoints(normalized.rebirthCount)
    + ownReincarnateBonusPoints(normalized)
    + inheritedReincarnateBonusPointsOf(normalized);
  const badTotal = badLevelPoints + bonusPoints;
  const spent = normalEnhanceSpentPoints(normalized, base);
  const unused = Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0));
  const currentTotal = spent.total + unused;
  // 不具合版を通った個体なら、少なくとも誤式の総数まで補填されている。
  // そこに届いていない個体は「不具合による増加」と断定できないので減らさない。
  if (currentTotal < badTotal) return masu;
  const targetTotal = Math.max(0, currentTotal - knownOvergrant); // 不具合以前からの余剰があればそのまま保持
  if (unused >= knownOvergrant) {
    return {
      ...masu,
      distAptPoints: unused - knownOvergrant,
      enhancePointBandRepairVersion: ENHANCE_POINT_BAND_REPAIR_VERSION,
    };
  }
  // 過剰分が能力・適性へ既に振られている場合、「どの振り分けが過剰分だったか」は保存履歴から判別不能。
  // 任意の能力だけ削るより、通常強化だけを白紙にして正しい総数を未使用Pへ戻す。
  // 超越強化・個体基礎値・固有技・限界突破・転生・合体履歴などは一切触らない。
  return {
    ...masu,
    distAptPoints: targetTotal,
    statPoints: { hp:0, atk:0, def:0, guts:0 },
    distAptBoosts: [0,0,0,0],
    distApt: [...base.distAptitude],
    enhancePointBandRepairVersion: ENHANCE_POINT_BAND_REPAIR_VERSION,
  };
};
'''
marker = '//\n// 必要経験値の緩和(BOND_XP_DISCOUNTの引き下げ)を行うと、同じ絆経験値のまま絆レベルだけが\n'
if marker not in src:
    raise RuntimeError('repair insertion marker not found')
src = src.replace(marker, repair_helper + marker, 1)

# 起動時は補填より先に過剰分を修復する。
load_old = "      // 絆レベルに対して強化ポイントが不足しているマスモンがあれば、ここで不足分を補填する\n      // (必要経験値を緩和した際、レベルだけ上がってポイントが配られないまま残っていた分の救済)\n      const reconciledMasuMons = savedMasuMons.map(reconcileMasuPoints);\n"
load_new = "      // #827の誤式で34/35凸の過去レベルへ倍率が遡及され、既に増えた分だけを先に1回修復する。\n      // 未使用Pで吸収できる個体は配分を維持し、過剰分が使用済みなら通常強化だけ白紙にして正しい総数へ戻す。\n      const bandRepairedMasuMons = savedMasuMons.map(repairEnhancePointBandOvergrant);\n      if (bandRepairedMasuMons.some((m, i) => m !== savedMasuMons[i])) {\n        savedMasuMons = bandRepairedMasuMons;\n        await storeSet('mh_masu_mons', savedMasuMons, false);\n      }\n      // 絆レベルに対して強化ポイントが不足しているマスモンがあれば、ここで不足分を補填する\n      // (必要経験値を緩和した際、レベルだけ上がってポイントが配られないまま残っていた分の救済)\n      const reconciledMasuMons = savedMasuMons.map(reconcileMasuPoints);\n"
src = replace_once(src, load_old, load_new, 'startup repair before reconcile')

# reconcile のコメントを現仕様へ直す。
src = src.replace(
    '// 通常強化ポイントの「レベル由来ぶん」は levelBasedEnhancePoints が正本。\n  // Lv400までで止まり(Lv401以降で得られるのは超越ポイント)、限界突破34回以上なら\n  // 1レベルにつき倍率ぶんもらえる。ここを倍率なしで数えていたため、倍率で稼いだぶんが\n  // 転生のたびに消えて戻らなかった\n',
    '// 通常強化ポイントの「レベル由来ぶん」は levelBasedEnhancePoints が正本。\n  // Lv1→270は1P、270→330は2P、330→400は3Pで、現在の凸数を過去レベルへ遡及しない。\n  // Lv401以降で得られるのは通常Pではなく超越P。\n',
    1,
)
SRC.write_text(src)

# 5) ヘルプ: 「現在の凸数×全レベル」と読める表現をなくし、レベル帯を明記する。
help_src = HELP.read_text()
help_src = replace_once(
    help_src,
    "          { t:'note', title:'限界突破を重ねると、もらえる量が増えます', text:'ふだんは1レベルにつき1ポイントですが、限界突破の回数が進むと1レベルでもらえる量そのものが増えます。バトル・合体・トレーニングチケットなど、どの上がり方でも同じ量です。転生しても、この増えたぶんは失われません。' },",
    "          { t:'note', title:'高レベル帯では、もらえる量が増えます', text:'Lv.1→270は1レベルにつき1ポイント、虹★4で解放されるLv.270→330は2ポイント、虹★5で解放されるLv.330→400は3ポイントです。現在の限界突破回数を過去の低レベルへ掛け直すことはありません。バトル・合体・トレーニングチケットなど、どの上がり方でも同じ数え方です。' },",
    'help point note',
)
help_src = replace_once(
    help_src,
    "            '回数が進むと、レベルアップ1回でもらえる強化ポイントそのものが増えます(くわしくは「強化ポイントの振り方」を見てください)',",
    "            '虹★4で解放されるLv.270→330は1レベル2P、虹★5で解放されるLv.330→400は1レベル3Pです(過去の低レベルへ倍率は遡及しません)',",
    'help breakthrough bullet',
)
HELP.write_text(help_src)

# helpDataRows の一覧もレベル帯表示へ変更。
src = SRC.read_text()
help_data_pattern = r"    case 'levelUpPointMultipliers': \{\n      const rows = \[\];.*?      return rows;\n    \}"
help_data_repl = """    case 'levelUpPointMultipliers': {\n      return [\n        [`Lv.1 → ${ENHANCE_POINT_DOUBLE_LEVEL}`, 'レベルアップ1回につき 強化ポイント 1'],\n        [`Lv.${ENHANCE_POINT_DOUBLE_LEVEL} → ${ENHANCE_POINT_TRIPLE_LEVEL}（虹★4）`, 'レベルアップ1回につき 強化ポイント 2'],\n        [`Lv.${ENHANCE_POINT_TRIPLE_LEVEL} → ${MAX_MASU_LEVEL_CAP}（虹★5）`, 'レベルアップ1回につき 強化ポイント 3'],\n      ];\n    }"""
src = sub_once(src, help_data_pattern, help_data_repl, 'help data rows')
# 限界突破一覧の短い説明も、倍率がレベル帯限定だと分かるようにする。
src = src.replace(
    '虹★4はLvUP強化ポイント×2、虹★5は×3です。',
    '虹★4で解放されるLv270→330は強化P×2、虹★5で解放されるLv330→400は×3です。',
)
SRC.write_text(src)

# 6) 更新履歴。build.js が先頭エントリの日時をJST現在時刻へ揃える。
changelog = CHANGELOG.read_text()
insert_marker = 'const CHANGELOG = [\n'
entry = '''const CHANGELOG = [\n  {\n    date: "2026-08-30 00:00", type: 'issue', title: '高限界突破時の強化ポイント計算を修正しました', status: 'fixed',\n    assistantNotice: { id: 'update_notice_enhance_point_level_band_fix_v1', type: 'feature' },\n    items: [\n      '虹★4・虹★5の強化ポイント倍率が、解放された高レベル帯だけでなく過去の低レベルにも遡って掛かる不具合を修正しました。正しくはLv.1→270が1P、Lv.270→330が2P、Lv.330→400が3Pです。',\n      'バトル・合体・トレーニングチケット・スキップ・転生・起動時の不足補填・合体前プレビューを、すべて同じレベル帯の共通計算へ統一しました。',\n      '不具合版で既に増えていたポイントは、その不具合で増えた分だけ自動補正します。未使用ポイントだけで戻せる場合は振り分けを維持し、既に過剰分を能力や間合い適性へ使っていた個体だけ通常強化を白紙にして、正しい総ポイントを未使用として返します。超越強化・個体基礎値・固有技・限界突破・転生・合体履歴は変更しません。',\n    ],\n  },\n'''
if insert_marker not in changelog:
    raise RuntimeError('changelog marker not found')
changelog = changelog.replace(insert_marker, entry, 1)
CHANGELOG.write_text(changelog)

# 7) 設計書を現仕様と救済仕様へ同期。
monster_doc = MONSTER_DOC.read_text()
monster_doc_pattern = r"レベルは1から始まり、コードは超越の上限であるLv\.500まで反復して算出する（超越していない個体はLv\.400で頭打ち）。通常は1レベル上昇ごとに強化ポイントを1得る。虹★4（34凸）で上がるLv\.270→330は1レベルにつき2、虹★5（35凸）で上がるLv\.330→400は1レベルにつき3を得る。倍率は共通の絆XP加算処理で上昇レベル数に掛け、獲得XPや必要XPには掛けない。読み込み時には「絆Lv-1」と使用済み＋未使用ポイントを比較し、不足分を補填する。"
monster_doc_repl = "レベルは1から始まり、コードは超越の上限であるLv.500まで反復して算出する（超越していない個体はLv.400で頭打ち）。通常強化ポイントは**現在の限界突破回数ではなく到達レベル帯**で決まり、Lv.1→270は1レベルにつき1、虹★4（34凸）で解放されるLv.270→330は2、虹★5（35凸）で解放されるLv.330→400は3を得る。34/35凸になってもLv.1〜270へ倍率を遡及適用しない。共通関数 `levelBasedEnhancePoints` が現在Lvまでの総数、`gainedEnhancePointsBetweenLevels` が前後Lvの差分を返し、バトル・合体・各種チケット・転生・ロード補填・プレビューが同じ計算を使う。Lv.401以降は通常強化Pではなく超越Pを得る。"
monster_doc = sub_once(monster_doc, monster_doc_pattern, monster_doc_repl, 'monster system point paragraph')
MONSTER_DOC.write_text(monster_doc)

save_doc = SAVE_DOC.read_text()
save_doc = replace_once(
    save_doc,
    '- `inheritedReincarnateCount`: 合体で受け継いだ転生育成の表示用回数分。自身の転生回数・条件判定には使わず、欠損時は0。\n',
    '- `inheritedReincarnateCount`: 合体で受け継いだ転生育成の表示用回数分。自身の転生回数・条件判定には使わず、欠損時は0。\n- `enhancePointBandRepairVersion`: 34/35凸の倍率が過去Lvへ遡及された既知不具合を補正済みの個体だけが持つ版番号。欠損は未補正として扱うが、誤式の総数に達していない個体は減算しない。\n',
    'save data optional field',
)
save_doc = replace_once(
    save_doc,
    'さらに起動時、各マスモンの現在絆Lvから得られるはずの総点と、使用済み＋未使用点を比較し、不足分を補う。過剰分を減らす処理はない。',
    'さらに起動時、各マスモンの現在絆Lvから得られるはずの総点と、使用済み＋未使用点を比較し、不足分だけを補う。通常の補填処理は過剰分を減らさない。\n\n例外として、2026-08-29の既知不具合（34/35凸の現在倍率をLv.1から全レベルへ遡及して補填したもの）だけは `repairEnhancePointBandOvergrant` で不具合由来の差分を特定して戻す。誤式の総数まで到達していない個体は触らず、不具合以前から存在した余剰分も保持する。過剰分が未使用Pだけで戻せる場合は配分を維持し、使用済みに食い込んでいる場合だけ通常の `statPoints` / `distAptBoosts` を0へ戻し、正しい総数を `distAptPoints` へ返す。`enhancePointBandRepairVersion` で二重適用を防ぐ。超越強化・個体基礎値・技・限界突破・転生・合体履歴には触れない。',
    'save migration paragraph',
)
SAVE_DOC.write_text(save_doc)

# 8) harness へ新しい正本・移行関数を公開し、回帰テストから本体実装そのものを動かす。
harness = HARNESS.read_text()
harness = replace_once(
    harness,
    "  'levelBasedEnhancePoints',\n  'applyBondXpGain',\n",
    "  'levelBasedEnhancePoints',\n  'gainedEnhancePointsBetweenLevels',\n  'legacyRetroactiveLevelBasedEnhancePoints',\n  'repairEnhancePointBandOvergrant',\n  'ENHANCE_POINT_BAND_REPAIR_VERSION',\n  'applyBondXpGain',\n",
    'harness exports',
)
HARNESS.write_text(harness)

# 9) 強化ポイント回帰テストを、今回の実事故4個体・境界・全経路・既存セーブ補正まで拡張する。
check_src = r'''// 強化ポイントの総数・レベル帯・転生・既存セーブ補正が全経路で一致することを確認する。
//
//   node tools/masu/enhance-point-total-check.js
//
// 正本:
//   Lv.1→270   : 1レベルにつき1P
//   Lv.270→330 : 1レベルにつき2P（虹★4 / 34凸で解放）
//   Lv.330→400 : 1レベルにつき3P（虹★5 / 35凸で解放）
//
// 「現在35凸だからLv1から全部×3」のような遡及計算は禁止する。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const a = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 正本がレベル帯になっているか ---
check('総数の正本は現在の凸倍率を掛けない',
  source.includes('const levelBasedEnhancePoints = (level) =>')
    && source.includes('const gainedEnhancePointsBetweenLevels = (beforeLevel, afterLevel) =>')
    && !source.includes('const levelBasedEnhancePoints = (level, rebirthCount) =>'));
check('実レベルアップは前後レベルの差分を使う',
  source.includes('const gainedPoints = gainedEnhancePointsBetweenLevels(before.level, Math.min(cap, after.level));'));
check('読み込み補填も同じ正本を使う',
  source.includes('const earned = levelBasedEnhancePoints(masuBondLevelInfo(masu).level)'));
check('転生も同じ正本を使う',
  source.includes('const nextPoints = levelBasedEnhancePoints(nextLevel)'));
check('合体プレビューも同じ差分を使う',
  source.includes('const gainedLevelPoints = gainedEnhancePointsBetweenLevels(mainLvl.level, afterLvl.level);'));
check('スキップチケットも共通XP処理を通る',
  source.includes('return applyBondXpGain(mon, award.gain).masu;'));

const expectedByLevel = new Map([
  [1, 0], [150, 149], [270, 269], [271, 271], [330, 389], [331, 392], [400, 599], [500, 599],
]);
for (const [level, expected] of expectedByLevel) {
  check(`Lv${level}までのレベル由来P = ${expected}`, a.levelBasedEnhancePoints(level) === expected,
    `${a.levelBasedEnhancePoints(level)}`);
}
check('壊れた値でも0未満にならない',
  a.levelBasedEnhancePoints(0) === 0 && a.levelBasedEnhancePoints(null) === 0);

// 境界を1回・複数Lvでまたぐケース。
for (const [from, to, expected] of [
  [150,151,1], [269,270,1], [270,271,2], [269,271,3],
  [329,330,2], [330,331,3], [329,331,5], [398,400,6], [400,450,0],
]) {
  check(`Lv${from}→${to} の通常P = ${expected}`,
    a.gainedEnhancePointsBetweenLevels(from, to) === expected,
    `${a.gainedEnhancePointsBetweenLevels(from, to)}`);
}

// --- ② applyBondXpGain（バトル・合体・チケット共通）の実動作 ---
const makeMasu = (level, rebirthCount, over = {}) => a.normalizeMasuProgression({
  id:'m1', baseId:'Snegurochka', levelCap: rebirthCount >= 35 ? 400 : rebirthCount >= 34 ? 330 : 270,
  bondXp:a.totalBondXpForLevel(level), rebirthCount, reincarnateCount:0,
  distAptPoints:0, distAptBoosts:[0,0,0,0], statPoints:{hp:0,atk:0,def:0,guts:0}, ...over,
});
const levelTo = (m, to) => a.applyBondXpGain(m, a.totalBondXpForLevel(to) - (m.bondXp || 0));
check('35凸でもLv150→151は+1（過去帯へ×3しない）', levelTo(makeMasu(150,35),151).gainedPoints === 1);
check('34凸のLv320→325は+10', levelTo(makeMasu(320,34),325).gainedPoints === 10);
check('35凸のLv390→395は+15', levelTo(makeMasu(390,35),395).gainedPoints === 15);
check('35凸でLv269→271を一気に跨いでも+3', levelTo(makeMasu(269,35),271).gainedPoints === 3);

// --- ③ 実報告4個体を総数で固定する ---
const expectedTotal = (level, rebirthCount, reincarnateCount, inherited = 0) =>
  a.levelBasedEnhancePoints(level) + a.totalBreakthroughPoints(rebirthCount)
    + reincarnateCount * a.REINCARNATE_POINTS + inherited;
check('ヤオビクニ Lv150/35凸/転生4 = 228P', expectedTotal(150,35,4) === 228);
check('ウンディーネ Lv150/34凸/転生4 = 227P', expectedTotal(150,34,4) === 227);
check('パンドラ Lv232/33凸/転生7 = 338P', expectedTotal(232,33,7) === 338);
check('スネグーラチカ Lv331/35凸/転生5 = 481P', expectedTotal(331,35,5) === 481);

// --- ④ 転生で減らず、同じLvへ戻すと転生+10だけ増える ---
const GAIN = { hp:10, atk:3, def:3, guts:3 };
const totalPointsOf = (m) => {
  const rec = a.reconcileMasuPoints(a.normalizeMasuProgression(m));
  const boosts = (rec.distAptBoosts || [0,0,0,0]).reduce((s, v) => s + v, 0);
  const stat = Object.entries(rec.statPoints || {})
    .reduce((s, [k, v]) => s + Math.ceil((v || 0) / (GAIN[k] || 1)), 0);
  return boosts + stat + (rec.distAptPoints || 0);
};
const bad = [];
for (const level of [120,150,269,270,271,320,330,331,399,400]) {
  for (const rebirthCount of [0,33,34,35]) {
    const cap = rebirthCount >= 35 ? 400 : rebirthCount >= 34 ? 330 : 270;
    if (level > cap || level < a.REINCARNATE_MIN_LEVEL) continue;
    for (const reincarnateCount of [0,4]) {
      for (const inheritedPoints of [0,190]) {
        const masu = makeMasu(level, rebirthCount, {
          levelCap:cap, reincarnateCount, inheritedReincarnateBonusPoints:inheritedPoints,
        });
        const before = totalPointsOf(masu);
        const r = a.buildMasuReincarnation({ masu, skillKey:null, gold:10 ** 12 });
        if (!r.ok) { bad.push(`転生不可 Lv${level}/凸${rebirthCount}`); continue; }
        const back = { ...a.normalizeMasuProgression(r.nextMasu), bondXp:a.totalBondXpForLevel(level) };
        const after = totalPointsOf(back);
        if (after - before !== a.REINCARNATE_POINTS) {
          bad.push(`Lv${level}/凸${rebirthCount}/転生${reincarnateCount}/継承${inheritedPoints}: ${before}→${after}`);
        }
      }
    }
  }
}
check('転生→同じLvまで育て直すと総数はちょうど+10', bad.length === 0, bad.slice(0,4).join(' / '));

// --- ⑤ #827で既に増えたセーブの自動補正 ---
const badTotal = (level, rebirthCount, reincarnateCount, inherited = 0) =>
  a.legacyRetroactiveLevelBasedEnhancePoints(level, rebirthCount)
    + a.totalBreakthroughPoints(rebirthCount) + reincarnateCount * a.REINCARNATE_POINTS + inherited;
const yaobiBad = makeMasu(150,35,{ reincarnateCount:4, distAptPoints:526 });
const yaobiFixed = a.repairEnhancePointBandOvergrant(yaobiBad);
check('未使用Pだけで戻せるヤオビクニ相当は配分を崩さず526→228',
  yaobiFixed.distAptPoints === 228 && yaobiFixed.enhancePointBandRepairVersion === a.ENHANCE_POINT_BAND_REPAIR_VERSION);

// スネグー相当: 765P使用済み + 314P未使用 = 1079P。過剰598Pが未使用だけでは足りないので通常強化を白紙へ。
const snegBad = makeMasu(331,35,{
  reincarnateCount:5, distAptPoints:314,
  statPoints:{hp:1700, atk:867, def:621, guts:252}, // 170+289+207+84 = 750P
  distAptBoosts:[0,9,6,0], // 15P、合計使用765P
});
check('テスト前提: スネグー誤式総数は1079', badTotal(331,35,5) === 1079);
const snegFixed = a.repairEnhancePointBandOvergrant(snegBad);
check('過剰分を使用済みなら通常強化だけ白紙にして正しい481Pを返す',
  snegFixed.distAptPoints === 481
    && Object.values(snegFixed.statPoints).every(v => v === 0)
    && snegFixed.distAptBoosts.every(v => v === 0)
    && snegFixed.enhancePointBandRepairVersion === a.ENHANCE_POINT_BAND_REPAIR_VERSION,
  `unused=${snegFixed.distAptPoints}`);
check('補正済み個体へ二重適用しない', a.repairEnhancePointBandOvergrant(snegFixed) === snegFixed);

const legit = makeMasu(331,35,{ reincarnateCount:5, distAptPoints:481 });
check('誤式の総数まで増えていない正規個体は減らさない', a.repairEnhancePointBandOvergrant(legit) === legit);
const withLegacyExtra = makeMasu(331,35,{ reincarnateCount:5, distAptPoints:1079 + 12 });
const extraFixed = a.repairEnhancePointBandOvergrant(withLegacyExtra);
check('不具合以前からの余剰12Pは保持して481+12へ戻す', extraFixed.distAptPoints === 493, `${extraFixed.distAptPoints}`);

// --- ⑥ Lv401以降は通常Pを増やさず超越Pだけ ---
const transcended = makeMasu(400,35,{ levelCap:500, transcended:true });
const beyond = a.applyBondXpGain(transcended, a.totalBondXpForLevel(402) - transcended.bondXp);
check('Lv400→402は通常P+0・超越P+2', beyond.gainedPoints === 0 && beyond.gainedTranscendPoints === 2);

// --- ⑦ ヘルプと起動修復導線 ---
const helpSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/help.js'), 'utf8');
check('ヘルプは倍率一覧を実データから表示する',
  helpSrc.includes("{ t:'data', id:'levelUpPointMultipliers' }") && source.includes("case 'levelUpPointMultipliers':"));
check('起動時はreconcileより先に既知過剰補正を行う',
  source.indexOf('savedMasuMons.map(repairEnhancePointBandOvergrant)') >= 0
    && source.indexOf('savedMasuMons.map(repairEnhancePointBandOvergrant)') < source.indexOf('savedMasuMons.map(reconcileMasuPoints)'));

console.log(failed === 0 ? '\n強化ポイントのレベル帯・転生・既存セーブ補正: PASS' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
'''
CHECK.write_text(check_src)

print('temporary repair script: edits applied successfully')
