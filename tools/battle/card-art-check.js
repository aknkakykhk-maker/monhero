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
const files = [...Object.values(A.frames), ...A.atk, ...A.guard, ...A.range, ...Object.values(A.plates || {})].map(strip);
const missing = files.filter((f) => !fs.existsSync(path.join(root, 'monster-hero', f)));
check('③ 絵がすべて実在し、webp で images/ui/ に置いてある', missing.length === 0 && files.every((f) => /^images\/ui\/battle-cards\/.+\.webp$/.test(f)), missing.join(', '));
const total = files.reduce((n, f) => n + (fs.existsSync(path.join(root, 'monster-hero', f)) ? fs.statSync(path.join(root, 'monster-hero', f)).size : 0), 0);
check('③ 32枚(枠5・マーク22・名札5)の合計が 600KB 以下(原本のまま入れていない)', files.length === 32 && total <= 600 * 1024, `${Math.round(total / 1024)}KB`);
check('③ images/ui/ は事前ダウンロードのよく使う画面の画像に入る', /const ASSET_CORE_PREFIXES = \[[^\]]*'images\/ui\/'/.test(read('monster-hero/src/parts/25-asset-cache.jsx')));

// ⑤ 名札(2026-10-15)
const plateOf = (c) => of(c).plate && strip(of(c).plate);
check('⑤ 名札は枠と同じ色(攻撃=赤・距離撃=青・守り=緑・支援=紫・固有技=金)',
  plateOf({ type: 'atk', ...ctx.BASE_ATK_EVOLUTION[0] }).endsWith('plate-red.webp') && plateOf({ type: 'range_atk', rangeIdx: 0, name: `零${ctx.RANGE_EVOLUTION[0].name}` }).endsWith('plate-blue.webp')
  && plateOf({ type: 'guard', ...ctx.GUARD_EVOLUTION[0] }).endsWith('plate-green.webp') && plateOf({ type: 'buff' }).endsWith('plate-purple.webp') && plateOf({ type: 'unique' }).endsWith('plate-gold.webp'));
const htmlSrc = read('monster-hero/index.html');
check('⑤ 名札は9分割で真ん中だけ伸ばす(border-image)・金の名札は濃い字', /border-image-source: var\(--mh-plate\); border-image-slice: 11 27 fill;/.test(htmlSrc) && /\[data-card-plate="gold"\] \[data-card-name\][^{]*\{ color: #241000/.test(htmlSrc));
check('⑤ 名札もバトル前に読み込む', /\.\.\.Object\.values\(BATTLE_CARD_ART\.plates \|\| \{\}\)\]/.test(battle));

// ⑥ 名前の折り返し(2026-10-15 社長「言葉の切れ目で折って」)。手札に出る名前を全部折ってみる
{
  const nameCtx = {};
  vm.createContext(nameCtx);
  vm.runInContext(slice('const BATTLE_CARD_NAME_PER_LINE', 'const BATTLE_CARD_ROMAN = Object.freeze(').replace(/^const /gm, 'var '), nameCtx);
  const ally = read('monster-hero/data/ally-monsters.js'), skills = read('monster-hero/data/skills.js'), breederSrc = read('monster-hero/data/breeder.js');
  const strs = (t) => [...t.matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => m[1] || m[2]);
  const names = new Set();
  const atkSrc = ally.slice(0, ally.indexOf('};', ally.indexOf('const HERO_ATK_NAMES')));
  for (const m of atkSrc.matchAll(/\[([^\]]*)\]/g)) strs(m[1]).forEach((x) => names.add(x));
  for (const m of ally.matchAll(/names:\s*\[([^\]]*)\]/g)) strs(m[1]).forEach((x) => names.add(x));
  const ge = skills.slice(skills.indexOf('const GUARD_EVOLUTION'), skills.indexOf('const RANGE_EVOLUTION'));
  for (const m of ge.matchAll(/name:"([^"]+)"/g)) names.add(m[1]);
  const re = skills.slice(skills.indexOf('const RANGE_EVOLUTION'), skills.indexOf('const TYPE_COLORS'));
  for (const m of re.matchAll(/name:"([^"]+)"/g)) ['零', '近', '中', '遠'].forEach((l) => names.add(l + m[1]));
  const be = breederSrc.slice(breederSrc.indexOf('const BREEDER_EVO_NAMES'), breederSrc.indexOf('};', breederSrc.indexOf('const BREEDER_EVO_NAMES')));
  for (const m of be.matchAll(/"([^"]+)"/g)) names.add(m[1]);
  const all = [...names].map((n) => [n, nameCtx.battleCardNameLines(n)]);
  const badHead = all.filter(([, l]) => l.slice(1).some((x) => nameCtx.BATTLE_CARD_NO_BREAK_BEFORE.test(x)));
  const tooLong = all.filter(([, l]) => l.some((x) => [...x].length > 8));
  check('⑥ 手札に出る名前を全部折れる(小さい字・長音で行が始まらない)', all.length > 300 && badHead.length === 0, `${all.length}件 ${badHead.slice(0, 3).map(([n, l]) => l.join('/')).join(' ')}`);
  check('⑥ 1行は8字まで(長い名前は字を小さくして2行)', tooLong.length === 0, tooLong.slice(0, 3).map(([n, l]) => l.join('/')).join(' '));
  const want = { 'ぞうさん頭突き': 'ぞうさん/頭突き', 'ニコラオの力': 'ニコラオ/の力', 'メロメロハート': 'メロメロ/ハート', 'ハイガード': 'ハイガード', 'ライトニング': 'ライトニング', 'ナイトサンダー': 'ナイト/サンダー', 'かどみうむの計算': 'かどみうむの/計算' };
  const miss = Object.entries(want).filter(([n, w]) => nameCtx.battleCardNameLines(n).join('/') !== w);
  check('⑥ 言葉の切れ目で折る(ぞうさん/頭突き・ニコラオ/の力 など)', miss.length === 0, miss.map(([n]) => `${n}→${nameCtx.battleCardNameLines(n).join('/')}`).join(' '));
  if (process.env.CARD_NAME_LIST) fs.writeFileSync(process.env.CARD_NAME_LIST, all.map(([n, l]) => `${n}\t${l.join(' / ')}`).join('\n') + '\n');
}

// ④
check('④ 公開の印 battleCardArt は偽', /\n  battleCardArt: false,/.test(read('monster-hero/src/parts/17-release-changelog-login-missions.jsx')));
const app = read('monster-hero/src/parts/60-app.jsx');
check('④ デバッグ設定に切り替えがある', /data-battle-card-art-toggle aria-pressed=\{battleCardArtDebug\} onClick=\{\(\)=>setBattleCardArtDebug\(BATTLE_CARD_ART_DEBUG\.set\(!battleCardArtDebug\)\)\}/.test(app));
check('④ ゲームに入ったら(バトルの前に)絵を読み込む', /if \(bootPhase === 'GAME' && battleCardArtOn\(\)\) preloadBattleCardArt\(\);/.test(app));
check('④ 手札は公開の印かデバッグの切り替えのときだけ絵にする(タクティクスの新しい手札)', /const cardArt=tacticsNewLayout&&battleCardArtOn\(\)\?battleCardArtOf\(c\):null;/.test(battle));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
