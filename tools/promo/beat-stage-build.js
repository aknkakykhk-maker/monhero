#!/usr/bin/env node
// モンヒロビート紹介動画「HELL の見どころ(ステージ)」を組み立てる(2026-11-24 r1119-159)。
// 社長が作った見本 tools/art-sources/promo/monhero-beat-stage.mov(2分12秒・縦 720×1280・60fps)と同じ作りで、曲だけ替えた版を作る。
//
//   node tools/promo/beat-stage-build.js tools/promo/beat-stage-2.json            撮影(無ければ)→ 絵の層 → 組み立て → 一覧の絵
//   node tools/promo/beat-stage-build.js tools/promo/beat-stage-2.json --recapture 演奏を撮り直す
//   node tools/promo/beat-stage-build.js tools/promo/beat-stage-2.json --layers   絵の層(PNG)だけ作って止める(字の位置を見るとき)
//   node tools/promo/beat-stage-build.js tools/promo/beat-stage-3.json --intro    作り直した冒頭(plan.intro)だけ書き出して止める(各場面の原寸のコマも残す)
//   --work <フォルダ>  作業の場所(既定は OS の一時フォルダの monhero-promo)
//   node tools/promo/beat-stage-build.js tools/promo/beat-stage-2.json --calib    見本の LAMIA の場面と同じ字で層を作り、見本のコマと重ねた絵を出す(位置合わせ用)
//
// 曲を替えて作り直すとき: 設定ファイル(beat-stage-2.json)を写して、songs の曲・始まりの時刻(from・曲の ms)・見出し(scenes)・差し色を書き替える。
//   from から 30 秒を使う(見本と同じ1曲30秒)。scenes[].at はその30秒の中の秒(最初は 0)。見出しは右から左へのワイプ(0.3秒)で替わる(見本の測り値)
//
// 見本から測ってそろえたこと(60fps のコマで数えた):
//   0〜33.68秒 見本のまま(幕 → 本オープン → マルチ → 助手とセッション → 記念ステージ → 記念ギフト → 育てたマスモン)。音も見本のまま
//   33.60秒〜 「高難易度 HELL / 3曲連続ライブ」の一覧を 0.35 秒で重ねて出す(ここを新しい3曲で作り直す)。
//            見本はこの直後から古い一覧が重なり始めるので、見本は 33.60 秒のコマで止めて、その上に重ねる
//   37.97秒・67.97秒・97.97秒 曲ごとの場面へ切り替え(つなぎはカット)。1曲 30.00 秒。音はその曲の音源をその区間で切った物
//   127.97〜132.00秒 締め(モンヒロビート・次は、あなたの番。・URL)は見本のまま
//   1場面: 上にジャケット(300×300・差し色の枠)・「HELL」(差し色)・曲名(斜体の明朝)・NOTE SPEED、中に横長の演奏(720×334・上下に差し色の線)、
//           下に見出し(明朝の太字 49px)と一言(28px)と細い区切りの線
// 演奏の素材は tools/promo/beat-stage-capture.js で撮る(ふつうの演奏の画面を曲鑑賞と同じ自動の手で叩かせる。ミス 0 を確かめる)。
// 書体: 見出しは Noto Serif JP、小さい字は Noto Sans JP(npm の @fontsource から作業用の一時フォルダへ取る)、英字の曲名は Liberation Serif の斜体。
// ffmpeg と Playwright(箱に入っているもの)を使う。作業のファイルは plan.work(既定は OS の一時フォルダ)に置き、リポジトリには入れない。
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const PLAN_FILE = argv.find(a => a.endsWith('.json'));
if (!PLAN_FILE) { console.error('使い方: node tools/promo/beat-stage-build.js <設定.json> [--recapture] [--layers] [--calib]'); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(path.resolve(PLAN_FILE), 'utf8'));
const argOf = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
// 作業の場所(撮ったコマ・絵の層・途中の動画・書体)。--work <フォルダ> で替えられる(既定は OS の一時フォルダ)
const WORK_BASE = path.resolve(argOf('work') || path.join(os.tmpdir(), 'monhero-promo'));
const WORK = path.join(WORK_BASE, path.basename(PLAN_FILE, '.json'));
fs.mkdirSync(WORK, { recursive: true });
const R = (p) => path.resolve(ROOT, p);
const FPS = 60, W = 720, H = 1280;
const T = Object.assign({ introEnd: 33.6, listFade: 0.35, stageStart: 37.9667, stageDur: 30, outroStart: 127.9667, end: 132.0, wipe: 0.3 }, plan.template || {});
const GP = Object.assign({ y: 468, h: 334 }, plan.gameplay || {});
const run = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { stdio: opt.quiet ? 'pipe' : ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...opt }); if (r.status !== 0) { console.error(String(r.stderr || '').slice(-3000)); throw new Error(`${cmd} が失敗(${r.status})`); } return String(r.stdout || '') + String(r.stderr || ''); };
const ff = (args) => run('ffmpeg', ['-v', 'error', '-y', ...args]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── 書体(npm の @fontsource を一時フォルダへ) ──────────────────────────────
const FONT_DIR = path.join(WORK_BASE, 'fonts');
const fontCss = (pkg, weight) => {
  const dir = path.join(FONT_DIR, pkg.replace('/', '__'));
  const css = path.join(dir, 'package', `${weight}.css`);
  if (!fs.existsSync(css)) {
    fs.mkdirSync(dir, { recursive: true });
    const out = run('npm', ['pack', pkg, '--silent', '--pack-destination', dir]).trim().split('\n').pop().trim();
    run('tar', ['xzf', path.join(dir, out), '-C', dir]);
  }
  return 'file://' + css;
};

// ── 演奏の素材 ────────────────────────────────────────────────────────────
const capture = (song, i) => {
  const dir = path.join(WORK, 'cap', song.songId);
  const from = song.from - 1000, to = song.from + T.stageDur * 1000 + 1000;
  const meta = path.join(dir, 'frames.json');
  // 速度・設定が違う撮影は使わない(第3版: 速度9.5の旧録画を使わないため)
  const want = JSON.stringify(Object.assign({}, plan.captureSettings || {}, { noteSpeed: plan.noteSpeed || 9.5 }));
  const wantHow = JSON.stringify({ listen: !!plan.listen, ui: plan.optionsUi || [], clock: 2 });
  const ok = fs.existsSync(meta) && (() => { const m = JSON.parse(fs.readFileSync(meta, 'utf8')); return m.from <= from + 1 && m.to >= Math.min(to, song.endMs || to) - 1 && JSON.stringify(m.settings || { noteSpeed: m.noteSpeed }) === want && JSON.stringify(m.how || {}) === wantHow; })();
  if (ok && !argv.includes('--recapture')) return dir;
  console.log(`撮影 ${i + 1}: ${song.songId} ${song.diff || 'HELL'} ${from}〜${to}ms`);
  execFileSync('node', [R('tools/promo/beat-stage-capture.js'), '--song', song.songId, '--diff', song.diff || 'HELL', '--from', String(from), '--to', String(to), '--speed', String(plan.noteSpeed || 9.5),
    '--settings', JSON.stringify(plan.captureSettings || {}), ...(plan.listen ? ['--listen'] : []), ...(plan.slow ? ['--slow', String(plan.slow)] : []), ...(plan.optionsUi ? ['--ui-settings', JSON.stringify(plan.optionsUi)] : []), '--out', dir], { stdio: 'inherit' });
  return dir;
};

// ── 絵の層(Playwright で HTML を 720×1280 の PNG に) ───────────────────────
const fontsHead = () => `<link rel="stylesheet" href="${fontCss('@fontsource/noto-serif-jp', 700)}"><link rel="stylesheet" href="${fontCss('@fontsource/noto-sans-jp', 500)}"><link rel="stylesheet" href="${fontCss('@fontsource/noto-sans-jp', 700)}">`;
const baseCss = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;font-family:'Noto Sans JP',sans-serif;color:#f5efe0;-webkit-font-smoothing:antialiased}
.abs{position:absolute;white-space:nowrap}
.latin{font-family:'Liberation Serif',serif;font-style:italic;font-weight:400}
.mincho{font-family:'Noto Serif JP',serif;font-weight:700}`;
const bgCss = (accent, glow) => `background:
  radial-gradient(520px 420px at 18% 16%, ${glow}38, transparent 70%),
  radial-gradient(620px 520px at 78% 8%, ${glow}2a, transparent 72%),
  radial-gradient(700px 600px at 10% 95%, #2a254a33, transparent 70%),
  linear-gradient(180deg,#14162e 0%,#171731 30%,#121226 62%,#0f0f20 100%);`;
// 曲名の行(英字は斜体の明朝 62px。長いときは2行。日本語は明朝 44px)
const titleHtml = (song, x, y, size) => {
  const lines = song.titleLines || [song.title];
  const jp = /[^\x00-\x7f]/.test(lines.join(''));
  const fs_ = jp ? Math.round(size * (song.titleScaleJp || 0.72)) : size;
  return lines.map((l, k) => `<div class="abs ${jp ? 'mincho' : 'latin'}" style="left:${x}px;top:${y + k * Math.round(fs_ * 1.08)}px;font-size:${fs_}px;line-height:1;color:#f7f3e8">${esc(l)}</div>`).join('');
};
const stageHtml = (song, scene) => {
  const a = song.accent;
  const nTitle = (song.titleLines || [song.title]).length;
  const titleTop = nTitle > 1 ? 160 : 173;
  return `<!doctype html><html><head><meta charset="utf-8">${fontsHead()}<style>${baseCss}body{${bgCss(a, song.glow || a)}}</style></head><body>
  <img src="file://${R(song.art)}" class="abs" style="left:45px;top:78px;width:300px;height:300px;border:2px solid ${a};object-fit:cover">
  <div class="abs" style="left:377px;top:117px;font-size:31px;font-weight:700;letter-spacing:.03em;line-height:1;color:${a}">${esc(song.diffLabel || 'HELL')}</div>
  ${titleHtml(song, 373, titleTop, 58)}
  <div class="abs" style="left:376px;top:334px;font-size:23px;font-weight:700;letter-spacing:.02em;line-height:1;color:#c9c6dc">NOTE SPEED<span style="margin-left:23px">${esc(Number(plan.noteSpeed || 9.5).toFixed(1))}</span></div>
  <div class="abs" style="left:0;top:${GP.y - 2}px;width:${W}px;height:${GP.h + 4}px;background:#050616;border-top:2px solid ${a};border-bottom:2px solid ${a}"></div>
  <div class="abs mincho" style="left:47px;top:924px;font-size:50px;line-height:1.2;color:#f5efe0">${esc(scene.title)}</div>
  <div class="abs" style="left:48px;top:1029px;font-size:30px;font-weight:500;line-height:1.2;color:#b9b8cc">${esc(scene.sub)}</div>
  <div class="abs" style="left:46px;top:1140px;width:628px;height:2px;background:#3c3e44"></div>
  </body></html>`;
};
const listHtml = () => {
  const rows = plan.songs.map((s, i) => {
    const y = 286 + i * 298, a = s.accent;
    const lines = s.listTitleLines || s.titleLines || [s.title];
    const jp = /[^\x00-\x7f]/.test(lines.join(''));
    const size = jp ? 34 : 46;
    const tTop = 386 - 4 + i * 298 - (lines.length - 1) * Math.round(size * 1.1) - Math.round(size * 0.62);   // 2行のときは最後の行を1行の位置に置く(下の札とあける)
    return `<img src="file://${R(s.art)}" class="abs" style="left:45px;top:${y}px;width:244px;height:244px;border:2px solid ${a};object-fit:cover">
      ${lines.map((l, k) => `<div class="abs ${jp ? 'mincho' : 'latin'}" style="left:328px;top:${tTop + k * Math.round(size * 1.1)}px;font-size:${size}px;line-height:1;color:#f7f3e8">${esc(l)}</div>`).join('')}
      <div class="abs" style="left:331px;top:${441 + i * 298}px;font-size:27px;font-weight:700;letter-spacing:.04em;line-height:1;color:${a}">${esc(s.tag)}</div>
      <div class="abs" style="left:326px;top:${499 + i * 298}px;width:339px;height:2px;background:${a};opacity:.55"></div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${fontsHead()}<style>${baseCss}body{background:radial-gradient(600px 500px at 15% 10%,#2a2d5033,transparent 70%),linear-gradient(180deg,#141729 0%,#121424 45%,#0c0e1c 100%)}</style></head><body>
  <div class="abs mincho" style="left:47px;top:86px;font-size:58px;line-height:1;color:#f5efe0">${esc(plan.listTitle || '高難易度 HELL')}</div>
  <div class="abs" style="left:48px;top:189px;font-size:26px;font-weight:700;letter-spacing:.2em;line-height:1;color:#e8b45c">${esc(plan.listSub || '3曲連続ライブ')}</div>
  ${rows}</body></html>`;
};
const renderLayers = async (calib) => {
  const { chromium } = (() => { try { return require(R('tools/node_modules/playwright')); } catch { return require('playwright'); } })();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const shot = async (html, out) => {
    const f = out.replace(/\.png$/, '.html'); fs.writeFileSync(f, html);
    await page.goto('file://' + f); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
    // 字が枠からはみ出していないか(右の端・下の端)
    const over = await page.evaluate((w) => [...document.querySelectorAll('.abs')].filter(e => { const r = e.getBoundingClientRect(); return r.right > w - 20 || r.left < 0; }).map(e => e.textContent.trim()).filter(Boolean), W);
    if (over.length) console.log(`  ⚠ 右の余白 20px より外へ出た字: ${over.join(' / ')}(${path.basename(out)})`);
    await page.screenshot({ path: out });
  };
  const L = path.join(WORK, 'layers'); fs.mkdirSync(L, { recursive: true });
  const songs = calib ? [calib] : plan.songs;
  for (const [i, s] of songs.entries()) for (const [k, sc] of s.scenes.entries()) await shot(stageHtml(s, sc), path.join(L, `stage${i}-${k}.png`));
  if (!calib) await shot(listHtml(), path.join(L, 'list.png'));
  await browser.close();
  return L;
};

// ── 演奏の動画(撮ったコマを曲の時刻で 60fps に並べ直す) ─────────────────────
const gameplayClip = (song, i, dir) => {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  // 撮った順に、曲の時刻が進んでいるあいだのコマだけ使う(曲が終わったあとは結果の画面などで時刻が戻る)
  const fr = [];
  for (const f of meta.frames) { if (!Number.isFinite(f.songMs)) continue; const last = fr.length ? fr[fr.length - 1].songMs : -Infinity; if (f.songMs < last - 500) break; if (f.songMs <= last) continue; fr.push(f); }   // 少しの戻り(時計のならし)はそのコマだけ飛ばす
  const n = Math.round(T.stageDur * FPS), list = [];
  let j = 0, worst = 0;
  for (let k = 0; k < n; k++) {
    const t = song.from + (k * 1000) / FPS;
    while (j + 1 < fr.length && Math.abs(fr[j + 1].songMs - t) <= Math.abs(fr[j].songMs - t)) j++;
    worst = Math.max(worst, Math.abs(fr[j].songMs - t));
    list.push(`file '${path.join(dir, fr[j].file)}'\nduration ${(1 / FPS).toFixed(6)}`);
  }
  list.push(`file '${path.join(dir, fr[j].file)}'`);
  const used = new Set(list.map(l => l.split('\n')[0])).size;
  console.log(`演奏 ${i + 1}: ${song.songId} 使ったコマ ${used}/${n}(いちばん離れたコマ ${worst.toFixed(0)}ms)`);
  const lf = path.join(WORK, `gp${i}.txt`); fs.writeFileSync(lf, list.join('\n'));
  const out = path.join(WORK, `gp${i}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', lf, '-vf', `scale=${W}:${GP.h}:flags=lanczos,fps=${FPS},format=yuv420p`, '-frames:v', String(n), '-c:v', 'libx264', '-crf', '10', '-preset', 'veryfast', out]);
  return out;
};

// ── 曲ごとの場面(層の絵を見出しごとにワイプでつなぎ、演奏を重ねる) ────────────
const stageClip = (song, i, L, gp) => {
  const out = path.join(WORK, `stage${i}.mp4`), d = T.stageDur;
  const inputs = [], chain = [];
  song.scenes.forEach((sc, k) => inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(d), '-i', path.join(L, `stage${i}-${k}.png`)));
  inputs.push('-i', gp);
  let last = '[0:v]';
  for (let k = 1; k < song.scenes.length; k++) {
    // 見本は新しい字が右から左へ現れる(xfade の wipeleft)。前の絵は、切り替えの時刻までの長さに切ってからつなぐ
    const prevLen = song.scenes[k].at + T.wipe;
    chain.push(`${last}trim=0:${prevLen},setpts=PTS-STARTPTS[p${k}]`);
    chain.push(`[${k}:v]trim=0:${d - song.scenes[k].at},setpts=PTS-STARTPTS[n${k}]`);
    chain.push(`[p${k}][n${k}]xfade=transition=wipeleft:duration=${T.wipe}:offset=${song.scenes[k].at}[x${k}]`);
    last = `[x${k}]`;
  }
  chain.push(`${last}trim=0:${d},setpts=PTS-STARTPTS,format=yuv420p[bg]`);
  chain.push(`[bg][${song.scenes.length}:v]overlay=0:${GP.y}:shortest=1,fps=${FPS}[v]`);
  ff([...inputs, '-filter_complex', chain.join(';'), '-map', '[v]', '-frames:v', String(Math.round(d * FPS)), '-c:v', 'libx264', '-crf', '10', '-preset', 'veryfast', out]);
  return out;
};

// ── 音(見本の音量にそろえる) ─────────────────────────────────────────────
const meanDb = (args) => { const o = run('ffmpeg', ['-v', 'info', ...args, '-af', 'volumedetect', '-f', 'null', '-'], { quiet: true }); return Number((o.match(/mean_volume:\s*(-?[\d.]+)/) || [])[1]); };
const audioClip = async (song, i, refDb, capDir) => {
  const out = path.join(WORK, `a${i}.wav`), src = R(song.audio), ss = song.from / 1000, d = T.stageDur;
  const end = song.fadeOut ? `,afade=t=out:st=${d - song.fadeOut}:d=${song.fadeOut}` : ',afade=t=out:st=' + (d - 0.02) + ':d=0.02';
  // タップ音(第3版から): 撮影で控えたゲームのタップ音の呼び出しを、判定の瞬間の曲の時刻で鳴らし直した物(beat-stage-taps.js)。
  // 曲(gain 1・音量100%)とタップ音はゲームの中と同じ比のまま足し、足した物を見本の曲の場面の音量へそろえる
  const seFile = capDir && path.join(capDir, 'se.json');
  let taps = null;
  if (seFile && fs.existsSync(seFile) && plan.taps !== false) {
    taps = path.join(WORK, `taps${i}.wav`);
    const r = await require('./beat-stage-taps.js').renderTaps({ seFile, fromMs: song.from, durSec: d, out: taps });
    console.log(`タップ音 ${i + 1}: 叩く ${r.tap}・フリック ${r.flick}・終わり ${r.clear}・必殺 ${r.accent}・空中 ${r.sky}・モンスター ${r.monster}(呼び直し ${r.called}件)`);
    song._flickAt = r.flickAt;
  } else if (plan.taps !== false) console.log(`  ⚠ タップ音の控え(se.json)が無い: ${song.songId}(撮り直すと入る)`);
  const mix = path.join(WORK, `mix${i}.wav`);
  if (taps) ff(['-ss', String(ss), '-t', String(d), '-i', src, '-i', taps, '-filter_complex', `[0:a]aresample=48000,apad,atrim=0:${d}[m];[1:a]aresample=48000[t];[m][t]amix=inputs=2:duration=first:normalize=0`, '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', mix]);
  else ff(['-ss', String(ss), '-t', String(d), '-i', src, '-af', `aresample=48000,apad,atrim=0:${d}`, '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', mix]);
  const have = meanDb(['-i', mix]);
  const gain = Math.max(-12, Math.min(12, refDb - have));
  console.log(`音 ${i + 1}: ${path.basename(src)} ${ss.toFixed(2)}秒〜${taps ? '+タップ音' : ''} 平均 ${have.toFixed(1)}dB → ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}dB(見本の曲の場面 ${refDb.toFixed(1)}dB)`);
  ff(['-i', mix, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=disabled,afade=t=in:d=0.02${end}`, '-ac', '2', '-ar', '48000', out]);
  return out;
};

// ── 一覧の絵(見本の一覧の場面から3枚・曲ごと) ────────────────────────────────
const contactSheet = (video, out) => {
  const times = plan.sheetTimes || plan.songs.flatMap((s, i) => [6, 15, 25].map(x => T.stageStart + i * T.stageDur + x));
  const tmp = path.join(WORK, 'sheet'); fs.mkdirSync(tmp, { recursive: true });
  times.forEach((t, k) => ff(['-ss', String(t), '-i', video, '-frames:v', '1', '-vf', 'scale=240:427', path.join(tmp, `s${String(k).padStart(2, '0')}.png`)]));
  ff(['-framerate', '1', '-i', path.join(tmp, 's%02d.png'), '-vf', 'tile=6x2:color=black', '-frames:v', '1', '-q:v', '3', out]);
};

(async () => {
  const tpl = R(T.src || 'tools/art-sources/promo/monhero-beat-stage.mov');
  if (argv.includes('--calib')) {
    // 見本の LAMIA の場面と同じ字の層を作り、見本の 45 秒のコマと半分ずつ重ねる(字の位置・大きさの確かめ)
    const L = await renderLayers(plan.calib);
    const ref = path.join(WORK, 'calib-ref.png');
    ff(['-i', tpl, '-vf', `trim=${plan.calib.refAt}:${plan.calib.refAt + 1},setpts=PTS-STARTPTS`, '-frames:v', '1', ref]);
    ff(['-i', ref, '-i', path.join(L, 'stage0-0.png'), '-filter_complex', '[0][1]blend=all_mode=difference,eq=brightness=0.0:contrast=1.5[d];[0][1]hstack[h];[h][d]hstack', path.join(WORK, 'calib.png')]);
    console.log('重ねた絵:', path.join(WORK, 'calib.png')); return;
  }
  const L = await renderLayers();
  console.log('絵の層:', L);
  if (argv.includes('--layers')) return;
  if (argv.includes('--intro')) { const o = await require('./beat-stage-intro.js').buildIntro({ ROOT, WORK, fontsHead: fontsHead(), plan, end: T.introEnd + T.listFade + 0.1 }); console.log('冒頭:', o); return; }
  const dirs = plan.songs.map((s, i) => capture(s, i));
  const refDb = meanDb(['-ss', String(T.stageStart), '-t', String(T.outroStart - T.stageStart), '-i', tpl]);
  const stages = plan.songs.map((s, i) => stageClip(s, i, L, gameplayClip(s, i, dirs[i])));
  const audios = []; for (const [i, s] of plan.songs.entries()) audios.push(await audioClip(s, i, refDb, dirs[i]));
  // 頭(見本 0〜一覧の重ね終わり)+ 一覧 → 曲3つ → 締め(見本)
  const listLen = T.stageStart - T.introEnd;
  const head = path.join(WORK, 'head.mp4');
  // 冒頭の映像: plan.intro があれば作り直した物(beat-stage-intro.js)、無ければ見本のまま。音はどちらも見本の冒頭
  const introSrc = plan.intro ? await require('./beat-stage-intro.js').buildIntro({ ROOT, WORK, fontsHead: fontsHead(), plan, end: T.introEnd + T.listFade + 0.1 }) : tpl;
  ff(['-i', introSrc, '-loop', '1', '-framerate', String(FPS), '-t', String(listLen), '-i', path.join(L, 'list.png'), '-filter_complex',
    `[0:v]trim=0:${T.introEnd},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p,tpad=stop_mode=clone:stop_duration=${T.listFade}[a];[1:v]fps=${FPS},format=yuv420p[b];[a][b]xfade=transition=fade:duration=${T.listFade}:offset=${T.introEnd},trim=0:${T.stageStart},setpts=PTS-STARTPTS[v]`,
    '-map', '[v]', '-frames:v', String(Math.round(T.stageStart * FPS)), '-c:v', 'libx264', '-crf', '10', '-preset', 'veryfast', head]);
  const tail = path.join(WORK, 'tail.mp4');
  ff(['-i', tpl, '-vf', `trim=${T.outroStart}:${T.end},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p`, '-frames:v', String(Math.round((T.end - T.outroStart) * FPS)), '-c:v', 'libx264', '-crf', '10', '-preset', 'veryfast', tail]);
  const aHead = path.join(WORK, 'a-head.wav'), aTail = path.join(WORK, 'a-tail.wav');
  ff(['-i', tpl, '-vn', '-af', `atrim=0:${T.stageStart},asetpts=PTS-STARTPTS,afade=t=out:st=${T.stageStart - 0.02}:d=0.02`, '-ac', '2', '-ar', '48000', aHead]);
  ff(['-i', tpl, '-vn', '-af', `atrim=${T.outroStart}:${T.end},asetpts=PTS-STARTPTS`, '-ac', '2', '-ar', '48000', aTail]);
  const vids = [head, ...stages, tail], auds = [aHead, ...audios, aTail];
  const out = R(plan.output);
  const inArgs = [...vids.flatMap(v => ['-i', v]), ...auds.flatMap(a => ['-i', a])];
  const nv = vids.length;
  const fc = `${vids.map((_, k) => `[${k}:v]`).join('')}concat=n=${nv}:v=1:a=0[v];${auds.map((_, k) => `[${nv + k}:a]`).join('')}concat=n=${auds.length}:v=0:a=1[a]`;
  ff([...inArgs, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-c:v', 'libx264', '-crf', String(plan.crf || 17), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-t', String(T.end), out]);
  const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'compact', out], { quiet: true }).trim();
  console.log('書き出し:', path.relative(ROOT, out)); console.log(' ', probe.replace(/\n/g, ' / '));
  if (plan.sheet) { contactSheet(out, R(plan.sheet)); console.log('一覧の絵:', plan.sheet); }
})().catch(e => { console.error(e); process.exit(1); });
