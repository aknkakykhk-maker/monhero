// ジャック戦の「戦闘データ」を確かめる(35-raid-jack.jsx の定義と、敵データ・技の表の食い違いを防ぐ)。
// 正本: docs/spec/RAID_BOSS_JACK.md。実装の段階が進むたびに、ここへ見るものを足す。
//
// 見るもの(Nodeで本物のデータと式を動かす)
//   ① 敵データ Jack の技名が RAID_JACK_SKILL_NAMES と同じ(二重管理の食い違い防止)。絵が実在する
//   ② Jack は TACTICS_ENEMY_SEQUENCE に入っていない(通常ランは10体固定)
//   ③ 使う技の本数が段階ごとに 3/4/5/5/5、再生なし、落とす順は 攻撃力アップ → うしろから
//   ④ 敵のライフ・攻撃が、段階の倍率で決まった値(RAID_JACK_*_TIERS の hp / atk)と一致する
//   ⑤ ほかの敵の技の本数が変わっていない(回帰)
//   ⑥ モードの隔離: ジャックのモードは盤面だけタクティクスと同じで、自己ベスト・ランキング・通常の送信へ一切つながらない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const dataCtx = { Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN };
vm.createContext(dataCtx);
vm.runInContext(`${read('monster-hero/data/images/images-enemy.js')}\n${read('monster-hero/data/enemy-monsters.js')}\n${read('monster-hero/src/parts/35-raid-jack.jsx')}\n`
  + 'globalThis.out={TACTICS_ENEMY_DATA,TACTICS_ENEMY_SEQUENCE,JACK_IMG,JACK_POSE_IMG,JACK_ICON_IMG,RAID_JACK_A_TIERS,RAID_JACK_B_TIERS,RAID_JACK_SKILL_NAMES,RAID_JACK_ACTION_IDS};', dataCtx);
const o = dataCtx.out;

const entriesSrc = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const chunk = entriesSrc.slice(entriesSrc.indexOf('const TACTICS_BASE_ACTION_IDS'), entriesSrc.indexOf('// 直前の行動から、次に選べる行動を決めるための状態を作る'));
const defsSrc = read('monster-hero/src/game-system.jsx');
const defChunk = defsSrc.slice(defsSrc.indexOf('const ENEMY_ACTION_DEFINITIONS'), defsSrc.indexOf('const TACTICS_BASE_ACTION_IDS'));
const ctx = { RANGE_LABELS: ['零', '近', '中', '遠'], Math, Number, Object, Array, Set };
vm.createContext(ctx);
vm.runInContext(`${defChunk}\n${chunk}\nglobalThis.api={TACTICS_ENEMY_ACTION_IDS,tacticsEnemyActionIds,tacticsActionDefinitions,enemyActionDefinitionsFor};`, ctx);
const api = ctx.api;

// ① データ
const jack = o.TACTICS_ENEMY_DATA.Jack;
check('敵データ Jack がある', !!jack);
const n = o.RAID_JACK_SKILL_NAMES;
check('通常攻撃・必殺技の名前が定義と同じ', jack.normal === n.normal && jack.special === n.special);
check('追加技の名前が定義と同じ', ['sweep', 'rush', 'pierce', 'roar', 'allout'].every((k) => jack.actions[k] === n[k]), JSON.stringify(jack.actions));
check('再生の名前を持たない', !('regen' in jack.actions));
const fileOf = (u) => path.join(ROOT, 'monster-hero', String(u).split('?')[0]);
check('立ち絵(通常・ポーズ)と顔アイコンの絵が実在する', [o.JACK_IMG, o.JACK_POSE_IMG, o.JACK_ICON_IMG].every((u) => fs.existsSync(fileOf(u))));
check('Jack の絵は敵データが指している', jack.imgUrl === o.JACK_IMG && jack.poseImgUrl === o.JACK_POSE_IMG);

// ② 通常ランに混ざらない
check('Jack は TACTICS_ENEMY_SEQUENCE に入っていない', !o.TACTICS_ENEMY_SEQUENCE.includes('Jack') && o.TACTICS_ENEMY_SEQUENCE.length === 10);

// ③ 技の本数
check('技の並びは定義と同じ(再生なし)', api.TACTICS_ENEMY_ACTION_IDS.Jack.join() === o.RAID_JACK_ACTION_IDS.join() && !api.TACTICS_ENEMY_ACTION_IDS.Jack.includes('regen'));
const counts = [...o.RAID_JACK_A_TIERS, ...o.RAID_JACK_B_TIERS];
counts.forEach((t) => {
  const ids = api.tacticsEnemyActionIds('Jack', 'Normal', t.actionCount);
  check(`${t.name}: 技は ${t.actionCount} 本`, ids.length === t.actionCount, ids.join(','));
});
check('3本は 連撃・間合い・貫通(攻撃力アップと全体攻撃を落とす)', api.tacticsEnemyActionIds('Jack', 'Normal', 3).join() === 'rush,sweep,pierce');
check('4本は 攻撃力アップだけ落とす', api.tacticsEnemyActionIds('Jack', 'Normal', 4).join() === 'rush,sweep,pierce,allout');
check('5本は全部', api.tacticsEnemyActionIds('Jack', 'Normal', 5).join() === 'rush,sweep,roar,pierce,allout');
check('どんな難易度を渡しても actionCount が優先', ['Beginner', 'Legend', 'EXTREME'].every((d) => api.tacticsEnemyActionIds('Jack', d, 4).length === 4));
check('actionCount が無ければ今までどおり(難易度の増減)', api.tacticsEnemyActionIds('Jack', 'Normal').length === 5);
check('貫通撃を持つ段階は構え(pierceCharge)も持つ',
  api.tacticsActionDefinitions('Jack', 'Normal', 3).some((d) => d.id === 'pierceCharge') && api.tacticsActionDefinitions('Jack', 'Normal', 3).some((d) => d.id === 'pierce'));
check('行動表の入口(enemyActionDefinitionsFor)でも本数が反映される(新タクティクス)',
  (() => { const prev = ctx.isTacticsMode; ctx.isTacticsMode = () => true; vm.runInContext('globalThis.isTacticsMode = () => true', ctx);
    const defs = api.enemyActionDefinitionsFor('raid', 'Jack', 'Normal', 3); return defs.filter((d) => ['rush', 'sweep', 'roar', 'pierce', 'allout'].includes(d.id)).length === 3; })());

// ④ ライフ・攻撃
const enemySrc = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const ceStart = enemySrc.indexOf('const createBattleEnemy');
const ceChunk = enemySrc.slice(ceStart, enemySrc.indexOf('const collectBondRankingEntries'));
const ceCtx = { Math, Number, Object, isTacticsMode: () => true, TACTICS_ENEMY_SEQUENCE: o.TACTICS_ENEMY_SEQUENCE, TACTICS_ENEMY_DATA: o.TACTICS_ENEMY_DATA, ENEMY_SEQUENCE: [], ENEMY_DATA: {},
  normalizeBattleDifficulty: (d) => d || 'Normal', QUICK_DIFFICULTY_SETTINGS: { Normal: { power: 1 } } };
vm.createContext(ceCtx);
vm.runInContext(`${ceChunk}\nglobalThis.createBattleEnemy=createBattleEnemy;`, ceCtx);
counts.forEach((t) => {
  const e = ceCtx.createBattleEnemy(1, 'Normal', 'Jack', t.power, 1, { mode: 'raid', actionCount: t.actionCount });
  // 実際の戦闘は raidJackMakeEnemy が、ライフ・攻撃力を段階の値で上書きする(攻撃力はレイドバトルだけ別の倍率・2026-10-04)。
  // ここでは createBattleEnemy が出す技の本数・敵idと、段階の値(上書き後)を見る
  check(`${t.name}: ライフ ${t.hp.toLocaleString()} / 攻撃 ${t.atk.toLocaleString()}`, t.hp === Math.round(35000 * t.power * 10) && t.atk === Math.round(700 * t.atkPower) && e.actionCount === t.actionCount && e.id === 'Jack', `hp=${e.hp} atk=${e.atk}`);
});
const plain = ceCtx.createBattleEnemy(1, 'Normal', 'Dokudoku', 1, 1, { mode: 'tactics' });
check('ほかの敵には actionCount が付かない(回帰)', !('actionCount' in plain));

// ⑤ 回帰
const expectBase = { Kawazumo: 1, Metalner: 1, Inari: 2, Koinobori: 2, Delpiero: 2, Dokudoku: 3, Lamia: 2, Nyarlathotep: 3, Splatter: 4, AwakenedMoo: 6 };
check('ほかの敵の技の本数は変わっていない', Object.entries(expectBase).every(([k, v]) => api.tacticsEnemyActionIds(k, 'Normal').length === v));
check('ドクドクは難易度でこれまでどおり増える(Legend=+3)', api.tacticsEnemyActionIds('Dokudoku', 'Legend').length === 6);

// ⑥ モードの隔離
const core = read('monster-hero/src/parts/10-core.jsx');
const sup = read('monster-hero/src/parts/26-supabase.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const slice = (text, from, to) => { const i = text.indexOf(from); if (i < 0) return ''; const j = text.indexOf(to, i); return text.slice(i, j < 0 ? undefined : j + to.length); };
const lineOf = (text, from) => slice(text, from, '\n');
const coreCtx = { Object, Array, Math, Number, RAID_JACK_PUBLIC_RELEASE: false, TACTICS_MODE_PUBLIC_RELEASE: true, TACTICS_BETA_PRO_RELEASE: true, SPECIES_CHALLENGE_PUBLIC_RELEASE: true,
  isQuickMode: () => false, isProMode: () => false, normalizeBattleMode: (m) => m };
vm.createContext(coreCtx);
vm.runInContext([
  ...(core.match(/^const BATTLE_MODE_[A-Z_]+ = '[^']+';$/gm) || []),
  slice(core, 'const TACTICS_BATTLE_MODES', ']);'),
  lineOf(core, 'const RAID_JACK_BATTLE_MODES'), lineOf(core, 'const isRaidJackMode'), lineOf(core, 'const isTacticsMode'),
  slice(core, 'const modeKeyPrefix', "'mh_';"),
  slice(core, 'const battleModePlayable', '\n};'),
  slice(core, 'const modeHasRanking', 'battleModePlayable(mode));'),
  'globalThis.m={isRaidJackMode,isTacticsMode,modeKeyPrefix,battleModePlayable,modeHasRanking,TACTICS_BATTLE_MODES};',
].join('\n'), coreCtx);
const m = coreCtx.m;
const RAID = ['raidJackA', 'raidJackB'];
check('ジャックのモードは2つ(raidJackA / raidJackB)', RAID.every((id) => m.isRaidJackMode(id)) && !m.isRaidJackMode('tactics') && !m.isRaidJackMode('tacticsPro'));
check('盤面はタクティクスと同じ(isTacticsMode が真)', RAID.every((id) => m.isTacticsMode(id)));
check('TACTICS_BATTLE_MODES は通常の3つのまま', m.TACTICS_BATTLE_MODES.join() === 'tactics,tacticsSpecies,tacticsPro');
check('記録の接頭辞が通常タクティクスと重ならない(mh_tactics_ にならない)', RAID.every((id) => m.modeKeyPrefix(id) === 'mh_raid_jack_unused_') && m.modeKeyPrefix('tactics') === 'mh_tactics_' && m.modeKeyPrefix('tacticsPro') === 'mh_tactics_pro_');
check('全国ランキングの対象ではない(公開後も)', RAID.every((id) => m.modeHasRanking(id) === false) && m.modeHasRanking('tactics') === true);
check('公開フラグが偽のあいだは遊べない。デバッグ戦だけは遊べる', RAID.every((id) => m.battleModePlayable(id) === false && m.battleModePlayable(id, { debugBattle: true }) === true));
coreCtx.RAID_JACK_PUBLIC_RELEASE = true;
check('公開フラグを立てると遊べる(タクティクスの公開とは別に決まる)', RAID.every((id) => m.battleModePlayable(id) === true));
check('rankingDifficultyForMode はジャックを例外で止める(通常タクティクスの行を汚さない)',
  /const rankingDifficultyForMode[\s\S]{0,400}if \(isRaidJackMode\(mode\)\) throw new Error/.test(sup));
check('submitRunScoreOnce はジャックを手前で return する(submitTacticsScoreOnce より前)',
  /if \(isRaidJackMode\(runMode\)\) return;\n\s*if \(isTacticsMode\(runMode\)\) return submitTacticsScoreOnce\(\);/.test(app));
check('TACTICS_SCORE_MODES(自己ベストを持つモード)にジャックを入れていない', !/const TACTICS_SCORE_MODES = [^\n]*RAID/.test(core));

// ⑦ 戦闘の終わり方(実機で通しにくい経路は、コードの形で固定する)
check('20ターンを超えたら finishRaidJack("turns")(全滅にはしない)・通常は今までどおり20ターン',
  /if\(raidJackRunRef\.current\)\{\s*raidJackRunRef\.current\.turns=Math\.min\(nextTurn,RAID_JACK_TURNS\);\s*if\(nextTurn>RAID_JACK_TURNS\)\{ finishRaidJack\('turns'\); return; \}/.test(app)
  && /\} else if\(nextTurn>20\)\{ if\(tacticsWipe\(\)===null\) setHp\(0\); \}/.test(app));
check('Aだけ 3/5/8 ターン目に成長する(RAID_JACK_LEVEL_UP_TURNS)', /raidJackRunRef\.current\.kind==='a'&&RAID_JACK_LEVEL_UP_TURNS\.includes\(nextTurn\)/.test(app));
const defs35 = read('monster-hero/src/parts/35-raid-jack.jsx');
check('成長のターンは 3 / 5 / 8', /RAID_JACK_LEVEL_UP_TURNS = Object\.freeze\(\[3, 5, 8\]\)/.test(defs35));
check('撃破は resolveEnemyDefeat の先頭(WAVE報酬より前)で終わる', /enemyDefeatResolvedRef\.current = true;\n\s*\/\/ ★ジャック戦はここで終わり[^\n]*\n\s*if \(raidJackRunRef\.current\) \{ await finishRaidJack\('defeated'\); return true; \}/.test(app));
check('全滅・リタイアも finishRaidJack を通る', /if \(raidJackRunRef\.current\) \{ finishRaidJack\('wipe'\); return; \}/.test(app) && /finishRaidJack\('giveup'\)/.test(app));
check('finishRaidJack は一度しか動かない(finished)', /if\(!run\|\|run\.finished\) return;\n\s*run\.finished=true;/.test(app));
check('ジャック戦は debugBattleRef を立てて始まる(報酬・絆・記録へつながらない)', /raidJackRunRef\.current=\{kind:isB\?'b':'a'[\s\S]{0,900}debugBattleRef\.current=true;/.test(app));
check('ジャック戦の敵は段階の値で作る(編成の総合力の補正を掛けない)', /const raidRun=isRaidJackMode\(runMode\)\?raidJackRunRef\.current:null;[\s\S]{0,200}isTacticsMode\(runMode\)&&!raidRun/.test(app));

// ⑧ レイドバトル(A)専用ルール(2026-10-04)。EXの回数はコードの形で固定する(実機で通しにくいため)
check('A: 1ターンごとに味方全員の全ステータスが5%ずつ(掛け算)・自動回復の割合が1.5%ずつ上がる(20ターンぶんで半分)',
  /RAID_JACK_TURN_GROWTH = 1\.05;/.test(defs35) && /RAID_JACK_TURN_REGEN_STEP = 0\.015;/.test(defs35)
  && /raidJackRunRef\.current\.kind==='a'&&nextTurn>=2&&nextTurn!==turnCount\) raidJackTurnGrowth\(nextTurn\)/.test(app));
check('A: EXスキルは、持つ味方ごとに2回まで(raidExDefOf が maxUses:2 にする。Bと通常戦は今までどおり)',
  /const raidExDefOf = \(monId\) => \{[\s\S]{0,260}kind === 'a' \? \{ \.\.\.def, unlimited:false, maxUses:2 \} : def;/.test(app)
  && !/[^a-zA-Z]tacticsExDefOf\(/.test(app.replace(/const def = tacticsExDefOf\(monId\);/, '')));
check('AもBも、味方のライフ・ガッツは全快からはじまる(追いつき補正のあとで満タンにする)',
  /fullGuts: isRaidJackMode\(mode\)[\s\S]{0,500}isRaidJackMode\(mode\) && joined \? normalizeTacticsUnit\(\{ \.\.\.joined, hp: joined\.maxHp, guts: joined\.maxGuts \}\)/.test(app));

// ⑨ ターン数とBGM(2026-10-04)
check('1回の戦闘は20ターン(レイドバトルもグランドスラムも)・ターンごとのバフは半分(5% / 1.5%)',
  /const RAID_JACK_TURNS = 20;/.test(defs35) && /RAID_JACK_TURN_GROWTH = 1\.05;/.test(defs35) && /RAID_JACK_TURN_REGEN_STEP = 0\.015;/.test(defs35));
check('ジャックの戦い・レイド画面・段階えらび・編成はぱんぷきんの曲に固定(isGameOver より前で決める)',
  /RAID_JACK_BGM_STATES\.includes\(state\) \|\| \(state === 'BATTLE' && raidJackRunRef\.current\)\) return RAID_JACK_BGM_TRACK;[\s\S]{0,900}if \(isGameOver\) return bgmArrangement\.gameOver;/.test(app)
  && /RAID_JACK_BGM_TRACK = 'melo_crazy_party_night'/.test(defs35) && /id:'melo_crazy_party_night'/.test(read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx')));
check('HOMEの曲は、イベント中かつ曲を選んでいないときだけぱんぷきん(開催中は見るたびに数え直す)',
  /raidJackWindowAt\(Date\.now\(\)\) === 'open'\) \|\| raidJackDebugForce \|\| halloweenNightOpen\)\s*&& bgmArrangement\.home === DEFAULT_BGM_ARRANGEMENT\.home\) \? RAID_JACK_BGM_TRACK : bgmArrangement\.home;/.test(app)
  && /state === 'HOME' \|\| state === 'PROFILE' \|\| state === 'ITEM_INVENTORY'\) return homeBgm;/.test(app));
check('ハロウィン・ナイトの期間中も(曲を選んでいなければ)HOMEの曲がぱんぷきんになる。期間は見るたびに数え直す',
  /const halloweenNightOpen = Date\.now\(\) >= Date\.parse\(HALLOWEEN_NIGHT_START_AT\) && Date\.now\(\) < Date\.parse\(HALLOWEEN_NIGHT_END_AT\);/.test(app));

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');
