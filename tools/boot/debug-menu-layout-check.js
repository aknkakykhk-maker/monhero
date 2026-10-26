// デバッグメニューの並び(2026-10-27 社長「デバッグモードがまたごちゃついてきてるから、使いやすく見やすく整備して」)を見張る。
//
//   node tools/boot/debug-menu-layout-check.js
//
// 見ること(ソースを読むだけ):
//   ・いちばん上のまとまりが「⭐ よく使う」で、社長がよく使う6つ(新モンスター確認・染色マスク編集・MFバトルカード・
//     モンヒロビート デバッグ・データを用意する・デバッグ戦)がそこにある
//   ・入口の目印(data-debug-*)が、メニューの中にちょうど1回ずつある(移すときに消したり二重にしたりしていない)
//   ・名前で絞り込む欄があり、開いた見出しを覚えるキーが保存データの一覧に載っている
//   ・試作の欄はいちばん下のまとまり
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'monster-hero/src/parts/31-debug-ui.jsx'), 'utf8');
const saveDoc = fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const start = app.indexOf("{gameState==='DEBUG_SETTINGS'&&(");
const end = app.indexOf("{gameState==='RAID_JACK'&&(", start);
const menu = start >= 0 && end > start ? app.slice(start, end) : '';
check('デバッグメニューの範囲を読めた', menu.length > 1000);

const groups = [...menu.matchAll(/<DebugMenuGroup id="([a-z-]+)"/g)].map((m) => m[1]);
check('いちばん上のまとまりは「よく使う」(pinned)', groups[0] === 'pinned', groups.join(','));
check('試作のまとまりはいちばん下', groups[groups.length - 1] === 'trials', groups.join(','));
check('まとまりの id が重ならない', new Set(groups).size === groups.length);

const pinnedStart = menu.indexOf('<DebugMenuGroup id="pinned"');
const pinned = menu.slice(pinnedStart, menu.indexOf('</DebugMenuGroup>', pinnedStart));
const PINNED = ['data-debug-monster-check', "DYE_MASK_POSITION_DEBUG", 'data-debug-card-battle', 'data-debug-rhythm-mode', 'data-debug-data-setup', 'data-debug-battle-setup'];
check('よく使う6つが「よく使う」にある', PINNED.every((k) => pinned.includes(k)), PINNED.filter((k) => !pinned.includes(k)).join(','));

const marks = [...new Set([...menu.matchAll(/\b(data-debug-[a-z0-9-]+)(?=[\s=>])/g)].map((m) => m[1]))]
  .filter((k) => !/^data-debug-(group|menu-search|trial)/.test(k));
const twice = marks.filter((k) => menu.split(new RegExp(`\\b${k}(?=[\\s=>])`)).length - 1 !== 1);
check('入口の目印はメニューの中に1回ずつ', marks.length >= 15 && twice.length === 0, twice.length ? twice.join(',') : `${marks.length}個`);
const MUST = ['data-debug-monster-check', 'data-debug-transcend', 'data-debug-battle-mode', 'data-debug-unlock-all-battle', 'data-debug-battle-setup',
  'data-debug-raid-jack', 'data-debug-card-battle', 'data-debug-species-challenge', 'data-debug-rpg-battle', 'data-debug-rhythm-mode',
  'data-debug-rhythm-demo', 'data-debug-story-list', 'data-debug-onboarding-preview', 'data-debug-data-setup', 'data-debug-screen-error',
  'data-debug-assistant-chat', 'data-debug-assistant-daily-lines'];
check('入口が消えていない', MUST.every((k) => marks.includes(k)), MUST.filter((k) => !marks.includes(k)).join(','));

check('名前で絞り込む欄がある', menu.includes('<DebugMenuSearch rootRef={debugMenuRootRef}/>') && menu.includes('ref={debugMenuRootRef}') && ui.includes('data-debug-menu-search'));
check('開いた見出しを覚えるキーが保存データの一覧に載っている', ui.includes("'mh_debug_menu_open_v1'") && saveDoc.includes('`mh_debug_menu_open_v1`'));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
