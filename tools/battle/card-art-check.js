#!/usr/bin/env node
// 行動カードの絵(2026-10-15 社長「バトルカードの変更も進めて」)の作りを見る。
//
//   node tools/battle/card-art-check.js
//
//   ① 種類ごとの枠の色: 攻撃=赤・距離撃=青・守り=緑・支援=紫・固有技=金(弱いガード=緑)
//   ② 技のマークと段階の札: 攻撃は BASE_ATK_EVOLUTION・守りは GUARD_EVOLUTION の何番目か、距離撃は間合いのメダル+RANGE_EVOLUTION の段階
//   ③ 絵は軽い形式(webp)で images/ui/(よく使う画面の画像=事前ダウンロード)に置き、原本より小さい
//   ④ 公開の印は偽(社長が見比べてから)。デバッグ設定に切り替えがあり、ゲームに入ったら1回読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const slice = (a, b) => battle.slice(battle.indexOf(a), battle.indexOf(b));
const ctx = { RELEASE_FLAGS: { battleCardArt: false }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
vm.createContext(ctx);
vm.runInContext(read('monster-hero/data/skills.js').replace(/^const /gm, 'var '), ctx);
vm.runInContext(read('monster-hero/data/breeder.js').match(/const BATTLE_CARD_ART = Object\.freeze\(\{[\s\S]*?\n\}\);/)[0].replace('const ', 'var '), ctx);
vm.runInContext('var RANGE_LABELS = ["零","近","中","遠"];' + slice('const BATTLE_CARD_ART_DEBUG = ', '// バトルが始まる前に、枠とマークを読み込んでおく').replace(/^const /gm, 'var '), ctx);
const A = ctx.BATTLE_CARD_ART, of = ctx.battleCardArtOf;
const strip = (p) => (p || '').split('?')[0];

// ①②
const atk = (i) => of({ type: 'atk', ...ctx.BASE_ATK_EVOLUTION[i] });
check('① 攻撃は赤・段階ごとのマークと I〜IX', [0, 4, 8].every((i) => atk(i).frame === A.frames.red && strip(atk(i).mark).endsWith(`atk-${i + 1}.webp`) && atk(i).roman === ['I', 'V', 'IX'][[0, 4, 8].indexOf(i)]));
const gd = (i) => of({ type: 'guard', ...ctx.GUARD_EVOLUTION[i] });
check('① 守りは緑・段階ごとのマークと I〜IX', [0, 8].every((i) => gd(i).frame === A.frames.green && strip(gd(i).mark).endsWith(`guard-${i + 1}.webp`)) && gd(1).roman === 'II');
const rg = of({ type: 'range_atk', rangeIdx: 2, name: `中${ctx.RANGE_EVOLUTION[3].name}` });
check('① 距離撃は青・間合いのメダル(中)・段階は RANGE_EVOLUTION から(IV)', rg.frame === A.frames.blue && strip(rg.mark).endsWith('range-2.webp') && rg.roman === 'IV', JSON.stringify(rg));
const wg = of({ type: 'weak_guard', name: '弱ガード' }), un = of({ type: 'unique' }), bf = of({ type: 'buff' }), hl = of({ type: 'heal' });
check('① 弱いガードは緑(守りの1段目・札なし)・固有技は金(丸の型 gold・今のアイコン)・支援/回復は紫(今のアイコン)',
  wg.frame === A.frames.green && strip(wg.mark).endsWith('guard-1.webp') && wg.roman === '' && un.mark === null
  && bf.frame === A.frames.purple && un.frame === A.frames.gold && un.shape === 'gold' && atk(0).shape === 'std' && bf.mark === null && hl.frame === A.frames.purple);

// ③
const files = [...Object.values(A.frames), ...A.atk, ...A.guard, ...A.range].map(strip);
const missing = files.filter((f) => !fs.existsSync(path.join(root, 'monster-hero', f)));
check('③ 絵がすべて実在し、webp で images/ui/ に置いてある', missing.length === 0 && files.every((f) => /^images\/ui\/battle-cards\/.+\.webp$/.test(f)), missing.join(', '));
const total = files.reduce((n, f) => n + (fs.existsSync(path.join(root, 'monster-hero', f)) ? fs.statSync(path.join(root, 'monster-hero', f)).size : 0), 0);
check('③ 27枚の合計が 600KB 以下(原本のまま入れていない)', files.length === 27 && total <= 600 * 1024, `${Math.round(total / 1024)}KB`);
check('③ images/ui/ は事前ダウンロードのよく使う画面の画像に入る', /const ASSET_CORE_PREFIXES = \[[^\]]*'images\/ui\/'/.test(read('monster-hero/src/parts/25-asset-cache.jsx')));

// ④
check('④ 公開の印 battleCardArt は偽', /\n  battleCardArt: false,/.test(read('monster-hero/src/parts/17-release-changelog-login-missions.jsx')));
const app = read('monster-hero/src/parts/60-app.jsx');
check('④ デバッグ設定に切り替えがある', /data-battle-card-art-toggle aria-pressed=\{battleCardArtDebug\} onClick=\{\(\)=>setBattleCardArtDebug\(BATTLE_CARD_ART_DEBUG\.set\(!battleCardArtDebug\)\)\}/.test(app));
check('④ ゲームに入ったら(バトルの前に)絵を読み込む', /if \(bootPhase === 'GAME' && battleCardArtOn\(\)\) preloadBattleCardArt\(\);/.test(app));
check('④ 手札は公開の印かデバッグの切り替えのときだけ絵にする(タクティクスの新しい手札)', /const cardArt=tacticsNewLayout&&battleCardArtOn\(\)\?battleCardArtOf\(c\):null;/.test(battle));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
