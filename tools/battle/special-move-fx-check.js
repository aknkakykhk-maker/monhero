#!/usr/bin/env node
// 固有技(必殺技)の共通演出とフィニッシュが、全部の見せ場の動きに用意されているかを見る。
//
// 【なぜあるか】
// 2026-10-02 ユーザー指示「固有技はもっとかっこよくしてほしい」「みんな進めて」で、固有技に
//   ・共通の演出(SpecialMoveFx: 暗転・帯・閃光・衝撃の輪)
//   ・見せ場の動きごとのフィニッシュ(SPECIAL_FINISH: 巨大なX斬り・桜の嵐・炎の柱…)
//   ・技ごとの動きの格上げ(skmNormalize の isUnique)
// を足した。新しい見せ場の動き(atkMotion)や体当たり型を足したときに、フィニッシュの書き忘れで
// 通常技と同じ見た目の固有技が残らないように、データのつながりをここで見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const slice = (text, from, to) => { const i = text.indexOf(from), j = text.indexOf(to, i); return i >= 0 && j > i ? text.slice(i, j) : ''; };

const fx = read('monster-hero/src/parts/24-battle-fx.jsx');
const rpg = read('monster-hero/src/parts/23-rpg-debug.jsx');
const css = read('monster-hero/src/parts/70-bootstrap.jsx');
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const dex = read('monster-hero/src/parts/57-screen-monster-dex.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');

const ctx = { Object, Array, Math, String };
vm.createContext(ctx);
vm.runInContext(slice(rpg, 'const DEFAULT_ATTACK_THEMES =', 'const THEMED_ATTACK_MS =') + '\nthis.__t = { DEFAULT_ATTACK_THEMES };', ctx);
vm.runInContext(slice(fx, 'const SPECIAL_FINISH =', 'const specialFinishKindOf =') + '\nthis.__f = { SPECIAL_FINISH };', ctx);
const { DEFAULT_ATTACK_THEMES } = ctx.__t;
const { SPECIAL_FINISH } = ctx.__f;

// --- フィニッシュの割り当て ---
const themeKinds = [...new Set(Object.values(DEFAULT_ATTACK_THEMES))];
check('体当たり型(DEFAULT_ATTACK_THEMES)の全部にフィニッシュがある', themeKinds.every(k => SPECIAL_FINISH[k]), themeKinds.filter(k => !SPECIAL_FINISH[k]).join(','));
const ally = read('monster-hero/data/ally-monsters.js');
const dedicated = [...new Set([...ally.matchAll(/atkMotion:'([A-Za-z]+)'/g)].map(m => m[1]))].filter(m => m !== 'default');
const finishOfMotion = { zanCombo:'zan', eikiSakuraCombo:'sakura', kenshiTwinBlade:'kenshi', miaSongNotes:'mia', arkHolyRain:'ark', waterBurst:'tide', pandoraDualThunder:'pandora' };
check('専用モーション(atkMotion)の全部に、フィニッシュの割り当てがある',
  dedicated.every(m => finishOfMotion[m] && SPECIAL_FINISH[finishOfMotion[m]]), dedicated.filter(m => !(finishOfMotion[m] && SPECIAL_FINISH[finishOfMotion[m]])).join(','));
const fn = slice(fx, 'const specialFinishKindOf =', 'const SpecialFinish =');
check('specialFinishKindOf が上の割り当てをそのまま返す',
  Object.entries(finishOfMotion).every(([m, k]) => fn.includes(`'${k}'`) && (m === 'zanCombo' || m === 'eikiSakuraCombo' || m === 'kenshiTwinBlade' || fn.includes(`'${m}'`))), '');
check('イブリースはアークと別のフィニッシュ(炎の柱)', fn.includes("ownerId === 'Iblis' ? 'iblis' : 'ark'") && SPECIAL_FINISH.iblis && SPECIAL_FINISH.ark);

// --- ユグドラシル種・メルホイップの固有技(技名ごとの固定の定義) ---
{
  const c2 = { Object, Array, Math, String };
  vm.createContext(c2);
  vm.runInContext(read('monster-hero/data/images/images-ally.js'), c2);
  vm.runInContext(read('monster-hero/data/ally-monsters.js'), c2);
  vm.runInContext(slice(rpg, 'const SKILL_ATTACK_THEME_MONSTERS =', 'const SKILL_ATTACK_FALLBACK =') + '\nthis.__s = { SKILL_ATTACK_THEMES };', c2);
  vm.runInContext(slice(fx, 'const YG_UNIQUE_KINDS =', 'const skillFxStaticOf =') + '\nthis.__y = { YG_UNIQUE_KINDS };', c2);
  const { SKILL_ATTACK_THEMES } = c2.__s;
  const { YG_UNIQUE_KINDS } = c2.__y;
  const names = [...new Set(['Yggdrasil', 'MelWhip'].flatMap(id => vm.runInContext(`ALL_PLAYER_MONSTERS.${id}.unique.names`, c2)))];
  const kinds = names.map(n => SKILL_ATTACK_THEMES[n]);
  check('ユグドラシル種・メルホイップの固有技の全部が、固有技の格上げの対象(YG_UNIQUE_KINDS)に入っている',
    kinds.every(k => YG_UNIQUE_KINDS.includes(k)), names.filter(n => !YG_UNIQUE_KINDS.includes(SKILL_ATTACK_THEMES[n])).join(','));
  check('その全部にフィニッシュがある(キーは技の型の名前)', YG_UNIQUE_KINDS.every(k => SPECIAL_FINISH[k]), YG_UNIQUE_KINDS.filter(k => !SPECIAL_FINISH[k]).join(','));
  check('尺は格上げのぶん、バトルとプレビューの共通の表(THEMED_ATTACK_MS)に書いてある(750ms 以上)',
    YG_UNIQUE_KINDS.every(k => new RegExp(`${k}:(\\d+)`).test(rpg) && Number(rpg.match(new RegExp(`${k}:(\\d+)`))[1]) >= 750));
  check('色は技名ごとの固定の定義(SKILL_FX_SPECS)から引く', fx.includes('SKILL_ATTACK_THEMES[skillName]') && fx.includes('SKILL_FX_SPECS[staticKind].c1'));
}

// --- 部品と形(CSS) ---
const partTypes = [...new Set(Object.values(SPECIAL_FINISH).flat().map(p => p.t))];
check('部品の種類(blade/ring/col/wave/fall/bits)ごとに CSS の形がある',
  partTypes.every(t => ({ blade:'.fin-blade', ring:'.fin-ring', col:'.fin-col', wave:'.fin-wave', fall:'.fin-fall', bits:'.fin-bit' }[t] && css.includes({ blade:'.fin-blade', ring:'.fin-ring', col:'.fin-col', wave:'.fin-wave', fall:'.fin-fall', bits:'.fin-bit' }[t]))), partTypes.join(','));
const shapes = [...new Set(Object.values(SPECIAL_FINISH).flat().map(p => p.shape).filter(Boolean))];
check('粒・落下物の形(shape)の全部に CSS がある', shapes.every(sh => css.includes(`.fin-shape--${sh}`)), shapes.filter(sh => !css.includes(`.fin-shape--${sh}`)).join(','));
check('全部のフィニッシュが、放った瞬間からの遅れ(d)を持つ', Object.values(SPECIAL_FINISH).every(parts => parts.every(p => Number.isFinite(p.d))));

// --- 結線 ---
check('バトルの固有技の最中だけ SpecialMoveFx を出し、省エネ・軽量表示では出さない',
  battle.includes("!ecoBattleView&&!liteBattleView&&slotSkill&&slotSkill.type==='unique'&&attackAnim&&<SpecialMoveFx"));
check('図鑑の固有技の再生にも SpecialMoveFx(舞台の中・compact)を重ねる',
  dex.includes("playingKind==='unique'&&previewAnim&&<SpecialMoveFx compact"));
check('放った瞬間の衝撃(効果音と画面の揺れ)を、固有技を放つ3か所で呼ぶ', (app.match(/specialMoveImpact\(\)/g) || []).length >= 3);
check('固有技の格上げ(skmNormalize の isUnique)は、設定資料どおりの2つ(パンドラ)を外している',
  fx.includes("const UNIQUE_FX_EXCLUDE = Object.freeze(['Pandora-u7', 'Pandora-u8']);") && fx.includes("m[2] === 'u' && !UNIQUE_FX_EXCLUDE.includes(kind)"));
check('動きを減らす設定では、フィニッシュを出さない', css.includes('.spm__finish { display:none; }'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
