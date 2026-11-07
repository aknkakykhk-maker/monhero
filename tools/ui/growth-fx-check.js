// 上がる値の演出(monster-hero/src/parts/44-growth-fx.jsx)の見張り。2026-11-07 演出担当ハナビ
// 守ること(統括・社長):
//  ・見た目だけ。保存しない・画面を切り替えない・ゲームの状態を書き換えない
//  ・演奏中・マルチ中・バトル中・お話の最中は出さない(貯めて、出してよい画面へ来てから出す)
//  ・続けて上がったら1枚にまとめる(全部の行動で出すので、うるさくしない)
//  ・60-app.jsx からの呼び出しはすべて typeof で守り、値の計算・保存の行より後ろで呼ぶ
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/44-growth-fx.jsx'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const errors = [];
const ng = (m) => errors.push(m);

// 1) 保存・画面切り替えの言葉を使っていない
for (const word of ['storeSet', 'localStorage', 'sessionStorage', 'setGameState', 'storeGet', 'supabase', 'fetch(']) {
  if (SRC.includes(word)) ng(`44-growth-fx.jsx に「${word}」がある(見た目だけの部品なので、保存・画面の切り替え・通信はしない)`);
}

// 2) 出してよい画面に、遊びの最中の画面が入っていない
const setMatch = SRC.match(/GROWTH_FX_CALM_SCREENS = Object\.freeze\(new Set\(\[([\s\S]*?)\]\)\)/);
if (!setMatch) ng('GROWTH_FX_CALM_SCREENS が見つからない');
const calm = setMatch ? [...setMatch[1].matchAll(/'([A-Z_]+)'/g)].map(m => m[1]) : [];
const BUSY = /RHYTHM|BATTLE|CARD|RAID|PICK|TUTORIAL|ONBOARDING|CHAMPION|STORY|MULTI|DEBUG|TRAINING|REWARD|QUICK|GAME_OVER|RESULT/;
calm.filter(s => BUSY.test(s)).forEach(s => ng(`出してよい画面に遊びの最中の画面「${s}」が入っている`));
if (!calm.includes('HOME')) ng('出してよい画面に HOME が無い');

// 3) お話・ほかの大きな演出の目印で止める
for (const sel of ['[data-event-story]', '[data-story-stage]', '[data-player-rank-up-fx]']) {
  if (!SRC.includes(sel)) ng(`止める目印に ${sel} が無い`);
}

// 4) 中身の動き(貯め方・まとめ方・出してよいか)を、部品の外側だけ取り出して確かめる
const head = SRC.slice(0, SRC.indexOf('// ---------- 見た目 ----------'));
const vis = SRC.match(/const growthFxVisible = [\s\S]*?\n};\n/);
const ctx = { console, ASSISTANT_LIST: [{ id: 'mua', name: 'みゅあ', imageDir: 'images/assistant', imagePrefix: 'myua' }],
  assistantBondStage: (p) => ({ level: p >= 100 ? 2 : 1, need: p >= 100 ? 100 : 0 }), assistantBondNext: (p) => (p < 100 ? { level: 2, need: 100 } : { level: 3, need: 300 }),
  assistantBondLevel: (p) => (p >= 100 ? 2 : 1), assistantBondStageByLevel: () => ({ title: '' }), assistantBondRewardRows: () => [{ level: 2, rewards: ['ダイヤ×10'], frames: [], callStyle: false }] };
vm.createContext(ctx);
vm.runInContext(`${head}\n${vis ? vis[0] : ''}\nthis.S=GROWTH_FX_STORE;this.push=growthFxPush;this.bond=growthFxAssistantBond;this.visible=growthFxVisible;this.breeder=growthFxBreederLevel;this.item=growthFxMasuBondItem;`, ctx);
ctx.bond('mua', 10, 14); ctx.bond('mua', 14, 18); ctx.bond('mua', 18, 22);
if (ctx.S.small.length !== 1 || ctx.S.small[0].gain !== 12) ng(`同じ助手の仲良し度が3回上がったら札1枚・+12 にまとめる(いま ${ctx.S.small.length}枚・+${ctx.S.small[0] && ctx.S.small[0].gain})`);
ctx.bond('mua', 22, 22); ctx.bond('mua', 30, 20);
if (ctx.S.small[0].gain !== 12) ng('上がっていない(同じ・下がった)ときに札を出した');
ctx.bond('mua', 90, 120);
if (ctx.S.sheets.length !== 1 || ctx.S.sheets[0].tier !== 'level' || ctx.S.sheets[0].levelTo !== 2) ng('仲良し度の Lv が上がったのに Lvアップの演出を貯めていない');
ctx.breeder(5, 5); ctx.breeder(5, 6); ctx.breeder(6, 7);
const br = ctx.S.sheets.filter(s => s.kind === 'breeder');
if (br.length !== 1 || br[0].levelFrom !== 5 || br[0].levelTo !== 7) ng(`ブリーダーLvが続けて上がったら1つにまとめる(いま ${br.length}件 ${br[0] && br[0].levelFrom}→${br[0] && br[0].levelTo})`);
ctx.item({ masuName: 'アーク', itemName: 'チケット', count: 1, gain: 0, before: { level: 1 }, after: { level: 1 } });
if (ctx.S.sheets.some(s => s.tier === 'item')) ng('絆経験値が増えていない(上限)ときにアイテムの演出を出した');
for (let i = 0; i < 40; i++) ctx.push({ tier: 'small', kind: 'bond', who: `x${i}`, gain: 1 });
if (ctx.S.small.length > 24) ng('札を貯める数に上限が無い');
// 出してよいか
const v = (screen, hold) => ctx.visible(screen, hold || {});
for (const s of ['RHYTHM_PLAY', 'RHYTHM_MULTI', 'BATTLE', 'CARD_BATTLE', 'CHAMPION', 'RAID_JACK', 'ONBOARDING']) {
  if (v(s).all || v(s).sheet) ng(`${s} で演出を出してしまう`);
}
if (!v('HOME').sheet) ng('HOME で出せない');
if (v('HOME', { all: true }).all) ng('お話の最中(HOME の上)に札を出してしまう');
if (v('HOME', { sheet: true }).sheet || !v('HOME', { sheet: true }).all) ng('おしゃべりの最中は札だけ出し、カード・Lvアップは待つ');

// 5) 60-app.jsx からの呼び出し
const calls = [...APP.matchAll(/growthFx[A-Za-z]+\(/g)].map(m => m.index);
for (const at of calls) {
  const line = APP.slice(APP.lastIndexOf('\n', at) + 1, APP.indexOf('\n', at));
  const prev = APP.slice(Math.max(0, at - 200), at);
  if (!/typeof growthFx[A-Za-z]+ === 'function'/.test(line + prev)) ng(`60-app.jsx の呼び出しが typeof で守られていない: ${line.trim().slice(0, 80)}`);
}
if (calls.length < 5) ng(`60-app.jsx からの呼び出しが足りない(仲良し度・チケット・ブリーダーLv×3 で5か所。いま ${calls.length})`);
if ((APP.match(/<GrowthFxLayer /g) || []).length !== 1) ng('GrowthFxLayer は60-app.jsx に1つだけ置く');

if (errors.length) { console.log(`NG: 上がる値の演出 ${errors.length}件`); errors.forEach(e => console.log(`  - ${e}`)); process.exit(1); }
console.log('OK: 上がる値の演出(見た目だけ・遊びの最中は出さない・まとめて出す)');
