#!/usr/bin/env node
// 試合の画面は1つの部品 MsaMatchView で並べる(段3b・r1119-070 社長の選択 ①実況1行 ②道具の段の形をそろえる)を見張る。2026-11-21 開発部
//   node tools/battle/match-view-check.js     … 画面は開かない(1秒未満)
//   ① モンサクの大会の試合(MonsucArena)と助手マスモン対戦βの観戦が、どちらも <MsaMatchView で描く
//   ② 並べ方の CSS は .msa.msa-mv の1か所。モンサクの古い入れ物(.msc-wrap.msa)と、βの観戦の段の別の並べ方([data-ambb-watch] の格子・ambb-stagewrap)が残っていない
//   ③ 試合の画面で古い札(AmbwPanel)・古い場(ambw-ring)を使っていない
//   ④ βの実況は1行(数行の記録 ambw-log を出さない)・助手の「なぜ」は1行の下の吹き出し(why)・道具の段は部品の tools(丸いボタンの並び)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => path.join(ROOT, 'monster-hero', 'src', 'parts', f);
const ARENA = fs.readFileSync(P('56-monhero-success-arena.jsx'), 'utf8');
const BETA = fs.readFileSync(P('56-assistant-masmon-battle-beta.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 関数の本体だけを取り出す(次の行頭の function まで)
const bodyOf = (src, name) => { const a = src.indexOf(`function ${name}(`); if (a < 0) return ''; const b = src.indexOf('\nfunction ', a + 10); return src.slice(a, b < 0 ? undefined : b); };

check('① 部品 MsaMatchView がある', /function MsaMatchView\(/.test(ARENA));
const arena = bodyOf(ARENA, 'MonsucArena');
check('① モンサクの大会の試合(MonsucArena)は MsaMatchView で描く', /<MsaMatchView[\s>]/.test(arena) && !/className="msc-wrap msa"/.test(arena));
// βの観戦は AssistantMasmonBattleBeta の中の data-ambb-watch の段
const watchAt = BETA.indexOf('<div data-ambb-watch');
const watch = watchAt >= 0 ? BETA.slice(watchAt, BETA.indexOf('\n  const back = phase', watchAt)) : '';
check('① 助手マスモン対戦βの観戦は MsaMatchView で描く', watch && /<MsaMatchView[\s>]/.test(watch));

const mvCss = (ARENA.match(/\.msa\.msa-mv/g) || []).length;
check('② 並べ方の CSS は .msa.msa-mv の所(モンサクの古い入れ物 .msc-wrap.msa が無い)', mvCss >= 10 && !/\.msc-wrap\.msa\b/.test(ARENA), `msa-mv ${mvCss} 行`);
check('② βに観戦の段の別の並べ方が残っていない([data-ambb-watch] の格子・ambb-stagewrap)', !/\[data-ambb-watch\]\s*>(?!\.msa-mv\{)|\[data-ambb-watch\]\{[^}]*grid/.test(BETA) && !/ambb-stagewrap/.test(BETA));

check('③ 試合の画面で古い札 AmbwPanel・古い場 ambw-ring を使わない', !/<AmbwPanel/.test(arena) && !/<AmbwPanel/.test(watch) && !/ambw-ring/.test(watch));

check('④ βの実況は1行(数行の記録 ambw-log を出さない)', !/ambw-log/.test(watch) && /\bsay=\{/.test(watch));
check('④ βの助手の「なぜ」は1行の下の吹き出し(why)', /\bwhy=\{/.test(watch) && /ambwWhyOf\(/.test(watch));
check('④ βの道具の段は部品の tools(丸いボタンの並び)・古い ambw-ctl を観戦で使わない', /\btools=\{[\s\S]{0,400}data-ambb-pause/.test(watch) && !/className="ambw-ctl">\s*\n?\s*<button[^\n]*data-ambb-pause/.test(watch));

console.log(failed ? `NG ${failed}件` : 'すべてOK');
process.exit(failed ? 1 : 0);
