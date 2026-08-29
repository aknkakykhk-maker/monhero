// 種族チャレンジの「全種族」ランキング(種族を問わない全国ランキング)を確認する。
//
//   node tools/ranking/species-all-ranking-check.js
//
// 【この仕組みの要点】
// 「全種族」は rankings テーブルへ保存する値ではなく、取得のときだけ使う読み取り専用の
// 合成キー(Species-all-<難易度id>)。実体はこれまでどおり Species-<血統id>-<難易度id> の行で、
// 取りにいくときにその難易度の全種族ぶんのキーへ展開し、1回のリクエストにまとめる。
//
//   ・新しい行も列も作らないので、これまでに送られた記録がそのまま並ぶ
//   ・送信処理は一切変えない(全種族キーへ書き込む場所が無いこと自体を検査する)
//   ・前方一致(ilike)ではなく実在キーの完全一致の並び(in)なので、
//     他モードの行(Normal / ProNormal / ExtremeEXTREME)が紛れ込まない
//
// ここでは実装から関数を切り出して実際に動かし、組み立てたURLまで確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 実装からキーまわりの関数を切り出して動かす ---
const grab = (startNeedle, endNeedle) => {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  if (start < 0 || end < 0) return '';
  return source.slice(start, end);
};
// 血統は data/lineages.js の正本をそのまま読む(検査側で並びを持ち直さない)
const lineagesSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/lineages.js'), 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext([
  lineagesSrc,
  // 難易度の並びと、キーを組み立てる関数だけを本体から持ってくる
  // (SPECIES_CHALLENGE_DIFFICULTY_IDS は通常14難易度＋極限から作られるので、その2つも一緒に)
  grab('const DIFFICULTY_SETTINGS = {', 'const SPECIES_CHALLENGE_PROGRESS_KEY'),
  // speciesChallengeLineages は dexMainLineages 経由なので、ここでは血統の正本から直接作る
  `const speciesChallengeLineages = () => Object.values(MONSTER_LINEAGES).filter(l => l && l.id);`,
  grab('const SPECIES_RANKING_PREFIX =', 'const normalizeExtremeDifficulty'),
  `globalThis.__x = { SPECIES_CHALLENGE_DIFFICULTY_IDS, speciesChallengeLineages,
     speciesChallengeRankingDifficulty, parseSpeciesChallengeRankingDifficulty,
     speciesChallengeAllRankingDifficulty, parseSpeciesChallengeAllRankingDifficulty,
     speciesChallengeAllRankingMembers, SPECIES_RANKING_ALL_ID,
     SPECIES_RANK_TAB_ALL, SPECIES_RANK_TAB_SELF_BEST };`,
].join('\n'), ctx);
const x = ctx.__x;
check('キーまわりの関数を実装から取り出せる',
  typeof x.speciesChallengeAllRankingDifficulty === 'function'
  && typeof x.parseSpeciesChallengeAllRankingDifficulty === 'function'
  && typeof x.speciesChallengeAllRankingMembers === 'function');

const lineages = x.speciesChallengeLineages();
const DIFFS = x.SPECIES_CHALLENGE_DIFFICULTY_IDS;
check('血統と難易度を読めている', lineages.length > 0 && DIFFS.length === 14,
  `${lineages.length}血統 / ${DIFFS.length}難易度`);
// 'all' が実在の血統idと衝突していないこと。ここが崩れると全種族と個別種族を取り違える
check("血統idに 'all' が存在しない(合成キーと衝突しない)",
  !lineages.some(l => String(l.id).toLowerCase() === x.SPECIES_RANKING_ALL_ID));
check('画面のタブidは血統idと重ならない',
  !lineages.some(l => l.id === x.SPECIES_RANK_TAB_ALL || l.id === x.SPECIES_RANK_TAB_SELF_BEST),
  `${x.SPECIES_RANK_TAB_ALL} / ${x.SPECIES_RANK_TAB_SELF_BEST}`);

check('全種族キーを組み立てられる', x.speciesChallengeAllRankingDifficulty('Beginner') === 'Species-all-Beginner');
check('知らない難易度では組み立てない', x.speciesChallengeAllRankingDifficulty('NoSuch') === null);
check('全種族キーを読み戻せる', x.parseSpeciesChallengeAllRankingDifficulty('Species-all-Beginner')?.difficultyId === 'Beginner');
check('種族別キーは全種族として読まない',
  x.parseSpeciesChallengeAllRankingDifficulty('Species-pixie-Beginner') === null);
check('全種族キーは種族別として読まない',
  x.parseSpeciesChallengeRankingDifficulty('Species-all-Beginner') === null);
check('他モードのキーはどちらにも当たらない',
  ['Normal', 'ProNormal', 'ExtremeEXTREME', 'Master'].every(key =>
    x.parseSpeciesChallengeAllRankingDifficulty(key) === null && x.parseSpeciesChallengeRankingDifficulty(key) === null));

// --- ② 展開先が「その難易度の全種族ぶん」であること ---
const members = x.speciesChallengeAllRankingMembers('Beginner');
check('全種族は実在する種族別キーへ展開される',
  members.length === lineages.length && members.every(key => x.parseSpeciesChallengeRankingDifficulty(key) !== null),
  `${members.length}件`);
check('展開先はすべて同じ難易度',
  members.every(key => x.parseSpeciesChallengeRankingDifficulty(key).difficultyId === 'Beginner'));
check('展開先に重複が無い', new Set(members).size === members.length);
check('展開先に他モードのキーが混ざらない',
  members.every(key => key.startsWith('Species-')) && !members.includes('Species-all-Beginner'));
check('14難易度すべてで展開できる',
  DIFFS.every(id => x.speciesChallengeAllRankingMembers(id).length === lineages.length));

// --- ③ 実際に組み立てるURLの形 ---
// sbFetchRankings の絞り込み条件だけを取り出して、そのまま動かす
const filterSrc = grab('const speciesAllDifficulty = normalizedDifficulty == null', '// 展開先が1件も無いときに');
check('絞り込み条件を実装から取り出せる', filterSrc.includes('difficulty=in.('));
const buildFilter = new Function('normalizedDifficulty', 'parseSpeciesChallengeAllRankingDifficulty', 'speciesChallengeAllRankingMembers',
  `${filterSrc}\nreturn difficultyFilter;`);
const allFilter = buildFilter('Species-all-Beginner', x.parseSpeciesChallengeAllRankingDifficulty, x.speciesChallengeAllRankingMembers);
const oneFilter = buildFilter('Species-pixie-Beginner', x.parseSpeciesChallengeAllRankingDifficulty, x.speciesChallengeAllRankingMembers);
const plainFilter = buildFilter('Normal', x.parseSpeciesChallengeAllRankingDifficulty, x.speciesChallengeAllRankingMembers);
check('全種族は in.(...) で1回のリクエストにまとめる', allFilter.startsWith('&difficulty=in.('), allFilter.slice(0, 60));
check('種族別・他モードはこれまでどおり eq のまま',
  oneFilter === '&difficulty=eq.Species-pixie-Beginner' && plainFilter === '&difficulty=eq.Normal',
  `${oneFilter} / ${plainFilter}`);
// 実際にURLとして解釈したとき、狙ったキーの一覧に戻ること
const parsed = new URLSearchParams(allFilter.replace(/^&/, ''));
const inValue = parsed.get('difficulty');
check('符号化を戻すと in.(...) の形になる', /^in\.\(.+\)$/.test(String(inValue)), String(inValue).slice(0, 60));
const decodedKeys = String(inValue).replace(/^in\.\(/, '').replace(/\)$/, '').split(',').map(v => v.replace(/^"|"$/g, ''));
check('展開したキーがそのまま並ぶ', decodedKeys.join('|') === members.join('|'), `${decodedKeys.length}件`);
check('値は二重引用符で囲まれている', String(inValue).includes('%22') || String(inValue).includes('"'));

// --- ④ 保存(送信)側は一切変えていない ---
// 全種族キーを書き込む場所があってはいけない。送信は種族別キーのみ
const submitFn = grab('const submitSpeciesChallengeScoreOnce = async () => {', 'const handleSaveName');
check('送信は種族別キーのままで、全種族キーへ書き込まない',
  submitFn.includes('rankingDifficultyForMode(BATTLE_MODE_SPECIES_CHALLENGE, run.difficultyId, run.speciesId)')
  && !submitFn.includes('speciesChallengeAllRankingDifficulty'));
check('全種族キーを組み立てるのは取得と画面だけ',
  !/storeSet\([^)]*speciesChallengeAllRankingDifficulty/.test(source)
  && !/persistRankingScore[\s\S]{0,400}speciesChallengeAllRankingDifficulty/.test(source));
check('rankingsテーブルの列は増やしていない',
  source.includes("const RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon';"));

// --- ⑤ 画面 ---
const rankBody = grab('const renderSpeciesChallengeRecordBody = () => {', 'const renderBreederRankingBody =');
check('タブは 全種族 → 種族別 → 自己ベスト の順に並ぶ',
  rankBody.includes("{ id:SPECIES_RANK_TAB_ALL, label:'全種族' }")
  && rankBody.includes("{ id:SPECIES_RANK_TAB_SELF_BEST, label:'自己ベスト' }")
  && rankBody.indexOf('SPECIES_RANK_TAB_ALL, label') < rankBody.indexOf('...lineages.map(l => ({ id:l.id')
  && rankBody.indexOf('...lineages.map(l => ({ id:l.id') < rankBody.indexOf('SPECIES_RANK_TAB_SELF_BEST, label'));
check('取りにいくキーの決め方はタブと難易度で共通の1か所',
  rankBody.includes('const nationalKeyFor = (tabId, difficultyId) =>')
  && rankBody.includes('const key=nationalKeyFor(tab.id, diffId); if (key) loadRankings(key);')
  && rankBody.includes('const key=nationalKeyFor(speciesFilter, id); if (key) loadRankings(key);'));
check('自己ベストのときだけ通信しない',
  rankBody.includes('tabId === SPECIES_RANK_TAB_SELF_BEST ? null'));
const openRecords = grab('const openSpeciesChallengeRecords =', 'const openModeScoreRanking =');
check('種族を指定せずに開くと全種族から始まる',
  openRecords.includes('SPECIES_CHALLENGE_PUBLIC_RELEASE ? SPECIES_RANK_TAB_ALL : SPECIES_RANK_TAB_SELF_BEST'));
check('難易度カードから開いたときはその種族のまま',
  openRecords.includes('speciesChallengeLineages().some(lineage=>lineage.id===speciesId)'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
