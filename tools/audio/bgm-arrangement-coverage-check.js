// 「どの場面のBGMも設定から選べる」ことを見張る。
//
//   node tools/audio/bgm-arrangement-coverage-check.js
//
// 2026-09-07・ユーザー要望「せっかくだから全て場面のBGMアレンジをできるようにして」。
//
// 画面ごとの曲を決めているのは bgmKeyForState。ここが
// **設定(bgmArrangement)を通さずに曲IDを直接返している**と、その場面だけ変えられない。
// 実際、準備・強化フェーズ(勇者モン選択)／WAVE後のリザルト／敗北の3つがそうだった。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- bgmKeyForState が設定を通さず返しているものが無いか ----
const from = app.indexOf('const bgmKeyForState =');
const to = app.indexOf('  // BGM: 画面遷移に応じて自動切替', from);
const body = from >= 0 && to > from ? app.slice(from, to) : '';
check('bgmKeyForState を切り出せる', body.length > 0);
// 曲そのものではない内部の合図はここでは対象外
const INTERNAL = new Set(['__keep_battle_bgm__', '__silence_bgm__']);
const rawReturns = [...body.matchAll(/return '([a-zA-Z_][A-Za-z0-9_]*)';/g)].map(m => m[1]).filter(id => !INTERNAL.has(id));
check('設定を通さずに曲を返している場面が無い', rawReturns.length === 0, rawReturns.join(', ') || 'なし');

// ---- 設定の一覧に、使っている場面がすべてある ----
const used = [...new Set([...app.matchAll(/bgmArrangement\.([A-Za-z0-9_]+)/g)].map(m => m[1]))];
const defaults = settings.slice(settings.indexOf('const DEFAULT_BGM_ARRANGEMENT'), settings.indexOf('\n', settings.indexOf('const DEFAULT_BGM_ARRANGEMENT')));
const missing = used.filter(scene => !new RegExp(`\\b${scene}\\s*:`).test(defaults));
check('使っている場面はすべて既定値を持っている', missing.length === 0, missing.join(', ') || 'なし');

// ---- 画面の選択欄にも並んでいる ----
const categories = app.slice(app.indexOf("{id:'basic',label:'基本'"), app.indexOf("];const battleModes=BGM_BATTLE_MODE_TABS;"));
check('BGMアレンジの画面を切り出せる', categories.length > 0);
// モード別のバトル曲は別のタブ(BGM_BATTLE_MODE_TABS)にあるので、ここでは除く
const BATTLE_TAB_SCENES = /^(battle|dullahan|boss|quick|pro|extreme|species)/;
// ON/OFFの切り替え(ファンファーレを鳴らすか等)は曲を選ぶ項目ではないので別扱い。
// 実装側の BGM_TOGGLE_SCENES をそのまま読む(名前を書き写さない)
const toggleLine = settings.slice(settings.indexOf('const BGM_TOGGLE_SCENES'), settings.indexOf('\n', settings.indexOf('const BGM_TOGGLE_SCENES')));
const toggles = [...toggleLine.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
check('ON/OFFの項目を実装から読める', toggles.length > 0, toggles.join(', '));
const listed = [...categories.matchAll(/\['([A-Za-z0-9_]+)',/g)].map(m => m[1]);
const notListed = used.filter(scene => !listed.includes(scene) && !BATTLE_TAB_SCENES.test(scene) && !toggles.includes(scene));
check('選べる場面が選択欄にすべて並んでいる', notListed.length === 0, notListed.join(', ') || 'なし');

// ---- 今回足した3つは、鳴る曲が今までと同じ ----
for (const [scene, track] of [['enhance', 'original_enhance'], ['result', 'original_result'], ['gameOver', 'original_game_over']]) {
  check(`${scene} の既定値は今まで鳴っていた曲のまま`,
    new RegExp(`${scene}:'${track}'`).test(defaults), track);
}
// 既定値が指す曲は、旧来の呼び名(legacyKey)と結びついた実在の曲であること
for (const [track, legacy] of [['original_enhance', 'enhance'], ['original_result', 'result'], ['original_game_over', 'gameOver']]) {
  check(`${track} は旧来の「${legacy}」と同じ曲`,
    new RegExp(`id:'${track}'[^}]*legacyKey:'${legacy}'`).test(settings));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
