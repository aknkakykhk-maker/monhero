// ティア表の決め方の切り替え(tactics-tier.js --method。2026-10-21)と、実戦の集計(player-battle-stats.js)を確かめる。
//
//   node tools/playbot/tier-method-check.js
//
//   ① --method current(既定)は、付けないときと1バイトも同じ(画面・md・json。更新時刻の行だけ除く)
//   ② overall は別のファイル(monster-tier-overall.md・tier-overall.json)にだけ書き、いまの表(monster-tier.md・tier.json)には触らない。
//      いまの表へ書こうとすると止まる。tier.html も作り直さない
//   ③ overall の md に「勇者モン向き・供モン向き」と「いまの表との差」が出る。--player-weight を付けると実戦の重みが混ざる
//   ④ 実戦の集計: --from-cache で作り直せる。名前・ブリーダーid・アイコンを持たない(cache も集計も)
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const TIER_DIR = path.join(ROOT, 'docs', 'playbot', 'reports', 'tier');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const run = (file, args) => spawnSync(process.execPath, [path.join(__dirname, file), ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const tier = (args) => run('tactics-tier.js', args);
const noTime = (t) => String(t).split('\n').filter((l) => !/^更新: /.test(l)).join('\n');
const noTimeJson = (t) => { const j = JSON.parse(t); delete j.更新; return JSON.stringify(j); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tier-method-'));
const read = (f) => fs.readFileSync(f, 'utf8');
const snap = () => Object.fromEntries(['monster-tier.md', 'tier.json'].map((f) => [f, read(path.join(TIER_DIR, f))]));
const before = snap();
const pageFile = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier.html');
const pageBefore = fs.existsSync(pageFile) ? read(pageFile) : null;

// ①
const a = tier([]), b = tier(['--method', 'current']);
check('① 画面の出力: 付けないときと --method current が同じ', a.status === 0 && b.status === 0 && noTime(a.stdout) === noTime(b.stdout) && a.stdout.length > 1000);
for (const [k, args] of [['a', []], ['b', ['--method', 'current']]]) {
  fs.copyFileSync(path.join(TIER_DIR, 'tier.json'), path.join(tmp, `${k}.json`));
  tier([...args, '--md', path.join(tmp, `${k}.md`), '--json', path.join(tmp, `${k}.json`)]);
}
check('① md も同じ', noTime(read(path.join(tmp, 'a.md'))) === noTime(read(path.join(tmp, 'b.md'))));
check('① json も同じ', noTimeJson(read(path.join(tmp, 'a.json'))) === noTimeJson(read(path.join(tmp, 'b.json'))));
check('① current の json に overall の項目が混ざらない', !/勇者モン向き|いまの表との差/.test(read(path.join(tmp, 'b.json'))));
// ②
const o = tier(['--method', 'overall', '--md', path.join(tmp, 'o.md'), '--json', path.join(tmp, 'o.json')]);
check('② overall が書ける', o.status === 0 && fs.existsSync(path.join(tmp, 'o.md')) && fs.existsSync(path.join(tmp, 'o.json')), o.stderr.slice(0, 200));
const stop1 = tier(['--method', 'overall', '--md', path.join(TIER_DIR, 'monster-tier.md')]);
const stop2 = tier(['--method', 'overall', '--md', path.join(tmp, 'x.md'), '--json', path.join(TIER_DIR, 'tier.json')]);
check('② overall はいまの表(monster-tier.md・tier.json)へ書こうとすると止まる', stop1.status !== 0 && stop2.status !== 0 && !fs.existsSync(path.join(tmp, 'x.md')));
const srcTier = read(path.join(__dirname, 'tactics-tier.js'));
check('② overall の既定の書き先は別のファイル', srcTier.includes("'monster-tier-overall.md'") && srcTier.includes("'tier-overall.json'"));
check('② overall は tier.html を作り直さない', srcTier.includes('if (jsonAt < 0 && !OVERALL)'));
const after = snap();
check('② いまの表は1バイトも変わっていない', Object.keys(before).every((f) => before[f] === after[f]) && (pageBefore === (fs.existsSync(pageFile) ? read(pageFile) : null)));
// ③
const om = read(path.join(tmp, 'o.md')), oj = JSON.parse(read(path.join(tmp, 'o.json')));
check('③ overall の md に「勇者モン向き・供モン向き」と「いまの表との差」', om.includes('## 勇者モン向き・供モン向き') && om.includes('## いまの表との差') && om.includes('overall の試し'));
check('③ overall の json に方法・差・向き', oj.決め方 && oj.決め方.方法 && oj.決め方.方法.名前 === 'overall' && Array.isArray(oj.いまの表との差) && oj.モンスター.every((m) => '勇者モン向き' in m && '供モン向き' in m));
const op = tier(['--method', 'overall', '--player-weight', '0.5', '--md', path.join(tmp, 'p.md'), '--json', path.join(tmp, 'p.json')]);
check('③ --player-weight で実戦の重みが混ざる', op.status === 0 && /実戦\(TacticsPro/.test(read(path.join(tmp, 'p.md'))) && JSON.parse(read(path.join(tmp, 'p.json'))).決め方.方法.実戦の重み === 0.5, op.stderr.slice(0, 200));
check('③ current では --player-weight を使わない', /const PLAYER_WEIGHT = OVERALL \?/.test(srcTier));
// ④
const cache = path.join(__dirname, 'player-battle-cache.json');
if (fs.existsSync(cache)) {
  const ps = run('player-battle-stats.js', ['--from-cache', '--out', path.join(tmp, 'ps.json')]);
  check('④ --from-cache で作り直せる', ps.status === 0 && fs.existsSync(path.join(tmp, 'ps.json')), ps.stderr.slice(0, 200));
  const rows = JSON.parse(read(cache)).rows || [];
  const keys = new Set(rows.flatMap((r) => Object.keys(r)));
  check('④ cache は決めた列だけ(名前・ブリーダーid・アイコンを持たない)', [...keys].every((k) => ['difficulty', 'hero', 'score', 'reached_wave', 'turns', 'party'].includes(k))
    && rows.every((r) => Array.isArray(r.party) && r.party.every((x) => x === null || typeof x === 'string')), [...keys].join(','));
  const outText = read(path.join(tmp, 'ps.json'));
  check('④ 集計に名前・ブリーダーidが出ない', !/user_name|breeder_id|icon|ブリーダー名/.test(outText));
} else check('④ cache がある(node tools/playbot/player-battle-stats.js で作る)', false);
const statsSrc = read(path.join(__dirname, 'player-battle-stats.js'));
check('④ 読むだけ(GET だけ。書き込みの道具を使わない)', /https\.get\(/.test(statsSrc) && !/method:\s*['"](POST|PATCH|DELETE|PUT)/i.test(statsSrc) && !/https\.request\(/.test(statsSrc));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
