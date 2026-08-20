const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 結果送信の入口からfetch相当のinsert、成功判定、ローカル退避までを一続きで確認する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const sourcePath = process.env.RANKING_SOURCE || path.join(root, 'monster-hero/src/game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('const persistRankingScore =');
const end = source.indexOf('const createRunId', start);
if (start < 0 || end < 0) throw new Error('全国保存の成功判定を含む共通送信経路を抽出できません');

const context = { console: { error() {} }, String, Error };
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nthis.persistRankingScore=persistRankingScore;', context);

const checks = [];
const check = (name, ok) => {
  checks.push(ok);
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
};
const makeRow = (difficulty, clearId) => ({
  difficulty, user_name: '統合テスト', hero: 'Mocchi',
  party: [{ name: 'Mocchi', emoji: '🍡', imgUrl: null, bondLevel: 12 }, null, null, null],
  score: 12345, level: 20, icon: 'default', clear_id: clearId,
});

(async () => {
  const posts = [];
  const stored = new Set();
  const insertScore = async row => {
    posts.push(JSON.parse(JSON.stringify(row)));
    stored.add(row.clear_id);
    return { saved: true, status: 201, body: '', row };
  };

  const normalRow = makeRow('Normal', 'normal-run-1');
  const normal = await context.persistRankingScore({ row: normalRow, insertScore, saveLocal: async () => { throw new Error('呼ばれてはいけません'); } });
  check('NormalクリアでPOSTが1回だけ発生', posts.length === 1);
  check('NormalのPOST payloadが全項目を保持', JSON.stringify(posts[0]) === JSON.stringify(normalRow));
  check('Normalの保存成功判定がtrue', normal.nationalSaved === true && normal.localSaved === false && normal.response.status === 201);
  check('Normalの新規レコードが保存対象', stored.has('normal-run-1'));

  await context.persistRankingScore({ row: makeRow('Normal', 'normal-run-2'), insertScore, saveLocal: async () => {} });
  check('Normalを2回プレイすると異なるclear_id', posts[0].clear_id !== posts[1].clear_id && stored.size === 2);

  for (const difficulty of ['Hard', 'Master']) {
    const result = await context.persistRankingScore({ row: makeRow(difficulty, `${difficulty}-run`), insertScore, saveLocal: async () => {} });
    check(`${difficulty}は従来どおり全国保存`, result.nationalSaved === true && posts.at(-1).difficulty === difficulty);
  }

  const beforeDuplicate = stored.size;
  await context.persistRankingScore({ row: makeRow('Normal', 'normal-run-1'), insertScore: async row => ({ saved: true, status: 201, body: '', row }), saveLocal: async () => {} });
  check('同一clear_id再送では重複しない', stored.size === beforeDuplicate);

  let fallbackCalls = 0;
  const postgrestError = Object.assign(new Error('insert 400: Normal payload rejected'), { status: 400, code: '23514', body: '{"code":"23514"}' });
  const hardSuccess = await context.persistRankingScore({ row: makeRow('Hard', 'compare-hard'), insertScore, saveLocal: async () => {} });
  const normalFailure = await context.persistRankingScore({ row: makeRow('Normal', 'compare-normal'), insertScore: async () => { throw postgrestError; }, saveLocal: async error => { fallbackCalls++; check('Normal失敗のHTTP/PostgREST情報をフォールバックへ渡す', error.status === 400 && error.code === '23514' && /23514/.test(error.body)); } });
  check('同じ送信経路でHard成功とNormal失敗を比較', hardSuccess.nationalSaved === true && normalFailure.nationalSaved === false);
  check('保存失敗時はローカル保存だけで全国成功扱いにしない', normalFailure.localSaved === true && fallbackCalls === 1 && normalFailure.error === postgrestError);

  const failed = checks.filter(ok => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} 項目OK`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
