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
// 担当ごとの基準(2026-10-07〜)。毎晩は班ごとに別のセッションが基準を書くので、1つのファイルだと
// 班どうしで上書き・ぶつかりが起きる。担当ごとに分ければ、班は自分の担当のファイルしか触らない
const BASELINE_DIR = path.join(__dirname, '..', 'baseline');

// 担当ごとの基準を1つにまとめて読む。担当ごとのファイルが無い担当は、古い baseline.json から補う
function loadBaseline() {
  const old = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
  const files = fs.existsSync(BASELINE_DIR) ? fs.readdirSync(BASELINE_DIR).filter((f) => f.endsWith('.json')) : [];
  if (!files.length) return old ? { from: BASELINE, data: old } : null;
  const merged = { format: 'roles', stamp: '', roles: [], numbers: {}, issues: [] };
  const have = new Set();
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, f), 'utf8'));
    (d.roles || []).forEach((r) => { merged.roles.push(r); have.add(r.id); });
    Object.assign(merged.numbers, d.numbers || {});
    merged.issues.push(...(d.issues || []));
    if (d.stamp > merged.stamp) merged.stamp = d.stamp;
  }
  if (old) {
    (old.roles || []).filter((r) => !have.has(r.id)).forEach((r) => merged.roles.push(r));
    const oldNames = new Set((old.roles || []).filter((r) => !have.has(r.id)).map((r) => r.name));
    for (const [k, v] of Object.entries(old.numbers || {})) if ([...oldNames].some((n) => k.startsWith(`${n}:`))) merged.numbers[k] = v;
    merged.issues.push(...(old.issues || []).filter((x) => !have.has(x.roleId)));
  }
  return { from: BASELINE_DIR, data: merged };
}

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
  return loadBaseline();
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

// 今回動かした担当のぶんだけを、担当ごとのファイル(baseline/<担当id>.json)へ書く。
// ほかの担当のファイルには触らない(班ごとに書いても消し合わない)
function saveBaseline(current) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  for (const { id, name, ok } of current.roles) {
    const numbers = Object.fromEntries(Object.entries(current.numbers || {}).filter(([k]) => k.startsWith(`${name}:`)));
    const slim = {
      format: 'roles', stamp: current.stamp, seed: current.seed,
      roles: [{ id, name, ok }],
      numbers,
      issues: current.issues.filter((x) => x.roleId === id)
        .map(({ roleId, kind, level, detail }) => ({ roleId, kind, level, detail: String(detail).slice(0, 200) })),
    };
    fs.writeFileSync(path.join(BASELINE_DIR, `${id}.json`), `${JSON.stringify(slim, null, 1)}\n`);
  }
  return BASELINE_DIR;
}

module.exports = { findPrevious, compare, saveBaseline };
