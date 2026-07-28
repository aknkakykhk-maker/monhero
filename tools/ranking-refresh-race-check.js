// 保存前GETと保存後の強制GETの競合を、Normalのstate反映まで再現する回帰テスト。
const fs = require('fs');
const path = require('path');

const sourcePath = process.env.RANKING_SOURCE || path.join(__dirname, '..', 'monster-hero/src/game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('const loadOne = async (requestedDiff) => {');
const end = source.indexOf('\n    };\n    for (let i=0;', start);
if (start < 0 || end < 0) throw new Error('loadRankings内のloadOneを抽出できません');
const loadOneSource = source.slice(start, end);

const checks = [];
const check = (name, ok) => {
  checks.push(ok);
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
};
const invalidateAt = loadOneSource.indexOf('rankingLatestRequestRef.current.set(d, requestId)');
const awaitPendingAt = loadOneSource.indexOf('await pending');
check('forceは30秒キャッシュ判定を通過する', /if \(!force && Date\.now\(\) - fetchedAt < 30000\) return/.test(loadOneSource));
check('保存前GETを待つ前に失効させる', invalidateAt >= 0 && awaitPendingAt >= 0 && invalidateAt < awaitPendingAt);
check('待機中に後発forceが来たら重複GETしない', loadOneSource.includes('rankingLatestRequestRef.current.get(d) !== requestId) return;'));
check('先発finallyが後発GETをMapから消さない', loadOneSource.includes('rankingRequestsRef.current.get(requestKey) === request'));

// 上の本番制御条件を使った通信/stateモデル。POST成功時点から、旧応答、新応答、描画までを追う。
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const latest = new Map();
const inFlight = new Map();
const localRankings = { Normal: [], Hard: [{ userName: 'Hard既存' }], Master: [{ userName: 'Master既存' }] };
let sequence = 0;
let normalGets = 0;
const apply = (difficulty, requestId, rows) => {
  if (latest.get(difficulty) !== requestId) return;
  localRankings[difficulty] = rows;
};

(async () => {
  const oldResponse = deferred();
  const oldId = `Normal-${++sequence}`;
  latest.set('Normal', oldId);
  const oldGet = oldResponse.promise.then(rows => apply('Normal', oldId, rows));
  inFlight.set('Normal:score', oldGet);

  // Normal POST成功。force=trueの本番順序どおり、pending待機より先に旧GETを失効する。
  const refreshId = `Normal-${++sequence}`;
  latest.set('Normal', refreshId);
  let forcedGetStarted = false;
  const refresh = (async () => {
    await inFlight.get('Normal:score');
    if (latest.get('Normal') !== refreshId) return;
    forcedGetStarted = true;
    normalGets++;
    const rows = [{ userName: '新規Normal', score: 999 }]; // Supabase GET応答
    check('GET結果に新規Normal行が含まれる', rows.some(row => row.userName === '新規Normal'));
    apply('Normal', refreshId, rows);
  })();

  oldResponse.resolve([{ userName: '保存前Normal', score: 100 }]);
  await oldGet;
  check('古いGETが後から返ってもstateを上書きしない', localRankings.Normal[0]?.userName !== '保存前Normal');
  await refresh;
  check('Normal保存成功直後の強制GETが1回発生', forcedGetStarted && normalGets === 1);
  check('新規行をlocalRankings.Normalへ反映', localRankings.Normal[0]?.userName === '新規Normal');

  // 更新ボタンもforce=trueで同じ経路を通り、最新結果を反映する。
  const refreshButtonId = `Normal-${++sequence}`;
  latest.set('Normal', refreshButtonId);
  normalGets++;
  apply('Normal', refreshButtonId, [{ userName: '更新後Normal', score: 1000 }]);
  check('更新ボタンでも最新Normalが表示される', localRankings.Normal[0]?.userName === '更新後Normal');
  check('Hard/Masterのstateキーを変更しない', localRankings.Hard[0]?.userName === 'Hard既存' && localRankings.Master[0]?.userName === 'Master既存');

  const failed = checks.filter(ok => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} 項目OK`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
