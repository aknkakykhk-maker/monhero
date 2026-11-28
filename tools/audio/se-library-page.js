#!/usr/bin/env node
// 効果音の素材庫(r1126-121)の資料の表と、試し聴きのページを作る。
//
//   node tools/audio/se-library-page.js          … docs/progress/SE_LIBRARY.md の表と docs/progress/se-library.html を書き直す
//   node tools/audio/se-library-page.js --check  … 書き直さず、いまの一覧と合っているかだけ見る(合っていなければ NG)
//
// 読むもの:
//   tools/audio/se-library.json                   … 曲から作る音の作り方(切り出す場所と加工の手順)
//   tools/art-sources/se-library/index.json       … 作った音の長さ・大きさ(tools/audio/se-library-build.py が書く)
//   tools/art-sources/se-library/se-synth.js      … その場で合成する音の部品(MH_SE_SYNTH.list)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const LIB = path.join(ROOT, 'tools/art-sources/se-library');
const SPEC = path.join(ROOT, 'tools/audio/se-library.json');
const DOC = path.join(ROOT, 'docs/progress/SE_LIBRARY.md');
const PAGE = path.join(ROOT, 'docs/progress/se-library.html');

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(LIB, 'index.json'), 'utf8'));
const sandbox = {}; sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(LIB, 'se-synth.js'), 'utf8'), sandbox);
const synth = sandbox.MH_SE_SYNTH.list;

const srcText = (s) => `\`${path.basename(s.src)}\` の ${s.at || 0}秒から${s.dur ? ` ${s.dur}秒` : '終わりまで'}`;
const stepText = (st) => {
  const [op, v] = Object.entries(st)[0];
  switch (op) {
    case 'fade': return [v[0] ? `頭${v[0]}秒で出す` : '', v[1] ? `終わり${v[1]}秒で消す` : ''].filter(Boolean).join('・');
    case 'pitch': return `音程 ${v > 0 ? '+' : ''}${v} 半音(長さそのまま)`;
    case 'stretch': return `${v}倍に引き延ばす(音程そのまま)`;
    case 'tape': return `テープ式に ${v > 0 ? '+' : ''}${v} 半音(長さも変わる)`;
    case 'hp': return `${v}Hz より下を削る`;
    case 'lp': return `${v}Hz より上を削る(こもらせる)`;
    case 'bp': return `${v[0]}〜${v[1]}Hz だけ残す`;
    case 'eq': return `${v[0]}Hz を ${v[2] > 0 ? '+' : ''}${v[2]}dB`;
    case 'reverse': return '逆再生';
    case 'reverb': return `残響 ${v.sec}秒(混ぜ ${v.wet})`;
    case 'echo': return `こだま ${v.delay}秒おきに${v.taps}回`;
    case 'pad': return `後ろに${v}秒の余白`;
    case 'gain': return `${v > 0 ? '+' : ''}${v}dB`;
    case 'mono': return '左右をまとめる';
    case 'width': return `広がり ${v}`;
    case 'trim': return `${v[0]}〜${v[1] || '終わり'}秒だけ使う`;
    case 'repeat': return `${v.times}回くり返す(${v.every}秒おき)`;
    case 'layer': return `重ねる[${srcText(v.from)}${(v.from.steps || []).length ? ' → ' + v.from.steps.map(stepText).join(' → ') : ''}]を ${v.at}秒の所へ ${v.gain}dB で`;
    default: return op;
  }
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (s) => String(s).replace(/\|/g, '\\|');

// ---- 資料の表 ----
const fileRows = spec.sounds.map((e) => {
  const r = index[e.id] || {};
  return `| \`${e.id}.mp3\` | ${md(e.name)} | ${r.sec != null ? r.sec + '秒' : '—'} | ${md(srcText(e))} | ${md((e.steps || []).map(stepText).join(' → '))} | ${md(e.scene)} |`;
});
const fileTable = ['| ファイル | 名前 | 長さ | 素材(曲のどこから) | 加工の手順(上から順に) | 合うと思う場面 |', '| --- | --- | --- | --- | --- | --- |', ...fileRows].join('\n');
const synthTable = ['| 呼び名 | 名前 | 試し聴きの設定 | 合うと思う場面 |', '| --- | --- | --- | --- |',
  ...synth.map((s) => `| \`${s.id}\` | ${md(s.name)} | \`${JSON.stringify(s.demo)}\` | ${md(s.scene)} |`)].join('\n');

const putBlock = (text, key, body) => {
  const a = `<!-- se-library:${key} -->`, b = `<!-- /se-library:${key} -->`;
  const i = text.indexOf(a), j = text.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`${DOC} に ${a} 〜 ${b} がありません`);
  return text.slice(0, i + a.length) + '\n' + body + '\n' + text.slice(j);
};

// ---- 試し聴きのページ ----
const page = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>効果音の素材庫</title>
<!-- tools/audio/se-library-page.js が作る。手で直さない -->
<style>
:root { --bg:#faf7f2; --card:#fff; --ink:#2b2622; --sub:#7a6f66; --line:#e6ddd2; --accent:#8a3b2e; }
@media (prefers-color-scheme: dark) { :root { --bg:#15120f; --card:#211c18; --ink:#efe7de; --sub:#a99c8f; --line:#3a322b; --accent:#e08a6f; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width:860px; margin:0 auto; padding:24px 16px 64px; }
h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:17px; margin:32px 0 8px; border-bottom:1px solid var(--line); padding-bottom:4px; }
p.lead { color:var(--sub); margin:0 0 8px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:10px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:6px; }
.name { font-weight:600; } .id { font:12px ui-monospace, monospace; color:var(--sub); } .scene { font-size:13px; color:var(--sub); }
.row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
button { font:inherit; font-size:14px; padding:6px 14px; border-radius:999px; border:1px solid var(--accent); background:transparent; color:var(--accent); cursor:pointer; }
button.on { background:var(--accent); color:var(--card); }
audio { width:100%; height:36px; }
.vol { display:flex; gap:8px; align-items:center; margin:12px 0; color:var(--sub); font-size:13px; }
</style>
</head>
<body>
<main>
<h1>効果音の素材庫</h1>
<p class="lead">ゲームにはまだ入れていない、試し聴き用のページです(台帳 r1126-121)。作り方と一覧は SE_LIBRARY.md。</p>
<div class="vol">音量 <input id="vol" type="range" min="0" max="100" value="70"></div>

<h2>その場で合成する音(${synth.length})</h2>
<div class="grid">
${synth.map((s) => `<div class="card"><div class="name">${esc(s.name)}</div><div class="id">${esc(s.id)}</div><div class="scene">${esc(s.scene)}</div><div class="row"><button data-synth="${esc(s.id)}" data-demo="${esc(JSON.stringify(s.demo))}">▶ 鳴らす</button></div></div>`).join('\n')}
</div>

<h2>曲から作った音(${spec.sounds.length})</h2>
<div class="grid">
${spec.sounds.map((e) => `<div class="card"><div class="name">${esc(e.name)}</div><div class="id">${esc(e.id)}.mp3 ・ ${index[e.id] ? index[e.id].sec + '秒' : ''}</div><div class="scene">${esc(e.scene)}</div><audio controls preload="none" src="../../tools/art-sources/se-library/${esc(e.id)}.mp3"></audio></div>`).join('\n')}
</div>
</main>
<script src="../../tools/art-sources/se-library/se-synth.js"></script>
<script>
(function () {
  var ctx = null, master = null, vol = document.getElementById('vol');
  var level = function () { return Math.pow(vol.value / 100, 2); };
  vol.addEventListener('input', function () {
    if (master) master.gain.value = level();
    document.querySelectorAll('audio').forEach(function (a) { a.volume = level(); });
  });
  document.querySelectorAll('audio').forEach(function (a) { a.volume = level(); });
  document.querySelectorAll('button[data-synth]').forEach(function (btn) {
    var handle = null, timer = null;
    btn.addEventListener('click', function () {
      if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination); }
      if (ctx.state !== 'running') ctx.resume();
      if (handle && handle.stop) { handle.stop(); }
      clearTimeout(timer);
      if (btn.classList.contains('on')) { btn.classList.remove('on'); btn.textContent = '▶ 鳴らす'; handle = null; return; }
      handle = MH_SE_SYNTH.play(btn.dataset.synth, ctx, master, JSON.parse(btn.dataset.demo));
      btn.classList.add('on'); btn.textContent = '■ 止める';
      if (isFinite(handle.dur)) timer = setTimeout(function () { btn.classList.remove('on'); btn.textContent = '▶ 鳴らす'; handle = null; }, handle.dur * 1000);
    });
  });
})();
</script>
</body>
</html>
`;

const check = process.argv.includes('--check');
const doc0 = fs.readFileSync(DOC, 'utf8');
const doc1 = putBlock(putBlock(doc0, 'files', fileTable), 'synth', synthTable);
const page0 = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : '';
if (check) {
  const ng = [doc0 !== doc1 && 'SE_LIBRARY.md の表', page0 !== page && 'se-library.html'].filter(Boolean);
  console.log(ng.length ? `NG: 一覧と合っていません(${ng.join('・')})。node tools/audio/se-library-page.js で作り直す` : `OK 合成 ${synth.length} 件・曲から ${spec.sounds.length} 件`);
  process.exit(ng.length ? 1 : 0);
}
fs.writeFileSync(DOC, doc1);
fs.writeFileSync(PAGE, page);
console.log(`書きました: 合成 ${synth.length} 件・曲から ${spec.sounds.length} 件`);
