// 種族チャレンジの「解放条件」と「公開フラグ1つで全部そろって出るか」を確認する。
//
//   node tools/mode/species-challenge-unlock-check.js
//
// 【なぜ要るか】
// 公開の直前まで作り込む形にしたので、いま画面には何も出ていない。
// そのため「ヘルプだけ先に出てしまう」「解放条件が効いていない」「チャレンジの記録を
// 上書きしてしまう」といった間違いは、公開してはじめて分かってしまう。
// ここでは実装そのものから、次の3つを機械的に確かめる。
//
//   ① 解放条件は既存の mh_clears_* を読むだけで、新しい解放フラグを作っていない
//   ② 公開フラグ(SPECIES_CHALLENGE_PUBLIC_RELEASE)が false のあいだは
//      ヘルプ項目・更新履歴・助手の告知のどれも出ない。true にすれば同時に出る
//   ③ チャレンジの記録(自己ベスト・最高到達WAVE・クリア回数・挑戦回数)へ書き込まない
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { REPO_ROOT } = require('../harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const helpSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/help.js'), 'utf8');
const changelogSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/changelog.js'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== ① 解放条件 =====
// 極限チャレンジとまったく同じ作りにして、判定の書き方を2通りに増やさない
check('解放条件はチャレンジのMaster以上4段',
  source.includes("const SPECIES_CHALLENGE_UNLOCK_DIFFICULTIES = Object.freeze(['Master', 'GrandMaster', 'Hell', 'Legend']);"));
check('解放条件の文言を1か所で持つ',
  source.includes("const SPECIES_CHALLENGE_UNLOCK_TEXT = 'チャレンジ Master以上クリアで解放';"));
check('判定は既存のクリア回数(mh_clears_*)を読むだけ',
  /const isSpeciesChallengeUnlocked = \(clearCounts\) => SPECIES_CHALLENGE_UNLOCK_DIFFICULTIES[\s\S]{0,160}\(Number\(clearCounts\?\.\[key\]\) \|\| 0\) > 0\)/.test(source));
check('新しい解放フラグ(保存キー)を増やしていない',
  !/mh_species_challenge_unlock/.test(source));
check('解放状態は読み込んだクリア回数から作る',
  source.includes('const speciesChallengeUnlocked = useMemo(() => isSpeciesChallengeUnlocked(clearCounts), [clearCounts]);'));

// 実際に動かして、条件を満たす／満たさないを確かめる
const fnStart = source.indexOf('const SPECIES_CHALLENGE_UNLOCK_DIFFICULTIES =');
const fnEnd = source.indexOf('const SPECIES_CHALLENGE_MODE =', fnStart);
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(`${source.slice(fnStart, fnEnd)}\nglobalThis.api={isSpeciesChallengeUnlocked,SPECIES_CHALLENGE_UNLOCK_DIFFICULTIES};`, ctx);
const { isSpeciesChallengeUnlocked } = ctx.api;
check('1度もクリアしていなければ解放されない', isSpeciesChallengeUnlocked({}) === false);
check('壊れた値でも解放されない',
  isSpeciesChallengeUnlocked(null) === false && isSpeciesChallengeUnlocked({ Master: 'あ' }) === false
    && isSpeciesChallengeUnlocked({ Master: 0 }) === false);
check('Master未満のクリアだけでは解放されない',
  isSpeciesChallengeUnlocked({ Beginner: 9, Easy: 9, Normal: 9, Hard: 9, Expert: 9 }) === false);
for (const key of ['Master', 'GrandMaster', 'Hell', 'Legend']) {
  check(`${key}を1回クリアで解放される`, isSpeciesChallengeUnlocked({ [key]: 1 }) === true);
}

// 解放していないあいだは、モードカードから始められない
check('解放前は開始ボタンを押せない',
  source.includes('speciesLocked=isSpecies&&!speciesChallengeUnlocked&&!debugBattle')
    && source.includes('disabled={extremeLocked||speciesLocked||(!!battleTutorial'));
check('解放前のカードに条件を出す',
  source.includes("speciesLocked?SPECIES_CHALLENGE_UNLOCK_TEXT")
    && source.includes("isSpecies?(speciesLocked?'🔒 未解放'"));
check('解放前はランキングの導線も押せない',
  source.includes('data-species-record-link disabled={speciesLocked||!!battleTutorial}'));

// ===== ② 公開フラグ1つで、ヘルプ・更新履歴・告知がそろって出る =====
check('公開フラグはtrue(公開済み)', /const SPECIES_CHALLENGE_PUBLIC_RELEASE = true;/.test(source));
check('出す・出さないの判断を1か所へまとめてある',
  source.includes('const RELEASE_FLAGS = { speciesChallenge: SPECIES_CHALLENGE_PUBLIC_RELEASE };')
    && source.includes('const releasedForPlayers = (item) =>'));
check('ヘルプの項目は公開まで一覧に出さない',
  helpSrc.includes("id: 'species-challenge'") && helpSrc.includes("releaseFlag: 'speciesChallenge'")
    && source.includes('const HELP_GUIDE = ') && source.includes('.filter(releasedForPlayers)'));
check('ヘルプ本文は公開前から書き上げてある',
  helpSrc.includes('種族チャレンジは、挑む前に種族') && helpSrc.includes("{ t:'data', id:'speciesChallengeLineages' }"));
check('画面とヘルプの対応づけも済ませてある',
  helpSrc.includes("SPECIES_CHALLENGE_SELECT: 'basics/species-challenge',")
    && !/SPECIES_CHALLENGE_SELECT:\s*null/.test(helpSrc));
check('一覧やもらえる数はヘルプへ手で書き写さない',
  helpSrc.includes("{ t:'data', id:'speciesChallengeRewards' }")
    && source.includes("case 'speciesChallengeRewards':") && source.includes("case 'speciesChallengeLineages':"));
check('更新履歴も公開まで出さない',
  changelogSrc.includes("title: '種族チャレンジを追加しました'") && changelogSrc.includes("releaseFlag: 'speciesChallenge'")
    && source.includes('(typeof CHANGELOG !== \'undefined\' ? CHANGELOG : []).filter(releasedForPlayers)'));
check('更新履歴から作る助手の告知も公開まで出さない',
  changelogSrc.includes("assistantNotice: { id: 'update_notice_species_challenge_v1', type: 'mode' }")
    && source.includes('const HIDDEN_UPDATE_NOTICE_IDS = new Set(')
    && source.includes('!HIDDEN_UPDATE_NOTICE_IDS.has(notice.id)'));
check('解放したときの案内も公開まで出さない',
  assistantsSrc.includes("id: 'unlock_species_challenge_v1'")
    && assistantsSrc.includes('ctx.speciesChallengeUnlocked === true')
    && source.includes('speciesChallengeUnlocked: SPECIES_CHALLENGE_PUBLIC_RELEASE && speciesChallengeUnlocked,'));
check('解放の案内は既存の既読キーへ記録する(新しい保存キーを作らない)',
  assistantsSrc.includes("const ASSISTANT_UNLOCK_NOTICE_SEEN_KEY = 'mh_assistant_unlock_seen_v1';"));

// 実際に絞り込みを動かして、falseなら消え・trueなら出ることを確かめる
const releaseSrc = source.slice(source.indexOf('const RELEASE_FLAGS = {'), source.indexOf('const CHANGELOG_TYPES = ['));
const filterCtx = { console };
vm.createContext(filterCtx);
vm.runInContext(
  `${helpSrc}\n${changelogSrc}\nvar SPECIES_CHALLENGE_PUBLIC_RELEASE=false;\n${releaseSrc}\n`
  + 'globalThis.api={releasedForPlayers,HELP_CATEGORIES,CHANGELOG};', filterCtx);
const { releasedForPlayers, HELP_CATEGORIES, CHANGELOG } = filterCtx.api;
const speciesTopics = HELP_CATEGORIES.flatMap(c => (c.topics || []).filter(t => t.releaseFlag === 'speciesChallenge'));
const speciesEntries = CHANGELOG.filter(e => e.releaseFlag === 'speciesChallenge');
check('隠す対象のヘルプ項目が実際にある', speciesTopics.length > 0, `${speciesTopics.length}件`);
check('隠す対象の更新履歴が実際にある', speciesEntries.length > 0, `${speciesEntries.length}件`);
check('公開フラグがfalseなら隠れる',
  speciesTopics.every(t => releasedForPlayers(t) === false) && speciesEntries.every(e => releasedForPlayers(e) === false));
check('名札の無い項目はいままでどおり出る',
  HELP_CATEGORIES.every(c => releasedForPlayers(c) === true)
    && CHANGELOG.filter(e => !e.releaseFlag).every(e => releasedForPlayers(e) === true));
// 公開フラグを true にしたときだけ、同じ項目がそろって出る
const openCtx = { console };
vm.createContext(openCtx);
vm.runInContext(
  `${helpSrc}\n${changelogSrc}\nvar SPECIES_CHALLENGE_PUBLIC_RELEASE=true;\n${releaseSrc}\n`
  + 'globalThis.api={releasedForPlayers};', openCtx);
check('公開フラグをtrueにすると同時に出る',
  speciesTopics.every(t => openCtx.api.releasedForPlayers(t) === true)
    && speciesEntries.every(e => openCtx.api.releasedForPlayers(e) === true));

// ===== ③ チャレンジの記録を書き換えない =====
// 種族チャレンジの難易度idはチャレンジと同じ名前(Master など)なので、
// 除外を1か所でも忘れると mh_hs_Master などを上書きしてしまう
check('スコア送信は種族チャレンジ専用の処理だけを通る',
  source.includes('if (speciesChallengeBattleRunRef.current) return submitSpeciesChallengeScoreOnce();'));
const submitFn = source.slice(source.indexOf('const submitRunScoreOnce = async () => {'), source.indexOf('const submitSpeciesChallengeScoreOnce'));
check('種族チャレンジの判定は自己ベストを書く分岐より前にある',
  submitFn.indexOf('submitSpeciesChallengeScoreOnce()') < submitFn.indexOf('mh_hs_${difficulty}'));
check('最高到達WAVEへ入れない',
  source.includes('if (!forcedEnemyKey && !extremeRunRef.current && !debugBattleRef.current && !speciesChallengeBattleRunRef.current) {'));
// 条件はあとから増える(正式実装前のモンスターを連れた周回など)ので、
// 「種族チャレンジを外していること」だけを見る
check('挑戦回数へ入れない',
  /if \(!enemy && !extremeRunRef\.current && !debugBattleRef\.current && !speciesChallengeBattleRunRef\.current[^{]*\{/.test(source));
const recordFn = source.slice(source.indexOf('const recordClearOnce = async () => {'), source.indexOf('// はじめての敗北かどうか'));
check('クリア回数はチャレンジのキーへ入れない',
  recordFn.indexOf('if (speciesChallengeBattleRunRef.current) {') < recordFn.indexOf('mh_clears_${difficulty}'));
check('公開フラグが立つまで全国ランキングへ送らない',
  source.includes('mode !== BATTLE_MODE_SPECIES_CHALLENGE || SPECIES_CHALLENGE_PUBLIC_RELEASE')
    && source.includes('if (!SPECIES_CHALLENGE_PUBLIC_RELEASE) return;'));
// 保存キーは1つも増やしていない(進行は既存の mh_species_challenge_progress_v1 だけ)
const newKeys = [...new Set((source.match(/'mh_[a-z0-9_]+'/g) || []))]
  .filter(key => key.includes('species'));
check('種族チャレンジが使う保存キーは進行の1つだけ',
  newKeys.length === 1 && newKeys[0] === "'mh_species_challenge_progress_v1'", newKeys.join(', '));

console.log(failed === 0 ? '\n種族チャレンジ 解放条件・公開連動の確認: PASS' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
