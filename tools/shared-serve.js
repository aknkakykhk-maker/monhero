// 共有の配信(:8899)を「無ければ立てる」(2026-11-11)。
//
// localhost:8899 を開く実ブラウザの検査は、run-checks.js から回すと親が serve.py を立てるが、
// 単独で `node tools/<検査>` と打つと配信が無く、つながらずにエラーで終わっていた(60本。クラフトくんの知らせ)。
// 検査の先頭で require すると、:8899 が閉じていて SMOKE_URL も無いときだけ serve.py を立て、検査が終わったら止める。
// 開いていれば何もしない(run-checks.js の中では今までどおり共有の配信を使う)。判定は変えない。
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PORT = 8899;
const probe = () => spawnSync('python3', ['-c', `import socket,sys\ns=socket.socket();s.settimeout(0.3)\nsys.exit(0 if s.connect_ex(('127.0.0.1',${PORT}))==0 else 1)`]).status === 0;

if (!process.env.SMOKE_URL && !probe()) {
  const child = spawn('python3', [path.join(__dirname, 'serve.py'), String(PORT)], { stdio: 'ignore', cwd: path.resolve(__dirname, '..') });
  const stop = () => { try { child.kill(); } catch {} };
  process.on('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });
  for (let i = 0; i < 50 && !probe(); i++) spawnSync('sleep', ['0.1']);
  child.unref();
}
