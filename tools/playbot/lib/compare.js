// 報告係の「前回との比べ方」。前回の結果と比べて、新しく出たもの・消えたもの・数字の動きを出す。
//
// 前回の結果は次の順で探す:
//   1. --compare <report.json のパス>
//   2. 同じ手元で前に回した結果(tools/out/playbot/<日時>/report.json。担当制になってからのもの)
//   3. リポジトリに置いた基準(tools/playbot/baseline.json。--save-baseline で書く)
// 毎日の定期実行は毎回まっさらな作業場で動くので、2 は無い。そのときは 3 と比べる。
const fs = require('fs');
const path = require('path');

const BASELINE = path.join(__dirname, '..', 'baseline.json');

// 同じ不具合を同じものと見なすための鍵。数字(px・秒・回数)は日によって揺れるので伏せる
const issueKey = (x) => `${x.roleId}|${x.kind}|${String(x.detail).replace(/\d+(\.\d+)?/g, '#').slice(0, 140)}`;

function findPrevious({ explicit, outRoot, currentDir }) {
  if (explicit) return fs.existsSync(explicit) ? { from: explicit, data: JSON.parse(fs.readFileSync(explicit, 'utf8')) } : null;
  const dirs = fs.existsSync(outRoot) ? fs.readdirSync(outRoot).filter((d) => path.join(outRoot, d) !== currentDir).sort().reverse() : [];
  for (const d of dirs) {
    const p = path.join(outRoot, d, 'report.json');
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data.format === 'roles') return { from: p, data };
    } catch { /* 書きかけの報告は飛ばす */ }
  }
  if (fs.existsSync(BASELINE)) return { from: BASELINE, data: JSON.parse(fs.readFileSync(BASELINE, 'utf8')) };
  return null;
}

// 比べるのは、両方で遊んだ担当だけ(--only で片方にしか無い担当は比べない)
function compare(current, previous) {
  if (!previous) return null;
  const prev = previous.data;
  const bothRoles = new Set(current.roles.map((r) => r.id).filter((id) => (prev.roles || []).some((r) => r.id === id)));
  const keysOf = (issues) => new Map((issues || []).filter((x) => x.level !== '既知' && bothRoles.has(x.roleId)).map((x) => [issueKey(x), x]));
  const now = keysOf(current.issues), before = keysOf(prev.issues);
  const appeared = [...now].filter(([k]) => !before.has(k)).map(([, x]) => x);
  const gone = [...before].filter(([k]) => !now.has(k)).map(([, x]) => x);
  const numbers = [];
  for (const [name, v] of Object.entries(current.numbers || {})) {
    const p = (prev.numbers || {})[name];
    if (Number.isFinite(v) && Number.isFinite(p) && v !== p) numbers.push({ name, before: p, now: v });
  }
  const failedNow = current.roles.filter((r) => !r.ok && bothRoles.has(r.id) && (prev.roles || []).some((q) => q.id === r.id && q.ok)).map((r) => r.name);
  return { from: previous.from, stamp: prev.stamp || '', appeared, gone, numbers, failedNow };
}

function saveBaseline(current) {
  const slim = {
    format: 'roles', stamp: current.stamp, seed: current.seed,
    roles: current.roles.map(({ id, name, ok }) => ({ id, name, ok })),
    numbers: current.numbers,
    issues: current.issues.map(({ roleId, kind, level, detail }) => ({ roleId, kind, level, detail: String(detail).slice(0, 200) })),
  };
  fs.writeFileSync(BASELINE, `${JSON.stringify(slim, null, 1)}\n`);
  return BASELINE;
}

module.exports = { findPrevious, compare, saveBaseline };
