const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// どの画面(gameState)にもBGMが決まっていることを確かめる。
//
// 【なぜ道具にするか】
// 画面を1つ足したとき、BGMの対応表(BGM_STATE_MAP)へ載せるのを忘れると、
// その画面だけ無音になる。**例外も出ないし、見た目も壊れない**ので、
// 実際に遊んだ人が「BGMがない」と言うまで誰も気づけない。
//   ・2026-09-14 「モンヒロビートのこれまでの記録でBGMがない」
//   ・2026-09-21 「バトル選択画面でBGMがない」
// 同じ壊れ方を2回しているので、ここで機械的に押さえる。
//
// 見るのは1つだけ。「画面を足したら、鳴らす曲を決めるか、鳴らさないと決めるか、
// どちらかを必ず選んでいること」。どちらもしていない画面があれば落とす。
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const parts = fs.readdirSync(path.join(root, 'monster-hero/src/parts'))
  .filter(name => name.endsWith('.jsx'))
  .map(name => fs.readFileSync(path.join(root, 'monster-hero/src/parts', name), 'utf8'))
  .join('\n');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
// 名前の一覧を1つの定義から取り出す。検査へ画面名を書き写さない
const listOf = (declaration) => {
  const match = app.match(new RegExp(`const ${declaration} = (?:Object\\.freeze\\()?\\[([\\s\\S]*?)\\]`));
  return match ? [...match[1].matchAll(/'([A-Z][A-Z_0-9]*)'/g)].map(m => m[1]) : [];
};

// --- ① 実際に使われている画面(gameState)を集める ---
// where.js は資料や検査のコードからも拾うので、ここは本体の parts だけを見る
const screens = [...new Set([
  ...[...parts.matchAll(/setGameState\('([A-Z][A-Z_0-9]*)'\)/g)].map(m => m[1]),
  ...[...parts.matchAll(/gameState\s*===\s*'([A-Z][A-Z_0-9]*)'/g)].map(m => m[1]),
])].sort();
check('画面の一覧を取り出せた', screens.length > 30, `${screens.length}件`);

// --- ② BGMが決まる道を1つずつ取り出す ---
const mapStart = app.indexOf('const BGM_STATE_MAP = {');
const mapBody = app.slice(mapStart, app.indexOf('\n  };', mapStart));
const mapped = [...mapBody.matchAll(/([A-Z][A-Z_0-9]*)\s*:\s*'[a-zA-Z]+'/g)].map(m => m[1]);
const silent = listOf('BGM_SILENT_STATES');
const profile = listOf('PROFILE_BGM_STATES');
const runPhase = listOf('RUN_PHASE_STATES');
// HOMEと同じ曲を続ける画面、バトル本体は関数の中で名指ししている
const named = [...app.matchAll(/state === '([A-Z][A-Z_0-9]*)'/g)].map(m => m[1]);
check('対応表を読めた', mapped.length > 20 && silent.length > 0 && profile.length > 0 && runPhase.length > 0,
  `鳴らす ${mapped.length} / 鳴らさない ${silent.length} / プロフィール系 ${profile.length} / ラン中 ${runPhase.length}`);

// --- ③ どちらも選んでいない画面が無いこと ---
const decided = new Set([...mapped, ...silent, ...profile, ...runPhase, ...named]);
const undecided = screens.filter(s => !decided.has(s));
check('BGMを決めていない画面が無い', undecided.length === 0,
  undecided.length ? undecided.join(', ') : `${screens.length}件すべて決めてある`);

// --- ④ 同じ画面を「鳴らす」と「鳴らさない」の両方へ書いていないこと ---
const both = silent.filter(s => mapped.includes(s));
check('鳴らす画面と鳴らさない画面が重なっていない', both.length === 0, both.join(', ') || 'なし');

// --- ⑤ 「鳴らさない」の宣言が実装へつながっていること ---
// ここが外れると、リストに並べただけで何も起きない(無音のまま気づけない)
check('鳴らさない画面の宣言が実装へつながっている',
  app.includes('if (BGM_SILENT_STATES.includes(state)) return null;'));

// --- ⑥ 報告のあった2つが、ちゃんと鳴るようになっていること ---
// 直した画面がまた落ちたときに、ここで名前が出る
check('バトルの入口でBGMが鳴る', mapped.includes('BATTLE_SYSTEM_SELECT'));
check('モンヒロビートの記録でBGMが鳴る', mapped.includes('RHYTHM_HISTORY'));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
