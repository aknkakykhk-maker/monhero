#!/usr/bin/env node
// MFバトルカード: 公開の印が立つまで、新しい助手(ソラシド)が対戦相手に出ないことを確かめる(2026-10-27・カード部ナガメくん)。
//
//   node tools/card/card-foe-release-check.js
//
//   決まり(ソランド部長): 印(RELEASE_FLAGS.assistantSorashido)が立つ前は、カードの相手えらび・マルチ・観戦・記録・曲の並びのどこにも出ない。
//   カードだけの別の一覧は作らず、助手の一覧と同じ assistantReleased(data/assistants.js)で見る(82 の cardFoeReleased)。デバッグからも出さない。
//   助手の一覧(ASSISTANTS)にソラシドがいないときは、仮のソラシドを一覧の後ろに足して確かめる。
//   ① 印が偽: cardFoeReleased が偽・いまの6人は真
//   ② 印が偽: 相手えらび(ふだん・デバッグ)・見本の相手・曲の並びの助手に出ない。顔ぶれはいまの6人のまま
//   ③ 印が偽: 曲の並びの保存の形が、いまの6人分のまま(既定・壊れた値・前の保存)。前に保存したソラシドの並びは消さない
//   ④ 印が真: どこにも出る。曲の並びの既定にも入る
//   ⑤ ソラシドが、打ち方・デッキ・台詞・デッキ名・対戦開始の言葉・マルチの結果の台詞の表を全部持っている(仮の値)
//   ⑥ 84 で助手の一覧(allAssistants)から相手を選ぶ所が、全部 cardFoeReleased を通っている(足し忘れの見張り)
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const P = (f) => path.join(GAME, 'src', 'parts', f);
const read = (p) => fs.readFileSync(p, 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const NEW = 'sorashido';
const NOW6 = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko'];
const flags = { assistantAtsu: true, assistantKyuko: true, assistantSorashido: false };
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date, RELEASE_FLAGS: flags });
vm.runInContext(`${read(path.join(GAME, 'data', 'assistants.js'))}\n;\n${read(path.join(GAME, 'data', 'card-battle-cards.js'))}\n;\n${read(P('82-card-battle-core.jsx'))}\n;\n`
  + 'this.E = { ASSISTANTS, assistantUnlockedBy, cardFoeReleased, CARD_AI_HABITS, CARD_AI_TUNE, CARD_AI_DECKS, CARD_AI_FAVORITE, CARD_CPU_PLAYLIST_DEFAULT, cardNormalizeCpuPlaylist };', ctx);
const E = ctx.E;
const setFlag = (v) => { flags.assistantSorashido = v; };

// 84 の式をそのまま取り出して、仮のソラシドを足した一覧で動かす
const src84 = read(P('84-screen-card-battle.jsx'));
const grab = (re, what) => { const m = src84.match(re); if (!m) { check(`84 の${what}の式が見つかる`, false); return null; } return m[1]; };
const foesExpr = grab(/const foes = (.+);\n/, '相手えらび');
const demoExpr = grab(/\{(allAssistants\.filter\(\(x\) => CARD_AI_HABITS\[x\.id\][^}]*?\))\.map\(\(x\) => <option key=\{x\.id\} value=\{x\.id\}>見本の相手/, '見本の相手');
const plExpr = grab(/const plWhoList = (.+);\n/, '曲の並びの助手');
const copyExpr = grab(/plSave\(Object\.fromEntries\((Object\.keys\(CARD_CPU_PLAYLIST_DEFAULT\)[^\n]*?)\.map\(\(who\) => \[who, list\]\)\)\)/, '並びを全員にうつす');
const run = (expr, vars) => {
  // 助手の一覧にソラシドがいなければ(クラフト部の枝が入る前)、仮のソラシドを後ろに足す
  const all = E.ASSISTANTS.some((a) => a.id === NEW) ? [...E.ASSISTANTS] : [...E.ASSISTANTS, { id: NEW, name: 'ソラシド' }];
  const sb = vm.createContext({ ...vars, allAssistants: all, cardFoeReleased: E.cardFoeReleased, CARD_AI_HABITS: E.CARD_AI_HABITS, CARD_CPU_PLAYLIST_DEFAULT: E.CARD_CPU_PLAYLIST_DEFAULT,
    assistantsUnlockedFrom: (seen) => all.filter((a) => E.assistantUnlockedBy(a.id, seen)) });
  return vm.runInContext(expr, sb);
};
const ids = (list) => list.map((x) => (typeof x === 'string' ? x : x.id));
// 6人がみんな選べる人(あつの加入のお話を見た)
const SEEN = ['atsu_join_2026_10_22'];

// ① ② ③ 印が偽
setFlag(false);
check('① 印が偽: ソラシドは公開前', E.cardFoeReleased(NEW) === false);
check('① 印が偽: いまの6人は公開のまま', NOW6.every((w) => E.cardFoeReleased(w) === true));
check('① 打ち方の表は、ソラシドを除くといまの6人', JSON.stringify(Object.keys(E.CARD_AI_HABITS).filter((w) => w !== NEW).sort()) === JSON.stringify([...NOW6].sort()));
if (foesExpr) {
  for (const debug of [false, true]) {
    const got = ids(run(foesExpr, { debug, seenStoryIds: SEEN }));
    check(`② 印が偽: 相手えらび(${debug ? 'デバッグ' : 'ふだん'})にソラシドが出ない・6人のまま`, !got.includes(NEW) && JSON.stringify(got.slice().sort()) === JSON.stringify([...NOW6].sort()), got.join(','));
  }
  // お話を見ていない人は、あつが出ない(いまの決まりのまま)
  const fresh = ids(run(foesExpr, { debug: false, seenStoryIds: [] }));
  check('② 印が偽: あつのお話を見ていない人は、いまどおり5人', !fresh.includes(NEW) && !fresh.includes('atsu') && fresh.length === 5, fresh.join(','));
}
if (demoExpr) { const got = ids(run(demoExpr, {})); check('② 印が偽: 見本の相手にソラシドが出ない', !got.includes(NEW) && got.length === 6, got.join(',')); }
if (plExpr) {
  const got = ids(run(plExpr, { foes: [] }));
  check('② 印が偽: 曲の並びの助手(相手が読めないとき)にソラシドが出ない', !got.includes(NEW) && got.length === 6, got.join(','));
}
if (copyExpr) { const got = run(copyExpr, {}); check('② 印が偽: 並びを全員にうつすとき、ソラシドに書かない', !got.includes(NEW) && got.length === 6, got.join(',')); }
const PL_NOW = { v: 1, assistants: { mua: ['melo_toriko'], kiki: ['eiki_boss'], momosuke: ['melo_crossing_field'], kyuko: ['melo_toward_the_stars_short'], dra: ['melo_mou_hitotsu_no_sekai_e'], atsu: ['melo_against_my_own_shadow'] } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
[undefined, null, 'x', 5, [], { v: 1 }, { v: 1, assistants: 'x' }].forEach((bad) => {
  check(`③ 印が偽: 曲の並びの既定がいまの6人分のまま(${JSON.stringify(bad)})`, same(E.cardNormalizeCpuPlaylist(bad), PL_NOW));
});
const mine = { v: 1, assistants: { mua: ['melo_crossing_field', 'eiki_boss'], atsu: ['melo_toriko'] } };
const mineWant = { v: 1, assistants: { ...PL_NOW.assistants, mua: ['melo_crossing_field', 'eiki_boss'], atsu: ['melo_toriko'] } };
check('③ 印が偽: 前に保存した6人の並びは、いまどおり読める', same(E.cardNormalizeCpuPlaylist(mine), mineWant));
const kept = E.cardNormalizeCpuPlaylist({ v: 1, assistants: { [NEW]: ['eiki_boss'] } });
check('③ 印が偽: 前に保存したソラシドの並びは消さない(⑦)', same(kept.assistants[NEW], ['eiki_boss']));

// ④ 印が真
setFlag(true);
check('④ 印が真: ソラシドは公開', E.cardFoeReleased(NEW) === true);
if (foesExpr) {
  for (const debug of [false, true]) {
    const got = ids(run(foesExpr, { debug, seenStoryIds: SEEN }));
    check(`④ 印が真: 相手えらび(${debug ? 'デバッグ' : 'ふだん'})にソラシドが出る`, got.includes(NEW) && got.length === 7, got.join(','));
  }
}
if (demoExpr) check('④ 印が真: 見本の相手にソラシドが出る', ids(run(demoExpr, {})).includes(NEW));
if (copyExpr) check('④ 印が真: 並びを全員にうつすとき、ソラシドにも書く', run(copyExpr, {}).includes(NEW));
const pl7 = E.cardNormalizeCpuPlaylist(undefined);
check('④ 印が真: 曲の並びの既定にソラシドが入る', Array.isArray(pl7.assistants[NEW]) && pl7.assistants[NEW].length >= 1 && NOW6.every((w) => same(pl7.assistants[w], PL_NOW.assistants[w])));
setFlag(false);

// ⑤ 表を全部持っている(仮の値)
[['CARD_AI_HABITS', E.CARD_AI_HABITS], ['CARD_AI_TUNE', E.CARD_AI_TUNE], ['CARD_AI_DECKS', E.CARD_AI_DECKS], ['CARD_AI_FAVORITE', E.CARD_AI_FAVORITE], ['CARD_CPU_PLAYLIST_DEFAULT', E.CARD_CPU_PLAYLIST_DEFAULT]]
  .forEach(([name, t]) => check(`⑤ 82 の ${name} にソラシドがある`, t[NEW] != null));
check('⑤ ソラシドの既定の曲は Monster Hero(2026-10-27 社長の答え)', same(E.CARD_CPU_PLAYLIST_DEFAULT[NEW], ['monster_hero_theme']));
const habitKeys = Object.keys(E.CARD_AI_HABITS.mua).sort();
check('⑤ ソラシドの打ち方のくせが、ほかの助手と同じ項目', same(Object.keys(E.CARD_AI_HABITS[NEW]).sort(), habitKeys));
// 83・91 は画面の部品と一緒に書かれているので、表の中身の文字で確かめる
const block = (file, name) => { const s = read(P(file)); const i = s.indexOf(`const ${name} = Object.freeze({`); if (i < 0) return ''; return s.slice(i, s.indexOf('\n});', i)); };
const keysIn = (txt, who) => { const i = txt.indexOf(`\n  ${who}: {`); if (i < 0) return []; const j = txt.indexOf('\n  },', i); return [...txt.slice(i, j < 0 ? undefined : j).matchAll(/\n {4}(\w+):/g)].map((m) => m[1]).sort(); };
const lines = block('83-card-battle-lines.jsx', 'CARD_BATTLE_LINES');
check('⑤ 83 の台詞(CARD_BATTLE_LINES)で、ソラシドがあつと同じ場面を全部持っている', keysIn(lines, NEW).length > 0 && same(keysIn(lines, NEW), keysIn(lines, 'atsu')), keysIn(lines, NEW).join(','));
check('⑤ 83 のデッキ名のしめ(CARD_DECK_NAME_TAILS)にソラシドがある', /\n {2}sorashido: \[/.test(block('83-card-battle-vs.jsx', 'CARD_DECK_NAME_TAILS')));
const vs = block('83-card-battle-vs.jsx', 'CARD_VS_LINES');
check('⑤ 83 の対戦開始の言葉で、ソラシドが5つの強さを全部持っている', same(keysIn(vs, NEW), ['easy', 'expert', 'hard', 'master', 'normal']), keysIn(vs, NEW).join(','));
const res = block('91-card-battle-multi.jsx', 'CARD_PVP_RESULT_LINES');
check('⑤ 91 のマルチの結果の台詞で、ソラシドが勝ち・負け・抜けたを持っている', same(keysIn(res, NEW), ['left', 'lose', 'win']), keysIn(res, NEW).join(','));

// ⑥ 足し忘れの見張り: 84 で allAssistants から相手を選ぶ式(.filter)は、全部 cardFoeReleased を通す
const bad84 = src84.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /allAssistants\.filter\(/.test(l) && !/cardFoeReleased/.test(l));
check('⑥ 84 で助手の一覧から相手を選ぶ所が、全部 cardFoeReleased を通っている', !bad84.length, bad84.map(([n]) => `${n}行`).join('・'));
// 91 の結果の台詞の助手も同じ
check('⑥ 91 のマルチの結果で、自分の助手を引く所が cardFoeReleased を通っている', /ASSISTANTS\.find\(\(x\) => x\.id === assistant\.id && cardFoeReleased\(x\.id\)\)/.test(read(P('91-card-battle-multi.jsx'))));

if (failed) { console.log(`✗ 公開前の助手の出し入れ: ${failed} 件`); process.exit(1); }
console.log('✓ 公開前の助手の出し入れ: すべて OK');
