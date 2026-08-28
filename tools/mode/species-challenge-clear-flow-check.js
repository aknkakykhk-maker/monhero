// 種族チャレンジの「クリアしたときに何が確定するか」を確認する。
//
//   node tools/mode/species-challenge-clear-flow-check.js
//
// 【背景】
// 種族チャレンジは複数のPRに分かれて実装され、WAVE10まで勝ってもクリア扱いにする処理が
// 入っていない時期があった(勝ち表示だけ出して終わっていた)。ここでは
//
//   ・WAVE10を勝ち切ったときだけ確定する
//   ・敗北・リタイア・途中離脱では確定しない
//   ・確定は1ランにつき1回だけ(連打・再描画でクリア回数が二重に増えない)
//   ・実際に保存するのはデバッグの「実進行保存で実戦確認」から始めたランだけ
//   ・全国ランキングへは送らない
//
// を、実装そのものから機械的に確かめる。数値や個数の正しさは
// species-challenge-clear-reward-check.js 側が正本なので、ここでは重複して持たない。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { REPO_ROOT } = require('../harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 確定処理の中身 ---
const fnStart = source.indexOf('const finishSpeciesChallengeClear = async () => {');
const fnEnd = source.indexOf('const createRepeatRunTemplate =', fnStart);
check('クリア確定処理(finishSpeciesChallengeClear)がある', fnStart >= 0 && fnEnd > fnStart);
const fn = fnStart >= 0 ? source.slice(fnStart, fnEnd) : '';

check('1ランにつき1回だけ確定する(連打・再描画でクリア回数を二重に増やさない)',
  fn.includes('if(speciesChallengeClearHandledRef.current)return;') && fn.includes('speciesChallengeClearHandledRef.current=true;'));
check('保存するかどうかはランごとのフラグで決める',
  fn.includes('if(!speciesChallengeSaveRunRef.current){'));
check('保存しないランでは進行を書き込まない',
  fn.slice(fn.indexOf('if(!speciesChallengeSaveRunRef.current){'), fn.indexOf('try{')).includes('return;')
  && !fn.slice(fn.indexOf('if(!speciesChallengeSaveRunRef.current){'), fn.indexOf('try{')).includes('persistSpeciesChallengeClearReward'));
check('保存するランでは既存の安全な確定処理を使う(独自の保存を書かない)',
  fn.includes('await persistSpeciesChallengeClearReward({'));
check('自己記録(スコア・ターン)を同じ確定処理へ渡す',
  fn.includes('record:{ score,turns:clearTurns }'));
check('次に解放される難易度を正本の並びから求める',
  fn.includes('SPECIES_CHALLENGE_DIFFICULTY_IDS[SPECIES_CHALLENGE_DIFFICULTY_IDS.indexOf(difficultyId)+1]'));
check('全国ランキングへは送らない',
  !fn.includes('submitRunScore') && !fn.includes('postRanking') && !fn.includes('supabase'));

// --- ② 呼び出し位置：WAVE10の勝利だけ ---
const nextWaveStart = source.indexOf('const handleNextWave = async () => {');
const nextWave = source.slice(nextWaveStart, nextWaveStart + 3000);
check('WAVE10の分岐からだけ確定処理を呼ぶ',
  nextWave.includes('if (wave === 10) {') && nextWave.includes('await finishSpeciesChallengeClear();'));
const beforeWave10 = nextWave.slice(0, nextWave.indexOf('if (wave === 10) {'));
check('WAVE10へ着く前に確定処理を呼ばない', !beforeWave10.includes('finishSpeciesChallengeClear'));
const callSites = (source.match(/finishSpeciesChallengeClear\(\)/g) || []).length;
check('確定処理の呼び出しは1か所だけ', callSites === 1, `${callSites}か所`);

// 敗北・リタイアの経路から呼ばれていないこと
for (const [needle, label] of [['const handleGiveUp', 'リタイア'], ['const handleDefeat', '敗北']]) {
  const at = source.indexOf(needle);
  if (at < 0) continue;
  check(`${label}の処理からは確定しない`, !source.slice(at, at + 2500).includes('finishSpeciesChallengeClear'));
}

// --- ③ 保存モードの入口 ---
check('保存する実戦はデバッグ画面からだけ始められる',
  source.includes('data-species-real-run-start') && source.includes('openSpeciesChallengeSelection({saveProgress:true})'));
check('保存する実戦は誤操作防止の確認を出す',
  source.includes("window.confirm('実際の種族チャレンジ進行・所持品を変更します。よろしいですか？')"));
check('保存する実戦であることを画面へ明示する',
  source.includes('⚠️ 実際の種族チャレンジ進行・所持品を変更します。'));
const modeCardStart = source.indexOf("const modes=[...BATTLE_MODES,EXTREME_MODE,...((SPECIES_CHALLENGE_PUBLIC_RELEASE||debugBattle)?[SPECIES_CHALLENGE_MODE]:[])]");
check('通常のバトルモード入口は保存なしのまま(saveProgressを渡さない)',
  modeCardStart >= 0 && source.includes('if(isSpecies){openSpeciesChallengeSelection();return;}'));
check('一般公開フラグは既定でfalse(通常プレイのBATTLE MODEへ出さない)',
  /const SPECIES_CHALLENGE_PUBLIC_RELEASE = false;/.test(source));

// --- ランキング画面 ---
// 他モードと同じ「◯◯ランキング」の呼び方・同じ入れ物にそろえ、
// 絆Lvランキングと同じように種族で絞り込めるようにする
const rankBodyStart = source.indexOf('const renderSpeciesChallengeRecordBody = () => {');
const rankBodyEnd = source.indexOf('const renderBreederRankingBody =', rankBodyStart);
check('種族チャレンジのランキング本文がある', rankBodyStart >= 0 && rankBodyEnd > rankBodyStart);
const rankBody = rankBodyStart >= 0 ? source.slice(rankBodyStart, rankBodyEnd) : '';
check('他モードと同じ「◯◯ランキング」の見出しにする',
  source.includes('{`${mode.label}ランキング`}') && !source.includes('`${mode.label}の記録`'));
check('モードカードの導線も他モードと同じ「ランキング」表記',
  source.includes('🏆 {m.label}のランキング') && !source.includes('🏅 {m.label}の記録'));
check('種族で絞り込むタブがある', rankBody.includes('data-species-rank-tabs'));
check('種族タブは「すべて」＋種族別で、絆Lvランキングと同じ並べ方',
  rankBody.includes("{ id:'all', label:'すべて' }") && rankBody.includes('...lineages.map(l => ({ id:l.id, label:`${l.name}種` }))'));
check('「すべて」はその難易度の種族順位、種族を選ぶとその種族の難易度別を出す',
  rankBody.includes("speciesFilter === 'all'") && rankBody.includes('SPECIES_CHALLENGE_DIFFICULTY_IDS.map(id => ({ id, record: speciesChallengeRecord(speciesChallengeProgress, speciesFilter, id) }))'));
check('種族を選んだときは難易度タブを出さない(全難易度を縦に並べるため)',
  rankBody.includes("{speciesFilter === 'all' && <div className=\"flex gap-1.5 overflow-x-auto pb-2 shrink-0\">"));
// 種族を選んだあと、その種族の難易度別ランキングが必ず見られる状態にしておく。
// クリア済みだけを並べると、1つもクリアしていない種族では中身が空になり
// 「種族での難易度別ランキングが無い」ように見えてしまう
check('種族を選ぶと14難易度をすべて並べる(未クリアも残す)',
  rankBody.includes("row.record.clears > 0\n              ? `クリア ${row.record.clears}回")
  && rankBody.includes("'まだクリアしていません'")
  && !/SPECIES_CHALLENGE_DIFFICULTY_IDS\.map[\s\S]{0,200}?\.filter\(row => row\.record\.clears > 0\)/.test(rankBody));
check('未クリアの難易度は「記録なし」と分かる形で出す', rankBody.includes('記録なし'));
// 難易度カードからも、その種族のランキングへ入れるようにする
check('難易度カードに種族ランキングの導線がある',
  source.includes('data-species-difficulty-record-link')
  && source.includes("openSpeciesChallengeRecords('BATTLE_DIFFICULTY_SELECT',{speciesId:speciesChallengeSelection.speciesId,difficultyId:key})"));
const openRecords = source.slice(source.indexOf('const openSpeciesChallengeRecords ='), source.indexOf('const openModeScoreRanking ='));
check('そこから開くと、その種族と難易度が最初から選ばれている',
  openRecords.includes('setSpeciesRankFilter(speciesChallengeLineages().some(lineage=>lineage.id===speciesId)?speciesId:\'all\')')
  && openRecords.includes('SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)?difficultyId:SPECIES_CHALLENGE_DIFFICULTY_IDS[0]'));
check('公開前は自分の記録だけと明示する',
  rankBody.includes('!SPECIES_CHALLENGE_PUBLIC_RELEASE &&') && rankBody.includes('全国ランキングはモードの公開後に始まります'));
check('ランキング画面は新しい保存キーを作らない', !/mh_[a-z]/.test(rankBody));

// --- ④ デバッグ状態が通常バトルへ漏れない ---
const homeStart = source.indexOf('const returnToHome = () => {');
const home = source.slice(homeStart, homeStart + 1500);
check('HOMEへ戻ると保存フラグを必ず落とす',
  home.includes('speciesChallengeSaveRunRef.current = false;') && home.includes('setSpeciesChallengeSaveRun(false);'));
check('HOMEへ戻るとクリア確定の一度きりフラグも戻す',
  home.includes('speciesChallengeClearHandledRef.current = false;'));
check('HOMEへ戻るとランそのものも捨てる',
  home.includes('speciesChallengeBattleRunRef.current = null;'));

// --- ⑤ 開始時に毎回リセットされるか ---
const startStart = source.indexOf('const startSpeciesChallengeBattle = (run, { saveProgress=false }={}) => {');
const start = source.slice(startStart, startStart + 1500);
check('ラン開始時に保存フラグをそのランの指定で入れ直す',
  startStart >= 0 && start.includes('speciesChallengeSaveRunRef.current=!!saveProgress;'));
check('ラン開始時にクリア確定の一度きりフラグを戻す',
  start.includes('speciesChallengeClearHandledRef.current=false;'));
check('ラン開始時に前回のクリア結果表示を消す',
  start.includes('setSpeciesChallengeClearResult(null);'));
check('種族チャレンジ中はdebugBattleを維持する', start.includes('debugBattleRef.current=true;'));

// --- ⑥ 実際に動かして、記録の積み上がり方を確かめる ---
const sliceStart = source.indexOf('const DIFFICULTY_SETTINGS =');
const sliceEnd = source.indexOf('const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS =', sliceStart);
const context = { console };
vm.createContext(context);
vm.runInContext(`${source.slice(sliceStart, sliceEnd)}\nglobalThis.api={
  normalizeSpeciesChallengeProgress,markSpeciesChallengeCleared,
  speciesChallengeRecord,updateSpeciesChallengeRecord,
  isSpeciesChallengeDifficultyUnlocked,speciesChallengeClearedDifficultyIds,
};`, context);
const api = context.api;

// 「敗北したときは何も変わらない」= クリア確定処理を通さなければ進行は空のまま
const blank = api.normalizeSpeciesChallengeProgress(null);
check('確定処理を通さなければクリアも記録も増えない',
  JSON.stringify(blank) === JSON.stringify({ version:1, species:{}, pendingRewards:{} }));

// 同じ種族で1つ前をクリアすると次が解放され、他種族には波及しない
const dragonExpert = api.markSpeciesChallengeCleared(blank, 'Dragon', 'Expert');
check('同じ種族で前の難易度をクリアすると次が解放される',
  api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(dragonExpert, 'Dragon')));
check('他の種族の解放には波及しない',
  !api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(dragonExpert, 'Mocchi')));

// 記録は種族×難易度ごとに積み上がる
let progress = blank;
for (const score of [500, 1500, 900]) progress = api.updateSpeciesChallengeRecord(progress, 'Dragon', 'Expert', { score, turns:40 });
const record = api.speciesChallengeRecord(progress, 'Dragon', 'Expert');
check('クリアのたびにクリア回数が増え、自己ベストは最良だけ残る',
  record.clears === 3 && record.bestScore === 1500, `clears=${record.clears} / best=${record.bestScore}`);
check('同じ種族の別難易度へは混ざらない', api.speciesChallengeRecord(progress, 'Dragon', 'Hard').clears === 0);
check('別の種族へは混ざらない', api.speciesChallengeRecord(progress, 'Mocchi', 'Expert').clears === 0);

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
