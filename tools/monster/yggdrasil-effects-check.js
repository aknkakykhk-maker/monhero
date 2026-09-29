#!/usr/bin/env node
// ユグドラシル種(ユグドラシル・メルホイップ)の「効き目」を見張る(2026-09-29 ユーザー指示)。
//
//   node tools/monster/yggdrasil-effects-check.js
//
// 数値の正本: docs/spec/YGGDRASIL_SKILLS.md。説明文(traitDesc・effectDesc)を書いただけでは何も起きず、
// 効き目は本体のあちこちの分岐が作る。どれか1か所書き忘れても画面はふつうに動いてしまうので、ここで1本ずつ確かめる。
//   ① 勇者特性「生命の源」: 1〜5ターン目は被ダメ×0.7、6・9・12…ターン目の頭にガッツを上限の30%回復(WAVEごとに数え直す)
//   ② 固有技「大樹の加護」: 使ったターンから2ターン被ダメ30%軽減(このターンは即時倍率・次のターンは予約を掛け算)＋ガッツ20%
//      予告(71-screen-battle)にも同じ倍率が入る
//   ③ モンヒロビートの能力「必死」: 7秒のあいだ GREAT 以上をジャストマーベラスに引き上げる(GOOD 以下は変えない)
// タクティクスのEX(世界樹の守り・スイーツパラダイス)は tools/mode/tactics-ex-skills-check.js が見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const slice = (text, from, to) => { const i = text.indexOf(from), j = text.indexOf(to, i); return i >= 0 && j > i ? text.slice(i, j) : ''; };

const allies = read('monster-hero/data/ally-monsters.js');
const bond = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const screen = read('monster-hero/src/parts/71-screen-battle.jsx');
const rhythm = read('monster-hero/data/rhythm-mode.js');
const play = read('monster-hero/src/parts/30-rhythm-play.jsx');

// --- ① 生命の源 ---
const sandbox = {};
vm.createContext(sandbox);
const traitSrc = slice(bond, 'const LIFE_SOURCE_MONSTER_IDS', '// ★タクティクスバトルは敵の並びが別');
check('生命の源・大樹の加護の決めごとを本体から切り出せる', traitSrc.length > 0);
vm.runInContext(`${traitSrc}\nglobalThis.t={hasLifeSourceTrait,lifeSourceDamageMult,lifeSourceGutsTurn,isLifeTreeGuardCard,lifeTreeGuardMult,LIFE_SOURCE_GUTS_RATE};`, sandbox);
const t = sandbox.t;
check('生命の源を持つのはユグドラシルとメルホイップだけ',
  t.hasLifeSourceTrait('Yggdrasil') && t.hasLifeSourceTrait('MelWhip') && !t.hasLifeSourceTrait('Mocchi'));
check('1〜5ターン目は被ダメ×0.7、0・6ターン目・持っていない子は×1',
  [1, 2, 3, 4, 5].every(n => t.lifeSourceDamageMult('Yggdrasil', n) === 0.7)
  && t.lifeSourceDamageMult('Yggdrasil', 6) === 1 && t.lifeSourceDamageMult('Yggdrasil', 0) === 1
  && t.lifeSourceDamageMult('Mocchi', 3) === 1);
check('ガッツ回復は6・9・12ターン目(5・7・8・10ターン目は無し)、率は30%',
  [6, 9, 12, 15].every(n => t.lifeSourceGutsTurn('MelWhip', n)) && ![5, 7, 8, 10, 11].some(n => t.lifeSourceGutsTurn('MelWhip', n))
  && !t.lifeSourceGutsTurn('Mocchi', 6) && t.LIFE_SOURCE_GUTS_RATE === 0.3);
check('被ダメの式に生命の源が入り、ターン数で数え直す(依存に turnCount)',
  /\*lifeSourceDamageMult\(traitHeroId,turnCount\);/.test(app));
check('ガッツ回復は次のターンの番号で決め、タクティクスは持っている子それぞれ・既存モードは勇者モン',
  /const lifeSourceTurn=turnCount\+1;/.test(app)
  && /lifeSourceGutsTurn\(tacticsUnitsRef\.current\[slotIdx\]\?\.id,lifeSourceTurn\)\) lifeSourceGain\+=gainGutsByRate\(slotIdx,LIFE_SOURCE_GUTS_RATE\)/.test(app)
  && /lifeSourceGutsTurn\(mainHero\?\.id,lifeSourceTurn\)/.test(app));

// --- ② 大樹の加護 ---
check('大樹の加護は固有技(技の出自がユグドラシル種)だけ',
  t.isLifeTreeGuardCard({ type: 'unique', monId: 'Yggdrasil' }) && t.isLifeTreeGuardCard({ type: 'unique', monId: 'MelWhip' })
  && !t.isLifeTreeGuardCard({ type: 'atk', monId: 'Yggdrasil' }) && !t.isLifeTreeGuardCard({ type: 'unique', monId: 'Mocchi' }));
check('軽減は30%(半減なら15%)', Math.abs(t.lifeTreeGuardMult(1) - 0.7) < 1e-9 && Math.abs(t.lifeTreeGuardMult(0.5) - 0.85) < 1e-9);
const branch = slice(app, "else if(card.monId==='Yggdrasil'||card.monId==='MelWhip'){", "else if(card.monId==='Pandora'){");
check('固有技の分岐がある(ガッツ20%・このターンの即時倍率・次ターンの予約)', branch.length > 0
  && /gainGutsByRate\(slotIdx,0\.2\*effMul\)/.test(branch)
  && /immediateTakenMultBySlot\[slotIdx\]=guardMult;/.test(branch) && /immediateTakenMult=guardMult;/.test(branch));
check('次ターンの予約はほかの軽減を消さず掛け算で重ねる',
  /tacticsSlotRate\(p\.bySlot,slotIdx,'takenDamageMult',1\.0\)\*guardMult/.test(branch)
  && /takenDamageMult:\(Number\.isFinite\(cur\)&&cur>0\?cur:1\)\*guardMult/.test(branch));
check('このターンの倍率を敵の番へ渡し、敵の番の被ダメ6か所すべてが通す',
  /takenMult:immediateTakenMult,takenMultBySlot:immediateTakenMultBySlot\}/.test(app)
  && (app.match(/applyImmediateTakenReduction\(/g) || []).length === 6);
check('予告の数字にも使ったターンぶんが入る',
  /applyTurnDamageReduction\(hit\.taken > 0 \? hit\.taken \* plannedLifeTreeMult\(slotIdx\) : hit\.taken, slotIdx\)/.test(screen)
  && /if \(!isLifeTreeGuardCard\(card\)\) return;/.test(screen));
check('説明文(effectDesc)と数値が合っている',
  (allies.match(/effectDesc:"大樹の加護：最大ガッツの20%回復＆被ダメージ30%軽減\(このターンから2ターン\)"/g) || []).length === 2
  && (allies.match(/traitDesc:"勇者モン選択時：1〜5ターン目は被ダメージ30%軽減。6ターン目以降、3ターン毎にガッツ30%回復\(ターン数はWAVE毎にリセット\)"/g) || []).length === 2);

// --- ③ 必死 ---
const abilitySrc = slice(rhythm, 'const RHYTHM_MONSTER_ABILITIES=', '// 能力を通したライフ計算。');
const activateSrc = slice(rhythm, 'const rhythmActivateMonsterAbility=', '// 蘇生したときのスコアの続き方');
check('能力の決めごとを切り出せる', abilitySrc.length > 0 && activateSrc.length > 0);
const rs = { RHYTHM_LIFE_MAX: 1000, rhythmLifeValue: (v) => Number(v) || 0 };
vm.createContext(rs);
vm.runInContext(`${abilitySrc}\n${activateSrc}\nglobalThis.r={RHYTHM_MONSTER_ABILITIES,rhythmMonsterAbilityForLineage,createRhythmMonsterAbilityState,rhythmMonsterAbilityRemainingMs,rhythmHisshiUpgrades,rhythmActivateMonsterAbility};`, rs);
const r = rs.r;
const hisshi = r.rhythmMonsterAbilityForLineage('yggdrasil');
check('主血統ユグドラシルの能力は「必死」(7秒)', !!hisshi && hisshi.id === 'HISSHI' && hisshi.name === '必死' && hisshi.durationMs === 7000);
const on = r.rhythmActivateMonsterAbility({ ability: hisshi, state: r.createRhythmMonsterAbilityState(), life: 500, songTimeMs: 10000 });
check('取ると7秒の終わりを持つ(ライフは変えない)', on.applied && on.life === 500 && on.state.hisshiUntilMs === 17000
  && r.rhythmMonsterAbilityRemainingMs(on.state, 'HISSHI', 12000) === 5000);
check('効いているあいだ GREAT・EXCELLENT・MARVELOUS を引き上げる。GOOD・BAD・MISS はそのまま',
  ['GREAT', 'EXCELLENT', 'MARVELOUS'].every(j => r.rhythmHisshiUpgrades(on.state, j, 16999))
  && !['GOOD', 'BAD', 'MISS'].some(j => r.rhythmHisshiUpgrades(on.state, j, 12000)));
check('7秒を過ぎたら・取る前は引き上げない',
  !r.rhythmHisshiUpgrades(on.state, 'GREAT', 17000) && !r.rhythmHisshiUpgrades(r.createRhythmMonsterAbilityState(), 'GREAT', 12000));
check('無敵・我慢の残り時間は今までどおり別々に持つ',
  r.rhythmActivateMonsterAbility({ ability: r.RHYTHM_MONSTER_ABILITIES.MUTEKI, state: on.state, life: 500, songTimeMs: 11000 }).state.hisshiUntilMs === 17000);
check('判定の入口で置き換える(判定を MARVELOUS・ズレを0。スコア・コンボ・ライフ・判定数もそれで数える)',
  /if\(rhythmHisshiUpgrades\(run\.abilities,judgment,run\.audio\?\.songTimeMs\?\.\(\)\?\?0\)\)\{judgment='MARVELOUS';deltaMs=0;\}/.test(play)
  && play.indexOf('rhythmHisshiUpgrades(run.abilities') < play.indexOf('note._rhythmFinalJudgment=judgment'));
check('演奏中の右上に残り時間を出し、持ち主の枠を光らせる',
  /hisshiMs>0\?`必死 \$\{\(hisshiMs\/1000\)\.toFixed\(1\)\}s`/.test(play)
  && /'HISSHI',songTimeMs\)>0&&owners\.HISSHI\)active\.add\(owners\.HISSHI\)/.test(play));

// 判定名は画面の表記どおり英語(2026-09-29 ユーザー指摘「ジャストマーベラスは英語ね」)。
// コメントを除いた、プレイヤーに見える文にカタカナの「ジャストマーベラス」が無いこと
const visibleLines = (text) => text.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
const katakanaHits = [['help.js', read('monster-hero/data/help.js')], ['changelog.js', read('monster-hero/data/changelog.js')],
  ['20-market-notices-help.jsx', read('monster-hero/src/parts/20-market-notices-help.jsx')], ['30-rhythm-play.jsx', play]]
  .flatMap(([name, text]) => visibleLines(text).filter(l => l.includes('ジャストマーベラス')).map(() => name));
check('判定名は「JUST MARVELOUS」と英語で書く(カタカナで出さない)', katakanaHits.length === 0
  && /GREAT以上の判定がすべてJUST MARVELOUSになる/.test(read('monster-hero/src/parts/20-market-notices-help.jsx')), katakanaHits.join('・'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
