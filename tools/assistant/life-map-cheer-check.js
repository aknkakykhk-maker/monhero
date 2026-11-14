// 助手ライフの地図: モンヒロバトルの場所の窓に置いた「🥋 きょうの修行」の1行と「👀 修行を見る・📣 応援する・⚔ 対戦(β)」の列(シュギョウ2の口)を、本文から確かめる。
//   node tools/assistant/life-map-cheer-check.js
//   ① 口は typeof で確かめてから呼ぶ(口が無い・印 assistantMasmonCheer が偽で null のときは、行もボタンも出ない)
//   ② 置くのは place === 'battle' の行だけ。ボタンは3つとも 44px 以上・応援は canCheer が偽なら押せず理由を出す
//   ③ 対戦(β)のボタンは修行の列があるときはその列へ、無いときは今までどおり右の列(二重に出さない)
//   ④ 見る画面の入れ物 AssistantMasmonTrainWatchHost を地図の根元に1つ
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.resolve(__dirname, '..', '..', 'monster-hero/src/parts/56-assistant-life-map.jsx'), 'utf8');
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
check('① 口は typeof で確かめる', /typeof assistantMasmonTrainRowInfo === 'function' \? assistantMasmonTrainRowInfo\(id\) : null/.test(s) && /assistantMasmonTrainWatchOpen\(id\)/.test(s) && /assistantMasmonCheer\(id\)/.test(s));
check('② battle の行だけ', /let ti = null; if \(place === 'battle'\)/.test(s));
const acts = s.slice(s.indexOf('data-assistant-life-map-train-acts'), s.indexOf('data-assistant-life-map-cheer-why'));
check('② ボタンは 44px 以上・応援は canCheer が偽なら押せない', (acts.match(/min-h-\[44px\]/g) || []).length >= 2 && /disabled=\{!ti\.canCheer\}/.test(acts) && /data-assistant-life-map-cheer-why/.test(s));
check('③ 対戦(β)は修行の列が無いときだけ右の列', /\{place === 'battle' && !ti && battleBtn\}/.test(s) && (s.match(/\{battleBtn\}/g) || []).length === 1);
check('④ 見る画面の入れ物を地図の根元に1つ(+モンヒロバトルの選択画面の枠に1つ)', (s.match(/<AssistantMasmonTrainWatchHost\/>/g) || []).length === 2 && /function AssistantLifeBattleHall[\s\S]*?<AssistantMasmonTrainWatchHost\/>/.test(s));
console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
