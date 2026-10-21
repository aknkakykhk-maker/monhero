// ティア表の決め方の切り替え(tactics-tier.js --method。2026-10-21)と、実戦の集計(player-battle-stats.js)を確かめる。
//
//   node tools/playbot/tier-method-check.js
//
//   ① 既定は overall(2026-10-21 社長の決定で正式の決め方)。書き先は公開の表(monster-tier.md・tier.json)で、ページも作り直す
//   ② current(前の決め方)は比べる用。公開の表へ書こうとすると止まる。検査のあいだ公開の表は変えない
//   ③ overall の md・json に「勇者モン向き・供モン向き」「前の表との差」、供モンの回が10回未満の子は暫定(理由つき)、
//      決め方の文が新しい決め方、--player-weight で実戦の重みが混ざる。ページにも向きの節と詳しい欄が出る
//   ④ 実戦の集計: --from-cache で作り直せる。名前・ブリーダーid・アイコンを持たない(cache も集計も)。レイド(raid_jack_hits)も読む
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
const a = tier([]), b = tier(['--method', 'overall']);
check('① 既定は overall(正式の決め方)。付けないときと --method overall が同じ', a.status === 0 && b.status === 0 && noTime(a.stdout) === noTime(b.stdout) && a.stdout.length > 1000);
const srcTier = read(path.join(__dirname, 'tactics-tier.js'));
check('① 既定の書き先は公開の表(monster-tier.md・tier.json)で、ページ(tier.html)も作り直す', srcTier.includes("OVERALL ? 'monster-tier.md' : 'monster-tier-current.md'") && srcTier.includes("OVERALL ? 'tier.json' : 'tier-current.json'") && srcTier.includes('if (jsonAt < 0 && OVERALL)'));
// ②
const stop1 = tier(['--method', 'current', '--md', path.join(TIER_DIR, 'monster-tier.md')]);
const stop2 = tier(['--method', 'current', '--md', path.join(tmp, 'x.md'), '--json', path.join(TIER_DIR, 'tier.json')]);
check('② current(前の決め方)は公開の表へ書こうとすると止まる', stop1.status !== 0 && stop2.status !== 0 && !fs.existsSync(path.join(tmp, 'x.md')));
const cu = tier(['--method', 'current', '--md', path.join(tmp, 'c.md'), '--json', path.join(tmp, 'c.json')]);
check('② current は別のファイルになら書ける(比べる用)', cu.status === 0 && read(path.join(tmp, 'c.md')).includes('前の決め方 current'));
const after = snap();
check('② 検査のあいだ、公開の表は1バイトも変わっていない', Object.keys(before).every((f) => before[f] === after[f]) && (pageBefore === (fs.existsSync(pageFile) ? read(pageFile) : null)));
// ③
fs.copyFileSync(path.join(TIER_DIR, 'tier.json'), path.join(tmp, 'o.json'));
const o = tier(['--player-weight', '0.5', '--md', path.join(tmp, 'o.md'), '--json', path.join(tmp, 'o.json')]);
check('③ overall(実戦 0.5)が書ける', o.status === 0, o.stderr.slice(0, 200));
const om = read(path.join(tmp, 'o.md')), oj = JSON.parse(read(path.join(tmp, 'o.json')));
check('③ md に「勇者モン向き・供モン向き」と「前の表との差」', om.includes('## 勇者モン向き・供モン向き') && om.includes('## 前の表との差'));
check('③ json に方法・前の表との差・向き・供モンの回数', oj.決め方 && oj.決め方.方法 && oj.決め方.方法.名前 === 'overall' && oj.決め方.方法.実戦の重み === 0.5 && Array.isArray(oj.前の表との差)
  && oj.モンスター.every((m) => '勇者モン向き' in m && '供モン向き' in m && Number.isFinite(m.供モンの回数)));
check('③ 供モンとして入った回が10回未満の子は暫定(理由つき)', oj.モンスター.filter((m) => m.供モンの回数 < 10 && !['回数不足', '保留'].includes(m.総合)).every((m) => m.暫定 === true && /10回未満/.test(m.暫定の理由 || '')));
check('③ 決め方の文が新しい決め方', /全体で見る/.test(oj.決め方.文[0]) && /重み 0\.5/.test(oj.決め方.文[0]) && /10回未満/.test(oj.決め方.暫定));
check('③ 実戦の重みが混ざる', /実戦\(TacticsPro/.test(om) || oj.モンスター.some((m) => m.実戦));
check('③ current では --player-weight を使わない', /const PLAYER_WEIGHT = OVERALL \?/.test(srcTier));
const pageSrc = read(path.join(__dirname, 'tier-page.js'));
check('③ ページに「勇者モン向き・供モン向き」の節と、詳しい欄の向き・暫定の理由', pageSrc.includes('id="monsters-role"') && pageSrc.includes("['向き'") && pageSrc.includes("['暫定の理由'"));
// ④
const cache = path.join(__dirname, 'player-battle-cache.json');
if (fs.existsSync(cache)) {
  const ps = run('player-battle-stats.js', ['--from-cache', '--out', path.join(tmp, 'ps.json')]);
  check('④ --from-cache で作り直せる', ps.status === 0 && fs.existsSync(path.join(tmp, 'ps.json')), ps.stderr.slice(0, 200));
  const rows = JSON.parse(read(cache)).rows || [];
  const keys = new Set(rows.flatMap((r) => Object.keys(r)));
  check('④ cache は決めた列だけ(名前・ブリーダーid・アイコンを持たない)', [...keys].every((k) => ['difficulty', 'hero', 'score', 'reached_wave', 'turns', 'party'].includes(k))
    && rows.every((r) => Array.isArray(r.party) && r.party.every((x) => x === null || typeof x === 'string')), [...keys].join(','));
  const raidRows = JSON.parse(read(cache)).raidRows || [];
  const raidKeys = new Set(raidRows.flatMap((r) => Object.keys(r)));
  check('④ レイド(raid_jack_hits)も読んであり、hit_id・breeder_id を持たない', raidRows.length > 0 && [...raidKeys].every((k) => ['event_id', 'kind', 'tier', 'damage', 'defeated', 'source'].includes(k)), `${raidRows.length}行・${[...raidKeys].join(',')}`);
  const outText = read(path.join(tmp, 'ps.json'));
  const psOut = JSON.parse(outText);
  check('④ レイドの集計(段階ごとの回数・倒した回数・1回あたりのダメージ)が出る', !!(psOut.レイド && psOut.レイド.件数 && psOut.レイド.件数.数えた > 0 && JSON.stringify(psOut.レイド).includes('1回あたりのダメージ')));
  check('④ 集計に名前・ブリーダーidが出ない', !/user_name|breeder_id|icon|ブリーダー名/.test(outText));
} else check('④ cache がある(node tools/playbot/player-battle-stats.js で作る)', false);
const statsSrc = read(path.join(__dirname, 'player-battle-stats.js'));
check('④ 読むだけ(GET だけ。書き込みの道具を使わない)', /https\.get\(/.test(statsSrc) && !/method:\s*['"](POST|PATCH|DELETE|PUT)/i.test(statsSrc) && !/https\.request\(/.test(statsSrc));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
