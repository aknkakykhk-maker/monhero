#!/usr/bin/env node
// モンサクの見た目の API 点検を「1画面だけ」「PR の差分の画面だけ」で回す入り口(r1119-022 社長「点検系は極力 API で」)。
// 撮る(偽のデータでページの中だけ・本番へは送らない・デバッグの合言葉は使わない)→ 機械の見つけ方 → API(Opus・kind ui-check)→ 表、までを1つで回す。
//
//   node tools/browser/monsuc-visual-pr.js --scenes msx:S2P              1画面だけ(名札は visual-api-monsuc.js の LABELS・--list で一覧)
//   node tools/browser/monsuc-visual-pr.js --changed [--base origin/main] PR の差分のファイルから場面を選ぶ(下の FILE_SCENES)
//   --dry-run   撮って見積りだけ(送らない) / --batch  半額のバッチで送る(既定はその場で返す message) / --sizes base(既定は縦だけ。横は base,land,s568)
//   合言葉は環境のネットワークの秘密で付く(ANALYSIS_GATEWAY_TOKEN=proxy を道具が自分で付ける)。値はどこにも書かない
// 結果: tools/out/visual/monsuc-pr-<日時>/api/api-findings.md(git に入らない)。使った額は画面に出る
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

// 部品のファイル(名前の一部)→ 撮る場面(道具:名札)。代表の画面だけ(全部は visual-api-monsuc.js の通し点検で)
const FILE_SCENES = [
  [/success-start|monsuc-scenario|monsuc-teampick|monsuc-birth|monsuc-intro/, ['msx:S0', 'msx:S1', 'msx:S1D', 'msx:S2', 'msx:S2P', 'msx:S2E', 'msx:S3', 'msx:S4', 'msx:S5', 'msx:S6', 'msx:IN']],
  [/success-main|monsuc-(actcrew|actfx|trainfx|gaugefx|issa|tevent|evres|awake|kifx|itemfx|best3)|success-fx/, ['msx:M1', 'msx:M3', 'msx:T1', 'msx:K3', 'msx:R1b', 'msx:E1', 'msx:E2', 'msx:TV1', 'msx:KI', 'msx:I1', 'msx:P1']],
  [/monsuc-dex/, ['msx:DX1', 'msx:DX4', 'home:monsuc-dex']],
  [/monsuc-basemon/, ['msx:HB1', 'msx:HB2', 'home:monsuc-basemon']],
  [/monsuc-beta/, ['home:monsuc-story', 'home:monsuc-home', 'msx:H0']],
  [/monsuc-rank/, ['home:monsuc-rank-b2', 'home:monsuc-rank-b1', 'home:monsuc-rank-detail']],
  [/success-r3-cup|success-cup|success-arena|success-manual/, ['r3:C1', 'r3:C1w', 'r3:B1', 'r3:W1', 'r3:MA1', 'r3:R1', 'r3:C3', 'r3:K1', 'r3:S2']],
  [/success-r3-quest/, ['r3:Q1', 'r3:Q2', 'r3:QL1']],
  [/success-r3-retire/, ['r3:E3', 'r3:E0', 'r3:E1', 'r3:E2', 'r3:E9']],
  [/success-mm|monsuc-fuse|success-r3-store|success-store/, ['r3:X0', 'r3:X3', 'r3:X4', 'r3:X5', 'r3:X6', 'r3:X7', 'r3:A1', 'r3:A2', 'r3:F2', 'r3:F4', 'r3:T1']],
  [/success-arc/, ['arc:U1', 'arc:U2']],
  [/success-css|success-r3-css/, ['msx:H1', 'msx:M1', 'msx:S2', 'r3:C1', 'r3:X4', 'r3:E0']],
  [/data\/help\.js/, ['home:monsuc-help', 'home:monsuc-help-start', 'home:monsuc-help-beta']],
  [/data\/monhero-success/, ['msx:M1', 'msx:T1', 'r3:C1']],
  // 助手との対戦(おまかせ観戦と手動の2通りを撮る。縦 390×844 だけ)
  [/assistant-masmon-battle|msa-beta-shots/, ['asst:auto', 'asst:manual']],
];
const TOOLS = {
  msx: { file: 'tools/success/success-shoot.js', only: 'SHOT_ONLY' },
  r3: { file: 'tools/success/success-r3-shoot.js', only: 'ONLY' },
  arc: { file: 'tools/success/success-arc-shoot.js', only: 'ONLY' },
};
// 助手との対戦の道具は名札で選べず、1回で1通り(おまかせ/手動)を撮るので別に回す。止め絵を asst-<通り>.<名前>.png へ並べ直す
const runAsst = async (modes) => {
  const dir = path.join(DEEP, 'asst');
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Set();
  for (const mode of [...new Set(modes)].filter((m) => m === 'auto' || m === 'manual')) {
    const raw = path.join(DEEP, `asst-raw-${mode}`);
    await run([path.join('tools', 'battle', 'msa-beta-shots.js')], { STILL_DIR: raw, WIDTH: '390', HEIGHT: '844', MANUAL: mode === 'manual' ? '1' : '' }, path.join(DEEP, `asst-${mode}.log`));
    if (!fs.existsSync(raw)) continue;
    for (const f of fs.readdirSync(raw).sort()) {
      // 準備・くらべる・設定は2通りで同じ画面なので、先に撮った方だけ送る(費用を抑える)
      if (!/\.png$/.test(f) || seen.has(f) && /^[123]b?-/.test(f)) continue;
      seen.add(f);
      fs.copyFileSync(path.join(raw, f), path.join(dir, `asst-${mode}.${f}`));
    }
  }
  const logs = fs.readdirSync(DEEP).filter((f) => /^asst-(auto|manual)\.log$/.test(f)).map((f) => fs.readFileSync(path.join(DEEP, f), 'utf8'));
  fs.writeFileSync(path.join(DEEP, 'asst.log'), logs.join('\n'));
};

if (has('--list')) { FILE_SCENES.forEach(([re, sc]) => console.log(`${re.source}\n    ${sc.join(' ')}`)); process.exit(0); }
let scenes = opt('--scenes').split(',').map((x) => x.trim()).filter(Boolean);
if (has('--changed')) {
  const base = opt('--base', 'origin/main');
  const files = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n')
    .concat(spawnSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n')).filter(Boolean);
  for (const f of files) for (const [re, sc] of FILE_SCENES) if (re.test(f)) scenes.push(...sc);
  console.log(`差分のファイル ${files.length} → モンサクの場面 ${new Set(scenes).size}`);
}
scenes = [...new Set(scenes)];
if (!scenes.length) { console.log('撮る場面がない(--scenes か --changed。モンサクの部品に差分が無ければ点検は要らない)'); process.exit(0); }

const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '');
const OUT = opt('--out', path.join(ROOT, 'tools', 'out', 'visual', `monsuc-pr-${stamp}`));
const DEEP = path.join(OUT, 'deep');
const sizes = opt('--sizes', 'base'); // モンサクの横向きはいまは対応しない(社長の決めごと 2026-11-20)。横も撮るときは --sizes base,land,s568
const byTool = {};
for (const s of scenes) { const [t, c] = s.split(':'); (byTool[t] = byTool[t] || []).push(c); }
console.log(`撮る: ${scenes.join(' ')}(大きさ ${sizes})→ ${path.relative(ROOT, OUT)}`);

const run = (args, env = {}, log) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env } });
  const out = log ? fs.createWriteStream(log) : null;
  p.stdout.on('data', (d) => out && out.write(d)); p.stderr.on('data', (d) => out && out.write(d));
  p.on('close', (code) => { if (out) out.end(); resolve(code); });
});

(async () => {
  fs.mkdirSync(DEEP, { recursive: true });
  const jobs = [];
  for (const [t, codes] of Object.entries(byTool)) {
    if (t === 'home') {
      const tags = sizes.split(',').map((z) => ({ base: 'tate', land: 'yoko', s568: 'yoko-s' }[z])).filter(Boolean).join(',');
      jobs.push(run([path.join('tools', 'browser', 'visual-shoot.js'), '--only', codes.join(','), '--sizes', tags, '--out', path.join(OUT, 'home')], {}, path.join(OUT, 'home.log')));
    } else if (t === 'asst') {
      jobs.push(runAsst(codes));
    } else if (TOOLS[t]) {
      jobs.push(run([TOOLS[t].file], { SHOT_SIZES: sizes, SHOT_DIR: path.join(DEEP, t), [TOOLS[t].only]: codes.join(',') }, path.join(DEEP, `${t}.log`)));
    } else console.log(`知らない道具の名札: ${t}`);
  }
  await Promise.all(jobs);
  const args = [path.join('tools', 'browser', 'visual-api-monsuc.js'), '--deep', DEEP, '--out', path.join(OUT, 'api')];
  if (fs.existsSync(path.join(OUT, 'home', 'results.json'))) args.push('--home', path.join(OUT, 'home'));
  if (!has('--dry-run')) args.push('--send');
  if (!has('--batch')) args.push('--message');
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ANALYSIS_GATEWAY_TOKEN: process.env.ANALYSIS_GATEWAY_TOKEN || 'proxy' } });
  if (has('--batch') && !has('--dry-run')) console.log(`バッチの結果は: node tools/browser/visual-api-monsuc.js --out ${path.relative(ROOT, path.join(OUT, 'api'))} --fetch`);
  process.exit(r.status ?? 1);
})();
