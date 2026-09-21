const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスバトルの中のモード(タクティクスチャレンジ / 種族チャレンジ / プロ)と、
// その中の「極限」タブを見る。設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md §14.2
//
// 【なぜ道具にするか】
// このモードの記録は、まちがえると**チャレンジの自己ベスト・クリア回数を上書きする**。
// 実際、器(idと接頭辞)だけ作って読み書きする処理が無かったあいだ、タクティクスで遊ぶと
//   ・自己ベストが mh_hs_<難易度> へ書かれる
//   ・クリア回数が mh_clears_<難易度> へ積まれる(＝極限・種族の解放まで進む)
//   ・全国ランキングもチャレンジの行へ送られる
// という状態だった(2026-09-20に発見)。一度書き換えると元に戻せないので、ここで機械的に押さえる。
//
// 見るのは次の4つ。
//   ① モードidと判定の並び(盤面はタクティクス・性格はプロ/種族)
//   ② 記録の置き場とランキングのキーが、既存モードと1つも重ならないこと
//   ③ 記録を書く3か所(自己ベスト・クリア回数・最高到達WAVE)が、必ずタクティクス用の枝を通ること
//   ④ 極限が「同じ画面のタブ」として並び、解放はタクティクスの記録だけで決まること
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};

// ===== 本体の定義をそのまま動かす =====
const sandbox = {
  Object, Number, Array, Math, console,
  DIFFICULTY_SETTINGS: {}, RANGE_LABELS: ['零', '近', '中', '遠'],
  // 種族チャレンジの血統一覧はデータ側。ここでは使わないので空で足りる
  speciesChallengeLineages: () => [],
  EXTREME_MODE: { id: 'extreme' },
};
vm.createContext(sandbox);
vm.runInContext([
  slice('const BATTLE_MODE_CHALLENGE =', 'const isQuickDifficultyCleared'),
  // 公開フラグの見方(battleModePlayable / battleModeComingSoon)と、
  // ランキングへ送るかの判定(modeHasRanking)
  // カードに出す文言を見るので、既存5モードの定義も持ち込む
  slice('const BATTLE_MODES = [', '// ===== バトルの仕組み(モード選択の1つ上) ====='),
  slice('// ===== バトルの仕組み(モード選択の1つ上) =====', '// 極限チャレンジは通常の3モードとは別に'),
  slice('const modeHasRanking =', 'const modeBondAction'),
  slice('const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  slice('const normalizeBattleDifficulty = (value)', '// ヘルプの中に出す「実データから作る表」'),
  slice('const PRO_RANKING_PREFIX =', '// 通信、state、リクエスト管理、画面参照で共有する唯一のランキング内部キー'),
  'globalThis.api={BATTLE_MODE_CHALLENGE,BATTLE_MODE_QUICK,BATTLE_MODE_PRO,BATTLE_MODE_SPECIES_CHALLENGE,'
  + 'BATTLE_MODE_TACTICS,BATTLE_MODE_TACTICS_SPECIES,BATTLE_MODE_TACTICS_PRO,'
  + 'TACTICS_BATTLE_MODES,TACTICS_SCORE_MODES,TACTICS_DIFFICULTY_IDS,'
  + 'isTacticsMode,isProMode,isQuickMode,isSpeciesChallengeMode,modeKeyPrefix,'
  + 'bestScoreKey,bestWaveKey,clearCountKey,isTacticsDifficultyUnlocked,isExtremeDifficultyId,'
  + 'rankingDifficultyForMode,rankingDifficultyBase,normalizeRankingDifficulty,RANKING_DIFFICULTY_KEYS,'
  + 'TACTICS_PRO_RANKING_PREFIX,TACTICS_PRO_BETA_SUFFIX,tacticsProRankingPrefix,'
  + 'battleModePlayable,battleModeComingSoon,battleSystemBeta,modeHasRanking,'
  + 'SPECIES_CHALLENGE_PROGRESS_KEY,TACTICS_SPECIES_CHALLENGE_PROGRESS_KEY,speciesChallengeProgressKeyOf,'
  + 'speciesChallengeRunMode,DIFFICULTY_SETTINGS,'
  + 'TACTICS_MODE,TACTICS_SPECIES_MODE,TACTICS_PRO_MODE,BATTLE_MODES,SPECIES_CHALLENGE_MODE};',
].join('\n'), sandbox);
const api = sandbox.api;

// ===== ① モードidと判定 =====
check('タクティクス側のモードは3つ',
  api.TACTICS_BATTLE_MODES.length === 3
    && api.TACTICS_BATTLE_MODES.join(',') === 'tactics,tacticsSpecies,tacticsPro',
  api.TACTICS_BATTLE_MODES.join(' / '));
check('盤面の判定(isTacticsMode)は3つすべてに効く',
  api.TACTICS_BATTLE_MODES.every(id => api.isTacticsMode(id))
    && !api.isTacticsMode(api.BATTLE_MODE_CHALLENGE) && !api.isTacticsMode(api.BATTLE_MODE_PRO)
    && !api.isTacticsMode(api.BATTLE_MODE_SPECIES_CHALLENGE));
// 性格(ベースモン限定・種族しばり)はクラシックと同じ分岐を使い回す
check('タクティクスプロはプロ扱い', api.isProMode(api.BATTLE_MODE_TACTICS_PRO)
  && !api.isProMode(api.BATTLE_MODE_TACTICS) && !api.isProMode(api.BATTLE_MODE_TACTICS_SPECIES));
check('タクティクス種族は種族扱い', api.isSpeciesChallengeMode(api.BATTLE_MODE_TACTICS_SPECIES)
  && api.isSpeciesChallengeMode(api.BATTLE_MODE_SPECIES_CHALLENGE)
  && !api.isSpeciesChallengeMode(api.BATTLE_MODE_TACTICS));
check('タクティクスはクイック扱いにしない',
  api.TACTICS_BATTLE_MODES.every(id => !api.isQuickMode(id)));
check('難易度は通常9＋極限5の14段階',
  api.TACTICS_DIFFICULTY_IDS.length === Object.keys(api.DIFFICULTY_SETTINGS).length + 5
    && api.TACTICS_DIFFICULTY_IDS.filter(id => api.isExtremeDifficultyId(id)).length === 5,
  `${api.TACTICS_DIFFICULTY_IDS.length}段階`);

// ===== ② 記録の置き場とランキングのキー =====
// ★ここが混ざると、チャレンジの自己ベスト・クリア回数を上書きする
check('記録の接頭辞が5モードで別々',
  api.modeKeyPrefix(api.BATTLE_MODE_CHALLENGE) === 'mh_'
    && api.modeKeyPrefix(api.BATTLE_MODE_QUICK) === 'mh_quick_'
    && api.modeKeyPrefix(api.BATTLE_MODE_PRO) === 'mh_pro_'
    && api.modeKeyPrefix(api.BATTLE_MODE_TACTICS) === 'mh_tactics_'
    && api.modeKeyPrefix(api.BATTLE_MODE_TACTICS_PRO) === 'mh_tactics_pro_',
  ['challenge', 'quick', 'pro', 'tactics', 'tacticsPro'].map(id => api.modeKeyPrefix(id)).join(' / '));
{
  const keys = [];
  for (const mode of [api.BATTLE_MODE_CHALLENGE, api.BATTLE_MODE_QUICK, api.BATTLE_MODE_PRO]) {
    for (const d of Object.keys(api.DIFFICULTY_SETTINGS)) {
      keys.push(api.bestScoreKey(mode, d), api.bestWaveKey(mode, d), api.clearCountKey(mode, d));
    }
  }
  for (const mode of api.TACTICS_SCORE_MODES) for (const d of api.TACTICS_DIFFICULTY_IDS) {
    keys.push(api.bestScoreKey(mode, d), api.bestWaveKey(mode, d), api.clearCountKey(mode, d));
  }
  check('保存キーが1つも重複しない', new Set(keys).size === keys.length, `${keys.length}件`);
}
check('種族チャレンジの進行データも別のキー',
  api.speciesChallengeProgressKeyOf(api.BATTLE_MODE_SPECIES_CHALLENGE) === api.SPECIES_CHALLENGE_PROGRESS_KEY
    && api.speciesChallengeProgressKeyOf(api.BATTLE_MODE_TACTICS_SPECIES) === api.TACTICS_SPECIES_CHALLENGE_PROGRESS_KEY
    && api.SPECIES_CHALLENGE_PROGRESS_KEY !== api.TACTICS_SPECIES_CHALLENGE_PROGRESS_KEY,
  api.TACTICS_SPECIES_CHALLENGE_PROGRESS_KEY);
check('モードを持たない古い周回はクラシックの種族チャレンジ扱い',
  api.speciesChallengeRunMode({}) === api.BATTLE_MODE_SPECIES_CHALLENGE
    && api.speciesChallengeRunMode(null) === api.BATTLE_MODE_SPECIES_CHALLENGE
    && api.speciesChallengeRunMode({ mode: api.BATTLE_MODE_TACTICS_SPECIES }) === api.BATTLE_MODE_TACTICS_SPECIES);
// ★TacticsPro は Tactics より先に判定しないと Tactics + 'ProHard' になる
// ★タクティクスプロの送り先は公開の段階で変わる(β版は末尾に Beta)。
//   ここでは「ほかのモードと混ざらないこと」だけを見る
check('ランキングのキーが5モードで別々',
  api.TACTICS_DIFFICULTY_IDS.every(d => api.rankingDifficultyForMode(api.BATTLE_MODE_TACTICS, d) === `Tactics${d}`
    && api.rankingDifficultyForMode(api.BATTLE_MODE_TACTICS_PRO, d) === `${api.tacticsProRankingPrefix()}${d}`
    && api.rankingDifficultyForMode(api.BATTLE_MODE_TACTICS_PRO, d)
      !== api.rankingDifficultyForMode(api.BATTLE_MODE_TACTICS, d))
    && Object.keys(api.DIFFICULTY_SETTINGS).every(d => api.rankingDifficultyForMode(api.BATTLE_MODE_CHALLENGE, d) === d
      && api.rankingDifficultyForMode(api.BATTLE_MODE_PRO, d) === `Pro${d}`));
check('ランキングのキーから素の難易度へ戻せる',
  api.TACTICS_DIFFICULTY_IDS.every(d => api.rankingDifficultyBase(`Tactics${d}`) === d
    && api.rankingDifficultyBase(`TacticsPro${d}`) === d));
check('タクティクスのキーがランキングの一覧に入っている',
  api.TACTICS_DIFFICULTY_IDS.every(d => api.normalizeRankingDifficulty(`Tactics${d}`) === `Tactics${d}`
    && api.normalizeRankingDifficulty(`TacticsPro${d}`) === `TacticsPro${d}`
    && api.normalizeRankingDifficulty(`TacticsProBeta${d}`) === `TacticsProBeta${d}`));

// ===== ②-2 β版（タクティクスプロだけ先に出す） =====
// 2026-09-20 ユーザー指示。β版のスコアは**別の行**へ送り、本公開でキーを切り替える。
// 行は消さない(モンヒロビートの週間ランキングが週IDで区切るのと同じ考え方)ので、
// 本番の順位は空から始まり、消す作業も要らない
check('β版の送り先は本公開と別の行',
  api.TACTICS_PRO_BETA_SUFFIX === 'Beta'
    && api.tacticsProRankingPrefix() === `${api.TACTICS_PRO_RANKING_PREFIX}${api.TACTICS_PRO_BETA_SUFFIX}`,
  api.tacticsProRankingPrefix());
check('β版と本公開の行が重ならない',
  api.TACTICS_DIFFICULTY_IDS.every(d => api.rankingDifficultyForMode(api.BATTLE_MODE_TACTICS_PRO, d)
    === `${api.TACTICS_PRO_RANKING_PREFIX}${api.TACTICS_PRO_BETA_SUFFIX}${d}`));
// ★TacticsProBeta → TacticsPro → Tactics の順で落とさないと 'BetaHard' や 'ProHard' が残る
check('β版のキーからも素の難易度へ戻せる',
  api.TACTICS_DIFFICULTY_IDS.every(d => api.rankingDifficultyBase(`TacticsProBeta${d}`) === d));
// 公開の前後でどちらのキーも「知らない難易度」にならないこと(移行の途中で落ちない)
check('本公開ぶんとβ版ぶんの両方が一覧にある',
  api.TACTICS_DIFFICULTY_IDS.every(d => api.RANKING_DIFFICULTY_KEYS.includes(`TacticsPro${d}`)
    && api.RANKING_DIFFICULTY_KEYS.includes(`TacticsProBeta${d}`)));
// 公開フラグの見方は battleModePlayable の1か所。ランキングへ送るかもそこから決まる
check('いまはβ版も本公開もOFF',
  api.battleModePlayable(api.BATTLE_MODE_TACTICS_PRO) === false
    && api.battleModePlayable(api.BATTLE_MODE_TACTICS) === false
    && api.modeHasRanking(api.BATTLE_MODE_TACTICS_PRO) === false);
check('デバッグからは遊べるが、ランキングへは送らない',
  api.battleModePlayable(api.BATTLE_MODE_TACTICS_PRO, { debugBattle: true }) === true
    && api.modeHasRanking(api.BATTLE_MODE_TACTICS_PRO) === false);

// ===== ③ 記録を書く3か所が、必ずタクティクス用の枝を通る =====
// 難易度は1か所(tacticsRecordDifficulty)で決める。極限で遊ぶと difficulty が 'Normal' に
// 置き換わるので、取り違えると別の難易度の記録を書き換えてしまう
check('記録に使う難易度を1か所で決めている',
  has('const tacticsRecordDifficulty = () => (extremeRunRef.current ? extremeDifficulty : difficulty);'));
check('自己ベストは専用の送信処理だけを通る',
  has('if (isTacticsMode(runMode)) return submitTacticsScoreOnce();')
    && has('const submitTacticsScoreOnce = async () => {')
    && has('await storeSet(bestScoreKey(runMode, diff), score, false);'));
{
  // ★順番が大事。極限チャレンジの枝より前に置かないと mh_extreme_hs_* を書き換える
  const block = slice('const submitRunScoreOnce = async', 'const handleSaveName');
  check('自己ベストのタクティクスの枝は極限チャレンジより前',
    block.indexOf('submitTacticsScoreOnce()') >= 0
      && block.indexOf('submitTacticsScoreOnce()') < block.indexOf('if (extremeRunRef.current)'));
  check('タクティクスはチャレンジの mh_hs_ へ落ちない',
    block.indexOf('submitTacticsScoreOnce()') < block.indexOf('storeSet(`mh_hs_${difficulty}`'));
}
{
  const block = slice('const recordClearOnce = async', 'はじめての敗北かどうか');
  check('クリア回数のタクティクスの枝も極限チャレンジより前',
    block.indexOf('if (isTacticsMode(runMode)) {') >= 0
      && block.indexOf('if (isTacticsMode(runMode)) {') < block.indexOf('if (extremeRunRef.current) {'));
  check('クリア回数は専用キーへ積む',
    block.includes('await storeSet(clearCountKey(runMode, tacticsDiff), nextTactics, false);')
      && block.indexOf('if (isTacticsMode(runMode)) {') < block.indexOf('storeSet(`mh_clears_${difficulty}`'));
}
check('最高到達WAVEも専用キーへ',
  has('storeSet(bestWaveKey(runMode,tacticsDiff),w,false);')
    // 極限で遊んでも記録する(極限チャレンジは記録しないので、条件をタクティクスだけ緩める)
    && has('&& (!extremeRunRef.current || isTacticsMode(runMode))) {'));
check('タクティクスの極限は「極限チャレンジで遊んだ」に数えない',
  has("addAssistantBond(extremeRunRef.current && !isTacticsMode(runMode) ? 'extreme' : modeBondAction(runMode));"));

// ===== ④ 極限は「同じ画面のタブ」 =====
check('難易度の一覧はタクティクス用の14段階から作る',
  has('const tacticsDiff=isTacticsMode(battleMode);')
    && has("?(species?SPECIES_CHALLENGE_DIFFICULTY_IDS:TACTICS_DIFFICULTY_IDS).map(id=>[id,speciesSetting(id)])"));
check('極限タブは専用画面へ飛ばさない',
  has('const challengeExtremeTab=!species&&!quick&&!tacticsDiff&&!isProMode(battleMode);'));
check('極限を選んだら極限ランとして始める',
  has('const tacticsExtreme=tacticsDiff&&isExtremeDifficultyId(key);')
    && has("setDifficulty(tacticsExtreme?'Normal':key);if(tacticsExtreme)setExtremeDifficulty(key);")
    && has('extremeRunRef.current=tacticsExtreme;'));
check('ランキング画面もタクティクスの極限を Tactics* の行から読む',
  has('const keyOf = (diff) => rankingDifficultyKey(isExtremeDifficultyId(diff) && !isTacticsMode(mode)'));
// 解放はタクティクスの記録だけで決める。クラシックの進み具合を混ぜない
check('通常の9段階は最初から挑める',
  Object.keys(api.DIFFICULTY_SETTINGS).every(d => api.isTacticsDifficultyUnlocked(d, {})));
check('極限の入口はタクティクスで Master 以上を1回クリアで開く',
  !api.isTacticsDifficultyUnlocked('EXTREME', {})
    && !api.isTacticsDifficultyUnlocked('EXTREME', { Expert: 3 })
    && api.isTacticsDifficultyUnlocked('EXTREME', { Master: 1 })
    && api.isTacticsDifficultyUnlocked('EXTREME', { Legend: 1 }));
check('極限は1つ前をクリアすると次が開く',
  !api.isTacticsDifficultyUnlocked('NIGHTMARE', { Master: 1 })
    && api.isTacticsDifficultyUnlocked('NIGHTMARE', { Master: 1, EXTREME: 1 })
    && !api.isTacticsDifficultyUnlocked('CHAOS', { EXTREME: 1 })
    && api.isTacticsDifficultyUnlocked('CHAOS', { NIGHTMARE: 1 }));
check('知らない難易度は開けない',
  !api.isTacticsDifficultyUnlocked('GOD', { INFINITY: 5 })
    && !api.isTacticsDifficultyUnlocked('nope', { Master: 1 }));
check('壊れた記録が来ても落ちない',
  api.isTacticsDifficultyUnlocked('Normal', null) === true
    && api.isTacticsDifficultyUnlocked('EXTREME', 'x') === false
    && api.isTacticsDifficultyUnlocked('EXTREME', { Master: 'x' }) === false);

// ---- ⑤ モード選択のカードに出す文字 ----
// ★売りの3行は「同じ仕組みの中の3モードを見比べる」ためのもの。3モードすべてにあること
//   (敵の予告・技の使い分け・ステータスの持ち方)は、仕組みの入口カードと「詳しいルール」の担当。
//   2026-09-21 にユーザーから写真つきで「文字列が悪い」と指摘された。
//   そのとき並んでいたのは「敵が技を使い分ける。予告を読んで受ける」「敵の予告を読んで、誰を守るかを決める」で、
//   どちらもタクティクスの3モードすべてに当てはまる＝見比べる役に立たない行だった。
const TACTICS_CARDS = [api.TACTICS_MODE, api.TACTICS_SPECIES_MODE, api.TACTICS_PRO_MODE];
const SHARED_WORDS = ['予告', '技を使い分け', '1体ずつライフ', '誰を守る'];
for (const mode of TACTICS_CARDS) {
  const text = [mode.tagline, ...mode.highlights.map(h => h[1])].join(' / ');
  const hit = SHARED_WORDS.filter(w => text.includes(w));
  check(`${mode.label}: 売りに仕組み全体の話を書かない`, hit.length === 0, hit.join('・'));
  check(`${mode.label}: 売りは3行`, Array.isArray(mode.highlights) && mode.highlights.length === 3,
    String(mode.highlights && mode.highlights.length));
}
// ★カードの見出しは短い名前(cardLabel)。長い名前のままだとカードの中(内幅約176px)で2行に折り返す。
//   クラシック側と同じ名前にそろえて、上から見比べられるようにする
check('カードの名前はクラシック側とそろえる',
  api.TACTICS_MODE.cardLabel === api.BATTLE_MODES.find(m => m.id === api.BATTLE_MODE_CHALLENGE).label
    && api.TACTICS_SPECIES_MODE.cardLabel === api.SPECIES_CHALLENGE_MODE.label
    && api.TACTICS_PRO_MODE.cardLabel === api.BATTLE_MODES.find(m => m.id === api.BATTLE_MODE_PRO).label,
  TACTICS_CARDS.map(m => m.cardLabel || 'なし').join(' / '));
check('カードの見出しは短い名前のほうを出す', has('{m.emoji} {m.cardLabel||m.label}'));
// ★合算か1体ずつかが分かれるのはライフだけではない(ちから・丈夫さ・ガッツも同じ)。
//   2026-09-21 ユーザー指摘「ステータスがそもそも合算か単体じゃない？」
for (const mode of TACTICS_CARDS) {
  const point = (mode.points || []).find(p => /ステータス|ライフ/.test(p[1]));
  check(`${mode.label}: ステータスの持ち方を「ライフ」だけで説明しない`,
    !!point && point[1].includes('ステータス') && point[2].includes('ちから') && point[2].includes('丈夫さ'),
    point ? point[1] : 'その節が無い');
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
