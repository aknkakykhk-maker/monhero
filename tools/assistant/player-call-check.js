#!/usr/bin/env node
// 助手がプレイヤーを呼ぶ呼び方を確かめる(2026-11-07 社長「ブリーダーとか呼び方がおかしい。こういうのもちゃんと整理が必要だね」)。
// 決まりの一覧: docs/rules/CALL_NAMES.md
//   ① 助手どうし・助手ライフの台本(ASSISTANT_PEER_TALKS・EVENTS・QUARRELS・TRIO_TALKS・REACTIONS・ASSISTANT_PEER_REWRITES・ASSISTANT_LIFE_TALKS)と
//      台本のテキスト(docs/progress/assistant-peer/lines/*.txt)に、プレイヤーへの「ブリーダー」「ブリーダーさん」が直に無い(必ず {name})
//      「ブリーダーLv」「ブリーダーP」「ブリーダー経験値」「ブリーダーの教え」「ほかのブリーダー」など役目・物の名前はよい
//   ② 表示のときに {name} が、話している助手のいまの呼び方に置きかわる(呼び方が渡される前は「あなた」)。穴が残らない
//   ③ AI 版の掛け合いの決まり(supabase/functions/assistant-chat/core.js)も {name} で書かせる
//   ④ モンヒロビートの助手とのセッションの台詞(33-rhythm-assistant-session-lines.jsx)も同じ(マモリ・2026-11-07 から必ず止める)
//   node tools/assistant/player-call-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// プレイヤーを指す「ブリーダー(さん)」。役目・物の名前と「ほかのブリーダー」は外す
const DIRECT = /(?<!ほかの|他の|レジェンド)ブリーダー(さん)?(?!Lv|P|ランク|ポイント|レベル|経験|の教え|アイコン|名|の名前|ID|たち|さんたち)/;

// ① データ
const src = fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistants.js'), 'utf8');
const ctx = vm.createContext({ window: {}, console });
const D = vm.runInContext(`${src}\n;({ T: ASSISTANT_PEER_TALKS, E: ASSISTANT_PEER_EVENTS, Q: ASSISTANT_PEER_QUARRELS, TR: ASSISTANT_PEER_TRIO_TALKS, R: ASSISTANT_PEER_REACTIONS,
  RW: ASSISTANT_PEER_REWRITES, RR: ASSISTANT_PEER_REACTION_REWRITES, L: ASSISTANT_LIFE_TALKS })`, ctx);
const rows = [];
const addLines = (where, arr) => { for (const l of arr || []) if (l && typeof l.t === 'string') rows.push({ where, who: l.who, t: l.t }); };
for (const t of [...D.T, ...D.E, ...D.Q, ...D.TR, ...D.L]) {
  addLines(t.id, t.lines); addLines(t.id, t.makeup); addLines(t.id, t.distance);
  for (const c of t.choice || []) addLines(t.id, c.reply);
}
for (const [id, x] of Object.entries(D.RW)) { addLines(`表 ${id}`, x.lines); addLines(`表 ${id}`, x.makeup); addLines(`表 ${id}`, x.distance); for (const r of Object.values(x.reply || {})) addLines(`表 ${id}`, r); }
for (const R of [D.R, D.RR]) for (const [who, r] of Object.entries(R)) for (const [k, v] of Object.entries(r)) rows.push({ where: `ひとこと ${who}-${k}`, who, t: v.t });
const bad = rows.filter(r => DIRECT.test(r.t));
check('① 助手どうし・助手ライフの台本に、プレイヤーへの「ブリーダー」が直に無い({name} で書く)', bad.length === 0, bad.slice(0, 3).map(r => `${r.where}「${r.t}」`).join(' / ') || `${rows.length}行`);

// ① テキスト
const linesDir = path.join(root, 'docs', 'progress', 'assistant-peer', 'lines');
const txtBad = [];
for (const f of fs.readdirSync(linesDir).filter(f => f.endsWith('.txt'))) {
  fs.readFileSync(path.join(linesDir, f), 'utf8').split('\n').forEach((l, i) => {
    if (l.startsWith('#') || !l.includes('|')) return;
    if (DIRECT.test(l.slice(l.indexOf('|')))) txtBad.push(`${f}:${i + 1}`);
  });
}
check('① 台本のテキスト(lines/*.txt)にも、プレイヤーへの「ブリーダー」が直に無い', txtBad.length === 0, txtBad.slice(0, 5).join(', '));

// ② 表示のときの置きかえ
{
  const babel = require('@babel/core');
  const flags = { assistantPeer: true, assistantLife: true };
  const c2 = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity, window: {},
    React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f }, storeGet: async (k, d) => d, storeSet: () => {}, RELEASE_FLAGS: flags });
  vm.runInContext(src, c2);
  vm.runInContext('var assistantPeerDayKey = () => "2026-11-07"; var jstDayKey4 = () => "2026-11-07"; var assistantById = (id) => ASSISTANTS.find(a => a.id === id);', c2);
  const code = babel.transformSync(fs.readFileSync(path.join(root, 'monster-hero', 'src', 'parts', '56-assistant-peer.jsx'), 'utf8'), { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code;
  vm.runInContext(code, c2);
  const lineText = vm.runInContext('assistantPeerLineText', c2);
  const talk = { id: 'x', pair: ['kiki', 'mua'], lines: [] };
  const before = lineText({ who: 'kiki', t: '{name}は、どう思いますか？' }, talk);
  check('② 呼び方が渡される前は「あなた」', before === 'あなたは、どう思いますか？', before);
  vm.runInContext("assistantPeerSetPlayerCaller((id) => ({ kiki: 'テストさん', mua: 'テストちん' })[id] || '')", c2);
  const k = lineText({ who: 'kiki', t: '{name}は、どう思いますか？' }, talk);
  const m = lineText({ who: 'mua', t: '{name}も一緒に行こ！' }, talk);
  check('② {name} は、話している助手の呼び方になる(ききとみゅあで違う)', k === 'テストさんは、どう思いますか？' && m === 'テストちんも一緒に行こ！', `${k} / ${m}`);
  const gen = lineText({ who: 'mua', t: 'ブリーダーも一緒に行こ！' }, { ...talk, gen: true });
  check('② 前に保存した AI 版の掛け合いの「ブリーダー」も、表示のときに呼び方へ直す', gen === 'テストちんも一緒に行こ！', gen);
  const left = rows.filter(r => r.who && /\{name\}/.test(r.t)).map(r => lineText({ who: r.who, t: r.t }, { pair: [r.who, r.who === 'mua' ? 'kiki' : 'mua'], lines: [] })).filter(t => /\{name\}/.test(t));
  check('② 台本の {name} が全部置きかわる', left.length === 0, left.slice(0, 2).join(' / ') || `${rows.filter(r => /\{name\}/.test(r.t)).length}行`);
}

// ③ AI 版
{
  const core = fs.readFileSync(path.join(root, 'supabase', 'functions', 'assistant-chat', 'core.js'), 'utf8');
  const rules = (core.match(/export const PEER_RULES_TEXT = \[[\s\S]*?\]\.join/) || [''])[0];
  check('③ AI 版の掛け合いの決まりは、プレイヤーを {name} で書かせる(「ブリーダー」と書かせない)', /\{name\} と書く/.test(rules) && !/「ブリーダー」と書き/.test(rules));
  check('③ AI 版の返事の「ブリーダー(さん)」は {name} に直してから受け取る', /replace\(\/ブリーダー\(さん\)\?/.test(core) && /\\\{c\\\}\|\\\{name\\\}/.test(core));
}

// ④ モンヒロビートの助手とのセッションの台詞(マモリ)
{
  const f = path.join(root, 'monster-hero', 'src', 'parts', '33-rhythm-assistant-session-lines.jsx');
  if (fs.existsSync(f)) {
    const hits = fs.readFileSync(f, 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*\/\//.test(l) && DIRECT.test(l));
    // 2026-11-07 マモリが {name} に直したので、必ず止める
    check('④ 助手とのセッションの台詞にも、プレイヤーへの「ブリーダー」が直に無い', hits.length === 0, hits.slice(0, 3).map(([n]) => `${n}行`).join(', '));
  }
}

console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
