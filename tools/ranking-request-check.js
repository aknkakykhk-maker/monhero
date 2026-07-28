// ランキングのData APIリクエストを通信スタブで確認する。
// Normal/Hard/Masterの保存値、旧表記・clear_id=NULLの取得、clear_id重複防止を対象にする。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const start = source.indexOf("const SUPABASE_URL =");
const end = source.indexOf("const createRunId =", start);
if (start < 0 || end < 0) throw new Error('ランキング通信コードを抽出できません');

const requests = [];
const storedClearIds = new Set();
const rows = [
  { difficulty: 'normal', user_name: '旧Normal', score: 100, clear_id: null },
  { difficulty: 'Hard', user_name: '旧Hard', score: 200, clear_id: null },
  { difficulty: 'MASTER', user_name: '旧Master', score: 300, clear_id: null },
];
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 409 ? 'Conflict' : 'OK',
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
});
const context = {
  DIFFICULTY_SETTINGS: { Normal: {}, Hard: {}, Master: {}, GrandMaster: {} },
  AbortController, URL, Date, JSON, Object, String, Boolean, Number, Error, TypeError,
  setTimeout, clearTimeout,
  console: { info() {}, error() {}, warn() {} },
  fetch: async (url, init = {}) => {
    requests.push({ url, init });
    if (init.method === 'POST') {
      const row = JSON.parse(init.body);
      if (storedClearIds.has(row.clear_id)) return response('', 201);
      storedClearIds.add(row.clear_id);
      rows.push(row);
      return response('', 201);
    }
    const parsed = new URL(url);
    const value = (parsed.searchParams.get('difficulty') || '').replace(/^ilike\./, '').toLowerCase();
    return response(rows.filter(row => row.difficulty.toLowerCase() === value));
  },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nthis.api={normalizeRankingDifficulty,sbFetchRankings,sbInsertScore};', context);

const checks = [];
const check = (name, ok) => { checks.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}`); };

(async () => {
  for (const difficulty of ['Normal', 'Hard', 'Master']) {
    const clearId = `check-${difficulty}`;
    await context.api.sbInsertScore({ difficulty: difficulty.toLowerCase(), user_name: '新規', score: 999, clear_id: clearId });
    await context.api.sbInsertScore({ difficulty, user_name: '重複', score: 999, clear_id: clearId });
    const fetched = await context.api.sbFetchRankings(difficulty);
    check(`${difficulty}: INSERTは正規keyを保存`, rows.some(row => row.clear_id === clearId && row.difficulty === difficulty));
    check(`${difficulty}: clear_id=NULLの旧データを取得`, fetched.some(row => row.clear_id === null));
    check(`${difficulty}: clear_id付きの新規データを取得`, fetched.some(row => row.clear_id === clearId));
    check(`${difficulty}: 同一clear_idを1件だけ保存`, rows.filter(row => row.clear_id === clearId).length === 1);
  }
  const posts = requests.filter(request => request.init.method === 'POST');
  for (const difficulty of ['Normal', 'Hard', 'Master']) {
    const payload = posts.map(request => JSON.parse(request.init.body)).find(row => row.clear_id === `check-${difficulty}`);
    check(`${difficulty}: INSERT payloadのdifficultyが正規key`, payload?.difficulty === difficulty);
  }
  check('全INSERTがon_conflict=clear_idを指定', posts.every(request => request.url.includes('?on_conflict=clear_id')));
  check('全INSERTがignore-duplicatesを指定', posts.every(request => request.init.headers.Prefer.includes('resolution=ignore-duplicates')));
  const gets = requests.filter(request => !request.init.method);
  check('全SELECTがclear_idを表示フィルターに使用しない', gets.every(request => !new URL(request.url).searchParams.has('clear_id')));
  check('全SELECTがdifficultyのilike完全一致', gets.every(request => /^ilike\.[^%*_]+$/i.test(new URL(request.url).searchParams.get('difficulty') || '')));
  check('全SELECTがscore=NULLを有効記録より後ろにする', gets.every(request => new URL(request.url).searchParams.get('order') === 'score.desc.nullslast'));

  const failed = checks.filter(ok => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} 項目OK`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
