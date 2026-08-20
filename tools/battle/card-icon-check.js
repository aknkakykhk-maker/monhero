// カードのアイコンが「画像」と「絵文字」に正しく振り分けられているかを確認する。
//
// カードやアイテムの icon 欄には、絵文字1文字と画像が混在している。
// 2026年8月に画像を base64 の埋め込みから images/ 以下のPNGファイルへ移したとき、
// 判定が「data: で始まるかどうか」のままだったため、ブリーダーカード・ブリーダーの教えの
// アイコンが 'images/breeder-icons/oryo.png?v=…' という文字列のまま画面に表示された。
// 同じ取りこぼしを二度としないよう、実データを全部通して確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT, loadDyeModule } = require('../harness');

const web = path.join(REPO_ROOT, 'monster-hero');
const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8');

const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('data/images/images-ally.js'),
  read('data/ally-monsters.js'),
  read('data/breeder.js'),
  read('data/skills.js'),
  'globalThis.__x = { TEACHING_CARDS, BREEDER_MARKET_ITEMS, CADMIUM_TIERS, BASE_ATK_EVOLUTION, GUARD_EVOLUTION, RANGE_EVOLUTION };',
].join('\n'), ctx);
const { TEACHING_CARDS, BREEDER_MARKET_ITEMS, CADMIUM_TIERS, BASE_ATK_EVOLUTION, GUARD_EVOLUTION, RANGE_EVOLUTION } = ctx.__x;

const { isImageIconValue, cardIconNode } = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

check('アイコンの判定関数がある', typeof isImageIconValue === 'function' && typeof cardIconNode === 'function');

// icon 欄を持つ実データを集める
const entries = [];
const collect = (label, list) => {
  for (const item of list || []) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.icon !== 'string' || !item.icon) continue;
    entries.push({ label: `${label}:${item.id || item.name || '?'}`, icon: item.icon });
  }
};
collect('ブリーダーの教え', Object.values(TEACHING_CARDS || {}));
collect('マーケット', BREEDER_MARKET_ITEMS);
collect('カドミウム', CADMIUM_TIERS);
collect('通常攻撃', BASE_ATK_EVOLUTION);
collect('ガード', GUARD_EVOLUTION);
collect('距離技', RANGE_EVOLUTION);

check('icon欄を持つデータが集まっている', entries.length > 0, `${entries.length}件`);

// 画像のパス(images/... または data:)は必ず<img>になること
const asText = entries.filter(e => /^(images\/|data:|https?:\/\/)/.test(e.icon) && typeof cardIconNode(e.icon, 24) !== 'object');
check('画像のアイコンが文字として描画されない', asText.length === 0,
  asText.slice(0, 5).map(e => `${e.label} → ${e.icon.slice(0, 48)}`).join(' / '));

// 絵文字はそのまま文字として返ること(<img>にしてしまうと絵文字が消える)
const emojiEntries = entries.filter(e => !/^(images\/|data:|https?:\/\/)/.test(e.icon));
const asImage = emojiEntries.filter(e => typeof cardIconNode(e.icon, 24) === 'object');
check('絵文字のアイコンが画像として扱われない', asImage.length === 0,
  asImage.slice(0, 5).map(e => `${e.label} → ${e.icon}`).join(' / '));
console.log(`   (画像 ${entries.length - emojiEntries.length}件 / 絵文字 ${emojiEntries.length}件)`);

// icon を絵文字前提でそのまま描いている箇所が残っていないか(素通しは文字化けの元)
const source = read('src/game-system.jsx');
// src={...} のような属性の中は<img>なので対象外。JSXの本文に素で置いてある箇所だけを見る
const raw = [...source.matchAll(/(?<!=)\{\s*([A-Za-z_$][\w$]*(?:\?\.|\.)icon)\s*\}/g)].map(m => m[1]);
check('iconをそのまま描いている箇所が残っていない', raw.length === 0,
  `${[...new Set(raw)].join(', ')} — cardIconNode() を通すこと`);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
