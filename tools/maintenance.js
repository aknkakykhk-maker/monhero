// 定期メンテナンス(点検)の入口。「積み重なる不具合・ごみ・肥大」を早めに見つけるための1コマンド。
//
//   node tools/maintenance.js                 … 週次の点検(全領域の検査。重い数本だけ除く)+衛生チェック。約1時間
//   node tools/maintenance.js --full          … 月次の点検(全検査を1本も除かない)+深い衛生チェック。約1時間15分
//   node tools/maintenance.js --quick         … 手早い点検(必須+CI+文書の検査)+衛生チェック。1〜2分
//   node tools/maintenance.js --write         … 結果を docs/ops/maintenance/latest.md へ書く
//   node tools/maintenance.js --update-baseline … 衛生チェックの基準値(大きさ)を今の値で取り直す
//   node tools/maintenance.js --hygiene-only  … 検査は回さず、衛生チェックだけ(数秒)
//
// 【決めごと】
// ・直さない。見つけて報告するだけ(保存データ・譜面・公開物には一切触らない)。
// ・検査の中身は run-checks.js に任せる。ここは「何を・どの頻度で」回すかと、検査に出ない劣化の見張り。
// ・衛生チェックの NG は「約束(ワークフロー2つだけ等)の破れ」だけ。大きさの増加や孤立ファイルは
//   NG にせず「注意」として並べる(人が見て決める)。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/ops/maintenance');
const BASELINE = path.join(OUT_DIR, 'baseline.json');
const SKIP_FILE = path.join(OUT_DIR, 'monthly-only.txt'); // 週次が飛ばす重い検査(月次は回す)
const args = process.argv.slice(2);
const has = f => args.includes(f);

// 大きさを見張るファイル(CLAUDE.md ⑨ の「大きいファイル」+生成物)。増加が基準の15%を超えたら注意
const WATCH_FILES = [
  'monster-hero/src/parts/60-app.jsx',
  'monster-hero/data/rhythm-mode.js',
  'monster-hero/data/changelog.js',
  'monster-hero/game-system.compiled.js',
  'docs/spec/RHYTHM_MODE.md',
  'CLAUDE.md',
];
const WATCH_DIRS = ['monster-hero/images', 'monster-hero/audio', 'monster-hero/movies'];
const GROWTH_LIMIT = 0.15;

function dirSize(dir) {
  let total = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.isFile()) total += fs.statSync(p).size;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return total;
}
const mb = n => (n / 1048576).toFixed(2) + 'MB';

function measure() {
  const m = {};
  for (const f of WATCH_FILES) { const p = path.join(ROOT, f); if (fs.existsSync(p)) m[f] = fs.statSync(p).size; }
  for (const d of WATCH_DIRS) m[d + '/'] = dirSize(path.join(ROOT, d));
  return m;
}

function hygiene() {
  const ng = [], warn = [], info = [];

  // 1. ワークフローは2つだけ(AGENTS.md)
  const wfDir = path.join(ROOT, '.github/workflows');
  const wfs = fs.readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f)).sort();
  const allowed = ['build-and-check.yml', 'compiled-check.yml'];
  const extra = wfs.filter(f => !allowed.includes(f));
  if (extra.length) ng.push(`ワークフローが規定の2つを超えています: ${extra.join(', ')}(AGENTS.md「ワークフローは2つだけ」)`);
  for (const f of allowed.filter(a => wfs.includes(a))) {
    const t = fs.readFileSync(path.join(wfDir, f), 'utf8');
    if (/^\s*schedule:/m.test(t)) warn.push(`${f} に schedule: があります。定期実行はAGENTS.mdの方針と合うか確認してください`);
  }

  // 2. 大きさの増加(基準値との比較)
  const now = measure();
  if (fs.existsSync(BASELINE)) {
    let base = {};
    try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).sizes || {}; } catch (e) { warn.push('基準値(baseline.json)が壊れています。--update-baseline で取り直してください'); }
    for (const [k, v] of Object.entries(now)) {
      const b = base[k];
      if (!Number.isFinite(b) || b <= 0) { info.push(`${k}: 基準なし(${mb(v)})`); continue; }
      const g = (v - b) / b;
      if (g > GROWTH_LIMIT) warn.push(`${k} が基準から ${(g * 100).toFixed(0)}% 増えています(${mb(b)} → ${mb(v)})。分割・整理を検討`);
    }
  } else info.push('基準値がまだありません。--update-baseline で作ると増加を追えます');

  // 3. 参照されていない画像(参考。動的に組み立てるパスは拾えないので「候補」)
  try {
    const imgDir = path.join(ROOT, 'monster-hero/images');
    const imgs = [];
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(png|jpe?g|webp|gif)$/i.test(e.name)) imgs.push(p); } };
    walk(imgDir);
    const corpusFiles = [];
    // 素材そのものの置き場(monster-hero直下)だけ除く。data/images には画像のパスが書いてある
    const walkSrc = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['images', 'audio', 'movies', 'vendor'].some(n => p === path.join(ROOT, 'monster-hero', n))) walkSrc(p); } else if (/\.(js|jsx|json|html|css)$/.test(e.name) && !/compiled|tailwind/.test(e.name)) corpusFiles.push(p); } };
    walkSrc(path.join(ROOT, 'monster-hero'));
    const corpus = corpusFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
    // 意図して残している画像(元絵・将来用など)は docs/ops/maintenance/orphan-allow.txt に「パス(*可) # 理由」で登録する
    const allowFile = path.join(OUT_DIR, 'orphan-allow.txt');
    const allow = fs.existsSync(allowFile) ? fs.readFileSync(allowFile, 'utf8').split('\n').map(l => l.split('#')[0].trim()).filter(Boolean)
      .map(g => new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')) : [];
    const imgRoot = path.join(ROOT, 'monster-hero/images');
    // `images/<フォルダ>/<接頭辞>_${…}` のようにテンプレートで組み立てて読んでいる画像は、使っているとみなす
    const viaTemplate = p => {
      const rel = path.relative(imgRoot, p).split(path.sep).join('/');
      const dir = path.posix.dirname(rel), m = path.posix.basename(rel).match(/^([A-Za-z0-9]+)[_-]/);
      return !!m && corpus.includes(`images/${dir}/${m[1]}_\${`);
    };
    const orphans = imgs.filter(p => !corpus.includes(path.basename(p)) && !viaTemplate(p)
      && !allow.some(re => re.test(path.relative(imgRoot, p).split(path.sep).join('/'))));
    // 候補が無くなったら、前に書いた全件リストは古くなるので消す(月次のときだけ)
    if (has('--full') && !orphans.length) { try { fs.unlinkSync(path.join(OUT_DIR, 'orphan-images.txt')); } catch (e) { /* 無くてよい */ } }
    if (has('--full') && orphans.length) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, 'orphan-images.txt'), orphans.map(p => path.relative(path.join(ROOT, 'monster-hero/images'), p)).sort().join('\n') + '\n');
      info.push(`孤立画像の候補 ${orphans.length} 枚の全件を docs/ops/maintenance/orphan-images.txt へ書きました(月次)`);
    } else if (orphans.length) {
      info.push(`どこからも名前が出てこない画像の候補 ${orphans.length} 枚(動的なパスは拾えないため、消す前に確認): ` + orphans.slice(0, 8).map(p => path.relative(path.join(ROOT, 'monster-hero/images'), p)).join(', ') + (orphans.length > 8 ? ' …' : ''));
    }
  } catch (e) { warn.push('孤立画像の調査に失敗: ' + e.message); }

  // 4. 作業ブランチの溜まり(ローカルが知っている範囲)
  const br = spawnSync('git', ['branch', '-r'], { cwd: ROOT, encoding: 'utf8' });
  if (br.status === 0) {
    const names = br.stdout.split('\n').map(s => s.trim()).filter(s => s && !s.includes('->') && !/origin\/main$/.test(s));
    if (names.length > 10) warn.push(`リモートの作業ブランチが ${names.length} 本あります。マージ済みは削除(AGENTS.md「ブランチ」)`);
  }

  return { ng, warn, info, now };
}

function runChecks() {
  const out = path.join(OUT_DIR, '.last-run.json');
  const areas = has('--quick') ? 'required,ci,docs' : 'all';
  const extra = has('--full') || has('--quick') ? [] : ['--skip-file', SKIP_FILE];
  const r = spawnSync('node', [path.join(__dirname, 'run-checks.js'), '--area', areas, ...extra, '--json', out], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  let json = null;
  try { json = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { /* 書けなかった=検査自体が落ちた */ }
  try { fs.unlinkSync(out); } catch (e) { /* 無くてよい */ }
  return { json, status: r.status, tail: (r.stdout || '').split('\n').filter(Boolean).slice(-6) };
}

function jstNow() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' JST';
}

function main() {
  if (has('--update-baseline')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify({ at: jstNow(), sizes: measure() }, null, 2) + '\n');
    console.log('基準値を書きました: docs/ops/maintenance/baseline.json');
    return;
  }

  const lines = [];
  const say = s => lines.push(s);
  say(`# 定期メンテナンス点検 ${jstNow()}`);
  say('');
  say(`点検の種類: ${has('--hygiene-only') ? '衛生チェックのみ' : has('--full') ? '月次(全検査+深い衛生チェック)' : has('--quick') ? '手早い点検(必須+CI+文書)' : '週次(全領域・重い数本を除く)'}`);

  let failed = false;
  if (!has('--hygiene-only')) {
    const c = runChecks();
    say('\n## 検査');
    if (!c.json) {
      failed = true;
      say('- ❌ 検査の実行自体に失敗しました');
      for (const l of c.tail) say('  - ' + l);
    } else {
      const res = c.json.results;
      const n = s => res.filter(r => r.status === s).length;
      const bad = res.filter(r => !['OK', 'SKIP'].includes(r.status));
      say(`- 合計 ${res.length} 本 / OK ${n('OK')} / NG ${n('NG')} / TIMEOUT ${n('TIMEOUT')} / SKIP ${n('SKIP')} / MISSING ${n('MISSING')} / ${Math.round(c.json.totalSec)}秒`);
      if (n('SKIP')) say(`- SKIP は ${[...new Set(res.filter(r => r.status === 'SKIP').map(r => r.command))].length} 本(playwright / canvas が無い環境では実ブラウザ検査を飛ばします)`);
      for (const r of bad) {
        failed = true;
        say(`- ❌ ${r.status}: \`${r.command}\``);
        for (const l of (r.tail || []).slice(-4)) say('  - ' + String(l).slice(0, 200));
      }
    }
  }

  const h = hygiene();
  say('\n## 衛生チェック');
  if (h.ng.length) failed = true;
  for (const t of h.ng) say(`- ❌ ${t}`);
  for (const t of h.warn) say(`- ⚠️ ${t}`);
  for (const t of h.info) say(`- ℹ️ ${t}`);
  if (!h.ng.length && !h.warn.length) say('- 約束の破れ・急な肥大は見つかりませんでした');

  say('\n## 大きさ');
  for (const [k, v] of Object.entries(h.now)) say(`- ${k}: ${mb(v)}`);

  say(`\n## 総合\n\n${failed ? '❌ 対応が要るものがあります(上の ❌)' : '✅ 異常なし' + (h.warn.length ? '(⚠️ は人が見て判断)' : '')}`);

  const text = lines.join('\n') + '\n';
  console.log(text);
  if (has('--write')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'latest.md'), text);
    console.log('書きました: docs/ops/maintenance/latest.md');
  }
  process.exit(failed ? 1 : 0);
}

main();
