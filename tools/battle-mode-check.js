// バトルモード(チャレンジ／クイック)を検証する。
//
//   ① 報酬: クイックだけ経験値とダイヤが1.5倍。スコア倍率は難易度のまま
//   ② 記録: クイックはランキングへ送らず、チャレンジの自己ベストを上書きしない
//   ③ 成長: WAVEごとに味方だけ10%上昇し、ライフとガッツが全回復する
//   ④ 伴モン: クイックは固有技の選択画面を出さず、ランダムで1上げる(上限を超えない)
//   ⑤ 画面: モードのタブ・説明・ランキングボタン・バトル中のモード表示
//   ⑥ BGM: モードごとの通常戦とデュラハン戦を個別に設定できる
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiledRaw = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const compiled = compiledRaw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));

// --- 計算は本番の定義をそのまま動かして確かめる ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  grab(source, 'const WAVE_XP_TABLE =', 'const xpForLevel ='),
  grab(source, 'const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  'globalThis.__m={BATTLE_MODES,battleModeInfo,normalizeBattleMode,isQuickMode,QUICK_REWARD_MULT,QUICK_GROWTH_MULT,'
  + 'waveXpGain,waveGoldGain,xpForWavesCleared,goldForWavesCleared,xpForWavesClearedInMode,goldForWavesClearedInMode,'
  + 'waveXpGainInMode,waveGoldGainInMode,bestScoreKey,bestWaveKey,clearCountKey,DIFFICULTY_SETTINGS,BATTLE_MODE_QUICK,BATTLE_MODE_CHALLENGE};',
].join('\n'), ctx);
const m = ctx.__m;

// --- ① 報酬 ---
check('モードは2種類', m.BATTLE_MODES.length === 2 && m.BATTLE_MODES.map(x => x.id).join(',') === 'challenge,quick');
check('知らない値はチャレンジ扱い', m.normalizeBattleMode('nope') === 'challenge' && m.normalizeBattleMode(undefined) === 'challenge');
check('クイックの倍率は1.5', m.QUICK_REWARD_MULT === 1.5);
for (const diff of ['Normal', 'Hard', 'Expert']) {
  const s = m.DIFFICULTY_SETTINGS[diff];
  const baseXp = m.xpForWavesCleared(10, s.score), quickXp = m.xpForWavesClearedInMode(10, s.score, 'quick');
  const baseGold = m.goldForWavesCleared(10, s.gold), quickGold = m.goldForWavesClearedInMode(10, s.gold, 'quick');
  check(`${diff}: クイックの経験値がおよそ1.5倍`, quickXp > baseXp * 1.45 && quickXp <= baseXp * 1.5, `${baseXp} → ${quickXp}`);
  check(`${diff}: クイックのダイヤがおよそ1.5倍`, quickGold > baseGold * 1.45 && quickGold <= baseGold * 1.5, `${baseGold} → ${quickGold}`);
  check(`${diff}: チャレンジは従来どおり`, m.xpForWavesClearedInMode(10, s.score, 'challenge') === baseXp && m.goldForWavesClearedInMode(10, s.gold, 'challenge') === baseGold);
}
// WAVEごとの内訳の合計と、リザルトの合計が一致する(表示と実際がずれない)
const sumOfWaves = (mult, mode, fn) => { let sum = 0; for (let w = 1; w <= 10; w++) sum += fn(w, mult, mode); return sum; };
check('WAVEごとの内訳の合計がリザルトの合計と一致する',
  sumOfWaves(3.0, 'quick', m.waveXpGainInMode) === m.xpForWavesClearedInMode(10, 3.0, 'quick')
    && sumOfWaves(1.5, 'quick', m.waveGoldGainInMode) === m.goldForWavesClearedInMode(10, 1.5, 'quick'));
// スコアはモードで変えない。スコア加算の実処理がモードを見ていないことを確かめる
const scoreBlock = grab(source, 'const finalRoundScore', 'setWaveHistory(prev =>');
check('スコアの計算はモードを見ない', scoreBlock.length > 0 && !scoreBlock.includes('runMode') && !/QUICK_REWARD_MULT/.test(scoreBlock));
check('実処理が経験値・ダイヤ・絆経験値にモード倍率を使う',
  has('const breederXpGain = xpForWavesClearedInMode(wavesCleared, scoreMult, runMode);')
    && has('const goldGain = goldForWavesClearedInMode(wavesCleared, goldMult, runMode);')
    && has('const gain = xpForWavesClearedInMode(wavesCleared, scoreMult, runMode);'));
check('WAVEごとの内訳もモード倍率を使う', has('xpGain: waveXpGainInMode(wave, scoreMultiplier, runMode)') && has('goldGain: waveGoldGainInMode(wave, goldMultiplier, runMode)'));

// --- ② 記録 ---
check('保存キーがモードごとに分かれている',
  m.bestScoreKey('challenge', 'Normal') === 'mh_hs_Normal' && m.bestScoreKey('quick', 'Normal') === 'mh_quick_hs_Normal'
    && m.bestWaveKey('quick', 'Hard') === 'mh_quick_highest_wave_Hard' && m.clearCountKey('quick', 'Hard') === 'mh_quick_clears_Hard');
check('チャレンジの保存キーは従来のまま',
  m.bestWaveKey('challenge', 'Hard') === 'mh_highest_wave_Hard' && m.clearCountKey('challenge', 'Hard') === 'mh_clears_Hard');
const submitBlock = grab(source, 'const submitRunScoreOnce = async', 'const handleSaveName');
check('クイックはランキングへ送信しない', /if \(isQuickMode\(runMode\)\) \{[\s\S]*?return;\s*\}/.test(submitBlock) && submitBlock.indexOf('isQuickMode(runMode)') < submitBlock.indexOf('submitLocalScore'));
check('クイックはチャレンジの自己ベストを上書きしない',
  submitBlock.includes('bestScoreKey(BATTLE_MODE_QUICK, difficulty)') && submitBlock.includes('setQuickHighScores'));
check('クリア回数もモードごとに分ける', has('await storeSet(clearCountKey(BATTLE_MODE_QUICK, difficulty), nextQuick, false);'));
check('最高到達WAVEもモードごとに分ける', has('storeSet(bestWaveKey(BATTLE_MODE_QUICK,difficulty),w,false);') && has('storeSet(bestWaveKey(BATTLE_MODE_CHALLENGE,difficulty),w,false);'));
check('起動時にクイックの記録も読み込む', has('quickScores[d] = await storeGet(bestScoreKey(BATTLE_MODE_QUICK, d), 0, false);'));

// --- ③ WAVEごとの自動成長 ---
check('成長倍率は10%', m.QUICK_GROWTH_MULT === 1.10);
check('クイックだけ強化フェーズを飛ばす', has('} else if (isQuickMode(runMode)) {') && has('beginQuickGrowth();'));
const growthBlock = grab(source, 'const beginQuickGrowth = () => {', 'const finishQuickGrowth');
check('味方の全ステータスを10%上げる',
  ['hp: quickGrowStat(before.hp)', 'atk: quickGrowStat(before.atk)', 'def: quickGrowStat(before.def)', 'guts: quickGrowStat(before.guts)'].every(t => growthBlock.includes(t)));
check('端数は既存の強化と同じくfloor', has('const quickGrowStat = (value) => Math.floor((Number(value) || 0) * QUICK_GROWTH_MULT);'));
check('ライフとガッツを全回復する', growthBlock.includes('setHp(after.hp); setGuts(after.guts); // 全回復'));
check('表示する値と実際に入れる値が同じ', growthBlock.includes('setMaxHp(after.hp); setAtk(after.atk); setDef(after.def); setMaxGuts(after.guts);') && growthBlock.includes("{ label: 'ライフ', before: before.hp, after: after.hp }"));
check('敵には成長も回復もかけない', !growthBlock.includes('setEnemy') && !growthBlock.includes('enemy.'));
check('クイックでは教えの選択画面へ進まない', !grab(source, 'const finishQuickGrowth', 'const rollQuickUniqueUpgrade').includes("setGameState('PICK_TEACHING')"));
check('成長のあとに伴モン合流のWAVEなら選択画面へ', grab(source, 'const finishQuickGrowth', 'const rollQuickUniqueUpgrade').includes("setGameState('PICK_ALLY')"));

// --- ④ 伴モンと固有技 ---
const rollBlock = grab(source, 'const rollQuickUniqueUpgrade = (uniques)', 'const finishQuickJoin');
check('上限に達した固有技は抽選から外す', rollBlock.includes('(u.evoLevel || 0) < MAX_UNIQUE_SKILL_LEVEL'));
check('上げられる技が無ければ何もしない', rollBlock.includes('if (candidates.length === 0) return null;'));
check('上限を超えない', rollBlock.includes('Math.min(MAX_UNIQUE_SKILL_LEVEL, before + 1)'));
check('ランダムで1体選ぶ', rollBlock.includes('candidates[Math.floor(Math.random() * candidates.length)]'));
check('クイックは固有技の選択画面を出さない', has('setGameState(\'QUICK_JOIN\');') && !grab(source, 'if (isQuickMode(runMode)) {\n        // クイックモードは固有技', 'setGameState(\'QUICK_JOIN\')').includes('UPGRADE_SKILL'));
check('加入のステータス変化と固有技上昇を1画面で出す',
  has("{quickJoin.name}が仲間になった！") && has('固有技アップ！') && has('Lv.{quickJoin.unique.before} → '));

// --- ⑤ 画面 ---
// 演出は自動で進めず、必ずタップを待つ
check('演出はタップするまで進まない',
  has('const QuickStepScreen = ({ onDone, accent =') && !has('setTimeout(finish') && has("onClick={finish}") && has('タップして次へ'));
check('連打しても1回だけ進む', has('if (doneRef.current) return; doneRef.current = true; onDone();') && has("if (quickAdvanceRef.current === 'growth') return;"));
check('モードのタブがある', has('{BATTLE_MODES.map(mode=>{') && has('setBattleMode(mode.id);setBattleMenuTab(\'difficulty\');'));
check('タブの横に説明の「？」がある', has('aria-label={`${mode.label}の説明`}') && has('setModeInfoId(mode.id)'));
// 説明の各項目は [アイコン, 見出し, 本文] の3つ組
check('モード説明に必要な項目がそろっている',
  m.BATTLE_MODES.every(mode => mode.points.length >= 6 && mode.points.every(p => p.length === 3 && p[0] && p[1] && p[2])));
check('クイックの説明に自動成長と1.5倍がある',
  m.battleModeInfo('quick').points.some(p => p[2].includes('10%')) && m.battleModeInfo('quick').points.some(p => p[1].includes('1.5倍')));
check('チャレンジの説明にランキング対象と書いてある', m.battleModeInfo('challenge').points[0][1] === 'ランキング対象');
check('説明の見出しにアイコンが付く', has('{mode.points.map(([icon,title,text])=>(') && has('{mode.label}とは？'));
check('モードを変えても選択中の難易度は変えない', !/setBattleMode\(mode\.id\);[^}]*setDifficulty/.test(source));
check('横スライドの難易度選択を維持している', has('snap-x snap-mandatory') && has("touchAction:'pan-x pinch-zoom'") && has('前の難易度') && has('次の難易度'));
check('難易度カードからWAVE1の敵情報を外した', !has('createBattleEnemy(1,key)') && !has('<small className="text-amber-300 font-black">WAVE 1</small>'));
check('カードに自己ベスト・到達WAVE・倍率・全WAVE詳細が残っている',
  has('自己ベストスコア') && has('最高到達 WAVE') && has('全WAVE詳細') && has('この難易度で挑戦'));
// クイックはスコアを競わないので、自己ベストスコアもスコア倍率も出さない
check('クイックはスコア関連を出さない',
  has("const rateCells=(setting)=>quick") && has("? [['敵強度',`×${setting.power}`,false],['経験値',bonusLabel(setting.score),true],['ダイヤ',bonusLabel(setting.gold),true]]")
    && has(': <div className="mt-1.5 rounded-xl bg-black/45 px-2.5 py-1.5"><small className="text-[8px] text-slate-400 font-black">自己ベストスコア</small>'));
check('クイックでも最高到達WAVEは出す', has('<small className="text-[9px] text-slate-400 font-black">最高到達</small>'));
// クイックはスコアを競わないので、バトル中もリザルトもスコアを出さない
check('バトル中もクイックはスコアを出さない', has('{!isQuickMode(runMode)&&<div className="text-[10px] font-mono font-black text-amber-500 flex items-center gap-1 uppercase tracking-tighter mr-1"><Award size={10}/> {score.toLocaleString()}</div>}'));
check('最終リザルト3画面のスコア枠をクイックでは出さない',
  (source.match(/\{!isQuickMode\(runMode\)&&<div className="[^"]*"><div className="text-(?:5xl|3xl) font-mono font-black text-white">\{score\.toLocaleString\(\)\}<\/div><\/div>\}/g) || []).length === 3,
  `${(source.match(/\{!isQuickMode\(runMode\)&&<div className="[^"]*"><div className="text-(?:5xl|3xl) font-mono font-black text-white">\{score\.toLocaleString\(\)\}<\/div><\/div>\}/g) || []).length}か所`);
check('WAVEリザルトのスコア内訳をクイックでは出さない',
  has('{/* スコアの内訳。クイックモードはスコアを競わないので出さない */}') && has('{!isQuickMode(runMode)&&(<>'));
check('WAVE別ログのスコア列もクイックでは出さない',
  has('{!summary.quickMode&&<span className="text-white font-mono font-bold truncate">スコア +{w.roundScore.toLocaleString()}</span>}')
    && has('setFinalRewardSummary({ quickMode: isQuickMode(runMode), breederXpGain, breederLevelBefore'));
check('スコア以外(経験値・ダイヤ・絆)はクイックでも出す',
  has('WAVE別ログ') && has('XP+{w.xpGain.toLocaleString()}') && has('💎+{w.goldGain.toLocaleString()}'));
check('チャレンジはスコア倍率を出す', has(": [['敵強度',`×${setting.power}`,false],['スコア',`×${setting.score}`,false],['ダイヤ',`×${setting.gold}`,false]]"));
check('クイックは経験値・ダイヤだけ1.5倍と分かる表示', has('経験値・ダイヤのみ1.5倍'));
// 見出しが2行に折り返さないよう、倍率は3枠までにして折り返しも禁じる
check('倍率の枠は3つで1行に収める', has('<div className="grid grid-cols-3 gap-1 mt-1.5">') && has('text-center text-[8px] text-slate-400 whitespace-nowrap'));
check('ランキングボタンはチャレンジのときだけ出す', has("{!quick&&<button onClick={()=>{setBattleMenuTab('ranking')") && has('🏆 ランキングを見る（チャレンジモード）'));
// 横に長すぎたので難易度カードと同じ幅に揃える。クイックでも同じ高さの場所を空け、
// ランキングボタンの有無で助手コメントの位置がずれないようにする
check('ランキングボタンは難易度カードと同じ幅', has('className="w-[82%] min-h-[40px] rounded-2xl bg-slate-800 border border-indigo-400/40'));
check('助手コメントの位置がモードでずれない', has('<div className="shrink-0 flex justify-center min-h-[40px] mb-1.5">'));
check('カードの下はランキング→助手コメントの順', source.indexOf('🏆 ランキングを見る（チャレンジモード）') < source.indexOf("scene={quick?'battleQuick':'battleChallenge'}"));
check('助手コメントは既存の共通UIを使う', has("<AssistantBubble key={battleMode} scene={quick?'battleQuick':'battleChallenge'}") && assistantsSrc.includes('battleChallenge:') && assistantsSrc.includes('battleQuick:'));
check('挑戦を始めるときにモードを固定する', has('setDifficulty(key);setRunMode(battleMode);'));
check('バトル中にモード名と難易度を出す', has('{battleModeInfo(runMode).short} / {DIFFICULTY_SETTINGS[safeDifficulty]?.label||safeDifficulty}'));
check('ヘルプにバトルモードの説明がある', helpSrc.includes("id: 'battle-modes'") && helpSrc.includes('QUICK_GROWTH:') && helpSrc.includes('QUICK_JOIN:'));

// --- ⑥ BGM ---
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  const flat = code.replace(/\s+/g, '');
  check(`${label}: 通常戦の曲をモードで切り替える`, flat.includes('returnquick?bgmArrangement.quickBattle:bgmArrangement.battle'));
  check(`${label}: デュラハン戦の曲もモードで切り替える`, flat.includes("enemyId==='Durahan')returnquick?bgmArrangement.quickDullahan:bgmArrangement.dullahan"));
}
check('モード別BGMの既定値がある',
  has("quickBattle:'ichika_battle'") && has("dullahan:'original_dullahan'") && has("quickDullahan:'original_dullahan'"));
check('新しいBGM項目は既存設定が無くても既定値で補われる', has('const normalizeBgmArrangement = value => Object.fromEntries(Object.entries(DEFAULT_BGM_ARRANGEMENT)'));
check('BGMアレンジ画面に4項目そろっている',
  has("['battle','チャレンジモード BGM']") && has("['quickBattle','クイックモード BGM']")
    && has("['dullahan','チャレンジ デュラハン戦 BGM']") && has("['quickDullahan','クイック デュラハン戦 BGM']"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
