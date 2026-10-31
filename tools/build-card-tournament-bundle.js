#!/usr/bin/env node
// MFバトルカード大会(2026-10-30): サーバの上の関数(supabase/functions/card-tournament-run)が試合を回すための、
// ゲームのルール本体の写し(game.js)を作る。手で写さない(ルールを直したら、次のビルドで写しも追従する)。
//   入れる物: カードの表(data/card-battle-cards.js)・ルール本体(82-card-battle-core)・戦術カード(82-card-tactics-core)・
//            登録デッキの戦い方(82-card-share-core)・大会の計算(82-card-tournament-core)・見返しのルールの版(93 の CARD_REPLAY_RULES)
//   どれも画面と保存を触らない部品(parts.json の pure)。サーバ(Deno)でそのまま動く
//
//   node tools/build-card-tournament-bundle.js           作り直す
//   node tools/build-card-tournament-bundle.js --check   いまの部品と合っているかだけ見る
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'monster-hero');
const OUT = path.join(ROOT, 'supabase', 'functions', 'card-tournament-run', 'game.js');
const PARTS = ['82-card-battle-core.jsx', '82-card-tactics-core.jsx', '82-card-share-core.jsx', '82-card-tournament-core.jsx'];
const EXPORTS = ['CARD_BATTLE_DATA', 'CARD_AI_HABITS', 'CARD_REPLAY_RULES', 'cardTourGroups', 'cardTourSchedule', 'cardTourStageDays', 'cardTourStandings',
  'cardTourFinalists', 'cardTourPlay', 'cardTourNormalizeRewards', 'cardTourRewardOf', 'cardTourHash', 'cardDeckProblems', 'cardCreateGame', 'cardApplyAction',
  'cardTourKoFirst', 'cardTourKoMatches', 'cardTourKoWinners', 'cardTourKoNextPairs', 'cardTourKoPlaces'];

const make = () => {
  const replay = fs.readFileSync(path.join(GAME, 'src', 'parts', '93-card-replay.jsx'), 'utf8');
  const m = replay.match(/^const CARD_REPLAY_RULES = (\d+);/m);
  if (!m) return { ok: false, reason: '93-card-replay.jsx に CARD_REPLAY_RULES が見つからない' };
  const body = [
    '// 自動で作った写し(tools/build-card-tournament-bundle.js)。手で直さない。直すのは monster-hero/src/parts の元の部品',
    `const CARD_REPLAY_RULES = ${m[1]};`,
    fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8'),
    ...PARTS.map((p) => `// ---- ${p} ----\n${fs.readFileSync(path.join(GAME, 'src', 'parts', p), 'utf8')}`),
    `export { ${EXPORTS.join(', ')} };`,
    '',
  ].join('\n;\n');
  return { ok: true, body };
};

const run = ({ check = false } = {}) => {
  const r = make();
  if (!r.ok) return r;
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (check) return cur === r.body ? { ok: true } : { ok: false, reason: '大会のサーバの関数のルールの写し(card-tournament-run/game.js)が古い' };
  if (cur === r.body) return { ok: true, changed: false, size: r.body.length };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, r.body);
  return { ok: true, changed: true, size: r.body.length };
};

module.exports = { run, OUT };
if (require.main === module) {
  const r = run({ check: process.argv.includes('--check') });
  if (!r.ok) { console.error(`NG: ${r.reason}`); process.exit(1); }
  console.log(r.changed ? `作り直しました(${r.size}文字)` : 'OK: 合っています');
}
