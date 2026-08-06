// 起動ローディングのゲージが「実際の読み込み」に沿って動き、最後に100%へ届くかを確かめる。
//
// 【なぜ道具にするか】
// ゲージは見た目だけの部品なので、壊れても例外は出ず、画面も真っ白にならない。
// 実際に「実測とは無関係に8%〜28%を往復するだけの飾り」と「10段階のうち8段階が
// 即終わりで一気に飛ぶカウンタ」が長いあいだ気付かれずに残っていた。
// ここでは本物のブラウザでページを開き、ゲージの値を時系列で記録して
//   ・0%から始まって単調に増えること(戻らないこと)
//   ・途中の値がいくつも観測できること(0%と100%だけを行き来していないこと)
//   ・最後に必ず100%へ届くこと
// を数値で確かめる。
//
// 分母は tools/stamp-boot-sizes.js が実ファイルから書き込む。ここでは
// 「index.html に書かれた大きさ」と「実ファイルの大きさ」が一致することも見る
// (絵や曲を差し替えたのにビルドし直していないと、100%に届かなくなるため)。
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const PORT = 8987;
// ゲージの途中経過がこの数だけ観測できること。
// 描画のタイミング次第で増減するので、ここは「一気に埋めているだけではない」ことが
// 分かる程度の緩い下限にとどめ、実測で動いているかどうかは下の
// MIN_PARTIAL_REPORTS(受信の途中経過そのもの)で確かめる
const MIN_MIDDLE_SAMPLES = 3;
// いちばん大きいタイトル画像について、受信の途中経過が何回ゲージへ届いたか。
// これはネットワークの届き方だけで決まるので、実行環境の重さに左右されない。
// ファイル単位でしか数えていない作りに戻ると、描き直しはファイル数どまりになる
const MIN_PARTIAL_REPORTS = 10;
// 同じファイルを「読み込み済み」と数える回数の上限。
// 起動処理を動かすuseEffectの依存に、描画のたびに作り直されるオブジェクトが混ざっていると、
// タイトル画像の取得とBGMの準備が何百回もやり直される(実際にそうなっていた)。
// 見た目には出ないので、ここで回数を見て気付けるようにしておく
const MAX_DONE_PER_FILE = 3;
// 配信を細切れにして、実際の回線のようにじわじわ届く状態を作る
const CHUNK = 96 * 1024;
const CHUNK_DELAY_MS = 6;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const html = fs.readFileSync(path.join(WEB_ROOT, 'index.html'), 'utf8');
const sizesMatch = html.match(/var SIZES = (\{.*?\}); \/\* BOOT_SIZES \*\//);
check('index.html に起動ファイルの大きさが書き込まれている', !!sizesMatch);
if (!sizesMatch) { console.log('\n1件のNGがあります'); process.exit(1); }
const sizes = JSON.parse(sizesMatch[1]);
check('分母が空でない', Object.keys(sizes).length >= 5, `${Object.keys(sizes).length}件`);

// 書かれた大きさが実ファイルと合っているか(ビルドし忘れるとゲージが100%に届かなくなる)
const stale = [];
for (const [rel, size] of Object.entries(sizes)) {
  const full = path.join(WEB_ROOT, rel);
  if (!fs.existsSync(full)) { stale.push(`${rel}: ファイルがありません`); continue; }
  const actual = fs.statSync(full).size;
  if (actual !== size) stale.push(`${rel}: 書かれた${size} / 実際${actual}`);
}
check('書かれた大きさが実ファイルと一致する', stale.length === 0, stale.slice(0, 3).join(' / '));

// タイトル画像とBGMは、ゲージの重みとして必ず数に入れておきたい(いちばん大きいので)
for (const must of ['game-system.compiled.js', 'data/images/title-screen-clean.PNG', 'audio/bgm-title-theme.mp3']) {
  check(`${must} が分母に入っている`, !!sizes[must]);
}

// ゲージを止めないための備え。読み込みに失敗したファイルも「済んだもの」として数える
check('読み込みに失敗してもゲージが止まらない', /function fail\(name\) \{ done\(name\); \}/.test(html));
check('最後に必ず右端まで伸ばす仕組みがある', /function finish\(\)/.test(html) && /bootLoadFinish\(\)/.test(fs.readFileSync(path.join(WEB_ROOT, 'src/game-system.jsx'), 'utf8')));

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.png': 'image/png', '.PNG': 'image/png', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(WEB_ROOT, rel);
  if (!file.startsWith(WEB_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  // 実際の回線のように少しずつ届かせる。手元のファイルは一瞬で届いてしまい、
  // 途中経過が観測できないため「実測で動いているかどうか」を確かめられない
  const buf = fs.readFileSync(file);
  let sent = 0;
  const push = () => {
    if (sent >= buf.length) { res.end(); return; }
    const next = Math.min(buf.length, sent + CHUNK);
    res.write(buf.slice(sent, next));
    sent = next;
    setTimeout(push, CHUNK_DELAY_MS);
  };
  push();
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(failed ? 1 : 0); }
  await new Promise(r => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const tab = await browser.newPage();
    // 外部CDN(Tailwind)はこのサンドボックスから取りに行けないので、待たずに落とす
    await tab.route('https://cdn.tailwindcss.com/**', r => r.abort());
    await tab.route('https://cdn.tailwindcss.com', r => r.abort());
    const samples = [];
    await tab.exposeFunction('__record', (p, label) => { samples.push({ p, label }); });
    // ゲージが描き直された回数と、そのとき出ていた見出しをページ側にためる。
    // __mhBoot が作られる瞬間を捕まえて、公開されている watch() を使って数える。
    // 描き直しはファイルが1つ届くたびだけでなく、大きいファイルの受信が進むたびにも
    // 起きるので、回数がファイル数を大きく上回っていれば「バイト単位で動いている」と分かる
    await tab.addInitScript(() => {
      let real = null;
      window.__paints = 0;
      window.__labels = [];
      window.__doneCounts = {};
      Object.defineProperty(window, '__mhBoot', {
        configurable: true,
        get() { return real; },
        set(v) {
          real = v;
          // 「読み込み済み」と伝えられた回数をファイルごとに数える。
          // 起動処理が何度もやり直されると、同じファイルが何度も伝えられる
          const origDone = v.done;
          v.done = function (name) {
            window.__doneCounts[name] = (window.__doneCounts[name] || 0) + 1;
            return origDone.apply(this, arguments);
          };
          v.watch(function () {
            window.__paints++;
            const t = v.label();
            if (window.__labels[window.__labels.length - 1] !== t) window.__labels.push(t);
          });
        },
      });
    });
    await tab.addInitScript(() => {
      // __mhBoot ができた瞬間から、値が変わるたびに記録する
      let last = -1;
      const tick = () => {
        if (window.__mhBoot) {
          const p = window.__mhBoot.percent();
          if (p !== last) { last = p; window.__record && window.__record(p, window.__mhBoot.label()); }
        }
        if (last < 100) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await tab.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
    // ゲージが100%になるまで待つ(タイトルBGMの準備まで終わるのを待つ)
    await tab.waitForFunction(() => window.__mhBoot && window.__mhBoot.percent() >= 100, null, { timeout: 30000 })
      .catch(() => {});
    const finalPct = await tab.evaluate(() => window.__mhBoot ? window.__mhBoot.percent() : -1);
    const paints = await tab.evaluate(() => window.__paints || 0);
    const pageLabels = await tab.evaluate(() => window.__labels || []);
    const doneCounts = await tab.evaluate(() => window.__doneCounts || {});

    const values = samples.map(s => s.p);
    console.log(`ゲージの動き: ${values.length}回変化 / ${values.slice(0, 12).join('→')}${values.length > 12 ? '→…→' + values[values.length - 1] : ''}`);
    // 開き始めた時点でゲージがすでに埋まっていないこと(分母が小さすぎると一瞬で満ちる)
    check('ゲージは低いところから始まる', values.length > 0 && values[0] < 40, values.length ? `最初 ${values[0]}%` : '記録なし');
    check('ゲージが戻らない', values.every((v, i) => i === 0 || v >= values[i - 1]));
    const middle = values.filter(v => v > 0 && v < 100);
    check('ゲージが途中の値を通る(一気に埋めていない)', middle.length >= MIN_MIDDLE_SAMPLES,
      `途中の値 ${middle.length}回`);
    // 大きいファイルは、届いたぶんだけゲージが伸びること。
    // ファイル単位でしか数えていないと、描き直しの回数がファイル数どまりになる
    check('大きいファイルは受信の途中経過でもゲージが伸びる', paints >= Object.keys(sizes).length + MIN_PARTIAL_REPORTS,
      `ゲージの描き直し ${paints}回 / 起動ファイル ${Object.keys(sizes).length}件`);
    check('最後は100%に届く', finalPct === 100, `${finalPct}%`);
    const repeated = Object.entries(doneCounts).filter(([, n]) => n > MAX_DONE_PER_FILE);
    check('起動処理が何度もやり直されていない', repeated.length === 0,
      repeated.map(([name, n]) => `${name} が${n}回`).join(' / '));
    const labels = Array.from(new Set(pageLabels));
    check('読み込み中の見出しが切り替わる', labels.length >= 4, labels.join(' / '));
    await tab.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})();
