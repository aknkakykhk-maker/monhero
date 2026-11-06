#!/usr/bin/env node
// 保存データやランキングにそのまま書く「値」が、ソースから消えていないかを見る(錠: tools/boot/saved-value-lock.json)。
//
//   node tools/boot/saved-value-lock-check.js            … 確かめる(錠にある値が1つでも消えていたら NG)
//   node tools/boot/saved-value-lock-check.js --update   … いまある新しい値を錠へ足す(消えた値を錠から外すことはしない)
//
// 【なぜ要るか】2026-11-06 #4623(モンスターを「子」と呼ばない一括の置き換え)で、戦術カードの選択肢の値
// 「この子は攻撃しない」なども「このモンスターは攻撃しない」に書き換わった。この値は画面の文と同じ文字列だが、
// 保存(mh_card_tactics_v1)に書くカードの id そのもので、変わると組んだ戦術が働かなくなる(CLAUDE.md ⑦)。
// 文の置き換えはどれも通り、画面もふつうに動くので気づけなかった(#4627 で戻した)。
// 名前を変える・消すのが禁じられた値を錠に控え、変わったら止める。値を足すのは自由(--update で錠へ足す)。
//
// 【錠に控えるもの】
//   storageKeys        … 本体・データに書いてある保存キー(mh_*)。動的キーの接頭辞(mh_hs_ など)も含む
//   cardTacticIds      … MFバトルカードの戦術カードの id(「種類.段」。段は画面の文と同じ日本語)
//   playerMonsterNames … 味方モンスターの種名(ランキングの party に名前のまま送る。SAVE_DATA.md 7)
// どうしても外すときは、錠の JSON を手で直し、PR に理由と、古い値を読めるようにした所(読み替えなど)を書く。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const LOCK = path.join(__dirname, 'saved-value-lock.json');
const read = (rel) => fs.readFileSync(path.join(GAME, rel), 'utf8');

const collectors = {
  storageKeys() {
    const files = [
      ...fs.readdirSync(path.join(GAME, 'src/parts')).filter((f) => f.endsWith('.jsx')).map((f) => `src/parts/${f}`),
      ...fs.readdirSync(path.join(GAME, 'data')).filter((f) => f.endsWith('.js')).map((f) => `data/${f}`),
    ];
    const out = new Set();
    for (const rel of files) for (const m of read(rel).matchAll(/['"`](mh_[A-Za-z0-9_]+)/g)) out.add(m[1]);
    return out;
  },
  cardTacticIds() {
    const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
    vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n${read('src/parts/82-card-tactics-core.jsx')}\n;\nthis.CARDS = CARD_TACTIC_CARDS;`, ctx);
    return new Set(ctx.CARDS.map((c) => c.id));
  },
  playerMonsterNames() {
    const src = read('data/ally-monsters.js');
    const out = new Set();
    for (const m of src.matchAll(/^\s+[A-Za-z0-9_]+:\s*\{\s*id:\s*'[^']+',\s*name:\s*"([^"]+)"/gm)) out.add(m[1]);
    return out;
  },
};

const now = Object.fromEntries(Object.entries(collectors).map(([k, f]) => [k, f()]));
let lock = {};
try { lock = JSON.parse(fs.readFileSync(LOCK, 'utf8')); } catch { lock = {}; }

if (process.argv.includes('--update')) {
  const doc = { _説明: '保存データ・ランキングにそのまま書く値の錠(tools/boot/saved-value-lock-check.js)。足すのは --update、外すのは手で(理由を PR に書く)' };
  for (const k of Object.keys(collectors)) {
    const old = Array.isArray(lock[k]) ? lock[k] : [];
    doc[k] = [...new Set([...old, ...now[k]])].sort();
    console.log(`${k}: ${old.length} → ${doc[k].length}`);
  }
  fs.writeFileSync(LOCK, JSON.stringify(doc, null, 1) + '\n');
  process.exit(0);
}

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIN = { storageKeys: 80, cardTacticIds: 100, playerMonsterNames: 15 };
for (const k of Object.keys(collectors)) {
  const locked = Array.isArray(lock[k]) ? lock[k] : [];
  check(`${k}: 錠と、いまの値を拾えている`, locked.length >= MIN[k] && now[k].size >= MIN[k], `錠 ${locked.length} / いま ${now[k].size}`);
  const gone = locked.filter((v) => !now[k].has(v));
  check(`${k}: 錠にある値がどれも残っている(名前を変えた・消した値が無い)`, gone.length === 0,
    gone.length ? `消えた: ${gone.slice(0, 12).join(' / ')}${gone.length > 12 ? ` ほか${gone.length - 12}` : ''}(保存データが読めなくなる。戻すか、古い値を読み替える)` : `${locked.length}個`);
  const added = [...now[k]].filter((v) => !locked.includes(v));
  if (added.length) console.log(`  (お知らせ) ${k} に錠へまだ載っていない値が ${added.length} 個: ${added.slice(0, 6).join(' / ')} … node tools/boot/saved-value-lock-check.js --update で足す`);
}
console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
